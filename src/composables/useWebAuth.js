/**
 * 🔐 Web 端访问码鉴权
 * 桌面端（Electron）使用现有激活系统，Web 端使用简易访问码
 * 访问码通过环境变量 VITE_WEB_ACCESS_CODE 设置，部署时注入
 */
import { computed } from 'vue';

const STORAGE_KEY = '_web_access_granted';
const STORAGE_CODE_KEY = '_web_access_code';

/** 是否为 Electron 桌面环境 */
function isElectron() {
  return !!(typeof window !== 'undefined' && window.electronAPI);
}

/** 从环境变量获取预设访问码 */
function getPresetCode() {
  try {
    return import.meta.env?.VITE_WEB_ACCESS_CODE || '';
  } catch {
    return '';
  }
}

/** 存储的访问码 */
function getStoredCode() {
  try {
    return localStorage.getItem(STORAGE_CODE_KEY) || '';
  } catch {
    return '';
  }
}

/** 是否已通过鉴权 */
function isGranted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** 标记为已授权 */
function setGranted(code) {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
    if (code) localStorage.setItem(STORAGE_CODE_KEY, code);
  } catch { /* ignore */ }
}

/** 清除授权 */
export function clearWebAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_CODE_KEY);
  } catch { /* ignore */ }
}

/** Web 端鉴权 composable */
export function useWebAuth() {
  const needsAuth = computed(() => {
    // 桌面端跳过
    if (isElectron()) return false;
    // 已授权跳过
    if (isGranted()) return false;
    return true;
  });

  const presetCode = getPresetCode();

  /** 验证访问码 */
  const verify = (code) => {
    const validCode = presetCode || getStoredCode();
    // 如果未设置任何访问码，则允许直接进入
    if (!validCode) {
      setGranted('');
      return true;
    }
    if (code === validCode) {
      setGranted(code);
      return true;
    }
    return false;
  };

  /** 设置新访问码（用于首次设置） */
  const setCode = (code) => {
    setGranted(code);
  };

  return {
    needsAuth,
    verify,
    setCode,
    hasPresetCode: !!presetCode,
  };
}
