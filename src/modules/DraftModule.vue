<template>
  <div class="draft-module">
    <div class="draft-panel">
      <div class="panel-header">
        <h3>📦 草稿箱 ({{ drafts.length }})</h3>
        <div class="header-actions">
          <button class="btn" @click="processAllPending" :disabled="pendingCount === 0">
            🚀 全部处理 ({{ pendingCount }})
          </button>
          <button class="btn" @click="batchDelete" :disabled="selectedDrafts.length === 0">🗑️ 批量删除</button>
          <button class="btn-primary" @click="openUploadModal">📤 添加文件</button>
        </div>
      </div>

      <!-- 状态筛选 -->
      <div class="filter-row">
        <select v-model="filterStatus">
          <option value="">全部状态</option>
          <option value="pending">⏳ 等待处理</option>
          <option value="completed">✅ 已完成</option>
          <option value="failed">❌ 失败</option>
        </select>
        <select v-model="uploadType">
          <option value="textbook">📚 教材</option>
          <option value="template">📋 模板</option>
        </select>
      </div>

      <!-- 草稿列表 -->
      <div class="draft-list">
        <div v-if="filteredDrafts.length === 0" class="empty-tip">
          <p>📭 草稿箱为空</p>
          <p class="hint">点击「添加文件」批量上传教材或模板</p>
        </div>
        <div v-for="draft in filteredDrafts" :key="draft.id" class="draft-item" :class="'status-' + draft.status">
          <div class="draft-info">
            <input type="checkbox" v-model="draft.selected" />
            <span class="draft-icon">{{ getStatusIcon(draft.status) }}</span>
            <span class="draft-name">{{ draft.name }}</span>
            <span class="draft-type">{{ draft.type === 'textbook' ? '📚 教材' : '📋 模板' }}</span>
            <span class="draft-status">{{ getStatusText(draft.status) }}</span>
          </div>
          <div v-if="draft.error" class="draft-error">{{ draft.error }}</div>
          <div class="draft-actions">
            <button v-if="draft.status === 'pending'" class="btn-small" @click="processDraft(draft)">▶️ 处理</button>
            <button v-if="draft.status === 'failed'" class="btn-small" @click="retryDraft(draft)">🔄 重试</button>
            <button class="btn-small btn-delete" @click="deleteDraft(draft)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传弹窗 -->
    <div v-if="showUploadModal" class="modal-mask" @click.self="closeUploadModal">
      <div class="modal">
        <h3>📤 添加到草稿箱</h3>
        <button class="btn btn-full" @click="selectFiles">📁 选择文件（支持多选）</button>
        <p class="hint">支持 PDF / Word / 图片</p>
        
        <div v-if="selectedFiles.length > 0" class="file-list">
          <div class="file-list-header">
            <span>已选择 {{ selectedFiles.length }} 个文件</span>
            <button class="icon-btn" @click="clearFiles">清空</button>
          </div>
          <div v-for="(f, i) in selectedFiles" :key="i" class="file-item">
            <span>{{ f.split('\\').pop() }}</span>
            <button class="icon-btn" @click="removeFile(i)">🗑️</button>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn" @click="closeUploadModal">取消</button>
          <button class="btn-primary" :disabled="selectedFiles.length === 0" @click="confirmUpload">添加到草稿箱</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useDialog } from '../composables/useDialog.js';

// 草稿箱数据
const drafts = ref([]);
const filterStatus = ref('');
const showUploadModal = ref(false);
const selectedFiles = ref([]);
const uploadType = ref('textbook');
const { showConfirmDialogFn, showAlertDialogFn } = useDialog();

const selectedDrafts = computed(() => drafts.value.filter(d => d.selected));
const pendingCount = computed(() => drafts.value.filter(d => d.status === 'pending').length);
const filteredDrafts = computed(() => {
  if (!filterStatus.value) return drafts.value;
  return drafts.value.filter(d => d.status === filterStatus.value);
});

const getStatusIcon = (status) => {
  const icons = { pending: '⏳', completed: '✅', failed: '❌' };
  return icons[status] || '📄';
};
const getStatusText = (status) => {
  const texts = { pending: '等待处理', completed: '已完成', failed: '失败' };
  return texts[status] || status;
};

