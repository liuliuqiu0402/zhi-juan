// 空白规范化后处理测试（AI 输出"一大段文本"时由代码补排版要素）
// ============================================================
import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers } from '@/utils/contentCleaner.js';

describe('normalizeBlankMarkers（后处理排版兜底）', () => {
  it('<u>＿N＿</u> 转 blank-N 宽度横线（1字≈2格）', () => {
    expect(normalizeBlankMarkers('<u>＿＿＿</u>')).toBe('<u class="blank-6">&emsp;</u>');
  });

  it('纯文本 ＿N 个转 blank-N（2≤N≤24）', () => {
    expect(normalizeBlankMarkers('＿＿＿＿')).toBe('<u class="blank-8">&emsp;</u>');
  });

  it('超长横线上限 16 格（超出页内边距的横线禁用，长答案走行尾自动延伸）', () => {
    expect(normalizeBlankMarkers('＿'.repeat(20))).toBe('<u class="blank-16">&emsp;</u>');
  });

  it('空作文格补默认格', () => {
    expect(normalizeBlankMarkers('<div class="zuo-wen-ge"></div>')).toContain('zuo-wen-ge');
    expect(normalizeBlankMarkers('<div class="zuo-wen-ge"></div>')).toContain('&emsp;');
  });

  it('无空白时原样返回', () => {
    const html = '<p>1. 选择题</p>';
    expect(normalizeBlankMarkers(html)).toBe(html);
  });
});
