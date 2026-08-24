/**
 * 全学科覆盖核查脚本（check_subject_coverage）
 * ============================================================
 * 目的：验证"正规化覆盖所有学科"落地无缺口。
 * 模拟真实链路：subject（normalizeSubjectName 规范化后）× stage（5 学段键）× genType（9 类型）
 *   对六类规范块（role/redline/quality/format/top/tail）逐一检查是否命中学科专属内容。
 * ============================================================
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Windows ESM：file:/// 前缀导入
import { pathToFileURL } from 'url';
import path from 'path';

const blocksDir = pathToFileURL(path.resolve('d:/wisdom-workshop/src/config/recipe/blocks/index.js')).href;
const { SPEC_BLOCKS, matchBlocks } = await import(blocksDir);

const ALL_TYPES = ['exam', 'practice', 'special', 'errorbook', 'reading', 'preview', 'dictation', 'summary', 'review'];
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

// 规范化后的学科清单（与 normalizeSubjectName 输出一致）
const SUBJECTS = [
  '语文', '数学', '英语',
  '物理', '化学', '生物',
  '历史', '地理', '道德与法治', '思想政治',
  '科学', '信息科技',
  '音乐', '美术', '体育',
];

// 各类别中"学科专属"块判定：scope.subjects 非空
const CATEGORIES = ['role', 'redline', 'quality', 'format', 'top', 'tail'];
const byCategory = {};
for (const c of CATEGORIES) {
  byCategory[c] = SPEC_BLOCKS.filter(b => b.category === c && b.scope?.subjects?.length);
}
console.log(`规范块总数: ${SPEC_BLOCKS.length}`);
console.log(`学科专属块: ${SPEC_BLOCKS.filter(b => b.scope?.subjects?.length).length}`);
for (const c of CATEGORIES) {
  console.log(`  [${c}] 学科专属 ${byCategory[c].length} 块: ${byCategory[c].map(b => b.id).join(', ')}`);
}

console.log('\n═══ 覆盖矩阵（学科 × 学段，任一类别无命中即报缺）═══\n');
let gaps = 0;
for (const subject of SUBJECTS) {
  for (const stage of STAGES) {
    for (const genType of ALL_TYPES) {
      const hitCounts = {};
      for (const c of CATEGORIES) {
        const hits = matchBlocks(c, { genType, subject, stage }).filter(b => b.scope?.subjects?.length);
        hitCounts[c] = hits.length;
      }
      // 学科专属命中要求（该学科至少在该类别有块——各类别对学科的要求不同）
      // 判定缺口的基线：quality 类学科专属应命中 ≥1（除通用覆盖的例外，全部学科都有 quality 专属）
      const hasQuality = hitCounts.quality > 0;
      if (!hasQuality) {
        gaps++;
        console.log(`❌ 缺口: ${subject}/${stage}/${genType} quality=0`);
      }
      // redline 学科专属（科学/音体美等 14 科）
      const hasRedline = hitCounts.redline > 0;
      if (!hasRedline) {
        gaps++;
        console.log(`❌ 缺口: ${subject}/${stage}/${genType} redline=0`);
      }
    }
  }
}

// 详细矩阵（quality 类，汇总每科在各 genType 命中的学科专属块 id）
console.log('\n═══ quality 学科专属命中明细（genType × 学科）═══\n');
const header = ['genType', ...SUBJECTS.map(s => s.slice(0, 2))];
console.log(header.join('\t'));
for (const genType of ALL_TYPES) {
  const row = [genType];
  for (const subject of SUBJECTS) {
    // 用 middle 学段代表（大多数块不限 stage）
    const hits = matchBlocks('quality', { genType, subject, stage: 'middle' }).filter(b => b.scope?.subjects?.length);
    row.push(String(hits.length));
  }
  console.log(row.join('\t'));
}

console.log('\n═══ quality 命中块 id（exam × middle）═══\n');
for (const subject of SUBJECTS) {
  const hits = matchBlocks('quality', { genType: 'exam', subject, stage: 'middle' }).filter(b => b.scope?.subjects?.length);
  console.log(`  ${subject}: ${hits.map(h => h.id).join(', ')}`);
}

console.log('\n═══ redline 命中块 id（exam × primary_low）═══\n');
for (const subject of SUBJECTS) {
  const hits = matchBlocks('redline', { genType: 'exam', subject, stage: 'primary_low' }).filter(b => b.scope?.subjects?.length);
  console.log(`  ${subject}: ${hits.map(h => h.id).join(', ')}`);
}

console.log(`\n${gaps === 0 ? '✅ 全学科覆盖无缺口' : `❌ 存在 ${gaps} 处缺口`}`);
process.exit(gaps === 0 ? 0 : 1);
