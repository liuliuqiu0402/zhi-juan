/**
 * 📱 移动端检测 + 响应式适配 + PWA 主屏幕自适应缩放
 * 检测当前设备是否为手机/平板，提供响应式断点判断
 * 
 * 🖥️ PWA 主屏幕整体缩放策略：
 * 手机 Safari 浏览器有工具栏占空间、PWA 主屏幕是全屏。
 * 在 PWA standalone 模式下，对根容器做整体 transform:scale()
 * 等比放大以填满屏幕，使 PWA 与 Safari 的视觉比例一致。
 * 桌面端、移动端 Safari 均不受影响。
 */
import { ref, computed } from 'vue';

const _width = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
const _height = ref(typeof window !== 'undefined' ? window.innerHeight : 768);
const _isTouch = ref(typeof navigator !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

const onResize = () => {
  _width.value = window.innerWidth;
  _height.value = window.innerHeight;
};

let _listening = false;

// ── PWA / Capacitor 原生 App 主屏幕检测 ──
function detectPwa() {
  if (typeof navigator === 'undefined') return false;
  // 🔌 Capacitor Android 使用 http:// 协议，不是 PWA standalone 模式
  //    必须排除，否则 pwaScaleStyle 会错误地对原生 App 应用 transform:scale()
  if (typeof window !== 'undefined' && window.location?.protocol === 'http:' && /Android/.test(navigator.userAgent || '')) return false;
  // iOS: 添加到主屏幕后 navigator.standalone === true
  if (navigator.standalone) return true;
  // Android / 通用: display-mode: standalone
  if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) return true;
  // Capacitor iOS（capacitor:// 协议）
  if (typeof window !== 'undefined' && window.location?.protocol === 'capacitor:') return true;
  return false;
}

const _isPwa = ref(typeof window !== 'undefined' ? detectPwa() : false);

// 非 PWA 模式（Safari）：保存视口高度占屏幕的比例，供全屏模式计算缩放补偿
if (typeof window !== 'undefined' && !_isPwa.value && window.location?.protocol !== 'capacitor:' && window.screen?.height) {
  try {
    const ratio = _height.value / window.screen.height;
    localStorage.setItem('pwa_safari_vp_ratio', ratio.toFixed(4));
  } catch { /* ignore */ }
}

export function useMobile() {
  // 确保只注册一次 resize 监听
  if (!_listening && typeof window !== 'undefined') {
    _listening = true;
    window.addEventListener('resize', onResize);
  }

  const isMobile = computed(() => _width.value < 768);
  const isTablet = computed(() => _width.value >= 768 && _width.value < 1024);
  const isDesktop = computed(() => _width.value >= 1024);
  const isTouchDevice = computed(() => _isTouch.value);

  /** 是否为小屏设备（手机 + 平板竖屏） */
  const isSmallScreen = computed(() => _width.value < 1024);

  /** 设备类型字符串 */
  const deviceType = computed(() => {
    if (_width.value < 768) return 'mobile';
    if (_width.value < 1024) return 'tablet';
    return 'desktop';
  });

  /** 当前是否运行在 PWA standalone 模式（主屏幕打开） */
  const isPwa = computed(() => _isPwa.value);

  /**
   * PWA 主屏幕整体缩放样式
   * 仅在 PWA standalone 模式下生效。
   * 
   * 原理：Safari 有地址栏/工具栏，实际可视区域约为屏幕高度的 78%~82%；
   * PWA 主屏幕全屏无工具栏，可视区域更大。用 transform:scale()
   * 等比放大整个应用，使 PWA 的视觉比例与 Safari 保持一致。
   * 
   * scale = 当前PWA视口比例 / Safari中保存的视口比例
   * 例如：Safari ratio=0.78，PWA ratio≈1.0 → scale≈1.28
   */
  const pwaScaleStyle = computed(() => {
    if (!isPwa.value) return {};

    // 从 localStorage 读取 Safari 中保存的视口比例
    let safariRatio = 0.8; // 默认：Safari 视口约占屏幕 80%
    try {
      const saved = localStorage.getItem('pwa_safari_vp_ratio');
      if (saved) {
        const parsed = parseFloat(saved);
        if (parsed > 0.5 && parsed < 1.0) safariRatio = parsed; // 合理性校验
      }
    } catch { /* ignore */ }

    // 当前 PWA 视口比例（全屏，ratio 接近 1.0）
    const screenH = window.screen?.height || _height.value;
    const currentRatio = screenH > 0 ? _height.value / screenH : 1;

    // 缩放系数
    let scale = currentRatio / safariRatio;
    scale = Math.max(0.85, Math.min(scale, 1.45)); // 限制极端值

    if (Math.abs(scale - 1) < 0.015) return {}; // 差距可忽略

    // position:fixed 容器在缩放时需同步放大宽高，
    // 避免因 fixed + left/right 约束导致内容被裁剪
    return {
      width: `${Math.ceil(_width.value / scale)}px`,
      height: `${Math.ceil(_height.value / scale)}px`,
      transform: `scale(${scale.toFixed(4)})`,
      transformOrigin: 'top left',
    };
  });

  return {
    width: _width,
    isMobile,
    isTablet,
    isDesktop,
    isSmallScreen,
    isTouchDevice,
    deviceType,
    // PWA 主屏幕缩放
    isPwa,
    pwaScaleStyle,
  };
}
