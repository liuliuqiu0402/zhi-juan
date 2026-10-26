// 真机卷面回归（2026-10-23 属主贴的原始卷面）：
//   一、直接写得数（每题1分，共14分）→ 其下却出现 `1. 直接写出得数。（1分）`（标题复述被写成带号题）
//   二、列竖式计算（每题3分，共12分）→ 其下却出现 `2. 用竖式计算下面各题，书写要规范。（3分）`
//   三、填空（每空1分，共24分）→ 其下小题**一处分都没有**
// ============================================================
// 本文件锁三件事：
//   ① A 侧：不编号支（口算/竖式这类并列项）**不得把作答要求单独写成带号题**——
//      这是 A 的禁令（promptLibrary 题名条）；B 只能报、不能删（删号会断全卷连续序号）。
//   ② **程序不代模型补分**（属主 2026-10-23："我们不要程序侧补小题标分，小题标分必须是模型侧
//      根据题的实际内容标出…这个得严格执行才行，不能有任何折扣"）——缺分只报，正文一个字都不动。
//   ③ 报点要**准确**：报"几道没标分"必须点到实数（含长空格／零宽符写的作答位，不算"数不出"）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const run = (html, subject = '数学') => auditExamPaper(html, { subject, stage: 'primary_mid', genType: 'exam' });
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const heads = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);
/** 缺分报点（1.6b-pre 的那一条） */
const missWarn = (r) => (r.silentDetails || []).filter((x) => /道带题号的题没标分/.test(x.message));

const KOU_SUAN = [
  '<h1>单元测评</h1>',
  '<h3>一、直接写得数（每题1分，共14分）</h3>',
  '<p>1. 直接写出得数。（1分）</p>',
  '<p>3×5＝____　2×6＝____　4×3＝____</p>',
  '<p>5×5＝____　6×4＝____　3×3＝____</p>',
].join('\n');

// 7 道里只有 1 道数不出判分处（"在○里填上"没有空位载体）。
const SEVEN = [
  '<h1>单元测评</h1>',
  '<h3>三、填空（每空1分，共7分）</h3>',
  '<p>1. 2＋3＝____。</p>',
  '<p>2. 4＋5＝____。</p>',
  '<p>3. 6＋7＝____。</p>',
  '<p>4. 在○里填上"＞""＜"或"＝"。</p>',
  '<p>5. 8＋9＝____。</p>',
  '<p>6. 9＋9＝____。</p>',
  '<p>7. 10＋1＝____。</p>',
].join('\n');

