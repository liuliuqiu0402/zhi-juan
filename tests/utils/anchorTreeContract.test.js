// ✅ A1（2026-09-11）：锚树契约 —— 结构校验（不落库）/ 粒度判据（最小单位下沉第3层）/ 粒度诊断
// 背景：分析输出即"锚清单本体"（knowledgeHierarchy 第 2 层 = 锚），粒度不统一会让锚清单失真。
//       典型反例：语文低段把"人/口/手"单字提为第 2 层条目 → 短锚爆炸、下游取不到真考点。
import { describe, it, expect } from 'vitest';
import {
  SHORT_ANCHOR_MAX_LEN,
  isMinUnitName,
  validateAnchorTree,
  anchorGranularityReport,
  diagnoseAnchorTree,
  summarizeAnchorGranularity,
  buildAnchorListByChapter,
  formatAnchorListByChapter,
} from '../../src/utils/anchorTreeContract.js';

// 正确形态：最小单位在第 3 层
const goodTree = [
  {
    bigConcept: '识字与写字',
    coreKnowledge: [
      { name: '识字与书写', level: '识记', specificConcepts: ['人', '口', '手'], suggestedQuestionTypes: ['看拼音写词语'] },
      { name: '多音字辨析', level: '理解', specificConcepts: ['长(cháng)/长(zhǎng)'], suggestedQuestionTypes: ['选择正确读音'] },
      { name: '词语积累与运用', level: '应用', specificConcepts: ['成语接龙', '近义词辨析'], suggestedQuestionTypes: ['选词填空'] },
    ],
  },
];

// 违规形态：单字被提为第 2 层
const badTree = [
  {
    bigConcept: '识字与写字',
    coreKnowledge: [
      { name: '人', level: '识记', specificConcepts: [] },
      { name: '口', level: '识记', specificConcepts: [] },
      { name: '识字与书写', level: '识记', specificConcepts: ['手'] },
    ],
  },
];

describe('A1 粒度判据：isMinUnitName（确定性部分）', () => {
  it('单个汉字 / 单个字母 / 单个数字 / 单个符号 / 纯数值 → 最小单位（须下沉第3层）', () => {
    for (const n of ['人', '口', '手', 'A', 'a', '5', '。', '×', '0.5', '12']) {
      expect(isMinUnitName(n), n).toBe(true);
    }
  });
  it('可独立成题的考点名 → 非最小单位（不得误判）', () => {
    for (const n of ['识字与书写', '多音字辨析', 'ee', '分数', '小数乘整数', '光合作用']) {
      expect(isMinUnitName(n), n).toBe(false);
    }
  });
  it('空值安全返回 false', () => {
    expect(isMinUnitName('')).toBe(false);
    expect(isMinUnitName(null)).toBe(false);
    expect(isMinUnitName(undefined)).toBe(false);
    expect(isMinUnitName('   ')).toBe(false);
  });
});

