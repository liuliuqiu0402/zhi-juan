// 学科事实底线注册表（SUBJECT_FACT_DISCIPLINE）单测：
// ① 15 科 canonical 全收录（与 expertKnowledge.subjects 对齐，缺科报警）；
// ② 每科 stages 白名单合法（缺省=全部）且不超该科真实开设学段（STAGE_SUBJECTS/SUBJECT_STAGE_EXTRAS 事实源）；
// ③ 该科实际开设的核心学段（middle/high）必注入条款（防学段白名单漏配导致初中/高中无学科事实底线）；
// ④ 模板注入验证：builtin 三维度模板按 学科×学段 携带本人学科事实底线，不跨学科广播。
import { describe, it, expect } from 'vitest';
import { SUBJECT_FACT_DISCIPLINE, SUBJECT_STAGE_EXTRAS, getPromptTemplate } from '../../src/config/promptLibrary.js';
import { subjects } from '../../src/config/expertKnowledge.js';

const STAGE_KEYS = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

/** 该科在 SUBJECT_STAGE_EXTRAS 真实开设的学段集合（事实源） */
const openedStagesOf = (subject) =>
  STAGE_KEYS.filter((s) => SUBJECT_STAGE_EXTRAS[`${subject}|${s}`]);

describe('SUBJECT_FACT_DISCIPLINE 学科事实底线注册表', () => {
  it('15 科 canonical 全收录且无多余科（与 expertKnowledge.subjects 完全同名对齐）', () => {
    const keys = Object.keys(SUBJECT_FACT_DISCIPLINE);
    expect([...keys].sort()).toEqual([...subjects].sort());
  });

  it('每科 stages 合法：缺省=全部开设学段；显式白名单只能是该科真实开设学段的子集', () => {
    const bad = [];
    for (const subject of subjects) {
      const entry = SUBJECT_FACT_DISCIPLINE[subject];
      if (!entry) { bad.push(`${subject} 无事实底线注册`); continue; }
      if (!entry.text || entry.text.length < 20) bad.push(`${subject} text 缺失或过短`);
      const opened = openedStagesOf(subject);
      const stages = entry.stages || opened;
      for (const s of stages) {
        if (!STAGE_KEYS.includes(s)) bad.push(`${subject} stages 含非法学段 ${s}`);
        if (!SUBJECT_STAGE_EXTRAS[`${subject}|${s}`]) bad.push(`${subject} stages 含未开设学段 ${s}（SUBJECT_STAGE_EXTRAS 无此键）`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('核心学段必注入：该科真实开设 middle/high 时，注册表 stages 必须覆盖（缺省即覆盖）', () => {
    const bad = [];
    for (const subject of subjects) {
      const entry = SUBJECT_FACT_DISCIPLINE[subject];
      const opened = openedStagesOf(subject);
      const stages = entry.stages || opened;
      for (const core of ['middle', 'high']) {
        if (opened.includes(core) && !stages.includes(core)) {
          bad.push(`${subject} 开设 ${core} 但事实底线 stages 未覆盖（${stages.join('/')}）`);
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('stages 收敛于非空且至少覆盖一个开设学段', () => {
    const bad = [];
    for (const subject of subjects) {
      const entry = SUBJECT_FACT_DISCIPLINE[subject];
      const stages = entry.stages || openedStagesOf(subject);
      if (!stages.length) bad.push(`${subject} stages 为空`);
    }
    expect(bad).toEqual([]);
  });
});

describe('学科事实底线模板注入（builtin 三维度）', () => {
  it('按 学科×学段 携带本人学科事实底线；未开设/白名单外学段不注入', () => {
    const miss = [];
    const leak = [];
    for (const subject of subjects) {
      const entry = SUBJECT_FACT_DISCIPLINE[subject];
      const stages = entry.stages || openedStagesOf(subject);
      for (const stage of STAGE_KEYS) {
        const opened = openedStagesOf(subject);
        const tpl = getPromptTemplate({ grade: stage, subject, genType: 'practice' })?.template || '';
        if (!opened.includes(stage)) continue; // 该科该学段不开设（如低段物理），无模板可比
        const head = `【${subject}学科事实底线】`;
        const expectIn = stages.includes(stage);
        if (expectIn && !tpl.includes(head)) miss.push(`${subject}|${stage} 缺本人学科事实底线（期望注入未注入）`);
        if (!expectIn && tpl.includes(head)) leak.push(`${subject}|${stage} 白名单外学段被注入（不应注入）`);
      }
    }
    expect(miss, miss.join('\n')).toEqual([]);
    expect(leak, leak.join('\n')).toEqual([]);
  });

  it('跨学科广播防线：任一模板块只含本人学科事实底线，不携带他科条款头', () => {
    const leak = [];
    for (const subject of subjects) {
      for (const stage of openedStagesOf(subject)) {
        const tpl = getPromptTemplate({ grade: stage, subject, genType: 'practice' })?.template || '';
        for (const other of subjects) {
          if (other === subject) continue;
          if (tpl.includes(`【${other}学科事实底线】`)) {
            leak.push(`${subject}|${stage} 携带他科条款头【${other}学科事实底线】`);
          }
        }
      }
    }
    expect(leak, leak.join('\n')).toEqual([]);
  });

  it('QUALITY_BASE 统一"事实可信"底线随模板注入（全科普适，低段同样有）', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' })?.template || '';
    expect(tpl).toContain('事实可信');
    expect(tpl).toContain('无把握时不虚构');
  });
});
