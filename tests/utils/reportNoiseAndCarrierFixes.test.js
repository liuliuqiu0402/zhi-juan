// 🔴 2026-09-17 用户实证批次：报告噪音与载体形态的程序侧根治（守卫）
// ============================================================
// 触发：用户拿六年级英语卷（Unit 1 Try your best）逐条追问四处——
//   ① ⚠️「英语」结构图/示意图/地图无结构化图形能力（[GRAPH] 仅支持统计图）—— 噪音？  → 是（全类型通用问题）
//   ② 答案区题号数(35) 明显少于正文(51)                                    → 误报（题类通用问题）
//   ③ ℹ️ 正文题号形态未全部识别（缺 36–40）×2                            → 形式性提示 + 重复两处
//   ④ 第六题题首是横线（应为括号）／第八题每条小题 4 条长横线（程序兜底？） → 是
// 处置（全部按**根治**：改判据/规格同源，不加白名单）：
//   · ①② 判据口径修正（报告层）   · ③ 提取判据补全（行内题号 + 紧跟作答位）＋ 消除重复落点
//   · ④ 分值下推（不再落"无分值 4 行"）＋ 题首形态确定性归一（新规则 choice-first-blank-fix）
// 本文件锁住这四条，防回潮。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { extractBodyQuestionNumbers, detectBodyNumberingGap } from '../../src/utils/contentCleaner.js';

const PARAS = (n) => Array.from({ length: n }, (_, i) => `<p class="question">${i + 1}. 题目${i + 1}内容</p>`).join('');

describe('① 生图引擎提示：只在"画面确需结构化图形"时报（消噪音）', () => {
  const run = (subject, stem, prompt, stage = 'primary_high', genType = 'exam') =>
    auditExamPaper(`<h2>一、选择题（每题2分，共10分）</h2><p>${stem}</p>[IMAGE]\nPROMPT:${prompt}\n[/IMAGE]<p>2. 下一题</p>`,
      { subject, stage, genType }).silentDetails.filter((d) => d.type === 'image-engine-only').map((d) => d.message).join(' | ');

  it('英语·场景图（大树+蜗牛）→ 不报（原实证噪音）', () => {
    expect(run('英语', '1. 根据图片提示写单词', '一棵大树上有一只蜗牛在爬，树下有一只小鸟')).toBe('');
  });
  it('英语·地图类画面 → 报，且按"本学科不注入 [GRAPH]"分档（不再套"仅支持统计图"）', () => {
    const m = run('英语', '1. 看图回答问题', '一张简化的城市地图，标有三个地名');
    expect(m).toContain('本学科不注入 [GRAPH]');
    expect(m).not.toContain('仅支持统计图');
  });
  it('生物·结构图 → 报，文案为"仅支持统计图"（该学科确有统计图能力）', () => {
    const m = run('生物', '1. 观察下面的结构图', '一个细胞结构示意图', 'middle', 'practice');
    expect(m).toContain('[GRAPH] 仅支持统计图');
  });
});

describe('② 答案区题号计数：块边界口径补全（表格/换行也算行界）', () => {
  it('表格化答案区（题号跨单元格）→ 与正文同口径计数，不误报', () => {
    const body = `<h2>一、选择题（每题2分，共72分）</h2>${PARAS(36)}`;
    // 答案区用表格：35/36 分处相邻单元格（原口径下"…35. B36. C"无前界 → 连续段断在 35 → 误报）
    const ansCellA = Array.from({ length: 35 }, (_, i) => `${i + 1}. A`).join('　');
    const html = body
      + `<div class="answer-section"><h2>参考答案</h2>`
      + `<table><tr><td>${ansCellA}</td><td>36. B</td></tr></table></div>`;
    const r = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'exam' });
    const msgs = r.silentDetails.filter((d) => d.type === 'answer-coverage').map((d) => d.message).join(' | ');
    expect(msgs, `不应报答案区题号缺口：${msgs}`).toBe('');
  });

  it('反向护栏：答案区确实几乎无题号 → 仍报（防口径放宽后静默）', () => {
    const body = `<h2>一、选择题（每题2分，共14分）</h2>${PARAS(7)}`;
    const html = body
      + `<div class="answer-section"><h2>参考答案</h2><table><tr><td>（1）A　（2）B　（3）C　（4）A　（5）B　（6）C　（7）A</td></tr></table></div>`;
    const r = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'exam' });
    expect(r.silentDetails.some((d) => d.type === 'answer-coverage')).toBe(true);
  });
});

