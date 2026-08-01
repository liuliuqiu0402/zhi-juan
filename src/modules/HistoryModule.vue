<template>
  <div class="embedded-page">
    <div class="page-header">
      <h2>📚 历史记录</h2>
      <div class="history-search">
        <input
          type="text"
          v-model="historySearchKeyword"
          placeholder="🔍 搜索标题或内容..."
          class="search-input"
          @input="filterHistory"
        />
        <select v-model="historyFilterType" @change="filterHistory" class="filter-select" style="width:auto;padding:6px 10px;border-radius:20px;border:1px solid #ddd;font-size:13px;">
          <option value="">全部类型</option>
          <option value="📝 考卷">📝 考卷</option>
          <option value="📚 课时练">📚 课时练</option>
          <option value="📖 知识点总结">📖 知识点总结</option>
          <option value="🎯 专项突破">🎯 专项突破</option>
          <option value="🔖 错题本">🔖 错题本</option>
        </select>
        <button class="btn" @click="clearAllHistory">清空全部</button>
      </div>
    </div>
    <div class="history-list-page">
      <div v-for="item in filteredHistoryList" :key="item.id" class="history-item-page">
        <div class="history-info">
          <span class="history-title">{{ item.title }}</span>
          <span class="history-time">{{ formatTime(item.createdAt) }}</span>
          <span class="history-type">{{ item.genType }}</span>
        </div>
        <div class="history-actions">
          <button class="btn-small" @click="previewHistoryItem(item)">👁️ 预览</button>
          <button class="btn-small hide-on-mobile" @click="sendToTypeset(item)">📄 排版</button>
          <button class="btn-small" @click="loadFromHistory(item)">📋 加载指令</button>
          <button class="btn-small" @click="downloadFromHistory(item)">📥 下载</button>
          <button class="btn-small btn-delete" @click="deleteHistoryItem(item.id)">🗑️</button>
        </div>
      </div>
      <div v-if="filteredHistoryList.length === 0" class="empty-tip">
        暂无历史记录
      </div>
    </div>
  
    <!-- 预览弹窗 -->
    <div v-if="showPreview" class="modal-mask" @click.self="showPreview = false">
      <div class="modal large-modal">
        <h3>👁️ 内容预览</h3>
        <div class="preview-content" v-html="previewContent"></div>
        <div class="modal-actions">
          <button class="btn" @click="showPreview = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue';
import { useRouter } from 'vue-router';
import storage from '@/utils/storage';
import { pushDocHistory } from '@/utils/cloudStorage';
import { formatTime } from '@/utils/helpers';
import { useDialog } from '@/composables/useDialog.js';
import { useMobile } from '@/composables/useMobile.js';
import { APP_EVENTS } from '@/constants/events.js';

const router = useRouter();
const { showConfirmDialogFn } = useDialog();
const { isMobile } = useMobile();

const historyList = ref([]);
const historySearchKeyword = ref('');
const historyFilterType = ref('');
const filteredHistoryList = ref([]);

const loadHistory = async () => {
  const saved = await storage.getItem('docHistory');
  if (saved) {
    // 向后兼容：为旧数据补填 savedAt
    let needsSave = false;
    for (const item of saved) {
      if (!item.savedAt) {
        item.savedAt = item.createdAt || item.timestamp || Date.now();
        needsSave = true;
      }
    }
    if (needsSave) {
      await storage.setItem('docHistory', saved).catch(() => {});
      console.log('🩹 已为历史记录补填 savedAt');
    }
    // 按时间升序排列（旧→新），保留最新 50 条，超限时最早被覆盖
    const sorted = [...saved].sort((a, b) => (a?.savedAt || a?.timestamp || a?.createdAt || 0) - (b?.savedAt || b?.timestamp || b?.createdAt || 0));
    historyList.value = sorted.length > 50 ? sorted.slice(-50) : sorted;
    // 显示时反转：最新的在上面（存储保持升序以保证 slice(-50) 截断正确）
    filteredHistoryList.value = historyList.value.filter(h => !h._deleted).reverse();
  }
};

const clearAllHistory = async () => {
  const confirmed = await showConfirmDialogFn('确定清空所有历史记录吗？');
  if (confirmed) {
    // 打 _deleted 标记（同步后自动清理）
    for (const h of historyList.value) {
      h._deleted = true;
    }
    filteredHistoryList.value = [];
    await storage.setItem('docHistory', historyList.value);
    pushDocHistory(historyList.value).then(ok => { if (!ok) console.warn('☁️ 清空历史推送失败'); }).catch(e => console.warn('☁️ 清空历史推送异常', e));
  }
};

const deleteHistoryItem = async (id) => {
  const item = historyList.value.find(h => h.id === id);
  if (item) {
    item._deleted = true;
    filteredHistoryList.value = filteredHistoryList.value.filter(h => h.id !== id);
    await storage.setItem('docHistory', historyList.value);
    pushDocHistory(historyList.value).then(ok => { if (!ok) console.warn('☁️ 删除历史推送失败'); }).catch(e => console.warn('☁️ 删除历史推送异常', e));
  }
};

const loadFromHistory = (item) => {
  router.push('/generate');
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.LOAD_INSTRUCTION, { detail: item.rawContent || item.content }));
  }, 100);
};

