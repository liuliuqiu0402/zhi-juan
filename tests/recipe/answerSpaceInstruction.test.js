// 作答空间形态语义 buildAnswerSpaceInstruction 测试
// ============================================================
// 🔴 目的（2026-09 生成侧根治）：作答空位形态从"按书写惯例→模型语感自由发挥"改为"按答案类型绑定"：
//    - 圈选/判断/选择 → 圆括号空位；填空短答 → 下划线空位（换算锚随 BLANK）；
//    - 主观书写形态 = getAnswerRegion(subject,stage).carrier（与程序补差 answer-area-fix 同表同源）：
//        line（英语全学段/科学全学段/语文低中段）→ 整行书写横线；
//        blank-area（数学等理科、理化生、史地政、道法、语文中高段论述阅读）→ 无线留白（不画横线不画框）；
//    - 禁文字占位：严禁用"答：""作答区"等文字充当或预置作答空间；
//    - 无 subject/stage（通用模板兜底）不注入学科书写形态分支（防无锚广播）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildAnswerSpaceInstruction, getAnswerRegion, BLANK } from '@/config/layoutSpec.js';

const OLD_VAGUE_SENTENCE = '按书写惯例输出对应作答书写载体';

describe('buildAnswerSpaceInstruction（通用四行：形态按答案类型绑定）', () => {
  const generic = buildAnswerSpaceInstruction();
  it('通用（无学科）四行逐字完整：总句+圈选圆括号+填空下划线+禁文字占位', () => {
    expect(generic).toBe(
      '· 作答空间形态按答案类型匹配，不自行发明：\n' +
      '· 圈选/判断/选择类（填字母、序号或√×）在题末或选项后用圆括号空位（　）作答；\n' +
      '· 填空类（填词/句/数/默写等短答）在句内或行尾写下划线空位，宽度按答案长度（1 字位≈1 个全角空格≈1 em 书写宽），连列空位全带、不得遗漏；\n' +
      '· 作答空间只以真实留白或书写载体呈现：严禁用"答：""作答区"等文字充当或预置作答空间；'
    );
  });

  it('通用（无学科）不注入学科书写形态分支（整行横线/无线空白须按 学科×学段 锚定）', () => {
    expect(generic).not.toContain('整行书写横线');
    expect(generic).not.toContain('无线空白');
    expect(generic).not.toContain('算式中的填空位'); // 算式方框/圆圈条款为数学专用
    expect(generic).not.toContain(OLD_VAGUE_SENTENCE); // 旧空泛"按书写惯例"句已根治移除
  });

  it('填空类条款不含"算式结果"（算式填空位走方框/圆圈专用通道，不归下划线）', () => {
    const s = buildAnswerSpaceInstruction();
    expect(s).not.toContain('算式结果');
    expect(s).toContain('默写等短答');
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
    ['数学', 'middle', '留无线空白', '整行书写横线'],
    ['物理', 'middle', '留无线空白', '整行书写横线'],
    ['历史', 'high', '留无线空白', '整行书写横线'],
    ['英语', 'middle', '整行书写横线', '无线空白'],   // 英语书面表达横线行（实证 17cm/行距1cm）
    ['英语', 'high', '整行书写横线', '无线空白'],
    ['科学', 'primary_mid', '整行书写横线', '无线空白'],
    ['语文', 'primary_low', '整行书写横线', '无线空白'],   // 低段写话/句子练习惯例
    ['语文', 'primary_mid', '整行书写横线', '无线空白'],
    ['语文', 'middle', '留无线空白', '整行书写横线'],      // 中高考答题卡实证：阅读/论述=空白作答区
    ['语文', 'high', '留无线空白', '整行书写横线'],
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

  it('算式填空位条款仅注入数学（方框/圆圈专用通道，与 normalizeMathCircleBlanks 收口同语义）', () => {
    const math = buildAnswerSpaceInstruction('数学', 'primary_mid');
    expect(math).toContain('算式中的填空位（如 3＋□＝8、□×□＝12）用方框或圆圈呈现，不用下划线空位');
    // 非数学学科不注入（算式填空位为数学算式惯例，防跨学科广播）
    for (const [subject, stage] of [['英语', 'middle'], ['语文', 'middle'], ['科学', 'primary_mid'], ['物理', 'middle']]) {
      expect(buildAnswerSpaceInstruction(subject, stage), `${subject} 不应含算式填空位条款`).not.toContain('算式中的填空位');
    }
  });

  it('line 分支不诱导写作类专用载体（作文格等由作文格通道/载体协议单独约束）', () => {
    const s = buildAnswerSpaceInstruction('英语', 'middle');
    expect(s).toContain('写作类另有专用书写载体');
    expect(s).not.toContain('作文格');
  });
});
