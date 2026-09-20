// src/utils/libraryRelink.js
// 🔄 磁盘 → 应用 的**逆向联动**（2026-09-20）
// ============================================================
// 用户实测的机制（原话）："可以从项目中的教材库改名，改完后本地的自动联动变更，但是逆向改不同步"。
//   · 正向（应用 → 磁盘）：改名流程会 move imagesDir / pdfPath / coverPath，磁盘文件跟着变 ✓
//   · 逆向（磁盘 → 应用）：完全没人管 ✗
//     —— 于是在「本地教材库」目录里手动改过名之后：
//        · 条目记录仍指向旧路径 → 改名时 move 找不到源文件 → 却报"PDF 被占用"（误导）
//        · 预览用同一个失效路径 → 加载失败 → 空白画布（且只在 console 里报错）
// 本文件补上逆向：扫描库目录，把"没有任何条目认领"的文件组与"文件缺失的条目"配对。
//
// 🔴 铁律：**只做无歧义配对，绝不猜**。
//   孤儿文件组与缺文件的条目都是 1 个时，配对是唯一的，可以安全自动完成；
//   一旦有多个候选（例如库里有 2 本书都被手动改过名），任何自动配对都等于在赌
//   "哪本教材的内容对哪本书" —— 赌错就是把两本教材对调，比不修更糟。这种情况一律交给用户手动指认。
// 纯函数：目录清单与 fs 都由调用方注入（便于单测）。

/** `X_带书签.pdf` → `X`（libraryEntryPaths 的逆运算） */
export const pdfStem = (fileName) => String(fileName || '').replace(/_带书签\.pdf$/i, '').replace(/\.pdf$/i, '');
/** `X.png` → `X`（libraryEntryPaths 的逆运算） */
export const coverStem = (fileName) => String(fileName || '').replace(/\.png$/i, '');

/**
 * 规划逆向联动
 * @param {{
 *   missingEntries?: Array<{id?:string,name?:string}>,
 *   listing?: { pdfs?: string[], imageDirs?: string[], covers?: string[] },
 *   claimedStems?: string[],
 * }} input
 *   missingEntries 由调用方诊断（哪些条目的文件已经找不到）
 *   listing 是库目录的**名字清单**（不含路径）：`教材库/` 下的 pdf 文件名、`图片/` 下的目录名、`缩略图/` 下的文件名
 *   claimedStems 是**仍被任何条目引用**的 stem（健康条目的文件不许被抢走）
 * @returns {{
 *   pairs: Array<{ entry: object, stem: string, assign: {pdf:boolean, imagesDir:boolean, cover:boolean} }>,
 *   orphanStems: string[],
 *   ambiguous: boolean,
 *   reason: string,
 * }}
 */
export function planRelink({ missingEntries = [], listing = {}, claimedStems = [] } = {}) {
  const claimed = new Set((claimedStems || []).filter(Boolean));
  /** stem → 该 stem 名下真实存在的三类文件 */
  const groups = new Map();
  const touch = (stem, key) => {
    if (!stem || claimed.has(stem)) return;           // 被健康条目引用着 → 不是孤儿
    if (!groups.has(stem)) groups.set(stem, { stem, pdf: false, imagesDir: false, cover: false });
    groups.get(stem)[key] = true;
  };
  for (const n of listing.pdfs || []) touch(pdfStem(n), 'pdf');
  for (const n of listing.imageDirs || []) touch(n, 'imagesDir');
  for (const n of listing.covers || []) touch(coverStem(n), 'cover');

  const orphanStems = [...groups.keys()];
  const pairs = [];

  // 无歧义：唯一孤儿组 + 唯一缺文件条目
  if (orphanStems.length === 1 && missingEntries.length === 1) {
    const g = groups.get(orphanStems[0]);
    pairs.push({ entry: missingEntries[0], stem: orphanStems[0], assign: { pdf: g.pdf, imagesDir: g.imagesDir, cover: g.cover } });
    return { pairs, orphanStems, ambiguous: false, reason: '', groups: Object.fromEntries(groups) };
  }

  // 有候选但无法判定归属 → 明确说"需要你指认"，不做任何自动改动
  if (orphanStems.length > 0 && missingEntries.length > 0) {
    const reason = `磁盘上有 ${orphanStems.length} 组未被认领的文件（${orphanStems.join('、')}），`
      + `而库里有 ${missingEntries.length} 条记录找不到文件，无法判断谁对应谁 —— 需要手动指认。`;
    return { pairs, orphanStems, ambiguous: true, reason, groups: Object.fromEntries(groups) };
  }

  const reason = missingEntries.length
    ? '磁盘上没有找到任何未被认领的文件组：这些文件可能被移到了库目录之外，或存储路径被改过。'
    : '';
  return { pairs, orphanStems, ambiguous: false, reason, groups: Object.fromEntries(groups) };
}
