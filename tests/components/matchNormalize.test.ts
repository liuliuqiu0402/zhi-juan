// 连线题·规范为两列结构：编辑器手动行为（框选线性段落 → 两列 match-question）
// 用例取自实际产出（2026-09-30）：模型把"连一连"写成"左项 <空位> 右项"的同行段落
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextEditor from '@/components/RichTextEditor.vue';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BROKEN = '<p class="question">33. 小水滴落进池塘、田野和花园，分别做了什么？请连一连。（4分）</p>'
  + '<p>落进池塘<u class="blank-6"> </u>花儿露出笑脸</p>'
  + '<p>落进田野<u class="blank-6"> </u>鱼儿摇着尾巴</p>'
  + '<p>落进花园<u class="blank-6"> </u>麦苗张开小嘴</p>';

const mountEditor = async (html: string) => {
  const wrapper = mount(RichTextEditor, { props: { modelValue: html, customCSS: '', editable: true } });
  await wait(400);
  return wrapper;
};

const btn = (wrapper: any) => wrapper.findAll('button')
  .find((b: any) => (b.attributes('title') || '').includes('规范为连线题'));

const colsOf = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return [...host.querySelectorAll('.match-question .match-col')]
    .map((c) => [...c.querySelectorAll('.match-item')].map((e) => (e.textContent || '').trim()));
};

describe('连线题·规范为两列结构（编辑器手动行为）', () => {
  it('框选线性段落 → 转两列、左列保序、右列打乱、空位消失；题干不动', async () => {
    const wrapper = await mountEditor(BROKEN);
    const editor = (wrapper.vm as any).editor;
    const blocks: any[] = [];
    editor.state.doc.forEach((c: any, off: number) => blocks.push({ c, off }));
    expect(blocks.length, '题干 + 三行 = 4 个块').toBe(4);
    // 框选三行（不含题干）
    editor.commands.setTextSelection({ from: blocks[1].off, to: blocks[3].off + blocks[3].c.nodeSize });

    await btn(wrapper).trigger('click');
    await wait(50);

    const html = editor.getHTML();
    const cols = colsOf(html);
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野', '落进花园']);
    expect([...cols[1]].sort(), '右列项集合不变（只换顺序）').toEqual(['花儿露出笑脸', '鱼儿摇着尾巴', '麦苗张开小嘴']);
    expect(cols[1], '右列须打乱（同行相邻即答案）').not.toEqual(['花儿露出笑脸', '鱼儿摇着尾巴', '麦苗张开小嘴']);
    expect(html, '空位应被去掉').not.toMatch(/blank-\d/);
    expect(html, '题干不得受损').toContain('请连一连');
    wrapper.unmount();
  });

  it('未框选（仅光标）→ 给提示、不改内容', async () => {
    const wrapper = await mountEditor(BROKEN);
    const editor = (wrapper.vm as any).editor;
    editor.commands.setTextSelection(1);
    const before = editor.getHTML();

    await btn(wrapper).trigger('click');
    await wait(30);

    expect((wrapper.vm as any).carrierPanel?.kind).toBe('notice');
    expect(editor.getHTML(), '未框选时不得改动内容').toBe(before);
    wrapper.unmount();
  });

  it('框选不足两行（仅一行）→ 给提示、不改内容', async () => {
    const wrapper = await mountEditor(BROKEN);
    const editor = (wrapper.vm as any).editor;
    const blocks: any[] = [];
    editor.state.doc.forEach((c: any, off: number) => blocks.push({ c, off }));
    editor.commands.setTextSelection({ from: blocks[1].off, to: blocks[1].off + blocks[1].c.nodeSize });
    const before = editor.getHTML();

    await btn(wrapper).trigger('click');
    await wait(30);

    expect((wrapper.vm as any).carrierPanel?.kind).toBe('notice');
    expect(editor.getHTML(), '不成题时不得改动内容').toBe(before);
    wrapper.unmount();
  });

  it('整题连题干一起框选：题干原样保留，仅连续连线行成题', async () => {
    const wrapper = await mountEditor(BROKEN);
    const editor = (wrapper.vm as any).editor;
    const blocks: any[] = [];
    editor.state.doc.forEach((c: any, off: number) => blocks.push({ c, off }));
    editor.commands.setTextSelection({ from: blocks[0].off, to: blocks[3].off + blocks[3].c.nodeSize });

    await btn(wrapper).trigger('click');
    await wait(50);

    const html = editor.getHTML();
    expect(colsOf(html).length, '仍只出一处连线题').toBe(2);
    expect(html, '题干原样保留').toContain('请连一连');
    expect((html.match(/match-question/g) || []).length, '只有一处连线题').toBe(1);
    wrapper.unmount();
  });
});
