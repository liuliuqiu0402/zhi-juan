/**
 * 排版规格库（Layout Spec）—— 学段渲染参数（程序可读数据）唯一事实源
 * ============================================================
 * 定位：承载"程序化的格式规则/参数"，供骨架编译器、清洗器(normalizeBlankMarkers)、
 *    导出端(docxBuilder)、排版模块(themeConfig) 读取。模型不感知（不注入 prompt）。
 *
 * 与规则库(validatorRules)的分工：
 *   - 排版规格库 = 格式"数值/参数"层（作文格格宽、填空上限、书写载体、解答区系数…）
 *   - 规则库       = 格式"逻辑/开关"层（writing-grid-fix 等判定执行的入口）
 *   - contentCleaner/docxBuilder/themeConfig = 换算/渲染"执行"层
 *   三层通过"执行入口读取排版规格参数"串联，避免数值四处硬编码。
 *
 * 学段键与三维度对齐：primary_low/primary_mid/primary_high 归组 primary，
 *   middle=初中，high=高中。
 * ============================================================
 */

import { isLibEntryEnabled } from '../utils/libToggles.js';
import { CARRIER_LABELS } from './blueprintSchema.js'; // 载体中文标签唯一源（指令端条款翻译共用，不另造标签）
import { normalizeSubjectName } from './expertKnowledge.js'; // 学科名归一化（道法/政治/信息 → 道德与法治/思想政治/信息科技），保证载体键始终命中 canonical key

/**
 * 学段 → 排版三档键归一化（primary/middle/high）
 * 兼容三维度五档键（primary_low/mid/high）、旧三档键、中文名；
 * 生成链路传入 stageKey（五档），排版/导出端一律经此归一化，避免 primary_low 误落 middle 档。
 */
export const normalizeStage3 = (stage) => {
  const s = String(stage || '');
  if (/^primary|小学/.test(s)) return 'primary';
  if (/^high|高中/.test(s)) return 'high';
  return 'middle';
};

/** 作文格格宽（mm）· 按排版学段。列数由 A4 可用宽度自动排满。 */
export const ZUOWEN_CELL = {
  primary: { widthMm: 12, heightMm: 12 },   // 小学：12×12mm 正方形
  middle: { widthMm: 10, heightMm: 10 },    // 初中：10mm
  high: { widthMm: 7.5, heightMm: 8 },      // 高中：宽7.5×高8mm（非正方形）
};

/** 作文格数字标注步长：小学每50格一标，初中以上每100格一标 */
export const ZUOWEN_MARK_STEP = {
  primary: 50,
  middle: 100,
  high: 100,
};

/**
 * 填空横线（blank-N）参数：
 *   maxCap：宽度上限指数（16 = 16 字位 = 16em；答案通常 ≤16 字，超长用"行尾自动延伸"方案）
 *   wordGap：1 字位 ≈ N em（字位与书写宽换算，1 字位 ≈ 1 em，不放大）
 *   minBlank / maxBlank：blank-{n} 合法区间（2 ≤ n ≤ 24）
 */
export const BLANK = {
  maxCap: 16,     // 宽度上限 16em（16 字位），超长会超出页内边距
  wordGap: 1,     // 1 字位 ≈ 1 em
  minBlank: 2,
  maxBlank: 24,
  // 🔴 2026-10-05（调研·手写空间 · GB 40070-2021）：**印刷字位 → 手写书写宽** 的系数（按学段）。
  //    依据：低段田字格/方格 ≥14mm vs 印刷正文 ≈ 小4号 ≈ 4.2mm/字位 → ≈3×；
  //    其他学段 方格/行高 ≥8mm → ≈2×（与"试卷填空占 3 字格"惯例一致，低段更宽）。
  //    预览（carrierCss 的 --blank-scale）与导出（docxBuilder）**同源同值**，杜绝两端分叉。
  //    `primary`＝3 档别名（未选/仅有 3 档时的小学）——**按低段口径取 3**（宁可宽、不可窄：手写空间不足会直接写不下）。
  writeScaleByStage: { primary_low: 3, primary: 3, primary_mid: 2, primary_high: 2, middle: 2, high: 2 },
};

/** 学段 → 手写系数（5 档或 3 档别名 `primary`→3；未传/未知取 2） */
export const blankWriteScale = (stage = '') => {
  const m = (getMergedSpec().BLANK || {}).writeScaleByStage || {};
  const k = String(stage || '').trim();
  return Number.isFinite(m[k]) ? m[k] : 2;
};

/** 空作文格默认补全：<div class="zuo-wen-ge"></div> → 默认 span 数 */
export const ZUOWEN_DEFAULT_SPAN = 2;

/**
 * 书写载体（学科 × 学段 → 允许的载体 class 列表）
 *  - 语文：低段田字格+米字格+拼音格；中段起正常横线
 *  - 英语：中段四线三格（英语 3 年级起点）；低段/高段起正常横线（低段显式声明，避免 null 漏检语文格子越界混入）
 *  - 数学：作图方格纸 square-grid 仅小学段合法（作图题；初中以上由考试答题纸自带网格，不给"用方格纸"诱导）；其余格子类一律不允许
 *  - 其余学科（物理/化学/生物/科学/道德与法治/思想政治/历史/地理/音乐/美术/体育/信息科技）：显式空数组
 *    = 不允许任何格子类（出现田字格/四线三格等即按越界自动剥离）
 *  - 未显式定义的学科（新学科兜底）：不检测（getCarrierAllowlist 返回 null）
 * 消费方：examValidator writing-grid-fix（按 学科×学段 检查输出载体是否越界，越界自动剥离保留文字）
 */
/** 书写载体允许表（学科→学段→允许载体）
 * 🔗 命名双轨·学科键：键名必须与 expertKnowledge.subjects canonical 名（道德与法治/思想政治/信息科技 等）完全同名；
 *    旧别名（道法/政治/信息）不再使用，统一在上方显式空数组。新增/改名学科须与 expertKnowledge.subjects、
 *    指令库 STAGE_SUBJECTS/SUBJECT_STAGE_EXTRAS 同步，否则剥离防线失效（见 getCarrierAllowlist 归一化）。 */
export const WRITING_CARRIER = {
  语文: {
    // 🔧 米字格（书法练习格）与田字格同属方块格、同为写字载体：多处消费端注释（themeConfig/RichTextEditor/
    //   TypesetModule/global.css）均声明"米字格仅语文低段"，曾允许表漏列 → 越界剥离把模型偶发输出的
    //   mi-zi-ge 当越界拆掉（写字题丢失书写格）——已收敛加入，与注释/渲染能力一致
    primary_low: ['tian-zi-ge', 'mi-zi-ge', 'pinyin-line'], // 低段：田字格/米字格/拼音格
    primary_mid: ['line'],                      // 中段起正常
    primary_high: ['line'],
    middle: ['line'],
    high: ['line'],
  },
  英语: {
    // 2026-09-29 用户裁定（课程口径）：**低段也要有字母书写题 → 需要四线三格**（原按"英语 3 年级起点、
    //    1-2 年级不要求字母书写"一刀切不给低段四线格，与蓝图"低段字母抄写"相抵）。现纳入允许表：
    //    随渲染 / 越界剥离 / 声明检查同源生效（不再被判"越界"剥掉）。
    primary_low: ['four-line-three'],           // 低段：字母书写（四线三格）
    primary_mid: ['four-line-three'],           // 中段：四线三格
    primary_high: ['line'],                     // 高段起正常
    middle: ['line'],
    high: ['line'],
  },
  数学: {
    primary_low: ['square-grid'],
    primary_mid: ['square-grid'],
    primary_high: ['square-grid'],
    middle: [], // 作图方格纸仅小学段渲染（SQUARE_GRID middle/high=null）；初中以上由考试答题纸自带网格，不给"用方格纸"诱导
    high: [],
  },
  物理: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  化学: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  生物: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  科学: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  道德与法治: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  思想政治: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  历史: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  地理: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  音乐: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  美术: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  体育: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  信息科技: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
};

/**
 * 查询某学科×学段的允许书写载体列表（合并用户覆盖；学科名先归一化，任何旧别名都命中 canonical key）。
 * 未显式定义该学科的载体规则 → 返回 null（不检测，保持正常书写）。
 */
export function getCarrierAllowlist(subject = '', stage = '') {
  const spec = getMergedSpec().WRITING_CARRIER;
  const row = spec[normalizeSubjectName(subject, stage)];
  if (!row) return null;
  return row[stage] || null;
}

/**
 * 载体正规化规则（题型关键词 → 必须/禁止载体；卷面"该用什么就是什么"）
 *  - must：命中关键词的题目，题内必须出现对应格子 class——
 *          缺失只能静默提示抽检（程序不知道哪个字该进格，无法自动补）
 *  - forbid：命中关键词的题目，题内禁止出现对应格子 class——
 *          出现则自动剥离 class 保留文字（程序确定性可修复）
 *  ⚠️ 关键词是"书写意图"识别，非课标要求（卷面惯例），可按地区在排版规格库调整。
 * 消费方：examValidator writing-grid-fix（小题粒度执行）
 */
