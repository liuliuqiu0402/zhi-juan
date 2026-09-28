/**
 * 卷别 → 学业质量水平 映射（高中）· 单一事实源
 * ============================================================
 * 🔴 定位：全项目"高中该对标哪一级学业质量水平"只认本模块一处，禁止在指令库 / 教辅蓝本 /
 *    生成端各自再写一份水平口径（同义表述只留一处，防多源打架）。
 *
 * 🔴 取值依据（可查可引用）：《普通高中课程标准（2017年版2020年修订）》各科"五、学业质量·学业质量水平"。
 *    · 合格考（学业水平合格性考试）＝ 高中毕业应达到的合格要求 → 水平二；
 *    · 高考（学业水平等级性考试 / 高校招生录取）→ 水平四（物理/化学/生物/历史/地理/信息技术等多数科目）；
 *    · 思想政治为学科例外：其"学业水平等级性考试的命题依据"是**水平三**（达到水平四可纳入综合素质档案），
 *      故思想政治高考卷 → 水平三。
 *    ⚠️ 与 config/teachingBlueprints.js 里各科 high note（学科蓝图栏目注）**分工不同、不互相替代**：
 *       那边写"某学科高中教辅的内容领域与素养"，本模块写"某卷别对标哪一级水平"；
 *       teachingBlueprints.js 按裁定**不动**，本模块是其外挂的单源。
 *
 * 🔴 卷别口径：
 *    · 正式卷（genType='exam'）：按卷别映射——升学卷别为高考（scopeType='gaokao'）→ 高考；
 *      其余高中正式卷（期中/期末/月考/专题/综合等）→ 合格考（合格要求）。
 *    · 教辅（genType 为非 exam 的非空值，无卷别）：不作卷别映射，统一锚"水平二（合格要求）"为**教学基线**。
 *    · 资料类型缺失（genType 为空/未传，且未显式给 paperKind）：**不注入**水平块——宁可缺、不误标；
 *      不得把"未传"默认当成教辅而锚水平二（那会把未知资料误标为合格要求）。
 *
 * 🔴 作用域：**仅高中生效**。义务教育（primary_* / middle）无学业质量水平级，一律返回空串、不注入。
 * ============================================================
 */
import { resolveStageKey } from '../utils/gradeStage.js';
import { normalizeSubjectName } from './expertKnowledge.js';

/** 取值出处（原样引用课标章节名，供指令正文"可查可引用"） */
export const LEVEL_SOURCE = '《普通高中课程标准（2017年版2020年修订）》·五、学业质量·学业质量水平';

/**
 * 卷别 → 学业质量水平（**唯一映射表**）
 * 键：'合格考' / '高考'（卷别）＋ '思想政治'（学科例外，仅作用于高考卷）。
 */
export const LEVEL_MAP = {
  '合格考': '水平二',
  '高考': '水平四',
  '思想政治': '水平三',
};

/** 卷别键清单（"每个卷别都有映射"守卫据此遍历；学科例外键不在此列） */
export const PAPER_KINDS = ['合格考', '高考'];

/** 学科例外键（值是"该学科高考卷对应水平"）——与卷别同为 LEVEL_MAP 的键，但语义是学科覆盖 */
export const SUBJECT_LEVEL_KEYS = ['思想政治'];

/** 教辅（无卷别）教学基线：高中毕业合格要求 = 水平二 */
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
 * 解析高中应注入的学业质量水平。
 * @returns {string} '水平二' | '水平三' | '水平四' | ''（非高中 / 资料类型缺失 / 无法解析 → 空串，不注入）
 */
export function resolveAcademicLevel({ stage = '', subject = '', genType = '', scopeType = '', paperKind = '' } = {}) {
  if (!isHighStage(stage)) return ''; // 义务教育无水平级
  // 资料类型缺失（且未显式给 paperKind）→ 不注入：宁可缺、不误标（不再默认按教辅锚水平二）
  const explicit = String(paperKind || '').trim();
  if (!explicit && !hasGenType(genType)) return '';
  const subj = normalizeSubjectName(subject, stage) || subject;
  const kind = resolvePaperKind({ genType, scopeType, paperKind });
  // 学科例外：思想政治高考卷 → 水平三（先于通用卷别判定）
  if (kind === '高考' && SUBJECT_LEVEL_KEYS.includes(subj)) return LEVEL_MAP[subj];
  if (kind && LEVEL_MAP[kind]) return LEVEL_MAP[kind];
  // 教辅（genType 为非 exam 的非空值，无卷别）→ 教学基线（合格要求）
  return TEACHING_BASELINE.level;
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

export default {
  LEVEL_SOURCE,
  LEVEL_MAP,
  PAPER_KINDS,
  SUBJECT_LEVEL_KEYS,
  TEACHING_BASELINE,
  LEVEL_INJECTION_MARKER,
  isHighStage,
  hasGenType,
  resolvePaperKind,
  resolveAcademicLevel,
  buildLevelInstruction,
};
