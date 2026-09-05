/**
 * 📐 覆盖契约（COVERAGE_CONTRACT）——"资料类型 × 教材层级覆盖要求"唯一事实源
 * ============================================================
 * 🔴 定位（2026-09 覆盖治理 P1）：P2 对账器 / 自动补漏 / 定向重试的判定基准；
 *    覆盖锚（coverageAnchor，P0）回答"哪些考点可命题"，本契约回答"命题结果须覆盖到什么程度"。
 *
 * 五档模式语义（只描述要求，不含诱导；判定全部由程序确定性完成）：
 *   full            对勾选层级全覆盖：每考点至少呈现一次；呈现形态不限——例题/算理内嵌/归纳条目/
 *                   "你知道吗"科普框等非例题形态同样计入覆盖（覆盖锚绑定已含非例题形态，此处口径一致）
 *   per-lesson-full 以课为单元全覆盖：单次生成多课时 = 各课并集达标；复生成单课时按单课达标
 *   focus           聚焦覆盖：只覆盖资料主题对应的层级考点（专项/阅读按主题选点，不要求全层级出现）
 *   none            不按层级覆盖：围绕用户素材组织，不与教材层级做覆盖对账
 *   sampled         抽样覆盖：按命题蓝图抽样（双向细目表语义），允许部分层级未出现，不补漏
 *
 * 9 类型映射（与 GEN_TYPE_NAMES 键严格一致，测试守卫）：
 *   知识型（summary/preview/dictation/review）= full：梳理型内容，勾选即覆盖全层级
 *   practice = per-lesson-full：随堂练习须完整覆盖当课全部考点
 *   special/reading = focus：专项/阅读按主题选点聚焦
 *   errorbook = none：错题围绕用户错题，不与层级对账
 *   exam = sampled：正式考卷抽样命题，允许未覆盖，不补漏
 * ============================================================
 */
import { GEN_TYPE_NAMES } from './promptLibrary.js';

/** 五档覆盖模式（合法值集合，测试守卫用） */
export const COVERAGE_MODES = ['full', 'per-lesson-full', 'focus', 'none', 'sampled'];

/** 五档模式语义说明（对账报告/补漏决策引用，单一描述点，不重复散布） */
export const COVERAGE_MODE_DESC = {
  full: '对勾选层级全覆盖：每考点至少呈现一次，呈现形态不限（例题/算理内嵌/归纳条目/科普框均计入覆盖）',
  'per-lesson-full': '以课为单元全覆盖：单次生成多课=各课并集达标；复生成单课按单课达标；每考点至少呈现一次',
  focus: '聚焦覆盖：只覆盖资料主题对应的层级考点，不要求全层级出现',
  none: '不按层级覆盖：围绕用户素材组织，不与教材层级做覆盖对账',
  sampled: '抽样覆盖：按命题蓝图抽样（双向细目表语义），允许部分层级未出现，不补漏',
};

/** 资料类型 → 覆盖契约（key 与 GEN_TYPE_NAMES 一致；新增类型须在此登记否则按 none 兜底） */
export const COVERAGE_CONTRACT = {
  summary: { name: GEN_TYPE_NAMES.summary, mode: 'full' },
  preview: { name: GEN_TYPE_NAMES.preview, mode: 'full' },
  dictation: { name: GEN_TYPE_NAMES.dictation, mode: 'full' },
  review: { name: GEN_TYPE_NAMES.review, mode: 'full' },
  practice: { name: GEN_TYPE_NAMES.practice, mode: 'per-lesson-full' },
  special: { name: GEN_TYPE_NAMES.special, mode: 'focus' },
  reading: { name: GEN_TYPE_NAMES.reading, mode: 'focus' },
  errorbook: { name: GEN_TYPE_NAMES.errorbook, mode: 'none' },
  exam: { name: GEN_TYPE_NAMES.exam, mode: 'sampled' },
};

/** 契约读取（未知类型安全兜底：不参与层级对账） */
export const contractOf = (genType) =>
  COVERAGE_CONTRACT[genType] || { name: GEN_TYPE_NAMES[genType] || genType || '', mode: 'none' };
