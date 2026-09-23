/**
 * 公式渲染：LaTeX（$...$ / $$...$$）→ 印刷级 HTML
 * ============================================================
 * 🔴 背景（2026-09 用户实证）：渲染契约 FORMULA_RULES 要求模型用 $...$ / $$...$$ 输出公式，
 *    并明文"公式禁止用文本堆砌或图片代替"；但渲染端唯一实现 convertFormulasInHtml 恰恰把它
 *    **降级成文本堆砌**（\frac{a}{b} → a/b、\sqrt{a} → √a、x^2 → x²）——契约与实现自相矛盾
 *    （一条"要求悬空"），分式没有叠排、根号只剩字符，永远拿不到教材印刷样式。
 *    本模块用 KaTeX 把 $…$ 真正渲染为分式叠排 / 根号 / 积分号等印刷形态。
 *
 * 🔴 两个消费者的分工（**不要混用**）：
 *   - renderMathInHtml      → **渲染出口**（编辑器预览 / PDF / 打印 / HTML 导出）：输出 KaTeX 视觉 HTML
 *   - convertFormulasInHtml → **存储与喂 AI**（OCR 清洗 / rawText 派生）：降级为可读文本
 *     为什么不给存储链路也渲染：KaTeX 的 DOM 文本内容对 \frac{a}{b} 是"ab"（分子分母连写），
 *     比 a/b 更难读；且满屏 .katex span 会污染 rawText/纯文本抽取。故存储链路继续走文本降级，
 *     渲染链路才上 KaTeX。下游可用 data-latex 属性取回原始 LaTeX（已解码，供 P5 Word 真公式复用）。
 *
 * 🔴 字体：PDF 走 Electron 主进程 page.setContent（无 base URL、无网络），katex.min.css 里
 *    url(fonts/*.woff2) 的相对字体**解析不到** → 分式/根号字模缺失走形。故导出 HTML 必须内联
 *    带 data URL 字体的样式（katexInlineCss.js，由 scripts/build-katex-inline.mjs 生成），
 *    见 withKatexStyles()。样式模块**动态 import**，普通页面不背这 360KB。
 * ============================================================
 */
import katex from 'katex';
import { escapeHtml } from './escape.js';
import { convertFormulaToText } from './wordExporter.js';
// 公式补充样式单一事实源（应用内注入 / 导出内联共用；不引 katex，避免把 JS 带进入口包）
import { MATH_CSS } from '../styles/mathCss.js';
// 公式定界语法单一事实源（与 Word 导出端共用；零依赖，不含 katex）
import { MATH_RE } from './mathSyntax.js';

/** 需要整段跳过、不做公式替换的结构（代码里的 LaTeX 示例不是公式；注释同理） */
const PROTECTED_RE = /<!--[\s\S]*?-->|<(script|style|code|pre)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?[A-Za-z][^>]*>/gi;

/** \$ 转义占位（私有区字符，正文几乎不可能出现；渲染完成后还原为 $） */
const ESC_DOLLAR = '\uE000ZWGESC\uE000';

/** 补充样式（沿用历史导出名 ZWG_MATH_CSS；实际定义在 styles/mathCss.js 单一事实源） */
export const ZWG_MATH_CSS = MATH_CSS;

/**
 * 按"标签 / 受保护块 / 文本"切分，只对**文本段**应用 fn。
 * 为什么不能整串直接 replace：$ 可能出现在属性值里（href="$x"），整串替换会把标签属性改坏。
 */
const mapTextSegments = (html, fn) => {
  let out = '';
  let last = 0;
  let m;
  PROTECTED_RE.lastIndex = 0;
  while ((m = PROTECTED_RE.exec(html)) !== null) {
    if (m.index > last) out += fn(html.slice(last, m.index));
    out += m[0];
    last = m.index + m[0].length;
  }
  if (last < html.length) out += fn(html.slice(last));
  return out;
};

/** 单个公式 → 带来源标记的 span（data-latex 供下游回读原始 LaTeX） */
const wrapMath = (inner, latex, displayMode, failed) => {
  const cls = `zwg-math${displayMode ? ' zwg-math-display' : ''}${failed ? ' zwg-math-fallback' : ''}`;
  const attrs = `class="${cls}" data-math="1" data-latex="${escapeHtml(latex)}"${displayMode ? ' data-display="1"' : ''}`;
  return `<span ${attrs}>${inner}</span>`;
};

