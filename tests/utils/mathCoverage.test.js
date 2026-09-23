/**
 * 公式全学科覆盖矩阵（回归锁）
 * ============================================================
 * 🔴 目的：用户问"所有学科该有的都支持了吗、数学的函数也支持吗、各处都能正常显示吗"——
 *    本文件把答案**钉成断言**，覆盖度一旦回退立即失败。
 *
 * 两条链路的期望不同，必须分开锁：
 *   · 屏幕端（预览 / PDF / HTML 导出，KaTeX）：**全量渲染**，不允许任何降级；
 *   · Word 端（docx 内置 OMML）：覆盖确定能正确表达的子集；docx 未导出 OMML 类的构造
 *     （重音 m:acc / 方程组 m:eqArr）必降级，但降级文本**不得泄漏命令名**（不得出现
 *     "xrightarrow点燃"、"vecF" 这类乱码词）。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderMathInHtml } from '@/utils/mathRender.js';
import { latexToDocxMath } from '@/utils/latexToDocxMath.js';
import { convertFormulaToText } from '@/utils/wordExporter.js';

const ROOT = path.resolve(__dirname, '../..');

/** 屏幕端必须全部渲染成功（含数学函数全家族、各学科代表式） */
const SCREEN_MUST_RENDER = [
  // 数学·函数
  ['函数式', 'f(x)=x^{2}+1'],
  ['一次函数', 'y=kx+b'],
  ['反比例函数', 'y=\\frac{k}{x}'],
  ['二次函数顶点式', 'y=a(x-h)^{2}+k'],
  ['指数函数', 'y=a^{x}\\ (a>0,a\\neq 1)'],
  ['对数函数', 'y=\\log_{a}x'],
  ['三角函数', 'y=A\\sin(\\omega x+\\varphi)'],
  ['正切', 'y=\\tan x'],
  ['极限', '\\lim_{x\\to 0}\\frac{\\sin x}{x}=1'],
  ['分段函数', 'f(x)=\\begin{cases}x+1,&x>0\\\\0,&x=0\\end{cases}'],
  ['导数', "f'(x)=2x"],
  ['定积分', '\\int_{0}^{1}x^{2}\\,dx'],
  ['根式', '\\sqrt{x^{2}+1}'],
  ['集合', '\\{x\\mid x>0\\}'],
  ['数列递推', 'a_{n+1}=a_{n}+d'],
  ['等差数列求和', 'S_{n}=\\frac{n(a_{1}+a_{n})}{2}'],
  ['求根公式', 'x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}'],
  ['几何符号', '\\triangle ABC\\cong\\triangle DEF,\\ \\angle A=90^{\\circ}'],
  // 物理
  ['速度', 'v=\\frac{s}{t}'],
  ['牛顿第二定律', 'F=ma'],
  ['动能', 'E_{k}=\\frac{1}{2}mv^{2}'],
  ['欧姆定律', 'R=\\frac{U}{I}'],
  ['矢量', '\\vec{F}=m\\vec{a}'],
  ['单位指数', 'g=9.8\\,\\mathrm{m/s^{2}}'],
  // 化学
  ['化学方程式（条件）', '\\mathrm{2H_{2}+O_{2}\\xrightarrow{\\text{点燃}}2H_{2}O}'],
  ['分解反应（↑）', '\\mathrm{CaCO_{3}\\xrightarrow{\\text{高温}}CaO+CO_{2}\\uparrow}'],
  ['离子', '\\mathrm{SO_{4}^{2-}}'],
  ['化学平衡', '\\mathrm{N_{2}+3H_{2}\\rightleftharpoons 2NH_{3}}'],
  // 生物
  ['光合作用', '\\mathrm{6CO_{2}+6H_{2}O\\xrightarrow{\\text{光照}}C_{6}H_{12}O_{6}+6O_{2}}'],
  ['遗传图解', 'Aa\\times Aa\\rightarrow F_{1}'],
  ['表现型比', '3:1'],
];

/** Word 端必须落成**真公式对象**（docx 有对应 OMML 类） */
const WORD_MUST_BE_MATH = [
  'f(x)=x^{2}+1', 'y=kx+b', 'y=\\frac{k}{x}', 'y=a(x-h)^{2}+k',
  'y=\\log_{a}x', 'y=A\\sin(\\omega x+\\varphi)', '\\sin x+\\cos x', 'y=\\tan x',
  '\\lim_{x\\to 0}\\frac{\\sin x}{x}=1',
  'f(x)=\\begin{cases}x+1,&x>0\\\\0,&x=0\\end{cases}',
  "f'(x)=2x", '\\int_{0}^{1}x^{2}\\,dx', '\\sqrt{x^{2}+1}',
  '\\{x\\mid x>0\\}', 'a_{n+1}=a_{n}+d', 'S_{n}=\\frac{n(a_{1}+a_{n})}{2}',
  'x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}',
  '\\triangle ABC\\cong\\triangle DEF', '\\angle A=90^{\\circ}',
  'v=\\frac{s}{t}', 'F=ma', 'E_{k}=\\frac{1}{2}mv^{2}', 'R=\\frac{U}{I}', 'g=9.8\\,\\mathrm{m/s^{2}}',
  '\\mathrm{2H_{2}+O_{2}\\xrightarrow{\\text{点燃}}2H_{2}O}',
  '\\mathrm{CaCO_{3}\\xrightarrow{\\text{高温}}CaO+CO_{2}\\uparrow}',
  '\\mathrm{SO_{4}^{2-}}', '\\mathrm{N_{2}+3H_{2}\\rightleftharpoons 2NH_{3}}',
  '\\mathrm{6CO_{2}+6H_{2}O\\xrightarrow{\\text{光照}}C_{6}H_{12}O_{6}+6O_{2}}',
  'Aa\\times Aa\\rightarrow F_{1}',
  // 以下原为降级项，自建 OMML 组件（ommlExtras）补齐后已是真公式
  '\\vec{F}=m\\vec{a}',
  '\\overline{AB}',
  '\\begin{aligned}a&=b\\\\c&=d\\end{aligned}',
  '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}',
  '\\left[a,b\\right)',
];

