// 输出额度推导单测（A4-9 收口 · 2026-09-11 用户定"参数类全自适应"）
// 锁死：单次帽/续写轮次/总额度全部由"需求 + 引擎上限 + 成本闸门"推导，链上不留固定常量与轮次魔数。
import { describe, it, expect } from 'vitest';
import {
  planOutputQuota,
  nextContinuationBudget,
  charsToTokens,
} from '../../src/utils/outputQuota.js';

describe('planOutputQuota：单次帽 / 轮次 / 总额度 全推导', () => {
  it('单次帽 = min(引擎上限, 类型槽帽, 需求×缓冲)', () => {
    // 槽帽更紧
    expect(planOutputQuota({ needTokens: 100000, safetyBuffer: 1, perCallCap: 24000, engineCeiling: 131072 }).perCall).toBe(24000);
    // 引擎闸门更紧（需求 10 万 < 闸门 128K → 由需求定帽）
    expect(planOutputQuota({ needTokens: 100000, safetyBuffer: 1, perCallCap: 999999, engineCeiling: 131072 }).perCall).toBe(100000);
    // 需求超闸门 → 由闸门定帽
    expect(planOutputQuota({ needTokens: 200000, safetyBuffer: 1, perCallCap: 999999, engineCeiling: 131072 }).perCall).toBe(131072);
    // 需求更小
    expect(planOutputQuota({ needTokens: 9000, safetyBuffer: 1, perCallCap: 24000, engineCeiling: 131072 }).perCall).toBe(9000);
  });

  it('需求×安全缓冲参与推导（1.25 缓冲后取帽）', () => {
    const q = planOutputQuota({ needTokens: 8000, safetyBuffer: 1.25, perCallCap: 999999, engineCeiling: 131072 });
    expect(q.need).toBe(10000);
    expect(q.perCall).toBe(10000);
  });

  it('轮次由"需求 ÷ 单次帽"推导，不再写死 6；且至少留 1 轮余量', () => {
    // 需求 = 3 × 帽 → 首轮之外还需 2 轮
    expect(planOutputQuota({ needTokens: 30, safetyBuffer: 1, perCallCap: 10, engineCeiling: Infinity }).rounds).toBe(2);
    // 需求 ≤ 帽（首轮就该写完）→ 仍留 1 轮余量（防"首轮恰好顶满"无续写可走）
    const q = planOutputQuota({ needTokens: 5000, safetyBuffer: 1, perCallCap: 24000, engineCeiling: 8192 });
    expect(q.perCall).toBe(5000);
    expect(q.rounds).toBe(1);
    expect(q.totalQuota).toBe(10000);
  });

  it('小输出引擎（如 chat 8K）：轮次自动变多以补齐总量（旧实现被魔数 6 卡死）', () => {
    const q = planOutputQuota({ needTokens: 100000, safetyBuffer: 1, perCallCap: 999999, engineCeiling: 8192 });
    expect(q.perCall).toBe(8192);
    expect(q.rounds).toBe(12); // ⌈100000/8192⌉ − 1 = 13 − 1
    expect(q.totalQuota).toBeGreaterThanOrEqual(100000);
    expect(q.rounds).toBeGreaterThan(6); // 显式记录：不再被 6 卡死
  });

  it('整本书场景：需求 23.8 万 token × 闸门 128K → 单次 128K + 一轮余量', () => {
    const q = planOutputQuota({ needTokens: 238000, safetyBuffer: 1, perCallCap: 999999, engineCeiling: 131072 });
    expect(q.perCall).toBe(131072);
    expect(q.rounds).toBe(1);
    expect(q.totalQuota).toBe(262144);
    expect(q.totalQuota).toBeLessThanOrEqual(131072 * 2); // 总输出有上界（成本可见）
  });

  it('异常输入安全（0/负/NaN/Infinity）', () => {
    expect(planOutputQuota({}).perCall).toBe(1);
    expect(planOutputQuota({ needTokens: -5 }).perCall).toBe(1);
    expect(planOutputQuota({ needTokens: NaN }).perCall).toBe(1);
    const inf = planOutputQuota({ needTokens: 1000, perCallCap: Infinity, engineCeiling: Infinity });
    expect(inf.need).toBe(1250);      // 默认安全缓冲 ×1.25
    expect(inf.perCall).toBe(1250);
    expect(inf.rounds).toBe(1);
  });
});

describe('nextContinuationBudget：每轮帽随已产出递减，额度用尽即停', () => {
  it('首轮续写给满单次帽', () => {
    expect(nextContinuationBudget({ totalQuota: 30000, producedChars: 0, perCall: 10000 })).toBe(10000);
  });

  it('随已产出递减（不再每轮都给满——那是总额失控的根源）', () => {
    const produced = 20000; // 字
    const producedTok = charsToTokens(produced);
    const b = nextContinuationBudget({ totalQuota: 30000, producedChars: produced, perCall: 10000 });
    expect(b).toBeLessThanOrEqual(30000 - producedTok);
    expect(b).toBe(30000 - producedTok > 10000 ? 10000 : 30000 - producedTok);
  });

  it('额度用尽 → 返回 0（调用方据此刻停止续写）', () => {
    expect(nextContinuationBudget({ totalQuota: 10000, producedChars: 100000, perCall: 10000 })).toBe(0);
    expect(nextContinuationBudget({ totalQuota: 0, producedChars: 0, perCall: 10000 })).toBe(0);
  });

  it('思考放大倍数作用于请求预算；不得越引擎上限', () => {
    expect(nextContinuationBudget({ totalQuota: 30000, producedChars: 0, perCall: 10000, thinkingMultiplier: 2 })).toBe(20000);
    expect(nextContinuationBudget({ totalQuota: 30000, producedChars: 0, perCall: 10000, thinkingMultiplier: 2, engineCeiling: 12000 })).toBe(12000);
  });

  it('字符→token 口径与预算解析一致（CHARS_PER_TOKEN=1.3）', () => {
    expect(charsToTokens(1300)).toBe(1000);
    expect(charsToTokens(0)).toBe(0);
    expect(charsToTokens(-10)).toBe(0);
  });
});
