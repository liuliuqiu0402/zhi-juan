// L1 prompt 缓存污染根治（analysis/blueprint）
// 背景（2026-09-12 教材"小数乘法和除法(二)"）：分析坏结果（被截断/缺 knowledgeHierarchy）被写入
//   IndexedDB 缓存后，下次命中直接当合法结果返回、永不真调 API → 反复失败却不知缓存污染。
// 根治两条：
//   · 写端 setCachedPromptResult：analysis/blueprint 缺关键字段的坏结果拒不落库。
//   · 读端 getCachedPromptResult：命中坏缓存时删除并放行真调（清理历史污染键）。
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 用假 storage 替换真实 IndexedDB 封装（vi.hoisted 保证 mock 提升时变量已初始化）
const { mockStore } = vi.hoisted(() => ({ mockStore: new Map() }));
vi.mock('../../src/utils/storage', () => {
  return {
    default: {
      getItem: vi.fn(async (k) => mockStore.get(k) ?? null),
      setItem: vi.fn(async (k, v) => { mockStore.set(k, v); }),
      removeItem: vi.fn(async (k) => { mockStore.delete(k); }),
      getAllKeys: vi.fn(async () => [...mockStore.keys()]),
      getUsage: vi.fn(async () => 0),
    },
  };
});

import {
  generatePromptCacheKey,
  getCachedPromptResult,
  setCachedPromptResult,
} from '../../src/utils/generationCache';

const ANALYSIS_KEY = generatePromptCacheKey('analysis', 'deepseek-flash', '某教材特征分析');
const BLUEPRINT_KEY = generatePromptCacheKey('blueprint', 'deepseek-flash', '某蓝图');

const okAnalysis = '{"knowledgeHierarchy":[],"coreTopics":"乘法的意义"}';
const badAnalysis = '抱歉，我无法解析这段文本。请提供正确的教材内容。';
const okBlueprint = '{"layout":"两栏","structure":[{"section":"一"}]}';
const badBlueprint = '生成失败，请重试';

const freshEntry = (content, taskType) => ({
  content,
  taskType,
  model: 'deepseek-flash',
  timestamp: Date.now(),
});

describe('下游缓存写入：坏结果拒绝落库', () => {
  beforeEach(async () => { mockStore.clear(); });

  it('analysis 合法结果（含 knowledgeHierarchy）可写入', async () => {
    await setCachedPromptResult(ANALYSIS_KEY, okAnalysis, { taskType: 'analysis', model: 'deepseek-flash' });
    expect(mockStore.has(ANALYSIS_KEY)).toBe(true);
  });

  it('analysis 坏结果（缺关键字段）拒绝落库', async () => {
    await setCachedPromptResult(ANALYSIS_KEY, badAnalysis, { taskType: 'analysis', model: 'deepseek-flash' });
    expect(mockStore.has(ANALYSIS_KEY)).toBe(false);
    // 再写入合法结果可覆盖
    await setCachedPromptResult(ANALYSIS_KEY, okAnalysis, { taskType: 'analysis', model: 'deepseek-flash' });
    expect(mockStore.has(ANALYSIS_KEY)).toBe(true);
  });

  it('analysis 空内容拒绝落库', async () => {
    await setCachedPromptResult(ANALYSIS_KEY, '', { taskType: 'analysis', model: 'deepseek-flash' });
    expect(mockStore.has(ANALYSIS_KEY)).toBe(false);
  });

  it('blueprint 合法结果写入、坏结果拒绝', async () => {
    await setCachedPromptResult(BLUEPRINT_KEY, badBlueprint, { taskType: 'blueprint', model: 'deepseek-flash' });
    expect(mockStore.has(BLUEPRINT_KEY)).toBe(false);
    await setCachedPromptResult(BLUEPRINT_KEY, okBlueprint, { taskType: 'blueprint', model: 'deepseek-flash' });
    expect(mockStore.has(BLUEPRINT_KEY)).toBe(true);
  });
});

describe('下游缓存读取：坏缓存命中时删除并放行真调', () => {
  beforeEach(async () => { mockStore.clear(); });

  it('命中合法 analysis 缓存 → 返回内容', async () => {
    mockStore.set(ANALYSIS_KEY, freshEntry(okAnalysis, 'analysis'));
    const res = await getCachedPromptResult(ANALYSIS_KEY);
    expect(res).toBe(okAnalysis);
  });

  it('命中坏 analysis 缓存（缺关键字段）→ 删除键并返回 null（放行真调）', async () => {
    mockStore.set(ANALYSIS_KEY, freshEntry(badAnalysis, 'analysis'));
    const res = await getCachedPromptResult(ANALYSIS_KEY);
    expect(res).toBeNull();
    expect(mockStore.has(ANALYSIS_KEY)).toBe(false);
  });

  it('命中坏 blueprint 缓存 → 删除并返回 null', async () => {
    mockStore.set(BLUEPRINT_KEY, freshEntry(badBlueprint, 'blueprint'));
    const res = await getCachedPromptResult(BLUEPRINT_KEY);
    expect(res).toBeNull();
    expect(mockStore.has(BLUEPRINT_KEY)).toBe(false);
  });
});