/**
 * 教材库／模板库列表「学段 → 学科」两级分组（纯函数，单一事实源）
 * ============================================================
 * 🔴 起因（2026-09-20 用户）："虽然有筛选功能，但教材全部是平铺的，可否按小学折叠、
 *    小学下方再按学科折叠？初高中的也这样" → 列表要有层次，且能折叠。
 *
 * 🔴 为什么做成纯函数：课本库（TextbookModule）与模板库（TemplateModule）两处列表结构完全相同，
 *    分组规则若各写一份必然漂移（本仓库已多次吃过"双份逐字副本各自演化"的亏，见 textbookMeta）。
 *    故分组只此一份实现，SFC 只消费结果；并且**可直接单测**，不必挂载组件。
 *
 * 🔴 两条铁律：
 *    ① **绝不丢书**：学段/学科缺失的条目必须落进「未标注学段／未标注学科」组并**照常显示**，
 *       而不是被过滤掉——初中教材名本来就不带学段（见 textbookMeta"不猜年级"），旧数据也可能没学科，
 *       若不给归宿，表现就是"书凭空消失"。
 *    ② **组内顺序 = 入参顺序**：调用方已按用户选的排序（名称/学科/年级/时间）排好，
 *       分组只负责归类、绝不重排，避免"我选的排序没生效"。
 * ============================================================
 */

/** 未标注学段／学科的兜底组名（永远显示，不折叠） */
export const UNSPECIFIED_STAGE = '未标注学段';
export const UNSPECIFIED_SUBJECT = '未标注学科';

/** 默认学段展示顺序（其余学段排在它们之后、按中文排序；未标注永远最后） */
export const DEFAULT_STAGE_ORDER = ['小学', '初中', '高中'];

/** 旧数据里 stage 存的是英文键（见 TextbookModule 入库处的 stageMap 注释），此处归一到中文 */
const LEGACY_STAGE_MAP = {
  primary: '小学',
  primary_low: '小学',
  primary_mid: '小学',
  primary_high: '小学',
  middle: '初中',
  high: '高中',
};

/** 学段 → 显示名（兼容旧英文键与五档键；空值/未识别 → 「未标注学段」） */
export const stageLabelOf = (stage = '') => {
  const s = String(stage || '').trim();
  if (!s) return UNSPECIFIED_STAGE;
  return LEGACY_STAGE_MAP[s] || s;
};

/** 学科 → 显示名（空值 → 「未标注学科」） */
export const subjectLabelOf = (subject = '') => {
  const s = String(subject || '').trim();
  return s || UNSPECIFIED_SUBJECT;
};

/** 组键：学段用自身，学科用「学段|学科」，两者共用一张折叠状态表且互不冲突 */
export const stageGroupKey = (stageLabel) => String(stageLabel);
export const subjectGroupKey = (stageLabel, subjectLabel) => `${stageLabel}|${subjectLabel}`;

const zhCompare = (a, b) => String(a).localeCompare(String(b), 'zh-CN');

/** 排序：先按给定顺序表，未列出的按中文序，未标注永远垫底 */
const orderLabels = (labels, order) => {
  const rank = (l) => {
    if (l === UNSPECIFIED_STAGE || l === UNSPECIFIED_SUBJECT) return Number.MAX_SAFE_INTEGER;
    const i = order.indexOf(l);
    return i >= 0 ? i : order.length;
  };
  return [...labels].sort((a, b) => (rank(a) - rank(b)) || zhCompare(a, b));
};

/**
 * 按「学段 → 学科」两级分组。
 * @param {Array<Object>} items 已按用户选择排序好的条目（形如 { stage, subject, ... }）
 * @param {{ stageOrder?: string[] }} [opts]
 * @returns {Array<{ key: string, label: string, count: number,
 *   subjects: Array<{ key: string, label: string, count: number, items: Object[] }> }>}
 */
export const groupLibrary = (items = [], { stageOrder = DEFAULT_STAGE_ORDER } = {}) => {
  const byStage = new Map();
  for (const item of (items || [])) {
    if (!item) continue;
    const sLabel = stageLabelOf(item.stage);
    if (!byStage.has(sLabel)) byStage.set(sLabel, new Map());
    const sSub = byStage.get(sLabel);
    const subLabel = subjectLabelOf(item.subject);
    if (!sSub.has(subLabel)) sSub.set(subLabel, []);
    sSub.get(subLabel).push(item); // 🔴 只 push，不排序：组内顺序 = 入参顺序
  }

  return orderLabels([...byStage.keys()], stageOrder).map((stageLabel) => {
    const subMap = byStage.get(stageLabel);
    const subjects = orderLabels([...subMap.keys()], []).map((subLabel) => {
      const subItems = subMap.get(subLabel);
      return {
        key: subjectGroupKey(stageLabel, subLabel),
        label: subLabel,
        count: subItems.length,
        items: subItems,
      };
    });
    return {
      key: stageGroupKey(stageLabel),
      label: stageLabel,
      count: subjects.reduce((n, s) => n + s.count, 0),
      subjects,
    };
  });
};

/**
 * 某一级是否需要显示组头。
 * ============================================================
 * 🔴 只看"该维度是否被**显式筛选**"，**绝不看数据分成了几组**（2026-09-20 用户实测后定版）。
 *    第一版按"只有一组就隐藏该级"实现，结果结构随数据变形，用户实测到的就是：
 *      · 教材库 "小学下面有学科，初高中下面没有学科"——那几个学段下面恰好各只有 1 个学科；
 *      · 模板库 "直接是学科、没有先按学段"——那些模板恰好全落在同一个学段。
 *    于是人分不清"这一级本来没有"还是"这一级被藏起来了"。
 *    改为：用户筛了哪一维，才隐藏哪一维的组头（筛选是**显式**的，界面上那个下拉就写着当前值）；
 *    没筛就一律显示 → 「学段 → 学科」层级稳定、可预期。
 * ============================================================
 * @param {string} dimensionFilter 该维度当前的筛选值（'' = 未筛选 → 显示组头）
 */
export const needGroupHeader = (dimensionFilter = '') => !String(dimensionFilter || '').trim();

export default { groupLibrary, stageLabelOf, subjectLabelOf, needGroupHeader };
