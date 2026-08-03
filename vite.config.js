import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// 部署路径：Capacitor 默认 './'，Vercel 设 BASE_URL=/，GitHub Pages 设 BASE_URL=/zhi-juan/
const BASE = process.env.BASE_URL || './';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '智慧工坊',
        short_name: '智慧工坊',
        description: 'AI 驱动的教学资料生成工具',
        theme_color: '#4f46e5',
        background_color: '#f5f7fc',
        display: 'standalone',
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.deepseek\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', expiration: { maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
    // 🔧 移除构建产物中 script 和 link 的 crossorigin 属性
    //    Capacitor 本地 HTTP 服务器可能不返回 CORS 头，crossorigin 会导致模块脚本被拒
    //    base==='./' 为 Capacitor 构建（Vercel 构建时 BASE_URL='/'）
    {
      name: 'strip-crossorigin-for-capacitor',
      enforce: 'post',
      transformIndexHtml(html) {
        let result = html.replace(/\s*crossorigin(?:="[^"]*")?/g, '');
        // Capacitor 构建：移除 PWA service worker（WebView 不支持且会干扰加载）
        if (BASE === './') {
          result = result.replace(/<script[^>]*registerSW[^>]*><\/script>/g, '');
          result = result.replace(/<link[^>]*manifest[^>]*>/g, '');
        }
        return result;
      },
    },
  ],
  base: BASE,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
});