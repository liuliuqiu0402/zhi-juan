#!/usr/bin/env node
/**
 * 证据脚本·蓝本备注里的"内容领域"字样盘点（台账〔412〕的**处置面与留痕工具**）
 * ============================================================
 * 背景（属主 2026-10-13 裁定"**真题只是框架**…备注不是课标要求，还相当于**指定内容**了"）：
 *   卷面蓝本（`examPaperBlueprints`，键＝学科|学段）的 `section.note` 会**逐字**进指令
 *   （`buildStructureText` → 渲染为「——【要求·须逐项落实】」）。note 里写"考什么内容"＝**指定内容**，
 *   与"范围由用户勾选决定"相抵 ⇒ 已按判据清除 **39 处**（教材模块/章节名、年级册次进度、文体题材枚举）。
 *   守卫 `tests/config/bpWordingGuard.test.js` 加 **27 词回潮锁**；本脚本＝**人读版盘点**（只读、不写盘）。
 * 用法：`node scripts/probeNoteDomains.mjs` ⇒ 打印**当前仍含"内容领域词"的备注行**（应为"科目常识范畴"类，
 *   如 乐理/名曲/美术常识/运动技能——本批**有意未动**，见台账〔412〕"保留豁免"）。若出现教材模块/章节/年级进度词，即回潮。
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
