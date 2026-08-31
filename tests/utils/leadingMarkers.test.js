import { describe, it, expect } from 'vitest';
import { normalizeLeadingMarkers } from '../../src/utils/contentCleaner.js';

describe('normalizeLeadingMarkers 行首"项目符号+序号"双标记归一', () => {
  it('字母序号：• A. → A.', () => {
    expect(normalizeLeadingMarkers('<p>• A. 草原迎客</p>')).toBe('<p>A. 草原迎客</p>');
  });
  it('字母序号（中文顿号）：● B、 → B、', () => {
    expect(normalizeLeadingMarkers('<li>● B、草原风光</li>')).toBe('<li>B、草原风光</li>');
  });
  it('圆圈序号：• ① → ①', () => {
    expect(normalizeLeadingMarkers('<p>• ① 轻声朗读课文两遍</p>')).toBe('<p>① 轻声朗读课文两遍</p>');
  });
  it('括号序号：◦ (1) → (1)', () => {
    expect(normalizeLeadingMarkers('<p>◦ (1) 第一小题</p>')).toBe('<p>(1) 第一小题</p>');
  });
  it('数字序号：▪ 1. → 1.', () => {
    expect(normalizeLeadingMarkers('<p>▪ 1. 勾勒(lè lēi)</p>')).toBe('<p>1. 勾勒(lè lēi)</p>');
  });
  it('多行混合（p 逐行）', () => {
    const html = '<p>• A. 草原迎客</p><p>• B. 草原风光</p><p>• 纯列表项</p>';
    expect(normalizeLeadingMarkers(html)).toBe('<p>A. 草原迎客</p><p>B. 草原风光</p><p>• 纯列表项</p>');
  });
  it('纯项目符号（无序号）不动', () => {
    const html = '<p>• 草原迎客</p>';
    expect(normalizeLeadingMarkers(html)).toBe(html);
  });
  it('无项目符号的普通序号不动', () => {
    const html = '<p>A. 草原迎客</p>';
    expect(normalizeLeadingMarkers(html)).toBe(html);
  });
  it('行首是标签（非文本）不动', () => {
    const html = '<p><u class="blank-4">&emsp;</u>• A. x</p>';
    expect(normalizeLeadingMarkers(html)).toBe(html);
  });
  it('幂等：二次处理不变化', () => {
    const once = normalizeLeadingMarkers('<p>• A. 草原迎客</p>');
    expect(normalizeLeadingMarkers(once)).toBe(once);
  });
});
