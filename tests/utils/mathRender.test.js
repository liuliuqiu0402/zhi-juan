/**
 * 公式渲染出口（mathRender）回归锁
 * ============================================================
 * 🔴 本轮修的缺陷（2026-09 用户实证）：渲染契约 FORMULA_RULES 要求模型用 $...$ 输出公式、
 *    且明文"公式禁止用文本堆砌或图片代替"，但渲染端唯一实现 convertFormulasInHtml 恰好
 *    把它降级成文本堆砌（\frac{a}{b} → a/b）——契约与实现自相矛盾，永远拿不到印刷样式。
 *    下列断言把"真渲染 / 不误伤 / 不降级失败"三件事钉住。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { renderMathInHtml, hasMath, withKatexStyles } from '@/utils/mathRender.js';

describe('renderMathInHtml：$…$ → 印刷级公式', () => {
  it('行内公式渲染为 KaTeX 结构，并保留原始 LaTeX 供下游回读', () => {
    const out = renderMathInHtml('<p>半径为 $r$ 的圆</p>');
    expect(out).toContain('class="katex"');
    expect(out).toContain('data-math="1"');
    expect(out).toContain('data-latex="r"');
    expect(out, '定界符必须被消费掉，否则会重复渲染').not.toContain('$r$');
    expect(out).toContain('半径为');   // 公式之外的正文不受影响
    expect(out).toContain('的圆');
  });

  it('🔴 分式真的叠排（旧实现只给 "a/b" 平排文本）', () => {
    const out = renderMathInHtml('$\\frac{a}{b}$');
    expect(out, 'KaTeX 分式节点（上下叠排）').toContain('mfrac');
    expect(out).not.toContain('>a/b<');
  });

  it('🔴 根号渲染为根式结构（旧实现只给 "√a" 字符）', () => {
    const out = renderMathInHtml('$\\sqrt{x+1}$');
    // KaTeX 的 html 输出用真实根式排版：class="mord sqrt" + 内联 SVG 画根号（非字符拼接）
    expect(out).toContain('mord sqrt');
    expect(out, '根号是矢量绘制而非 √ 字符').toContain('<svg');
    expect(out, '被开方数必须落在根号内部而不是并列').toContain('svg-align');
    expect(out).not.toContain('√x+1');
  });

  it('块级 $$…$$ → 独占一行的展示式（katex-display + 项目补充类）', () => {
    const out = renderMathInHtml('<p>$$\\frac{\\pi}{2}$$</p>');
    expect(out).toContain('katex-display');
    expect(out).toContain('zwg-math-display');
    expect(out).toContain('data-display="1"');
  });

  it('非法 LaTeX → 退回可读文本，绝不把 KaTeX 报错印到卷面上', () => {
    const out = renderMathInHtml('$\\frac{1}$');
    expect(out).toContain('zwg-math-fallback');
    expect(out, 'KaTeX 错误样张绝不能进交付物').not.toContain('ParseError');
    expect(out).not.toContain('class="katex"');
  });

  it('不误伤标签属性里的 $（整串替换会把属性改坏）', () => {
    const html = '<a href="/x?p=$5">链接</a>';
    expect(renderMathInHtml(html)).toBe(html);
  });

  it('不误伤 <code>/<pre> 里的 LaTeX 示例（代码不是公式）', () => {
    const html = '<pre><code>用 $x^2$ 表示平方</code></pre>';
    expect(renderMathInHtml(html)).toBe(html);
  });

  it('转义 \\$ 还原为字面美元号，不当公式定界符', () => {
    const out = renderMathInHtml('<p>价格 \\$5 元</p>');
    expect(out).toContain('$5');
    expect(out).not.toContain('data-math');
  });

  it('幂等：渲染产物内不再含 $，重复调用结果不变', () => {
    const once = renderMathInHtml('<p>$x^2$ 与 $$\\frac{a}{b}$$</p>');
    expect(renderMathInHtml(once)).toBe(once);
  });

  it('无公式内容原样返回（不产生任何包裹）', () => {
    const html = '<p>普通一段话，没有公式。</p>';
    expect(renderMathInHtml(html)).toBe(html);
  });

  it('同一段里行内与块级混排各按各的渲染', () => {
    const out = renderMathInHtml('<p>先 $a$ 后</p><p>$$b$$</p>');
    expect(out.match(/data-math="1"/g).length).toBe(2);
    expect(out).toContain('zwg-math-display');
  });
});

describe('hasMath：公式存在性判定', () => {
  it('识别行内与块级', () => {
    expect(hasMath('$x$')).toBe(true);
    expect(hasMath('$$x$$')).toBe(true);
    expect(hasMath('没有公式')).toBe(false);
    expect(hasMath('')).toBe(false);
  });
});

describe('withKatexStyles：导出内联（离线自带字形）', () => {
  it('无公式内容原样返回 —— 不白背字体体积', async () => {
    const html = '<p>这张卷子没有公式</p>';
    expect(await withKatexStyles(html)).toBe(html);
  });

  it('含渲染后公式 → 内联样式含 data URL 字体（puppeteer 无网络也能出字模）', async () => {
    const html = renderMathInHtml('<p>$\\frac{a}{b}$</p>');
    const out = await withKatexStyles(html);
    expect(out).toContain('data-katex-inline="1"');
    expect(out).toContain('data:font/woff2;base64,');
    expect(out, 'KaTeX 基础样式必须一并内联').toContain('.katex');
    expect(out).toContain('zwg-math-display'); // 项目补充样式同源注入
  });

  it('完整 HTML 文档 → 注入到 </head> 之前（不破坏文档结构）', async () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${renderMathInHtml('$x$')}</body></html>`;
    const out = await withKatexStyles(html);
    expect(out.indexOf('data-katex-inline')).toBeLessThan(out.indexOf('</head>'));
    expect(out).toContain('<body>');
  });
});
