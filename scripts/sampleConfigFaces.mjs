#!/usr/bin/env node
/**
 * B·配置维度抽样运行器（L3 风格轴 / L4 通道轴）
 * ------------------------------------------------------------
 * 为什么不改指令：本运行器**只做"换配置再装配＋比对"**，用的就是**面级装配单源**
 *   `scripts/instructionText.mjs`（与锚表门、防同质化守卫同一份实现）。
 * 每样本给"**应有 vs 实有**"（判法 §七：不得以"跑过了"代替证据）：
 *   · 风格块：期望注入时须在场（含【组织风格】头）；期望不注入时须**不在场**；
 *   · 素材使用约定块：恒在场；
 *   · 关键留白：来源不限／尾约束·资料内多样 恒在场；
 *   · 字符数：报出（供比对"换档后是否异常膨胀"）。
 * L1/L2（范围/卷别）、L5（库启停）**本运行器不覆盖**：装配入参未含范围/卷别（`paperScope`/`levelMapping`
 *   入参待扩展）；库启停在应用环境（localStorage）。⇒ 本文件与方案件均如实标注"待扩展"，不冒充已跑。
 */
import { buildInstructionText } from './instructionText.mjs';
import { DEFAULT_STYLE_BY_TYPE, STYLE_REQUIRED_TYPES, styleOptions } from '../src/config/expertKnowledge.js';

const STYLE_HEAD = '【组织风格】';
const CN = { exam: '正式考卷', practice: '同步练习', special: '专项突破', reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '易错题本', review: '复习资料', preview: '预习导学' };
const pick = (o) => o.key ?? o.value ?? o.id ?? o.name ?? '';
const ALT = {}; // 每组取一条非默认档备用
for (const o of styleOptions) {
  const g = o.group || 'x';
  ALT[g] ??= pick(o);
}

const rows = [];
function sample(label, genType, subject, stage, opts = {}) {
  const text = buildInstructionText(genType, subject, stage, opts);
  const wantStyle = !opts.noStyle && !!(opts.style !== undefined ? opts.style : (DEFAULT_STYLE_BY_TYPE[genType] || ''));
  const got = { style: text.includes(STYLE_HEAD), conv: text.includes('【素材使用约定】'), src: text.includes('来源不限、不作指定'), div: text.includes('【尾约束·资料内多样】') };
  const expect = { style: wantStyle, conv: true, src: true, div: true };
  const bad = Object.keys(expect).filter((k) => got[k] !== expect[k]);
  rows.push({ label, genType, subject, stage, chars: text.length, styleWant: wantStyle, styleGot: got.style, ok: bad.length === 0, bad: bad.join(',') });
}

// ---- L3 风格轴：7 型有默认 ⇒ 跑默认档；6 型必选 ⇒ 另跑"同组另一档" ----
for (const [genType, style] of Object.entries(DEFAULT_STYLE_BY_TYPE)) {
  if (!style) continue;
  sample(`风格·默认档(${style})`, genType, '语文', 'primary_high');
}
for (const genType of STYLE_REQUIRED_TYPES) {
  const alt = ALT.proposition !== (DEFAULT_STYLE_BY_TYPE[genType] || '') ? ALT.proposition : ALT.presentation;
  sample(`风格·另档(${alt})`, genType, '语文', 'primary_high', { style: alt });
}
// ---- 不注入分支（exam 默认空 + 显式 noStyle）----
sample('风格·不注入(exam 默认)', 'exam', '数学', 'high');
sample('风格·不注入(强制 noStyle)', 'summary', '语文', 'primary_high', { noStyle: true });
// ---- L4 通道轴 ----
sample('通道·anchor(题类)', 'practice', '数学', 'primary_high', { materialChannel: 'anchor' });
sample('通道·full(内容型)', 'summary', '语文', 'primary_high', { materialChannel: 'full' });

const w = (s, n) => String(s).padEnd(n);
console.log(w('样本', 26) + w('面', 34) + w('字数', 7) + w('风格应/实', 12) + '判定');
for (const r of rows) {
  console.log(w(r.label, 26) + w(`${r.subject}×${r.stage}×${CN[r.genType] || r.genType}`, 34) + w(r.chars, 7)
    + w(`${r.styleWant ? '注入' : '不注入'}/${r.styleGot ? '在场' : '不在场'}`, 12) + (r.ok ? '✓' : '✗ ' + r.bad));
}
const bad = rows.filter((r) => !r.ok);
console.log(`\n合计 ${rows.length} 样本｜✗ ${bad.length}`);
process.exitCode = bad.length ? 1 : 0;
