/**
 * 目录导入：把剪贴板内容转成「一行一条的目录文本」
 * ============================================================
 * 🔴 解决什么（2026-09 用户实证）：上传教材 → 确认目录结构 →「📋 从剪贴板导入」，
 *    目录里的公式只剩字母和加减号 —— `√(ab) ⩽ (a+b)/2` 变成 `ab a+b 2`，
 *    根号、分数线、不等号全丢。
 *
 *    根因：该入口此前只读剪贴板的**纯文本**版本（`readText()`）；
 *    而 Word 给纯文本时只会把公式线性化成裸字符（结构符号必然丢失）。
 *    但**同一份剪贴板的 `text/html` 版本里带着 OMML**（与编辑器粘贴完全同源），
 *    正是 `utils/pastedMath` 已经能还原成 `$…$` 的那份数据 —— 白白没用上。
 *
 * 🔴 分工（单一事实源，绝不另写一套转换器）：
 *    · 读剪贴板 + 公式还原 → `utils/pastedMath.readClipboardRich`（**唯一入口**，别再各写一份）；
 *    · 本模块只负责"把还原后的 HTML 压成一行一条的目录文本"这一件事。
 *
 * 🔴 宁缺勿错（保守切换）：**只有确实从 HTML 里还原出了公式**才改用 HTML 派生文本；
 *    其余情况一律返回空串、由调用方回退纯文本 —— 不改变现有成功路径的行为，
 *    只在"能多拿回公式"时才换源。（HTML 派生文本万一结构与纯文本不同，也不会波及无公式的目录。）
 * ============================================================
 */
import { readClipboardRich, hasPastedMath } from './pastedMath.js';

/** 这些标签的内部文字不是正文（Word 剪贴板 HTML 里带大量 <style>/<xml> 噪声） */
const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'HEAD', 'TITLE', 'META', 'LINK', 'XML', 'NOSCRIPT', 'BASE']);

/** 这些标签是"块"，前后要断行，否则目录条目会黏成一整行 */
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGURE',
  'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI',
  'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TFOOT', 'THEAD', 'TR', 'UL',
]);

/**
 * HTML → 按行组织的纯文本（保留 `$…$` 公式原文，字段间以空格分隔）。
 * 只读提取，绝不回写；不依赖 `innerHTML` 的渲染结果（用 detached 容器）。
 * @param {string} html
 * @returns {string} 每行一条、已去首尾空白与空行；无可用内容时返回 ''
 */
export const htmlToPlainLines = (html) => {
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

  return out.join('')
    .replace(/\u00a0/g, ' ')                        // &nbsp;
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')     // 零宽字符
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
        console.log('📐 目录导入：已从剪贴板富文本还原公式（$…$），换用 HTML 派生文本');
        return text;
      }
    }
    return clip.text || ''; // 回退纯文本（与改动前一致）
  } catch (e) {
    console.warn('目录导入：剪贴板读取失败:', e?.message || e);
    return '';
  }
};

export default { htmlToPlainLines, readTocTextFromClipboard };
