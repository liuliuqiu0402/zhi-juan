// 编辑即预览回归测试：卷面固定件（exam-shell）注入 + 真实 RichTextEditor 加载
// 保护：点击记录加载内容不会因固定件注入/解析异常导致编辑器空白
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { injectExamShell, normalizeSealStructure } from '@/themeConfig.js';
import RichTextEditor from '@/components/RichTextEditor.vue';

const SAMPLE = `<div class="sealed-wrapper">
<div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿＿＿</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-bot">密</div></div>
<div class="sealed-content">
<h2>第二单元学业测评</h2><p>（考试时间：60分钟　满分：100分）</p>
<h2>一、看拼音，写词语。（共6题，每题2分，共12分）</h2><p>1. 看拼音写词语。</p>
<h2>二、组词。（共4题，共8分）</h2><p>1. 组词。</p>
</div></div>`;

describe('编辑即预览：exam-shell 注入与编辑器加载', () => {
  it('injectExamShell 注入不抛错、幂等、含固定件', () => {
    const once = injectExamShell(normalizeSealStructure(SAMPLE), 'primary');
    expect(once).toContain('class="exam-shell"');
    expect(once).toContain('注意事项');
    expect(once).toContain('exam-score-table');
    const twice = injectExamShell(once, 'primary');
    expect((twice.match(/class="exam-shell"/g) || []).length).toBe(1);
  });

  it('真实 RichTextEditor 加载注入内容：不抛错、正文与固定件均可见', async () => {
    const injected = injectExamShell(normalizeSealStructure(SAMPLE), 'primary');
    let wrapper;
    expect(() => {
      wrapper = mount(RichTextEditor, { props: { modelValue: injected, customCSS: '', editable: true } });
    }).not.toThrow();
    await new Promise((r) => setTimeout(r, 500)); // 等待 Tiptap editor 就绪
    const editor = wrapper?.vm?.editor;
    const html = editor?.getHTML?.() || '';
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('注意事项');
    expect(html).toContain('看拼音写词语');
    expect(html).toContain('exam-score-table'); // 表格 class 保真
    if (wrapper) wrapper.unmount();
  });
});
