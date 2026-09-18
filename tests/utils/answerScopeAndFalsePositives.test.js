// 🔴 2026-09-18 用户实证《六年级英语上册Unit 1 Try your best 知识梳理》（docx 实物）
//    —— 三条根因的守卫（一污染 + 两误报）：
// ① 答案区**污染**：正文没有练习/自测，模型却把**素材（教材原文）里的题目**搬进答案区作答
//    （答案区出现正文根本没有的教材栏目 Cartoon time / Story time / Grammar time / Wrap-up time）。
//    根因：答案页在 full 通道携带【压缩原文·答案参考】，「作答范围由正文实际题目决定」这句
//    只写在代码注释里、**从未写进提示词** → 模型把参考原文里的教材题目也当成了作答对象。
//    处置：**模型侧**补"作答对象界定"（正文没出现过的题目/栏目一律不作答；正文无练习/自测则答案区整节省略）。
// ② 「答案区缺与正文一致的题号（正文题号 4 个，答案区仅 0 个）」→ **误报**
//    （正文那 4 个是"（三）一般过去时"下的**知识条目编号** 1./2./3./4.，不是题号；该资料的题是"例题1~例题5"）。
//    处置：**程序侧判据域修正**——内容型不参与"题号↔题"双向覆盖判据。
// ③ 「同一单词 ee 多套音标（biː / siː / triː）」→ **误报**
//    （模型把例词里的字母组合加粗：k<strong>ee</strong>p /kiːp/、b<strong>ee</strong> /biː/、tr<strong>ee</strong> /triː/；
//     sanityScan 旧口径把**所有**标签一律换成空格 → "b ee /biː/"，被切断的 "ee" 成了"假词"，
//     bee/see/tree 三个不同单词的音标被挂到它身上）。
//     处置：**程序侧判据修正**——行内标签删除（不插空白），只有块级标签转空白。
import { describe, it, expect } from 'vitest';
import { sanityScan } from '../../src/utils/contentSanity.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { ANSWER_ROLES, PAPER_OUTPUT_CONVENTIONS, buildOutputFormatHint, getPromptTemplate } from '../../src/config/promptLibrary.js';

const notes = (r, type) => (r.silentDetails || []).filter((d) => d.type === type).map((d) => d.message).join(' | ');

describe('③ 音标误报根治：行内标签不得把词切断', () => {
  it('加粗字母组合的例词（k<strong>ee</strong>p /kiːp/、b<strong>ee</strong> /biː/、tr<strong>ee</strong> /triː/）→ 不报音标冲突', () => {
    const html = '<p>例词：k<strong>ee</strong>p /kiːp/、b<strong>ee</strong> /biː/、s<strong>ee</strong> /siː/、tr<strong>ee</strong> /triː/。</p>';
    expect(sanityScan(html).filter((s) => s.includes('音标'))).toEqual([]);
  });

  it('下划线形态（画线部分）同样不被切断 → 不报', () => {
    const html = '<p>例词：b<u class="underline-sentence">ee</u> /biː/、s<u class="underline-sentence">ee</u> /siː/。</p>';
    expect(sanityScan(html).filter((s) => s.includes('音标'))).toEqual([]);
  });

  // —— 反向护栏：真冲突仍报（能力不降）——
  it('反向护栏：同一单词真有两套音标 → 仍报', () => {
    const html = '<p>cough /kɒf/</p><p>cough /kʌf/</p>';
    const out = sanityScan(html).filter((s) => s.includes('音标'));
    expect(out.length).toBe(1);
    expect(out[0]).toContain('cough');
  });

  it('反向护栏：块级标签仍作词间分隔（相邻块的两个词不会被粘成一个假词）', () => {
    // 注：单词检测另有"音标本征或音标语境"闸门（纯 ASCII 短串须靠语境词兜住），故此处给音标语境
    const html = '<p>音标：read/red/</p><p>音标：read/riːd/</p>';
    expect(sanityScan(html).filter((s) => s.includes('音标')).length).toBe(1);
  });
});

