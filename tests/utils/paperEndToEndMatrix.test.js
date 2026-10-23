// 端到端矩阵（2026-10-20）：**标题＋大题号＋小题号（有/无）＋标分（A→B）同时成立**
// ============================================================
// 属主要求："标题、题号（大题号、小题号、不带小题号的）、标分（A+B）同时测试，不依赖真机"。
// 本文件按**当前实发判据**写出 A 侧产物，跑程序侧（B＋质检）后断言**最终卷面**：
//   ① 大题号＝汉字序号（一、二、三），不出现阿拉伯大题号；
//   ② 无子题的大题（口算/竖式）：其下不得出现任何题号、不得逐条标分、标题带单价；
//   ③ 有子题的大题（填空）：1.–7. 题号保留；标题由 B 按每题总分合成为分组式；
//      题内 7 条标注全保留，且各题总分之和＝标题总数；
//   ④ 同一份卷里三件事同时成立（不是单测某一项）。
// ⚠️ 边界：本测试验的是"判据→程序"的契约与程序侧输出；模型是否照判据写，只能靠真机烟测。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const run = (html, stage = 'primary_mid', subject = '数学') =>
  auditExamPaper(html, { subject, stage, genType: 'exam' });

const titles = (html) => [...html.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);

/** 按 h3 切段：返回 { 标题: 段内正文文本 } */
function sections(html) {
  const parts = html.split(/(?=<h[2-4]>)/);
  const out = {};
  for (const p of parts) {
    const m = p.match(/^<h[2-4]>([\s\S]*?)<\/h[2-4]>/);
    if (!m) continue;
    out[m[1]] = p.slice(m[0].length);
  }
  return out;
}

const KOU_SUAN = [
  '<h1>单元测评</h1>',
  '<h3>一、直接写出得数（每式1分，共14分）</h3>',
  '<p>3×5＝____　2×6＝____　4×3＝____　5×5＝____</p>',
  '<p>6×4＝____　3×3＝____　2×5＝____　6×6＝____</p>',
  '<p>4×4＝____　5×2＝____　6×3＝____　1×5＝____</p>',
  '<p>5×4＋4＝____　6×3－6＝____</p>',
].join('\n');

const SHU_SHI = [
  '<h1>单元测评</h1>',
  '<h3>二、列竖式计算（每题3分，共12分）</h3>',
  '<p>24＋35＝　　　　43－18＝</p>',
  '<p>56－27＝　　　　38＋24＝</p>',
].join('\n');

const TIAN_KONG_ITEMS = [4, 4, 4, 2, 2, 4, 4]; // 7 题共 24 空
const TIAN_KONG = [
  '<h1>单元测评</h1>',
  '<h3>三、填空（共24分）</h3>',
  ...TIAN_KONG_ITEMS.map(
    (n, i) => `<p>${i + 1}. ${'____　'.repeat(n)}（每空1分，共${n}分）</p>`,
  ),
].join('\n');

