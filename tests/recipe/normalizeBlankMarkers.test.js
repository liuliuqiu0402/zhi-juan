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

  it('裸全角空格写作答题行保留 <p> 外壳（行尾 flex 延伸依赖它；拆裸 <u> 会塌缩）', () => {
    expect(normalizeBlankMarkers('<p>　　　　　　</p>')).toBe('<p><u class="blank-12">&emsp;</u></p>');
  });

  it('裸全角空格留空在 div/li 中外壳同样保留', () => {
    expect(normalizeBlankMarkers('<div>　　　　　　</div>')).toBe('<div><u class="blank-12">&emsp;</u></div>');
    expect(normalizeBlankMarkers('<li>　　　　　　</li>')).toBe('<li><u class="blank-12">&emsp;</u></li>');
  });

  it('单全角空格排版分隔不误转（≥2 才构成书写横线）', () => {
    expect(normalizeBlankMarkers('<p>　　你好</p>')).toBe('<p>　　你好</p>');
  });
});
