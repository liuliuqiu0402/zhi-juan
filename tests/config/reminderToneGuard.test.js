// 🔒 常驻守卫：不得出现"提醒诱导词"（2026-10-03 E2 用户裁定·铁律"不能有任何诱导，不限于提醒诱导词"）
// ============================================================
// 为什么：叮嘱口吻（务必／切记／特别提醒／请注意…）把判据降格成"提醒"——模型被"提醒着"做，
//   而不是按判据做；既占位又与"判据式、结果导向"的措辞基准相抵。历史病：自包含教辅【输出约定】里
//   一个 `【务必注意】` 小标题（270 组合），本身还是"提醒词 + 【】误用"，已删（其下两条并入【输出约定】）。
// 判据：全范围实发（正文调用 486×2 ＋ 答案页调用 486）内，**一行**不得含下列提醒词。
//   注意：`注意` 作**内容名词**（"使用注意""注意对象和场合"）不在此列——只禁**叮嘱式**组合。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS, ANSWER_ROLES, buildAnswerFormatSpec } from '../../src/config/promptLibrary.js';
import { TEACHING_GEN_TYPES, buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessageBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';

/** 提醒诱导词（叮嘱式；只减不增） */
const REMINDER = /务必|切记|谨记|特别提醒|特别提示|牢记|请注意|需要注意|要注意|应注意|提请注意|别忘|不要忘|千万|提醒/;

const SELF_CONTAINED = ['summary', 'review', 'preview', 'dictation', 'errorbook'];
const ANS_ALIGN_SELF = '答案区按正文对应的栏目组织、并与正文同构：正文题目带题号时，答案区**逐题以与正文完全相同的题号起头**（正文用「1. 2. 3.…」则答案同用同一套题号、同序；仅**子题**用 (1)(2)）；**严禁省略题号层、严禁用「(1)(2)」括号序号或纯列表代替题目题号**。不重现正文作答空位。';
const ANS_ALIGN_PLAIN = '**逐题对齐硬要求**：答案区**每个题目都以与正文完全相同的题号起头**、逐一对应（**正式考卷**正文题号全卷连续，答案区同样全卷连续；**教辅**正文按栏目（组）分别起编，答案区按相同栏目（组）分组）；大题用与正文相同的汉字序号，仅**子题**才用 (1)(2)。**逐题作答、全卷覆盖**：正文中的每一道题都必须在答案区有对应的解答与解析，不得漏题。**严禁省略题号层、严禁用「(1)(2)」括号序号或纯列表代替题目题号**。不复述题干原文（含子题题干），不重现正文作答空位。；本条（答案区与正文逐题对齐）即【尾约束·全文自洽】三域中跨处一致一项在本模式下的落地与展开。';

/** 全范围实发（正文 486×2 ＋ 答案页 486）逐行枚举 */
const buildAllLines = () => {
  const out = [];
  for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subjects) {
      for (const genType of ['exam', ...TEACHING_GEN_TYPES]) {
        const cell = String(getPromptTemplate({ grade: stage, subject, genType }).template || '');
        if (!cell) continue;
        // 正文调用（once/split）
        for (const outputMode of ['once', 'split']) {
          const key = `${genType}|${subject}|${stage}|${outputMode}`;
          const ctx = { genType, subject, stage, materialChannel: 'anchor', instructionText: cell, outputMode };
          const parts = [cell,
            buildTeachingInjection({ genType, stage, subject }) || '',
            buildProgramAttach({ subject, stageKey: stage, genType, instructionText: cell }) || ''];
          for (const b of buildUserMessageBlocks(ctx)) if (b.injected && b.text) parts.push(b.text);
          for (const line of parts.join('\n').split('\n')) out.push([key, line]);
        }
        // 答案页调用（split 第二次调用）
        const selfC = SELF_CONTAINED.includes(genType);
        const ansRole = genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType);
        const ans = [ansRole, selfC ? ANS_ALIGN_SELF : ANS_ALIGN_PLAIN, buildAnswerFormatSpec(subject)].filter(Boolean).join('\n');
        for (const line of ans.split('\n')) out.push([`${genType}|${subject}|${stage}·答案页`, line]);
      }
    }
  }
  return out;
};

describe('不得出现"提醒诱导词"（务必/切记/特别提醒…）', () => {
  it('全范围实发（正文 486×2 ＋ 答案页 486）：逐行不得含叮嘱式提醒词', () => {
    const bad = [];
    for (const [key, line] of buildAllLines()) {
      if (REMINDER.test(line)) bad.push(`${key}: ${line.replace(/\s+/g, ' ').trim().slice(0, 60)}`);
    }
    expect([...new Set(bad)].slice(0, 10), '出现提醒诱导词（应改判据式表述，不加叮嘱语气）').toEqual([]);
  });
});
