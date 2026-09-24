/**
 * 🧩 导图在富文本编辑器里的「透传节点」
 * ============================================================
 * 🔴 为什么必须有它（2026-09-24 用户："所有生成的内容要从排版模块排版后再导出的，
 *    所以不能让生成的内容静默丢弃"）：
 *    排版模块 HTML 模式默认走富文本编辑器（tiptap），而 tiptap 的 schema 里**没有 svg/figure**——
 *    程序化注入的 HTML 一进 `setContent` 就会被当未知标签剥掉。本项目为同一类问题已经踩过两次：
 *      · `DivWrapper`：注释原话"Tiptap 默认丢弃 <div>，导致 AI 的版面配色全部丢失"
 *      · 公式：`prepareHtmlForLoad` 注释原话"任何程序化注入都会把 <m:oMath> 当未知标签剥掉，
 *        公式静默变成散字（只剩字母和加减号）"
 *    导图比公式那次更糟：SVG 一丢，导图块 JSON 也已不存在 → **不可逆**。
 *    所以这里给编辑器注册一个导图节点：整块保留、原子不可局部编辑（能选中/删除，正合适），
 *    并且**从规格重画**（figure 上的 data-k-spec）—— 即使被 ProseMirror 碰过也能复原。
 *
 * 与本仓库既有自定义节点（pageBreak / DivWrapper / DrawArea）同一手法，放在一起最不容易漏。
 * ============================================================
 */
import { Node } from '@tiptap/core';
import { FIGURE_CLASS, SPEC_ATTR, svgFromSpecAttr, toResponsiveSvg } from './diagramBlock.js';

/** 节点名（schema 里的名字） */
export const DIAGRAM_FIGURE_NODE = 'diagramFigure';

/**
 * 造导图节点（工厂形式：与 RichTextEditor 里其它自定义节点同风格）。
 * 关键点：
 *  · `atom: true` —— 图是一个整体，不在里面编辑文字，避免用户把图改坏；
 *  · `parseHTML` 只认 `figure.k-diagram-figure`，**规格从 data-k-spec 读**；
 *  · `renderHTML` 现场用规格重画 SVG 再序列化出去 —— 保证 `editor.getHTML()`（也就是导出 PDF/Word
 *    实际吃的那份 HTML）里永远带着完整的内联 SVG。
 */
export const createDiagramFigureNode = () => Node.create({
  name: DIAGRAM_FIGURE_NODE,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return { spec: { default: '' } };
  },
  parseHTML() {
    return [{
      tag: `figure.${FIGURE_CLASS}`,
      getAttrs: (el) => ({ spec: el.getAttribute(SPEC_ATTR) || '' }),
    }];
  },
  renderHTML({ node }) {
    const fig = document.createElement('figure');
    fig.className = FIGURE_CLASS;
    fig.setAttribute('style', 'margin:12px 0;text-align:center;');
    fig.setAttribute(SPEC_ATTR, node.attrs.spec || '');
    // 规格是唯一事实源：每次都重画，不怕中途被谁改坏
    const svg = svgFromSpecAttr(node.attrs.spec);
    if (svg) fig.innerHTML = toResponsiveSvg(svg);
    return fig;
  },
});

export default { createDiagramFigureNode, DIAGRAM_FIGURE_NODE };
