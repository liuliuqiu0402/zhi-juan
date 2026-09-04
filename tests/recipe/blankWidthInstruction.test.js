// 留白换算口径 buildBlankWidthInstruction 测试
// ============================================================
// 🔴 目的：锁定换算口径与排版规格 BLANK 的单一事实源契约——
//    - 数字由 BLANK 动态生成（wordGap→每字位 em、maxCap→单处上限字位数），规格改口径自动跟随
//    - 只讲宽度换算（空格数↔字位↔em），不出现横线/括号/下划线等形态词（防诱导，审核基准 2.4）
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildBlankWidthInstruction, BLANK } from '@/config/layoutSpec.js';

const FORM_WORDS = /横线|括号|下划线|＿|blank-\d/;

describe('buildBlankWidthInstruction（换算口径随 BLANK 动态生成）', () => {
  it('默认规格：主句只讲长度↔字位（不点名形态），换算括号保留全角空格计数锚', () => {
    const s = buildBlankWidthInstruction();
    expect(s).toContain('书写空间按照答案的长度倒推');
    expect(s).toContain('每一长度对应一个字位');
    expect(s).toContain('1 个全角空格≈1 个字位≈2 em');
    expect(s).toContain('8 字位');
    expect(s).toContain('16 em');
    // 主句无形态诱导词（主句 = 冒号前段 + 换算括号外部分）
    expect(s).not.toMatch(/横线|括号|下划线|＿|□|blank-\d/);
  });

  it('wordGap/maxCap 调整后口径自动跟随（不写死默认值）', () => {
    const s = buildBlankWidthInstruction({ ...BLANK, wordGap: 3, maxCap: 15 });
    expect(s).toContain('≈3 em');
    expect(s).toContain('5 字位'); // floor(15/3)
    expect(s).toContain('15 em');
    const s2 = buildBlankWidthInstruction({ ...BLANK, maxCap: 8 });
    expect(s2).toContain('4 字位'); // floor(8/2)
    expect(s2).not.toContain('8 字位');
  });

  it('只讲宽度换算，无形态诱导词', () => {
    const s = buildBlankWidthInstruction();
    expect(s).not.toMatch(FORM_WORDS);
  });

  it('与归一链换算口径一致：N em = 空格数 × wordGap（2 全角空格 → blank-4 → 4 em）', () => {
    const per = BLANK.wordGap;
    const s = buildBlankWidthInstruction();
    // 1 空格→1 字位→per em 是换算句的承诺，须与 BLANK 定义一致
    expect(s).toContain(`≈${per} em`);
    expect(BLANK.maxCap / per).toBeGreaterThanOrEqual(8); // 8 字位封顶来自 maxCap 16 ÷ wordGap 2
  });
});
