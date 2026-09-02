<template>
  <div class="generate-module">
    <!-- 顶部配置栏 -->
    <div class="config-ribbon">
      <div class="ribbon-left">
        <button
          class="ribbon-btn"
          @click="showScopeModal = true"
        >
          📐 {{ scopeTypeLabel }}
        </button>
        <button
          class="ribbon-btn"
          @click="showStyleModal = true"
        >
          🎨 {{ styleLabel }}
        </button>
        <button
          class="ribbon-btn"
          @click="showGenTypeModal = true"
        >
          📂 {{ genTypeLabel }}
        </button>
        <button
          class="ribbon-btn"
          :title="'名称样式：决定生成资料标题中的名称（当前：' + labelStyleLabel + '）'"
          @click="showLabelStyleModal = true"
        >
          ✏️ {{ labelStyleLabel }}
        </button>
        <button
          v-if="showSpecialSubType"
          class="ribbon-btn ribbon-btn-special"
          @click="showSpecialSubTypeModal = true"
        >
          🎯 {{ specialSubTypeLabel || '选择专项领域' }}
        </button>
        <button
          class="ribbon-btn"
          @click="showGranularityModal = true"
        >
          📏 {{ granularityLabel }}
        </button>
        <button
          class="ribbon-btn"
          @click="showDetailConfigModal = true"
        >
          📝 详细配置
        </button>
        <!-- 🖥️ 桌面端专用：同步/上推/重置（手机端走 AppHeader 全局按钮） -->
        <template v-if="!isMobile">
          <button
            class="ribbon-btn ribbon-btn-sync"
            title="同步：拉双向2类→合并→推回"
            @click="syncPage"
          >
            ☁️
          </button>
          <button
            class="ribbon-btn ribbon-btn-upload"
            title="上推：全量推送至云端"
            @click="uploadPage"
          >
            📤
          </button>
          <button
            class="ribbon-btn ribbon-btn-refresh"
            title="重置任务"
            @click="refreshPage"
          >
            🔄
          </button>
        </template>
        <!-- 📱 移动端模型状态 -->
        <span
          v-if="isMobile"
          class="mobile-model-chip"
          :class="{ 'mobile-chip-error': deepseekStatus === 'error', 'mobile-chip-checking': deepseekStatus === 'checking' }"
          :title="deepseekStatus === 'error' ? '⚠️ ' + deepseekStatusMsg : (apiConfig.currentEngine === 'deepseek' ? `✅ 已就绪 | 生成:${currentModelSummary.heavy} / 分析:${currentModelSummary.light}` : currentModelSummary.heavy)"
        >
          <span
            class="chip-dot"
            :class="apiConfig.currentEngine === 'deepseek' ? (deepseekStatus === 'ready' ? 'dot-ready' : deepseekStatus === 'checking' ? 'dot-checking' : 'dot-error') : 'dot-ollama'"
          />
          {{ deepseekStatus === 'checking' ? '检测中...' : deepseekStatus === 'error' ? '⚠️ 未就绪' : (apiConfig.currentEngine === 'deepseek' ? currentModelSummary.heavy.split('-').pop() + '+' + currentModelSummary.light.split('-').pop() : currentModelSummary.heavy) }}
        </span>
      </div>
      <div class="ribbon-right">
        <div
          v-if="genTypeModelHint"
          class="model-recommend-badge"
        >
          <span class="badge-icon">{{ genTypeModelHint.icon }}</span>
          <span class="badge-model">{{ genTypeModelHint.model }}</span>
          <span class="badge-tip">{{ genTypeModelHint.tip }}</span>
        </div>
        <div
          class="model-config-chip"
          :title="deepseekStatus === 'error' ? '⚠️ ' + deepseekStatusMsg : (currentModelSummary.review ? `重型:${currentModelSummary.heavy}\n轻量:${currentModelSummary.light}\n分析:${currentModelSummary.analysis}\n审查:${currentModelSummary.review}` : apiConfig.currentEngine === 'deepseek' ? `生成:${currentModelSummary.heavy}\n分析:${currentModelSummary.light}` : `重型:${currentModelSummary.heavy}\n轻量:${currentModelSummary.light}\n分析:${currentModelSummary.analysis}`)"
        >
          <span
            class="chip-dot"
            :class="apiConfig.currentEngine === 'deepseek' ? (deepseekStatus === 'ready' ? 'dot-ready' : deepseekStatus === 'checking' ? 'dot-checking' : 'dot-error') : 'dot-ollama'"
          />
          <span class="chip-label">{{ currentModelSummary.engine === '🦙 Ollama' ? '本地' : '云端' }}</span>
          <span class="chip-sep">·</span>
          <span class="chip-model">{{ apiConfig.currentEngine === 'deepseek' ? currentModelSummary.heavy + ' + ' + currentModelSummary.light : currentModelSummary.heavy }}</span>
          <span
            v-if="deepseekStatus === 'error'"
            class="chip-status-err"
            :title="deepseekStatusMsg"
          >⚠️</span>
        </div>
      </div>
    </div>

    <!-- 📱 移动端 Tab 切换栏 -->
    <div
      v-if="isMobile"
      class="mobile-gen-tabs"
    >
      <div
        class="gen-tab"
        :class="{ active: mobileGenTab === 'select' }"
        @click="mobileGenTab = 'select'"
      >
        📋 已选<span
          v-if="selectedTextbookCount"
          class="gen-tab-badge"
        >{{ selectedTextbookCount }}</span>
      </div>
      <div
        class="gen-tab"
        :class="{ active: mobileGenTab === 'instruct' }"
        @click="mobileGenTab = 'instruct'"
      >
        📝 方案
      </div>
      <div
        class="gen-tab"
        :class="{ active: mobileGenTab === 'result' }"
        @click="mobileGenTab = 'result'"
      >
        📄 结果<span
          v-if="displayedDocs.length"
          class="gen-tab-badge"
        >{{ displayedDocs.length }}</span>
      </div>
    </div>

    <!-- 主工作区 -->
    <div
      class="main-workspace"
      :class="{ 'mobile-workspace': isMobile }"
    >
      <!-- 左侧：已选摘要面板 -->
      <div
        v-show="!isMobile || mobileGenTab === 'select'"
        class="selection-panel"
      >
        <!-- 已选教材 -->
        <div class="panel-section">
          <div
            class="section-header"
            @click="toggleSection('textbook')"
          >
            <span>{{ sectionCollapsed.textbook ? '▶' : '▼' }}</span>
            <span>📚 已选教材章节</span>
            <span class="selected-count">{{ selectedTextbookCount }}</span>
            <span
              class="analysis-toggle-all"
              title="切换全选/取消分析勾选"
              @click.stop="toggleAllForAnalysis('textbook')"
            >{{ allTextbookSelectedForAnalysis ? '☑' : '☐' }}</span>
          </div>
          <div
            v-show="!sectionCollapsed.textbook"
            class="section-content"
          >
            <div
              v-if="selectedTextbookCount === 0"
              class="empty-tip-small"
            >
              <span>请先在教材库中勾选章节</span>
            </div>
            <template
              v-for="(book, index) in textbookStore.textbooks"
              :key="book?.id || index"
            >
              <div
                v-if="book && book.outline && hasAnySelected(book.outline)"
                class="summary-book"
              >
                <div class="summary-book-name">
                  {{ book.name }}
                  <span
                    class="remove-btn"
                    title="取消该书所有勾选"
                    @click="removeSelectedBook(book)"
                  >✕</span>
                </div>
                <div class="summary-chapter-list">
                  <div
                    v-for="chapter in getSelectedChapters(book.outline)"
                    :key="chapter.title"
                    class="summary-chapter"
                  >
                    <input
                      v-model="chapter._selectedForAnalysis"
                      type="checkbox"
                      :checked="chapter._selectedForAnalysis !== false"
                      class="analysis-checkbox"
                      title="勾选要分析的章节"
                    >
                    <span
                      class="chapter-title"
                      :style="{ cursor: isLeafChapter(chapter) ? 'pointer' : 'default', textDecoration: isLeafChapter(chapter) ? 'underline' : 'none', color: isLeafChapter(chapter) ? 'var(--primary-light)' : '#1a1a1a' }"
                      @click="isLeafChapter(chapter) && viewChapterAnalysis(book, chapter)"
                    >
                      {{ chapter.title }}
                      <span
                        v-if="chapter.analyzed"
                        style="color:var(--success);font-size:11px;"
                        title="已分析"
                      >✅</span>
                      <span
                        v-else
                        style="color:#ccc;font-size:11px;"
                        title="未分析"
                      >⬜</span>
                    </span>
                    <span class="page-range">第{{ chapter.start }}-{{ chapter.end }}页</span>
                    <span
                      class="remove-btn"
                      title="取消选择"
                      @click="removeSelectedChapter(book, chapter)"
                    >✕</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 已选模板 -->
        <div class="panel-section">
          <div
            class="section-header"
            @click="toggleSection('template')"
          >
            <span>{{ sectionCollapsed.template ? '▶' : '▼' }}</span>
            <span>📋 已选模板</span>
            <span class="selected-count">{{ selectedTemplateCount }}</span>
            <span
              class="analysis-toggle-all"
              title="切换全选/取消分析勾选"
              @click.stop="toggleAllForAnalysis('template')"
            >{{ allTemplateSelectedForAnalysis ? '☑' : '☐' }}</span>
          </div>
          <div
            v-show="!sectionCollapsed.template"
            class="section-content"
          >
            <div
              v-if="selectedTemplateCount === 0"
              class="empty-tip-small"
            >
              请先在模板库中勾选模板
            </div>
            <div
              v-for="(tpl, index) in templateStore.templates.filter(t => t?.selected)"
              :key="tpl?.id || index"
              class="summary-book"
            >
              <div class="summary-book-name">
                {{ tpl?.name }}
                <span
                  class="remove-btn"
                  title="取消该模板所有勾选"
                  @click="removeSelectedBook(tpl)"
                >✕</span>
              </div>
              <div class="summary-chapter-list">
                <div
                  v-for="chapter in getSelectedChapters(tpl?.outline || [])"
                  :key="chapter.title"
                  class="summary-chapter"
                >
                  <input
                    v-model="chapter._selectedForAnalysis"
                    type="checkbox"
                    :checked="chapter._selectedForAnalysis !== false"
                    class="analysis-checkbox"
                    title="勾选要分析的章节"
                  >
                  <span
                    class="chapter-title"
                    :style="{ cursor: isLeafChapter(chapter) ? 'pointer' : 'default', textDecoration: isLeafChapter(chapter) ? 'underline' : 'none', color: isLeafChapter(chapter) ? 'var(--primary-light)' : '#1a1a1a' }"
                    @click="isLeafChapter(chapter) && viewChapterAnalysis(tpl, chapter)"
                  >
                    {{ chapter.title }}
                    <span
                      v-if="chapter.analyzed"
                      style="color:var(--success);font-size:11px;"
                      title="已分析"
                    >✅</span>
                    <span
                      v-else
                      style="color:#ccc;font-size:11px;"
                      title="未分析"
                    >⬜</span>
                  </span>
                  <span class="page-range">第{{ chapter.start }}-{{ chapter.end }}页</span>
                  <span
                    class="remove-btn"
                    title="取消选择"
                    @click="removeSelectedChapter(tpl, chapter)"
                  >✕</span>
                </div>
              </div>
            </div>
          </div>
        </div>  
      </div>            

      <!-- 中间：注入指令（指令库模板渲染，可见可编辑——改本次生效；长期修改去指令库面板） -->
      <div
        v-show="!isMobile || mobileGenTab === 'instruct'"
        class="instruction-panel"
      >
        <div class="panel-header">
          <h3>📝 注入指令</h3>
          <div class="header-actions">
            <button
              class="btn-primary"
              @click="loadInstructionFromLibrary()"
            >
              🔧 生成指令
            </button>
            <button
              class="btn"
              @click="restoreDefaultInstruction"
            >
              ↩️ 恢复默认
            </button>
            <button
              class="btn"
              @click="clearInstruction"
            >
              🗑️ 清空
            </button>
            <button
              v-if="!isMobile"
              class="btn"
              @click="analyzeTextbook"
            >
              🔍 分析教材
            </button>
            <button
              v-if="!isMobile"
              class="btn"
              @click="analyzeTemplate"
            >
              🔍 分析模板
            </button>
            <span
              class="analyze-model-hint"
              title="知识点结构化分析推荐模型，在设置→分析提取模型中配置"
            >📚 glm4:9b</span>
          </div>
        </div>
        <textarea
          v-model="instructionDraft"
          placeholder="点击「生成指令」，按 年级×学科×资料类型 从指令库匹配注入；可直接编辑（仅本次生成生效）。长期修改请在「指令库」面板编辑保存。"
          class="instruction-textarea"
          @input="userEditedInstruction = true"
        />
        <div
          v-if="injectSources.length"
          class="inject-sources"
        >
          <div class="src-title">
            📚 本次注入来源（共 {{ injectSources.length }} 个库）
          </div>
          <div
            v-for="s in injectSources"
            :key="s.lib"
            class="src-item"
          >
            <span class="src-lib">{{ s.lib }}</span>
            <span class="src-name">{{ s.name }}</span>
            <span class="src-detail">{{ s.detail }}</span>
          </div>
        </div>
        <div
          v-if="instructionSource"
          class="instruction-source"
        >
          匹配维度：{{ instructionSource.key }} · 来源：{{ instructionSource.name }}（{{ instructionSource.source === 'user' ? '用户自定义' : '内置模板' }}）
        </div>
        <div class="inject-hint">
          📎 生成时自动附加：教材原文（按知识点检索，分级限量）、{{ templateStore.templates.some(t => t.selected) ? '模板对标、' : '' }}{{ propositionStyle ? '组织风格、' : '' }}用户附加要求
        </div>
        
        <div
          v-if="previewHint"
          class="preview-hint"
        >
          <span>{{ previewHint }}</span>
        </div>
        
        <div
          v-if="analysisResult"
          class="analysis-result"
        >
          <div class="analysis-header">
            <span>📊 素材分析结果</span>
            <button
              class="icon-btn"
              @click="analysisResult = null"
            >
              ✕
            </button>
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
      <div
        v-show="!isMobile || mobileGenTab === 'result'"
        class="result-panel"
      >
        <!-- 💰 DeepSeek 峰谷时段提示 -->
        <div
          v-if="showPricingTip"
          class="pricing-tip"
          :class="pricingPeriod.isPeak ? 'pricing-peak' : 'pricing-offpeak'"
          @click="showPeakDetail = !showPeakDetail"
        >
          <span class="pricing-badge">{{ pricingPeriod.isPeak ? '⚠️ 高峰时段' : '✅ 谷时优惠' }}</span>
          <span
            v-if="pricingPeriod.isPeak"
            class="pricing-text"
          >当前为 DeepSeek 高峰时段，费用较高。{{ pricingPeriod.nextOffPeakLabel ? `谷时（约${pricingPeriod.discount}）将在 ${pricingPeriod.nextOffPeakLabel} 开始` : '' }}</span>
          <span
            v-else
            class="pricing-text"
          >当前为 DeepSeek 谷时，{{ pricingPeriod.discount }}</span>
          <span class="pricing-detail-toggle">{{ showPeakDetail ? '▲' : '▼ 时段表' }}</span>
          <div
            v-if="showPeakDetail"
            class="pricing-detail-box"
          >
            <div class="pricing-detail-title">
              DeepSeek 峰谷时段表（北京时间）
            </div>
            <div class="pricing-detail-row pricing-detail-peak">
              🔴 高峰：09:00-12:00 / 14:00-18:00
            </div>
            <div class="pricing-detail-row pricing-detail-offpeak">
              🟢 谷时：00:00-09:00 / 12:00-14:00 / 18:00-24:00
            </div>
            <div class="pricing-detail-note">
              谷时费用约为高峰的 50%，建议非紧急生成安排在谷时
            </div>
          </div>
        </div>
        <div
          v-if="!isMobile"
          class="generate-actions"
        >
          <button
            class="btn-success"
            :disabled="!hasSelectedChapters || isGenerating"
            @click="generate('single')"
          >
            📄 单生成
          </button>
          <button
            class="btn-success"
            :disabled="!hasSelectedChapters || isGenerating || genTypes.length < 2"
            @click="generate('multiple')"
          >
            📚 复生成 ({{ genTypes.length }}个)
          </button>
          <button
            v-if="genTypes.includes('exam')"
            class="btn"
            :disabled="isGenerating"
            title="本次生成前临时调整大题分值，不保存到蓝图库"
            @click="openScoreAdjust"
          >
            ⚖️ 分值微调
          </button>
          <button
            class="btn-cancel"
            @click="handleCancelOrRelease"
          >
            {{ isGenerating ? '❌ 取消生成' : '🧹 释放显存' }}
          </button>
        </div>

        <div
          v-if="isGenerating"
          class="generating-tip"
        >
          <span>{{ generateStatus }}</span>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: generateProgress + '%' }"
            />
          </div>
        </div>

        <div class="result-header">
          <span>📋 结果 ({{ displayedDocs.length }})</span>
          <span
            class="select-all"
            @click="toggleSelectAll"
          >{{ allSelected ? '取消全选' : '全选' }}</span>
          <span
            v-if="selectedCount > 0"
            class="batch-delete"
            @click="batchDeleteDocs"
          >🗑️ 批量删除</span>
        </div>

        <div class="result-list">
          <div
            v-if="displayedDocs.length === 0"
            class="empty-tip"
          >
            暂无生成结果
          </div>
          <div
            v-for="(doc, idx) in displayedDocs"
            :key="doc.id"
            class="result-item"
            :class="getQualityClass(doc.quality)"
          >
            <div class="result-row">
              <input
                v-model="doc.selected"
                type="checkbox"
              >
              <div
                class="result-info"
                @click="previewDoc(doc)"
              >
                <div
                  v-if="doc.confidenceMarks && doc.confidenceMarks.length > 0"
                  class="confidence-warning"
                >
                  <span
                    v-for="(mark, idx) in doc.confidenceMarks.slice(0, 2)"
                    :key="idx"
                    :title="mark.message"
                  >
                    ⚠️ {{ mark.keyword }}
                  </span>
                  <span
                    v-if="doc.confidenceMarks.length > 2"
                    class="more-marks"
                  >
                    等{{ doc.confidenceMarks.length }}项提醒
                  </span>
                </div>
                <div class="result-title">
                  {{ doc.title }}
                </div>
                <div class="result-meta">
                  {{ doc.genType }}<template v-if="doc.style">
                    | {{ doc.style }}
                  </template>
                  <span
                    v-if="doc.difficulty"
                    class="difficulty-tag"
                  >
                    🟢 {{ doc.difficulty.easy }}% · 🟡 {{ doc.difficulty.medium }}% · 🔴 {{ doc.difficulty.hard }}%
                  </span>
                </div>
                <!-- ✨ 新增：质量报告摘要 -->
                <div
                  v-if="doc.qualityReport"
                  class="quality-summary"
                >
                  <span
                    v-if="doc.qualityReport.aiReview?.details?.length"
                    class="quality-item"
                    :class="{ 'quality-warn': !doc.qualityReport.aiReview.passed }"
                  >
                    🤖 评分：{{ doc.qualityReport.aiReview.details.find(d => d.includes('综合评分')) || '' }}
                  </span>
                </div>
                <!-- ✨ 新增：issues警告 -->
                <div
                  v-if="doc.issues && doc.issues.length > 0"
                  class="issues-summary"
                >
                  <span
                    v-for="(issue, iIdx) in doc.issues.slice(0, 2)"
                    :key="iIdx"
                    class="issue-tag"
                    :class="{ 'issue-error': issue.startsWith('❌'), 'issue-warn': issue.startsWith('⚠️') }"
                  >
                    {{ issue }}
                  </span>
                  <span
                    v-if="doc.issues.length > 2"
                    class="issue-more"
                  >+{{ doc.issues.length - 2 }}条</span>
                </div>
              </div>
              <div class="result-actions-col">
                <button
                  class="btn-small btn-save-history"
                  title="保存到历史"
                  @click.stop="saveToHistory(doc)"
                >
                  <span class="icon-desktop">💾</span><span class="icon-mobile">✅</span> 保存
                </button>
                <button
                  class="btn-small btn-delete-doc"
                  title="删除"
                  @click.stop="deleteDoc(doc)"
                >
                  🗑️ 删除
                </button>
                <button
                  class="btn-small"
                  @click.stop="previewDoc(doc)"
                >
                  👁️ 预览
                </button>
              </div>
            </div>
            <div class="result-actions">
              <button
                class="btn-small hide-on-mobile"
                @click.stop="sendToTypeset(doc)"
              >
                📄 排版
              </button>
              <button
                class="btn-small hide-on-mobile"
                @click.stop="downloadDoc(doc, 'docx')"
              >
                📘 Word
              </button>
              <button
                class="btn-small hide-on-mobile"
                @click.stop="downloadDoc(doc, 'pdf')"
              >
                📕 PDF
              </button>
              <button
                class="btn-small btn-variant hide-on-mobile"
                title="生成变体版本"
                @click.stop="generateVariantForDoc(doc)"
              >
                🔄 变体
              </button>
              <button
                v-if="doc.qualityReport"
                class="btn-small hide-on-mobile"
                title="查看质量报告"
                @click.stop="showQualityReport(doc)"
              >
                📊
              </button>
              <span class="quality-marks hide-on-mobile">
                <span
                  :class="{ active: doc.quality === 'good' }"
                  title="可用"
                  @click.stop="markQuality(doc, 'good')"
                >👍</span>
                <span
                  :class="{ active: doc.quality === 'bad' }"
                  title="不可用"
                  @click.stop="markQuality(doc, 'bad')"
                >👎</span>
                <span
                  :class="{ active: doc.quality === 'star' }"
                  title="收藏"
                  @click.stop="markQuality(doc, 'star')"
                >⭐</span>
              </span>
            </div>
            <div
              v-if="doc.graphInstructions?.length"
              class="graph-collect"
            >
              <span
                v-for="(g, gIdx) in doc.graphInstructions"
                :key="gIdx"
                @click.stop="collectGraph(doc, gIdx)"
              >⭐ 收藏图形{{ gIdx + 1 }}</span>
            </div>
            <div
              v-if="doc.status === 'failed'"
              class="failed-tip"
            >
              ⚠️ 生成失败
              <button
                class="btn-small"
                @click="retryGenerate(doc)"
              >
                重试
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="generatedDocs.length > 0"
          class="batch-download hide-on-mobile"
        >
          <select v-model="batchDownloadFormat">
            <option value="word">
              📘 仅 Word
            </option>
            <option value="pdf">
              📕 仅 PDF
            </option>
            <option value="both">
              📦 Word + PDF
            </option>
          </select>
          <select
            v-model="teacherVersion"
            style="width:auto;padding:6px 10px;border-radius:6px;border:1px solid #ddd;font-size:12px;"
          >
            <option :value="true">
              👩‍🏫 教师版（含答案）
            </option>
            <option :value="false">
              👩‍🎓 学生版（无答案）
            </option>
          </select>
          <button
            class="btn-warning"
            :disabled="selectedCount === 0"
            @click="batchDownload"
          >
            📦 下载 ({{ selectedCount }})
          </button>
        </div>
      </div>
    </div>

    <!-- 💰 移动端 DeepSeek 峰谷提示 -->
    <div
      v-if="isMobile && showPricingTip"
      class="pricing-tip"
      :class="pricingPeriod.isPeak ? 'pricing-peak' : 'pricing-offpeak'"
      style="margin: 8px 12px;"
      @click="showPeakDetail = !showPeakDetail"
    >
      <span class="pricing-badge">{{ pricingPeriod.isPeak ? '⚠️ 高峰' : '✅ 谷时' }}</span>
      <span
        v-if="pricingPeriod.isPeak"
        class="pricing-text"
      >费用较高，谷时{{ pricingPeriod.nextOffPeakLabel ? ` ${pricingPeriod.nextOffPeakLabel} 开始` : '约省50%' }}</span>
      <span
        v-else
        class="pricing-text"
      >费用约为高峰50%</span>
    </div>

    <!-- 📱 移动端固定底部操作栏 -->
    <div
      v-if="isMobile"
      class="mobile-gen-fab"
    >
      <button
        class="fab-btn fab-primary"
        :disabled="!hasSelectedChapters || isGenerating"
        @click="handleMobileGenerate('single')"
      >
        📄 单生成
      </button>
      <button
        class="fab-btn fab-secondary"
        :disabled="!hasSelectedChapters || isGenerating || genTypes.length < 2"
        @click="handleMobileGenerate('multiple')"
      >
        📚 复生成({{ genTypes.length }})
      </button>
      <button
        class="fab-btn fab-cancel"
        @click="handleCancelOrRelease"
      >
        {{ isGenerating ? '❌ 取消' : '🧹 释放' }}
      </button>
    </div>

    <!-- 📖 章节选择弹窗（移动端在生成页面直接勾选） -->
    <div
      v-if="showChapterSelector"
      class="modal-mask chapter-selector-mask"
      @click.self="showChapterSelector = false"
    >
      <div class="chapter-selector-modal">
        <div class="cs-header">
          <h3>📖 选择教材章节</h3>
          <button
            class="icon-btn"
            @click="showChapterSelector = false"
          >
            ✕
          </button>
        </div>
        <div class="cs-body">
          <div
            v-if="textbookStore.textbooks.length === 0"
            class="empty-tip-small"
          >
            📭 还没有教材，请先在教材库中上传
          </div>
          <div
            v-for="book in textbookStore.textbooks"
            :key="book.id"
            class="cs-book"
          >
            <div
              class="cs-book-header"
              @click="toggleCsBookExpand(book.id)"
            >
              <span class="cs-expand-icon">{{ csExpandedBooks.has(book.id) ? '▼' : '▶' }}</span>
              <span class="cs-book-name">{{ book.name }}</span>
              <span
                v-if="countBookSelected(book) > 0"
                class="cs-book-badge"
              >{{ countBookSelected(book) }}个已选</span>
            </div>
            <div
              v-if="csExpandedBooks.has(book.id) && book.outline"
              class="cs-chapter-tree"
            >
              <div
                v-for="(node, idx) in book.outline"
                :key="idx"
              >
                <ChapterCheckNode
                  :node="node"
                  :level="0"
                  :book="book"
                  @toggle="onCsChapterToggle"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="cs-footer">
          <button
            class="btn-primary"
            @click="showChapterSelector = false; textbookStore.saveTextbooks()"
          >
            ✅ 完成
          </button>
        </div>
      </div>
    </div>

    <!-- 范围类型弹窗 -->
    <div
      v-if="showScopeModal"
      class="modal-mask"
      @click.self="showScopeModal = false"
    >
      <div class="modal">
        <h3>📐 选择范围类型</h3>
        <div class="option-list">
          <label
            v-for="opt in scopeOptions"
            :key="opt.value"
            class="option-item"
          >
            <input
              v-model="scopeType"
              type="radio"
              :value="opt.value"
            >
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
          </label>
        </div>
        <div class="modal-actions">
          <button
            class="btn"
            @click="showScopeModal = false"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="showScopeModal = false"
          >
            确定
          </button>
        </div>
        <!-- 🔧 多章节合并开关（期中/期末强制合并，不可切换） -->
        <div
          v-if="scopeType && scopeType !== 'midterm' && scopeType !== 'final'"
          class="merge-toggle-section"
        >
          <label class="option-item merge-toggle">
            <input
              v-model="mergeChapters"
              type="checkbox"
            >
            <span class="option-label">📦 多章节合并为一份综合卷</span>
            <span class="option-desc">取消勾选则逐章独立生成</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 组织风格弹窗（命题/呈现两组全部列出；当前类型不适用的置灰） -->
    <div
      v-if="showStyleModal"
      class="modal-mask"
      @click.self="showStyleModal = false"
    >
      <div class="modal">
        <h3>🎨 选择组织风格</h3>
        <div class="option-list">
          <div class="style-group-title">
            命题风格 · 以题为主（题目如何组织情境）
          </div>
          <label
            v-for="opt in propositionOptions"
            :key="opt.value"
            class="option-item"
            :class="{ 'opt-disabled': !opt.applicable }"
          >
            <input
              v-model="propositionStyle"
              type="radio"
              :value="opt.value"
              :disabled="!opt.applicable"
              @change="styleManuallySet = true"
            >
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
            <span class="option-tip">{{ opt.tip }}</span>
            <span
              v-if="!opt.applicable"
              class="opt-for"
            >适用于：{{ opt.appliesToLabel }}</span>
          </label>
          <div class="style-group-title">
            呈现风格 · 以内容为主（内容如何组织呈现）
          </div>
          <label
            v-for="opt in presentationOptions"
            :key="opt.value"
            class="option-item"
            :class="{ 'opt-disabled': !opt.applicable }"
          >
            <input
              v-model="propositionStyle"
              type="radio"
              :value="opt.value"
              :disabled="!opt.applicable"
              @change="styleManuallySet = true"
            >
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
            <span class="option-tip">{{ opt.tip }}</span>
            <span
              v-if="!opt.applicable"
              class="opt-for"
            >适用于：{{ opt.appliesToLabel }}</span>
          </label>
        </div>
        <p class="hint">
          💡 全部组织风格如上（当前资料类型不适用的已置灰）。系统已按当前类型推荐默认风格（{{ styleLabel }}）。如需恢复自动匹配，点击"恢复自动"。
        </p>
        <div class="modal-actions">
          <button
            v-if="styleManuallySet"
            class="btn"
            @click="restoreAutoStyle"
          >
            ↻ 恢复自动
          </button>
          <button
            class="btn"
            @click="showStyleModal = false"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="confirmStyle"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 分值微调弹窗（本次生成前临时调整，不落库） -->
    <div
      v-if="showScoreAdjustModal"
      class="modal-mask"
      @click.self="showScoreAdjustModal = false"
    >
      <div class="modal">
        <h3>⚖️ 分值微调（本次生成生效）</h3>
        <div class="score-adjust-list">
          <div
            v-for="(s, i) in scoreAdjustDraft"
            :key="i"
            class="score-adjust-row"
          >
            <span class="sa-name">{{ '一二三四五六七八九十'[i] || i + 1 }}、{{ s.name }}</span>
            <input
              v-model.number="s.score"
              type="number"
              class="sa-input"
              min="0"
            >
            <span class="sa-unit">分</span>
          </div>
        </div>
        <div
          class="sa-sum"
          :class="{ 'sa-bad': scoreAdjustSum !== scoreAdjustFull }"
        >
          分值之和：<b>{{ scoreAdjustSum }}</b> / 满分 {{ scoreAdjustFull }} {{ scoreAdjustSum === scoreAdjustFull ? '✅' : '⚠️ 不闭合，无法生成' }}
        </div>
        <p class="hint">
          💡 仅本次生成使用；不保存到蓝图库、不改动内置默认。下次生成可再次微调或恢复默认。
        </p>
        <div class="modal-actions">
          <button
            class="btn"
            @click="resetScoreAdjust"
          >
            ↩️ 恢复默认
          </button>
          <button
            class="btn"
            @click="showScoreAdjustModal = false"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="confirmScoreAdjust"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 资料类型弹窗（多选） -->
    <div
      v-if="showGenTypeModal"
      class="modal-mask"
      @click.self="showGenTypeModal = false"
    >
      <div class="modal">
        <h3>📂 选择资料类型（可多选）</h3>
        <div class="option-list">
          <label
            v-for="opt in genTypeOptions"
            :key="opt.value"
            class="option-item"
          >
            <input
              v-model="genTypes"
              type="checkbox"
              :value="opt.value"
            >
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
          </label>
        </div>
        <p class="hint">
          💡 选择资料类型后，系统将按资料类型自动推荐匹配命题风格（考试→统一情境，其他→情境融合）。复生成时将按顺序生成选中的多个类型。命题风格可在上方"🎨"按钮中手动调整。
        </p>
        <!-- 🔧 省市差异化：正式试卷（exam）按省市取考试时长/总分（如江苏中考语数英150分、北京100分制），未选则全国通用默认 -->
        <div
          v-if="genTypes.includes('exam')"
          class="region-select-section"
        >
          <label class="option-label">🗺️ 省市（正式试卷按该省市考试时长/总分出卷）</label>
          <div class="region-select-row">
            <select
              v-model="examRegion"
              class="region-select"
            >
              <option value="">
                全国通用（默认）
              </option>
              <option
                v-for="r in examRegionOptions"
                :key="r"
                :value="r"
              >
                {{ r }}
              </option>
            </select>
            <button
              v-if="examRegion"
              class="btn btn-sm"
              @click="examRegion = ''"
            >
              清除
            </button>
          </div>
        </div>
        <div class="modal-actions">
          <button
            class="btn"
            @click="showGenTypeModal = false"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="showGenTypeModal = false"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- ✏️ 名称样式弹窗（单选：自动轮换/固定名称） -->
    <div
      v-if="showLabelStyleModal"
      class="modal-mask"
      @click.self="showLabelStyleModal = false"
    >
      <div class="modal">
        <h3>✏️ 名称样式（{{ genTypes[0] ? genTypeOptions.find(o => o.value === genTypes[0])?.label : '未选类型' }}）</h3>
        <p style="color:var(--text-secondary);margin-bottom:12px;">
          决定生成资料标题中的名称（如"测试卷""课堂练习"）。默认自动轮换避免标题重复；考试标签（期中/期末/月考）也可按维度固定。
        </p>
        <p class="name-style-label">
          资料类型名称
        </p>
        <div class="name-chip-group">
          <label
            v-for="opt in labelStyleOptions"
            :key="opt.value"
            class="name-chip"
            :class="{ active: labelStyle === opt.value }"
            :title="opt.desc"
          >
            <input
              v-model="labelStyle"
              type="radio"
              :value="opt.value"
              name="labelStyle"
              hidden
            >
            {{ opt.label }}
          </label>
        </div>
        <!-- 📐 考试标签名称（期中/期末/月考/综合）：每维度单选 自动轮换 / 固定名称，与资料类型名称样式统一 -->
        <div
          v-if="genTypes[0] === 'exam'"
          class="scope-style-block"
        >
          <p class="scope-style-title">
            📐 考试标签名称（选"🔄 自动轮换"按名称池轮流用；选具体名称则固定）
          </p>
          <div
            v-for="dim in scopeDims"
            :key="dim.type"
            class="scope-dim"
          >
            <div class="scope-dim-head">
              {{ dim.label }}
            </div>
            <div class="name-chip-group">
              <label
                class="name-chip"
                :class="{ active: scopeLabelStyle[dim.type] === '' }"
              >
                <input
                  v-model="scopeLabelStyle[dim.type]"
                  type="radio"
                  value=""
                  :name="'scope-' + dim.type"
                  hidden
                >
                🔄 自动轮换
              </label>
              <label
                v-for="w in dim.pool"
                :key="w"
                class="name-chip"
                :class="{ active: scopeLabelStyle[dim.type] === w }"
              >
                <input
                  v-model="scopeLabelStyle[dim.type]"
                  type="radio"
                  :value="w"
                  :name="'scope-' + dim.type"
                  hidden
                >
                {{ w }}
              </label>
            </div>
          </div>
        </div>
        <p class="hint">
          💡 多类型复生成时，此处只设置第一个类型的名称，其余类型仍自动轮换；选具体名称会持久化（刷新不丢失），可随时点回"🔄 自动轮换"或一键恢复
        </p>
        <div class="modal-actions">
          <button
            class="btn"
            title="资料类型名称 + 考试标签各维度全部恢复自动轮换"
            @click="resetNameStyles"
          >
            ↩️ 全部恢复自动轮换
          </button>
          <button
            class="btn"
            @click="showLabelStyleModal = false"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="showLabelStyleModal = false"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 🎯 专项子类型弹窗（单选） -->
    <div
      v-if="showSpecialSubTypeModal"
      class="modal-mask"
      @click.self="showSpecialSubTypeModal = false"
    >
      <div class="modal">
        <h3>🎯 选择专项训练领域</h3>
        <p style="color:var(--text-secondary);margin-bottom:12px;">
          选择一个聚焦的技能领域，AI 将围绕该领域生成针对性的专项训练资料。
        </p>
        <div
          v-if="specialSubTypeOptions.length === 0"
          class="empty-tip-small"
          style="padding:16px;"
        >
          当前学科暂无专项子类型可用，将使用通用专项结构（方法指导→典例剖析→变式训练→真题实战）。
        </div>
        <div class="option-list">
          <label
            v-for="opt in specialSubTypeOptions"
            :key="opt.value"
            class="option-item"
          >
            <input
              v-model="specialSubType"
              type="radio"
              :value="opt.value"
              name="specialSubType"
            >
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
          </label>
          <label class="option-item">
            <input
              v-model="specialSubType"
              type="radio"
              :value="''"
              name="specialSubType"
            >
            <span class="option-label">🔄 通用专项</span>
            <span class="option-desc">使用默认专项结构（方法指导→典例剖析→变式训练→真题实战）</span>
          </label>
        </div>
        <div class="modal-actions">
          <button
            class="btn"
            @click="showSpecialSubTypeModal = false"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="showSpecialSubTypeModal = false"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 生成粒度弹窗 -->
    <div
      v-if="showGranularityModal"
      class="modal-mask"
      @click.self="showGranularityModal = false"
    >
      <div class="modal">
        <h3>📏 选择生成粒度</h3>
        <div class="option-list">
          <label
            v-for="opt in granularityOptions"
            :key="opt.value"
            class="option-item"
          >
            <input
              v-model="generateGranularity"
              type="radio"
              :value="opt.value"
            >
            <span class="option-label">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.desc }}</span>
          </label>
        </div>
        <div class="modal-actions">
          <button
            class="btn"
            @click="showGranularityModal = false"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="showGranularityModal = false"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 详细配置弹窗 -->
    <div
      v-if="showDetailConfigModal"
      class="modal-mask"
      @click.self="showDetailConfigModal = false"
    >
      <div class="modal large-modal">
        <h3>📝 详细配置</h3>
        <div class="modal-scroll-area">
          <div class="config-section">
            <h4>总分设置</h4>
            <input
              v-model="totalScore"
              type="number"
              placeholder="例如：100"
              min="0"
            >
          </div>
        
          <div class="config-section">
            <h4>题型配置</h4>
            <div
              v-if="selectedTextbookCount === 0"
              class="empty-tip-small"
            >
              📌 请先在左侧勾选教材，系统将根据学科和年级智能推荐题型
            </div>
            <div
              v-else
              class="hint"
              style="margin-bottom: 10px; color: var(--primary-light);"
            >
              📋 当前是根据 <strong>{{ getSelectedBookSubject() }}</strong> 学科推荐的题型
            </div>
            <div
              v-for="(qt, idx) in questionTypes"
              :key="idx"
              class="config-row"
            >
              <input
                v-model="qt.selected"
                type="checkbox"
              >
              <span class="qt-name">{{ qt.name }}</span>
              <input
                v-model="qt.count"
                type="number"
                placeholder="题量"
                min="0"
                style="width:70px"
              >
              <input
                v-model="qt.score"
                type="number"
                placeholder="分值"
                min="0"
                style="width:70px"
              >
            </div>
            <button
              class="btn-small"
              @click="addQuestionType"
            >
              ➕ 添加题型
            </button>
          </div>
        
          <div class="config-section">
            <h4>难度配置（%）</h4>
            <div
              v-for="(dl, idx) in difficultyLevels"
              :key="idx"
              class="config-row"
            >
              <input
                v-model="dl.selected"
                type="checkbox"
              >
              <span class="dl-name">{{ dl.name }}</span>
              <input
                v-model="dl.percentage"
                type="number"
                min="0"
                max="100"
                style="width:70px"
                :placeholder="dl.percentage == null ? '自动' : ''"
              > %
            </div>
          </div>

          <div class="config-section">
            <h4>生成份数（同类型一次出多份）</h4>
            <input
              v-model.number="batchCount"
              type="number"
              min="1"
              max="10"
              placeholder="1"
              style="width:100px"
            >
            <span class="hint">设置>1时，一次生成多份不同的资料</span>
          </div>                
        
          <div class="config-section">
            <h4>原题引用</h4>
            <label class="checkbox-label">
              <input
                v-model="allowOriginalQuestions"
                type="checkbox"
              >
              允许适量引用教材原题
            </label>
          </div>
        </div>
        
        <div class="modal-actions">
          <button
            class="btn"
            @click="showDetailConfigModal = false"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="closeDetailConfigModal"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 预览弹窗（Teleport 到 body 脱离缩放容器，避免 transform:scale 导致缩小溢出） -->
    <Teleport to="body">
      <div
        v-if="showPreview"
        class="modal-mask"
        @click.self="showPreview = false"
      >
        <div class="modal large-modal">
          <h3><span class="hide-on-mobile">👁️</span> 内容预览</h3>
          <div
            v-if="previewHint"
            class="copy-hint"
          >
            {{ previewHint }}
          </div>
          <div
            class="preview-content"
            v-html="previewContent"
          />
          <div class="modal-actions">
            <button
              class="btn"
              @click="showPreview = false"
            >
              关闭
            </button>
            <button
              class="btn-edurender hide-on-mobile"
              @click="copyToEduRender"
            >
              📋 复制到EduRender
            </button>
            <button
              class="btn-primary hide-on-mobile"
              @click="editDoc"
            >
              ✏️ 编辑
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 编辑弹窗（Teleport 到 body 脱离缩放容器） -->
    <Teleport to="body">
      <div
        v-if="showEditor"
        class="modal-mask"
        @click.self="showEditor = false"
      >
        <div class="modal large-modal">
          <h3>✏️ 编辑文档</h3>
          <textarea
            v-model="editingContent"
            rows="20"
            class="editor-textarea"
          />
          <div class="modal-actions">
            <button
              class="btn"
              @click="showEditor = false"
            >
              取消
            </button>
            <button
              class="btn-primary"
              @click="saveEdit"
            >
              💾 保存
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 分析确认弹窗 -->
    <div
      v-if="showAnalysisModal"
      class="modal-mask"
      @click.self="showAnalysisModal = false"
    >
      <div
        class="modal large-modal"
        style="max-width: 900px; width: 90%;"
      >
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
                <div
                  v-for="book in analysisBooks"
                  :key="book.id"
                  style="margin-bottom:14px;border:1px solid var(--border-light);border-radius:8px;padding:12px;"
                >
                  <div style="font-weight:600;color:var(--primary);margin-bottom:8px;">
                    {{ book.name }}
                  </div>
                  <div
                    v-for="ch in book.selectedChapters"
                    :key="ch.title"
                    style="padding:6px 0;font-size:14px;border-bottom:1px dashed #f0f0f0;"
                  >
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-weight:500;">{{ ch.title }}</span>
                      <span
                        v-if="ch.analyzed"
                        style="color:var(--success);"
                      >✅ 已分析</span>
                      <span
                        v-else
                        style="color:var(--warning);"
                      >⚠️ 未分析</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                      分析范围：第{{ ch._analysisStart ?? ch.start }}-{{ ch._analysisEnd ?? ch.end }}页
                    </div>
                  </div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">
                    {{ book.cached }}个已缓存 / {{ book.new }}个未分析
                  </div>
                </div>
              </div>
              <div v-else>
                <div
                  v-for="tpl in analysisTpls"
                  :key="tpl.id"
                  style="margin-bottom:14px;border:1px solid var(--border-light);border-radius:8px;padding:12px;"
                >
                  <div style="font-weight:600;color:var(--primary);margin-bottom:8px;">
                    {{ tpl.name }}
                  </div>
                  <div
                    v-for="ch in tpl.selectedChapters"
                    :key="ch.title"
                    style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:14px;border-bottom:1px dashed #f0f0f0;"
                  >
                    <span>{{ ch.title }}</span>
                    <span
                      v-if="ch.analyzed"
                      style="color:var(--success);"
                    >✅ 已分析</span>
                    <span
                      v-else
                      style="color:var(--warning);"
                    >⚠️ 未分析</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">
                    {{ tpl.cached }}个已缓存 / {{ tpl.new }}个未分析
                  </div>
                </div>
              </div>
            </div>
          
            <!-- 右栏：操作面板 -->
            <div
              class="chapter-analysis-right"
              style="display:flex;flex-direction:column;gap:12px;"
            >
              <div style="text-align:center;padding:12px;background:#f0f7ff;border-radius:8px;">
                <div style="font-size:24px;font-weight:700;color:var(--primary-light);">
                  {{ totalNewCount }}
                </div>
                <div style="font-size:12px;color:var(--text-muted);">
                  个章节待分析
                </div>
              </div>
            
              <!-- 🔧 新增：原文获取方式选择 -->
              <div style="margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 12px; color: #555; margin-bottom: 8px;">
                  <strong>📥 原文获取方式：</strong>
                </div>
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; font-size: 13px;">
                  <input
                    v-model="analysisInputMode"
                    type="radio"
                    value="ocr"
                  >
                  <span>📷 自动OCR提取 <span style="color:var(--text-muted);font-size:11px;">（PaddleOCR-VL 引擎，本地识别图片文字，无需联网）</span></span>
                </label>
                <label
                  v-if="analysisInputMode === 'ocr'"
                  style="display: flex; align-items: center; gap: 8px; margin-left: 24px; margin-bottom: 8px; cursor: pointer; font-size: 12px;"
                >
                  <input
                    v-model="enableColumnSplit"
                    type="checkbox"
                  >
                  <span>📐 启用多栏切割 <span style="color:var(--text-muted);font-size:11px;">（分栏排版文档勾选，逐栏识别后合并）</span></span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                  <input
                    v-model="analysisInputMode"
                    type="radio"
                    value="manual"
                  >
                  <span>✍️ 手动输入原文 <span style="color:var(--text-muted);font-size:11px;">（粘贴或手动输入文字）</span></span>
                </label>
              </div>
            
              <div style="font-size:12px;color:var(--text-muted);line-height:1.8;">
                <p><strong>📌 说明：</strong></p>
                <p>• 分析会调用 AI 模型提取教材/模板中的文字和知识点</p>
                <p>• 已分析的章节会缓存结果，下次无需重复分析</p>
                <p>• 分析过程可能需要几分钟，请耐心等待</p>
              </div>
            
              <div
                class="modal-actions"
                style="flex-direction:column;gap:10px;margin-top:auto;"
              >
                <button
                  class="btn-primary"
                  style="width:100%;padding:12px;"
                  @click="runAnalysis('all')"
                >
                  🔄 全部重新分析
                </button>
                <button
                  class="btn"
                  :disabled="totalNewCount === 0"
                  style="width:100%;padding:12px;"
                  @click="runAnalysis('new')"
                >
                  📝 仅分析新的（{{ totalNewCount }}个）
                </button>
                <button
                  class="btn"
                  style="width:100%;padding:12px;"
                  @click="runAnalysis('skip')"
                >
                  ⏭️ 跳过，使用已有缓存
                </button>
                <button
                  class="btn"
                  style="width:100%;padding:12px;color:var(--text-muted);"
                  @click="showAnalysisModal = false"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 🔧 原文编辑弹窗（用户确认/补充 OCR 或手动录入的教材原文） -->
    <div
      v-if="showRawTextEditor"
      class="modal-mask"
      @click.self="closeRawTextEditor"
    >
      <div
        class="modal large-modal"
        style="max-width: 1200px; width: 95%; display: flex; flex-direction: column;"
      >
        <div
          class="modal-header"
          style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;"
        >
          <h3 style="margin: 0;">
            📝 原文编辑器 - {{ rawTextEditorData?.chapterTitle }}
          </h3>
          <button
            class="close-btn"
            style="background: none; border: none; font-size: 24px; cursor: pointer;"
            @click="closeRawTextEditor"
          >
            ✕
          </button>
        </div>
            
        <div style="display: flex; gap: 12px; margin-bottom: 12px; align-items: center;">
          <span style="font-size: 13px; color: #666;">ℹ️ 直接粘贴图文混排内容，图片会自动提取</span>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
            <input
              v-model="rawTextEditorData.analyzeCharts"
              type="checkbox"
              @change="onAnalyzeChartsChange"
            >
            <span>🖼️ 分析图片内容（自动调用多模态模型描述）</span>
          </label>
        </div>
        
        <!-- 🔧 图片列表和勾选 -->
        <div
          v-if="rawTextEditorData.analyzeCharts && rawTextEditorData.detectedImages && rawTextEditorData.detectedImages.length > 0" 
          style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px; max-height: 200px; overflow-y: auto;"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 13px;">📸 检测到 {{ rawTextEditorData.detectedImages.length }} 张图片</strong>
            <div style="display: flex; gap: 8px;">
              <button
                style="font-size: 12px; padding: 4px 8px; cursor: pointer;"
                @click="selectAllDetectedImages(true)"
              >
                全选
              </button>
              <button
                style="font-size: 12px; padding: 4px 8px; cursor: pointer;"
                @click="selectAllDetectedImages(false)"
              >
                全不选
              </button>
            </div>
          </div>
          <div
            v-for="(img, idx) in rawTextEditorData.detectedImages"
            :key="idx" 
            style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding: 6px; background: white; border-radius: 4px;"
          >
            <input
              :id="'img-' + idx"
              v-model="img.selected"
              type="checkbox"
            >
            <label
              :for="'img-' + idx"
              style="flex: 1; cursor: pointer; display: flex; align-items: center; gap: 8px;"
            >
              <img
                :src="img.src"
                style="max-width: 60px; max-height: 60px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px;"
              >
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
            <li>最终生成纯文本，方便后续分析提取命题素材</li>
          </ul>
        </div>
            
        <div
          class="modal-actions"
          style="margin-top: 16px; display: flex; gap: 12px; justify-content: flex-end;"
        >
          <button
            class="btn"
            style="padding: 10px 20px;"
            @click="closeRawTextEditor"
          >
            ❌ 取消
          </button>
          <button
            class="btn-primary"
            :disabled="isAnalyzingImages"
            style="padding: 10px 20px;"
            @click="confirmRawTextWithImages"
          >
            {{ isAnalyzingImages ? '🔄 正在分析图片...' : '✅ 确认原文，继续分析' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 分析结果确认弹窗 -->
    <div
      v-if="showAnalysisResultModal"
      class="modal-mask"
      @click.self="showAnalysisResultModal = false"
    >
      <div
        ref="analysisResultModalRef"
        class="modal large-modal draggable-modal analysis-result-modal"
        style="max-width: 1200px; width: 96%; display: flex; flex-direction: column;"
      >
        <!-- ✅ 固定头部：标题 + 提示 -->
        <div style="flex-shrink: 0;">
          <div
            class="modal-drag-handle"
            @mousedown="startAnalysisResultDrag($event)"
          >
            📊 分析结果确认（可拖动）
          </div>
          <h3 style="margin: 8px 0 4px 0;">
            📊 分析结果确认
          </h3>
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
            <div
              v-for="(item, idx) in analysisResultData"
              :key="idx"
              style="border:1px solid var(--border-light);border-radius:8px;padding:10px;margin-bottom:10px;"
            >
              <div class="confirm-item-header">
                <strong style="font-size:13px;">{{ item.bookName }} - {{ item.chapterTitle }}</strong>
                <div style="display:flex;gap:6px;align-items:center;">
                  <span
                    v-if="item.ocrQuality === 'poor'"
                    style="color:var(--danger);font-weight:bold;font-size:11px;background:#fde8e8;padding:2px 6px;border-radius:3px;"
                  >❌ 质量差·必须修正</span>
                  <span
                    v-else-if="item.ocrQuality === 'warning'"
                    style="color:var(--warning);font-size:11px;background:#fef3e2;padding:2px 6px;border-radius:3px;"
                  >️ 可能有误·建议核对</span>
                  <button
                    class="icon-btn"
                    title="单独保存"
                    style="padding:2px 4px;color:var(--success);"
                    @click="saveSingleAnalysisItem(idx)"
                  >
                    💾
                  </button>
                  <button
                    class="icon-btn"
                    title="删除"
                    style="padding:2px 4px;"
                    @click="removeAnalysisItem(idx)"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <!-- 左右两栏 -->
              <div class="template-two-columns">
                <!-- 左栏：原文 -->
                <div class="template-left-column">
                  <label style="display:block;font-size:11px;color:var(--text-muted);margin-bottom:3px;">📖 原文提取</label>
                  <div
                    v-if="item.rawText && item.rawText.includes('【？】')" 
                    style="display:flex;align-items:center;gap:4px;margin-bottom:3px;padding:3px 6px;background:#fffbf0;border:1px solid #f0c78e;border-radius:3px;font-size:10px;"
                  >
                    <span style="color:var(--warning);font-weight:600;">⚠️ {{ (item.rawText.match(/【？】/g) || []).length }} 处</span>
                    <button
                      class="btn-small"
                      style="color:var(--primary-light);padding:1px 4px;font-size:10px;"
                      @click="jumpToUncertainInItem(item, 'prev')"
                    >
                      ◀
                    </button>
                    <button
                      class="btn-small"
                      style="color:var(--primary-light);padding:1px 4px;font-size:10px;"
                      @click="jumpToUncertainInItem(item, 'next')"
                    >
                      ▶
                    </button>
                    <button
                      class="btn-small"
                      style="color:var(--success);margin-left:auto;padding:1px 6px;font-size:10px;"
                      @click="item.rawText = item.rawText.replace(/【？】/g, '')"
                    >
                      ✅ 清除
                    </button>
                  </div>
                  <!-- 🔧 保留原文格式：有 _rawTextHtml 用富文本编辑器，否则用纯文本框 -->
                  <RichTextEditor 
                    v-if="item._rawTextHtml"
                    v-model="item._rawTextHtml"
                    placeholder="逐段原文..."
                    :min-height="'240px'"
                    style="width:100%;font-size:11px;max-height:420px;"
                  />
                  <textarea
                    v-else
                    v-model="item.rawText"
                    rows="16"
                    placeholder="逐段原文..."
                    :style="{ borderColor: item.ocrQuality === 'poor' ? 'var(--danger)' : '#ddd', width:'100%',fontSize:'11px',padding:'6px',borderRadius:'4px',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box' }"
                    @click="updateUncertainForItem($event, item)"
                  />
                </div>
                
                <!-- 右栏：分析字段 -->
                <div class="template-right-column">
                  <div class="confirm-field">
                    <label style="font-size:11px;">️ 图表描述</label>
                    <input
                      v-model="item.visualDescription"
                      type="text"
                      placeholder="图表描述..."
                      style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;"
                    >
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;"> 公式描述</label>
                    <input
                      v-model="item.formulasText"
                      type="text"
                      placeholder="公式..."
                      style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;"
                    >
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;">️ 核心主题词（逗号分隔）</label>
                    <input
                      v-model="item.coreTopics"
                      type="text"
                      placeholder="主题词..."
                      style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;"
                    >
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;">📍 知识点（每行一个）</label>
                    <textarea
                      v-model="item.knowledgePointsText"
                      rows="4"
                      placeholder="每行一个知识点..."
                      style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;resize:vertical;font-family:inherit;"
                    />
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;"> 能力层次</label>
                    <select
                      v-model="item.competency"
                      style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;"
                    >
                      <option value="识记与理解">
                        识记与理解
                      </option>
                      <option value="应用与分析">
                        应用与分析
                      </option>
                      <option value="综合与评价">
                        综合与评价
                      </option>
                    </select>
                  </div>
                  <div class="confirm-field">
                    <label style="font-size:11px;">🎨 风格</label>
                    <select
                      v-model="item.style"
                      style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;"
                    >
                      <option value="传统">
                        传统
                      </option>
                      <option value="创新">
                        创新
                      </option>
                      <option value="情境化">
                        情境化
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 🔧 重构：模板分析结果——左右两栏布局 -->
          <div
            v-if="analysisResultType === 'template' && analysisResultData"
            class="template-review-layout"
          >
            <!-- 顶部提示条 -->
            <div style="background:#fff9e6;border:2px solid #f39c12;border-radius:6px;padding:8px 12px;margin-bottom:10px;">
              <p style="margin:0;color:#b85c00;font-weight:600;font-size:12px;">
                ⚠️ 模板对标是生成高质量资料的关键，请逐项核对
              </p>
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
                <div
                  v-if="analysisResultData.rawText && analysisResultData.rawText.includes('【？】')" 
                  style="display:flex;align-items:center;gap:4px;margin-bottom:4px;padding:4px 8px;background:#fffbf0;border:1px solid #f0c78e;border-radius:4px;font-size:11px;"
                >
                  <span style="color:var(--warning);font-weight:600;">⚠️ {{ uncertainCount }} 处不确定</span>
                  <button
                    class="btn-small"
                    style="color:var(--primary-light);font-size:10px;"
                    @click="jumpToUncertain('prev')"
                  >
                    ◀ 上一个
                  </button>
                  <button
                    class="btn-small"
                    style="color:var(--primary-light);font-size:10px;"
                    @click="jumpToUncertain('next')"
                  >
                    下一个 ▶
                  </button>
                  <span style="color:var(--text-muted);margin:0 4px;font-size:10px;">{{ uncertainCurrentIndex > 0 ? uncertainCurrentIndex : '?' }}/{{ uncertainCount }}</span>
                  <button
                    class="btn-small"
                    style="color:var(--success);margin-left:auto;font-size:10px;"
                    @click="clearAllUncertainMarks"
                  >
                    ✅ 一键清除
                  </button>
                </div>
                <!-- 🔧 保留原文格式：有 _rawTextHtml 用富文本编辑器，否则用纯文本框 -->
                <RichTextEditor 
                  v-if="analysisResultData._rawTextHtml"
                  v-model="analysisResultData._rawTextHtml"
                  placeholder="逐段原文...（请对照原始模板PDF逐字核对）"
                  :min-height="'400px'"
                  style="width:100%;font-size:12px;max-height:500px;"
                />
                <textarea
                  v-else
                  ref="rawTextTextarea"
                  v-model="analysisResultData.rawText" 
                  rows="26"
                  placeholder="逐段原文...（请对照原始模板PDF逐字核对）"
                  class="template-raw-textarea"
                  :style="{ borderColor: analysisResultData.ocrQuality === 'poor' ? 'var(--danger)' : '#ddd' }"
                  @click="updateUncertainList"
                  @keyup="updateUncertainList"
                />
              </div>

              <!-- ========== 右栏：分析字段 ========== -->
              <div class="template-right-column">
                <div class="confirm-item-header">
                  <strong style="font-size:13px;">📊 结构分析</strong>
                  <div style="display:flex;gap:4px;">
                    <span
                      v-if="analysisResultData.ocrQuality === 'poor'"
                      style="color:var(--danger);font-weight:bold;font-size:10px;background:#fde8e8;padding:2px 6px;border-radius:3px;"
                    >OCR质量差</span>
                    <span
                      v-else-if="analysisResultData.ocrQuality === 'warning'"
                      style="color:var(--warning);font-weight:bold;font-size:10px;background:#fef3e2;padding:2px 6px;border-radius:3px;"
                    >OCR有误</span>
                    <button
                      class="btn-small"
                      title="清空所有分析字段"
                      style="color:var(--warning);border-color:#f0c78e;font-size:10px;"
                      @click="clearTemplateAnalysisFields"
                    >
                      🗑️ 重填
                    </button>
                  </div>
                </div>

                <div class="confirm-field">
                  <label style="font-size:11px;">📋 结构分析 <span style="color:var(--danger);">*必填</span></label>
                  <div
                    v-for="(section, si) in (analysisResultData.结构分析 || [])"
                    :key="si"
                    style="margin-bottom:6px;border:1px solid var(--border-light);border-radius:4px;padding:6px;"
                  >
                    <div style="display:flex;gap:4px;margin-bottom:3px;">
                      <input
                        v-model="section.大题"
                        type="text"
                        placeholder="大题（如一、看拼音写词语）"
                        style="flex:1;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
                      >
                      <input
                        v-model="section.题型"
                        type="text"
                        placeholder="题型"
                        style="width:100px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
                      >
                      <button
                        class="btn-small"
                        style="color:var(--danger);flex-shrink:0;padding:2px 4px;font-size:10px;"
                        @click="analysisResultData.结构分析.splice(si, 1)"
                      >
                        🗑️
                      </button>
                    </div>
                    <div style="display:flex;gap:4px;">
                      <input
                        v-model.number="section.小题数量"
                        type="number"
                        placeholder="小题数"
                        style="width:60px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
                      >
                      <input
                        v-model.number="section.大题分值"
                        type="number"
                        placeholder="分值"
                        style="width:60px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
                      >
                      <input
                        v-model.number="section.每小题分值"
                        type="number"
                        placeholder="每小题分"
                        style="width:70px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
                      >
                      <input
                        v-model="section.难度"
                        type="text"
                        placeholder="难度"
                        style="width:60px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
                      >
                    </div>
                    <input
                      v-model="section.设问风格"
                      type="text"
                      placeholder="设问风格"
                      style="width:100%;margin-top:3px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
                    >
                  </div>
                  <button
                    class="btn-small"
                    style="margin-top:3px;font-size:10px;"
                    @click="analysisResultData.结构分析.push({大题:'',题型:'',小题数量:0,大题分值:0,每小题分值:0,设问风格:'',难度:'基础'})"
                  >
                    ➕ 添加大题
                  </button>
                </div>
                <div style="display:flex;gap:10px;">
                  <div
                    class="confirm-field"
                    style="flex:1;"
                  >
                    <label style="font-size:11px;">总分</label>
                    <input
                      v-model.number="analysisResultData.总分"
                      type="number"
                      placeholder="100"
                      style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;"
                    >
                  </div>
                  <div
                    class="confirm-field"
                    style="flex:1;"
                  >
                    <label style="font-size:11px;">总题数</label>
                    <input
                      v-model.number="analysisResultData.总题数"
                      type="number"
                      placeholder="20"
                      style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;"
                    >
                  </div>
                </div>

                <!-- 🔧 语言风格指纹（可折叠查看） -->
                <div
                  v-if="analysisResultData.languageStyle"
                  class="confirm-field"
                >
                  <label
                    style="cursor:pointer;font-size:11px;"
                    @click="showLanguageStyleDetail = !showLanguageStyleDetail"
                  >
                    🔍 语言风格指纹 {{ showLanguageStyleDetail ? '▼' : '▶' }}
                  </label>
                  <div
                    v-if="showLanguageStyleDetail"
                    style="font-size:10px;color:#555;background:var(--bg-card);padding:6px;border-radius:4px;margin-top:3px;"
                  >
                    <div v-if="analysisResultData.languageStyle.avgSentenceLength">
                      平均句长：{{ analysisResultData.languageStyle.avgSentenceLength }}字
                    </div>
                    <div v-if="analysisResultData.languageStyle.commonPatterns?.length">
                      高频句式：{{ analysisResultData.languageStyle.commonPatterns.join('、') }}
                    </div>
                    <div v-if="analysisResultData.languageStyle.connectors?.length">
                      连接词：{{ analysisResultData.languageStyle.connectors.join('、') }}
                    </div>
                    <div v-if="analysisResultData.languageStyle.contextIntro">
                      情境引入：{{ analysisResultData.languageStyle.contextIntro }}
                    </div>
                    <div v-if="analysisResultData.languageStyle.personReference">
                      指代方式：{{ analysisResultData.languageStyle.personReference }}
                    </div>
                    <div v-if="analysisResultData.languageStyle.tone">
                      语气：{{ analysisResultData.languageStyle.tone }}
                    </div>
                    <div v-if="analysisResultData.languageStyle.sampleSentence">
                      典型句式：「{{ analysisResultData.languageStyle.sampleSentence }}」
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- ✅ 固定底部：操作按钮 -->
        <div style="flex-shrink: 0; margin-top:10px; padding-top:10px; border-top:1px solid var(--border-light);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <button
              class="btn btn-delete"
              style="font-size:11px;padding:4px 10px;"
              @click="discardAnalysisResult"
            >
              🗑️ 丢弃分析结果
            </button>
            <div
              class="modal-actions"
              style="display:flex;gap:8px;"
            >
              <button
                class="btn"
                @click="openAnalysisPDFPreview"
              >
                📄 打开PDF对照
              </button>
              <button
                class="btn"
                @click="showAnalysisResultModal = false"
              >
                稍后处理
              </button>
              <button
                class="btn-primary"
                @click="confirmAnalysisResult"
              >
                💾 确认保存
              </button>
            </div>
          </div>
        </div>
        
        <!-- 🔧 右下角调整大小手柄 -->
        <div 
          style="position:absolute; right:0; bottom:0; width:20px; height:20px; cursor:nwse-resize; z-index:10;"
          title="拖动调整大小"
          @mousedown="startAnalysisResultResize"
        >
          <div style="position:absolute; right:3px; bottom:3px; width:10px; height:10px; border-right:2px solid var(--text-muted); border-bottom:2px solid var(--text-muted);" />
        </div>
      </div>
    </div>

    <!-- 🔧 新增：PDF对照浮窗 -->
    <div
      v-if="showAnalysisPDF" 
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
      }"
    >
      <div 
        style="display:flex; justify-content:space-between; align-items:center; padding:6px 12px; background:var(--primary); color:white; cursor:move; user-select:none; flex-shrink:0;" 
        @mousedown="startAnalysisPDFDrag"
      >
        <span style="font-size:13px;">📖 PDF 对照</span>
        <div style="display:flex; gap:6px; align-items:center;">
          <button
            style="background:rgba(255,255,255,0.2); border:none; color:white; cursor:pointer; padding:3px 8px; border-radius:4px; font-size:12px;"
            @click="analysisPDFPage = Math.max(1, analysisPDFPage - 1)"
          >
            ◀
          </button>
          <span style="font-size:12px;">第 {{ analysisPDFPage }} 页</span>
          <button
            style="background:rgba(255,255,255,0.2); border:none; color:white; cursor:pointer; padding:3px 8px; border-radius:4px; font-size:12px;"
            @click="analysisPDFPage = analysisPDFPage + 1"
          >
            ▶
          </button>
          <button
            style="background:none; border:none; color:white; cursor:pointer; font-size:18px; margin-left:4px;"
            @click="showAnalysisPDF = false"
          >
            ✕
          </button>
        </div>
      </div>
      <div style="flex:1; min-height:0;">
        <PdfPreview
          :pdf-path="analysisPDFPath"
          :page="analysisPDFPage"
          :large-file="true"
        />
      </div>
      <div 
        style="position:absolute; right:0; bottom:0; width:20px; height:20px; cursor:nwse-resize; z-index:10;"
        title="拖动调整大小"
        @mousedown="startAnalysisPDFResize"
      >
        <div style="position:absolute; right:3px; bottom:3px; width:10px; height:10px; border-right:2px solid var(--text-muted); border-bottom:2px solid var(--text-muted);" />
      </div>
    </div>    

    <!-- 🔧 新增：多栏分割预览弹窗 -->
    <div
      v-if="showColumnSplitModal"
      class="modal-mask"
      @click.self="showColumnSplitModal = false"
    >
      <div
        class="modal large-modal column-split-modal"
        style="max-width: 1100px; width: 96%; display: flex; flex-direction: column;"
      >
        <!-- ✅ 固定头部：标题 + 翻页导航 -->
        <div style="flex-shrink: 0;">
          <h3>📐 多栏分割预览与调整</h3>
          
          <!-- 🔧 新增：翻页导航 -->
          <div
            v-if="columnSplitAllPages && columnSplitAllPages.length > 1"
            style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 14px;background:#f0f7ff;border-radius:8px;"
          >
            <button
              class="btn-small"
              :disabled="columnSplitCurrentPage <= 0"
              @click="goToSplitPage(columnSplitCurrentPage - 1)"
            >
              ◀ 上一页
            </button>
            <span style="font-size:13px;font-weight:600;color:var(--primary);">
              第 {{ columnSplitCurrentPage + 1 }} / {{ columnSplitAllPages.length }} 页
            </span>
            <button
              class="btn-small"
              :disabled="columnSplitCurrentPage >= columnSplitAllPages.length - 1"
              @click="goToSplitPage(columnSplitCurrentPage + 1)"
            >
              下一页 ▶
            </button>
            
            <!-- 各页状态指示 -->
            <div style="display:flex;gap:4px;margin-left:8px;">
              <span 
                v-for="(page, pIdx) in columnSplitAllPages" 
                :key="'page-dot-' + pIdx"
                :title="'第' + page.page + '页' + (page._skipSplit ? ' ⏩整页OCR' : page._confirmed ? ' ✅已确认' : ' ⚠️待确认')"
                style="cursor:pointer;width:12px;height:12px;border-radius:50%;display:inline-block;"
                :style="{
                  background: pIdx === columnSplitCurrentPage ? 'var(--primary-light)' : page._skipSplit ? '#f0a030' : page._confirmed ? 'var(--success)' : 'var(--border-light)',
                  border: pIdx === columnSplitCurrentPage ? '2px solid var(--primary)' : '2px solid transparent'
                }"
                @click="goToSplitPage(pIdx)"
              />
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
          <div
            ref="columnSplitPreviewRef"
            class="column-split-preview"
          >
            <!-- 原图容器 -->
            <div
              ref="splitCanvasContainer"
              class="split-canvas-container"
            >
              <img 
                v-if="columnSplitOriginBase64" 
                ref="splitOriginImage" 
                :src="'data:image/jpeg;base64,' + columnSplitOriginBase64"
                class="split-origin-image"
                @load="onSplitImageLoaded"
              >
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
                  title="删除此切割线" 
                  @click.stop="removeSplitLine(idx)"
                >
                  🗑️
                </button>
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
              <button
                class="add-split-line-btn"
                title="在中间位置添加切割线"
                @click="addSplitLine"
              >
                ➕ 添加切割线
              </button>
            </div>
          </div>

          <!-- 子图预览（切割后的各栏） -->
          <div
            v-if="columnSplitPreviewCols.length > 0"
            style="margin-top:16px;"
          >
            <h4 style="color:var(--primary);margin-bottom:8px;">
              📷 切割后的各栏预览：
              <span
                v-if="columnSplitConfirmed"
                style="color:var(--success);"
              >✅ 已确认切割</span>
              <span
                v-else
                style="color:var(--warning);"
              >⚠️ 请先点击下方「预览切割效果」</span>
            </h4>
            <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;">
              <div 
                v-for="(col, idx) in columnSplitPreviewCols" 
                :key="'sub-preview-' + idx"
                style="flex-shrink:0;text-align:center;border:1px solid var(--border-light);border-radius:8px;padding:8px;background:var(--bg-card);"
              >
                <div style="font-weight:600;font-size:12px;color:var(--primary);margin-bottom:4px;">
                  第{{ idx + 1 }}栏
                </div>
                <img 
                  v-if="col.subBase64" 
                  :src="'data:image/jpeg;base64,' + col.subBase64" 
                  style="max-height:250px;max-width:250px;border-radius:4px;"
                >
                <div
                  v-else
                  style="width:200px;height:150px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#ccc;"
                >
                  {{ columnSplitConfirmed ? '加载中...' : '待切割' }}
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                  {{ col.xRange }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- ✅ 固定底部：操作按钮 -->
        <div
          class="modal-actions"
          style="flex-shrink: 0; margin-top:16px; padding-top:12px; border-top:1px solid var(--border-light);"
        >
          <button
            class="btn"
            @click="resetSplitLines"
          >
            🔄 重置为自动检测
          </button>
          <button
            v-if="!columnSplitConfirmed"
            class="btn"
            @click="previewColumnSplit"
          >
            👁️ 预览切割效果
          </button>
          <button
            v-if="!columnSplitConfirmed"
            class="btn btn-success"
            :disabled="columnSplitLines.length === 0"
            @click="confirmCurrentPage"
          >
            ✅ 确认本页切割
          </button>
          <button
            v-if="!columnSplitConfirmed"
            class="btn-warning"
            title="不切割此页，直接对整页图片做 OCR 识别"
            @click="skipSplitForCurrentPage"
          >
            ⏩ 不切割，整页OCR
          </button>
          <button
            v-if="columnSplitConfirmed"
            class="btn"
            @click="previewColumnSplit"
          >
            🔄 重新预览
          </button>
          <span
            v-if="columnSplitConfirmed && columnSplitSkip"
            style="color:#f0a030;font-weight:600;margin:0 12px;"
          >⏩ 本页将整页OCR（不切割）</span>
          <span
            v-else-if="columnSplitConfirmed"
            style="color:var(--success);font-weight:600;margin:0 12px;"
          >✅ 本页切割已确认</span>
          <button
            class="btn btn-cancel"
            style="margin-right:auto;"
            @click="cancelAllColumnSplit"
          >
            ❌ 全部取消
          </button>
          <button
            class="btn-primary"
            :disabled="!allPagesConfirmed"
            @click="finishAllColumnSplit"
          >
            ✅ 全部确认并提取原文 ({{ confirmedPageCount }}/{{ columnSplitAllPages?.length || 0 }})
          </button>
        </div>
      </div>
    </div>

    <!-- 🔧 重构：查看/编辑章节分析弹窗（左右两栏） -->
    <div
      v-if="showChapterAnalysisModal"
      class="modal-mask"
      @click.self="showChapterAnalysisModal = false"
    >
      <div
        ref="chapterAnalysisModalRef"
        class="modal draggable-modal"
        style="max-width: 1000px; width: 90%; display: flex; flex-direction: column;"
      >
        <div
          class="modal-drag-handle"
          @mousedown="startChapterDrag($event)"
        >
          📊 章节分析详情
        </div>
        <div style="flex-shrink: 0; padding: 8px 0;">
          <h3>📊 {{ viewingBook?.name }} - {{ viewingChapter?.title }}</h3>
        </div>
        <div style="flex: 1; overflow-y: auto; min-height: 0;">
          <div
            v-if="viewingChapter"
            class="chapter-analysis-two-columns"
          >
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
              <textarea
                v-else
                v-model="viewingChapter.rawText"
                rows="18" 
                style="width:100%;font-size:12px;padding:8px;border:1px solid #ddd;border-radius:6px;resize:vertical;overflow:auto;font-family:inherit;box-sizing:border-box;"
              />
            </div>
            <!-- 右栏：分析字段 -->
            <div class="chapter-analysis-right">
              <template v-if="viewingChapter._tplAnalysis">
                <!-- ✅ 模板分析结果 - 只读显示 -->
                <div class="detail-item">
                  <strong>📋 结构分析：</strong>
                  <div
                    v-for="(section, si) in (viewingChapter._tplAnalysis.结构分析 || viewingChapter._tplAnalysis.structure || [])"
                    :key="si"
                    style="font-size:12px;color:#555;line-height:1.8;margin-bottom:6px;border-bottom:1px dashed var(--border-light);padding-bottom:4px;"
                  >
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
                  <input
                    v-model="viewingChapter.coreTopics"
                    type="text" 
                    style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;"
                  >
                </div>
                <div
                  v-if="viewingChapter.visualDescription"
                  class="detail-item"
                >
                  <strong>🖼️ 图表描述：</strong>
                  <input
                    v-model="viewingChapter.visualDescription"
                    type="text" 
                    style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;"
                  >
                </div>
                <div
                  v-if="viewingChapter.formulas && viewingChapter.formulas.length > 0"
                  class="detail-item"
                >
                  <strong>📐 公式：</strong>
                  <textarea
                    v-model="viewingChapter.formulasText"
                    rows="3"
                    style="width:100%;font-size:12px;padding:8px;border:1px solid #ddd;border-radius:6px;resize:vertical;font-family:inherit;box-sizing:border-box;"
                    placeholder="每行一个公式"
                  />
                </div>
                <div
                  v-if="viewingChapter.knowledgePoints && viewingChapter.knowledgePoints.length > 0"
                  class="detail-item"
                >
                  <strong>📍 知识点：</strong>
                  <textarea
                    v-model="viewingChapter.knowledgePointsText"
                    rows="4"
                    style="width:100%;font-size:12px;padding:8px;border:1px solid #ddd;border-radius:6px;resize:vertical;font-family:inherit;box-sizing:border-box;"
                    placeholder="每行一个知识点"
                  />
                </div>
                
                <!-- 🔧 新增字段 - 只读显示，根据分析结果显示 -->
                <div
                  v-if="viewingChapter.knowledgeHierarchy && viewingChapter.knowledgeHierarchy.length > 0"
                  class="detail-item"
                >
                  <strong>🎯 知识层级：</strong>
                  <div style="margin-top:8px;background:#f8f9fa;padding:10px;border-radius:6px;max-height:200px;overflow-y:auto;">
                    <div
                      v-for="(bc, bcIdx) in viewingChapter.knowledgeHierarchy"
                      :key="bcIdx" 
                      style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border-light);"
                    >
                      <div style="font-size:13px;color:var(--primary-light);font-weight:600;margin-bottom:6px;">
                        {{ bcIdx + 1 }}. {{ bc.bigConcept || '未命名大概念' }}
                      </div>
                      
                      <div
                        v-for="(ck, ckIdx) in (bc.coreKnowledge || [])"
                        :key="ckIdx" 
                        style="margin-left:16px;margin-bottom:6px;"
                      >
                        <div style="font-size:12px;font-weight:600;color:#34495e;">
                          {{ ckIdx + 1 }}. {{ ck.name || ck.coreConcept || '未命名核心知识' }}
                          <span
                            v-if="ck.level"
                            style="margin-left:8px;padding:2px 6px;background:#3498db;color:white;border-radius:3px;font-size:10px;"
                          >{{ ck.level }}</span>
                        </div>
                        <div
                          v-if="ck.specificConcepts && ck.specificConcepts.length > 0" 
                          style="font-size:11px;color:#666;margin-left:16px;margin-top:2px;"
                        >
                          具体概念：{{ ck.specificConcepts.join('、') }}
                        </div>
                        <div
                          v-if="ck.suggestedQuestionTypes && ck.suggestedQuestionTypes.length > 0" 
                          style="font-size:11px;color:var(--text-muted);margin-left:16px;margin-top:2px;"
                        >
                          建议题型：{{ ck.suggestedQuestionTypes.join('、') }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div
                  v-if="viewingChapter.competency"
                  class="detail-item"
                >
                  <strong>🎓 能力层次：</strong>
                  <div style="padding:6px 10px;background:#f8f9fa;border-radius:6px;font-size:13px;color:#555;">
                    {{ viewingChapter.competency }}
                  </div>
                </div>
                
                <div
                  v-if="viewingChapter.style"
                  class="detail-item"
                >
                  <strong>🎨 风格：</strong>
                  <div style="padding:6px 10px;background:#f8f9fa;border-radius:6px;font-size:13px;color:#555;">
                    {{ viewingChapter.style }}
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
        <div
          class="analysis-footer"
          style="flex-shrink: 0; display:flex; justify-content:space-between; align-items:center; margin-top:16px;"
        >
          <button
            class="btn btn-delete hide-on-mobile"
            style="font-size:11px;padding:4px 10px;"
            @click="discardSingleChapterAnalysis"
          >
            🗑️ 丢弃分析
          </button>
          <div class="modal-actions">
            <button
              class="btn"
              @click="showChapterAnalysisModal = false"
            >
              取消
            </button>
            <button
              class="btn-primary"
              @click="saveChapterAnalysis"
            >
              <span class="icon-desktop">💾</span><span class="icon-mobile">✅</span> 保存
            </button>
          </div>
        </div>
      </div>
    </div>


    <!-- 知识点提取弹窗 -->
    <div
      v-if="showKnowledgeModal"
      class="modal-mask"
      @click.self="showKnowledgeModal = false"
    >
      <div class="modal">
        <h3>📖 知识点管理</h3>
        <p><strong>{{ currentBook?.name }} - {{ currentChapter?.title }}</strong></p>
        <div class="form-group">
          <label>知识点（每行一个）</label>
          <textarea
            v-model="editingKnowledge"
            rows="8"
            placeholder="输入知识点，每行一个"
          />
        </div>
        <div class="modal-actions">
          <button
            class="btn"
            @click="copyKnowledgePoints"
          >
            📋 复制全部
          </button>
          <button
            class="btn"
            @click="exportKnowledgePoints"
          >
            📤 导出TXT
          </button>
          <button
            class="btn"
            @click="showKnowledgeModal = false"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="saveKnowledge"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick, h } from 'vue';
