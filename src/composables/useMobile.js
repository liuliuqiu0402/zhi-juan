/**
 * 📱 移动端检测 + 响应式适配 + 统一自适应缩放
 * 检测当前设备是否为手机/平板，提供响应式断点判断
 * 
 * 🖥️ 统一缩放策略（根治版）：
 * 不同手机 CSS 像素宽度差异大（360px~430px），固定 px 值的 UI
 * 在不同设备上视觉比例不一致。通过对根容器做整体 transform:scale()
 * 基于设计基准宽度等比缩放，确保所有手机屏幕视觉体验一致。
 * 
 * 缩放公式：scale = clamp(viewportWidth / DESIGN_WIDTH, 0.85, 1.40)
 * 
 * 覆盖平台：
 *  - Capacitor 原生 Android APK
 *  - Capacitor 原生 iOS App
 *  - Safari 移动浏览器
 *  - PWA standalone（在主屏打开，额外叠加工具栏补偿）
 * 
 * 桌面端（>=768px）不受影响。
 */
import { ref, computed } from 'vue';

/** 设计基准宽度：值越小整体缩放越大（类似浏览器 Ctrl+滚轮 效果） */
const DESIGN_WIDTH = 340;
/** 桌面端设计基准宽度：UI 按 1920px 宽屏幕设计（主流桌面分辨率） */
const DESKTOP_DESIGN_WIDTH = 1920;

const _width = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
const _height = ref(typeof window !== 'undefined' ? window.innerHeight : 768);
const _isTouch = ref(typeof navigator !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

const onResize = () => {
  _width.value = window.innerWidth;
  _height.value = window.innerHeight;
};

let _listening = false;

// ── PWA 主屏幕检测 ──
//    仅用于判断是否运行在 PWA standalone 模式下（主屏幕打开）。
//    即使不是 PWA（Capacitor 原生 / Safari），mobileScaleStyle 仍会提供
//    基于设计宽度的统一缩放——detectPwa 只决定是否叠加工具栏补偿。
function detectPwa() {
  if (typeof navigator === 'undefined') return false;
  // 🔌 Capacitor 原生 App（Android http:// 或 iOS capacitor://）
  //    已原生全屏，不需要 PWA 工具栏补偿。detectPwa 返回 false
  //    表示不叠加 PWA 补偿，但 mobileScaleStyle 仍会提供设计宽度缩放。
  if (typeof window !== 'undefined') {
    const proto = window.location?.protocol;
    if (proto === 'capacitor:') return false;        // Capacitor iOS
    if (proto === 'http:' && /Android/.test(navigator.userAgent || '')) return false; // Capacitor Android
  }
  // iOS Safari PWA: 添加到主屏幕后 navigator.standalone === true
  if (navigator.standalone) return true;
  // Android / 通用 PWA: display-mode: standalone
  if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) return true;
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

  /**
   * 统一移动端自适应缩放样式
   * 
   * 对所有移动平台（Capacitor 原生 / Safari / PWA）提供一致的视觉体验：
   * 以 340px 为设计基准宽度，实际宽度偏离时等比缩放。
   * 
   * 分两段计算：
   *   1) 设计宽度缩放：baseScale = viewportWidth / DESIGN_WIDTH
   *   2) PWA 工具栏补偿（仅 PWA standalone）：额外 × (1 / safariRatio)
   * 
   * scale 最终 clamp 在 [0.88, 1.40] 防止极端设备异常。
   */
  const mobileScaleStyle = computed(() => {
    // 桌面端（>=768px）不缩放
    if (!isMobile.value) return {};

    // ── 第1段：设计宽度缩放 ──
    let scale = _width.value / DESIGN_WIDTH;

    // ── 第2段：PWA 工具栏补偿（仅 PWA standalone） ──
    if (isPwa.value) {
      let safariRatio = 0.8;
      try {
        const saved = localStorage.getItem('pwa_safari_vp_ratio');
        if (saved) {
          const parsed = parseFloat(saved);
          if (parsed > 0.5 && parsed < 1.0) safariRatio = parsed;
        }
      } catch { /* ignore */ }
      // PWA 全屏无工具栏，视口比 Safari 更大，等比放大以补偿视觉密度
      const screenH = window.screen?.height || _height.value;
      const currentRatio = screenH > 0 ? _height.value / screenH : 1;
      const pwaCompensation = currentRatio / safariRatio;
      // 仅当补偿显著（>2%）且合理（0.9~1.35）时才叠加
      if (pwaCompensation > 1.02 && pwaCompensation < 1.35) {
        scale *= pwaCompensation;
      }
    }

    // ── 安全钳位 ──
    scale = Math.max(0.88, Math.min(scale, 1.40));

    if (Math.abs(scale - 1) < 0.008) return {};

    // width/height 补偿：容器被 scale 缩小后视觉尺寸不变，
    // 防止 flex 布局因容器缩小导致内容被裁剪
    return {
      width: `${Math.ceil(_width.value / scale)}px`,
      height: `${Math.ceil(_height.value / scale)}px`,
      transform: `scale(${scale.toFixed(4)})`,
      transformOrigin: 'top left',
    };
  });

  /** @deprecated 使用 mobileScaleStyle 替代，保留别名用于向后兼容 */
  const pwaScaleStyle = mobileScaleStyle;

  /**
   * 桌面端自适应缩放样式
   * 以 1920px 为设计基准宽度，轻量适配 1366px~2560px 各种桌面屏幕。
   * scale = clamp(viewportWidth / 1920, 0.94, 1.08)
   * ⚠️ 桌面缩放非常轻量（±8%），避免字体过大或过小。
   */
  const desktopScaleStyle = computed(() => {
    if (!isDesktop.value) return {};
    let scale = _width.value / DESKTOP_DESIGN_WIDTH;
    scale = Math.max(0.94, Math.min(scale, 1.08));
    if (Math.abs(scale - 1) < 0.006) return {};
    return {
      width: `${Math.ceil(_width.value / scale)}px`,
      height: `${Math.ceil(_height.value / scale)}px`,
      transform: `scale(${scale.toFixed(4)})`,
      transformOrigin: 'top left',
    };
  });

  /** 统一自适应缩放：移动端 + 桌面端自动适配（互斥） */
  const adaptiveScaleStyle = computed(() => {
    if (isMobile.value) return mobileScaleStyle.value;
    if (isDesktop.value) return desktopScaleStyle.value;
    return {}; // 平板不缩放
  });

  /** 当前是否运行在 PWA standalone 模式（主屏幕打开） */
  const isPwa = computed(() => _isPwa.value);

  return {
    width: _width,
    isMobile,
    isTablet,
    isDesktop,
    isSmallScreen,
    isTouchDevice,
    deviceType,
    // 统一缩放
    isPwa,
    mobileScaleStyle,
    pwaScaleStyle,  // 向后兼容别名
    desktopScaleStyle,
    adaptiveScaleStyle,
  };
}
