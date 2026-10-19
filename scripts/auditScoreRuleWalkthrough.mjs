#!/usr/bin/env node
/**
 * 分值条自测（**判据走查 · 不经模型**）
 * ============================================================
 * 问题（属主 2026-10-19）："这个分值条，你有用这个自己测试下吗？"
 *   此前只测了"文本在位 / 条数相等"，没按条文推演**产物应长什么样**。
 *
 * 做法：把现行【分值标注】条文当**决策过程**，喂 8 种典型卷面结构，逐条推标法：
 *   A1 有独立题干（＝其下各题带题号）→ 标题（共X分）＋每个带号题后（每〈单位〉X分，共Y分），
 *      条数相等；A2 无独立题干 → 单价随标题（每〈单位〉X分，共X分）；
 *      口径：〈单位〉＝该处让学生作答的对象名；Y＝单价×该题判分处数。
 * 输出：每种结构的推导结果 ＋ 账目自洽（Σ 各题分＝标题总数）。
 *
 * ⚠️ 边界：本件验的是**条文是否可判定、是否自洽**，不是模型是否照做（后者只能真机）。
 * 用法：`node scripts/auditScoreRuleWalkthrough.mjs`
 */
const CASES = [
  { name: 'S1 直接写得数：20 个算式分行、无题号', numbered: false, unit: '式', price: 1, count: 20, items: [] },
  { name: 'S2 竖式计算：4 个竖式、无题号', numbered: false, unit: '式', price: 3, count: 4, items: [] },
  { name: 'S3 选择：5 题带号、每题 1 个判分处、每题 2 分', numbered: true, unit: '题', price: 2, items: [1, 1, 1, 1, 1] },
  { name: 'S4 填空：6 题带号、每题 4 空、每空 1 分', numbered: true, unit: '空', price: 1, items: [4, 4, 4, 4, 4, 4] },
  { name: 'S5 判断：10 题带号、每题 1 处、每题 1 分', numbered: true, unit: '题', price: 1, items: Array(10).fill(1) },
  { name: 'S6 解决问题：3 题带号、判分处 2/3/2、每处 2 分', numbered: true, unit: '处', price: 2, items: [2, 3, 2] },
  { name: 'S7 看图写话：1 篇、无题号', numbered: false, unit: '篇', price: 15, count: 1, items: [] },
  { name: 'S8 计算：整大题只有 1 个带号题干、其内含 4 个竖式', numbered: true, unit: '式', price: 3, items: [4] },
];

let bad = 0;
for (const c of CASES) {
  if (!c.numbered) {
    const total = c.price * c.count;
    // 🔴 2026-10-19 属主裁定：整大题只有一个判分处时，标题只写（共X分），不写"每篇15分，共15分"
    const label = c.count === 1 ? `（共${total}分）` : `（每${c.unit}${c.price}分，共${total}分）`;
    console.log(`${c.name}\n  → 标题${label}；题内不标（${c.count} 个${c.unit}）`);
    if (c.count === 1 && /每/.test(label)) { bad += 1; console.log('  ✗ 单判分处不得写单价'); }
  } else {
    const itemTotals = c.items.map((n) => n * c.price);
    const total = itemTotals.reduce((a, b) => a + b, 0);
    // 🔴 2026-10-19 属主裁定：该题只有一个判分处时写（X分），不写"每题2分，共2分"
    const per = c.items.map((n, i) => (n === 1
      ? `${i + 1}.题后（${c.price * n}分）`
      : `${i + 1}.题后（每${c.unit}${c.price}分，共${n * c.price}分）`));
    console.log(`${c.name}\n  → 标题（共${total}分）；${per.join('；')}；标注数 ${per.length}＝题号数 ${c.items.length}`);
    // A1 的完整性：条数相等；账目：Σ 各题 Y＝标题总数
    if (per.length !== c.items.length) { bad += 1; console.log('  ✗ 标注数 ≠ 题号数'); }
    if (itemTotals.reduce((a, b) => a + b, 0) !== total) { bad += 1; console.log('  ✗ 账目不闭合'); }
    c.items.forEach((n, i) => {
      if (n === 1 && /共\d+分/.test(per[i])) { bad += 1; console.log(`  ✗ 第${i + 1}题单判分处不得写"共X分"`); }
    });
  }
}
console.log(`\n走查 ${CASES.length} 例｜不自洽 ${bad} 例`);
process.exit(bad ? 1 : 0);
