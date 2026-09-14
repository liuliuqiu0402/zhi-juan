// ✅ A1（2026-09-11）：锚树契约 —— 结构校验（不落库）/ 粒度判据（最小单位下沉第3层）/ 粒度诊断
// 背景：分析输出即"锚清单本体"（knowledgeHierarchy 第 2 层 = 锚），粒度不统一会让锚清单失真。
//       典型反例：语文低段把"人/口/手"单字提为第 2 层条目 → 短锚爆炸、下游取不到真考点。
import { describe, it, expect } from 'vitest';
import {
  SHORT_ANCHOR_MAX_LEN,
  isMinUnitName,
  validateAnchorTree,
  anchorGranularityReport,
  diagnoseAnchorTree,
  summarizeAnchorGranularity,
  buildAnchorListByChapter,
  formatAnchorListByChapter,
  anchorListRoleNote,
  MAX_SPECIFIC_CONCEPTS_PER_ANCHOR,
  ANCHOR_LIST_ROLE_NOTE,
} from '../../src/utils/anchorTreeContract.js';
import { buildAnchors } from '../../src/utils/coverageAnchor.js';

// 正确形态：最小单位在第 3 层
const goodTree = [
  {
    bigConcept: '识字与写字',
    coreKnowledge: [
      { name: '识字与书写', level: '识记', specificConcepts: ['人', '口', '手'] },
      { name: '多音字辨析', level: '理解', specificConcepts: ['长(cháng)/长(zhǎng)'] },
      { name: '词语积累与运用', level: '应用', specificConcepts: ['成语接龙', '近义词辨析'] },
    ],
  },
];

// 违规形态：单字被提为第 2 层
const badTree = [
  {
    bigConcept: '识字与写字',
    coreKnowledge: [
      { name: '人', level: '识记', specificConcepts: [] },
      { name: '口', level: '识记', specificConcepts: [] },
      { name: '识字与书写', level: '识记', specificConcepts: ['手'] },
    ],
  },
];

describe('A1 粒度判据：isMinUnitName（确定性部分）', () => {
  it('单个汉字 / 单个字母 / 单个数字 / 单个符号 / 纯数值 → 最小单位（须下沉第3层）', () => {
    for (const n of ['人', '口', '手', 'A', 'a', '5', '。', '×', '0.5', '12']) {
      expect(isMinUnitName(n), n).toBe(true);
    }
  });
  it('可独立成题的考点名 → 非最小单位（不得误判）', () => {
    for (const n of ['识字与书写', '多音字辨析', 'ee', '分数', '小数乘整数', '光合作用']) {
      expect(isMinUnitName(n), n).toBe(false);
    }
  });
  it('空值安全返回 false', () => {
    expect(isMinUnitName('')).toBe(false);
    expect(isMinUnitName(null)).toBe(false);
    expect(isMinUnitName(undefined)).toBe(false);
    expect(isMinUnitName('   ')).toBe(false);
  });
});

