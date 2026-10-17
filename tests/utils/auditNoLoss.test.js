import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

/**
 * 质检"不丢内容"不变量（测试期，零运行期代码、零噪音）
 *
 * 背景：质检的形态是"在原 HTML 上定点定向修、修完返回整份"。所以风险不在"整份返回"，
 * 而在某条修复逻辑本身出错（历史上有过"重复内容截断"这类删除型修复，已删）。
 * 这里把它变成一条常驻断言：**正文题块集合只增不减**——质检后每个题块都必须仍在，
 * 且数量不得减少。比的是"题块存在性"，不涉及任何学科语义，故对全部学科/学段/类型通用。
 *
 * 题块认法：<p class="question"> 内去标签后的首 10 字作指纹。
 */

const blockSigs = (html) => [...String(html ?? '').matchAll(
  /<p[^>]*class="[^"]*\bquestion\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '').slice(0, 10))
  .filter(Boolean);

const run = (html, opts = {}) => auditExamPaper(html, { genType: 'exam', ...opts });

const SAMPLES = [
  {
    name: '数学·小学低段（干净例：应有零改动）',
    opts: { subject: '数学', stage: 'primary_low' },
    html: [
      '<p class="title">第一单元练习</p>',
      '<p class="subtitle">一、直接写得数（每题1分，共4分）</p>',
      '<p class="question">1. 3+5＝　　　7-2＝　　　9-4＝　　　6+3＝</p>',
      '<p class="subtitle">二、填空（每空1分，共2分）</p>',
      '<p class="question">2. 8 里面有（　　）个一。</p>',
      '<p class="question">3. 比 7 多 2 的数是（　　）。</p>',
    ].join('\n'),
    expectFix: false,
  },
  {
    name: '数学·小学高段（干净例）',
    opts: { subject: '数学', stage: 'primary_high' },
    html: [
      '<p class="question">1. 计算下面各题，能简算的要简算。（每题2分，共4分）</p>',
      '<p class="question">2. 解决问题：果园里有苹果树 48 棵，梨树是苹果树的 3 倍，梨树有多少棵？</p>',
    ].join('\n'),
    expectFix: false,
  },
  {
    name: '语文·小学低段（作文题缺作答格：补件必须只加不删）',
    opts: { subject: '语文', stage: 'primary_low' },
    html: [
      '<p class="question">1. 看拼音写词语。（每词2分，共4分）</p>',
      '<p class="question">2. 习作：以我的乐园为题，写一篇不少于 300 字的作文。（30分）</p>',
    ].join('\n'),
    expectFix: true,
  },
  {
    name: '语文·初中（作文区在中间：补件不得吞掉其后的题）',
    opts: { subject: '语文', stage: 'middle' },
    html: [
      '<p class="question">1. 阅读下面文章，完成后面各题。（12分）</p>',
      '<p class="question">2. 写作：以这一次，我长大了为题写一篇作文。（40分）</p>',
      '<p class="question">3. 附加题：说说你读完本文的感受。</p>',
    ].join('\n'),
    expectFix: true,
  },
  {
    name: '英语·小学低段（书面表达缺横线：补件不得删题）',
    opts: { subject: '英语', stage: 'primary_low' },
    html: [
      '<p class="question">1. 听音选词。（每题2分，共4分）</p>',
      '<p class="question">2. 书面表达：Write about your weekend.（10分）</p>',
    ].join('\n'),
    expectFix: true,
  },
  {
    name: '教辅（同一不变量对非试卷类型同样成立）',
    opts: { genType: 'teaching', subject: '数学', stage: 'primary_low' },
    html: [
      '<p class="question">1. 口算下面各题。3+4＝　　　5-2＝</p>',
      '<p class="question">2. 在○里填上 ＞、＜ 或 ＝。6○9　　8○8</p>',
    ].join('\n'),
    expectFix: false,
  },
];

describe('质检不丢内容：正文题块集合只增不减（全学科/学段/类型通用）', () => {
  for (const s of SAMPLES) {
    it(s.name, () => {
      const before = blockSigs(s.html);
      expect(before.length, '样本本身须含题块，否则断言无意义').toBeGreaterThan(0);

      const out = run(s.html, s.opts).html ?? '';
      const after = blockSigs(out);

      expect(after.length, `题块数减少：${before.length} → ${after.length}`)
        .toBeGreaterThanOrEqual(before.length);

      for (const sig of before) {
        expect(after, `题块被删或首句被改写：${sig}`).toContain(sig);
      }

      if (s.expectFix) {
        expect(out.length, '该样本应触发补件（插入），输出不应短于原文').toBeGreaterThan(s.html.length);
      }
    });
  }
});
