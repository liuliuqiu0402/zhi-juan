// ==================== 真题卷结构蓝本库 ====================
// 根治目的：考卷（exam）的卷面骨架必须对齐最新课标落地后的全国主流真题卷，
//    不再由 AI 自由发挥题型。题型骨架、分值体系是确定性知识，不是创意空间。
//    蓝本基于人教统编教材配套真题卷（北京/浙江/江苏/广东等新课标命题区通行结构）归纳；
//    义务教育段依据 2022 年版课标，高中段依据 2017 年版（2020 年修订）课标（新高考结构）。
//
// 使用：promptLibrary.buildStructureText 对 genType=exam 注入本蓝本（大题/分值/时长固定，优先级高于指令库结构大纲）；
//      卷面格式细则与命题质量底线在指令库模板（EXAM_BASE）中定义，本库不重复。
// 单一事实源：分值规则唯一在 promptLibrary.buildStructureText 中定义（含大题命题要求 note）；卷面结构以**列式**给"题数 X｜分值 Y分"（命题依据），大题标题形态**由指令库分值条单源给**（全大题为一题时含单价）。
import { getRegionConfig } from './examRegionConfig.js';
import { isLibEntryEnabled } from '../utils/libToggles.js';
import { normalizeSubjectName } from './expertKnowledge.js'; // 学科×学段归名唯一事实源（别名+跨学段纠正，曾本地双表 SUBJECT_ALIAS/STAGE_SUBJECT_ALIAS 双轨）

/** 蓝图默认分值/时长兜底（保存用户蓝图、省市缩放分母等共用；曾散落 100/'60分钟' 字面量于多处） */
export const DEFAULT_EXAM_FULL_SCORE = 100;
export const DEFAULT_EXAM_DURATION = '60分钟';

/**
 * 学科×学段 → 真题卷题型骨架
 * key: `${subject}|${stage}`，stage ∈ primary_low / primary_mid / primary_high / middle / high
 * sections: { name 规范题型名, score 大题分值, note 命题要求 }
 */
/** 🔴 2026-10-11（T19·G9·消相抵）：卷面栏位注原写"本次范围X内容**都涉及到**"＝**全量覆盖**口径，与覆盖契约
 *   `COVERAGE_CONTRACT.exam === 'sampled'`（抽样命题、允许部分层级未出现、不补漏）**相抵**——模型据"都涉及到"
 *   会把整单元内容硬塞进卷（把"抽样"读成"必须全覆盖"）。现统一为**抽样口径**（判据与契约同源，单源一处措辞）。 */
const EXAM_COVERAGE_CN = (domain) => `覆盖本次范围${domain}领域的代表性知识点（抽样命题，不要求全量）`;

