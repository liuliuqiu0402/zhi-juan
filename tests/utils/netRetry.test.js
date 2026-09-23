import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { decideFetchRetry, FAST_FAIL_MS } from '@/utils/netRetry.js';

/**
 * 云同步的重试判据（2026-09 用户实证回归）
 * ------------------------------------------------------------
 * 用户实测：控制台被 `GET … net::ERR_CONNECTION_RESET` + `⚠️ 网络瞬时故障，Ns 后重试 (n/3)` 刷屏。
 * 根因：原先对**所有**网络类异常一律重试 3 次。而"链路层被重置"这种**立刻失败**重试没有修复价值，
 * 只会连发 4 次请求 + 连打日志；真正需要重试的是**冷启动**（很慢才失败/超时）。
 */

describe('decideFetchRetry：只对"冷启动型失败"重试', () => {
  const net = (over = {}) => ({
    name: 'TypeError', message: 'Failed to fetch', elapsedMs: 5000, attempt: 0, maxRetries: 3, ...over,
  });

  it('🔴 链路层立刻失败（连接被重置/拒绝）→ 不重试（重试只会刷屏，且不会因此变通）', () => {
    expect(decideFetchRetry(net({ elapsedMs: 20 })).retry).toBe(false);
    expect(decideFetchRetry(net({ elapsedMs: FAST_FAIL_MS - 1 })).reason).toContain('fast-fail');
    // 底层原因被写进 message 的情形也要兜住
    expect(decideFetchRetry(net({ elapsedMs: 30, message: 'net::ERR_CONNECTION_RESET' })).retry).toBe(false);
    expect(decideFetchRetry(net({ elapsedMs: 30, message: 'net::ERR_CONNECTION_REFUSED' })).retry).toBe(false);
  });

  it('🔴 超时（冷启动特征：很慢才失败）→ 重试', () => {
    expect(decideFetchRetry({
      name: 'TimeoutError', message: 'Timeout after 240s', elapsedMs: 240000, attempt: 0, maxRetries: 3,
    }).retry).toBe(true);
    expect(decideFetchRetry(net({ elapsedMs: 9000 })).retry, '慢失败的网络错仍值得重试').toBe(true);
  });

  it('次数用尽 → 不再重试', () => {
    const r = decideFetchRetry(net({ elapsedMs: 9000, attempt: 3, maxRetries: 3 }));
    expect(r.retry).toBe(false);
    expect(r.reason).toBe('attempts-exhausted');
  });

  it('非网络类错误 → 不重试（别用重试掩盖真实错误）', () => {
    expect(decideFetchRetry({ name: 'Error', message: 'JSON parse error', elapsedMs: 5000, attempt: 0, maxRetries: 3 }).retry).toBe(false);
  });

  it('不传参不抛（默认即可用）', () => {
    expect(decideFetchRetry()).toEqual({ retry: false, reason: 'not-network' });
  });
});

describe('cloudStorage 必须复用这份判据', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/utils/cloudStorage.ts'), 'utf8');

  it('引入 decideFetchRetry，不再内联一套重试条件', () => {
    expect(src).toMatch(/import \{ decideFetchRetry \}/);
    expect(src).toMatch(/decideFetchRetry\(\{/);
    expect(src, '重试判据不得再内联回来').not.toMatch(/const isNetErr = e\?\.name/);
  });

  it('🔴 重试日志必须节流（失败时一次故障只提示一次，否则会把 500 条环形缓冲刷满）', () => {
    expect(src).toMatch(/warnThrottled/);
    expect(src).toMatch(/RETRY_WARN_THROTTLE_MS/);
  });

  it('🔴 设备列表不得在"探测失败"后反复自动重探（列表为空 ≠ 没探测过）', () => {
    expect(src).toMatch(/_lastProbeAt/);
    expect(src).toMatch(/!_lastProbeAt/);
  });
});
