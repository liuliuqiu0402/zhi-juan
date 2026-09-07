// 作答空间形态语义 buildAnswerSpaceInstruction 测试
// ============================================================
// 🔴 目的（2026-09 生成侧根治·终稿口径）：作答空位形态不强制绑定——由模型按题干措辞与题型语感选定，
//    （圈选判断选择类倾向圆括号空位；短答与"列举归类"倾向横线空——仅为倾向，2026-09 用户定稿"定死该定的、
//    其余交模型"）；真正定死的硬约束：短答空位宽度换算锚（随 BLANK）+ 同题同形态/一空一载体/禁文字占位；
//    - 主观书写形态 = getAnswerRegion(subject,stage).carrier（与程序补差 answer-area-fix 同表同源）：
//        line（英语全学段/科学全学段/语文低中段）→ 整行书写横线；
//        blank-area（数学等理科、理化生、史地政、道法、语文中高段论述阅读）→ 无线留白（不画横线不画框）；
//    - 禁文字占位：严禁用"答：""作答区"等文字充当或预置作答空间；
//    - 无 subject/stage（通用模板兜底）不注入学科书写形态分支（防无锚广播）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildAnswerSpaceInstruction, getAnswerRegion, BLANK } from '@/config/layoutSpec.js';

const OLD_VAGUE_SENTENCE = '按书写惯例输出对应作答书写载体';

describe('buildAnswerSpaceInstruction（通用五行：形态按语感选择+硬约束，宽度/一致性并入通用层）', () => {
  const generic = buildAnswerSpaceInstruction();
  it('通用（无学科）五行逐字完整：总句+语感选定(含1~2字位)+短答宽度(含可执行换算)+同题同形态/一空一载体+禁文字占位', () => {
    expect(generic).toBe(
      '· 作答空间形态按答案类型匹配，不自行发明：\n' +
      '· 空位具体形态（圆括号空／横线空／圈作答）由你按题干措辞与题型语感选定——填字母/序号/√×的圈选判断选择类多用圆括号空位（　）或圈作答，填词/句/数等短答与"列举归类"空位（如"有限小数有＿"）多用横线空位；形态真实可书写、同卷同题型风格统一即可，圈选类括号内宽只须容纳所填符号（1~2 字位）；\n' +
      '· 短答空位宽度按"恰好容纳该空答案"换算：先在心里给出该空答案并数清字符数（数字/汉字/小数点各算 1 个），写等量的全角空格（1 字位≈1 个全角空格≈1 em 书写宽），连列空位全带、不得遗漏；\n' +
      '· 同一题（含并列子题）同性质空位的形态一致；一个空位只写一种载体，空位内不再嵌空位、空位前不叠加空白宽度；\n' +
      '· 作答空间只以真实留白或书写载体呈现：严禁用"答：""作答区"等文字充当或预置作答空间；'
    );
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
    expect(s).toContain('填词/句/数等短答');
  });

  it('换算锚随 BLANK 动态注入（wordGap=3 时跟随）', () => {
    const s = buildAnswerSpaceInstruction('数学', 'middle');
    const s3 = buildAnswerSpaceInstruction().replace('1 em', '1 em');
    expect(s).toContain('1 字位≈1 个全角空格≈1 em 书写宽');
    expect(s3).toContain('≈1 em');
    // 直接验证 BLANK 联动（换算锚内嵌函数同源；wordGap 只经 BLANK 规格走，此处锁定默认 1）
    expect(BLANK.wordGap).toBe(1);
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
      expect(s).toContain('严禁用"答：""作答区"等文字充当或预置作答空间');
      expect(s).toContain('作答空间只以真实留白或书写载体呈现');
    }
  });

  it('blank-area 分支显式禁画线画框（理科解答不画横线、不把留白圈成方框）', () => {
    const s = buildAnswerSpaceInstruction('数学', 'middle');
    expect(s).toContain('不画横线、不把留白圈成方框');
  });

  it('算式填空位/比大小条款仅注入数学（方框/圆圈专用通道，与 normalizeMathCircleBlanks 收口同语义）', () => {
    const math = buildAnswerSpaceInstruction('数学', 'primary_mid');
    expect(math).toContain('算式中的填空位（如 3＋□＝8、□×□＝12）用方框或圆圈呈现，不用下划线空位');
    // 比较大小（填＞＜＝）：卷面惯例为"在○里填符号"（圆圈作答位），非括号空——数学专属，防通用"判断→圆括号"句错引
    expect(math).toContain('比较大小（填＞/＜/＝）用○圈出符号位作答，不用括号空位');
    // 非数学学科不注入（算式/比大小空位为数学卷面惯例，防跨学科广播）
    for (const [subject, stage] of [['英语', 'middle'], ['语文', 'middle'], ['科学', 'primary_mid'], ['物理', 'middle']]) {
      const s = buildAnswerSpaceInstruction(subject, stage);
      expect(s, `${subject} 不应含算式填空位条款`).not.toContain('算式中的填空位');
      expect(s, `${subject} 不应含比大小条款`).not.toContain('比较大小');
    }
  });

  it('line 分支按学科分流：英语写作含横线引导、语文写作排除（走作文格）、不诱导作文格词', () => {
    // 英语：写作/续写/书面表达 = 横线体系（2j-5b 程序补横线同语义）——必须含"写作"，绝不可用"另有专用载体"排除
    const en = buildAnswerSpaceInstruction('英语', 'middle');
    expect(en).toContain('写作/续写/书面表达/句子练习等）输出整行书写横线');
    expect(en).not.toContain('另有专用书写载体');
    // 语文低段：习作/看图写话另有专用书写载体（作文格通道），横线句不含"写作"
    const yw = buildAnswerSpaceInstruction('语文', 'primary_low');
    expect(yw).toContain('习作/看图写话另有专用书写载体');
    expect(yw).not.toMatch(/写作[^／]*输出整行书写横线/);
    expect(yw).not.toContain('作文格'); // 作文格名称由作文格通道管理，此处只说"另有专用书写载体"
  });
});
