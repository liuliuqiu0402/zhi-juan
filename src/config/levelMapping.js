/**
 * 卷别 → 学业质量水平 映射（高中）· 单一事实源
 * ============================================================
 * 定位：全项目"高中该对标哪一级学业质量水平"只认本模块一处，禁止在指令库 / 教辅蓝本 /
 *    生成端各自再写一份水平口径（同义表述只留一处，防多源打架）。
 *
 * 取值依据（可查可引用）：《普通高中课程标准（2017年版2020年修订）》各科"五、学业质量·学业质量水平"。
 *    2026-09-28（用户裁定·按各科课标核正·按学科分型）："高考→水平四"**不是全科统一**——
 *       各科水平档数与"哪一级对应高考/等级性考试"都不一样，故"选拔对标水平"必须**按学科**分型：
 *      · 数学、英语为**三级水平制**：水平一＝高中毕业应当达到的要求（合格考命题依据）；
 *        水平二＝高考的要求（数学/英语高考命题依据）；水平三＝提高类课程/自主招生参考；
 *      · 思想政治：水平三＝等级性考试命题依据（水平四表现可纳入综合素质档案）；
 *      · 语文/物理/化学/生物/历史/地理/信息技术：水平四＝高校招生录取/等级性考试的命题依据；
 *      · 美术：水平三＝对应高考或用于高等院校招生的学业水平等级性考试要求。
 *    上述映射以 SUBJECT_GAOKAO_LEVEL（高考/等级性考试）与 SUBJECT_HEGE_LEVEL（合格考/毕业要求）
 *    两张**按学科**的表为唯一事实源；LEVEL_MAP 仅作**默认/兜底**（未列入学科用）。
 *    2026-09-28（补·多级支持·根治单源结构）：音乐课标为"水平二**与**水平三"两级**共同**作为高考命题
 *       主要依据，非单一水平——故 SUBJECT_GAOKAO_LEVEL 的取值**支持单值或多值（数组，或"水平二与水平三"
 *       等价字符串）**；音乐如实填两级，其余学科仍为单值（行为不变）。gaokaoLevelOf() 等出口对多值以课标
 *       口径"与"连接、统一渲染为"水平二与水平三"（不得自造新概念）。
 *    ⚠️ 未确证项（**保持现状、未自造**）：体育与健康（无等级性考试，仅合格要求水平二）——**不入**
 *       SUBJECT_GAOKAO_LEVEL（防将来被手滑补入一个高考水平），按 LEVEL_MAP 兜底。
 *
 * ⚠️ 与 config/teachingBlueprints.js 里各科 high note（学科蓝图栏目注）**分工不同、不互相替代**：
 *    那边写"某学科高中教辅的内容领域与素养 + 高考选拔对标（引用本模块单源）"；
 *    本模块写"某卷别/某科对标哪一级水平"（教辅无卷别 → 按毕业合格要求为教学基线）。
 *    2026-09-28（用户裁定·水平口径语义分离）：各科 high note 里出现的"选拔对标级"一律以
 *    teachingBlueprints 的 LEVEL_SELECTION_CAVEAT 标注为"高考选拔对标、非教辅要求"，
 *    与本模块的教学基线**不互相否定**（水平取值仍只认本模块单源）。
 *
 * 卷别口径：
 *    · 正式卷（genType='exam'）：按卷别映射——升学卷别为高考（scopeType='gaokao'）→ 高考（按学科取水平）；
 *      其余高中正式卷（期中/期末/月考/专题/综合等）→ 合格考（合格要求，按学科取水平）。
 *    · 教辅（genType 为非 exam 的非空值，无卷别）：不作卷别映射，统一锚"毕业合格要求"为**教学基线**
 *      （按学科取水平：数学/英语＝水平一，其余＝水平二）。
 *    · 资料类型缺失（genType 为空/未传，且未显式给 paperKind）：**不注入**水平块——宁可缺、不误标；
 *      不得把"未传"默认当成教辅而锚基线（那会把未知资料误标为合格要求）。
 *
 * 作用域：**仅高中生效**。义务教育（primary_* / middle）无学业质量水平级，一律返回空串、不注入。
 * ============================================================
 */
import { resolveStageKey } from '../utils/gradeStage.js';
import { normalizeSubjectName } from './expertKnowledge.js';

/** 取值出处（原样引用课标章节名，供指令正文"可查可引用"） */
export const LEVEL_SOURCE = '《普通高中课程标准（2017年版2020年修订）》·五、学业质量·学业质量水平';

/**
 * 卷别 → 学业质量水平（**默认/兜底表**）
 * 键：'合格考' / '高考'（卷别）＋ '思想政治'（学科例外，仅作用于高考卷，保留以兼容旧引用）。
 * 未列入 SUBJECT_GAOKAO_LEVEL / SUBJECT_HEGE_LEVEL 的学科用本表兜底（现状）。
 */
export const LEVEL_MAP = {
  '合格考': '水平二',
  '高考': '水平四',
  '思想政治': '水平三',
};

