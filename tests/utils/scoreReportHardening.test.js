// ============================================================
// 报点加固守卫（2026-10-27）
// ------------------------------------------------------------
// 属主："你把这几个报到问题列表中的问题加固下"——三条报点都不改产物，只把**取证**做足：
//   ① 缺分报点：点名**哪几道题**没分；整栏合计（"（每题2分，共10分）"）被写在某一小题后时，
//      报点须说明这一根因（否则会被当成随机漏标）；
//   ② 试卷层账目：列出**计入合计的节**与**没有"共X分"因而没进合计的节**，让差额落点可见；
//   ③ 图题不一致：判据收窄为"真提示"括注（作答位/编号/单位说明/图指代都不算），并点名大题＋触发处原文。
// 三条都遵守同一界：**只报不改**（不补分、不改数、不动结构）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const ANS = '<div class="answer-section"><h2>参考答案</h2><p>1. A</p></div>';
const notes = (r, type) => (r.silentDetails || []).filter((d) => d.type === type).map((d) => d.message).join(' | ');

describe('① 缺分报点：点名题号 + 识别"整栏合计标在一处"', () => {
  // 属主真机："它在第一小题后面标了（每题2分，共10分）"——第1题读到 10 分，其余 4 题读不到分。
  const COLUMN_ON_FIRST = [
    '<h1>期末测评（满分100分）</h1>',
    '<h3>四、选择正确答案（每题2分，共10分）</h3>',
    '<p class="question">1. 最接近 500 的数是（　）。（每题2分，共10分）</p>',
    '<p class="question">2. 下面各数中，一个零也不读的是（　）。</p>',
    '<p class="question">3. 与 300 相邻的两个数是（　）。</p>',
    '<p class="question">4. 459 最接近的整百数是（　）。</p>',
    '<p class="question">5. 下面各数中最大的是（　）。</p>',
    ANS,
  ].join('\n');

  it('整栏合计写在第1题后 → 报点指出题号，并说明该括注是整栏合计（不是逐题分）', () => {
    const msg = notes(auditExamPaper(COLUMN_ON_FIRST, { subject: '数学', stage: 'primary_mid', genType: 'exam' }), 'title-unit-misplaced');
    expect(msg, '须报缺分').toContain('道带题号的题没标分');
    expect(msg, '须点名哪几道（第1题已有括注，缺的是 2~5）').toContain('第2、3、4、5题');
    expect(msg, '须点出整栏合计被写在了一处').toContain('整栏合计');
    expect(msg, '须给出触发括注原文').toContain('（每题2分，共10分）');
  });

  it('标题是"（共X分）"形态时同样点名题号（1.6b 分支）', () => {
    const html = [
      '<h1>期末测评（满分100分）</h1>',
      '<h3>五、选择题（共10分）</h3>',
      '<p class="question">1. 题干（　）。（每题2分，共10分）</p>',
      '<p class="question">2. 题干（　）。</p>',
      '<p class="question">3. 题干（　）。</p>',
      ANS,
    ].join('\n');
    const msg = notes(auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' }), 'title-unit-misplaced');
    expect(msg).toContain('第2、3题');
    expect(msg).toContain('整栏合计');
  });

  it('程序仍不补分：缺分题的正文一个分值括注都没被加上', () => {
    const r = auditExamPaper(COLUMN_ON_FIRST, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    const p2 = (r.html.match(/<p[^>]*class="question"[^>]*>2\.[\s\S]*?<\/p>/) || [''])[0];
    expect(p2, '第2题须原样保留').toContain('下面各数中，一个零也不读的是');
    expect(p2, '不得给第2题补任何分值括注').not.toMatch(/（[^）]*\d+\s*分[^）]*）/);
  });
});

describe('② 试卷层账目：列出计入/未计入的节', () => {
  // 合计 40 分 vs 卷首 100 分；"三、操作题"标题没写"共X分"（单题，B 也不合成）⇒ 未进合计。
  const SUM_DIFF = [
    '<h1>期末测评（满分100分）</h1>',
    '<h3>一、填空（共20分）</h3>',
    '<p class="question">1. ____（每空1分，共10分）</p>',
    '<p class="question">2. ____（每空1分，共10分）</p>',
    '<h3>二、判断（共20分）</h3>',
    '<p class="question">1. 略（每题10分，共10分）</p>',
    '<p class="question">2. 略（每题10分，共10分）</p>',
    '<h3>三、操作题</h3>',
    '<p class="question">1. 画一画。</p>',
    ANS,
  ].join('\n');

  it('报点列出各节分值，并点名"没有共X分"的节', () => {
    const msg = notes(auditExamPaper(SUM_DIFF, { subject: '数学', stage: 'primary_mid', genType: 'exam' }), 'score-sum-mismatch');
    expect(msg, '须报差额').toContain('与卷首满分 100 分不符');
    expect(msg, '须列出计入的节与分值').toContain('一、填空 20分');
    expect(msg, '须点名未计入的节').toContain('未计入合计的节');
    expect(msg, '未计入清单里须有"三、操作题"').toContain('三、操作题');
  });

  it('程序不改数：各节标题分值原样（不把差额摊到某节）', () => {
    const r = auditExamPaper(SUM_DIFF, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    const ts = [...r.html.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map((m) => m[1]);
    expect(ts.find((t) => t.startsWith('一、')), '不得把 20 改成别的数').toContain('20分');
    expect(ts.find((t) => t.startsWith('二、')), '不得把 20 改成别的数').toContain('20分');
  });
});

describe('③ 图题不一致：收窄误判 + 点名大题与触发处', () => {
  const run = (html, subject = '数学', stage = 'primary_high') =>
    auditExamPaper(html, { subject, stage, genType: 'exam' });

  it('"（单位：厘米）"这类单位说明不算提示形态 → 不再误判成"用了其它提示形态"', () => {
    const html = '<h2>六、看图列式计算（共8分）</h2>'
      + '<p class="question">1. 一个长方形长 8 厘米，宽 5 厘米（单位：厘米），求它的面积。</p>'
      + '<p class="question">2. 正方形边长 6 米（单位：米），求周长。</p>'
      + ANS;
    const msg = notes(run(html), 'title-content-mismatch');
    expect(msg, '不得把单位说明当成提示形态').not.toContain('实际用的是');
    expect(msg, '须落到正确诊断：题内无图（改标题或补图）').toContain('既无图也无其它提示形态');
  });

  it('作答位（　）与编号（1）也不算提示形态 → 不误判成"文字提示"', () => {
    const html = '<h2>七、根据图片提示填空（共4分）</h2>'
      + '<p class="question">1. 3 个十和 5 个一组成的数是（　）。</p>'
      + '<p class="question">2. 与 99 相邻的数是（　）和（　）。</p>'
      + ANS;
    const msg = notes(run(html), 'title-content-mismatch');
    expect(msg, '作答位不是提示形态').not.toContain('实际用的是');
    expect(msg).toContain('既无图也无其它提示形态');
  });

  it('真正的文字提示仍要报，且点名大题＋给出触发括注原文', () => {
    const html = '<h2>五、根据图片提示，写出正确的单词（共4分）</h2>'
      + '<p class="question">1. <u class="blank-6">&emsp;</u>（海报设计）is my favourite.</p>'
      + ANS;
    const msg = notes(run(html, '英语', 'primary_high'), 'title-content-mismatch');
    expect(msg, '仍须报').toContain('标题与内容不符');
    expect(msg, '须点名是哪道大题').toContain('五、根据图片提示');
    expect(msg, '须给出触发处原文').toContain('（海报设计）');
  });
});
