import { defineStore } from 'pinia';
import storage from '../utils/storage';
import { uploadTemplates } from '../utils/cloudStorage';

export const useTemplateStore = defineStore('template', {
  state: () => ({
    templates: [],
    viewingBook: null,
    viewingChapter: null,
    showChapterAnalysis: false
  }),

  getters: {
    // 已选中的模板数量
    selectedCount: (state) => state.templates.filter(t => t.selected).length,

    // 获取已选中的模板（带章节）
    selectedTemplates: (state) => {
      return state.templates.filter(t => {
        if (!t.outline || t.outline.length === 0) return t.selected;
        const hasAnySelected = (nodes) => {
          for (const node of nodes) {
            if (node.selected) return true;
            if (node.children && node.children.length > 0) {
              if (hasAnySelected(node.children)) return true;
            }
          }
          return false;
        };
        return t.selected || hasAnySelected(t.outline);
      });
    },

    // 获取已选中的章节数量
    selectedChapterCount: (state) => {
      const countRecursive = (nodes) => {
        if (!nodes) return 0;
        let count = 0;
        for (const node of nodes) {
          if (node.selected) count++;
          if (node.children) count += countRecursive(node.children);
        }
        return count;
      };
      return state.templates.reduce((sum, t) => sum + countRecursive(t.outline), 0);
    }
  },

  actions: {
    async loadTemplates() {
      const saved = await storage.getItem('templates');
      if (saved) {
        // 🔑 存量数据回填 semester（从名称自动检测上下册）
        let hasChange = false;
        for (const t of saved) {
          if (!t.semester && t.name) {
            if (t.name.includes('上册')) { t.semester = '上册'; hasChange = true; }
            else if (t.name.includes('下册')) { t.semester = '下册'; hasChange = true; }
            else if (!t.semester) { t.semester = ''; }
          }
        }
        this.templates = saved;
        if (hasChange) await storage.setItem('templates', saved);
      }
    },

    async saveTemplates() {
      // 🔧 storage.setItem 已内置体积检查（>10MB 自动警告），但仍建议后续优化：
      // questionCards只保留前20道，完整题卡按需加载
      // 保存前更新所有模板的父级分析状态
      const updateParentAnalyzed = (nodes) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            updateParentAnalyzed(node.children);
            // 🔧 修复：类似教材逻辑，有自己原文的父级不联动
            // 避免丢弃分析后父级又被子节点标记为已分析
            if (node.rawText && node.rawText.trim().length > 0) {
              // 有独立原文 → 自己的状态由自己决定，不联动子节点
            } else {
              // 纯组织节点 → 由子节点状态决定
              node.analyzed = node.children.every(child => child.analyzed);
            }
          }
        }
      };
      this.templates.forEach(tpl => {
        if (tpl.outline) updateParentAnalyzed(tpl.outline);
      });
      await storage.setItem('templates', this.templates);
      // ☁️ 同步到云端（fire-and-forget，不阻塞本地操作）
      uploadTemplates(this.templates).catch(() => {});
    },

    addTemplate(tpl) {
      this.templates.push(tpl);
      this.saveTemplates();
    },

    removeTemplate(id) {
      this.templates = this.templates.filter(t => t.id !== id);
      this.saveTemplates();
    },

    updateTemplate(id, updates) {
      const idx = this.templates.findIndex(t => t.id === id);
      if (idx !== -1) {
        Object.assign(this.templates[idx], updates);
        this.saveTemplates();
      }
    },

    // 切换整本模板的勾选状态
    toggleTemplateSelection(tpl, checked) {
      tpl.selected = checked;
      if (tpl.outline && tpl.outline.length > 0) {
        this._setAllChapters(tpl.outline, checked);
      }
      this.saveTemplates();
    },

    // 递归设置所有章节的勾选状态
    _setAllChapters(nodes, state) {
      nodes.forEach(node => {
        node.selected = state;
        if (node.children && node.children.length > 0) {
          this._setAllChapters(node.children, state);
        }
      });
    },

    // 同步整本模板的勾选状态（子章节变化后调用）
    syncTemplateSelection() {
      this.templates.forEach(tpl => {
        tpl.selected = this._isTemplateFullySelected(tpl);
      });
      this.saveTemplates();
    },

    // 检查整本模板是否所有章节都被勾选
    _isTemplateFullySelected(tpl) {
      if (!tpl.outline || tpl.outline.length === 0) return false;
      const hasAnySelected = (nodes) => {
        for (const node of nodes) {
          if (node.selected) return true;
          if (node.children && node.children.length > 0) {
            if (hasAnySelected(node.children)) return true;
          }
        }
        return false;
      };
      return hasAnySelected(tpl.outline);
    },

    // 取消所有选择
    clearSelection() {
      this.templates.forEach(t => {
        t.selected = false;
        // 🔧 修复：同时清除所有章节的勾选
        if (t.outline && t.outline.length > 0) {
          this._setAllChapters(t.outline, false);
        }
      });
      this.saveTemplates();
    },

    // 章节分析查看
    openChapterAnalysis(book, chapter) {
      this.viewingBook = book;
      this.viewingChapter = chapter;
      this.showChapterAnalysis = true;
    },

    closeChapterAnalysis() {
      this.showChapterAnalysis = false;
    },

    // 检查是否有任何选中的章节
    hasAnySelected(nodes) {
      if (!nodes) return false;
      for (const node of nodes) {
        if (node.selected) return true;
        if (node.children && this.hasAnySelected(node.children)) return true;
      }
      return false;
    },

    // 获取选中的章节列表
    getSelectedChapters(nodes) {
      if (!nodes) return [];
      let result = [];
      for (const node of nodes) {
        if (node.selected) result.push(node);
        if (node.children) result = result.concat(this.getSelectedChapters(node.children));
      }
      return result;
    },
        /**
     * 🔧 改进4：保存模板分析结果
     * @param {string} tplId - 模板ID
     * @param {object} analysisData - 分析数据 { rawText, structureText, scoreDistribution, questionStyle, difficultyLevel }
     */
    saveTemplateAnalysis(tplId, analysisData) {
      const tpl = this.templates.find(t => t.id === tplId);
      if (!tpl) return;
      
      tpl.analysis = {
        rawText: analysisData.rawText || '',
        _rawTextHtml: analysisData._rawTextHtml || '',
        // 旧字段名（向后兼容 callAI 中的读取）
        structure: analysisData.结构分析 || [],
        scoreDistribution: '',
        questionStyle: '',
        difficultyLevel: '',
        questionCount: analysisData.总题数 || 0,
        totalScore: analysisData.总分 || 0,
        questionCards: analysisData.questionCards || [],
        // 新字段名
        结构分析: analysisData.结构分析 || [],
        总题数: analysisData.总题数 || 0,
        总分: analysisData.总分 || 0,
        // 语言/格式指纹
        languageStyle: analysisData.languageStyle || null,
        formatStyle: analysisData.formatStyle || null,
        ocrQuality: analysisData.ocrQuality || 'unknown',
        typeLanguageProfiles: this._buildTypeLanguageProfiles(analysisData.questionCards || [])
      };
      
      // 标记已选章节为已分析，并保存章节级原文
      const chapters = this.getSelectedChapters(tpl.outline || []);
      chapters.forEach(ch => { 
        ch.analyzed = true;
        if (analysisData.rawText && !ch.rawText) {
          ch.rawText = analysisData.rawText;
        }
      });
      
      // 向上更新所有父级章节的分析状态
      const updateParentAnalyzed = (nodes) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            updateParentAnalyzed(node.children);
            node.analyzed = node.children.every(child => child.analyzed);
          }
        }
      };
      updateParentAnalyzed(tpl.outline);
      
      this.saveTemplates();
    },

    /**
     * 🔧 P2新增：按题型分类构建语言特征
     * 解决"选择题和解答题的句式被混在一起"的问题
     */
    _buildTypeLanguageProfiles(questionCards) {
      if (!questionCards || questionCards.length === 0) return {};
      
      const profiles = {};
      const cardsByType = {};
      
      // 按题型分组
      for (const card of questionCards) {
        const type = card.type || '未知题型';
        if (!cardsByType[type]) cardsByType[type] = [];
        cardsByType[type].push(card);
      }
      
      // 每组独立计算语言特征
      for (const [type, cards] of Object.entries(cardsByType)) {
        const stems = cards.filter(c => c.stem).map(c => c.stem);
        if (stems.length === 0) continue;
        
        // 平均句长
        const avgStemLength = Math.round(stems.reduce((s, stem) => s + stem.length, 0) / stems.length);
        
        // 高频开头句式（取题干前10个字作为"句式指纹"）
        const openingPatterns = {};
        for (const stem of stems) {
          const opening = stem.substring(0, 10).replace(/^\d+[\.、．]\s*/, '');
          openingPatterns[opening] = (openingPatterns[opening] || 0) + 1;
        }
        const commonPatterns = Object.entries(openingPatterns)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([pattern]) => pattern);
        
        // 引导词使用比例
        const hasPlease = stems.filter(s => s.includes('请')).length;
        const hasTry = stems.filter(s => s.includes('试')).length;
        const hasKnown = stems.filter(s => s.includes('已知')).length;
        
        // 选项数量（仅选择题）
        let avgOptions = 0;
        if (type === '选择题') {
          const optionCounts = cards
            .filter(c => c.options?.length)
            .map(c => c.options.length);
          avgOptions = optionCounts.length > 0
            ? Math.round(optionCounts.reduce((a, b) => a + b, 0) / optionCounts.length)
            : 4;
        }
        
        profiles[type] = {
          avgStemLength,
          commonPatterns,
          hasPlease: hasPlease > 0,
          hasTry: hasTry > 0,
          hasKnown: hasKnown > 0,
          avgOptions: avgOptions > 0 ? avgOptions : undefined,
          sampleStem: stems[0]?.substring(0, 80) || ''
        };
      }
      
      return profiles;
    },

    /**
     * 🔧 改进4：获取需要分析的模板统计
     */
    getTemplateAnalysisStatus() {
      return this.templates
        .filter(t => t.selected || this.hasAnySelected(t.outline))
        .map(tpl => {
          let cached = 0, newCount = 0;
          let allChapters = this.getSelectedChapters(tpl.outline || []);
          // 分析时只处理叶子节点，父级章节由子章节状态决定
          allChapters = allChapters.filter(ch => 
            !ch.children || ch.children.length === 0
          );
          for (const chapter of allChapters) {
            if (chapter.analyzed) cached++;
            else newCount++;
          }
          return { 
            ...tpl, 
            cached, 
            new: newCount,
            selectedChapters: allChapters
          };
        });
    }
  }
});