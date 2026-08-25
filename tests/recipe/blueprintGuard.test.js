// 蓝本结构守卫：内置蓝本必须通过 blueprintGuard 校验（分值闭合/听力占比/大题粒度/卷面要素）
import { describe, it, expect } from 'vitest';
import { validateAllBlueprints } from '@/config/blueprintGuard.js';
import { EXAM_BLUEPRINTS } from '@/config/examPaperBlueprints.js';

describe('blueprintGuard —— 内置蓝本结构校验（源头防错）', () => {
  it('全部内置蓝本通过校验（errors 为空）', () => {
    const r = validateAllBlueprints(EXAM_BLUEPRINTS);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
