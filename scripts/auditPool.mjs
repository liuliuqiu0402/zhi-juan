// 唯一文本池抽取器（2026-10-04 · 高效法地基）
// 用途：对某个资料类型（默认 exam），枚举 54 对「学科×学段」的实发三源（cell／教辅注入／程序附加段），
//   把每份按「块/条」切分并去重，得到**唯一文本池**（判定单元），输出条数与清单摘要。
// 用法：node scripts/auditPool.mjs exam
import { getPromptTemplate, STAGE_SUBJECTS } from '../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../src/config/teachingBlueprints.js';
import { buildProgramAttach } from '../src/utils/programAttach.js';
import { listValidatorRules } from '../src/config/validatorRules.js';

const genType = process.argv[2] || 'exam';
const pairs = Object.entries(STAGE_SUBJECTS).flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));

/** 把一段文本切成"条"：以行首 `·` 为一条；块标题（【…】独占行）单列；其余行首非空的行各成一条 */
function toUnits(text, tag) {
  const out = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    out.push({ tag, line });
  }
  return out;
}

const pool = new Map(); // line -> Set(tag)
const cellUnits = new Map(); // 每份（学科/学段）的条集合（用于"同份内"判稀释）
const tagCount = new Map();
let assembled = 0;
for (const { stage, subject } of pairs) {
  try {
    const tpl = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
    const teach = buildTeachingInjection({ genType, stage, subject }) || '';
    const sys = buildProgramAttach({ subject, stageKey: stage, genType, instructionText: tpl }) || '';
    assembled += 1;
    const units = [
      ...toUnits(tpl, `cell:${subject}/${stage}`),
      ...toUnits(teach, `teach:${subject}/${stage}`),
      ...toUnits(typeof sys === 'string' ? sys : (sys.text || ''), `sys:${subject}/${stage}`),
    ];
    cellUnits.set(`${subject}/${stage}`, units.map((u) => u.line));
    for (const u of units) {
      const key = u.line;
      if (!pool.has(key)) pool.set(key, new Set());
      pool.get(key).add(u.tag.split(':')[0]);
      tagCount.set(u.tag.split(':')[0], (tagCount.get(u.tag.split(':')[0]) || 0) + 1);
    }
  } catch (e) {
    console.error(`[skip] ${subject}/${stage}: ${e.message}`);
  }
}

console.log(`资料类型=${genType}  装配份数=${assembled}/${pairs.length}`);
console.log(`各源原始条数：`, Object.fromEntries(tagCount));
console.log(`唯一文本池条数=${pool.size}`);
// 打印前 40 条长度分布与样例（供人工判定起步）
const arr = [...pool.keys()];
const byLen = arr.map((s) => s.length).sort((a, b) => a - b);
const q = (p) => byLen[Math.min(byLen.length - 1, Math.floor(byLen.length * p))];
console.log(`条长分布：min=${q(0)} p25=${q(0.25)} p50=${q(0.5)} p75=${q(0.75)} p90=${q(0.9)} max=${q(0.999)}`);
console.log(`长条(>250)条数=${arr.filter((s) => s.length > 250).length}`);

// —— 导出唯一文本池清单 ——
import * as fs from 'node:fs';
const lines = arr.slice();
const doc = ['# 唯一文本池 · 正式考卷（exam）', '',
  `> 生成：\`node scripts/auditPool.mjs exam\` ｜ 装配 ${assembled}/${pairs.length} ｜ 唯一条 **${lines.length}**`, '',
  '| # | 长度 | 源 | 文本 |', '|---:|---:|---|---|',
  ...lines.map((s, i) => `| ${i + 1} | ${s.length} | ${[...pool.get(s)].join('/')} | ${s.replace(/\|/g, '\\|')} |`)].join('\n');
const OUT = 'docs/audit/池-正式考卷.md'; // 🔴 不得落 docs/design（singleSourceGuard 扫该目录、池含单源字面）
fs.mkdirSync('docs/audit', { recursive: true });
fs.writeFileSync(OUT, doc, 'utf8');

