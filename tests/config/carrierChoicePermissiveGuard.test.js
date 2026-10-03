// 🔒 常驻机检：判据式 vs 许可式残留（2026-10-03 用户裁定"要的"）
// ============================================================
// 背景（用户实测报障）：【题目自洽】⑧"同为短答一律下划线空 或 一律括号空"、⑫"默认用括号或横线空位"
//   是**旧许可式残留**，与作答位条款的**判据式**（填符号→圆括号空位、填短答→横线空位）相抵 →
//   模型按"或"自选形态（实测：照样子写句子的短句空位被并入同卷的圆括号风格，本该是横线）。
// 本守卫把这类"**形态A 或 形态B**"的选择式钉死：**全范围实发出现即红**（应改判据式：形态按所填内容定）。
// 豁免清单＝学科惯例特例（只减不增，各带理由）。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS } from '@/config/promptLibrary.js';
import { TEACHING_GEN_TYPES, buildTeachingInjection } from '@/config/teachingBlueprints.js';
import { buildUserMessageBlocks } from '@/utils/injectionManifest.js';
import { buildProgramAttach } from '@/utils/programAttach.js';

const TYPES = ['exam', ...TEACHING_GEN_TYPES];
/** 载体形态词（只取"空位/格"类，避免命中"下划线或横线"这种否定式） */
const FORM = '(横线空|括号空|下划线空|圆括号|括号|方框|圆圈|书写格|田字格|四线三格)';
const CHOICE = new RegExp(FORM + '[^，。；\\n]{0,8}或[^，。；\\n]{0,8}' + FORM);
/** 豁免（学科惯例特例；只减不增）：
 *  · 数学"算式填空位用方框或圆圈"——数学卷面惯例，□/○ 皆规范，且下游 normalizeMathCircleBlanks 统一处理 */
const EXEMPT = ['方框或圆圈'];

describe('判据式 vs 许可式残留（常驻机检）', () => {
  it('全范围实发（486×2 once/split）不得出现"形态A 或 形态B"的选择式（豁免学科惯例特例）', () => {
    const bad = [];
    for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
      for (const subject of subjects) {
        for (const genType of TYPES) {
          const t = getPromptTemplate({ grade: stage, subject, genType });
          const cell = String(t?.template || '');
          if (!cell) continue;
          for (const outputMode of ['once', 'split']) {
            const ctx = { genType, subject, stage, materialChannel: 'anchor', instructionText: cell, outputMode };
            const parts = [cell,
              buildProgramAttach({ subject, stageKey: stage, genType, instructionText: cell }) || '',
              buildTeachingInjection({ genType, stage, subject }) || ''];
            for (const b of buildUserMessageBlocks(ctx)) if (b.injected && b.text) parts.push(b.text);
            const all = parts.join('\n');
            for (const m of all.matchAll(new RegExp(CHOICE.source, 'g'))) {
              const s = m[0];
              if (EXEMPT.some((e) => e.includes(s) || s.includes(e))) continue;
              bad.push(`${subject}|${stage}|${genType}|${outputMode}: ${s}`);
            }
          }
        }
      }
    }
    expect([...new Set(bad)].slice(0, 10), '出现"形态A 或 形态B"的选择式——应改判据式（形态按所填内容定，见作答位条款）').toEqual([]);
  });

  it('反向锁：已清除的许可式短语不得回潮', () => {
    const cleared = ['一律下划线空 或 一律括号空', '默认用括号或横线空位'];
    for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
      for (const subject of subjects) {
        const cell = String(getPromptTemplate({ grade: stage, subject, genType: 'exam' })?.template || '');
        for (const c of cleared) expect(cell, `${subject}|${stage} 许可式残留不得回潮`).not.toContain(c);
      }
    }
  });
});
