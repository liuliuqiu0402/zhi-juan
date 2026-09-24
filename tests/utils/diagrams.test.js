/**
 * 🧭 导图族统一入口单测
 * ============================================================
 * 上一层的守卫：各图种自身的几何已由各自单测保证，这里只守"总装"不出错 ——
 *   类型分发、未知类型回落、版式开关、SVG 无 NaN/undefined、Word 光栅化在无 DOM 环境的安全降级。
 * 其中 **NaN 巡检** 最便宜也最有用：任何一个图种把坐标算坏（漏赋值/除零/NaN 传染），
 * 出图字符串里立刻会出现 "NaN"，一条断言就能抓住。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { DIAGRAM_TYPES, MINDMAP_LAYOUTS, buildDiagramSvg, diagramToPngDataUrl } from '../../src/utils/diagrams/index.js';

const SPECS = {
  mindmap: {
    type: 'mindmap',
    root: {
      title: '函数的概念与性质',
      children: [
        { title: '函数的概念', children: [{ title: '三要素' }, { title: '表示法' }] },
        { title: '单调性', children: [{ title: '增函数' }, { title: '减函数' }] },
        { title: '奇偶性' },
      ],
    },
  },
  brace: {
    type: 'brace',
    title: '细胞的结构',
    children: [
      { title: '细胞膜', children: [{ title: '控制物质进出' }, { title: '进行细胞间信息交流' }] },
      { title: '细胞质', children: [{ title: '细胞质基质' }, { title: '细胞器' }] },
      { title: '细胞核' },
    ],
  },
  flow: {
    type: 'flow',
    steps: [
      { text: '开始', kind: 'start' },
      { text: '读取题目条件', kind: 'process' },
      { text: '能否用基本不等式？', kind: 'decision', branches: [
        { label: '能', steps: [{ text: '凑定值后求最值' }] },
        { label: '不能', steps: [{ text: '换元或配方法' }] },
      ] },
      { text: '检验等号成立条件', kind: 'process' },
      { text: '结束', kind: 'end' },
    ],
  },
  timeline: {
    type: 'timeline',
    items: [
      { when: '1919年5月', text: '五四运动爆发', detail: '新民主主义革命开端' },
      { when: '1921年7月', text: '中国共产党成立' },
      { when: '1949年10月', text: '中华人民共和国成立' },
    ],
  },
  fishbone: {
    type: 'fishbone',
    effect: '实验误差偏大',
    categories: [
      { name: '人', causes: ['读数不规范', '操作不熟练'] },
      { name: '机', causes: ['仪器未校准'] },
      { name: '料', causes: ['试剂变质'] },
      { name: '法', causes: ['步骤漏项'] },
    ],
  },
  concept: {
    type: 'concept',
    center: 'A',
    nodes: [
      { id: 'A', text: '函数' },
      { id: 'B', text: '定义域' },
      { id: 'C', text: '值域' },
      { id: 'D', text: '对应法则' },
      { id: 'E', text: '单调性' },
    ],
    links: [
      { from: 'A', to: 'B', label: '有' },
      { from: 'A', to: 'C', label: '有' },
      { from: 'A', to: 'D', label: '有' },
      { from: 'E', to: 'A', label: '研究' },
    ],
  },
};

describe('diagrams · 类型分发', () => {
  it('图种清单覆盖 6 类（导图族），且都能真的出图', () => {
    expect(DIAGRAM_TYPES.map((t) => t.value)).toEqual([
      'mindmap', 'brace', 'flow', 'timeline', 'fishbone', 'concept',
    ]);
    for (const t of DIAGRAM_TYPES) {
      const spec = SPECS[t.value];
      const r = buildDiagramSvg(spec);
      expect(r.type, `${t.value} 分发类型`).toBe(t.value);
      expect(Number.isInteger(r.width) && r.width > 0, `${t.value} 宽`).toBe(true);
      expect(Number.isInteger(r.height) && r.height > 0, `${t.value} 高`).toBe(true);
      expect(r.svg.startsWith('<svg '), `${t.value} svg 起头`).toBe(true);
      expect(r.svg.trimEnd().endsWith('</svg>'), `${t.value} svg 收尾`).toBe(true);
      expect(r.nodes.length, `${t.value} 节点数`).toBeGreaterThan(0);
    }
  });

  it('六种图的出图字符串里都不得出现 NaN / undefined（坐标算坏的兜底巡检）', () => {
    for (const t of DIAGRAM_TYPES) {
      const { svg } = buildDiagramSvg(SPECS[t.value]);
      expect(/NaN/.test(svg), `${t.value} 出现 NaN`).toBe(false);
      expect(/undefined/.test(svg), `${t.value} 出现 undefined`).toBe(false);
      expect(/\bnull\b/.test(svg), `${t.value} 出现 null`).toBe(false);
    }
  });

  it('未知 / 缺失 type 回落思维导图（宁可有图，不可空着）', () => {
    expect(buildDiagramSvg({ type: '不存在的图' }).type).toBe('mindmap');
    expect(buildDiagramSvg({}).type).toBe('mindmap');
    expect(buildDiagramSvg(null).type).toBe('mindmap');
  });

  it('思维导图支持两种版式，且版式真的换了样（尺寸不同）', () => {
    expect(MINDMAP_LAYOUTS.map((l) => l.value)).toEqual(['balanced', 'right']);
    const a = buildDiagramSvg({ ...SPECS.mindmap, layout: 'balanced' });
    const b = buildDiagramSvg({ ...SPECS.mindmap, layout: 'right' });
    expect(`${a.width}x${a.height}`).not.toBe(`${b.width}x${b.height}`);
    // 不传 layout 时默认左右分布
    expect(`${buildDiagramSvg(SPECS.mindmap).width}x${buildDiagramSvg(SPECS.mindmap).height}`)
      .toBe(`${a.width}x${a.height}`);
  });

  it('可以直接把树传给 mindmap（允许 spec 不带 root 包裹）', () => {
    const r = buildDiagramSvg({ type: 'mindmap', title: '根', children: [{ title: '叶' }] });
    expect(r.svg).toContain('>叶<');
  });

  it('尺寸不合法/空数据不抛错，仍返回正尺寸画布', () => {
    for (const spec of [{ type: 'brace' }, { type: 'flow' }, { type: 'timeline' }, { type: 'fishbone' }, { type: 'concept' }]) {
      const r = buildDiagramSvg(spec);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    }
  });
});

describe('diagrams · Word 通道光栅化', () => {
  it('环境不支持时安全降级为 null（不抛错、不挂死）', async () => {
    const { svg } = buildDiagramSvg(SPECS.mindmap);
    // jsdom 里 Image 不会真的解码 dataURL（onload/onerror 都不触发）→ 靠自带超时兜底，
    // 生产环境同理：宁可不插图，也绝不能让导出流程无限挂住。
    await expect(diagramToPngDataUrl(svg, { timeoutMs: 60 })).resolves.toBeNull();
  });
});
