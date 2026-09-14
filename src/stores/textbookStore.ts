import { defineStore } from 'pinia';
import storage from '../utils/storage';
// @ts-ignore - pathHelper.js 无类型声明
import { resolveStoredPath, getStoragePath } from '../utils/pathHelper';
// @ts-ignore - libraryPathRepair.js 无类型声明
import { repairLibraryPaths } from '../utils/libraryPathRepair';
// @ts-ignore - outlineTree.js 无类型声明
import { hasAnySelected as hasAnySelectedTree, countSelected as countSelectedTree } from '../utils/outlineTree'; // 大纲树勾选唯一实现（曾 store 内 4 份逐字副本）
// 🔧 文本指纹哈希唯一实现（djb2，与生成端 useAiGenerator 的"文本是否变过"判定同源，曾各自复制导致字段对不上）
import { djb2 } from '../utils/hash';
// @ts-ignore - anchorTreeContract.js 无类型声明
import { resolveAnchorKind } from '../utils/anchorTreeContract'; // 🔬 (b) 条目性质判定唯一实现（显式 kind 优先 + 条目名兜底），落库归一与生成端同源

export { sanitizeFsName } from '../utils/libraryPathRepair';

interface ChapterNode {
  id?: string;
  title: string;
  start: number;
  end: number;
  selected?: boolean;
  analyzed?: boolean;
  rawText?: string;
  _rawTextHtml?: string;
  // 🔧 分析时原文的指纹/长度（生成端据此判定"文本是否变过"而决定启用/降级分析结果）
  _analyzedPlainTextLength?: number;
  _analyzedTextHash?: string;
  visualDescription?: string;
  formulas?: string[];
  coreTopics?: string;
  knowledgePoints?: string[];
  knowledgeHierarchy?: Array<{
    bigConcept: string;
    coreKnowledge?: Array<{
      // 🔬 条目性质：落库时由 store 统一补全（显式 kind 优先，缺失按条目名兜底 resolveAnchorKind），
      //    此字段必须声明在类型上，否则落库/展示/生成三处拿到的判定会分叉。
      kind?: string;
      name: string;
      level?: string;
      cognitiveLevel?: string;
      _corrected?: boolean;
      _originalLevel?: string;
      specificConcepts?: string[];
    }>;
  }>;
  competency?: string;
  _cognitiveCorrections?: Array<{
    bigConcept: string;
    knowledgeName: string;
    originalLevel: string;
    correctedLevel: string;
  }>;
  children?: ChapterNode[];
}

interface Textbook {
  id: string;
  title: string;
  subject?: string;
  stage?: string;
  grade?: string;
  selected?: boolean;
  outline?: ChapterNode[];
  [key: string]: unknown;
}

/** 工具函数：同步章节分析状态（向上+向下联动），供 loadTextbooks / saveTextbooks 共用 */
function applyAnalyzedSync(nodes: ChapterNode[]) {
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      applyAnalyzedSync(node.children);

      const hasOwnPage = node.children[0] && node.start < node.children[0].start;

      if (hasOwnPage && node.analyzed && node.rawText && node.rawText.trim().length > 0) {
        // 有独立页面且已分析，不联动子章节（如"第一单元"只分析导读，子课仍需独立分析）
        // 🧹 清理脏数据：子节点若被旧版 syncDownward 错误联动（analyzed=true 但无 rawText），重置
        for (const child of node.children) {
          if (child.analyzed && (!child.rawText || child.rawText.trim().length === 0)) {
            child.analyzed = false;
          }
        }
      } else if (!hasOwnPage) {
        if (!node.rawText || node.rawText.trim().length === 0) {
          // 无原文 → 父节点 analyzed 状态由子节点决定（向上联动）
          node.analyzed = node.children.every(child => child.analyzed);
        } else if (node.analyzed) {
          // 有原文且已分析 → 子条目都是叶子节点时，向下联动打钩
          const allChildrenAreLeaves = node.children.every(
            child => !child.children || child.children.length === 0
          );
          if (allChildrenAreLeaves) {
            for (const child of node.children) {
              if (!child.rawText || child.rawText.trim().length === 0) {
                child.analyzed = true;
                if (!child.knowledgePoints || child.knowledgePoints.length === 0) {
                  child.knowledgePoints = [...(node.knowledgePoints || [])];
                }
                if (!child.coreTopics) {
                  child.coreTopics = node.coreTopics || '';
                }
              }
            }
          }
        }
      }
    }
  }
}

