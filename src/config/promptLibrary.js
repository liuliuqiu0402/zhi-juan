/**
 * 三维度指令库（Prompt Library）—— 年级 × 学科 × 资料类型
 * ============================================================
 * 🔴 定位：生成注入指令的唯一来源。所有注入模型的指令都来自本库
 *    （内置模板 + 用户自定义覆盖），用户可在生成模块的"注入指令框"中查看、编辑、保存。
 *
 * 匹配策略（按精确度降级）：
 *   grade×subject×genType 精确 → subject×genType → genType → 内置默认
 *
 * 模板含占位符（生成时替换）：
 *   {grade} {subject} {unit} {scope} {label} {structure} {fullScore} {duration} {material} {extra}
 *
 * 单一事实源原则（2026-08 全局收敛，同义表述只留一处）：
 *   - 作答空/横线/括号/连线/排版标记规范：仅 OUTPUT_FORMAT_BLOCK 一处定义，全部模板统一引用；
 *   - 卷面结构（exam）：由 buildStructureText 注入明细式（数据源：蓝图库），模板【卷面结构】为占位段；
 *   - 分值账目、填空宽度换算：由代码侧（examValidator/contentCleaner）兜底，模板只给一句话口径；
 *   - 质量底线（内容充足/内容正确/题集组织）：本文件统一定义，按 类型×学科×学段 三维度注入。
 * ============================================================
 */

import { isLibEntryEnabled } from '../utils/libToggles.js';
import { buildCarrierInstruction } from './layoutSpec.js'; // 书写载体条款按 学科×学段 生成（排版规格库唯一事实源）

/** 资料类型中文名（模板列表展示/任务行用）
 * 🔗 命名双轨·资料类型：key 须与 expertKnowledge.genTypeTemplates/genTypeOptions、TYPE_BASES、蓝图库类型 key 完全一致。
 *    新增/改名类型四处同步，否则模板命不中/面板失配。 */
export const GEN_TYPE_NAMES = {
  exam: '正式考卷', practice: '课时练', special: '专项突破', preview: '课前预习',
  reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '错题本', review: '复习资料',
};

/** 作答载体格式（题为主类型：填空/选择/书写载体/方格纸/作答区；全类型唯一定义处，模板统一引用）
 * 🔴 书写载体条款按 学科×学段 由排版规格库 WRITING_CARRIER 生成（buildCarrierInstruction），
 *    三维度 cell 组装时以 subject/stage 注入——田字格示例只进语文低段、四线三格示例只进英语中段、
 *    方格纸只进数学等允许学科，不再全学科广播（防跨学科/跨学段诱导）；
 *    无载体规则的学段（横线惯例/禁止格子）走通用句，不注入具体格子示例。 */
const HAS_EXPRESSION_QUESTIONS = ['语文', '英语']; // 存在写话/写作/抄写/表达类题的学科——写字/写作硬约束仅注入这些学科

/** 作答载体格式（题为主类型：填空/选择/书写载体/方格纸/作答区；全类型唯一定义处，模板统一引用）
 * 🔴 书写载体条款按 学科×学段 条件化组装（buildCarrierInstruction），三维度 cell 组装时以 subject/stage 注入：
 *    田字格/拼音格只进语文低段、四线三格只进英语中段、作图方格纸只进小学数学；
 *    "写字=废题""写作须完整呈现"硬约束只进存在写话/写作/抄写题的学科（语文/英语）；
 *    其余学科不注入任何格子/写字/写作词汇——杜绝跨学科/跨学段诱导。 */
const QUESTION_FORMAT = (ctx = {}) => {
  const carrier = (buildCarrierInstruction(ctx.subject, ctx.stage) || '').replace(/。$/, '');
  const hasEx = HAS_EXPRESSION_QUESTIONS.includes(ctx.subject);
  const clauses = [
    '填空空位（括号空位或横线）长度即留空宽度（系统按空位长度统一换算渲染宽度）；空格一律留足宽度、用规范留空标记，不得用紧贴文字的裸全角"（）"等无宽度占位；分值标注一律半角括号，如 "(每空2分)"，不得用中文全角括号做分值标注',
    '选择/判断类与填空按作答形式留空位',
  ];
  // 🔧 写字/抄写硬约束仅注入存在写话/写作/抄写题的学科（语文/英语，hasEx）；
  //    数学等学科方格纸载体只推作图条款，不注入"写字/抄写"词汇（防跨学科诱导）
  if (carrier) clauses.push(carrier);
  if (hasEx) {
    clauses.push('写字/抄写类题须真实输出对应书写载体，不得只写描述');
    // 🔧 "看拼音写词语→田字格→拼音在格上"为语文专属（拼音/田字格概念），英语只推四线三格（由 carrier 条款承载），
    //    不把语文措辞注入英语——防跨学科诱导
    if (ctx.subject === '语文') {
      clauses.push('看拼音写词语/写字/抄写类：逐空输出对应书写格（田字格），拼音逐字/逐词直接标注在对应书写格之上；禁止集中堆列"提示"拼音或空括号占位');
    }
    clauses.push('写作/表达类题须完整呈现题目要求（含写作要求），不得只有标题行');
  }
  clauses.push('任何作答载体一律输出在所属题目之后，不得置于题干之前');
  return `· 作答载体：按作答形式输出对应留空/载体结构，样式由系统渲染（${clauses.join('；')}）`;
};

/** 内容组织格式（内容型类型：结构化呈现，不用题号） */
const CONTENT_FORMAT = `· 内容用结构化呈现（表格/对比/导图优先），条目清晰；正文段落用 <p>，条目列表用 <ul><li> 或带序号（1）（2）；如需图表用 [GRAPH]/[IMAGE] 标记描述（格式见生成时注入的【渲染指令】）`;

/** 质量底线（按类型：正式卷 vs 教辅；在新课标"素养立意、教-学-评一致"基础上理解，不字面化） */
const EXAM_QUALITY = `【质量底线】（正式卷）
· 内容充足：题量与文字量与考试时长匹配，充实靠丰富题干信息、情境描述与思维层次；题干信息充分（情境/条件/要求完整），设问与答案对应
· 内容正确：图文一致（配图/图形与题干严格吻合）；逻辑自洽（条件充分、因果清晰、设问与答案对应）；知识点与能力要求不超出本学段课标学业质量要求——材料载体可来自课外（主题相关、难度适切本学段），设问对应的要求不超出课标学业质量；全部内容围绕本单元主题与考点（知识锚定教材单元）`;

const TEACHING_QUALITY = `【质量底线】（教辅资料）
· 内容充实：内容量与篇幅达到该类型底线，充实靠丰富题干信息、情境描述与思维层次；栏目完整，板块间不重复不雷同
· 内容正确：图文一致；逻辑自洽（条件充分、设问与答案对应）；知识点与能力要求不超出本学段课标学业质量要求；全部内容围绕本单元主题与知识点`;

