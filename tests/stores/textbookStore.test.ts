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

  // 🔬 材料标签（条目性质 kind）两处存储层归一（2026-09-14）：kind 是"模型自觉输出"字段，实测常缺
  //    （英语单元走正文页分支、schema 早带 kind 仍不吐）→ 必须在存储层兜底，否则展示层没标签、生成端也没分流。
  it('落库归一：条目性质 kind 显式优先、缺失按条目名兜底（模型漏字段也能拿到）', async () => {
    const storageApi = (await import('@/utils/storage')).default;
    const ch: any = { title: 'Unit 1', start: 1, end: 8, analyzed: false };
    const store = useTextbookStore();
    store.textbooks = [{ id: 'K1', name: '英语·上', outline: [ch] } as any];

    store.updateChaptersAnalysis('K1', [{
      chapterRef: ch,
      rawText: 'x'.repeat(30),
      knowledgeHierarchy: [{
        bigConcept: '面对新困难',
        coreKnowledge: [
          { name: '语音：字母组合 ee', level: '理解', specificConcepts: ['/iː/'] },          // 无 kind → 知识
          { name: '课文：蜗牛爬树', level: '理解', specificConcepts: [] },                    // 无 kind → 材料（名字兜底）
          { name: '故事：Bobby 唱歌', level: '理解', specificConcepts: [], kind: 'knowledge' }, // 显式优先（名字像材料也判知识）
        ],
      }],
    }] as any);

    const cks = (store.textbooks[0].outline![0] as any).knowledgeHierarchy[0].coreKnowledge;
    expect(cks[0].kind).toBe('knowledge');
    expect(cks[1].kind).toBe('material');
    expect(cks[2].kind).toBe('knowledge');
    expect(storageApi.setItem).toHaveBeenCalled(); // 落盘
  });

  it('读盘归一：旧分析结果（存储里没有 kind）在读盘时幂等回填', async () => {
    const storageApi = (await import('@/utils/storage')).default;
    const legacy = {
      id: 'K2', name: '英语·下',
      outline: [{
        title: 'Unit 2', start: 1, end: 8, analyzed: true, rawText: 'y'.repeat(30),
        knowledgeHierarchy: [{
          bigConcept: '主题',
          coreKnowledge: [
            { name: '语法：一般现在时', level: '理解', specificConcepts: [] },
            { name: '课文：The snail', level: '理解', specificConcepts: [] },
          ],
        }],
      }],
    };
    (storageApi.getItem as any).mockResolvedValueOnce([legacy]);

    const store = useTextbookStore();
    await store.loadTextbooks();

    const cks = (store.textbooks[0].outline![0] as any).knowledgeHierarchy[0].coreKnowledge;
    expect(cks[0].kind).toBe('knowledge');
    expect(cks[1].kind).toBe('material');
  });

  it('人工改判：setAnchorKind 只写显式 kind（resolveAnchorKind 优先读它）并立即落盘；非法值不写', async () => {
    const storageApi = (await import('@/utils/storage')).default;
    const ck: any = { name: '课文：蜗牛爬树' }; // 名字本判 material
    const store = useTextbookStore();
    store.textbooks = [{ id: 'K3', name: 'x', outline: [] } as any];
    (storageApi.setItem as any).mockClear();

    await store.setAnchorKind(ck, 'knowledge');
    expect(ck.kind).toBe('knowledge');            // 改判 = 写显式值
    expect(storageApi.setItem).toHaveBeenCalled(); // 立即落盘（关抽屉不保存也不丢）

    await store.setAnchorKind(ck, 'material');
    expect(ck.kind).toBe('material');

    await store.setAnchorKind(ck, 'anything' as any); // 非法值
    expect(ck.kind).toBe('material');             // 不被污染
  });
});
