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
    expect(rep.missing).toEqual([{ chapter: '第1单元 小数乘法', name: '小数乘小数' }]);
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
    expect(note).toContain('第1单元 小数乘法：小数乘小数');
    expect(coverageNoteOf(reconcileCoverage({ genType: 'focus', content: html, anchors }))).toBe('');
  });

  it('正文完全包含考点 → 无缺漏，不产生提示', () => {
    const fullHtml = html + '<h2>小数乘小数</h2><p>积的小数位数等于两个因数小数位数之和。</p>';
    const rep = reconcileCoverage({ genType: 'practice', content: fullHtml, anchors });
    expect(rep.missing).toEqual([]);
    expect(coverageNoteOf(rep)).toBe('');
  });
});
