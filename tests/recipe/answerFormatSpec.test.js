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
    expect(s).toContain('按正文的大题与题号组织，与正文同构');
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

  it('短答案紧凑密度原则（只有抄写/听写/默写可合段；其余逐题独立成行并附解析），但不给可照抄模板', () => {
    const s = buildAnswerFormatSpec();
    // 不带解析的只有一类：答案本身就是完整作答、无可说明依据的（抄写、听写、默写）
    expect(s).toContain('不带解析的只有一类');
    expect(s).toContain('抄写、听写、默写');
    expect(s).toContain('统排在一段内用全角空格依次分隔、不逐项独占一行');
    // 2026-10-24（属主真机"解析一个都没有"）：其余各题（含数值、√×、选择、填空）逐题独立成行、解析不得省
    expect(s).toContain('一律逐题独立成行并附解析，解析不得省');
    // 反向锁：不得把数值/√× 这类需要讲依据的题列为"不带解析"（旧口子＝整卷读成一律不写解析）
    expect(s, '旧"不带解析的短答案题（数值…）"不得回潮').not.toContain('不带解析**的短答案题');
    // 不写死"（1）3.84（2）0.28"形式（防模型照抄成扁平编号，诱导回归）
    expect(s).not.toContain('3.84');
  });

  it('听力原文条款保留（仅英语），且不再指定评分标准/量表结构（2026-09-26 去诱导）', () => {
    const en = buildAnswerFormatSpec('英语');
    expect(en).toContain('听力原文');
    // 🔴 根治：委托不指定"评分标准/等级表"的结构——此前"评分标准/等级表用 <table>"
    //    把答案任务诱导成"产出一个评分量表"（实证：语文卷答案区只剩最后一题等级量表）。
    expect(en).not.toContain('评分标准');
    expect(en).not.toContain('等级表');
    // 非英语学科不注入听力条款
    expect(buildAnswerFormatSpec('语文')).not.toContain('听力原文');
  });
});
