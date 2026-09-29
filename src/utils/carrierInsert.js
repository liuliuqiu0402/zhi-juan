/**
 * 书写载体·手动插入的**单一事实源**（编辑器按钮用）
 *
 * 背景（2026-09-29 用户裁定）：书写载体除作文格外，也要允许**用户手动插入/替换**（形状 + 长度）。
 *   本文件只做一件事：把"某类载体的标准 HTML + 长度语义"集中成一处，供编辑器按钮调用。
 *
 * ⚠️ 形态来源（均为**取证所得**，勿凭印象改；改前先复核下列出处）：
 *   · blank-line  → `<p><span class="blank-line">　</span></p>`（examValidator 注释：p 内套 span）
 *   · blank-area  → `<p class="blank-area" style="height:Xmm">`（contentCleaner 1c-3；docxBuilder 导出侧认它）
 *   · blank-N     → `<u class="blank-N">&emsp;</u>`（N = 字位宽档位；contentCleaner.normalizeBlankMarkers）
 *   · 格类        → `<div class="X"><span>&emsp;</span>×N</div>`（examValidator.countGridCells 以 span 计格）
 *   · 空盒类      → 空格 + class（编辑器节点 squareGrid/bracketGrid/drawArea；draw-area 需保留 style 高度）
 *
 * ⚠️ 长度一律**读排版规格库**（面板可调）；本文件不复制数值口径。
 *   规格库未提供该项时的兜底值集中写在 FALLBACK（**待规格库补齐后应删除**，勿当第二口径长期存在）。
 */
import { getMergedSpec } from '../config/layoutSpec.js';

/** 规格库缺项时的兜底（仅用于手动插入的**默认值**，不参与任何自动链路） */
const FALLBACK = {
  blankLineRows: 1,      // 整行横线：默认 1 行
  blankAreaHeightMm: 8,  // 留白行：默认高度 mm
  blankWidth: 8,         // 空位档位：默认 8 字位
  gridCells: 4,          // 格类：默认 4 格
  bracketRows: 3,        // 竖式格：默认 3 行（与 bracket-grid CSS repeat(3,…) 同）
  squareCols: 12,        // 方格纸：默认列数（与 SQUARE_GRID 12列×8行 同）
  squareRows: 8,
  drawHeightMm: 40,      // 作图区：默认高度 mm
};

const span = (n) => '<span>&emsp;</span>'.repeat(Math.max(1, Math.floor(n)));

/**
 * 载体目录：id → { label, lenLabel, defaultLen(), build(len) }
 * lenLabel 说明长度参数的含义（格数 / 行数 / 高度mm / 档位），供按钮提示文案使用。
 */
export const CARRIER_INSERTS = {
  'blank-line': {
    label: '整行横线',
    lenLabel: '行数',
    defaultLen: () => FALLBACK.blankLineRows,
    build: (n) => '<p><span class="blank-line">　</span></p>'.repeat(Math.max(1, Math.floor(n))),
  },
  'blank-area': {
    label: '留白行（无线）',
    lenLabel: '高度(mm)',
    defaultLen: () => FALLBACK.blankAreaHeightMm,
    build: (n) => `<p class="blank-area" style="height:${Math.max(1, Number(n) || 0)}mm"></p>`,
  },
  'blank': {
    label: '空位（横线空位/括号空位）',
    lenLabel: '宽度档位（字位）',
    defaultLen: () => {
      const sp = getMergedSpec() || {};
      const b = sp.BLANK || {};
      const cap = Number(b.maxBlank) || FALLBACK.blankWidth;
      const lo = Number(b.minBlank) || 1;
      const def = Number(b.defaultBlank) || FALLBACK.blankWidth;
      return Math.min(cap, Math.max(lo, def));
    },
    build: (n) => {
      const sp = getMergedSpec() || {};
      const b = sp.BLANK || {};
      const cap = Number(b.maxBlank) || FALLBACK.blankWidth;
      const lo = Number(b.minBlank) || 1;
      const k = Math.min(cap, Math.max(lo, Math.floor(Number(n) || 0)));
      return `<u class="blank-${k}">&emsp;</u>`;
    },
  },
  'tian-zi-ge': { label: '田字格', lenLabel: '格数', defaultLen: () => FALLBACK.gridCells, build: (n) => `<div class="tian-zi-ge">${span(n)}</div>` },
  'mi-zi-ge': { label: '米字格', lenLabel: '格数', defaultLen: () => FALLBACK.gridCells, build: (n) => `<div class="mi-zi-ge">${span(n)}</div>` },
  'four-line-three': { label: '四线三格', lenLabel: '格数', defaultLen: () => FALLBACK.gridCells, build: (n) => `<div class="four-line-three">${span(n)}</div>` },
  'sixian-ge': { label: '六线格', lenLabel: '格数', defaultLen: () => FALLBACK.gridCells, build: (n) => `<div class="sixian-ge">${span(n)}</div>` },
  // 拼音格：**行内单格**形态（与 four-line-three/sixian-ge 共享 carrierCss 的 inline-flex 几何 --flt-h；
  //   examValidator.countGridCells 明确把 pinyin-line 排除在"div 包 span 方块格"之外 → 它是行内格）
  'pinyin-line': { label: '拼音格', lenLabel: '格数', defaultLen: () => FALLBACK.gridCells, build: (n) => '<span class="pinyin-line">&emsp;</span>'.repeat(Math.max(1, Math.floor(n))) },
  // ⚠️ english-line **故意不列入**：取证（carrierCss.js:45-47 / themeConfig.js:1536）确认它是
  //   "遗留字体修饰类"（仅设 Times 字体、**不画格线**），独立格线书写用 four-line-three/sixian-ge。
  //   列入会插出一个"看不见的载体"，故排除。
  'bracket-grid': {
    label: '竖式格',
    lenLabel: '行数',
    defaultLen: () => FALLBACK.bracketRows,
    build: (n) => {
      const rows = Math.max(1, Math.floor(Number(n) || 0));
      // 空盒载体：必须是**空 div**（编辑器节点 bracketGrid 为 atom；CSS 画 3 行，行数由内容盒决定）
      return `<div class="bracket-grid">${'<div></div>'.repeat(rows)}</div>`;
    },
  },
  'square-grid': {
    label: '方格纸（作图）',
    lenLabel: '行列（列×行）',
    defaultLen: () => FALLBACK.squareRows,
    build: (n) => `<div class="square-grid" style="--sg-cols:${FALLBACK.squareCols};--sg-rows:${Math.max(1, Math.floor(Number(n) || 0))}"></div>`,
  },
  'draw-area': {
    label: '作图区',
    lenLabel: '高度(mm)',
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
 * ⚠️ 空盒类按精确 class 匹配；blank-N 按前缀匹配（档位不同仍属同类）
 */
export function hasCarrierClass(html, id) {
  const s = String(html || '');
  if (!id) return false;
  if (id === 'blank') return /class=["'][^"']*blank-\d/.test(s);
  if (id === 'blank-line') return /class=["'][^"']*blank-line/.test(s);
  return new RegExp(`class=["'][^"']*${id.replace(/[-]/g, '\\-')}`).test(s);
}

/** 载体 id → 中文标签（按钮/提示文案用） */
export const carrierLabel = (id) => (CARRIER_INSERTS[id] || {}).label || id;
