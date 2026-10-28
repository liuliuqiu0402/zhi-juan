// ============================================================
// 分值块整块快照锁（2026-10-27 属主："完美标分的那次，不能做成一动就红吗？固定下来"）
// ------------------------------------------------------------
// 覆盖两块（判据级分组，**块内拆分也属改动**）：
//   · 【分值标注】——结构判定／先定单价／题内标分／标题写法／位置／分问／逐层验算
//   · 【卷面自洽】——含"只出一次／不逐题复述"与其管辖域（只管标题与说明，不管标分）
// 与既有守卫的分工：
//   · `scoreClauseContract`   —— 锁**骨头**（换词可以过）
//   · `scoreClauseArbitration` —— 锁**仲裁关系**（同条必须有分值豁免）
//   · **本文件** —— 锁**整块文字与分组**：逐字比对，**拆条/并条/调序/换词一律红**
// 真机教训：200377e（完美标分）之后把【分值标注】按"一行一判据"拆成 20 条，
//   题内标分与"标题与题内两处都要有"被拆散、指代断开 ⇒ 小题整段不标分。
// 2026-10-28（A/B 基准）：那份"完美版"本身有两份记账（标题 Σ ＋ 题内），是"一改就崩"的机制源；
//   现按 A 案一处一分。**本快照是"防手滑"的冻结，不是"文本不可再审"的裁定**——按设计改文本时，
//   用脚本显式更新快照并在提交信息写清依据即可。
// 允许改的唯一路径：`node scripts/snapshotScoreClause.mjs` 显式更新快照。
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPromptTemplate, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAP_PATH = path.join(ROOT, 'tests/fixtures/scoreClause.exam.snapshot.txt');
const SEP = '\n\n===== 8< =====\n\n';
const BLOCKS = ['【分值标注】', '【卷面自洽】'];
const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();

const SNAP_RAW = norm(fs.readFileSync(SNAP_PATH, 'utf8'));
const SNAP = new Map(SNAP_RAW.split(SEP).map((sec) => {
  const s = sec.trim();
  const nl = s.indexOf('\n');
  return [s.slice(0, nl).trim(), norm(s.slice(nl + 1))];
}));

/** 取块正文（不含块名行，与快照分节内容同一口径） */
const blockOf = (tpl, head) => {
  const i = tpl.indexOf(`\n${head}\n`);
  if (i < 0) return '';
  const rest = tpl.slice(i + 1);
  const j = rest.indexOf('\n\n【');
  const raw = norm(j < 0 ? rest : rest.slice(0, j));
  return raw.startsWith(`${head}\n`) ? raw.slice(head.length + 1).trim() : raw;
};

/** 首个不同行的取证（只说"哪一条被动了"，不倾倒整块） */
const firstDiff = (a, b) => {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i += 1) {
    if ((la[i] || '') !== (lb[i] || '')) {
      return `第 ${i + 1} 条不同｜快照：${(la[i] || '（无）').slice(0, 140)}｜现状：${(lb[i] || '（无）').slice(0, 140)}`;
    }
  }
  return '逐行相同（差异在空白/行尾）';
};

const PAIRS = Object.entries(STAGE_SUBJECTS)
  .flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));

describe('分值块整块快照（拆条/并条/调序/换词 ⇒ 红）', () => {
  it('快照本身两块齐全、没退化成空块（防"清空快照即全绿"）', () => {
    for (const head of BLOCKS) expect(SNAP.has(head), `快照缺 ${head}`).toBe(true);
    const score = SNAP.get('【分值标注】');
    // 只防"清空/退化成空块"；字数不是判据（2026-10-28 判据与执行分离后约为 970 字，
    //   结构判定保留在本块但只关编号，标分由"有没有小号"触发）。
    expect(score.length, '分值标注字数（防清空）').toBeGreaterThan(450);
    expect(score.split('\n').length, '分值标注条数').toBeGreaterThanOrEqual(6);
    expect(score, '结构判定在位（只关编号）').toContain('遮住大题标题、只看其中一项');
    expect(score, '有号：分跟着号走').toContain('分跟着号走**：**分写在每题题干后');
    expect(score, '无号：分只写在标题后一处').toContain('整栏没有小号序号的，这一栏的分只写在标题后一处');
    expect(score, '先分配、后落实在位').toContain('先分配、后落实');
    expect(score, '标题写这一栏的分').toContain('标题写这一栏的分');
    expect(score, '逐层验算在位').toContain('各大题分之和＝给定满分');
    const self = SNAP.get('【卷面自洽】');
    expect(self, '仲裁句在位').toContain('不逐题复述');
    expect(self, '管辖域在位（只管标题与说明，不管标分）').toContain('标题与作答说明');
  });

  it('全部 54 个学科×学段组合：两块文本与快照逐字一致', () => {
    const bad = [];
    for (const { stage, subject } of PAIRS) {
      const tpl = getPromptTemplate({ grade: stage, subject, genType: 'exam' }).template;
      for (const head of BLOCKS) {
        const cur = blockOf(tpl, head);
        const snap = SNAP.get(head) || '';
        if (cur !== snap) bad.push(`${subject}/${stage} ${head}：${firstDiff(snap, cur)}`);
      }
    }
    expect(
      bad.slice(0, 3),
      '分值块被改动。若这是**有意**的（且已真机验证标分结果），请运行 `node scripts/snapshotScoreClause.mjs` 更新快照并一并提交；否则请还原。',
    ).toEqual([]);
  });

  it('守卫有牙：把任意一条并进上一条即红（复现 2026-10-27 的回归形态）', () => {
    const score = SNAP.get('【分值标注】');
    const merged = score.replace('\n· **先定单价、后乘个数**', '；**先定单价、后乘个数**');
    expect(merged === score, '并条后必须与快照不等').toBe(false);
    const self = SNAP.get('【卷面自洽】');
    const split = self.replace('· **标题与作答说明**：', '\n· **标题与作答说明**：');
    expect(split === self, '把仲裁句拆出去必须与快照不等').toBe(false);
  });
});