/**
 * 各科"高考/等级性考试对应学业质量水平"（**选拔对标唯一事实源**·按学科分型）
 * ============================================================
 * 键为归一学科名（normalizeSubjectName 的规范名，如 信息技术→信息科技、体育与健康→体育）；
 * 未列入者回退 LEVEL_MAP['高考']（现状，见文件头"未确证项"）。
 * 取值形态：**单值或多值** —— 单值为水平字符串（如 '水平四'）；若该科课标有**两级共同**作为
 *    高考命题依据（音乐：水平二与水平三），则取值为**数组**（或等价的"水平二与水平三"字符串）。
 *    消费方一律经 formatLevels()/gaokaoLevelOf() 统一渲染为课标口径的可读文本（多值以"与"连接），
 *    不得在别处手写水平值或自造概念。
 * 依据 = 各科《普通高中课程标准（2017年版2020年修订）》·五、学业质量·学业质量水平 原文，
 *    并经省级教育行政部门实施口径交叉核证（数学/英语/思想政治/语文/历史/地理/物理/化学/生物/音乐）。
 * ============================================================
 */
export const SUBJECT_GAOKAO_LEVEL = {
  // 三级水平制：水平二 = 高考（命题依据）
  '数学': '水平二',
  '英语': '水平二',
  // 四级水平制：水平三 = 等级性考试命题依据
  '思想政治': '水平三',
  // 四级水平制：水平四 = 高校招生录取 / 等级性考试命题依据
  '语文': '水平四',
  '物理': '水平四',
  '化学': '水平四',
  '生物': '水平四',
  '历史': '水平四',
  '地理': '水平四',
  '信息科技': '水平四',
  // 三级水平制：水平三 = 对应高考或高等院校招生
  '美术': '水平三',
  // 多级取值：音乐课标为"水平二与水平三"两级**共同**作为高考命题的主要依据（非单一水平）——
  //    数组形态即"多值"，出口统一渲染为"水平二与水平三"（课标口径，不自造）。
  '音乐': ['水平二', '水平三'],
};

/**
 * 各科"合格考（毕业合格要求）"对应学业质量水平（未列入者回退 LEVEL_MAP['合格考']=水平二）。
 * 数学/英语为三级水平制：水平一=高中毕业应当达到的要求 = 合格考命题依据。
 */
export const SUBJECT_HEGE_LEVEL = {
  '数学': '水平一',
  '英语': '水平一',
};

/** 卷别键清单（"每个卷别都有映射"守卫据此遍历；学科例外键不在此列） */
export const PAPER_KINDS = ['合格考', '高考'];

/** 学科例外键（保留兼容；现行取值统一走 SUBJECT_GAOKAO_LEVEL） */
export const SUBJECT_LEVEL_KEYS = ['思想政治'];

/** 教辅（无卷别）教学基线默认值：高中毕业合格要求 = 水平二（按学科可覆盖，见 SUBJECT_HEGE_LEVEL） */
export const TEACHING_BASELINE = { kind: '合格要求', level: LEVEL_MAP['合格考'] };

/** 注入段标记（守卫测试据此断言"只注入一处"） */
export const LEVEL_INJECTION_MARKER = '【学业质量水平】';

/** 是否高中学段（五档键 / 中文粗标签 / 年级 统一走 gradeStage 单源） */
export const isHighStage = (stage = '') => resolveStageKey(stage) === 'high';

/**
 * 资料类型是否已显式提供（空串 / 未传 / 纯空白 → 视为未提供）。
 * 供"资料类型缺失即不注入水平块"守卫使用：宁可缺、不误标，杜绝把"未传"默认当教辅。
 */
export const hasGenType = (genType = '') => String(genType ?? '').trim() !== '';

/** 归一学科名（供按学科取水平；stage 缺省按高中处理） */
const subjectKey = (subject = '', stage = 'high') => normalizeSubjectName(subject, stage) || subject;

/**
 * 归一化"水平值"为水平数组（兼容**单值或多值**三种等价形态）：
 *   · 单值字符串 '水平四'          → ['水平四']
 *   · 数组         ['水平二','水平三'] → ['水平二','水平三']
 *   · 等价字符串   '水平二与水平三'   → ['水平二','水平三']（按课标连接词"与"拆分）
 * 空值 / 未传 → []。供多值渲染与"是否多级"判定复用（水平名内不含"与"，拆分安全）。
 */
export const toLevelList = (value) => {
  if (value == null) return [];
  const parts = Array.isArray(value) ? value : String(value).split('与');
  return parts.map((v) => String(v ?? '').trim()).filter((v) => v !== '');
};

/** 是否"多级"取值（≥2 个水平，如音乐"水平二与水平三"） */
export const isMultiLevel = (value) => toLevelList(value).length > 1;

/** 水平值 → 可读文本：单值原样返回（向后兼容），多值以课标口径"与"连接（如 水平二与水平三） */
export const formatLevels = (value) => toLevelList(value).join('与');

/** 某科"高考/等级性考试"对应水平（单源出口；支持单值/多值；未列入学科回退默认表） */
export const gaokaoLevelOf = (subject = '', stage = 'high') =>
  formatLevels(SUBJECT_GAOKAO_LEVEL[subjectKey(subject, stage)] ?? LEVEL_MAP['高考']);

