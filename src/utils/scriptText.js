/**
 * 上下标 → 文本（Unicode 优先，退化显式写法）——**单一事实源**
 * ============================================================
 * 🔴 解决什么（2026-09 P3 用户实证）：把 HTML 转纯文本喂给 AI 时，`x<sup>2</sup>` 被"清标签"
 *    通道拍平成 `x2`、化学式 `H<sub>2</sub>O` 拍平成 `H2O` —— AI 读到的公式是有歧义的
 *    （`x2` 到底是 x·2 还是 x²？`H2O` 也读不出下标）。此前这套映射散落在导出/校验等处。
 *
 * 🔴 为什么不直接丢字符：上下标承载**语义**（幂次、原子数、离子电荷）。故：
 *    ① 内容全部字符可映射 → 转 Unicode（`2`→`²`、`4`+`2-`→`₄²⁻`），最贴近教材印刷读法；
 *    ② 含汉字/多字符等无法 Unicode 化的（如化学条件"点燃"）→ 退回 `^(…)` / `_(…)` **显式**写法，
 *       结构不丢、语义可读；
 *    ③ 空内容 → 空串。
 *    绝不静默拍平成普通字符（那是不可逆的信息丢失）。
 * ============================================================
 */

/** 上标字符映射（含正负号/括号/常用字母） */
export const SUP_UNICODE = {
  0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ',
};

/** 下标字符映射（含正负号/括号/常用字母） */
export const SUB_UNICODE = {
  0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉',
  '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', n: 'ₙ', x: 'ₓ',
};

/**
 * 上下标内容 → 文本。
 * @param {string} inner 上下标内部（可含标签）
 * @param {Record<string,string>} map SUP_UNICODE / SUB_UNICODE
 * @param {'^'|'_'} marker 无法 Unicode 化时的显式标记
 */
export const scriptToText = (inner, map, marker) => {
  const t = String(inner == null ? '' : inner).replace(/<[^>]+>/g, '').trim();
  if (!t) return '';
  const chars = [...t];
  return chars.every((c) => map[c]) ? chars.map((c) => map[c]).join('') : `${marker}(${t})`;
};

/**
 * 把 HTML 里的上下标就地转为文本（其余标签不动，交给调用方照常清理）。
 * 覆盖两种写法：原生 `<sup>`/`<sub>`（Tiptap 上标 mark 的输出）与语义 span（`span.superscript`
 * / `span.subscript`，编辑器 PreserveSpan 保留的形态）。
 * 🔴 调用方必须在本步之后再做"清标签"，否则先被拍平、信息不可逆丢失。
 */
export const scriptsToText = (html) => String(html == null ? '' : html)
  .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, (_m, inner) => scriptToText(inner, SUP_UNICODE, '^'))
  .replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, (_m, inner) => scriptToText(inner, SUB_UNICODE, '_'))
  .replace(/<span[^>]*class="[^"]*\bsuperscript\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_m, inner) => scriptToText(inner, SUP_UNICODE, '^'))
  .replace(/<span[^>]*class="[^"]*\bsubscript\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_m, inner) => scriptToText(inner, SUB_UNICODE, '_'));

export default { SUP_UNICODE, SUB_UNICODE, scriptToText, scriptsToText };
