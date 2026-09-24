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
//    ⚠️ "触硬顶"补充口径（2026-09-24）：若**首轮单次输出就超过硬顶**，硬顶不得把续写链锁死——
//      硬顶里"多留的 1 轮余量"必须花得出去，故调用方传 `guaranteedRounds: 1` 保留一轮保底续写。
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
 *
 * 🔴 2026-09-24 实证修复·首轮保底（`guaranteedRounds` / `roundsUsed`）：
 *   硬顶的本意是"预期额度 + 1 轮余量"（见上方 `hardQuota = softQuota + perCall`），
 *   但"余量轮"此前是**纯按 token 余额**判断的 —— 只要模型**单次输出**就超过硬顶，
 *   第一次续写的余额即为负 → 直接返回 0 → 续写链一轮都没跑就被锁死，
 *   那"多留的 1 轮余量"永远花不出去，只剩"升级预算整卷重跑"一条路（更贵、更慢、还可能撞新坑）。
 *   实证（2026-09-24 真实云端模型·知识总结）：单次产出 13555 字符
 *   ÷ CHARS_PER_TOKEN(1.3) = 10427 token > 硬顶 8532 → 日志"经 0 次续写…仍未完整"。
 *   故：余额为负时仍允许消费 `guaranteedRounds` 轮**保底续写**（每轮帽 = min(单次帽, 引擎闸门)），
 *   总支出依然有界（≤ 首轮实际产出 + guaranteedRounds × 单次帽），不破坏"防失控"。
 *   默认 `guaranteedRounds = 0` = 旧行为（不改变其它调用方的语义）。
 *
 * @param {object} o
 * @param {number} [o.guaranteedRounds] 余额为负时仍保底的续写轮数（默认 0）
 * @param {number} [o.roundsUsed]       本次已用掉的续写轮数（判断保底是否用尽）
 * @returns {number} 请求 max_tokens（≤0 表示触硬顶且无保底轮 → 应停止续写）
 */
export const nextContinuationBudget = ({
  hardQuota = 0,
  producedChars = 0,
  perCall = Infinity,
  thinkingMultiplier = 1,
  engineCeiling = Infinity,
  guaranteedRounds = 0,
  roundsUsed = 0,
} = {}) => {
  const mult = Number.isFinite(thinkingMultiplier) && thinkingMultiplier > 0 ? thinkingMultiplier : 1;
  const bounded = (tokens) => {
    const t = Math.ceil(tokens);
    return Math.max(1, Math.min(t, finiteOr(engineCeiling, t)));
  };
  const remaining = Math.round(hardQuota) - charsToTokens(producedChars);
  if (remaining <= 0) {
    // 余额已尽：仅当仍有保底轮可用时给满一轮（受"单次帽 + 引擎闸门"双重钳制）
    const used = Math.max(0, Math.floor(roundsUsed) || 0);
    const floor = Math.max(0, Math.floor(guaranteedRounds) || 0);
    if (used >= floor) return 0;
    return bounded(Math.min(finiteOr(perCall), finiteOr(engineCeiling, perCall)) * mult);
  }
  const base = Math.min(finiteOr(perCall), remaining);
  return bounded(base * mult);
};

/** 是否已超**预期**额度（用于"超支可见"的告警；不用于停止） */
export const isOverQuota = ({ quota = 0, producedChars = 0 } = {}) =>
  charsToTokens(producedChars) > Math.round(quota);
