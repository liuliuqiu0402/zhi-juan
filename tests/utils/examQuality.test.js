import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMatchingBlockInstructions } from '@/config/instructionLib.js';
import { EXAM_NEW_STANDARD, EXAM_STAGE_STANDARDS, EXAM_BLUEPRINTS, EXAM_PAPER_LAYOUT } from '@/config/examPaperBlueprints';
import { buildMultiUnitExamConstraint } from '@/composables/useAiGenerator.js';
import { HardRuleChecker, AISemanticReviewer } from '@/utils/qualityChecker';

// 蓝图 prompt 构建在 useAiGenerator() 闭包内部（依赖完整生成流程），
// 此处以源码文本断言验证「section 字段 / 知识点去重 / 相似题禁令」已注入模板
const useAiGeneratorSrc = readFileSync(
  resolve(process.cwd(), 'src/composables/useAiGenerator.js'),
  'utf8'
);

describe('exam 正式考试标准——指令注入', () => {
  it('quality_exam_formal 合并版块对 exam 匹配（formal+proposition 已合并）', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-品质标准', subject: '语文', stage: 'primary_mid', genType: 'exam',
    });
    const formal = blocks.find(b => b.id === 'quality_exam_formal');
    expect(formal).toBeTruthy();
    expect(formal.content).toContain('正式考试命题标准');
    expect(formal.content).toContain('效度与信度');
    expect(formal.content).toContain('知识点去重');
    expect(formal.content).toContain('时间配比');
    expect(formal.content).toContain('不标题套壳');
  });

  it('quality_exam_proposition 已删除（命题技法条款并入 quality_exam_formal）', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-品质标准', subject: '数学', stage: 'primary_mid', genType: 'exam',
    });
    expect(blocks.find(b => b.id === 'quality_exam_proposition')).toBeFalsy();
    const formal = blocks.find(b => b.id === 'quality_exam_formal');
    expect(formal).toBeTruthy();
    expect(formal.content).toContain('小题规范');
    expect(formal.content).toContain('形式多样');
  });

  it('学科专属命题技法块：对应学科 exam 匹配', () => {
    const cases = [
      ['语文', 'quality_exam_prop_chinese', '文言文'],
      ['数学', 'quality_exam_prop_math', '作图题'],
      ['英语', 'quality_exam_prop_english', '完形填空'],
      ['物理', 'quality_exam_prop_physics', '控制变量'],
      ['化学', 'quality_exam_prop_chemistry', '方程式'],
      ['生物', 'quality_exam_prop_biology', '对照实验'],
      ['道德与法治', 'quality_exam_prop_politics', '材料分析'],
      ['历史', 'quality_exam_prop_history', '论述题'],
      ['地理', 'quality_exam_prop_geography', '读图'],
    ];
    for (const [subject, id, keyword] of cases) {
      const blocks = getMatchingBlockInstructions({
        category: '生成-品质标准', subject, stage: '', genType: 'exam',
      });
      const block = blocks.find(b => b.id === id);
      expect(block, `${subject} 应匹配 ${id}`).toBeTruthy();
      expect(block.content).toContain(keyword);
      // 合并版通用正式考试标准块应同时注入
      expect(blocks.find(b => b.id === 'quality_exam_formal')).toBeTruthy();
    }
  });

  it('学科专属命题技法块：非对应学科不匹配', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-品质标准', subject: '数学', stage: '', genType: 'exam',
    });
    expect(blocks.find(b => b.id === 'quality_exam_prop_chinese')).toBeFalsy();
    expect(blocks.find(b => b.id === 'quality_exam_prop_english')).toBeFalsy();
    expect(blocks.find(b => b.id === 'quality_exam_prop_physics')).toBeFalsy();
  });

  it('quality_exam_real_volume 已删除（真题卷对标并入 formal 时间配比/小题规范条款）', () => {
    for (const subject of ['语文', '数学', '物理']) {
      const blocks = getMatchingBlockInstructions({
        category: '生成-品质标准', subject, stage: 'middle', genType: 'exam',
      });
      expect(blocks.find(b => b.id === 'quality_exam_real_volume'), `${subject} 不应存在已删除条目`).toBeFalsy();
    }
  });

  it('语数英学科块含真题特色题型（综合性学习/统计图表/补全对话）', () => {
    const cases = [
      ['语文', 'quality_exam_prop_chinese', '综合性学习', '拟标语'],
      ['数学', 'quality_exam_prop_math', '统计与概率', '图表数据真实'],
      ['英语', 'quality_exam_prop_english', '补全对话', '交际用语'],
    ];
    for (const [subject, id, kw1, kw2] of cases) {
      const blocks = getMatchingBlockInstructions({
        category: '生成-品质标准', subject, stage: '', genType: 'exam',
      });
      const block = blocks.find(b => b.id === id);
      expect(block, `${subject} 应匹配 ${id}`).toBeTruthy();
      expect(block.content).toContain(kw1);
      expect(block.content).toContain(kw2);
    }
  });

  it('quality_exam_formal 块对非 exam 不匹配', () => {
    for (const genType of ['practice', 'special', 'summary', 'review', 'reading', 'dictation', 'errorbook', 'preview']) {
      const blocks = getMatchingBlockInstructions({
        category: '生成-品质标准', subject: '语文', stage: 'primary_mid', genType,
      });
      expect(blocks.find(b => b.id === 'quality_exam_formal')).toBeFalsy();
    }
  });

  it('素养立意范式与挖空禁令由真题蓝本承载（红线块保留原创底线+蓝本权威）', () => {
    // 设问动词多样化/挖空禁令已统一收敛到蓝本 EXAM_NEW_STANDARD，避免与红线块重复注入
    expect(EXAM_NEW_STANDARD).toContain('教材原句挖空');
    expect(EXAM_NEW_STANDARD).toContain('设问动词多样化');
    expect(EXAM_NEW_STANDARD).toContain('记忆型考点必须转化为情境运用型设问');
    // 生成端强化（真实试卷翻车修复）：课文类填空判据 / 低段操作题与题量控制 / 语文低段蓝本配图与出处
    expect(EXAM_NEW_STANDARD).toContain('课文知识类填空判据');
    expect(EXAM_STAGE_STANDARDS.primary).toContain('全卷操作型小题至少2处');
    expect(EXAM_STAGE_STANDARDS.primary).toContain('题量控制');
    const cnLow = EXAM_BLUEPRINTS['语文|primary_low'];
    expect(cnLow.sections.find(s => s.name === '积累与运用').note).toContain('"我们要____动物"');
    expect(cnLow.sections.find(s => s.name === '阅读与鉴赏').note).toContain('选文末标注出处');
    expect(cnLow.sections.find(s => s.name === '表达与交流').note).toContain('严禁用"（看图写话）"等文字占位');
    // 全局修复（全学段全学科）：卷面规范层配图占位禁令 + 课内选文出处 + 语文中高段判据引用
    expect(EXAM_PAPER_LAYOUT).toContain('严禁用"（看图写话）""（配图）""（插图）"等文字占位');
    expect(EXAM_PAPER_LAYOUT).toContain('课内选文末标注出处');
    for (const st of ['primary_mid', 'primary_high']) {
      expect(EXAM_BLUEPRINTS[`语文|${st}`].sections.find(s => s.name === '积累与运用').note).toContain('课文知识类填空判据');
    }
    for (const subject of ['语文', '数学']) {
      const blocks = getMatchingBlockInstructions({
        category: '生成-红线约束', subject, stage: 'primary_low', genType: 'exam',
      });
      const rl = blocks.find(b => b.id === 'quality_redlines_exam');
      expect(rl, `${subject} 应匹配红线块`).toBeTruthy();
      expect(rl.content).toContain('独立原创设计');
      expect(rl.content).toContain('【真题卷结构蓝本】为唯一依据');
    }
  });

  it('红线块对 exam 匹配且含原创底线+蓝本权威', () => {
    for (const subject of ['语文', '数学', '英语', '物理', '历史']) {
      const blocks = getMatchingBlockInstructions({
        category: '生成-红线约束', subject, stage: 'middle', genType: 'exam',
      });
      const rl = blocks.find(b => b.id === 'quality_redlines_exam');
      expect(rl, `${subject} 应匹配红线块`).toBeTruthy();
      expect(rl.content).toContain('最高优先级');
      expect(rl.content).toContain('独立原创设计');
      expect(rl.content).toContain('禁止课本例题/习题原题照搬');
      expect(rl.content).toContain('【真题卷结构蓝本】为唯一依据');
    }
  });

  it('红线块对非 exam 不匹配', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-红线约束', subject: '语文', stage: 'primary_low', genType: 'practice',
    });
    expect(blocks.find(b => b.id === 'quality_redlines_exam')).toBeFalsy();
  });

  it('旧 quality_literacy 块已删除（任何 genType 均不匹配，避免与红线重复注入）', () => {
    for (const genType of ['exam', 'practice', 'special', 'summary']) {
      const blocks = getMatchingBlockInstructions({
        category: '生成-品质标准', subject: '语文', stage: 'primary_low', genType,
      });
      expect(blocks.find(b => b.id === 'quality_literacy')).toBeFalsy();
    }
  });

  it('低段语文范例块示范素养立意范式且禁止回忆式设问', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-质量范例', subject: '语文', stage: 'primary_low', genType: 'exam',
    });
    const ex = blocks.find(b => b.id === 'block_example_exam_chinese_lower');
    expect(ex).toBeTruthy();
    expect(ex.content).toContain('情境识字');
    expect(ex.content).toContain('字理归类');
    expect(ex.content).toContain('生活联结');
    expect(ex.content).toContain('禁止回忆式设问');
    // 旧版范例示范的「课文原句回忆题」（小蝌蚪/前腿后腿）已清除，仅保留禁令中的反面示例
    expect(ex.content).not.toContain('A.前腿 B.后腿');
  });

  it('低段数学范例块示范素养立意范式且禁止挖空', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-质量范例', subject: '数学', stage: 'primary_low', genType: 'exam',
    });
    const ex = blocks.find(b => b.id === 'block_example_exam_math_lower');
    expect(ex).toBeTruthy();
    expect(ex.content).toContain('情境计算');
    expect(ex.content).toContain('说理题');
    expect(ex.content).toContain('生活联结');
    expect(ex.content).toContain('禁止书本挖空');
    expect(ex.content).toContain('禁止纯算式罗列');
  });

  it('高段数学范例块含开放题/说理且禁止公式挖空', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-质量范例', subject: '数学', stage: 'primary_high', genType: 'exam',
    });
    const ex = blocks.find(b => b.id === 'block_example_exam_math_high');
    expect(ex).toBeTruthy();
    expect(ex.content).toContain('开放题');
    expect(ex.content).toContain('说理题');
    expect(ex.content).toContain('禁止书本挖空');
    expect(ex.content).toContain('必须换情境、换数据重新设计');
  });

  it('中段语文范例块示范素养立意且禁止课文挖词', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-质量范例', subject: '语文', stage: 'primary_mid', genType: 'exam',
    });
    const ex = blocks.find(b => b.id === 'block_example_exam_chinese_mid');
    expect(ex).toBeTruthy();
    expect(ex.content).toContain('语境运用');
    expect(ex.content).toContain('探究发现');
    expect(ex.content).toContain('禁止书本挖空');
    expect(ex.content).not.toContain('多音字辨析、近义词选词填空');
  });

  it('高段语文范例块要求理解性默写且禁止挖原句', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-质量范例', subject: '语文', stage: 'primary_high', genType: 'exam',
    });
    const ex = blocks.find(b => b.id === 'block_example_exam_chinese_high');
    expect(ex).toBeTruthy();
    expect(ex.content).toContain('理解性默写');
    expect(ex.content).toContain('禁止机械单句默写');
    expect(ex.content).toContain('禁止书本挖空');
  });

  it('英语通用范例块禁止单词表机械互译', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-质量范例', subject: '英语', stage: '', genType: 'exam',
    });
    const ex = blocks.find(b => b.id === 'block_example_exam_english');
    expect(ex).toBeTruthy();
    expect(ex.content).toContain('禁止书本挖空');
    expect(ex.content).toContain('不孤立考查语法定义');
  });

  it('源码：红线约束注入点在品质标准之前（前置防稀释）', () => {
    const redlineIdx = useAiGeneratorSrc.indexOf('生成-红线约束');
    const qualityIdx = useAiGeneratorSrc.indexOf("category: '生成-品质标准', matchSubject");
    expect(redlineIdx).toBeGreaterThan(0);
    expect(qualityIdx).toBeGreaterThan(0);
    expect(redlineIdx).toBeLessThan(qualityIdx);
  });

  it('topconst_exam 含知识点考查去重与大题结构蓝本（标注仅限内部设计）', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-顶层约束', subject: '', stage: '', genType: 'exam',
    });
    const tc = blocks.find(b => b.id === 'topconst_exam');
    expect(tc).toBeTruthy();
    expect(tc.content).toContain('知识点考查去重');
    expect(tc.content).toContain('真题卷结构蓝本');
    expect(tc.content).toContain('严禁在试卷正文输出任何知识点/层级标注');
    expect(tc.content).not.toContain('基础·识记积累');
  });

  it('认知层级块不再要求卷面标注', () => {
    const blocks = getMatchingBlockInstructions({
      category: '生成-通用约束', subject: '', stage: 'middle', genType: 'exam',
    });
    const cog = blocks.filter(b => b.id && b.id.startsWith('frag_cognitive'));
    expect(cog.length).toBeGreaterThan(0);
    for (const c of cog) {
      expect(c.content).toContain('不在试卷正文标注');
      expect(c.content).not.toContain('每道题后标注认知层级');
    }
  });
});

