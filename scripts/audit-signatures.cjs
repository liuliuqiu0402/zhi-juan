// 审计脚本：扫描 src 下所有 JS/Vue 的 export/import，找出：
// 1. 定义了但从未被任何地方 import 的导出（死导出/旧残留）
// 2. import 了但在目标模块中找不到对应导出的名字（悬空引用）
// 只读扫描，不修改任何文件。
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

function isImportable(f) {
  return /\.(js|vue|mjs)$/.test(f) ;
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(full, acc);
    } else if (isImportable(full)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(SRC);

// 解析 export 名
function findExports(src) {
  const names = new Set();
  // export const X / export function X / export class X / export async function X
  const decl = src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g);
  for (const m of decl) names.add(m[1]);
  // export default
  if (/\bexport\s+default\b/.test(src)) names.add('default');
  // export { A, B as C }
  const list = src.matchAll(/export\s*\{([^}]*)\}/g);
  for (const m of list) {
    const inner = m[1];
    for (const raw of inner.split(',')) {
      const t = raw.trim();
      if (!t) continue;
      // A as C -> local name A
      const mm = t.match(/^([A-Za-z_$][\w$]*)/);
      if (mm) names.add(mm[1]);
    }
  }
  return names;
}

// 解析 import 名（含 default 与 named）
function findImports(src) {
  const names = new Set();
  // import X from
  const def = src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from/g);
  for (const m of def) names.add(m[1]);
  // import X, { A } from
  const combined = src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^}]*)\}\s*from/g);
  for (const m of combined) {
    names.add(m[1]);
    for (const raw of m[2].split(',')) {
      const mm = raw.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (mm) names.add(mm[1]);
    }
  }
  // import { A, B as C } from
  const named = src.matchAll(/import\s*\{([^}]*)}\s*from/g);
  for (const m of named) {
    for (const raw of m[1].split(',')) {
      const t = raw.trim();
      if (!t) continue;
      const mm = t.match(/([A-Za-z_$][\w$]*)/);
      if (mm) names.add(mm[1]);
    }
  }
  return names;
}

// 建立文件名 -> 导出集合
const exportsByFile = new Map();
const fileContent = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  fileContent.set(f, src);
  exportsByFile.set(f, findExports(src));
}

// 消费统计：全项目所有 import 名（除自身文件）
const consumeCount = new Map(); // name -> count
for (const f of files) {
  const src = fileContent.get(f);
  const dir = path.dirname(f);
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  // 收集该文件引用的本地模块相对路径
  const localRefs = new Set();
  const impFrom = src.matchAll(/import\s+(?:[^'"`]*?\s+from\s+)?['"`]([^'\"`]+)['"`]/g);
  for (const m of impFrom) {
    const p = m[1];
    if (p.startsWith('.') || p.startsWith('/')) localRefs.add(p);
  }
}

// 统计每个名字在整个项目（除定义文件自身）中被 import 的次数（按导入语句，宽松）
// 构造 name->sourceFilesThatImportIt
const nameToImportFiles = new Map();
for (const f of files) {
  const src = fileContent.get(f);
  const names = findImports(src);
  for (const n of names) {
    if (!nameToImportFiles.has(n)) nameToImportFiles.set(n, new Set());
    nameToImportFiles.get(n).add(path.relative(SRC, f).replace(/\\/g, '/'));
  }
}

// 逐文件判断每个导出是否被消费（被重导出 count 来自其它文件 import 该名）
const report = [];
for (const f of files) {
  const myExports = exportsByFile.get(f);
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  const src = fileContent.get(f);
  for (const name of myExports) {
    // 被其它文件 import 的次数 = 所有 import 文件中出现的次数
    let consumed = 0;
    for (const [impFile, impNames] of nameToImportFiles) {
      if (impFile === rel) continue; // 排除自身
      if (impNames.has(name)) consumed++;
    }
    report.push({ rel, name, consumed });
  }
}

// 输出未消费导出
console.log('===== A. 定义为导出但未被其它文件 import（候选死导出/旧残留）=====');
let deadCount = 0;
for (const r of report.sort((a, b) => b.consumed - a.consumed)) {
  if (r.consumed === 0) {
    console.log(`[0消费] ${r.rel}  ::  export ${r.name}`);
    deadCount++;
  }
}
console.log(`\n未消费导出总数: ${deadCount}`);

// 悬空 import：import 的名字在该模块导出中不存在
console.log('\n===== B. 悬空 import（import 名在目标模块无对应导出）=====');
const dangling = [];
for (const f of files) {
  const src = fileContent.get(f);
  const dir = path.dirname(f);
  const srcRel = path.relative(SRC, f).replace(/\\/g, '/');
  const impBlock = src.matchAll(/import\s+(\{[^}]*\}|\w[\w$]*)\s+from\s+['"`]([^'"`]+)['"`]/g);
  for (const m of impBlock) {
    const spec = m[1].trim();
    const target = m[2];
    if (!(target.startsWith('.') || target.startsWith('/'))) continue;
    const targetPath = path.resolve(dir, target);
    // 解析到实际文件
    const candidates = [];
    if (fs.existsSync(targetPath)) candidates.push(targetPath);
    if (fs.existsSync(targetPath + '.js')) candidates.push(targetPath + '.js');
    if (fs.existsSync(targetPath + '.mjs')) candidates.push(targetPath + '.mjs');
    if (fs.existsSync(path.join(targetPath, 'index.js'))) candidates.push(path.join(targetPath, 'index.js'));
    const tgt = candidates[0];
    if (!tgt || !fileContent.has(tgt)) continue;
    const tgtExports = exportsByFile.get(tgt);
    // 解析导入名
    let importedNames = [];
    if (spec.startsWith('{')) {
      for (const raw of spec.slice(1, -1).split(',')) {
        const t = raw.trim();
        if (!t) continue;
        const mm = t.match(/^([A-Za-z_$][\w$]*)/);
        if (mm) importedNames.push(mm[1]);
      }
    } else {
      importedNames.push('default');
    }
    for (const n of importedNames) {
      if (!tgtExports.has(n)) {
        dangling.push({ from: srcRel, target: path.relative(SRC, tgt).replace(/\\/g, '/'), name: n });
      }
    }
  }
}
for (const d of dangling) {
  console.log(`✗ ${d.from}  import { ${d.name} } from '${d.target}'  —— 目标模块无此导出`);
}
console.log(`\n悬空 import 总数: ${dangling.length}`);