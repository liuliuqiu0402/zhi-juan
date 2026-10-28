// ============================================================
// 分值结构契约（2026-10-26 属主定稿：单题干 / 多题干）
// ------------------------------------------------------------
// 只断言结构与行为，不断言措辞：
//   ① 模型文本：结构判定一处、旧两支判据不得回潮
//   ② 多题干 + 各 Y 相同且单位单价相同 ⇒ 标题合成"（每题X分，共Z分）"
//   ③ 多题干 + Y 不同 ⇒ 分组式，该大题总分＝其下各题 Y 之和
//   ④ 单题干 ⇒ 标题不补分值
//   ⑤ 单价档：中学含 0.5，文本不出现学段枚举
//   ⑥ practice：不输出任何分值，且不加载【分值标注】
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const tpl = (g = 'exam', s = '数学', st = 'primary_mid') =>
  getPromptTemplate({ grade: st, subject: s, genType: g }).template;
const run = (html) => auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
const head = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1])[0] || '';
const page = (title, rows) => ['<h1>单元测评</h1>', `<h3>${title}</h3>`, ...rows].join('\n');
const q = (n, body) => `<p class="question">${n}. ${body}</p>`;

describe('分值结构契约：单题干 / 多题干', () => {
  it('① 模型文本：判据各自成条，旧"两处记账"不得回潮', () => {
    const t = tpl();
    expect(t, '结构判定').toContain('遮住大题标题、只看其中一项');
    expect(t, '单题干').toContain('（单题干）');
    expect(t, '多题干').toContain('（多题干）');
    // 🔴 2026-10-28（属主 A/B 基准）：判据**各自成条、一处一分**——
    //   原"情况相同，一律写在标题＋两处都要有"是同一份分写两处（标题 Σ 是后文之和，逆写作顺序），
    //   已废除；单题干落标题后、多题干落每题题干后，标题那一处由程序合成。
    expect(t, '单题干落点（标题后）').toContain('单题干（整栏合一）**：**分写在标题后**');
    expect(t, '多题干落点（每题题干后）').toContain('多题干（逐题独立）**：**分写在每题题干后**');
    expect(t, '先分配、后落实（标题数来自框架分配）').toContain('先分配、后落实');
    expect(t, '大题标题也写它分到的那一份').toContain('大题标题同样写它分到的那一份');
    expect(t, '旧"两处都要有"不得回潮').not.toContain('标题与题内两处都要有');
    expect(t, '旧"两种情况相同"不得回潮').not.toContain('两种情况相同');
    expect(t, '先定单价后乘个数').toContain('Y＝X×N');
    // 旧架构的两支判据整类清除
    expect(t, '旧"号是点名用的"不得回潮').not.toContain('号是点名用的');
    expect(t, '旧"带小题号/不带小题号"不得回潮').not.toContain('带小题号');
    expect(t, '旧"最后一行末尾"不得回潮').not.toContain('最后一行末尾');
  });

  it('② 多题干 + 各 Y 相同、单位单价相同 ⇒ 标题合成"（每题X分，共Z分）"', () => {
    // 2026-10-28：标题按 A 案**只写标题名**（模型不再写合计）；B 由逐题分合成。
    const html = page('四、判断', [
      q(1, '0 既不是正数也不是负数。（　）（每题2分，共2分）'),
      q(2, '假分数一定大于 1。（　）（每题2分，共2分）'),
      q(3, '两个真分数的积一定小于 1。（　）（每题2分，共2分）'),
      q(4, '1 的倒数是它本身。（　）（每题2分，共2分）'),
      q(5, '0 没有倒数。（　）（每题2分，共2分）'),
    ]);
    const r = run(html);
    expect(head(r.html), '标题合成').toBe('四、判断（每题2分，共10分）');
  });

  it('③ 多题干 + Y 不同 ⇒ 分组式，按各题总分分组', () => {
    const html = page('三、填空', [
      q(1, '____，____。（每空1分，共2分）'),
      q(2, '____，____。（每空1分，共2分）'),
      q(3, '____，____，____。（每空1分，共3分）'),
    ]);
    const r = run(html);
    expect(head(r.html), '分组式合成').toBe('三、填空（第1、2小题各2分，第3小题3分，共7分）');
  });

  it('④ 单题干 ⇒ 标题不补分值', () => {
    const html = page('三、填空', [
      q(1, '看拼音写词语。____，____。（每空2分，共4分）'),
    ]);
    const r = run(html);
    expect(head(r.html), '单题干标题原样').toBe('三、填空');
  });

  it('⑤ 单价不枚举档值：不出现档值清单、不出现学段枚举', () => {
    const t = tpl('exam', '数学', 'middle');
    // 2026-10-26（属主："不用档值的具体数字，这个算诱导"）：档值枚举会诱导模型按档挑数、而不是先看内容定单价，
    //   且与本项目既有裁定「删通行分值档——给出通行档，模型就默认 1分/2分、题题同分」相抵 ⇒ 整支删除，防回潮。
    expect(t, '档值注入位不得回潮').not.toContain('{scoreUnitLadder}');
    expect(t, '档字不得回潮（"按档换单价"）').not.toContain('按档');
    expect(t, '不写学段枚举').not.toContain('小学整数');
    expect(t, '不写学段枚举').not.toContain('中学0.5');
    // 判据仍在：先定单价、后乘个数，靠自验兜（不靠档值）
    expect(t, '先定单价后乘个数').toContain('Y＝X×N');
    expect(t, '禁止倒推').toContain('不得先定总分再倒推单价');
  });

  it('⑥ practice：不输出任何分值，且不加载【分值标注】', () => {
    const t = tpl('practice', '数学', 'primary_mid');
    expect(t, '无分值声明').toContain('本资料不输出任何分值');
    expect(t, '不加载块7').not.toContain('【分值标注】');
    // "评分标准"只可出现在否定句里（本资料不输出… / 答案区不写…），不得另有正句
    expect((t.match(/评分标准/g) || []).length, '只出现在否定句').toBeLessThanOrEqual(2);
  });
});
