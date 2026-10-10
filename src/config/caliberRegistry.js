// 📋 判据指纹表（A）＋ 给模型文本的源登记表（E）—— 2026-09-30 用户裁定一次实施
// ============================================================
// A 判据指纹表：把"同义"从**词面**升级为**判据**。每条登记：判据名 / 判定式 / 允许出现次数（基线，只减不增）。
//   · allow = 1  ⇒ 硬锁"唯一出现"（其余位置只能引用）
//   · allow > 1  ⇒ 分期收口目标；本表先锁住"不得增加"
// E 源登记表：**一切会产出"给模型文本"的入口**（不止 src/config 的 6 个库）——
//   src/utils/injectionManifest.js（用户消息 12 块）、programAttach（附加段）、textbookCompression（压缩调用）、
//   levelMapping（层级/卷别提示）、listeningExtractPrompt/TranslatePrompt（听力抽取/翻译调用）等。
//   守卫扫 src/** 的 `build*Prompt|*Message|*Block|*Contract|*Instruction|*Hint` 导出，**没登记即红**。
// 判据基线与源基线取 2026-09-30 实测值（见 docs/design/指令改动标准-可机检清单.md）。

/** A：判据指纹表 */
export const CALIBERS = [
  { name: '同题内同性质载体形态一致', re: /同一题内同性质作答载体|同一题（含并列子题）同性质空位的形态一致/g, allow: 2, note: '1 正句（作答位条款）+ 1 引用（⑥）；引用不算第二处正句' },
  { name: '同卷空位形态统一', re: /同卷空位形态统一/g, allow: 1, note: '⑧ 唯一正句' },
  { name: '不得另起同性质整行短答载体', re: /不得再[^，。；\n]{0,10}另起/g, allow: 1, note: '作答位条款（layoutSpec）唯一正句；2026-10-01 自洽⑤ 已改引用式；正则收紧防"在题后另起"绕过' },
  // 2026-10-02（⑥拼接·复核）：原记"收口目标 1"——实测两处**不是同一判据的复述**：
  //   ① layoutSpec 载体协议行"XX**必须真实输出**XX"（载体形态协议）；② promptLibrary 作答位条"作答位**必须真实输出**、不得省略"（作答位不得省略）。
  //   分母相同、判据不同（载体形态 ≠ 作答位存在性）→ 按"作用结果相同才算重复"判**不属多块同义**，保留 2，撤销收口目标。
  { name: '书写载体必须真协议', re: /必须真实输出/g, allow: 2, note: '两处为**不同判据**（载体形态协议 / 作答位不得省略）；2026-10-02 ⑥ 复核后**不再视为收口目标**' },
  { name: '分值（含标注纪律）', re: /分值/g, allow: 14, note: '分层保留（大类级/小题级/题面级）；纪律只留一处' },
  { name: '账目（含账目闭合/算式）', re: /账目/g, allow: 4, note: '分层；判词单源' },
  // 2026-10-02（⑥拼接·复核）：各处"书写载体"**分指不同判据**——① 载体协议行（协议标签）；② 表达类书写载体约束（validatorRules）；
  //   ③ 长答走向"专用书写载体通道"（成篇成文归作文格，属**排除本列**的说明）；④ 作答空间条"只以真实留白或书写载体呈现"（禁文字占位）。
  //   四者非同义复述 → 不再标"收口目标"；数值待下轮按实测订正（本表 allow 为 2026-09-30 基线）。
  { name: '书写载体（词面）', re: /书写载体/g, allow: 3, note: '各处指**不同判据**（协议标签/表达类约束/长答通道/作答空间呈现）；2026-10-02 ⑥ 复核后不再视为收口目标' },
  // 2026-10-02（⑥拼接·D16）：教材内容分析里锚树契约的"**完整性自查（提取完成后必做，逐条核对，缺即补）**"是**自检类块**（D16 优先清除对象）——
  //   处置走 D16 三问：① 它在替"前置未给覆盖参照物"兜底 → ② 把参照物与判据**前置化**为要求式判据（"**覆盖完整性**：本课/单元课标要求掌握的学业内容都要在树中有对应…"）
  //   → ③ 覆盖判据已在（原文引证约束／不设数量区间／覆盖完整性）→ ④ 删自检动作壳。剩余"自查"为**学生动作**（预习"完成标准（能自查）""先自查再记疑"）与
  //   调用层重试附加段的"逐题自查题号连续性"（该动作按既有裁定保留在调用层）→ 均非"模型成稿后自查"。
  { name: '自查（动作词）', re: /自查/g, allow: 2, note: '2026-10-02 ⑥：教材分析的自检块已改**要求式判据**；余者为学生动作/调用层重试动作，非成稿后自查' },
];

