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
 *   - 卷面结构（exam）：由蓝图库 buildBlueprintInjection 注入明细式，模板【卷面结构】不再重复细则；
 *   - 分值账目、填空宽度换算：由代码侧（examValidator/contentCleaner）兜底，模板只给一句话口径；
 *   - 质量底线（内容充足/内容正确/题集组织）：本文件统一定义，按 类型×学科×学段 三维度注入。
 * ============================================================
 */

/** 资料类型中文名（模板列表展示/任务行用） */
export const GEN_TYPE_NAMES = {
  exam: '正式考卷', practice: '课时练', special: '专项突破', preview: '课前预习',
  reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '错题本', review: '复习资料',
};

/** 作答空规范（全类型唯一定义处，模板统一引用，禁止他处再写一套；
 *  排版语义标记见规则库 text-format-fix，不在此重复） */
const FORMAT_RULES = `· 作答载体（系统按题型渲染，输出时与题干语义保持一致）：
  填空空位宽度与答案字数匹配（1字≈2格，长答案适当加长）；选择/判断用括号空位；
  写字题按题干要求的书写载体呈现；写话/作文的方格纸由系统在题干之后生成。`;

/** 质量底线（按类型：正式卷 vs 教辅；在新课标"素养立意、教-学-评一致"基础上理解，不字面化） */
const EXAM_QUALITY = `【质量底线】（正式卷）
· 内容充足：题量与文字量与考试时长匹配（充实靠丰富题干信息、情境描述与思维层次，严禁靠堆题、机械重复或套话凑数）；题干信息充分（情境/条件/要求完整），答案附解析
· 内容正确：图文一致（配图/图形与题干严格吻合）；逻辑自洽（条件充分、因果清晰、设问与答案对应）；知识点与能力要求不超出本学段课标学业质量要求——选文/情境等材料载体可来自课外（课外阅读、整本书、生活、科技、时政均为课标要求与鼓励方向），但材料难度适切本学段、设问指向的能力点在课标内；全部内容围绕本单元主题与考点（知识锚定教材单元），严禁离题内容`;

const TEACHING_QUALITY = `【质量底线】（教辅资料）
· 内容充实：题量与篇幅达到该类型底线（充实靠丰富题干信息、情境描述与思维层次，严禁靠堆题、机械重复或套话凑数）；栏目完整，板块间不重复不雷同
· 内容正确：图文一致；逻辑自洽（条件充分、设问与答案对应）；知识点与能力要求不超出本学段课标学业质量要求；全部内容围绕本单元主题与知识点，严禁离题内容`;

/** 正式考卷基础模板（extra 为学科排版附加，学科模板复用本函数） */
const EXAM_BASE = (extra = '') => `你是资深命题专家。请为{grade}{subject}命制一份{unit}正式试卷（满分{fullScore}分，考试时间{duration}）。

【卷面结构】（大题与分值固定，不得增删；由系统注入的真题蓝本明细式确定）
{structure}

【创作要求】
1. 依据2022版新课标命题：素养立意、情境真实适切、设问有层次，杜绝机械记忆与偏题怪题；按所选组织风格展开情境，情境与学科内容深度融合、贴近学生生活
2. 以{unit}为命题范围（本单元/本课/期中/期末等选定范围）：知识点与能力要求不超出本学段课标学业质量要求；选文、情境等载体可来自课外，但须主题相关、难度适切
3. 每道题题干完整、条件充分、逻辑自洽、可直接作答；所有题目原创设计，禁止照搬教材原题；题量与文字量与考试时长匹配，内容充实饱满
4. 阅读题先给出短文全文再设问（课外选文标注出处）；看图写话题用 [IMAGE] 标记描述画面（格式见生成时注入的【渲染指令】）
5. 全卷题目互相独立、不重复不雷同（同情境/数据/设问角度不得重复），题干数据与答案运算自洽；干扰项有真实迷惑性（来自学生常见错误）
6. 设问有层次：包含分析/评价/创造等认知层级的开放设问，考查素养而非机械记忆
7. 覆盖本单元课标要求的能力点（在情境中综合与变式呈现）；小题标题准确描述其作答形式

【卷面格式】（正式卷面必备）
· 卷首标题由系统注入（占位符命名），🔴 严禁再追加"考卷/试卷/测试"等任何资料类型词
· 标题下接一行（考试时间：{duration}　满分：{fullScore}分），再写密封线（左侧竖排"密封线内不要答题"，含学校/班级/姓名/学号填写栏）
· 作文/写话用方格纸（不少于160格）
· 🔴 页码、分页由系统生成，正文不输出页码文字（答案归属语义见【输出格式】唯一处——正文严禁混入答案/解析）

【教材原文（命题取材依据；⚠️ OCR识别可能有误，以学科知识纠错后再命题；可改编情境，禁止照搬原句原题）】
{material}

${OUTPUT_FORMAT_BLOCK(true)}${extra}`;

