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

  it('大题位于顶层（无 sealed-wrapper 包裹）时注入不崩溃（回归：parentElement null）', () => {
    // 模拟 AI 生成的普通试卷 HTML：大题标题直接是顶层元素
    const flat = `<h2>2025—2026学年第二学期小学二年级语文第二单元试卷</h2><p>（考试时间：60分钟　满分：100分）</p><p>亲爱的小朋友，欢迎来到识字乐园！</p><h2>一、识字与写字。（32分）</h2><p>1. 读拼音，写词语。</p><h2>二、阅读。（24分）</h2><p>1. 读短文。</p>`;
    let out = '';
    expect(() => { out = injectExamShell(flat, 'primary'); }).not.toThrow();
    expect(out).toContain('class="exam-shell"');
    expect(out).toContain('注意事项');
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
    // 🔧 sealed-wrapper 结构必须保留（左右 2.5cm 边距 + 密封线布局的载体）
    expect(html).toContain('class="sealed-wrapper"');
    expect(html).toContain('class="seal-zone"');
    if (wrapper) wrapper.unmount();
  });
});
