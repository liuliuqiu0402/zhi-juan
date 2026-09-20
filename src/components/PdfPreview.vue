<template>
  <div class="pdf-preview">
    <div class="pdf-toolbar">
      <button
        class="toolbar-btn"
        :disabled="scale <= 0.5"
        @click="zoomOut"
      >
        −
      </button>
      
      <!-- 缩放比例：点击可输入 -->
      <span 
        v-if="!showScaleInput" 
        class="scale-text scale-editable" 
        title="点击输入缩放比例"
        @click="showScaleInput = true"
      >{{ Math.round(displayScale * 100) }}%</span>
      <input
        v-else
        ref="scaleInputRef"
        v-model="scaleInputValue"
        type="number"
        min="20"
        max="300"
        class="scale-input"
        @keyup.enter="applyScaleInput"
        @blur="applyScaleInput"
        @keyup.escape="cancelScaleInput"
      >
      <span style="font-size:11px; color:var(--text-muted); margin-left:4px; white-space:nowrap;">20%~300%</span>
      
      <button
        class="toolbar-btn"
        :disabled="scale >= 3"
        @click="zoomIn"
      >
        +
      </button>
      <button
        class="toolbar-btn"
        @click="resetZoom"
      >
        ⟲
      </button>
      
      <!-- 页码跳转 -->
      <span class="page-text">
        第 
        <span
          v-if="!showPageInput"
          class="page-editable"
          title="点击输入页码"
          @click="showPageInput = true"
        >{{ currentPage }}</span>
        <input
          v-else
          ref="pageInputRef"
          v-model="pageInputValue"
          type="number"
          :min="1"
          :max="totalPages"
          class="page-input"
          @keyup.enter="jumpToPage"
          @blur="jumpToPage"
          @keyup.escape="cancelPageInput"
        >
        / {{ totalPages }} 页
      </span>
    </div>
    <div
      ref="containerRef"
      class="pdf-canvas-container"
    >
      <canvas
        ref="canvasRef"
        class="pdf-canvas"
      />
      <!-- 🔴 加载失败必须看得见（2026-09-20）：原先只在 console 里 console.error，
           界面上就是一块空白画布 —— 用户唯一能说的是"预览不了了"，排查无从下手。
           现在给出：原因 + 出错路径 + 下一步（父组件可选地补一个"修复路径"动作）。 -->
      <div
        v-if="loadError"
        class="pdf-load-error"
      >
        <div class="pdf-load-error-title">
          ⚠️ PDF 无法打开
        </div>
        <div class="pdf-load-error-msg">
          {{ loadError }}
        </div>
        <div
          v-if="pdfPath"
          class="pdf-load-error-path"
        >
          {{ pdfPath }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const emit = defineEmits(['pageChange', 'loadError']);

const props = defineProps({
  pdfPath: { type: String, required: true },
  page: { type: Number, default: 1 }
});

const canvasRef = ref(null);
const containerRef = ref(null);
const scale = ref(1);
const currentPage = ref(1);
const totalPages = ref(0);
/** 加载失败的原因（空＝正常）。由本组件显示在画布区，同时通过 loadError 事件告知父组件 */
const loadError = ref('');

let pdfDoc = null;
let lastPdfPath = '';
let renderTask = null;

const PIXEL_RATIO = 2;
const displayScale = computed(() => scale.value);

// 缩放输入
const showScaleInput = ref(false);
const scaleInputValue = ref(100);
const scaleInputRef = ref(null);

const applyScaleInput = () => {
  showScaleInput.value = false;
  // 处理输入：如果输入 10，当成 100%（默认）
  let val = parseInt(scaleInputValue.value) || 100;
  // 如果输入的值小于 20，说明用户可能输的是百分比数字，直接取整
  if (val >= 20 && val <= 300) {
    scale.value = val / 100;
  } else {
    // 超出范围，恢复当前值
    scaleInputValue.value = Math.round(scale.value * 100);
    return;
  }
  renderPage();
};

const cancelScaleInput = () => {
  showScaleInput.value = false;
  scaleInputValue.value = Math.round(scale.value * 100);
};

// 页码跳转
const showPageInput = ref(false);
const pageInputValue = ref(1);
const pageInputRef = ref(null);

const jumpToPage = () => {
  showPageInput.value = false;
  const val = parseInt(pageInputValue.value) || 1;
  const targetPage = Math.max(1, Math.min(totalPages.value, val));
  if (targetPage !== currentPage.value && pdfDoc) {
    currentPage.value = targetPage;
    renderPage();
    // 通知父组件页码变化
    emit('pageChange', targetPage);
  }
};

const cancelPageInput = () => {
  showPageInput.value = false;
  pageInputValue.value = currentPage.value;
};

const loadPdf = async () => {
  // 🔴 没有路径也要说清楚（2026-09-20）：原先是 `if (!props.pdfPath) return;` ——
  //    父组件一旦没解析出路径（例如记录里的 pdfPath 为空/查不到书），这里就是**静默空白**，
  //    用户只能说"预览不了了"，完全看不出是"根本没给路径"还是"PDF 打不开"。
  if (!props.pdfPath) {
    pdfDoc = null;
    totalPages.value = 0;
    loadError.value = '没有可用的 PDF 路径（这条教材记录里没有 PDF，或记录与文件已对不上）。';
    emit('loadError', loadError.value);
    return;
  }

  // ✅ 如果 pdfPath 没变，且 pdfDoc 已存在，直接渲染当前页
  if (lastPdfPath === props.pdfPath && pdfDoc) {
    console.log('✅ 复用已缓存的 PDF 文档');
    loadError.value = '';
    if (props.page > 0 && props.page <= totalPages.value) {
      currentPage.value = props.page;
    }
    await renderPage();
    return;
  }

  try {
    loadError.value = '';
    // 先关闭之前的 PDF，释放内存（destroy 是异步的，必须等它完成再读新文件，
    // 否则大文件会出现"上一个文档还占着内存/句柄"的叠加）
    if (pdfDoc) {
      try { await pdfDoc.destroy(); } catch { /* 已销毁/销毁中，忽略 */ }
      pdfDoc = null;
    }

    console.log('📖 加载PDF:', props.pdfPath);

    // 用 file:// 直接加载，不用 base64，避免大文件撑爆内存
    const filePath = props.pdfPath.replace(/\\/g, '/');
    const fileUrl = filePath.startsWith('file://') ? filePath : 'file:///' + filePath;

    pdfDoc = await pdfjsLib.getDocument({
      url: fileUrl,
      disableAutoFetch: true,
      disableStream: true,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true
    }).promise;

    lastPdfPath = props.pdfPath;  // ✅ 记录当前 pdfPath
    totalPages.value = pdfDoc.numPages;
    console.log('📖 PDF页数:', totalPages.value);

    if (props.page > 0 && props.page <= totalPages.value) {
      currentPage.value = props.page;
    }

    await renderPage();
  } catch (e) {
    const raw = (e && e.message) || '未知错误';
    // pdf.js 对"文件不存在/读不到"报的是 Missing PDF / UnexpectedResponse / status 0，
    // 一律翻译成用户能懂的因果，并提示下一步（路径由模板单独显示，便于对账）
    loadError.value = /Missing|not found|ENOENT|UnexpectedResponse|status\s*0/i.test(raw)
      ? '文件不存在或无法读取：可能已被移动、改名或删除。若你刚在教材库目录里改过名，点「🔗 修复路径」即可重新指认。'
      : `读取失败：${raw}`;
    pdfDoc = null;
    totalPages.value = 0;
    console.error('加载 PDF 失败:', raw);
    emit('loadError', loadError.value);
  }
};

/** 供父组件强制重读（例如刚刚"修复路径"把文件指回原位，路径字符串可能没变） */
const reload = () => {
  lastPdfPath = '';
  loadPdf();
};

const renderPage = async () => {
  if (!pdfDoc || !canvasRef.value) return;

  if (renderTask) {
    renderTask.cancel();
    renderTask = null;
    await new Promise(r => setTimeout(r, 50));
  }

  try {
    const pdfPage = await pdfDoc.getPage(currentPage.value);
    const MAX_PIXELS = 16000;
    let renderScale = scale.value * PIXEL_RATIO;

    let viewport = pdfPage.getViewport({ scale: renderScale });

    if (viewport.width > MAX_PIXELS || viewport.height > MAX_PIXELS) {
      const ratio = Math.min(
        MAX_PIXELS / viewport.width,
        MAX_PIXELS / viewport.height
      );
      renderScale = renderScale * ratio;
      viewport = pdfPage.getViewport({ scale: renderScale });
    }

    const canvas = canvasRef.value;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = (viewport.width / PIXEL_RATIO) + 'px';
    canvas.style.height = (viewport.height / PIXEL_RATIO) + 'px';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    renderTask = pdfPage.render({ canvasContext: ctx, viewport });
    await renderTask.promise;

    const w = parseFloat(canvas.style.width);
    if (w > 1320) {
      canvas.style.maxWidth = '1320px';
      canvas.style.height = 'auto';
    } else {
      canvas.style.maxWidth = '';
    }
  } catch (e) {
    if (e.name === 'RenderingCancelledException') {
      console.log('渲染已取消');
    } else {
      console.error('渲染页面失败:', e);
    }
  }
};

const zoomIn = () => { scale.value = Math.min(3, scale.value + 0.10); renderPage(); };
const zoomOut = () => { scale.value = Math.max(0.20, scale.value - 0.10); renderPage(); };
const resetZoom = () => { scale.value = 1.0; renderPage(); };

watch(() => props.pdfPath, (newPath, oldPath) => {
  if (newPath !== oldPath) {
    loadPdf();
  }
});

let pageChangeTimer = null;

watch(() => props.page, (newPage) => {
  if (newPage > 0 && pdfDoc && newPage <= totalPages.value) {
    currentPage.value = newPage;
    // ✅ 防抖：等用户停止点击后再渲染
    if (pageChangeTimer) clearTimeout(pageChangeTimer);
    pageChangeTimer = setTimeout(() => {
      renderPage();
    }, 200);
  }
});

onMounted(() => {
  nextTick(loadPdf);
});

// 暴露方法给父组件调用
defineExpose({
  currentPage,
  totalPages,
  setTotalPages: (pages) => {
    totalPages.value = pages;
  },
  // 🔁 强制重读（2026-09-20）："修复路径"把文件指回原位后，路径字符串可能没变，
  //    此时靠 watch(pdfPath) 触发不了重载，必须由父组件显式调一次
  reload,
});

// 组件销毁时释放 PDF 内存和定时器
onUnmounted(() => {
  if (pageChangeTimer) {
    clearTimeout(pageChangeTimer);
    pageChangeTimer = null;
  }
  if (renderTask) {
    renderTask.cancel();
    renderTask = null;
  }
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
});
</script>

<style scoped>
.pdf-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #525659;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.pdf-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  background: #323639;
  color: white;
  flex-shrink: 0;
}