import { useDialog } from '../composables/useDialog.js';
import { useMobile } from '../composables/useMobile.js';
import { useWakeLock } from '../composables/useWakeLock.js';
import { apiConfig, getCurrentEngineConfig, getCurrentEngineConfigEnhanced, getDeepSeekPricingPeriod } from '../config/apiConfig.js';  // 🔧 新增：导入 apiConfig
import { getStoragePath } from '../utils/pathHelper.js';  // ✨ 存储路径工具
import { 
  styleOptions,
  styleInstructions,
  styleOptionsForType,
  DEFAULT_STYLE_BY_TYPE,
  isStyleRequiredForType,
  STYLE_GROUP,
  genTypeOptions,
  genTypeTemplates,
  scopeOptions,
  granularityOptions,
  normalizeSubjectName
} from '../config/expertKnowledge.js';
import { useAiGenerator } from '../composables/useAiGenerator.js';
import { extractGradeNum, resolveStageKey } from '../utils/gradeStage.js';
import { inferPaperScope, buildScopeCandidates, inferAcademicTerm, buildPaperTitle, applyPaperTitleToContent, SCOPE_LABEL_POOLS } from '../config/paperScope.js';

// 📐 范围类型与自动判定的中文标签（用于"生成方案"摘要回显）
const SCOPE_TYPE_LABELS = { default: '默认', midterm: '期中', final: '期末', monthly: '月考', topic: '专题' };
const SCOPE_BASIS = {
  lesson: '单课',
  unit: '整个单元（目录全勾选）',
  midterm: '跨前段单元·自动判定为期中',
  final: '跨至书末单元·自动判定为期末',
  default: '跨单元中段·综合检测',
  monthly: '月考',
  topic: '专题',
};
import { createDefaultSectionProperties, getPrintCss, convertFormulasInHtml, parseMarkdownToTextRuns } from '../utils/wordExporter.js';
import { htmlToDocxBlob } from '../utils/docxBuilder.js';
import { GEN_CONST } from '../config/generationConstants.js';
import storage from '../utils/storage';
import { normalizeSealStructure, wrapContentForTheme, applyThemeToContent } from '../themeConfig.js';  // 🔧 密封线结构归一化 + 试卷主题包装（导出与排版模块一致）
import { pushDeletedDocIds } from '../utils/cloudStorage';
import { compressDocArray, decompressDocArray } from '../utils/contentCompress.js';
import { useTextbookStore } from '../stores/textbookStore';
import { useTemplateStore } from '../stores/templateStore.js';
import { EXAM_REGION_OPTIONS } from '../config/examRegionConfig.js';
import { findBlueprint } from '../config/blueprintProvider.js';
import { getPromptTemplate, buildInjectionInstruction, buildStructureText, buildOutputFormatHint, getCurriculumLabel } from '../config/promptLibrary.js';
import { buildRenderContract, needsImageHint } from '../config/eduRenderContract.js';
import { buildValidatorPrompt } from '../config/validatorRules.js';
import { buildTeachingInjection } from '../config/teachingBlueprints.js';
import { APP_EVENTS } from '../constants/events.js';
import PdfPreview from '../components/PdfPreview.vue';
import RichTextEditor from '../components/RichTextEditor.vue';  // 🔧 新增：富文本编辑器
import { normalizeRubyTags } from '../utils/rubyNormalizer.js';
import { stripXss, stripAiCodeFence } from '../utils/contentCleaner.js';  // 🔧 XSS 剥离 + AI 代码块/对话残留剥离（导出端第二道防线共享）

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
const scopeOverride = ref('');  // 🔧 范围确认弹窗后用户选定的范围名（优先于自动推断）
const mergeChapters = ref(true);  // 🔧 多章节合并出卷开关（默认合并；false=逐章拆分）
/** 🔧 生成前分值微调（本次生效，不落库、不动内置/用户蓝本；键=学科|学段，值={大题名:分值}） */
const scoreAdjust = ref({});
const currentDimKey = () => {
  const book = textbookStore.textbooks.find((b) => hasAnySelected(b.outline));
  if (!book) return '';
  const st = resolveStageKey(book.stage, book.grade, book.name);
  const subject = normalizeSubjectName(book.subject, st);
  return `${subject}|${st}`;
};
const applyScoreAdjust = (bp) => {
  const adj = scoreAdjust.value[currentDimKey()];
  if (!adj || !bp?.sections?.length) return bp;
  return { ...bp, sections: bp.sections.map((s) => (adj[s.name] != null ? { ...s, score: adj[s.name] } : s)) };
};
const propositionStyle = ref('');
const styleManuallySet = ref(false);  // 🔴 追踪用户是否手动选过命题风格——false 时切换 genType 自动覆盖
const styleConfirmed = ref(false);    // 🔴 必选风格是否已确认（生成前弹窗确认；换类型时重置）
const genTypes = ref([]);
// 🔴 新架构：生成前置条件 = 已选教材章节（不再依赖指令文本）
const hasSelectedChapters = computed(() => textbookStore.selectedChapterCount > 0);
const specialSubType = ref('');  // 🎯 专项子类型（仅 genType=special 时生效）
const generateGranularity = ref('');
const totalScore = ref('');
const allowOriginalQuestions = ref(true);
const batchCount = ref(1);  // 同类型一次生成份数，默认1
// 🔧 省市差异化：正式试卷（exam）按省市取考试时长/总分（如江苏中考语数英150分、北京100分制），默认全国通用
const examRegion = ref('');
const examRegionOptions = EXAM_REGION_OPTIONS;
// 🔧 题型配置默认空，由用户手动添加（题型分布库已退役：蓝本为题型权威）
const questionTypes = ref([]);
const difficultyLevels = ref([
  { name: '基础题', selected: true, percentage: null },
  { name: '中档题', selected: true, percentage: null },
  { name: '提高题', selected: true, percentage: null }
]);

