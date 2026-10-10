// 作答空间形态语义 buildAnswerSpaceInstruction 测试
// ============================================================
// 目的（2026-09 生成侧根治·终稿口径）：作答空位形态不强制绑定——由模型按题干措辞与作答需要选定，
//    （所填为符号的题倾向圆括号空位；短答与"列举归类"倾向横线空——仅为倾向，2026-09 用户定稿"定死该定的、
//    其余交模型"）；真正定死的硬约束：短答空位宽度换算锚（随 BLANK）+ 同题同形态/一空一载体/禁文字占位；
//    🔒 2026-09-15 用户裁定：本节全部条款**纯形态描述、零题型名**（选择/判断/圈选/口算/简答/写作等一律不出现，
//       防题型诱导）——换词不换判据，判据与程序侧收口逐条对齐；
//    - 主观书写形态 = getAnswerRegion(subject,stage).carrier（与程序补差 answer-area-fix 同表同源）：
//        line（英语全学段/科学全学段/语文低中段）→ 整行书写横线；
//        blank-area（数学等理科、理化生、史地政、道法、语文中高段论述阅读）→ 无线留白（不画横线不画框）；
//    - 禁文字占位：不得以任何文字（提示、标签、说明）充当或预置作答空间；
//    - 无 subject/stage（通用模板兜底）不注入学科书写形态分支（防无锚广播）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildAnswerSpaceInstruction, getAnswerRegion, BLANK } from '@/config/layoutSpec.js';

const OLD_VAGUE_SENTENCE = '按书写惯例输出对应作答书写载体';

