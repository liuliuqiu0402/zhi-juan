/**
 * 哈希工具（共享）
 * ============================================================
 * 🔴 djb2（32 位指纹 → base36）是"原文变更检测"跨模块协议的唯一实现：
 *    写入端 GenerateModule（ch._analyzedTextHash）与读取端 useAiGenerator 比对"原文未变走捷径"共用，
 *    曾各自复制一份逐字实现——任一侧分叉即变更检测静默失效（重复分析或永久绕过）。
 * ============================================================
 */

/** djb2 字符串哈希：返回 32 位无符号整数的 base36 字符串（与历史 _analyzedTextHash 格式兼容，勿改格式） */
export const djb2 = (str = '') => {
  const s = String(str);
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

export default { djb2 };
