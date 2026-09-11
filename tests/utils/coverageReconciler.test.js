// 覆盖对账器遗留的共用文本工具单测（对账器本体已于 2026-09 废除，见 A9 清理）
// 保留原因：`stripHtmlForRecon` 仍被生产侧的 domainReconciler（域覆盖对账）复用。
import { describe, it, expect } from 'vitest';
import { stripHtmlForRecon } from '../../src/utils/coverageReconciler.js';

describe('coverageReconciler 遗留工具（stripHtmlForRecon）', () => {
  it('去标签单行化（对账只看是否出现，不看排版形态）', () => {
    expect(stripHtmlForRecon('<h2>小数乘整数</h2><p>算理：0.3×3&nbsp;＝&nbsp;0.9</p>')).toContain('小数乘整数');
    expect(stripHtmlForRecon('<h2>小数乘整数</h2><p>算理</p>')).not.toContain('<');
  });

  it('实体与空白归一：&nbsp; / &amp; 还原，连续空白折叠为单空格', () => {
    expect(stripHtmlForRecon('<p>a&nbsp;b</p>')).toBe(' a b ');
    expect(stripHtmlForRecon('<p>x&amp;y</p>')).toBe(' x&y ');
    expect(stripHtmlForRecon('<p>a   \t  b</p>')).toBe(' a b ');
  });

  it('空值/非字符串安全返回字符串（不抛错）', () => {
    expect(stripHtmlForRecon('')).toBe('');
    expect(stripHtmlForRecon(null)).toBe('');
    expect(stripHtmlForRecon(undefined)).toBe('');
  });
});
