// 🔒 指令"只增不扩"守卫（2026-09-30 用户裁定：# 一条要求越长越难被遵守，段越长越会被跳过）
// ============================================================
// 背景：修复史审计发现"每发现一个缺陷，就在原句上再加一层定语/括注"→ 单条越滚越长（实测最长单条 2073 字），
//   叠加"覆盖式改写"（旧句有效内容被新句盖掉）→ 恶性循环。
// 本守卫先**止住增长**（不改任何内容、不缩任何条款），锁三件事：
//   ① 单条字数上限（= 当前基线，只减不增）；
//   ② 同义判据的"条数指纹"（同一判据跨多条各写一遍的处数，只减不增）；
//   ③ 声明↔实给单源句仍是一定义两消费（防再次被覆盖式改写）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate, DECLARATION_TRUTH_CLAUSE } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const tpl = (g, s = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: s, genType: g }).template;

/** 单条上限（字数）——基线取 2026-09-30 实测最长条（题目自洽①–⑰，2073 字），留 6% 余量；只减不增 */
const MAX_CLAUSE_CHARS = 2200;
/** 同义判据指纹上限：关键词 → 允许出现的"条"数上限（不得高于 2026-09-30 实测值） */
const DUP_BUDGET = { 分值: 5, 同性质: 4, 同一题: 4, 逐题: 4, 账目: 3, 书写载体: 3, 不得省略: 2, 自查: 2 };

const clausesOf = (t) => t.split(/\n(?=·|【)/).map((s) => s.trim()).filter((s) => s.length > 12);

describe('指令"只增不扩"守卫（止住越滚越长）', () => {
  it('单条字数不得超过基线（只减不增）', () => {
    const bad = [];
    for (const g of ['exam', 'practice', 'summary', 'preview', 'reading', 'dictation', 'errorbook', 'review', 'special']) {
      for (const cl of clausesOf(tpl(g))) if (cl.length > MAX_CLAUSE_CHARS) bad.push(`${g}: ${cl.length} 字 → ${cl.slice(0, 24)}`);
    }
    expect(bad.slice(0, 5), `以下单条超上限（${MAX_CLAUSE_CHARS} 字）`).toEqual([]);
  });

  it('同义判据的条数指纹不得增加（同一判据跨多条各写一遍 = 同义多套）', () => {
    const items = clausesOf(tpl('exam'));
    const over = [];
    for (const [k, cap] of Object.entries(DUP_BUDGET)) {
      const n = items.filter((x) => x.includes(k)).length;
      if (n > cap) over.push(`「${k}」${n} 条 > 上限 ${cap}`);
    }
    expect(over, '同义判据条数增加（新增即需收口或走单源）').toEqual([]);
  });

  it('声明↔实给单源句不被覆盖式改写：一定义两消费，且旧实例仍在', () => {
    const lib = read('src/config/promptLibrary.js');
    expect((lib.match(/export const DECLARATION_TRUTH_CLAUSE/g) || []).length).toBe(1);
    expect((lib.match(/DECLARATION_TRUTH_CLAUSE/g) || []).length).toBe(3);
    expect(DECLARATION_TRUTH_CLAUSE, '旧句实例不得被新句盖掉').toContain('拼音、首字母、提示词、图、表、数据、待选项');
  });
});
