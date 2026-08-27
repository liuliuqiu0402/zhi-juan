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
 *  - 语文：低段田字格+拼音格；中段起正常横线
 *  - 英语：中段四线三格（英语 3 年级起点）；高段起正常横线
 *  - 数学：作图方格纸 square-grid 全学段合法（作图答题区）；其余格子类一律不允许
 *  - 其余学科（物理/化学/生物/科学/道法/政治/历史/地理/音乐/美术/体育/信息）：显式空数组
 *    = 不允许任何格子类（出现田字格/四线三格等即按越界自动剥离）
 *  - 未显式定义的学科（新学科兜底）：不检测（getCarrierAllowlist 返回 null）
 * 消费方：examValidator writing-grid-fix（按 学科×学段 检查输出载体是否越界，越界自动剥离保留文字）
 */
export const WRITING_CARRIER = {
  语文: {
    primary_low: ['tian-zi-ge', 'pinyin-line'], // 低段：田字格/拼音格
    primary_mid: ['line'],                      // 中段起正常
    primary_high: ['line'],
    middle: ['line'],
    high: ['line'],
  },
  英语: {
    primary_mid: ['four-line-three'],           // 中段：四线三格
    primary_high: ['line'],                     // 高段起正常
    middle: ['line'],
    high: ['line'],
  },
  数学: {
    primary_low: ['square'],
    primary_mid: ['square'],
    primary_high: ['square'],
    middle: ['square'],
    high: ['square'],
  },
  物理: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  化学: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  生物: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  科学: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  道法: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  政治: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  历史: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  地理: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  音乐: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  美术: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  体育: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
  信息: { primary_low: [], primary_mid: [], primary_high: [], middle: [], high: [] },
};

/**
 * 查询某学科×学段的允许书写载体列表（合并用户覆盖）。
 * 未显式定义该学科的载体规则 → 返回 null（不检测，保持正常书写）。
 */
export function getCarrierAllowlist(subject = '', stage = '') {
  const spec = getMergedSpec().WRITING_CARRIER;
  const row = spec[subject];
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
    primary_low: { linePerScore: 1.4, lineHeightMm: 9, carrier: 'blank' },
    primary_mid: { linePerScore: 1.2, lineHeightMm: 8.5, carrier: 'blank' },
    primary_high: { linePerScore: 1.0, lineHeightMm: 8, carrier: 'blank' },
    middle: { linePerScore: 0.9, lineHeightMm: 7.5, carrier: 'blank' },
    high: { linePerScore: 0.8, lineHeightMm: 7, carrier: 'blank' },
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
  return row[stage] || { linePerScore: 1, lineHeightMm: 8, carrier: 'blank' };
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

/** 作文格默认补全格数（examValidator writing-grid-fix 自动补 zuo-wen-ge 用） */
export const ZUOWEN_FILL_CELLS = 160;

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
  BRACKET_GRID, ZUOWEN_FILL_CELLS,
};

/** 合并内置 + 用户覆盖，返回完整规格对象（消费者调用此函数获取最新值） */
export function getMergedSpec() {
  const user = loadLayoutSpecOverride();
  return {
    ZUOWEN_CELL: mergeDeep(ZUOWEN_CELL, user.ZUOWEN_CELL),
    ZUOWEN_MARK_STEP: { ...ZUOWEN_MARK_STEP, ...(user.ZUOWEN_MARK_STEP || {}) },
    ZUOWEN_DEFAULT_SPAN: user.ZUOWEN_DEFAULT_SPAN ?? ZUOWEN_DEFAULT_SPAN,
    BLANK: { ...BLANK, ...(user.BLANK || {}) },
    WRITING_CARRIER: mergeDeep(WRITING_CARRIER, user.WRITING_CARRIER),
    CARRIER_RULES: mergeDeep(CARRIER_RULES, user.CARRIER_RULES),
    ANSWER_REGION: mergeDeep(ANSWER_REGION, user.ANSWER_REGION),
    SQUARE_GRID: mergeDeep(SQUARE_GRID, user.SQUARE_GRID),
    BRACKET_GRID: { ...BRACKET_GRID, ...(user.BRACKET_GRID || {}) },
    ZUOWEN_FILL_CELLS: user.ZUOWEN_FILL_CELLS ?? ZUOWEN_FILL_CELLS,
  };
}

export default {
  ZUOWEN_CELL, ZUOWEN_MARK_STEP, ZUOWEN_DEFAULT_SPAN, BLANK, WRITING_CARRIER, CARRIER_RULES, ANSWER_REGION, SQUARE_GRID,
  BRACKET_GRID, ZUOWEN_FILL_CELLS,
  LAYOUT_SPEC_DEFAULTS,
  loadLayoutSpecOverride, saveLayoutSpecOverride, resetLayoutSpecOverride, getMergedSpec, getCarrierAllowlist,
  getAnswerRegion,
};