/** 正式考卷基础模板（extra 为学科排版附加，学科模板复用本函数） */
const EXAM_BASE = (extra = '', ctx = {}) => `你是资深命题专家。请为{grade}{subject}命制一份{unit}正式试卷（满分{fullScore}分，考试时间{duration}）。

【卷面结构】（大题结构以系统注入的【卷面结构】为准；大题标题"共X题"中的 X 按你实际命制的题数填写）
{structure}

【创作要求】
1. 依据{curriculum}命题：素养立意、情境真实适切、设问有层次；情境与学科内容深度融合
2. 以{unit}为命题范围（本单元/本课/期中/期末等选定范围）：知识点与能力要求不超出本学段课标学业质量要求；选文、情境等载体可来自课外，但须主题相关、难度适切
3. 每道题题干完整、条件充分、逻辑自洽、可直接作答；所有题目原创设计，禁止照搬教材原题；题量与文字量与考试时长匹配，内容充实饱满
4. 需材料/选文的题目先给出完整材料再设问；需配图处用 [IMAGE] 标记描述画面
5. 全卷题目互相独立、不重复不雷同（同情境/数据/设问角度不得重复），题干数据与答案运算自洽；干扰项有真实迷惑性（来自学生常见错误）
6. 设问有层次、有梯度，考查理解与运用
7. 覆盖本单元课标学业要求（在情境中综合与变式呈现）；小题标题准确描述其作答形式

【卷面格式】（正式卷面必备）
· 卷首输出一个且仅一个 <h1> 占位标题（内容按当前范围写即可）；系统生成后统一替换为规范标题，正文不附加资料类型词
· 标题下接一行（考试时间：{duration}　满分：{fullScore}分），再写密封线（左侧竖排"密封线内不要答题"，含学校/班级/姓名/学号填写栏）
· 🔴 页码、分页由系统生成，正文不输出页码文字（答案归属见【输出格式】——正文严禁混入答案/解析）

【教材原文（命题取材依据；⚠️ OCR识别可能有误，以学科知识纠错后再命题；可改编情境，禁止照搬原句原题）】
{material}

${OUTPUT_FORMAT_BLOCK('exam', ctx)}${extra}`;

/** 输出格式块（按类型三维度：'exam' 正式卷带分值标注 / 'question' 题为主教辅 / 'content' 内容型不用题号；
 *  ctx 传 subject/stage 时书写载体条款按 学科×学段 生成（buildCarrierInstruction），无上下文走通用句） */
const OUTPUT_FORMAT_BLOCK = (mode = 'question', ctx = {}) => {
  const isContent = mode === 'content';
  // 🔴 大题名示例不带学科词（"识字与写字"只进语文蓝本明细，不广播到全学科 exam 格式示例）
  const head = mode === 'exam'
    ? '如 <h2>一、〈大题名〉</h2>，大题标题标注题量与分值'
    : isContent ? '如 <h2>一、知识框架</h2>，不标注分值'
    : '如 <h2>一、基础建构任务</h2>，不标注分值';
  const headLabel = isContent ? '栏目标题' : '大题标题';
  const itemRule = isContent
    ? '· 栏目用 <h2>；条目/知识点用 <p> 或 <ul><li> 呈现，编号用（1）（2）或 ①②'
    : '· 题目以 <p class="question"> 包裹并带题号（1. 2. 3.…），子题用 (1)(2)\n· 段落组织：每道题、每个任务（情境/活动/成果各条）独立成 <p> 段落，段间空行分隔；严禁把多个题目或条目堆叠在同一段落内';
  const fmt = isContent ? CONTENT_FORMAT : QUESTION_FORMAT(ctx);
  const quality = mode === 'exam' ? EXAM_QUALITY : TEACHING_QUALITY;
  return `

【输出格式】（结构清晰，便于排版导出）
· 大标题用 <h1>；${headLabel}用 <h2>（${head}）
${itemRule}
${fmt}
· 🔴 答案/解析/评分标准${HAS_LISTENING(ctx.subject) ? '/听力原文' : ''}仅出现在独立答案区（once 模式在正文之后，split 模式由系统单独生成）；题目区严禁混入任何答案/解析/评分标准${HAS_LISTENING(ctx.subject) ? '/听力原文' : ''}
${quality}`;
};

/* 质量底线三维度注入（2026-08）：
 *  - 类型维度 → 各类型模板【要求】尾部（如 practice 防机械重复/任务完整、special 分类分层变式、reading 语篇质量）
 *  - 学科维度 → SUBJECT_STAGE_EXTRAS 学科×学段要点（语境考查/说理/语篇/实验/材料题等学科底线）
 *  - 学段维度 → STAGE_EXAM_EXTRAS 学段特点（不超学段认知水平：低段已学内容、中高段进阶、初中能力立意、高中素养立意）
 *  不做"一股脑全模板补充"，三维度模板各自针对性携带底线。 */

/** 课时练基础模板（extra 为学科排版附加） */
const PRACTICE_BASE = (extra = '', ctx = {}) => `你是教辅编辑·课时练设计者。请为{grade}{subject}编写一份{unit}课时练习（依据{curriculum}）。

【创作要求】
1. 以学习任务组织，任务含真实情境+活动+成果
2. 覆盖{unit}核心知识点，栏目按生成时注入的【教辅结构】组织
3. 每道题/任务完整可作答、内容充实；任务之间不重复不雷同（换情境、换角度、换设问方式呈现变式）

【教材原文（取材依据）】
{material}

${OUTPUT_FORMAT_BLOCK('question', ctx)}${extra}`;

/** 全部资料类型的基础模板（函数，供三维度/学段组合生成） */
const TYPE_BASES = {
  exam: EXAM_BASE,
  practice: PRACTICE_BASE,

  special: (extra = '', ctx = {}) => `你是专项训练设计者。请为{grade}{subject}设计一份{unit}专项突破训练。

【创作要求】按考点分类组织（每类一个板块），类内按基础→提升→拓展分层，聚焦{unit}薄弱点，板块数与题量按生成时注入的【教辅结构】执行；同板块内题目不雷同（换情境/角度/设问呈现变式）；覆盖教材核心知识点；题目完整可作答。

【教材原文】
{material}

${OUTPUT_FORMAT_BLOCK('question', ctx)}${extra}`,

  preview: (extra = '', ctx = {}) => `你是课前预习设计者。请为{grade}{subject}设计一份{unit}课前预习任务单。

【创作要求】以问题驱动预读（设计少量可操作的预读任务，如圈画重点、尝试作答、记录疑问），可操作可检查；任务覆盖本课时全部新知识点；栏目以注入的【教辅结构】为准（须含"我的疑问"栏目）；紧扣教材原文。

【教材原文】
{material}

${OUTPUT_FORMAT_BLOCK('content', ctx)}${extra}`,

  reading: (extra = '', ctx = {}) => `你是阅读素养训练设计者。请为{grade}{subject}设计一份{unit}阅读训练。

【创作要求】原创短文（不复制课文/网络文章，课外选文主题须与{unit}相关），短文完整呈现（不截断），每篇配分层题，设问由浅入深；题目不可直接在原文找到原句答案；短文无语病；篇数/字数/题量按生成时注入的【教辅结构】执行。

【教材原文（主题参考）】
{material}

${OUTPUT_FORMAT_BLOCK('question', ctx)}${extra}`,

  summary: (extra = '', ctx = {}) => `你是知识总结编写者。请为{grade}{subject}编写一份{unit}知识总结。

【创作要求】结构化呈现（表格/对比/导图优先），覆盖{unit}全部知识点并标注教材出处，不遗漏；重点标注，文字精炼；栏目与篇幅按生成时注入的【教辅结构】执行。

【教材原文】
{material}

${OUTPUT_FORMAT_BLOCK('content', ctx)}${extra}`,

  dictation: (extra = '', ctx = {}) => `你是积累运用设计者。请为{grade}{subject}设计一份{unit}默写/积累纸。

【创作要求】要求掌握的基础内容置于语境或情境中呈现（不孤立罗列），严格对应教材要求，覆盖本单元全部要求掌握的内容，内容准确无误；覆盖量与栏目按生成时注入的【教辅结构】执行。

【教材原文】
{material}

${OUTPUT_FORMAT_BLOCK('question', ctx)}${extra}`,

  errorbook: (extra = '', ctx = {}) => `你是错题整理专家。请为{grade}{subject}设计一份{unit}错题本样例。

【创作要求】按知识点或错因分类组织（每类一个板块），每题结构按生成时注入的【教辅结构】执行（原题→归因→解法→变式→策略）；归因明确到知识点或思维环节。

【教材原文（素材参考）】
{material}

${OUTPUT_FORMAT_BLOCK('question', ctx)}${extra}`,

  review: (extra = '', ctx = {}) => `你是复习资料编写者。请为{grade}{subject}编写一份{unit}复习资料。

【创作要求】栏目以注入的【教辅结构】为准，覆盖{unit}全部知识点；结构化呈现；自测题分层（基础/提高），按考点分布。

【教材原文】
{material}

${OUTPUT_FORMAT_BLOCK('question', ctx)}${extra}`,
};

