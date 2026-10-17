import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

/**
 * 质检"不丢题"不变量 ＋ 改写分支覆盖登记（测试期；零运行期代码、零噪音）
 *
 * 为什么这样设计（而非按学科铺样本）：
 *   风险不是一个"学科"产生的，而是**质检里某条会改写正文的分支**产生的。
 *   分支不随学科增加，故样本按"分支＋形态"造，每条都打在一个真实风险点上。
 *
 * 两条硬判据（对全部样本一律成立）：
 *   H1 题块数量不得减少（题不能丢）
 *   H2 任何题块不得被清空（容器还在但题干没了，同样算丢）
 * 覆盖判据（可证明，不靠人记）：
 *   每一支"会改写正文"的分支，都必须被某个样本命中（issues 里出现该分支的回报）；
 *   暂未配到样本的分支必须登记在 PENDING 里，且**数量只减不增**——新增分支不配样本即红。
 */

const blockTexts = (html) => [...String(html ?? '').matchAll(
  /<p[^>]*class="[^"]*\bquestion\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ''));

const run = (html, opts = {}) => auditExamPaper(html, { genType: 'exam', ...opts });

/** 十支改写正文的分支（来源：examValidator.js 逐一核对） */
const BRANCHES = [
  { id: 'sup-sub', at: 811, what: 'Unicode 上下标归一为 <sup>/<sub>', probe: /上下标已自动归一/ },
  { id: 'label-strip', at: 898, what: '剥离该学段不应使用的题号标签（保留文字）', probe: /已自动剥离/ },
  { id: 'title-score', at: 944, what: '大题标题补总分', probe: /大题标题已补总分/ },
  { id: 'blank-move', at: 1310, what: '同一大题内作答位位置归并（只搬括号空位）', probe: /作答位位置已自动归并统一/ },
  { id: 'writing-grid', at: 1593, what: '写话/作文题补作文格', probe: /已自动补作文格/ },
  { id: 'writing-line-en', at: 1688, what: '英语书面表达/写作题补横线', probe: /英语书面表达\/写作题已自动补横线/ },
  { id: 'writing-line-en-title', at: 1778, what: '大题标题式英语书写题补横线', probe: /大题标题式英语书写题已自动补横线/ },
  { id: 'draw-area', at: 2179, what: '作图题补作图区', probe: /已补作图区/ },
  { id: 'answer-space', at: 2199, what: '按分值×系数补作答行/空白', probe: /已补作答空间/ },
  { id: 'answer-section', at: 2322, what: '答案区补包为独立 answer-section', probe: /答案区已自动补包/ },
];

/** 暂未配到可靠样本的分支：只减不增（新增分支不配样本即红） */
const PENDING = {};

