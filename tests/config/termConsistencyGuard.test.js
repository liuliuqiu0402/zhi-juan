// 🔒 常驻守卫：术语一致（同一概念不得同义不同名——2026-10-04 G1）
// ============================================================
// 背景（G1 全范围排查）：实发是复数——正文 486×2（once/split）＋ 答案页 486 ＋ 独立调用 10 类。
//   同一概念在实发里出现两个名字，会把"本是一件事"读成"两件事"（模型按措辞分支执行）。
//   · 作答位 / 答题位   —— 规范名＝**作答位**；`答题位` 全范围 0。
//   · 书写格 / 格子     —— 规范名＝**书写格**；裸词 `格子` 全范围 0（**专名保留**：田字格／米字格／
//     拼音格／四线三格／六线格／作文格／方格纸；活用形保留：一格／格数／格内）。
//   ⚠️ 只锁"裸词命名"，不锁专名——专名是**载体真名**（换掉＝把路走窄）。故正则用 `格子` 而非 `格`。
// 纪律：只减不增——新增条款若引入 `格子`／`答题位` 即红。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS, ANSWER_ROLES, buildAnswerFormatSpec } from '../../src/config/promptLibrary.js';
import { TEACHING_GEN_TYPES, buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessageBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';

const OUTPUT_MODES = ['once', 'split'];
const SELF_CONTAINED = ['summary', 'review', 'preview', 'dictation', 'errorbook'];
// 答案页调用的两段对齐 inline（本守卫不需要其内容，占位即可——只判术语）
const ANS_ALIGN_PLACEHOLDER = '（答案页对齐句占位）';

/** 正文生成实发：486 组合 × 2 输出模式（once/split） */
const buildAllCombos = () => {
  const out = [];
  for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subjects) {
      for (const genType of ['exam', ...TEACHING_GEN_TYPES]) {
        const cell = String(getPromptTemplate({ grade: stage, subject, genType }).template || '');
        if (!cell) continue;
        for (const outputMode of OUTPUT_MODES) {
          const ctx = { genType, subject, stage, materialChannel: 'anchor', instructionText: cell, outputMode };
          const parts = [cell,
            buildTeachingInjection({ genType, stage, subject }) || '',
            buildProgramAttach({ subject, stageKey: stage, genType, instructionText: cell }) || ''];
          for (const b of buildUserMessageBlocks(ctx)) if (b.injected && b.text) parts.push(b.text);
          out.push({ key: `${genType}|${subject}|${stage}|${outputMode}`, all: parts.join('\n') });
        }
      }
    }
  }
  return out;
};

/** 答案页独立调用实发：486 */
const buildAnswerCalls = () => {
  const out = [];
  for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subjects) {
      for (const genType of ['exam', ...TEACHING_GEN_TYPES]) {
        const cell = String(getPromptTemplate({ grade: stage, subject, genType }).template || '');
        if (!cell) continue;
        const selfC = SELF_CONTAINED.includes(genType);
        const ansRole = genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType);
        const ans = ['【正文】', '（正文）', '【答案规范】', ansRole,
          selfC ? ANS_ALIGN_PLACEHOLDER : ANS_ALIGN_PLACEHOLDER, buildAnswerFormatSpec(subject)]
          .filter(Boolean).join('\n');
        out.push({ key: `${genType}|${subject}|${stage}·答案页`, all: ans });
      }
    }
  }
  return out;
};

/** 每处命中回报"哪个组合的哪一行"，便于定位 */
const hitsOf = (docs, re) => {
  const bad = [];
  for (const { key, all } of docs) {
    for (const ln of all.split('\n')) {
      const m = ln.match(re);
      if (m) bad.push(`${key}: ${m[0]} ← ${ln.slice(0, 60)}`);
    }
  }
  return bad;
};

describe('术语一致守卫：同一概念不得同义不同名（作答位/答题位、书写格/格子）', () => {
  const combos = buildAllCombos();
  const answers = buildAnswerCalls();
  const all = [...combos, ...answers];

  it('正文 486×2 ＋ 答案页 486：全范围实发零「答题位」（规范名＝作答位）', () => {
    const bad = hitsOf(all, /答题位/);
    expect([...new Set(bad)].slice(0, 10), '「答题位」须统一为「作答位」').toEqual([]);
  });

  it('正文 486×2 ＋ 答案页 486：全范围实发零裸词「格子」（规范名＝书写格）', () => {
    const bad = hitsOf(all, /格子/);
    expect([...new Set(bad)].slice(0, 10), '裸词「格子」须统一为「书写格」（专名 田字格/米字格/拼音格/四线三格/六线格/作文格/方格纸 除外）').toEqual([]);
  });

  it('意图不得丢：规范术语仍在实发中真实承载（防"删概念以过守卫"）', () => {
    const withPos = combos.filter((d) => d.all.includes('作答位')).length;
    const withGrid = combos.filter((d) => d.all.includes('书写格')).length;
    expect(withPos, '「作答位」须在题类实发中真实出现').toBeGreaterThan(0);
    expect(withGrid, '「书写格」须在书写类实发中真实出现').toBeGreaterThan(0);
  });

  it('专名不得被误改（田字格/米字格/拼音格/四线三格/六线格/作文格/方格纸 载体真名保留）', () => {
    // 反向：若把专名一并"统一"成书写格，写字/作图类题会丢失载体真名（把路走窄）
    const yuwen = combos.filter((d) => d.key.includes('|语文|')).map((d) => d.all).join('\n');
    expect(yuwen, '语文低段书写类题须保留田字格/米字格/拼音格真名').toMatch(/田字格|米字格|拼音格/);
    const zuowen = combos.filter((d) => d.key.includes('|语文|')).map((d) => d.all).join('\n');
    expect(zuowen, '成篇成文须保留作文格真名').toContain('作文格');
  });
});
