/**
 * 续写链（**唯一实现**）
 * ============================================================
 * 为什么有这个文件（2026-09-24 用户裁定："三个问题都要根本解决，不接受打补丁"）：
 *   本项目此前有**两套**续写实现，各自演化、各有缺口：
 *     · callAI 内置（薄）：两条引擎分支（Ollama / OpenAI 兼容）**各一份**，单次续写、
 *       第三份内联去重副本、**不检测续写自身是否又被截断**，且返回的 finishReason 仍是首轮的
 *       → 调用方（答案页等）根本看不出拿到的是半截 → 静默交付。
 *     · `_runPaperOrder` 正文链（厚）：额度化、两层额度、轮次由硬顶推导、二次截断可检测、拼接去重
 *       → 同一个"被截断"，正文能补齐、答案页却半截放行。
 *
 *   现收敛为**一条链 + 策略回调**：链条只负责"截断检测 → 循环 → 去重追加 → 再检测 → 如实报停止原因"，
 *   策略（几轮、每轮帽多少、这一轮请求怎么发、要不要逐段清洗）全部由调用方注入。
 *
 * 🔴 合二为一后必须仍成立的不变量（本文件是它们的唯一守卫处）：
 *   ① **只追加，不覆盖**：续写段经去重后为空（纯重复）→ 不追加，也不空转；
 *   ② **每轮都对续写段自身再判截断**（旧薄层缺这条，才导致"续写又截断 = 半截被当完整"）；
 *   ③ **停止原因可区分**：done（真写完）/ budget（额度尽）/ rounds（轮数尽）/ invalid（续写无效）；
 *   ④ **最终 finishReason 如实反映最后一次产出**，调用方据此判定"是否仍不完整"，不再猜。
 * ============================================================
 */
import { GEN_CONST } from '../config/generationConstants.js';

/**
 * 截断判定：finish_reason=length/reasoning_capped（可靠）或尾部非完整句段（启发式兜底）。
 * @returns {{truncated:boolean, byReason:boolean}}
 */
export const detectTruncation = (content, finishReason = '') => {
  const c = String(content || '');
  const byReason = (finishReason === 'length' || finishReason === 'reasoning_capped') && c.length > 200;
  if (byReason) return { truncated: true, byReason: true };
  if (c.length <= GEN_CONST.BODY_TRUNCATED_HEURISTIC) return { truncated: false, byReason: false };
  const tail = c.slice(-GEN_CONST.TRUNCATED_TAIL_SAMPLE);
  return {
    truncated: !/<\/[a-z]+>$/i.test(tail) && !/[。！？；」』）)\n]$/.test(tail.trim()),
    byReason: false,
  };
};

/**
 * 续写**段**是否仍被截断：引擎自报（length / reasoning_capped）优先，且**不加长度门限**——
 * 续写段常常只有百来字，套 `detectTruncation` 的 >200 字门限会漏判"又截断了"（旧薄层的静默半截根因）。
 */
export const isChunkTruncated = (chunk, finishReason = '') => {
  if (finishReason === 'length' || finishReason === 'reasoning_capped') return String(chunk || '').length > 0;
  return detectTruncation(chunk, '').truncated;
};

/**
 * 续写拼接（**唯一实现**）：续写段与已有内容的拼接统一走此函数——
 * 模型续写常从上一段末尾重述（或整段重发），直接拼接会重复：先按「精确末尾 N 字 → 渐进重叠 15→3 字」
 * 去重；去重后为空（纯重复段）则不追加。**绝不用续写段覆盖已有内容**。
 *
 * @param {object} [opts]
 * @param {boolean} [opts.newlineFallback] 无重叠时是否再从换行处取内容（模型"另起一段重写"形态）。
 *   ⚠️ 两种口径原本就存在且各有理由，故作为**策略开关**保留、不合并成一种：
 *   · 薄层（callAI 内联旧实现）用 true —— 短续写常见"先复述一句再往下写"；
 *   · 正文链（`_runPaperOrder`）用 false —— 正文段长，首行也可能是真内容，丢弃首行有丢字风险。
 * @returns {string} 拼接后的内容（未产生有效增量时原样返回 base）
 */
export const appendContinuationWithDedup = (base, cont, { newlineFallback = false } = {}) => {
  const b = String(base || '');
  const tail = b.slice(-GEN_CONST.DEDUP_TAIL_EXACT);
  let clean = String(cont || '').trimStart();
  let overlapped = false;
  if (tail && clean.startsWith(tail)) {
    clean = clean.slice(tail.length);
    overlapped = true;
  } else {
    for (let ol = GEN_CONST.DEDUP_OVERLAP_MAX; ol >= GEN_CONST.DEDUP_OVERLAP_MIN; ol--) {
      const ov = b.slice(-ol);
      if (ov && clean.startsWith(ov)) { clean = clean.slice(ol); overlapped = true; break; }
    }
  }
  // 无重叠且续写段以换行开头（模型另起一段重写）→ 取换行后的内容（仅薄层策略开启）
  if (newlineFallback && !overlapped && clean.length > GEN_CONST.DEDUP_NEWLINE_MIN) {
    const nl = clean.indexOf('\n');
    if (nl > 0 && nl < 30) {
      const after = clean.slice(nl + 1).trim();
      if (after.length > GEN_CONST.CONT_ACCEPT_MIN_LEN) clean = after;
    }
  }
  clean = clean.trim();
  if (!clean) return b;
  return b + '\n' + clean;
};

