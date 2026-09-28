// 🔴 2026-09-28（用户裁定·真正做到三维度）：三维度矩阵**对齐守卫**
// ============================================================
// 判据：**该学段实际开设的学科**（STAGE_SUBJECTS）——不是 15×5 全笛卡尔；
//   "小学+物理"这类组合本就不存在，入口不得产出、查表不得静默借格。
// 与 assemblyMatrix 的分工（不重复）：
//   · assemblyMatrix 管"合法 486 组合**拼出来的指令**对不对"（内容/冗余/课标/基准）；
//   · 本条管"**矩阵本身**是否四库同构 + 矩阵外行为是否留痕"——即"矩阵被谁悄悄改窄/改宽"。
// 已知缺口（原）：教辅"学科级学段要求"（stages）曾只有 6 科（物理/化学/生物/历史/地理/思想政治——
//   恰为只在初高中开设的那 6 科）；2026-09-28 已补齐其余 9 科（语文/数学/英语/科学/道德与法治/信息科技/音乐/美术/体育），
//   现 **15 科全覆盖**（各科只写该学段实际开设的档；科学不设 high、道德与法治不设 high，高中归「思想政治」）。
// ============================================================
import { describe, it, expect, vi } from 'vitest';
import { STAGE_SUBJECTS, SUBJECT_STAGE_EXTRAS } from '@/config/promptLibrary.js';
import { EXAM_BLUEPRINTS, getExamBlueprint } from '@/config/examPaperBlueprints.js';
import { TEACHING_SUBJECT_BLUEPRINTS, getTeachingBlueprint } from '@/config/teachingBlueprints.js';
import { subjectChoicesForStage } from '@/utils/libraryMetaEdit.js';

const TEACHING_TYPES = ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
const STAGE_KEYS = Object.keys(STAGE_SUBJECTS);
/** 实际开设矩阵（学段×学科）→ '学科|学段' 集合 */
const OFFERED = STAGE_KEYS.flatMap((s) => (STAGE_SUBJECTS[s] || []).map((sub) => `${sub}|${s}`));
const OFFERED_SUBJECTS = [...new Set(STAGE_KEYS.flatMap((s) => STAGE_SUBJECTS[s] || []))];
const sorted = (arr) => [...arr].sort();

describe('三维度矩阵对齐守卫（以"实际开设"为准；矩阵外不许静默）', () => {
  it('四库同构：STAGE_SUBJECTS 的 54 格 == SUBJECT_STAGE_EXTRAS == EXAM_BLUEPRINTS（一个不多一个不少）', () => {
    expect(OFFERED, '开设矩阵 54 格').toHaveLength(54);
    expect(new Set(OFFERED).size, '开设矩阵不得有重复格').toBe(54);
    expect(sorted(OFFERED), '指令库要点格须与实际开设逐格对齐').toEqual(sorted(Object.keys(SUBJECT_STAGE_EXTRAS)));
    expect(sorted(OFFERED), '卷面蓝本须与实际开设逐格对齐（不多不少）').toEqual(sorted(Object.keys(EXAM_BLUEPRINTS)));
  });

  it('教辅学科定制覆盖矩阵全部学科，且每科 8 类型栏目齐（栏目缺失/回退通用即红）', () => {
    expect(sorted(Object.keys(TEACHING_SUBJECT_BLUEPRINTS)), '教辅学科定制 = 实际开设学科全集')
      .toEqual(sorted(OFFERED_SUBJECTS));
    for (const sub of OFFERED_SUBJECTS) {
      for (const g of TEACHING_TYPES) {
        const secs = TEACHING_SUBJECT_BLUEPRINTS[sub]?.[g]?.sections;
        expect(secs?.length, `${sub}·${g} 缺学科定制栏目`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('入口学科候选 = 该学段实际开设学科（越界学科不出现在候选中）', () => {
    const labelToKey = { 小学: 'primary_low', 初中: 'middle', 高中: 'high' };
    for (const [label, key] of Object.entries(labelToKey)) {
      expect(sorted(subjectChoicesForStage(label)), `${label} 候选须等于该学段实际开设学科`)
        .toEqual(sorted(STAGE_SUBJECTS[key]));
    }
    // 越界抽查：小学候选中不得出现只在初高中开设的学科
    for (const s of ['物理', '化学', '生物', '历史', '地理', '思想政治']) {
      expect(subjectChoicesForStage('小学'), `小学不设 ${s}`).not.toContain(s);
    }
  });

  it('矩阵外组合不静默：越界查蓝本会留痕（warn + borrowedFrom），不悄悄借格', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const bp = getExamBlueprint('物理', 'primary_high'); // 现实不存在（小学不设物理）
      expect(spy, '借格必须留痕').toHaveBeenCalled();
      expect(bp?.borrowedFrom, '标记借自哪个学段').toBe('middle');
      expect(bp?.stage, '请求学段仍如实回填（不假装命中）').toBe('primary_high');
    } finally {
      spy.mockRestore();
    }
  });

  // 🔴 用户 2026-09-28 明确要求：以上收口**不得挡住合法路径**——"真正的指令必须进得到对应勾选的教材"。
  //    本用例把"合法组合绝不被误伤"钉死：54 科段逐一命中本人蓝本（不借格、不告警），教辅逐科命中学科定制。
  it('合法组合不被误伤：54 科段逐一命中本人蓝本（不借格/不告警），教辅逐科命中学科定制', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const cell of OFFERED) {
        const [subject, stage] = cell.split('|');
        const bp = getExamBlueprint(subject, stage);
        expect(bp?.key, `${cell} 须命中本人蓝本（不得落空）`).toBe(cell);
        expect(bp?.borrowedFrom, `${cell} 不得走跨学段借格`).toBeUndefined();
        const tp = getTeachingBlueprint({ genType: 'practice', stage, subject });
        expect(tp?.custom, `${cell} 教辅须命中学科定制（不回退通用）`).toBe(true);
        expect(tp?.sections?.length, `${cell} 教辅栏目须非空`).toBeGreaterThanOrEqual(2);
      }
      expect(spy, '合法组合不得产生借格告警（误伤即红）').not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('教辅"学科级学段要求"已 15 科全覆盖（缺口收窄为 0）', () => {
    const withStages = Object.keys(TEACHING_SUBJECT_BLUEPRINTS)
      .filter((s) => TEACHING_SUBJECT_BLUEPRINTS[s]?.stages);
    const withoutStages = OFFERED_SUBJECTS.filter((s) => !withStages.includes(s));
    // 已有学科级学段要求：实际开设学科全集（15 科）
    expect(sorted(withStages)).toEqual(sorted(OFFERED_SUBJECTS));
    // 缺口显式清单：空（已无学科缺学科级学段要求）
    expect(withoutStages, '15 科全覆盖：无学科缺学科级学段要求').toEqual([]);
  });
});