// 命题范围命名统一由 paperScope.inferPaperScope 处理（选课→课名、整单元→单元名、跨单元/期中/期末/月考/专题→标签词）

// ✏️ 名称样式选择（方案二）：默认自动轮换，可选池中固定名称（用户记不住池子里的名称，下拉直接展示）
const showLabelStyleModal = ref(false);
const labelStyle = ref('');  // ''=自动轮换，否则为池中固定名称
const LABEL_STYLE_STORAGE_KEY = 'ww_label_style_v1';
const loadLabelStyle = (genType) => {
  try {
    const map = JSON.parse(localStorage.getItem(LABEL_STYLE_STORAGE_KEY) || '{}');
    return map[genType] || '';
  } catch { return ''; }
};
const labelStyleOptions = computed(() => {
  const type = genTypes.value[0];
  const autoOpt = { value: '', label: '🔄 自动轮换（推荐）', desc: '按名称池轮流使用，标题不重复' };
  if (!type) return [autoOpt];
  return [autoOpt, ...(getLabelPool(type) || []).map(n => ({ value: n, label: n, desc: '固定使用该名称作为标题' }))];
});
const labelStyleLabel = computed(() => labelStyle.value || '自动轮换');

/* 📐 考试标签维度固定选择（名称样式弹窗：每维度 自动轮换 / 固定某个名称；与资料类型名称样式同理） */
const scopeLabelStyle = ref({ midterm: '', final: '', monthly: '', default: '', topic: '' }); // '' = 自动轮换
const SCOPE_STYLE_KEY = 'wisdom_scope_label_style_v1';
const scopeDims = computed(() => [
  { type: 'midterm', label: '期中', pool: SCOPE_LABEL_POOLS.midterm },
  { type: 'final', label: '期末', pool: SCOPE_LABEL_POOLS.final },
  { type: 'monthly', label: '月考', pool: SCOPE_LABEL_POOLS.monthly },
  { type: 'default', label: '综合', pool: SCOPE_LABEL_POOLS.default },
]);
const loadScopeLabelStyle = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SCOPE_STYLE_KEY) || '{}');
    Object.assign(scopeLabelStyle.value, saved);
  } catch {}
  for (const [t, l] of Object.entries(scopeLabelStyle.value)) setScopeLabelOverride(t, l || null);
};
const syncScopeLabelStyle = () => {
  for (const [t, l] of Object.entries(scopeLabelStyle.value)) setScopeLabelOverride(t, l || null);
  try { localStorage.setItem(SCOPE_STYLE_KEY, JSON.stringify(scopeLabelStyle.value)); } catch {}
};
watch(scopeLabelStyle, syncScopeLabelStyle, { deep: true });

