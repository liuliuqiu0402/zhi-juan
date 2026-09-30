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
  { name: '不得另起同性质整行短答载体', re: /不得再另起/g, allow: 1, note: '⑤ 唯一正句' },
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
