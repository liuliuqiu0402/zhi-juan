/**
 * 生成结果缓存 —— 客户端缓存 + 服务端 KV Cache 协同降本
 *
 * 双层策略：
 *   L1（客户端 IndexedDB）：完全命中 → 零 API 调用，100% 省钱
 *   L2（服务端 KV Cache）：命中前缀 → 输入成本 ¥1.01→¥0.02/百万（98% 省）
 *
 * 缓存键：教材ID + 章节ID + 资料类型 + 配置哈希 → 确定性唯一
 * TTL：7 天（教材/指令库更新后自动失效）
 */

import storage from './storage';

const CACHE_PREFIX = 'gen_cache_';
const PROMPT_CACHE_PREFIX = 'gen_cache_p_'; // prompt 级缓存（中间任务）
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const MAX_CACHE_ENTRIES = 50; // 上限防存储膨胀

interface CacheEntry {
  content: string;
  timestamp: number;
  textbookId: string;
  genType: string;
  subject: string;
  stage: string;
  grade: string;
  chapterCount: number;
}

/**
 * 生成确定性缓存键（不含随机盐，确保相同输入→相同键→命中服务器KV Cache）
 */
export function generateCacheKey(params: {
  engine: string;
  textbookId: string;
  chapterIds: string[];
  genType: string;
  subject: string;
  stage: string;
  grade: string;
  questionTypeIds?: string[];
  difficultyIds?: string[];
  totalScore?: number;
  pageCount?: number;
  templateId?: string;
  instrVer?: number;
}): string {
  const sorted = {
    e: params.engine,
    t: params.textbookId,
    c: [...(params.chapterIds || [])].sort().join(','),
    g: params.genType,
    s: params.subject,
    st: params.stage,
    gr: params.grade,
    qt: [...(params.questionTypeIds || [])].sort().join(','),
    d: [...(params.difficultyIds || [])].sort().join(','),
    sc: params.totalScore || 0,
    pc: params.pageCount || 0,
    tp: params.templateId || '',
    iv: params.instrVer || 0,
  };
  // 简单确定性哈希（避免 JSON.stringify 键序不稳定的问题）
  const raw = `${sorted.e}|${sorted.t}|${sorted.c}|${sorted.g}|${sorted.s}|${sorted.st}|${sorted.gr}|${sorted.qt}|${sorted.d}|${sorted.sc}|${sorted.pc}|${sorted.tp}|v${sorted.iv}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return CACHE_PREFIX + Math.abs(hash).toString(36);
}

/** 检查缓存是否过期 */
function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL_MS;
}

/** 读取缓存 */
export async function getCachedResult(cacheKey: string): Promise<string | null> {
  try {
    const entry = await storage.getItem<CacheEntry>(cacheKey);
    if (!entry || !entry.content) return null;
    if (isExpired(entry)) {
      await storage.removeItem(cacheKey);
      return null;
    }
    console.log(`✅ [缓存命中] 客户端缓存命中，零API调用 → 节省100%成本 (key:${cacheKey.slice(0,20)}...)`);
    return entry.content;
  } catch (e) {
    console.warn('[缓存] 读取失败:', (e as Error).message);
    return null;
  }
}

/** 写入缓存 */
export async function setCachedResult(
  cacheKey: string, 
  content: string, 
  meta: Omit<CacheEntry, 'content' | 'timestamp'>
): Promise<void> {
  try {
    const entry: CacheEntry = {
      content,
      timestamp: Date.now(),
      ...meta,
    };
    await storage.setItem(cacheKey, entry);

    // 清理过期 + 超量条目
    await pruneCache();
  } catch (e) {
    console.warn('[缓存] 写入失败:', (e as Error).message);
  }
}

/** 清理过期和超量缓存 */
async function pruneCache(): Promise<void> {
  try {
    const allKeys = await storage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));

    if (cacheKeys.length <= MAX_CACHE_ENTRIES) return;

    // 读取所有条目，按时间排序
    const entries: { key: string; timestamp: number }[] = [];
    for (const key of cacheKeys) {
      const entry = await storage.getItem<CacheEntry>(key);
      if (entry) {
        entries.push({ key, timestamp: entry.timestamp || 0 });
      }
    }

    // 先删过期的
    const expired = entries.filter(e => Date.now() - e.timestamp > CACHE_TTL_MS);
    for (const e of expired) {
      await storage.removeItem(e.key);
    }

    // 仍超量则删最旧的
    const remaining = entries.filter(e => !expired.includes(e));
    remaining.sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = remaining.slice(0, remaining.length - MAX_CACHE_ENTRIES);
    for (const e of toDelete) {
      await storage.removeItem(e.key);
    }

    if (expired.length + toDelete.length > 0) {
      console.log(`🧹 [缓存清理] 删除${expired.length}条过期 + ${toDelete.length}条超量`);
    }
  } catch {
    // 静默失败，不影响主流程
  }
}

/** 清空所有生成缓存 */
export async function clearGenerationCache(): Promise<void> {
  try {
    const allKeys = await storage.getAllKeys();
    for (const key of allKeys) {
      if (key.startsWith(CACHE_PREFIX)) {
        await storage.removeItem(key);
      }
    }
    console.log('🧹 [缓存] 全部生成缓存已清空');
  } catch {
    // 静默
  }
}

/** 获取缓存统计 */
export async function getCacheStats(): Promise<{ count: number; totalSizeMB: number }> {
  try {
    const allKeys = await storage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
    let totalSize = 0;
    for (const key of cacheKeys) {
      const entry = await storage.getItem<CacheEntry>(key);
      if (entry?.content) {
        totalSize += entry.content.length;
      }
    }
    return { count: cacheKeys.length, totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100 };
  } catch {
    return { count: 0, totalSizeMB: 0 };
  }
}

// ==================== Prompt 级缓存（中间任务） ====================
// 仅缓存确定性任务（analysis/blueprint/extraction），跳过 generation/review 保证创意多样性

interface PromptCacheEntry {
  content: string;
  timestamp: number;
  taskType: string;
  model: string;
}

/**
 * 生成 prompt 级缓存键（确定性：相同 taskType+model+prompt → 相同键）
 */
export function generatePromptCacheKey(taskType: string, model: string, prompt: string): string {
  const raw = `${taskType}|${model}|${prompt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return PROMPT_CACHE_PREFIX + Math.abs(hash).toString(36);
}

/** 读取 prompt 级缓存 */
export async function getCachedPromptResult(cacheKey: string): Promise<string | null> {
  try {
    const entry = await storage.getItem<PromptCacheEntry>(cacheKey);
    if (!entry || !entry.content) return null;
    // 🔧 缓存污染根治（读端）：命中后校验 content 真实性。analysis/blueprint 必须是含关键结构字段的
    //    完整响应，否则视为坏缓存 → 删除并放行真调 API（防历史污染的坏键仍被命中冻结）。
    if (['analysis', 'blueprint'].includes(entry.taskType)) {
      const keyFields = entry.taskType === 'analysis'
        ? ['knowledgeHierarchy', 'coreTopics', 'visualDescription', 'formulas']
        : ['structure', 'layout', 'blueprint', 'sections'];
      const valid = keyFields.some((f) => entry.content.includes(f));
      if (!valid) {
        console.warn(`🗑️ [L1缓存] 命中 ${entry.taskType} 坏缓存（缺关键字段），删除并放行真调（key:${cacheKey.slice(0, 24)}...）`);
        await storage.removeItem(cacheKey);
        return null;
      }
    }
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      await storage.removeItem(cacheKey);
      return null;
    }
    console.log(`✅ [Prompt缓存命中] ${entry.taskType} 任务零API调用 → 节省100%成本 (key:${cacheKey.slice(0, 24)}...)`);
    return entry.content;
  } catch {
    return null;
  }
}