const SAMPLES = [
  {
    name: '数学·小学低段（干净例）',
    opts: { subject: '数学', stage: 'primary_low' },
    html: [
      '<p class="question">1. 3+5＝　　　7-2＝　　　9-4＝</p>',
      '<p class="question">2. 8 里面有（　　）个一。</p>',
    ].join('\n'),
  },
  {
    name: '语文·小学低段｜作文题缺格（命中 writing-grid）',
    opts: { subject: '语文', stage: 'primary_low' },
    branch: 'writing-grid',
    html: [
      '<p class="question">1. 看拼音写词语。（每词2分，共4分）</p>',
      '<p class="question">2. 习作：以我的乐园为题，写一篇不少于 300 字的作文。（30分）</p>',
    ].join('\n'),
  },
  {
    name: '语文·初中｜作文区夹在两题之间（补件不得吞掉其后的题）',
    opts: { subject: '语文', stage: 'middle' },
    html: [
      '<p class="question">1. 阅读下面文章，完成后面各题。（12分）</p>',
      '<p class="question">2. 写作：以这一次，我长大了为题写一篇作文。（40分）</p>',
      '<p class="question">3. 附加题：说说你读完本文的感受。</p>',
    ].join('\n'),
  },
  {
    name: '英语·小学低段｜书面表达缺横线（命中 writing-line-en）',
    opts: { subject: '英语', stage: 'primary_low' },
    branch: 'writing-line-en',
    html: [
      '<p class="question">1. 听音选词。（每题2分，共4分）</p>',
      '<p class="question">2. 书面表达：Write about your weekend.（10分）</p>',
    ].join('\n'),
  },
  {
    name: '数学·小学高段｜非语文误用作文格（命中 label-strip）',
    opts: { subject: '数学', stage: 'primary_high' },
    branch: 'label-strip',
    html: [
      '<p class="question">1. 计算：48×3＝</p>',
      '<p class="question">2. 写一写你的发现<span class="zuo-wen-ge"></span></p>',
    ].join('\n'),
  },
  {
    name: '数学·小学低段｜大题标题缺总分（命中 title-score）',
    opts: { subject: '数学', stage: 'primary_low' },
    branch: 'title-score',
    html: [
      '<h2>一、填空（24分）</h2>',
      '<p class="question">1. 8 里面有（　　）个一。</p>',
      '<p class="question">2. 比 7 多 2 的数是（　　）。</p>',
    ].join('\n'),
  },
  {
    name: '语文·初中｜作答位位置混用（命中 blank-move）',
    opts: { subject: '语文', stage: 'middle' },
    branch: 'blank-move',
    html: [
      '<h2>一、判断题（4分）</h2>',
      '<p class="question">（　　）1. 他是一名教师。</p>',
      '<p class="question">（　　）2. 这道题只有一个答案。</p>',
      '<p class="question">3. 这句话用了比喻的手法。（　　）</p>',
      '<p class="question">4. 全文按时间顺序写。（　　）</p>',
    ].join('\n'),
  },
  {
    name: '英语·小学高段｜大题标题式书写题缺横线（命中 writing-line-en-title）',
    opts: { subject: '英语', stage: 'primary_high' },
    branch: 'writing-line-en-title',
    html: [
      '<h3>五、书面表达（10分）</h3>',
      '<p class="question">以 My Weekend 为题写一篇作文，不少于6句。</p>',
    ].join('\n'),
  },
  {
    name: '数学·小学高段｜作图题缺作图区（命中 draw-area）',
    opts: { subject: '数学', stage: 'primary_high' },
    branch: 'draw-area',
    html: [
      '<h3>一、作图题（共6分）</h3>',
      '<p class="question">1. 作图：画出边长 3 厘米的正方形，并标出它的对称轴。（4分）</p>',
      '<p class="question">2. 在下面的方格纸上作图，画出向右平移 3 格后的图形。（2分）</p>',
    ].join('\n'),
  },
  {
    name: '语文·初中｜长答题缺作答行（命中 answer-space）',
    opts: { subject: '语文', stage: 'middle' },
    branch: 'answer-space',
    html: [
      '<h3>一、阅读理解（8分）</h3>',
      '<p class="question">1. 请结合全文，分析文中人物形象。（8分）</p>',
    ].join('\n'),
  },
  {
    name: '数学·小学低段｜答案区未包 answer-section（命中 answer-section）',
    opts: { subject: '数学', stage: 'primary_low' },
    branch: 'answer-section',
    html: [
      '<p class="question">1. 3+5＝（　　）</p>',
      '<h2>参考答案</h2>',
      '<p>1. 8</p>',
    ].join('\n'),
  },
  {
    name: '数学·小学低段｜Unicode 上下标（命中 sup-sub）',
    opts: { subject: '数学', stage: 'primary_low' },
    branch: 'sup-sub',
    html: [
      '<p class="question">1. 3²＝（　　）</p>',
      '<p class="question">2. 边长 3 厘米的正方形，面积是（　　）平方厘米。</p>',
    ].join('\n'),
  },
  {
    name: '教辅｜同一不变量对非试卷类型同样成立',
    opts: { genType: 'teaching', subject: '数学', stage: 'primary_low' },
    html: [
      '<p class="question">1. 口算。3+4＝　　　5-2＝</p>',
      '<p class="question">2. 在○里填上 ＞、＜ 或 ＝。6○9</p>',
    ].join('\n'),
  },
];

describe('质检不丢题：分支定向样本 ＋ 覆盖可证明', () => {
  for (const s of SAMPLES) {
    it(s.name, () => {
      const before = blockTexts(s.html);
      expect(before.length, '样本须含题块，否则断言无意义').toBeGreaterThan(0);

      const res = run(s.html, s.opts);
      const after = blockTexts(res.html ?? '');

      // H1 题不能丢
      expect(after.length, `题块数减少：${before.length}→${after.length}`)
        .toBeGreaterThanOrEqual(before.length);
      // H2 题不能被清空
      for (const t of after) expect(t.length, '出现空题块（容器在、题干没了）').toBeGreaterThan(0);

      // 覆盖证明：该样本宣称命中的分支，必须真的出现在 issues 里（待配分支不参与证明）
      if (s.branch && !PENDING[s.branch]) {
        const b = BRANCHES.find((x) => x.id === s.branch);
        const hit = (res.issues || []).some((i) => b.probe.test(i.message || ''));
        expect(hit, `样本未命中分支 ${s.branch}（${b.what}）——该样本失效，覆盖是假的`).toBe(true);
      }
    });
  }

  it('覆盖登记：未配样本的分支只减不增（新增改写分支不配样本即红）', () => {
    const covered = new Set(SAMPLES.map((s) => s.branch).filter(Boolean));
    const uncovered = BRANCHES.map((b) => b.id).filter((id) => !covered.has(id));
    for (const id of uncovered) {
      expect(PENDING[id], `分支 ${id} 会改写正文但既无样本、也未登记为待配`).toBeTruthy();
    }
    expect(uncovered.length, '待配分支数不得增加（只减不增）').toBeLessThanOrEqual(
      Object.keys(PENDING).length,
    );
  });
});
