// ============================================================
// 【分值标注】整块快照锁（2026-10-27 属主："完美标分的那次，不能做成一动就红吗？固定下来"）
// ------------------------------------------------------------
// 与既有守卫的分工：
//   · `scoreClauseContract`  —— 锁**骨头**（九块骨头在、四条回潮无）；换词可以过。
//   · `scoreClauseArbitration` —— 锁**仲裁关系**（"不逐题复述"同条必须有分值豁免）。
//   · **本文件** —— 锁**整块文字与分组**：逐字比对快照，**拆条/并条/调序/换词一律红**。
// 为什么要这么硬（真机教训）：200377e（完美标分）之后，把这块按"一行一判据"拆成 20 条，
//   题内标分与"标题与题内两处都要有"被拆散、指代断开 ⇒ 小题整段不标分。分组本身就是判据的一部分。
// 允许改的唯一路径：`node scripts/snapshotScoreClause.mjs` 显式更新快照（并真机验证标分结果），
//   把"改文本"变成一次**有意识**的动作，而不是顺手一动就回归。
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPromptTemplate, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAP_PATH = path.join(ROOT, 'tests/fixtures/scoreClause.exam.snapshot.txt');
const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();

const SNAP = norm(fs.readFileSync(SNAP_PATH, 'utf8'));

const blockOf = (subject, stage) => {
  const t = getPromptTemplate({ grade: stage, subject, genType: 'exam' }).template;
  return norm((t.match(/(?:^|\n)【分值标注】\n([\s\S]*?)(?=\n\n【)/) || [, ''])[1]);
};

/** 首个不同行的取证（给修复者看"哪一条被动了"，不给整块噪音） */
const firstDiff = (a, b) => {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i += 1) {
    if ((la[i] || '') !== (lb[i] || '')) {
      return `第 ${i + 1} 条不同\n  快照：${(la[i] || '（无）').slice(0, 160)}\n  现状：${(lb[i] || '（无）').slice(0, 160)}`;
    }
  }
  return '（逐行相同，差异在空白/行尾）';
};

const PAIRS = Object.entries(STAGE_SUBJECTS)
  .flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));

describe('【分值标注】整块快照（拆条/并条/调序/换词 ⇒ 红）', () => {
  it('全部 54 个学科×学段组合：块文本与快照逐字一致', () => {
    const bad = [];
    for (const { stage, subject } of PAIRS) {
      const cur = blockOf(subject, stage);
      if (cur !== SNAP) bad.push(`${subject}/${stage}：${firstDiff(SNAP, cur)}`);
    }
    expect(
      bad.slice(0, 3),
      '【分值标注】被改动。若这是**有意**的（且已真机验证标分结果），请运行 `node scripts/snapshotScoreClause.mjs` 更新快照并一并提交；否则请还原。',
    ).toEqual([]);
  });

  it('快照本身没退化成空块（防"把快照清空即全绿"）', () => {
    expect(SNAP.length, '快照字数').toBeGreaterThan(800);
    expect(SNAP.split('\n').length, '快照条数').toBeGreaterThanOrEqual(6);
    expect(SNAP, '结构判定在位').toContain('遮住大题标题、只看其中一项');
    expect(SNAP, '题内标分在位').toContain('每题题干后必须标');
    expect(SNAP, '两处都要有在位').toContain('标题与题内两处都要有');
    expect(SNAP, '逐层验算在位').toContain('各大题分之和＝给定满分');
  });

  it('守卫有牙：把任意一条并进上一条即红（复现 2026-10-27 的回归形态）', () => {
    const merged = SNAP.replace('\n· **先定单价、后乘个数**', '；**先定单价、后乘个数**');
    expect(merged === SNAP, '并条后必须与快照不等').toBe(false);
  });
});