export const EXAM_BLUEPRINTS = {
  // ══════════════ 语文 ══════════════
  '语文|primary_low': {
    label: '语文·小学低段（1-2年级）', fullScore: 100, duration: '60分钟',
    sections: [
      // 2026-09-19 调研（一二年级实际流通纸笔卷）：低段以字词基础为主，写话仅 10-15 分且不会写的字可用拼音，
      //    口语交际无法纸笔化。原"表达与交流 30 分"接近中高段习作权重，超出低段实际 → 下调。
      { name: '识字与写字', score: 40, note: `${EXAM_COVERAGE_CN('识字与写字')}。` },
      { name: '积累与运用', score: 28, note: `${EXAM_COVERAGE_CN('积累与运用')}。` },
      { name: '阅读与鉴赏', score: 16, note: '课内课外阅读结合；选文标注出处。' },
      { name: '表达与交流', score: 16, note: '看图写话，结合本次范围主题；提供必要的词语支架，不会写的字可用拼音。' },
    ],
  },
  '语文|primary_mid': {
    label: '语文·小学中段（3-4年级）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '积累与运用', score: 30, note: `${EXAM_COVERAGE_CN('积累与运用')}。` },
      { name: '梳理与探究', score: 8, note: '对本次范围字词、所读信息作归类整理、图表梳理或简要归纳，在真实语境中考查梳理与探究能力。' },
      { name: '阅读与鉴赏', score: 26, note: '课内阅读与课外阅读结合，课外选文主题相关并标注出处。' },
      { name: '表达与交流', score: 36, note: '口语交际与习作结合本次范围主题；习作给选材支架。' },
    ],
  },
  '语文|primary_high': {
    label: '语文·小学高段（5-6年级）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '积累与运用', score: 32, note: `${EXAM_COVERAGE_CN('积累与运用')}。` },
      { name: '梳理与探究', score: 10, note: '对字词、阅读或材料信息作梳理分类、图表整理与归纳概括，含跨学科学习中的信息整理，考查梳理与探究能力。' },
      { name: '阅读与鉴赏', score: 24, note: '课内阅读与课外阅读结合，课外选文标注出处。' },
      { name: '表达与交流', score: 34, note: '跨学科学习与习作结合本次范围主题；习作给选材支架。' },
    ],
  },
  '语文|middle': {
    label: '语文·初中（中考结构）', fullScore: 120, duration: '120分钟',
    sections: [
      { name: '积累与运用', score: 24, note: '名句语境默写与基础运用。' },
      { name: '梳理与探究', score: 10, note: '对信息作梳理、图表归纳或围绕主题整理探究，考查梳理与探究能力。' },
      { name: '古诗文阅读', score: 22, note: '课内外对比阅读形式，重理解与积累运用。' },
      { name: '现代文阅读', score: 28, note: '课外选文标注出处。' },
      { name: '写作', score: 36, note: '命题/半命题/材料作文，提示语与写作要求。' },
    ],
  },
  '语文|high': {
    label: '语文·高中（新高考结构）', fullScore: 150, duration: '150分钟',
    sections: [
      // 卷面结构以 **2025 年全国卷官方卷面**为准（2026-09-19 调研）：原"现代文阅读/古代诗文阅读"
      //    两栏自 2025 年起已整合为一个「阅读」大题（阅读Ⅰ/Ⅱ＋文言文＋古代诗歌＋名篇名句默写），
      //    语言文字运用降为 18 分。各块分值逐年微调（如 2026 年阅读 74 分），总量稳定，故只锁总量。
      { name: '阅读', score: 72, note: '现代文、古诗文阅读与名篇名句默写' },
      { name: '语言文字运用', score: 18, note: '在语境中作答（不留答案）。' },
      { name: '写作', score: 60, note: '材料作文，准确理解材料、立意明确、论证充分。' },
    ],
  },

  // ══════════════ 数学 ══════════════
  '数学|primary_low': {
    label: '数学·小学低段（1-2年级）', fullScore: 100, duration: '60分钟',
    sections: [
      // 2026-09-19 调研（一二年级实际流通纸笔卷）：真实二年级卷**必设竖式/笔算题（8-18分）**，
      //    原骨架整题缺失（最实质缺项）；"直接写得数 20 / 看图列式 10"偏高、"填空 20"偏低 → 一并校正。
      { name: '直接写得数', score: 14, note: '口算，直接写得数。' },
      { name: '竖式计算', score: 12, note: '列竖式计算，要求书写规范；竖式书写区按作答载体规范留出' },
      { name: '填空', score: 24, note: '基础内容直接作答' },
      { name: '判断', score: 10, note: '概念与算法辨析' },
      { name: '选择', score: 10, note: '基础辨析' },
      { name: '操作题', score: 8, note: '动手操作；需作图的题留出相应作答区域' },
      { name: '看图列式计算', score: 6, note: '看图列出算式并计算' },
      { name: '解决问题', score: 16, note: '应用题，要求列式、计算并作答（写单位、写答语）' },
    ],
  },
  '数学|primary_mid': {
    label: '数学·小学中段（3-4年级）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '口算', score: 10, note: '口算，直接写得数。' },
      { name: '用竖式计算', score: 18, note: '竖式计算（含验算），要求书写规范；竖式书写区按作答载体规范留出' },
      { name: '填空', score: 20, note: '概念与技能的直接作答' },
      { name: '判断', score: 8, note: '概念辨析' },
      { name: '选择', score: 8, note: '基础辨析' },
      { name: '操作题', score: 6, note: '动手操作类；需动手画图的题留出作图区域' },
      { name: '解决问题', score: 30, note: '应用题，体现问题解决过程（列式、计算、作答完整）' },
    ],
  },
  '数学|primary_high': {
    label: '数学·小学高段（5-6年级）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '口算', score: 8, note: '口算，直接写得数' },
      { name: '脱式计算（能简算的要简算）', score: 18, note: '脱式计算（含简算），要求书写规范' },
      { name: '填空', score: 20, note: '概念、推理与度量的直接作答' },
      { name: '判断', score: 8, note: '概念辨析' },
      { name: '选择', score: 8, note: '基础辨析' },
      { name: '操作题', score: 8, note: '需动手画图的题留出作图区域' },
      { name: '解决问题', score: 30, note: '应用题，体现模型意识' },
    ],
  },
  '数学|middle': {
    label: '数学·初中（中考结构）', fullScore: 120, duration: '120分钟',
    sections: [
      { name: '选择题', score: 30, note: '4选1' },
      { name: '填空题', score: 18, note: '以计算推理为主' },
      { name: '解答题', score: 72, note: '含计算与推理；末题为压轴题，要求解答过程完整、步骤规范' },
    ],
  },
  '数学|high': {
    label: '数学·高中（新高考结构）', fullScore: 150, duration: '120分钟',
    sections: [
      { name: '单选题', score: 40, note: '4选1' },
      { name: '多选题', score: 18, note: '全对得分、部分选对得部分分' },
      { name: '填空题', score: 15, note: '以计算推理为主' },
      { name: '解答题', score: 77, note: '含计算与推理；末题为压轴题，要求解答过程完整、步骤规范' },
    ],
  },

  // 2026-10-02（④精准·以最终呈现结果为导向 + ⑥同实发去重）：原 11 处栏位 note 均带"，须真实、适切"——
  //   ① 它是**孤立形容词取向**（无对象/阈值/清单/算式，不可自判）→ ④ 不过；
  //   ② 同一份试卷实发内最多出现 3 次（听力选图/听音选答语/趣味任务）＋【质量底线】情境条 1 次 = **4 处同义** → ⑥ 不过。
  //   该取向的**判据与课标锚**已在【质量底线】"情境按考查意图选配…用情境；情境信息完整、可判、无歧义"
  //   单源承载（全类型恒注入）→ 11 处一律删该取向。
  // 🔴 2026-10-11（T11·G41）：同批保留的"内容由你按本卷内容选用／形式由你按本卷内容自定"（11 处）**一并删**——
  //   命题者（模型）本就自定内容与形式，逐栏复述是**冗余授权句**（同型 11 处＝多源）；判据（题量/难度/账目）
  //   另由正文与【卷面结构】承载，不依赖本句。
  // 🔴 2026-10-11（T11·G40）：栏位 note 里的"须给出配图/图形标记"（11 处、措辞不一）**一并删**——
  //   "模型须给出标记"的**要求**单源在正文【输出格式】的「图-题一致性」条款（"必须在题干后按注入的【渲染指令】
  //   紧跟输出 [IMAGE]/[GRAPH] 块"），**格式**单源在【渲染指令】段（eduRenderContract）；栏位注不必各写一遍。
  // ══════════════ 英语 ══════════════
  '英语|primary_low': {
    label: '英语·小学低段（1-2年级，个别一年级开课地区）', fullScore: 100, duration: '40分钟',
    sections: [
      // 2026-09-19 调研（上海/深圳等一年级开课地区的真实低段卷）：**听力占 60-70 分**，笔试仅 30-40
      //    且以"认读圈词、词图连线"为主，不设大分值抄写与选词补全对话 → 原"听力40/笔试60"权重颠倒，已校正；
      //    原"情景对话（选词补全对话）"接近三年级要求，已删；"趣味任务 20"无真实来源，降为 10。
      { name: '听力·听音选图', score: 20, note: '听简短词句选出对应图片；每段材料读两遍' },
      { name: '听力·听音判断', score: 15, note: '听句子判断图片或陈述正误；每段材料读两遍' },
      { name: '听力·听音排序', score: 15, note: '听词句给图片标序号；每段材料读两遍' },
      { name: '听力·听音选答语', score: 10, note: '听问句选出正确应答；每段材料读两遍' },
      { name: '笔试·看图连线', score: 10, note: '单词与图片连线' },
      { name: '笔试·认读选择', score: 15, note: '认读与词义辨识' },
      { name: '笔试·字母与词汇', score: 5, note: '字母大小写认读与抄写，书写规范' },
      { name: '笔试·趣味任务', score: 10, note: '操作型任务' },
    ],
  },
  '英语|primary_mid': {
    label: '英语·小学中段（3-4年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '听力·听音选词/选图', score: 10, note: '听词句完成选择；每段材料读两遍' },
      { name: '听力·听音判断', score: 5, note: '听句子/对话判断图片或句子正误；每段材料读两遍' },
      { name: '听力·听音选答语', score: 10, note: '听问句（含简短对话语境）选出正确应答；每段材料读两遍' },
      { name: '听力·听音排序', score: 10, note: '听一段对话或独白，按顺序给图片标序号；每段材料读两遍' },
      { name: '笔试·语音辨析', score: 6, note: '语音辨析（辨识发音差异）' },
      { name: '笔试·词汇运用', score: 8, note: '词汇运用（识别、拼写与归类）' },
      { name: '笔试·单项选择', score: 10, note: '语境中作答' },
      { name: '笔试·情景交际', score: 10, note: '选句补全对话' },
      { name: '笔试·连词成句', score: 8, note: '按正确语序排列句子，注意首字母大写与标点' },
      { name: '笔试·阅读理解', score: 15, note: '图文短文，判断或选择' },
      { name: '笔试·书写', score: 8, note: '抄写句子，四线三格规范书写' },
    ],
  },
  '英语|primary_high': {
    label: '英语·小学高段（5-6年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '听力·听音选词/选图', score: 10, note: '听词句完成选择；每段材料读两遍' },
      { name: '听力·听音判断', score: 10, note: '听简短对话判断句子正误；每段材料读两遍' },
      { name: '听力·听音填空', score: 10, note: '听一篇完整短文后补全信息，每空一词或短语；整篇材料读两遍' },
      { name: '笔试·语音辨析', score: 5, note: '语音辨析（辨识发音差异）' },
      { name: '笔试·词汇运用', score: 10, note: '词汇运用（识别、拼写与归类）' },
      { name: '笔试·单项选择', score: 15, note: '语境中作答' },
      { name: '笔试·情景交际', score: 10, note: '选句补全对话' },
      { name: '笔试·连词成句', score: 10, note: '按正确语序排列句子' },
      { name: '笔试·阅读理解', score: 10, note: '短文，选择与判断' },
      { name: '笔试·书面表达', score: 10, note: '根据提示写短文' },
    ],
  },
  '英语|middle': {
    label: '英语·初中（中考结构）', fullScore: 120, duration: '100分钟',
    sections: [
      { name: '听力', score: 25, note: '对话与短文理解（含信息提取，每空一词）；每段材料读两遍' },
      { name: '完形填空', score: 10, note: '语境理解' },
      { name: '阅读理解', score: 40, note: '选择＋任务型阅读（还原句子/回答问题）' },
      { name: '词汇运用', score: 10, note: '根据首字母或汉语提示填词，短文语境' },
      { name: '语法填空', score: 10, note: '短文语境作答' },
      { name: '书面表达', score: 25, note: '提示语给要点与格式要求' },
    ],
  },
  '英语|high': {
    label: '英语·高中（新高考结构）', fullScore: 150, duration: '120分钟',
    sections: [
      { name: '听力', score: 30, note: '短对话与长对话/独白；每段材料读两遍' },
      { name: '阅读理解', score: 50, note: '阅读＋七选五（还原句子）；设问围绕语篇内容' },
      { name: '完形填空', score: 15, note: '语篇语境作答' },
      { name: '语法填空', score: 15, note: '短文语境作答' },
      { name: '写作', score: 40, note: '应用文写作＋读后续写（给出前文与段首句，续写两段）' },
    ],
  },

  // ══════════════ 物理 ══════════════
  '物理|middle': {
    label: '物理·初中（中考结构）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '选择题', score: 36, note: '4选1，概念辨析' },
      { name: '填空题', score: 18, note: '现象分析、原理应用' },
      { name: '作图题', score: 8, note: '按本次范围涉及的作图类型命题' },
      { name: '实验探究题', score: 14, note: '方案设计、数据分析、结论表述' },
      { name: '计算题', score: 24, note: '要求解答过程完整、步骤规范' },
    ],
  },
  '物理|high': {
    label: '物理·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '单项选择题', score: 32, note: '4选1' },
      { name: '多项选择题', score: 18, note: '全对得分、选不全得部分分' },
      { name: '实验题', score: 18, note: '按本次范围涉及的实验命题' },
      { name: '计算题', score: 32, note: '要求解答过程完整、步骤规范' },
    ],
  },

  // ══════════════ 化学 ══════════════
  '化学|middle': {
    label: '化学·初中（中考结构）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '选择题', score: 30, note: '概念辨析' },
      { name: '填空题', score: 26, note: '概念与原理的直接作答' },
      { name: '实验探究题', score: 24, note: '方案设计、现象描述、数据分析、结论与反思' },
      { name: '计算题', score: 20, note: '定量计算，要求规范书写步骤' },
    ],
  },
  '化学|high': {
    label: '化学·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '单选题', score: 30, note: '4选1' },
      { name: '不定项选择题', score: 20, note: '全对得分、部分选对得部分分' },
      { name: '填空题', score: 18, note: '概念与原理的直接作答' },
      { name: '实验探究题', score: 16, note: '方案设计、数据处理、评价反思' },
      { name: '计算题', score: 16, note: '定量计算，要求规范步骤' },
    ],
  },

  // ══════════════ 生物 ══════════════
  '生物|middle': {
    label: '生物·初中（中考结构）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 50, note: '概念辨析' },
      { name: '非选择题', score: 50, note: '识图题考查结构与功能的关系；含资料分析与实验探究' },
    ],
  },
  '生物|high': {
    label: '生物·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '单选题', score: 48, note: '4选1' },
      // 🔴 2026-10-13（属主裁定·"真题只是框架"）：原 note 列过**教材模块名**（细胞代谢＝必修1、遗传与变异＝必修2；
      //   更早还列过选择性必修）——属**指定内容**，与"范围由用户勾选决定"相抵（勾选择性必修册次时反倒被要求出必修）。
      //   现只留**作答形态**；考什么内容一律由【锚点清单】所勾范围＋课标要点决定，蓝图不指定。
      { name: '非选择题', score: 52, note: '含实验探究类设问' },
    ],
  },

  // ══════════════ 道德与法治 / 思想政治 ══════════════
  '道德与法治|primary_low': {
    label: '道德与法治·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      // 2026-09-19 调研（统编版二年级真实纸笔卷）：以**填空（可达 30-40 分）**为主力题型，原骨架整题缺失；
      //    对应真实题型为"写一写/画一画""补充句子"（合计 20 以内），而"材料辨析"属中段以上用语、低段不设 → 已替换。
      { name: '填空', score: 30, note: '结合生活情境的填空题，不会写的字可用拼音' },
      { name: '判断', score: 20, note: '生活常识与行为习惯辨析' },
      { name: '选择', score: 15, note: '价值判断' },
      { name: '连线', score: 15, note: '做法与理由连线、行为与对错连线' },
      { name: '书面表达', score: 20, note: '围绕本次范围主题作书面表达，一两句话作答' },
    ],
  },
  '道德与法治|primary_mid': {
    label: '道德与法治·小学中段（3-4年级）', fullScore: 100, duration: '50分钟',
    sections: [
      { name: '判断', score: 20, note: '行为习惯与规则意识辨析' },
      { name: '选择', score: 30, note: '价值判断' },
      { name: '连线与分类', score: 10, note: '概念关联、行为分类' },
      { name: '材料分析', score: 20, note: '结合生活情境说明理由，简短作答' },
      { name: '实践探究', score: 20, note: '围绕身边问题，给出做法并说明理由' },
    ],
  },
  '道德与法治|primary_high': {
    label: '道德与法治·小学高段（5-6年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '判断', score: 16, note: '观点与价值判断' },
      { name: '选择', score: 30, note: '是非与价值判断' },
      { name: '材料分析', score: 24, note: '读案例或时政材料后分析说明，结合所学谈认识' },
      { name: '实践探究', score: 30, note: '围绕身边问题，提出做法并阐述理由' },
    ],
  },
  '道德与法治|middle': {
    label: '道德与法治·初中（中考结构）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '选择题', score: 32, note: '基础知识与价值判断' },
      { name: '判断题', score: 8, note: '观点辨析' },
      { name: '材料分析题', score: 60, note: '材料探究、法理阐释、实践应用（结合时政素材）' },
    ],
  },
  '思想政治|high': {
    label: '思想政治·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '选择题', score: 48, note: '基础理论与时政判断' },
      { name: '非选择题', score: 52, note: '原理阐释、材料分析、综合探究（结合时政热点）' },
    ],
  },

  // ══════════════ 历史 ══════════════
  '历史|middle': {
    label: '历史·初中（中考结构）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '选择题', score: 40, note: '以史料片段/时间轴/图表为载体的史实与概念辨析' },
      { name: '非选择题', score: 60, note: '材料解析、图表解读、论述探究，要求论从史出' },
    ],
  },
  '历史|high': {
    label: '历史·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '选择题', score: 48, note: '以史料为载体的概念辨析' },
      { name: '非选择题', score: 52, note: '材料解析、比较分析、开放论述（观点＋史料＋论证）' },
    ],
  },

  // ══════════════ 地理 ══════════════
  '地理|middle': {
    label: '地理·初中（中考结构）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 50, note: '以地图/图表为载体的概念辨析与空间定位' },
      { name: '综合题', score: 50, note: '读图分析、区域认知、人地协调观，以图表为载体；数据真实' },
    ],
  },
  '地理|high': {
    label: '地理·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '选择题', score: 48, note: '以地图/图表为载体的概念辨析与空间思维' },
      { name: '综合题', score: 52, note: '多要素分析、区域比较、人地协调观；数据真实' },
    ],
  },

  // ══════════════ 科学（小学 1-6 + 初中综合理科——浙江等地初中开科学课） ══════════════
  '科学|primary_low': {
    label: '科学·小学低段（1-2年级）', fullScore: 100, duration: '50分钟',
    sections: [
      { name: '填空', score: 15, note: '结合生活情境或配图的观察发现题' },
      { name: '选择', score: 20, note: '概念与现象判断' },
      { name: '判断', score: 20, note: '现象辨析' },
      { name: '连线', score: 10, note: '概念关联、分类匹配' },
      { name: '观察与探究', score: 20, note: '观察与探究过程' },
      { name: '简答', score: 15, note: '用一两句话说明现象或做法' },
    ],
  },
  '科学|primary_mid': {
    label: '科学·小学中段（3-4年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '填空', score: 16, note: '知识应用与现象解释' },
      { name: '判断', score: 10, note: '事实辨析、因果推理' },
      { name: '选择', score: 20, note: '概念与现象判断' },
      { name: '连线与排序', score: 10, note: '概念关联、实验步骤排序' },
      { name: '实验探究', score: 24, note: '方案设计、现象记录、数据分析、结论表述' },
      { name: '简答', score: 20, note: '用所学知识解释生活现象' },
    ],
  },
  '科学|primary_high': {
    label: '科学·小学高段（5-6年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '填空', score: 16, note: '原理应用与综合推理' },
      { name: '判断', score: 10, note: '事实辨析、推理评价' },
      { name: '选择', score: 20, note: '概念与现象判断' },
      { name: '实验探究', score: 24, note: '方案设计、数据分析、结论与评价' },
      { name: '综合运用', score: 30, note: '问题解决与跨学科概念运用，含开放性设问' },
    ],
  },
  '科学|middle': {
    label: '科学·初中（综合理科）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 20, note: '概念应用' },
      { name: '填空题', score: 16, note: '原理应用与现象解释' },
      { name: '判断题', score: 10, note: '事实辨析、推理评价' },
      { name: '实验探究题', score: 28, note: '方案设计、变量控制、现象记录、数据分析、结论评价（体现科学探究完整过程）' },
      { name: '综合运用题', score: 26, note: '问题解决与跨学科概念运用，含开放性设问与说理' },
    ],
  },

  // ══════════════ 信息科技（义教 2022 课标按学段内容差异大，5 档蓝本；高中档课标名=信息技术，数据键沿用统一名） ══════════════
  '信息科技|primary_low': {
    label: '信息科技·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '判断题', score: 16, note: '信息意识与行为判断' },
      { name: '选择题', score: 24, note: '概念与行为判断' },
      { name: '连线题', score: 20, note: '设备与用途、行为与对错连线' },
      { name: '操作题', score: 40, note: '以文字/图示描述简单操作步骤，配评分要点' },
    ],
  },
  '信息科技|primary_mid': {
    label: '信息科技·小学中段（3-4年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '选择题', score: 20, note: '概念与行为判断' },
      { name: '判断题', score: 16, note: '观点与行为辨析' },
      { name: '填空题', score: 16, note: '技术原理在数字化场景中运用' },
      { name: '操作题', score: 32, note: '以书面形式描述操作步骤、流程设计' },
      { name: '综合运用', score: 16, note: '解决真实数字化任务' },
    ],
  },
  '信息科技|primary_high': {
    label: '信息科技·小学高段（5-6年级）', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 20, note: '概念与行为判断' },
      { name: '判断题', score: 16, note: '概念与行为辨析' },
      { name: '填空题', score: 16, note: '数字化场景中的原理运用' },
      { name: '操作题', score: 32, note: '流程设计、数据处理步骤描述' },
      { name: '综合运用', score: 16, note: '真实任务' },
    ],
  },
  '信息科技|middle': {
    label: '信息科技·初中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 24, note: '概念与行为判断' },
      { name: '判断题', score: 12, note: '观点与行为辨析' },
      { name: '填空题', score: 16, note: '原理在场景中运用' },
      { name: '操作题', score: 28, note: '流程设计、方案描述' },
      { name: '综合题', score: 20, note: '任务解决' },
    ],
  },
  '信息科技|high': {
    label: '信息技术·高中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 24, note: '概念与行为判断' },
      { name: '填空题', score: 16, note: '原理在数字化场景中运用' },
      { name: '操作题', score: 32, note: '程序填空/流程图/数据处理描述' },
      { name: '综合题', score: 28, note: '算法设计与信息系统分析，配评分要点' },
    ],
  },

  // ══════════════ 音乐（按学段：低段听辨表现 → 高中鉴赏文化理解） ══════════════
  '音乐|primary_low': {
    label: '音乐·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '判断题', score: 20, note: '音的高低长短、节奏快慢、歌曲情绪' },
      { name: '选择题', score: 20, note: '听辨内容以文字/图谱形式呈现（无音频环境）' },
      { name: '连线题', score: 20, note: '乐器与声音、节奏型与动作连线' },
      { name: '表现题', score: 40, note: '以文字描述演唱/律动/节奏表现（无音频以图谱/节奏型识读），配评分要点' },
    ],
  },
  '音乐|primary_mid': {
    label: '音乐·小学中段（3-4年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '选择题', score: 24, note: '乐理常识、乐器识别、名曲主题' },
      { name: '判断题', score: 16, note: '音乐常识辨析' },
      { name: '填空题', score: 16, note: '音乐术语、节奏节拍' },
      { name: '连线题', score: 12, note: '乐器与分类、节奏型匹配' },
      { name: '简答题', score: 32, note: '作品赏析（音乐要素感知与情感体验），配评分要点' },
    ],
  },
  '音乐|primary_high': {
    label: '音乐·小学高段（5-6年级）', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 24, note: '乐理、乐器、名曲与民族音乐' },
      { name: '判断题', score: 16, note: '音乐常识辨析' },
      { name: '填空题', score: 12, note: '音乐要素与术语' },
      { name: '连线题', score: 8, note: '作品与民族/体裁连线' },
      { name: '简答题', score: 40, note: '赏析：要素分析、情感体验与文化理解，配评分要点' },
    ],
  },
  '音乐|middle': {
    label: '音乐·初中', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 28, note: '乐理、中外名曲、音乐体裁' },
      { name: '填空题', score: 16, note: '音乐要素与作品背景' },
      { name: '判断题', score: 16, note: '音乐常识辨析' },
      { name: '简答题', score: 40, note: '作品赏析（要素分析、情感体验与文化理解），配评分要点' },
    ],
  },
  '音乐|high': {
    label: '音乐·高中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 30, note: '音乐鉴赏、中外音乐史、民族音乐' },
      { name: '填空题', score: 20, note: '音乐要素、体裁与作品' },
      { name: '判断题', score: 10, note: '音乐常识辨析' },
      { name: '鉴赏题', score: 40, note: '鉴赏体现审美与情感体验，侧重依作品内容自定，配评分要点' },
    ],
  },

  // ══════════════ 美术（按学段：低段感知表现 → 高中鉴赏文化） ══════════════
  '美术|primary_low': {
    label: '美术·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '判断题', score: 20, note: '造型语言（点线面/色彩）、工具材料认识' },
      { name: '选择题', score: 20, note: '色彩与形状辨识' },
      { name: '连线题', score: 20, note: '工具与用途、颜色与情感连线' },
      { name: '表现题', score: 40, note: '以文字说明创作思路，配评分要点' },
    ],
  },
  '美术|primary_mid': {
    label: '美术·小学中段（3-4年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '选择题', score: 24, note: '造型/色彩/构图知识、美术常识' },
      { name: '判断题', score: 16, note: '美术常识辨析' },
      { name: '填空题', score: 16, note: '美术术语、造型原理' },
      { name: '连线题', score: 12, note: '作品与作者/材料与技法连线' },
      { name: '赏析题', score: 32, note: '赏析（内容、形式、情感），配评分要点' },
    ],
  },
  '美术|primary_high': {
    label: '美术·小学高段（5-6年级）', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 24, note: '造型表现、设计应用、欣赏评述常识' },
      { name: '判断题', score: 16, note: '美术常识辨析' },
      { name: '填空题', score: 12, note: '美术术语与原理' },
      { name: '连线题', score: 8, note: '作品与作者/流派连线' },
      { name: '赏析题', score: 40, note: '赏析（内容、形式、情感），结合中华优秀传统文化，配评分要点' },
    ],
  },
  '美术|middle': {
    label: '美术·初中', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 28, note: '造型/设计/欣赏知识、中外美术名作' },
      { name: '填空题', score: 16, note: '美术术语与流派' },
      { name: '判断题', score: 16, note: '美术常识辨析' },
      { name: '赏析题', score: 40, note: '赏析（内容、形式、情感），配评分要点' },
    ],
  },
  '美术|high': {
    label: '美术·高中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 30, note: '美术鉴赏、中外美术史、设计原理' },
      { name: '填空题', score: 20, note: '美术术语、流派与作品' },
      { name: '判断题', score: 10, note: '美术常识辨析' },
      { name: '鉴赏题', score: 40, note: '鉴赏体现由内容到形式的审美鉴赏，侧重依作品内容自定，配评分要点' },
    ],
  },

  // ══════════════ 体育（按学段：低段情境常识 → 高中运动技能与健康行为） ══════════════
  '体育|primary_low': {
    label: '体育·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '判断题', score: 20, note: '运动安全、生活习惯' },
      { name: '选择题', score: 20, note: '运动常识判断' },
      { name: '连线题', score: 20, note: '动作与要领、场景与做法连线' },
      { name: '简答题', score: 40, note: '在运动情境中描述正确做法，配评分要点' },
    ],
  },
  '体育|primary_mid': {
    label: '体育·小学中段（3-4年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '选择题', score: 24, note: '运动规则、健康知识、安全常识' },
      { name: '判断题', score: 16, note: '规则与安全常识辨析' },
      { name: '填空题', score: 16, note: '动作要领在运动情境中描述' },
      { name: '连线题', score: 12, note: '运动项目与规则要点连线' },
      { name: '简答题', score: 32, note: '动作要领描述、安全防护说明，配评分要点' },
    ],
  },
  '体育|primary_high': {
    label: '体育·小学高段（5-6年级）', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 24, note: '运动技能、健康行为、体育品德' },
      { name: '判断题', score: 16, note: '规则与健康常识辨析' },
      { name: '填空题', score: 12, note: '动作要领情境描述' },
      { name: '连线题', score: 8, note: '运动损伤与处理连线' },
      { name: '简答题', score: 40, note: '动作要领与安全防护，配评分要点' },
    ],
  },
  '体育|middle': {
    label: '体育·初中', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 28, note: '运动技能、健康知识、体育与健康常识' },
      { name: '填空题', score: 16, note: '动作要领与运动原理' },
      { name: '判断题', score: 16, note: '规则与健康常识辨析' },
      { name: '简答题', score: 40, note: '动作要领、锻炼方案与安全防护，配评分要点' },
    ],
  },
  '体育|high': {
    label: '体育·高中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 30, note: '运动技能、健康行为、体育品德' },
      { name: '填空题', score: 20, note: '运动原理与健康知识' },
      { name: '判断题', score: 10, note: '健康与安全常识辨析' },
      { name: '简答题', score: 40, note: '锻炼方案设计、健康行为养成，配评分要点' },
    ],
  },
};

