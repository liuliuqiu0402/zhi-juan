// src/utils/pathHelper.js
// 统一的存储路径管理工具

/**
 * 获取默认存储路径
 * @returns {string} 默认存储路径
 */
export const getDefaultStoragePath = () => {
  // 优先使用 Electron 注入的同步默认路径（preload 中计算好）
  if (window.electronAPI?.defaultStoragePath) {
    return window.electronAPI.defaultStoragePath;
  }
  
  // 降级：Web 模式返回相对路径
  return '智卷工坊数据';
};

/**
 * 获取存储路径（带降级逻辑）
 * @returns {string} 存储路径
 */
export const getStoragePath = () => {
  // 1. 尝试从 localStorage 读取用户配置
  const savedPath = localStorage.getItem('storagePath');
  if (savedPath && savedPath.trim().length > 0) {
    return savedPath;
  }
  
  // 2. 使用默认路径
  const defaultPath = getDefaultStoragePath();
  return defaultPath;
};

/**
 * 设置存储路径
 * @param {string} path - 新的存储路径
 */
export const setStoragePath = (path) => {
  if (!path || path.trim().length === 0) {
    console.warn('存储路径不能为空');
    return false;
  }
  
  localStorage.setItem('storagePath', path);
  return true;
};

/**
 * 确保存储路径存在（提示用户）
 * @returns {boolean} 路径是否有效
 */
export const validateStoragePath = () => {
  const path = getStoragePath();
  
  if (!path || path.trim().length === 0) {
    console.warn('存储路径未配置');
    return false;
  }
  
  // 检查是否是相对路径或绝对路径
  const isAbsolutePath = /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]/.test(path);
  
  if (!isAbsolutePath) {
    console.warn(`存储路径 "${path}" 是相对路径，可能无法正常工作`);
    console.warn('建议在设置中配置完整的绝对路径，如: D:/智卷工坊数据');
  }
  
  return true;
};

/**
 * 修复旧数据中存储的相对路径（补全为基于当前存储路径的绝对路径）
 * 旧版 fallback 返回 "智卷工坊数据" 这个裸相对路径，导致教材/模板的 pdfPath 存成了相对路径
 * 当用户移动文件夹后，这些相对路径就找不到文件了
 * @param {string} storedPath - 数据库中存储的路径
 * @returns {string} 补全后的绝对路径
 */
export const resolveStoredPath = (storedPath) => {
  if (!storedPath) return '';
  // 已是绝对路径（含盘符）→ 直接返回
  if (/^[A-Za-z]:[\\/]/.test(storedPath)) return storedPath;
  // 相对路径 → 去掉旧的 "智卷工坊数据/" 前缀，拼上当前存储路径
  const base = getStoragePath();
  const clean = storedPath.replace(/^智卷工坊数据[/\\]/, '');
  return base + '/' + clean;
};
