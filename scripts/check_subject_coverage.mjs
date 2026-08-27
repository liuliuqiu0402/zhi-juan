/**
 * 全学科覆盖核查脚本（check_subject_coverage）
 * ============================================================
 * 验证（新架构：替代已删除的 recipe/blocks 规范块体系）：
 * 1) 学科×学段要点 54 组合与 STAGE_SUBJECTS 双向对齐（零缺失/零多余，text/source 非空）
 * 2) 学段要点两版（exam/teaching）× 5 学段全覆盖，含认知底线与课标出处
 * 3) 教辅学科定制蓝本：15 科全覆盖，定制类型合法且栏目非空
 * 4) 真题蓝本学科覆盖：全部规范化学科均有蓝本
 * ============================================================
 */
const lib = (f) => new URL(`../src/config/${f}`, import.meta.url).href;
const { STAGE_SUBJECTS, SUBJECT_STAGE_EXTRAS, STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS } = await import(lib('promptLibrary.js'));
const { TEACHING_GEN_TYPES, TEACHING_SUBJECT_BLUEPRINTS } = await import(lib('teachingBlueprints.js'));
const { EXAM_BLUEPRINTS } = await import(lib('examPaperBlueprints.js'));

const STAGES = Object.keys(STAGE_SUBJECTS);
const SUBJECTS = [...new Set(Object.values(STAGE_SUBJECTS).flat())];
let gaps = 0;

// ── 1) 学科×学段要点 54 组合 ──
console.log('═══ 1) 学科×学段要点（SUBJECT_STAGE_EXTRAS）═══\n');
let combos = 0;
for (const [stage, subjList] of Object.entries(STAGE_SUBJECTS)) {
  for (const subject of subjList) {
    combos++;
    const cell = SUBJECT_STAGE_EXTRAS[`${subject}|${stage}`];
    if (!cell) { gaps++; console.log(`❌ 缺要点: ${subject}|${stage}`); continue; }
    if (!cell.text?.trim()) { gaps++; console.log(`❌ 要点为空: ${subject}|${stage}`); }
    if (!cell.source?.trim()) { gaps++; console.log(`❌ 缺课标出处: ${subject}|${stage}`); }
  }
}
// 反向：SUBJECT_STAGE_EXTRAS 中不应存在学段未开设的学科组合
for (const key of Object.keys(SUBJECT_STAGE_EXTRAS)) {
  const [subject, stage] = key.split('|');
  if (!(STAGE_SUBJECTS[stage] || []).includes(subject)) { gaps++; console.log(`❌ 多余要点（该学段未开设此学科）: ${key}`); }
}
console.log(`组合 ${combos}/54 齐备${gaps === 0 ? '，无缺失无多余' : ''}`);

// ── 2) 学段要点两版 × 5 学段 ──
console.log('\n═══ 2) 学段要点（exam/teaching 两版 × 5 学段）═══\n');
for (const [name, stageLib] of [['STAGE_EXAM_EXTRAS', STAGE_EXAM_EXTRAS], ['STAGE_TEACHING_EXTRAS', STAGE_TEACHING_EXTRAS]]) {
  for (const stage of STAGES) {
    const se = stageLib[stage];
    if (!se) { gaps++; console.log(`❌ ${name} 缺学段: ${stage}`); continue; }
    if (!se.text?.includes('认知底线')) { gaps++; console.log(`❌ ${name}[${stage}] 缺认知底线`); }
    if (!se.source?.trim()) { gaps++; console.log(`❌ ${name}[${stage}] 缺课标出处`); }
  }
  console.log(`${name}: ${STAGES.length} 学段齐备`);
}

// ── 3) 教辅学科定制蓝本 ──
console.log('\n═══ 3) 教辅学科定制蓝本（TEACHING_SUBJECT_BLUEPRINTS）═══\n');
const extraKeys = Object.keys(TEACHING_SUBJECT_BLUEPRINTS).filter(k => !SUBJECTS.includes(k));
if (extraKeys.length) console.log(`⚠ 非规范学科定制键: ${extraKeys.join(', ')}（不阻断）`);
for (const subject of SUBJECTS) {
  const customs = Object.entries(TEACHING_SUBJECT_BLUEPRINTS[subject] || {}).filter(([k]) => TEACHING_GEN_TYPES.includes(k));
  const badType = Object.keys(TEACHING_SUBJECT_BLUEPRINTS[subject] || {}).filter(k => k !== 'stages' && !TEACHING_GEN_TYPES.includes(k));
  if (badType.length) { gaps++; console.log(`❌ ${subject} 定制键非合法类型: ${badType.join(', ')}`); }
  for (const [g, bp] of customs) {
    if (!bp.sections?.length) { gaps++; console.log(`❌ ${subject}/${g} 栏目为空`); }
    if (!bp.label?.trim()) { gaps++; console.log(`❌ ${subject}/${g} 缺 label`); }
  }
  console.log(`  ${subject}: ${customs.length}/${TEACHING_GEN_TYPES.length} 类定制`);
}
console.log(SUBJECTS.every(s => TEACHING_GEN_TYPES.every(g => TEACHING_SUBJECT_BLUEPRINTS[s]?.[g]?.sections?.length))
  ? '15 科 × 8 类定制蓝本全部齐备'
  : '存在定制缺口（见上）');

// ── 4) 真题蓝本学科覆盖 ──
console.log('\n═══ 4) 真题蓝本学科覆盖（EXAM_BLUEPRINTS）═══\n');
const bpSubjects = [...new Set(Object.keys(EXAM_BLUEPRINTS).map(k => k.split('|')[0]))];
const missing = SUBJECTS.filter(s => !bpSubjects.includes(s));
if (missing.length) { gaps++; console.log(`❌ 无蓝本的学科: ${missing.join(', ')}`); }
console.log(`蓝本覆盖学科 ${bpSubjects.length}/${SUBJECTS.length} 个（${missing.length ? `缺失 ${missing.length}` : '全覆盖'}）`);

console.log(`\n${gaps === 0 ? '✅ 全学科覆盖无缺口' : `❌ 存在 ${gaps} 处缺口`}`);
process.exit(gaps === 0 ? 0 : 1);
