// 工具库条目启用/停用开关测试
// ============================================================
// 🔴 目的：锁定"工具库每条内容可停用"的契约——
//    - 缺省全部启用；停用后 isLibEntryEnabled 返回 false（生成端消费点不命中）
//    - 重新启用后恢复；库间互不影响；空键直接启用
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadLibToggles, setLibToggle, isLibEntryEnabled, listDisabledEntries, clearLibToggles,
} from '@/utils/libToggles.js';

beforeEach(() => {
  clearLibToggles();
});

describe('工具库条目启用/停用开关', () => {
  it('缺省全部启用（无任何停用记录）', () => {
    expect(isLibEntryEnabled('blueprint', '语文|primary_low')).toBe(true);
    expect(loadLibToggles()).toEqual({});
    expect(listDisabledEntries('blueprint')).toEqual([]);
  });

  it('停用后不命中，重新启用恢复', () => {
    setLibToggle('blueprint', '语文|primary_low', false);
    expect(isLibEntryEnabled('blueprint', '语文|primary_low')).toBe(false);
    expect(listDisabledEntries('blueprint')).toEqual(['语文|primary_low']);
    // 重新启用
    setLibToggle('blueprint', '语文|primary_low', true);
    expect(isLibEntryEnabled('blueprint', '语文|primary_low')).toBe(true);
    expect(listDisabledEntries('blueprint')).toEqual([]);
  });

  it('库间隔离：停用一个库不影响其他库', () => {
    setLibToggle('instruction', 'primary_low|语文|exam', false);
    expect(isLibEntryEnabled('instruction', 'primary_low|语文|exam')).toBe(false);
    expect(isLibEntryEnabled('blueprint', '语文|primary_low')).toBe(true);
    expect(isLibEntryEnabled('render-contract', 'COORDINATE')).toBe(true);
  });

  it('空库名/空键直接视为启用', () => {
    expect(isLibEntryEnabled('', 'x')).toBe(true);
    expect(isLibEntryEnabled('blueprint', '')).toBe(true);
  });
});
