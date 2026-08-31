// tests/utils/libraryPathRepair.test.js
// 🔧 教材/模板路径自愈逻辑：旧版改名只改 name、改名中途移动失败导致 store 路径错乱时，加载自动迁移/修复
import { describe, it, expect } from 'vitest';
import { sanitizeFsName, repairLibraryPaths } from '../../src/utils/libraryPathRepair';

/** 内存版 fs：existing 为初始存在的路径集合，移动成功后同步更新 */
function createFs(existing) {
  const set = new Set(existing);
  const moves = [];
  const fs = {
    async pathExists(p) { return set.has(p); },
    async moveFile(src, dst) {
      if (!set.has(src)) return { success: false, error: '源不存在' };
      if (set.has(dst)) return { success: false, error: '目标已存在' };
      set.delete(src);
      set.add(dst);
      moves.push([src, dst]);
      return { success: true };
    }
  };
  return { fs, moves, exists: (p) => set.has(p) };
}

const storage = 'D:/智卷工坊数据';
const OLD_IMG = `${storage}/教材库/图片/语文①年级上册`;
const OLD_PDF = `${storage}/教材库/语文①年级上册_带书签.pdf`;
const OLD_COVER = `${storage}/教材库/缩略图/语文①年级上册.png`;
const NEW_IMG = `${storage}/教材库/图片/26春教材语文①年级下册`;
const NEW_PDF = `${storage}/教材库/26春教材语文①年级下册_带书签.pdf`;
const NEW_COVER = `${storage}/教材库/缩略图/26春教材语文①年级下册.png`;

const legacyBook = () => ({
  id: '语文①年级上册',
  name: '26春教材语文①年级下册',
  imagesDir: OLD_IMG,
  pdfPath: OLD_PDF,
  coverPath: OLD_COVER
});

