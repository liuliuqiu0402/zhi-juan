// 防回潮守卫：四个跨模块共享的 localStorage 业务键**不得再以字面量出现在消费点**
// ============================================================================
// 背景：GENERATED_DOCS / DOC_HISTORY / TEXTBOOKS / TEMPLATES 曾散落字面量于
//   App.vue / GenerateModule / HistoryModule / textbookStore / templateStore / TypesetModule
//   等多处消费点。拼写漂移 = 数据静默读写错位（读到旧值 / 写丢新值），已收口到
//   src/constants/storageKeys.js 的 STORAGE_KEYS.*（唯一命名来源）。
//   本条把"已迁移"锁成可回归的不变量：有人再把字面量写回消费点即 CI 红。
//
// 允许出现字面量的**四个**位置（白名单显式列明，见下方 WHITELIST，含逐条原因）：
//   ① src/constants/storageKeys.js            —— 键注册表定义处（唯一命名来源）
//   ② src/utils/cloudStorage.ts                —— Supabase 表名（.from('textbooks'/'templates')）
//   ③ src/App.vue                              —— 云同步载荷字段名（unilateralData.textbooks 等）
//   ④ tests/                                   —— 用例值（mock / 期望数据，非生产消费点）
//
// 🔴 防"看起来是键其实不是键"被误改（本守卫刻意**不**把这些当键）：
//   · Supabase 表名 'generated_docs' / 'doc_history' 与 localStorage 键
//     'wisdom_generated_docs' / 'docHistory' **不是同一个字符串**（下划线/前缀不同），
//     故不在受守卫四键之内 —— 谁若"顺手统一"改成 STORAGE_KEYS.*，反而是把表名改错。
//   · cloudStorage 的 .from('textbooks') / .from('templates') 是**数据库表名**恰好与
//     localStorage 键同值，同属"同值不同义"，只能保留字面量（见规则②）。
//   · App.vue 的 textbooks: / templates: 是**同步载荷对象字段名**（unilateralData 的键），
//     不是存储键；未加引号的标识符本就不在检测范围，规则③仅兜底"被写成带引号字段名"的等价写法。
//
// 失败时的修复方向：把字面量替换为 STORAGE_KEYS.*（import 自 src/constants/storageKeys.js），
// 若确属新增的合法"同值不同义"点，请连同原因补进下方 WHITELIST，而不是放行整文件。
// ============================================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// 受守卫的四个 localStorage 键：值（字面量） → 应改用的常量
const GUARDED = {
  wisdom_generated_docs: 'STORAGE_KEYS.GENERATED_DOCS',
  docHistory: 'STORAGE_KEYS.DOC_HISTORY',
  textbooks: 'STORAGE_KEYS.TEXTBOOKS',
  templates: 'STORAGE_KEYS.TEMPLATES',
};

// 扫描范围与文件类型（源码在 src/；tests/ 由白名单④整目录放行）
const SCAN_DIRS = ['src', 'tests'];
const SCAN_EXT = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.vue']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);

// 命中判据：**带引号的字面量**（单/双/反引号）。未加引号的标识符（如 unilateralData.textbooks、
// 常量引用 STORAGE_KEYS.TEXTBOOKS）天然不命中，无需白名单。
const KEY_PATTERN = Object.keys(GUARDED).join('|');
const LITERAL_RE_SOURCE = "(['\"`])(" + KEY_PATTERN + ")\\1";

/**
 * 白名单：显式列明"允许出现字面量"的位置 + 原因 + 该位置内的精确放行形状。
 * match：文件判定；allow：行内形状判定（line 为命中行 trim 后的文本，key 为命中键）。
 * 规则按顺序匹配，命中任一即放行；每条都绑定原因，防止"看起来是键其实不是键"被误改。
 */
