// 编辑器 DOM 定位记号泄漏：段末公式导出多出"【图片】"（2026-09-30 用户实证）
// ============================================================
// 🔴 现象（用户导出的 Word 实证）：展示式（$$…$$ 独占一段）与所有"以公式结尾"的段落，
//    导出后每处都多出两个字"【图片】"，并多一个空行。用户文件里共 14 处，位置与"公式在段末"一一对应。
// 🔴 根因：ProseMirror 在"文本块末尾是 widget/叶节点"时会插入它自己的定位记号
//    `<img class="ProseMirror-separator">` + `<br class="ProseMirror-trailingBreak">`。
//    内容读取边界只还原了公式 widget，没有清理这两个记号（全库检索：0 处处理）；
//    导出器见到无 src 的 img 就回退成占位文字 `【图片】`，见到那个 br 就多导一个换行。
// 🔴 本文件锁三件事：① 读取边界必须剥掉这两个记号（含"无 widget 仅有记号"的情形，且无记号时零改动）
//    ② 导出器必须有独立防御（防某条路径绕过读取边界） ③ 展示式独占一段仍须产出 m:oMathPara。
// ============================================================
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import JSZip from 'jszip';
import { Packer } from 'docx';
import RichTextEditor from '@/components/RichTextEditor.vue';
import { restoreMathPreviewSource } from '@/utils/mathPreview.js';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const xmlOf = async (html) => {
  const c = document.createElement('div');
  c.style.fontSize = '16px';
  c.innerHTML = html;
  document.body.appendChild(c);
  const doc = buildDocxFromDom(c);
  c.remove();
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return await zip.file('word/document.xml').async('string');
};

describe('读取边界：restoreMathPreviewSource 必须剥掉 ProseMirror 定位记号', () => {
  it('仅有定位记号、没有公式 widget → 仍然剥离（且不因短路而漏）', () => {
    const html = '<p>正文<img class="ProseMirror-separator" alt=""><br class="ProseMirror-trailingBreak"></p>';
    const out = restoreMathPreviewSource(html);
    expect(out, '不能留下 separator').not.toContain('ProseMirror-separator');
    expect(out, '不能留下 trailingBreak').not.toContain('ProseMirror-trailingBreak');
    expect(out, '正文必须原样保留').toContain('正文');
  });

  it('公式 widget + 定位记号 → 两者都清（widget 移除、源码拆出、记号剥掉）', () => {
    const html = '<p>29. <span class="zwg-math-src">$$x=1$$</span>'
      + '<span class="zwg-math-preview zwg-math-preview-display" data-math-preview="1" data-math-latex="x=1" data-math-display="1">…KaTeX…</span>'
      + '<img class="ProseMirror-separator" alt=""><br class="ProseMirror-trailingBreak"></p>';
    const out = restoreMathPreviewSource(html);
    expect(out, '公式源码必须还原').toContain('$$x=1$$');
    expect(out, 'KaTeX widget 必须移除').not.toContain('data-math-preview');
    expect(out, '隐藏源码的 span 包裹必须拆掉').not.toContain('zwg-math-src');
    expect(out, '定位记号必须剥掉').not.toContain('ProseMirror-');
  });

  it('既无 widget 也无记号 → 原样返回（零开销契约，逐字节相同）', () => {
    const html = '<p>普通段落 $\frac{1}{2}$ 文本</p>';
    expect(restoreMathPreviewSource(html)).toBe(html);
  });
});

describe('导出器防御：即使某条路径漏了读取边界，也不得导出【图片】/多余换行', () => {
  it('带定位记号的 HTML 直接进导出 → 无【图片】、无多余 w:br', async () => {
    const xml = await xmlOf('<p>29. $$x=\\frac{-b}{2a}$$<img class="ProseMirror-separator" alt=""><br class="ProseMirror-trailingBreak"></p>');
    expect(xml, '不得出现【图片】占位').not.toContain('【图片】');
    expect(xml, '不得多出换行符').not.toContain('<w:br');
    expect(xml, '公式本体必须仍是真公式').toContain('<m:oMath');
  });

  it('块级图片分支同样不认这个记号', async () => {
    const xml = await xmlOf('<img class="ProseMirror-separator" alt=""><p>正文</p>');
    expect(xml).not.toContain('【图片】');
  });
});

describe('端到端：真实编辑器 DOM → 导出（用户报的就是这条路径）', () => {
  it('公式结尾的段落（展示式 + 化学方程式）导出后不得出现【图片】', async () => {
    const wrapper = mount(RichTextEditor, {
      props: {
        modelValue: '<p>1. 把 $\\frac{3}{4}$ 排列。</p>'
          + '<p>29. $$x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}$$</p>'
          + '<p>50. $2H_{2}+O_{2}\\rightarrow 2H_{2}O$</p>',
        customCSS: '',
        editable: true,
      },
    });
    await wait(500);
    const editor = wrapper.vm.editor;
    const restored = restoreMathPreviewSource(editor.view.dom.innerHTML);
    expect(restored, '读取边界后不应再有 ProseMirror 记号').not.toContain('ProseMirror-');

    const xml = await xmlOf(restored);
    expect(xml, '不得出现【图片】').not.toContain('【图片】');
    expect(xml, '三处公式都应是真公式').toMatch(/<m:oMath[ >]/);
    expect((xml.match(/<m:oMath[ >]/g) || []).length, '公式数应为 3（分式 / 展示式 / 化学方程式）').toBe(3);
    wrapper.unmount();
  });

  it('展示式独占一段 → 仍须产出 m:oMathPara（这条约定别被误改）', async () => {
    const wrapper = mount(RichTextEditor, {
      props: { modelValue: '<p>$$x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}$$</p>', customCSS: '', editable: true },
    });
    await wait(500);
    const editor = wrapper.vm.editor;
    const xml = await xmlOf(restoreMathPreviewSource(editor.view.dom.innerHTML));
    expect(xml, '独占一段的展示式必须走展示式路径').toContain('<m:oMathPara');
    wrapper.unmount();
  });
});