/** E：给模型文本的源登记表（src 相对路径 → 产出函数） */
export const PROMPT_SOURCES = {
  'src/config/promptLibrary.js': ['buildInjectionInstruction', 'buildOutputFormatHint'],
  'src/config/layoutSpec.js': ['buildCarrierInstruction', 'buildBlankWidthInstruction', 'buildAnswerSpaceInstruction', 'buildLongAnswerCarrierInstruction'],
  'src/config/eduRenderContract.js': ['buildRenderContract'],
  'src/config/validatorRules.js': ['buildValidatorPrompt'],
  // 2026-10-02（职责归属·轮1① 查实）：`buildPaperKindHint` 只作**界面「范围/卷别」选择提示**（GenerateModule 的 UI computed），
  //   不进任何 prompt → 移出 E 表、改登记 NON_MODEL_SOURCES。本条只留真正进实发的 buildLevelInstruction。
  'src/config/levelMapping.js': ['buildLevelInstruction'],
  'src/config/listeningExtractPrompt.js': ['buildListeningExtractMessages'],
  'src/config/listeningTranslatePrompt.js': ['buildListeningTranslateMessages'],
  'src/utils/injectionManifest.js': ['buildUserMessageBlocks', 'buildUserMessagePrompt', 'buildCallLayerBlocks', 'buildAnchorListBlock', 'buildCompressedTextBlock', 'buildMaterialUsageBlock', 'buildOrganizeBlock', 'buildTemplateInfoBlock', 'buildContextBlock', 'buildDiffRegenBlock', 'buildOutputBlock', 'buildTailBlocks'],
  'src/utils/programAttach.js': ['buildProgramAttachBlocks'],
  'src/utils/textbookCompression.js': ['buildMapMessages', 'buildFoldMessages'],
  /** 非模型源（给下游引擎/渲染），留证在此，守卫不当作遗漏 */
  'src/utils/directiveBlocks.js': ['buildImagePromptList'],
};

/** 非模型源白名单（给下游引擎/渲染/界面，不进主模型提示词） */
export const NON_MODEL_SOURCES = [
  'src/utils/directiveBlocks.js',                    // 给 EduRender 编辑区（下游引擎）
  'src/config/levelMapping.js:buildPaperKindHint',   // 界面「范围/卷别」选择提示（UI computed，不进任何 prompt）
];

export const SOURCE_RE = /export\s+(?:const|function)\s+(build[A-Za-z]*(?:Prompt|Message|Block|Contract|Instruction|Hint|Messages)[A-Za-z]*)/g;

/**
 * E2：**常量形态**的给模型文本（2026-10-01 实测登记；补 E 表缺口①）
 * ============================================================
 * 为什么需要：E 表（PROMPT_SOURCES）的扫描面只有 `build*` 形态的导出，**导出常量不在其内**——
 *   于是 `DECLARATION_TRUTH_CLAUSE` 这类被注入进实发的常量长期"无主"。
 * 口径（先测量后登记，不拍脑袋）：逐模块 import，读**导出值的真实字符串**，与"675 份实发文本"比对；
 *   **占比 ≥ 0.5 者认定为给模型文本**（<0.5 者为"数据容器/按维度过滤注入"，另注）。
 * 机检：tests/config/promptSourceRegistry.test.js 会**重跑该测量**，实测集合 ⊄ 本表即红（漏登记即红）。
 */
