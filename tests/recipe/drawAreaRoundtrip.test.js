import { describe, it, expect } from 'vitest';
import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// 与修复后 RichTextEditor.vue DrawArea 一致（rendered:false + node.renderHTML 手动合并 style）
const DrawArea = Node.create({
  name: 'drawArea',
  priority: 150,
  group: 'block',
  atom: true,
  selectable: false,
  parseHTML() { return [{ tag: 'div.draw-area' }]; },
  renderHTML({ node }) {
    const attrs = { class: 'draw-area' };
    if (node.attrs.daStyle) attrs.style = node.attrs.daStyle;
    return ['div', attrs];
  },
  addAttributes() {
    return {
      daStyle: {
        default: null,
        parseHTML: (el) => el.getAttribute('style') || null,
        rendered: false,
      },
    };
  },
});

const SRC = '<p>（3）画出它的对称轴。</p><div class="draw-area" style="min-height:50mm;border:1.2px dashed #999999;box-sizing:border-box;"></div>';

describe('DrawArea atom 编辑器往返（修复后写法：rendered:false + node.attrs 手动合并）', () => {
  it('空盒往返保留 class 与完整 style（曾读 HTMLAttributes.daStyle 恒 undefined → style 全丢）', () => {
    const editor = new Editor({ extensions: [StarterKit, DrawArea], content: SRC });
    const out = editor.getHTML();
    editor.destroy();
    expect(out).toContain('<p>（3）画出它的对称轴。</p>');
    expect(out).toContain('class="draw-area"');
    // style 保留（jsdom 序列化会规范化：#999999→rgb(153,153,153)、冒号后补空格，CSS 等价，按语义断言）
    expect(out).toContain('min-height: 50mm');
    expect(out).toContain('dashed');
    expect(out).toContain('box-sizing: border-box');
    expect(out).not.toContain('dastyle'); // rendered:false → 不默认直出自定义 attr 名
  });

  it('往返稳定：二次 setContent/getHTML 不丢 class/style、draw-area 不重复不膨胀', () => {
    const editor = new Editor({ extensions: [StarterKit, DrawArea], content: SRC });
    const once = editor.getHTML();
    editor.commands.setContent(once, false);
    const twice = editor.getHTML();
    editor.destroy();
    // Tiptap 对"块级 atom 结尾内容"会自动补一个尾段落 <p></p>（编辑器通性，真实内容不以作图区结尾，
    // 无实际影响）——剔除尾部空段后核心结构应完全一致
    const stripTailP = (s) => s.replace(/<p><\/p>\s*$/, '');
    expect(stripTailP(twice)).toBe(stripTailP(once));
    expect((twice.match(/draw-area/g) || []).length).toBe(1);
    expect(twice).toContain('min-height: 50mm');
  });

  it('无 style 的 draw-area（CSS 默认 30mm 高）往返保 class', () => {
    const bare = '<div class="draw-area"></div>';
    const editor = new Editor({ extensions: [StarterKit, DrawArea], content: bare });
    const out = editor.getHTML();
    editor.destroy();
    expect(out).toBe('<div class="draw-area"></div>');
  });
});
