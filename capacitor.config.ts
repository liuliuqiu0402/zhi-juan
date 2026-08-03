import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wisdom.zhijuan',
  appName: '智卷工坊',
  webDir: 'dist',
  // Capacitor 本地 HTTP 服务器（Android 使用 http 避免自签名 SSL 证书导致 WebView 白屏）
  server: {
    androidScheme: 'http',
    iosScheme: 'capacitor',
  },
  ios: {
    // 免费 Apple ID 签名模式，不设 scheme 避免要求付费证书
    allowsLinkPreview: false,
  },
};

export default config;
