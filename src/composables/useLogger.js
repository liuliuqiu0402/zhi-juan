/**
 * 全局操作日志模块
 * - 劫持 console.log/warn/error 存入环形缓冲（最多 500 条）
 * - 提供日志查看、清空、导出功能
 * - 手机端 App 无 DevTools 时的关键诊断工具
 */
import { reactive, ref } from 'vue';

const MAX_LOGS = 500;
const logs = reactive([]);
const isCapturing = ref(true);

// 时间戳格式化
const ts = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

// 劫持原生 console 方法
const _orig = {};
['log', 'warn', 'error', 'info', 'debug'].forEach((method) => {
  _orig[method] = console[method];
  console[method] = (...args) => {
    // 先调原始方法，确保浏览器 DevTools 也能看到
    if (_orig[method]) _orig[method](...args);

    if (!isCapturing.value) return;

    // 序列化参数
    const parts = args.map((a) => {
      if (a instanceof Error) return a.message + (a.stack ? '\n' + a.stack : '');
      if (typeof a === 'object') {
        try { return JSON.stringify(a, null, 0); } catch { return String(a); }
      }
      return String(a);
    });

    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      time: ts(),
      level: method === 'warn' ? 'warn' : method === 'error' ? 'error' : method === 'info' ? 'info' : 'log',
      message: parts.join(' ').slice(0, 2000), // 每条最多 2000 字符
    };

    logs.push(entry);
    // 环形缓冲：超限时从头删除
    while (logs.length > MAX_LOGS) logs.shift();
  };
});

// 恢复原始 console（清理用）
export const restoreConsole = () => {
  Object.keys(_orig).forEach((method) => {
    if (_orig[method]) console[method] = _orig[method];
  });
};

// 获取日志列表
export const getLogs = () => logs;

// 清空日志
export const clearLogs = () => {
  logs.length = 0;
};

// 暂停/恢复捕获
export const setLogCapture = (capture) => {
  isCapturing.value = capture;
};

// 导出日志为文本
export const exportLogs = () => {
  const text = logs.map((l) => `[${l.time}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
  return text;
};

// 复制日志到剪贴板
export const copyLogs = async () => {
  const text = exportLogs();
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
};

// 添加程序化日志（不经过 console 劫持）
export const addLog = (level, message) => {
  const entry = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    time: ts(),
    level,
    message: String(message).slice(0, 2000),
  };
  logs.push(entry);
  while (logs.length > MAX_LOGS) logs.shift();
};

const useLogger = () => {
  return {
    logs: getLogs(),
    clearLogs,
    exportLogs,
    copyLogs,
    setLogCapture,
    addLog,
  };
};

export default useLogger;
