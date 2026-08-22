// 生成后程序化修正回归测试（不依赖 AI 的根治兜底）：
// 1. 移除题干前"【场景/情境/背景：xx】"标签前缀
// 2. 大题标题旧式"（X分）"→ 自动补全明细式"（共N题，每题X分，共X分）"
import { describe, it, expect } from 'vitest';
import { fixExamFormats } from '@/utils/examFixer.js';

describe('fixExamFormats 程序化修正', () => {
  it('移除题干前的【场景：xx】标签前缀', () => {
    const html = '<h2>一、看拼音，写词语。（32分）</h2><p class="question">【场景：春节习俗介绍】春节到了，请你读拼音写词语。</p>';
    const out = fixExamFormats(html);
    expect(out).not.toContain('【场景：春节习俗介绍】');
    expect(out).toContain('春节到了，请你读拼音写词语');
  });

  it('移除【情境/背景】类标签，保留正文其他方括号内容', () => {
    const html = '<p class="question">【情境：元宵猜灯谜】请把字和读音连起来。</p><p class="question">（填序号）</p>';
    const out = fixExamFormats(html);
    expect(out).not.toContain('【情境：元宵猜灯谜】');
    expect(out).toContain('请把字和读音连起来');
    expect(out).toContain('（填序号）');
  });

  it('大题标题（X分）→ 明细式（分值整除：每题X分）', () => {
    const html = '<h2>一、看拼音，写词语。（20分）</h2><p>1. 看拼音写词语。</p><p>2. 看拼音写词语。</p><p>3. 看拼音写词语。</p><p>4. 看拼音写词语。</p><h2>二、组词。（16分）</h2><p>1. 组词。</p><p>2. 组词。</p>';
    const out = fixExamFormats(html);
    expect(out).toContain('一、看拼音，写词语。（共4题，每题5分，共20分）');
    expect(out).toContain('二、组词。（共2题，每题8分，共16分）');
    expect(out).not.toContain('（20分）');
  });

  it('大题标题（X分）→ 明细式（分值不整除：共N题，共X分）', () => {
    const html = '<h2>一、填空。（30分）</h2><p>1. 填一填。</p><p>2. 填一填。</p><p>3. 填一填。</p><p>4. 填一填。</p>';
    const out = fixExamFormats(html);
    expect(out).toContain('一、填空。（共4题，共30分）');
  });

  it('已是明细式的标题不重复修改', () => {
    const html = '<h2>一、看拼音，写词语。（共6题，每题3分，共18分）</h2><p>1. 看拼音写词语。</p>';
    const out = fixExamFormats(html);
    expect(out).toContain('（共6题，每题3分，共18分）');
  });

  it('子题（（1）（2））不计入小题数', () => {
    const html = '<h2>一、阅读理解。（12分）</h2><p>1. 读短文回答问题。</p><p>(1) 第一题</p><p>(2) 第二题</p><h2>二、写话。（10分）</h2><p>1. 看图写话。</p>';
    const out = fixExamFormats(html);
    expect(out).toContain('一、阅读理解。（共1题，共12分）');
    expect(out).toContain('二、写话。（共1题，共10分）');
  });
});
