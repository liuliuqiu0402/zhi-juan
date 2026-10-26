// 🔒 "作答要求写在哪" —— 单源载体守卫（2026-10-19 属主质询"改动是全局的吗"后落）
// ============================================================
// 背景（真机两轮同症）：`二、用竖式计算（每题3分，共12分）` 其下又长出
//   `2. 用竖式计算下面各题，书写要规范。`——根因不是编号判据，而是**同一件事有五个出处**：
//   ① 标题须是"完整的作答要求" ② 标题须点明考查点与作答方式
//   ③ 作答说明"在本大题级统一给出" ④ 创作要求 8 允许"小组标题或说明"
//   ⑤ 【题目自洽】②"作答说明可在本大题内统一给出"
//   同时【分值标注】又禁"要求段写进标题" ⇒ 要求被挤出标题、落到标题下一行，
//   该行再被 `p.question` 当题干、题号跨大题顺排 ⇒ 1.、2.。
// 处置（2026-10-19）：载体收敛为**标题一处**；其余四处删/改。本守卫把该不变量固化：
//   · 旧载体字面 **全 486 面零出现**（回潮即红）；
//   · exam 面必须有"其下不再另起说明行"＋"落实为标题里的作答方式"；
//   · 教辅题类面（有组标题层的）必须有"题内不复述组标题"；
//   · 编号对象口径仍是**一处定义**、按内容型门控。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS, QUESTION_OBJECT_CALIBER } from '../../src/config/promptLibrary.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';

const PAIRS = Object.entries(STAGE_SUBJECTS)
  .flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));

const textOf = (genType, subject, stage) =>
  getPromptTemplate({ grade: stage, subject, genType }).template || '';

const ALL = GEN_TYPE_KEYS.flatMap((genType) =>
  PAIRS.map(({ stage, subject }) => ({ genType, stage, subject, text: textOf(genType, subject, stage) })));

/** 旧载体族：同一件事的另外四个出处（回潮即红） */
const OLD_CARRIERS = [
  '在本大题级统一给出',
  '其下不再另起作答说明',
  '小组标题或说明',
  '作答说明可在本大题内统一给出',
  '段不写进标题',
];

const CONTENT = new Set(['summary', 'preview']);
const TEACHING = new Set(['practice', 'special', 'reading', 'dictation', 'review']);
const NO_GROUP_HEADING = new Set(['errorbook']); // 块标题层，无"组标题"

describe('作答要求载体：单源（标题一处）· 全 486 面', () => {
  it('面集完整：9 类型 × 54 开设对 = 486', () => {
    expect(ALL.length).toBe(486);
  });

  it('旧载体字面全 486 面零出现（五处并行不得回潮）', () => {
    const hits = [];
    for (const f of ALL) {
      for (const o of OLD_CARRIERS) {
        if (f.text.includes(o)) hits.push(`${f.genType}|${f.subject}|${f.stage} ⇒ ${o}`);
      }
    }
    expect(hits, hits.slice(0, 5).join('\n')).toEqual([]);
  });

  it('exam 54 面：标题即作答要求（含"其下不再另起说明行"＋"大题标题就是这一组的作答要求"）', () => {
    const bad = ALL.filter((f) => f.genType === 'exam' && !(
      f.text.includes('其下不再另起说明行')
      && f.text.includes('大题标题就是这一组的作答要求')));
    expect(bad.map((f) => `${f.subject}|${f.stage}`)).toEqual([]);
  });

  it('教辅题类（practice/special/reading/dictation/review）面：组标题唯一承载（题内不复述组标题）', () => {
    const bad = ALL.filter((f) => TEACHING.has(f.genType) && !f.text.includes('题内不复述组标题'));
    expect(bad.map((f) => `${f.genType}|${f.subject}|${f.stage}`)).toEqual([]);
  });

  it('编号对象口径：一处定义；非内容型 378 面在场、内容型 108 面门控缺席', () => {
    const on = ALL.filter((f) => !CONTENT.has(f.genType));
    const off = ALL.filter((f) => CONTENT.has(f.genType));
    expect(on.length).toBe(378);
    expect(off.length).toBe(108);
    expect(on.filter((f) => !f.text.includes(QUESTION_OBJECT_CALIBER)).map((f) => `${f.genType}|${f.subject}|${f.stage}`)).toEqual([]);
    expect(off.filter((f) => f.text.includes('编号对象：')).map((f) => `${f.genType}|${f.subject}|${f.stage}`)).toEqual([]);
  });

  it('errorbook 走块标题层：不得长出"组标题"层（边界锁）', () => {
    const eb = ALL.filter((f) => NO_GROUP_HEADING.has(f.genType));
    expect(eb.length).toBe(54);
    expect(eb.filter((f) => f.text.includes('题内不复述组标题'))).toEqual([]);
  });
});
