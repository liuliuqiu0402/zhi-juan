// 🔒 判据级"唯一出现"守卫（2026-09-30 用户裁定：判据是公共的；进发模型的每个判据只能出现一次）
// ============================================================
// 与 promptGrowthGuard（关键词条数上限）的区别：本守卫按**判据**（一条正则＝一个判据）断言**恰好出现一次**——
// 判据级而非关键词级，避免"同性质"这种跨管域的词被误当同义（实测该词横跨三个不同判据：同题内一致／同卷统一／不得另起载体）。
// 纪律：收紧一个锁一个（先把已核实冗余的判据收到 1，其余分批推进），避免一次性大改。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const tpl = (g = 'exam', s = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: s, genType: g }).template;
const count = (t, re) => (t.match(re) || []).length;

/** 判据 → 唯一性要求（每项：说明 + 正则 + 期望次数） */
const CALIBERS = [
  {
    name: '同题内同性质载体形态一致',
    re: /同一题内同性质作答载体|同一题（含并列子题）同性质空位的形态一致/g,
    want: 2, // 正句（作答位条款）1 + 题类自洽⑥引用句 1：⑥ 已改为"以作答位条款为准、不另立"，故实为 1 处正句 + 1 处引用
  },
  {
    name: '同卷空位形态统一',
    re: /同卷空位形态统一/g,
    want: 1,
  },
  {
    name: '不得另起同性质整行短答载体',
    re: /不得再另起/g,
    want: 1,
  },
];

describe('判据级"唯一出现"守卫（每判据只准一处正句，其余只能引用）', () => {
  it('已收口判据在试卷模板中各只出现规定次数', () => {
    const bad = [];
    for (const c of CALIBERS) {
      const n = count(tpl(), c.re);
      if (n !== c.want) bad.push(`「${c.name}」${n} 次 ≠ ${c.want}`);
    }
    expect(bad, '唯一出现被破坏（新增了第二处正句；应改为引用）').toEqual([]);
  });

  it('题类自洽⑥须为引用式（不得再复述形态判据）', () => {
    const t = tpl();
    expect(t).toContain('判据见作答位条款，此处不另立');
    expect(t, '⑥ 不得再自带形态判据原文').not.toContain('同一道题内**同性质**的作答载体形态须保持一致');
  });
});
