// 书写载体·编辑器手动插入：同类择一（同族载体整体替换，不并排/不留空壳）
// 走真实工具栏（下拉 + 内联面板"插入"按钮），验证 UI 接线到 carrierFamilyRange 的实效
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextEditor from '@/components/RichTextEditor.vue';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mountEditor = async (html: string) => {
  const wrapper = mount(RichTextEditor, { props: { modelValue: html, customCSS: '', editable: true } });
  await wait(400);
  return wrapper;
};

/** 走工具栏插入：选载体 → 点面板"插入" */
const insertViaUI = async (wrapper: any, id: string) => {
  await wrapper.find('select[title^="插入书写载体"]').setValue(id);
  await wait(0);
  const btn = wrapper.findAll('button').find((b: any) => (b.text() || '').trim() === '插入');
  expect(btn, '面板应出现"插入"按钮').toBeTruthy();
  await btn.trigger('click');
  await wait(30);
};

const caretIn = (editor: any, nodeName: string) => {
  let pos = -1;
  editor.state.doc.descendants((n: any, p: number) => { if (n.type.name === nodeName && pos < 0) pos = p + 1; });
  expect(pos, `文档中应有 ${nodeName}`).toBeGreaterThan(-1);
  editor.commands.setTextSelection(pos);
};

describe('同类择一：同族载体整体替换（不并排、不留空壳）', () => {
  it('光标在田字格内插入米字格 → 田字格被整体替换', async () => {
    const wrapper = await mountEditor('<p>写字：<span class="tian-zi-ge">&emsp;</span>（写一写）</p>');
    const editor = (wrapper.vm as any).editor;
    caretIn(editor, 'tianZiGe');

    await insertViaUI(wrapper, 'mi-zi-ge');

    const html = editor.getHTML();
    expect(html, '应换成米字格').toContain('mi-zi-ge');
    expect(html, '原田字格应被整体替换、无残留').not.toContain('tian-zi-ge');
    expect(html, '同处不得并排两种格子').not.toContain('class="tian-zi-ge"');
    expect(html, '周边文字不得受损').toContain('写一写');
    wrapper.unmount();
  });

  it('光标在括号空位内插入横线空位 → 原括号空位被替换（空位族可互转）', async () => {
    const wrapper = await mountEditor('<p>答案：<span class="blank-5">&emsp;</span>（填一填）</p>');
    const editor = (wrapper.vm as any).editor;
    // 定位到空位文本上
    let pos = -1;
    editor.state.doc.descendants((n: any, p: number) => {
      if (pos < 0 && n.isText && /[\u2003\u00a0]/.test(n.text || '')) pos = p + 1;
    });
    expect(pos, '文档中应有空位占位文本').toBeGreaterThan(0);
    editor.commands.setTextSelection(pos);

    await insertViaUI(wrapper, 'blank-underline');

    const html = editor.getHTML();
    expect(html, '应换成横线空位 <u class="blank-N">').toMatch(/<u[^>]*class="blank-\d+"/);
    expect(html, '原括号空位应被整体替换、无残留').not.toMatch(/<span[^>]*class="blank-\d+"/);
    expect(html, '周边文字不得受损').toContain('填一填');
    wrapper.unmount();
  });

  it('光标在普通正文（无同族载体）→ 正常插入、不动其它内容', async () => {
    const wrapper = await mountEditor('<p>开头甲</p><p>结尾乙</p>');
    const editor = (wrapper.vm as any).editor;
    editor.commands.setTextSelection(editor.state.doc.content.size);

    await insertViaUI(wrapper, 'blank-paren');

    const html = editor.getHTML();
    expect(html).toMatch(/<span[^>]*class="blank-\d+"/);
    expect(html, '其它段落不得受损').toContain('开头甲');
    expect(html, '其它段落不得受损').toContain('结尾乙');
    wrapper.unmount();
  });
});
