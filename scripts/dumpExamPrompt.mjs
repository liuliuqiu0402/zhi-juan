// 取全"实发"（exam 维度）：cell 模板 ＋ 蓝图注入（buildStructureText）＋ 程序附加段 ＋ user 侧块，逐块打印。
// 为什么需要它：模板里 {structure}/{materialHead} 是占位；蓝图注入/程序附加/user 块**不在模板里**——
//   只 dump 模板会**漏块**（2026-10-04 逐块通读即因此漏看【卷面结构】）。
// 用法：node scripts/dumpExamPrompt.mjs [学科] [学段]，如 node scripts/dumpExamPrompt.mjs 语文 primary_low
import { getPromptTemplate, buildStructureText } from '../src/config/promptLibrary.js';
import { buildProgramAttach } from '../src/utils/programAttach.js';
import { buildMaterialUsageBlock, buildOrganizeBlock, buildTailBlocks } from '../src/utils/injectionManifest.js';
import { findBlueprint } from '../src/config/blueprintProvider.js';
import { getExamBlueprint } from '../src/config/examPaperBlueprints.js';

const subject = process.argv[2] || '语文';
const stage = process.argv[3] || 'primary_low';
const genType = 'exam';
const show = (t, s) => console.log(`\n===== [${t}] =====\n${s == null ? '（空/未取到）' : s}`);

const tpl = getPromptTemplate({ grade: stage, subject, genType });
// [1] 模板（占位版）→ 再把 {structure} 用 buildStructureText 替换，得到"模板＋蓝图注入"的真内容
show('1·cell 模板（占位版，看块结构）', tpl.template);
let structureText = '';
try {
  // 蓝图对象：优先走生成端同一出口 findBlueprint（含工具库停用判定），兜底 getExamBlueprint
  let bp = null;
  try { bp = findBlueprint({ genType, subject, stage }); } catch { /* fallthrough */ }
  if (!bp) bp = getExamBlueprint(subject, stage);
  structureText = bp ? buildStructureText(bp) : '';
  show('2·蓝图注入（buildStructureText）', structureText || '（未取到蓝图）');
} catch (e) { show('2·蓝图注入（失败）', e.message); }

show('3·cell（{structure} 已替换）', structureText ? tpl.template.replace('{structure}', structureText) : tpl.template);

try {
  const s = buildProgramAttach({ subject, stageKey: stage, genType, instructionText: tpl.template });
  show('4·程序附加段（buildProgramAttach）', typeof s === 'string' ? s : (s?.text || JSON.stringify(s)));
} catch (e) { show('4·程序附加段（失败）', e.message); }

try {
  const ctx = { subject, stage, genType };
  show('5·user 块·素材使用约定', buildMaterialUsageBlock(ctx));
  show('6·user 块·组织风格', buildOrganizeBlock(ctx));
  const tails = buildTailBlocks(ctx);
  show('7·user 块·尾约束', Array.isArray(tails) ? tails.join('\n') : (tails?.text || String(tails)));
} catch (e) { show('5-7·user 块（失败）', e.message); }
