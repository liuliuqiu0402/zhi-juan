/**
 * ✅ A1（2026-09-11）：锚树契约 —— 结构定义 / 粒度判据 / 入库校验 / 粒度诊断
 * ============================================================
 * 为什么要有这个文件：
 *   - 教材分析输出**即锚清单本体**：`knowledgeHierarchy` 第 2 层 `coreKnowledge` 每条 = 一个锚；
 *     下游（锚清单呈现 / 锚清单↔原文对应 / 缺料诊断）一律"零解释余量"地直读第 2 层。
 *   - 因此第 2 层粒度必须在**分析入库**时就把住：粒度不统一（如语文低段把"人/口/手"单字
 *     提为第 2 层条目）会让锚清单失真、下游取不到真考点。回看即可发现"短锚爆炸"是被下游
 *     反复当成"覆盖点"消费的。
 *
 * 契约三件事：
 *   ① **结构校验**：`validateAnchorTree` —— 结构不符 → **不落库**（重试/报错）。
 *   ② **粒度判据**：第 2 层 = 可独立成题 / 可独立教学组织的考点；**最小单位**（单字、单词条、
 *      单符号、单数值、术语碎片）强制下沉第 3 层 `specificConcepts`。判据给**语义 + 反例**，
 *      **不写数量区间**（防诱导为凑数/省事而删减已提取内容）。
 *   ③ **粒度诊断**：`anchorGranularityReport` —— 锚数 / 短锚占比（名长 ≤ 3 字）/ specificConcepts
 *      条数分布 / 绑定状态分布；三指标一起看（单看锚数会被"凑层"骗过：过细/过粗双向盯防）。
 *
 * 🔒 铁律：**校验只判结构、不改内容** —— 绝不因"看起来太细/太多"而删已提取条目（防削足适履）。
 *    违规一律走"拒绝落库 + 报错/重试"，由分析侧重出，而不是程序侧替它改。
 * ============================================================
 */
import { flattenAnchorTree } from './coverageAnchor.js';

/** 短锚阈值：锚名字长 ≤ 此值视为"短锚"（诊断指标用，非删除依据） */
export const SHORT_ANCHOR_MAX_LEN = 3;

/**
 * 最小单位判定（**确定性部分**）：单个汉字 / 单个字母 / 单个符号 / 纯数值 → 必须下沉第 3 层。
 * ⚠️ 边界（诚实声明）：语义型"单个词条 / 术语碎片"无法确定性判定，交由提示词的语义判据 + 反例约束，
 *    此处刻意不猜、不误判（宁可漏判，不可误删/误拒）。
 */
export const isMinUnitName = (name = '') => {
  const s = String(name || '').trim();
  if (!s) return false;
  if (s.length === 1) {
    if (/[\u4e00-\u9fa5]/.test(s)) return true;      // 单个汉字（反例："人""口""手"）
    if (/[A-Za-z]/.test(s)) return true;             // 单个字母
    if (/[0-9]/.test(s)) return true;                // 单个数字
    if (/[^\w\u4e00-\u9fa5]/.test(s)) return true;   // 单个符号
  }
  if (/^\d+(\.\d+)?$/.test(s)) return true;          // 纯数值（含小数，如 "0.5"）
  return false;
};

/**
 * 锚树结构校验：只判"结构 + 最小单位粒度"，**不改内容**。
 * @param {Array} hierarchy knowledgeHierarchy（分析输出原样）
 * @returns {{ ok:boolean, violations:Array<{code,path,name,reason}> }}
 */
export const validateAnchorTree = (hierarchy) => {
  const violations = [];
  const push = (code, path, reason, name = '') => violations.push({ code, path, name, reason });

  if (!Array.isArray(hierarchy)) {
    push('not-array', 'knowledgeHierarchy', 'knowledgeHierarchy 必须是数组');
    return { ok: false, violations };
  }
  if (hierarchy.length === 0) {
    push('empty', 'knowledgeHierarchy', 'knowledgeHierarchy 为空（未提取到任何大概念）');
  }
  hierarchy.forEach((bc, i) => {
    const bp = `[${i}]`;
    if (!bc || typeof bc !== 'object') { push('big-invalid', bp, '第1层条目不是对象'); return; }
    if (!String(bc.bigConcept || '').trim()) push('big-missing-name', bp, '第1层 bigConcept 名称为空');
    if (!Array.isArray(bc.coreKnowledge)) {
      push('core-not-array', `${bp}.coreKnowledge`, '第2层 coreKnowledge 必须是数组');
      return;
    }
    if (bc.coreKnowledge.length === 0) push('core-empty', `${bp}.coreKnowledge`, '第2层为空（该大概念下无考点）');
    bc.coreKnowledge.forEach((ck, j) => {
      const cp = `${bp}.coreKnowledge[${j}]`;
      if (!ck || typeof ck !== 'object') { push('core-invalid', cp, '第2层条目不是对象'); return; }
      const name = String(ck.name || '').trim();
      if (!name) {
        push('core-missing-name', cp, '第2层考点名称为空');
      } else if (isMinUnitName(name)) {
        push('core-is-min-unit', cp, `第2层出现最小单位「${name}」——须下沉第3层 specificConcepts`, name);
      }
      if (ck.specificConcepts !== undefined && !Array.isArray(ck.specificConcepts)) {
        push('specific-not-array', `${cp}.specificConcepts`, 'specificConcepts 必须是数组');
      } else if (Array.isArray(ck.specificConcepts) && ck.specificConcepts.some((s) => typeof s !== 'string')) {
        push('specific-item-invalid', `${cp}.specificConcepts`, 'specificConcepts 元素必须为字符串');
      }
      if (ck.suggestedQuestionTypes !== undefined && !Array.isArray(ck.suggestedQuestionTypes)) {
        push('types-not-array', `${cp}.suggestedQuestionTypes`, 'suggestedQuestionTypes 必须是数组');
      }
    });
  });
  return { ok: violations.length === 0, violations };
};

