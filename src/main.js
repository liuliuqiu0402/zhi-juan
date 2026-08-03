import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import router from '@/router';
import '@/styles/global.css';
import '@/composables/useLogger.js'; // 📋 全局日志劫持——必须在最早加载

// 🔧 全局错误捕获：Android WebView 无 DevTools，错误需直接渲染到屏幕
if (typeof window !== 'undefined') {
  const showFatalError = (msg) => {
    const el = document.getElementById('app');
    if (el) {
      el.innerHTML = '<div style="padding:40px 20px;font-family:sans-serif;color:#e53935;text-align:center;"><h2>⚠️ 启动异常</h2><pre style="text-align:left;background:#fff3f3;padding:16px;border-radius:8px;overflow:auto;max-height:80vh;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-all;">' + msg.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre><p style="margin-top:16px;color:#999;font-size:13px;">请截图发给开发者</p></div>';
    }
  };
  window.addEventListener('error', (e) => {
    if (e.filename && e.filename.includes('/assets/')) {
      showFatalError(e.message + '\n\n文件: ' + e.filename + ':' + e.lineno);
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    showFatalError('Promise 异常: ' + (e.reason?.message || e.reason || 'Unknown'));
  });
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
// 🔥 等待 router 完成初始导航（含 redirect）后再挂载，
//    避免首帧渲染时 router-view 为空导致闪烁 + 组件状态丢失
router.isReady().then(() => {
  app.mount('#app');
});