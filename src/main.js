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
router.isReady().then(() => {
  app.mount('#app');
});