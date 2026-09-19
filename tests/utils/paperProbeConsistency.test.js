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

  it('🔴 首字母提示用 blank-N 载体（p+&emsp;）→ 仍判"有其它提示形态"，报"标题与内容不符"而非"漏图"', () => {
    // 2026-09-18 用户实证卷八：首字母填空位是 <u class="blank-N">&emsp;</u> 载体（非字面下划线 p____），
    // strip 标签后成 "p&emsp;"，旧判定只认 `[A-Za-z][_＿]{2,}` → 漏判成"无其它提示形态/漏图"。
    const html = `<h2>八、根据图片和首字母提示，补全下列句子（每题2分，共8分）</h2>`
      + `<p class="question">1. Last week, the children p<u class="blank-6">&emsp;</u> a new play in the school hall.</p>${ANS}`;
    const r = run(html);
    expect(notes(r, 'title-content-mismatch')).toContain('标题与内容不符');
    expect(notes(r, 'title-content-mismatch')).not.toContain('漏图');
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

  // 🔴 2026-09-17 用户裁定（第三轮）：位置混用从"只报不改"改为**程序确定性归并（fix）**——
  //    与既有"题首形态归一/分值对齐/载体补差"同一范式：只搬括号空位、不动其它文字；
  //    方向按多数、同数时题首优先；**形态（同卷全角/半角）仍只报不改**（不同题型有意区分也合理）。
  it('题首与句末混用 → **自动归并到题首**（同数时题首优先；只搬括号、不动文字）', () => {
    const html = `<h2>二、听简短对话，判断正误，正确写"T"，错误写"F"（每题2分，共10分）</h2>`
      + `<p class="question">(    )6. The festival will be held next Friday.</p>`
      + `<p class="question">(    )7. Lily made a poster.</p>`
      + `<p class="question">8. Tom invited his friend. (    )</p>`
      + `<p class="question">9. The food stall sells dumplings. (    )</p>${ANS}`;
    const r = run('英语', html);
    expect(r.html, '句末的两处应被搬到题首').toContain('(    )8. Tom invited his friend.');
    expect(r.html).toContain('(    )9. The food stall sells dumplings.');
    expect(r.html, '文字不得被改动').not.toContain('8. Tom invited his friend. (    )');
    expect(r.issues.some((i) => i.type === 'answer-blank-position-fix'), '应有归并记录').toBe(true);
    expect(notes(r, 'answer-blank-position'), '已归并 → 不再报"位置不统一"').toBe('');
  });

  it('多数在句末 → 归并到句末（题首那两处被搬走）', () => {
    const html = `<h2>二、判断正误（每题2分，共10分）</h2>`
      + `<p class="question">(    )6. 句子一</p>`
      + `<p class="question">(    )7. 句子二</p>`
      + `<p class="question">8. 句子三 (    )</p>`
      + `<p class="question">9. 句子四 (    )</p>`
      + `<p class="question">10. 句子五 (    )</p>${ANS}`;
    const r = run('英语', html);
    expect(r.html).toContain('6. 句子一 (    )');
    expect(r.html).not.toContain('(    )6. 句子一');
  });

  it('全角（　）与半角(    )混用 → 报形态不统一（形态仍只报不改）', () => {
    const html = `<h2>六、单项选择（每题2分，共6分）</h2>`
      + `<p class="question">（　）1. 题干一</p><p>A. x　B. y</p>`
      + `<p class="question">(    )2. 题干二</p><p>A. x　B. y</p>${ANS}`;
    const r = run('英语', html);
    expect(notes(r, 'answer-blank-form')).toContain('括号形态不统一');
  });

  it('整段统一（都题首、都全角）→ 不报、也不动', () => {
    const html = `<h2>二、判断正误（每题2分，共6分）</h2>`
      + `<p class="question">（　）6. 句子一</p><p class="question">（　）7. 句子二</p>${ANS}`;
    const r = run('英语', html);
    expect(notes(r, 'answer-blank-position')).toBe('');
    expect(notes(r, 'answer-blank-form')).toBe('');
    expect(r.html).toContain('（　）6. 句子一');
  });

  it('含作答载体的段不动（那是短答载体，位置语义不同）', () => {
    const html = `<h2>二、判断正误（每题2分，共10分）</h2>`
      + `<p class="question">(    )6. 句子一</p>`
      + `<p class="question">(    )7. 句子二</p>`
      + `<p class="question">8. 句子三 (    )</p>`
      + `<p class="question">9. 句子四 (    )</p>`
      + `<p class="question">10. 请写出单词 <u class="blank-3">&emsp;</u></p>${ANS}`;
    const r = run('英语', html);
    // 带 <u class="blank-N"> 的那段不在"纯文本段"范围内 → 其内容原样
    expect(r.html).toContain('<u class="blank-3">');
    expect(r.html).toContain('(    )8. 句子三');
  });
});

