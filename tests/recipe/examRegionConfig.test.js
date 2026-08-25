// 省市分值可维护测试（蓝图库面板"省市分值维护"，用户覆盖优先于内置）
// ============================================================
// 🔴 目的：锁定"省市数值不是写死不可改"的契约——
//    - setRegionOverride 保存后 getRegionConfig 用户优先
//    - getExamBlueprint 覆盖总分/时长使用用户覆盖值（120→覆盖值，板块按比例缩放）
//    - removeRegionOverride 回退内置
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setRegionOverride, removeRegionOverride, getRegionConfig,
} from '@/config/examRegionConfig.js';
import { getExamBlueprint } from '@/config/examPaperBlueprints.js';

beforeEach(() => {
  try { localStorage.removeItem('wisdom_region_config_v1'); } catch {}
});

describe('省市分值维护（用户覆盖优先）', () => {
  it('保存覆盖后 getRegionConfig 用户优先，getExamBlueprint 使用覆盖值', () => {
    // 内置：江苏·南通 语文 150
    expect(getExamBlueprint('语文', 'middle', '江苏·南通').fullScore).toBe(150);
    // 用户覆盖为 140 → 生效
    setRegionOverride('江苏·南通', 'middle', '语文', { fullScore: 140, duration: '130分钟' });
    expect(getRegionConfig()['江苏·南通'].middle['语文'].fullScore).toBe(140);
    const bp = getExamBlueprint('语文', 'middle', '江苏·南通');
    expect(bp.fullScore).toBe(140);
    expect(bp.duration).toBe('130分钟');
    // 板块和 = 新总分（末大题修正闭合）
    expect(bp.sections.reduce((s, x) => s + x.score, 0)).toBe(140);
  });

  it('删除覆盖后回退内置', () => {
    setRegionOverride('江苏·南通', 'middle', '语文', { fullScore: 140 });
    expect(removeRegionOverride('江苏·南通', 'middle', '语文')).toBe(true);
    expect(getExamBlueprint('语文', 'middle', '江苏·南通').fullScore).toBe(150);
  });
});
