<template>
  <div class="typeset-module">
    <div class="typeset-layout">
      <!-- 左侧：生成记录 + 主题库 -->
      <div class="theme-panel">
        <!-- 🔧 生成记录：直接从 localStorage 读取，点击载入编辑器 -->
        <div
          v-if="genRecords.length > 0"
          class="gen-records-section"
        >
          <div class="panel-header">
            <h3>📋 生成记录</h3>
            <button
              class="btn-icon"
              title="刷新"
              @click="refreshGenRecords"
            >
              🔄
            </button>
          </div>
          <div class="gen-records-list">
            <div
              v-for="rec in genRecords"
              :key="rec.id"
              class="gen-record-item"
              @click="loadGenRecord(rec)"
            >
              <span class="gen-record-title">{{ rec.title }}</span>
              <span class="gen-record-type">{{ rec.genType }}</span>
            </div>
          </div>
        </div>

        <div class="panel-header">
          <h3>🎨 排版主题库</h3>
          <button
            class="btn-icon"
            title="刷新主题"
            @click="refreshThemes"
          >
            🔄
          </button>
        </div>

        <!-- 上传自制Word -->
        <div class="upload-section">
          <button
            class="btn btn-full"
            @click="uploadCustomWord"
          >
            📤 上传自制 Word
          </button>
          <p
            v-if="customFileName"
            class="hint"
          >
            当前文件: {{ customFileName }}
          </p>
          <p
            v-else
            class="hint"
          >
            支持 .docx 格式
          </p>
        </div>

        <!-- 主题分组选择 -->
        <div class="theme-filter">
          <select
            v-model="themeGroupFilter"
            class="filter-select"
          >
            <option value="">
              全部主题
            </option>
            <option value="我的样式">
              我的样式
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
            <option value="特殊">
              特殊
            </option>
            <option value="自定义">
              自定义
            </option>
          </select>
        </div>

        <!-- 主题列表 -->
        <div class="theme-list">
          <!-- 🔧 无样式选项 -->
          <div
            class="theme-item no-style-item"
            :class="{ active: !selectedThemeId }"
            @click="selectTheme(null)"
          >
            <div class="theme-preview no-style-preview">
              <div
                class="preview-title"
                style="font-size:14pt;font-weight:normal;color:var(--text-muted);text-align:left;"
              >
                无应用样式
              </div>
              <div
                class="preview-body"
                style="font-size:12pt;color:var(--text-muted);"
              >
                原始内容预览
              </div>
            </div>
            <div class="theme-info">
              <span class="theme-name">🚫 无样式</span>
            </div>
          </div>
          <div
            v-for="theme in filteredThemes"
            :key="theme.id"
            class="theme-item"
            :class="{ active: selectedThemeId === theme.id }"
            @click="selectTheme(theme.id)"
          >
            <div
              class="theme-preview"
              :style="getThemePreviewStyle(theme)"
            >
              <div
                class="preview-title"
                :style="getPreviewTitleStyle(theme)"
              >
                {{ theme.name }}
              </div>
              <div
                class="preview-body"
                :style="getPreviewBodyStyle(theme)"
              >
                正文预览样式
              </div>
              <div
                class="preview-table"
                :style="getPreviewTableStyle(theme)"
              >
                <div style="display: flex;">
                  <span style="flex:1; padding:4px;">表头1</span>
                  <span style="flex:1; padding:4px;">表头2</span>
                </div>
                <div style="display: flex;">
                  <span style="flex:1; padding:4px;">数据1</span>
                  <span style="flex:1; padding:4px;">数据2</span>
                </div>
              </div>
            </div>
            <div class="theme-info">
              <span class="theme-name">{{ theme.name }}</span>
              <span
                v-if="theme.type === 'custom'"
                class="theme-badge"
              >自定义</span>
            </div>
          </div>
        </div>

        <!-- 主题操作 -->
        <div class="theme-actions">
          <button
            class="btn"
            @click="openCustomThemeEditor"
          >
            ➕ 自定义主题
          </button>
          <button
            v-if="selectedTheme?.type === 'custom'"
            class="btn"
            @click="editCustomTheme"
          >
            ✏️ 编辑
          </button>
          <button
            v-if="selectedTheme?.type === 'custom'"
            class="btn btn-danger"
            @click="deleteCustomThemeHandler"
          >
            🗑️ 删除
          </button>
        </div>
      </div>

      <!-- 中间：内容编辑区 -->
      <div class="editor-panel">
        <!-- 🔧 主题 CSS 注入（contentEditable 用，不可 scoped） -->
        <component
          :is="'style'"
          v-if="themeCSS"
        >
          {{ themeCSS }}
        </component>
        <div class="panel-header">
          <h3>✏️ 内容编辑</h3>
          <div class="editor-actions">
            <button
              class="btn"
              @click="clearContent"
            >
              清空
            </button>
            <button
              class="btn"
              @click="pasteFromClipboard"
            >
              📋 粘贴
            </button>
            <button
              v-if="isHtmlContent"
              class="btn"
              :class="{ 'btn-active': showSource }"
              :title="showSource ? '切换视觉编辑' : '查看HTML源码'"
              @click="toggleSource"
            >
              {{ showSource ? '🎨 渲染' : '<> 源码' }}
            </button>
            <!-- 🔧 学段（2026-09）：不默认、不冒充——文档有学段→自动跟随；无学段→"未选择"，手动选择才应用并写回。
                 影响作文格尺寸（小学12/初中10/高中7.5×8mm）、四线三格/六线格与拼音格行高；田字格固定低段12mm -->
            <select
              v-model="docStage"
              class="export-select"
              :title="`学段选择器：文档有学段（生成/历史带入或按载体推断）→ 自动跟随；无学段 → 未选择（不默认初中），手动选择后才应用并写回记录。${hasDocStage ? '当前学段：' + stageDisplayName : '当前未选择：请手动选择学段'}`"
            >
              <option v-if="hasDocStage" :value="AUTO_STAGE">
                学段：自动（{{ stageDisplayName }}）
              </option>
              <option v-else :value="NONE_STAGE">
                学段：未选择（请选择）
              </option>
              <option value="primary_low">
                小学低段
              </option>
              <option value="primary_mid">
                小学中段
              </option>
              <option value="primary_high">
                小学高段
              </option>
              <option value="middle">
                初中
              </option>
              <option value="high">
                高中
              </option>
            </select>
            <select
              v-model="exportFormat"
              class="export-select"
            >
              <option value="docx">
                📘 Word
              </option>
              <option value="pdf">
                📕 PDF
              </option>
              <option value="html">
                🌐 HTML
              </option>
            </select>
            <!-- 🔧 纸张版式（2026-08）：A4 单栏 / A3 两栏三栏（高考卷）/ 8K 两栏三栏（地方统考）/ 4K 四栏（大型考试大试卷） -->
            <select
              v-if="exportFormat === 'docx'"
              v-model="paperLayout"
              class="export-select"
              title="纸张版式"
            >
              <option
                v-for="(p, key) in paperPresets"
                :key="key"
                :value="key"
              >
                {{ p.label }}
              </option>
            </select>
            <!-- 🔧 卷型选择（2026-08）：密封线卷（含密封线+考生信息栏）/ 普通卷（默认，无密封线） -->
            <select
              v-if="exportFormat === 'docx'"
              v-model="sealVariant"
              class="export-select"
              title="卷型"
            >
              <option value="sealed">
                密封线卷
              </option>
              <option value="plain">
                普通卷
              </option>
            </select>
            <button
              class="btn-primary"
              :disabled="isExporting"
              @click="exportDocument"
            >
              {{ isExporting ? '导出中...' : '📥 导出' }}
            </button>
          </div>
        </div>
        
        <!-- 🔧 A4 纸张预览区（单一编辑视图：所见即所得 = 预览效果，含密封线/注意事项/得分表） -->
        <div
          v-if="isHtmlContent && !showSource"
          class="paper-preview-area"
        >
          <div
            class="paper-page"
            :style="zwgCssVars"
          >
            <RichTextEditor
              ref="contentEditor"
              v-model="rawHtmlContent"
              :custom-c-s-s="themeCSS || ''"
              :min-height="'auto'"
              @content-change="onRichEditorChange"
            />
          </div>
        </div>
        <textarea
          v-if="isHtmlContent && showSource"
          v-model="rawHtmlContent"
          class="content-textarea source-view"
          style="min-height: calc(100vh - 420px); font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; white-space: pre-wrap;"
          placeholder="HTML 源码..."
        />
        <textarea
          v-else-if="!isHtmlContent"
          ref="contentEditor"
          v-model="currentContent"
          placeholder="在此粘贴或编辑你的教辅内容...
          
支持 Markdown 基础语法：
# 一级标题
## 二级标题
### 三级标题
**粗体**
*斜体*
- 列表项
1. 数字列表

💡 提示：
- 从生成模块跳转过来的内容会自动填充
- 点击「智能识别」可自动识别标题层级"
          class="content-textarea"
          @paste="onTextareaPaste"
        />
        
        <p
          v-if="!isHtmlContent"
          class="hint"
        >
          💡 从生成模块跳转过来的内容会自动填充到这里。支持 Markdown 语法。
        </p>
        <p
          v-else
          class="hint"
        >
          💡 HTML 原样编辑模式：切换左侧主题可预览效果，导出为 Word/PDF 时自动应用主题。
        </p>
      </div>
    </div>

    <!-- 自定义主题编辑弹窗 -->
    <div
      v-if="showThemeEditor"
      class="modal-mask"
    >
      <div class="modal large-modal">
        <h3>{{ editingTheme ? '✏️ 编辑主题' : '➕ 新建主题' }}</h3>
        
        <div class="form-group">
          <label>主题名称</label>
          <input
            v-model="themeForm.name"
            type="text"
            placeholder="例如：我的精品样式"
          >
        </div>
        
        <div class="form-group">
          <label>描述</label>
          <input
            v-model="themeForm.description"
            type="text"
            placeholder="简要描述这个主题"
          >
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>学段</label>
            <select v-model="themeForm.stage">
              <option value="primary">
                小学
              </option>
              <option value="middle">
                初中
              </option>
              <option value="high">
                高中
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>类型</label>
            <select v-model="themeForm.category">
              <option value="exam">
                试卷
              </option>
              <option value="practice">
                课时练
              </option>
              <option value="summary">
                知识点总结
              </option>
              <option value="plan">
                教案
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>颜色主题</label>
            <select v-model="themeForm.colorTheme">
              <option value="original">
                蓝色系（原始）
              </option>
              <option value="warm">
                暖色系
              </option>
              <option value="fresh">
                清新系
              </option>
              <option value="academic">
                学术系
              </option>
            </select>
          </div>
        </div>
        
        <div class="modal-actions">
          <button
            class="btn"
            @click="closeThemeEditor"
          >
            取消
          </button>
          <button
            class="btn-primary"
            @click="saveCustomTheme"
          >
            保存主题
          </button>
        </div>
      </div>
    </div>

    <!-- 导出进度提示 -->
    <div
      v-if="isExporting"
      class="loading-mask"
    >
      <div class="loading-content">
        <div class="spinner" />
        <p>{{ exportStatus }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, watch, nextTick } from 'vue';
