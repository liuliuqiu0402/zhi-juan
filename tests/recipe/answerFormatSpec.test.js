// 答案页格式规范 buildAnswerFormatSpec 测试（答案区与正文同构、不复述题干）
// ============================================================
// 🔴 目的：锁定答案页输出契约——
//    - 两条精简语义：答案按正文大题与题号层级组织、与正文同构；不复述题干、不重现作答空位
//    - 不得出现“→”式扁平编号写法（诱导实证防回潮）
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildAnswerFormatSpec } from '@/config/promptLibrary.js';

describe('buildAnswerFormatSpec（答案页：与正文同构、不复述题干）', () => {
  it('只含两条精简语义（与正文同构 + 不复述题干/作答空位）', () => {
    const s = buildAnswerFormatSpec();
    expect(s).toContain('按正文的大题与题号层级组织，与正文同构');
    expect(s).toContain('不复述题干原文');
    expect(s).toContain('不重现正文作答空位');
    // 层级/题号写法不再逐条列举（由"与正文同构"覆盖，避免诱导模型套用固定编号形态）
    expect(s).not.toContain('题号“1.”');
    expect(s).not.toContain('<h2>');
  });

  it('不得出现箭头式扁平编号写法（诱导实证，防回潮）', () => {
    const s = buildAnswerFormatSpec();
    expect(s).not.toContain('→');
    expect(s).not.toContain('大题号.子题号');
  });

  it('评分标准/听力原文条款保留（回归防丢）', () => {
    const s = buildAnswerFormatSpec('英语');
    expect(s).toContain('<table>');
    expect(s).toContain('听力原文');
  });
});
