#!/usr/bin/env node
/**
 * 注入快照（批 A 前置工具）
 *
 * 目的：把"某类型**实际会注入给模型**的文本"装配后落成文件，供 L1 计数使用。
 * 判准见 `docs/audit/事务聚类与探针表-2026-10-11.md` §八：
 *   "一处"指**注入后的最终 prompt**，不是源码——同一事务的决定句在注入文本里须**恰出现 1 次**。
 *
 * 用法：
 *   node scripts/snapshotInjection.mjs type=exam subject=语文 stage=primary_high grade=三年级
 */
import fs from 'node:fs';
import path from 'node:path';

import * as PA from '../src/utils/programAttach.js';
import * as IM from '../src/utils/injectionManifest.js';
import * as PL from '../src/config/promptLibrary.js';

const arg = (k, d) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(k + '='));
  return hit ? hit.slice(k.length + 1) : d;
};

const genType = arg('type', 'exam');
const subject = arg('subject', '语文');
const stage = arg('stage', 'primary_high');
const grade = arg('grade', '三年级');

// —— 装配（各段均可失败，失败只告警、不中断）
const parts = [];
const warn = [];
const push = (label, fn) => {
  try {
    const t = String(fn() || '').trim();
    if (t) parts.push(`\n\n===== ${label} =====\n${t}`);
    else warn.push(`${label}: 空`);
  } catch (e) {
    warn.push(`${label}: ${e.message}`);
  }
};

const paFn =
  PA.buildProgramAttach ||
  Object.entries(PA).find(([k, v]) => typeof v === 'function' && /Attach$/i.test(k))?.[1];

const tplFn =
  PL.buildInjectionInstruction ||
  Object.entries(PL).find(([k, v]) => typeof v === 'function' && /InjectionInstruction/i.test(k))?.[1];

push('system · 程序附加段', () => (paFn ? paFn({ subject, stageKey: stage, genType }) : ''));
push('user · 注入块', () => IM.buildUserMessagePrompt({ genType, subject, stageKey: stage, grade }));
// 模板正文：取"更长者"（内置模板 vs 注入指令），避免取到空/回退串
push('委托书 · 模板正文', () => {
  const a = String(PL.getPromptTemplate({ grade, subject, genType }) || '');
  const b = String((tplFn && tplFn({ stage, subject, genType })) || '');
  return b.length > a.length ? b : a;
});

const text = parts.join('');

const outDir = path.resolve('docs/audit/snapshot');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${genType}-${subject}-${stage}.txt`);
fs.writeFileSync(outFile, text, 'utf8');

// —— L1 锚（批 A 四事务）——计数对象＝**注入后的最终文本**
const ANCHORS = {
  T01: /同一大题内同型小题也只作一题|不扎堆反复出现|尤其不得雷同|题量以委托书为准|不得复现相同材料/g,
  T02: /小题号[^。；]{0,24}连续|按栏目[^。；]{0,8}起编|不得跳号|同号同序/g,
  T18: /不靠记忆|逐题各有考查侧重|不以机械套算/g,
  T04: /正文不出现 <u>|本条优先于一切通用表述|以本条为准|以其为准|格内留空|学科协议/g,
};

console.log(`快照：${outFile}`);
console.log(`字数：${text.length}｜各段：${parts.length}`);
if (warn.length) console.log(`⚠️ ${warn.join(' | ')}`);
console.log('—— L1 计数（口径：注入后的最终文本；期望：同事务决定句恰 1 次）——');
for (const [k, re] of Object.entries(ANCHORS)) {
  const hits = (text.match(re) || []).length;
  console.log(`${k}: ${hits}`);
}
if (!paFn) console.log('⚠️ 未找到 programAttach 的文本导出，已导出键：' + Object.keys(PA).join(','));
