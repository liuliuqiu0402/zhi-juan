import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import router from '@/router';
import '@/styles/global.css';
import '@/composables/useLogger.js'; // 📋 全局日志劫持——必须在最早加载

const app = createApp(App);
app.use(createPinia());
app.use(router);
// 🔥 等待 router 完成初始导航（含 redirect）后再挂载
//    + 10s 超时兜底：Android WebView 下路由可能卡死，超时后强制挂载
const readyPromise = router.isReady();
const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 10000));
Promise.race([readyPromise, timeoutPromise]).then(() => {
  app.mount('#app');
});
readyPromise.catch((err) => {
  console.error('router.isReady 失败:', err);
  app.mount('#app');
});