// 覆盖对账器（Coverage Reconciler）单测：模式门控 + 缺漏判定 + 同名聚合 + 提示语
import { describe, it, expect } from 'vitest';
import { buildAnchors } from '../../src/utils/coverageAnchor.js';
import { reconcileCoverage, reconcileCoverageStats, coverageNoteOf, stripHtmlForRecon } from '../../src/utils/coverageReconciler.js';

const mkCard = (chapterTitle, names, segments) => ({
  chapterTitle,
  anchorTree: [{ bigConcept: '数与运算', coreKnowledge: names.map((name) => ({ name, level: '理解', specificConcepts: [], suggestedQuestionTypes: [] })) }],
  segments,
});

const segs = [
  { text: '1. 小数乘整数的算理：0.3×3=0.9，先按整数乘法计算再点小数点。', type: '例题', isKeyConcept: true },
  { text: '积的近似数：先精确计算，再按四舍五入法保留需要的位数。', type: '正文', isKeyConcept: true },
  { text: '练习：先估算，再计算下列各题。', type: '练习' },
];
const anchors = buildAnchors([mkCard('第1单元 小数乘法', ['小数乘整数', '积的近似数', '小数乘小数'], segs)], {}).anchors;
const html = `<h1>课时练</h1><h2>小数乘整数</h2><p>把0.3×3看成3×3再点小数点。</p><h2>积的近似数</h2><p>四舍五入法保留位数。</p>`;

