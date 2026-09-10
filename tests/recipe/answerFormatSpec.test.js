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

  it('短答案紧凑密度原则（同大题短答案一律合段连排；长答案独立成行），但不给可照抄模板', () => {
    const s = buildAnswerFormatSpec();
    // 短数据/符号/词并列小题答案统排一段、不逐项独占一行（2026-09-10 升级为"必须执行"：多段即违规）
    expect(s).toContain('由短数据/符号/词构成的并列小题答案');
    expect(s).toContain('统排在一段内用全角空格依次分隔，不逐项独占一行');
    expect(s).toContain('同一大题内各短答案小题被拆成多段即属违规');
    // 长答案独立成行、大题分界保留
    expect(s).toContain('含完整句子、推理步骤或解析的长答案，保持独立成行');
    // 不写死"（1）3.84（2）0.28"形式（防模型照抄成扁平编号，诱导回归）
    expect(s).not.toContain('3.84');
  });

  it('评分标准/听力原文条款保留（回归防丢）', () => {
    const s = buildAnswerFormatSpec('英语');
    expect(s).toContain('<table>');
    expect(s).toContain('听力原文');
  });
});