/** 学段兜底链：无精确匹配时依次降级 */
const STAGE_FALLBACK = {
  primary_low: ['primary_mid', 'primary_high', 'middle'],
  primary_mid: ['primary_high', 'primary_low', 'middle'],
  primary_high: ['primary_mid', 'middle'],
  middle: ['high', 'primary_high'],
  high: ['middle'],
};

/**
 * 查询真题卷蓝本
 * @param {string} subject 学科名（未标准化也可：政治/道法/信息技术/体育与健康…）
 * @param {string} stage primary_low/primary_mid/primary_high/middle/high
 * @returns {{label:string, fullScore:number, duration:string, sections:Array, key:string}|null}
 * 用户自定义蓝本的**唯一事实源**是 blueprintProvider（saveUserBlueprint / loadUserBlueprints，
 *    localStorage 键 wisdom_blueprint_library_v1），由 findBlueprint 第 1 步**用户优先**短路命中后返回——
 *    本函数只管**内置蓝本 + 省市覆盖**，不再读任何第二套"用户条目"存储。
 *    （2026-09-27 收口：曾另建 userBlueprintOverrides 第二套 storage 并在本函数合并，与既有 saveUserBlueprint
 *     构成双事实源、且该模块全项目无写入方=永不生效、还会令"面板预览走 getExamBlueprint / 生成走 findBlueprint"
 *      两路不一致——已删除，收敛为单一事实源。）
 */
 export function getExamBlueprint(subject, stage, region) {
  if (!subject || !stage) return null;
  // 学科归名唯一事实源：expertKnowledge.normalizeSubjectName（含跨学段纠正：道法(小/初)@高中→思想政治、思想政治@小/初→道德与法治；
  // 曾本地维护 SUBJECT_ALIAS/STAGE_SUBJECT_ALIAS 两份表，与共享源同义双轨——已删除收敛）
  const stdSubject = normalizeSubjectName(subject, stage);
  const bpStage = String(stage).trim();
  let bp = null;
  const direct = EXAM_BLUEPRINTS[`${stdSubject}|${bpStage}`];
  if (direct) {
    bp = { ...direct, key: `${stdSubject}|${bpStage}`, subject: stdSubject, stage: bpStage };
  } else {
    // 学段降级链（2026-09-28：借格**不再静默**——组合不在"实际开设矩阵"内时留痕：
    //    入口已按 STAGE_SUBJECTS 约束学科候选，此处为兜底，防卷面骨架与所选学段不符而无人察觉）
    const chain = STAGE_FALLBACK[bpStage] || [];
    for (const st of chain) {
      const b = EXAM_BLUEPRINTS[`${stdSubject}|${st}`];
      if (b) {
        bp = { ...b, key: `${stdSubject}|${st}`, subject: stdSubject, stage: bpStage, borrowedFrom: st };
        console.warn(`[examBlueprint] ${stdSubject}|${bpStage} 不在实际开设矩阵内 → 借用 ${stdSubject}|${st} 的卷面骨架；请核对教材元数据的学段/学科`);
        break;
      }
    }
  }
  // 工具库启停开关：命中蓝本被停用 → 返回 null（生成端落回兜底，见 useAiGenerator）
  // 2026-09-28：不再静默——条目被停用即**无卷面结构**，必须留痕（console.warn），
  //    否则"工具库停用某条目"与"生成端无卷面骨架"两路现象无从关联，排查只能靠猜。
  if (bp && !isLibEntryEnabled('blueprint', bp.key)) {
    console.warn(`[examBlueprint] 蓝图条目「${bp.key}」已在工具库被停用 → 本次 exam 无卷面结构（生成端落回兜底）；如需恢复请在工具库面板启用该条目`);
    return null;
  }
  // 省市差异化：命中省市配置则覆盖时长/总分，并按比例缩放题型骨架分值（末大题修正保证各大题之和=新总分）
  // 配置 = 内置 EXAM_REGION_CONFIG + 用户蓝图库"省市分值"维护的覆盖（用户优先）
  if (bp && region) {
    const effConfig = getRegionConfig();
    const regMap = effConfig[region] && effConfig[region][bpStage];
    const rc = regMap && (regMap[stdSubject] || regMap[subject]);
    if (rc) {
      const duration = rc.duration || bp.duration;
      // ── 栏目级覆盖（2026-09-19 用户裁定）：省市**结构**确与全国骨架不同时才用 ──
      //   · 写明 sections → **整组替换**该科栏目；note 缺省按**同名栏目从蓝本继承**（少写一坨文案）。
      //   · 不写 sections → 沿用蓝本骨架，只做分值等比例缩放（原行为，覆盖绝大多数省市）。
      //   账目自洽不变量与纯分值缩放一致：栏目分值之和 ≠ 省市总分 → 按比例缩放 + 末栏修正。
      const regionSections = Array.isArray(rc.sections)
        ? rc.sections.filter((s) => s && String(s.name || '').trim() && Number(s.score) > 0)
        : [];
      if (regionSections.length) {
        const noteOf = (name) => {
          const hit = bp.sections.find((d) => String(d.name || '') === name);
          return (hit && hit.note) || '';
        };
        let sections = regionSections.map((s) => {
          const name = String(s.name).trim();
          return {
            name,
            score: Math.round(Number(s.score)),
            note: String(s.note || '').trim() || noteOf(name),
          };
        });
        const newTotal = Number(rc.fullScore) > 0 ? Number(rc.fullScore) : bp.fullScore;
        const sum = sections.reduce((a, c) => a + c.score, 0);
        if (sum !== newTotal) {
          sections = sections.map((s) => ({ ...s, score: Math.max(1, Math.round((s.score * newTotal) / sum)) }));
          const sum2 = sections.reduce((a, c) => a + c.score, 0);
          sections[sections.length - 1].score += newTotal - sum2;
        }
        bp = { ...bp, fullScore: newTotal, duration, sections };
      } else if (rc.fullScore && rc.fullScore !== bp.fullScore) {
        const defaultTotal = bp.fullScore || DEFAULT_EXAM_FULL_SCORE;
        const newTotal = rc.fullScore;
        const scaled = bp.sections.map(s => ({ ...s, score: Math.max(1, Math.round((s.score * newTotal) / defaultTotal)) }));
        const sum = scaled.reduce((a, c) => a + c.score, 0);
        scaled[scaled.length - 1].score += newTotal - sum; // 末大题修正
        bp = { ...bp, fullScore: newTotal, duration, sections: scaled };
      } else {
        bp = { ...bp, duration };
      }
    }
  }
  return bp;
}