/** 某科"合格考/毕业合格要求"对应水平（单源出口；支持单值/多值；未列入学科回退默认表） */
export const hegeLevelOf = (subject = '', stage = 'high') =>
  formatLevels(SUBJECT_HEGE_LEVEL[subjectKey(subject, stage)] ?? LEVEL_MAP['合格考']);

/**
 * 解析"卷别"。
 * @param {Object} opts
 * @param {string} [opts.genType] 资料类型（'exam' = 正式卷）
 * @param {string} [opts.scopeType] 范围/卷别类型（'gaokao' = 升学高考；其余为校内正式卷）
 * @param {string} [opts.paperKind] 显式卷别（覆盖推导；供调用方/测试直给）
 * @returns {string} '高考' | '合格考' | ''（'' = 无卷别，即教辅）
 */
export function resolvePaperKind({ genType = '', scopeType = '', paperKind = '' } = {}) {
  const explicit = String(paperKind || '').trim();
  if (explicit) return explicit;
  if (genType !== 'exam') return ''; // 教辅无卷别
  return scopeType === 'gaokao' ? '高考' : '合格考';
}

/**
 * 解析高中应注入的学业质量水平（**按学科分型**，支持**单值/多值**）。
 * @returns {string} '水平一'…'水平四'（单值学科）；多级学科（音乐）为'水平二与水平三'；
 *                   非高中 / 资料类型缺失 / 无法解析 → 空串（不注入）
 */
export function resolveAcademicLevel({ stage = '', subject = '', genType = '', scopeType = '', paperKind = '' } = {}) {
  if (!isHighStage(stage)) return ''; // 义务教育无水平级
  // 资料类型缺失（且未显式给 paperKind）→ 不注入：宁可缺、不误标（不再默认按教辅锚基线）
  const explicit = String(paperKind || '').trim();
  if (!explicit && !hasGenType(genType)) return '';
  const kind = resolvePaperKind({ genType, scopeType, paperKind });
  // 高考/等级性考试：按学科取水平（单源·支持单值/多值，如音乐两级=水平二与水平三）
  if (kind === '高考') return gaokaoLevelOf(subject, stage);
  // 合格考 / 教辅（无卷别→教学基线=毕业合格要求）：同一按学科取值（数学/英语=水平一，其余=水平二）
  return hegeLevelOf(subject, stage);
}

/**
 * 生成"学业质量水平"注入文本（**唯一出口**：指令正文只经此处注入一次）。
 * 非高中 / 资料类型缺失 / 无水平 → 返回空串（不注入）。
 * @returns {string} 形如「【学业质量水平】本卷为高中高考卷，对标学业质量水平四（…）；难度与情境不超该水平要求。」
 */
export function buildLevelInstruction({ stage = '', subject = '', genType = '', scopeType = '', paperKind = '' } = {}) {
  if (!isHighStage(stage)) return '';
  const level = resolveAcademicLevel({ stage, subject, genType, scopeType, paperKind });
  if (!level) return ''; // 资料类型缺失 / 无法解析 → 空串（不注入，宁可缺、不误标）
  const kind = resolvePaperKind({ genType, scopeType, paperKind });
  const lead = kind
    ? `本卷为高中${kind}卷，对标学业质量${level}`
    : `高中教辅（无卷别），按毕业${TEACHING_BASELINE.kind}为教学基线，对标学业质量${level}`;
  return `${LEVEL_INJECTION_MARKER}${lead}（${LEVEL_SOURCE}）；难度与情境不超该水平要求。`;
}

/**
 * 卷别提示（UI 用，单一事实源同按学科映射）：高中正式卷在「范围/卷别」处给一句选择提示——
 *   按学科取水平（如数学「选高考按水平二；未选按水平一」，物理「选高考按水平四；未选按水平二」）。
 * 与 buildLevelInstruction 取同一张映射表（不另写一份水平口径）；仅 学段=高中 且 genType=exam 时返回，其余返回空串。
 * @returns {string} 提示句；非高中 / 非正式卷 → ''
 */
export function buildPaperKindHint({ stage = '', genType = '', subject = '' } = {}) {
  if (!isHighStage(stage)) return '';
  if (genType !== 'exam') return '';
  return `选高考按${gaokaoLevelOf(subject, stage)}（选拔要求）；未选按${hegeLevelOf(subject, stage)}（合格要求）`;
}

export default {
  LEVEL_SOURCE,
  LEVEL_MAP,
  SUBJECT_GAOKAO_LEVEL,
  SUBJECT_HEGE_LEVEL,
  PAPER_KINDS,
  SUBJECT_LEVEL_KEYS,
  TEACHING_BASELINE,
  LEVEL_INJECTION_MARKER,
  isHighStage,
  hasGenType,
  toLevelList,
  isMultiLevel,
  formatLevels,
  gaokaoLevelOf,
  hegeLevelOf,
  resolvePaperKind,
  resolveAcademicLevel,
  buildLevelInstruction,
  buildPaperKindHint,
};
