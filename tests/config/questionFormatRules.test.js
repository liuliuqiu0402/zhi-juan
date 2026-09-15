// 2026-09：题目自洽总纲补位（⑪⑫⑬）回归（原称"卷面自洽"，2026-09-12 改类型中性名）
// ⑪ 题干指示作答所用的线形/标记名加中文引号（用“波浪线”划出/“横线”画出），不以图形替换名称；
// ⑫ 写序号/字母入槽的作答位默认括号或横线，不默认用圈（○）槽（题干明说“圈/○里”才用圈并须真给 ○）。
// ⑬（2026-09-15 用户裁定·根修）题干对答案提出的形式性要求须在答案中真实成立——实证缺陷：
//    某份英语同步练习的韵律诗题要求"使诗歌押韵"，而答案是 keep/deep/see/green，
//    (1)keep 与 best、(4)green 与 far 并不押韵，解析里自己写了"不押韵但…"（题面与答案不自洽）。
//    用户裁定：不做单题修补，从根上解决 → ⑩原本只覆盖"时态呼应/要素不矛盾"，
//    缺"题干声明的形式性约束 ↔ 答案成立性"这一类判据；⑬以**性质**表述补位（不枚举具体形式），
//    凡对答案本身的字面/形式限定与呼应关系（押韵、节奏、字数、首字母、读音、格式……）自动落入。
// 题类格式经 QUESTION_FORMAT 注入，内容型（summary/preview）不走本块。
import { describe, it, expect } from 'vitest';
import { buildOutputFormatHint } from '../../src/config/promptLibrary.js';

describe('题目自洽总纲 ⑪⑫⑬（2026-09）', () => {
  it('题类格式：线形名加引号 + 序号入槽默认不用圈', () => {
    const q = buildOutputFormatHint({ subject: '语文', stage: 'primary_high', genType: 'practice' });
    expect(q).toContain('用“波浪线”划出');
    expect(q).toContain('用“横线”画出');
    expect(q).toContain('不默认用圈（○）槽');
    expect(q).toContain('仅题干明说“圈/○里”时用圈形空位并须真实给出 ○');
  });

  it('⑬形式性要求须在答案中成立（性质表述、不枚举具体形式、不点题型名）', () => {
    const q = buildOutputFormatHint({ subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(q).toContain('⑬题干对答案提出的**形式性要求**须在答案中真实成立');
    expect(q).toContain('答案就必须真的满足；做不到时改题干或改答案，二者取一，不得让题干声明与答案不一致');
    // 性质表述：不得回退为"押韵/字数/首字母…"式枚举，也不得点题型名
    const clause = q.slice(q.indexOf('⑬'));
    expect(clause, '不得枚举具体形式').not.toMatch(/押韵|节奏|字数|首字母|音标/);
    expect(clause, '不得点题型名').not.toMatch(/选择题|判断题|填空题|简答题|计算题|仿写题/);
  });

  it('内容型格式不注入题类载体约束（防向梳理型广播）', () => {
    const c = buildOutputFormatHint({ subject: '语文', stage: 'primary_high', genType: 'summary' });
    expect(c).not.toContain('不默认用圈');
    expect(c).not.toContain('题目自洽');
    expect(c, '内容型不得注入 ⑬').not.toContain('⑬题干对答案提出的');
  });
});