/** ↩️ 一键清空所有名称固定选择（资料类型名称 + 考试标签各维度），全部恢复自动轮换 */
const resetNameStyles = () => {
  labelStyle.value = ''; // 资料类型名称 → 自动轮换（watch(labelStyle) 自动持久化并同步生成器）
  for (const t of Object.keys(scopeLabelStyle.value)) scopeLabelStyle.value[t] = ''; // 考试标签各维度 → 自动轮换
  syncScopeLabelStyle();
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
const pendingGenerateMode = ref('single'); // 生成模式
const pendingGenType = ref(null);          // 待生成的类型
const showKnowledgeModal = ref(false);

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

const clearAllUncertainMarks = async () => {
  if (!analysisResultData.value?.rawText) return;
  if (!uncertainPositions.value.length) return;
  const confirmed = await showConfirmDialogFn(`确定要清除全部 ${uncertainPositions.value.length} 个不确定标记吗？`);
  if (!confirmed) return;
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
          if (!subBase64 || subBase64.length < GEN_CONST.IMAGE_MIN_BASE64) continue;
          
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
          if (!colText || colText.trim().length < GEN_CONST.COL_MIN_TEXT) {
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

// 🔧 原文编辑器相关
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
// 🔧 指令是否为用户手动编辑过（多类型混合生成时：手动编辑的指令对全部类型共用；
//    自动组装（loadInstructionFromLibrary）则按每个类型重新匹配组装，防类型错位）
let userEditedInstruction = false;
// 🔴 指令来源记录（注入框展示：来自指令库哪条模板、按什么维度匹配）
const instructionSource = ref(null);
const injectSources = ref([]); // 本次注入来源清单（指令库/蓝图库/渲染契约/规则库）——面板可视化"读取应用了哪些库"
// 🔴 学段显示名（原 planner 导出，planner 已删除，本地定义）
const STAGE_LABEL_MAP = {
  primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段',
  middle: '初中', high: '高中',
};
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

// 🔧 使用 IndexedDB + content 压缩避免手机端配额溢出
const loadGeneratedDocs = async () => {
  try {
    const saved = await storage.getItem(STORAGE_KEY).catch(() => null);
    if (saved && Array.isArray(saved)) {
      // 📦 解压 content 字段（存量未压缩数据透传）
      const decompressed = decompressDocArray(saved);
      // 向后兼容：为旧数据补填 savedAt（修复前生成的结果缺少时间戳字段）
      let needsSave = false;
      for (const item of decompressed) {
        if (!item.savedAt) {
          item.savedAt = item.createdAt || extractTimestampFromId(item.id) || Date.now();
          needsSave = true;
        }
      }
      if (needsSave) {
        await storage.setItem(STORAGE_KEY, compressDocArray(decompressed)).catch(() => {});
        console.log('🩹 已为 ' + decompressed.length + ' 条旧生成结果补填 savedAt');
      }
      return decompressed;
    }
  } catch (e) { console.warn('加载生成记录失败:', e?.message || e); }
  return [];
};
const generatedDocs = ref([]);
// 🔧 异步加载：初始化完成前 UI 显示空列表，加载后自动更新
loadGeneratedDocs().then(docs => { if (docs.length > 0) generatedDocs.value = docs; });

// 显示用：反转数组，过滤 _deleted 标记，最新的在上面（存储保持升序以保证 slice(-20) 截断正确）
const displayedDocs = computed(() => {
  // 🔧 双通道口径一致：_deleted 标记 + deleted_docs 墓碑双重过滤（与 HistoryModule 加载一致，
  //    覆盖同步尚未清理墓碑记录前的展示窗口）
  let tombstoneIds = {};
  try { tombstoneIds = JSON.parse(localStorage.getItem('wisdom_deleted_gen_doc_ids') || '{}'); } catch {}
  return [...generatedDocs.value].filter(d => !d._deleted && !tombstoneIds[d.id]).reverse();
});
const saveGeneratedDocs = async () => {
  try {
    // 截断上限（不修改 ref，避免触发 watcher 递归）
    const docs = generatedDocs.value.length > 20
      ? generatedDocs.value.slice(-20)
      : generatedDocs.value;

    // 🔧 防御：如果 ref 为空但存储中已有数据，拒绝写入（防止意外清空）
    if (docs.length === 0) {
      try {
        const existing = await storage.getItem(STORAGE_KEY).catch(() => null);
        if (existing && Array.isArray(existing) && existing.length > 0) {
          console.warn('⚠️ 拒绝写入空数组：已有 ' + existing.length + ' 条数据（可能是重置误触发）');
          return;
        }
      } catch {}
    }

    // 持久化到 IndexedDB（压缩 content 减少 80% 体积）
    await storage.setItem(STORAGE_KEY, compressDocArray(docs)).catch(() => {});
    // 🧹 迁移后清理 localStorage 旧 key，释放配额空间
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  } catch (e) { console.warn('保存生成记录失败:', e?.message); }
};
const batchDownloadFormat = ref('word');
const teacherVersion = ref(true); // true=教师版（含答案）, false=学生版（无答案）

// 预览和编辑
const previewContent = ref('');

// 🖼️ [IMAGE] 标记 → 可视化配图占位框：AI 输出画面描述（PROMPT），用户用生图工具生成后替换此框插入图片
//    避用正则与转义字符（历史教训：构建链路曾破坏转义序列），全部用 indexOf/split 处理
const renderImagePlaceholders = (html) => {
  if (!html || typeof html !== 'string') return html;
  const NL = String.fromCharCode(10);
  const esc = (s) => String(s == null ? '' : s)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;');
  // 提取字段标记后的第一行值（如 PROMPT / TYPE:ICON / KEYWORDS）
  const fieldVal = (body, name) => {
    const idx = body.indexOf(name);
    if (idx === -1) return '';
    let v = body.slice(idx + name.length).split(NL)[0].trim();
    if (v.charAt(0) === ':' || v.charAt(0) === '：') v = v.slice(1).trim();
    return v;
  };
  // 🔧 占位框构建（正常闭合与未闭合兜底共用）：data-image-raw 保存标准化 [IMAGE]…[/IMAGE] 标记，
  //    导出 DOCX 时还原为标准标记；普通配图仅画面描述（不指定生图引擎），ICON 图标检索保留 TYPE/KEYWORDS
  const buildBox = (prompt, imgType, keywords) => {
    const isIcon = imgType === 'ICON';
    const rawMark = esc(isIcon
      ? '[IMAGE]' + NL + 'TYPE:ICON' + NL + 'KEYWORDS:' + (keywords || prompt) + NL + '[/IMAGE]'
      : '[IMAGE]' + NL + 'PROMPT:' + prompt + NL + '[/IMAGE]').split('"').join('&quot;');
    let box = '<div class="image-placeholder" data-image-raw="' + rawMark + '" style="text-align:left;padding:12px 14px;margin:12px 0;background:#f7f9fc;border:1px dashed #a0b4d0;border-radius:6px;color:#44608a;font-size:13px;line-height:1.7;">'
      + '<strong>[插图占位]</strong><br>'
      + (isIcon ? '图标检索: ' + esc(keywords || prompt) : 'PROMPT: <span style="color:#5c6bc0;">' + esc(prompt) + '</span>')
      + '<br><span style="font-size:12px;color:#8899b0;">' + (isIcon ? '替换为检索到的图标图片' : '复制 PROMPT 到生图工具生成图片后插入此处') + '</span></div>';
    return box;
  };
  const out = [];
  let rest = html;
  while (true) {
    const s = rest.indexOf('[IMAGE]');
    if (s === -1) { out.push(rest); break; }
    out.push(rest.slice(0, s));
    const bodyStart = s + 7;
    const e = rest.indexOf('[/IMAGE]', bodyStart);
    if (e === -1) {
      // 🔴 未闭合兜底：模型漏写 [/IMAGE] 时，取标记后到行尾的内容作为画面描述，强制转占位框，
      //    杜绝 [IMAGE] 指令原文泄漏进正文/导出（此前直接透传原文）
      const nl = rest.indexOf(NL, bodyStart);
      const partial = (nl === -1 ? rest.slice(bodyStart) : rest.slice(bodyStart, nl)).trim();
      const prompt = partial
        .replace(/^PROMPT[：:]?\s*/i, '')
        .replace(/^描述[：:]\s*/, '')
        .replace(/^TYPE:SD\s*/i, '')
        .trim() || '画面描述缺失（未闭合）';
      out.push(buildBox(prompt, '', ''));
      rest = nl === -1 ? '' : rest.slice(nl + 1);
      continue;
    }
    const body = rest.slice(bodyStart, e);
    let prompt = fieldVal(body, 'PROMPT');
    if (!prompt) {
      const dIdx = body.indexOf('描述');
      if (dIdx !== -1) { prompt = body.slice(dIdx + 2).split(NL)[0].trim(); }
    }
    if (!prompt) {
      const lines = body.split(NL).filter(Boolean);
      prompt = lines.length ? lines[lines.length - 1].trim() : '';
    }
    if (prompt.charAt(0) === ':' || prompt.charAt(0) === '：') prompt = prompt.slice(1).trim();
    const imgType = (fieldVal(body, 'TYPE') || '').toUpperCase();
    const keywords = fieldVal(body, 'KEYWORDS') || fieldVal(body, '关键词');
    out.push(buildBox(prompt, imgType, keywords));
    rest = rest.slice(e + 8);
  }
  // 📊 [GRAPH] 标记 → 可视化图形占位框：AI 输出的图形（数轴/函数/几何/统计/受力/电路/光路/原子）契约，
  //    渲染端不直接绘制矢量图，故转换为占位框并在导出时输出"图形位置"提示（与 [IMAGE] 同模式，杜绝指令原文泄漏）
  //    标准格式（见 eduRenderContract GRAPH_SAMPLE_*）：[GRAPH] TYPE:XX DESC:...（或 描述:...）[/GRAPH]
  {
    const escGraph = (s) => String(s == null ? '' : s)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;');
    const out2 = [];
    let rest2 = html;
    const GRAPH_TAG = '[GRAPH]';
    const GRAPH_END = '[/GRAPH]';
    while (true) {
      const gs = rest2.indexOf(GRAPH_TAG);
      if (gs === -1) { out2.push(rest2); break; }
      out2.push(rest2.slice(0, gs));
      const bodyStart = gs + GRAPH_TAG.length;
      const ge = rest2.indexOf(GRAPH_END, bodyStart);
      if (ge === -1) {
        // 未闭合兜底：取标记后到行尾内容作为描述，强制转占位框
        const nl = rest2.indexOf(NL, bodyStart);
        const partial = (nl === -1 ? rest2.slice(bodyStart) : rest2.slice(bodyStart, nl)).trim()
          .replace(/^TYPE[：:]?\s*[A-Z_]+/i, '')
          .replace(/^DESC[：:]\s*/i, '')
          .replace(/^描述[：:]\s*/, '')
          .trim() || '图形描述缺失（未闭合）';
        const rawMark = escGraph('[GRAPH]' + NL + 'TYPE:COORDINATE' + NL + 'DESC:' + partial + NL + '[/GRAPH]');
        out2.push('<div class="graph-placeholder" data-graph-raw="' + rawMark + '" style="text-align:left;padding:12px 14px;margin:12px 0;background:#f0f6fb;border:1px dashed #8fb4d8;border-radius:6px;color:#3a6a9e;font-size:13px;line-height:1.7;">'
          + '<strong>[图形占位]</strong><br>'
          + 'DESC: <span style="color:#5c6bc0;">' + escGraph(partial) + '</span>'
          + '<br><span style="font-size:12px;color:#8899b0;">复制到 EduRender 生成图形后插入此处</span></div>');
        rest2 = nl === -1 ? '' : rest2.slice(nl + 1);
        continue;
      }
      const body = rest2.slice(bodyStart, ge);
      const typeMatch = body.match(/TYPE[：:]\s*([A-Z_]+)/i);
      const typeText = typeMatch ? typeMatch[1].trim().toUpperCase() : '图形';
      let descText = '';
      const dIdx = body.indexOf('DESC');
      if (dIdx !== -1) descText = body.slice(dIdx + 4).split(NL)[0].trim().replace(/^[：:]\s*/, '');
      if (!descText) {
        const cIdx = body.indexOf('描述');
        if (cIdx !== -1) descText = body.slice(cIdx + 2).split(NL)[0].trim().replace(/^[：:]\s*/, '');
      }
      if (descText.charAt(0) === ':' || descText.charAt(0) === '：') descText = descText.slice(1).trim();
      const rawMark = escGraph('[GRAPH]' + NL + 'TYPE:' + (typeMatch ? typeText : 'COORDINATE') + NL + 'DESC:' + (descText || '（无描述）') + NL + '[/GRAPH]');
      out2.push('<div class="graph-placeholder" data-graph-raw="' + rawMark + '" style="text-align:left;padding:12px 14px;margin:12px 0;background:#f0f6fb;border:1px dashed #8fb4d8;border-radius:6px;color:#3a6a9e;font-size:13px;line-height:1.7;">'
        + '<strong>[图形占位]</strong><br>'
        + (typeMatch ? 'TYPE: <span style="color:#3a6a9e;font-weight:600;">' + escGraph(typeText) + '</span><br>' : '')
        + 'DESC: <span style="color:#5c6bc0;">' + escGraph(descText || '（无描述）') + '</span>'
        + '<br><span style="font-size:12px;color:#8899b0;">复制到 EduRender 生成图形后插入此处</span></div>');
      rest2 = rest2.slice(ge + GRAPH_END.length);
    }
    return out2.join('');
  }
};
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

// 知识点
const currentBook = ref(null);
const currentChapter = ref(null);
const editingKnowledge = ref('');

// AI生成器（新架构：不再使用 buildGenerationInstruction 长指令构建）
const { isGenerating, progress: generateProgress, statusText: generateStatus, generate: callGenerate, setPerChapterFilter, cancelGeneration: cancelGen, extractGraphs, analyzeTextbookImage, analyzeTextbookWithText, analyzeTemplateImage, analyzeTemplateImageFull, extractKnowledgePoints, generateQuestionVariant, callMultimodalAI, extractTextRobustly, extractChapterTextSequentially, detectMultiColumnPages, postProcessOCR, abortController, smartWait, checkModelReady, smartWaitForModel, setLabelOverride, getLabelPool, pickLabelFromPool, pickScopeFromPool, setScopeLabelOverride } = useAiGenerator();

// ✏️ 名称样式：类型切换恢复上次选择 + 当前选择同步到生成器（在 useAiGenerator 解构之后，避免 TDZ）
watch(genTypes, () => {
  const type = genTypes.value[0];
  labelStyle.value = type ? loadLabelStyle(type) : '';
  // 🔧 组织风格按类型映射（收敛方案）：换类型时——当前风格不适用则该类型默认风格并重置手动标记；
  //    必选确认标记重置（需重新确认）
  if (type) {
    const applicable = styleOptionsForType(type).options.map((o) => o.value);
    if (!applicable.includes(propositionStyle.value)) {
      propositionStyle.value = DEFAULT_STYLE_BY_TYPE[type] || '';
      styleManuallySet.value = false;
      console.log(`[style] 自动设置默认组织风格: ${propositionStyle.value || '(免选)'} (genType=${type})`);
    }
    styleConfirmed.value = false;
  }
});
watch(labelStyle, () => {
  const type = genTypes.value[0];
  if (!type) return;
  setLabelOverride(type, labelStyle.value || null);
  try {
    const map = JSON.parse(localStorage.getItem(LABEL_STYLE_STORAGE_KEY) || '{}');
    map[type] = labelStyle.value || '';
    localStorage.setItem(LABEL_STYLE_STORAGE_KEY, JSON.stringify(map));
  } catch { /* 忽略存储异常 */ }
}, { immediate: true });

// 🔒 屏幕唤醒锁：生成期间防止自动息屏导致 API 请求中断
const wakeLock = useWakeLock();
watch(isGenerating, async (val) => {
  if (val) {
    await wakeLock.request();
  } else {
    wakeLock.release();
  }
});

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
const styleLabel = computed(() => {
  if (!propositionStyle.value) return '组织风格';
  const opt = styleOptions.find(o => o.value === propositionStyle.value);
  if (!opt) return '组织风格';
  return styleManuallySet.value ? opt.label : `${opt.label}(自动)`;
});
const restoreAutoStyle = () => {
  styleManuallySet.value = false;
  const type = genTypes.value[0];
  if (type) {
    // 🔧 恢复自动 = 按类型默认风格（DEFAULT_STYLE_BY_TYPE 唯一源）；
    //    旧代码硬编码 'context_fusion'（已删除的旧风格值）→ styleInstructions 无此键 → withStyle 静默跳过 → 风格失效
    propositionStyle.value = DEFAULT_STYLE_BY_TYPE[type] || '';
    console.log(`[propositionStyle] 恢复自动匹配: ${propositionStyle.value || '(免选)'} (genType=${type})`);
  }
  showStyleModal.value = false;
};
/** 当前类型应显示的风格组（命题/呈现）与选项 */
const styleOptsForCurrent = computed(() => styleOptionsForType(genTypes.value[0]));
/** 当前类型是否需要必选风格确认 */
const styleRequiredForCurrent = computed(() => genTypes.value.some((t) => isStyleRequiredForType(t)));
/** 全部风格分组展示（当前类型不适用的置灰，标注适用类型） */
const styleGroupOptions = (group) => {
  const cur = genTypes.value[0] || '';
  return styleOptions
    .filter((o) => o.group === group)
    .map((o) => ({
      ...o,
      applicable: !o.appliesTo.length || o.appliesTo.includes(cur),
      appliesToLabel: (o.appliesTo || []).map((t) => genTypeTemplates[t]?.name || t).join('、'),
    }));
};
const propositionOptions = computed(() => styleGroupOptions('proposition'));
const presentationOptions = computed(() => styleGroupOptions('presentation'));
/** 弹窗"确定"：确认当前风格（必选确认标记置位） */
const confirmStyle = () => {
  styleManuallySet.value = true;
  styleConfirmed.value = true;
  showStyleModal.value = false;
};

/* 🔧 生成前分值微调（本次生效，不落库） */
const showScoreAdjustModal = ref(false);
const scoreAdjustDraft = ref([]); // [{name, score}]
const scoreAdjustFull = ref(100);
const scoreAdjustSum = computed(() => scoreAdjustDraft.value.reduce((a, s) => a + (Number(s.score) || 0), 0));
const openScoreAdjust = () => {
  try {
    const key = currentDimKey();
    if (!key) { window.alert('请先选择教材'); return; }
    const [subject, stageKey] = key.split('|');
    const bp = findBlueprint({ genType: genTypes.value[0], subject, stage: stageKey, region: examRegion.value });
    if (!bp?.sections?.length) { window.alert('当前资料类型无可微调的卷面结构（仅 exam 有固定卷面）'); return; }
    const adj = scoreAdjust.value[key] || {};
    scoreAdjustDraft.value = bp.sections.map((s) => ({ name: s.name, score: adj[s.name] != null ? adj[s.name] : s.score }));
    scoreAdjustFull.value = bp.fullScore || 100;
    showScoreAdjustModal.value = true;
  } catch (e) { window.alert('分值微调打开失败：' + e.message); }
};
const confirmScoreAdjust = () => {
  if (scoreAdjustSum.value !== scoreAdjustFull.value) {
    window.alert(`分值之和 ${scoreAdjustSum.value} ≠ 满分 ${scoreAdjustFull.value}，请调整到闭合后再确定`);
    return;
  }
  const map = {};
  scoreAdjustDraft.value.forEach((s) => { map[s.name] = Number(s.score); });
  scoreAdjust.value[currentDimKey()] = map;
  showScoreAdjustModal.value = false;
  loadInstructionFromLibrary(); // 重新注入指令（应用微调分值）
};
const resetScoreAdjust = () => {
  if (!window.confirm('恢复本次微调为默认分值？')) return;
  delete scoreAdjust.value[currentDimKey()];
  showScoreAdjustModal.value = false;
  loadInstructionFromLibrary();
};
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
  // 🔧 生成重任务清单（生成量大的类型走 Flash 生成模型/强制推理）：单处定义，曾云分支/Ollama 分支各自复制
  const heavyTasks = ['exam', 'practice', 'special', 'reading', 'errorbook'];
  // 🌐 云端 DeepSeek：按任务分 Flash（生成）和 Pro（分析）
  if (apiConfig.currentEngine === 'deepseek') {
    const genModel = apiConfig.deepseekGenerationModel || apiConfig.deepseekModel || 'deepseek-v4-flash';
    const analysisModel = apiConfig.deepseekAnalysisModel || 'deepseek-v4-pro';
    if (heavyTasks.includes(type)) {
      return { icon: '🧠', model: genModel, tip: '生成用Flash·分析用Pro' };
    }
    return { icon: '📚', model: analysisModel, tip: '分析用Pro·精准提取' };
  }
  // 🔥 火山 / ☁️ 阿里 / 🧠 智谱：生成/分析双模型提示
  if (apiConfig.currentEngine === 'volcano' || apiConfig.currentEngine === 'alibaba' || apiConfig.currentEngine === 'zhipu') {
    const cfg = apiConfig;
    const genModel = cfg[`${apiConfig.currentEngine}GenerationModel`] || '';
    const analysisModel = cfg[`${apiConfig.currentEngine}AnalysisModel`] || '';
    const m = heavyTasks.includes(type) ? genModel : analysisModel;
    const tip = apiConfig.currentEngine === 'zhipu'
      ? (heavyTasks.includes(type) ? '生成/分析同模型·强制推理' : '生成/分析同模型·强制推理')
      : (heavyTasks.includes(type) ? '生成用Turbo/27b·便宜快' : '分析用Pro/Max·精准');
    return { icon: '🧠', model: m, tip };
  }
  // 🦙 本地 Ollama（推理已全局关闭，选大模型只为生成质量）
  const hints = {
    'exam':      { icon: '🧠', model: apiConfig.ollamaTextModel || 'deepseek-r1:14b', tip: '14B命题最优·推理已关' },
    'practice':  { icon: '🧠', model: apiConfig.ollamaTextModel || 'deepseek-r1:14b', tip: '课时练命题生成最优' },
    'summary':   { icon: '📚', model: apiConfig.ollamaLightModel || 'glm4:9b', tip: '知识点总结/学术精准' },
    'special':   { icon: '🧠', model: apiConfig.ollamaTextModel || 'deepseek-r1:14b', tip: '专项突破·大模型更稳' },
    'errorbook': { icon: '📚', model: apiConfig.ollamaLightModel || 'glm4:9b', tip: '错题分析/归因精准' },
    'preview':   { icon: '🌟', model: 'glm4:9b / qwen2.5:14b', tip: '预习资料格式驱动' },
    'dictation': { icon: '🌟', model: 'glm4:9b / qwen2.5:14b', tip: '听写格式要求高' },
    'reading':   { icon: '🧠', model: apiConfig.ollamaTextModel || 'deepseek-r1:14b', tip: '阅读理解·大模型更稳' },
    'review':    { icon: '📚', model: apiConfig.ollamaLightModel || 'glm4:9b', tip: '复习资料·综合梳理' }, // 🔧 补齐缺项（曾回落 null 无提示）
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
  // 🔥 火山 / ☁️ 阿里 / 🧠 智谱：按引擎显示生成/分析双模型
  if (apiConfig.currentEngine === 'volcano' || apiConfig.currentEngine === 'alibaba' || apiConfig.currentEngine === 'zhipu') {
    const eng = apiConfig.currentEngine;
    const genModel = apiConfig[`${eng}GenerationModel`] || '未设置';
    const analysisModel = apiConfig[`${eng}AnalysisModel`] || genModel;
    const engineLabel = { volcano: '🔥 火山', alibaba: '☁️ 阿里', zhipu: '🧠 智谱' }[eng] || eng;
    return { engine: engineLabel, heavy: genModel, light: analysisModel };
  }
  // 🌐 DeepSeek 云端：显示双模型配置（生成 + 分析）
  const genModel = apiConfig.deepseekGenerationModel || apiConfig.deepseekModel || 'deepseek-v4-flash';
  const analysisModel = apiConfig.deepseekAnalysisModel || 'deepseek-v4-pro';
  return { engine: '🌐 DeepSeek', heavy: genModel, light: analysisModel };
});

const selectedTextbooks = computed(() => textbookStore.selectedBooks);

const selectedTemplates = computed(() => templateStore.selectedTemplates);

const selectedTextbookCount = computed(() => textbookStore.selectedChapterCount);

const selectedTemplateCount = computed(() => templateStore.selectedCount);
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
const refreshPage = () => {
  instructionDraft.value = '';
  showPreview.value = false;
  window.dispatchEvent(new CustomEvent('reset-task'));
};

// ☁️ 手动同步：拉取云端数据+推送本地数据（双向合并，不重置任务）
const syncPage = () => {
  window.dispatchEvent(new CustomEvent('app-refresh'));
};

// 📤 手动上推：推送本地全量数据到云端
const uploadPage = () => {
  window.dispatchEvent(new CustomEvent('app-upload'));
};

// 🌐 DeepSeek API 真实就绪检测
const deepseekStatus = ref('checking'); // 'checking' | 'ready' | 'error'
const deepseekStatusMsg = ref('');

// 💰 DeepSeek 峰谷时段提示
const pricingPeriod = ref(getDeepSeekPricingPeriod());
let pricingTimer = null;
const updatePricingPeriod = () => { pricingPeriod.value = getDeepSeekPricingPeriod(); };
const showPeakDetail = ref(false);
// 仅当引擎为 deepseek 时才显示峰谷提示
const showPricingTip = computed(() => apiConfig.currentEngine === 'deepseek');
const checkDeepSeekReady = async () => {
  if (apiConfig.currentEngine !== 'deepseek') {
    deepseekStatus.value = 'ready'; // 非 DeepSeek 不检测
    return;
  }
  deepseekStatus.value = 'checking';
  deepseekStatusMsg.value = '';
  try {
    const baseUrl = apiConfig.deepseekBaseUrl || 'https://api.deepseek.com/v1';
    // 🔧 防御性清洗（保守）：全角转半角 + 仅移除零宽/BOM/首尾空白，绝不删除 Key 内容
    const apiKey = (apiConfig.deepseekApiKey || '')
      .replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/\uFF0D/g, '-')
      .replace(/[\u200B-\u200D\uFEFF\u00A0\u3000\u200E\u200F\u202A-\u202E\u2060-\u206F]/g, '')
      .trim();
    if (!apiKey) {
      deepseekStatus.value = 'error';
      deepseekStatusMsg.value = '未配置API Key';
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    // 🔧 关键修复：DeepSeek 官方 /models 端点对该类 Key 返回 401（即使 Key 有效，chat/completions 正常），
    //    导致就绪检测误判。改用 chat/completions 发最小对话请求做真实连通测试（与生成同路径，最可靠）
    let apiUrl = baseUrl;
    if (apiUrl.includes('/chat/completions')) {
      // 已含完整路径
    } else {
      apiUrl = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
    }
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.deepseekGenerationModel || apiConfig.deepseekModel || 'deepseek-chat',
        messages: [{ role: 'user', content: 'OK' }],
        max_tokens: 5,
        stream: false
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (resp.ok) {
      deepseekStatus.value = 'ready';
      deepseekStatusMsg.value = '';
    } else {
      deepseekStatus.value = 'error';
      if (resp.status === 401) {
        // 🔧 诊断：输出 Key 长度与首尾字符码（脱敏，定位隐藏字符/复制不全/全角字符）
        const k = apiKey || '';
        const head = [...k.slice(0, 6)].map(c => c.charCodeAt(0).toString(16)).join(' ');
        const tail = [...k.slice(-4)].map(c => c.charCodeAt(0).toString(16)).join(' ');
        console.warn(`🔑 401诊断: Key长度=${k.length} 开头[${head}] 结尾[${tail}] （正常Key应为 sk- 开头、长度≥30、全部ASCII码点）`);
        deepseekStatusMsg.value = 'API Key 无效或已过期，请重新填写';
      } else {
        deepseekStatusMsg.value = `HTTP ${resp.status}（模型: ${apiConfig.deepseekGenerationModel || apiConfig.deepseekModel}）`;
      }
    }
  } catch (e) {
    deepseekStatus.value = 'error';
    deepseekStatusMsg.value = e.name === 'AbortError' ? '连接超时' : (e.message || '网络错误');
  }
};

// 🔧 引擎/Key 变更后自动重新检测就绪状态（粘贴新 Key 保存后无需刷新页面）
watch(
  () => [apiConfig.currentEngine, apiConfig.deepseekApiKey],
  () => { checkDeepSeekReady(); },
  { deep: false }
);

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
    // 旧版缓存不兼容，自动重建（正常行为，非错误）
    if (import.meta.env.DEV) console.log(`[GenerateModule] 缓存版本升级 (${cached._cacheVersion || 0} → ${DETAIL_CONFIG_CACHE_VERSION})，已重建`);
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
      chapter.competency = book.grade && extractGradeNum(book.grade) <= 6 ? '识记与理解' : '应用与分析';
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
          if (item.rawText.trim().length < GEN_CONST.OCR_WARN_MIN_TEXT) {
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
    
    if (isPoorOCR && hasRawText && analysisResultData.value.rawText.trim().length < GEN_CONST.OCR_POOR_STRICT_MIN) {
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
        item.rawText = simpleHtmlToPlainText(item._rawTextHtml);
      }
    }
  } else if (analysisResultType.value === 'template' && analysisResultData.value?._rawTextHtml) {
    analysisResultData.value.rawText = simpleHtmlToPlainText(analysisResultData.value._rawTextHtml);
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
    if (!data.rawText || data.rawText.trim().length < GEN_CONST.OCR_FAIL_MIN_TEXT) {
      await showAlertDialogFn('模板原文提取不完整，请先确认原文内容后再保存');
      return;
    }
    // 🔧 修复N：模板OCR完全失败时强制拦截
    if (data.ocrQuality === 'poor' && (!data.rawText || data.rawText.trim().length < GEN_CONST.OCR_POOR_MIN_TEXT)) {
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
    region: examRegion.value,  // 🔧 省市差异化：写入教材对象，供生成/校验链路读取
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
    region: examRegion.value,             // 🔧 省市差异化（正式试卷按省市时长/总分出卷）
    engine: (await getCurrentEngineConfigEnhanced('generation')).engine  // 🔧 DeepSeek 噪音过滤
  };
  
  // 自动匹配：根据教材的学段+学科，自动注入指令库中的片段（无需手动勾选）
  // 🔧 多学科修复：取所有选中教材的学科并集，而非仅取第一本
  const currentSubjects = [...new Set(selectedBooksWithChapters.map(b => b.subject).filter(Boolean))];
  const currentSubject = currentSubjects.length === 1 ? currentSubjects[0] : '';
  
  // 🔍 诊断日志：多学科匹配验证
  console.log('[buildInstruction] 选中教材:', selectedBooksWithChapters.map(b => ({ name: b.name, subject: b.subject, stage: b.stage, chCount: b.selectedChapters?.length })));
  console.log('[buildInstruction] currentSubjects:', currentSubjects, '→ currentSubject:', JSON.stringify(currentSubject), '(多学科模式:', currentSubjects.length > 1, ')');

  // 🔴 新架构：不再做 fragment/full 指令自动匹配（长指令注入已废弃）。
  //    生成由指令库三维度注入驱动（学段×学科×类型 cell + 蓝图/契约/规则附加块）；
  //    options 仅用于下方方案摘要展示，逐章指令由 generate 循环内按单章重新组装。
  
  // 🔴 新架构：方案摘要展示"三维度匹配链路"——指令库匹配 + 蓝图大题结构 + 省市差异化，
  //    不构建长指令（生成由整卷一次生成自动完成，摘要仅供确认参数）。
  try {
    const genTypeName = genTypeTemplates[genTypes.value?.[0]]?.name || genTypes.value?.[0] || '';
    const bookSummary = selectedBooksWithChapters.map(b => `${b.subject || ''}${b.grade || ''}《${b.name || ''}》`).join('、');
    const lines = [`【生成方案】资料类型：${genTypeName}`, `教材：${bookSummary || '未选择'}`];

    // ── 📐 命题范围回显：让用户一眼确认"选中/自动推断"的是 课/单元/期中/期末/月考/专题
    try {
      const scopeSource = selectedBooksWithChapters.find(b => (b.selectedChapters || []).length > 0) || selectedBooksWithChapters[0];
      if (scopeSource?.outline) {
        const scopeInfo = inferPaperScope(scopeSource.selectedChapters || [], scopeSource.outline || [], scopeType.value || '');
        const basis = scopeType.value && scopeType.value !== 'default'
          ? `你选择：${SCOPE_TYPE_LABELS[scopeType.value] || scopeType.value}`
          : (SCOPE_BASIS[scopeInfo.category] || `按勾选：${SCOPE_TYPE_LABELS[scopeType.value] || '默认'}`);
        const scopeDesc = scopeInfo.name
          ? (scopeInfo.isScopeLabel ? scopeInfo.name : `「${scopeInfo.name}」`)
          : '未勾选章节';
        lines.push(`命题范围：${scopeDesc}（${basis}）`);
      }
    } catch (e) {
      console.warn('[方案预览] 命题范围回显失败（不影响生成）:', e.message);
    }

    // ── 蓝图匹配预览：学科规范化 + 学段细分 → 三维度匹配蓝图大题结构 ──
    try {
      const firstBook = selectedBooksWithChapters[0];
      if (firstBook?.subject) {
        const stageKey = resolveStageKey(firstBook.stage, firstBook.grade, firstBook.name);
        const subject = normalizeSubjectName(firstBook.subject, stageKey);
        const region = examRegion.value || firstBook.region || '';
        const genType = genTypes.value?.[0];
        const stageLabel = STAGE_LABEL_MAP[stageKey] || stageKey;
        lines.push(`学段：${stageLabel}（${stageKey}）${region ? `　地区：${region}` : ''}`);

        const bp = findBlueprint({ genType, subject, stage: stageKey, region });
        if (bp) {
          lines.push(`匹配蓝图：${bp.fullScore ? `（总分${bp.fullScore}分 · ${bp.duration || '时长未定'}）` : ''}`);
          // ── 大题结构预览（蓝图数据）──
          if (bp.sections?.length) {
            lines.push('');
            lines.push('【大题结构】');
            bp.sections.forEach((s, i) => {
              lines.push(`${i + 1}. ${s.name}${s.score ? ` ${s.score}分` : ''}`);
            });
          }
        } else {
          lines.push('匹配蓝图：未找到（请检查学科/学段/资料类型组合）');
        }
      }
    } catch (e) {
      console.warn('[方案预览] 预览失败（不影响生成）:', e.message);
    }

    lines.push('');
    lines.push('（考点分配、教材素材检索、学科规范注入将在生成时按整卷自动完成）');
    instructionDraft.value = lines.join('\n');
  } catch (e) {
    console.error('[buildInstructionFromSelection] 生成方案构建失败:', e);
    throw e;
  }
  previewHint.value = `基于 ${selectedBooksWithChapters.length} 本教材、${selectedTpls.length} 个模板构建`;
};

// 🔴 生成指令：按三维度（年级×学科×资料类型）从指令库匹配模板并组装注入指令
// 统计生成前约束文本中的 fix 规则条数（清单展示用）
const countPromptHints = (txt) => (String(txt || '').match(/\n· /g) || []).length;

const loadInstructionFromLibrary = async (genTypeOverride = '', booksOverride = null) => {
  // 🔧 逐章模式：booksOverride 传入单章过滤版教材（范围名/标题按当前章节）；
  //    空数组（章节未匹配）回退全量勾选，不阻塞
  const selectedBooks = booksOverride?.length ? booksOverride : textbookStore.textbooks.filter(b => hasAnySelected(b.outline));
  if (selectedBooks.length === 0) {
    await showAlertDialogFn('请先勾选教材章节');
    return;
  }
  const book = selectedBooks[0];
  // 🔧 多类型混合生成：按当前循环类型重新组装（第二类型起不沿用第一类型指令）；
  //    默认取第一个类型（单类型/首次组装路径不变）
  // 🔧 防御：事件对象误传防护——非字符串的 genTypeOverride（如 @click 无括号误传 PointerEvent）直接忽略，
  //    避免污染三维度匹配（曾导致模板错配 exam + 蓝图/渲染契约全失效）
  const genType = (typeof genTypeOverride === 'string' && genTypeOverride) ? genTypeOverride : genTypes.value?.[0];
  if (!genType) {
    await showAlertDialogFn('请先选择资料类型');
    return;
  }
  // 自动组装完成后清除手动编辑标记（本次组装结果为基准，后续用户再敲字会重新置位）
  userEditedInstruction = false;
  // 三维度：学段键 + 规范学科名 + 资料类型
  const stageBase = resolveStageKey(book.stage, book.grade, book.name);
  const subject = normalizeSubjectName(book.subject, stageBase);
  const stageKey = stageBase;
  // 匹配指令库模板（用户自定义优先，内置兜底）
  const tpl = getPromptTemplate({ grade: stageKey, subject, genType });

  // 卷面结构（exam 从蓝图取大题/分值/时长；非 exam 无固定结构）
  let structure = '';
  let fullScore = '';
  let duration = '';
  let bp = null; // 🔧 蓝图对象（供蓝图注入块使用）
  try {
    bp = findBlueprint({ genType, subject, stage: stageKey, region: examRegion.value });
    if (bp) {
      // 用户分值微调（本次生效不落库）应用在唯一注入点，保证【卷面结构】段与实际分值一致
      structure = buildStructureText(applyScoreAdjust(bp));
      fullScore = bp.fullScore || '';
      duration = bp.duration || '';
    }
  } catch { /* 无蓝图不影响指令注入（模板兜底） */ }

  // 命题范围（单元名：课/单元/期中/期末）
  // 🔧 范围维度 → 名称池类型（弹窗确认的是"维度"，具体标题名称由名称池轮换组合）
  const DIM_TO_TYPE = { 期中: 'midterm', 期末: 'final', 月考: 'monthly', 专题: 'topic', 综合: 'default' };
  let unit = '';
  let scopeInfo = null;
  try {
    const scopeSource = selectedBooks.find(b => (b.selectedChapters || []).length > 0) || selectedBooks[0];
    if (scopeSource?.outline) {
      // 📐 范围标签词轮换：期中/期末/月考等考试标签逐次轮换（如 期中综合测试→期中素养检测），避免标题千篇一律
      scopeInfo = inferPaperScope(scopeSource.selectedChapters || [], scopeSource.outline || [], scopeType.value || '', pickScopeFromPool);
      unit = scopeOverride.value
        ? (DIM_TO_TYPE[scopeOverride.value] ? pickScopeFromPool(DIM_TO_TYPE[scopeOverride.value]) : scopeOverride.value)
        : (scopeInfo.name || '');
    }
  } catch { /* 范围推断失败不影响 */ }

  // 组装注入指令（任务行 + 模板正文 + 用户附加）
  const genTypeLabel = genTypeTemplates[genType]?.name || genType;
  // ✏️ 标题组成（命名规范）：年级(去学段) + 学科 + 册别 + 范围名 + 类型名；
  //    期中/期末/月考（范围名即考试标签，含跨单元推断出的考试类）：前缀加学年度学期、不带册别（学期已隐含上下册）、不拼类型名
  const examLabelCats = ['midterm', 'final', 'monthly', 'topic'];
  const isLabelScope = !!scopeInfo?.isScopeLabel
    && (examLabelCats.includes(scopeType.value || '') || examLabelCats.includes(scopeInfo.category || ''));
  // ✏️ 自定义范围名避重：范围名含"单元"时，类型名不用含"单元"的词（防"第二单元单元测试卷"病句；名称池已无"单元"词，此为兜底）
  let label = scopeInfo?.isScopeLabel ? '' : (labelStyle.value || pickLabelFromPool(genType, unit || '_all_'));
  if (label && /单元/.test(label) && /单元/.test(unit || '')) {
    label = (getLabelPool(genType) || []).find(w => !/单元/.test(w)) || label;
  }
  const academic = isLabelScope ? inferAcademicTerm() : '';
  const semester = isLabelScope ? '' : (book.semester || '');
  const gradeLabel = book.grade || '';
  instructionDraft.value = buildInjectionInstruction({
    template: tpl.template,
    grade: gradeLabel,
    stage: stageKey,
    subject,
    unit,
    genTypeLabel,
    label,
    semester,
    academic,
    structure,
    fullScore,
    duration,
  });
  // 🔴 渲染指令契约（EduRender）按 学段×学科×类型×是否配图 三维度+注入——功能闭合：
  //    图形学科给 [GRAPH]（按学段裁剪：低段数学无函数/几何、物理化学仅中学）、
  //    数理化学科按学段给公式、配图类题型给 [IMAGE]（EduRender 可渲染）
  const renderContractText = buildRenderContract({
    subject, genType, stage: stageKey,
    needsImage: needsImageHint(`${structure} ${genTypeLabel} ${unit}`, genType),
  });
  if (renderContractText) instructionDraft.value += renderContractText;
  // 🔴 卷面质检规则（规则库）按 学段×学科×类型 注入生成前约束（fix 类规则提示，防患未然；
  //    生成后由校验器静默自动修复，无需人工处理）
  const validatorPromptText = buildValidatorPrompt({ subject, stage: stageKey, genType });
  if (validatorPromptText) instructionDraft.value += validatorPromptText;
  // 🔴 注入来源登记：exam 的卷面结构已由 buildStructureText 注入模板【卷面结构】段（单一事实源，
  //    无重复注入）；非 exam 附加教辅结构蓝本（栏目框架 + 题量/字数底线，按 学段×类型 三维度）；
  //    模板正文已自带【输出格式】，用户自定义模板可能缺失 → 去重兜底追加
  let blueprintDetail = '';
  if (genType === 'exam') {
    if (bp) {
      blueprintDetail = `真题蓝本「${bp.label}」· ${bp.sections.length} 个大题（大题/分值/时长）`;
    }
  } else {
    const teachingText = buildTeachingInjection({ genType, stage: stageKey, subject });
    if (teachingText) {
      instructionDraft.value += teachingText;
      blueprintDetail = `教辅结构「${genTypeLabel}」· 栏目框架 + 题量底线`;
    }
    if (!instructionDraft.value.includes('【输出格式】')) {
      // 用户自定义模板缺失【输出格式】时兜底：书写载体条款按 学科×学段 注入；内容型走结构化格式（不注作答载体）
      instructionDraft.value += buildOutputFormatHint({ subject, stage: stageKey, genType });
    }
  }
  instructionSource.value = {
    name: tpl.name || tpl.id || genType,
    source: tpl.source,
    key: tpl.id || genType,
  };
  injectSources.value = [
    { lib: '指令库', name: tpl.name || genType, detail: `${stageKey} × ${subject} × ${genType}（${tpl.source === 'user' ? '用户自定义' : '内置模板'}）` },
    ...(blueprintDetail ? [{ lib: '蓝图库', name: genType === 'exam' ? '真题蓝本' : '教辅结构', detail: blueprintDetail }] : []),
    ...(renderContractText ? [{ lib: '渲染契约库', name: '渲染指令', detail: '图形 / 公式 / 配图标记协议（按学科×学段）' }] : []),
    ...(validatorPromptText ? [{ lib: '规则库', name: '生成前约束', detail: `${countPromptHints(validatorPromptText)} 条 fix 规则` }] : []),
  ];
  previewHint.value = `注入指令来自指令库「${instructionSource.value.name}」，按 ${stageKey} × ${subject} × ${genType} 匹配${tpl.source === 'user' ? '（用户自定义）' : '（内置模板）'}。命题依据：${getCurriculumLabel(stageKey)}（教育部发布新课标后需人工更新，见指令库「课标版本」说明）。长期修改请到「指令库」面板编辑保存。`;
};

// 恢复默认：直接用内置模板重新注入（不保存覆盖）
const restoreDefaultInstruction = async () => {
  const selectedBooks = textbookStore.textbooks.filter(b => hasAnySelected(b.outline));
  if (selectedBooks.length === 0) return;
  const book = selectedBooks[0];
  const genType = genTypes.value?.[0];
  if (!genType) return;
  const stageBase = resolveStageKey(book.stage, book.grade, book.name);
  const subject = normalizeSubjectName(book.subject, stageBase);
  const stageKey = stageBase;
  const tpl = getPromptTemplate({ grade: stageKey, subject, genType });
  // 恢复默认：临时改为内置模板渲染（不写入指令库）
  const builtinTemplate = tpl.source === 'user' ? getPromptTemplate({ grade: '', subject: '', genType }).template : tpl.template;
  let structure = '';
  let fullScore = '';
  let duration = '';
  let bp = null;
  try {
    bp = findBlueprint({ genType, subject, stage: stageKey, region: examRegion.value });
    if (bp) {
      // 恢复默认同样应用分值微调（与 loadInstructionFromLibrary 一致）
      structure = buildStructureText(applyScoreAdjust(bp));
      fullScore = bp.fullScore || '';
      duration = bp.duration || '';
    }
  } catch {}
  const genTypeLabel = genTypeTemplates[genType]?.name || genType;
  // ✏️ 标题类型名：名称样式固定优先，否则轮换（restoreDefault 场景无 unit，用全量轮换键）
  const label = labelStyle.value || pickLabelFromPool(genType, '_all_');
  // 🔧 恢复默认无范围推断（unit 仅在 loadInstructionFromLibrary 内有定义，此处引用会 ReferenceError → 显式置空）
  const unit = '';
  const gradeLabel = book.grade || '';
  instructionDraft.value = buildInjectionInstruction({
    template: builtinTemplate, grade: gradeLabel, stage: stageKey, subject, genTypeLabel, label, semester: book.semester || '', structure, fullScore, duration,
  });
  instructionDraft.value += buildRenderContract({
    subject, genType, stage: stageKey,
    needsImage: needsImageHint(`${structure} ${genTypeLabel} ${unit}`, genType),
  });
  instructionDraft.value += buildValidatorPrompt({ subject, stage: stageKey, genType });
  // exam 的卷面结构已由 buildStructureText 注入模板【卷面结构】段，此处不重复；非 exam 追加教辅结构
  if (genType !== 'exam') {
    instructionDraft.value += buildTeachingInjection({ genType, stage: stageKey, subject });
  }
  instructionSource.value = { name: `内置默认·${genTypeLabel}`, source: 'builtin', key: genType };
  injectSources.value = [
    { lib: '指令库', name: `内置默认·${genTypeLabel}`, detail: `${stageKey} × ${subject} × ${genType}（内置模板）` },
    ...(bp ? [{ lib: '蓝图库', name: genType === 'exam' ? '真题蓝本' : '教辅结构', detail: bp.label }] : []),
  ];
  previewHint.value = `已恢复内置默认指令（未改动你的自定义模板）。命题依据：${getCurriculumLabel(stageKey)}（新课标发布不自动更新，见指令库「课标版本」说明）。`;
};

// 生成前确保注入指令非空（最小场景：选教材+类型后直接生成也能跑）
const ensureInjectedInstruction = async () => {
  if (!instructionDraft.value.trim()) {
    await loadInstructionFromLibrary();
  }
  return instructionDraft.value.trim();
};

const clearInstruction = async () => {
  if (instructionDraft.value.trim()) {
    const confirmed = await showConfirmDialogFn('确定要清空生成指令吗？未保存的内容将丢失。');
    if (!confirmed) return;
  }
  instructionDraft.value = '';
  previewHint.value = '';
  injectSources.value = [];
};

// 🔧 三维度勾选变化 → 指令失效自动清空：教材（学段/学科/册别/勾选章节）/资料类型/范围维度任一变化，
//    旧指令即不可用（学科/学段/范围/角色可能全变），生成时 ensureInjectedInstruction 自动按当前勾选
//    重新组装——从源头杜绝跨次生成旧类型指令残留（如先出"正式试卷"再出"课时练"仍注入 exam 角色/
//    真题蓝本）；用户手动编辑的指令同样失效（勾选是事实源，编辑基于旧勾选无意义）。
//    模板勾选不影响指令组装（loadInstructionFromLibrary 只用教材库），不纳入 watch 源。
watch(
  () => [
    (genTypes.value || []).join(','),
    textbookStore.textbooks
      .filter(b => hasAnySelected(b.outline))
      .map(b => `${b.id}|${b.stage}|${b.subject}|${b.grade}|${getSelectedChapters(b.outline).map(c => `${c.title}@${c.start}`).join(',')}`)
      .join(';'),
    scopeType.value || '',
  ].join('~~'),
  () => {
    if (!instructionDraft.value.trim()) return;
    instructionDraft.value = '';
    userEditedInstruction = false;
    previewHint.value = '检测到三维度勾选变化，指令已重置——生成时将按当前勾选自动重新组装（或点「🔧 生成指令」立即预览）。';
    injectSources.value = [];
  }
);

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

// 🔧 HTML → 纯文本（保留段落和换行结构；仅本模块 rawText 同步用——比 contentCleaner.htmlToPlainText
//    更"简单"：不做答案节截取/表格转文/[IMAGE]描述/超长裁剪，避免同名双实现误引歧义，故命名为 simple 版）
const simpleHtmlToPlainText = (html) => {
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
const resetRawText = async () => {
  if (!rawTextEditorData.value) return;
  if (rawTextEditorData.value.rawText === ocrMarkdownToHtml(rawTextEditorData.value.originalRawText || '')) return;
  const confirmed = await showConfirmDialogFn('确定要重置为原始 OCR 结果吗？所有修改将丢失。');
  if (!confirmed) return;
  rawTextEditorData.value.rawText = ocrMarkdownToHtml(rawTextEditorData.value.originalRawText || '');
  console.log('🔄 已重置为原始 OCR 结果');
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
  if (!rawText || rawText.trim().length < GEN_CONST.OCR_FAIL_MIN_TEXT) {
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
  const plainText = simpleHtmlToPlainText(finalText);
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
  if (!rawText || rawText.trim().length < GEN_CONST.OCR_FAIL_MIN_TEXT) {
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
  const plainText = simpleHtmlToPlainText(finalText);
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
            competency: book.grade && extractGradeNum(book.grade) <= 6 ? '识记与理解' : '应用与分析',
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
    const failedChapters = allResults.filter(r => !r.rawText || r.rawText.trim().length < GEN_CONST.OCR_FAIL_MIN_TEXT);
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
      const poorResults = allResults.filter(r => r.chapterRef?.ocrQuality === 'poor' || (!r.rawText || r.rawText.trim().length < GEN_CONST.OCR_FAIL_MIN_TEXT));
      const warningResults = allResults.filter(r => r.chapterRef?.ocrQuality === 'warning' || (r.rawText && r.rawText.trim().length >= GEN_CONST.OCR_FAIL_MIN_TEXT && r.rawText.trim().length < GEN_CONST.OCR_WARN_MIN_TEXT_200));
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
  // 🔴 新架构：用户只选教材 + 资料类型即可生成（指令库自动决定角色/大题结构/题型/难度）
  // 不再要求先生成指令；指令文本仅作可选参考（传空串走指令库默认）
  scopeOverride.value = ''; // 🔧 每次生成前重置范围确认值，避免上次弹窗选择污染本次（单元/课不弹窗时用自动推断名）
  const types = mode === 'single' ? [genTypes.value[0]] : genTypes.value;
  
  if (!types[0]) {
    await showAlertDialogFn('请选择资料类型');
    return;
  }

  // 🔧 必选组织风格确认（收敛方案）：当前类型有必选风格且未确认 → 弹窗选择后才允许生成
  if (styleRequiredForCurrent.value && !styleConfirmed.value) {
    showStyleModal.value = true;
    await showAlertDialogFn('请先确认该资料类型的组织风格（已按类型推荐默认值，可在弹窗中调整）');
    return;
  }
  
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
  //    逐章分开处理：已分析章节保留完整教材数据；未分析章节走"仅目录模式"降级，两者混合生成
  //    🔧 课标版本按学段注入（getCurriculumLabel），避免写死版本号（高中=2017版2020年修订，与 2022 义教版不同）
  const curriculumLabel = getCurriculumLabel(selectedBooks[0]?.stage, selectedBooks[0]?.grade, selectedBooks[0]?.name);
  const unanalyzedChapters = selectedBooks.flatMap(b => 
    b.selectedChapters.filter(ch => !ch.analyzed || !ch.rawText || ch.rawText.trim().length < GEN_CONST.OCR_FAIL_MIN_TEXT)
  );
  if (unanalyzedChapters.length > 0) {
    const chapterList = unanalyzedChapters.map(ch => `• ${ch.title}`).join('\n');
    
    const proceed = await showConfirmDialogFn(
      `⚠️ 检测到 ${unanalyzedChapters.length} 个章节尚未分析教材内容\n\n` +
      `未分析章节（将走"仅目录模式"）：\n${chapterList}\n\n` +
      `【说明】\n` +
      `• 已分析章节：保留教材原文/知识点，正常高质量生成\n` +
      `• 未分析章节：基于「章节标题 + ${curriculumLabel}规范」降级生成（无教材细节，题目由 AI 依据学科典型内容设计，可能与教材版本不符）\n` +
      `• 两者在同一份资料中混合生成，不是全部丢弃\n\n` +
      `建议：先点击「🔍 分析教材」完成分析后再生成，获得以教材内容为依据的高质量结果\n\n` +
      `是否仍要继续生成？`
    );
    if (!proceed) return;
  }

  // 获取生成份数
  const batches = batchCount.value || 1;
  
  // 🔧 范围确认弹窗：根据勾选内容提取候选，用户确认后定范围名（仅有多候选时弹出）
  {
    const scopeSource = selectedBooks.find(b => (b.selectedChapters || []).length > 0) || selectedBooks[0];
    const chapters = scopeSource?.selectedChapters || [];
    if (chapters.length > 0) {
      const candidates = buildScopeCandidates(chapters, scopeSource.outline || [], scopeType.value || '');
      if (candidates.length > 1) {
        // 方案2：候选末尾追加"自定义名称"项——选中后弹输入框，支持自定义范围名（标题直接使用）
        const withCustom = [
          ...candidates.map(c => ({ label: `${c.label}${c.hint ? `（${c.hint}）` : ''}`, value: c.value })),
          { label: '✏️ 自定义名称…', value: '__custom__' },
        ];
        const chosen = await showRadioDialogFn(
          `请确认本卷命题范围（已按勾选内容提取${candidates.length}个候选；如都不合适可自定义）`,
          withCustom,
          candidates[0].value
        );
        if (chosen === null) return; // 用户取消
        if (chosen === '__custom__') {
          const custom = await showInputDialogFn(
            '请输入自定义范围名（将用于资料标题，如"第二单元·识字提升"）：',
            candidates[0]?.value || ''
          );
          if (!custom || !custom.trim()) return; // 用户取消或未输入
          scopeOverride.value = custom.trim();
        } else {
          scopeOverride.value = chosen;
        }
      } else {
        scopeOverride.value = candidates[0]?.value || '';
      }
    }
  }

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
  // 🔧 逐章模式当前章节的教材过滤版（标题/指令范围名按单章）；非逐章为 null
  const perChapterBooksRef = { value: null };
  
  for (let chIdx = 0; chIdx < chapterTargets.length; chIdx++) {
    const chapterTarget = chapterTargets[chIdx];
    if (chapterTarget) {
      console.log(`[逐章] 「${chapterTarget.title}」开始 (${chIdx + 1}/${chapterTargets.length})`);
      previewHint.value = `逐章生成：${chapterTarget.title} (${chIdx + 1}/${chapterTargets.length})`;
      setPerChapterFilter(chapterTarget.title);
      
      // 🔧 逐章专属指令：按单章过滤教材后从指令库重新组装完整指令
      //    （范围名=当前章节；此前覆盖为 3 行方案摘要 → 生成端指令丢失角色/卷面结构/命题要求，逐章生成失控）
      const perChapterBooks = selectedBooks.map(b => ({
        ...b,
        selectedChapters: b.selectedChapters.filter(
          ch => ch.title === chapterTarget.title && ch.start === chapterTarget.start
        )
      })).filter(b => b.selectedChapters.length > 0);
      perChapterBooksRef.value = perChapterBooks;
      try {
        if (!userEditedInstruction) {
          await loadInstructionFromLibrary('', perChapterBooks);
        }
        console.log(`[逐章] 「${chapterTarget.title}」指令已按单章组装（${perChapterBooks.map(b => b.subject || '').join('、') || '教材为空'}）`);
      } catch (e) {
        console.warn('[逐章] 按单章组装指令失败，沿用全量方案:', e.message);
      }
    } else {
      perChapterBooksRef.value = null;
    }
  
  // 🔧 组织风格注入统一入口：风格值+说明追加到指令尾部（生成端识别并组织情境/呈现；情境库已退役）
  //    唯一生成入口（generate 主路径，含复生成差异化与逐章循环），防止分支漏注入
  const withStyle = (instr = '') => {
    if (!propositionStyle.value || !styleInstructions[propositionStyle.value]) return instr;
    return `${instr}\n\n【组织风格】${propositionStyle.value}：${styleInstructions[propositionStyle.value]}`;
  };

  // ✨ 新增：记录已生成资料的知识点，用于差异化（逐章模式下每章独立重置）
  const generatedKps = [];  // 已生成的知识点列表
  const generatedTypes = []; // 已生成的类型名称
  
  for (let typeIndex = 0; typeIndex < types.length; typeIndex++) {
    const genType = types[typeIndex];
    pendingGenType.value = genType;

    // 🔧 多类型混合生成：第二类型起若指令为自动组装（用户未手动编辑），
    //    按当前类型重新组装（任务行/蓝本/渲染契约/规则约束三维度匹配）——
    //    此前复用第一类型指令导致错位（如"课时练"被注入"正式试卷"角色与 exam 真题蓝本）
    // 🔧 跨次生成刷新（防御纵深）：勾选变化已由 watch 自动清空指令，此处覆盖 watch 未感知的
    //    边缘变化源（如 specialSubType 等不触发清空的配置）；typeIndex=0 非逐章时同样按当前类型
    //    重新组装——逐章分支已在章节循环开头（L5955）用单章教材组装过，跳过避免重复组装
    if (!userEditedInstruction && (typeIndex > 0 || !chapterTarget)) {
      try {
        await loadInstructionFromLibrary(genType, perChapterBooksRef.value);
      } catch (e) {
        console.warn(`[指令刷新] 按类型 ${genType} 重新组装指令失败，沿用现有指令:`, e.message);
      }
    }

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
      // 🔴 整卷生成：注入指令（指令库渲染，用户可编辑）作为生成依据
      const inj = await ensureInjectedInstruction();
      let finalInstr = typeIndex > 0 ? diffInstruction : inj;
      // 🔧 组织风格注入（统一入口 withStyle）：生成端识别并组织情境/呈现
      finalInstr = withStyle(finalInstr);
      // 🔧 生成份数循环：详细配置"生成份数"真实生效（同类型一次出多份，每份独立整卷生成后直接入库；
      //    份数循环对全部类型生效——蓝图确认弹窗已整体移除，不再有中断流程）
      for (let batch = 0; batch < batches; batch++) {
        if (batches > 1) {
          statusText.value = `正在生成第 ${batch + 1}/${batches} 份...`;
          progress.value = Math.max(progress.value, 5);
        }
        // 🔴 整卷生成结果已含全部内容（三库约束+答案页+代码兜底），直接入库，不再弹窗确认编辑
        const result = await callGenerate(
          finalInstr,
          genType,
          selectedBooks,
          selectedTpls,
          0,
          scopeType.value || ''
        );

        // 🔧 必须先保存上下文，否则 finalizeGeneration 拿不到 selectedBooks 导致标题命名缺失
        pendingGenerateContext.value = {
          result,
          genType,
          // 🔧 逐章模式：用单章过滤版教材 → 标题范围名=当前章节（此前全量勾选 → 多份同名）
          selectedBooks: perChapterBooksRef.value || selectedBooks,
          selectedTpls,
          generatedKps: [...generatedKps],
          generatedTypes: [...generatedTypes],
          typeIndex
        };
        await finalizeGeneration(result, genType);

        // 🔧 复生成差异化：收集本类型已生成的知识点（原收集逻辑随蓝图确认弹窗移除，此处补回，
        //    保证后续类型"已覆盖知识点"清单真实生效）
        const kps = (result.parsedBlueprint || []).map(q => q?.knowledgePoint).filter(Boolean);
        generatedKps.push(...kps);
      } // end 份数循环（batchCount）
      pendingGenerateContext.value = null;
      generatedTypes.push(genTypeTemplates[genType]?.name || genType);
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '❌ 生成失败：' + e.message, type: 'error' } }));
      await showAlertDialogFn(`生成出错：${e.message}`);
    }
  }
  } // end chapterTargets loop
  if (chapterTargets.length > 1) {
    setPerChapterFilter(null); // 逐章模式结束，清除过滤器
    // 🔧 逐章结束：恢复全量教材的完整指令（此前覆盖为方案摘要 → 再次生成时指令丢失角色/卷面结构/命题要求）
    if (!userEditedInstruction) {
      try {
        await loadInstructionFromLibrary('');
      } catch (e) {
        console.warn('[逐章] 恢复全量指令失败:', e);
      }
    }
  }
};



