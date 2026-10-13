#!/usr/bin/env node
/**
 * 注入快照（批 A 前置工具 · v2）
 * ============================================================
 * 目的：把"某类型**实际会注入给模型**的文本"装配后落成文件，供 L1 计数使用。
 * 判准见 `docs/audit/事务聚类与探针表-2026-10-11.md` §八：
 *   "一处"指**注入后的最终 prompt**，不是源码——同一事务的决定句在注入文本里须**恰出现 1 次**。
 *
 * v2 更正（2026-10-11，v1 有致命缺漏，必须重取基准）：
 *   ✗ v1 未把**委托正文**（模板正文，实发主体）传入装配 —— 快照漏掉最大一段；
 *     且 buildProgramAttach 未传 instructionText → floorClauseSections 的**段级兜底全部触发**，
 *     把【质量底线】等整段注入 system —— 而真实装配中模板已含这些段、兜底不触发。
 *     两处叠加 ⇒ v1 快照**既漏又增**，T01–T04 计数不成立。
 *   ✓ v2 逐字复刻真实装配链（与 tests/config/intraRequestDuplicate.test.js 的 buildCells 同口径）：
 *     委托正文 = buildInjectionInstruction({template: tpl.template, ...})（占位符替换 + 任务行）
 *     system  = buildProgramAttach({subject, stageKey, genType, instructionText})  ← 必须传正文
 *     用户消息 = buildUserMessagePrompt({..., instructionText})                    ← 必须传正文
 *     教辅段   = buildTeachingInjection(...)（仅非 exam）
 *     调用层   = buildCallLayerBlocks()（当前为空数组，D16 后）
 *
 * 用法：
 *   node scripts/snapshotInjection.mjs type=exam subject=语文 stage=primary_high grade=三年级
 */
import fs from 'node:fs';
import path from 'node:path';

import { getPromptTemplate, buildInjectionInstruction, buildStructureText, GEN_TYPE_NAMES } from '../src/config/promptLibrary.js';
import { styleInstructions, styleOptions, buildStyleAppend, DEFAULT_STYLE_BY_TYPE, subjectGradeSystem } from '../src/config/expertKnowledge.js';
import { buildTeachingInjection } from '../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../src/utils/programAttach.js';
import { materialChannelOf } from '../src/config/coverageContract.js';
import { buildLevelInstruction } from '../src/config/levelMapping.js';
import { buildSpecialDomainAnchorLine } from '../src/config/specialDomains.js';
import { anchorListRoleNote } from '../src/utils/anchorTreeContract.js';
import { buildRenderContract } from '../src/config/eduRenderContract.js';

const arg = (k, d) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(k + '='));
  return hit ? hit.slice(k.length + 1) : d;
};

const genType = arg('type', 'exam');
const subject = arg('subject', '语文');
const stage = arg('stage', 'primary_high');
// 🔴 2026-10-12（第四轮独立复核抓到）：原默认 `'三年级'` 是**硬编码**——对物理/中学段会渲染出
//   "物理三年级"（头行与【任务】都取该值）⇒ **样本失真**，被独立复核判为"学段串·委托层硬伤"。
//   现改为**学科×学段**推导：先取该学段的代表年级，再用 `subjectGradeSystem` 校验**该科在该学段
//   是否真开设**（不吻合则取该科可开设年级的首个，如物理·初中→八年级）⇒ 不再出现"未开设年级"。
//   仍可被显式 `grade=…` 覆盖；样本生成后须**逐份核头行**（纪律）。
const STAGE_BUCKET = { primary_low: '小学', primary_mid: '小学', primary_high: '小学', middle: '初中', high: '高中' };
const STAGE_GRADE_HINT = { primary_low: '一年级', primary_mid: '三年级', primary_high: '五年级', middle: '七年级', high: '高一' };
const gradeGrades = subjectGradeSystem[STAGE_BUCKET[stage]]?.[subject]?.grades || [];
const gradeHint = STAGE_GRADE_HINT[stage] || '';
const grade = arg('grade', gradeGrades.includes(gradeHint) ? gradeHint : (gradeGrades[0] || gradeHint));

const warn = [];
const parts = [];
const push = (label, fn) => {
  try {
    const t = String(fn() || '').trim();
    if (t) parts.push(`\n\n===== ${label} =====\n${t}`);
    else warn.push(`${label}: 空`);
  } catch (e) {
    warn.push(`${label}: ${e.message}`);
  }
};

