// 真机卷面回归（2026-10-23 属主贴的原始卷面）：
//   一、直接写得数（每题1分，共14分）→ 其下却出现 `1. 直接写出得数。（1分）`（标题复述被写成带号题）
//   二、列竖式计算（每题3分，共12分）→ 其下却出现 `2. 用竖式计算下面各题，书写要规范。（3分）`
//   三、填空（每空1分，共24分）→ 其下小题**一处分都没有**
// ============================================================
// 本文件锁两件事：
//   ① A 侧：直答区（口算/竖式这类并列项）**不得把作答要求单独写成带号题**——
//      这是 A 的禁令（promptLibrary 题名条）；B 只能报、不能删（删号会断全卷连续序号）。
//   ② B 侧：补逐题分是**逐行**的——原实现"只要有一段带分就整段不补"，
//      一处标题复述行带分，就把它下面所有小题的标分全挡住（属主："这个下面小题未标分，是因为啥？"）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const run = (html, subject = '数学') => auditExamPaper(html, { subject, stage: 'primary_mid', genType: 'exam' });
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const heads = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);

const KOU_SUAN = [
  '<h1>单元测评</h1>',
  '<h3>一、直接写得数（每题1分，共14分）</h3>',
  '<p>1. 直接写出得数。（1分）</p>',
  '<p>3×5＝____　2×6＝____　4×3＝____</p>',
  '<p>5×5＝____　6×4＝____　3×3＝____</p>',
].join('\n');

// 🔴 2026-10-23（属主真卷"三、填空（每空1分，共24分）7 道没标分"）：7 道里只有 1 道数不出判分处时，
//   原实现整段 return ⇒ 其余 6 道能算的也一道不补（全或无）。
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

describe('①·补 全或无已撤：能算的先补齐，算不出的只报', () => {
  it('7 道里 1 道数不出空位 ⇒ 其余 6 道照样补标，标题因 Σ 不完整不动', () => {
    const r = run(SEVEN);
    const rows = pTexts(r.html).filter((t) => /^\d\./.test(t));
    expect(rows.filter((t) => /（1分）$/.test(t)).length, '6 道补标').toBe(6);
    expect(rows[3], '数不出的那道不猜数').not.toMatch(/（\d+分）$/);
    const warn = (r.silentDetails || []).filter((x) => /补标 6 道/.test(x.message));
    expect(warn.length, '报点指明补了几道').toBe(1);
    expect(heads(r.html), 'Σ 不完整 ⇒ 标题不合成').toContain('三、填空（每空1分，共7分）');
  });

  it('长空格写的作答位也算判分处（真卷形态：写成十几个全角空格）', () => {
    const row = `<p>1. 4个3相加，写成加法算式是${'　'.repeat(10)}，写成乘法算式是${'　'.repeat(10)}，读作：${'　'.repeat(10)}。</p>`;
    const r = run(['<h1>卷</h1>', '<h3>三、填空（每空1分，共3分）</h3>', row].join('\n'));
    const t = pTexts(r.html).find((x) => x.startsWith('1.'));
    expect(t, '3 空 ⇒ 全式').toMatch(/（每空1分，共3分）$/);
  });

  it('零宽占位符写的作答位也算判分处（真卷形态：2×\u200C＝6）', () => {
    const row = '<p>1. 2×\u200C ＝6，\u200C ×5＝30。</p>';
    const r = run(['<h1>卷</h1>', '<h3>三、填空（每空1分，共2分）</h3>', row].join('\n'));
    const t = pTexts(r.html).find((x) => x.startsWith('1.'));
    expect(t, '2 空 ⇒ 全式').toMatch(/（每空1分，共2分）$/);
  });

  it('真卷「三、填空」7 道原样重放：一道都不留空（空位按导出的长空格/零宽符还原）', () => {
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
    const unscored = got.filter((t) => !/（\d+分）$|（每.*共.*分）$/.test(t));
    expect(unscored, `每道都要有分：${JSON.stringify(unscored)}`).toEqual([]);
    // 真卷标题写 24 分，而各题空位合计不等于 24 ⇒ Σ 为准，差异只记一条
    const title = heads(r.html).find((t) => t.startsWith('三、填空'));
    expect(title, '标题按 Σ 合成').not.toContain('24分');
    expect((r.silentDetails || []).concat(r.issues || []).some((x) => /Σ|按逐题分/.test(x.message)) ||
      (r.issues || []).some((x) => /共/.test(x.message)), '差异要留痕').toBe(true);
  });
});

