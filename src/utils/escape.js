/**
 * HTML/XML 转义与实体解码（共享）
 * ============================================================
 * 🔴 曾分散于 themeConfig/drawingMLShapes/GenerateModule/docxBuilder 等 5+ 处同构实现
 *    （escHtml/escXml/esc/escGraph + 3 条实体解码链），任一侧补 ' 或换行策略即分叉；
 *    现收敛为本文件唯一实现。XML 与 HTML 文本节点/双引号属性场景可共用同一 4 字符映射
 *    （& < > "；' 无需转义：XML 双引号属性与 HTML 文本均合法）。
 * ============================================================
 */

/** HTML/XML 转义（& < > " → 命名实体；null/undefined → ''） */
export const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** XML 文本/属性转义：与 escapeHtml 同 4 字符映射（双引号属性用 &quot; 合法） */
export const escapeXml = escapeHtml;

/** 实体解码（&amp; &lt; &gt; &quot; → 原字符；供 data-* 私有格式回读） */
export const decodeEntities = (s) => String(s == null ? '' : s)
  .split('&amp;').join('&')
  .split('&lt;').join('<')
  .split('&gt;').join('>')
  .split('&quot;').join('"');

export default { escapeHtml, escapeXml, decodeEntities };
