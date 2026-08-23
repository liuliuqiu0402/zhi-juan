// 分步流水线 Runner：依赖注入编排器（可 mock 单测）
import { describe, it, expect } from 'vitest';
import { runExamPipeline } from '@/config/examPipelineRunner';
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

  it('板块指令注入教材原文与语义例题（素材精准调用）', async () => {
    const { deps, calls } = makeDeps();
    await runExamPipeline(baseOpts(), deps);
    const firstPrompt = calls[0].prompt;
    expect(firstPrompt).toContain('教材原文依据');
    expect(firstPrompt).toContain('教材例题/情境参照');
    expect(firstPrompt).toContain('严禁照抄');
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
});