describe('③ 行内题号（紧跟作答位）计入 —— 不再出"形式性缺号"提示', () => {
  it('行内 `36. ＿＿` 形态被识别为顶层题号（补全对话/连词成句常见）', () => {
    const html = `<h2>七、补全对话（每题2分，共10分）</h2>`
      + `<p>Amy: Hi, Mike. 36. <u class="blank-3">&emsp;</u></p>`
      + `<p>37. <u class="blank-3">&emsp;</u></p>`;
    expect(extractBodyQuestionNumbers(html)).toEqual([36, 37]);
  });

  it('题干内的列举编号（无作答空位紧跟）不得计入（防口径放宽）', () => {
    const html = `<h2>十、书面表达（共10分）</h2>`
      + `<p>51. 提示：1. What did you do? 2. How was it? 3. Try your best.</p>`;
    expect(extractBodyQuestionNumbers(html)).toEqual([51]);
  });

  it('1~35 行首 + 36~40 行内 → 无缺口（原检测口径会判"缺 36–40"）', () => {
    const html = `<h2>一、听力（共70分）</h2>${PARAS(35)}`
      + `<h2>七、补全对话（每题2分，共10分）</h2>`
      + [36, 37, 38, 39, 40].map((n) => `<p>Amy: 说点什么 ${n}. <u class="blank-3">&emsp;</u></p>`).join('');
    expect(detectBodyNumberingGap(html)).toBeNull();
  });
});

describe('④ 作答空间：分值下推（不再落"无分值 4 行兜底"）+ 题首形态归一', () => {
  it('英语·连词成句（大题"每题2分"、小题无分值）→ 每条小题补 2 行（规格算：2分×1.0），不再补 4 行', () => {
    const items = [41, 42, 43, 44, 45]
      .map((n) => `<p class="question">${n}. did / what / last / you / weekend / do (?)</p>`).join('');
    const html = `<h2>八、连词成句，注意大小写和标点（每题2分，共10分）</h2>${items}`;
    const r = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'exam' });
    const rows = (r.html.match(/blank-line/g) || []).length;
    expect(rows, `应补 5 题 × 2 行 = 10 条（实际 ${rows} 条）`).toBe(10);
  });

  it('带选项的题：题首下划线空/裸空 → 确定性归一为圆括号空位（只换形态、不动位置）', () => {
    const html = `<h2>六、单项选择（每题1.5分，共15分）</h2>`
      + `<p><u class="blank-8">&emsp;</u>26. — I'm afraid I can't do it well.</p>`
      + `<p>A. Don't worry.　B. You're welcome.　C. Thank you.</p>`
      + `<p><u class="blank-8">&emsp;</u>27. Last Friday, Lily sang a song.</p>`
      + `<p>A. sings　B. sang　C. is singing</p>`;
    const r = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'exam' });
    expect(r.html).toContain('（　）26.');
    expect(r.html).toContain('（　）27.');
    expect(r.html, '题首下划线空应已被替换').not.toContain('<u class="blank-8">');
    expect(r.issues.some((x) => x.type === 'choice-first-blank')).toBe(true);
  });

  it('无选项的题（填空/默写类）行首空位不动（防误改）', () => {
    const html = `<h2>五、根据中文提示写单词（每题2分，共10分）</h2>`
      + `<p><u class="blank-8">&emsp;</u>21. The snail is climbing up the tall tree. (树)</p>`;
    const r = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'exam' });
    expect(r.html).toContain('<u class="blank-8">');
    expect(r.issues.some((x) => x.type === 'choice-first-blank')).toBe(false);
  });
});

