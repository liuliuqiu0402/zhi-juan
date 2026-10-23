// 回归：**标题写了单价、其下却有带号子题**——B 必须把它改成真题写法（2026-10-21 属主真机第三次复现）
// ============================================================
// 属主原话："三、填空（每空1分，共24分）分值标分没生效。带题号的那一行没有标分。"
// 病根：A 侧两支（没有子题→单价随标题／有子题→标题共X分＋逐题标分）没落地；
//   而 B 只认标题"（共X分）"，这段整段跳过 ⇒ 两端都不管，缺陷永久留在产物里。
// 本文件把两块的边界钉住（**不改数、不猜、不删正文**）：
//   1.6b-pre：逐题未标分时，按"标题单价 × 该行判分处数"补标分——**Σ 必须等于标题共Y分**才补；
//   1.6b    ：标题末括注两态（共X分／每X分，共X分）都读，按逐题总分合成真题写法。
//   ① 账对不平 → 整段不动；② 已逐题标分 → 不重复追加；③ 无带号行（真 0 段）→ 不动；④ 答案区镜像同一括注。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const run = (h) => auditExamPaper(h, { subject: '数学', stage: 'primary_mid', genType: 'exam' }).html;
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const heads = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);

// 3 行 × (2/3/2) 空，共 7 空；每空 2 分 ⇒ 4 / 6 / 4，共 14 分
const FILL = [
  '<h1>阶段测评</h1>',
  '<h3>三、填空（每空2分，共14分）</h3>',
  '<p>1. 6＋6＋6＋6表示____个6相加，是____。</p>',
  '<p>2. 3个5相加，用乘法算式表示是____，读作____，表示____。</p>',
  '<p>3. 一个因数是4，另一个因数是6，积是____，口诀是____。</p>',
].join('\n');

