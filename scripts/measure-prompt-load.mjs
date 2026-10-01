/**
 * 实发负载称重（measure-prompt-load）
 * ============================================================
 * 用途：把每一份实发的字数、句数**逐块**量出来，形成负载台账——
 *   动手之前先知道重量压在哪、重复聚在哪。
 *
 * 口径（与《给模型的语义复核·执行文档》一致）：
 *   · 实发是复数：本工具量的是「正文生成请求」这一份（system ＋ user 全部块，不含教材素材）。
 *   · 字数 = 字符数（String.length），与既往测量口径一致。
 *   · 句 = 按「· 起首 / 【 起首」切分、长度 > 12 的条款。
 *
 * 用法：node scripts/measure-prompt-load.mjs [输出目录]
 *   不传输出目录＝只称重、不落任何文件（默认）。
 *   传目录才落明细清单——平时不用传：唯一执行文件在外，避免多份口径漂移。
 *
 * 产出三件：
 *   实发负载台账-2026-10-01.md      汇总：分布、最重的份、逐块构成
 *   实发负载台账-2026-10-01.csv     全量逐份数据（可直接排序筛选）
 *   条款清点-<stage>-<subject>-<type>.md   试点份的条款级清点 ＋ 疑似同义对照
 * ============================================================
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = (f) => new URL(`../src/config/${f}`, import.meta.url).href;
const UTIL = (f) => new URL(`../src/utils/${f}`, import.meta.url).href;

const { getPromptTemplate, STAGE_SUBJECTS } = await import(SRC('promptLibrary.js'));
const { TEACHING_GEN_TYPES } = await import(SRC('teachingBlueprints.js'));
const { buildUserMessageBlocks, buildUserMessagePrompt } = await import(UTIL('injectionManifest.js'));
const { buildProgramAttach } = await import(UTIL('programAttach.js'));

const OUT = process.argv[2] || '';
const PILOT = { stage: 'primary_low', subject: '语文', genType: 'exam' };
const TYPES = ['exam', ...TEACHING_GEN_TYPES];

const L = (s) => String(s ?? '').length;
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const clausesOf = (t) => String(t || '')
  .split(/\n(?=·|【)/)
  .map((s) => s.trim())
  .filter((s) => s.length > 12);

/** 句：以句末标点切分、长度 > 4 的最小判定单位（范围最细一级） */
const sentencesOf = (t) => String(t || '')
  .split(/[。！？；\n]+/)
  .map((s) => s.trim())
  .filter((s) => s.length > 4);

/** 6-gram Jaccard：用于在**同一份实发内**找疑似同义（判重先看作用结果，此处只作线索） */
const grams = (s, n = 6) => {
  const out = new Set();
  const str = String(s).replace(/\s+/g, '');
  for (let i = 0; i + n <= str.length; i++) out.add(str.slice(i, i + n));
  return out;
};
const jac = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return inter / (a.size + b.size - inter);
};

// ── 逐份称重 ──
const rows = [];
for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
  for (const subject of subjects) {
    for (const genType of TYPES) {
      const t = getPromptTemplate({ grade: stage, subject, genType });
      const cell = String(t?.template || '');
      if (!cell) continue;
      const clauses = clausesOf(cell);
      const ctx = { genType, subject, materialChannel: 'anchor', instructionText: cell };
      const userText = buildUserMessagePrompt(ctx);
      const sysText = buildProgramAttach({ subject, stageKey: stage, genType, instructionText: cell });
      const blocks = buildUserMessageBlocks(ctx).map((b) => ({
        id: b.id, name: b.name, injected: !!b.injected, len: b.text ? L(b.text) : L(cell), text: b.text || '',
      }));
      const cellSent = sentencesOf(cell).length;
      const allSent = sentencesOf(userText + '\n' + sysText).length;
      rows.push({
        stage, subject, genType, id: String(t?.id || ''),
        cell: L(cell), clauses: clauses.length,
        maxClause: clauses.reduce((m, c) => Math.max(m, c.length), 0),
        sentences: cellSent, sentencesAll: allSent,
        user: L(userText), sys: L(sysText), total: L(userText) + L(sysText),
        blocks, _cell: cell, _clauses: clauses,
      });
    }
  }
}

