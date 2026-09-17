import { describe, it, expect } from 'vitest';
import {
  extractBodyQuestionNumbers,
  extractBodyQuestionSequence,
  isBodyQuestionSeqChanged,
} from '../../src/utils/contentCleaner.js';

/**
 * 正文冻结比对（2026-09-15 用户定版）：**形态归一 + 二次判定**——
 * 根治"题号形态切换被误报为正文被改动"。
 *
 * 实证（某六年级英语同步训练）：五、单项选择 的题首作答位由"括号空"变为"下划线空"；
 *   旧提取规则（只认行首 `N.`）使快照 21 → 交付 34，报"答案生成后正文题号序列发生变化"，
 *   而正文经同规则复算完整无缺（11 大题、每题号连续、答案逐题对应）——属**误报**。
 */
const PAREN_FORM = `<h3>五、单项选择</h3>
<p class="question">（　）1. My brother rides a bike to school last Monday.<br>A. ride　B. rides　C. rode</p>
<p class="question">（　）2. — How was your weekend?<br>A. was　B. were</p>`;

const BLANK_FORM = `<h3>五、单项选择</h3>
<p class="question"><u class="blank-2"> </u>1. My brother rides a bike to school last Monday.<br>A. ride　B. rides　C. rode</p>
<p class="question"><u class="blank-2"> </u>2. — How was your weekend?<br>A. was　B. were</p>`;

describe('正文题号序列 · 形态归一（extractBodyQuestionSequence）', () => {
  it('题首"作答位 + 序号"两种形态均计入题号（2026-09-17 起：作答括号在题号前也识别；旧规则只认行首 N. 是该误报的根因）', () => {
    expect(extractBodyQuestionNumbers(PAREN_FORM)).toEqual([1, 2]);
    expect(extractBodyQuestionNumbers(BLANK_FORM)).toEqual([1, 2]);
  });

  it('归一后两种形态给出同一序列（括号空位/下划线空位被剔除后同为行首序号）', () => {
    expect(extractBodyQuestionSequence(PAREN_FORM)).toEqual([1, 2]);
    expect(extractBodyQuestionSequence(BLANK_FORM)).toEqual([1, 2]);
    expect(extractBodyQuestionSequence(PAREN_FORM).join(','))
      .toBe(extractBodyQuestionSequence(BLANK_FORM).join(','));
  });

  it('答案区不计入（沿用"答案区前"截断口径）', () => {
    const withAns = `${BLANK_FORM}
<h2>参考答案与解析</h2>
<p>五、1. C　2. A</p>`;
    expect(extractBodyQuestionSequence(withAns)).toEqual([1, 2]);
  });

  it('空内容/无题号安全返回空数组', () => {
    expect(extractBodyQuestionSequence('')).toEqual([]);
    expect(extractBodyQuestionSequence('<p>一段没有题号的说明文字</p>')).toEqual([]);
  });
});

describe('冻结比对判定（isBodyQuestionSeqChanged）', () => {
  it('仅形态差异（集合与题数相同）→ 不判为改动', () => {
    expect(isBodyQuestionSeqChanged('1,2', [1, 2])).toBe(false);
  });

  it('顺序差异但集合与题数相同（如大题换位）→ 不判为改动', () => {
    expect(isBodyQuestionSeqChanged('1,2,3,1,2', [1,2,1,2,3])).toBe(false);
  });

  it('真实增题（题数变化）→ 判为改动', () => {
    expect(isBodyQuestionSeqChanged('1,2', [1, 2, 3])).toBe(true);
  });

  it('真实减题（集合变化）→ 判为改动', () => {
    expect(isBodyQuestionSeqChanged('1,2,3', [1, 3])).toBe(true);
  });

  it('任一侧为空（无题号资料）→ 不判', () => {
    expect(isBodyQuestionSeqChanged('', [])).toBe(false);
    expect(isBodyQuestionSeqChanged('1,2', [])).toBe(false);
    expect(isBodyQuestionSeqChanged([], [1, 2])).toBe(false);
  });
});
