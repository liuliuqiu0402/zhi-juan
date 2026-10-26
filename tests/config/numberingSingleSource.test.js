// 🔴 2026-10-24（属主"收"）：**编号判据只许有一处**。
//   实证：改判据前，"该不该编号"散在 4 处各说一遍——【分值标注】两区判据、【大题标题命名】
//   "题号只给要单独点名的题"、【层级与组织】"标题不是题不编号"、【卷面层级】"带不带题号随实际构成而定"。
//   四条不冲突，但各自换说法重新定义同一个决定 ⇒ 模型读到哪条按哪条办（属主："多处判据？"）。
//   现收口：编号决定**唯见 `NUMBERING_BRANCH_RULE`**（随【分值标注】进实发）；教辅只用它的**前一半**
//   （`NUMBERING_ONLY_RULE`，按切点派生）——练习册不判分。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const tpl = (subject, grade, genType) => (getPromptTemplate({ grade, subject, genType }).template) || '';
const count = (s, sub) => s.split(sub).length - 1;

describe('编号判据单源（2026-10-24 收口）', () => {
  const exam = tpl('数学', 'primary_low', 'exam');
  const practice = tpl('数学', 'primary_low', 'practice');

  it('试卷：编号判据在实发里**只出现一次**', () => {
    expect(count(exam, '先看整组')).toBe(1);
  });

  it('试卷：其余三处"同一决定"的旧说法零出现（防再散回去）', () => {
    expect(exam).not.toContain('题号只给要单独点名的题');
    expect(exam).not.toContain('带不带题号随实际构成而定');
    expect(exam).not.toContain('＜领域名＞（共Y分）');
  });

  it('试卷：单一开关、动作唯一、互锁，三件齐全', () => {
    expect(exam).toContain('还有没有自己的话');
    expect(exam).toContain('整组只按一种情况写');
    expect(exam).toContain('不许只有号没有分，也不许没有号却在题内标分');
  });

  it('教辅：只有编号那半，不含标分半句（练习册不判分）', () => {
    expect(practice).toContain('先看整组');
    expect(practice).not.toContain('每个带号小题在最后一行末尾标自己的分');
    expect(practice).not.toContain('单价只在大标题');
  });
});