describe('A1-2 锚树结构校验（只判结构、不改内容）', () => {
  it('正确形态（最小单位在第3层）→ ok，零违规', () => {
    const r = validateAnchorTree(goodTree);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('反例：第2层出现单字「人」「口」→ core-is-min-unit，且 ok=false（→ 不落库）', () => {
    const r = validateAnchorTree(badTree);
    expect(r.ok).toBe(false);
    const codes = r.violations.filter(v => v.code === 'core-is-min-unit').map(v => v.name);
    expect(codes).toEqual(['人', '口']);
    expect(r.violations[0].path).toContain('coreKnowledge[0]');
  });

  it('结构类违规：非数组 / 缺 bigConcept / coreKnowledge 非数组 / 缺考点名 / 字段类型错', () => {
    expect(validateAnchorTree(null).violations[0].code).toBe('not-array');
    expect(validateAnchorTree([]).violations[0].code).toBe('empty');
    expect(validateAnchorTree([{ coreKnowledge: [] }]).violations.map(v => v.code)).toContain('big-missing-name');
    expect(validateAnchorTree([{ bigConcept: 'A', coreKnowledge: null }]).violations.map(v => v.code)).toContain('core-not-array');
    expect(validateAnchorTree([{ bigConcept: 'A', coreKnowledge: [] }]).violations.map(v => v.code)).toContain('core-empty');
    expect(validateAnchorTree([{ bigConcept: 'A', coreKnowledge: [{ name: '' }] }]).violations.map(v => v.code)).toContain('core-missing-name');
    const typeErr = validateAnchorTree([{ bigConcept: 'A', coreKnowledge: [{ name: '考点', specificConcepts: '不是数组' }] }]);
    expect(typeErr.violations.map(v => v.code)).toContain('specific-not-array');
    const itemErr = validateAnchorTree([{ bigConcept: 'A', coreKnowledge: [{ name: '考点', specificConcepts: ['ok', 5] }] }]);
    expect(itemErr.violations.map(v => v.code)).toContain('specific-item-invalid');
  });

  it('🔒 只判结构、不改内容：校验前后输入对象深比较不变（防削足适履删条目）', () => {
    const input = JSON.parse(JSON.stringify(badTree));
    const snapshot = JSON.parse(JSON.stringify(badTree));
    validateAnchorTree(input);
    expect(input).toEqual(snapshot);
  });
});

describe('A1-3 锚粒度诊断（锚数 / 短锚占比 / specificConcepts 条数分布 / 绑定状态分布）', () => {
  it('正确形态：锚数=3、最小单位违例=0、specificConcepts 条数分布正确', () => {
    const rep = diagnoseAnchorTree(goodTree, { chapterTitle: '第1单元' });
    expect(rep.chapterTitle).toBe('第1单元');
    expect(rep.anchorCount).toBe(3);
    expect(rep.minUnitAnchorCount).toBe(0);
    expect(rep.specificConcepts).toEqual({ total: 6, min: 1, max: 3, median: 2, zeroCount: 0 });
  });

  it('短锚占比（名长 ≤ 3 字）：可观测，且不参与任何删除', () => {
    expect(SHORT_ANCHOR_MAX_LEN).toBe(3);
    const anchors = [
      { name: '识字与书写', specificConcepts: [] },  // 5 字 → 非短锚
      { name: '成语', specificConcepts: [] },        // 2 字 → 短锚（但不违例：语义型词条无法确定性判定）
      { name: '多音字辨析', specificConcepts: [] },  // 5 字
      { name: '人', specificConcepts: [] },          // 1 字 → 短锚 + 最小单位违例
    ];
    const rep = anchorGranularityReport(anchors, { chapterTitle: 'T' });
    expect(rep.anchorCount).toBe(4);
    expect(rep.shortAnchorCount).toBe(2);
    expect(rep.shortRatio).toBe(0.5);
    expect(rep.minUnitAnchorCount).toBe(1);
  });

  it('绑定状态分布：仅在有 bind 时统计（生成期锚）；分析期为空对象', () => {
    const bound = [
      { name: '考点A', specificConcepts: [], bind: { status: 'literal' } },
      { name: '考点B', specificConcepts: [], bind: { status: 'literal' } },
      { name: '考点C', specificConcepts: [], bind: { status: 'semantic' } },
      { name: '考点D', specificConcepts: [], bind: { status: 'missing' } },
    ];
    expect(anchorGranularityReport(bound).bindStatus).toEqual({ literal: 2, semantic: 1, missing: 1 });
    expect(anchorGranularityReport([{ name: '考点', specificConcepts: [] }]).bindStatus).toEqual({});
  });

  it('多章汇总：过细/过粗双向指标（锚数 + 短锚占比 + 平均锚数/章）', () => {
    const agg = summarizeAnchorGranularity([
      anchorGranularityReport([{ name: '完整考点名称甲', specificConcepts: ['a', 'b'] }, { name: '人', specificConcepts: [] }]),
      anchorGranularityReport([{ name: '完整考点名称乙', specificConcepts: ['c'] }]),
    ]);
    expect(agg.chapterCount).toBe(2);
    expect(agg.anchorCount).toBe(3);
    expect(agg.shortAnchorCount).toBe(1);   // 仅「人」≤ 3 字
    expect(agg.shortRatio).toBe(0.333);
    expect(agg.minUnitAnchorCount).toBe(1);
    expect(agg.specTotal).toBe(3);
    expect(agg.avgAnchorsPerChapter).toBe(1.5);
  });
});

describe('A1-4 锚点清单按章分组（章序与原文一致）', () => {
  const anchors = [
    { chapterTitle: '第1课 草原', name: '生字识记' },
    { chapterTitle: '第1课 草原', name: '景物描写手法' },
    { chapterTitle: '第2课 丁香结', name: '借物抒情' },
    { chapterTitle: '第1课 草原', name: '生字识记' },   // 同名锚 → 去重
    { chapterTitle: '', name: '未标注章考点' },
  ];

  it('按章分组：多条锚共用一个章标题是正常形态；章序 = 传入锚序（= 勾选章序 = 原文章序）', () => {
    const groups = buildAnchorListByChapter(anchors);
    expect(groups.map(g => g.chapterTitle)).toEqual(['第1课 草原', '第2课 丁香结', '未标注章节']);
    expect(groups[0].names).toEqual(['生字识记', '景物描写手法']);
    expect(groups[1].names).toEqual(['借物抒情']);
  });

  it('呈现形态：【章名】考点A、考点B…（一行一章）', () => {
    expect(formatAnchorListByChapter(anchors))
      .toBe('【第1课 草原】生字识记、景物描写手法\n【第2课 丁香结】借物抒情\n【未标注章节】未标注章考点');
  });

  it('空输入安全返回空', () => {
    expect(buildAnchorListByChapter([])).toEqual([]);
    expect(formatAnchorListByChapter(null)).toBe('');
  });
});
