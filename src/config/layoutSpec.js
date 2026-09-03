/**
 * 排版规格库（Layout Spec）—— 学段渲染参数（程序可读数据）唯一事实源
 * ============================================================
 * 🔴 定位：承载"程序化的格式规则/参数"，供骨架编译器、清洗器(normalizeBlankMarkers)、
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
 *   maxCap：宽度上限指数（16 = 8 个汉字；答案通常 ≤8 字，超长用"行尾自动延伸"方案）
 *   wordGap：1 字 ≈ N 格（填空宽度与答案字数匹配，1 字 ≈ 2 格）
 *   minBlank / maxBlank：blank-{n} 合法区间（2 ≤ n ≤ 24）
 */
export const BLANK = {
  maxCap: 16,     // 🔴 宽度上限 16em（8 个汉字），超长会超出页内边距
  wordGap: 2,     // 1 字 ≈ 2 格
  minBlank: 2,
  maxBlank: 24,
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
    primary_low: ['line'],                      // 低段：显式声明=无书写格（英语 3 年级起点，1-2 年级不要求字母书写）
    primary_mid: ['four-line-three'],           // 中段：四线三格
    primary_high: ['line'],                     // 高段起正常
    middle: ['line'],
    high: ['line'],
  },
  数学: {
    primary_low: ['square-grid'],
    primary_mid: ['square-grid'],
    primary_high: ['square-grid'],
    middle: [], // 🔴 作图方格纸仅小学段渲染（SQUARE_GRID middle/high=null）；初中以上由考试答题纸自带网格，不给"用方格纸"诱导
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
    // 语文低段：写汉字类 → 田字格
    { subject: '语文', stages: ['primary_low'], keywords: '看拼音写|写一写|抄写|默写|听写|写字|书写', carrier: 'tian-zi-ge' },
    // 语文低段：写拼音类 → 拼音格
    { subject: '语文', stages: ['primary_low'], keywords: '写拼音|写音节|标声调|给音节', carrier: 'pinyin-line' },
    // 英语中段：字母/单词抄写 → 四线三格
    { subject: '英语', stages: ['primary_mid'], keywords: '抄写|写一写|书写|Write|write', carrier: 'four-line-three' },
  ],
  forbid: [
    // 表达/写话类：禁止混入格子（作文格 zuo-wen-ge 由 writing-grid-fix 作文格通道单独管理，不在此列）
    { keywords: '看图写话|写话|习作|作文|写作|小练笔|口语交际', carriers: ['tian-zi-ge', 'four-line-three', 'sixian-ge', 'pinyin-line', 'mi-zi-ge'] },
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
  if (!parts.length) return '';
  // 🔧 书写格结构约束（基准1/2 根治）：格子必须紧跟对应词语/拼音之后，不得集中单独成段；
  //    且格子必须是空格子（作答载体），格内不填字/拼音/答案；
  //    计分自洽条款（基准3 根治）：按词/字计分时词数=拼音组数、字数=书写格数——仅 must 命中
  //    （语文低段/英语中段书写类）注入，天然按 学科×学段 收敛，不对全学科广播（防跨学科噪音）
  const hasMust = parts.some((p) => p.includes('必须真实输出'));
  const structureNote = hasMust
    ? '书写格紧跟对应词语（拼音）之后输出，不得集中单独成段；书写类题按词或字计分时声称须自洽（词数=拼音组数、字数=书写格数，总分=单位分×实际载体数）。'
    : '';
  return `${parts.join('；')}${hasMust ? '；题干未写明时按此书写惯例。' : '。'}${structureNote ? ` ${structureNote}` : ''}`;
}

/**
 * 填空留白换算口径（渲染端宽度换算的可操作版，注入给模型）
 *  🔴 单一事实源：数字由 BLANK 动态计算（wordGap→每字位 em、maxCap→单处上限字位数），
 *     排版规格（LayoutSpecView）调整 BLANK 后本口径自动跟随，禁止在提示词里手写死另一套数字；
 *  🔴 只讲宽度换算（空格数↔字位↔em），不出现横线/括号/下划线等形态词（防诱导，审核基准 2.4）；
 *  🔴 分工口径（2026-09 收敛）：手写放大系数（每字位 wordGap em）与宽度上限是渲染端参数，
 *     模型只需按答案字数给空格（答案几字给几个空格），不教模型算 em/上限以外的事，拒绝补丁句堆叠；
 * 消费方：promptLibrary QUESTION_FORMAT（题为主类型统一注入；内容型不注入）
 */
export function buildBlankWidthInstruction(spec = BLANK) {
  const b = sanitizeBlankSpec(spec);
  const per = b.wordGap; // 1 空格 ≈ per em
  const capChars = Math.max(1, Math.floor(b.maxCap / per)); // 单处上限 ≈ maxCap em
  const perText = Number.isInteger(per) ? String(per) : String(per);
  return (
    `渲染端换算口径：1 个全角空格≈1 个字位≈${perText} em 书写宽，答案每 1 字/1 位数字给 1 个空格，` +
    `单处上限 ${capChars} 字位（约 ${b.maxCap} em），超出改用整行书写位`
  );
}