const WHITELIST = [
  {
    match: (file) => file === 'src/constants/storageKeys.js',
    // ① 定义处：形如 `GENERATED_DOCS: 'wisdom_generated_docs',`
    allow: (line, key) => new RegExp(":\\s*['\"`]" + key + "['\"`]").test(line),
    reason: "① src/constants/storageKeys.js —— key 注册表定义处（唯一命名来源，值只能在这里写）",
  },
  {
    match: (file) => file === 'src/utils/cloudStorage.ts',
    // ② Supabase 表名：形如 `.from('textbooks')` / `.from('templates')`
    //    与 localStorage 键同值但不同义（数据库表名），必须保留字面量
    allow: (line, key) => line.indexOf(".from('" + key + "')") !== -1 || line.indexOf('.from("' + key + '")') !== -1,
    reason: "② src/utils/cloudStorage.ts —— Supabase 表名 .from('textbooks'/'templates')（同值不同义，非 localStorage 键）",
  },
  {
    match: (file) => file === 'src/App.vue',
    // ③ 云同步载荷字段名：仅放行"带引号的对象字段名"（如 `'textbooks': data`）。
    //    `storage.setItem('textbooks', …)` 这类真存储键消费点不会被放行（其后是逗号非冒号）。
    allow: (line, key) => new RegExp("['\"`]" + key + "['\"`]\\s*:").test(line),
    reason: "③ src/App.vue —— 云同步载荷字段名（unilateralData.textbooks / templates 的带引号写法）",
  },
  {
    match: (file) => file === 'tests' || file.indexOf('tests/') === 0 || file.indexOf('tests\\') === 0,
    // ④ 用例值：测试里的 mock 返回值 / 期望数据，不是生产消费点
    allow: () => true,
    reason: '④ tests/ —— 用例值（mock / 期望数据，非生产消费点）',
  },
];

/** 递归收集待扫描文件（绝对路径） */
function walkFiles(absDir, out = []) {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) walkFiles(abs, out);
    else if (entry.isFile() && SCAN_EXT.has(path.extname(entry.name))) out.push(abs);
  }
  return out;
}

const toRel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

/** 行扫描：返回 [{ key, line, text }]（text 为 trim 后的整行） */
function scanSource(src) {
  const hits = [];
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const re = new RegExp(LITERAL_RE_SOURCE, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      hits.push({ key: m[2], line: i + 1, text: line.trim() });
    }
  }
  return hits;
}

/** 判定单条命中：命中任一白名单规则即 { allowed: true, reason } */
function verdict(hit) {
  for (const rule of WHITELIST) {
    if (rule.match(hit.file) && rule.allow(hit.text, hit.key)) {
      return { allowed: true, reason: rule.reason };
    }
  }
  return { allowed: false, reason: null };
}

// 白名单中显式点名的文件：必须真实存在于扫描集，否则规则永不命中 → "假绿"
const EXPLICIT_FILES = ['src/constants/storageKeys.js', 'src/utils/cloudStorage.ts', 'src/App.vue'];