/** 输出格式块（按类型：exam 大题标注题量与分值；教辅不标分值——教辅不评分） */
const OUTPUT_FORMAT_BLOCK = (withScore = false) => `

【输出格式】（结构清晰，便于排版导出）
· 大标题用 <h1>；大题标题用 <h2>（${withScore ? '如 <h2>一、识字与写字（共X题，共32分）</h2>，标注题量与分值' : '如 <h2>一、基础建构任务</h2>，不标注分值'}）；题目以 <p class="question"> 包裹并带题号（1. 2. 3.…），子题用 (1)(2)
${FORMAT_RULES}
· 解答/简答题留足作答区；如适用：语文田字格 <span class="tian-zi-ge">字</span>、英语四线三格 <span class="four-line-three">a</span>
· 🔴 只输出资料正文（题目、卷面与作答区），严禁在正文中输出任何答案/解析/评分标准/听力原文（参考答案由系统在正文生成后单独调用生成）
${withScore ? EXAM_QUALITY : TEACHING_QUALITY}`;

/* 质量底线三维度注入（2026-08）：
 *  - 类型维度 → 各类型模板【要求】尾部（如 practice 防机械重复/任务完整、special 分类分层变式、reading 语篇质量）
 *  - 学科维度 → SUBJECT_EXAM_EXTRAS 学科要点（语境考查/说理/语篇/实验/材料题等学科底线）
 *  - 学段维度 → STAGE_EXAM_EXTRAS 学段特点（不超学段认知水平：低段已学内容、中高段进阶、初中能力立意、高中素养立意）
 *  不做"一股脑全模板补充"，三维度模板各自针对性携带底线。 */

/** 课时练基础模板（extra 为学科排版附加） */
const PRACTICE_BASE = (extra = '') => `你是教辅编辑·课时练设计者。请为{grade}{subject}编写一份{unit}课时练习（依据2022版新课标学习任务群）。

【创作要求】
1. 以学习任务组织（非题目堆砌），任务含真实情境+活动+成果
2. 覆盖{unit}核心知识点，栏目按生成时注入的【教辅结构】组织
3. 每道题/任务完整可作答、内容充实；任务之间不重复不雷同（换情境、换角度、换设问方式呈现变式）
4. 图文并茂，情境贴近学生生活

【教材原文（取材依据）】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK(false)}${extra}`;