// ⑥ 答案区计数剔除「听力原文」板块（用户追问：英语答案区里的听力原文也有序号，会不会也算一遍）
//   实证（六年级英语阶段测评）：答案区含**听力原文**（1~15 逐条），与答案条目编号重号。
//   - 不会"虚高"：计数取最长 1 起连续递增段，重复序列只能把 run 重置回 1，推不高上限（该卷答案 1~56 齐全，56 来自 56. 参考范文）
//   - 真危害是**遮蔽**：若答案条目缺号恰被原文编号补齐，会把"未逐题给答案"判成对齐 → 漏报
//   - 处置：答案区计数前剔除"听力原文/录音原文/听力材料/录音稿/Tapescript"板块（到下一个标题或文末），
//     与正文侧剔除"学习/预习/复习/教学目标"对称——两侧都只对"题号 ↔ 题/答案"计数
describe('⑥ 答案区计数剔除「听力原文」板块（防遮蔽，与正文剔除目标板块对称）', () => {
  const run = (body, ans) => auditExamPaper(body + ans, { subject: '英语', stage: 'primary_high', genType: 'exam' });
  const notes = (r) => (r.silentDetails || []).filter((d) => d.type === 'answer-coverage').map((d) => d.message).join(' | ');
  const body20 = `<h2>一、听力与基础（共40分）</h2>`
    + Array.from({ length: 20 }, (_, i) => `<p class="question">${i + 1}. 题目内容</p>`).join('');
  const ansItems = (n, from = 1) => Array.from({ length: n }, (_, i) => `<p>${from + i}. A</p>`).join('');

  it('答案区含听力原文（重号 1~15）→ 计数不受其影响，不误报', () => {
    const ans = `<div class="answer-section"><h2>参考答案</h2>${ansItems(20)}`
      + `<p><strong>听力原文</strong></p>${ansItems(15)}</div>`;
    expect(notes(run(body20, ans))).toBe('');
  });

  it('听力原文置于答案区末尾 → 同样剔除（不误伤前文答案）', () => {
    const ans = `<div class="answer-section"><h2>参考答案</h2>${ansItems(20)}`
      + `<p><strong>听力原文</strong></p>${ansItems(20)}</div>`;
    expect(notes(run(body20, ans))).toBe('');
  });

  it('🔴 遮蔽护栏：答案只给了 1~5、其余靠听力原文凑号 → 修前会被判对齐，现须报"答案区题号少于正文"', () => {
    const ans = `<div class="answer-section"><h2>参考答案</h2>${ansItems(5)}`
      + `<p><strong>听力原文</strong></p>${ansItems(20)}</div>`;
    expect(notes(run(body20, ans))).toContain('答案区');
  });

  it('反向护栏：答案区确实无题号（只有文字罗列）→ 仍报（剔除原文不掩盖真缺陷）', () => {
    const ans = `<div class="answer-section"><h2>参考答案</h2><p>一、略</p><p>二、略</p></div>`;
    expect(notes(run(body20, ans))).not.toBe('');
  });
});

