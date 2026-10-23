// 🔴 2026-10-23 本文件**已反转**（文件名沿用历史）：
//   原锁的是"标题单价下推为逐题标分"（B 代 A 补分）。属主当日定：
//   **"我们不要程序侧补小题标分，小题标分必须是模型侧根据题的实际内容标出…这个得严格执行，不能有任何折扣"**
//   ⇒ 补标整块删除，本文件改为锁三件事：
//     ① 带号题缺分 ⇒ **只报不补**，正文/标题/分值一个字都不动；
//     ② 已逐题标分 ⇒ 1.6b 照常按 Σ 合成真题标题（合成仍归程序）、答案区镜像同一括注；
//     ③ 报点要**准**：答案区同名的行不得被算作"缺分的题"。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const audit = (h) => auditExamPaper(h, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
const run = (h) => audit(h).html;
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const heads = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);
const missWarn = (r) => (r.silentDetails || []).filter((x) => /与标题写的共/.test(x.message));

// 3 行 × (2/3/2) 空，共 7 空；每空 2 分 ⇒ 4 / 6 / 4，共 14 分
const FILL = [
  '<h1>阶段测评</h1>',
  '<h3>三、填空（每空2分，共14分）</h3>',
  '<p>1. 6＋6＋6＋6表示____个6相加，是____。</p>',
  '<p>2. 3个5相加，用乘法算式表示是____，读作____，表示____。</p>',
  '<p>3. 一个因数是4，另一个因数是6，积是____，口诀是____。</p>',
].join('\n');

// 同一份卷，A 已按"单价×处数"逐题标好（这才是合规形态）
const FILL_OK = [
  '<h1>阶段测评</h1>',
  '<h3>三、填空（每空2分，共14分）</h3>',
  '<p>1. 6＋6＋6＋6表示____个6相加，是____。（每空2分，共4分）</p>',
  '<p>2. 3个5相加，用乘法算式表示是____，读作____，表示____。（每空2分，共6分）</p>',
  '<p>3. 一个因数是4，另一个因数是6，积是____，口诀是____。（每空2分，共4分）</p>',
].join('\n');

describe('带号题缺分：只报不补，标题不合成', () => {
  it('真机形态（每空X分 + 带号子题 + 未逐题标分）：报 3 道，正文一字不动', () => {
    const r = audit(FILL);
    const out = r.html;
    expect(heads(out)[0], '标题不动（Σ 不完整）').toBe('三、填空（每空2分，共14分）');
    const ps = pTexts(out).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
    expect(ps.length, '题号不得增删').toBe(3);
    expect(ps.join('|'), '不得代补分值').not.toMatch(/（\d+分）|（每空/);
    expect(missWarn(r).length, '7 空×2分＝14＝共14分，均分自洽 ⇒ 不报').toBe(0);
    for (const t of ['6＋6＋6＋6', '3个5相加', '口诀']) expect(out, '正文原样').toContain(t);
  });

  it('幂等：再跑一次输出一致（不补分 ⇒ 不会越跑越多）', () => {
    const once = run(FILL);
    expect(run(once)).toBe(once);
  });

  it('账对不平（标题共10分、实际 7 空×2 分）：仍只报不补，标题照原样', () => {
    const bad = FILL.replace('每空2分，共14分', '每空2分，共10分');
    const r = audit(bad);
    expect(heads(r.html)[0], '不改数').toBe('三、填空（每空2分，共10分）');
    expect(pTexts(r.html).join('|'), '不补分').not.toMatch(/（每空2分，共4分）/);
    expect(missWarn(r)[0].message, '报出算出来的账').toContain('不符');
  });

  it('答案区同名的行不算"缺分的题"（报点只数正文，不误报）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>二、列竖式计算（每题3分，共12分）</h3>',
      '<p>1. 24×3＝</p><p>2. 45×2＝</p>',
      '<div class="answer-section"><h2>参考答案</h2><p>1. 72</p><p>2. 90</p></div>',
    ].join('\n');
    const r = audit(html);
    expect(pTexts(r.html).filter((t) => /（3分）$/.test(t)).length, '一道都不补').toBe(0);
    const w = missWarn(r);
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message, '只数正文那 2 道').toContain('2 道');
  });
});

describe('已逐题标分：合成仍归程序（Σ 为真值）', () => {
  it('标题写单价、小题各有分 ⇒ 标题按 Σ 合成多档，题内标注不动不叠加', () => {
    const out = run(FILL_OK);
    expect(heads(out)[0], '标题按逐题总分合成').toBe('三、填空（第1、3小题各4分，第2小题6分，共14分）');
    expect((out.match(/每空2分/g) || []).length, '逐题标分保留、不叠加').toBe(3);
  });

  it('各题同分 ⇒ 单档', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>四、判断（每题2分，共6分）</h3>',
      '<p>1. 3×4与4×3的得数相同。（2分）</p>',
      '<p>2. 两个数相乘，交换位置得数不变。（2分）</p>',
      '<p>3. 0乘任何数都得0。（2分）</p>',
    ].join('\n');
    expect(heads(run(html))[0], '一档 ⇒ 每题X分').toBe('四、判断（每题2分，共6分）');
  });

  it('答案区同名大题标题镜像同一括注', () => {
    const html = [
      FILL_OK,
      '<h2>参考答案与评分标准</h2>',
      '<h3>三、填空（每空2分，共14分）</h3>',
      '<p>1. 4，24</p>',
      '<p>2. 3×5＝15，三乘五等于十五，5个3</p>',
      '<p>3. 24，四六二十四</p>',
    ].join('\n');
    const hs = heads(run(html)).filter((t) => t.startsWith('三、填空'));
    expect(hs.length, '正文＋答案区各一处').toBe(2);
    expect(hs[0], '正文标题合成').toBe('三、填空（第1、3小题各4分，第2小题6分，共14分）');
    expect(hs[1], '答案区镜像同一括注').toBe(hs[0]);
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
});