/** 薄层续写策略：轮数上限（额度化调用方自带策略，不使用该常量） */
export const SIMPLE_CONTINUATION_MAX_ROUNDS = 2;

/**
 * 跑完一条续写链。
 *
 * @param {object} o
 * @param {string} o.content        已产出内容（链内部只追加）
 * @param {string} o.finishReason   首轮 finishReason
 * @param {(ctx:{round:number, producedChars:number}) => (number|null)} o.planRound
 *        轮数/额度策略：返回本轮 max_tokens（≤0 / 非正值 = 额度尽，停止）
 * @param {number} [o.maxRounds]    轮数上限（默认 SIMPLE_CONTINUATION_MAX_ROUNDS）
 * @param {(ctx:{round:number, budget:number, tail:string, content:string}) => Promise<{content:string, finishReason?:string}|string>} o.requestNext
 *        发一轮续写请求（引擎差异只在这里：Ollama 原生 / OpenAI 兼容 / 正文链的【续写】提示）
 * @param {(raw:string) => string} [o.cleanChunk] 逐段清洗（正文链传 normalizeBodyHtml；薄层不传）
 * @param {number} [o.minChunkLen]  续写段有效下限（正文链 100 = 防"重复收尾的碎段"；薄层 CON_REJECT_MIN_LEN）
 * @param {(ctx:{round:number,budget:number}) => void} [o.onRound] 每轮开跑前（日志/报告用）
 * @param {(ctx:{stoppedBy:string, truncated:boolean, rounds:number}) => void} [o.onStop]
 * @param {string} [o.label]       日志前缀
 * @returns {Promise<{content:string, finishReason:string, rounds:number, truncated:boolean, stoppedBy:'done'|'budget'|'rounds'|'invalid'>}>}
 */
export const runContinuationChain = async ({
  content = '',
  finishReason = '',
  planRound,
  maxRounds = SIMPLE_CONTINUATION_MAX_ROUNDS,
  requestNext,
  cleanChunk = null,
  minChunkLen = GEN_CONST.CONT_REJECT_MIN_LEN,
  newlineFallback = false,
  onRound = null,
  onStop = null,
  label = '续写',
} = {}) => {
  const roundsCap = Number.isFinite(Number(maxRounds)) ? Math.max(0, Math.floor(Number(maxRounds))) : 0;
  let cur = String(content || '');
  let reason = String(finishReason || '');
  let rounds = 0;
  let stoppedBy = 'done';
  let trunc = detectTruncation(cur, reason);

  while (trunc.truncated) {
    if (rounds >= roundsCap) { stoppedBy = 'rounds'; break; }
    const budget = typeof planRound === 'function' ? planRound({ round: rounds + 1, producedChars: cur.length }) : null;
    if (!(Number(budget) > 0)) { stoppedBy = 'budget'; break; }
    if (typeof onRound === 'function') onRound({ round: rounds + 1, budget, producedChars: cur.length });

    let out = null;
    try {
      out = await requestNext({ round: rounds + 1, budget, tail: cur.slice(-GEN_CONST.CONTINUE_TAIL_SAMPLE), content: cur });
    } catch (e) {
      // 续写请求失败 = 本链无法补齐（绝不当成功）；如实报 invalid，由调用方决定重试或判失败
      console.warn(`⚠️ ${label}第 ${rounds + 1} 轮请求失败，按未补齐处理：`, e?.message || e);
      stoppedBy = 'invalid';
      break;
    }
    rounds++;

    const raw = (out && typeof out === 'object') ? out.content : out;
    const chunkReason = (out && typeof out === 'object' && out.finishReason) ? out.finishReason : '';
    if (!raw || String(raw).length <= GEN_CONST.CONT_ACCEPT_MIN_LEN) { stoppedBy = 'invalid'; break; }
    const chunk = cleanChunk ? String(cleanChunk(String(raw)) || '') : String(raw);
    if (!chunk || chunk.trim().length < Math.max(1, Number(minChunkLen) || 1)) { stoppedBy = 'invalid'; break; }

    const merged = appendContinuationWithDedup(cur, chunk, { newlineFallback });
    if (merged === cur) { stoppedBy = 'invalid'; break; } // ② 纯重复段：不追加、不空转

    cur = merged;
    if (chunkReason) reason = chunkReason;
    trunc = { truncated: isChunkTruncated(chunk, chunkReason), byReason: !!chunkReason };
  }

  if (typeof onStop === 'function') onStop({ stoppedBy, truncated: trunc.truncated, rounds });
  return { content: cur, finishReason: reason, rounds, truncated: trunc.truncated, stoppedBy };
};

export default { detectTruncation, isChunkTruncated, appendContinuationWithDedup, runContinuationChain, SIMPLE_CONTINUATION_MAX_ROUNDS };
