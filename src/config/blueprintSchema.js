/**
 * 蓝图库 · 结构化 Schema
 * ============================================================
 * 🔴 定位：把蓝本 note 里的"排版/载体/格式词汇"抽成机器可读的载体字段（carrier），
 *    note 仍保留原文（生成注入零影响），此模块提供：
 *     1. CARRIERS —— 载体常量（供子页展示、未来骨架编译器读取）
 *     2. inferCarriers —— 从 大题名+note 自动推断载体（供展示）
 *     3. enhanceBlueprint —— 蓝本增强（补载体字段）
 * 迁移期审计清单已移除（迁移问题非最终方案，内容按四纪律在蓝本 note 中直接清洗）。
 * ============================================================
 */

/** 载体常量（统一口径，未来骨架编译器与渲染层共用） */
export const CARRIERS = {
  BLANK: 'blank',                 // 填空横线（<u class="blank-N">）
  BRACKET: 'bracket',             // 括号作答空 (　)
  MATCH: 'match',                 // 连线两列（match-question）
  ZUO_WEN_GE: 'zuo-wen-ge',       // 作文格/方格纸（写话/习作）
  SQUARE_GRID: 'square-grid',     // 作图方格纸（12列×8行）
  BRACKET_GRID: 'bracket-grid',   // 竖式格（3行书写区）
  TIAN_ZI_GE: 'tian-zi-ge',       // 田字格（低段写字）
  FOUR_LINE_THREE: 'four-line-three', // 四线三格（英语书写/拼音）
  TABLE: 'table',                 // 表格（信息转换/评分标准）
  BLANK_AREA: 'blank-area',       // 空白作答区（简答/解答/赏析/理由说明）
  DRAW_AREA: 'draw-area',         // 作图区（物理示意图/光路/电路）
  LISTENING_SCRIPT: 'listening-script', // 听力原文区（答案页）
  IMAGE: 'image',                 // [IMAGE] 配图标记
  GRAPH: 'graph',                 // [GRAPH] 图形标记
  FORMULA: 'formula',             // 公式 $..$ / $$..$$
};

export const CARRIER_LABELS = {
  [CARRIERS.BLANK]: '填空横线',
  [CARRIERS.BRACKET]: '括号',
  [CARRIERS.MATCH]: '连线',
  [CARRIERS.ZUO_WEN_GE]: '作文格',
  [CARRIERS.SQUARE_GRID]: '方格纸',
  [CARRIERS.BRACKET_GRID]: '竖式格',
  [CARRIERS.TIAN_ZI_GE]: '田字格',
  [CARRIERS.FOUR_LINE_THREE]: '四线三格',
  [CARRIERS.TABLE]: '表格',
  [CARRIERS.BLANK_AREA]: '空白区',
  [CARRIERS.DRAW_AREA]: '作图区',
  [CARRIERS.LISTENING_SCRIPT]: '听力原文区',
  [CARRIERS.IMAGE]: '配图',
  [CARRIERS.GRAPH]: '图形',
  [CARRIERS.FORMULA]: '公式',
};

const HAS = (text, re) => re.test(String(text || ''));

/**
 * 从 大题名+note 推断载体（迁移期增强；骨架编译器落地后由蓝本显式字段替代）
 * @param {string} name 大题名
 * @param {string} note 大题 note
 * @returns {string[]} carrier id 数组（去重）
 */
export function inferCarriers(name = '', note = '') {
  const t = `${name} ${note}`;
  const out = new Set();

  // 作文格（写话/习作/方格区——注意与作图方格纸区分）
  if (HAS(t, /作文|习作|写话|方格区|作文格|写作|zuo-wen-ge|书面表达|续写/) && !HAS(t, /作图|方格纸作答|square-grid/)) out.add(CARRIERS.ZUO_WEN_GE);
  // 作图方格纸（作图网格区/12列×8行方格纸）
  if (HAS(t, /作图网格|square-grid|方格纸作答|作图答题区/)) out.add(CARRIERS.SQUARE_GRID);
  // 竖式格
  if (HAS(t, /竖式|bracket-grid/)) out.add(CARRIERS.BRACKET_GRID);
  // 田字格
  if (HAS(t, /田字格|tian-zi/)) out.add(CARRIERS.TIAN_ZI_GE);
  // 四线三格
  if (HAS(t, /四线三格|four-line/)) out.add(CARRIERS.FOUR_LINE_THREE);
  // 连线
  if (HAS(t, /连线|连一连|match-question|匹配|连一连/)) out.add(CARRIERS.MATCH);
  // 配图
  if (HAS(t, /\[IMAGE\]|配图|看图/)) out.add(CARRIERS.IMAGE);
  // 图形
  if (HAS(t, /\[GRAPH\]|图形|统计图/)) out.add(CARRIERS.GRAPH);
  // 听力原文（答案页）
  if (HAS(t, /听力原文/)) out.add(CARRIERS.LISTENING_SCRIPT);
  // 表格
  if (HAS(t, /表格|填表|填写表格/)) out.add(CARRIERS.TABLE);
  // 填空横线
  if (HAS(t, /填空|横线|填词|填一填|默写|看拼音写|按课文内容填空|＿＿|___|写一写|口算|直接写得数|写出/)) out.add(CARRIERS.BLANK);
  // 括号（选择/判断/选字/排序等圈选类）
  if (HAS(t, /选择|判断|选字|选词|排序|涂色|打[√×✓]|单选|多选|不定项|\(　\)|（　）/)) out.add(CARRIERS.BRACKET);
  // 空白作答区（简答/解答/赏析/理由/说明/做法/应用/材料分析/论述/综合）
  if (HAS(t, /简答|解答|赏析|鉴赏|鉴赏题|说明理由|谈(?:谈|一谈)|说说|做法|应用|材料分析|论述|计算题|解决问题|综合运用|情景分析|情景辨析|实践|探究|实验|表达|口语交际|综合性学习|策略|归因|解法|预习|疑问/)) out.add(CARRIERS.BLANK_AREA);
  // 作图区（物理示意图/光路/电路）
  if (HAS(t, /作图|示意图|光路|电路/)) out.add(CARRIERS.DRAW_AREA);
  // 公式
  if (HAS(t, /公式|\$.*\$|方程/)) out.add(CARRIERS.FORMULA);

  return [...out];
}

/**
 * 增强蓝本视图：给每个 section 附加推断载体
 * @param {object} bp 蓝本对象（EXAM_BLUEPRINTS 条目）
 * @returns {object} 增强后的蓝本（sections 每项带 carriers 数组；不修改原对象）
 */
export function enhanceBlueprint(bp) {
  if (!bp || !Array.isArray(bp.sections)) return bp;
  return {
    ...bp,
    sections: bp.sections.map((s) => ({ ...s, carriers: inferCarriers(s.name, s.note) })),
  };
}

export default { CARRIERS, CARRIER_LABELS, inferCarriers, enhanceBlueprint };
