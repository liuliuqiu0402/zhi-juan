<template>
  <div class="textbook-module">
    <!-- 左侧教材库面板 -->
    <div class="library-panel">
      <div class="panel-header">
        <h3>📚 教材库 ({{ textbookStore.textbooks.length }})</h3>
        <button
          v-if="!isMobile"
          class="btn-primary"
          @click="openUploadModal"
        >
          📤 上传教材
        </button>
      </div>

      <!-- 筛选搜索行 -->
      <!-- 筛选搜索行 -->
      <div class="filter-search-row">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索教材..."
            class="search-input-inline"
          >
        </div>
        <div class="filter-selects">
          <select
            v-model="filterStage"
            class="filter-select"
            @change="onStageChange"
          >
            <option value="">
              学段
            </option>
            <option value="小学">
              小学
            </option>
            <option value="初中">
              初中
            </option>
            <option value="高中">
              高中
            </option>
          </select>
          <select
            v-model="filterGrade"
            :disabled="!filterStage"
            class="filter-select"
          >
            <option value="">
              年级
            </option>
            <option
              v-for="g in gradeOptions"
              :key="g"
            >
              {{ g }}
            </option>
          </select>
          <select
            v-model="filterSubject"
            class="filter-select"
          >
            <option value="">
              学科
            </option>
            <option
              v-for="s in subjectOptions"
              :key="s"
            >
              {{ s }}
            </option>
          </select>
          <select
            v-model="filterVersion"
            class="filter-select"
          >
            <option value="">
              版本
            </option>
            <option
              v-for="v in versionOptions"
              :key="v"
            >
              {{ v }}
            </option>
          </select>
          <select
            v-model="filterSemester"
            class="filter-select"
          >
            <option value="">
              上下册
            </option>
            <option value="上册">
              上册
            </option>
            <option value="下册">
              下册
            </option>
          </select>
          <select
            v-model="sortBy"
            class="filter-select sort-select"
          >
            <option value="name">
              按名称
            </option>
            <option value="subject">
              按学科
            </option>
            <option value="grade">
              按年级
            </option>
            <option value="createdAt">
              按时间
            </option>
          </select>
        </div>
      </div>

      <!-- 批量操作栏 -->
      <div
        v-show="!isMobile || selectedCount > 0"
        class="batch-row"
      >
        <span>已选中 {{ selectedCount }} 本</span>
        <button
          class="btn"
          :disabled="selectedCount === 0"
          @click="batchDelete"
        >
          🗑️ 批量删除
        </button>
        <button
          v-if="!isMobile"
          class="btn"
          :disabled="selectedCount === 0"
          @click="batchExport"
        >
          📤 导出目录
        </button>
        <button
          v-if="!isMobile"
          class="btn btn-primary btn-sm"
          :disabled="unanalyzedCount === 0"
          @click="batchAnalyze"
        >
          🤖 一键分析全部 ({{ unanalyzedCount }})
        </button>
        <button
          class="btn"
          :disabled="selectedCount === 0"
          @click="clearSelection"
        >
          取消选择
        </button>
      </div>

      <!-- 教材列表 -->
      <div class="textbook-list">
        <div
          v-if="filteredTextbooks.length === 0"
          class="empty-tip"
        >
          <p>📭 还没有教材</p>
          <button
            class="btn-primary"
            @click="openUploadModal"
          >
            📤 上传第一本教材
          </button>
        </div>
        <div
          v-for="book in filteredTextbooks"
          :key="book.id"
          class="textbook-item"
        >
          <div class="item-header">
            <input 
              type="checkbox" 
              :checked="book.selected"
              class="select-checkbox"
              @change="(e) => toggleBookSelection(book, e.target.checked)" 
            >
            <img
              v-if="book.coverPath && !book.coverFailed"
              :src="book.coverPath"
              class="book-cover"
              @error="book.coverFailed = true"
            >
            <div
              v-if="!book.coverPath || book.coverFailed"
              class="book-cover-placeholder"
            >
              📘
            </div>
            <div
              class="item-info"
              @click="toggleExpand(book.id)"
            >
              <span class="expand-icon">{{ expandedBooks.includes(book.id) ? '▼' : '▶' }}</span>
              <span class="book-name">{{ book.name }}</span>
              <span class="chapter-count">{{ countChapters(book.outline) }}个章节 {{ countAnalyzed(book.outline) > 0 ? '· ✅' + countAnalyzed(book.outline) : '' }}</span>
            </div>
            <div class="item-actions">
              <button
                class="icon-btn"
                title="重命名"
                @click.stop="renameTextbook(book)"
              >
                ✏️
              </button>
              <button
                class="icon-btn"
                title="删除"
                @click.stop="deleteTextbook(book)"
              >
                🗑️
              </button>
            </div>
          </div>
          <div
            v-if="expandedBooks.includes(book.id)"
            class="outline-tree"
          >
            <div
              v-if="!book.outline || book.outline.length === 0"
              class="empty-outline"
            >
              暂无目录结构
            </div>
            <OutlineTreeNode 
              v-for="(node, idx) in book.outline" 
              :key="idx" 
              :node="node" 
              :level="0"
              :book-data="book"
              @update="onChapterUpdate"
              @preview="handlePreview"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧预览面板 -->
    <div
      v-if="showPreview"
      class="preview-panel"
    >
      <div class="preview-header">
        <h3>📖 {{ previewData.title }}</h3>
        <button
          class="close-btn"
          @click="closePreview"
        >
          ✕
        </button>
      </div>
      <div class="preview-info">
        <span class="page-range">第 {{ previewData.start }} - {{ previewData.end }} 页</span>
        <div class="page-nav">
          <button
            class="nav-btn"
            :disabled="currentPreviewPage <= previewData.start"
            @click="prevPage"
          >
            ◀ 上一页
          </button>
          <span class="page-indicator">{{ currentPreviewPage }} / {{ previewData.end }}</span>
          <button
            class="nav-btn"
            :disabled="currentPreviewPage >= previewData.end"
            @click="nextPage"
          >
            下一页 ▶
          </button>
        </div>
      </div>
      <PdfPreview 
        ref="pdfPreviewRef" 
        :pdf-path="pdfPath" 
        :page="currentPreviewPage"
        :large-file="true"
        @page-change="(page) => currentPreviewPage = page"
      />
    </div>

    <!-- 没有预览时显示提示（仅桌面端） -->
    <div
      v-else-if="!isMobile"
      class="preview-panel preview-empty-state"
    >
      <div class="empty-hint">
        <span class="empty-icon">👈</span>
        <p>点击左侧目录中的章节名称<br>即可在此预览内容</p>
      </div>
    </div>

    <!-- 上传弹窗 -->
    <div
      v-if="showUploadModal"
      class="modal-mask"
      @click.self="closeUploadModal"
    >
      <div class="modal">
        <h3>📤 上传教材</h3>
        <button
          class="btn btn-full"
          @click="selectFileHandler"
        >
          📁 选择文件（支持 PDF / Word / 图片）
        </button>
        <p
          v-if="selectedFilePath"
          class="file-name"
        >
          {{ selectedFilePath.split('\\').pop() }}
        </p>
        
        <div
          v-if="selectedFilePath"
          class="upload-meta"
        >
          <div class="meta-item">
            <label>学段</label>
            <select
              v-model="uploadStage"
              @change="onUploadStageChange"
            >
              <option value="">
                自动识别
              </option>
              <option value="小学">
                小学
              </option>
              <option value="初中">
                初中
              </option>
              <option value="高中">
                高中
              </option>
            </select>
          </div>
          <div class="meta-item">
            <label>年级</label>
            <select
              v-model="uploadGrade"
              :disabled="!uploadStage"
            >
              <option value="">
                自动识别
              </option>
              <option
                v-for="g in uploadGradeOptions"
                :key="g"
              >
                {{ g }}
              </option>
            </select>
          </div>
          <div class="meta-item">
            <label>学科</label>
            <select v-model="uploadSubject">
              <option value="">
                自动识别
              </option>
              <option
                v-for="s in subjectOptions"
                :key="s"
              >
                {{ s }}
              </option>
            </select>
          </div>
          <div class="meta-item">
            <label>上下册</label>
            <select v-model="uploadSemester">
              <option value="">
                自动识别
              </option>
              <option value="上册">
                上册
              </option>
              <option value="下册">
                下册
              </option>
            </select>
          </div>
        </div>
        
        <div class="modal-actions">
          <button
            class="btn"
            @click="closeUploadModal"
          >
            取消
          </button>
          <button
            class="btn-primary"
            :disabled="!selectedFilePath"
            @click="confirmUpload"
          >
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 目录页设置弹窗 -->
    <div
      v-if="showCatalogPageModal"
      class="modal-mask"
      @click.self="closeCatalogPageModal"
    >
      <div
        ref="catalogModalRef"
        class="modal draggable-modal"
        style="max-width: 560px;"
      >
        <div
          class="modal-drag-handle"
          @mousedown="startDrag($event, 'catalog')"
        />
        <div class="catalog-modal-header">
          <span class="catalog-modal-icon">📖</span>
          <h3>目录页设置</h3>
          <p class="catalog-modal-desc">
            请指定教材目录所在的页码范围
          </p>
        </div>
        
        <div class="catalog-form-group">
          <label class="catalog-label">📄 页码范围</label>
          <input 
            v-model="pageRange" 
            type="text" 
            placeholder="例如：5-8 或 5" 
            class="catalog-input"
          >
          <div class="catalog-examples">
            <span class="example-label">快捷填充：</span>
            <span
              class="example-tag"
              @click="pageRange = '1-2'"
            >1-2</span>
            <span
              class="example-tag"
              @click="pageRange = '3-6'"
            >3-6</span>
            <span
              class="example-tag"
              @click="pageRange = ''"
            >留空</span>
          </div>
          
          <label
            class="ai-checkbox"
            style="margin-top: 12px; display: flex; align-items: center; gap: 8px; cursor: pointer;"
          >
            <input
              v-model="useAiRecognition"
              type="checkbox"
            >
            <span>🤖 使用 AI 智能识别（可处理复杂分栏排版，扫描型PDF推荐）</span>
          </label>
          <div
            v-if="useAiRecognition"
            style="margin-top: 4px; padding-left: 24px; font-size: 12px; color: var(--text-muted);"
          >
            💡 使用 PaddleOCR-VL 引擎（本地离线识别，准确率高，无需联网）
          </div>
        </div>
        
        <div class="catalog-hint-box">
          <p>💡 <strong>使用技巧：</strong></p>
          <ul>
            <li>直接点击「开始识别」可跳过此步</li>
            <li>在下一步用 <strong>微信截图(Alt+A)</strong> 一键导入目录，更精准！</li>
            <li>留空则直接进入目录确认弹窗</li>
          </ul>
        </div>
        
        <div class="modal-actions">
          <button
            class="btn"
            @click="closeCatalogPageModal"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="startOutlineEditor"
          >
            🚀 开始识别
          </button>
        </div>
      </div>
    </div>

    <!-- 目录确认弹窗 -->
    <div
      v-if="showOutlineEditor"
      class="modal-mask"
    >
      <div
        ref="outlineModalRef" 
        class="modal large-modal outline-editor-modal draggable-modal"
        :class="{ 'maximized': isMaximized }"
      >
        <div
          class="modal-drag-handle"
          @mousedown="startDrag($event, 'outline')"
        />
        <div class="outline-editor-title">
          <h3>📑 确认目录结构</h3>
          <div class="title-actions">
            <button
              v-if="!isMaximized"
              class="icon-btn"
              title="最大化"
              @click="maximizeModal"
            >
              ⛶
            </button>
            <button
              v-if="isMaximized"
              class="icon-btn"
              title="还原"
              @click="restoreModal"
            >
              🗗
            </button>
          </div>
        </div>
        <div class="warning-tip">
          <span>⚠️ 请仔细核对以下内容，确认无误后再保存</span>
          <ul style="margin-top: 8px; font-size: 13px;">
            <li>💡 快捷方式：用微信截图(Alt+A)提取目录文字 → 点击「从剪贴板导入」</li>
            <li>📌 模板导入：点击「📥 下载模板」→ 用 Excel 填写 → 全选复制 → 导入</li>
            <li>👆 点击表格可直接修改页码</li>
          </ul>
        </div>
        <div class="offset-row">
          <label>📐 页码偏移量：</label>
          <div class="offset-input-group">
            <button
              class="btn offset-btn"
              @click="pageOffset = Math.max(0, pageOffset - 1); applyOffset()"
            >
              −
            </button>
            <input
              v-model.number="pageOffset"
              type="number"
              class="offset-number-input"
              @input="applyOffset"
            >
            <button
              class="btn offset-btn"
              @click="pageOffset = pageOffset + 1; applyOffset()"
            >
              +
            </button>
          </div>
          <span>
            （目录写第1页，实际在PDF第20页，则填19）
            <span
              v-if="previewData"
              style="color:var(--primary-light);font-weight:500;"
            >
              📐 当前：目录第{{ previewData.start }}页 = PDF第{{ currentPreviewPage }}页 → 偏移{{ currentPreviewPage - previewData.start }}
            </span>
          </span>
        </div>
        <div
          v-if="pdfPageHint"
          style="padding:8px 12px; background:var(--success-light); border-radius:8px; margin-top:8px; color:#2e7d32; font-weight:500;"
        >
          {{ pdfPageHint }}
        </div>        
        <div class="action-row">
          <button
            class="btn"
            title="在选中行下方插入新章节"
            @click="insertBefore = false; addManualChapter()"
          >
            ➕ 下方添加
          </button>
          <button
            class="btn"
            title="在选中行上方插入新章节"
            @click="insertBefore = true; addManualChapter()"
          >
            ⬆️ 上方添加
          </button>
          <button
            class="btn-primary"
            @click="showImportModal = true"
          >
            📋 导入目录
          </button>
          <button
            class="btn"
            @click="loadExistingOutline"
          >
            📂 加载原有目录
          </button>
          <button
            class="btn"
            @click="downloadTemplate"
          >
            📥 下载模板
          </button>
          <button
            v-if="flatOutline.length > 0"
            class="btn"
            @click="clearAllChapters"
          >
            🗑️ 清空所有
          </button>
          <div class="batch-level-group">
            <span class="batch-level-label">批量层级：</span>
            <select
              v-model="batchTargetLevel"
              class="batch-level-select"
            >
              <option :value="0">
                一级
              </option>
              <option :value="1">
                二级
              </option>
              <option :value="2">
                三级
              </option>
              <option :value="3">
                四级
              </option>
              <option :value="4">
                五级
              </option>
            </select>
            <button
              class="btn btn-primary btn-sm"
              @click="batchSetLevel"
            >
              批量修改
            </button>
          </div>
        </div>
        <div class="table-container-wrapper">
          <div class="table-container">
            <table class="outline-table">
              <thead>
                <tr>
                  <th style="min-width: 200px;">
                    <input
                      type="checkbox"
                      :checked="allSelected"
                      class="row-checkbox"
                      style="margin-right: 8px;"
                      @change="toggleSelectAll"
                    >
                    章节标题
                  </th>
                  <th style="width: 80px;">
                    页码
                  </th>
                  <th style="width: 70px;">
                    层级
                  </th>
                  <th style="width: 100px;">
                    页码范围
                  </th>
                  <th style="width: 120px;">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in flatOutline"
                  :key="index"
                  :class="{ 'row-focused': focusedRow === index }"
                >
                  <td
                    class="td-title"
                    style="display: flex; align-items: center; padding: 0 !important;"
                  >
                    <input
                      v-model="item.selected"
                      type="checkbox"
                      class="row-checkbox"
                      style="margin-left: 8px; flex-shrink: 0;"
                    >
                    <div
                      class="title-cell-wrapper"
                      :style="{ paddingLeft: (item.level * 20) + 'px', flex: 1 }"
                    >
                      <input 
                        v-model="item.title" 
                        :class="{ 'error-input': !item.title }" 
                        class="cell-input title-input"
                        @focus="focusedRow = index"
                        @blur="focusedRow = -1"
                      >
                    </div>
                  </td>
                  <td>
                    <input 
                      v-model.number="item.page" 
                      type="number" 
                      :class="{ 'error-input': !item.page || item.page < 1 }" 
                      class="cell-input"
                      @change="updatePageRange()"
                      @focus="focusedRow = index"
                      @blur="focusedRow = -1"
                    >
                  </td>
                  <td style="text-align:center;">
                    <span v-if="item.level === 0">一级</span>
                    <span v-else-if="item.level === 1">二级</span>
                    <span v-else-if="item.level === 2">三级</span>
                    <span v-else-if="item.level === 3">四级</span>
                    <span v-else>五级</span>
                  </td>
                  <td class="page-range-cell">
                    <input 
                      type="text" 
                      :value="item.start + ' - ' + item.end"
                      class="cell-input"
                      style="text-align:center;"
                      @focus="$event.target.select()"
                      @blur="parsePageRange($event, index)"
                      @keyup.enter="parsePageRange($event, index)"
                    >
                  </td>
                  <td>
                    <button
                      class="icon-btn"
                      title="页码对照"
                      @click="showPageHint(index)"
                    >
                      👁️
                    </button>
                    <button
                      class="icon-btn"
                      :disabled="item.level >= 4"
                      title="提升层级"
                      @click="increaseIndent(index)"
                    >
                      ↪️
                    </button>
                    <button
                      class="icon-btn"
                      :disabled="item.level <= 0"
                      title="降低层级"
                      @click="decreaseIndent(index)"
                    >
                      ↩️
                    </button>
                    <button
                      class="icon-btn"
                      title="删除"
                      @click="deleteChapter(index)"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p
          v-if="flatOutline.length === 0"
          class="empty-tip"
        >
          😕 没有目录数据，请手动添加或导入
        </p>
        <div class="render-loading-bar">
          ⚠️ 光标出现前请勿鼠标点击，正在准备编辑区域...
        </div>        
        <p class="total-pages-hint">
          📌 最后一章自动延伸至第 {{ totalPages }} 页，可手动修改页码范围
        </p>
        <p
          class="total-pages-hint"
          style="color: var(--primary-light);"
        >
          ⌨️ 点击出现光标后，按 <strong>Alt</strong> 键聚焦编辑
        </p>
        <div class="modal-actions">
          <button
            class="btn"
            @click="closeOutlineEditor"
          >
            取消
          </button>
          <button
            class="btn"
            @click="goBackToCatalogPage"
          >
            ← 返回
          </button>
          <button
            class="btn-primary"
            :disabled="isSaving || !isValid"
            @click="saveTextbook"
          >
            {{ isSaving ? '保存中...' : '确认并保存' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showInlinePreview" 
      ref="inlinePreviewRef"
      :style="{ 
        position: 'fixed', 
        left: inlinePreviewPos.x + 'px', 
        top: inlinePreviewPos.y + 'px', 
        width: inlinePreviewSize.width + 'px', 
        height: inlinePreviewSize.height + 'px',
        minWidth: '300px',
        minHeight: '350px',
        background: 'white', 
        border: '2px solid var(--primary-light)', 
        borderRadius: '12px', 
        zIndex: 4500, 
        overflow: 'hidden', 
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column'
      }"
    >
      <!-- 拖动条 -->
      <div 
        style="display:flex; justify-content:space-between; align-items:center; padding:6px 12px; background:var(--primary); color:white; cursor:move; user-select:none; flex-shrink:0;" 
        @mousedown="startInlineDrag"
      >
        <span style="font-size:13px;">📖 PDF 预览</span>
        <div style="display:flex; gap:6px; align-items:center;">
          <button
            style="background:rgba(255,255,255,0.2); border:none; color:white; cursor:pointer; padding:3px 8px; border-radius:4px; font-size:12px;"
            @click="inlinePreviewPage = Math.max(1, inlinePreviewPage - 1)"
          >
            ◀
          </button>
          <span style="font-size:12px;">第 {{ inlinePreviewPage }} 页</span>
          <button
            style="background:rgba(255,255,255,0.2); border:none; color:white; cursor:pointer; padding:3px 8px; border-radius:4px; font-size:12px;"
            @click="inlinePreviewPage = inlinePreviewPage + 1"
          >
            ▶
          </button>
          <button
            style="background:none; border:none; color:white; cursor:pointer; font-size:18px; margin-left:4px;"
            @click="showInlinePreview = false"
          >
            ✕
          </button>
        </div>
      </div>
      <!-- 内容区 -->
      <div style="flex:1; min-height:0;">
        <PdfPreview
          :pdf-path="tempFilePath"
          :page="inlinePreviewPage"
          @page-change="(page) => inlinePreviewPage = page"
        />
      </div>
      <div style="padding:8px 12px; background:#f0f7ff; font-size:12px; color:var(--primary-light); flex-shrink:0;">
        📐 目录页码：{{ currentHintPage }} → 请翻到对应页，看实际页码
      </div>
      <!-- 右下角调整大小手柄 -->
      <div 
        style="position:absolute; right:0; bottom:0; width:20px; height:20px; cursor:nwse-resize; z-index:10;"
        title="拖动调整大小"
        @mousedown="startInlineResize"
      >
        <div style="position:absolute; right:3px; bottom:3px; width:10px; height:10px; border-right:2px solid var(--text-muted); border-bottom:2px solid var(--text-muted);" />
      </div>
    </div> 

    <!-- Loading 遮罩 -->
    <div
      v-if="isSaving"
      class="loading-mask"
    >
      <div class="loading-content">
        <div class="spinner" />
        <p>{{ saveStatus }}</p>
      </div>
    </div>

    <!-- 导入选择弹窗 -->
    <div
      v-if="showImportModal"
      class="modal-mask"
      @click.self="showImportModal = false"
    >
      <div
        class="modal"
        style="max-width: 360px;"
      >
        <h3>📋 选择导入方式</h3>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px;">
          <button
            class="btn-primary"
            @click="importFromClipboard(true)"
          >
            📋 从剪贴板导入
            <span class="hint">（微信截图 OCR 后复制的内容）</span>
          </button>
          <button
            class="btn"
            @click="showImportModal = false; importTemplateFile()"
          >
            📤 导入模板文件
            <span class="hint">（已填好的 CSV 模板文件）</span>
          </button>
        </div>
        <div class="modal-actions">
          <button
            class="btn"
            @click="showImportModal = false"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 查看/编辑章节分析弹窗（左右两栏） -->
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
            <div class="chapter-analysis-right">
              <!-- ✅ 可编辑字段 - 始终显示 -->
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
            
              <!-- 🔧 只读显示字段 - 根据分析结果显示 -->
              <div
                v-if="viewingChapter.knowledgeHierarchy && viewingChapter.knowledgeHierarchy.length > 0"
                class="detail-item"
              >
                <strong>🎯 知识层级：</strong>
                <div style="margin-top:8px;background:#f8f9fa;padding:10px;border-radius:6px;">
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
            
              <div
                v-if="viewingChapter.ocrQuality"
                class="detail-item"
              >
                <strong>📊 OCR质量：</strong>
                <div style="padding:6px 10px;background:#f8f9fa;border-radius:6px;font-size:13px;color:#555;">
                  {{ viewingChapter.ocrQuality }}
                </div>
              </div>
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
            @click="discardChapterAnalysis"
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, shallowRef, nextTick, h, watch } from 'vue';
import { useDialog } from '../composables/useDialog.js';
import ExcelJS from 'exceljs';
import { getStoragePath, resolveStoredPath } from '../utils/pathHelper.js';  // ✨ 存储路径工具
import { useTextbookStore } from '../stores/textbookStore';
import { useFileHandler } from '../composables/useFileHandler.js';
import { convertFormulasInHtml } from '../utils/wordExporter.js';
import { useTocParser, safeFocusOutlineInput, fastFocusInput, smartFocusInput, fastCalculatePageRanges, fastRebuildTree } from '../composables/useTocParser.js';
import { subjects, subjectGradeSystem } from '../config/expertKnowledge.js';
import { autoDetectTextbookMeta } from '../utils/textbookMeta.js'; // 教材名元数据识别（课本库/模板库共用单一实现，曾双份逐字副本）
import { useAiGenerator } from '../composables/useAiGenerator.js';
import { deepClone } from '../utils/helpers';
import PdfPreview from '../components/PdfPreview.vue';
import RichTextEditor from '../components/RichTextEditor.vue';
import { APP_EVENTS } from '../constants/events.js';
import { useMobile } from '../composables/useMobile.js';

