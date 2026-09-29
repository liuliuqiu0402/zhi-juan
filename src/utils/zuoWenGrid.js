/**
 * 作文格（zuo-wen-ge）· 手动插入的**单一事实源**
 *
 * 背景（2026-09-29 用户裁定）：上传 Word / 手动改稿场景下，"补作文格"改为**用户主动点按钮**的行为
 *   （光标处插入 / 选中替换），不再接进导入流水线。此处只提供两个纯函数，供编辑器按钮调用：
 *     · zuowenCellsForStage —— 格数口径（**与 examValidator 2j-5 同一事实源**，不另立第二副本）
 *     · buildZuoWenGridHtml —— 作文格 HTML（**与渲染端/导出端认的 class 一致**）
 *
 * 格数口径（layoutSpec，非本文件定义，勿在此硬编码数值）：
 *   格数 = max( ZUOWEN_FILL_CELLS , 分值 × ZUOWEN_CELLS_PER_SCORE[学段] )
 *   - ZUOWEN_CELLS_PER_SCORE：每分格数，按学段五档（低8/中12/高16/初20/高17）
 *   - ZUOWEN_FILL_CELLS：兜底格数（低段写话不规定字数，兜底足够）
 *   手动场景通常无分值 → score 缺省 0，即取兜底格数；如需按分值给，传入 score 即可。
 *
 * 形态约束（与 contentCleaner「空格默认补全」一致）：
 *   <div class="zuo-wen-ge"><span>&emsp;</span>…</div>（每格一个 span；渲染/导出按 ZUOWEN_CELL 画格）
 *   只输出这一个形态，避免出现"同一载体两种写法"的第二个副本。
 */
import { getMergedSpec } from './specAccess';

/** 学段键归一到 layoutSpec 的五档键（只做**键名**归一，不改任何数值口径） */
const STAGE_ALIAS = {
  primary: 'primary_mid',
  小学: 'primary_mid',
  小学低段: 'primary_low',
  小学中段: 'primary_mid',
  小学高段: 'primary_high',
  初中: 'middle',
  高中: 'high',
};

export function normalizeStageKey(stage) {
  if (!stage) return '';
  const k = String(stage).trim();
  if (STAGE_ALIAS[k]) return STAGE_ALIAS[k];
  return /^(primary_low|primary_mid|primary_high|middle|high)$/.test(k) ? k : '';
}

/**
 * 作文格格数（与 2j-5 同源口径）。
 * @param {string} stageKey 学段（五档键，或 小学/初中/高中 别名）
 * @param {number} score    该题分值；手动场景无分值传 0
 * @returns {number} 格数
 */
export function zuowenCellsForStage(stageKey, score = 0) {
  const spec = getMergedSpec() || {};
  const base = Number(spec.ZUOWEN_FILL_CELLS) || 160;
  const perScore = (spec.ZUOWEN_CELLS_PER_SCORE || {})[normalizeStageKey(stageKey)] || 10;
  const byScore = Math.max(0, Number(score) || 0) * perScore;
  return Math.max(base, byScore);
}

/**
 * 作文格 HTML（光标处插入 / 选中替换用）。
 * @param {{ cells?: number }} opts
 * @returns {string} `<div class="zuo-wen-ge">…</div>`
 */
export function buildZuoWenGridHtml({ cells } = {}) {
  const n = Math.max(1, Math.floor(Number(cells) || 0));
  return `<div class="zuo-wen-ge">${'<span>&emsp;</span>'.repeat(n)}</div>`;
}

/** 该段 HTML 内是否已有作文格（防重复插入） */
export const hasZuoWenGrid = (html) => /class=["'][^"']*zuo-wen-ge/.test(String(html || ''));

/** 该段 HTML 内是否含"错形态"作答载体（横线/短答空位）——选中替换时按 B 口径换掉 */
export const hasWrongFormCarrier = (html) => /class=["'][^"']*(?:blank-line|blank-\d)/.test(String(html || ''));