import { useDialog } from '../composables/useDialog.js';
import { getStoragePath } from '../utils/pathHelper.js';
import { useFileHandler } from '../composables/useFileHandler.js';
import {
  getAllThemes, getThemeById, addCustomTheme, updateCustomTheme, deleteCustomTheme,
  applyThemeToContent, wrapContentForTheme, getSpecialThemeEditorCSS, markdownToHtml, defaultThemeId, themeOptions,
  normalizeSealStructure, injectExamShell, stripSealStructure
} from '../themeConfig.js';
import { APP_EVENTS } from '../constants/events.js';
import { PAPER_PRESETS } from '../config/paperPresets.js';
import { getMergedSpec, normalizeStage3 } from '../config/layoutSpec.js'; // 作文格/书写格尺寸按学段（排版规格库）
import RichTextEditor from '../components/RichTextEditor.vue';
import { normalizeRubyTags } from '../utils/rubyNormalizer.js';
import { stripAiCodeFence, normalizeLeadingMarkers, normalizeMathCircleBlanks } from '../utils/contentCleaner.js'; // 导出端 AI 代码块/对话残留剥离 + 行首"项目符号+序号"归一（与 GenerateModule 共用，防同构副本各自演化）
import storage from '../utils/storage';
import { compressDocArray, decompressDocArray } from '../utils/contentCompress.js';

defineOptions({ name: 'TypesetModule' });

// ==================== 状态 ====================
const selectedThemeId = ref(null);  // 🔧 默认无选中样式
const currentContent = ref('');
const previewContent = ref('');
const customFileName = ref('');
const showThemeEditor = ref(false);
const editingTheme = ref(null);
const themeGroupFilter = ref('');
const isExporting = ref(false);
const exportStatus = ref('');
const paperPresets = PAPER_PRESETS; // 🔧 纸张版式预设（A4 单栏 / A3 两栏三栏 / 8K 两栏三栏 / 4K 四栏）
const paperLayout = ref('a4-1col'); // 🔧 纸张版式：默认 A4 单栏；多栏 = 分栏 + 每栏页码按栏计数（Word 公式域自动算）
const sealVariant = ref('plain'); // 🔧 卷型：sealed（密封线卷）/ plain（普通卷，默认）
const exportFormat = ref('docx');

// 🔧 处理从生成模块跳转过来的 HTML 内容
const isHtmlContent = ref(false);
const rawHtmlContent = ref('');
const pristineHtmlForExport = ref('');  // 🔧 原始 HTML 副本(保留所有 class)，专用于导出
const showSource = ref(false);  // 🔧 源码/渲染视图切换
let persistDebounceTimer = null;  // 🔧 性能优化：防抖 localStorage 写入（500ms）

// 🔧 HTML 源码格式化：Tiptap getHTML() 输出为无换行的压缩单行 HTML，
//    需在块级标签边界补换行，源码视图才能呈现段落结构。
//    （块级标签之间的换行符是无害空白，不影响 Tiptap 重新解析与渲染）
const formatHtmlSource = (html) => {
  if (!html) return html;
  return html
    // 块级元素闭合标签后换行
    .replace(/(<\/(?:p|h[1-6]|div|li|ul|ol|table|thead|tbody|tfoot|tr|blockquote|pre|figure|section)>)/gi, '$1\n')
    // 块级容器开始标签后换行（ul/ol/table 内的子项独立成行）
    .replace(/(<(?:ul|ol|table|thead|tbody|tfoot|tr)(?:\s[^>]*)?>)/gi, '$1\n')
    // hr / 分页符等自闭合块后换行
    .replace(/(<hr[^>]*>)/gi, '$1\n')
    // 收敛多余空行（保证幂等）
    .replace(/\n{2,}/g, '\n')
    .replace(/\n+$/, '');
};

const toggleSource = async () => {
  if (!showSource.value) {
    // 切入源码视图前格式化，恢复段落结构展示
    rawHtmlContent.value = formatHtmlSource(rawHtmlContent.value);
  } else {
    // 🔧 切回渲染视图前归一化密封线结构：源码视图粘贴的模板结构（.seal-zone 等）
    //    → 标准 sealed-wrapper，否则 Tiptap 不识别（字不旋转、无虚线）
    rawHtmlContent.value = normalizeSealStructure(rawHtmlContent.value);
  }
  showSource.value = !showSource.value;
};

// 🔧 Tiptap 编辑器内容变更回调
const onRichEditorChange = (html) => {
  rawHtmlContent.value = html;
  // 🔧 从 contentEditable DOM 读取真实 HTML（保留所有 class），同步到导出缓存
  //    ⚠️ Vue 模板 ref 会自动解包 defineExpose 的 ShallowRef，
  //       所以 contentEditor.value.editor 已经是 Editor 实例，不要加 .value
  if (contentEditor.value?.editor?.view?.dom) {
    pristineHtmlForExport.value = contentEditor.value.editor.view.dom.innerHTML;
  } else {
    pristineHtmlForExport.value = html;
  }
  // 🔧 性能优化：localStorage 写入防抖 500ms，避免每次按键都同步写盘
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = setTimeout(() => {
    persistCurrentEdits(pristineHtmlForExport.value);
  }, 500);
};

// 🔧 多文档管理：支持从生成模块传入多个文档并切换
const documents = ref([]);