describe('② 题号误报根治：内容型不拿"知识条目编号"当题号基准', () => {
  // 正文（内容型）：知识条目编号 1./2./3./4.（不是题）；答案区用 (1)(2) 括号序号
  const contentBody = '<h1>Unit 1 知识梳理</h1>'
    + '<h2>三、重点梳理</h2>'
    + '<p>（三）一般过去时</p>'
    + '<p>1. 规则动词过去式的构成</p><p>2. 不规则动词过去式</p>'
    + '<p>3. be 动词过去式的用法</p><p>4. 时间状语与过去时搭配</p>'
    + '<h2>四、典型例题</h2><p>例题1　用所给动词的适当形式填空。Long ago, there <u class="blank-3">was</u> (be) a snail.</p>';
  const contentAns = '<div class="answer-section"><h2>参考答案与解析</h2>'
    + '<p>(1) She asked Su Yang to practise with her.</p><p>(2) She used her dancing skills.</p></div>';

  it('summary：正文的阿拉伯编号是知识条目编号 → 不报"答案区缺与正文一致的题号"，也不报两侧覆盖', () => {
    const r = auditExamPaper(contentBody + contentAns, { subject: '英语', stage: 'primary_high', genType: 'summary' });
    expect(notes(r, 'answer-coverage')).toBe('');
    expect(notes(r, 'body-coverage')).toBe('');
    expect(notes(r, 'question-numbering-system')).toBe('');
  });

  it('preview 同口径（内容型一致）', () => {
    const r = auditExamPaper(contentBody + contentAns, { subject: '英语', stage: 'primary_high', genType: 'preview' });
    expect(notes(r, 'answer-coverage')).toBe('');
  });

  // —— 反向护栏：题类不变（凡题号↔题的判据一律照旧）——
  it('反向护栏：题类（practice）同结构仍报（判据域只收内容型）', () => {
    const r = auditExamPaper(contentBody + contentAns, { subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(notes(r, 'answer-coverage')).toContain('缺与正文一致的题号');
  });

  it('反向护栏：正式卷（exam）仍报编号体系/覆盖问题', () => {
    const body = '<h2>一、听力（每题2分，共10分）</h2>'
      + Array.from({ length: 10 }, (_, i) => `<p class="question">${i + 1}. 题</p>`).join('');
    const ans = '<div class="answer-section"><h2>参考答案</h2><p>1. A</p><p>2. A</p></div>';
    const r = auditExamPaper(body + ans, { subject: '英语', stage: 'primary_high', genType: 'exam' });
    expect(notes(r, 'answer-coverage')).not.toBe('');
  });
});

describe('① 答案区污染根治：作答对象只有正文实际出现的题（模型侧界定）', () => {
  it('答案页角色（自包含教辅）写明"作答对象界定"与"正文无练习则答案区省略"', () => {
    for (const t of ['summary', 'review', 'preview', 'dictation']) {
      const role = ANSWER_ROLES.other(t);
      expect(role, `${t} 缺作答对象界定`).toContain('作答对象界定');
      expect(role).toContain('正文里没出现过的题目与栏目一律不作答');
      expect(role).toContain('不是本资料的题');
      expect(role, `${t} 缺"正文无练习则省略答案区"`).toContain('答案区整节省略');
    }
  });

  it('一次成型（once）输出约定同样界定（另一条互斥路径，同一规则）', () => {
    const s = PAPER_OUTPUT_CONVENTIONS.once('英语', true);
    expect(s).toContain('答案区的**作答对象只有正文中实际出现的题**');
    expect(s).toContain('正文不含练习/自测时，答案区整节省略');
    // 题类（非自包含教辅）不带该界定，避免向试卷/同步练习广播
    expect(PAPER_OUTPUT_CONVENTIONS.once('英语', false)).not.toContain('作答对象只有正文中实际出现的题');
  });

  it('界定为原则式：不得点具体教材栏目名（防把个别案例写进条款）', () => {
    const role = ANSWER_ROLES.other('summary');
    expect(role).not.toMatch(/Cartoon time|Story time|Grammar time|Wrap-up time|Sounds in focus/);
  });

  it('errorbook 等其它类型不被误伤（界定只进梳理型答案页）', () => {
    expect(ANSWER_ROLES.other('errorbook')).not.toContain('作答对象界定');
    expect(ANSWER_ROLES.exam('英语')).not.toContain('作答对象界定');
  });
});

describe('④ 内容型例题的书写载体：成句成段答案也要有作答位（协议缺位根治）', () => {
  const fmt = (genType, subject = '英语', stage = 'primary_high') => buildOutputFormatHint({ subject, stage, genType });

  it('内容型拿到"成句成段书写 → 整行书写横线"（与题类同一批字面，非第二套说法）', () => {
    const c = fmt('summary');
    expect(c).toContain('答案须成句成段书写的题（含成篇表达）输出整行书写横线');
    expect(c).toContain('作答位必须真实输出、不得省略');
    expect(c).toContain('不得只把答案当普通段落平铺');
    // 题类原字面照旧（抽常量不改措辞）
    expect(fmt('practice')).toContain('答案须成句成段书写的题（含成篇表达）输出整行书写横线');
  });

  it('无线留白学科（数学·初中）内容型取到"无线空白作答行"形态', () => {
    expect(fmt('summary', '数学', 'middle')).toContain('输出无线空白作答行');
  });

  it('通用模板（无学科/学段）不注入学科载体句（不猜测学科）', () => {
    expect(buildOutputFormatHint({ genType: 'summary' })).not.toContain('成句成段书写的题');
  });

  it('例题条款：作答位必须真实输出（成句成段作答的书写位须一并给出）', () => {
    const s = getPromptTemplate({ grade: '六年级', subject: '英语', genType: 'summary' }).template;
    expect(s).toContain('**作答位必须真实输出、不得省略**');
    expect(s).toContain('不得只把答案当普通段落平铺');
  });

  it('不诱导：载体句为条件式（"若含需学生自行作答的题"），不命令出题', () => {
    const c = fmt('summary');
    expect(c).toContain('本资料若含需学生自行作答的题');
    expect(c).not.toMatch(/(必须|务必|应当|需要)(包含|安排|设置|补充)(自测|练习)/);
  });
});

describe('⑤ 内容型答案区污染判据：改"报准对象"（不静默了事）', () => {
  const body = '<h1>Unit 1 知识梳理</h1><h2>一、知识框架</h2><p>语音 字母组合ee的发音</p>'
    + '<h2>四、典型例题</h2><p>例题1　用所给动词的适当形式填空。Long ago, there <u class="blank-3">was</u> (be) a snail.</p>';
  const run5 = (ans, genType) => auditExamPaper(body + ans, { subject: '英语', stage: 'primary_high', genType });

  it('答案区出现正文没有的栏目（教材栏目）→ 报"疑把素材题目当作答对象"', () => {
    const ans = '<div class="answer-section"><h2>参考答案与解析</h2>'
      + '<h3>Cartoon time</h3><p>A Read and order 3—(1)—(5)</p>'
      + '<h3>Story time</h3><p>She asked Su Yang to practise.</p></div>';
    const m = notes(run5(ans, 'summary'), 'answer-coverage');
    expect(m).toContain('正文里没有的栏目');
    expect(m).toContain('Cartoon time');
    expect(m).toContain('素材');
  });

  it('答案区小节来自正文（与正文同构）→ 不报（不误伤正常答案区）', () => {
    const ans = '<div class="answer-section"><h2>参考答案与解析</h2>'
      + '<h3>四、典型例题</h3><p>例题1　was</p></div>';
    expect(notes(run5(ans, 'summary'), 'answer-coverage')).not.toContain('正文里没有的栏目');
  });

  it('preview 同口径（内容型一致）', () => {
    const ans = '<div class="answer-section"><h2>参考答案与解析</h2><h3>Grammar time</h3><p>…</p></div>';
    expect(notes(run5(ans, 'preview'), 'answer-coverage')).toContain('正文里没有的栏目');
  });

  it('反向护栏：题类不启用该判据（判据域限内容型，防向试卷广播）', () => {
    const ans = '<div class="answer-section"><h2>参考答案</h2><h3>Cartoon time</h3><p>…</p></div>';
    expect(notes(run5(ans, 'practice'), 'answer-coverage')).not.toContain('正文里没有的栏目');
  });
});
