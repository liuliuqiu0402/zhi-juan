// 大题标题式英语书写题缺载体 → 补横线（2026-09-16 用户实证·教辅场景）
//
// 背景：教辅的大题是 <h3>十一、根据所给情境，写一段对话</h3> + 一个题干段落；
//       2j-5b 只扫"以 数字. 开头的段落"（为编号条目式教辅设计）→ 这类结构它看不见，
//       于是"写一段对话（不少于6句）"整题无作答载体，而"书面表达"因模型自己写了横线而正常。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const OPTS = { subject: '英语', stage: 'primary_high', genType: 'exam' };
const count = (html) => (html.match(/class="blank-line"/g) || []).length;
const seg = (html, from, to) => {
  const a = html.indexOf(from);
  const b = to ? html.indexOf(to) : html.length;
  return html.slice(a, b);
};

/** 用户实测结构：十一题（写一段对话）无载体 + 十二题（书面表达）模型已给 4 条横线 */
const DOC = `
<h3>十一、根据所给情境，写一段对话</h3>
<p class="question">情境：你的同学 Sam 在数学考试中没有考好，他很难过。请你用英语安慰他，并鼓励他继续努力。对话不少于6句。</p>
<h3>十二、书面表达</h3>
<p class="question">请你以 "I tried my best" 为题，用英语写一篇短文，讲述一次你尽力尝试做某事的经历。</p>
<p class="question">要求：①条理清楚，语句通顺，意思连贯；②用一般过去时描述过去的事情；③不少于50词；④文中不得出现真实的校名和人名。</p>
<p><span class="blank-line">　</span></p>
<p><span class="blank-line">　</span></p>
<p><span class="blank-line">　</span></p>
<p><span class="blank-line">　</span></p>
`;

describe('大题标题式英语书写题缺载体 → 自动补横线（2j-5c）', () => {
  it('写对话题（无载体）被补横线，且在整题之后（题干段之后）', () => {
    const { html } = auditExamPaper(DOC, OPTS);
    const eleven = seg(html, '十一、', '十二、');
    expect(count(eleven), '十一题应补出横线作答区').toBeGreaterThanOrEqual(8);
    // 补位在题干之后：题干段落必须在横线之前
    expect(eleven.indexOf('对话不少于6句')).toBeLessThan(eleven.indexOf('blank-line'));
  });

  it('已有横线的书面表达题不得重复补（仍为原来那 4 条）', () => {
    const { html } = auditExamPaper(DOC, OPTS);
    const twelve = seg(html, '十二、', null);
    expect(count(twelve)).toBe(4);
  });

  it('补位落在整题之后：题干含"要求"分条时，横线在分条之后、不插在分条之间', () => {
    const noCarrier = DOC.replace(/(<p><span class="blank-line">　<\/span><\/p>\n?)+/, '');
    const { html } = auditExamPaper(noCarrier, OPTS);
    const twelve = seg(html, '十二、', null);
    expect(count(twelve)).toBeGreaterThanOrEqual(8);
    expect(twelve.indexOf('④文中不得出现真实的校名和人名')).toBeLessThan(twelve.indexOf('blank-line'));
  });

  it('幂等：对已补好的结果再跑一次不增加', () => {
    const once = auditExamPaper(DOC, OPTS).html;
    const twice = auditExamPaper(once, OPTS).html;
    expect(count(twice)).toBe(count(once));
  });

  it('假阳性保护：选项类大题（有选项行、无书写形态词）不得补横线', () => {
    const html = [
      '<h3>四、单项选择</h3>',
      '<p class="question">（　）1. He ____ to school every day.</p>',
      '<p class="question">A. go　B. goes　C. going</p>',
      '<h3>五、读短文，选择恰当的单词</h3>',
      '<p class="question">Tom wanted to (1) <span class="blank-2"> </span>.</p>',
      '<p class="question">(1) A. stop　B. run　C. jump</p>',
    ].join('\n');
    const res = auditExamPaper(html, OPTS);
    // ① 本条通道（2j-5c）不得触发
    expect(res.issues.some((i) => i.message.includes('大题标题式英语书写题已自动补横线作答区'))).toBe(false);
    // ② 2k 兜底也不得触发：大题标题含"选择/读短文"→ 结构判据由父题继承
    //    （2026-09-16 实证：此前只测"父题语境+块首行"，标题没进判据 → 选词填空每个子题被各补 2 行）
    expect(count(res.html), '选项类大题整体不得出现任何作答横线').toBe(0);
  });

  it('假阳性保护：语文卷不走本通道（语文成篇走作文格通道）', () => {
    const res = auditExamPaper(DOC, { ...OPTS, subject: '语文' });
    expect(res.issues.some((i) => i.message.includes('大题标题式英语书写题已自动补横线作答区'))).toBe(false);
  });
});
