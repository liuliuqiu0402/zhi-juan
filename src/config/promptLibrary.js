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
 * ============================================================
 */

/** 资料类型中文名（模板列表展示/任务行用） */
export const GEN_TYPE_NAMES = {
  exam: '正式考卷', practice: '课时练', special: '专项突破', preview: '课前预习',
  reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '错题本', review: '复习资料',
};

/** 正式考卷基础模板（extra 为学科排版附加，学科模板复用本函数） */
const EXAM_BASE = (extra = '') => `你是资深命题专家。请为{grade}{subject}命制一份{unit}正式试卷（满分{fullScore}分，考试时间{duration}）。

【卷面结构】（大题与分值固定，不得增删）
{structure}

【命题要求】
1. 依据2022版新课标，情境真实适切、设问有层次，杜绝机械记忆与偏题怪题
2. 紧扣{unit}教材内容与课标要求命题，不超纲、不编造教材没有的内容
3. 题型多样，同一题型不要连续出现；每道题题干完整、条件充分、可直接作答
4. 阅读题先给出短文全文再设问；看图写话题用 [IMAGE] 标记描述画面（格式见生成时注入的【渲染指令】）
5. 所有题目原创设计，禁止照搬教材原题
6. 难度从易到难排列

【卷面格式】（正式卷面必备）
· 卷首：<h1>标题居中。标题只由系统注入的占位符组成（命名规范如下），🔴 严禁再追加"考卷/试卷/测试"等任何资料类型词：
  ① 单元/课/综合类（范围名如"第二单元·识字"）："{grade}{subject}{semester}{scope}{label}"——如"二年级语文上册第二单元·识字综合检测"（{grade}年级 {subject}学科 {semester}册别 {scope}命题范围 {label}资料类型标题名，由系统按名称样式轮换注入；{scope} 为用户确认/自定义的范围名，原样使用不加字）
  ② 期中/期末/月考（范围名即考试标签，如"期中综合测试"，系统按名称池轮换注入多种叫法）："{academic}{grade}{subject}{scope}"——如"2025-2026学年度第一学期二年级语文期中综合测试"（{academic}学年度学期由系统按当前日期推断注入；不带册别——学期已隐含对应上下册）
· 下接一行（考试时间：{duration}　满分：{fullScore}分），再写密封线（左侧竖排"密封线内不要答题"，含学校/班级/姓名/学号填写栏）
· 填空用横线 <u>＿＿＿</u>，宽度按答案字数：1字≈2格（＿＿）、2字≈4格（＿＿＿＿）、3-4字≈6格、5-6字≈8格，答案每多1字加长2格
· 选择/判断作答空用半角括号内全角空格 (　)，括号内空格数=答案字数：1字 (　)、2字 (　　)、3字 (　　　)…据此递增；禁止用中文全角括号（）作作答空
· 简答/解答题题下留足空白作答区（不少于4行）；作文/写话用方格纸（不少于160格）
· 连线题左右两列对应，🔴 右列顺序必须打乱（不得与左列一一对应，防止直接暴露答案）；子题号用 (1)(2) 半角括号
· 严禁输出"答案/解析"混入正文；页码、得分栏由系统生成

【教材原文（命题取材依据，可改编情境，禁止照搬原句原题）】
{material}

【输出格式】（结构清晰，便于排版导出）
· 试卷标题用 <h1>；大题标题用 <h2>（如 <h2>一、识字与写字（32分）</h2>）
· 每题用 <p class="question"> 包裹并带题号（1. 2. 3.…），子题用 (1)(2)；选择题选项 A. B. C. D. 各占一行
· 填空用 <u>＿＿＿</u>（宽度：1字≈2格、2字≈4格、3-4字≈6格、5-6字≈8格）；选择/判断作答空用半角括号 (　)，括号内空格数=答案字数
· 连线题左右两列内容逐行并排、右列乱序（编号与内容写在一起如"②花园"，严禁"右列裸序号＋内容单独列下方"拆分）
· 作文/写话留方格纸：<div class="zuo-wen-ge"><span>&emsp;</span>…（约160格）</div>
· 书写格按学段：语文 1-2 年级田字格 <span class="tian-zi-ge">字</span>、3 年级及以上方格/横线（严禁田字格）；英语小学四线三格、初中及以上单线/横线
· 🔴 只输出试卷正文，严禁在正文中输出答案/解析/评分标准/听力原文（参考答案由系统在正文生成后单独生成）
· 严禁 \`\`\`html 代码块包裹，直接输出内容

请只输出试卷正文。${extra}`;

/** 非考试类资料统一输出格式块（模板正文自带，指令库面板可见可维护；
 *  生成端对用户自定义模板做去重兜底：模板已含【输出格式】则不再拼接） */
