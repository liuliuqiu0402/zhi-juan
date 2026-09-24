import { defineStore } from 'pinia';
import storage from '../utils/storage';
// @ts-ignore - pathHelper.js 无类型声明
import { resolveStoredPath, getStoragePath } from '../utils/pathHelper';
// @ts-ignore - libraryPathRepair.js 无类型声明
import { repairLibraryPaths } from '../utils/libraryPathRepair';
// @ts-ignore - outlineTree.js 无类型声明
import { hasAnySelected as hasAnySelectedTree, countSelected as countSelectedTree, getSelected as getSelectedTree } from '../utils/outlineTree'; // 大纲树勾选唯一实现（曾 store 内 4 份逐字副本）
// 🔧 文本指纹哈希唯一实现（djb2，与生成端 useAiGenerator 的"文本是否变过"判定同源，曾各自复制导致字段对不上）
import { djb2 } from '../utils/hash';
// @ts-ignore - anchorTreeContract.js 无类型声明
import { resolveAnchorKind } from '../utils/anchorTreeContract'; // 🔬 (b) 条目性质判定唯一实现（显式 kind 优先 + 条目名兜底），落库归一与生成端同源
// @ts-ignore - textbookMeta.js 无类型声明
import { autoDetectTextbookMeta } from '../utils/textbookMeta'; // 存量数据回填高中册次（与导入识别同源，避免两套判据）

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
  /** 高中「册次」（必修N / 选择性必修N / 必修上…）。高中教材按必修·选择性必修分册、不绑定年级，
   *  故高中 grade 留空、册次落此字段；非高中为空。见 config/highVolumes。 */
  volume?: string;
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
    },

    /** 🧭 生成指令失效签名·教材侧（2026-09-18 用户裁定："勾选的教材变化时，也自动清空"）
     * ============================================================
     * 把"当前勾选的教材集合"折叠为一个字符串，供生成页 watch（指令失效源）直接引用。
     *  🔴 为什么需要它：原 watch 源只列"有章节被勾选"的教材（`filter(hasAnySelected(outline))`），
     *     若某教材**被勾选但 outline 为空**（未提取章节/目录模式），勾选前后签名字符串不变 →
     *     指令不被清空，而它所依据的教材已经变了。用户原话即"勾选的教材变化时清空"。
     *  口径：教材级勾选位 `b.selected` 与"任一章被勾选"取并集（都算"勾了这本"），并计入
     *      id/学段/学科/年级/教材级勾选位/章节清单（章节以 `标题@起点` 定位——改名换起点也算变化）。
     *     相对原串只多不少：多的是"勾了但没有章节"的教材与教材级勾选位这一维。
     *   🔴 2026-09-20 补入册次：高中改用「册次」维度后，年级恒为空，若签名仍只看 grade，
     *      "换一本同科同段的书"（如高中英语必修1 → 选择性必修2）签名不变 → 指令不被清空，而依据的教材已换。
     */
    instructionBookSignature: (state) => state.textbooks
      .filter(b => b.selected || hasAnySelectedTree(b.outline))
      .map(b => `${b.id}|${b.stage}|${b.subject}|${b.grade}|${b.volume || ''}|${b.selected ? 1 : 0}|${getSelectedTree(b.outline).map(c => `${c.title}@${c.start}`).join(',')}`)
      .join(';')
  },

  actions: {
    async loadTextbooks() {
      const saved = await storage.getItem<Textbook[]>('textbooks');
      if (saved) {
        // 🔑 存量数据回填 semester（从名称自动检测上下册）
        let hasChange = false;
        for (const b of saved) {
          const bName = b.name as string;
          const d = bName ? autoDetectTextbookMeta(bName) : null;
          const bStage = String(b.stage || '');
          // 🔑 "是否高中"只看 stage 或文件识别的 stage，不能只看文件名里的"必修"字样（"高二英语.pdf"无该字样会漏判）。
          const isHighBook = bStage === '高中' || bStage === 'high' || d?.stage === '高中';
          // 上下册仅适用小学/初中：高中按册次，不沿用也不回填上下册。
          //   🔴 存量里"思想政治必修（上册）"这类 高中 记录的 semester 是"上册"名字的一部分，不是学期 → 一律清空。
          if (isHighBook) {
            if (b.semester) { b.semester = ''; hasChange = true; }
          } else if (!b.semester && bName) {
            if (bName.includes('上册')) { b.semester = '上册'; hasChange = true; }
            else if (bName.includes('下册')) { b.semester = '下册'; hasChange = true; }
          }
          // 🔑 存量数据回填 volume + 清高中遗留年级（2026-09-20「高中按册次、不按年级」）。
          //    🔴 两处判据都要放宽/收紧，否则迁移不完整或丢信息：
          //    ① 判"这本是高中"**不能只看文件名**——"高二英语.pdf""英语选修7.pdf"不含"必修/高中"字样，
          //       只看名字就漏迁移（老记录会一直带着"高二"违反新口径）→ 加上记录自身 stage
          //       （新数据存中文'高中'，旧数据存英文'high'，见 TextbookModule 入库的 stageMap 注释）；
          //    ② 清年级**要先确认拿到了册次**——册次才是替代品，识别不到册次就把年级一并抹掉，
          //       只会让这本教材"改版后反而没了任何标识"（比改版前更糟）。
          //       没有册次的保留旧年级做兜底显示（gradeDisplayLabel 以册次优先），
          //       用户在教材库用卡片上的「🏷️ 编辑元数据」按钮补上即可（学段/学科/册次一起改）。
          if (isHighBook) {
            if (d?.volume && b.volume !== d.volume) { b.volume = d.volume; hasChange = true; }
            if (b.volume && b.grade) { b.grade = ''; hasChange = true; }
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
      return getSelectedTree(nodes) as ChapterNode[]; // utils/outlineTree（唯一实现；本处内联副本 2026-09-18 上收）
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

      // 🔴 空值不覆盖（2026-09-24 用户定）：这一轮拿不到内容，就**保留旧内容**。
      //    防的是"分析失败返回空 → 旧原文/旧结果被静默清空"——原文丢了要重新 OCR 才回得来。
      //    要清空章节请走界面上的显式清空（那是明确的动作），不靠"这次跑空了"来清。
      //    明确接受的代价：某字段这轮**确实**该为空时也会保留旧值，需要时手动清。
      const hasText = (v: any) => String(v ?? '').trim().length > 0;
      const hasList = (v: any) => Array.isArray(v) && v.length > 0;
      const keptText = (next: any, prev: any) => (hasText(next) ? String(next) : (prev || ''));
      const keptList = (next: any, prev: any) => (hasList(next) ? next : (prev || []));

      for (const item of analysisResults) {
        const ch = item.chapterRef;
        if (!ch) continue;

        // 第一道：**整条结果都空**（典型就是分析失败、被兜底成空）→ 整章一个字段都不动，
        //        也**不把 analyzed 标成 true**（否则会显得"分析过了"，实际没内容）。
        const produced = hasText(item.rawText) || hasText(item._rawTextHtml)
          || hasText(item.visualDescription) || hasText(item.formulasText)
          || hasText(item.coreTopics) || hasText(item.knowledgePointsText)
          || hasList(item.knowledgeHierarchy);
        if (!produced) {
          console.warn(`[教材库] 章节「${ch.title}」本轮分析没有任何产出 → 保留原内容不动（防静默清空）`);
          continue;
        }

        // 第二道：逐字段——空值保留旧值，绝不用空值回填
        ch.rawText = keptText(item.rawText, ch.rawText);
        ch._rawTextHtml = keptText(item._rawTextHtml, ch._rawTextHtml);
        ch.visualDescription = keptText(item.visualDescription, ch.visualDescription);
        ch.formulas = keptList(
          item.formulasText ? item.formulasText.split('\n').filter(f => f.trim()) : [],
          ch.formulas);
        ch.coreTopics = keptText(item.coreTopics, ch.coreTopics);
        ch.knowledgePoints = keptList(
          item.knowledgePointsText
            ? item.knowledgePointsText.split('\n').filter(k => k.trim())
            : (item.coreTopics ? item.coreTopics.split(',').map(t => t.trim()) : []),
          ch.knowledgePoints);
        // 空 → 保留旧判定（别静默退回默认的「理解」）；本来就没有时仍给默认
        const compNext = String(item.competency ?? '').trim();
        ch.competency = compNext || ch.competency || '理解';
        if (item.knowledgeHierarchy && item.knowledgeHierarchy.length > 0) {
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
        if (item.knowledgeHierarchy && item.knowledgeHierarchy.length > 0) {
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
