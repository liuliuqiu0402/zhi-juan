// 标准题型骨架 + 命题素材提取（从源头达标的生成范式）
import { describe, it, expect } from 'vitest';
import { getStandardQuestion, buildStandardQuestionText } from '@/config/standardQuestionBank';
import { extractPropositionMaterial, buildPropositionMaterialText } from '@/config/propositionMaterial';
import { buildSectionInstruction } from '@/config/examPipeline';
import { getExamBlueprint } from '@/config/examPaperBlueprints';

// 模拟教材分段（含原文与知识点标注）
const FAKE_CARDS = [
  {
    chapterTitle: '第一单元',
    segments: [
      { text: '《望岳》岱宗夫如何？齐鲁青未了。造化钟神秀，阴阳割昏晓。', knowledgePoints: ['古诗文', '杜甫', '《望岳》'], type: '正文' },
      { text: '春天来了，校园里的花开了，同学们在操场上做游戏。', knowledgePoints: ['描写', '校园生活'], type: '正文' },
      { text: '小明去超市买了3千克苹果，每千克5元，付给售货员20元。', knowledgePoints: ['应用题', '购物', '计算'], type: '例题' },
    ],
  },
];

describe('标准题型骨架库（生成端从源头达标）', () => {
  it('语文初中现代文阅读：命中标准骨架，含设问梯度占位与命题铁律', () => {
    const q = getStandardQuestion('语文', 'middle', '现代文阅读');
    expect(q).toBeTruthy();
    expect(q.question).toContain('{why_question}'); // 深度设问占位（由素材填充）
    expect(q.question).toContain('{infer_question}');
    expect(q.rule).toContain('禁止照搬课文原文');
    expect(q.answer).toContain('按要点给分');
  });

  it('英语中学段书面表达：命中标准骨架，含李华情境与要点提示', () => {
    const q = getStandardQuestion('英语', 'middle', '书面表达');
    expect(q).toBeTruthy();
    expect(q.question).toContain('假定你是李华');
    expect(q.question).toContain('词数100左右');
  });

  it('数学初中应用题：命中标准骨架，含分步设问与情境规则', () => {
    const q = getStandardQuestion('数学', 'middle', '应用题');
    expect(q).toBeTruthy();
    expect(q.question).toContain('求');
    expect(q.rule).toContain('情境真实');
  });

  it('未命中题型返回 null（不注入误导）', () => {
    expect(getStandardQuestion('语文', 'middle', '不存在的题型')).toBeNull();
    expect(getStandardQuestion('不存在的学科', 'middle', '阅读')).toBeNull();
  });

  it('buildStandardQuestionText 输出含骨架、答案模式、评分标准', () => {
    const t = buildStandardQuestionText('语文', 'middle', '写作');
    expect(t).toContain('标准题型骨架');
    expect(t).toContain('题干框架');
    expect(t).toContain('答案模式');
    expect(t).toContain('评分标准');
    expect(t).toContain('命题铁律');
  });
});

describe('命题素材提取器（教材→可加工要素，非原文）', () => {
  it('提取考点词、情境元素、数据（非原文段落）', () => {
    const m = extractPropositionMaterial(FAKE_CARDS, ['古诗文', '应用题']);
    expect(m.concepts).toContain('古诗文');
    expect(m.scenarios.length).toBeGreaterThan(0); // 《望岳》书名号情境
    expect(m.numbers.some(n => n.includes('3千克') || n.includes('5元'))).toBe(true); // 应用题数据
    expect(m.vocab.length).toBeGreaterThan(0); // 语料词
    expect(m.forbidden).toContain('禁止照抄教材原文');
  });

  it('素材文本不包含整段原文（只含要素），明确加工规则', () => {
    const t = buildPropositionMaterialText(FAKE_CARDS, ['古诗文'], '语文');
    expect(t).toContain('命题素材');
    expect(t).toContain('禁止照抄教材原文');
    // 不直接注入整段课文原文
    expect(t).not.toContain('造化钟神秀');
    expect(t).not.toContain('同学们在操场上做游戏');
  });

  it('板块指令注入标准骨架与命题素材，未注入原文段落', () => {
    const bp = getExamBlueprint('语文', 'middle');
    const plan = { index: 0, name: '现代文阅读', score: 30, questionCount: 4, kps: ['现代文阅读'], note: '课外选文' };
    const sec = buildSectionInstruction(plan, {
      subject: '语文', stage: 'middle', stageLabel: '初中', examBlueprint: bp,
      propositionMaterial: buildPropositionMaterialText(FAKE_CARDS, ['现代文阅读'], '语文'),
      materialText: '', region: '', sectionNo: 1, totalScore: 120, isExamPlan: true,
    });
    expect(sec).toContain('标准题型骨架');
    expect(sec).toContain('命题素材');
    expect(sec).toContain('禁止照抄教材原文');
    // 未注入原文段落
    expect(sec).not.toContain('造化钟神秀');
  });

  it('无素材时回退原文依据并标注禁照抄', () => {
    const bp = getExamBlueprint('语文', 'middle');
    const plan = { index: 0, name: '现代文阅读', score: 30, questionCount: 4, kps: [], note: '' };
    const sec = buildSectionInstruction(plan, {
      subject: '语文', stage: 'middle', stageLabel: '初中', examBlueprint: bp,
      propositionMaterial: '', materialText: '【原文】原文片段内容', region: '', sectionNo: 1, totalScore: 120, isExamPlan: true,
    });
    expect(sec).toContain('教材原文依据');
    expect(sec).toContain('禁止照搬原文段落');
  });
});