// 上传弹窗
const openUploadModal = () => { showUploadModal.value = true; selectedFiles.value = []; };
const closeUploadModal = () => { showUploadModal.value = false; };
const selectFiles = async () => {
  const files = await window.electronAPI?.selectFiles();
  if (files?.length) selectedFiles.value = [...selectedFiles.value, ...files];
};
const removeFile = (i) => { selectedFiles.value.splice(i, 1); };
const clearFiles = () => { selectedFiles.value = []; };

const confirmUpload = () => {
  for (const f of selectedFiles.value) {
    const name = f.split('\\').pop().replace(/\.[^/.]+$/, '');
    drafts.value.push({
      id: 'draft_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      name,
      path: f,
      type: uploadType.value,
      status: 'pending',
      selected: false,
      error: '',
      createdAt: Date.now()
    });
  }
  saveDrafts();
  showUploadModal.value = false;
  selectedFiles.value = [];
};

// 处理单个草稿
const processDraft = (draft) => {
  localStorage.setItem('pendingDraft', JSON.stringify(draft));
  
  // 触发事件，让父组件切换到对应页面
  if (draft.type === 'textbook') {
    window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'textbook' } }));
  } else {
    window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'template' } }));
  }
  
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('process-draft', { detail: draft }));
  }, 500);
};

// 全部处理
const processAllPending = () => {
  const pending = drafts.value.filter(d => d.status === 'pending');
  if (pending.length === 0) return;
  processDraft(pending[0]);
};

// 重试
const retryDraft = (draft) => {
  draft.status = 'pending';
  draft.error = '';
  saveDrafts();
};

// 删除单个
const deleteDraft = (draft) => {
  drafts.value = drafts.value.filter(d => d.id !== draft.id);
  saveDrafts();
};

// 批量删除
const batchDelete = async () => {
  const count = selectedDrafts.value.length;
  if (count === 0) { await showAlertDialogFn('请先勾选要删除的草稿'); return; }
  const confirmed = await showConfirmDialogFn(`确定删除选中的 ${count} 个草稿吗？\n不会删除本地原文件。`);
  if (!confirmed) return;
  drafts.value = drafts.value.filter(d => !d.selected);
  saveDrafts();
};

// 保存成功后调用：删除当前草稿，提示是否继续
const markDraftCompleted = (draftId) => {
  const draft = drafts.value.find(d => d.id === draftId);
  if (!draft) return;
  
  // 删除当前草稿
  const draftName = draft.name;
  drafts.value = drafts.value.filter(d => d.id !== draftId);
  saveDrafts();
  
  // 查找下一个待处理的
  nextTick(async () => {
    const next = drafts.value.find(d => d.status === 'pending');
    if (next) {
      const goNext = await showConfirmDialogFn(
        `✅「${draftName}」已保存成功！\n\n` +
        `下一个待处理：${next.name}\n` +
        `剩余待处理：${pendingCount.value} 个\n\n` +
        `是否继续处理下一个？`
      );
      if (goNext) {
        processDraft(next);
      }
    } else {
      await showAlertDialogFn('🎉 所有草稿处理完毕！');
    }
  });
};

// 监听外部事件
onMounted(() => {
  loadDrafts();
  
  window.addEventListener('draft-completed', (e) => {
    markDraftCompleted(e.detail.id);
  });
  
  window.addEventListener('draft-failed', (e) => {
    const draft = drafts.value.find(d => d.id === e.detail.id);
    if (draft) {
      draft.status = 'failed';
      draft.error = e.detail.error || '处理失败';
      saveDrafts();
    }
  });
});

// 数据持久化
const saveDrafts = () => {
  localStorage.setItem('drafts', JSON.stringify(drafts.value));
};

const loadDrafts = () => {
  const saved = localStorage.getItem('drafts');
  if (saved) {
    try { drafts.value = JSON.parse(saved); } catch (e) {}
  }
};
</script>

