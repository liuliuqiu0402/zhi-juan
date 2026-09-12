// ✅ A4-11（2026-09-12）：原文压缩结果缓存 —— 按勾选章节组合复用，省一次压缩调用与等待
// 契约：key 编码"章节组合/顺序 + 每章原文 + 压缩口径"，任一变化即失效；只缓存压缩结果，不缓存生成结果。
import { describe, it, expect, beforeEach } from 'vitest';
import {
  COMPRESSION_CACHE_MAX_ENTRIES,
  COMPRESSION_CACHE_MAX_CHARS,
  buildCompressionCacheKey,
  readCompressionCache,
  writeCompressionCache,
  clearCompressionCache,
  compressionCacheStats,
} from '../../src/utils/compressionCache.js';

const secA = { title: '第一单元 1～6的表内乘法', text: '乘法的意义：求几个相同加数的和……' };
const secB = { title: '第二单元 表内除法', text: '平均分：把一些物品分成几份……' };
const base = { sections: [secA], mode: 'condense', subject: '数学', grade: '二年级' };

describe('A4-11 压缩缓存键：章节组合与压缩口径决定命中', () => {
  it('同章节组合 + 同口径 → 键相同（可命中）', () => {
    const k1 = buildCompressionCacheKey({ ...base, sections: [secA, secB] });
    const k2 = buildCompressionCacheKey({ ...base, sections: [{ ...secA }, { ...secB }] });
    expect(k1).toBe(k2);
  });

  it('换章 / 改原文 / 改顺序 → 键不同（必须失效重压）', () => {
    const k = buildCompressionCacheKey({ ...base, sections: [secA, secB] });
    expect(buildCompressionCacheKey({ ...base, sections: [secA] })).not.toBe(k);
    expect(buildCompressionCacheKey({ ...base, sections: [{ ...secA, text: '改了原文' }, secB] })).not.toBe(k);
    expect(buildCompressionCacheKey({ ...base, sections: [secB, secA] })).not.toBe(k); // 章序 = 原文章序，顺序变即不同
    expect(buildCompressionCacheKey({ ...base, sections: [{ ...secA, title: '换了章名' }, secB] })).not.toBe(k);
  });

  it('改压缩口径（mode/学科/年级）→ 键不同（知识型保原文 vs 命题型大压缩 不可混用）', () => {
    const k = buildCompressionCacheKey({ ...base, sections: [secA] });
    expect(buildCompressionCacheKey({ ...base, sections: [secA], mode: 'full' })).not.toBe(k);
    expect(buildCompressionCacheKey({ ...base, sections: [secA], subject: '语文' })).not.toBe(k);
    expect(buildCompressionCacheKey({ ...base, sections: [secA], grade: '三年级' })).not.toBe(k);
  });

  it('改压缩参数（批预算/折叠上限/轮次）→ 键不同', () => {
    const k = buildCompressionCacheKey({ ...base, sections: [secA] });
    expect(buildCompressionCacheKey({ ...base, sections: [secA], maxCharsPerBatch: 1000 })).not.toBe(k);
    expect(buildCompressionCacheKey({ ...base, sections: [secA], foldLimitChars: 9000 })).not.toBe(k);
    expect(buildCompressionCacheKey({ ...base, sections: [secA], maxRounds: 1 })).not.toBe(k);
  });

  it('空输入安全：无 sections 也能出键（不抛错）', () => {
    expect(typeof buildCompressionCacheKey({})).toBe('string');
    expect(typeof buildCompressionCacheKey()).toBe('string');
  });
});

describe('A4-11 压缩缓存读写：命中复用、LRU 淘汰、边界不缓存', () => {
  beforeEach(() => clearCompressionCache());

  it('写入后同键读出同一份文本（第二次生成直接复用）', () => {
    const k = buildCompressionCacheKey({ ...base, sections: [secA] });
    expect(writeCompressionCache(k, '压缩后的原文')).toBe(true);
    expect(readCompressionCache(k)).toBe('压缩后的原文');
  });

  it('未命中返回 null，并计入 misses；命中计入 hits', () => {
    const k = buildCompressionCacheKey({ ...base, sections: [secA] });
    expect(readCompressionCache(k)).toBeNull();
    writeCompressionCache(k, 'X');
    readCompressionCache(k);
    const st = compressionCacheStats();
    expect(st.misses).toBe(1);
    expect(st.hits).toBe(1);
    expect(st.entries).toBe(1);
  });

  it('LRU：超出容量淘汰最久未使用的一份（容量=' + COMPRESSION_CACHE_MAX_ENTRIES + '）', () => {
    const keys = ['甲', '乙', '丙', '丁'].map((t) =>
      buildCompressionCacheKey({ ...base, sections: [{ title: t, text: t }] }));
    keys.forEach((k, i) => writeCompressionCache(k, `文本${i}`));
    expect(compressionCacheStats().entries).toBe(COMPRESSION_CACHE_MAX_ENTRIES);
    expect(readCompressionCache(keys[0])).toBeNull();            // 最旧的「甲」被淘汰
    expect(readCompressionCache(keys[3])).toBe('文本3');          // 最新保留
  });

  it('命中会刷新 LRU 位置：再次写入后仍不被淘汰', () => {
    const keys = ['甲', '乙', '丙'].map((t) =>
      buildCompressionCacheKey({ ...base, sections: [{ title: t, text: t }] }));
    keys.forEach((k, i) => writeCompressionCache(k, `文本${i}`));
    readCompressionCache(keys[0]);                                // 甲 变最近使用
    writeCompressionCache(buildCompressionCacheKey({ ...base, sections: [{ title: '丁', text: '丁' }] }), '文本3');
    expect(readCompressionCache(keys[0])).toBe('文本0');          // 甲 存活
    expect(readCompressionCache(keys[1])).toBeNull();             // 乙 被淘汰
  });

  it('空值与超大值不缓存（不省调用，但行为不变）', () => {
    const k = buildCompressionCacheKey({ ...base, sections: [secA] });
    expect(writeCompressionCache(k, '')).toBe(false);
    expect(writeCompressionCache('', '文本')).toBe(false);
    expect(writeCompressionCache(k, 'x'.repeat(COMPRESSION_CACHE_MAX_CHARS + 1))).toBe(false);
    expect(compressionCacheStats().entries).toBe(0);
  });

  it('清空：clearCompressionCache 后无条目、统计归零', () => {
    const k = buildCompressionCacheKey({ ...base, sections: [secA] });
    writeCompressionCache(k, '文本');
    readCompressionCache(k);
    clearCompressionCache();
    expect(compressionCacheStats()).toMatchObject({ entries: 0, hits: 0, misses: 0 });
    expect(readCompressionCache(k)).toBeNull();
  });
});
