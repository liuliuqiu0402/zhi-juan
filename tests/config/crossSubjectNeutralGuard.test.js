// 🔒 常驻守卫：跨学科中性化（①三维度）——共享块不得含他科专属实体名（2026-10-04 补锁）
// ============================================================
// 背景（①三维度 · 2026-10-03）：一条生成请求＝一个学段＋一个学科，实发里不得出现**他科专属实体名/术语**。
//   处置＝①优先门控；②共享块（多科共用）无法门控时**中性化**（去掉他科专属实体名，判据不丢）。
//   台账已登记 6 处：上下标化学例 / 单位条"物理化学地理同守" / [GRAPH]"几何图形" / 事实可信跨科枚举 /
//   自洽⑩"动词时态" / 书写载体名（载体名已由 carrier 系列守卫覆盖，本文件不重复）。
// ⚠️ **有界锁**（判据先看实际文本再写，防误伤）：
//   · 只锁**该共享条款所在行**，不做全库禁词——"几何/时态/化学式"在**本学科内容**里是合法词
//     （数学有"几何"、英语有"时态"），全库禁词必假红。
//   · 每条配**正向断言**（判据仍在），防"删概念以过守卫"（把路走窄）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { getValidatorRule } from '../../src/config/validatorRules.js';

const TPL = (subject, genType = 'exam', grade = '六年级') =>
  String(getPromptTemplate({ grade, subject, genType }).template || '');
/** 按行首标签取该共享条款所在行（有界判定） */
const lineOf = (text, prefix) => text.split('\n').find((l) => l.startsWith(prefix)) || '';
/** 取含某标记的行（有界判定） */
const lineHas = (text, token) => text.split('\n').find((l) => l.includes(token)) || '';

describe('跨学科中性化（①三维度）：共享块不含他科专属实体名（有界锁）', () => {
  it('上下标规则（数理化共用）：promptHint 不点化学专属例；判据（角标/计数）仍在', () => {
    const h = String(getValidatorRule('text-format-sup-sub').promptHint || '');
    expect(h, '不得点名化学专属例"化学式"').not.toContain('化学式');
    expect(h, '不得点名"离子"').not.toContain('离子');
    expect(h, '判据不得被删（角标/计数仍在）').toMatch(/角标|计数/);
  });

  it('数·量构造纪律·单位符号条：无"（物理化学地理同守）"括注；判据（单位/斜体）仍在', () => {
    const ln = lineOf(TPL('数学'), '· 单位与符号书写口径：');
    expect(ln, '数学模板须含单位符号条').not.toBe('');
    expect(ln, '不得写"物理化学地理同守"（与该条注入面不符且向数学广播他科名）').not.toContain('物理化学地理同守');
    expect(ln, '判据不得被删（单位符号/斜体仍在）').toMatch(/单位|斜体/);
  });

  it('事实可信条：不点名他科专属例；判据（确定性事实）仍在', () => {
    const ln = lineOf(TPL('语文'), '· 事实可信：');
    expect(ln, '语文模板须含事实可信条').not.toBe('');
    for (const t of ['法条', '史料引文', '艺术史归属', '实验数据']) {
      expect(ln, `不得点名他科专属例"${t}"`).not.toContain(t);
    }
    expect(ln, '判据不得被删（确定性事实仍在）').toContain('确定性事实');
  });

  it('题目自洽⑩：用中性"谓语形式"，不用英语专属术语"时态"', () => {
    const ln = lineOf(TPL('语文'), '· ⑩');
    expect(ln, '语文模板须含自洽⑩').not.toBe('');
    expect(ln, '判据不得被删（谓语形式仍在）').toContain('谓语形式');
    expect(ln, '不得用英语专属术语"时态"').not.toContain('时态');
  });

  it('[GRAPH] 标记名：中性"（数据、图形类）"，不含数学专属"几何图形"', () => {
    const ln = lineHas(TPL('数学'), '[GRAPH]');
    expect(ln, '数学模板须含 [GRAPH] 标记行').not.toBe('');
    expect(ln, '标记名须中性（图形类）').toContain('图形类');
    expect(ln, '不得写数学专属"几何图形"').not.toContain('几何图形');
  });
});