const OUTPUT_FORMAT_BLOCK = `

【输出格式】（结构清晰，便于排版导出）
· 大标题用 <h1>；大题标题用 <h2>；题目以 <p class="question"> 包裹并带题号（1. 2. 3.…），子题用 (1)(2)
· 填空用 <u>＿＿＿</u>（宽度：1字≈2格、2字≈4格、3-4字≈6格、5-6字≈8格，每多1字加长2格）
· 选择/判断作答空用半角括号内全角空格 (　)，括号内空格数=答案字数：1字 (　)、2字 (　　)、3字 (　　　)…据此递增；禁止用中文全角括号（）作作答空
· 选项各占一行；连线题左右两列对应并打乱右列顺序（不得一一对应），用"①—②"标出连线关系
· 简答/解答题题下留足空白作答区（不少于3行）；如适用：语文田字格 <span class="tian-zi-ge">字</span>、英语四线三格 <span class="four-line-three">a</span>
· 🔴 只输出资料正文，严禁在正文中输出答案/解析（参考答案由系统在正文生成后单独生成）
· 严禁代码块包裹输出，直接输出内容`;

/* 质量底线三维度注入（2026-08）：
 *  - 类型维度 → 各类型模板【要求】尾部（如 practice 防机械重复/任务完整、special 分类分层变式、reading 语篇质量）
 *  - 学科维度 → SUBJECT_EXAM_EXTRAS 学科要点（语境考查/说理/语篇/实验/材料题等学科底线）
 *  - 学段维度 → STAGE_EXAM_EXTRAS 学段特点（不超学段认知水平：低段已学内容、中高段进阶、初中能力立意、高中素养立意）
 *  不做"一股脑全模板补充"，三维度模板各自针对性携带底线。 */

/** 课时练基础模板（extra 为学科排版附加） */
const PRACTICE_BASE = (extra = '') => `你是教辅编辑·课时练设计者。请为{grade}{subject}编写一份{unit}课时练习（依据2022版新课标学习任务群）。

【编写要求】
1. 以学习任务组织（非题目堆砌），任务含真实情境+活动+成果
2. 覆盖{unit}核心知识点，梯度递进（基础→变式→应用）
3. 题型多样、图文并茂，任务间不重复
4. 每道题/任务完整可作答，不空泛
5. 填空用横线 <u>＿＿＿</u>（宽度按答案字数：1字≈2格…每多1字加2格）；选择/判断作答空用半角括号 (　)；连线左右两列；子题号 (1)(2) 半角括号
6. 同一知识点允许换情境、换角度、换题型变式复现（巩固强化），禁止同情境同设问的机械重复；同一任务组内避免连续多道相同题型

【教材原文（取材依据）】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK}${extra}`;

