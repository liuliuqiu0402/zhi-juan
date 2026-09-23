/**
 * 剪贴板 → 内部文本形态（目录导入 / 纯文本框粘贴）
 * ============================================================
 * 🔴 解决什么（2026-09 用户实证，两次同一类）：把外部内容"带进来"后公式只剩字母和加减号
 *    —— `√(ab) ⩽ (a+b)/2` 变成 `ab a+b 2`。
 *    根因永远是同一个：拿的是剪贴板的**纯文本**版本；Word 给纯文本时只会把公式线性化成裸字符。
 *    而同一份剪贴板的 `text/html` 版本里带着 OMML（与编辑器粘贴完全同源），
 *    正是 `utils/pastedMath` 早就能还原成 `$…$` 的那份数据。
 *
 * 🔴 分工（单一事实源，绝不另写一套转换器）：
 *    · OMML/MathML → LaTeX、读剪贴板 → `utils/pastedMath`（`convertPastedMathInHtml` / `readClipboardRich`）；
 *    · 本模块只做两件事：① HTML → "一行一条/保留段落"的文本；② 纯文本框的保公式粘贴接管。
 *
 * 🔴 两条取数通路，用哪条看入口性质：
 *    · **按钮式导入**（用户点了按钮，没有 paste 事件）→ `readTocTextFromClipboard()`
 *      （异步剪贴板 API，可能被权限拒；只处理目录这种"一行一条"的文本）
 *    · **用户在 textarea 里 Ctrl+V** → `handleMathPaste(e)`
 *      （paste 事件的 `clipboardData` 里**同步**就有 text/html，可同步判据 + 同步 preventDefault）
 * ============================================================
 */
import { readClipboardRich, hasPastedMath, convertPastedMathInHtml } from './pastedMath.js';

/** 这些标签的内部文字不是正文（Word 剪贴板 HTML 里带大量 <style>/<xml> 噪声） */
const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'HEAD', 'TITLE', 'META', 'LINK', 'XML', 'NOSCRIPT', 'BASE']);

/** 这些标签是"块"，前后要断行，否则目录条目会黏成一整行 */
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGURE',
  'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI',
  'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TFOOT', 'THEAD', 'TR', 'UL',
]);

/**
 * HTML → 纯文本（保留 `$…$` 公式原文）。
 * 只读提取，绝不回写；不依赖节点是否已渲染（用 detached 容器）。
 * @param {string} html
 * @param {{keepParagraphBreaks?: boolean}} [options]
 *   false（默认）= 紧凑模式：每行一条、去空行、行内空白折叠 —— 给"一行一条"的目录用；
 *   true = 正文模式：保留段落空行与行首缩进 —— 给教材原文这类正文用。
 * @returns {string} 无可用内容时返回 ''
 */
export const htmlToPlainLines = (html, options = {}) => {
  const keepParagraphBreaks = !!options.keepParagraphBreaks;
  const src = String(html == null ? '' : html);
  if (!src.trim()) return '';
  // 非浏览器环境（如纯 node 单测）直接退化，调用方自会回退纯文本
  if (typeof document === 'undefined' || !document.createElement) return '';

  const holder = document.createElement('div');
  holder.innerHTML = src;

  const out = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) { // TEXT_NODE
        out.push(child.data);
        continue;
      }
      if (child.nodeType !== 1) continue; // 注释等一律跳过
      const tag = child.tagName.toUpperCase();
      if (SKIP_TAGS.has(tag)) continue;
      if (tag === 'BR') { out.push('\n'); continue; }
      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock) out.push('\n');
      // 表格单元格之间补一个空格，避免"标题页码"黏在一起（如 "…(a, b ⩾0)55"）
      if (tag === 'TD' || tag === 'TH') out.push(' ');
      walk(child);
      if (isBlock) out.push('\n');
    }
  };
  walk(holder);

  const raw = out.join('')
    .replace(/\u00a0/g, ' ')                        // &nbsp;
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '');    // 零宽字符

  if (keepParagraphBreaks) {
    return raw
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')                   // 段间最多留一个空行
      .replace(/^\s+|\s+$/g, '');
  }

  return raw
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};

/**
 * 取「用于填目录的文本」——**目录导入的唯一入口**（画面上不许再各自读剪贴板）。
 * 优先给"带公式的 HTML 派生文本"，拿不到就给纯文本；失败/不可用时返回空串，**不抛异常**。
 * @returns {Promise<string>} 目录文本（一行一条，公式为 `$…$`）
 */