defineOptions({ name: 'TextbookModule' });


// ✅ 图片压缩函数
const compressImage = (base64, maxWidth = 1500) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth) { resolve(base64); return; }
      const ratio = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75).split(',')[1]);
    };
    img.onerror = () => resolve(base64);
    img.src = `data:image/jpeg;base64,${base64}`;
  });
};

// 目录树节点组件
const OutlineTreeNode = {
  name: 'OutlineTreeNode',
  props: {
    node: { type: Object, required: true },
    level: { type: Number, default: 0 },
    bookData: { type: Object, required: true }
  },
  emits: ['update', 'preview'],
  data() {
    return {
      expanded: false
    };
  },
  render() {
    const { node, level, bookData } = this;
    const children = node.children || [];
    const hasChildren = children.length > 0;
    
    const childrenVNodes = hasChildren && this.expanded
      ? children.map((child, idx) => 
          h(OutlineTreeNode, {
            key: idx,
            node: child,
            level: level + 1,
            bookData: bookData,
            onUpdate: () => this.$emit('update'),
            onPreview: (data) => this.$emit('preview', data)
          })
        )
      : [];
    
    return h('div', { class: 'outline-node' }, [
      h('div', {
        class: 'chapter-item',
        style: { 
          paddingLeft: (level * 16) + 'px',
          paddingTop: '6px',
          paddingBottom: '6px',
          lineHeight: '1.8',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.75rem',
          cursor: 'pointer'
        }
      }, [
        h('span', {
          class: 'toggle-icon-wrapper',
          style: { width: '16px', display: 'inline-flex', flexShrink: '0' }
        }, [
          hasChildren 
            ? h('span', {
                class: 'toggle-icon',
                onClick: (e) => { e.stopPropagation(); this.expanded = !this.expanded; }
              }, this.expanded ? '▾' : '▸')
            : h('span', { class: 'toggle-placeholder' }, '')
        ]),
        
        h('input', {
          type: 'checkbox',
          checked: !!node.selected,
          onClick: (e) => {
            e.stopPropagation();
            // ✅ 必须用 e.target.checked 获取点击后的状态
            const newState = e.target.checked;
    
            // 递归设置当前节点及所有子节点
            const setNodeAndChildren = (n, state) => {
              n.selected = state;
              if (n.children && n.children.length > 0) {
                n.children.forEach(child => setNodeAndChildren(child, state));
              }
            };
            setNodeAndChildren(node, newState);
    
            // 向上更新所有父节点状态
            const updateParentStatus = (treeNodes, targetNode) => {
              for (const n of treeNodes) {
                if (n.children && n.children.length > 0) {
                  if (n.children.includes(targetNode)) {
                    n.selected = n.children.every(child => child.selected);
                    return true;
                  }
                  if (updateParentStatus(n.children, targetNode)) {
                    if (n.children) {
                      n.selected = n.children.every(child => child.selected);
                    }
                    return true;
                  }
                }
              }
              return false;
            };
            updateParentStatus(this.bookData.outline, node);
            this.$emit('update');
          }
        }),
        h('span', { 
          class: 'chapter-title',
          onClick: () => {
            this.$emit('preview', {
              title: node.title,
              start: node.start,
              end: node.end,
              imagesDir: bookData.imagesDir
            });
          }
        }, node.title || ''),
        (node.analyzed && node.rawText && node.rawText.trim().length > 0) ? h('span', {
          style: { cursor: 'pointer', marginLeft: '4px', fontSize: '0.7rem' },
          title: '查看分析详情',
          onClick: (e) => {
            e.stopPropagation();
            textbookStore.openChapterAnalysis(bookData, node);
          }
        }, '👁️') : null,
        h('span', { 
          style: { fontSize: '0.65rem', marginLeft: '4px' }
        }, node.analyzed ? '✅' : '⬜'),
        h('span', { class: 'page-range' }, ` 第${node.start || 0}-${node.end || 0}页`)
      ]),
      ...childrenVNodes
    ]);
  }
};

