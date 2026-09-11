// ✅ A14-1 / A14-5（2026-09-11）：输出护栏三层落地
//   物理层 = 引擎能力表（ENGINE_CAPABILITY，不可超）；偏好层 = 成本护栏（默认 64K，可调）；
//   最终护栏 = min(物理层帽, 偏好层帽)——用户设置突破不了物理上限，物理上限也不覆盖用户的保守设置。
//   依据：DeepSeek 官方 API 文档（2026-09-11 核实）——V4 系列上下文 1M、最大输出 384K。
import { describe, it, expect, afterEach } from 'vitest';
import {
  apiConfig,
  ENGINE_CAPABILITY,
  resolveEngineCapability,
  resolveOutputCeiling,
  resolveEngineOutputLimit,
  DEFAULT_OUTPUT_CEILING_TOKENS,
} from '../../src/config/apiConfig.js';

const clearCeiling = () => {
  if (apiConfig.generationSettings && 'outputCeilingTokens' in apiConfig.generationSettings) {
    delete apiConfig.generationSettings.outputCeilingTokens;
  }
};
afterEach(clearCeiling);

describe('A14 输出护栏分层（物理层 × 偏好层，最终取 min）', () => {
  it('A14-5 物理层能力表：V4 系列 1M/384K；旧 chat 8K；未知 provider 不设限', () => {
    expect(ENGINE_CAPABILITY.deepseek.default).toEqual({ contextWindow: 1000000, maxOutput: 393216 });
    // 正式名 / 遗留名 / 未来新名 / 空名 一律落 V4 默认档（防未来新模型名不匹配被误钳）
    for (const m of ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-unknown-future', '']) {
      const cap = resolveEngineCapability('deepseek', m);
      expect(cap.maxOutput, `模型 ${m} 的 maxOutput`).toBe(393216);
      expect(cap.contextWindow, `模型 ${m} 的 contextWindow`).toBe(1000000);
    }
    expect(resolveEngineCapability('deepseek', 'deepseek-chat').maxOutput).toBe(8192);
    expect(resolveEngineCapability('deepseek', 'deepseek-reasoner').maxOutput).toBe(65536);
    expect(resolveEngineCapability('volcano', 'any').maxOutput).toBe(Infinity);
    expect(resolveEngineCapability('', '').maxOutput).toBe(Infinity);
  });

  it('A14-1 偏好层：默认 128K（2026-09-11 用户裁定），且可经 generationSettings.outputCeilingTokens 调整', () => {
    clearCeiling();
    expect(DEFAULT_OUTPUT_CEILING_TOKENS).toBe(131072);
    expect(resolveOutputCeiling()).toBe(131072);
    apiConfig.generationSettings.outputCeilingTokens = 200000;
    expect(resolveOutputCeiling()).toBe(200000);
    // 非法值（0/负/非数）回退默认，不产生"0 帽"把输出掐死
    apiConfig.generationSettings.outputCeilingTokens = 0;
    expect(resolveOutputCeiling()).toBe(131072);
    apiConfig.generationSettings.outputCeilingTokens = 'x';
    expect(resolveOutputCeiling()).toBe(131072);
  });

  it('A14-1 最终护栏 = min(物理层, 偏好层)：物理不放大用户保守设置，偏好也突破不了物理', () => {
    clearCeiling();
    // 偏好 128K < 物理 384K → 取 128K
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-flash')).toBe(131072);
    // 偏好上调到 200K（仍 < 384K）→ 取 200K
    apiConfig.generationSettings.outputCeilingTokens = 200000;
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-flash')).toBe(200000);
    // 偏好设为远超物理 → 被物理层挡住，绝不超过 V4 物理上限 384K
    apiConfig.generationSettings.outputCeilingTokens = 999999999;
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-flash')).toBe(393216);
    // 物理层更严时以物理层为准：旧 chat 8K，偏好 128K 不得放大
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-chat')).toBe(8192);
  });

  it('A14-5 非 deepseek 引擎上限未固证 → 不钳制（Infinity，防误伤）', () => {
    for (const p of ['volcano', 'alibaba', 'zhipu', 'ollama', '']) {
      expect(resolveEngineOutputLimit(p, 'any-model')).toBe(Infinity);
    }
  });
});
