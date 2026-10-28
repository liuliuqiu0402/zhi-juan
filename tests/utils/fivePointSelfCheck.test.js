// 属主六问自检（2026-10-23）：
//   ① 编号/不编号能否精准区分执行；② 标分带不带单位能否精准区分；③ 能否逐题标；
//   ④ 合成能否精准区分单档/多档；⑤ 取分口径是否清晰可执行；⑥ 是否按小题分合成、可替换原标题。
// 每条都同时检验**判据在位**（实发文本）与**行为成立**（真跑校验器），避免"文本写了但程序不照做"。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, ANSWER_STEM_CALIBER } from '../../src/config/promptLibrary.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const tpl = () => getPromptTemplate({ grade: 'primary_mid', subject: '数学', genType: 'exam' }).template;
const run = (html) => auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const numbered = (h) => pTexts(h).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
const head = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1])[0] || '';
const page = (title, rows) => ['<h1>单元测评</h1>', `<h3>${title}</h3>`, ...rows].join('\n');

describe('① 编号/不编号：结构事实判定 + 两支各自的动作', () => {
  // 🔴 2026-10-26（属主定稿·**换结构事实**）：原判据是语义判定（"号是点名用的／各项有没有只属于它自己的
  //   题干话／一组只做一个动作"）——模型对同一行可给出相反解释（真机实证：整卷不标分）。现只数一件事：
  //   这一大题下有几个独立成 `<p class="question">` 的题干。本用例锁"结构判定在位 + 两支各自动作写死"。
  it('判据：数作答题干分单/多题干，两支各写后果', () => {
    expect(ANSWER_STEM_CALIBER, '结构判定').toContain('遮住大题标题、只看其中一项');
    expect(ANSWER_STEM_CALIBER, '题前加小号序号').toContain('题前加小号序号');
    expect(ANSWER_STEM_CALIBER, '二分').toContain('（单题干）');
    expect(ANSWER_STEM_CALIBER, '二分').toContain('（多题干）');
    const t = tpl();
    expect(t, '判据就地内联（写分值处能读到）').toContain(ANSWER_STEM_CALIBER);
    // 块切片锚行首：【卷面结构】里行内引用"按【分值标注】判"不算块起点。
    const scoreBlock = (t.match(/^【分值标注】([\s\S]*?)(?=\n\n【)/m) || [, ''])[1];
    // 2026-10-28（属主 A/B 基准）：判据各自成条、一处一分。
    expect(scoreBlock, '单题干：分写在标题后').toContain('单题干（整栏合一）**：**分写在标题后**');
    expect(scoreBlock, '多题干：分写在每题题干后').toContain('多题干（逐题独立）**：**分写在每题题干后**');
    expect(scoreBlock, '先分配、后落实').toContain('先分配、后落实');
    expect(scoreBlock, '大题标题也写它分到的那一份').toContain('大题标题同样写它分到的那一份');
    expect(scoreBlock, '旧双记账不得回潮').not.toContain('标题与题内两处都要有');
    expect(scoreBlock, '（共Y分）中间态不得回潮').not.toContain('大题标题写"（共Y分）"');
    expect(scoreBlock, '位置：材料与作答载体之后').toContain('全部材料与作答载体之后');
    expect(scoreBlock, '单价不枚举档值').not.toContain('{scoreUnitLadder}');
    // 🔴 2026-10-24（属主："不要提均分/不同分，模型会选择一个最简单的方式均分来标"）：
    //   分值块里不得出现任何"均分/同分"字样——一出现就会被读成"把各题拉平"的许可。
    expect(scoreBlock, '分值块不得出现均分/同分口径').not.toMatch(/均分|同分|不同分/);
    // 旧语义判据整类清除（不得回潮）
    expect(t, '旧"号是点名用的"不得回潮').not.toContain('号是点名用的');
    expect(t, '旧"带小题号/不带小题号"不得回潮').not.toContain('带小题号');
    expect(t, '旧"最后一行末尾"不得回潮').not.toContain('最后一行末尾');
  });

  // 🔴 2026-10-23（属主："我们不要程序侧补小题标分…这个得严格执行，不能有任何折扣"）：
  //   缺分从"程序补"改为"只报"——报点必须点到实数，正文一个字都不动。
  it('行为：判断题带号却全无分 ⇒ 报 3 道，不补、标题不合成', () => {
    const html = page('三、判断对错（每题2分，共6分）', [
      '<p class="question">1. 0 既不是正数也不是负数。（　）</p>',
      '<p class="question">2. 分数的分子分母同时乘一个数，分数大小不变。（　）</p>',
      '<p class="question">3. 假分数一定大于 1。（　）</p>',
    ]);
    const r = run(html);
    const rows = numbered(r.html);
    expect(rows.length, '题号不得增删').toBe(3);
    expect(rows.filter((t) => /（\d+分）$/.test(t)), '一行都不许补分').toEqual([]);
    const w = (r.silentDetails || []).filter((x) => /道带题号的题没标分/.test(x.message));
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message).toContain('3 道');
    expect(head(r.html), 'Σ 不完整 ⇒ 标题不动').toBe('三、判断对错（每题2分，共6分）');
  });

  it('行为：并列算式（无成句）不编号、不补分、标题不动', () => {
    const html = page('一、直接写得数（每题1分，共4分）', [
      '<p>3×5＝____　2×6＝____</p>',
      '<p>4×3＝____　5×5＝____</p>',
    ]);
    const r = run(html);
    expect(rows0(r.html), '不得冒出新题号').toBe(0);
    expect(pTexts(r.html).join(''), '不得给无编号的行补分').not.toMatch(/（\d+分）/);
    expect(head(r.html), '标题保持原样（单价承载）').toBe('一、直接写得数（每题1分，共4分）');
  });

  // 🔴 2026-10-23（属主改判据）：模型不认"其余→不编号"（"其余的也是题"，就还是会编号）。
  //   程序只查可核事实：有号 ⇒ 每题有分；无号 ⇒ 分值只在标题、题内不得标分。
  it('行为：写了号、也逐题标了分 ⇒ 不报（这是合法的一组，标题由程序按 Σ 合成）', () => {
    const r = run(page('四、填空（每空1分，共4分）', [
      '<p>1. 5＋____＝9。（1分）</p>',
      '<p>2. 8 里面有____个 2。（1分）</p>',
    ]));
    expect(rows0(r.html), '号保留').toBe(2);
    expect((r.silentDetails || []).filter((x) => /道带题号的题没标分/.test(x.message)).length, '不该挑刺').toBe(0);
    expect(head(r.html), '标题按 Σ 合成').toContain('共2分');
  });

  it('行为：没写号、题内却标了分 ⇒ 报"分值只由标题承载"（只报不改）', () => {
    const r = run(page('五、填一填（每空1分，共4分）', [
      '<p>4个3相加是____，读作____。（2分）</p>',
      '<p>5个5相加是____，读作____。（2分）</p>',
    ]));
    const warn = (r.silentDetails || []).filter((x) => /没有写小题号/.test(x.message));
    expect(warn.length, '必须有报点').toBe(1);
    expect(rows0(r.html), '程序不加号').toBe(0);
  });
});