describe('coverageReconciler 对账器', () => {
  it('stripHtmlForRecon 去标签单行化（对账只看是否出现）', () => {
    expect(stripHtmlForRecon('<h2>小数乘整数</h2><p>算理：0.3×3&nbsp;＝&nbsp;0.9</p>')).toContain('小数乘整数');
    expect(stripHtmlForRecon('<h2>小数乘整数</h2><p>算理</p>')).not.toContain('<');
  });

  it('per-lesson-full（课时练）：缺漏考点进 missing，同名跨章不误报', () => {
    const rep = reconcileCoverage({ genType: 'practice', content: html, anchors });
    expect(rep.required).toBe(true);
    expect(rep.total).toBe(3);
    expect(rep.coveredCount).toBe(2); // 小数乘整数/积的近似数 已出现
    expect(rep.missing.map((m) => m.name)).toEqual(['小数乘小数']);
    expect(rep.missing[0].probeable).toBe(true); // 概念考点可指名补漏
    expect(rep.coverage).toBe(0.67); // reconcile 内已四舍五入到两位
  });

  it('full（知识总结）：与 per-lesson-full 同样判缺', () => {
    const rep = reconcileCoverage({ genType: 'summary', content: html, anchors });
    expect(rep.missing.map((m) => m.name)).toEqual(['小数乘小数']);
  });

  it('focus/none（专项/阅读/错题本）：不判缺，missing 恒空', () => {
    for (const g of ['special', 'reading', 'errorbook']) {
      const rep = reconcileCoverage({ genType: g, content: html, anchors });
      expect(rep.required).toBe(false);
      expect(rep.missing).toEqual([]);
    }
  });

  it('sampled（正式考卷）：仅信息性统计，不判缺不补漏', () => {
    const st = reconcileCoverageStats({ genType: 'exam', content: html, anchors });
    expect(st).not.toBeNull();
    expect(st.total).toBe(3);
    expect(st.coveredCount).toBe(2);
    expect(st.missing).toEqual([]);
    // 常规 reconcile 对 sampled 不判缺
    expect(reconcileCoverage({ genType: 'exam', content: html, anchors }).missing).toEqual([]);
  });

  it('coverageNoteOf：仅 required 且有缺漏时出提示语，含章节归属', () => {
    const rep = reconcileCoverage({ genType: 'practice', content: html, anchors });
    const note = coverageNoteOf(rep);
    expect(note).toContain('覆盖对账');
    expect(note).toContain('第1单元 小数乘法');
    expect(note).toContain('小数乘小数');
    expect(coverageNoteOf(reconcileCoverage({ genType: 'focus', content: html, anchors }))).toBe('');
  });

  it('正文完全包含考点 → 无缺漏，不产生提示', () => {
    const fullHtml = html + '<h2>小数乘小数</h2><p>积的小数位数等于两个因数小数位数之和。</p>';
    const rep = reconcileCoverage({ genType: 'practice', content: fullHtml, anchors });
    expect(rep.missing).toEqual([]);
    expect(coverageNoteOf(rep)).toBe('');
  });

  // 🔴 复位 S4.1：拓展锚（仅绑定"你知道吗"科普框的考点，如循环小数族）不进必覆盖对账——
  //    它是了解性素材不是命题必覆盖点；正文未呈现时不报缺漏（A-101 循环小数族类锚回归）
  it('拓展锚排除：正文未呈现"循环小数"不报缺漏（仅绑定科普框 → isExtension）', () => {
    const extSeg = { text: '你知道吗：循环小数是从小数部分某一位起，一个数字或几个数字依次不断重复出现的小数。', type: '正文' };
    const extCard = {
      chapterTitle: '一 小数乘法（二）',
      anchorTree: [{ bigConcept: '数与运算', coreKnowledge: [{ name: '循环小数', level: '了解', specificConcepts: [], suggestedQuestionTypes: [] }] }],
      segments: [extSeg],
    };
    const { anchors: withExt } = buildAnchors([extCard], {});
    expect(withExt[0].isExtension).toBe(true);
    const rep = reconcileCoverage({ genType: 'practice', content: '<h1>随堂巩固</h1><p>只考了小数乘法计算。</p>', anchors: withExt });
    expect(rep.total).toBe(0); // 拓展锚不进入对账点名（分母也不含）
    expect(rep.missing).toEqual([]);
    // sampled 统计口径一致：拓展锚不进统计分母
    const st = reconcileCoverageStats({ genType: 'exam', content: '<p>任意正文。</p>', anchors: withExt });
    expect(st.total).toBe(0);
  });

  // 🔴 根治回归：行为/语义考点（"方法/意义/规律/应用"）正文以情境题目体现、不会逐字出现，
  //    此前逐考点词面判定导致 18/18 全误报。现行为考点 → 章级聚合：章内任一考点命中即视为该章行为族已覆盖。
  //    🔧 2026-09 校准：正文"保留两位小数"命中近似值等价长锚（保留两位）→ 近似值族已呈现，
  //      章非零命中（不再整章零命中双报）；概念考点"循环小数"未现 → 真缺照报。
  it('行为语义考点（计算方法/规律/应用）→ 章级聚合，不逐词误报缺漏', () => {
    const behAnchors = buildAnchors([mkCard('一 小数乘法（二）', [
      '小数乘法的计算方法',           // 行为 → 章级
      '一个数乘大于1或小于1的数的规律', // 行为 → 章级
      '估算与近似值在实际中的应用',     // 行为 → 章级
      '循环小数',                     // 概念 → 精确
    ], segs)], {}).anchors;
    // 正文只"字面"出现 循环小数 之外的概念行为（情境化题目，无上述行为考点原文词）
    const behHtml = '<h2>小数乘法</h2><p>在情境中完成小数乘法计算并验证积的大小。</p><p>练习：保留两位小数。</p>';
    const rep = reconcileCoverage({ genType: 'practice', content: behHtml, anchors: behAnchors });
    // 行为考点均落地章级 → 不逐词误报；唯一精确概念"循环小数"未出现 → 准确实报
    expect(rep.missing.map((m) => m.name)).toEqual(['循环小数']);
    expect(rep.missing[0].probeable).toBe(true);
    // 近似值族已由"保留两位小数"呈现 → 章非零命中，不再整章双报
    expect(rep.missingChapters).toEqual([]);
  });

  it('整章零命中 → 进入 missingChapters（章级提示），行为考点不逐条报', () => {
    const behAnchors = buildAnchors([mkCard('二 未知单元', ['某概念', '计算的方法', '应用规律'], segs)], {}).anchors;
    const rep = reconcileCoverage({ genType: 'practice', content: '<p>与本单元考点无关的一页。</p>', anchors: behAnchors });
    expect(rep.missingChapters.map((c) => c.chapter)).toEqual(['二 未知单元']);
    // 该章概念考点也进 missing（可指名补漏）；行为考点不逐条进 missing（防诱导）
    expect(rep.missing.map((m) => m.name)).toEqual(['某概念']);
  });

  // 🔴 2026-09 实证校准（课时练"小数乘法与除法（二）"判缺审计）：
  //    · 技能考点（竖式计算）与近似值考点（积/商的近似值）正文以行为/情境考查（"用竖式计算""保留两位小数"），
  //      考点名整串不出现 ≠ 缺漏——技能词入章级、近似值等价词用长锚直接命中，消除 3/6 误报；
  //    · 概念考点（循环小数/有限无限小数分类）正文确未呈现 → 真缺照报（只报真缺，宁少勿滥）。
  it('技能考点（竖式计算）章级放行：正文"用竖式计算"即覆盖，不再误报缺漏', () => {
    const anchors = buildAnchors([mkCard('一 小数乘法和除法（二）', [
      '小数乘小数的竖式计算',   // 技能（含"竖式/计算"）→ 章级：正文"用竖式计算"已考查
      '循环小数',               // 概念 → 精确：正文未呈现 → 真缺
    ], segs)], {}).anchors;
    const html = '<h2>竖式计算</h2><p>用竖式计算下面各题，并把得数按要求保留：6.25×1.5；1.2÷0.24。</p>';
    const rep = reconcileCoverage({ genType: 'practice', content: html, anchors });
    expect(rep.missing.map((m) => m.name)).toEqual(['循环小数']); // 技能考点不误报
  });

  it('近似值考点等价词长锚命中："得数保留两位小数/保留整数"即覆盖积/商的近似值', () => {
    const anchors = buildAnchors([mkCard('一 小数乘法和除法（二）', [
      '积的近似值',             // literal + 近似族等价词（保留两位…）
      '商的近似值',
      '循环小数',               // 真缺对照
    ], segs)], {}).anchors;
    const html = '<p>1. 6.25×1.5（得数保留两位小数）。</p><p>2. 1.2÷0.24（得数保留整数）。</p>';
    const rep = reconcileCoverage({ genType: 'practice', content: html, anchors });
    // 积/商的近似值已由"保留两位/保留整数"等价呈现覆盖；仅循环小数真缺
    expect(rep.missing.map((m) => m.name)).toEqual(['循环小数']);
  });

  it('同族放宽（用户定 B）：章内"循环小数"已呈现 → 同章并列概念"有限/无限小数、无限不循环小数"不再逐条报缺', () => {
    const anchors = buildAnchors([mkCard('一 小数乘法和除法（二）', [
      '循环小数',               // 概念 → 精确；本用例中已字面呈现
      '有限小数与无限小数',     // 同族并列概念
      '无限不循环小数',
    ], segs)], {}).anchors;
    const html = '<p>1. 1÷3＝0.333…，小数部分数字不断重复出现，像这样的小数叫作（循环小数）。请再举一个循环小数的例子。</p>';
    const rep = reconcileCoverage({ genType: 'practice', content: html, anchors });
    // 章内已有概念类命中（循环小数）→ 同族其余概念不逐条报（部分呈现即提示到族，防打扰）
    expect(rep.missing).toEqual([]);
    expect(rep.missingChapters).toEqual([]);
  });

  it('整章零命中（无任何概念呈现）→ 同族放宽不生效，概念仍逐条报缺', () => {
    const anchors = buildAnchors([mkCard('一 未知单元', ['循环小数', '有限小数与无限小数'], segs)], {}).anchors;
    const rep = reconcileCoverage({ genType: 'practice', content: '<p>与本单元考点无关的内容。</p>', anchors });
    expect(rep.missing.map((m) => m.name).sort()).toEqual(['循环小数', '有限小数与无限小数']);
  });
});

