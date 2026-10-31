/**
 * 书写载体·编辑器 → 导出全链路（预览格数 = 导出格数）
 *
 * 背景（2026-10-31 属主实证）：
 *   ① 田字格：原有 3 格后面再插 3 格，预览 6 个，导出只剩原有 3 个；
 *   ② 作文格：不论哪个学段，导出都是 200 格。
 * 只验导出端会漏掉"编辑器 getHTML 先把格子吃掉"这一层，故此处走真实链路：
 *   mount RichTextEditor → editor.getHTML() → buildDocxFromDom → 数 marker / 单元格。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextEditor from '@/components/RichTextEditor.vue';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const xmlOfHtml = async (html: string) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container, 'primary_low');
  container.remove();
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return zip.file('word/document.xml').async('string');
};

describe('田字格：编辑器 6 格 → 导出 6 格', () => {
  it('同一段落 6 格（原有 3 + 插入 3）全链路不丢', async () => {
    const g = '<span class="tian-zi-ge">&emsp;</span>';
    const wrapper = mount(RichTextEditor, {
      props: { modelValue: `<p>${g.repeat(6)}</p>`, customCSS: '', editable: true },
    });
    await wait(400);
    const editor = (wrapper.vm as any).editor;
    const html = editor.getHTML();
    expect((html.match(/class="tian-zi-ge"/g) || []).length, '编辑器侧格数').toBe(6);
    expect(((await xmlOfHtml(html)).match(/__TZG_/g) || []).length, '导出侧 marker 数').toBe(6);
    wrapper.unmount();
  });
});

describe('作文格：编辑器格数原样进导出（不再固定 200）', () => {
  it('360 格 → getHTML 带 data-cells=360 → 导出按 360 排格', async () => {
    const grid = `<div class="zuo-wen-ge" data-cells="360">${'<span>&emsp;</span>'.repeat(360)}</div>`;
    const wrapper = mount(RichTextEditor, {
      props: { modelValue: grid, customCSS: '', editable: true, stage: 'primary_mid' },
    });
    await wait(400);
    const editor = (wrapper.vm as any).editor;
    const html = editor.getHTML();
    expect(Number(html.match(/data-cells="(\d+)"/)?.[1]), '编辑器声明格数').toBe(360);
    // 导出单元格数 ≥ 360（末尾按整行补空格，故不硬等）
    expect(((await xmlOfHtml(html)).match(/<w:tc>/g) || []).length).toBeGreaterThanOrEqual(360);
    wrapper.unmount();
  });
});