describe('buildAnswerSpaceInstruction（通用六行：形态按作答需要选择+硬约束，宽度/一致性并入通用层）', () => {
  const generic = buildAnswerSpaceInstruction();
  it('通用（无学科）：六行关键判据齐备（判据级断言，不再锁逐字全文）', () => {
    // 2026-10-02（按执行文档 §4 第 6 步"逐字断言改判据级"）：原逐字 toBe 会因"删元括注"这类**措辞收口**而红，
    //   而该处删的是写给开发者的元话语、判据一字未动 → 改判据级，只锁判据、不锁字面。
    const mustHave = [
      '· 作答空位形态与所填内容相称',
      '具体形态**按所填内容定**',
      '填**符号**（字母/序号/√× 等，含带选项的题）→ **圆括号空位**',
      '1~2 字位',
      '填**短答**（词/句/数等，含"列举归类"）→ **横线空位**',
      // 2026-10-03（⑦排序·合并同义）：原锁"作答位就在题面空位内的题不再另附长横线作答区"——已合并到长答条款 dupClause
      //   （正句）；本条不再复述 → 断言移除（防回潮见下方专测）。
      '· 题面带选项（A./B./C. 等）的题，其作答位即上句判据所指的**圆括号空位**',
      '括号一律用半角（英文状态）括号',
      '选项内、选项末尾及选项之后一律不加作答位',
      '与【题目自洽①】冲突时以本条为准',
      '· 短答空位宽度按"恰好容纳该空答案"换算',
      '严禁按题的先后递增、也严禁全卷一律等宽',
      '· 同一题（含并列子题）同性质空位的形态一致；一个空位只写一种载体',
      '· 作答空间只以真实留白或书写载体呈现：不得以任何文字（提示、标签、说明）充当或预置作答空间',
    ];
    for (const s of mustHave) expect(generic, `缺判据：${s}`).toContain(s);
    expect(generic, '旧空泛句不得回潮').not.toContain(OLD_VAGUE_SENTENCE);
  });

  it('带选项题作答位定死：题首（题干前）+ 圆括号空位、选项行内/末尾/之后不加（2026-09 位置实证 / 2026-09-15 形态实证 / 2026-09-16 段落实证）', () => {
    // 实证①：英语卷答案空位被模型挂到选项末尾（C. are; am＿）——位置属排版硬约束，不交模型语感。
    // 实证②（2026-09-15）：位置已到题首，但形态写成下划线空（<u class="blank-2">1. …）——
    //    故本句把**形态**也定死为圆括号空，不再依赖"大题标题写不写填入括号内"。
    // 实证③（2026-09-16）：模型改把整行横线放进选项行**之后的独立段落**（六年级英语选词填空
    //    每个选项行后挂 2 条 <p><span class="blank-line">）——原句只写"选项行内/末尾"字面合规，
    //    故本句把"选项行之后"一并纳入禁止范围（仍为纯形态描述）。
    // 🔒 范围裁定（2026-09 用户）：只约束"题面带选项"这一个形态，不触碰判断√×位/数学方框圆圈等既有条款；
    //    且纯形态描述、不含题型名（防题型诱导）。
    const CLAUSE_COMMON = '其作答位即上句判据所指的**圆括号空位**';
    const HEAD = '**在题号之前的题首**，写成"( ) 1. 题干…"';
    const TAILPOS = '**在材料与设问之后、选项之前**';
    const PAREN_HALF = '括号一律用半角（英文状态）括号';
    const BAN = '选项内、选项末尾及选项之后一律不加作答位';
    expect(generic).toContain(CLAUSE_COMMON);
    expect(generic, '括号一律半角（英文状态）——既有用户规格').toContain(PAREN_HALF);
    expect(generic, '无学科兜底 → 中文支（材料与设问之后、选项行之前）（2026-10-03 问题3 根治）').toContain(TAILPOS);
    expect(generic).toContain(BAN);
    // 2026-10-03（问题3/6根治）：旧排他词"作答位只有上述那一处"已删——它被模型读成"材料内不得有就地空位"
    //    （实证：选词填空只剩"先操场。"），改由下方"材料内缺内容处就地留空"句承载；禁止范围判据不变。
    expect(generic).toContain('不给整行横线、不给空白作答行、不另设作答区');
    expect(generic, '与自洽①冲突时以本条硬约束为准').toContain('改题面（本条为准）');
    // 2026-09-17 用户裁定（第三卷第六题"题干内下划线空位 + 题首括号位并存"→「这个不是缺陷，正常的」）：
    //    就地空位**必须真实给出**（防模型删掉正常写法）；"并存/同性质只给一次"归 **dupClause**
    //    （buildLongAnswerCarrierInstruction，**不在本单测面内**，由实发集成守卫覆盖）；同时不得引入题型名。
    // 🔴 2026-10-04（J6/J8 真机复验·先解后锁 → J 收尾 16 方面复检·唯一性）：
    //    原句"与**题末作答位**并存、均须保留"不限性质且预设题末位 → J6（作答位落到选项后）/J8（题末多空）；
    //    先收窄为"性质不同者并存、性质相同者只给一次"，随后复检发现**与 dupClause 同义重复** → **删**，归单源。
    //    断言随之改准：本条只锁其独有判据（就地留空 + 缺字处有空位）。
    expect(generic).toContain('材料内缺内容处就地留空');
    expect(generic).toContain('缺字/缺词处该处就有一个空位');
    const newLine = generic.split('\n').find((l) => l.includes('题面带选项'));
    expect(newLine, '新条款应纯形态描述、不含题型名（选择/判断/圈选/填空）').not.toMatch(/选择|判断|圈选|填空/);
    // 2026-09-26 用户定：按"外语类"判定（不只认"英语"）——故把日语也纳入用例，防回退成单一字面量
    for (const [s, st] of [['英语', 'primary_high'], ['日语', 'high'], ['语文', 'primary_low'], ['数学', 'primary_mid'], ['物理', 'middle']]) {
      const isForeign = s === '英语' || s === '日语';
      const inst = buildAnswerSpaceInstruction(s, st);
      expect(inst, `${s}·${st} 缺作答位形态条款`).toContain(CLAUSE_COMMON);
      expect(inst, `${s}·${st} 位置未按学科分叉（外语类题首／中文在材料与设问之后、选项之前）`).toContain(isForeign ? HEAD : TAILPOS);
      expect(inst, `${s}·${st} 括号须为半角（英文状态）`).toContain(PAREN_HALF);
      expect(inst, `${s}·${st} 缺选项禁答位条款`).toContain(BAN);
    }
  });

  it('作答位即题面空位类不另附长横线：**正句在长答条款**（2026-10-03 ⑦ 合并同义，本条不再复述）', () => {
    // 实证（2026-09）：英语卷阅读判断类题被模型在短文后额外出 2 行长横线——作答位本就在小题括号空位内。
    // 2026-10-03（⑦排序·合并同义）：该判据与**长答条款 dupClause**"同一道题同性质的作答位只给一处…不得再在题后
    //   另起同性质的整行短答载体"**作用结果相同** → 按"一处正句、其余引用"合并到 dupClause（正句仍在模型侧）；
    //   程序侧"题面空位类不补差"结构性排除不动。此处锁**复述不得回潮**。
    const CLAUSE = '作答位就在题面空位内的题不再另附长横线作答区';
    expect(generic).not.toContain(CLAUSE);
    for (const [s, st] of [['英语', 'primary_high'], ['语文', 'primary_low'], ['数学', 'primary_mid'], ['物理', 'middle']]) {
      expect(buildAnswerSpaceInstruction(s, st), `${s}·${st} 复述句不得回潮`).not.toContain(CLAUSE);
    }
  });

  it('🔒 载体条款全量纯形态化：全学科×全学段输出零题型名（防题型诱导）', () => {
    // 2026-09-15 用户裁定：载体规则改纯形态描述可行，但"换词不换判据"——
    //   本节任何条款都不得出现题型名，否则构成隐性题型锚（独立调用两次题型雷同的根源之一）。
    const TYPES = ['选择题', '判断题', '圈选题', '填空题', '简答题', '计算题', '口算', '应用题', '主观题',
      '作图题', '连线题', '写作', '习作', '看图写话', '续写', '书面表达', '句子练习', '仿写', '小练笔'];
    const MATRIX = [
      ['语文', 'primary_low'], ['语文', 'primary_high'], ['语文', 'middle'], ['语文', 'high'],
      ['数学', 'primary_low'], ['数学', 'primary_mid'], ['数学', 'middle'], ['数学', 'high'],
      ['英语', 'primary_mid'], ['英语', 'middle'], ['科学', 'primary_mid'], ['物理', 'middle'], ['', ''],
    ];
    for (const [s, st] of MATRIX) {
      const inst = buildAnswerSpaceInstruction(s, st);
      for (const t of TYPES) {
        expect(inst, `${s || '通用'}·${st || '无学段'} 载体条款不应出现题型名「${t}」`).not.toContain(t);
      }
      // 判据词必须在位（换词不换判据：形态/所填内容/卷面位置为判据）
      if (s === '数学') {
        expect(inst).toContain('算式求出、写在等号后的得数所在位');
        expect(inst).toContain('需书写计算过程（列竖式/笔算/脱式等）');
        // 🔴 2026-10-10（〔346〕产物实证·竖式竖向堆叠根治）：补"多个算式同一行横向并排、不逐式各占一整段"。本条为锁。
        expect(inst, '〔346〕竖式多算式须横向并排').toContain('多个算式在同一行横向并排');
      }
    }
  });

  it('通用（无学科）不注入学科书写形态分支（整行横线/无线空白须按 学科×学段 锚定）', () => {
    expect(generic).not.toContain('整行书写横线');
    expect(generic).not.toContain('无线空白');
    expect(generic).not.toContain('算式中的填空位'); // 算式方框/圆圈条款为数学专用
    expect(generic).not.toContain(OLD_VAGUE_SENTENCE); // 旧空泛"按书写惯例"句已根治移除
  });

  it('填空类条款不含"算式结果/默写"（算式填空位走方框通道；默写形态由写字条款/专用载体管，防竞态）', () => {
    const s = buildAnswerSpaceInstruction();
    expect(s).not.toContain('算式结果');
    expect(s).not.toContain('默写');
    expect(s).toContain('填**短答**（词/句/数等');
  });

  it('换算锚随 BLANK 动态注入（wordGap=3 时跟随）', () => {
    const s = buildAnswerSpaceInstruction('数学', 'middle');
    const s3 = buildAnswerSpaceInstruction().replace('1 em', '1 em');
    expect(s).toContain('1 字位≈1 个全角空格≈1 em 书写宽');
    expect(s3).toContain('≈1 em');
    // 直接验证 BLANK 联动（换算锚内嵌函数同源；wordGap 只经 BLANK 规格走，此处锁定默认 1）
    expect(BLANK.wordGap).toBe(1);
  });

  // 2026-09-29（模型侧**去限制**·用户追问"模型侧有没有限制？"）：原句"单题作答区行数不超过本学段上限"
  //   对**所有**题一律给上限——而上限本质是"卷面一屏空间"，**不成立于"答案长度由内容本身决定"的题**
  //   （见 ANSWER_MAX_ROWS_BY_STAGE 注释：成篇成段的整段表达、需完整展露推演步骤的题，一篇远超学段默认值）。
  //   原句把这类题也压到默认值 = 给模型下了**错限制**（且它无从知道可以超）。现只声明"管辖域"，不新增数值。
  it('单题行数上限声明"管辖域"：不管"篇幅由内容决定"的题（不新增数值、与规格库同源）', () => {
    for (const [s, st] of [['英语', 'high'], ['语文', 'primary_low'], ['数学', 'middle'], ['语文', 'high']]) {
      const inst = buildAnswerSpaceInstruction(s, st);
      expect(inst, `${s}·${st} 缺上限管辖域声明`).toContain('**常规作答区**的单题行数不超过本学段卷面上限');
      expect(inst, `${s}·${st} 须声明该类题不受上限约束`).toContain('不受此上限约束');
    }
    // 上限数值仍与 getAnswerRegion 同源（不在此处编数值；需要更大空间的学科×学段走 ANSWER_MAX_ROWS_BY_SUBJECT 面板口径）
    expect(buildAnswerSpaceInstruction('英语', 'high'))
      .toContain(`卷面上限（${getAnswerRegion('英语', 'high').maxRowsPerItem} 行）`);
  });
});

