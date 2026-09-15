/**
 * 实发注入清单 · 单源（S3.2 委托书纯净化的延伸 · 2026-09-14 用户同意）
 * ============================================================
 * 目标：把"写作请求里除委托正文之外的每一块"集中到一处定义，**生成端与生成面板共用同一份**——
 *   ① 生成端 useAiGenerator.buildPrompt：按 buildUserMessagePrompt 拼出实发文本；
 *   ② 生成面板 GenerateModule「请求实发清单」：按 buildUserMessageBlocks 逐段展示同一份，
 *      做到"点开即实发全貌"（谁注入的、按什么顺序、内容是什么）。
 * 为什么必须单源：这些块原先内联在生成端函数里，面板看不到 → 用户只看到委托正文，
 *   "实际发出去的是什么"成了黑盒（A20/A21 反复治的就是这类两套口径）。
 * 拼接口径（🔴 防生成输出漂移）：每块 text **自带前后分隔**（块间以 \n\n 相连，含原有尾换行），
 *   最终 prompt = blocks.map(b => b.text).join('')，与改造前逐字节一致。
 * 注入顺序（A4-4 定版，LLM 首尾强/中段弱）：
 *   锚点清单（开头）→ 压缩原文（中段素材）→ 素材使用约定 → 组织方式 → 委托正文（末尾锚定）
 *   → 模板对标 → 情境框架 → 差异化（复生成）→ 输出约定 → 尾约束×2。
 * 作用域：本清单属**用户消息**（委托请求）；system 消息（渲染契约/质检规则/守门条款兜底）
 *   由 utils/programAttach.js 单源产出，两者合起来才是"本次实发全貌"。
 * ============================================================
 */
import { PAPER_OUTPUT_CONVENTIONS, AUTONOMOUS_ITEM_TYPES } from '../config/promptLibrary.js';
// 🔴 题组"分组与命名"约束的适用题类（AUTONOMOUS_ITEM_TYPES）：单源定义在 config/promptLibrary.js（文本层），
//    此处反向引用——避免两处各写一份（本模块本就 import 该文件，无循环依赖）。语义与理由见该处注释。
export { AUTONOMOUS_ITEM_TYPES };
import { contractOf, extentOf } from '../config/coverageContract.js';
import { ANCHOR_LIST_ROLE_NOTE } from './anchorTreeContract.js';

/** 自包含教辅（正文本身即内容梳理）：答案区只对练习/自测/例题作答，严禁整篇复述正文梳理 */
export const SELF_CONTAINED_TEACHING = ['summary', 'review', 'preview', 'dictation', 'errorbook'];

/** 情境错峰仅对"命题出新题"的题类生效（exam/practice/special/reading）；内容型无情境设问 */
export const SCENE_REGEN_TYPES = ['exam', 'practice', 'special', 'reading'];

/** 尾约束·全文自洽（原内联于 useAiGenerator.buildPrompt；块内自带 \n\n 前缀，见 buildTailBlocks） */
export const TAIL_SELF_CONSISTENCY = `【尾约束·全文自洽】
题干所声明的、本题作答所必需的一切内容（不论其形态），都必须在正文中真实、足量、形式吻合地存在——使本题**仅凭正文自身即可完成**；凡题干提到而正文未给出、或给出但不完整、不足以支撑该设问、或与正文不符，以及内容漏错、自相矛盾的，均属无效内容，须于定稿前修正。素材依课标可取自教材之外的真实情境、不限所选教材，但题面引用或呈现的素材必须与本题实际给出的内容完全一致；正文不得先现待作答结论；正文对知识、要点、示例、数据、结论的归纳与转述须准确、完整、不遗漏、条理清晰，各题、各要点、各结论及其答案之间前后一致、互不矛盾。`;

/** 尾约束·资料内多样（跨 9 类通用） */
export const TAIL_VARIETY = `【尾约束·资料内多样】
同一份资料内各部分的形式与先后应有变化，逐部分、逐单元换一套版式。`;

