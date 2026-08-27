import { describe, it, expect, beforeEach } from 'vitest';
import { getMergedSpec, saveLayoutSpecOverride, resetLayoutSpecOverride } from '../../src/config/layoutSpec.js';
import { setLibToggle, clearLibToggles } from '../../src/utils/libToggles.js';

describe('排版规格库：规格组启停开关（停用 = 该组用户覆盖不生效，回退内置默认）', () => {
  beforeEach(() => {
    clearLibToggles();
    resetLayoutSpecOverride();
  });

  it('停用「填空规格」组 → 用户覆盖不合并（按内置默认 maxCap=16）', () => {
    saveLayoutSpecOverride({ BLANK: { maxCap: 99 } });
    expect(getMergedSpec().BLANK.maxCap).toBe(99);
    setLibToggle('layout-spec', 'blank', false);
    expect(getMergedSpec().BLANK.maxCap).toBe(16);
  });

  it('重新启用 → 用户覆盖恢复生效', () => {
    saveLayoutSpecOverride({ BLANK: { maxCap: 99 } });
    setLibToggle('layout-spec', 'blank', false);
    setLibToggle('layout-spec', 'blank', true);
    expect(getMergedSpec().BLANK.maxCap).toBe(99);
  });

  it('停用「作文格规格」组 → 组内全部顶级字段都不合并', () => {
    saveLayoutSpecOverride({
      ZUOWEN_CELL: { primary: { widthMm: 30 } },
      ZUOWEN_MARK_STEP: { primary: 99 },
      ZUOWEN_DEFAULT_SPAN: 9,
    });
    setLibToggle('layout-spec', 'zuowen', false);
    const spec = getMergedSpec();
    expect(spec.ZUOWEN_CELL.primary.widthMm).not.toBe(30);
    expect(spec.ZUOWEN_MARK_STEP.primary).not.toBe(99);
    expect(spec.ZUOWEN_DEFAULT_SPAN).not.toBe(9);
  });

  it('停用一组不影响其他组（解答区用户覆盖仍合并）', () => {
    saveLayoutSpecOverride({ ANSWER_REGION: { 语文: { primary_low: { linePerScore: 2.5 } } } });
    setLibToggle('layout-spec', 'blank', false);
    expect(getMergedSpec().ANSWER_REGION.语文.primary_low.linePerScore).toBe(2.5);
  });
});