/**
 * 蓝图栏目（块）的**性质**判定——'domain' / 'part' / 'item'（2026-09-27）
 * ============================================================
 * 用户裁定（2026-09-26）：蓝图结构里**有的能作大类层、有的不能**，须有区分；能作大类的正是与
 *   正规调研一致的那些（语文的课标内容领域/实践活动名；英语"听力·/笔试·"前缀）。
 * 为什么按**名称性质**判、不按学科名硬编码：性质是"名字本身"的属性——"积累与运用"说的是**学什么**、
 *   "听力·听音选图"的"听力"是**部分层**、"选择题/直接写得数"说的是**怎么作答**；按学科硬编码
 *   会漏掉将来新增的学科（与用户"不搞一刀切"的要求一致）。
 * 口径（与注入条款一致，见 promptLibrary 的【层级归并】）：
 *   · 'part'   —— 名内带"·"前缀（如"听力·听音选图"）→ 前缀归并为**部分层**（居中、无编号）
 *   · 'domain' —— 课标内容领域/实践活动名（如"积累与运用"）→ 作**大类层**
 *   · 'item'   —— 其余（题型/作答形式名，如"选择题""直接写得数"）→ **不设大类层**，块名即大题标题
 * 本判定是**唯一出口**，勿在别处另写一套名单。
 * @param {string} name 蓝图栏目的 name
 * @returns {'domain'|'part'|'item'}
 */
const DOMAIN_SECTION_RE = /^(?:识字与写字|积累与运用|梳理与探究|阅读与鉴赏|表达与交流|古诗文阅读|现代文阅读|语言文字运用|阅读|写作)$/;
export function sectionKindOf(name = '') {
  const n = String(name || '').trim();
  if (!n) return 'item';
  if (n.includes('·')) return 'part';
  if (DOMAIN_SECTION_RE.test(n)) return 'domain';
  return 'item';
}

export default {
  EXAM_BLUEPRINTS,
  getExamBlueprint,
};

