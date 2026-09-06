// 内容合理性扫描（Content Sanity）单测：确定性违规信号检测（荒谬计数倒推 / 同单位换算数值突变 / 空位宽度单一化 / 任务可作答性错配）
import { describe, it, expect } from 'vitest';
import { detectCountingFakes, detectUnitMutations, detectUniformBlankWidths, sanityScan, sanityNoteOf } from '../../src/utils/contentSanity.js';

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

  it('空位宽度单一化（≥5 处 blank-N 且档位全同，如全 blank-8）→ 检出（未按答案长度逐空定宽）', () => {
    const html = [
      '<p>1. 把 6.25 看成整数 <u class="blank-8">&emsp;</u>，积是 <u class="blank-8">&emsp;</u>。</p>',
      '<p>2. 得数保留两位小数：<u class="blank-8">&emsp;</u>。</p>',
      '<p>3. 商的小数部分数字 <span class="blank-8">&emsp;</span> 依次重复。</p>',
      '<p>4. 结果是 <span class="blank-8">&emsp;</span>。</p>',
      '<p>5. 应付 <u class="blank-8">&emsp;</u> 元。</p>',
    ].join('\n');
    expect(detectUniformBlankWidths(html)).toHaveLength(1);
    expect(sanityScan(html)).toHaveLength(1);
  });

  it('空位宽度有差异（blank-1/blank-2/blank-4 混用）或数量 <5 → 不误报', () => {
    const varied = [
      '<p>1. <u class="blank-1">&emsp;</u> <u class="blank-2">&emsp;</u> <u class="blank-4">&emsp;</u></p>',
      '<p>2. <u class="blank-1">&emsp;</u> <u class="blank-2">&emsp;</u> <u class="blank-4">&emsp;</u></p>',
    ].join('\n');
    expect(detectUniformBlankWidths(varied)).toEqual([]);
    const few = '<p>1. <u class="blank-8">&emsp;</u> <u class="blank-8">&emsp;</u> <u class="blank-8">&emsp;</u> <u class="blank-8">&emsp;</u></p>';
    expect(detectUniformBlankWidths(few)).toEqual([]); // 仅 4 处 → 不触发
    // math-circle 算式填空圈（固定 1.8em 一格一符）不计入
    const circles = '<p>' + '<span class="math-circle-blank-18">&nbsp;</span>'.repeat(6) + '</p>';
    expect(detectUniformBlankWidths(circles)).toEqual([]);
  });

  it('答案本来等长 → 正常宽度全一致不误报（宽度以答案长度为准，不为差异而差异）', () => {
    const html = [
      '<p>1. 商是 <u class="blank-2">&emsp;</u>。</p>',
      '<p>2. 余数是 <u class="blank-2">&emsp;</u>。</p>',
      '<p>3. 差是 <u class="blank-2">&emsp;</u>。</p>',
      '<p>4. 积是 <u class="blank-2">&emsp;</u>。</p>',
      '<p>5. 和是 <u class="blank-2">&emsp;</u>。</p>',
    ].join('\n');
    expect(detectUniformBlankWidths(html)).toEqual([]); // 全 2 字位（答案均 2 位数）→ 正常
  });

  it('任务-可作答性错配：给加点字"选择读音"却无选项 → 检出；有 A. 选项 → 不报', () => {
    const noOpt = '<p>1. 给加点字选择正确的读音。</p><p>孟浩然的"然"读作(　　　　)。</p>';
    expect(sanityScan(noOpt)).toHaveLength(1);
    const withOpt = '<p>2. 为加点字选择正确读音。</p><p>A. rán　B. zhǔ</p>';
    expect(sanityScan(withOpt)).toEqual([]);
  });

  it('任务-载体错配：声明"写在横线上"却只有括号空 → 检出；有横线空/书写行 → 不报', () => {
    const onlyParen = '<p>1. 把下面的字写在横线上。</p><p>（1）dé(　　　　)高望重</p>';
    expect(sanityScan(onlyParen)).toHaveLength(1);
    const withLine = '<p>2. 把下面的字写在横线上。</p><p>（1）dé <u class="blank-4">&emsp;</u></p>';
    expect(sanityScan(withLine)).toEqual([]);
  });
});