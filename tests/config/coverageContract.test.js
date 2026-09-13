// 覆盖契约（COVERAGE_CONTRACT）解析守卫：9 类型 × 契约映射的单一事实源防漂移
import { describe, it, expect } from 'vitest';
import { GEN_TYPE_NAMES } from '../../src/config/promptLibrary.js';
import { COVERAGE_CONTRACT, contractOf, COVERAGE_EXTENT, extentOf, MATERIAL_CHANNEL_DEFAULT, materialChannelOf } from '../../src/config/coverageContract.js';

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

// 🧭 覆盖扩展口径（COVERAGE_EXTENT / extentOf）——2026-09-13 新增第二维：
//    mode 回答"覆盖到什么程度"，extent 回答"清单之外还能不能加、加什么"（防一刀切放水让归纳/默写类跑出课本）
describe('覆盖扩展口径 COVERAGE_EXTENT（清单下限之外的扩展分档）', () => {
  it('契约表键与 GEN_TYPE_NAMES 完全一致（9 类，防键漂移）', () => {
    expect(Object.keys(COVERAGE_EXTENT).sort()).toEqual(Object.keys(GEN_TYPE_NAMES).sort());
    expect(Object.keys(COVERAGE_EXTENT)).toHaveLength(9);
  });

  it('分档符合已确认矩阵：题类 expand / 归纳复习 integrate / 预习默写 strict', () => {
    // 题类：可依课标补充清单外知识点或考查角度（考迁移运用）
    for (const k of ['exam', 'practice', 'special', 'reading', 'errorbook']) {
      expect(extentOf(k), k).toBe('expand');
    }
    // 归纳/复习类：可关联"已学"旧知做结构化整合（不是无边界拓展）
    for (const k of ['summary', 'review']) {
      expect(extentOf(k), k).toBe('integrate');
    }
    // 预习/默写类：守本课/守教材，不做清单外补充
    for (const k of ['preview', 'dictation']) {
      expect(extentOf(k), k).toBe('strict');
    }
  });

  it('extentOf 未知类型从严兜底为 strict（不扩散）', () => {
    expect(extentOf('unknown_type')).toBe('strict');
    expect(extentOf('')).toBe('strict');
  });

  it('三档取值合法，且"可整合"只落在全层级覆盖档（integrate 必须在 full 档）', () => {
    const LEGAL = ['expand', 'integrate', 'strict'];
    for (const [k, v] of Object.entries(COVERAGE_EXTENT)) {
      expect(LEGAL, `${k} extent=${v}`).toContain(v);
      if (v === 'integrate') {
        expect(COVERAGE_CONTRACT[k].mode, `${k} 标 integrate 但不在 full 档`).toBe('full');
      }
    }
  });
});

// 📚 素材通道默认映射（MATERIAL_CHANNEL_DEFAULT / materialChannelOf）——2026-09-14 用户定版开关：
//    资料类型 × 教材素材注入口径的单一事实源（useAiGenerator 运行时按此表 + 用户手动档解析）
describe('素材通道默认映射 MATERIAL_CHANNEL_DEFAULT（auto 口径）', () => {
  it('契约表键与 GEN_TYPE_NAMES 完全一致（9 类，防键漂移）', () => {
    expect(Object.keys(MATERIAL_CHANNEL_DEFAULT).sort()).toEqual(Object.keys(GEN_TYPE_NAMES).sort());
    expect(Object.keys(MATERIAL_CHANNEL_DEFAULT)).toHaveLength(9);
  });

  it('映射符合已确认矩阵：归纳/积累型（summary/review/preview/dictation）→ full 全文注入；命题/练习型（exam/practice/special/reading/errorbook）→ anchor 标尺注入', () => {
    // 归纳/积累型：梳理型需看整章原文（原文进指令，抑制失真）
    for (const k of ['summary', 'review', 'preview', 'dictation']) {
      expect(materialChannelOf(k), k).toBe('full');
    }
    // 命题/练习型：只给【锚点清单】+【语料锚】，不注入整章原文（抑制对教材原文的过度依赖）
    for (const k of ['exam', 'practice', 'special', 'reading', 'errorbook']) {
      expect(materialChannelOf(k), k).toBe('anchor');
    }
  });

  it('通道档位合法（full / anchor 二选一，无第三态）', () => {
    for (const [k, v] of Object.entries(MATERIAL_CHANNEL_DEFAULT)) {
      expect(['full', 'anchor'], `${k} channel=${v}`).toContain(v);
    }
  });

  it('materialChannelOf 未知类型安全兜底为 full（按"需要原文"处理，不静默丢素材）', () => {
    expect(materialChannelOf('unknown_type')).toBe('full');
    expect(materialChannelOf('')).toBe('full');
  });

  it('与覆盖契约同源分类：知识型（full 档）↔ full 通道；题类 ↔ anchor 通道', () => {
    // 全层级覆盖档四型（summary/preview/dictation/review）与 COVERAGE_CONTRACT 的 full 档一一对应；
    // 其余五型（practice/special/reading/errorbook/exam）均为标尺注入
    const fullModeTypes = ['summary', 'preview', 'dictation', 'review'];
    for (const [k, v] of Object.entries(MATERIAL_CHANNEL_DEFAULT)) {
      const expectFull = fullModeTypes.includes(k);
      expect(v === 'full', `${k} 通道=${v} 与覆盖档不一致`).toBe(expectFull);
      expect(COVERAGE_CONTRACT[k].mode === 'full', `${k} 覆盖档漂移`).toBe(expectFull);
    }
  });
});
