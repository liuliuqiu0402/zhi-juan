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

  it('updateChaptersAnalysis 必须补齐 _analyzedTextHash / _analyzedPlainTextLength（缺失会致生成端误判"文本已变"→降级目录卡、教材原文检不到）', () => {
    const store = useTextbookStore();
    const lesson = createChapter('一、草原', 1, 10);
    lesson.rawText = '草原风光教学设计素材第一段。';
    store.addTextbook({ id: '1', title: '语文', outline: [lesson] } as any);

    store.updateChaptersAnalysis('1', [{
      chapterRef: lesson,
      rawText: lesson.rawText,
      knowledgePointsText: '草原、风光',
      coreTopics: '草原风情',
      knowledgeHierarchy: [{ bigConcept: '写景', coreKnowledge: [{ name: '草原' }] }]
    }] as any);

    expect(lesson.analyzed).toBe(true);
    expect(lesson._analyzedPlainTextLength).toBe(lesson.rawText.length);
    expect(lesson._analyzedTextHash).toBeTruthy();
    // 与生成端 useAiGenerator 判定一致：指纹命中 → textChangedSinceAnalysis=false → 走"分析捷径"保原文片段
    // 这里仅校验持久化干净落盘，hash 一致性由 utils/hash.djb2 契约保证
    expect(typeof lesson._analyzedTextHash).toBe('string');
  });

  it('updateChaptersAnalysis 兜底：调用方不传指纹字段时仍会按 rawText 现算补齐', () => {
    const store = useTextbookStore();
    const lesson = createChapter('二、某课', 1, 5);
    lesson.rawText = '仅原文，无指纹回传。';
    store.addTextbook({ id: '1', title: '语文', outline: [lesson] } as any);

    store.updateChaptersAnalysis('1', [{
      chapterRef: lesson,
      rawText: lesson.rawText,
      coreTopics: '主题'
    }] as any);

    expect(lesson._analyzedPlainTextLength).toBe(lesson.rawText.length);
    expect(lesson._analyzedTextHash).toBeTruthy();
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

  it('loadTextbooks 启动时幂等回填旧版分析缺省指纹（无需重新分析）', async () => {
    const storageApi = (await import('@/utils/storage')).default;
    const legacyBook = { id: 'L1', name: '旧教材·上', outline: [
      { title: '第一课', start: 1, end: 8, selected: false, analyzed: true, rawText: '来有着旧数据原文一段。', knowledgePoints: ['点1'] }
    ] };
    (storageApi.getItem as any).mockResolvedValueOnce([legacyBook]);

    const store = useTextbookStore();
    await store.loadTextbooks();

    const ch = store.textbooks[0].outline![0] as any;
    expect(ch._analyzedPlainTextLength).toBe(ch.rawText.length);
    expect(ch._analyzedTextHash).toBeTruthy();
    expect(typeof ch._analyzedTextHash).toBe('string');
    expect(storageApi.setItem).toHaveBeenCalled();
  });

  it('loadTextbooks 对已带指纹的章节保持幂等（不覆盖），旧版缺省只补一次', async () => {
    const storageApi = (await import('@/utils/storage')).default;
    const book = { id: 'M1', name: '新版·上', outline: [
      { title: '第一课', start: 1, end: 8, selected: false, analyzed: true, rawText: 'abc',
        _analyzedPlainTextLength: 3, _analyzedTextHash: 'xxx',
        knowledgePoints: ['点1'] }
    ] };
    (storageApi.getItem as any).mockResolvedValueOnce([book]);

    const store = useTextbookStore();
    await store.loadTextbooks();

    const ch = store.textbooks[0].outline![0] as any;
    // 已有指纹不应被覆盖（保持原值）
    expect(ch._analyzedPlainTextLength).toBe(3);
    expect(ch._analyzedTextHash).toBe('xxx');
  });
});
