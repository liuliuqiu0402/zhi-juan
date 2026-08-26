/**
 * 蓝图库 · 结构化 Schema（迁移第一步）
 * ============================================================
 * 🔴 定位：把蓝本 note 里的"排版/载体/格式词汇"抽成机器可读的载体字段（carrier），
 *    note 仍保留原文（生成注入零影响），此模块提供：
 *     1. CARRIERS —— 载体常量（供子页展示、未来骨架编译器读取）
 *     2. inferCarriers —— 从 大题名+note 自动推断载体（迁移期用，免手工改 38 蓝本）
 *     3. AUDIT_ISSUES —— 迁移审计问题清单（语义/跨库重复/载体缺失，逐条可复核）
 * 后续骨架编译器（buildSkeleton）将读取 carrier 生成卷面骨架，届时 note 的格式词汇彻底移除。
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

/**
 * 迁移审计问题清单（来自蓝图库×其他库交叉审计，逐条可复核）
 * type: semantics=语义不严谨 · dup=跨库重复/矛盾 · carrier=载体缺失 · account=账目/口径
 * status: open=待处理 · fixed=已处理
 * 子页展示为"待修问题"，迁移完善时逐条勾销。
 */
export const AUDIT_ISSUES = [
  // ── 表A：语义不严谨/自相矛盾/过时素材 ──
  { code: 'A1', type: 'semantics', key: '语文|primary_low', section: '积累与运用', status: 'open',
    desc: '"红彤彤"与"绿油油"同为旧教材经典 ABB 词，一边禁一边荐自相矛盾；"一(　)星星"量词示例又是"换皮挖空"句式，与同条禁令冲突。',
    action: '删"红彤彤"，换真正新素材（如"亮晶晶的露珠"）；量词示例改为非挖空形式或删除。' },
  { code: 'A2', type: 'semantics', key: '语文|primary_low', section: '阅读与鉴赏', status: 'fixed',
    desc: '低段大题名含"鉴赏"，但学科条款明确"低段不考鉴赏"，名实不符；14分÷3-4题≈3.5-4.7分/题违反低段每题1-2分。',
    action: '低段大题改名"阅读"；写明小题切分（如5-7小题×2分）。' },
  { code: 'A3', type: 'account', key: '数学|primary_mid·口算 / primary_high·直接写得数', section: '', status: 'fixed',
    desc: '口算20题÷10分=0.5分/题，与"小学卷小题一律整数分"及 low-score-guard 冲突。',
    action: '口算题量减半（中段10题×1分、高段8题×1分），或分值规则为口算开0.5分例外并同步 low-score-guard。' },
  { code: 'A4', type: 'semantics', key: '语文|primary_low', section: '识字与写字', status: 'open',
    desc: '"禁止连续3题以上"与"禁止连续2道以上"同类阈值并存，口径不一。',
    action: '统一为"连续2题"或明确④指操作方式、⑤指格式。' },
  { code: 'A5', type: 'semantics', key: '语文|primary_low', section: '识字与写字', status: 'open',
    desc: '同一条 note 内"选字填空须给出备选字"③⑥重复表述。',
    action: '合并为一条，编号重整。' },
  { code: 'A6', type: 'semantics', key: '语文|primary_low/mid/high', section: '表达与交流', status: 'open',
    desc: '"须先查阅教材确认本单元口语交际主题"是生成端无法执行的操作指令；期中/期末无单元锚点。',
    action: '改为"口语交际话题取自已提供的教材原文/单元上下文，无教材时选取适龄生活话题"。' },
  { code: 'A7', type: 'semantics', key: '英语|high', section: '听力', status: 'open',
    desc: '高中语速"120-140"与括号"实测约139-146"矛盾，且与学科条款"高中120-140"口径不一。',
    action: '统一高中档为"130-145"或改括号注表述。' },
  { code: 'A8', type: 'account', key: 'EXAM_STAGE_STANDARDS.primary', section: '', status: 'open',
    desc: '"书写类填空合计≤18处"无量化口径，生成时无法核验。',
    action: '定义"书写类填空"可计数口径（哪些题型计入），或在蓝本注明不含看图写话。' },
  { code: 'A9', type: 'semantics', key: '数学|primary_low', section: '填空', status: 'open',
    desc: '"1元5角=___角"仍是进率换算，仅加数值包装，与学科条款"禁止孤立考查进率背诵"有张力。',
    action: '进率换算须给真实购物/找零情境载体，否则删此例。' },
  { code: 'A10', type: 'semantics', key: '信息科技|primary_low', section: '情境操作题', status: 'open',
    desc: '"保存文件"超出2022课标1-2年级水平；低段书面"文字描述"量大。',
    action: '操作点按课标低段收敛（开关机/用鼠标/礼貌用语），删"保存文件"。' },
  { code: 'A11', type: 'semantics', key: '音乐|primary_low', section: '表现题', status: 'open',
    desc: '低段40分全卷要求"文字描述"演唱/律动，与低段识字写字能力不匹配。',
    action: '允许圈选/连线/涂色等非文字方式呈现表现题。' },
  { code: 'A12', type: 'account', key: '英语|primary_low', section: '全卷', status: 'open',
    desc: '约45+小题 vs 学段条款"60分钟卷约25-35道小题"——40分钟低段卷题量显著超限。',
    action: '压缩笔试小题量或延长 duration 至60分钟。' },
  { code: 'A13', type: 'semantics', key: '语文|primary_low', section: '识字与写字', status: 'open',
    desc: '"拼音标声调含干扰项"表述含混（选项干扰还是填空标注？）。',
    action: '改为明确语义，如"读音辨析选项须含声调干扰项"。' },
  { code: 'A14', type: 'dup', key: '语文|primary_low', section: '识字与写字/积累与运用', status: 'open',
    desc: '"右列必须打乱"与 FORMAT_RULES"系统会自动打乱右列"直接冲突（系统渲染已打乱，暴露答案问题不存在）。',
    action: 'note 删除"打乱右列"全部表述，只留连线语义。' },

  // ── 表B：跨库重复/矛盾 ──
  { code: 'B1', type: 'dup', key: '连线类 note（17处）', section: '', status: 'open',
    desc: '"用match-question格式（见学科标记块）"悬空引用——"学科标记块"不存在；格式由 FORMAT_RULES + match-format-fix 单点定义。',
    action: 'note 删除格式引用，只留连线语义。' },
  { code: 'B2', type: 'dup', key: '语文 5 处（L123/131/139/148/157）', section: '作文格', status: 'open',
    desc: '`<div class="zuo-wen-ge">`+`<span>&emsp;</span>` HTML 与 FORMAT_RULES L35 重复；蓝本内部"空格格子"与"&emsp;"表述也不一致。',
    action: 'note 只留"作文格/方格纸"语义与行数，HTML 移渲染层。' },
  { code: 'B3', type: 'dup', key: '约22处', section: '[IMAGE]', status: 'open',
    desc: '"配图用 [IMAGE] 输出描述"重复声明，eduRenderContract.needsImageHint 已按关键词自动注入。',
    action: 'note 只留"配图"语义，标记块由渲染契约注入。' },
  { code: 'B4', type: 'dup', key: '历史|middle/high（L392/399）', section: '[GRAPH]', status: 'open',
    desc: '蓝本要求"[GRAPH] 统计图"，但历史不在 eduRenderContract.GRAPH_SUBJECTS——悬空引用。',
    action: '历史补入 GRAPH_SUBJECTS，或历史改"表格"呈现。' },
  { code: 'B5', type: 'dup', key: '英语 5 处', section: '听力原文', status: 'open',
    desc: '"听力原文放答案页供教师朗读"重复声明，学科条款英语#1 + ANSWER_ROLES 已是事实源。',
    action: 'note 删除该句，听力原文归答案页载体。' },
  { code: 'B6', type: 'dup', key: 'buildBlueprintInjection 分值规则', section: '', status: 'open',
    desc: '分值规则与 validatorRules.score-label-fix 提示几乎同文；G3 与 score-sum-guard 职责重叠。',
    action: '分值规则单点化，明确静态校验(G3) vs 生成后校验(score-sum-guard)边界。' },
  { code: 'B7', type: 'dup', key: 'EXAM_STAGE_STANDARDS vs STAGE_EXAM_EXTRAS', section: '', status: 'open',
    desc: '难度分布"6:3:1"等逐字重复，exam 生成时两组同时注入。',
    action: 'STAGE_EXAM_EXTRAS 删除与学段条款重复的条款，学段条款为唯一事实源。' },
  { code: 'B8', type: 'dup', key: 'EXAM_SUBJECT_STANDARDS vs SUBJECT_EXAM_EXTRAS', section: '', status: 'open',
    desc: '语文"禁止原句挖空"、英语"听力原文"、数学"禁止孤立考进率"等底线高度重复。',
    action: 'SUBJECT_EXAM_EXTRAS 保留教辅适用要点，删重复底线句；学科条款为唯一事实源。' },
  { code: 'B9', type: 'account', key: '作文格量化口径', section: '', status: 'open',
    desc: '格数（≥160格）/行数（8/15/18行）/字数（600/800字）三种口径并存且互相矛盾（低段8行≈80格<160格）。',
    action: '统一为字数口径（低段80-100/中段300/高段450/初中600/高中800字），渲染层换算格数。' },

  // ── 表C：载体缺失（迁移已通过 inferCarriers 补展示，待骨架编译器落盘） ──
  { code: 'C1', type: 'carrier', key: '语文|primary_low·识字与写字', section: '', status: 'open',
    desc: '低段写字须田字格、选字须括号/横线，note 未声明载体。', action: '声明 carrier: tian-zi-ge/blank/bracket。' },
  { code: 'C2', type: 'carrier', key: '数学|primary_mid·用竖式计算', section: '', status: 'open',
    desc: '仅三年级声明 bracket-grid，"四年级起直接留竖式书写区"未声明载体。', action: '声明 carrier: bracket-grid/blank-area。' },
  { code: 'C3', type: 'carrier', key: '英语|primary_low·字母与词汇', section: '', status: 'open',
    desc: '字母大小写/抄写单词必用四线三格，未声明。', action: '声明 carrier: four-line-three。' },
  { code: 'C4', type: 'carrier', key: '英语|middle·信息转换', section: '', status: 'open',
    desc: '听短文填表需要表格载体，未声明。', action: '声明 carrier: table + listening-script。' },
  { code: 'C5', type: 'carrier', key: '物理|middle·作图题', section: '', status: 'open',
    desc: '力的示意图/光路/电路需作图区，note 仅提 [IMAGE]。', action: '声明 carrier: draw-area + image。' },
  { code: 'C6', type: 'carrier', key: '科学|primary_low·观察与探究', section: '', status: 'open',
    desc: '观察记录题需记录表，蓝本未声明。', action: '声明 carrier: table（记录表）。' },
  { code: 'C7', type: 'carrier', key: '简答/赏析/情景分析/实践探究类大题', section: '', status: 'open',
    desc: '大量文字作答大题无空白区载体声明，依赖 OUTPUT_FORMAT 通用规则。', action: '骨架编译器按 f(分值,学段) 自动生成空白区。' },
];

export default { CARRIERS, CARRIER_LABELS, inferCarriers, enhanceBlueprint, AUDIT_ISSUES };
