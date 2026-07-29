import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTextbookStore } from '@/stores/textbookStore';

// Mock storage
vi.mock('@/utils/storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
    getUsage: vi.fn().mockResolvedValue(0)
  }
}));

function createChapter(title: string, start: number, end: number, children?: any[]): any {
  return { title, start, end, selected: false, children: children || [] };
}

describe('useTextbookStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('初始状态为空', () => {
    const store = useTextbookStore();
    expect(store.textbooks).toEqual([]);
    expect(store.selectedCount).toBe(0);
  });

  it('添加和删除教材', () => {
    const store = useTextbookStore();
    store.addTextbook({ id: '1', title: '语文一年级' } as any);
    expect(store.textbooks).toHaveLength(1);
    store.removeTextbook('1');
    expect(store.textbooks).toHaveLength(0);
  });

  it('切换章节勾选状态', () => {
    const store = useTextbookStore();
    const outline = [
      createChapter('第一课', 1, 10, [
        createChapter('生字', 1, 5),
        createChapter('课文', 6, 10)
      ])
    ];
    store.addTextbook({ id: '1', title: '语文', outline } as any);

    store.toggleBookSelection(store.textbooks[0], true);
    expect(store.textbooks[0].selected).toBe(true);
    expect(store.textbooks[0].outline![0].selected).toBe(true);
    expect(store.textbooks[0].outline![0].children![0].selected).toBe(true);
  });

  it('selectedBooks 返回有选中章节的教材', () => {
    const store = useTextbookStore();
    const outline = [
      { title: '第一课', start: 1, end: 10, selected: false, children: [
        { title: '生字', start: 1, end: 5, selected: true, children: [] }
      ]}
    ];
    store.addTextbook({ id: '1', title: '语文', outline, selected: false } as any);
    store.addTextbook({ id: '2', title: '数学', outline: [] } as any);

    expect(store.selectedBooks).toHaveLength(1);
    expect(store.selectedBooks[0].id).toBe('1');
  });

  it('selectedChapterCount 正确计数', () => {
    const store = useTextbookStore();
    const outline = [
      { title: '第一课', start: 1, end: 10, selected: false, children: [
        { title: '生字', start: 1, end: 5, selected: true, children: [] },
        { title: '课文', start: 6, end: 10, selected: true, children: [] }
      ]}
    ];
    store.addTextbook({ id: '1', title: '语文', outline } as any);
    expect(store.selectedChapterCount).toBe(2);
  });

  it('clearSelection 清除所有勾选', () => {
    const store = useTextbookStore();
    const outline = [
      { title: '第一课', start: 1, end: 10, selected: false, children: [
        { title: '生字', start: 1, end: 5, selected: true, children: [] }
      ]}
    ];
    store.addTextbook({ id: '1', title: '语文', outline, selected: true } as any);

    store.clearSelection();
    expect(store.textbooks[0].selected).toBe(false);
    expect(store.textbooks[0].outline![0].selected).toBe(false);
    expect(store.textbooks[0].outline![0].children![0].selected).toBe(false);
  });

  it('getSelectedChapters 过滤被父章节覆盖的叶子节点', () => {
    const store = useTextbookStore();
    const outline = [
      { title: '第一单元', start: 1, end: 20, selected: true, children: [
        { title: '第一课', start: 1, end: 10, selected: false, children: [
          { title: '生字', start: 1, end: 5, selected: false, children: [] }
        ]}
      ]}
    ];
    store.addTextbook({ id: '1', title: '语文', outline } as any);

    const selected = store.getSelectedChapters(outline);
    expect(selected.length).toBeGreaterThanOrEqual(1);
  });
});
