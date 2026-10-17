import { describe, it, expect } from 'vitest';
import { composeScoreLabel } from '../../src/utils/examValidator.js';

describe('B 原语：单价×个数 → 真题写法（不做除法，故不会除不尽）', () => {
  it('每空1分 × 24 空', () => {
    expect(composeScoreLabel('空', 1, 24)).toBe('（每空1分，共24分）');
  });
  it('0.5 分档（初高中常见）× 8 处', () => {
    expect(composeScoreLabel('处', 0.5, 8)).toBe('（每处0.5分，共4分）');
  });
  it('无单位名 → 只写总数，不硬造单位', () => {
    expect(composeScoreLabel('', 2, 3)).toBe('（共6分）');
  });
  it('非法输入 → null（调用方保持原写法）', () => {
    expect(composeScoreLabel('空', 0, 5)).toBeNull();
    expect(composeScoreLabel('空', 1, -1)).toBeNull();
    expect(composeScoreLabel('空', 'x', 5)).toBeNull();
  });
  it('整数与 0.5 档均不产生无限小数', () => {
    for (const x of [0.5, 1, 2, 3]) {
      const r = composeScoreLabel('空', x, 7);
      expect(/共\d+(\.\d+)?分/.test(r), `${x}×7 应为有限小数`).toBe(true);
      expect(r).not.toMatch(/0\.333|0\.666|0\.166/);
    }
  });
});