/**
 * 解答题作答空间（学科 × 学段 → 参数）
 *  - carrier：'line' 横线（文字书写引导）/ 'blank' 无线空白行（答题卡风格）
 *  - linePerScore：需求行数 = 分值 × 系数
 *  - lineHeightMm：行高
 *  - '*' = 通配默认（空白，对齐主流考试惯例——文综/理综主观题空白答题框）；
 *    语文/英语/科学 显式覆盖为横线（阅读/书面表达/简答横线书写）。
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
    primary_low: { linePerScore: 1.4, lineHeightMm: 9, carrier: 'line' },
    primary_mid: { linePerScore: 1.2, lineHeightMm: 8.5, carrier: 'line' },
    primary_high: { linePerScore: 1.0, lineHeightMm: 8, carrier: 'line' },
    middle: { linePerScore: 0.9, lineHeightMm: 7.5, carrier: 'line' },
    high: { linePerScore: 0.8, lineHeightMm: 7, carrier: 'line' },
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
  const spec = getMergedSpec().ANSWER_REGION;
  const row = spec[subject] || spec['*'] || {};
  return row[stage] || { linePerScore: 1, lineHeightMm: 8, carrier: 'blank-area' };
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
    primary: { widthMm: 12, heightMm: 12 },
    middle: { widthMm: 9, heightMm: 9 },
    high: { widthMm: 8, heightMm: 8 },
  },
  'mi-zi-ge': {
    primary: { widthMm: 12, heightMm: 12 },
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
 *  校准依据（2026-08，按课标/中高考实际字数要求 + 标点缩进余量）：
 *    - 高中：作文要求"不少于800字"，高分篇幅 850-900 字，考试作文纸 900-1000 格 → 60分×17=1020
 *    - 初中：作文要求"不少于600字"（多数地区），作文纸 800-1000 格 → 40分×20=800
 *    - 小学高段（5-6年级）：课标"40分钟完成不少于450字左右"，期末考 400-500 字 → 30分×16=480
 *    - 小学中段（3-4年级）：第二学段 300-400 字 → 30分×12=360
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
  BRACKET_GRID, ZUOWEN_FILL_CELLS, ZUOWEN_CELLS_PER_SCORE, GRID_CELL,
};

/** BLANK 规格消毒：档位越界会导致换算产物无 CSS/无编辑器白名单（blank-25+ 宽度失效） */
export const sanitizeBlankSpec = (b = {}) => {
  const minBlank = Math.min(24, Math.max(1, Math.round(Number(b.minBlank) || 2)));
  const maxBlank = Math.min(24, Math.max(minBlank, Math.round(Number(b.maxBlank) || 24)));
  const maxCap = Math.min(maxBlank, Math.max(minBlank, Math.round(Number(b.maxCap) || 16)));
  const wordGap = Math.min(4, Math.max(1, Number(b.wordGap) || 2));
  return { minBlank, maxBlank, maxCap, wordGap };
};

/** 规格组 → 顶级字段映射（LayoutSpecView 启停开关按组控制） */
export const LAYOUT_SPEC_GROUPS = {
  zuowen: ['ZUOWEN_CELL', 'ZUOWEN_MARK_STEP', 'ZUOWEN_DEFAULT_SPAN', 'ZUOWEN_CELLS_PER_SCORE'],
  blank: ['BLANK'],
  carrier: ['WRITING_CARRIER', 'GRID_CELL'],
  answer: ['ANSWER_REGION'],
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
    SQUARE_GRID: mergeDeep(SQUARE_GRID, user.SQUARE_GRID),
    BRACKET_GRID: { ...BRACKET_GRID, ...(user.BRACKET_GRID || {}) },
    ZUOWEN_FILL_CELLS: user.ZUOWEN_FILL_CELLS ?? ZUOWEN_FILL_CELLS,
    ZUOWEN_CELLS_PER_SCORE: mergeDeep(ZUOWEN_CELLS_PER_SCORE, user.ZUOWEN_CELLS_PER_SCORE),
  };
}

export default {
  ZUOWEN_CELL, ZUOWEN_MARK_STEP, ZUOWEN_DEFAULT_SPAN, BLANK, WRITING_CARRIER, CARRIER_RULES, CARRIER_DECLARATION,
  ANSWER_REGION, SQUARE_GRID,
  BRACKET_GRID, ZUOWEN_FILL_CELLS, ZUOWEN_CELLS_PER_SCORE, GRID_CELL,
  LAYOUT_SPEC_DEFAULTS, LAYOUT_SPEC_GROUPS,
  loadLayoutSpecOverride, saveLayoutSpecOverride, resetLayoutSpecOverride, getMergedSpec, getCarrierAllowlist,
  getAnswerRegion, normalizeStage3,
};