/** 全部资料类型的基础模板（函数，供三维度/学段组合生成） */
const TYPE_BASES = {
  exam: EXAM_BASE,
  practice: PRACTICE_BASE,

  special: (extra = '') => `你是专项训练设计者。请为{grade}{subject}设计一份{unit}专项突破训练。

【创作要求】按题型或考点分类组织（每类一个板块），类内按基础→提升→拓展分层，聚焦{unit}薄弱点，板块数与题量按生成时注入的【教辅结构】执行；同板块内题目不雷同（换情境/角度/设问呈现变式）；覆盖教材核心知识点；题目完整可作答。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK(false)}${extra}`,

  preview: (extra = '') => `你是课前预习设计者。请为{grade}{subject}设计一份{unit}课前预习任务单。

【创作要求】以问题驱动预读（如"圈出你不认识的字""概括每段大意"），可操作可检查；任务覆盖本课时全部新知识点；栏目按生成时注入的【教辅结构】执行（含"我的疑问"栏目）；紧扣教材原文。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK(false)}${extra}`,

  reading: (extra = '') => `你是阅读素养训练设计者。请为{grade}{subject}设计一份{unit}阅读训练。

【创作要求】原创短文（不复制课文/网络文章，课外选文主题须与{unit}相关），短文完整呈现（不截断），每篇配分层题（信息提取→理解→评价）；题目不可直接在原文找到原句答案；短文无语病；篇数/字数/题量按生成时注入的【教辅结构】执行。

【教材原文（主题参考）】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK(false)}${extra}`,

  summary: (extra = '') => `你是知识总结编写者。请为{grade}{subject}编写一份{unit}知识总结。

【创作要求】结构化呈现（表格/对比/导图优先），覆盖{unit}全部知识点并标注教材出处，不遗漏；重点标注，不堆砌大段文字；栏目与篇幅按生成时注入的【教辅结构】执行。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK(false)}${extra}`,

  dictation: (extra = '') => `你是积累运用设计者。请为{grade}{subject}设计一份{unit}默写/积累纸。

【创作要求】在语境中默写（看拼音写词语有语境提示），减少孤立默写；严格对应教材要求，覆盖本单元全部要求掌握的字词/篇目；拼音/字形准确；覆盖量与栏目按生成时注入的【教辅结构】执行；书写格按学段：语文 1-2 年级用田字格、3 年级及以上用方格或横线，英语小学用四线三格、初中及以上用单线/横线。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK(false)}${extra}`,

  errorbook: (extra = '') => `你是错题整理专家。请为{grade}{subject}设计一份{unit}错题本样例。

【创作要求】按知识点或题型分类组织（每类一个板块），每题结构按生成时注入的【教辅结构】执行（原题→归因→解法→变式→策略）；归因禁止笼统写"粗心"。

【教材原文（题型参考）】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK(false)}${extra}`,

  review: (extra = '') => `你是复习资料编写者。请为{grade}{subject}编写一份{unit}复习资料。

【创作要求】栏目按生成时注入的【教辅结构】执行（知识框架→考点梳理→典型题析→易错聚焦→综合自测），覆盖{unit}全部知识点；结构化呈现；自测题分层（基础/提高），按考点分布。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK(false)}${extra}`,
};

/** 内置模板：通用（按资料类型） */
const BUILTIN_TEMPLATES = {};
for (const [gType, base] of Object.entries(TYPE_BASES)) {
  BUILTIN_TEMPLATES[gType] = base('');
}

/** 学段中文名（面板显示） */
export const STAGE_NAMES = {
  primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段', middle: '初中', high: '高中',
};

/** 学科命题要点（15 学科全覆盖——正面引导，非禁令；末尾"底线"为学科质量底线，非 exam 适用）
 *  🔧 学科要点库（工具库）读取源；与 EXAM_SUBJECT_STANDARDS（examPaperBlueprints）存在重复，迁移时定唯一事实源 */
