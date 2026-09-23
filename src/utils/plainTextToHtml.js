/**
 * 纯文本 → 编辑器可用的 HTML
 * ============================================================
 * 🔴 用在哪（2026-09）：原文编辑器（教材原文）新增「📁 导入文件」，
 *    .txt / .md 这类没有结构的文件要灌进富文本编辑器，必须先转成段落 HTML ——
 *    否则整份原文会挤成一行。
 *
 * 🔴 必须**先转义再拼标签**：文件内容属外部输入，直接拼进去等于把用户文件当 HTML 执行。
 *    转义用 utils/escape 的唯一实现（不得本地再写一份 esc）。
 * 🔴 刻意不动 `$…$`：公式以 LaTeX 原样保留，交给 mathRender/KaTeX 出印刷形态
 *    （全链路只有一种公式表示，与生成端、粘贴链路同源）。
 * ============================================================
 */
import { escapeHtml } from './escape.js';

/**
 * @param {string} text 纯文本（兼容 CRLF/BOM）
 * @returns {string} `<p>` 段落 HTML；空文本返回 ''
 */
export const plainTextToHtml = (text) => {
  const src = String(text == null ? '' : text)
    .replace(/^\uFEFF/, '')      // BOM
    .replace(/\r\n?/g, '\n');    // CRLF/CR → LF
  return src
    .split(/\n{2,}/)             // 空行分段
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
};

export default { plainTextToHtml };
