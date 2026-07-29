/**
 * 全局请求管理器
 * 
 * 用于管理所有模块中的 AI 生成请求，支持：
 * - 注册/注销 abortController
 * - 批量取消所有进行中的请求
 * - 引擎切换时自动清理
 */

// 存储所有活跃的 abortController
const activeControllers = new Set();

/**
 * 注册一个 abortController
 * @param {AbortController} controller - 要注册的控制器
 */
export function registerController(controller) {
  if (controller && controller instanceof AbortController) {
    activeControllers.add(controller);
    console.log(`📝 注册请求控制器，当前活跃数: ${activeControllers.size}`);
  }
}

/**
 * 注销一个 abortController
 * @param {AbortController} controller - 要注销的控制器
 */
export function unregisterController(controller) {
  if (controller) {
    activeControllers.delete(controller);
    console.log(`🗑️ 注销请求控制器，当前活跃数: ${activeControllers.size}`);
  }
}

/**
 * 取消所有进行中的请求
 * 
 * 在以下场景调用：
 * - 引擎切换时
 * - 用户手动停止所有任务
 * - 应用关闭前
 */
export async function cancelAllRequests() {
  if (activeControllers.size === 0) {
    console.log('✅ 没有进行中的请求');
    return;
  }

  console.log(`🛑 正在取消 ${activeControllers.size} 个进行中的请求...`);

  // 创建副本，避免遍历时修改集合
  const controllers = Array.from(activeControllers);

  for (const controller of controllers) {
    try {
      if (!controller.signal.aborted) {
        controller.abort();
        console.log('🛑 已取消一个请求');
      }
    } catch (e) {
      console.warn('⚠️ 取消请求失败:', e.message);
    }
  }

  // 清空集合
  activeControllers.clear();
  console.log('✅ 所有请求已取消');
}

/**
 * 获取当前活跃请求数量
 * @returns {number} 活跃请求数
 */
export function getActiveRequestCount() {
  return activeControllers.size;
}
