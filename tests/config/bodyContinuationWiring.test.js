/**
 * 正文截断 / 续写链 · 源码接线守卫
 * ============================================================
 * 背景（2026-09-24 · 真实云端模型实证）：知识总结单次输出 13555 字符
 *   ÷ CHARS_PER_TOKEN(1.3) = 10427 token > 硬顶 8532 → 旧逻辑"余额 ≤ 0 → 返回 0 → break"
 *   把续写链**一轮都没跑**就锁死了（日志："经 0 次续写（预算 2844 token）仍未完整"），
 *   只剩"升级预算整卷重跑"一条路（更贵、更慢、还可能撞新坑）。
 *
 * 这段逻辑藏在 `_runPaperOrder` 的大闭包里，纯函数单测覆盖不到接线，故用源码守卫锁住三件事：
 *   ① 首轮保底：续写预算必须传 `guaranteedRounds` —— 硬顶里"多留的 1 轮余量"必须花得出去；
 *   ② 轮次回传：必须把已用轮数（`roundsUsed`）传进去 —— 否则保底会被无限重复消费（防失控失效）；
 *   ③ 升级预算重试：续写额度必须**跟着一起升级**（`attemptQuota`）——
 *      此前只放大了单次帽，第 2 次尝试的硬顶与第 1 次完全相同，"升级"名不副实（照样锁死）。
 * 谁把这些改回去，这里立刻红。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const src = fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');

describe('正文续写链 · 源码接线守卫', () => {
  it('① 续写预算带首轮保底（单次输出就超硬顶时也不能锁死续写链）', () => {
    expect(src, '续写预算丢了首轮保底 → 单次超硬顶即 0 轮续写（本次实证的病因）')
      .toContain('guaranteedRounds: 1');
  });

  it('② 保底必须回传已用轮数（否则每轮都能再保底 = 无界续写）', () => {
    expect(src, '保底未回传已用轮数 → 保底被无限重复消费，防失控失效')
      .toContain('roundsUsed: contCount');
  });

  it('③ 升级预算重试：续写额度跟着一起升级，而不是只放大单次帽', () => {
    expect(src, '重试未按升级后的单次帽重推额度 → 第 2 次尝试硬顶与第 1 次相同，"升级"无效')
      .toContain('const attemptQuota = planOutputQuota(');
    expect(src).toContain('Math.max(bodyEffectiveCap, attemptCap)');
  });

  it('④ 续写链全部走升级后的额度（不得残留首轮额度，否则两套口径并存）', () => {
    expect(src).toContain('const MAX_CONT = attemptQuota.rounds;');
    expect(src).toContain('hardQuota: attemptQuota.hardQuota');
    expect(src, '续写链仍在用首轮额度 bodyQuota').not.toContain('hardQuota: bodyQuota.hardQuota');
    expect(src).not.toContain('const MAX_CONT = bodyQuota.rounds;');
  });
});
