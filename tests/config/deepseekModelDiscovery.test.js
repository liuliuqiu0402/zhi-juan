// ✅ A13-4（2026-09-11）：DeepSeek 云端模型**全量列表**与"后续新模型切换入口"
// 背景：A13-4 规定自动发现不再"优先 pro"（防重演"被自动改成 pro"）。但为**后续新模型（含日后再出的
//      Pro 旗舰）留切换入口**，必须有"全量列表"：listDeepSeekModels() 拉 /models 全量 id 交给设置页下拉，
//      新模型一出现即可手动选用；自动选择规则（pickDiscoveredDeepSeekModel）只补"当前模型失效"的回落。
// 本文件锁死：全量列表成功/缓存/401/网络异常四条降级路径，以及"不擅自切换"的行为。
import { describe, it, expect, vi, afterEach } from 'vitest';

// 每个用例取全新模块实例（模块内有 /models 缓存与 401 阻断等状态，避免用例互相污染）
const freshApi = async () => {
  vi.resetModules();
  return await import('../../src/config/apiConfig.js');
};

const jsonResp = (ids) => ({ ok: true, status: 200, json: async () => ({ data: ids.map(id => ({ id })) }) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('A13-4 模型全量列表（后续新模型的切换入口）', () => {
  it('未配置 API Key → 返回空列表，且不请求 /models', async () => {
    const mod = await freshApi();
    mod.apiConfig.deepseekApiKey = '';
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await mod.listDeepSeekModels()).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('成功 → 返回**全量** id（含未来新模型），并缓存（第二次不再请求）', async () => {
    const mod = await freshApi();
    mod.apiConfig.deepseekApiKey = 'sk-test-key-123456';
    const f = vi.fn(async () => jsonResp(['deepseek-flash', 'deepseek-v5-pro', 'deepseek-v4-pro']));
    vi.stubGlobal('fetch', f);
    const first = await mod.listDeepSeekModels();
    expect(first).toEqual(['deepseek-flash', 'deepseek-v5-pro', 'deepseek-v4-pro']);
    // 🔑 关键：新模型也在列表里 → 设置页下拉可列出并切换（这就是"切换入口"的保证）
    expect(first).toContain('deepseek-v5-pro');
    const second = await mod.listDeepSeekModels();
    expect(second).toEqual(first);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('401 → 空列表，且本会话不再重复请求（该端点鉴权策略与 chat/completions 不同，仅作辅助）', async () => {
    const mod = await freshApi();
    mod.apiConfig.deepseekApiKey = 'sk-test-key-123456';
    const f = vi.fn(async () => ({ ok: false, status: 401 }));
    vi.stubGlobal('fetch', f);
    expect(await mod.listDeepSeekModels()).toEqual([]);
    expect(await mod.listDeepSeekModels()).toEqual([]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('网络异常 → 空列表且不抛出（调用方保持现有配置不变）', async () => {
    const mod = await freshApi();
    mod.apiConfig.deepseekApiKey = 'sk-test-key-123456';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await mod.listDeepSeekModels()).toEqual([]);
  });
});

describe('A13-4 自动发现：有切换入口，但不擅自切换', () => {
  it('当前模型仍可用 → 保持不动（即使云端已有更新的 Pro 也不自动切过去）', async () => {
    const mod = await freshApi();
    mod.apiConfig.deepseekApiKey = 'sk-test-key-123456';
    mod.apiConfig.deepseekModel = 'deepseek-flash';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResp(['deepseek-flash', 'deepseek-v5-pro'])));
    expect(await mod.autoDiscoverDeepSeekModel()).toBe('deepseek-flash');
    expect(mod.apiConfig.deepseekModel).toBe('deepseek-flash');
  });

  it('当前模型已失效 → 回落 flash（不得回落/切换为 pro）', async () => {
    const mod = await freshApi();
    mod.apiConfig.deepseekApiKey = 'sk-test-key-123456';
    mod.apiConfig.deepseekModel = 'deepseek-gone';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResp(['deepseek-flash', 'deepseek-v5-pro'])));
    expect(await mod.autoDiscoverDeepSeekModel()).toBe('deepseek-flash');
    expect(mod.apiConfig.deepseekModel).toBe('deepseek-flash');
  });

  it('用户已选的新模型仍在列表 → 尊重用户选择（不受归一/回落影响）', async () => {
    const mod = await freshApi();
    mod.apiConfig.deepseekApiKey = 'sk-test-key-123456';
    mod.apiConfig.deepseekModel = 'deepseek-v5-pro';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResp(['deepseek-flash', 'deepseek-v5-pro'])));
    expect(await mod.autoDiscoverDeepSeekModel()).toBe('deepseek-v5-pro');
    expect(mod.apiConfig.deepseekModel).toBe('deepseek-v5-pro');
  });
});