/** ① 锚点清单（写作期前缀首位；含第1层知识主题 + 第2层知识点；第3层具体概念随用户开关） */
export const buildAnchorListBlock = (anchorListText = '', roleNote = ANCHOR_LIST_ROLE_NOTE) =>
  `【锚点清单】\n${roleNote}\n${anchorListText}\n\n`;

/** ② 压缩原文（中段素材；锚清单通道不注入） */
export const buildCompressedTextBlock = (compressedText = '') =>
  `【压缩原文】\n${compressedText}\n\n`;

/**
 * ③ 素材使用约定（引用约束按契约 mode 分流；口径 2026-09-13 用户定版）
 *   范围（要练到哪些内容）以【锚点清单】为准；**素材来源不作指定**（教材与课外真实生活等权）。
 *   下限按 mode 分档、下限之上能否"加"按资料类型分档（extentOf 单一事实源 coverageContract）。
 */
export const buildMaterialUsageBlock = ({ genType = '', materialChannel = 'auto' } = {}) => {
  const parts = [];
  const refMode = contractOf(genType).mode;
  // ✅ A17（2026-09-14 用户定版）：锚清单通道不注入整章原文（语料锚已移除），"中段素材区"仅存在于全文通道；
  //    锚清单通道的教材内容/难度/版本口径依据 = 开头【锚点清单】（含第3层具体概念）——
  //    命题型不许照搬原文，故不引用原文语段，只锚定知识明细；"不得照搬题目"句在锚清单通道不注入。
  const refClause = materialChannel === 'anchor'
    ? '以上内容（含各知识点具体概念）是理解教材内容、难度与版本口径的**依据**'
    : '中段【压缩原文】是理解教材内容与难度的**参考之一**';
  // 🔴 覆盖口径按资料类型分档（2026-09-13 用户定版）：mode 定"覆盖到什么程度"，extentOf 定"范围之外怎么加"——
  //    防一刀切放水：题类可考迁移（expand）、归纳复习类可关联已学旧知成网络（integrate）、预习默写类守本课/守教材（strict）。
  // 🔒 2026-09-15 用户裁定·去诱导（整类问题）：本块原为"对账语言"重灾区——下限／都要练到／逐条对账／
  //    不要求出现／允许未出现／不补漏／不是命题上限／不是范围围墙／不做清单外补充，全是**可逐条核对的强制句**
  //    与**否定定义**。实证后果：模型为了满足"可核对"，把内容明细条目直接升为大题标题（08e6ccd 产物）。
  //    现一律改为**范围陈述**（正向、不带对账名词），并去掉点名的块名（改"以上内容"）。
  const coverageFloor = refMode === 'per-lesson-full'
    ? '以上内容即本次要练到的范围（本单元必学内容）；'
    : refMode === 'full'
      ? '以上内容是本次归纳的范围；'
      : refMode === 'focus'
        ? '围绕与本资料主题对应的内容展开；'
        : refMode === 'sampled'
          ? '按命题蓝图从以上内容中抽样；'
          : '本资料围绕错题组织；';
  const extentKey = extentOf(genType); // expand | integrate | strict（single source：coverageContract）
  const coverageExtent = extentKey === 'expand'
    ? '可依本学段课标学业要求另取其他知识点或考查角度（不超出本学段学业要求）；'
    : extentKey === 'integrate'
      ? '可把本课内容与同类概念归类、对照、勾连成网络，也可联系可确认的先行内容（不臆断学生是否已学；不超出本学段课标要求）；'
      : '按本课/本单元内容呈现（默写类须严格对应教材要求）；';
  parts.push('【素材使用约定】\n'
    + `· ${coverageFloor}${coverageExtent}${refClause}；情境、素材、人名、数据与句式可取自教材，也可取自课外真实生活（主题相关、难度适切），来源不限、不作指定；\n`);
  parts.push(refMode === 'full'
    ? (materialChannel === 'anchor'
      ? '· 本资料为知识归纳型（本次按锚清单通道生成）：归纳范围以上方清单为准，可依教材事实与课外同类材料转写为教辅表述，不得整段照录；正文不得出现任何出处标注（"选自/单元/章节/课题/课文名/位置式指引/原文出处"等溯源字样一律不写）。\n'
      : '· 本资料为知识归纳型：可引用、可归纳中段【压缩原文】，但须转写为教辅表述，不得整段照录；正文不得出现任何出处标注（"选自/单元/章节/课题/课文名/位置式指引/原文出处"等溯源字样一律不写）。\n')
    : (materialChannel === 'anchor'
      ? '· 本资料为命题/练习型：题型、知识梯度与难度按上方内容（含具体概念）把握；题干、情境、人名、数据与句式由你拟定，来源按上述口径。\n'
      : '· 本资料为命题/练习型：中段【压缩原文】供你理解题型结构、知识梯度与难度；题干、情境、人名、数据与句式由你拟定，来源按上述口径。\n'));
  // 🔴 题型多样注入：**2026-09-15 用户定版已整条撤除**（连同上方的 TYPED_PRACTICE_ITEM_TYPES 单列集）。
  //    撤除理由：该句把作答方式锚到"本学科本学段日常练习的常态分布 / 按本学段常规自选"——与模板·分组句、
  //    输出格式·栏内组织句同向，三处合起来使**两次独立调用**产出的题型高度趋同（实证：7 类题型完全重合、
  //    顺序近似）。用户裁定：题型与题量**一律交模型侧自选，不作任何锚定**；退出后不再有"题型须多样"约束，
  //    单一形态的极端风险由模型自身能力与程序侧静默抽检（篇幅/题量）兜底，不再事前约束。
  //    （原根因记录保留备查：题类无题型来源 → 曾出现"整份只剩填空/朗读/简答一类"。）
  // 🔴 禁照搬（通道无关 · 2026-09-14 用户裁定）：原句「【压缩原文】中的练习/习题段仅供理解题型与难度，
  //    不得照搬题目」是**挂在【压缩原文】上**的 → 锚清单通道没有原文，整句被跳过 → 该通道下**没有任何
  //    禁止照搬的约束**，模型直接整段沿用/照录教材语篇（实测：照搬守门命中「She was afraid of acting
  //    in front of many people」10 词连续重合教材参考段）。现提升为**通道无关**；并明确清单里的语篇类
  //    条目只用于核对覆盖与理解难度（命题型不得拿教材现成语篇/练习当题目内容）——**仍不指定来源**
  //    （教材与课外等权，见上一条"来源不限、不作指定"）。归纳型（mode=full）不复述：其"不得整段照录"
  //    已在上一条给出（单一事实源，防句级重复）。
  if (refMode === 'full') {
    parts.push('\n');
  } else {
    parts.push('· 不得照搬教材原题，也不得整段沿用教材语篇或连续照录教材文字（与教材参考段连续重合即属照搬）；题目内容须为本资料自行组织：可取材教材话题或课外真实生活（来源不限、不作指定），但不得直接复用所选教材原有语篇的情节、篇目结构与人物设定；标◇的材料用于把握难度与理解语境，不必为其单独设题。\n\n');
  }
  return parts.join('');
};

