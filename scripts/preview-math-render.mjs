/**
 * 生成「公式渲染效果对照页」（P1 验收用）
 * ============================================================
 * 目的：把**真实渲染器**（src/utils/mathRender.renderMathInHtml）的输出落成一页可离线打开的
 *      HTML，左列=改版前的文本降级、右列=改版后的 KaTeX 印刷形态，肉眼即可验收。
 * 与生产同一代码路径：不重写渲染逻辑，直接 import 生产模块；样式用导出的同一份内联 CSS。
 *
 * 用法：node scripts/preview-math-render.mjs
 * 产物：仓库根目录 公式渲染效果验证.html（验收后可删）
 * ============================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);

const { renderMathInHtml } = await load('src/utils/mathRender.js');
const { convertFormulaToText } = await load('src/utils/wordExporter.js');
const { MATH_CSS } = await load('src/styles/mathCss.js');
const { KATEX_INLINE_CSS } = await load('src/utils/katexInlineCss.js');

/** 按学科列样例（形态取自各学科教材真实写法；生物/科学等为 P4 待补学科的先验展示） */
const GROUPS = [
  {
    subject: '数学 · 函数（重点核对）',
    note: '函数家族各形态：一次/二次/反比例/指数/对数/三角/分段/极限/导数/积分',
    items: [
      ['一次函数', '$y=kx+b\\ (k\\neq 0)$'],
      ['二次函数顶点式', '$y=a(x-h)^{2}+k$'],
      ['反比例函数', '$y=\\frac{k}{x}$'],
      ['指数函数', '$y=a^{x}\\ (a>0,\\ a\\neq 1)$'],
      ['对数函数', '$y=\\log_{a}x$'],
      ['三角函数（正弦型）', '$y=A\\sin(\\omega x+\\varphi)$'],
      ['分段函数（块级）', '$$f(x)=\\begin{cases}x+1,&x>0\\\\0,&x=0\\end{cases}$$'],
      ['极限', '$\\lim_{x\\to 0}\\frac{\\sin x}{x}=1$'],
      ['导数', "$f'(x)=2x$"],
      ['定积分（块级）', '$$\\int_{0}^{1}x^{2}\\,dx=\\frac{1}{3}$$'],
    ],
  },
  {
    subject: '数学',
    note: '渲染契约已覆盖（初中及以上）',
    items: [
      ['一元二次求根公式（块级）', '$$x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}$$'],
      ['分数运算（行内）', '计算：$\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}$'],
      ['根式与指数', '$\\sqrt{18}=3\\sqrt{2}$，$2^{3}\\times2^{-1}=4$'],
      ['不等式与集合', '$x\\geq\\frac{3}{2}$，$A\\cup B=\\{x\\mid x>0\\}$'],
      ['几何符号', '$\\angle ABC=90^{\\circ}$，$\\triangle ABC\\cong\\triangle DEF$'],
      ['数列求和', '$$S_n=\\frac{n(a_1+a_n)}{2}$$'],
    ],
  },
  {
    subject: '物理',
    note: '渲染契约已覆盖（初中及以上）',
    items: [
      ['速度公式', '$v=\\frac{s}{t}$'],
      ['加速度与牛顿第二定律', '$a=\\frac{\\Delta v}{\\Delta t}$，$F=ma$'],
      ['动能与单位指数', '$E_k=\\frac{1}{2}mv^{2}$，重力加速度 $g=9.8\\,\\mathrm{m/s^{2}}$'],
      ['电阻并联', '$$\\frac{1}{R}=\\frac{1}{R_1}+\\frac{1}{R_2}$$'],
      ['矢量与希腊字母', '$\\vec{F}$，$\\theta$，$\\rho=\\frac{m}{V}$'],
    ],
  },
  {
    subject: '化学',
    note: '渲染契约已覆盖（初中及以上）',
    items: [
      ['化学方程式（含条件）', '$$\\mathrm{2H_2+O_2\\xrightarrow{\\;\\text{点燃}\\;}2H_2O}$$'],
      ['离子与电荷', '$\\mathrm{SO_4^{2-}}$，$\\mathrm{Na^{+}}$，$\\mathrm{CO_3^{2-}}$'],
      ['相对分子质量计算', '$M_r(\\mathrm{H_2O})=1\\times2+16=18$'],
      ['化学平衡', '$\\mathrm{N_2+3H_2\\rightleftharpoons 2NH_3}$'],
    ],
  },
  {
    subject: '生物',
    note: '公式契约**尚未启用**（P4 待补）——此处先展示渲染端已具备的能力',
    items: [
      ['遗传图解', '$Aa\\times Aa\\rightarrow F_1$，表现型比 $3:1$'],
      ['光合作用方程式', '$$\\mathrm{6CO_2+6H_2O\\xrightarrow{\\;\\text{光照}\\;}\\ C_6H_{12}O_6+6O_2}$$'],
    ],
  },
  {
    subject: '异常兜底',
    note: '非法 LaTeX 不得把 KaTeX 报错印到卷面上',
    items: [
      ['非法写法（缺失参数）', '$\\frac{1}$'],
      ['未闭合括号', '$\\sqrt{2$'],
    ],
  },
];

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const rowsOf = (group) => group.items.map(([label, latex]) => {
  // 左列：改版前行为（convertFormulasInHtml 的等价降级）
  const oldText = latex
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, f) => convertFormulaToText(f))
    .replace(/\$([^$]+?)\$/g, (_m, f) => convertFormulaToText(f));
  // 右列：改版后行为（生产渲染器原样调用）
  const newHtml = renderMathInHtml(latex);
  return `
      <tr>
        <td class="lb">
          <div class="name">${esc(label)}</div>
          <code class="src">${esc(latex)}</code>
        </td>
        <td class="old">${esc(oldText)}</td>
        <td class="new">${newHtml}</td>
      </tr>`;
}).join('');

