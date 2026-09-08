/**
 * 复现收口专项：0.7×0.3＝(分数)×(分数)，表示求…是多少 —— 同句 横线/方框 混用 与 题头后池化空行
 * ============================================================
 * 根因（2026-09 复现）：
 *   A. "改写/含义"类"写算式答案"段，× 邻接空位被口算方框规则(uCellRe)回卷成 <span square-box>，
 *      与等号后结果位横线(u.blank)同句混用 → 需在 normalizeMathCircleBlanks 的改写段判定中保持书写横线；
 *   B. 同段书写空位形态统一(unifySameParagraphWriteBlanks)：同句 横线/方框/括号空 ≥2 种 → 按多数形态统一；
 *   C. answer-area-fix 审计后置补入的"题头后池化整行空白"，须在审计输出后二次剥离
 *      （stripRedundantInlineCarrierRows：下一非空兄弟已含行内作答载体 → 冗余）。
 */
import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers, normalizeMathCircleBlanks, stripRedundantInlineCarrierRows, unifySameParagraphWriteBlanks } from '../../src/utils/contentCleaner.js';

const fullNormalize = (html) => normalizeMathCircleBlanks(normalizeBlankMarkers(html));

describe('同句 横线/方框 混用根治（0.7×0.3＝＿×＿，表示求…是多少）', () => {
  it('改写/含义段：× 邻接空位不回卷成方框，全句统一为书写横线', () => {
    const html =
      '<p class="question">（2）0.7 × 0.3 ＝ <u class="blank-1">&emsp;</u> × <span class="square-box">&nbsp;</span>，表示求 0.7 的 <u class="blank-3">&emsp;</u> 是多少。</p>';
    const out = fullNormalize(html);
    expect(out).not.toContain('square-box');
    expect((out.match(/<u class="blank-\d+">&emsp;<\/u>/g) || []).length).toBe(3);
  });

  it('统一函数本身：混用段按多数形态归一（并列取 u 下划线）', () => {
    const html =
      '<p>＝ <u class="blank-1">&emsp;</u> × <span class="square-box">&nbsp;</span>，表示求 0.7 的 <u class="blank-3">&emsp;</u> 是多少。</p>';
    const out = unifySameParagraphWriteBlanks(html);
    expect(out).not.toContain('square-box');
    expect((out.match(/<u class="blank-\d+">&emsp;<\/u>/g) || []).length).toBe(3);
  });

  it('统一函数不跨段混并：两段各自单形态保持原样', () => {
    const html =
      '<p>甲 <u class="blank-2">&emsp;</u> 乙。</p><p>丙 <span class="square-box">&nbsp;</span> 丁。</p>';
    const out = unifySameParagraphWriteBlanks(html);
    expect(out).toContain('<u class="blank-2">&emsp;</u>');
    expect(out).toContain('<span class="square-box">&nbsp;</span>');
  });

  it('统一函数不碰 ○（math-circle-blank 语义不同）', () => {
    const html = '<p>3 <span class="math-circle-blank-18">&nbsp;</span> 8＝11 <u class="blank-2">&emsp;</u>。</p>';
    const out = unifySameParagraphWriteBlanks(html);
    expect(out).toContain('math-circle-blank-18');
    expect(out).toContain('blank-2');
  });

  it('口算/直接写得数段（无 改写/表示求 组织语）：方框单元 + 结果位留白 的角色区分不回退', () => {
    // 规范形态：模型/归一先输出全 u 书写位 → 中间运算符邻接单元回卷为口算方框(1 个)，首尾结果位保持留白横线(2 个)
    const html =
      '<p>0.6×0.3 ＝ <u class="blank-2">&emsp;</u> × <u class="blank-2">&emsp;</u> ＝ <u class="blank-4">&emsp;</u>。</p>';
    const out = fullNormalize(html);
    expect((out.match(/<span class="square-box">&nbsp;<\/span>/g) || []).length).toBe(1);
    expect((out.match(/<u class="blank-\d+">&emsp;<\/u>/g) || []).length).toBe(2);
  });

  it('结果位书写横线（＝后）不参与形态统一（防口算行被并成整行方框）', () => {
    const html =
      '<p>3.6×1.2 ＝ <u class="blank-4">&emsp;</u> × <span class="square-box">&nbsp;</span> ＝ <u class="blank-4">&emsp;</u>。</p>';
    const out = unifySameParagraphWriteBlanks(html);
    expect((out.match(/<span class="square-box">&nbsp;<\/span>/g) || []).length).toBe(1);
    expect((out.match(/<u class="blank-4">&emsp;<\/u>/g) || []).length).toBe(2);
  });
});

describe('题头后池化整行空白（审计后置补差）', () => {
  it('纯空白整行后随"已含行内作答载体"的小题行 → 冗余剥离', () => {
    const html =
      '<p class="question">3. 把下面的小数改写成分数，再写出乘法算式的含义。</p>' +
      '<p class="blank-area" style="height: 8mm;">&emsp;</p>' +
      '<p class="blank-area" style="height: 8mm;">&emsp;</p>' +
      '<p class="question">0.7 × 0.3 ＝ <u class="blank-1">&emsp;</u> × <span class="square-box">&nbsp;</span>，表示求 0.7 的 <u class="blank-3">&emsp;</u> 是多少。</p>';
    const out = stripRedundantInlineCarrierRows(html);
    expect((out.match(/<p class="blank-area"/g) || []).length).toBe(0);
    expect(out).toContain('把下面的小数改写成分数');
    expect(out).toContain('0.7 × 0.3');
  });

  it('确属长答书写空间（后随无行内载体的空作答段/无后续小题）→ 保全不误删', () => {
    const html =
      '<p class="question">5. 解方程：3x＋6＝15</p>' +
      '<p class="blank-area" style="height: 8mm;">&emsp;</p>' +
      '<p class="blank-area" style="height: 8mm;">&emsp;</p>';
    const out = stripRedundantInlineCarrierRows(html);
    expect((out.match(/<p class="blank-area"/g) || []).length).toBe(2);
  });
});
