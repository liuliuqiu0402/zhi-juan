/**
 * 校准操作审计流水（动作日志）
 * ============================================================
 * 记录"谁（设备）/何时/做了什么"——采纳、切换（校准↔播种）、清理的每一条动作。
 * 仅追加、按时间戳倒序查询；带单桶上限淘汰、可按类型清空。
 *
 * 与业务数据的边界：**流水只是日志**，删除/清空仅影响审计记录，
 * 决不触碰校准值(SAMPLE_KEY/CALIB_KEY)与样本。语义上与"清理校准"严格区分。
 *
 * 单条记录字段：
 *   - t        时间戳
 *   - action   adopt(一键采纳) | toggle(切换启用) | clear(清理校准) | clearLogs(清空流水)
 *   - operator 操作者标识（无账号时用设备名 getDeviceName()）
 *   - bucket   { genType, subject, stage, mode }  受影响的维度桶
 *   - detail   人类可读描述（含前后状态）
 * ============================================================
 */

import { safeRead, safeWrite } from './safeStorage.js'; // localStorage JSON 安全读写唯一实现（曾与 budgetCalibration 各复制一份同构函数）

const AUDIT_KEY = 'budgetCalibrationAudit';
const MAX_PER_BUCKET = 200; // 每桶最多保留条数，防无限增长

/** 追加一条动作流水。@returns 追加后的全部流水（倒序） */
export const recordAudit = (entry = {}) => {
  const item = {
    t: Date.now(),
    action: entry.action || 'unknown',
    operator: entry.operator || '本地',
    bucket: {
      genType: entry.genType || '',
      subject: entry.subject || '',
      stage: entry.stage || '',
      mode: entry.mode || '',
    },
    detail: entry.detail || '',
  };
  const logs = safeRead(AUDIT_KEY, []);
  logs.push(item);
  // 单桶淘汰最旧
  const sorted = [...logs].sort((a, b) => a.t - b.t);
  const trimmed = sorted.length > MAX_PER_BUCKET ? sorted.slice(-MAX_PER_BUCKET) : sorted;
  safeWrite(AUDIT_KEY, trimmed);
  return getAuditLogs();
};

/** 读取全部流水（按时间戳倒序，最新在前）。@param {Object} [opts] { bucket } 可选按桶过滤 */
export const getAuditLogs = (opts = {}) => {
  const logs = safeRead(AUDIT_KEY, []);
  const sorted = [...logs].sort((a, b) => b.t - a.t);
  const b = opts?.bucket;
  if (!b) return sorted;
  return sorted.filter(l => {
    const lb = l.bucket || {};
    if (b.genType && lb.genType !== b.genType) return false;
    if (b.subject && lb.subject !== b.subject) return false;
    if (b.stage && lb.stage !== b.stage) return false;
    if (b.mode && lb.mode !== b.mode) return false;
    return true;
  });
};

/**
 * 清空某桶（或全部）动作流水。仅删审计记录，不影响校准数据。
 * @param {Object} [opts] { bucket } 传 genType 即可清空该类型全部流水；不传清空所有
 */
export const clearAuditLogs = (opts = {}) => {
  const b = opts?.bucket;
  let kept = safeRead(AUDIT_KEY, []);
  if (b?.genType) {
    kept = kept.filter(l => (l.bucket || {}).genType !== b.genType);
  } else {
    kept = [];
  }
  safeWrite(AUDIT_KEY, kept);
  return getAuditLogs();
};

/** 当前流水总条数（诊断用） */
export const getAuditCount = () => safeRead(AUDIT_KEY, []).length;