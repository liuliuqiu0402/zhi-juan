// 用户蓝图栏目覆盖机制测试（g6，2026-09-27）
// ============================================================
// 🔴 目的：锁定"用户在原内置蓝图栏目上修改后，全链路读用户条目、在其基础上改"的契约——
//    - setBlueprintSectionOverride 保存后 getExamBlueprint 整组替换 sections（用户优先）
//    - note 缺省按**同名栏目从内置蓝本继承**
//    - 分值之和 ≠ 当前总分 → 等比例缩放 + 末栏修正（账目自洽）
//    - 用户覆盖后于省市覆盖（用户优先）
//    - removeBlueprintSectionOverride / 覆盖置空 → 回退内置
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setBlueprintSectionOverride, removeBlueprintSectionOverride, getUserBlueprintSections,
} from '@/config/userBlueprintOverrides.js';
import { getExamBlueprint, EXAM_BLUEPRINTS } from '@/config/examPaperBlueprints.js';

const STORAGE_KEY = 'wisdom-workshop.user-blueprint-overrides.v1';

beforeEach(() => {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
});

describe('用户蓝图栏目覆盖（用户条目优先）', () => {
  const base = getExamBlueprint('语文', 'middle'); // 内置：积累与运用24/梳理与探究10/古诗文阅读22/现代文阅读28/写作36，共120

  it('保存覆盖后 getExamBlueprint 整组替换 sections，note 缺省按同名从内置继承', () => {
    // 用户把"梳理与探究"并入"积累与运用"，并新增"综合性学习"栏
    setBlueprintSectionOverride('语文|middle', [
      { name: '积累与运用', score: 34 },
      { name: '综合性学习', score: 6 },
      { name: '古诗文阅读', score: 22 },
      { name: '现代文阅读', score: 28 },
      { name: '写作', score: 36 },
    ]);
    expect(getUserBlueprintSections('语文|middle')).toHaveLength(5);
    const bp = getExamBlueprint('语文', 'middle');
    expect(bp.sections.map((s) => s.name)).toEqual(['积累与运用', '综合性学习', '古诗文阅读', '现代文阅读', '写作']);
    expect(bp.sections.reduce((n, s) => n + s.score, 0)).toBe(bp.fullScore);
    // note 同名继承：积累与运用/古诗文阅读/现代文阅读/写作沿用内置文案；新栏名"综合性学习"无同名 → 留空不报错
    expect(bp.sections[0].note).toBe(base.sections.find((s) => s.name === '积累与运用').note);
    expect(bp.sections[1].note).toBe('');
    expect(bp.sections[4].note).toBe(base.sections.find((s) => s.name === '写作').note);
  });

  it('栏目分值之和 ≠ 总分时按比例缩放并末栏修正（账目自洽不变量）', () => {
    // 用户按比例存（如只改了栏目结构、分值沿旧 100 分口径）→ 自动换算到当前总分 120
    setBlueprintSectionOverride('语文|middle', [
      { name: '积累与运用', score: 30 },
      { name: '阅读', score: 20 },
      { name: '写作', score: 50 },
    ]);
    const bp = getExamBlueprint('语文', 'middle');
    expect(bp.sections.map((s) => s.name)).toEqual(['积累与运用', '阅读', '写作']);
    expect(bp.sections.reduce((n, s) => n + s.score, 0)).toBe(120);
  });

  it('用户覆盖后于省市覆盖（用户优先：省市缩放总分后，用户栏目仍生效且闭合到省市总分）', () => {
    // 江苏·南通 语文 middle 150 分（省市覆盖先生效）
    setBlueprintSectionOverride('语文|middle', [
      { name: '积累与运用', score: 30 },
      { name: '阅读', score: 70 },
    ]);
    const bp = getExamBlueprint('语文', 'middle', '江苏·南通');
    expect(bp.fullScore).toBe(150); // 总分仍走省市
    expect(bp.sections.map((s) => s.name)).toEqual(['积累与运用', '阅读']); // 栏目走用户
    expect(bp.sections.reduce((n, s) => n + s.score, 0)).toBe(150);
  });

  it('删除覆盖 / 覆盖置空 → 回退内置；未覆盖的 key 不受影响', () => {
    setBlueprintSectionOverride('语文|middle', [{ name: '写作', score: 120 }]);
    expect(removeBlueprintSectionOverride('语文|middle')).toBe(true);
    expect(getExamBlueprint('语文', 'middle').sections.map((s) => s.name))
      .toEqual(base.sections.map((s) => s.name));
    // 覆盖置空（传空数组）→ 等效删除
    setBlueprintSectionOverride('语文|middle', [{ name: '写作', score: 120 }]);
    expect(setBlueprintSectionOverride('语文|middle', [])).toBe(false);
    expect(getUserBlueprintSections('语文|middle')).toBeNull();
    // 只覆盖语文，数学不受影响（防串味：语文覆盖不污染数学骨架）
    setBlueprintSectionOverride('语文|middle', [{ name: '写作', score: 120 }]);
    expect(getExamBlueprint('数学', 'middle').sections.map((s) => s.name))
      .toEqual(EXAM_BLUEPRINTS['数学|middle'].sections.map((s) => s.name));
  });
});
