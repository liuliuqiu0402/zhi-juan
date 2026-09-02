// 基于 IndexedDB 的统一存储层，替代 localStorage
import { STORAGE_KEYS } from '../constants/storageKeys'; // 业务 key 唯一事实源（清理豁免 apiConfig 前缀用）

const DB_NAME = 'zhijuan_studio';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

// iOS Safari 切后台时会关闭 IndexedDB 连接，监听 close 事件及时重置缓存
const resetDb = () => { db = null; };

// 打开数据库
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // 🔧 iOS 修复：缓存的连接可能已被浏览器关闭，使用前校验有效性
    if (db) {
      try {
        db.transaction('store', 'readonly'); // 已关闭的连接会立即抛异常
        return resolve(db);
      } catch {
        db = null; // 连接已失效，重新打开
      }
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains('store')) {
        database.createObjectStore('store');
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      // 监听 close 事件（浏览器主动关闭连接时触发）
      db.addEventListener('close', resetDb);
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('IndexedDB 打开失败:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// 存储数据
const setItem = async (key: string, value: unknown): Promise<void> => {
  try {
    let plainValue: unknown;
    try {
      plainValue = structuredClone(value);
    } catch {
      plainValue = JSON.parse(JSON.stringify(value));
    }

    const rawSize = new Blob([JSON.stringify(plainValue)]).size;
    const sizeMB = Math.round(rawSize / 1024 / 1024 * 100) / 100;
    if (sizeMB > 10) {
      console.warn(`⚠️ [storage] 写入 ${key} 体积达 ${sizeMB}MB，可能影响性能。建议定期清理不需要的数据。`);
    }

    const database = await openDB();
    const tx = database.transaction('store', 'readwrite');
    const store = tx.objectStore('store');
    store.put(plainValue, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error(`IndexedDB setItem 失败 (${key}):`, e);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e2) {
      console.error('localStorage 降级也失败:', (e2 as Error).message);
      if ((e2 as DOMException).name === 'QuotaExceededError') {
        try {
          const keys = Object.keys(localStorage).sort();
          const toRemove = keys.slice(0, Math.max(0, keys.length - 20));
          toRemove.forEach(k => {
            if (!k.startsWith(STORAGE_KEYS.API_CONFIG) && !k.startsWith('enc_')) {
              localStorage.removeItem(k);
            }
          });
          localStorage.setItem(key, JSON.stringify(value));
          console.warn('⚠️ 已清理旧数据以释放存储空间');
        } catch (e3) {
          console.error('清理后仍然无法存储:', (e3 as Error).message);
        }
      }
    }
  }
};

// 读取数据
const getItem = async <T = unknown>(key: string): Promise<T | null> => {
  try {
    const database = await openDB();
    const tx = database.transaction('store', 'readonly');
    const store = tx.objectStore('store');
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (request.result !== undefined) {
          resolve(request.result as T);
        } else {
          const localData = localStorage.getItem(key);
          if (localData) {
            try {
              const parsed = JSON.parse(localData) as T;
              setItem(key, parsed);
              resolve(parsed);
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error(`IndexedDB getItem 失败 (${key}):`, e);
    const localData = localStorage.getItem(key);
    if (localData) {
      try { return JSON.parse(localData) as T; } catch { return null; }
    }
    return null;
  }
};

// 删除数据
const removeItem = async (key: string): Promise<void> => {
  try {
    const database = await openDB();
    const tx = database.transaction('store', 'readwrite');
    const store = tx.objectStore('store');
    store.delete(key);
    localStorage.removeItem(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.removeItem(key);
  }
};

// 获取所有 key
const getAllKeys = async (): Promise<string[]> => {
  try {
    const database = await openDB();
    const tx = database.transaction('store', 'readonly');
    const store = tx.objectStore('store');
    const request = store.getAllKeys();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return Object.keys(localStorage);
  }
};

// 获取存储使用量（估算，MB）
const getUsage = async (): Promise<number> => {
  try {
    const database = await openDB();
    const tx = database.transaction('store', 'readonly');
    const store = tx.objectStore('store');
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const totalSize = JSON.stringify(request.result || []).length;
        resolve(Math.round(totalSize / 1024 / 1024 * 100) / 100);
      };
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
};

export default {
  setItem,
  getItem,
  removeItem,
  getAllKeys,
  getUsage
};
