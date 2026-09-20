// tests/utils/libraryPathRepair.test.js
// 🔧 教材/模板路径自愈逻辑：旧版改名只改 name、改名中途移动失败导致 store 路径错乱时，加载自动迁移/修复
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeFsName, repairLibraryPaths, libraryEntryPaths, classifyMoveError } from '../../src/utils/libraryPathRepair';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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

/**
 * 🔑 路径公式唯一事实源（2026-09-20）
 * ============================================================
 * 改名流程、加载自愈、"修复路径"三处都要回答"某名称对应的文件在哪"。
 * 各写一份公式 ⇒ 任一处改了后缀/子目录，另外两处就静默指向不存在的路径
 * （用户实测表现：改名报"PDF 被占用"、预览一片空白）。
 */
describe('libraryEntryPaths：磁盘路径公式', () => {
  it('按名称与按旧 id 各给一套候选，后缀/子目录与既有约定一致', () => {
    const p = libraryEntryPaths({ name: 'Unit 1 测试卷', id: '旧名' }, 'D:/数据', '教材库');
    expect(p.name).toEqual({
      imagesDir: 'D:/数据/教材库/图片/Unit 1 测试卷',
      pdfPath: 'D:/数据/教材库/Unit 1 测试卷_带书签.pdf',
      coverPath: 'D:/数据/教材库/缩略图/Unit 1 测试卷.png',
    });
    expect(p.id.pdfPath).toBe('D:/数据/教材库/旧名_带书签.pdf');
  });

  it('名称里的非法字符按 sanitizeFsName 归一；libDir 决定是教材库还是模板库', () => {
    const p = libraryEntryPaths({ name: 'A/B:C', id: '' }, 'D:/数据', '模板库');
    expect(p.name.pdfPath).toBe('D:/数据/模板库/A_B_C_带书签.pdf');
    expect(p.id.pdfPath).toBe('');
  });

  it('🔴 与自愈逻辑用的是同一公式（自愈能找回的文件，改名也必须能算到）', () => {
    const entry = { name: '新名', id: '旧名', imagesDir: 'x', pdfPath: 'y', coverPath: 'z' };
    const p = libraryEntryPaths(entry, 'D:/数据', '教材库');
    // 自愈里"名称目标"用的就是这套路径：故意用自愈的场景1把条目迁移到名称名下，再核对落点
    expect(p.name.imagesDir).toBe('D:/数据/教材库/图片/新名');
    expect(p.name.pdfPath).toBe('D:/数据/教材库/新名_带书签.pdf');
  });
});

/**
 * 🔍 移动失败的原因归类（2026-09-20）
 * ============================================================
 * 用户实测：在本地教材库把教材改名后，项目里改名失败 **一律**提示
 *   "PDF 文件被占用（可能正在阅读器中打开）" —— 而真实原因常常是"源文件不存在"。
 * 提示张冠李戴 ⇒ 用户去关阅读器永远修不好，也想不到是磁盘上的改动。
 */
describe('classifyMoveError：不要再把"找不到文件"说成"被占用"', () => {
  it('源文件不存在 → missing，且建议指向"重新指认/改回原名"（不得提阅读器）', () => {
    const c = classifyMoveError('源文件不存在');
    expect(c.kind).toBe('missing');
    expect(c.advice).toContain('修复路径');
    expect(c.advice).not.toContain('阅读器');
    expect(classifyMoveError('ENOENT: no such file or directory, rename ...').kind).toBe('missing');
  });

  it('真正被占用 → busy，且明确列出该关哪些窗口（含本应用自己的预览/对照浮窗）', () => {
    const c = classifyMoveError("EBUSY: resource busy or locked, rename 'D:\\a_带书签.pdf' -> 'D:\\b_带书签.pdf'");
    expect(c.kind).toBe('busy');
    expect(c.advice).toContain('占用');
    expect(c.advice).toContain('预览');   // 罪魁可能是本应用自己，不能只让用户关外部阅读器
    expect(classifyMoveError('EPERM: operation not permitted').kind).toBe('busy');
  });

  it('目标已存在 → conflict；其余保留原始错误（可诊断性优先）', () => {
    expect(classifyMoveError('目标目录已存在').kind).toBe('conflict');
    const other = classifyMoveError('EXDEV: cross-device link not permitted');
    expect(other.kind).toBe('other');
    expect(other.advice).toContain('EXDEV');
  });

  it('空错误也给出可读结果（不留空白提示）', () => {
    const c = classifyMoveError('');
    expect(c.kind).toBe('other');
    expect(c.advice.length).toBeGreaterThan(0);
  });
});

/**
 * 🧷 源码级接线锁（2026-09-20）
 * ============================================================
 * 这些缺陷的共同点是"构建期不报错、只有用户点下去才暴露"，所以必须把接线本身钉住：
 *   ① 两个库的改名流程必须用 libraryEntryPaths（不得再各写一份路径公式）；
 *   ② 改名失败不得再无条件说"被占用"；
 *   ③ 教材库预览必须按**对象身份**取书（改名会换掉 id 与路径，字符串做键必然失效）；
 *   ④ 预览加载失败必须显性（PdfPreview 必须有 loadError 事件与提示）。
 */
describe('源码接线锁：路径公式 / 报错口径 / 预览取书', () => {
  const TB = readSrc('src/modules/TextbookModule.vue');
  const TPL = readSrc('src/modules/TemplateModule.vue');

  it('① 两库改名流程都用 libraryEntryPaths，且不再硬编码路径公式', () => {
    for (const src of [TB, TPL]) {
      expect(src).toContain('libraryEntryPaths');
      expect(src).toContain('const targets = libraryEntryPaths(');
      // 老的公式片段必须消失（否则等于两套公式并存，随时漂移）
      expect(src).not.toContain('}_带书签.pdf` : \'\'');
      expect(src).not.toContain('/图片/${safeNew}');
    }
  });

  it('② 改名失败如实报错：用 classifyMoveError，旧的"一律被占用"文案已删除', () => {
    for (const src of [TB, TPL]) {
      expect(src).toContain('classifyMoveError');
      expect(src).toContain('const failWith = async (what)');
      expect(src).not.toContain('改名失败：PDF 文件被占用（可能正在阅读器中打开）');
      expect(src).not.toContain('改名失败：图片目录被占用或无法移动');
    }
  });

  it('③ 改名前先诊断源文件（源文件不存在 ≠ 被占用）并自动自愈一次', () => {
    for (const src of [TB, TPL]) {
      expect(src).toContain('findMissing');                     // 源文件预检
      expect(src).toMatch(/repair(Book|Template)Paths\(/);      // 自愈动作
      // 自愈走的是既有实现：教材库用 store 的别名 repairLegacyRename，模板库直接调 repairLibraryPaths
      expect(src).toMatch(/repairLegacyRename|repairLibraryPaths/);
    }
  });

  it('④ 教材库预览按对象身份取书 + 加载失败显性 + 提供修复入口', () => {
    expect(TB).toContain('const previewBook = ref(null)');
    expect(TB).toContain('previewBook.value.pdfPath');
    expect(TB).toContain('@load-error=');
    expect(TB).toContain('repairPreviewPath');
    const pdf = readSrc('src/components/PdfPreview.vue');
    expect(pdf).toContain("defineEmits(['pageChange', 'loadError'])");
    expect(pdf).toContain("emit('loadError'");
    // 强制重读：供"修复路径"后刷新用（路径字符串没变时 watch 触发不了）
    expect(pdf).toMatch(/defineExpose\(\{[\s\S]*?reload,/);
  });
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
