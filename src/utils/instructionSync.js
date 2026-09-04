/**
 * 指令同旧句批量同步（旁路，MVP 批2·步4）
 * ============================================================
 * 🔴 场景：用户在指令库编辑保存某条模板（把某行旧句改为新句），其它库/条目里可能
 *    还散落着同一句旧文本（自定义指令模板、规则库 promptHint…）。保存后弹窗提示，
 *    按库分组、由用户逐条勾选决定是否替换（MVP 口径：行级 diff 1:1 配对才自动替换，
 *    避免错配；不 1:1 的行不参与自动同步）。
 * 🔴 旁路：本模块只做计算（diff / 扫描 / 替换文本），不读写任何库；执行替换由调用方
 *    （InstructionView）用各库既有 save API 落库，与既有编辑机制一致。
 * 行级 diff 口径（保守）：
 *   1. 只比较"有内容行"（trim 非空），空行忽略；
 *   2. removed = 旧文本中存在、新文本中不存在的行；added 反之（按出现序去重配对）；
 *   3. 仅当 removed.length === added.length 时按序 1:1 配对生成 pairs（可安全自动替换）；
 *      不相等 → pairs 为空（调用方只提示不自动替换）。
 */
/** 行级 diff：返回可自动替换的 1:1 行对（old 行 → new 行） */
export const diffOldNewLines = (oldText = '', newText = '') => {
  const oldLines = String(oldText || '').split('\n').map((s) => s.replace(/\r$/, ''));
  const newLines = String(newText || '').split('\n').map((s) => s.replace(/\r$/, ''));
  const meaningful = (s) => !!s.trim();
  const removed = [];
  const added = [];
  const usedNew = [];
  for (let i = 0; i < oldLines.length; i++) {
    if (!meaningful(oldLines[i])) continue;
    const j = newLines.findIndex((nl, k) => meaningful(nl) && nl === oldLines[i] && !usedNew.includes(k));
    if (j === -1) removed.push(oldLines[i]);
    else usedNew.push(j);
  }
  for (let k = 0; k < newLines.length; k++) {
    if (!meaningful(newLines[k]) || usedNew.includes(k)) continue;
    const i = oldLines.findIndex((ol) => meaningful(ol) && ol === newLines[k]);
    if (i === -1) added.push(newLines[k]);
  }
  if (removed.length === added.length) {
    return { pairs: removed.map((old, idx) => ({ old, next: added[idx] })), unbalanced: [] };
  }
  return { pairs: [], unbalanced: removed };
};

/**
 * 扫描候选文本条目：哪些条目包含任一 diff 旧行
 * @param {Array<{lib:string,key:string,name:string,text:string}>} targets 候选条目（各库自定义条目）
 * @param {Array<{old:string,next:string}>} pairs diff 行对
 * @returns {Array<{lib,key,name,pair}>} 命中清单（一条目 × 命中的行对）
 */
export const scanSyncTargets = (targets = [], pairs = []) => {
  if (!pairs.length) return [];
  const hits = [];
  for (const t of targets) {
    if (!t || !t.text) continue;
    for (const pair of pairs) {
      if (String(t.text).includes(pair.old)) {
        hits.push({ lib: t.lib, key: t.key, name: t.name || t.key, text: t.text, pair });
      }
    }
  }
  return hits;
};

/** 在文本中把旧行全部替换为新行（同句多处同步一致） */
export const applySyncReplace = (text = '', oldLine = '', newLine = '') =>
  oldLine && String(text || '').includes(oldLine) ? String(text).split(oldLine).join(newLine) : text;

/** 命中按库分组（指令库/规则库…），组内保持命中顺序 */
export const groupSyncHitsByLib = (hits = []) => {
  const groups = [];
  const map = new Map();
  for (const h of hits) {
    if (!map.has(h.lib)) {
      const g = { lib: h.lib, items: [] };
      map.set(h.lib, g);
      groups.push(g);
    }
    map.get(h.lib).items.push(h);
  }
  return groups;
};