export const SUBJECT_EXAM_EXTRAS = {
  语文: '· 识字写字：看拼音写词语嵌入语境句，不孤立考字；\n· 积累运用：词语/句段在真实语境中选填、仿写，不机械抄默；\n· 阅读：选文与{unit}主题相关，设问分层（信息提取→理解→评价）；\n· 写话/作文：贴近学生生活，有情境、有要求、有字数提示；\n· 默写/生字用田字格（一字一格）；写话/作文留方格纸（不少于160格）；\n· 底线：字词与课文内容考查置于语境中，禁止原句挖空与孤立罗列；阅读设问沿信息提取→理解→评价递进。',
  数学: '· 计算题标注"竖式/脱式/简便运算"格式，不纯计算堆砌；\n· 应用题有真实情境，要求列式+计算+作答（写单位、写答语）；\n· 作图题留方格纸作答区；\n· 图形/数据题用 [GRAPH] 简图（坐标/统计图与题干数据一致）；\n· 底线：应用题情境建模（阅读理解→列式→计算→作答），设问可含"为什么/说说你的想法"；禁止孤立考查概念定义与进率背诵。',
  英语: '· 词汇/句型放在语篇/情境中考查，不孤立默写；\n· 听力题在答案页附完整听力原文；\n· 选择题选项语法全部正确（不以语法错误制干扰项）；\n· 英文书写用四线三格；\n· 底线：听力与阅读语篇完整地道（真实语境、无中式英语、无语病），设问覆盖信息提取→推理判断→主旨概括。',
  物理: '· 作图题（力的示意图/光路图/电路图）题下留图区；\n· 计算题按"解→公式→代入→计算→答"步骤，带单位；\n· 实验题含方案设计/现象描述/数据分析；\n· 受力/电路/光路示意图用 [GRAPH] 简图；\n· 底线：实验探究体现完整过程（问题→方案→数据→结论）；选择/填空以生活情境或实验现象为载体，禁止孤立概念记忆。',
  化学: '· 化学式/方程式书写规范（配平、条件标注）；\n· 实验题标注装置与操作要点，装置用 [GRAPH] 简图描述；\n· 计算题步骤完整带单位；\n· 底线：实验探究含方案设计→现象描述→数据分析→结论反思；选择/填空以实验现象或生产生活情境为载体，禁止孤立概念记忆。',
  生物: '· 识图题（结构图/曲线图/流程图）用 [GRAPH] 简图描述；\n· 实验探究题含变量控制、现象描述与结论表述；\n· 结构—功能—原理相关联设问；\n· 底线：识图题在图示情境中设问（结构→功能→原理），禁止仅考结构名称单点记忆。',
  地理: '· 读图题（地图/气候图/等值线图）用 [GRAPH] 简图描述并给出图例；\n· 资料分析题数据真实，设问指向信息提取与地理联系；\n· 底线：以地图/统计图表/景观图为载体设问，综合题沿"区域定位→要素分析→人地关系评价"；禁止孤立概念记忆。',
  历史: '· 材料题先给材料（注明出处）再设问，答案由材料与所学结合得出；\n· 时间/事件/人物表述准确，体现时空观念；\n· 底线：材料题"论从史出"（结合材料+所学）；选择题以史料片段/时间轴/图表为载体，禁止孤立时间点记忆。',
  思想政治: '· 情境与法理结合，时政热点入题，设问指向政治认同、科学精神与法治意识；\n· 材料题先给材料（注明出处）再设问，答案须由材料与所学结合；\n· 辨析/论述题观点明确、逻辑分层、多角度思辨；\n· 观点表述准确规范，符合党和国家的大政方针；\n· 底线：材料分析沿"原理→材料→结论"规范表述，设问开放鼓励多元视角。',
  道德与法治: '· 情境辨析题（看图/读材料后说说怎么做）一句话作答；\n· 案例/情境贴近学生生活，观点正确积极；\n· 底线：设问要求"做法＋理由"（知行合一），材料题选用贴近学段的时政素材与法律案例。',
  科学: '· 观察记录题留记录表；\n· 实验探究题含猜想/方案/现象/结论；\n· 图表用 [GRAPH] 简图（柱状/折线）；\n· 底线：探究题体现"观察→记录→分析→结论"完整过程；填空/选择结合生活现象或配图情境，禁止孤立科学名词填空。',
  信息科技: '· 流程图用规范图形；代码块逐行展示；\n· 结合真实应用场景命题；\n· 底线：以数字化学习与生活场景为载体，操作题考查步骤描述与流程设计；禁止孤立概念名词记忆。',
  音乐: '· 乐理符号规范书写；\n· 听辨/演唱/节奏题要求清晰可执行；\n· 底线：欣赏题设问沿"要素分析→情感体验→文化理解"递进；曲名/作者类纯记忆题全卷不超过2题。',
  美术: '· 造型/色彩/构图题明确工具与要求；\n· 欣赏评述题给出作品基本信息；\n· 底线：赏析题沿"内容→形式→情感"递进，结合中华优秀传统文化。',
  体育: '· 动作要领分步表述；\n· 安全提示到位；\n· 结合学生生活实际命题；\n· 底线：填空/选择在运动情境中设问（如"原地高抬腿时，上体应保持____"），禁止孤立术语名词填空。',
};

