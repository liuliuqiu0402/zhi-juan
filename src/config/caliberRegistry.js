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
  { name: '书写载体必须真协议', re: /必须真实输出/g, allow: 2, note: '协议条 + must 条；收口目标 1' },
  { name: '分值（含标注纪律）', re: /分值/g, allow: 14, note: '分层保留（大类级/小题级/题面级）；纪律只留一处' },
  { name: '账目（含账目闭合/算式）', re: /账目/g, allow: 4, note: '分层；判词单源' },
  { name: '书写载体（词面）', re: /书写载体/g, allow: 3, note: '收口目标 1（作答空间条/长答条改引用）' },
  { name: '自查（动作词）', re: /自查/g, allow: 2, note: '总纲 + 自检块；收口目标 1（自检块改引用）' },
];

/** E：给模型文本的源登记表（src 相对路径 → 产出函数） */
export const PROMPT_SOURCES = {
  'src/config/promptLibrary.js': ['buildInjectionInstruction', 'buildOutputFormatHint'],
  'src/config/layoutSpec.js': ['buildCarrierInstruction', 'buildBlankWidthInstruction', 'buildAnswerSpaceInstruction', 'buildLongAnswerCarrierInstruction'],
  'src/config/eduRenderContract.js': ['buildRenderContract'],
  'src/config/validatorRules.js': ['buildValidatorPrompt'],
  'src/config/levelMapping.js': ['buildLevelInstruction', 'buildPaperKindHint'],
  'src/config/listeningExtractPrompt.js': ['buildListeningExtractMessages'],
  'src/config/listeningTranslatePrompt.js': ['buildListeningTranslateMessages'],
  'src/utils/injectionManifest.js': ['buildUserMessageBlocks', 'buildUserMessagePrompt', 'buildCallLayerBlocks', 'buildAnchorListBlock', 'buildCompressedTextBlock', 'buildMaterialUsageBlock', 'buildOrganizeBlock', 'buildTemplateInfoBlock', 'buildContextBlock', 'buildDiffRegenBlock', 'buildOutputBlock', 'buildTailBlocks'],
  'src/utils/programAttach.js': ['buildProgramAttachBlocks'],
  'src/utils/textbookCompression.js': ['buildMapMessages', 'buildFoldMessages'],
  /** 非模型源（给下游引擎/渲染），留证在此，守卫不当作遗漏 */
  'src/utils/directiveBlocks.js': ['buildImagePromptList'],
};

/** 非模型源白名单（给下游引擎/渲染，不进主模型提示词） */
export const NON_MODEL_SOURCES = ['src/utils/directiveBlocks.js'];

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
    'QUESTION_NUMBERING_CALIBER',
    'QUESTION_OBJECT_CALIBER',
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
  // 🔴 2026-10-01 补登（用户追问"库外的是直接进实发，不进指令框？"时查出）：
  //    `styleInstructions` 是**指令框末尾追加类**的文本源（组织风格），既不在注入框内、也不属程序附加段
  //    （`injectionManifest` 的 instruction 块注释自认"这两块不在注入框里、也不属程序附加段"）。
  //    首轮覆盖测量漏了它——因为测量用的实发装配**没有包含"生成期追加"**。已登记；测量面待同步扩。
  'src/config/expertKnowledge.js': ['styleInstructions'],
  // 🔴 2026-10-01 R2 闭合时由守卫抓出（扫描面 19→122 个模块后）：以下 5 条**进实发但此前从未登记**
  'src/utils/anchorTreeContract.js': ['ANCHOR_LIST_ROLE_NOTE'],
  'src/utils/injectionManifest.js': ['TAIL_SELF_CONSISTENCY', 'TAIL_VARIETY', 'TAIL_ANCHOR_MARKER', 'SELF_REVIEW_BLOCK'],
};

/** 占比 < 0.5 但仍有内容进实发的"数据表/容器"（登记备查；本体属库内数据） */
export const PROMPT_PARTIAL_CONTAINERS = {
  'src/config/examPaperBlueprints.js': ['EXAM_BLUEPRINTS'],
  'src/config/validatorRules.js': ['VALIDATOR_RULES'],
  'src/config/teachingBlueprints.js': ['TEACHING_BLUEPRINTS'],
  'src/config/domainContract.js': ['DOMAIN_CONTRACT', 'HIGH_DOMAIN_CONTRACT'],
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
    region: ['const ANS_ALIGN_TAIL_REF', 'const ansThinking'],
    items: [
      { id: 'ANS_ALIGN_TAIL_REF', head: '本条（答案区与正文逐题对齐）即【尾约束·全文自洽】', cond: '恒（2026-09-30 用户裁定：显式声明隶属，防两处各写一段）' },
      { id: 'ansAlignNote(自包含分支)', head: '答案区按正文对应的栏目组织、并与正文同构', cond: 'isSelfContainedTeaching' },
      { id: 'ansAlignNote(普通分支)', head: '**逐题对齐硬要求**：答案区**每个题目都以与正文完全相同的题号起头**', cond: '其余资料类型' },
      { id: 'selfContainedAnsNote', head: '【自包含教辅答案原则】答案区【只】给出正文中练习/自测/变式的解答', cond: 'isSelfContainedTeaching' },
      { id: 'ansMaterial 段标题', head: '【压缩原文·答案参考】', cond: 'answerPageNeedsSource(genType) && compressedText' },
      { id: '正文段标题', head: '【正文】', cond: '恒' },
      { id: '答案段标题', head: '【答案规范】', cond: '恒' },
      { id: '正文空兜底', head: '（正文为空，无法作答——请终止输出）', cond: '正文为空' },
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
  '层级/卷别提示（独立调用）': {
    file: 'src/config/levelMapping.js',
    builders: ['buildLevelInstruction', 'buildPaperKindHint'],
    consts: ['src/config/levelMapping.js: LEVEL_SOURCE'],
    cond: '按学科×学段×卷别',
  },
  '教材分析/知识点提取（独立调用）': {
    file: 'src/config/analysisPrompts.js',
    builders: [],
    consts: ['src/config/analysisPrompts.js: ANALYSIS_PROMPTS'],
    cond: '生成前对勾选章节做分析提取',
  },
};
