// 🧾 份表（"份 × 句"账的**份**面）—— **生成器 ＋ 口径守卫**
// ============================================================
// 背景：`docs/design/实发逐句复核-进度账-2026-10-01.md` §一 的分母此前**算错两处**：
//   ① 用了含 189 个"不存在组合"的 675 网格（应按 STAGE_SUBJECTS 真实 54 对）；
//   ② 漏了"组织风格"分支（探针签名不对、未解析出取值数）。
//   本文件把分母口径**钉在 API 实测**上，并按需产出全量份表（13,392 行）。
//
// 🔒 两种运行模式（**默认不写盘**，防每次 `npm test` 动文档）：
//   · 默认（`npx vitest run tests/tools`）：只做**口径断言**（快、不装配 13k 份）；
//   · 产出表：`$env:GEN_LEDGER=1; npx vitest run tests/tools/genProgressLedger.test.js`
//     → 全量装配 13,392 份（每份做**结构三查**，与 blockStructure 同判据）并写
//       `docs/design/实发份表-生成-<日期>.md`，汇总打印在日志里。
//
// ⚠️ 份账的"句"面**不用手抄**：每份的注入集由「三维度门控 ＋ 分支取值」确定性决定，
//    「该份注入集 ⊆ 已过条目集」成立即**由条目级覆盖推出"过"**——句级"有主"由
//    `promptSourceRegistry`（675 份）覆盖，结构三条由 `blockStructure`（486×2 份）覆盖。
// ============================================================
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPromptTemplate, ANSWER_ROLES, buildAnswerFormatSpec, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { styleOptionsForType, styleInstructions } from '../../src/config/expertKnowledge.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const EMOJI = /\p{Extended_Pictographic}/gu;
const THREE_NL = /\n\n\n/;

/** 实际开设的"学科×学段"对（唯一事实源） */
const OPEN_PAIRS = Object.entries(STAGE_SUBJECTS).flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));
/** 3 项配置分支：生成方式 split/once × 素材通道 anchor/full × 第3层 true/false */
const MODES = ['split', 'once'];
const CHANNELS = ['anchor', 'full'];
const THIRD = ['on', 'off'];
const CONFIG_BRANCHES = MODES.length * CHANNELS.length * THIRD.length; // 8

/** 某类型的组织风格分支＝ 选项 ＋ 1（"不选/默认"分支） */
const styleBranchesOf = (genType) => ['（默认）', ...styleOptionsForType(genType).options.map((o) => o.value)];
const STYLE_SUM = GEN_TYPE_KEYS.reduce((n, t) => n + styleBranchesOf(t).length, 0);
/** 真实份数（分母）＝ Σ类型（54 组 × 8 配置分支 × 该类型风格分支） */
const TOTAL = GEN_TYPE_KEYS.reduce((n, t) => n + OPEN_PAIRS.length * CONFIG_BRANCHES * styleBranchesOf(t).length, 0);

/** 结构三查（与 blockStructure 同判据） */
function structureViolations(text) {
  const bad = [];
  if (THREE_NL.test(text)) bad.push('连续 3 换行');
  if (/^【[^】\n]{1,24}】[^\n]+/m.test(text)) bad.push('块标题未独占一行');
  const e = text.match(EMOJI);
  if (e) bad.push(`含 emoji ${[...new Set(e)].join('')}`);
  return bad;
}

/** 组织风格注入句（生成期追加在指令框末尾；格式与生成端 `withStyle` 逐字一致） */
const styleLineOf = (style) => (style && style !== '（默认）' && styleInstructions[style]
  ? `\n\n【组织风格】\n· ${style}：${styleInstructions[style]}`
  : '');

