/**
 * 旧方案/旧格式残留审计（audit-legacy）
 * ============================================================
 * 🔴 定位：把历轮审计发现的"旧格式/旧方案/旧名词"沉淀为可维护黑名单，
 *    一键扫描 src/ 与 git 已删除文件引用，输出残留清单，防止人工审计遗漏与回归。
 *
 * 用法：node scripts/audit-legacy.mjs [--all]
 *   --all   同时扫描 tests/（测试中常故意保留旧格式输入以验证清理逻辑，默认不扫）
 *
 * 输出三档：
 *   🔴 疑似残留  活的代码/数据中出现旧方案（应修复，除非另有理由）
 *   🟡 兼容保留  命中豁免规则（别名映射/旧数据兼容/历史说明注释，属有意保留）
 *   ⚪ 已删除文件引用  git 历史中删除的文件名仍出现在当前代码（断链或残留说明）
 *
 * 维护：发现新的旧方案 → 追加到 LEGACY 数组；豁免场景 → 追加到 exempt 正则。
 * ============================================================
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const TESTS = join(ROOT, 'tests');
const scanTests = process.argv.includes('--all');

/** 旧方案黑名单（name 描述 / re 匹配 / exempt 豁免正则——命中豁免则归为兼容保留） */
const LEGACY = [
  // ── A. 旧 [IMAGE] 契约格式（已统一为仅 PROMPT 画面描述，不指定生图引擎）──
  { name: '[IMAGE] TYPE:SD 引擎指定', re: /TYPE\s*[:：]\s*SD/gi, exempt: [/TYPE:SD STYLE|含 TYPE:SD|清除 TYPE:SD|不输出 TYPE:SD|not\.toContain\('TYPE:SD'\)|TYPE:SD 等引擎参数|TYPE:SD\/NEGATIVE|TYPE:SD 引擎|replace\(\/\^TYPE:SD/] },
  { name: '[IMAGE] SD 专属参数（NEGATIVE/WIDTH:800/HEIGHT:600）', re: /NEGATIVE\s*[:：]|\bWIDTH:\s*800\b|\bHEIGHT:\s*600\b/g, exempt: [/ARROW_STYLE|补齐缺失的 NEGATIVE|清除 TYPE:SD 等引擎参数|SD 专属参数/] },
  { name: '旧措辞 [配图说明]（应为 [IMAGE] 标记）', re: /\[配图说明\]/g, exempt: [/统一为 \[IMAGE\] 标记|残留旧措辞/] },

  // ── B. 旧方案模块/函数（活的代码不应引用）──
  { name: '旧方案模块引用（instructionLib/typedist/subjectContextLibrary/typeDistribution 等）', re: /instructionLib|typedist|subjectContextLibrary|typeDistribution/g, exempt: [/已迁出|旧 instructionLib|typedist 条目|不再注入|instructionLib\.js|旧 instructionLib「分析/] },
  { name: '旧生成路径函数（buildCompactAIInstruction/buildHtmlGenerationPrompt/generateBatchWithBlueprint）', re: /buildCompactAIInstruction|buildHtmlGenerationPrompt|generateBatchWithBlueprint/g, exempt: [/已移除|不再使用|已删除/] },
  { name: '旧整卷生成 buildGenerationInstruction（长指令构建，已弃）', re: /buildGenerationInstruction/g, exempt: [/不再使用 buildGenerationInstruction/] },
  { name: '旧蓝图规划/逐题生成流程（planner/Step3/Step4/五步/逐题）', re: /planner|五步生成|逐题生成|蓝图规划|Step3|Step4/g, exempt: [/原 planner 导出，planner 已删除|取代原 Step3|已移除|不再使用|已删除|蓝图规划/] },
  { name: '死代码保留声明文件（standardQuestionBank/examSampleLibrary/complianceAutoFix/recipeRegistry）', re: /standardQuestionBank|examSampleLibrary|complianceAutoFix|recipeRegistry/g, exempt: [/死代码保留供测试|已删除|不再调用/] },

  // ── C. 旧名词/旧数据键（数据层不应出现；别名映射与兼容逻辑豁免）──
  { name: '旧学科名"信息技术"（2022 课标名=信息科技）', re: /信息技术/g, exempt: [/'信息技术': '信息科技'|信息技术→信息科技|2022 新课标统一|兼容|subjectAliasMap|SUBJECT_ALIAS|信息技术课标|信息科技课标|高中信息技术课标|\|信息技术\||\|信息技术\s|\|信息技术\)/] },
  { name: '旧学段键"primary"（应细分 primary_low/mid/high）', re: /['"`]primary['"`]|primary\|/g, exempt: [/primary_low|primary_mid|primary_high|startsWith\('primary'\)|'小学': 'primary'|stageBase === 'primary'|base === 'primary'|stage \|\| 'primary'|value="primary"|stage: 'primary'|normalizeStage3|return 'primary'|兼容/] },
  { name: '旧资料类型名"听写/默写"（已统一为默写积累）', re: /听写\/默写|听写默写/g, exempt: [/留空|专用生成|知识型\/错题\/听写|听写格式|听写条目|听写推荐/] },
  { name: '旧注释"8 个子库"（当前 5 库均 ready）', re: /8 个子库/g, exempt: [] },

  // ── D. 空段死注释（迁移后残留的分隔注释）──
  { name: '空段死注释（课前预习/听写默写/阅读训练 专用生成）', re: /==================== 听写默写专用生成 ====================|==================== 阅读训练专用生成 ====================/g, exempt: [] },
];

/** 递归收集文件 */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(js|vue)$/.test(name)) acc.push(full);
  }
  return acc;
}