// ── 统计 ──
const stat = (arr) => {
  const a = [...arr].sort((x, y) => x - y);
  if (!a.length) return { min: 0, p50: 0, p90: 0, max: 0, avg: 0 };
  return {
    min: a[0],
    p50: a[Math.floor(a.length / 2)],
    p90: a[Math.floor(a.length * 0.9)],
    max: a[a.length - 1],
    avg: Math.round(a.reduce((x, y) => x + y, 0) / a.length),
  };
};
const totalStat = stat(rows.map((r) => r.total));
const cellStat = stat(rows.map((r) => r.cell));
const clauseStat = stat(rows.map((r) => r.clauses));
const sentStat = stat(rows.map((r) => r.sentencesAll));
const top = [...rows].sort((a, b) => b.total - a.total).slice(0, 20);

// 逐块平均占比（取非空块）
const blockAgg = new Map();
for (const r of rows) {
  for (const b of r.blocks) {
    if (!b.injected) continue;
    const cur = blockAgg.get(b.id) || { name: b.name, sum: 0, hits: 0, max: 0 };
    cur.sum += b.len; cur.hits += 1; cur.max = Math.max(cur.max, b.len);
    blockAgg.set(b.id, cur);
  }
}
const blockRows = [...blockAgg.entries()]
  .map(([id, v]) => ({ id, name: v.name, avg: Math.round(v.sum / v.hits), hits: v.hits, max: v.max }))
  .sort((a, b) => b.avg - a.avg);

