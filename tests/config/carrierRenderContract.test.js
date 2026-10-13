// ============================================================
// 载体—渲染契约守卫（2026-10-13 增·属主："排版质量也要高（这里包括载体）"
//   ⇒ 单独锁"指令侧点名了载体、渲染/导出侧有没有实现"这道暗伤）
// ------------------------------------------------------------
// 为什么要它：载体原先只有**指令侧枚举**（`CARRIER_LABELS`），**没有**对账。若某载体只在指令里
//   被点名、渲染端没有实现，模型会照指令产出标记而渲染端不认——**"看起来对、到手残缺"**。
//   本守卫以 `CARRIER_RENDER_CONTRACT`（单源）为准做**双向锁**：
//     · markup 类：每个登记落点文件必须真能查到该 id（否则＝登记虚设）；
//     · declarative 类：渲染/导出侧必须 **0 命中**（"声明型"就该不出标记；将来若被加了实现
//       而没同步改契约 ⇒ 红，逼同步）。
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CARRIER_LABELS } from '../../src/config/blueprintSchema.js';
import { CARRIER_RENDER_CONTRACT } from '../../src/config/eduRenderContract.js';

const ROOT = path.resolve(__dirname, '../..');
const cache = new Map();
const read = (rel) => {
  if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  return cache.get(rel);
};
const RENDER_SIDE = [...new Set(
  Object.values(CARRIER_RENDER_CONTRACT).flatMap((v) => v.where || []),
)];

describe('载体—渲染契约（指令侧点名 ⇔ 渲染/导出侧实现）', () => {
  it('① 无遗漏：每个载体（CARRIER_LABELS）都在契约内登记', () => {
    const missing = Object.keys(CARRIER_LABELS).filter((id) => !(id in CARRIER_RENDER_CONTRACT));
    expect(missing, '未登记到契约的载体（新载体须同时登记实现落点或标 declarative）').toEqual([]);
  });

  it('② 无孤儿：契约里的 id 都是真载体（防写错 id 自欺）', () => {
    const orphan = Object.keys(CARRIER_RENDER_CONTRACT).filter((id) => !(id in CARRIER_LABELS));
    expect(orphan).toEqual([]);
  });

  it('③ 载体中文标签唯一源完好（每个载体都有非空标签）', () => {
    const bad = Object.entries(CARRIER_LABELS).filter(([, l]) => !String(l || '').trim()).map(([id]) => id);
    expect(bad).toEqual([]);
  });

  it('④ markup 类：登记的每个落点文件都真能查到该 id（登记不得虚设）', () => {
    const bad = [];
    for (const [id, v] of Object.entries(CARRIER_RENDER_CONTRACT)) {
      if (v.kind !== 'markup') continue;
      const files = v.where || [];
      if (!files.length) { bad.push(`${id}：markup 类未登记 where（实现落点）`); continue; }
      if (!files.some((f) => read(f).includes(id))) bad.push(`${id}：登记落点均查不到该 id（${files.join(', ')}）`);
    }
    expect(bad, '指令点名了载体、渲染/导出侧查不到实现 ⇒ 暗伤').toEqual([]);
  });

  it('⑤ declarative 类：渲染/导出侧全域 0 命中（"声明型"不出标记；若加了实现须改契约）', () => {
    const bad = [];
    for (const [id, v] of Object.entries(CARRIER_RENDER_CONTRACT)) {
      if (v.kind !== 'declarative') continue;
      const hit = RENDER_SIDE.filter((f) => read(f).includes(id));
      if (hit.length) bad.push(`${id}：已登记为声明型，但渲染/导出侧出现实现（${hit.join(', ')}）⇒ 请同步改契约或改登记`);
      if (!v.why) bad.push(`${id}：declarative 必须写 why（为何不出标记）`);
    }
    expect(bad).toEqual([]);
  });

  it('⑥ 契约形态合法：kind 只能是 markup／declarative', () => {
    const bad = Object.entries(CARRIER_RENDER_CONTRACT)
      .filter(([, v]) => !['markup', 'declarative'].includes(v.kind))
      .map(([id]) => id);
    expect(bad).toEqual([]);
  });
});
