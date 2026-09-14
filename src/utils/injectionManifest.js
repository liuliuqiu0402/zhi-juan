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
import { PAPER_OUTPUT_CONVENTIONS } from '../config/promptLibrary.js';
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
同一份资料内各栏目呈现形式与组织顺序应有所差异，不得全份同类版式照搬；同一呈现方式与同一组织顺序不可逐栏、逐单元反复套用。`;

/** ① 锚点清单（写作期前缀首位；含第1层知识主题 + 第3层具体概念） */
export const buildAnchorListBlock = (anchorListText = '') =>
  `【锚点清单】\n${ANCHOR_LIST_ROLE_NOTE}\n${anchorListText}\n\n`;

/** ② 压缩原文（中段素材；锚清单通道不注入） */
export const buildCompressedTextBlock = (compressedText = '') =>
  `【压缩原文】\n${compressedText}\n\n`;

/**
 * ③ 素材使用约定（引用约束按契约 mode 分流；口径 2026-09-13 用户定版）
 *   范围（覆盖哪些知识点）以【锚点清单】为准；**素材来源不作指定**（教材与课外真实生活等权）。
 *   下限按 mode 分档、下限之上能否"加"按资料类型分档（extentOf 单一事实源 coverageContract）。
 */
export const buildMaterialUsageBlock = ({ genType = '', materialChannel = 'auto' } = {}) => {
  const parts = [];
  const refMode = contractOf(genType).mode;
  // ✅ A17（2026-09-14 用户定版）：锚清单通道不注入整章原文（语料锚已移除），"中段素材区"仅存在于全文通道；
  //    锚清单通道的教材内容/难度/版本口径依据 = 开头【锚点清单】（含第3层具体概念）——
  //    命题型不许照搬原文，故不引用原文语段，只锚定知识明细；"不得照搬题目"句在锚清单通道不注入。
  const refClause = materialChannel === 'anchor'
    ? '开头【锚点清单】（含各知识点具体概念）是理解教材内容、难度与版本口径的**依据**'
    : '中段【压缩原文】是理解教材内容与难度的**参考之一**';
  // 🔴 覆盖口径按资料类型分档（2026-09-13 用户定版）：mode 定"覆盖下限"，extentOf 定"清单之外能不能加、加什么"——
  //    防一刀切放水：题类可考迁移（expand）、归纳复习类可关联已学旧知成网络（integrate）、预习默写类守本课/守教材（strict）。
  const coverageFloor = refMode === 'per-lesson-full'
    ? '开头【锚点清单】的知识点**至少要全部覆盖到**（覆盖**下限**，保证本单元必学知识不漏）；'
    : refMode === 'full'
      ? '开头【锚点清单】的知识点**须全部覆盖到**（覆盖**下限**，保证本单元必学知识不漏）；'
      : refMode === 'focus'
        ? '覆盖开头【锚点清单】中与本资料主题对应的知识点即可（不要求清单全部出现）；'
        : refMode === 'sampled'
          ? '按命题蓝图抽样覆盖开头【锚点清单】（允许部分知识点未出现，不补漏）；'
          : '本资料围绕错题组织，不与开头【锚点清单】做覆盖对账；';
  const extentKey = extentOf(genType); // expand | integrate | strict（single source：coverageContract）
  const coverageExtent = extentKey === 'expand'
    ? '清单**不是命题上限**——可依本学段课标学业要求，适当补充清单未涉及的知识点或考查角度（不超出本学段学业要求）；'
    : extentKey === 'integrate'
      ? '清单**不是范围围墙**——可做**同类/结构关联**（把本课知识与同类概念归类、对照、勾连成网络）；也可联系**能在本次勾选范围或【锚点清单】内确认的**先行内容。**不臆断学生"是否已学"**（未经确认的旧知不引入），不超出本学段课标要求；'
      : '只按清单（本课/本单元）呈现，不做清单外的补充与整合（默写类须严格对应教材要求）；';
  parts.push('【素材使用约定】\n'
    + `· ${coverageFloor}${coverageExtent}本条只约束"覆盖哪些知识点"，**不是素材来源限制**；${refClause}——情境、素材、人名、数据与句式可取自教材，也可取自课外真实生活（主题相关、难度适切），**来源不限、不作指定**；\n`);
  parts.push(refMode === 'full'
    ? (materialChannel === 'anchor'
      ? '· 本资料为知识归纳型（本次按锚清单通道生成）：归纳范围以上方清单为准，可依教材事实与课外同类材料转写为教辅表述，不得整段照录；正文不得出现任何出处标注（"选自/单元/章节/课题/课文名/位置式指引/原文出处"等溯源字样一律不写）。\n'
      : '· 本资料为知识归纳型：可引用、可归纳中段【压缩原文】，但须转写为教辅表述，不得整段照录；正文不得出现任何出处标注（"选自/单元/章节/课题/课文名/位置式指引/原文出处"等溯源字样一律不写）。\n')
    : (materialChannel === 'anchor'
      ? '· 本资料为命题/练习型：题型结构、知识梯度与难度按上方清单（含具体概念）把握；题干、情境、人名、数据与句式由你拟定，来源按上述口径。\n'
      : '· 本资料为命题/练习型：中段【压缩原文】供你理解题型结构、知识梯度与难度；题干、情境、人名、数据与句式由你拟定，来源按上述口径。\n'));
  if (materialChannel !== 'anchor') {
    parts.push('· 【压缩原文】中的练习/习题段仅供理解题型与难度，**不得照搬题目**。\n\n');
  } else {
    parts.push('\n');
  }
  return parts.join('');
};

/** ④ 组织方式（输出组织一律以委托书结构序列为准；【锚点清单】只声明覆盖范围，不是组织方式） */
export const buildOrganizeBlock = (genType = '') => {
  // 结构引用按类型：exam 用【卷面结构】，其余教辅用【教辅结构】（三维度精确，2026-09 清理）。
  const structRef = genType === 'exam'
    ? '【卷面结构】的大题序列组织（大题名、顺序、题量以委托书为准）'
    : '【教辅结构】的栏目序列组织（栏目名、顺序、题量以委托书为准）';
  return `【组织方式】输出一律以委托书${structRef}；开头【锚点清单】只声明覆盖范围，不是组织方式，不得据此替代委托书结构。\n\n`;
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
  return `\n\n【差异化要求（复生成）】以下知识点已覆盖，请优先选择其他知识点或从不同角度考查：${diffKps.join('、')}。情境错峰：本次为同一范围的再次出稿，新稿的情境载体、人物/场景、数据与设问角度须与已生成稿件错开——命中已用情境即换情境、换对象、换数据、换设问角度，不得沿用上稿的情境模板与雷同句子。`;
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
    note: '生成时按勾选章节的分析结果注入（第1层知识主题 + 第3层具体概念；覆盖范围以下限声明）',
    build: (c) => (c.anchorListText ? buildAnchorListBlock(c.anchorListText) : ''),
  },
  {
    id: 'compressed-text', name: '压缩原文', lib: 'builtin', scope: '用户消息·中段素材',
    note: '生成时按勾选章节原文压缩注入；锚清单通道不注入（A17）',
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
    note: '复生成且存在已覆盖知识点时注入（仅题类：考卷/课时练/专项/阅读）',
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
 * @param {string} [ctx.anchorListText] 锚点清单文本（生成时才有）
 * @param {string} [ctx.compressedText] 压缩原文文本（生成时才有）
 * @param {string} [ctx.instructionText] 已按通道归一的委托正文（生成时传入；面板侧传空即可）
 * @param {string} [ctx.templateInfo] 勾选模板信息
 * @param {string} [ctx.contextFramework] 情境框架
 * @param {string[]} [ctx.diffKps] 已覆盖知识点
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
  SELF_CONTAINED_TEACHING, SCENE_REGEN_TYPES,
  TAIL_SELF_CONSISTENCY, TAIL_VARIETY,
  buildAnchorListBlock, buildCompressedTextBlock, buildMaterialUsageBlock, buildOrganizeBlock,
  buildTemplateInfoBlock, buildContextBlock, buildDiffRegenBlock, buildOutputBlock, buildTailBlocks,
  buildUserMessageBlocks, buildUserMessagePrompt,
};
