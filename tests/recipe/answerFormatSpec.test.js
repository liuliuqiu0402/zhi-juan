// 答案页格式规范 buildAnswerFormatSpec 测试（答案区与正文同构、不复述题干）
// ============================================================
// 🔴 目的：锁定答案页输出契约——
//    - 答案按正文层级与题号组织（大题 <h2>、题号 1.、子题（1）（2）），与正文同构
//    - 不复述题干原文、不重现正文作答空位；不得出现“→”式扁平编号写法（诱导实证防回潮）
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildAnswerFormatSpec } from '@/config/promptLibrary.js';

describe('buildAnswerFormatSpec（答案页：与正文同构分层、不复述题干）', () => {
  it('含“与正文同构分层 + 不复述题干 + 不重现作答空位”契约', () => {
    const s = buildAnswerFormatSpec();
    expect(s).toContain('与正文同构');
    expect(s).toContain('题号“1.”与子题“（1）（2）”');
    expect(s).toContain('不复述题干原文');
    expect(s).toContain('不重现题干里的作答空位');
  });

  it('不得出现箭头式扁平编号写法（诱导实证，防回潮）', () => {
    const s = buildAnswerFormatSpec();
    expect(s).not.toContain('→');
    expect(s).not.toContain('大题号.子题号');
  });

  it('评分标准/听力原文条款保留（回归防丢）', () => {
    const s = buildAnswerFormatSpec('英语');
    expect(s).toContain('<h2>');
    expect(s).toContain('<table>');
    expect(s).toContain('听力原文');
  });
});
