#!/usr/bin/env node
/**
 * B·配置维度抽样运行器（**L1 卷别轴 / L1' 范围命名轴 / L2 学段专属范围 / L5 库启停轴**）
 * ============================================================================================
 * 与 `sampleConfigFaces.mjs`（L3 风格轴 / L4 通道轴）分工，本件补上"**装配入参里原本没有**"的三条轴。
 * 全部走**面级装配单源** `scripts/instructionText.mjs`（与锚表门、防同质化守卫同一份实现）。
 * 每行给"**应有 vs 实有**"（判法 §七：不得以"跑过了"代替证据）；**应有**一律取自**规格/映射表**，
 *   不取自被测函数本身（避免自证同义反复）：
 *   · L1 应有学段档 = `EXAM_SCOPE_TO_STAGE[scopeType] || stage`（卷别→蓝本档映射表）；
 *     应有满分/时长 = `getExamBlueprint(subject, 应有学段档, '').fullScore/duration`；
 *     应有水平 = `gaokaoLevelOf/hegeLevelOf`（水平映射表）；结构段应逐字包含 `buildStructureText(应有蓝图)`。
 *   · L1' 范围维度（期中/期末/月考/专题）**不是指令参数** ⇒ 应有 = 与基准配置**逐字相同**；
 *     而命名层（`inferPaperScope`）应有 = 范围标签词（标题/文件名落点）⇒ 证明"范围在命名层生效、不在指令层"。
 *   · L2 学段专属范围 = 取值表（`scopeOptions` 8 值 / `EXAM_GRADUATION_TYPES` 3 卷别）＋ 卷别档映射逐档实测。
 *   · L5 库启停 = **真拨开关**（Node localStorage 垫片）⇒ 停用后对应能力**不得**仍注入、恢复后须逐字回到基线。
 * 前提：本文件首行 import 垫片（ESM 按声明顺序求值 ⇒ 垫片先于库启停模块生效）。
 */
import './_localStorageShim.mjs';
import { buildInstructionText } from './instructionText.mjs';
import { EXAM_SCOPE_TO_STAGE } from '../src/config/blueprintProvider.js';
import { getExamBlueprint } from '../src/config/examPaperBlueprints.js';
import { buildStructureText, getPromptTemplate } from '../src/config/promptLibrary.js';
import { gaokaoLevelOf, hegeLevelOf } from '../src/config/levelMapping.js';
import { inferPaperScope, SCOPE_LABEL_POOLS, EXPLICIT_SCOPE_TYPES } from '../src/config/paperScope.js';
import { scopeOptions } from '../src/config/expertKnowledge.js';
import { setLibToggle, clearLibToggles } from '../src/utils/libToggles.js';

let pass = 0; let fail = 0;
const rows = [];
function row(label, expect, got, ok) {
  if (ok) pass += 1; else fail += 1;
  rows.push({ label, expect, got, ok });
}
const w = (s, n) => String(s).padEnd(n);
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const levelOf = (text) => (text.match(/【学业质量水平】/) ? (text.match(/对标学业质量(水平[一二三四]|水平二与水平三)/) || [])[1] || '在场·级名未取到' : '不在场');
const scoreOf = (text) => (text.match(/（满分(\d+)分(，时长([^）]*))?）/) || []).slice(1, 4);