describe('① A 的禁令在位：直答区不得把作答要求写成带号题', () => {
  it('B 侧只报不改：复述行带号 → 报"多余题号"，号与文字都保留（不删号会断连续序号）', () => {
    const r = run(KOU_SUAN);
    const sp = (r.issues || []).filter((x) => x.type === 'spurious-row-number').map((x) => x.message).join(' | ');
    expect(sp, '须报"该行只是标题复述"').toMatch(/标题|复述/);
    expect(r.html, '复述正文保留').toContain('直接写出得数');
    expect(r.html, '号不得被删').toContain('1. 直接写出得数');
  });
});

describe('② B 的补分是逐行的（一处带分不再挡住其余）', () => {
  it('三、填空：小题一处分都没有 → 按标题单价逐题补 + 按逐题分合成标题', () => {
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
    expect(ps[0]).toMatch(/（1分）$/);
    expect(ps[1]).toMatch(/（1分）$/);
    expect(ps[2], '三处判分写全式').toMatch(/（每空1分，共3分）$/);
    expect(heads(r.html)[0], '标题按逐题分合计（1+1+3=5）合成').toContain('共5分');
  });

  it('部分小题已带分：只补没分的那几行，已带分的一字不动（原实现全段跳过 → 一直不补）', () => {
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
    expect(ps[1], '缺分的要补').toMatch(/（1分）$/);
    expect(ps[2], '缺分的要补（三处写全式）').toMatch(/（每空1分，共3分）$/);
  });

  // 🔴 2026-10-23（属主真机："带单价的逐题标分，目前没有执行"·程序侧那一半）：
  //   括号空位里的空白常写成实体（`（&emsp;）`），原字符类只认全角/半角空格 ⇒ 判"一处判分处都没有"，
  //   于是补不了、只能报"数不出判分处"。本锁：实体空白同样按 1 空计，照常按单位分补并合成标题。
  it('括号空位用空白实体（&emsp;／&nbsp;）也计为判分处：照常补分并合成', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>三、填空（每空1分，共5分）</h3>',
      '<p>1. 5＋（&emsp;）＝9。</p>',
      '<p>2. （&nbsp;）比 3 大 2。</p>',
      '<p>3. 8 里面有（&emsp;）个 2，还有（&nbsp;&nbsp;）个 1。</p>',
    ].join('\n');
    const r = run(html);
    const ps = pTexts(r.html).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
    expect(ps[0], '1 空 ⇒ （1分）').toMatch(/（1分）$/);
    expect(ps[1], '1 空 ⇒ （1分）').toMatch(/（1分）$/);
    expect(ps[2], '2 空 ⇒ 全式（每空1分，共2分）').toMatch(/（每空1分，共2分）$/);
    expect(heads(r.html)[0], '标题按逐题分合计（1+1+2=4）合成').toContain('共4分');
  });

  // 🔴 2026-10-23（属主定分工："程序侧对于带小题号的题进行合成大标题的标分，分单档和多档"）：
  //   原实现要求标题**已经写着**共X分才合成（`if (!mB) return`）——标题没写分值就永远不合成。
  //   现改为：只要每道带号题都各有分值，B 就合成标题（标题有没有分值都合成）。
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

// 🔴 2026-10-23（A/B 分工核查·覆盖缺口）：
//   标题只写"（共X分）"（A 最常写的形态）时，1.6b-pre 不触发（它只认"每…共…"），1.6b 又因取不到逐题分
//   直接 return ⇒ "写了题号的行没标分"整段**零提示通过**（实测：判断对错 3 题全无分 → 无任何 issue）。
//   按 A 的硬规则"带号题个数＝标分个数"，B 至少要报出来；但**不得改数**（无单价可推，猜就是改总分）。
describe('③ 编号题缺分：B 必须报（只报不改）', () => {
  const html = [
    '<h1>单元测评</h1>',
    '<h3>三、判断对错（共10分）</h3>',
    '<p class="question">1. 0 既不是正数也不是负数。（　）</p>',
    '<p class="question">2. 分数的分子分母同时乘一个数，分数大小不变。（　）</p>',
    '<p class="question">3. 假分数一定大于 1。（　）</p>',
  ].join('\n');

  it('标题只写共X分 + 3 道带号题全未标分 ⇒ 报 warn，正文与分数一字不动', () => {
    const r = run(html);
    const warn = (r.silentDetails || []).filter((x) => x.level === 'warn' && /没标分/.test(x.message));
    expect(warn.length, '必须有报点（原先零提示）').toBe(1);
    expect(warn[0].message, '报点要指名大题').toContain('判断对错');
    expect(warn[0].message, '报点要说清几道').toContain('3 道');
    expect(r.html, '程序不改数：一行都不许被追加分值').not.toMatch(/（\d+分）/);
    expect(r.html, '标题不动').toContain('三、判断对错（共10分）');
  });
});
