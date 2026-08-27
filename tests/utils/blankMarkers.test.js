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
});
