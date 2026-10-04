// 唯一文本池抽取器（2026-10-04 · 高效法地基）
// 用途：对某个资料类型（默认 exam），枚举 54 对「学科×学段」的实发三源（cell／教辅注入／程序附加段），
//   把每份按「块/条」切分并去重，得到**唯一文本池**（判定单元），输出条数与清单摘要。
// 用法：node scripts/auditPool.mjs exam
import { getPromptTemplate, STAGE_SUBJECTS } from '../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../src/config/teachingBlueprints.js';
import { buildProgramAttach } from '../src/utils/programAttach.js';

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

// —— 相抵候选扫描（2026-10-04 · 用户质疑"为啥没查全" → 由人读改为机检候选） ——
// 相抵＝**同一对象上存在方向相反的两条要求**。人读按"条"看易漏**跨块/跨库的作用域重叠**
//   （cell × system × 蓝图注入各写一条、范围却不同）——故此处按"对象词 × 方向词"反查，做成常驻候选。
// 判据：同一对象词下，正向(必须/一律/应当) 与 反向(不得/禁止/不再/不复述) 两族句子、
//   且两两 token 重叠 ≥ 阈值（＝确在说同一件事）→ 输出为**相抵候选**，交人读终判（宁漏不误）。
const OBJECTS = ['分值', '大题标题', '小题题干', '标题', '题号', '序号', '作答位', '载体', '空位', '书写格', '情境', '唯一', '字数', '层级', '答案', '选项', '材料', '解析', '声明', '账目', '事实', '教材', '重复', '复述'];
const POS = /必须|一律|应当|须/;
const NEG = /不得|禁止|严禁|不许|不再|不复述|不另|不逐|不与|不改/;
const objGroups = new Map(); // obj -> { pos:[], neg:[] }
for (const s of lines) {
  const dir = POS.test(s) ? 'pos' : (NEG.test(s) ? 'neg' : null);
  if (!dir) continue;
  for (const o of OBJECTS) {
    if (!s.includes(o)) continue;
    if (!objGroups.has(o)) objGroups.set(o, { pos: [], neg: [] });
    objGroups.get(o)[dir].push(s);
  }
}
const oppos = [];
for (const [o, { pos, neg }] of objGroups) {
  for (const p of pos) for (const n of neg) {
    // 排除**门控变体**（同一句的学段/学科分支）：句首 30 字相同 == 同一条的正反两版，非相抵
    if (p.slice(0, 30) === n.slice(0, 30)) continue;
    const ov = jac(p, n);
    if (ov >= 0.3) oppos.push([o, ov, p, n]);
  }
}
// 同条"正反并现"：**一条之内**既下正向要求、又下反向要求 —— 上述"同条的两半相反"高发形态的候选
//   （不自动判相抵：多为"须A、不得B"的合法并存 → 只作**人读候选**）
const bothDir = lines.filter((s) => POS.test(s) && NEG.test(s));
console.log(`\n== 相抵候选 ==  对象×方向可配对 ${oppos.length} 对；同条正反并现候选 ${bothDir.length} 条`);
oppos.slice(0, 20).forEach(([o, ov, p, n]) => console.log(`  [${o}] ${ov.toFixed(2)} ${p.slice(0, 26)} ⇔ ${n.slice(0, 26)}`));
console.log(`  （同条正反并现=${bothDir.length}，见文档候选表；人读终判）`);
fs.appendFileSync(OUT,
  '\n\n## 相抵候选（对象×方向 · 人读终判）\n'
  + `\n共 ${oppos.length} 对（已排除门控变体：句首 30 字相同）。\n`
  + oppos.map(([o, ov, p, n], i) => `- O${i + 1} [${o} ${ov.toFixed(2)}]\n  - 正：${p}\n  - 反：${n}`).join('\n')
  + `\n\n## 同条正反并现候选（须A、不得B 形态 · ${bothDir.length} 条 · 人读）\n`
  + bothDir.map((s, i) => `- B${i + 1} ${s}`).join('\n'), 'utf8');

function poolPairs() {
  const out = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) { const s = similar(lines[i], lines[j]); if (s >= 0.8) out.push([s, lines[i], lines[j]]); }
  return out;
}