// 🔴 2026-09-17 用户追问后补齐的第二步：**影响面枚举 + 规格层封顶**（此前只做了分值下推、漏了封顶）
//   全矩阵实测（53 科段 × 9 档分值 = 477 组合）暴露真异常：语文·小低「按要求写句子（每题5分）」7 行/题、
//   低段每题6分→9行/8分→12行/15分→21行。封顶放在规格库（ANSWER_MAX_ROWS_BY_STAGE），
//   需求行数 = min(分值×系数, 学段上限)；调节点只有规格库一处，补差逻辑里不得加题型特例。
import { getAnswerRegion, ANSWER_MAX_ROWS_BY_STAGE } from '../../src/config/layoutSpec.js';
import { STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';

describe('⑤ 单题作答区行数上限（规格层封顶）：全矩阵不得越界', () => {
  const SCORES = [1, 2, 3, 4, 5, 6, 8, 10, 15];

  it('全学科×全学段：min(分值×系数, 上限) 恒不超过该学段上限，且上限取值合法', () => {
    const rows = [];
    for (const [stage, subs] of Object.entries(STAGE_SUBJECTS)) {
      for (const subject of subs) {
        const r = getAnswerRegion(subject, stage);
        expect(Number.isFinite(r.maxRowsPerItem), `${subject}·${stage} 缺上限`).toBe(true);
        expect(r.maxRowsPerItem).toBe(ANSWER_MAX_ROWS_BY_STAGE[stage]);
        for (const s of SCORES) {
          const need = Math.min(Math.ceil(s * r.linePerScore), r.maxRowsPerItem);
          rows.push({ subject, stage, s, need });
          expect(need, `${subject}·${stage} ${s}分`).toBeLessThanOrEqual(r.maxRowsPerItem);
        }
      }
    }
    // 反例锚点（原异常档）：低段 5 分短答不得再拿 7 行
    const low = rows.filter((x) => x.stage === 'primary_low' && x.s === 5);
    expect(low.every((x) => x.need <= 4)).toBe(true);
    // 正向锚点：初中/高中 8 分以上长答保住 8 行（不能被压得过狠）
    expect(Math.min(Math.ceil(8 * getAnswerRegion('数学', 'middle').linePerScore), 8)).toBe(8);
    expect(Math.min(Math.ceil(10 * getAnswerRegion('物理', 'high').linePerScore), 8)).toBe(8);
  });

  it('上限按学段单调不减（低段最紧），且规格层可整体覆盖', () => {
    const seq = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'].map((s) => ANSWER_MAX_ROWS_BY_STAGE[s]);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
  });

  it('端到端：语文·小低「连词成句（每题2分）」→ 1 行/题（2026-09-26 用户实证）；高分值仍受封顶', () => {
    // 🔴 2026-09-26 用户实证（"十一、连词成句，加上合适的标点：每小题一行就够，结果补了 3 行"）：
    //    低段系数 1.4→0.5（2分=1行）；规格层仍是唯一点，补差逻辑不加题型特例
    const items2 = [1, 2, 3].map((n) => `<p class="question">${n}. 连词成句，加上合适的标点。</p>`).join('');
    const r2 = auditExamPaper(`<h2>十一、连词成句，加上合适的标点（每题2分，共6分）</h2>${items2}`,
      { subject: '语文', stage: 'primary_low', genType: 'exam' });
    const lines2 = (r2.html.match(/blank-line/g) || []).length;
    expect(lines2, `应为 3 题 × 1 行 = 3 条（实际 ${lines2}）`).toBe(3);

    // 封顶仍生效（改用高分值触发：15分×0.5=7.5→8 行 → 收敛到学段上限 4）
    const items = [1, 2, 3].map((n) => `<p class="question">${n}. 把下面的句子改写成拟人句。</p>`).join('');
    const r = auditExamPaper(`<h2>三、按要求写句子（每题15分，共45分）</h2>${items}`,
      { subject: '语文', stage: 'primary_low', genType: 'exam' });
    const lines = (r.html.match(/blank-line/g) || []).length;
    expect(lines, `封顶生效：应为 3 题 × 4 行 = 12 条（实际 ${lines}）`).toBe(12);
    expect(r.issues.some((x) => x.type === 'answer-area' && /上限收敛/.test(x.message))).toBe(true);
  });
});

// 🔴 2026-09-26 用户实证：正式卷的写话是**汉字序号大题标题**（"十六、看图写话"）；旧补格判据只认
//   "数字开头小题"或"无编号但带（X分）" → 两头落空 → kwPs=[] → debug 静默跳过（作文格没兜住）
describe('⑥ 作文格补差：汉字序号大题标题的写话题（2026-09-26 用户实证）', () => {
  it('「十六、看图写话」为汉字序号大题标题且无分值 → 仍能补出作文格', () => {
    const html = '<h2>十六、看图写话</h2><p class="question">仔细看图，想一想，写几句话。</p>';
    const r = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(r.html, '应补出作文格 zuo-wen-ge').toContain('zuo-wen-ge');
  });

  it('非写话的汉字序号大题标题不得误补作文格', () => {
    const html = '<h2>十六、读句子（每题2分，共10分）</h2><p class="question">1. 读一读下面的句子。</p>';
    const r = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(r.html).not.toContain('zuo-wen-ge');
  });
});