export const CARRIER_RULES = {
  must: [
    // 语文低段：写汉字类 → 田字格（含"读拼音，写词语"等叫法）
    { subject: '语文', stages: ['primary_low'], keywords: '看拼音写|读拼音写|读拼音，写|写一写|抄写|默写|听写|写字|书写', carrier: 'tian-zi-ge' },
    // 语文低段：写拼音类 → 拼音格
    { subject: '语文', stages: ['primary_low'], keywords: '写拼音|写音节|标声调|给音节', carrier: 'pinyin-line' },
    // 英语中段：字母/单词抄写 → 四线三格
    { subject: '英语', stages: ['primary_mid'], keywords: '抄写|写一写|书写|Write|write', carrier: 'four-line-three' },
    // 2026-09-29（**模型侧补缺口**·用户候选5裁定的落地延续）：英语**低段**同样有字母/单词书写 →
    //    低段也须"必须真实输出四线三格"。原先 must 只有 primary_mid：低段允许表已放开
    //    （WRITING_CARRIER['英语'].primary_low = ['four-line-three']，2026-09-29 用户裁定）却**注入端
    //    一句都没有**（buildCarrierInstruction 低段返回空串）→ 模型无从得知该出四线三格 = **协议缺位**，
    //    正是"载体靠程序侧兜底/只抽检"的源头。本规则只进指令层（2l 已移除 must 的执行，不牵连越界剥离）。
    { subject: '英语', stages: ['primary_low'], keywords: '抄写|写一写|书写|字母|Write|write', carrier: 'four-line-three' },
  ],
  forbid: [
    // 表达/写话类：禁止混入格子（作文格 zuo-wen-ge 由 writing-grid-fix 作文格通道单独管理，不在此列）
    // 2026-09-29（去一刀切）：条目**声明适用学科**（关键词"写话/习作/作文/小练笔/口语交际"是中文
    //    学科专属语义、书面表达类以语文/英语为限）——未含该学科的卷不再据这些关键词剥离格子。
    { keywords: '看图写话|写话|习作|作文|写作|小练笔|口语交际', carriers: ['tian-zi-ge', 'four-line-three', 'sixian-ge', 'pinyin-line', 'mi-zi-ge'], subjects: ['语文', '英语'] },
  ],
};

/**
 * 载体声明→输出一致性映射（题干标题明确声明了书写载体 → 题内必须输出对应载体 class）
 *  - 与 CARRIER_RULES.must 的区别：must 是"行为词→载体"惯例推断（软，2l 已移除执行，仅指令层注入）；
 *    本表是"载体名显式出现在题干"的客观强要求（硬，声明即要求，缺失静默抽检）
 *  - 按 学科 配置（三维度），杜绝跨学科污染（语文田字格不检英语/数学，数学方格纸不检语文）
 *  - 学段门控：执行时校验载体 class ∈ 该 学科×学段 允许列表（getCarrierAllowlist）——
 *    该学段不允许的载体声明（如初中数学"方格纸"、语文中段"田字格"）不按"应输出"强检（越界剥离已处理格子）
 * 消费方：examValidator writing-grid-fix（小题粒度：题干命中声明 → 检查该题区域有无对应载体）
 */
export const CARRIER_DECLARATION = {
  语文: [
    { re: /在田字格|田字格中写/, cls: 'tian-zi-ge' },
    { re: /在拼音格|拼音格中写/, cls: 'pinyin-line' },
  ],
  英语: [
    { re: /四线三格/, cls: 'four-line-three' },
  ],
  数学: [
    { re: /方格纸/, cls: 'square-grid' },
  ],
};

/** 载体 must 规则的指令端语义（与 CARRIER_RULES.must 的 keywords 对应，把"允许载体"翻译成可读条款；
 *   demo 为渲染 class 的示例——必须为空串（空格子），与"格子为空格子（格内不填字/拼音/答案）"一致，
 *   示例内若带占位字会诱导模型输出已填内容的格子（违规）；示例随条款按 学科×学段 注入，不再全学科广播） */
const CARRIER_MUST_SEMANTICS = {
  'tian-zi-ge': { label: '写汉字类题', demo: '' },
  'pinyin-line': { label: '写拼音类题', demo: '' },
  'four-line-three': { label: '字母/单词抄写类题', demo: '' },
};

/**
 * 生成"书写载体"指令条款（指令库 QUESTION_FORMAT 引用；数据源 = WRITING_CARRIER/CARRIER_RULES 唯一事实源）
 * 按 学科×学段 精确输出：
 *   - 命中 must 载体规则（语文低段田字格/拼音格、英语中段四线三格）→ 逐条输出"XX类题必须真实输出XX"
 *   - 允许方格纸（数学小学段作图题）→ 输出"作图类题用方格纸"
 *   - 其余（横线惯例/显式禁止格子/未定义学科）→ 返回空串（默认作答形态由通用句覆盖，不注入）
 * 消费方：promptLibrary QUESTION_FORMAT（按三维度 cell 组装时以 subject/stage 调用）
 */
export function buildCarrierInstruction(subject = '', stage = '') {
  const list = getCarrierAllowlist(subject, stage);
  if (!list || list.length === 0) return '';
  const parts = [];
  for (const r of CARRIER_RULES.must) {
    if (r.subject && r.subject !== subject) continue;
    if (r.stages && !r.stages.includes(stage)) continue;
    const sem = CARRIER_MUST_SEMANTICS[r.carrier];
    const label = CARRIER_LABELS[r.carrier] || r.carrier;
    if (sem) parts.push(`${sem.label}必须真实输出${label}（示例：<span class="${r.carrier}">${sem.demo}</span>）`);
    else parts.push(`「${r.keywords.split('|')[0]}」类题必须真实输出${label}`);
  }
  if (list.includes('square-grid')) parts.push('作图类题用方格纸作答区（示例：<span class="square-grid"></span>）');
  // 2026-09-29（**把假指针改成真协议**·用户实样实证"看图写话没有作文格子"）：
  //    成篇成文的作答载体（作文格 zuo-wen-ge）原先在本函数与 buildAnswerSpaceInstruction 里**都只写**
  //    "成篇成文类另有专用书写载体，由该载体通道约束"——模型端**从未拿到这个标记**（假指针）；
  //    而程序侧补格通道（2j-5）又以"题内已有任一作答载体即不补"为界（那是为消"横线+格子并存"的既有裁定）
  //    → 两处互指 = 谁都不输出：模型只能给整行横线，格子随之消失。
  //    故在此给出**真协议**（仅语文：作文格是中文成篇书写载体；标记与 2j-5 补格产物逐字同形）。
  const compositionLine = subject === '语文'
    ? '成篇成文类的作答位是**作文格**：输出 <div class="zuo-wen-ge"><span>&emsp;</span></div>（按该题篇幅给足格数）——此类题的作答载体就是作文格，**不得用整行书写横线代替**。'
    : '';
  if (!parts.length) return compositionLine;
  // 书写格位置判据（基准1/2 根治·2026-09-28 用户口径澄清）：纠正"田字格不得出现在句末"的误读——
  //    田字格**允许混排**（可在句中、也可在句末）；正确判据是"书写格必须与它所对应的那个拼音紧邻
  //    （逐词一一对应）"，**不是**"不得出现在句末"。故本条：①强调相邻性与一一对应（正面要求可核对）；
  //    ②明确"多组词的格子不得从各自位置抽出集中堆放"（反面禁令不再可被"同段句末"字面满足）；
  //    ③提权为**独立 行**（原先以"；"粘在"书写载体协议"长行末尾、无 ，显著性不足）；
  //    ④声明本条**优先于**一切"作答载体给在题后/整题之后集中一处"的通用表述（后者只适用于成段/成篇横线）。
  //    计分自洽条款（基准3 根治）：按词/字计分时词数=拼音组数、字数=书写格数——仅 must 命中
  //    （语文低段/英语中段书写类）注入，天然按 学科×学段 收敛，不对全学科广播（防跨学科噪音）
  const mustSem = parts.some((p) => p.includes('必须真实输出'));
  const protocol = `${parts.join('；')}${mustSem ? '；题干未写明时按此书写惯例。' : '。'}`;
  if (!mustSem) return [protocol, compositionLine].filter(Boolean).join('\n');
  // 2026-10-04（①读拼音写词语·根治）：本题型（语文低段独有）此前**无呈现条款**，叠加"在语境中考查"
  //    的推力 → 模型把整题改写成含目标词语的语境句（实测："1. 小蝌蚪甩着长长的尾巴，在池塘里快活地
  //    游来游去。"），既无拼音也无书写格。
  //    补一条**结果导向**正句：按题面线索判（题面给出拼音、要求写词语的题），写出"该呈现成什么结果"
  //    ——拼音音节真实给出（在上）、其下紧跟对应书写格、逐词一一对应。不写否定句、不点否定形态（免指向性诱导）。
  // 🔴 2026-10-04（J1 真机定案·消相抵）：原句尾"拼音音节**在上**、其**下**紧跟对应书写格"与位置条
  //    "书写格与书写对象**同行紧邻**…在**同一题干段内**"**相抵**（一竖排、一横排，同一对象两种相反落点）；
  //    实发产物实证：看拼音写词语题**只写拼音、未给任何书写格**（`tian-zi-ge` 出现 0 次）。
  //    故**删除本条内的落点表述**，落点/格数归位置条**单源**；本条只保留其独有判据
  //    ——"词语在原句中就地留空、不写进句子"（结果导向、可自判）。
  const readingPinyinLine = subject === '语文'
    ? '以拼音为线索、要求据此书写的题：**该处拼音须真实给出**（不得以内容代替），所写内容在原句中的位置就地留空（词语不写进句子）。'
    : '';
  // 独立 位置行：紧接"书写载体协议"行另起一行（携带换行 → 注入时自成一条醒目条款）
  // 2026-09-29 收口（用户实测回归）：上一版把"不得单独成段"只留在括号里、且用"即使没有'单独成段'
  //    也属违规"弱化了它，同时优先级声明只覆盖"作答载体给在题后/整题之后集中一处"，**没覆盖**
  //    "每道题/每项独立成 <p> 段落"（promptLibrary 段落组织条）——模型据此把书写格另起段落。
  //    本版：①"不得另起段落/另开条目/单独成段"写回主句（硬话，不再只放括号）；②优先级声明扩到同时
  //    覆盖"题后集中一处"与"每题/每项独立成 <p> 段落"两类通用表述；③明确书写格随其对应词语留在
  //    **同一题干段内**；④保留既有口径"允许混排（句中/句末皆可，只要紧邻）"。
  // 2026-09-29（**模型侧扩覆盖面**·用户追问"逐条过一遍，确认模型生成时就能输出正确载体"）：
  //    原句通篇以"拼音"为锚（"与其所对应的那个拼音""每写完一组拼音""词数=拼音组数"），
  //    而本行由 `hasMust` 触发——must 命中的关键词还含 **抄写/默写/听写/写字/书写（无拼音对象）**
  //    与英语低/中段的字母单词书写。锚错了对象 → 这些题的"格子该贴在哪"在条款里**无对应表述**
  //    （模型只能猜）→ 载体位置失准、靠程序侧抽检兜底。故把锚从"拼音"改为**书写对象**
  //    （该处要写的拼音／词语／句子），判据（同行紧邻、逐项一一对应、禁抽出集中堆放）逐字不变。
  // 2026-10-04（拆长条·用户口径「块内一条一行、不空行」）：原位置行 522 字**一条挤 7 件事**
  //    （锚/一一对应/字数=格数/禁另起段/禁抽出/优先级/载体=书写格/计分自洽）→ 拆为 4 条同类短条，
  //    判据逐字未改、只分条；每条自成 `· ` 一行（与阅读拼音行、作文格行同层），块内不空行。
  const positionLines = [
    '书写格必须与其所对应的**那个书写对象**（该处要写的拼音／词语／句子）**同行紧邻**、逐词一一对应——每写完一组拼音（或一个词语／一个句子），紧接着就在**同一题干段内**输出其对应的书写格；**一格一个书写对象，书写格数＝该处字数**（一字一格、不多给、不重复）。',
    '不得把书写格另起段落、另开条目或单独成段；多组词语的书写格不得从各自位置抽出、集中堆放。',
    '本条优先于一切通用表述——既优先于"作答载体给在题后/整题之后集中一处"，也优先于"每道题/每项独立成 <p> 段落"，还优先于"同题/同卷短答空位形态统一、一个空位只写一种载体"：前者只适用于成段/成篇的整行书写横线，中者只适用于题干与情境/活动/成果条目，后者只适用于**短答空位**（括号空/下划线空）——三者均不适用于**书写格**。书写类题的作答位**就是书写格**（'
      + (subject === '语文' ? '写汉字类＝田字格/米字格、写拼音类＝拼音格' : '按本学科对应的书写格')
      + '），不得用下划线空/横线空/括号空去替代它。',
    '本条只适用于书写格这类"逐词紧邻"载体、**位置不限**（紧随其书写对象、逐词一一对应即可）；其余载体尤其符号作答位**不适用本条**。书写类题按单位（词／字）计分声称须自洽（单位数=书写对象数、总分=单位分×字数）。',
  ];
  return [
    protocol,
    readingPinyinLine && `· ${readingPinyinLine}`,
    ...positionLines.map((l) => `· ${l}`),
    compositionLine && `· ${compositionLine}`,
  ].filter(Boolean).join('\n');
}