export const PROMPT_CONSTANTS = {
  'src/config/promptLibrary.js': [
    'ANSWER_ROLES', // 4 条分支（exam / errorbook / summary·review·preview·dictation / 其余）
    'DECLARATION_TRUTH_CLAUSE',
    'SUBJECT_FACT_DISCIPLINE',
    'NUMBERING_HIERARCHY_RULE',
    // 🗑 2026-10-10（属主裁定·删编法规定）：'QUESTION_NUMBERING_CALIBER' 已整块删除
    //   （小题号"全卷连续／各自起编"是**约束**、会逼出硬编小题号；"哪些题该编号"由编号对象口径单源承载）。
    'QUESTION_OBJECT_CALIBER',
    'SCORING_OBJECT_CALIBER', // 🔴 2026-10-10（〔328〕三口径闭环）：计分对象口径（编号对象之姊妹条）
    'GROUP_TITLE_NUMBERING_CALIBER',
    'CURRICULUM_BY_STAGE',
    'LISTENING_SCRIPT_FORMAT_REQUIREMENTS',
    'LISTENING_SCRIPT_FORMAT',
    'PAPER_OUTPUT_CONVENTIONS',
    // 按三维度过滤后注入（实测占比 0.50 → 半数组合命中，属正常的三维度注入）
    'SUBJECT_STAGE_EXTRAS',
    'STAGE_EXAM_EXTRAS',
    'STAGE_TEACHING_EXTRAS',
    // 数据容器（内容即库内 cell / 蓝图条目，本体已在库内账）
    'BUILTIN_TEMPLATES',
  ],
  'src/config/eduRenderContract.js': ['FORMULA_RULES', 'GRAPH_SAMPLES'], // GRAPH_SAMPLES：原注释称"仅展示、不影响生成"，但**实测其文本进实发** → 依"实测为准"登记（注释不足为凭）
  'src/config/teachingBlueprints.js': ['LEVEL_SELECTION_CAVEAT', 'TEACHING_SUBJECT_BLUEPRINTS', 'ERRORBOOK_FACETS'],
  'src/config/errorbookFacets.js': ['ERRORBOOK_FACETS'],
  'src/config/levelMapping.js': ['LEVEL_SOURCE'],
  // 2026-10-01 补登（用户追问"库外的是直接进实发，不进指令框？"时查出）：
  //    `styleInstructions` 是**指令框末尾追加类**的文本源（组织风格），既不在注入框内、也不属程序附加段
  //    （`injectionManifest` 的 instruction 块注释自认"这两块不在注入框里、也不属程序附加段"）。
  //    首轮覆盖测量漏了它——因为测量用的实发装配**没有包含"生成期追加"**。已登记；测量面待同步扩。
  'src/config/expertKnowledge.js': ['styleInstructions'],
  // 2026-10-01 R2 闭合时由守卫抓出（扫描面 19→122 个模块后）：以下 5 条**进实发但此前从未登记**
  'src/utils/anchorTreeContract.js': ['ANCHOR_LIST_ROLE_NOTE'],
  'src/utils/injectionManifest.js': ['TAIL_SELF_CONSISTENCY', 'TAIL_VARIETY', 'TAIL_ANCHOR_MARKER'],
};

/** 占比 < 0.5 但仍有内容进实发的"数据表/容器"（登记备查；本体属库内数据） */
export const PROMPT_PARTIAL_CONTAINERS = {
  'src/config/examPaperBlueprints.js': ['EXAM_BLUEPRINTS'],
  'src/config/validatorRules.js': ['VALIDATOR_RULES'],
  'src/config/teachingBlueprints.js': ['TEACHING_BLUEPRINTS'],
  // 🗑 2026-10-08（C3 挂起项*收口*）：原登记行
  //   `'src/config/domainContract.js': ['DOMAIN_CONTRACT', 'HIGH_DOMAIN_CONTRACT']` **已移除**。
  //   真凭实据：该文件**全库零 import**（唯一消费方 `utils/domainReconciler.js` 已于 2026-09-20 砍除；
  //   文件头部自陈"当前无程序消费方""不进 prompt"）⇒ 其内容占比**恒为 0**，与本表自身定义
  //   "占比 <0.5 但**仍有内容进实发**"**相斥** ⇒ 属**陈旧登记**（原挂于〔144〕B9·跨批移交 C2/C3）。
  //   文件本体**保留不动**（2026-10-08 属主裁定〔144〕B9＝「留」：课标领域名＋概念白名单存档，删则断源）。
  //   防回归锁：`tests/config/promptSourceRegistry.test.js` 增
  //   「PROMPT_PARTIAL_CONTAINERS 登记的文件必须有消费方（无 import ⇒ 不可能进实发）」。
  'src/config/caliberRegistry.js': ['CALIBERS'],
};