/** 全部资料类型的基础模板（函数，供三维度/学段组合生成） */
const TYPE_BASES = {
  exam: EXAM_BASE,
  practice: PRACTICE_BASE,

  special: (extra = '') => `你是专项训练设计者。请为{grade}{subject}设计一份{unit}专项突破训练。

【要求】按题型或考点分类组织（每类一个板块），类内按基础→提升→拓展分层；每类3-5题并配解析，聚焦{unit}薄弱点；变式题须换情境换角度，禁止同情境同设问的机械重复；覆盖教材核心知识点；题目完整可作答；填空用横线、子题号 (1)(2)。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK}${extra}`,

  preview: (extra = '') => `你是课前预习设计者。请为{grade}{subject}设计一份{unit}课前预习任务单。

【要求】以问题驱动预读（如"圈出你不认识的字""概括每段大意"），可操作可检查；任务覆盖本课时全部新知识点，同一知识点不重复设问；设"我的疑问"栏目；紧扣教材原文。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK}${extra}`,

  reading: (extra = '') => `你是阅读素养训练设计者。请为{grade}{subject}设计一份{unit}阅读训练。

【要求】原创短文2-3篇（不复制课文/网络文章），短文完整呈现（不截断），每篇配3-5道分层题（信息提取→理解→评价）；题目不可直接在原文找到原句答案；短文无语病；同一考点不重复设问。

【教材原文（主题参考）】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK}${extra}`,

  summary: (extra = '') => `你是知识总结编写者。请为{grade}{subject}编写一份{unit}知识总结。

【要求】结构化呈现（表格/对比/导图优先），覆盖{unit}全部知识点并标注教材出处，不遗漏；含易错辨析与典型例题；重点标注，不堆砌大段文字。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK}${extra}`,

  dictation: (extra = '') => `你是积累运用设计者。请为{grade}{subject}设计一份{unit}默写/积累纸。

【要求】在语境中默写（看拼音写词语有语境提示），减少孤立默写；严格对应教材要求，覆盖本单元全部要求掌握的字词/篇目，不遗漏不重复；拼音/字形准确；书写格按学段：语文 1-2 年级用田字格、3 年级及以上用方格或横线，英语小学用四线三格、初中及以上用单线/横线。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK}${extra}`,

  errorbook: (extra = '') => `你是错题整理专家。请为{grade}{subject}设计一份{unit}错题本样例。

【要求】按知识点或题型分类组织；每题含：原题重现+错误归因（具体到知识点）+正确解法（分步）+同类变式巩固（变式须换情境换设问角度，不复刻原题思路）+解题策略归纳；归因禁止笼统写"粗心"。

【教材原文（题型参考）】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK}${extra}`,

  review: (extra = '') => `你是复习资料编写者。请为{grade}{subject}编写一份{unit}复习资料。

【要求】知识框架+考点梳理+典型题析+易错聚焦+综合自测，覆盖{unit}全部知识点；结构化呈现；自测题分层（基础/提高），按考点分布、避免同考点重复考查。

【教材原文】
{material}

只输出资料正文（答案由系统在正文生成后单独生成）。${OUTPUT_FORMAT_BLOCK}${extra}`,
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

/** 学科命题要点（15 学科全覆盖——正面引导，非禁令；末尾"底线"为学科质量底线，非 exam 适用） */
const SUBJECT_EXAM_EXTRAS = {
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

/** 学段命题要点（5 学段全覆盖——正面引导，非禁令；末尾"认知底线"=不超学段认知水平） */
const STAGE_EXAM_EXTRAS = {
  primary_low: '· 题量适中（低年级完成约40分钟，留足读题与检查时间）；情境游戏化（开火车/闯关/情景剧场）；\n· 字号大、图文并茂，需配图处用 [IMAGE] 标记；难度低起点，多数学生能完成；\n· 认知底线：只考本册已学内容与低段简单情境，不出现未学概念与抽象符号。',
  primary_mid: '· 题量适中（60分钟左右）；情境生活化（购物/校园/旅行）；\n· 题型常规（选择/填空/判断/简答），设问分层；\n· 认知底线：难度与情境符合中段认知，不超前引入高段知识。',
  primary_high: '· 综合性强，阅读量加大；情境联系生活实际；\n· 增加开放性与思辨性设问，鼓励表达观点；\n· 认知底线：可适当开放思辨，但不超高段课标能力要求。',
  middle: '· 对标中考结构（题型/题量/分值比例）；能力立意（理解/应用/探究）；\n· 情境真实（生活/社会/科技），难度分布基础:中档:较难≈6:3:1；\n· 认知底线：能力要求对标中考课标，不超纲不超学段。',
  high: '· 对标高考结构；素养立意（学科核心素养导向）；\n· 复杂真实情境+综合探究设问，体现区分度；\n· 认知底线：情境可复杂、设问可综合，但知识内容符合高中课标，不超学业质量要求。',
};

/** 学段→学科 合理映射（按实际课程设置，非全矩阵——低段无物理/化学/生物/史地政等；
 *  学科名与 normalizeSubjectName 标准化产出一致：高中政治类=思想政治，初小=道德与法治） */
const STAGE_SUBJECTS = {
  primary_low: ['语文', '数学', '英语', '科学', '道德与法治', '音乐', '美术', '体育', '信息科技'],
  primary_mid: ['语文', '数学', '英语', '科学', '道德与法治', '音乐', '美术', '体育', '信息科技'],
  primary_high: ['语文', '数学', '英语', '科学', '道德与法治', '音乐', '美术', '体育', '信息科技'],
  middle: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治', '科学', '音乐', '美术', '体育', '信息科技'],
  high: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '思想政治', '音乐', '美术', '体育', '信息科技'],
};

/** 全部资料类型键（与 TYPE_BASES 一致） */
const ALL_GEN_TYPES = Object.keys(TYPE_BASES);

// 🔴 学段兜底：学段×资料类型（subject 缺省时命中，5 学段 × 9 类型 = 45）
for (const [stage, stageExtra] of Object.entries(STAGE_EXAM_EXTRAS)) {
  for (const gType of ALL_GEN_TYPES) {
    BUILTIN_TEMPLATES[`${stage}|${gType}`] = TYPE_BASES[gType](`\n\n【学段特点】\n${stageExtra}`);
  }
}
// 🔴 三维度全覆盖：学段×学科×资料类型（仅生成该学段实际开设的学科；
//    内容 = 类型骨架 + 学科要点 + 学段特点，三维度针对性。54 组合 × 9 类型 = 486）
for (const [stage, subjList] of Object.entries(STAGE_SUBJECTS)) {
  for (const subj of subjList) {
    const subjExtra = SUBJECT_EXAM_EXTRAS[subj];
    if (!subjExtra) continue; // 学科要点缺失则跳过
    for (const gType of ALL_GEN_TYPES) {
      BUILTIN_TEMPLATES[`${stage}|${subj}|${gType}`] = TYPE_BASES[gType](`\n\n【${subj}学科要点】\n${subjExtra}\n\n【学段特点】\n${STAGE_EXAM_EXTRAS[stage]}`);
    }
  }
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
  // 4) 内置 grade×subject×genType（三维度全覆盖模板——学科要点 + 学段特点）
  const stageKeyOf = (g = '') => {
    if (!g) return '';
    if (STAGE_NAMES[g]) return g;
    for (const [k, v] of Object.entries(STAGE_NAMES)) if (String(g).includes(v)) return k;
    return '';
  };
  const stageKey = stageKeyOf(grade);
  const dim3Key = stageKey && subject ? `${stageKey}|${subject}|${genType}` : '';
  if (dim3Key && BUILTIN_TEMPLATES[dim3Key]) {
    return { id: dim3Key, name: `内置·${GEN_TYPE_NAMES[genType] || genType}（${STAGE_NAMES[stageKey] || stageKey}·${subject}）`, template: BUILTIN_TEMPLATES[dim3Key], source: 'builtin' };
  }
  // 5) 内置 grade×genType（学段定制模板；grade 可为 primary_low 等键或"小学低段·二年级"中文标签）
  if (stageKey && BUILTIN_TEMPLATES[`${stageKey}|${genType}`]) {
    return { id: `${stageKey}|${genType}`, name: `内置·${GEN_TYPE_NAMES[genType] || genType}（${STAGE_NAMES[stageKey] || stageKey}）`, template: BUILTIN_TEMPLATES[`${stageKey}|${genType}`], source: 'builtin' };
  }
  // 6) 内置 genType
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

/** 列出全部可用模板（用户优先，内置兜底） */
export function listPromptTemplates() {
  const userLib = loadUserLibrary();
  const out = [];
  for (const [key, t] of Object.entries(userLib)) {
    if (t?.template) out.push({ key, ...t, source: 'user' });
  }
  for (const [key, template] of Object.entries(BUILTIN_TEMPLATES)) {
    const parts = key.split('|');
    const gType = parts[parts.length - 1];
    const dims = parts.slice(0, -1).map(d => STAGE_NAMES[d] || d).join('·');
    const name = parts.length > 1
      ? `内置·${GEN_TYPE_NAMES[gType] || gType}（${dims}）`
      : `内置·${GEN_TYPE_NAMES[key] || key}（通用模板）`;
    out.push({ key, id: key, name, template, source: 'builtin' });
  }
  return out;
}

/**
 * 组装注入指令（最终形态，拼接顺序固定）：
 *   【任务】定位行（系统生成，固定最前）
 *   → 模板正文（指令库模板，占位符替换，用户可排版；学科排版已并入模板本体）
 *   → 【用户附加要求】（最后，优先级最高）
 * 教材原文/渲染契约/情境等附加块由生成器在生成时追加（不进注入框）。
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

/** 从蓝图生成卷面结构文本（人话，供指令注入）；支持传 recipe（含 blueprint）或蓝图对象本身 */
export function buildStructureText(recipe) {
  const sections = recipe?.blueprint?.sections || recipe?.sections;
  if (!sections?.length) return '';
  return sections.map((s, i) => `${'一二三四五六七八九十'[i] || i + 1}、${s.name}（${s.score || ''}分）`).join('\n');
}

/** 密封线（正式试卷卷首必备，后处理兜底注入——AI 未输出时由代码补） */
export function buildSealLineHeader() {
  return '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div></div>';
}

/** 非考试类资料（课时练/预习/总结等）的统一输出格式要求（系统级注入，模板不必重复写） */
export const OUTPUT_FORMAT_HINT = `

【输出格式】（结构清晰，便于排版导出）
· 大标题用 <h1>；大题标题用 <h2>；题目以 <p class="question"> 包裹并带题号（1. 2. 3.…），子题用 (1)(2)
· 填空用 <u>＿＿＿</u>（横线宽度按答案字数）；选择/判断作答空用 （　）；选项各占一行
· 连线题左右两列内容逐行并排、右列乱序（编号与内容写在一起如"②花园"，严禁"右列裸序号＋内容单独列下方"拆分）
· 排版语义标记：加点字/画线用 <u>…</u>、强调 <b>…</b>、删除 <del>…</del>、上标（幂/离子）<sup>…</sup>、下标（化学式）<sub>…</sub>、分数"1/2"、音标斜杠包裹
· 🔴 只输出资料正文，严禁在正文中输出答案/解析（参考答案由系统在正文生成后单独生成）
· 严禁代码块包裹输出，直接输出内容`;

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