// 1) 模板 + 卷面结构（蓝图缺省不影响判据计数，仅卷面结构回退）
const tpl = getPromptTemplate({ grade: stage, subject, genType });
let structure = '';
let fullScore = '';
let duration = '';
try {
  const { findBlueprint } = await import('../src/config/blueprintProvider.js');
  const bp = findBlueprint({ genType, subject, stage, region: '', scopeType: '' });
  if (bp) { structure = buildStructureText(bp); fullScore = bp.fullScore || ''; duration = bp.duration || ''; }
} catch (e) { warn.push(`蓝图: ${e.message}`); }

const materialChannel = materialChannelOf(genType) || 'full';

// 2) 委托正文（= 实发主体，v1 漏此段）
const instructionText = buildInjectionInstruction({
  template: tpl.template,
  grade,
  stage,
  subject,
  genTypeLabel: GEN_TYPE_NAMES[genType] || genType,
  label: '',
  structure,
  fullScore,
  duration,
  genType,
  materialChannel,
});

// ⚠️ 委托正文**不单独成段**：它就在 user 消息的 instruction 指针块里（v2 若另 push 会双计）。
push('user · 消息全文（含委托正文）', () => buildUserMessagePrompt({
  genType, subject, materialChannel,
  anchorListText: '一、主题\n· 知识点。',
  instructionText,
}));
push('system · 程序附加段', () => buildProgramAttach({ subject, stageKey: stage, genType, instructionText }));
if (genType !== 'exam') push('教辅 · 结构注入', () => buildTeachingInjection({ genType, stage, subject }));
push('调用层 · 追加块', () => buildCallLayerBlocks().map((b) => b.text).join('\n'));
// 🔴 2026-10-12（S4 差集·R1·**快照缺生成期追加块**）：原快照未并入"生成期追加"通道 ⇒ `【组织风格】` 16 份全 0 命中，
//   导致"以随本委托注入的组织风格为准"等判据在快照里**悬空**（送审方据此误判为缺判据）。现注入 `buildStyleAppend`
//   （渲染唯一事实源），并在头部标注本档取值。
// 🔴 2026-10-12（S4 第二轮差集·B-1·**快照"多档并列"是快照口径 bug**）：本处原 `styleVals = 该类型全部适用档`
//   并把 5 档**一并**注入（与本函数注释"按第一档注入"自相矛盾），独立复核据此判"同份并列注入互斥的多档组织风格
//   （unit_context 与 traditional 并存、无择一判据）＝相抵"。**生产不如此**：`GenerateModule.vue withStyle()` 只注入
//   **用户所选的那一档**；未选则走**不注入的默认分支**（`DEFAULT_STYLE_BY_TYPE`：exam/dictation/errorbook＝''）。
//   ⇒ 快照改**与生产同口径**：只注入**单档**（取该类型默认档；默认档为空则不注入该块、头部标注"该类型默认不注入"）。
const styleVal = DEFAULT_STYLE_BY_TYPE[genType] || '';
const styleBlock = styleVal ? buildStyleAppend(styleVal) : '';
push('生成期追加 · 组织风格', () => styleBlock);

// 头部标注（装配口径＋样本局限）：S4 差集指出"素材占位/配置未标"会被读成缺判据 ⇒ 显式写清
const HEADER = `# 注入快照 · ${genType} / ${subject} / ${stage}（${grade}）
# 装配口径：委托正文（模板）→ user 消息全文（含正文）→ system 程序附加段 → 教辅结构注入（非 exam）→ 调用层追加块 → **生成期追加块**（组织风格＝${styleVal ? `${styleVal}（该类型默认档；生产按用户所选注入单档）` : '该类型默认不注入（用户可另选，注入的是单档）'}）
# 样本局限（2026-10-12 补）：
#   ① 素材（锚点清单／压缩原文）为**占位串**——真实生成时放用户勾选的教材内容，属**豁免输入**（不在"每句有主"的指令源内）；
#   ② **配置类**（生成方式／素材通道／第3层注入／模板对标／情境框架／卷别层级／库条目启停／三维度选择）为**外部输入**，本快照取基准（生成方式＝split，素材通道＝${materialChannel}）；
#   ③ **条件追加块**（复生成差异化／多类型差异化）条件不成立、未含。
`;