// 🔧 生成记录：直接从 localStorage 读取，无需依赖事件推送
const GEN_STORAGE_KEY = 'wisdom_generated_docs';
const genRecords = ref([]);
const currentGenRecordId = ref(null);  // 🔧 跟踪当前加载的生成记录，编辑后回写
const refreshGenRecords = async () => {
  try {
    const saved = await storage.getItem(GEN_STORAGE_KEY).catch(() => null);
    const all = saved && Array.isArray(saved) ? decompressDocArray(saved) : [];
    genRecords.value = all.filter(r => !r._deleted);
  } catch (e) { genRecords.value = []; }
};
const loadGenRecord = (rec) => {
  const content = rec?.content || '';
  if (content.length < 50) return;
  currentGenRecordId.value = rec.id || null;  // 🔧 记住加载的记录 ID
  loadFromGenerate({ content, meta: { title: rec.title || '未命名', genType: rec.genType || '', stage: rec?.meta?.stage || rec?.stage || '' } });
};
// 🔧 将当前编辑内容回写到生成记录，刷新后不丢
const persistCurrentEdits = async (content) => {
  if (!content || !currentGenRecordId.value) return;
  // 🔧 剥离卷面固定件（注意事项/得分表）：固定件为渲染层注入，不写回生成记录，
  //    重新打开/导出时由 withExamShell/wrapContentForTheme 幂等重建
  content = String(content || '').replace(/<div class="exam-shell">[\s\S]*?<\/div>/gi, '');
  if (!content) return;
  try {
    const saved = await storage.getItem(GEN_STORAGE_KEY).catch(() => null);
    if (!saved || !Array.isArray(saved)) return;
    // 📦 解压 → 修改 → 压缩写回
    const records = decompressDocArray(saved);
    const idx = records.findIndex(r => r.id === currentGenRecordId.value);
    if (idx >= 0) {
      records[idx].content = content;
      await storage.setItem(GEN_STORAGE_KEY, compressDocArray(records)).catch(() => {});
      // 同步更新内存缓存（保持解压态）
      genRecords.value = records.filter(r => !r._deleted);
    }
  } catch (e) { /* ignore */ }
};
const activeDocId = ref(null);
const currentDoc = computed(() => documents.value.find(d => d.id === activeDocId.value));
const hasDocs = computed(() => documents.value.length > 0);
// 🔧 导出文件名：基于当前文档标题，清理 Windows 非法字符
const exportBaseName = computed(() => {
  const title = currentDoc.value?.title || '排版文档';
  return title
    .replace(/\//g, '-')           // 日期中的 / 替换为 -
    .replace(/[<>:"\\|?*]/g, '_') // 其他 Windows 非法字符
    .replace(/\s+/g, ' ')
    .trim() || '排版文档';
});

const contentEditor = ref(null);
const { showConfirmDialogFn, showAlertDialogFn } = useDialog();

const { selectFiles, parseWord } = useFileHandler();

// 主题表单
const themeForm = ref({
  name: '',
  description: '',
  stage: 'high',
  category: 'exam',
  colorTheme: 'original'
});

// ==================== 计算属性 ====================
const selectedTheme = computed(() => getThemeById(selectedThemeId.value));

// ==================== 学段语义（2026-09：不默认、不冒充，选择才生效） ====================
//  - 文档学段 docOriginStage：从生成/历史记录 meta.stage 带入（单一事实），每次打开文档恢复为"自动跟随"。
//  - 文档确有学段 → 下拉"自动（学段名）"；文档无学段且按载体推断不出 → 下拉"未选择（请选择）"，
//    此时不声称任何学段、不写回记录，仅用中性默认（与 CSS 缺省一致的 12mm/9mm）渲染编辑与预览。
//  - 手动选档 = 显式应用学段并写回（排版文档条目 + 生成记录），此后"自动"跟随新值。
//  - ⚠️ 主题与学段解耦：主题=纯样式可跨学段共用，不参与学段解析/尺寸回退。
const AUTO_STAGE = '__auto__';
const NONE_STAGE = '';
const docOriginStage = ref('');   // 文档自身学段（打开时带入；手动修改时同步）
const docStage = ref(NONE_STAGE); // 下拉值：__auto__（跟随文档）/ ''（未选择）/ 五档显式值（已应用）
const hasDocStage = computed(() => !!docOriginStage.value || (docStage.value !== AUTO_STAGE && docStage.value !== NONE_STAGE));
// 生效学段：手动选择 > 文档学段 > ''（未选择；尺寸中性默认见 STAGE_NEUTRAL）
const effStage = computed(() => {
  if (docStage.value !== AUTO_STAGE && docStage.value !== NONE_STAGE) return docStage.value;
  if (docStage.value === AUTO_STAGE) return docOriginStage.value;
  return '';
});
// 未选择时渲染/导出用中性默认（与 carrierCss/RTE 缺省一致：作文格 12mm、四线 9mm = GRID_CELL primary）
const STAGE_NEUTRAL = 'primary';
const STAGE_NAME_5 = { primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段', middle: '初中', high: '高中' };
const STAGE_NAME_3 = { primary: '小学', middle: '初中', high: '高中' };
// 选择器显示名：手动/文档学段 → 档名；未选择 → 提示占位
const stageDisplayName = computed(() => {
  const raw = effStage.value;
  if (!raw) return '未选择（请选择）';
  return STAGE_NAME_5[raw] || STAGE_NAME_3[normalizeStage3(raw)] || raw;
});
// 打开/切换文档：有学段 → 自动跟随；无学段 → 未选择（不默认、不冒充）
const applyDocStage = (stage) => { docOriginStage.value = stage || ''; docStage.value = stage ? AUTO_STAGE : NONE_STAGE; };
// 🔧 无学段字段的旧记录/粘贴内容：按作答载体推断学段（单一事实 WRITING_CARRIER）——
//    田字格/米字格/拼音格仅语文低段 → 低段；四线三格/六线格为英语字母书写(小学中段) → 中段；
//    仍无信号保持"未选择"。推断仅用于本次渲染展示，不写回记录（老数据真实学段未知）
const sniffCarrierStage = (html) => {
  if (!html || typeof html !== 'string') return '';
  if (/class="[^"]*(tian-zi-ge|mi-zi-ge|pinyin-line)[^"]*"/.test(html)) return 'primary_low';
  if (/class="[^"]*(four-line-three|sixian-ge)[^"]*"/.test(html)) return 'primary_mid';
  return '';
};
// 手动选择 = 应用本文档学段并写回（持久化；"未选择/自动"不触发）
watch(docStage, (v) => {
  if (v === AUTO_STAGE || v === NONE_STAGE) return;
  docOriginStage.value = v;
  persistStageOverride(v);
});
const persistStageOverride = async (s) => {
  const doc = documents.value.find(d => d.id === activeDocId.value);
  if (doc) doc.stage = s;
  if (!currentGenRecordId.value) return;
  try {
    const saved = await storage.getItem(GEN_STORAGE_KEY).catch(() => null);
    if (!saved || !Array.isArray(saved)) return;
    const records = decompressDocArray(saved);
    const idx = records.findIndex(r => r.id === currentGenRecordId.value);
    if (idx >= 0) { records[idx].stage = s; await storage.setItem(GEN_STORAGE_KEY, compressDocArray(records)).catch(() => {}); }
  } catch (e) { /* 写回失败不阻塞编辑 */ }
};

// 🔧 作文格预览格宽/格高按学段读排版规格库 ZUOWEN_CELL（曾硬编码 12/10/7.5mm，面板调规格不生效）
//    四线三格/拼音格行高：--flt-h 恒 1.45em（随字母字号自适应，与主题/导出同口径；曾按学段 mm，2026-09 改）
const zwgCssVars = computed(() => {
  const key = normalizeStage3(effStage.value || STAGE_NEUTRAL);
  const ZC = getMergedSpec().ZUOWEN_CELL;
  const c = ZC[key] || { widthMm: 12, heightMm: 12 };
  return {
    '--zwg-cell-w': `${c.widthMm}mm`,
    '--zwg-cell-h': `${c.heightMm}mm`,
    '--flt-h': '1.45em',
  };
});

const filteredThemes = computed(() => {
  let allThemes = getAllThemes();
  
  // 添加分组信息
  allThemes = allThemes.map(t => {
    const option = themeOptions.find(o => o.value === t.id);
    return { ...t, group: option?.group || (t.type === 'custom' ? '自定义' : '其他') };
  });
  
  if (!themeGroupFilter.value) return allThemes;
  return allThemes.filter(t => t.group === themeGroupFilter.value);
});

// 🔧 提取当前主题的 CSS（用于注入富文本编辑器，实现编辑即预览）
const themeCSS = computed(() => {
  try {
    // 🔧 内容含密封线特征（关键词 或 sealed-wrapper/seal-zone 结构）但未选主题时，
    //    回退用 sealed_exam 提供密封线样式——否则编辑器走无样式 fallback，
    //    密封线丢失左右 2.5cm 边距与边距外侧布局
    const raw = rawHtmlContent.value || '';
    const cssThemeId = selectedThemeId.value
      || (raw && (sealMarkRegex.test(raw) || /sealed-wrapper|seal-zone|seal-note/.test(raw)) ? 'sealed_exam' : null);
    const fullHtml = applyThemeToContent('<div></div>', cssThemeId, { 
      isHtmlContent: true, 
      forceImportant: true, // 确保标题/字体等主题样式不被覆盖
      stage: effStage.value || STAGE_NEUTRAL // 作文格/书写格按文档学段（未选择→中性默认，不冒充学段）
    });
    const match = fullHtml.match(/<style>([\s\S]*?)<\/style>/i);
    let css = match ? match[1].trim() : '';

    // 🔧 编辑器即导出视觉（所见即所得 = Word 导出效果）：
    //    - 导出页面的全局重置（*）范围化到编辑内容区（.ProseMirror 内），不污染编辑器工具栏
    //    - body 基础样式（字体/字号/行距/颜色）映射到 .ProseMirror 继承链；
    //      margin/padding/background 丢弃——纸张与内容边距由 .paper-page 壳提供，避免双重留白
    const bodyMatch = css.match(/body\s*\{([^}]*)\}/);
    if (bodyMatch) {
      const keepDecls = bodyMatch[1]
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && !/^(margin|padding|background|width|min-width|max-width|height)/i.test(s));
      if (keepDecls.length) css += `\n.ProseMirror { ${keepDecls.join('; ')} }\n`;
    }
    css = css.replace(/^\s*\*\s*\{/, '.ProseMirror * {');
    css = css.replace(/body\s*\{[^}]*\}/g, '');

    // 🔑 只保留 h1-h6 标题的 !important，其余全部移除
    const preserveImportant = /(\bh[1-6]\b|four-line-three|sixian-ge|oral-box|square-box|math-circle-blank-18|zuo-wen-ge|square-grid|bracket-grid|pinyin-line|english-line|blank-\d|sealed-wrapper|seal-zone|seal-line|seal-note|seal-info|seal-char)/;
    css = css.replace(
      /([^{}]+)\{([^{}]+)\}/g,
      (full, selector, body) => {
        if (preserveImportant.test(selector)) {
          return `${selector}{${body}}`;
        }
        return `${selector}{${body.replace(/\s*!important/g, '')}}`;
      }
    );

    // 🔑 标题的 color 不加 !important，允许 AI 生成的内联颜色覆盖主题颜色
    //    字号/字体等仍保留 !important，确保主题排版结构不被打乱
    css = css.replace(
      /(h[1-6]\b[^{]*\{)([^}]+)(\})/g,
      (match, selectorOpen, body, close) => {
        return selectorOpen + body.replace(/(color\s*:\s*[^;]+)\s*!important/g, '$1') + close;
      }
    );

    // 🔑 田字格/米字格：彻底移除 CSS 规则，仅靠 Tiptap renderHTML 内联样式（与无样式模式一致）
    //    无样式时田字格能正常居中，说明内联样式已足够；注入的 CSS 规则无论有无 !important 都有干扰风险
    css = css.replace(/[^\}]*\btian-zi-ge\b[^\{]*\{[^\}]*\}/g, '');
    css = css.replace(/[^\}]*\bmi-zi-ge\b[^\{]*\{[^\}]*\}/g, '');

    // 🔧 编辑器中没有 <body>，通过 .ProseMirror 注入可继承的基础样式
    //    ⚠️ 关键：font-size 设于 .ProseMirror 自身，利用 CSS 继承机制向下传递
    //       子元素若没有自己的 font-size 规则，则继承 12pt
    //       主题的 h1 { font-size:18pt !important } 会覆盖继承值（自身规则 > 继承值）
    //       若用 .ProseMirror * — 则变成子元素的直接规则 (0,1,1)，会反杀 h1 的 !important
    const theme = getThemeById(selectedThemeId.value);
    if (theme) {
      css += `\n.ProseMirror { font-family: ${theme.bodyFont}; font-size: ${theme.bodySize}pt; line-height: ${theme.lineHeight}; color: ${theme.bodyColor}; }\n`;
      // 🔑 统一正文字号：AI 可能给 .option/.answer-item 等设 15px 内联样式，强制继承主题正文字号
      //    排除 h1-h6（标题有自己的主题字号），排除 sup/sub/superscript/subscript（上/下标需缩小）
      css += `.ProseMirror .answer-item,.ProseMirror .notice,.ProseMirror .card,.ProseMirror p,.ProseMirror li,.ProseMirror td p,.ProseMirror th p{font-size:inherit!important}\n`;
      // 🔧 特殊主题布局 CSS（Tiptap 编辑区用 .ProseMirror，保留原名）
      const specialCSS = getSpecialThemeEditorCSS(selectedThemeId.value);
      if (specialCSS) css += specialCSS;
      // 🔑 CSS 层面防御：清除主题 CSS（如 p{text-indent:2em!important}）对田字格内部 span 的污染
      //    优先级 .tian-zi-ge span(0,1,1) > p(0,0,1)，带 !important 确保覆盖 forceImportant
      css += `\n.tian-zi-ge span,.tian-zi-ge span span,.mi-zi-ge span,.mi-zi-ge span span{text-indent:0!important;padding-left:0!important;padding-right:0!important;margin-left:0!important;margin-right:0!important}\n`;
      // 🔑 四线三格/四线格防御：防止主题的 p{text-indent:2em} 等规则污染 inline-block 内部
      css += `.four-line-three,.sixian-ge{text-indent:0!important;padding-left:4px!important;padding-right:4px!important;text-align:center!important}\n`;
    }

    // 🔧 卷型选择（2026-08）：普通卷时编辑器预览同步隐藏密封线（所见即所得 = 导出口径）——
    //    seal 结构保留（切回密封线卷即时恢复），仅视觉隐藏；页面壳左右边距改为 2cm 与导出普通卷一致
    if (sealVariant.value === 'plain') {
      css += `.sealed-wrapper{padding:20mm 20mm!important}\n`;
      css += `.seal-zone,.seal-line,.seal-note,.seal-info,.seal-char{display:none!important}\n`;
    }

    return css;
  } catch (e) {
    console.warn('提取主题 CSS 失败:', e);
    return '';
  }
});

