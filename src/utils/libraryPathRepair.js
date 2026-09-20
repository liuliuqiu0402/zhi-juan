// src/utils/libraryPathRepair.js
// 🔧 教材库/模板库路径自愈工具：
//   旧版改名只改 name 不改 id/路径（改名后"对应不上"），或改名中途移动失败导致 store 指向不存在的文件
//   （预览空白）——本工具在加载时自动迁移/修复，让显示名、id、磁盘文件三者重新对齐。
// 纯函数：fs 能力通过参数注入（便于单元测试）；无冲突、无文件时不产生任何副作用。

/** 名称 → 文件系统安全 ID（与上传/重命名逻辑一致） */
export const sanitizeFsName = (name) => (name || '').replace(/[<>:"/\\|?*]/g, '_');

/**
 * 🔑 教材/模板在磁盘上的**唯一路径公式**（2026-09-20 收口）
 * ============================================================
 * 为什么必须收口：改名流程（TextbookModule/TemplateModule）、加载自愈（本文件）、
 *   以及"修复路径"动作都要回答同一个问题——"某名称对应的文件在哪"。
 *   三处各写一遍公式 ⇒ 任一处改了后缀（`_带书签.pdf`）或子目录（`图片/`、`缩略图/`），
 *   另外两处就会**静默指向不存在的路径**（表现正是"预览空白 / 改名说被占用"）。
 * 口径：按**名称**（显示名 → 安全名）和按**旧 id**（历史遗留）两套候选都给出；
 *   调用方按"该字段是否存在"决定用不用（无 PDF 的条目不该去比 PDF 路径）。
 * @param {{name?: string, id?: string}} entry
 * @param {string} storagePath 存储根路径
 * @param {string} libDir '教材库' | '模板库'
 * @returns {{ name: {imagesDir:string, pdfPath:string, coverPath:string}, id: {...} }}
 */
export function libraryEntryPaths(entry, storagePath, libDir = '教材库') {
  const base = `${storagePath}/${libDir}`;
  const build = (key) => (key
    ? {
      imagesDir: `${base}/图片/${key}`,
      pdfPath: `${base}/${key}_带书签.pdf`,
      coverPath: `${base}/缩略图/${key}.png`,
    }
    : { imagesDir: '', pdfPath: '', coverPath: '' });
  return { name: build(sanitizeFsName(entry && entry.name)), id: build(String((entry && entry.id) || '')) };
}

/**
 * 🔍 移动失败的原因归类 + 人话建议（2026-09-20）
 * ============================================================
 * 背景（用户实测）：改名失败时界面**一律**显示"PDF 文件被占用（可能正在阅读器中打开）"，
 *   而真实原因常常是"源文件不存在"——用户在「本地教材库」目录里已经改过名/挪过文件。
 *   提示张冠李戴 ⇒ 用户去关阅读器永远修不好，也想不到自己磁盘上的改动才是原因。
 * 口径：把原始错误归类成 missing/busy/conflict/other，各给**可执行**的下一步；
 *   other 保留原始错误原文（可诊断性优先于措辞统一）。
 */
export function classifyMoveError(errorMsg = '') {
  const m = String(errorMsg || '');
  if (/ENOENT|源文件不存在/i.test(m)) {
    return {
      kind: 'missing',
      advice: '磁盘上找不到源文件：多半是已在「本地教材库」目录里改过名或移动过（也可能是存储路径被换过）。'
        + '请到教材库列表点「🔗 修复路径」按当前名称重新指认，或把磁盘上的文件改回原名。',
    };
  }
  if (/目标目录已存在/.test(m)) {
    return {
      kind: 'conflict',
      advice: '目标位置已存在同名文件或目录：请换一个名称，或先清理掉同名的那一份。',
    };
  }
  if (/EBUSY|EPERM|EACCES|resource busy|locked|被占用/i.test(m)) {
    return {
      kind: 'busy',
      advice: '文件被其它程序占用：请关闭所有正在打开该 PDF 的窗口——'
        + '包括本应用的预览面板 / 「PDF 对照」浮窗，以及 Acrobat、Edge 等外部阅读器，然后重试。',
    };
  }
  return { kind: 'other', advice: `原始错误：${m || '（无错误信息）'}` };
}

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

  // 🔑 路径公式一律取自 libraryEntryPaths（改名/自愈/修复路径三处共用同一实现，防公式漂移）
  const p = libraryEntryPaths({ name, id: oldId }, storagePath, libDir);
  const nameImagesDir = entry.imagesDir ? p.name.imagesDir : '';
  const namePdfPath = entry.pdfPath ? p.name.pdfPath : '';
  const nameCoverPath = entry.coverPath ? p.name.coverPath : '';
  const idImagesDir = oldId ? p.id.imagesDir : '';
  const idPdfPath = oldId && entry.pdfPath ? p.id.pdfPath : '';
  const idCoverPath = oldId && entry.coverPath ? p.id.coverPath : '';

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
