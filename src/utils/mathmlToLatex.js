/**
 * MathML → LaTeX（网页 / LibreOffice 公式粘贴还原）
 * ============================================================
 * 🔴 为什么需要：Word 的 HTML 剪贴板里没有 MathML（那是独立剪贴板格式），但**浏览器网页**
 *    （维基等用 <math> 的站点）与 **LibreOffice Writer** 复制公式时给的都是 MathML。
 *    此前链路不认 <math>，ProseMirror 解析后只剩标签内的散字（分式塌陷、上下标错位）。
 *
 * 🔴 与 OMML 侧同源：本模块同样只做**格式还原**，产出 LaTeX 交给既有 `$…$` 通道渲染
 *    （utils/mathRender.renderMathInHtml + KaTeX）——全链路只有一种公式表示。
 *
 * 🔴 解析方式：按本地名匹配（剥掉 mml:/math: 之类的任意前缀），并**优先 XML、回退 HTML**——
 *    MathML 片段自带 xmlns 时 XML 可用；若片段缺声明/含 HTML 实体则 XML 会失败，
 *    此时用宽松的 HTML 解析兜底。解析失败返回 null，调用方保留原文（绝不因公式毁掉整段粘贴）。
 *
 * 支持范围：mrow/mi/mn/mo/mtext、mfrac、msup/msub/msubsup、msqrt/mroot、mfenced、
 * mtable/mtr/mtd、mover/munder/munderover、menclose、mstyle/mpadded/mphantom/semantics。
 * 未登记元素透明递归（保内容不丢字）。
 * ============================================================
 */

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

/** 本地名（剥任意命名空间前缀，统一小写） */
const local = (el) => {
  const n = (el && (el.localName || el.tagName)) || '';
  return String(n).toLowerCase().split(':').pop();
};
const childEls = (el) => (el && el.children ? Array.from(el.children) : []);
const attr = (el, name) => (el && el.getAttribute ? el.getAttribute(name) : null);

/** 解析 MathML 字符串 → 根元素（失败返回 null） */
export const parseMathML = (src) => {
  const s = String(src == null ? '' : src).trim();
  if (!s || typeof DOMParser === 'undefined') return null;
  // ① 先按 XML（片段自带 xmlns 时最准确，保留结构语义）
  try {
    const doc = new DOMParser().parseFromString(s, 'application/xml');
    if (doc && !doc.getElementsByTagName('parsererror').length && doc.documentElement) {
      return doc.documentElement;
    }
  } catch { /* 落到 HTML */ }
  // ② 回退宽松 HTML 解析（缺 xmlns / 含实体时的兜底）
  try {
    const doc = new DOMParser().parseFromString(s, 'text/html');
    const el = doc.body ? doc.body.firstElementChild : null;
    return el || null;
  } catch {
    return null;
  }
};

// ==================== 文本与符号 ====================