/**
 * E3：**调用层 inline 文案**（补 E 表缺口②；`useAiGenerator` 内字面量，既非导出函数也非导出常量）
 * ============================================================
 * 为什么需要：答案页是**独立一次调用**，其 prompt 由调用层直接拼（`ansPrompt = ansMaterial + 【正文】 + 【答案规范】+ …`），
 *   这些字面量不在任何库、也不在 E 表扫描面 → 长期"无主"（实测：B 面 5 条无主句里 3 条出在这里）。
 * 登记粒度：**句级**——每条给出 `id`（标识）＋ `head`（首段字面，供逐字校验）＋ `cond`（触发条件）。
 * 机检：tests/config/promptSourceRegistry.test.js ①逐条断言 `head` 在文件内逐字存在；②扫描 `region` 区间内
 *   **≥12 字的中文字面量**，凡不在本表 `head` 内者即红（防"悄悄新增一段无主文案"）。
 */
export const PROMPT_INLINE_SOURCES = {
  'src/composables/useAiGenerator.js': {
    regions: [
      ['const ANS_ALIGN_TAIL_REF', 'const ansThinking'],
      ['const analysisPrompt = isGuidePage ?', 'const step2aPrompt ='],
      ['const step2aPrompt =', 'const stylePrompt ='],
      ['const stylePrompt =', 'const chunkPrompt ='],
      ['const chunkPrompt =', 'const step2bPrompt ='],
      ['const step2bPrompt =', 'const enhancedRawText ='],
    ],
    items: [
      { id: 'ANS_ALIGN_TAIL_REF', head: '本条（答案区与正文逐题对齐）即【尾约束·全文自洽】', cond: '恒（2026-09-30 用户裁定：显式声明隶属，防两处各写一段）' },
      { id: 'ansAlignNote(自包含分支)', head: '答案区按正文对应的栏目组织、并与正文同构', cond: 'isSelfContainedTeaching' },
      { id: 'ansAlignNote(普通分支)', head: '**逐题对齐硬要求**：答案区**每个题目都以与正文完全相同的题号起头**', cond: '其余资料类型' },
      // 2026-10-02（③啰嗦·一份实发内判据只准一处正句）：原 `selfContainedAnsNote`（【自包含教辅答案原则】）
      //   与同一次调用的 `ansRole`（库内常量 ANSWER_ROLES.other 自包含分支）同义 → 正句收口到库内常量，
      //   inline 整块删除，登记随之注销（原 head 为"【自包含教辅答案原则】答案区【只】给出正文中练习/自测/变式的解答"）。
      { id: 'ansMaterial 段标题', head: '【压缩原文·答案参考】', cond: 'answerPageNeedsSource(genType) && compressedText' },
      { id: '正文段标题', head: '【正文】', cond: '恒' },
      { id: '答案段标题', head: '【答案规范】', cond: '恒' },
      { id: '正文空兜底', head: '（正文为空，无法作答——请终止输出）', cond: '正文为空' },
      // 🔴 2026-10-02（④精准·范围补齐）：以下 5 处**进模型但从未登记**（原 E3 区间只覆盖 5 段）——
      //   4 个独立调用（知识图谱构建／教材页知识点提取／统一情境／变题）＋ 1 处通道文本（目录模式卡，
      //   在「锚点清单/素材」通道里夹带指令）。登记后"实发每句有主"的覆盖面才算全。
      { id: '知识图谱构建（prompt2）', head: '你是课程与教学专家。请基于以下各课内容，构建层级知识图谱', cond: '生成流程第二步（有教材素材时恒跑）' },
      { id: '教材页知识点提取', head: '学科专家。请从这张教材页面（章节：', cond: '教材页面图片分析（多模态）' },
      { id: '统一情境生成', head: '教学专家。请为一份教辅资料确定一个统领全卷的核心主题情境', cond: '组织风格＝统一情境类时' },
      { id: '变题生成', head: '请为以下题目生成一个变体题目', cond: '编辑器「生成变体题」' },
      { id: '目录模式卡（未分析/仅目录）', head: '【未分析·目录模式】', cond: '章节未分析/仅目录时降级（2026-10-02 项3：状态标签独立成行，head 随新结构改指）' },
      { id: '目录模式卡·仅目录分支', head: '【仅目录模式】', cond: '同上（仅目录分支）' },
      { id: '教材分析提取-1', head: "标成 material（覆盖不足）；把", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-2', head: "核心主题词，逗号分隔（3-6个）", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-3', head: "大概念 → 核心知识点 → 具体概念", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-4', head: "核心主题词，逗号分隔（3-6个，按概括程度排序）", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-5', head: "大概念名称（如：分数的意义）", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-6', head: "标成 material（会造成覆盖不足）；把", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-7', head: "这类单字名 → 违规，须改为下沉（正确形态：第2层「识字与写字」，第3层 [", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-8', head: "长(cháng)长短/长(zhǎng)长大", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      // 2026-10-02（⑥拼接·块内去重）：原 head 取自语文分支末行"…→逐个提取5条）；但**最小单位一律落第3层**——如生字…"
      //   ——该行与同分支的"生字/生词"条、及【锚树契约】的"最小单位强制下沉第3层／反例自检（人/口/手）"**三处同义**，
      //   已删该行；head 随之改指同分支保留的判据句（逐字存在）。
      { id: '教材分析提取-9', head: "生字/生词：逐个提取（不合并、不遗漏）", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-10', head: "单字/单词条**不得提为第2层条目**", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-11', head: "物质科学、生命科学、地球科学", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-12', head: "结构与功能关系、分类依据", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-13', head: "政治/道德与法治/思想政治", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-14', head: "重要事件/人物/时间/导火索/结果/意义", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-15', head: "地理位置/地形/气候/资源/人口/经济", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-16', head: "政治概念/制度/法律/权利/义务/价值观", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-17', head: "地图/图表/数据分析：识图、读图、绘图要点", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-18', head: "材料/图表/数据解读要点", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-19', head: "唯物史观/时空观念/史料实证/历史解释/家国情怀", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-20', head: "人地协调观/综合思维/区域认知/地理实践力", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-21', head: "政治认同/科学精神/法治意识/公共参与（高中思想政治）", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-22', head: "政治认同/道德修养/法治观念/健全人格/责任意识（道德与法治）", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-23', head: "**，不收题干/选项/例句/上下文里的整句或整段（如", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-24', head: "这类题面、指令语、提示语不属最小单位）；③ 第2层知识点名本身不再下沉重复收录；④ **整句类知识点豁免** —— 若知识点内容**只能以整句/情境形式表达**（数学结论、科学现象、情境描述、口诀、算式实例等，天然压不成字词碎片），则**保留该整句为单位收进第3层，不得丢弃，也不得硬拆成无意义的碎字词**；语义保真 > 形式最小化（防", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-25', head: "🔥 教材特征分析：检查文本模型状态...", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-26', head: "❌ 文本模型配置错误，将跳过特征分析步骤", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-27', head: "⚠️ 文本模型检测失败，等待3秒后继续...", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-28', head: "⚠️ 文本模型不可用，跳过特征分析", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-29', head: "结果结构不完整（缺 knowledgeHierarchy）——疑似输出被截断或修复残件，非模型结构问题；请重试", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-30', head: "❌ 教材特征分析结果结构不完整（缺 knowledgeHierarchy）——疑似输出被截断或修复残件，已丢弃，请重试", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-31', head: "❌ JSON 解析失败:", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-32', head: "📖 使用预提取的模板原文，长度:", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-33', head: "📖 模板原文提取结果长度:", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-34', head: "❌ 模板原文提取完全失败", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-35', head: "原文提取失败，请手动填写", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-36', head: "⚠️ 模板原文过短，可能OCR失败", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-37', head: "选项可能粘连（缺少分隔符）", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-38', head: "🔧 选项粘连已自动修复", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-39', head: "⚠️ 模板OCR质量预警:", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-40', head: "📄 原文长度适中，单次分析", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '教材分析提取-41', head: "选择与示例特点相同的选项", cond: '教材分析提取（区间自动登记·2026-10-02）' },
      { id: '整卷结构分析-1', head: "原文中的大题名称，逐字复制", cond: '整卷结构分析（区间自动登记·2026-10-02）' },
      { id: '整卷结构分析-2', head: "原文中的题型名称，逐字复制", cond: '整卷结构分析（区间自动登记·2026-10-02）' },
      { id: '整卷结构分析-3', head: "原文中的设问原句，逐字复制", cond: '整卷结构分析（区间自动登记·2026-10-02）' },
      { id: '整卷结构分析-4', head: "根据题目内容分析得出（基础/中等/较难）", cond: '整卷结构分析（区间自动登记·2026-10-02）' },
      { id: '整卷结构分析-5', head: "步骤2a解析失败，尝试从原文推断:", cond: '整卷结构分析（区间自动登记·2026-10-02）' },
      { id: '整卷结构分析-6', head: "🎨 开始提取语言风格...", cond: '整卷结构分析（区间自动登记·2026-10-02）' },
      { id: '语言风格分析-1', head: "🔥 语言风格分析：检查模型状态...", cond: '语言风格分析（区间自动登记·2026-10-02）' },
      { id: '语言风格分析-2', head: "⚠️ 模型检测失败，等待3秒后继续...", cond: '语言风格分析（区间自动登记·2026-10-02）' },
      { id: '语言风格分析-3', head: "语言风格提取失败，使用默认值:", cond: '语言风格分析（区间自动登记·2026-10-02）' },
      { id: '语言风格分析-4', head: "🔥 模板结构分析：检查模型状态...", cond: '语言风格分析（区间自动登记·2026-10-02）' },
      { id: '分段结构分析-1', head: "原文中的大题名称，逐字复制", cond: '分段结构分析（区间自动登记·2026-10-02）' },
      { id: '分段结构分析-2', head: "原文中的题型名称，逐字复制", cond: '分段结构分析（区间自动登记·2026-10-02）' },
      { id: '分段结构分析-3', head: "原文中的设问原句，逐字复制", cond: '分段结构分析（区间自动登记·2026-10-02）' },
      { id: '分段结构分析-4', head: "根据题目内容分析得出（基础/中等/较难）", cond: '分段结构分析（区间自动登记·2026-10-02）' },
      { id: '分段结构分析-5', head: "⚠️ 没有收集到大题对象，使用降级方案", cond: '分段结构分析（区间自动登记·2026-10-02）' },
      { id: '分段结构分析-6', head: "📋 开始提取代表性题卡...", cond: '分段结构分析（区间自动登记·2026-10-02）' },
      { id: '题卡提取-1', head: "🔥 题卡分析：检查模型状态...", cond: '题卡提取（区间自动登记·2026-10-02）' },
      { id: '题卡提取-2', head: "⚠️ 模型检测失败，等待3秒后继续...", cond: '题卡提取（区间自动登记·2026-10-02）' },
      { id: '题卡提取-3', head: "详细题卡分析超时，尝试简化版...", cond: '题卡提取（区间自动登记·2026-10-02）' },
    ],
  },
};

/**
 * 实发覆盖测量的**豁免项**（口径：素材与正文是"输入"，不是"指令源"）
 * 说明：实发的"指令部分"每一句都必须有主；但**用户素材 / 锚点清单内容 / 上一次生成的正文全文**属输入，
 *   不要求有源。测试侧以"把素材与正文置空"的方式实现豁免，此处仅登记该口径。
 */
export const PROMPT_COVERAGE_EXEMPT = {
  reason: '素材（锚点清单/压缩原文）与正文全文属输入，不是指令源；测量时置空即可豁免',
};

/**
 * E4：**独立调用**的给模型文本（补 R3 缺口：此前这些只有"产出函数"、没有条目账）
 * ============================================================
 * 说明：这些**不在正文生成请求里**，各自是独立一次调用 → 各有各的"实发"，须分别逐句过。
 * 条数口径：以**注入单元**计（一个 build 段／一个条目＝1），**逐句过时逐条登记**（不预填数字，避免拍脑袋）。
 */
export const PROMPT_CALL_SOURCES = {
  '答案页（split 第二次调用）': {
    file: 'src/composables/useAiGenerator.js',
    builders: ['答案页 inline 8 条（见 PROMPT_INLINE_SOURCES）'],
    consts: ['src/config/promptLibrary.js: ANSWER_ROLES（4 分支）', 'src/config/promptLibrary.js: buildAnswerFormatSpec'],
    cond: 'generateMode=split，且正文未含答案',
  },
  '听力抽取（独立调用）': {
    file: 'src/config/listeningExtractPrompt.js',
    builders: ['buildListeningExtractMessages'],
    cond: '仅英语（HAS_LISTENING）且该资料类型需听力',
  },
  '听力翻译（独立调用）': {
    file: 'src/config/listeningTranslatePrompt.js',
    builders: ['buildListeningTranslateMessages'],
    cond: '仅英语听力内容需要译文时',
  },
  '教材原文压缩（独立调用·map 阶段）': {
    file: 'src/utils/textbookCompression.js',
    builders: ['buildMapMessages'],
    cond: '素材通道=full（全文注入型）时',
  },
  '教材原文压缩（独立调用·fold 阶段）': {
    file: 'src/utils/textbookCompression.js',
    builders: ['buildFoldMessages'],
    cond: '同 map 阶段，折叠汇总时',
  },
  // 2026-10-02（职责归属·轮1① 查实）：**本条不是独立调用**——buildLevelInstruction 的产物由
  //   buildInjectionInstruction 以 [taskLine, body, levelBlock, extraBlock] 拼进「正文请求」（levelBlock 一块），
  //   与答案页／听力／压缩／分析提取那几类独立调用不同。原登记列为"独立调用"属口径错误，现改准。
  //   （buildPaperKindHint 为 UI-only，已移出 E 表 → 见 NON_MODEL_SOURCES。）
  '层级/卷别提示（正文请求的一块·非独立调用）': {
    file: 'src/config/levelMapping.js',
    builders: ['buildLevelInstruction'],
    consts: ['src/config/levelMapping.js: LEVEL_SOURCE'],
    cond: '仅高中；按学科×卷别取学业质量水平',
  },
  '教材分析/知识点提取（独立调用）': {
    file: 'src/config/analysisPrompts.js',
    builders: [],
    consts: ['src/config/analysisPrompts.js: ANALYSIS_PROMPTS'],
    cond: '生成前对勾选章节做分析提取',
  },
  // 🔴 2026-10-02（④精准·范围补齐）：以下 4 类独立调用**此前从未登记**（原口径只数了 6 类独立调用，
  //   漏了"生成流程内"的知识图谱/教材页提取/统一情境 与"编辑器"的变题）——三者均调 `callAI` 并有自带
  //   提示词字面量，属"实发"（见执行文档 §0：实发是复数）。登记后 6 类 → **10 类**。
  '知识图谱构建（独立调用·生成第二步）': {
    file: 'src/composables/useAiGenerator.js',
    builders: ['prompt2（buildKnowledgeMap 内 inline）'],
    cond: '有教材素材时恒跑（正文生成之前）',
  },
  '教材页知识点提取（独立调用·多模态）': {
    file: 'src/composables/useAiGenerator.js',
    builders: ['extractKnowledgePoints 内 inline prompt'],
    cond: '教材页面（图片）分析阶段',
  },
  '统一情境生成（独立调用·生成期）': {
    file: 'src/composables/useAiGenerator.js',
    builders: ['contextPrompt'],
    cond: '组织风格＝统一情境类时',
  },
  '变题生成（独立调用·编辑器）': {
    file: 'src/composables/useAiGenerator.js',
    builders: ['variantPrompt'],
    cond: '编辑器「生成变体题」（非生成流程）',
  },
};