// ==================== 主题预览样式 ====================
const getThemePreviewStyle = (theme) => {
  return {
    fontFamily: theme.bodyFont,
    backgroundColor: theme.tableOddRowBg || '#f5f9ff',
    borderLeft: `4px solid ${theme.heading1Color || theme.titleColor}`
  };
};

const getPreviewTitleStyle = (theme) => {
  return {
    fontFamily: theme.titleFont,
    fontSize: '14px',
    fontWeight: 'bold',
    color: theme.titleColor
  };
};

const getPreviewBodyStyle = (theme) => {
  return {
    fontFamily: theme.bodyFont,
    fontSize: '12px',
    color: '#333'
  };
};

const getPreviewTableStyle = (theme) => {
  return {
    marginTop: '8px',
    fontSize: '10px'
  };
};

// ==================== 主题操作 ====================
const selectTheme = (themeId) => {
  // 🔧 支持切换：点击已选中主题 → 取消选中（无样式）
  selectedThemeId.value = (selectedThemeId.value === themeId) ? null : themeId;
};

const refreshThemes = () => {
  // 主题是响应式的，无需额外操作
};

const openCustomThemeEditor = () => {
  editingTheme.value = null;
  themeForm.value = {
    name: '',
    description: '',
    stage: 'high',
    category: 'exam',
    colorTheme: 'original'
  };
  showThemeEditor.value = true;
};

const editCustomTheme = () => {
  const theme = selectedTheme.value;
  if (!theme || theme.type !== 'custom') return;
  
  editingTheme.value = theme;
  themeForm.value = {
    name: theme.name,
    description: theme.description || '',
    stage: theme.stage || 'high',
    category: theme.category || 'exam',
    colorTheme: theme.colorTheme || 'original'
  };
  showThemeEditor.value = true;
};

const closeThemeEditor = () => {
  showThemeEditor.value = false;
  editingTheme.value = null;
};

const saveCustomTheme = async () => {
  if (!themeForm.value.name.trim()) {
    await showAlertDialogFn('请输入主题名称');
    return;
  }
  
  if (editingTheme.value) {
    updateCustomTheme(editingTheme.value.id, themeForm.value);
  } else {
    const newTheme = addCustomTheme(themeForm.value);
    selectedThemeId.value = newTheme.id;
  }
  
  closeThemeEditor();
};

const deleteCustomThemeHandler = async () => {
  const theme = selectedTheme.value;
  if (!theme || theme.type !== 'custom') return;
  
  const confirmed = await showConfirmDialogFn(`确定删除主题「${theme.name}」吗？`);
  if (!confirmed) return;
  
  deleteCustomTheme(theme.id);
  if (selectedThemeId.value === theme.id) {
    selectedThemeId.value = defaultThemeId;
  }
};

// ==================== 内容编辑 ====================
const clearContent = async () => {
  const hasContent = isHtmlContent.value
    ? (rawHtmlContent.value && rawHtmlContent.value.length > 20)
    : currentContent.value.trim();
  if (!hasContent) return;
  const confirmed = await showConfirmDialogFn('确定要清空排版内容吗？未保存的修改将丢失。');
  if (!confirmed) return;
  currentContent.value = '';
  previewContent.value = '';
  isHtmlContent.value = false;
  rawHtmlContent.value = '';
};

const pasteFromClipboard = async () => {
  try {
    // 🔧 优先尝试读取剪贴板的 HTML 内容（从 Word/网页复制时）
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        const html = await blob.text();
        if (html && /<(h[1-6]|p|div|table|ul|ol|li|span|img)\b/i.test(html)) {
          // 检测到富文本内容，切换到 HTML 模式用富文本编辑器
          // 🔧 密封线结构归一化：模板结构（.seal-zone/.seal-note/.seal-info/.seal-char）→ 标准 sealed-wrapper，
          //    否则预览/导出不识别（字不旋转、无虚线）
          isHtmlContent.value = true;
          rawHtmlContent.value = normalizeSealStructure(html);
          pristineHtmlForExport.value = normalizeSealStructure(html);
          currentContent.value = '';
          return;
        }
      }
    }
  } catch (e) {
    // clipboard.read() 可能因权限被拒，回退到纯文本读取
    console.warn('剪贴板 HTML 读取失败，回退纯文本:', e.message);
  }

  // 回退：纯文本粘贴
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      currentContent.value = text;
      isHtmlContent.value = false;
      rawHtmlContent.value = '';
    }
  } catch (e) {
    await showAlertDialogFn('无法读取剪贴板，请手动粘贴 (Ctrl+V)');
  }
};

// 🔧 纯文本 textarea 粘贴拦截：检测富文本 HTML 并自动切换到富文本编辑器
//    场景：用户在纯文本模式下 Ctrl+V 从 Word/网页复制的内容，
//    浏览器默认会剥离 HTML 只保留纯文本。这里拦截 paste 事件，
//    优先读取剪贴板的 HTML 版本，有富文本则切换编辑器模式。
const onTextareaPaste = async (e) => {
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        const html = await blob.text();
        if (html && /<(h[1-6]|p|div|table|ul|ol|li|span|img)\b/i.test(html)) {
          e.preventDefault();
          // 🔧 密封线结构归一化：模板结构（.seal-zone 等）→ 标准 sealed-wrapper（预览/导出识别）
          const normalized = normalizeSealStructure(html);
          isHtmlContent.value = true;
          rawHtmlContent.value = normalized;
          currentContent.value = '';
          pristineHtmlForExport.value = normalized;
          return;
        }
      }
    }
  } catch (err) {
    // clipboard.read() 可能因权限被拒（非 HTTPS/localhost），回退到默认纯文本粘贴
    console.warn('textarea paste HTML 读取失败，使用默认粘贴:', err.message);
  }
  // 无富文本或读取失败 → 走浏览器默认纯文本粘贴行为
};

// 🔧 contentEditable 输入事件 → 同步到 rawHtmlContent
const onHtmlEditorInput = () => {
  // Tiptap 通过 v-model + content-change 事件管理，此函数保留以兼容旧逻辑
};

// 🔧 将主题 CSS 字符串转为内联 style 对象（已废弃，RichTextEditor 使用 customCSS prop）
const parseThemeCSS = (cssString) => ({});

// 🔧 监听 HTML 内容变化（Tiptap v-model 自动同步，这里仅做 HTML 检测兜底 + 源码编辑同步）
watch(rawHtmlContent, (newVal) => {
  // 🔧 性能优化：已经是 HTML 模式时跳过正则检测（每次按键都在同一模式下，无需重复判断）
  if (!isHtmlContent.value) {
    if (newVal && newVal.length > 20 && /<\/[a-zA-Z][^>]*>/i.test(newVal) && /<(h[1-6]|p|div|table|ul|ol|li|span|img)\b/i.test(newVal)) {
      isHtmlContent.value = true;
    }
  }
  // 🔧 源码视图编辑时同步到 pristineHtmlForExport，确保导出包含编辑内容
  if (showSource.value && newVal && newVal.length > 20) {
    pristineHtmlForExport.value = newVal;
    // 🔧 源码视图编辑也回写生成记录
    persistCurrentEdits(newVal);
  }
});

// 🔧 纯文本 textarea 粘贴 HTML 源码 → 自动检测并迁移到富文本模式
//    场景：用户在纯文本模式下直接 Ctrl+V 粘贴 HTML 源码，
//    内容进入 currentContent 而非 rawHtmlContent，需自动切换让渲染按钮出现
watch(currentContent, (newVal) => {
  if (newVal && newVal.length > 20 && /<\/[a-zA-Z][^>]*>/i.test(newVal) && /<(h[1-6]|p|div|table|ul|ol|li|span|img)\b/i.test(newVal)) {
    isHtmlContent.value = true;
    rawHtmlContent.value = newVal;
    currentContent.value = '';
    pristineHtmlForExport.value = newVal;
  }
});

// Markdown 工具栏（纯文本模式保留）
const insertMarkdown = (syntax) => {
  const textarea = contentEditor.value;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = currentContent.value;
  currentContent.value = text.substring(0, start) + syntax + text.substring(end);
  nextTick(() => {
    textarea.focus();
    textarea.setSelectionRange(start + syntax.length, start + syntax.length);
  });
};

