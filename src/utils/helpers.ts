// 时间格式化
export const formatTime = (timestamp: number | string | Date | null | undefined): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 文本截断
export const truncate = (str: string | null | undefined, len: number): string => {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
};

// 生成唯一 ID
export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
};

// 深拷贝
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj)) as T;
};

// 防抖
export const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};
