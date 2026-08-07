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
