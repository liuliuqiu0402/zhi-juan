// ============================================================
// 配置维度轴守卫（2026-10-13 增·B 抽样"配置维度覆盖"固化）
// ------------------------------------------------------------
// 为什么要它：486 面是**默认配置层**。锚表门只锁"默认档每面装配在场"，**锁不住**
//   "换配置后该变的变了没 / 不该变的动没动"。若无人守，两向都会腐化：
//     · 该变的没变（卷别点了不生效、范围名不进场）⇒ 用户设了等于没设；
//     · 不该变的乱变（范围档位偷偷进指令）⇒ 486 面结论静默失效、且引入未登记变量。
//   本守卫把两条轴**双向**锁住，并把"库启停"锁成**真拨开关**（不是读源码推断）。
// 「应有」来源纪律（判法 §七）：一律取自**规格/映射表**（EXAM_SCOPE_TO_STAGE / 蓝图数据 /
//   水平映射表 / 标签词池 / 模板占位符），**不取自被测函数自身** ⇒ 不当同义反复自证。
// 与运行器关系：`scripts/sampleConfigAxes.mjs`（人工取证·打印"应有 vs 实有"）；
//   本文件＝同一批判据的 CI 版（红即阻断）。
// ============================================================
import { describe, it, expect, afterAll } from 'vitest';
import { buildInstructionText } from '../../scripts/instructionText.mjs';
import { EXAM_SCOPE_TO_STAGE } from '../../src/config/blueprintProvider.js';
import { getExamBlueprint } from '../../src/config/examPaperBlueprints.js';
import { buildStructureText, getPromptTemplate } from '../../src/config/promptLibrary.js';
import { gaokaoLevelOf, hegeLevelOf } from '../../src/config/levelMapping.js';
import { inferPaperScope, SCOPE_LABEL_POOLS } from '../../src/config/paperScope.js';
import { extentOf } from '../../src/config/coverageContract.js';
import { clearLibToggles, setLibToggle } from '../../src/utils/libToggles.js';

const NINE = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
const scoreOf = (t) => ((t.match(/（满分(\d+)分(，时长([^）]*))?）/) || [])[1] || '');
const durOf = (t) => ((t.match(/（满分(\d+)分(，时长([^）]*))?）/) || [])[3] || '');
const levelOf = (t) => (t.match(/对标学业质量(水平[一二三四]|水平二与水平三)/) || [])[1] || '';

afterAll(() => { try { clearLibToggles(); } catch {} });

