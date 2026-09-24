/**
 * 教材库／模板库视图交互（单一实现，两库共用）
 * ============================================================
 * 提供两件事（都持久化到 localStorage，键前缀按库区分）：
 *   ① **列表／预览分栏可拖动调宽**（2026-09-20 用户："列表和预览两个块，可否手动拖动调整宽？"）
 *      —— 双击拖动条复位默认宽度；宽度做上下限钳制，保证预览区不被挤没。
 *   ② **两级分组折叠状态**（学段 → 学科，见 utils/libraryGrouping）—— 记住用户收起了哪些组。
 *
 * 🔴 为什么抽成 composable：课本库与模板库是同一套交互，各写一份必然漂移
 *    （本仓库对"双份逐字副本各自演化"有过多次教训，如 autoDetectMeta）。
 * 🔴 纯计算部分（clampPanelWidth / collapsedKeysOf）单独导出，便于直接单测，无需挂载组件。
 * ============================================================
 */
import { ref, nextTick, onBeforeUnmount } from 'vue';

/** 默认宽度与钳制边界：列表最少 280px；预览区至少留 420px（PdfPreview 可用下限） */
export const PANEL_MIN_WIDTH = 280;
export const PANEL_MIN_PREVIEW = 420;
export const PANEL_DEFAULT_WIDTH = 420;

/**
 * 分栏宽度钳制（纯函数）：下限 → 列表可用；上限 → 预览区不被挤没。
 * 视口过窄导致区间倒挂时（min > max），以 min 为准并让预览区自己滚动，不产生 NaN/负值。
 */
export const clampPanelWidth = (desired, {
  min = PANEL_MIN_WIDTH, minPreview = PANEL_MIN_PREVIEW, viewportWidth = 0,
} = {}) => {
  const d = Number(desired);
  if (!Number.isFinite(d)) return min;
  const max = Number.isFinite(viewportWidth) && viewportWidth > 0
    ? Math.max(min, viewportWidth - minPreview)
    : d;
  return Math.round(Math.min(Math.max(d, min), max));
};

/** 全部可折叠的组键（学段键 + 学科键）——「全部折叠」按它一次性收起 */
export const collapsedKeysOf = (groups = []) =>
  (groups || []).flatMap((g) => [g.key, ...(g.subjects || []).map((s) => s.key)]);

const readNumber = (key, fallback, min) => {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v >= min ? v : fallback;
  } catch { return fallback; }
};

const readKeys = (key) => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : [];
  } catch { return []; }
};

const write = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* 隐私模式/配额满：视图偏好写不进去不影响功能 */ }
};

/**
 * @param {{ storageKey: string, defaultWidth?: number }} opts
 *   storageKey 用于区分两个库（如 'textbook' / 'template'），避免宽度与折叠状态互相串味。
 */
export function useLibraryView({ storageKey = 'library', defaultWidth = PANEL_DEFAULT_WIDTH } = {}) {
  const W_KEY = `zwg.${storageKey}.panelWidth`;
  const C_KEY = `zwg.${storageKey}.collapsedGroups`;

  // ── ① 分栏宽度 ──
  const panelWidth = ref(readNumber(W_KEY, defaultWidth, PANEL_MIN_WIDTH));
  const resizing = ref(false);
  let cleanupDrag = null;

  const persistWidth = () => write(W_KEY, String(panelWidth.value));
  const resetPanelWidth = () => { panelWidth.value = defaultWidth; persistWidth(); };

  /** 拖动条 mousedown → 在 document 上跟踪 mousemove（拖到条外也不丢），松开即结束并落盘 */
  const startResize = (e) => {
    if (!e || typeof document === 'undefined') return;
    const startX = e.clientX;
    const startWidth = panelWidth.value;
    resizing.value = true;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none'; // 拖动时不选中文字

    const onMove = (ev) => {
      panelWidth.value = clampPanelWidth(startWidth + (ev.clientX - startX), {
        viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      });
    };
    const onUp = () => {
      resizing.value = false;
      document.body.style.userSelect = prevUserSelect || '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      cleanupDrag = null;
      persistWidth();
    };
    cleanupDrag = () => {
      onUp();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── ② 两级折叠（Set 存放组键；换新 Set 触发响应式更新） ──
  const collapsed = ref(new Set(readKeys(C_KEY)));
  const persistCollapsed = () => write(C_KEY, JSON.stringify([...collapsed.value]));

  const isCollapsed = (key) => collapsed.value.has(key);

  /** 从元素向上找最近的纵向滚动容器（不写死类名：教材库 .textbook-list / 模板库 .template-list 通用） */
  const findScrollParent = (el) => {
    let n = el && el.parentElement;
    while (n && n !== document.body) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
      n = n.parentElement;
    }
    return null;
  };

  /**
   * 折叠/展开分组 —— **原地收，不带着滚动位置一起跳**。
   * 🔴 起因（2026-09-24 用户）：组头吸顶后一点"收"，被收组的内容消失、列表内容总高骤减，
   *    浏览器把 scrollTop 夹回新的最大值 → 整个列表往上蹿一段，用户说"会出现幻觉"。
   * 做法：先把被点组头的屏幕纵坐标记下来，折叠并等布局落定后，用 scrollTop 补回同样的差值，
   *    让这个组头**待在原地不动**；之后滚不滚动、滚到哪里，全部交给用户自己操作。
   */
  const toggleCollapse = async (key, ev) => {
    const headerEl = ev && ev.currentTarget ? ev.currentTarget : null;
    const scroller = headerEl ? findScrollParent(headerEl) : null;
    const beforeTop = headerEl ? headerEl.getBoundingClientRect().top : 0;

    const next = new Set(collapsed.value);
    if (next.has(key)) next.delete(key); else next.add(key);
    collapsed.value = next;
    persistCollapsed();

    if (!headerEl || !scroller) return;
    await nextTick();
    // 再等一帧：sticky 的吸附位置也要重算完，否则量到的是过渡中的坐标
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    if (!headerEl.isConnected) return;
    const delta = headerEl.getBoundingClientRect().top - beforeTop;
    if (Math.abs(delta) > 0.5) scroller.scrollTop += delta;
  };
  const collapseAll = (groups = []) => {
    collapsed.value = new Set(collapsedKeysOf(groups));
    persistCollapsed();
  };
  const expandAll = () => { collapsed.value = new Set(); persistCollapsed(); };
  /** 是否有任何组被收起（决定按钮显示「全部展开」还是「全部折叠」） */
  const hasCollapsed = () => collapsed.value.size > 0;

  onBeforeUnmount(() => { if (cleanupDrag) cleanupDrag(); });

  return {
    panelWidth, resizing, startResize, resetPanelWidth,
    collapsed, isCollapsed, toggleCollapse, collapseAll, expandAll, hasCollapsed,
  };
}

export default { useLibraryView, clampPanelWidth, collapsedKeysOf };