// —— 候选扫描（人只判候选池） ——
const NEUTRAL = /务必|切记|特别提醒|请注意/;   // 提醒诱导词（**不含**判据词"必须/严禁"——2026-10-04 精准化）
const PERMISSIVE = /(?:用|填|写|标)[^。；]{0,8}(?:或者|或)[^。；]{0,8}(?:作答|表示|标记|处理)/; // "形态A 或 形态B"句法（裸"或"不算）
// token 级指纹（中文片段/英文词/数字）——避免"字符集 Jaccard"把门控变体（CO⇔FO 等）误判为 1.0
const toks = (s) => (String(s).toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z]+|\d+/g) || []);
const jac = (a, b) => { const A = new Set(toks(a)), B = new Set(toks(b)); let i = 0; for (const t of A) if (B.has(t)) i++; return i / (A.size + B.size - i); };
const similar = (a, b) => {
  if (a.length < 12 || b.length < 12) return 0;
  if (Math.min(a.length, b.length) / Math.max(a.length, b.length) < 0.7) return 0;
  return jac(a, b);
};
console.log(`候选：强/提醒措辞 ${lines.filter((s) => NEUTRAL.test(s)).length} 条；许可式(或) ${lines.filter((s) => PERMISSIVE.test(s)).length} 条；长条>250 ${lines.filter((s) => s.length > 250).length} 条`);
console.log(`池级高相似对（**仅线索**，含跨维度同源）：${poolPairs().length} 对`);

/** 🔴 口径（2026-10-04）：稀释只在"同一份实发内"判——池是 54 份的并集，跨维度同源不算重复 */
console.log(`\n== 同份内重复（真稀释候选） ==`);
let intraTotal = 0; const intraHits = [];
for (const [cellId, units] of cellUnits) {
  const u = [...new Set(units)];
  for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) {
    const s = similar(u[i], u[j]);
    if (s >= 0.8) { intraTotal += 1; if (intraHits.length < 12) intraHits.push([cellId, s, u[i], u[j]]); }
  }
}
console.log(`同份内高相似对数=${intraTotal}`);
intraHits.forEach(([id, s, a, b]) => console.log(`  [${id}] ${s.toFixed(2)} | ${a.slice(0, 28)} ⇔ ${b.slice(0, 28)}`));
console.log(`已写 ${OUT}`);

// —— 候选池导出（人判入口） ——
const strongHits = lines.filter((s) => NEUTRAL.test(s));
const permHits = lines.filter((s) => PERMISSIVE.test(s));
const longHits = lines.filter((s) => s.length > 250);
fs.appendFileSync(OUT,
  '\n\n## 候选池（人判入口）\n'
  + `\n### 强/提醒措辞（${strongHits.length}）\n` + strongHits.map((s, i) => `- S${i + 1}（${s.length}）${s}`).join('\n')
  + `\n\n### 许可式·含"或"（${permHits.length}）\n` + permHits.map((s, i) => `- P${i + 1}（${s.length}）${s}`).join('\n')
  + `\n\n### 长条 >250（${longHits.length}）\n` + longHits.map((s, i) => `- L${i + 1}（${s.length}）${s}`).join('\n'), 'utf8');
console.log(`候选池已追加（强${strongHits.length}／许可${permHits.length}／长条${longHits.length}）`);