/**
 * 填空空位换算锚（注入给模型的计数锚；BLANK 单一事实源——wordGap 等规格调整后本句自动跟随）
 *  2026-09 语义收敛：从"按书写惯例输出对应作答书写载体，不得遗漏；书写空间按照答案的长度倒推…"
 *     收敛为纯换算锚——旧句"按书写惯例"把作答载体形态整体交给模型语感（不点名任何形态词），
 *     正是理科解答被画横线、该留白被画框、作答区被文字占位等卷面乱象的语义真空源头；
 *     空位具体形态改由 buildAnswerSpaceInstruction 按"所填内容"**判据式**定（填符号→圆括号空、
 *     填短答→横线空；**判据式，不作"交模型语感"的许可式表述**），本函数只保留"字位↔书写宽"这一可执行计数锚。
 * 消费方：buildAnswerSpaceInstruction（嵌入填空类条款；单一引用点）
 */
export function buildBlankWidthInstruction(spec = BLANK) {
  const b = sanitizeBlankSpec(spec);
  const per = b.wordGap; // 1 字位 ≈ per em（字位→书写宽换算系数，渲染端参数；默认 1:1 不放大）
  const perText = String(per);
  return `1 字位≈1 个全角空格≈${perText} em 书写宽`;
}

/**
 * 作答空位载体的 HTML 标记（**程序↔模型协议**，单一事实源）
 * ============================================================
 *  · 横线空位（填词/句/数等短答）：<u class="blank-N">&emsp;</u>
 *  · 括号空位（填字母/序号/√× 等符号）：<span class="blank-N">&emsp;</span>
 *  N = 宽度档（1 档 ≈ 1 字位 ≈ 1em；档位上限见 clampBlankToSpec）。
 * 为什么必须**带 class**（2026-09-18 用户实证"例题答案回填了、横线却没了"）：
 *    无 class 的裸 <u> 在本产品**没有空位语义**——内容型会被"强调标注归一"判为强调误用改成加粗
 *    （横线随之消失，文字留着），题类则由清洁侧按"裸下划线空壳/整句被包"拆壳。
 *    实证分化：同卷里括号空位幸存、横线空位消失——括号是模型写"（　）"后由生成链路**字面归一**
 *    成带 class 的载体，而裸 <u> 不在任何归一名单里，故被当强调清理。
 *    结论：空位一律写成带 class 的载体；答案回填也是写在该载体标签**之内**。
 * 消费方：生成端条款（题类⑦点名横线标记 `line`；内容型"内嵌题作答位"条款两种都给）、
 *          校验端识别、渲染端定宽（carrierCss/docxBuilder）。
 */
export const BLANK_CARRIER_MARKUP = {
  line: '<u class="blank-N">&emsp;</u>',
  paren: '<span class="blank-N">&emsp;</span>',
};

/**
 * 作答空间形态语义（注入给模型；主观书写形态单一事实源 = ANSWER_REGION）
 *  2026-09 生成侧根治（两轮收敛，终稿口径）：作答空位形态**按所填内容判据式定**（填符号→
 *     圆括号空位、填短答→横线空位；判据式，不作"交模型语感"的许可式表述）；与之并列的硬约束：
 *      · 宽度换算锚（短答空位按答案长度换算，BLANK 单一事实源）——空位多宽是硬约束；
 *      · 所填为字母/序号/√×等符号的题用圆括号空位（　），短答与"列举归类"空位用横线空——
 *        以"所填内容是什么"判，不按题型名、不作倾向式表述；
 *      · 2026-10-03（⑦排序·合并同义）：原在通用段复述的"作答位就在题面空位内、不另附长横线作答区"已**合并**到
 *        长答条款 dupClause（"同一道题同性质的作答位只给一处…不得再在题后另起同性质的整行短答载体"）——作用结果相同、
 *        一处正句、其余引用；程序侧"题面空位类不补差"（2k 结构性排除）不动；
 *      · 2026-09-15 用户裁定·载体条款全量纯形态化：本节所有条款一律以**作答形态/所填内容/卷面
 *        位置**为判据，不出现任何题型名（选择/判断/圈选/口算/简答/写作/续写等），换词不换判据——
 *        判据与程序侧收口（normalizeMathCircleBlanks / answer-area-fix / 2k）逐条对齐，仅表述换词。
 *      · 题面带选项（A./B./C. 等）的题，其作答位**形态与位置按学科定死**：形态=圆括号空位、
 *        括号**一律半角**（英文状态；span 载体渲染自带半角括号）；位置按学科——**外语类**在题号之前的题首
 *        （"( ) 1. 题干…"）、**中文科目**在材料与设问之后、选项之前（"1. ……的是( )"），无学科兜底落中文支；
 *        选项行内、选项末尾、选项行之后一律不加作答位——
 *        2026-09 用户实证①：模型把答案空位挂到选项末尾（C. are; am＿）；②2026-09-15 实证：
 *        位置已对，但形态写成了下划线空（`<u class="blank-2">1. …`），故本句显式限定为**圆括号空**，
 *        不再依赖"大题标题写不写填入括号内"；属排版硬约束（与宽度锚/一空一载体同级），不交模型语感；
 *        2026-09-26 调研修订（唯一口径）：旧稿"在题干前用圆括号空位、全角「（　）」"的口径已废——
 *        位置因学科而异（外语题首 / 中文在材料之后、选项行之前）、括号一律半角（旧稿全角字面已废）。
 *        2026-10-03（问题3/6根治）：旧字面"题干末尾"被模型读成"作答说明行末尾"，作答括号随之挂错、
 *        选项落到材料之上；且旧字面"作答位只有上述那一处"压掉了材料内就地空位。现口径见下方 lines 数组。
 *        本句须与下方 lines 数组、程序侧 examValidator 2e0/2j-6、validatorRules 两条规则**四处同源**（改口须同步四处）；
 *        2026-09 用户裁定：只约束"带选项的题"这一个形态，不触碰√×符号作答位/数学方框圆圈等既有条款，
 *        也不使用题型名（防题型诱导，纯形态描述）；
 *      · 数学算式填空位（3＋□＝8）用方框/圆圈、比较大小（填＞＜＝）用○——数学卷面惯例（程序
 *        normalizeMathCircleBlanks 同语义收口，属定死的学科形态）；
 *      · 主观书写题形态 = getAnswerRegion(subject, stage).carrier（与程序补差 answer-area-fix
 *        读同一张表，语义与补差永不打架）：
 *          carrier='line'（英语全学段/科学全学段/语文低中段）→ 整行书写横线；
 *          carrier='blank-area'（数学等理科、理化生、史地政、道法、语文中高段论述阅读等）→
 *          无线留白，不画横线、不画框——对齐中高考答题卡实证（史地政/理科主观=空白作答区；
 *          语文 middle/high 论述阅读同理改留白，见 ANSWER_REGION 注释）；
 *      · 不得以任何文字充当或预置作答空间（作答空间只以真实留白或书写载体呈现）。
 *  - 无 subject/stage（通用模板兜底）：只给跨学科成立的形态句，不注入学科书写行分支（防无锚广播）
 *  - 书写格/作文格等专用载体不在此列（由 buildCarrierInstruction/作文格通道单独约束，两线不冲突）
 * 消费方：promptLibrary QUESTION_FORMAT（题为主类型统一注入；内容型不注入）
 */
