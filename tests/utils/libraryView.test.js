// 教材库／模板库列表视图回归（2026-09-20 用户：列表要能按学段→学科折叠；列表与预览要能拖动调宽）
// ============================================================
// 覆盖：①「学段→学科」两级分组（含"未标注"兜底与顺序铁律）；②组头该不该显示的判据；
//       ③分栏宽度钳制（纯函数）；④「全部折叠」的组键展开。
// 🔴 两条最要紧的：**绝不丢书**（未标注组照常显示）、**组内顺序 = 入参顺序**（用户选的排序不能被分组打乱）。
import { describe, it, expect } from 'vitest';
import {
  groupLibrary, stageLabelOf, subjectLabelOf, needGroupHeader,
  UNSPECIFIED_STAGE, UNSPECIFIED_SUBJECT,
} from '../../src/utils/libraryGrouping.js';
import { clampPanelWidth, collapsedKeysOf, PANEL_MIN_WIDTH, PANEL_MIN_PREVIEW } from '../../src/composables/useLibraryView.js';

const book = (name, stage = '', subject = '') => ({ id: name, name, stage, subject });

describe('阶段/学科显示名（兼容旧英文键与五档键）', () => {
  it('stageLabelOf：空→未标注；旧英文键与五档键归一到中文；已中文原样', () => {
    expect(stageLabelOf('')).toBe(UNSPECIFIED_STAGE);
    expect(stageLabelOf(null)).toBe(UNSPECIFIED_STAGE);
    expect(stageLabelOf('  ')).toBe(UNSPECIFIED_STAGE);
    expect(stageLabelOf('primary')).toBe('小学');
    expect(stageLabelOf('middle')).toBe('初中');
    expect(stageLabelOf('high')).toBe('高中');
    expect(stageLabelOf('primary_high')).toBe('小学'); // 五档键
    expect(stageLabelOf('小学')).toBe('小学');
  });

  it('subjectLabelOf：空→未标注学科', () => {
    expect(subjectLabelOf('')).toBe(UNSPECIFIED_SUBJECT);
    expect(subjectLabelOf(undefined)).toBe(UNSPECIFIED_SUBJECT);
    expect(subjectLabelOf('数学')).toBe('数学');
  });
});

describe('groupLibrary：学段 → 学科 两级分组', () => {
  const items = [
    book('小学数学一年级上册', '小学', '数学'),
    book('小学语文一年级上册', '小学', '语文'),
    book('小学数学二年级上册', '小学', '数学'),
    book('初中物理八年级', '初中', '物理'),
    book('高二英语.pdf', 'high', '英语'),
    book('没标学段的一本', '', '数学'),
    book('没标学科的一本', '小学', ''),
  ];

  it('两级结构正确：组顺序（小学/初中/高中 → 未标注垫底）、计数守恒', () => {
    const groups = groupLibrary(items);
    expect(groups.map((g) => g.label)).toEqual(['小学', '初中', '高中', UNSPECIFIED_STAGE]);
    // 🔴 绝不丢书
    expect(groups.reduce((n, g) => n + g.count, 0)).toBe(items.length);
    // 学段计数 = 其下学科计数之和
    for (const g of groups) {
      expect(g.count).toBe(g.subjects.reduce((n, s) => n + s.count, 0));
    }
    const primary = groups.find((g) => g.label === '小学');
    expect(primary.count).toBe(4); // 数学×2 + 语文 + 没标学科的
  });

  it('🔴 组内顺序 = 入参顺序（用户选的排序不能被分组重排）', () => {
    const ordered = [
      book('C', '小学', '数学'),
      book('A', '小学', '数学'),
      book('B', '小学', '数学'),
    ];
    const math = groupLibrary(ordered).find((g) => g.label === '小学').subjects.find((s) => s.label === '数学');
    expect(math.items.map((b) => b.name)).toEqual(['C', 'A', 'B']);
  });

  it('学科缺失 → 「未标注学科」，且在该学段内垫底；学段缺失的书进「未标注学段」仍可见', () => {
    const groups = groupLibrary(items);
    const primary = groups.find((g) => g.label === '小学');
    expect(primary.subjects[primary.subjects.length - 1].label).toBe(UNSPECIFIED_SUBJECT);
    const unknown = groups[groups.length - 1];
    expect(unknown.label).toBe(UNSPECIFIED_STAGE);
    expect(unknown.count).toBe(1);
    expect(unknown.subjects[0].items[0].name).toBe('没标学段的一本');
  });

  it('组键：学段用自身、学科用「学段|学科」（共用一张折叠表且互不冲突）', () => {
    const groups = groupLibrary(items);
    const primary = groups.find((g) => g.label === '小学');
    expect(primary.key).toBe('小学');
    expect(primary.subjects.map((s) => s.key)).toEqual(['小学|数学', '小学|语文', `小学|${UNSPECIFIED_SUBJECT}`]);
  });

  it('空/异常输入 → 空数组（不抛错）', () => {
    expect(groupLibrary([])).toEqual([]);
    expect(groupLibrary(null)).toEqual([]);
    expect(groupLibrary([null, undefined])).toEqual([]);
  });
});

