import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: to => {
      // 📱 移动端默认进生成页面，桌面端进教材库
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile) {
        // 🔥 热启动：恢复到离开前的页面（redirect 同步执行，无闪烁）
        try {
          const warmRoute = localStorage.getItem('__app_route');
          if (warmRoute && warmRoute !== '/') {
            localStorage.removeItem('__app_route');
            return warmRoute;
          }
        } catch {}
        return '/generate';
      }
      return '/textbook';
    }
  },
  {
    path: '/textbook',
    name: 'textbook',
    component: () => import('@/modules/TextbookModule.vue')
  },
  {
    path: '/template',
    name: 'template',
    component: () => import('@/modules/TemplateModule.vue')
  },
  {
    path: '/tools',
    name: 'tools',
    component: () => import('@/modules/tools/ToolLibraryModule.vue')
  },
  {
    path: '/tools/:sub',
    name: 'tools-sub',
    component: () => import('@/modules/tools/ToolLibraryModule.vue')
  },
  {
    path: '/instruction',
    redirect: '/tools/instruction'
  },
  {
    path: '/blueprint',
    redirect: '/tools/blueprint'
  },
  {
    path: '/rules',
    redirect: '/tools/rules'
  },
  {
    path: '/draft',
    name: 'draft',
    component: () => import('@/modules/DraftModule.vue')
  },
  {
    path: '/generate',
    name: 'generate',
    component: () => import('@/modules/GenerateModule.vue')
  },
  {
    path: '/typeset',
    name: 'typeset',
    component: () => import('@/modules/TypesetModule.vue')
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/modules/HistoryModule.vue')
  },
  {
    path: '/graph',
    name: 'graph',
    component: () => import('@/modules/GraphModule.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/modules/SettingsModule.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
