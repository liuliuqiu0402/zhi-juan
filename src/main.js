import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import router from '@/router';
import '@/styles/global.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@/composables/useLogger.js'; // 📋 全局日志劫持——必须在最早加载

const app = createApp(App);
app.use(createPinia());
app.use(router);
// 🔥 等待 router 完成初始导航（含 redirect）后再挂载，
//    避免首帧渲染时 router-view 为空导致闪烁 + 组件状态丢失
//    添加超时兜底：5s 内未就绪则强制挂载（防止 Capacitor 等环境下 router 卡死）
let _mounted = false;
const _doMount = () => { if (_mounted) return; _mounted = true; app.mount('#app'); };
router.isReady().then(() => {
  console.log('[main] router.isReady() resolved, mounting...');
  _doMount();
}).catch(err => {
  console.error('[main] router.isReady() rejected:', err);
  window.__showError && window.__showError('router.isReady 异常: ' + (err?.message || String(err)));
  _doMount();
});
// 🔧 超时兜底：5 秒后仍未挂载则强制挂载
setTimeout(() => {
  if (!_mounted) {
    console.warn('[main] router.isReady() 超时 5s，强制挂载');
    _doMount();
  }
}, 5000);