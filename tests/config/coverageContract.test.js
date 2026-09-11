// 覆盖契约（COVERAGE_CONTRACT）解析守卫：9 类型 × 契约映射的单一事实源防漂移
import { describe, it, expect } from 'vitest';
import { GEN_TYPE_NAMES } from '../../src/config/promptLibrary.js';
import { COVERAGE_CONTRACT, contractOf } from '../../src/config/coverageContract.js';

// ✅ A9（2026-09-11 清理）：原 `COVERAGE_MODES` / `COVERAGE_MODE_DESC` 导出已随覆盖对账/补漏 UI 废除而移除；
//    合法五档集合改由"测试侧独立期望"承担（测试本应独立编码期望值，不依赖被测模块自证），
//    契约本体仍由 `COVERAGE_CONTRACT` / `contractOf` 守卫。
const LEGAL_MODES = ['full', 'per-lesson-full', 'focus', 'none', 'sampled'];

describe('覆盖契约 COVERAGE_CONTRACT（P1）', () => {
  it('契约表键与 GEN_TYPE_NAMES 完全一致（9 类，防键漂移）', () => {
    expect(Object.keys(COVERAGE_CONTRACT).sort()).toEqual(Object.keys(GEN_TYPE_NAMES).sort());
    expect(Object.keys(COVERAGE_CONTRACT)).toHaveLength(9);
    // 契约里的中文名必须引用 GEN_TYPE_NAMES（单一事实源，禁止另写一串）
    for (const [k, c] of Object.entries(COVERAGE_CONTRACT)) {
      expect(c.name).toBe(GEN_TYPE_NAMES[k]);
    }
  });

  it('所有模式均在合法五档内（五档 = full / per-lesson-full / focus / none / sampled）', () => {
    for (const c of Object.values(COVERAGE_CONTRACT)) {
      expect(LEGAL_MODES, `${c.name} 的 mode=${c.mode}`).toContain(c.mode);
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

  it('模式→全层级要求映射（2026-09 审计固化）：全层级 = full 四型 + practice', () => {
    // full（summary/preview/dictation/review）+ per-lesson-full（practice）= 要求全层级覆盖；
    // focus（special/reading）/ none（errorbook）/ sampled（exam）= 不要求全层级
    const required = ['summary', 'preview', 'dictation', 'review', 'practice'];
    for (const [k, c] of Object.entries(COVERAGE_CONTRACT)) {
      const judge = ['full', 'per-lesson-full'].includes(c.mode);
      expect(judge, `${k} 全层级要求语义`).toBe(required.includes(k));
    }
    // ✅ A9：对账/自动补卡（旧 P2b）已废除，下面三条只锁定"类型→档位"映射本身不发生漂移
    expect(COVERAGE_CONTRACT.practice.mode).toBe('per-lesson-full');
    expect(COVERAGE_CONTRACT.special.mode).toBe('focus');
    expect(COVERAGE_CONTRACT.errorbook.mode).toBe('none');
  });
});