/**
 * 学科×学段 命题要点（54 cell，语言按收敛方案：课标激活、简洁、不诱导、不列局限清单）
 * 键 = 学科|学段（仅实际开设组合）；内容 = 该学科该学段的命题侧重（学科特性 + 学段差异）。
 * 指令库三维度 cell（学段×学科×类型）组装时作为"学科层"注入。
 */
export const SUBJECT_STAGE_EXTRAS = {
  // ── 语文 ──
  '语文|primary_low': '识字写字在语境句中考（字词置于具体语句，不孤立罗列）；写话贴近生活、给情境与词语支架；用田字格规范书写。',
  '语文|primary_mid': '词句运用在真实语境中选填、仿写；阅读设问沿信息提取→理解→评价递进；习作给选材与内容支架。',
  '语文|primary_high': '阅读含概括与简单评价；综合性学习结合教材主题组织；习作二选一，给支架与字数提示。',
  '语文|middle': '古诗文课内外对比阅读，重理解与积累运用；名著阅读设问有层次；作文立意明确、结构完整。',
  '语文|high': '现代文、古代诗文阅读设问分层；语言文字运用重语境；作文准确理解材料、论证充分。',
  // ── 数学 ──
  '数学|primary_low': '口算与简单应用结合生活情境；图形与量以直观操作呈现；问题解决列式、计算、作答完整。',
  '数学|primary_mid': '计算与竖式规范；概念与单位换算在情境中考查；应用题真实情境、列式计算作答完整。',
  '数学|primary_high': '计算与方程在情境中运用；几何与统计结合操作；应用题体现建模过程（理解→列式→计算→作答）。',
  '数学|middle': '数与式、方程不等式、函数、几何、统计概率综合；解答题过程完整（推理链清晰）；应用题真实情境建模。',
  '数学|high': '函数与导数、几何、概率统计综合；解答题逻辑严谨、步骤完整；开放设问考查数学表达与推理。',
  // ── 英语 ──
  '英语|primary_low': '词汇在图片/情境中识别与认读；听力原文完整呈现；书写用四线三格规范。',
  '英语|primary_mid': '词汇句型在语篇/情境中运用；听力原文完整呈现；书写规范（四线三格）。',
  '英语|primary_high': '语篇阅读与书面表达结合主题语境；听力原文完整呈现；设问覆盖信息提取→理解→运用。',
  '英语|middle': '语篇完整地道（真实语境、无中式英语）；听力原文完整呈现；书面表达给要点支架；设问覆盖信息提取→推理→主旨。',
  '英语|high': '听力、阅读语篇真实地道；完形/语法在语篇语境中考查；应用文与续写设问清晰、给足信息。',
  // ── 物理 ──
  '物理|middle': '实验探究体现完整过程；计算题真实情境建模（画示意→列式→计算→作答）；选择填空以生活/实验现象为载体。',
  '物理|high': '受力、电路、光路图规范；实验题重原理与数据处理；计算题过程完整、步骤严谨。',
  // ── 化学 ──
  '化学|middle': '化学用语规范（配平/条件）；实验探究含方案、现象、数据、结论；计算题步骤完整。',
  '化学|high': '工艺流程与反应原理结合情境；实验探究重方案与评价；计算定量、步骤规范。',
  // ── 生物 ──
  '生物|middle': '识图与资料分析在图示情境中设问（结构→功能→原理）；实验探究含变量控制与结论。',
  '生物|high': '细胞代谢、遗传、调节等以图表情境设问；实验探究重设计与数据分析。',
  // ── 道德与法治 ──
  '道德与法治|primary_low': '行为习惯与生活常识以情境辨析呈现；设问贴近生活、表达正向。',
  '道德与法治|primary_mid': '规则意识与行为选择在情境中辨析；设问要求做法＋理由。',
  '道德与法治|primary_high': '法律常识与价值判断以案例/时政为载体；实践探究给出做法并说明理由。',
  '道德与法治|middle': '情境探究与法理阐释结合；材料题以时政/法律案例为载体，要求结合所学分析。',
  // ── 思想政治 ──
  '思想政治|high': '情境与法理结合、时政热点入题；材料分析沿原理→材料→结论；论述观点明确、分层论证。',
  // ── 历史 ──
  '历史|middle': '材料题论从史出（结合材料+所学）；时空观念（地图/时间轴/图表）设问；论述观点+史料+论证。',
  '历史|high': '史料实证与历史解释结合；论述题观点明确、论证严谨；选择题以史料/图表为载体。',
  // ── 地理 ──
  '地理|middle': '以地图/图表为载体设问；综合题沿区域定位→要素分析→人地关系；资料真实、禁止捏造。',
  '地理|high': '区域认知与地理原理结合；综合题多要素分析；图表信息提取有层次。',
  // ── 科学 ──
  '科学|primary_low': '观察与现象解释结合生活；记录题给记录表；操作型任务明确可做。',
  '科学|primary_mid': '实验探究含猜想、方案、现象、结论；填空选择结合生活现象。',
  '科学|primary_high': '实验探究重数据分析与结论；综合运用结合真实问题。',
  '科学|middle': '实验探究体现完整科学过程（变量控制/数据/结论）；综合运用跨学科、开放性设问。',
  // ── 信息科技 ──
  '信息科技|primary_low': '设备认知与用眼卫生以情境设问；操作步骤描述清晰。',
  '信息科技|primary_mid': '在线学习与数字媒体结合场景；操作题描述流程步骤。',
  '信息科技|primary_high': '数据与算法初步结合场景；流程设计描述规范。',
  '信息科技|middle': '互联网应用与物联网结合场景；方案设计体现流程思维。',
  '信息科技|high': '数据与计算、信息系统结合真实任务；算法设计逻辑清晰。',
  // ── 音乐 ──
  '音乐|primary_low': '音的高低长短、节奏快慢以情境设问；表现题可用圈选/连线/涂色呈现。',
  '音乐|primary_mid': '乐理常识与作品结合；简答沿要素→情感体验。',
  '音乐|primary_high': '赏析沿要素→情感→文化理解递进；民族音乐与名曲结合。',
  '音乐|middle': '中外名曲与体裁结合；赏析有层次、鼓励多元感受。',
  '音乐|high': '音乐鉴赏与历史脉络结合；评价有依据、可思辨。',
  // ── 美术 ──
  '美术|primary_low': '造型语言与工具认识以感知呈现；表现题描述创作思路。',
  '美术|primary_mid': '造型/色彩/构图知识结合实例；赏析沿内容→形式→情感。',
  '美术|primary_high': '赏析结合中华优秀传统文化；设计应用题有明确要求。',
  '美术|middle': '中外美术名作结合赏析；评价有依据。',
  '美术|high': '美术鉴赏与设计原理结合；评价多元、有思辨。',
  // ── 体育 ──
  '体育|primary_low': '运动安全与生活习惯以情境设问；动作要领分步清晰。',
  '体育|primary_mid': '运动规则与健康知识结合；动作要领在情境中描述。',
  '体育|primary_high': '运动技能与健康行为结合；安全防护说明到位。',
  '体育|middle': '运动原理与健康知识结合；锻炼方案合理可行。',
  '体育|high': '健康素养与体育文化结合；锻炼方案设计科学。',
};

