// ✅ A13（2026-09-11）：DeepSeek 模型 id 统一为正式名 `deepseek-flash`（= DeepSeek-V4.1-Flash）
// 背景：官方口径 `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` 为遗留别名（对应模型已退役，
//      请求由 V4.1-Flash 服务）；`deepseek-v4-pro` 自 2026-09-14 12:00 起全部路由到 V4.1-Flash 并按 Flash 计费。
//      项目内统一正式名，并保留「旧值 → 新值」兼容映射，避免用户 localStorage 旧配置失效（A13-2）。
//      另修：模型自动发现此前"优先 pro"并写回持久化，会把统一口径改回 pro（A13-4）。
import { describe, it, expect } from 'vitest';
import {
  apiConfig,
  DEEPSEEK_MODEL_ALIASES,
  normalizeDeepSeekModelId,
  pickDiscoveredDeepSeekModel,
} from '../../src/config/apiConfig.js';

describe('A13 DeepSeek 模型 id 统一（正式名 deepseek-flash）', () => {
  it('A13-1 默认值统一为 deepseek-flash（三个模型字段）', () => {
    expect(apiConfig.deepseekModel).toBe('deepseek-flash');
    expect(apiConfig.deepseekGenerationModel).toBe('deepseek-flash');
    expect(apiConfig.deepseekAnalysisModel).toBe('deepseek-flash');
  });

  it('A13-2 旧值兼容映射：遗留别名 → deepseek-flash（大小写不敏感 / 去首尾空白）', () => {
    expect(normalizeDeepSeekModelId('deepseek-v4-pro')).toBe('deepseek-flash');
    expect(normalizeDeepSeekModelId('deepseek-v4-flash')).toBe('deepseek-flash');
    expect(normalizeDeepSeekModelId('deepseek-v4-flash-vision-exp')).toBe('deepseek-flash');
    expect(normalizeDeepSeekModelId('DeepSeek-V4-Pro')).toBe('deepseek-flash');
    expect(normalizeDeepSeekModelId('  deepseek-v4-flash  ')).toBe('deepseek-flash');
  });

  it('A13-2 正式名 / 未知名 / 空值原样返回，不误伤', () => {
    expect(normalizeDeepSeekModelId('deepseek-flash')).toBe('deepseek-flash');
    expect(normalizeDeepSeekModelId('deepseek-chat')).toBe('deepseek-chat');
    expect(normalizeDeepSeekModelId('')).toBe('');
    expect(normalizeDeepSeekModelId(null)).toBe('');
    expect(normalizeDeepSeekModelId(undefined)).toBe('');
  });

  it('A13-2 别名表只做「遗留名 → 正式名」单向映射，不含正式名自身（防自映射）', () => {
    expect(Object.keys(DEEPSEEK_MODEL_ALIASES).sort()).toEqual(
      ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-v4-pro'].sort(),
    );
    expect(DEEPSEEK_MODEL_ALIASES['deepseek-flash']).toBeUndefined();
  });

  it('A13-4 模型自动发现不再"优先 pro"，也不改写可用配置', () => {
    // 关键复现：列表同时含 flash 与 pro，旧配置为 pro → 必须归一为 deepseek-flash（不得再回写 pro）
    expect(pickDiscoveredDeepSeekModel(['deepseek-flash', 'deepseek-v4-pro'], 'deepseek-v4-pro')).toBe('deepseek-flash');
    // 用户已选可用模型 → 尊重不动
    expect(pickDiscoveredDeepSeekModel(['deepseek-flash', 'deepseek-v4-pro'], 'deepseek-v4-pro')).not.toBe('deepseek-v4-pro');
    // 配置名已失效（不在列表）→ 回落首个 flash
    expect(pickDiscoveredDeepSeekModel(['deepseek-flash', 'other-model'], 'deepseek-gone')).toBe('deepseek-flash');
    // 列表无 flash → 回落列表首个
    expect(pickDiscoveredDeepSeekModel(['vendor-a', 'vendor-b'], 'deepseek-gone')).toBe('vendor-a');
    // 空列表 → null（调用方另有"使用已配置模型"兜底分支）
    expect(pickDiscoveredDeepSeekModel([], 'deepseek-flash')).toBe(null);
  });
});
