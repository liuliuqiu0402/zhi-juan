// 🔴 2026-09-17 用户实证批次②：六年级英语「阶段测评」四处追问 → 根治（守卫）
// ============================================================
// 追问与判定：
//  ① ⚠️「看图/读图」类题但整卷未输出任何 [IMAGE]/[GRAPH]  → 真问题，但根因是**标题与内容不符**（不是漏图）
//  ② ⚠️ 正文题号数(40) 明显少于答案区(56)                 → **误报**（正文侧计数漏认"空位自带括号编号"）
//  ③ ⚠️ 同一单词 "the" 多套音标（talent / snail）          → **误报**（连词成句的 "/" 词表被当成音标）
//  ④ 第二题括号位置/形态不统一（6/7 题首半角、8~10 句末）  → 真问题（同大题内自相矛盾）
//  ⑤ 第五题标题与内容不符（标题"图片/首字母提示"，题内中文提示）→ 真问题（同 ①）
// 处置：全部按**根治**（判据/口径/条款同源），并按用户要求核"其他类型其他学科是否也会出现"——
//   ①③⑤ 属**全类型通用**（凡标题声称提示方式、凡用斜杠列词者）；②④ 属**题类通用**（凡有括号编号/判断类作答位者）。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { detectPhonemeConflicts } from '../../src/utils/contentSanity.js';
import { extractBodyQuestionNumbers, countTopQuestions } from '../../src/utils/contentCleaner.js';

const ANS = '<div class="answer-section"><h2>参考答案</h2><p>1. A</p></div>';

describe('① 题号计数口径同源（正文/答案区不再各持正则）', () => {
  const bodyWithInlineParenNumbering = () => {
    // 一~六：1~40 行首；七：41~45 用「(41) + 空位」这种**空位自带括号编号**（实证形态）
    const head = Array.from({ length: 40 }, (_, i) => `<p class="question">${i + 1}. 题目内容</p>`).join('');
    const dialog = [41, 42, 43, 44, 45]
      .map((n) => `<p>B: (${n}) <u class="blank-3">&emsp;</u></p>`).join('');
    return `<h2>一、听力（共80分）</h2>${head}<h2>七、选句补全对话（每题2分，共10分）</h2>${dialog}`;
  };

  it('正文用 (41) 括号编号 → 与答案区同口径，不再误报"正文疑似丢题"', () => {
    const ans = `<div class="answer-section"><h2>参考答案</h2>${Array.from({ length: 45 }, (_, i) => `<p>${i + 1}. A</p>`).join('')}</div>`;
    const r = auditExamPaper(bodyWithInlineParenNumbering() + ans,
      { subject: '英语', stage: 'primary_high', genType: 'exam' });
    const msgs = (r.silentDetails || []).filter((d) => d.type === 'body-coverage').map((d) => d.message).join(' | ');
    expect(msgs, `不应报正文丢题：${msgs}`).toBe('');
    expect(countTopQuestions(bodyWithInlineParenNumbering())).toBe(45);
  });

  it('反向护栏：正文真的缺题（1~5 后直接跳 8~12）→ 仍报', () => {
    const body = `<h2>一、听力（共80分）</h2>`
      + Array.from({ length: 5 }, (_, i) => `<p class="question">${i + 1}. 题</p>`).join('')
      + Array.from({ length: 5 }, (_, i) => `<p class="question">${i + 8}. 题</p>`).join('');
    const ans = `<div class="answer-section"><h2>参考答案</h2>${Array.from({ length: 12 }, (_, i) => `<p>${i + 1}. A</p>`).join('')}</div>`;
    const r = auditExamPaper(body + ans, { subject: '英语', stage: 'primary_high', genType: 'exam' });
    expect((r.silentDetails || []).some((d) => d.type === 'body-coverage')).toBe(true);
  });

  it('三种形态同源：行首 / 空位自带括号编号 / 行内点号+作答位 都计入且保序', () => {
    const html = `<p>1. 行首形态</p><p>B: (2) <u class="blank-3">&emsp;</u></p><p>Amy: 说点什么 3. <u class="blank-3">&emsp;</u></p>`;
    expect(extractBodyQuestionNumbers(html)).toEqual([1, 2, 3]);
  });
});

describe('② 音标冲突检测本征化（斜杠词表不再被当音标）', () => {
  it('连词成句的 "/" 词表 → 不再误报"同一单词多套音标"', () => {
    const html = `<h2>八、连词成句（每题2分，共10分）</h2>`
      + `<p>46. tried / I / best / my / competition / the / in / .</p>`
      + `<p>49. never / the / snail / gave / up / .</p>`;
    expect(detectPhonemeConflicts(html)).toEqual([]);
  });

  it('反向护栏：真音标冲突（含 IPA 符号）仍报', () => {
    const html = `<p>cough /kɒf/</p><p>cough /kʌf/</p>`;
    const out = detectPhonemeConflicts(html);
    expect(out.length).toBe(1);
    expect(out[0]).toContain('cough');
  });

  it('纯 ASCII 音标（无 IPA 符号）+ 音标语境 → 仍按音标处理（能力不降）', () => {
    // 注意：判据要求"音标本征"或"±25 字内有音标语境词"；纯 ASCII 音标（如 /red/）须靠语境词兜住。
    expect(detectPhonemeConflicts('<p>音标：read/rɪd/</p><p>音标：read/red/</p>').length).toBe(1);
    expect(detectPhonemeConflicts('<p>read /red/ 发音</p><p>read /rid/ 发音</p>').length).toBe(1);
  });

  it('纯 ASCII 短串但无音标语境（词表/短语）→ 不算音标', () => {
    expect(detectPhonemeConflicts('<p>圈出 cat / dog / pig 连线</p><p>圈出 cat / cow 连线</p>')).toEqual([]);
  });
});