/** 学段命题要点（5 学段全覆盖——正面引导，非禁令；末尾"认知底线"=不超学段认知水平）
 *  🔧 学科要点库（工具库）读取源；与 EXAM_STAGE_STANDARDS（examPaperBlueprints）存在重复，迁移时定唯一事实源 */
export const STAGE_EXAM_EXTRAS = {
  primary_low: '情境游戏化（开火车/闯关/情景剧场）；字号大、图文并茂，需配图处用 [IMAGE] 标记；难度低起点，多数学生能完成；认知底线：难度与情境符合低段认知水平，不出现未学概念与抽象符号。',
  primary_mid: '情境生活化（购物/校园/旅行）；题型常规，设问分层；认知底线：难度与情境符合中段认知，不超前引入高段知识。',
  primary_high: '综合性强，阅读量加大；情境联系生活实际；增加开放性与思辨性设问，鼓励表达观点；认知底线：可适当开放思辨，但不超高段课标能力要求。',
  middle: '对标中考结构（题型/题量/分值比例）；能力立意（理解/应用/探究）；情境真实（生活/社会/科技）；认知底线：能力要求对标中考课标，不超纲不超学段。',
  high: '对标高考结构；素养立意（学科核心素养导向）；复杂真实情境+综合探究设问，体现区分度；认知底线：情境可复杂、设问可综合，但知识内容符合高中课标，不超学业质量要求。',
};