// ==================== 预览 ====================
const applyThemeAndPreview = async () => {
  const hasContent = isHtmlContent.value
    ? (rawHtmlContent.value && rawHtmlContent.value.length > 20)  // 降低门槛，避免 Tiptap 初始空段落阻断
    : currentContent.value.trim();

  if (!hasContent) {
    await showAlertDialogFn('请先输入内容');
    return;
  }
  
  try {
    let htmlContent;
    if (isHtmlContent.value && rawHtmlContent.value) {
      htmlContent = wrapContentForTheme(rawHtmlContent.value, effectiveThemeFor(rawHtmlContent.value));
    } else if (isHtmlContent.value && pristineHtmlForExport.value) {
      htmlContent = wrapContentForTheme(pristineHtmlForExport.value, effectiveThemeFor(pristineHtmlForExport.value));
    } else {
      // 手动输入的 Markdown/纯文本：先转为 HTML
      htmlContent = markdownToHtml(currentContent.value);
    }
    // 🔧 卷型选择（2026-08）：普通卷时预览与导出口径一致——剥离密封线结构（避免"预览有密封线、
    //    导出没有"的视觉错觉），并同步修正注意事项第 1 条文案；页面壳 padding 与普通卷 docx
    //    边距一致（左右 2cm → 可用宽 170mm，作文格列数与导出一致）
    if (sealVariant.value === 'plain') {
      htmlContent = stripSealStructure(htmlContent);
      htmlContent = htmlContent.replace(/(答题前，请将)密封线内的(学校、班级、姓名、学号填写清楚。)/, '$1$2');
      if (!/<div[^>]*class=["'][^"']*plain-wrapper/.test(htmlContent)) {
        htmlContent = `<div class="plain-wrapper" style="padding:20mm 20mm;box-sizing:border-box;min-height:100%;">${htmlContent}</div>`;
      }
    }
    
    // 应用主题（导出时也强制 !important，确保与编辑预览一致）
    const themedHtml = applyThemeToContent(htmlContent, selectedThemeId.value, {
      isHtmlContent: isHtmlContent.value,
      forceImportant: true,
      stage: effStage.value || STAGE_NEUTRAL // 作文格/书写格按文档学段（未选择→中性默认）
    });
    previewContent.value = themedHtml;
  } catch (e) {
    console.error('预览失败:', e);
    await showAlertDialogFn('预览失败: ' + e.message);
  }
};

// ==================== 上传Word ====================
const uploadCustomWord = async () => {
  try {
    const files = await selectFiles();
    if (!files || files.length === 0) return;
    
    const filePath = files[0];
    customFileName.value = filePath.split('\\').pop();
    
    // 解析Word
    const result = await parseWord(filePath);
    if (result && result.success && result.html) {
      // 🔧 Word 解析结果是 HTML，走 loadFromGenerate 统一处理
      loadFromGenerate(result.html);
    } else {
      // 🔧 parseWord 返回失败（如 Python 脚本崩溃）时提示用户
      const errMsg = result?.error || '未知解析错误';
      console.error('上传Word失败:', errMsg);
      await showAlertDialogFn('Word 解析失败: ' + errMsg);
    }
  } catch (e) {
    console.error('上传Word失败:', e);
    await showAlertDialogFn('上传失败: ' + e.message);
  }
};

// ==================== PDF 打印降级 ====================
/**
 * 🔧 清洗导出内容中的 AI 对话残留和 markdown 代码块标记
 *    仅剥离对话文本和 ```html 标记，不修改 HTML 结构本身
 *    逻辑收敛至 contentCleaner.stripAiCodeFence（与 GenerateModule.downloadDoc 共用，防同构副本各自演化）
 */
const sanitizeExportContent = (html) => stripAiCodeFence(html);

const printFallback = (htmlContent) => {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (w) {
    w.document.write(htmlContent);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  } else {
    // 如果弹窗被拦截，在当前窗口打印
    console.warn('弹窗被拦截，使用当前窗口打印');
    window.print();
  }
};

// ==================== 导出 ====================
const exportDocument = async () => {
  // 🔧 导出前强制从 contentEditable 实时 DOM 刷新，确保最新编辑不丢失
  //    ⚠️ 只刷新 pristineHtmlForExport（导出专用缓存），不写回 rawHtmlContent——
  //       写回会触发 RichTextEditor 的 watch → setContent 重建编辑器视图，
  //       导致用户在排版编辑中手动删除的内容（空行/换行）被“还原”
  if (isHtmlContent.value) {
    // 🔧 优先直接读 editor.view.dom；读不到时用组件暴露的 getDomHTML（组件内部解包 editor，更可靠）
    const dom = contentEditor.value?.editor?.view?.dom;
    const domHtml = dom?.innerHTML || contentEditor.value?.getDomHTML?.() || '';
    if (domHtml) pristineHtmlForExport.value = domHtml;
  }
  // 🔧 导出前立即 flush 编辑内容到生成记录（防抖 500ms 未触发时，切回生成模块导出也能拿到最新内容）
  if (persistDebounceTimer) {
    clearTimeout(persistDebounceTimer);
    persistDebounceTimer = null;
    await persistCurrentEdits(pristineHtmlForExport.value || rawHtmlContent.value);
  }

  // 🔧 导出时优先用原始 HTML（保留所有 class），无原始内容时降级用预览
  const exportHtmlSource = pristineHtmlForExport.value || (isHtmlContent.value ? rawHtmlContent.value : currentContent.value);
  
  const hasContent = isHtmlContent.value
    ? (exportHtmlSource && exportHtmlSource.length > 20)
    : currentContent.value.trim();
  if (!hasContent) {
    await showAlertDialogFn('请先输入内容');
    return;
  }

  // 🔧 用原始 HTML 直接包装主题（不走 Tiptap 的 applyThemeAndPreview，避免丢失 class）
  //    内容含密封线特征时自动按 sealed_exam 包装（不依赖用户手动选主题）
  let previewContentForExport;
  if (isHtmlContent.value && pristineHtmlForExport.value) {
    let wrapped = wrapContentForTheme(pristineHtmlForExport.value, effectiveThemeFor(pristineHtmlForExport.value));
    // 🔧 卷型选择：普通卷剥离密封线结构（HTML/PDF 导出与 DOCX 口径一致，PDF 走默认页边距）
    if (sealVariant.value === 'plain') {
      wrapped = stripSealStructure(wrapped);
      wrapped = wrapped.replace(/(答题前，请将)密封线内的(学校、班级、姓名、学号填写清楚。)/, '$1$2');
    }
    previewContentForExport = applyThemeToContent(wrapped, effectiveThemeFor(pristineHtmlForExport.value), {
      isHtmlContent: true,
      forceImportant: true,
      stage: effStage.value // 作文格/书写格按文档学段
    });
  } else {
    // 降级：用预览流程
    await applyThemeAndPreview();
    previewContentForExport = previewContent.value;
  }
  
  if (!previewContentForExport) {
    await showAlertDialogFn('生成预览内容失败');
    return;
  }
  
  // 🔧 清洗 AI 对话残留和 markdown 代码块标记（第二道防线）
  previewContentForExport = sanitizeExportContent(previewContentForExport);
  
  isExporting.value = true;
  exportStatus.value = '正在生成文档...';
  
  try {
    if (exportFormat.value === 'html') {
      const blob = new Blob([previewContentForExport], { type: 'text/html;charset=utf-8' });
      downloadBlob(blob, `${exportBaseName.value}.html`);
    } else if (exportFormat.value === 'docx') {
      exportStatus.value = '正在生成Word文档...';

      // 🔧 所见即所得：优先从编辑器实时 DOM 读取最新内容（用户刚删除的空行立即生效，
      //    不受 content-change 150ms 防抖/缓存时序影响），读不到才降级 v-model/缓存
      //    （降级源为 AI 原始 HTML：td 无 p → 行内田字格形态，docxBuilder 已跳过格子后残留 br）
      const liveDom = contentEditor.value?.editor?.view?.dom;
      let sourceHtml = liveDom?.innerHTML || rawHtmlContent.value || pristineHtmlForExport.value;
      // 🔴 答案区兜底合并：编辑器（Tiptap）schema 不保留 answer-section 容器，liveDom 会整体丢掉答案区
      //    （生成时有答案页、导出却消失的根因）——导出时从原始生成内容提取 answer-section 补回末尾，
      //    正文以编辑器实时内容为准（含用户编辑）、答案区以生成源为准
      try {
        const rawSrc = rawHtmlContent.value || pristineHtmlForExport.value || '';
        if (rawSrc && !/answer-section/i.test(sourceHtml)) {
          const ansIdx = rawSrc.search(/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>/i);
          if (ansIdx >= 0) {
            const ansPart = rawSrc.slice(ansIdx).replace(/<\/html>\s*$/i, '');
            sourceHtml = `${sourceHtml}\n${ansPart}`;
            console.log('🔧 排版导出：编辑器丢失答案区，已从原始内容兜底合并答案区');
          }
        }
      } catch (e) { console.warn('⚠️ 答案区兜底合并失败:', e.message); }
      // 🔍 临时诊断日志（定位田字格单元格导出多出换行的来源，验证后删除）
      console.log('[导出诊断]', JSON.stringify({
        isHtmlContent: isHtmlContent.value,
        showSource: showSource.value,
        refBound: !!contentEditor.value,
        editorReady: !!contentEditor.value?.editor,
        liveDomReady: !!liveDom,
        liveLen: liveDom?.innerHTML?.length || 0,
        srcFrom: (liveDom?.innerHTML ? 'liveDom' : (rawHtmlContent.value ? 'rawHtmlContent' : 'pristine')),
        tdHasP: /<td[^>]*>\s*<p[\s>]/.test(sourceHtml || ''),
        gridThenBr: /tian-zi-ge[\s\S]{0,300}<br/.test(sourceHtml || ''),
      }));
      if (!sourceHtml || sourceHtml.length < 20) {
        throw new Error('编辑器内容为空');
      }
      // 🔧 所见即所得：编辑器里有的换行原样导出，删除的换行已不在 DOM 中，不会导出。
      //    AI 残留的成串 br 已在生成入库时清理，导出阶段不再改动换行
      // 🔧 导出前预处理：ruby 标签 → ruby-char span（拆分多字注音为逐字独立单元）
      sourceHtml = normalizeRubyTags(sourceHtml);

      // 🔧 与预览一致：应用主题包装（密封线结构归一化 + 卷面固定件注入）。
      //    编辑器内容若无 sealed-wrapper 结构（AI 未输出/被删），预览由 wrap 自动包装，
      //    导出若不包装则密封线文字会退化为普通段落（一行横排、无虚线、无旋转）——
      //    必须与预览走同一包装（effectiveThemeFor：内容含密封特征时自动按 sealed_exam），
      //    确保导出 Word 与预览所见一致。
      sourceHtml = wrapContentForTheme(sourceHtml, effectiveThemeFor(sourceHtml));

      // 🔧 卷型选择（2026-08）：普通卷 = 先按密封线卷包装（注入卷面固定件），再剥离密封线结构
      //    （sealed-wrapper/seal-zone，docxBuilder 据此判 hasSealLine=false → 左右 2cm 边距 + A3 栏距 4cm），
      //    并同步修正注意事项第 1 条文案（去掉"密封线内"字样）；密封线卷（默认）保持原样。
      if (sealVariant.value === 'plain') {
        sourceHtml = stripSealStructure(sourceHtml);
        sourceHtml = sourceHtml.replace(/(答题前，请将)密封线内的(学校、班级、姓名、学号填写清楚。)/, '$1$2');
      }

      // 🔧 懒加载 docxBuilder（避免 chunk 加载时序导致整个组件挂掉）
      const { htmlToDocxBlob } = await import('../utils/docxBuilder.js');

      // 🔑 WYSIWYG 导出：用 wrapper 隔离主题 CSS <style> 标签，
      //    避免 style 被 docxBuilder 当作正文内容逐行解析。
      //    CSS 通过文档级联生效（wrapper 在 document 中），
      //    但 buildDocxFromDom 只处理 clone，不会遇到 style 标签。
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:absolute;visibility:hidden;width:210mm;left:-9999px;';

      const clone = document.createElement('div');
      const theme = getThemeById(selectedThemeId.value);
      if (theme) {
        clone.style.fontFamily = theme.bodyFont;
        clone.style.fontSize = theme.bodySize + 'pt';
        clone.style.lineHeight = String(theme.lineHeight);
        clone.style.color = theme.bodyColor || '#000000';
      }
      clone.innerHTML = sourceHtml;

      // 🔑 注入主题 CSS <style> 标签到 wrapper（不在 clone 内部），
      //    CSS 规则通过文档级联对 clone 内所有元素生效，
      //    确保 getComputedStyle(h1/p) 能读到主题的 font-size/color。
      //    ⚠️ 不使用 forceImportant：避免正则产生的双 !important 非法 CSS。
      if (selectedThemeId.value) {
        const fullHtml = applyThemeToContent('<div></div>', selectedThemeId.value, {
          isHtmlContent: true,
          forceImportant: false,
          stage: effStage.value || STAGE_NEUTRAL, // 作文格/书写格按文档学段（未选择→中性默认）
        });
        const cssMatch = fullHtml.match(/<style>([\s\S]*?)<\/style>/i);
        if (cssMatch) {
          let exportCSS = cssMatch[1].trim();
          // 清理不适用于导出克隆的规则
          exportCSS = exportCSS.replace(/\*\s*\{[^}]*\}/g, '');
          exportCSS = exportCSS.replace(/body\s*\{[^}]*\}/g, '');
          exportCSS = exportCSS.replace(/@page\s*\{[^}]*\}/g, '');
          exportCSS = exportCSS.replace(/@media\s+print\s*\{[^}]*\}/g, '');

          // 🔑 统一正文字号：覆盖 AI 给 .answer-item/.notice/.card 等设的内联字号
          //    强制所有正文元素继承克隆根节点的主题字号（与编辑器 CSS 策略一致）
          exportCSS += '\n.answer-item,.notice,.card,p,li,td p,th p{font-size:inherit!important}\n';

          // 🔧 补充通用块级边距规则，将主题的 class 选择器边距映射为元素级规则
          //    确保导出时 getComputedStyle 能正确读取边距（不依赖 class 名）
          if (theme?.styles) {
            const classToTag = {
              '.main-title': 'h1',
              '.heading1': 'h1, h2',
              '.heading2': 'h3, h4',
              '.heading3': 'h5, h6',
              '.normal-paragraph': 'p',
            };
            const genRules = [];
            for (const [cls, tag] of Object.entries(classToTag)) {
              const s = theme.styles[cls];
              if (!s) continue;
              const parts = [];
              if (s.marginTop) parts.push(`margin-top: ${s.marginTop}`);
              if (s.marginBottom) parts.push(`margin-bottom: ${s.marginBottom}`);
              if (parts.length > 0) {
                genRules.push(`${tag} { ${parts.join('; ')}; }`);
              }
            }
            if (genRules.length > 0) {
              exportCSS += '\n/* 通用块级边距（导出用）*/\n' + genRules.join('\n');
            }
          }

          const styleEl = document.createElement('style');
          styleEl.setAttribute('data-export-theme', 'true');
          styleEl.textContent = exportCSS;
          wrapper.appendChild(styleEl);
        }
      }

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      try {
        // 只传 clone（不含 style 标签），避免 CSS 被当成正文
         // 🔧 作文格格子按学段尺寸（排版规格库 ZUOWEN_CELL），学段 = 文档学段/手动选择（未选择→中性默认）
        const blob = await htmlToDocxBlob(clone, effStage.value || STAGE_NEUTRAL, paperLayout.value);
        document.body.removeChild(wrapper);
        downloadBlob(blob, `${exportBaseName.value}.docx`);
      } finally {
        if (wrapper.parentNode) document.body.removeChild(wrapper);
      }

    } else if (exportFormat.value === 'pdf') {
      const storagePath = getStoragePath();
      const defaultPath = `${storagePath}/导出/${exportBaseName.value}_${Date.now()}.pdf`;
      
      if (window.electronAPI?.exportPdf && window.electronAPI?.showSaveDialog) {
        const { filePath, canceled } = await window.electronAPI.showSaveDialog({
          title: '保存PDF',
          defaultPath,
          filters: [{ name: 'PDF文件', extensions: ['pdf'] }],
        });
        if (canceled || !filePath) {
          exportStatus.value = '';
          return;
        }
        exportStatus.value = '正在生成PDF文档...';
        // 🔧 密封线试卷（页面壳自带 A4 页边距）Puppeteer 边距传 0，避免双重留白；普通文档保持默认
        const pdfSealed = /sealed-wrapper|seal-zone/.test(previewContentForExport || '');
        const result = await window.electronAPI.exportPdf(previewContentForExport, filePath, { margin: pdfSealed ? 0 : undefined });
        exportStatus.value = '';
        await nextTick();
        if (result.success) {
          await showAlertDialogFn(`PDF已保存至：${result.path}`);
        } else {
          await showAlertDialogFn(`PDF导出失败：${result.error || '未知错误'}\n\n将使用浏览器打印作为降级方案`);
          printFallback(previewContentForExport);
        }
      } else {
        // 🔧 降级：使用浏览器打印
        exportStatus.value = '正在打开打印对话框（请选择"另存为PDF"）...';
        printFallback(previewContentForExport);
        exportStatus.value = '请在打印对话框中选择"另存为PDF"保存';
      }
    }
    
    exportStatus.value = '导出完成！';
  } catch (e) {
    console.error('导出失败:', e);
    await showAlertDialogFn('导出失败: ' + e.message);
  } finally {
    setTimeout(() => {
      isExporting.value = false;
      exportStatus.value = '';
    }, 1000);
  }
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ==================== 接收生成模块传递的内容 ====================

