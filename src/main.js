import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import router from '@/router';
import '@/styles/global.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@/composables/useLogger.js'; // 📋 全局日志劫持——必须在最早加载

console.log('[main] 模块开始执行...');

const app = createApp(App);
app.use(createPinia());
app.use(router);

// 🔥 修复安卓白屏核心问题：
//    不再等待 router.isReady()，直接挂载 Vue。
//    Capacitor Android WebView 中 router 懒加载组件的动态 import() 
//    可能因 WebView 的模块加载机制而永久不 resolve，导致 #app 永远为空。
//    立即挂载后，App.vue 的模板会先渲染兜底加载状态，
//    路由组件异步就绪后再渲染实际内容。
console.log('[main] 立即挂载 Vue（不等待 router.isReady）');
app.mount('#app');

// 异步就绪后记录日志（不影响已挂载视图）
router.isReady().then(() => {
  console.log('[main] router 已就绪（异步）');
}).catch(err => {
  console.warn('[main] router.isReady 异常（已挂载无影响）:', err?.message);
});