// ── 试点份：条款清点 ＋ 疑似同义 ──
const pilot = rows.find((r) => r.stage === PILOT.stage && r.subject === PILOT.subject && r.genType === PILOT.genType);
let pilotMd = '';
if (pilot) {
  const title = `${PILOT.stage} · ${PILOT.subject} · ${PILOT.genType}`;
  const gs = pilot._clauses.map((c) => grams(c));
  const pairs = [];
  for (let i = 0; i < gs.length; i++) {
    for (let j = i + 1; j < gs.length; j++) {
      const s = jac(gs[i], gs[j]);
      if (s >= 0.2) pairs.push({ i, j, s: Math.round(s * 100) });
    }
  }
  pairs.sort((a, b) => b.s - a.s);

  pilotMd += `# 条款清点 · ${title}\n\n`;
  pilotMd += `> 用途：动手之前先看清这份实发里**有哪些条款、各多长、哪些疑似同义**。\n`;
  pilotMd += `> 疑似同义只作线索（6-gram 重合 ≥ 30%），最终判重仍按“作用结果是否相同”。\n\n`;
  pilotMd += `- 指令正文（cell）：**${pilot.cell}** 字\n`;
  pilotMd += `- 条款数：**${pilot.clauses}**（按「·/【」切分、长度 > 12）\n`;
  pilotMd += `- 句数：**${pilot.sentences}**（条款内按句末标点切分、长度 > 4）——范围最细一级\n`;
  pilotMd += `- 最长条款：**${pilot.maxClause}** 字\n`;
  pilotMd += `- 全份合计（不含素材）：**${pilot.total}** 字 ／ **${pilot.sentencesAll}** 句（含各块）\n\n`;

  pilotMd += `## 一、逐块构成\n\n| 块 | 所属 | 字数 |\n|---|---|---:|\n`;
  for (const b of pilot.blocks) {
    if (!b.injected) continue;
    pilotMd += `| ${b.name} | ${b.id} | ${b.len} |\n`;
  }
  pilotMd += `| **程序附加段（system）** | programAttach | ${pilot.sys} |\n`;
  pilotMd += `\n- 指令正文块（id=instruction）即上表 cell，二者是同一份，不重复计。\n\n`;

  pilotMd += `## 二、条款逐条清点\n\n| # | 字数 | 句数 | 条款（首 60 字） |\n|---:|---:|---:|---|\n`;
  pilot._clauses.forEach((c, i) => {
    pilotMd += `| ${i} | ${L(c)} | ${sentencesOf(c).length} | ${c.slice(0, 60).replace(/\|/g, '｜').replace(/\n/g, ' ')} |\n`;
  });
  pilotMd += `\n## 三、疑似同义（6-gram ≥ 30%，仅线索）\n\n`;
  if (!pairs.length) pilotMd += `（无）\n`;
  else {
    pilotMd += `| 相似 | A# | B# | A 首 40 字 | B 首 40 字 |\n|---:|---:|---:|---|---|\n`;
    for (const p of pairs.slice(0, 40)) {
      pilotMd += `| ${p.s}% | ${p.i} | ${p.j} | ${pilot._clauses[p.i].slice(0, 40).replace(/\|/g, '｜').replace(/\n/g, ' ')} | ${pilot._clauses[p.j].slice(0, 40).replace(/\|/g, '｜').replace(/\n/g, ' ')} |\n`;
    }
  }

  // ── 重复短语探测（14 字连续重合；只作线索，最终判重仍按“作用结果是否相同”）──
  const N = 14;
  const norm = (s) => String(s).replace(/\s+/g, '');
  const gramsOf = (s) => {
    const str = norm(s); const out = [];
    for (let i = 0; i + N <= str.length; i++) out.push(str.slice(i, i + N));
    return out;
  };
  const maximal = (map) => {
    const reps = [...map.entries()].filter(([, v]) => v.size >= 2).map(([p, v]) => ({ p, where: [...v] }));
    reps.sort((a, b) => b.p.length - a.p.length);
    // 同一处重合会被滑动窗口切成许多条（彼此相差 1 字），此处按「同 where ＋ 12 字重合」合并为一条
    const shares12 = (a, b) => {
      const [s, l] = a.length <= b.length ? [a, b] : [b, a];
      for (let i = 0; i + 12 <= s.length; i++) if (l.includes(s.slice(i, i + 12))) return true;
      return false;
    };
    const kept = [];
    for (const r of reps) {
      const key = r.where.join(',');
      if (kept.some((k) => k.key === key && shares12(k.p, r.p))) continue;
      kept.push({ ...r, key });
    }
    // 取每条重合的最长代表片段（已按长度降序，第一个即为最长）
    return kept.map(({ p, where }) => ({ p, where }));
  };

  // 块内：指令正文各条款之间
  const inCell = new Map();
  pilot._clauses.forEach((c, i) => {
    for (const g of gramsOf(c)) { if (!inCell.has(g)) inCell.set(g, new Set()); inCell.get(g).add(i); }
  });
  const inCellReps = maximal(inCell);

  // 跨块：指令正文 ↔ 用户消息其余块 ↔ 程序附加段
  const segs = [{ name: '指令正文', text: pilot._cell }];
  for (const b of pilot.blocks) {
    if (b.injected && b.id !== 'instruction' && b.len > 12) segs.push({ name: b.name, text: b.text });
  }
  segs.push({
    name: '程序附加段',
    text: buildProgramAttach({ subject: pilot.subject, stageKey: pilot.stage, genType: pilot.genType, instructionText: pilot._cell }),
  });
  const cross = new Map();
  for (const sg of segs) {
    for (const g of gramsOf(sg.text)) { if (!cross.has(g)) cross.set(g, new Set()); cross.get(g).add(sg.name); }
  }
  const crossReps = maximal(cross);

  pilotMd += `\n## 四、重复短语探测（14 字连续重合，仅线索）\n\n`;
  pilotMd += `> 这一节只负责“指出哪里可能在说同一件事”，不负责判定；只记 14 字以上**连续重合**，改写过的同义句抓不到，需人工按语义补。\n\n`;
  pilotMd += `### 4.1 块内（指令正文各条款之间）\n\n`;
  if (!inCellReps.length) pilotMd += `（无 14 字以上连续重合）\n`;
  else {
    pilotMd += `| 重合片段 | 出现在条款 # |\n|---|---|\n`;
    for (const r of inCellReps.slice(0, 40)) pilotMd += `| ${r.p} | ${r.where.join('、')} |\n`;
  }
  pilotMd += `\n### 4.2 跨块（指令正文 ↔ 用户消息其余块 ↔ 程序附加段）\n\n`;
  if (!crossReps.length) pilotMd += `（无 14 字以上连续重合）\n`;
  else {
    pilotMd += `| 重合片段 | 出现在块 |\n|---|---|\n`;
    for (const r of crossReps.slice(0, 40)) pilotMd += `| ${r.p} | ${r.where.join('、')} |\n`;
  }
}

