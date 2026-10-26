// 属主六问自检（2026-10-23）：
//   ① 编号/不编号能否精准区分执行；② 标分带不带单位能否精准区分；③ 能否逐题标；
//   ④ 合成能否精准区分单档/多档；⑤ 取分口径是否清晰可执行；⑥ 是否按小题分合成、可替换原标题。
// 每条都同时检验**判据在位**（实发文本）与**行为成立**（真跑校验器），避免"文本写了但程序不照做"。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, NUMBERING_BRANCH_RULE } from '../../src/config/promptLibrary.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const tpl = () => getPromptTemplate({ grade: 'primary_mid', subject: '数学', genType: 'exam' }).template;
const run = (html) => auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
const pTexts = (h) => [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&emsp;|&nbsp;/g, ' ').trim());
const numbered = (h) => pTexts(h).filter((t) => /^\d{1,2}\s*[.、．]/.test(t));
const head = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1])[0] || '';
const page = (title, rows) => ['<h1>单元测评</h1>', `<h3>${title}</h3>`, ...rows].join('\n');

describe('① 编号/不编号：单一判据 + 两条边界', () => {
  // 🔴 2026-10-23（属主："其余→不编号这个对于模型来说，它不认的，其余的也是题"）：
  //   判据不再做内容分类，只留**一个动作**；两支各写自己的后果，末尾用互锁句封住"半条腿"。
  it('判据只有一个正面锚（一组只做一个动作），两支各自的动作都写死', () => {
    expect(NUMBERING_BRANCH_RULE, '正面锚').toContain('一组只做一个动作');
    expect(NUMBERING_BRANCH_RULE, '写号支：每道带号小题都要有自己的分值').toContain('每道带号小题都要有自己的分值');
    // 2026-10-24（属主："不要人为干预模型的能力"→回补"大标题必带总分"）：标分位置只在【分值标注】写一次，
    //   判据常量里不再复述（防双源）；断言随之改查模板。
    expect(tpl(), '写号支：位置＝整道题设问的最后一句之后').toContain('整道题设问的最后一句之后');
    expect(NUMBERING_BRANCH_RULE, '不写号支：分值只写在大标题').toContain('**不带号**：**分值只写在大标题**');
    // 🔴 2026-10-25（属主："题内不写分会被跨支取用"）：否定句整句删除——"分值只写在大标题"已把后果说尽。
    expect(NUMBERING_BRANCH_RULE, '旧"题内不标分"不得回潮').not.toContain('题内不标分');
    // 🔴 2026-10-24（属主真卷：口算/竖式被编号、大标题无分、全卷差 26 分）：
    //   不写号支补一个**可自判的现场动作**——遮住大题标题单独看该项，只有算式/作答内容就不知道要做什么 ⇒ 不编号。
    expect(NUMBERING_BRANCH_RULE, '不写号支：可自判的现场动作').toContain('遮住大题标题就不知道要做什么');
    expect(NUMBERING_BRANCH_RULE, '互锁：只有号／只有分都不成立').toContain('不许只有号没有分，也不许没有号却在题内标分');
    expect(NUMBERING_BRANCH_RULE, '不做内容分类（不按"成句/并列/形态"判支）').not.toMatch(/成句|完整句子|并列算式/);
    expect(tpl(), '判据就地内联（写分值处能读到）').toContain('号是点名用的');
    expect(tpl().indexOf('号是点名用的'), '按写作顺序：先判编号、再写两支后果')
      .toBeLessThan(tpl().indexOf('**带小题号**：'));
    // 🔴 2026-10-24（属主："不要提均分/不同分，模型会选择一个最简单的方式均分来标"）：
    //   分值块里不得出现任何"均分/同分"字样——一出现就会被读成"把各题拉平"的许可。
    //   （B 侧合成标题时按各题分分组是另一回事，不在实发文本里。）
    // 块切片锚行首：【卷面结构】里行内引用"按【分值标注】判"不算块起点（否则切到引用处、判据被稀释）。
    const scoreBlock = (tpl().match(/^【分值标注】([\s\S]*?)(?=\n\n【)/m) || [, ''])[1];
    expect(scoreBlock, '分值块不得出现均分/同分口径').not.toMatch(/均分|同分|不同分/);
    // 🔴 2026-10-24（真机："有些带题号的小题没按真题规范输出"）：多行题（有选项、多问）把"题干末尾"
    //   读成"选项之前"⇒ 索性不标；或整组只在标题/组首标一次。两句必须同时在内，缺一即回潮。
    expect(scoreBlock, '多行题落点＝整道题设问的最后一句之后').toContain('整道题设问的最后一句之后');
    expect(scoreBlock, '写一题、标一题（替代"整组只标一次"的禁令）').toContain('写一题、标一题');
    expect(scoreBlock, '漏标一题即不合规').toContain('漏标一题即不合规');
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

// 🔴 2026-10-23（属主真卷 `1. 5×3＝　2. 6×2＝…` 被编号，并追问"是不是模型不知道什么叫不该编号的？"）：
//   症结＝判据只说"两支各怎么做"，**没说凭什么选这一支**——对模型来说它们全是题，只能按习惯编号。
//   故补**正面事实**：号是点名用的（有自己一句话才要号；只有算式/符号、同一动作换数就不要），
//   并补一条 A 侧排版约束"写了号就一题一段"（否则 B 只能按段取分，出现"每题7分"这种按行数算出的价）。
describe('①-b 凭什么这一组不写号：唯一开关（不是"其余"兜底）', () => {
  it('判据给的是可自判的事实，不是题型名、不留兜底', () => {
    expect(NUMBERING_BRANCH_RULE, '号有用途才写').toContain('号是点名用的');
    expect(NUMBERING_BRANCH_RULE, '唯一开关：有没有只属于它自己的题干话').toContain('各项有只属于它自己的题干话');
    expect(NUMBERING_BRANCH_RULE, '不编号支判据（只有作答内容本身）').toContain('只有作答内容本身、没有只属于它的话');
    expect(NUMBERING_BRANCH_RULE, '一组只定一个结果（不许一半一半）').toContain('一组只做一个动作');
    expect(NUMBERING_BRANCH_RULE, '不按题型名枚举').not.toMatch(/口算|竖式|脱式|判断|选择|填空/);
    expect(NUMBERING_BRANCH_RULE, '不留"其余"兜底').not.toContain('其余');
    expect(NUMBERING_BRANCH_RULE, '旧两区名不得回潮（第二把尺）').not.toMatch(/成题区|直答区/);
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

describe('② 标分：带不带单位可精准区分', () => {
  it('判据：一处判分写裸分；多处写全式（带单位）', () => {
    const t = tpl();
    expect(t).toContain('一律写全式');
    expect(t).toContain('一律写全式');
    expect(t).toContain('（每〈单位〉X分，共Y分）');
    expect(t, 'Y 须与该题实际判分处数相符').toContain('Y＝单价×处数');
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
describe('②-b 处数要数：Y 须与该题实际判分处数相符', () => {
  it('判据：分值按题目本身给（不设人为禁令）', () => {
    const t = tpl();
    expect(t, 'Y 与处数相符').toContain('Y＝单价×处数');
    // 🔴 2026-10-24（属主："不要人为干预模型的能力"）：两句禁令已删（详见 titleNumberScoreMatrix 同条注释）。
    expect(t, '"不得整组一律"不得回潮').not.toContain('不得整组一律');
    expect(t, '分值按题目本身给').toContain('分值按题目本身给');
    // 🔴 2026-10-24（属主："单价不一定要取整数分吧？也可以是 0.5 分…不要人为指定单价一样"）：
    //   单价按该处内容定，不设整数限制、不强制全大题一个价（程序按**题**合成，不按单价合成）。
    expect(t, '不得强制同一大题一个价').not.toContain('同一大题一个价');
    expect(t, '不得强制整数分').not.toContain('取整数分');
    // 不编号支的价必须由标题承载，一个标题一个价（题内不标分）。
    expect(t, '不编号支：分值只写在大标题').toContain('分值只写在大标题');
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

describe('③ 逐题标：每道带号题都要有分（A 的活，缺了程序只报）', () => {
  // 🔴 2026-10-24（属主："带题号的小题标分不就是在题干上标吗？"）：判据原来只在【分值标注】块里，
  //   离"写题"两百行 ⇒ 模型逐题生成时看不到。现把义务写进**题干格式条**（写 <p class="question"> 那一刻）。
  //   2026-10-24 收口（单一开关）：同一义务只在【分值标注】第②步定义一次；题干格式条不再复述（防双源）。
  it('判据单源：分值块写死逐题标分，题干格式条不复述同一义务', () => {
    const t = tpl();
    expect(t, '带号题必须逐题标分').toContain('每道带号小题都要有自己的分值');
    expect(t, '漏标一题即不合规').toContain('漏标一题即不合规');
    expect(t, '漏标一题即不合规（分只写题内）').toContain('漏标一题即不合规');
    // 🔴 2026-10-24（真机："有些带题号的小题没按真题规范输出"）：上一版"不钉死行末"被模型读成
    //   "多行题可以不标"，选项后/末行的分读不到。**恢复单一位置**：整道题设问的最后一句之后（多行题以最后一行为准）。
    expect(t, '标分位置＝整道题设问的最后一句之后（多行题以最后一行为准）').toContain('整道题设问的最后一句之后');
    expect(t, '题干格式条不得再写一遍（单源）').not.toContain('带题号的题，分就写在整道题设问的最后一句之后');
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
});

/** 行首题号的行数（验"不得冒出新题号"用） */
function rows0(html) {
  return numbered(html).length;
}

// 🔴 2026-10-23（属主："分值自洽是模型侧的硬性要求，一层层验"）：
//   2026-10-24 收口：账目只保留可执行的两层——小题 → 大题 → 卷首；大类层不设时由大标题承担。
describe('⑦ 分值自洽：模型侧逐层核（硬性·小题→大题→卷首）', () => {
  it('三层齐备且按"题→大题→卷首"排列', () => {
    const t = tpl();
    const i1 = t.indexOf('每道带号小题都要有自己的分值');
    const i2 = t.indexOf('小题分之和＝该大题分');
    const i3 = t.indexOf('各大题分之和＝卷首满分');
    for (const [name, i] of [['①题', i1], ['②大题', i2], ['③卷首', i3]]) {
      expect(i, `${name} 层必须在位`).toBeGreaterThan(-1);
    }
    expect(i1 < i2 && i2 < i3, '三层必须按顺序验（一层都不得跳）').toBe(true);
    expect(t, '差额只在层内调（不跨大题）').toContain('不跨大题挪');
  });

  it('中学：与小学同一套账目（不另设"中学不设大类层"的第二套）', () => {
    const mid = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'exam' }).template;
    expect(mid, '小题→大题账目同在').toContain('小题分之和＝该大题分');
    expect(mid, '大题→卷首账目同在').toContain('各大题分之和＝卷首满分');
    expect(mid, '旧"中学不设大类层"分叉不得回潮').not.toContain('中学不设大类层');
  });
});
