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
  // 🔴 2026-10-23（属主："我们不要程序侧补小题标分"）：缺分只报、不代补；号与正文一个字都不动。
  it('带号行（即使是并列项）→ 号原样保留、缺分只报不补、标题不动', () => {
    // 🔴 2026-10-23（属主定基准）：B 不判"该不该编号"（那属 A），只对**编号的题**做合成。
    //   原实现另有一条"并列区不该有号"的告警，按形态枚举反推 A 判错类别，既不完整又与分工相抵，已删。
    const bad = [
      '<h1>阶段测评</h1>',
      '<h3>一、直接写出得数（每题1分，共14分）</h3>',
      '<p>1. 3×5＝____　2×6＝____</p>',
      '<p>2. 4×3＝____　5×5＝____</p>',
      '<p>3. 6×2＋6＝____　5×4－5＝____</p>',
    ].join('\n');
    const r = run(bad);
    expect(numbered(r.html).length, '号不得被删').toBe(3);
    expect(numbered(r.html)[0]).toMatch(/^1[.、．]/);
    expect(numbered(r.html)[2]).toMatch(/^3[.、．]/);
    expect(numbered(r.html).join('|'), '不得代补分值').not.toMatch(/（\d+分）|（每.*共.*分）/);
    const w = (r.silentDetails || []).filter((x) => /道带题号的题没标分/.test(x.message));
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message, '报 3 道').toContain('3 道');
    expect(heads(r.html)[0], 'Σ 不完整 ⇒ 标题不动').toBe('一、直接写出得数（每题1分，共14分）');
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

// ── ④ 2026-10-22 真机三项：双括注 / 答案区各种样式 / 非均分许可 ──
describe('④ 双括注折叠、答案区多形态镜像、非均分许可', () => {
  it('标题紧邻重复的分值括注 → 折叠成一个（真机：判断大题双括注）', () => {
    const h = [
      '<h1>阶段测评</h1>',
      '<h3>四、判断（每题2分，共10分）（每题2分，共10分）</h3>',
      '<p>1. 3×4与4×3的得数相同。（　　　）（2分）</p>',
      '<p>2. 两个数相乘，交换位置得数不变。（　　　）（2分）</p>',
    ].join('\n');
    const r = run(h);
    const t4 = heads(r.html).find((t) => t.startsWith('四、'));
    expect(t4, '双括注须折叠成一个（按逐题分合成）').toBe('四、判断（每题2分，共4分）');
    expect((t4.match(/分）/g) || []).length, '只留一个分值括注').toBe(1);
  });

  it('答案区标题无分值括注、且用“.”分隔（各种样式）→ 仍镜像正文合成结果', () => {
    const h = [
      '<h1>阶段测评</h1>',
      '<h3>三、填空（共4分）</h3>',
      '<p>1. 4个3相加写成乘法算式是____。（2分）</p>',
      '<p>2. 5×3＝____，口诀是____。（2分）</p>',
      '<h2>参考答案与评分标准</h2>',
      '<p><strong>三. 填空</strong></p>',
      '<p>1.（2分）3×4</p>',
      '<p>2.（2分）15，三五十五</p>',
    ].join('\n');
    const r = run(h);
    const body3 = heads(r.html).find((t) => t.startsWith('三、'));
    expect(body3, '正文合成').toBe('三、填空（每题2分，共4分）');
    expect(r.html, '答案区以“三.”分隔、无分值括注，仍须镜像').toContain('三. 填空（每题2分，共4分）');
  });

  it('提示词口径：形态唯一（全式）、Y 由单价×个数、单价来自档', () => {
    for (const stage of ['primary_low', 'primary_mid']) {
      const t = getPromptTemplate({ grade: stage, subject: '数学', genType: 'exam' }).template;
      expect(t, stage + '：形态唯一（每〈单位〉X分，共Y分）').toContain('（每〈单位〉X分，共Y分）');
      expect(t, stage + '：Y＝X×N').toContain('Y＝X×N');
      expect(t, stage + '：单价不枚举档值').not.toContain('{scoreUnitLadder}');
      expect(t, stage + '：不得一刀切（全卷统一写法）').not.toContain('同一份卷内写法一致');
      expect(t, stage + '：不得以裸分替代全式').not.toContain('直接写该题总分');
    }
  });
});

describe('③ 跨学段×学科混合扫描（基准：先数作答题干 → 再定标分）', () => {
  it('每面都要有：结构判定一处、两支后果齐备、旧语义判据零出现', () => {
    const bad = [];
    for (const stage of ['primary_low', 'primary_mid', 'middle', 'high']) {
      for (const subject of ['语文', '数学', '英语']) {
        const t = getPromptTemplate({ grade: stage, subject, genType: 'exam' }).template;
        const tag = stage + '|' + subject;
        // 块切片必须**锚行首**（块内行文会行内引用【分值标注】，按子串取首个命中会切到引用处）
        const scoreBlock = (t.match(/^【分值标注】[\s\S]*?(?=\n\n【)/m) || [''])[0];
        if (!t.includes('遮住大题标题、只看其中一项')) bad.push(tag + '：缺"作答题干口径"');
        if (!t.includes('（单题干）')) bad.push(tag + '：缺"单题干"');
        if (!t.includes('（多题干）')) bad.push(tag + '：缺"多题干"');
        if (!t.includes('整栏没有小号序号的，这一栏的分只写在标题后一处')) bad.push(tag + '：缺"无号分在标题后"');
        if (!t.includes('分跟着号走**：**分写在每题题干后')) bad.push(tag + '：缺"有号每题标分"');
        if (!t.includes('先分配、后落实')) bad.push(tag + '：缺"先分配、后落实"');
        if (!t.includes('标题写这一栏的分')) bad.push(tag + '：缺"标题也写分"');
        if (t.includes('标题与题内两处都要有')) bad.push(tag + '：旧"两处都要有"回潮');
        if (t.includes('大题标题写"（共Y分）"')) bad.push(tag + '：旧"（共Y分）中间态"回潮');
        if (!t.includes('Y＝X×N')) bad.push(tag + '：缺"Y＝X×N"');
        if (!t.includes('该大题总分＝其下各题 Y 之和')) bad.push(tag + '：缺"大题账目"');
        if (!t.includes('各大题分之和＝给定满分')) bad.push(tag + '：缺"试卷账目"');
        // 旧语义判据不得回潮
        if (t.includes('号是点名用的')) bad.push(tag + '：旧"号是点名用的"回潮');
        if (t.includes('带小题号')) bad.push(tag + '：旧"带小题号"回潮');
        if (t.includes('一组只做一个动作')) bad.push(tag + '：旧"一组只做一个动作"回潮');
        if (t.includes('整道题设问的最后一句之后')) bad.push(tag + '：旧"最后一句之后"回潮');
        if (/成题区|直答区/.test(t)) bad.push(tag + '：旧两区名回潮（第二把尺）');
        if (/口算|竖式|脱式|判断题|选择题/.test(scoreBlock)) {
          bad.push(tag + '：分值标注块出现题型名（枚举/诱导）');
        }
        // 顺序：结构判定先于两支后果
        const i1 = t.indexOf('遮住大题标题、只看其中一项');
        const i2 = t.indexOf('（单题干）');
        if (!(i1 > -1 && i2 > i1)) bad.push(tag + '：结构判定须先于两支后果（不成序）');
      }
    }
    expect(bad, '486 面混合扫描').toEqual([]);
  });
});
