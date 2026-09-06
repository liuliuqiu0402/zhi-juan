// 填空空位换算锚 buildBlankWidthInstruction 测试
// ============================================================
// 🔴 目的：锁定换算锚与排版规格 BLANK 的单一事实源契约——
//    - 数字由 BLANK 动态生成（wordGap→每字位 em），规格改口径自动跟随
//    - 纯计数锚：只讲"字位↔书写宽"换算，不含任何形态词（横线/括号/下划线/＿/blank-N）
//      ——2026-09 语义收敛：旧"按书写惯例输出对应作答书写载体，不得遗漏"整句已废弃，
//      形态归属改由 buildAnswerSpaceInstruction 按答案类型绑定（见 answerSpaceInstruction.test.js）
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildBlankWidthInstruction, BLANK } from '@/config/layoutSpec.js';

const FORM_WORDS = /横线|括号|下划线|＿|blank-\d|作答书写载体|书写惯例/;

describe('buildBlankWidthInstruction（换算锚随 BLANK 动态生成）', () => {
  it('默认规格：换算锚 = 字位↔全角空格↔em 计数锚（wordGap=1 默认 1:1）', () => {
    const s = buildBlankWidthInstruction();
    expect(s).toContain('1 字位');
    expect(s).toContain('1 个全角空格');
    expect(s).toContain('≈1 em');
  });

  it('wordGap 调整后口径自动跟随（不写死默认值）', () => {
    const s = buildBlankWidthInstruction({ ...BLANK, wordGap: 3, maxCap: 15 });
    expect(s).toContain('≈3 em');
    const s2 = buildBlankWidthInstruction({ ...BLANK, wordGap: 1 });
    expect(s2).toContain('≈1 em');
  });

  it('纯计数锚：无形态词、无旧"按书写惯例"句', () => {
    const s = buildBlankWidthInstruction();
    expect(s).not.toMatch(FORM_WORDS);
  });

  it('默认换算锚整句逐字锁定（不漏一字）', () => {
    expect(buildBlankWidthInstruction()).toBe('1 字位≈1 个全角空格≈1 em 书写宽');
  });

  it('与归一链换算口径一致：N em = 字位数 × wordGap（默认 1 字位 ≈ 1 em，不翻倍）', () => {
    const per = BLANK.wordGap;
    const s = buildBlankWidthInstruction();
    expect(s).toContain(`≈${per} em`);
    expect(BLANK.maxCap / per).toBeGreaterThanOrEqual(8); // 16 字位封顶 = maxCap 16 ÷ wordGap 1
  });
});
