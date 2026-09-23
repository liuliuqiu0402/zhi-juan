/**
 * 编辑器内公式实时渲染（KaTeX 装饰层）
 * ============================================================
 * 🔴 解决什么（2026-09 用户实证）：编辑器里公式一直显示 `$\frac{a}{b}$` 源码 —— 前面链路
 *    （渲染/粘贴/Word）都修好了，但用户在**编辑器**这个每天打交道的界面里看不到效果，
 *    会直接判定"公式没保留"。
 *
 * 🔴 为什么用 ProseMirror **装饰（Decoration）**而不是自定义节点：
 *    装饰只影响"视图"，**不改文档内容**。文档里存的仍是 `$…$` 纯文本，
 *    因此 rawText 派生、内容清洗、docx、PDF、预览等全部下游链路**零改动**——
 *    这是本仓库最容易出连带事故的地方（编辑器 schema 一动，导出/粘贴/清洗全受牵连）。
 *
 * 🔴 为什么是「inline 隐藏源码 + widget 渲染」而不是"替换型装饰"：
 *    prosemirror-view 1.41 已**移除** `Decoration.replace`（实测只剩 widget/inline/node）。
 *    改用等价组合后反而更稳：**源码文本仍留在真实 DOM 里**，只有视觉被隐藏 ——
 *    任何尚未适配的读取路径都不会"读不到公式"。
 *
 * 🔴 三道保险（缺一就会出现重复或乱码）：
 *    ① CSS：`.zwg-math-src{display:none}` 放在 MATH_CSS（单一事实源，应用内与导出都注入）
 *    ② `restoreMathPreviewSource()`：内容读取边界把 widget 移除、把隐藏 span 拆掉，
 *       还原成与"从未渲染过"一致的 HTML（TypesetModule / getDomHTML 已接）
 *    ③ `docxBuilder` 兜底：识别 `[data-math-preview]` 按 data-math-latex 出真公式，
 *       并跳过 `.zwg-math-src` 隐藏源码 —— 即使某条路径漏了 ②，也不会重复也不会乱码
 *
 * 🔴 编辑体验：光标/选区落在公式内时不装饰，露出源码供编辑；点击公式即把光标送进区间。
 * ============================================================
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
// 🔴 只从 @tiptap/pm/view 取 Decoration/DecorationSet：Tiptap v3 该入口**未转出 WidgetType**
//    （实测只导出 5 个符号），故自建最小基类 —— ProseMirror 对 widget 只做鸭子类型使用。
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  splitMathSegments,
  MATH_PREVIEW_ATTR,
  MATH_LATEX_ATTR,
  MATH_DISPLAY_ATTR,
  MATH_SRC_CLASS,
} from './mathSyntax.js';
import { renderMathInHtml } from './mathRender.js';

export const MATH_PREVIEW_PLUGIN_KEY = new PluginKey('zwgMathPreview');

// widget 标记属性与隐藏类定义在零依赖的 mathSyntax.js（docxBuilder 也要用它们识别 widget，
// 不能从本模块引，否则会把 Tiptap 拖进导出 chunk）——此处转出，方便编辑器侧统一从此处取
export { MATH_PREVIEW_ATTR, MATH_LATEX_ATTR, MATH_DISPLAY_ATTR, MATH_SRC_CLASS };

/**
 * 在给定文本里找出公式的**字符区间**（相对该文本）。
 * 用 `raw` 的长度而非 `latex`：latex 已被 trim，长度与原文不等（如 `$$ x $$`）。
 */
export const findMathRanges = (text) => {
  const src = String(text == null ? '' : text);
  if (src.indexOf('$') === -1) return [];
  const ranges = [];
  let offset = 0;
  for (const seg of splitMathSegments(src)) {
    const len = seg.math ? seg.raw.length : String(seg.text || '').length;
    if (seg.math) {
      ranges.push({ from: offset, to: offset + len, latex: seg.latex, display: !!seg.display });
    }
    offset += len;
  }
  return ranges;
};

// 渲染结果缓存：doc 每次事务都会重算装饰，同一公式不重复跑 KaTeX
const renderCache = new Map();
const RENDER_CACHE_MAX = 400;
const renderMathCached = (latex, display) => {
  const key = `${display ? 'D' : 'I'}:${latex}`;
  const hit = renderCache.get(key);
  if (hit !== undefined) return hit;
  let html = '';
  try {
    html = renderMathInHtml(display ? `$$${latex}$$` : `$${latex}$`);
  } catch {
    html = '';
  }
  if (renderCache.size >= RENDER_CACHE_MAX) renderCache.clear();
  renderCache.set(key, html);
  return html;
};

