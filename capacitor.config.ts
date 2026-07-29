import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wisdom.zhijuan',
  appName: '智卷工坊',
  webDir: 'dist',
  // 禁用 Capacitor 内置服务器，使用本地文件直读模式
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  ios: {
    // 免费 Apple ID 签名模式，不设 scheme 避免要求付费证书
    allowsLinkPreview: false,
  },
};

export default config;