describe('exam 正式考试标准——多单元组卷约束', () => {
  const multiUnitMap = {
    knowledgeGraph: [
      { unit: '第一单元', bigConcepts: [{ name: '大概念A', coreKnowledge: [{ name: '加法' }, { name: '减法' }] }] },
      { unit: '第二单元', bigConcepts: [{ name: '大概念B', coreKnowledge: [{ name: '乘法' }] }] },
    ],
  };
  const singleUnitMap = {
    knowledgeGraph: [
      { unit: '第一单元', bigConcepts: [{ name: '大概念A', coreKnowledge: [{ name: '加法' }] }] },
    ],
  };

  it('多单元 + exam → 注入约束与单元知识点统计', () => {
    const text = buildMultiUnitExamConstraint(multiUnitMap, true);
    expect(text).toContain('多单元组卷规范');
    expect(text).toContain('本次覆盖2个单元');
    expect(text).toContain('【单元知识点统计】');
    expect(text).toContain('第一单元：2个知识点');
    expect(text).toContain('第二单元：1个知识点');
    expect(text).toContain('单元权重分配');
    expect(text).toContain('跨单元综合题');
  });

  it('单单元 → 不注入', () => {
    expect(buildMultiUnitExamConstraint(singleUnitMap, true)).toBe('');
  });

  it('非 exam → 不注入', () => {
    expect(buildMultiUnitExamConstraint(multiUnitMap, false)).toBe('');
  });

  it('无图谱 → 不注入', () => {
    expect(buildMultiUnitExamConstraint(null, true)).toBe('');
    expect(buildMultiUnitExamConstraint({}, true)).toBe('');
  });
});

