/**
 * 书写载体·手动插入的**单一事实源**（编辑器按钮用）
 *
 * 背景（2026-09-29/30 用户裁定）：
 *   · 书写载体除作文格外，允许**用户手动插入/替换**（形状 + 长度）；
 *   · 手动产物**走在生成链路之外**，不受 2j-5 系列（相邻性/插入位置）修正保护
 *     → 必须**自带正确形态**，故形态一律按取证结果写死在此处。
 *
 * ⚠️ 形态取证来源（改前先复核出处，勿凭印象改）：
 *   行内类（必须能与文字混排，**不得用 <div>**；块级会被导出按独立段落处理 → 独立行居中）：
 *     · 格类（田字格/米字格/四线三格/六线格/拼音格）：`<span class="X">&emsp;</span>` **一格一元素**
 *       — 依据 docxBuilder 现成写法 `<td><span class="tian-zi-ge">X</span></td>`；
 *         carrierCss `.four-line-three,.sixian-ge,.pinyin-line{display:inline-flex}`；
 *         规格库 GRID_CELL 给的是**单格宽**（12mm 等）
 *     · 横线空位：`<u class="blank-N">&emsp;</u>`（contentCleaner.normalizeBlankMarkers）
 *     · 括号空位：`<span class="blank-N">&emsp;</span>`（carrierCss 对 span[class*="blank-"] 用
 *       ::before/::after 自动补括号 —— 与横线空位**同 class、不同标签**，故拆成两项）
 *     · 数学填空方框：`<span class="square-box">　</span>`（carrierCss 1.8em 等边 + 边框）
 *     · 数学填空圈  ：`<span class="math-circle-blank-18">　</span>`（同上，圆形）
 *   块级类（本身就是整块作答区，独占空间，**不是**书写格）：
 *     · 整行横线：`<p><span class="blank-line">　</span></p>`
 *     · 留白行  ：`<p class="blank-area" style="height:Xmm">`
 *     · 竖式格  ：`<div class="bracket-grid">`（编辑器节点 bracketGrid，atom 空盒）
 *     · 方格纸  ：`<div class="square-grid">`（编辑器节点 squareGrid，atom 空盒）
 *     · 作图区  ：`<div class="draw-area" style="min-height:Xmm">`（编辑器节点 drawArea，style 必须保留）
 *
 * ⚠️ 未列入（**证据不足，暂不给按钮**；列入会造出"预览有、导出丢"的载体）：
 *     · oral-box（口语交际框）：预览有（carrierCss/global.css），**导出侧分支未取证**；
 *     · match-question/match-item（连线题）：结构较复杂（两列 + 项 + 引导线），需专门取证。
 *
 * ⚠️ 长度一律**读排版规格库**（面板可调），本文件不复制数值口径；
 *    规格库未提供该项时的兜底值集中在 FALLBACK（**待规格库补齐后应删除**）。
 */
import { getMergedSpec } from '../config/layoutSpec.js';

/** 规格库缺项时的兜底（仅用于手动插入的**默认值**，不参与任何自动链路） */
const FALLBACK = {
  blankLineRows: 1,      // 整行横线：默认 1 行
  blankAreaHeightMm: 8,  // 留白行：默认高度 mm
  blankWidth: 8,         // 空位档位：默认 8 字位
  gridCells: 4,          // 格类：默认 4 格
  boxCount: 1,           // 数学方框/圆圈：默认 1 个
  bracketRows: 3,        // 竖式格：默认 3 行（与 bracket-grid CSS repeat(3,…) 同）
  squareCols: 12,        // 方格纸：默认列数（与 SQUARE_GRID 12列×8行 同）
  squareRows: 8,
  drawHeightMm: 40,      // 作图区：默认高度 mm
};

const repeat = (frag, n) => frag.repeat(Math.max(1, Math.floor(Number(n) || 1)));
/** 行内格：一格一 span（与导出端行内单格一致） */
const inlineCells = (cls, n) => repeat(`<span class="${cls}">&emsp;</span>`, n);

/** 空位档位：受规格库 BLANK 上下限约束（与导出/预览同源，防"预览宽、导出窄"） */
const blankWidth = (n) => {
  const b = (getMergedSpec() || {}).BLANK || {};
  const cap = Number(b.maxBlank) || FALLBACK.blankWidth;
  const lo = Number(b.minBlank) || 1;
  return Math.min(cap, Math.max(lo, Math.floor(Number(n) || 0)));
};

/**
 * 载体目录：id → { label, lenLabel, inline, defaultLen(), build(len) }
 * inline=true 表示行内载体（可混排）；false 为块级作答区。
 */
