/**
 * Node 侧 localStorage 垫片（**仅供核证脚本**，不参与产品运行）
 * ============================================================
 * 为什么需要：库启停（`src/utils/libToggles.js`）、用户库（蓝图/指令/规则）都存 localStorage。
 *   核证脚本要在 Node 里**真的拨动开关**（不是"读源码推断开关会生效"），就必须给一个真实可写存储：
 *   内存实现即可，语义与浏览器端一致（getItem 缺省 null / setItem / removeItem）。
 * 纪律：本文件**只在核证脚本首行 import**（ESM 按声明顺序求值 ⇒ 垫片先于任何读开关的模块生效）；
 *   产品代码不得引用。
 */
const _mem = new Map();

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (k) => (_mem.has(String(k)) ? _mem.get(String(k)) : null),
    setItem: (k, v) => { _mem.set(String(k), String(v)); },
    removeItem: (k) => { _mem.delete(String(k)); },
    clear: () => { _mem.clear(); },
    key: (i) => [..._mem.keys()][i] ?? null,
    get length() { return _mem.size; },
  };
}

export const __memSize = () => _mem.size;
