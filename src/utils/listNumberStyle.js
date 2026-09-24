/**
 * 有序列表「编号形式」**唯一事实源**（2026-09-24 用户："多几种数字形式"）
 * ============================================================
 * 一个编号形式要同时活在**四个地方**，此前只有前两个存在、且各写一份判断：
 *   ① 编辑器显示（CSS list-style-type / @counter-style）
 *   ② 编辑器"转文本"（列表 → 带编号的段落文本）
 *   ③ HTML / PDF 导出（浏览器渲染：原生 type 能认，自定义形式必须给 CSS）
 *   ④ Word 导出（docxBuilder：**不认 CSS**，按字面前缀写）
 * 所以本模块把「形式表 + 前缀生成 + CSS」收成一份：
 *   · 新增一种形式 = 在 NUMBER_FORMS 加一行（form 的自然语言样本）+（若为自定义形式）一条 counter-style。
 *   · 消费方：RichTextEditor（① ②）、themeConfig（③）、docxBuilder（④）。任何一处都不得再自建一份表。
 *
 * 🔴 一条硬约束（勿改成字面文本）：这些形式**必须写在列表结构上**（`<ol type="…">`），
 *    不能把编号写成行首文字——正文清洗链 `normalizeLeadingMarkers` 会把行首"项目符号+序号"剥掉。
 * ============================================================
 */

/** 有序列表形式表：value 写入 `<ol type>`；sample 供工具栏下拉直观展示 */
export const NUMBER_FORMS = [
  { value: '1', label: '阿拉伯数字', sample: '1.' },
  { value: 'a', label: '小写字母', sample: 'a.' },
  { value: 'A', label: '大写字母', sample: 'A.' },
  { value: 'i', label: '小写罗马', sample: 'i.' },
  { value: 'I', label: '大写罗马', sample: 'I.' },
  { value: 'paren', label: '括号数字', sample: '（1）' },
  { value: 'cjk', label: '中文数字', sample: '一、' },
  { value: 'circled', label: '圈号数字', sample: '①' },
];

/** 该值是否为"编号形式"（区别于无序列表的符号字符） */
export const isOrderedNumberStyle = (v) =>
  NUMBER_FORMS.some((f) => f.value === String(v ?? ''));

/** 阿拉伯数字 → 罗马数字（大小写由 form 决定，不在此处理） */
export const toRoman = (num) => {
  const TABLE = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let n = Math.max(1, Math.floor(Number(num) || 1));
  let out = '';
  for (const [v, s] of TABLE) { while (n >= v) { out += s; n -= v; } }
  return out;
};

/** 1-20 → ①②③…⑳（Unicode 圈号连续段）；超范围回退阿拉伯数字（宁降级不画错） */
export const toCircled = (n) => {
  const i = Math.floor(Number(n) || 0);
  return i >= 1 && i <= 20 ? String.fromCharCode(0x2460 + i - 1) : String(i);
};

/** 阿拉伯数字 → 中文数字（一、二、…十一…二十；超出常用范围回退阿拉伯数字） */
export const toChineseNumeral = (n) => {
  const i = Math.floor(Number(n) || 0);
  const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (i <= 0 || i > 99) return String(i);
  if (i < 10) return DIGITS[i];
  const tens = Math.floor(i / 10), ones = i % 10;
  return `${tens === 1 ? '' : DIGITS[tens]}十${ones ? DIGITS[ones] : ''}`;
};

/**
 * 列表项编号前缀（**字面文本**，供 Word 导出与编辑器"转文本"共用）。
 * @param {string} style 形式值（NUMBER_FORMS.value）
 * @param {number} index 1 基序号
 */
export const orderedPrefix = (style, index) => {
  const i = Math.max(1, Math.floor(Number(index) || 1));
  switch (String(style)) {
    case 'a': return `${String.fromCharCode(97 + ((i - 1) % 26))}. `;
    case 'A': return `${String.fromCharCode(65 + ((i - 1) % 26))}. `;
    case 'i': return `${toRoman(i).toLowerCase()}. `;
    case 'I': return `${toRoman(i)}. `;
    case 'paren': return `（${i}）`;
    case 'cjk': return `${toChineseNumeral(i)}、`;
    case 'circled': return toCircled(i);
    case '1':
    default: return `${i}. `;
  }
};

/**
 * 导出/编辑器共用的编号样式表（③ 与 ①）。
 * 原生形式（1/a/A/i/I）浏览器本就能渲染，此处一并写出以求四处口径显式一致；
 * 自定义形式（paren/cjk/circled）必须靠 `@counter-style` —— HTML `type` 属性没有这些取值。
 */
export const LIST_NUMBER_CSS = `
  /* ── 有序列表编号形式（唯一事实源：src/utils/listNumberStyle.js）── */
  @counter-style k-paren { system: extends decimal; prefix: "（"; suffix: "）"; }
  @counter-style k-cjk { system: extends cjk-ideographic; suffix: "、"; }
  @counter-style k-circled {
    system: numeric;
    symbols: "①" "②" "③" "④" "⑤" "⑥" "⑦" "⑧" "⑨" "⑩"
             "⑪" "⑫" "⑬" "⑭" "⑮" "⑯" "⑰" "⑱" "⑲" "⑳";
    suffix: " ";
  }
  ol[type="1"], ol:not([type]) { list-style-type: decimal; }
  ol[type="a"] { list-style-type: lower-alpha; }
  ol[type="A"] { list-style-type: upper-alpha; }
  ol[type="i"] { list-style-type: lower-roman; }
  ol[type="I"] { list-style-type: upper-roman; }
  ol[type="paren"] { list-style-type: k-paren; }
  ol[type="cjk"] { list-style-type: k-cjk; }
  ol[type="circled"] { list-style-type: k-circled; }
`;

/** 编辑器侧：把编号样式注入文档一次（导出侧由 themeConfig 直接内联，不走这里） */
export const LIST_NUMBER_STYLE_ID = 'k-list-number-style';
export const ensureListNumberStyleInjected = (doc) => {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d || typeof d.createElement !== 'function') return false;
  if (d.getElementById?.(LIST_NUMBER_STYLE_ID)) return false;
  const el = d.createElement('style');
  el.id = LIST_NUMBER_STYLE_ID;
  el.textContent = LIST_NUMBER_CSS;
  (d.head || d.documentElement)?.appendChild(el);
  return true;
};

export default {
  NUMBER_FORMS, isOrderedNumberStyle, orderedPrefix, LIST_NUMBER_CSS,
  LIST_NUMBER_STYLE_ID, ensureListNumberStyleInjected,
  toRoman, toCircled, toChineseNumeral,
};