// 2026-09-28 口径单一出口（唯一事实源 = 上方 buildAnswerSpaceInstruction 的条款方向）：
//    "选择类作答位位置按学科"这一件事**只在本规格库定义一次**，生成侧（buildAnswerSpaceInstruction）与
//    程序侧（examValidator 2j-6 位置归并方向）**同源引用**下方 helper —— 两处各写一份必然漂移
//    （曾出现"生成侧按学科、程序侧按多数票"的口径分裂，把中文卷搬成题首）。
//    判定按"外语类"而非单一"英语"字面量：语言类学科名以语言名结尾或含"外语"，今后新增外语学科自动纳入。
export const FOREIGN_LANG_SUBJECT_RE = /(?:外语|英语|日语|俄语|法语|德语|西班牙语|韩语|意大利语|葡萄牙语|阿拉伯语)/;

/** 是否外语类学科（选择类作答位位置取题首） */
export const isForeignLangSubject = (subject = '') => FOREIGN_LANG_SUBJECT_RE.test(String(subject || ''));

/** 选择类作答位位置：外语类 → 'head'（题首），中文科目 → 'tail'（材料与设问之后、选项行之前）；无学科兜底落 'tail' */
export const getChoiceBlankPosition = (subject = '') => (isForeignLangSubject(subject) ? 'head' : 'tail');

export function buildAnswerSpaceInstruction(subject = '', stage = '') {
  // 🔧 2026-09 注入去重（审核基准：指令简洁、防注意力分散）：宽度可执行换算/同题同形态一位一载体/
  //    圈选空位 1~2 字位 均属全学科通用规则 → 并入通用段（单一事实源），不再按学科重复注入；
  //    学科段只保留学科特有：数学算式□○/比大小、line/blank 长答形态。
  // 2026-09-26 调研（中考/高考真题与教育考试院命题规范、标点国标）：选择类作答位的**位置因学科而异**——
  //    **外语类**：题首（题号前），正式卷面作 "( ) 1. 题干…"；**中文科目**（语文/数学/理化生/政史地/科学）：
  //    材料与设问之后、选项之前，作 "1. ……的是( )"。括号一律**半角（英文状态）**（既有用户规格；
  //    span 载体渲染自带半角括号），不因学科改括号形制。无学科兜底（通用模板）时落中文支。故作分叉开关。
  // 2026-10-03（问题3/6根治）：中文支旧字面"题干末尾"被模型读成"作答说明行末尾"（作答位挂错、选项上移），
  //    故改述为"材料与设问之后、选项行之前"——判据不变（仍属题干尾部），只是把易误读的锚点说精确。
  // 2026-09-26 用户定：按"**外语类**"判定，不只认"英语"这一个字面量——语言类学科名以语言名结尾或含"外语"，
  //    今后新增外语学科自动纳入（本判定是**载体规格内的单一出口**，勿在他处另写一套学科名单）。
  // 2026-09-28 收口：判定改走模块级 isForeignLangSubject / getChoiceBlankPosition（本规格库唯一出口，
  //    程序侧 examValidator 2j-6 同源引用），不在函数内另存一份正则。
  const choiceBlankAtHead = isForeignLangSubject(subject);
  // 2026-10-03（⑦排序·一条一事＋合并同义）：原第 1 条一锅三事（形态判据＋"同卷同性质空位风格统一"＋"作答位在题面空位内
  //    不再另附长横线作答区"）。后两半句**与他处正句同义**——"同卷空位形态统一"的正句是【题目自洽】⑧（`CALIBERS` 登记
  //    "⑧ 唯一正句"）；"同性质作答位只给一处"的正句是长答条款的 dupClause。故**删此两半句、合并到各自正句**（判据一字未丢、
  //    程序侧"题面空位类不补差"结构性排除不动）；本条只留形态判据（一条一事）。
  const lines = [
    '· 作答空位形态与所填内容相称——具体形态**按所填内容定**：填**符号**（字母/序号/√× 等，含带选项的题）→ **圆括号空位**（括号内宽只须容纳所填符号，1~2 字位；仅题干明说"圈/○里"时用圈形空位并须真实给出 ○）；填**短答**（词/句/数等，含"列举归类"）→ **横线空位**；**同一题内各空按各自实际所填内容分别定形、可并存**，形态真实可书写；题面声明与实际所填不符时**改题面（本条为准）**；',
    // 2026-10-03（用户报障根治·问题3/6同源）：根因只是两个词——"作答位只有上述那一处"（排他→模型删掉
    //    材料内就地空位，选词填空成了"先操场。"）与"位置在题干末尾"（错位→作答括号挂到说明行、选项落到材料之上）。
    //    处置＝删排他词、把位置改为"材料与设问之后、选项行之前"、一句话界定就地空位与题末作答位并存。
    '· 题面带选项（A./B./C. 等）的题，其作答位即上句判据所指的**圆括号空位**、**括号一律用半角（英文状态）括号**：' + (choiceBlankAtHead
      ? '**在题号之前的题首**，写成"( ) 1. 题干…"'
      : '**在材料与设问之后、选项之前**——**紧接第一个选项标号（A./B./①…）之前**（设问末字后有无标点、选项是否与设问同段皆然），写成"1. ……的是( )"') + '；选项列于材料与设问之后；选项内、选项末尾及选项之后一律不加作答位（不给整行横线、不给空白作答行、不另设作答区）；**本条是硬约束**——与【题目自洽①】冲突时以本条为准；',
    // 2026-10-04（1a·就地空位回归·模型侧加强）：原"材料内缺内容处就地留空、与题末作答位并存"粘在
    //   上面那条长句里（被选项位置/括号形制等冲淡）→ 实测选字/选词题只在句末给了作答位、句中缺字处**没留空**。
    //   拆成**独立一条**并点明"缺字处本身要有一个空位"。
    // 🔴 2026-10-04（J6/J8 真机复验·按用户 2026-09-17 裁定"并存"的**原义**收窄）：原句"与**题末作答位**并存、均须保留"
    //    **不限性质、且预设"题末作答位"存在** → 模型对**同性质**的位也在题末再来一个（J8：就地空＋题末空叠加），
    //    并把**唯一**的作答位摆到题末（J6：带选项题的作答位落到选项后）。原裁定要的是"**性质不同**者并存"
    //    （题干内填词空位 × 题首填字母括号位）→ 收窄为"性质不同者并存、性质相同者只给一次"，删去"题末"预设。
    // 🔴 2026-10-04（J 收尾·16 方面复检·唯一性）：J6/J8 时本句曾补"与其它作答位性质不同者并存、性质相同者只给一次"，
    //    与下方 dupClause（"同一道题同性质的作答位只给一处…性质不同者本就该并存"）**同义重复** → 删本句尾半句，
    //    并存/去重归 dupClause 单源；本句只留其独有判据"缺字/缺词处该处就有一个空位"。
    '· **材料内缺内容处就地留空**——缺字/缺词处该处就有一个空位。',
    `· 短答空位宽度按"恰好容纳该空答案"换算：按该空答案的字位数（数字/汉字/小数点各算 1 个字位），写等量的全角空格（${buildBlankWidthInstruction()}），连列空位全带、不得遗漏；空位载体标签里的档位号 **N 就是该空答案的字位数**，**不是空位的序号**——不同空位的宽窄必须随**各自答案**变化，**严禁按题的先后递增、也严禁全卷一律等宽**；`,
    '· 同一题（含并列子题）同性质空位的形态一致；一个空位只写一种载体，空位内不再嵌空位或载体、也不给任何载体外套一层括号、空位前不叠加空白宽度；**作答位个数＝作答对象个数**（一对象一位）；',
    // 2026-09-17 用户实证（六年级英语阶段测评·第二题：6/7 括号在题首、8~10 在句末；题首括号又分全角/半角）：
    //    "同一题内一致"不足以覆盖**同一大题内跨题**——补本条，与程序侧探针 answer-blank-position / answer-blank-form 同源。
    //    纯形态描述（不出现题型名）：只讲"所填内容 + 位置 + 括号形态"。
    //    2026-09-17 用户实证第三卷（综合检测）·**两个口径的管辖域不同，条款须分开写**：
    //      位置统一是**大题内**语义（一个大题里一部分题首、一部分句末才叫不统一）；
    //      形态统一是**同卷**口径（质量底线：同卷同性质空位只用一种形态）——本卷第一大题全角「（　）」、
    //      第二/九大题半角「(        )」，各大题各自统一却同卷两种形态并存。条款与程序探针同域改齐。
    '· 同一大题内，"所填为字母/序号/√×等符号"的作答位**位置整段统一**（不得同段混用两种位置）；括号一律半角、同卷不混用全角半角；',
    '· 作答空间只以真实留白或书写载体呈现：不得以任何文字（提示、标签、说明）充当或预置作答空间；',
  ];
  if (subject && stage) {
    // 🔧 数学算式填空位/比大小（数学专用通道，与 normalizeMathCircleBlanks 程序收口同语义）：
    //    算式单元格的 □/○ 或邻运算符占位最终统一渲染为方框/圆圈（1.8em 容器）——
    //    不归"填空下划线"通道，显式声明防模型把 3＋□＝8 写成下划线长空；
    //    比较大小（填＞＜＝）卷面惯例为"在○里填符号"（圆圈内作答），非括号空——
    //    曾因通用"判断类→圆括号"句被模型套用成括号，悖于数学惯例（2026-09 实证）
    if (subject === '数学') {
      // 🔧 2026-09 载体根治·填空位与结果位二分；2026-09-17 去重 + 消"低段两句相抵"：
      //    原实现把"结果位"同时写在**本条句尾**（一律留白、不用方框/圆圈/括号）与**学段句**里
      //    （低年级如需定位可用「＝＿＿＿」下划线或「＝（　）」括号）——同一条结果位，一句允许括号、
      //    一句禁止括号，低段两句话直接相抵；且"一空一载体/空位不嵌套"在通用段与本段各写一遍。
      //    现：① 本段只留学科特有——缺数/填数填空位（□/○）、比大小（○）、近似值（≈）、过程书写区；
      //       ② 结果位形态整条归**学段句**（低段/中高段各一条，不再与句尾总述并存）；
      //       ③ 载体一致性归通用段单源（"一个空位只写一种载体…"），本段不再复述。
      //    方框在任何学段都不用于结果位（只有缺数/填数填空位用□）；程序 normalizeMathCircleBlanks
      //    （isResultPosition）同判据确定性剥离，杜绝"中高段/计算题/应用题结果位配方框"的错配。
      lines.push('· 算式中的『缺数/填数算式填空位』（如 3＋□＝8、□×□＝12 里待填的数）用方框或圆圈呈现，不用下划线空位；');
      lines.push('· 比较大小（填＞/＜/＝）用○圈出符号位作答，不用括号空位；');
      // 🔧 2026-09 实证（A-101 产物审计）：近似值题（保留 X 位小数）算式侧误用 ＝、答案空位叠加双载体
      lines.push('· 需取近似值/保留位数的算式（保留X位小数、四舍五入、得数保留、约等于语境）用约等号 ≈ 连接算式与空位结果，精确等于才用 ＝；');
      // 🔧 2026-09 实测（课堂练习产物审计）：竖式计算题被写成"3.5×2.4＝( )"填空——只容结果、
      //    学生无处列竖式，违反"每道题可作答"。过程类计算题须给书写区，结果空位只用于口算直接写得数
      // 2026-09-29（模型侧根治·分学段）：原"每式 ≥3 行"写死、**未受单题作答区上限约束** →
      //    算式条数多的题必然越界（低段单题上限仅 4 行，两式就要 6 行）。现与规格库同源给上限，
      //    并写明"多式时按上限平摊"，避免逐式铺满。
      // 2026-10-03（同类隐患审计·两处绝对值相抵根治）：原句同时写 "每式 ≥3 行"（下限，绝对）与
      //    "单题合计不超过上限 N 行"（上限，绝对）——两式低段时 2×3=6 > 4，两句直接相抵，
      //    模型只能任取一句（正是竖式无过程区的成因之一）。现改为**上限为约束、下限随算式条数让位**：
      //    "算式少时每式 3 行、算式多时按上限平摊"。
      const capRowsMath = getAnswerRegion('数学', stage).maxRowsPerItem;
      lines.push('· 需书写计算过程（列竖式/笔算/脱式等）的算式题：题干给出算式与要求后，须为每个算式预留书写过程区（算式后留无线空白行；**单题合计不超过本学段单题作答区上限 ' + capRowsMath + ' 行**——算式少时每式 3 行供列式计算，算式多时按该上限平摊、不逐式铺满），需验算的在题面写明"并验算"并相应留位；严禁用"＝( )"填空形式代替过程书写，结果空位仅用于只需直接写出得数、无需过程的题；');
      // 🔧 结果位学段化（2026-09 实证调研：中高年级起直接写得数 = 等号后留白、初中答题卡留白；
      //    低年级口算常用"＝＿＿＿"下划线或"＝（　）"定位作答。程序 normalizeMathCircleBlanks
      //    （含已入库内容解壳）同判据确定性剥离结果位方框）
      if (stage === 'primary_low') {
        lines.push('· 算式『等号后的得数结果位』（算式求出、写在等号后的得数所在位）：只需直接写出得数、无需书写过程的，在等号后直接留白书写；低年级如需定位作答，可用「＝＿＿＿」下划线或「＝（　）」括号，不用方框（方框仅用于缺数/填数算式填空位）；同卷内同一形态统一，不混用。');
      } else {
        lines.push('· 算式『等号后的得数结果位』（算式求出、写在等号后的得数所在位）：只需直接写出得数、无需书写过程的，在等号后直接留白书写（中高年级/初中卷面惯例），不加方框、不加括号、不用圆圈。');
      }
    }
    // 2026-09-18 用户实证（内容型《知识梳理》例题的成句答案无书写载体）：
    //    成句成段答案的书写载体抽为**单一事实源**（下方 buildLongAnswerCarrierInstruction），
    //    题类（此处）与内容型内嵌题条款**共用同一批字面**——防"题类有、内容型没有"的两套措辞漂移。
    const longCarrier = buildLongAnswerCarrierInstruction(subject, stage);
    if (longCarrier) lines.push(longCarrier);
  }
  return lines.join('\n');
}