/** ④ 组织方式（按委托书给出的序列搭好各部分；每部分内的题组由模型自拟标题） */
export const buildOrganizeBlock = (genType = '') => {
  // 引用按类型：exam 用【卷面结构】，其余教辅用【教辅结构】（三维度精确，2026-09 清理）。
  // 🔒 2026-09-15 用户裁定·Q2：exam 分支一个字不动（动了就不是正规卷）；非 exam 分支删去"题量"空指针
  //    ——【教辅结构】注入只含 各部分序列 + 学段要求，题量/篇幅按设计不注入（teaching-volume-guard 生成后静默校验）。
  // 🔒 2026-09-15 用户裁定·去诱导（整类问题）：非 exam 分支删去两句**否定式关联**——
  //    「开头【锚点清单】只声明要练到的范围，不是组织方式，不得据此替代委托书结构」
  //    与「不以清单条目作分组或命名」。理由（产物实证）：否定句要读懂，必须先建立
  //    "内容明细条目 ↔ 分组/命名"这条映射，等于把错误做法反向植入；实测正是把内容条目直接当了大题标题。
  //    现改**正向动作描述**，且不点名任何块名与结构词（用"各部分"）。
  const isExam = genType === 'exam';
  const lead = isExam
    ? '输出一律以委托书【卷面结构】的大题序列组织（大题名、顺序、题量以委托书为准）；开头【锚点清单】只声明要练到的范围，不是组织方式，不得据此替代委托书结构。'
    : '按委托书给出的各部分名称与先后搭好各部分。';
  // 题类（同步练习/专项/阅读）：每部分内的题组由模型按内容与任务需要自行划分并自拟标题
  //   （原"按本学科本学段的常规题型或任务的开展环节来"已撤除——与模板/输出格式句同向，曾共同造成题型趋同）
  const groupClause = AUTONOMOUS_ITEM_TYPES.includes(genType)
    ? '每部分内由你按内容与任务需要分组成题组，组标题自拟——一句话概括该组在练什么。'
    : '';
  return `【组织方式】${lead}${groupClause}\n\n`;
};

