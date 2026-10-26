// 回归：**不该有题号／小题标题的题组，一个号都不许冒出来**（2026-10-19 属主令）
// ============================================================
// 属主原话："不是专门这两种哦，我想说的是，不该有小题号的，不会再出现了吧？小题号，实测了，不该有的还有。"
// 背景（真机整卷）：
//   `一、直接写出得数（每题1分，共14分）` 其下冒出 `1. 3×5＝…` `2. …` `3. …` `4. …`（按行编号）；
//   `二、列竖式计算（每题3分，共12分）` 其下冒出 `5. 用竖式计算下面各题。`（标题的复述句带号＝小标题）；
//   `三、填空（每空1分，共24分）` 其下 `6.–12.` 不带逐题标分（旧方案，A 未执行）。
// 本文件把三件事固定下来（**不限于口算/竖式**）：
//   ① A 侧判据：一组共用一条作答要求（并列同类作答项，哪怕并列多少项／分几行）⇒ 不编号、不另起题干行、不补号承载分值；
//                「编号与单价二者取一」——不许只有号没有分，也不许没有号却在题内标分；
//   ② B 侧行为：**任何**无题号的题组走 normalize＋audit 后，仍没有任何以数字开头的段落、不新增标题、内容原样；
//   ③ B 侧边界：**只在账能对平时纠正**——单价×各题判分处数＝标题共Y分，才把逐题标分补齐并合成；
//                对不平一律不动（不改数、不删号、不改标题），缺陷回到 A 收口；
//                同一份卷里"单价组"与"逐题标分组"并存时，前者不动（不以全卷口径误伤）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { normalizeBodyHtml } from '../../src/utils/contentCleaner.js';
import { getPromptTemplate, QUESTION_OBJECT_CALIBER } from '../../src/config/promptLibrary.js';

const run = (h, subject = '数学') => auditExamPaper(h, { subject, stage: 'primary_mid', genType: 'exam' }).html;
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const numbered = (h) => pTexts(h).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
const heads = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);

// ── 题组样本：每一种都是"一组共用一条作答要求"，形态/行数/项数各不相同（防只对口算/竖式过拟合） ──
const GROUPS = [
  {
    name: '口算（4 行 × 4 式，按行排）',
    subject: '数学',
    head: '<h3>一、直接写出得数（每式1分，共14分）</h3>',
    body: [
      '<p>3×5＝____　2×6＝____　4×4＝____　5×5＝____</p>',
      '<p>6×3＝____　1×5＝____　3×3＝____　2×4＝____</p>',
      '<p>5×2＝____　6×6＝____　4×3＝____　5×4＝____</p>',
      '<p>6×2＋6＝____　5×4－5＝____</p>',
    ],
    tokens: ['3×5', '5×5', '6×3', '1×5', '5×2', '6×6', '6×2＋6', '5×4－5'],
  },
  {
    name: '列竖式（3 行 × 2 式）',
    subject: '数学',
    head: '<h3>二、列竖式计算（每式3分，共12分）</h3>',
    body: ['<p>34＋25＝____　48－16＝____</p>', '<p>27＋35＝____　63－28＝____</p>', '<p>56＋29＝____　70－46＝____</p>'],
    tokens: ['34＋25', '48－16', '27＋35', '63－28', '56＋29', '70－46'],
  },
  {
    name: '单位换算（单项一行、行数多）',
    subject: '数学',
    head: '<h3>三、单位换算（每空1分，共8分）</h3>',
    body: ['<p>3米＝____厘米</p>', '<p>5元＝____角</p>', '<p>1时＝____分</p>', '<p>2千克＝____克</p>'],
    tokens: ['3米', '5元', '1时', '2千克'],
  },
  {
    name: '连线（左右两列并列）',
    subject: '语文',
    head: '<h3>四、连一连（每线2分，共8分）</h3>',
    body: ['<p>春天　　　　白雪</p>', '<p>夏天　　　　绿树</p>', '<p>秋天　　　　骄阳</p>', '<p>冬天　　　　红叶</p>'],
    tokens: ['春天', '夏天', '秋天', '冬天', '白雪', '红叶'],
  },
  {
    name: '看拼音写词语（拼音行 + 书写格）',
    subject: '语文',
    head: '<h3>五、看拼音写词语（每词2分，共8分）</h3>',
    body: ['<p>chūn tiān（　　）　　huā duǒ（　　）</p>', '<p>shān shuǐ（　　）　　péng you（　　）</p>'],
    tokens: ['chūn tiān', 'huā duǒ', 'shān shuǐ', 'péng you'],
  },
  {
    name: '英语单词抄写（并列词表）',
    subject: '英语',
    head: '<h3>六、抄写单词（每词1分，共6分）</h3>',
    body: ['<p>apple　　banana　　orange</p>', '<p>book　　pencil　　ruler</p>'],
    tokens: ['apple', 'banana', 'orange', 'book', 'pencil', 'ruler'],
  },
  {
    name: '词语认读（同一要求的并列词）',
    subject: '语文',
    head: '<h3>七、读一读（每组1分，共4分）</h3>',
    body: ['<p>小鸟　　天空　　白云</p>', '<p>小河　　鱼儿　　水草</p>'],
    tokens: ['小鸟', '天空', '白云', '小河', '鱼儿', '水草'],
  },
  {
    name: '涂色（图 + 并列色块说明）',
    subject: '数学',
    head: '<h3>八、按要求涂色（每处1分，共4分）</h3>',
    body: ['<p>把圆涂成红色＿＿＿＿</p>', '<p>把方涂成蓝色＿＿＿＿</p>', '<p>把三角涂成黄色＿＿＿＿</p>', '<p>把星涂成绿色＿＿＿＿</p>'],
    tokens: ['红色', '蓝色', '黄色', '绿色'],
  },
];

