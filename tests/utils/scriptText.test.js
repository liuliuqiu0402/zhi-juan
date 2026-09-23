/**
 * 上下标 → 文本回归锁（P3）
 * ============================================================
 * 🔴 本轮修的缺陷（2026-09）：把 HTML 转纯文本喂 AI 时，`x<sup>2</sup>` 被"清标签"通道
 *    拍平成 `x2`、`H<sub>2</sub>O` 拍平成 `H2O` —— AI 读到的公式有歧义（x2 是 x·2 还是 x²？）。
 *    上下标承载语义（幂次/原子数/离子电荷），静默拍平是不可逆的信息丢失。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { scriptsToText, scriptToText, SUP_UNICODE, SUB_UNICODE } from '@/utils/scriptText.js';

describe('scriptsToText：上下标转文本（Unicode 优先）', () => {
  it('数学幂次：x<sup>2</sup> → x²（不再是 x2）', () => {
    expect(scriptsToText('x<sup>2</sup>')).toBe('x²');
    expect(scriptsToText('2<sup>3</sup>+a<sup>n</sup>')).toBe('2³+aⁿ');
  });

  it('化学式与离子：下标、上下标并排', () => {
    expect(scriptsToText('H<sub>2</sub>O')).toBe('H₂O');
    expect(scriptsToText('CO<sub>2</sub>')).toBe('CO₂');
    expect(scriptsToText('SO<sub>4</sub><sup>2-</sup>')).toBe('SO₄²⁻');
    expect(scriptsToText('Na<sup>+</sup>')).toBe('Na⁺');
  });

  it('带标签的上标（span.superscript / span.subscript 语义标记）同样转换', () => {
    expect(scriptsToText('<span class="superscript">2</span>')).toBe('²');
    expect(scriptsToText('x<span class="subscript">n</span>')).toBe('xₙ');
    // 多 class 混排也要命中
    expect(scriptsToText('<span class="foo superscript bar">3</span>')).toBe('³');
  });

  it('无法 Unicode 化的内容退回 ^(…) / _(…) 显式写法（不静默丢结构）', () => {
    expect(scriptsToText('<sup>点燃</sup>')).toBe('^(点燃)');
    expect(scriptsToText('x<sub>max</sub>')).toBe('x_(max)'); // m/a/x 中 m 无下标字形 → 整体退化
  });

  it('空内容 → 空串（不产出 ^() ）', () => {
    expect(scriptsToText('<sup></sup>')).toBe('');
    expect(scriptsToText('<sup>  </sup>')).toBe('');
  });

  it('不误伤其它标签与普通文本', () => {
    expect(scriptsToText('<p>普通段落</p>')).toBe('<p>普通段落</p>');
    expect(scriptsToText('价格 $5 元')).toBe('价格 $5 元');
    // 只处理上下标，其余标签原样留给调用方的清标签步骤
    expect(scriptsToText('<b>粗</b>x<sup>2</sup>')).toBe('<b>粗</b>x²');
  });

  it('scriptToText 直调：映射表可整体命中才转 Unicode', () => {
    expect(scriptToText('12', SUP_UNICODE, '^')).toBe('¹²');
    expect(scriptToText('2-', SUB_UNICODE, '_')).toBe('₂₋');
    expect(scriptToText('2x', SUB_UNICODE, '_')).toBe('₂ₓ');
    expect(scriptToText('m', SUB_UNICODE, '_')).toBe('_(m)');
  });
});

describe('端到端：rawText 派生链路（scriptsToText → 清标签）', () => {
  // 复刻 GenerateModule.simpleHtmlToPlainText 的处理顺序，锁定"上下标必须先于清标签"
  const toPlain = (html) => scriptsToText(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  it('🔴 上下标不再被拍平（旧顺序下 x<sup>2</sup> 会变成 x2）', () => {
    expect(toPlain('<p>圆面积 S=πr<sup>2</sup></p>')).toBe('圆面积 S=πr²');
    expect(toPlain('<p>水的化学式 H<sub>2</sub>O</p>')).toBe('水的化学式 H₂O');
  });

  it('段落与换行结构照常保留', () => {
    // 段间为 \n\n（段落分隔语义），行内 <br> 为 \n —— 与 simpleHtmlToPlainText 既有口径一致
    expect(toPlain('<p>第一段 x<sup>2</sup></p><p>第二段</p>')).toBe('第一段 x²\n\n第二段');
    expect(toPlain('甲<br>乙')).toBe('甲\n乙');
  });
});