/** 内置模板：通用（按资料类型） */
const BUILTIN_TEMPLATES = {};
for (const [gType, base] of Object.entries(TYPE_BASES)) {
  BUILTIN_TEMPLATES[gType] = base('');
}

/** 学段中文名（面板显示）——五档 key（primary_low/primary_mid/primary_high/middle/high）为学段键唯一标准
 * 🔗 命名双轨·学段：key 须与 layoutSpec 载体表、SUBJECT_STAGE_EXTRAS/STAGE_EXAM_EXTRAS/STAGE_TEACHING_EXTRAS/STAGE_SUBJECTS、
 *    蓝图库学段 key、docxBuilder 三档归一化完全一致；新增/改学段须多处同步。 */
export const STAGE_NAMES = {
  primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段', middle: '初中', high: '高中',
};

/** 课标版本按学段（可查可引用）：义务教育=《义务教育课程方案和课程标准（2022年版）》，高中=《普通高中课程标准（2017年版2020年修订）》
 * 🔴 课标版本演进：本常量是课标版本唯一事实源——指令模板经 {curriculum} 占位符引用、
 *    生成链路（目录模式/知识图谱等）经 getCurriculumLabel 引用，新课标发布后只需更新本常量与
 *    SUBJECT_STAGE_EXTRAS/蓝图库/教辅结构库中的学科要求表述（新版本意味着学科内容与命题要求需人工核对，
 *    系统不自动追踪课标版本；指令库面板有版本声明与人工更新提示）。 */
export const CURRICULUM_BY_STAGE = {
  primary_low: '2022年版义务教育课程标准',
  primary_mid: '2022年版义务教育课程标准',
  primary_high: '2022年版义务教育课程标准',
  middle: '2022年版义务教育课程标准',
  high: '《普通高中课程标准（2017年版2020年修订）》',
};

/** 课标版本声明（指令库面板展示；版本演进时只改 CURRICULUM_BY_STAGE，此处文案同步核对） */
export const CURRICULUM_VERSION_INFO = {
  notice: '当前命题按学段课标版本：小学/初中=2022年版义务教育课程标准，高中=《普通高中课程标准（2017年版2020年修订）》。如教育部发布新课标，请人工核对并更新本库课标表述（系统不自动追踪课标版本）。',
  source: '义务教育：《义务教育课程方案和课程标准（2022年版）》（教育部 2022 年 4 月发布）；高中：《普通高中课程标准（2017年版2020年修订）》（教育部 2020 年修订发布）',
};

/**
 * 归一化学段键并返回该学段课标版本名（供生成链路目录模式/知识图谱等非指令库提示词使用）
 * @param {string} stage 学段键（primary_low 等）或中文标签（'小学'/'初中'/'高中'/'二年级'/'高一' 等）
 * @returns {string} 版本名；无法识别时返回 '本学段最新课标'（不阻断生成）
 */
export function getCurriculumLabel(stage = '') {
  const s = String(stage).trim();
  if (CURRICULUM_BY_STAGE[s]) return CURRICULUM_BY_STAGE[s];
  if (/高一|高二|高三|高中/.test(s)) return CURRICULUM_BY_STAGE.high;
  if (/初中|七年级|八年级|九年级/.test(s)) return CURRICULUM_BY_STAGE.middle;
  if (/一年级|二年级|低段/.test(s)) return CURRICULUM_BY_STAGE.primary_low;
  if (/三年级|四年级|中段/.test(s)) return CURRICULUM_BY_STAGE.primary_mid;
  if (/五年级|六年级|高段/.test(s)) return CURRICULUM_BY_STAGE.primary_high;
  if (/小学/.test(s)) {
    const g = parseInt(s.replace(/\D/g, ''), 10) || 0;
    return CURRICULUM_BY_STAGE[g >= 1 && g <= 2 ? 'primary_low' : g >= 3 && g <= 4 ? 'primary_mid' : 'primary_high'];
  }
  return '本学段最新课标';
}

/**
 * 学科×学段 命题要点（54 cell，语言按收敛方案：课标激活、简洁、不诱导、不列局限清单）
 * 键 = 学科|学段（仅实际开设组合）；值 = { text 命题侧重, source 课标出处（可查可引用） }。
 * 指令库三维度 cell（学段×学科×类型）组装时作为"学科层"注入（注入 text）。
 * source 对应课标条款名，维护时可据以核对原文，防止凭印象措辞混入。
 */
/** 三维度 学科×学段 要点（subject|stage 复合键）——
 * 🔗 命名双轨·键：`学科|学段` 两段须分别与 expertKnowledge.subjects、STAGE_SUBJECTS/五档学段 key（见 STAGE_NAMES 顶部）完全同名；
 *    只改上面 canonical 清单而漏更本复合键，对应学科/学段要点会静默漏注入。 */
