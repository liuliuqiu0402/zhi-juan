/**
 * 🧩 导图在富文本编辑器里的存活保证（**用户约定的硬要求**）
 * ============================================================
 * 用户原话（2026-09-24）："所有生成的内容要从排版模块排版后再导出的，所以不能让生成的内容静默丢弃"。
 * 排版模块 HTML 模式默认走富文本编辑器（tiptap），而它的 schema 里没有 svg/figure →
 * 程序化注入的 HTML 会静默剥掉未知标签。这里用**真编辑器**做往返验证，不是靠读代码推断。
 *
 * 其中"反证"一条是故意的：它断言**不注册该节点时导图确实会丢**，
 * 把"为什么必须有这个节点"钉在测试里 —— 将来谁把节点去掉，这里立刻说明后果。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { createDiagramFigureNode } from '../../src/utils/tiptapDiagramFigure.js';
import { renderDiagramBlocks, FIGURE_CLASS, SPEC_ATTR } from '../../src/utils/diagramBlock.js';

const SRC = '<p>前文</p>'
  + '<div class="k-diagram" data-type="mindmap" data-layout="balanced">{"title":"函数","children":[{"title":"定义域"},{"title":"值域"}]}</div>'
  + '<p>后文</p>';

const WITH_DIAGRAM = renderDiagramBlocks(SRC).html;

const makeEditor = (content, withNode = true) => new Editor({
  element: document.createElement('div'),
  extensions: withNode ? [StarterKit, createDiagramFigureNode()] : [StarterKit],
  content,
});

describe('导图 · 富文本编辑器（排版模块的编辑器）存活', () => {
  it('进入编辑器再取回 HTML：SVG、规格属性、前后正文全都在', () => {
    const ed = makeEditor(WITH_DIAGRAM);
    const html = ed.getHTML();
    expect(html, 'SVG 被编辑器吃掉了').toContain('<svg');
    expect(html, 'viewBox 丢了').toContain('viewBox');
    expect(html, '规格属性丢了（丢了就再也重画不出来）').toContain(SPEC_ATTR);
    expect(html).toContain(FIGURE_CLASS);
    expect(html).toContain('前文');
    expect(html).toContain('后文');
    ed.destroy();
  });

  it('多次往返不衰减（编辑器 → HTML → 编辑器 → HTML）', () => {
    const ed1 = makeEditor(WITH_DIAGRAM);
    const once = ed1.getHTML();
    ed1.destroy();
    const ed2 = makeEditor(once);
    const twice = ed2.getHTML();
    ed2.destroy();
    const count = (s) => (s.match(/<svg/g) || []).length;
    expect(count(twice)).toBe(count(once));
    expect(count(twice)).toBe(1);
    expect(twice).toContain(SPEC_ATTR);
  });

  it('规格是唯一事实源：改规格即可重画（换版式不必重新调模型）', () => {
    const mk = (layout) => renderDiagramBlocks(
      '<p>正文</p><div class="k-diagram" data-type="mindmap" data-layout="' + layout + '">'
      + '{"title":"函数","children":[{"title":"定义域"},{"title":"值域"}]}</div>',
    ).html;
    const a = makeEditor(mk('balanced'));
    const b = makeEditor(mk('right'));
    const wh = (s) => (s.match(/viewBox="0 0 (\d+) (\d+)"/) || []).slice(1).join('x');
    expect(wh(a.getHTML())).not.toBe(wh(b.getHTML()));
    a.destroy();
    b.destroy();
  });

  it('反证：不注册该节点时导图确实会被静默吃掉（这就是必须加节点的原因）', () => {
    const ed = makeEditor(WITH_DIAGRAM, false);
    const html = ed.getHTML();
    expect(html).not.toContain('<svg');
    ed.destroy();
  });
});