// 🔴 2026-10-27（判法焊死·改锚）：原锚是"数独立成 <p class="question"> 的段落"——那版当日即被证伪
//   （包几个 question 由模型自己决定＝自证，§九.90）。现锚定**四个可判定要件**：
//   ①遮住标题（标题里的字不算）②判的是"有没有一句成句的表述"③外文完整句同样算（消除非汉语栏误判为单题干）
//   ④一栏只取一种形态／一栏一项按整栏合一（消混排与单题的摇摆）。
describe('①-b 凭什么这么分：只看项内有没有成句表述，不按题型名、不留兜底', () => {
  it('判据给的是可判定的形态，不是题型名', () => {
    expect(ANSWER_STEM_CALIBER, '遮住标题、只看其中一项').toContain('遮住大题标题、只看其中一项');
    expect(ANSWER_STEM_CALIBER, '判的是有没有成句的表述').toContain('有没有一句成句的表述');
    expect(ANSWER_STEM_CALIBER, '外文完整句同样算').toContain('外文完整句算');
    expect(ANSWER_STEM_CALIBER, '一栏只取一种形态（消混排）').toContain('一栏只取一种形态');
    expect(ANSWER_STEM_CALIBER, '一栏一项按整栏合一（消单题歧义）').toContain('一栏只有一项时按整栏合一');
    expect(ANSWER_STEM_CALIBER, '不按题型名枚举').not.toMatch(/口算|竖式|脱式|判断|选择|填空/);
    expect(ANSWER_STEM_CALIBER, '不留"其余"兜底').not.toContain('其余');
    expect(ANSWER_STEM_CALIBER, '旧两区名不得回潮').not.toMatch(/成题区|直答区/);
  });

  it('行为：纯算式连排、标题给单价 ⇒ 一个号都不加、一分不加、不挑刺', () => {
    const r = run(page('一、直接写出得数（每式1分，共14分）', [
      '<p>5×3＝____　6×2＝____　4×4＝____　3×6＝____</p>',
      '<p>2×5＝____　1×6＝____　4×3＝____　6×5＝____</p>',
    ]));
    expect(rows0(r.html), '不得自己补号').toBe(0);
    expect(pTexts(r.html).join(''), '题内不得出现逐题分').not.toMatch(/（\d+分）/);
    expect(head(r.html), '标题不动（单价承载）').toBe('一、直接写出得数（每式1分，共14分）');
    expect((r.silentDetails || []).filter((x) => x.level === 'warn').length, '不该挑刺').toBe(0);
  });

  it('行为：7 道题连写在一段、段末给整段分 ⇒ 报"一题一段"（不改结构）', () => {
    const r = run(page('一、直接写出得数（每题7分，共14分）', [
      '<p>1. 5×3＝____　2. 6×2＝____　3. 4×4＝____　4. 3×6＝____　（每题1分，共7分）</p>',
    ]));
    const warn = (r.silentDetails || []).filter((x) => /连写在同一段/.test(x.message));
    expect(warn.length, '必须报').toBe(1);
    expect(r.html, '程序不改结构（题号仍在）').toContain('1. 5×3');
  });
});

