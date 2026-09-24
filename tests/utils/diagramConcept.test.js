/**
 * 🕸 概念关系图 SVG：版式硬指标单测
 * ============================================================
 * 为什么断言"不重叠 / 不越界 / 端点在框边界上 / 文字不丢 / 线数对得上"而不是对 SVG 做快照：
 *   概念关系图的质量问题几乎都是**版式病**（环上框叠在一起、连线穿过框内部、标注把字压没、
 *   文字被折行截断、半径自适应没生效导致框挤在一起），字符串快照既守不住这些，又会在任何
 *   配色/字号微调时全红。这里直接对 layoutConcept 算出的几何做断言。
 * 口径与 tests/utils/diagramBrace.test.js / diagramTimeline.test.js 一致。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { layoutConcept, buildConceptSvg, estimateTextWidth } from '../../src/utils/diagrams/concept.js';
import { boxesOverlap } from '../../src/utils/diagrams/shared.js';

/** 一份**真实体量**的高中生物概念关系图（细胞的结构与功能，13 概念 / 13 条关系） */
const SAMPLE = {
  center: '细胞',
  nodes: [
    { id: 'cell', text: '细胞' },
    { id: 'membrane', text: '细胞膜' },
    { id: 'cyto', text: '细胞质' },
    { id: 'nucleus', text: '细胞核' },
    { id: 'mito', text: '线粒体' },
    { id: 'ribo', text: '核糖体' },
    { id: 'er', text: '内质网' },
    { id: 'golgi', text: '高尔基体' },
    { id: 'chloro', text: '叶绿体' },
    { id: 'vacuole', text: '液泡' },
    { id: 'nucMem', text: '核膜' },
    { id: 'nucleolus', text: '核仁' },
    { id: 'chromatin', text: '染色质' },
  ],
  links: [
    { from: 'membrane', to: 'cell', label: '边界' },
    { from: 'cyto', to: 'cell', label: '含' },
    { from: 'nucleus', to: 'cell', label: '控制中心' },
    { from: 'mito', to: 'cyto', label: '供能' },
    { from: 'ribo', to: 'cyto', label: '合成' },
    { from: 'er', to: 'cyto', label: '运输' },
    { from: 'golgi', to: 'cyto', label: '加工' },
    { from: 'chloro', to: 'cyto', label: '光合' },
    { from: 'vacuole', to: 'cyto', label: '贮存' },
    { from: 'nucMem', to: 'nucleus', label: '包裹' },
    { from: 'nucleolus', to: 'nucleus', label: '含' },
    { from: 'chromatin', to: 'nucleus', label: '含' },
    { from: 'membrane', to: 'cyto' },
  ],
};

const solid = (v) => String(v == null ? '' : v).replace(/\s+/g, '');
const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
/** 点是否**严格位于**框内部（内缩 inset），用来验证连线端点没穿进框里 */
const strictlyInside = (pt, box, inset = 0.5) =>
  pt.x > box.x + inset && pt.x < box.x + box.w - inset
  && pt.y > box.y + inset && pt.y < box.y + box.h - inset;
const byTitle = (nodes, t) => nodes.find((n) => n.title === t);