describe('① 程序不代补：缺分只报，正文一字不动', () => {
  // 🔴 2026-10-25（属主定稿："带号一律逐题标分"）：上一版"每题至多一处判分的组可免逐题标分"已删——
  //   带号组缺分一律报（只报不改），程序仍不补、不改、不动结构。
  it('7 道单处题全没标分 ⇒ 必报 7 道，一道都不补，标题不动', () => {
    const r = run(SEVEN);
    const rows = pTexts(r.html).filter((t) => /^\d\./.test(t));
    expect(rows.length, '题号不得增删').toBe(7);
    expect(rows.filter((t) => /（\d+分）$|（每.*共.*分）$/.test(t)), '一行都不许被追加分值').toEqual([]);
    const w = missWarn(r);
    expect(w.length, '带号组缺分必报').toBe(1);
    expect(w[0].message, '报点要点到实数').toContain('7 道');
    expect(heads(r.html), '标题不动').toContain('三、填空（每空1分，共7分）');
  });

  it('单处组：标题共分与题数×单价不符 ⇒ 仍只报缺分（不补、不改数）', () => {
    const bad = SEVEN.replace('每空1分，共7分', '每空1分，共8分');
    const r = run(bad);
    const w = missWarn(r);
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message, '报点要点到实数').toContain('7 道');
    expect(w[0].message, '报点要说明程序不补').toContain('程序不补分');
    expect(pTexts(r.html).filter((t) => /^\d\./.test(t)).filter((t) => /（\d+分）$/.test(t)), '仍不补分').toEqual([]);
    expect(heads(r.html), '标题不动').toContain('三、填空（每空1分，共8分）');
  });

  it('长空格写的作答位也算判分处（真卷形态：十几个全角空格）⇒ 报"没标分"而不报"数不出"', () => {
    const row = `<p>1. 4个3相加，写成加法算式是${'　'.repeat(10)}，写成乘法算式是${'　'.repeat(10)}，读作：${'　'.repeat(10)}。</p>`;
    const r = run(['<h1>卷</h1>', '<h3>三、填空（每空1分，共3分）</h3>', row].join('\n'));
    const w = missWarn(r);
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message, '①②③ 三处作答位都数得出来').not.toContain('没有被识别到的作答位');
    expect(pTexts(r.html).find((x) => x.startsWith('1.')), '不得补分').not.toMatch(/（每空1分，共3分）$/);
  });

  it('零宽占位符写的作答位也算判分处（真卷形态：2×\u200C＝6）', () => {
    const row = '<p>1. 2×\u200C ＝6，\u200C ×5＝30。</p>';
    const r = run(['<h1>卷</h1>', '<h3>三、填空（每空1分，共2分）</h3>', row].join('\n'));
    const w = missWarn(r);
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message, '两处都数得出').not.toContain('没有被识别到的作答位');
    expect(pTexts(r.html).find((x) => x.startsWith('1.')), '不得补分').not.toMatch(/（每空1分，共2分）$/);
  });

  it('真卷「三、填空」7 道原样重放：一道都不补，报 7 道，标题保持原样', () => {
    const S = '　'.repeat(12);
    const Z = '\u200C';
    const rows = [
      `<p>9. 4个3相加，写成加法算式是${S}，写成乘法算式是${S}，读作：${S}。</p>`,
      `<p>10. 5+5+5+5+5＝${S}，用乘法表示是${Z} ×${Z} ，用的口诀是${S}。</p>`,
      `<p>11. 一六得${S}，三六${S}，四五${S}。</p>`,
      `<p>12. 2×6＝12中，2和6是${S}，12是${S}，×叫作${S}。</p>`,
      `<p>13. 3×5＝15，那么5×3＝${S}，这说明交换两个乘数的位置，积${S}。</p>`,
      `<p>14. 2×${Z} ＝6，${Z} ×5＝30，5×${Z} ＝20，${Z} ×4＝24。</p>`,
      `<p>15. 6×2+6＝${S}，6×3-6＝${S}，5×4+4＝${S}。</p>`,
    ];
    const r = run(['<h1>二年级数学上册综合检测</h1>', '<h3>三、填空（每空1分，共24分）</h3>', ...rows].join('\n'));
    const got = pTexts(r.html).filter((t) => /^\d+\./.test(t));
    expect(got.length, '7 道都在').toBe(7);
    expect(got.filter((t) => /（\d+分）$|（每.*共.*分）$/.test(t)), '一道都不许补').toEqual([]);
    const w = missWarn(r);
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message).toContain('7 道');
    expect(heads(r.html).find((t) => t.startsWith('三、填空')), 'Σ 不完整 ⇒ 标题不合成').toBe('三、填空（每空1分，共24分）');
  });
});

describe('① A 的禁令在位：不编号支不得把作答要求写成带号题', () => {
  it('B 侧只报不改：复述行带号 → 报"多余题号"，号与文字都保留（不删号会断连续序号）', () => {
    const r = run(KOU_SUAN);
    const sp = (r.issues || []).filter((x) => x.type === 'spurious-row-number').map((x) => x.message).join(' | ');
    expect(sp, '须报"该行只是标题复述"').toMatch(/标题|复述/);
    expect(r.html, '复述正文保留').toContain('直接写出得数');
    expect(r.html, '号不得被删').toContain('1. 直接写出得数');
  });
});

