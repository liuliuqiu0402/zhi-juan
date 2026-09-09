// 2026-09：定向 browse 索引的类型分流（covScope）
// 全覆盖口径类型（summary/review/dictation/preview/practice）注入全量【覆盖点→章节】索引；
// 抽样/聚焦型（exam/special/errorbook/reading）不注入——防索引被读成"必须逐一覆盖"清单。
import { describe, it, expect } from 'vitest';
import { FULL_COVER_GEN_TYPES, isFullCoverGenType } from '../../src/utils/covScope.js';

describe('定向 browse 索引类型分流（2026-09）', () => {
  it('全覆盖口径类型集合精确（5 类）', () => {
    expect([...FULL_COVER_GEN_TYPES].sort()).toEqual(['dictation', 'practice', 'preview', 'review', 'summary']);
  });

  it('全覆盖类型返回 true；抽样/聚焦型返回 false', () => {
    for (const t of FULL_COVER_GEN_TYPES) expect(isFullCoverGenType(t), t).toBe(true);
    for (const t of ['exam', 'special', 'errorbook', 'reading']) expect(isFullCoverGenType(t), t).toBe(false);
    expect(isFullCoverGenType('')).toBe(false);
  });
});
