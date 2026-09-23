/**
 * LaTeX → docx 真公式（Word 公式对象）回归锁
 * ============================================================
 * 🔴 本轮修的缺陷（2026-09 用户实证）：Word 导出对公式的处理只在"整个文本节点恰好是 $...$"时命中
 *    （真实语句「半径为 $r$ 的圆」永不命中），命中时也只是剥掉 $ 后涂成**深蓝斜体**——
 *    于是 Word 交付物里 `\frac{a}{b}` 原样泄漏，既非公式也非印刷样式。
 *    现改为产出**真正的 Word 公式对象**（docx 内置 OMML 支持），可编辑、印刷级。
 *
 * 🔴 宁缺勿错：只转换能确定正确表达的子集；遇到不支持的构造整体返回 null（调用方降级为
 *    可读 Unicode 文本）。**错公式比纯文本更糟**——看起来对、实际错了。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Document, Packer, Paragraph } from 'docx';
import { latexToDocxMath } from '@/utils/latexToDocxMath.js';

describe('latexToDocxMath：支持的子集产出真公式', () => {
  it('分式 / 根式（含 n 次方）', () => {
    expect(latexToDocxMath('\\frac{a}{b}')).toBeTruthy();
    expect(latexToDocxMath('\\sqrt{x+1}')).toBeTruthy();
    expect(latexToDocxMath('\\sqrt[3]{8}')).toBeTruthy();
  });

  it('上下标：^ / _ / 连续挂载', () => {
    expect(latexToDocxMath('x^{2}')).toBeTruthy();
    expect(latexToDocxMath('H_{2}O')).toBeTruthy();
    expect(latexToDocxMath('x_{i}^{2}')).toBeTruthy();
    expect(latexToDocxMath('x ^ 2')).toBeTruthy(); // 上下标前允许空白
  });

  it('n 元算子（∑ / ∫，含上下限与作用对象）', () => {
    expect(latexToDocxMath('\\sum_{i=1}^{n} i')).toBeTruthy();
    expect(latexToDocxMath('\\int_{0}^{1} x')).toBeTruthy();
  });

  it('函数/算子名走正体，紧随 {} 时补空格避免 "sinx"', () => {
    expect(latexToDocxMath('\\sin x')).toBeTruthy();
    expect(latexToDocxMath('\\sin{x}')).toBeTruthy();
    expect(latexToDocxMath('\\lim_{x\\to 0}')).toBeTruthy();
  });

  it('成对括号 \\left…\\right（圆/方/花）', () => {
    expect(latexToDocxMath('\\left(x+1\\right)')).toBeTruthy();
    expect(latexToDocxMath('\\left[x\\right]')).toBeTruthy();
    expect(latexToDocxMath('\\left\\{x\\right\\}')).toBeTruthy();
  });

  it('\\text 正体文字（化学条件等）与常用符号/希腊字母', () => {
    expect(latexToDocxMath('\\text{点燃}')).toBeTruthy();
    expect(latexToDocxMath('\\alpha+\\beta')).toBeTruthy();
    expect(latexToDocxMath('a\\times b\\leq c')).toBeTruthy();
  });

  it('真实教材公式整串可转换', () => {
    for (const f of ['v=\\frac{s}{t}', 'E_k=\\frac{1}{2}mv^{2}', 'x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}',
      '\\frac{1}{R}=\\frac{1}{R_1}+\\frac{1}{R_2}']) {
      expect(latexToDocxMath(f), f).toBeTruthy();
    }
  });
});

describe('latexToDocxMath：宁缺勿错（不支持的构造一律 null，交调用方降级）', () => {
  it('未支持命令 / 环境 / 重音 → null（不猜着转换）', () => {
    expect(latexToDocxMath('\\vec{F}')).toBe(null);
    expect(latexToDocxMath('\\begin{matrix}a&b\\end{matrix}')).toBe(null);
    expect(latexToDocxMath('\\overline{AB}')).toBe(null);
    expect(latexToDocxMath('\\unknowncmd{x}')).toBe(null);
  });

  it('括号不成对 / 残留未消费 → null', () => {
    expect(latexToDocxMath('\\left(x+1')).toBe(null);
    expect(latexToDocxMath('\\left(x\\right]')).toBe(null);
    expect(latexToDocxMath('a}b')).toBe(null);
  });

  it('空输入 → null', () => {
    expect(latexToDocxMath('')).toBe(null);
    expect(latexToDocxMath('   ')).toBe(null);
    expect(latexToDocxMath(null)).toBe(null);
  });
});

describe('端到端：打包 docx 后确实生成 OMML（Word 公式 XML）', () => {
  it('端到端：括号类型不得静默认错（方括号必须落成 [ 而非回退成圆括号）', async () => {
    // 🔴 回归锁：`[`/`]` 被词法器单独分词，曾使 `\left[x\right]` 的右定界符取不到、回退成 ')'
    //    → 方括号被静默渲染成圆括号（看起来正常、其实错了）
    const doc = new Document({
      sections: [{ children: [new Paragraph({ children: [latexToDocxMath('\\left[x+1\\right]')] })] }],
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
    const xml = await zip.file('word/document.xml').async('string');
    expect(xml).toContain('m:val="["');
    expect(xml).toContain('m:val="]"');
  });

  it('分式/根式/上下标/n 元算子都落成 m:oMath 结构', async () => {
    const nodes = [
      latexToDocxMath('\\frac{a}{b}'),
      latexToDocxMath('\\sqrt[3]{8}'),
      latexToDocxMath('x_{i}^{2}'),
      latexToDocxMath('\\sum_{i=1}^{n} i'),
    ];
    expect(nodes.every(Boolean)).toBe(true);

    const doc = new Document({ sections: [{ children: [new Paragraph({ children: nodes })] }] });
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml').async('string');

    // 真公式的标志：OMML 命名空间结构存在（而非纯文本）
    expect(xml).toContain('<m:oMath');
    expect(xml).toContain('<m:f');       // 分式
    expect(xml).toContain('<m:num');
    expect(xml).toContain('<m:den');
    expect(xml).toContain('<m:rad');     // 根式
    expect(xml).toContain('<m:deg');     // n 次方次数
    expect(xml).toContain('<m:sSubSup'); // 上下标并排
    expect(xml).toContain('<m:nary');    // n 元算子
    expect(xml, '不得把 LaTeX 源码原样写进 Word').not.toContain('\\frac');
  });
});
