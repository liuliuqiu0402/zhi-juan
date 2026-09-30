// 2026-09：题目自洽总纲补位（⑪⑫⑬）回归（原称"卷面自洽"，2026-09-12 改类型中性名）
// ⑪ 题干指示作答所用的线形/标记名加中文引号（用“波浪线”划出/“横线”画出），不以图形替换名称；
// ⑫ 写序号/字母入槽的作答位默认括号或横线，不默认用圈（○）槽（题干明说“圈/○里”才用圈并须真给 ○）。
// ⑬（2026-09-15 用户裁定·根修）题干对答案提出的形式性要求须在答案中真实成立——实证缺陷：
//    某份英语同步练习的韵律诗题要求"使诗歌押韵"，而答案是 keep/deep/see/green，
//    (1)keep 与 best、(4)green 与 far 并不押韵，解析里自己写了"不押韵但…"（题面与答案不自洽）。
//    用户裁定：不做单题修补，从根上解决 → ⑩原本只覆盖"时态呼应/要素不矛盾"，
//    缺"题干声明的形式性约束 ↔ 答案成立性"这一类判据；⑬以**性质**表述补位（不枚举具体形式），
//    凡对答案本身的字面/形式限定与呼应关系（押韵、节奏、字数、首字母、读音、格式……）自动落入。
// 题类格式经 QUESTION_FORMAT 注入，内容型（summary/preview）不走本块。
import { describe, it, expect } from 'vitest';
import { buildOutputFormatHint, floorClauseSections } from '../../src/config/promptLibrary.js';