describe('屏幕端（预览 / PDF / HTML 导出）：全学科公式必须全部渲染', () => {
  it.each(SCREEN_MUST_RENDER)('%s：渲染为印刷形态（不降级）', (_label, latex) => {
    const html = renderMathInHtml(`$${latex}$`);
    expect(html, '不得退回文本降级').not.toContain('zwg-math-fallback');
    expect(html).toContain('class="katex"');
    expect(html, '不得残留未渲染的 LaTeX').not.toContain(`$${latex}$`);
  });

  it('数学函数家族的代表结构都在（分式/根式/上下标/分段/积分/极限）', () => {
    const has = (latex, marker) => expect(renderMathInHtml(`$${latex}$`), latex).toContain(marker);
    has('\\frac{a}{b}', 'mfrac');                       // 分式叠排
    has('\\sqrt{a}', 'mord sqrt');                      // 根式
    has('y=a(x-h)^{2}+k', 'msup');                      // 上下标
    has('\\begin{cases}a\\\\b\\end{cases}', 'mtable');  // 分段函数（KaTeX 用 mtable 排）
    has('\\int_{0}^{1}', 'mop');                        // 积分号
    has('\\lim_{x\\to 0}', 'mop');                      // 极限
    has('\\log_{a}x', 'mop');                           // 对数（正体算子）
  });
});

describe('Word 端：可确定表达的构造必须落成真公式对象（OMML）', () => {
  it.each(WORD_MUST_BE_MATH)('%s → 真 Word 公式', (latex) => {
    expect(latexToDocxMath(latex), latex).toBeTruthy();
  });
});

describe('降级路径：docx 无对应 OMML 类时不产出错公式，且绝不泄漏命令名', () => {
  // 以下构造 docx 无对应类、且本仓库也未自建（环境未登记 / 命令未实现）→ 必然走文本降级。
  // 🔴 降级只允许发生在"确实无法确定性表达"时；能确定表达的一律出真公式（见上一组）。
  const DOCX_UNSUPPORTED = [
    ['未登记环境（带列格式）', '\\begin{array}{cc}a&b\\end{array}'],
    ['加框', '\\boxed{x}'],
    ['下括号', '\\underbrace{x}'],
    ['组合数', '\\binom{n}{k}'],
    ['未知命令', '\\unknowncmd{x}'],
  ];

  it.each(DOCX_UNSUPPORTED)('%s：latexToDocxMath 返回 null（不猜着转换）', (_label, latex) => {
    expect(latexToDocxMath(latex)).toBe(null);
  });

  it.each(DOCX_UNSUPPORTED)('%s：降级文本可读且无乱码命令名', (_label, latex) => {
    const text = convertFormulaToText(latex);
    expect(text.trim(), '降级不得产出空串').not.toBe('');
    // 🔴 命令名绝不能泄漏成字面词（曾出现 "xrightarrow点燃"、"vecF"、"begin…cases"）
    for (const leak of ['xrightarrow', 'vec', 'frac', 'sqrt', 'begin', 'end{', 'cases', 'left', 'right',
      'cdot', 'alpha', 'overline', 'aligned', 'array', 'boxed', 'underbrace', 'binom', 'unknowncmd']) {
      expect(text, `降级文本泄漏命令名「${leak}」：${text}`).not.toContain(leak);
    }
    expect(text, '不得残留反斜杠').not.toContain('\\');
  });

  it('降级给"喂 AI 的纯文本"保留语义：矢量带组合箭头符而非只剩字母', () => {
    // 这条守的是 rawText/AI 消费侧（convertFormulaToText），与 Word 真公式路径互不影响：
    // Word 端 \vec 已由 m:acc 出真重音（见上一组），此处是其**文本降级**的可读性要求
    expect(convertFormulaToText('\\vec{F}')).toBe('F\u20D7');
  });

  it('化学方程式即使走降级也不丢反应条件文字', () => {
    expect(convertFormulaToText('\\xrightarrow{点燃}')).toContain('点燃');
  });
});

describe('展示出口不得漏渲染公式（源码级守卫）', () => {
  // 曾漏：两个"内容预览"弹窗直接注入原文，公式显示生 LaTeX
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('生成记录的内容预览过 renderMathInHtml', () => {
    const src = read('src/modules/GenerateModule.vue');
    expect(src).toMatch(/previewContent\.value = renderMathInHtml\(/);
  });

  it('历史记录的内容预览过 renderMathInHtml', () => {
    const src = read('src/modules/HistoryModule.vue');
    expect(src).toMatch(/previewContent\.value = renderMathInHtml\(/);
  });

  it('排版模块的预览/导出统一走 applyThemeToContent（内含公式渲染）', () => {
    const src = read('src/modules/TypesetModule.vue');
    expect(src).toMatch(/applyThemeToContent\(/);
  });
});