describe('A1-2 锚树结构校验（只判结构、不改内容）', () => {
  it('正确形态（最小单位在第3层）→ ok，零违规', () => {
    const r = validateAnchorTree(goodTree);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('反例：第2层出现单字「人」「口」→ core-is-min-unit，且 ok=false（→ 不落库）', () => {
    const r = validateAnchorTree(badTree);
    expect(r.ok).toBe(false);
    const codes = r.violations.filter(v => v.code === 'core-is-min-unit').map(v => v.name);
    expect(codes).toEqual(['人', '口']);
    expect(r.violations[0].path).toContain('coreKnowledge[0]');
  });

  it('结构类违规：非数组 / 缺 bigConcept / coreKnowledge 非数组 / 缺考点名 / 字段类型错', () => {
    expect(validateAnchorTree(null).violations[0].code).toBe('not-array');
    expect(validateAnchorTree([]).violations[0].code).toBe('empty');
    expect(validateAnchorTree([{ coreKnowledge: [] }]).violations.map(v => v.code)).toContain('big-missing-name');
    expect(validateAnchorTree([{ bigConcept: 'A', coreKnowledge: null }]).violations.map(v => v.code)).toContain('core-not-array');
    expect(validateAnchorTree([{ bigConcept: 'A', coreKnowledge: [] }]).violations.map(v => v.code)).toContain('core-empty');
    expect(validateAnchorTree([{ bigConcept: 'A', coreKnowledge: [{ name: '' }] }]).violations.map(v => v.code)).toContain('core-missing-name');
    const typeErr = validateAnchorTree([{ bigConcept: 'A', coreKnowledge: [{ name: '考点', specificConcepts: '不是数组' }] }]);
    expect(typeErr.violations.map(v => v.code)).toContain('specific-not-array');
    const itemErr = validateAnchorTree([{ bigConcept: 'A', coreKnowledge: [{ name: '考点', specificConcepts: ['ok', 5] }] }]);
    expect(itemErr.violations.map(v => v.code)).toContain('specific-item-invalid');
  });

  it('🔒 只判结构、不改内容：校验前后输入对象深比较不变（防削足适履删条目）', () => {
    const input = JSON.parse(JSON.stringify(badTree));
    const snapshot = JSON.parse(JSON.stringify(badTree));
    validateAnchorTree(input);
    expect(input).toEqual(snapshot);
  });
});

describe('A1-3 锚粒度诊断（锚数 / 短锚占比 / specificConcepts 条数分布 / 绑定状态分布）', () => {
  it('正确形态：锚数=3、最小单位违例=0、specificConcepts 条数分布正确', () => {
    const rep = diagnoseAnchorTree(goodTree, { chapterTitle: '第1单元' });
    expect(rep.chapterTitle).toBe('第1单元');
    expect(rep.anchorCount).toBe(3);
    expect(rep.minUnitAnchorCount).toBe(0);
    expect(rep.specificConcepts).toEqual({
      total: 6, unique: 6, dupCount: 0, dupRatio: 0, min: 1, max: 3, median: 2, zeroCount: 0,
    });
  });

  it('第3层重复率（A1-3b 可观测）：同一单位重复收录 → dupCount/dupRatio 透出，且不删任何条目', () => {
    const dup = [
      { name: '生字识记', specificConcepts: ['人', '口', '人', '手'] },
      { name: '词语积累', specificConcepts: ['口', '成语接龙'] },
    ];
    const rep = anchorGranularityReport(dup, { chapterTitle: 'T' });
    expect(rep.specificConcepts.total).toBe(6);
    expect(rep.specificConcepts.unique).toBe(4);   // 人/口/手/成语接龙
    expect(rep.specificConcepts.dupCount).toBe(2);
    expect(rep.specificConcepts.dupRatio).toBe(0.333);
    // 🔒 只诊断、不改内容
    expect(dup[0].specificConcepts).toEqual(['人', '口', '人', '手']);
  });

  it('短锚占比（名长 ≤ 3 字）：可观测，且不参与任何删除', () => {
    expect(SHORT_ANCHOR_MAX_LEN).toBe(3);
    const anchors = [
      { name: '识字与书写', specificConcepts: [] },  // 5 字 → 非短锚
      { name: '成语', specificConcepts: [] },        // 2 字 → 短锚（但不违例：语义型词条无法确定性判定）
      { name: '多音字辨析', specificConcepts: [] },  // 5 字
      { name: '人', specificConcepts: [] },          // 1 字 → 短锚 + 最小单位违例
    ];
    const rep = anchorGranularityReport(anchors, { chapterTitle: 'T' });
    expect(rep.anchorCount).toBe(4);
    expect(rep.shortAnchorCount).toBe(2);
    expect(rep.shortRatio).toBe(0.5);
    expect(rep.minUnitAnchorCount).toBe(1);
    // ✅ 新判据生效核对：minUnitAnchors 列出仍挂在第2层的最小单位锚名（本批 = ['人']）
    expect(rep.minUnitAnchors).toEqual(['人']);
  });

  it('绑定状态分布：仅在有 bind 时统计（生成期锚）；分析期为空对象', () => {
    const bound = [
      { name: '考点A', specificConcepts: [], bind: { status: 'literal' } },
      { name: '考点B', specificConcepts: [], bind: { status: 'literal' } },
      { name: '考点C', specificConcepts: [], bind: { status: 'semantic' } },
      { name: '考点D', specificConcepts: [], bind: { status: 'missing' } },
    ];
    expect(anchorGranularityReport(bound).bindStatus).toEqual({ literal: 2, semantic: 1, missing: 1 });
    expect(anchorGranularityReport([{ name: '考点', specificConcepts: [] }]).bindStatus).toEqual({});
  });

  it('多章汇总：过细/过粗双向指标（锚数 + 短锚占比 + 平均锚数/章）', () => {
    const agg = summarizeAnchorGranularity([
      anchorGranularityReport([{ name: '完整考点名称甲', specificConcepts: ['a', 'b'] }, { name: '人', specificConcepts: [] }]),
      anchorGranularityReport([{ name: '完整考点名称乙', specificConcepts: ['c'] }]),
    ]);
    expect(agg.chapterCount).toBe(2);
    expect(agg.anchorCount).toBe(3);
    expect(agg.shortAnchorCount).toBe(1);   // 仅「人」≤ 3 字
    expect(agg.shortRatio).toBe(0.333);
    expect(agg.minUnitAnchorCount).toBe(1);
    expect(agg.specTotal).toBe(3);
    expect(agg.avgAnchorsPerChapter).toBe(1.5);
  });
});

describe('🧩 清单第3层注入开关（2026-09-14 用户定版开关）', () => {
  const anchors = [{ chapterTitle: '第1课', bigConcept: '', name: '知识点A', specificConcepts: ['甲', '乙'] }];

  it('默认注入：知识点名后括注第3层具体概念', () => {
    expect(formatAnchorListByChapter(anchors)).toBe('【第1课】知识点A（甲、乙）');
  });

  it('关闭后：只给第2层知识点名，不带具体概念（清单更短、更少与教材词句绑定）', () => {
    expect(formatAnchorListByChapter(anchors, { withConcepts: false })).toBe('【第1课】知识点A');
  });

  it('语言材料分流（命题型）：kind=material 单列成组并标注"不在覆盖单位之列"，知识性条目留在主题行', () => {
    const list = [
      { chapterTitle: '第1课', bigConcept: '', name: '语音：ee 发音', specificConcepts: ['/iː/'] },
      { chapterTitle: '第1课', bigConcept: '', name: '课文：蜗牛爬树', kind: 'material' },
      { chapterTitle: '第1课', bigConcept: '', name: '句型：一般过去时', specificConcepts: ['was/were'] },
    ];
    const split = formatAnchorListByChapter(list, { splitMaterial: true });
    expect(split).toContain('【第1课】语音：ee 发音（/iː/）、句型：一般过去时（was/were）');
    expect(split).toContain('◇ 语言材料（只作理解与难度依据，不在覆盖单位之列）：课文：蜗牛爬树');
    // 内容型（不拆分）→ 与分流前一致：全部混排
    const inline = formatAnchorListByChapter(list, { splitMaterial: false });
    expect(inline).toBe('【第1课】语音：ee 发音（/iː/）、课文：蜗牛爬树、句型：一般过去时（was/were）');
    // 旧分析结果无 kind → 视为知识性条目（行为与分流前一致，安全无害）
    const legacy = formatAnchorListByChapter([{ chapterTitle: '第1课', name: '知识点A' }], { splitMaterial: true });
    expect(legacy).toBe('【第1课】知识点A');
    // 角色说明随分流加一句（不列入覆盖单位）
    expect(anchorListRoleNote({ splitMaterial: true })).toContain('不列入覆盖单位');
    expect(anchorListRoleNote({ splitMaterial: false })).not.toContain('不列入覆盖单位');
  });

  it('角色说明随后两处开关组合（第3层 × 语言材料分流）仍自洽', () => {
    const off = anchorListRoleNote({ withConcepts: false, splitMaterial: true });
    expect(off).not.toContain('（第3层）');
    expect(off).toContain('不列入覆盖单位');
    expect(off).toContain('覆盖下限');
    // 默认导出 = 带第3层、不分流版本（兼容既有引用点）
    expect(ANCHOR_LIST_ROLE_NOTE).toBe(anchorListRoleNote());
  });
});

describe('A1-4 锚点清单按章分组（章序与原文一致）', () => {
  const anchors = [
    { chapterTitle: '第1课 草原', name: '生字识记' },
    { chapterTitle: '第1课 草原', name: '景物描写手法' },
    { chapterTitle: '第2课 丁香结', name: '借物抒情' },
    { chapterTitle: '第1课 草原', name: '生字识记' },   // 同名锚 → 去重
    { chapterTitle: '', name: '未标注章考点' },
  ];

  it('按章分组：多条锚共用一个章标题是正常形态；章序 = 传入锚序（= 勾选章序 = 原文章序）', () => {
    const groups = buildAnchorListByChapter(anchors);
    expect(groups.map(g => g.chapterTitle)).toEqual(['第1课 草原', '第2课 丁香结', '未标注章节']);
    expect(groups[0].names).toEqual(['生字识记', '景物描写手法']);
    expect(groups[1].names).toEqual(['借物抒情']);
  });

  it('呈现形态：【章名】考点A、考点B…（一行一章）', () => {
    expect(formatAnchorListByChapter(anchors))
      .toBe('【第1课 草原】生字识记、景物描写手法\n【第2课 丁香结】借物抒情\n【未标注章节】未标注章考点');
  });

  it('空输入安全返回空', () => {
    expect(buildAnchorListByChapter([])).toEqual([]);
    expect(formatAnchorListByChapter(null)).toBe('');
  });
});

describe('A1-4b 第1层（知识主题）入锚清单：表归属与范围，不作写作/命题单位', () => {
  const withThemes = [
    { chapterTitle: '第一单元 1～6的表内乘法', bigConcept: '乘法的意义', name: '认识几个几相加' },
    { chapterTitle: '第一单元 1～6的表内乘法', bigConcept: '乘法的意义', name: '认识乘法算式' },
    { chapterTitle: '第一单元 1～6的表内乘法', bigConcept: '1～6的乘法口诀', name: '5的乘法口诀' },
    { chapterTitle: '第一单元 1～6的表内乘法', bigConcept: '1～6的乘法口诀', name: '5的乘法口诀' }, // 同名去重
  ];

  it('buildAnchorListByChapter：既给扁平 names，也给第1层 themes 分组（章序/主题序不变）', () => {
    const groups = buildAnchorListByChapter(withThemes);
    expect(groups).toHaveLength(1);
    expect(groups[0].names).toEqual(['认识几个几相加', '认识乘法算式', '5的乘法口诀']);
    expect(groups[0].themes.map(t => t.bigConcept)).toEqual(['乘法的意义', '1～6的乘法口诀']);
    expect(groups[0].themes[1].names).toEqual(['5的乘法口诀']);
  });

  it('呈现形态：有第1层 → 分层；第1层与第2层均去重', () => {
    expect(formatAnchorListByChapter(withThemes)).toBe(
      '【第一单元 1～6的表内乘法】\n'
      + '· 乘法的意义：认识几个几相加、认识乘法算式\n'
      + '· 1～6的乘法口诀：5的乘法口诀',
    );
  });

  it('第1层 = 章名（目录锚形态）→ 省略该前缀，回退紧凑单行（不冗余）', () => {
    const toc = [
      { chapterTitle: '第3课 桂花雨', bigConcept: '第3课 桂花雨', name: '一、摇花乐' },
      { chapterTitle: '第3课 桂花雨', bigConcept: '第3课 桂花雨', name: '二、思乡情' },
    ];
    expect(formatAnchorListByChapter(toc)).toBe('【第3课 桂花雨】一、摇花乐、二、思乡情');
  });

  it('角色说明随清单注入：明确第1层不是写作栏目/命题单位（防粒度误读）', () => {
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('不是写作栏目');
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('（第2层）');
  });

  it('角色说明只报"结构性事实 + 覆盖下限"（2026-09-13）：清单外口径下沉到【素材使用约定】，防一刀切放水', () => {
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('清单是**覆盖下限**');
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('全部覆盖到');
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('【素材使用约定】');
    // 旧"一律"措辞易被读成"只能考清单内的点"，不回归
    expect(ANCHOR_LIST_ROLE_NOTE).not.toContain('一律是各主题下的');
    // 清单外"可补充/可整合"属**按资料类型分档**的口径，不得在清单角色说明里一刀切（由 extentOf 分档决定）
    expect(ANCHOR_LIST_ROLE_NOTE).not.toContain('适当补充');
  });
});

describe('A16（甲方案）锚点=目录：未分析/仅目录章不再从覆盖范围消失', () => {
  const mkTocCard = () => ({
    chapterTitle: '第3课 桂花雨',
    segments: [{ text: '第3课 桂花雨\n  一、摇花乐\n  二、思乡情', type: '正文' }],
    anchorTree: [{
      bigConcept: '第3课 桂花雨',
      coreKnowledge: ['第3课 桂花雨', '一、摇花乐', '二、思乡情'].map(name => ({
        name, level: '理解', specificConcepts: [],
      })),
    }],
  });

  it('目录卡 → buildAnchors 产出带章名的锚（可进【锚点清单】）', () => {
    const { anchors } = buildAnchors([mkTocCard()], {});
    const names = anchors.map(a => a.name);
    expect(names).toEqual(expect.arrayContaining(['第3课 桂花雨', '一、摇花乐', '二、思乡情']));
    expect(anchors.every(a => a.chapterTitle === '第3课 桂花雨')).toBe(true);
  });

  it('目录锚进按章分组清单（章名 → 目录标签）', () => {
    const { anchors } = buildAnchors([mkTocCard()], {});
    const groups = buildAnchorListByChapter(anchors);
    expect(groups).toHaveLength(1);
    expect(groups[0].chapterTitle).toBe('第3课 桂花雨');
    expect(groups[0].names).toContain('一、摇花乐');
  });
});

// ✅ A17（2026-09-14 用户定版）：第3层具体概念（specificConcepts）随知识点并入锚点清单
//    锚清单注入通道的注入物收敛为"锚点清单（含第3层）+ 难度要求"（语料锚已按用户定版移除——
//    第3层是经粒度校验的结构化概念明细，比原文片段绑定更可靠）
//    2026-09-14 术语口径：面向模型/用户的措辞统一「知识点」，不用「考点」（防全指向考卷）
describe('A17 第3层具体概念并入锚点清单（锚清单注入通道的知识明细）', () => {
  const withConcepts = [
    {
      chapterTitle: '第2课 荷花',
      bigConcept: '语言积累',
      name: '多音字辨析',
      specificConcepts: ['长(cháng)/长(zhǎng)', '种(zhǒng)/种(zhòng)'],
    },
    {
      chapterTitle: '第2课 荷花',
      bigConcept: '语言积累',
      name: '多音字辨析', // 同名锚 → 概念合并去重
      specificConcepts: ['长(cháng)/长(zhǎng)', '骨(gǔ)/骨(gū)'],
    },
    {
      chapterTitle: '第2课 荷花',
      bigConcept: '语言积累',
      name: '词语积累与运用',
      specificConcepts: [],
    },
    {
      chapterTitle: '第3课 桂花雨',
      name: '借物抒情', // 无具体概念
    },
  ];

  it('buildAnchorListByChapter：知识点名→具体概念映射随 themes 输出，同名锚概念合并去重', () => {
    const groups = buildAnchorListByChapter(withConcepts);
    expect(groups).toHaveLength(2);
    const lang = groups[0].themes[0];
    expect(lang.concepts['多音字辨析']).toEqual(['长(cháng)/长(zhǎng)', '种(zhǒng)/种(zhòng)', '骨(gǔ)/骨(gū)']);
    expect(lang.concepts['词语积累与运用']).toEqual([]);
    expect(groups[1].themes[0].concepts['借物抒情']).toEqual([]);
  });

  it('呈现形态：知识点名后括号附具体概念（紧凑），无概念的条目不带括号', () => {
    const out = formatAnchorListByChapter(withConcepts);
    expect(out).toBe(
      '【第2课 荷花】\n'
      + '· 语言积累：多音字辨析（长(cháng)/长(zhǎng)、种(zhǒng)/种(zhòng)、骨(gǔ)/骨(gū)）、词语积累与运用\n'
      + '【第3课 桂花雨】借物抒情',
    );
  });

  it('每知识点限量 MAX_SPECIFIC_CONCEPTS_PER_ANCHOR 条，超限加"等"（防清单膨胀）', () => {
    const anchors = [{
      chapterTitle: '第1课',
      name: '知识点A',
      specificConcepts: Array.from({ length: MAX_SPECIFIC_CONCEPTS_PER_ANCHOR + 3 }, (_, i) => `概念${i + 1}`),
    }];
    const out = formatAnchorListByChapter(anchors);
    expect(out).toBe(`【第1课】知识点A（概念1、概念2、概念3、概念4、概念5、概念6等）`);
  });

  it('空/非数组 specificConcepts 安全降级为无括号', () => {
    const anchors = [
      { chapterTitle: '第1课', name: '知识点A', specificConcepts: null },
      { chapterTitle: '第1课', name: '知识点B', specificConcepts: '不是数组' },
    ];
    expect(formatAnchorListByChapter(anchors)).toBe('【第1课】知识点A、知识点B');
  });

  it('无主题紧凑单行形态也带第3层括号（章级扁平合并）', () => {
    const anchors = [{ chapterTitle: '第1课', name: '知识点A', specificConcepts: ['甲', '乙'] }];
    expect(formatAnchorListByChapter(anchors)).toBe('【第1课】知识点A（甲、乙）');
  });

  it('角色说明随清单注入：第3层只细化具体概念，不是新栏目/新组织维度；措辞用「知识点」不用「考点」', () => {
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('具体概念');
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('（第3层');
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('不构成新的写作栏目');
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('不得据此另立结构');
    // 术语口径：注入文本去"考点"（防读成全指向考卷），且不含"命题靶点"式命题语汇
    expect(ANCHOR_LIST_ROLE_NOTE).not.toContain('考点');
    expect(ANCHOR_LIST_ROLE_NOTE).toContain('知识点');
    expect(ANCHOR_LIST_ROLE_NOTE).not.toContain('命题靶点');
  });
});
