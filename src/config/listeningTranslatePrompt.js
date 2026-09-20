/**
 * 中文素材 → 英语听力稿（翻译 + 结构化）提示词（单一事实源）
 * ============================================================
 * 用途：用户**直接粘贴中文**时，先译为英语听力材料、并按同一契约结构化，
 *   之后与"粘贴英文"走**完全相同**的下游（listeningScript → SSML/朗读稿/逐句合成）。
 *
 * 🔴 与 listeningExtractPrompt 的关系（务必区分，别混用）：
 *   · listeningExtractPrompt＝**搬运**（一字不改，英语原文 → 结构）；
 *   · 本模块＝**翻译**（中文 → 英语听力稿，允许改写语序用词，但不得增删信息）。
 *   两者**共用同一份 JSON 契约**（LISTENING_STRUCT_SCHEMA），故下游解析、校验、出声逻辑零改动——
 *   这是本功能能低成本落地的关键。
 *
 * 🔴 中文成分必须保持中文：导语 / 分节播音指令 / 题号范围都是**播给学生听的中文指令**，
 *   翻成英文就不成其为考试录音了；只有 lines（听力材料正文）才翻译。
 *   （对应实测：把中文材料直接喂给中文音色朗读没有意义——它本该是英语听力材料。）
 *
 * ⚠️ 依赖云端模型：与 AI 兜底同一通道（chatNonThinkingOnce）。本地 Ollama 目前不可用，
 *   调用方需给出明确提示（见 GenerateModule 的分支处理）。
 * ============================================================
 */
import { LISTENING_STRUCT_SCHEMA } from './listeningExtractPrompt.js';

export const LISTENING_TRANSLATE_SYSTEM = `你是英语听力材料翻译与结构化助手。任务：把给定的中文听力素材翻译成**英语听力稿**，并按契约输出结构化 JSON。

硬性规则：
1. **只翻译听力材料正文**（lines 里的句子）：译成自然、地道的英语，符合听力语体——对话口语化、独白简洁清楚，句子不宜过长（要能听懂）。
2. **中文的导语、播音指令、题号范围一律原样保留中文，不要翻译**——它们是要播给学生听的中文指令：
   · intro：中文开场导语原样照抄；· instruction：中文播音指令（如「第一节，听下面5段对话…每段对话读两遍。」）原样照抄；
   · range：题号范围（如「听第6段材料，回答第6至第8题」）原样照抄；
   · 原素材若没有这些中文成分，留空串，不要自己编造。
3. **逐句拆分**：一句一个对象；对话按说话人轮次拆分，保持原始先后顺序（不要按角色分组重排）。
4. **角色判定**：男声 → "M"；女声 → "W"；独白/短文朗读/无法判断性别的旁白 → "N"。
   中文里未标注性别的叙述，用 "N"（不要猜）。
5. **题号**：按原素材的小题序号填 no（数字）。同一段材料对应多个小题时，填该段所属的**首个小題**号。
6. **信息等价**：这是翻译不是创作——允许调整语序与用词，但**不得增删信息**，不得添加原素材没有的情节或细节。
7. **只输出 JSON**：不要 markdown 代码块围栏，不要任何解释、前言、后记。`;

export const buildListeningTranslateUser = (sourceText = '') => `以下是用户粘贴的中文听力素材（可能含排版残留或中文播音指令）。请译为英语听力稿并按契约结构化：

${String(sourceText || '').trim()}`;

/** 组装 messages（供 chatNonThinkingOnce 使用）；契约与"搬运"路径**同源**，确保下游零改动 */
export const buildListeningTranslateMessages = (sourceText = '') => [
  { role: 'system', content: LISTENING_TRANSLATE_SYSTEM },
  { role: 'user', content: `${buildListeningTranslateUser(sourceText)}\n\n输出 JSON 契约：\n${LISTENING_STRUCT_SCHEMA}` },
];

export default {
  LISTENING_TRANSLATE_SYSTEM,
  buildListeningTranslateUser,
  buildListeningTranslateMessages,
};
