import { describe, it, expect } from 'vitest';
import { stripRedundantInlineCarrierRows } from '../../src/utils/contentCleaner.js';

const BA = '<p class="blank-area" style="height: 8mm;">　</p>';

describe('剥离空位内嵌题后冗余整行空白（2026-09 空行泛滥根治）', () => {
  it('直接写出得数：题后 4 个纯空 blank-area 全剥离（后随 square-box 行内载体）', () => {
    const html = [
      '<p class="question">4. 直接写出得数。</p>',
      BA, BA, BA, BA,
      '<p>0.4×3＝<span class="square-box">　</span>0.6×0.5＝<span class="square-box">　</span>1.2×4＝<span class="square-box">　</span>0.25×8＝</p>',
      '<p>2.5×0.4＝<span class="square-box">　</span>0.9×0.7＝<span class="square-box">　</span>3.6×0.5＝<span class="square-box">　</span>0.15×6＝</p>',
    ].join('\n');
    const out = stripRedundantInlineCarrierRows(html);
    expect(out).not.toContain('blank-area');
    expect(out).toContain('0.4×3＝');
  });

  it('比较大小（在○里填）：题后 4 个纯空 blank-area 全剥离（后随 math-circle-blank）', () => {
    const html = [
      '<p class="question">9. 不计算，在○里填上"＞""＜"或"＝"。</p>',
      BA, BA, BA, BA,
      '<p>3.6×0.8<span class="math-circle-blank-18">　</span>3.6　　　2.4×1.5<span class="math-circle-blank-18">　</span>2.4　　　0.9×0.9<span class="math-circle-blank-18">　</span>0.9</p>',
      '<p>5.2×1<span class="math-circle-blank-18">　</span>5.2　　　7.5×0.6<span class="math-circle-blank-18">　</span>7.5　　　1.8×2.3<span class="math-circle-blank-18">　</span>1.8</p>',
    ].join('\n');
    const out = stripRedundantInlineCarrierRows(html);
    expect(out).not.toContain('blank-area');
  });

  it('转化整数除法再计算：各子题行后的空行剥离（后随 next square-box 子题行）', () => {
    const html = [
      '<p class="question">12. 把下面的算式转化成整数除法，再计算。</p>',
      '<p>（1）4.8÷0.6＝<span class="square-box">　</span>÷<span class="square-box">　</span>＝<span class="square-box">　</span></p>',
      BA, BA,
      '<p>（2）0.72÷0.08＝<span class="square-box">　</span>÷<span class="square-box">　</span>＝<span class="square-box">　</span></p>',
      BA, BA,
      '<p>（3）3.6÷0.12＝<span class="square-box">　</span>÷<span class="square-box">　</span>＝<span class="square-box">　</span></p>',
    ].join('\n');
    const out = stripRedundantInlineCarrierRows(html);
    expect(out).not.toContain('blank-area');
    expect((out.match(/（2）/g) || []).length).toBe(1); // 子题行保留，仅删空行
    expect((out.match(/（1）/g) || []).length).toBe(1);
    expect((out.match(/（3）/g) || []).length).toBe(1);
  });

  it('保全：解决问题/竖式整行撰写型长答后的空白作答区不剥离', () => {
    const html = [
      '<p class="question">5. 列竖式计算下面各题。</p>',
      '<p>（1）3.25×2.8＝</p>',
      BA, BA, BA,
    ].join('\n');
    const out = stripRedundantInlineCarrierRows(html);
    expect((out.match(/<p class="blank-area"/g) || []).length).toBe(3); // 竖式长答后空白须保留
  });

  it('保全：解决问题（无行内载体）后的整行空白保留', () => {
    const html = [
      '<p class="question">7. 图书角有 54 本书，平均分给 6 个班，每班分到几本？</p>',
      BA, BA,
    ].join('\n');
    const out = stripRedundantInlineCarrierRows(html);
    expect((out.match(/<p class="blank-area"/g) || []).length).toBe(2);
  });

  it('幂等：剥离后再剥离不改变结果', () => {
    const html = [
      '<p class="question">4. 直接写出得数。</p>',
      BA, BA,
      '<p>0.4×3＝<span class="square-box">　</span>0.6×0.5＝<span class="square-box">　</span></p>',
    ].join('\n');
    const once = stripRedundantInlineCarrierRows(html);
    expect(stripRedundantInlineCarrierRows(once)).toBe(once);
  });
});