// 🔒 常驻守卫：**例外/除外必须自带适用范围**（2026-10-03 用户裁定，A3）
// ============================================================
// 为什么（模型视角）：没有边界的"例外"，等于把裁量权交给模型——"谁在什么条件下不适用"没写，
//   模型只能自己猜"这道题算不算例外" → 同一份资料今天判它算、明天判它不算，**产出飘忽**
//   （与 A1"许可式"同病根：把判据换成了模型的裁量）。
// 判据（从实际 14 处文本反推，非经验臆断）：每处"例外/除外"，其 **±28 字窗口**内必须出现**条件信号**
//   （对象限定／条件连词／明确标注语）。信号清单按实测文本建，出现新式合规写法时再增列。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import { TEACHING_GEN_TYPES, buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessageBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';

/** 自带范围的两条合规写法（**自实测 4 类文本反推**，非经验臆断）：
 *  · 「X除外」——"除外"前的**对象 X** 即范围（如"（编号体系除外）"）；
 *  · 「例外：X」——冒号后的**对象/条件 X** 即范围（如"例外：同型客观小题（每题分值相同…）"）。
 *  裸「例外。」「，除外，」这类**无对象/无条件**者＝判红（模型只能自行裁量）。 */
const SCOPED = /[\u4e00-\u9fa5A-Za-z]{2,}\*{0,2}(除外|例外)|例外\*{0,2}[：:][^，。；\n]{2,}/;

describe('例外/除外必须自带适用范围', () => {
  it('全范围实发（486×2 once/split）：每处"例外/除外"须自带范围（「X除外」有对象／「例外：X」有对象条件）', () => {
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
            for (const m of all.matchAll(/例外|除外/g)) {
              const win = all.slice(Math.max(0, m.index - 28), m.index + 28);
              if (SCOPED.test(win)) continue;
              bad.push(`${genType}|${subject}|${stage}|${outputMode}: ${win.replace(/\n/g, ' ').slice(0, 56)}`);
            }
          }
        }
      }
    }
    expect([...new Set(bad)].slice(0, 10), '例外/除外未给适用范围（模型只能自行裁量 → 产出飘忽）').toEqual([]);
  });
});