/**
 * 🔧 教材路径自愈（修复旧版改名遗留与改名中途失败导致的路径错乱）：
 * - 旧改名遗留：旧版只改 name 不改 id/路径 → 磁盘文件仍在旧 id 名下、名称名下无冲突时，整体迁移到名称名下并对齐 id
 * - 改名中途失败：store 指向不存在的文件，但磁盘在名称名下或旧 id 名下存在 → 指针修复指向真实文件
 * 纯函数：fs 能力通过参数注入（便于单测）；无冲突、无文件时不产生任何副作用。
 * @returns 是否发生了变更
 */
export async function repairLegacyRename(
  book: Record<string, unknown>,
  // @ts-ignore - fs 结构定义在 libraryPathRepair.js 的 JSDoc 中
  fs: { pathExists: (p: string) => Promise<boolean>; moveFile: (s: string, t: string) => Promise<{ success?: boolean; error?: string }> },
  storagePath: string
): Promise<boolean> {
  return repairLibraryPaths(book, fs, storagePath, '教材库');
}

export const useTextbookStore = defineStore('textbook', {
  state: () => ({
    textbooks: [] as Textbook[],
    viewingBook: null as Textbook | null,
    viewingChapter: null as ChapterNode | null,
    showChapterAnalysis: false
  }),

  getters: {
    selectedCount: (state) => state.textbooks.filter(b => b.selected).length,

    selectedBooks: (state) => {
      return state.textbooks.filter(b => {
        if (!b.outline || b.outline.length === 0) return false;
        return hasAnySelectedTree(b.outline); // 大纲树勾选唯一实现 utils/outlineTree
      });
    },

    selectedChapterCount: (state) => {
      return state.textbooks.reduce((sum, b) => sum + countSelectedTree(b.outline), 0); // utils/outlineTree
    }
  },

  actions: {
    async loadTextbooks() {
      const saved = await storage.getItem<Textbook[]>('textbooks');
      if (saved) {
        // 🔑 存量数据回填 semester（从名称自动检测上下册）
        let hasChange = false;
        for (const b of saved) {
          const bName = b.name as string;
          if (!b.semester && bName) {
            if (bName.includes('上册')) { b.semester = '上册'; hasChange = true; }
            else if (bName.includes('下册')) { b.semester = '下册'; hasChange = true; }
            else if (!b.semester) { b.semester = ''; }
          }
          // 🔧 存储目录合并后，修复旧数据中的相对路径 → 绝对路径
          if (b.coverPath) { b.coverPath = resolveStoredPath(b.coverPath as string); hasChange = true; }
          if (b.pdfPath) { b.pdfPath = resolveStoredPath(b.pdfPath as string); hasChange = true; }
          if (b.imagesDir) { b.imagesDir = resolveStoredPath(b.imagesDir as string); hasChange = true; }
        }
        // 🔧 加载自愈：旧版改名只改 name、或改名中途移动失败导致 store 路径错乱 → 迁移/修复指针
        const hasElectronFs = !!(window as any).electronAPI?.existsPath;
        if (hasElectronFs) {
          const repairFs = {
            pathExists: async (p: string) => {
              try { return !!(await (window as any).electronAPI.existsPath(p)); } catch { return false; }
            },
            moveFile: async (s: string, t: string) => {
              try { return (await (window as any).electronAPI.moveFile(s, t)) || { success: false }; } catch { return { success: false }; }
            }
          };
          for (const b of saved) {
            try {
              if (await repairLegacyRename(b as unknown as Record<string, unknown>, repairFs, getStoragePath())) {
                hasChange = true;
              }
            } catch (e) {
              console.error('教材路径自愈失败:', e);
            }
          }
        }
        // 🔧 加载时同步联动：修复旧数据中父已分析但子未打钩的情况
        for (const b of saved) {
          if (b.outline) applyAnalyzedSync(b.outline);
        }
        // 🔧 旧版分析数据兼容：补齐缺失的 _analyzedTextHash / _analyzedPlainTextLength
        //    根因：2026.09 前版本保存分析时未持久化这两个字段，导致生成端误判"文本已变"→ 降级目录卡 → 教材原文检不到
        //    修复策略：加载时幂等回填，无需重新分析 AI（指纹是 rawText 的确定性派生，直接现算，成本为零）
        const backfillAnalyzedFingerprints = (nodes: ChapterNode[]) => {
          for (const node of nodes) {
            if (node.analyzed && node.rawText) {
              // 只在缺省时回填（幂等），已有的不覆盖（覆盖等于什么都没做）
              if (node._analyzedTextHash == null || node._analyzedPlainTextLength == null) {
                node._analyzedPlainTextLength = (node.rawText || '').length;
                node._analyzedTextHash = djb2(node.rawText || '');
                hasChange = true;
              }
            }
            if (node.children && node.children.length > 0) {
              backfillAnalyzedFingerprints(node.children);
            }
          }
        };
        for (const b of saved) {
          if (b.outline) backfillAnalyzedFingerprints(b.outline);
        }
        // 🔬 条目性质回填（2026-09-14，② 读盘归一）：`kind` 是"模型自觉输出"字段，实测常缺
        //    （英语单元走正文页分支、schema 早已带 kind，仍没吐）→ 旧分析结果的存储层里没有它，
        //    展示层就永远看不到「材料」标签、生成端也只能靠名字兜底。这里**读盘时幂等回填**
        //    （显式 kind 优先，缺失按 resolveAnchorKind 判，纯派生、成本为零），
        //    与落库归一、生成端同一判据 → 「分析的看的 = 存的 = 生成的」三处一致。
        const backfillAnchorKind = (nodes: ChapterNode[]) => {
          for (const node of nodes) {
            if (node.analyzed && Array.isArray(node.knowledgeHierarchy)) {
              for (const bc of (node.knowledgeHierarchy as any[])) {
                for (const ck of (bc?.coreKnowledge || [])) {
                  const k = resolveAnchorKind({ name: ck.name, kind: ck.kind });
                  if (ck.kind !== k) { ck.kind = k; hasChange = true; }
                }
              }
            }
            if (node.children && node.children.length > 0) backfillAnchorKind(node.children);
          }
        };
        for (const b of saved) {
          if (b.outline) backfillAnchorKind(b.outline);
        }
        // 🔧 完成回填 & 旧路径自愈后写回，后续不再做
        this.textbooks = saved;
        if (hasChange) await storage.setItem('textbooks', saved);
      }
    },

    async saveTextbooks() {
      this.textbooks.forEach(book => {
        if (book.outline) applyAnalyzedSync(book.outline);
      });
      await storage.setItem('textbooks', this.textbooks);
    },

    addTextbook(book: Textbook) {
      this.textbooks.push(book);
      this.saveTextbooks();
    },

    removeTextbook(id: string) {
      this.textbooks = this.textbooks.filter(b => b.id !== id);
      this.saveTextbooks();
    },

    updateTextbook(id: string, updates: Partial<Textbook>) {
      const idx = this.textbooks.findIndex(b => b.id === id);
      if (idx !== -1) {
        Object.assign(this.textbooks[idx], updates);
        this.saveTextbooks();
      }
    },

    toggleBookSelection(book: Textbook, checked: boolean) {
      book.selected = checked;
      if (book.outline && book.outline.length > 0) {
        this._setAllChapters(book.outline, checked);
      }
      this.saveTextbooks();
    },

    _setAllChapters(nodes: ChapterNode[], state: boolean) {
      nodes.forEach(node => {
        node.selected = state;
        if (node.children && node.children.length > 0) {
          this._setAllChapters(node.children, state);
        }
      });
    },

    syncBookSelection() {
      this.textbooks.forEach(book => {
        book.selected = this._isBookFullySelected(book);
      });
      this.saveTextbooks();
    },

    _isBookFullySelected(book: Textbook): boolean {
      if (!book.outline || book.outline.length === 0) return false;
      return hasAnySelectedTree(book.outline); // utils/outlineTree（曾内联逐字副本）
    },

    clearSelection() {
      this.textbooks.forEach(b => {
        b.selected = false;
        if (b.outline && b.outline.length > 0) {
          this._setAllChapters(b.outline, false);
        }
      });
      this.saveTextbooks();
    },

    openChapterAnalysis(book: Textbook, chapter: ChapterNode) {
      this.viewingBook = book;
      this.viewingChapter = chapter;
      this.showChapterAnalysis = true;
    },

    closeChapterAnalysis() {
      this.showChapterAnalysis = false;
    },

    /**
     * 🔬 条目性质·人工改判（2026-09-14 (b) 用户同意）：把某条第2层条目的 kind 显式写成
     * knowledge / material —— 与教材库同一条链、同一判据，没有第二套字段：
     *   `resolveAnchorKind` 的规则是**显式 kind 优先、缺失才按条目名兜底**，
     *   故"写显式值"本身就是人工改判，落库归一 / 读盘归一 / 生成端随卡投影 / 两个展示界面
     *   全部沿用同一判据 → 改一次即全链路生效（无需各界面各改一遍，也不会被兜底覆盖）。
     * 立即落盘：改判是带即时效果的纠正动作（下一份资料就按新判据分流）；若只留内存、
     *   关闭抽屉不点保存就丢，等于"看起来改了、其实没改"——正是本项目反复治理的那类坑。
     * @param ck 第2层条目对象（必须是 viewingChapter 同一对象图内的引用，就地写回）
     * @param kind 'knowledge' | 'material'
     */
    async setAnchorKind(ck: any, kind: 'knowledge' | 'material') {
      if (!ck || (kind !== 'knowledge' && kind !== 'material')) return;
      ck.kind = kind;
      await this.saveTextbooks();
      this.textbooks = [...this.textbooks]; // 触发引用更新（左树/抽屉同源刷新）
    },

    hasAnySelected(nodes?: ChapterNode[]): boolean {
      return hasAnySelectedTree(nodes); // utils/outlineTree（曾 store action 自实现副本）
    },

    getSelectedChapters(nodes?: ChapterNode[]): ChapterNode[] {
      if (!nodes) return [];
      const all: ChapterNode[] = [];
      const collect = (list: ChapterNode[]) => {
        for (const node of list) {
          if (node.selected) all.push(node);
          if (node.children) collect(node.children);
        }
      };
      collect(nodes);
      return all;
    },

    updateChaptersAnalysis(bookId: string, analysisResults: Array<{
      chapterRef: ChapterNode;
      rawText?: string;
      _rawTextHtml?: string;
      visualDescription?: string;
      formulasText?: string;
      coreTopics?: string;
      knowledgePointsText?: string;
      competency?: string;
      knowledgeHierarchy?: ChapterNode['knowledgeHierarchy'];
    }>) {
      const book = this.textbooks.find(b => b.id === bookId);
      if (!book) return;

      const markChildrenAnalyzed = (chapter: ChapterNode) => {
        if (!chapter.children || chapter.children.length === 0) return;
        for (const child of chapter.children) {
          if (child.start >= chapter.start && child.end <= chapter.end) {
            child.analyzed = true;
            if (!child.knowledgePoints || child.knowledgePoints.length === 0) {
              child.knowledgePoints = [...(chapter.knowledgePoints || [])];
            }
            if (!child.coreTopics) {
              child.coreTopics = chapter.coreTopics || '';
            }
            markChildrenAnalyzed(child);
          }
        }
      };

      for (const item of analysisResults) {
        const ch = item.chapterRef;
        if (!ch) continue;

        ch.rawText = item.rawText || '';
        ch._rawTextHtml = item._rawTextHtml || '';
        ch.visualDescription = item.visualDescription || '';
        ch.formulas = item.formulasText ? item.formulasText.split('\n').filter(f => f.trim()) : [];
        ch.coreTopics = item.coreTopics || '';
        ch.knowledgePoints = item.knowledgePointsText
          ? item.knowledgePointsText.split('\n').filter(k => k.trim())
          : (item.coreTopics ? item.coreTopics.split(',').map(t => t.trim()) : []);
        ch.competency = item.competency || '理解';
        if (item.knowledgeHierarchy) {
          // 🔬 (b) 落库归一（2026-09-14，② 全链路体检）：条目性质 kind 原先是"模型自觉输出字段"，
          //    实测导语页分支曾整段漏掉 → 存储里没有、展示层就永远没有标签、生成端也拿不到。
          //    这里在**唯一落库点**按同一判据补全（显式 kind 优先，缺失按条目名兜底 resolveAnchorKind），
          //    保证「分析结果展示 = 生成端 = 面板」三处看到的是同一份判定，不再分叉。
          ch.knowledgeHierarchy = item.knowledgeHierarchy.map((bc: any) => ({
            ...bc,
            coreKnowledge: (bc.coreKnowledge || []).map((ck: any) => ({
              ...ck,
              kind: resolveAnchorKind({ name: ck.name, kind: ck.kind }),
            })),
          }));
        }
        if (item.knowledgeHierarchy) {
          ch._cognitiveCorrections = [];
          for (const bc of item.knowledgeHierarchy) {
            for (const ck of (bc.coreKnowledge || [])) {
              if (ck._corrected) {
                ch._cognitiveCorrections.push({
                  bigConcept: bc.bigConcept,
                  knowledgeName: ck.name,
                  originalLevel: ck._originalLevel || '',
                  correctedLevel: ck.level || ck.cognitiveLevel || ''
                });
              }
            }
          }
        }
        ch.analyzed = true;
        // 🔧 现场补齐分析指纹：分析保存时若调用方未携带 hash/长度，则按本次落盘的 rawText 现算，
        //    确保持久化里始终有可判定的指纹。缺失时生成端会误判"文本已变"→ 降级目录卡 → 教材原文检不到。
        ch._analyzedPlainTextLength = (ch.rawText || '').length;
        ch._analyzedTextHash = djb2(ch.rawText || '');
      }

      const updateParentAnalyzed = (nodes: ChapterNode[]) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            updateParentAnalyzed(node.children);
            const hasOwnPage = node.children[0] && node.start < node.children[0].start;
            if (hasOwnPage) continue;
            if (node.rawText && node.rawText.trim().length > 0) continue;
            node.analyzed = node.children.every(child => child.analyzed);
          }
        }
      };
      if (book.outline) updateParentAnalyzed(book.outline);

      const syncDownward = (nodes: ChapterNode[]) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            // 先递归处理子节点
            syncDownward(node.children);

            // 🔧 父章节已分析 → 仅当父无独立页面（课级容器）且子条目都是叶子时才联动
            // hasOwnPage 守卫：与 applyAnalyzedSync 一致，避免单元分析错误联动子课
            if (node.analyzed && node.rawText && node.rawText.trim().length > 0) {
              const hasOwnPage = node.children[0] && node.start < node.children[0].start;
              if (!hasOwnPage) {
                const allChildrenAreLeaves = node.children.every(
                  child => !child.children || child.children.length === 0
                );
                if (allChildrenAreLeaves) {
                  for (const child of node.children) {
                    if (!child.rawText || child.rawText.trim().length === 0) {
                      child.analyzed = true;
                      if (!child.knowledgePoints || child.knowledgePoints.length === 0) {
                        child.knowledgePoints = [...(node.knowledgePoints || [])];
                      }
                      if (!child.coreTopics) {
                        child.coreTopics = node.coreTopics || '';
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };
      if (book.outline) syncDownward(book.outline);

      this.saveTextbooks();
    },

    getAnalysisStatus() {
      return this.textbooks
        .filter(b => this.hasAnySelected(b.outline))
        .map(book => {
          let cached = 0, newCount = 0;
          const selectedChapters = this.getSelectedChapters(book.outline || []);
          for (const chapter of selectedChapters) {
            const trulyAnalyzed = chapter.analyzed && (chapter.knowledgePoints?.length ?? 0) > 0 && (chapter.rawText?.length ?? 0) > 0;
            if (trulyAnalyzed) {
              cached++;
            } else {
              newCount++;
            }
          }
          return {
            ...book,
            cached,
            new: newCount,
            selectedChapters
          };
        });
    }
  }
});
