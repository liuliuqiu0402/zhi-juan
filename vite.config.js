import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';

// 部署路径：Capacitor 默认 './'，Vercel 设 BASE_URL=/，GitHub Pages 设 BASE_URL=/zhi-juan/
const BASE = process.env.BASE_URL || './';
const IS_CAPACITOR = BASE === './';

export default defineConfig({
  plugins: [
    vue(),
    // PWA：Capacitor 构建时跳过（WebView 不需要 PWA，SW 会干扰本地加载）
    ...(IS_CAPACITOR ? [] : [VitePWA({
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
    })]),
    // 🔧 Capacitor 构建后处理：移除 crossorigin（Vite 在插件之后添加）并清理 PWA 残留
    {
      name: 'capacitor-postprocess',
      apply: 'build',
      closeBundle() {
        if (!IS_CAPACITOR) return;
        const htmlPath = fileURLToPath(new URL('./dist/index.html', import.meta.url));
        if (!fs.existsSync(htmlPath)) return;
        let html = fs.readFileSync(htmlPath, 'utf-8');
        // 移除 Vite 在最终阶段添加的 crossorigin 属性
        html = html.replace(/\s*crossorigin(?:="[^"]*")?/g, '');
        // 清理 PWA 残留（如果 PWA 插件被跳过但仍生成了文件）
        html = html.replace(/<link[^>]*manifest[^>]*>/g, '');
        html = html.replace(/<script[^>]*registerSW[^>]*><\/script>/g, '');
        fs.writeFileSync(htmlPath, html, 'utf-8');
        console.log('🔧 [capacitor-postprocess] 已移除 crossorigin + PWA 残留');
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