describe('不该有题号／小题标题的题组：一个号都不许冒出来（全形态回归）', () => {
  for (const g of GROUPS) {
    it(`${g.name}：normalize 后无数字开头段落`, () => {
      const html = ['<h1>阶段测评</h1>', g.head, ...g.body].join('\n');
      expect(numbered(normalizeBodyHtml(html)), `${g.name} 不得冒出"1. …"这类行`).toEqual([]);
    });

    it(`${g.name}：audit 后无数字开头段落、标题数不变、内容原样`, () => {
      const html = ['<h1>阶段测评</h1>', g.head, ...g.body].join('\n');
      const out = run(html, g.subject);
      expect(numbered(out), `${g.name} 不得冒出任何题号行`).toEqual([]);
      expect(heads(out), `${g.name} 不得新增小题标题`).toEqual(heads(html));
      for (const t of g.tokens) expect(out, `${g.name}：${t} 应原样保留`).toContain(t);
    });
  }

  // 🔴 2026-10-23（属主基准·撤第二把尺）：原先这里锁的是"并列的同类作答项／哪怕并列多少项／
  //   其下不再另起题号与题干行"——那三句随编号对象口径（第二套判据）一并删除。**结果不变、判据换源**：
  //   口算／竖式这类并列项没有"一组只做一个动作" ⇒ 一组只做一个动作不成立 ⇒ 不编号 ⇒ 不写小题号、
  //   其下不得出现任何题号。断言随之改锚（锁结果，不锁旧措辞）。
  it('A 侧判据（两学段）：同一题干内的并列项 ⇒ 单题干、不写小题号、不补号承载分值', () => {
    for (const stage of ['primary_low', 'primary_mid', 'middle']) {
      const t = getPromptTemplate({ grade: stage, subject: '数学', genType: 'exam' }).template;
      expect(t, `${stage}：结构判定＝数独立题干`).toContain('看其中一项有没有成句的文字');
      expect(t, `${stage}：同一题干内并列小项不另算`).toContain('题前加小号序号');
      expect(t, `${stage}：单题干 ⇒ 不加小号序号`).toContain('单作答题干大题不加小号序号');
      expect(t, `${stage}：单题干 ⇒ 分值只在该题干后`).toContain('大题标题也要写');
      // 🔴 2026-10-24（属主："不要人为干预模型的能力"）："不得为凑总分编题"已删，防回潮。
      expect(t, `${stage}："不得为凑总分编题"不得回潮`).not.toContain('不得为凑总分编题');
    }
    expect(QUESTION_OBJECT_CALIBER, '第二把尺（共用一条作答要求）不得回潮').not.toMatch(/共用一条作答要求/);
  });

  it('A 侧判据（两学段）：大题标题不得被写成带号的题干／其下不得另起说明行', () => {
    for (const stage of ['primary_low', 'middle']) {
      const t = getPromptTemplate({ grade: stage, subject: '数学', genType: 'exam' }).template;
      expect(t, `${stage}：不得把这条要求写成带题号的题干`).toContain('不得把这条要求写成带题号的题干');
      expect(t, `${stage}：其下不再另起说明行`).toContain('其下不再另起说明行');
    }
  });
});

