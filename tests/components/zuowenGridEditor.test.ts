// 作文格手动插入（真实编辑器组件）：学段下拉带出默认格数 + 插入格数原样保留（2026-10-31）
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextEditor from '@/components/RichTextEditor.vue';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 轮询直到条件成立（全量并发下固定等待不够稳，改用条件等待） */
const waitFor = async <T,>(fn: () => T | null | undefined | false, timeoutMs = 3000): Promise<T> => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = fn();
    if (v) return v as T;
    await wait(20);
  }
  return fn() as T;
};

const mountEditor = async (html: string, stage = '') => {
  const wrapper = mount(RichTextEditor, { props: { modelValue: html, customCSS: '', editable: true, stage } });
  await wait(400);
  return wrapper;
};

const openZuoWenPanel = async (wrapper: any) => {
  const btn = wrapper.findAll('button').find((b: any) => (b.attributes('title') || '').startsWith('插入作文格'));
  expect(btn, '工具栏应有 ▦ 作文格按钮').toBeTruthy();
  await btn.trigger('click');
  return await waitFor(() => {
    const p = wrapper.find('.carrier-panel');
    return p.exists() ? p : null;
  });
};

const spanCount = (html: string) => (html.match(/<span/g) || []).length;

const numberInput = (panel: any) => waitFor(() => {
  const i = panel.find('input[type="number"]');
  return i.exists() ? i : null;
});

const insertButton = (wrapper: any) => waitFor(() =>
  wrapper.findAll('button').find((b: any) => (b.text() || '').trim() === '插入') || null);

describe('作文格手动插入：按学段带出格数，插入后格数不丢', () => {
  it('文档学段=小学中段 → 面板默认 360 格；插入后 getHTML 保留 360 格', async () => {
    const wrapper = await mountEditor('<p>正文</p>', 'primary_mid');
    const panel = await openZuoWenPanel(wrapper);
    const input = await numberInput(panel);
    expect((input.element as HTMLInputElement).value).toBe('360');
    expect(panel.text(), '应显示字数数字提示').toContain('360');

    const ins = await insertButton(wrapper);
    await ins.trigger('click');
    await wait(30);

    const editor = await waitFor(() => (wrapper.vm as any).editor || null);
    const html = editor.getHTML();
    expect(spanCount(html)).toBe(360);
    expect(html).toContain('data-cells="360"');
    wrapper.unmount();
  });

  it('切换学段下拉 → 格数随学段变（初中 800）', async () => {
    const wrapper = await mountEditor('<p>正文</p>', '');
    const panel = await openZuoWenPanel(wrapper);
    const sel = await waitFor(() => {
      const s = panel.find('select');
      return s.exists() ? s : null;
    });
    await sel.setValue('middle');
    await wait(20);
    expect(((await numberInput(panel)).element as HTMLInputElement).value).toBe('800');
    wrapper.unmount();
  });

  it('手动改数字 → 按改后的格数插入（不被学段默认覆盖）', async () => {
    const wrapper = await mountEditor('<p>正文</p>', 'middle');
    const panel = await openZuoWenPanel(wrapper);
    const input = await numberInput(panel);
    await input.setValue('120');
    const ins = await insertButton(wrapper);
    await ins.trigger('click');
    await wait(30);
    const editor = await waitFor(() => (wrapper.vm as any).editor || null);
    const html = editor.getHTML();
    expect(spanCount(html)).toBe(120);
    wrapper.unmount();
  });

  it('文档里已有的作文格过编辑器后格数不丢（360 格往返）', async () => {
    const CELL = '<span>&emsp;</span>';
    const wrapper = await mountEditor(`<div class="zuo-wen-ge">${CELL.repeat(360)}</div>`, 'primary_mid');
    const editor = await waitFor(() => (wrapper.vm as any).editor || null);
    const html = editor.getHTML();
    expect(spanCount(html)).toBe(360);
    expect(html).toContain('data-cells="360"');
    wrapper.unmount();
  });
});
