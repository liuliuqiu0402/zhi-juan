// 分步流水线 Runner：依赖注入编排器（可 mock 单测）
import { describe, it, expect } from 'vitest';
import { runExamPipeline, filterSystemByMode } from '@/config/examPipelineRunner';
import { getExamBlueprint } from '@/config/examPaperBlueprints';

const EXAM = getExamBlueprint('语文', 'middle', '江苏·南京'); // 120分制

/** 构造一个可 mock 的依赖集合 */
const SECTION_HTML = '<h2>一、测试板块</h2><p class="question">1. 测试题。（2分）</p>'
  + '<p class="option">A. 选项一</p><p class="option">B. 选项二</p>'
  + '<p class="question">2. 第二道测试题目，用于确保内容长度超过最小阈值。（3分）</p>'
  + '<p class="option">A. 甲</p><p class="option">B. 乙</p><p class="option">C. 丙</p>';

const makeDeps = (overrides = {}) => {
  const calls = [];
  const deps = {
    callAI: async (prompt, opts) => {
      calls.push({ prompt, opts });
      return SECTION_HTML;
    },
    retrieveSegments: (cards, kps) => `【原文】${kps[0] || ''}`,
    semanticSearch: (kp) => [{ chapterTitle: '教材', text: `例题：${kp}`, type: '例题' }],
    isAborted: () => false,
    setStatus: () => {},
    setProgress: () => {},
    log: () => {},
    warn: () => {},
    ...overrides,
  };
  return { deps, calls };
};

const baseOpts = (overrides = {}) => ({
  instruction: '请生成一份试卷。\n结构参考：\n一、基础建构\n二、任务驱动',
  systemMessage: '系统约束',
  examBlueprint: EXAM,
  subject: '语文',
  stage: 'middle',
  region: '江苏·南京',
  book: { subject: '语文', grade: '八年级' },
  contentCards: [{ segments: [{ text: '原文', knowledgePoints: ['积累'] }] }],
  knowledgeMap: { knowledgePoints: ['古诗文默写'], knowledgeGraph: [] },
  materialText: '',
  genType: 'exam',
  totalScore: 120,
  ...overrides,
});

