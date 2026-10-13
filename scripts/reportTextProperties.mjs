#!/usr/bin/env node
/**
 * 《指令文本性质清单》生成/核验器（**可复跑**）
 * ============================================================
 * 用法：`node scripts/reportTextProperties.mjs`        ⇒ 打印清单表（Markdown）
 *      `node scripts/reportTextProperties.mjs --check` ⇒ 只核验，异常则 exit 1（CI 用同一判据，见 tests/config/textPropertiesRegistry.test.js）
 * 口径：对 **486 面装配后指令文本**逐面计数；`expect` ∈ must（应＝该性质适用面数）／zero（应 0）／some（应 ≥1）。
 */
import { faceTexts } from './instructionText.mjs';
import { PROPERTIES } from './textPropertyRegistry.mjs';

const faces = faceTexts();
if (faces.length !== 486) { console.log(`✗ 面集异常：${faces.length}`); process.exit(1); }
const scopeFaces = (scope) => (scope === 'all' ? faces : faces.filter((f) => scope.includes(f.genType)));

const rows = [];
let bad = 0;
for (const p of PROPERTIES) {
  const pool = scopeFaces(p.scope);
  const hit = pool.filter((f) => f.text.includes(p.probe)).length;
  let ok = true; let want = '';
  if (p.expect === 'must') { want = `${pool.length}/${pool.length}`; ok = hit === pool.length; }
  else if (p.expect === 'zero') { want = '0'; ok = hit === 0; }
  else { want = `≥1`; ok = hit >= 1; }
  if (!ok) bad += 1;
  rows.push({ ...p, poolN: pool.length, hit, want, ok });
}

if (process.argv.includes('--check')) {
  const fails = rows.filter((r) => !r.ok);
  for (const r of fails) console.log(`✗ ${r.id} ${r.name}：应 ${r.want}，实测 ${r.hit}/${r.poolN}`);
  console.log(fails.length ? `\n✗ ${fails.length} 条不符` : `\n✓ 全部 ${rows.length} 条性质符合登记`);
  process.exit(fails.length ? 1 : 0);
}

console.log('| 编号 | 性质 | 判据原文（逐字） | 适用面 | 实测 | 判定 | 守卫 |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) {
  const scope = r.scope === 'all' ? '486 面' : Array.isArray(r.scope) ? r.scope.join('/') : String(r.scope);
  console.log(`| ${r.id} | ${r.name} | \`${r.probe}\` | ${scope} | ${r.hit}/${r.poolN} | ${r.ok ? '✅' : '✗'} | \`${r.guard}\` |`);
}
console.log(`\n合计 ${rows.length} 条性质；不符 ${bad} 条。`);