describe('② 标分：形态唯一（全式），Y 由单价×个数', () => {
  it('判据：形态只有一种，钱从单价×个数来', () => {
    const t = tpl();
    expect(t).toContain('（每〈单位〉X分，共Y分）');
    expect(t, 'Y 须与该题干实际作答对象个数相符').toContain('Y＝X×N');
    expect(t, '禁止先定总分倒推单价').toContain('不得先定总分再倒推单价');
    expect(t, '整片书写区按 1 处计').toContain('整片书写区按 1 处计');
    expect(t, '旧"一处裸分/多处全式"二选一不得回潮').not.toContain('一处判分写裸分');
  });

  // 形态判据不变；但写法归 A——程序只校验"写的对不对、缺了报不报"，不再代写。
  it('行为：A 已按判据写（一处裸分／多处全式）⇒ 原样保留、按 Σ 合成', () => {
    const html = page('三、填空（每空1分，共4分）', [
      '<p>1. 5＋____＝9。（1分）</p>',
      '<p>2. 8 里面有____个 2，____个 4，共____个 1。（每空1分，共3分）</p>',
    ]);
    const rows = numbered(run(html).html);
    expect(rows[0], '一处判分 ⇒ 裸分').toMatch(/（1分）$/);
    expect(rows[1], '多处判分 ⇒ 全式带单位').toMatch(/（每空1分，共3分）$/);
  });

  it('行为：A 没写 ⇒ 只报不写（程序不代标）', () => {
    const html = page('三、填空（每空1分，共4分）', [
      '<p>1. 5＋____＝9。</p>',
      '<p>2. 8 里面有____个 2，____个 4，共____个 1。</p>',
    ]);
    const r = run(html);
    expect(numbered(r.html).join('|'), '不得代标').not.toMatch(/（\d+分）|（每空/);
    expect((r.silentDetails || []).filter((x) => /道带题号的题没标分/.test(x.message))[0].message,
      '报点报 2 道').toContain('2 道');
  });
});