// ⑤ 尾约束·全文自洽：三域化 + "定稿前动作"（用户追问第三轮："让模型把指令切实执行、再做到自洽——模型侧，
//   不依赖程序侧；所有资料类型都要"）
//   原文本是**总述式**（一路逗号铺陈"声明↔实给/写法自洽"），模型难以据此逐项执行；重写为
//   ① 声明与实给一致 ② 要素之间 ③ 跨处之间 + **定稿前逐节逐题复核、不自洽当场改、只输出改后定稿**。
//   判据必须**可自判**（各自给出可核对的对照物），且复核写成**成稿前的动作**（与题号条款"输出完成后逐题自查"
//   同一范式）；此处锁住三域、动作与"原则式零列举"三条不变量。
import fs from 'node:fs';
import path from 'node:path';
import { TAIL_SELF_CONSISTENCY, buildUserMessagePrompt } from '../../src/utils/injectionManifest.js';
import { buildOutputFormatHint, getPromptTemplate } from '../../src/config/promptLibrary.js';

describe('⑤ 尾约束·全文自洽：三域化 + 定稿前动作（模型侧承接，原则式零列举不变量保持）', () => {
  const ROOT = path.resolve(__dirname, '../..');

  it('三域齐备：声明与实给一致 / 要素之间 / 跨处之间', () => {
    expect(TAIL_SELF_CONSISTENCY).toContain('声明与实给一致');
    expect(TAIL_SELF_CONSISTENCY).toContain('**要素之间**');
    expect(TAIL_SELF_CONSISTENCY).toContain('**跨处之间**');
  });

  it('声明域覆盖"标题/栏目标题/题干/导语/目录/图注/注释"（标题不再是法外之地，且不限题类）', () => {
    expect(TAIL_SELF_CONSISTENCY).toContain('写在标题、栏目标题、题干、导语、目录、图注、注释里的都算');
    expect(TAIL_SELF_CONSISTENCY).toContain('仅凭正文自身即可完成或读懂');
    expect(TAIL_SELF_CONSISTENCY).toContain('不得声明一样、给出另一样');
  });

  it('要素之间/跨处之间的可自判据仍在（形态统一、材料唯一确定、角色归属、口径一致）', () => {
    expect(TAIL_SELF_CONSISTENCY).toContain('写法自洽');
    expect(TAIL_SELF_CONSISTENCY).toContain('同类作答位的位置与形态统一');
    expect(TAIL_SELF_CONSISTENCY).toContain('不增不拆不改形');
    expect(TAIL_SELF_CONSISTENCY).toContain('唯一确定');
    expect(TAIL_SELF_CONSISTENCY).toContain('说话人与角色归属');
    expect(TAIL_SELF_CONSISTENCY).toContain('全篇只有一种表述');
  });

  it('🔴 执行面：写成"定稿前逐节逐题复核 + 当场改 + 只输出改后定稿"的动作', () => {
    expect(TAIL_SELF_CONSISTENCY).toContain('定稿前逐节逐题按下面三域复核');
    expect(TAIL_SELF_CONSISTENCY).toContain('改声明或改内容，二者取一，只输出改后的定稿');
    expect(TAIL_SELF_CONSISTENCY).toContain('不得以"已声明/已注明"代替"已满足"');
  });

  it('零列举护栏：尾约束不得出现题型/载体名清单（防题型诱导回潮）', () => {
    expect(TAIL_SELF_CONSISTENCY).not.toMatch(/选择|判断|填空|连线|默写|简答|口算|作文格|田字格/);
  });

  it('仍随每次请求末尾锚定（生成端引用单源，不是只躺在库里）', () => {
    expect(fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8'))
      .toContain('buildTailBlocks()[0]');
  });

  it('前置条款与尾锚成闭环：题类自洽总纲明确指向尾锚三域（两处不各说各话）', () => {
    const q = buildOutputFormatHint({ subject: '英语', stage: 'primary_high', genType: 'exam' });
    expect(q).toContain('以上细目即【尾约束·全文自洽】三域在题类资料的展开');
    expect(q).toContain('定稿前按三域（声明↔实给、要素之间、跨处之间）逐项复核');
  });
});

// 🔴 2026-09-19 用户追问："刚刚这个（标题须与题目相符），自洽里应该也有语义吧？正好能对应上。
//    所有资料类型中涉及的题类的，是否都能够遵守到？其实内容型的也是同理自洽，对吧？"
//    审计结论：**语义已在自洽框架内、且各按其分**——"标题"本就是尾约束①的声明主体，三域全类型中性；
//    故**不新增任何条款**（防补丁式堆叠重复语义），只把"哪类拿哪层"的注入面整体锁住：
//    既防**缺席**（某类漏掉自洽条款），也防**越界**（题类条款广播进内容型——此前已裁定不许）。
describe('自洽条款的注入面：9 类资料各按其分（不缺席、不越界）', () => {
  const P = { grade: 'primary_high', subject: '英语' };
  const QUESTION_TYPES = ['exam', 'practice', 'special', 'reading', 'dictation', 'errorbook', 'review'];
  const CONTENT_TYPES = ['preview', 'summary'];
  const tplOf = (genType) => getPromptTemplate({ ...P, genType }).template;

  it('7 类题类一律拿到「题目自洽（编辑自查总纲）」，2 类内容型一律不拿', () => {
    for (const g of QUESTION_TYPES) {
      expect(tplOf(g), `${g} 应含题类自洽总纲`).toContain('题目自洽（编辑自查总纲');
    }
    for (const g of CONTENT_TYPES) {
      expect(tplOf(g), `${g} 不应含题类自洽总纲（内容型另有判据）`).not.toContain('题目自洽（编辑自查总纲');
    }
  });

  it('标题↔题内一致各按其形：exam 拿"大题标题"条，6 类教辅题类拿"组标题"条，互不串味', () => {
    const exam = tplOf('exam');
    expect(exam).toContain('标题里写到的提示方式与作答方式必须与题内实际一致');
    expect(exam).toContain('照抄它行首的调研分类名');
    expect(exam, 'exam 不走教辅的组标题条款').not.toContain('组标题里写到的提示方式与作答方式');
    for (const g of QUESTION_TYPES.filter((x) => x !== 'exam')) {
      const t = tplOf(g);
      expect(t, `${g} 应含组标题↔题内一致`).toContain('组标题里写到的提示方式与作答方式');
      expect(t, `${g} 不应出现 exam 专用的大题标题条`).not.toContain('照抄它行首的调研分类名');
    }
  });

  it('尾约束·全文自洽对 9 类全部注入（同一份，含标题声明域与定稿前动作）', () => {
    for (const g of [...QUESTION_TYPES, ...CONTENT_TYPES]) {
      const msg = buildUserMessagePrompt({ genType: g, subject: '英语', materialChannel: 'full', outputMode: 'once' });
      expect(msg, `${g} 应注入尾约束·全文自洽`).toContain('【尾约束·全文自洽】');
      expect(msg, `${g} 应含标题声明域`).toContain('写在标题、栏目标题、题干、导语、目录、图注、注释里的都算');
      expect(msg, `${g} 应含定稿前动作`).toContain('定稿前逐节逐题按下面三域复核');
    }
  });
});

// ⑦ 题号**编号体系**（用户追问第三卷：口径对比"答案区题号数(5) 明显少于正文(10)"还是有问题吧）
//   实证（六年级英语综合检测）：题号**按大题分别从 1 重新编号**（正文各大题 1~5/1~10 重来，答案区亦然）。
//   "最长 1 起连续递增段"本是**缺号检测**口径，用它做"两侧数量对比"在分段式编号下**不成立**：
//   同一体系的缺陷被呈现成"答案区(5) 少于正文(10)，疑似未逐题对齐"，把编辑引向错误方向。
//   处置：countTopQuestions 同源升级为 analyzeQuestionNumbering（暴露"段"本身）→ 分段式改报**编号体系**，
//   两侧计数对比与反向护栏在该情形下一并停用（口径不适用就不报，不用不适用口径出结论）。
describe('⑦ 题号编号体系：分段式编号改报体系问题，不再用"最长段"做两侧对比', () => {
  const run = (body, ans) => auditExamPaper(body + ans, { subject: '英语', stage: 'primary_high', genType: 'exam' });
  const notes = (r, type) => (r.silentDetails || []).filter((d) => d.type === type).map((d) => d.message).join(' | ');
  // 分段式：一大题 1~5、二大题 1~10（各自从 1 重编号）
  const segBody = `<h2>一、听力（每题2分，共10分）</h2>`
    + Array.from({ length: 5 }, (_, i) => `<p class="question">${i + 1}. 题</p>`).join('')
    + `<h2>二、单项选择（每题1分，共10分）</h2>`
    + Array.from({ length: 10 }, (_, i) => `<p class="question">${i + 1}. 题</p>`).join('');
  const segAns = `<div class="answer-section"><h2>参考答案</h2>`
    + `<h2>一、听力</h2>${Array.from({ length: 5 }, (_, i) => `<p>${i + 1}. A</p>`).join('')}`
    + `<h2>二、单项选择</h2>${Array.from({ length: 10 }, (_, i) => `<p>${i + 1}. A</p>`).join('')}</div>`;

  it('分段式编号 → 报"编号体系与全卷连续口径不符"，并给出两侧段长清单', () => {
    const msg = notes(run(segBody, segAns), 'question-numbering-system');
    expect(msg).toContain('按大题分别从 1 重新编号');
    expect(msg).toContain('2 段（段长 5、10）');          // 正文段长清单（只列大题级段）
    expect(msg).toContain('全卷连续');
  });

  it('🔴 非考卷类型（同步练习/课时练等）按大题分别编号是市场常态 → 不报"编号体系与全卷连续不符"', () => {
    // 2026-09-18 用户裁定：""全卷连续"只约束正式考卷；同步练习按大题分号不误报。
    const r = auditExamPaper(segBody + segAns, { subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(notes(r, 'question-numbering-system')).toBe('');
    // 两侧各取最长 1 起连续段，仍可比（正文 10、答案区 10 → 不触发"少于正文"）
    expect(notes(r, 'answer-coverage')).toBe('');
  });

  it('🔴 同一份资料不得同时报"答案区少于正文/正文少于答案区"（两侧对比在分段式下不成立）', () => {
    const r = run(segBody, segAns);
    expect(notes(r, 'answer-coverage')).toBe('');
    expect(notes(r, 'body-coverage')).toBe('');
  });

  it('非分段式（全卷连续）→ 体系探针不误报，原两侧对比照旧生效', () => {
    const body = `<h2>一、听力（每题2分，共20分）</h2>`
      + Array.from({ length: 20 }, (_, i) => `<p class="question">${i + 1}. 题</p>`).join('');
    const ans = `<div class="answer-section"><h2>参考答案</h2>`
      + Array.from({ length: 6 }, (_, i) => `<p>${i + 1}. A</p>`).join('') + '</div>';
    const r = run(body, ans);
    expect(notes(r, 'question-numbering-system')).toBe('');
    expect(notes(r, 'answer-coverage')).toContain('明显少于正文');
  });

  it('段长清单只列大题级段（≥3 项）：零散命中（1 项长段）不进报告，避免误导', () => {
    const msg = notes(run(segBody, segAns), 'question-numbering-system');
    expect(msg).not.toContain('段长 1');
  });

  it('🔴 题干内编号列举（"提示：1. 2. 3. 4."）不得伪造出"大题段"→ 不误报编号体系', () => {
    const body = `<h2>一、积累与运用（共26分）</h2>`
      + Array.from({ length: 13 }, (_, i) => `<p class="question">${i + 1}. 题</p>`).join('')
      + `<p class="question">14. 写作。（20分）提示： 1. 写清时间地点 2. 写出经过 3. 写感受 4. 不少于5句</p>`;
    const ans = `<div class="answer-section"><h2>参考答案</h2>`
      + Array.from({ length: 14 }, (_, i) => `<p>${i + 1}. 答案</p>`).join('') + '</div>';
    const r = run(body, ans);
    expect(notes(r, 'question-numbering-system')).toBe('');
  });
});

// ⑧ 判据域（管辖范围）：标题声称 vs 本大题实给、括号形态 vs 全卷
//   用户追问第三卷"内容符合正规考试那样吗"实测两处**漏报**（每个大类都因"别处对了"被放过）：
//   ① 第一大题标题「听录音，选出你所听到的单词**或图片**」，选项全是单词、本大题无图，而第五大题确有 [IMAGE]
//      → 旧探针按**整卷**判图标记，本大题的"标题与内容不符"被别处的图遮蔽；
//   ② 第一大题全角「（　）」、第二/九大题半角「(        )」，**每个大题各自统一**、同卷却两种形态并存
//      → 旧探针按**同一大题内**判形态，恒不命中（形态统一本是**同卷**口径）。
//   处置：判据域按各自语义取域——标题的管辖范围=本大题；位置统一=大题内；形态统一=全卷。
describe('⑧ 判据域：标题管本大题、形态管全卷（防"别处对了"遮蔽）', () => {
  const run = (html) => auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'exam' });
  const notes = (r, type) => (r.silentDetails || []).filter((d) => d.type === type).map((d) => d.message).join(' | ');
  const hasImg = '<p>1. <u class="blank-2">&emsp;</u></p>[IMAGE]\nPROMPT:一棵大树\n[/IMAGE]';

  it('标题声称"图片"、本大题无图，别的大题有图 → 仍报标题与内容不符（不再被别处的图遮蔽）', () => {
    const html = `<h2>一、听录音，选出你所听到的单词或图片（每题2分，共4分）</h2>`
      + `<p class="question">（　）1. A. try　B. tree</p><p class="question">（　）2. A. see　B. sea</p>`
      + `<h2>五、根据图片提示写出正确的单词（每题2分，共2分）</h2>${hasImg}`
      + '<div class="answer-section"><h2>参考答案</h2><p>1. B</p></div>';
    const r = run(html);
    expect(notes(r, 'title-content-mismatch')).toContain('标题与内容不符');
    expect(notes(r, 'title-content-mismatch')).not.toContain('图片提示写出正确的单词'); // 有图那题不得被点名
  });

  it('本大题自己有图 → 标题与内容相符，不报（判据域收窄不误伤）', () => {
    const html = `<h2>五、根据图片提示写出正确的单词（每题2分，共2分）</h2>${hasImg}`
      + '<div class="answer-section"><h2>参考答案</h2><p>1. tree</p></div>';
    expect(notes(run(html), 'title-content-mismatch')).toBe('');
  });

  it('跨大题全角/半角混用（各大题各自统一）→ 报"同卷形态不统一"', () => {
    const html = `<h2>一、单项选择（每题2分，共4分）</h2>`
      + `<p class="question">（　）1. 题干</p><p class="question">（　）2. 题干</p>`
      + `<h2>二、判断正误（每题2分，共4分）</h2>`
      + `<p class="question">(        )1. 句子</p><p class="question">(        )2. 句子</p>`
      + '<div class="answer-section"><h2>参考答案</h2><p>1. A</p></div>';
    expect(notes(run(html), 'answer-blank-form')).toContain('同卷');
  });

  it('全卷只用全角 → 不报（形态统一）', () => {
    const html = `<h2>一、单项选择（每题2分，共4分）</h2>`
      + `<p class="question">（　）1. 题干</p><p class="question">（　）2. 题干</p>`
      + `<h2>二、判断正误（每题2分，共4分）</h2>`
      + `<p class="question">（　）3. 句子</p><p class="question">（　）4. 句子</p>`
      + '<div class="answer-section"><h2>参考答案</h2><p>1. A</p></div>';
    expect(notes(run(html), 'answer-blank-form')).toBe('');
  });
});