// ✨ 新增：完成最终生成（保存到 generatedDocs）
const finalizeGeneration = async (result, genType) => {
  if (result.success) {
    // 🔧 防御：确保 content 是有效字符串；生成入库时清理 AI 残留的成串 <br>（2+ 压成 1 个），
    //    保证排版编辑预览与导出所见即所得（预览看不到成串空行，导出也不会有）
    // 🔧 纵深防御：AI 内容在此单点经 stripXss 剥离可执行向量（script/on*/javascript:/iframe 等），
    //    预览(v-html)/导出(innerHTML)/编辑全链路读 doc.content 均拿到安全内容；
    //    stripXss 为负向剥离，不动任何 class/style/结构标签，排版零影响
    const safeContent = stripXss(
      ((result.content && typeof result.content === 'string') ? result.content : '')
        .replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br>')
    );
    
    const genTypeName = genTypeTemplates[genType]?.name || genType;
    const ctxBooks = pendingGenerateContext.value?.selectedBooks;
    const book = pickPrimaryBook(ctxBooks);
    const gradeLabel = book?.grade || '';
    const subjectLabel = book?.subject || '';
    // 🔴 卷首大标题命名规范唯一实现（buildPaperTitle，与指令注入侧同一套语义）：
    //    普通型（课/单元范围）= 年级 + 学科 + 册别 + 范围名 + 类型名（类型名从名称池轮换）
    //    考试型（期中/期末/月考/专题）= 学年度学期 + 年级 + 学科 + 范围标签词（从名称池轮换）
    //    ——标题命名是确定性拼装（程序职责），不再采信 AI 生成的 h1（此前 AI 自由发挥导致命名规则从未生效）
    const chapters = book?.selectedChapters || [];
    const examLabelCats = ['midterm', 'final', 'monthly', 'topic'];
    const scopeInfo = inferPaperScope(chapters, book?.outline || [], scopeType.value || '', pickScopeFromPool);
    const chapterName = scopeInfo.name;
    const isLabelScope = !!scopeInfo?.isScopeLabel
      && (examLabelCats.includes(scopeType.value || '') || examLabelCats.includes(scopeInfo.category || ''));
    let label = scopeInfo?.isScopeLabel ? '' : (labelStyle.value || pickLabelFromPool(genType, chapterName || '_all_'));
    if (label && /单元/.test(label) && /单元/.test(chapterName || '')) {
      label = (getLabelPool(genType) || []).find(w => !/单元/.test(w)) || label;
    }
    const paperTitle = buildPaperTitle({
      grade: gradeLabel,
      subject: subjectLabel,
      semester: isLabelScope ? '' : (book.semester || ''),
      scopeName: chapterName,
      typeLabel: label,
      academic: isLabelScope ? inferAcademicTerm() : '',
      isExam: isLabelScope,
    });
    // 🔴 卷首 h1 与文档标题统一为规范命名（AI 生成的 h1 一律替换为程序拼装的规范标题）
    const titledContent = applyPaperTitleToContent(safeContent, paperTitle);
    const now = new Date();
    const ts = now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    // 文档标题 = 规范标题 + 时间戳（去重标识）
    const title = paperTitle + '_' + ts;
    
    generatedDocs.value.push({
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36),
      title,
      content: renderImagePlaceholders(titledContent),
      rawContent: titledContent,
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
        // 优先用整卷生成返回的 parsedBlueprint，其次用上下文缓存的（同一结果的备份）
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
  
  previewContent.value = normalizeSealStructure(renderImagePlaceholders(content));
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

const deleteDoc = async (doc) => {
  const confirmed = await showConfirmDialogFn(`确定要删除「${doc.title}」吗？`);
  if (!confirmed) return;
  // 打 _deleted 标记，不立即移除（多端同步需要一条端删除即可）
  const idx = generatedDocs.value.findIndex(d => d.id === doc.id);
  if (idx !== -1) {
    generatedDocs.value[idx]._deleted = true;
    generatedDocs.value[idx].savedAt = Date.now(); // 🔧 更新时间戳，确保删除标记进入推送 Top 20
    // 🔧 写入独立墓碑通道（不依赖 _deleted 字段，7 天自动过期）
    try {
      const deletedIds = JSON.parse(localStorage.getItem('wisdom_deleted_gen_doc_ids') || '{}');
      deletedIds[doc.id] = Date.now();
      localStorage.setItem('wisdom_deleted_gen_doc_ids', JSON.stringify(deletedIds));
    } catch {}
    // 🔧 立即推送墓碑到云端（fire-and-forget），不等待同步流程
    pushDeletedDocIds('generated_docs', { [doc.id]: Date.now() }).catch(e => console.error('删除生成结果后墓碑推送失败:', e?.message || e));
  }
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
    d.savedAt = Date.now(); // 🔧 更新时间戳，确保删除标记进入推送 Top 20
    // 🔧 写入独立墓碑通道
    try {
      const deletedIds = JSON.parse(localStorage.getItem('wisdom_deleted_gen_doc_ids') || '{}');
      deletedIds[d.id] = Date.now();
      localStorage.setItem('wisdom_deleted_gen_doc_ids', JSON.stringify(deletedIds));
    } catch {}
  }
  // 🔧 批量删除后立即推送墓碑到云端（fire-and-forget）
  const batchIds = {};
  for (const d of selected) batchIds[d.id] = Date.now();
  pushDeletedDocIds('generated_docs', batchIds).catch(e => console.error('批量删除后墓碑推送失败:', e?.message || e));
  
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
  // 🔧 密封线试卷：@page 边距归零、body 不留白（页面壳 .sealed-wrapper 提供 2cm 边距）
  const printCss = getPrintCss(/sealed-wrapper/.test(htmlContent));
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
  // 🔧 所见即所得：排版编辑的修改回写在 localStorage，导出前取该记录最新内容
  //    （内存 generatedDocs 可能滞后于排版编辑中的删除/修改，避免导出旧换行）
  try {
    const saved = await storage.getItem(STORAGE_KEY).catch(() => null);
    if (saved && Array.isArray(saved)) {
      const rec = decompressDocArray(saved).find(r => r.id === doc.id);
      if (rec?.content && typeof rec.content === 'string') content = rec.content;
    }
  } catch { /* 读取失败用内存值 */ }
  
  // 🔧 第二道防线：清洗 AI 响应中可能残留的 markdown 代码块标记和对话文本
  //    虽然 callAI 中已有 cleanReasoningOutput，但部分模型（如 Qwen）仍可能绕过；
  //    逻辑收敛至 contentCleaner.stripAiCodeFence（与 TypesetModule 导出端共用，不再各自维护同构副本）
  content = stripAiCodeFence(content);
  
  // 🔧 所见即所得：换行不做导出阶段清理（AI 残留的成串 br 已在生成入库时清理，
  //    排版编辑里保留的换行原样导出、删除的换行不会导出）
  
  if (!teacherVersion.value) {
    content = content.replace(/<div class="answer-section">[\s\S]*?<\/div>/gi, '<div class="answer-section"><p>（答案略，请独立完成）</p></div>');
  }
  // 🔧 密封线结构归一化 + 试卷主题包装（与排版模块 TypesetModule 导出一致）：
  //    内容含密封特征时自动按 sealed_exam 包装（模板 seal-zone 密封区 + 注意事项 + 题号得分表），
  //    旧结构（sealed-line/sl-text/横向 p）统一归一化为模板结构——否则导出的 Word/PDF 密封线
  //    会退化为普通横排段落（无虚线、无旋转、无考生信息栏）。
  const sealLike = /密封线|学校[:：]|班级[:：]|姓名[:：]|学号[:：]|考生[:：]|考号[:：]/.test(content);
  if (sealLike) content = wrapContentForTheme(content, 'sealed_exam');
  if (format === 'pdf') {
    // 🔧 配图占位框还原为干净文本（与 docxBuilder 一致）：占位框是编辑器 UI，
    //    导出 PDF 时不可出现"[插图占位]/复制 PROMPT"等字样，按 data-image-raw 还原为〔配图位置：描述〕
    let pdfSrc = content.replace(/<div[^>]*class="[^"]*image-placeholder[^"]*"[^>]*data-image-raw="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi, (m, raw) => {
      const decoded = raw.split('&amp;').join('&').split('&lt;').join('<').split('&gt;').join('>').split('&quot;').join('"');
      const pm = decoded.match(/PROMPT:\s*(.+)/);
      return pm ? `〔配图位置：${pm[1].trim()}〕` : '〔配图位置〕';
    });
    // 转换 $...$ 公式标记为可读文本
    let pdfContent = convertFormulasInHtml(pdfSrc);
    // 🔧 应用主题 CSS（与排版模块 TypesetModule 的 PDF 导出一致）：
    //    密封内容自动按 sealed_exam 注入主题样式，PDF 才有密封区/虚线/旋转文字效果；
    //    否则 puppeteer 渲染的是无样式 HTML（密封线退化为普通横排文字）。
    if (sealLike) {
      pdfContent = applyThemeToContent(pdfContent, 'sealed_exam', { isHtmlContent: true, forceImportant: true, stage: doc?.meta?.stage || doc?.stage });
    }
    
    // 🔧 优先使用 Electron 原生 PDF 导出
    if (window.electronAPI?.exportPdf) {
      const storagePath = getStoragePath();
      const outputPath = `${storagePath}/导出/${doc.title}_${Date.now()}.pdf`;
      const pdfDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
      try {
        await window.electronAPI.createDirectory(pdfDir);
      } catch {}
      try {
        const result = await window.electronAPI.exportPdf(pdfContent, outputPath, { margin: sealLike ? 0 : undefined });
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
    // 🔧 导出前预处理：ruby 标签 → ruby-char span（拆分多字注音为逐字独立单元）
    const exportContent = normalizeRubyTags(content);
    // 🔧 关键修复：docxBuilder 依赖 getComputedStyle 读取字体/颜色/字号等样式，
    //    容器必须挂载到 DOM 中才能正确计算样式，否则所有样式丢失导致乱码
    // 🔧 卷面规范（与排版模块 TypesetModule 导出一致）：wrapper 隔离主题 CSS <style>，
    //    密封试卷按 sealed_exam 注入主题样式，正文字号/标题/密封区样式通过文档级联生效；
    //    docxBuilder 只处理 clone，style 标签不会被当作正文
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute;visibility:hidden;width:210mm;left:-9999px;';
    const clone = document.createElement('div');
    clone.style.fontFamily = 'SimSun';
    clone.style.fontSize = '12pt';
    clone.innerHTML = exportContent;
    if (sealLike) {
      try {
        const fullHtml = applyThemeToContent('<div></div>', 'sealed_exam', { isHtmlContent: true, forceImportant: false, stage: doc?.meta?.stage || doc?.stage });
        const cssMatch = fullHtml.match(/<style>([\s\S]*?)<\/style>/i);
        if (cssMatch) {
          let exportCSS = cssMatch[1].trim()
            .replace(/\*\s*\{[^}]*\}/g, '')
            .replace(/body\s*\{[^}]*\}/g, '')
            .replace(/@page\s*\{[^}]*\}/g, '')
            .replace(/@media\s+print\s*\{[^}]*\}/g, '');
          exportCSS += '\n.answer-item,.notice,.card,p,li,td p,th p{font-size:inherit!important}\n';
          const styleEl = document.createElement('style');
          styleEl.setAttribute('data-export-theme', 'true');
          styleEl.textContent = exportCSS;
          wrapper.appendChild(styleEl);
        }
      } catch (cssErr) {
        console.error('主题样式注入失败，使用默认样式:', cssErr);
      }
    }
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      // 🔧 作文格格子尺寸取排版规格库 ZUOWEN_CELL（按学段），学段取自生成参数（五档 stageKey，docxBuilder 内归一化为三档）
      const blob = await htmlToDocxBlob(clone, doc?.meta?.stage || doc?.stage || 'middle');
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
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
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

  // 🔧 题型自动同步已删除（题型分布库退役：非课标来源的经验性题量建议，与蓝图库题型骨架权威冲突）
  // 题型面板由用户手动添加，题型权威唯一化（蓝本/用户）

// 初始化
// ☁️ 云端数据同步完成后：从 localStorage 重新加载 + 清理 _deleted 标记项
// 🔧 _cloudSyncRunning 全局锁：KeepAlive 缓存多实例时，只允许一个实例执行
let _skipCloudPush = false;
let _cloudSyncRunning = false;
const onCloudSync = async () => {
  if (isGenerating.value) return;
  if (_cloudSyncRunning) return; // 🔧 KeepAlive 多实例保护
  _cloudSyncRunning = true;
  _skipCloudPush = true;
  try {
    // 从 IndexedDB 重新加载（同步已写入合并结果，解压 content）
    const saved = await storage.getItem(STORAGE_KEY).catch(() => null);
    if (saved && Array.isArray(saved)) {
      const decompressed = decompressDocArray(saved);
      // 兜底截断：上限 20 条，保留最新的
      generatedDocs.value = decompressed.length > 20 ? decompressed.slice(-20) : decompressed;
    }
    // 软删除：_deleted 标记保留在数组中传播，UI 由 displayedDocs 过滤
    const deletedCount = generatedDocs.value.filter(d => d._deleted).length;
    console.log('☁️ [GenerateModule] 同步完成，当前 ' + generatedDocs.value.length + ' 条（有效 ' + (generatedDocs.value.length - deletedCount) + '，软删除 ' + deletedCount + '）');
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
  loadScopeLabelStyle(); // 📐 考试标签维度固定选择（恢复上次保存）
  // 🔧 同步已保存的 apiConfig 到响应式对象（否则模型芯片显示默认值而非实际配置）
  await getCurrentEngineConfig();
  // 🌐 检测 DeepSeek API 真实就绪状态
  checkDeepSeekReady();
  _setupListeners();
  // 💰 峰谷时段定时刷新（每分钟）
  updatePricingPeriod();
  pricingTimer = setInterval(updatePricingPeriod, 60000);
});

// 🔧 KeepAlive 重新激活：重新注册事件监听 + 重载数据（同步可能在此期间发生）
onActivated(async () => { _setupListeners(); const docs = await loadGeneratedDocs(); if (docs.length > 0) generatedDocs.value = docs; });

// 🔧 KeepAlive 停用缓存：移除监听，避免不活跃实例收到事件
onDeactivated(() => { _teardownListeners(); });

// 真正销毁
onUnmounted(() => { _teardownListeners(); wakeLock.cleanup(); if (pricingTimer) clearInterval(pricingTimer); });

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
  font-size: 14px;
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
  font-weight: 500;
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

/* 本次注入来源清单（面板可视化：生成读了哪些库） */
.inject-sources {
  margin-top: 10px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 8px 12px;
  background: var(--bg-card);
}
.src-title { font-size: 12.5px; font-weight: 700; color: #26303e; margin-bottom: 6px; }
.src-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12.5px; }
.src-item + .src-item { border-top: 1px dashed var(--border-light); }
.src-lib {
  flex: 0 0 auto; font-size: 11px; font-weight: 700; color: #fff;
  background: var(--primary); border-radius: 6px; padding: 1px 8px;
}
.src-name { flex: 0 0 auto; font-weight: 600; color: #26303e; }
.src-detail { flex: 1 1 auto; color: var(--text-muted); font-size: 12px; }

.instruction-source { margin-top: 8px; font-size: 12px; color: var(--text-muted); }
.inject-hint { margin-top: 6px; font-size: 12px; color: var(--text-muted); }

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

/* 💰 DeepSeek 峰谷时段提示 */
.pricing-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  flex-wrap: wrap;
  transition: all 0.2s;
}
.pricing-peak {
  background: rgba(255, 152, 0, 0.12);
  border: 1px solid rgba(255, 152, 0, 0.4);
  color: #e65100;
}
.pricing-offpeak {
  background: rgba(76, 175, 80, 0.12);
  border: 1px solid rgba(76, 175, 80, 0.4);
  color: #2e7d32;
}
.pricing-badge {
  font-weight: 600;
  white-space: nowrap;
}
.pricing-text {
  flex: 1;
  min-width: 0;
}
.pricing-detail-toggle {
  font-size: 11px;
  opacity: 0.7;
  white-space: nowrap;
}
.pricing-detail-box {
  width: 100%;
  margin-top: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.8;
}
.pricing-detail-title {
  font-weight: 600;
  margin-bottom: 4px;
}
.pricing-detail-peak { color: #c62828; }
.pricing-detail-offpeak { color: #2e7d32; }
.pricing-detail-note { margin-top: 4px; opacity: 0.7; font-size: 11px; }

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
  font-size: 14px;
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
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3500;
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

/* 🔧 组织风格弹窗：分组标题 + 提示文案 */
.style-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-lighter);
  border-radius: 6px;
  padding: 4px 10px;
  margin: 4px 0;
}
.option-tip {
  display: block;
  width: 100%;
  font-size: 11.5px;
  color: #889;
  margin-top: 2px;
}
.opt-disabled { opacity: 0.45; }
.opt-for { display: block; width: 100%; font-size: 11px; color: var(--warn, #a06a10); margin-top: 2px; }

/* 分值微调弹窗 */
.score-adjust-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow: auto; }
.score-adjust-row { display: flex; align-items: center; gap: 10px; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 8px 10px; }
.sa-name { flex: 1; font-size: 13px; }
.sa-input { width: 76px; border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 13px; text-align: right; }
.sa-unit { font-size: 12px; color: var(--text-muted); }
.sa-sum { margin-top: 10px; font-size: 13px; padding: 8px 12px; background: var(--success-light); border-radius: 8px; color: #1d7a4a; }
.sa-sum.sa-bad { background: var(--danger-light); color: var(--danger); }

/* 🔧 省市差异化选择区 */
.region-select-section {
  margin-top: 14px;
  padding: 12px;
  border: 1px dashed var(--border-light);
  border-radius: 8px;
  background: var(--bg-secondary, #f8f9fa);
}
.region-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.region-select {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  max-width: 260px;
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

/* ✏️ 名称样式弹窗：胶囊 chip 单选（资料类型名称 + 考试标签名称 统一视觉） */
.name-style-label { font-size: 14px; font-weight: 600; color: var(--primary); margin: 6px 0 10px; }
.name-chip-group { display: flex; flex-wrap: wrap; gap: 10px; }
.name-chip { padding: 7px 18px; border: 1px solid var(--border); border-radius: 22px; font-size: 14px; color: var(--text-primary); background: #fff; cursor: pointer; transition: all 0.15s; user-select: none; }
.name-chip:hover { border-color: var(--primary-light); color: var(--primary-light); }
.name-chip.active { background: linear-gradient(135deg, var(--primary-light), var(--primary)); color: #fff; border-color: transparent; box-shadow: 0 1px 4px rgba(30,58,111,0.25); }

/* 📐 考试标签名称单选组（名称样式弹窗） */
.scope-style-block { margin-top: 16px; padding: 14px; background: var(--primary-bg); border: 1px solid var(--border-light); border-radius: var(--radius-sm); }
.scope-style-title { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.6; }
.scope-dim { margin-bottom: 10px; }
.scope-dim:last-child { margin-bottom: 0; }
.scope-dim-head { font-weight: 600; color: var(--primary); font-size: 14px; margin-bottom: 8px; }

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
/* 🔧 密封线防御：sealed-wrapper + seal-zone（主题注入的 sealed 样式可能未启用，此处兜底）
   标准试卷样式（A4 + 上下 2cm、左右 2.35cm 页边距）：
   页面壳自带边距（正文不被挤压，虚线不贴正文）；密封区绝对定位于左侧页边距内（纸边 0~20mm，正文内边距外侧）；
   虚线在 19mm、与上下边距对齐（20~277mm）；线(26mm)/封(148mm)/密(271mm) 均匀嵌在虚线上；
   文字逆时针旋转 90°（字头朝左、从下往上读）；字号分级：提示语 12pt bold / 信息栏 12pt / 密·封·线 12pt bold */
.preview-content :deep(.sealed-wrapper) {
  position: relative;
  padding: 20mm 25mm;
  min-height: 100%;
  box-sizing: border-box;
}
.preview-content :deep(.sealed-wrapper > .seal-zone) {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 20mm;
  box-sizing: border-box;
}
.preview-content :deep(.seal-zone > .seal-line) {
  position: absolute;
  top: 20mm;
  bottom: 20mm;
  right: 1mm;
  border-left: 1.4px dashed #000;
}
.preview-content :deep(.seal-zone > .seal-note) {
  position: absolute;
  left: 8mm;
  top: 76.2mm;
  transform-origin: left top;
  transform: rotate(-90deg);
  white-space: nowrap;
  font-size: 12pt;
  font-weight: bold;
  line-height: 1;
}
.preview-content :deep(.seal-zone > .seal-info) {
  position: absolute;
  left: 8mm;
  top: 254.7mm;
  transform-origin: left top;
  transform: rotate(-90deg);
  white-space: nowrap;
  font-size: 12pt;
  line-height: 1;
}
.preview-content :deep(.seal-zone > .seal-char) {
  position: absolute;
  right: 1mm;
  font-size: 10.5pt;
  font-weight: bold;
  line-height: 1;
  transform-origin: center;
  transform: rotate(-90deg);
}
.preview-content :deep(.seal-zone > .seal-char.s-top) { top: 82.4mm; }
.preview-content :deep(.seal-zone > .seal-char.s-mid) { top: 146.6mm; }
.preview-content :deep(.seal-zone > .seal-char.s-bot) { top: 210.9mm; }
.preview-content :deep(.seal-zone p) { margin: 0; }
.preview-content :deep(.sealed-wrapper > .sealed-content) {
  margin-left: 0;
  box-sizing: border-box;
}

.preview-content :deep(.blank-line) {
  display: inline-block;
  min-width: 3em;
  border-bottom: 1.5px solid #666;
  margin: 0 2px;
  vertical-align: baseline;
}

/* 🔧 行尾自动延伸：blank-line / u.blank-N 为段落最后元素时，段落变 flex、横线弹性撑满剩余行宽
   （与导出端 <w:ptab/> 自动画到右边距行为一致，所见即所得） */
.preview-content :deep(p:has(> .blank-line:last-child)),
.preview-content :deep(p:has(> u[class*="blank-"]:last-child)) {
  display: flex;
  align-items: baseline;
}
.preview-content :deep(p:has(> .blank-line:last-child) .blank-line),
.preview-content :deep(p:has(> u[class*="blank-"]:last-child) u[class*="blank-"]) {
  flex: 1 1 auto;
  min-width: 3em;
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
  font-size: 14px;
  margin-bottom: 6px;
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
  font-size: 13px;
  color: #1a1a1a;
  line-height: 1.6;
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
/* 🔧 密封线：标准试卷样式（A4 + 上下 2cm、左右 2.35cm 页边距）——
   页面壳自带边距（正文不被挤压，虚线不贴正文）；密封区绝对定位于左侧页边距内（纸边 0~20mm，正文内边距外侧）；
   虚线在 19mm、与上下边距对齐（20~277mm）；线(26mm)/封(148mm)/密(271mm) 均匀嵌在虚线上；
   文字逆时针旋转 90°（字头朝左、从下往上读）；字号分级：提示语 12pt bold / 信息栏 12pt / 密·封·线 12pt bold */
.sealed-wrapper {
  position: relative;
  padding: 20mm 25mm;
  min-height: 100%;
  box-sizing: border-box;
}
.sealed-wrapper > .seal-zone {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 20mm;
  box-sizing: border-box;
}
.seal-zone > .seal-line {
  position: absolute;
  top: 20mm;
  bottom: 20mm;
  right: 1mm;
  border-left: 1.4px dashed #000;
}
.seal-zone > .seal-note {
  position: absolute;
  left: 8mm;
  top: 76.2mm;
  transform-origin: left top;
  transform: rotate(-90deg);
  white-space: nowrap;
  font-size: 12pt;
  font-weight: bold;
  line-height: 1;
}
.seal-zone > .seal-info {
  position: absolute;
  left: 8mm;
  top: 254.7mm;
  transform-origin: left top;
  transform: rotate(-90deg);
  white-space: nowrap;
  font-size: 12pt;
  line-height: 1;
}
.seal-zone > .seal-char {
  position: absolute;
  right: 1mm;
  font-size: 10.5pt;
  font-weight: bold;
  line-height: 1;
  transform-origin: center;
  transform: rotate(-90deg);
}
.seal-zone > .seal-char.s-top { top: 82.4mm; }
.seal-zone > .seal-char.s-mid { top: 146.6mm; }
.seal-zone > .seal-char.s-bot { top: 210.9mm; }
.seal-zone p { margin: 0; }
.sealed-wrapper > .sealed-content {
  margin-left: 0;
  box-sizing: border-box;
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