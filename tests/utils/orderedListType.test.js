// OrderedList type 属性保留测试：字母/罗马编号在编辑器中显示与导出联动的基石
// 背景：Tiptap 默认 OrderedList 只保留 start 属性，ol type="a"/"A"/"i"/"I" 被丢弃，
//       导致 AI 生成内容中的字母编号退化为数字编号、工具栏无法联动
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Paragraph from '@tiptap/extension-paragraph';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';

// ⚠️ 与 RichTextEditor.vue 中 CustomOrderedList 定义保持一致（extend 保留 ol type 属性）
const OL_LIST_STYLE_TYPES = {
  'lower-alpha': 'a', 'lower-latin': 'a',
  'upper-alpha': 'A', 'upper-latin': 'A',
  'lower-roman': 'i', 'upper-roman': 'I',
};
const CustomOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: null,
        parseHTML: element => {
          const t = element.getAttribute('type');
          if (t) return t;
          const style = element.getAttribute('style') || '';
          const lm = /list-style-type\s*:\s*([a-zA-Z-]+)/.exec(style);
          if (lm && OL_LIST_STYLE_TYPES[lm[1]] !== undefined) return OL_LIST_STYLE_TYPES[lm[1]];
          return null;
        },
        renderHTML: attributes => (attributes.type ? { type: attributes.type } : {}),
      },
    };
  },
});

const makeEditor = (content) => new Editor({
  extensions: [Document, Text, CustomOrderedList, ListItem, Paragraph],
  content,
});

describe('OrderedList type 属性保留（字母编号联动基础）', () => {
  it('setContent <ol type="a"> 后 getHTML 保留 type="a"', () => {
    const editor = makeEditor('<ol type="a"><li><p>甲</p></li><li><p>乙</p></li></ol>');
    const html = editor.getHTML();
    expect(html).toContain('type="a"');
    expect(html).not.toContain('<ol><li>'); // 确认 type 未丢失
    editor.destroy();
  });

  it('type="A" 大写保留', () => {
    const editor = makeEditor('<ol type="A"><li><p>甲</p></li></ol>');
    expect(editor.getHTML()).toContain('type="A"');
    editor.destroy();
  });

  it('<ol style="list-style-type:upper-alpha"> 归一为 type="A"（保留大写字母，防退化为数字）', () => {
    const editor = makeEditor('<ol style="list-style-type: upper-alpha"><li><p>甲</p></li></ol>');
    expect(editor.getHTML()).toContain('type="A"');
    editor.destroy();
  });

  it('<ol style="list-style-type:lower-roman"> 归一为 type="i"（保留小写罗马）', () => {
    const editor = makeEditor('<ol style="list-style-type: lower-roman"><li><p>甲</p></li></ol>');
    expect(editor.getHTML()).toContain('type="i"');
    editor.destroy();
  });

  it('大小写互不误转：lower-alpha→"a" 不上台为大写、upper-alpha→"A" 不降为小写', () => {
    const lower = makeEditor('<ol style="list-style-type: lower-alpha"><li><p>甲</p></li></ol>');
    expect(lower.getHTML()).toContain('type="a"');
    expect(lower.getHTML()).not.toContain('type="A"');
    lower.destroy();
    const upper = makeEditor('<ol style="list-style-type: upper-alpha"><li><p>乙</p></li></ol>');
    expect(upper.getHTML()).toContain('type="A"');
    expect(upper.getHTML()).not.toContain('type="a"');
    upper.destroy();
  });

  it('样式类型既非字母也非罗马（如 decimal/无）不凭空造 type', () => {
    const editor = makeEditor('<ol style="list-style-type: decimal"><li><p>甲</p></li></ol>');
    expect(editor.getHTML()).not.toContain('type=');
    editor.destroy();
  });

  it('无 type 的 ol 不受影响（不凭空多出 type 属性）', () => {
    const editor = makeEditor('<ol><li><p>甲</p></li></ol>');
    expect(editor.getHTML()).not.toContain('type=');
    editor.destroy();
  });

  it('isActive 能按 type 区分字母列表（工具栏联动依据）', () => {
    const editor = makeEditor('<ol type="a"><li><p>甲</p></li></ol>');
    expect(editor.isActive('orderedList')).toBe(true);
    expect(editor.isActive('orderedList', { type: 'a' })).toBe(true);
    expect(editor.isActive('orderedList', { type: 'A' })).toBe(false);
    editor.destroy();
  });
});