// ── 输出 ──
let md = `# 实发负载台账（2026-10-01 · 称重）\n\n`;
md += `> 口径：量的是「正文生成请求」这一份实发（system ＋ user 全部块，**不含教材素材**）；字数＝字符数。\n`;
md += `> 分量：共 **${rows.length}** 份（真实开设的 学科×学段 组合 × 9 资料类型）。\n`;
md += `> 用途：**称重只为看清堆在哪，不是达标线**。\n\n`;

md += `## 一、总量\n\n| 项 | 最小 | 中位 | 九成线 | 最大 | 平均 |\n|---|---:|---:|---:|---:|---:|\n`;
md += `| 指令正文（cell） | ${cellStat.min} | ${cellStat.p50} | ${cellStat.p90} | ${cellStat.max} | ${cellStat.avg} |\n`;
md += `| 一份实发合计（不含素材） | ${totalStat.min} | ${totalStat.p50} | ${totalStat.p90} | ${totalStat.max} | ${totalStat.avg} |\n`;
md += `| 条款数（条） | ${clauseStat.min} | ${clauseStat.p50} | ${clauseStat.p90} | ${clauseStat.max} | ${clauseStat.avg} |\n`;
md += `| 句子数（句·含各块） | ${sentStat.min} | ${sentStat.p50} | ${sentStat.p90} | ${sentStat.max} | ${sentStat.avg} |\n\n`;
md += `指令正文占整份的 **${pct(rows.reduce((s, r) => s + r.cell, 0), rows.reduce((s, r) => s + r.total, 0))}%**。\n\n`;

md += `## 二、逐块平均（各块在各份里的平均字数，按大→小）\n\n| 块 | id | 平均字数 | 出现份数 | 单份最大 |\n|---|---|---:|---:|---:|\n`;
for (const b of blockRows) md += `| ${b.name} | ${b.id} | ${b.avg} | ${b.hits} | ${b.max} |\n`;
md += `\n（id=instruction 即「指令正文」块，与上表 cell 同源，不重复计。）\n\n`;

md += `## 三、最重的 20 份\n\n| # | 学段 | 学科 | 类型 | cell | 合计 | 条款数 |\n|---:|---|---|---|---:|---:|---:|\n`;
top.forEach((r, i) => { md += `| ${i + 1} | ${r.stage} | ${r.subject} | ${r.genType} | ${r.cell} | ${r.total} | ${r.clauses} |\n`; });
md += `\n`;

let csv = 'stage,subject,genType,id,cellChars,clauses,cellSentences,maxClause,userChars,sysChars,totalChars,allSentences\n';
for (const r of rows) csv += `${r.stage},${r.subject},${r.genType},${r.id},${r.cell},${r.clauses},${r.sentences},${r.maxClause},${r.user},${r.sys},${r.total},${r.sentencesAll}\n`;

if (OUT) {
  // 只有显式传入输出目录才落盘；默认只称重、不生成任何文件
  // （唯一执行文件在外面，避免多份口径漂移）
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, '实发负载台账-2026-10-01.md'), md, 'utf8');
  writeFileSync(join(OUT, '实发负载台账-2026-10-01.csv'), csv, 'utf8');
  if (pilotMd) {
    writeFileSync(join(OUT, `条款清点-${PILOT.stage}-${PILOT.subject}-${PILOT.genType}-2026-10-01.md`), pilotMd, 'utf8');
  }
}

console.log('份数=' + rows.length,
  '| cell 平均=' + cellStat.avg,
  '| 合计平均=' + totalStat.avg,
  '| 合计最大=' + totalStat.max,
  '| 条款平均=' + clauseStat.avg);
console.log(OUT ? '输出目录：' + OUT : '（未落盘·只称重）');
