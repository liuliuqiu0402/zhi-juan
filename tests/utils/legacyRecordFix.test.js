import { describe, it, expect } from 'vitest';
import {
  LEGACY_FAKE_DIFFICULTY,
  isLegacyFakeDifficulty,
  dropLegacyFakeDifficulty,
} from '@/utils/legacyRecordFix.js';

/**
 * 历史记录假难度比例清理（2026-09-15）
 * 病根：难度胶囊原先在无逐题数据时降级到硬编码 50/30/20，且配置项是死控件、默认空
 *      → 所有非整卷链路的记录都带同一组假比例，看着像统计。
 * 修法：生成端改为"无数据即 null"，存量在加载/云同步时按特征值清理。
 */
describe('legacyRecordFix: 历史假难度比例清理', () => {
  it('判据只认 50/30/20 这一组特征值', () => {
    expect(isLegacyFakeDifficulty({ easy: 50, medium: 30, hard: 20 })).toBe(true);
    expect(isLegacyFakeDifficulty({ easy: 50, medium: 30, hard: 21 })).toBe(false);
    expect(isLegacyFakeDifficulty({ easy: 49, medium: 30, hard: 20 })).toBe(false);
    expect(isLegacyFakeDifficulty(null)).toBe(false);
    expect(isLegacyFakeDifficulty(undefined)).toBe(false);
    expect(isLegacyFakeDifficulty({})).toBe(false);
  });

  it('特征值与旧兜底表达式一致（改这里等于改判据，须同步改生成端注释）', () => {
    expect(LEGACY_FAKE_DIFFICULTY).toEqual({ easy: 50, medium: 30, hard: 20 });
  });

  it('命中即清为 null 并返回清理条数', () => {
    const docs = [
      { id: 'a', difficulty: { easy: 50, medium: 30, hard: 20 } },
      { id: 'b', difficulty: { easy: 70, medium: 20, hard: 10 } },
    ];
    expect(dropLegacyFakeDifficulty(docs)).toBe(1);
    expect(docs[0].difficulty).toBeNull();
    expect(docs[1].difficulty).toEqual({ easy: 70, medium: 20, hard: 10 }); // 真实统计保留
  });

  it('已是 null / 缺字段的记录不动（幂等）', () => {
    const docs = [{ id: 'a', difficulty: null }, { id: 'b' }];
    expect(dropLegacyFakeDifficulty(docs)).toBe(0);
    expect(dropLegacyFakeDifficulty(docs)).toBe(0);
    expect(docs[0].difficulty).toBeNull();
    expect(docs[1].difficulty).toBeUndefined();
  });

  it('全量假值（用户的实际情况：一批同范围记录全是 50/30/20）全部清掉', () => {
    const docs = Array.from({ length: 6 }, (_, i) => ({
      id: `doc${i}`,
      difficulty: { easy: 50, medium: 30, hard: 20 },
    }));
    expect(dropLegacyFakeDifficulty(docs)).toBe(6);
    expect(docs.every((d) => d.difficulty === null)).toBe(true);
  });

  it('非数组输入安全返回 0（加载失败/脏数据不炸）', () => {
    expect(dropLegacyFakeDifficulty(null)).toBe(0);
    expect(dropLegacyFakeDifficulty(undefined)).toBe(0);
    expect(dropLegacyFakeDifficulty('x')).toBe(0);
  });
});