/** ⑤ 模板对标（用户勾选模板，供风格/结构参考，不限制命题） */
export const buildTemplateInfoBlock = (templateInfo = '') => (templateInfo?.trim()
  ? `\n\n【模板对标】（用户勾选的模板，供风格/结构参考，不限制命题）\n${templateInfo.trim()}`
  : '');

/** ⑥ 情境框架 */
export const buildContextBlock = (contextFramework = '') =>
  (contextFramework?.trim() ? `\n\n${contextFramework.trim()}` : '');

/** ⑦ 差异化（复生成）：已覆盖知识点 + 情境错峰（仅题类生效） */
export const buildDiffRegenBlock = ({ genType = '', diffKps = [] } = {}) => {
  if (!diffKps?.length || !SCENE_REGEN_TYPES.includes(genType)) return '';
  return `\n\n【差异化要求（复生成）】以下知识点已练过，请优先选择其他知识点或从不同角度考查：${diffKps.join('、')}。情境错峰：本次为同一范围的再次出稿，新稿的情境、人物/场景、数据与设问角度须与已生成稿件错开——命中已用情境即换情境、换对象、换数据、换设问角度，不得沿用上稿的情境模板与雷同句子。`;
};

/** ⑧ 输出约定（once 一次成型 / split 两次生成；正文后答案区口径随自包含教辅分档） */
export const buildOutputBlock = ({ subject = '', genType = '', outputMode = 'split' } = {}) => {
  const selfContained = SELF_CONTAINED_TEACHING.includes(genType);
  return outputMode === 'once'
    ? `\n\n${PAPER_OUTPUT_CONVENTIONS.once(subject, selfContained)}`
    : `\n\n${PAPER_OUTPUT_CONVENTIONS.split(subject, selfContained)}`;
};

/** ⑨⑩ 尾约束×2（置于委托书最末尾锚定；压缩期命中 guaranteeRegex 不丢锚） */
export const buildTailBlocks = () => [
  `\n\n${TAIL_SELF_CONSISTENCY}`,
  `\n\n${TAIL_VARIETY}`,
];

/**
 * 实发块定义表（**顺序与文本的唯一事实源**）：生成端与面板都走这里。
 * lib：点击跳转的目标库（'builtin' = 程序内置条款，无对应库、不可点跳）
 * build(ctx)：本次实发文本（门控已应用，空串 = 本次不注入）
 * preview(ctx)：面板预览文本（仅用于"有素材时才注入"这类门控块——面板看不到素材内容，
 *   但条款文本本身由 genType×通道决定，可先行展示并注明注入条件）
 */
