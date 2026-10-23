// 属主六问自检（2026-10-23）：
//   ① 编号/不编号能否精准区分执行；② 标分带不带单位能否精准区分；③ 能否逐题标；
//   ④ 合成能否精准区分单档/多档；⑤ 取分口径是否清晰可执行；⑥ 是否按小题分合成、可替换原标题。
// 每条都同时检验**判据在位**（实发文本）与**行为成立**（真跑校验器），避免"文本写了但程序不照做"。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, NUMBERING_BRANCH_RULE } from '../../src/config/promptLibrary.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const tpl = () => getPromptTemplate({ grade: 'primary_mid', subject: '数学', genType: 'exam' }).template;
const run = (html) => auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const numbered = (h) => pTexts(h).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
const head = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1])[0] || '';
const page = (title, rows) => ['<h1>单元测评</h1>', `<h3>${title}</h3>`, ...rows].join('\n');

describe('① 编号/不编号：单一判据 + 两条边界', () => {
  it('判据只有一个正面锚（成题区），且写死两条边界', () => {
    expect(NUMBERING_BRANCH_RULE, '正面锚').toContain('成题区');
    expect(NUMBERING_BRANCH_RULE, '边界一：句末作答位属同一句').toContain('作答位紧跟句末的括号空位或横线属同一句');
    expect(NUMBERING_BRANCH_RULE, '边界二：复述行不算').toContain('标题的复述行不算');
    expect(NUMBERING_BRANCH_RULE, '只按这一条判').toContain('只按这一条判');
    expect(tpl(), '不编号支有"成题区不成立"的作用域').toContain('成题区不成立');
  });

  it('行为：判断题（句末带括号空位）按编号题逐题补分', () => {
    const html = page('三、判断对错（每题2分，共6分）', [
      '<p class="question">1. 0 既不是正数也不是负数。（　）</p>',
      '<p class="question">2. 分数的分子分母同时乘一个数，分数大小不变。（　）</p>',
      '<p class="question">3. 假分数一定大于 1。（　）</p>',
    ]);
    const r = run(html);
    const rows = numbered(r.html);
    expect(rows.length, '题号不得增删').toBe(3);
    for (const row of rows) expect(row, '每行都要有分').toMatch(/（2分）$/);
    expect(head(r.html), '标题按逐题分合成').toContain('（每题2分，共6分）');
  });

  it('行为：并列算式（无成句）不编号、不补分、标题不动', () => {
    const html = page('一、直接写得数（每题1分，共4分）', [
      '<p>3×5＝____　2×6＝____</p>',
      '<p>4×3＝____　5×5＝____</p>',
    ]);
    const r = run(html);
    expect(rows0(r.html), '不得冒出新题号').toBe(0);
    expect(pTexts(r.html).join(''), '不得给无编号的行补分').not.toMatch(/（\d+分）/);
    expect(head(r.html), '标题保持原样（单价承载）').toBe('一、直接写得数（每题1分，共4分）');
  });
});

describe('② 标分：带不带单位可精准区分', () => {
  it('判据：一处判分写裸分；两处及以上写全式（带单位）', () => {
    const t = tpl();
    expect(t).toContain('先数几处判分');
    expect(t).toContain('一处写"（X分）"');
    expect(t).toContain('两处及以上写全式');
  });

  it('行为：1 空 →（1分）；3 空 →（每空1分，共3分）', () => {
    const html = page('三、填空（每空1分，共4分）', [
      '<p>1. 5＋____＝9。</p>',
      '<p>2. 8 里面有____个 2，____个 4，共____个 1。</p>',
    ]);
    const rows = numbered(run(html).html);
    expect(rows[0], '一处判分 ⇒ 裸分').toMatch(/（1分）$/);
    expect(rows[1], '多处判分 ⇒ 全式带单位').toMatch(/（每空1分，共3分）$/);
  });
});

describe('③ 逐题标：每道带号题都要有分', () => {
  it('行为：5 道带号题全无分 ⇒ 全部补上（缺一不可）', () => {
    const html = page('三、填空（每空1分，共5分）', [
      '<p>1. a____</p>', '<p>2. b____</p>', '<p>3. c____</p>', '<p>4. d____</p>', '<p>5. e____</p>',
    ]);
    const rows = numbered(run(html).html);
    expect(rows.length).toBe(5);
    expect(rows.filter((t) => /（\d+分）$|（每.*共.*分）$/.test(t)).length, '5 道全都要标').toBe(5);
  });
});

describe('④ 合成：单档/多档可精准区分', () => {
  it('行为：各题同分 ⇒ 单档', () => {
    const html = page('四、计算（共6分）', [
      '<p>1. 12＋8＝（3分）</p>', '<p>2. 15－7＝（3分）</p>',
    ]);
    expect(head(run(html).html)).toBe('四、计算（每题3分，共6分）');
  });

  it('行为：各题不同分 ⇒ 多档（列到小题号）', () => {
    const html = page('五、解决问题（共6分）', [
      '<p>1. 甲题（2分）</p>', '<p>2. 乙题（4分）</p>',
    ]);
    expect(head(run(html).html)).toBe('五、解决问题（第1小题2分，第2小题4分，共6分）');
  });
});

describe('⑤ 取分口径：只取"带题号那一行末"的小题总分', () => {
  it('行为：行末"（每空1分，共3分）"取 3（不是 1）', () => {
    const html = page('六、填空（共6分）', [
      '<p>1. x____y____z____（每空1分，共3分）</p>',
      '<p>2. p____q____r____（每空1分，共3分）</p>',
    ]);
    expect(head(run(html).html), '按 3+3 合成，按每空1分算会得 6 空×1').toBe('六、填空（每题3分，共6分）');
  });

  it('行为：行末没有分值 ⇒ 不猜，只报（不得把题干里的"共X分"当小题分）', () => {
    const html = page('七、综合（共10分）', [
      '<p>1. 这段材料共10分的内容要读完再答题。（　）</p>',
      '<p>2. 第二题（　）</p>',
    ]);
    const r = run(html);
    const warn = (r.silentDetails || []).filter((x) => x.level === 'warn');
    expect(warn.some((x) => /没标分/.test(x.message)), '必须报"没标分"').toBe(true);
    expect(head(r.html), '标题不得被猜成 10 以外的数').toContain('共10分');
  });
});

describe('⑥ Σ 为真值：按小题分合成，可替换原标题', () => {
  it('行为：标题写共10分、逐题分合计 6 ⇒ 标题替换为 6', () => {
    const html = page('八、应用（共10分）', [
      '<p>1. 甲（2分）</p>', '<p>2. 乙（4分）</p>',
    ]);
    const r = run(html);
    expect(head(r.html), '按 Σ 合成').toContain('共6分');
    expect(head(r.html), '原标题的 10 不得残留').not.toContain('共10分');
  });
});

/** 行首题号的行数（验"不得冒出新题号"用） */
function rows0(html) {
  return numbered(html).length;
}