describe('exam 正式考试标准——蓝图 prompt 模板', () => {
  it('JSON 规范含 section 字段（真题蓝本大题归属）', () => {
    expect(useAiGeneratorSrc).toContain('"section": "填空"');
    expect(useAiGeneratorSrc).toContain('"section": "解答题"');
    expect(useAiGeneratorSrc).toContain('取值严格使用【真题卷结构蓝本】中的大题名');
  });

  it('命题约束含知识点考查次数上限', () => {
    expect(useAiGeneratorSrc).toContain('知识点考查去重（正式考试标准）');
    expect(useAiGeneratorSrc).toContain('重难点知识点最多考查2次且必须角度不同');
  });

  it('命题约束含相似题禁令', () => {
    expect(useAiGeneratorSrc).toContain('相似题禁令：同一大题组内不得出现题材');
  });
});

describe('exam 正式考试标准——qualityChecker 质检', () => {
  it('无层级标题 → 触发「缺少分类分层」', () => {
    const content = '<div class="question">1. 3+5=？（2分）</div>';
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '缺少分类分层')).toBe(true);
  });

  it('板块标题含层级词 → 不触发「缺少分类分层」', () => {
    const content = '<h2>一、基础·识记积累</h2><h2>二、能力·理解运用</h2><div class="question">1. 3+5=？（2分）</div>';
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '缺少分类分层')).toBe(false);
  });

  it('蓝图同知识点 3 次 → 触发「知识点重复考查」', () => {
    const blueprint = [
      { knowledgePoint: '加法' },
      { knowledgePoint: '加法' },
      { knowledgePoint: '加法' },
    ];
    const issues = HardRuleChecker.checkGenTypeSpecific('<h2>一、基础·识记积累</h2>', 'exam', blueprint);
    expect(issues.some(i => i.type === '知识点重复考查')).toBe(true);
  });

  it('蓝图同知识点 ≤2 次 → 不触发「知识点重复考查」', () => {
    const blueprint = [
      { knowledgePoint: '加法' },
      { knowledgePoint: '减法' },
      { knowledgePoint: '加法' },
    ];
    const issues = HardRuleChecker.checkGenTypeSpecific('<h2>一、基础·识记积累</h2>', 'exam', blueprint);
    expect(issues.some(i => i.type === '知识点重复考查')).toBe(false);
  });

  it('归一化后完全相同的题目 → 触发「存在重复题目」', () => {
    const q = '<div class="question">1. 3+5=？ A.6 B.8</div>';
    const content = `<h2>一、基础·识记积累</h2>${q}${q}`;
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '存在重复题目')).toBe(true);
  });

  it('题目不同 → 不触发「存在重复题目」', () => {
    const content = '<h2>一、基础·识记积累</h2><div class="question">1. 3+5=？</div><div class="question">2. 7-2=？</div>';
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '存在重复题目')).toBe(false);
  });

  it('非 exam 类型不触发考试专项检测', () => {
    const issues = HardRuleChecker.checkGenTypeSpecific('<div class="question">练习内容</div>', 'practice', [
      { knowledgePoint: '加法' }, { knowledgePoint: '加法' }, { knowledgePoint: '加法' },
    ]);
    expect(issues.some(i => i.type === '缺少分类分层')).toBe(false);
    expect(issues.some(i => i.type === '知识点重复考查')).toBe(false);
    expect(issues.some(i => i.type === '存在重复题目')).toBe(false);
  });

  it('选择题占比过高 → 触发「题型单一」', () => {
    const choiceQ = '<div class="question">1. 3+5=？ A.6 B.8 C.9 D.10（2分）</div>';
    const content = `<h2>一、基础·识记积累</h2>${choiceQ.repeat(10)}`;
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '题型单一')).toBe(true);
  });

  it('选择题占比 60% 且 ≥10 题 → 触发「题型单一」', () => {
    const choiceQ = '<div class="question">1. 3+5=？ A.6 B.8 C.9 D.10（2分）</div>';
    const fillQ = '<div class="question">2. 7-2=____（2分）</div>';
    const content = `<h2>一、基础·识记积累</h2>${choiceQ.repeat(7)}${fillQ.repeat(3)}`;
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '题型单一')).toBe(true);
  });

  it('题型混合 → 不触发「题型单一」', () => {
    const choiceQ = '<div class="question">1. 3+5=？ A.6 B.8 C.9 D.10（2分）</div>';
    const fillQ = '<div class="question">2. 7-2=____（2分）</div>';
    const content = `<h2>一、基础·识记积累</h2>${choiceQ.repeat(4)}${fillQ.repeat(4)}`;
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '题型单一')).toBe(false);
  });

  it('题量不足 10 题时不检测题型单一（防误报）', () => {
    const choiceQ = '<div class="question">1. 3+5=？ A.6 B.8 C.9 D.10（2分）</div>';
    const content = `<h2>一、基础·识记积累</h2>${choiceQ.repeat(9)}`;
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '题型单一')).toBe(false);
  });

  it('两道表达类大题 → 触发「表达题过多」', () => {
    const content = '<h2>一、基础·识记积累</h2><h3>12. 看图写话（12分）</h3><h3>13. 习作（10分）</h3>';
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '表达题过多')).toBe(true);
  });

  it('仅一道写作题 → 不触发「表达题过多」', () => {
    const content = '<h2>一、基础·识记积累</h2><h3>12. 看图写话（12分）</h3><h3>13. 量词变式运用（6分）</h3>';
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '表达题过多')).toBe(false);
  });

  it('正文含〔知识点：×｜层级：×〕标注 → 触发「卷面标注残留」', () => {
    const content = '<h3>1. 看拼音写词语（6分）〔知识点：会写字书写｜层级：识记〕</h3>';
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '卷面标注残留')).toBe(true);
  });

  it('正文无标注 → 不触发「卷面标注残留」', () => {
    const content = '<h3>1. 看拼音写词语（6分）</h3>';
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '卷面标注残留')).toBe(false);
  });

  it('回忆式设问 ≥5 处 → 触发「回忆式设问过多」', () => {
    const content = `
      1. 杨树的特点是（ ）
      2. 枫树的特点是（ ）
      3. "美"的反义词是（ ）
      4. "真诚"的反义词是（ ）
      5. "行"的读音是（ ）
    `;
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '回忆式设问过多')).toBe(true);
  });

  it('回忆式设问 <5 处 → 不触发', () => {
    const content = '1. 杨树的特点是（ ）\n2. 校园里，妈妈买的豆角用（ ）量词\n3. 说一说你喜欢哪种树，为什么？';
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '回忆式设问过多')).toBe(false);
  });

  it('数学公式挖空 ≥5 处 → 触发「回忆式设问过多」', () => {
    const content = `
      1. 长方形的面积公式是（ ）
      2. 正方形的周长公式是（ ）
      3. 加法的定义是（ ）
      4. 三角形的面积公式是（ ）
      5. 因数的定义是（ ）
    `;
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '回忆式设问过多')).toBe(true);
  });

  it('英语单词表互译 ≥5 处 → 触发「回忆式设问过多」', () => {
    const content = `
      1. apple 的中文意思是（ ）
      2. banana 的中文意思是（ ）
      3. cat 的英文意思是（ ）
      4. dog 的中文意思是（ ）
      5. book 的英文意思是（ ）
    `;
    const issues = HardRuleChecker.checkGenTypeSpecific(content, 'exam', []);
    expect(issues.some(i => i.type === '回忆式设问过多')).toBe(true);
  });
});

