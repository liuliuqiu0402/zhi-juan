/**
 * 🔬 覆盖判定分类（Coverage Probe）—— 对账器"出现度判定"的确定性分类单一事实源
 * ============================================================
 * 🔴 定位（2026-09 覆盖治理 P2·根治）：practice/知识型正文是"情境化题目 + 答案"，考点多以行为/技能形态呈现，
 *    考点原文词（尤其"XX的意义/方法/规律/应用"类）不会逐字出现在正文——此前按考点词面逐词判定
 *    导致对账器大面积误报（曾以"小数乘法和除法"课时练出现 18/18 全缺漏，实为 78% 误报）。
 *
 * 判定两级（全部确定性，不语义理解；方向"宁可漏报不缺报"，防误报）：
 *   - chapter（章级聚合）：考点名含"行为/技能引导词"（意义/方法/规律/应用/取值…）→ 正文以行为体现，
 *     无法用词面可靠判定，归入章级——该章有任一考点命中即视为该章行为考点族已覆盖。
 *   - literal（精确判定）：概念/术词专名（如 循环小数/质数/方程…）→ 正文须以概念词出现，
 *     用 考点名+下位概念(+必要等价词) 词面命中判定；未命中即报缺（含"必须原词出现的概念"漏检）。
 *
 * 判缺产出两类，供调用方分层处置：
 *   - missing          : literal 考点未命中（有具体名，可由 auto 补漏指名短生成）
 *   - missingChapters  : 整章零命中的章（章级提示；行为考点不逐条报，防诱导）
 * ============================================================
 */

/** 行为/技能引导词：考点名含其一视为"行为语义考点" → 章级聚合判定（正文不会逐字出现） */
export const BEHAVIOR_TERMS = [
  '意义', '方法', '规律', '应用', '取值', '算法', '算理', '换算', '估算', '理解',
  '比较', '转化', '判断', '探究', '解决', '联系', '推理', '归纳', '分类',
  '运用', '掌握', '建模', '迁移', '思路', '步骤', '依据',
];

/** 数值近似族等价检测词（"积/商的近似值"正文常写作"保留X位小数/四舍五入/约"，词面收敛用） */
export const APPROX_ALIAS = ['近似值', '保留', '四舍五入', '约'];

/**
 * 判定考点属"章级聚合"还是"精确判定"。
 * @param {String} name 考点名
 * @returns {'chapter'|'literal'}
 */
export const classifyProbe = (name = '') =>
  BEHAVIOR_TERMS.some((t) => name.includes(t)) ? 'chapter' : 'literal';

/** 是否数值近似族（判定时附等价词，收敛"保留X位小数/四舍五入/约"措辞演化） */
const isApprox = (name = '') => /近似|估算/.test(name);

/** literal 考点的判定词集合（考点名 + 下位概念 + 必要等价词），供对账器 wordMatch */
export const literalProbeWords = (anchor = {}) => {
  const name = anchor?.name || '';
  const words = [name, ...(anchor?.specificConcepts || [])]
    .filter((w) => w && w.length >= 2);
  if (isApprox(name)) words.push(...APPROX_ALIAS);
  return [...new Set(words)];
};

/** 分组：章 → [{anchor}]（跳过 missing 缺料锚，红线不进可命题清单） */
export const groupByChapter = (anchors = []) => {
  const map = new Map();
  for (const a of (anchors || [])) {
    if (a.bind?.status === 'missing') continue;
    const k = a.chapterTitle || '未标注章节';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(a);
  }
  return map;
};