// Composables
const { selectFiles, getTotalPages, pdfToImages, pdfPagesToImages, addPdfBookmarks, moveFile, pathExists, deleteFile, deleteDirectory, createDirectory, createThumbnail } = useFileHandler();
const textbookStore = useTextbookStore();
const { isMobile } = useMobile();
const { parseClipboardText, flattenOutline, countChapters, rebuildTree } = useTocParser();
const countAnalyzed = (nodes) => {
  if (!nodes || !Array.isArray(nodes)) return 0;
  let count = 0;
  for (const node of nodes) {
    if (node && node.analyzed) count++;
    if (node && node.children?.length) count += countAnalyzed(node.children);
  }
  return count;
};
const { callMultimodalAI, checkModelReady } = useAiGenerator();

const { 
  showInputDialogFn,
  showConfirmDialogFn,
  showAlertDialogFn
} = useDialog();

// 教材库数据
const expandedBooks = ref([]);
const searchKeyword = ref('');
const sortBy = ref('name');
const filterStage = ref('');
const filterGrade = ref('');
const filterSubject = ref('');
// 🔧 stage 映射常量（UI 显示中文，存储英文）
const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
// 上传弹窗中的选择
const uploadStage = ref('');
const uploadGrade = ref('');
const uploadSubject = ref('');
const uploadSemester = ref('');

const uploadGradeOptions = computed(() => {
  if (!uploadStage.value) return [];
  const stageSubjects = subjectGradeSystem[uploadStage.value] || {};
  const allGrades = new Set();
  Object.values(stageSubjects).forEach(s => s.grades?.forEach(g => allGrades.add(g)));
  return Array.from(allGrades);
});

const onUploadStageChange = () => {
  uploadGrade.value = '';
};
const filterVersion = ref('');
const filterSemester = ref('');
// 从现有教材名称中提取版本
const versionOptions = computed(() => {
  const versions = new Set();
  let list = textbookStore.textbooks;
  if (filterSubject.value) {
    list = list.filter(t => t.subject === filterSubject.value);
  }
  for (const tpl of list) {
    const vMatch = tpl.name.match(/(人教版|苏教版|北师大版|外研版|粤教版|湘教版|鲁教版|浙教版|沪教版|川教版|闽教版|冀教版|鄂教版|译林版|人教PEP版)/);
    if (vMatch) {
      versions.add(vMatch[1]);
    } else {
      versions.add('通用');
    }
  }
  return Array.from(versions).sort();
});

// 焦点行
const focusedRow = ref(-1);
const pdfPageHint = ref('');
const showInlinePreview = ref(false);
const inlinePreviewPage = ref(1);
const currentHintPage = ref(0);
const inlinePreviewRef = ref(null);
const inlinePreviewPos = ref({ x: window.innerWidth - 420, y: 80 });
const inlinePreviewSize = ref({ width: 380, height: 550 });

// 内联预览拖动
let isInlineDragging = false;
let inlineDragStart = { x: 0, y: 0 };

const startInlineDrag = (e) => {
  isInlineDragging = true;
  inlineDragStart = { 
    x: e.clientX - inlinePreviewPos.value.x, 
    y: e.clientY - inlinePreviewPos.value.y 
  };
  document.addEventListener('mousemove', handleInlineDrag);
  document.addEventListener('mouseup', stopInlineDrag);
  e.preventDefault();
};

const handleInlineDrag = (e) => {
  if (!isInlineDragging) return;
  inlinePreviewPos.value = {
    x: Math.max(0, Math.min(e.clientX - inlineDragStart.x, window.innerWidth - inlinePreviewSize.value.width)),
    y: Math.max(0, Math.min(e.clientY - inlineDragStart.y, window.innerHeight - 50))
  };
};

const stopInlineDrag = () => {
  isInlineDragging = false;
  document.removeEventListener('mousemove', handleInlineDrag);
  document.removeEventListener('mouseup', stopInlineDrag);
};

// 内联预览调整大小
let isInlineResizing = false;
let inlineResizeStart = { x: 0, y: 0, width: 0, height: 0 };

const startInlineResize = (e) => {
  isInlineResizing = true;
  inlineResizeStart = {
    x: e.clientX,
    y: e.clientY,
    width: inlinePreviewSize.value.width,
    height: inlinePreviewSize.value.height
  };
  document.addEventListener('mousemove', handleInlineResize);
  document.addEventListener('mouseup', stopInlineResize);
  e.preventDefault();
  e.stopPropagation();
};

const handleInlineResize = (e) => {
  if (!isInlineResizing) return;
  const newWidth = Math.max(300, inlineResizeStart.width + (e.clientX - inlineResizeStart.x));
  const newHeight = Math.max(350, inlineResizeStart.height + (e.clientY - inlineResizeStart.y));
  inlinePreviewSize.value = { width: newWidth, height: newHeight };
};

const stopInlineResize = () => {
  isInlineResizing = false;
  document.removeEventListener('mousemove', handleInlineResize);
  document.removeEventListener('mouseup', stopInlineResize);
};

// 批量层级选择
const batchTargetLevel = ref(0);

// ✅ 手动添加方向：false=下方插入, true=上方插入
const insertBefore = ref(false);

// 学科选项
const subjectOptions = subjects;
const gradeOptions = computed(() => {
  if (!filterStage.value) return [];
  const stageSubjects = subjectGradeSystem[filterStage.value] || {};
  const allGrades = new Set();
  Object.values(stageSubjects).forEach(s => s.grades?.forEach(g => allGrades.add(g)));
  return Array.from(allGrades);
});
const onStageChange = () => { filterGrade.value = ''; };

// 计算属性
const selectedCount = computed(() => textbookStore.selectedCount);

// 批量分析：计算所有选中教材中未分析的章节数
const unanalyzedCount = computed(() => {
  let count = 0;
  const countUnanalyzed = (nodes) => {
    if (!nodes) return;
    for (const node of nodes) {
      const isSelected = node.selected || nodes === textbookStore.selectedBooks.flatMap(b => b.outline || []);
      if (node.selected && !node.analyzed) count++;
      if (node.children) countUnanalyzed(node.children);
    }
  };
  for (const book of textbookStore.selectedBooks) {
    if (book.outline) countUnanalyzed(book.outline);
  }
  return count;
});

const batchAnalyze = () => {
  if (unanalyzedCount.value === 0) return;
  window.dispatchEvent(new CustomEvent(APP_EVENTS.SWITCH_TAB, { detail: { tab: 'generate' } }));
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('batch-analyze', { detail: { count: unanalyzedCount.value } }));
  }, 300);
};

const filteredTextbooks = computed(() => {
  let result = textbookStore.textbooks;
  if (searchKeyword.value.trim()) result = result.filter(b => b.name.toLowerCase().includes(searchKeyword.value.trim().toLowerCase()));
  if (filterStage.value) {
    // 🔑 兼容旧数据的英文 stage（primary/middle/high）
    const enStage = stageMap[filterStage.value] || filterStage.value;
    result = result.filter(b => b.stage === filterStage.value || b.stage === enStage);
  }
  if (filterGrade.value) result = result.filter(b => b.grade === filterGrade.value);
  if (filterSubject.value) result = result.filter(b => b.subject === filterSubject.value);
  if (filterSemester.value) result = result.filter(b => b.semester === filterSemester.value);
  if (filterVersion.value) {
    result = result.filter(b => {
      const vMatch = b.name.match(/(人教版|苏教版|北师大版|外研版|粤教版|湘教版|鲁教版|浙教版|沪教版|川教版|闽教版|冀教版|鄂教版|译林版|人教PEP版)/);
      if (filterVersion.value === '通用') return !vMatch;
      return vMatch && vMatch[1] === filterVersion.value;
    });
  }  
  return [...result].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name, 'zh-CN');
    if (sortBy.value === 'subject') return (a.subject || '').localeCompare(b.subject || '');
    if (sortBy.value === 'grade') return (a.grade || '').localeCompare(b.grade || '');
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
});

// 上传相关
const showUploadModal = ref(false);
const selectedFilePath = ref('');
const showCatalogPageModal = ref(false);
const pageRange = ref('');
const useAiRecognition = ref(false);
const tempFilePath = ref('');
const textbookName = ref('');
const editingExistingBook = ref(null);

// 模态框拖动相关
const catalogModalRef = ref(null);
const outlineModalRef = ref(null);
const chapterAnalysisModalRef = ref(null);
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const currentDragModal = ref('');

// 目录编辑相关
const showOutlineEditor = ref(false);
const isMaximized = ref(false);

const maximizeModal = () => {
  isMaximized.value = true;
};

const restoreModal = () => {
  isMaximized.value = false;
};

const displayOutline = shallowRef([]);
const originalOutline = ref([]);
// ✅ 表格是否允许交互
const isTableReady = ref(true);
const isRendering = ref(false);
const pageOffset = ref(0);
const totalPages = ref(0);
const isSaving = ref(false);
const saveStatus = ref('');
const showImportModal = ref(false);

// 预览相关
const showPreview = ref(false);
const previewData = ref(null);
const currentPreviewPage = ref(1);

// 当前预览教材的 PDF 路径
const pdfPath = computed(() => {
  // ✅ 目录编辑中，用临时文件（用户刚上传的原始PDF）
  if (showOutlineEditor.value && tempFilePath.value) {
    const ext = tempFilePath.value.split('.').pop().toLowerCase();
    if (ext === 'pdf') return tempFilePath.value;
  }
  // 已保存的教材用存储路径（🔧 修复旧数据中可能存的相对路径；匹配失败时按 id 兜底）
  if (!previewData.value) return '';
  const book = textbookStore.textbooks.find(b => b.imagesDir === previewData.value.imagesDir)
    || textbookStore.textbooks.find(b => b.id === previewData.value.imagesDir);
  return resolveStoredPath(book?.pdfPath || '');
});

// 图片自适应相关
// const previewContainer = ref(null);
// const isImageLoaded = ref(false);
// const imageNaturalSize = ref({ width: 0, height: 0 });

const _flatOutline = computed(() => flattenOutline(displayOutline.value));
const flatOutline = ref([]);

// ✅ 待聚焦的行索引
let pendingFocusIndex = null;

watch(_flatOutline, (val) => {
  flatOutline.value = val;
  
  if (pendingFocusIndex !== null) {
    const idx = pendingFocusIndex;
    pendingFocusIndex = null;
    
    nextTick(() => {
      
      const tryFocus = (retryCount = 0) => {
        const inputs = document.querySelectorAll('.outline-editor-modal .cell-input.title-input');
        if (inputs.length > 0 && inputs[idx]) {
          window.focus();
          if (document.activeElement) document.activeElement.blur();
          setTimeout(() => {
            inputs[idx].focus({ preventScroll: false });
            inputs[idx].select();
            isRendering.value = false;
          }, 10);
        } else if (retryCount < 10) {
          setTimeout(() => tryFocus(retryCount + 1), 100);
        }
      };
      setTimeout(() => tryFocus(), 50);
    });
  }
}, { flush: 'post' });

// ✅ 已移除自动聚焦的 watch，统一由 safeFocusOutlineInput 控制，避免重复聚焦冲突

const isValid = computed(() => flatOutline.value.every(item => item.title && item.page > 0));
const allSelected = computed(() => flatOutline.value.length > 0 && flatOutline.value.every(item => item.selected));

// 计算页码范围
const calculatePageRanges = (flatList) => {
  if (!flatList || flatList.length === 0) return;

  for (let i = 0; i < flatList.length; i++) {
    flatList[i].start = flatList[i].page;
  }

  for (let i = 0; i < flatList.length; i++) {
    let nextPage = totalPages.value + 1;
    for (let j = i + 1; j < flatList.length; j++) {
      if (flatList[j].page !== flatList[i].page) {
        nextPage = flatList[j].page;
        break;
      }
    }
    flatList[i].end = Math.max(flatList[i].page, nextPage - 1);
  }
};

