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
import { buildTeachingInjection } from '../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../src/utils/programAttach.js';
import { materialChannelOf } from '../src/config/coverageContract.js';

const arg = (k, d) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(k + '='));
  return hit ? hit.slice(k.length + 1) : d;
};

const genType = arg('type', 'exam');
const subject = arg('subject', '语文');
const stage = arg('stage', 'primary_high');
const grade = arg('grade', '三年级');

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

const text = parts.join('');

const outDir = path.resolve('docs/audit/snapshot');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${genType}-${subject}-${stage}.txt`);
fs.writeFileSync(outFile, text, 'utf8');

// —— L1 锚 ——计数对象＝**注入后的最终文本**
// 口径（属主判准·探针表 §八）：同一事务的**决定句**在注入文本里须**恰出现 1 次**；
//   被收敛/删除的旧字面须**零出现**（L2 反向锁）。{ re, expect }：expect 为期望命中次数。
const ANCHORS = [
  // T01 唯一性与数量
  { name: 'T01·正句（唯一性判据）', re: /两处可互相替代才算重复/g, expect: 1 },
  { name: 'T01·清零（旧表述）', re: /同一大题内同型小题也只作一题|不扎堆反复出现|尤其不得雷同|题量以委托书为准|不得复现相同材料|同一大类内不得拆成多道大题|同一知识点在同一资料内不得重复考查/g, expect: 0 },
  // T02 编号·序号·组标题（小题号编法应为 0；大题序号"全卷连续"属主裁定**保留**）
  { name: 'T02·小题号编法（应 0）', re: /小题号[^。；]{0,24}连续|按栏目[^。；]{0,8}起编|不得跳号|同号同序/g, expect: 0 },
  { name: 'T02·大题序号全卷连续（保留，应 ≥1）', re: /大题序号[^。；]{0,10}全卷连续/g, expect: 1 },
  // T18 考查方式
  { name: 'T18·清零', re: /不靠记忆|逐题各有考查侧重|不以机械套算/g, expect: 0 },
  // T04 空位·载体
  { name: 'T04·清零', re: /正文不出现 <u>|本条优先于一切通用表述|以本条为准|以其为准|格内留空|学科协议/g, expect: 0 },
];

console.log(`快照：${outFile}`);
console.log(`字数：${text.length}｜各段：${parts.length}`);
if (warn.length) console.log(`⚠️ ${warn.join(' | ')}`);
console.log('—— L1 计数（口径：注入后的最终文本）——');
for (const a of ANCHORS) {
  const hits = (text.match(a.re) || []).length;
  const ok = a.expect === hits ? '✓' : '✗';
  console.log(`${ok} ${a.name}: ${hits}（期望 ${a.expect}）`);
}