// —— 相抵候选扫描（2026-10-06 · 附·3 方法补齐：按**对象族**并组，不按单词配对） ——
// 病症（第一批二次实测校准）：原实现按**单词**分组配正反 → `大题标题` 与 `小题题干` 分属两组、配不成对，
//   而真相抵（"大题标题须点明作答方式" × "小题题干不得复述作答方式"）恰在此族之间 → 报 0。
// 口径（执行文档 附·3）：设**对象族**，族内做正×反配对（阈值放到**线索级**、宁多不漏，交人读）；
//   并另出「按族全量清单」——同一对象的相关判据常分散多条，逐条读都对、合起来才互拉，须**整族读**。
const OBJECT_GROUPS = {
  '层级/题号族': ['大题标题', '小题题干', '题名', '标题', '题号', '序号', '层级', '小题', '子题', '编号'],
  '分值/账目族': ['分值', '账目', '满分', '小题分', '总分'],
  '载体/作答位族': ['作答位', '载体', '空位', '书写格', '空白行', '横线', '留白'],
  '段落/排版族': ['段落', '分行', '排布', '缩进', '居中'],
  '材料/情境族': ['材料', '情境', '选文', '引文'],
  '答案/解析族': ['答案', '解析', '评分', '正确答案'],
  '唯一性族': ['唯一', '重复', '复述', '雷同', '不重复'],
};
const POS = /必须|一律|应当|须/;
const NEG = /不得|禁止|严禁|不许|不再|不复述|不另|不逐|不与|不改/;
const groupOf = new Map(); // 族 -> { pos:[], neg:[] }
for (const s of lines) {
  const pos = POS.test(s), neg = NEG.test(s);
  if (!pos && !neg) continue;
  for (const [g, words] of Object.entries(OBJECT_GROUPS)) {
    if (!words.some((o) => s.includes(o))) continue;
    if (!groupOf.has(g)) groupOf.set(g, { pos: [], neg: [] });
    if (pos) groupOf.get(g).pos.push(s);
    if (neg) groupOf.get(g).neg.push(s);
  }
}
const oppos = [];
for (const [g, { pos, neg }] of groupOf) {
  for (const p of pos) for (const n of neg) {
    if (p === n) continue;
    // 排除**门控变体**：①句首 30 字相同（同一条的正反两版）；②**去括注去标点后同句/互为子串**——
    //    学科/学段分支只差括注与标点（"…书写的题，输出…"／"…书写的题（含成篇表达）输出…"），并非相抵。
    if (p.slice(0, 30) === n.slice(0, 30)) continue;
    const strip = (s) => String(s).replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').replace(/[，。；、：,.;:\s·*]/g, '');
    const sp = strip(p), sn = strip(n);
    if (sp === sn || (sp.length !== sn.length && (sp.includes(sn) || sn.includes(sp)))) continue;
    const ov = jac(p, n);
    if (ov >= 0.12) oppos.push([g, ov, p, n]); // 线索级阈值（附·3：宁多不漏）
  }
}
// 同条"正反并现"：**一条之内**既下正向要求、又下反向要求 —— "同条的两半相反"高发形态的候选
//   （不自动判相抵：多为"须A、不得B"的合法并存 → 只作**人读候选**）
const bothDir = lines.filter((s) => POS.test(s) && NEG.test(s));
console.log(`\n== 相抵候选（对象族并组）==  族内可配对 ${oppos.length} 对；同条正反并现候选 ${bothDir.length} 条`);
oppos.slice(0, 24).forEach(([o, ov, p, n]) => console.log(`  [${o}] ${ov.toFixed(2)} ${p.slice(0, 26)} ⇔ ${n.slice(0, 26)}`));

// —— 按对象族全量清单（附·3 第 2 条：跨条同对象核对 · 整族读） ——
const groupLists = Object.entries(OBJECT_GROUPS).map(([g, words]) => ({
  g, set: lines.filter((s) => words.some((o) => s.includes(o))),
}));
fs.appendFileSync(OUT,
  '\n\n## 相抵候选（**对象族**并组 · 人读终判）\n'
  + `\n共 ${oppos.length} 对（族内正×反；已排除门控变体：句首 30 字相同；阈值＝线索级）。\n`
  + oppos.map(([o, ov, p, n], i) => `- G${i + 1} [${o} ${ov.toFixed(2)}]\n  - 正：${p}\n  - 反：${n}`).join('\n')
  + `\n\n## 按对象族全量清单（**跨条同对象核对** · 整族读，判"口子／相抵／层级错位"）\n`
  + groupLists.map(({ g, set }) => `\n### ${g}（${set.length} 条）\n` + set.map((s, i) => `- ${i + 1}. ${s}`).join('\n')).join('\n')
  + `\n\n## 同条正反并现候选（须A、不得B 形态 · ${bothDir.length} 条 · 人读）\n`
  + bothDir.map((s, i) => `- B${i + 1} ${s}`).join('\n'), 'utf8');

// —— 程序侧改写清单（附·3 第 3 条：程序链纳入体检） ——
//   fix 类规则会**改写产物形态** → 逐条核"该形态的 cell 判据与程序改写结果同口径"（防"程序把模型给对的东西改坏"）。
const fixRules = listValidatorRules().filter((r) => r.category === 'fix');
fs.appendFileSync(OUT,
  `\n\n## 程序侧改写清单（**fix 类规则** · ${fixRules.length} 条 · 逐条核"cell 判据 ↔ 改写结果"同口径）\n`
  + fixRules.map((r) => `- \`${r.id}\`｜${r.name}｜注入：${r.promptHint || '（无 promptHint）'}`).join('\n'), 'utf8');
console.log(`程序侧 fix 类规则 ${fixRules.length} 条已列入清单`);

function poolPairs() {
  const out = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) { const s = similar(lines[i], lines[j]); if (s >= 0.8) out.push([s, lines[i], lines[j]]); }
  return out;
}
