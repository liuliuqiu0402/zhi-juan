/**
 * ✅ A1（2026-09-11）：锚树契约 —— 结构定义 / 粒度判据 / 入库校验 / 粒度诊断
 * ============================================================
 * 为什么要有这个文件：
 *   - 教材分析输出**即锚清单本体**：`knowledgeHierarchy` 第 2 层 `coreKnowledge` 每条 = 一个锚；
 *     下游（锚清单呈现 / 锚清单↔原文对应 / 缺料诊断）一律"零解释余量"地直读第 2 层。
 *   - 因此第 2 层粒度必须在**分析入库**时就把住：粒度不统一（如语文低段把"人/口/手"单字
 *     提为第 2 层条目）会让锚清单失真、下游取不到真知识点。回看即可发现"短锚爆炸"是被下游
 *     反复当成"覆盖点"消费的。
 *
 * 契约三件事：
 *   ① **结构校验**：`validateAnchorTree` —— 结构不符 → **不落库**（重试/报错）。
 *   ② **粒度判据**：第 2 层 = 可独立教学组织 / 可独立成题的知识点；**最小单位**（单字、单词条、
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
    if (bc.coreKnowledge.length === 0) push('core-empty', `${bp}.coreKnowledge`, '第2层为空（该大概念下无知识点）');
    bc.coreKnowledge.forEach((ck, j) => {
      const cp = `${bp}.coreKnowledge[${j}]`;
      if (!ck || typeof ck !== 'object') { push('core-invalid', cp, '第2层条目不是对象'); return; }
      const name = String(ck.name || '').trim();
      if (!name) {
        push('core-missing-name', cp, '第2层知识点名称为空');
      } else if (isMinUnitName(name)) {
        push('core-is-min-unit', cp, `第2层出现最小单位「${name}」——须下沉第3层 specificConcepts`, name);
      }
      if (ck.specificConcepts !== undefined && !Array.isArray(ck.specificConcepts)) {
        push('specific-not-array', `${cp}.specificConcepts`, 'specificConcepts 必须是数组');
      } else if (Array.isArray(ck.specificConcepts) && ck.specificConcepts.some((s) => typeof s !== 'string')) {
        push('specific-item-invalid', `${cp}.specificConcepts`, 'specificConcepts 元素必须为字符串');
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
 *                     specificConcepts:{total,unique,dupCount,dupRatio,min,max,median,zeroCount}, bindStatus }
 */