describe('exam 正式考试标准——质检闭环（AI 修复链路）', () => {
  it('考试专项 warning 对 exam 升级为可修复（error）', () => {
    const examWarnings = [
      { severity: 'warning', type: '缺少分类分层', detail: 'x', autoFix: false },
      { severity: 'warning', type: '知识点重复考查', detail: 'x', autoFix: false },
      { severity: 'warning', type: '存在重复题目', detail: 'x', autoFix: false },
      { severity: 'warning', type: '题型单一', detail: 'x', autoFix: false },
      { severity: 'warning', type: '表达题过多', detail: 'x', autoFix: false },
      { severity: 'warning', type: '卷面标注残留', detail: 'x', autoFix: false },
      { severity: 'warning', type: '回忆式设问过多', detail: 'x', autoFix: false },
    ];
    const repairable = HardRuleChecker.getRepairableIssues(examWarnings, 'exam');
    expect(repairable).toHaveLength(7);
    expect(repairable.every(i => i.severity === 'error')).toBe(true);
  });

  it('考试专项 warning 对非 exam 不升级（不误伤其他类型）', () => {
    const warnings = [
      { severity: 'warning', type: '缺少分类分层', detail: 'x', autoFix: false },
      { severity: 'warning', type: '知识点重复考查', detail: 'x', autoFix: false },
      { severity: 'warning', type: '题型单一', detail: 'x', autoFix: false },
      { severity: 'warning', type: '表达题过多', detail: 'x', autoFix: false },
      { severity: 'warning', type: '卷面标注残留', detail: 'x', autoFix: false },
      { severity: 'warning', type: '回忆式设问过多', detail: 'x', autoFix: false },
    ];
    expect(HardRuleChecker.getRepairableIssues(warnings, 'practice')).toHaveLength(0);
  });

  it('全类型通用 warning（重复题/相似题/拼音标调）在非 exam 同样升级', () => {
    const warnings = [
      { severity: 'warning', type: '存在重复题目', detail: 'x', autoFix: false },
      { severity: 'warning', type: '疑似相似题', detail: 'x', autoFix: false },
      { severity: 'warning', type: '拼音未标调', detail: 'x', autoFix: false },
      { severity: 'warning', type: '绝对化选项滥用', detail: 'x', autoFix: false },
    ];
    const repairable = HardRuleChecker.getRepairableIssues(warnings, 'practice');
    expect(repairable).toHaveLength(4);
    expect(repairable.every((i) => i.severity === 'error')).toBe(true);
  });

  it('修复 prompt 含三大板块重组/去重/改写/题型多样/表达题/标注指引', () => {
    const prompt = HardRuleChecker.buildRepairPrompt('<p>内容</p>', [
      { severity: 'error', type: '缺少分类分层', detail: 'x', autoFix: false },
      { severity: 'error', type: '知识点重复考查', detail: 'x', autoFix: false },
      { severity: 'error', type: '存在重复题目', detail: 'x', autoFix: false },
      { severity: 'error', type: '题型单一', detail: 'x', autoFix: false },
      { severity: 'error', type: '表达题过多', detail: 'x', autoFix: false },
      { severity: 'error', type: '卷面标注残留', detail: 'x', autoFix: false },
      { severity: 'error', type: '回忆式设问过多', detail: 'x', autoFix: false },
    ], { genType: 'exam' });
    expect(prompt).toContain('真题卷结构蓝本');
    expect(prompt).toContain('重难点最多2次且必须角度不同');
    expect(prompt).toContain('更换题材/情境/数据/设问角度');
    expect(prompt).toContain('改写成填空/判断/简答/操作等多样题型');
    expect(prompt).toContain('仅保留1道写作题');
    expect(prompt).toContain('正式考试卷面不显示知识点与层级信息');
    expect(prompt).toContain('情境化/探究式设问');
  });

  it('语义审查 prompt：exam 含正式考试专项维度（相似题/重复考查/大题结构/表达题/卷面标注）', () => {
    const prompt = AISemanticReviewer.buildReviewPrompt('<p>试卷内容</p>', { genType: 'exam', subject: '数学', stage: '小学', grade: '三年级' });
    expect(prompt).toContain('正式考试专项');
    expect(prompt).toContain('题材/情境/数据/设问角度相似');
    expect(prompt).toContain('真题卷结构蓝本');
    expect(prompt).toContain('相似题/重复考查/大题结构');
    expect(prompt).toContain('题型丰富度');
    expect(prompt).toContain('设问句式模板化');
    expect(prompt).toContain('真题每卷仅1道写作题');
    expect(prompt).toContain('知识点/层级等教学性标注');
    expect(prompt).toContain('素养立意');
  });

  it('语义审查 prompt：非 exam 含题目质量专项、不含试卷专属维度', () => {
    const prompt = AISemanticReviewer.buildReviewPrompt('<p>练习内容</p>', { genType: 'practice', subject: '数学', stage: '小学', grade: '三年级' });
    // 试卷专属：不含
    expect(prompt).not.toContain('正式考试专项');
    expect(prompt).not.toContain('真题卷结构蓝本');
    // 题目质量专项：含（练习类同样有相似题/干扰项/答案泄露风险）
    expect(prompt).toContain('题目质量专项');
    expect(prompt).toContain('题材/情境/数据/设问角度相似');
  });
});
