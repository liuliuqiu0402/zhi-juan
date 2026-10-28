// ============================================================
// 判据规格测试（不调模型）
// ------------------------------------------------------------
// 目的：验证"按判据写出来的卷面"程序认得出、核得对；以及每一条破坏恰好触发对应的报点。
// 这一层能挡住"判据写不出合法产物"（互相打架、缺口径），挡不住"模型不照写"。
// 对应设计：A 题内标本题分 / 标题标合计；B 只做样式转换（同分→每题式，不同分→分组式）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const OPTS = { subject: '数学', stage: 'primary_mid', genType: 'exam' };

/** 与分值相关的报点类型（只断言这一类，其它规则不参与本规格） */
const SCORE_TYPES = new Set([
  'title-unit-misplaced',      // 有号栏缺小题分 / 无号栏题内却写了分
  'title-score-sum-mismatch',  // 标题声明 ≠ 逐题合计
  'score-sum-mismatch',        // 各大题合计 ≠ 卷首
]);

const scoreNotices = (r) => (r.silentDetails || [])
  .filter((d) => d.level !== 'debug')
  .filter((d) => SCORE_TYPES.has(d.type));

const numbered = (title, n, scoreEach, carrier = '____') => [
  `<h3>${title}</h3>`,
  ...Array.from({ length: n }, (_, i) => (
    `<p class="question">${i + 1}．第${i + 1}题${carrier}。（${scoreEach}）</p>`)),
].join('\n');

/** 理想卷：完全按判据写（口算无号只在标题标；有号栏每题标本题分、标题标合计） */
const IDEAL = [
  '<h1>二年级数学单元测评</h1>',
  '<p class="paper-head">（本卷满分100分，考试时间60分钟）</p>',
  '<h3>一、直接写得数（每题1分，共14分）</h3>',
  '<p class="question">7＋8＝　9－4＝　6＋6＝　13－5＝　8＋9＝　12－7＝　5＋7＝</p>',
  '<p class="question">14－6＝　9＋9＝　4＋8＝　15－7＝　6＋7＝　11－3＝　8＋8＝</p>',
  numbered('二、填空（每题2分，共24分）', 12, '每空1分，共2分'),
  numbered('三、判断（每题2分，共10分）', 5, '每题2分，共2分', '（　）'),
  numbered('四、选择（每题2分，共10分）', 5, '每题2分，共2分', '（　）'),
  numbered('五、动手操作（每题4分，共8分）', 2, '每题4分，共4分', '（作图区）'),
  numbered('六、看图列式计算（每题3分，共6分）', 2, '每题3分，共3分', '（看图）'),
  numbered('七、解决问题（每题7分，共28分）', 4, '每题7分，共7分', '（解答区）'),
].join('\n');

describe('分值判据规格：理想卷应 0 告警', () => {
  it('按判据写出来的整卷，分值类告警为 0', () => {
    expect(scoreNotices(auditExamPaper(IDEAL, OPTS))).toEqual([]);
  });
});

describe('分值判据规格：单点破坏各自触发对应报点', () => {
  it('有号栏整栏不标 → 报「有 N 道带题号的题没标分」', () => {
    const broken = IDEAL.replace(/（每题2分，共2分）<\/p>/g, '</p>');
    const msgs = scoreNotices(auditExamPaper(broken, OPTS)).map((d) => d.message);
    expect(msgs.some((m) => /道带题号的题没标分/.test(m))).toBe(true);
  });

  it('题内抄了整栏合计（看图每题写共6分）→ 报「标题声明 6、逐题合计 12」', () => {
    const broken = IDEAL.replace(/（每题3分，共3分）/g, '（每题3分，共6分）');
    const msgs = scoreNotices(auditExamPaper(broken, OPTS)).map((d) => d.message);
    expect(msgs.some((m) => /逐题分合计12分/.test(m)), msgs.join('｜')).toBe(true);
    expect(msgs.some((m) => /与卷首满分 100 分不符/.test(m))).toBe(true);
  });

  it('无号栏题内写了分（口算两行各写一处）→ 报「没有写小题号，题内却出现逐题分」', () => {
    const broken = IDEAL
      .replace('5＋7＝', '5＋7＝（1分）')
      .replace('8＋8＝', '8＋8＝（1分）');
    const msgs = scoreNotices(auditExamPaper(broken, OPTS)).map((d) => d.message);
    expect(msgs.some((m) => /没有写小题号，题内却出现了 2 处逐题分/.test(m)), msgs.join('｜')).toBe(true);
  });
});

describe('B 只做样式转换：标题由各题分合成', () => {
  it('各题同分 → 标题为「（每题X分，共Y分）」', () => {
    const out = auditExamPaper(IDEAL, OPTS).html;
    expect(out).toContain('（每题2分，共10分）');
    expect(out).toContain('（每题7分，共28分）');
  });

  it('各题不同分 → 同分的并成「第1、2小题各2分」，其余单列', () => {
    const out = auditExamPaper([
      '<h1>测评</h1>', '<p class="paper-head">（本卷满分10分）</p>',
      '<h3>一、算一算（共10分）</h3>',
      '<p class="question">1．甲____。（每空1分，共2分）</p>',
      '<p class="question">2．乙____。（每空1分，共2分）</p>',
      '<p class="question">3．丙____。（每空1分，共6分）</p>',
    ].join('\n'), OPTS).html;
    expect(out).toContain('（第1、2小题各2分，第3小题6分，共10分）');
  });
});
