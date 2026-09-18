/**
 * 大纲树勾选工具（课本库 / 模板库 store 共用）
 * ============================================================
 * 🔴 曾分别内联于 textbookStore.ts 与 templateStore.js（hasAnySelected ×5、countRecursive ×2 逐字副本，
 *    教材/模板两 store 镜像复制 + store 内部二次复制），现收敛为本文件唯一实现。
 * 节点形状约定：{ selected?: boolean, children?: Node[] }（与两库 outline 树一致）。
 * ============================================================
 */

/** 是否存在任一已勾选节点（深度优先） */
export const hasAnySelected = (nodes) => {
  if (!nodes) return false;
  for (const node of nodes) {
    if (node.selected) return true;
    if (node.children && node.children.length > 0 && hasAnySelected(node.children)) return true;
  }
  return false;
};

/** 已勾选节点总数（深度优先，含子孙） */
export const countSelected = (nodes) => {
  if (!nodes) return 0;
  let count = 0;
  for (const node of nodes) {
    if (node.selected) count++;
    if (node.children) count += countSelected(node.children);
  }
  return count;
};

/** 已勾选节点清单（深度优先、保序，含子孙）——原为 textbookStore action 内联实现，
 *  2026-09-18 上收本文件（与 hasAnySelected/countSelected 同源），供 store action 与
 *  "生成指令失效签名" getter 共用，避免第二份副本。 */
export const getSelected = (nodes) => {
  if (!nodes) return [];
  const all = [];
  const collect = (list) => {
    for (const node of list) {
      if (node.selected) all.push(node);
      if (node.children) collect(node.children);
    }
  };
  collect(nodes);
  return all;
};

export default { hasAnySelected, countSelected, getSelected };
