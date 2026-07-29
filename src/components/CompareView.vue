<template>
  <div class="compare-container">
    <div class="compare-panel left-panel">
      <div class="panel-header">📖 教材原文</div>
      <div class="panel-body" ref="leftBodyRef" @scroll="onLeftScroll">
        <div v-if="!sourceText" class="empty-hint">暂无原文数据</div>
        <div v-else class="source-content" v-html="renderedSource"></div>
      </div>
    </div>
    <div class="compare-divider">
      <div class="divider-line"></div>
    </div>
    <div class="compare-panel right-panel">
      <div class="panel-header">🤖 生成结果</div>
      <div class="panel-body" ref="rightBodyRef" @scroll="onRightScroll">
        <div v-if="!generatedHtml" class="empty-hint">暂无生成内容</div>
        <div v-else class="generated-content" v-html="renderedGenerated"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  sourceText: { type: String, default: '' },
  generatedHtml: { type: String, default: '' }
});

const leftBodyRef = ref(null);
const rightBodyRef = ref(null);
let syncing = false;

const renderedSource = computed(() => {
  if (!props.sourceText) return '';
  return props.sourceText
    .replace(/\n/g, '<br>')
    .replace(/【(.+?)】/g, '<strong style="color:var(--primary-light)">$1</strong>');
});

const renderedGenerated = computed(() => {
  return props.generatedHtml || '';
});

const onLeftScroll = () => {
  if (syncing || !rightBodyRef.value) return;
  syncing = true;
  rightBodyRef.value.scrollTop = leftBodyRef.value?.scrollTop || 0;
  setTimeout(() => { syncing = false; }, 10);
};

const onRightScroll = () => {
  if (syncing || !leftBodyRef.value) return;
  syncing = true;
  leftBodyRef.value.scrollTop = rightBodyRef.value?.scrollTop || 0;
  setTimeout(() => { syncing = false; }, 10);
};
</script>

<style scoped>
.compare-container {
  display: flex;
  height: 100%;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: white;
}

.compare-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-header {
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  background: var(--bg);
  border-bottom: 1px solid var(--border-light);
  color: var(--primary);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary);
}

.compare-divider {
  width: 6px;
  background: var(--primary-light);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.divider-line {
  width: 2px;
  height: 40px;
  background: white;
  border-radius: 1px;
}

.empty-hint {
  color: var(--text-muted);
  text-align: center;
  padding: 40px 0;
}

.source-content :deep(strong) {
  color: var(--primary-light);
}

.generated-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
}

.generated-content :deep(td),
.generated-content :deep(th) {
  border: 1px solid var(--border-light);
  padding: 6px 10px;
}
</style>