// 🔴 2026-10-23（属主："有一题多载体的，出现了三空2分的情形，并没有标单价"——"这里一题多载体的，我说的是小题"）：
//   病根＝**把"一道题"记成一处分**（处数没数）⇒ 三空题与一空题同分、单价从题内消失；
//   连带"每题均分"也不是巧合：单价一落到"题"上，每题的处数就恒等于 1。处置＝处数逐个数 + 禁均摊。
describe('②-b 个数要数：Y 须与该题干实际作答对象个数相符', () => {
  it('判据：个数逐个数，不设人为禁令', () => {
    const t = tpl();
    expect(t, 'Y 与个数相符').toContain('Y＝X×N');
    expect(t, '个数按题干内真实作答对象算').toContain('真实作答对象个数');
    // 🔴 2026-10-24（属主："不要人为干预模型的能力"）：两句禁令已删（详见 titleNumberScoreMatrix 同条注释）。
    expect(t, '"不得整组一律"不得回潮').not.toContain('不得整组一律');
    // 🔴 2026-10-24（属主："单价不一定要取整数分吧？也可以是 0.5 分…不要人为指定单价一样"）：
    //   单价按档选，不设整数限制、不强制全大题一个价（程序按**题**合成，不按单价合成）。
    expect(t, '不得强制同一大题一个价').not.toContain('同一大题一个价');
    expect(t, '不得强制整数分').not.toContain('取整数分');
    // （标题写法）2026-10-28（A/B 基准）：标题不再由模型写合计；多题干落点在每题题干后。
    expect(t, '多题干落点在题干后').toContain('分写在每题题干后');
    expect(t, '旧"两种情况相同"不得回潮').not.toContain('两种情况相同');
  });

  it('行为：三空只写（2分）⇒ 报"处数没数"（只报不改）', () => {
    const r = run(page('三、填空（每题2分，共4分）', [
      '<p>1. ____，____，____。（2分）</p>',
      '<p>2. ____。（2分）</p>',
    ]));
    const warn = (r.silentDetails || []).filter((x) => /处数没数/.test(x.message));
    expect(warn.length, '必须报').toBe(1);
  });

  it('行为：三空写全式（每空2分，共6分）⇒ 不报', () => {
    const r = run(page('三、填空（每空2分，共8分）', [
      '<p>1. ____，____，____。（每空2分，共6分）</p>',
      '<p>2. ____。（2分）</p>',
    ]));
    expect((r.silentDetails || []).filter((x) => /处数没数/.test(x.message)).length, '不该挑刺').toBe(0);
  });

  // 🔴 2026-10-24（属主真卷："多处判分，没有按这个写"）：多行题的空位散在题干行/选项行、
  //   分值落在末行——旧检测只数**该行内**的作答位，数不足 2 个就漏检。现按整题数。
  it('行为：多行题（空位跨行、分落在末行）只写（2分）⇒ 也报"处数没数"', () => {
    const r = run(page('三、填空（每题2分，共4分）', [
      '<p>1. 读句子，填一填。</p>',
      '<p>天空中的云____，地上的草____。</p>',
      '<p>水里的鱼____。（2分）</p>',
      '<p>2. ____。（2分）</p>',
    ]));
    const warn = (r.silentDetails || []).filter((x) => /处数没数/.test(x.message));
    expect(warn.length, '跨行也要数得到').toBe(1);
  });

  it('行为：只给单价、不给共Y分（每空2分）⇒ 报"处数没数"', () => {
    const r = run(page('三、填空（每空2分，共8分）', [
      '<p>1. ____，____，____。（每空2分）</p>',
      '<p>2. ____。（2分）</p>',
    ]));
    expect((r.silentDetails || []).filter((x) => /处数没数/.test(x.message)).length, '半式也要报').toBe(1);
  });
});

