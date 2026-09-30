// 🔒 A/E 守卫：判据指纹表（同义=判据级，不再靠词面）＋ 给模型文本的源登记（新源未登记即红）
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CALIBERS, PROMPT_SOURCES, NON_MODEL_SOURCES, SOURCE_RE } from '../../src/config/caliberRegistry.js';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const walk = (d, out = []) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|vue|ts)$/.test(p)) out.push(p);
  }
  return out;
};
const SKIP = /(^|[\\/])(node_modules|dist|tests|docs)([\\/]|$)/;

describe('A 判据指纹表：同一判据不得出现第二处正句', () => {
  it('每条判据在试卷模板内不超基线（allow=1 即硬锁唯一）', () => {
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
    const over = [];
    for (const c of CALIBERS) {
      const n = (t.match(c.re) || []).length;
      if (n > c.allow) over.push(`「${c.name}」${n} > 允许 ${c.allow}（${c.note}）`);
    }
    expect(over, '出现第二处正句 —— 应改为引用，或登记新基线').toEqual([]);
  });

  it('判据表本身不得为空、不得重复登记', () => {
    expect(CALIBERS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(CALIBERS.map((c) => c.name)).size).toBe(CALIBERS.length);
  });
});

describe('E 源登记：给模型文本的入口全部登记，新入口未登记即红', () => {
  it('src 下所有 build* 提示词入口都已在登记表（或明确列为非模型源）', () => {
    const missing = [];
    for (const abs of walk(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
      if (SKIP.test(abs)) continue;
      const hits = [...read(rel).matchAll(SOURCE_RE)].map((m) => m[1]);
      if (!hits.length) continue;
      const reg = PROMPT_SOURCES[rel] || [];
      for (const h of new Set(hits)) {
        if (!reg.includes(h)) missing.push(`${rel}: ${h}`);
      }
    }
    expect(missing, '新增了"给模型的入口"却没登记 —— 请补进 caliberRegistry.js 的 PROMPT_SOURCES').toEqual([]);
  });

  it('登记表里的每条登记都真实存在（防登记表腐烂）', () => {
    const stale = [];
    for (const [rel, fns] of Object.entries(PROMPT_SOURCES)) {
      let src = '';
      try { src = read(rel); } catch { stale.push(`${rel}（文件不存在）`); continue; }
      for (const fn of fns) if (!src.includes(fn)) stale.push(`${rel}: ${fn}`);
    }
    expect(stale, '登记表里有过期条目').toEqual([]);
  });

  it('非模型源必须显式登记（防把"给下游引擎"误当给模型）', () => {
    for (const f of NON_MODEL_SOURCES) expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
  });
});
