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

// ============================================================
// 2026-10-12（属主裁定·甲乙同选）：
//   中学段「大题标题即【卷面结构】块名本身」成立的前提是——**块名本身就是本学段正规卷的完整大题名**。
//   故块名**不得为省去"题"字的简称**（否则照抄会得到"一、判断（10分）"这种不完整标题）。
//   🔴 科学|middle 原有 `选择/填空/判断/实验探究/综合运用` 属**唯一一处简称**（其余中学段档都是"X题"形态）
//      ⇒ 已补全为 `选择题/填空题/判断题/实验探究题/综合运用题`（并已在 `bigTitleRule` 中学段分支加兜底口径）。
// ============================================================
describe('中学段蓝本块名 —— 须为完整大题名（非"省去题字的简称"）', () => {
  // 例外：课标**领域名**（本身不是"题"）可作大题标题（与 bigTitleRule 的"领域名直接作大题标题"一致）
  const DOMAIN_NAMES = new Set(['阅读', '语言文字运用', '写作', '听力', '完形填空', '阅读理解',
    '词汇运用', '语法填空', '书面表达', '积累与运用', '梳理与探究', '古诗文阅读', '现代文阅读',
    '识字与写字', '表达与交流', '阅读与鉴赏']);

  it('中学段（middle/high）各档块名：要么是"X题"形态，要么是课标领域名（不得为简称）', () => {
    const bad = [];
    for (const [key, bp] of Object.entries(EXAM_BLUEPRINTS)) {
      const stage = key.split('|')[1];
      if (stage !== 'middle' && stage !== 'high') continue;
      for (const s of (bp.sections || [])) {
        if (DOMAIN_NAMES.has(s.name)) continue;
        if (!s.name.endsWith('题')) bad.push(`${key} → ${s.name}`);
      }
    }
    expect(bad, '中学段块名不得为省去"题"字的简称').toEqual([]);
  });

  it('🔴 反向锁：科学|middle 的旧简称不得回潮', () => {
    const names = (EXAM_BLUEPRINTS['科学|middle'].sections || []).map((s) => s.name);
    expect(names).toContain('选择题');
    expect(names).toContain('填空题');
    expect(names).toContain('判断题');
    expect(names).toContain('实验探究题');
    expect(names).toContain('综合运用题');
    for (const old of ['选择', '填空', '判断', '实验探究', '综合运用']) {
      expect(names, `旧简称 ${old} 不得回潮`).not.toContain(old);
    }
  });
});