/** 公式源码（还原成 HTML 字符串时用） */
const sourceOf = (latex, display) => (display ? `$$${latex}$$` : `$${latex}$`);

/** 构造公式渲染 DOM（widget 内容）；失败时退回源码文本 */
export const buildMathPreviewDom = (latex, display) => {
  const el = document.createElement('span');
  el.className = `zwg-math-preview${display ? ' zwg-math-preview-display' : ''}`;
  el.setAttribute(MATH_PREVIEW_ATTR, '1');
  el.setAttribute(MATH_LATEX_ATTR, latex);       // 🔴 还原 / Word 导出的依据
  el.setAttribute(MATH_DISPLAY_ATTR, display ? '1' : '0');
  el.setAttribute('title', '点击编辑公式源码');
  el.setAttribute('contenteditable', 'false');
  const html = renderMathCached(latex, display);
  if (html) el.innerHTML = html;
  else el.textContent = sourceOf(latex, display);
  return el;
};

/**
 * 收集装饰：每个公式得到一对 —— inline（隐藏源码）+ widget（渲染公式）。
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {{from:number,to:number,empty:boolean}} selection
 */
export const collectDecorations = (doc, selection) => {
  const decos = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text || node.text.indexOf('$') === -1) return;
    for (const r of findMathRanges(node.text)) {
      const from = pos + r.from;
      const to = pos + r.to;
      if (from >= to) continue;
      // 光标/选区与该公式相交 → 不装饰，露出源码供编辑
      const touched = selection.empty
        ? (selection.from > from && selection.from < to)
        : (selection.from < to && selection.to > from);
      if (touched) continue;
      const math = { latex: r.latex, display: r.display, from, to };
      // ① 隐藏源码（视觉隐藏，DOM 里仍在）
      decos.push(Decoration.inline(from, to, { class: MATH_SRC_CLASS }, { kind: 'inline', math }));
      // ② 在原位渲染公式
      decos.push(Decoration.widget(
        to,
        () => buildMathPreviewDom(r.latex, r.display),
        // key 让 ProseMirror 判定 widget 未变 → 不重建 DOM（避免每次事务闪烁）
        { kind: 'widget', math, key: `zwg-math:${r.display ? 'D' : 'I'}:${r.latex}` }
      ));
    }
  });
  return decos;
};

/**
 * 把 HTML 里的公式 widget 还原为原始形态（内容读取边界用）：
 * 移除 widget 元素 + 拆掉隐藏源码的 span 包裹。
 * 无 widget 时**原样返回**（零开销）；结果与"从未渲染过"的 HTML 一致。
 */
export const restoreMathPreviewSource = (html) => {
  const src = String(html == null ? '' : html);
  if (!src || !src.includes(MATH_PREVIEW_ATTR)) return src;
  if (typeof document === 'undefined') return src;
  try {
    const box = document.createElement('div');
    box.innerHTML = src;
    if (!box.querySelector(`[${MATH_PREVIEW_ATTR}]`)) return src;
    // ① 移除渲染 widget（源码还在隐藏 span 里，不需要补文本）
    box.querySelectorAll(`[${MATH_PREVIEW_ATTR}]`).forEach((w) => w.remove());
    // ② 拆掉隐藏源码的 span：否则导出/预览里 .zwg-math-src{display:none} 会把公式藏起来
    box.querySelectorAll(`.${MATH_SRC_CLASS}`).forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    });
    return box.innerHTML;
  } catch {
    return src;
  }
};

/** Tiptap 扩展：把编辑器里的 $…$ / $$…$$ 实时渲染为公式 */
export const createMathPreviewExtension = () => Extension.create({
  name: 'zwgMathPreview',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: MATH_PREVIEW_PLUGIN_KEY,
        props: {
          decorations(state) {
            return DecorationSet.create(state.doc, collectDecorations(state.doc, state.selection));
          },
          /** 点击公式 → 把光标送进区间（装饰随即消失，露出源码可编辑） */
          handleClick(view, _pos, event) {
            const el = event.target && event.target.closest
              ? event.target.closest(`[${MATH_PREVIEW_ATTR}]`)
              : null;
            if (!el || !view.dom.contains(el)) return false;
            // widget 位置 = 公式区间末尾；光标送到区间内部即触发"编辑态"
            const anchor = view.posAtDOM(el, 0);
            const inside = Math.max(1, anchor - 1);
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, inside)));
            view.focus();
            return true;
          },
        },
      }),
    ];
  },
});

export { sourceOf };

export default { createMathPreviewExtension, findMathRanges, restoreMathPreviewSource };
