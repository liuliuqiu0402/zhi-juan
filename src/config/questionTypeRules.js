/**
 * 题型专项规则（Question Type Rules）—— 独立配置，兜底逐题路径用
 * ============================================================
 * 🔴 定位：从 instructionLib「生成-题型专项要求」（8条）迁出。
 *    仅服务兜底逐题生成路径（executeGenerationWithBlueprint 的 typeBlocks），
 *    正常生成（配方流水线）不经过。
 *    结构：{ genType, subjects?, stages?, content }，genType ∈ choice/fill/truefalse/calc/answer/word_problem/experiment/exam
 * ============================================================
 */

export const QUESTION_TYPE_RULES = [
  { id: 'block_type_choice', genType: 'choice',
    content: '- 🔴 选项必须完整列出：凡题干含"选一选""选词填空""选出正确答案"等选择指令的题目，必须在题干中或题干后完整列出所有供选择的选项/字词，严禁只写"选一选"而不给选项——学生无选项可选即为废题。\n- 选项数按学段要求（低段不超过3个，中高段及以上4个），各选项长度尽量一致、风格统一\n- 正确选项随机分布，不固定在某一位置\n- 错误选项应来自学生常见错误，有迷惑性但非明显错误\n- 不得使用"以上都是""以上都不对"' },
  { id: 'block_type_fill', genType: 'fill',
    content: '- 🔴 选字/选词填空必须给出备选字/词：凡题干含"选一选""选字填空""选词填空""选出正确的字/词填空"等指令的题目，必须在题干中或题干后完整列出所有备选字/词（如"备选字：园 圆 丛 从"），严禁只写"选一选"而不给选项——学生无选项可选即为废题。注意：此类题目虽含"填空"二字，但本质是选择题型，备选项是题目不可或缺的组成部分。\n- 每空考查一个独立的知识点\n- 空格设置在题干中自然出现的空位处（题干任意位置均可）\n- 答案必须唯一确定\n- 🔴 语义选择：书写类填空（看拼音写词语、选字填空、量词填空、按课文内容填空、结构分类、仿写填词等，学生需在横线上写答案）一律用横线 <u class="blank-N">&emsp;</u>；括号 <span class="blank-N">&emsp;</span> 仅用于选择题/判断题的"(　)"答案空（半角括号内全角空格）。⛔ 严禁书写类填空误用 span 括号（学生无法在括号上写字）。\n- 🔴 标签内必须填 &emsp;：严禁真空标签（<u class="blank-N"></u>）或只放一个空格（<u class="blank-N"> </u>）——&emsp; 数量按答案字数精确映射（见下）\n- 🎯 填空横线精确留空（含手写余量，已上调一档保证书写空间）：按答案字数使用CSS类\n  1字→ <u class="blank-2">&emsp;</u>\n  2字→ <u class="blank-4">&emsp;</u>\n  3-4字→ <u class="blank-6">&emsp;</u>\n  5-6字→ <u class="blank-8">&emsp;</u>\n  7-10字→ <u class="blank-10">&emsp;</u>\n  10字以上→ <u class="blank-10">&emsp;</u>\n- 括号（与横线互斥，二选一不可叠加）：用 <span class="blank-N">&emsp;</span>（勿加括号，CSS自动渲染——按答案字数精确映射：1字→2, 2字→3, 3字→4, 4字→5, 5-6字→6, 7-8字→8, 9-10字→10, 10字以上→10）\n- 方框：<span class="square-box">&emsp;</span>\n- ⛔ 严禁使用下划线字符：禁止使用 ___、____、______ 等连续下划线表示填空位置，只能使用上述 <u class="blank-N"> 或 <span class="blank-N"> 格式' },
  { id: 'block_exam_multiple_choice', genType: 'exam', subjects: ['数学', '物理', '化学', '生物'], stages: ['middle', 'high'],
    content: '- 多选题仅适用于中考/高考理科（数学/物理/化学/生物）卷的客观题部分，其他学科与小学不设多选题（全部单选/判断）\n- 单选与多选比例对照新课标真题（不得随意编排）：单选:多选≈7:3~2:1，多选 2-4 道、不超过单选数量一半——如高考数学 8 单选+4 多选（每题5分，漏选得2分、错选不得分）、高考物理 7 单选+3 多选（单选4分/多选5分）\n- 正确选项组合（如 AB、ACD、BCD）全卷分布随机：每个选项在正确组合中的出现次数尽量均衡，禁止正确答案集中在固定选项位（如多选答案总含 C、总含 AB）\n- 每道多选题固定 4 个选项，正确选项数 2-3 个（极少全选或单选）\n- 题干须明确作答规则："选出全部正确选项，多选、错选、漏选均不得分"（可注明"漏选得部分分"，对照当地中考/高考真题评分规则）' },
  { id: 'block_type_truefalse', genType: 'truefalse',
    content: '- 正确和错误的比例接近1:1\n- 错误说法应来自学生常见误区\n- 不得使用双重否定来制造难度' },
  { id: 'block_type_calc', genType: 'calc',
    content: '- 数据应合理，符合实际情况\n- 必须标注最终结果的单位\n- 如需取近似值，必须在题中明确精度要求' },
  { id: 'block_type_answer', genType: 'answer',
    content: '- 题目应有明确的解答指向（不是"谈谈你的看法"这种空泛设问）\n- 如有多个小问，难度应递进\n- 解答区域：题目下方用多个 <br> 换行留出书写空间（或用 <div style="min-height: 80px;"> 占位），⛔ 严禁用 blank-N 或 blank-line 做解答区——解答区是整块留白，不是填空横线' },
  { id: 'block_type_word_problem', genType: 'word_problem',
    content: '- 情境真实可信，数据合理\n- 明确要求写出"解""答"和关键步骤\n- 如有单位换算，需在题中给出换算关系' },
  { id: 'block_type_experiment', genType: 'experiment',
    content: '- 实验步骤应实际可行\n- 如涉及仪器，应写明仪器名称和规格\n- 明确要求写出实验现象和结论' },
];

/**
 * 按题型 genType 查询规则（兼容 subjects/stages 维度）
 */
export function getQuestionTypeRule({ genType = '', subject = '', stage = '' } = {}) {
  return QUESTION_TYPE_RULES.filter(r =>
    r.genType === genType &&
    (!r.subjects || r.subjects.includes(subject)) &&
    (!r.stages || r.stages.includes(stage))
  );
}

export default { QUESTION_TYPE_RULES, getQuestionTypeRule };
