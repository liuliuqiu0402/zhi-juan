import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers } from '../../src/utils/contentCleaner.js';

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