describe('diagramConcept · 版式硬指标', () => {
  const layout = layoutConcept(SAMPLE);
  const { nodes, links, width, height, metrics } = layout;

  it('① 宽高为正有限整数，且每个节点框都落在 [0,width]×[0,height] 内', () => {
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(nodes.length).toBe(SAMPLE.nodes.length);
    for (const n of nodes) {
      expect(n.x, `「${n.title}」x 越界`).toBeGreaterThanOrEqual(0);
      expect(n.y, `「${n.title}」y 越界`).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w, `「${n.title}」右边越界`).toBeLessThanOrEqual(width);
      expect(n.y + n.h, `「${n.title}」下边越界`).toBeLessThanOrEqual(height);
    }
  });

  it('② 节点框两两不重叠（boxesOverlap 全为 false）', () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(
          boxesOverlap(nodes[i], nodes[j]),
          `「${nodes[i].title}」与「${nodes[j].title}」重叠 ${overlapArea(nodes[i], nodes[j])} px²`,
        ).toBe(false);
      }
    }
  });

  it('③ 标题文字不丢：折行拼接是 title 的前缀（仅允许末尾 … 截断）', () => {
    for (const n of nodes) {
      const joined = solid(n.lines.join('').replace(/…$/, ''));
      expect(solid(n.title).startsWith(joined), `「${n.title}」被渲染成「${n.lines.join('/')}」`).toBe(true);
      if (!n.lines.join('').includes('…')) expect(solid(n.title)).toBe(joined);
    }
  });

  it('③+ 框宽由实测文字宽度反推：最长行文字不越出框', () => {
    for (const n of nodes) {
      const tw = Math.max(...n.lines.map((l) => estimateTextWidth(l, n.fs)));
      expect(n.w, `「${n.title}」框太窄`).toBeGreaterThanOrEqual(Math.round(tw + metrics.padX * 2) - 1);
      expect(n.h).toBeGreaterThanOrEqual(n.lines.length * metrics.lineH + metrics.padY * 2 - 1);
    }
  });

  it('节点契约字段齐全：{ id, title, x, y, w, h, lines }，且恰好一个中心节点', () => {
    for (const n of nodes) {
      expect(typeof n.id).toBe('string');
      expect(typeof n.title).toBe('string');
      expect(Array.isArray(n.lines)).toBe(true);
      for (const k of ['x', 'y', 'w', 'h']) expect(Number.isFinite(n[k])).toBe(true);
    }
    expect(nodes.filter((n) => n.isCenter).length).toBe(1);
    expect(nodes[metrics.centerIndex].isCenter).toBe(true);
  });

  it('中心节点：center 用 text 命中（id 是 cell，传的是「细胞」），其余节点都在环上', () => {
    expect(metrics.centerIndex).toBe(0);
    expect(nodes[0].title).toBe('细胞');
    const ring = nodes.filter((n) => !n.isCenter);
    expect(ring.length).toBe(nodes.length - 1);
    const idx = ring.map((n) => n.ringIndex).sort((a, b) => a - b);
    expect(idx).toEqual(ring.map((_, i) => i));   // 环序号是 0..n-1 的一个排列
  });

  it('环上排序：与中心相连的邻居依次排列，且每个邻居的卫星节点紧挨其后', () => {
    // 邻居（与中心直接相连）：细胞膜、细胞质、细胞核 → 按原始索引递增出现
    const nbPos = ['细胞膜', '细胞质', '细胞核'].map((t) => byTitle(nodes, t).ringIndex);
    expect(nbPos).toEqual([...nbPos].sort((a, b) => a - b));
    // 卫星紧挨其后：细胞质 → 线粒体/核糖体/…；细胞核 → 核膜/核仁/染色质
    expect(byTitle(nodes, '线粒体').ringIndex).toBe(byTitle(nodes, '细胞质').ringIndex + 1);
    expect(byTitle(nodes, '核仁').ringIndex).toBe(byTitle(nodes, '细胞核').ringIndex + 2);
    expect(byTitle(nodes, '染色质').ringIndex).toBe(byTitle(nodes, '细胞核').ringIndex + 3);
  });

  it('验收：同一环上相邻节点（含首尾相接）的框不重叠', () => {
    const ring = nodes.filter((n) => !n.isCenter).sort((a, b) => a.ringIndex - b.ringIndex);
    expect(ring.length).toBeGreaterThan(2);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      expect(
        boxesOverlap(a, b),
        `环上相邻的「${a.title}」与「${b.title}」重叠 ${overlapArea(a, b)} px²`,
      ).toBe(false);
    }
  });

  it('半径自适应：radius = r0 × 1.12^迭代次数，迭代次数在 [0,24] 内', () => {
    const r0 = Math.max(metrics.radiusMin, metrics.ringCount * metrics.radiusPerNode);
    expect(metrics.radiusIterations).toBeGreaterThanOrEqual(0);
    expect(metrics.radiusIterations).toBeLessThanOrEqual(24);
    expect(metrics.radius).toBeGreaterThanOrEqual(r0);
    expect(metrics.radius).toBeCloseTo(r0 * Math.pow(metrics.radiusGrow, metrics.radiusIterations), 6);
  });

  it('验收：每条 link 都算出了几何（有效连边数 = 可解析且非自环的 link 数）', () => {
    // 本样例里 13 条 link 全部可解析（id 命中）且无自环
    expect(links.length).toBe(SAMPLE.links.length);
    expect(metrics.linkCount).toBe(links.length);
    for (const l of links) {
      expect(Number.isFinite(l.x1)).toBe(true);
      expect(Number.isFinite(l.y1)).toBe(true);
      expect(Number.isFinite(l.x2)).toBe(true);
      expect(Number.isFinite(l.y2)).toBe(true);
      expect(l.from).not.toBe(l.to);
      expect(Number.isFinite(l.midX)).toBe(true);
      expect(Number.isFinite(l.midY)).toBe(true);
    }
  });

  it('验收：连线端点落在框边界上（不穿进框内部），且确实贴着框', () => {
    for (const l of links) {
      const a = nodes[l.from];
      const b = nodes[l.to];
      expect(strictlyInside({ x: l.x1, y: l.y1 }, a), `端点穿进「${a.title}」内部`).toBe(false);
      expect(strictlyInside({ x: l.x2, y: l.y2 }, b), `端点穿进「${b.title}」内部`).toBe(false);
      for (const [pt, box] of [[{ x: l.x1, y: l.y1 }, a], [{ x: l.x2, y: l.y2 }, b]]) {
        expect(pt.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(pt.x).toBeLessThanOrEqual(box.x + box.w + 1);
        expect(pt.y).toBeGreaterThanOrEqual(box.y - 1);
        expect(pt.y).toBeLessThanOrEqual(box.y + box.h + 1);
      }
    }
  });

  it('有一条无 label 的连边（标注是可选的，不应崩）', () => {
    expect(links.some((l) => !l.hasLabel)).toBe(true);
    expect(links.filter((l) => l.hasLabel).length).toBe(SAMPLE.links.length - 1);
  });
});