// ==================== 多文档切换 ====================
const saveCurrentDoc = () => {
  if (!activeDocId.value) return;
  const doc = documents.value.find(d => d.id === activeDocId.value);
  if (doc) { doc.content = isHtmlContent.value ? rawHtmlContent.value : currentContent.value; }
};
const switchToDoc = (docId) => {
  if (docId === activeDocId.value) return;
  saveCurrentDoc();
  const doc = documents.value.find(d => d.id === docId);
  if (!doc) return;
  activeDocId.value = docId;
  loadContentSilent(doc.content, doc.stage || '');
};
const closeDoc = (docId) => {
  const idx = documents.value.findIndex(d => d.id === docId);
  if (idx < 0) return;
  documents.value.splice(idx, 1);
  if (activeDocId.value === docId) {
    const next = documents.value[Math.min(idx, documents.value.length - 1)];
    activeDocId.value = next?.id || null;
    if (next) loadContentSilent(next.content, next.stage || '');
    else { rawHtmlContent.value = ''; currentContent.value = ''; isHtmlContent.value = false; applyDocStage(''); }
  }
};
// ==================== 渲染预览（已并入编辑视图，所见即所得） ====================
// 编辑器即为完整预览：内容加载时注入卷面固定件（注意事项 + 题号得分表），
// 编辑区所见即所得（含密封线/注意事项/得分表），导出时 wrapContentForTheme 幂等复用。
const sealMarkRegex = /密封线|学校[:：]|班级[:：]|姓名[:：]|学号[:：]|考生[:：]|考号[:：]/;
const effectiveThemeFor = (src) => (src && sealMarkRegex.test(src) ? 'sealed_exam' : selectedThemeId.value);
// 🔧 编辑内容注入卷面固定件 + 密封线包装：与导出（wrapContentForTheme）同路径，
//    内容含密封特征时按 sealed_exam 完整包装（密封线 + 注意事项 + 得分表），
//    编辑区所见即所得 = 导出 Word 效果；保存回写时剥离固定件（由导出端重新注入）
const withExamShell = (html, stage) => {
  if (!html || typeof html !== 'string') return html || '';
  try {
    const normalized = normalizeSealStructure(html);
    if (sealMarkRegex.test(normalized) || /sealed-wrapper|seal-zone|seal-note/.test(normalized)) {
      // 含密封特征：完整包装（内部含 normalizeSealStructure + injectExamShell，幂等）
      return wrapContentForTheme(normalized, 'sealed_exam');
    }
    // 无密封特征：仍注入题号得分表（若有正式大题结构）
    return injectExamShell(normalized, stage || 'primary');
  } catch (e) {
    // 🔧 防御：包装失败时回退原始内容，确保编辑器始终可加载
    console.warn('卷面包装失败，使用原始内容:', e);
    return html;
  }
};

const loadContentSilent = (content, stage = '') => {
  if (!content || typeof content !== 'string') return;
  applyDocStage(stage || sniffCarrierStage(content)); // 文档学段：记录字段优先，无则按载体推断（作文格/书写格/导出口径）
  // 🔧 行首页签"项目符号+序号"在此统一剥离（幂等）：历史/旧内容首次载入排版即规范，与生成端/编辑器同口径，
  //    避免"第二遍才剥"——排版/导出直接读取本入口产出的 rawHtmlContent，必须先归一再装卷面
  content = normalizeMathCircleBlanks(normalizeLeadingMarkers(content));
  const isHtml = /<\/[a-zA-Z][^>]*>/i.test(content) && /<(h[1-6]|p|div|table|ul|ol|li|span|img)\b/i.test(content);
  // 🔧 HTML 内容统一做密封线结构归一化 + 注入卷面固定件（编辑区所见即所得），幂等
  if (isHtml) { isHtmlContent.value = true; rawHtmlContent.value = withExamShell(content); currentContent.value = ''; }
  else { isHtmlContent.value = false; rawHtmlContent.value = ''; currentContent.value = content; }
};