// 🔴 2026-09 对账口径合一·源头：对账范围 = 研读已消化锚（digestedNames 交集）——
//    研读 digestPairs 点名行是模型实际被要求消化理解的覆盖点；对账只核这些点是否在正文呈现。
//    未消化/缺料锚不在研读批内 → 不计缺（防"模型没读过却报缺"误报）。
describe('coverageReconciler 对账范围收窄（digestedNames=研读已消化锚）', () => {
  // 手工构造锚：name=中文教学标签（展示层）、specificConcepts=教材原文词（判定层，2026-09 语言口径）
  const mkAnchor = (name, sc = []) => ({
    chapterTitle: 'Unit 1 Try your best', bigConcept: '语篇', name, level: '理解',
    specificConcepts: sc, bind: { status: 'literal' }, isExtension: false,
  });
  const anchorsAll = [
    mkAnchor('不规则动词的过去式', ['am→was', 'are→were', 'begin→began']),
    mkAnchor('鼓励他人的表达', ['You can do it!', 'Keep trying!']),
    mkAnchor('花木兰文化知识', ['Mulan']),
    mkAnchor('字母组合ee的发音', ['ee', '/iː/']),
  ];

  it('传 digestedNames=研读已消化锚 → 只对交集判缺，未消化锚不计缺', () => {
    // 研读批只消化了 2 个点（不规则动词过去式/ee发音）——对账范围收窄到这 2 个
    const digested = ['不规则动词的过去式', '字母组合ee的发音'];
    // 正文只呈现了"不规则动词过去式"（was/were/begin），未呈现 ee 发音考点
    const html = '<h1>课时练</h1><h2>动词过去式</h2><p>am→was，are→were，begin→began。</p>';
    const rep = reconcileCoverage({ genType: 'practice', content: html, anchors: anchorsAll, digestedNames: digested });
    // 鼓励表达/花木兰未在研读消化范围（缺料或未选）→ 不参与对账，不计缺
    expect(rep.total).toBe(2);
    expect(rep.missing.map((m) => m.name)).toEqual(['字母组合ee的发音']);
  });

  it('digestedNames 未提供/空数组 → 维持旧行为（全部锚判缺，兼容旧调用）', () => {
    const html = '<h1>课时练</h1><p>am→was，are→were，begin→began。</p>';
    const rep1 = reconcileCoverage({ genType: 'practice', content: html, anchors: anchorsAll });
    expect(rep1.total).toBe(4);
    const rep2 = reconcileCoverage({ genType: 'practice', content: html, anchors: anchorsAll, digestedNames: [] });
    expect(rep2.total).toBe(4);
  });

  it('正文完整呈现研读消化点 → 无缺漏（与研读口径同源后对账干净）', () => {
    const digested = ['不规则动词的过去式', '鼓励他人的表达', '花木兰文化知识'];
    const html = '<h1>课时练</h1><h2>过去式</h2><p>am→was，begin→began。</p><h2>鼓励</h2><p>You can do it! Keep trying!</p><h2>故事</h2><p>Mulan 替父从军。</p>';
    const rep = reconcileCoverage({ genType: 'practice', content: html, anchors: anchorsAll, digestedNames: digested });
    expect(rep.missing).toEqual([]);
  });
});
