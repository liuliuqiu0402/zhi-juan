// 🔒 常驻守卫：跨学科中性化（①三维度）——共享块不得含他科专属实体名（2026-10-04 补锁）
// ============================================================
// 背景（①三维度 · 2026-10-03）：一条生成请求＝一个学段＋一个学科，实发里不得出现**他科专属实体名/术语**。
//   处置＝①优先门控；②共享块（多科共用）无法门控时**中性化**（去掉他科专属实体名，判据不丢）。
//   台账已登记 6 处：上下标化学例 / 单位条"物理化学地理同守" / [GRAPH]"几何图形" / 事实可信跨科枚举 /
//   自洽⑩"动词时态" / 书写载体名（载体名已由 carrier 系列守卫覆盖，本文件不重复）。
// 🔴 2026-10-18（全 486 面扫描补锁 6 处·同族）：层级归并"听力部分/笔试部分" / 自洽⑯"整篇选文类" /
//   三处同位"拼音"线索例 / 书写格位置条"拼音"书写对象例 / 卷内算式唯一性"口算"例 / 语英表达条"田字格/作文格"。
// ⚠️ **有界锁**（判据先看实际文本再写，防误伤）：
//   · 只锁**该共享条款所在行**，不做全库禁词——"几何/时态/化学式"在**本学科内容**里是合法词
//     （数学有"几何"、英语有"时态"），全库禁词必假红。
//   · 每条配**正向断言**（判据仍在），防"删概念以过守卫"（把路走窄）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { getValidatorRule } from '../../src/config/validatorRules.js';
import { getExamBlueprint } from '../../src/config/examPaperBlueprints.js';

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

  // ── 2026-10-18 全 486 面扫描补锁（同族 6 处） ──

  it('层级归并条：大类层序号示例不点英语专属"听力部分/笔试部分"；判据（相区分/不强加序号）仍在', () => {
    const ln = lineOf(TPL('数学'), '· 层级归并');
    expect(ln, '数学模板须含层级归并条').not.toBe('');
    expect(ln, '不得点名英语专属"听力部分"').not.toContain('听力部分');
    expect(ln, '不得点名英语专属"笔试部分"').not.toContain('笔试部分');
    expect(ln, '判据不得被删（序号相区分/不强加序号）').toMatch(/相区分|不强加序号/);
  });

  it('自洽⑯：整篇材料类管辖域不点语文专属"选文"；判据（该题设问所指向的对象）仍在', () => {
    const ln = lineOf(TPL('数学'), '· ⑯');
    expect(ln, '数学模板须含自洽⑯').not.toBe('');
    expect(ln, '不得点名语文专属"选文"').not.toContain('选文');
    expect(ln, '判据不得被删（该题设问所指向的对象）').toContain('该题设问所指向的对象');
  });

  it('三处同位条：线索示例不点语文专属"拼音"；判据（三处同位）仍在', () => {
    const ln = lineHas(TPL('数学'), '待答之处＝空位之处＝载体之处');
    expect(ln, '数学模板须含三处同位条').not.toBe('');
    expect(ln, '不得点名语文专属"拼音"').not.toContain('拼音');
    expect(ln, '判据不得被删（三处同位）').toContain('待答之处＝空位之处＝载体之处');
  });

  it('书写格位置条：书写对象示例按学科（英语面不点"拼音"、保留"字母/单词"）；判据（同行紧邻）仍在', () => {
    const ln = lineHas(TPL('英语', 'exam', '三年级'), '书写格必须与其所对应的');
    expect(ln, '英语模板须含书写格位置条').not.toBe('');
    expect(ln, '不得点名语文专属"拼音"').not.toContain('拼音');
    expect(ln, '须回补英语本学科等价用例（字母/单词）').toMatch(/字母|单词/);
    expect(ln, '判据不得被删（同行紧邻/一格一个书写对象）').toMatch(/同行紧邻|一格一个书写对象/);
  });

  it('卷内算式唯一性条：不点数学专属"口算"；判据（可互相替代）仍在', () => {
    const ln = lineHas(TPL('物理', 'exam', '七年级'), '卷内算式唯一性');
    expect(ln, '物理模板须含卷内算式唯一性条').not.toBe('');
    expect(ln, '不得点名数学专属"口算"').not.toContain('口算');
    expect(ln, '判据不得被删（可互相替代）').toContain('可互相替代');
  });

  it('语英表达条（程序附加段 promptHint）：不点学科专属载体名；判据仍在', () => {
    const h = String(getValidatorRule('writing-expression-fix').promptHint || '');
    expect(h, '不得点名语文专属"田字格"').not.toContain('田字格');
    expect(h, '不得点名语文专属"拼音格"').not.toContain('拼音格');
    expect(h, '不得点名语文专属"作文格"').not.toContain('作文格');
    expect(h, '判据不得被删（不叠用抄写类书写格/本学科成篇形态）').toMatch(/不叠用抄写类书写格|本学科成篇形态/);
  });

  it('道德与法治·小学低段蓝图注：不含语文专属"拼音"；判据（填空题）仍在', () => {
    const txt = JSON.stringify(getExamBlueprint('道德与法治', 'primary_low'));
    expect(txt, '不得点名语文专属"拼音"').not.toContain('拼音');
    expect(txt, '判据不得被删（填空题仍在）').toContain('填空题');
  });
});