// ────────────────────────────────────────────────────────────
console.log('\n=== L1 卷别轴（exam·升学卷别 → 蓝本分档 ＋ 高中卷别 → 学业质量水平）===');
const L1 = [
  ['语文', 'middle', '', '基准(校内卷)'],
  ['语文', 'middle', 'zhongkao', '中考'],
  ['语文', 'middle', 'gaokao', '高考卷别·跨档'],
  ['语文', 'high', 'zhongkao', '中考卷别·跨档'],
  ['语文', 'primary_high', 'xiaoshengchu', '小升初'],
  ['数学', 'high', '', '基准→合格考口径'],
  ['数学', 'high', 'gaokao', '升学高考'],
  ['化学', 'high', 'gaokao', '升学高考'],
];
for (const [subject, stage, scope, tag] of L1) {
  const wantStage = EXAM_SCOPE_TO_STAGE[scope] || stage;
  const ebp = getExamBlueprint(subject, wantStage, '');
  const text = buildInstructionText('exam', subject, stage, { scopeType: scope });
  const wantScore = ebp ? String(ebp.fullScore) : '';
  const wantDur = ebp ? String(ebp.duration || '') : '';
  const gotScore = scoreOf(text)[0] || '';
  const gotDur = scoreOf(text)[2] || '';
  const wantLevel = scope === 'gaokao' ? gaokaoLevelOf(subject, wantStage) : hegeLevelOf(subject, wantStage);
  const wantLevelShown = stage === 'high' ? wantLevel : '';
  const gotLevel = levelOf(text);
  const structIn = ebp ? text.includes(buildStructureText(ebp)) : !text.includes('（按教材内容合理设计大题）');
  const ok = gotScore === wantScore && gotDur === wantDur
    && (wantLevelShown ? gotLevel === wantLevelShown : gotLevel === '不在场') && structIn;
  row(`exam·${subject}×${stage}×${scope || '（无卷别）'} ${tag}`,
    `档=${subject}|${wantStage} 满分${wantScore} 时长${wantDur || '—'} 水平${wantLevelShown || '不注入'}`,
    `满分${gotScore} 时长${gotDur || '—'} 水平${gotLevel} 结构段${structIn ? '在场' : '缺席'}`,
    ok);
}
// 非正式卷：升学卷别**不得**生效（应有＝与无卷别逐字相同）
for (const genType of ['practice', 'summary', 'dictation']) {
  const base = buildInstructionText(genType, '语文', 'high');
  const withGk = buildInstructionText(genType, '语文', 'high', { scopeType: 'gaokao' });
  row(`非正式卷·${genType}×高考卷别 应"不生效"`,
    '与无卷别逐字相同（升学卷别仅正式卷生效）',
    withGk === base ? '逐字相同' : `有差异(${withGk.length - base.length > 0 ? '+' : ''}${withGk.length - base.length}字)`,
    withGk === base);
}

// ────────────────────────────────────────────────────────────
console.log('\n=== L1\' 范围命名轴（期中/期末/月考/专题：命名层生效 ⇔ 指令层不变）===');
const NINE = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
const SCOPES = ['midterm', 'final', 'monthly', 'topic'];
let sameAll = true;
for (const sc of SCOPES) {
  const named = inferPaperScope([], [], sc);
  const pool = SCOPE_LABEL_POOLS[sc] || [];
  const nameOk = named.isScopeLabel === true && pool.includes(named.name);
  // 指令层：9 类型 × 该范围 ⇒ 应与基准（无范围）逐字相同
  let diffTypes = [];
  for (const g of NINE) {
    const base = buildInstructionText(g, '语文', 'primary_high');
    const withScope = buildInstructionText(g, '语文', 'primary_high', { scopeType: sc });
    if (withScope !== base) diffTypes.push(g);
  }
  if (diffTypes.length) sameAll = false;
  row(`范围·${sc}`,
    `命名层=${pool[0]}/${pool.length}词轮换；指令层 9/9 与基准逐字相同`,
    `命名层=${named.name}(标签${named.isScopeLabel ? '是' : '否'})；指令层差异类型=${diffTypes.length ? diffTypes.join(',') : '0'}`,
    nameOk && diffTypes.length === 0);
}
row('范围·default（按勾选推断，非显式）',
  '空勾选 → 默认标签词池', `推断=${inferPaperScope([], [], 'default').name}`,
  (SCOPE_LABEL_POOLS.default || []).includes(inferPaperScope([], [], 'default').name));

// 范围名**进入指令层的唯一路径** = 模板 {unit}/{scope} 占位符（值由命名层 resolveScopeName 单源给出）
//   严格对账：**模板含占位符 ⇒ 传范围名必变化**；**不含 ⇒ 传范围名必不变化**（两向都须成立，防"以为会进/其实不进"）
console.log('\n--- L1\'附：范围名文本 ⇔ 模板占位符 对账（9 类型·语文×primary_high）---');
const RANGE_NAME = SCOPE_LABEL_POOLS.midterm[0];
let phTypes = 0; let changedTypes = 0;
for (const g of NINE) {
  const tpl = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: g }).template;
  const hasPh = /\{(unit|scope)\}/.test(String(tpl || ''));
  if (hasPh) phTypes += 1;
  const base = buildInstructionText(g, '语文', 'primary_high');
  const withName = buildInstructionText(g, '语文', 'primary_high', { unit: RANGE_NAME });
  const changed = withName !== base;
  if (changed) changedTypes += 1;
  row(`范围名·${g}`,
    hasPh ? '模板含 {unit}/{scope} ⇒ 必变化且含范围名' : '模板无占位符 ⇒ 必不变化',
    `占位符=${hasPh ? '有' : '无'}；文本${changed ? '变化' : '不变'}；含范围名=${withName.includes(RANGE_NAME) ? '是' : '否'}`,
    hasPh ? (changed && withName.includes(RANGE_NAME)) : !changed);
}
row('范围名·消费面数对账', '含占位符类型数 ≡ 文本随范围名变化的类型数',
  `${phTypes}/9 含占位符；${changedTypes}/9 随范围名变化`, phTypes === changedTypes);

