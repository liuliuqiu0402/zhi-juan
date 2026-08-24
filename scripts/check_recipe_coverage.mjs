/**
 * 配方覆盖核查（check_recipe_coverage）
 * ============================================================
 * 验证：全学科 × 全学段 × 全 genType 是否都能找到配方（无回退旧路径缺口）。
 * ============================================================
 */
import path from 'path';
import { pathToFileURL } from 'url';

const registryUrl = pathToFileURL(path.resolve('d:/wisdom-workshop/src/config/recipe/recipeRegistry.js')).href;
const { findRecipe } = await import(registryUrl);

const ALL_TYPES = ['exam', 'practice', 'special', 'errorbook', 'reading', 'preview', 'dictation', 'summary', 'review'];
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
const SUBJECTS = [
  '语文', '数学', '英语',
  '物理', '化学', '生物',
  '历史', '地理', '道德与法治', '思想政治',
  '科学', '信息科技',
  '音乐', '美术', '体育',
];

console.log('═══ 配方覆盖矩阵（genType × 学科，学段取 primary_low 为例 + exam 全学段核查）═══\n');
let gaps = 0;
for (const genType of ALL_TYPES) {
  const row = [genType.padEnd(9)];
  for (const subject of SUBJECTS) {
    const r = findRecipe({ genType, subject, stage: 'primary_low' });
    row.push(r ? '✓' : '✗');
    if (!r) { gaps++; console.log(`❌ 无配方: ${genType}/${subject}/primary_low`); }
  }
  console.log(row.join(' '));
}

console.log('\n═══ exam 全学段核查 ═══\n');
for (const subject of SUBJECTS) {
  for (const stage of STAGES) {
    const r = findRecipe({ genType: 'exam', subject, stage });
    if (!r) { gaps++; console.log(`❌ 无 exam 配方: ${subject}/${stage}`); }
  }
  const r = findRecipe({ genType: 'exam', subject, stage: 'primary_low' });
  console.log(`  ${subject}: ${r ? `✓ ${r.meta.id}（${r.blueprint.sections.length} 板块）` : '✗'}`);
}

console.log(`\n${gaps === 0 ? '✅ 配方全学科覆盖无缺口' : `❌ 存在 ${gaps} 处缺口`}`);
process.exit(gaps === 0 ? 0 : 1);