export const SUBJECT_STAGE_EXTRAS = {
  // ── 语文 ──
  '语文|primary_low': { text: '识字写字在语境句中考（字词置于具体语句，不孤立罗列）；表达与交流兼顾口语交际与写话两种考查形式（口语交际可用情境对话、听要求选答等书面呈现；写话贴近生活、给情境与词语支架）。', source: '2022义教语文·第一学段识字与写字/阅读与鉴赏 + 语言文字积累与梳理任务群' },
  '语文|primary_mid': { text: '词句运用在真实语境中选填、仿写；阅读设问由浅入深、有层次；习作给选材与内容支架。', source: '2022义教语文·第二学段阅读与鉴赏/表达与交流（初步把握主要内容、乐于书面表达）' },
  '语文|primary_high': { text: '阅读含概括与简单评价；综合性学习结合教材主题组织；习作给选材支架与字数提示。', source: '2022义教语文·第三学段阅读与鉴赏（抓住要点）/表达与交流（记实与想象作文）' },
  '语文|middle': { text: '古诗文课内外对比阅读，重理解与积累运用；名著阅读设问有层次；作文立意明确、结构完整。', source: '2022义教语文·第四学段阅读与鉴赏（文言文借助注释工具书、名著阅读）/表达与交流（围绕表达中心）' },
  '语文|high': { text: '现代文、古代诗文阅读设问分层；语言文字运用重语境；作文准确理解材料、论证充分。', source: '高中语文课标(2017/2020)·语言建构与运用核心素养 + 思辨性阅读与表达任务群' },
  // ── 数学 ──
  '数学|primary_low': { text: '口算与简单应用结合生活情境；图形与量以直观操作呈现；问题解决列式、计算、作答完整。', source: '2022义教数学·第一学段学段目标（数的抽象、整数四则运算、长度测量）' },
  '数学|primary_mid': { text: '计算与竖式规范；概念与单位换算在情境中考查；应用题真实情境、列式计算作答完整。', source: '2022义教数学·第二学段学段目标（较复杂整数运算、数量关系）' },
  '数学|primary_high': { text: '计算与方程在情境中运用；几何与统计结合操作；应用题体现建模过程（理解→列式→计算→作答）。', source: '2022义教数学·第三学段学业质量描述（数感/符号意识/模型意识）' },
  '数学|middle': { text: '数与式、方程不等式、函数、几何、统计概率综合；解答题过程完整（推理链清晰）；应用题真实情境建模。', source: '2022义教数学·第四学段学段目标（数与式/方程与不等式/函数）+ 推理能力核心素养' },
  '数学|high': { text: '函数与导数、几何、概率统计综合；解答题逻辑严谨、步骤完整；开放设问考查数学表达与推理。', source: '高中数学课标(2017/2020)·必修内容 + 核心素养（数学抽象/逻辑推理/数学建模/直观想象/数学运算/数据分析）' },
  // ── 英语 ──
  '英语|primary_low': { text: '词汇在图片/情境中识别与认读；以听说认读为主，书写正确规范。', source: '2022义教英语·语言能力核心素养（感知与积累）' },
  '英语|primary_mid': { text: '词汇句型在语篇/情境中运用；书写规范。', source: '2022义教英语·语言能力核心素养（习得与建构）' },
  '英语|primary_high': { text: '语篇阅读与书面表达结合主题语境；设问由浅入深、有层次。', source: '2022义教英语·核心素养（语言能力/思维品质）' },
  '英语|middle': { text: '语篇完整地道（真实语境、无中式英语）；书面表达给要点支架；设问由浅入深、有层次。', source: '2022义教英语·核心素养（语言能力/文化意识/思维品质/学习能力）' },
  '英语|high': { text: '听力、阅读语篇真实地道；完形/语法在语篇语境中考查；应用文与续写设问清晰、给足信息。', source: '高中英语课标(2017/2020)·核心素养（语言能力/文化意识/思维品质/学习能力）' },
  // ── 物理 ──
  '物理|middle': { text: '实验探究体现完整过程；计算题真实情境建模（画示意→列式→计算→作答）；选择填空以生活/实验现象为载体。', source: '2022义教物理·课程理念（从生活走向物理）+ 核心素养（物理观念/科学思维/科学探究/科学态度与责任）' },
  '物理|high': { text: '受力、电路、光路图规范；实验题重原理与数据处理；计算题过程完整、步骤严谨。', source: '高中物理课标(2017/2020)·核心素养（物理观念/科学思维/科学探究/科学态度与责任）' },
  // ── 化学 ──
  '化学|middle': { text: '化学用语规范（配平/条件）；实验探究含方案、现象、数据、结论；计算题步骤完整。', source: '2022义教化学·核心素养（化学观念/科学思维/科学探究与实践/科学态度与责任）' },
  '化学|high': { text: '工艺流程与反应原理结合情境；实验探究重方案与评价；计算定量、步骤规范。', source: '高中化学课标(2017/2020)·核心素养（宏观辨识与微观探析/变化观念与平衡思想/证据推理与模型认知/科学探究与创新意识/科学态度与社会责任）' },
  // ── 生物 ──
  '生物|middle': { text: '识图与资料分析在图示情境中设问（结构→功能→原理）；实验探究含变量控制与结论。', source: '2022义教生物·核心素养（生命观念/科学思维/探究实践/态度责任）' },
  '生物|high': { text: '细胞代谢、遗传、调节等以图表情境设问；实验探究重设计与数据分析。', source: '高中生物课标(2017/2020)·核心素养（生命观念/科学思维/科学探究/社会责任）' },
  // ── 道德与法治 ──
  '道德与法治|primary_low': { text: '行为习惯与生活常识以情境辨析呈现；设问贴近生活、表达正向。', source: '2022义教道法·课程理念（坚持学科逻辑与生活逻辑相统一）' },
  '道德与法治|primary_mid': { text: '规则意识与行为选择在情境中辨析；设问要求做法＋理由。', source: '2022义教道法·核心素养（道德修养/法治观念/健全人格/责任意识）' },
  '道德与法治|primary_high': { text: '法律常识与价值判断以案例/时政为载体；实践探究给出做法并说明理由。', source: '2022义教道法·核心素养（法治观念/责任意识）' },
  '道德与法治|middle': { text: '情境探究与法理阐释结合；材料题以时政/法律案例为载体，要求结合所学分析。', source: '2022义教道法·核心素养（政治认同/道德修养/法治观念/健全人格/责任意识）' },
  // ── 思想政治 ──
  '思想政治|high': { text: '情境与法理结合、时政热点入题；材料分析沿原理→材料→结论；论述观点明确、分层论证。', source: '高中思想政治课标(2017/2020)·核心素养（政治认同/科学精神/法治意识/公共参与）' },
  // ── 历史 ──
  '历史|middle': { text: '材料题论从史出（结合材料+所学）；时空观念（地图/时间轴/图表）设问；论述观点+史料+论证。', source: '2022义教历史·核心素养（唯物史观/时空观念/史料实证/历史解释/家国情怀）' },
  '历史|high': { text: '史料实证与历史解释结合；论述题观点明确、论证严谨；选择题以史料/图表为载体。', source: '高中历史课标(2017/2020)·核心素养（唯物史观/时空观念/史料实证/历史解释/家国情怀）' },
  // ── 地理 ──
  '地理|middle': { text: '以地图/图表为载体设问；综合题沿区域定位→要素分析→人地关系；资料数据真实。', source: '2022义教地理·核心素养（人地协调观/综合思维/区域认知/地理实践力）' },
  '地理|high': { text: '区域认知与地理原理结合；综合题多要素分析；图表信息解读有层次。', source: '高中地理课标(2017/2020)·核心素养（人地协调观/综合思维/区域认知/地理实践力）' },
  // ── 科学 ──
  '科学|primary_low': { text: '观察与现象解释结合生活；记录题给记录表；操作型任务明确可做。', source: '2022义教科学·课程理念（激发学习动机，加强探究实践）' },
  '科学|primary_mid': { text: '实验探究含猜想、方案、现象、结论；填空选择结合生活现象。', source: '2022义教科学·核心素养（科学观念/科学思维/探究实践/态度责任）' },
  '科学|primary_high': { text: '实验探究重数据分析与结论；综合运用结合真实问题。', source: '2022义教科学·核心素养（科学观念/科学思维/探究实践/态度责任）' },
  '科学|middle': { text: '实验探究体现完整科学过程（变量控制/数据/结论）；综合运用跨学科、开放性设问。', source: '2022义教科学·核心素养（科学观念/科学思维/探究实践/态度责任）' },
  // ── 信息科技 ──
  '信息科技|primary_low': { text: '设备认知与用眼卫生以情境设问；操作步骤描述清晰。', source: '2022义教信息科技·第一学段内容模块（信息交流与分享/信息隐私与安全）' },
  '信息科技|primary_mid': { text: '在线学习与数字媒体结合场景；操作题描述流程步骤。', source: '2022义教信息科技·核心素养（信息意识/计算思维/数字化学习与创新/信息社会责任）' },
  '信息科技|primary_high': { text: '数据与算法初步结合场景；流程设计描述规范。', source: '2022义教信息科技·核心素养（信息意识/计算思维/数字化学习与创新/信息社会责任）' },
  '信息科技|middle': { text: '互联网应用与物联网结合场景；方案设计体现流程思维。', source: '2022义教信息科技·核心素养（信息意识/计算思维/数字化学习与创新/信息社会责任）' },
  '信息科技|high': { text: '数据与计算、信息系统结合真实任务；算法设计逻辑清晰。', source: '高中信息技术课标(2017/2020)·核心素养（信息意识/计算思维/数字化学习与创新/信息社会责任）' },
  // ── 音乐 ──
  '音乐|primary_low': { text: '音的高低长短、节奏快慢以情境设问；表现题可用圈选/配对/涂色呈现。', source: '2022义教艺术(音乐)·课程理念（重视艺术体验）' },
  '音乐|primary_mid': { text: '乐理常识与作品结合；简答沿要素→情感体验。', source: '2022义教艺术(音乐)·核心素养（审美感知/艺术表现/创意实践/文化理解）' },
  '音乐|primary_high': { text: '赏析沿要素→情感→文化理解递进；民族音乐与名曲结合。', source: '2022义教艺术(音乐)·核心素养（审美感知/艺术表现/创意实践/文化理解）' },
  '音乐|middle': { text: '中外名曲与体裁结合；赏析有层次、鼓励多元感受。', source: '2022义教艺术(音乐)·核心素养（审美感知/艺术表现/创意实践/文化理解）' },
  '音乐|high': { text: '音乐鉴赏与历史脉络结合；评价有依据、可思辨。', source: '高中音乐课标(2017/2020)·核心素养（审美感知/艺术表现/文化理解）' },
  // ── 美术 ──
  '美术|primary_low': { text: '造型语言与工具认识以感知呈现；表现题描述创作思路。', source: '2022义教艺术(美术)·核心素养（审美感知/艺术表现/创意实践/文化理解）' },
  '美术|primary_mid': { text: '造型/色彩/构图知识结合实例；赏析沿内容→形式→情感。', source: '2022义教艺术(美术)·核心素养（审美感知/艺术表现/创意实践/文化理解）' },
  '美术|primary_high': { text: '赏析结合中华优秀传统文化；设计应用题有明确要求。', source: '2022义教艺术(美术)·核心素养（审美感知/艺术表现/创意实践/文化理解）' },
  '美术|middle': { text: '中外美术名作结合赏析；评价有依据。', source: '2022义教艺术(美术)·核心素养（审美感知/艺术表现/创意实践/文化理解）' },
  '美术|high': { text: '美术鉴赏与设计原理结合；评价多元、有思辨。', source: '高中美术课标(2017/2020)·核心素养（图像识读/美术表现/审美判断/创意实践/文化理解）' },
  // ── 体育 ──
  '体育|primary_low': { text: '运动安全与生活习惯以情境设问；动作要领分步清晰。', source: '2022义教体育与健康·课程理念（坚持健康第一）' },
  '体育|primary_mid': { text: '运动规则与健康知识结合；动作要领在情境中描述。', source: '2022义教体育与健康·核心素养（运动能力/健康行为/体育品德）' },
  '体育|primary_high': { text: '运动技能与健康行为结合；安全防护说明到位。', source: '2022义教体育与健康·核心素养（运动能力/健康行为/体育品德）' },
  '体育|middle': { text: '运动原理与健康知识结合；锻炼方案合理可行。', source: '2022义教体育与健康·核心素养（运动能力/健康行为/体育品德）' },
  '体育|high': { text: '健康素养与体育文化结合；锻炼方案设计科学。', source: '高中体育与健康课标(2017/2020)·核心素养（运动能力/健康行为/体育品德）' },
};