describe('B 侧边界：只在账能对平时纠正（对不平就不猜、不删、不补）', () => {
  it('单价标题（每式X分，共Y分）+ 其下无题号 → 标题原样（B 不改写成"共X分"、不动内容）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、直接写出得数（每式1分，共14分）</h3>',
      '<p>3×5＝____　2×6＝____</p>',
      '<p>4×4＝____　5×5＝____</p>',
    ].join('\n');
    const out = run(html);
    expect(heads(out)).toEqual(heads(html));
    expect(out, '单价标题不得被程序改写').toContain('每式1分，共14分');
    expect(numbered(out), '不得补题号').toEqual([]);
  });

  // 🔴 2026-10-23（属主："我们不要程序侧补小题标分，小题标分必须是模型侧根据题的实际内容标出"）：
  //   原"按标题单价补分 → Σ 合成"已整段删除。现锁：缺分只报，题号不删、标题不改。
  it('旧形（单价标题 + 其下带号题 + 无逐题标分）：只报不补，题号不删、标题不动', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>三、填空（每空1分，共8分）</h3>',
      '<p>1. 6＋6＋6＋6表示____个6相加。</p>',
      '<p>2. 3个5相加，用乘法算式表示是____。</p>',
    ].join('\n');
    const r = auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    const out = r.html;
    expect(numbered(out).length, '题号不得被程序删（不删正文）').toBe(2);
    expect(numbered(out).join('|'), '不得代补分值').not.toMatch(/（\d+分）/);
    expect(heads(out)[0], 'Σ 不完整 ⇒ 标题不动').toBe('三、填空（每空1分，共8分）');
    const w = (r.silentDetails || []).filter((x) => /道带题号的题没标分/.test(x.message));
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message, '报 2 道').toContain('2 道');
  });

  it('同卷并存：单价组（A2）不动，逐题标分组（A1）才由 B 合成——不以全卷口径误伤', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、直接写出得数（每式1分，共4分）</h3>',
      '<p>3×5＝____　2×6＝____　4×4＝____　5×5＝____</p>',
      '<h3>二、填空（共8分）</h3>',
      '<p>1. 6＋6＋6＋6表示____个6相加。（每空1分，共4分）</p>',
      '<p>2. 3个5相加，用乘法算式表示是____。（每空1分，共4分）</p>',
    ].join('\n');
    const out = run(html);
    const hs = heads(out);
    expect(hs[0], '单价组（A2）标题不得被合成改动').toContain('每式1分，共4分');
    expect(hs[1], '逐题标分组（A1）应被 B 按题的总分合成').toMatch(/每题4分，共8分/);
    expect(numbered(out).length, 'A2 组不得冒出题号（B 不补号）').toBe(2);
    for (const t of ['3×5', '2×6', '4×4', '5×5', '6＋6＋6＋6', '3个5相加']) expect(out).toContain(t);
  });

  it('真实题（各自有独立作答要求）的题号：B 一律不删（防"一刀切去号"误伤）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>四、判断（共4分）</h3>',
      '<p>1. 3×4与4×3的得数相同。（2分）</p>',
      '<p>2. 两个数相乘，交换位置得数不变。（2分）</p>',
    ].join('\n');
    const out = run(html);
    expect(numbered(out).length, '应编号的题不得被去号').toBe(2);
    // A1＋B：逐题标分齐全 ⇒ B 合成为真题样式（这是 B 的正当职责，不是"多出小标题"）
    expect(heads(out)[0], 'A1 组标题由 B 合成单价').toMatch(/每题2分，共4分/);
  });
});