/** 学段→学科 合理映射（按实际课程设置，非全矩阵——低段无物理/化学/生物/史地政等；
 *  学科名与 normalizeSubjectName 标准化产出一致：高中政治类=思想政治，初小=道德与法治）
 *  🔧 学科要点库（工具库）读取源 */
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
  // 学科层：优先 学科×学段 专属要点（SUBJECT_STAGE_EXTRAS）；缺 cell 回落学科级（SUBJECT_EXAM_EXTRAS）
  const stageOpensSubject = stage ? (STAGE_SUBJECTS[stage] || []).includes(subject) : false;
  if (subject && stageOpensSubject) {
    const stageExtra = SUBJECT_STAGE_EXTRAS[`${subject}|${stage}`];
    if (stageExtra) extra.push(`\n\n【${subject}学科要点】\n${stageExtra}`);
    else if (SUBJECT_EXAM_EXTRAS[subject]) extra.push(`\n\n【${subject}学科要点】\n${SUBJECT_EXAM_EXTRAS[subject]}`);
  }
  if (stage && STAGE_EXAM_EXTRAS[stage]) extra.push(`\n\n【学段特点】\n${STAGE_EXAM_EXTRAS[stage]}`);
  return base(extra.join(''));
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
  // 1) 用户精确：grade+subject+genType
  const exactId = `${grade}|${subject}|${genType}`;
  if (userLib[exactId]?.template) {
    return { ...userLib[exactId], id: exactId, source: 'user' };
  }
  // 2) 用户 subject×genType
  const subjId = `${subject}|${genType}`;
  if (userLib[subjId]?.template) {
    return { ...userLib[subjId], id: subjId, source: 'user' };
  }
  // 3) 用户 genType
  if (userLib[genType]?.template) {
    return { ...userLib[genType], id: genType, source: 'user' };
  }
  // 4) 内置三维度 cell（学段×学科×类型，预生成直取；名称三维度中文）
  const stageKeyOf = (g = '') => {
    if (!g) return '';
    if (STAGE_NAMES[g]) return g;
    for (const [k, v] of Object.entries(STAGE_NAMES)) if (String(g).includes(v)) return k;
    return '';
  };
  const stageKey = stageKeyOf(grade);
  const cellId = stageKey && subject ? `${stageKey}|${subject}|${genType}` : '';
  const cell = cellId && BUILTIN_TEMPLATES[cellId];
  if (cell) {
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
 * 教材原文/渲染契约/质检规则/蓝图等附加块由生成器在生成时追加（不进注入框）。
 * @param {Object} opts { template, grade, subject, unit, genTypeLabel, structure, fullScore, duration, extra }
 * @returns {string} 完整注入指令（注入框展示内容）
 */
export function buildInjectionInstruction(opts = {}) {
  const {
    template = '', grade = '', subject = '', unit = '', genTypeLabel = '',
    structure = '', fullScore = '', duration = '', extra = '', label = '', semester = '', academic = '',
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
    '{material}': '（教材原文由系统按本资料覆盖的知识点检索后，生成时自动附加在指令末尾）',
  };
  for (const [k, v] of Object.entries(map)) body = body.split(k).join(v);
  // 3) 用户附加要求（最后，优先级最高，可覆盖前序约束）
  let extraBlock = '';
  if (extra?.trim()) extraBlock = `\n\n【用户附加要求】\n${extra.trim()}`;
  return [taskLine, body, extraBlock].filter(Boolean).join('\n').trim();
}

/** 从蓝图生成卷面结构文本（明细式，供指令注入）；支持传 recipe（含 blueprint）或蓝图对象本身 */
export function buildStructureText(recipe) {
  const sections = recipe?.blueprint?.sections || recipe?.sections;
  if (!sections?.length) return '';
  return sections.map((s, i) => `${'一二三四五六七八九十'[i] || i + 1}、${s.name}（共X题，共${s.score || ''}分）`).join('\n');
}

/** 密封线（正式试卷卷首必备，后处理兜底注入——AI 未输出时由代码补） */
export function buildSealLineHeader() {
  return '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div></div>';
}

/** 非考试类资料（课时练/预习/总结等）的统一输出格式要求（系统级注入，模板不必重复写）——与 OUTPUT_FORMAT_BLOCK 同源，仅一处定义 */
export const OUTPUT_FORMAT_HINT = OUTPUT_FORMAT_BLOCK(false);

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

export default {
  BUILTIN_TEMPLATES,
  GEN_TYPE_NAMES,
  STAGE_NAMES,
  getPromptTemplate,
  savePromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  buildInjectionInstruction,
  buildStructureText,
  buildSealLineHeader,
  OUTPUT_FORMAT_HINT,
  matchTemplateFilter,
};

// ============================================================
// 🔧 整卷生成端专用提示词（由 useAiGenerator 导入，统一在本库维护，避免散落代码常量）
// ============================================================

/** 整卷输出约定（按生成路径注入；once=正文+答案一次输出，split=正文禁答+答案页独立调用） */
export const PAPER_OUTPUT_CONVENTIONS = {
  once: `【输出约定】本次输出完整试卷/资料正文，并在正文结束后另起一部分输出《参考答案与评分标准》/《参考答案与解析》：
· 答案区大题用 <h2>（如 <h2>参考答案与评分标准</h2>），逐题对应、注明分值；评分标准/等级表用 <table>；听力题附完整听力原文
· 严禁使用 ##、**、|表格 等 Markdown 语法；严禁 \`\`\` 代码块包裹；直接输出 HTML 内容`,
  split: `【输出约定】本次只输出资料/试卷正文（题目、卷面与作答区）。严禁在正文中输出任何答案、解析、评分标准、听力原文——参考答案由系统在正文生成后单独调用生成。`,
};

/** 答案页角色（按资料类型：exam=阅卷专家+评分标准；其余=教辅编辑+参考答案与解析） */
export const ANSWER_ROLES = {
  exam: '你是阅卷专家。请为以下试卷逐题撰写完整《参考答案与评分标准》：每题给出答案与简要解析；选择题给正确选项；作文/写话给评分标准（等级描述+采分点）；听力题附完整听力原文。',
  other: '你是教辅编辑。请为以下资料逐题撰写完整《参考答案与解析》：选择题给正确选项；错题类附错误归因与正确解法；知识总结/预习类给出要点梳理与参考解答。',
};

/** 答案页 HTML 输出格式规范（与正文一致，便于排版导出） */
export const ANSWER_FORMAT_SPEC = `【答案页输出格式】（HTML 规范，与正文一致，便于排版导出）
· 大题用 <h2>（如 <h2>一、识字与写字</h2>）；每题先写题号（与试卷正文完全一致）再写答案与解析
· 评分标准/等级表用 <table> 表格；听力题附完整听力原文
· 严禁使用 ##、**、|表格 等 Markdown 语法；严禁 \`\`\` 代码块包裹；直接输出 HTML 内容`;
