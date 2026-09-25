import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryView, collapsedKeysOf } from '../useLibraryView';

// 教材库/模板库「默认按类收起」（2026-09-25 用户：重启/刷新后默认按类收起，而非全部展开）
// 🔴 关键语义：只在「从未手动设置过折叠状态」（localStorage 无该键）时应用默认收起；
//    用户手动展开/收起的组合照旧被记住，且 ensureDefaultCollapsed 不主动落盘、不覆盖已有记录。
// ============================================================

const GROUPS = [
  { key: '小学', label: '小学', subjects: [{ key: '语文' }, { key: '数学' }] },
  { key: '初中', label: '初中', subjects: [{ key: '英语' }] },
];

const KEY = 'zwg.library.collapsedGroups';

const stubLocalStorage = (map) => {
  const store = new Map(Object.entries(map || {}));
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
};

describe('collapsedKeysOf：扁平化两级组键', () => {
  it('返回学段键 + 各学科键', () => {
    expect(collapsedKeysOf(GROUPS)).toEqual(['小学', '语文', '数学', '初中', '英语']);
  });
  it('空分组返回空数组', () => {
    expect(collapsedKeysOf([])).toEqual([]);
  });
});

describe('useLibraryView.ensureDefaultCollapsed：默认按类收起', () => {
  beforeEach(() => stubLocalStorage({}));

  it('从未记录过折叠状态时，默认铺成全部收起（含学段与学科键）', () => {
    const view = useLibraryView({ storageKey: 'library' });
    view.ensureDefaultCollapsed(GROUPS);
    expect([...view.collapsed.value]).toEqual(collapsedKeysOf(GROUPS));
    expect(view.isCollapsed('小学')).toBe(true);
    expect(view.isCollapsed('语文')).toBe(true);
  });

  it('已有折叠记录时，不覆盖用户手动存下的状态', () => {
    stubLocalStorage({ [KEY]: JSON.stringify(['初中']) });
    const view = useLibraryView({ storageKey: 'library' });
    expect([...view.collapsed.value]).toEqual(['初中']); // 读回用户状态
    view.ensureDefaultCollapsed(GROUPS);
    expect([...view.collapsed.value]).toEqual(['初中']); // ensure 不接管
  });

  it('不主动落盘：从未记录时调用后 localStorage 仍无该键', () => {
    const view = useLibraryView({ storageKey: 'library' });
    view.ensureDefaultCollapsed(GROUPS);
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });

  it('展开后持久化，重启读到的是展开（不退回默认收起）', () => {
    const view = useLibraryView({ storageKey: 'library' });
    view.expandAll(); // 用户点「全部展开」→ 落盘 '[]'
    view.ensureDefaultCollapsed(GROUPS);
    expect(view.hasCollapsed()).toBe(false);

    stubLocalStorage({ [KEY]: '[]' }); // 模拟重启，读到已存空集
    const view2 = useLibraryView({ storageKey: 'library' });
    expect(view2.hasCollapsed()).toBe(false);
    view2.ensureDefaultCollapsed(GROUPS);
    expect(view2.hasCollapsed()).toBe(false); // 有记录('[]')，不默认收起
  });

  it('空分组下调用无副作用', () => {
    const view = useLibraryView({ storageKey: 'library' });
    view.ensureDefaultCollapsed([]);
    expect(view.hasCollapsed()).toBe(false);
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });
});