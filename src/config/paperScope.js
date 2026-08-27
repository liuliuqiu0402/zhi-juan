/**
 * 命题范围推断 + 卷首标题拼装（纯函数，无 Vue/引擎依赖，可独立单测）
 * ============================================================
 * 角色语义（与命题老师勾选行为一一对应）：
 *   · 课    —— 只勾选单个章节节点      → 范围名 = 该课标题
 *   · 单元  —— 整个单元目录全部勾选    → 这些节点共享最近公共祖先（单元）→ 范围名 = 祖先标题
 *   · 期中/期末/月考/专题 —— 跨多单元多选（无共同祖先）→ 范围名 = 范围标签词（可轮换）
 *
 * 该函数同时服务两类命名：
 *   1) 文件名/文档列表命名（GenerateModule，统一消解多处重复实现）
 *   2) 卷首大标题（生成标题占位符组装），让"命题范围"进入正式标题
 *
 * 🔴 范围类型分流规则（本模块的唯一判定口径，整卷生成路径共用）：
 *   - scopeType 显式指定为非默认（midterm/final/monthly/topic）→ 一律用该类型的标签词（可轮换 override），
 *     即便勾选只是单课/单元也尊重用户显式意图（选"期中"就出"期中"）。
 *   - scopeType 为 default/空      → 按勾选集合自动推断：
 *       1 个节点            → 课名
 *       多节点同属一个单元    → 单元标题（仅当公共祖先是"真容器"且处于目录层级1+，防误取书目名）
 *       跨单元多选 / 无公共祖先 → 默认标签词（综合检测）
 */

/** 范围标签词池（显式范围类型使用）。词条自带类型语义（…测试/测评/卷/检测） */
export const SCOPE_LABEL_POOLS = {
  default: ['综合检测', '综合达标', '全程测评'],
  midterm: ['期中综合测试', '期中素养检测', '期中质量检测', '阶段综合测评', '中期学业检测'],
  final: ['期末综合测试', '期末素养检测', '期末质量检测', '学期综合测评', '期末学业检测'],
  monthly: ['月考检测', '月度素养检测', '月度综合测评', '月测卷'],
  topic: ['专题过关', '专题训练', '专题测评'],
};

/** 范围维度 → 中文标签（弹窗候选用；确认的是"维度"，具体标题名称由名称池轮换组合） */
export const SCOPE_DIMENSION_LABELS = { midterm: '期中', final: '期末', monthly: '月考', topic: '专题', default: '综合' };

/** 🔴 显式范围类型：用户手动选择"期中/期末/月考/专题"时应始终以标签词呈现（override 自动推断） */
export const EXPLICIT_SCOPE_TYPES = ['midterm', 'final', 'monthly', 'topic'];

/**
 * 卷首大标题拼装（标题命名规范，GenerateModule 注入与入库统一使用，便于维护）：
 *   普通型（课/单元范围）：年级 + 学科 + 册别 + 范围名 + 类型名（类型名从名称池轮换）
 *   考试型（期中/期末/月考/专题，isExam=true）：学年度学期 + 年级 + 学科 + 范围标签词（从名称池轮换）
 */
export const buildPaperTitle = ({ grade = '', subject = '', semester = '', scopeName = '', typeLabel = '', academic = '', isExam = false }) => {
  const parts = isExam
    ? [academic, grade, subject, scopeName].filter(Boolean)
    : [grade, subject, semester, scopeName, typeLabel].filter(Boolean);
  return parts.join('') || '未命名资料';
};

/**
 * 计算勾选节点最近公共祖先（LCA）。
 * @returns {{ lcaIdx:number, node:Object|null }} 无公共祖先返回 { lcaIdx:-1, node:null }
 */
export function findCommonAncestorIndex(chapters, outline) {
  const arr = Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  if (arr.length < 2 || !Array.isArray(outline)) return { lcaIdx: -1, node: null };
  const paths = [];
  const collect = (nodes, anc) => {
    for (const node of nodes || []) {
      if (arr.includes(node)) paths.push([...anc, node]);
      if (node.children) collect(node.children, [...anc, node]);
    }
  };
  collect(outline, []);
  const first = paths[0];
  if (paths.length < 2 || !first) return { lcaIdx: -1, node: null };
  let lcaIdx = first.length - 1;
  for (let i = 0; i < first.length; i++) {
    if (!paths.every(p => p.length > i && p[i] === first[i])) { lcaIdx = i - 1; break; }
  }
  if (lcaIdx < 0) return { lcaIdx: -1, node: null };
  return { lcaIdx, node: first[lcaIdx] };
}