describe('diagramConcept · 中心节点选取', () => {
  it('缺省取连边最多的节点（并列取第一个）', () => {
    const spec = {
      nodes: [{ text: '甲' }, { text: '乙' }, { text: '丙' }, { text: '丁' }],
      links: [
        { from: '乙', to: '丙' },
        { from: '乙', to: '丁' },
        { from: '甲', to: '乙' },
      ],
    };
    const { nodes, metrics } = layoutConcept(spec);
    expect(metrics.centerIndex).toBe(1);            // 乙 的连边最多（3 条）
    expect(nodes[1].title).toBe('乙');
    expect(nodes[1].isCenter).toBe(true);
    expect(nodes[1].degree).toBe(3);
  });

  it('center 指定优于"连边最多"，且可按 id 命中', () => {
    const spec = {
      center: 'b',
      nodes: [{ id: 'a', text: '甲' }, { id: 'b', text: '乙' }, { id: 'c', text: '丙' }],
      links: [{ from: 'a', to: 'c' }, { from: 'a', to: 'b' }],
    };
    const { metrics, nodes } = layoutConcept(spec);
    expect(metrics.centerIndex).toBe(1);            // a 连边最多也不动摇 center
    expect(metrics.centerId).toBe('b');
    expect(nodes[1].isCenter).toBe(true);
  });
});

