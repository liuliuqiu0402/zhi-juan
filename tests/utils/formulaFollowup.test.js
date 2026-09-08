/**
 * 卷内算式重复 · 承上说理豁免（2026-09）
 * 教学编排：同一算式先竖式算过、紧邻下一题"说一说"解说该式（先算后说理）→ 不算卷内重复；
 * 远距复用 / 并列新题（非紧邻承上）→ 仍报。
 */
import { describe, it, expect } from 'vitest';
import { detectFormulaDuplicates } from '../../src/utils/paperGuardEngine.js';

const paperOf = (lines) => lines.map((t, i) => `<p>${i + 1}. ${t}</p>`).join('');

describe('detectFormulaDuplicates（承上说理豁免）', () => {
  it('竖式题紧邻"说一说"承上解说同一算式 → 不报重复', () => {
    const html = paperOf([
      '口算：0.5×6＝3',
      '计算：2.4×1.6',
      '一个数乘小数的规律：3.6×1.2（ ）3.6',
      '用竖式计算：7.2÷0.6',
      '比较大小：5.4÷0.9（ ）5.4',
      '用竖式计算：0.45×1.6',
      '用竖式计算：5.6÷0.16',
      '用竖式计算：0.84÷0.28',
      '说一说：计算0.84÷0.28时，要把除数0.28转化成整数再计算。',
    ]);
    const hits = detectFormulaDuplicates(html);
    expect(hits.filter((h) => h.includes('0.84÷0.28'))).toEqual([]);
  });

  it('同一算式远距出现在两条独立新题 → 仍报重复', () => {
    const html = paperOf([
      '用竖式计算：0.84÷0.28',
      '算一算：3.6×2.8',
      '用竖式计算：1.25×0.48',
      '解决问题：0.84÷0.28＝3，每个小组分到 3 个本子。',
    ]);
    const hits = detectFormulaDuplicates(html);
    expect(hits.some((h) => h.includes('0.84÷0.28'))).toBe(true);
  });
});