/**
 * 推断命题范围名（单数据源，整卷生成路径共用）。
 * @param {Array} chapters 选中的章节节点（来自 outline）
 * @param {Array} outline 该教材的目录树根
 * @param {string} [scopeType] 范围类型（default/midterm/final/monthly/topic）
 * @param {Function} [pickScope] (scopeType)=>string 范围标签词（可带轮换持久化）；省略时用池内静态首词
 * @returns {{ name:string, isScopeLabel:boolean, category:string }}
 *   category ∈ lesson|unit|midterm|final|monthly|topic|default，用于"生成方案"摘要回显判定依据
 */
export function inferPaperScope(chapters = [], outline = [], scopeType = '', pickScope) {
  const arr = (Array.isArray(chapters) ? chapters : []).filter(Boolean);

  // 🔴 显式范围类型（期中/期末/月考/专题）：尊重用户意图，直接取标签词（可轮换 override）
  if (EXPLICIT_SCOPE_TYPES.includes(scopeType)) {
    const label = pickScope
      ? pickScope(scopeType)
      : (SCOPE_LABEL_POOLS[scopeType]?.[0] ?? SCOPE_LABEL_POOLS.default[0]);
    return { name: label, isScopeLabel: true, category: scopeType };
  }

  // 单课：只勾选一个节点 → 课名；若勾选的是附属顶层节点（语文园地）→ 归并到前一个有效单元
  if (arr.length === 1) {
    const node = arr[0];
    if (ATTACHED_TOP_RE.test(node.title || '')) {
      const idx = effectiveUnitIndices([node], outline);
      if (idx.length === 1 && outline[idx[0]]?.title) {
        return { name: outline[idx[0]].title, isScopeLabel: false, category: 'unit' };
      }
    }
    return { name: node.title || '', isScopeLabel: false, category: 'lesson' };
  }

  // 多节点：求最近公共祖先。目录顶层即单元，单单元内多选 → LCA 为该单元（index 0 也有效）
  if (arr.length > 1) {
    const lca = findCommonAncestorIndex(arr, outline);
    if (lca && lca.node) return { name: lca.node.title || '', isScopeLabel: false, category: 'unit' };
  }

  // 🔴 多节点但 LCA 失败（常见于"语文园地"与单元平级、勾选单元课文+园地）：
  //    把"园地/综合练习/单元小结"等附属顶层节点归并到前一个有效单元，
  //    避免整单元勾选被误判为跨单元而丢单元名（用户勾"第二单元"应出"第二单元"）。
  const effectiveIdx = effectiveUnitIndices(arr, outline);
  if (effectiveIdx.length === 1) {
    const u = outline[effectiveIdx[0]];
    if (u?.title) return { name: u.title, isScopeLabel: false, category: 'unit' };
  }

  // 🔴 真正跨单元多选 → 按所选单元在整本的覆盖位置自动归 期中/期末/综合
  const category = categorizeUnits(arr, outline);
  const label = pickScope
    ? pickScope(category)
    : (SCOPE_LABEL_POOLS[category]?.[0] ?? SCOPE_LABEL_POOLS.default[0]);
  if (label) return { name: label, isScopeLabel: true, category };
  return { name: arr[0]?.title || '', isScopeLabel: false, category };
}

/** 附属顶层节点正则：语文园地/综合练习/单元小结/复习等（教材中随附前一个单元，不算独立单元） */
const ATTACHED_TOP_RE = /园地|综合练习|单元小结|复习与|总复习|整理与复习/i;

/**
 * 学年度学期推断（正式考试（期中/期末/月考）卷首标题前缀用）。
 * 规则：学年度 = 9月1日-次年8月31日；学期 = 9月-次年1月为第一学期、2月-8月为第二学期（8月视为第二学期末/暑假）。
 * @param {Date} [now] 当前时间（测试可注入固定日期）
 * @returns {string} 如 "2025-2026学年度第二学期"
 */