describe('标题单价错位：B 补逐题标分 + 合成真题标题', () => {
  it('真机形态（每空X分，共Y分 + 带号子题 + 未逐题标分）：账对平即纠正', () => {
    const out = run(FILL);
    const hs = heads(out);
    expect(hs[0], '标题按逐题总分合成（不再写标题单价）').toBe('三、填空（第1、3小题各4分，第2小题6分，共14分）');
    const ps = pTexts(out).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
    expect(ps.length, '题号不得增删').toBe(3);
    expect(ps[0], '第1题：2空×2分').toMatch(/（每空2分，共4分）$/);
    expect(ps[1], '第2题：3空×2分').toMatch(/（每空2分，共6分）$/);
    expect(ps[2], '第3题：2空×2分').toMatch(/（每空2分，共4分）$/);
    for (const t of ['6＋6＋6＋6', '3个5相加', '口诀']) expect(out, '正文原样').toContain(t);
  });

  it('幂等：再跑一次不再重复补标分、标题不再变', () => {
    const once = run(FILL);
    const twice = run(once);
    expect(twice).toBe(once);
    expect((twice.match(/（每空2分，共4分）/g) || []).length, '不得重复追加').toBe(2);
  });

  // 🔴 2026-10-23（属主定 A/B 分工·撤闸）：B 的职责是"把逐题分合成标题"，**Σ 即真值**；
  //   原标题总数只作核对、不参与合成。原实现有闸"Σ 必须＝原标题总数才补分"，导致
  //   "分组式合成永远不执行"（属主实测）。现：账差只留一条修复记录，补分与合照样发生。
  it('账对不平（单价×判分处数 ≠ 标题共Y分）：**照常逐题补分并按 Σ 合成**，差异只记一条', () => {
    const bad = FILL.replace('每空2分，共14分', '每空2分，共10分');
    const r = auditExamPaper(bad, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    const out = r.html;
    expect(heads(out)[0], '标题按逐题分（Σ）合成，而不是照抄原标题总数')
      .toBe('三、填空（第1、3小题各4分，第2小题6分，共14分）');
    const ps = pTexts(out).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
    expect(ps.length, '题号不得增删').toBe(3);
    expect(ps[0], '第1题：2空×2分').toMatch(/（每空2分，共4分）$/);
    expect(ps[2], '第3题：2空×2分').toMatch(/（每空2分，共4分）$/);
    const note = (r.issues || []).map((x) => x.message).join(' | ');
    expect(note, '须记录"原标题写共10分、按逐题分合计14分"').toMatch(/原标题写共 10 分/);
    expect(note).toMatch(/14 分/);
  });

  it('账对平时不产生"账差"记录（同一份数据，不误报差异）', () => {
    const r = auditExamPaper(FILL, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    const note = (r.issues || []).map((x) => x.message).join(' | ');
    expect(note).not.toContain('原标题写共');
  });

  it('已逐题标分（A 做对了、只是标题还写单价）：不重复追加，标题照样合成', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>三、填空（每空1分，共4分）</h3>',
      '<p>1. ____ ____（每空1分，共2分）</p>',
      '<p>2. ____ ____（每空1分，共2分）</p>',
    ].join('\n');
    const out = run(html);
    expect(heads(out)[0], '标题按逐题总分合成').toBe('三、填空（每题2分，共4分）');
    expect((out.match(/每空1分/g) || []).length, '逐题标分保留、不叠加').toBe(2);
  });

  it('单价单位是"题"：每行按一个单位计 ⇒ 逐题行末（X分）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>四、判断（每题2分，共6分）</h3>',
      '<p>1. 3×4与4×3的得数相同。</p>',
      '<p>2. 两个数相乘，交换位置得数不变。</p>',
      '<p>3. 0乘任何数都得0。</p>',
    ].join('\n');
    const out = run(html);
    expect(heads(out)[0], '一档 ⇒ 每题X分，与原标题同形').toBe('四、判断（每题2分，共6分）');
    const ps = pTexts(out).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
    expect(ps.length).toBe(3);
    for (const t of ps) expect(t, '单判分处写（X分）').toMatch(/（2分）$/);
  });

  // 🔴 2026-10-23（按属主定的基准）：编号题缺分 → B 按标题单价补分，再由 1.6b 按 Σ 合成标题；
  //   单价单位是"题/式/处"时每行算一道（空数 0 也成立），**不再因"Σ≠原标题总数"停手**。
  it('单价单位为"题"（竖式带号）：按单价补逐题分，标题按 Σ 合成（不是照抄原标题总数）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>二、列竖式计算（每题3分，共12分）</h3>',
      '<p>1. 24×3＝</p><p>2. 45×2＝</p>',
      '<div class="answer-section"><h2>参考答案</h2><p>1. 72</p></div>',
    ].join('\n');
    const r = auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    const ps = pTexts(r.html).filter((t) => /^\d{1,2}\s*[.、．]/.test(t) && /（3分）$/.test(t));
    expect(ps.length, '两道带号题各补一处标分（答案区不算）').toBe(2);
    for (const t of ps) expect(t, '每题按单价标分（单判分处写（X分））').toMatch(/（3分）$/);
    expect(heads(r.html)[0], '标题按逐题分（Σ=6）合成').toBe('二、列竖式计算（每题3分，共6分）');
    expect((r.silentDetails || []).some((d) => d.type === 'title-unit-misplaced'), '账差不再当缺陷报').toBe(false);
    const note = (r.issues || []).map((x) => x.message).join(' | ');
    expect(note, '账差只记一条修复记录').toMatch(/原标题写共 12 分/);
  });

  it('真 0 段（标题单价、其下无题号）：不动', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、直接写出得数（每式1分，共4分）</h3>',
      '<p>3×5＝____　2×6＝____</p>',
      '<p>4×4＝____　5×5＝____</p>',
    ].join('\n');
    const out = run(html);
    expect(heads(out)).toEqual(heads(html));
    expect(out).toContain('每式1分，共4分');
  });

  it('答案区同名大题标题镜像同一括注', () => {
    const html = [
      FILL,
      '<h2>参考答案与评分标准</h2>',
      '<h3>三、填空（每空2分，共14分）</h3>',
      '<p>1. 4，24</p>',
      '<p>2. 3×5＝15，三乘五等于十五，5个3</p>',
      '<p>3. 24，四六二十四</p>',
    ].join('\n');
    const out = run(html);
    const hs = heads(out).filter((t) => t.startsWith('三、填空'));
    expect(hs.length, '正文＋答案区各一处').toBe(2);
    expect(hs[0], '正文标题合成').toBe('三、填空（第1、3小题各4分，第2小题6分，共14分）');
    expect(hs[1], '答案区镜像同一括注').toBe(hs[0]);
  });
});
