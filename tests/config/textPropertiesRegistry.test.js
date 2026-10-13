// ============================================================
// 《指令文本性质清单》守卫（2026-10-13 增·属主"先做清单，再做去 AI 味"）
// ------------------------------------------------------------
// 为什么要有它：清单若只是文档，就会漂移。本守卫把 `scripts/textPropertyRegistry.mjs`（**单一事实源**）
//   在 CI 里对 **486 面装配文本**逐条核：
//     · must  ⇒ 该性质在其适用面上**恒在场**（命中面数 = 适用面数）
//     · zero  ⇒ 该性质**零命中**（AI 味词/旧措辞/被禁内容 = 回归锁）
//     · some  ⇒ 至少 1 面命中
//   另锁两条"清单自身完整性"：
//     · 无守卫（guard='—'）的条目**必须写明原因**（note 含"缺口"），防"悄悄没人管"；
//     · 清单文档须含**全部 id**（防文档与登记表脱节）。
// 用法：`node scripts/reportTextProperties.mjs`（人读表）／`--check`（同判据，异常 exit 1）
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { faceTexts } from '../../scripts/instructionText.mjs';
import { PROPERTIES } from '../../scripts/textPropertyRegistry.mjs';

const faces = faceTexts();
const scopeFaces = (scope) => (scope === 'all' ? faces : faces.filter((f) => scope.includes(f.genType)));
const DOC = path.resolve(__dirname, '../../docs/audit/指令文本性质清单-v1.md');

const fails = [];
for (const p of PROPERTIES) {
  const pool = scopeFaces(p.scope);
  const hit = pool.filter((f) => f.text.includes(p.probe)).length;
  if (p.expect === 'must' && hit !== pool.length) fails.push(`${p.id} ${p.name}：应 ${pool.length}/${pool.length}，实测 ${hit}`);
  if (p.expect === 'zero' && hit !== 0) fails.push(`${p.id} ${p.name}：应 0，实测 ${hit}`);
  if (p.expect === 'some' && hit < 1) fails.push(`${p.id} ${p.name}：应 ≥1，实测 0`);
}

describe('《指令文本性质清单》守卫（486 面 · 单一事实源）', () => {
  it('面集完整（防"扫空集"假绿）', () => {
    expect(faces.length).toBe(486);
    expect(PROPERTIES.length).toBeGreaterThanOrEqual(30);
  });

  it('全部性质符合登记（must 恒在场／zero 零命中／some ≥1）', () => {
    expect(fails, fails.join('\n')).toEqual([]);
  });

  it('无守卫的条目必须写明原因（不许"悄悄没人管"）', () => {
    const silent = PROPERTIES.filter((p) => p.guard === '—' && !/缺口/.test(p.note || '')).map((p) => p.id);
    expect(silent, `这些条目既无守卫又未登记缺口：${silent.join(',')}`).toEqual([]);
  });

  it('清单文档须含全部条目 id（防文档与登记表脱节）', () => {
    const doc = fs.readFileSync(DOC, 'utf8');
    const missing = PROPERTIES.filter((p) => !doc.includes(`| ${p.id} |`)).map((p) => p.id);
    expect(missing, `文档缺这些条目：${missing.join(',')}`).toEqual([]);
  });
});