describe('③ 标题与内容不符（图缺失的真实根因）', () => {
  const run = (html, subject = '英语', stage = 'primary_high', genType = 'exam') =>
    auditExamPaper(html, { subject, stage, genType });
  const notes = (r, type) => (r.silentDetails || []).filter((d) => d.type === type).map((d) => d.message).join(' | ');

  it('标题声称图片提示、题内用中文提示 → 报"标题与内容不符"（不再误指整卷漏图）', () => {
    const html = `<h2>五、根据图片提示或首字母提示，写出正确的单词补全句子（每题2分，共4分）</h2>`
      + `<p class="question">1. Last week, our class <u class="blank-6">&emsp;</u> (海报设计) a big poster.</p>`
      + ANS;
    const r = run(html);
    expect(notes(r, 'title-content-mismatch')).toContain('标题与内容不符');
    expect(notes(r, 'image-missing')).toBe('');
  });

  it('标题声称图片提示、题内既无图也无其它提示 → 报（文案提示"或漏图"）', () => {
    const html = `<h2>五、根据图片提示写出正确的单词（每题2分，共4分）</h2>`
      + `<p class="question">1. The snail kept <u class="blank-6">&emsp;</u> up the tree.</p>${ANS}`;
    const r = run(html);
    expect(notes(r, 'title-content-mismatch')).toContain('漏图');
  });

  it('题干要图（看图形/统计图）且整卷无图 → 仍报 image-missing（原探针能力不降）', () => {
    const r = run(`<h2>三、解答题（共10分）</h2><p class="question">1. 看图列式计算。</p>${ANS}`, '数学', 'primary_high', 'practice');
    expect(notes(r, 'image-missing')).toContain('看图形');
  });

  it('标题与内容一致（有图标记）→ 不报', () => {
    const html = `<h2>五、根据图片提示写单词</h2><p class="question">1. <u class="blank-6">&emsp;</u></p>`
      + '[IMAGE]\nPROMPT:一棵大树上的蜗牛\n[/IMAGE]' + ANS;
    expect(notes(run(html), 'title-content-mismatch')).toBe('');
  });
});

describe('④ 同一大题内作答位位置/形态统一（跨学科通用）', () => {
  const run = (subject, html) => auditExamPaper(html, { subject, stage: 'primary_high', genType: 'exam' });
  const notes = (r, type) => (r.silentDetails || []).filter((d) => d.type === type).map((d) => d.message).join(' | ');

  it('题首与句末混用 → 报位置不统一（英语判断题实证：6/7 题首、8~10 句末）', () => {
    const html = `<h2>二、听简短对话，判断正误，正确写"T"，错误写"F"（每题2分，共10分）</h2>`
      + `<p class="question">(    )6. The festival will be held next Friday.</p>`
      + `<p class="question">(    )7. Lily made a poster.</p>`
      + `<p class="question">8. Tom invited his friend. (    )</p>`
      + `<p class="question">9. The food stall sells dumplings. (    )</p>${ANS}`;
    const r = run('英语', html);
    expect(notes(r, 'answer-blank-position')).toContain('位置不统一');
  });

  it('全角（　）与半角(    )混用 → 报形态不统一', () => {
    const html = `<h2>六、单项选择（每题2分，共6分）</h2>`
      + `<p class="question">（　）1. 题干一</p><p>A. x　B. y</p>`
      + `<p class="question">(    )2. 题干二</p><p>A. x　B. y</p>${ANS}`;
    const r = run('英语', html);
    expect(notes(r, 'answer-blank-form')).toContain('括号形态不统一');
  });

  it('整段统一（都题首、都全角）→ 不报', () => {
    const html = `<h2>二、判断正误（每题2分，共6分）</h2>`
      + `<p class="question">（　）6. 句子一</p><p class="question">（　）7. 句子二</p>${ANS}`;
    const r = run('英语', html);
    expect(notes(r, 'answer-blank-position')).toBe('');
    expect(notes(r, 'answer-blank-form')).toBe('');
  });

  it('只报不改：既不写进 issues，也不搬移空位', () => {
    const html = `<h2>二、判断正误（每题2分，共6分）</h2>`
      + `<p class="question">( )6. 句子一</p><p class="question">( )7. 句子二</p>`
      + `<p class="question">8. 句子三 ( )</p><p class="question">9. 句子四 ( )</p>${ANS}`;
    const r = run('英语', html);
    expect((r.issues || []).every((i) => i.type !== 'answer-blank-position')).toBe(true);
    expect(r.html).toContain('8. 句子三 ( )');
  });
});