export function inferAcademicTerm(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const startYear = m >= 9 ? y : y - 1;
  const term = (m >= 9 || m <= 1) ? '第一学期' : '第二学期';
  return `${startYear}-${startYear + 1}学年度${term}`;
}

/**
 * 计算所选章节归属的"有效单元"下标（园地等附属顶层节点归并到前一个有效单元）。
 * @returns {number[]} 去重后的有效单元下标（可为空）
 */
export function effectiveUnitIndices(chapters, outline) {
  const raw = topLevelGroupIndices(chapters, outline);
  if (raw.length === 0) return [];
  const effective = new Set();
  for (const i of raw) {
    if (ATTACHED_TOP_RE.test(outline[i]?.title || '')) {
      for (let j = i - 1; j >= 0; j--) {
        if (!ATTACHED_TOP_RE.test(outline[j]?.title || '')) { effective.add(j); break; }
      }
    } else {
      effective.add(i);
    }
  }
  return [...effective].sort((a, b) => a - b);
}

/**
 * 命题范围候选（供"范围确认弹窗"使用——按勾选内容提取候选，用户确认后定范围名）。
 * 候选规则（确认的是"维度"，具体标题名称由名称池在组装时轮换组合）：
 *   · 显式范围类型（期中/期末/月考/专题）→ 维度已由用户配置确定，无需弹窗（返回空，直接走名称池轮换）
 *   · 推断为单元/课名（无歧义）→ 该名（唯一候选，标题携带单元/课信息）
 *   · 跨单元/空（推断为标签）→ 维度词候选（期中/期末/月考/综合），确认维度后名称池组合具体名
 * @returns {Array<{label:string, value:string, hint:string}>} 去重候选（首项为推荐）
 */
export function buildScopeCandidates(chapters = [], outline = [], scopeType = '') {
  const inferred = inferPaperScope(chapters, outline, scopeType);
  const seen = new Set();
  const list = [];
  const push = (label, value, hint) => {
    if (seen.has(value)) return;
    seen.add(value);
    list.push({ label, value, hint });
  };
  if (EXPLICIT_SCOPE_TYPES.includes(scopeType)) {
    // 显式类型：维度已定（用户配置选了"期中"），具体名称由名称池组装时轮换（期中 → 期中综合测试/期中素养检测…）
    return [];
  }
  if (inferred.isScopeLabel) {
    // 跨单元/空：候选为"维度词"（确认维度，名称池组合具体名）；推断类别优先排序
    const order = [inferred.category, 'midterm', 'final', 'monthly', 'default']
      .filter((v, i, a) => a.indexOf(v) === i);
    for (const cat of order) {
      const dim = SCOPE_DIMENSION_LABELS[cat];
      if (dim) push(dim, dim, '范围维度');
    }
  } else {
    // 单元/课名：勾选范围名是唯一合理候选（标题必须携带单元/课信息）
    push(inferred.name, inferred.name, inferred.category === 'unit' ? '勾选范围（单元）' : '勾选范围（课）');
  }
  return list;
}

/** 计算所选章节落在哪些顶层分组（单元）上，返回这些顶层单元的下标集合 */
export function topLevelGroupIndices(chapters, outline) {
  const leafSet = new Set((Array.isArray(chapters) ? chapters : []).filter(Boolean));
  const hit = (node) => leafSet.has(node) || (node?.children || []).some(hit);
  const idx = [];
  (Array.isArray(outline) ? outline : []).forEach((root, i) => { if (hit(root)) idx.push(i); });
  return idx;
}

/**
 * 跨单元多选 → 按覆盖位置自动归类：
 *   unit（单单元，实际由 LCA 分支处理）、final（覆盖到书末）、midterm（仅前半段）、default（综合）
 * @returns {string} final | midterm | default | unit
 */
export function categorizeUnits(chapters, outline) {
  const idx = topLevelGroupIndices(chapters, outline);
  const G = (Array.isArray(outline) ? outline : []).length;
  if (idx.length === 0) return 'default';
  if (idx.length === 1) return 'unit';
  const last = Math.max(...idx);
  if (last === G - 1) return 'final';
  if (last < Math.ceil(G / 2)) return 'midterm';
  return 'default';
}