describe('配置维度轴·L1 卷别（升学卷别→蓝本分档 ＋ 高中卷别→学业质量水平）', () => {
  const CASES = [
    ['语文', 'middle', '', 'middle'],
    ['语文', 'middle', 'zhongkao', 'middle'],
    ['语文', 'middle', 'gaokao', 'high'],
    ['语文', 'high', 'zhongkao', 'middle'],
    ['语文', 'primary_high', 'xiaoshengchu', 'primary_high'],
    ['数学', 'high', 'gaokao', 'high'],
    ['化学', 'high', 'gaokao', 'high'],
  ];

  it('① 卷面结构/满分/时长＝「卷别→学段档」映射出的那份蓝图（不是所选教材学段默认档）', () => {
    for (const [subject, stage, scope, wantStage] of CASES) {
      expect(EXAM_SCOPE_TO_STAGE[scope] || stage, `${subject}×${stage}×${scope} 应到档`).toBe(wantStage);
      const ebp = getExamBlueprint(subject, wantStage, '');
      const text = buildInstructionText('exam', subject, stage, { scopeType: scope });
      expect(scoreOf(text), `${subject}×${stage}×${scope} 满分`).toBe(String(ebp.fullScore));
      expect(durOf(text), `${subject}×${stage}×${scope} 时长`).toBe(String(ebp.duration || ''));
      expect(text.includes(buildStructureText(ebp)), `${subject}×${stage}×${scope} 结构段须真进指令`).toBe(true);
    }
  });

  it('② 高中正式卷：卷别→学业质量水平（高考／合格考）与水平映射表逐字一致', () => {
    const mathGk = buildInstructionText('exam', '数学', 'high', { scopeType: 'gaokao' });
    const mathHg = buildInstructionText('exam', '数学', 'high');
    expect(levelOf(mathGk)).toBe(gaokaoLevelOf('数学', 'high'));
    expect(levelOf(mathHg)).toBe(hegeLevelOf('数学', 'high'));
    expect(levelOf(mathGk)).not.toBe(levelOf(mathHg)); // 两档必须可分（否则"卷别点了不生效"）
    const chemGk = buildInstructionText('exam', '化学', 'high', { scopeType: 'gaokao' });
    expect(levelOf(chemGk)).toBe(gaokaoLevelOf('化学', 'high'));
  });

  it('③ 非高中不注入水平（义务教育无水平级）', () => {
    for (const stage of ['primary_low', 'primary_mid', 'primary_high', 'middle']) {
      const t = buildInstructionText('exam', '语文', stage, { scopeType: 'gaokao' });
      expect(t.includes('学业质量水平'), `${stage} 不应注入学业质量水平`).toBe(false);
    }
  });

  it('④ 升学卷别**仅正式卷生效**：非 exam 传卷别须与不传逐字相同', () => {
    for (const g of NINE.filter((x) => x !== 'exam')) {
      const base = buildInstructionText(g, '语文', 'high');
      const withGk = buildInstructionText(g, '语文', 'high', { scopeType: 'gaokao' });
      expect(withGk === base, `${g} 不应受升学卷别影响`).toBe(true);
    }
  });
});

describe('配置维度轴·L1′ 范围（档位不驱动装配 ⇔ 范围名文本经占位符入场）', () => {
  it('⑤ 范围档位（期中/期末/月考/专题）**不是指令参数**：9 类型逐字不变', () => {
    for (const sc of ['midterm', 'final', 'monthly', 'topic']) {
      for (const g of NINE) {
        const base = buildInstructionText(g, '语文', 'primary_high');
        const withScope = buildInstructionText(g, '语文', 'primary_high', { scopeType: sc });
        expect(withScope === base, `${g}×${sc} 不应改变指令装配`).toBe(true);
      }
    }
  });

  it('⑥ 范围名在**命名层**生效：显式范围维度 ⇒ 标签词池（标题/文件名落点）', () => {
    for (const sc of ['midterm', 'final', 'monthly', 'topic']) {
      const r = inferPaperScope([], [], sc);
      expect(r.isScopeLabel, `${sc} 应判为范围标签`).toBe(true);
      expect(SCOPE_LABEL_POOLS[sc], `${sc} 标签池须非空`).toContain(r.name);
    }
  });

  it('⑦ 范围名文本进场 ⇔ 模板含 {unit}/{scope} 占位符（两向对账，防"以为会进、其实不进"）', () => {
    const name = SCOPE_LABEL_POOLS.midterm[0];
    for (const g of NINE) {
      const tpl = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: g }).template;
      const hasPh = /\{(unit|scope)\}/.test(String(tpl || ''));
      const base = buildInstructionText(g, '语文', 'primary_high');
      const withName = buildInstructionText(g, '语文', 'primary_high', { unit: name });
      const changed = withName !== base;
      expect(changed, `${g}：占位符=${hasPh ? '有' : '无'} ⇒ 文本应变${hasPh ? '化' : '不变化'}`).toBe(hasPh);
      if (hasPh) expect(withName.includes(name), `${g} 应含范围名文本`).toBe(true);
    }
  });
});

