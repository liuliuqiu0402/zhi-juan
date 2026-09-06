// 内容合理性扫描（Content Sanity）单测：确定性违规信号检测（荒谬计数倒推 / 同单位换算数值突变）
import { describe, it, expect } from 'vitest';
import { detectCountingFakes, detectUnitMutations, sanityScan, sanityNoteOf } from '../../src/utils/contentSanity.js';

describe('contentSanity 内容合理性扫描', () => {
  it('荒谬计数情境：小数 + 可数量词 + （即N）倒推 → 检出', () => {
    expect(detectCountingFakes('共卖出 0.86 张（即 86 张），单价 3.2 元。')).toHaveLength(1);
    expect(detectCountingFakes('平均分给 0.09 人（即 9 人）平均承担。')).toHaveLength(1);
    // 正常的小数量（长度/金额/质量）不误报
    expect(detectCountingFakes('彩带长 1.2 米，每张标签 0.24 米。')).toEqual([]);
  });

  it('同单位换算数值突变（2.05 千米（换算后 205 千米））→ 检出；不同单位不误报', () => {
    expect(detectUnitMutations('全程计划行驶 2.05 千米（单位换算后为 205 千米）。')).toHaveLength(1);
    // 不同单位（千米→米）是正常换算，不命中同单位突变规则
    expect(detectUnitMutations('全长 2.05 千米，等于 2050 米。')).toEqual([]);
    expect(detectUnitMutations('一段路长 2.05 千米，就是 2.05 千米。')).toEqual([]); // 同数值同单位不报
  });

  it('sanityScan 汇总两类信号；无违规则为空', () => {
    expect(sanityScan('卖出 0.86 张（即 86 张），行驶 2.05 千米（换算为 205 千米）。').length).toBe(2);
    expect(sanityScan('彩带 1.2 米，标签长 0.24 米，可剪 5 张。')).toEqual([]);
    expect(sanityScan('')).toEqual([]);
  });

  it('sanityNoteOf：只陈述事实、不诱导改法；空信号无提示', () => {
    const issues = sanityScan('买入 0.5 千克苹果（即 0.5 千克），共 2.5 元。');
    expect(sanityNoteOf(issues)).toBe('');
    const note = sanityNoteOf(['计数对象被写成小数后倒推整数：0.09人（即9人）']);
    expect(note).toContain('数据合理性扫描');
    expect(note).toContain('计数对象被写成小数后倒推整数');
    expect(sanityNoteOf([])).toBe('');
  });
});