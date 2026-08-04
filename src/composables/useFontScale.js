/**
 * 🔤 全局字体缩放
 * 通过调整 html 的 font-size 百分比实现全局文字等比缩放，
 * 不影响结构尺寸（按钮高度、间距等 px 值保持不变）。
 *
 * 原理：html { font-size: 100% } → 1rem = 16px
 *       html { font-size: 120% } → 1rem = 19.2px → 所有 rem 文字放大 20%
 *
 * 范围：80% ~ 150%，步长 5%
 */
import { ref, watch } from 'vue';

const STORAGE_KEY = 'wisdom_font_scale';
const DEFAULT_SCALE = 1.0;    // 100%
const MIN_SCALE = 0.8;        // 80%
const MAX_SCALE = 1.5;        // 150%
const STEP = 0.05;            // 5%

const _scale = ref(DEFAULT_SCALE);

/** 从 localStorage 读取已保存的缩放值 */
function loadScale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const v = parseFloat(saved);
      if (!isNaN(v) && v >= MIN_SCALE && v <= MAX_SCALE) return v;
    }
  } catch { /* ignore */ }
  return DEFAULT_SCALE;
}

/** 应用缩放：设置 html 的 font-size 百分比 */
function applyScale(scale) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${(scale * 100).toFixed(0)}%`;
}

// 初始化
if (typeof window !== 'undefined') {
  _scale.value = loadScale();
  applyScale(_scale.value);
}

export function useFontScale() {
  const scale = ref(_scale.value);

  // 与全局 _scale 保持同步（多组件共享同一实例）
  watch(_scale, (v) => { scale.value = v; });

  /** 设置缩放值并持久化 */
  function setScale(newScale) {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    const rounded = Math.round(clamped / STEP) * STEP;
    _scale.value = rounded;
    try { localStorage.setItem(STORAGE_KEY, String(rounded)); } catch {}
    applyScale(rounded);
  }

  /** 重置为默认 */
  function resetScale() {
    setScale(DEFAULT_SCALE);
  }

  /** 当前缩放百分比文本（如 "100%"） */
  function scalePercent() {
    return `${Math.round(_scale.value * 100)}%`;
  }

  /** 当前缩放值 */
  function currentScale() {
    return _scale.value;
  }

  return {
    scale,
    setScale,
    resetScale,
    scalePercent,
    currentScale,
    MIN_SCALE,
    MAX_SCALE,
    STEP,
  };
}
