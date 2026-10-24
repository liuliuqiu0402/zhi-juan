// 分条序号 ≠ 题号（2026-10-19 属主质询："有的时候，带的序号不是题号，而是几个条件，有这种类型的吧？有区分开吗？"）
// ============================================================
// 三件事：
//   ① A 侧：题干内分条**可以有自己的序号**，且明确"那是分条序号、不是题号"（旧句"不单独编号"含糊，已改）；
//   ② A 侧：分值条两支只用"这一组是多件／是一件"判，**不再写"每道题各自编号"**（防二次推力"每题都要有号"）；
//   ③ B 侧：题干内条件分条（（1）（2）（3）／"要求："后 1. 2. 3.）不被当成题，不在分条之间插作答载体。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, QUESTION_OBJECT_CALIBER, NUMBERING_BRANCH_RULE } from '../../src/config/promptLibrary.js';
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

describe('② A 侧：分值条只按"这一组是多件/是一件"判，不再强调"每道题各自编号"', () => {
  it('口算/竖式：一行两式也仍是一组——算式不成句，不得各自编号', () => {
    // 2026-10-19 属主实证：`二、列竖式` 下 `1. 5×6＝　　2. 4×6＝`（同一行两个号）。
    // 🔴 2026-10-23（属主基准）：判据已统一为一组只做一个动作：给不给每个小题写号——算式行没有"一组只做一个动作"⇒ 不编号；
    //   原"各自有独立题干／文字表述"是第二把尺，已删。
    expect(NUMBERING_BRANCH_RULE).toContain('一组只做一个动作');
    expect(NUMBERING_BRANCH_RULE, '并列算式行 → 不编号').toContain('不许只有号没有分，也不许没有号却在题内标分');
    expect(QUESTION_OBJECT_CALIBER, '第二把尺（各自有独立题干）不得回潮').not.toMatch(/各自有独立题干|只属于它的陈述或问题/);
    const t = tpl('exam', '数学', 'primary_mid');
    expect(t, '分值条：算式行没有只属于它的话 ⇒ 不编号、单价只在大标题').toContain('不带小题号');
    expect(t, '不编号 ⇒ 题内不标分').toContain('分值只写在大标题');
  });

  it('两支名在位；旧"每道题各自编号"不得回潮（防"每题都要有号"的二次推力）', () => {
    for (const st of ['primary_low', 'middle']) {
      const t = tpl('exam', '数学', st);
      expect(t, `${st}：不编号 → 分值随标题`).toContain('分值只写在大标题');
      expect(t, `${st}：编号 → 逐题标分（位置按真题习惯）`).toContain('该题最后一行末尾');
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