export const anchorGranularityReport = (anchors = [], { chapterTitle = '' } = {}) => {
  const list = Array.isArray(anchors) ? anchors : [];
  const names = list.map((a) => String(a?.name || '').trim()).filter(Boolean);
  const lens = names.map((n) => n.length);
  const shortCount = lens.filter((l) => l <= SHORT_ANCHOR_MAX_LEN).length;
  const specCounts = list.map((a) => (Array.isArray(a?.specificConcepts) ? a.specificConcepts.filter(Boolean).length : 0));
  const sortedSpec = [...specCounts].sort((a, b) => a - b);
  // ✅ A1-3b：第3层**重复率**（可观测 —— 同名/同写法单位重复收录是本层最常见的漂移）
  const specAll = list.flatMap((a) => (Array.isArray(a?.specificConcepts) ? a.specificConcepts : []))
    .map((s) => String(s || '').trim()).filter(Boolean);
  const specUnique = new Set(specAll).size;
  const dupCount = specAll.length - specUnique;
  const bindStatus = {};
  for (const a of list) {
    const st = a?.bind?.status;
    if (!st) continue;
    bindStatus[st] = (bindStatus[st] || 0) + 1;
  }
  const minUnitNames = names.filter(isMinUnitName);
  return {
    chapterTitle,
    anchorCount: list.length,
    shortAnchorCount: shortCount,
    shortRatio: list.length ? +(shortCount / list.length).toFixed(3) : 0,
    minUnitAnchorCount: minUnitNames.length,
    minUnitAnchors: minUnitNames,
    specificConcepts: {
      total: specCounts.reduce((a, b) => a + b, 0),
      unique: specUnique,
      dupCount,
      dupRatio: specAll.length ? +(dupCount / specAll.length).toFixed(3) : 0,
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
 * ✅ A1-4b（2026-09-11 用户定「第一二层都带着」）：**同时给出第1层（bigConcept 知识主题）分组**，
 *   让模型看到"知识点归属哪个知识主题"；`names` 仍保留扁平形态（章级范围判断/兼容取用）。
 *   ⚠️ 第1层只表**归属与范围**，不是写作栏目、不作命题单位（写作粒度以第2层知识点为准）——
 *   因此它在清单里只以「主题：」前缀出现，且**与章名相同的第1层（目录锚形态）自动省略**，避免冗余。
 * ✅ A17（2026-09-14 用户定版）：**第3层具体概念（specificConcepts）随知识点并入清单**——
 *   锚清单注入通道（命题/练习型）的注入物收敛为"锚点清单（含第3层）+ 难度要求"，不再另注入语料锚；
 *   第3层是经粒度校验的结构化概念明细（如多音字辨析→长cháng/长zhǎng），比原文片段绑定更可靠。
 * ⚠️ 术语口径（2026-09-14 用户定）：面向模型与用户的措辞统一用**「知识点」**，不用「考点」——
 *   本产品含归纳/复习/预习/默写等非命题型资料，"考点"读来全指向考卷（仅在明确命题语境的句子中保留）。
 * @param {Array} anchors 锚列表（含 chapterTitle / bigConcept / name / specificConcepts）
 * @returns {Array<{chapterTitle:string, names:string[], themes:Array<{bigConcept:string,names:string[],concepts:Object<string,string[]>}>}>}
 */
export const buildAnchorListByChapter = (anchors = []) => {
  const groups = new Map();
  for (const a of (anchors || [])) {
    const ch = String(a?.chapterTitle || '').trim() || '未标注章节';
    if (!groups.has(ch)) groups.set(ch, { names: [], themeIndex: new Map() });
    const name = String(a?.name || '').trim();
    if (!name) continue;
    const concepts = (Array.isArray(a?.specificConcepts) ? a.specificConcepts : [])
      .filter((c) => String(c || '').trim());
    const g = groups.get(ch);
    if (!g.names.includes(name)) g.names.push(name);
    const big = String(a?.bigConcept || '').trim();
    if (!g.themeIndex.has(big)) g.themeIndex.set(big, new Map());
    const bucket = g.themeIndex.get(big); // Map<知识点名, 具体概念[]>
    if (!bucket.has(name)) bucket.set(name, []);
    const merged = bucket.get(name);
    for (const c of concepts) if (!merged.includes(c)) merged.push(c);
  }
  return [...groups.entries()].map(([chapterTitle, g]) => ({
    chapterTitle,
    names: g.names,
    themes: [...g.themeIndex.entries()].map(([bigConcept, m]) => ({
      bigConcept,
      names: [...m.keys()],
      concepts: Object.fromEntries(m),
    })),
  }));
};

/** 第1层是否值得呈现：非空，且不同于章名（目录锚的 bigConcept = 章名 → 冗余，省略） */
const isMeaningfulTheme = (bigConcept, chapterTitle) =>
  !!bigConcept && bigConcept !== String(chapterTitle || '').trim();

/** ✅ A17：知识点名后附第3层具体概念（紧凑形态）；无概念/超限量 → 不带或加"等" */
export const MAX_SPECIFIC_CONCEPTS_PER_ANCHOR = 6;
/** 🔬 语言材料行前缀（命题型清单：语言材料单列一处，标明不作覆盖单位） */
export const MATERIAL_LINE = '◇ 语言材料（只作理解与难度依据，不在覆盖单位之列）：';
const withConcepts = (name, concepts, enabled = true) => {
  if (!enabled) return name;
  const list = Array.isArray(concepts) ? concepts.filter((c) => String(c || '').trim()) : [];
  if (!list.length) return name;
  const tail = list.length > MAX_SPECIFIC_CONCEPTS_PER_ANCHOR ? '等' : '';
  return `${name}（${list.slice(0, MAX_SPECIFIC_CONCEPTS_PER_ANCHOR).join('、')}${tail}）`;
};

/**
 * ✅ A1-4 / A1-4b / A17：锚点清单呈现形态。
 *   无有意义的第1层 → 紧凑单行：`【章名】知识点A、知识点B…`
 *   有第1层 → 分层呈现：
 *     【章名】
 *     · 知识主题A：知识点A、知识点B
 *     · 知识主题B：知识点C
 *   章序不变（一行一章 / 一主题一行），第1层与第2层均同名去重；
 *   知识点名后括号内为第3层具体概念（每知识点限量，超限加"等"）。
 * @param {Array} anchors 锚列表
 * @param {object} [o]
 * @param {boolean} [o.withConcepts] 是否携带第3层具体概念（用户开关·2026-09-14）——
 *   关掉时只给第2层知识点（清单更短、更"轻"，不与教材词句绑定）；角色说明须同步省略第3层那句
 *   （见 anchorListRoleNote），防"指向不存在的内容"的假指针。
 * @param {boolean} [o.splitMaterial] 是否把"语言材料"类条目（anchor.kind='material'）单列并标注
 *   （命题型 true）——语言材料只作理解与难度依据、不列入覆盖单位；内容型（false）照旧混在覆盖清单里
 *   （总结/复习/预习/默写本就该围绕教材语篇组织）。⚠️ 缺 kind 字段（旧分析结果）时视为知识性条目 →
 *   行为与分流前完全一致（安全无害）。
 */
export const formatAnchorListByChapter = (anchors = [], { withConcepts: withConceptsOn = true, splitMaterial = false } = {}) => {
  // 🔬 语言材料集合（按条目名匹配；清单渲染与角色说明共用同一口径）
  const materialSet = new Set(
    (Array.isArray(anchors) ? anchors : [])
      .filter((a) => a?.kind === 'material')
      .map((a) => String(a?.name || '').trim())
      .filter(Boolean),
  );
  const isMaterial = (n) => splitMaterial && materialSet.has(String(n || '').trim());
  return buildAnchorListByChapter(anchors)
    .filter((g) => g.names.length > 0)
    .map((g) => {
      const themes = (g.themes || []).filter((t) => t.names.length > 0);
      const hasTheme = themes.some((t) => isMeaningfulTheme(t.bigConcept, g.chapterTitle));
      const fmtNames = (names, concepts) => names.map((n) => withConcepts(n, concepts?.[n], withConceptsOn)).join('、');
      const mergedConcepts = Object.fromEntries(themes.flatMap((t) => [...Object.entries(t.concepts || {})]));
      const mats = [];
      if (!hasTheme) {
        // 无主题 → 章级扁平：合并各主题下的概念映射（同名知识点只归一个主题，合并仅防异常）
        const keep = g.names.filter((n) => !isMaterial(n));
        mats.push(...g.names.filter(isMaterial));
        const head = keep.length ? `【${g.chapterTitle}】${fmtNames(keep, mergedConcepts)}` : `【${g.chapterTitle}】`;
        return mats.length ? `${head}\n${MATERIAL_LINE}${fmtNames(mats, mergedConcepts)}` : head;
      }
      const lines = themes
        .map((t) => {
          const keep = t.names.filter((n) => !isMaterial(n));
          mats.push(...t.names.filter(isMaterial));
          if (!keep.length) return '';
          return isMeaningfulTheme(t.bigConcept, g.chapterTitle)
            ? `· ${t.bigConcept}：${fmtNames(keep, t.concepts)}`
            : `· ${fmtNames(keep, t.concepts)}`;
        })
        .filter(Boolean);
      // 语言材料行置于该章末尾：不占主题行位置，避免被读成"又一个栏目"
      if (mats.length) lines.push(`${MATERIAL_LINE}${fmtNames(mats, mergedConcepts)}`);
      return `【${g.chapterTitle}】\n${lines.join('\n')}`;
    })
    .join('\n');
};

/** ✅ A1-4b：清单的角色说明（随【锚点清单】一起注入，防模型把第1层当写作栏目/命题单位）
 *  🔴 2026-09-13（用户定版·下限非上限；同日二次修订）：清单定位由"命题范围边界"改为"覆盖下限"。
 *     本条只声明**结构性事实 + 覆盖下限**，**不写"可补充清单外"**——因为清单之外能否补充/整合**按资料类型而异**
 *     （题类可补充、归纳复习类可关联已学旧知成网络、预习默写类守本课/守教材），统一口径收敛在
 *     委托书【素材使用约定】（数据源 coverageContract.extentOf），避免在此处一刀切放水。
 *     原"最小单位**一律**是考点"的"一律"易被读成"只能考清单内的点"，已去。
 *  ✅ A17（2026-09-14 用户定版）：加入第3层说明——知识点名后括号内为具体概念（术语口径见上：统一「知识点」），
 *     不是写作栏目、不构成新的组织维度。 */
/** ✅ A17：第3层具体概念的说明句（随开关省略——第3层不注入时不留悬空引用） */
const THIRD_LAYER_NOTE =
  '知识点名后括号内为该知识点的**具体概念**（第3层）：仅细化"该知识点含哪些概念/词条/数值"，'
  + '不构成新的写作栏目，不得据此另立结构。';

/**
 * ✅ A1-4b / A17 / 2026-09-14（用户新增开关）：清单角色说明。
 * @param {object} [o]
 * @param {boolean} [o.withConcepts] 清单是否携带第3层具体概念——关掉时"第3层"说明句同步省略
 */
export const anchorListRoleNote = ({ withConcepts = true, splitMaterial = false } = {}) =>
  '说明：清单按「章 → 知识主题 → 知识点」组织。**知识主题（第1层）仅表知识点归属与范围，不是写作栏目、不是命题单位**；'
  + '写作与命题的最小单位是各主题下的**知识点**（第2层）。'
  + (withConcepts ? THIRD_LAYER_NOTE : '')
  + '不带「主题：」前缀的章 = 该章知识点未再分主题。'
  + '🔴 清单是**覆盖下限**：清单内知识点须全部覆盖到（保证本单元必学知识不漏）；'
  + '它**不是命题范围的全部**——清单之外能否补充或整合，按资料类型见委托书【素材使用约定】。'
  + (splitMaterial ? '标◇的**语言材料**用于把握难度与理解语境，**不列入覆盖单位**（不必为其单独设题）。' : '');

/** 默认形态（带第3层）——兼容既有引用点与测试 */
export const ANCHOR_LIST_ROLE_NOTE = anchorListRoleNote();

/** 单章诊断日志（A1-3 的**可观测证据**：一条含全部指标，便于日志抓取核对） */
export const logAnchorGranularity = (report = {}) => {
  const r = report || {};
  const hasBind = Object.keys(r.bindStatus || {}).length > 0;
  const minUnitStr = (r.minUnitAnchors || []).length > 0
    ? `❌ 最小单位违例[${r.minUnitAnchorCount}]：${r.minUnitAnchors.join('、')}`
    : `✅ 最小单位违例=0（均已下沉第3层）`;
  console.log(
    `📐 [锚粒度诊断] ${r.chapterTitle || '(未标注章)'}：`
    + `锚数=${r.anchorCount} 短锚(≤${SHORT_ANCHOR_MAX_LEN}字)=${r.shortAnchorCount}(${((r.shortRatio || 0) * 100).toFixed(0)}%) `
    + `${minUnitStr} `
    + `specificConcepts 条数[最小/中位/最大]=${r.specificConcepts?.min}/${r.specificConcepts?.median}/${r.specificConcepts?.max} `
    + `空specific=${r.specificConcepts?.zeroCount} `
    + `第3层重复=${r.specificConcepts?.dupCount || 0}(${((r.specificConcepts?.dupRatio || 0) * 100).toFixed(0)}%) `
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
  const specDupCount = list.reduce((a, r) => a + (r.specificConcepts?.dupCount || 0), 0);
  return {
    chapterCount: list.length,
    anchorCount,
    shortAnchorCount,
    minUnitAnchorCount,
    specTotal,
    specDupCount,
    specDupRatio: specTotal ? +(specDupCount / specTotal).toFixed(3) : 0,
    shortRatio: anchorCount ? +(shortAnchorCount / anchorCount).toFixed(3) : 0,
    avgAnchorsPerChapter: list.length ? +(anchorCount / list.length).toFixed(1) : 0,
  };
};