// ────────────────────────────────────────────────────────────
console.log('\n=== L2 学段专属范围（取值表 ＋ 卷别→蓝本档映射逐档）===');
row('取值表·scopeOptions', '8 值（default/midterm/final/monthly/topic ＋ 升学考 3）',
  `${scopeOptions.length} 值：${scopeOptions.map((o) => o.value).join('/')}`, scopeOptions.length === 8);
row('取值表·EXPLICIT_SCOPE_TYPES', '4 范围维度 ＋ 3 升学卷别 = 7',
  `${EXPLICIT_SCOPE_TYPES.length}：${EXPLICIT_SCOPE_TYPES.join('/')}`, EXPLICIT_SCOPE_TYPES.length === 7);
row('映射表·EXAM_SCOPE_TO_STAGE', 'xiaoshengchu→primary_high / zhongkao→middle / gaokao→high',
  `${EXAM_SCOPE_TO_STAGE.xiaoshengchu}/${EXAM_SCOPE_TO_STAGE.zhongkao}/${EXAM_SCOPE_TO_STAGE.gaokao}`,
  EXAM_SCOPE_TO_STAGE.xiaoshengchu === 'primary_high' && EXAM_SCOPE_TO_STAGE.zhongkao === 'middle' && EXAM_SCOPE_TO_STAGE.gaokao === 'high');

// ────────────────────────────────────────────────────────────
console.log('\n=== L5 库启停轴（真拨开关：停用⇒能力不得注入；恢复⇒逐字回基线）===');
clearLibToggles();
const onBase = buildInstructionText('exam', '语文', 'primary_low');
const structText = buildStructureText(getExamBlueprint('语文', 'primary_low', '')); // ⚠️ 须在拨开关**之前**取（停用后 getExamBlueprint 自身即返回 null）
setLibToggle('blueprint', '语文|primary_low', false);
const offBp = buildInstructionText('exam', '语文', 'primary_low');
row('停用·蓝图条目「语文|primary_low」',
  '卷面结构段缺席（落兜底）且 满分/时长 同时缺席',
  `结构段=${offBp.includes(structText) ? '仍在场✗' : '已缺席'}；满分=${scoreOf(offBp)[0] || '缺席'}；兜底文案=${offBp.includes('（按教材内容合理设计大题）') ? '在场' : '缺席'}；与启用时不同=${offBp !== onBase}`,
  !offBp.includes(structText) && !scoreOf(offBp)[0] && offBp !== onBase);
setLibToggle('blueprint', '语文|primary_low', true);
const restoredBp = buildInstructionText('exam', '语文', 'primary_low');
row('恢复·蓝图条目「语文|primary_low」', '与停用前**逐字相同**',
  restoredBp === onBase ? '已回基线' : '✗ 有残留差异', restoredBp === onBase);
setLibToggle('instruction', 'primary_low|语文|exam', false);
const offCell = buildInstructionText('exam', '语文', 'primary_low');
row('停用·指令 cell「primary_low|语文|exam」',
  '模板落下一级（≠ 停用前，且非空兜底）',
  `与非停用${offCell === onBase ? '相同✗' : '不同✓'}；字符${offCell.length}；兜底非空=${offCell.trim() ? '是' : '否✗'}`,
  offCell !== onBase && offCell.trim().length > 0);
setLibToggle('instruction', 'primary_low|语文|exam', true);
row('恢复·指令 cell', '与基线**逐字相同**（开关是唯一变量）',
  buildInstructionText('exam', '语文', 'primary_low') === onBase ? '已回基线' : '✗ 有残留差异',
  buildInstructionText('exam', '语文', 'primary_low') === onBase);
clearLibToggles();

// ────────────────────────────────────────────────────────────
console.log('\n' + w('样本', 44) + w('应有', 52) + '实有/判定');
for (const r of rows) {
  console.log(w(cut(r.label, 43), 44) + w(cut(r.expect, 51), 52) + cut(r.got, 60) + (r.ok ? ' ✓' : ' ✗'));
}
console.log(`\n合计 ${rows.length} 样本｜✓ ${pass}｜✗ ${fail}`);
if (fail) console.log('⚠️ 存在 ✗ ⇒ 按判法 §七 记真错并处置，不得跳过。');
process.exitCode = fail ? 1 : 0;
