/**
 * localStorage JSON 安全读写（共享）
 * ============================================================
 * 🔴 曾分别内联于 utils/auditLog.js 与 utils/budgetCalibration.js（姊妹文件整段逐字复制），
 *    现收敛为本文件唯一实现：读失败/写失败一律静默（存储满/隐私模式不炸流程）。
 * ============================================================
 */

/** 安全读取 JSON（键缺失/解析失败 → fallback） */
export const safeRead = (key, fallback) => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) return fallback;
    const obj = JSON.parse(raw);
    return obj ?? fallback;
  } catch { return fallback; }
};

/** 安全写入 JSON（失败静默） */
export const safeWrite = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 存储满/隐私模式静默 */ }
};

export default { safeRead, safeWrite };