const downloadFromHistory = (item) => {
  const blob = new Blob([item.content], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${item.title}.docx`;
  a.click();
};

const filterHistory = () => {
  let result = historyList.value;

  if (historyFilterType.value) {
    result = result.filter(item => item.genType === historyFilterType.value);
  }

  const keyword = historySearchKeyword.value.toLowerCase().trim();
  if (keyword) {
    result = result.filter(item => {
      if (item.title.toLowerCase().includes(keyword)) return true;
      if (item.content && item.content.toLowerCase().includes(keyword)) return true;
      return false;
    });
  }

  filteredHistoryList.value = result;
};

// 👁️ 预览弹窗
const showPreview = ref(false);
const previewContent = ref('');

const previewHistoryItem = (item) => {
  previewContent.value = item.content || '';
  showPreview.value = true;
};

// 📄 发送到排版模块
const sendToTypeset = (item) => {
  window.__pendingTypesetContent = {
    content: item.content,
    meta: { title: item.title || '历史文档', genType: item.genType || '' }
  };
  router.push('/typeset');
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.TYPESET_CONTENT, {
      detail: window.__pendingTypesetContent
    }));
  }, 150);
};

// ☁️ 云端数据同步完成后重新加载 + 清理 _deleted 项
let _histSyncRunning = false; // 🔧 KeepAlive 多实例保护
const onCloudSync = () => {
  if (_histSyncRunning) return;
  _histSyncRunning = true;
  try {
    loadHistory();
    console.log('☁️ [HistoryModule] 同步完成，已重新加载历史记录');
  } finally {
    setTimeout(() => { _histSyncRunning = false; }, 500);
  }
};

// 🔧 KeepAlive 感知的监听器管理
const _hSetupListeners = () => {
  window.addEventListener('data-sync-complete', onCloudSync);
};
const _hTeardownListeners = () => {
  window.removeEventListener('data-sync-complete', onCloudSync);
};

onMounted(() => {
  loadHistory();
  _hSetupListeners();
});

onActivated(() => { _hSetupListeners(); });
onDeactivated(() => { _hTeardownListeners(); });

onUnmounted(() => {
  _hTeardownListeners();
});
</script>

<style scoped>
.embedded-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.page-header h2 {
  font-size: 20px;
  color: var(--primary);
  font-weight: 600;
}

.history-search {
  display: flex;
  gap: 12px;
  align-items: center;
}

.history-search .search-input {
  width: 260px;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid #ddd;
  font-size: 13px;
}

.history-list-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item-page {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
}

.history-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.history-title {
  font-weight: 500;
  color: var(--primary);
}

.history-time {
  font-size: 13px;
  color: var(--text-muted);
}

.history-type {
  font-size: 12px;
  padding: 2px 10px;
  background: var(--primary-lighter);
  border-radius: 20px;
  color: var(--primary-light);
}

.history-actions {
  display: flex;
  gap: 8px;
}

.empty-tip {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
  font-size: 14px;
}

/* 📱 移动端适配 */
@media (max-width: 767px) {
  .embedded-page {
    padding: 0 !important;
    overflow: hidden;
  }

  /* 固定头部 */
  .page-header {
    flex-shrink: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    margin-bottom: 0;
    padding: 5px 8px 6px 8px;
    background: white;
    border-bottom: 1px solid var(--border-light);
  }
  .page-header h2 { font-size: 13px; margin: 0; }
  .history-search {
    flex-wrap: wrap;
    gap: 4px;
  }
  .history-search .search-input {
    width: 100%;
    font-size: 12px !important;
    padding: 5px 8px;
  }
  .history-search .filter-select {
    flex: 1;
    min-width: 0;
    font-size: 11px !important;
    padding: 5px 3px;
    min-height: auto;
  }
  .history-search .btn {
    flex-shrink: 0;
    font-size: 10px;
    padding: 5px 6px;
    min-height: auto;
  }

  /* 列表：独立滚动 */
  .history-list-page {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 5px 8px;
    gap: 5px;
    min-height: 0;
  }

  .history-item-page {
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
    padding: 8px;
    border-radius: 8px;
    margin-bottom: 0;
  }
  .history-info {
    flex-wrap: wrap;
    gap: 4px;
  }
  .history-title {
    font-size: 12px;
    width: 100%;
  }
  .history-time {
    font-size: 10px;
  }
  .history-type {
    font-size: 9px;
    padding: 2px 6px;
  }
  .history-actions {
    flex-wrap: wrap;
    gap: 3px;
  }
  .history-actions .btn-small {
    font-size: 10px;
    padding: 4px 6px;
    min-height: 26px;
  }

  .hide-on-mobile { display: none !important; }

  .empty-tip {
    padding: 28px;
    font-size: 12px;
  }
}

/* ===== 预览弹窗 ===== */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.3);
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
  max-width: 85vw;
}

.modal h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--primary);
  font-weight: 600;
}

.preview-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-card);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.7;
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

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

/* 📱 移动端预览弹窗（放在桌面规则后面确保覆盖） */
@media (max-width: 767px) {
  .modal-mask {
    padding: env(safe-area-inset-top, 12px) 12px env(safe-area-inset-bottom, 12px) 12px;
    box-sizing: border-box;
  }
  .large-modal {
    min-width: auto !important;
    width: 94vw !important;
    max-width: 94vw !important;
    padding: 16px 12px !important;
    border-radius: 12px !important;
    max-height: calc(100% - 16px) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow-y: auto !important;
    margin: auto !important;
  }
  .large-modal h3 {
    font-size: 15px !important;
    margin-bottom: 10px !important;
    padding-bottom: 10px !important;
    flex-shrink: 0 !important;
  }
  .preview-content {
    flex: 1 !important;
    min-height: 0 !important;
    max-height: none !important;
    font-size: 13px !important;
    overflow-y: auto !important;
  }
  .modal-actions {
    flex-shrink: 0 !important;
  }
}
</style>
