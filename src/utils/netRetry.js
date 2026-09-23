/**
 * 网络抓取的重试判据（纯函数，可单测）
 * ============================================================
 * 🔴 为什么必须区分两类失败（2026-09 用户实证）：原先对**所有**网络类异常一律重试 3 次。
 *    在"链路层被重置/拒绝"（`net::ERR_CONNECTION_RESET`）时会连发 4 次请求 + 连打 3 行重试日志，
 *    控制台看着就是"一直在刷屏"。而这两类失败的处置**完全不同**：
 *      · **链路不通**（立刻失败：连接被重置 / 拒绝 / DNS 失败）→ 重试毫无修复价值，只是刷屏，
 *        应当尽快放弃并把结论一次性告诉用户；
 *      · **冷启动**（很慢才失败 / 超时）→ 正是重试能救的场景
 *        （Supabase 免费实例休眠后首查可达 30-120s，重试时实例已热 ≈ 秒级返回）。
 *    判据就用"失败得快不快"：秒级失败 = 链路层；超时才失败 = 冷启动。
 * ============================================================
 */

/** 低于此耗时的失败视为"链路层立刻失败"（连接被重置/拒绝/DNS 失败），重试无意义 */
export const FAST_FAIL_MS = 1500;

/** 网络类错误的消息特征（各家运行时/代理的措辞都在这里兜住） */
export const RETRYABLE_NET_RE = /fetch failed|quic|network|etimedout|econnreset|econnrefused|enotfound|ehostunreach|enetunreach|abort|timeout/i;

/**
 * 判断这次失败是否值得重试。
 * @param {{name?: string, message?: string, elapsedMs?: number, attempt?: number, maxRetries?: number}} p
 *   `attempt` 从 0 开始（0 = 第一次尝试刚失败）
 * @returns {{retry: boolean, reason: string}} reason 仅用于日志/测试可读性
 */
export const decideFetchRetry = ({ name = '', message = '', elapsedMs = 0, attempt = 0, maxRetries = 3 } = {}) => {
  if (attempt >= maxRetries) return { retry: false, reason: 'attempts-exhausted' };

  const isTimeout = name === 'TimeoutError' || name === 'AbortError' || /timeout/i.test(message);
  if (isTimeout) return { retry: true, reason: 'timeout（冷启动特征，值得重试）' };

  const isNet = name === 'TypeError' || RETRYABLE_NET_RE.test(message);
  if (!isNet) return { retry: false, reason: 'not-network' };

  // 🔴 链路层立刻失败：重试只会刷屏，且不会因为多试几次就通
  if (elapsedMs < FAST_FAIL_MS) return { retry: false, reason: 'fast-fail（链路层，重试无意义）' };

  return { retry: true, reason: 'net-error' };
};

export default { decideFetchRetry, FAST_FAIL_MS, RETRYABLE_NET_RE };
