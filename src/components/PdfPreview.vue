<template>
  <div class="pdf-preview">
    <div class="pdf-toolbar">
      <button class="toolbar-btn" @click="zoomOut" :disabled="scale <= 0.5">−</button>
      
      <!-- 缩放比例：点击可输入 -->
      <span 
        class="scale-text scale-editable" 
        @click="showScaleInput = true" 
        title="点击输入缩放比例"
        v-if="!showScaleInput"
      >{{ Math.round(displayScale * 100) }}%</span>
      <input
        v-else
        ref="scaleInputRef"
        type="number"
        min="20"
        max="300"
        class="scale-input"
        v-model="scaleInputValue"
        @keyup.enter="applyScaleInput"
        @blur="applyScaleInput"
        @keyup.escape="cancelScaleInput"
      />
      <span style="font-size:11px; color:var(--text-muted); margin-left:4px; white-space:nowrap;">20%~300%</span>
      
      <button class="toolbar-btn" @click="zoomIn" :disabled="scale >= 3">+</button>
      <button class="toolbar-btn" @click="resetZoom">⟲</button>
      
      <!-- 页码跳转 -->
      <span class="page-text">
        第 
        <span class="page-editable" @click="showPageInput = true" title="点击输入页码" v-if="!showPageInput">{{ currentPage }}</span>
        <input
          v-else
          ref="pageInputRef"
          type="number"
          :min="1"
          :max="totalPages"
          class="page-input"
          v-model="pageInputValue"
          @keyup.enter="jumpToPage"
          @blur="jumpToPage"
          @keyup.escape="cancelPageInput"
        />
         / {{ totalPages }} 页
      </span>
    </div>
    <div class="pdf-canvas-container" ref="containerRef">
      <canvas ref="canvasRef" class="pdf-canvas"></canvas>
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

const emit = defineEmits(['pageChange']);

const props = defineProps({
  pdfPath: { type: String, required: true },
  page: { type: Number, default: 1 }
});

const canvasRef = ref(null);
const containerRef = ref(null);
const scale = ref(1);
const currentPage = ref(1);
const totalPages = ref(0);

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
  if (!props.pdfPath) return;
  
  // ✅ 如果 pdfPath 没变，且 pdfDoc 已存在，直接渲染当前页
  if (lastPdfPath === props.pdfPath && pdfDoc) {
    console.log('✅ 复用已缓存的 PDF 文档');
    if (props.page > 0 && props.page <= totalPages.value) {
      currentPage.value = props.page;
    }
    await renderPage();
    return;
  }
  
  try {
    // 先关闭之前的 PDF，释放内存
    if (pdfDoc) {
      pdfDoc.destroy();
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
    console.error('加载 PDF 失败:', e.message);
  }
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
  }
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