describe('③ 逐题标：每道作答题干都要有分（A 的活，缺了程序只报）', () => {
  // 🔴 2026-10-26（结构事实）：义务由两支各自写死——单题干标在该题干后，多题干标在各题干后；
  //   题干格式条不再复述同一义务（防双源）。
  it('判据单源：分值块写死各处落点，题干格式条不复述同一义务', () => {
    const t = tpl();
    expect(t, '多题干：每题题干后都有分').toContain('分写在每题题干后');
    expect(t, '单题干：分写在标题后').toContain('单题干（整栏合一）**：**分写在标题后**');
    expect(t, '位置：材料与作答载体之后').toContain('分值括注写在**全部材料与作答载体之后**');
    expect(t, '题干格式条不得再写一遍（单源）').not.toContain('带题号的题，分就写在');
  });

  it('行为：5 道带号题全无分 ⇒ 报 5 道、一道不补', () => {
    const html = page('三、填空（每空1分，共5分）', [
      '<p>1. a____</p>', '<p>2. b____</p>', '<p>3. c____</p>', '<p>4. d____</p>', '<p>5. e____</p>',
    ]);
    const r = run(html);
    const rows = numbered(r.html);
    expect(rows.length, '题号不得增删').toBe(5);
    expect(rows.filter((t) => /（\d+分）$|（每.*共.*分）$/.test(t)), '一道都不许补').toEqual([]);
    const w = (r.silentDetails || []).filter((x) => /道带题号的题没标分/.test(x.message));
    expect(w.length, '必须报').toBe(1);
    expect(w[0].message).toContain('5 道');
  });
});

describe('④ 合成：单档/多档可精准区分', () => {
  it('行为：各题同分 ⇒ 单档', () => {
    const html = page('四、计算（共6分）', [
      '<p>1. 12＋8＝（3分）</p>', '<p>2. 15－7＝（3分）</p>',
    ]);
    expect(head(run(html).html)).toBe('四、计算（每题3分，共6分）');
  });

  it('行为：各题不同分 ⇒ 多档（列到小题号）', () => {
    const html = page('五、解决问题（共6分）', [
      '<p>1. 甲题（2分）</p>', '<p>2. 乙题（4分）</p>',
    ]);
    expect(head(run(html).html)).toBe('五、解决问题（第1小题2分，第2小题4分，共6分）');
  });
});

describe('⑤ 取分口径：只取"带题号那一行末"的小题总分', () => {
  it('行为：行末"（每空1分，共3分）"取 3（不是 1）', () => {
    const html = page('六、填空（共6分）', [
      '<p>1. x____y____z____（每空1分，共3分）</p>',
      '<p>2. p____q____r____（每空1分，共3分）</p>',
    ]);
    expect(head(run(html).html), '按 3+3 合成，按每空1分算会得 6 空×1').toBe('六、填空（每题3分，共6分）');
  });

  it('行为：行末没有分值 ⇒ 不猜，只报（不得把题干里的"共X分"当小题分）', () => {
    const html = page('七、综合（共10分）', [
      '<p>1. 这段材料共10分的内容要读完再答题。（　）</p>',
      '<p>2. 第二题（　）</p>',
    ]);
    const r = run(html);
    const warn = (r.silentDetails || []).filter((x) => x.level === 'warn');
    expect(warn.some((x) => /没标分/.test(x.message)), '必须报"没标分"').toBe(true);
    expect(head(r.html), '标题不得被猜成 10 以外的数').toContain('共10分');
  });
});

