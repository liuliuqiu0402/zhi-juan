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
 * 把纯文本按公式切段。
 * @param {string} text
 * @returns {Array<{text:string}|{math:true, latex:string, display:boolean}>} 顺序拼接即还原原文
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
    if (latex) out.push({ math: true, latex, display });
    else out.push({ text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
};

export default { MATH_RE, splitMathSegments };
