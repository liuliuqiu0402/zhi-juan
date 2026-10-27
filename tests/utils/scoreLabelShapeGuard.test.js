// ============================================================
// 分值标注 · 产物形态守卫（2026-10-27）
// ------------------------------------------------------------
// 只验**产物形态**，不验提示词措辞（不锁"某句话在不在"）：
//   ① 标题的合成分以**各题标注之和**为准，与标题原声明是否相等无关（"不管自洽"）；
//   ② 合成后各题标注原样保留（逐题对账的落点不被吃掉）；
//   ③ 分组式覆盖全部题号，每个题号恰好出现一次；
//   ④ 幂等：同一份跑两遍不叠括注；
//   ⑤ 单题干（1 题）：程序不补分（补分是模型侧的活）。
// 分工依据：A 逐题标「每〈单位〉X分，共Y分」；B 只把**大题标题**合成为真题写法，不改数、不补分。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const OPTS = { subject: '数学', stage: 'primary_mid', genType: 'exam' };
const run = (html) => auditExamPaper(html, OPTS);
const titles = (html) => [...html.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);
const count = (s, sub) => (s.match(new RegExp(sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

// 标题声明 24 分，逐题标出来只有 11 分（A 抄了结构参考分、没数题内）
const MISMATCH = [
  '<h1>单元测评</h1>',
  '<h3>三、填空（共24分）</h3>',
  '<p>1. ____（每空1分，共3分）</p>',
  '<p>2. ____（每空1分，共4分）</p>',
  '<p>3. ____（每空2分，共4分）</p>',
].join('\n');

describe('分值标注 · 产物形态', () => {
  it('① 标题声明值与逐题之和不一致时，仍按逐题之和合成（不管自洽），并留报点', () => {
    const r = run(MISMATCH);
    expect(titles(r.html), '合成取各题之和，不取标题原声明').toContain(
      '三、填空（第1小题3分，第2、3小题各4分，共11分）',
    );
    expect(titles(r.html).join('|'), '不得把 24 写成合成结果').not.toContain('共24分');
    const hit = (r.silentDetails || []).find((x) => x.type === 'title-score-sum-mismatch');
    expect(!!hit, '声明与 Σ 不等须留报点（只报不改）').toBe(true);
    expect(hit.level, '报点不得阻断合成').not.toBe('debug');
  });

  it('② 合成后各题标注原样保留', () => {
    const r = run(MISMATCH);
    expect(count(r.html, '每空1分，共3分'), '第1题标注').toBe(1);
    expect(count(r.html, '每空1分，共4分'), '第2题标注').toBe(1);
    expect(count(r.html, '每空2分，共4分'), '第3题标注').toBe(1);
  });

  it('③ 分组式覆盖全部题号，每个题号恰好一次', () => {
    const t = titles(run(MISMATCH).html).find((x) => x.startsWith('三、填空'));
    expect(t).toBeTruthy();
    const nums = [...t.matchAll(/第([\d、]+)小题/g)]
      .flatMap((m) => m[1].split('、'))
      .filter(Boolean);
    expect(nums.slice().sort(), '题号集合＝全部题号且不重').toEqual(['1', '2', '3']);
    expect(nums.length, '每个题号恰好一次').toBe(3);
    expect(t, '总数取各题之和').toContain('共11分');
  });

  it('④ 幂等：同一份跑两遍不叠括注', () => {
    const once = run(MISMATCH).html;
    const twice = run(once).html;
    const t1 = titles(once).find((x) => x.startsWith('三、填空'));
    const t2 = titles(twice).find((x) => x.startsWith('三、填空'));
    expect(t2).toBe(t1);
    expect(count(t2, '分）），'), '不得出现连续两道分值括注').toBe(0);
  });

  it('⑤ 单题干（只有 1 题）：程序不补分，标题原样', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>四、看拼音写词语（共4分）</h3>',
      '<p>1. ____ ____（每空2分，共4分）</p>',
    ].join('\n');
    const t = titles(run(html).html).find((x) => x.startsWith('四、'));
    expect(t, '1 题不触发标题合成，也不补分').toBe('四、看拼音写词语（共4分）');
  });

  // 🔴 2026-10-27（属主："16分，核成了28分，报到了问题列表中"）：末题的分值读取不得越过答案区边界，
  //   否则最后一题会把答案区标题的"（每题4分，共16分）"吞进来 ⇒ Σ 虚高成 28。
  it('⑥ 末题不吞答案区标题的分值（16 不得核成 28）', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>八、解决问题（每题4分，共16分）</h3>',
      ...['1', '2', '3', '4'].map((n) => `<p class="question">${n}. 略。（每题4分，共4分）</p>`),
      '<h2>参考答案</h2>',
      '<h3>八、解决问题（每题4分，共16分）</h3>',
      '<p>1. 答案</p>',
    ].join('\n');
    const out = titles(run(html).html).join('|');
    expect(out, '按各题之和 16 合成').toContain('八、解决问题（每题4分，共16分）');
    expect(out, '不得出现 28').not.toContain('共28分');
  });
});