/** 写入 prompt 级缓存 */
export async function setCachedPromptResult(
  cacheKey: string,
  content: string,
  meta: { taskType: string; model: string }
): Promise<void> {
  try {
    // 🔧 缓存污染根治：analysis 类任务本质要产出教材特征/知识层级（含 knowledgeHierarchy 等关键字段）。
    //    若响应缺这些结构迹象（空/截断/格式错乱），**绝不落库**——否则下次命中把坏结果当合法结果返回，
    //    永不真调 API（2026-09-12 教材"小数乘法和除法(二)"根因即坏结果被缓存冻结）。
    //    blueprint 同理（JSON 结构任务）。用"关键字段标记"宽松校验：能修复的合法响应含 key 字段即通过，
    //    真正截断/空响应不含，被拦截；宁少缓存也绝不缓存坏结果。
    if (meta?.taskType === 'analysis' || meta?.taskType === 'blueprint') {
      const keyFields = meta?.taskType === 'analysis'
        ? ['knowledgeHierarchy', 'coreTopics', 'visualDescription', 'formulas']
        : ['structure', 'layout', 'blueprint', 'sections'];
      // 空内容或缺关键字段 = 坏结果 → 拒写（空串是 falsy，不能走 `content &&` 放过）
      if (!content || !content.trim() || !keyFields.some((f) => content.includes(f))) {
        console.warn(`🚫 [L1缓存] 拒绝写入 ${meta?.taskType} 坏结果（空/缺关键字段），避免污染缓存（key:${cacheKey.slice(0, 24)}...）`);
        return;
      }
    }
    const entry: PromptCacheEntry = {
      content,
      timestamp: Date.now(),
      ...meta,
    };
    await storage.setItem(cacheKey, entry);
    await pruneCache();
  } catch {
    // 静默失败，不影响主流程
  }
}

