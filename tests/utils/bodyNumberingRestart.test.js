/**
 * 正文题号"按小节/栏目重启"判据单测（2026-09-26 用户裁定）
 * ============================================================
 * 背景：答案区规范要求"逐题以与正文完全相同的题号起头、全卷连续同序"。若正文自己按小节重启编号
 *   （实证：二年级语文"阅读测试卷"正文 `1、2、3` 后从 1 重数到 27），该要求无法满足 →
 *   模型失去可对齐基准，退化成只写尾部评分量表（逐题答案与解析全缺）。
 * 🔴 既有 detectBodyNumberingGap 查不出重启（`1,2,3,1..27` 的已出现集合就是 1..27、一个不缺）
 *   —— 本文件锁住"重启"这条独立判据必须守住的不变量。
 * 适用范围：仅试卷（exam）。教辅按大题分别从 1 编号是市场常态，不在本判据范围。
 */
import { describe, it, expect } from 'vitest';
import {
  detectBodyNumberingRestart, BODY_RESTART_MIN_TOP, detectBodyNumberingGap,
} from '../../src/utils/contentCleaner.js';

/** 把数字序列渲染成"每题一段"的正文 HTML（行首题号形态，与真实正文同构） */
const body = (nums) => nums.map((n) => `<p class="question">${n}. 题目${n}</p>`).join('\n');
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('detectBodyNumberingRestart —— 试卷正文题号必须全卷连续', () => {
  it('全卷连续 1..27 → 不判重启', () => {
    const r = detectBodyNumberingRestart(body(range(1, 27)));
    expect(r.segments).toEqual([27]);
    expect(r.top).toBe(27);
    expect(r.restart).toBe(false);
  });

  it('🔴 事故形态：1、2、3 后从 1 重数到 27 → 判重启（segments=[3,27]）', () => {
    const r = detectBodyNumberingRestart(body([...range(1, 3), ...range(1, 27)]));
    expect(r.segments).toEqual([3, 27]);
    expect(r.top).toBe(27);
    expect(r.restart).toBe(true);
  });

  it('🔴 关键：缺号守卫查不出这种重启（已出现集合就是 1..27、一个不缺）——故必须独立判', () => {
    const html = body([...range(1, 3), ...range(1, 27)]);
    expect(detectBodyNumberingGap(html)).toBeNull();   // 无缺口 → 缺号守卫放行
    expect(detectBodyNumberingRestart(html).restart).toBe(true); // 但重启判据拦下
  });

  it('保守门：题量过少（两段各 3 题、top<下限）不判重启', () => {
    const r = detectBodyNumberingRestart(body([...range(1, 3), ...range(1, 3)]));
    expect(r.segments).toEqual([3, 3]);
    expect(r.top).toBe(3);
    expect(r.top).toBeLessThan(BODY_RESTART_MIN_TOP);
    expect(r.restart).toBe(false);
  });

  it('保守门：短碎段（1..3 与 1..2，仅一段≥3）不判重启', () => {
    const r = detectBodyNumberingRestart(body([...range(1, 3), ...range(1, 2)]));
    expect(r.segments).toEqual([3, 2]);
    expect(r.restart).toBe(false);
  });

  it('空/无题号 → 不判（题量为 0）', () => {
    expect(detectBodyNumberingRestart('').restart).toBe(false);
    expect(detectBodyNumberingRestart('<p>正文无题号</p>').restart).toBe(false);
  });

  it('答案区不参与计数（只判正文体）', () => {
    const html = body(range(1, 8)) + '\n<div class="answer-section"><h2>参考答案</h2>'
      + body([...range(1, 2), ...range(1, 2)]) + '</div>';
    expect(detectBodyNumberingRestart(html).restart).toBe(false);
  });
});
