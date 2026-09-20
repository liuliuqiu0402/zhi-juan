// tests/utils/libraryRelink.test.js
// 🔄 磁盘 → 应用 的逆向联动（2026-09-20）
// ============================================================
// 用户实测的机制（原话）："可以从项目中的教材库改名，改完后本地的自动联动变更，但是逆向改不同步"。
//   正向（应用→磁盘）有实现；逆向（磁盘→应用）以前完全没有 ⇒ 在「本地教材库」目录里手动改过名之后，
//   记录指向旧路径、改名报"PDF 被占用"（其实是找不到源文件）、预览一片空白。
// 本测试锁住两件事：① 无歧义时能配对上；② **有歧义时一律不猜**（猜错＝两本教材内容对调，比不修更糟）。
import { describe, it, expect } from 'vitest';
import { planRelink, pdfStem, coverStem } from '../../src/utils/libraryRelink';

const LISTING = {
  pdfs: ['七年级英语上册_带书签.pdf', 'Unit 1 测试卷_带书签.pdf'],
  imageDirs: ['七年级英语上册', 'Unit 1 测试卷'],
  covers: ['七年级英语上册.png', 'Unit 1 测试卷.png'],
};

describe('stem 逆运算（libraryEntryPaths 的逆）', () => {
  it('pdf → stem：去掉 `_带书签` 与扩展名；cover → stem：去掉扩展名', () => {
    expect(pdfStem('Unit 1 测试卷_带书签.pdf')).toBe('Unit 1 测试卷');
    expect(pdfStem('原稿.pdf')).toBe('原稿');           // 没加书签的裸 PDF 也要认
    expect(coverStem('Unit 1 测试卷.png')).toBe('Unit 1 测试卷');
    expect(pdfStem('')).toBe('');
  });
});

describe('planRelink：无歧义才自动配对', () => {
  it('唯一孤儿组 + 唯一缺文件条目 → 配对（用户在库目录里改了一本书的名）', () => {
    const entry = { id: '旧名', name: 'Unit 1 测试卷' };
    const plan = planRelink({
      missingEntries: [entry],
      listing: { pdfs: ['新名字_带书签.pdf'], imageDirs: ['新名字'], covers: ['新名字.png'] },
      claimedStems: ['Unit 1 测试卷'],   // 其余健康条目引用的 stem
    });
    expect(plan.ambiguous).toBe(false);
    expect(plan.pairs).toHaveLength(1);
    expect(plan.pairs[0].entry).toBe(entry);
    expect(plan.pairs[0].stem).toBe('新名字');
    expect(plan.pairs[0].assign).toEqual({ pdf: true, imagesDir: true, cover: true });
  });

  it('🔴 多组孤儿 + 多条缺失 → **不猜**，如实报告需要人工指认', () => {
    const plan = planRelink({
      missingEntries: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      listing: LISTING,
      claimedStems: [],
    });
    expect(plan.pairs).toHaveLength(0);          // 关键：绝不能"按顺序对上"
    expect(plan.ambiguous).toBe(true);
    expect(plan.reason).toContain('无法判断谁对应谁');
    expect(plan.orphanStems.sort()).toEqual(['Unit 1 测试卷', '七年级英语上册']);
  });

  it('🔴 健康条目引用的文件不得被抢走（claimedStems 生效）', () => {
    // 磁盘上两套文件都在，但其中一套仍被健康条目引用 → 只剩一套真正的孤儿
    const plan = planRelink({
      missingEntries: [{ id: '旧名', name: 'X' }],
      listing: LISTING,
      claimedStems: ['七年级英语上册'],
    });
    expect(plan.orphanStems).toEqual(['Unit 1 测试卷']);
    expect(plan.pairs).toHaveLength(1);
    expect(plan.pairs[0].stem).toBe('Unit 1 测试卷');
  });

  it('孤儿组只有部分文件（只改了 PDF 名）→ 只指认实际存在的那几项', () => {
    const plan = planRelink({
      missingEntries: [{ id: '旧名', name: 'X' }],
      listing: { pdfs: ['onlypdf_带书签.pdf'], imageDirs: [], covers: [] },
      claimedStems: [],
    });
    expect(plan.pairs[0].assign).toEqual({ pdf: true, imagesDir: false, cover: false });
  });

  it('没有孤儿组（文件被搬到库目录之外）→ 不配对，并说明该怎么查', () => {
    const plan = planRelink({ missingEntries: [{ id: 'a', name: 'A' }], listing: { pdfs: [], imageDirs: [], covers: [] }, claimedStems: [] });
    expect(plan.pairs).toHaveLength(0);
    expect(plan.ambiguous).toBe(false);
    expect(plan.reason).toContain('库目录之外');
  });

  it('有孤儿但没有缺文件的条目 → 什么都不做（多出来的文件不是我们的问题）', () => {
    const plan = planRelink({ missingEntries: [], listing: LISTING, claimedStems: [] });
    expect(plan.pairs).toHaveLength(0);
    expect(plan.ambiguous).toBe(false);
  });

  it('空输入不抛错（首次使用：目录都不存在）', () => {
    expect(() => planRelink({})).not.toThrow();
    expect(planRelink().pairs).toHaveLength(0);
  });
});

describe('源码接线锁：逆向联动必须真的接上', () => {
  it('主进程提供 list-directory（只读、不递归），渲染端据此扫描库目录', async () => {
    const fsMod = await import('node:fs');
    const pathMod = await import('node:path');
    const url = await import('node:url');
    const ROOT = pathMod.resolve(pathMod.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
    const mainSrc = fsMod.readFileSync(pathMod.join(ROOT, 'main.js'), 'utf8');
    const preloadSrc = fsMod.readFileSync(pathMod.join(ROOT, 'preload.js'), 'utf8');
    const tbSrc = fsMod.readFileSync(pathMod.join(ROOT, 'src/modules/TextbookModule.vue'), 'utf8');
    expect(mainSrc).toContain("ipcMain.handle('list-directory'");
    expect(preloadSrc).toContain('listDirectory:');
    expect(tbSrc).toContain('planRelink');
    expect(tbSrc).toContain('relinkFromDisk');
    expect(tbSrc).toContain('await relinkFromDisk()');   // 进入教材库时自动扫一次
  });
});
