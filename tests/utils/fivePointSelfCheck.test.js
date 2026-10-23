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
    expect(NUMBERING_BRANCH_RULE, '边界一：句末作答位属同一句').toContain('作答位紧跟句末属同一句');
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

  // 🔴 2026-10-23（属主："不该编号的还是编号了"）：程序侧补一个**只报不改**的核对——
  //   题号 ≥2 而成句的题 <2 ⇒ 与成题区判据相抵（该组应"不编号"）。
  it('行为：算式行被编号 ⇒ 程序报"成句的题只有 0 道"（只报不改）', () => {
    const html = page('一、直接写得数（每题1分，共4分）', [
      '<p>1. 3×5＝____</p>',
      '<p>2. 2×6＝____</p>',
    ]);
    const r = run(html);
    const warn = (r.silentDetails || []).filter((x) => x.level === 'warn' && /成句的题/.test(x.message));
    expect(warn.length, '必须有报点').toBe(1);
    expect(warn[0].message, '指出该组应判不编号').toContain('应判"不编号"');
    expect(rows0(r.html), '程序不删号、不改结构').toBe(2);
  });

  it('行为：判断题/填空（都成句）被编号 ⇒ 不报（判编号是对的）', () => {
    const judge = run(page('三、判断对错（每题2分，共4分）', [
      '<p>1. 0 既不是正数也不是负数。（　）</p>',
      '<p>2. 假分数一定大于 1。（　）</p>',
    ]));
    const fill = run(page('四、填空（每空1分，共2分）', [
      '<p>1. 5＋____＝9。</p>',
      '<p>2. 8 里面有____个 2。</p>',
    ]));
    for (const r of [judge, fill]) {
      expect((r.silentDetails || []).filter((x) => /成句的题/.test(x.message)).length).toBe(0);
    }
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

// 🔴 2026-10-23（属主："分值自洽是模型侧的硬性要求，一层层验"）：
//   四层：独立题干 → 大题 → 大类 → 试卷；中学不设大类层，该层由大标题承担（位置不同、算法同一）。
describe('⑦ 分值自洽：模型侧逐层核（硬性·四层不得跳）', () => {
  it('四层齐备且按"题→大题→大类→试卷"排列', () => {
    const t = tpl();
    const i1 = t.indexOf('该题分＝标题单价×该题判分处数');
    const i2 = t.indexOf('大题总分＝其下各子题分之和');
    const i3 = t.indexOf('大类总分＝其下各大题分之和');
    const i4 = t.indexOf('试卷总分＝各大类分之和');
    for (const [name, i] of [['①题', i1], ['②大题', i2], ['③大类', i3], ['④试卷', i4]]) {
      expect(i, `${name} 层必须在位`).toBeGreaterThan(-1);
    }
    expect(i1 < i2 && i2 < i3 && i3 < i4, '四层必须按顺序验（一层都不得跳）').toBe(true);
    expect(t, '硬性要求写明').toContain('四层都要验');
    expect(t, '试卷层要落到卷首满分').toContain('须等于卷首满分');
    expect(t, '差额只在层内调（不跨大题）').toContain('不跨大题挪分');
  });

  it('中学：不设大类层，该层由大标题承担（位置不同、算法同一）', () => {
    const mid = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'exam' }).template;
    expect(mid, '中学映射写明').toContain('中学不设大类层');
    expect(mid, '同一套四层算法仍在（不是另一套）').toContain('试卷总分＝各大类分之和');
  });
});