export const readTocTextFromClipboard = async () => {
  try {
    const clip = await readClipboardRich();
    if (!clip) return '';
    // 只有"确实还原出公式 + HTML 派生文本可用"时才换源（保守切换，理由见文件头）
    if (clip.html && clip.mathConverted && !hasPastedMath(clip.html)) {
      // 图片一律剥掉：Word 会在公式旁附兜底图，文字提取用不上，留着还会触发无谓的文件加载
      const text = htmlToPlainLines(clip.html.replace(/<img\b[^>]*>/gi, ''));
      if (text) {
        console.log('📐 剪贴板导入：已从富文本还原公式（$…$），换用 HTML 派生文本');
        return text;
      }
    }
    return clip.text || ''; // 回退纯文本（与改动前一致）
  } catch (e) {
    console.warn('剪贴板读取失败:', e?.message || e);
    return '';
  }
};

/** 在光标处替换/插入文本，并把变更同步回 v-model（Vue 监听的是 input 事件，直接改 .value 不会同步） */
const insertTextAtCaret = (el, text) => {
  const value = String(el.value == null ? '' : el.value);
  const start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
  const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : value.length;
  el.value = value.slice(0, start) + text + value.slice(end);
  const caret = start + text.length;
  try { el.setSelectionRange(caret, caret); } catch { /* 个别 input 类型不支持选区，忽略 */ }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * 纯文本框（`<textarea>`）的**保公式粘贴**——绑到 `@paste` 上即可。
 *
 * 🔴 为什么需要：textarea 只能收纯文本，浏览器默认粘贴给的正是**纯文本那一份**，
 *    Word 会把公式线性化 → 公式结构丢失（这就是"教材原文粘到纯文本框里只剩字母"的原因）。
 *    而 paste 事件的 `clipboardData` 里**同步**就有 `text/html`（带 OMML），
 *    因此可以同步判据 + 同步 `preventDefault`，不依赖剪贴板权限、也不会与默认粘贴打架。
 *
 * 🔴 宁缺勿错：没公式 / 解析失败 / 派生文本为空 → 一律**不接管**（返回 false，走浏览器默认粘贴），
 *    绝不因为公式处理失败而让一次普通粘贴失效。
 *
 * @param {ClipboardEvent} e
 * @returns {boolean} true = 已接管本次粘贴
 */
export const handleMathPaste = (e) => {
  const el = e && e.target;
  const html = e && e.clipboardData && typeof e.clipboardData.getData === 'function'
    ? e.clipboardData.getData('text/html')
    : '';
  if (!el || !html || !hasPastedMath(html)) return false;
  const converted = convertPastedMathInHtml(html);
  if (converted === html || hasPastedMath(converted)) return false; // 一个都没还原成功 → 交给默认粘贴
  const text = htmlToPlainLines(converted, { keepParagraphBreaks: true });
  if (!text) return false;
  e.preventDefault();
  insertTextAtCaret(el, text);
  return true;
};

/**
 * 剪贴板诊断（用户可自助触发）——一次说清"公式为什么没进来"。
 * 🔴 为什么要有：导入后的结果只有"公式在/不在"两种表象，而原因分三类，
 *    不看剪贴板内容无法区分；让用户点一下就能拿到结论，省掉反复来回。
 * @returns {Promise<string>} 供弹窗直接显示的多行文本
 */
export const diagnoseClipboard = async () => {
  const clip = await readClipboardRich();
  if (!clip) return '剪贴板为空，或读不到内容。\n\n请先复制内容再点诊断。';

  const fmt = (clip.formats || []).length ? clip.formats.join('、') : '未取到';
  const lines = [
    `读取通路：${clip.via === 'main' ? '主进程（Electron）' : '浏览器 API'}`,
    `剪贴板格式：${fmt}`,
    `富文本(HTML)：${clip.html ? `${clip.html.length} 字` : '无'}`,
    `纯文本：${clip.text ? `${clip.text.length} 字` : '无'}`,
  ];

  if (clip.mathConverted) {
    lines.push('', '公式结构：已还原为 LaTeX（$…$）——导入后可在目录里看到 $ 源码，展示处会渲染成印刷形态。');
  } else if (!clip.html) {
    lines.push('', '⚠️ 剪贴板里**没有富文本那一份**，只有纯文本。',
      'Word 给纯文本时会把公式线性化成裸字符（只剩字母和加减号），因此公式无法还原。',
      '建议：改用「📁 从文件导入」直接选 Word 文件——那条路拿的是文件本身，公式一定保住。');
  } else {
    lines.push('', '剪贴板有富文本，但里面**没有公式结构**（没找到 OMML/MathML）。',
      '若你的原文里有公式，说明复制来源给的 HTML 里公式是图片而不是公式对象。',
      '建议：改用「📁 从文件导入」直接选 Word 文件。');
  }
  return lines.join('\n');
};

export default { htmlToPlainLines, readTocTextFromClipboard, handleMathPaste, diagnoseClipboard };
