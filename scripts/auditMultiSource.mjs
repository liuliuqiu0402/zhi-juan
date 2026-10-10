// 🔍 多源巡检（**按"事务"聚类**，不按字面）—— 覆盖**全部 9 批**
// ============================================================
// 治什么（2026-10-10 属主：历次"多源巡检"都回"没有"，可最近几轮修复**每次**都是多源（拉扯）导致的）：
//   病根在**查法**——历次查的是"同一句话出现两次"（字面去重），而真正咬人的多源，字面法**天然照不出**：
//     ① **两处用不同词说同一件事**；② **一处判据、另一处"像判据的落例"**；
//     ③ **同一要求按层级/学段切散多处**；④ **同一事务由两个名词承载**。
//   ⇒ 改**按"事务"聚类**：对每个事务，把模板里**所有**相关条款拉出来看（不管用词），再判 同源／拉扯。
// 用法：node scripts/auditMultiSource.mjs [--full] [--batch=exam]
//   默认扫**全部 9 批**（每批取 语文·小学 一档为代表；`--full` 打整条；`--batch=` 限一批）。
//
// 判读口径（照 `附·4·严`）：
//   · **同源分工**＝多处对象/时机不同（如"卷面层级"管呈现、"题号与分值"管口径）。
//   · **拉扯**＝同一对象、同一时点，**两处各给要求或判词**（模型二选一 → 产出不稳）。
import { getPromptTemplate } from '../src/config/promptLibrary.js';

const FULL = process.argv.includes('--full');
const DIFF = process.argv.includes('--diff'); // 只打"本批有、exam 没有"的条款（批特异块）
const only = (process.argv.find((a) => a.startsWith('--batch=')) || '').split('=')[1];
const BATCHES = only ? [only] : ['exam', 'practice', 'special', 'reading', 'dictation', 'review', 'summary', 'preview', 'errorbook'];

const splitClauses = (t) => String(t || '').split(/\n|；/).map((s) => s.trim()).filter((s) => s.length > 6);
const EXAM_SET = new Set(splitClauses(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template));

/** 事务表：按"事情"聚类（用词可增补，事务不可省） */
const TOPICS = [
  ['编号/题号', /题号|编号|序号/],
  ['分值/计分', /分值|计分|单价|账目|整除|得分|总分/],
  ['标题/命名', /标题|命名|名称|题名/],
  ['情境', /情境|背景|场景|关卡/],
  ['答案区', /答案/],
  ['重复/唯一', /重复|唯一|同义|同文|近义|同型/],
  ['层级/排版', /层级|空行|字体|加粗|居中|顶格|留白|装订|分栏|序号体系/],
  ['材料/素材', /材料|素材|原文|参考段/],
  ['数量/篇幅', /题量|数量|篇数|字数|篇幅|几题|总数/],
  ['作答位/载体', /作答位|横线|括号|方框|书写格|作答载体|书写对象/],
];

for (const g of BATCHES) {
  const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: g }).template || '';
  const all = splitClauses(tpl);
  const clauses = DIFF ? all.filter((c) => !EXAM_SET.has(c)) : all; // 批特异块
  const rows = TOPICS.map(([n, re]) => [n, clauses.filter((c) => re.test(c))]).filter(([, h]) => h.length >= 2);
  console.log(`\n===== ${g}${DIFF ? '(批特异)' : ''} | 语文·小学 | 条款 ${clauses.length} | 多命中事务 ${rows.length} =====`);
  for (const [n, hit] of rows) {
    console.log(`--[${n}] ${hit.length} 处`);
    hit.slice(0, DIFF ? 3 : 5).forEach((c, i) => console.log(`   ${i + 1}. ${FULL ? c : c.slice(0, 56)}`));
  }
}
console.log('\n（判读：同源分工／拉扯——同一对象同一时点两处各出要求或判词即为拉扯）');
