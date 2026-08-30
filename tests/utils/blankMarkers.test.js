import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers, markSubQuestion } from '../../src/utils/contentCleaner.js';

describe('normalizeBlankMarkers 括号填空归一（正文主路径）', () => {
  it('双括号纯空白 ((　　)) → span，无外层括号（真实事故回归：卷面 ((　)) 双括号）', () => {
    const out = normalizeBlankMarkers('一((　　　　))海鸥');
    expect(out).toContain('<span class="blank-6">&emsp;</span>');
    expect(out).not.toMatch(/\(<span class="blank/);
    expect(out).not.toContain('((');
    expect(out).not.toContain('))');
  });

  it('单括号纯空白 （　　） → span（无外层括号）', () => {
    const out = normalizeBlankMarkers('（1）（　　　　）');
    expect(out).toContain('<span class="blank-6">&emsp;</span>');
    expect(out).not.toMatch(/\(<span class="blank/);
  });

  it('括号+下划线组合 （＿ ＿） → span', () => {
    const out = normalizeBlankMarkers('一（＿ ＿）海鸥');
    expect(out).toContain('<span class="blank-');
    expect(out).not.toContain('＿');
  });

  it('已有 blank-N 标签不重复转换（幂等）', () => {
    const once = normalizeBlankMarkers('（　　　　）');
    const twice = normalizeBlankMarkers(once);
    expect(twice).toBe(once);
  });

  it('零宽全角（）→ 默认留空格（语境写词语漏空格回归：美丽的（）园）', () => {
    const out = normalizeBlankMarkers('美丽的（）园。杨（）高高的。');
    expect(out).toContain('美丽的<span class="blank-4">&emsp;</span>园');
    expect(out).toContain('杨<span class="blank-4">&emsp;</span>高高的');
    expect(out).not.toContain('（）');
  });

  it('含内文的括号不误转（分值/读音/序号/提示标注保持原样）', () => {
    const out = normalizeBlankMarkers('（每空1分）选（háng　xíng）。（1）第（2）题（提示：huā、shù）');
    expect(out).toContain('（每空1分）');
    expect(out).toContain('（háng　xíng）');
    expect(out).toContain('（1）');
    expect(out).toContain('（提示：huā、shù）');
    expect(out).not.toContain('<span class="blank-');
  });
});

describe('markSubQuestion 子题行标记（小题题号下的独立内容段 → sub-question 类）', () => {
  it('行首（N）的 p 补 class="sub-question"（无 class 形态）', () => {
    const out = markSubQuestion('<p>1. 看拼音写词语。</p><p>（1）tiān kōng（　　　　）</p><p>（2）sōng bǎi（　　　　）</p>');
    expect(out).toContain('<p class="sub-question">（1）');
    expect(out).toContain('<p class="sub-question">（2）');
    expect(out).toContain('<p>1. 看拼音写词语。</p>'); // 题号行不加
  });

  it('已有 class 的 p 追加 sub-question（不覆盖原 class）', () => {
    const out = markSubQuestion('<p class="question">4. 选一选。</p><p class="question">（1）公(　　　　)里。</p>');
    expect(out).toContain('<p class="question sub-question">（1）');
  });

  it('答案区同样标记（评分标准分点也走正式排版层级，与正文一致）', () => {
    const out = markSubQuestion('<p>（1）正文子题。</p><div class="answer-section"><p>（1）评分标准第一条</p></div>');
    expect(out).toContain('<p class="sub-question">（1）正文子题。</p>');
    expect(out).toContain('<div class="answer-section"><p class="sub-question">（1）评分标准第一条</p></div>');
  });

  it('选项字母（A）等非数字括号不命中；&emsp; 等实体不被改写', () => {
    const html = '<p>（A）选项内容。</p><p>（1）<span class="blank-4">&emsp;</span></p>';
    const out = markSubQuestion(html);
    expect(out).toContain('<p>（A）选项内容。</p>');      // 非数字不命中
    expect(out).toContain('<span class="blank-4">&emsp;</span>'); // 实体保留原样（无 DOM 序列化）
  });
});

