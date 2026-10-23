// 混合整卷压力回归（2026-10-23 属主："每次修复后，可以多种情况混合测试下吗？"）
// ============================================================
// 一张卷里同时放：不编号组（口算/竖式）、带号带单价（填空）、带号单价在题（判断）、
// 带号多档（解决问题）、材料＋分条（阅读）、答案区镜像。
// ① 合规卷：该编号的编号并逐题标分、不该编号的一个号一个分都不加、标题按 Σ 合成；
// ② 违规卷（A 违约）：程序必须报出来或补齐，不得静默通过。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const run = (html) => auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
const heads = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
/** 取某个大题（按标题前缀）到下一个大题标题之间的正文行 */
const section = (html, prefix) => {
  const all = html.split(/\n/);
  const start = all.findIndex((l) => /<h[2-4]>/.test(l) && l.includes(prefix));
  if (start < 0) return [];
  const rest = all.slice(start + 1);
  const end = rest.findIndex((l) => /<h[2-4]>/.test(l));
  // 程序补的作答空行（blank-area）没有文字，会产出空串——剔掉，只留真正的内容行
  return pTexts((end < 0 ? rest : rest.slice(0, end)).join('\n')).filter((t) => t);
};

const PAPER = [
  '<h1>单元测评</h1>',
  '<p>（考试时间：60分钟　满分：46分）</p>',
  '<h3>一、直接写得数（每题1分，共8分）</h3>',
  '<p>3×5＝____　2×6＝____　4×3＝____　5×5＝____</p>',
  '<p>6×4＝____　7×2＝____　8×3＝____　9×4＝____</p>',
  '<h3>二、列竖式计算（每题3分，共6分）</h3>',
  '<p>24×3＝</p>',
  '<p>56÷7＝</p>',
  '<h3>三、填空（每空1分，共6分）</h3>',
  '<p>1. 6＋6＋6＋6表示____个6相加。</p>',
  '<p>2. 3个5相加，用乘法算式表示是____，读作____。</p>',
  '<p>3. 4×5读作____，表示____个____相加。</p>',
  '<h3>四、判断对错（每题2分，共6分）</h3>',
  '<p>1. 0 既不是正数也不是负数。（　）</p>',
  '<p>2. 分数的分子分母同时乘一个数，分数大小不变。（　）</p>',
  '<p>3. 假分数一定大于 1。（　）</p>',
  '<h3>五、解决问题（共6分）</h3>',
  '<p>1. 小明有 12 支铅笔，平均分给 3 人，每人几支？（2分）</p>',
  '<p>2. 一箱苹果 24 个，卖出 5 个，还剩几个？（4分）</p>',
  '<h3>六、阅读短文，完成练习（共10分）</h3>',
  '<p>春天来了，小草从地里钻出来。柳树发芽了，燕子飞回来了。</p>',
  '<p>（1）短文写了春天的哪些景物？</p>',
  '<p>（2）你最喜欢春天的什么？为什么？</p>',
  '<h2>参考答案</h2>',
  '<p>一、直接写得数（每题1分，共8分）</p>',
  '<p>二、列竖式计算（每题3分，共6分）</p>',
  '<p>三、填空（每空1分，共6分）</p>',
  '<p>四、判断对错（每题2分，共6分）</p>',
  '<p>五、解决问题（共6分）</p>',
  '<p>六、阅读短文，完成练习（共10分）</p>',
].join('\n');

