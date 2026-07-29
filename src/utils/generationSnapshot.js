/**
 * 生成任务快照管理
 * 在 AI 生成的每个步骤间自动保存中间结果，支持崩溃恢复
 */
import storage from '@/utils/storage';

const SNAPSHOT_KEY = 'generation_snapshot';

/**
 * 保存生成快照
 * @param {object} snapshot - 生成状态快照
 * @param {number} snapshot.step - 当前步骤 (1-5)
 * @param {string} snapshot.taskId - 任务唯一标识
 * @param {object} snapshot.context - 生成上下文 (选中的教材、模板、指令)
 * @param {object} snapshot.intermediate - 中间结果 (已完成步骤的输出)
 */
export const saveSnapshot = async (snapshot) => {
  try {
    const existing = await storage.getItem(SNAPSHOT_KEY);
    const snapshots = existing || [];

    // 更新或添加
    const idx = snapshots.findIndex(s => s.taskId === snapshot.taskId);
    snapshot.savedAt = Date.now();
    if (idx >= 0) {
      snapshots[idx] = snapshot;
    } else {
      snapshots.push(snapshot);
    }

    // 只保留最近5个快照
    const trimmed = snapshots.slice(-5);
    await storage.setItem(SNAPSHOT_KEY, trimmed);
    console.log(`📸 [快照] 步骤 ${snapshot.step} 已保存 (taskId: ${snapshot.taskId})`);
  } catch (e) {
    console.warn('⚠️ 保存生成快照失败:', e.message);
  }
};

/**
 * 获取未完成的生成快照
 * @returns {object|null} 最近的未完成快照，或 null
 */
export const getPendingSnapshot = async () => {
  try {
    const snapshots = await storage.getItem(SNAPSHOT_KEY);
    if (!snapshots || !Array.isArray(snapshots) || snapshots.length === 0) return null;

    // 找最新的未完成任务 (step < 5 表示未完成)
    const pending = snapshots
      .filter(s => s.step !== undefined && s.step < 5)
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

    return pending[0] || null;
  } catch (e) {
    console.warn('⚠️ 读取生成快照失败:', e.message);
    return null;
  }
};

/**
 * 清除任务快照
 * @param {string} taskId - 任务标识
 */
export const clearSnapshot = async (taskId) => {
  try {
    const snapshots = await storage.getItem(SNAPSHOT_KEY);
    if (!snapshots || !Array.isArray(snapshots)) return;

    const filtered = snapshots.filter(s => s.taskId !== taskId);
    await storage.setItem(SNAPSHOT_KEY, filtered);
    console.log(`🗑️ [快照] 已清除 taskId: ${taskId}`);
  } catch (e) {
    console.warn('⚠️ 清除生成快照失败:', e.message);
  }
};

/**
 * 清除所有生成快照
 */
export const clearAllSnapshots = async () => {
  try {
    await storage.removeItem(SNAPSHOT_KEY);
    console.log('🗑️ [快照] 已清除所有生成快照');
  } catch (e) {
    console.warn('⚠️ 清除所有快照失败:', e.message);
  }
};

/**
 * 检查是否有暂停的生成任务
 * @returns {Promise<boolean>}
 */
export const hasPendingGeneration = async () => {
  const snapshot = await getPendingSnapshot();
  return snapshot !== null;
};