// 异步导入处理（最终优化版）
const asyncImportProcess = async (chapters) => {  
  console.log(`📥 [asyncImportProcess] 收到 ${chapters.length} 条，前3条:`, chapters.slice(0, 3).map(c => ({ t: c.title?.substring(0, 20), p: c.page, l: c.level })));

  showOutlineEditor.value = true;
  showImportModal.value = false;
  
  // 直接设置 flatOutline 数据
  const flatList = chapters.map(item => ({
    title: item.title || '',
    page: item.page || 1,
    level: item.level || 0,
    children: [],
    start: item.page || 1,
    end: 0,
    selected: item.selected || false,
    originalPage: item.originalPage || item.page || 1
  }));

  console.log(`📊 [asyncImportProcess] flatList前5条:`, flatList.slice(0, 5).map(c => ({ t: c.title?.substring(0, 20), p: c.page, l: c.level, op: c.originalPage })));
  
  fastCalculatePageRanges(flatList, totalPages.value);
  
  // 先构建树再赋值
  const tree = fastRebuildTree(flatList, totalPages.value);
  originalOutline.value = tree;
  
  // ✅ 显示遮罩 + 更新树 + 聚焦
  isRendering.value = true;
  updateDisplayTree(tree, 0);
  
  // ✅ 多次重试聚焦，解决 Electron 焦点问题
  const tryFocus = (retryCount = 0) => {
    window.focus();
    const inputs = document.querySelectorAll('.outline-editor-modal .cell-input.title-input');
    if (inputs.length > 0) {
      inputs[0].focus({ preventScroll: false });
      inputs[0].select();
      console.log('✅ 导入聚焦成功，重试次数:', retryCount);
    } else if (retryCount < 10) {
      setTimeout(() => tryFocus(retryCount + 1), 100);
    } else {
      console.warn('⚠️ 导入聚焦超时');
    }
  };
  setTimeout(tryFocus, 100);
  
  return chapters.length;
};

/**
 * 极速聚焦第一个输入框（优化版本）
 */
const focusFirstInput = async () => {
  // ✅ 等待 Vue 完成 DOM 更新
  await nextTick();
  
  // ✅ 使用更快的策略：100ms 延迟
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll('.outline-editor-modal .cell-input.title-input');
      
      if (inputs.length > 0 && inputs[0]) {
        const target = inputs[0];
        
        // ✅ 禁用过渡动画以实现即时视觉反馈
        target.style.transition = 'none';
        
        // ✅ 先聚焦
        target.focus();

        // ✅ 关键修复：减少延迟到 150ms
        setTimeout(() => {
          target.select();
          console.log('✅ 聚焦成功（v-model已绑定）');
          resolve(true);
        }, 150);
      } else {
        console.warn('⚠️ 聚焦失败：未找到输入框');
        resolve(false);
      }
    });
  });
};

// 导入模板文件处理
const importTemplateFile = async () => {
  try {
    const files = await selectFiles();
    if (!files?.length) return;
    
    const filePath = files[0];
    const ext = filePath.split('.').pop().toLowerCase();
    let chapters = [];
    
    if (ext === 'xlsx') {
      const base64Content = await window.electronAPI.readFile(filePath);
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes.buffer);
      const worksheet = workbook.worksheets[0];
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const title = row.getCell(1).value?.toString()?.trim();
        const page = parseInt(row.getCell(2).value) || 1;
        const levelText = row.getCell(3).value?.toString()?.trim();
        const level = levelText === '二级' ? 1 : levelText === '三级' ? 2 : 0;
        if (title && !title.startsWith('📌')) {
          chapters.push({ title, page, level, children: [], start: page, end: 0, selected: false, originalPage: page });
        }
      });
    } else if (ext === 'csv') {
      const content = await window.electronAPI.readFile(filePath);
      const text = atob(content);
      const result = parseClipboardText(text, totalPages.value);
      if (result.success) chapters = (result.flatList || []).map(i => ({ ...i, selected: false }));
    } else {
      console.error('不支持的文件格式:', ext);
      return;
    }
    
    if (!chapters.length) { 
      console.warn('未解析到有效数据');
      return; 
    }

    const count = await asyncImportProcess(chapters);
    console.log(`✅ 模板导入成功，共 ${count} 个章节`);
  } catch (e) {
    console.error('导入模板失败:', e);
  }
};

// 快捷键监听
const handleKeyDown = (e) => {
  // ✅ 渲染期间完全阻止快捷键
  if (isRendering.value) {
    e.preventDefault();
    return;
  }
  
  // 如果焦点在输入框内，不处理快捷键（但允许正常输入）
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
    return;
  }
  
  if (showOutlineEditor.value && e.ctrlKey && e.key === 'v') {
    const isInOutlineModal = activeEl && activeEl.closest('.outline-editor-modal');
    if (isInOutlineModal) {
      e.preventDefault();
      importFromClipboard();
    }
  }
};

// 保存教材到 localStorage
const saveTextbooks = async () => {
  textbookStore.syncBookSelection();
};

// 加载教材
const loadTextbooks = async () => {
  await textbookStore.loadTextbooks();
  console.log('📚 教材subject字段:', textbookStore.textbooks.map(b => b.subject));
};

// 切换展开
const toggleExpand = (id) => {
  const idx = expandedBooks.value.indexOf(id);
  idx > -1 ? expandedBooks.value.splice(idx, 1) : expandedBooks.value.push(id);
};

// ✅ 勾选/取消整本教材
const toggleBookSelection = (book, checked) => {
  textbookStore.toggleBookSelection(book, checked);
};

// ✅ 章节更新时，同步整本教材的勾选状态
const onChapterUpdate = () => {
  textbookStore.syncBookSelection();
};

// 清空选择
const clearSelection = () => textbookStore.clearSelection();

// 批量删除
const batchDelete = async () => {
  const selected = textbookStore.textbooks.filter(b => b.selected);
  const confirmed = await showConfirmDialogFn(`确定删除选中的 ${selected.length} 本教材吗？本地文件也将被永久删除！`);
  if (!confirmed) return;
  for (const b of selected) {
    try {
      if (b.pdfPath) await deleteFile(b.pdfPath);
      if (b.imagesDir) await deleteDirectory(b.imagesDir);
      if (b.coverPath) await deleteFile(b.coverPath);
    } catch (e) {
      console.error('批量删除教材文件失败:', e);
    }
  }
  textbookStore.textbooks = textbookStore.textbooks.filter(b => !b.selected);
  textbookStore.saveTextbooks();
};

