import { describe, it, expect } from 'vitest';
import { normalizeMathCircleBlanks, cleanSectionHtml } from '../../src/utils/contentCleaner.js';

describe('normalizeMathCircleBlanks 数学算式填空圈归一（○ → 1.8em 圆形填空容器）', () => {
  it('算式比较中的 ○（两侧为数字）→ span.math-circle-blank-18', () => {
    expect(normalizeMathCircleBlanks('<p>5○3 比较大小</p>')).toBe('<p>5<span class="math-circle-blank-18">&nbsp;</span>3 比较大小</p>');
  });

  it('运算式填空中的 ○（运算符相邻）→ span.math-circle-blank-18', () => {
    expect(normalizeMathCircleBlanks('<p>3＋○＝7</p>')).toBe('<p>3＋<span class="math-circle-blank-18">&nbsp;</span>＝7</p>');
  });

  it('括号紧邻的算式 ○ → span.math-circle-blank-18', () => {
    expect(normalizeMathCircleBlanks('<p>（○）＋2＝5</p>')).toBe('<p>（<span class="math-circle-blank-18">&nbsp;</span>）＋2＝5</p>');
  });

  it('题干文字"在○里填"中的 ○（相邻为汉字）保持不变，不误伤', () => {
    expect(normalizeMathCircleBlanks('<p>在○里填上合适的数字</p>')).toBe('<p>在○里填上合适的数字</p>');
  });

  it('普通句子中的 ○ 保持不变', () => {
    expect(normalizeMathCircleBlanks('<p>请把正确答案写在○中。</p>')).toBe('<p>请把正确答案写在○中。</p>');
  });

  it('同段混合：题干 ○ 不转、算式 ○ 转（仅算式语境生效）', () => {
    expect(normalizeMathCircleBlanks('<p>在○里填上"＞""＜"或"="：5○3</p>')).toBe(
      '<p>在○里填上"＞""＜"或"="：5<span class="math-circle-blank-18">&nbsp;</span>3</p>'
    );
  });

  it('幂等：已转换结果再次归一不重复包裹', () => {
    const once = normalizeMathCircleBlanks('<p>5○3 比较</p>');
    expect(normalizeMathCircleBlanks(once)).toBe(once);
  });

  it('与 cleanSectionHtml 组合（生成端同款归一链）', () => {
    const src = '```html\n<p>7○9 比大小</p>\n```';
    expect(normalizeMathCircleBlanks(cleanSectionHtml(src))).toBe('<p>7<span class="math-circle-blank-18">&nbsp;</span>9 比大小</p>');
  });

  it('空输入安全返回', () => {
    expect(normalizeMathCircleBlanks('')).toBe('');
    expect(normalizeMathCircleBlanks(null)).toBe('');
  });
});