/**
 * 渲染单个 LaTeX。
 * 🔴 throwOnError:true + try/catch：KaTeX 自带的 throwOnError:false 会把报错**红字印在卷面上**
 *    （"ParseError: …"），绝不能进交付物；非法公式退回文本降级（与改版前行为一致，不产生退化）。
 */
const renderOne = (latexRaw, displayMode) => {
  const src = String(latexRaw == null ? '' : latexRaw).trim().replace(/\s+/g, ' ');
  if (!src) return '';
  try {
    const inner = katex.renderToString(src, {
      displayMode: !!displayMode,
      throwOnError: true,
      strict: false,      // 中文/全角字符混在公式里不报错（教材常见）
      trust: false,       // 禁用 \href 等可执行能力
      output: 'html',     // 只要视觉层（MathML 隐藏层会把 DOM 体积翻倍；P5 需要时再按需生成）
    });
    return wrapMath(inner, src, displayMode, false);
  } catch (e) {
    return wrapMath(escapeHtml(convertFormulaToText(src)), src, displayMode, true);
  }
};

/** 是否含公式（供调用方跳过无谓处理） */
export const hasMath = (html = '') => /\$[^$\n]+\$|\$\$[\s\S]+?\$\$/.test(String(html || '')) && String(html || '').indexOf('$') !== -1;

/**
 * 把 HTML 里的 $...$ / $$...$$ 渲染为 KaTeX 印刷形态。
 * 幂等：渲染产物内不再含 $（data-latex 存的是去掉定界符的 LaTeX），重复调用不会二次渲染。
 * @param {string} html
 * @returns {string}
 */
export const renderMathInHtml = (html = '') => {
  const src = String(html == null ? '' : html);
  if (!src || src.indexOf('$') === -1) return src;
  const protectedSrc = src.replace(/\\\$/g, ESC_DOLLAR);
  const rendered = mapTextSegments(protectedSrc, (text) => {
    if (text.indexOf('$') === -1) return text;
    return text.replace(MATH_RE, (whole, disp, inl) => {
      const isDisplay = disp != null;
      const out = renderOne(isDisplay ? disp : inl, isDisplay);
      return out || whole;
    });
  });
  return rendered.split(ESC_DOLLAR).join('$');
};

// ==================== 导出：内联 KaTeX 样式（含字体） ====================

let _inlineCssPromise = null;

/** 懒加载内联样式模块（360KB，仅导出链路需要；失败返回空串，不阻断导出） */
export const loadKatexInlineCss = () => {
  if (!_inlineCssPromise) {
    _inlineCssPromise = import('./katexInlineCss.js')
      .then((m) => m.KATEX_INLINE_CSS || m.default || '')
      .catch((e) => {
        console.warn('[mathRender] 内联 KaTeX 样式加载失败，导出将退回系统字体:', e?.message);
        return '';
      });
  }
  return _inlineCssPromise;
};

/**
 * 给导出用的 HTML 注入 KaTeX 内联样式（字体已 data URL 化）。
 * 有 </head> 注入到 head 末尾；片段 HTML（无 head）直接前置（puppeteer setContent 会自行补壳）。
 * 🔧 短路：内容里没有任何 KaTeX 渲染产物（无公式的普通卷）时原样返回 —— 不白背 360KB 字体。
 */
export const withKatexStyles = async (html = '') => {
  const src = String(html == null ? '' : html);
  if (!src) return src;
  if (!/data-math="1"|class="[^"]*\bkatex\b/.test(src)) return src;
  const css = await loadKatexInlineCss();
  const styleTag = `<style data-katex-inline="1">${ZWG_MATH_CSS}${css}</style>`;
  if (/<\/head>/i.test(src)) return src.replace(/<\/head>/i, `${styleTag}</head>`);
  return styleTag + src;
};

export default { renderMathInHtml, hasMath, withKatexStyles, loadKatexInlineCss, ZWG_MATH_CSS };
