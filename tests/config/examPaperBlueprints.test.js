// 真题卷蓝本查询（getExamBlueprint）契约锁定
// ============================================================
// 2026-09-28 低风险改进：
//   ① 命中蓝本因工具库停用而返回 null 时，须 console.warn 说清"条目被停用"（不再静默无卷面结构）；
//   ② EXAM_BLUEPRINTS 无 `|all` 通配键，getExamBlueprint 的 `|all` 兜底分支为死代码 → 已清理。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getExamBlueprint, EXAM_BLUEPRINTS } from '@/config/examPaperBlueprints.js';
import { setLibToggle, clearLibToggles } from '@/utils/libToggles.js';

beforeEach(() => { clearLibToggles(); });
afterEach(() => { clearLibToggles(); vi.restoreAllMocks(); });

describe('getExamBlueprint —— 蓝本查询', () => {
  it('无学科/学段 → null；未知学科组合 → null', () => {
    expect(getExamBlueprint('', 'middle')).toBeNull();
    expect(getExamBlueprint('语文', '')).toBeNull();
    expect(getExamBlueprint('不存在的学科', 'middle')).toBeNull();
  });

  it('内置蓝本直接命中：返回含 key/subject/stage/sections 的对象', () => {
    const bp = getExamBlueprint('语文', 'primary_low');
    expect(bp).toBeTruthy();
    expect(bp.key).toBe('语文|primary_low');
    expect(Array.isArray(bp.sections)).toBe(true);
    expect(bp.sections.length).toBeGreaterThan(0);
  });

  it('🔴 无 `|all` 通配键（死分支已清理），返回值绝不会是 `|all` 组合', () => {
    expect(Object.keys(EXAM_BLUEPRINTS).some((k) => k.endsWith('|all'))).toBe(false);
    for (const key of Object.keys(EXAM_BLUEPRINTS)) {
      const [subject, stage] = key.split('|');
      const bp = getExamBlueprint(subject, stage);
      if (bp) expect(String(bp.key)).not.toContain('|all');
    }
    // 曾靠 `|all` 通配兜底的"信息科技"实为 5 档独立蓝本 → 各档精确命中，不依赖通配
    expect(getExamBlueprint('信息科技', 'middle').key).toBe('信息科技|middle');
  });
});

describe('getExamBlueprint —— 工具库停用告警（不再静默）', () => {
  it('命中蓝本被停用 → 返回 null 且 console.warn 说明"条目被停用"', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLibToggle('blueprint', '语文|primary_low', false);
    expect(getExamBlueprint('语文', 'primary_low')).toBeNull();
    const warned = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(warned).toContain('语文|primary_low');
    expect(warned).toContain('停用');
  });

  it('未停用 → 正常返回，不产生停用告警', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getExamBlueprint('语文', 'primary_low').key).toBe('语文|primary_low');
    const warned = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(warned).not.toContain('停用');
  });
});
