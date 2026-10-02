/**
 * 教材库／模板库「元数据补标」规则（纯函数，单一事实源）
 * ============================================================
 * 起因（2026-09-20 用户）："要不然老数据就不能按规则归类了"。
 *    列表已按「学段 → 学科」两级分组，但**学段/学科只在导入时能选**（初中本来就不自动识别学段，
 *    只有小学年级与高中册次认得出），老数据缺这两项就落进"未标注"组、再也归不了位，
 *    而且原先没有任何入口能补（册次有「📚」，学段/学科没有）。
 *
 * 本模块只管"改哪几个字段、字段之间怎么互斥/联动"，**不碰 name / id / 路径**——
 *    改名与路径自愈是另一套（见 libraryPathRepair / libraryRelink），两者互不干扰。
 *    抽成纯函数是为了能直接单测（联动规则写错会导致"小学 + 必修1"这类矛盾状态被存下来）。
 * ============================================================
 */

import { STAGE_SUBJECTS } from '../config/promptLibrary.js';
import { subjects, normalizeSubjectName } from '../config/expertKnowledge.js';
import { resolveStageKey } from './gradeStage.js';

/** 可选学段（与 expertKnowledge.stages 同口径三档）；'' 表示未标注 */
export const STAGE_CHOICES = ['小学', '初中', '高中'];

/** 中文学段标签 → 五档学段键（小学三档实际开设学科一致，取并集口径） */
export const STAGE_LABEL_TO_KEYS = {
  小学: ['primary_low', 'primary_mid', 'primary_high'],
  初中: ['middle'],
  高中: ['high'],
};

/**
 * 2026-09-28（用户裁定：按**该学段实际开设的学科**来，非全学科 × 全学段）：
 *   学科候选 = 该学段实际开设学科（单一事实源 STAGE_SUBJECTS，不另写一份 15 科清单）；
 *   学段未标注 → 返回全量（无从判断，不强行限制）。
 * 为什么要有：编辑器学科下拉原为全量 15 科，可存出"小学+物理"这类现实不存在的组合 →
 *   生成侧查不到蓝本只好跨学段借格（静默）。入口按开设矩阵约束，从源头消灭该类组合。
 * @param {string} stageLabel 中文学段（'小学'/'初中'/'高中'）或空
 * @returns {string[]} 该学段可选学科（顺序随 expertKnowledge.subjects，保持稳定）
 */
export const subjectChoicesForStage = (stageLabel = '') => {
  const keys = STAGE_LABEL_TO_KEYS[String(stageLabel || '').trim()];
  if (!keys) return subjects;
  const allowed = new Set(keys.flatMap((k) => STAGE_SUBJECTS[k] || []));
  return subjects.filter((s) => allowed.has(s));
};

/**
 * 2026-09-28（用户裁定·C 硬拦 + 用户提醒"别把信息全的误拦"）：
 *   生成前的**三维度完整性**判据（纯函数·单一事实源）。**只判真空**，不因字面写法不同而拦：
 *   · 学段：显式字段与**教材名线索**都解析不出（resolveStageKey 返回空）才算缺——解析链本身宽松
 *     （中文/阿拉伯/圈码年级、"小学低/中/高段"、"初一~初三"、"高一~高三"、教材名"六年级/第X册/六上"
 *      均可解析；且"小学"无年级时末位宽松兜底到高段、不落低段）；
 *   · 学科：字段为空（归名后仍为空）才算缺。
 * @param {{stage?:string, subject?:string, grade?:string, name?:string}} meta 教材元数据
 * @returns {{ok:boolean, missing:string[], stageKey:string, subject:string}}
 */
export const checkMetaCompleteness = ({ stage = '', subject = '', grade = '', name = '' } = {}) => {
  const stageKey = resolveStageKey(stage, grade, name);
  const stdSubject = subject ? (normalizeSubjectName(subject, stageKey) || subject) : '';
  const missing = [];
  if (!stageKey) missing.push('stage');
  if (!stdSubject) missing.push('subject');
  return { ok: missing.length === 0, missing, stageKey, subject: stdSubject };
};

/** 缺项提示文案（单一事实源，界面与生成入口共用）：把"缺什么 + 去哪儿补"说清，不做泛泛拦截 */
export const metaMissingMessage = (missing = []) => {
  const label = (Array.isArray(missing) ? missing : [])
    .map((m) => (m === 'stage' ? '学段' : '学科')).join('、');
  return `该教材缺少【${label}】，无法匹配到对应的三维度指令（学段×学科×资料类型）。`
    + `请到「教材库」用卡片上的 🏷️「编辑元数据」补标后再生成。`;
};

/**
 * 原地应用元数据修改（store 里的条目就是普通对象，直接改字段后由 store 落盘）。
 * 规则（三条，均被单测锁定）：
 *   ① **册次只对高中有意义** → 学段不是高中时一律清空册次（否则会存下"小学 + 必修1"这类矛盾组合，
 *      而册次会被生成链路当作教材标识用）；
 *   ② **填了册次就清掉遗留年级** → 与导入落库、存量回填同一口径（高中不按年级）；
 *   ③ **没拿到册次时不碰遗留年级** → 不把标识抹成空白（老数据里的"高二"至少还能显示，见 gradeDisplayLabel）。
 * @param {Object} item 教材/模板条目（原地修改）
 * @param {{ stage?: string, subject?: string, volume?: string }} patch 未给的字段沿用条目现值
 * @returns {{ changed: boolean, applied: { stage: string, subject: string, volume: string } }}
 */
export const applyLibraryMetaEdit = (item, patch = {}) => {
  const empty = { changed: false, applied: { stage: '', subject: '', volume: '' } };
  if (!item || typeof item !== 'object') return empty;

  const snap = (o) => `${o.stage || ''}|${o.subject || ''}|${o.volume || ''}|${o.grade || ''}`;
  const before = snap(item);

  const stage = String(patch.stage ?? item.stage ?? '').trim();
  const subject = String(patch.subject ?? item.subject ?? '').trim();
  let volume = String(patch.volume ?? item.volume ?? '').trim();
  if (stage !== '高中') volume = ''; // 规则①

  item.stage = stage;
  item.subject = subject;
  item.volume = volume;
  if (volume && item.grade) item.grade = ''; // 规则②（规则③即"没有 else 分支"）

  return { changed: before !== snap(item), applied: { stage, subject, volume } };
};

/** 该条目是否缺学段或学科（列表上据此把「🏷️」标成待补状态，提示这里有活要干） */
export const needsMetaBackfill = (item = {}) => (
  !String(item?.stage || '').trim() || !String(item?.subject || '').trim()
);

export default { STAGE_CHOICES, applyLibraryMetaEdit, needsMetaBackfill };
