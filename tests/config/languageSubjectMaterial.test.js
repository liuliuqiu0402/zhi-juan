import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

/**
 * 教材原文口径（2026-09-13 用户定版·双向开放）：
 *  - 教材与课外**等权**：教材原文是"可选参考"之一，来源不作指定——
 *    **不写正向钉死**（"须出自原文/须以原文表述"），**也不写反向钉死**（"一律自拟/禁止沿用原文连续字面"）；
 *  - 全学科（语言学科与非语言学科）统一同一句开放口径：旧口径按学科分两套措辞、两句互相矛盾（一句禁止沿用原文、
 *    一句可基于课文原句），模型只能自选 → 已收敛为一句；
 *  - 只保留与"来源"无关的判定：引用教材内容须与原文一致（准确性）；不得照搬教材原题（原创性）。
 * 另锁：质量底线不再贬抑基础题型（去"机械刷题式作答"），课时练任务化改为"优先…亦可…"。
 */

const OPEN_KEY = '来源不限、不作指定';
// 钉死措辞（正反两向）——任何题类模板都不应再出现
const BIND_KEYS = ['须出自原文', '须以原文表述', '一律自拟，禁止沿用原文连续字面'];

const tpl = (subject, stage, genType) => getPromptTemplate({ grade: stage, subject, genType })?.template || '';

describe('教材原文口径·双向开放（不钉死来源）', () => {
  it('语言学科（语文/英语）课时练/专项/试卷：走统一开放句，无正向或反向钉死', () => {
    const cases = [
      ['语文', 'primary_high', 'practice'],
      ['英语', 'middle', 'practice'],
      ['英语', 'middle', 'special'],
      ['英语', 'primary_high', 'exam'],
    ];
    for (const [s, st, t] of cases) {
      const text = tpl(s, st, t);
      expect(text, `${s}/${t} 应含统一开放句`).toContain(OPEN_KEY);
      for (const k of BIND_KEYS) {
        expect(text, `${s}/${t} 不应出现钉死措辞：${k}`).not.toContain(k);
      }
    }
  });

  it('非语言学科（数学/物理）课时练与试卷：同样走统一开放句（不再"一律自拟/禁止沿用原文")', () => {
    for (const [s, st] of [['数学', 'primary_high'], ['物理', 'middle']]) {
      const text = tpl(s, st, 'practice');
      expect(text, `${s} 应含统一开放句`).toContain(OPEN_KEY);
      for (const k of BIND_KEYS) {
        expect(text, `${s} 不应出现钉死措辞：${k}`).not.toContain(k);
      }
    }
    const ex = tpl('数学', 'middle', 'exam');
    expect(ex, '数学/exam 应含统一开放句').toContain(OPEN_KEY);
    for (const k of BIND_KEYS) {
      expect(ex, `数学/exam 不应出现钉死措辞：${k}`).not.toContain(k);
    }
  });

  it('全库不再出现正向钉死"须出自原文/须以原文表述"（含阅读训练/错题本等其余题类）', () => {
    const cases = [
      ['语文', 'primary_high', 'reading'],
      ['英语', 'middle', 'reading'],
      ['语文', 'primary_high', 'errorbook'],
      ['数学', 'primary_high', 'summary'],
      ['英语', 'middle', 'review'],
    ];
    for (const [s, st, t] of cases) {
      const text = tpl(s, st, t);
      expect(text, `${s}/${t}`).not.toContain('须出自原文');
      expect(text, `${s}/${t}`).not.toContain('须以原文表述');
    }
  });

  it('图依赖题：注入"必须输出 [IMAGE] 块、不得用文字描述替代"的硬要求', () => {
    const t = tpl('英语', 'primary_high', 'practice');
    expect(t).toContain('必须在题干后紧跟输出 [IMAGE] 块');
    expect(t).toContain('严禁');
    expect(t).toContain('文字描述替代 [IMAGE] 块');
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
