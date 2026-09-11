// 输出额度推导（A4-9 收口 · 2026-09-11 用户定：参数类全自适应，不写死）
//
// 背景：此前"单次输出帽"由固定常量（原 MAIN_TOKEN_CEIL=98304 / 偏好层 64K）封顶，
//       续写轮次另有一个魔数（MAX_CONT = min(6, engineSteps+1)）；两者其实是同一个旋钮
//       拆成的两个数字，且都会直接影响"总输出"（= 总成本）。
//
// 现改为**全推导**：
//   · 单次帽   perCall  = min(引擎物理上限, 该类型槽帽, 需求×安全缓冲)   ← 不再有固定值
//   · 续写轮次 rounds   = ⌈需求 ÷ 单次帽⌉ − 1，且至少 1 轮余量          ← 不再写死 6
//   · 总输出额度 totalQuota = perCall × (1 + rounds)                     ← 成本可见的唯一总闸门
//   · 每轮帽   按"总额度 − 已产出"递减（不再是每轮都给满，那才是总额失控的真正来源）
//
// 唯一保留的"可调值"：偏好好的**成本闸门**（apiConfig.generationSettings.outputCeilingTokens，
// 用户可在设置页调整；作为引擎物理上限之下的保险丝）。它不再是散落各处的硬编码常量。
import { CHARS_PER_TOKEN } from './budgetCalibration.js';

/** 字符 → token（与预算解析同一口径，避免两套换算） */
export const charsToTokens = (chars = 0) =>
  Math.ceil(Math.max(0, Number(chars) || 0) / CHARS_PER_TOKEN);

const finiteOr = (v, fallback = Infinity) =>
  (Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback);

/**
 * 推导本次生成任务的输出额度（单次帽 / 续写轮次 / 总额度）
 * @param {object} o
 * @param {number} o.needTokens      需求估算（由"素材量 × 系数"得出，已含类型槽帽语义）
 * @param {number} o.safetyBuffer    安全缓冲倍数（默认 1.25，防 HTML 膨胀/知识展开低估）
 * @param {number} o.perCallCap      该类型槽帽（cap / 范围性升级后的帽）
 * @param {number} o.engineCeiling   引擎单次输出上限（= min(物理上限, 用户成本闸门)）
 * @param {number} o.minRounds       最少保留的续写轮次（默认 1，防"首轮恰好顶满"就无续写余量）
 * @returns {{perCall:number, rounds:number, totalQuota:number, need:number}}
 */
export const planOutputQuota = ({
  needTokens = 0,
  safetyBuffer = 1.25,
  perCallCap = Infinity,
  engineCeiling = Infinity,
  minRounds = 1,
} = {}) => {
  const buf = Number.isFinite(safetyBuffer) && safetyBuffer > 0 ? safetyBuffer : 1;
  const need = Math.max(1, Math.round((Number(needTokens) || 0) * buf));
  const ceiling = Math.min(finiteOr(engineCeiling), finiteOr(perCallCap));
  const perCall = Math.max(1, Math.min(ceiling, need));
  const roundsNeeded = Math.ceil(need / perCall) - 1;      // 首轮之外还需几轮（推导）
  const rounds = Math.max(Math.max(0, Math.floor(minRounds) || 0), roundsNeeded);
  return { perCall, rounds, totalQuota: perCall * (1 + rounds), need };
};

/**
 * 单轮续写请求预算：按"总额度 − 已产出"递减，不再每轮都给满
 * @returns {number} 请求 max_tokens（≤0 表示额度已用尽 → 应停止续写）
 */
export const nextContinuationBudget = ({
  totalQuota = 0,
  producedChars = 0,
  perCall = Infinity,
  thinkingMultiplier = 1,
  engineCeiling = Infinity,
} = {}) => {
  const remaining = Math.round(totalQuota) - charsToTokens(producedChars);
  if (remaining <= 0) return 0;
  const base = Math.min(finiteOr(perCall), remaining);
  const mult = Number.isFinite(thinkingMultiplier) && thinkingMultiplier > 0 ? thinkingMultiplier : 1;
  const budget = Math.ceil(base * mult);
  return Math.max(1, Math.min(budget, finiteOr(engineCeiling, budget)));
};
