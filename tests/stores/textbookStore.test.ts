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

// 🔴 2026-09-18 用户裁定（"生成指令的清空触发条件，可否增加一条：勾选的教材变化时也自动清空？"）
//    生成页 watch 的失效源原样使用"有章节被勾选"的教材串 → 若教材**被勾选但 outline 为空**
//    （未提取章节/目录模式），勾选前后串不变 → 指令不重置（依据已变、旧指令仍在）。
//    现由 store 单源 getter `instructionBookSignature` 提供签名：教材级勾选位 ∪ 任一章被勾选。
describe('instructionBookSignature（生成指令失效签名·教材侧）', () => {
  const mkBook = (id: string, outline: any[], selected = false) =>
    ({ id, title: id, stage: 'primary', subject: '语文', grade: '三年级', outline, selected } as any);

  it('未勾选任何教材 → 空串（不触发重置）', () => {
    const store = useTextbookStore();
    store.textbooks = [mkBook('b1', [createChapter('第一课', 1, 10)])];
    expect(store.instructionBookSignature).toBe('');
  });

  it('勾选/取消章节 → 签名随之变化（原有行为保底）', () => {
    const store = useTextbookStore();
    store.textbooks = [mkBook('b1', [createChapter('第一课', 1, 10)])];
    const before = store.instructionBookSignature;
    store.textbooks[0].outline![0].selected = true; // 经 store 改值（走响应式代理）
    expect(store.instructionBookSignature).not.toBe(before);
    expect(store.instructionBookSignature).toContain('b1');
  });

  it('🔴 关键口：勾选"无章节"的教材（outline 为空/目录模式）→ 签名也变化（原串不变，指令不会重置）', () => {
    const store = useTextbookStore();
    store.textbooks = [mkBook('b1', [])];
    const before = store.instructionBookSignature;
    store.textbooks[0].selected = true;        // 教材级勾选：outline 仍为空
    const after = store.instructionBookSignature;
    expect(after).not.toBe(before);
    expect(after).toContain('b1');
  });

  it('教材级勾选位变化（章节未动）→ 签名变化', () => {
    const store = useTextbookStore();
    const ch = createChapter('第一课', 1, 10);
    ch.selected = true;
    store.textbooks = [mkBook('b1', [ch], false)];
    const before = store.instructionBookSignature;
    store.textbooks[0].selected = true;        // 勾满整本
    expect(store.instructionBookSignature).not.toBe(before);
  });

  it('章节改名/换起点 → 签名变化（依据已变）', () => {
    const store = useTextbookStore();
    const ch = createChapter('第一课', 1, 10);
    ch.selected = true;
    store.textbooks = [mkBook('b1', [ch])];
    const before = store.instructionBookSignature;
    store.textbooks[0].outline![0].title = '第一课（修订）';
    expect(store.instructionBookSignature).not.toBe(before);
  });

  it('多本教材：任一勾选状态变化都反映在签名里', () => {
    const store = useTextbookStore();
    store.textbooks = [
      mkBook('b1', [createChapter('第一课', 1, 10)], true),
      mkBook('b2', [createChapter('第二课', 11, 20)], false),
    ];
    const before = store.instructionBookSignature;
    store.textbooks[1].outline![0].selected = true; // 第二本被勾选
    const after = store.instructionBookSignature;
    expect(after).not.toBe(before);
    expect(after).toContain('b1');
    expect(after).toContain('b2');
  });
});