.toolbar-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: rgba(255,255,255,0.15);
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.25);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.scale-text {
  font-size: 13px;
  min-width: 45px;
  text-align: center;
}

.page-text {
  font-size: 13px;
  margin-left: auto;
}

.pdf-canvas-container {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: safe center;
  align-items: flex-start;
  padding: 16px;
  min-height: 0;
}

.pdf-canvas {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  background: white;
  flex-shrink: 0;
  margin: auto;
}

/* 🔴 加载失败提示（2026-09-20）：替代原先"空白画布 + 只在 console 报错"的静默失败 */
.pdf-load-error {
  margin: auto;
  max-width: 520px;
  padding: 18px 20px;
  border: 1px solid rgba(224, 128, 0, 0.5);
  border-radius: 10px;
  background: rgba(224, 128, 0, 0.08);
  color: #d0d0d0;
  font-size: 13px;
  line-height: 1.7;
  text-align: left;
}

.pdf-load-error-title {
  font-weight: 600;
  color: #e08000;
  margin-bottom: 6px;
}

.pdf-load-error-msg {
  margin-bottom: 8px;
}

.pdf-load-error-path {
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  color: var(--text-muted, #999);
  word-break: break-all;
}

.scale-editable {
  cursor: pointer;
  border-bottom: 1px dashed rgba(255,255,255,0.4);
  padding: 0 2px;
}

.scale-editable:hover {
  background: rgba(255,255,255,0.1);
  border-bottom-color: white;
}

.scale-input {
  width: 55px;
  height: 26px;
  text-align: center;
  font-size: 13px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  background: rgba(255,255,255,0.15);
  color: white;
  outline: none;
}

.scale-input:focus {
  border-color: white;
  background: rgba(255,255,255,0.25);
}

.page-editable {
  cursor: pointer;
  border-bottom: 1px dashed rgba(255,255,255,0.4);
  padding: 0 2px;
}

.page-editable:hover {
  background: rgba(255,255,255,0.1);
  border-bottom-color: white;
}

.page-input {
  width: 45px;
  height: 26px;
  text-align: center;
  font-size: 13px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  background: rgba(255,255,255,0.15);
  color: white;
  outline: none;
}

.page-input:focus {
  border-color: white;
  background: rgba(255,255,255,0.25);
}
</style>