describe('配置维度轴·覆盖范围档 ⇔ 卷面蓝本备注（P1 判据：是"合规扩张"还是"与范围相抵"）', () => {
  it('⑩ 覆盖范围档取值表：expand／integrate／strict 三档归类稳定', () => {
    const EXPAND = ['exam', 'practice', 'special', 'reading', 'errorbook'];
    const INTEGRATE = ['summary', 'review'];
    const STRICT = ['preview', 'dictation'];
    for (const g of EXPAND) expect(extentOf(g), `${g} 应 expand`).toBe('expand');
    for (const g of INTEGRATE) expect(extentOf(g), `${g} 应 integrate`).toBe('integrate');
    for (const g of STRICT) expect(extentOf(g), `${g} 应 strict`).toBe('strict');
  });

  it('⑪ 正式卷＝expand ⇒ "可另取其他知识点或考查角度"原句须在场（这是蓝本领域字样的**授权依据**）', () => {
    for (const [s, st] of [['物理', 'middle'], ['数学', 'high'], ['语文', 'primary_high']]) {
      const t = buildInstructionText('exam', s, st);
      expect(extentOf('exam')).toBe('expand');
      expect(t.includes('另取其他知识点或考查角度'), `exam·${s}×${st} 缺 expand 授权句 ⇒ 蓝本领域字样将成"相抵"`).toBe(true);
      expect(t.includes('不臆断学生是否已学'), '旧封禁句不得回归').toBe(false);
    }
  });

  it('⑫ 卷面蓝本备注**只在正式卷**注入（教辅面不得消费卷面蓝本 note）', () => {
    const NOTES = ['力学与电学综合', '力学综合与电磁学综合', '4选1，涉及数与式'];
    for (const g of NINE.filter((x) => x !== 'exam')) {
      for (const [s, st] of [['物理', 'middle'], ['物理', 'high'], ['数学', 'middle']]) {
        const t = buildInstructionText(g, s, st);
        for (const n of NOTES) expect(t.includes(n), `${g}·${s}×${st} 不应含卷面蓝本备注「${n}」`).toBe(false);
      }
    }
  });
});

describe('配置维度轴·L5 库启停（真拨开关：停用⇒不注入；恢复⇒逐字回基线）', () => {
  it('⑧ 停用蓝图条目 ⇒ 卷面结构段缺席＋满分缺席（落兜底）；恢复 ⇒ 逐字回基线', () => {
    clearLibToggles();
    const key = '语文|primary_low';
    const base = buildInstructionText('exam', '语文', 'primary_low');
    const structText = buildStructureText(getExamBlueprint('语文', 'primary_low', '')); // 须在停用前取
    try {
      setLibToggle('blueprint', key, false);
      const off = buildInstructionText('exam', '语文', 'primary_low');
      expect(off.includes(structText), '停用后结构段不得仍在场').toBe(false);
      expect(scoreOf(off), '停用后满分不得仍在场').toBe('');
      expect(off.includes('（按教材内容合理设计大题）'), '停用后应落模板兜底').toBe(true);
      expect(off !== base, '停用须真的改变装配（否则开关无效）').toBe(true);
    } finally {
      setLibToggle('blueprint', key, true);
    }
    expect(buildInstructionText('exam', '语文', 'primary_low') === base, '恢复后须逐字回基线').toBe(true);
  });

  it('⑨ 停用指令 cell ⇒ 模板落下一级且非空；恢复 ⇒ 逐字回基线（开关是唯一变量）', () => {
    clearLibToggles();
    const cell = 'primary_low|语文|exam';
    const base = buildInstructionText('exam', '语文', 'primary_low');
    try {
      setLibToggle('instruction', cell, false);
      const off = buildInstructionText('exam', '语文', 'primary_low');
      expect(off !== base, '停用 cell 后须落下一级模板').toBe(true);
      expect(off.trim().length > 0, '落下一级仍须非空（不得静默成空指令）').toBe(true);
    } finally {
      setLibToggle('instruction', cell, true);
    }
    expect(buildInstructionText('exam', '语文', 'primary_low') === base, '恢复后须逐字回基线').toBe(true);
  });
});
