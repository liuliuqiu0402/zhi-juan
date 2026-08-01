<template>
  <div class="generate-module">
    <!-- 顶部配置栏 -->
    <div class="config-ribbon">
      <div class="ribbon-left">
        <button class="ribbon-btn" @click="showScopeModal = true">
          📐 {{ scopeTypeLabel }}
        </button>
        <button class="ribbon-btn" @click="showStyleModal = true">
          🎨 {{ styleLabel }}
        </button>
        <button class="ribbon-btn" @click="showGenTypeModal = true">
          📂 {{ genTypeLabel }}
        </button>
        <button v-if="showSpecialSubType" class="ribbon-btn ribbon-btn-special" @click="showSpecialSubTypeModal = true">
          🎯 {{ specialSubTypeLabel || '选择专项领域' }}
        </button>
        <button class="ribbon-btn" @click="showGranularityModal = true">
          📏 {{ granularityLabel }}
        </button>
        <button class="ribbon-btn" @click="showDetailConfigModal = true">
          📝 详细配置
        </button>
        <button class="ribbon-btn ribbon-btn-sync" @click="syncPage" title="同步：桌面拉双向2类→合并→推回 | 手机拉7类全量→合并双向→推回">
          ☁️
        </button>
        <button class="ribbon-btn ribbon-btn-upload" @click="uploadPage" title="上推：桌面7类全量 | 手机仅双向2类">
          📤
        </button>
        <button class="ribbon-btn ribbon-btn-refresh" @click="refreshPage" title="重置任务：清空当前所有操作，恢复初始状态">
          🔄
        </button>
        <!-- 📱 移动端模型状态 -->
        <span v-if="isMobile" class="mobile-model-chip" :class="{ 'mobile-chip-error': deepseekStatus === 'error', 'mobile-chip-checking': deepseekStatus === 'checking' }" :title="deepseekStatus === 'error' ? '⚠️ ' + deepseekStatusMsg : (apiConfig.currentEngine === 'deepseek' ? `✅ 已就绪 | 生成:${currentModelSummary.heavy} / 分析:${currentModelSummary.light}` : currentModelSummary.heavy)">
          <span class="chip-dot" :class="apiConfig.currentEngine === 'deepseek' ? (deepseekStatus === 'ready' ? 'dot-ready' : deepseekStatus === 'checking' ? 'dot-checking' : 'dot-error') : 'dot-ollama'"></span>
          {{ deepseekStatus === 'checking' ? '检测中...' : deepseekStatus === 'error' ? '⚠️ 未就绪' : (apiConfig.currentEngine === 'deepseek' ? currentModelSummary.heavy.split('-').pop() + '+' + currentModelSummary.light.split('-').pop() : currentModelSummary.heavy) }}
        </span>
      </div>
      <div class="ribbon-right">
        <div v-if="genTypeModelHint" class="model-recommend-badge">
          <span class="badge-icon">{{ genTypeModelHint.icon }}</span>
          <span class="badge-model">{{ genTypeModelHint.model }}</span>
          <span class="badge-tip">{{ genTypeModelHint.tip }}</span>
        </div>
        <div class="model-config-chip" :title="deepseekStatus === 'error' ? '⚠️ ' + deepseekStatusMsg : (currentModelSummary.review ? `重型:${currentModelSummary.heavy}\n轻量:${currentModelSummary.light}\n分析:${currentModelSummary.analysis}\n审查:${currentModelSummary.review}` : apiConfig.currentEngine === 'deepseek' ? `生成:${currentModelSummary.heavy}\n分析:${currentModelSummary.light}` : `重型:${currentModelSummary.heavy}\n轻量:${currentModelSummary.light}\n分析:${currentModelSummary.analysis}`)">
          <span class="chip-dot" :class="apiConfig.currentEngine === 'deepseek' ? (deepseekStatus === 'ready' ? 'dot-ready' : deepseekStatus === 'checking' ? 'dot-checking' : 'dot-error') : 'dot-ollama'"></span>
          <span class="chip-label">{{ currentModelSummary.engine === '🦙 Ollama' ? '本地' : '云端' }}</span>
          <span class="chip-sep">·</span>
          <span class="chip-model">{{ apiConfig.currentEngine === 'deepseek' ? currentModelSummary.heavy + ' + ' + currentModelSummary.light : currentModelSummary.heavy }}</span>
          <span v-if="deepseekStatus === 'error'" class="chip-status-err" :title="deepseekStatusMsg">⚠️</span>
        </div>
        <button class="ribbon-btn" @click="saveToInstructionLib">
          💾 保存到指令库
        </button>
      </div>
    </div>

    <!-- 📱 移动端 Tab 切换栏 -->
    <div v-if="isMobile" class="mobile-gen-tabs">
      <div class="gen-tab" :class="{ active: mobileGenTab === 'select' }" @click="mobileGenTab = 'select'">
        📋 已选<span v-if="selectedTextbookCount" class="gen-tab-badge">{{ selectedTextbookCount }}</span>
      </div>
      <div class="gen-tab" :class="{ active: mobileGenTab === 'instruct' }" @click="mobileGenTab = 'instruct'">
        📝 指令
      </div>
      <div class="gen-tab" :class="{ active: mobileGenTab === 'result' }" @click="mobileGenTab = 'result'">
        📄 结果<span v-if="generatedDocs.length" class="gen-tab-badge">{{ generatedDocs.length }}</span>
      </div>
    </div>

    <!-- 主工作区 -->
    <div class="main-workspace" :class="{ 'mobile-workspace': isMobile }">
      <!-- 左侧：已选摘要面板 -->
      <div class="selection-panel" v-show="!isMobile || mobileGenTab === 'select'">
        <!-- 已选教材 -->
        <div class="panel-section">
          <div class="section-header" @click="toggleSection('textbook')">
            <span>{{ sectionCollapsed.textbook ? '▶' : '▼' }}</span>
            <span>📚 已选教材章节</span>
            <span class="selected-count">{{ selectedTextbookCount }}</span>
            <span class="analysis-toggle-all" @click.stop="toggleAllForAnalysis('textbook')" title="切换全选/取消分析勾选">{{ allTextbookSelectedForAnalysis ? '☑' : '☐' }}</span>
          </div>
          <div v-show="!sectionCollapsed.textbook" class="section-content">
            <div v-if="selectedTextbookCount === 0" class="empty-tip-small">
              <span>请先在教材库中勾选章节</span>
            </div>
            <template v-for="(book, index) in textbookStore.textbooks" :key="book?.id || index">
              <div v-if="book && book.outline && hasAnySelected(book.outline)" class="summary-book">
                <div class="summary-book-name">
                  {{ book.name }}
                  <span class="remove-btn" @click="removeSelectedBook(book)" title="取消该书所有勾选">✕</span>
                </div>
                <div class="summary-chapter-list">
                  <div v-for="chapter in getSelectedChapters(book.outline)" :key="chapter.title" class="summary-chapter">
                    <input type="checkbox" v-model="chapter._selectedForAnalysis" :checked="chapter._selectedForAnalysis !== false" class="analysis-checkbox" title="勾选要分析的章节" />
                    <span class="chapter-title" @click="isLeafChapter(chapter) && viewChapterAnalysis(book, chapter)" :style="{ cursor: isLeafChapter(chapter) ? 'pointer' : 'default', textDecoration: isLeafChapter(chapter) ? 'underline' : 'none', color: isLeafChapter(chapter) ? 'var(--primary-light)' : '#555' }">
                      {{ chapter.title }}
                      <span v-if="chapter.analyzed" style="color:var(--success);font-size:11px;"title="已分析">✅</span>
                      <span v-else style="color:#ccc;font-size:11px;"title="未分析">⬜</span>
                    </span>
                    <span class="page-range">第{{ chapter.start }}-{{ chapter.end }}页</span>
                    <span class="remove-btn" @click="removeSelectedChapter(book, chapter)" title="取消选择">✕</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 已选模板 -->
        <div class="panel-section">
          <div class="section-header" @click="toggleSection('template')">
            <span>{{ sectionCollapsed.template ? '▶' : '▼' }}</span>
            <span>📋 已选模板</span>
            <span class="selected-count">{{ selectedTemplateCount }}</span>
            <span class="analysis-toggle-all" @click.stop="toggleAllForAnalysis('template')" title="切换全选/取消分析勾选">{{ allTemplateSelectedForAnalysis ? '☑' : '☐' }}</span>
          </div>
          <div v-show="!sectionCollapsed.template" class="section-content">
            <div v-if="selectedTemplateCount === 0" class="empty-tip-small">
              请先在模板库中勾选模板
            </div>
            <div v-for="(tpl, index) in templateStore.templates.filter(t => t?.selected)" :key="tpl?.id || index" class="summary-book">
              <div class="summary-book-name">
                {{ tpl?.name }}
                <span class="remove-btn" @click="removeSelectedBook(tpl)" title="取消该模板所有勾选">✕</span>
              </div>
              <div class="summary-chapter-list">
                <div v-for="chapter in getSelectedChapters(tpl?.outline || [])" :key="chapter.title" class="summary-chapter">
                  <input type="checkbox" v-model="chapter._selectedForAnalysis" :checked="chapter._selectedForAnalysis !== false" class="analysis-checkbox" title="勾选要分析的章节" />
                  <span class="chapter-title" @click="isLeafChapter(chapter) && viewChapterAnalysis(tpl, chapter)" :style="{ cursor: isLeafChapter(chapter) ? 'pointer' : 'default', textDecoration: isLeafChapter(chapter) ? 'underline' : 'none', color: isLeafChapter(chapter) ? 'var(--primary-light)' : '#555' }">
                    {{ chapter.title }}
                    <span v-if="chapter.analyzed" style="color:var(--success);font-size:11px;"title="已分析">✅</span>
                    <span v-else style="color:#ccc;font-size:11px;"title="未分析">⬜</span>
                  </span>
                  <span class="page-range">第{{ chapter.start }}-{{ chapter.end }}页</span>
                  <span class="remove-btn" @click="removeSelectedChapter(tpl, chapter)" title="取消选择">✕</span>
                </div>
              </div>
            </div>
          </div>
        </div>  
        </div>            

      <!-- 中间：指令编辑区 -->
      <div class="instruction-panel" v-show="!isMobile || mobileGenTab === 'instruct'">
        <div class="panel-header">
          <h3>📝 生成指令</h3>
          <div class="header-actions">
            <button class="btn-primary" @click="buildInstruction">🔧 生成指令</button>
            <button class="btn" @click="clearInstruction">🗑️ 清空</button>
            <button class="btn" @click="analyzeTextbook" v-if="!isMobile">🔍 分析教材</button>
            <button class="btn" @click="analyzeTemplate" v-if="!isMobile">🔍 分析模板</button>
            <span class="analyze-model-hint" title="知识点结构化分析推荐模型，在设置→分析提取模型中配置">📚 glm4:9b</span>
          </div>
        </div>
        <textarea v-model="instructionDraft" placeholder="点击「生成指令」根据勾选内容自动构建，或直接手动输入..." class="instruction-textarea"></textarea>
        
        <div v-if="previewHint" class="preview-hint">
          <span>{{ previewHint }}</span>
        </div>
        
        <div v-if="analysisResult" class="analysis-result">
          <div class="analysis-header">
            <span>📊 素材分析结果</span>
            <button class="icon-btn" @click="analysisResult = null">✕</button>
          </div>
          <div class="analysis-content">
            <div v-if="analysisResult.textbook">
              <strong>教材分析：</strong>
              <p>知识点：{{ analysisResult.textbook.knowledgePoints?.join('、') || '暂无' }}</p>
              <p>能力层次：{{ analysisResult.textbook.competency || '暂无' }}</p>
            </div>
            <div v-if="analysisResult.template">
              <strong>模板分析：</strong>
              <p>题型结构：{{ analysisResult.template.structure || '暂无' }}</p>
              <p>分值分布：{{ analysisResult.template.scoreDistribution || '暂无' }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：生成和结果区 -->
      <div class="result-panel" v-show="!isMobile || mobileGenTab === 'result'">
        <div class="generate-actions" v-if="!isMobile">
          <button class="btn-success" @click="generate('single')" :disabled="!instructionDraft || isGenerating">📄 单生成</button>
          <button class="btn-success" @click="generate('multiple')" :disabled="!instructionDraft || isGenerating || genTypes.length < 2">📚 复生成 ({{ genTypes.length }}个)</button>
          <button class="btn-cancel" @click="handleCancelOrRelease">
            {{ isGenerating ? '❌ 取消生成' : '🧹 释放显存' }}
          </button>
        </div>

        <div v-if="isGenerating" class="generating-tip">
          <span>{{ generateStatus }}</span>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: generateProgress + '%' }"></div></div>
        </div>

        <!-- 🔧 多课时结果 tabs -->
        <div v-if="multiPeriodResults && multiPeriodResults.periods && multiPeriodResults.periods.length > 1" class="period-tabs">
          <div class="period-tab-bar">
            <button 
              :class="['period-tab', { active: activePeriodTab === -1 }]"
              @click="switchPeriodTab(-1)"
              title="查看合并版完整内容"
            >📦 全部</button>
            <button
              v-for="(p, pi) in multiPeriodResults.periods"
              :key="p.periodName"
              :class="['period-tab', { active: activePeriodTab === pi }]"
              @click="switchPeriodTab(pi)"
              :title="`${p.periodName}：${p.kpCount}个知识点`"
            >
              <span class="period-tab-label">{{ p.periodName }}</span>
              <span class="period-tab-kp">{{ p.kpCount }}KP</span>
            </button>
          </div>
          <div class="period-tab-actions">
            <button class="btn-small" @click="closePeriodTabs" title="收起课时视图">✕ 收起</button>
          </div>
        </div>

        <div class="result-header">
          <span>📋 结果 ({{ generatedDocs.length }})</span>
          <span class="select-all" @click="toggleSelectAll">{{ allSelected ? '取消全选' : '全选' }}</span>
          <span class="batch-delete" @click="batchDeleteDocs" v-if="selectedCount > 0">🗑️ 批量删除</span>
        </div>

        <div class="result-list">
          <div v-if="displayedDocs.length === 0" class="empty-tip">暂无生成结果</div>
          <div v-for="(doc, idx) in displayedDocs" :key="doc.id" class="result-item" :class="getQualityClass(doc.quality)">
            <div class="result-row">
              <input type="checkbox" v-model="doc.selected" />
              <div class="result-info" @click="previewDoc(doc)">
                <div v-if="doc.confidenceMarks && doc.confidenceMarks.length > 0" class="confidence-warning">
                  <span v-for="(mark, idx) in doc.confidenceMarks.slice(0, 2)" :key="idx" :title="mark.message">
                    ⚠️ {{ mark.keyword }}
                  </span>
                  <span v-if="doc.confidenceMarks.length > 2" class="more-marks">
                    等{{ doc.confidenceMarks.length }}项提醒
                  </span>
                </div>
                <div class="result-title">{{ doc.title }}</div>
                <div class="result-meta">
                  {{ doc.genType }}<template v-if="doc.style"> | {{ doc.style }}</template>
                  <span v-if="doc.difficulty" class="difficulty-tag">
                    🟢 {{ doc.difficulty.easy }}% · 🟡 {{ doc.difficulty.medium }}% · 🔴 {{ doc.difficulty.hard }}%
                  </span>
                </div>
                <!-- ✨ 新增：质量报告摘要 -->
                <div v-if="doc.qualityReport" class="quality-summary">
                  <span v-if="doc.qualityReport.aiReview?.details?.length" class="quality-item" :class="{ 'quality-warn': !doc.qualityReport.aiReview.passed }">
                    🤖 评分：{{ doc.qualityReport.aiReview.details.find(d => d.includes('综合评分')) || '' }}
                  </span>
                </div>
                <!-- ✨ 新增：issues警告 -->
                <div v-if="doc.issues && doc.issues.length > 0" class="issues-summary">
                  <span v-for="(issue, iIdx) in doc.issues.slice(0, 2)" :key="iIdx" class="issue-tag" :class="{ 'issue-error': issue.startsWith('❌'), 'issue-warn': issue.startsWith('⚠️') }">
                    {{ issue }}
                  </span>
                  <span v-if="doc.issues.length > 2" class="issue-more">+{{ doc.issues.length - 2 }}条</span>
                </div>
              </div>
              <div class="result-actions-col">
                <button class="btn-small btn-save-history" @click.stop="saveToHistory(doc)" title="保存到历史">
                  <span class="icon-desktop">💾</span><span class="icon-mobile">✅</span> 保存
                </button>
                <button class="btn-small btn-delete-doc" @click.stop="deleteDoc(doc)" title="删除">🗑️ 删除</button>
                <button class="btn-small" @click.stop="previewDoc(doc)">👁️ 预览</button>
              </div>
            </div>
            <div class="result-actions">
              <button class="btn-small hide-on-mobile" @click.stop="sendToTypeset(doc)">📄 排版</button>
              <button class="btn-small hide-on-mobile" @click.stop="downloadDoc(doc, 'docx')">📘 Word</button>
              <button class="btn-small hide-on-mobile" @click.stop="downloadDoc(doc, 'pdf')">📕 PDF</button>
              <button class="btn-small btn-variant hide-on-mobile" @click.stop="generateVariantForDoc(doc)" title="生成变体版本">🔄 变体</button>
              <button v-if="doc.qualityReport" class="btn-small hide-on-mobile" @click.stop="showQualityReport(doc)" title="查看质量报告">📊</button>
              <span class="quality-marks hide-on-mobile">
                <span @click.stop="markQuality(doc, 'good')" :class="{ active: doc.quality === 'good' }" title="可用">👍</span>
                <span @click.stop="markQuality(doc, 'bad')" :class="{ active: doc.quality === 'bad' }" title="不可用">👎</span>
                <span @click.stop="markQuality(doc, 'star')" :class="{ active: doc.quality === 'star' }" title="收藏">⭐</span>
              </span>
            </div>
            <div v-if="doc.graphInstructions?.length" class="graph-collect">
              <span v-for="(g, gIdx) in doc.graphInstructions" :key="gIdx" @click.stop="collectGraph(doc, gIdx)">⭐ 收藏图形{{ gIdx + 1 }}</span>
            </div>
            <div v-if="doc.status === 'failed'" class="failed-tip">
              ⚠️ 生成失败
              <button class="btn-small" @click="retryGenerate(doc)">重试</button>
            </div>
          </div>
        </div>

        <div class="batch-download hide-on-mobile" v-if="generatedDocs.length > 0">
          <select v-model="batchDownloadFormat">
            <option value="word">📘 仅 Word</option>
            <option value="pdf">📕 仅 PDF</option>
            <option value="both">📦 Word + PDF</option>
          </select>
          <select v-model="teacherVersion" style="width:auto;padding:6px 10px;border-radius:6px;border:1px solid #ddd;font-size:12px;">
            <option :value="true">👩‍🏫 教师版（含答案）</option>
            <option :value="false">👩‍🎓 学生版（无答案）</option>
          </select>
          <button class="btn-warning" @click="batchDownload" :disabled="selectedCount === 0">📦 下载 ({{ selectedCount }})</button>
        </div>
      </div>
    </div>

    <!-- 📱 移动端固定底部操作栏 -->
    <div v-if="isMobile" class="mobile-gen-fab">
      <button class="fab-btn fab-primary" @click="handleMobileGenerate('single')" :disabled="!instructionDraft || isGenerating">
        📄 单生成
      </button>
      <button class="fab-btn fab-secondary" @click="handleMobileGenerate('multiple')" :disabled="!instructionDraft || isGenerating || genTypes.length < 2">
        📚 复生成({{ genTypes.length }})
      </button>
      <button class="fab-btn fab-cancel" @click="handleCancelOrRelease">
        {{ isGenerating ? '❌ 取消' : '🧹 释放' }}
      </button>
    </div>

    <!-- 📖 章节选择弹窗（移动端在生成页面直接勾选） -->
    <div v-if="showChapterSelector" class="modal-mask chapter-selector-mask" @click.self="showChapterSelector = false">
      <div class="chapter-selector-modal">
        <div class="cs-header">
          <h3>📖 选择教材章节</h3>
          <button class="icon-btn" @click="showChapterSelector = false">✕</button>
        </div>
        <div class="cs-body">
          <div v-if="textbookStore.textbooks.length === 0" class="empty-tip-small">
            📭 还没有教材，请先在教材库中上传
          </div>
          <div v-for="book in textbookStore.textbooks" :key="book.id" class="cs-book">
            <div class="cs-book-header" @click="toggleCsBookExpand(book.id)">
              <span class="cs-expand-icon">{{ csExpandedBooks.has(book.id) ? '▼' : '▶' }}</span>
              <span class="cs-book-name">{{ book.name }}</span>
              <span class="cs-book-badge" v-if="countBookSelected(book) > 0">{{ countBookSelected(book) }}个已选</span>
            </div>
            <div v-if="csExpandedBooks.has(book.id) && book.outline" class="cs-chapter-tree">
              <div v-for="(node, idx) in book.outline" :key="idx">
                <ChapterCheckNode :node="node" :level="0" :book="book" @toggle="onCsChapterToggle" />
              </div>
            </div>
          </div>
        </div>
        <div class="cs-footer">
          <button class="btn-primary" @click="showChapterSelector = false; textbookStore.saveTextbooks()">✅ 完成</button>
        </div>
      </div>
    </div>

    <!-- 范围类型弹窗 -->
    <div v-if="showScopeModal" class="modal-mask" @click.self="showScopeModal = false">
      <div class="modal">
        <h3>📐 选择范围类型</h3>
        <div class="option-list">
          <label v-for="opt in scopeOptions" :key="opt.value" class="option-item">
            <input type="radio" v-model="scopeType" :value="opt.value" />
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showScopeModal = false">取消</button>
          <button class="btn-primary" @click="showScopeModal = false">确定</button>
        </div>
        <!-- 🔧 多章节合并开关（期中/期末强制合并，不可切换） -->
        <div v-if="scopeType && scopeType !== 'midterm' && scopeType !== 'final'" class="merge-toggle-section">
          <label class="option-item merge-toggle">
            <input type="checkbox" v-model="mergeChapters" />
            <span class="option-label">📦 多章节合并为一份综合卷</span>
            <span class="option-desc">取消勾选则逐章独立生成</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 命题风格弹窗 -->
    <div v-if="showStyleModal" class="modal-mask" @click.self="showStyleModal = false">
      <div class="modal">
        <h3>🎨 选择命题风格</h3>
        <div class="option-list">
          <label v-for="opt in styleOptions" :key="opt.value" class="option-item">
            <input type="radio" v-model="propositionStyle" :value="opt.value" />
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showStyleModal = false">取消</button>
          <button class="btn-primary" @click="showStyleModal = false">确定</button>
        </div>
      </div>
    </div>

    <!-- 资料类型弹窗（多选） -->
    <div v-if="showGenTypeModal" class="modal-mask" @click.self="showGenTypeModal = false">
      <div class="modal">
        <h3>📂 选择资料类型（可多选）</h3>
        <div class="option-list">
          <label v-for="opt in genTypeOptions" :key="opt.value" class="option-item">
            <input type="checkbox" v-model="genTypes" :value="opt.value" />
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
          </label>
        </div>
        <p class="hint">💡 复生成时将按顺序生成选中的多个类型</p>
        <div class="modal-actions">
          <button class="btn" @click="showGenTypeModal = false">取消</button>
          <button class="btn-primary" @click="showGenTypeModal = false">确定</button>
        </div>
      </div>
    </div>

    <!-- 🎯 专项子类型弹窗（单选） -->
    <div v-if="showSpecialSubTypeModal" class="modal-mask" @click.self="showSpecialSubTypeModal = false">
      <div class="modal">
        <h3>🎯 选择专项训练领域</h3>
        <p style="color:var(--text-secondary);margin-bottom:12px;">选择一个聚焦的技能领域，AI 将围绕该领域生成针对性的专项训练资料。</p>
        <div v-if="specialSubTypeOptions.length === 0" class="empty-tip-small" style="padding:16px;">
          当前学科暂无专项子类型可用，将使用通用专项结构（方法指导→典例剖析→变式训练→真题实战）。
        </div>
        <div class="option-list">
          <label v-for="opt in specialSubTypeOptions" :key="opt.value" class="option-item">
            <input type="radio" v-model="specialSubType" :value="opt.value" name="specialSubType" />
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
          </label>
          <label class="option-item">
            <input type="radio" v-model="specialSubType" :value="''" name="specialSubType" />
            <span class="option-label">🔄 通用专项</span>
            <span class="option-desc">使用默认专项结构（方法指导→典例剖析→变式训练→真题实战）</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showSpecialSubTypeModal = false">取消</button>
          <button class="btn-primary" @click="showSpecialSubTypeModal = false">确定</button>
        </div>
      </div>
    </div>

    <!-- 生成粒度弹窗 -->
    <div v-if="showGranularityModal" class="modal-mask" @click.self="showGranularityModal = false">
      <div class="modal">
        <h3>📏 选择生成粒度</h3>
        <div class="option-list">
          <label v-for="opt in granularityOptions" :key="opt.value" class="option-item">
            <input type="radio" v-model="generateGranularity" :value="opt.value" />
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showGranularityModal = false">取消</button>
          <button class="btn-primary" @click="showGranularityModal = false">确定</button>
        </div>
      </div>
    </div>

    <!-- 详细配置弹窗 -->
    <div v-if="showDetailConfigModal" class="modal-mask" @click.self="showDetailConfigModal = false">
      <div class="modal large-modal">
        <h3>📝 详细配置</h3>
        <div class="modal-scroll-area">
        
        <div class="config-section">
          <h4>总分设置</h4>
          <input type="number" v-model="totalScore" placeholder="例如：100" min="0" />
        </div>
        
        <div class="config-section">
          <h4>题型配置</h4>
          <div v-if="selectedTextbookCount === 0" class="empty-tip-small">
            📌 请先在左侧勾选教材，系统将根据学科和年级智能推荐题型
          </div>
          <div v-else class="hint" style="margin-bottom: 10px; color: var(--primary-light);">
            📋 当前是根据 <strong>{{ getSelectedBookSubject() }}</strong> 学科推荐的题型
          </div>
          <div v-for="(qt, idx) in questionTypes" :key="idx" class="config-row">
            <input type="checkbox" v-model="qt.selected" />
            <span class="qt-name">{{ qt.name }}</span>
            <input type="number" v-model="qt.count" placeholder="题量" min="0" style="width:70px" />
            <input type="number" v-model="qt.score" placeholder="分值" min="0" style="width:70px" />
          </div>
          <button class="btn-small" @click="addQuestionType">➕ 添加题型</button>
        </div>
        
        <div class="config-section">
          <h4>难度配置（%）</h4>
          <div v-for="(dl, idx) in difficultyLevels" :key="idx" class="config-row">
            <input type="checkbox" v-model="dl.selected" />
            <span class="dl-name">{{ dl.name }}</span>
            <input type="number" v-model="dl.percentage" min="0" max="100" style="width:70px" :placeholder="dl.percentage == null ? '自动' : ''" /> %
          </div>
        </div>

        <div class="config-section">
          <h4>生成份数（同类型一次出多份）</h4>
          <input type="number" v-model.number="batchCount" min="1" max="10" placeholder="1" style="width:100px" />
          <span class="hint">设置>1时，一次生成多份不同的资料</span>
        </div>                
        
        <div class="config-section">
          <h4>原题引用</h4>
          <label class="checkbox-label">
            <input type="checkbox" v-model="allowOriginalQuestions" />
            允许适量引用教材原题
          </label>
        </div>
        </div>
        
        <div class="modal-actions">
          <button class="btn" @click="showDetailConfigModal = false">取消</button>
          <button class="btn-primary" @click="closeDetailConfigModal">确定</button>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="showPreview" class="modal-mask" @click.self="showPreview = false">
      <div class="modal large-modal">
        <h3><span class="hide-on-mobile">👁️</span> 内容预览</h3>
        <div v-if="previewHint" class="copy-hint">{{ previewHint }}</div>
        <div class="preview-content" v-html="previewContent"></div>
        <div class="modal-actions">
          <button class="btn" @click="showPreview = false">关闭</button>
          <button class="btn-edurender hide-on-mobile" @click="copyToEduRender">📋 复制到EduRender</button>
          <button class="btn-primary hide-on-mobile" @click="editDoc">✏️ 编辑</button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="showEditor" class="modal-mask" @click.self="showEditor = false">
      <div class="modal large-modal">
        <h3>✏️ 编辑文档</h3>
        <textarea v-model="editingContent" rows="20" class="editor-textarea"></textarea>
        <div class="modal-actions">
          <button class="btn" @click="showEditor = false">取消</button>
          <button class="btn-primary" @click="saveEdit">💾 保存</button>
        </div>
      </div>
    </div>

    <!-- 指令库弹窗 -->
    <div v-if="showInstructionLibModal" class="modal-mask" @click.self="showInstructionLibModal = false">
      <div class="modal large-modal">
        <h3>📋 指令库</h3>
        <div class="instruction-lib-list">
          <div v-for="ins in instructionStore.list" :key="ins.id" class="lib-item">
            <div class="lib-info">
              <span class="lib-name">{{ ins.name }}</span>
              <span class="lib-category">{{ ins.category }}</span>
            </div>
            <div class="lib-actions">
              <button class="btn-small" @click="loadInstruction(ins)">加载</button>
              <button class="btn-small" @click="appendInstruction(ins)">追加</button>
              <button class="btn-small btn-delete" v-if="!ins.builtin" @click="deleteInstructionFromLib(ins.id)">🗑️</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showInstructionLibModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 分析确认弹窗 -->
    <div v-if="showAnalysisModal" class="modal-mask" @click.self="showAnalysisModal = false">
      <div class="modal large-modal" style="max-width: 900px; width: 90%;">
        <h3>📊 素材分析状态</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:8px;flex-shrink:0;">
          {{ analysisType === 'textbook' ? '以下是将要分析的教材章节，请确认后选择分析方式' : '以下是将要分析的模板，请确认后选择分析方式' }}
        </p>
        <div class="modal-scroll-area">
        <div class="chapter-analysis-two-columns">
          <!-- 左栏：章节列表 -->
          <div class="chapter-analysis-left">
            <strong v-if="analysisType === 'textbook'">📚 教材章节</strong>
            <strong v-else>📋 模板章节</strong>
            
            <div v-if="analysisType === 'textbook'">
              <div v-for="book in analysisBooks" :key="book.id" style="margin-bottom:14px;border:1px solid var(--border-light);border-radius:8px;padding:12px;">
                <div style="font-weight:600;color:var(--primary);margin-bottom:8px;">{{ book.name }}</div>
                <div v-for="ch in book.selectedChapters" :key="ch.title" style="padding:6px 0;font-size:13px;border-bottom:1px dashed #f0f0f0;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:500;">{{ ch.title }}</span>
                    <span v-if="ch.analyzed" style="color:var(--success);">✅ 已分析</span>
                    <span v-else style="color:var(--warning);">⚠️ 未分析</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">分析范围：第{{ ch._analysisStart ?? ch.start }}-{{ ch._analysisEnd ?? ch.end }}页</div>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">{{ book.cached }}个已缓存 / {{ book.new }}个未分析</div>
              </div>
            </div>
            <div v-else>
              <div v-for="tpl in analysisTpls" :key="tpl.id" style="margin-bottom:14px;border:1px solid var(--border-light);border-radius:8px;padding:12px;">
                <div style="font-weight:600;color:var(--primary);margin-bottom:8px;">{{ tpl.name }}</div>
                <div v-for="ch in tpl.selectedChapters" :key="ch.title" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;border-bottom:1px dashed #f0f0f0;">
                  <span>{{ ch.title }}</span>
                  <span v-if="ch.analyzed" style="color:var(--success);">✅ 已分析</span>
                  <span v-else style="color:var(--warning);">⚠️ 未分析</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">{{ tpl.cached }}个已缓存 / {{ tpl.new }}个未分析</div>
              </div>
            </div>
          </div>
          
          <!-- 右栏：操作面板 -->
          <div class="chapter-analysis-right" style="display:flex;flex-direction:column;gap:12px;">
            <div style="text-align:center;padding:12px;background:#f0f7ff;border-radius:8px;">
              <div style="font-size:24px;font-weight:700;color:var(--primary-light);">{{ totalNewCount }}</div>
              <div style="font-size:12px;color:var(--text-muted);">个章节待分析</div>
            </div>
            
            <!-- 🔧 新增：原文获取方式选择 -->
            <div style="margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
              <div style="font-size: 12px; color: #555; margin-bottom: 8px;"><strong>📥 原文获取方式：</strong></div>
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; font-size: 13px;">
                <input type="radio" v-model="analysisInputMode" value="ocr" />
                <span>📷 自动OCR提取 <span style="color:var(--text-muted);font-size:11px;">（PaddleOCR-VL 引擎，本地识别图片文字，无需联网）</span></span>
              </label>
              <label v-if="analysisInputMode === 'ocr'" style="display: flex; align-items: center; gap: 8px; margin-left: 24px; margin-bottom: 8px; cursor: pointer; font-size: 12px;">
                <input type="checkbox" v-model="enableColumnSplit" />
                <span>📐 启用多栏切割 <span style="color:var(--text-muted);font-size:11px;">（分栏排版文档勾选，逐栏识别后合并）</span></span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                <input type="radio" v-model="analysisInputMode" value="manual" />
                <span>✍️ 手动输入原文 <span style="color:var(--text-muted);font-size:11px;">（粘贴或手动输入文字）</span></span>
              </label>
            </div>
            
            <div style="font-size:12px;color:var(--text-muted);line-height:1.8;">
              <p><strong>📌 说明：</strong></p>
              <p>• 分析会调用 AI 模型提取教材/模板中的文字和知识点</p>
              <p>• 已分析的章节会缓存结果，下次无需重复分析</p>
              <p>• 分析过程可能需要几分钟，请耐心等待</p>
            </div>
            
            <div class="modal-actions" style="flex-direction:column;gap:10px;margin-top:auto;">
              <button class="btn-primary" @click="runAnalysis('all')" style="width:100%;padding:12px;">
                🔄 全部重新分析
              </button>
              <button class="btn" @click="runAnalysis('new')" :disabled="totalNewCount === 0" style="width:100%;padding:12px;">
                📝 仅分析新的（{{ totalNewCount }}个）
              </button>
              <button class="btn" @click="runAnalysis('skip')" style="width:100%;padding:12px;">
                ⏭️ 跳过，使用已有缓存
              </button>
              <button class="btn" @click="showAnalysisModal = false" style="width:100%;padding:12px;color:var(--text-muted);">
                取消
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- 🔧 新增：原文编辑弹窗（分步流程 - 步骤2） -->
    <div v-if="showRawTextEditor" class="modal-mask" @click.self="closeRawTextEditor">
      <div class="modal large-modal" style="max-width: 1200px; width: 95%; display: flex; flex-direction: column;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0;">📝 原文编辑器 - {{ rawTextEditorData?.chapterTitle }}</h3>
          <button class="close-btn" @click="closeRawTextEditor" style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
        </div>
            
        <div style="display: flex; gap: 12px; margin-bottom: 12px; align-items: center;">
          <span style="font-size: 13px; color: #666;">ℹ️ 直接粘贴图文混排内容，图片会自动提取</span>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
            <input type="checkbox" v-model="rawTextEditorData.analyzeCharts" @change="onAnalyzeChartsChange" />
            <span>🖼️ 分析图片内容（自动调用多模态模型描述）</span>
          </label>
        </div>
        
        <!-- 🔧 图片列表和勾选 -->
        <div v-if="rawTextEditorData.analyzeCharts && rawTextEditorData.detectedImages && rawTextEditorData.detectedImages.length > 0" 
             style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px; max-height: 200px; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 13px;">📸 检测到 {{ rawTextEditorData.detectedImages.length }} 张图片</strong>
            <div style="display: flex; gap: 8px;">
              <button @click="selectAllDetectedImages(true)" style="font-size: 12px; padding: 4px 8px; cursor: pointer;">全选</button>
              <button @click="selectAllDetectedImages(false)" style="font-size: 12px; padding: 4px 8px; cursor: pointer;">全不选</button>
            </div>
          </div>
          <div v-for="(img, idx) in rawTextEditorData.detectedImages" :key="idx" 
               style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding: 6px; background: white; border-radius: 4px;">
            <input type="checkbox" v-model="img.selected" :id="'img-' + idx" />
            <label :for="'img-' + idx" style="flex: 1; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <img :src="img.src" style="max-width: 60px; max-height: 60px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px;" />
              <span style="font-size: 12px; color: #666;">图片 {{ idx + 1 }}</span>
            </label>
          </div>
        </div>
            
        <!-- 🔧 使用富文本编辑器 -->
        <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
          <RichTextEditor 
            ref="richTextEditorRef"
            v-model="rawTextEditorData.rawText"
            placeholder="在此粘贴图文混排内容..."
            :min-height="'0'"
            style="flex: 1;"
          />
        </div>
            
        <div style="margin-top: 12px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 12px; color: #666;">
          <strong>💡 提示：</strong>
          <ul style="margin: 6px 0 0 20px; padding: 0;">
            <li>支持直接粘贴图文混排内容（Word、网页、PDF等）</li>
            <li>图片会自动提取为 base64 格式</li>
            <li>如果启用"分析图片"，系统会用多模态模型描述每张图片并替换为文字</li>
            <li>最终生成纯文本，方便后续五步生成法调用</li>
          </ul>
        </div>
            
        <div class="modal-actions" style="margin-top: 16px; display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn" @click="closeRawTextEditor" style="padding: 10px 20px;">
            ❌ 取消
          </button>
          <button class="btn-primary" @click="confirmRawTextWithImages" :disabled="isAnalyzingImages" style="padding: 10px 20px;">
            {{ isAnalyzingImages ? '🔄 正在分析图片...' : '✅ 确认原文，继续分析' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 保存到指令库弹窗 -->
    <div v-if="showSaveToLibModal" class="modal-mask" @click.self="showSaveToLibModal = false">
      <div class="modal">
        <h3>💾 保存到指令库</h3>
        <div class="form-group">
          <label>指令名称</label>
          <input type="text" v-model="newInstructionName" placeholder="例如：高中数学试卷模板" />
        </div>
        <div class="form-group">
          <label>分类</label>
          <select v-model="newInstructionCategory">
            <option value="试卷">试卷</option>
            <option value="课时练">课时练</option>
            <option value="知识点总结">知识点总结</option>
            <option value="自定义">自定义</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showSaveToLibModal = false">取消</button>
          <button class="btn-primary" @click="confirmSaveToLib">保存</button>
        </div>
      </div>
    </div>

    <!-- 分析结果确认弹窗 -->
    <div v-if="showAnalysisResultModal" class="modal-mask" @click.self="showAnalysisResultModal = false">
      <div class="modal large-modal draggable-modal analysis-result-modal" style="max-width: 1200px; width: 96%; display: flex; flex-direction: column;" ref="analysisResultModalRef">
        <!-- ✅ 固定头部：标题 + 提示 -->
        <div style="flex-shrink: 0;">
          <div class="modal-drag-handle" @mousedown="startAnalysisResultDrag($event)">📊 分析结果确认（可拖动）</div>
          <h3 style="margin: 8px 0 4px 0;">📊 分析结果确认</h3>
          <p style="color:var(--text-muted);font-size:12px;margin-bottom:6px;">
            {{ analysisResultType === 'textbook' ? '教材' : '模板' }}分析完成，请确认以下结果后保存
          </p>
          <p style="color:var(--warning);font-size:11px;margin-bottom:8px;background:#fef9e7;padding:6px 10px;border-radius:4px;">
            ⚠️ 请仔细核对分析结果，修改确认后点击「💾 确认保存」，否则分析数据不会保存
          </p>
        </div>
        
        <!-- ✅ 滚动内容区 -->
        <div style="flex: 1; overflow-y: auto; min-height: 0; padding-right: 8px;">
          <!-- 教材分析结果 -->
          <div v-if="analysisResultType === 'textbook' && analysisResultData">
            <div v-for="(item, idx) in analysisResultData" :key="idx" style="border:1px solid var(--border-light);border-radius:8px;padding:10px;margin-bottom:10px;">
              <div class="confirm-item-header">
                <strong style="font-size:13px;">{{ item.bookName }} - {{ item.chapterTitle }}</strong>
                <div style="display:flex;gap:6px;align-items:center;">
                  <span v-if="item.ocrQuality === 'poor'" style="color:var(--danger);font-weight:bold;font-size:11px;background:#fde8e8;padding:2px 6px;border-radius:3px;">❌ 质量差·必须修正</span>
                  <span v-else-if="item.ocrQuality === 'warning'" style="color:var(--warning);font-size:11px;background:#fef3e2;padding:2px 6px;border-radius:3px;">️ 可能有误·建议核对</span>
                  <button class="icon-btn" @click="saveSingleAnalysisItem(idx)" title="单独保存" style="padding:2px 4px;color:var(--success);">💾</button>
                  <button class="icon-btn" @click="removeAnalysisItem(idx)" title="删除" style="padding:2px 4px;">🗑️</button>
                </div>
              </div>
              
              <!-- 左右两栏 -->
              <div class="template-two-columns">
                <!-- 左栏：原文 -->
                <div class="template-left-column">
                  <label style="display:block;font-size:11px;color:var(--text-muted);margin-bottom:3px;">📖 原文提取</label>
                  <div v-if="item.rawText && item.rawText.includes('【？】')" 
                    style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 6px;background:#fffbf0;border:1px solid #f0c78e;border-radius:3px;font-size:10px;">
                    <span style="color:var(--warning);font-weight:600;">⚠️ {{ (item.rawText.match(/【？】/g) || []).length }} 处</span>
                    <button class="btn-small" @click="jumpToUncertainInItem(item, 'prev')" style="color:var(--primary-light);padding:1px 4px;font-size:10px;">◀</button>
                    <button class="btn-small" @click="jumpToUncertainInItem(item, 'next')" style="color:var(--primary-light);padding:1px 4px;font-size:10px;">▶</button>
                    <button class="btn-small" @click="item.rawText = item.rawText.replace(/【？】/g, '')" style="color:var(--success);margin-left:auto;padding:1px 6px;font-size:10px;">✅ 清除</button>
                  </div>
                  <!-- 🔧 保留原文格式：有 _rawTextHtml 用富文本编辑器，否则用纯文本框 -->
                  <RichTextEditor 
                    v-if="item._rawTextHtml"
                    v-model="item._rawTextHtml"
                    placeholder="逐段原文..."
                    :min-height="'240px'"
                    style="width:100%;font-size:11px;max-height:420px;"
                  />
                  <textarea v-else v-model="item.rawText" rows="16" placeholder="逐段原文..."
                    :style="{ borderColor: item.ocrQuality === 'poor' ? 'var(--danger)' : '#ddd', width:'100%',fontSize:'11px',padding:'6px',borderRadius:'4px',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box' }"
                    @click="updateUncertainForItem($event, item)"
                  ></textarea>
                </div>
                
                <!-- 右栏：分析字段 -->
                <div class="template-right-column">
                  <div class="confirm-field">
                    <label style="font-size:11px;">️ 图表描述</label>
                    <input type="text" v-model="item.visualDescription" placeholder="图表描述..." style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;" />
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;"> 公式描述</label>
                    <input type="text" v-model="item.formulasText" placeholder="公式..." style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;" />
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;">️ 核心主题词（逗号分隔）</label>
                    <input type="text" v-model="item.coreTopics" placeholder="主题词..." style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;" />
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;">📍 知识点（每行一个）</label>
                    <textarea v-model="item.knowledgePointsText" rows="4" placeholder="每行一个知识点..." style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;"> 能力层次</label>
                    <select v-model="item.competency" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;">
                      <option value="识记与理解">识记与理解</option>
                      <option value="应用与分析">应用与分析</option>
                      <option value="综合与评价">综合与评价</option>
                    </select>
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;">🎨 风格</label>
                    <select v-model="item.style" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;">
                      <option value="传统">传统</option>
                      <option value="创新">创新</option>
                      <option value="情境化">情境化</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 🔧 重构：模板分析结果——左右两栏布局 -->
          <div v-if="analysisResultType === 'template' && analysisResultData" class="template-review-layout">
            <!-- 顶部提示条 -->
            <div style="background:#fff9e6;border:2px solid #f39c12;border-radius:6px;padding:8px 12px;margin-bottom:10px;">
              <p style="margin:0;color:#b85c00;font-weight:600;font-size:12px;">⚠️ 模板对标是生成高质量资料的关键，请逐项核对</p>
            </div>

            <!-- 左右两栏 -->
            <div class="template-two-columns">
              <!-- ========== 左栏：原文 ========== -->
              <div class="template-left-column">
                <div class="confirm-item-header">
                  <strong style="font-size:13px;">{{ analysisResultData.tplName }} · 原文</strong>
                  <span style="font-size:11px;color:var(--text-muted);">{{ (analysisResultData.rawText || '').length }}字</span>
                </div>
                <!-- 🔧 不确定文字导航条 -->
                <div v-if="analysisResultData.rawText && analysisResultData.rawText.includes('【？】')" 
                  style="display:flex;align-items:center;gap:4px;margin-bottom:4px;padding:4px 8px;background:#fffbf0;border:1px solid #f0c78e;border-radius:4px;font-size:11px;">
                  <span style="color:var(--warning);font-weight:600;">⚠️ {{ uncertainCount }} 处不确定</span>
                  <button class="btn-small" @click="jumpToUncertain('prev')" style="color:var(--primary-light);font-size:10px;">◀ 上一个</button>
                  <button class="btn-small" @click="jumpToUncertain('next')" style="color:var(--primary-light);font-size:10px;">下一个 ▶</button>
                  <span style="color:var(--text-muted);margin:0 4px;font-size:10px;">{{ uncertainCurrentIndex > 0 ? uncertainCurrentIndex : '?' }}/{{ uncertainCount }}</span>
                  <button class="btn-small" @click="clearAllUncertainMarks" style="color:var(--success);margin-left:auto;font-size:10px;">✅ 一键清除</button>
                </div>
                <!-- 🔧 保留原文格式：有 _rawTextHtml 用富文本编辑器，否则用纯文本框 -->
                <RichTextEditor 
                  v-if="analysisResultData._rawTextHtml"
                  v-model="analysisResultData._rawTextHtml"
                  placeholder="逐段原文...（请对照原始模板PDF逐字核对）"
                  :min-height="'400px'"
                  style="width:100%;font-size:12px;max-height:500px;"
                />
                <textarea v-else v-model="analysisResultData.rawText" rows="26" 
                  ref="rawTextTextarea"
                  @click="updateUncertainList"
                  @keyup="updateUncertainList"
                  placeholder="逐段原文...（请对照原始模板PDF逐字核对）"
                  class="template-raw-textarea"
                  :style="{ borderColor: analysisResultData.ocrQuality === 'poor' ? 'var(--danger)' : '#ddd' }">
                </textarea>
              </div>

              <!-- ========== 右栏：分析字段 ========== -->
              <div class="template-right-column">
                <div class="confirm-item-header">
                  <strong style="font-size:13px;">📊 结构分析</strong>
                  <div style="display:flex;gap:4px;">
                    <span v-if="analysisResultData.ocrQuality === 'poor'" style="color:var(--danger);font-weight:bold;font-size:10px;background:#fde8e8;padding:2px 6px;border-radius:3px;">OCR质量差</span>
                    <span v-else-if="analysisResultData.ocrQuality === 'warning'" style="color:var(--warning);font-weight:bold;font-size:10px;background:#fef3e2;padding:2px 6px;border-radius:3px;">OCR有误</span>
                    <button class="btn-small" @click="clearTemplateAnalysisFields" title="清空所有分析字段" style="color:var(--warning);border-color:#f0c78e;font-size:10px;">🗑️ 重填</button>
                  </div>
                </div>

                <div class="confirm-field">
                  <label style="font-size:11px;">📋 结构分析 <span style="color:var(--danger);">*必填</span></label>
                  <div v-for="(section, si) in (analysisResultData.结构分析 || [])" :key="si" style="margin-bottom:6px;border:1px solid var(--border-light);border-radius:4px;padding:6px;">
                    <div style="display:flex;gap:4px;margin-bottom:3px;">
                      <input type="text" v-model="section.大题" placeholder="大题（如一、看拼音写词语）" style="flex:1;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;" />
                      <input type="text" v-model="section.题型" placeholder="题型" style="width:100px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;" />
                      <button class="btn-small" @click="analysisResultData.结构分析.splice(si, 1)" style="color:var(--danger);flex-shrink:0;padding:2px 4px;font-size:10px;">🗑️</button>
                    </div>
                    <div style="display:flex;gap:4px;">
                      <input type="number" v-model.number="section.小题数量" placeholder="小题数" style="width:60px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;" />
                      <input type="number" v-model.number="section.大题分值" placeholder="分值" style="width:60px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;" />
                      <input type="number" v-model.number="section.每小题分值" placeholder="每小题分" style="width:70px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;" />
                      <input type="text" v-model="section.难度" placeholder="难度" style="width:60px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;" />
                    </div>
                    <input type="text" v-model="section.设问风格" placeholder="设问风格" style="width:100%;margin-top:3px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;" />
                  </div>
                  <button class="btn-small" @click="analysisResultData.结构分析.push({大题:'',题型:'',小题数量:0,大题分值:0,每小题分值:0,设问风格:'',难度:'基础'})" style="margin-top:3px;font-size:10px;">➕ 添加大题</button>
                </div>
                <div style="display:flex;gap:10px;">
                  <div class="confirm-field" style="flex:1;">
                    <label style="font-size:11px;">总分</label>
                    <input type="number" v-model.number="analysisResultData.总分" placeholder="100" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;" />
                  </div>
                  <div class="confirm-field" style="flex:1;">
                    <label style="font-size:11px;">总题数</label>
                    <input type="number" v-model.number="analysisResultData.总题数" placeholder="20" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;" />
                  </div>
                </div>

                <!-- 🔧 语言风格指纹（可折叠查看） -->
                <div class="confirm-field" v-if="analysisResultData.languageStyle">
                  <label @click="showLanguageStyleDetail = !showLanguageStyleDetail" style="cursor:pointer;font-size:11px;">
                    🔍 语言风格指纹 {{ showLanguageStyleDetail ? '▼' : '▶' }}
                  </label>
                  <div v-if="showLanguageStyleDetail" style="font-size:10px;color:#555;background:var(--bg-card);padding:6px;border-radius:4px;margin-top:3px;">
                    <div v-if="analysisResultData.languageStyle.avgSentenceLength">平均句长：{{ analysisResultData.languageStyle.avgSentenceLength }}字</div>
                    <div v-if="analysisResultData.languageStyle.commonPatterns?.length">高频句式：{{ analysisResultData.languageStyle.commonPatterns.join('、') }}</div>
                    <div v-if="analysisResultData.languageStyle.connectors?.length">连接词：{{ analysisResultData.languageStyle.connectors.join('、') }}</div>
                    <div v-if="analysisResultData.languageStyle.contextIntro">情境引入：{{ analysisResultData.languageStyle.contextIntro }}</div>
                    <div v-if="analysisResultData.languageStyle.personReference">指代方式：{{ analysisResultData.languageStyle.personReference }}</div>
                    <div v-if="analysisResultData.languageStyle.tone">语气：{{ analysisResultData.languageStyle.tone }}</div>
                    <div v-if="analysisResultData.languageStyle.sampleSentence">典型句式：「{{ analysisResultData.languageStyle.sampleSentence }}」</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- ✅ 固定底部：操作按钮 -->
        <div style="flex-shrink: 0; margin-top:10px; padding-top:10px; border-top:1px solid var(--border-light);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <button class="btn btn-delete" @click="discardAnalysisResult" style="font-size:11px;padding:4px 10px;">🗑️ 丢弃分析结果</button>
            <div class="modal-actions" style="display:flex;gap:8px;">
              <button class="btn" @click="openAnalysisPDFPreview">📄 打开PDF对照</button>
              <button class="btn" @click="showAnalysisResultModal = false">稍后处理</button>
              <button class="btn-primary" @click="confirmAnalysisResult">💾 确认保存</button>
            </div>
          </div>
        </div>
        
        <!-- 🔧 右下角调整大小手柄 -->
        <div 
          @mousedown="startAnalysisResultResize"
          style="position:absolute; right:0; bottom:0; width:20px; height:20px; cursor:nwse-resize; z-index:10;"
          title="拖动调整大小">
          <div style="position:absolute; right:3px; bottom:3px; width:10px; height:10px; border-right:2px solid var(--text-muted); border-bottom:2px solid var(--text-muted);"></div>
        </div>
      </div>
    </div>

    <!-- 🔧 新增：PDF对照浮窗 -->
    <div v-if="showAnalysisPDF" 
      ref="analysisPDFRef"
      :style="{ 
        position: 'fixed', 
        left: analysisPDFPos.x + 'px', 
        top: analysisPDFPos.y + 'px', 
        width: analysisPDFSize.width + 'px', 
        height: analysisPDFSize.height + 'px',
        minWidth: '350px',
        minHeight: '400px',
        background: 'white', 
        border: '2px solid var(--primary-light)', 
        borderRadius: '12px', 
        zIndex: 5000, 
        overflow: 'hidden', 
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column'
      }">
      <div 
        @mousedown="startAnalysisPDFDrag" 
        style="display:flex; justify-content:space-between; align-items:center; padding:6px 12px; background:var(--primary); color:white; cursor:move; user-select:none; flex-shrink:0;">
        <span style="font-size:13px;">📖 PDF 对照</span>
        <div style="display:flex; gap:6px; align-items:center;">
          <button @click="analysisPDFPage = Math.max(1, analysisPDFPage - 1)" style="background:rgba(255,255,255,0.2); border:none; color:white; cursor:pointer; padding:3px 8px; border-radius:4px; font-size:12px;">◀</button>
          <span style="font-size:12px;">第 {{ analysisPDFPage }} 页</span>
          <button @click="analysisPDFPage = analysisPDFPage + 1" style="background:rgba(255,255,255,0.2); border:none; color:white; cursor:pointer; padding:3px 8px; border-radius:4px; font-size:12px;">▶</button>
          <button @click="showAnalysisPDF = false" style="background:none; border:none; color:white; cursor:pointer; font-size:18px; margin-left:4px;">✕</button>
        </div>
      </div>
      <div style="flex:1; min-height:0;">
        <PdfPreview :pdfPath="analysisPDFPath" :page="analysisPDFPage" :largeFile="true" />
      </div>
      <div 
        @mousedown="startAnalysisPDFResize"
        style="position:absolute; right:0; bottom:0; width:20px; height:20px; cursor:nwse-resize; z-index:10;"
        title="拖动调整大小">
        <div style="position:absolute; right:3px; bottom:3px; width:10px; height:10px; border-right:2px solid var(--text-muted); border-bottom:2px solid var(--text-muted);"></div>
      </div>
    </div>    

    <!-- 🔧 新增：多栏分割预览弹窗 -->
    <div v-if="showColumnSplitModal" class="modal-mask" @click.self="showColumnSplitModal = false">
      <div class="modal large-modal column-split-modal" style="max-width: 1100px; width: 96%; display: flex; flex-direction: column;">
        <!-- ✅ 固定头部：标题 + 翻页导航 -->
        <div style="flex-shrink: 0;">
          <h3>📐 多栏分割预览与调整</h3>
          
          <!-- 🔧 新增：翻页导航 -->
          <div v-if="columnSplitAllPages && columnSplitAllPages.length > 1" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 14px;background:#f0f7ff;border-radius:8px;">
            <button class="btn-small" @click="goToSplitPage(columnSplitCurrentPage - 1)" :disabled="columnSplitCurrentPage <= 0">◀ 上一页</button>
            <span style="font-size:13px;font-weight:600;color:var(--primary);">
              第 {{ columnSplitCurrentPage + 1 }} / {{ columnSplitAllPages.length }} 页
            </span>
            <button class="btn-small" @click="goToSplitPage(columnSplitCurrentPage + 1)" :disabled="columnSplitCurrentPage >= columnSplitAllPages.length - 1">下一页 ▶</button>
            
            <!-- 各页状态指示 -->
            <div style="display:flex;gap:4px;margin-left:8px;">
              <span 
                v-for="(page, pIdx) in columnSplitAllPages" 
                :key="'page-dot-' + pIdx"
                @click="goToSplitPage(pIdx)"
                :title="'第' + page.page + '页' + (page._skipSplit ? ' ⏩整页OCR' : page._confirmed ? ' ✅已确认' : ' ⚠️待确认')"
                style="cursor:pointer;width:12px;height:12px;border-radius:50%;display:inline-block;"
                :style="{
                  background: pIdx === columnSplitCurrentPage ? 'var(--primary-light)' : page._skipSplit ? '#f0a030' : page._confirmed ? 'var(--success)' : 'var(--border-light)',
                  border: pIdx === columnSplitCurrentPage ? '2px solid var(--primary)' : '2px solid transparent'
                }"
              ></span>
            </div>
            
            <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">
              ✅ {{ columnSplitAllPages.filter(p => p._confirmed).length }}/{{ columnSplitAllPages.length }} 页已确认
            </span>
          </div>
          
          <p style="color:var(--text-muted);font-size:13px;margin-bottom:8px;">
            第 {{ columnSplitAllPages ? columnSplitAllPages[columnSplitCurrentPage]?.page : '?' }} 页，检测到 {{ columnSplitResult?.columns || 0 }} 栏排版。拖动切割线调整位置，点击「👁️ 预览切割效果」查看结果。
          </p>
          <p style="color:var(--warning);font-size:12px;margin-bottom:12px;background:#fef9e7;padding:8px 12px;border-radius:6px;">
            ⚠️ 请确认切割线位置正确后再点击「✅ 确认并提取原文」。切割线应在两栏之间的空白区域。
          </p>
        </div>
        
        <!-- ✅ 滚动内容区 -->
        <div style="flex: 1; overflow-y: auto; min-height: 0;">
          <!-- 切割预览区 -->
          <div class="column-split-preview" ref="columnSplitPreviewRef">
            <!-- 原图容器 -->
            <div class="split-canvas-container" ref="splitCanvasContainer">
              <img 
                v-if="columnSplitOriginBase64" 
                :src="'data:image/jpeg;base64,' + columnSplitOriginBase64" 
                class="split-origin-image"
                ref="splitOriginImage"
                @load="onSplitImageLoaded"
              />
              <!-- 切割线 -->
              <div 
                v-for="(line, idx) in columnSplitLines" 
                :key="'split-line-' + idx"
                class="split-line"
                :style="{ left: line.position + '%' }"
                @mousedown="startDragSplitLine($event, idx)"
              >
                <div class="split-line-handle">
                  <span class="split-line-label">✂ 切割线{{ idx + 1 }}</span>
                  <span class="split-line-x">{{ Math.round(line.x) }}px</span>
                </div>
                <button 
                  class="split-line-delete" 
                  @click.stop="removeSplitLine(idx)" 
                  title="删除此切割线"
                >🗑️</button>
              </div>
              <!-- 栏预览 -->
              <div 
                v-for="(col, idx) in columnSplitPreviewCols" 
                :key="'col-preview-' + idx"
                class="split-col-preview"
                :style="{ ...col.style }"
              >
                <span class="col-label">第{{ idx + 1 }}栏</span>
              </div>
              <!-- 添加切割线按钮 -->
              <button class="add-split-line-btn" @click="addSplitLine" title="在中间位置添加切割线">➕ 添加切割线</button>
            </div>
          </div>

          <!-- 子图预览（切割后的各栏） -->
          <div v-if="columnSplitPreviewCols.length > 0" style="margin-top:16px;">
            <h4 style="color:var(--primary);margin-bottom:8px;">
              📷 切割后的各栏预览：
              <span v-if="columnSplitConfirmed" style="color:var(--success);">✅ 已确认切割</span>
              <span v-else style="color:var(--warning);">⚠️ 请先点击下方「预览切割效果」</span>
            </h4>
            <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;">
              <div 
                v-for="(col, idx) in columnSplitPreviewCols" 
                :key="'sub-preview-' + idx"
                style="flex-shrink:0;text-align:center;border:1px solid var(--border-light);border-radius:8px;padding:8px;background:var(--bg-card);"
              >
                <div style="font-weight:600;font-size:12px;color:var(--primary);margin-bottom:4px;">第{{ idx + 1 }}栏</div>
                <img 
                  v-if="col.subBase64" 
                  :src="'data:image/jpeg;base64,' + col.subBase64" 
                  style="max-height:250px;max-width:250px;border-radius:4px;"
                />
                <div v-else style="width:200px;height:150px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#ccc;">
                  {{ columnSplitConfirmed ? '加载中...' : '待切割' }}
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">{{ col.xRange }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- ✅ 固定底部：操作按钮 -->
        <div class="modal-actions" style="flex-shrink: 0; margin-top:16px; padding-top:12px; border-top:1px solid var(--border-light);">
          <button class="btn" @click="resetSplitLines">🔄 重置为自动检测</button>
          <button class="btn" @click="previewColumnSplit" v-if="!columnSplitConfirmed">👁️ 预览切割效果</button>
          <button class="btn btn-success" @click="confirmCurrentPage" v-if="!columnSplitConfirmed" :disabled="columnSplitLines.length === 0">✅ 确认本页切割</button>
          <button class="btn-warning" @click="skipSplitForCurrentPage" v-if="!columnSplitConfirmed" title="不切割此页，直接对整页图片做 OCR 识别">⏩ 不切割，整页OCR</button>
          <button class="btn" @click="previewColumnSplit" v-if="columnSplitConfirmed">🔄 重新预览</button>
          <span v-if="columnSplitConfirmed && columnSplitSkip" style="color:#f0a030;font-weight:600;margin:0 12px;">⏩ 本页将整页OCR（不切割）</span>
          <span v-else-if="columnSplitConfirmed" style="color:var(--success);font-weight:600;margin:0 12px;">✅ 本页切割已确认</span>
          <button class="btn btn-cancel" @click="cancelAllColumnSplit" style="margin-right:auto;">❌ 全部取消</button>
          <button class="btn-primary" @click="finishAllColumnSplit" :disabled="!allPagesConfirmed">✅ 全部确认并提取原文 ({{ confirmedPageCount }}/{{ columnSplitAllPages?.length || 0 }})</button>
        </div>
      </div>
    </div>

    <!-- 🔧 重构：查看/编辑章节分析弹窗（左右两栏） -->
    <div v-if="showChapterAnalysisModal" class="modal-mask" @click.self="showChapterAnalysisModal = false">
      <div class="modal draggable-modal" style="max-width: 1000px; width: 90%; display: flex; flex-direction: column;" ref="chapterAnalysisModalRef">
        <div class="modal-drag-handle" @mousedown="startChapterDrag($event)">📊 章节分析详情</div>
        <div style="flex-shrink: 0; padding: 8px 0;">
          <h3>📊 {{ viewingBook?.name }} - {{ viewingChapter?.title }}</h3>
        </div>
        <div style="flex: 1; overflow-y: auto; min-height: 0;">
          <div v-if="viewingChapter" class="chapter-analysis-two-columns">
            <!-- 左栏：原文 -->
            <div class="chapter-analysis-left">
              <strong>📖 原文提取：</strong>
              <!-- 🔧 有富文本时用 RichTextEditor 只读模式，否则用纯文本框编辑 -->
              <RichTextEditor 
                v-if="viewingChapter._rawTextHtml"
                :model-value="viewingChapter._rawTextHtml"
                :editable="false"
                :min-height="'280px'"
                style="width:100%;font-size:12px;max-height:none;"
              />
              <textarea v-else v-model="viewingChapter.rawText" rows="18" 
                style="width:100%;font-size:12px;padding:8px;border:1px solid #ddd;border-radius:6px;resize:vertical;overflow:auto;font-family:inherit;box-sizing:border-box;">
              </textarea>
            </div>
            <!-- 右栏：分析字段 -->
            <div class="chapter-analysis-right">
              <template v-if="viewingChapter._tplAnalysis">
                <!-- ✅ 模板分析结果 - 只读显示 -->
                <div class="detail-item">
                  <strong>📋 结构分析：</strong>
                  <div v-for="(section, si) in (viewingChapter._tplAnalysis.结构分析 || viewingChapter._tplAnalysis.structure || [])" :key="si" style="font-size:12px;color:#555;line-height:1.8;margin-bottom:6px;border-bottom:1px dashed var(--border-light);padding-bottom:4px;">
                    <div><strong>{{ section.大题 }}</strong>（{{ section.题型 }}）</div>
                    <div>小题：{{ section.小题数量 }}道 × {{ section.每小题分值 }}分 = {{ section.大题分值 }}分</div>
                    <div>设问：{{ section.设问风格 }} | 难度：{{ section.难度 }}</div>
                  </div>
                </div>
                <div class="detail-item">
                  <strong>📊 总题数：</strong>
                  <span style="font-size:13px;color:#555;">{{ viewingChapter._tplAnalysis.总题数 || viewingChapter._tplAnalysis.questionCount || 0 }} 道</span>
                </div>
                <div class="detail-item">
                  <strong>💯 总分：</strong>
                  <span style="font-size:13px;color:#555;">{{ viewingChapter._tplAnalysis.总分 || viewingChapter._tplAnalysis.totalScore || 0 }} 分</span>
                </div>
              </template>
              <template v-else>
                <!-- ✅ 教材分析字段 - 原有字段可编辑 -->
                <div class="detail-item">
                  <strong>🏷️ 核心主题：</strong>
                  <input type="text" v-model="viewingChapter.coreTopics" 
                    style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;" />
                </div>
                <div class="detail-item" v-if="viewingChapter.visualDescription">
                  <strong>🖼️ 图表描述：</strong>
                  <input type="text" v-model="viewingChapter.visualDescription" 
                    style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;" />
                </div>
                <div class="detail-item" v-if="viewingChapter.formulas && viewingChapter.formulas.length > 0">
                  <strong>📐 公式：</strong>
                  <textarea v-model="viewingChapter.formulasText" rows="3"
                    style="width:100%;font-size:12px;padding:8px;border:1px solid #ddd;border-radius:6px;resize:vertical;font-family:inherit;box-sizing:border-box;"
                    placeholder="每行一个公式"></textarea>
                </div>
                <div class="detail-item" v-if="viewingChapter.knowledgePoints && viewingChapter.knowledgePoints.length > 0">
                  <strong>📍 知识点：</strong>
                  <textarea v-model="viewingChapter.knowledgePointsText" rows="4"
                    style="width:100%;font-size:12px;padding:8px;border:1px solid #ddd;border-radius:6px;resize:vertical;font-family:inherit;box-sizing:border-box;"
                    placeholder="每行一个知识点"></textarea>
                </div>
                
                <!-- 🔧 新增字段 - 只读显示，根据分析结果显示 -->
                <div class="detail-item" v-if="viewingChapter.knowledgeHierarchy && viewingChapter.knowledgeHierarchy.length > 0">
                  <strong>🎯 知识层级：</strong>
                  <div style="margin-top:8px;background:#f8f9fa;padding:10px;border-radius:6px;max-height:200px;overflow-y:auto;">
                    <div v-for="(bc, bcIdx) in viewingChapter.knowledgeHierarchy" :key="bcIdx" 
                      style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border-light);">
                      <div style="font-size:13px;color:var(--primary-light);font-weight:600;margin-bottom:6px;">
                        {{ bcIdx + 1 }}. {{ bc.bigConcept || '未命名大概念' }}
                      </div>
                      
                      <div v-for="(ck, ckIdx) in (bc.coreKnowledge || [])" :key="ckIdx" 
                        style="margin-left:16px;margin-bottom:6px;">
                        <div style="font-size:12px;font-weight:600;color:#34495e;">
                          {{ ckIdx + 1 }}. {{ ck.name || ck.coreConcept || '未命名核心知识' }}
                          <span v-if="ck.level" style="margin-left:8px;padding:2px 6px;background:#3498db;color:white;border-radius:3px;font-size:10px;">{{ ck.level }}</span>
                        </div>
                        <div v-if="ck.specificConcepts && ck.specificConcepts.length > 0" 
                          style="font-size:11px;color:#666;margin-left:16px;margin-top:2px;">
                          具体概念：{{ ck.specificConcepts.join('、') }}
                        </div>
                        <div v-if="ck.suggestedQuestionTypes && ck.suggestedQuestionTypes.length > 0" 
                          style="font-size:11px;color:var(--text-muted);margin-left:16px;margin-top:2px;">
                          建议题型：{{ ck.suggestedQuestionTypes.join('、') }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="detail-item" v-if="viewingChapter.competency">
                  <strong>🎓 能力层次：</strong>
                  <div style="padding:6px 10px;background:#f8f9fa;border-radius:6px;font-size:13px;color:#555;">
                    {{ viewingChapter.competency }}
                  </div>
                </div>
                
                <div class="detail-item" v-if="viewingChapter.style">
                  <strong>🎨 风格：</strong>
                  <div style="padding:6px 10px;background:#f8f9fa;border-radius:6px;font-size:13px;color:#555;">
                    {{ viewingChapter.style }}
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
        <div class="analysis-footer" style="flex-shrink: 0; display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
          <button class="btn btn-delete hide-on-mobile" @click="discardSingleChapterAnalysis" style="font-size:11px;padding:4px 10px;">🗑️ 丢弃分析</button>
          <div class="modal-actions">
            <button class="btn" @click="showChapterAnalysisModal = false">取消</button>
            <button class="btn-primary" @click="saveChapterAnalysis"><span class="icon-desktop">💾</span><span class="icon-mobile">✅</span> 保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 🔧 课时切分确认弹窗 -->
    <div v-if="showPeriodConfirmModal" class="modal-mask" @click.self="showPeriodConfirmModal = false">
      <div class="modal large-modal" style="max-width: 600px;">
        <h3>📚 课时切分确认</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">
          系统检测到该单元包含 <strong>{{ pendingPeriods.length }} 个课时</strong>，建议拆分为独立课时练习。
          每个课时只覆盖对应知识点的内容，题量和难度更合理。
        </p>
        <div style="max-height: 300px; overflow-y: auto;">
          <div v-for="(p, i) in pendingPeriods" :key="p.id"
            style="display:flex;align-items:center;padding:8px 12px;margin:4px 0;background:var(--bg-card);border:1px solid var(--border-light);border-radius:6px;">
            <span style="font-weight:600;min-width:60px;color:var(--accent);">课时{{ i + 1 }}</span>
            <span style="flex:1;">{{ p.periodName }}</span>
            <span style="color:var(--text-muted);font-size:12px;margin-left:8px;">{{ p.kpCount }} 个知识点</span>
          </div>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn" @click="cancelPeriodSplit">不拆分，整体生成</button>
          <button class="btn-primary" @click="confirmPeriodSplit">确认拆分，逐课时生成</button>
        </div>
      </div>
    </div>

    <!-- ✨ 蓝图确认弹窗 -->
    <div v-if="showBlueprintConfirmModal" class="modal-mask" @click.self="showBlueprintConfirmModal = false">
      <div class="modal large-modal" style="max-width: 900px;">
        <h3>{{ blueprintModalConfig.title }}</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:8px;">
          {{ blueprintModalConfig.subtitle }}
        </p>
        <p style="color:var(--warning);font-size:12px;margin-bottom:16px;background:#fef9e7;padding:8px 12px;border-radius:6px;">
          {{ blueprintModalConfig.checkHint }}
        </p>
        
        <!-- 蓝图统计信息 -->
        <div v-if="pendingBlueprintStats" style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
          <div style="padding:10px 16px;background:var(--info-light);border-radius:8px;font-size:13px;">
            <span v-if="pendingGenType === 'dictation'">📝 词汇数：</span>
            <span v-else>📚 知识点：</span>
            <strong>{{ pendingBlueprintStats.knowledgePointCount }}</strong>个
          </div>
          <template v-if="isExamTypeForModal">
            <div style="padding:10px 16px;background:var(--success-light);border-radius:8px;font-size:13px;">
              📝 总题数：<strong>{{ pendingBlueprintStats.totalQuestions }}</strong>
            </div>
            <div style="padding:10px 16px;background:var(--warning-light);border-radius:8px;font-size:13px;">
              🟢 基础：<strong>{{ pendingBlueprintStats.easyPercent }}%</strong>
              🟡 中等：<strong>{{ pendingBlueprintStats.mediumPercent }}%</strong>
              🔴 较难：<strong>{{ pendingBlueprintStats.hardPercent }}%</strong>
            </div>
            <div style="padding:10px 16px;background:#fce4ec;border-radius:8px;font-size:13px;">
              💯 总分：<strong>{{ pendingBlueprintStats.totalScore }}</strong>
            </div>
          </template>
        </div>

        <!-- 🔧 操作按钮行 -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:13px;color:#666;">
            共 <strong>{{ parsedBlueprintForPreview.length }}</strong> {{ isExamTypeForModal ? '题' : '项' }}，可直接在表格中修改
          </span>
          <div style="display:flex;gap:6px;">
            <button class="btn-small" v-if="lastDeletedQuestion" @click="undoDeleteQuestion" style="background:var(--warning-light);color:var(--warning);border-color:#f0c78e;" title="撤销删除">↩️ 撤销删除</button>
            <button class="btn-small" @click="addBlueprintQuestion" style="background:var(--success-light);color:var(--success);border-color:#a5d6a7;">➕ 添加{{ isExamTypeForModal ? '题目' : '条目' }}</button>
          </div>
        </div>
        
        <!-- 蓝图编辑区 -->
        <div class="blueprint-editor" style="margin-bottom:16px;">
          <textarea 
            v-model="editedBlueprintText" 
            rows="20" 
            style="width:100%;font-family:'Consolas',monospace;font-size:12px;padding:12px;border:1px solid #ddd;border-radius:8px;resize:vertical;"
            placeholder="编辑蓝图..."
          ></textarea>
        </div>
        
        <!-- 逐项预览表格 -->
        <div v-if="parsedBlueprintForPreview.length > 0" style="max-height:300px;overflow-y:auto;margin-bottom:16px;border:1px solid var(--border-light);border-radius:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:var(--bg);position:sticky;top:0;">
                <th style="padding:8px;border-bottom:1px solid var(--border-light);text-align:left;">序号</th>
                <th v-if="isExamTypeForModal" style="padding:8px;border-bottom:1px solid var(--border-light);text-align:left;">题型</th>
                <th style="padding:8px;border-bottom:1px solid var(--border-light);text-align:left;">{{ isExamTypeForModal ? '知识点' : (pendingGenType === 'dictation' ? '词汇' : '知识点') }}</th>
                <th v-if="isExamTypeForModal" style="padding:8px;border-bottom:1px solid var(--border-light);text-align:left;">难度</th>
                <th v-if="isExamTypeForModal" style="padding:8px;border-bottom:1px solid var(--border-light);text-align:left;">分值</th>
                <th v-if="isExamTypeForModal" style="padding:8px;border-bottom:1px solid var(--border-light);text-align:left;">来源</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(q, qIdx) in parsedBlueprintForPreview" :key="q.number + '_' + qIdx" style="border-bottom:1px solid #f0f0f0;" :style="{background: q._deleted ? '#fce4ec' : 'transparent'}">
                <td style="padding:6px 8px;">{{ q.number }}</td>
                <!-- 考试类：题型下拉 -->
                <td v-if="isExamTypeForModal" style="padding:4px 6px;">
                  <select 
                    v-model="q.type" 
                    style="width:100%;padding:4px;font-size:12px;border:1px solid #ddd;border-radius:4px;"
                    @change="onBlueprintCellChange(qIdx)"
                  >
                    <optgroup v-if="recommendedQuestionTypes.length > 0" label="📋 推荐题型">
                      <option v-for="t in recommendedQuestionTypes" :key="'rec_' + t" :value="t">{{ t }}</option>
                    </optgroup>
                    <optgroup label="📝 全部题型">
                      <option v-for="t in availableQuestionTypes" :key="'all_' + t" :value="t">{{ t }}</option>
                    </optgroup>
                  </select>
                </td>
                <!-- 知识点/词汇（可编辑文本） -->
                <td style="padding:4px 6px;">
                  <input 
                    type="text" 
                    v-model="q.knowledgePoint" 
                    style="width:100%;padding:4px;font-size:12px;border:1px solid #ddd;border-radius:4px;"
                    @change="onBlueprintCellChange(qIdx)"
                  />
                </td>
                <td v-if="isExamTypeForModal" style="padding:4px 6px;">
                  <select 
                    v-model="q.difficulty" 
                    style="width:100%;padding:4px;font-size:12px;border:1px solid #ddd;border-radius:4px;"
                    :style="{color: q.difficulty === '基础' ? 'var(--success)' : q.difficulty === '中等' ? '#f39c12' : 'var(--danger)'}"
                    @change="onBlueprintCellChange(qIdx)"
                  >
                    <option value="基础">基础</option>
                    <option value="中等">中等</option>
                    <option value="较难">较难</option>
                  </select>
                </td>
                <td v-if="isExamTypeForModal" style="padding:4px 6px;">
                  <input 
                    type="number" 
                    v-model.number="q.score" 
                    min="1" 
                    max="50"
                    style="width:50px;padding:4px;font-size:12px;border:1px solid #ddd;border-radius:4px;"
                    @change="onBlueprintCellChange(qIdx)"
                  />
                </td>
                <td v-if="isExamTypeForModal" style="padding:4px 6px;color:var(--text-muted);">
                  <input 
                    type="text" 
                    v-model="q.sourceChapter" 
                    style="width:100%;padding:4px;font-size:12px;border:1px solid #ddd;border-radius:4px;color:var(--text-muted);"
                    @change="onBlueprintCellChange(qIdx)"
                  />
                </td>
                <td style="padding:4px 6px;text-align:center;">
                  <button 
                    class="btn-small btn-delete" 
                    @click="removeBlueprintQuestion(qIdx)"
                    title="删除此项"
                    style="padding:2px 8px;"
                  >🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 无预览数据时的提示 -->
        <div v-else-if="pendingBlueprint" style="margin-bottom:16px;padding:16px;background:var(--bg);border-radius:8px;text-align:center;color:var(--text-muted);">
          📝 蓝图已生成，请在编辑区查看和修改文本内容后确认
        </div>
        
        <div class="modal-actions">
          <button class="btn" @click="cancelBlueprintConfirm">❌ 取消</button>
          <button class="btn" @click="regenerateBlueprint">🔄 重新生成蓝图</button>
          <button class="btn-primary" @click="confirmBlueprintAndGenerate">✅ 确认并生成</button>
        </div>
      </div>
    </div>

    <!-- 知识点提取弹窗 -->
    <div v-if="showKnowledgeModal" class="modal-mask" @click.self="showKnowledgeModal = false">
      <div class="modal">
        <h3>📖 知识点管理</h3>
        <p><strong>{{ currentBook?.name }} - {{ currentChapter?.title }}</strong></p>
        <div class="form-group">
          <label>知识点（每行一个）</label>
          <textarea v-model="editingKnowledge" rows="8" placeholder="输入知识点，每行一个"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="copyKnowledgePoints">📋 复制全部</button>
          <button class="btn" @click="exportKnowledgePoints">📤 导出TXT</button>
          <button class="btn" @click="showKnowledgeModal = false">取消</button>
          <button class="btn-primary" @click="saveKnowledge">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick, h } from 'vue';
import { useDialog } from '../composables/useDialog.js';
import { useMobile } from '../composables/useMobile.js';
import { apiConfig, getCurrentEngineConfig, getCurrentEngineConfigEnhanced } from '../config/apiConfig.js';  // 🔧 新增：导入 apiConfig
import { getStoragePath } from '../utils/pathHelper.js';  // ✨ 存储路径工具
import { 
  styleOptions,
  styleInstructions,
  genTypeOptions,
  genTypeTemplates,
  scopeOptions,
  granularityOptions,
  subjectCoreCompetencies
} from '../config/expertKnowledge.js';
import { useAiGenerator } from '../composables/useAiGenerator.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, AlignmentType } from 'docx';
import { createDefaultSectionProperties, getPrintCss, convertFormulasInHtml, parseMarkdownToTextRuns } from '../utils/wordExporter.js';
import { buildTianZiGeMarker, htmlToDocxBlob } from '../utils/docxBuilder.js';
import { injectDrawingML, TZG_MARKER, FLT_MARKER } from '../utils/drawingMLShapes.js';
import storage from '../utils/storage';
import { pushDocHistory, pushGeneratedDocs, isCloudConfigured } from '../utils/cloudStorage';
import { useTextbookStore } from '../stores/textbookStore';
import { useTemplateStore } from '../stores/templateStore.js';
import { useInstructionStore } from '../stores/instructionStore.js';
import { getMatchingBlockInstructions } from '../config/instructionLib.js';
import { APP_EVENTS } from '../constants/events.js';
import PdfPreview from '../components/PdfPreview.vue';
import RichTextEditor from '../components/RichTextEditor.vue';  // 🔧 新增：富文本编辑器

defineOptions({ name: 'GenerateModule' });

const readFontSizeHp = (el) => {
  try {
    const px = parseFloat(getComputedStyle(el).getPropertyValue('font-size'));
    if (!px || px <= 0) return 0;
    return Math.round(Math.round(px * 0.75) * 2);
  } catch { return 0; }
};

// 勾选状态
const sectionCollapsed = ref({ textbook: false, template: false, instruction: false });

// 获取当前选中教材的学科信息
const getSelectedBookSubject = () => {
  // 🔧 修复：使用递归检查（与 hasAnySelected 一致），而非仅检查顶层节点
  // 🔧 多学科修复：用 pickPrimaryBook 替代 .find()，避免总取列表第一项
  const selectedBooks = textbookStore.textbooks.filter(b => hasAnySelected(b.outline)).map(b => ({
    ...b,
    selectedChapters: getSelectedChapters(b.outline).filter(ch => ch._selectedForAnalysis !== false)
  })).filter(b => b.selectedChapters.length > 0);
  const selectedBook = pickPrimaryBook(selectedBooks);
  if (selectedBook) {
    return `${selectedBook.stage}·${selectedBook.subject}`;
  }
  return '已选';
};

// 配置选项
const scopeType = ref('');
const mergeChapters = ref(true);  // 🔧 多章节合并出卷开关（默认合并；false=逐章拆分）
const propositionStyle = ref('');
const genTypes = ref([]);
const specialSubType = ref('');  // 🎯 专项子类型（仅 genType=special 时生效）
const generateGranularity = ref('');
const totalScore = ref('');
const allowOriginalQuestions = ref(true);
const batchCount = ref(1);  // 同类型一次生成份数，默认1
// 🔧 题型配置默认空，由指令库「生成-题型分布建议」按学科×学段自动填充
const questionTypes = ref([]);
const lastSyncedTypeKey = ref('');  // 追踪上次同步的学科+类型，避免覆盖用户手动修改
const difficultyLevels = ref([
  { name: '基础题', selected: true, percentage: null },
  { name: '中档题', selected: true, percentage: null },
  { name: '提高题', selected: true, percentage: null }
]);

// 🔧 命题范围名称轮换池——避免标题千篇一律（如全是干巴巴的"期中"）
const scopeLabelPools = {
  midterm: ['期中综合测试', '阶段综合测评', '中期学业检测'],
  final:   ['期末综合测试', '学期综合测评', '期末学业检测'],
  topic:   ['专题复习', '专项复习', '专题训练'],
};
const _scopeLabelCounters = {};
const pickScopeLabel = (scopeTypeVal, chapters) => {
  const pool = scopeLabelPools[scopeTypeVal];
  if (!pool || !chapters?.length) return null;
  const chapterKey = chapters.map(c => c.title).join('|').slice(0, 80);
  const key = `${scopeTypeVal}__${chapterKey}`;
  _scopeLabelCounters[key] = (_scopeLabelCounters[key] || 0) % pool.length;
  return pool[_scopeLabelCounters[key]++];
};

// 弹窗状态
const showScopeModal = ref(false);
const showStyleModal = ref(false);
const showGenTypeModal = ref(false);
const showSpecialSubTypeModal = ref(false);  // 🎯 专项子类型弹窗
const showGranularityModal = ref(false);
const showDetailConfigModal = ref(false);
const showPreview = ref(false);
const showEditor = ref(false);
const showInstructionLibModal = ref(false);
const showSaveToLibModal = ref(false);
// ✨ 蓝图确认相关
const showBlueprintConfirmModal = ref(false);
const pendingBlueprint = ref('');          // 原始蓝图文本
const editedBlueprintText = ref('');       // 编辑后的蓝图文本
const parsedBlueprintForPreview = ref([]); // 解析后的蓝图（用于预览表格）
const pendingBlueprintStats = ref(null);   // 蓝图统计信息
const pendingGenerateMode = ref('single'); // 生成模式
const pendingGenType = ref(null);          // 待生成的类型
const showKnowledgeModal = ref(false);

// 🔧 课时切分相关
const showPeriodConfirmModal = ref(false);       // 课时确认弹窗
const pendingPeriods = ref([]);                  // 检测到的课时列表
const confirmedPeriods = ref([]);                // 用户确认/调整后的课时
const multiPeriodResults = ref(null);            // 多课时生成结果
const activePeriodTab = ref(0);                  // 当前激活的课时 tab

// 🔧 修复：用响应式变量代替 window._pendingGenerateContext
const pendingGenerateContext = ref(null);
const chapterAnalysisModalRef = ref(null);
const analysisResultModalRef = ref(null);
let isAnalysisResultDragging = false;
let analysisResultDragOffset = { x: 0, y: 0 };

const startAnalysisResultDrag = (e) => {
  isAnalysisResultDragging = true;
  const rect = analysisResultModalRef.value?.getBoundingClientRect();
  if (!rect) return;
  analysisResultDragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  document.addEventListener('mousemove', handleAnalysisResultDrag);
  document.addEventListener('mouseup', stopAnalysisResultDrag);
  e.preventDefault();
};

const handleAnalysisResultDrag = (e) => {
  if (!isAnalysisResultDragging || !analysisResultModalRef.value) return;
  const x = e.clientX - analysisResultDragOffset.x;
  const y = e.clientY - analysisResultDragOffset.y;
  analysisResultModalRef.value.style.left = x + 'px';
  analysisResultModalRef.value.style.top = y + 'px';
  analysisResultModalRef.value.style.transform = 'none';
  analysisResultModalRef.value.style.margin = '0';
};

const stopAnalysisResultDrag = () => {
  isAnalysisResultDragging = false;
  document.removeEventListener('mousemove', handleAnalysisResultDrag);
  document.removeEventListener('mouseup', stopAnalysisResultDrag);
};

// 调整大小
let isAnalysisResultResizing = false;
let analysisResultResizeStart = { x: 0, y: 0, width: 0, height: 0 };

const startAnalysisResultResize = (e) => {
  isAnalysisResultResizing = true;
  const rect = analysisResultModalRef.value?.getBoundingClientRect();
  if (!rect) return;
  analysisResultResizeStart = { x: e.clientX, y: e.clientY, width: rect.width, height: rect.height };
  document.addEventListener('mousemove', handleAnalysisResultResize);
  document.addEventListener('mouseup', stopAnalysisResultResize);
  e.preventDefault();
  e.stopPropagation();
};

const handleAnalysisResultResize = (e) => {
  if (!isAnalysisResultResizing || !analysisResultModalRef.value) return;
  const newWidth = Math.max(600, analysisResultResizeStart.width + (e.clientX - analysisResultResizeStart.x));
  const newHeight = Math.max(400, analysisResultResizeStart.height + (e.clientY - analysisResultResizeStart.y));
  analysisResultModalRef.value.style.width = newWidth + 'px';
  analysisResultModalRef.value.style.height = newHeight + 'px';
};

const stopAnalysisResultResize = () => {
  isAnalysisResultResizing = false;
  document.removeEventListener('mousemove', handleAnalysisResultResize);
  document.removeEventListener('mouseup', stopAnalysisResultResize);
};
// 🔧 新增：多栏分割预览相关
const showColumnSplitModal = ref(false);
const columnSplitResult = ref(null);        // splitColumns 返回的原始结果 { columns, splits, regions, sub_images }
const columnSplitOriginBase64 = ref('');    // 原始图片的 base64
const columnSplitLines = ref([]);           // 切割线列表 [{ position: 百分比, x: 像素坐标 }]
const columnSplitPreviewCols = ref([]);     // 切割后的栏预览 [{ style, subBase64, xRange }]
const columnSplitOriginalImagePath = ref(''); // 原始图片路径（用于重新切割）
const columnSplitOriginWidth = ref(0);      // 原图宽度（像素）
const columnSplitOriginHeight = ref(0);     // 原图高度（像素）
const splitCanvasContainer = ref(null);
const splitOriginImage = ref(null);
const columnSplitPreviewRef = ref(null);
const columnSplitCallback = ref(null);      // 确认后的回调函数
const columnSplitConfirmed = ref(false);     // 当前页是否已确认切割预览
const columnSplitSkip = ref(false);          // 当前页是否跳过切割，整页OCR
const columnSplitAllPages = ref([]);         // 🔧 新增：所有待切割页面数据
const columnSplitCurrentPage = ref(0);       // 🔧 新增：当前显示的页面索引
const columnSplitSubject = ref('');         // 学科（用于OCR后处理）
const columnSplitStage = ref('');           // 学段（用于OCR后处理）
const showUncertainPopup = ref(false);
// PDF对照浮窗
const showAnalysisPDF = ref(false);
const analysisPDFPath = ref('');
const analysisPDFPage = ref(1);
const analysisPDFRef = ref(null);
const analysisPDFPos = ref({ x: 100, y: 100 });
const analysisPDFSize = ref({ width: 450, height: 600 });

const openAnalysisPDFPreview = () => {
  // 获取PDF路径
  let pdfPath = '';
  if (analysisResultType.value === 'template' && analysisResultData.value?.tplRef) {
    pdfPath = analysisResultData.value.tplRef.pdfPath || analysisResultData.value.tplRef.path || '';
  } else if (analysisResultType.value === 'textbook' && analysisBooks.value?.length > 0) {
    pdfPath = analysisBooks.value[0].pdfPath || analysisBooks.value[0].path || '';
  }
  
  if (!pdfPath && analysisResultData.value?.tplRef?.path) {
    pdfPath = analysisResultData.value.tplRef.path;
  }
  
  if (!pdfPath) {
    showAlertDialogFn('未找到原始PDF路径，请检查教材/模板数据');
    return;
  }
  
  analysisPDFPath.value = pdfPath;
  console.log('📄 PDF对照浮窗路径:', pdfPath, '起始页:', analysisPDFPage.value);
  
  // 定位到第一个已选章节的起始页
  if (analysisResultType.value === 'template' && analysisResultData.value?.tplRef) {
    const chapters = getSelectedChapters(analysisResultData.value.tplRef.outline || []);
    analysisPDFPage.value = chapters[0]?.start || 1;
  } else if (analysisBooks.value?.length > 0) {
    const ch = analysisBooks.value[0].selectedChapters?.[0];
    analysisPDFPage.value = ch?.start || 1;
  }
  
  // 位置：默认出现在确认弹窗右侧
  const modalRect = analysisResultModalRef.value?.getBoundingClientRect();
  if (modalRect) {
    analysisPDFPos.value = {
      x: Math.min(modalRect.right + 20, window.innerWidth - 470),
      y: modalRect.top
    };
  }
  
  showAnalysisPDF.value = true;
};

// PDF浮窗拖动
let isAnalysisPDFDragging = false;
let analysisPDFDragStart = { x: 0, y: 0 };

const startAnalysisPDFDrag = (e) => {
  isAnalysisPDFDragging = true;
  analysisPDFDragStart = { x: e.clientX - analysisPDFPos.value.x, y: e.clientY - analysisPDFPos.value.y };
  document.addEventListener('mousemove', handleAnalysisPDFDrag);
  document.addEventListener('mouseup', stopAnalysisPDFDrag);
  e.preventDefault();
};

const handleAnalysisPDFDrag = (e) => {
  if (!isAnalysisPDFDragging) return;
  analysisPDFPos.value = {
    x: Math.max(0, Math.min(e.clientX - analysisPDFDragStart.x, window.innerWidth - analysisPDFSize.value.width)),
    y: Math.max(0, Math.min(e.clientY - analysisPDFDragStart.y, window.innerHeight - 50))
  };
};

const stopAnalysisPDFDrag = () => {
  isAnalysisPDFDragging = false;
  document.removeEventListener('mousemove', handleAnalysisPDFDrag);
  document.removeEventListener('mouseup', stopAnalysisPDFDrag);
};

// PDF浮窗调整大小
let isAnalysisPDFResizing = false;
let analysisPDFResizeStart = { x: 0, y: 0, width: 0, height: 0 };

const startAnalysisPDFResize = (e) => {
  isAnalysisPDFResizing = true;
  analysisPDFResizeStart = { x: e.clientX, y: e.clientY, width: analysisPDFSize.value.width, height: analysisPDFSize.value.height };
  document.addEventListener('mousemove', handleAnalysisPDFResize);
  document.addEventListener('mouseup', stopAnalysisPDFResize);
  e.preventDefault();
  e.stopPropagation();
};

const handleAnalysisPDFResize = (e) => {
  if (!isAnalysisPDFResizing) return;
  analysisPDFSize.value = {
    width: Math.max(350, analysisPDFResizeStart.width + (e.clientX - analysisPDFResizeStart.x)),
    height: Math.max(400, analysisPDFResizeStart.height + (e.clientY - analysisPDFResizeStart.y))
  };
};

const stopAnalysisPDFResize = () => {
  isAnalysisPDFResizing = false;
  document.removeEventListener('mousemove', handleAnalysisPDFResize);
  document.removeEventListener('mouseup', stopAnalysisPDFResize);
};
const rawTextTextarea = ref(null);
const uncertainPositions = ref([]);
const uncertainCurrentIndex = ref(0);

const uncertainCount = computed(() => {
  if (!analysisResultData.value?.rawText) return 0;
  return (analysisResultData.value.rawText.match(/【？】/g) || []).length;
});

const updateUncertainList = () => {
  const text = analysisResultData.value?.rawText || '';
  const positions = [];
  let idx = text.indexOf('【？】');
  while (idx !== -1) {
    positions.push(idx);
    idx = text.indexOf('【？】', idx + 1);
  }
  uncertainPositions.value = positions;
};

const jumpToUncertain = (direction) => {
  const textarea = rawTextTextarea.value;
  if (!textarea) return;
  
  const text = analysisResultData.value?.rawText || '';
  updateUncertainList();
  const positions = uncertainPositions.value;
  if (positions.length === 0) return;
  
  const currentPos = textarea.selectionStart;
  
  let targetIdx;
  if (direction === 'next') {
    const nextPos = positions.find(p => p > currentPos);
    if (nextPos !== undefined) {
      targetIdx = positions.indexOf(nextPos);
    } else {
      targetIdx = 0;
    }
  } else {
    const reversed = [...positions].reverse();
    const prevPos = reversed.find(p => p < currentPos);
    if (prevPos !== undefined) {
      targetIdx = positions.indexOf(prevPos);
    } else {
      targetIdx = positions.length - 1;
    }
  }
  
  uncertainCurrentIndex.value = targetIdx + 1;
  
  const markPos = positions[targetIdx];
  const start = Math.max(0, markPos - 2);
  textarea.focus();
  textarea.setSelectionRange(start, markPos + 4);
  textarea.scrollTop = textarea.scrollHeight * (markPos / text.length);
};

// 🔧 教材分析：每个章节独立的不确定文字跳转
const uncertainItemStates = ref({});

const updateUncertainForItem = (event, item) => {
  const text = item.rawText || '';
  if (!text.includes('【？】')) return;
  
  const key = text.substring(0, 20);
  if (!uncertainItemStates.value[key]) {
    uncertainItemStates.value[key] = { currentIdx: 0, positions: [] };
  }
  
  const positions = [];
  let idx = text.indexOf('【？】');
  while (idx !== -1) {
    positions.push(idx);
    idx = text.indexOf('【？】', idx + 1);
  }
  uncertainItemStates.value[key].positions = positions;
};

const jumpToUncertainInItem = (item, direction) => {
  const text = item.rawText || '';
  if (!text.includes('【？】')) return;
  
  const key = text.substring(0, 20);
  updateUncertainForItem(null, item);
  const state = uncertainItemStates.value[key];
  if (!state || state.positions.length === 0) return;
  
  const positions = state.positions;
  
  if (direction === 'next') {
    state.currentIdx = (state.currentIdx + 1) % positions.length;
  } else {
    state.currentIdx = (state.currentIdx - 1 + positions.length) % positions.length;
  }
  
  const markPos = positions[state.currentIdx];
  const start = Math.max(0, markPos - 2);
  
  // 找到当前章节的 textarea
  setTimeout(() => {
    const textareas = document.querySelectorAll('.chapter-analysis-left textarea, .template-left-column textarea');
    let targetTextarea = null;
    textareas.forEach(ta => {
      if (ta.value === text || ta.value.substring(0, 20) === text.substring(0, 20)) {
        targetTextarea = ta;
      }
    });
    if (targetTextarea) {
      targetTextarea.focus();
      targetTextarea.setSelectionRange(start, markPos + 4);
    }
  }, 50);
};

const clearAllUncertainMarks = () => {
  if (!analysisResultData.value?.rawText) return;
  analysisResultData.value.rawText = analysisResultData.value.rawText.replace(/【？】/g, '');
  uncertainPositions.value = [];
  uncertainCurrentIndex.value = 0;
};
const allPagesConfirmed = computed(() => {
  if (!columnSplitAllPages.value || columnSplitAllPages.value.length === 0) return false;
  return columnSplitAllPages.value.every(p => p._confirmed || p._skipSplit);
});
const confirmedPageCount = computed(() => {
  if (!columnSplitAllPages.value) return 0;
  return columnSplitAllPages.value.filter(p => p._confirmed || p._skipSplit).length;
});
const showChapterAnalysisModal = computed({
  get: () => textbookStore.showChapterAnalysis,
  set: (val) => {
    if (!val) textbookStore.closeChapterAnalysis();
  }
});

// 弹窗拖动
let isChapterDragging = false;
let chapterDragOffset = { x: 0, y: 0 };

const startChapterDrag = (e) => {
  isChapterDragging = true;
  const rect = chapterAnalysisModalRef.value?.getBoundingClientRect();
  if (!rect) return;
  chapterDragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  document.addEventListener('mousemove', handleChapterDrag);
  document.addEventListener('mouseup', stopChapterDrag);
  e.preventDefault();
};

const handleChapterDrag = (e) => {
  if (!isChapterDragging || !chapterAnalysisModalRef.value) return;
  const x = e.clientX - chapterDragOffset.x;
  const y = e.clientY - chapterDragOffset.y;
  chapterAnalysisModalRef.value.style.left = x + 'px';
  chapterAnalysisModalRef.value.style.top = y + 'px';
  chapterAnalysisModalRef.value.style.transform = 'none';
};

// ==================== 🔧 多栏分割预览与手动调整 ====================

// 图片加载完成后初始化切割线
const onSplitImageLoaded = () => {
  if (!splitOriginImage.value) return;
  columnSplitOriginWidth.value = splitOriginImage.value.naturalWidth;
  columnSplitOriginHeight.value = splitOriginImage.value.naturalHeight;
  
  // 更新切割线的百分比位置
  const width = columnSplitOriginWidth.value;
  if (width > 0 && columnSplitLines.value.length > 0) {
    columnSplitLines.value = columnSplitLines.value.map(line => ({
      ...line,
      position: (line.x / width) * 100
    }));
  }
  
  updateColumnSplitPreview();
};

// 根据切割线更新预览
const updateColumnSplitPreview = () => {
  const width = columnSplitOriginWidth.value;
  if (!width || columnSplitLines.value.length === 0) {
    columnSplitPreviewCols.value = [];
    return;
  }

  // 排序切割线
  const sortedLines = [...columnSplitLines.value].sort((a, b) => a.x - b.x);
  
  // 构建区域：从0到第一条切割线，切割线之间，最后一条切割线到width
  const regions = [];
  let prevX = 0;
  for (let i = 0; i < sortedLines.length; i++) {
    regions.push({ x1: prevX, x2: sortedLines[i].x });
    prevX = sortedLines[i].x;
  }
  regions.push({ x1: prevX, x2: width });

  // 过滤太窄的区域（小于50px）
  const validRegions = regions.filter(r => r.x2 - r.x1 >= 50);
  
  // 更新预览
  columnSplitPreviewCols.value = validRegions.map((r, idx) => ({
    style: {
      left: (r.x1 / width * 100) + '%',
      width: ((r.x2 - r.x1) / width * 100) + '%',
      top: '0',
      height: '100%'
    },
    subBase64: null,  // 确认后才切割
    xRange: `${Math.round(r.x1)}px - ${Math.round(r.x2)}px (宽${Math.round(r.x2 - r.x1)}px)`
  }));
};

// 开始拖动切割线
const startDragSplitLine = (e, idx) => {
  e.preventDefault();
  const container = splitCanvasContainer.value;
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const containerWidth = containerRect.width;
  const originWidth = columnSplitOriginWidth.value;
  if (!originWidth) return;

  const onMouseMove = (moveEvent) => {
    const offsetX = moveEvent.clientX - containerRect.left;
    const ratio = offsetX / containerWidth;
    const newX = Math.round(ratio * originWidth);
    
    // 限制范围：20px 到 width-20px
    const clampedX = Math.max(20, Math.min(originWidth - 20, newX));
    const newPosition = (clampedX / originWidth) * 100;
    
    columnSplitLines.value[idx] = {
      position: newPosition,
      x: clampedX
    };
    
    updateColumnSplitPreview();
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

// 添加切割线（在中间位置）
const addSplitLine = () => {
  const width = columnSplitOriginWidth.value;
  if (!width) return;
  
  // 找到最大间隙
  const sortedLines = [...columnSplitLines.value].sort((a, b) => a.x - b.x);
  let bestGap = 0;
  let bestMid = width / 2;
  
  let prevX = 0;
  for (const line of sortedLines) {
    const gap = line.x - prevX;
    if (gap > bestGap) {
      bestGap = gap;
      bestMid = prevX + gap / 2;
    }
    prevX = line.x;
  }
  // 最后一个间隙
  const lastGap = width - prevX;
  if (lastGap > bestGap) {
    bestGap = lastGap;
    bestMid = prevX + lastGap / 2;
  }
  
  const newPosition = (bestMid / width) * 100;
  columnSplitLines.value.push({ position: newPosition, x: Math.round(bestMid) });
  updateColumnSplitPreview();
};

// 删除切割线
const removeSplitLine = (idx) => {
  columnSplitLines.value.splice(idx, 1);
  updateColumnSplitPreview();
};

// 预览切割效果（在浏览器端用 Canvas 切割）
const previewColumnSplit = async () => {
  // 重置跳过切割状态（用户重新预览意味着想调整切割）
  columnSplitSkip.value = false;
  
  const img = splitOriginImage.value;
  if (!img) {
    console.warn('⚠️ previewColumnSplit: 图片未加载');
    return;
  }
  
  // 确保图片已完全加载
  if (!img.complete || !img.naturalWidth) {
    console.warn('⚠️ previewColumnSplit: 图片尚未完全加载，等待中...');
    await new Promise((resolve) => {
      img.onload = resolve;
      if (img.complete) resolve();
    });
  }
  
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  
  if (!width || !height) {
    console.warn('⚠️ previewColumnSplit: 图片尺寸无效', { width, height });
    return;
  }
  
  // 更新尺寸
  columnSplitOriginWidth.value = width;
  columnSplitOriginHeight.value = height;
  
  const sortedLines = [...columnSplitLines.value].sort((a, b) => a.x - b.x);
  
  // 构建切割区域
  const regions = [];
  let prevX = 0;
  for (const line of sortedLines) {
    if (line.x - prevX >= 50) {
      regions.push({ x1: prevX, x2: line.x });
    }
    prevX = line.x;
  }
  if (width - prevX >= 50) {
    regions.push({ x1: prevX, x2: width });
  }
  
  if (regions.length === 0) {
    console.warn('⚠️ previewColumnSplit: 没有有效切割区域');
    return;
  }
  
  console.log('🖼️ 预览切割：图片尺寸', width, 'x', height, '切割区域', regions);
  
  const updatedCols = [];
  
  for (let i = 0; i < regions.length; i++) {
    const { x1, x2 } = regions[i];
    const colWidth = x2 - x1;
    
    // 直接切割原图
    const colCanvas = document.createElement('canvas');
    // 🔧 优化：限制图片最大宽度为800px，平衡OCR准确性和速度
    const displayWidth = Math.min(Math.max(colWidth, 600), 800); // 最小600px，最大800px
    const scale = displayWidth / colWidth;
    colCanvas.width = displayWidth;
    colCanvas.height = Math.round(height * scale);
    const colCtx = colCanvas.getContext('2d');
    
    // 设置白色背景
    colCtx.fillStyle = '#ffffff';
    colCtx.fillRect(0, 0, colCanvas.width, colCanvas.height);
    
    // 高质量缩放
    colCtx.imageSmoothingEnabled = true;
    colCtx.imageSmoothingQuality = 'high';
    
    // 直接从原图切割
    colCtx.drawImage(
      img,
      x1, 0, colWidth, height,           // 源区域
      0, 0, displayWidth, colCanvas.height  // 目标区域
    );
    
    // 🔧 优化：降低图片质量从0.92到0.75，提升OCR速度（从60-80秒降到30-40秒）
    const subBase64 = colCanvas.toDataURL('image/jpeg', 0.75).replace(/^data:image\/jpeg;base64,/, '');
    
    console.log(`🖼️ 第${i + 1}栏: ${x1}-${x2}px, 输出 ${displayWidth}×${colCanvas.height}px, base64长度 ${subBase64.length}`);
    
    updatedCols.push({
      style: {
        left: (x1 / width * 100) + '%',
        width: (colWidth / width * 100) + '%',
        top: '0',
        height: '100%'
      },
      subBase64: subBase64,
      xRange: `${Math.round(x1)}px - ${Math.round(x2)}px (宽${Math.round(colWidth)}px)`
    });
  }
  
  columnSplitPreviewCols.value = updatedCols;
  columnSplitConfirmed.value = true;
  saveCurrentPageData();
};

// 重置为自动检测的切割线
const resetSplitLines = () => {
  if (columnSplitResult.value && columnSplitResult.value.splits) {
    columnSplitLines.value = columnSplitResult.value.splits.map(split => ({
      position: (split / columnSplitOriginWidth.value) * 100,
      x: split
    }));
    columnSplitConfirmed.value = false;
    updateColumnSplitPreview();
  }
};

/**
 * 🔧 重构：批量显示多栏切割预览弹窗（手动翻页模式）
 */
const showBatchColumnSplitDialog = (pendingPages, statusRef, callMultimodalAI) => {
  return new Promise((resolve) => {
    if (pendingPages.length === 0) {
      resolve(null);
      return;
    }
    
    // 初始化所有页面数据
    columnSplitAllPages.value = pendingPages.map(p => ({
      page: p.page,
      ocrResult: p.ocrResult,
      imageBase64: p.imageBase64,
      subject: p.subject,
      stage: p.stage,
      _confirmed: false,
      _lines: (p.ocrResult.splits || []).map(split => ({ position: 0, x: split })),
      _previewCols: [],
      _subImages: null
    }));
    
    columnSplitCurrentPage.value = 0;
    
    // 设置完成回调
    columnSplitCallback.value = async (allPagesData) => {
      if (allPagesData === null) {
        // 用户取消
        resolve(null);
        columnSplitCallback.value = null;
        columnSplitAllPages.value = [];
        return;
      }
      
      // 用户确认全部——逐页 OCR
      statusRef.value = '📷 正在逐页识别...';
      const results = [];
      
      let processedCount = 0;
      const totalConfirmed = allPagesData.filter(p => p._confirmed && p._subImages).length;
      
      for (const pageData of allPagesData) {
        if (!pageData._confirmed || !pageData._subImages) continue;
        
        // 🔧 GPU加速后，页之间使用智能等待（1秒-3秒）
        if (processedCount > 0) {
          await smartWaitForModel(1000, 3000);
        }
        
        processedCount++;
        statusRef.value = `📷 正在逐页识别：第${pageData.page}页（${processedCount}/${totalConfirmed}）`;
        
        let mergedColumnText = '';
        const subjectHints = {
          '语文': '\n【特别注意】\n- 拼音的声调符号（ˇ ˋ ˊ ˙）必须准确识别，不要遗漏\n- 多音字、形近字（如已/己/巳）要仔细辨认\n- 书名号《》、省略号……等标点符号保持原样\n- 文言文注释中的小字也要完整提取',
          '数学': '\n【特别注意】\n- 分数符号（½ ⅓ ¼）准确识别\n- 根号√、角度∠、平行∥等数学符号保持原样\n- 上下标（x²、H₂O）必须正确识别\n- 公式中的字母大小写严格区分',
          '英语': '\n【特别注意】\n- 字母大小写严格区分\n- 单词间空格保持\n- 音标符号准确识别\n- 标点符号保持英文格式',
          '物理': '\n【特别注意】\n- 单位符号（Ω、℃、kg/m³）准确识别\n- 公式中的上下标和希腊字母保持原样\n- 电路图中的元件符号用文字描述',
          '化学': '\n【特别注意】\n- 化学式中的下标（H₂O、CO₂）必须准确\n- 离子符号（Na⁺、Cl⁻）保持原样\n- 化学方程式中的箭头（→、↑、↓）准确识别',
        };
        
        const hint = subjectHints[pageData.subject] || '';
        
        const ocrPrompts = [
          `你是一个专业的OCR文字提取工具。请从图片中逐字逐句提取**所有**文字，必须完整无遗漏。

【强制要求】
- 必须提取图片中的每一个字、每一个标点符号、**每一个空格**
- 不要总结、不要概括、不要跳过任何内容
- 页眉、页脚、注释、习题、表格中的文字都要完整提取
- 如果有10行，就输出10行；有500字就输出500字
- **严格保留原文的所有空格、缩进、换行**

【排版标记保留规则】
1. 文字**加粗**的 → **重点**
2. 文字有**下划线**的 → [下划线]重点
3. 文字有**删除线**的 → ~~删除~~
4. 填空横线 → 保持原样：______ 或 ________
5. 上标数字（如①②③） → 保持原样
6. 表格 → | 单元格 | 单元格 |，每行换行
7. 拼音标注 → 拼音放在对应文字上方单独一行
8. 页眉/页脚 → [页眉]内容 或 [页脚]内容
9. 分隔线/分页 → ---
10. 选择题括号（   ）→ 保持原样，保留空白间距
11. 选项缩进（如A.前有空格）→ 保持原文的空白和缩进
12. 其余（颜色、字体、波浪线、着重号）→ 忽略，只提取文字

【提取规则】
1. 严格按照从上到下、从左到右的阅读顺序
2. 保留原文的标题层级（大标题、小标题）
3. 保留所有标点符号、特殊符号、声调标记
4. 不要添加任何解释、总结、评论
5. 形近字必须仔细辨认，不能模糊处理${hint}

【重要】
- **禁止使用任何XML标签（如<think>、</think>等）**
- **禁止输出任何思考过程、推理步骤、解释说明**
- **直接输出OCR结果，从第一个字符开始就是图片中的文字**
- 如果有任何内部推理，请在内心完成，绝对不要输出

请直接输出提取的完整文字内容（从图片的第一个字开始，不要有任何前缀）：`,
          `请逐字逐句完整提取图片中的所有文字内容，不要遗漏任何文字、标点、符号。保持原文格式。`,
          '请完整识别并输出图片中的所有文字。'
        ];
        
        // 🔧 优化：在第一栏之前增加预热延迟，避免连续请求导致模型不稳定
        // 🔧 优化：使用详细的OCR提示词，包含格式保留和过滤规则
        // 🔧 关键修复：使用与教材单页完全相同的 OCR prompt
        const simplePrompt = `请逐字逐句提取图片中的所有文字。

要求：
1. 只输出原文，不要任何解释、描述、总结
2. 保留所有格式：换行、空格、标点、题号、选项（A.B.C.D.）
3. 过滤无关内容：水印、纯页码、装饰符号
4. 保留有价值内容：章节标题、知识点注释、公式、表格
5. 不确定时加【？】标记，不要猜测
6. 图片模糊看不清 → 输出"DIM"
7. 无文字 → 输出"NO_TEXT"
8. 忽略拼音注音（如 zhǎn, dú 等），只提取汉字和标点

直接输出识别的文字：`;
        
        for (let ci = 0; ci < pageData._subImages.length; ci++) {
          const subBase64 = pageData._subImages[ci];
          if (!subBase64 || subBase64.length < 100) continue;
          
          // 🔧 关键修复：每页第一栏之前增加额外等待，确保模型状态稳定
          // 原因：教材分析证明连续调用可行，但跨页后需要更长恢复时间
          if (ci === 0 && processedCount > 0) {
            console.log(`   ⏰ 新页面第1栏，额外等待5秒确保模型就绪...`);
            await new Promise(r => setTimeout(r, 5000));
          }
          
          // 🔧 关键修复：移除栏与栏之间的模型卸载逻辑，保持模型状态稳定
          // 原因：教材分析证明连续调用是可行的，模型卸载反而导致第3栏失败
          if (ci > 0) {
            console.log(`   ⏰ 第${ci}栏完成，等待2秒后处理下一栏...`);
            await new Promise(r => setTimeout(r, 2000));  // 简单等待2秒，不卸载模型
          }
            
          // 🔧 新增：强制重试逻辑，确保每一栏 content 不为空
          let colText = '';
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              colText = await callMultimodalAI(simplePrompt, subBase64, {
                taskType: 'extraction',
                minContentLength: 200,
                columnInfo: ci + 1,
                think: false,
              });
              
              // 检查是否获取到有效内容
              if (colText && colText.trim().length >= 200) {
                console.log(`   ✅ 第${ci + 1}栏OCR成功: ${colText.trim().length}字（尝试${retryCount + 1}次）`);
                break; // 成功，退出重试循环
              } else {
                console.warn(`   ⚠️ 第${ci + 1}栏OCR结果过短(${colText?.trim().length || 0}字)，第${retryCount + 1}次重试...`);
                retryCount++;
                
                // 🔧 关键修复：根据重试次数动态调整等待时间
                if (retryCount < maxRetries) {
                  const waitTime = retryCount === 1 ? 2000 : 4000; // 第一次重试等待2秒，第二次等待4秒
                  console.log(`   ⏰ 重试前等待${waitTime/1000}秒...`);
                  await new Promise(r => setTimeout(r, waitTime));
                }
              }
            } catch (e) {
              console.error(`   ❌ 第${ci + 1}栏OCR调用失败（第${retryCount + 1}次）:`, e.message);
              retryCount++;
              
              // 🔧 关键修复：根据错误类型和重试次数动态调整等待时间
              if (retryCount < maxRetries) {
                let waitTime = 3000; // 默认等待3秒
                
                // 如果是500错误或超时，增加等待时间
                if (e.message.includes('500') || e.message.includes('timeout')) {
                  waitTime = 5000;
                  console.log(`   ⚠️ 检测到严重错误，增加等待时间到${waitTime/1000}秒`);
                }
                
                console.log(`   ⏰ 重试前等待${waitTime/1000}秒...`);
                await new Promise(r => setTimeout(r, waitTime));
              }
            }
          }
          
          // 🔧 最终检查：如果所有重试都失败，给出明确警告
          if (!colText || colText.trim().length < 200) {
            console.error(`   🚨 第${ci + 1}栏OCR完全失败！已重试${maxRetries}次，当前长度: ${colText?.trim().length || 0}字`);
            // 添加明确的错误标记，提醒用户手动补充
            colText = `\n⚠️[系统错误：第${ci + 1}栏OCR识别失败，请对照原始PDF手动补充此部分内容]\n`;
          }
            
          mergedColumnText += (mergedColumnText ? '\n' : '') + colText;
        }
        
        // 🔧 新增：后处理合并后的文字
        let finalText = mergedColumnText;
        if (finalText && pageData.subject) {
          finalText = postProcessOCR(finalText, pageData.subject, pageData.stage || '');
        }
        
        // 🔧 新增：最低字数检查，如果太短标记警告
        const minExpectedChars = 100;
        if (finalText && finalText.trim().length < minExpectedChars) {
          console.warn(`⚠️ 第${pageData.page}页提取文字过少(${finalText.trim().length}字)，可能不完整`);
          // 在原文末尾添加警告标记，提醒用户核对
          finalText += `\n⚠️[系统提示：本页提取文字较少(${finalText.trim().length}字)，请在分析结果确认弹窗中手动补充完整]`;
        }
        
        results.push({
          page: pageData.page,
          pageText: finalText
        });
      }
      
      resolve(results.length > 0 ? results : null);
      columnSplitCallback.value = null;
      columnSplitAllPages.value = [];
    };
    
    // 加载第一页数据到弹窗
    loadCurrentPageToModal();
    showColumnSplitModal.value = true;
  });
};

// 🔧 新增：加载当前页数据到弹窗
const loadCurrentPageToModal = () => {
  const pages = columnSplitAllPages.value;
  if (!pages || pages.length === 0) return;
  
  const current = pages[columnSplitCurrentPage.value];
  if (!current) return;
  
  columnSplitResult.value = {
    columns: current.ocrResult.splits.length + 1,
    splits: current.ocrResult.splits,
    pageLabel: `${columnSplitCurrentPage.value + 1}/${pages.length}`
  };
  columnSplitOriginBase64.value = current.imageBase64;
  columnSplitSubject.value = current.subject;
  columnSplitStage.value = current.stage;
  columnSplitOriginalImagePath.value = current.ocrResult.imagePath || '';
  columnSplitLines.value = current._lines.map(l => ({ ...l }));
  columnSplitPreviewCols.value = current._previewCols.map(c => ({ ...c }));
  columnSplitConfirmed.value = current._confirmed;
  columnSplitSkip.value = current._skipSplit || false;
  
  // 重置图片尺寸，等图片加载后更新切割线百分比
  columnSplitOriginWidth.value = 0;
  columnSplitOriginHeight.value = 0;
};

// 🔧 新增：保存当前页数据
const saveCurrentPageData = () => {
  const pages = columnSplitAllPages.value;
  if (!pages || pages.length === 0) return;
  
  const current = pages[columnSplitCurrentPage.value];
  if (!current) return;
  
  current._lines = columnSplitLines.value.map(l => ({ ...l }));
  current._previewCols = columnSplitPreviewCols.value.map(c => ({ ...c }));
  current._confirmed = columnSplitConfirmed.value;
  current._skipSplit = columnSplitSkip.value;
  if (columnSplitConfirmed.value) {
    current._subImages = columnSplitPreviewCols.value
      .filter(col => col.subBase64)
      .map(col => col.subBase64);
  }
  if (columnSplitSkip.value) {
    // 跳过切割：保存整页 base64 作为 OCR 输入
    current._subImages = [current.imageBase64];
  }
};

// 🔧 新增：翻页
const goToSplitPage = (newIndex) => {
  const pages = columnSplitAllPages.value;
  if (!pages || newIndex < 0 || newIndex >= pages.length) return;
  
  // 保存当前页
  saveCurrentPageData();
  
  // 切换到新页
  columnSplitCurrentPage.value = newIndex;
  loadCurrentPageToModal();
  
  // 图片加载后更新切割线百分比
  nextTick(() => {
    if (splitOriginImage.value && splitOriginImage.value.naturalWidth) {
      onSplitImageLoaded();
    }
  });
};

// 确认当前页
const confirmCurrentPage = () => {
  if (columnSplitLines.value.length === 0) {
    // 单栏——自动确认
    columnSplitConfirmed.value = true;
    columnSplitSkip.value = false;
    columnSplitPreviewCols.value = [{
      style: { left: '0%', width: '100%', top: '0', height: '100%' },
      subBase64: columnSplitOriginBase64.value,
      xRange: '单栏（整页）'
    }];
  }
  // 先预览
  previewColumnSplit();
  // 标记已确认
  columnSplitSkip.value = false;
  saveCurrentPageData();
};

// 跳过切割，整页OCR
const skipSplitForCurrentPage = () => {
  columnSplitSkip.value = true;
  columnSplitConfirmed.value = true;
  saveCurrentPageData();
};

// 🔧 新增：全部取消
const cancelAllColumnSplit = () => {
  showColumnSplitModal.value = false;
  columnSplitConfirmed.value = false;
  if (columnSplitCallback.value) {
    columnSplitCallback.value(null);
  }
  columnSplitCallback.value = null;
  columnSplitAllPages.value = [];
};

// 🔧 新增：全部确认并提取
const finishAllColumnSplit = () => {
  showColumnSplitModal.value = false;
  columnSplitConfirmed.value = false;
  if (columnSplitCallback.value) {
    columnSplitCallback.value(columnSplitAllPages.value);
  }
  columnSplitCallback.value = null;
};

// 确认切割并开始提取原文
const confirmColumnSplit = async () => {
  const callback = columnSplitCallback.value;
  
  showColumnSplitModal.value = false;
  columnSplitConfirmed.value = false;
  
  if (!callback) return;
  
  // 如果没有切割线，按单栏处理，返回原图
  if (columnSplitLines.value.length === 0) {
    callback([columnSplitOriginBase64.value]);
    columnSplitCallback.value = null;
    return;
  }

  // 如果已预览过，直接使用浏览器端切割的 base64
  if (columnSplitPreviewCols.value.length > 0) {
    const subImages = columnSplitPreviewCols.value
      .filter(col => col.subBase64)
      .map(col => col.subBase64);
    if (subImages.length > 0) {
      callback(subImages);
      columnSplitCallback.value = null;
      return;
    }
  }

  // 降级：调用 Python 脚本重新切割
  const sortedLines = [...columnSplitLines.value].sort((a, b) => a.x - b.x);
  try {
    const storagePath = getStoragePath();
    const tmpDir = `${storagePath}/暂存区/_user_split_${Date.now()}`;
    const splitResult = await window.electronAPI.splitColumns(
      columnSplitOriginalImagePath.value,
      tmpDir
    );
    callback(splitResult.sub_images || [columnSplitOriginBase64.value]);
  } catch (e) {
    console.error('用户切割失败:', e);
    callback([columnSplitOriginBase64.value]);
  }
  columnSplitCallback.value = null;
};

// 取消切割调整
const cancelColumnSplit = () => {
  showColumnSplitModal.value = false;
  columnSplitConfirmed.value = false;
  if (columnSplitCallback.value) {
    columnSplitCallback.value(null);
  }
  columnSplitCallback.value = null;
};

const stopChapterDrag = () => {
  isChapterDragging = false;
  document.removeEventListener('mousemove', handleChapterDrag);
  document.removeEventListener('mouseup', stopChapterDrag);
};

// 🔧 新增：保存章节分析的修改
const saveChapterAnalysis = async () => {
  const ch = viewingChapter.value;
  if (!ch) return;
  
  // 知识点文本转数组（可编辑）
  if (ch.knowledgePointsText !== undefined) {
    ch.knowledgePoints = ch.knowledgePointsText.split('\n').filter(k => k.trim());
  }
  
  // 公式文本转数组（可编辑）
  if (ch.formulasText !== undefined) {
    ch.formulas = ch.formulasText.split('\n').filter(f => f.trim());
  }
  
  // 注意：knowledgeHierarchy、competency、style 等字段是只读的，不需要保存
  
  // 判断是教材还是模板
  const isTextbook = textbookStore.textbooks.some(b => 
    b.outline?.some(c => c.title === ch.title)
  );
  
  // 触发响应式更新
  if (isTextbook) {
    textbookStore.textbooks = [...textbookStore.textbooks];
  } else {
    templateStore.templates = [...templateStore.templates];
  }

  showChapterAnalysisModal.value = false;
  previewHint.value = '✅ 分析结果已更新';
};

// 丢弃单个章节的分析结果
const discardSingleChapterAnalysis = async () => {
  const ch = viewingChapter.value;
  if (!ch) return;
  
  const confirmed = await showConfirmDialogFn('确定要丢弃该章节的分析结果吗？原文、知识点等数据将被清除。');
  if (!confirmed) return;
  
  // ✅ 直接修改 viewingChapter（这就是侧边栏实际渲染的同一个对象）
  // 不需要搜索 outline，避免匹配到不同副本
  ch.analyzed = false;
  ch.rawText = '';
  ch.knowledgePoints = [];
  ch.knowledgeHierarchy = [];
  ch.visualDescription = '';
  ch.formulas = [];
  ch.coreTopics = '';
  ch.knowledgePointsText = '';
  ch.formulasText = '';
  ch._ocrRawText = '';
  
  // 判断章节属于教材还是模板
  const viewBook = viewingBook.value;
  const isTextbook = viewBook && textbookStore.textbooks.some(b => b.id === viewBook.id);
  
  // 保存到 IndexedDB
  if (isTextbook) {
    await textbookStore.saveTextbooks();
    textbookStore.textbooks = [...textbookStore.textbooks];
    console.log('✅ 教材章节分析已丢弃并保存');
  } else {
    await templateStore.saveTemplates();
    // 🔧 强制刷新引用，确保左侧列表检测到变化
    templateStore.templates = [...templateStore.templates];
    console.log('✅ 模板章节分析已丢弃并保存');
  }
  
  showChapterAnalysisModal.value = false;
  previewHint.value = '该章节分析已丢弃';
};

const viewingBook = computed(() => textbookStore.viewingBook);
const viewingChapter = computed(() => textbookStore.viewingChapter);

// 分析结果确认弹窗
const showAnalysisResultModal = ref(false);
const analysisResultType = ref(''); // 'textbook' | 'template'
const analysisResultData = ref(null); // 待确认的分析结果

// 分析相关
const showAnalysisModal = ref(false);
const analysisType = ref('textbook');
const analysisBooks = ref([]);
const analysisTpls = ref([]);
const totalNewCount = ref(0);
const analysisAction = ref('');
const analysisInputMode = ref('ocr'); // 'ocr' | 'manual' 原文获取方式
const enableColumnSplit = ref(false);    // 📐 是否启用多栏切割（用户手动勾选）

// 🔧 新增：原文编辑器相关（分步流程）
const showRawTextEditor = ref(false);
const rawTextEditorData = ref(null); // { book, chapter, rawText, originalRawText, analyzeCharts }
const currentAnalyzingBook = ref(null); // 当前正在分析的教材对象
const currentAnalyzingChapter = ref(null); // 当前正在分析的章节对象
const richTextEditorRef = ref(null);  // 🔧 新增：富文本编辑器引用
const isAnalyzingImages = ref(false);  // 🔧 新增：图片分析状态

// 指令和生成
// 🔥 冷启动恢复指令草稿（区分冷启动 vs 手动刷新）
//    sessionStorage 在进程被杀后清空 → 冷启动；手动刷新时 sessionStorage 保留 → 不恢复草稿
const DRAFT_STORAGE_KEY = '__instruction_draft';
const SESSION_KEY = '__app_session_active';
const isColdStart = (() => {
  try {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, '1');
      return true;
    }
    return false;
  } catch { return true; }
})();
const instructionDraft = ref(
  (() => {
    try {
      if (isColdStart) {
        return localStorage.getItem(DRAFT_STORAGE_KEY) || '';
      }
      // 手动刷新：清除持久化草稿，从空白开始
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return '';
    } catch { return ''; }
  })()
);
watch(instructionDraft, (val) => {
  try {
    if (val) localStorage.setItem(DRAFT_STORAGE_KEY, val);
    else localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
});
const previewHint = ref('');
const analysisResult = ref(null);
// 🔧 持久化存储：刷新不丢失
const STORAGE_KEY = 'wisdom_generated_docs';

// 从 id 中提取时间戳（id 格式: period_1735689600000_... 或 doc_1735689600000_...）
const extractTimestampFromId = (id) => {
  if (!id) return null;
  const match = id.match(/(\d{13})/);
  return match ? parseInt(match[1]) : null;
};

const loadGeneratedDocs = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // 向后兼容：为旧数据补填 savedAt（修复前生成的结果缺少时间戳字段）
        let needsSave = false;
        for (const item of parsed) {
          if (!item.savedAt) {
            item.savedAt = item.createdAt || extractTimestampFromId(item.id) || Date.now();
            needsSave = true;
          }
        }
        if (needsSave) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          console.log('🩹 已为 ' + parsed.length + ' 条旧生成结果补填 savedAt');
        }
        return parsed;
      }
    }
  } catch (e) { console.warn('加载生成记录失败:', e.message); }
  return [];
};
const generatedDocs = ref(loadGeneratedDocs());

// 显示用：反转数组，最新的在上面（存储保持升序以保证 slice(-20) 截断正确）
const displayedDocs = computed(() => [...generatedDocs.value].reverse());
// 🔧 防抖 + 防递归：避免 watcher 递归触发导致重复推送
let _saveGenDebounce = null;
let _saveGenPending = false;
const saveGeneratedDocs = async () => {
  try {
    // 截断上限（不修改 ref，避免触发 watcher 递归）
    const docs = generatedDocs.value.length > 20
      ? generatedDocs.value.slice(-20)
      : generatedDocs.value;

    // 🔧 防御：如果 ref 为空但 localStorage 有数据，拒绝写入（防止意外清空）
    if (docs.length === 0) {
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing) {
          const parsed = JSON.parse(existing);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.warn('⚠️ 拒绝写入空数组：localStorage 已有 ' + parsed.length + ' 条数据（可能是重置误触发）');
            return;
          }
        }
      } catch {}
    }

    // 持久化到 localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));

    // ☁️ 推送到云端（防抖：200ms 内多次调用只推一次）
    if (_saveGenDebounce) clearTimeout(_saveGenDebounce);
    _saveGenDebounce = setTimeout(() => {
      _saveGenDebounce = null;
      if (_saveGenPending) return;
      _saveGenPending = true;
      const snapshot = [...docs];
      if (isCloudConfigured()) {
        pushGeneratedDocs(snapshot).then(ok => {
          if (ok) console.log('☁️ 生成结果已自动推送云端 ' + snapshot.length + ' 条');
        }).catch(e => console.warn('☁️ 生成结果自动推送异常', e))
        .finally(() => { _saveGenPending = false; });
      } else {
        _saveGenPending = false;
      }
    }, 200);
  } catch (e) { console.warn('保存生成记录失败:', e?.message); }
};
const batchDownloadFormat = ref('word');
const teacherVersion = ref(true); // true=教师版（含答案）, false=学生版（无答案）

// 预览和编辑
const previewContent = ref('');
const previewingDoc = ref(null);
const editingContent = ref('');
const editingDoc = ref(null);

// 🔥 预览弹窗状态持久化：切APP/杀进程后恢复（热启动窗口 10 分钟内有效）
watch([showPreview, previewingDoc], () => {
  try {
    if (showPreview.value && previewingDoc.value) {
      localStorage.setItem('__preview_state', JSON.stringify({
        docId: previewingDoc.value.id,
        timestamp: Date.now()
      }));
    } else if (!showPreview.value) {
      localStorage.removeItem('__preview_state');
    }
  } catch {}
});

// 指令库
const newInstructionName = ref('');
const newInstructionCategory = ref('试卷');
// 🔧 逐章生成：保存最近一次 buildInstruction 的 options，供逐章循环中为每个章节重建专属指令
const lastInstructionOptions = ref(null);

// 知识点
const currentBook = ref(null);
const currentChapter = ref(null);
const editingKnowledge = ref('');

// AI生成器
const { isGenerating, progress: generateProgress, statusText: generateStatus, buildGenerationInstruction, getTypeDistribution, generate: callGenerate, executeGenerationWithBlueprint, generatePracticeByPeriods, clearPeriodCache, preserveCacheForNextGenerate, setPerChapterFilter, cancelGeneration: cancelGen, periodConfirm, extractGraphs, analyzeTextbookImage, analyzeTextbookWithText, analyzeTemplateImage, analyzeTemplateImageFull, extractKnowledgePoints, generateQuestionVariant, callMultimodalAI, extractTextRobustly, extractChapterTextSequentially, detectMultiColumnPages, postProcessOCR, abortController, smartWait, checkModelReady, smartWaitForModel } = useAiGenerator();

// 🔧 修复：导入 getMultimodalConfig 用于多栏切割预热
import { getMultimodalConfig } from '../config/apiConfig.js';

// 取消生成 / 释放显存（带视觉反馈）
const handleCancelOrRelease = async () => {
  if (isGenerating.value) {
    const confirmed = await showConfirmDialogFn('确定要取消当前生成吗？');
    if (!confirmed) return;
  }
  
  await cancelGen();
  
  if (isGenerating.value) {
    await showAlertDialogFn('已取消生成，显存已释放');
  } else {
    await showAlertDialogFn('显存已释放，模型已从内存中移除');
  }
};

const { 
  showInputDialogFn,
  showConfirmDialogFn,
  showAlertDialogFn,
  showRadioDialogFn
} = useDialog();

// 计算属性
const scopeTypeLabel = computed(() => '命题范围');
const styleLabel = computed(() => '命题风格');
const genTypeLabel = computed(() => '资料类型');
const specialSubTypeLabel = computed(() => {
  if (!specialSubType.value) return '';
  const opt = specialSubTypeOptions.value.find(o => o.value === specialSubType.value);
  return opt ? opt.label : specialSubType.value;
});
const granularityLabel = computed(() => '生成粒度');

// 根据当前资料类型，推荐最优模型（显示实际配置的模型名）
const genTypeModelHint = computed(() => {
  if (genTypes.value.length === 0) return null;
  const type = genTypes.value[0];
  // 🌐 云端 DeepSeek：按任务分 Flash（生成）和 Pro（分析）
  if (apiConfig.currentEngine === 'deepseek') {
    const genModel = apiConfig.deepseekGenerationModel || apiConfig.deepseekModel || 'deepseek-v4-flash';
    const analysisModel = apiConfig.deepseekAnalysisModel || 'deepseek-v4-pro';
    const heavyTasks = ['exam', 'practice', 'special', 'reading', 'errorbook'];
    if (heavyTasks.includes(type)) {
      return { icon: '🧠', model: genModel, tip: '生成用Flash·分析用Pro' };
    }
    return { icon: '📚', model: analysisModel, tip: '分析用Pro·精准提取' };
  }
  // 🦙 本地 Ollama
  const hints = {
    'exam':      { icon: '🧠', model: apiConfig.ollamaTextModel || 'deepseek-r1:14b', tip: '考卷命题推理最强' },
    'practice':  { icon: '🧠', model: apiConfig.ollamaTextModel || 'deepseek-r1:14b', tip: '课时练命题生成最优' },
    'summary':   { icon: '📚', model: apiConfig.ollamaLightModel || 'glm4:9b', tip: '知识点总结/学术精准' },
    'special':   { icon: '🧠', model: apiConfig.ollamaTextModel || 'deepseek-r1:14b', tip: '专项突破/推理能力强' },
    'errorbook': { icon: '📚', model: apiConfig.ollamaLightModel || 'glm4:9b', tip: '错题分析/归因精准' },
    'preview':   { icon: '🌟', model: 'glm4:9b / qwen2.5:14b', tip: '预习资料格式驱动' },
    'dictation': { icon: '🌟', model: 'glm4:9b / qwen2.5:14b', tip: '听写格式要求高' },
    'reading':   { icon: '🧠', model: apiConfig.ollamaTextModel || 'deepseek-r1:14b', tip: '阅读理解需推理链' },
  };
  return hints[type] || null;
});

// 🎯 专项子类型选项：根据所选学科动态提供可用的专项领域
const specialSubTypeOptions = computed(() => {
  const subjectMap = {
    '语文': [
      { value: '阅读理解', label: '📖 阅读理解', desc: '记叙文/说明文/议论文阅读训练' },
      { value: '古诗词', label: '🏯 古诗词', desc: '古诗词鉴赏与积累训练' },
      { value: '文言文', label: '📜 文言文', desc: '文言文阅读与翻译训练' },
      { value: '写作', label: '✍️ 写作', desc: '写作技法与实战训练' },
    ],
    '数学': [
      { value: '计算', label: '🔢 计算', desc: '口算/竖式/巧算/混合运算训练' },
      { value: '应用题', label: '📐 应用题', desc: '读题→建模→列式→求解训练' },
      { value: '几何', label: '📏 几何', desc: '定理证明与几何计算训练' },
    ],
    '英语': [
      { value: '阅读理解', label: '📖 阅读理解', desc: '英语阅读策略与技巧训练' },
      { value: '语法', label: '📝 语法', desc: '语法规则精讲与阶梯训练' },
    ],
  };
  const subject = getSelectedBookSubject();
  // 从 "小学·语文" 中提取学科名
  const match = subject.match(/[··](.+)/);
  const subj = match ? match[1] : subject;
  return subjectMap[subj] || [];
});

// 🎯 是否需要显示专项子类型选择器
const showSpecialSubType = computed(() => genTypes.value.includes('special'));

// 当前已配置的模型摘要（显示在 ribbon 右侧）
const currentModelSummary = computed(() => {
  if (apiConfig.currentEngine === 'ollama') {
    const heavy = apiConfig.ollamaTextModel || '未设置';
    const light = apiConfig.ollamaLightModel || heavy;
    const analysis = apiConfig.ollamaAnalysisModel || light;
    const review = apiConfig.ollamaReviewModel || '';
    return { engine: '🦙 Ollama', heavy, light, analysis, review };
  }
  // 🌐 DeepSeek 云端：显示双模型配置（生成 + 分析）
  const genModel = apiConfig.deepseekGenerationModel || apiConfig.deepseekModel || 'deepseek-v4-flash';
  const analysisModel = apiConfig.deepseekAnalysisModel || 'deepseek-v4-pro';
  return { engine: '🌐 DeepSeek', heavy: genModel, light: analysisModel };
});
const EXAM_TYPES = ['exam', 'practice', 'special'];
const isExamTypeForModal = computed(() => {
  const t = pendingGenType.value || pendingGenerateContext.value?.genType;
  return EXAM_TYPES.includes(t);
});

// 🔧 蓝图弹窗：按资料类型差异化的标题和提示
const blueprintModalConfig = computed(() => {
  const t = pendingGenType.value || pendingGenerateContext.value?.genType;
  const configs = {
    exam: { title: '📋 命题蓝图确认', subtitle: '以下是根据教材内容生成的命题蓝图，您可以修改后确认。', checkHint: '⚠️ 请重点检查：知识点覆盖、难度分布、题型设置。确认后将逐题生成。' },
    practice: { title: '📋 课时练习蓝图确认', subtitle: '以下是根据教材内容生成的课时练习蓝图，您可以修改后确认。', checkHint: '⚠️ 请重点检查：知识点覆盖、难度分布、题型设置。确认后将逐题生成。' },
    special: { title: '📋 专项训练蓝图确认', subtitle: '以下是根据教材内容生成的专项训练蓝图，您可以修改后确认。', checkHint: '⚠️ 请重点检查：知识点覆盖、难度分布、题型设置。确认后将逐题生成。' },
    summary: { title: '📋 知识总结蓝图确认', subtitle: '以下是根据教材知识点生成的知识总结框架，您可以修改后确认。', checkHint: '⚠️ 请重点检查：知识点覆盖是否完整、是否有遗漏的重要概念。确认后将生成完整知识总结。' },
    errorbook: { title: '📋 错题本蓝图确认', subtitle: '以下是识别出的易错知识点分析框架，您可以修改后确认。', checkHint: '⚠️ 请重点检查：易错知识点是否准确、是否遗漏了重要的易错点。确认后将生成完整错题分析。' },
    preview: { title: '📋 预习资料蓝图确认', subtitle: '以下是基于教材内容生成的预习框架，您可以修改后确认。', checkHint: '⚠️ 请重点检查：预习知识点是否覆盖了课文核心内容、预习任务是否可操作。确认后将生成完整预习资料。' },
    dictation: { title: '📋 听写默写蓝图确认', subtitle: '以下是从教材中提取的词汇/生字框架，您可以修改后确认。', checkHint: '⚠️ 请重点检查：词汇是否完整覆盖课文、拼写/拼音是否准确。确认后将生成完整听写练习。' },
    reading: { title: '📋 阅读训练蓝图确认', subtitle: '以下是基于教材知识点生成的阅读训练框架，您可以修改后确认。', checkHint: '⚠️ 请重点检查：知识点覆盖是否合理、阅读题型是否多样。确认后将生成完整阅读训练。' },
  };
  return configs[t] || configs.exam;
});

const selectedTextbooks = computed(() => textbookStore.selectedBooks);

const selectedTemplates = computed(() => templateStore.selectedTemplates);

const selectedTextbookCount = computed(() => textbookStore.selectedChapterCount);

const selectedTemplateCount = computed(() => templateStore.selectedCount);
const selectedInstructionCount = computed(() => instructionStore.list.filter(i => i.selected && i.type === 'fragment').length);
// 分析勾选相关
const allTextbookSelectedForAnalysis = computed(() => {
  const all = [];
  textbookStore.textbooks.forEach(b => {
    if (b.outline) all.push(...textbookStore.getSelectedChapters(b.outline));
  });
  return all.length > 0 && all.every(ch => ch._selectedForAnalysis !== false);
});

const allTemplateSelectedForAnalysis = computed(() => {
  const all = [];
  templateStore.templates.forEach(t => {
    if (t.outline) all.push(...templateStore.getSelectedChapters(t.outline));
  });
  return all.length > 0 && all.every(ch => ch._selectedForAnalysis !== false);
});

const toggleAllForAnalysis = (type) => {
  const store = type === 'textbook' ? textbookStore : templateStore;
  const currentAll = type === 'textbook' ? allTextbookSelectedForAnalysis.value : allTemplateSelectedForAnalysis.value;
  const newVal = !currentAll;
  store.textbooks?.forEach(b => {
    if (b.outline) {
      const chapters = store.getSelectedChapters(b.outline);
      chapters.forEach(ch => { ch._selectedForAnalysis = newVal; });
    }
  });
  store.templates?.forEach(t => {
    if (t.outline) {
      const chapters = store.getSelectedChapters(t.outline);
      chapters.forEach(ch => { ch._selectedForAnalysis = newVal; });
    }
  });
};
const selectedCount = computed(() => generatedDocs.value.filter(d => d.selected).length);
const allSelected = computed(() => generatedDocs.value.length > 0 && generatedDocs.value.every(d => d.selected));

// 数据加载
const instructionStore = useInstructionStore();
const textbookStore = useTextbookStore();
const templateStore = useTemplateStore();
const { isMobile } = useMobile();

// 📱 移动端 Tab 状态（刷新后保持当前 tab）
const GEN_TAB_KEY = 'gen_mobile_tab';
const mobileGenTab = ref(
  (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(GEN_TAB_KEY)) || 'result'
);
// 每次切换 tab 立刻保存，确保刷新重建时能恢复
watch(mobileGenTab, (val) => {
  try { sessionStorage.setItem(GEN_TAB_KEY, val); } catch {}
});
const handleMobileGenerate = (mode) => {
  mobileGenTab.value = 'result'; // 自动切换到结果 Tab
  generate(mode);
};

// 🔄 重置任务：清空当前所有操作状态，恢复初始界面
//    与数据同步(cloud sync)分离：同步只拉数据不破坏任务，重置才清空
const refreshPage = () => {
  // 清空本模块的临时表单状态（组件重建会从 localStorage 重新读数据）
  instructionDraft.value = '';
  showPreview.value = false;
  // 🔧 不修改 generatedDocs.value：新组件实例会从 localStorage 加载
  //    修改 ref 会触发 watcher → saveGeneratedDocs() → 把空数组写入 localStorage → 数据丢失
  // 通知 App 层做组件级软刷新
  window.dispatchEvent(new CustomEvent('reset-task'));
};

// ☁️ 手动同步：拉取云端数据+推送本地数据（双向合并，不重置任务）
const syncPage = () => {
  window.dispatchEvent(new CustomEvent('app-refresh'));
};

// 📤 手动上推：推送本地全量数据到云端（生成结果 + 历史记录）
const uploadPage = () => {
  window.dispatchEvent(new CustomEvent('app-upload'));
};

// 🌐 DeepSeek API 真实就绪检测
const deepseekStatus = ref('checking'); // 'checking' | 'ready' | 'error'
const deepseekStatusMsg = ref('');
const checkDeepSeekReady = async () => {
  if (apiConfig.currentEngine !== 'deepseek') {
    deepseekStatus.value = 'ready'; // 非 DeepSeek 不检测
    return;
  }
  deepseekStatus.value = 'checking';
  deepseekStatusMsg.value = '';
  try {
    const baseUrl = apiConfig.deepseekBaseUrl || 'https://api.deepseek.com/v1';
    const apiKey = apiConfig.deepseekApiKey;
    if (!apiKey) {
      deepseekStatus.value = 'error';
      deepseekStatusMsg.value = '未配置API Key';
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (resp.ok) {
      deepseekStatus.value = 'ready';
      deepseekStatusMsg.value = '';
    } else {
      deepseekStatus.value = 'error';
      deepseekStatusMsg.value = `HTTP ${resp.status}`;
    }
  } catch (e) {
    deepseekStatus.value = 'error';
    deepseekStatusMsg.value = e.name === 'AbortError' ? '连接超时' : (e.message || '网络错误');
  }
};

// 📖 章节选择弹窗
const showChapterSelector = ref(false);
const csExpandedBooks = ref(new Set());

const toggleCsBookExpand = (id) => {
  const s = new Set(csExpandedBooks.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  csExpandedBooks.value = s;
};

const countBookSelected = (book) => {
  if (!book.outline) return 0;
  let count = 0;
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.selected) count++;
      if (n.children) walk(n.children);
    }
  };
  walk(book.outline);
  return count;
};

const onCsChapterToggle = ({ book, node, checked }) => {
  // 递归设置当前节点及所有子节点
  const setNodeAndChildren = (n, state) => {
    n.selected = state;
    if (n.children && n.children.length > 0) {
      n.children.forEach(child => setNodeAndChildren(child, state));
    }
  };
  setNodeAndChildren(node, checked);

  // 向上更新所有父节点状态
  const updateParent = (treeNodes, targetNode) => {
    for (const n of treeNodes) {
      if (n.children && n.children.length > 0) {
        if (n.children.includes(targetNode)) {
          n.selected = n.children.every(child => child.selected);
          return true;
        }
        if (updateParent(n.children, targetNode)) {
          if (n.children) n.selected = n.children.some(child => child.selected);
          return true;
        }
      }
    }
    return false;
  };
  updateParent(book.outline, node);

  textbookStore.syncBookSelection();
  textbookStore.saveTextbooks();
};

// 📖 递归章节勾选组件
const ChapterCheckNode = {
  name: 'ChapterCheckNode',
  props: { node: Object, level: Number, book: Object },
  emits: ['toggle'],
  data() { return { expanded: false }; },
  render() {
    const { node, level, book } = this;
    const hasKids = node.children && node.children.length > 0;
    const indent = level * 16 + 8;

    const kids = hasKids && this.expanded
      ? node.children.map((child, i) =>
          h(ChapterCheckNode, {
            key: i, node: child, level: level + 1, book,
            onToggle: (payload) => this.$emit('toggle', payload)
          })
        )
      : [];

    return h('div', { class: 'cs-node' }, [
      h('div', {
        class: 'cs-node-row',
        style: { paddingLeft: indent + 'px' }
      }, [
        hasKids
          ? h('span', {
              class: 'cs-node-expand',
              onClick: (e) => { e.stopPropagation(); this.expanded = !this.expanded; }
            }, this.expanded ? '▾' : '▸')
          : h('span', { class: 'cs-node-placeholder' }),
        h('input', {
          type: 'checkbox',
          checked: !!node.selected,
          onClick: (e) => {
            e.stopPropagation();
            this.$emit('toggle', { book, node, checked: e.target.checked });
          }
        }),
        h('span', { class: 'cs-node-title', onClick: () => { if (hasKids) this.expanded = !this.expanded; } }, node.title || ''),
        h('span', { class: 'cs-node-pages' }, `p${node.start || 0}-${node.end || 0}`)
      ]),
      ...kids
    ]);
  }
};

const hasAnySelected = (nodes) => textbookStore.hasAnySelected(nodes);

// 🔧 多学科：从多个选中教材中选出"主力教材"（勾选章节最多的那本），避免总取第一本
const pickPrimaryBook = (books) => {
  if (!books || books.length === 0) return null;
  if (books.length === 1) return books[0];
  // 按 selectedChapters 数量降序排列，取最多的那本
  const sorted = [...books].sort((a, b) => (b.selectedChapters?.length || 0) - (a.selectedChapters?.length || 0));
  return sorted[0] || books[0];
};

// 🔧 从生成的 HTML 内容中提取第一个 <h1> 标题文本
const extractTitleFromContent = (html) => {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (match) {
    return match[1].replace(/<[^>]+>/g, '').trim();
  }
  return null;
};

const isCoveredByAnalyzedParent = (book, chapter) => {
  const flatAll = [];
  const flatten = (nodes) => {
    for (const node of nodes) {
      flatAll.push(node);
      if (node.children) flatten(node.children);
    }
  };
  flatten(book.outline);
  
  for (const node of flatAll) {
    if (node.analyzed && node.rawText && node.rawText.trim().length > 0) {
      if (node.start <= chapter.start && node.end >= chapter.end && node !== chapter) {
        return true;
      }
    }
  }
  return false;
};

const getSelectedChapters = (nodes) => textbookStore.getSelectedChapters(nodes);

// 🔧 缓存版本：递增以清除旧版本残留的配置值（避免旧值绕过指令库自动覆写）
const DETAIL_CONFIG_CACHE_VERSION = 4;

// 加载保存的配置
const loadCachedConfig = async () => {
  const cached = await storage.getItem('cached_detail_config');
  if (cached && cached._cacheVersion === DETAIL_CONFIG_CACHE_VERSION) {
    questionTypes.value = cached.questionTypes || questionTypes.value;
    difficultyLevels.value = cached.difficultyLevels || difficultyLevels.value;
    totalScore.value = cached.totalScore || '';
    allowOriginalQuestions.value = cached.allowOriginalQuestions ?? true;
  } else if (cached && cached._cacheVersion !== DETAIL_CONFIG_CACHE_VERSION) {
    console.log(`[GenerateModule] 检测到缓存版本变更 (${cached._cacheVersion || 0} → ${DETAIL_CONFIG_CACHE_VERSION})，已清除旧配置`);
  }
};

// 保存配置
const saveCachedConfig = async () => {
  const config = {
    _cacheVersion: DETAIL_CONFIG_CACHE_VERSION,
    questionTypes: questionTypes.value,
    difficultyLevels: difficultyLevels.value,
    totalScore: totalScore.value,
    allowOriginalQuestions: allowOriginalQuestions.value
  };
  await storage.setItem('cached_detail_config', config);
};

// 勾选操作
const toggleSection = (type) => {
  sectionCollapsed.value[type] = !sectionCollapsed.value[type];
};

// 知识点提取
const extractKnowledge = async (book, chapter) => {
  currentBook.value = book;
  currentChapter.value = chapter;
  
  if (!book.imagesDir) {
    editingKnowledge.value = '';
    showKnowledgeModal.value = true;
    return;
  }
  
  isGenerating.value = true;
  generateStatus.value = 'AI正在提取知识点...';
  
  try {
    const pageNum = String(chapter.start).padStart(3, '0');
    let imagePath = `${book.imagesDir}/page_${pageNum}.png`;
    // ✅ 检查文件是否存在，不存在则尝试 .jpg
    try {
      await window.electronAPI.readFile(imagePath);
    } catch {
      imagePath = `${book.imagesDir}/page_${pageNum}.jpg`;
    }
    
    const imageBase64 = await window.electronAPI.readFile(imagePath);
    
    // 🔧 优化：知识点提取前检测模型状态
    console.log('🔥 知识点提取：检查模型状态...');
    try {
      const result = await checkModelReady(null, 3);
      
      if (!result.ready) {
        console.log('⚠️ 模型未就绪，等待5秒后继续...');
        await new Promise(r => setTimeout(r, 5000));
      } else {
        console.log(`✅ 模型已就绪，立即开始知识点提取（响应时间: ${result.responseTime}ms）`);
      }
    } catch (e) {
      console.warn('⚠️ 模型检测失败，等待5秒后继续...', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
    
    const knowledgePoints = await extractKnowledgePoints(
      imageBase64,
      book.subject,
      book.stage,
      book.grade,
      chapter.title
    );    
    
    editingKnowledge.value = knowledgePoints.join('\n');
    generateStatus.value = '提取完成';
  } catch (e) {
    console.error('提取知识点失败:', e);
    editingKnowledge.value = '';
    generateStatus.value = '提取失败，请手动输入';
  } finally {
    isGenerating.value = false;
    showKnowledgeModal.value = true;
  }
};

const editKnowledge = (book, chapter) => {
  currentBook.value = book;
  currentChapter.value = chapter;
  editingKnowledge.value = (chapter.knowledgePoints || []).join('\n');
  showKnowledgeModal.value = true;
};

const saveKnowledge = async () => {
  if (currentChapter.value) {
    currentChapter.value.knowledgePoints = editingKnowledge.value.split('\n').filter(k => k.trim());
    await textbookStore.saveTextbooks();
  }
  showKnowledgeModal.value = false;
};

// 判断章节是否可预览详情：必须有独立分析内容（rawText），纯联动标记的不算
const isLeafChapter = (chapter) => {
  return chapter.analyzed && chapter.rawText && chapter.rawText.trim().length > 0;
};

const viewChapterAnalysis = async (book, chapter) => {
  if (!chapter.analyzed) {
    await showAlertDialogFn('该章节尚未分析');
    return;
  }
  // 判断是教材还是模板
  const isTemplate = templateStore.templates.some(t => t.id === book.id);
  if (isTemplate && book.analysis) {
    // 模板：将新字段赋值给旧字段名
    if (!book.analysis.structure && book.analysis.结构分析) {
      book.analysis.structure = book.analysis.结构分析;
    }
    if (!book.analysis.questionCount && book.analysis.总题数) {
      book.analysis.questionCount = book.analysis.总题数;
    }
    if (!book.analysis.totalScore && book.analysis.总分) {
      book.analysis.totalScore = book.analysis.总分;
    }
    chapter._tplAnalysis = book.analysis;
  } else {
    // 教材：初始化编辑文本
    chapter.knowledgePointsText = (chapter.knowledgePoints || []).join('\n');
    chapter.formulasText = (chapter.formulas || []).join('\n');
    // 🔧 初始化知识层级文本
    if (chapter.knowledgeHierarchy && chapter.knowledgeHierarchy.length > 0) {
      chapter.knowledgeHierarchy.forEach(bc => {
        if (bc.coreKnowledge) {
          bc.coreKnowledge.forEach(ck => {
            ck.specificConceptsText = (ck.specificConcepts || []).join('、');
          });
        }
      });
    }
    // 🔧 确保能力层次和风格有默认值
    if (!chapter.competency) {
      chapter.competency = book.grade && parseInt(book.grade) <= 6 ? '识记与理解' : '应用与分析';
    }
    if (!chapter.style) {
      chapter.style = '传统';
    }
  }
  textbookStore.openChapterAnalysis(book, chapter);
};

// 已选列表中取消勾选
const removeSelectedChapter = (bookOrTpl, chapter) => {
  chapter.selected = false;
  
  // 递归取消所有子章节
  const unsetChildren = (nodes) => {
    if (!nodes) return;
    nodes.forEach(n => {
      n.selected = false;
      if (n.children?.length) unsetChildren(n.children);
    });
  };
  unsetChildren(chapter.children);
  
  // 向上更新所有父级章节状态
  const updateParentStatus = (treeNodes, targetNode) => {
    for (const n of treeNodes) {
      if (n.children && n.children.length > 0) {
        if (n.children.includes(targetNode)) {
          n.selected = n.children.every(child => child.selected);
          return true;
        }
        if (updateParentStatus(n.children, targetNode)) {
          n.selected = n.children.some(child => child.selected);
          return true;
        }
      }
    }
    return false;
  };
  updateParentStatus(bookOrTpl.outline, chapter);
  
  // 判断是教材还是模板，同步整本教材/模板的勾选状态
  const isTextbook = textbookStore.textbooks.some(b => b.id === bookOrTpl.id);
  if (isTextbook) {
    textbookStore.syncBookSelection();
  } else {
    templateStore.syncTemplateSelection();
  }
};

// 取消整本教材/模板的所有勾选
const removeSelectedBook = (bookOrTpl) => {
  const unsetAll = (nodes) => {
    if (!nodes) return;
    nodes.forEach(n => {
      n.selected = false;
      if (n.children?.length) unsetAll(n.children);
    });
  };
  unsetAll(bookOrTpl.outline);
  bookOrTpl.selected = false;
  
  const isTextbook = textbookStore.textbooks.some(b => b.id === bookOrTpl.id);
  if (isTextbook) {
    textbookStore.syncBookSelection();
  } else {
    templateStore.syncTemplateSelection();
  }
};

// 确认保存分析结果
const confirmAnalysisResult = async () => {
  // 🔧 增强：OCR 质量严格校验
  if (analysisResultType.value === 'textbook' && analysisResultData.value) {
    let totalPoorItems = 0;
    let blockedItems = [];
    let warningItems = [];
    
    for (const item of analysisResultData.value) {
      if (item.ocrQuality === 'poor') {
        totalPoorItems++;
        // 检查用户是否已手动修正原文
        const hasManualFix = item.rawText && item.rawText.trim().length >= 20;
        if (!hasManualFix) {
          blockedItems.push(item);
        } else {
          // 已修正但文本仍然很短，给予警告但允许保存
          if (item.rawText.trim().length < 50) {
            warningItems.push(item);
          }
        }
      }
    }
    
    // 阻止保存：存在未修正的低质量页面
    if (blockedItems.length > 0) {
      const blockedNames = blockedItems.map(i => 
        `「${i.bookName} - ${i.chapterTitle}」\n  当前原文：${(i.rawText || '空').substring(0, 50)}...`
      ).join('\n');
      
      await showAlertDialogFn(
        `⚠️ 以下 ${blockedItems.length} 个章节的原文提取质量差，且未手动修正：\n\n${blockedNames}\n\n` +
        `请先完成以下操作后再保存：\n` +
        `1. 对照原始 PDF 页面，在下方原文框中手动输入正确的教材原文\n` +
        `2. 确保原文长度至少 50 字（当前内容过短可能缺失关键知识点）\n` +
        `3. 如果该页面确实内容很少（如纯图片页），请在原文框中注明"`
      );
      return;
    }
    
    // 显示警告但允许保存：已修正但质量仍不理想
    if (warningItems.length > 0) {
      const warningNames = warningItems.map(i => 
        `「${i.bookName} - ${i.chapterTitle}」(${(i.rawText || '').length}字)`
      ).join('、');
      
      const proceed = await showConfirmDialogFn(
        `⚠️ 以下 ${warningItems.length} 个章节的原文较短（少于50字）：\n${warningNames}\n\n` +
        `短原文可能导致 AI 对教材内容理解不充分。\n` +
        `点击「确定」继续保存，点击「取消」返回修改。`
      );
      if (!proceed) return;
    }
    
    // 如果有修复，显示修复统计
    if (totalPoorItems > 0 && blockedItems.length === 0) {
      console.log(`✅ OCR 质量校验通过：${totalPoorItems}个低质量页面已全部手动修正`);
    }
  }
  
  // 🔧 增强：模板 OCR 质量校验
  if (analysisResultType.value === 'template' && analysisResultData.value) {
    const isPoorOCR = analysisResultData.value.ocrQuality === 'poor';
    const hasRawText = analysisResultData.value.rawText && analysisResultData.value.rawText.trim().length >= 10;
    
    if (isPoorOCR && !hasRawText) {
      await showAlertDialogFn(
        '⚠️ 模板原文提取质量差，且未手动修正。\n\n' +
        '请先完成以下操作后再保存：\n' +
        '1. 对照原始模板文件，在「原文提取」框中手动输入正确的模板原文\n' +
        '2. 原文是 AI 学习模板风格的关键依据，质量直接影响对标效果'
      );
      return;
    }
    
    if (isPoorOCR && hasRawText && analysisResultData.value.rawText.trim().length < 30) {
      const proceed = await showConfirmDialogFn(
        `⚠️ 模板原文较短（${analysisResultData.value.rawText.trim().length}字）。\n\n` +
        `原文过短会影响 AI 对模板风格的学习效果。\n` +
        `点击「确定」继续保存，点击「取消」返回补充。`
      );
      if (!proceed) return;
    }
  }
  
  // 🔧 同步：如果用了 RichTextEditor 编辑 _rawTextHtml，提取纯文本更新 rawText
  if (analysisResultType.value === 'textbook' && analysisResultData.value) {
    for (const item of analysisResultData.value) {
      if (item._rawTextHtml) {
        item.rawText = htmlToPlainText(item._rawTextHtml);
      }
    }
  } else if (analysisResultType.value === 'template' && analysisResultData.value?._rawTextHtml) {
    analysisResultData.value.rawText = htmlToPlainText(analysisResultData.value._rawTextHtml);
  }

  if (analysisResultType.value === 'textbook') {
    const book = analysisBooks.value[0];
    if (book) {
      textbookStore.updateChaptersAnalysis(book.id, analysisResultData.value);
    }
    previewHint.value = `教材分析结果已保存：${analysisResultData.value.length}个章节`;
  } else if (analysisResultType.value === 'template') {
    const data = analysisResultData.value;
    if (!data.tplRef) {
      await showAlertDialogFn('模板数据异常，请重新分析');
      return;
    }
    if (!data.rawText || data.rawText.trim().length < 10) {
      await showAlertDialogFn('模板原文提取不完整，请先确认原文内容后再保存');
      return;
    }
    // 🔧 修复N：模板OCR完全失败时强制拦截
    if (data.ocrQuality === 'poor' && (!data.rawText || data.rawText.trim().length < 20)) {
      await showAlertDialogFn(
        '❌ 模板原文提取完全失败，无法保存。\n\n' +
        '请先完成以下操作：\n' +
        '1. 点击「📄 打开PDF对照」查看原始模板\n' +
        '2. 在左侧「原文提取」框中手动输入或粘贴模板原文\n' +
        '3. 原文至少需要20字才能进行有效的风格对标\n\n' +
        '如果模板确实只有图片没有文字，请上传含文字的模板。'
      );
      return;
    }
    
    // 🔧 修复N：模板结构为空时强制拦截（增强提示）
    if (!data.结构分析 || data.结构分析.length === 0) {
      await showAlertDialogFn('⚠️ 模板结构分析为空，请先完成结构提取后再保存');
      return;
    }
    
    templateStore.saveTemplateAnalysis(data.tplRef.id, data);
    const tpl = templateStore.templates.find(t => t.id === data.tplRef?.id);
    const hasStructure = (tpl?.analysis?.结构分析?.length > 0) || (tpl?.analysis?.structure?.length > 0);
    const hasTotalQuestions = (tpl?.analysis?.总题数 > 0) || (tpl?.analysis?.questionCount > 0);
    const hasTotalScore = (tpl?.analysis?.总分 > 0) || (tpl?.analysis?.totalScore > 0);
    previewHint.value = hasStructure && hasTotalQuestions && hasTotalScore 
      ? '✅ 模板分析结果已保存，点击「生成指令」查看对标效果'
      : '⚠️ 模板分析结果已保存，但部分字段为空，建议手动补充';
  }
  showAnalysisResultModal.value = false;
};

// 丢弃分析结果（清空数据，重置为未分析状态）
const discardAnalysisResult = async () => {
  const confirmed = await showConfirmDialogFn('确定要丢弃这些分析结果吗？所有已分析的数据将被清除，章节状态将恢复为"未分析"。');
  if (!confirmed) return;
  
  showAnalysisResultModal.value = false;
  analysisResultData.value = null;
  
  // 将对应章节状态重置为"未分析"
  if (analysisType.value === 'textbook') {
    const book = analysisBooks.value[0];
    if (book && book.selectedChapters) {
      for (const ch of book.selectedChapters) {
        // 🔧 只重置本次新分析的章节，不动已分析的
        if (ch.analyzed && ch.rawText) continue;
        ch.analyzed = false;
        ch.knowledgePoints = [];
        ch.knowledgeHierarchy = [];
        ch.rawText = '';
        ch.visualDescription = '';
        ch.formulas = [];
        ch.coreTopics = '';
        ch.knowledgePointsText = '';
        ch.formulasText = '';
      }
    }
    await textbookStore.saveTextbooks();
    previewHint.value = '分析结果已丢弃，章节状态已恢复为未分析';
  } else if (analysisType.value === 'template') {
    const tplData = analysisResultData.value;
    if (tplData?.tplRef) {
      const tpl = tplData.tplRef;
      const chapters = getSelectedChapters(tpl.outline || []);
      for (const ch of chapters) {
        ch.analyzed = false;
        ch.rawText = '';
        ch._ocrRawText = '';
      }
      tpl.analysis = {};
      await templateStore.saveTemplates();
    }
    previewHint.value = '分析结果已丢弃，模板状态已恢复为未分析';
  }
};

// 🔧 新增：清空模板分析字段（让用户完全手动填写）
const clearTemplateAnalysisFields = () => {
  if (!analysisResultData.value) return;
  analysisResultData.value.structureText = '';
  analysisResultData.value.scoreDistribution = '';
  analysisResultData.value.questionStyle = '';
  analysisResultData.value.difficultyLevel = '';
};

// 删除单项分析结果
const removeAnalysisItem = (idx) => {
  analysisResultData.value.splice(idx, 1);
};

// 🔧 新增：单独保存单个章节的分析结果
const saveSingleAnalysisItem = async (idx) => {
  if (!analysisResultData.value || idx < 0 || idx >= analysisResultData.value.length) return;
  
  const item = analysisResultData.value[idx];
  
  // 🔧 OCR 质量校验
  if (item.ocrQuality === 'poor') {
    const hasManualFix = item.rawText && item.rawText.trim().length >= 20;
    if (!hasManualFix) {
      await showAlertDialogFn(
        `⚠️ 「${item.bookName} - ${item.chapterTitle}」的原文提取质量差，且未手动修正。\n\n` +
        `请先在下方原文框中手动输入正确的教材原文（至少20字），然后再保存。`
      );
      return;
    }
  }
  
  try {
    // 🔧 从 chapterRef 中查找对应的 book
    let targetBook = null;
    for (const book of textbookStore.textbooks) {
      const findChapter = (nodes) => {
        for (const node of nodes) {
          if (node === item.chapterRef || (node.start === item.chapterRef?.start && node.end === item.chapterRef?.end && node.title === item.chapterRef?.title)) {
            targetBook = book;
            return true;
          }
          if (node.children && findChapter(node.children)) return true;
        }
        return false;
      };
      if (findChapter(book.outline || [])) break;
    }
    
    if (!targetBook) {
      throw new Error('找不到对应的教材');
    }
    
    // 调用 store 的更新方法
    textbookStore.updateChaptersAnalysis(targetBook.id, [item]);
    
    // 从弹窗中移除该项
    analysisResultData.value.splice(idx, 1);
    
    // 如果所有项都保存完了，关闭弹窗
    if (analysisResultData.value.length === 0) {
      showAnalysisResultModal.value = false;
      previewHint.value = '✅ 所有章节分析结果已保存';
    } else {
      previewHint.value = `✅ 已保存「${item.bookName} - ${item.chapterTitle}」，还剩${analysisResultData.value.length}个章节`;
    }
    
    console.log(`✅ 单独保存成功: ${item.bookName} - ${item.chapterTitle}`);
  } catch (e) {
    console.error('单独保存失败:', e);
    await showAlertDialogFn('保存失败: ' + e.message);
  }
};

// 单独提取模板原文
const extractTemplateRawText = async () => {
  if (!analysisResultData.value?.tplRef) return;
  const tpl = analysisResultData.value.tplRef;
  const ch = getSelectedChapters(tpl.outline || [])[0];
  if (!ch || !tpl.imagesDir) return;
  
  isGenerating.value = true;
  generateStatus.value = '🤖 正在提取原文...';
  
  try {
    // 🎯 构建页面列表
    const pages = [];
    for (let page = ch.start; page <= ch.end; page++) {
      const pageNum = String(page).padStart(3, '0');
      let imagePath = `${tpl.imagesDir}/page_${pageNum}.png`;
      let imageBase64 = null;
      try {
        imageBase64 = await window.electronAPI.readFile(imagePath);
      } catch {
        imagePath = `${tpl.imagesDir}/page_${pageNum}.jpg`;
        try {
          imageBase64 = await window.electronAPI.readFile(imagePath);
        } catch {
          console.warn(`⚠️ 第${page}页图片不存在（png/jpg均缺失），跳过`);
          continue;
        }
      }
      
      pages.push({
        pageNum: page,
        imageBase64,
        imagePath
      });
    }
    
    // 🎯 使用新的稳定批量提取方案
    const result = await extractChapterTextSequentially(pages, {
      subject: tpl.subject,
      stage: tpl.stage,
      onProgress: (current, total) => {
        generateStatus.value = `📷 提取模板原文：${tpl.name} - ${ch.title} (${current}/${total})`;
        generateProgress.value = Math.round((current / total) * 100);
      },
      onPageComplete: (pageNum, textLength) => {
        console.log(`📝 第${pageNum}页完成 (${textLength}字)`);
      }
    });
    
    let finalText = result.text;
    
    // 📐 多栏切割（用户手动启用）
    if (enableColumnSplit.value) {
      try {
        generateStatus.value = '📐 正在检测多栏排版...';
        const multiColPages = await detectMultiColumnPages(pages, { 
          subject: tpl.subject, stage: tpl.stage 
        });
        if (multiColPages.length > 0) {
          console.log(`📐 检测到${multiColPages.length}个多栏页面，启动切割流程...`);
          const confirmedResults = await showBatchColumnSplitDialog(
            multiColPages, generateStatus, callMultimodalAI
          );
          if (confirmedResults) {
            for (const colResult of confirmedResults) {
              if (colResult.pageText && colResult.pageText.trim().length > 10) {
                finalText += (finalText ? '\n' : '') + colResult.pageText;
              }
            }
          }
        } else {
          console.log('📐 多栏切割：未检测到多栏页面，使用整页OCR结果');
        }
      } catch (e) {
        console.warn('📐 多栏切割失败，保留整页OCR结果:', e.message);
      }
    }
    
    // 保存结果
    analysisResultData.value.rawText = finalText;
    generateStatus.value = `✅ 原文提取完成（${result.qualityReport.successPages}页成功，${result.qualityReport.failedPages}页失败）`;
    
    // 输出质量报告
    console.log('\n📊 质量报告：');
    console.log(`   总页数：${result.qualityReport.totalPages}`);
    console.log(`   成功：${result.qualityReport.successPages}页`);
    console.log(`   失败：${result.qualityReport.failedPages}页`);
    console.log(`   重试：${result.qualityReport.retryPages}页`);
    console.log(`   总字数：${result.text.length}\n`);
    
  } catch (e) {
    console.error('提取原文失败:', e);
    generateStatus.value = '❌ 提取失败：' + e.message;
  } finally {
    isGenerating.value = false;
  }
};

const copyKnowledgePoints = async () => {
  navigator.clipboard.writeText(editingKnowledge.value);
  await showAlertDialogFn('知识点已复制到剪贴板');
};

const exportKnowledgePoints = () => {
  const blob = new Blob([editingKnowledge.value], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentBook.value?.name}_${currentChapter.value?.title}_知识点.txt`;
  a.click();
};

// 指令构建
const buildInstruction = async () => {
  // ✅ 直接用内存中的数据，不再重复加载
  
  const selectedBooks = textbookStore.textbooks.filter(b => hasAnySelected(b.outline));
  const selectedTpls = templateStore.templates.filter(t => t.selected || hasAnySelected(t.outline));
  
  if (selectedBooks.length === 0) {
    await showAlertDialogFn('请先勾选教材章节');
    return;
  }
  
  const selectedBooksWithChapters = selectedBooks.map(b => ({
    ...b,
    // 🔧 只包含 _selectedForAnalysis 未取消的章节（联动生成指令）
    selectedChapters: getSelectedChapters(b.outline).filter(ch => ch._selectedForAnalysis !== false)
  })).filter(b => b.selectedChapters.length > 0); // 🔧 多学科修复：过滤掉无有效章节的教材（hasAnySelected=true 但 _selectedForAnalysis 全为 false）

  // 🔧 二次检查：过滤后可能全部教材都无有效章节
  if (selectedBooksWithChapters.length === 0) {
    await showAlertDialogFn('请先勾选教材章节（当前选中教材的分析勾选已全部取消）');
    return;
  }

  const selectedTplsWithChapters = selectedTpls.map(t => ({
    ...t,
    selectedChapters: getSelectedChapters(t.outline).filter(ch => ch._selectedForAnalysis !== false)
  }));

  const options = {
    selectedBooks: selectedBooksWithChapters,
    selectedTemplates: selectedTplsWithChapters,
    scopeType: scopeType.value,
    propositionStyle: propositionStyle.value,
    genTypes: genTypes.value,
    granularity: generateGranularity.value,
    questionTypes: questionTypes.value,
    difficultyLevels: difficultyLevels.value,
    totalScore: totalScore.value,
    allowOriginalQuestions: allowOriginalQuestions.value,
    specialSubType: specialSubType.value,  // 🎯 专项子类型
    mergeChapters: mergeChapters.value,   // 🔧 多章节合并出卷开关
    engine: (await getCurrentEngineConfigEnhanced('generation')).engine  // 🔧 DeepSeek 噪音过滤
  };
  
  // 自动匹配：根据教材的学段+学科，自动注入指令库中的片段（无需手动勾选）
  // 🔧 多学科修复：取所有选中教材的学科并集，而非仅取第一本
  const currentSubjects = [...new Set(selectedBooksWithChapters.map(b => b.subject).filter(Boolean))];
  const currentSubject = currentSubjects.length === 1 ? currentSubjects[0] : '';
  
  // 🔍 诊断日志：多学科匹配验证
  console.log('[buildInstruction] 选中教材:', selectedBooksWithChapters.map(b => ({ name: b.name, subject: b.subject, stage: b.stage, chCount: b.selectedChapters?.length })));
  console.log('[buildInstruction] currentSubjects:', currentSubjects, '→ currentSubject:', JSON.stringify(currentSubject), '(多学科模式:', currentSubjects.length > 1, ')');
  const currentStageRaw = selectedBooksWithChapters[0]?.stage || '';
  // 统一映射 stage 为英文 key，与指令库 stage 字段对齐
  const stageMapIns = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
  const currentStageEn = stageMapIns[currentStageRaw] || currentStageRaw;
  
  // 🔧 已在 buildGenerationInstruction 中有专属 section 处理的类别，不再重复注入到 【自动注入指令】
  // 确保每条规则都是独立的【】块，通过年级/学科/资料类型三维智能匹配后自动注入
  const HANDLED_BY_DEDICATED_SECTION = new Set([
    // 生成专用分类（Section 1.5~10 中已通过 getMatchingBlockInstructions 精确匹配）—— dash 格式（内置 fragment）
    '生成-学段适配', '生成-学科适配', '生成-资料类型结构', '生成-情境方向',
    '生成-题目质量标准', '生成-禁止项',
    '生成-通用约束', '生成-原题引用',
    '生成-答案与解析规范', '生成-主观题评分标准', '生成-答题模板',
    '生成-内容规范', '生成-输出格式',
    '生成-专项要求', '生成-EduRender模板',
    '生成-题目质量标准',
    '生成-质量范例', '生成-知识点全覆盖',
    '生成-学科特色', '生成-情境要求',
    '生成-学科标记', '生成-术语规范', '生成-特殊要求',
    // 🔧 补漏：以下 category 有专属 Section 但此前被遗漏
    '生成-角色身份',        // Section 0.【角色身份】
    '生成-标题格式',        // Section 0.5.【标题格式】
    '生成-答案区强制锚定',   // Section 1.5.【答案区强制锚定】
    '生成-顶层约束',        // Section N.【顶层约束】
    '生成-尾约束',          // Section N+1.【尾约束】
    '生成-输出前置指令',     // buildOutputPreamble()
    // 🔧 补漏（2026-07-24）：大量内置 fragment 因 category 遗漏而走自动注入→位置错误→指令失效
    '生成-题型专项要求',     // block_type_* 系列
    '生成-知识边界',         // kb_* 系列
    '生成-时间分配',         // time_* 系列
    '生成-题型分布建议',     // typedist_* 系列
    '生成-核心任务',         // core_task_* 系列
    '生成-命题风格',         // style_* 系列
    '生成-年级边界提示',     // grade_hint_* 系列
    '生成-难度配置',         // diff_* 系列
    '生成-范围标签',         // scope_label_* 系列
    '生成-模板禁止项',       // tpl_ban_* 系列
    '生成-快捷学段提示',     // quick_stage_* 系列
    '生成-指令块标题',       // section_title_* 系列
    '生成-范围扩展',         // scope_cross_* 系列（Section: 跨章综合语义 + chapterCount 替换）
    '生成-格式尾约束',       // format_tail_* 系列（recency 锚点，所有引擎通用）
    '生成-多章节标题',       // multi_ch_title_* 系列（多章节降级标题格式 + {titles} 替换）
    // 🔧 补建（2026）：5个新类别，在 buildGenerationInstruction 中有专属 Section
    '生成-学段控制',         // stage_* 系列：题量/难度/时长按学段建议
    '生成-题量控制',         // layout_* 系列：建议总题量范围
    '生成-难度控制',         // diff_control_* 系列：基础:中等:提高比例
    '生成-学科核心素养',     // core_literacy_* 系列：课标核心素养关键词
    '生成-学科禁止项',       // ban_supplement_* 系列：学科专属红线（与通用禁止项互补）
    // 非生成用途（分析用）
    '分析-文本分析规范', '分析-分析模板示例', '分析-分析提取要求', '分析-知识图谱构建',
  ]);

  // 🔧 自动匹配 fragment 指令：统一走 getMatchingBlockInstructions 三维度匹配（不再手写筛选逻辑）
  const matchedFragmentIds = new Set();
  const allMatchedFragments = [];
  const addUniqueFragments = (fragments) => {
    for (const f of fragments) {
      if (!matchedFragmentIds.has(f.id)) {
        matchedFragmentIds.add(f.id);
        allMatchedFragments.push(f);
      }
    }
  };
  // 按学科逐一匹配（多学科场景遍历各学科，单学科场景 getMatchingBlockInstructions 已包含通用条目）
  const subjectsToMatch = currentSubjects.length > 0 ? currentSubjects : [''];
  for (const subj of subjectsToMatch) {
    addUniqueFragments(getMatchingBlockInstructions({
      subject: subj,
      stage: currentStageEn,
      genType: genTypes.value?.[0]
    }));
  }
  // 排除已在 buildGenerationInstruction 专属 section 中处理的类别
  const autoFragments = allMatchedFragments.filter(f => !HANDLED_BY_DEDICATED_SECTION.has(f.category));
  
  // 🔧 运行时守卫：防止内置 fragment 因 HANDLED_BY_DEDICATED_SECTION 遗漏而泄漏
  if (autoFragments.length > 0) {
    const leakedBuiltin = autoFragments.filter(f => f.builtin).map(f => f.category);
    const leakedUnique = [...new Set(leakedBuiltin)];
    if (leakedUnique.length > 0) {
      console.warn('[buildInstruction] ⚠️ 内置 fragment 泄漏！以下 category 需要在 HANDLED_BY_DEDICATED_SECTION 中补加：', leakedUnique);
    }
  }
  
  // 自动匹配 full 指令：根据资料类型+学段自动注入完整指令内容
  const genTypeCategoryMap = {
    'exam': '试卷', 'practice': '课时练', 'summary': '知识点总结',
    'special': '专项突破', 'errorbook': '错题本', 'preview': '课前预习',
    'dictation': '听写/默写', 'reading': '阅读训练'
  };
  const autoFullInstructions = instructionStore.list.filter(i => {
    if (i.type !== 'full') return false;
    // 类别匹配资料类型
    const targetCategory = genTypeCategoryMap[genTypes.value[0]];
    if (targetCategory && i.category !== targetCategory) return false;
    // 学段匹配
    if (i.stage && i.stage.trim() !== '' && i.stage !== currentStageEn) return false;
    // 🔧 学科匹配：full 指令如果限定了学科，必须匹配当前学科
    if (i.subject && i.subject.trim() !== '') {
      const insSubjects = i.subject.split(',').map(s => s.trim());
      // 🔧 多学科修复：多学科场景下任一匹配即通过
      if (currentSubjects.length <= 1) {
        if (!insSubjects.includes(currentSubject)) return false;
      } else {
        if (!insSubjects.some(s => currentSubjects.includes(s))) return false;
      }
    }
    return true;
  });

  // 🔍 诊断日志：输出匹配到的 auto fragments 和 full instructions
  console.log('[buildInstruction] autoFragments 匹配数:', autoFragments.length, '→', autoFragments.map(f => ({ id: f.id, name: f.name, subject: f.subject, category: f.category })));
  console.log('[buildInstruction] autoFullInstructions 匹配数:', autoFullInstructions.length, '→', autoFullInstructions.map(f => ({ id: f.id, name: f.name, subject: f.subject, category: f.category })));
  
  // 🔧 智能去重：有学科专属 full 指令时，排除同 category+stage 的通用指令
  // 避免"按单元词汇表排列"（英语专属）和"按教材内容排列"（通用）同时注入
  const subjectSpecificKeys = new Set();
  for (const f of autoFullInstructions) {
    if (f.subject && f.subject.trim() !== '') {
      subjectSpecificKeys.add(`${f.category}||${f.stage || ''}`);
    }
  }
  const dedupedFullInstructions = autoFullInstructions.filter(f => {
    if (!f.subject || f.subject.trim() === '') {
      const key = `${f.category}||${f.stage || ''}`;
      if (subjectSpecificKeys.has(key)) return false; // 有学科专属，跳过通用
    }
    return true;
  });
  
  options.injectedFragments = autoFragments;
  options.autoFullInstructions = dedupedFullInstructions;
  
  // 🔧 保存 options 供逐章生成时重建专属指令
  lastInstructionOptions.value = options;
  
  try {
    instructionDraft.value = buildGenerationInstruction(options);
  } catch (e) {
    console.error('[buildInstructionFromSelection] 生成指令构建失败:', e);
    throw e;
  }
  previewHint.value = `基于 ${selectedBooksWithChapters.length} 本教材、${selectedTpls.length} 个模板构建`;
};

const clearInstruction = () => {
  instructionDraft.value = '';
  previewHint.value = '';
};

// AI分析素材
// 辅助：扁平化outline
const flattenOutlineForAnalysis = (nodes) => {
  let result = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) {
      result = result.concat(flattenOutlineForAnalysis(node.children));
    }
  }
  return result;
};

// 分析教材入口
const analyzeTextbook = async () => {
  await textbookStore.saveTextbooks();
  
  const rawStatusList = textbookStore.getAnalysisStatus();
  
  const statusList = rawStatusList.map(book => {
    const filteredChapters = (book.selectedChapters || []).filter(ch => 
      ch._selectedForAnalysis !== false
    );
    
    let cached = 0, newCount = 0;
    for (const ch of filteredChapters) {
      const trulyAnalyzed = ch.analyzed && ch.knowledgePoints?.length > 0 && ch.rawText?.length > 0;
      if (trulyAnalyzed) {
        cached++;
      } else {
        newCount++;
      }
    }
    
    return {
      ...book,
      selectedChapters: filteredChapters,
      cached,
      new: newCount,
    };
  }).filter(book => book.selectedChapters.length > 0);
  
  if (statusList.length === 0) {
    const hasSelected = textbookStore.selectedChapterCount > 0;
    if (hasSelected) {
      const confirmed = await showConfirmDialogFn(
        '所有已选章节均已分析完毕或分析复选框已取消。\n\n' +
        '是否需要重新分析？选择「确定」将弹出分析确认窗口。'
      );
      if (confirmed) {
        const rawList = textbookStore.getAnalysisStatus()
          .filter(book => textbookStore.hasAnySelected(book.outline))
          .map(book => ({
            ...book,
            selectedChapters: book.selectedChapters
          }))
          .filter(book => book.selectedChapters.length > 0);
        
        if (rawList.length > 0) {
          analysisType.value = 'textbook';
          analysisBooks.value = rawList;
          totalNewCount.value = 0;
          showAnalysisModal.value = true;
          return;
        }
      }
    }
    await showAlertDialogFn('请先在教材库勾选章节');
    return;
  }
  
  analysisType.value = 'textbook';

  // 🔧 初始化分析页码范围：导语页自动限制为自身范围，子章节用原始范围
  const calcHasOwnPage = (ch) => {
    return ch.children && ch.children.length > 0 && ch.children[0] && ch.start < ch.children[0].start;
  };
  for (const book of statusList) {
    for (const ch of book.selectedChapters) {
      if (ch._analysisStart === undefined) ch._analysisStart = ch.start;
      if (ch._analysisEnd === undefined) {
        if (calcHasOwnPage(ch)) {
          // 导语页：取第一个子章节之前的页数作为自己的范围
          const firstChildStart = ch.children[0].start;
          ch._analysisEnd = Math.max(ch.start, firstChildStart - 1);
        } else {
          ch._analysisEnd = ch.end;
        }
      }
    }
  }
  analysisBooks.value = statusList;

  totalNewCount.value = statusList.reduce((sum, b) => sum + (b.new || 0), 0);

  showAnalysisModal.value = true;
};

// 分析模板入口
const analyzeTemplate = async () => {
  await templateStore.saveTemplates();
  let statusList = templateStore.getTemplateAnalysisStatus();
  statusList = statusList.map(t => ({
    ...t,
    selectedChapters: (t.selectedChapters || []).filter(ch => ch._selectedForAnalysis !== false)
  })).filter(t => (t.selectedChapters || []).length > 0);
  if (statusList.length === 0) {
    await showAlertDialogFn('请先在模板库勾选模板');
    return;
  }
  
  analysisType.value = 'template';
  analysisTpls.value = statusList;
  // 🔧 修复：只统计勾选了分析复选框的模板章节中未分析的数量
  totalNewCount.value = statusList.reduce((sum, tpl) => {
    const newCount = (tpl.selectedChapters || []).filter(ch => !ch.analyzed).length;
    return sum + newCount;
  }, 0);
  showAnalysisModal.value = true;
};

// 🔧 新增：分析章节中的图片（支持勾选）
const analyzeChapterImages = async (chapter, markdownText, selectedImages) => {
  // 过滤出勾选的图片
  const imagesToAnalyze = selectedImages.filter(img => img.selected);
  
  console.log(`️ 开始分析章节图片: ${chapter.title}, 共 ${chapter.ocrImages?.length || 0} 张，已选择 ${imagesToAnalyze.length} 张`);
  
  if (imagesToAnalyze.length === 0) {
    console.log('ℹ️ 没有图片需要分析');
    return markdownText;
  }
  
  let enhancedMarkdown = markdownText;
  
  for (let i = 0; i < imagesToAnalyze.length; i++) {
    const img = imagesToAnalyze[i];
    console.log(`🖼️ 分析第 ${i + 1}/${imagesToAnalyze.length} 张图片 (第${img.page}页)...`);
    
    try {
      // 读取图片文件并转为 base64
      const imgBase64 = await window.electronAPI.readFile(img.path);
      
      // 用 qwen3-vl 分析图片
      generateStatus.value = `🖼️ 正在分析图片 (${i + 1}/${imagesToAnalyze.length})...`;
      const description = await callMultimodalAI(
        '请详细描述这张图片的内容，包括图形类型、标注、数据等。如果是数学图形，请描述几何关系；如果是图表，请提取关键数据。',
        imgBase64,
        { timeout: 30000 }
      );
      
      // 在 Markdown 中替换图片引用
      const imgRef = `![${img.type || 'figure'}](${img.path})`;
      const replacement = `[图片说明：${description}]`;
      enhancedMarkdown = enhancedMarkdown.replace(imgRef, replacement);
      
      console.log(`✅ 图片 ${i + 1} 分析完成`);
      
    } catch (e) {
      console.warn(`⚠️ 图片 ${i + 1} 分析失败:`, e.message);
      // 继续处理下一张图片
    }
  }
  
  console.log(`✅ 共分析了 ${imagesToAnalyze.length} 张图片`);
  return enhancedMarkdown;
};

// 🔧 将 PaddleOCR-VL 输出的 Markdown/HTML 转换为编辑器可渲染的 HTML
//   处理：表格(<table>)、标题(##)、粗体(**)、图片占位、LaTeX、段落分行
const ocrMarkdownToHtml = (md) => {
  if (!md) return '';
  let html = md;
  
  // 0a. 表格 HTML → 预览友好的 Markdown 表格（<pre> 中显示，用户可编辑）
  const tablePlaceholders = [];
  html = html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (match, inner) => {
    let tblMd = '';
    const rows = inner.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
    if (!rows) return match;
    rows.forEach((rowHtml, idx) => {
      const cells = rowHtml.match(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (!cells) return;
      const vals = cells.map(c => c.replace(/<[^>]*>/g, '').trim());
      tblMd += '| ' + vals.join(' | ') + ' |\n';
      if (idx === 0) tblMd += '|' + vals.map(() => '------').join('|') + '|\n';
    });
    tablePlaceholders.push(tblMd.trim());
    return `%%TABLE_${tablePlaceholders.length - 1}%%`;
  });
  
  // 0b. 保护 LaTeX 公式块 $$...$$（避免被后续 <br> 破坏）
  const latexPlaceholders = [];
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
    latexPlaceholders.push(match);
    return `%%LATEX_${latexPlaceholders.length - 1}%%`;
  });
  
  // 0c. 保护行内 LaTeX \(...\)
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, (match) => {
    latexPlaceholders.push(match);
    return `%%LATEX_${latexPlaceholders.length - 1}%%`;
  });
  
  // 0d. 保护行内 $...$（PaddleOCR-VL 实际输出格式，先处理 $$ 再处理 $ 避免冲突）
  html = html.replace(/\$([^\$]+?)\$/g, (match) => {
    latexPlaceholders.push(match);
    return `%%LATEX_${latexPlaceholders.length - 1}%%`;
  });
  
  // 1. 图片标签处理
  //    base64 data URI → 保留，Tiptap Image 扩展可直接渲染真实图片
  //    相对路径（PIL 不可用时的兜底）→ 替换为占位符
  html = html.replace(/<img\b[^>]*src="([^"]+)"[^>]*\/?>/gi, (match, src) => {
    if (src.startsWith('data:image/')) {
      // 真实图片：保留 <img>，限制最大宽度
      return match.replace(/<img\b/, '<img style="max-width:100%;border-radius:4px;" ');
    }
    const filename = src.split('/').pop() || src;
    return `\n<div class="ocr-image-placeholder" style="text-align:center;padding:8px;margin:12px 0;background:#f0f4ff;border:1px dashed #90a4d0;border-radius:6px;color:#5c6bc0;font-size:13px;">\n  🖼️ <em>图片：${filename}</em>\n</div>\n`;
  });
  
  // 2. 标题：## → h2, ### → h3
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  
  // 3. 粗体：**text** → <strong>text</strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // 3b. 下划线/加点标记 __text__ → <u>text</u>（PaddleOCR-VL 可能输出）
  html = html.replace(/__(.+?)__/g, '<u>$1</u>');
  
  // 4. 双换行 → 段落分隔
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    // 已经是块级标签(h2/h3/div/pre)或占位符的跳过
    if (/^<(h[23]|div|pre|table)/.test(trimmed)) return trimmed;
    if (/^%%(TABLE|LATEX)_\d+%%$/.test(trimmed)) return trimmed;
    return `<p>${trimmed}</p>`;
  }).join('\n');
  
  // 5. 残留单换行 → <br>（但保护 <pre> 内部和 LaTeX）
  // 先用占位符保护 <pre> 块
  const preBlocks = [];
  html = html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, (match) => {
    preBlocks.push(match);
    return `%%PREBLOCK_${preBlocks.length - 1}%%`;
  });
  html = html.replace(/\n/g, '<br>');
  // 恢复 <pre> 块
  html = html.replace(/%%PREBLOCK_(\d+)%%/g, (m, idx) => preBlocks[parseInt(idx)] || m);
  
  // 6. 恢复占位符
  html = html.replace(/%%TABLE_(\d+)%%/g, (m, idx) => {
    const tbl = tablePlaceholders[parseInt(idx)];
    return tbl ? `<pre class="ocr-table" style="background:#f8f8f8;padding:12px;border-radius:6px;border:1px solid #ddd;font-family:Consolas,monospace;font-size:13px;white-space:pre-wrap;line-height:1.6;">${tbl}</pre>` : m;
  });
  html = html.replace(/%%LATEX_(\d+)%%/g, (m, idx) => {
    return latexPlaceholders[parseInt(idx)] || m;
  });
  
  return html;
};

// 🔧 纯文本 → HTML 预览（按空行分段，不含图片）
const plainToHtml = (text) => {
  if (!text) return '';
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p)
    .map(p => `<p>${p.replace(/\|/g, '&#124;').replace(/\n/g, '<br>')}</p>`)
    .join('\n');
};

// 🔧 HTML → 纯文本（保留段落和换行结构）
const htmlToPlainText = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')           // <br> → 换行
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')  // </p><p> → 段落分隔
    .replace(/<\/p>/gi, '\n')                  // </p> → 换行
    .replace(/<[^>]+>/g, '')                   // 清剩余标签
    .replace(/&#124;/g, '|')                   // 恢复 |
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

const openRawTextEditor = (book, chapter, rawText) => {
  currentAnalyzingBook.value = book;
  currentAnalyzingChapter.value = chapter;
  
  // 🔧 优先用保存的 HTML 副本（保留富文本格式），否则用纯文本
  const effectiveRawText = chapter._rawTextHtml || rawText || '';
  
  // 🔧 有 HTML 副本直接用，否则按原逻辑转换
  let displayText;
  if (chapter._rawTextHtml) {
    displayText = effectiveRawText;  // 已保存的 HTML，直接显示
  } else {
    const isOCRMarkdown = /^(##|\*\*|<table\b|<img\b|%%|\$\$|\\\()/m.test(effectiveRawText);
    if (isOCRMarkdown) {
      displayText = ocrMarkdownToHtml(effectiveRawText);
      console.log(`📝 Markdown→HTML: ${effectiveRawText.length}字 → ${displayText.length}字`);
    } else {
      displayText = effectiveRawText
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p)
        .map(p => `<p>${p.replace(/\|/g, '&#124;').replace(/\n/g, '<br>')}</p>`)
        .join('\n');
    }
  }
  
  rawTextEditorData.value = {
    book,
    chapter,
    chapterTitle: chapter.title,
    rawText: displayText,                       // 编辑器显示用的 HTML
    originalRawText: rawText || '',             // 保存原始 Markdown，用于重置
    analyzeCharts: apiConfig.analyzeCharts !== false,
    ocrImages: chapter.ocrImages || [],
    selectedImages: (chapter.ocrImages || []).map(img => ({ ...img, selected: true })),
    detectedImages: []
  };
  
  showRawTextEditor.value = true;
  console.log('📝 打开原文编辑器:', chapter.title);
  
  // 🔧 关键修复：等待富文本编辑器渲染完成后，自动检测图片
  nextTick(async () => {
    if (richTextEditorRef.value && rawTextEditorData.value?.analyzeCharts) {
      await onAnalyzeChartsChange();
    }
  });
  
  // 返回 Promise，等待用户确认或取消
  return new Promise((resolve, reject) => {
    // 将 resolve/reject 保存到全局，供 confirmRawText/closeRawTextEditor 调用
    window._rawTextEditorResolve = resolve;
    window._rawTextEditorReject = reject;
  });
};

// 关闭原文编辑器
const closeRawTextEditor = () => {
  showRawTextEditor.value = false;
  
  // 如果有等待的 Promise，reject 它
  if (window._rawTextEditorReject) {
    window._rawTextEditorReject(new Error('用户取消'));
    window._rawTextEditorResolve = null;
    window._rawTextEditorReject = null;
  }
  
  rawTextEditorData.value = null;
  currentAnalyzingBook.value = null;
  currentAnalyzingChapter.value = null;
};

// 全选/全不选图片
const selectAllImages = (selected) => {
  if (rawTextEditorData.value?.selectedImages) {
    rawTextEditorData.value.selectedImages.forEach(img => {
      img.selected = selected;
    });
  }
};

// 重置为原始 OCR 结果
const resetRawText = () => {
  if (rawTextEditorData.value) {
    rawTextEditorData.value.rawText = ocrMarkdownToHtml(rawTextEditorData.value.originalRawText || '');
    console.log('🔄 已重置为原始 OCR 结果');
  }
};

// 🔧 新增：当勾选“分析图片”时，自动检测所有图片
const onAnalyzeChartsChange = async () => {
  if (rawTextEditorData.value?.analyzeCharts && richTextEditorRef.value) {
    try {
      const editorInstance = richTextEditorRef.value.editor;
      if (!editorInstance || !editorInstance.value) return;
      
      const images = [];
      editorInstance.value.state.doc.descendants((node) => {
        if (node.type.name === 'image' && node.attrs.src) {
          images.push({
            src: node.attrs.src,
            alt: node.attrs.alt || '',
            selected: true  // 默认全选
          });
        }
      });
      
      rawTextEditorData.value.detectedImages = images;
      console.log(`📸 检测到 ${images.length} 张图片`);
    } catch (e) {
      console.error('❌ 检测图片失败:', e);
    }
  } else {
    // 取消勾选时，清空检测到的图片列表
    if (rawTextEditorData.value) {
      rawTextEditorData.value.detectedImages = [];
    }
  }
};

// 🔧 新增：全选/全不选检测到的图片
const selectAllDetectedImages = (selected) => {
  if (rawTextEditorData.value?.detectedImages) {
    rawTextEditorData.value.detectedImages.forEach(img => {
      img.selected = selected;
    });
  }
};

// 🔧 djb2 哈希：32位指纹，用于精确比对文本是否变更
const djb2 = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

// 🔧 将编辑器 HTML 转换为 AI 分析用的纯文本（保留格式语义）
//   支持：表格→Markdown表格、LaTeX公式保留、图片占位符、语义标签转Markdown
const convertHtmlToPlainText = (html) => {
  if (!html) return '';
  
  let text = html;
  
  // 0a. 保护 LaTeX 公式块 $$...$$（避免被后续 HTML 清理破坏）
  const latexBlocks = [];
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
    latexBlocks.push(match);
    return `%%LATEXBLOCK_${latexBlocks.length - 1}%%`;
  });
  
  // 0b. 保护行内 LaTeX \(...\)
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match) => {
    latexBlocks.push(match);
    return `%%LATEXBLOCK_${latexBlocks.length - 1}%%`;
  });
  
  // 0c. 图片占位符 → AI 可理解的文字标记
  //     两种来源：1) ocr-image-placeholder div（相对路径兜底）2) <img> 标签（base64 真实图片）
  text = text.replace(/<div[^>]*class="ocr-image-placeholder"[^>]*>[\s\S]*?🖼️[\s\S]*?<em>图片：(.*?)<\/em>[\s\S]*?<\/div>/gi,
    (match, filename) => `\n[图片：${filename.trim()}]\n`);
  
  // 0c2. 真实 <img> 标签（base64 data URI）→ AI 无法处理图片数据，标记为占位
  text = text.replace(/<img\b[^>]*src="data:image\/[^"]+"[^>]*\/?>/gi,
    () => '\n[图片]\n');
  
  // 0d. <pre class="ocr-table"> → 提取 Markdown 表格原样（用户可能已在编辑器中修改）
  text = text.replace(/<pre\b[^>]*class="[^"]*ocr-table[^"]*"[^>]*>([\s\S]*?)<\/pre>/gi,
    (match, inner) => `\n${inner.trim()}\n`);
  
  // 0e. 普通 <table> HTML → Markdown 表格
  text = text.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (match, inner) => {
    let tblMd = '';
    const rows = inner.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
    if (!rows) return match;
    rows.forEach((rowHtml, idx) => {
      const cells = rowHtml.match(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (!cells) return;
      const vals = cells.map(c => c.replace(/<[^>]*>/g, '').trim());
      tblMd += '| ' + vals.join(' | ') + ' |\n';
      if (idx === 0) tblMd += '|' + vals.map(() => '------').join('|') + '|\n';
    });
    return `\n${tblMd.trim()}\n`;
  });
  
  // 1. 将 HTML 语义标签转换为 Markdown 格式
  text = text
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')  // 加粗
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')            // 斜体
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u>(&nbsp;+)<\/u>/gi, '____')          // 填空横线 → 长下划线
    .replace(/<u>(.*?)<\/u>/gi, '_$1_')              // 下划线
    .replace(/<mark>(.*?)<\/mark>/gi, '==$1==')      // 高亮
    .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')            // 删除线
    .replace(/<strike>(.*?)<\/strike>/gi, '~~$1~~');
  
  // 2. 处理块级元素换行和段落
  text = text
    .replace(/<br\s*\/?>/gi, '\n')                   // 换行
    .replace(/<\/p>/gi, '\n\n')                       // 段落结束
    .replace(/<\/h[1-6]>/gi, '\n\n')                 // 标题结束（补上！避免粘连）
    .replace(/<div>(.*?)<\/div>/gi, '$1\n')          // div 块
    .replace(/<li>(.*?)<\/li>/gi, '- $1\n');         // 列表项
  
  // 3. 移除剩余的所有 HTML 标签
  text = text.replace(/<[^>]*>/g, '');
  
  // 4. 恢复 LaTeX 公式
  text = text.replace(/%%LATEXBLOCK_(\d+)%%/g, (m, idx) => {
    return latexBlocks[parseInt(idx)] || m;
  });
  
  // 5. 解码 HTML 实体
  const div = document.createElement('div');
  div.innerHTML = text;
  text = div.textContent || div.innerText;
  
  // 6. 清理多余空白
  text = text
    .replace(/\n{3,}/g, '\n\n')  // 最多两个连续换行
    .trim();
  
  return text;
};

// 确认原文，继续分析
const confirmRawText = async () => {
  if (!rawTextEditorData.value) return;
  
  const { book, chapter, rawText, analyzeCharts } = rawTextEditorData.value;
  
  // 检查原文是否为空
  if (!rawText || rawText.trim().length < 10) {
    const confirmed = await showConfirmDialogFn(
      '原文内容过短（少于10字），是否继续分析？\n\n建议：请检查 OCR 提取是否正确，或手动补充原文。'
    );
    if (!confirmed) return;
  }
  
  console.log('✅ 用户确认原文，开始后续处理...');
  console.log(`   章节：${chapter.title}`);
  console.log(`   字数：${rawText.length}字`);
  console.log(`   图表分析：${analyzeCharts ? '启用' : '禁用'}`);
  
  let finalText = rawText;
  
  // 如果启用了图表分析，先分析图片
  if (analyzeCharts && chapter.ocrImages && chapter.ocrImages.length > 0) {
    // 获取用户勾选的图片
    const selectedImages = rawTextEditorData.value.selectedImages || [];
    const imagesToAnalyze = selectedImages.filter(img => img.selected);
    
    if (imagesToAnalyze.length > 0) {
      generateStatus.value = `🖼️ 正在分析 ${imagesToAnalyze.length} 张图片...`;
      
      try {
        // 调用图片分析函数（传入勾选的图片）
        finalText = await analyzeChapterImages(chapter, rawText, selectedImages);
        console.log(`✅ 图片分析完成，增强后文本 ${finalText.length} 字`);
      } catch (e) {
        console.warn('⚠️ 图片分析失败:', e.message);
        // 即使图片分析失败，也继续使用原始文本
        finalText = rawText;
      }
    } else {
      console.log('ℹ️ 用户未勾选任何图片，跳过图片分析');
    }
  }
  
  // 🔧 存两份：rawText 给 AI 分析，_rawTextHtml 给编辑器复显
  const plainText = htmlToPlainText(finalText);
  chapter.rawText = plainText;
  chapter._rawTextHtml = rawText;  // 保留原始 HTML，重新打开编辑器时用
  
  // resolve Promise，让等待的循环继续
  if (window._rawTextEditorResolve) {
    window._rawTextEditorResolve({ success: true, rawText: plainText });
    window._rawTextEditorResolve = null;
    window._rawTextEditorReject = null;
  }
  
  // 关闭编辑器
  closeRawTextEditor();
};

// 🔧 新增：确认富文本编辑器的原文（含图片分析）
const confirmRawTextWithImages = async () => {
  if (!rawTextEditorData.value) return;
  
  const { book, chapter, rawText, analyzeCharts } = rawTextEditorData.value;
  
  // 检查原文是否为空
  if (!rawText || rawText.trim().length < 10) {
    const confirmed = await showConfirmDialogFn(
      '原文内容过短（少于10字），是否继续分析？\n\n建议：请检查粘贴的内容是否正确。'
    );
    if (!confirmed) return;
  }
  
  console.log('✅ 用户确认富文本原文，开始后续处理...');
  console.log(`   章节：${chapter.title}`);
  console.log(`   字数：${rawText.length}字`);
  console.log(`   图表分析：${analyzeCharts ? '启用' : '禁用'}`);
  
  let finalText = rawText;
  
  // 🔧 关键修复：无论是否启用图表分析，都要确保最终输出是纯文本
  if (richTextEditorRef.value) {
    try {
      const editorInstance = richTextEditorRef.value.editor;
      if (editorInstance && editorInstance.value) {
        // 获取所有图片
        const allImages = [];
        editorInstance.value.state.doc.descendants((node) => {
          if (node.type.name === 'image' && node.attrs.src) {
            allImages.push({
              src: node.attrs.src,
              alt: node.attrs.alt || ''
            });
          }
        });
        
        if (allImages.length > 0) {
          console.log(`📸 检测到 ${allImages.length} 张图片`);
          
          if (analyzeCharts) {
            // ✅ 启用图表分析：区分勾选和未勾选的图片
            const detectedImages = rawTextEditorData.value.detectedImages || [];
            const imagesToAnalyze = detectedImages.filter(img => img.selected);
            const unselectedImages = detectedImages.filter(img => !img.selected);
            
            console.log(`   - 勾选分析: ${imagesToAnalyze.length} 张`);
            console.log(`   - 未勾选: ${unselectedImages.length} 张`);
            
            // 1. 分析勾选的图片
            if (imagesToAnalyze.length > 0) {
              isAnalyzingImages.value = true;
              generateStatus.value = `🖼️ 正在分析 ${imagesToAnalyze.length} 张图片...`;
              
              for (let i = 0; i < imagesToAnalyze.length; i++) {
                const img = imagesToAnalyze[i];
                console.log(`🔍 分析第 ${i + 1}/${imagesToAnalyze.length} 张图片...`);
                
                try {
                  const description = await callMultimodalAI(
                    '请详细描述这张图片的内容，包括图表类型、数据趋势、文字标注等关键信息。输出纯文本描述，不要使用 Markdown 格式。',
                    img.src.replace(/^data:image\/[^;]+;base64,/, ''),
                    { taskType: 'extraction', think: false }
                  );
                  
                  console.log(`✅ 第 ${i + 1} 张图片描述完成 (${description.length}字)`);
                  
                  const imagePlaceholder = `【图${detectedImages.indexOf(img) + 1}】${img.alt || ''}\n${description}\n`;
                  
                  let replaced = false;
                  editorInstance.value.state.doc.descendants((node, pos) => {
                    if (!replaced && node.type.name === 'image' && node.attrs.src === img.src) {
                      editorInstance.value.chain()
                        .setTextSelection(pos)
                        .deleteSelection()
                        .insertContent(imagePlaceholder)
                        .run();
                      replaced = true;
                      return false;
                    }
                  });
                  
                  if (!replaced) {
                    finalText = finalText.replace(new RegExp(img.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imagePlaceholder);
                  }
                  
                } catch (e) {
                  console.warn(`⚠️ 第 ${i + 1} 张图片分析失败:`, e.message);
                  const imagePlaceholder = `【图${detectedImages.indexOf(img) + 1}】${img.alt || '图片分析失败'}\n`;
                  finalText = finalText.replace(new RegExp(img.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imagePlaceholder);
                }
              }
              
              isAnalyzingImages.value = false;
            }
            
            // 2. 将未勾选的图片替换为占位符
            if (unselectedImages.length > 0) {
              console.log(`📝 将 ${unselectedImages.length} 张未勾选的图片替换为占位符`);
              
              for (let i = 0; i < unselectedImages.length; i++) {
                const img = unselectedImages[i];
                const placeholder = `【图${detectedImages.indexOf(img) + 1}】${img.alt || '未分析图片'}\n`;
                
                let replaced = false;
                editorInstance.value.state.doc.descendants((node, pos) => {
                  if (!replaced && node.type.name === 'image' && node.attrs.src === img.src) {
                    editorInstance.value.chain()
                      .setTextSelection(pos)
                      .deleteSelection()
                      .insertContent(placeholder)
                      .run();
                    replaced = true;
                    return false;
                  }
                });
                
                if (!replaced) {
                  finalText = finalText.replace(new RegExp(img.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder);
                }
              }
            }
            
            console.log(`✅ 所有图片处理完成（已分析: ${imagesToAnalyze.length}, 未分析: ${unselectedImages.length}）`);
            
          } else {
            // ❌ 未启用图表分析：将所有图片替换为占位符
            console.log('ℹ️ 未启用图表分析，将所有图片替换为占位符');
            
            for (let i = 0; i < allImages.length; i++) {
              const img = allImages[i];
              const placeholder = `【图${i + 1}】${img.alt || '未分析图片'}\n`;
              
              let replaced = false;
              editorInstance.value.state.doc.descendants((node, pos) => {
                if (!replaced && node.type.name === 'image' && node.attrs.src === img.src) {
                  editorInstance.value.chain()
                    .setTextSelection(pos)
                    .deleteSelection()
                    .insertContent(placeholder)
                    .run();
                  replaced = true;
                  return false;
                }
              });
              
              if (!replaced) {
                finalText = finalText.replace(new RegExp(img.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder);
              }
            }
            
            console.log(`✅ 所有图片已替换为占位符`);
          }
        }
      }
    } catch (e) {
      console.error('❌ 图片处理失败:', e);
    }
  }
  
  // 🔧 存两份：rawText 给 AI 分析，_rawTextHtml 给编辑器复显
  const plainText = htmlToPlainText(finalText);
  chapter.rawText = plainText;
  chapter._rawTextHtml = rawText;  // 保留原始 HTML，重新打开编辑器时用
  
  // resolve Promise，让等待的循环继续
  if (window._rawTextEditorResolve) {
    window._rawTextEditorResolve({ success: true, rawText: plainText });
    window._rawTextEditorResolve = null;
    window._rawTextEditorReject = null;
  }
  
  // 关闭编辑器
  closeRawTextEditor();
};


// 执行分析
const runAnalysis = async (action) => {
  console.log(`🔍 开始${analysisType.value}分析，action=${action}`);
  console.log('📚 分析对象:', analysisType.value === 'textbook' ? analysisBooks.value : analysisTpls.value);
  
  showAnalysisModal.value = false;
  analysisAction.value = action;
  
  if (analysisType.value === 'textbook') {
    await executeTextbookAnalysis(action);
  } else {
    await executeTemplateAnalysis(action);
  }
};

// 🔧 修复：清理每页原文中的干扰信息（增强版）
const cleanPageText = (text, pageNum, chapterTitle) => {
  if (!text) return '';
  let cleaned = text;
  
  // ========== 1. 去掉页码 ==========
  // 去掉行末独立页码
  cleaned = cleaned.replace(/\n\s*\d{1,3}\s*$/gm, '');
  cleaned = cleaned.replace(/^\d{1,3}\s*\n/gm, '\n');
  
  // ========== 2. 过滤文件路径 ==========
  // Windows 路径：C:\Users\... 或 D:/data/...
  cleaned = cleaned.replace(/[A-Za-z]:[\\/][^\s\n,，。；;！!？?""''）\)》>]{3,}/g, '[路径已移除]');
  // UNC 路径：\\server\share\...
  cleaned = cleaned.replace(/\\\\[^\s\n,，。]{3,}/g, '[路径已移除]');
  // macOS/Linux 绝对路径：/Users/... 或 /home/...
  cleaned = cleaned.replace(/\/[a-zA-Z]+\/[^\s\n,，。]{3,}/g, '[路径已移除]');
  // Electron 应用数据路径特征：/智卷工坊数据/
  cleaned = cleaned.replace(/[^\s\n]*智卷工坊数据[^\s\n]*/g, '[路径已移除]');
  // page_001.png 这类文件名
  cleaned = cleaned.replace(/\bpage_\d{3}\.\w+\b/gi, '');
  
  // ========== 3. 去掉页脚（学科年级册别）==========
  cleaned = cleaned.replace(/\n\s*(语文|数学|英语|科学|物理|化学|生物|历史|地理|政治|道德与法治|信息科技|音乐|美术|体育|信息技术)\s*(一|二|三|四|五|六|七|八|九|高[一二三]|初[一二三])?年级\s*(上册|下册|全一册)?\s*$/gmi, '');
  
  // ========== 4. 去掉版权声明 ==========
  cleaned = cleaned.replace(/\n\s*(版权所有|侵权必究|仅供参考|未经授权|翻印必究|内部资料).*\s*$/gmi, '');
  cleaned = cleaned.replace(/\n\s*(仅供个人学习使用|请勿外传|翻版必究).*\s*$/gmi, '');
  
  // ========== 5. 🔧 新增：过滤常见水印 ==========
  // 匹配 "XX教育" "XX学校" "XX培训" 等水印
  cleaned = cleaned.replace(/\n?\s*[\u4e00-\u9fa5]{2,4}(教育|学校|培训|机构|课堂|网校)[\s\S]{0,10}?\n?/g, '');
  // 匹配网址水印
  cleaned = cleaned.replace(/\n?\s*www\.[a-zA-Z0-9.-]+\.[a-z]{2,6}\s*\n?/gi, '');
  // 匹配电话号码水印
  cleaned = cleaned.replace(/\n?\s*\d{3,4}-?\d{7,8}\s*\n?/g, '');
  
  // ========== 6. 🔧 新增：过滤页眉页脚 ==========
  // 常见页眉格式："XXX 第X页" "XXX Page X"
  cleaned = cleaned.replace(/^\s*.*第\s*\d+\s*页.*$/gm, '');
  cleaned = cleaned.replace(/^\s*.*Page\s*\d+.*$/gmi, '');
  // 常见页脚格式："— X —" "· X ·"
  cleaned = cleaned.replace(/^\s*[—―]\s*\d+\s*[—―]\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*·\s*\d+\s*·\s*$/gm, '');
  
  // ========== 7. 🔧 新增：过滤装饰性符号 ==========
  // 单独成行的装饰符号（如 *** --- === 等）
  cleaned = cleaned.replace(/^\s*[*=_-]{3,}\s*$/gm, '');
  // 单独的标点符号行
  cleaned = cleaned.replace(/^\s*[，。；：！？、\s]{2,}\s*$/gm, '');
  
  // ========== 8. 🔧 新增：过滤空行过多 ==========
  // 将连续3个以上空行压缩为1个
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // ========== 9. 处理章节标题 ==========
  const lines = cleaned.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // 精确匹配：首行就是章节标题本身（如"1 观潮"），且标题后没有正文
    if (firstLine === chapterTitle) {
      lines.shift();
    } else if (firstLine.startsWith(chapterTitle) && firstLine.length > chapterTitle.length + 2) {
      // 首行是"标题 + 正文"（如"1 观潮  钱塘江大潮..."），保留开头
      // 不做处理，保留完整内容
    }
  }
  
  // 去首尾空白
  cleaned = lines.join('\n').trim();
  
  return cleaned;
};

// 执行教材分析
const executeTextbookAnalysis = async (action) => {
  // 🔧 支持取消
  abortController.value = new AbortController();
  isGenerating.value = true;
  generateProgress.value = 0;
  
  try {
    const books = analysisBooks.value;
    let allResults = [];
    let totalPages = 0;
    let donePages = 0;
    let failedPages = [];    
    
    for (const book of books) {
      const chapters = book.selectedChapters || [];
      for (const ch of chapters) {
        // 🔧 使用用户指定的页码范围计算
        const pageCount = (ch._analysisEnd ?? ch.end) - (ch._analysisStart ?? ch.start) + 1;
        if (action === 'all') {
          totalPages += pageCount;
        } else if (action === 'new' && (!ch.analyzed || !ch.knowledgePoints?.length)) {
          totalPages += pageCount;
        }
      }
    }
    
    for (const book of books) {
      const chapters = book.selectedChapters || [];
      for (const ch of chapters) {
        if (action === 'skip' && ch.analyzed && ch.knowledgePoints?.length) continue;
        if (action === 'new' && ch.analyzed && ch.knowledgePoints?.length) continue;
        
        // 🔧 "全部重新分析"：废弃已提取的知识点（保留原文），之后跳过OCR/编辑器直接调AI重新分析
        let userRawText = '';
        
        if (action === 'all') {
          // 废弃：所有分析产物
          ch.analyzed = false;
          ch.knowledgeHierarchy = [];
          ch.knowledgePoints = [];
          ch.knowledgePointsText = '';
          ch.formulas = [];
          ch.formulasText = '';
          ch.coreTopics = '';
          ch.visualDescription = '';
          ch._ocrRawText = '';
          ch.competency = '';
          ch._cognitiveCorrections = [];
          ch._analyzedPlainTextLength = 0;
          // 保留：原文内容不动（rawText, _rawTextHtml）→ 直接用已有原文调AI
          userRawText = ch.rawText || '';
          donePages++;
          generateStatus.value = `🔄 重新分析 ${ch.title}：已废弃旧知识点，原文${userRawText.length}字，正在AI提取...`;
          generateProgress.value = Math.round((donePages / totalPages) * 80);
          console.log(`🔄 已清除 ${ch.title} 知识点缓存，原文保留(${userRawText.length}字)，即将重新AI分析`);
          // 跳过 OCR 和编辑器，直接进入下方 AI 分析（不 continue，走后面的 convert+analyze）
        } else {
       
        generateStatus.value = `📷 分析教材：${book.name} - ${ch.title}`;
        generateProgress.value = Math.round((donePages / totalPages) * 80);
        
        if (analysisInputMode.value === 'manual') {
          // ✍️ 手动模式：打开编辑器等待用户输入
          const result = await openRawTextEditor(book, ch, ch.rawText || '');
          if (!result || !result.success) {
            console.warn(`⚠️ 用户取消了 ${ch.title} 的原文输入`);
            continue;
          }
          userRawText = result.rawText;
          donePages++;
          generateStatus.value = `📝 已获取 ${ch.title} 的原文 (${userRawText.length}字)`;
        } else {
          // 📷 OCR模式：自动识别图片文字
          if (!book.imagesDir) {
            console.warn(`⚠️ ${book.name} 没有图片目录，跳过`);
            continue;
          }
          
          let mergedRawText = '';
          let mergedVisual = '';
          let mergedFormulas = [];
          let mergedCoreTopics = new Set();
          let mergedKnowledgePoints = [];
          let mergedKnowledgeHierarchy = [];
          
          const analysisStart = ch._analysisStart ?? ch.start;
          const analysisEnd = ch._analysisEnd ?? ch.end;
          
          let mergedMarkdown = '';
          let allImages = [];
           
          for (let page = analysisStart; page <= analysisEnd; page++) {
            donePages++;
            generateStatus.value = `📷 分析教材：${book.name} - ${ch.title} 第${page}页 (${donePages}/${totalPages})`;
            generateProgress.value = Math.round((donePages / totalPages) * 80);
            
            const pageNum = String(page).padStart(3, '0');
            
            try {
              let imagePath = `${book.imagesDir}/page_${pageNum}.png`;
              try {
                await window.electronAPI.readFile(imagePath);
              } catch {
                imagePath = `${book.imagesDir}/page_${pageNum}.jpg`;
              }
              
              const imageBase64 = await window.electronAPI.readFile(imagePath);
              
              console.log(`📷 第${page}页：开始 OCR...`);
              const result = await analyzeTextbookImage(
                imageBase64,
                book.subject,
                book.stage,
                book.grade,
                imagePath,
                {
                  hasChildren: !!(ch.children && ch.children.length > 0),
                  pageCount: ch.end - ch.start + 1,
                  title: ch.title
                }
              );
              
              const cleanedText = cleanPageText(result.rawText || '', page, ch.title);
              if (cleanedText) mergedRawText += (mergedRawText ? '\n' : '') + cleanedText;
              
              if (result.visualDescription) {
                mergedVisual += (mergedVisual ? '\n' : '') + `第${page}页图表: ${result.visualDescription}`;
              }
              if (result.formulas?.length) {
                result.formulas.forEach(f => { if (!mergedFormulas.includes(f)) mergedFormulas.push(f); });
              }
              if (result.coreTopics) {
                result.coreTopics.split(/[,，、]/).forEach(t => mergedCoreTopics.add(t.trim()));
              }
              if (result.knowledgePoints?.length) {
                result.knowledgePoints.forEach(k => { if (!mergedKnowledgePoints.includes(k)) mergedKnowledgePoints.push(k); });
              }
              if (result.knowledgeHierarchy?.length) {
                if (!mergedKnowledgeHierarchy) mergedKnowledgeHierarchy = [];
                for (const bigConcept of result.knowledgeHierarchy) {
                  const existing = mergedKnowledgeHierarchy.find(bc => bc.bigConcept === bigConcept.bigConcept);
                  if (existing) {
                    for (const ck of (bigConcept.coreKnowledge || [])) {
                      if (!existing.coreKnowledge.find(ek => ek.name === ck.name)) {
                        existing.coreKnowledge.push(ck);
                      }
                    }
                  } else {
                    mergedKnowledgeHierarchy.push(JSON.parse(JSON.stringify(bigConcept)));
                  }
                }
              }
            } catch (e) {
              console.warn(`分析失败：${ch.title} 第${page}页`, e.message);
              failedPages.push({ chapter: ch.title, page, error: e.message });
            }
          }
          
          mergedMarkdown = mergedRawText;
          userRawText = mergedMarkdown;
          console.log(`📝 第 ${ch.title} OCR 完成，${userRawText?.length || 0} 字`);
        }
        } // end else (non-all: OCR/manual mode)
        
        // 🔧 弹出原文编辑弹窗让用户确认/补充内容
        generateStatus.value = `📝 请确认 ${ch.title} 的原文内容`;
        try {
          const editorResult = await openRawTextEditor(book, ch, userRawText || '');
          if (!editorResult || !editorResult.success) {
            console.warn(`⚠️ 用户取消了 ${ch.title} 的原文确认`);
            continue;
          }
          userRawText = editorResult.rawText;
          console.log(`✅ 用户确认原文: ${ch.title} (${userRawText?.length || 0}字)`);
        } catch (e) {
          console.warn(`⚠️ 用户取消了 ${ch.title} 的原文确认:`, e.message);
          continue;
        }
        
        
        // 保存原文
        ch.rawText = userRawText;
        
        // 🔧 关键：将富文本编辑器 HTML 转换为纯文本再给 AI
        const plainText = convertHtmlToPlainText(userRawText);
        console.log(`📝 HTML转纯文本: ${userRawText.length}字 → ${plainText.length}字`);
        
        // 🔧 关键：调用 AI 分析提取知识点等
        generateStatus.value = `🧠 正在 AI 分析 ${ch.title}...`;
        try {
          const aiResult = await analyzeTextbookWithText(
            plainText,
            book.subject,
            book.stage,
            book.grade,
            ch.title,
            !!(ch.children && ch.children.length > 0),
            ch.end - ch.start + 1
          );
          
          // 保存 AI 分析结果
          ch.visualDescription = aiResult.visualDescription || '';
          ch.formulas = aiResult.formulas || [];
          ch.coreTopics = aiResult.coreTopics || '';
          ch.knowledgePoints = aiResult.knowledgePoints || [];
          ch.knowledgeHierarchy = aiResult.knowledgeHierarchy || [];
          ch.analyzed = true;
          // 🔧 记录分析时 ch.rawText 的哈希指纹（精确对比，确保内容未变时绝对走捷径）
          ch._analyzedPlainTextLength = (ch.rawText || '').length;
          ch._analyzedTextHash = djb2(ch.rawText || '');
          
          console.log(`✅ AI 分析完成: ${ch.knowledgePoints?.length || 0} 个知识点`);
          
          allResults.push({ 
            bookName: book.name,
            chapterTitle: ch.title, 
            chapterRef: ch,
            rawText: userRawText,
            _rawTextHtml: ch._rawTextHtml || '',
            visualDescription: ch.visualDescription,
            formulas: ch.formulas,
            coreTopics: ch.coreTopics,
            knowledgePoints: ch.knowledgePoints,
            knowledgeHierarchy: ch.knowledgeHierarchy,
            competency: book.grade && parseInt(book.grade) <= 6 ? '识记与理解' : '应用与分析',
            style: '传统'
          });
          
        } catch (e) {
          console.error('❌ AI 分析失败:', e.message);
          // 即使 AI 分析失败，也保存原文
          ch.analyzed = false; // 标记为未分析
        }
      }
    }
    
    // 🔧 修复：检查是否有完全失败的章节
    const failedChapters = allResults.filter(r => !r.rawText || r.rawText.trim().length < 10);
    if (failedChapters.length > 0) {
      console.warn(`⚠️ ${failedChapters.length}个章节原文提取失败或内容过短:`, 
        failedChapters.map(r => r.chapterTitle).join('、'));
      generateStatus.value = `⚠️ ${failedChapters.length}个章节提取失败，请检查教材图片`;
    }
    
    // 汇总进度
    if (allResults.length > 0 && books.length > 0) {
      generateStatus.value = '🧠 汇总分析结果...';
      generateProgress.value = 90;
    }
    
    // 根据 action 决定
    generateProgress.value = 100;
    if (failedPages.length > 0) {
      console.warn(`⚠️ ${failedPages.length}页分析失败:`, failedPages.map(f => `${f.chapter}第${f.page}页`).join('、'));
      generateStatus.value = `⚠️ 分析完成，${failedPages.length}页失败`;
    } else {
      generateStatus.value = '分析完成';
    }
    
    // 🔧 修复L：分析失败/质量统计摘要
    if (allResults.length > 0) {
      const poorResults = allResults.filter(r => r.chapterRef?.ocrQuality === 'poor' || (!r.rawText || r.rawText.trim().length < 10));
      const warningResults = allResults.filter(r => r.chapterRef?.ocrQuality === 'warning' || (r.rawText && r.rawText.trim().length >= 10 && r.rawText.trim().length < 200));
      const goodResults = allResults.filter(r => !poorResults.includes(r) && !warningResults.includes(r));
      
      let statsMsg = `📊 分析统计：✅${goodResults.length}章 ⚠️${warningResults.length}章 ❌${poorResults.length}章`;
      if (poorResults.length > 0) {
        statsMsg += ` | 失败：${poorResults.map(r => r.chapterTitle).join('、')}`;
      }
      console.log(statsMsg);
      
      if (poorResults.length > 0 && poorResults.length === allResults.length) {
        generateStatus.value = '❌ 所有章节分析失败，请检查教材图片';
      } else if (poorResults.length > 0) {
        generateStatus.value = `⚠️ ${poorResults.length}个章节分析失败，请在确认弹窗中手动补充原文`;
      }
    }
    
    if (action === 'skip') {
      await textbookStore.saveTextbooks();
      previewHint.value = `✅ 直接使用缓存：${allResults.length}个章节已有分析结果`;
    } else {
      // 'new' 和 'all' 都走这里——弹出确认弹窗让用户查看结果
      analysisResultType.value = 'textbook';
      analysisResultData.value = allResults.map(r => ({
        bookName: r.bookName,
        chapterTitle: r.chapterTitle,
        chapterRef: r.chapterRef,
        rawText: r.rawText || '',
        _rawTextHtml: r._rawTextHtml || '',
        visualDescription: r.visualDescription || '',
        formulasText: (r.formulas || []).join('\n'),
        coreTopics: r.coreTopics || '',
        knowledgePointsText: (r.knowledgePoints || []).join('\n'),
        knowledgeHierarchy: r.knowledgeHierarchy || [],
        competency: r.competency || '',
        style: r.style || ''
      }));
      showAnalysisResultModal.value = true;
    }        
  } catch (e) {
    console.error('教材分析失败:', e);
    await showAlertDialogFn('分析失败: ' + e.message);
  } finally {
    setTimeout(() => { isGenerating.value = false; }, 500);
  }
};

// 执行模板分析
const executeTemplateAnalysis = async (action) => {
  // 🔧 支持取消
  abortController.value = new AbortController();
  isGenerating.value = true;
  generateProgress.value = 0;
  
  try {
    const tpls = analysisTpls.value;
    
    // 📥 根据用户选择的原文获取方式：OCR自动提取 或 手动粘贴
    console.log(`📝 模板分析：原文获取方式=${analysisInputMode.value === 'ocr' ? 'OCR自动提取' : '手动粘贴'}`);
    
    // 🔧 跟踪是否有章节被成功处理
    let hasValidChapter = false;
    
    // 弹出原文编辑弹窗
    for (const tpl of tpls) {
      const chapters = getSelectedChapters(tpl.outline || []);
      
      for (const ch of chapters) {
        if (action === 'skip' && ch.analyzed) continue;
        if (action === 'new' && ch.analyzed) continue;
        
        generateStatus.value = `📝 ${tpl.name} - ${ch.title}`;
        generateProgress.value = 10;
        
        let userText = null;
        
        if (analysisInputMode.value === 'ocr') {
          // 📷 OCR模式：自动识别图片文字
          if (!tpl.imagesDir) {
            console.warn(`⚠️ ${tpl.name} 没有图片目录，跳过`);
            continue;
          }
          
          generateStatus.value = `📷 OCR提取：${tpl.name} - ${ch.title}`;
          generateProgress.value = 15;
          
          // 构建页面列表
          const pages = [];
          for (let page = ch.start; page <= ch.end; page++) {
            const pageNum = String(page).padStart(3, '0');
            let imagePath = `${tpl.imagesDir}/page_${pageNum}.png`;
            let imageBase64 = null;
            try {
              imageBase64 = await window.electronAPI.readFile(imagePath);
            } catch {
              imagePath = `${tpl.imagesDir}/page_${pageNum}.jpg`;
              try {
                imageBase64 = await window.electronAPI.readFile(imagePath);
              } catch {
                console.warn(`⚠️ 第${page}页图片不存在（png/jpg均缺失），跳过`);
                continue;
              }
            }
            
            pages.push({
              pageNum: page,
              imageBase64,
              imagePath
            });
          }
          
          // 批量OCR提取
          const result = await extractChapterTextSequentially(pages, {
            subject: tpl.subject,
            stage: tpl.stage,
            onProgress: (current, total) => {
              generateStatus.value = `📷 OCR提取：${tpl.name} - ${ch.title} (${current}/${total})`;
              generateProgress.value = Math.round((current / total) * 30 + 15);
            }
          });
          
          let finalText = result.text;
          
          // 📐 多栏切割（用户手动启用）
          if (enableColumnSplit.value) {
            try {
              generateStatus.value = '📐 正在检测多栏排版...';
              const multiColPages = await detectMultiColumnPages(pages, { 
                subject: tpl.subject, stage: tpl.stage 
              });
              if (multiColPages.length > 0) {
                const confirmedResults = await showBatchColumnSplitDialog(
                  multiColPages, generateStatus, callMultimodalAI
                );
                if (confirmedResults) {
                  for (const colResult of confirmedResults) {
                    if (colResult.pageText && colResult.pageText.trim().length > 10) {
                      finalText += (finalText ? '\n' : '') + colResult.pageText;
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('📐 多栏切割失败，保留整页OCR结果:', e.message);
            }
          }
          
          userText = finalText;
          console.log(`✅ OCR提取完成：${ch.title} (${userText?.length || 0}字)`);
        } else {
          // ✍️ 手动模式：打开编辑器等待用户输入
          generateStatus.value = `📝 请输入 ${tpl.name} - ${ch.title} 的原文`;
          try {
            const result = await openRawTextEditor(tpl, ch, ch.rawText || '');
            
            if (!result || !result.success) {
              console.warn(`⚠️ 用户取消了 ${ch.title} 的原文输入`);
              continue;
            }
            
            userText = result.rawText;
          } catch (e) {
            console.warn(`⚠️ 用户取消了 ${ch.title} 的原文输入:`, e.message);
            continue;
          }
        }
        
        // 🔧 弹出原文编辑弹窗让用户确认 OCR/手动输入结果
        generateStatus.value = `📝 请确认 ${tpl.name} - ${ch.title} 的原文内容`;
        try {
          const editorResult = await openRawTextEditor(tpl, ch, userText || '');
          if (!editorResult || !editorResult.success) {
            console.warn(`⚠️ 用户取消了 ${ch.title} 的原文确认`);
            continue;
          }
          userText = editorResult.rawText;
          // 保留原始 HTML 格式，供结果弹窗复显
          if (ch._rawTextHtml) {
            tpl._rawTextHtml = (tpl._rawTextHtml ? tpl._rawTextHtml + '\n' : '') + ch._rawTextHtml;
          }
          console.log(`✅ 用户确认原文: ${ch.title} (${userText?.length || 0}字)`);
        } catch (e) {
          console.warn(`⚠️ 用户取消了 ${ch.title} 的原文确认:`, e.message);
          continue;
        }
        
        // ✅ 标记有章节被成功处理
        hasValidChapter = true;
      
      // 🔧 关键修复：将 HTML 转换为纯文本（保留格式语义）
      const plainText = convertHtmlToPlainText(userText);
      console.log(`📝 HTML转纯文本: ${userText.length}字 → ${plainText.length}字`);
      
      // 用户确认原文后，进行AI分析
      generateStatus.value = `🧠 正在分析 ${tpl.name} - ${ch.title}...`;
      generateProgress.value = 50;
        
        try {
          const fullResult = await analyzeTemplateImageFull(
            null, tpl.subject, tpl.stage, tpl.grade, plainText  // 🔧 使用纯文本
          );
          
          console.log('📊 模板分析结果:', {
            rawTextLength: fullResult.rawText?.length || 0,
            structureCount: fullResult.structure?.length || 0,
            questionCardsCount: fullResult.questionCards?.length || 0
          });
          
          // 保存分析结果
          ch.rawText = userText;
          ch.analyzed = true;
          ch._fullQuestionCards = fullResult.questionCards || [];
          
          // 合并到模板级别
          if (!tpl.analysis) {
            tpl.analysis = {
              rawText: '',
              structure: [],
              scoreDistribution: '',
              questionStyle: '',
              difficultyLevel: '',
              questionCards: [],
              languageStyle: null,
              formatStyle: null
            };
          }
          
          tpl.analysis.rawText += (tpl.analysis.rawText ? '\n\n' : '') + userText;
          if (fullResult.structure?.length) {
            tpl.analysis.structure.push(...fullResult.structure);
          }
          if (fullResult.questionCards?.length) {
            tpl.analysis.questionCards.push(...fullResult.questionCards);
          }
          
        } catch (e) {
          console.error(`❌ ${ch.title} 分析失败:`, e.message);
        }
      }
    }
    
    // 完成
    generateProgress.value = 100;
    generateStatus.value = '✅ 模板分析完成';
    
    // 🔧 关键修复：只有当有章节被成功处理时，才弹出确认弹窗
    if (!hasValidChapter) {
      console.warn('⚠️ 所有章节都被取消，不弹出确认弹窗');
      previewHint.value = '⚠️ 模板分析已取消，无有效数据';
      return; // ✅ 直接返回，不弹出确认弹窗
    }
    
    // 弹出确认弹窗
    if (tpls.length > 0) {
      const tpl = tpls[0];
      analysisResultType.value = 'template';
      analysisResultData.value = {
        tplRef: tpl,
        tplName: tpl.name,
        rawText: tpl.analysis?.rawText || '',
        _rawTextHtml: tpl._rawTextHtml || '',
        结构分析: tpl.analysis?.structure || [],
        总题数: tpl.analysis?.questionCount || 0,
        总分: tpl.analysis?.totalScore || 0,
        languageStyle: tpl.analysis?.languageStyle || null,
        formatStyle: tpl.analysis?.formatStyle || null,
        ocrQuality: analysisInputMode.value === 'ocr' ? 'auto' : 'manual'  // 标记原文来源
      };
      showAnalysisResultModal.value = true;
    }
    
  } catch (e) {
    console.error('模板分析失败:', e);
    await showAlertDialogFn('分析失败: ' + e.message);
  } finally {
    setTimeout(() => { isGenerating.value = false; }, 500);
  }
};

// 合并模板多页分析结果
const mergeTemplateResults = (results) => {
  const merged = {
    rawText: '',
    结构分析: [],
    总题数: 0,
    总分: 0,
    languageStyle: null,
    formatStyle: null
  };
  
  const structures = new Set();
  const scores = new Set();
  const styles = new Set();
  const contents = new Set();
  const difficulties = new Set();
  const layouts = new Set();
  const rawTexts = [];  // ✅ 新增：收集每页原文
  let allQuestionCards = [];  // 🔧 修复：收集所有题卡
  let bestLanguageStyle = null;  // 🔧 修复：保留最详细的语言风格
  let bestFormatStyle = null;    // 🔧 修复：保留最详细的格式风格
  
  for (const r of results) {
    // ✅ 收集原文
    if (r.rawText) {
      rawTexts.push(r.rawText);
    }
    
    // 合并结构分析
    if (r.结构分析?.length) {
      for (const section of r.结构分析) {
        const existing = merged.结构分析.find(s => s.大题 === section.大题);
        if (existing) {
          // 同大题合并：小题数量相加，分值和题数取最大
          existing.小题数量 = Math.max(existing.小题数量 || 0, section.小题数量 || 0);
          existing.大题分值 = Math.max(existing.大题分值 || 0, section.大题分值 || 0);
        } else {
          merged.结构分析.push(section);
        }
      }
    }
    if (r.总题数) merged.总题数 = Math.max(merged.总题数 || 0, r.总题数);
    if (r.总分) merged.总分 = Math.max(merged.总分 || 0, r.总分);
  }
  
  // ✅ 合并所有页的原文
  merged.rawText = rawTexts.join('\n\n========== 下一页 ==========\n\n');

  // 🔧 修复J：校验题卡题干是否被截断（检查末尾是否有自然结束标点）
  let truncatedStemCount = 0;
  for (const card of allQuestionCards) {
    if (card.stem && card.stem.length > 30) {
      const lastChar = card.stem.trim().slice(-1);
      const naturalEndings = ['。', '？', '！', '?', '!', '.', '）', ')', '"', '"', '」', '』', '】'];
      if (!naturalEndings.includes(lastChar)) {
        card._stemMayBeTruncated = true;
        truncatedStemCount++;
      }
    }
  }
  if (truncatedStemCount > 0) {
    console.warn(`⚠️ 修复J：${truncatedStemCount}道题卡题干可能被截断（末尾无自然结束标点），建议手动核对`);
  }
  
  
  // 🔧 修复I：按题号+题型排序，同题号按题型分组
  merged.languageStyle = bestLanguageStyle;
  merged.formatStyle = bestFormatStyle;
  
  console.log('📊 mergeTemplateResults 合并结果:', {
    pageCount: results.length,
    rawTextLength: merged.rawText.length,
    结构分析: merged.结构分析,
    总题数: merged.总题数,
    总分: merged.总分,
    hasLanguageStyle: !!merged.languageStyle,
    hasFormatStyle: !!merged.formatStyle
  });
  
  return merged;
};

// 生成
const generate = async (mode) => {
  if (!instructionDraft.value) {
    await showAlertDialogFn('请先生成指令');
    return;
  } 
  
  const types = mode === 'single' ? [genTypes.value[0]] : genTypes.value;
  
  // ✨ 先获取选中的教材和模板数据
  const selectedBooks = textbookStore.textbooks.filter(b => hasAnySelected(b.outline)).map(b => ({
    ...b,
    selectedChapters: getSelectedChapters(b.outline).filter(ch => ch._selectedForAnalysis !== false)
  })).filter(b => b.selectedChapters.length > 0); // 🔧 多学科修复：过滤掉无有效章节的教材
  const selectedTpls = templateStore.templates.filter(t => t.selected || hasAnySelected(t.outline)).map(t => ({
    ...t,
    selectedChapters: getSelectedChapters(t.outline).filter(ch => ch._selectedForAnalysis !== false)
  }));

  // 🔧 检查：过滤后教材章节是否为空
  if (selectedBooks.length === 0) {
    await showAlertDialogFn('请先在教材库中勾选至少一个章节');
    return;
  }
  
  // 🔧 新增：检查教材是否已分析（增强警告，明确列出未分析章节）
  const unanalyzedChapters = selectedBooks.flatMap(b => 
    b.selectedChapters.filter(ch => !ch.analyzed || !ch.rawText || ch.rawText.trim().length < 10)
  );
  if (unanalyzedChapters.length > 0) {
    const chapterList = unanalyzedChapters.map(ch => `• ${ch.title}`).join('\n');
    
    const proceed = await showConfirmDialogFn(
      `⚠️ 检测到 ${unanalyzedChapters.length} 个章节尚未分析教材内容\n\n` +
      `未分析的章节：\n${chapterList}\n\n` +
      `【重要提醒】\n` +
      `• 未分析的章节，AI 只能根据章节标题生成题目\n` +
      `• 无法提取原文、知识点、公式等关键信息\n` +
      `• 生成的题目质量会显著降低，可能出现超纲或编造内容\n` +
      `• 这违背了"基于教材原文命题"的核心原则\n\n` +
      `强烈建议：先点击「🔍 分析教材」按钮完成分析后再生成\n\n` +
      `是否仍要继续生成？`
    );
    if (!proceed) return;
  }

  // 获取生成份数
  const batches = batchCount.value || 1;
  
  // ✨ 第一步：先生成蓝图（不直接生成最终内容）
  pendingGenerateMode.value = mode;
  
  // 🔧 逐章生成：确定章节迭代目标
  const isForcedComprehensive = scopeType.value === 'midterm' || scopeType.value === 'final';
  const allChapters = selectedBooks.flatMap(b => 
    b.selectedChapters.map(ch => ({ ...ch, bookTitle: b.title || b.name }))
  );

  // 🔧 多章节时弹窗选择：合并还是逐章拆分
  let shouldSplit = !mergeChapters.value;
  if (!isForcedComprehensive && allChapters.length > 1) {
    const choice = await showRadioDialogFn(
      `检测到 ${allChapters.length} 个章节`,
      [
        { label: '📦 合并为一份综合资料', value: 'merge' },
        { label: '📄 逐章拆分，每章独立生成一份', value: 'split' }
      ],
      mergeChapters.value ? 'merge' : 'split'
    );
    if (choice === null) return;  // 用户点了取消
    shouldSplit = choice === 'split';
  }

  const effectiveSplit = !isForcedComprehensive && shouldSplit;
  const chapterTargets = (effectiveSplit && allChapters.length > 1)
    ? allChapters
    : [null];
  
  for (let chIdx = 0; chIdx < chapterTargets.length; chIdx++) {
    const chapterTarget = chapterTargets[chIdx];
    if (chapterTarget) {
      console.log(`[逐章] 「${chapterTarget.title}」开始 (${chIdx + 1}/${chapterTargets.length})`);
      previewHint.value = `逐章生成：${chapterTarget.title} (${chIdx + 1}/${chapterTargets.length})`;
      setPerChapterFilter(chapterTarget.title);
      
      // 🔧 逐章专属指令：为当前章节重建指令，避免全量章节信息浪费 token + 章节名错乱
      if (lastInstructionOptions.value) {
        const perChapterOpts = { ...lastInstructionOptions.value };
        // 过滤 selectedBooks：只保留当前章节（title + start 双重匹配，避免同名章节混淆）
        perChapterOpts.selectedBooks = selectedBooks.map(b => ({
          ...b,
          selectedChapters: b.selectedChapters.filter(
            ch => ch.title === chapterTarget.title && ch.start === chapterTarget.start
          )
        })).filter(b => b.selectedChapters.length > 0);
        try {
          const perChapterInst = buildGenerationInstruction(perChapterOpts);
          instructionDraft.value = perChapterInst;
          console.log(`[逐章] 「${chapterTarget.title}」专属指令已重建 (${perChapterInst.length} 字符)`);
        } catch (e) {
          console.warn('[逐章] 重建专属指令失败，回退到全量指令:', e);
        }
      }
    }
  
  // ✨ 新增：记录已生成资料的知识点，用于差异化（逐章模式下每章独立重置）
  const generatedKps = [];  // 已生成的知识点列表
  const generatedTypes = []; // 已生成的类型名称
  
  for (let typeIndex = 0; typeIndex < types.length; typeIndex++) {
    const genType = types[typeIndex];
    pendingGenType.value = genType;
    
    // ✨ 复生成差异化：第二个及以后的类型，注入已生成内容的知识点，避免重复
    let diffInstruction = instructionDraft.value;
    if (typeIndex > 0 && generatedKps.length > 0) {
      const typeName = genTypeTemplates[genType]?.name || genType;
      const prevTypes = generatedTypes.join('、');
      const coveredKps = [...new Set(generatedKps)].slice(0, 20);
      
      diffInstruction = instructionDraft.value + `

【差异化要求——本类型为「${typeName}」，前面已生成「${prevTypes}」】
以下知识点已在之前生成的资料中覆盖，请优先选择其他知识点或从不同角度考查：
已覆盖知识点：${coveredKps.join('、')}

差异化策略：
1. 如果前面已生成考卷，本次课时练应侧重基础巩固和变式训练
2. 如果前面已生成课时练，本次专项突破应选择前面未深入的知识点
3. 如果前面已生成考卷，本次知识点总结应侧重梳理而非重复出题
4. 允许同一知识点从不同角度考查，但避免完全相同的题型和难度`;
    }
    
    try {
      // ✨ 使用差异化指令调用生成
      const result = await callGenerate(
        typeIndex > 0 ? diffInstruction : instructionDraft.value, 
        genType, 
        selectedBooks, 
        selectedTpls, 
        0, 
        true
      );

      // 🔧 课时切分：检测到多课时，弹出确认弹窗
      if (result.success && result.needsPeriodConfirm && result.periods) {
        console.log('[课时切分] ✅ 进入弹窗分支，periods:', result.periods.length, '个');
        pendingPeriods.value = result.periods;
        pendingGenType.value = genType;
        console.log('[课时切分] pendingPeriods 已设置:', pendingPeriods.value?.length, 'pendingGenType:', pendingGenType.value);
        showPeriodConfirmModal.value = true;
        console.log('[课时切分] showPeriodConfirmModal 已设为:', showPeriodConfirmModal.value);
        // 用 nextTick 确认 DOM 更新
        await nextTick();
        console.log('[课时切分] nextTick 后 showPeriodConfirmModal:', showPeriodConfirmModal.value);
        return; // 暂停，等待用户确认课时拆分
      }
      
      if (result.success && result.blueprint) {
        // 保存蓝图信息
        pendingBlueprint.value = result.blueprint;
        editedBlueprintText.value = result.blueprint;
        
        // 解析蓝图用于预览
        if (result.parsedBlueprint && result.parsedBlueprint.length > 0) {
          parsedBlueprintForPreview.value = result.parsedBlueprint;
          // ✨ 收集知识点用于后续差异化
          const kps = result.parsedBlueprint.map(q => q.knowledgePoint).filter(Boolean);
          generatedKps.push(...kps);
        } else {
          // 尝试解析蓝图文本
          tryParseBlueprintForPreview(result.blueprint);
        }
        
        // 计算蓝图统计
        pendingBlueprintStats.value = calculateBlueprintStats(
          result.parsedBlueprint || [], 
          result.blueprint
        );
        
        // ✨ 记录已生成类型
        generatedTypes.push(genTypeTemplates[genType]?.name || genType);
        
        // 保存上下文数据，供确认后使用
        pendingGenerateContext.value = {
          result,
          genType,
          selectedBooks,
          selectedTpls,
          generatedKps: [...generatedKps],       // ✨ 传递已生成知识点
          generatedTypes: [...generatedTypes],   // ✨ 传递已生成类型
          typeIndex                              // ✨ 当前类型索引
        };
        
        // 显示蓝图确认弹窗
        showBlueprintConfirmModal.value = true;
        return; // 暂停，等待用户确认
      } else {
        // 蓝图生成失败/非蓝图类资料类型，降级为直接生成
        // 🔧 修复：必须先保存上下文，否则 finalizeGeneration 拿不到 selectedBooks 导致标题命名缺失
        pendingGenerateContext.value = {
          result,
          genType,
          selectedBooks,
          selectedTpls,
          generatedKps: [...generatedKps],
          generatedTypes: [...generatedTypes],
          typeIndex
        };
        await finalizeGeneration(result, genType);
        pendingGenerateContext.value = null;
        generatedTypes.push(genTypeTemplates[genType]?.name || genType);
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '❌ 生成失败：' + e.message, type: 'error' } }));
      await showAlertDialogFn(`生成出错：${e.message}`);
    }
  }
  } // end chapterTargets loop
  if (chapterTargets.length > 1) {
    setPerChapterFilter(null); // 逐章模式结束，清除过滤器
    // 🔧 恢复全量指令（逐章期间 instructionDraft 被临时覆盖为单章指令）
    if (lastInstructionOptions.value) {
      try {
        instructionDraft.value = buildGenerationInstruction(lastInstructionOptions.value);
      } catch (e) {
        console.warn('[逐章] 恢复全量指令失败:', e);
      }
    }
  }
};

// ✨ 新增：尝试解析蓝图文本为结构化数据
const tryParseBlueprintForPreview = (blueprintText) => {
  // 简单解析表格格式的蓝图
  const lines = blueprintText.split('\n').filter(line => line.trim());
  const parsed = [];
  
  for (const line of lines) {
    // 匹配表格行：| 1 | 选择题 | 知识点 | 基础 | 3 | 第1课 |
    // ✨ 使用更宽容的正则，允许知识点和来源包含空格
    const match = line.match(/\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|/);
    if (match) {
      parsed.push({
        number: parseInt(match[1]),
        type: match[2].trim(),
        knowledgePoint: match[3].trim(),
        difficulty: match[4].trim(),
        score: parseInt(match[5]),
        sourceChapter: match[6].trim()
      });
    }
  }
  
  parsedBlueprintForPreview.value = parsed;
};

// ✨ 新增：计算蓝图统计信息
const calculateBlueprintStats = (parsedBlueprint, blueprintText) => {
  if (parsedBlueprint && parsedBlueprint.length > 0) {
    const totalQuestions = parsedBlueprint.length;
    const knowledgePoints = [...new Set(parsedBlueprint.map(q => q.knowledgePoint))];
    const difficultyCounts = { '基础': 0, '中等': 0, '较难': 0 };
    let totalScore = 0;
    
    parsedBlueprint.forEach(q => {
      if (difficultyCounts.hasOwnProperty(q.difficulty)) {
        difficultyCounts[q.difficulty]++;
      }
      totalScore += (q.score || 0);
    });
    
    return {
      totalQuestions,
      knowledgePointCount: knowledgePoints.length,
      easyPercent: Math.round((difficultyCounts['基础'] / totalQuestions) * 100),
      mediumPercent: Math.round((difficultyCounts['中等'] / totalQuestions) * 100),
      hardPercent: Math.round((difficultyCounts['较难'] / totalQuestions) * 100),
      totalScore
    };
  }
  
  // 从文本中提取总分
  const scoreMatch = blueprintText?.match(/总分[：:]\s*(\d+)/);
  return {
    totalQuestions: parsedBlueprintForPreview.value.length || '?',
    knowledgePointCount: '?',
    easyPercent: '?',
    mediumPercent: '?',
    hardPercent: '?',
    totalScore: scoreMatch ? parseInt(scoreMatch[1]) : '?'
  };
};

// ✨ 新增：确认蓝图并继续生成
const confirmBlueprintAndGenerate = async () => {
  // 🔧 新增：确认前验证表格数据
  const questions = parsedBlueprintForPreview.value;
  const context = pendingGenerateContext.value;
  // 考试类资料类型才需要校验总分和题型分布
  const isExamType = EXAM_TYPES.includes(context?.genType);
  
  // 检查是否有空知识点
  const emptyKps = questions.filter(q => !q.knowledgePoint || q.knowledgePoint.trim() === '' || q.knowledgePoint === '请填写知识点');
  if (emptyKps.length > 0) {
    await showAlertDialogFn(`以下题目知识点为空，请补充：\n题号：${emptyKps.map(q => q.number).join('、')}`);
    return;
  }
  
  // 检查是否有分值异常（所有类型都检查基础有效性）
  const badScores = questions.filter(q => !q.score || q.score <= 0);
  if (badScores.length > 0 && isExamType) {
    await showAlertDialogFn(`以下题目分值异常，请修正：\n题号：${badScores.map(q => q.number).join('、')}`);
    return;
  }
  
  // 检查难度分布（仅考试类，非考试类难度无意义）
  const total = questions.length;
  if (isExamType) {
    const diffCounts = { '基础': 0, '中等': 0, '较难': 0 };
    questions.forEach(q => { if (diffCounts.hasOwnProperty(q.difficulty)) diffCounts[q.difficulty]++; });
    if (diffCounts['较难'] > total * 0.4) {
      const proceed = await showConfirmDialogFn(`较难题占比${Math.round(diffCounts['较难']/total*100)}%，偏高。是否继续？`);
      if (!proceed) return;
    }
  }
  
  // ✨ 新增：题型分布合理性检查（仅考试类）
  const warnings = [];
  if (isExamType) {
  const typeCount = {};
  questions.forEach(q => { typeCount[q.type] = (typeCount[q.type] || 0) + 1; });
  
  // 检查1：是否只有单一题型
  const uniqueTypes = Object.keys(typeCount);
  if (uniqueTypes.length === 1) {
    warnings.push(`⚠️ 只有「${uniqueTypes[0]}」一种题型，建议增加题型多样性`);
  }
  
  // 检查2：选择题占比是否过高（超过60%）
  const choiceCount = (typeCount['选择题'] || 0);
  if (choiceCount > 0 && choiceCount / total > 0.6) {
    warnings.push(`⚠️ 选择题占比${Math.round(choiceCount/total*100)}%，偏高。建议增加填空、解答等题型`);
  }
  
  // 检查3：是否有解答题/应用题（重要题型）
  const hasMajorType = questions.some(q => 
    ['解答题', '应用题', '计算题', '简答题'].includes(q.type)
  );
  if (!hasMajorType && total >= 5) {
    warnings.push(`⚠️ 缺少解答题/应用题/计算题等主要题型，建议至少添加1道`);
  }
  
  // 检查4：总分是否与用户设置一致
  const actualTotal = questions.reduce((sum, q) => sum + (q.score || 0), 0);
  const userTotalSetting = totalScore.value ? parseInt(totalScore.value) : 100;
  if (actualTotal !== userTotalSetting && userTotalSetting > 0) {
    warnings.push(`⚠️ 蓝图总分${actualTotal}分，与设置的总分${userTotalSetting}分不一致`);
  }
  
  // 检查5：是否有分值过大或过小的题目
  const maxScore = Math.max(...questions.map(q => q.score || 0));
  const minScore = Math.min(...questions.map(q => q.score || 0));
  if (maxScore > 30) {
    warnings.push(`⚠️ 第${questions.find(q => q.score === maxScore)?.number}题分值${maxScore}分，偏高`);
  }
  if (minScore < 1 && minScore > 0) {
    warnings.push(`⚠️ 存在分值小于1分的题目`);
  }
  } // 闭合 if (isExamType)
  
  // 检查6：是否有连续多题同一知识点（所有类型通用）
  for (let i = 1; i < questions.length - 1; i++) {
    const kp = questions[i].knowledgePoint;
    if (kp && kp === questions[i-1]?.knowledgePoint && kp === questions[i+1]?.knowledgePoint) {
      warnings.push(`⚠️ 题${questions[i-1].number}-${questions[i+1].number}连续3题考查同一知识点「${kp}」`);
      break; // 只报一次
    }
  }
  
  // 汇总警告
  if (warnings.length > 0) {
    const warningMsg = '蓝图存在以下问题，建议修改：\n\n' + warnings.join('\n') + '\n\n是否仍然继续生成？';
    const proceed = await showConfirmDialogFn(warningMsg);
    if (!proceed) return;
  }
  
  // 先同步表格到文本
  syncTableToText();
  showBlueprintConfirmModal.value = false;
  
  if (!context) return;
  
  // 确定最终使用的蓝图
  const finalBlueprint = editedBlueprintText.value !== pendingBlueprint.value 
    ? editedBlueprintText.value 
    : context.result.blueprint;
  
  // ✨ 基于已有蓝图，循环生成多份（每份独立调AI）
  const batches = batchCount.value || 1;
  for (let batch = 0; batch < batches; batch++) {
    if (batches > 1) {
      previewHint.value = `正在生成第 ${batch + 1}/${batches} 份...`;
    }
    
    try {
      let result;
      // 🔧 非考试类（summary/errorbook/preview/dictation/reading）：重新调用全量生成（blueprintOnly=false）
      if (!isExamType) {
        result = await callGenerate(
          instructionDraft.value,
          context.genType,
          context.selectedBooks,
          context.selectedTpls,
          0,
          false  // blueprintOnly = false，生成完整内容
        );
      } else {
        result = await executeGenerationWithBlueprint(
          instructionDraft.value,
          context.genType,
          context.selectedBooks,
          context.selectedTpls,
          finalBlueprint,
          context.result.contentCards,
          context.result.knowledgeMap
        );
      }
      
      await finalizeGeneration(result, context.genType);
    } catch (e) {
      console.warn(`第${batch + 1}份生成失败:`, e.message);
      await finalizeGeneration({ success: false, error: `第${batch + 1}份: ${e.message}` }, context.genType);
    }
  }
  
  if (batches > 1) {
    previewHint.value = `✅ ${batches} 份全部生成完毕`;
  }
  
  // 🔧 修复：复生成模式——继续处理剩余类型
  const types = pendingGenerateMode.value === 'single' 
    ? [genTypes.value[0]] 
    : genTypes.value;
  const nextTypeIndex = (context.typeIndex || 0) + 1;
  
  if (nextTypeIndex < types.length) {
    // 还有剩余类型，继续生成下一个
    const nextGenType = types[nextTypeIndex];
    
    // 收集已生成的知识点
    const generatedKps = context.generatedKps || [];
    const generatedTypes = context.generatedTypes || [];
    
    // 差异化指令
    let diffInstruction = instructionDraft.value;
    if (generatedKps.length > 0) {
      const typeName = genTypeTemplates[nextGenType]?.name || nextGenType;
      const prevTypes = generatedTypes.join('、');
      const coveredKps = [...new Set(generatedKps)].slice(0, 20);
      
      diffInstruction = instructionDraft.value + `\n\n【差异化要求——本类型为「${typeName}」，前面已生成「${prevTypes}」】\n已覆盖知识点：${coveredKps.join('、')}\n差异化策略：优先选择未覆盖的知识点，或从不同角度考查已覆盖知识点。`;
    }
    
    // 继续生成蓝图（非阻塞，用户可继续操作）
    pendingGenerateContext.value = null;
    previewHint.value = `✅ 「${genTypeTemplates[context.genType]?.name || context.genType}」已生成，正在生成「${genTypeTemplates[nextGenType]?.name || nextGenType}」...`;
    
    try {
      const nextResult = await callGenerate(
        diffInstruction, 
        nextGenType, 
        context.selectedBooks, 
        context.selectedTpls, 
        0, 
        true
      );
      
      if (nextResult.success && nextResult.blueprint) {
        pendingBlueprint.value = nextResult.blueprint;
        editedBlueprintText.value = nextResult.blueprint;
        
        if (nextResult.parsedBlueprint && nextResult.parsedBlueprint.length > 0) {
          parsedBlueprintForPreview.value = nextResult.parsedBlueprint;
          const kps = nextResult.parsedBlueprint.map(q => q.knowledgePoint).filter(Boolean);
          generatedKps.push(...kps);
        } else {
          tryParseBlueprintForPreview(nextResult.blueprint);
        }
        
        generatedTypes.push(genTypeTemplates[nextGenType]?.name || nextGenType);
        
        pendingBlueprintStats.value = calculateBlueprintStats(
          nextResult.parsedBlueprint || [], 
          nextResult.blueprint
        );
        
        pendingGenerateContext.value = {
          result: nextResult,
          genType: nextGenType,
          selectedBooks: context.selectedBooks,
          selectedTpls: context.selectedTpls,
          generatedKps: [...generatedKps],
          generatedTypes: [...generatedTypes],
          typeIndex: nextTypeIndex
        };
        
        showBlueprintConfirmModal.value = true;
      } else {
        previewHint.value = `「${genTypeTemplates[nextGenType]?.name || nextGenType}」蓝图生成失败，请重试`;
      }
    } catch (e) {
      previewHint.value = `生成出错：${e.message}`;
    }
  } else {
    // 所有类型已生成完毕
    pendingGenerateContext.value = null;
    previewHint.value = `✅ 全部 ${types.length} 个类型已生成完毕`;
  }
};

// ✨ 新增：取消蓝图确认
const cancelBlueprintConfirm = () => {
  showBlueprintConfirmModal.value = false;
  pendingGenerateContext.value = null;
  previewHint.value = '已取消生成';
};

// 🔧 课时切分：确认拆分，逐课时生成
const confirmPeriodSplit = async () => {
  showPeriodConfirmModal.value = false;
  const periods = pendingPeriods.value;
  const genType = pendingGenType.value;
  if (!periods.length || !genType) return;

  previewHint.value = `正在逐课时生成（共${periods.length}个课时）...`;
  
  try {
    const result = await generatePracticeByPeriods(periods);
    if (result.success) {
      multiPeriodResults.value = result;
      activePeriodTab.value = -1; // 默认显示"全部"合并版
      
      const genTypeName = genTypeTemplates[genType]?.name || genType;
      const ctxBooks = pendingGenerateContext.value?.selectedBooks;
      const book = pickPrimaryBook(ctxBooks);
      const gradeLabel = book?.grade || '';
      const subjectLabel = book?.subject || '';
      const bookPrefix = [gradeLabel, subjectLabel].filter(Boolean).join('');
      // 提取章节/单元名：从 outline 树找最近公共祖先（多个章节取高一级）
      const chapters = book?.selectedChapters || [];
      let chapterName = '';
      let isScopeChapterName = false;
      if (chapters.length === 1) {
        chapterName = chapters[0].title || '';
      } else if (chapters.length > 1) {
        const outline = book?.outline || [];
        const paths = [];
        const collectPaths = (nodes, ancestors) => {
          for (const node of nodes) {
            if (chapters.includes(node)) paths.push([...ancestors, node]);
            if (node.children) collectPaths(node.children, [...ancestors, node]);
          }
        };
        collectPaths(outline, []);
        if (paths.length > 1) {
          const first = paths[0];
          let lcaIdx = first.length - 1;
          for (let i = 0; i < first.length; i++) {
            if (!paths.every(p => p.length > i && p[i] === first[i])) { lcaIdx = i - 1; break; }
          }
          if (lcaIdx >= 0) {
            chapterName = first[lcaIdx].title;
          } else {
            // 无共同祖先（跨单元全选）：按 scopeType 命名（带轮换）
            const scopeLabel = pickScopeLabel(scopeType.value, chapters);
            if (scopeLabel) { chapterName = scopeLabel; isScopeChapterName = true; }
            else { chapterName = chapters[0].title || ''; }
          }
        } else {
          chapterName = chapters[0].title || '';
        }
      }
      const parts = [bookPrefix, chapterName, isScopeChapterName ? null : genTypeName].filter(Boolean);
      const now = new Date();
      const ts = now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const baseTitle = (parts.length > 0 ? parts.join(' · ') : genTypeName) + '_' + ts;
      
      // 将每个课时作为独立条目添加到 generatedDocs
      if (result.periods) {
        result.periods.forEach((period, pi) => {
          const safeContent = (period.content && typeof period.content === 'string') ? period.content : '';
          if (!safeContent) return; // 跳过生成失败的课时
          // 🔧 优先取课时内容中的 <h1> 标题，回退到课时名拼接
          const periodExtracted = extractTitleFromContent(safeContent);
          const periodTitle = periodExtracted
            ? periodExtracted + '_' + ts
            : `${baseTitle} — ${period.periodName}`;
          generatedDocs.value.push({
            id: 'period_' + Date.now() + '_' + pi + '_' + Math.random().toString(36).slice(2, 8),
            title: periodTitle,
            content: safeContent,
            rawContent: safeContent,
            genType: genTypeName,
            style: propositionStyle.value,
            selected: false,
            quality: null,
            status: 'success',
            savedAt: Date.now(),
            _isPeriod: true,
            _periodIndex: pi,
            graphInstructions: extractGraphs(safeContent),
            confidenceMarks: detectConfidenceIssues(
              safeContent, 
              textbookStore.textbooks.filter(b => b.outline?.some(c => c.selected))
            ),
            issues: period.issues || [],
            qualityReport: period.qualityReport || null,
          });
        });
      }
      
      // 添加合并版完整条目
      const combinedContent = (result.content && typeof result.content === 'string') ? result.content : '';
      if (combinedContent) {
        // 🔧 优先取合并版内容中的 <h1> 标题
        const combinedExtracted = extractTitleFromContent(combinedContent);
        const combinedTitle = combinedExtracted
          ? combinedExtracted + '_' + ts
          : `${baseTitle} — 完整版（${result.periodCount}课时）`;
        generatedDocs.value.push({
          id: 'period_combined_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          title: combinedTitle,
          content: combinedContent,
          rawContent: combinedContent,
          genType: genTypeName,
          style: propositionStyle.value,
          selected: false,
          quality: null,
          status: 'success',
          savedAt: Date.now(),
          _isPeriodCombined: true,
          _periodCount: result.periodCount,
          graphInstructions: extractGraphs(combinedContent),
          confidenceMarks: detectConfidenceIssues(
            combinedContent, 
            textbookStore.textbooks.filter(b => b.outline?.some(c => c.selected))
          ),
          issues: result.issues || [],
          qualityReport: result.qualityReport || null,
        });
      }
      
      previewHint.value = `✅ 课时练生成完成（${result.periodCount} 个课时）`;
    } else {
      previewHint.value = `❌ 课时练生成失败：${result.error || '未知错误'}`;
    }
  } catch (e) {
    previewHint.value = `❌ 课时练生成出错：${e.message}`;
    console.error('[课时切分] 生成失败:', e);
  }
  
  pendingPeriods.value = [];
  pendingGenType.value = null;
};

// 🔧 课时切分：取消拆分，整体生成
const cancelPeriodSplit = async () => {
  showPeriodConfirmModal.value = false;
  
  const genType = pendingGenType.value;
  pendingPeriods.value = [];
  pendingGenType.value = null;
  
  // 🔧 设置跳过标志，阻止 generate() 重新触发课时切分（保留 _cachedKnowledgeMap）
  preserveCacheForNextGenerate();
  // 但清除 periodConfirm 信号，避免 UI 层读到过期状态
  periodConfirm.value = null;
  
  previewHint.value = '已取消拆分，正在整体生成...';
  
  try {
    // 重新获取选中的教材和模板（与 multi-generate 循环逻辑一致）
    const selectedBooks = textbookStore.textbooks.filter(b => hasAnySelected(b.outline)).map(b => ({
      ...b,
      selectedChapters: getSelectedChapters(b.outline).filter(ch => ch._selectedForAnalysis !== false)
    }));
    const selectedTpls = templateStore.templates.filter(t => t.selected || hasAnySelected(t.outline)).map(t => ({
      ...t,
      selectedChapters: getSelectedChapters(t.outline).filter(ch => ch._selectedForAnalysis !== false)
    }));
    
    // 直接全流程生成（blueprintOnly=false），跳过课时切分检测
    const result = await callGenerate(instructionDraft.value, genType, selectedBooks, selectedTpls, 0, false);
    
    if (result.success && result.content) {
      previewContent.value = result.content;
      showPreview.value = true;
      previewHint.value = '✅ 整体生成完成';
      
      // 添加到生成记录（统一格式对 standardizeGeneration 路径）
      const genTypeName = genTypeTemplates[genType]?.name || genType;
      const book = pickPrimaryBook(selectedBooks);
      const gradeLabel = book?.grade || '';
      const subjectLabel = book?.subject || '';
      const bookPrefix = [gradeLabel, subjectLabel].filter(Boolean).join('');
      // 提取章节/单元名：从 outline 树找最近公共祖先（多个章节取高一级）
      const chapters = book?.selectedChapters || [];
      let chapterName = '';
      let isScopeChapterName = false;
      if (chapters.length === 1) {
        chapterName = chapters[0].title || '';
      } else if (chapters.length > 1) {
        const outline = book?.outline || [];
        const paths = [];
        const collectPaths = (nodes, ancestors) => {
          for (const node of nodes) {
            if (chapters.includes(node)) paths.push([...ancestors, node]);
            if (node.children) collectPaths(node.children, [...ancestors, node]);
          }
        };
        collectPaths(outline, []);
        if (paths.length > 1) {
          const first = paths[0];
          let lcaIdx = first.length - 1;
          for (let i = 0; i < first.length; i++) {
            if (!paths.every(p => p.length > i && p[i] === first[i])) { lcaIdx = i - 1; break; }
          }
          if (lcaIdx >= 0) {
            chapterName = first[lcaIdx].title;
          } else {
            // 无共同祖先（跨单元全选）：按 scopeType 命名（带轮换）
            const scopeLabel = pickScopeLabel(scopeType.value, chapters);
            if (scopeLabel) { chapterName = scopeLabel; isScopeChapterName = true; }
            else { chapterName = chapters[0].title || ''; }
          }
        } else {
          chapterName = chapters[0].title || '';
        }
      }
      const parts = [bookPrefix, chapterName, isScopeChapterName ? null : genTypeName].filter(Boolean);
      const now = new Date();
      const ts = now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const safeContent = (result.content && typeof result.content === 'string') ? result.content : '';
      // 🔧 优先取生成内容中的 <h1> 标题，回退到元数据拼接
      const extractedTitle = extractTitleFromContent(safeContent);
      const title = extractedTitle
        ? extractedTitle + '_' + ts
        : (parts.length > 0 ? parts.join(' · ') : genTypeName) + '_' + ts;
      generatedDocs.value.push({
        id: 'doc_' + Date.now() + '_' + Math.random().toString(36),
        title,
        content: safeContent,
        rawContent: safeContent,
        genType: genTypeName,
        style: propositionStyle.value,
        selected: false,
        quality: null,
        status: 'success',
        savedAt: Date.now(),
        graphInstructions: extractGraphs(safeContent),
        confidenceMarks: detectConfidenceIssues(safeContent, selectedBooks),
      });
    } else {
      previewHint.value = `❌ 整体生成失败：${result.error || '未知错误'}`;
    }
  } catch (e) {
    previewHint.value = `❌ 整体生成出错：${e.message}`;
    console.error('[整体生成] 失败:', e);
  }
};

// 🔧 多课时 tab 切换
const switchPeriodTab = (index) => {
  activePeriodTab.value = index;
  const result = multiPeriodResults.value;
  if (!result || !result.periods) return;
  
  let contentToShow = '';
  if (index === -1) {
    // 显示"全部"合并版
    contentToShow = result.content || '';
  } else if (index >= 0 && index < result.periods.length) {
    // 显示单个课时
    contentToShow = result.periods[index]?.content || '';
  }
  
  if (contentToShow) {
    previewContent.value = contentToShow;
    showPreview.value = true;
  }
};

// 🔧 收起课时 tabs
const closePeriodTabs = () => {
  multiPeriodResults.value = null;
  activePeriodTab.value = -1;
};

// ✨ 新增：重新生成蓝图
const regenerateBlueprint = async () => {
  showBlueprintConfirmModal.value = false;
  
  const context = pendingGenerateContext.value;
  if (!context) return;
  
  // 重新调用生成
  try {
    // ✨ 重新生成也只生成蓝图
    const result = await callGenerate(
      instructionDraft.value, 
      context.genType, 
      context.selectedBooks, 
      context.selectedTpls,
      0,
      true  // blueprintOnly
    );
    
    if (result.success && result.blueprint) {
      pendingBlueprint.value = result.blueprint;
      editedBlueprintText.value = result.blueprint;
      
      if (result.parsedBlueprint && result.parsedBlueprint.length > 0) {
        parsedBlueprintForPreview.value = result.parsedBlueprint;
      } else {
        tryParseBlueprintForPreview(result.blueprint);
      }
      
      pendingBlueprintStats.value = calculateBlueprintStats(
        result.parsedBlueprint || [], 
        result.blueprint
      );
      
      pendingGenerateContext.value = {
        result,
        genType: context.genType,
        selectedBooks: context.selectedBooks,
        selectedTpls: context.selectedTpls
      };
      
      showBlueprintConfirmModal.value = true;
    }
  } catch (e) {
    await showAlertDialogFn(`重新生成失败：${e.message}`);
  }
};

// ✨ 新增：完成最终生成（保存到 generatedDocs）
const finalizeGeneration = async (result, genType) => {
  if (result.success) {
    // 🔧 防御：确保 content 是有效字符串
    const safeContent = (result.content && typeof result.content === 'string') ? result.content : '';
    
    const genTypeName = genTypeTemplates[genType]?.name || genType;
    const ctxBooks = pendingGenerateContext.value?.selectedBooks;
    const book = pickPrimaryBook(ctxBooks);
    const gradeLabel = book?.grade || '';
    const subjectLabel = book?.subject || '';
    const bookPrefix = [gradeLabel, subjectLabel].filter(Boolean).join('');
    // 提取章节/单元名：从 outline 树找最近公共祖先（多个章节取高一级）
    const chapters = book?.selectedChapters || [];
    let chapterName = '';
    if (chapters.length === 1) {
      chapterName = chapters[0].title || '';
    } else if (chapters.length > 1) {
      const outline = book?.outline || [];
      const paths = [];
      const collectPaths = (nodes, ancestors) => {
        for (const node of nodes) {
          if (chapters.includes(node)) paths.push([...ancestors, node]);
          if (node.children) collectPaths(node.children, [...ancestors, node]);
        }
      };
      collectPaths(outline, []);
      if (paths.length > 1) {
        const first = paths[0];
        let lcaIdx = first.length - 1;
        for (let i = 0; i < first.length; i++) {
          if (!paths.every(p => p.length > i && p[i] === first[i])) { lcaIdx = i - 1; break; }
        }
        if (lcaIdx >= 0) {
          chapterName = first[lcaIdx].title;
        } else {
          // 无共同祖先（跨单元全选）：按 scopeType 命名
          const scopeLabels = { midterm: '期中', final: '期末', topic: '专题复习' };
          chapterName = scopeLabels[scopeType.value] || (chapters[0].title || '');
        }
      } else {
        chapterName = chapters[0].title || '';
      }
    }
    const parts = [bookPrefix, chapterName, genTypeName].filter(Boolean);
    const now = new Date();
    const ts = now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    // 🔧 优先取生成内容中的 <h1> 标题，回退到元数据拼接
    const extractedTitle = extractTitleFromContent(safeContent);
    const title = extractedTitle
      ? extractedTitle + '_' + ts
      : (parts.length > 0 ? parts.join(' · ') : genTypeName) + '_' + ts;
    
    generatedDocs.value.push({
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36),
      title,
      content: safeContent,
      rawContent: safeContent,
      genType: genTypeName,
      style: propositionStyle.value,
      selected: false,
      quality: null,
      status: 'success',
      savedAt: Date.now(),
      graphInstructions: extractGraphs(safeContent),
      confidenceMarks: detectConfidenceIssues(
        safeContent, 
        textbookStore.textbooks.filter(b => b.outline?.some(c => c.selected))
      ),
      difficulty: (() => {
        // 从蓝图真实统计难度分布，替代固定配置值
        // 优先用全量生成返回的 parsedBlueprint，其次用蓝图确认阶段缓存的
        let parsed = result.parsedBlueprint;
        if ((!parsed || parsed.length === 0) && pendingGenerateContext.value?.result?.parsedBlueprint?.length) {
          parsed = pendingGenerateContext.value.result.parsedBlueprint;
        }
        if (parsed && parsed.length > 0) {
          const counts = { easy: 0, medium: 0, hard: 0 };
          parsed.forEach(q => {
            const d = q.difficulty;
            if (d === '基础') counts.easy++;
            else if (d === '中档' || d === '中等') counts.medium++;
            else if (d === '提高' || d === '较难') counts.hard++;
          });
          const total = parsed.length;
          const hasCounts = counts.easy + counts.medium + counts.hard > 0;
          if (hasCounts) {
            return {
              easy: Math.round((counts.easy / total) * 100),
              medium: Math.round((counts.medium / total) * 100),
              hard: Math.round((counts.hard / total) * 100)
            };
          }
        }
        // 降级：配置面板目标值
        return {
          easy: difficultyLevels.value.find(d => d.name === '基础题')?.percentage || 50,
          medium: difficultyLevels.value.find(d => d.name === '中档题')?.percentage || 30,
          hard: difficultyLevels.value.find(d => d.name === '提高题')?.percentage || 20
        };
      })(),
      blueprint: result.blueprint,
      contentCards: result.contentCards,
      knowledgeMap: result.knowledgeMap,
      issues: result.issues,
      qualityReport: result.qualityReport, // ✨ 新增
      createdAt: Date.now()
    });
    
    // ✨ 显示质量报告提示
    if (result.qualityReport) {
      const report = result.qualityReport;
      let hint = '✅ 生成完成';
      if (!report.formatCheck?.passed) hint += ' | ⚠️ 格式问题';
      previewHint.value = hint;
    }
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ 生成完成，已保存到结果区', type: 'info' } }));
  } else {
    const errorMsg = result.retried 
      ? `生成失败，已自动重试3次仍未成功。\n错误：${result.error}` 
      : `生成失败：${result.error}`;
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '❌ ' + errorMsg, type: 'error' } }));
    await showAlertDialogFn(errorMsg);
  }
};

const cancelGeneration = () => {
  cancelGen();
  isGenerating.value = false;
  generateProgress.value = 0;
  generateStatus.value = '已取消';
};

// 结果处理
const previewDoc = (doc) => {
  previewingDoc.value = doc;
  
  // 如果有置信度标记，在预览内容中高亮显示
  let content = doc.content;
  if (doc.confidenceMarks && doc.confidenceMarks.length > 0) {
    doc.confidenceMarks.forEach(mark => {
      if (mark.keyword !== '不确定性') {
        const regex = new RegExp(mark.keyword, 'g');
        content = content.replace(regex, `<span class="confidence-highlight" title="${mark.message}">${mark.keyword}</span>`);
      }
    });
  }
  
  previewContent.value = content;
  showPreview.value = true;
};

// 🔥 同步恢复预览弹窗（setup 阶段、首帧即显示，调用 previewDoc 保证逻辑一致）
//    原理：iOS 杀进程后重启时，系统先显示旧截图（含预览弹窗），
//    若首帧渲染不带弹窗 → 截图→web 切换产生"闪退"错觉。
//    因此必须在 setup 阶段（首个 render 之前）完成恢复。
(function restorePreviewSync() {
  try {
    const saved = localStorage.getItem('__preview_state');
    if (!saved) return;
    const state = JSON.parse(saved);
    const elapsed = Date.now() - state.timestamp;
    console.log('🔍 [restorePreviewSync] 检测到预览标记，elapsed:', elapsed, 'ms, docId:', state.docId);
    if (elapsed <= 0 || elapsed >= 600000 || !state.docId) {
      localStorage.removeItem('__preview_state');
      console.log('🔍 [restorePreviewSync] 超时/无效，清理标记');
      return;
    }
    const doc = generatedDocs.value.find(d => d.id === state.docId);
    if (!doc) {
      console.warn('🔍 [restorePreviewSync] 在 generatedDocs 中未找到 doc，total:', generatedDocs.value.length);
      localStorage.removeItem('__preview_state');
      return;
    }
    previewDoc(doc);
    localStorage.removeItem('__preview_state');
    console.log('🔥 [restorePreviewSync] 同步恢复预览弹窗成功（首帧即显示），docId:', state.docId);
  } catch (err) {
    console.error('❌ [restorePreviewSync] 恢复失败:', err);
    try { localStorage.removeItem('__preview_state'); } catch {}
  }
})();

const editDoc = () => {
  editingDoc.value = previewingDoc.value;
  editingContent.value = previewingDoc.value.content;
  showPreview.value = false;
  showEditor.value = true;
};

const saveEdit = () => {
  if (editingDoc.value) {
    editingDoc.value.content = editingContent.value;
  }
  showEditor.value = false;
};

// 📋 复制原始源码到剪贴板（包含 $...$、[GRAPH]、[IMAGE] 标记，供 EduRender Studio 使用）
const copyToEduRender = async () => {
  if (!previewingDoc.value) return;
  try {
    await navigator.clipboard.writeText(previewingDoc.value.content);
    previewHint.value = '✅ 已复制，可直接粘贴到 EduRender Studio';
    setTimeout(() => { previewHint.value = ''; }, 3000);
  } catch (e) {
    previewHint.value = '❌ 复制失败：' + e.message;
  }
};

const deleteDoc = (doc) => {
  // 打 _deleted 标记，不立即移除（多端同步需要一条端删除即可）
  const idx = generatedDocs.value.findIndex(d => d.id === doc.id);
  if (idx !== -1) generatedDocs.value[idx]._deleted = true;
};

const batchDeleteDocs = async () => {
  const selected = generatedDocs.value.filter(d => d.selected && !d._deleted);
  if (selected.length === 0) {
    await showAlertDialogFn('请先选择要删除的资料');
    return;
  }
  
  const confirmed = await showConfirmDialogFn(
    `确定要删除 ${selected.length} 个资料吗？`
  );
  
  if (!confirmed) return;
  
  // 打 _deleted 标记（watcher 自动触发推送）
  for (const d of selected) {
    d._deleted = true;
    d.selected = false;
  }
  
  await showAlertDialogFn(`已标记 ${selected.length} 个资料为待删除（同步后自动清理）`);
};

const toggleSelectAll = () => {
  const v = !allSelected.value;
  generatedDocs.value.forEach(d => d.selected = v);
};

const markQuality = (doc, q) => {
  doc.quality = doc.quality === q ? null : q;
};

// ✨ 新增：查看质量报告
const showQualityReport = async (doc) => {
  if (!doc.qualityReport) {
    await showAlertDialogFn('暂无质量报告');
    return;
  }
  const report = doc.qualityReport;
  let text = '📊 质量报告\n\n';
  
  // 格式检查
  text += '【格式检查】' + (report.formatCheck?.passed ? '✅ 通过' : '❌ 未通过') + '\n';
  if (report.formatCheck?.details?.length) {
    report.formatCheck.details.forEach(d => text += '  - ' + d + '\n');
  }
  
  // 难度
  text += '\n【难度分布】' + (report.difficultyCheck?.passed ? '✅ 通过' : '⚠️ 偏差') + '\n';
  if (report.difficultyCheck?.details?.length) {
    report.difficultyCheck.details.forEach(d => text += '  - ' + d + '\n');
  }
  
  // AI审查
  if (report.aiReview) {
    text += '\n【AI审查】' + (report.aiReview.passed ? '✅ 通过' : '⚠️ 未通过') + '\n';
    if (report.aiReview.details?.length) {
      report.aiReview.details.forEach(d => text += '  - ' + d + '\n');
    }
  }
  
  // 模板对标
  if (report.templateMatch) {
    text += '\n【模板对标】' + (report.templateMatch.passed ? '✅ 通过' : '⚠️ 偏差') + '\n';
    if (report.templateMatch.details?.length) {
      report.templateMatch.details.forEach(d => text += '  - ' + d + '\n');
    }
  }
  
  // issues
  if (doc.issues && doc.issues.length > 0) {
    text += '\n【问题列表】\n';
    doc.issues.forEach(i => text += '  ' + i + '\n');
  }
  
  await showAlertDialogFn(text);
};

const getQualityClass = (q) => {
  return { good: 'quality-good', bad: 'quality-bad', star: 'quality-star' }[q] || '';
};

// ==================== PDF 打印降级（与 TypesetModule 一致的健壮实现） ====================
const printPdfFallback = (htmlContent) => {
  const printCss = getPrintCss();
  // 🔧 包装完整 HTML 结构（含打印样式）
  let printContent;
  if (htmlContent.includes('<!DOCTYPE html>') || htmlContent.includes('<html')) {
    // 已有完整 HTML 结构 → 注入打印样式
    printContent = htmlContent.replace('</head>', `<style>${printCss}</style></head>`);
    if (!printContent.includes('<style>')) {
      // 没有 </head>，尝试在 <head> 后注入
      printContent = htmlContent.replace('<head>', `<head><style>${printCss}</style>`);
    }
  } else {
    // 纯 HTML 片段 → 包装完整结构
    printContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${printCss}</style></head><body>${htmlContent}</body></html>`;
  }
  
  // 🔧 带窗口尺寸参数 → 更不容易被弹窗拦截器拦截
  const w = window.open('', '_blank', 'width=800,height=600');
  if (w) {
    w.document.write(printContent);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  } else {
    // 🔧 弹窗被拦截 → 在当前窗口打印（最差降级）
    console.warn('弹窗被拦截，在当前窗口打印');
    // 将内容写入隐藏 iframe 以避免覆盖当前页面
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999';
    iframe.srcdoc = printContent;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow.print();
      } catch {}
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 2000);
    };
  }
};

const downloadDoc = async (doc, format) => {
  // 学生版：移除答案区域
  let content = doc.content;
  
  // 🔧 第二道防线：清洗 AI 响应中可能残留的 markdown 代码块标记和对话文本
  //    虽然 callAI 中已有 cleanReasoningOutput，但部分模型（如 Qwen）仍可能绕过
  const mdBlockRegex = /```(?:html?|HTML?)?[\s\n]*([\s\S]*?)\n?```/g;
  const mdBlocks = [];
  let mdMatch;
  while ((mdMatch = mdBlockRegex.exec(content)) !== null) {
    mdBlocks.push(mdMatch[1].trim());
  }
  if (mdBlocks.length > 0) {
    content = mdBlocks.join('\n\n');
  } else {
    // 无代码块但有 HTML 标签 → 截掉对话前缀
    const htmlStartIdx = content.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span)\b/i);
    if (htmlStartIdx > 0 && htmlStartIdx < 500) {
      content = content.substring(htmlStartIdx);
    }
  }
  
  if (!teacherVersion.value) {
    content = content.replace(/<div class="answer-section">[\s\S]*?<\/div>/gi, '<div class="answer-section"><p>（答案略，请独立完成）</p></div>');
  }
  if (format === 'pdf') {
    // 转换 $...$ 公式标记为可读文本
    const pdfContent = convertFormulasInHtml(content);
    
    // 🔧 优先使用 Electron 原生 PDF 导出
    if (window.electronAPI?.exportPdf) {
      const storagePath = getStoragePath();
      const outputPath = `${storagePath}/导出/${doc.title}_${Date.now()}.pdf`;
      const pdfDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
      try {
        await window.electronAPI.createDirectory(pdfDir);
      } catch {}
      try {
        const result = await window.electronAPI.exportPdf(pdfContent, outputPath);
        if (result.success) {
          await showAlertDialogFn(`PDF已保存至：${result.path}`);
        } else {
          // 🔧 电子导出失败 → 清理空目录 + 降级到浏览器打印
          try { await window.electronAPI.removeFile(outputPath); } catch {}
          try { await window.electronAPI.removeDirectory(pdfDir); } catch {}
          await showAlertDialogFn(`PDF导出失败：${result.error || '未知错误'}\n将使用浏览器打印作为降级方案`);
          printPdfFallback(pdfContent);
        }
      } catch (pdfErr) {
        // 🔧 PDF 生成异常 → 清理文件 + 降级
        console.error('PDF导出异常:', pdfErr);
        try { await window.electronAPI.removeFile(outputPath); } catch {}
        await showAlertDialogFn(`PDF导出异常：${pdfErr.message}\n将使用浏览器打印作为降级方案`);
        printPdfFallback(pdfContent);
      }
    } else {
      // 🔧 降级：使用浏览器打印（与 TypesetModule 一致的健壮实现）
      printPdfFallback(pdfContent);
    }
    return;
  }
  
  // Word 使用 docxBuilder 管线生成原生 .docx（保真预览效果）
  if (format === 'docx') {
    // 🔧 关键修复：docxBuilder 依赖 getComputedStyle 读取字体/颜色/字号等样式，
    //    容器必须挂载到 DOM 中才能正确计算样式，否则所有样式丢失导致乱码
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;visibility:hidden;width:210mm;left:-9999px;font-family:SimSun;';
    container.innerHTML = content;
    document.body.appendChild(container);
    
    try {
      const blob = await htmlToDocxBlob(container);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${doc.title}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error('Word导出失败，降级为HTML:', e);
      const blobFallback = new Blob([content], { type: 'text/html' });
      const af = document.createElement('a');
      af.href = URL.createObjectURL(blobFallback);
      af.download = `${doc.title}.html`;
      af.click();
      URL.revokeObjectURL(af.href);
    } finally {
      // 🔧 清理：导出完成后从 DOM 移除容器
      if (container.parentNode) container.parentNode.removeChild(container);
    }
    return;
  }
};

const batchDownload = async () => {
  const selected = generatedDocs.value.filter(d => d.selected);
  if (selected.length === 0) {
    await showAlertDialogFn('请先选择要下载的资料');
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  const totalFiles = selected.length * (batchDownloadFormat.value === 'both' ? 2 : 1);
  
  // 显示进度提示
  statusText.value = `正在批量下载... 0/${totalFiles}`;
  progress.value = 0;
  isGenerating.value = true; // 复用生成状态显示进度
  
  try {
    for (let i = 0; i < selected.length; i++) {
      const doc = selected[i];
      
      try {
        if (batchDownloadFormat.value === 'word' || batchDownloadFormat.value === 'both') {
          downloadDoc(doc, 'docx');
          successCount++;
        }
        if (batchDownloadFormat.value === 'pdf' || batchDownloadFormat.value === 'both') {
          downloadDoc(doc, 'pdf');
          successCount++;
        }
        
        // 更新进度
        const currentProgress = Math.round((successCount / totalFiles) * 100);
        statusText.value = `正在批量下载... ${successCount}/${totalFiles} (${currentProgress}%)`;
        progress.value = currentProgress;
        
        // 每下载一个文件后稍作延迟，避免浏览器阻止多个下载
        if (i < selected.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (e) {
        console.error(`下载失败: ${doc.title}`, e.message);
        failCount++;
      }
    }
    
    // 显示最终结果
    progress.value = 100;
    statusText.value = `批量下载完成`;
    
    if (failCount > 0) {
      await showAlertDialogFn(
        `批量下载完成！\n成功: ${successCount} 个文件\n失败: ${failCount} 个文件`
      );
    } else {
      await showAlertDialogFn(`已成功下载 ${successCount} 个文件`);
    }
  } finally {
    // 延迟清除状态，让用户看到完成提示
    setTimeout(() => {
      isGenerating.value = false;
      statusText.value = '';
      progress.value = 0;
    }, 2000);
  }
};

const retryGenerate = (doc) => {
  const idx = generatedDocs.value.indexOf(doc);
  if (idx > -1) generatedDocs.value.splice(idx, 1);
  generate('single');
};

const saveToHistory = async (doc) => {
  const history = (await storage.getItem('docHistory')) || [];
  history.unshift({ ...doc, savedAt: Date.now() });
  const localTrimmed = history.slice(0, 50);
  await storage.setItem('docHistory', localTrimmed);
  // ☁️ 即时上推（只写自己设备行，不影响其他设备）
  pushDocHistory(localTrimmed).then(ok => { if (!ok) console.warn('☁️ 保存历史推送失败'); }).catch(e => console.warn('☁️ 保存历史推送异常', e));
};

const collectGraph = async (doc, idx) => {
  const graphs = (await storage.getItem('graphLibrary')) || [];
  graphs.push({ ...doc.graphInstructions[idx], savedAt: Date.now(), id: 'graph_' + Date.now() });
  await storage.setItem('graphLibrary', graphs);
  await showAlertDialogFn('已收藏到图形库');
};

const sendToTypeset = async (doc) => {
  let content = doc.content;
  if (!teacherVersion.value) {
    content = content.replace(/<div class="answer-section">[\s\S]*?<\/div>/gi, '<div class="answer-section"><p>（答案略，请独立完成）</p></div>');
  }
  // 🔧 双通道传递：window 兜底（解决 lazy-load 竞态）+ CustomEvent
  window.__pendingTypesetContent = { content, meta: { title: doc.title || '生成文档', genType: doc.genType || '' } };
  window.dispatchEvent(new CustomEvent(APP_EVENTS.SWITCH_TAB, { detail: { tab: 'typeset' } }));
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.TYPESET_CONTENT, {
      detail: window.__pendingTypesetContent
    }));
  }, 150);
};

// 🔧 新增：为文档生成变体版本
const generateVariantForDoc = async (doc) => {
  if (!doc.content || !doc.parsedBlueprint || doc.parsedBlueprint.length === 0) {
    await showAlertDialogFn('该文档缺少蓝图信息，无法生成变体');
    return;
  }

  const totalQuestions = doc.parsedBlueprint.length;
  if (totalQuestions === 0) {
    await showAlertDialogFn('没有题目可以生成变体');
    return;
  }

  // 让用户选择为哪些题生成变体
  const questionNumbers = doc.parsedBlueprint.map((q, i) => `${i + 1}. ${q.type} - ${q.knowledgePoint}`);
  const selectedIndex = await showInputDialogFn(
    `请选择要生成变体的题目（输入序号1-${totalQuestions}，或输入"all"为全部题目生成变体）：\n\n${questionNumbers.join('\n')}`,
    '1'
  );

  if (!selectedIndex) return;

  try {
    if (selectedIndex.toLowerCase() === 'all') {
      // 为所有题目生成变体
      isGenerating.value = true;
      for (let i = 0; i < totalQuestions; i++) {
        generateStatus.value = `正在生成第 ${i + 1}/${totalQuestions} 题的变体...`;
        generateProgress.value = Math.round((i / totalQuestions) * 100);
        
        const questionPlan = doc.parsedBlueprint[i];
        const variant = await generateQuestionVariant(
          doc.generatedQuestions?.[i] || doc.content,
          questionPlan,
          { changeData: true, changeContext: true, changeOptions: true }
        );
        
        if (variant && doc.generatedQuestions) {
          doc.generatedQuestions[i] = variant;
        }
      }
      
      // 更新文档内容
      doc.content = doc.generatedQuestions?.join('\n\n') || doc.content;
      doc.title = `${doc.title}_变体版`;
      generateStatus.value = '变体生成完成';
      previewHint.value = `已为全部${totalQuestions}题生成变体版本`;
    } else {
      // 为单道题生成变体
      const idx = parseInt(selectedIndex) - 1;
      if (isNaN(idx) || idx < 0 || idx >= totalQuestions) {
        await showAlertDialogFn('请输入有效的题目序号');
        return;
      }

      const questionPlan = doc.parsedBlueprint[idx];
      isGenerating.value = true;
      generateStatus.value = `正在生成第 ${idx + 1} 题的变体...`;
      generateProgress.value = 50;

      const variant = await generateQuestionVariant(
        doc.generatedQuestions?.[idx] || doc.content,
        questionPlan,
        { changeData: true, changeContext: true, changeOptions: true }
      );

      if (variant && doc.generatedQuestions) {
        doc.generatedQuestions[idx] = variant;
        doc.content = doc.generatedQuestions.join('\n\n');
        doc.title = `${doc.title}_题${idx + 1}变体版`;
        generateStatus.value = '变体生成完成';
        previewHint.value = `已为第${idx + 1}题生成变体版本`;
      }
    }
  } catch (e) {
    console.error('生成变体失败:', e);
    await showAlertDialogFn('生成变体失败: ' + e.message);
  } finally {
    isGenerating.value = false;
    generateProgress.value = 0;
  }
};

// 指令库操作
const loadFromInstructionLib = () => {
  showInstructionLibModal.value = true;
};

const saveToInstructionLib = async () => {
  if (!instructionDraft.value) {
    await showAlertDialogFn('没有指令可保存');
    return;
  }
  newInstructionName.value = '';
  newInstructionCategory.value = '试卷';
  showSaveToLibModal.value = true;
};

const confirmSaveToLib = async () => {
  if (!newInstructionName.value.trim()) {
    await showAlertDialogFn('请输入指令名称');
    return;
  }
  
  instructionStore.addInstruction({
    name: newInstructionName.value,
    category: newInstructionCategory.value,
    content: instructionDraft.value
  });
  showSaveToLibModal.value = false;
  await showAlertDialogFn('保存成功');
};

const loadInstruction = (ins) => {
  let content = ins.content;
  // 🔧 如果是完整指令，追加学段+学科精准适配（与 buildInstruction 一致）
  if (ins.type === 'full') {
    const selectedBooks = textbookStore.textbooks.filter(b => hasAnySelected(b.outline));
    const book = selectedBooks[0];
    const stageRaw = book?.stage || '';
    // 🔧 映射为英文 key（教材库值是 "小学/初中/高中"）
    const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = book?.subject || '';
    const grade = book?.grade || '';
    if (stage || subject) {
      content += '\n\n【学段·学科精准适配】\n';
      // 🔧 从指令库获取学段提示（三维度智能匹配）
      const stageHintBlocks = getMatchingBlockInstructions({ category: '生成-快捷学段提示', stage });
      if (stageHintBlocks.length > 0) {
        content += stageHintBlocks[0].content + '\n';
      }
      if (grade) content += `- 当前年级：${grade}\n`;
      content += '\n⚠️ 以上学段和学科要求优先级高于通用模板，如有冲突以本条为准。\n';
    }
  }
  instructionDraft.value = content;
  showInstructionLibModal.value = false;
};

const appendInstruction = (ins) => {
  instructionDraft.value += '\n\n' + ins.content;
  showInstructionLibModal.value = false;
};

const deleteInstructionFromLib = (id) => {
  instructionStore.removeInstruction(id);
};

// 题型管理
const addQuestionType = () => {
  questionTypes.value.push({ name: '新题型', selected: true, count: 1, score: 1 });
};

// 关闭详细配置弹窗并保存
const closeDetailConfigModal = () => {
  saveCachedConfig();
  showDetailConfigModal.value = false;
};

// 🔧 自动保存生成记录，刷新不丢失（同步期间跳过，避免与 app-refresh 的推送重复）
watch(generatedDocs, () => {
  if (typeof _skipCloudPush !== 'undefined' && _skipCloudPush) return;
  saveGeneratedDocs();
}, { deep: true });

// 🎯 genTypes 变更时，若不再包含 special 则清空专项子类型选择
watch(genTypes, (newTypes) => {
  if (!newTypes.includes('special')) {
    specialSubType.value = '';
  }
});

// 🔧 题型自动同步：学科/类型变化时从指令库「生成-题型分布建议」自动填充
// gradeSegment 映射：小学1-2→primary_low, 3-4→primary_mid, 5-6→primary_high, 初中→middle, 高中→high
const syncQuestionTypesFromLib = () => {
  const book = selectedTextbooks.value?.[0];
  if (!book) return;
  const subject = book.subject || '';
  const primaryGenType = genTypes.value?.find(t => t === 'exam' || t === 'practice');
  if (!subject || !primaryGenType) return;
  
  // 仅当 questionTypes 为空或学科/类型发生变化时才同步（避免覆盖用户手动修改）
  const currentKey = `${subject}|${primaryGenType}`;
  if (questionTypes.value.length > 0 && currentKey === lastSyncedTypeKey.value) return;
  
  // 计算 gradeSegment
  const stage = book.stage || '';
  const grade = book.grade || '';
  const gradeNumMatch = grade.match(/[一二三四五六七八九十]+/);
  const chineseNums = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
  const gradeNum = gradeNumMatch ? (chineseNums[gradeNumMatch[0]] || 0) : 0;
  
  let gradeSegment;
  if (stage === '小学' || stage === 'primary') {
    if (gradeNum >= 1 && gradeNum <= 2) gradeSegment = 'primary_low';
    else if (gradeNum >= 3 && gradeNum <= 4) gradeSegment = 'primary_mid';
    else gradeSegment = 'primary_high';
  } else if (stage === '初中' || stage === 'middle') {
    gradeSegment = 'middle';
  } else if (stage === '高中' || stage === 'high') {
    gradeSegment = 'high';
  } else {
    gradeSegment = stage; // fallback
  }
  
  const types = getTypeDistribution(primaryGenType, subject, gradeSegment);
  if (types.length > 0) {
    questionTypes.value = types;
    lastSyncedTypeKey.value = currentKey;
  }
};

// 教材选择或资料类型变化时触发题型同步
watch([() => selectedTextbooks.value?.[0]?.subject, () => selectedTextbooks.value?.[0]?.stage, genTypes],
  () => { syncQuestionTypesFromLib(); },
  { deep: true }
);

// 初始化
// ☁️ 云端数据同步完成后：从 localStorage 重新加载 + 清理 _deleted 标记项
// 🔧 _cloudSyncRunning 全局锁：KeepAlive 缓存多实例时，只允许一个实例执行
let _skipCloudPush = false;
let _cloudSyncRunning = false;
const onCloudSync = () => {
  if (isGenerating.value) return;
  if (_cloudSyncRunning) return; // 🔧 KeepAlive 多实例保护
  _cloudSyncRunning = true;
  _skipCloudPush = true;
  try {
    // 从 localStorage 重新加载（同步已写入合并结果）
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // 兜底截断：上限 20 条，保留最新的
          generatedDocs.value = parsed.length > 20 ? parsed.slice(-20) : parsed;
        }
      } catch {}
    }
    // 清理 _deleted 项
    const before = generatedDocs.value.length;
    generatedDocs.value = generatedDocs.value.filter(d => !d._deleted);
    if (generatedDocs.value.length < before) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(generatedDocs.value));
      console.log('🧹 [GenerateModule] 同步后清理 ' + (before - generatedDocs.value.length) + ' 条已删除项');
    }
    console.log('☁️ [GenerateModule] 同步完成，当前 ' + generatedDocs.value.length + ' 条生成结果');
  } finally {
    // 🔧 延迟释放标记，让 watcher 跳过本次触发
    setTimeout(() => { _skipCloudPush = false; _cloudSyncRunning = false; }, 500);
  }
};

// 📱 下拉刷新处理器：仅重载数据（教材/模板），不重置任务状态
const onPullRefresh = () => {
  textbookStore.loadTextbooks().catch(() => {});
  templateStore.loadTemplates().catch(() => {});
  console.log('📱 下拉刷新：已重载教材和模板数据（保留当前任务）');
};

// 🔧 KeepAlive 感知：激活时注册监听，停用时移除，避免缓存实例泄漏
const _setupListeners = () => {
  window.addEventListener('pull-refresh', onPullRefresh);
  window.addEventListener(APP_EVENTS.LOAD_INSTRUCTION, (e) => {
    if (e.detail) instructionDraft.value = e.detail;
  });
  window.addEventListener('data-sync-complete', onCloudSync);
};
const _teardownListeners = () => {
  window.removeEventListener('pull-refresh', onPullRefresh);
  window.removeEventListener('data-sync-complete', onCloudSync);
};

// 首次挂载
onMounted(async () => {
  await textbookStore.loadTextbooks();
  await templateStore.loadTemplates();
  await loadCachedConfig();
  // 🔧 同步已保存的 apiConfig 到响应式对象（否则模型芯片显示默认值而非实际配置）
  await getCurrentEngineConfig();
  // 🌐 检测 DeepSeek API 真实就绪状态
  checkDeepSeekReady();
  _setupListeners();
});

// 🔧 KeepAlive 重新激活：重新注册事件监听（防止旧实例也收到）
onActivated(() => { _setupListeners(); });

// 🔧 KeepAlive 停用缓存：移除监听，避免不活跃实例收到事件
onDeactivated(() => { _teardownListeners(); });

// 真正销毁
onUnmounted(() => { _teardownListeners(); });

// 置信度检测函数
const detectConfidenceIssues = (content, selectedBooks) => {
  const marks = [];
  
  // 🔧 防御：content 必须是非空字符串
  if (!content || typeof content !== 'string' || !content.trim()) return marks;
  
  // 获取当前学段和年级
  const book = selectedBooks[0];
  if (!book) return marks;
  
  const stage = book.stage;
  const grade = book.grade;
  
  // 🔧 改为智能语义判断而非硬编码关键词匹配
  // 保留高频超纲词作为快速初筛
  const advancedKeywords = {
    '小学': ['二次函数', '三角函数', '勾股定理', '负数', '方程', '代数式', '几何证明'],
    '初中': ['导数', '微积分', '对数', '指数函数', '立体几何', '概率分布', '复数'],
    '高中': ['傅里叶', '拉普拉斯', '矩阵论', '泛函', '拓扑', '微分方程']
  };
  
  const keywords = advancedKeywords[stage] || [];
  
  // 检测内容中是否包含超纲关键词
  keywords.forEach(keyword => {
    if (content.includes(keyword)) {
      marks.push({
        keyword: keyword,
        message: `可能涉及${stage}超纲内容："${keyword}"，请审阅`
      });
    }
  });
  
  // 🔧 新增：标记提示——如需更准确的超纲判断，请在「分析教材」时仔细核对知识层级
  if (marks.length === 0 && content.length > 100) {
    // 即使没有命中硬编码关键词，也提示用户需要人工核对超纲范围
    // （硬编码词库无法覆盖所有情况，特别是不同版本教材的差异）
  }
  
  // 检测可能的不确定性表述
  const uncertaintyPatterns = [
    { pattern: /可能|或许|大概|应该|也许/g, message: '包含不确定性表述' },
    { pattern: /据推测|一般认为|有观点认为/g, message: '包含非确定性学术表述' }
  ];
  
  uncertaintyPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(content)) {
      marks.push({ keyword: '不确定性', message });
    }
  });
  
  return marks;
};

// 🔧 新增：可用的题型列表
const availableQuestionTypes = [
  '选择题', '填空题', '判断题', '计算题', '解答题', 
  '应用题', '简答题', '作图题', '实验题', '证明题',
  '完形填空', '阅读理解', '书面表达'
];

// 🔧 新增：根据学科和年级获取推荐的题型列表（用于蓝图确认弹窗排序提示）
const getRecommendedQuestionTypes = () => {
  // 获取当前选中的教材
  const selectedBook = textbookStore.textbooks.find(b => 
    b.outline && textbookStore.hasAnySelected(b.outline)
  );
  
  if (!selectedBook) return [];
  
  const stage = selectedBook.stage;
  const subject = selectedBook.subject;
  
  // 各学段学科的推荐题型
  const recommendedTypes = {
    '小学': {
      '数学': ['口算', '填空', '判断', '选择', '计算', '应用题', '操作题'],
      '语文': ['看拼音写词语', '组词', '造句', '选词填空', '修改病句', '阅读理解', '古诗词默写', '作文'],
      '英语': ['听力', '选择', '填空', '连线', '阅读理解', '写作'],
      '科学': ['选择', '填空', '判断', '连线', '实验探究', '简答', '观察记录'],
      '道德与法治': ['选择', '判断', '填空', '连线', '情境分析', '简答']
    },
    '初中': {
      '数学': ['选择', '填空', '计算', '证明', '作图', '应用题', '综合探究'],
      '语文': ['基础知识', '文言文阅读', '现代文阅读', '古诗词鉴赏', '综合性学习', '写作'],
      '英语': ['听力', '单项选择', '完形填空', '阅读理解', '任务型阅读', '书面表达'],
      '物理': ['选择', '填空', '作图', '实验探究', '计算'],
      '化学': ['选择', '填空', '实验探究', '计算', '推断'],
      '生物': ['选择', '填空', '识图', '实验探究', '简答'],
      '历史': ['选择', '填空', '材料解析', '简答', '论述'],
      '地理': ['选择', '填空', '读图分析', '简答', '综合题'],
      '道德与法治': ['选择', '简答', '材料分析', '实践探究'],
      '信息技术': ['选择', '填空', '判断', '操作题', '简答', '综合应用']
    },
    '高中': {
      '数学': ['单选', '多选', '填空', '解答题'],
      '语文': ['现代文阅读', '文言文阅读', '古代诗歌鉴赏', '名篇名句默写', '语言文字运用', '写作'],
      '英语': ['听力', '阅读理解', '七选五', '完形填空', '语法填空', '书面表达'],
      '物理': ['单选', '多选', '实验', '计算'],
      '化学': ['单选', '不定项选择', '填空', '实验', '计算', '有机推断'],
      '生物': ['单选', '多选', '填空', '实验设计', '遗传分析'],
      '历史': ['选择', '材料解析', '论述'],
      '地理': ['选择', '综合题', '选做题'],
      '思想政治': ['选择', '简答', '辨析', '论述'],
      '信息技术': ['选择', '填空', '判断', '操作题', '程序填空', '综合应用', '论述']
    }
  };
  
  const stageTypes = recommendedTypes[stage]?.[subject];
  
  return stageTypes || [];
};

// 🔧 新增：获取推荐题型列表（响应式计算属性）
const recommendedQuestionTypes = computed(() => getRecommendedQuestionTypes());

// 🔧 新增：蓝图表格单元格修改时，同步更新统计和文本
const onBlueprintCellChange = (qIdx) => {
  // 重新计算统计信息
  pendingBlueprintStats.value = calculateBlueprintStats(
    parsedBlueprintForPreview.value,
    editedBlueprintText.value
  );
  // 同步到文本编辑区
  syncTableToText();
};

// 🔧 新增：删除蓝图中的某道题（支持撤销）
const lastDeletedQuestion = ref(null);  // 在 script setup 顶部添加这个变量

const removeBlueprintQuestion = async (qIdx) => {
  if (parsedBlueprintForPreview.value.length <= 1) {
    await showAlertDialogFn('至少保留一道题');
    return;
  }
  // 保存删除前的数据用于撤销
  lastDeletedQuestion.value = {
    index: qIdx,
    question: JSON.parse(JSON.stringify(parsedBlueprintForPreview.value[qIdx]))
  };
  
  parsedBlueprintForPreview.value.splice(qIdx, 1);
  // 重新编号
  parsedBlueprintForPreview.value.forEach((q, i) => {
    q.number = i + 1;
  });
  // 重新计算统计
  pendingBlueprintStats.value = calculateBlueprintStats(
    parsedBlueprintForPreview.value,
    editedBlueprintText.value
  );
  // 同步到文本编辑区
  syncTableToText();
  
  // 3秒后清除撤销记录（可选）
  setTimeout(() => {
    lastDeletedQuestion.value = null;
  }, 30000);
};

// 🔧 新增：撤销删除
const undoDeleteQuestion = async () => {
  if (!lastDeletedQuestion.value) {
    await showAlertDialogFn('没有可撤销的删除操作');
    return;
  }
  
  const { index, question } = lastDeletedQuestion.value;
  parsedBlueprintForPreview.value.splice(index, 0, question);
  // 重新编号
  parsedBlueprintForPreview.value.forEach((q, i) => {
    q.number = i + 1;
  });
  // 重新计算统计
  pendingBlueprintStats.value = calculateBlueprintStats(
    parsedBlueprintForPreview.value,
    editedBlueprintText.value
  );
  syncTableToText();
  lastDeletedQuestion.value = null;
};

// 🔧 新增：将表格数据同步到文本编辑区
const syncTableToText = () => {
  const questions = parsedBlueprintForPreview.value;
  if (questions.length === 0) return;
  
  // 生成 Markdown 表格格式的蓝图文本（比 JSON 更易读）
  let text = '| 题号 | 题型 | 知识点 | 难度 | 分值 | 来源 |\n';
  text += '|------|------|--------|------|------|------|\n';
  for (const q of questions) {
    text += `| ${q.number} | ${q.type} | ${q.knowledgePoint} | ${q.difficulty} | ${q.score} | ${q.sourceChapter || ''} |\n`;
  }
  
  // 追加 JSON 格式（程序解析用）
  text += '\n--- 以下为JSON格式（程序解析用） ---\n';
  text += JSON.stringify(questions, null, 2);
  
  editedBlueprintText.value = text;
};

// 🔧 新增：添加题目
const addBlueprintQuestion = () => {
  const maxNumber = parsedBlueprintForPreview.value.length > 0 
    ? Math.max(...parsedBlueprintForPreview.value.map(q => q.number))
    : 0;
  
  parsedBlueprintForPreview.value.push({
    number: maxNumber + 1,
    type: '选择题',
    knowledgePoint: '请填写知识点',
    difficulty: '基础',
    score: 3,
    sourceChapter: ''
  });
  
  pendingBlueprintStats.value = calculateBlueprintStats(
    parsedBlueprintForPreview.value,
    editedBlueprintText.value
  );
  syncTableToText();
};
</script>

<style scoped>
.generate-module {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.config-ribbon {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid var(--border-light);
}

.ribbon-left, .ribbon-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.model-recommend-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f0f4ff, #e8f0fe);
  border: 1px solid #c5d5f7;
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
}
.model-recommend-badge .badge-icon {
  font-size: 14px;
}
.model-recommend-badge .badge-model {
  font-weight: 600;
  color: #4a6cf7;
}
.model-recommend-badge .badge-tip {
  color: #888;
  font-size: 11px;
}
/* 当前模型配置芯片 */
.model-config-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  font-size: 11px;
  white-space: nowrap;
  user-select: none;
  cursor: default;
}
.model-config-chip .chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.model-config-chip .chip-dot.dot-ollama { background: #4a9e5c; }
.model-config-chip .chip-dot.dot-cloud { background: #4a6cf7; }
.model-config-chip .chip-dot.dot-ready { background: #22c55e; }
.model-config-chip .chip-dot.dot-checking { background: #f59e0b; animation: pulse-dot 1.2s ease-in-out infinite; }
.model-config-chip .chip-dot.dot-error { background: #ef4444; }
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.chip-status-err { font-size: 12px; margin-left: 2px; }
.model-config-chip .chip-label { color: #888; }
.model-config-chip .chip-sep { color: #ccc; }
.model-config-chip .chip-model { color: #444; font-weight: 500; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
/* 分析按钮模型提示 */
.analyze-model-hint {
  font-size: 10px;
  color: var(--primary-light);
  background: #e8f0fe;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  cursor: help;
  margin-left: 2px;
  vertical-align: middle;
}

.ribbon-btn {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.ribbon-btn:hover {
  background: var(--primary-bg);
  border-color: var(--primary-light);
}

.main-workspace {
  flex: 1;
  display: flex;
  min-height: 0;
  gap: 1px;
  background: var(--border-light);
}

.selection-panel {
  width: 300px;
  background: white;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-section {
  border-bottom: 1px solid var(--border-light);
}

.section-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 600;
  color: var(--primary);
  background: var(--bg-card);
}

.section-header:hover {
  background: var(--primary-bg);
}

.selected-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--primary-light);
}

.section-content {
  padding: 12px;
}

.item-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--primary-lighter);
  border-radius: 12px;
  color: var(--primary-light);
}

.chapter-title {
  flex: 1;
}

.page-range {
  font-size: 11px;
  color: var(--text-muted);
}

.instruction-panel {
  flex: 1;
  background: white;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h3 {
  font-size: 16px;
  color: var(--primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.instruction-textarea {
  flex: 1;
  width: 100%;
  padding: 16px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  font-family: 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  background: var(--bg-card);
}

.preview-hint {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--success-light);
  border-radius: 8px;
  color: #2e7d32;
  font-size: 13px;
}

.analysis-result {
  margin-top: 12px;
  padding: 12px;
  background: #f0f7ff;
  border-radius: 8px;
  border: 1px solid var(--primary-light);
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--primary);
}

.result-panel {
  width: 400px;
  background: white;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.generate-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.btn-success {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: none;
  background: var(--success);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.btn-success:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--danger);
  background: white;
  color: var(--danger);
  cursor: pointer;
}

.generating-tip {
  margin-bottom: 12px;
  padding: 12px;
  background: #f0f7ff;
  border-radius: 8px;
}

.progress-bar {
  height: 6px;
  background: var(--border-light);
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-light);
  transition: width 0.2s;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
}

/* 🔧 多课时结果 tabs */
.period-tabs {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.period-tab-bar {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
}

.period-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 12px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  color: var(--text-secondary);
}

.period-tab:hover {
  background: var(--info-light);
  border-color: var(--primary-light);
}

.period-tab.active {
  background: var(--primary-light);
  color: #fff;
  border-color: var(--primary-light);
  font-weight: 600;
}

.period-tab-label {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.period-tab-kp {
  font-size: 10px;
  padding: 1px 5px;
  background: rgba(0,0,0,0.08);
  border-radius: 4px;
  color: var(--text-muted);
}

.period-tab.active .period-tab-kp {
  background: rgba(255,255,255,0.25);
  color: #fff;
}

.period-tab-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 8px;
}

.select-all {
  cursor: pointer;
  color: var(--primary-light);
  font-size: 13px;
}

.batch-delete {
  cursor: pointer;
  color: var(--danger);
  font-size: 13px;
}

.result-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 12px;
  background: white;
}

.result-item.quality-good {
  border-left: 4px solid var(--success);
}

.result-item.quality-bad {
  border-left: 4px solid var(--danger);
}

.result-item.quality-star {
  border-left: 4px solid #f1c40f;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-info {
  flex: 1;
  cursor: pointer;
}

.result-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.result-meta {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.difficulty-tag {
  font-size: 11px;
  padding: 2px 6px;
  background: #f0f7ff;
  border-radius: 4px;
  color: var(--primary-light);
  white-space: nowrap;
}

.result-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.quality-marks {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.quality-marks span {
  cursor: pointer;
  opacity: 0.5;
}

.quality-marks span.active {
  opacity: 1;
}

.graph-collect {
  margin-top: 8px;
  font-size: 12px;
  color: var(--primary-light);
  cursor: pointer;
}

.failed-tip {
  margin-top: 8px;
  color: var(--danger);
  font-size: 12px;
}

.batch-download {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.btn-warning {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: none;
  background: #f39c12;
  color: white;
  cursor: pointer;
}

.btn-warning:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3500;
  pointer-events: none;
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 24px;
  min-width: 400px;
  max-width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.12), 0 16px 48px rgba(0,0,0,0.16);
  border: 2px solid var(--border);
  position: relative;
}

.modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: linear-gradient(90deg, var(--primary-light) 0%, #4a90d9 50%, var(--primary-light) 100%);
  border-radius: 14px 14px 0 0;
}

.large-modal {
  min-width: 600px;
  max-height: 90vh;
}

.draggable-modal {
  position: fixed !important;
  transform: none !important;
  cursor: default;
}

.modal-drag-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  background: linear-gradient(135deg, var(--primary-light) 0%, #1e4a8a 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  cursor: move;
  border-radius: 16px 16px 0 0;
  user-select: none;
  z-index: 10;
  transition: background 0.2s;
  opacity: 0.6;
}

.modal-drag-handle:hover {
  background: linear-gradient(135deg, #1e4a8a 0%, #163a6f 100%);
  opacity: 1;
}

.modal-drag-handle:active {
  cursor: grabbing;
  opacity: 1;
}

.draggable-modal > h3 {
  margin-top: 28px;
}

.large-modal::before {
  height: 6px;
  background: linear-gradient(90deg, #1e4a8a 0%, var(--primary-light) 50%, #1e4a8a 100%);
}

.modal h3 {
  margin-bottom: 20px;
  color: var(--primary);
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
}

.option-label {
  font-weight: 600;
  min-width: 100px;
}

.option-desc {
  color: #666;
  font-size: 13px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.config-section {
  margin-bottom: 20px;
}

.config-section h4 {
  margin-bottom: 12px;
  color: var(--primary);
}

.config-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.qt-name, .dl-name {
  min-width: 80px;
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
}

.btn-primary {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--primary-light);
  color: white;
  cursor: pointer;
}

.btn-edurender {
  padding: 8px 16px;
  border-radius: 8px;
  border: 2px solid #7c3aed;
  background: #f5f3ff;
  color: #7c3aed;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-edurender:hover {
  background: #7c3aed;
  color: white;
}

.btn-small {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #ddd;
  background: white;
  font-size: 12px;
  cursor: pointer;
}

.btn-delete {
  color: var(--danger);
  border-color: var(--danger-light);
}

.btn-save-history {
  color: #16a34a;
  border-color: #bbf7d0;
}

.btn-save-history:hover {
  background: #f0fdf4;
}

.btn-delete-doc {
  color: var(--danger);
  border-color: var(--danger-light);
}

.btn-delete-doc:hover {
  background: #fef2f2;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  font-size: 1rem;
}

.empty-tip {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
}

.form-group input, .form-group select, .form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.preview-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-card);
  border-radius: 8px;
}

.preview-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
}

.preview-content :deep(td),
.preview-content :deep(th) {
  border: 1px solid var(--border-light);
  padding: 6px 10px;
  text-align: left;
  vertical-align: middle;
}

/* 🔧 预览区四线三格防御样式（确保 v-html 渲染时线条可见） */
.preview-content :deep(.four-line-three) {
  display: inline-block;
  position: relative;
  padding: 4px 4px;
  font-family: 'Times New Roman', 'Georgia', SimSun, serif;
  font-size: inherit !important;
  line-height: 1;
  min-width: 18px;
  text-align: center;
  vertical-align: middle;
  overflow: visible;
}
.preview-content :deep(.four-line-three)::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 1.5em;
  background: linear-gradient(#999, #999) 0 0.1em / 100% 1px no-repeat,
              linear-gradient(#999, #999) 0 0.55em / 100% 1px no-repeat,
              linear-gradient(#666, #666) 0 1.0em / 100% 1px no-repeat,
              linear-gradient(#e74c3c, #e74c3c) 0 1.45em / 100% 1px no-repeat;
  pointer-events: none;
}
/* 🔧 预览区横线防御样式 */
.preview-content :deep(.blank-line) {
  display: inline-block;
  min-width: 3em;
  border-bottom: 1.5px solid #666;
  margin: 0 2px;
  vertical-align: baseline;
}

/* 🔧 预览区填空横线 blank-N 防御样式 */
.preview-content :deep(u[class*="blank-"]) {
  display: inline-block;
  text-align: center;
  font-size: inherit !important;
  min-width: 1em;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 1.5px;
}
.preview-content :deep(u.blank-1) { min-width: 1em; }
.preview-content :deep(u.blank-2) { min-width: 2em; }
.preview-content :deep(u.blank-3) { min-width: 3em; }
.preview-content :deep(u.blank-4) { min-width: 4em; }
.preview-content :deep(u.blank-5) { min-width: 5em; }
.preview-content :deep(u.blank-6) { min-width: 6em; }
.preview-content :deep(u.blank-8) { min-width: 8em; }
.preview-content :deep(u.blank-10) { min-width: 10em; }

/* 括号内留空（span 无下划线，仅占位）——与横线 u.blank-N 完全独立计算 */
.preview-content :deep(span[class*="blank-"]) {
  display: inline-block;
  text-align: center;
}
.preview-content :deep(span.blank-1) { min-width: 1em; }
.preview-content :deep(span.blank-2) { min-width: 2em; }
.preview-content :deep(span.blank-3) { min-width: 3em; }
.preview-content :deep(span.blank-4) { min-width: 4em; }
.preview-content :deep(span.blank-5) { min-width: 5em; }
.preview-content :deep(span.blank-6) { min-width: 6em; }
.preview-content :deep(span.blank-8) { min-width: 8em; }
.preview-content :deep(span.blank-10) { min-width: 10em; }

.copy-hint {
  padding: 8px 16px;
  margin-bottom: 8px;
  background: var(--success-light);
  border: 1px solid #a5d6a7;
  border-radius: 6px;
  color: #2e7d32;
  font-size: 13px;
  text-align: center;
}

.editor-textarea {
  width: 100%;
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-family: 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}

.instruction-lib-list {
  max-height: 400px;
  overflow-y: auto;
}

.lib-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--border-light);
}

.lib-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lib-name {
  font-weight: 500;
}

.lib-category {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--primary-lighter);
  border-radius: 12px;
  color: var(--primary-light);
}

.lib-actions {
  display: flex;
  gap: 8px;
}

.empty-tip-small {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  background: var(--bg-card);
  border-radius: 8px;
  margin-bottom: 12px;
}

.confidence-warning {
  margin-top: 6px;
  padding: 6px 10px;
  background: #fef9e7;
  border-radius: 6px;
  font-size: 11px;
  color: #b85c00;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.confidence-warning span {
  background: #fdebd0;
  padding: 2px 8px;
  border-radius: 12px;
  cursor: help;
}

.more-marks {
  background: #f5cba7 !important;
}

.confidence-highlight {
  background: #fef9e7;
  border-bottom: 2px dotted var(--warning);
  cursor: help;
  padding: 0 2px;
}

.summary-book {
  margin-bottom: 10px;
}
.summary-book-name {
  font-weight: 600;
  color: var(--primary);
  font-size: 13px;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.summary-chapter-list {
  padding-left: 12px;
}
.summary-chapter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
  color: #555;
}
.remove-btn {
  cursor: pointer;
  color: #ccc;
  font-size: 14px;
  margin-left: 4px;
  flex-shrink: 0;
  transition: color 0.2s;
}
.remove-btn:hover {
  color: var(--danger);
}
.analysis-checkbox {
  flex-shrink: 0;
  cursor: pointer;
  margin-right: 8px;
}
.analysis-toggle-all {
  cursor: pointer;
  font-size: 16px;
  margin-left: 8px;
}
.analysis-toggle-all:hover {
  color: var(--primary-light);
}
.analyze-one-btn {
  cursor: pointer;
}  
.summary-tpl {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.analysis-status {
  margin-bottom: 16px;
}
.status-title {
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 8px;
}
.status-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--border-light);
}
.summary-ins {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 12px;
  background: var(--bg-card);
  border-radius: 6px;
  margin-bottom: 4px;
  border: 1px solid var(--primary-lighter);
}
.summary-ins .ins-name {
  flex: 1;
  font-weight: 500;
  color: var(--primary);
}

.status-book-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--primary);
  margin-bottom: 4px;
}
.status-chapter-list {
  padding-left: 16px;
  margin-bottom: 4px;
}
.status-chapter {
  font-size: 12px;
  color: #555;
  padding: 2px 0;
  display: flex;
  gap: 12px;
}
.status-summary {
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-muted);
}

.analysis-confirm-section {
  max-height: 450px;
  overflow-y: auto;
  padding-right: 8px;
}
.confirm-item {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
}
.confirm-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  color: var(--primary);
}
.confirm-field {
  margin-bottom: 10px;
}
.confirm-field label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.confirm-field textarea,
.confirm-field input,
.confirm-field select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}
.confirm-field textarea {
  resize: vertical;
}

.analysis-detail {
  padding: 12px;
  background: var(--bg-card);
  border-radius: 8px;
}
.detail-item {
  margin-bottom: 14px;
}
.detail-item strong {
  display: block;
  font-size: 13px;
  color: var(--primary);
  margin-bottom: 4px;
}
.detail-item ul {
  margin: 0;
  padding-left: 20px;
}
.detail-item li {
  font-size: 13px;
  color: #555;
  line-height: 1.8;
}
.empty-text {
  color: #ccc;
  font-size: 13px;
}

/* ✨ 质量报告摘要样式 */
.quality-summary {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.quality-item {
  font-size: 11px;
  padding: 1px 6px;
  background: var(--success-light);
  border-radius: 10px;
  color: #2e7d32;
}

.quality-item.quality-warn {
  background: #fef9e7;
  color: #b85c00;
}

.issues-summary {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.issue-tag {
  font-size: 10px;
  padding: 1px 6px;
  background: #fdebd0;
  border-radius: 10px;
  color: #b85c00;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-tag.issue-error {
  background: var(--danger-light);
  color: #c0392b;
}

.issue-tag.issue-warn {
  background: #fef9e7;
  color: #b85c00;
}

.issue-more {
  font-size: 10px;
  color: var(--text-muted);
}

/* 🔧 新增：变体按钮样式 */
.btn-variant {
  background: #f0f7ff;
  color: var(--primary-light);
  border-color: #b8d4fe;
}

.btn-variant:hover {
  background: #dceeff;
  border-color: var(--primary-light);
}

/* 🔧 新增：快捷填充标签样式 */
.quick-fill-tag {
  font-size: 11px;
  padding: 2px 10px;
  background: var(--primary-lighter);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  color: var(--primary-light);
  transition: all 0.2s;
}
.quick-fill-tag:hover {
  background: var(--primary-light);
  color: white;
  border-color: var(--primary-light);
}

/* 🔧 优化：模板审查布局 */
.template-review-layout {
  max-height: 65vh;
  overflow-y: auto;
  padding-right: 8px;
}

/* 🔧 新增：左右两栏布局 */
.template-two-columns {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.template-left-column {
  flex: 1.2;
  min-width: 0;
}

.template-right-column {
  flex: 0.8;
  min-width: 320px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 14px;
  background: var(--bg-card);
}

.template-raw-textarea {
  width: 100%;
  resize: vertical;
  min-height: 400px;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}

/* 🔧 新增：章节分析左右两栏 */
.chapter-analysis-two-columns {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.chapter-analysis-left {
  flex: 1.2;
  min-width: 0;
  overflow: auto;
  resize: vertical;
  min-height: 200px;
}

.chapter-analysis-right {
  flex: 0.8;
  min-width: 280px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 14px;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 🔧 新增：多栏切割预览样式 */
.column-split-preview {
  width: 100%;
  overflow: auto;
  max-height: 500px;
}

.split-canvas-container {
  position: relative;
  display: inline-block;
  min-width: 100%;
}

.split-origin-image {
  display: block;
  max-width: 100%;
  height: auto;
}

.split-line {
  position: absolute;
  top: 0;
  width: 3px;
  height: 100%;
  background: var(--danger);
  cursor: col-resize;
  z-index: 10;
  transform: translateX(-50%);
}

.split-line:hover {
  width: 5px;
  background: #c0392b;
}

.split-line-handle {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: var(--danger);
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  pointer-events: none;
}

.split-line-x {
  display: block;
  font-size: 10px;
  opacity: 0.8;
}

.split-line-delete {
  position: absolute;
  bottom: -28px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border: 2px solid var(--danger);
  color: var(--danger);
  border-radius: 50%;
  width: 26px;
  height: 26px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  transition: all 0.15s;
}

.split-line-delete:hover {
  background: var(--danger);
  color: white;
  transform: translateX(-50%) scale(1.15);
}

.split-col-preview {
  position: absolute;
  top: 0;
  border: 2px dashed var(--primary-light);
  background: rgba(43, 94, 167, 0.05);
  pointer-events: none;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-label {
  background: rgba(43, 94, 167, 0.8);
  color: white;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.add-split-line-btn {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 16px;
  background: var(--primary-light);
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  z-index: 20;
}

.add-split-line-btn:hover {
  background: #1e4a8a;
}

/* 🔧 优化：多栏切割弹窗布局 */
.column-split-modal {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.column-split-modal .modal-actions {
  border-top: 1px solid var(--border-light);
  padding-top: 12px;
}

/* 🔧 优化：分析结果确认弹窗布局 */
.analysis-result-modal {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.analysis-result-modal h3 {
  margin: 8px 0 4px 0;
  font-size: 16px;
}

.analysis-result-modal .modal-drag-handle {
  margin-bottom: 4px;
}

/*  加点字样式 - 在字下方显示点(·) */
.emphasis-dot {
  position: relative;
  display: inline-block;
  font-weight: bold;
  color: #d32f2f;
}

.emphasis-dot::after {
  content: '·';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #d32f2f;
  line-height: 1;
}

/* ⭐ 画线句子样式 - 整句下方显示连续直线 */
.underline-sentence {
  text-decoration: underline;
  text-decoration-style: solid;
  text-underline-offset: 3px;
  text-decoration-thickness: 1.5px;
}

/* ⭐ 上标样式 - 数学/物理/化学必备 */
.superscript {
  vertical-align: super;
  font-size: smaller;
  line-height: 0;
}

/* ⭐ 下标样式 - 数学/物理/化学必备 */
.subscript {
  vertical-align: sub;
  font-size: smaller;
  line-height: 0;
}

/* ⭐ 拼音标注样式 - 小学语文必备 */
/* ⭐ 拼音标注 - 小学语文（使用拼音体） */
ruby {
  ruby-position: over;
  ruby-align: center;
}

rt {
  font-size: 0.6em;
  text-align: center;
  color: #666;
  margin-bottom: -2px;
  font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif;
}

/* ===== 新增强大排版样式 ===== */

.wavy-underline {
  text-decoration: underline;
  text-decoration-style: wavy;
  text-decoration-color: #d32f2f;
  text-underline-offset: 3px;
}
.double-line {
  text-decoration: underline;
  text-decoration-style: double;
  text-underline-offset: 3px;
}
.single-line {
  text-decoration: underline;
  text-decoration-style: solid;
  text-underline-offset: 3px;
}
ruby.radical rb { font-size: 1em; }
ruby.radical rt { font-size: 0.5em; color: var(--primary-light); }
.stroke-order {
  display: inline-flex;
  align-items: flex-start;
  gap: 1px;
  vertical-align: baseline;
}
.stroke-order::after {
  content: attr(data-strokes) '画';
  font-size: 0.55em;
  vertical-align: super;
  color: var(--text-muted);
  line-height: 1;
  margin-left: 1px;
}
.tian-zi-ge, .mi-zi-ge {
  display: inline-block;
  position: relative;
  width: 1.8em;
  height: 1.8em;
  border: 1.5px solid #5B9BD5;
  font-size: inherit !important;
  vertical-align: middle;
  margin: 0 1px;
  box-sizing: border-box;
  background:
    repeating-linear-gradient(to right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/100% 0.5px no-repeat,
    repeating-linear-gradient(to bottom,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat;
}
.tian-zi-ge > span, .mi-zi-ge > span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  line-height: 1;
  white-space: nowrap;
}
.mi-zi-ge {
  background:
    repeating-linear-gradient(to right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/100% 0.5px no-repeat,
    repeating-linear-gradient(to bottom,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat,
    repeating-linear-gradient(to top right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat,
    repeating-linear-gradient(to bottom right,#5B9BD5 0px,#5B9BD5 3px,transparent 3px,transparent 6px) center/0.5px 100% no-repeat;
}
.four-line-three {
  display: inline-block;
  position: relative;
  padding: 4px 4px;
  font-family: 'Times New Roman', 'Georgia', SimSun, serif;
  font-size: 16px;
  line-height: 1;
  min-width: 18px;
  text-align: center;
  vertical-align: middle;
  overflow: visible;
}
.four-line-three::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 1.5em;
  background:
    linear-gradient(#999, #999) 0 0.1em / 100% 1px no-repeat,
    linear-gradient(#999, #999) 0 0.55em / 100% 1px no-repeat,
    linear-gradient(#666, #666) 0 1.0em / 100% 1px no-repeat,
    linear-gradient(#999, #999) 0 1.45em / 100% 1px no-repeat;
  pointer-events: none;
}
/* ⭐ 拼音格 - Times New Roman（拼音体专用） */
.pinyin-line {
  font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif;
}
/* ⭐ 英语书写格 - Times New Roman 印刷体（英语字母专用） */
.english-line {
  font-family: 'Times New Roman', 'Georgia', serif;
}
.zuo-wen-ge {
  display: grid;
  grid-template-columns: repeat(20, 1.3em);
  gap: 0;
  border: 1.5px solid var(--text-muted);
  margin: 8px 0;
  width: fit-content;
}
.zuo-wen-ge span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3em;
  height: 1.3em;
  border: 0.5px solid #ccc;
  font-family: 'SimSun', 'KaiTi', serif;
  font-size: 0.9em;
  line-height: 1.3em;
  text-align: center;
}
.oral-box {
  display: inline-block;
  border: 1.5px solid #333;
  padding: 2px 8px;
  margin: 0 2px;
  min-width: 40px;
  text-align: center;
  vertical-align: middle;
}
.oral-box.blank {
  min-width: 50px;
  border-style: dashed;
  color: var(--text-muted);
}
.vertical-calculation {
  display: inline-block;
  margin: 8px 16px;
  font-family: 'Courier New', monospace;
}
.vertical-calculation .vc-row { text-align: right; padding: 1px 8px; letter-spacing: 0.2em; }
.vertical-calculation .vc-row.op {
  border-bottom: 1.5px solid #333;
  padding-bottom: 2px;
}
.vertical-calculation .vc-result {
  text-align: right;
  padding: 2px 8px;
  letter-spacing: 0.2em;
  font-weight: bold;
}
.off-formula { margin: 8px 0; }
.off-formula .of-line { text-indent: 1.5em; line-height: 1.8; }
.match-question {
  display: flex;
  gap: 40px;
  margin: 12px 0;
}
.match-question .match-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.match-question .match-item {
  padding: 4px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 80px;
  text-align: center;
}
.word-bank {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border: 1.5px solid #666;
  border-radius: 4px;
  margin: 4px 0;
  background: #fafafa;
}
.word-bank .wb-item {
  display: inline-block;
  padding: 2px 10px;
  font-family: 'Times New Roman', serif;
  font-size: 0.9em;
  color: #333;
}
.chem-condition {
  font-size: 0.7em;
  vertical-align: super;
  color: #555;
  line-height: 1;
}
.seal-line {
  writing-mode: vertical-lr;
  text-orientation: upright;
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2em;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1.5px dashed var(--text-muted);
  border-right: 1.5px dashed var(--text-muted);
  background: #f9f9f9;
  color: var(--text-muted);
  font-size: 10px;
  letter-spacing: 0.5em;
  z-index: 1;
}
/* 评分栏 - 表格形式（横竖线全有） */
.score-board {
  display: inline-table;
  border-collapse: collapse;
  margin: 4px 0;
}
.score-board .sb-row {
  display: table-row;
}
.score-board .sb-label, .score-board .sb-value {
  display: table-cell;
  padding: 4px 16px;
  border: 1px solid var(--text-muted);
  text-align: center;
}
.score-board .sb-label {
  font-size: 0.9em;
  color: #555;
  background: #f9f9f9;
}
.score-board .sb-value {
  font-weight: bold;
}

/* 方框填空 */
.square-box {
  display: inline-block;
  border: 2px solid #333;
  min-width: 1.6em;
  height: 1.6em;
  text-align: center;
  line-height: 1.6em;
  vertical-align: middle;
  margin: 0 1px;
  padding: 0 2px;
  font-weight: bold;
  color: #333;
}

/* 得分框 */
.score-box {
  display: inline-block;
  border: 1.5px solid #333;
  padding: 3px 16px;
  text-align: center;
  min-width: 60px;
  font-weight: bold;
  font-size: 0.95em;
}
.dashed-line {
  display: inline-block;
  border-bottom: 1.5px dashed var(--text-muted);
  min-width: 40px;
  margin: 0 2px;
}
table.periodic-table {
  border-collapse: collapse;
  margin: 8px auto;
  font-size: 0.75em;
}
table.periodic-table td, table.periodic-table th {
  border: 1px solid #333;
  padding: 2px 4px;
  text-align: center;
  min-width: 2.5em;
}
table.periodic-table .nonmetal { background: #c8e6c9; }
table.periodic-table .metal { background: #ffcdd2; }
table.periodic-table .transition { background: #ffe0b2; }
table.periodic-table .noble-gas { background: #b3e5fc; }
table.periodic-table .lanthanide { background: #f8bbd0; }
table.periodic-table .actinide { background: #e1bee7; }

/* 📖 章节选择弹窗 */
.chapter-select-btn {
  display: block;
  width: 100%;
  padding: 12px;
  background: var(--bg);
  border: 2px dashed var(--border-light);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
  cursor: pointer;
  margin-bottom: 8px;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.2s;
}
.chapter-select-btn:active {
  background: #eef2ff;
  border-color: var(--primary);
}

.chapter-selector-mask {
  z-index: 2000;
}
.chapter-selector-modal {
  background: white;
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  margin: auto auto 0 auto;
  overflow: hidden;
}
.cs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.cs-header h3 { margin: 0; font-size: 16px; }
.cs-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  -webkit-overflow-scrolling: touch;
}
.cs-book {
  margin-bottom: 8px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  overflow: hidden;
}
.cs-book-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--bg);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  font-size: 14px;
  font-weight: 600;
}
.cs-expand-icon { font-size: 10px; color: var(--text-muted); flex-shrink: 0; }
.cs-book-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-book-badge {
  font-size: 11px;
  background: #eef2ff;
  color: var(--primary);
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}
.cs-chapter-tree {
  padding: 4px 0;
  border-top: 1px solid var(--border-light);
}
.cs-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-height: 36px;
}
.cs-node-row:active { background: #f0f0f0; }
.cs-node-expand, .cs-node-placeholder {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-muted);
}
.cs-node-row input[type="checkbox"] {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}
.cs-node-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-node-pages {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.cs-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}
.cs-footer .btn-primary {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  border-radius: 12px;
}

/* 双图标：桌面端/移动端 */
.icon-mobile { display: none; }

/* 📱 移动端适配 */
@media (max-width: 767px) {
  /* 弹窗安全区适配 */
  .modal-mask {
    padding: env(safe-area-inset-top, 12px) 12px env(safe-area-inset-bottom, 12px) 12px;
    box-sizing: border-box;
  }
  /* 双图标切换 */
  .icon-mobile { display: inline; }
  .icon-desktop { display: none; }
  /* 丢弃按钮在移动端隐藏，按钮组靠右 */
  .hide-on-mobile { display: none !important; }
  .analysis-footer {
    flex-direction: column !important;
    gap: 0 !important;
  }
  .analysis-footer .modal-actions {
    width: 100% !important;
  }

  .ribbon-btn-refresh, .ribbon-btn-sync {
    font-size: 16px !important;
    padding: 6px 10px !important;
    min-width: 36px;
  }
  .generate-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Config ribbon: compact scroll */
  .config-ribbon {
    flex-shrink: 0;
    flex-wrap: nowrap !important;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    gap: 3px !important;
    padding: 4px 6px !important;
    scrollbar-width: none;
  }
  .config-ribbon::-webkit-scrollbar { display: none; }
  .config-ribbon .ribbon-btn {
    font-size: 10px !important;
    padding: 4px 8px !important;
    min-height: 28px !important;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .ribbon-left { flex-wrap: nowrap !important; gap: 3px !important; }
  .ribbon-right { display: none; } /* 模型信息在手机上隐藏 */

  /* 📱 移动端模型状态芯片 */
  .mobile-model-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 4px 8px;
    border-radius: 16px;
    background: #f0f4ff;
    border: 1px solid #c5d5f7;
    font-size: 10px;
    font-weight: 600;
    color: #4a6cf7;
    white-space: nowrap;
    flex-shrink: 0;
    cursor: default;
  }
  .mobile-model-chip .chip-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .mobile-model-chip .chip-dot.dot-ollama { background: #4a9e5c; }
  .mobile-model-chip .chip-dot.dot-cloud { background: #4a6cf7; }
  .mobile-model-chip .chip-dot.dot-ready { background: #22c55e; }
  .mobile-model-chip .chip-dot.dot-checking { background: #f59e0b; animation: pulse-dot 1.2s ease-in-out infinite; }
  .mobile-model-chip .chip-dot.dot-error { background: #ef4444; }
  .mobile-chip-error { background: #fef2f2 !important; border-color: #fecaca !important; color: #ef4444 !important; }
  .mobile-chip-checking { background: #fffbeb !important; border-color: #fde68a !important; color: #f59e0b !important; }

  /* Mobile tab bar */
  .mobile-gen-tabs {
    display: flex;
    flex-shrink: 0;
    background: white;
    border-bottom: 1px solid var(--border-light);
  }
  .gen-tab {
    flex: 1;
    text-align: center;
    padding: 8px 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
    position: relative;
  }
  .gen-tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
    background: var(--primary-bg);
  }
  /* 不同 Tab 微差底色区隔 */
  .gen-tab:nth-child(1):not(.active) { color: #4a90d9; }
  .gen-tab:nth-child(1).active { color: #4a90d9; border-bottom-color: #4a90d9; }
  .gen-tab:nth-child(2):not(.active) { color: #b7950b; }
  .gen-tab:nth-child(2).active { color: #b7950b; border-bottom-color: #b7950b; }
  .gen-tab:nth-child(3):not(.active) { color: #16a34a; }
  .gen-tab:nth-child(3).active { color: #16a34a; border-bottom-color: #16a34a; }
  .gen-tab-badge {
    display: inline-block;
    margin-left: 4px;
    background: var(--primary);
    color: white;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 10px;
    vertical-align: middle;
  }
  .gen-tab.active .gen-tab-badge { background: var(--primary); }
  .gen-tab:not(.active) .gen-tab-badge { background: #ccc; }

  /* Mobile workspace: single column, fill remaining space */
  .mobile-workspace {
    flex: 1;
    flex-direction: column !important;
    overflow: hidden;
  }

  /* 三个面板共用：flex column，各自内部独立滚动 */
  .mobile-workspace .selection-panel,
  .mobile-workspace .instruction-panel,
  .mobile-workspace .result-panel {
    width: 100% !important;
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 6px 8px !important;
    max-height: none !important;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* ── 指令面板：固定头部，文本框独立滚动 ── */
  .mobile-workspace .instruction-panel {
    overflow: hidden;
  }
  .mobile-workspace .instruction-panel .panel-header {
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-light);
    margin-bottom: 4px;
  }
  .mobile-workspace .instruction-panel .panel-header h3 {
    font-size: 13px;
    width: 100%;
    margin: 0 0 2px 0;
  }
  .mobile-workspace .instruction-panel .header-actions {
    flex-wrap: wrap;
    gap: 3px;
  }
  .mobile-workspace .instruction-panel .header-actions .btn-primary,
  .mobile-workspace .instruction-panel .header-actions .btn {
    font-size: 11px;
    padding: 4px 8px;
    min-height: 28px;
  }
  .mobile-workspace .instruction-panel .instruction-textarea {
    flex: 1;
    min-height: 0;
  }
  .mobile-workspace .instruction-panel .preview-hint,
  .mobile-workspace .instruction-panel .analysis-result {
    flex-shrink: 0;
  }

  /* ── 结果面板：固定头顶/底栏，列表独立滚动 ── */
  .mobile-workspace .result-panel {
    overflow: hidden;
  }
  .mobile-workspace .result-panel .generating-tip {
    flex-shrink: 0;
  }
  .mobile-workspace .result-panel .period-tabs {
    flex-shrink: 0;
  }
  .mobile-workspace .result-panel .result-header {
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: white;
    z-index: 5;
  }
  .mobile-workspace .result-panel .result-list {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    min-height: 0;
    max-height: none;
    padding-bottom: 55px; /* 为底部 fab 栏留空间 */
  }

  /* 指令面板 textarea 底部留空间 */
  .mobile-workspace .instruction-panel .instruction-textarea {
    flex: 1;
    min-height: 0;
    padding-bottom: 55px;
  }

  /* 已选面板底部留空间 */
  .mobile-workspace .selection-panel {
    padding-bottom: 55px !important;
  }

  /* Selection panel: compact */
  .selection-panel .panel-section {
    margin-bottom: 6px;
  }
  .selection-panel .section-header {
    padding: 6px 8px;
    font-size: 12px;
  }
  .summary-book { padding: 4px 0; }
  .summary-book-name { font-size: 11px; }
  .summary-chapter {
    padding: 3px 6px;
    font-size: 11px;
  }
  .summary-chapter-list { max-height: none; }
  .chapter-select-btn {
    font-size: 12px;
    padding: 8px;
  }
  .analysis-checkbox {
    width: 16px;
    height: 16px;
    margin-right: 8px;
  }
  .chapter-title { font-size: 11px; }

  /* Instruction panel: compact (header already handled above) */
  .instruction-textarea {
    font-size: 14px;
    min-height: 120px;
    padding: 8px;
  }
  .analyze-model-hint { display: none; }

  /* Result panel: compact list */
  .result-header {
    padding: 6px 8px;
    font-size: 12px;
  }
  .result-item {
    padding: 8px 8px;
    margin-bottom: 6px;
    border-radius: 8px;
  }
  .result-row {
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
  }
  .result-row input[type="checkbox"] {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .result-title {
    font-size: 13px;
    max-width: 100%;
  }
  .result-meta {
    font-size: 10px;
    flex-wrap: wrap;
  }
  .result-actions {
    display: none !important;
  }
  .result-actions-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
  }
  .result-actions-col .btn-small {
    font-size: 10px;
    padding: 3px 8px;
    min-height: 22px;
    border-radius: 5px;
    white-space: nowrap;
  }
  .result-actions-col .btn-save-history {
    color: #16a34a;
    border-color: #bbf7d0;
    background: #f0fdf4;
  }
  .result-actions-col .btn-delete-doc {
    color: #ef4444;
    border-color: #fecaca;
    background: #fef2f2;
  }
  .quality-marks span {
    font-size: 15px;
    padding: 1px 3px;
  }
  .result-list {
    max-height: none;
  }
  .period-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .period-tab {
    font-size: 10px;
    padding: 5px 8px;
    white-space: nowrap;
  }

  /* Fixed bottom action bar */
  .mobile-gen-fab {
    position: fixed;
    /* 与导航栏高度公式一致：内容 56px + 设备底部安全区 */
    bottom: calc(56px + env(safe-area-inset-bottom, 0px));
    left: 0;
    right: 0;
    display: flex;
    gap: 6px;
    padding: 5px 10px 0 10px;
    background: white;
    z-index: 100;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  }
  .fab-btn {
    flex: 1;
    padding: 6px 4px;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: all 0.15s;
    min-height: 32px;
    white-space: nowrap;
  }
  .fab-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .fab-primary {
    background: var(--success, #22c55e);
    color: white;
  }
  .fab-primary:active { filter: brightness(0.9); }
  .fab-secondary {
    background: var(--primary);
    color: white;
  }
  .fab-secondary:active { filter: brightness(0.9); }
  .fab-cancel {
    background: #f1f5f9;
    color: var(--text-secondary);
  }
  .fab-cancel:active { background: #e2e8f0; }

  /* Empty tip */
  .empty-tip-small {
    padding: 12px 8px !important;
    font-size: 12px;
  }

  /* Generating progress */
  .generating-tip {
    padding: 6px;
    font-size: 12px;
  }
  .progress-bar {
    height: 5px;
  }

  /* Preview / 详细配置 / 分析确认 / 编辑 弹窗移动端 */
  .modal.large-modal {
    min-width: 0 !important;
    width: 96vw !important;
    max-width: 96vw !important;
    max-height: calc(100% - 16px) !important;
    border-radius: 12px !important;
    padding: 16px 12px !important;
    display: flex !important;
    flex-direction: column !important;
    overflow-y: auto !important;
    margin: auto !important;
  }
  .modal.large-modal::before {
    border-radius: 10px 10px 0 0 !important;
  }
  .modal.large-modal h3 {
    font-size: 15px !important;
    margin-bottom: 10px !important;
    padding-bottom: 10px !important;
    flex-shrink: 0 !important;
  }
  /* 弹窗内容滚动区域 */
  .modal-scroll-area {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding-right: 4px;
  }
  /* 覆盖内联 style（防御层） */
  .modal.large-modal[style] {
    max-width: 96vw !important;
    width: 96vw !important;
    max-height: calc(100% - 16px) !important;
  }
  .preview-content {
    max-height: 55vh;
    font-size: 12px;
    padding: 8px;
  }
  .copy-hint {
    font-size: 11px !important;
    padding: 6px 8px !important;
  }
  .editor-textarea {
    font-size: 12px !important;
    max-height: 55vh !important;
    padding: 8px !important;
    flex: 1;
    min-height: 0;
  }
  /* 大弹窗内按钮适配 */
  .modal.large-modal .modal-actions {
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 6px !important;
    margin-top: 10px !important;
  }
  .modal.large-modal .modal-actions .btn,
  .modal.large-modal .modal-actions .btn-primary,
  .modal.large-modal .modal-actions .btn-edurender {
    flex: 1;
    font-size: 12px;
    padding: 8px 4px;
    text-align: center;
    min-height: 36px;
    min-width: 0;
  }

  /* === 章节分析弹窗移动端适配 === */
  .modal.draggable-modal {
    min-width: 0 !important;
    width: 96% !important;
    max-width: 100vw !important;
    padding: 12px 10px !important;
    border-radius: 12px !important;
    max-height: calc(100% - 16px) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow-y: hidden !important;
    /* 🔧 修复：移动端覆盖 fixed 定位，回归 flex 居中 */
    position: relative !important;
    top: auto !important;
    left: auto !important;
    transform: none !important;
    /* 确保上下留白 */
    margin: auto !important;
  }
  /* 覆盖内联 style（防御层） */
  .modal.draggable-modal[style] {
    max-height: calc(100% - 16px) !important;
  }
  .modal.draggable-modal h3 {
    font-size: 14px;
    margin-bottom: 8px;
    flex-shrink: 0 !important;
  }
  .modal.draggable-modal .modal-drag-handle {
    display: none !important;
  }
  .modal.draggable-modal .analysis-footer {
    padding: 0 !important;
    margin-top: 10px !important;
  }
  /* 移动端隐藏保存按钮，仅保留取消/关闭 */
  .modal.draggable-modal .analysis-footer .modal-actions .btn-primary {
    display: none !important;
  }
  .modal.draggable-modal .analysis-footer .modal-actions .btn {
    flex: 1;
    font-size: 14px;
    padding: 10px 0;
    text-align: center;
    min-height: 40px;
    border-radius: 10px;
    background: var(--primary);
    color: white;
    border: none;
  }
  .modal.draggable-modal .analysis-footer .hide-on-mobile {
    display: none !important;
  }
  .chapter-analysis-two-columns {
    flex-direction: column !important;
    gap: 10px !important;
  }
  .chapter-analysis-left {
    flex: none !important;
    width: 100% !important;
  }
  .chapter-analysis-left textarea,
  .chapter-analysis-left .rich-text-editor {
    font-size: 11px !important;
  }
  /* 覆盖编辑器内部内容区字号 */
  .chapter-analysis-left :deep(.ProseMirror) {
    font-size: 11px !important;
  }
  /* 移动端隐藏原文编辑器的工具栏（:deep 穿透子组件） */
  .chapter-analysis-left :deep(.editor-toolbar-wrapper) {
    display: none !important;
  }
  .chapter-analysis-right {
    flex: none !important;
    width: 100% !important;
    min-width: 0 !important;
    max-height: none !important;
    padding: 10px !important;
    gap: 8px !important;
  }
  .chapter-analysis-right .detail-item strong {
    font-size: 12px;
  }
  .chapter-analysis-right .detail-item input,
  .chapter-analysis-right .detail-item textarea {
    font-size: 13px !important;
    padding: 8px 10px !important;
  }
  .modal-actions {
    flex-shrink: 0 !important;
    flex-direction: row;
    gap: 8px !important;
    margin-top: 14px !important;
  }
  .modal-actions .btn,
  .modal-actions .btn-primary {
    flex: 1;
    font-size: 14px;
    padding: 10px 0;
    text-align: center;
    min-height: 40px;
  }

  /* === 分析结果确认弹窗移动端适配 === */
  .analysis-result-modal {
    max-height: calc(100% - 16px) !important;
  }
  .template-two-columns {
    flex-direction: column !important;
    gap: 10px !important;
  }
  .template-left-column {
    flex: none !important;
    width: 100% !important;
  }
  .template-left-column textarea,
  .template-left-column .rich-text-editor {
    font-size: 11px !important;
  }
  /* 覆盖编辑器内部内容区字号 */
  .template-left-column :deep(.ProseMirror) {
    font-size: 11px !important;
  }
  /* 移动端隐藏分析结果弹窗原文编辑器的工具栏（:deep 穿透子组件） */
  .template-left-column :deep(.editor-toolbar-wrapper) {
    display: none !important;
  }
  .template-right-column {
    flex: none !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  /* === 通用弹窗移动端适配（范围/风格/类型/专项/粒度/详细配置/编辑/指令库/分析确认/输入/确认/提示） === */
  .modal:not(.large-modal):not(.draggable-modal) {
    min-width: 0 !important;
    width: 90vw !important;
    max-width: 90vw !important;
    padding: 16px 14px !important;
    border-radius: 12px !important;
    max-height: calc(100% - 16px) !important;
  }
  .modal:not(.large-modal):not(.draggable-modal)::before {
    border-radius: 10px 10px 0 0 !important;
  }
  .modal:not(.large-modal):not(.draggable-modal) h3 {
    font-size: 15px !important;
    margin-bottom: 10px !important;
    padding-bottom: 10px !important;
  }
  /* 选项列表字体 */
  .option-list .option-item {
    padding: 8px 10px !important;
    font-size: 13px !important;
  }
  .option-list .option-label {
    font-size: 13px !important;
  }
  .option-list .option-desc {
    font-size: 11px !important;
  }
  /* 详细配置弹窗 - 移动端行内紧凑布局 */
  .config-section h4 {
    font-size: 13px !important;
  }
  .config-section input[type="number"] {
    font-size: 13px !important;
    padding: 7px 6px !important;
  }
  .config-row {
    font-size: 12px !important;
    gap: 3px !important;
    flex-wrap: wrap;
    align-items: center;
    padding: 4px 0;
  }
  .config-row .qt-name,
  .config-row .dl-name {
    font-size: 12px !important;
    min-width: 40px;
    flex-shrink: 0;
  }
  .config-row input[type="number"] {
    width: 52px !important;
    padding: 5px 4px !important;
    font-size: 12px !important;
  }
  .config-section .hint {
    font-size: 11px !important;
  }
  .config-section .btn-small {
    font-size: 11px !important;
    padding: 4px 8px !important;
  }
  /* 分析确认弹窗内文字缩小 */
  .chapter-analysis-left strong {
    font-size: 13px !important;
  }
  .chapter-analysis-left > div > div {
    padding: 8px !important;
  }
  .chapter-analysis-left [style*="font-size:13px"] {
    font-size: 12px !important;
  }
  .chapter-analysis-left [style*="font-size:11px"] {
    font-size: 10px !important;
  }
  /* 分析确认弹窗右栏 */
  .chapter-analysis-right label {
    font-size: 12px !important;
    flex-wrap: wrap;
  }
  .chapter-analysis-right label span {
    font-size: 11px !important;
  }
  .chapter-analysis-right [style*="font-size:13px"] {
    font-size: 12px !important;
  }
  .chapter-analysis-right [style*="font-size:12px"] {
    font-size: 11px !important;
  }
  /* 分析确认弹窗按钮 */
  .chapter-analysis-right .modal-actions[style] {
    gap: 8px !important;
  }
  .chapter-analysis-right .modal-actions .btn,
  .chapter-analysis-right .modal-actions .btn-primary {
    padding: 10px 6px !important;
    font-size: 13px !important;
  }
  /* 编辑弹窗 textarea */
  .editor-textarea {
    font-size: 13px !important;
    min-height: 40vh !important;
  }
  /* 指令库弹窗列表 */
  .instruction-lib-list .lib-item {
    font-size: 12px !important;
    padding: 8px !important;
  }
  .instruction-lib-list .lib-name {
    font-size: 13px !important;
  }
  .lib-actions .btn-small {
    font-size: 11px !important;
    padding: 4px 8px !important;
  }
  /* 分析确认弹窗 */
  .modal p.hint {
    font-size: 11px !important;
  }

  /* 章节选择弹窗 */
  .chapter-selector-modal {
    width: 92vw !important;
    max-width: 92vw !important;
    max-height: calc(100% - 16px) !important;
    border-radius: 12px !important;
    padding: 0 !important;
  }
  .cs-header h3 {
    font-size: 15px !important;
  }
  .cs-body {
    font-size: 13px !important;
    padding: 10px !important;
  }
  .cs-book-name {
    font-size: 13px !important;
  }
  .cs-footer .btn-primary {
    font-size: 14px !important;
    padding: 10px !important;
  }
}
</style>