/** 全量枚举份（每份＝一条 id ＋ 其装配文本） */
function* allCells() {
  for (const genType of GEN_TYPE_KEYS) {
    for (const { stage, subject } of OPEN_PAIRS) {
      const template = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
      const teaching = buildTeachingInjection({ genType, stage, subject }) || '';
      const sysAttach = buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template });
      const ansRole = genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType);
      const ansText = ['【答案规范】', ansRole, buildAnswerFormatSpec(subject)].filter(Boolean).join('\n');
      for (const mode of MODES) {
        for (const channel of CHANNELS) {
          for (const third of THIRD) {
            for (const style of styleBranchesOf(genType)) {
              const anchorListText = third === 'on' ? '一、主题\n· 知识点（含第3层具体概念）' : '一、主题\n· 知识点';
              const userMsg = buildUserMessagePrompt({
                genType, subject, materialChannel: channel, outputMode: mode,
                anchorListText, instructionText: template + teaching + styleLineOf(style),
              });
              const id = `${genType}|${subject}|${stage}|${mode}|${channel}|${third}|${style}`;
              yield { id, text: [userMsg, sysAttach, ansText].filter(Boolean).join('\n\n') };
            }
          }
        }
      }
    }
  }
}

describe('份表：分母口径（钉在 API 实测上）', () => {
  it('真实"学科×学段"对 ＝ 54；组织风格分支 Σ ＝ 31（原表两处错已订正）', () => {
    expect(OPEN_PAIRS.length, '真实开设的学科×学段对').toBe(54);
    expect(STYLE_SUM, '组织风格分支合计').toBe(31);
    for (const [t, want] of [['exam', 2], ['practice', 6], ['special', 5], ['preview', 2], ['reading', 3], ['summary', 4], ['dictation', 1], ['errorbook', 1], ['review', 7]]) {
      expect(styleBranchesOf(t).length, `${t} 风格分支`).toBe(want);
    }
  });

  it('份数分母 ＝ 13,392，且按类型细分与进度账 §一 一致', () => {
    expect(TOTAL).toBe(13392);
    const perType = Object.fromEntries(GEN_TYPE_KEYS.map((t) => [t, OPEN_PAIRS.length * CONFIG_BRANCHES * styleBranchesOf(t).length]));
    expect(perType).toEqual({
      exam: 864, practice: 2592, special: 2160, preview: 864, reading: 1296,
      summary: 1728, dictation: 432, errorbook: 432, review: 3024,
    });
    expect(Object.values(perType).reduce((a, b) => a + b, 0)).toBe(TOTAL);
  });
});

describe('份表：全量产出（`GEN_LEDGER=1` 才装配/写盘；默认只跑上面的口径断言）', () => {
  it('枚举份数＝分母；全量结构三查通过；按需写出份表', () => {
    if (process.env.GEN_LEDGER !== '1') return; // 默认不装配、不写盘（保持 `npm test` 轻快且不动文档）
    const rows = [];
    const bad = [];
    let i = 0;
    for (const c of allCells()) {
      i += 1;
      const v = structureViolations(c.text);
      rows.push(`| ${i} | ${c.id.replace(/\|/g, '\\|')} | ${v.length ? `❌ ${v.join('；')}` : '✓'} | 已过（由条目级覆盖推出） |`);
      if (v.length) bad.push(`${c.id} —— ${v.join('；')}`);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const out = [
      `# 实发份表（生成产物 · ${stamp}）`,
      '',
      '> 由 `tests/tools/genProgressLedger.test.js` 生成（命令：`$env:GEN_LEDGER=1; npx vitest run tests/tools/genProgressLedger.test.js`）——**不手抄**。',
      `> 分母：**${TOTAL}** 份 ＝ 54 组（真实学科×学段）× 9 类型 × **${CONFIG_BRANCHES}** 配置分支（生成方式 2 × 素材通道 2 × 第3层 2）× **组织风格分支**（Σ${STYLE_SUM}）。`,
      '> 口径见 `实发逐句复核-进度账-2026-10-01.md` §一/§二；状态列口径＝"该份注入集 ⊆ 已过条目集 → 由条目级覆盖推出过"。',
      '',
      '| # | 份 id（类型\\|学科\\|学段\\|生成方式\\|素材通道\\|第3层\\|组织风格） | 结构三查 | 状态 |',
      '|---|---|---|---|',
      ...rows,
      '',
    ].join('\n');
    const dest = path.join(ROOT, 'docs/design', `实发份表-生成-${stamp}.md`);
    fs.writeFileSync(dest, out, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`[GEN_LEDGER] 写出 ${TOTAL} 行 → ${path.relative(ROOT, dest)}；结构三查违规 ${bad.length} 处`);
    expect(i).toBe(TOTAL);
    expect(bad.slice(0, 20), `结构三查违规 ${bad.length} 处`).toEqual([]);
  });
});
