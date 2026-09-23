import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import router from '@/router';
import '@/styles/global.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'katex/dist/katex.min.css'; // 🔴 公式渲染基础样式+字体（应用内预览/编辑器用构建产物；导出走内联版）
import { CARRIER_CSS } from '@/styles/carrierCss.js'; // 作答载体 CSS 单一事实源（填空横线/括号空位/整行横线/行尾延伸）
import { MATH_CSS } from '@/styles/mathCss.js'; // 公式补充样式单一事实源（块级公式独占一行等）
import '@/composables/useLogger.js'; // 📋 全局日志劫持——必须在最早加载

console.log('[main] 模块开始执行...');

// 🔧 作答载体 CSS 全局注入（原 global.css 静态副本已移除，规则统一收敛 carrierCss.js；
//    themeConfig 独立导出文档复用同一常量，改规则只改一处）
(function injectCarrierCss() {
  try {
    const el = document.createElement('style');
    el.setAttribute('data-carrier-css', 'true');
    el.textContent = CARRIER_CSS;
    document.head.appendChild(el);
  } catch (e) {
    console.warn('[main] 注入作答载体 CSS 失败:', e?.message);
  }
})();

// 🔧 公式补充样式全局注入（与 carrierCss 同一模式：单一事实源在 styles/mathCss.js，
//    导出侧 mathRender.withKatexStyles 复用同一常量，改规则只改一处）
(function injectMathCss() {
  try {
    const el = document.createElement('style');
    el.setAttribute('data-math-css', 'true');
    el.textContent = MATH_CSS;
    document.head.appendChild(el);
  } catch (e) {
    console.warn('[main] 注入公式样式失败:', e?.message);
  }
})();

// 🔧 OPPO 软渲染检测：position:fixed 在软件渲染下失效
//    在 Vue 挂载前检测，通过 <html> 标记让 CSS 兜底生效
(function detectFixedBug() {
  try {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    const broken = rect.top !== 0 || rect.left !== 0;
    document.body.removeChild(el);
    if (broken) {
      document.documentElement.setAttribute('data-fixed-broken', '');
      console.warn('[main] 检测到 position:fixed 渲染异常，已启用 CSS 兜底');
    }
  } catch { /* 非浏览器环境，跳过 */ }
})();

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