/**
 * 成句成段答案的书写载体句（学科 × 学段 → 作答区域载体）
 * ============================================================
 * 单一事实源：本函数字面即 `buildAnswerSpaceInstruction` 内 region 分支的原字面（2026-09-18 抽出，逐字未改）。
 * 为什么必须单源：**内容型**（知识总结/预习等）此前从不注入任何作答载体句 → 例题里"成句成段的答案"
 *    只能凭语感平铺，学生看不到答案该落在哪里；而程序侧 answer-area-fix 补差**明确排除内容型**
 *    （examValidator：`!['summary','preview'].includes(genType)`）——于是成了"模型侧无条款 + 程序侧不补"的三不管，
 *    根因不是模型做不到，而是**协议缺位**。抽出后两处同源引用，内容型只多一条真协议、不多一套说法。
 * 载体形态由 ANSWER_REGION 决定（与程序补差 answer-area-fix 读同一张表，语义永不打架）：
 *   · carrier='line'（英语全学段/科学全学段/语文低中段）→ 整行书写横线；
 *   · 其余（数学等理科、理化生、史地政、语文中高段）→ 无线空白作答行（对齐中高考答题卡）。
 * 消费方：buildAnswerSpaceInstruction（题类）、promptLibrary CONTENT_FORMAT（内容型内嵌题条款）。
 */
