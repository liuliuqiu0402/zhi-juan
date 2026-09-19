/**
 * 听力原文结构化提取提示词（单一事实源）
 * ============================================================
 * 用途：把**已生成的答案页听力原文**转成机器可读结构，供
 *   utils/listeningScript.js 产出 SSML / 朗读稿（"复制即用"）。
 * 为什么单独成模块而非并入 config/promptLibrary.js：
 *   该库自述为"**整卷生成端**专用提示词（由 useAiGenerator 导入）"；本提示词服务于
 *   **生成后的独立处理**（按需触发、不参与整卷 prompt 组装），两者生命周期不同。
 *   单独成模块属"按管线归组"，不是散落常量；同一管线的提示词集中在此，不得再写到调用处内联。
 * 🔴 本任务只做**结构化搬运**，不做内容创作：不得改写、增删、润色任何词句——
 *   听力原文一变，"学生听到的"就与"答案按文本批改的"不一致（一致性红线）。
 * ============================================================
 */

/** 严格 JSON 契约（机器可读；解析与校验见 utils/listeningExtract.js） */
export const LISTENING_STRUCT_SCHEMA = `{
  "intro": "中文播报导语（原文有则照抄，无则空串）",
  "items": [
    {
      "no": 1,
      "instruction": "该节的中文播音指令（原文有则照抄，如「第一节，听下面5段对话…每段对话仅读一遍。」；无则空串）",
      "range": "该段材料的题号范围（原文有则照抄，如「听第6段材料，回答第6至第10题」；一题一材料或无标注时留空串）",
      "lines": [
        { "role": "M", "text": "男声所说原句" },
        { "role": "W", "text": "女声所说原句" }
      ]
    }
  ]
}`;

export const LISTENING_EXTRACT_SYSTEM = `你是听力稿结构化助手。你的唯一职责是：把给定的英语听力原文，原样搬运为结构化 JSON。

硬性规则：
1. **只搬运，不创作**：一字不得改写、增删、润色、纠错、翻译。标点与拼写保持原样（含缩写如 It's / don't）。
2. **逐句拆分**：一句一个对象。对话按说话人轮次拆分，保持原始先后顺序（严禁按角色分组重排）。
3. **角色判定**：男声 → "M"；女声 → "W"；独白/短文朗读/听不出来源性别的旁白 → "N"。
   原文以 M:/W:/Man:/Woman:/男：/女：/A:/B: 等标记说话人时，据此判定；
   无法判断性别时一律用 "N"，不要猜。
4. **题号**：按原文小题序号填 no（数字）。同一段材料对应多个小题时，按该材料所属的**首个小題**号填。
5. **只要听力材料本身**：中文题干、"听下面一段对话…"之类**开场**播音指令放 intro；
   题目选项（A. / B. / C.）、作答要求、分值、【听力原文】这类区块标题一律不要进入 lines。
6. **分节播音指令**：原文含有以「第一节」「第二节」「第一部分」等起头、说明该节听音方式与遍数的
   中文播音指令时，把它原样放进**该节首题**的 instruction 字段（不要并进 lines，也不要全塞进 intro）；
   这样朗读顺序才是"指令 → 该节材料"。原文没有则留空串。
7. **题号范围**：原文若有"听第6段材料，回答第6至第10题"这类**题号范围行**，把它原样放进
   该段材料的 range 字段（它由音频播报用于报准题号）；**不要并进 lines**（它不是听力材料，
   混进去会被当材料念出来），也不要丢进 intro。
8. 原文若含多个大题（如"一、听音选图""二、听音判断"），全部按顺序并入 items。
9. **只输出 JSON**：不要 markdown 代码块围栏，不要任何解释、前言、后记。`;

export const buildListeningExtractUser = (sourceText = '') => `以下是从答案页复制出来的听力原文（可能含少量排版残留）。请按契约结构化：

${String(sourceText || '').trim()}`;

/** 组装 messages（供 chatNonThinkingOnce 使用） */
export const buildListeningExtractMessages = (sourceText = '') => [
  { role: 'system', content: LISTENING_EXTRACT_SYSTEM },
  { role: 'user', content: `${buildListeningExtractUser(sourceText)}\n\n输出 JSON 契约：\n${LISTENING_STRUCT_SCHEMA}` },
];

export default {
  LISTENING_STRUCT_SCHEMA,
  LISTENING_EXTRACT_SYSTEM,
  buildListeningExtractUser,
  buildListeningExtractMessages,
};
