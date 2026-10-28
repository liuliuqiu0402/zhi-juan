// 分条序号 ≠ 题号（2026-10-19 属主质询："有的时候，带的序号不是题号，而是几个条件，有这种类型的吧？有区分开吗？"）
// ============================================================
// 三件事：
//   ① A 侧：题干内分条**可以有自己的序号**，且明确"那是分条序号、不是题号"（旧句"不单独编号"含糊，已改）；
//   ② A 侧：分值条两支只用"这一组是多件／是一件"判，**不再写"每道题各自编号"**（防二次推力"每题都要有号"）；
//   ③ B 侧：题干内条件分条（（1）（2）（3）／"要求："后 1. 2. 3.）不被当成题，不在分条之间插作答载体。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, QUESTION_OBJECT_CALIBER, ANSWER_STEM_CALIBER } from '../../src/config/promptLibrary.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const tpl = (g = 'exam', sj = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: sj, genType: g }).template;
const run = (h, subject = '语文') => auditExamPaper(h, { subject, stage: 'primary_low', genType: 'exam' }).html;

describe('① A 侧：分条序号与题号分开（不是每一种序号都是题号）', () => {
  it('三种题类都带这条：分条可以有自己的一套序号，且声明"不是题号"', () => {
    for (const g of ['exam', 'practice', 'errorbook']) {
      const t = tpl(g);
      expect(t, `${g}：分条可有自己的序号`).toContain('可以有自己的一套序号');
      expect(t, `${g}：分条不是题目（序号不是题号）`).toContain('不是题目');
      expect(t, `${g}：分条序号与题号相区分`).toContain('与题号相区分');
      expect(t, `${g}：分条不另配作答区`).toContain('不另配作答区');
      expect(t, `${g}：旧含糊句不得回潮`).not.toContain('这些分条不单独编号');
    }
  });
});

// ② A 侧：分条序号不是题号——判据从"语义"换成"结构事实"（2026-10-26）
describe('② A 侧：并列算式行不是多个作答题干', () => {
  it('口算/竖式：一行两式也仍是一组——同一题干内的并列小项，题前加小号序号', () => {
    // 2026-10-19 属主实证：`二、列竖式` 下 `1. 5×6＝　　2. 4×6＝`（同一行两个号）。
    // 🔴 2026-10-26：判据不再是"号是点名用的"，而是**数独立成 <p class="question"> 的题干**——
    //   同一段里的并列算式/待填位都在同一个题干内 ⇒ （单题干） ⇒ 不加小号序号。
    expect(ANSWER_STEM_CALIBER, '同一题干内的并列小项不另算').toContain('题前加小号序号');
    expect(QUESTION_OBJECT_CALIBER, '第二把尺（各自有独立题干）不得回潮').not.toMatch(/各自有独立题干|只属于它的陈述或问题/);
    const t = tpl('exam', '数学', 'primary_mid');
    expect(t, '单题干：不加小号序号').toContain('不加小号序号');
    expect(t, '无号：分写在标题后一处').toContain('整栏没有小号序号的，这一栏的分只写在标题后一处');
  });

  it('两支名在位；旧"每道题各自编号"不得回潮（防"每题都要有号"的二次推力）', () => {
    for (const st of ['primary_low', 'middle']) {
      const t = tpl('exam', '数学', st);
      expect(t, `${st}：多题干落点在题干后`).toContain('分写在每题题干后');
      expect(t, `${st}：标题写这一栏的分`).toContain('标题写这一栏的分');
      expect(t, `${st}：不得再写"每道题各自编号"`).not.toContain('每道题各自编号');
      expect(t, `${st}：旧两支不得回潮`).not.toContain('这一组是多件');
      expect(t, `${st}：旧补救句不得回潮`).not.toContain('标题若已写成单价');
    }
  });
});

describe('③ B 侧：题干内条件分条不被当成题、不插作答载体', () => {
  const between = (s, a, b) => {
    const i = s.indexOf(a), j = s.indexOf(b);
    expect(i, `应含 ${a}`).toBeGreaterThan(-1);
    expect(j, `应含 ${b}`).toBeGreaterThan(i);
    return s.slice(i, j);
  };

  it('（1）（2）（3）条件分条：顺序不变、分条之间不插任何作答载体', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>五、写话（共15分）</h3>',
      '<p>要求：</p>',
      '<p>（1）写清楚时间、地点和人物。</p>',
      '<p>（2）不少于三句话。</p>',
      '<p>（3）不会写的字可以用拼音代替。</p>',
    ].join('\n');
    const out = run(html);
    const seg = between(out, '（1）', '（2）');
    expect(seg, '分条之间不得插作答载体').not.toMatch(/blank-line|draw-area|zuo-wen-ge|square-grid/);
    const seg2 = between(out, '（2）', '（3）');
    expect(seg2, '分条之间不得插作答载体').not.toMatch(/blank-line|draw-area|zuo-wen-ge|square-grid/);
  });

  it('"要求："后用 1. 2. 3. 写的分条：仍不当成题块（不按题号补作答行）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>六、习作（共20分）</h3>',
      '<p>要求：</p>',
      '<p>1. 写一件你亲身经历的事。</p>',
      '<p>2. 把经过写清楚。</p>',
      '<p>3. 不少于300字。</p>',
    ].join('\n');
    const out = run(html);
    const seg = between(out, '1. 写一件', '2. 把经过');
    expect(seg, '分条之间不得补作答横线/作答区').not.toMatch(/blank-line|draw-area|square-grid/);
    expect(out, '分条原样保留（不删不改号）').toContain('3. 不少于300字');
  });
});
