// 🔒 常驻机检：强推力句须自带限定（"在语境中呈现／考查" → 必须"留空"或"不留答案"）
// ============================================================
// 背景（2026-10-03 用户质询 ＋ 伤情②实证）：蓝图 note 的"在语境中考查"是**推力**，与【题目自洽】⑰
//   （题干／材料不得出现待作答内容）**相抵**——模型会把待写内容写进语境句（伤情②："小蝌蚪……快活地游来游去"）。
//   根治＝**把推力句写完整**：内容型（默写/积累）→"在语境中**留空**呈现"；题类（试卷/教辅）→"在语境中考查**（不留答案）**"。
// 判据（可独立核对）：实发中每一处"在语境中呈现/考查"，其后 24 字内必须出现"留空"或"不留答案"。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import { TEACHING_GEN_TYPES, buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessageBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';

describe('强推力句须自带限定（在语境中呈现/考查 → 留空／不留答案）', () => {
  it('全范围实发（486×2 once/split）：每一处"在语境中呈现/考查"都不得裸奔', () => {
    const bad = [];
    for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
      for (const subject of subjects) {
        for (const genType of ['exam', ...TEACHING_GEN_TYPES]) {
          const cell = String(getPromptTemplate({ grade: stage, subject, genType }).template || '');
          if (!cell) continue;
          for (const outputMode of ['once', 'split']) {
            const ctx = { genType, subject, stage, materialChannel: 'anchor', instructionText: cell, outputMode };
            const parts = [cell,
              buildTeachingInjection({ genType, stage, subject }) || '',
              buildProgramAttach({ subject, stageKey: stage, genType, instructionText: cell }) || ''];
            for (const b of buildUserMessageBlocks(ctx)) if (b.injected && b.text) parts.push(b.text);
            const all = parts.join('\n');
            for (const m of all.matchAll(/在语境中(呈现|考查)/g)) {
              const tail = all.slice(m.index, m.index + 24);
              if (tail.includes('留空') || tail.includes('不留答案')) continue;
              bad.push(`${genType}|${subject}|${stage}|${outputMode}: ${tail.slice(0, 30).replace(/\n/g, ' ')}`);
            }
          }
        }
      }
    }
    expect([...new Set(bad)].slice(0, 10), '强推力句裸奔（须写完整：留空呈现／不留答案）').toEqual([]);
  });
});
