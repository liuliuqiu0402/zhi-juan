// 真机卷面回归（2026-10-23 属主贴的原始卷面）：
//   一、直接写得数（每题1分，共14分）→ 其下却出现 `1. 直接写出得数。（1分）`（标题复述被写成带号题）
//   二、列竖式计算（每题3分，共12分）→ 其下却出现 `2. 用竖式计算下面各题，书写要规范。（3分）`
//   三、填空（每空1分，共24分）→ 其下小题**一处分都没有**
// ============================================================
// 本文件锁两件事：
//   ① A 侧：不编号的大题（口算/竖式这类并列项）**不得把作答要求单独写成带号题**——
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

describe('① A 的禁令在位：不编号的大题不得把作答要求写成带号题', () => {
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