describe('题目自洽总纲 ⑪⑫⑬（2026-09）', () => {
  it('题类格式：线形名加引号 + 序号入槽默认不用圈', () => {
    const q = buildOutputFormatHint({ subject: '语文', stage: 'primary_high', genType: 'practice' });
    expect(q).toContain('用“波浪线”划出');
    expect(q).toContain('用“横线”画出');
    expect(q).toContain('不默认用圈（○）槽');
    expect(q).toContain('仅题干明说“圈/○里”时用圈形空位并须真实给出 ○');
  });

  it('⑬形式性要求须在答案中成立（性质表述、不枚举具体形式、不点题型名）', () => {
    const q = buildOutputFormatHint({ subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(q).toContain('⑬题干对答案提出的**形式性要求**须在答案中真实成立');
    expect(q).toContain('答案就必须真的满足；做不到时改题干或改答案，二者取一，不得让题干声明与答案不一致');
    // 性质表述：不得回退为"押韵/字数/首字母…"式枚举，也不得点题型名
    const clause = q.slice(q.indexOf('⑬'));
    expect(clause, '不得枚举具体形式').not.toMatch(/押韵|节奏|字数|首字母|音标/);
    expect(clause, '不得点题型名').not.toMatch(/选择题|判断题|填空题|简答题|计算题|仿写题/);
  });

  it('内容型格式不注入题类载体约束（防向梳理型广播）', () => {
    const c = buildOutputFormatHint({ subject: '语文', stage: 'primary_high', genType: 'summary' });
    expect(c).not.toContain('不默认用圈');
    expect(c).not.toContain('题目自洽');
    expect(c, '内容型不得注入 ⑬').not.toContain('⑬题干对答案提出的');
  });
});

// 2026-09-17 用户追问第三卷（"自洽不只是题干与内容，内容之间也要自洽吧？第一题就不自洽…后面应该还有吧？"）：
// ⑭ 角色与语句归属自洽 —— 实证：选句补全对话第 3 空参考答案"Thank you. I'll try my best."被放在**发起方**口中
//    （该空所在行是"A: 3. ___ You can practise with me."），致谢语只可能由对方说 → 答案与对话角色不自洽。
// ⑮ 所给材料的穷尽与不增 —— 实证：连词成句第 5 题词表为 don't/I/can/but/I/try，参考答案却是
//    "I can't, but I don't try."（can't 需把 don't 拆开重拼，词表里根本没有该词形；且成句语义与本单元主题相反）。
// ⑯ 材料与答案唯一对应 —— 实证：看图写词第 5 题图面"男孩表演孙悟空动作、手持棍子"含多个可命名对象，
//    答案却定死 monkey → 答案不由材料唯一确定。
// 三条一律**性质表述**（不枚举具体情形、不点题型名），只进题类资料。
describe('题目自洽总纲 ⑭⑮⑯：内容之间也要自洽（2026-09-17 用户追问第三卷）', () => {
  const q = () => buildOutputFormatHint({ subject: '英语', stage: 'primary_high', genType: 'practice' });

  it('三条补位齐备（角色归属／材料穷尽／材料-答案唯一）', () => {
    const t = q();
    expect(t).toContain('⑭凡以说话人/角色名义给出的内容');
    expect(t).toContain('语句归属必须与其身份及上下文衔接自洽');
    expect(t).toContain('⑮凡给出待用材料');
    expect(t).toContain('恰好用尽所给材料、不增不拆不改形');
    expect(t).toContain('⑯凡以图片、图形或其他材料为依据作答的题');
    expect(t).toContain('确保答案由材料唯一确定');
  });

  it('仍为性质表述：不枚举具体情形、不点题型名（防题型诱导回潮）', () => {
    const clause = q().slice(q().indexOf('⑭'));
    expect(clause, '不得点题型/语篇名').not.toMatch(/选择题|判断题|填空题|简答题|连词成句|补全对话|看图写话/);
    expect(clause, '不得枚举具体词形').not.toMatch(/can't|don't/);
  });

  it('内容型不注入 ⑭⑮⑯（与题类条款同一广播边界）', () => {
    const c = buildOutputFormatHint({ subject: '语文', stage: 'primary_high', genType: 'summary' });
    expect(c).not.toContain('⑭凡以说话人');
    expect(c).not.toContain('⑮凡给出待用材料');
  });

  it('命题纪律（答案位置打散）随题类注入、不向内容型广播', () => {
    // 🔴 2026-09-17 用户裁定："程序侧报这些意义不大，不依赖程序侧"——原拟做成程序探针的"答案位置成规律"
    //    撤除探针，改由生成侧自查承接（探针在 5 题样本下 80% 门槛的偶然命中率约 7%，不达"宁漏不误"）。
    const t = buildOutputFormatHint({ subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(t).toContain('同一组题的正确答案在选项序列中的位置须打散');
    const c = buildOutputFormatHint({ subject: '语文', stage: 'primary_high', genType: 'summary' });
    expect(c).not.toContain('答案位置');
  });

  it('英语学科条款补"语音标注无歧义"（同形异读词/标注范围与解析一致）', () => {
    // 实证：辨音题用了 read（同形异读 /iː/ 与 /e/，题面未给语境）→ 答案不唯一；
    //      且解析写"pear 中 ear 发 /eə/"，而题面画线部分只有 ea → 解析与标注范围不一致
    const fact = floorClauseSections({ subject: '英语', stage: 'primary_high', genType: 'practice' })
      .find((s) => s.marker === '【英语学科事实底线】');
    expect(fact, '英语学科事实底线段应在').toBeTruthy();
    expect(fact.text).toContain('语音标注（发音/拼读类）须无歧义');
    expect(fact.text).toContain('读音唯一');
    expect(fact.text).toContain('解析里指到的字母组合须与题面标注（画线/加点）的范围逐字一致');
  });
});

// 🔴 2026-09-18 用户实证（知识总结）：小组标题写「1. 主题词汇」、其下条目又写「1. 2. 3.…」——
//    **同一样式跨级复用** → 层级不分。用户原话："序号规则，不是通用的吗？这里的序号，不同级的内容，序号样式一样。"
//    根因：该原则此前**只有题类**有一句局部规则（题干内分条不与题号层混同），**内容型完全没有**层级序号约束。
//    处置：提为全类型单源 NUMBERING_HIERARCHY_RULE（同层同构、异层异构），题类那句降为该原则下的细则。
describe('序号体系：同层同构、异层异构（全类型通用）', () => {
  const fmtOf = (genType, subject = '英语') => buildOutputFormatHint({ subject, stage: 'primary_high', genType });

  it('题类两分支与内容型都注入（内容型此前完全缺失 → 正是两层同用「1.」的来源）', () => {
    const cases = [['practice', fmtOf('practice')], ['exam', fmtOf('exam', '语文')], ['summary', fmtOf('summary')]];
    for (const [name, t] of cases) {
      expect(t, `${name} 缺序号体系`).toContain('序号体系（全类型通用）');
      expect(t, `${name} 缺判据`).toContain('同层同构、异层异构');
      expect(t, `${name} 缺跨级改法示例`).toContain('「(1)」「①」或项目符号');
    }
  });

  it('判据只讲层级与样式：不点资料类型名/题型名（可全类型广播、不诱导）', () => {
    const t = fmtOf('summary');
    const seg = t.slice(t.indexOf('序号体系（全类型通用）'), t.indexOf('序号体系（全类型通用）') + 200);
    expect(seg).not.toMatch(/选择题|判断题|填空题|简答题|写作题|知识总结|同步练习/);
  });

  it('题类细则仍保留（分条不是子题、不另配作答区），且不与其相抵', () => {
    const q = fmtOf('practice');
    expect(q).toContain('不与题号层混同');
    expect(q).toContain('这些分条不是子题，不为其另配作答区');
    expect(q).toContain('子题用 (1)(2)');
  });
});

// 🔴 2026-09-29（模型侧**去相抵/去限制**·用户追问"模型侧有没有限制？"）：
//   ⑤⑥ 原写"行内已含作答空位 → 不得再另起整行空白作答段""同题各小题形态须一致"，**都缺"同性质"限定** →
//   与**同一注入块内**的数学"竖式过程书写区（题后无线空白行）"、以及 longCarrier 的
//   "题干内短答空位 + 题后成句成段书写区"直接相抵（后者会被判违规 → 该给的长答载体被省掉 = 漏载体）；
//   ⑦ 结果位"留白不画线"与数学低段"可用「＝＿＿＿」/「＝（　）」定位"相抵。
//   三处一律只加"同性质 / 从其规定"限定，**判据换词不换**。
describe('题目自洽总纲 ⑤⑥⑦：去相抵（同性质限定 + 学科从规）（2026-09-29）', () => {
  const q = () => buildOutputFormatHint({ subject: '数学', stage: 'primary_mid', genType: 'practice' });

  it('⑤同性质：性质不同的载体并存不算重复（点名"结果位↔过程书写区"）', () => {
    const t = q();
    expect(t).toContain('行内已含**同性质**（判词：**所填内容的种类相同**');
    expect(t).toContain('性质不同者本就该并存');
    expect(t).toContain('过程书写区');
  });

  it('⑥同性质：已收口为引用（2026-09-30 判据级唯一出现）——判据本体仍在（作答位条款与⑤）', () => {
    const t = q();
    expect(t).toContain('同一题内同性质作答载体形态一致');
    expect(t).toContain('判据见作答位条款，此处不另立');
    expect(t, '⑥ 不得再自带形态判据原文（防第二处正句）').not.toContain('同一道题内**同性质**的作答载体形态须保持一致');
    expect(t, '"性质不同者并存不算混用"该要求未丢：⑤ 仍在').toContain('性质不同者本就该并存');
  });

  it('⑦结果位：学科条款另有规定的从其规定（消与数学低段"＝＿＿＿/＝（　）"相抵）', () => {
    expect(q()).toContain('低学段如需定位作答、而学科条款另有规定的，从其规定');
  });

  it('仍为形态表述：⑤⑥ 段不得出现题型名（防题型诱导回潮）', () => {
    const seg = q().slice(q().indexOf('⑤行内已含'), q().indexOf('⑦作答空位显式载体化'));
    expect(seg, '不得点题型名').not.toMatch(/选择题|判断题|填空题|简答题|计算题|应用题/);
  });
});

// 🔴 2026-09-29（用户实样实证）：「看拼音写词语」的情境句里**直接把待写词语写了出来**
//   （"小蝌蚪甩着长长的尾巴，在池塘里快活地游来游去。根据拼音写词语：chí táng"）→ 学生照抄即可、题目失效。
//   这是**内容自洽**缺口（判据只覆盖"材料→答案"三域，没有"题干不得泄漏答案"这一条）→ 补 ⑰。
describe('题目自洽总纲 ⑰：题干/情境不得出现待作答内容（防答案泄漏）（2026-09-29）', () => {
  const q = (g = 'practice', s = '语文') => buildOutputFormatHint({ subject: s, stage: 'primary_low', genType: g });

  it('⑰在位：题干与情境/材料不得出现待作答内容（要写的字词、要填的字、要答的要点）', () => {
    const t = q();
    expect(t).toContain('⑰题干与所给情境/材料里**不得出现本题待作答的内容**');
    expect(t).toContain('凡题干把答案写出来，该题即失效');
  });

  it('⑰例外在位：题面明示给出的待选材料/词库/选项是作答材料、不是答案', () => {
    expect(q()).toContain('**待选材料/词库/选项**是作答材料、不是答案，照常给出');
  });

  it('⑰随题类注入、不向内容型广播（与总纲同一广播边界）', () => {
    expect(q('summary')).not.toContain('⑰题干与所给情境');
  });

  it('⑰为性质表述：不枚举具体题型名', () => {
    const seg = q().slice(q().indexOf('⑰题干与所给情境'));
    expect(seg, '不得点题型名').not.toMatch(/选择题|判断题|填空题|简答题|看图写话/);
  });
});

// 🔴 2026-09-30（用户裁定·方向 A）：⑨ 与「并列对照子题除外」原为**互斥指令**——
//  ⑨ 说"并列子问须各自承担不同的考查角度/类别、两空题干与答案不得相同"；
//  而【质量底线】内容唯一性与尾约束·资料内多样都写"并列对照子题除外"（豁免同类/同数据）。
//  同一现象两处定性相反 → 模型收到互斥要求。裁定：⑨ **管辖域写明不含并列对照子题**，
//  三处同口径（对照类孪生小题属正常并列，不按雷同处理）。
describe('题目自洽总纲 ⑨：并列对照子题例外（2026-09-30）', () => {
  const q = (g = 'practice', s = '语文') => buildOutputFormatHint({ subject: s, stage: 'primary_high', genType: g });

  it('⑨ 明示例外，并与质量底线/资料内多样的同类豁免同口径（防互斥回潮）', () => {
    const t = q();
    expect(t).toContain('并列对照子题');
    expect(t).toContain('不按雷同处理');
    expect(t).toContain('与【质量底线】内容唯一性的同类豁免同一口径');
  });

  it('⑨ 原正面要求不因此丢失（并列子问仍须各有考查角度／分类题仍须 ≥2 类）', () => {
    const t = q();
    expect(t).toContain('⑨同题子问不得雷同：并列子问须各自承担不同的考查角度/类别，两空题干与答案不得相同');
    expect(t).toContain('分类题目须给出 ≥2 个不同类别空位，否则合并为一个空位');
  });

  it('例外只落在 ⑨ 段内，不扩散成"全篇可雷同"的口子', () => {
    const t = q();
    // ⚠️ 断言用 ⑨ 独有的措辞「不按雷同处理」——「并列对照子题」这个短语【质量底线】里也有
    //    （那正是要与之同口径的既有豁免），拿它当 ⑨ 的专属标记会误判。
    const clause = t.slice(t.indexOf('⑨同题子问'), t.indexOf('⑩题面语义自洽'));
    expect(clause).toContain('不按雷同处理');
    expect(t.slice(t.indexOf('⑩题面语义自洽'))).not.toContain('不按雷同处理');
  });

  it('内容型不注入 ⑨（题类块，与总纲同一广播边界）', () => {
    // 内容型拿不到 ⑨：其总量底线里有既有的「并列对照子题除外」，但不得出现 ⑨ 的例外措辞
    expect(q('summary')).not.toContain('不按雷同处理');
    expect(q('summary')).not.toContain('⑨同题子问');
  });
});