/**
 * 锚粒度诊断（输入 = 扁平锚列表：`flattenAnchorTree(anchorTree)` 或生成期已绑定锚）。
 * @param {Array} anchors
 * @param {{chapterTitle?:string}} [opts]
 * @returns {Object} { chapterTitle, anchorCount, shortAnchorCount, shortRatio, minUnitAnchorCount,
 *                     specificConcepts:{total,min,max,median,zeroCount}, bindStatus }
 */
export const anchorGranularityReport = (anchors = [], { chapterTitle = '' } = {}) => {
  const list = Array.isArray(anchors) ? anchors : [];
  const names = list.map((a) => String(a?.name || '').trim()).filter(Boolean);
  const lens = names.map((n) => n.length);
  const shortCount = lens.filter((l) => l <= SHORT_ANCHOR_MAX_LEN).length;
  const specCounts = list.map((a) => (Array.isArray(a?.specificConcepts) ? a.specificConcepts.filter(Boolean).length : 0));
  const sortedSpec = [...specCounts].sort((a, b) => a - b);
  const bindStatus = {};
  for (const a of list) {
    const st = a?.bind?.status;
    if (!st) continue;
    bindStatus[st] = (bindStatus[st] || 0) + 1;
  }
  return {
    chapterTitle,
    anchorCount: list.length,
    shortAnchorCount: shortCount,
    shortRatio: list.length ? +(shortCount / list.length).toFixed(3) : 0,
    minUnitAnchorCount: names.filter(isMinUnitName).length,
    specificConcepts: {
      total: specCounts.reduce((a, b) => a + b, 0),
      min: sortedSpec.length ? sortedSpec[0] : 0,
      max: sortedSpec.length ? sortedSpec[sortedSpec.length - 1] : 0,
      median: sortedSpec.length ? sortedSpec[Math.floor(sortedSpec.length / 2)] : 0,
      zeroCount: specCounts.filter((c) => c === 0).length,
    },
    bindStatus,
  };
};

/** 便捷入口：直接吃分析输出的 knowledgeHierarchy */
export const diagnoseAnchorTree = (hierarchy, opts = {}) =>
  anchorGranularityReport(flattenAnchorTree(hierarchy || []), opts);

/**
 * ✅ A1-4：锚点清单**按章分组**（章序 = 传入锚序，即"勾选章序 = 原文章序"。
 *   多条锚共用一个章标题是**正常形态**（锚只需知道"属于哪一章"，对应关系取章级）；同名锚去重。
 * @param {Array} anchors 锚列表（含 chapterTitle / name）
 * @returns {Array<{chapterTitle:string, names:string[]}>}
 */
export const buildAnchorListByChapter = (anchors = []) => {
  const groups = new Map();
  for (const a of (anchors || [])) {
    const ch = String(a?.chapterTitle || '').trim() || '未标注章节';
    if (!groups.has(ch)) groups.set(ch, []);
    const name = String(a?.name || '').trim();
    if (name && !groups.get(ch).includes(name)) groups.get(ch).push(name);
  }
  return [...groups.entries()].map(([chapterTitle, names]) => ({ chapterTitle, names }));
};

/** ✅ A1-4：锚点清单呈现形态 `【章名】考点A、考点B…`（一行一章，章序不变） */
export const formatAnchorListByChapter = (anchors = []) =>
  buildAnchorListByChapter(anchors)
    .filter((g) => g.names.length > 0)
    .map((g) => `【${g.chapterTitle}】${g.names.join('、')}`)
    .join('\n');

/** 单章诊断日志（A1-3 的**可观测证据**：一条含全部指标，便于日志抓取核对） */
export const logAnchorGranularity = (report = {}) => {
  const r = report || {};
  const hasBind = Object.keys(r.bindStatus || {}).length > 0;
  console.log(
    `📐 [锚粒度诊断] ${r.chapterTitle || '(未标注章)'}：`
    + `锚数=${r.anchorCount} 短锚(≤${SHORT_ANCHOR_MAX_LEN}字)=${r.shortAnchorCount}(${((r.shortRatio || 0) * 100).toFixed(0)}%) `
    + `最小单位违例=${r.minUnitAnchorCount} `
    + `specificConcepts 条数[最小/中位/最大]=${r.specificConcepts?.min}/${r.specificConcepts?.median}/${r.specificConcepts?.max} `
    + `空specific=${r.specificConcepts?.zeroCount} `
    + `绑定=${hasBind ? JSON.stringify(r.bindStatus) : '（生成期才有）'}`,
  );
};

/** 多章汇总（过细/过粗双向盯防；配合逐章日志构成 A1-3 证据） */
export const summarizeAnchorGranularity = (reports = []) => {
  const list = (reports || []).filter(Boolean);
  const anchorCount = list.reduce((a, r) => a + (r.anchorCount || 0), 0);
  const shortAnchorCount = list.reduce((a, r) => a + (r.shortAnchorCount || 0), 0);
  const minUnitAnchorCount = list.reduce((a, r) => a + (r.minUnitAnchorCount || 0), 0);
  const specTotal = list.reduce((a, r) => a + (r.specificConcepts?.total || 0), 0);
  return {
    chapterCount: list.length,
    anchorCount,
    shortAnchorCount,
    minUnitAnchorCount,
    specTotal,
    shortRatio: anchorCount ? +(shortAnchorCount / anchorCount).toFixed(3) : 0,
    avgAnchorsPerChapter: list.length ? +(anchorCount / list.length).toFixed(1) : 0,
  };
};