export const buildLongAnswerCarrierInstruction = (subject = '', stage = '') => {
  if (!subject || !stage) return '';
  const region = getAnswerRegion(subject, stage);
  // 2026-09-29（**模型侧根治**·分学段·用户裁定"该从模型侧解决的不靠程序补丁"）：
  //   ① 行数上限一并注入——原只给"行数按答案篇幅"、**无上限**，模型端会对短答按分给过量空间（低段尤甚）；
  //      上限唯一定义在 `ANSWER_MAX_ROWS_BY_STAGE`（规格层单一事实源、学科无关），与程序补差 answer-area-fix 同源同值。
  //   ② 同题不重复给作答位——纯形态描述、不点题型名（无指向性诱导）：题干行内已有作答位时不得再另起整行作答载体。
  // 2026-09-29 修正（审计发现**自己引入的一刀切**）：原条写"已给行内作答位即不得再给整行作答载体"、
  //    **无学科门控**，与同函数数学支的"竖式过程区（题后无线空白行）"直接相抵——算式题题干内已有"＝＿"
  //    结果位时，本条会禁止再给过程书写区 → **"竖式题无处书写"**（且 2k 对竖式只抽检不补差，两处叠加更甚）。
  //    现按学科门控：①限定为"**同性质短答空位**"；②数学支显式豁免"结果位 ↔ 过程书写区"并存。
  const dupClause = '；同一道题**同性质**的作答位只给一处——题干行内已给出短答空位（括号空位／下划线空位）时，'
    + '不得再在题后另起同性质的整行短答载体（整行空白只用于确需整段书写的长答；**性质不同者本就该并存**、不算重复）'
    + (subject === '数学'
      // 纯形态描述，不点题型名以外的引导（"算式题/过程书写区/得数结果位"均为卷面形态词）
      ? '；**例外**：算式题的"等号后得数结果位"与"过程书写区"不属重复——前者填得数、后者写过程，必要时**并存**，过程区按上文预留要求给出'
      // 非数学：只保留"只给一处"这一判据——其"同性质形态统一"已由通用段"同一题（含并列子题）同性质空位的形态一致"承载（单一正句），此处不再复述
      : '')
    + '；';
  // 2026-09-29（**模型侧去限制**·用户追问"模型侧有没有限制？"）：原句对**所有**题一律给上限，
  //    而上限本质是"卷面一屏能放多少"——它**不成立于"答案长度由内容本身决定"的题**（见下方
  //    ANSWER_MAX_ROWS_BY_STAGE 注释：成篇成段表达、需完整推演的多步过程，25 分一篇远超学段默认 8 行）。
  //    原句把这类题也压到学段默认值 = **给模型下了错限制**（且它无从知道可以超）。故只声明**管辖域**：
  //    上限管"常规作答区"，不管"篇幅由内容决定"的题。**不新增任何数值**（数值口径走
  //    ANSWER_MAX_ROWS_BY_SUBJECT，面板可调，按现有注释"不在代码里编"）。
  // 2026-10-01（③去理由句）：删「该上限是"卷面一屏空间"口径」与「（其长度由内容决定、无法预估）」两处
  //    理由/冗余——管辖域（上限只管常规作答区）与「不受此上限约束」一字未动；口径来由见上方 2026-09-29 注释，
  //    模型侧不需要理由，只需要判据。
  const capCore = `**常规作答区**的单题行数不超过本学段卷面上限（${region.maxRowsPerItem} 行）；**答案篇幅由内容决定**的题（成篇成段的整段文字、须完整展露推演步骤）按实际篇幅给足，不受此上限约束`;
  // 2026-10-04（拆长条·正式考卷批）：原"位置行 ＋ 行数上限 ＋ 同性质一处"挤成一条 334 字（一条多事）
  //   → 同文拆条：capCore（行数上限/篇幅例外）与 dupClause（同性质一处）各自成 `· ` 一条，判据逐字未改、只分条。
  const capText = `\n· ${capCore}` + `\n· ${dupClause.replace(/^；/, '')}`;
  // 2026-10-03（①三维度·门控缺口补做）：位置条款（整题之后集中一处、不插在要求/提示分条之间）原**只写在英语分支**，
  //   致语文（及其他 line 载体学科）缺此判据 → 实测伤情⑤：低段写话"要求(1)(2)(3)"分条之间被插入满行横线。
  //   现提为 **line 载体通用**（纯位置描述、零题型名/零学科名，不跨学科广播载体词）——属"该出现却没出现"的补位，非新增约束。
  const positionClause = '· 需成段/成篇书写的题，其整行书写横线只在整题之后集中给一处（行数按该题答案篇幅）；题干含"要求/提示"分条时，横线给在分条之后，不插在分条之间、不给每个分条各配一处作答区。'
    // 2026-09-28 划清作用域（消"载体放最后"被泛化到逐词书写格）：本条只针对**成段/成篇的整行书写横线**，
    //    不适用于"逐词书写格"——后者按"与对应书写对象同行紧邻、逐词一一对应"（见书写载体协议位置行）。
    //    注意：此处**不得出现"田字格/拼音格"等语文专属载体名**（英语模板禁这些字面，见 eduRenderContract 回归）。
    + '（本条仅限成段/成篇的整行书写横线，不适用于"逐词书写格"——逐词书写格按"与对应书写对象同行紧邻、逐词一一对应"处理）';
  if (region.carrier === 'line') {
    // 🔧 书写行学科按书写篇幅分流（纯形态描述，不用题型名）：语文成篇成文走专用书写格通道 → 本列排除；
    //    英语成段/成篇同属横线体系（2j-5b 程序补横线同语义）→ 一并含入；
    //    三句按学科各自收敛，不跨学科广播书写载体词
    if (subject === '语文') {
      return '· 答案须成句成段书写的题，输出整行书写横线，每行一横、行数按答案篇幅，不得省略\n另注：成篇成文类用专用书写载体，不用整行横线' + capText + '\n' + positionClause;
    }
    if (subject === '英语') {
      // 2026-09-14（用户实证）：英语写作题把"要求：1. 2. 3."逐条当成了需作答的题 → 每条后各给 4 行横线
      //    （实测产物：横线插在要求条目之间，卷面像"三条小题各带作答区"）。本条只定位**横线给在哪里**：
      //    整题一处、分条之后；不涉及题型、不涉及覆盖口径。
      return '· 答案须成句成段书写的题（含成篇表达）输出整行书写横线，每行一横、行数按答案篇幅，不得省略；\n'
        + positionClause + capText;
    }
    return '· 答案须成句成段书写的题输出整行书写横线，每行一横、行数按答案篇幅，不得省略' + capText + '\n' + positionClause;
  }
  // 🔧 反误引导（2026-09）：模型端须自出空白作答行（<p><br></p> 每段一行），程序 2k 只补差额；
  //    通用禁占位句已含"不写作答区字样"，本句不再重复
  // 2026-10-04（拆长条·用户口径「块内一条一行」）：原 356 字一条挤三事（形态／上限／同性质去重）
  //    → 拆为三条，复用 capCore/dupClause 单源（不复制第二份）；判据逐字未改。
  return [
    '· 答案需成篇成段书面展开的长答题：题干后输出无线空白作答行——每个空段落 <p><br></p> 为一行，行数按该题答案篇幅逐题确定（长答多给、短答少给），不得省略；空白行不画横线、不把留白圈成方框。',
    `· ${capCore}。`,
    `· ${dupClause.replace(/^；/, '').replace(/；$/, '。')}`,
  ].join('\n');
};

/**
 * 单题作答区行数上限（规格层·单一事实源，2026-09-17 用户裁定补收口）
 * ============================================================
 * 为什么需要：`linePerScore`（分值×系数）是**主规则**，但它对"短答成句"这类题会按分给过量空间——
 *   全矩阵实测（426 处受影响）里的真异常：语文·小学低段「按要求写句子（每题5分）」→ 7 行/题、
 *   低段每题6分→9行、8分→12行（写一句话占大半页）。卷面惯例上，**低段单题作答区极少超过 4 行**，
 *   长答（写话/作文）另走作文格通道（writing-grid-fix）与本表无关。
 * 口径修正（2026-09-29·去一刀切）：
 *   · 本表只作**学段默认**。上限本质是"卷面一屏能放下多少"，但它**不成立于"答案篇幅由内容长度决定"的题**
 *     （书面表达、多步解答）：这类题给同一学段所有学科一个上限，会把高中英语书面表达（25 分×0.8≈20 行）
 *     与高中多步解答压到 8 行，而语文作文走作文格通道不受此限 → 同学段不同学科需求未被建模。
 *   · 学科×学段覆盖走**独立顶层表** `ANSWER_MAX_ROWS_BY_SUBJECT`（形如 `{英语:{high:20}}`）——不能写进
 *     `ANSWER_REGION` 条目（`mergeDeep` 只并 base 已有键，会丢弃 → 覆盖不生效，已实测并改用独立表）。
 *   · ⚠️ **覆盖数值属卷面惯例口径，不在代码里编**：需要覆盖的学科×学段由该口径决定，面板可调
 *     （规格库 UI「作答区行数上限」组，**前提：该规格组处于启用状态**），未设即沿用本表默认。
 *   需求行数 = min(分值 × linePerScore, maxRowsPerItem)，无分值兜底（4/2 行）同样受上限约束。
 *   调节点仍在本规格库：地区卷面差异改这里（勿在补差逻辑里加题型特例）。
 */
export const ANSWER_MAX_ROWS_BY_STAGE = {
  primary_low: 4,   // 低段：单题少见超过 4 行（长答走写话/作文格通道）
  primary_mid: 5,
  primary_high: 6,
  middle: 8,        // 初中：解答题按分给行，8 行≈60mm（0.9×分值 的中高值档）
  high: 8,          // 高中：同上（0.8×分值，8 行≈56mm）
};

/**
 * 无分值题的兜底行数（**规格库单一事实源**·学科无关）
 * ============================================================
 * 教辅/同步练习的大题常不标分值，此时按题型惯例兜底：整题块 N 行、子题块 M 行
 * （子题给更少，防"大题内连片大空白"）。
 * 原为 examValidator 2k 内**写死的 4 / 2** —— 属"规格库缺键、程序自持数值"，现入库以便统一调节；
 *    ⚠️ 兜底值**仍受 `ANSWER_MAX_ROWS_BY_STAGE` 单题上限约束**（越不过本学段上限）。
 */
export const ANSWER_NO_SCORE_ROWS = { item: 4, sub: 2 };

/**
 * 学科×学段 → 无分值兜底行数**覆盖表**（**规格库单一事实源**；内置默认空 = 不覆盖）
 * ============================================================
 * 与 `ANSWER_MAX_ROWS_BY_SUBJECT` 同模式（**独立顶层键 + 浅合并**，故覆盖必保留；写进同类嵌套对象会被
 *   `mergeDeep` 丢弃）。形态 `{ [学科]: { [学段]: { item, sub } } }`。
 * 为什么需要：4/2 行对低段合理（学段上限恰为 4），但中高段长答主观题（论述/说明/解答）偏小——
 *   同学段不同学科需求未建模。
 * 数值属**卷面惯例口径**（不在代码里编），面板可调；未列即回退 `ANSWER_NO_SCORE_ROWS`。
 */
export const ANSWER_NO_SCORE_ROWS_BY_SUBJECT = {};

