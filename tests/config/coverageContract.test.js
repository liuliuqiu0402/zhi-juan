// 覆盖契约（COVERAGE_CONTRACT）解析守卫：9 类型 × 契约映射的单一事实源防漂移
import { describe, it, expect } from 'vitest';
import { GEN_TYPE_NAMES } from '../../src/config/promptLibrary.js';
import { COVERAGE_MODES, COVERAGE_MODE_DESC, COVERAGE_CONTRACT, contractOf } from '../../src/config/coverageContract.js';

describe('覆盖契约 COVERAGE_CONTRACT（P1）', () => {
  it('契约表键与 GEN_TYPE_NAMES 完全一致（9 类，防键漂移）', () => {
    expect(Object.keys(COVERAGE_CONTRACT).sort()).toEqual(Object.keys(GEN_TYPE_NAMES).sort());
    expect(Object.keys(COVERAGE_CONTRACT)).toHaveLength(9);
    // 契约里的中文名必须引用 GEN_TYPE_NAMES（单一事实源，禁止另写一串）
    for (const [k, c] of Object.entries(COVERAGE_CONTRACT)) {
      expect(c.name).toBe(GEN_TYPE_NAMES[k]);
    }
  });

  it('所有模式均在合法五档内，且档位语义描述齐全', () => {
    for (const c of Object.values(COVERAGE_CONTRACT)) {
      expect(COVERAGE_MODES).toContain(c.mode);
      expect(typeof COVERAGE_MODE_DESC[c.mode]).toBe('string');
      expect(COVERAGE_MODE_DESC[c.mode].length).toBeGreaterThan(5);
    }
  });

  it('类型→档位映射符合已确认矩阵', () => {
    const modeOf = (k) => COVERAGE_CONTRACT[k].mode;
    // 知识型 = full
    expect(modeOf('summary')).toBe('full');
    expect(modeOf('preview')).toBe('full');
    expect(modeOf('dictation')).toBe('full');
    expect(modeOf('review')).toBe('full');
    // 课时练 = 逐课全量（复生成单课达标、单生成整课并集）
    expect(modeOf('practice')).toBe('per-lesson-full');
    // 专项/阅读 = 聚焦
    expect(modeOf('special')).toBe('focus');
    expect(modeOf('reading')).toBe('focus');
    // 错题本 = 不对账
    expect(modeOf('errorbook')).toBe('none');
    // 正式考卷 = 抽样（双向细目表语义，不补漏）
    expect(modeOf('exam')).toBe('sampled');
  });

  it('contractOf 未知类型安全兜底为 none（不对账，不误伤）', () => {
    expect(contractOf('unknown_type')).toMatchObject({ mode: 'none' });
    expect(contractOf('exam').mode).toBe('sampled');
  });

  it('判缺分层（2026-09 审计固化）：required=full四型+practice；自动补卡仅限知识型', () => {
    // full（summary/preview/dictation/review）+ per-lesson-full（practice）判缺（reconcileCoverage required）；
    // focus（special/reading）/none（errorbook）/sampled（exam）不判缺
    const required = ['summary', 'preview', 'dictation', 'review', 'practice'];
    for (const [k, c] of Object.entries(COVERAGE_CONTRACT)) {
      const judge = ['full', 'per-lesson-full'].includes(c.mode);
      expect(judge, `${k} 判缺语义`).toBe(required.includes(k));
    }
    // 自动补卡（useAiGenerator P2b）仅 full 知识梳理型（缺考点=梳理缺块，补要点卡合理）；
    // practice（per-lesson-full）缺漏只经覆盖对账提示——课时练插入"考点回顾卡"=形态污染（2026-09 实证）
    expect(COVERAGE_CONTRACT.practice.mode).toBe('per-lesson-full');
    expect(COVERAGE_CONTRACT.special.mode).toBe('focus');
    expect(COVERAGE_CONTRACT.errorbook.mode).toBe('none');
  });
});