/** 学段命题要点（5 学段全覆盖——正面引导，非禁令；末尾"认知底线"=不超学段认知水平）
 *  🔧 学科要点库（工具库）读取源 */
export const STAGE_EXAM_EXTRAS = {
  primary_low: { text: '情境游戏化（开火车/闯关/情境剧场）；图文并茂，需配图处用 [IMAGE] 标记；难度低起点，多数学生能完成；认知底线：难度与情境符合低段认知水平，不出现未学概念与抽象符号。', source: '2022义教课程方案（注重幼小衔接，小学低年级注重活动化、游戏化、生活化的学习设计）+ 课标学业质量要求（不超学段）' },
  primary_mid: { text: '情境生活化（购物/校园/旅行）；设问常规、分层递进；认知底线：难度与情境符合中段认知，不超前引入高段知识。', source: '2022义教课标学业质量要求（不超学段）+ 各科课标情境创设要求（真实情境/联系生活实际）' },
  primary_high: { text: '综合性强，阅读量加大；情境联系生活实际；增加开放性与思辨性设问，鼓励表达观点；认知底线：可适当开放思辨，但不超高段课标能力要求。', source: '2022义教课标学业质量要求（不超学段）+ 各科课标开放性设问要求' },
  middle: { text: '对标中考结构（题量/分值比例）；能力立意；情境真实（生活/社会/科技）；认知底线：能力要求对标中考课标，不超纲不超学段。', source: '中考命题原则（能力立意）+ 2022义教课标学业质量要求' },
  high: { text: '对标高考结构；素养立意（学科核心素养导向）；复杂真实情境+综合探究设问，体现区分度；认知底线：情境可复杂、设问可综合，但知识内容符合高中课标，不超学业质量要求。', source: '高考命题原则（素养立意）+ 高中课标学业质量要求' },
};

/** 有统一升学考试的学科（exam 学段特点注入"对标中考/高考结构"；其余学科按本学段学业质量要求，不注入考试结构语言） */
export const EXAM_TARGET_SUBJECTS = new Set(['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治', '思想政治']);

