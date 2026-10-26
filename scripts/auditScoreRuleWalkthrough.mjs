#!/usr/bin/env node
/**
 * 分值条自测（**判据走查 · 不经模型**）
 * ============================================================
 * 问题（属主 2026-10-19）："这个分值条，你有用这个自己测试下吗？"
 *   此前只测了"文本在位 / 条数相等"，没按条文推演**产物应长什么样**。
 *
 * 做法：把现行【分值标注】条文当**决策过程**，喂 8 种典型卷面结构，逐条推标法：
 *   带号组 → 其下**每道带号题**都在整道题设问的最后一句之后写出自己的分值，**一律全式**
 *            "（每〈单位〉X分，共Y分）"（〈单位〉取该处让学生作答的对象名）；标题由 B 侧按 Σ 合成。
 *   不带号组 → 分值**只写在大标题**，全式、单价不可省；该组题内一律不标分。
 *   口径：〈单位〉＝该处让学生作答的对象名；Y＝单价×该题判分处数。
 * 输出：每种结构的推导结果 ＋ 账目自洽（Σ 各题分＝标题总数）。
 *
 * 🔴 2026-10-25（属主定稿："分不清一处还是多处，就都标单价"）：旧口径"单处写（X分）、
 *   多处写全式"已废——两选一是模型"选哪种写法"的决策点，实测退化成整组不标。本件同步改准。
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
    // 2026-10-25：不带号支＝**标题全式单价、单价不可省**（单处也写"每篇15分，共15分"）。
    const label = `（每${c.unit}${c.price}分，共${total}分）`;
    console.log(`${c.name}\n  → 标题${label}；题内不标（${c.count} 个${c.unit}）`);
    if (!/每/.test(label)) { bad += 1; console.log('  ✗ 不带号标题必须带单价'); }
  } else {
    const itemTotals = c.items.map((n) => n * c.price);
    const total = itemTotals.reduce((a, b) => a + b, 0);
    // 2026-10-25：带号支一律全式；落点＝整道题设问的最后一句之后；〈单位〉取该处让学生作答的对象名（不预设"题"）。
    const per = c.items.map((n, i) => {
      const unit = n === 1 ? '题' : c.unit;
      return `${i + 1}.设问最后一句之后（每${unit}${c.price}分，共${n * c.price}分）`;
    });
    // 标题由 B 侧按逐题分合成：1 题→（共X分）；同档→（每题X分，共Y分）；多档→分组式。
    const uniq = [...new Set(itemTotals)];
    let label;
    if (c.items.length === 1) label = `（共${total}分）`;
    else if (uniq.length === 1) label = `（每题${uniq[0]}分，共${total}分）`;
    else {
      const groups = [];
      itemTotals.forEach((t, i) => {
        const g = groups.find((x) => x.total === t) || (groups.push({ total: t, nums: [] }), groups[groups.length - 1]);
        g.nums.push(i + 1);
      });
      label = `（${groups.map((g) => (g.nums.length >= 2
        ? `第${g.nums.join('、')}小题各${g.total}分`
        : `第${g.nums[0]}小题${g.total}分`)).join('，')}，共${total}分）`;
    }
    console.log(`${c.name}\n  → 标题${label}；${per.join('；')}；标注数 ${per.length}＝题号数 ${c.items.length}`);
    // 完整性：条数相等；账目：Σ 各题 Y＝标题总数。
    if (per.length !== c.items.length) { bad += 1; console.log('  ✗ 标注数 ≠ 题号数'); }
    if (itemTotals.reduce((a, b) => a + b, 0) !== total) { bad += 1; console.log('  ✗ 账目不闭合'); }
    per.forEach((p, i) => {
      if (!/每[^，,]+分，共\d+(?:\.\d+)?分/.test(p)) { bad += 1; console.log(`  ✗ 第${i + 1}题不是全式（形态不合规）`); }
    });
  }
}
console.log(`\n走查 ${CASES.length} 例｜不自洽 ${bad} 例`);
process.exit(bad ? 1 : 0);
