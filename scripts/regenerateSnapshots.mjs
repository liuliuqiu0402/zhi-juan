#!/usr/bin/env node
/**
 * 486 面全量快照重生成（可复现）
 *
 * 为什么需要它：任何**改指令源**（`src/config/promptLibrary.js` / `teachingBlueprints.js` /
 * `specialDomains.js` …）之后，`docs/audit/snapshot-all/` 里的快照即**过期**——
 * 送审/核证若仍读旧快照，会把"已修的问题"再报一遍或漏掉新问题。
 * 故本脚本作为**唯一的重生成入口**（逐面等值于 `scripts/snapshotInjection.mjs`，只是批量）。
 *
 * 面集来源（唯一事实源）：`src/config/promptLibrary.js` 的 `STAGE_SUBJECTS` × 9 类资料类型。
 * 输出目录：`SNAPSHOT_DIR`（默认 `docs/audit/snapshot-all`）。
 *
 * 用法：
 *   node scripts/regenerateSnapshots.mjs               # 全部 486 面
 *   node scripts/regenerateSnapshots.mjs 信息科技       # 只重生成某学科（调试用）
 *   node scripts/regenerateSnapshots.mjs 信息科技 dictation
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STAGE_SUBJECTS } from '../src/config/promptLibrary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.SNAPSHOT_DIR || 'docs/audit/snapshot-all';

const GEN_TYPES = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];

const [onlySubject, onlyType] = process.argv.slice(2).filter((a) => !a.startsWith('-'));

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

fs.mkdirSync(path.resolve(ROOT, OUT), { recursive: true });

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
