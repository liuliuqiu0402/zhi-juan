<template>
  <div class="embedded-page">
    <div class="page-header">
      <h2>⭐ 我的图形库</h2>
    </div>
    <div class="graph-list-page">
      <div
        v-for="g in graphLibrary"
        :key="g.id"
        class="graph-item-page"
      >
        <code class="graph-preview">{{ truncate(g.full, 80) }}</code>
        <span class="graph-time">{{ formatTime(g.savedAt) }}</span>
        <button
          class="btn-small"
          @click="copyGraph(g)"
        >
          📋
        </button>
        <button
          class="btn-small btn-delete"
          @click="deleteGraph(g.id)"
        >
          🗑️
        </button>
      </div>
      <div
        v-if="graphLibrary.length === 0"
        class="empty-tip"
      >
        暂无收藏的图形
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import storage from '@/utils/storage';
import { formatTime, truncate } from '@/utils/helpers';
import { useDialog } from '@/composables/useDialog.js';

const { showAlertDialogFn } = useDialog();

const graphLibrary = ref([]);

const loadGraphLibrary = async () => {
  const saved = await storage.getItem('graphLibrary');
  if (saved) graphLibrary.value = saved;
};

const deleteGraph = async (id) => {
  graphLibrary.value = graphLibrary.value.filter(g => g.id !== id);
  await storage.setItem('graphLibrary', graphLibrary.value);
};

const copyGraph = async (graph) => {
  navigator.clipboard?.writeText(graph.full);
  await showAlertDialogFn('已复制到剪贴板');
};

onMounted(() => {
  loadGraphLibrary();
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

.graph-list-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.graph-item-page {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
}

.graph-preview {
  flex: 1;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: #333;
  background: var(--primary-bg);
  padding: 6px 12px;
  border-radius: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.graph-time {
  font-size: 12px;
  color: var(--text-muted);
}

.empty-tip {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