describe('分步流水线 Runner（依赖注入编排器）', () => {
  it('exam：按蓝本板块顺序逐板块调用 callAI，并生成答案页', async () => {
    const { deps, calls } = makeDeps();
    const result = await runExamPipeline(baseOpts(), deps);
    // 板块数 = 蓝本板块数（语文初中 4 板块）+ 1 次答案页调用
    expect(calls.length).toBe(EXAM.sections.length + 1);
    expect(result.sections.length).toBe(EXAM.sections.length);
    // 首个板块指令包含蓝本板块名
    expect(calls[0].prompt).toContain(EXAM.sections[0].name);
    // 末次调用为答案页
    expect(calls[calls.length - 1].prompt).toContain('参考答案');
    // 内容拼接：卷首 + 板块 + 答案区
    expect(result.content).toContain('考试时间');
    expect(result.content).toContain('answer-section');
    expect(result.answerGenerated).toBe(true);
  });

  it('板块指令注入命题素材（可加工要素非原文）与基准（素材精准调用）', async () => {
    const { deps, calls } = makeDeps();
    await runExamPipeline(baseOpts(), deps);
    const firstPrompt = calls[0].prompt;
    expect(firstPrompt).toContain('命题素材');
    expect(firstPrompt).toContain('禁止照抄教材原文');
    expect(firstPrompt).toContain('命题内容质量基准');
  });

  it('非 exam：从结构大纲解析板块（无蓝本时）', async () => {
    const { deps, calls } = makeDeps();
    const result = await runExamPipeline(baseOpts({ examBlueprint: null, genType: 'practice' }), deps);
    // 结构大纲 2 板块 + 1 答案页
    expect(calls.length).toBe(2 + 1);
    expect(result.sections.length).toBe(2);
    expect(result.sections[0].name).toContain('基础建构');
    expect(calls[0].prompt).toContain('基础建构');
    // 非 exam 卷首不写"满分"
    expect(result.content).not.toContain('满分');
  });

  it('板块失败后重试成功（单板块 2 次机会）', async () => {
    let failCount = 0;
    const { deps, calls } = makeDeps({
      callAI: async (prompt) => {
        // 第一个板块第一次调用失败，第二次成功；其余调用直接成功
        if (prompt.includes('积累与运用') && failCount === 0) {
          failCount++;
          throw new Error('首次失败');
        }
        return SECTION_HTML;
      },
    });
    const result = await runExamPipeline(baseOpts(), deps);
    expect(result.content).toContain('测试板块');
    expect(failCount).toBe(1); // 恰好重试一次
    expect(result.answerGenerated).toBe(true);
  });

  it('板块始终失败（超过重试）→ 抛错', async () => {
    const { deps } = makeDeps({
      callAI: async () => { throw new Error('持续失败'); },
    });
    await expect(runExamPipeline(baseOpts(), deps)).rejects.toThrow('板块');
  });

  it('取消信号 → 立即中止', async () => {
    const { deps } = makeDeps({ isAborted: () => true });
    await expect(runExamPipeline(baseOpts(), deps)).rejects.toThrow('取消');
  });

  it('答案页失败不阻断正文（answerGenerated=false，正文仍返回）', async () => {
    let callCount = 0;
    const { deps } = makeDeps({
      callAI: async (prompt) => {
        callCount++;
        if (prompt.includes('参考答案')) throw new Error('答案页失败');
        return SECTION_HTML;
      },
    });
    const result = await runExamPipeline(baseOpts(), deps);
    expect(result.answerGenerated).toBe(false);
    expect(result.answerError).toContain('答案页失败');
    expect(result.content).toContain('测试板块');
  });

  it('缺 callAI 依赖 → 抛出明确错误', async () => {
    await expect(runExamPipeline(baseOpts(), {})).rejects.toThrow('callAI');
  });

  it('无结构大纲且无蓝本 → 抛错（不误跑）', async () => {
    const { deps } = makeDeps();
    await expect(
      runExamPipeline(baseOpts({ examBlueprint: null, instruction: '没有结构大纲' }), deps)
    ).rejects.toThrow('板块');
  });

  it('板块指令注入命题内容质量基准（学科×学段硬规范）', async () => {
    const { deps, calls } = makeDeps();
    await runExamPipeline(baseOpts(), deps);
    const firstPrompt = calls[0].prompt;
    expect(firstPrompt).toContain('命题内容质量基准');
    expect(firstPrompt).toContain('硬性要求');
  });

  it('🔴 教材卡片为空时 exam 流水线仍真正运行（不绕过）：板块数=蓝本、卷首/标题由代码拼装', async () => {
    const { deps, calls } = makeDeps();
    const result = await runExamPipeline(baseOpts({ contentCards: [] }), deps);
    // 无卡片也逐板块生成：板块数 = 蓝本板块数 + 答案页
    expect(calls.length).toBe(EXAM.sections.length + 1);
    expect(result.sections.length).toBe(EXAM.sections.length);
    // 卷首由代码拼装：时长/满分/密封线信息栏（模型无机会写错）
    expect(result.content).toContain(`考试时间：${EXAM.duration}`);
    expect(result.content).toContain(`满分：${EXAM.fullScore}分`);
    expect(result.content).toContain('密封线内不要答题');
    expect(result.content).toContain('学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿');
    // 板块指令含蓝本明细式标题模板（共X题，每题X分，共X分）
    expect(calls[0].prompt).toMatch(/共\d+题[^）]*共\d+分/);
    // 无卡片时素材回退不阻断：板块指令仍含基准与骨架
    expect(calls[0].prompt).toContain('命题内容质量基准');
  });

  it('🔴 非 exam 无结构大纲、无教材卡片时，用教辅库栏目兜底分步（全局强制分步，不回退整卷）', async () => {
    const { deps, calls } = makeDeps();
    const result = await runExamPipeline(
      baseOpts({ examBlueprint: null, genType: 'practice', contentCards: [], instruction: '无结构大纲', totalScore: 0 }),
      deps
    );
    // practice 栏目（情境任务/基础型/发展型/拓展型/答案解析 ≥4）+ 答案页
    expect(result.sections.length).toBeGreaterThanOrEqual(4);
    expect(calls.length).toBe(result.sections.length + 1);
    // 板块指令走教辅编辑角色知识库（双角色分流）
    expect(calls[0].prompt).toContain('教辅编辑');
    expect(calls[0].prompt).toContain('情境任务');
    // 非 exam 卷首不写"满分"
    expect(result.content).not.toContain('满分');
  });
});

describe('systemMessage 场景化裁剪（根治每次调用携带整段长指令）', () => {
  const FULL_SYSTEM = '输出纪律前言\n'
    + '【角色身份】你是命题专家\n'
    + '【红线约束】禁止超纲\n'
    + '【真题卷结构蓝本】全卷所有板块分值明细...（很长）\n'
    + '【格式规范】题目用p标签\n'
    + '【尾约束】填空用blank标签\n'
    + '【答案区强制锚定】答案放答案页\n'
    + '【答案与解析规范】每题为解析\n'
    + '【学科核心素养】素养立意';

  it('section 模式：保留角色/红线/格式/尾约束/素养，剔除蓝本全文/答案规范', () => {
    const s = filterSystemByMode(FULL_SYSTEM, 'section');
    expect(s).toContain('角色身份');
    expect(s).toContain('红线约束');
    expect(s).toContain('格式规范');
    expect(s).toContain('尾约束');
    expect(s).toContain('学科核心素养');
    expect(s).not.toContain('真题卷结构蓝本');
    expect(s).not.toContain('答案区强制锚定');
    expect(s).not.toContain('答案与解析规范');
    expect(s).toContain('输出纪律前言'); // preamble 保留
  });

  it('answer 模式：保留角色/红线/答案锚定/答案规范，剔除蓝本全文/格式尾约束', () => {
    const s = filterSystemByMode(FULL_SYSTEM, 'answer');
    expect(s).toContain('答案区强制锚定');
    expect(s).toContain('答案与解析规范');
    expect(s).toContain('红线约束');
    expect(s).not.toContain('真题卷结构蓝本');
    expect(s).not.toContain('格式规范');
    expect(s).not.toContain('尾约束');
  });

  it('空 system 返回空串', () => {
    expect(filterSystemByMode('', 'section')).toBe('');
    expect(filterSystemByMode(null, 'answer')).toBe('');
  });
});
