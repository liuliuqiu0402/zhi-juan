// 输出额度推导（A4-9 收口 · 2026-09-11 用户定：参数类全自适应，不写死）
//
// 背景：此前"单次输出帽"由固定常量封顶，续写轮次另有一个魔数（MAX_CONT = min(6, engineSteps+1)）；
//       两者其实是同一个旋钮拆成的两个数字，且都会直接影响"总输出"（= 总成本）。
//
// 现改为**全推导 + 两层额度**（2026-09-11 用户定"先保完整、再防失控"）：
//   · 单次帽   perCall  = min(引擎闸门, 类型槽帽, 需求×安全缓冲)          ← 不再有固定值
//   · 预期额度 softQuota = perCall × (1 + ⌈需求÷perCall⌉−1)              ← 期望产出量
//   · 硬顶     hardQuota = softQuota + perCall                          ← 唯一叫停线（多留 1 轮余量）
//   · 每轮帽   = min(单次帽, 硬顶 − 已产出) × 思考放大                    ← 随已产出递减
//
// 🔴 停止条件只有三个：① 写完了（不再截断）② 续写无效（重复/过短）③ 触硬顶。
//    **超预期额度只报警、不停止**——完整性优先，超支在生成报告里可见（用户定）。
//
// 唯一保留的"可调值"：偏好层的**成本闸门**（apiConfig.generationSettings.outputCeilingTokens，
// 设置页可调）。它不是散落在链上的常量，`max_tokens` 也只是"允许量"而非"目标量"，给宽不花钱。
import { CHARS_PER_TOKEN } from './budgetCalibration.js';

/** 字符 → token（与预算解析同一口径，避免两套换算） */
export const charsToTokens = (chars = 0) =>
  Math.ceil(Math.max(0, Number(chars) || 0) / CHARS_PER_TOKEN);

const finiteOr = (v, fallback = Infinity) =>
  (Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback);

/**
 * 推导本次生成任务的输出额度
 * @param {object} o
 * @param {number} o.needTokens      需求估算（由"素材量 × 系数"得出）
 * @param {number} o.safetyBuffer    安全缓冲倍数（默认 1.25，防 HTML 膨胀/知识展开低估）
 * @param {number} o.perCallCap      该类型槽帽（cap / 范围性升级后的帽）
 * @param {number} o.engineCeiling   引擎闸门（= min(物理上限, 用户成本闸门)）
 * @param {number} o.minRounds       最少保留的续写轮次（默认 1，防"首轮恰好顶满"无续写余量）
 * @returns {{perCall:number, rounds:number, softQuota:number, hardQuota:number, need:number}}
 *   rounds = 由**硬顶**推导的续写轮次上界（含留白轮）
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
  const roundsNeeded = Math.ceil(need / perCall) - 1;                    // 首轮之外还需几轮（推导）
  const roundsSoft = Math.max(Math.max(0, Math.floor(minRounds) || 0), roundsNeeded);
  const softQuota = perCall * (1 + roundsSoft);                          // 预期额度
  const hardQuota = softQuota + perCall;                                 // 硬顶 = 预期 + 1 轮余量
  const rounds = Math.max(1, Math.ceil(hardQuota / perCall) - 1);         // 由硬顶推导的轮次上界
  return { perCall, rounds, softQuota, hardQuota, need };
};

/**
 * 单轮续写请求预算：按"**硬顶** − 已产出"递减（超预期不停止，触硬顶才停）
 * @returns {number} 请求 max_tokens（≤0 表示触硬顶 → 应停止续写）
 */
export const nextContinuationBudget = ({
  hardQuota = 0,
  producedChars = 0,
  perCall = Infinity,
  thinkingMultiplier = 1,
  engineCeiling = Infinity,
} = {}) => {
  const remaining = Math.round(hardQuota) - charsToTokens(producedChars);
  if (remaining <= 0) return 0;
  const base = Math.min(finiteOr(perCall), remaining);
  const mult = Number.isFinite(thinkingMultiplier) && thinkingMultiplier > 0 ? thinkingMultiplier : 1;
  const budget = Math.ceil(base * mult);
  return Math.max(1, Math.min(budget, finiteOr(engineCeiling, budget)));
};

/** 是否已超**预期**额度（用于"超支可见"的告警；不用于停止） */
export const isOverQuota = ({ quota = 0, producedChars = 0 } = {}) =>
  charsToTokens(producedChars) > Math.round(quota);
