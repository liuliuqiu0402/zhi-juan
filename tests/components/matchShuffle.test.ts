// 连线题·打乱右列：编辑器手动行为（走事务、可撤销、不动答案）
// 保护：① 右列顺序确实变化且项集合不变；② 左列与结构不动；③ 无连线题时给提示不抛错
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextEditor from '@/components/RichTextEditor.vue';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MATCH = '<p>连一连。</p><div class="match-question">'
  + '<div class="match-col"><div class="match-item">甲</div><div class="match-item">乙</div><div class="match-item">丙</div></div>'
  + '<div class="match-col"><div class="match-item">A</div><div class="match-item">B</div><div class="match-item">C</div></div>'
  + '</div>';

/** 解出两列各项文本（顺序敏感） */
const colsOf = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return [...host.querySelectorAll('.match-question .match-col')]
    .map((c) => [...c.querySelectorAll('.match-item')].map((e) => (e.textContent || '').trim()));
};

const shuffleBtn = (wrapper: any) => wrapper.findAll('button')
  .find((b: any) => (b.attributes('title') || '').includes('打乱连线题右列'));

describe('连线题·打乱右列（编辑器手动行为）', () => {
  it('点击后右列顺序变化、项集合不变；左列与结构不动', async () => {
    const wrapper = mount(RichTextEditor, { props: { modelValue: MATCH, customCSS: '', editable: true } });
    await wait(500);
    const editor = (wrapper.vm as any).editor;
    expect(editor, '编辑器应就绪').toBeTruthy();

    const before = colsOf(editor.getHTML());
    expect(before.length, '应有两列').toBe(2);
    expect(before[0]).toEqual(['甲', '乙', '丙']);
    expect(before[1]).toEqual(['A', 'B', 'C']);

    const btn = shuffleBtn(wrapper);
    expect(btn, '应有打乱右列按钮').toBeTruthy();
    await btn.trigger('click');
    await wait(50);

    const after = colsOf(editor.getHTML());
    expect(after[0], '左列不得变动').toEqual(['甲', '乙', '丙']);
    expect([...after[1]].sort(), '右列项集合不变（只换顺序）').toEqual(['A', 'B', 'C']);
    expect(after[1], '右列顺序应发生变化').not.toEqual(before[1]);
    expect((editor.getHTML().match(/match-question/g) || []).length, '结构完好：仍只有一处连线题').toBe(1);

    wrapper.unmount();
  });

  it('无连线题时给提示、不抛错', async () => {
    const wrapper = mount(RichTextEditor, { props: { modelValue: '<p>普通正文。</p>', customCSS: '', editable: true } });
    await wait(500);
    const btn = shuffleBtn(wrapper);
    expect(btn).toBeTruthy();
    await btn.trigger('click');
    expect((wrapper.vm as any).carrierPanel?.kind).toBe('notice');
    wrapper.unmount();
  });
});
