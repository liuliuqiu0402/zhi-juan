#!/usr/bin/env node
/**
 * 证据脚本·蓝本备注里的"内容领域"字样盘点（**待给向 P1 的量化依据**）
 * ============================================================
 * 问题（S4 收口判定 §三·待给向 2「物理-middle P1」同族）：
 *   卷面蓝本（`examPaperBlueprints`，键＝学科|学段，**一学段一份**）的 `section.note` 会**逐字**进指令
 *   （`buildStructureText` → 渲染为「——【要求·须逐项落实】」）。若 note 里写了**全学段**的内容领域
 *   （如「物理·初中」计算题 note＝"力学与电学综合"），而用户勾选的**范围**只是八年级某单元
 *   ⇒ **"须逐项落实"的硬要求 与 用户所选范围相抵**（范围单源＝勾选/命名层，蓝本不该另声明内容领域）。
 * 本脚本**只盘点、不判定**：给出"含内容领域词的备注行"全集，供属主裁定口径：
 *   · 若裁定"蓝本 note 只许写**形态要求**（作答方式/评分口径），内容领域由范围单源决定"
 *     ⇒ 处置面＝本脚本列出的行（逐行中性化/删除领域字样），而非补一句 prompt；
 *   · 若裁定"真题卷面形态优先（中考卷本就力学+电学综合）"
 *     ⇒ 记录为**已知边界**，不改数据（但需说明"仅适用于范围＝全学段的升学卷"）。
 * 用法：`node scripts/probeNoteDomains.mjs`（只读，不写盘）
 */
import { EXAM_BLUEPRINTS } from '../src/config/examPaperBlueprints.js';

const DOMAIN_WORDS = /力学|电学|电磁|光学|热学|几何|函数|方程|不等式|统计|概率|三角|古诗|文言|文学|修辞|时态|从句|词汇|元素|化学式|细胞|遗传|气候|地形|政权|哲学|音乐|美术|体育|信息/;

const hits = [];
for (const [key, bp] of Object.entries(EXAM_BLUEPRINTS)) {
  for (const s of bp.sections || []) {
    if (s.note && DOMAIN_WORDS.test(s.note)) hits.push({ key, name: s.name, score: s.score, note: s.note });
  }
}

console.log(`蓝图数=${Object.keys(EXAM_BLUEPRINTS).length}｜备注含"内容领域词"的行数=${hits.length}`);
const byKey = {};
for (const h of hits) (byKey[h.key] ||= []).push(h);
for (const [key, list] of Object.entries(byKey)) {
  console.log(`\n${key}（${list.length} 行）`);
  for (const h of list) console.log(`  · ${h.name}(${h.score}) ｜ ${h.note}`);
}
console.log('\n注：本清单＝"待给向 P1 同族"的处置面（若裁定"蓝本只写形态要求"）；不代表全部都是真错——');
console.log('   升学卷（中考/高考）范围＝全学段时，领域字样与范围**一致**；校内卷（范围＝某单元）时**相抵**。');