describe('localStorage 键字面量防回潮（四键须经 STORAGE_KEYS，白名单四点显式放行）', () => {
  const files = SCAN_DIRS.flatMap((d) => walkFiles(path.join(ROOT, d)));
  const relSet = new Set(files.map(toRel));

  it('扫描范围有效（防路径失效导致空扫描假绿）', () => {
    expect(files.length, '扫描到的源码/测试文件数异常偏少，疑似扫描路径失效').toBeGreaterThan(50);
    expect(relSet.has('src/App.vue')).toBe(true);
    expect(relSet.has('src/constants/storageKeys.js')).toBe(true);
  });

  it('白名单显式点名的文件均存在（防路径拼错使规则永不命中）', () => {
    const missing = EXPLICIT_FILES.filter((f) => !relSet.has(f));
    expect(missing, `白名单点名文件不存在：${missing.join('、')}`).toEqual([]);
  });

  it('探测器自检：能命中四键字面量，且**不**误伤表名 generated_docs/doc_history 与常量引用', () => {
    const sample = [
      "const k = localStorage.getItem('wisdom_generated_docs');",
      'const h = localStorage.getItem("docHistory");',
      "await storage.setItem('textbooks', list);",
      "const t = localStorage.getItem(`templates`);",
      // 以下三者**不**应命中：
      "client.from('generated_docs').select('data');", // 表名，非本键
      "client.from('doc_history').select('data');",    // 表名，非本键
      'storage.setItem(STORAGE_KEYS.TEXTBOOKS, list);', // 常量引用，无字面量
    ];
    const hits = scanSource(sample.join('\n'));
    const found = hits.map((h) => h.key).sort();
    expect(found).toEqual(['docHistory', 'templates', 'textbooks', 'wisdom_generated_docs'].sort());
    // 显式确认表名不被当作键
    expect(hits.some((h) => h.key === 'generated_docs')).toBe(false);
    expect(hits.some((h) => h.key === 'doc_history')).toBe(false);
  });

  it('白名单自检：点名单文件内也仅放行限定形状（非整文件放行）', () => {
    // cloudStorage：表名放行，真存储键消费点不放行
    expect(verdict({ file: 'src/utils/cloudStorage.ts', key: 'textbooks', text: ".from('textbooks')" }).allowed).toBe(true);
    expect(verdict({ file: 'src/utils/cloudStorage.ts', key: 'textbooks', text: "localStorage.getItem('textbooks')" }).allowed).toBe(false);
    // App.vue：带引号的载荷字段名放行，真存储键消费点不放行
    expect(verdict({ file: 'src/App.vue', key: 'templates', text: "'templates': tps," }).allowed).toBe(true);
    expect(verdict({ file: 'src/App.vue', key: 'templates', text: "storage.setItem('templates', x)" }).allowed).toBe(false);
    // 注册表：定义形状放行，非定义形状不放行
    expect(verdict({ file: 'src/constants/storageKeys.js', key: 'docHistory', text: "  DOC_HISTORY: 'docHistory'," }).allowed).toBe(true);
    expect(verdict({ file: 'src/constants/storageKeys.js', key: 'docHistory', text: "storage.getItem('docHistory')" }).allowed).toBe(false);
    // tests：用例值放行
    expect(verdict({ file: 'tests/components/HistoryModule.test.ts', key: 'docHistory', text: "if (key === 'docHistory') return [];" }).allowed).toBe(true);
  });

  it('注册表定义四键且取值精确（单一事实源自洽）', () => {
    const reg = fs.readFileSync(path.join(ROOT, 'src/constants/storageKeys.js'), 'utf8');
    for (const [value, constant] of Object.entries(GUARDED)) {
      const name = constant.replace('STORAGE_KEYS.', '');
      // 形如 `NAME: 'value',`
      expect(reg, `注册表缺少 ${name}: '${value}'`).toMatch(new RegExp("\\b" + name + ":\\s*['\"`]" + value + "['\"`]"));
    }
  });

  it('全量扫描：四键字面量零越界（消费点必须引用 STORAGE_KEYS）', () => {
    const hits = [];
    for (const abs of files) {
      const rel = toRel(abs);
      for (const h of scanSource(fs.readFileSync(abs, 'utf8'))) hits.push({ ...h, file: rel });
    }
    const bad = hits.filter((h) => !verdict(h).allowed);
    const msg = bad.length
      ? `发现 ${bad.length} 处 localStorage 键字面量消费点，应改用 STORAGE_KEYS.*（唯一来源：src/constants/storageKeys.js）：\n` +
        bad.map((h) => `  · ${h.file}:${h.line}  键【${h.key}】→ 应用 ${GUARDED[h.key]}\n      ${h.text}`).join('\n') +
        `\n若属新增的合法"同值不同义"点（表名/载荷字段名），请连同原因补进本测试 WHITELIST，而非直接放行整文件。`
      : '';
    expect(bad, msg).toEqual([]);
    // 至少证明白名单规则确实被真实命中（否则可能因路径失效而空过）
    expect(hits.length, '未扫描到任何受守卫键字面量，疑似键表/正则失效').toBeGreaterThan(0);
  });
});