const text = HEADER + parts.join('');

// 🔴 2026-10-13（属主："快照不是应该按 486 个三维度来吗？…你是机器，偷这个懒有什么意义"）：原输出目录**硬编码**单目录，
//   使"全量 486 面"无法与既有 16 份送审快照并存。现**输出目录可覆盖**（`SNAPSHOT_DIR` 环境变量）——
//   全量产出落 `docs/audit/snapshot-all/`，**不动** `docs/audit/snapshot/` 的 16 份基线。
const outDir = path.resolve(process.env.SNAPSHOT_DIR || 'docs/audit/snapshot');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${genType}-${subject}-${stage}.txt`);
fs.writeFileSync(outFile, text, 'utf8');

// —— L1 锚 ——计数对象＝**注入后的最终文本**
// 口径（属主判准·探针表 §八）：同一事务的**决定句**在注入文本里须**恰出现 1 次**；
//   被收敛/删除的旧字面须**零出现**（L2 反向锁）。{ re, expect }：expect 为期望命中次数。
// 🔴 2026-10-13（属主："不要偷懒"）：锚表原是**本文件内联副本**，且只打印 ✓/✗、从不判红 ⇒ 与源码静默漂移数轮无人发现。
//   现锚表抽为**单源模块** `scripts/l1Anchors.mjs`（本脚本与 `tests/config/l1AnchorGate.test.js` 共用一份），
//   并成为**门**（测试侧任一 ✗ 即 fail）。此处不再内联副本。
const { anchorsFor } = await import('./l1Anchors.mjs');
const ANCHORS = anchorsFor({ genType, subject, stage, hasStructure: !!structure });

console.log(`快照：${outFile}`);
console.log(`字数：${text.length}｜各段：${parts.length}`);
if (warn.length) console.log(`⚠️ ${warn.join(' | ')}`);
console.log('—— L1 计数（口径：注入后的最终文本）——');
for (const a of ANCHORS) {
  // 🔴 2026-10-13（独立复核 E5·**承重条件**）：计数对象＝**指令文本**（parts），**排除快照头部**——
  //   头部含"第3层注入"字样，若纳入会误命中 T13·G96，使 486/486 面全红，且与门（tests/config/l1AnchorGate.test.js）口径分裂。
  //   （首版补丁脚本因第二处替换未命中而抛错、整个未写入 ⇒ 此处直接落这一行并自证。）
  const hits = (parts.join('').match(a.re) || []).length;
  const ok = a.expect === hits ? '✓' : '✗';
  console.log(`${ok} ${a.name}: ${hits}（期望 ${a.expect}）`);
}
// —— L2 互斥探针（G5·数学档）：「不以机械套算」须与**类型豁免**同现，否则对默写/运算训练过度 ——
if (text.includes('不以机械套算')) {
  const ok = text.includes('以熟练为目的的运算训练不作此要求');
  console.log(`${ok ? '✓' : '✗'} T18·G5·L2：「不以机械套算」× 类型豁免句 同现 = ${ok}`);
}
// —— T10·G66/G67 风格注入句源（风格非默认注入 → 单独扫 styleInstructions 的**值**，不扫源码注释）——
const styleText = Object.values(styleInstructions).join('\n');
const STYLE_ANCHORS = [
  { name: 'T10·G66 空锚清零（"情境类型锚"／"取向依课标"）', re: /本学科课程标准界定的情境类型|情境取向依本学科本学段的课标要求/g, expect: 0 },
  { name: 'T10·G67 无锚语清零（一眼可读／层级不宜过深／不做形式化包装／清晰易读／重点突出）', re: /一眼可读|层级不宜过深|不做形式化包装|清晰易读|重点突出/g, expect: 0 },
];
console.log('—— L1 计数（styleInstructions 值域）——');
for (const a of STYLE_ANCHORS) {
  const hits = (styleText.match(a.re) || []).length;
  const ok = a.expect === hits ? '✓' : '✗';
  console.log(`${ok} ${a.name}: ${hits}（期望 ${a.expect}）`);
}
// —— T19·G39 互斥探针：同一教辅注入内「覆盖口径」恰 1 处（review 为样本）——
if (genType === 'review') {
  const n = (text.match(/都涉及到/g) || []).length;
  console.log(`${n === 1 ? '✓' : '✗'} T19·G39·L2：review 覆盖口径出现 ${n} 处（期望 1）`);
}
// —— T12 假指针探针（三处**不在本快照装配链**里的注入面：直接调其构造入口核字面）——
const lv = buildLevelInstruction({ stage: 'high', subject: '物理', genType: 'exam', scopeType: 'gaokao' });
console.log(`${!lv.includes('不超该水平要求') ? '✓' : '✗'} T12·G54·L2：水平块不再含悬空难度要求 → 「${lv}」`);
const dl = buildSpecialDomainAnchorLine({ anchor: '示例锚', key: '示例领域' });
console.log(`${dl.includes('【〈学科〉·〈学段〉要点】') && !dl.includes('学科×学段 课标要点') ? '✓' : '✗'} T12·G55·L2：领域锚句点真块名 → 「${dl}」`);
const rn = anchorListRoleNote();
console.log(`${!rn.includes('见委托书【素材使用约定】') ? '✓' : '✗'} T12·G98·L2：清单角色说明无跨块指针`);
const genSrc = fs.readFileSync(path.resolve('src/composables/useAiGenerator.js'), 'utf8');
const cf = (genSrc.match(/contextFramework = `([\s\S]*?)`;/) || [])[1] || '';
console.log(`${cf.includes('【情境与页码】的情境边界条') && !cf.includes('【情境边界】') ? '✓' : '✗'} T12·G53·L2：情境框架块引真块名（【情境与页码】）`);
// —— T13·G70：渲染指令段头（system 侧，不在本快照装配链）——
const rcText = buildRenderContract({ subject: '物理', stage: 'middle' });
console.log(`${rcText.includes('【渲染指令】') && !rcText.includes('按需输出') && !rcText.includes('编造比例') ? '✓' : '✗'} T13·G70·L2：渲染指令段头只留【渲染指令】＋无机制解释`);
// —— T09／T14／T15：分析提示与规则库不在本快照装配链 → 直接读源核字面（含"清零"与"正句"两侧）——
const S = (p) => fs.readFileSync(path.resolve(p), 'utf8');
// ⚠️ 注释里会**引用**旧字面（本项目的留痕惯例），核对"注入字面是否还在"必须**先剥注释**——否则留痕本身会把探针判红。
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const genS = stripComments(S('src/composables/useAiGenerator.js'));
const lpS = stripComments(S('src/config/listeningExtractPrompt.js'));
const vrS = stripComments(S('src/config/validatorRules.js'));
const apS = stripComments(S('src/config/analysisPrompts.js'));
const SRC_CHECKS = [
  ['T09·G20 清零（"所有输出字段必须使用中文"）＋正句（随原文语言）', !genS.includes('所有输出字段必须使用中文') && genS.includes('逐字复制原文、随原文语言')],
  ['T09·G21 清零（"必须为以下每种题型提取题目"）＋正句（仅作优先提示）', !genS.includes('必须为以下每种题型提取题目') && genS.includes('已知题型列表仅作优先提示')],
  ['T09·G22 正句（绝对句已补 scope：除难度/小题数量外）', genS.includes('除【难度】判断与【小题数量】统计外')],
  ['T09·G23 正句（分节播音指令给判据）＋通用开场限定', lpS.includes('说明该节听音方式与遍数**的分节指令') && lpS.includes('不属任何分节的通用开场')],
  ['T14·G52 清零（"仅目录模式"判据）／正句（标注含"目录模式"，两处同步）', !genS.includes('标注"仅目录模式"') && genS.includes('标注含"目录模式"') && apS.includes('标注含"目录模式"')],
  ['T14·G72 清零（操作者指引移出注入文本）', !genS.includes('如需完整命题素材')],
  ['T15·G87 清零（自相抵的"字符归一半角/严禁 IPA 字符"）', !vrS.includes('字符归一半角') && !vrS.includes('IPA 音标字符（')],
  ['T15·G90 清零（恒注入的配图块格式句）', !vrS.includes('配图块格式：凡输出配图')],
];
console.log('—— T09/T14/T15 源级核字面（不在本快照装配链）——');
for (const [name, ok] of SRC_CHECKS) console.log(`${ok ? '✓' : '✗'} ${name}`);