const body = GROUPS.map((g) => `
  <section>
    <h2>${esc(g.subject)} <span class="note">${esc(g.note)}</span></h2>
    <table>
      <thead><tr><th>样例</th><th>改版前（文本降级）</th><th>改版后（KaTeX 印刷形态）</th></tr></thead>
      <tbody>${rowsOf(g)}</tbody>
    </table>
  </section>`).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>公式渲染效果对照（P1 验收）</title>
<style>${KATEX_INLINE_CSS}</style>
<style>${MATH_CSS}</style>
<style>
  body { margin: 0; padding: 32px 40px; background: #f6f7f9; color: #1a1c22;
         font-family: "Microsoft YaHei", "PingFang SC", system-ui, sans-serif; line-height: 1.7; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .lead { color: #5a6172; font-size: 13px; margin-bottom: 26px; }
  section { background: #fff; border: 1px solid #e3e6ec; border-radius: 10px; padding: 18px 22px; margin-bottom: 22px; }
  h2 { font-size: 16px; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid #eceef3; }
  h2 .note { font-size: 12px; font-weight: 400; color: #7c8496; margin-left: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 12px; color: #7c8496; font-weight: 500; padding: 0 12px 8px 0; }
  td { padding: 11px 12px 11px 0; border-top: 1px solid #f0f2f6; vertical-align: middle; }
  td.lb { width: 30%; }
  .name { font-size: 12.5px; color: #3c4252; margin-bottom: 3px; }
  code.src { font-family: Consolas, Menlo, monospace; font-size: 11px; color: #8a90a0; word-break: break-all; }
  td.old { width: 26%; font-size: 14px; color: #b04a3a; background: #fdf6f5; }
  td.new { font-size: 15px; }
  td.new .katex { font-size: 1.15em; }
</style>
</head>
<body>
  <h1>公式渲染效果对照（P1 验收）</h1>
  <p class="lead">左列 = 改版前的文本降级（<code>convertFormulasInHtml</code>）；右列 = 改版后 KaTeX 印刷形态。本页由生产渲染器 <code>renderMathInHtml</code> 直接生成，样式与 PDF 导出使用同一份内联 CSS（含 data URL 字体）。可直接断网打开。</p>
  ${body}
</body>
</html>`;

const outPath = path.join(root, '公式渲染效果验证.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`✓ 已生成 ${outPath}（${(fs.statSync(outPath).size / 1024).toFixed(0)}KB，含内联字体，可离线打开）`);