const loadFromGenerate = async (payload) => {
  let content = typeof payload === 'string' ? payload : payload?.content || '';
  const meta = (typeof payload === 'object' && payload.meta) ? payload.meta : {};
  if (!content || typeof content !== 'string') return;
  // 🔧 生成/载入统一规范：行首页签"项目符号+序号"剥离 + 算式 ○→填空圈（幂等，与生成端/编辑器同口径），确保排版/导出首次即规范
  content = normalizeMathCircleBlanks(normalizeLeadingMarkers(content));
  // 🔧 文档学段（作文格/书写格/导出按学段走排版规格库）：生成参数五档 stageKey 优先，
  //    旧记录/无字段内容按载体推断（田字格/拼音格→低段、四线格→中段），避免误回退默认档
  applyDocStage(meta.stage || sniffCarrierStage(content));
  
  // 🔧 直接保存原始 HTML（不再走 Tiptap 预处理，contentEditable 原样保留所有 class）
  // 🔧 密封线结构归一化 + 注入卷面固定件（编辑区所见即所得，幂等）
  content = withExamShell(content, meta.stage);
  pristineHtmlForExport.value = content;
  
  const isHtml = /<\/[a-zA-Z][^>]*>/i.test(content) && /<(h[1-6]|p|div|table|ul|ol|li|span|img)\b/i.test(content);
  
  if (isHtml) {
    isHtmlContent.value = true;
    rawHtmlContent.value = content;
    currentContent.value = '';
    // 🔧 等 Vue 渲染 RichTextEditor 后 v-model 自动注入内容
    await nextTick();
  } else {
    isHtmlContent.value = false;
    rawHtmlContent.value = '';
    currentContent.value = content;
    console.log('📥 加载纯文本内容:', content.length, '字');
  }
  // 🔧 多文档注册：保存或更新文档列表
  saveCurrentDoc();
  const docTitle = meta.title || '未命名文档';
  const existing = documents.value.find(d => d.title === docTitle);
  if (existing) {
    existing.content = isHtmlContent.value ? rawHtmlContent.value : currentContent.value;
    existing.cleanHtml = rawHtmlContent.value || currentContent.value;
    existing.genType = meta.genType || existing.genType;
    existing.stage = meta.stage || existing.stage || '';
    activeDocId.value = existing.id;
  } else {
    const newDoc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: docTitle,
      genType: meta.genType || '',
      stage: meta.stage || '',
      content: isHtmlContent.value ? rawHtmlContent.value : currentContent.value,
      cleanHtml: rawHtmlContent.value || currentContent.value,
    };
    documents.value.push(newDoc);
    activeDocId.value = newDoc.id;
  }
};

// ==================== 监听主题切换：刷新预览 ====================
watch(selectedThemeId, async () => {
  const hasContent = isHtmlContent.value
    ? (rawHtmlContent.value && rawHtmlContent.value.length > 20)
    : currentContent.value.trim();
  if (hasContent) {
    applyThemeAndPreview();
  }
});

// 🔧 卷型切换（密封线卷/普通卷）：刷新预览，使普通卷预览剥离密封线、与导出一致
watch(sealVariant, async () => {
  const hasContent = isHtmlContent.value
    ? (rawHtmlContent.value && rawHtmlContent.value.length > 20)
    : currentContent.value.trim();
  if (hasContent) {
    applyThemeAndPreview();
  }
});

// 🔧 HTML 模式下编辑器已实时显示主题样式，仅导出时生成完整预览 HTML

// ==================== 初始化 ====================
// 🔧 调试入口：在控制台执行 window.__debugBlanks() 查看编辑区中所有 blank 相关 span 的 class 和伪元素
window.__debugBlanks = () => {
  const editor = contentEditor.value;
  if (!editor?.editor?.view?.dom) { console.log('编辑器未就绪'); return; }
  const dom = editor.editor.view.dom;
  const blanks = dom.querySelectorAll('[class*="blank-"]');
  console.log(`=== 编辑区 blank span 共 ${blanks.length} 个 ===`);
  const summary = {};
  blanks.forEach(el => {
    const cls = el.className?.toString() || '';
    const beforeContent = getComputedStyle(el, '::before').content;
    const afterContent = getComputedStyle(el, '::after').content;
    summary[cls] = (summary[cls] || 0) + 1;
    console.log(
      `  [${el.tagName}] class="${cls}"`,
      `::before="${beforeContent}"`,
      `::after="${afterContent}"`,
      `text="${el.textContent?.substring(0,20)}"`
    );
  });
  console.log('=== 汇总 ===', summary);
};
console.log('💡 调试已就绪：在控制台输入 __debugBlanks() 回车即可查看编辑区 blank span 详情');
// 🔧 keep-alive 支持：首次挂载和每次激活都检查待处理内容
const consumePendingContent = () => {
  if (window.__pendingTypesetContent) {
    loadFromGenerate(window.__pendingTypesetContent);
    window.__pendingTypesetContent = null;
  }
};

onMounted(() => {
  refreshGenRecords();
  consumePendingContent();
  window.addEventListener(APP_EVENTS.TYPESET_CONTENT, (e) => {
    if (e.detail) {
      loadFromGenerate(e.detail);
    }
  });
  // ☁️ 云端同步完成后刷新记录列表（排除软删除）
  window.addEventListener(APP_EVENTS.DATA_SYNC_COMPLETE, refreshGenRecords);
});

onActivated(() => {
  refreshGenRecords();
  consumePendingContent();
});
</script>

<style scoped>
.typeset-module {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.typeset-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 1px;
  background: var(--border-light);
}

/* ==================== 左侧主题面板 ==================== */
.theme-panel {
  width: 280px;
  background: white;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
  margin: 0;
}

.upload-section {
  margin-bottom: 16px;
}

.theme-filter {
  margin-bottom: 16px;
}

.filter-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: white;
  font-size: 13px;
}

.theme-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.theme-item {
  border: 2px solid var(--border-light);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.theme-item:hover {
  border-color: var(--primary-light);
  box-shadow: 0 2px 8px rgba(43, 94, 167, 0.1);
}

.theme-item.active {
  border-color: var(--primary-light);
  background: #f0f7ff;
  box-shadow: 0 2px 12px rgba(43, 94, 167, 0.15);
}

.theme-preview {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.preview-title {
  margin-bottom: 8px;
}

.preview-body {
  margin-bottom: 8px;
  opacity: 0.8;
}

.preview-table {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  padding: 4px;
}

.theme-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.theme-name {
  font-weight: 500;
  font-size: 13px;
}

.theme-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--primary-light);
  color: white;
  border-radius: 12px;
}

.theme-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

/* ==================== 中间编辑面板 ==================== */
.editor-panel {
  flex: 1;
  background: white;
  display: flex;
  flex-direction: column;
  padding: 16px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* ═══════ A4 纸张预览区 ═══════ */
/* 模拟 Word A4 纸张：宽 210mm、至少一页高、页面阴影（Word 页面视图质感），连续滚动 */
/* 🔧 padding-top=0：滚动时工具栏 sticky top:0 紧贴容器顶端（此前 16px 顶部内边距让工具栏上端悬空） */
.paper-preview-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: #e8e8e8;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 0 0 16px;
}

.paper-page {
  width: 210mm;
  min-height: 297mm;
  background: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18);
  margin: 0 0 16px;
}

/* A4 纸张内：剥除编辑器外框，2cm 页边距 */
.paper-page :deep(.rich-text-editor) {
  border: none !important;
  border-radius: 0 !important;
  padding: 20mm;
  min-height: 0;
  box-sizing: border-box;
}

/* 🔧 密封线试卷：页面壳 .sealed-wrapper 自带 A4 页边距（上下左右统一 2cm），
   编辑器/ProseMirror 取消重复留白 → 编辑区几何与模板一致（密封区在纸边 20mm、正文 54mm） */
.paper-page :deep(.rich-text-editor:has(.sealed-wrapper)) {
  padding: 0 !important;
}
.paper-page :deep(.rich-text-editor:has(.sealed-wrapper) .ProseMirror) {
  padding: 0 !important;
}

/* A4 纸张内：工具栏吸顶固定，不随内容滚动 */
.paper-page :deep(.editor-toolbar-wrapper) {
  border-radius: 0 !important;
  position: sticky;
  top: 0;
  z-index: 10;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 12px;
}

.toolbar-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: var(--primary-bg);
  border-color: var(--primary-light);
}
.toolbar-btn.active {
  background: var(--primary-light);
  color: white;
  border-color: var(--primary-light);
}

.toolbar-sep {
  width: 1px;
  background: #ddd;
  margin: 0 6px;
  align-self: stretch;
}

.toolbar-select {
  padding: 2px 4px;
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  background: #fff;
  font-size: 11px;
  height: 26px;
  cursor: pointer;
  outline: none;
}

.toolbar-color {
  width: 24px;
  height: 24px;
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  cursor: pointer;
  padding: 1px;
  background: #fff;
}

/* 🔧 contentEditable 编辑器 */
.html-editor {
  flex: 1;
  width: 100%;
  padding: 16px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: white;
  overflow-y: auto;
  outline: none;
  line-height: 1.8;
}
.html-editor:focus {
  border-color: var(--primary-light);
}
.html-editor[placeholder]:empty::before {
  content: attr(placeholder);
  color: #999;
  font-style: italic;
}

.content-textarea {
  flex: 1;
  width: 100%;
  padding: 16px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  background: var(--bg-card);
}

.content-textarea:focus {
  outline: none;
  border-color: var(--primary-light);
  background: white;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.export-select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: white;
  font-size: 13px;
}

/* ==================== 弹窗 ==================== */
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

.large-modal::before {
  height: 6px;
  background: linear-gradient(90deg, #1e4a8a 0%, var(--primary-light) 50%, #1e4a8a 100%);
}

.modal h3 {
  margin-bottom: 20px;
  color: var(--primary);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--primary);
  font-size: 13px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  font-size: 13px;
  background: white;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary-light);
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

/* 📱 移动端弹窗适配 */
@media (max-width: 767px) {
  /* 弹窗安全区适配 */
  .modal-mask {
    padding: env(safe-area-inset-top, 12px) 12px env(safe-area-inset-bottom, 12px) 12px;
    box-sizing: border-box;
  }
  .modal {
    min-width: 0 !important;
    width: 92vw !important;
    max-width: 92vw !important;
    padding: 16px 14px !important;
    border-radius: 12px !important;
    max-height: calc(100% - 16px) !important;
  }
  .modal::before {
    border-radius: 10px 10px 0 0 !important;
  }
  .large-modal {
    min-width: 0 !important;
    width: 96vw !important;
    max-width: 96vw !important;
  }
  .modal h3 {
    font-size: 15px !important;
    margin-bottom: 12px !important;
  }
  .modal p, .modal .hint {
    font-size: 13px !important;
  }
  .modal-actions {
    margin-top: 14px !important;
    padding-top: 12px !important;
    gap: 8px !important;
  }
  .modal-actions .btn,
  .modal-actions .btn-primary {
    flex: 1;
    font-size: 13px;
    padding: 10px 6px;
    text-align: center;
    min-height: 40px;
  }
  /* 主题编辑弹窗 */
  .form-group label {
    font-size: 12px !important;
  }
  .form-group input,
  .form-group select {
    font-size: 13px !important;
    padding: 9px 10px !important;
  }
  .form-row {
    flex-direction: column;
    gap: 8px;
  }
}

/* ==================== 加载遮罩 ==================== */
.loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4000;
  pointer-events: none;
}

