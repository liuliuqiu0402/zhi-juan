// 分析任务输出上限（analysis maxTokens）隐式截断根因 + 修复
// 背景（2026-09-12）：教材"小数乘法和除法(二)"特征分析失败 → 锚树判 "knowledgeHierarchy empty"。
//   根因不是缓存、不是模型，而是 **analysis 的 max_tokens 被旧 localStorage 里过窄死值（4096）钳死**：
//   maxTokensByTask 整块覆盖让旧 `analysis:4096` 压死新默认 65536 → 输出被硬截断 → robustJsonParse
//   把残缺 JSON 补全成"缺 knowledgeHierarchy 字段的对象" → `|| []` → 空树 → 不落库。
// 修复两层：
//   A. loadConfig 深合并 maxTokensByTask 逐键取"默认与存储的较大者"（旧窄值不再压死新默认）。
//   B. 分析 callAI 接生成侧"灵活模式"（planOutputQuota + 引擎护栏），maxTokens 由原文量推导，不是死数字。
import { describe, it, expect } from 'vitest';
import { mergeMaxTokensByTask, getTaskMaxTokens } from '../../src/config/apiConfig.js';
import { planOutputQuota, charsToTokens } from '../../src/utils/outputQuota.js';

// 期望值独立编码，不引用被测模块自证
const DEFAULT_BY_TASK = {
  extraction: 2048,
  analysis: 65536,
  blueprint: 32768,
  generation: 32768,
  formatting: 8192,
};

function expectClampedByLegacy4096() {
  // 记录被修掉的旧行为：整块浅覆盖会让 analysis 落 4096
  return mergeMaxTokensByTask(DEFAULT_BY_TASK, { ...DEFAULT_BY_TASK, analysis: 4096 }).analysis;
}

describe('analysis 输出上限：不被旧 localStorage 过窄死值钳死', () => {
  it('🔴 旧存档 analysis=4096 不再压死新默认 65536（取较大 → 65536）', () => {
    const stored = { ...DEFAULT_BY_TASK, analysis: 4096 }; // 旧 localStorage 内容
    const merged = mergeMaxTokensByTask(DEFAULT_BY_TASK, stored);
    expect(merged.analysis).toBe(65536);
    // 记录被修掉的旧行为：整块浅覆盖会返回 4096 → 显式断言它 ≠ 4096
    expect(merged.analysis).not.toBe(4096);
  });

  it('用户主动放大某任务时不被默认值回退（取较大保留用户放大）', () => {
    const stored = { ...DEFAULT_BY_TASK, blueprint: 65536 }; // 用户调大
    const merged = mergeMaxTokensByTask(DEFAULT_BY_TASK, stored);
    expect(merged.blueprint).toBe(65536); // 不被默认 32768 回退
  });

  it('合并函数绝不返回 0 或负数（任意脏值兜底为默认）', () => {
    const merged = mergeMaxTokensByTask(DEFAULT_BY_TASK, { analysis: -5, formatting: 0 });
    expect(merged.analysis).toBe(65536);
    expect(merged.formatting).toBe(8192);
  });
});

// 默认表与测试锁定口径一致（否则上面断言失真）
describe('默认 maxTokensByTask 表一致', () => {
  it('getTaskMaxTokens 读到 analysis=65536（新默认，非旧 4096）', () => {
    expect(getTaskMaxTokens('analysis')).toBe(65536);
    expect(getTaskMaxTokens('extraction')).toBe(2048);
  });
});

describe('analysis 灵活模式：maxTokens 由原文量推导，不再静态卡死', () => {
  it('5357字章节（本次故障样本）推导到远高于旧 4096 的单次帽', () => {
    // 复刻本次故障章节：原文 5357 字
    const need = charsToTokens(5357);
    // 深seek 引擎护栏 196608（与 engineOutputLimit 测试同值）；perCallCap 为默认 analysis 65536
    const quota = planOutputQuota({ needTokens: need, safetyBuffer: 1.25, perCallCap: 65536, engineCeiling: 196608, minRounds: 0 });
    expect(quota.perCall).toBeGreaterThan(4096); // 关键：不再被旧死值卡住
    expect(quota.perCall).toBeLessThanOrEqual(65536); // 仍被类型帽/护栏约束（不失控）
  });

  it('minRounds=0 时单次帽即所需（分析为单次调用、无续写轮）', () => {
    const quota = planOutputQuota({ needTokens: 1000, safetyBuffer: 1, perCallCap: 65536, engineCeiling: 196608, minRounds: 0 });
    expect(quota.perCall).toBe(1000);
    expect(quota.rounds).toBeGreaterThanOrEqual(1);
  });

  it('fail-safe：needTokens 极小也不落到 0（至少 1）', () => {
    const quota = planOutputQuota({ needTokens: 0, perCallCap: 65536, engineCeiling: 196608, minRounds: 0 });
    expect(quota.perCall).toBeGreaterThanOrEqual(1);
  });
});