/**
 * 学科×学段 → 单题作答区行数上限**覆盖表**（**规格库单一事实源**；内置默认空 = 不覆盖）
 * ============================================================
 * 为什么单独一张表：`getAnswerRegion` 的 base 来自 `ANSWER_REGION[学科][学段]`，而 `mergeDeep` **只合并
 *   base 已有的键**——把 `maxRowsPerItem` 写进 `ANSWER_REGION` 的条目会被合并环节丢弃（实测：覆盖不生效）。
 *   本表为**独立顶层键**、按 `{...内置, ...覆盖}` 浅合并，故用户覆盖必定保留。
 * 形态：`{ [学科]: { [学段]: 行数 } }`；未列即回退 `ANSWER_MAX_ROWS_BY_STAGE` 的学段默认。
 * 数值属**卷面惯例口径**（不在代码里编），面板可调（规格库 UI「作答区行数上限」组）。
 * 用途：对"答案篇幅由内容长度决定"的题（书面表达、多步解答）按学科×学段给恰当上限。
 */
export const ANSWER_MAX_ROWS_BY_SUBJECT = {};

/** 解答题作答空间（学科 × 学段 → 参数）
 *  - carrier：'line' 横线（文字书写引导）/ 'blank-area' 无线空白行（答题卡风格）
 *  - linePerScore：需求行数 = 分值 × 系数
 *  - lineHeightMm：行高
 *  - maxRowsPerItem：**单题作答区行数上限**（按学段，见 ANSWER_MAX_ROWS_BY_STAGE；学科无关——上限是"卷面空间"概念）
 *  - '*' = 通配默认（空白，对齐主流考试惯例——文综/理综主观题空白答题框）；
 *    英语/科学 全学段显式覆盖为横线（英语书面表达横线行实证 17cm/行距1cm；科学简答/记录横线）；
 *    语文 低中段横线（写话/句子练习惯例）、中高段空白（阅读/论述/简答答题卡实证空白作答区）。
 *  ⚠️ 非课标要求，属卷面惯例（各省考试院答题卡规范），可按地区在排版规格库调整。
 * 消费方：examValidator answer-area-fix（题有分值但有效作答行不足 → 按此补差）
 */
export const ANSWER_REGION = {
  '*': {
    primary_low: { linePerScore: 1.4, lineHeightMm: 9, carrier: 'blank-area' },
    primary_mid: { linePerScore: 1.2, lineHeightMm: 8.5, carrier: 'blank-area' },
    primary_high: { linePerScore: 1.0, lineHeightMm: 8, carrier: 'blank-area' },
    middle: { linePerScore: 0.9, lineHeightMm: 7.5, carrier: 'blank-area' },
    high: { linePerScore: 0.8, lineHeightMm: 7, carrier: 'blank-area' },
  },
  语文: {
    // 🔧 2026-09 学段对齐（中高考答题卡实证）：语文作文走作文格独立通道；阅读/论述/简答等主观题
    //    在真实中高考答题卡上为空白作答区（黑色边框内无线空白，调研见 2026-09 实证）→ middle/high 改 blank-area；
    //    小学低中段写话/句子练习等保留 line（书写横线惯例，低段卷面常见；primary_high 亦保留——小高卷面横线/空白均有，横线对短答更稳）
    // 2026-09-26 用户实证（"十一、连词成句，加上合适的标点：每小题一行就够，结果补了 3 行"）：
    //    低段 2 分题按旧系数 1.4 → ceil(2.8)=3 行（明显过量）。低段句子类作答本就是"写一句话"，
    //    故低段系数降为 0.5（2分→1行、4分→2行、5分→3行），仍受 ANSWER_MAX_ROWS_BY_STAGE 上限约束。
    //    ⚠️ 仅改**有实证的语文·小学低段**，中/高段与 '*' 通配不动（避免一刀切，待各自实证再调）。
    primary_low: { linePerScore: 0.5, lineHeightMm: 9, carrier: 'line' },
    primary_mid: { linePerScore: 1.2, lineHeightMm: 8.5, carrier: 'line' },
    primary_high: { linePerScore: 1.0, lineHeightMm: 8, carrier: 'line' },
    middle: { linePerScore: 0.9, lineHeightMm: 7.5, carrier: 'blank-area' },
    high: { linePerScore: 0.8, lineHeightMm: 7, carrier: 'blank-area' },
  },
  英语: {
    primary_low: { linePerScore: 1.4, lineHeightMm: 9, carrier: 'line' },
    primary_mid: { linePerScore: 1.2, lineHeightMm: 8.5, carrier: 'line' },
    primary_high: { linePerScore: 1.0, lineHeightMm: 8, carrier: 'line' },
    middle: { linePerScore: 0.9, lineHeightMm: 7.5, carrier: 'line' },
    high: { linePerScore: 0.8, lineHeightMm: 7, carrier: 'line' },
  },
  科学: {
    primary_low: { linePerScore: 1.4, lineHeightMm: 9, carrier: 'line' },
    primary_mid: { linePerScore: 1.2, lineHeightMm: 8.5, carrier: 'line' },
    primary_high: { linePerScore: 1.0, lineHeightMm: 8, carrier: 'line' },
    middle: { linePerScore: 0.9, lineHeightMm: 7.5, carrier: 'line' },
    high: { linePerScore: 0.8, lineHeightMm: 7, carrier: 'line' },
  },
};

/** 查询某学科×学段的解答区参数（合并用户覆盖；未显式学科回退 '*'） */
export function getAnswerRegion(subject = '', stage = '') {
  const spec = getMergedSpec();
  const table = spec.ANSWER_REGION || {};
  const row = table[subject] || table['*'] || {};
  const base = row[stage] || { linePerScore: 1, lineHeightMm: 8, carrier: 'blank-area' };
  // 单题作答区行数上限（规格层单一事实源，2026-09-17）：学位/学科行内可显式覆盖，否则取学段表。
  //    2026-09-29（去一刀切）：学科×学段覆盖改读独立顶层表 ANSWER_MAX_ROWS_BY_SUBJECT（浅合并、覆盖必保留；
  //    写进 ANSWER_REGION 条目会被 mergeDeep 丢弃——实测覆盖不生效）。
  const capTable = spec.ANSWER_MAX_ROWS_BY_STAGE || ANSWER_MAX_ROWS_BY_STAGE;
  const subjCapTable = spec.ANSWER_MAX_ROWS_BY_SUBJECT || ANSWER_MAX_ROWS_BY_SUBJECT;
  const subjectCap = subjCapTable?.[subject]?.[stage];
  const maxRowsPerItem = Number.isFinite(base.maxRowsPerItem)
    ? base.maxRowsPerItem
    : (Number.isFinite(subjectCap) ? subjectCap : (Number.isFinite(capTable[stage]) ? capTable[stage] : 8));
  return { ...base, maxRowsPerItem };
}

/**
 * 方格纸 square-grid（作图答题区，小学段专用；初中以上由考试答题纸自带网格，不强制）
 * cellMm：格子边长（CSS 背景网格与宽高换算用）
 */
export const SQUARE_GRID = {
  primary: { cols: 12, rows: 8, cellMm: 7 },
  middle: null,
  high: null,
};

/** 括号答题格 bracket-grid（行高/宽度，themeConfig 与 RichTextEditor CSS 读取） */
export const BRACKET_GRID = {
  rowHeightMm: 10,
  widthMm: 52,
};

/** 书写格物理尺寸（mm）· 按学段三档键（手写体随学段变化：低段格大、高段格小；与 ZUOWEN_CELL 同模式，
 *  消费方统一经 normalizeStage3 归一到 primary/middle/high 取值）。
 *  方块格（田字格/米字格）：宽×高；行式格（四线三格/拼音格）：行高。
 *  消费方：themeConfig 预览 CSS（mm→px 渲染，与作文格/方格纸同通道）；
 *  docx 导出：方块格按 primary 12mm 统一（docxBuilder tzgCellMm/格子行盒），
 *  行式格（四线三格/拼音格）两端均按字母字号自适应 1.45em 定高（2026-09 用户反馈校准：
 *  曾注入本表 9/8mm → 小字号书写格位失真；现 --flt-h 恒 1.45em，本表行高仅作归档）。
 *  ⚠️ GRID_CELL['four-line-three'/'pinyin-line'].lineHeightMm 不再被消费端读取。 */
export const GRID_CELL = {
  'tian-zi-ge': {
    // 🔴 2026-10-05（调研·强制国标落地）：GB 40070-2021 规定小学一、二年级田字格/方格 **宽＝高、≥14.0mm**
    //    （原 12mm 低于国标下限 → 手写字憋挤）。低段统一取 **14mm**；中/高段无强制格，维持 9/8mm。
    primary: { widthMm: 14, heightMm: 14 },
    middle: { widthMm: 9, heightMm: 9 },
    high: { widthMm: 8, heightMm: 8 },
  },
  'mi-zi-ge': {
    primary: { widthMm: 14, heightMm: 14 },
    middle: { widthMm: 9, heightMm: 9 },
    high: { widthMm: 8, heightMm: 8 },
  },
  'four-line-three': {
    primary: { lineHeightMm: 9 },
    middle: { lineHeightMm: 8 },
  },
  'pinyin-line': {
    primary: { lineHeightMm: 9 },
    middle: { lineHeightMm: 8 },
  },
};

/** 作文格默认补全格数（examValidator writing-grid-fix 自动补 zuo-wen-ge 用；低于"分值×每分格数"时按分值动态放大） */
export const ZUOWEN_FILL_CELLS = 160;