const BLOCK_DEFS = [
  {
    id: 'anchor-list', name: '锚点清单', lib: 'builtin', scope: '用户消息·开头',
    note: '生成时按勾选章节的分析结果注入：第1层知识主题作分组前缀、第2层知识点为主体、第3层具体概念随各知识点括注；要练到的内容以范围陈述给出（2026-09-15 去对账语言）',
    noteWith: (c) => [
      (c.injectThirdLayer === undefined
        ? ''
        : `（当前设置：${c.injectThirdLayer === false ? '不注入' : '注入'}第3层具体概念，可在设置里切换）`),
      c.materialProvenance || '',
    ].filter(Boolean).join(' '),
    // 🧾 (ii) 2026-09-14：正文用**实发快照**（含当时实发的角色说明）——第3层关闭时实发的角色说明
    //    与默认版不同，面板若用默认版则"看到的≠发出去的"（这一点正是 A20/A21 治理的对象）
    build: (c) => (c.anchorListText
      ? buildAnchorListBlock(c.anchorListText, c.anchorListRoleNote || ANCHOR_LIST_ROLE_NOTE)
      : ''),
  },
  {
    id: 'compressed-text', name: '压缩原文', lib: 'builtin', scope: '用户消息·中段素材',
    note: '生成时按勾选章节原文压缩注入；锚清单通道不注入（A17）',
    noteWith: (c) => c.materialProvenance || '',
    build: (c) => (c.compressedText ? buildCompressedTextBlock(c.compressedText) : ''),
  },
  {
    id: 'material-usage', name: '素材使用约定', lib: 'builtin', scope: '用户消息',
    note: '有素材（清单/原文）注入时随请求发出；文本由 资料类型×素材通道 决定',
    build: (c) => ((c.anchorListText || c.compressedText) ? buildMaterialUsageBlock(c) : ''),
    preview: (c) => buildMaterialUsageBlock(c),
  },
  {
    id: 'organize', name: '组织方式', lib: 'builtin', scope: '用户消息',
    note: '有素材（清单/原文）注入时随请求发出',
    build: (c) => ((c.anchorListText || c.compressedText) ? buildOrganizeBlock(c.genType) : ''),
    preview: (c) => buildOrganizeBlock(c.genType),
  },
  {
    id: 'instruction', name: '委托正文', lib: 'instruction', scope: '用户消息·末尾锚定',
    note: '即上方注入框内容（已按素材通道归一）；此处不重复展开',
    // 🔴 委托正文是实发主体，必须计入 prompt（pointer 只影响面板展示，不影响拼接）
    build: (c) => (c.instructionText || ''),
    pointer: true,
    // noteWith：面板侧追加说明——生成期还会在本块**末尾**追加什么（【组织风格】/第二类型起的
    //   【差异化要求】）。这两块不在注入框里、也不属程序附加段，若不说明，面板就不是"实发全貌"。
    noteWith: (c) => c.instructionExtraNote,
  },
  {
    id: 'template-info', name: '模板对标', lib: 'builtin', scope: '用户消息',
    note: '勾选了参考模板时才注入',
    build: (c) => buildTemplateInfoBlock(c.templateInfo),
  },
  {
    id: 'context-framework', name: '情境框架', lib: 'builtin', scope: '用户消息',
    note: '本资料类型配置了情境框架时才注入',
    build: (c) => buildContextBlock(c.contextFramework),
  },
  {
    id: 'diff-regen', name: '差异化要求（复生成）', lib: 'builtin', scope: '用户消息',
    note: '复生成且存在已练过知识点时注入（仅题类：考卷/同步练习/专项/阅读）',
    build: (c) => buildDiffRegenBlock(c),
  },
  {
    id: 'output-convention', name: '输出约定', lib: 'builtin', scope: '用户消息',
    note: '按设置页生成方式注入（once 一次成型 / split 两次生成）',
    build: (c) => buildOutputBlock(c),
  },
  {
    id: 'tail-self', name: '尾约束·全文自洽', lib: 'builtin', scope: '用户消息·最末尾锚定',
    note: '跨 9 类通用；压缩期保留不丢锚',
    build: () => buildTailBlocks()[0],
  },
  {
    id: 'tail-variety', name: '尾约束·资料内多样', lib: 'builtin', scope: '用户消息·最末尾锚定',
    note: '跨 9 类通用；压缩期保留不丢锚',
    build: () => buildTailBlocks()[1],
  },
];

