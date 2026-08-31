// src/utils/libraryPathRepair.js
// 🔧 教材库/模板库路径自愈工具：
//   旧版改名只改 name 不改 id/路径（改名后"对应不上"），或改名中途移动失败导致 store 指向不存在的文件
//   （预览空白）——本工具在加载时自动迁移/修复，让显示名、id、磁盘文件三者重新对齐。
// 纯函数：fs 能力通过参数注入（便于单元测试）；无冲突、无文件时不产生任何副作用。

/** 名称 → 文件系统安全 ID（与上传/重命名逻辑一致） */
export const sanitizeFsName = (name) => (name || '').replace(/[<>:"/\\|?*]/g, '_');

/**
 * 对单个条目执行路径自愈
 * @param {Record<string, unknown>} entry - 教材/模板条目（会原地修改）
 * @param {{ pathExists: (p:string)=>Promise<boolean>, moveFile: (s:string,t:string)=>Promise<{success?:boolean,error?:string}> }} fs
 * @param {string} storagePath - 存储根路径
 * @param {string} libDir - '教材库' | '模板库'
 * @returns {Promise<boolean>} 是否发生变更
 */
export async function repairLibraryPaths(entry, fs, storagePath, libDir = '教材库') {
  const name = String(entry.name || '');
  const safeName = sanitizeFsName(name);
  const oldId = String(entry.id || '');
  if (!safeName) return false;

  const base = `${storagePath}/${libDir}`;
  const nameImagesDir = entry.imagesDir ? `${base}/图片/${safeName}` : '';
  const namePdfPath = entry.pdfPath ? `${base}/${safeName}_带书签.pdf` : '';
  const nameCoverPath = entry.coverPath ? `${base}/缩略图/${safeName}.png` : '';
  const idImagesDir = oldId ? `${base}/图片/${oldId}` : '';
  const idPdfPath = oldId && entry.pdfPath ? `${base}/${oldId}_带书签.pdf` : '';
  const idCoverPath = oldId && entry.coverPath ? `${base}/缩略图/${oldId}.png` : '';

  // 现状：当前指向 / 名称名下 / 旧 id 名下 三套候选是否存在（空路径视为有效）
  const cur = {
    imagesDir: entry.imagesDir ? await fs.pathExists(String(entry.imagesDir)) : true,
    pdfPath: entry.pdfPath ? await fs.pathExists(String(entry.pdfPath)) : true,
    coverPath: entry.coverPath ? await fs.pathExists(String(entry.coverPath)) : true,
  };
  const nameOk = {
    imagesDir: nameImagesDir ? await fs.pathExists(nameImagesDir) : true,
    pdfPath: namePdfPath ? await fs.pathExists(namePdfPath) : true,
    coverPath: nameCoverPath ? await fs.pathExists(nameCoverPath) : true,
  };
  const idOk = {
    imagesDir: idImagesDir ? await fs.pathExists(idImagesDir) : true,
    pdfPath: idPdfPath ? await fs.pathExists(idPdfPath) : true,
    coverPath: idCoverPath ? await fs.pathExists(idCoverPath) : true,
  };

  const curAllOk = cur.imagesDir && cur.pdfPath && cur.coverPath;
  // 名称目标是否全部空闲：空路径（该字段不存在）不算占用
  const nameAllFree =
    (nameImagesDir ? !nameOk.imagesDir : true) &&
    (namePdfPath ? !nameOk.pdfPath : true) &&
    (nameCoverPath ? !nameOk.coverPath : true);
  const isLegacyName = safeName !== oldId;

  // 场景1：旧改名遗留（id≠名称、当前路径有效、名称目标无冲突）→ 整体迁移，达成 id/名称/磁盘完全一致
  if (isLegacyName && curAllOk && nameAllFree) {
    const moved = [];
    const doMove = async (src, dst) => {
      if (!src) return true;
      const r = await fs.moveFile(src, dst);
      if (r && r.success) { moved.push([src, dst]); return true; }
      return false;
    };
    const ok =
      (await doMove(entry.imagesDir, nameImagesDir)) &&
      (await doMove(entry.pdfPath, namePdfPath)) &&
      (await doMove(entry.coverPath, nameCoverPath));
    if (ok) {
      entry.id = safeName;
      if (nameImagesDir) entry.imagesDir = nameImagesDir;
      if (namePdfPath) entry.pdfPath = namePdfPath;
      if (nameCoverPath) entry.coverPath = nameCoverPath;
      return true;
    }
    // 迁移失败 → 回滚已移动项
    for (const [src, dst] of moved.reverse()) {
      try { await fs.moveFile(dst, src); } catch { /* 忽略回滚失败 */ }
    }
    return false;
  }

  // 场景2：指针修复——当前指向失效时，优先指向名称名下、其次旧 id 名下真实存在的文件
  let changed = false;
  const fixField = async (key, curOk, nameFieldOk, idFieldOk, nameVal, idVal) => {
    if (!entry[key] || curOk) return;
    if (nameFieldOk && nameVal) { entry[key] = nameVal; changed = true; }
    else if (idFieldOk && idVal) { entry[key] = idVal; changed = true; }
  };
  await fixField('pdfPath', cur.pdfPath, nameOk.pdfPath, idOk.pdfPath, namePdfPath, idPdfPath);
  await fixField('imagesDir', cur.imagesDir, nameOk.imagesDir, idOk.imagesDir, nameImagesDir, idImagesDir);
  await fixField('coverPath', cur.coverPath, nameOk.coverPath, idOk.coverPath, nameCoverPath, idCoverPath);
  return changed;
}
