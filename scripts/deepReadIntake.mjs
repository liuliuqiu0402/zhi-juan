#!/usr/bin/env node
/**
 * 语义深读产出·收件核对（机检）
 *
 * 目的：把"54 片是否收齐、有没有漏/重/错放"从"人眼数文件名"变成**可复现的机检**。
 *
 * 归属依据（关键设计）：
 *   **不看文件名**，只看文件**内容首行**的"片自证"——
 *     `# 语义深读·<学科> × <学段>｜片自证：实际读到 <N> 份`
 *   由该行的 <学科>×<学段> 得到**片键**，与期望集（54）双向核对。
 *   ⇒ 哪怕文件名不统一（`体育_high.md`／`高中.md`／无规律），只要文件落在这个目录树内、
 *      首行片自证可解析，就不会被漏；解析不出的会显式列为"待归属"，**不静默忽略**。
 *
 * 期望集（唯一事实源）：`src/config/promptLibrary.js` 的 `STAGE_SUBJECTS`（5 学段合计 54 片）。
 *
 * 用法：
 *   node scripts/deepReadIntake.mjs             # 核对并打印报告（同时写 _INTAKE-report.txt）
 *   node scripts/deepReadIntake.mjs --strict    # 除"缺片"外，任一异常（待归属/重复/非期望/份数≠9）即非零退出
 *   node scripts/deepReadIntake.mjs --sweep     # 归位：把散落文件移到 <学科>/<学科>-<学段>.md（按片键，安全：仅当片键可解析）
 *   node scripts/deepReadIntake.mjs --selftest  # 合成样本自证（守卫有牙）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGE_SUBJECTS } from '../src/config/promptLibrary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'docs/audit/语义深读产出');
const REPORT = path.join(DIR, '_INTAKE-report.txt');
const ARGS = new Set(process.argv.slice(2));
const SWEEP = ARGS.has('--sweep');
const STRICT = ARGS.has('--strict');
const SELFTEST = ARGS.has('--selftest');

const EXPECT_EACH = 9; // 每片恰 9 份（9 个资料类型）

/** 学段别名 → canonical（容忍写法不一） */
const STAGE_ALIAS = {
  primary_low: ['primary_low', '小学低段', '低段', '小学低年级'],
  primary_mid: ['primary_mid', '小学中段', '中段', '小学中年级'],
  primary_high: ['primary_high', '小学高段', '高段', '小学高年级'],
  middle: ['middle', '初中', '初中学段'],
  high: ['high', '高中', '高中学段'],
};

/** 由 STAGE_SUBJECTS 构造期望片键集 */
function expectedKeys() {
  const keys = new Set();
  for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subjects) keys.add(`${subject}|${stage}`);
  }
  return keys;
}

/** 学科名归一：允许全/半角空格与首尾空白 */
function normSubject(raw) {
  const s = String(raw || '').replace(/[\s\u3000]/g, '');
  const all = new Set();
  for (const list of Object.values(STAGE_SUBJECTS)) for (const x of list) all.add(x);
  return all.has(s) ? s : null;
}

/** 学段名归一（含别名） */
function normStage(raw) {
  const s = String(raw || '').replace(/[\s\u3000]/g, '');
  for (const [canonical, aliases] of Object.entries(STAGE_ALIAS)) {
    if (aliases.includes(s)) return canonical;
  }
  return null;
}

/** 从首行解析片键与自报份数 */
function parseHead(firstLine) {
  if (!firstLine) return { ok: false, reason: '首行为空' };
  const re = /语义深读\s*[·・‧]?\s*([^×x✕｜|]+?)\s*[×x✕]\s*([^\s｜|]+)\s*[｜|]\s*片自证/;
  const m = String(firstLine).match(re);
  if (!m) return { ok: false, reason: '首行无「语义深读·<学科> × <学段>｜片自证」', raw: String(firstLine).trim() };
  const subject = normSubject(m[1]);
  const stage = normStage(m[2]);
  if (!subject) return { ok: false, reason: `学科名不可识别：${String(m[1]).trim()}`, raw: String(firstLine).trim() };
  if (!stage) return { ok: false, reason: `学段名不可识别：${String(m[2]).trim()}`, raw: String(firstLine).trim() };
  const cm = String(firstLine).match(/实际读到\s*(\d+)\s*份/);
  return { ok: true, key: `${subject}|${stage}`, subject, stage, reported: cm ? Number(cm[1]) : null };
}

/** 递归收集产出件（跳过 README 与下划线前缀的机器产物） */
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else if (ent.isFile() && /\.md$/i.test(ent.name) && ent.name !== 'README.md' && !ent.name.startsWith('_')) {
      out.push(full);
    }
  }
  return out;
}

function firstLine(file) {
  const txt = fs.readFileSync(file, 'utf8');
  return (txt.split(/\r?\n/).find((l) => l.trim()) || '').trim();
}

