/**
 * 📱 下拉刷新 composable
 * 模拟原生 App 的下拉刷新手势，触发指定回调。
 *
 * 用法：
 *   const { containerRef, refreshing, pullDistance } = usePullToRefresh(onRefresh);
 *   将 containerRef 绑定到可滚动容器上。
 */
import { ref, onMounted, onUnmounted } from 'vue';

export function usePullToRefresh(onRefresh) {
  const refreshing = ref(false);
  const pullDistance = ref(0);
  const containerRef = ref(null);

  let startY = 0;
  let currentY = 0;
  let pulling = false;
  const THRESHOLD = 60; // 下拉超过此像素触发刷新

  const reset = () => {
    pulling = false;
    startY = 0;
    currentY = 0;
    pullDistance.value = 0;
  };

  const onTouchStart = (e) => {
    // 只在滚动到顶部时允许下拉
    const el = containerRef.value;
    if (!el) return;
    if (el.scrollTop > 5) return;
    if (refreshing.value) return;

    startY = e.touches[0].clientY;
    pulling = true;
  };

  const onTouchMove = (e) => {
    if (!pulling || refreshing.value) return;
    currentY = e.touches[0].clientY;
    const delta = currentY - startY;
    if (delta <= 0) { reset(); return; }

    // 阻尼效果：越拉越慢
    pullDistance.value = Math.min(delta * 0.4, 120);
  };

  const onTouchEnd = async () => {
    if (!pulling || refreshing.value) { reset(); return; }
    pulling = false;

    if (pullDistance.value >= THRESHOLD) {
      refreshing.value = true;
      pullDistance.value = 50; // 保持指示器可见
      try {
        await onRefresh();
      } catch { /* ignore */ }
      refreshing.value = false;
    }
    // 回弹动画由 CSS transition 处理
    pullDistance.value = 0;
  };

  onMounted(() => {
    const el = containerRef.value;
    if (!el) return;
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
  });

  onUnmounted(() => {
    const el = containerRef.value;
    if (!el) return;
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
  });

  return { containerRef, refreshing, pullDistance };
}
