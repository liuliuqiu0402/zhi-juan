// ============================================================
// 混合整卷：类别（题组／并列区）× 编号 × 分值（2026-10-21 属主定稿方向）
// ------------------------------------------------------------
// 属主口径：
//   · 每道大题**先定一个类别**（题组／并列区），编号与分值都照它执行；行级不再判。
//   · **行只是排版、不承载语义**：并列区一行可并排多个同类项、也可分多行，都不因此变成多道题。
//   · 题号归**模型侧**判；**程序侧不删号**（全卷连续时删号会断号），只做取证提示。
// 本文件据此分三段：
//   ① 一张卷六形态同时成立（成品形态：并列区无号、题组合成、答案区镜像、总账闭合）；
//   ② 违约形态（照抄真机：并列区带号 / 标题复述带号）→ **必须有 warn，且号一个都不许被删**；
//   ③ 486 面混合扫描：类别判据在位、行不承载语义在位、“不写任何题号”在位、旧“两支”不得回潮。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const run = (h) => auditExamPaper(h, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
const bodyOf = (h) => h.split(/<h2[^>]*>\s*参考答案/)[0];
const heads = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1].trim());
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim())
  .filter(Boolean);
const numbered = (h) => pTexts(h).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
const hasSpurious = (r) => (r.issues || []).some((x) => x.type === 'spurious-row-number');

// ── ① 合规整卷：六种形态同卷 ──────────────────────────────
const GOOD = [
  '<h1>阶段测评</h1>',
  // 并列区：三行，每行并排多个算式，无题号
  '<h3>一、直接写出得数（每式1分，共14分）</h3>',
  '<p>3×5＝____　2×6＝____　4×3＝____　5×5＝____</p>',
  '<p>6×2＝____　1×5＝____　5×2＝____　6×6＝____</p>',
  '<p>6×2＋6＝____　5×4－5＝____</p>',
  // 并列区：竖式，标题单价
  '<h3>二、列竖式计算（每题3分，共12分）</h3>',
  '<p>34＋25＝____　48－16＝____</p>',
  '<p>27＋35＝____　63－28＝____</p>',
  // 题组：填空 6 题，逐题标分，合计 24
  '<h3>三、填一填（共24分）</h3>',
  '<p>1. 4个3相加，写成加法算式是____，写成乘法算式是____，读作____，算得____。（每空1分，共4分）</p>',
  '<p>2. 5×3＝____，用的乘法口诀是____；6×4＝____，用的乘法口诀是____。（每空1分，共4分）</p>',
  '<p>3. 在○里填“＞”“＜”或“＝”。（每空1分，共4分）</p>',
  '<p>4. 2×____＝6，____×5＝30，5×____＝20，____×4＝24。（每空1分，共4分）</p>',
  '<p>5. 一支铅笔2元，买5支一共要____元。（每空1分，共4分）</p>',
  '<p>6. 得数是12的乘法算式有____和____，积都是____，口诀是____。（每空1分，共4分）</p>',
  // 题组：判断/选择
  '<h3>四、判断（共6分）</h3>',
  '<p>1. 3×4与4×3的得数相同。（　　　）（2分）</p>',
  '<p>2. 两个数相乘，交换位置得数不变。（　　　）（2分）</p>',
  '<p>3. 0乘任何数都得0。（　　　）（2分）</p>',
  '<h3>五、选择（共8分）</h3>',
  '<p>4. 下列算式中，得数最大的是（　　　）。（2分）</p>',
  '<p>5. 5×4表示（　　　）。（2分）</p>',
  '<p>6. 与3×6得数相同的算式是（　　　）。（2分）</p>',
  '<p>7. 一个因数是7，另一个是2，积是（　　　）。（2分）</p>',
  // 答案区
  '<h2>参考答案与评分标准</h2>',
  '<h3>一、直接写出得数（每式1分，共14分）</h3>',
  '<p>15　12　18　36　12　5　10　24　18　15</p>',
  '<h3>三、填一填（共24分）</h3>',
  '<p>1.（4分）3＋3＋3＋3；3×4；三乘四；12</p>',
  '<p>2.（4分）15，三五十五；24，四六二十四</p>',
  '<p>3.（4分）＝　＝　＞　＞</p>',
  '<p>4.（4分）3　6　4　6</p>',
  '<p>5.（4分）10</p>',
  '<p>6.（4分）3×4、4×3　12　三四十二</p>',
  '<h3>四、判断（共6分）</h3>',
  '<p>1.（2分）√</p>',
  '<p>2.（2分）√</p>',
  '<p>3.（2分）√</p>',
].join('\n');

describe('① 合规整卷：并列区无号、题组合成、答案区镜像、总账闭合', () => {
  const r = run(GOOD);
  const hs = heads(r.html);

  it('并列区：一/二 一个号都没有、标题保持单价、内容原样', () => {
    const body = bodyOf(r.html);
    expect(numbered(body).length, '正文带号题＝填空6＋判断3＋选择4＝13').toBe(13);
    for (const t of ['3×5', '6×2＋6', '34＋25', '63－28']) {
      const line = pTexts(body).find((x) => x.includes(t));
      expect(line, `${t} 所在行`).toBeTruthy();
      expect(/^\d{1,2}\s*[.、．]/.test(line), `${t} 行不得带号`).toBe(false);
    }
    expect(hs.find((t) => t.startsWith('一、'))).toBe('一、直接写出得数（每式1分，共14分）');
    expect(hs.find((t) => t.startsWith('二、'))).toBe('二、列竖式计算（每题3分，共12分）');
  });

  it('题组：填空合成分组式、逐题标分一条不丢；判断/选择合成同档式', () => {
    expect(hs.find((t) => t.startsWith('三、'))).toBe('三、填一填（每题4分，共24分）');
    const items = pTexts(bodyOf(r.html)).filter((t) => /^\d{1,2}\s*[.、．]/.test(t) && /（每空1分，共4分）$/.test(t));
    expect(items.length, '6 道题逐题标分全在').toBe(6);
    expect(hs.find((t) => t.startsWith('四、'))).toBe('四、判断（每题2分，共6分）');
    expect(hs.find((t) => t.startsWith('五、'))).toBe('五、选择（每题2分，共8分）');
  });

  it('答案区镜像同一括注；合规卷不得报“多余题号”', () => {
    expect(hs.filter((t) => t.startsWith('三、')).length).toBe(2);
    const both3 = hs.filter((t) => t.startsWith('三、'));
    expect(both3[1], '答案区镜像').toBe(both3[0]);
    expect(hasSpurious(r), '合规卷不得误报').toBe(false);
  });

  it('总账：14+12+24+6+8＝64，与各标题所写一致', () => {
    const totals = hs.slice(0, 5).map((t) => Number((t.match(/共\s*(\d+)\s*分/) || [])[1]));
    expect(totals).toEqual([14, 12, 24, 6, 8]);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(64);
  });
});