export const CARRIER_INSERTS = {
  'blank-line': {
    label: '整行横线', lenLabel: '行数', inline: false,
    defaultLen: () => FALLBACK.blankLineRows,
    build: (n) => repeat('<p><span class="blank-line">　</span></p>', n),
  },
  'blank-area': {
    label: '留白行（无线）', lenLabel: '高度(mm)', inline: false,
    defaultLen: () => FALLBACK.blankAreaHeightMm,
    build: (n) => `<p class="blank-area" style="height:${Math.max(1, Number(n) || 0)}mm"></p>`,
  },
  'blank-underline': {
    label: '横线空位（下划线）', lenLabel: '宽度档位（字位）', inline: true,
    defaultLen: () => (getMergedSpec().BLANK || {}).defaultBlank || FALLBACK.blankWidth,
    build: (n) => `<u class="blank-${blankWidth(n)}">&emsp;</u>`,
  },
  'blank-paren': {
    label: '括号空位（　）', lenLabel: '宽度档位（字位）', inline: true,
    defaultLen: () => (getMergedSpec().BLANK || {}).defaultBlank || FALLBACK.blankWidth,
    build: (n) => `<span class="blank-${blankWidth(n)}">&emsp;</span>`,
  },
  'tian-zi-ge': { label: '田字格', lenLabel: '格数', inline: true, defaultLen: () => FALLBACK.gridCells, build: (n) => inlineCells('tian-zi-ge', n) },
  'mi-zi-ge': { label: '米字格', lenLabel: '格数', inline: true, defaultLen: () => FALLBACK.gridCells, build: (n) => inlineCells('mi-zi-ge', n) },
  'four-line-three': { label: '四线三格', lenLabel: '格数', inline: true, defaultLen: () => FALLBACK.gridCells, build: (n) => inlineCells('four-line-three', n) },
  'sixian-ge': { label: '六线格', lenLabel: '格数', inline: true, defaultLen: () => FALLBACK.gridCells, build: (n) => inlineCells('sixian-ge', n) },
  'pinyin-line': { label: '拼音格', lenLabel: '格数', inline: true, defaultLen: () => FALLBACK.gridCells, build: (n) => inlineCells('pinyin-line', n) },
  'square-box': {
    label: '数学填空方框', lenLabel: '个数', inline: true,
    defaultLen: () => FALLBACK.boxCount,
    build: (n) => repeat('<span class="square-box">　</span>', n),
  },
  'math-circle-blank': {
    label: '数学填空圈', lenLabel: '个数', inline: true,
    defaultLen: () => FALLBACK.boxCount,
    build: (n) => repeat('<span class="math-circle-blank-18">　</span>', n),
  },
  // 口语交际/回答框：行内（carrierCss/global.css `display:inline-block; border; min-width:3em`）；
  //   导出侧有分支（docxBuilder: contains('oral-box') || contains('score-box')）——2026-09-30 取证确认
  'oral-box': {
    label: '口语交际框', lenLabel: '个数', inline: true,
    defaultLen: () => FALLBACK.boxCount,
    build: (n) => repeat('<span class="oral-box">&emsp;</span>', n),
  },
  'bracket-grid': {
    label: '竖式格', lenLabel: '行数', inline: false,
    defaultLen: () => FALLBACK.bracketRows,
    build: (n) => `<div class="bracket-grid">${repeat('<div></div>', n)}</div>`,
  },
  'square-grid': {
    label: '方格纸（作图）', lenLabel: '行列（列×行）', inline: false,
    defaultLen: () => FALLBACK.squareRows,
    build: (n) => `<div class="square-grid" style="--sg-cols:${FALLBACK.squareCols};--sg-rows:${Math.max(1, Math.floor(Number(n) || 0))}"></div>`,
  },
  'draw-area': {
    label: '作图区', lenLabel: '高度(mm)', inline: false,
    defaultLen: () => FALLBACK.drawHeightMm,
    build: (n) => `<div class="draw-area" style="min-height:${Math.max(1, Number(n) || 0)}mm"></div>`,
  },
};

/** 载体 id 列表（按面板展示顺序） */
export const CARRIER_INSERT_IDS = Object.keys(CARRIER_INSERTS);

/** 生成插入 HTML */
export function buildCarrierHtml(id, len) {
  const d = CARRIER_INSERTS[id];
  if (!d) return '';
  return d.build(len != null ? len : d.defaultLen());
}

/**
 * 该 HTML 内是否已含**同类**载体（防重复插入 / 同类择一判定用）
 * ⚠️ 空位类按 blank-N 前缀匹配（档位不同仍属同类；横线空位/括号空位同 class，
 *    故按标签区分：横线空位 = u.blank-N，括号空位 = span.blank-N）
 */
export function hasCarrierClass(html, id) {
  const s = String(html || '');
  if (!id) return false;
  if (id === 'blank-underline') return /<u[^>]*class=["'][^"']*blank-\d/.test(s);
  if (id === 'blank-paren') return /<span[^>]*class=["'][^"']*blank-\d/.test(s);
  if (id === 'blank-line') return /class=["'][^"']*blank-line/.test(s);
  if (id === 'math-circle-blank') return /class=["'][^"']*math-circle-blank/.test(s);
  return new RegExp(`class=["'][^"']*${id.replace(/[-]/g, '\\-')}`).test(s);
}

/** 载体 id → 中文标签（按钮/提示文案用） */
export const carrierLabel = (id) => (CARRIER_INSERTS[id] || {}).label || id;