<style scoped>
.draft-module { height: 100%; display: flex; }
.draft-panel { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.header-actions { display: flex; gap: 8px; }
.filter-row { display: flex; gap: 8px; }
.filter-row select { flex: 1; padding: 6px; border-radius: 8px; border: 1px solid #ccc; background: white; }
.draft-list { display: flex; flex-direction: column; gap: 8px; }
.draft-item { border: 1px solid var(--border-light); border-radius: 8px; padding: 12px; background: white; }
.draft-item.status-completed { border-left: 4px solid var(--success); }
.draft-item.status-failed { border-left: 4px solid var(--danger); }
.draft-info { display: flex; align-items: center; gap: 8px; }
.draft-icon { font-size: 1.2rem; }
.draft-name { flex: 1; font-weight: 500; }
.draft-type { font-size: 0.9rem; color: #666; }
.draft-status { font-size: 0.8rem; color: #666; }
.draft-actions { display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end; }
.draft-error { margin-top: 8px; padding: 8px; background: #fef0f0; border-radius: 4px; color: var(--danger); font-size: 0.8rem; }
.empty-tip { text-align: center; padding: 32px; color: var(--text-muted); }
.hint { font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }
.modal-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent; display: flex; align-items: center; justify-content: center; z-index: 3500; pointer-events: none; }
.modal { background: white; border-radius: 16px; padding: 24px; min-width: 400px; max-width: 90%; max-height: 80vh; overflow-y: auto; pointer-events: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.12), 0 16px 48px rgba(0,0,0,0.16); border: 2px solid var(--border); position: relative; }
.modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, var(--primary-light) 0%, #4a90d9 50%, var(--primary-light) 100%); border-radius: 14px 14px 0 0; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
.file-list { max-height: 200px; overflow-y: auto; margin: 12px 0; border: 1px solid var(--border-light); border-radius: 8px; padding: 8px; }
.file-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.9rem; color: #666; }
.file-item { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
.btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #ccc; background: white; cursor: pointer; }
.btn:hover { background: #f5f5f5; }
.btn-primary { padding: 8px 16px; border-radius: 8px; border: none; background: var(--primary-light); color: white; cursor: pointer; }
.btn-primary:hover { background: #1e4a8a; }
.btn-full { width: 100%; margin: 12px 0; }
.btn-small { padding: 4px 10px; border-radius: 6px; border: 1px solid #ccc; background: white; font-size: 0.8rem; cursor: pointer; }
.btn-small:hover { background: #f5f5f5; }
.btn-delete { color: var(--danger); border-color: var(--danger-light); }
.btn-delete:hover { background: var(--danger-light); }
.btn:disabled, .btn-primary:disabled, .btn-small:disabled { opacity: 0.5; cursor: not-allowed; }
.icon-btn { background: none; border: none; cursor: pointer; padding: 4px; font-size: 1rem; }
.icon-btn:hover { background: #f0f0f0; border-radius: 4px; }

/* 📱 移动端弹窗适配 */
@media (max-width: 767px) {
  /* 弹窗安全区适配 */
  .modal-mask {
    padding: env(safe-area-inset-top, 12px) 12px env(safe-area-inset-bottom, 12px) 12px;
    box-sizing: border-box;
  }
  .modal {
    min-width: 0 !important;
    width: 90vw !important;
    max-width: 90vw !important;
    padding: 16px 14px !important;
    border-radius: 12px !important;
    max-height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px) !important;
  }
  .modal::before {
    border-radius: 10px 10px 0 0 !important;
  }
  .modal h3 {
    font-size: 15px !important;
    margin-bottom: 10px !important;
  }
  .modal p {
    font-size: 13px !important;
  }
  .modal-actions {
    margin-top: 12px !important;
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
  /* 上传弹窗文件列表 */
  .file-list {
    max-height: 30vh !important;
  }
  .file-list-header span {
    font-size: 12px;
  }
  .file-item {
    font-size: 11px;
  }
  .btn-full {
    font-size: 13px;
    padding: 10px;
  }
  .hint {
    font-size: 11px !important;
  }

  /* 整体模块 */
  .draft-module {
    flex-direction: column !important;
  }
  .draft-panel {
    padding: 8px !important;
    gap: 8px !important;
  }
  .panel-header { flex-direction: column; align-items: flex-start; }
  .panel-header h3 { font-size: 14px; }
  .header-actions {
    flex-wrap: wrap;
    gap: 4px;
  }
  .header-actions .btn,
  .header-actions .btn-primary {
    font-size: 11px;
    padding: 5px 8px;
  }
  .filter-row select {
    font-size: 12px;
    padding: 5px;
  }
  .draft-item {
    padding: 8px !important;
  }
  .draft-info {
    font-size: 12px;
  }
  .draft-actions .btn-small {
    font-size: 10px;
    padding: 3px 6px;
  }
}
</style>