/** 作文格自动补格系数：每分格数（examValidator 2j-5 按 题目分值×系数 动态补格，与 ANSWER_REGION 按学段系数同模式；
 *  校准依据（2026-08，各学段课标有字数要求的从其要求、无要求的按卷面惯例 + 标点缩进余量）；⚠️ 2026-09-17 核查更正：原"小学高段按课标 40 分钟不少于 450 字"属**误引**——"40 分钟不少于 400 字"是 2001 年实验稿条款、2011 年版已删除，"450 字"课标查无出处；第四学段现行条款才是"45 分钟能完成不少于 500 字"。数值未改（原即按卷面惯例校准）：
 *    - 高中：作文要求"不少于800字"，高分篇幅 850-900 字，考试作文纸 900-1000 格 → 60分×17=1020
 *    - 初中：作文要求"不少于600字"（多数地区），作文纸 800-1000 格 → 40分×20=800
 *    - 小学高段（5-6年级）：课标只要求"习作要有一定速度，课内习作每学年16次左右"，无字数下限；按卷面惯例（期末卷 400-500 字）→ 30分×16=480
 *    - 小学中段（3-4年级）：同上无课标字数要求；按卷面惯例 300-400 字 → 30分×12=360
 *    - 小学低段（1-2年级）：写话不规定字数（几句话），兜底 160 已足够
 *  不足 ZUOWEN_FILL_CELLS 兜底时取兜底数） */
export const ZUOWEN_CELLS_PER_SCORE = {
  primary_low: 8,
  primary_mid: 12,
  primary_high: 16,
  middle: 20,
  high: 17,
};

// ==================== 用户自定义持久化 ====================
const LAYOUT_SPEC_USER_KEY = 'wisdom_layout_spec_v1';

/** 读取用户覆盖（localStorage） */
export function loadLayoutSpecOverride() {
  try { return JSON.parse(localStorage.getItem(LAYOUT_SPEC_USER_KEY) || '{}'); } catch { return {}; }
}

/** 保存用户覆盖 */
export function saveLayoutSpecOverride(override) {
  try { localStorage.setItem(LAYOUT_SPEC_USER_KEY, JSON.stringify(override)); return true; } catch { return false; }
}

/** 清除用户覆盖，恢复内置默认 */
export function resetLayoutSpecOverride() {
  try { localStorage.removeItem(LAYOUT_SPEC_USER_KEY); } catch {}
}

/** 递归深合并（支持任意层对象嵌套；标量/数组/null 直接取 override，override 缺省保留 base） */
function mergeDeep(base, override) {
  if (override === undefined) return base;
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return override;
  const out = {};
  for (const k of Object.keys(base)) {
    out[k] = mergeDeep(base[k], override[k]);
  }
  return out;
}

/** 内置默认快照（只读，用于"恢复默认"比对与视图展示） */
export const LAYOUT_SPEC_DEFAULTS = {
  ZUOWEN_CELL, ZUOWEN_MARK_STEP, ZUOWEN_DEFAULT_SPAN, BLANK, WRITING_CARRIER, CARRIER_RULES, ANSWER_REGION, SQUARE_GRID,
  BRACKET_GRID, ZUOWEN_FILL_CELLS, ZUOWEN_CELLS_PER_SCORE, GRID_CELL, ANSWER_MAX_ROWS_BY_STAGE, ANSWER_NO_SCORE_ROWS,
  ANSWER_MAX_ROWS_BY_SUBJECT, ANSWER_NO_SCORE_ROWS_BY_SUBJECT,
};

/** BLANK 规格消毒：档位越界会导致换算产物无 CSS/无编辑器白名单（blank-25+ 宽度失效） */
export const sanitizeBlankSpec = (b = {}) => {
  const minBlank = Math.min(24, Math.max(1, Math.round(Number(b.minBlank) || 2)));
  const maxBlank = Math.min(24, Math.max(minBlank, Math.round(Number(b.maxBlank) || 24)));
  const maxCap = Math.min(maxBlank, Math.max(minBlank, Math.round(Number(b.maxCap) || 16)));
  const wordGap = Math.min(4, Math.max(1, Number(b.wordGap) || 1));
  return { minBlank, maxBlank, maxCap, wordGap };
};

/** 规格组 → 顶级字段映射（LayoutSpecView 启停开关按组控制） */
export const LAYOUT_SPEC_GROUPS = {
  zuowen: ['ZUOWEN_CELL', 'ZUOWEN_MARK_STEP', 'ZUOWEN_DEFAULT_SPAN', 'ZUOWEN_CELLS_PER_SCORE'],
  blank: ['BLANK'],
  carrier: ['WRITING_CARRIER', 'GRID_CELL'],
  answer: ['ANSWER_REGION', 'ANSWER_MAX_ROWS_BY_STAGE', 'ANSWER_NO_SCORE_ROWS', 'ANSWER_MAX_ROWS_BY_SUBJECT', 'ANSWER_NO_SCORE_ROWS_BY_SUBJECT'],
  square: ['SQUARE_GRID', 'BRACKET_GRID', 'ZUOWEN_FILL_CELLS'],
  'carrier-rules': ['CARRIER_RULES'],
};

/** 合并内置 + 用户覆盖，返回完整规格对象（消费者调用此函数获取最新值） */
export function getMergedSpec() {
  const user = loadLayoutSpecOverride();
  // 工具库启停开关：停用的规格组不合并用户覆盖（回退内置默认，消费者零改动）
  for (const [gid, keys] of Object.entries(LAYOUT_SPEC_GROUPS)) {
    if (!isLibEntryEnabled('layout-spec', gid)) for (const k of keys) user[k] = undefined;
  }
  return {
    ZUOWEN_CELL: mergeDeep(ZUOWEN_CELL, user.ZUOWEN_CELL),
    ZUOWEN_MARK_STEP: { ...ZUOWEN_MARK_STEP, ...(user.ZUOWEN_MARK_STEP || {}) },
    ZUOWEN_DEFAULT_SPAN: user.ZUOWEN_DEFAULT_SPAN ?? ZUOWEN_DEFAULT_SPAN,
    // 🔧 BLANK 档位消毒（档位缝隙收口）：CSS/编辑器白名单只覆盖 blank-1..24，越界档位无样式=宽度失效；
    //    统一约束 1 ≤ minBlank ≤ maxCap ≤ maxBlank ≤ 24，wordGap 限 1..4（LayoutSpecView 上限同步，见面板 blank 组）
    BLANK: sanitizeBlankSpec({ ...BLANK, ...(user.BLANK || {}) }),
    WRITING_CARRIER: mergeDeep(WRITING_CARRIER, user.WRITING_CARRIER),
    GRID_CELL: mergeDeep(GRID_CELL, user.GRID_CELL),
    CARRIER_RULES: mergeDeep(CARRIER_RULES, user.CARRIER_RULES),
    ANSWER_REGION: mergeDeep(ANSWER_REGION, user.ANSWER_REGION),
    // 2026-09-29：行数上限与无分值兜底**必须进合并白名单**，否则面板可调但读取端拿不到覆盖值
    //    （getAnswerRegion 的 `spec.ANSWER_MAX_ROWS_BY_STAGE || 内置` 会恒取内置 → UI 形同死字段）
    ANSWER_MAX_ROWS_BY_STAGE: { ...ANSWER_MAX_ROWS_BY_STAGE, ...(user.ANSWER_MAX_ROWS_BY_STAGE || {}) },
    ANSWER_NO_SCORE_ROWS: { ...ANSWER_NO_SCORE_ROWS, ...(user.ANSWER_NO_SCORE_ROWS || {}) },
    // 学科×学段行数上限覆盖：独立顶层键 + 浅合并 → 用户覆盖必定保留（写进 ANSWER_REGION 条目会被 mergeDeep 丢弃）
    ANSWER_MAX_ROWS_BY_SUBJECT: { ...ANSWER_MAX_ROWS_BY_SUBJECT, ...(user.ANSWER_MAX_ROWS_BY_SUBJECT || {}) },
    ANSWER_NO_SCORE_ROWS_BY_SUBJECT: { ...ANSWER_NO_SCORE_ROWS_BY_SUBJECT, ...(user.ANSWER_NO_SCORE_ROWS_BY_SUBJECT || {}) },
    SQUARE_GRID: mergeDeep(SQUARE_GRID, user.SQUARE_GRID),
    BRACKET_GRID: { ...BRACKET_GRID, ...(user.BRACKET_GRID || {}) },
    ZUOWEN_FILL_CELLS: user.ZUOWEN_FILL_CELLS ?? ZUOWEN_FILL_CELLS,
    ZUOWEN_CELLS_PER_SCORE: mergeDeep(ZUOWEN_CELLS_PER_SCORE, user.ZUOWEN_CELLS_PER_SCORE),
  };
}

export default {
  ZUOWEN_CELL, ZUOWEN_MARK_STEP, ZUOWEN_DEFAULT_SPAN, BLANK, WRITING_CARRIER, CARRIER_RULES, CARRIER_DECLARATION,
  ANSWER_REGION, SQUARE_GRID,
  BRACKET_GRID, ZUOWEN_FILL_CELLS, ZUOWEN_CELLS_PER_SCORE, GRID_CELL, ANSWER_MAX_ROWS_BY_STAGE, ANSWER_NO_SCORE_ROWS,
  ANSWER_MAX_ROWS_BY_SUBJECT, ANSWER_NO_SCORE_ROWS_BY_SUBJECT,
  LAYOUT_SPEC_DEFAULTS, LAYOUT_SPEC_GROUPS,
  loadLayoutSpecOverride, saveLayoutSpecOverride, resetLayoutSpecOverride, getMergedSpec, getCarrierAllowlist,
  getAnswerRegion, normalizeStage3,
};