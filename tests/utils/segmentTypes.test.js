import { describe, it, expect } from 'vitest';
import { isExtensionSegment, SEG_TYPE_EXTENSION, EXTENSION_TEXT_RE } from '../../src/utils/segmentTypes.js';

describe('段类型拓展/文化判定（复位 S4.1）', () => {
  it('type 标注命中直接判真', () => {
    expect(isExtensionSegment({ type: SEG_TYPE_EXTENSION, text: '任意内容' })).toBe(true);
    expect(isExtensionSegment({ type: '拓展/文化' })).toBe(true);
  });

  it('存量段 type=正文 按文本特征复判（你知道吗/数学文化/课外阅读）', () => {
    expect(isExtensionSegment({ type: '正文', text: '你知道吗：循环小数是无限小数的一种。' })).toBe(true);
    expect(isExtensionSegment({ type: '正文', text: '数学文化：古埃及的分数表示法。' })).toBe(true);
    expect(isExtensionSegment({ type: '正文', text: '课外阅读链接。' })).toBe(true);
  });

  it('正文规则句/例题/练习题不误判为拓展段', () => {
    expect(isExtensionSegment({ type: '正文', text: '小数乘整数：先按整数乘法算，再点小数点。' })).toBe(false);
    expect(isExtensionSegment({ type: '例题', text: '例1：0.3×3=0.9。' })).toBe(false);
    expect(isExtensionSegment({ type: '练习', text: '拓展应用：0.35×0.2＝' })).toBe(false); // 练习型"拓展应用"题不误标
    expect(isExtensionSegment({ type: '练习', text: '练一练。' })).toBe(false);
  });

  it('纯字符串输入（段文本）同样可用', () => {
    expect(isExtensionSegment('你知道吗：循环小数。')).toBe(true);
    expect(isExtensionSegment('正文规则句。')).toBe(false);
    expect(EXTENSION_TEXT_RE.test('')).toBe(false);
  });
});
