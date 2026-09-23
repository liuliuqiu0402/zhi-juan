import { describe, it, expect } from 'vitest';
import { convertFormulaToText, convertFormulasInHtml, createDefaultSectionProperties, getPrintCss } from '@/utils/wordExporter.js';

describe('convertFormulaToText', () => {
  it('分数转换为 a/b', () => {
    expect(convertFormulaToText('\\frac{1}{2}')).toBe('1/2');
  });

  it('根号转换为 √', () => {
    expect(convertFormulaToText('\\sqrt{9}')).toBe('√9');
    expect(convertFormulaToText('\\sqrt[3]{8}')).toBe('√8');
  });

  it('希腊字母转换为 Unicode', () => {
    expect(convertFormulaToText('\\alpha')).toBe('α');
    expect(convertFormulaToText('\\beta')).toBe('β');
    expect(convertFormulaToText('\\pi')).toBe('π');
    expect(convertFormulaToText('\\theta')).toBe('θ');
  });

  it('运算符转换', () => {
    expect(convertFormulaToText('\\cdot')).toBe('·');
    expect(convertFormulaToText('\\times')).toBe('×');
    expect(convertFormulaToText('\\div')).toBe('÷');
    expect(convertFormulaToText('\\pm')).toBe('±');
  });

  it('关系符号转换', () => {
    expect(convertFormulaToText('\\leq')).toBe('≤');
    expect(convertFormulaToText('\\geq')).toBe('≥');
    expect(convertFormulaToText('\\neq')).toBe('≠');
    expect(convertFormulaToText('\\approx')).toBe('≈');
  });

  it('🔴 \\leqslant/\\geqslant（教材印刷体规范写法）不得退化成 "≤slant" 乱码词', () => {
    // 曾被 \leq → ≤ 先命中，剩下 "slant" 原样留下，印到交付物里就是错内容
    expect(convertFormulaToText('\\leqslant')).toBe('\u2A7D');
    expect(convertFormulaToText('\\geqslant')).toBe('\u2A7E');
    expect(convertFormulaToText('\\sqrt{ab}\\leqslant\\frac{a+b}{2}')).toBe('√ab\u2A7D(a+b)/2');
  });

  it('🔴 分式家族 \\dfrac/\\tfrac 与 \\frac 同口径（分数线与数字不得丢）', () => {
    expect(convertFormulaToText('\\dfrac{a+b}{2}')).toBe('(a+b)/2');
    expect(convertFormulaToText('\\tfrac{1}{2}')).toBe('1/2');
  });

  it('上标 x^2 转换为 x²', () => {
    const result = convertFormulaToText('x^2');
    expect(result).toContain('²');
  });

  it('清除花括号', () => {
    expect(convertFormulaToText('{a}')).toBe('a');
  });
});

describe('convertFormulasInHtml', () => {
  it('转换行内公式', () => {
    const result = convertFormulasInHtml('角度为 $\\frac{\\pi}{2}$');
    expect(result).toContain('π');
    expect(result).not.toContain('$');
  });

  it('转换独立公式', () => {
    const result = convertFormulasInHtml('$$\\sqrt{4}$$');
    expect(result).toContain('√');
    expect(result).not.toContain('$');
  });
});

describe('createDefaultSectionProperties', () => {
  it('返回 A4 纸属性', () => {
    const props = createDefaultSectionProperties();
    expect(props.page.size.width).toBe(11906);
    expect(props.page.size.height).toBe(16838);
    expect(props.page.margin.top).toBe(1440);
  });
});

describe('getPrintCss', () => {
  it('返回打印 CSS 包含 @page 规则', () => {
    const css = getPrintCss();
    expect(css).toContain('@page');
    expect(css).toContain('A4');
    expect(css).toContain('@media print');
  });
});
