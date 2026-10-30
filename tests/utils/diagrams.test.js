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
import { buildMindmapSvg } from '../../src/utils/diagrams/mindmap.js';

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

  // 🔴 2026-10-30（属主定："左右两支这种可否取消？都用右支"）：思维导图只保留"向右生长"，
  //   历史内容里写的 `data-layout="balanced"` 也一律按 right 出图（老记录重画后版式一致、不再一边长一边短）。
  it('思维导图只有"向右生长"：显式写 balanced 也按 right 出图', () => {
    expect(MINDMAP_LAYOUTS.map((l) => l.value)).toEqual(['right']);
    const explicit = buildDiagramSvg({ ...SPECS.mindmap, layout: 'balanced' }, { fitWidth: 643 });
    const right = buildDiagramSvg({ ...SPECS.mindmap, layout: 'right' }, { fitWidth: 643 });
    const auto = buildDiagramSvg(SPECS.mindmap, { fitWidth: 643 });
    expect(explicit.layout).toBe('right');
    expect(auto.layout).toBe('right');
    expect(`${explicit.width}x${explicit.height}`).toBe(`${right.width}x${right.height}`);
    expect(`${auto.width}x${auto.height}`).toBe(`${right.width}x${right.height}`);
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

// 🔴 2026-10-30（属主："导图框都是长宽固定一样的，要的是导图框随内容的长短自适应的，
//   超过 A4 版面的时候才换行的"）：
//   ① 框宽由内容反推（不同长度的标签必须出不同宽度的框）；
//   ② 只有真超过版心（643）才折行——原折行上限"版心×0.38≈244"会让 20 字标签无谓折成两行、框宽被压齐。
describe('diagrams · 框随内容 / 只在超版心时折行', () => {
  const twoLeaves = {
    type: 'mindmap',
    layout: 'right',
    root: { title: '分数的意义', children: [{ title: '单位“1”' }, { title: '分子和分母同时乘或除以相同的数（0除外）' }] },
  };

  it('框宽随标签长度变化（不是固定长宽）', () => {
    const r = buildDiagramSvg(twoLeaves, { fitWidth: 643 });
    const leaves = r.nodes.filter((n) => n.depth === 1);
    const short = leaves.find((n) => n.title.length <= 5);
    const long = leaves.find((n) => n.title.length > 10);
    expect(short && long, '两个叶子都在').toBeTruthy();
    expect(long.w, '长标签的框必须更宽').toBeGreaterThan(short.w + 40);
    expect(long.lines.length, '长标签一行放得下（远小于版心）').toBe(1);
  });

  it('标签在版心内就一行（不提前折行），超版心才折行', () => {
    const fits = { type: 'mindmap', layout: 'right', root: { title: '根', children: [{ title: '分子和分母同时乘或除以相同的数（0除外）' }] } };
    const r1 = buildDiagramSvg(fits, { fitWidth: 643 });
    expect(r1.nodes.find((n) => n.depth === 1).lines.length).toBe(1);

    // 够长才超版心：用同一句重复到自然宽明显 > 643（实测约 11.4px/汉字）
    const tooLong = { type: 'mindmap', layout: 'right', root: { title: '根', children: [{ title: '超过A4版心宽度才折行的超长标签'.repeat(6) }] } };
    const r2 = buildDiagramSvg(tooLong, { fitWidth: 643 });
    const leaf = r2.nodes.find((n) => n.depth === 1);
    expect(leaf.lines.length, '超版心才折行').toBeGreaterThan(1);
    expect(r2.width, '折行后整幅仍在版心内').toBeLessThanOrEqual(643);
  });

  // 🔴 2026-10-30（属主："不要弄人为的计算那么繁琐，交给内容本身；框只是加在内容上的"）：
  //   折行宽不再有"150px""版心×0.38""二分十几次"这些人为口径——判据只剩一条：
  //   **这一支还剩多少宽**。放得下就一行，放不下才折。
  it('自然宽已超旧口径 150px、但这一支放得下 ⇒ 仍是一行（无 150 阈值）', () => {
    const t = { type: 'mindmap', layout: 'right', root: { title: '根', children: [{ title: '分子和分母同时乘或除以相同的数（0除外）' }] } };
    const leaf = buildDiagramSvg(t, { fitWidth: 643 }).nodes.find((n) => n.depth === 1);
    expect(leaf.w - 2 * leaf.padX, '自然宽应大于 150（否则本条无意义）').toBeGreaterThan(150);
    expect(leaf.lines.length, '版心放得下就不折').toBe(1);
  });

  it('整幅超版心时只收折行宽、字号不变（不靠缩放/不靠固定阈值）', () => {
    const mk = (t, d) => (d ? { title: t, children: [mk(`${t}甲`, d - 1), mk(`${t}乙`, d - 1)] } : { title: t });
    const root = mk('三要素：定义域、值域与对应法则', 3);
    const open = buildDiagramSvg({ type: 'mindmap', root }, {});
    const fitted = buildDiagramSvg({ type: 'mindmap', root }, { fitWidth: 643 });
    expect(fitted.width, `实际 ${fitted.width}px`).toBeLessThanOrEqual(643 + 12); // 12px 容差＝总装层口径
    expect(fitted.width, '确实收窄过（否则本条无意义）').toBeLessThan(open.width);
    const fsOf = (r) => (r.nodes.find((n) => n.isRoot) || {}).fs;
    expect(fsOf(fitted), '字号不变（缩的是折行宽）').toBe(fsOf(open));
  });

  // 🔴 2026-10-30（属主："左右两支这种可否取消？都用右支"）：不再出现左右两支，
  //   全部节点都在同一侧（side=1）——"一侧过长一侧过短"的问题从版式上消除。
  it('不再出现左右两支：所有节点在同一侧', () => {
    const asym = {
      type: 'mindmap',
      root: { title: '单元知识梳理', children: [
        { title: '小分支', children: [{ title: '一点' }] },
        { title: '大分支一', children: [{ title: '甲' }, { title: '乙' }, { title: '丙' }] },
        { title: '大分支二', children: [{ title: '丁' }, { title: '戊' }, { title: '己' }] },
        { title: '大分支三', children: [{ title: '庚' }, { title: '辛' }, { title: '壬' }] },
      ] },
    };
    const r = buildDiagramSvg(asym, { fitWidth: 643 });
    expect(r.layout).toBe('right');
    expect(r.nodes.filter((n) => n.side === -1), '不应有左侧节点').toHaveLength(0);
    expect(r.nodes.filter((n) => n.side === 1).length).toBeGreaterThan(0);
  });
});

// 🔴 2026-10-30（属主："排版模块里预览还是存在不该折行的折行了"·根因守卫）：
//   折行宽若用 `Math.round` 取整，自然宽 124.4px 会被取成 124 ⇒ "自然宽 ≤ 折行宽"的判据不成立 ⇒
//   **每一处小数 ≥0.5 的标签都被白折一行**（末行只落一两个字），且与版心宽窄无关（fitWidth=0 也照折）。
//   这里用"必然产生小数"的 measurer 钉住 ceil 口径，防止再改回去。
describe('diagrams · 折行宽取整（放得下就必须一行）', () => {
  // 每字 = 字号 + 0.4px（带小数），8 字根节点自然宽 120.4、8 字一级枝节 104.4
  const fracMeasurer = (text, fontSize) => String(text).length * fontSize + 0.4;

  it('根节点自然宽带小数（120.4px）⇒ 仍是一行（不许 round 掉 0.4 就折）', () => {
    const spec = { type: 'mindmap', root: { title: '分数的意义和性质' } };
    const root = buildDiagramSvg(spec, { measurer: fracMeasurer }).nodes.find((n) => n.isRoot);
    expect(root.lines.length, '放得下必须一行').toBe(1);
  });

  it('一级枝节同理：自然宽 104.4px 在版心里 ⇒ 一行（不折成"……和性／质"）', () => {
    const spec = { type: 'mindmap', root: { title: '根', children: [{ title: '分数的意义和性质' }] } };
    const leaf = buildDiagramSvg(spec, { measurer: fracMeasurer, fitWidth: 643 }).nodes.find((n) => n.depth === 1);
    expect(leaf.lines.length, '放得下必须一行').toBe(1);
  });
});

// 🔴 2026-10-30（属主："可否不是等比让，是让最左侧的先让" ＋ "让到什么程度是合适的…要注意排版的美观"）：
//   一支放不下时谁让位，两种口径——
//     · 'left'（默认）：最左侧先让，让到"本框仍能保持 L 行（L≤2）"为止 ⇒ 最右侧的叶子保住自然宽、散开；
//     · 'proportional'：按自然宽等比 ⇒ 每框行数均匀。
//   总装层两种都排一遍取**更矮**的（矮＝更紧凑），一样高时用 'left'（叶子更舒展）。
describe('diagrams · 让位口径（左侧先让 / 等比 / 择优）', () => {
  const L = '阅读理解策略的第四个层级说明文字';
  const chain = (d) => (d === 0 ? { title: L } : { title: L, children: [chain(d - 1)] });
  const root = { title: '第二单元 阅读策略', children: [{ title: '一、阅读要有一定的速度', children: [chain(1)] }] };
  const leafOf = (r) => r.nodes.reduce((a, b) => (b.depth > a.depth ? b : a));
  const build = (fairShare) => buildMindmapSvg(root, { fitWidth: 643, layout: 'right', fairShare });

  it('左先让：最深叶子比等比口径更宽（叶子散开、不被压成柱子）', () => {
    const left = build('left');
    const prop = build('proportional');
    expect(leafOf(left).w, '叶子必须更宽').toBeGreaterThan(leafOf(prop).w);
    expect(leafOf(left).w, '叶子至少能保住常规宽度').toBeGreaterThan(90);
  });

  it('左先让：让位止于"本框仍能保持 L 行（≤2 行）"，不出现 3 行以上的窄柱', () => {
    const left = build('left');
    const over = left.nodes.filter((n) => n.depth < 2 && n.lines.length > 2);
    expect(over.map((n) => `${n.title}(${n.lines.length}行)`), '靠左的框最多 2 行').toEqual([]);
  });

  it('总装层择优：取两种口径里更矮的那个，且不超版心', () => {
    const auto = buildDiagramSvg({ type: 'mindmap', root }, { fitWidth: 643 });
    const left = build('left');
    const prop = build('proportional');
    expect(auto.height, '必须是两者中更矮的').toBe(Math.min(left.height, prop.height));
    expect(auto.width, '仍不超版心（12px 容差）').toBeLessThanOrEqual(643 + 12);
  });

  it('本来就放得下时三种口径完全一致（不因这条改动而集体重排）', () => {
    const short = { title: '分数的意义', children: [{ title: '约分' }, { title: '通分' }] };
    const a = buildMindmapSvg(short, { fitWidth: 643, layout: 'right', fairShare: 'left' });
    const b = buildMindmapSvg(short, { fitWidth: 643, layout: 'right', fairShare: 'proportional' });
    const c = buildMindmapSvg(short, { fitWidth: 643, layout: 'right', fairShare: false });
    expect(`${a.width}x${a.height}`).toBe(`${b.width}x${b.height}`);
    expect(`${a.width}x${a.height}`).toBe(`${c.width}x${c.height}`);
    expect(a.nodes.every((n) => n.lines.length === 1), '短标签一律一行').toBe(true);
  });

  // 🔴 2026-10-30（属主："左先让了，紧接着的第二层叶子为啥不让，就直接用第三层叶子让了？"）：
  //   让位是**按层级从左往右**的：够长的框先在自己这一层折行；**短框（≤4 字）没有可让的宽度**
  //   （再让就只剩两个字一行），才轮到下一层。这里把两种情形都钉住，防"乱序让位"回潮。
  it('让位次序：够长的父框必定先折，然后才轮到更深的那层', () => {
    const longParent = {
      title: '第二单元 阅读策略要点',
      children: [{
        title: '一、阅读速度训练',
        children: [{ title: '集中注意力不回读，连词成句地读，抓住关键词句和段落大意', children: [{ title: '用手指或笔尖辅助视线移动逐步扩大视域' }] }],
      }],
    };
    const r = buildMindmapSvg(longParent, { fitWidth: 643, layout: 'right', fairShare: 'left' });
    const [root, lv1, lv2] = [r.nodes[0], r.nodes[1], r.nodes[2]];
    expect(root.isRoot && lv1.depth === 1, '结构如预期').toBe(true);
    expect(root.lines.length, '根先让（折行）').toBeGreaterThan(1);
    expect(lv1.lines.length, '紧接着的第二层也先让').toBeGreaterThan(1);
    expect(lv1.lines.length, '第二层不能比第三层折得更多（乱序）').toBeLessThanOrEqual(lv2.lines.length);
  });

  it('第二层是短框（≤4 字）时跳过它、由下一层让——短框本来就没有可让的宽度', () => {
    const shortParent = {
      title: '第二单元 阅读策略',
      children: [{
        title: '一、速度',
        children: [{ title: '集中注意力，不回读，遇到不懂的词语不要停下来，不要回读，连词成句地读', children: [{ title: '用手指或笔尖辅助视线移动，逐步扩大视域' }] }],
      }],
    };
    const r = buildMindmapSvg(shortParent, { fitWidth: 643, layout: 'right', fairShare: 'left' });
    const lv1 = r.nodes[1];
    const lv2 = r.nodes[2];
    expect(lv1.title).toBe('一、速度');
    expect(lv1.lines.length, '短框保持一行（让不动）').toBe(1);
    expect(lv2.lines.length, '缺口落到下一条长框上').toBeGreaterThan(1);
    expect(lv1.w, '短框没有被压到无法阅读').toBeGreaterThanOrEqual(60);
  });
});

// 🔴 2026-10-30（属主："折行考虑内容折行后的美观性"）：贪心折行会折成"几乎一整行 + 末尾一个字"，
//   现在折完会**回填到刚好放下这几行的宽度**再折一次（各行长度均匀、框也跟着变窄）。
describe('diagrams · 折行后的美观', () => {
  it('不出现"结尾只剩一个字"的行（22 字要点折 2 行时各行都够长）', () => {
    const spec = { type: 'mindmap', root: { title: '习作', children: [{ title: '二、习作：漫画的启示，先写清漫画内容再写思考' }] } };
    const leaf = buildDiagramSvg(spec, { fitWidth: 420 }).nodes.find((n) => n.depth === 1);
    expect(leaf.lines.length, '确实折了').toBeGreaterThan(1);
    expect(leaf.lines.every((l) => l.length >= 3), JSON.stringify(leaf.lines)).toBe(true);
  });

  it('折行后的各行长度差不超过 3 个字（不出现一大行配一小行）', () => {
    const spec = { type: 'mindmap', root: { title: '阅读', children: [{ title: '集中注意力，不回读，连词成句地读，抓住关键词句和段落大意' }] } };
    const leaf = buildDiagramSvg(spec, { fitWidth: 380 }).nodes.find((n) => n.depth === 1);
    const lens = leaf.lines.map((l) => l.length);
    expect(Math.max(...lens) - Math.min(...lens)).toBeLessThanOrEqual(3);
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