describe('端到端矩阵：标题 × 大题号 × 小题号 × 标分（A→B）', () => {
  it('① 无子题（口算）：不出现任何题号、不逐条标分，标题单价原样', () => {
    const r = run(KOU_SUAN);
    expect(titles(r.html), '标题原样（B 不动无"共X分"的标题）').toContain('一、直接写出得数（每式1分，共14分）');
    const sec = sections(r.html)['一、直接写出得数（每式1分，共14分）'] || '';
    expect(sec, '其下不得出现任何题号（1. / 2. …）').not.toMatch(/<p>\s*\d{1,2}\s*[.、．]/);
    expect(sec, '不得逐条标分').not.toMatch(/（每[^）]{1,4}\d+分，共\d+分）/);
    expect(sec, '大字题号也不得推到题号').not.toMatch(/一、\s*1\./);
  });

  it('② 无子题（竖式）：不出现任何题号、不逐条标分，标题单价原样', () => {
    const r = run(SHU_SHI);
    expect(titles(r.html)).toContain('二、列竖式计算（每题3分，共12分）');
    const sec = sections(r.html)['二、列竖式计算（每题3分，共12分）'] || '';
    expect(sec, '竖式 2 行 4 式也不得带号').not.toMatch(/<p>\s*\d{1,2}\s*[.、．]/);
    expect(sec, '不得逐条标分').not.toMatch(/（每[^）]{1,4}\d+分，共\d+分）/);
  });

  it('③ 有子题（填空）：题号保留；标题由 B 合成为真题样式；题内 7 条标注全保留', () => {
    const r = run(TIAN_KONG);
    expect(titles(r.html), 'B 合成：按每题总分分组（不按空）').toContain('三、填空（第1、2、3、6、7小题各4分，第4、5小题各2分，共24分）');
    const sec = sections(r.html)['三、填空（第1、2、3、6、7小题各4分，第4、5小题各2分，共24分）'] || '';
    const nums = [...sec.matchAll(/<p>\s*(\d{1,2})\s*[.、．]/g)].map((m) => m[1]);
    expect(nums, '1.–7. 题号保留').toEqual(['1', '2', '3', '4', '5', '6', '7']);
    const labels = [...sec.matchAll(/每空1分，共(\d+)分/g)].map((m) => Number(m[1]));
    expect(labels.length, '每题一条标注').toBe(7);
    expect(labels.reduce((a, b) => a + b, 0), '逐题合计＝标题总数').toBe(24);
  });

  it('④ 同一份卷：大题号汉字、无子题不带号、有子题带号、三处标分同时成立', () => {
    const html = [KOU_SUAN.replace('<h1>单元测评</h1>', ''), SHU_SHI.replace('<h1>单元测评</h1>', ''), TIAN_KONG.replace('<h1>单元测评</h1>', '')]
      .join('\n');
    const r = run('<h1>单元测评</h1>\n' + html);
    const ts = titles(r.html);

    // 大题号：汉字序号，不出现"1、/一、1."
    expect(ts.length, '三个大题').toBe(3);
    ts.forEach((t) => expect(t, '大题号＝汉字序号').toMatch(/^[一二三四五六七八九十]+、/));
    expect(r.html, '不得出现阿拉伯大题号').not.toMatch(/<h3>\s*\d{1,2}\s*[.、．]/);

    // 无子题两个大题：段内无题号
    for (const t of ['一、直接写出得数（每式1分，共14分）', '二、列竖式计算（每题3分，共12分）']) {
      const sec = sections(r.html)[t] || '';
      expect(sec, `${t} 下不得有题号`).not.toMatch(/<p>\s*\d{1,2}\s*[.、．]/);
    }

    // 有子题：标题合成 + 每条标分
    expect(ts).toContain('三、填空（第1、2、3、6、7小题各4分，第4、5小题各2分，共24分）');
    const sec3 = sections(r.html)['三、填空（第1、2、3、6、7小题各4分，第4、5小题各2分，共24分）'] || '';
    expect([...sec3.matchAll(/<p>\s*(\d{1,2})\s*[.、．]/g)].length, '7 道题').toBe(7);
    expect([...sec3.matchAll(/每空1分，共\d+分/g)].length, '7 条标注').toBe(7);

    // 标题总分账目：14＋12＋24＝50
    const totals = ts.map((t) => {
      const m = t.match(/共\s*(\d+)\s*分/);
      return m ? Number(m[1]) : 0;
    });
    expect(totals.reduce((a, b) => a + b, 0), '三题合计＝50').toBe(50);
  });

  it('⑤ A 侧漏标（填空只写标题共24分、题内无标注）⇒ B 不合成、不造数（缺口暴露而非静默写错）', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>三、填空（共24分）</h3>',
      ...TIAN_KONG_ITEMS.map((n, i) => `<p>${i + 1}. ${'____　'.repeat(n)}</p>`),
    ].join('\n');
    const r = run(html);
    expect(titles(r.html), '无逐题标注 ⇒ 保持（共24分）').toContain('三、填空（共24分）');
    expect(r.html, '不得编造单价').not.toContain('每空1分');
  });

  it('⑥ 中学段：域型名标题只写（共X分），B 不把单价合成进去', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>一、积累与运用（共20分）</h3>',
      '<p>1. 下列词语中加点字读音正确的一项是（2分）（　）</p>',
      '<p>2. 默写填空（4分）____</p>',
    ].join('\n');
    const r = run(html, 'middle', '语文');
    const ts = titles(r.html);
    expect(ts, '中学标题保持范围标识式').toContain('一、积累与运用（共20分）');
    expect(ts.join(''), '不得合成单价').not.toMatch(/每(题|空|处)\d+分/);
  });
});

// ── 判据侧：同一件事在 prompt 里只能落到**一个**分支（条件＝一个布尔事实：其下有没有题号）──
describe('判据可判定性：口算/竖式/填空 各自命中且只命中一支', () => {
  const t = getPromptTemplate({ grade: 'primary_mid', subject: '数学', genType: 'exam' }).template;
  const score = (t.match(/【分值标注】([\s\S]*?)\n\n【/) || [, ''])[1];

  it('两支互斥且穷尽：条件就是"编号 / 不编号"这一个事实', () => {
    expect(score, '不编号支').toContain('直答区');
    expect(score, '编号支').toContain('编号的大题');
  });

  it('口算/竖式（不写号）⇒ 不写号支：标题给单价、题内不标分', () => {
    expect(score, '单价随标题（直答区）').toContain('标题写"（每〈单位〉X分，共X分）"');
    expect(score, '关键反向约束在位（不编号不写号）').toContain('每题不写小题号');
    expect(score, '不编号 ⇒ 分值只由标题承载').toContain('分值只由标题承载');
    expect(score, '不得为分值补号/补题干').toContain('只标本来就有的子题');
  });

  it('填空（有题号）⇒ 有题号支，且该支必须逐题标分', () => {
    expect(score, '标题写单价也不替代小题标分').toContain('题号与分值同生同死');
    expect(score, '每个子题末标分').toContain('每个小题在带题号的那一行末尾写');
    expect(score, '不为此新增题号或题干').toContain('不为此新增题号或题干');
  });

  // 🔴 2026-10-23（属主基准·撤第二把尺）：原来这里锁的是旧判据字面（"并列的同类作答项／共用一条作答要求／
  //   各自有独立题干"）。现编号只判一次、只看一组只做一个动作：**并列项**下没有以句号/问号收尾的完整句子 ⇒ 不编号；
  //   **有独立题干**的每道题都是一句 ⇒ 两道及以上即成编号。断言改锚到唯一判据 + 反向锁旧措辞。
  it('编号判据支持上面两个事实：并列项不编号 / 有独立题干的各自编号', () => {
    expect(t, '唯一判据＝一组只做一个动作').toContain('一组只做一个动作');
    expect(t, '一组只做一个动作＝一组只做一个动作').toMatch(/一组只做一个动作/);
    expect(t, '第二把尺（共用一条作答要求／各自有独立题干）不得回潮').not.toMatch(/共用一条作答要求|各自有独立题干/);
  });

  it('中学域型名标题（只作范围标识）⇒ 判为不编号，不被"编号"支误伤', () => {
    expect(score, '编号判据＝一组只做一个动作（看"有没有各自成句的题"）').toContain('一组只做一个动作');
    const mid = getPromptTemplate({ grade: 'middle', subject: '语文', genType: 'exam' }).template;
    expect(mid, '中学支在位').toContain('标题只作范围标识');
  });
});