describe('⑥ Σ 为真值：按小题分合成，可替换原标题', () => {
  it('行为：标题写共10分、逐题分合计 6 ⇒ 标题替换为 6', () => {
    const html = page('八、应用（共10分）', [
      '<p>1. 甲（2分）</p>', '<p>2. 乙（4分）</p>',
    ]);
    const r = run(html);
    expect(head(r.html), '按 Σ 合成').toContain('共6分');
    expect(head(r.html), '原标题的 10 不得残留').not.toContain('共10分');
  });

  // 🔴 2026-10-26（真机误报）：末题后面紧接答案区时，itemBlockText 曾把答案区标题的
  //   "（每题4分，共16分）"吞进该题 ⇒ 该题被读成 16、Σ 变 28，并连带报"各大题合计≠卷首满分"。
  it('行为：末题后的答案区标题不得被吞进该题（4×4 分 ⇒ 共16分，零误报）', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<p>（考试时间：90分钟　满分：100分）</p>',
      '<h3>八、解决问题，列式、计算并写出答语（每题4分，共16分）</h3>',
      '<p class="question">1. 甲（每空4分，共4分）</p>',
      '<p class="question">2. 乙（每空4分，共4分）</p>',
      '<p class="question">3. 丙（每空4分，共4分）</p>',
      '<p class="question">4. 丁（每空4分，共4分）</p>',
      '<div class="answer-section">',
      '<h3>八、解决问题，列式、计算并写出答语（每题4分，共16分）</h3>',
      '<p>1. 答案一</p><p>2. 答案二</p><p>3. 答案三</p><p>4. 答案四</p>',
      '</div>',
    ].join('\n');
    const r = run(html);
    expect(head(r.html), '按 4 题各 4 分合成').toBe('八、解决问题，列式、计算并写出答语（每题4分，共16分）');
    const miss = (r.silentDetails || []).filter((x) => /标题声明共/.test(x.message));
    expect(miss.length, '不得误报"标题声明与逐题合计不符"').toBe(0);
    const total = (r.silentDetails || []).filter((x) => /与卷首满分/.test(x.message));
    expect(total.length, '不得误报"各大题合计与卷首满分不符"').toBe(0);
  });

  // 🔴 2026-10-26（属主："小题的，镜像到答案区题号后面的位置，这样统一"）
  it('行为：小题分镜像到答案区"题号后"（不在行末、幂等不叠加）', () => {
    const html = [
      '<h1>单元测评</h1>',
      '<h3>八、解决问题（每题4分，共16分）</h3>',
      '<p class="question">1. 甲（每空4分，共4分）</p>',
      '<p class="question">2. 乙（每空4分，共4分）</p>',
      '<p class="question">3. 丙（每空4分，共4分）</p>',
      '<p class="question">4. 丁（每空4分，共4分）</p>',
      '<div class="answer-section">',
      '<h3>八、解决问题（每题4分，共16分）</h3>',
      '<p>1. 答一</p><p>2. 答二</p><p>3. 答三</p><p>4. 答四</p>',
      '</div>',
    ].join('\n');
    const sec = (h) => (h.match(/<div class="answer-section">[\s\S]*?<\/div>/) || [''])[0];
    const r = run(html);
    expect(sec(r.html), '题号后紧跟这道题的分').toContain('1.（每空4分，共4分）');
    expect(sec(r.html), '分不在答案行末').not.toMatch(/答一（每空/);
    const twice = run(r.html);
    expect((twice.html.match(/（每空4分，共4分）/g) || []).length, '幂等：正文4＋答案区4').toBe(8);
  });
});

/** 行首题号的行数（验"不得冒出新题号"用） */
function rows0(html) {
  return numbered(html).length;
}

// 🔴 2026-10-23（属主："分值自洽是模型侧的硬性要求，一层层验"）：
//   2026-10-24 收口：账目只保留可执行的两层——小题 → 大题 → 卷首；大类层不设时由大标题承担。
describe('⑦ 分值自洽：模型侧逐层核（硬性·每题→（多题干）→卷首）', () => {
  it('三层齐备且按"每题→大题→卷首"排列', () => {
    const t = tpl();
    const i1 = t.indexOf('真实作答对象个数 N');
    const i2 = t.indexOf('该大题总分＝其下各题 Y 之和');
    const i3 = t.indexOf('各大题分之和＝给定满分');
    for (const [name, i] of [['①每题', i1], ['②大题', i2], ['③卷首', i3]]) {
      expect(i, `${name} 层必须在位`).toBeGreaterThan(-1);
    }
    expect(i1 < i2 && i2 < i3, '三层必须按顺序验（一层都不得跳）').toBe(true);
    expect(t, '满分是给定值、不可改').toContain('不得改动满分');
  });

  it('中学：与小学同一套账目（不另设第二套）', () => {
    const mid = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'exam' }).template;
    expect(mid, '每题账目同在').toContain('Y＝X×N');
    expect(mid, '大题账目同在').toContain('该大题总分＝其下各题 Y 之和');
    expect(mid, '试卷账目同在').toContain('各大题分之和＝给定满分');
    expect(mid, '旧"中学不设大类层"分叉不得回潮').not.toContain('中学不设大类层');
  });
});