describe('② 报点按"哪几道"数，不按"整段"一刀切', () => {
  it('三、填空：3 道全没分 ⇒ 报 3 道，一行都不补', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>三、填空（每空1分，共6分）</h3>',
      '<p>1. 6＋6＋6＋6表示____个6相加。</p>',
      '<p>2. 3个5相加，用乘法算式表示是____。</p>',
      '<p>3. 4×5读作____，表示____个____相加。</p>',
    ].join('\n');
    const r = run(html);
    const ps = pTexts(r.html).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
    expect(ps.length, '题号不得增删').toBe(3);
    expect(ps.join('|'), '不得补任何分').not.toMatch(/（\d+分）|（每空/);
    const w = missWarn(r);
    expect(w.length, '只报一条').toBe(1);
    expect(w[0].message).toContain('3 道');
    expect(heads(r.html)[0], '标题不动').toBe('三、填空（每空1分，共6分）');
  });

  it('部分已带分：报点只数没带的那几道，已带的一字不动、没带的也不补', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>三、填空（每空1分，共5分）</h3>',
      '<p>1. 6＋6＋6＋6表示____个6相加。（每空1分，共1分）</p>',
      '<p>2. 3个5相加，用乘法算式表示是____。</p>',
      '<p>3. 4×5读作____，表示____个____相加。</p>',
    ].join('\n');
    const r = run(html);
    const ps = pTexts(r.html).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
    expect(ps[0], '已有分不得重复追加').toBe('1. 6＋6＋6＋6表示____个6相加。（每空1分，共1分）');
    expect(ps[1], '缺分不补').toBe('2. 3个5相加，用乘法算式表示是____。');
    expect(ps[2], '缺分不补').toBe('3. 4×5读作____，表示____个____相加。');
    const w = missWarn(r);
    expect(w.length).toBe(1);
    expect(w[0].message, '只数没带的 2 道').toContain('2 道');
  });

  it('括号空位写成空白实体（&emsp;／&nbsp;）也数得出：报 3 道，不误报"数不出"', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>三、填空（每空1分，共5分）</h3>',
      '<p>1. 5＋（&emsp;）＝9。</p>',
      '<p>2. （&nbsp;）比 3 大 2。</p>',
      '<p>3. 8 里面有（&emsp;）个 2，还有（&nbsp;&nbsp;）个 1。</p>',
    ].join('\n');
    const r = run(html);
    const w = missWarn(r);
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message).toContain('3 道');
    expect(w[0].message, '三道的空位都数得出').not.toContain('没有被识别到的作答位');
    expect(pTexts(r.html).join('|'), '不补分').not.toMatch(/（\d+分）|（每空/);
  });

  // 合成仍归程序（属主定：真题标分样式由程序侧合成）——这几条不受"不代补"影响。
  it('标题没写分值，但小题各有分 ⇒ B 仍合成（单档）', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>三、填空</h3>',
      '<p>1. 6＋6＋6＋6表示____个6相加。（1分）</p>',
      '<p>2. 3个5相加，用乘法算式表示是____。（1分）</p>',
      '<p>3. 4×5读作____。（1分）</p>',
    ].join('\n');
    const r = run(html);
    expect(heads(r.html)[0], '单档：每题同分').toContain('三、填空（每题1分，共3分）');
  });

  it('标题没写分值，各题分值不同 ⇒ B 合成多档（列到小题号）', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>四、解决问题</h3>',
      '<p>1. 小明有 12 支铅笔，平均分给 3 人，每人几支？（2分）</p>',
      '<p>2. 一箱苹果 24 个，卖出 5 个，还剩几个？（4分）</p>',
    ].join('\n');
    const r = run(html);
    expect(heads(r.html)[0], '多档：逐题列分值').toContain('四、解决问题（第1小题2分，第2小题4分，共6分）');
  });
});

// 标题只写"（共X分）"时不走 1.6b-pre（它只认"每…共…"），由 1.6b 报——两处不得同时报同一条。
describe('③ 编号题缺分：B 必须报（只报不改），且同一处只报一条', () => {
  const html = [
    '<h1>单元测评</h1>',
    '<h3>三、判断对错（共10分）</h3>',
    '<p class="question">1. 0 既不是正数也不是负数。（　）</p>',
    '<p class="question">2. 分数的分子分母同时乘一个数，分数大小不变。（　）</p>',
    '<p class="question">3. 假分数一定大于 1。（　）</p>',
  ].join('\n');

  it('标题只写共X分 + 3 道带号题全未标分 ⇒ 报 warn（仅一条），正文与分数一字不动', () => {
    const r = run(html);
    const warn = (r.silentDetails || []).filter((x) => x.level === 'warn' && /没标分/.test(x.message));
    expect(warn.length, '必须有报点、且只一条（不许两处各报一遍）').toBe(1);
    expect(warn[0].message, '报点要指名大题').toContain('判断对错');
    expect(warn[0].message, '报点要说清几道').toContain('3 道');
    expect(r.html, '程序不改数：一行都不许被追加分值').not.toMatch(/（\d+分）/);
    expect(r.html, '标题不动').toContain('三、判断对错（共10分）');
  });
});
