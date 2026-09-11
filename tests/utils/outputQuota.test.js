// 输出额度推导单测（A4-9 收口 · 2026-09-11 用户定"参数类全自适应 + 先保完整再防失控"）
// 锁死：单次帽/预期额度/硬顶/轮次全部由"需求 + 引擎闸门 + 槽帽"推导，链上不留固定常量与轮次魔数；
//       且**超预期只报警不停止**，只有"写完 / 续写无效 / 触硬顶"三种停止条件。
import { describe, it, expect } from 'vitest';
import {
  planOutputQuota,
  nextContinuationBudget,
  isOverQuota,
  charsToTokens,
} from '../../src/utils/outputQuota.js';

const GATE = 196608; // 引擎闸门（192K，2026-09-11 用户裁定默认）

describe('planOutputQuota：单次帽 / 预期额度 / 硬顶 全推导', () => {
  it('单次帽 = min(引擎闸门, 类型槽帽, 需求×缓冲)', () => {
    // 槽帽更紧
    expect(planOutputQuota({ needTokens: 100000, safetyBuffer: 1, perCallCap: 24000, engineCeiling: GATE }).perCall).toBe(24000);
    // 需求 10 万 < 闸门 192K → 由需求定帽
    expect(planOutputQuota({ needTokens: 100000, safetyBuffer: 1, perCallCap: 999999, engineCeiling: GATE }).perCall).toBe(100000);
    // 需求超闸门 → 由闸门定帽
    expect(planOutputQuota({ needTokens: 500000, safetyBuffer: 1, perCallCap: 999999, engineCeiling: GATE }).perCall).toBe(GATE);
    // 需求更小
    expect(planOutputQuota({ needTokens: 9000, safetyBuffer: 1, perCallCap: 24000, engineCeiling: GATE }).perCall).toBe(9000);
  });

  it('需求×安全缓冲参与推导（1.25 缓冲后取帽）', () => {
    const q = planOutputQuota({ needTokens: 8000, safetyBuffer: 1.25, perCallCap: 999999, engineCeiling: GATE });
    expect(q.need).toBe(10000);
    expect(q.perCall).toBe(10000);
  });

  it('硬顶 = 预期 + 1 轮；预期 = 单次帽 ×(1+所需轮次)（不再写死 6）', () => {
    // 需求 = 5 × 槽帽 → 预期 5 轮，硬顶多留 1 轮
    const q = planOutputQuota({ needTokens: 100000, safetyBuffer: 1, perCallCap: 24000, engineCeiling: GATE });
    expect(q.perCall).toBe(24000);
    expect(q.softQuota).toBe(24000 * 5);   // 需求 10 万 ÷ 2.4 万 → 5 轮
    expect(q.hardQuota).toBe(24000 * 6);   // 硬顶 = 预期 + 1 轮
    expect(q.rounds).toBe(5);              // ⌈硬顶÷帽⌉−1 = 6−1
  });

  it('需求 ≤ 单次帽（首轮就该写完）→ 仍留 1 轮余量，硬顶为 2 轮', () => {
    const q = planOutputQuota({ needTokens: 9000, safetyBuffer: 1, perCallCap: 24000, engineCeiling: GATE });
    expect(q.perCall).toBe(9000);
    expect(q.softQuota).toBe(18000);
    expect(q.hardQuota).toBe(27000);
    expect(q.rounds).toBe(2);
  });

  it('小输出引擎（chat 8K）：轮次自动变多以补齐总量（旧实现被魔数 6 卡死）', () => {
    const q = planOutputQuota({ needTokens: 100000, safetyBuffer: 1, perCallCap: 999999, engineCeiling: 8192 });
    expect(q.perCall).toBe(8192);
    expect(q.softQuota).toBeGreaterThanOrEqual(100000);
    expect(q.rounds).toBe(13);            // ⌈114688÷8192⌉−1
    expect(q.rounds).toBeGreaterThan(6);  // 显式记录：不再被 6 卡死
  });

  it('整本书场景：需求 23.8 万 token × 闸门 192K → 单次 192K 帽 + 预期/硬顶两层', () => {
    const q = planOutputQuota({ needTokens: 238000, safetyBuffer: 1, perCallCap: 999999, engineCeiling: GATE });
    expect(q.perCall).toBe(GATE);
    expect(q.rounds).toBe(2);
    expect(q.hardQuota).toBe(GATE * 3);   // 总输出有明确上界（成本可见）
  });

  it('异常输入安全（0/负/NaN/Infinity）', () => {
    expect(planOutputQuota({}).perCall).toBe(1);
    expect(planOutputQuota({ needTokens: -5 }).perCall).toBe(1);
    expect(planOutputQuota({ needTokens: NaN }).perCall).toBe(1);
    const inf = planOutputQuota({ needTokens: 1000, perCallCap: Infinity, engineCeiling: Infinity });
    expect(inf.need).toBe(1250);          // 默认安全缓冲 ×1.25
    expect(inf.perCall).toBe(1250);
    expect(Number.isFinite(inf.hardQuota)).toBe(true);
  });
});

describe('nextContinuationBudget / isOverQuota：超预期不停止，触硬顶才停', () => {
  it('首轮续写给满单次帽', () => {
    expect(nextContinuationBudget({ hardQuota: 30000, producedChars: 0, perCall: 10000 })).toBe(10000);
  });

  it('随已产出递减（硬顶 − 已产出 小于单次帽时以剩余为准）', () => {
    const b = nextContinuationBudget({ hardQuota: 30000, producedChars: 30000, perCall: 10000 });
    expect(b).toBeLessThan(10000);
    expect(b).toBe(30000 - charsToTokens(30000)); // 剩余额度
  });

  it('触硬顶 → 返回 0（调用方据此刻停止续写）', () => {
    expect(nextContinuationBudget({ hardQuota: 10000, producedChars: 100000, perCall: 10000 })).toBe(0);
    expect(nextContinuationBudget({ hardQuota: 0, producedChars: 0, perCall: 10000 })).toBe(0);
  });

  it('思考放大倍数作用于请求预算；不得越引擎上限', () => {
    expect(nextContinuationBudget({ hardQuota: 30000, producedChars: 0, perCall: 10000, thinkingMultiplier: 2 })).toBe(20000);
    expect(nextContinuationBudget({ hardQuota: 30000, producedChars: 0, perCall: 10000, thinkingMultiplier: 2, engineCeiling: 12000 })).toBe(12000);
  });

  it('isOverQuota：只报"超预期"，不参与停止判断', () => {
    expect(isOverQuota({ quota: 10000, producedChars: 0 })).toBe(false);
    expect(isOverQuota({ quota: 10000, producedChars: 20000 })).toBe(true);  // 15385 token > 10000
  });

  it('字符→token 口径与预算解析一致（CHARS_PER_TOKEN=1.3）', () => {
    expect(charsToTokens(1300)).toBe(1000); // 1300 ÷ 1.3
    expect(charsToTokens(1301)).toBe(1001); // 向上取整（不足 1 token 进位）
    expect(charsToTokens(0)).toBe(0);
    expect(charsToTokens(-10)).toBe(0);
  });
});
