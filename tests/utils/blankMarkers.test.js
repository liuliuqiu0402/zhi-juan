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

describe('normalizeBlankMarkers 无 class 裸 u 空白横线归一（AI 裸输出形态 <u>全角空格</u>）', () => {
  it('整行 <u> 全角空格（40个，写作答题行）→ 归一为 u.blank-16（cap 上限，导出/预览自动延伸）', () => {
    const line = '<p><u>' + '　'.repeat(40) + '</u></p>';
    const out = normalizeBlankMarkers(line);
    expect(out).toContain('<u class="blank-16">&emsp;</u>');
    expect(out).not.toContain('　'.repeat(40));
  });

  it('短空白 <u>（4个全角空格）→ blank-8（1字≈2格）', () => {
    const out = normalizeBlankMarkers('<p>读短文。<u>' + '　'.repeat(4) + '</u></p>');
    expect(out).toContain('<u class="blank-8">&emsp;</u>');
  });

  it('2 个全角空格 <u> → blank-4（宽度下限内按 1字≈2格）', () => {
    const out = normalizeBlankMarkers('<p>读短文。<u>　　</u></p>');
    expect(out).toContain('<u class="blank-4">&emsp;</u>');
  });

  it('单个全角空格 <u> → 不归一（不构成书写横线，避免误伤强调场景）', () => {
    const html = '<p>a<u> </u>b</p>';
    expect(normalizeBlankMarkers(html)).toBe(html);
  });

  it('已有 class 的 u.blank-N / blank-line → 幂等不重复转换', () => {
    const once = normalizeBlankMarkers('<p><u class="blank-10">&emsp;</u></p>');
    const twice = normalizeBlankMarkers(once);
    expect(twice).toBe(once);
    expect(normalizeBlankMarkers('<p><u class="blank-line">&emsp;</u></p>')).toContain('blank-line');
  });

  it('u 内含文字（下划线强调）→ 不归一', () => {
    const html = '<p><u>重点词汇</u></p>';
    expect(normalizeBlankMarkers(html)).toBe(html);
  });
});

