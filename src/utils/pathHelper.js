// src/utils/pathHelper.js
// 统一的存储路径管理工具

/**
 * 获取默认存储路径
 * @returns {string} 默认存储路径
 */
export const getDefaultStoragePath = () => {
  // 优先使用 Electron API（如果有）
  if (window.electronAPI?.getDefaultStoragePath) {
    return window.electronAPI.getDefaultStoragePath();
  }
  
  // 降级：使用用户文档目录
  try {
    // 在浏览器环境中，我们无法直接访问文件系统
    // 返回一个合理的默认值
    return '智卷工坊数据';
  } catch (e) {
    console.warn('无法获取默认存储路径:', e.message);
    return '智卷工坊数据';
  }
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
