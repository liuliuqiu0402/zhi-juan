import { describe, it, expect, beforeEach } from 'vitest';
import { getMergedSpec, saveLayoutSpecOverride, resetLayoutSpecOverride, blankWriteScale } from '../../src/config/layoutSpec.js';
import { setLibToggle, clearLibToggles } from '../../src/utils/libToggles.js';

describe('排版规格库：规格组启停开关（停用 = 该组用户覆盖不生效，回退内置默认）', () => {
  beforeEach(() => {
    clearLibToggles();
    resetLayoutSpecOverride();
  });

  it('停用「填空规格」组 → 用户覆盖不合并（按内置默认 maxCap=16）', () => {
    saveLayoutSpecOverride({ BLANK: { maxCap: 99 } });
    // 🔧 档位收口：越界覆盖被消毒到 CSS 档位上限 24（曾可直通 99 → 产物无样式）
    expect(getMergedSpec().BLANK.maxCap).toBe(24);
    setLibToggle('layout-spec', 'blank', false);
    expect(getMergedSpec().BLANK.maxCap).toBe(16);
  });

  it('重新启用 → 用户覆盖恢复生效', () => {
    saveLayoutSpecOverride({ BLANK: { maxCap: 99 } });
    setLibToggle('layout-spec', 'blank', false);
    setLibToggle('layout-spec', 'blank', true);
    expect(getMergedSpec().BLANK.maxCap).toBe(24);
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

describe('排版规格库：空位手写系数（面 13·载体↔数量·宽度）', () => {
  beforeEach(() => {
    clearLibToggles();
    resetLayoutSpecOverride();
  });

  // 🔴 2026-10-08（台账〔138〕）：原 `sanitizeBlankSpec` 只回 4 个键、把 2026-10-05 加的
  //   `writeScaleByStage`（低段 3／其余 2）**整体丢掉** ⇒ `blankWriteScale()` 恒落兜底 2，
  //   "低段更宽"从未生效。**本锁是值锁**——原守卫（endToEndChain）是"从 blankWriteScale 派生"，
  //   自派生故分叉不报红，必须另立真值断言。
  it('🔴 blankWriteScale 按学段取真值（低段 3／其余 2；别名与兜底）', () => {
    expect(blankWriteScale('primary_low')).toBe(3);
    expect(blankWriteScale('primary_mid')).toBe(2);
    expect(blankWriteScale('primary_high')).toBe(2);
    expect(blankWriteScale('middle')).toBe(2);
    expect(blankWriteScale('high')).toBe(2);
    expect(blankWriteScale('primary')).toBe(3); // 3 档别名 → 按低段口径取 3
    expect(blankWriteScale('')).toBe(2);        // 未传/未知 → 兜底 2
  });

  it('消毒后 writeScaleByStage 仍在（含用户覆盖 BLANK 的情形——防"被消毒成空对象"）', () => {
    expect(getMergedSpec().BLANK.writeScaleByStage.primary_low).toBe(3);
    saveLayoutSpecOverride({ BLANK: { maxCap: 99 } }); // 用户只覆盖 maxCap
    expect(getMergedSpec().BLANK.maxCap).toBe(24);
    expect(getMergedSpec().BLANK.writeScaleByStage.primary_low).toBe(3); // 系数须仍透传
  });
});
