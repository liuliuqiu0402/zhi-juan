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

export default { hasAnySelected, countSelected };
