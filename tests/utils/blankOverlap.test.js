// 空位载体叠写去重（normalizeBlankMarkers 跨类型紧邻收敛）测试
// ============================================================
// 🔴 目的（2026-09 docx 实证）：模型把同一答案位写成"填空横线 + 括号空"两种载体相邻叠加
//    （题 10"0.86×3.2 ＿（　）"→ 导出成"横线后括号"）——归一链收敛跨类型紧邻叠写，保留后出现者；
//    连续同类型标签（"( )( )"双括号 / 双横线）= 并列双空位，不去重。
// ============================================================
import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers } from '../../src/utils/contentCleaner.js';

describe('normalizeBlankMarkers 跨类型空位叠写去重', () => {
  it('下划线空 <u blank> 紧邻括号空 <span blank> → 去下划线、留括号空（一位一载体）', () => {
    const out = normalizeBlankMarkers('0.86 × 3.2 <u class="blank-8">&emsp;</u>（　　）');
    // 括号空先归一带 class span.blank-N，随后 u+span 紧邻 → 保留 span（后出现）
    expect(out).toMatch(/3\.2\s*<span class="blank-\d+">&emsp;<\/span>$/);
    expect(out).not.toContain('<u class="blank-');
  });

  it('括号空紧邻下划线空（反向）→ 去括号空、留下划线空（保后出现）', () => {
    const out = normalizeBlankMarkers('（　　）<u class="blank-8">&emsp;</u>');
    expect(out).not.toContain('<span class="blank-');
    expect(out).toContain('<u class="blank-8">&emsp;</u>');
  });

  it('连续同类型双括号空（( )( ) 并列双空位）→ 不去重', () => {
    const out = normalizeBlankMarkers('(　　　　)(　　　　)');
    expect((out.match(/<span class="blank-\d+">&emsp;<\/span>/g) || []).length).toBe(2);
  });

  it('两空位间有文字/符号 → 不去重（相邻但不同位）', () => {
    const out2 = normalizeBlankMarkers('(　　　　)＋<u class="blank-4">&emsp;</u>');
    expect((out2.match(/<span class="blank-\d+">&emsp;<\/span>/g) || []).length).toBe(1);
    expect(out2).toContain('<u class="blank-4">&emsp;</u>'); // 中间有"＋"，不合并
  });

  it('空段落 <p><br></p>（模型输出的空白作答行）→ 保留为空行，不被转填空横线', () => {
    const out = normalizeBlankMarkers('<p>1. 请写出计算过程。</p><p><br></p><p><br></p><p><br></p><p><br></p>');
    expect((out.match(/<br\s*\/?>/gi) || []).length).toBe(4);
    expect(out).not.toContain('<u class="blank-');
  });

  it('裸 <u> 包题干文字（模型误画线）→ 拆壳去画线；带 class 的空位 <u> 保留', () => {
    const out = normalizeBlankMarkers('<p>1. <u>请写出你的感受，并结合诗句简要分析。</u></p><p>2. 填空：<u class="blank-4">&emsp;</u></p>');
    expect(out).not.toContain('<u>请写出');
    expect(out).toContain('请写出你的感受，并结合诗句简要分析。');
    expect(out).toContain('<u class="blank-4">&emsp;</u>'); // 填空横线（合法）保留
  });

  it('A-101 题 3 实证：空格宽串 + 括号空（＝　　　（　　））→ 剥空格宽、只留括号空（一位一载体）', () => {
    const out = normalizeBlankMarkers('(1) 得数保留一位小数：7.2 × 0.09＝　　　（　　　　）');
    expect(out).toMatch(/7\.2 × 0\.09＝<span class="blank-\d+">&emsp;<\/span>$/);
    expect(out).not.toContain('<u class="blank-'); // 空格宽不得另行成横线
  });

  it('A-101 题 3 反向：空格宽串 + 下划线空（＝＿＿＿）→ 剥空格宽、留下划线空', () => {
    const out = normalizeBlankMarkers('(1) 7.2 × 0.09＝　　　＿＿＿');
    expect(out).toMatch(/＝<u class="blank-\d+">&emsp;<\/u>$/);
    expect(out).not.toContain('　　　');
  });

  it('单个自然空格 + 空位 → 不误剥（空格为间隔非载体）', () => {
    const out = normalizeBlankMarkers('答： （　　　　）');
    expect(out).toContain('<span class="blank-');
  });
});
