/**
 * 📐 覆盖契约（COVERAGE_CONTRACT）——"资料类型 × 教材层级覆盖要求"唯一事实源
 * ============================================================
 * 🔴 定位（2026-09 覆盖治理 P1）：P2 对账器 / 自动补漏 / 定向重试的判定基准；
 *    覆盖锚（coverageAnchor，P0）回答"哪些知识点可入题"，本契约回答"结果须覆盖到什么程度"。
 *    ⚠️ 术语口径（2026-09-14 用户定）：面向模型/用户的措辞用「知识点」不用「考点」；本契约覆盖全部资料类型。
 *
 * 五档模式语义（只描述要求，不含诱导；判定全部由程序确定性完成）：
 *   full            对勾选层级全覆盖：每知识点至少呈现一次；呈现形态不限——例题/算理内嵌/归纳条目/
 *                   "你知道吗"科普框等非例题形态同样计入覆盖（覆盖锚绑定已含非例题形态，此处口径一致）
 *   per-lesson-full 以课为单元全覆盖：单次生成多课时 = 各课并集达标；复生成单课时按单课达标
 *   focus           聚焦覆盖：只覆盖资料主题对应的层级知识点（专项/阅读按主题选点，不要求全层级出现）
 *   none            不按层级覆盖：围绕用户素材组织，不与教材层级做覆盖对账
 *   sampled         抽样覆盖：按命题蓝图抽样（双向细目表语义），允许部分层级未出现，不补漏
 *
 * 9 类型映射（与 GEN_TYPE_NAMES 键严格一致，测试守卫）：
 *   知识型（summary/preview/dictation/review）= full：梳理型内容，勾选即覆盖全层级
 *   practice = per-lesson-full：随堂练习须完整覆盖当课全部知识点
 *   special/reading = focus：专项/阅读按主题选点聚焦
 *   errorbook = none：错题围绕用户错题，不与层级对账
 *   exam = sampled：正式考卷抽样命题，允许未覆盖，不补漏
 * ============================================================
 */
import { GEN_TYPE_NAMES } from './promptLibrary.js';

/**
 * 资料类型 → 覆盖契约（key 与 GEN_TYPE_NAMES 一致；新增类型须在此登记否则按 none 兜底）
 * ✅ A9（2026-09-11 清理，依据 docs/design/极简方案-定稿.md 第三节）：原 `COVERAGE_MODES` /
 *    `COVERAGE_MODE_DESC` 两个导出仅服务已废除的覆盖对账/补漏 UI，生产零调用 → 已移除；
 *    五档语义保留在本文件头部注释（唯一描述点不丢），契约本体 `COVERAGE_CONTRACT` / `contractOf` 不变。
 */
export const COVERAGE_CONTRACT = {
  summary: { name: GEN_TYPE_NAMES.summary, mode: 'full' },
  preview: { name: GEN_TYPE_NAMES.preview, mode: 'full' },
  dictation: { name: GEN_TYPE_NAMES.dictation, mode: 'full' },
  review: { name: GEN_TYPE_NAMES.review, mode: 'full' },
  practice: { name: GEN_TYPE_NAMES.practice, mode: 'per-lesson-full' },
  special: { name: GEN_TYPE_NAMES.special, mode: 'focus' },
  reading: { name: GEN_TYPE_NAMES.reading, mode: 'focus' },
  errorbook: { name: GEN_TYPE_NAMES.errorbook, mode: 'none' },
  exam: { name: GEN_TYPE_NAMES.exam, mode: 'sampled' },
};

/** 契约读取（未知类型安全兜底：不参与层级对账） */
export const contractOf = (genType) =>
  COVERAGE_CONTRACT[genType] || { name: GEN_TYPE_NAMES[genType] || genType || '', mode: 'none' };

