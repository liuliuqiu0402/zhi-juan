/**
 * Capacitor 构建验证脚本
 * 检查 android assets 中的关键配置是否正确，防止白屏问题
 * 在 cap sync 之后运行
 */
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'assets');
let errors = [];

// 1. 检查 capacitor.config.json 中的 androidScheme
try {
  const configPath = path.join(ASSETS_DIR, 'capacitor.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const scheme = config?.server?.androidScheme;
  if (scheme !== 'http') {
    errors.push(`❌ capacitor.config.json: androidScheme 应为 "http"，当前为 "${scheme}" → 会导致 Android 7+ WebView 白屏！`);
  } else {
    console.log('✅ capacitor.config.json: androidScheme = "http"');
  }
} catch (e) {
  errors.push(`❌ 无法读取 capacitor.config.json: ${e.message}`);
}

// 2. 检查 index.html 是否包含外部 CDN 链接
try {
  const htmlPath = path.join(ASSETS_DIR, 'public', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  
  // 检查 CDN
  if (/https?:\/\/cdn\./.test(html)) {
    errors.push('⚠️  index.html 包含 CDN 链接，可能导致网络阻塞白屏');
  } else {
    console.log('✅ index.html: 无 CDN 链接');
  }
  
  // 检查 crossorigin（Capacitor 本地 HTTP 服务器不需要）
  if (/\scrossorigin/.test(html)) {
    errors.push('⚠️  index.html 包含 crossorigin 属性（可能影响 Capacitor 加载）');
  } else {
    console.log('✅ index.html: 无 crossorigin 属性');
  }
  
  // 检查 PWA service worker（WebView 不需要）
  if (/registerSW/.test(html)) {
    console.log('⚠️  index.html 包含 PWA service worker 注册（WebView 中无害但多余）');
  } else {
    console.log('✅ index.html: 无 PWA service worker');
  }
} catch (e) {
  errors.push(`❌ 无法读取 index.html: ${e.message}`);
}

// 3. 检查 AndroidManifest.xml 的 usesCleartextTraffic
try {
  const manifestPath = path.join(ASSETS_DIR, '..', 'AndroidManifest.xml');
  const manifest = fs.readFileSync(manifestPath, 'utf-8');
  if (!manifest.includes('usesCleartextTraffic="true"')) {
    errors.push('⚠️  AndroidManifest.xml: 缺少 usesCleartextTraffic="true"（Android 9+ 会阻止 HTTP）');
  } else {
    console.log('✅ AndroidManifest.xml: usesCleartextTraffic="true"');
  }
} catch (e) {
  // AndroidManifest.xml 可能在构建时被修改，路径可能不同
  console.log('ℹ️  跳过 AndroidManifest.xml 检查（文件路径可能变化）');
}

// 结果
console.log('');
if (errors.length > 0) {
  console.error('='.repeat(60));
  console.error('🚨 构建验证失败！以下问题可能导致 Android 白屏：');
  console.error('='.repeat(60));
  errors.forEach(err => console.error(err));
  console.error('='.repeat(60));
  process.exit(1);
} else {
  console.log('🎉 构建验证通过 — Android APK 配置正确');
}