describe('needGroupHeader：只看"该维度有没有被显式筛选"，不看数据分成几组', () => {
  // 🔴 回归锁（2026-09-20 用户实测后定版）：第一版按"数据只有一组就隐藏该级"实现，结构会随数据变形——
  //    用户看到"教材库初高中下面没有分学科"（那几个学段恰好各只有 1 个学科）、
  //    "模板库直接就是学科、没有先按学段"（那些模板恰好全在一个学段），
  //    于是分不清"这级本来没有"还是"这级被藏了"。故判据改为**只看筛选值**。
  it('未筛选 → 一律显示组头（哪怕数据只分成一组）', () => {
    expect(needGroupHeader('')).toBe(true);
    expect(needGroupHeader(undefined)).toBe(true);
    expect(needGroupHeader(null)).toBe(true);
    expect(needGroupHeader('   ')).toBe(true);
  });

  it('该维度已被筛成单一值 → 隐藏该级组头（界面上那个下拉已写明当前值，不必再套壳）', () => {
    expect(needGroupHeader('小学')).toBe(false);
    expect(needGroupHeader('语文')).toBe(false);
  });
});

describe('clampPanelWidth：分栏宽度钳制（纯函数）', () => {
  it('区间内原样；低于下限取下限；超过"视口−预览下限"取上限', () => {
    expect(clampPanelWidth(500, { viewportWidth: 1400 })).toBe(500);
    expect(clampPanelWidth(100, { viewportWidth: 1400 })).toBe(PANEL_MIN_WIDTH);
    expect(clampPanelWidth(1200, { viewportWidth: 1400 })).toBe(1400 - PANEL_MIN_PREVIEW);
  });

  it('视口未知/为 0 → 只保下限，不设上限（不产生 NaN/负值）', () => {
    expect(clampPanelWidth(9999, { viewportWidth: 0 })).toBe(9999);
    expect(clampPanelWidth(NaN, { viewportWidth: 1400 })).toBe(PANEL_MIN_WIDTH);
    expect(clampPanelWidth(undefined, {})).toBe(PANEL_MIN_WIDTH);
  });

  it('视口过窄导致区间倒挂（min > max）→ 以 min 为准，绝不返回负值', () => {
    const v = clampPanelWidth(300, { min: 300, minPreview: 420, viewportWidth: 500 });
    expect(v).toBe(300);
    expect(v).toBeGreaterThan(0);
  });
});

describe('collapsedKeysOf：「全部折叠」的组键展开', () => {
  it('学段键 + 其下全部学科键', () => {
    const groups = [
      { key: '小学', subjects: [{ key: '小学|数学' }, { key: '小学|语文' }] },
      { key: '初中', subjects: [{ key: '初中|物理' }] },
    ];
    expect(collapsedKeysOf(groups)).toEqual(['小学', '小学|数学', '小学|语文', '初中', '初中|物理']);
    expect(collapsedKeysOf(null)).toEqual([]);
  });
});
