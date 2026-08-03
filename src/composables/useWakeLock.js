/**
 * 🔒 屏幕唤醒锁（Screen Wake Lock）
 * 生成期间防止屏幕自动息屏导致 API 请求中断。
 * 切应用到后台时锁自动释放，回到前台自动重新请求。
 *
 * 用法：
 *   const { request, release, isActive } = useWakeLock();
 *   await request();   // 生成开始时
 *   release();         // 生成结束时
 *
 * 兼容性：需要 HTTPS 或 localhost，iOS Safari 16.4+，Chrome 84+
 */
import { ref } from 'vue';

let sentinel = null;
const isActive = ref(false);
let visibilityHandler = null;

const isSupported = () => {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
};

const request = async () => {
  if (!isSupported()) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    isActive.value = true;
    console.log('🔒 Wake Lock 已激活（防息屏）');

    // 切后台再回来时自动重新获取
    if (!visibilityHandler) {
      visibilityHandler = async () => {
        if (document.visibilityState === 'visible' && isActive.value && !sentinel) {
          try {
            sentinel = await navigator.wakeLock.request('screen');
            console.log('🔒 Wake Lock 已恢复（回到前台）');
          } catch {
            // 静默失败
          }
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }
  } catch (e) {
    console.warn('⚠️ Wake Lock 请求失败（可能浏览器不支持或非 HTTPS）:', e.message);
    // 静默失败：锁非关键功能，不影响生成逻辑
  }
};

const release = () => {
  if (sentinel) {
    sentinel.release().catch(() => {});
    sentinel = null;
  }
  isActive.value = false;
  console.log('🔓 Wake Lock 已释放');
};

// 清理 visibility 监听器（组件卸载时调用）
const cleanup = () => {
  release();
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
};

export function useWakeLock() {
  return { request, release, isActive, isSupported: isSupported(), cleanup };
}