describe('diagramConcept · 出图', () => {
  it('④ SVG 结构：尺寸/viewBox 与版式一致，白底，闭合，无 DOCTYPE/<?xml>', () => {
    const { svg, width, height } = buildConceptSvg(SAMPLE);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`height="${height}"`);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('<?xml');
    expect(svg).not.toContain('<!DOCTYPE');
    // 印刷约定：无位图/滤镜/渐变/外链
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('filter=');
    expect(svg).not.toContain('url(');
    expect(svg).not.toContain('linearGradient');
  });

  it('验收：每条 link 都画出了线（<line> 条数 = 有效 link 数），样式为 1.4px / opacity .8', () => {
    const { svg, links } = buildConceptSvg(SAMPLE);
    expect((svg.match(/<line /g) || []).length).toBe(links.length);
    expect((svg.match(/stroke-width="1\.4"/g) || []).length).toBe(links.length);
    expect((svg.match(/opacity="0\.8"/g) || []).length).toBe(links.length);
  });

  it('节点形状：rx=8、白底、1.3px 边框；每个节点一行文字都进了 <text>', () => {
    const { svg, nodes } = buildConceptSvg(SAMPLE);
    expect((svg.match(/rx="8"/g) || []).length).toBe(nodes.length);
    expect((svg.match(/stroke-width="1\.3"/g) || []).length).toBe(nodes.length);
    for (const n of nodes) {
      for (const line of n.lines) expect(svg).toContain(`>${line}<`);
      expect(svg).toContain(`stroke="${n.color}"`);
    }
    // 中心节点字重 600（黑白打印时的层级表达），外围 400
    expect(svg).toContain('font-weight="600"');
    expect(svg).toContain('font-weight="400"');
  });

  it('验收：label 文字出现在 SVG 里，且文字下垫了白底矩形', () => {
    const { svg, links } = buildConceptSvg(SAMPLE);
    for (const l of links) {
      if (!l.hasLabel) continue;
      expect(svg, `标注「${l.label}」没出现在 SVG 里`).toContain(`>${l.label}<`);
    }
    // 白底矩形 = 画布底 + 每个节点框 + 每个标注底
    const labeled = links.filter((l) => l.hasLabel).length;
    expect((svg.match(/fill="#ffffff"/g) || []).length).toBe(1 + links.length + labeled);
  });

  it('④ 特殊字符被转义，文本节点里无裸的 < / >', () => {
    const { svg } = buildConceptSvg({
      nodes: [{ text: 'a<b & "c"' }, { text: "x > y & z's" }, { text: '普通' }],
      links: [
        { from: 'a<b & "c"', to: '普通', label: 'p<q & "r"' },
        { from: "x > y & z's", to: '普通', label: '属于' },
      ],
    });
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;');
    expect(svg).toContain('x &gt; y &amp; z&apos;s');
    expect(svg).toContain('p&lt;q &amp; &quot;r&quot;');
    const texts = svg.match(/<text[^>]*>[^<]*<\/text>/g) || [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      const body = t.replace(/^<text[^>]*>/, '').replace(/<\/text>$/, '');
      expect(/[<>]/.test(body), `text 内容里有未转义的尖括号：${body}`).toBe(false);
    }
  });

  it('⑤ 确定性：同样输入两次输出完全一致', () => {
    expect(buildConceptSvg(SAMPLE).svg).toBe(buildConceptSvg(SAMPLE).svg);
    expect(layoutConcept(SAMPLE)).toEqual(layoutConcept(SAMPLE));
  });

  it('支持 labelTransform（公式线性化钩子，见 mindmap.js）', () => {
    const { svg } = buildConceptSvg(
      { nodes: [{ text: '$x^2$' }, { text: '抛物线' }], links: [{ from: '$x^2$', to: '抛物线', label: '$y=x^2$' }] },
      { labelTransform: (s) => String(s).replace(/\$([^$]+)\$/g, '$1') },
    );
    expect(svg).toContain('x^2');
    expect(svg).toContain('y=x^2');
    expect(svg).not.toContain('$');
  });
});

