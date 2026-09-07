// 双卡素材区单测（素材线 G7：依据卡覆盖保底 + 参考卡示范段预算化；废除旧检索式全文直灌）
import { describe, it, expect } from 'vitest';
import { buildMaterialPackage } from '../../src/utils/materialPackage.js';

const mkAnchor = (name, { status = 'literal', segs = [], extension = false, level = '理解', concepts = [] } = {}) => ({
  chapterTitle: '第1单元',
  name,
  level,
  specificConcepts: concepts,
  isExtension: extension,
  bind: { status, segments: segs },
});

describe('双卡素材区构建（素材线 G7）', () => {
  const exampleSeg = { text: '例：计算 3.2÷0.8 时，把被除数与除数的小数点同时向右移动一位，使除数变成整数再计算。', type: '例题' };
  const practiceSeg = { text: '练一练：4.6×2.8＝', type: '练习' };
  const ruleSeg = { text: '商不变规律：被除数和除数同时乘或除以相同的数（0除外），商不变。', type: '正文' };

  it('依据卡：覆盖锚行级紧凑档全量（名+层次+概念≤4），不含建议题型', () => {
    const anchors = [
      mkAnchor('小数除以小数', { segs: [exampleSeg], concepts: ['先化整再除', '商的小数点对齐'] }),
      mkAnchor('商不变规律', { segs: [ruleSeg], level: '理解' }),
    ];
    const { basis } = buildMaterialPackage({ anchors });
    expect(basis).toContain('【素材·依据】');
    expect(basis).toContain('· 小数除以小数（理解）｜先化整再除；商的小数点对齐');
    expect(basis).toContain('· 商不变规律（理解）');
    expect(basis).not.toContain('suggested'); // 字段级：建议题型字段不进素材区
  });

  it('拓展锚与缺料锚不进素材区（了解性/无源不当作命题覆盖点）', () => {
    const anchors = [
      mkAnchor('循环小数', { status: 'literal', segs: [{ text: '你知道吗：循环小数是…', type: '正文' }], extension: true }),
      mkAnchor('缺料考点', { status: 'missing', segs: [] }),
      mkAnchor('小数乘小数', { segs: [exampleSeg] }),
    ];
    const { basis, ref, boundCount } = buildMaterialPackage({ anchors });
    expect(boundCount).toBe(1);
    expect(basis).toContain('小数乘小数');
    expect(basis).not.toContain('循环小数');
    expect(ref).not.toContain('你知道吗');
  });

  it('参考卡：示范段整段（练习/作业成品不预取），每锚 ≤2 段', () => {
    const anchors = [
      mkAnchor('小数除以小数', { segs: [exampleSeg, practiceSeg, ruleSeg] }),
    ];
    const { ref } = buildMaterialPackage({ anchors });
    expect(ref).toContain('【素材·参考】');
    expect(ref).toContain(exampleSeg.text); // 示范段完整
    expect(ref).toContain(ruleSeg.text);     // 每锚至多 2 段：例题+正文
    expect(ref).not.toContain('练一练');     // 练习段不预取
    expect(ref).not.toContain(practiceSeg.text);
  });

  it('参考卡预算上限：宁缺段不切句（单段超预算 → 放弃该锚参考，依据卡仍在）', () => {
    const longSeg1 = { text: '甲'.repeat(3000), type: '正文' };
    const longSeg2 = { text: '乙'.repeat(3000), type: '正文' };
    const anchors = [
      mkAnchor('锚A', { segs: [longSeg1] }),
      mkAnchor('锚B', { segs: [longSeg2] }),
    ];
    const { basis, ref } = buildMaterialPackage({ anchors, maxChars: 1200 }); // 单段 3000 > 预算下限 1200
    // 不切句：绝不会出现半段文本
    expect(ref).not.toContain('甲'.repeat(1500));
    expect(ref).not.toContain('乙'.repeat(1500));
    // 宁缺该锚参考（依据卡仍在——覆盖保底不受预算影响）
    expect(basis).toContain('锚A');
    expect(basis).toContain('锚B');
  });

  it('空锚输入：双卡为空、boundCount=0，不抛错', () => {
    const { basis, ref, boundCount } = buildMaterialPackage({ anchors: [] });
    expect(basis).toBe('');
    expect(ref).toBe('');
    expect(boundCount).toBe(0);
  });
});
