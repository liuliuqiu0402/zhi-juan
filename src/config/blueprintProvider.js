/**
 * 蓝图查询（精简版）—— 替代已删除的分步配方注册表（recipeRegistry）
 * ============================================================
 * 🔴 定位：整卷生成只需"卷面结构数据"（大题/分值/时长），
 *    直接从真题蓝本库（examPaperBlueprints）查询，无配方/规范块/注册表依赖。
 * 用户自定义蓝图：在「蓝图库」面板编辑保存后持久化（localStorage），
 *    精确 key 命中时优先返回用户版（覆盖内置），删除后回退内置。
 * ============================================================
 */
import { getExamBlueprint, EXAM_BLUEPRINTS } from './examPaperBlueprints.js';

/** localStorage 键：用户自定义蓝图库 */
const BP_STORAGE_KEY = 'wisdom_blueprint_library_v1';

/** 读取用户自定义蓝图库 */
function loadUserBlueprints() {
  try {
    return JSON.parse(localStorage.getItem(BP_STORAGE_KEY) || '{}');
  } catch { return {}; }
}

/** 保存单个用户蓝图（覆盖该 key 的内置蓝本） */
export function saveUserBlueprint(key, bp = {}) {
  if (!key || !bp) return false;
  const lib = loadUserBlueprints();
  lib[key] = {
    label: bp.label || key,
    fullScore: Number(bp.fullScore) || 100,
    duration: bp.duration || '60分钟',
    sections: Array.isArray(bp.sections) ? bp.sections : [],
    updatedAt: Date.now(),
  };
  try { localStorage.setItem(BP_STORAGE_KEY, JSON.stringify(lib)); } catch { return false; }
  return true;
}

/** 删除用户蓝图（回退内置） */
export function deleteUserBlueprint(key) {
  const lib = loadUserBlueprints();
  if (lib[key]) { delete lib[key]; try { localStorage.setItem(BP_STORAGE_KEY, JSON.stringify(lib)); } catch {} return true; }
  return false;
}

/**
 * 列出全部蓝本（用户版优先合并，供蓝图库面板展示）
 * @returns {Array<{key, label, fullScore, duration, sections, source:'user'|'builtin'}>}
 */
export function listAllBlueprints() {
  const userLib = loadUserBlueprints();
  const out = [];
  // 内置（38 个）
  for (const [key, bp] of Object.entries(EXAM_BLUEPRINTS)) {
    const user = userLib[key];
    if (user) {
      out.push({ key, ...user, source: 'user' });
    } else {
      out.push({ key, ...bp, source: 'builtin' });
    }
  }
  // 用户新建（内置没有的 key）
  for (const [key, bp] of Object.entries(userLib)) {
    if (!EXAM_BLUEPRINTS[key]) out.push({ key, ...bp, source: 'user' });
  }
  return out;
}

/**
 * 查询真题卷蓝本（仅 exam 有固定卷面结构；教辅无）
 * 用户自定义优先：精确 key（subject|stage）命中用户版 → 直接返回；否则走内置（含省市覆盖/降级链）。
 * @param {Object} opts { genType, subject, stage(primary_low 等), region }
 * @returns {Object|null} { fullScore, duration, sections:[{name,score,note}], source }
 */
export function findBlueprint({ genType = '', subject = '', stage = '', region = '' } = {}) {
  if (genType !== 'exam') return null;
  try {
    // 1) 用户自定义精确命中（subject|stage 原始键，不经过内置别名/降级）
    const userLib = loadUserBlueprints();
    const userKey = `${subject}|${stage}`;
    if (userLib[userKey]?.sections?.length) {
      return { ...userLib[userKey], key: userKey, source: 'user' };
    }
    // 2) 内置蓝本（学科别名 → 学段别名 → 降级链 → 省市覆盖）
    const bp = getExamBlueprint(subject, stage, region);
    if (!bp) return null;
    return { ...bp, source: 'builtin' };
  } catch {
    return null;
  }
}

/**
 * 省市预览：内置蓝本按 region 覆盖显示（用户自定义蓝本不受地区覆盖，与 findBlueprint 一致）
 * 仅作用于显示层（蓝图库面板"省市预览"），不改变存储的基础蓝本。
 * @param {Object} bp 蓝本（listAllBlueprints 条目）
 * @param {string} region 省市（如 '江苏·南通'；空=不预览）
 * @returns {Object} 覆盖后的蓝本（fullScore/duration/sections 已按省市覆盖；preview=true 标记）
 */
export function previewWithRegion(bp, region) {
  if (!bp || !region || bp.source === 'user') return bp;
  const [subject, stage] = String(bp.key || '').split('|');
  if (!subject || !stage) return bp;
  try {
    const covered = getExamBlueprint(subject, stage, region);
    if (!covered) return bp;
    return { ...bp, fullScore: covered.fullScore, duration: covered.duration, sections: covered.sections, preview: true };
  } catch {
    return bp;
  }
}

export default { findBlueprint, saveUserBlueprint, deleteUserBlueprint, listAllBlueprints, previewWithRegion };