/**
 * 实发块清单（生成端与面板共用）
 * @param {object} ctx
 * @param {string} [ctx.genType] 资料类型键
 * @param {string} [ctx.subject] 规范化学科
 * @param {string} [ctx.materialChannel] 已解析的素材通道（full/anchor）
 * @param {string} [ctx.anchorListText] 锚点清单文本（生成时真实值；面板侧取实发快照，无快照则空）
 * @param {string} [ctx.anchorListRoleNote] 清单角色说明（与实发逐字一致；缺省用默认版）
 * @param {string} [ctx.compressedText] 压缩原文文本（生成时真实值；锚清单通道为空）
 * @param {string} [ctx.materialProvenance] 素材正文来源说明（🧾 (ii)：面板展示实发正文时必须交代
 *    "这是哪一次生成的实发原文、当时口径是否仍与当前一致"，防被误读为"当前勾选算出来的清单"）
 * @param {string} [ctx.instructionText] 已按通道归一的委托正文（生成时传入；面板侧传空即可）
 * @param {string} [ctx.templateInfo] 勾选模板信息
 * @param {string} [ctx.contextFramework] 情境框架
 * @param {string[]} [ctx.diffKps] 已练过知识点
 * @param {string} [ctx.outputMode] 'once' | 'split'
 * @param {boolean} [ctx.preview] 面板预览模式：门控块给出可先行展示的条款文本（不用于拼接实发）
 * @returns {Array<{id,name,lib,scope,note,text,injected:boolean}>}
 */
export function buildUserMessageBlocks(ctx = {}) {
  return BLOCK_DEFS.map((d) => {
    const real = String(d.build(ctx) || '');
    return {
      id: d.id, name: d.name, lib: d.lib, scope: d.scope,
      note: [d.note, d.noteWith ? d.noteWith(ctx) : ''].filter(Boolean).join(' '),
      // text：面板展示文本（pointer 块只给说明、不重复展开；预览模式下门控块给出可先行展示的条款原文）
      text: d.pointer ? '' : (real || (ctx.preview && d.preview ? String(d.preview(ctx) || '') : '')),
      // injected：该块本次是否会随请求发出——门控块只认门控结果（与预览无关）；
      //   pointer 块（委托正文）永远随请求发出，其内容在上方注入框/生成端拼入，不在此处重复展开
      injected: d.pointer ? true : !!real,
    };
  });
}

/**
 * 实发用户消息全文（🔴 与原内联拼接逐字节一致——块文本自带分隔，直接顺序相连）
 * @returns {string}
 */
export function buildUserMessagePrompt(ctx = {}) {
  return BLOCK_DEFS.map((d) => String(d.build(ctx) || '')).join('');
}

export default {
  SELF_CONTAINED_TEACHING, SCENE_REGEN_TYPES, AUTONOMOUS_ITEM_TYPES,
  TAIL_SELF_CONSISTENCY, TAIL_VARIETY,
  buildAnchorListBlock, buildCompressedTextBlock, buildMaterialUsageBlock, buildOrganizeBlock,
  buildTemplateInfoBlock, buildContextBlock, buildDiffRegenBlock, buildOutputBlock, buildTailBlocks,
  buildUserMessageBlocks, buildUserMessagePrompt,
};