/** git 已删除文件（src/ 下） */
function deletedFiles() {
  try {
    const out = execSync('git log --all --diff-filter=D --name-only --format= -- src/', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return [...new Set(out.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^src\/.+\.(js|vue)$/.test(s)))];
  } catch { return []; }
}

const files = walk(SRC);
const hits = { red: [], yellow: [] };
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const rel = file.replace(ROOT, '');
  for (const item of LEGACY) {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!item.re.test(line)) continue;
      const isExempt = item.exempt.some((r) => r.test(line));
      (isExempt ? hits.yellow : hits.red).push({ file: rel, line: i + 1, name: item.name, text: line.trim().slice(0, 110), exempt: isExempt });
    }
  }
}

// ── 已删除文件引用检测 ──
const deleted = deletedFiles();
const delRefs = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const rel = file.replace(ROOT, '');
  for (const d of deleted) {
    const base = d.split('/').pop().replace(/\.(js|vue)$/, '');
    if (new RegExp(`['"].*${base}['"]|\\b${base}\\b`).test(content)) {
      const lineNo = content.split(/\r?\n/).findIndex((l) => l.includes(base)) + 1;
      const lineText = content.split(/\r?\n/)[lineNo - 1] || '';
      // 说明性提及（已删除/迁出/替代/移除/不再）属历史注释，归兼容保留
      const isNote = /已删除|已迁出|迁出|替代|已移除|不再|废弃|旧/.test(lineText);
      delRefs.push({ file: rel, deleted: d, line: lineNo, text: lineText.trim().slice(0, 100), note: isNote });
    }
  }
}

// ── 输出报告 ──
console.log('═══ 旧方案/旧格式残留审计 ═══\n');
console.log(`扫描范围：src/（${files.length} 文件）${scanTests ? ' + tests/' : ''}（--all 可含 tests/）\n`);
console.log(`🔴 疑似残留 ${hits.red.length} 处：`);
for (const h of hits.red) console.log(`  ${h.file}:${h.line}  [${h.name}]  ${h.text}`);
console.log(`\n🟡 兼容保留（豁免命中，属有意保留） ${hits.yellow.length} 处：`);
for (const h of hits.yellow) console.log(`  ${h.file}:${h.line}  [${h.name}]  ${h.text}`);
console.log(`\n⚪ git 已删除文件仍被引用 ${delRefs.length} 处（🟡 为历史说明注释）：`);
for (const d of delRefs) console.log(`  ${d.file}:${d.line}${d.note ? '  🟡' : '  🔴'}  引用已删除文件 ${d.deleted}  ${d.text}`);
if (scanTests) {
  const tHits = { red: [], yellow: [] };
  for (const file of walk(TESTS)) {
    const content = readFileSync(file, 'utf8');
    const rel = file.replace(ROOT, '');
    for (const item of LEGACY) {
      for (const line of content.split(/\r?\n/)) {
        if (!item.re.test(line)) continue;
        const isExempt = item.exempt.some((r) => r.test(line));
        (isExempt ? tHits.yellow : tHits.red).push(`  ${rel}  [${item.name}]  ${line.trim().slice(0, 100)}`);
      }
    }
  }
  console.log(`\n── tests/ 命中（旧格式输入多为验证清理逻辑，属预期）──`);
  console.log(`疑似 ${tHits.red.length} 处：`);
  for (const h of tHits.red) console.log(h);
  console.log(`兼容 ${tHits.yellow.length} 处`);
}
console.log('\n═══ 审计结束 ═══');
if (hits.red.length === 0 && delRefs.length === 0) console.log('✅ src/ 无旧方案/旧格式残留');
else console.log(`⚠ src/ 仍有 ${hits.red.length} 处疑似残留 + ${delRefs.length} 处已删除文件引用，见上`);