// 批量导出
const batchExport = () => {
  const selected = textbookStore.textbooks.filter(b => b.selected);
  let csv = '\uFEFF教材名,章节标题,起始页,结束页\n';
  for (const book of selected) {
    const flat = flattenOutline(book.outline || []);
    flat.forEach(c => {
      csv += `"${book.name}","${c.title}",${c.start},${c.end}\n`;
    });
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `教材目录_${new Date().toLocaleDateString()}.csv`;
  a.click();
};

// 重命名（🔧 联动物理路径：显示名、id、存储目录三者保持一致——存储以名称为标识，
//    仅改显示名会导致"名字与文件/图片对应不上"，改名时同步移动 imagesDir/pdfPath/coverPath）
//    🔧 事务式：任一文件移动失败 → 回滚已移动的，且不更新存储记录（避免 store 指向不存在的文件导致预览空白）
const renameTextbook = async (book) => {
  const newName = await showInputDialogFn('输入新名称', book.name);
  const name = newName?.trim();
  if (!name || name === book.name) return;
  const safeNew = name.replace(/[<>:"/\\|?*]/g, '_');
  if (safeNew === book.id) { textbookStore.updateTextbook(book.id, { name }); return; }
  const storagePath = getStoragePath();
  const newImagesDir = `${storagePath}/教材库/图片/${safeNew}`;
  const newPdfPath = book.pdfPath ? `${storagePath}/教材库/${safeNew}_带书签.pdf` : '';
  const newCoverPath = book.coverPath ? `${storagePath}/教材库/缩略图/${safeNew}.png` : '';
  // 目标冲突预检（图片目录 + PDF + 缩略图）
  const fileExists = async (p) => { try { await window.electronAPI.readFile(p); return true; } catch { return false; } };
  if ((await pathExists(newImagesDir))
      || (newPdfPath && await fileExists(newPdfPath))
      || (newCoverPath && await fileExists(newCoverPath))) {
    await showAlertDialogFn('已存在同名教材的存储文件（图片目录/PDF/缩略图），请换一个名称。');
    return;
  }
  // 事务式移动：全部成功才更新存储；任一失败 → 回滚已移动项并中止
  const moved = [];
  const doMove = async (src, dst) => {
    if (!src) return true;
    const r = await moveFile(src, dst);
    if (r?.success) { moved.push([src, dst]); return true; }
    return false;
  };
  const rollbackMoves = async () => {
    for (const [src, dst] of [...moved].reverse()) {
      try { await moveFile(dst, src); } catch { /* 忽略回滚失败 */ }
    }
  };
  if (!(await doMove(book.imagesDir, newImagesDir))) {
    await showAlertDialogFn('改名失败：图片目录被占用或无法移动，请关闭占用程序后重试。');
    return;
  }
  if (!(await doMove(book.pdfPath, newPdfPath))) {
    await rollbackMoves();
    await showAlertDialogFn('改名失败：PDF 文件被占用（可能正在阅读器中打开），请关闭后重试。');
    return;
  }
  if (!(await doMove(book.coverPath, newCoverPath))) {
    await rollbackMoves();
    await showAlertDialogFn('改名失败：缩略图无法移动，已自动还原，请重试。');
    return;
  }
  textbookStore.updateTextbook(book.id, {
    id: safeNew, name,
    imagesDir: newImagesDir, pdfPath: newPdfPath, coverPath: newCoverPath,
  });
};

// 删除单个
const deleteTextbook = async (book) => {
  const confirmed = await showConfirmDialogFn(`确定删除「${book.name}」吗？`);
  if (!confirmed) return;
  try {
    if (book.pdfPath) await deleteFile(book.pdfPath);
    if (book.imagesDir) await deleteDirectory(book.imagesDir);
    if (book.coverPath) await deleteFile(book.coverPath);
  } catch (e) {
    console.error('删除教材文件失败:', e);
  }
  textbookStore.removeTextbook(book.id);
};

// 上传弹窗
const openUploadModal = () => { showUploadModal.value = true; selectedFilePath.value = ''; };
const closeUploadModal = () => { showUploadModal.value = false; };
const selectFileHandler = async () => {
  const files = await selectFiles();
  if (files?.length) selectedFilePath.value = files[0];
};
const confirmUpload = () => {
  if (!selectedFilePath.value) return;
  showUploadModal.value = false;
  tempFilePath.value = selectedFilePath.value;
  textbookName.value = selectedFilePath.value.split('\\').pop().replace(/\.[^/.]+$/, '');
  
  // 保存用户选择的学段/年级/学科（用于保存教材时读取）
  filterStage.value = uploadStage.value;
  filterGrade.value = uploadGrade.value;
  filterSubject.value = uploadSubject.value;
  filterSemester.value = uploadSemester.value;
  
  const ext = selectedFilePath.value.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    showCatalogPageModal.value = true;
  } else {
    startOutlineEditorForNonPdf();
  }
};

// 目录页设置
const closeCatalogPageModal = () => { showCatalogPageModal.value = false; };

const startOutlineEditor = async () => {
  showCatalogPageModal.value = false;

  window.focus();
  
  try {
    totalPages.value = await getTotalPages(tempFilePath.value);
  } catch (e) {
    console.error('获取PDF总页数失败:', e);
    totalPages.value = 0;
  }
  
  const hasPageRange = pageRange.value.trim();
  
  // 不填页码范围 → 直接手动编辑
  if (!hasPageRange) {
    displayOutline.value = [];
    originalOutline.value = [];
    pageOffset.value = 0;
    showOutlineEditor.value = true;
  
    // ✅ 使用极速聚焦策略
    await focusFirstInput();
    return;
  }
  
  // 勾选AI识别 → 走AI流程
  if (useAiRecognition.value) {
    await startAiOutlineEditor();
    return;
  }
  
  // 填了页码但不勾AI → 进入手动编辑
  displayOutline.value = [];
  originalOutline.value = [];
  pageOffset.value = 0;
  showOutlineEditor.value = true;

  // ✅ 使用极速聚焦策略
  await focusFirstInput();
};

// ✅ AI 识别目录（慢，但能处理扫描件）
const startAiOutlineEditor = async () => {
  isSaving.value = true;
  
  try {
    const ext = tempFilePath.value.split('.').pop().toLowerCase();
    if (ext !== 'pdf') {
      throw new Error('AI 识别仅支持 PDF 文件，其他格式请手动编辑目录');
    }
    
    // 解析页码范围
    const rangeParts = pageRange.value.split('-').map(p => p.trim());
    const startPage = parseInt(rangeParts[0]);
    const endPage = rangeParts.length > 1 ? parseInt(rangeParts[1]) : startPage;
    const pageCount = endPage - startPage + 1;
    
    // 页码范围校验
    if (isNaN(startPage) || isNaN(endPage) || startPage < 1 || endPage < startPage) {
      throw new Error('页码范围格式错误，请输入如 "5-8" 或 "5"');
    }
    
    if (endPage > totalPages.value) {
      throw new Error(`目录结束页(${endPage})超过PDF总页数(${totalPages.value})，请检查页码范围`);
    }
    
    const storagePath = getStoragePath();
    const tempImagesDir = `${storagePath}/暂存区/toc_ai_${Date.now()}`;
    await createDirectory(tempImagesDir);
    
    // 步骤1：批量转换目录页为图片
    saveStatus.value = `📄 步骤1/2：正在转换目录页(${startPage}-${endPage}页，共${pageCount}页)...`;
    
    const tocPages = [];
    for (let page = startPage; page <= endPage; page++) {
      tocPages.push(String(page));
    }
    
    await pdfPagesToImages(tempFilePath.value, tempImagesDir, tocPages);
    
    // 步骤2：逐页AI识别
    let allItems = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < tocPages.length; i++) {
      const page = startPage + i;
      const progress = `(${i + 1}/${pageCount})`;
      
      saveStatus.value = `🤖 步骤2/2：正在AI识别目录 ${progress}...`;
      
      const paddedPage = String(page).padStart(3, '0');
      let imagePath = `${tempImagesDir}/page_${paddedPage}.png`;

      // ✅ 检查文件存在
      const checkFile = async (path) => {
        try { await window.electronAPI.readFile(path); return true; } 
        catch { return false; }
      };

      const pngExists = await checkFile(imagePath);
      if (!pngExists) {
        // ✅ 先试 .jpeg，再试 .jpg
        const jpegPath = `${tempImagesDir}/page_${paddedPage}.jpeg`;
        const jpgPath = `${tempImagesDir}/page_${paddedPage}.jpg`;
        if (await checkFile(jpegPath)) {
          imagePath = jpegPath;
        } else {
          imagePath = jpgPath;
        }
      }
      
      // 检查图片是否存在
      let imageBase64;
      try {
        imageBase64 = await window.electronAPI.readFile(imagePath);
      } catch (e) {
        console.error(`❌ 第 ${page} 页图片读取失败:`, e.message);
        failCount++;
        continue;
      }
      
      if (!imageBase64 || imageBase64.length < 100) {
        console.error(`❌ 第 ${page} 页图片数据异常`);
        failCount++;
        continue;
      }
      
      console.log(`📄 第 ${page} 页图片大小: ${(imageBase64.length / 1024).toFixed(1)}KB`);
      
      // 🔧 目录OCR需要高分辨率，放宽到2000px保留边缘小页码
      try {
        imageBase64 = await compressImage(imageBase64, 2000);
        console.log(`📄 第 ${page} 页压缩后大小: ${(imageBase64.length / 1024).toFixed(1)}KB`);
      } catch (e) {
        console.warn(`第 ${page} 页图片压缩失败，使用原图`);
      }
      
      // 🔧 新增：每页OCR前检测模型就绪状态
      console.log(`🔍 第${page}页目录识别前：检测模型就绪状态...`);
      await checkModelReady(null, 3);
      
      // 带重试的AI调用
      let items = [];
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          const prompt = `请逐行提取图片中所有文字，包括标题、作者、页码。不要遗漏任何一行，包括浅色或缩进的文字。按阅读顺序输出。`;
          
          // PaddleOCR-VL 
          let response;
          
          // ✅ 直接使用 PaddleOCR-VL 多模态识别
          console.log(`🤖 第 ${page} 页：使用多模态 AI 识别...`);
          response = await callMultimodalAI(prompt, imageBase64);
          
          console.log(`📝 第 ${page} 页 AI原始返回:`, response);
          
          if (!response || response.trim().length < 3) {
            console.error(`❌ 第 ${page} 页 AI 返回为空(尝试${retryCount + 1})`);
            throw new Error('AI返回为空');
          }
          
          // 清理返回内容
          let cleanedResponse = response
            .replace(/<\|im_start\|>[\s\S]*?$/g, '')
            .replace(/<\|im_end\|>/g, '')
            .replace(/<\|endoftext\|>/g, '')
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            // 🔧 移除 PaddleOCR-VL 输出的 base64 内嵌图片（NLP 无意义，且让 JSON.parse 失败）
            .replace(/<img\s+[^>]*src="data:image\/[^"]{100,}"[^>]*>/gi, '')
            // 🔧 移除残留 HTML 标签，只保留纯文本
            .replace(/<[^>]+>/g, '')
            .trim();
          
          // 🔧 转换 LaTeX 公式为可读符号（$^{*}$ → *、$x^2$ → x²）
          cleanedResponse = convertFormulasInHtml(cleanedResponse);
          
          console.log(`📝 第 ${page} 页 AI清理后:`, cleanedResponse);
          
          // 解析结果——优先 JSON，非 JSON 直接走文本兜底
          const looksLikeJson = /^\s*[\[{]/.test(cleanedResponse);
          if (looksLikeJson) {
            try {
              const parsed = JSON.parse(cleanedResponse);
              if (Array.isArray(parsed)) {
                items = parsed;
              } else if (parsed && typeof parsed === 'object') {
                items = [parsed];
              }
            } catch (_) {
              // 🔧 多策略 JSON 提取：处理 ```json 包裹、多余文字、多片段等
              let jsonFound = false;
              
              // 策略1：提取 ```json ... ``` 中的内容
              const fencedMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (fencedMatch) {
                try {
                  const parsed = JSON.parse(fencedMatch[1].trim());
                  if (Array.isArray(parsed)) { items = parsed; jsonFound = true; }
                } catch {}
              }
              
              // 策略2：找到最长的 [...] 片段
              if (!jsonFound) {
                const arrMatches = [...cleanedResponse.matchAll(/\[[\s\S]*?\]/g)];
                const longest = arrMatches.reduce((best, m) => m[0].length > (best?.length || 0) ? m[0] : best, '');
                if (longest) {
                  try {
                    const parsed = JSON.parse(longest);
                    if (Array.isArray(parsed)) { items = parsed; jsonFound = true; }
                  } catch {}
                }
              }
              
              // 策略3：尝试把整个响应当作 JSON
              if (!jsonFound) {
                try {
                  const parsed = JSON.parse(cleanedResponse);
                  if (Array.isArray(parsed)) { items = parsed; jsonFound = true; }
                  else if (parsed && typeof parsed === 'object') { items = [parsed]; jsonFound = true; }
                } catch {}
              }
              
              if (jsonFound) {
                console.log(`✅ 第 ${page} 页 JSON解析成功，${items.length} 条`);
              }
            }
          }
          
          // 🔧 兜底：尾随数字=页码，无数字=page:0（下游距离判断继承）
          if (items.length === 0) {
            const lines = cleanedResponse.split(/\n+/);
            let pendingPage = 0;  // 孤立数字行的页码
            for (const line of lines) {
              let trimmed = line.trim();
              if (!trimmed) continue;
              if (/^(\[图片\]|\*\*|```)\s*$/.test(trimmed)) continue;
              if (/^##\s/.test(trimmed)) trimmed = trimmed.replace(/^##\s*/, '').trim();
              if (!trimmed) continue;

              // 🔧 孤立数字行（OCR把页码分离到单独一行）：记下来，不给无页码的上一行
              if (/^\d{1,4}$/.test(trimmed)) {
                pendingPage = parseInt(trimmed);
                continue;
              }

              const pageMatch = trimmed.match(/([\s\.\u2026\u2024]+(\d{1,4})\s*)$/);
              if (pageMatch) {
                const page = parseInt(pageMatch[2]);
                if (page > 0 && page < 2000) {
                  const title = trimmed.substring(0, trimmed.length - pageMatch[1].length).trim();
                  if (title) { items.push({ text: title, page }); pendingPage = 0; continue; }
                }
              }
              if (trimmed.length >= 2 && trimmed.length < 100) {
                // 如果上一行是孤立页码，用那个页码；否则 page:0
                const usePage = pendingPage > 0 ? pendingPage : 0;
                items.push({ text: trimmed, page: usePage });
                pendingPage = 0;
              }
            }
              if (items.length > 0) {
                console.log(`📋 第 ${page} 页 文本兜底解析出 ${items.length} 个条目`);
              }
            }
          
          if (items.length > 0) {
            break; // 成功，跳出重试循环
          } else {
            console.warn(`第 ${page} 页解析后无条目(尝试${retryCount + 1})`);
            retryCount++;
          }
          
        } catch (error) {
          console.error(`❌ 第 ${page} 页处理失败(尝试${retryCount + 1}):`, error.message);
          retryCount++;
          
          if (retryCount <= maxRetries) {
            console.log(`🔄 第 ${page} 页将在2秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      // 处理识别结果
      if (items.length > 0) {
        const cleanedItems = items
          .map(item => {
            let text = (item.text || item.title || '').trim();
            let page = parseInt(item.page) || 0;
            
            text = text.replace(/^[\"\'\u201c\u201d\u2018\u2019]+/, '')
                       .replace(/[\"\'\u201c\u201d\u2018\u2019]+$/, '');
            
            const trailingNumMatch = text.match(/[……\.\s]+\s*(\d{1,4})\s*$/);
            if (trailingNumMatch) {
              const extractedPage = parseInt(trailingNumMatch[1]);
              if (extractedPage === page || !page || page < 1) {
                text = text.replace(/[……\.\s]+\s*\d{1,4}\s*$/, '').trim();
                page = extractedPage;
              }
            }
            
            // 🔧 page: 0 是无页码语义标记（下游会继承后一条目的页码），不能强制改 1
            //     仅对非法负值做兜底
            if (page < 0) page = 1;
            if (page > totalPages.value) page = totalPages.value;
            
            text = text.replace(/\s+/g, ' ').trim();
            
            return { text, page, indented: item.indented || false };
          })
          .filter(item => item.text && item.text.length > 0);
        
        if (cleanedItems.length > 0) {
          allItems.push(...cleanedItems);
          successCount++;
          console.log(`✅ 第 ${page} 页识别成功: ${cleanedItems.length}条`);
        } else {
          failCount++;
        }
      } else {
        failCount++;
        console.error(`❌ 第 ${page} 页最终识别失败(已重试${maxRetries}次)`);
      }
    }
    
    // 清理临时目录
    try {
      await deleteDirectory(tempImagesDir);
    } catch (e) {
      console.warn('清理临时目录失败:', e.message);
    }
    
    // 结果校验
    if (allItems.length === 0) {
      throw new Error(`未能识别到任何目录条目\n\n成功${successCount}页，失败${failCount}页\n\n建议：使用微信截图(Alt+A) → 复制 → 「从剪贴板导入」`);
    }
    
    // ========== 全局去重 ==========
    const seenGlobal = new Map();
    let dedupedItems = [];
    
    for (const item of allItems) {
      const key = `${item.text}|${item.page}`;
      if (seenGlobal.has(key)) {
        console.log(`🔄 全局去重: "${item.text}" 第${item.page}页`);
        continue;
      }
      seenGlobal.set(key, true);
      dedupedItems.push(item);
    }
    
    const duplicateCount = allItems.length - dedupedItems.length;
    if (duplicateCount > 0) {
      console.log(`🔄 全局去重: 去除 ${duplicateCount} 个重复条目`);
    }
    
    // 🔧 诊断：列出所有识别条目及其页码
    console.log(`📊 [AI识别汇总] 共 ${dedupedItems.length} 个条目:`);
    dedupedItems.forEach((item, i) => console.log(`  ${i + 1}. "${(item.text || '').substring(0, 40)}" → page=${item.page} indented=${item.indented || false}`));

    // ========== 构建章节列表 ==========
    const chapters = dedupedItems.map(item => ({
      title: item.text,
      page: item.page,
      level: 0,
      indented: item.indented || false,  // 🔧 保留AI视觉判断的缩进信息
      children: [],
      start: item.page,
      end: 0,
      selected: false,
      originalPage: item.page
    }));
    
    // 🔧 page: 0 继承：双向查找，取距离最近的有效页码（等距优先向上）
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (chapters[i].page === 0) {
        let bestPage = 0, bestDist = Infinity;
        for (let j = i - 1; j >= 0; j--) {
          if (chapters[j].page > 0) {
            const dist = i - j;
            if (dist <= bestDist) { bestDist = dist; bestPage = chapters[j].page; }
            break;
          }
        }
        for (let j = i + 1; j < chapters.length; j++) {
          if (chapters[j].page > 0) {
            const dist = j - i;
            if (dist < bestDist) { bestPage = chapters[j].page; }
            break;
          }
        }
        chapters[i].page = bestPage || 1;
        chapters[i].start = chapters[i].page;
        chapters[i].originalPage = chapters[i].page;
      }
    }

    // 🔧 诊断：继承后的页码
    const page0Items = chapters.filter(c => c.originalPage === 0);
    if (page0Items.length > 0) {
      console.log(`📊 [page继承后] ${page0Items.length} 个原本page=0的条目已继承:`);
      page0Items.forEach(c => console.log(`  "${c.title.substring(0, 30)}" → page=${c.page} (originalPage=${c.originalPage})`));
    }

    // 按页码排序
    chapters.sort((a, b) => a.page - b.page);
    
    // 计算页码范围
    calculatePageRanges(chapters);
    
    // 重建树结构
    const tree = rebuildTree(chapters, totalPages.value);
    
    // 保存到状态
    originalOutline.value = structuredClone(tree);
    pageOffset.value = 0;
    displayOutline.value = tree;
    console.log('🔍 AI后 tree 前3条:', JSON.stringify(tree.slice(0, 3)));
    
    // 完成
    saveStatus.value = '';
    isSaving.value = false;
    showOutlineEditor.value = true;
    
    // ✅ 立即聚焦
    await focusFirstInput();
    
    // 延迟显示提示
    setTimeout(async () => {
      let msg = `✅ AI识别完成！\n\n` +
                `📊 识别统计：\n` +
                `  · 扫描页数：${pageCount} 页\n` +
                `  · 成功：${successCount} 页\n` +
                `  · 失败：${failCount} 页\n` +
                `  · 条目：${dedupedItems.length} 个\n`;
      
      if (duplicateCount > 0) {
        msg += `  · 去重：${duplicateCount} 个\n`;
      }
      
      msg += `\n⚠️ 请仔细核对：\n` +
             `  1. 标题和页码是否正确\n` +
             `  2. 失败页的目录条目是否缺失\n` +
             `  3. 调整层级关系\n` +
             `  4. 如有偏移，使用「页码偏移量」修正`;
      
      await showAlertDialogFn(msg);
      
      nextTick(() => {
        focusFirstInput();
      });
    }, 500);
    
  } catch (e) {
    console.error('AI 目录识别失败:', e);
    saveStatus.value = '';
    isSaving.value = false;
    
    displayOutline.value = [];
    originalOutline.value = [];
    pageOffset.value = 0;
    showOutlineEditor.value = true;

    // ✅ 立即聚焦
    await focusFirstInput();
    
    setTimeout(async () => {
      await showAlertDialogFn('⚠️ AI 识别失败\n\n' + e.message + '\n\n' +
            '已进入手动编辑模式，请使用：\n' +
            '  · 微信截图(Alt+A) → 复制 → 「从剪贴板导入」\n' +
            '  · 下载Excel模板填写 → 复制 → 导入');
    }, 500);
  }
};

const startOutlineEditorForNonPdf = async () => {
  totalPages.value = await getTotalPages(tempFilePath.value);
  displayOutline.value = [];
  originalOutline.value = [];
  pageOffset.value = 0;
  showOutlineEditor.value = true;
  
  // ✅ 使用极速聚焦策略
  await focusFirstInput();
};

const updateDisplayTree = (tree, focusIndex = null) => {
  isRendering.value = true;
  pendingFocusIndex = focusIndex;
  
  // ✅ setTimeout 0 强制分两个宏任务，确保遮罩先渲染
  setTimeout(() => {
    displayOutline.value = tree;
  }, 0);
};

// 目录编辑操作
const applyOffset = () => {
  isRendering.value = true;
  const off = pageOffset.value;
  const allNodes = [];
  const collectNodes = (nodes) => {
    for (const node of nodes) {
      allNodes.push(node);
      if (node.children?.length) collectNodes(node.children);
    }
  };
  collectNodes(displayOutline.value);
  for (const node of allNodes) {
    const basePage = node.originalPage || node.page;
    node.page = basePage + off;
    node.start = basePage + off;
  }
  for (let i = 0; i < allNodes.length; i++) {
    let nextStart = totalPages.value + 1;
    for (let j = i + 1; j < allNodes.length; j++) {
      if (allNodes[j].start !== allNodes[i].start) {
        nextStart = allNodes[j].start;
        break;
      }
    }
    allNodes[i].end = Math.max(allNodes[i].start, nextStart - 1);
  }
  displayOutline.value = [...displayOutline.value];
  isRendering.value = false;
};

const updatePageRange = () => {
  if (isRendering.value) return;  // ✅ 渲染中直接跳过
  isRendering.value = true;
  const flat = flatOutline.value;
  fastCalculatePageRanges(flat, totalPages.value);
  // 同步 originalPage，防止后续 applyOffset 覆盖手动修改
  for (const node of flat) { node.originalPage = node.page; }
  // ✅ 使用 requestAnimationFrame 避免阻塞
  requestAnimationFrame(() => {
    updateDisplayTree(fastRebuildTree([...flat], totalPages.value), focusedRow.value);
  });
};

const parsePageRange = (event, index) => {
  const value = event.target.value.trim();
  const match = value.match(/^(\d+)\s*-\s*(\d+)$/);
  
  // 通过索引找到树中的对应节点
  const findNodeByIndex = (nodes, targetIndex) => {
    let currentIndex = 0;
    const stack = [...nodes];
    while (stack.length > 0) {
      const node = stack.shift();
      if (currentIndex === targetIndex) return node;
      currentIndex++;
      if (node.children?.length) stack.unshift(...node.children);
    }
    return null;
  };
  
  const node = findNodeByIndex(displayOutline.value, index);
  
  if (!match) {
    event.target.value = (node ? node.start : '?') + ' - ' + (node ? node.end : '?');
    return;
  }
  
  const start = parseInt(match[1]);
  const end = parseInt(match[2]);
  
  if (start < 1 || end < start || end > totalPages.value) {
    event.target.value = (node ? node.start : '?') + ' - ' + (node ? node.end : '?');
    return;
  }
  
  if (node) {
    node.start = start;
    node.end = end;
    node.page = start;
  }
  
  event.target.value = start + ' - ' + end;
  displayOutline.value = [...displayOutline.value];
};

const increaseIndent = (index) => {
  isRendering.value = true;
  const flat = flatOutline.value;
  if (flat[index].level >= 4) return;
  flat[index].level++;
  fastCalculatePageRanges(flat, totalPages.value);
  pendingFocusIndex = index;
  updateDisplayTree(fastRebuildTree([...flat], totalPages.value), index);
};

const decreaseIndent = (index) => {
  isRendering.value = true;
  const flat = flatOutline.value;
  if (flat[index].level <= 0) return;
  flat[index].level--;
  fastCalculatePageRanges(flat, totalPages.value);
  pendingFocusIndex = index;
  updateDisplayTree(fastRebuildTree([...flat], totalPages.value), index);
};

// 批量设置层级（优化版）
const batchSetLevel = async () => {
  isRendering.value = true;
  const targetLevel = batchTargetLevel.value;
  
  if (!flatOutline.value.some(item => item.selected)) {
    await showAlertDialogFn('请先勾选要修改的章节');
    return;
  }
  
  const flat = flatOutline.value;
  flat.forEach(item => {
    if (item.selected && item.level !== targetLevel) item.level = targetLevel;
  });
  
  fastCalculatePageRanges(flat, totalPages.value);
  updateDisplayTree(fastRebuildTree([...flat], totalPages.value), index);
  
  await showAlertDialogFn(`✅ 已将选中章节批量设为${['一级','二级','三级','四级','五级'][targetLevel]}`);
};

// 全选/取消全选
const toggleSelectAll = () => {
  isRendering.value = true;
  const newState = !allSelected.value;
  
  const setAllSelected = (nodes, selected) => {
    nodes.forEach(node => {
      node.selected = selected;
      if (node.children && node.children.length > 0) {
        setAllSelected(node.children, selected);
      }
    });
  };
  
  setAllSelected(displayOutline.value, newState);
  updateDisplayTree([...displayOutline.value]);
};

const importFromClipboard = async (closeModal = false) => {
  try {
    if (closeModal) {
      showImportModal.value = false;
      await nextTick();  // ✅ 等弹窗关闭
      await new Promise(r => setTimeout(r, 100));  // ✅ 再等100ms让焦点恢复
    }
    
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      if (closeModal) await showAlertDialogFn('剪贴板为空，请先复制目录内容');
      return;
    }
    
    const result = parseClipboardText(text, totalPages.value);
    if (!result.success) {
      if (closeModal) await showAlertDialogFn('解析失败: ' + result.error);
      return;
    }

    const count = await asyncImportProcess((result.flatList || result.chapters).map(i => ({ ...i, selected: false, originalPage: i.page })));
    console.log(`✅ 成功导入 ${count} 个章节`);
  } catch (e) {
    console.error('读取剪贴板失败:', e);
    if (closeModal) await showAlertDialogFn('读取剪贴板失败，请重试');
  }
};

const addManualChapter = () => {
  isRendering.value = true;
  const flat = [...flatOutline.value];
  let insertIndex = flat.length;
  const selectedIndex = flat.findIndex(item => item.selected);
  if (selectedIndex !== -1) { insertIndex = insertBefore.value ? selectedIndex : selectedIndex + 1; }
  else if (insertBefore.value) { insertIndex = 0; }
  
  const prevItem = insertIndex > 0 ? flat[insertIndex - 1] : null;
  const nextItem = insertIndex < flat.length ? flat[insertIndex] : null;
  const newPage = prevItem ? prevItem.page : (nextItem ? nextItem.page : 1);
  const newLevel = prevItem ? prevItem.level : (nextItem ? nextItem.level : 0);
  
  flat.splice(insertIndex, 0, {
    title: '新章节', page: newPage, start: newPage, end: newPage,
    level: newLevel, children: [], selected: false, originalPage: newPage
  });
  
  fastCalculatePageRanges(flat, totalPages.value);
  const tree = fastRebuildTree(flat, totalPages.value);
  
  // ✅ 设置待聚焦索引
  pendingFocusIndex = insertIndex;
  updateDisplayTree(tree, insertIndex);
};

const deleteChapter = async (index) => {
  isRendering.value = true;
  const item = flatOutline.value[index];
  const confirmed = await showConfirmDialogFn(`确定删除「${item.title}」吗？`);
  if (!confirmed) return;
  const flat = [...flatOutline.value];
  flat.splice(index, 1);
  
  fastCalculatePageRanges(flat, totalPages.value);
  const tree = fastRebuildTree(flat, totalPages.value);
  
  if (flat.length > 0) {
    pendingFocusIndex = Math.min(index, flat.length - 1);
  }
  updateDisplayTree(tree, flat.length > 0 ? Math.min(index, flat.length - 1) : null);
};

const showPageHint = (index) => {
  const item = flatOutline.value[index];
  inlinePreviewPage.value = item.page;
  currentHintPage.value = item.page;
  // 重置位置到默认
  inlinePreviewPos.value = { x: window.innerWidth - 420, y: 80 };
  inlinePreviewSize.value = { width: 380, height: 550 };
  showInlinePreview.value = true;
};

const clearAllChapters = async () => {
  const confirmed = await showConfirmDialogFn('确定清空所有章节吗？');
  if (confirmed) {
    displayOutline.value = [];
    originalOutline.value = [];
  }
};

const pdfPreviewRef = ref(null);

// 章节分析弹窗（从 store 读取）
const showChapterAnalysisModal = computed({
  get: () => textbookStore.showChapterAnalysis,
  set: (val) => {
    if (!val) textbookStore.closeChapterAnalysis();
  }
});
const viewingBook = computed(() => textbookStore.viewingBook);
const viewingChapter = computed(() => textbookStore.viewingChapter);

// ==================== 预览功能 ====================
const handlePreview = (data) => {
  if (!data || !data.imagesDir) {
    console.warn('预览数据不完整');
    return;
  }
  previewData.value = data;
  currentPreviewPage.value = data.start;
  showPreview.value = true;
  
  // ✅ 弹出 PDF 页码提示
  const book = textbookStore.textbooks.find(b => b.imagesDir === data.imagesDir);
  const realPage = data.start; // PDF 实际页码就是 start
  pdfPageHint.value = `📐 目录写「${data.title}」第${data.start}页 → PDF实际第${realPage}页 → 偏移量 = ${realPage - data.start}`;
  setTimeout(() => { pdfPageHint.value = ''; }, 5000);
};

const closePreview = () => {
  showPreview.value = false;
  previewData.value = null;
  currentPreviewPage.value = 1;
};

const prevPage = () => {
  if (currentPreviewPage.value > previewData.value.start) {
    currentPreviewPage.value--;
  }
};

const nextPage = () => {
  if (currentPreviewPage.value < previewData.value.end) {
    currentPreviewPage.value++;
  }
};
// 🔧 清理：移除未使用的图片自适应函数（该功能由 PdfPreview 组件处理）

// ==================== 模态框拖动功能 ====================
const startDrag = (e, modalType) => {
  isDragging.value = true;
  currentDragModal.value = modalType;
  
  let modalRef;
  if (modalType === 'catalog') modalRef = catalogModalRef.value;
  else if (modalType === 'outline') modalRef = outlineModalRef.value;
  else if (modalType === 'chapterAnalysis') modalRef = chapterAnalysisModalRef.value;
  if (!modalRef) return;
  
  const rect = modalRef.getBoundingClientRect();
  dragOffset.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  e.preventDefault();
};

const startChapterDrag = (e) => {
  startDrag(e, 'chapterAnalysis');
};

const discardChapterAnalysis = async () => {
  const ch = viewingChapter.value;
  if (!ch) return;
  
  const confirmed = await showConfirmDialogFn('确定要丢弃该章节的分析结果吗？原文、知识点等数据将被清除。');
  if (!confirmed) return;
  
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
  ch._rawTextHtml = '';
  
  await textbookStore.saveTextbooks();
  textbookStore.textbooks = [...textbookStore.textbooks];
  showChapterAnalysisModal.value = false;
};

const saveChapterAnalysis = async () => {
  const ch = viewingChapter.value;
  if (!ch) return;
  
  // 保存知识点（从文本转换为数组）
  if (ch.knowledgePointsText !== undefined) {
    ch.knowledgePoints = ch.knowledgePointsText.split('\n').filter(k => k.trim());
  }
  
  // 保存公式（从文本转换为数组）
  if (ch.formulasText !== undefined) {
    ch.formulas = ch.formulasText.split('\n').filter(f => f.trim());
  }
  
  await textbookStore.saveTextbooks();
  showChapterAnalysisModal.value = false;
};

const handleDrag = (e) => {
  if (!isDragging.value) return;
  
  let modalRef;
  if (currentDragModal.value === 'catalog') modalRef = catalogModalRef.value;
  else if (currentDragModal.value === 'outline') modalRef = outlineModalRef.value;
  else if (currentDragModal.value === 'chapterAnalysis') modalRef = chapterAnalysisModalRef.value;
  if (!modalRef) return;
  
  const newX = e.clientX - dragOffset.value.x;
  const newY = e.clientY - dragOffset.value.y;
  
  const maxX = window.innerWidth - modalRef.offsetWidth;
  const maxY = window.innerHeight - modalRef.offsetHeight;
  
  modalRef.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
  modalRef.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
  modalRef.style.transform = 'none';
};

const stopDrag = () => {
  isDragging.value = false;
  currentDragModal.value = '';
};

// 生命周期
onMounted(async () => { 
  await loadTextbooks();
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('mousemove', handleDrag);
  window.addEventListener('mouseup', stopDrag);
  // ✅ 新增：监听草稿箱事件
  window.addEventListener(APP_EVENTS.PROCESS_DRAFT, (e) => {
    const draft = e.detail;
    tempFilePath.value = draft.path;
    textbookName.value = draft.name;
    selectedFilePath.value = draft.path;  // ✅ 显示文件名
    showUploadModal.value = true;  // ✅ 弹出上传弹窗
    showCatalogPageModal.value = false;
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('mousemove', handleDrag);
  window.removeEventListener('mouseup', stopDrag);
});

const downloadTemplate = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('目录模板');
    
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 10;
    
    const headerRow = sheet.addRow(['层级', '章节标题', '起始页码']);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E8F0' } };
      cell.alignment = { horizontal: 'center' };
    });
    
    const data = [
      ['一级', '第一单元', 1],
      ['二级', '第1课 标题', 2],
      ['二级', '第2课 标题', 5],
      ['一级', '第二单元', 10],
      ['二级', '第3课 标题', 11],
      ['二级', '第4课 标题', 15]
    ];
    
    data.forEach(row => {
      sheet.addRow(row);
    });
    
    sheet.addRow([]);
    const noteRow = sheet.addRow(['📌 使用说明：1.按格式填写  2.全选复制  3.回到软件点「从剪贴板导入」']);
    noteRow.font = { color: { argb: 'FF666666' }, italic: true };
    sheet.mergeCells(`A${noteRow.number}:C${noteRow.number}`);
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '目录导入模板.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
    
    await showAlertDialogFn('📌 模板已下载！\n\n用 Excel 打开 → 填写目录 → 全选复制 → 回到软件点「从剪贴板导入」');
  } catch (e) {
    console.error('下载模板失败:', e);
    await showAlertDialogFn('下载失败，请重试');
  }
};

const closeOutlineEditor = () => { showOutlineEditor.value = false; };
const goBackToCatalogPage = () => {
  showOutlineEditor.value = false;
  showCatalogPageModal.value = true;
};

// 加载已有教材的目录
const loadExistingOutline = async () => {
  const name = textbookName.value;
  if (!name) return;

  if (!textbookStore || !textbookStore.textbooks) {
    await showAlertDialogFn('教材数据尚未加载，请稍后再试');
    return;
  }

  const existing = textbookStore.textbooks.find(t => t.name === name);
  if (!existing) {
    await showAlertDialogFn('未找到同名教材，请先上传');
    return;
  }

  if (!existing.outline || existing.outline.length === 0) {
    await showAlertDialogFn('该教材没有目录数据');
    return;
  }

  const confirmed = await showConfirmDialogFn(`加载「${name}」的原有目录？当前编辑的目录将被替换。`);
  if (!confirmed) return;

  // ✅ 第一时间打开遮罩
  isRendering.value = true;
  const overlay = document.querySelector('.render-overlay');
  if (overlay) overlay.style.display = 'flex';

  showOutlineEditor.value = true;
  pageOffset.value = existing.pageOffset || 0;  // ✅ 修改：从已有数据恢复偏移量
  totalPages.value = existing.totalPages || totalPages.value;
  
  const chapters = JSON.parse(JSON.stringify(existing.outline));
  const flatList = flattenOutline(chapters);
  fastCalculatePageRanges(flatList, totalPages.value);
  const tree = fastRebuildTree(flatList, totalPages.value);
  
  originalOutline.value = tree;
  updateDisplayTree(tree, 0);
};

// 教材名元数据自动识别 → 已收敛至共享 utils/textbookMeta.autoDetectTextbookMeta（课本库/模板库共用，
// 曾在此双份逐字副本；含学科旧键"政治/信息技术"漏"思想政治"识别等 bug——共享实现已修复）

// 保存教材
const saveTextbook = async () => {
  if (!isValid.value) { await showAlertDialogFn('请完整填写所有章节标题和页码'); return; }
  
  try {
    isSaving.value = true;
    saveStatus.value = '正在保存...';
    
    let outlineForSave = [];
    
    const storagePath = getStoragePath();
    const ext = tempFilePath.value.split('.').pop().toLowerCase();
    
    const rawName = textbookName.value || tempFilePath.value.split('\\').pop().replace(/\.[^/.]+$/, '');
    // 只替换文件系统不允许的字符
    const safeName = rawName.replace(/[<>:"/\\|?*]/g, '_');
    const textbookId = safeName;
    
    const imagesDir = `${storagePath}/教材库/图片/${textbookId}`;
    const pdfPath = ext === 'pdf' ? `${storagePath}/教材库/${textbookId}_带书签.pdf` : '';
    const coverPath = `${storagePath}/教材库/缩略图/${textbookId}.png`;
    let finalFileName = '';
    
    // 确保PDF输出目录存在
    if (ext === 'pdf') {
      const pdfDir = pdfPath.substring(0, pdfPath.lastIndexOf('/'));
      await createDirectory(pdfDir);
    }
    await createDirectory(imagesDir);
    
    // ✅ 直接检查磁盘上的图片文件，不依赖内存数据
    let hasExistingImages = false;
    let hasExistingCover = false;
    
    try {
      const jpgPath = `${imagesDir}/page_001.jpg`;
      await window.electronAPI.readFile(jpgPath);
      hasExistingImages = true;
    } catch (_) {
      try {
        const pngPath = `${imagesDir}/page_001.png`;
        await window.electronAPI.readFile(pngPath);
        hasExistingImages = true;
      } catch (_) {}
    }
    
    try {
      await window.electronAPI.readFile(coverPath);
      hasExistingCover = true;
      console.log('✅ 检测到已有缩略图缓存');
    } catch (_) {
      hasExistingCover = false;
    }
    
    if (ext === 'pdf') {
      // 如果检测到旧文件，先删除
      try {
        await deleteFile(pdfPath);
        console.log('🗑️ 已删除旧文件:', pdfPath);
      } catch (_) {
        // 旧文件不存在，忽略
      }
      
      if (hasExistingImages) {
        console.log('✅ 使用缓存图片，跳过重复转换');
        saveStatus.value = '✅ 使用缓存图片，正在生成书签...';
      } else {
        // 逐页转换图片
        for (let p = 1; p <= totalPages.value; p++) {
          saveStatus.value = `正在转换图片...(${p}/${totalPages.value}页)`;
          try {
            await pdfPagesToImages(tempFilePath.value, imagesDir, [String(p)]);
          } catch (e) {
            console.warn(`第${p}页转换失败，跳过:`, e.message);
          }
        }
        saveStatus.value = '正在生成书签...';
      }      
      
      const bookmarks = flatOutline.value.map(item => ({
        title: item.title,
        page: item.originalPage ? item.originalPage + pageOffset.value : item.page,
        level: item.level + 1
      }));
      
      console.log('📍 直接生成带书签PDF到目标路径:', pdfPath);
      // 设置30秒超时
      const bookmarkPromise = addPdfBookmarks(tempFilePath.value, bookmarks, pdfPath);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('添加书签超时（30秒），请检查 Python 环境是否正常')), 30000)
      );

      const bookmarkResult = await Promise.race([bookmarkPromise, timeoutPromise]);
      if (!bookmarkResult || !bookmarkResult.success) {
        throw new Error('添加书签失败: ' + (bookmarkResult?.error || '未知错误'));
      }
      
      outlineForSave = JSON.parse(JSON.stringify(displayOutline.value));
      
      finalFileName = `${textbookId}_带书签.pdf`;
    } else {
      const targetPath = `${storagePath}/教材库/${textbookId}.${ext}`;
      await moveFile(tempFilePath.value, targetPath);
      totalPages.value = 1;
      finalFileName = `${textbookId}.${ext}`;
      
      outlineForSave = JSON.parse(JSON.stringify(displayOutline.value));
    }
    
    if (hasExistingCover) {
      console.log('✅ 使用缓存缩略图，跳过重新生成');
    } else {
      saveStatus.value = '正在生成封面...';
      try {
        await createDirectory(`${storagePath}/教材库/缩略图`);
        await createThumbnail(`${imagesDir}/page_001.jpg`, coverPath, 80, 80);
      } catch (_) {}
    }
    
    const newTextbook = {
      id: textbookId,
      name: rawName,
      pdfPath: ext === 'pdf' ? pdfPath : '',
      imagesDir,
      coverPath,
      // 🔑 直接存中文值，不做 stageMap 映射（筛选时也用中文比对）
      stage: filterStage.value || autoDetectTextbookMeta(rawName).stage || '',
      grade: filterGrade.value || autoDetectTextbookMeta(rawName).grade || '',
      subject: filterSubject.value || autoDetectTextbookMeta(rawName).subject || '',
      semester: filterSemester.value || autoDetectTextbookMeta(rawName).semester || '',
      selected: false,
      outline: outlineForSave,
      totalPages: totalPages.value,
      pageOffset: pageOffset.value,  // ✅ 新增：保存页码偏移量
      createdAt: Date.now()
    };
    
    const existingIndex = textbookStore.textbooks.findIndex(t => t.name === rawName);
    if (existingIndex !== -1) {
      const oldBook = textbookStore.textbooks[existingIndex];
      newTextbook.selected = oldBook.selected;
      if (oldBook.analysis) {
        newTextbook.analysis = oldBook.analysis;
      }
      const syncSelection = (newNodes, oldNodes) => {
        const oldFlat = flattenOutline(oldNodes);
        const newFlat = flattenOutline(newNodes);
        newFlat.forEach((n, i) => {
          if (i < oldFlat.length) n.selected = oldFlat[i].selected;
          if (n.children) syncSelection(n.children, oldFlat[i]?.children || []);
        });
      };
      syncSelection(newTextbook.outline, oldBook.outline || []);
  
      textbookStore.updateTextbook(textbookStore.textbooks[existingIndex].id, newTextbook);
    } else {
      textbookStore.addTextbook(newTextbook);
    }
    // 先关闭loading
    isSaving.value = false;
    saveStatus.value = '';
    
    // 延迟一点再弹提示，确保loading完全消失
    await new Promise(resolve => setTimeout(resolve, 100));
    await showAlertDialogFn(`✅ 教材「${rawName}」已成功入库！\n\n📁 存储位置：${storagePath}/教材库/\n📄 文件：${finalFileName}\n🖼️ 图片目录：${textbookId}/`);
    
    // 用户点击确定后，再关闭目录编辑弹窗
    showOutlineEditor.value = false;
  } catch (error) {
    console.error('保存教材失败:', error);
    await showAlertDialogFn('保存失败: ' + error.message);
  } finally {
    isSaving.value = false;
    saveStatus.value = '';
  }
};
</script>

<style scoped>
.textbook-module { height: 100%; display: flex; }
.library-panel {
  width: 420px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel-header { display: flex; justify-content: space-between; align-items: center; }
.panel-header h3 { font-size: 16px; color: var(--primary); margin: 0; }
.filter-row { display: flex; gap: 8px; }
.filter-row select { flex: 1; padding: 6px; border-radius: 8px; border: 1px solid #ccc; background: white; }
.search-row { display: flex; gap: 8px; }
.search-input { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #ccc; }
.sort-select { width: 100px; padding: 6px; border-radius: 8px; border: 1px solid #ccc; background: white; }
.batch-row { 
  display: flex; 
  align-items: center; 
  gap: 6px; 
  padding: 4px 8px; 
  background: #f0f7ff; 
  border-radius: 6px; 
  font-size: 12px; 
}
.batch-row .btn {
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 6px;
}
.textbook-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.textbook-item { border: 1px solid var(--border-light); border-radius: 8px; padding: 8px; background: white; }
.item-header { display: flex; align-items: center; gap: 8px; }
.select-checkbox { width: 16px; height: 16px; cursor: pointer; }
.book-cover { width: 32px; height: 40px; object-fit: cover; border-radius: 4px; }
.book-cover-placeholder { width: 32px; height: 40px; display: flex; align-items: center; justify-content: center; background: var(--primary-bg); border-radius: 4px; font-size: 1.2rem; }
.item-info { flex: 1; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.expand-icon { width: 16px; color: #666; }
.book-name { font-weight: 500; font-size: 14px; }
.chapter-count { font-size: 0.75rem; color: #666; margin-left: 8px; }
.item-actions { display: flex; gap: 4px; }
.icon-btn { background: none; border: none; cursor: pointer; padding: 4px; font-size: 1rem; }
.icon-btn:hover { background: #f0f0f0; border-radius: 4px; }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.outline-tree { margin-top: 8px; }
.chapter-item { display: flex; align-items: center; gap: 4px; padding: 6px 0; font-size: 0.75rem; line-height: 1.8; cursor: pointer; }
.chapter-item:hover { background-color: #f5f7fa; }
.toggle-icon-wrapper { 
  width: 16px; 
  height: 16px; 
  display: inline-flex; 
  align-items: center; 
  justify-content: center;
  flex-shrink: 0;
}
.toggle-icon { 
  width: 16px; 
  height: 16px; 
  display: inline-flex; 
  align-items: center; 
  justify-content: center; 
  font-size: 0.7rem; 
  color: #666; 
  cursor: pointer; 
  user-select: none;
  transition: transform 0.2s;
}
.toggle-icon:hover {
  color: var(--primary-light);
  transform: scale(1.1);
}
.toggle-placeholder { width: 16px; height: 16px; display: inline-block; }
.chapter-title { flex: 1; }
.page-range { font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; font-family: monospace; }
.empty-outline { color: var(--text-muted); padding: 8px; font-size: 0.85rem; }
.empty-tip { text-align: center; padding: 32px; color: var(--text-muted); }

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
  color: #444;
  line-height: 1.8;
}
.empty-text {
  color: #ccc;
  font-size: 13px;
}
.modal-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent; display: flex; align-items: center; justify-content: center; z-index: 3500; pointer-events: none; }
.modal { 
  background: white; 
  border-radius: 16px; 
  padding: 24px; 
  min-width: 400px; 
  max-width: 95%; 
  max-height: 85vh; 
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
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
.large-modal { min-width: 1000px; max-height: 90vh; }

.large-modal::before {
  height: 6px;
  background: linear-gradient(90deg, #1e4a8a 0%, var(--primary-light) 50%, #1e4a8a 100%);
}

/* ========== 右侧预览面板 ========== */
.preview-panel {
  flex: 1;
  min-width: 400px;
  border-left: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  background: #e8e8e8;
  overflow: hidden;
}

.preview-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.empty-hint {
  text-align: center;
  color: var(--text-muted);
}

.empty-hint .empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.empty-hint p {
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-muted);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 2px solid var(--border-light);
  background: white;
  flex-shrink: 0;
}

.preview-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #666;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.preview-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  background: white;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.preview-info .page-range {
  font-size: 13px;
  color: #555;
  font-weight: 500;
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  padding: 4px 12px;
  border: 1px solid var(--primary-light);
  background: white;
  color: var(--primary-light);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: var(--primary-light);
  color: white;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  min-width: 60px;
  text-align: center;
}

.preview-content {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
  background: #d9d9d9;
  position: relative;
}

.image-viewport {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-width: fit-content;
  min-height: fit-content;
}

.preview-image {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 2px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  background: white;
  transition: opacity 0.3s;
  opacity: 0;
}

.preview-image.image-loaded {
  opacity: 1;
}

/* 目录编辑弹窗专用布局 */
.outline-editor-modal {
  height: 85vh;
}

.outline-editor-modal h3 {
  flex-shrink: 0;
}

.outline-editor-modal .warning-tip {
  flex-shrink: 0;
}

.outline-editor-modal .offset-row {
  flex-shrink: 0;
}

.outline-editor-modal .action-row {
  flex-shrink: 0;
}

.outline-editor-modal .table-container-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.outline-editor-modal .table-container {
  flex: 1;
  max-height: none;
}

.outline-editor-modal .empty-tip,
.outline-editor-modal .total-pages-hint {
  flex-shrink: 0;
}

.outline-editor-modal .modal-actions {
  flex-shrink: 0;
  margin-top: auto;
}

.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
.warning-tip { padding: 8px 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; margin-bottom: 8px; color: #856404; font-size: 13px; }
.offset-row { display: flex; align-items: center; gap: 12px; margin: 8px 0 12px 0; padding: 8px 12px; background: #f0f7ff; border-radius: 8px; flex-wrap: wrap; }
.offset-input-group { display: flex; align-items: center; gap: 4px; }
.offset-btn { padding: 4px 12px; font-size: 16px; font-weight: bold; min-width: 32px; }
.offset-number-input { width: 70px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; text-align: center; font-size: 15px; -moz-appearance: textfield; }
.offset-number-input::-webkit-inner-spin-button, .offset-number-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.offset-number-input:focus { border-color: var(--primary-light); outline: none; box-shadow: 0 0 0 3px rgba(43, 94, 167, 0.1); }
.action-row { display: flex; gap: 12px; margin: 8px 0 12px 0; }
.table-container { 
  flex: 1;
  overflow-y: auto; 
  overflow-x: auto;
  border: 1px solid var(--border-light); 
  border-radius: 8px;
  position: relative;
}
.outline-table { width: 100%; border-collapse: collapse; table-layout: auto; }
th, td { padding: 12px 10px; text-align: left; border-bottom: 1px solid var(--border-light); white-space: nowrap; vertical-align: middle; }
th { 
  background: #f5f5f5; 
  position: sticky; 
  top: 0; 
  z-index: 10; 
  font-weight: 600; 
  color: #333;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

td input.cell-input { width: 100%; padding: 6px 8px; border: 1px solid transparent; border-radius: 4px; transition: all 0.2s; box-sizing: border-box; display: block; }
td input.cell-input:focus { border-color: var(--primary-light); outline: none; box-shadow: 0 0 0 2px rgba(43, 94, 167, 0.2); background: #fff; transition: none !important; }
td input.cell-input:hover { border-color: #ccc; background: #fafafa; }
td input.title-input { font-weight: 500; }
.error-input { border-color: var(--danger) !important; background: #fef5f5 !important; }
tr.row-focused td { background: #eef6ff !important; }
tr.row-focused td input.cell-input { background: #eef6ff; }
.page-range-cell { font-family: monospace; color: #555; }
.total-pages-hint { margin-top: 12px; color: #666; font-size: 0.9rem; }
.loading-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent; display: flex; align-items: center; justify-content: center; z-index: 4000; pointer-events: none; }
.loading-content { background: white; padding: 32px; border-radius: 16px; text-align: center; pointer-events: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.2); border: 2px solid #f39c12; position: relative; }
.loading-content::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #f39c12 0%, #f1c40f 50%, #f39c12 100%); border-radius: 14px 14px 0 0; }
.spinner { width: 40px; height: 40px; border: 4px solid var(--border-light); border-top-color: var(--primary-light); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
@keyframes spin { to { transform: rotate(360deg); } }
.btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #ccc; background: white; cursor: pointer; }
.btn:hover { background: #f5f5f5; }
.btn-primary { padding: 8px 16px; border-radius: 8px; border: none; background: var(--primary-light); color: white; cursor: pointer; }
.btn-primary:hover { background: #1e4a8a; }
.btn-full { width: 100%; margin: 12px 0; }
.btn:disabled, .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.file-name { margin: 12px 0; color: var(--primary-light); }
.hint { font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }

/* 目录页设置弹窗优化 */
.catalog-modal-header {
  text-align: center;
  margin-bottom: 28px;
}

.catalog-modal-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.catalog-modal-header h3 {
  font-size: 22px;
  color: var(--primary);
  margin-bottom: 8px;
}

.catalog-modal-desc {
  font-size: 14px;
  color: var(--text-muted);
}

.catalog-form-group {
  margin-bottom: 24px;
}

.catalog-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 10px;
}

.catalog-input {
  width: 100%;
  padding: 14px 18px;
  font-size: 16px;
  border: 2px solid var(--border-light);
  border-radius: 12px;
  outline: none;
  transition: all 0.2s;
}

.catalog-input:focus {
  border-color: var(--primary-light);
  box-shadow: 0 0 0 4px rgba(43, 94, 167, 0.08);
}

.catalog-examples {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.example-label {
  font-size: 13px;
  color: var(--text-muted);
}

.example-tag {
  padding: 4px 12px;
  background: var(--primary-bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.example-tag:hover {
  background: var(--primary-light);
  color: white;
  border-color: var(--primary-light);
}

.catalog-hint-box {
  background: #f0f7ff;
  border-left: 4px solid var(--primary-light);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 24px;
}

.catalog-hint-box p {
  font-size: 14px;
  color: var(--primary);
  margin-bottom: 8px;
}

.catalog-hint-box ul {
  margin-left: 18px;
}

.catalog-hint-box li {
  font-size: 13px;
  color: #555;
  line-height: 1.8;
}

/* 模态框拖动功能样式 */
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

.draggable-modal > h3,
.draggable-modal > .catalog-modal-header {
  margin-top: 28px;
}

.td-title {
  padding: 0 !important;
}

.title-cell-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 10px;
  min-height: 42px;
}

.row-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  flex-shrink: 0;
  margin: 0;
}

.batch-level-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}

.batch-level-label {
  font-size: 13px;
  color: #555;
  white-space: nowrap;
}

.batch-level-select {
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: white;
  font-size: 13px;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

.outline-editor-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.title-actions {
  display: flex;
  gap: 4px;
}

.maximized {
  width: 98vw !important;
  height: 98vh !important;
  max-width: 98vw !important;
  max-height: 98vh !important;
}

.filter-search-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-box {
  display: flex;
  align-items: center;
  background: #f5f7fa;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 0 8px;
}

.search-box:focus-within {
  border-color: var(--primary-light);
}

.search-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.search-input-inline {
  flex: 1;
  padding: 6px 6px;
  border: none;
  background: transparent;
  font-size: 12px;
  outline: none;
}

.filter-selects {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-select {
  flex: 1 1 calc(33.333% - 6px);
  min-width: 0;
  padding: 4px 4px;
  border-radius: 5px;
  border: 1px solid #ddd;
  background: white;
  font-size: 12px;
  color: #333;
  cursor: pointer;
}

.sort-select {
  margin-left: auto;
}

.upload-meta {
  display: flex;
  gap: 12px;
  margin: 12px 0;
}
.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.meta-item label {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}
.meta-item select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 12px;
  background: white;
}

.render-loading-bar {
  margin-top: 12px;
  color: #856404;
  font-size: 0.9rem;
  text-align: left ;
}

kbd {
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 1px 6px;
  font-family: monospace;
  font-size: 12px;
}

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

  /* === 章节分析弹窗 === */
  .modal.draggable-modal {
    min-width: 0 !important;
    width: 96% !important;
    max-width: 100vw !important;
    padding: 12px 10px !important;
    border-radius: 12px !important;
    max-height: calc(100% - 16px) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow-y: auto !important;
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
  /* 弹窗内容滚动区域 */
  .modal-scroll-area {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding-right: 4px;
  }
  /* 📱 移动端：工具栏和拖拽把手隐藏 */
  .modal.draggable-modal .modal-drag-handle {
    display: none !important;
  }
  .modal.draggable-modal .analysis-footer {
    padding: 0 !important;
    margin-top: 10px !important;
  }
  /* 移动端隐藏保存按钮（仅保留取消/关闭） */
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
  /* 两栏在移动端上下堆叠 */
  .modal.draggable-modal .chapter-analysis-two-columns {
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
  /* 知识层级内容适配 */
  .chapter-analysis-right [style*="font-size:13px"] {
    font-size: 12px !important;
  }
  .chapter-analysis-right [style*="font-size:12px"] {
    font-size: 11px !important;
  }
  .chapter-analysis-right [style*="font-size:11px"] {
    font-size: 10px !important;
  }
  .chapter-analysis-right [style*="margin-left:16px"] {
    margin-left: 8px !important;
  }
  .rich-text-editor {
    max-width: 100% !important;
    font-size: 11px !important;
  }
  .chapter-analysis-left textarea {
    font-size: 11px !important;
    max-height: 40vh !important;
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

  /* === 原有移动端样式 === */
  .textbook-module {
    flex-direction: column !important;
    padding: 0 !important;
    height: 100%;
    overflow: hidden;
  }
  .library-panel {
    width: 100% !important;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
    gap: 0;
    min-height: 0;
  }
  .preview-panel {
    width: 100% !important;
    max-height: 50vh;
    flex-shrink: 0;
  }

  /* 固定头部区域：标题 + 筛选 + 批量操作 */
  .library-panel > .panel-header {
    flex-shrink: 0;
    gap: 0;
    padding: 3px 6px;
    background: white;
    z-index: 10;
    border-bottom: 1px solid var(--border-light);
  }
  .panel-header h3 { font-size: 12px; margin: 0; }
  .panel-header .btn-primary {
    font-size: 9px;
    padding: 2px 6px;
    min-height: auto;
  }

  .library-panel > .filter-search-row {
    flex-shrink: 0;
    flex-direction: column;
    gap: 6px;
    padding: 8px 8px;
    background: white;
    border-bottom: 1px solid var(--border-light);
  }
  .search-box {
    width: 100%;
    padding: 0 4px;
  }
  .search-box .search-input-inline {
    width: 100%;
    font-size: 12px !important;
    padding: 8px 4px;
  }
  .search-icon { font-size: 12px; }
  .filter-selects {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 3px;
  }
  .filter-selects .filter-select {
    flex: 1 1 0;
    min-width: 0;
    font-size: 10px !important;
    padding: 4px 2px;
    width: auto;
    background: #f8f9fa;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    color: #333;
  }
  .filter-selects .sort-select {
    flex: 0 0 auto;
    min-width: 44px;
    font-size: 10px !important;
  }

  .library-panel > .batch-row {
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 2px;
    padding: 1px 6px;
    background: #f0f7ff;
    border-bottom: 1px solid var(--border-light);
  }
  .batch-row .btn, .batch-row .btn-primary {
    font-size: 9px;
    padding: 1px 6px;
    min-height: 20px;
  }
  .batch-row span { font-size: 11px; }

  /* 教材列表：独立滚动 */
  .textbook-list {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 4px 8px;
    min-height: 0;
  }

  .textbook-item { border-radius: 8px; padding: 6px 8px; margin-bottom: 6px; }
  .item-header {
    flex-wrap: wrap;
    gap: 6px;
  }
  .book-cover, .book-cover-placeholder {
    width: 32px;
    height: 42px;
  }
  .item-info {
    flex: 1;
    min-width: 0;
  }
  .book-name {
    font-size: 13px;
    line-height: 1.4;
    word-break: break-all;
  }
  .chapter-count { font-size: 11px; }
  .item-actions { flex-shrink: 0; }
  .item-actions .icon-btn {
    font-size: 14px;
    padding: 3px;
  }
  .outline-tree {
    padding: 3px 0;
  }
  .chapter-item {
    font-size: 12px !important;
    padding: 4px 4px !important;
  }
  .page-range { font-size: 10px; }

  /* === 通用弹窗移动端适配（上传/目录页/目录编辑器/导入/输入/确认/提示） === */
  .modal:not(.draggable-modal) {
    min-width: 0 !important;
    width: 90vw !important;
    max-width: 90vw !important;
    padding: 16px 14px !important;
    border-radius: 12px !important;
    max-height: calc(100% - 16px) !important;
  }
  .modal:not(.draggable-modal)::before {
    border-radius: 10px 10px 0 0 !important;
  }
  .modal:not(.draggable-modal) h3 {
    font-size: 15px !important;
    margin-bottom: 10px !important;
    padding-bottom: 10px !important;
  }
  .modal:not(.draggable-modal) p,
  .modal:not(.draggable-modal) .option-item {
    font-size: 13px !important;
  }
  /* 目录编辑器弹窗 */
  .outline-editor-modal {
    width: 96vw !important;
    max-width: 96vw !important;
    padding: 12px 8px !important;
  }
  .outline-editor-modal h3 {
    font-size: 14px !important;
  }
  .outline-editor-modal .modal-actions {
    margin-top: 10px !important;
    padding-top: 10px !important;
  }
  /* 上传弹窗 */
  .upload-area {
    padding: 16px 10px !important;
  }
  .upload-area .hint {
    font-size: 11px !important;
  }
}</style>