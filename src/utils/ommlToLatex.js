/**
 * OMML → LaTeX（Word 公式粘贴还原）
 * ============================================================
 * 🔴 为什么需要（2026-09 用户实证）：教材公式从 Word 复制时，剪贴板 HTML 里给的是 **OMML**
 *    （Office Math Markup Language，与 .docx 内部同一套 XML，命名空间 .../officeDocument/2006/math），
 *    并且它被塞在 MSO **条件注释**里（`<!--[if gte mso 9]><m:oMath>…`），旁边再放一张渲染好的兜底图片。
 *    此前本项目的粘贴链路对 `<m:oMath>` 毫无处理：ProseMirror 解析时把未知标签剥掉，只留下
 *    `<m:t>` 里的碎文本（分式塌成一行、上下标错位）——即"教材印刷样式粘贴进来就没了"。
 *
 * 🔴 与渲染端的分工：本模块只做**格式还原**（OMML → LaTeX 字符串），不做视觉渲染。
 *    产出的 LaTeX 交给既有的 `$…$` 通道（utils/mathRender.renderMathInHtml 用 KaTeX 出印刷形态），
 *    与生成端 FORMULA_RULES 约定的公式写法同源 —— 全链路只有一种公式表示。
 *
 * 🔴 解析方式：Word 的片段只有前缀没有命名空间声明，直接按 XML 解析会报"未声明前缀"。
 *    故包一层带声明的 <root> 再解析；解析失败一律返回 null（调用方保留原文，绝不因公式毁掉整段粘贴）。
 *    元素匹配统一按 `localName`（不依赖 m:/w: 前缀写法）。
 *
 * 支持范围（覆盖教材常见形态）：分式、上下标/上下标并排、前置上下标、根式（含 n 次方）、
 * 括号定界（含自定义定界符）、n 元算子（∑∏∫∮∪∩）、函数、极限/上下限、重音、上/下划线、
 * 矩阵、方程组、有无框、占位。未知元素**透明递归**（保内容不保结构），保证不丢字。
 * ============================================================
 */

const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
// Word 片段常同时出现这些前缀；一并声明，避免"未声明前缀"导致整体解析失败
const NS_DECL = [
  `xmlns:m="${M_NS}"`,
  'xmlns:w="urn:schemas-microsoft-com:office:word"',
  'xmlns:o="urn:schemas-microsoft-com:office:office"',
  'xmlns:v="urn:schemas-microsoft-com:vml"',
].join(' ');

// ==================== DOM 小工具（统一按 localName 匹配） ====================

const childList = (el) => (el && el.children ? Array.from(el.children) : []);
const kid = (el, name) => childList(el).find((c) => c.localName === name) || null;
const kidsOf = (el, name) => childList(el).filter((c) => c.localName === name);
const attr = (el, name) => (el && el.getAttribute ? el.getAttribute(name) : null);
/** m:val 形式的属性值（OMML 把值放在 m:val 上） */
const val = (el) => {
  const v = attr(el, 'm:val') ?? attr(el, 'val');
  return v == null ? '' : v;
};

/** 解析 OMML 字符串 → 根元素（失败返回 null，调用方须保留原文） */
export const parseOmml = (src) => {
  const s = String(src == null ? '' : src).trim();
  if (!s || typeof DOMParser === 'undefined') return null;
  try {
    const doc = new DOMParser().parseFromString(`<root ${NS_DECL}>${s}</root>`, 'application/xml');
    if (!doc || doc.getElementsByTagName('parsererror').length) return null;
    return doc.documentElement;
  } catch {
    return null;
  }
};

// ==================== 字符映射 ====================

