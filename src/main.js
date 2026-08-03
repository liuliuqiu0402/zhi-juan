import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import router from '@/router';
import '@/styles/global.css';
import '@/composables/useLogger.js'; // 📋 全局日志劫持——必须在最早加载

// 🔍 诊断：模块成功加载，直接挂载（不等待 router.isReady，避免 Android WebView 阻塞）
try {
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');
} catch (e) {
  // 最终防线：挂载失败时直接写 DOM
  const el = document.getElementById('app');
  if (el) el.textContent = '❌ mount 失败: ' + (e.message || String(e));
  throw e;
}