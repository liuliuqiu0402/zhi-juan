/**
 * 公式定界语法（`$…$` 行内 / `$$…$$` 块级）——**单一事实源**
 * ============================================================
 * 🔴 为什么单独立一个文件：这套定界语法有多个消费者，各写一份必然漂移
 *    （本项目已有"同构副本各自演化"的历史教训）。消费者：
 *      - utils/mathRender.renderMathInHtml  → 屏幕/PDF 渲染（KaTeX）
 *      - utils/docxBuilder                  → Word 导出（docx 公式对象 / Unicode 降级）
 *    且渲染端依赖 katex（数百 KB）、导出端不依赖 —— 共享语法若挂在 mathRender 上，
 *    会把 katex 无谓地拖进导出 chunk。故语法独立成**零依赖**模块。
 * ============================================================
 */

/** 行内 `$...$` / 块级 `$$...$$`（块级在前，避免 `$$` 被行内规则先吃掉一半） */
export const MATH_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/**
 * 编辑器公式装饰层 widget 的标记属性。
 * 🔴 放在本模块（零依赖）而不是 mathPreview.js：docxBuilder 需要识别该 widget，
 *    而 mathPreview.js 依赖 Tiptap —— 若从那边引，会把整个 Tiptap 拖进导出 chunk。
 */
export const MATH_PREVIEW_ATTR = 'data-math-preview';
export const MATH_LATEX_ATTR = 'data-math-latex';
export const MATH_DISPLAY_ATTR = 'data-math-display';

/**
 * 编辑器公式装饰层"隐藏源码"的类名。
 * inline 装饰给 `$…$` 源码加此类（视觉隐藏、DOM 仍在），由同级 widget 渲染公式；
 * 内容读取边界用 restoreMathPreviewSource 拆掉该 span（否则导出/预览会把公式藏起来）。
 */
export const MATH_SRC_CLASS = 'zwg-math-src';

/**
 * 把纯文本按公式切段。
 * @param {string} text
 * @returns {Array<{text:string}|{math:true, latex:string, display:boolean, raw:string}>}
 *   `raw` 为**原始匹配文本**（含定界符与内部空白，如 `$$ x $$`）——顺序拼接即可还原原文；
 *   编辑器公式装饰需要精确字符区间（latex 已 trim，长度与原文不等）。
 */
export const splitMathSegments = (text) => {
  const src = String(text == null ? '' : text);
  if (!src || src.indexOf('$') === -1) return src ? [{ text: src }] : [];
  const out = [];
  let last = 0;
  MATH_RE.lastIndex = 0;
  let m;
  while ((m = MATH_RE.exec(src)) !== null) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    const display = m[1] != null;
    const latex = String(display ? m[1] : m[2]).trim();
    // 空公式（如 "$$"）不成段，原样留作文本，避免产出空结构
    if (latex) out.push({ math: true, latex, display, raw: m[0] });
    else out.push({ text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
};

export default { MATH_RE, splitMathSegments };