function runIntake() {
  const expected = expectedKeys();
  const files = walk(DIR).sort();
  const byKey = new Map();   // key -> [file]
  const unassigned = [];     // { file, reason, raw }
  const anomalies = [];      // 份数≠9 / 文件名或所在目录不符（仅提示）

  for (const file of files) {
    const line = firstLine(file);
    const p = parseHead(line);
    if (!p.ok) { unassigned.push({ file, reason: p.reason, raw: p.raw }); continue; }
    if (!byKey.has(p.key)) byKey.set(p.key, []);
    byKey.get(p.key).push({ file, reported: p.reported });
    if (p.reported !== EXPECT_EACH) {
      anomalies.push(`份数自报 ${p.reported === null ? '(未写)' : p.reported} ≠ ${EXPECT_EACH}｜${rel(file)}`);
    }
    const wantDir = path.join(DIR, p.subject);
    const wantName = `${p.subject}-${p.stage}.md`;
    if (path.dirname(file) !== wantDir || path.basename(file) !== wantName) {
      anomalies.push(`名称/位置不合约定（建议 ${path.join(p.subject, wantName)}）｜${rel(file)}`);
    }
  }

  const received = [...byKey.keys()];
  const missing = [...expected].filter((k) => !byKey.has(k));
  const notExpected = received.filter((k) => !expected.has(k));
  const duplicated = received.filter((k) => byKey.get(k).length > 1);

  // 归位（--sweep）
  const swept = [];
  if (SWEEP) {
    for (const [key, items] of byKey) {
      const [subject, stage] = key.split('|');
      const destDir = path.join(DIR, subject);
      const dest = path.join(destDir, `${subject}-${stage}.md`);
      fs.mkdirSync(destDir, { recursive: true });
      for (const it of items) {
        if (path.resolve(it.file) === path.resolve(dest)) continue;
        if (items.length > 1) continue; // 重复片不自动覆盖，留人工
        fs.renameSync(it.file, dest);
        swept.push(`${rel(it.file)} → ${rel(dest)}`);
      }
    }
  }

  const L = [];
  const push = (s = '') => L.push(s);
  push(`语义深读·收件核对｜${new Date().toISOString()}`);
  push(`期望片数＝${expected.size}（源：src/config/promptLibrary.js 的 STAGE_SUBJECTS）｜实收片数＝${received.length}｜缺失＝${missing.length}`);
  push('');
  push('【一、按学科核对（应含 = 该科实际开设学段数）】');
  const subjectsOrdered = [...new Set([...expected].map((k) => k.split('|')[0]))];
  for (const subject of subjectsOrdered) {
    const expStages = [...expected].filter((k) => k.startsWith(`${subject}|`)).map((k) => k.split('|')[1]);
    const gotStages = received.filter((k) => k.startsWith(`${subject}|`)).map((k) => k.split('|')[1]);
    const missStages = expStages.filter((s) => !gotStages.includes(s));
    push(`${subject}｜应含 ${expStages.length}（${expStages.join('/')}）｜已收 ${gotStages.length}｜缺 ${missStages.length ? missStages.join('/') : '—'}`);
  }
  push('');
  push('【二、缺失片（逐条）】');
  push(missing.length ? missing.map((k) => `  · ${k.split('|')[0]} × ${k.split('|')[1]}`).join('\n') : '  （无）');
  push('');
  push('【三、待归属（首行片自证无法解析 ⇒ 需人工认领，不静默忽略）】');
  push(unassigned.length ? unassigned.map((u) => `  · ${rel(u.file)}｜原因：${u.reason}${u.raw ? `｜首行：${u.raw}` : ''}`).join('\n') : '  （无）');
  push('');
  push('【四、非期望片键（格式对但不在开设集内）】');
  push(notExpected.length ? notExpected.map((k) => `  · ${k.split('|')[0]} × ${k.split('|')[1]}`).join('\n') : '  （无）');
  push('');
  push('【五、重复片键】');
  push(duplicated.length ? duplicated.map((k) => `  · ${k.split('|')[0]} × ${k.split('|')[1]} ⇒ ${byKey.get(k).map((x) => rel(x.file)).join(' , ')}`).join('\n') : '  （无）');
  push('');
  push('【六、异常提示（份数≠9 / 名称与位置不合约定）】');
  push(anomalies.length ? anomalies.map((a) => `  · ${a}`).join('\n') : '  （无）');
  if (SWEEP) {
    push('');
    push('【七、本次归位（--sweep）】');
    push(swept.length ? swept.map((s) => `  · ${s}`).join('\n') : '  （无）');
  }

  const report = L.join('\n') + '\n';
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(REPORT, report, 'utf8');
  process.stdout.write(report);

  const bad = unassigned.length + notExpected.length + duplicated.length + anomalies.length;
  if (STRICT && bad > 0) {
    console.error(`\n[STRICT] 异常 ${bad} 项 ⇒ 退出码 1`);
    process.exitCode = 1;
  }
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function selftest() {
  const cases = [
    ['# 语义深读·体育 × primary_mid｜片自证：实际读到 9 份', '体育|primary_mid', 9],
    ['# 语义深读·体育 × 高中｜片自证：实际读到 9 份', '体育|high', 9],
    ['# 语义深读·语文 × high | 片自证：实际读到 9 份', '语文|high', 9],
    ['# 语义深读·信息科技 × primary_high｜片自证：实际读到 8 份', '信息科技|primary_high', 8],
    ['# 语义深读·语文 × high', null, null],
    ['# 语义深读·体育学 × high｜片自证：实际读到 9 份', null, null],
    ['# 语义深读·体育 × 六年级｜片自证：实际读到 9 份', null, null],
  ];
  let fail = 0;
  for (const [line, key, reported] of cases) {
    const p = parseHead(line);
    const ok = (p.ok ? p.key : null) === key && (p.ok ? p.reported : null) === reported;
    if (!ok) { fail++; console.error(`✗ 期望 ${key}/${reported}，实得 ${JSON.stringify(p)}`); }
  }
  const exp = expectedKeys();
  if (exp.size !== 54) { fail++; console.error(`✗ 期望片键集应为 54，实得 ${exp.size}`); }
  if (fail === 0) console.log(`✓ selftest 通过：${cases.length} 条解析用例 + 期望集 54`);
  process.exitCode = fail ? 1 : 0;
}

if (SELFTEST) selftest();
else runIntake();
