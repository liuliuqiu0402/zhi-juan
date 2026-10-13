#!/usr/bin/env node
/**
 * 486 面全量快照重生成（可复现）＋ **L1 汇总报告**（同一入口，收 C-3）
 *
 * 为什么需要它：任何**改指令源**（`src/config/promptLibrary.js` / `teachingBlueprints.js` /
 * `specialDomains.js` …）之后，`docs/audit/snapshot-all/` 里的快照即**过期**——
 * 送审/核证若仍读旧快照，会把"已修的问题"再报一遍或漏掉新问题。
 * 故本脚本作为**唯一的重生成入口**（逐面等值于 `scripts/snapshotInjection.mjs`，只是批量）。
 *
 * 🔴 2026-10-13（第 3 批核证·收 C-3）：原 `_L1-report.txt` **无任何脚本生成**（复核方已指出它是"历史件"、
 *   挂在锚单源注释旁易被误读为现状）。现把**报告生成并入本入口**：在**最终快照状态**上重出，
 *   带**生成时间戳**，计数口径＝**指令文本（不含 `#` 头部与 `=====` 结构行）**，与 `l1Anchors.mjs` **同源**。
 *
 * 面集来源（唯一事实源）：`src/config/promptLibrary.js` 的 `STAGE_SUBJECTS` × 9 类资料类型。
 * 输出目录：`SNAPSHOT_DIR`（默认 `docs/audit/snapshot-all`）。
 *
 * 用法：
 *   node scripts/regenerateSnapshots.mjs               # 全部 486 面 ＋ 报告
 *   node scripts/regenerateSnapshots.mjs --report-only # 只按现有快照重出报告（不重生成）
 *   node scripts/regenerateSnapshots.mjs 信息科技       # 只重生成某学科（调试用）
 *   node scripts/regenerateSnapshots.mjs 信息科技 dictation
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STAGE_SUBJECTS } from '../src/config/promptLibrary.js';
import { anchorsFor } from './l1Anchors.mjs';
import { findBlueprint } from '../src/config/blueprintProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.SNAPSHOT_DIR || 'docs/audit/snapshot-all';
const OUT_ABS = path.resolve(ROOT, OUT);

const GEN_TYPES = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];

const args = process.argv.slice(2);
const reportOnly = args.includes('--report-only');
const [onlySubject, onlyType] = args.filter((a) => !a.startsWith('-'));

if (!reportOnly) {
  const pairs = [];
  for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subjects) {
      if (onlySubject && subject !== onlySubject) continue;
      for (const genType of GEN_TYPES) {
        if (onlyType && genType !== onlyType) continue;
        pairs.push({ stage, subject, genType });
      }
    }
  }

  fs.mkdirSync(OUT_ABS, { recursive: true });

  let ok = 0;
  const failed = [];
  const t0 = Date.now();
  for (const p of pairs) {
    const r = spawnSync(
      process.execPath,
      ['scripts/snapshotInjection.mjs', `type=${p.genType}`, `subject=${p.subject}`, `stage=${p.stage}`],
      { cwd: ROOT, env: { ...process.env, SNAPSHOT_DIR: OUT }, encoding: 'utf8' },
    );
    if (r.status === 0) ok += 1;
    else failed.push(`${p.subject}|${p.stage}|${p.genType} ⇒ ${(r.stderr || '').trim().split('\n').slice(-1)[0] || 'exit ' + r.status}`);
  }

  console.log(`快照重生成：${ok}/${pairs.length} 成功（${((Date.now() - t0) / 1000).toFixed(1)}s）⇒ ${OUT}`);
  if (failed.length) {
    console.error(`失败 ${failed.length}：\n  · ${failed.join('\n  · ')}`);
    process.exitCode = 1;
  }
}

// ── L1 汇总报告（在**最终状态**上重出；与 l1Anchors.mjs 同源）──
// 🔴 2026-10-13（口径更正·**与门同源**）：`hasStructure` **必须按门的方式推导**——
//   `!!findBlueprint({ genType, subject, stage, region: '', scopeType: '' })`（同 `tests/config/l1AnchorGate.test.js:71`）。
//   我首次写报告时传了 `hasStructure: null`，导致依赖该前件的锚（如 T19·G9 抽样口径正句）
//   期望值被算成 0 ⇒ 报出 3 个**假 ✗**（门为绿）。**教训：报告口径必须与门逐字同源，否则两处结论相抵。**
const hasStructureOf = ({ genType, subject, stage }) =>
  !!findBlueprint({ genType, subject, stage, region: '', scopeType: '' });

const files = fs.readdirSync(OUT_ABS).filter((f) => f.endsWith('.txt') && f !== '_L1-report.txt');
const bad = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(OUT_ABS, f), 'utf8');
  const text = raw.split(/\r?\n/).filter((l) => !l.startsWith('#') && !l.startsWith('=====')).join('');
  const [genType, subject, stage] = path.basename(f, '.txt').split('-');
  const anchors = anchorsFor({ genType, subject, stage, hasStructure: hasStructureOf({ genType, subject, stage }) });
  const miss = anchors.filter((a) => {
    const n = (text.match(a.re) || []).length;
    return a.expect === null ? n < 1 : n !== a.expect;
  });
  if (miss.length) bad.push(`${f} ⇒ ${miss.map((m) => `${m.name}（${miss.length}）`).join(' ; ')}`);
}
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const anchorCount = anchorsFor({ genType: 'exam', subject: '语文', stage: 'primary_high', hasStructure: true }).length;
const lines = [
  `# L1 锚·全量 ${files.length} 面报告（重生成 ${stamp}·锚表 ${anchorCount} 锚·计数＝指令文本(不含头部)）`,
  `总面数=${files.length}｜有✗的面=${bad.length}`,
  ...(bad.length ? ['', '—— ✗ 明细 ——', ...bad.map((b) => '  · ' + b)] : []),
];
fs.writeFileSync(path.join(OUT_ABS, '_L1-report.txt'), lines.join('\n') + '\n', 'utf8');
console.log(`报告：${files.length} 面｜有✗的面=${bad.length} ⇒ ${OUT}/_L1-report.txt`);