describe('diagramConcept · 边界与健壮性', () => {
  it('⑥ 空 / 单元素输入不崩，尺寸仍为正', () => {
    const cases = [
      null,
      undefined,
      {},
      { nodes: [] },
      { links: [{ from: 'x', to: 'y' }] },
      { nodes: [{ text: '只有一个概念' }] },
      { nodes: ['字符串节点'] },
      { nodes: [{}] },
      { nodes: [{ id: 'A' }] },
    ];
    for (const spec of cases) {
      const r = buildConceptSvg(spec);
      expect(Number.isInteger(r.width)).toBe(true);
      expect(Number.isInteger(r.height)).toBe(true);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.svg).toContain('</svg>');
      expect(r.svg).toContain('fill="#ffffff"');
      for (const n of r.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeGreaterThanOrEqual(0);
        expect(n.x + n.w).toBeLessThanOrEqual(r.width);
        expect(n.y + n.h).toBeLessThanOrEqual(r.height);
      }
      for (let i = 0; i < r.nodes.length; i++) {
        for (let j = i + 1; j < r.nodes.length; j++) {
          expect(boxesOverlap(r.nodes[i], r.nodes[j])).toBe(false);
        }
      }
    }
  });

  it('⑥ 单元素：唯一概念就是中心节点，画布比框大', () => {
    const { nodes, width, height, metrics } = layoutConcept({ nodes: [{ text: '唯一的中心' }] });
    expect(nodes.length).toBe(1);
    expect(nodes[0].isCenter).toBe(true);
    expect(metrics.ringCount).toBe(0);
    expect(width).toBeGreaterThan(nodes[0].w);
    expect(height).toBeGreaterThan(nodes[0].h);
  });

  it('脏输入：悬空引用 / 自环 / 数字索引 / 缺失字段都被安全处理，有效连边数正确', () => {
    const DIRTY = {
      nodes: [
        { text: '甲' },
        { id: 'b', text: '乙' },
        { id: 'b', text: '乙重复' },   // id 重复：按 id 命中第一个
        {},                             // 空节点
        '戊',                           // 字符串节点
      ],
      links: [
        { from: '不存在', to: '甲' },   // 悬空 → 丢弃
        { from: '甲', to: '甲' },       // 自环 → 丢弃
        { from: 'b', to: '甲' },        // id 命中 → 索引 1 → 0
        { from: 1, to: 4 },             // 索引命中 → 1 → 4
        { from: null, to: '甲' },       // 丢弃
        null,                           // 丢弃
        { from: '甲' },                 // to 缺失 → 丢弃
      ],
      center: '不存在的中心',           // 无命中 → 回落"连边最多"
    };
    const { nodes, links, width, height, metrics } = layoutConcept(DIRTY);
    expect(nodes.length).toBe(5);
    expect(links.length).toBe(2);                     // 只有两条有效
    expect(metrics.linkCount).toBe(2);
    expect(metrics.centerIndex).toBe(1);              // 乙 的端点数最多（2）
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(buildConceptSvg(DIRTY).svg).toContain('</svg>');
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) expect(boxesOverlap(nodes[i], nodes[j])).toBe(false);
    }
  });

  it('超长文字折行后仍不越界、不重叠（宽度反推 + 半径自适应联动）', () => {
    const long = '这是一段很长的概念说明文字用来验证折行与图形宽度是否会联动收敛';
    const spec = {
      nodes: [{ text: long }, { text: long }, { text: long }, { text: long }, { text: long }],
      links: [
        { from: 0, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 3 }, { from: 0, to: 4 },
        { from: 1, to: 2 },
      ],
    };
    const { nodes, width, height } = layoutConcept(spec, { maxLabelWidth: 120 });
    expect(nodes.length).toBe(5);
    for (const n of nodes) {
      expect(n.lines.join('').length).toBeGreaterThan(0);
      expect(n.x + n.w).toBeLessThanOrEqual(width);
      expect(n.y + n.h).toBeLessThanOrEqual(height);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) expect(boxesOverlap(nodes[i], nodes[j])).toBe(false);
    }
  });

  it('半径自适应真的会迭代：文字框很大时自动增大 r 直到不重叠', () => {
    // ⚠️ 这条是刻意构造的"能触发增长"的样例：默认字号下 r0 已足够宽，增长是安全网；
    //    把字号放大到 100 后，中心框与环上首节点的框在 r0=150 时会真的相撞。
    const BIG = {
      nodes: [{ id: 'c', text: '中心概念' }, { id: 'a', text: '外围甲' }, { id: 'b', text: '外围乙' }],
      links: [{ from: 'c', to: 'a', label: '包含' }, { from: 'c', to: 'b', label: '包含' }],
    };
    const { nodes, metrics } = layoutConcept(BIG, { fontSize: 100, titleFontSize: 100, maxLabelWidth: 600 });
    expect(metrics.radiusIterations).toBeGreaterThanOrEqual(1);
    expect(metrics.radius).toBeGreaterThan(metrics.radiusMin);
    expect(metrics.radius).toBeCloseTo(metrics.radiusMin * Math.pow(metrics.radiusGrow, metrics.radiusIterations), 6);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(
          boxesOverlap(nodes[i], nodes[j]),
          `增大半径后「${nodes[i].title}」与「${nodes[j].title}」仍重叠 ${overlapArea(nodes[i], nodes[j])} px²`,
        ).toBe(false);
      }
    }
  });
});
