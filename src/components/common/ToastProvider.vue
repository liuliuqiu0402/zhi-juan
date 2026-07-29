<template>
  <Teleport to="body">
    <div v-if="show" class="toast-container" :class="'toast-' + type">
      <span>{{ message }}</span>
      <button class="toast-close" @click="show = false">✕</button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const message = ref('');
const type = ref('info');
const show = ref(false);
let toastTimer = null;

const showMessage = (msg, msgType = 'info', duration = 3000) => {
  message.value = msg;
  type.value = msgType;
  show.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    show.value = false;
  }, duration);
};

defineExpose({ showMessage });

const onToastEvent = (e) => {
  showMessage(e.detail.message, e.detail.type || 'info');
};

onMounted(() => {
  window.addEventListener('show-toast', onToastEvent);
});

onUnmounted(() => {
  window.removeEventListener('show-toast', onToastEvent);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
.toast-container {
  position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
  padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;
  z-index: 9999; display: flex; align-items: center; gap: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  animation: toastSlideUp 0.3s ease; max-width: 500px;
}
.toast-info { background: var(--info-light); color: var(--info); border: 1px solid #90caf9; }
.toast-success { background: var(--success-light); color: #2e7d32; border: 1px solid #a5d6a7; }
.toast-error { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
.toast-warning { background: var(--warning-light); color: #e65100; border: 1px solid #ffcc80; }
.toast-close { background: none; border: none; cursor: pointer; font-size: 16px; color: inherit; opacity: 0.7; padding: 0 4px; }
.toast-close:hover { opacity: 1; }
@keyframes toastSlideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
