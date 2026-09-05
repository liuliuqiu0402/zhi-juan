// BulletList data-marker 属性保留测试：无序列表各自符号持久化、同一文档可并存多种符号的基础
// 背景：Tiptap 内置 BulletList 不保留符号信息，同文档多个列表即使符号不同，转文本时也会被
//       "当前全局 bulletMarker"统一覆盖；CustomBulletList 保留 data-marker 后各列表可各自转符号。
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import Paragraph from '@tiptap/extension-paragraph';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';

// ⚠️ 与 RichTextEditor.vue 中 CustomBulletList 定义保持一致（把 <ul> 的 data-marker / type / list-style-type
//    统一归一为 data-marker，使文档中"各自符号"能被持久化、显示与转文本保留）
const LIST_STYLE_SYMBOLS = {
  disc: '• ', circle: '○ ', square: '▪ ', none: '',
};
const parseListMarker = (element) => {
  const m = element.getAttribute('data-marker');
  if (m) return m;
  const typeAttr = (element.getAttribute('type') || '');
  if (LIST_STYLE_SYMBOLS[typeAttr] !== undefined) return LIST_STYLE_SYMBOLS[typeAttr];
  const style = element.getAttribute('style') || '';
  const lm = /list-style-type\s*:\s*([a-zA-Z]+)/.exec(style);
  if (lm && LIST_STYLE_SYMBOLS[lm[1]] !== undefined) return LIST_STYLE_SYMBOLS[lm[1]];
  return null;
};
const CustomBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      marker: {
        default: null,
        parseHTML: element => parseListMarker(element),
        // 与 RichTextEditor.vue 保持一致：extra style="--msym:…" 供 li::before 显示符号（attr 读不到父级 ul）
        renderHTML: attributes => (attributes.marker
          ? { 'data-marker': attributes.marker, style: `--msym: '${String(attributes.marker).replace(/'/g, '')}';` }
          : {}),
      },
    };
  },
});

const makeEditor = (content) => new Editor({
  extensions: [Document, Text, CustomBulletList, ListItem, Paragraph],
  content,
});

describe('BulletList data-marker 属性保留（无序列表各自符号）', () => {
  it('setContent <ul data-marker="○ "> 后 getHTML 保留 data-marker', () => {
    const editor = makeEditor('<ul data-marker="○ "><li><p>甲</p></li><li><p>乙</p></li></ul>');
    expect(editor.getHTML()).toContain('data-marker="○ "');
    editor.destroy();
  });

  it('多种 data-marker（• / ○ / ▪）并存不互相覆盖', () => {
    const editor = makeEditor(
      '<ul data-marker="• "><li><p>甲</p></li></ul>' +
      '<p>分隔</p>' +
      '<ul data-marker="▪ "><li><p>乙</p></li></ul>'
    );
    const html = editor.getHTML();
    expect(html).toContain('data-marker="• "');
    expect(html).toContain('data-marker="▪ "');
    editor.destroy();
  });

  it('无 marker 的 ul 不受影响（不凭空多出 data-marker）', () => {
    const editor = makeEditor('<ul><li><p>甲</p></li></ul>');
    expect(editor.getHTML()).not.toContain('data-marker=');
    editor.destroy();
  });

  it('<ul type="circle"> 归一为 data-marker="○ "（保留原符号）', () => {
    const editor = makeEditor('<ul type="circle"><li><p>甲</p></li></ul>');
    expect(editor.getHTML()).toContain('data-marker="○ "');
    editor.destroy();
  });

  it('<ul style="list-style-type:square"> 归一为 data-marker="▪ "（保留原符号）', () => {
    const editor = makeEditor('<ul style="list-style-type:square"><li><p>甲</p></li></ul>');
    expect(editor.getHTML()).toContain('data-marker="▪ "');
    editor.destroy();
  });

  it('多种形态符号并存（data-marker / type / list-style-type）各自保留不统一', () => {
    const editor = makeEditor(
      '<ul data-marker="• "><li><p>甲</p></li></ul>' +
      '<ul type="circle"><li><p>乙</p></li></ul>' +
      '<ul style="list-style-type:square"><li><p>丙</p></li></ul>'
    );
    const html = editor.getHTML();
    expect(html).toContain('data-marker="• "');
    expect(html).toContain('data-marker="○ "');
    expect(html).toContain('data-marker="▪ "');
    editor.destroy();
  });

  it('data-marker 同时携带 --msym 继承变量（供 li::before 显示，防止 attr(父级) 取空）', () => {
    const editor = makeEditor('<ul data-marker="✎ "><li><p>铅笔</p></li></ul>');
    const html = editor.getHTML();
    expect(html).toContain('data-marker="✎ "');
    expect(html).toContain('--msym');
    editor.destroy();
  });
});