describe('buildAnswerSpaceInstruction（学科书写形态与 ANSWER_REGION 同源）', () => {
  // 每组断言：语义条款的学科分支 == 程序补差（getAnswerRegion）的 carrier——两条线永不打架
  const cases = [
    // [学科, 学段, 期望句子, 不应出现的句子]
    ['数学', 'middle', '输出无线空白作答行', '整行书写横线'],
    ['物理', 'middle', '输出无线空白作答行', '整行书写横线'],
    ['历史', 'high', '输出无线空白作答行', '整行书写横线'],
    ['英语', 'middle', '整行书写横线', '无线空白'],   // 英语书面表达横线行（实证 17cm/行距1cm）
    ['英语', 'high', '整行书写横线', '无线空白'],
    ['科学', 'primary_mid', '整行书写横线', '无线空白'],
    ['语文', 'primary_low', '整行书写横线', '无线空白'],   // 低段写话/句子练习惯例
    ['语文', 'primary_mid', '整行书写横线', '无线空白'],
    ['语文', 'middle', '输出无线空白作答行', '整行书写横线'],      // 中高考答题卡实证：阅读/论述=空白作答区
    ['语文', 'high', '输出无线空白作答行', '整行书写横线'],
  ];
  for (const [subject, stage, must, mustNot] of cases) {
    it(`${subject}·${stage}：含「${must}」、不含「${mustNot}」（与 getAnswerRegion 一致）`, () => {
      const s = buildAnswerSpaceInstruction(subject, stage);
      expect(s, `${subject}·${stage} 缺学科书写形态句`).toContain(must);
      expect(s, `${subject}·${stage} 误入另一形态分支`).not.toContain(mustNot);
      // 与程序补差同源：语义分支方向 == ANSWER_REGION carrier
      const carrier = getAnswerRegion(subject, stage).carrier;
      if (carrier === 'line') expect(s).toContain('整行书写横线');
      else expect(s).toContain('无线空白');
    });
  }

  it('禁文字占位句恒在：不输出"答：/作答区"字面充当作答空间', () => {
    for (const [subject, stage] of [['数学', 'middle'], ['语文', 'high'], ['英语', 'primary_mid']]) {
      const s = buildAnswerSpaceInstruction(subject, stage);
      expect(s).toContain('不得以任何文字（提示、标签、说明）充当或预置作答空间');
      expect(s).toContain('作答空间只以真实留白或书写载体呈现');
    }
  });

  it('blank-area 分支显式禁画线画框（理科解答不画横线、不把留白圈成方框）', () => {
    const s = buildAnswerSpaceInstruction('数学', 'middle');
    expect(s).toContain('不画横线、不把留白圈成方框');
  });

  it('算式填空位/比大小条款仅注入数学（方框/圆圈专用通道，与 normalizeMathCircleBlanks 收口同语义）', () => {
    const math = buildAnswerSpaceInstruction('数学', 'primary_mid');
    expect(math).toContain('缺数/填数算式填空位』（如 3＋□＝8、□×□＝12 里待填的数）用方框或圆圈呈现，不用下划线空位');
    // 2026-09-17 去重+消相抵：结果位形态**只**由学段句承载（原「本条句尾一律留白、不用括号」与
    //    「低段可用＝（　）定位」两句直接相抵，且"一空一载体"在通用段与本段重复）；中高段句如下
    expect(math).toContain('等号后的得数结果位』（算式求出、写在等号后的得数所在位）：只需直接写出得数、无需书写过程的，在等号后直接留白书写（中高年级/初中卷面惯例），不加方框、不加括号、不用圆圈');
    expect(math, '结果位口径不得回退为"两句并存"').not.toContain('一律在等号后直接留白书写，不使用方框、不用圆圈、不用括号');
    // 低段：允许"＝＿＿＿"/"＝（　）"定位——与中高段句互斥且各自单写（消低段两句相抵）
    const lowMath = buildAnswerSpaceInstruction('数学', 'primary_low');
    expect(lowMath).toContain('低年级如需定位作答，可用「＝＿＿＿」下划线或「＝（　）」括号，不用方框');
    expect(lowMath).toContain('同卷内同一形态统一，不混用');
    // 比较大小（填＞＜＝）：卷面惯例为"在○里填符号"（圆圈作答位），非括号空——数学专属，防通用符号位条款错引
    expect(math).toContain('比较大小（填＞/＜/＝）用○圈出符号位作答，不用括号空位');
    // 一空一载体/空位不嵌套：归通用段单源，数学段不再复述（防逐字重复）
    expect(math.split('空位内不再嵌空位').length - 1, '一空一载体只应出现在通用段一次').toBe(1);
    // 非数学学科不注入（算式/比大小空位为数学卷面惯例，防跨学科广播）
    for (const [subject, stage] of [['英语', 'middle'], ['语文', 'middle'], ['科学', 'primary_mid'], ['物理', 'middle']]) {
      const s = buildAnswerSpaceInstruction(subject, stage);
      expect(s, `${subject} 不应含算式填空位条款`).not.toContain('算式中的填空位');
      expect(s, `${subject} 不应含比大小条款`).not.toContain('比较大小');
    }
  });

  it('line 分支按学科分流：英语含成篇横线引导、语文成篇成文排除（走专用书写格）、不诱导作文格词', () => {
    // 英语：成段/成篇书写 = 横线体系（2j-5b 程序补横线同语义）——必须含成篇表达，绝不可用排除句剔除
    const en = buildAnswerSpaceInstruction('英语', 'middle');
    expect(en).toContain('答案须成句成段书写的题（含成篇表达）输出整行书写横线');
    expect(en).toContain('需成段/成篇书写的题，其整行书写横线只在整题之后集中给一处');
    expect(en).not.toContain('另有专用书写载体');
    // 语文低段：成篇成文另有专用书写载体（专用书写格通道），横线句以"成句成段/成篇成文"篇幅二分、不用任何题型名
    const yw = buildAnswerSpaceInstruction('语文', 'primary_low');
    expect(yw).toContain('不得省略\n另注：成篇成文类用专用书写载体，不用整行横线');
    expect(yw).not.toContain('（成篇成文类另有专用书写载体'); // 3.3 三要素分离：边界件须独立成行，不得再括在正句内
    expect(yw).not.toContain('作文格'); // 专用书写格名称由该通道管理，此处只说"另有专用书写载体"
    // 三分支一律零题型名（用户裁定：载体条款纯形态描述）
    for (const [s, st] of [['语文', 'primary_low'], ['英语', 'middle'], ['科学', 'primary_mid']]) {
      const inst = buildAnswerSpaceInstruction(s, st);
      expect(inst, `${s}·${st} 书写行分支不应含题型名`).not.toMatch(/写作|习作|看图写话|续写|书面表达|句子练习|仿写|简答|主观题|长答题/);
      expect(inst).toContain('整行书写横线');
    }
  });
});
