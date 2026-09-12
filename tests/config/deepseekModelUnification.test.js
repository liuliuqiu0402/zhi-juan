// ✅ A13（2026-09-11）：DeepSeek 模型 id 统一为正式名 `deepseek-flash`（= DeepSeek-V4.1-Flash）
// 背景：官方口径 `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` 为遗留别名（对应模型已退役，
//      请求由 V4.1-Flash 服务）。`deepseek-v4-pro`：V4.1 Flash 在性能/费用/速度上全面超越它，故项目统一 flash；
//      ⚠️ 2026-09-12 更正：官方已撤回"9-14 下线/路由"公告，Pro **继续提供、计费不变**——
//      因此该映射属"项目统一口径 + 旧配置兼容"（A13-2），不再声称"模型已消失"。
//      另修：模型自动发现此前"优先 pro"并写回持久化，会把统一口径改回 pro（A13-4）。
//      ✅ A13-5（2026-09-12 用户裁定「甲」）：下拉候选过滤已被归一的遗留名，消除"选了也会被改写"的假选项。
import { describe, it, expect } from 'vitest';
import {
  apiConfig,
  DEEPSEEK_MODEL_ALIASES,
  normalizeDeepSeekModelId,
  pickDiscoveredDeepSeekModel,
  listDeepSeekSelectableModels,
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

  it('A13-5 下拉可选模型过滤：已被归一的遗留名不入候选（防"选了也会被改写"的假选项）', () => {
    const cloud = ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v5-pro'];
    expect(listDeepSeekSelectableModels(cloud)).toEqual(['deepseek-flash', 'deepseek-v5-pro']);
    // 未归一新模型照常入列（A13-4 的"切换入口"保证不受影响）
    expect(listDeepSeekSelectableModels(['deepseek-flash', 'deepseek-v9-ultra'])).toContain('deepseek-v9-ultra');
    // 三个遗留别名全部剔除
    expect(listDeepSeekSelectableModels(['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-v4-pro']))
      .toEqual(['deepseek-flash']);
    // 极端情况：云端只返回遗留别名 → 回退原列表（保证下拉非空）
    expect(listDeepSeekSelectableModels(['deepseek-v4-pro'])).toEqual(['deepseek-v4-pro']);
    // 空输入安全
    expect(listDeepSeekSelectableModels([])).toEqual([]);
    expect(listDeepSeekSelectableModels(null)).toEqual([]);
  });
});