/** 学段组织特点（教辅版——不含考试结构语言，按类型三维度；认知底线=不超学段认知水平） */
export const STAGE_TEACHING_EXTRAS = {
  primary_low: { text: '情境游戏化、图文并茂；难度低起点，多数学生能完成；认知底线：难度与情境符合低段认知水平，不出现未学概念与抽象符号。', source: '2022义教课程方案（注重幼小衔接，小学低年级注重活动化、游戏化、生活化的学习设计）+ 课标学业质量要求（不超学段）' },
  primary_mid: { text: '情境生活化（购物/校园/旅行）；设问分层；认知底线：难度与情境符合中段认知，不超前引入高段知识。', source: '2022义教课标学业质量要求（不超学段）+ 各科课标情境创设要求（真实情境/联系生活实际）' },
  primary_high: { text: '综合性强，阅读量加大；情境联系生活实际；增加开放性与思辨性设问；认知底线：可适当开放思辨，但不超高段课标能力要求。', source: '2022义教课标学业质量要求（不超学段）+ 各科课标开放性设问要求' },
  middle: { text: '能力立意；情境真实（生活/社会/科技）；认知底线：能力要求对标本学段课标，不超纲不超学段。', source: '2022义教课标学业质量要求（对标本学段，不超学段）' },
  high: { text: '素养立意（学科核心素养导向）；复杂真实情境+综合设问；认知底线：知识内容符合高中课标，不超学业质量要求。', source: '高中课标学业质量要求（素养导向、不超学业质量）' },
};

/** 学段→学科 合理映射（按实际课程设置，非全矩阵——低段无物理/化学/生物/史地政等；
 *  学科名与 normalizeSubjectName 标准化产出一致：高中政治类=思想政治，初小=道德与法治）
 *  🔧 学科要点库（工具库）读取源
 *  🔧 学科数据键全学段统一（义教课标名优先）；高中课标名仍为"信息技术"（2022 义教课标不覆盖高中），键不变
 * 🔗 命名双轨·学科：清单须与 expertKnowledge.subjects（15 科 canonical）、SUBJECT_STAGE_EXTRAS 学科 key、layoutSpec.WRITING_CARRIER 键
 *    完全同名；新增/改学科只改 expertKnowledge.subjects，本处与载体键若漏更会静默失配（漏注入/剥离失效）。 */
export const STAGE_SUBJECTS = {
  primary_low: ['语文', '数学', '英语', '科学', '道德与法治', '音乐', '美术', '体育', '信息科技'],
  primary_mid: ['语文', '数学', '英语', '科学', '道德与法治', '音乐', '美术', '体育', '信息科技'],
  primary_high: ['语文', '数学', '英语', '科学', '道德与法治', '音乐', '美术', '体育', '信息科技'],
  middle: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治', '科学', '音乐', '美术', '体育', '信息科技'],
  high: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '思想政治', '音乐', '美术', '体育', '信息科技'],
};

/** 全部资料类型键（与 TYPE_BASES 一致） */
const ALL_GEN_TYPES = Object.keys(TYPE_BASES);

// 🔴 三维度 cell 预生成（学段×学科×类型，仅实际开设组合；一条全貌 = 类型基础 + 学科×学段要点 + 学段特点）
//    生成时 getPromptTemplate 直取 cell，无需运行时组装（用户自定义优先，其次内置 cell）
for (const [stage, subjList] of Object.entries(STAGE_SUBJECTS)) {
  for (const subj of subjList) {
    for (const gType of ALL_GEN_TYPES) {
      BUILTIN_TEMPLATES[`${stage}|${subj}|${gType}`] = buildBuiltinTemplate({ stage, subject: subj, genType: gType });
    }
  }
}

/**
 * 按三维度 cell 实时组装内置模板（源材料变化时重建 cell 用；预生成后直取，不重复组装）
 * @param {Object} opts { stage(学段键), subject(学科), genType(类型) }
 * @returns {string} 完整模板正文 = 类型基础模板 + 学科×学段要点 + 学段特点
 */
function buildBuiltinTemplate({ stage = '', subject = '', genType = '' } = {}) {
  const base = TYPE_BASES[genType] || TYPE_BASES.exam;
  const extra = [];
  // 学科×学段要点：全部 9 个资料类型都注入（内容型同样需要学科方向，非仅试卷/命题型）；
  // 仅当该学段实际开设该学科（如低段无物理/化学）且已提供学段时才注入；
  // SUBJECT_STAGE_EXTRAS 须与 STAGE_SUBJECTS 全覆盖对齐（54 组合），缺失组合开发期告警，不静默降级
  const stageOpensSubject = stage ? (STAGE_SUBJECTS[stage] || []).includes(subject) : false;
  if (subject && stageOpensSubject) {
    const cell = SUBJECT_STAGE_EXTRAS[`${subject}|${stage}`];
    if (cell) extra.push(`\n\n【${subject}·${STAGE_NAMES[stage] || stage}要点】\n${cell.text}`);
    else if (import.meta.env?.DEV) console.warn(`[promptLibrary] 缺学科×学段要点：${subject}|${stage}，须补齐 SUBJECT_STAGE_EXTRAS`);
  }
  // 学段特点按类型：exam 用考试结构版（对标中考/高考），教辅用组织呈现版（无考试结构语言）；
  // 认知底线为学段普适（所有学科不超本学段认知），呈现与学科差异由【学科·学段要点】承载
  const stageExtras = genType === 'exam' ? STAGE_EXAM_EXTRAS : STAGE_TEACHING_EXTRAS;
  const se = stageExtras[stage];
  if (stage && se) {
    // 🔧 对标中考/高考结构仅注入考试科目（三维度精确：非考试科目按本学段学业质量要求，不广播考试结构语言）
    let seText = se.text;
    if (genType === 'exam' && !EXAM_TARGET_SUBJECTS.has(subject)) {
      seText = seText
        .replace('对标中考结构（题量/分值比例）；', '')
        .replace('对标高考结构；', '')
        .replace('能力要求对标中考课标', '能力要求对标本学段课标');
    }
    extra.push(`\n\n【学段特点】\n${seText}`);
  }
  let tpl = base(extra.join(''), { subject, stage });
  // 🔧 课标版本按学段替换（{curriculum} 占位符：义务教育=2022年版，高中=2017年版2020年修订）；
  //    通用模板（无学段）保留占位符，由注入侧 buildInjectionInstruction 兜底替换
  if (stage && CURRICULUM_BY_STAGE[stage]) tpl = tpl.split('{curriculum}').join(CURRICULUM_BY_STAGE[stage]);
  return tpl;
}

/** localStorage 键 */
const LIB_STORAGE_KEY = 'wisdom_prompt_library_v1';

/** 读取用户自定义指令库（localStorage） */
function loadUserLibrary() {
  try {
    return JSON.parse(localStorage.getItem(LIB_STORAGE_KEY) || '{}');
  } catch { return {}; }
}