/** 文本 → LaTeX 安全形态：CJK 包 \text{}（化学条件等），LaTeX 保留字符转义 */
const CJK_RE = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;
const LATEX_SPECIAL = /[\\{}$&#^_%~]/;

const escapeRunText = (raw) => {
  const text = String(raw == null ? '' : raw).replace(/[\u200b\u200c\u200d\ufeff]/g, ''); // 去零宽字符
  if (!text) return '';
  if (CJK_RE.test(text)) {
    // 中文/全角（如化学方程式的「点燃」「催化剂」）作正体文字，且内部特殊字符转义
    return `\\text{${text.replace(/([\\{}$&#^_%~])/g, '\\$1')}}`;
  }
  if (!LATEX_SPECIAL.test(text)) return text;
  return text.replace(/([\\{}$&#^_%~])/g, '\\$1');
};

/** OMML 里用 Unicode 数学符号书写的运算符 → LaTeX 命令（未列出的原样透传）
 *  🔴 ⩽/⩾（U+2A7D/U+2A7E）是**中文教材印刷体的规范不等号**，Word 公式里以裸字符出现。
 *     必须显式映射成 `\leqslant`：否则它在 LaTeX 里是"未登记的裸 Unicode"，
 *     虽然 KaTeX 多半能认，但会与 AI 产出的 `\leqslant` 形成**两种写法**（本项目红线：一种公式一种表示）。 */
const SYMBOL_MAP = {
  '−': '-', '\u2212': '-', '⋅': '\\cdot ', '\u22c5': '\\cdot ',
  '×': '\\times ', '÷': '\\div ', '±': '\\pm ', '∓': '\\mp ',
  '≤': '\\leq ', '≥': '\\geq ', '⩽': '\\leqslant ', '⩾': '\\geqslant ',
  '≠': '\\neq ', '≈': '\\approx ',
  '∞': '\\infty ', '→': '\\rightarrow ', '←': '\\leftarrow ',
  '⇒': '\\Rightarrow ', '⇌': '\\rightleftharpoons ', '∈': '\\in ', '∉': '\\notin ',
  '∠': '\\angle ', '⊥': '\\perp ', '∥': '\\parallel ', '△': '\\triangle ',
  '°': '^{\\circ }',
};

/** n 元算子字符 → LaTeX 命令 */
const NARY_MAP = {
  '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint',
  '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap', '⨄': '\\biguplus',
};
const DEFAULT_NARY = '\\int';

/** 命名函数（OMML m:func 的 fName 文本 → LaTeX 命令），未命中走 \operatorname */
const FUNC_MAP = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', csc: '\\csc',
  arcsin: '\\arcsin', arccos: '\\arccos', arctan: '\\arctan',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh',
  log: '\\log', ln: '\\ln', lg: '\\lg', exp: '\\exp', det: '\\det', dim: '\\dim',
  max: '\\max', min: '\\min', gcd: '\\gcd', deg: '\\deg',
};

/** 重音字符（m:acc 的 m:chr）→ LaTeX 命令 */
const ACC_MAP = {
  '\u20d7': '\\vec', '\u0303': '\\tilde', '~': '\\tilde',
  '\u0304': '\\bar', '\u0305': '\\bar', '\u00af': '\\bar', '\u2013': '\\bar',
  '\u0302': '\\hat', '^': '\\hat', '\u0307': '\\dot', '\u0308': '\\ddot',
  '\u0301': '\\acute', '\u0300': '\\grave', '\u030c': '\\check', '\u0306': '\\breve',
};

/** 定界符字符 → LaTeX（左右括号需转义花括号/竖线成对语义） */
const delimToLatex = (chr, side) => {
  const c = String(chr || '').trim();
  const map = {
    '(': '(', ')': ')', '[': '[', ']': ']',
    '{': '\\{', '}': '\\}',
    '|': '|', '‖': '\\|', '∥': '\\|',
    '⌈': '\\lceil', '⌉': '\\rceil', '⌊': '\\lfloor', '⌋': '\\rfloor',
    '⟨': '\\langle', '⟩': '\\rangle', '〈': '\\langle', '〉': '\\rangle',
  };
  if (c === '') return side === 'beg' ? '.' : '.';
  return map[c] || c;
};

// ==================== 主转换 ====================

/** 容器内所有子元素依次转换后拼接 */
const convAll = (el) => childList(el).map(conv).join('');

/**
 * run 文本 → LaTeX：**单趟扫描**——Unicode 数学符号出命令、LaTeX 保留字符就地转义。
 * 🔴 必须一趟处理：曾写成"先整体映射符号、再整体转义"，于是刚生成的 `\times` 里那个反斜杠
 *    被二次转义成 `\\times`（渲染成"两行"而非乘号）——实测由本模块单测抓出。
 */
const runTextToLatex = (raw) => {
  const text = String(raw == null ? '' : raw).replace(/[\u200b\u200c\u200d\ufeff]/g, '');
  if (!text) return '';
  if (CJK_RE.test(text)) return `\\text{${text.replace(/([\\{}$&#^_%~])/g, '\\$1')}}`;
  let out = '';
  for (const ch of text) {
    const mapped = SYMBOL_MAP[ch];
    if (mapped) { out += mapped; continue; }
    out += /[\\{}$&#^_%~]/.test(ch) ? `\\${ch}` : ch;
  }
  return out.replace(/\s+/g, ' ').trim();
};

/** m:r（run）：取 m:t 文本，按 m:rPr/m:sty 判断是否正体 */
const convRun = (el) => {
  const raw = kidsOf(el, 't').map((t) => t.textContent || '').join('');
  if (!raw) return '';
  const rPr = kid(el, 'rPr');
  const nor = rPr ? kid(rPr, 'nor') || kid(rPr, 'sty') : null;
  const upright = nor ? /^(p|b)$/i.test(val(nor)) : false;
  const out = runTextToLatex(raw);
  if (upright && out && !CJK_RE.test(out)) return `\\mathrm{${out}}`;
  return out;
};

/** 取元素文本（用于函数名/算子判断等） */
const plainText = (el) => {
  if (!el) return '';
  return kidsOf(el, 't').map((t) => t.textContent || '').join('') || el.textContent || '';
};

/** 递归转换单个 OMML 元素 → LaTeX */
export const ommlElementToLatex = (el) => {
  if (!el || el.nodeType !== 1) return '';
  const name = el.localName;

  switch (name) {
    // ---- 透明容器（只保内容） ----
    case 'oMath':
    case 'oMathPara':
    case 'e':
    case 'num':
    case 'den':
    case 'sub':
    case 'sup':
    case 'deg':
    case 'fName':
    case 'lim':
      return convAll(el);
    case 'ctrlPr':
    case 'rPr':
    case 'fPr':
    case 'dPr':
    case 'radPr':
    case 'naryPr':
    case 'funcPr':
    case 'accPr':
    case 'barPr':
    case 'mPr':
    case 'eqArrPr':
    case 'boxPr':
    case 'borderBoxPr':
    case 'groupChrPr':
    case 'phantPr':
    case 'sSupPr':
    case 'sSubPr':
    case 'sSubSupPr':
    case 'sPrePr':
    case 'limLowPr':
    case 'limUppPr':
    case 'argPr':
    case 'mcPr':
    case 'mcJc':
    case 'brk':
    case 'aln':
      return ''; // 属性/控制元素：不产生可见内容

    // ---- 文本 ----
    case 'r':
      return convRun(el);
    case 't':
      return escapeRunText(el.textContent || '');

    // ---- 分式 ----
    case 'f': {
      const num = conv(kid(el, 'num'));
      const den = conv(kid(el, 'den'));
      return `\\frac{${num}}{${den}}`;
    }

    // ---- 上下标 ----
    case 'sSup': {
      const base = conv(kid(el, 'e'));
      return `${wrapBase(base)}^{${conv(kid(el, 'sup'))}}`;
    }
    case 'sSub': {
      const base = conv(kid(el, 'e'));
      return `${wrapBase(base)}_{${conv(kid(el, 'sub'))}}`;
    }
    case 'sSubSup': {
      const base = conv(kid(el, 'e'));
      return `${wrapBase(base)}_{${conv(kid(el, 'sub'))}}^{${conv(kid(el, 'sup'))}}`;
    }
    case 'sPre': {
      // 前置上下标：KaTeX 无 \prescript，用空基近似
      const base = conv(kid(el, 'e'));
      return `{}_{${conv(kid(el, 'sub'))}}^{${conv(kid(el, 'sup'))}}${wrapBase(base)}`;
    }

    // ---- 根式 ----
    case 'rad': {
      const deg = conv(kid(el, 'deg'));
      const body = conv(kid(el, 'e'));
      return deg ? `\\sqrt[${deg}]{${body}}` : `\\sqrt{${body}}`;
    }

    // ---- 括号定界 ----
    case 'd': {
      const pr = kid(el, 'dPr');
      const beg = pr ? val(kid(pr, 'begChr')) : '';
      const end = pr ? val(kid(pr, 'endChr')) : '';
      const items = kidsOf(el, 'e').map(conv);
      const inner = items.join(',');
      const lo = delimToLatex(beg || '(', 'beg');
      const ro = delimToLatex(end || ')', 'end');
      return `\\left${lo || '.'}${inner}\\right${ro || '.'}`;
    }

    // ---- n 元算子（∑∏∫…） ----
    case 'nary': {
      const pr = kid(el, 'naryPr');
      const chr = pr ? val(kid(pr, 'chr')) : '';
      const op = NARY_MAP[String(chr || '').trim()] || (String(chr || '').trim() || DEFAULT_NARY);
      const sub = conv(kid(el, 'sub'));
      const sup = conv(kid(el, 'sup'));
      const body = conv(kid(el, 'e'));
      const lim = `${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}`;
      return `${op}${lim}${body ? ` ${body}` : ''}`;
    }

    // ---- 函数 ----
    case 'func': {
      const fnameRaw = plainText(kid(el, 'fName')).trim();
      const fn = FUNC_MAP[fnameRaw.toLowerCase()] || (fnameRaw ? `\\operatorname{${escapeRunText(fnameRaw)}}` : '');
      const body = conv(kid(el, 'e'));
      return `${fn}{${body}}`;
    }

    // ---- 极限 / 上下限 ----
    case 'limLow': {
      const base = conv(kid(el, 'e'));
      const txt = plainText(kid(el, 'e')).trim().toLowerCase();
      const fn = FUNC_MAP[txt] || (txt === 'lim' ? '\\lim' : '');
      const lim = conv(kid(el, 'lim'));
      return fn ? `${fn}_{${lim}}` : `${wrapBase(base)}_{${lim}}`;
    }
    case 'limUpp': {
      const base = conv(kid(el, 'e'));
      const lim = conv(kid(el, 'lim'));
      return `${wrapBase(base)}^{${lim}}`;
    }

    // ---- 重音 ----
    case 'acc': {
      const pr = kid(el, 'accPr');
      const chr = pr ? val(kid(pr, 'chr')) : '';
      const cmd = ACC_MAP[String(chr || '').trim()];
      const body = conv(kid(el, 'e'));
      if (cmd) return `${cmd}{${body}}`;
      const ch = String(chr || '').trim();
      return ch ? `\\overset{${escapeRunText(ch)}}{${body}}` : body;
    }

    // ---- 上划线 / 下划线 ----
    case 'bar': {
      const pr = kid(el, 'barPr');
      const pos = pr ? val(kid(pr, 'pos')) : '';
      const body = conv(kid(el, 'e'));
      return String(pos).toLowerCase() === 'bot' ? `\\underline{${body}}` : `\\overline{${body}}`;
    }

    // ---- 矩阵 ----
    case 'm': {
      const rows = kidsOf(el, 'mr').map((mr) => kidsOf(mr, 'e').map(conv).join(' & '));
      if (!rows.length) return convAll(el);
      return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
    }

    // ---- 方程组（等号对齐） ----
    case 'eqArr': {
      const rows = kidsOf(el, 'e').map(conv);
      if (!rows.length) return convAll(el);
      return `\\begin{aligned}${rows.join(' \\\\ ')}\\end{aligned}`;
    }

    // ---- 花括号/上下大括号 ----
    case 'groupChr': {
      const pr = kid(el, 'groupChrPr');
      const pos = pr ? val(kid(pr, 'pos')) : '';
      const body = conv(kid(el, 'e'));
      return String(pos).toLowerCase() === 'bot' ? `\\underbrace{${body}}` : `\\overbrace{${body}}`;
    }

    // ---- 有无框 / 占位 ----
    case 'box':
    case 'borderBox':
      return conv(kid(el, 'e')) || convAll(el);
    case 'phant':
      return `\\phantom{${conv(kid(el, 'e'))}}`;

    // ---- 未登记元素：透明递归（保内容不丢字） ----
    default:
      return convAll(el);
  }
};

/** 单字符/单命令基座不需要花括号包；其余加括号，避免 `^` 只作用到第一个字符 */
const wrapBase = (s) => {
  const t = String(s || '');
  if (!t) return '';
  return t.length <= 1 ? t : `{${t}}`;
};

const conv = (el) => {
  try {
    return ommlElementToLatex(el);
  } catch {
    return '';
  }
};

/**
 * OMML 字符串 → LaTeX（不含 $ 定界符）
 * @param {string|Element} input  OMML 片段或已解析元素
 * @returns {string|null} LaTeX；无法解析/为空时返回 null（调用方须保留原文）
 */
export const ommlToLatex = (input) => {
  let root = input;
  if (typeof input === 'string') root = parseOmml(input);
  if (!root) return null;
  const latex = (root.localName === 'root' ? convAll(root) : conv(root))
    .replace(/\s+/g, ' ')
    .trim();
  return latex || null;
};

export default { ommlToLatex, ommlElementToLatex, parseOmml };