// ═══════════════════════════════════════════════════════════════
// 🔴 空值不覆盖（2026-09-24 用户定）
//    "分析失败返回空 → 旧原文/旧结果被静默清空" 是真实风险：原文丢了要重新 OCR 才回得来。
//    所以：本轮拿不到内容就保留旧内容；要清空请走界面上的显式清空。
// ═══════════════════════════════════════════════════════════════
describe('空值不覆盖（防分析失败静默清空）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mkStore = (chapters: any[]) => {
    const store = useTextbookStore();
    store.addTextbook({ id: '1', title: '语文', outline: chapters } as any);
    return store;
  };

  it('整条结果都空（分析失败）→ 整章一个字都不动，也不改 analyzed', () => {
    const ch = createChapter('一、草原', 1, 10);
    ch.rawText = '旧原文：草原的天空很蓝。';
    ch.coreTopics = '草原风情';
    ch.knowledgePoints = ['草原'];
    ch.analyzed = true;
    const store = mkStore([ch]);

    store.updateChaptersAnalysis('1', [{ chapterRef: ch }] as any);

    expect(ch.rawText).toBe('旧原文：草原的天空很蓝。');
    expect(ch.coreTopics).toBe('草原风情');
    expect(ch.knowledgePoints).toEqual(['草原']);
    expect(ch.analyzed).toBe(true);
  });

  it('新章节 + 空结果 → 不会被凭空标成"已分析"', () => {
    const ch = createChapter('一、草原', 1, 10);
    const store = mkStore([ch]);

    store.updateChaptersAnalysis('1', [{ chapterRef: ch, rawText: '   ' }] as any);

    expect(ch.analyzed).toBeFalsy();
    expect(ch.rawText).toBeFalsy();
  });

  it('单字段空 → 该字段保留旧值，其余字段照常更新', () => {
    const ch = createChapter('一、草原', 1, 10);
    ch.rawText = '旧原文';
    ch.competency = '应用';
    const store = mkStore([ch]);

    store.updateChaptersAnalysis('1', [{ chapterRef: ch, rawText: '', coreTopics: '新主题' }] as any);

    expect(ch.rawText).toBe('旧原文');       // 空值不回填
    expect(ch.coreTopics).toBe('新主题');     // 有值照常更新
    expect(ch.competency).toBe('应用');       // 空 → 不静默退回默认的「理解」
  });

  it('formulas / knowledgePoints 空 → 不清空旧值', () => {
    const ch = createChapter('一、草原', 1, 10);
    ch.rawText = '旧原文';
    ch.formulas = ['E=mc^2'];
    ch.knowledgePoints = ['旧知识点'];
    const store = mkStore([ch]);

    store.updateChaptersAnalysis('1', [{ chapterRef: ch, rawText: '新原文' }] as any);

    expect(ch.formulas).toEqual(['E=mc^2']);
    expect(ch.knowledgePoints).toEqual(['旧知识点']);
    expect(ch.rawText).toBe('新原文');
  });

  it('有内容时照旧覆盖（守卫不能把正常更新也挡住）', () => {
    const ch = createChapter('一、草原', 1, 10);
    ch.rawText = '旧原文';
    ch.coreTopics = '旧主题';
    ch.formulas = ['旧公式'];
    ch.knowledgePoints = ['旧知识点'];
    const store = mkStore([ch]);

    store.updateChaptersAnalysis('1', [{
      chapterRef: ch,
      rawText: '新原文',
      coreTopics: '新主题',
      formulasText: 'a^2+b^2=c^2',
      knowledgePointsText: '新知识点A\n新知识点B',
    }] as any);

    expect(ch.rawText).toBe('新原文');
    expect(ch.coreTopics).toBe('新主题');
    expect(ch.formulas).toEqual(['a^2+b^2=c^2']);
    expect(ch.knowledgePoints).toEqual(['新知识点A', '新知识点B']);
  });

  it('指纹按"实际留下来的原文"现算（保留旧值时不会算成空串）', () => {
    const a = createChapter('甲', 1, 10);
    a.rawText = '旧原文';
    const b = createChapter('乙', 11, 20);
    b.rawText = '旧原文';
    const store = mkStore([a, b]);

    store.updateChaptersAnalysis('1', [
      { chapterRef: a, rawText: '旧原文', coreTopics: '主题' }, // 正常带原文
      { chapterRef: b, coreTopics: '主题' },                    // 原文为空（模拟失败）
    ] as any);

    expect(b._analyzedPlainTextLength).toBe('旧原文'.length);
    expect(b._analyzedTextHash).toBe(a._analyzedTextHash);
  });
});
