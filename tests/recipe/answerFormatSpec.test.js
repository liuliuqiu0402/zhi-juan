// 答案页格式规范 buildAnswerFormatSpec 测试（答案区不复述题干）
// ============================================================
// 🔴 目的：锁定答案页输出契约——答案区不复述题干原文（含子题），按
//    “大题号.子题号 → 答案”组织，答案本身直接写全，不重现正文作答空位
//    （修：答案页照抄题干、下划线标注、两套载体形态）
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildAnswerFormatSpec } from '@/config/promptLibrary.js';

describe('buildAnswerFormatSpec（答案页格式：不复述题干）', () => {
  it('含“不复述题干、按 大题号.子题号→答案、不重现作答空位”契约', () => {
    const s = buildAnswerFormatSpec();
    expect(s).toContain('不复述题干原文');
    expect(s).toContain('大题号.子题号 → 答案');
    expect(s).toContain('不重现题干里的作答空位');
  });

  it('评分标准/听力原文条款保留（回归防丢）', () => {
    const s = buildAnswerFormatSpec('英语');
    expect(s).toContain('<h2>');
    expect(s).toContain('<table>');
    expect(s).toContain('听力原文');
  });
});
