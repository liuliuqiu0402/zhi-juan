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

/** 学段分组：三维度学段 → 排版学段（作文格/填空等仅区分小学[写格]·初中·高中） */
export const STAGE_GROUP = {
  primary_low: 'primary',
  primary_mid: 'primary',
  primary_high: 'primary',
  middle: 'middle',
  high: 'high',
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

/** 书写载体（田字格/方格/横线/四线三格）· 按排版学段（语文等适用段） */
export const WRITING_CARRIER = {
  primary_low: 'tian-zi-ge',   // 田字格
  primary_mid: 'tian-zi-ge',   // 田字格/方格
  primary_high: 'square',      // 方格/横线
  middle: 'line',              // 横线
  high: 'line',                // 横线
};

/** 解答题空白区（行数 = 分值 × 学段系数；行高按学段字号×间距系数）· 骨架编译器读取 */
export const ANSWER_REGION = {
  primary_low: { linePerScore: 1.4, lineHeightMm: 9 },
  primary_mid: { linePerScore: 1.2, lineHeightMm: 8.5 },
  primary_high: { linePerScore: 1.0, lineHeightMm: 8 },
  middle: { linePerScore: 0.9, lineHeightMm: 7.5 },
  high: { linePerScore: 0.8, lineHeightMm: 7 },
};

/** 方格纸 square-grid（小学段专用；初中以上无） */
export const SQUARE_GRID = {
  primary: { cols: 12, rows: 8 },
  middle: null,
  high: null,
};

export default {
  STAGE_GROUP,
  ZUOWEN_CELL,
  ZUOWEN_MARK_STEP,
  ZUOWEN_DEFAULT_SPAN,
  BLANK,
  WRITING_CARRIER,
  ANSWER_REGION,
  SQUARE_GRID,
};