/**
 * 🧭 覆盖扩展口径（2026-09-13 用户定版）——在"清单=覆盖下限"之上，能否在清单之外扩展、如何扩展。
 * 🔴 与 mode 互补的第二维：mode 回答"覆盖到什么程度"，extent 回答"清单之外还能不能加、加什么"。
 *    分档动因：一刀切放开会让**归纳/默写类**跑出课本（用户实证担忧）——题类要"考迁移"，归纳类要"成网络"，
 *    预习/默写要"守本课/守教材"，三者诉求不同，故按资料类型分档，不共用一句话。
 *   expand    命题/练习类：可依本学段课标学业要求，补充清单未涉及的**知识点或考查角度**（考迁移运用）
 *   integrate 归纳/复习类：可做**同类/结构关联**（把本课知识与同类概念归类、对照、勾连成网络），
 *             并联系**能在本次勾选范围或【锚点清单】内确认的**先行内容——**不臆断学生"是否已学"**
 *             （未经确认的旧知不引入：模型对"已学"的记忆是各版本混合的，易误关联到本版本尚未学的内容）。
 *             ——课标依据：语文「梳理与探究」要求"按一定标准分类整理学过的语言材料、梳理经验、发现规律"；
 *             数学强调"课程内容结构化/整体性关联性"，复习不止复现、要发现规律与联系。**边界=本学段课标 + 可确认范围**。
 *   strict    预习/默写类：只按清单（本课/本单元）呈现，不做清单外补充（默写须严格对应教材要求）
 */
export const COVERAGE_EXTENT = {
  exam: 'expand',
  practice: 'expand',
  special: 'expand',
  reading: 'expand',
  errorbook: 'expand',
  summary: 'integrate',
  review: 'integrate',
  preview: 'strict',
  dictation: 'strict',
};

/** 扩展口径读取（未知类型安全兜底：从严，不扩散） */
export const extentOf = (genType) => COVERAGE_EXTENT[genType] || 'strict';

/**
 * 📚 素材通道默认映射（2026-09-14 用户定版开关）——资料类型 × 教材素材注入口径，唯一事实源。
 *    与 COVERAGE_CONTRACT 同源分类（知识型 vs 命题/练习型）：
 *    'full'   全文注入（归纳/积累型默认）：整章原文 → 直放/压缩 → 全部进指令（梳理型需看原文）
 *    'anchor' 锚清单注入（命题/练习型默认）：不注入整章原文，只注入【锚点清单】（含第3层具体概念，
 *             知识明细 A17）+ 难度要求，抑制模型对教材原文的过度依赖，省压缩调用与输入费。
 *    用户在设置页可选 auto（按本表）/ full / anchor（手动覆盖对所有类型生效）。
 *    ⚠️ 术语口径（2026-09-14 用户定）：面向模型/用户的措辞用「知识点」，不用「考点」；
 *       通道名用「锚清单注入」（原"标尺注入"与「难度标尺」同词两义，易混）。
 */
export const MATERIAL_CHANNEL_DEFAULT = {
  summary: 'full', review: 'full', preview: 'full', dictation: 'full',
  exam: 'anchor', practice: 'anchor', special: 'anchor', reading: 'anchor', errorbook: 'anchor',
};

/** 素材通道读取（未知类型安全兜底：按"需要原文"的全文注入处理） */
export const materialChannelOf = (genType) => MATERIAL_CHANNEL_DEFAULT[genType] || 'full';

/**
 * 📝 答案页是否携带【压缩原文·答案参考】（**单一事实源**，2026-09-18 用户裁定）
 * ============================================================
 * 🔴 用户裁定原话："生成的正文中不要把大段原文混进来，**答案模块根据正文生成**，就不会有污染风险了"——
 *    **结构上切断，胜过再加条款**。
 * 为什么必须收紧：答案页原先按 `contractOf(genType).mode === 'full'` 携带【压缩原文·答案参考】，
 *    于是教材原文（含其活动与题目）一并送进答案页 → 模型把**素材里的题目/栏目**当作本资料的题作答
 *    （实证：六年级英语《知识梳理》答案区出现 Cartoon time / Story time / Grammar time 等教材栏目）。
 * 口径：**只有"答案本身即原文 / 即教材原题之答案"的类型**才需要携带——
 *    · dictation（默写）：答案就是教材原文本身，不带则无法给答案；
 *    · preview（预习）：课后问答即教材原题之答案（该栏目条款要求逐题给出答案与要点）。
 *    其余类型（知识总结/复习等归纳型，以及命题/练习型）**一律只喂【正文】**——其答案只对正文里
 *    实际出现的练习题，依据正文即可，结构上不可能再引用素材内容。
 * 消费方：useAiGenerator 答案页组装（ansMaterial）。注意：injectionManifest 的**请求实发清单**描述的是
 *    **正文调用**的块序（中段素材等），答案页是**独立调用**、不在该清单内（改本函数不影响清单口径）。
 */
export const ANSWER_PAGE_SOURCE_TYPES = ['dictation', 'preview'];
export const answerPageNeedsSource = (genType) => ANSWER_PAGE_SOURCE_TYPES.includes(genType);
