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
  /** 写缓存时声明的"关键字段"（调用点按该次 prompt 的响应 schema 传入；读端据此复判） */
  keyFields?: string[];
}

/** 🔧 缓存内容有效性判据：analysis 类**同 taskType 下存在多个不同 schema**——
 *  教材特征分析 → knowledgeHierarchy/coreTopics/visualDescription/formulas；
 *  知识图谱（buildKnowledgeMap）→ knowledgePoints/keyDifficulties/knowledgeGraph/crossChapterLinks。
 *  故默认取**并集**兜底（新调用点未显式声明 keyFields 时不至于误判为坏结果），
 *  调用点应尽量通过 `keyFields` 精确声明，避免"缺 A schema 字段却被 B 字段放过"。
 *  （2026-09-12 实证：仅用教材特征分析字段判据 → 知识图谱合法响应被误判坏结果、拒缓存。） */
const DEFAULT_CACHE_KEY_FIELDS: Record<string, string[]> = {
  analysis: [
    'knowledgeHierarchy', 'coreTopics', 'visualDescription', 'formulas',
    'knowledgeGraph', 'knowledgePoints', 'keyDifficulties', 'crossChapterLinks',
  ],
  blueprint: ['structure', 'layout', 'blueprint', 'sections'],
};

/** 取该次缓存的有效性判据字段：调用点显式声明优先，缺省回退到 taskType 默认并集 */
const keyFieldsFor = (taskType: string, declared?: string[]): string[] =>
  (Array.isArray(declared) && declared.length ? declared : DEFAULT_CACHE_KEY_FIELDS[taskType] || []);

/**
 * 🔴 2026-10-24（真机：教材分析"返回空界面"）：原判据只查"content 里出现某个关键字段名"——
 *   一段被截断/夹带说明的 JSON 里**照样出现** `knowledgeHierarchy` 这几个字，于是坏结果被判为有效、
 *   反复命中（日志实证：命中 L1 → 解析失败 → 修复失败 → 缺 knowledgeHierarchy → 丢弃 → 界面全空，
 *   再点"重试"仍命中同一条坏缓存，永远出不来）。
 *   改为**结构判据**：剥掉 ```json 围栏后必须能被 JSON.parse 解析。解析不了就是坏结果，一律不认。
 */
const looksLikeWholeJson = (s: string): boolean => {
  const t = String(s || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
};

/**
 * 🔴 2026-10-29（真机"教材分析返回残缺内容"根因 2）：
 *   写/读缓存时仅查 `content.includes('knowledgeHierarchy')` + `JSON.parse` 能过是不够的——
 *   续写链可以把残缺 JSON 续出一个"语法合法、knowledgeHierarchy 字符串出现、但实际数组
 *   只有前几个元素"的结果。这种结果会被写缓存固化，反复命中反复返回残缺内容。
 *   改为**结构校验**：先剥围栏 → JSON.parse → 检查 keyFields 里至少有一个字段
 *   **实际存在且非空**（数组 .length>0、字符串 .trim() 非空、其他 truthy）。
 */
const parseCleanJson = (s: string): any | null => {
  const t = String(s || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { return null; }
};

/** 检查解析后的 JSON 是否至少有一个 keyField 存在且有实际值 */
const hasStructuralKeyField = (parsed: any, keyFields: string[]): boolean => {
  if (!parsed || typeof parsed !== 'object') return false;
  return keyFields.some((f) => {
    const v = parsed[f];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return v != null && v !== false && v !== 0;
  });
};

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
      const keyFields = keyFieldsFor(entry.taskType, entry.keyFields);
      // 🔴 结构校验：解析 JSON 后 keyFields 至少有一个实际存在且非空
      const parsed = parseCleanJson(entry.content);
      const valid = parsed != null && hasStructuralKeyField(parsed, keyFields);
      if (!valid) {
        console.warn(`🗑️ [L1缓存] 命中 ${entry.taskType} 坏缓存（结构校验未通过：不是完整 JSON 或关键字段为空），删除并放行真调（key:${cacheKey.slice(0, 24)}...）`);
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
  meta: { taskType: string; model: string; keyFields?: string[] }
): Promise<void> {
  try {
    // 🔧 缓存污染根治：分析/蓝图类任务本质要产出结构化 JSON。若响应缺关键结构迹象（空/截断/错乱），
    //    **绝不落库**——否则下次命中把坏结果当合法结果返回、永不真调 API（2026-09-12 教材
    //    "小数乘法和除法(二)"根因即坏结果被缓存冻结）。
    //    判据字段由调用点按该次 prompt 的 schema 声明（keyFields）；未声明时回退 taskType 默认并集——
    //    ⚠️ 不可写死成"教材特征分析"单套字段：同 taskType 下知识图谱（buildKnowledgeMap）schema 不同，
    //    会被误判为坏结果而拒缓存（2026-09-12 实证）。
    if (meta?.taskType === 'analysis' || meta?.taskType === 'blueprint') {
      const keyFields = keyFieldsFor(meta.taskType, meta.keyFields);
      // 🔴 结构校验（取代原字符串 includes + looksLikeWholeJson）：
      //    续写链能续出"语法合法但内容残缺"的 JSON（knowledgeHierarchy 只有前几个元素），
      //    原校验 `content.includes('knowledgeHierarchy')` 会被这类结果骗过。
      //    现改为 parseCleanJson + hasStructuralKeyField——只有解析后 keyFields 中至少一个
      //    字段**实际存在且非空**（数组.length>0/字符串.trim()非空/其他 truthy）才落库。
      const parsed = parseCleanJson(content);
      if (!content || !content.trim() || parsed == null || !hasStructuralKeyField(parsed, keyFields)) {
        console.warn(`🚫 [L1缓存] 拒绝写入 ${meta?.taskType} 坏结果（结构校验未通过：空/不是完整 JSON/关键字段为空），避免污染缓存（key:${cacheKey.slice(0, 24)}...）`);
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