describe('① 合规整卷：六种形态混在一张卷里各走各的支', () => {
  const r = run(PAPER);

  it('不编号组（口算/竖式）：一个号不加、一分不加、标题不动', () => {
    for (const [prefix, title] of [
      ['一、直接写得数', '一、直接写得数（每题1分，共8分）'],
      ['二、列竖式计算', '二、列竖式计算（每题3分，共6分）'],
    ]) {
      const rows = section(r.html, prefix);
      expect(rows.length, `${prefix} 行数不变`).toBeGreaterThan(0);
      expect(rows.join(''), `${prefix} 不得出现小题分`).not.toMatch(/（\d+分）/);
      expect(rows.filter((t) => /^\d{1,2}\s*[.、．]/.test(t)).length, `${prefix} 不得有题号`).toBe(0);
      expect(heads(r.html), `${prefix} 标题不动`).toContain(title);
    }
  });

  it('带号+标题单价（填空）：逐题标，1 空裸分／多空全式；标题按 Σ 合成多档', () => {
    const rows = section(r.html, '三、填空');
    expect(rows[0]).toMatch(/（1分）$/);
    expect(rows[1]).toMatch(/（每空1分，共2分）$/);
    expect(rows[2]).toMatch(/（每空1分，共3分）$/);
    expect(heads(r.html).find((t) => t.startsWith('三、填空')), 'Σ=6 → 多档')
      .toBe('三、填空（第1小题1分，第2小题2分，第3小题3分，共6分）');
  });

  it('带号+单价在题（判断）：逐题标；各题同分 → 单档', () => {
    const rows = section(r.html, '四、判断对错');
    for (const row of rows) expect(row, '每题都标').toMatch(/（2分）$/);
    expect(heads(r.html).find((t) => t.startsWith('四、判断')), '单档').toBe('四、判断对错（每题2分，共6分）');
  });

  it('带号+各题不同分（解决问题）：多档合成，列到小题号', () => {
    const rows = section(r.html, '五、解决问题');
    expect(rows[0]).toMatch(/（2分）$/);
    expect(rows[1]).toMatch(/（4分）$/);
    expect(heads(r.html).find((t) => t.startsWith('五、解决'))).toBe('五、解决问题（第1小题2分，第2小题4分，共6分）');
  });

  it('材料＋分条（阅读）：分条不算题号、不被标分；材料段不被标分', () => {
    const rows = section(r.html, '六、阅读');
    expect(rows[0], '材料段原样').toContain('春天来了');
    expect(rows[0], '材料段不得出现分值').not.toMatch(/（\d+分）/);
    for (const t of rows.slice(1)) {
      expect(t, '分条不挂分').not.toMatch(/（\d+分）/);
      expect(t, '分条不是题号').toMatch(/^（\d）/);
    }
  });

  it('答案区：同名大题镜像同一个合成结果', () => {
    expect(r.html).toContain('三、填空（第1小题1分，第2小题2分，第3小题3分，共6分）');
    expect(r.html).toContain('四、判断对错（每题2分，共6分）');
    expect(r.html).toContain('五、解决问题（第1小题2分，第2小题4分，共6分）');
  });

  it('全程不得有 warn（合规卷不该被挑剔）', () => {
    const warns = (r.silentDetails || []).filter((x) => x.level === 'warn');
    expect(warns.map((x) => x.message)).toEqual([]);
  });
});

describe('② 违规整卷（A 违约）：该报的报、该补的补，不得静默', () => {
  it('口算被编号 ⇒ 报"成句的题只有 0 道"（不删号）', () => {
    const bad = PAPER.replace('<p>3×5＝____　2×6＝____　4×3＝____　5×5＝____</p>', '<p>1. 3×5＝____</p>')
      .replace('<p>6×4＝____　7×2＝____　8×3＝____　9×4＝____</p>', '<p>2. 6×4＝____</p>');
    const r = run(bad);
    const warn = (r.silentDetails || []).filter((x) => /成句的题/.test(x.message));
    expect(warn.length, '必须报').toBe(1);
    expect(r.html, '号保留（程序不删结构）').toContain('1. 3×5＝____');
  });

  it('填空带了号但全无分 ⇒ B 全部补齐（不得留空）', () => {
    const r = run(PAPER);
    const rows = section(r.html, '三、填空');
    expect(rows.filter((t) => /（\d+分）$|（每.*共.*分）$/.test(t)).length, '3 道全标').toBe(3);
  });

  it('某题已带分、其余没带 ⇒ 只补没带的，已带的一字不动', () => {
    const mixed = PAPER
      .replace('<p>1. 6＋6＋6＋6表示____个6相加。</p>', '<p>1. 6＋6＋6＋6表示____个6相加。（1分）</p>');
    const rows = section(run(mixed).html, '三、填空');
    expect(rows[0], '已带分不得重复追加').toBe('1. 6＋6＋6＋6表示____个6相加。（1分）');
    expect(rows[1]).toMatch(/（每空1分，共2分）$/);
  });

  it('标题总数与逐题分不符 ⇒ 按 Σ 替换标题（原标题数不残留）', () => {
    const wrong = PAPER.replace('三、填空（每空1分，共6分）', '三、填空（每空1分，共12分）');
    const r = run(wrong);
    const t = heads(r.html).find((x) => x.startsWith('三、填空'));
    expect(t, 'Σ 为准').toContain('共6分');
    expect(t, '原 12 不残留').not.toContain('12分');
  });
});