/** 保存用户自定义指令库 */
export function saveUserLibrary(lib) {
  try { localStorage.setItem(LIB_STORAGE_KEY, JSON.stringify(lib)); } catch {}
}

/**
 * 三维度匹配指令模板
 * @param {Object} opts { grade(学段键 primary_low 等), subject(规范学科名), genType(资料类型) }
 * @returns {{ id, name, template, source: 'user'|'builtin' }} 未命中返回内置默认（exam 兜底）
 */
export function getPromptTemplate({ grade = '', subject = '', genType = '' }) {
  const userLib = loadUserLibrary();
  // 1) 用户精确：grade+subject+genType（停用 → 落下一级）
  const exactId = `${grade}|${subject}|${genType}`;
  if (userLib[exactId]?.template && isLibEntryEnabled('instruction', exactId)) {
    return { ...userLib[exactId], id: exactId, source: 'user' };
  }
  // 2) 用户 subject×genType
  const subjId = `${subject}|${genType}`;
  if (userLib[subjId]?.template && isLibEntryEnabled('instruction', subjId)) {
    return { ...userLib[subjId], id: subjId, source: 'user' };
  }
  // 3) 用户 genType
  if (userLib[genType]?.template && isLibEntryEnabled('instruction', genType)) {
    return { ...userLib[genType], id: genType, source: 'user' };
  }
  // 4) 内置三维度 cell（学段×学科×类型，预生成直取；名称三维度中文；工具库停用该 cell → 落回 5) 学段×类型 模板）
  const stageKeyOf = (g = '') => {
    if (!g) return '';
    if (STAGE_NAMES[g]) return g;
    for (const [k, v] of Object.entries(STAGE_NAMES)) if (String(g).includes(v)) return k;
    return '';
  };
  const stageKey = stageKeyOf(grade);
  const cellId = stageKey && subject ? `${stageKey}|${subject}|${genType}` : '';
  const cell = cellId && BUILTIN_TEMPLATES[cellId];
  if (cell && isLibEntryEnabled('instruction', cellId)) {
    return { id: cellId, name: `${STAGE_NAMES[stageKey] || stageKey} · ${subject} · ${GEN_TYPE_NAMES[genType] || genType}`, template: cell, source: 'builtin' };
  }
  // 5) 内置 学段×类型（subject 缺省或该学段未开设该学科时回落）
  if (stageKey) {
    const template = buildBuiltinTemplate({ stage: stageKey, genType });
    return { id: `${stageKey}|${genType}`, name: `${STAGE_NAMES[stageKey] || stageKey} · ${GEN_TYPE_NAMES[genType] || genType}`, template, source: 'builtin' };
  }
  // 6) 内置 genType（类型基础模板兜底）
  const builtin = BUILTIN_TEMPLATES[genType] || BUILTIN_TEMPLATES.exam;
  const name = `内置·${GEN_TYPE_NAMES[genType] || genType}（通用模板）`;
  return { id: genType, name, template: builtin, source: 'builtin' };
}

/** 保存用户模板（genType 维度或三维度精确） */
export function savePromptTemplate(key, { name = '', template = '' }) {
  if (!key || !template) return false;
  const lib = loadUserLibrary();
  lib[key] = { name, template, updatedAt: Date.now() };
  saveUserLibrary(lib);
  return true;
}

/** 删除用户模板 */
export function deletePromptTemplate(key) {
  const lib = loadUserLibrary();
  if (lib[key]) { delete lib[key]; saveUserLibrary(lib); return true; }
  return false;
}

/**
 * 列出指令库条目（用户自定义 + 内置三维度 cell 486 条，名称三维度中文；一条 cell = 完整指令全貌）
 */
export function listPromptTemplates() {
  const userLib = loadUserLibrary();
  const out = [];
  // 用户自定义（覆盖 cell / 降级键）
  for (const [key, t] of Object.entries(userLib)) {
    if (t?.template) out.push({ key, ...t, source: 'user', layer: 'user' });
  }
  // 内置三维度 cell（486：学段×学科×类型，仅实际开设组合）
  for (const [key, template] of Object.entries(BUILTIN_TEMPLATES)) {
    const parts = key.split('|');
    if (parts.length !== 3) continue; // 只列三维度 cell（类型基础 9 不单独列）
    const [stage, subject, gType] = parts;
    out.push({
      key, id: key,
      name: `${STAGE_NAMES[stage] || stage} · ${subject} · ${GEN_TYPE_NAMES[gType] || gType}`,
      template, source: 'builtin', layer: 'cell',
    });
  }
  return out;
}

/**
 * 组装注入指令（最终形态，拼接顺序固定）：
 *   【任务】定位行（系统生成，固定最前）
 *   → 模板正文（指令库模板，占位符替换，用户可排版；学科排版已并入模板本体）
 *   → 【用户附加要求】（最后，优先级最高）
 * 教材原文由生成器在生成时按知识点检索后追加；渲染契约/质检规则/蓝图/教辅结构等附加块
 * 在注入时已并入注入框（用户可见可编辑）。
 * @param {Object} opts { template, grade, subject, unit, genTypeLabel, structure, fullScore, duration, extra }
 * @returns {string} 完整注入指令（注入框展示内容）
 */
export function buildInjectionInstruction(opts = {}) {
  const {
    template = '', grade = '', subject = '', unit = '', genTypeLabel = '',
    structure = '', fullScore = '', duration = '', extra = '', label = '', semester = '', academic = '',
    stage = '',
  } = opts;
  // 1) 任务定位行（系统生成，固定最前——模型第一眼知道要干什么）
  const taskLine = `【任务】生成${genTypeLabel || '资料'}：${subject}${grade}${unit ? `·${unit}` : ''}${fullScore ? `（满分${fullScore}分${duration ? `，时长${duration}` : ''}）` : ''}`;
  // 2) 模板正文（占位符替换；{material} 渲染为附加提示——真实素材由生成器按知识点检索后追加）
  let body = String(template || '');
  const map = {
    '{grade}': grade, '{subject}': subject, '{unit}': unit || '本单元', '{scope}': unit || '本单元',
    '{label}': label || genTypeLabel || '试卷', '{semester}': semester || '', '{academic}': academic || '',
    '{structure}': structure || '（按教材内容合理设计大题）',
    '{fullScore}': fullScore, '{duration}': duration,
    // 🔧 课标版本兜底：内置模板已按学段替换（buildBuiltinTemplate），此处覆盖用户自定义模板中的 {curriculum}，
    //    未传学段键时保持通用表述（与历史行为一致）
    '{curriculum}': CURRICULUM_BY_STAGE[stage] || '本学段最新课程标准',
    '{material}': '（教材原文由系统按本资料覆盖的知识点检索后，生成时自动附加在指令末尾）',
  };
  for (const [k, v] of Object.entries(map)) body = body.split(k).join(v);
  // 3) 用户附加要求（最后，优先级最高，可覆盖前序约束）
  let extraBlock = '';
  if (extra?.trim()) extraBlock = `\n\n【用户附加要求】\n${extra.trim()}`;
  return [taskLine, body, extraBlock].filter(Boolean).join('\n').trim();
}