.loading-content {
  background: white;
  padding: 32px 48px;
  border-radius: 16px;
  text-align: center;
  pointer-events: auto;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.2);
  border: 2px solid #f39c12;
  position: relative;
}

.loading-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: linear-gradient(90deg, #f39c12 0%, #f1c40f 50%, #f39c12 100%);
  border-radius: 14px 14px 0 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-light);
  border-top-color: var(--primary-light);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ==================== 按钮样式 ==================== */
.btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn:hover {
  background: #f5f5f5;
}

.btn-primary {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--primary-light);
  color: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #1e4a8a;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  color: var(--danger);
  border-color: var(--danger-light);
}

.btn-danger:hover {
  background: var(--danger-light);
}

.btn-full {
  width: 100%;
  margin: 8px 0;
}

.btn-icon {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.btn-icon:hover {
  background: #f5f5f5;
}

/* ==================== 滚动条 ==================== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

.recommend-badge {
  background: var(--primary-light);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  margin-left: 6px;
  font-weight: 500;
}

/* ⭐ 加点字样式 - 在字下方显示点(·) */
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

/*  加点字样式 - 在字下方显示点(·) */
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

/* 波浪线 - 语文病句修改 */
.wavy-underline {
  text-decoration: underline;
  text-decoration-style: wavy;
  text-decoration-color: #d32f2f;
  text-underline-offset: 3px;
}

/* 双线格 */
.double-line {
  text-decoration: underline;
  text-decoration-style: double;
  text-underline-offset: 3px;
}

/* 单线格 */
.single-line {
  text-decoration: underline;
  text-decoration-style: solid;
  text-underline-offset: 3px;
}

/* ═══════ 填空横线/括号空位（blank-N）═══════
   🔧 作答载体画法已收口到 carrierCss.js（main.js 全局注入单一事实源；编辑器/预览/排版/主题导出共用）——
   曾在此 scoped 块重复维护 u/span 档位副本（u 走 text-underline 而非 border-bottom、档位残缺），
   scoped 规则本不命中 v-html 内容却反复被改造成第二口径，已删除勿重建（2026-09 全局一致性修复） */

/* 部首标注 */
ruby.radical rb { font-size: 1em; }
ruby.radical rt { font-size: 0.5em; color: var(--primary-light); }

/* 笔画笔顺 */
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

/* 田字格/米字格/作文格旧 scoped 副本（1.8em/1.3em em 随字号）已于 2026-09 删除——
   画法/尺寸单一事实源：themeConfig mm 版 + carrierCss（编辑器/预览/导出/docx 同口径）；v-html 内容不带 scoped 属性，旧副本本不命中，勿在此重建 */
/* 四线三格/六线格/拼音格/英语书写格画法已收口到 carrierCss（全局注入，行高 --flt-h 由 :root/容器 CSS 变量按学段设置）——
   曾在此维护 em(随字号) 副本，与全局 mm 规则并存造成双口径，已删除勿重建 */

/* 口算框 */
.oral-box {
  display: inline-block;
  border: 1.5px solid #333;
  padding: 2px 8px;
  margin: 0 2px;
  min-width: 40px;
  text-align: center;
  vertical-align: middle;
  font-size: inherit !important;
}
.oral-box.blank {
  min-width: 50px;
  border-style: dashed;
  color: var(--text-muted);
}

/* 竖式计算 */
.vertical-calculation {
  display: inline-block;
  margin: 8px 16px;
  font-family: 'Courier New', monospace;
}
.vertical-calculation .vc-row {
  text-align: right;
  padding: 1px 8px;
  letter-spacing: 0.2em;
}
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

/* 脱式计算等号对齐 */
.off-formula { margin: 8px 0; }
.off-formula .of-line { text-indent: 1.5em; line-height: 1.8; }

/* 连线题 */
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

/* 词库框 - 完形填空 */
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

/* 化学反应条件 */
.chem-condition {
  font-size: 0.7em;
  vertical-align: super;
  color: #555;
  line-height: 1;
}

/* 密封线：标准试卷样式（A4 + 上下 2cm、左右 2.35cm 页边距）——
   页面壳 .sealed-wrapper 自带边距（正文不被挤压，虚线不贴正文）；
   密封区 .seal-zone 绝对定位于左侧页边距内（纸边 0~20mm），在正文内边距外侧；
   虚线在 19mm、与上下边距对齐（20~277mm）；线(上1/4=84mm)/封(中=148mm)/密(下1/4=213mm) 均匀嵌在虚线上（右缘贴线）；
   提示语/信息栏向密封线靠拢（x=8mm）并垂直居中于上下边距中间（两组间留 6mm 间距）；
   .seal-note/.seal-info/.seal-char 逆时针旋转 90°（字头朝左、从下往上读）；
   字号分级：提示语 12pt bold、信息栏 12pt、密/封/线 10.5pt bold */
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
.sealed-wrapper > .sealed-content {
  margin-left: 0;
  box-sizing: border-box;
}
.seal-zone p { margin: 0; }

/* 📜 卷面固定件：注意事项 + 题号得分表（排版模块统一注入，字号对齐模板 12pt） */
.exam-notice {
  font-size: 12pt;
  line-height: 1.9;
  margin: 4pt 0 8pt;
}
.exam-notice .notice-title {
  font-weight: bold;
  margin: 0;
}
.exam-notice .notice-item {
  margin: 0;
}
.exam-score-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10pt;
  font-size: 12pt;
}
.exam-score-table th,
.exam-score-table td {
  border: 1px solid #000;
  text-align: center;
  padding: 4px 0;
}
.exam-score-table th {
  font-weight: bold;
  font-family: '黑体', 'SimHei', sans-serif;
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

/* 得分框 */
.score-box {
  display: inline-block;
  border: 1.5px solid #333;
  padding: 3px 16px;
  text-align: center;
  min-width: 60px;
  font-weight: bold;
  font-size: inherit !important;
}

/* 辅助线虚线 */
.dashed-line {
  display: inline-block;
  border-bottom: 1.5px dashed var(--text-muted);
  min-width: 40px;
  margin: 0 2px;
}

/* 元素周期表 */
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

/* 多文档标签栏 */
.doc-tabs { display: flex; gap: 2px; padding: 6px 8px 0; background: #f0f0f0; border-bottom: 1px solid #ddd; overflow-x: auto; }
.doc-tab { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #e0e0e0; border-radius: 6px 6px 0 0; cursor: pointer; font-size: 12px; white-space: nowrap; border: 1px solid transparent; }
.doc-tab:hover { background: #d5d5d5; }
.doc-tab.active { background: #fff; border-color: #ddd; border-bottom-color: #fff; font-weight: 600; }
.doc-tab-title { max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
.doc-tab-type { font-size: 10px; color: #888; background: #eee; padding: 1px 6px; border-radius: 8px; }
.doc-tab-close { margin-left: 4px; font-size: 14px; color: #999; line-height: 1; }
.doc-tab-close:hover { color: #d32f2f; }

/* 生成记录列表 */
.gen-records-section { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e0e0e0; }
.gen-records-list { max-height: 200px; overflow-y: auto; }
.gen-record-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 10px; margin: 2px 0; border-radius: 6px;
  cursor: pointer; font-size: 12px; background: #f5f5f5;
}
.gen-record-item:hover { background: #e8f0fe; }
.gen-record-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.gen-record-type { font-size: 10px; color: #888; background: #fff; padding: 1px 6px; border-radius: 8px; margin-left: 8px; }
</style>

<style>
/* ===== 渲染预览（.render-page，v-html 注入内容不带 scoped 属性 → 用非 scoped 规则） =====
   完整呈现主题包装效果（密封线 + 注意事项 + 题号得分表），A4 + 上下 2cm、左右 2.35cm 页边距：
   页面壳 .sealed-wrapper 自带边距（正文不被挤压，虚线不贴正文）；
   密封区 .seal-zone 绝对定位于左侧页边距内（纸边 0~20mm），在正文内边距外侧；
   虚线在 19mm、与上下边距对齐（20~277mm）；线(上1/4=84mm)/封(中=148mm)/密(下1/4=213mm) 均匀嵌在虚线上；
   提示语/信息栏向密封线靠拢（x=8mm）并垂直居中于上下边距中间（两组间留 6mm 间距）；
   .seal-note/.seal-info/.seal-char 逆时针旋转 90°（字头朝左、从下往上读）；
   字号分级：提示语 12pt bold、信息栏 12pt、密/封/线 10.5pt bold */
.render-page {
  background: #fff;
  overflow: auto;
}
.render-page .sealed-wrapper {
  position: relative;
  padding: 20mm 25mm;
  min-height: 100%;
  box-sizing: border-box;
}
.render-page .sealed-wrapper > .seal-zone {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 20mm;
  box-sizing: border-box;
}
.render-page .seal-zone > .seal-line {
  position: absolute;
  top: 20mm;
  bottom: 20mm;
  right: 1mm;
  border-left: 1.4px dashed #000;
}
.render-page .seal-zone > .seal-note {
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
.render-page .seal-zone > .seal-info {
  position: absolute;
  left: 8mm;
  top: 254.7mm;
  transform-origin: left top;
  transform: rotate(-90deg);
  white-space: nowrap;
  font-size: 12pt;
  line-height: 1;
}
.render-page .seal-zone > .seal-char {
  position: absolute;
  right: 1mm;
  font-size: 10.5pt;
  font-weight: bold;
  line-height: 1;
  transform-origin: center;
  transform: rotate(-90deg);
}
.render-page .seal-zone > .seal-char.s-top { top: 82.4mm; }
.render-page .seal-zone > .seal-char.s-mid { top: 146.6mm; }
.render-page .seal-zone > .seal-char.s-bot { top: 210.9mm; }
.render-page .seal-zone p { margin: 0; }
.render-page .sealed-wrapper > .sealed-content {
  margin-left: 0;
  box-sizing: border-box;
}
.render-page .exam-notice {
  font-size: 11pt;
  line-height: 1.8;
  margin: 4pt 0 8pt;
}
.render-page .exam-notice .notice-title { font-weight: bold; margin: 0; }
.render-page .exam-notice .notice-item { margin: 0; }
.render-page .exam-score-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10pt;
  font-size: 11pt;
}
.render-page .exam-score-table th,
.render-page .exam-score-table td {
  border: 1px solid #000;
  text-align: center;
  padding: 4px 0;
}
.render-page .exam-score-table th { font-weight: bold; font-family: '黑体', 'SimHei', sans-serif; }
.view-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
</style>