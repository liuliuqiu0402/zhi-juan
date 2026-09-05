// 覆盖锚（Coverage Anchor）单测：四级绑定（literal/semantic/chapter/missing）+ 报告 + 红线过滤
// P0 契约：可命题考点只含已绑定锚；missing（缺料）只进缺料诊断；图谱 relatedChapters 不参与锚定位。
import { describe, it, expect } from 'vitest';
import { wordMatch, flattenAnchorTree, buildAnchors, boundAnchorNames } from '../../src/utils/coverageAnchor.js';

// 合成卡片：模拟 extractContentCards 捷径分支产物（anchorTree 归一树 + segments）
const mkCard = (chapterTitle, anchorTree, segments) => ({ chapterTitle, anchorTree, segments });

describe('coverageAnchor 绑定四级与红线', () => {
  const segs = [
    { text: '1. 小数乘整数的算理：0.3×3=0.9，把小数乘整数转化为整数乘法再点小数点。', type: '例题', isKeyConcept: true },
    { text: '你知道吗：小数乘小数的积的小数位数等于两个因数小数位数之和。', type: '正文', isKeyConcept: false },
    { text: '练习：先估算，再计算下列各题。', type: '练习', isExercise: true },
  ];
  const cardA = mkCard('第1单元 小数乘法', [
    {
      bigConcept: '数与运算',
      coreKnowledge: [
        { name: '小数乘整数', level: '理解', specificConcepts: ['乘数大于1的规律'], suggestedQuestionTypes: ['计算题'] },
        { name: '小数乘小数', level: '理解', specificConcepts: [], suggestedQuestionTypes: ['计算题'] },
        // 章内无字面命中、无语义检索 → 章级兜底
        { name: '积的近似数', level: '应用', specificConcepts: [], suggestedQuestionTypes: ['解决问题'] },
      ],
    },
  ], segs);

  it('wordMatch 词边界口径（与 extractContentCards 一致：长词含命中，短词须边界）', () => {
    expect(wordMatch('小数乘整数的算理', '小数乘整数')).toBe(true); // ≥4 字：直接包含
    expect(wordMatch('分数与小数互化', '小数与分数')).toBe(false); // 4 字词不存在
    expect(wordMatch('先估算再计算', '估算')).toBe(false); // 短词(2字)嵌中文无边界 → 不命中
    expect(wordMatch('估算 结果', '估算')).toBe(true); // 空格边界
    expect(wordMatch('（小数）比较大小', '小数')).toBe(true); // 括号边界
    expect(wordMatch('甲数是乙数的2倍', '是')).toBe(false); // 短词嵌中文不命中
  });

  it('flattenAnchorTree 归一：章级锚树 → 扁平 coreKnowledge（含具体概念/题型/层级）', () => {
    const flat = flattenAnchorTree(cardA.anchorTree);
    expect(flat).toHaveLength(3);
    expect(flat[0]).toMatchObject({
      bigConcept: '数与运算', name: '小数乘整数', level: '理解',
      specificConcepts: ['乘数大于1的规律'], suggestedQuestionTypes: ['计算题'],
    });
  });

  it('四级绑定：literal 命中片段、chapter 兜底有片段、missing 无片段', () => {
    // 无 retriever：semantic 级跳过 → 字面未中的考点落 chapter 兜底
    const { anchors, report } = buildAnchors([cardA], {});
    const byName = Object.fromEntries(anchors.map((a) => [a.name, a]));
    expect(report.total).toBe(3);
    expect(byName['小数乘整数'].bind.status).toBe('literal');
    expect(byName['小数乘整数'].bind.segments.length).toBeGreaterThan(0);
    expect(byName['小数乘整数'].bind.segments[0].chapterTitle).toBe('第1单元 小数乘法'); // 出处锚点保留
    expect(byName['小数乘小数'].bind.status).toBe('literal'); // "你知道吗"科普框形态命中
    expect(byName['积的近似数'].bind.status).toBe('chapter');
    expect(report.byStatus).toMatchObject({ literal: 2, semantic: 0, chapter: 1, missing: 0 });
    expect(report.bound).toBe(3);
    expect(report.missingList).toEqual([]);
  });

  it('semantic 级：提供 retriever 且命中同章段 → semantic，不再落 chapter 兜底', () => {
    const retriever = {
      findRelevant: (q) => {
        if (String(q).includes('积的近似数')) {
          return [{ chapterTitle: '第1单元 小数乘法', text: '取积的近似数时，先计算再按四舍五入法保留位数。', type: '正文', relevance: 'high' }];
        }
        return [];
      },
    };
    const { anchors, report } = buildAnchors([cardA], { retriever });
    const approx = anchors.find((a) => a.name === '积的近似数');
    expect(approx.bind.status).toBe('semantic');
    expect(approx.bind.segments[0].text).toContain('四舍五入');
    expect(report.byStatus).toMatchObject({ literal: 2, semantic: 1, chapter: 0, missing: 0 });
  });

  it('missing（缺料）：章无片段 → 不进可命题清单，进缺料诊断；boundAnchorNames 已过滤', () => {
    const cardEmpty = mkCard('第5单元 循环小数', [
      { bigConcept: '数与运算', coreKnowledge: [{ name: '循环小数的意义', level: '理解', specificConcepts: [], suggestedQuestionTypes: ['选择题'] }] },
    ], []); // 无原文片段 → 缺料信号
    const { anchors, report } = buildAnchors([cardA, cardEmpty], {});
    expect(report.total).toBe(4);
    expect(report.byStatus.missing).toBe(1);
    expect(report.missingList).toEqual([{ chapter: '第5单元 循环小数', name: '循环小数的意义' }]);
    const names = boundAnchorNames(anchors);
    expect(names).toHaveLength(3);
    expect(names.some((n) => n.name === '循环小数的意义')).toBe(false); // 红线：missing 不进可命题清单
    expect(names[0]).toMatchObject({ chapter: '第1单元 小数乘法', bigConcept: '数与运算', level: '理解' });
  });

  it('目录卡/未分析卡（无 anchorTree）不产出锚，报告 total=0', () => {
    const tocCard = mkCard('第1单元 小数乘法', null, []); // 仅目录
    const { anchors, report } = buildAnchors([tocCard], {});
    expect(anchors).toHaveLength(0);
    expect(report.total).toBe(0);
    expect(report.missingList).toEqual([]);
    expect(boundAnchorNames(anchors)).toHaveLength(0);
  });
});