/** 从蓝图生成卷面结构文本（明细式，供指令注入）；参数为 findBlueprint/getExamBlueprint 返回的蓝图对象
 *  注：大题标题"共X题"的 X 由模型按实际命制题数填写（题量是命题设计结果，非程序预知值）；
 *     分值/大题固定由蓝图确定，生成后由规则库 score 系列验算账目自洽（程序职责）。 */
export function buildStructureText(bp) {
  const sections = bp?.sections;
  if (!sections?.length) return '';
  return sections.map((s, i) => {
    const no = '一二三四五六七八九十'[i] || String(i + 1);
    const scorePart = s.score ? `，共${s.score}分` : '';
    return `${no}、${s.name}（共X题${scorePart}）${s.note ? `——${s.note}` : ''}`;
  }).join('\n');
}

/** 密封线（正式试卷卷首必备，后处理兜底注入——AI 未输出时由代码补） */
export function buildSealLineHeader() {
  return '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div></div>';
}

/** 非考试类资料（课时练/预习/总结等）的统一输出格式要求（系统级注入，模板不必重复写）——与 OUTPUT_FORMAT_BLOCK 同源，仅一处定义；
 *  书写载体条款按 学科×学段 注入（buildCarrierInstruction），供用户自定义模板缺【输出格式】时兜底；
 *  内容型资料（preview/summary）走 CONTENT_FORMAT（结构化，不用作答载体条款），避免污染 */
const CONTENT_GEN_TYPES = ['preview', 'summary'];
export function buildOutputFormatHint({ subject = '', stage = '', genType = '' } = {}) {
  const mode = CONTENT_GEN_TYPES.includes(genType) ? 'content' : 'question';
  return OUTPUT_FORMAT_BLOCK(mode, { subject, stage });
}

/** 学段键集合 */
const STAGE_KEYS = Object.keys(STAGE_NAMES);

/**
 * 模板筛选匹配（指令库面板三维度筛选共用逻辑；可测）
 * 每个维度独立严格匹配（AND）：
 *   ''     全部（不过滤该维度）
 *   '通用' 只看类型级通用模板（key 无维度限定，如 exam/practice——"通用模板"）
 *   具体值 精确匹配该维度（不含通用模板）
 * 示例：学科=通用 + 学段=小学低段 → 无交集 → 空白；学科=语文 + 学段=低段 → 只显示低段×语文×exam。
 * @param {{key:string}} tpl 模板
 * @param {{genType?:string, subject?:string, grade?:string}} f 筛选条件
 * @returns {boolean}
 */
export function matchTemplateFilter(tpl, f = {}) {
  const parts = String(tpl?.key || '').split('|').filter(Boolean);
  const isGenericTemplate = parts.length === 1; // 类型级通用模板（key 无维度限定）
  const p = { genType: parts[parts.length - 1] || '', subject: '', grade: '' };
  if (parts.length >= 2) {
    const prev = parts[parts.length - 2];
    if (STAGE_KEYS.includes(prev)) p.grade = prev;
    else p.subject = prev;
  }
  if (parts.length >= 3) p.grade = parts[parts.length - 3];
  // 严格维度匹配：'' 不过滤 / '通用' 只看通用模板 / 具体值 精确匹配（不含通用）
  const dim = (dimVal, v) => {
    if (!v) return true;
    if (v === '通用') return isGenericTemplate;
    return dimVal === v;
  };
  return dim(p.genType, f.genType) && dim(p.subject, f.subject) && dim(p.grade, f.grade);
}

/** 三维度 cell 具名导出（工具库/测试统计用） */
export { BUILTIN_TEMPLATES };

export default {
  BUILTIN_TEMPLATES,
  GEN_TYPE_NAMES,
  STAGE_NAMES,
  CURRICULUM_BY_STAGE,
  CURRICULUM_VERSION_INFO,
  getCurriculumLabel,
  getPromptTemplate,
  savePromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  buildInjectionInstruction,
  buildStructureText,
  buildSealLineHeader,
  buildOutputFormatHint,
  matchTemplateFilter,
};

// ============================================================
// 🔧 整卷生成端专用提示词（由 useAiGenerator 导入，统一在本库维护，避免散落代码常量）
// ============================================================

/** 是否含听力题的学科（答案页"听力原文"条款仅注入英语）
 * 🔧 function 声明而非 const 箭头：模块初始化时 OUTPUT_FORMAT_BLOCK 在 BUILTIN_TEMPLATES 组装阶段即被求值，
 *    const 箭头会触发"初始化前访问"TDZ 错误，函数声明整体提升保证初始化期可用 */
function HAS_LISTENING(subject = '') { return subject === '英语'; }

/** 整卷输出约定（按生成路径注入；once=正文+答案一次输出，split=正文禁答+答案页独立调用）
 * 🔴 听力原文仅英语学科答案页涉及，其余学科不注入（防跨学科噪音） */
export const PAPER_OUTPUT_CONVENTIONS = {
  once: (subject = '') => `【输出约定】本次输出完整试卷/资料正文，并在正文结束后另起一部分输出《参考答案与评分标准》/《参考答案与解析》：
· 答案区大题用 <h2>（如 <h2>参考答案与评分标准</h2>），逐题对应、注明分值；评分标准/等级表用 <table>${HAS_LISTENING(subject) ? '；听力题附完整听力原文' : ''}
· 严禁使用 ##、**、|表格 等 Markdown 语法；严禁 \`\`\` 代码块包裹；直接输出 HTML 内容`,
  split: (subject = '') => `【输出约定】本次只输出资料/试卷正文（题目、卷面与作答区）。严禁在正文中输出任何答案、解析、评分标准${HAS_LISTENING(subject) ? '、听力原文' : ''}——参考答案由系统在正文生成后单独调用生成。`,
};

/** 答案页角色（按资料类型：exam=阅卷专家+评分标准；其余=教辅编辑+参考答案与解析）
 * 🔴 作文/写话评分仅语英（表达类题）、听力原文仅英语，其余学科不注入 */
export const ANSWER_ROLES = {
  exam: (subject = '') => `你是阅卷专家。请为以下试卷逐题撰写完整《参考答案与评分标准》：每题给出答案与简要解析；选择题给正确选项${HAS_EXPRESSION_QUESTIONS.includes(subject) ? '；作文/写话给评分标准（等级描述+采分点）' : ''}。`,
  other: '你是教辅编辑。请为以下资料撰写完整《参考答案与解析》：选择题给正确选项；错题类附错误归因与正确解法；知识总结/预习类按栏目给出要点梳理与参考解答。',
};

/** 答案页 HTML 输出格式规范（与正文一致，便于排版导出） */
export const buildAnswerFormatSpec = (subject = '') => `【答案页输出格式】（HTML 规范，与正文一致，便于排版导出）
· 大题用 <h2>（如 <h2>一、〈大题名〉</h2>）；答案按题号与正文逐题对应（正文无题号的按栏目组织）再写答案与解析
· 评分标准/等级表用 <table> 表格${HAS_LISTENING(subject) ? '；听力题附完整听力原文' : ''}
· 严禁使用 ##、**、|表格 等 Markdown 语法；严禁 \`\`\` 代码块包裹；直接输出 HTML 内容`;