// ── ② 违约形态：必须报出来，且号一个都不许被删 ────────────
describe('② 违约形态：报出来、但程序不动正文', () => {
  it('并列区却带号（真机原形）→ warn；号原样保留（不删，删了全卷连续会断）', () => {
    const bad = [
      '<h1>阶段测评</h1>',
      '<h3>一、直接写出得数（每题1分，共14分）</h3>',
      '<p>1. 3×5＝____　2×6＝____</p>',
      '<p>2. 4×3＝____　5×5＝____</p>',
      '<p>3. 6×2＋6＝____　5×4－5＝____</p>',
    ].join('\n');
    const r = run(bad);
    expect(hasSpurious(r), '须报“并列区不该有小题号”').toBe(true);
    expect(numbered(r.html).length, '号不得被删').toBe(3);
    expect(numbered(r.html)[0]).toMatch(/^1[.、．]/);
    expect(numbered(r.html)[2]).toMatch(/^3[.、．]/);
  });

  it('标题复述被写成带号题（真机原形）→ warn；号与原文都保留', () => {
    const bad = [
      '<h1>阶段测评</h1>',
      '<h3>二、列竖式计算（共12分）</h3>',
      '<p>4. 用竖式计算下面各题。（每题3分，共12分）</p>',
      '<p>23＋45＝____　36＋27＝____</p>',
    ].join('\n');
    const r = run(bad);
    expect(hasSpurious(r), '须报“标题复述占号”').toBe(true);
    expect(numbered(r.html).length, '号不得被删').toBe(1);
    expect(r.html, '复述原文保留').toContain('用竖式计算下面各题');
  });

  it('题组的正常题号（判断/选择/填空）→ 不得报', () => {
    const ok = [
      '<h1>阶段测评</h1>',
      '<h3>四、判断（共6分）</h3>',
      '<p>1. 3×4与4×3的得数相同。（　　　）（2分）</p>',
      '<p>2. 两个数相乘，交换位置得数不变。（　　　）（2分）</p>',
    ].join('\n');
    const r = run(ok);
    expect(hasSpurious(r), '正常题号不得误报').toBe(false);
    expect(numbered(r.html).length).toBe(2);
  });
});

// ── ③ 486 面混合扫描：类别判据在位、行不承载语义、旧写法不得回潮 ──
describe('③ 跨学段×学科混合扫描（类别口径）', () => {
  it('每面都要有：类别只判一次、行只是排版、并列区不写题号、无号也能标分', () => {
    const bad = [];
    for (const stage of ['primary_low', 'primary_mid', 'middle', 'high']) {
      for (const subject of ['语文', '数学', '英语']) {
        const t = getPromptTemplate({ grade: stage, subject, genType: 'exam' }).template;
        const tag = `${stage}|${subject}`;
        if (!t.includes('每道大题先定一个类别')) bad.push(`${tag}：缺“大题级类别”`);
        if (!t.includes('行只是排版，不承载语义')) bad.push(`${tag}：缺“行不承载语义”`);
        if (!t.includes('都能因此变成多道题') && !t.includes('都不因此变成多道题')) bad.push(`${tag}：缺“并行不成题”`);
        if (!t.includes('并列区：**不写任何题号**')) bad.push(`${tag}：缺“并列区不写题号”`);
        if (!t.includes('没有题号的行也照样能标分')) bad.push(`${tag}：缺“无号也能标分”`);
        // 2026-10-22 真机：填空被判成并列区（单价标题+仍带号）⇒ 并列区定义里曾含“待填位”，把载体当成了类别依据。
        //   载体形态（空位／括号）不得参与类别判定；成句的填空必须是成题区。
        if (!t.includes('载体形态不参与判定')) bad.push(`${tag}：缺“载体不参与类别判定”`);
        if (!t.includes('成句的填空')) bad.push(`${tag}：缺“填空也属成题区”`);
        if (/并列区\*\*＝其下没有这样的行（[^）]*待填位/.test(t)) bad.push(`${tag}：并列区定义又含“待填位”（载体进了类别判据）`);
        if (t.includes('两支的判法')) bad.push(`${tag}：旧“两支”写法回潮`);
        const i1 = t.indexOf('第①步');
        const i2 = t.indexOf('第②步');
        const i3 = t.indexOf('第③步');
        if (!(i1 > -1 && i2 > i1 && i3 > i2)) bad.push(`${tag}：三步不成序`);
        if (!t.includes('大题下面有子题') || !t.includes('大题下面没有子题')) bad.push(`${tag}：两态未写`);
      }
    }
    expect(bad, '486 面混合扫描').toEqual([]);
  });
});
