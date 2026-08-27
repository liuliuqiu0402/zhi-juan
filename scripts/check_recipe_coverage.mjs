/**
 * 配方覆盖核查（check_recipe_coverage）
 * ============================================================
 * 验证（新架构：替代已删除的 recipeRegistry.js / recipe/blocks 规范块体系）：
 * 1) 三维度指令 cell：学段×学科×类型 全命中（getPromptTemplate 直取预生成 cell，携带学科要点）
 * 2) 真题卷蓝本：EXAM_BLUEPRINTS 全量校验（分值闭合/听力占比/卷面要素）+ 54 组合蓝本可达
 * 3) 教辅结构蓝本：8 类 × 15 科 无缺口（getTeachingBlueprint，栏目非空）
 * ============================================================
 */
const lib = (f) => new URL(`../src/config/${f}`, import.meta.url).href;
const { getPromptTemplate, STAGE_SUBJECTS } = await import(lib('promptLibrary.js'));
const { EXAM_BLUEPRINTS, getExamBlueprint } = await import(lib('examPaperBlueprints.js'));
const { validateAllBlueprints } = await import(lib('blueprintGuard.js'));
const { TEACHING_GEN_TYPES, TEACHING_SUBJECT_BLUEPRINTS, getTeachingBlueprint } = await import(lib('teachingBlueprints.js'));

const ALL_TYPES = ['exam', ...TEACHING_GEN_TYPES];
let gaps = 0;

// ── 1) 三维度指令 cell ──
console.log('═══ 1) 三维度指令 cell（学段×学科×类型）═══\n');
let cellCount = 0;
for (const [stage, subjList] of Object.entries(STAGE_SUBJECTS)) {
  for (const subject of subjList) {
    for (const gType of ALL_TYPES) {
      cellCount++;
      const t = getPromptTemplate({ grade: stage, subject, genType: gType });
      const cellHit = t.source === 'builtin' && t.id === `${stage}|${subject}|${gType}`;
      if (!cellHit) { gaps++; console.log(`❌ 无三维度 cell: ${stage}/${subject}/${gType}（回落 ${t.id}）`); continue; }
      if (!t.template.includes(`【${subject}·`)) { gaps++; console.log(`❌ cell 缺学科要点块: ${stage}/${subject}/${gType}`); }
    }
  }
}
console.log(`三维度 cell 共 ${cellCount} 个${gaps === 0 ? '，全部命中且携带学科要点' : ''}`);

// ── 2) 真题卷蓝本 ──
console.log('\n═══ 2) 真题卷蓝本（EXAM_BLUEPRINTS）═══\n');
const { errors, warnings, ok } = validateAllBlueprints(EXAM_BLUEPRINTS);
for (const e of errors) console.log(`❌ ${e.detail}`);
for (const w of warnings) console.log(`⚠ ${w.detail}`);
console.log(`蓝本数: ${Object.keys(EXAM_BLUEPRINTS).length}，${ok ? '分值闭合/结构校验全部通过' : `存在 ${errors.length} 处错误`}`);
if (!ok) gaps += errors.length;

let reachable = 0;
let combos = 0;
for (const [stage, subjList] of Object.entries(STAGE_SUBJECTS)) {
  for (const subject of subjList) {
    combos++;
    const bp = getExamBlueprint(subject, stage);
    if (!bp) { gaps++; console.log(`❌ ${subject}/${stage} 无可用真题蓝本`); }
    else reachable++;
  }
}
console.log(`学段×学科蓝本可达 ${reachable}/${combos}`);

// ── 3) 教辅结构蓝本 ──
console.log('\n═══ 3) 教辅结构蓝本（8 类 × 15 科）═══\n');
let teachingTotal = 0;
for (const subject of [...new Set(Object.values(STAGE_SUBJECTS).flat())]) {
  const customs = Object.entries(TEACHING_SUBJECT_BLUEPRINTS[subject] || {}).filter(([k]) => TEACHING_GEN_TYPES.includes(k));
  for (const gType of TEACHING_GEN_TYPES) {
    teachingTotal++;
    const bp = getTeachingBlueprint({ genType: gType, stage: 'middle', subject });
    if (!bp) { gaps++; console.log(`❌ 无教辅蓝本: ${subject}/${gType}`); continue; }
    if (!bp.sections?.length) { gaps++; console.log(`❌ 教辅蓝本栏目为空: ${subject}/${gType}`); }
  }
  console.log(`  ${subject}: 定制 ${customs.length}/${TEACHING_GEN_TYPES.length} 类`);
}
console.log(`教辅组合 ${teachingTotal} 个全部可达`);

console.log(`\n${gaps === 0 ? '✅ 配方覆盖无缺口' : `❌ 存在 ${gaps} 处缺口`}`);
process.exit(gaps === 0 ? 0 : 1);