const CJK_RE = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;
/** LaTeX 保留字符转义（反斜杠须最先处理，避免二次转义） */
const escLatex = (t) => String(t).replace(/\\/g, '\\textbackslash ').replace(/([{}[\]$&#^_%~])/g, '\\$1');

/** Unicode 数学符号 → LaTeX 命令（未列出的透传） */
const SYMBOL_MAP = {
  '−': '-', '\u2212': '-', '⋅': '\\cdot ', '\u22c5': '\\cdot ',
  '×': '\\times ', '÷': '\\div ', '±': '\\pm ', '∓': '\\mp ',
  '≤': '\\leq ', '≥': '\\geq ', '⩽': '\\leqslant ', '⩾': '\\geqslant ', '≠': '\\neq ', '≈': '\\approx ',
  '∞': '\\infty ', '→': '\\rightarrow ', '←': '\\leftarrow ',
  '⇒': '\\Rightarrow ', '⇌': '\\rightleftharpoons ', '∈': '\\in ', '∉': '\\notin ',
  '∠': '\\angle ', '⊥': '\\perp ', '∥': '\\parallel ', '△': '\\triangle ',
  '∑': '\\sum ', '∏': '\\prod ', '∫': '\\int ', '√': '\\sqrt ', '°': '^{\\circ }',
};
// 🔴 ⩽/⩾（U+2A7D/U+2A7E，教材印刷体不等号）必须同时加进字符类，
//    否则 mapSymbols 根本不会把它送进 SYMBOL_MAP（表里有、正则不认 = 静默没映射）
const mapSymbols = (t) => String(t).replace(/[−⋅×÷±∓≤≥⩽⩾≠≈∞→←⇒⇌∈∉∠⊥∥△∑∏∫√°\u2A7D\u2A7E\u2212\u22c5]/g, (c) => SYMBOL_MAP[c] || c);

/** mi/mn/mo/mtext 文本 → LaTeX（CJK 走 \text，多字符标识符走 \mathrm，保留字符转义） */
const tokenToLatex = (el, kind) => {
  const raw = String(el.textContent || '').replace(/[\u200b\u200c\u200d\ufeff]/g, '');
  if (!raw) return '';
  if (kind === 'mtext' || CJK_RE.test(raw)) return `\\text{${raw.replace(/([\\{}$&#^_%~])/g, '\\$1')}}`;
  const mapped = escLatex(mapSymbols(raw));
  // \cdot 之类命令带尾随空格，长度判断按可见字符数
  const visible = raw.trim();
  if (kind === 'mi' && visible.length > 1) return `\\mathrm{${mapped.trim()}}`;
  return mapped;
};

// ==================== 主转换 ====================

/** 基座包装：多字符须加花括号，否则 ^/_ 只作用于首字符 */
const wrapBase = (s) => {
  const t = String(s || '');
  if (!t) return '';
  return /^[\u4e00-\u9fff\w]$/.test(t) ? t : `{${t}}`;
};

/** mfenced / mo 定界符字符 → LaTeX 左右定界符 */
const delimToLatex = (chr) => {
  const c = String(chr == null ? '' : chr).trim();
  if (!c) return '.';
  const map = {
    '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}',
    '|': '|', '‖': '\\|', '∥': '\\|', '⌈': '\\lceil', '⌉': '\\rceil',
    '⌊': '\\lfloor', '⌋': '\\rfloor', '⟨': '\\langle', '⟩': '\\rangle',
  };
  return map[c] || c;
};

/** 由 mfenced 的 open/close/separators 生成 \left…\right（分隔符用普通字符，
 *  🔴 不用 \middle —— \middle 专用于可伸缩定界符，逗号分隔写成 \middle, 会渲染成怪异的大逗号） */
const fencedLatex = (open, close, seps, parts) => {
  const lo = delimToLatex(open);
  const ro = delimToLatex(close);
  const sepChars = String(seps == null ? ',' : seps);
  let body = parts[0] || '';
  for (let i = 1; i < parts.length; i += 1) {
    const s = sepChars.length ? sepChars[(i - 1) % sepChars.length] : ',';
    body += escLatex(mapSymbols(s)) + parts[i];
  }
  return `\\left${lo}${body}\\right${ro}`;
};

const convAll = (el, sep = '') => childEls(el).map((c) => convEl(c)).join(sep);

/** 递归转换单个 MathML 元素 → LaTeX */
export const mathmlElementToLatex = (el) => {
  if (!el || el.nodeType !== 1) return '';
  const tag = local(el);

  switch (tag) {
    // ---- 透明容器 ----
    case 'math': case 'mrow': case 'mstyle': case 'mpadded': case 'mphantom':
    case 'semantics': case 'annotation-xml': case 'msrow': case 'mstack':
      return convAll(el);
    case 'annotation':
      return ''; // 语义注记（含 LaTeX 源码的 annotation 也不重复取，避免与呈现层冲突）

    // ---- 叶子文本 ----
    case 'mi': case 'mn': case 'mo': case 'ms':
      return tokenToLatex(el, tag);
    case 'mtext':
      return tokenToLatex(el, 'mtext');
    case 'mspace':
      return '\\ ';

    // ---- 分式 / 根式 ----
    case 'mfrac': {
      const [a, b] = childEls(el);
      return `\\frac{${convEl(a)}}{${convEl(b)}}`;
    }
    case 'msqrt':
      return `\\sqrt{${convAll(el)}}`;
    case 'mroot': {
      const [base, idx] = childEls(el);
      return `\\sqrt[${convEl(idx)}]{${convEl(base)}}`;
    }

    // ---- 上下标 / 上下限 ----
    case 'msup': {
      const [base, sup] = childEls(el);
      return `${wrapBase(convEl(base))}^{${convEl(sup)}}`;
    }
    case 'msub': {
      const [base, sub] = childEls(el);
      return `${wrapBase(convEl(base))}_{${convEl(sub)}}`;
    }
    case 'msubsup': {
      const [base, sub, sup] = childEls(el);
      return `${wrapBase(convEl(base))}_{${convEl(sub)}}^{${convEl(sup)}}`;
    }
    case 'mover': {
      const [base, over] = childEls(el);
      const op = String(over && over.textContent || '').trim();
      const accMap = { '→': '\\vec', '\u20d7': '\\vec', '^': '\\hat', '−': '\\bar', '‾': '\\bar', '~': '\\tilde', '˙': '\\dot', '¨': '\\ddot' };
      if (accMap[op]) return `${accMap[op]}{${convEl(base)}}`;
      if (/^[\^\-‾‾¯]?$/.test(op) && op) return `\\bar{${convEl(base)}}`;
      return `\\overset{${convEl(over)}}{${convEl(base)}}`;
    }
    case 'munder': {
      const [base, under] = childEls(el);
      const op = String(under && under.textContent || '').trim();
      if (/^[_‾¯]+$/.test(op)) return `\\underline{${convEl(base)}}`;
      return `\\underset{${convEl(under)}}{${convEl(base)}}`;
    }
    case 'munderover': {
      const [base, under, over] = childEls(el);
      const b = convEl(base);
      const u = convEl(under);
      const o = convEl(over);
      return `${b}${u ? `_{${u}}` : ''}${o ? `^{${o}}` : ''}`;
    }

    // ---- 括号定界（含自定义分隔符） ----
    case 'mfenced': {
      const open = attr(el, 'open');
      const close = attr(el, 'close');
      const seps = attr(el, 'separators');
      return fencedLatex(open == null ? '(' : open, close == null ? ')' : close, seps, childEls(el).map((c) => convEl(c)));
    }

    // ---- 表格 / 矩阵 ----
    case 'mtable': {
      const rows = childEls(el).filter((r) => local(r) === 'mtr').map((tr) => {
        const cells = childEls(tr).filter((c) => local(c) === 'mtd').map((td) => convAll(td));
        return cells.join(' & ');
      });
      if (!rows.length) return convAll(el);
      return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
    }
    case 'mtr': case 'mtd':
      return convAll(el);

    // ---- 加框 / 划线 ----
    case 'menclose': {
      const notation = String(attr(el, 'notation') || '').toLowerCase();
      const body = convAll(el);
      if (notation.includes('radical')) return `\\sqrt{${body}}`;
      if (notation.includes('box')) return `\\boxed{${body}}`;
      if (notation.includes('updiagonalstrike')) return `\\cancel{${body}}`;
      return body;
    }

    // ---- 直立文本（mstyle mathvariant 等） ----
    case 'merror':
      return convAll(el); // 渲染端的错误标记：只取内容，不把 MathML 报错带进正文

    // ---- 未登记元素：透明递归（保内容不丢字） ----
    default:
      return convAll(el);
  }
};

const convEl = (el) => {
  try {
    return mathmlElementToLatex(el);
  } catch {
    return '';
  }
};

/**
 * MathML 字符串 → LaTeX（不含 $ 定界符）
 * @param {string|Element} input
 * @returns {string|null} LaTeX；无法解析/为空时返回 null（调用方须保留原文）
 */
export const mathmlToLatex = (input) => {
  let root = input;
  if (typeof input === 'string') root = parseMathML(input);
  if (!root) return null;
  // 🔴 兜底校验收窄：宽松 HTML 解析会把 `<math><mfrac>` 这类**截断片段**自动补全成
  //    `<mfrac></mfrac>`，从而静默产出空结构 `\frac{}{}`（比不转换更糟——用户拿到假公式）。
  //    真公式必有可见文本；无任何文本即判不可还原，返回 null 让调用方保留原文。
  if (!String(root.textContent || '').trim()) return null;
  const latex = convEl(root).replace(/\s+/g, ' ').trim();
  return latex || null;
};

export default { mathmlToLatex, mathmlElementToLatex, parseMathML, MATHML_NS };
