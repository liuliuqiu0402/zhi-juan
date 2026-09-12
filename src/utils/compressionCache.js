/**
 * ✅ A4-11（2026-09-12 用户定「按勾选章节组合缓存压缩结果」）：原文压缩结果缓存
 * ============================================================
 * 为什么要有这个文件：
 *   - 原文压缩（Map→Reduce）是**生成期的一次额外模型调用**，其结果只取决于"勾选章节的原文 + 压缩口径"；
 *     同一批章节重复生成（改委托书/换资料类型前先试着跑一次、或补生成）时会**重复压缩同一份原文**，
 *     白白多付一次调用与等待。
 *   - 因此按**勾选章节组合**缓存压缩结果：命中即直接复用，不入库、不改结果口径。
 *
 * 缓存键（**任一变化即失效**，确保安全）：
 *   - 章节组合与顺序：每节 `标题 + 原文`（"勾选哪几章、什么顺序、原文是什么"全编码进键）；
 *   - 压缩口径：`mode`（full=知识型保原文表述 / 其余=命题型可大压缩，A4-6）、学科、年级；
 *   - 压缩参数：`maxCharsPerBatch` / `foldLimitChars` / `maxRounds`（改参数 → 结果会变 → 必须失效）。
 *
 * 🔒 铁律：
 *   ① **只缓存压缩结果，不缓存生成结果** —— 生成的随机性/温度不受影响；
 *   ② 缓存不进 localStorage（内存级，随会话消失），避免体积膨胀与跨会话脏数据；
 *   ③ 命中/写入只做"省一次调用"，**不改压缩口径、不改回退策略**（异常仍回退整章原文）。
 * ============================================================
 */
import { djb2 } from './hash.js';

/** 最多保留几份（按最近使用淘汰；够覆盖"同批章节反复生成"的常见场景，又不占内存） */
export const COMPRESSION_CACHE_MAX_ENTRIES = 3;
/** 单份上限字符数：超过则不缓存（防超大材料把内存吃掉；此时只是不省调用，行为不变） */
export const COMPRESSION_CACHE_MAX_CHARS = 600000;

/** key -> { text, chars, at, hits }（Map 插入序 = LRU 序） */
const _store = new Map();
let _hits = 0;
let _misses = 0;

/** 章节原文指纹 + 压缩口径 → 缓存键（纯函数，可测） */
export const buildCompressionCacheKey = ({
  sections = [], mode = '', subject = '', grade = '',
  maxCharsPerBatch = 0, foldLimitChars = 0, maxRounds = 0,
} = {}) => {
  const canon = (Array.isArray(sections) ? sections : [])
    .map((s) => `${String(s?.title || '')}\u0001${String(s?.text || '')}`)
    .join('\u0002');
  return [
    `m=${mode}`, `s=${subject}`, `g=${grade}`,
    `b=${maxCharsPerBatch}`, `f=${foldLimitChars}`, `r=${maxRounds}`,
    `len=${canon.length}`, `fp=${djb2(canon)}`,
  ].join('|');
};

/** 读缓存：命中则把该项挪到队尾（LRU），返回压缩文本；未命中返回 null */
export const readCompressionCache = (key) => {
  const hit = key ? _store.get(key) : null;
  if (!hit) { _misses += 1; return null; }
  hit.hits += 1;
  _hits += 1;
  _store.delete(key);
  _store.set(key, hit);
  return hit.text;
};

/** 写缓存：空值/超大值不缓存；超容量按 LRU 淘汰。返回是否写入成功 */
export const writeCompressionCache = (key, text) => {
  const t = String(text || '');
  if (!key || !t) return false;
  if (t.length > COMPRESSION_CACHE_MAX_CHARS) return false;
  _store.delete(key);
  _store.set(key, { text: t, chars: t.length, at: Date.now(), hits: 0 });
  while (_store.size > COMPRESSION_CACHE_MAX_ENTRIES) {
    _store.delete(_store.keys().next().value);
  }
  return true;
};

/** 清空缓存（供测试与"显式重置"使用） */
export const clearCompressionCache = () => {
  _store.clear();
  _hits = 0;
  _misses = 0;
};

/** 缓存观测（命中率 = 省下的压缩调用数 / 压缩尝试数） */
export const compressionCacheStats = () => ({
  entries: _store.size,
  hits: _hits,
  misses: _misses,
  maxEntries: COMPRESSION_CACHE_MAX_ENTRIES,
  maxChars: COMPRESSION_CACHE_MAX_CHARS,
});