describe('sanitizeFsName', () => {
  it('替换文件系统非法字符', () => {
    expect(sanitizeFsName('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });
  it('空名称返回空串', () => {
    expect(sanitizeFsName('')).toBe('');
  });
});

describe('repairLibraryPaths · 场景1：旧改名遗留（id≠名称）', () => {
  it('磁盘文件仍在旧 id 名下、名称目标无冲突 → 整体迁移并对齐 id/路径', async () => {
    const { fs, moves, exists } = createFs([OLD_IMG, OLD_PDF, OLD_COVER]);
    const book = legacyBook();
    const changed = await repairLibraryPaths(book, fs, storage, '教材库');

    expect(changed).toBe(true);
    expect(book.id).toBe('26春教材语文①年级下册');
    expect(book.imagesDir).toBe(NEW_IMG);
    expect(book.pdfPath).toBe(NEW_PDF);
    expect(book.coverPath).toBe(NEW_COVER);
    expect(moves).toEqual([[OLD_IMG, NEW_IMG], [OLD_PDF, NEW_PDF], [OLD_COVER, NEW_COVER]]);
    expect(exists(NEW_IMG)).toBe(true);
    expect(exists(NEW_PDF)).toBe(true);
    expect(exists(OLD_IMG)).toBe(false);
  });

  it('名称目标有冲突（同名图片目录已存在）→ 不迁移、无任何变更', async () => {
    const { fs, moves } = createFs([OLD_IMG, OLD_PDF, OLD_COVER, NEW_IMG]);
    const book = legacyBook();
    const changed = await repairLibraryPaths(book, fs, storage, '教材库');

    expect(changed).toBe(false);
    expect(book.id).toBe('语文①年级上册');
    expect(book.pdfPath).toBe(OLD_PDF);
    expect(moves).toEqual([]);
  });

  it('迁移中途失败（PDF 被占用）→ 已移动项回滚，记录保持不变', async () => {
    const set = new Set([OLD_IMG, OLD_PDF, OLD_COVER]);
    const moves = [];
    const fs = {
      async pathExists(p) { return set.has(p); },
      async moveFile(src, dst) {
        if (!set.has(src)) return { success: false, error: '源不存在' };
        if (set.has(dst)) return { success: false, error: '目标已存在' };
        if (src === OLD_PDF) return { success: false, error: '文件被占用' }; // PDF 移动失败
        set.delete(src);
        set.add(dst);
        moves.push([src, dst]);
        return { success: true };
      }
    };
    const book = legacyBook();
    const changed = await repairLibraryPaths(book, fs, storage, '教材库');

    expect(changed).toBe(false);
    expect(moves).toEqual([[OLD_IMG, NEW_IMG], [NEW_IMG, OLD_IMG]]); // 移动 + 回滚
    expect(book.id).toBe('语文①年级上册');
    expect(set.has(OLD_IMG)).toBe(true); // 目录已回滚
    expect(set.has(OLD_PDF)).toBe(true);
  });
});

describe('repairLibraryPaths · 场景2：store 指向失效文件', () => {
  it('改名中途失败：imagesDir/cover 已迁到名称名下、pdfPath 失效且磁盘在名称名下 → 指针修复', async () => {
    // id 已与新名称一致（新代码改名），pdfPath 指向不存在文件
    const book = {
      id: '26春教材语文①年级下册',
      name: '26春教材语文①年级下册',
      imagesDir: NEW_IMG,
      pdfPath: `${storage}/教材库/不存在_带书签.pdf`,
      coverPath: NEW_COVER
    };
    const { fs } = createFs([NEW_IMG, NEW_PDF, NEW_COVER]);
    const changed = await repairLibraryPaths(book, fs, storage, '教材库');

    expect(changed).toBe(true);
    expect(book.pdfPath).toBe(NEW_PDF);
    expect(book.imagesDir).toBe(NEW_IMG);
  });

  it('当前指向失效、名称名下与旧 id 名下都存在 → 优先指向名称名下', async () => {
    const book = legacyBook();
    book.imagesDir = `${storage}/教材库/图片/不存在`;
    const { fs } = createFs([NEW_IMG, OLD_IMG, OLD_PDF, OLD_COVER, NEW_PDF, NEW_COVER]);
    const changed = await repairLibraryPaths(book, fs, storage, '教材库');

    expect(changed).toBe(true);
    expect(book.imagesDir).toBe(NEW_IMG);
  });

  it('当前指向失效、名称名下不存在但旧 id 名下存在 → 指向旧 id 名下', async () => {
    const book = legacyBook();
    book.pdfPath = `${storage}/教材库/不存在_带书签.pdf`;
    const { fs } = createFs([OLD_IMG, OLD_PDF, OLD_COVER]); // 名称名下没有
    const changed = await repairLibraryPaths(book, fs, storage, '教材库');

    expect(changed).toBe(true);
    expect(book.pdfPath).toBe(OLD_PDF);
  });

  it('所有候选都不存在 → 不变更（不产生副作用）', async () => {
    const book = legacyBook();
    book.pdfPath = `${storage}/教材库/不存在_带书签.pdf`;
    const { fs, moves } = createFs([]);
    const changed = await repairLibraryPaths(book, fs, storage, '教材库');

    expect(changed).toBe(false);
    expect(moves).toEqual([]);
  });
});

describe('repairLibraryPaths · 正常条目与模板库', () => {
  it('id===名称且路径全部有效 → 无任何变更', async () => {
    const book = {
      id: '人教版·数学①年级上册',
      name: '人教版·数学①年级上册',
      imagesDir: `${storage}/教材库/图片/人教版·数学①年级上册`,
      pdfPath: `${storage}/教材库/人教版·数学①年级上册_带书签.pdf`,
      coverPath: `${storage}/教材库/缩略图/人教版·数学①年级上册.png`
    };
    const { fs, moves } = createFs([
      book.imagesDir, book.pdfPath, book.coverPath
    ]);
    const changed = await repairLibraryPaths(book, fs, storage, '教材库');
    expect(changed).toBe(false);
    expect(moves).toEqual([]);
  });

  it('模板库（libDir=模板库）旧改名遗留 → 迁移到模板库路径', async () => {
    const book = {
      id: '模板旧名',
      name: '模板新名',
      imagesDir: `${storage}/模板库/图片/模板旧名`,
      pdfPath: `${storage}/模板库/模板旧名_带书签.pdf`,
      coverPath: `${storage}/模板库/缩略图/模板旧名.png`
    };
    const { fs, moves } = createFs([book.imagesDir, book.pdfPath, book.coverPath]);
    const changed = await repairLibraryPaths(book, fs, storage, '模板库');

    expect(changed).toBe(true);
    expect(book.id).toBe('模板新名');
    expect(book.imagesDir).toBe(`${storage}/模板库/图片/模板新名`);
    expect(book.pdfPath).toBe(`${storage}/模板库/模板新名_带书签.pdf`);
    expect(moves.length).toBe(3);
  });

  it('名称含非法字符 → 按 sanitize 后的名称对齐', async () => {
    const book = {
      id: '旧:名',
      name: '新/名?',
      imagesDir: `${storage}/教材库/图片/旧_名`,
      pdfPath: `${storage}/教材库/旧_名_带书签.pdf`
    };
    const { fs, moves } = createFs([book.imagesDir, book.pdfPath]);
    const changed = await repairLibraryPaths(book, fs, storage, '教材库');

    expect(changed).toBe(true);
    expect(book.id).toBe('新_名_');
    expect(book.imagesDir).toBe(`${storage}/教材库/图片/新_名_`);
    expect(moves.length).toBe(2);
  });
});
