import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

/**
 * 语言学科教材原文口径（2026-09 用户定版）：
 *  - 语言学科（语文/英语）的字词句/语法类练习本就需要课文原句（用词适当形式填空、句型转换、连词成句、按原文填空等）
 *    → 走豁免句：可基于课文原句设题，但不得整段照抄、不得直接给出答案；
 *  - 其余学科维持原措辞（数据/情境/句式自拟、禁止沿用原文连续字面）；
 *  - 阅读训练（选文本应自拟）与错题本**有意不改**——本测试一并锁住"有针对性、不误改"。
 * 另锁：质量底线不再贬抑基础题型（去"机械刷题式作答"），课时练任务化改为"优先…亦可…"。
 */

const EXEMPT_KEY = '语言学科的字词句与语法类练习可基于课文原句设题';
const BAN_KEY = '禁止沿用原文连续字面';

const tpl = (subject, stage, genType) => getPromptTemplate({ grade: stage, subject, genType })?.template || '';

describe('语言学科教材原文豁免（语文/英语）', () => {
  it('语文课时练：走豁免句，不再出现"禁止沿用原文连续字面"', () => {
    const t = tpl('语文', 'primary_high', 'practice');
    expect(t).toContain(EXEMPT_KEY);
    expect(t).not.toContain(BAN_KEY);
  });

  it('英语课时练：走豁免句，不再出现"禁止沿用原文连续字面"', () => {
    const t = tpl('英语', 'middle', 'practice');
    expect(t).toContain(EXEMPT_KEY);
    expect(t).not.toContain(BAN_KEY);
  });

  it('英语专项突破 / 英语试卷：同样走豁免句（试卷的连词成句、语法填空需课文原句）', () => {
    expect(tpl('英语', 'middle', 'special')).toContain(EXEMPT_KEY);
    expect(tpl('英语', 'primary_high', 'exam')).toContain(EXEMPT_KEY);
  });

  it('非语言学科维持原措辞：数学/物理课时练与数学试卷仍为"禁止沿用原文连续字面"', () => {
    for (const [s, st] of [['数学', 'primary_high'], ['物理', 'middle']]) {
      const t = tpl(s, st, 'practice');
      expect(t, `${s} 应保留原措辞`).toContain(BAN_KEY);
      expect(t, `${s} 不应出现语言学科豁免句`).not.toContain(EXEMPT_KEY);
    }
    const ex = tpl('数学', 'middle', 'exam');
    expect(ex).toContain(BAN_KEY);
    expect(ex).not.toContain(EXEMPT_KEY);
  });

  it('有针对性不误改：阅读训练/错题本**不**注入豁免句（阅读选文本应自拟）', () => {
    expect(tpl('语文', 'primary_high', 'reading')).not.toContain(EXEMPT_KEY);
    expect(tpl('英语', 'middle', 'reading')).not.toContain(EXEMPT_KEY);
    expect(tpl('语文', 'primary_high', 'errorbook')).not.toContain(EXEMPT_KEY);
  });
});

describe('质量底线不再贬抑基础题型 + 课时练任务化非唯一', () => {
  it('质量底线：无"避免死记硬背、机械刷题式作答"，改为正向"不重复堆砌"', () => {
    const t = tpl('数学', 'primary_high', 'practice');
    expect(t).not.toContain('机械刷题式作答');
    expect(t).not.toContain('避免死记硬背');
    expect(t).toContain('不重复堆砌');
  });

  it('课时练：任务化改为"优先……亦可……"，不再是唯一形态', () => {
    const t = tpl('英语', 'middle', 'practice');
    expect(t).toContain('优先以学习任务组织');
    expect(t).toContain('内容不宜任务化时');
    expect(t).not.toContain('1. 以学习任务组织，任务含真实情境+活动+成果');
  });
});
