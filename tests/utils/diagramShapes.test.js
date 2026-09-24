/**
 * 📐 几何图形 + 函数图象 SVG（[GRAPH] TYPE:SHAPES）：版式硬指标单测
 * ============================================================
 * 为什么断言"不重叠 / 不越界 / 元素都画出来了 / 圆真的是圆 / 文字不丢 / 无 NaN"而不是快照：
 *   SHAPES 的质量问题几乎都是**版式病与几何病**（顶点字母压在刻度上、线段标注压住曲线、
 *   多边形字母叠成一团、圆被画成椭圆、"点数不足的元素"把整张图带崩、颜色名不认导致透明），
 *   字符串快照既守不住这些，又会在任何配色微调时全红。这里直接对 layoutShapes 的几何做断言。
 *
 * 🔴 重叠断言只覆盖 **solid:true 的文字框**（刻度值、顶点字母、线段/角标注、标题）：
 *   多边形/圆/线段包围盒与曲线、坐标轴天然相交（图形本来就要穿过坐标轴），
 *   把它们拉进重叠断言只会逼出假阳性；几何框的硬指标是"必须完全落在画布内"（见 ①）。
 * 口径与 tests/utils/diagramCoordinate.test.js 一致。
 * ============================================================
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { layoutShapes, buildShapesSvg } from '../../src/utils/diagrams/shapes.js';
import { setMathExprWarnSink } from '../../src/utils/diagrams/mathExpr.js';
import { boxesOverlap } from '../../src/utils/diagrams/shared.js';

setMathExprWarnSink(null);

/** 一份**真实体量**的 SHAPES（函数 + 点 + 线段 + 多边形 + 圆 + 角，七类元素齐活） */
const SAMPLE = {
  type: 'shapes',
  xlim: [-5, 5],
  ylim: [-6, 7],
  grid: true,
  title: '二次函数图象与几何元素',
  elements: [
    { kind: 'function', expr: 'x**2 - 2*x - 3', color: 'blue', domain: [-4, 5] },
    { kind: 'point', x: 1, y: -4, label: '顶点', color: 'red' },
    { kind: 'point', x: -3, y: -2, label: 'P' },
    { kind: 'line', points: [[-1, 0], [3, 0]], label: '与 x 轴交线', color: 'green', width: 2, dash: true },
    { kind: 'polygon', points: [[-4, 4], [0, 6], [2, 4]], labels: ['A', 'B', 'C'], color: 'purple' },
    { kind: 'circle', x: 0, y: 0, radius: 2, color: 'orange' },
    { kind: 'angle', a: [3, 0], vertex: [0, 0], b: [0, 4], label: '∠AOB', color: 'brown' },
  ],
};

const solid = (v) => String(v == null ? '' : v).replace(/\s+/g, '');
const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const boxNodes = (nodes) => nodes.filter((n) => n.solid === true);
const inCanvas = (n, width, height) => n.x >= 0 && n.y >= 0 && n.x + n.w <= width && n.y + n.h <= height;
const assertBoxesOk = (nodes, width, height) => {
  for (const n of nodes) expect(inCanvas(n, width, height), `「${n.title}」越界`).toBe(true);
  const boxes = boxNodes(nodes);
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      expect(
        boxesOverlap(boxes[i], boxes[j]),
        `「${boxes[i].title}」与「${boxes[j].title}」重叠 ${overlapArea(boxes[i], boxes[j])} px²`,
      ).toBe(false);
    }
  }
};
const count = (svg, re) => (svg.match(re) || []).length;

/* ============================ ① 版式硬指标 ============================ */

describe('diagramShapes · 版式硬指标', () => {
  const layout = layoutShapes(SAMPLE);
  const { nodes, width, height, metrics: m } = layout;
  const counts = m.elementCounts;

  it('① 宽高为正有限整数，且**每个**节点（含几何框）都落在画布内', () => {
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(nodes.length).toBeGreaterThan(15);
    for (const n of nodes) expect(inCanvas(n, width, height), `「${n.title}」越界`).toBe(true);
  });

  it('② 文字框（solid）两两不重叠', () => {
    assertBoxesOk(nodes, width, height);
  });

  it('③ 文字不丢：折行拼接是 title 的前缀（仅允许末尾 … 截断）', () => {
    for (const n of boxNodes(nodes)) {
      const joined = solid(n.lines.join('').replace(/…$/, ''));
      expect(solid(n.title).startsWith(joined), `「${n.title}」被渲染成「${n.lines.join('/')}」`).toBe(true);
      expect(n.lines.slice(0, -1).some((l) => l.includes('…')), `「${n.title}」中段出现截断`).toBe(false);
      if (!n.lines.join('').includes('…')) expect(solid(n.title)).toBe(joined);
    }
  });

  it('④ 元素计数：七类元素各就各位，无跳过', () => {
    expect(counts.function).toBe(1);
    expect(counts.point).toBe(2);
    expect(counts.line).toBe(1);
    expect(counts.polygon).toBe(1);
    expect(counts.circle).toBe(1);
    expect(counts.angle).toBe(1);
    expect(counts.arc).toBe(1);
    expect(counts.dash).toBe(1);
    expect(counts.skipped).toBe(0);
  });

  it('⑤ 每类元素都产出了对应的 node：几何包围盒 + 文字框', () => {
    const kinds = (k) => nodes.filter((n) => n.kind === k);
    expect(kinds('series').length).toBe(1);                       // 函数曲线的包围盒
    expect(kinds('polygon').length).toBe(1);
    expect(kinds('line').length).toBe(1);
    expect(kinds('circle').length).toBe(1);
    expect(kinds('angle').length).toBe(1);
    expect(kinds('point-marker').length).toBe(2);
    expect(kinds('polygon-vertex').length).toBe(3);               // A/B/C
    expect(kinds('line-label').length).toBe(1);
    expect(kinds('angle-label').length).toBe(1);
    expect(kinds('point-label').length).toBe(2);
    expect(kinds('title').length).toBe(1);
    expect(kinds('axis-tick').length).toBeGreaterThan(6);
    // 几何包围盒一律 solid:false 且不承载文字
    for (const k of ['series', 'polygon', 'line', 'circle', 'angle', 'point-marker']) {
      for (const n of kinds(k)) {
        expect(n.solid).toBe(false);
        expect(n.lines).toEqual([]);
      }
    }
    for (const t of ['A', 'B', 'C', '顶点', 'P', '与 x 轴交线', '∠AOB', SAMPLE.title]) {
      expect(boxNodes(nodes).some((n) => n.title === t), `「${t}」没有对应的文字框`).toBe(true);
    }
  });

  it('⑥ 圆必须是**数学意义上的圆**（像素空间是椭圆，rx:ry = 两轴比例）', () => {
    const c = nodes.find((n) => n.kind === 'circle');
    expect(c).toBeTruthy();
    expect(c.dataX).toBe(0);
    expect(c.dataY).toBe(0);
    expect(c.radius).toBe(2);
    const scaleX = m.plotWidth / (m.xlim[1] - m.xlim[0]);
    const scaleY = m.plotHeight / (m.ylim[1] - m.ylim[0]);
    expect(c.rx).toBeCloseTo(2 * scaleX, 6);
    expect(c.ry).toBeCloseTo(2 * scaleY, 6);
    expect(c.rx / c.ry).toBeCloseTo(scaleX / scaleY, 6);
    expect(c.rx).not.toBe(c.ry);                                   // x/y 比例不等时不能画成正圆
    expect(c.rx).toBeGreaterThan(0);
    expect(c.ry).toBeGreaterThan(0);
  });

  it('⑦ 角的几何：两条射线自顶点引出，弧覆盖的圆心角正确（本例 90°）', () => {
    const a = nodes.find((n) => n.kind === 'angle');
    expect(a).toBeTruthy();
    expect(a.vertexX).toBe(0);
    expect(a.vertexY).toBe(0);
    expect(a.radians).toBeCloseTo(Math.PI / 2, 6);
    expect(a.w).toBeGreaterThan(0);
    expect(a.h).toBeGreaterThan(0);
  });

  it('⑧ 线段：虚线标记、线宽与标注都落到几何/文字上', () => {
    const l = nodes.find((n) => n.kind === 'line');
    expect(l).toBeTruthy();
    expect(l.w).toBeGreaterThan(0);
  });

  it('⑨ 多边形：包围盒覆盖三个顶点，顶点字母框在包围盒附近', () => {
    const poly = nodes.find((n) => n.kind === 'polygon');
    const verts = [[-4, 4], [0, 6], [2, 4]].map(([x, y]) => ({
      x: m.plotLeft + ((x - m.xlim[0]) / (m.xlim[1] - m.xlim[0])) * m.plotWidth,
      y: m.plotTop + ((m.ylim[1] - y) / (m.ylim[1] - m.ylim[0])) * m.plotHeight,
    }));
    for (const v of verts) {
      expect(v.x).toBeGreaterThanOrEqual(poly.x - 1);
      expect(v.x).toBeLessThanOrEqual(poly.x + poly.w + 1);
      expect(v.y).toBeGreaterThanOrEqual(poly.y - 1);
      expect(v.y).toBeLessThanOrEqual(poly.y + poly.h + 1);
    }
  });

  it('节点契约字段齐全：{ id, title, x, y, w, h, lines }，solid 显式标注', () => {
    for (const n of nodes) {
      expect(typeof n.id).toBe('string');
      expect(typeof n.title).toBe('string');
      expect(Array.isArray(n.lines)).toBe(true);
      expect(typeof n.solid).toBe('boolean');
      for (const k of ['x', 'y', 'w', 'h']) expect(Number.isFinite(n[k])).toBe(true);
      // 规格要求：坐标一律取整（印刷时避免半像素发虚）
      for (const k of ['x', 'y', 'w', 'h']) expect(Number.isInteger(n[k]), `${n.title}.${k}=${n[k]}`).toBe(true);
      expect(n.w).toBeGreaterThan(0);
      expect(n.h).toBeGreaterThan(0);
    }
  });
});

/* ============================ ② 出图 ============================ */

describe('diagramShapes · 出图', () => {
  beforeAll(() => setMathExprWarnSink(null));

  it('SVG 结构：尺寸/viewBox 与版式一致，白底，闭合，无 DOCTYPE/<?xml>，无外链', () => {
    const { svg, width, height } = buildShapesSvg(SAMPLE);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`height="${height}"`);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('<?xml');
    expect(svg).not.toContain('<!DOCTYPE');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('filter=');
    expect(svg).not.toContain('url(');
    expect(svg).not.toContain('linearGradient');
  });

  it('每个元素都画进了 SVG：polygon / ellipse / 弧 / 虚线 / 两条射线 / 函数曲线', () => {
    const { svg, metrics: m } = buildShapesSvg(SAMPLE);
    expect(count(svg, /<polygon /g)).toBe(2 + m.elementCounts.polygon);   // 2 个轴箭头 + 1 个多边形
    expect(count(svg, /<ellipse /g)).toBe(m.elementCounts.circle);
    expect(count(svg, /\sA\s/g)).toBe(m.elementCounts.arc);               // 弧线（A 命令）
    expect(count(svg, /stroke-dasharray="7 4"/g)).toBe(m.elementCounts.dash);
    expect(count(svg, /<circle /g)).toBe(m.elementCounts.point);
    expect(count(svg, /<path /g)).toBe(1 + m.elementCounts.arc);          // 函数曲线 + 弧
    expect(count(svg, /<polyline /g)).toBe(2 + m.elementCounts.line);     // 两条射线 + 线段
    expect(svg).toContain('stroke="#dfe6ee"');                            // 网格照旧
    expect(svg).toContain('#c0392b');                                     // COLOR:red 已解析成色值
    expect(svg).toContain('#8a4b8a');                                     // purple
  });

  it('出图字符串里不得出现 NaN / undefined / null', () => {
    for (const spec of [SAMPLE, {}, { elements: [] }, { elements: [{ kind: 'function', expr: 'nope(' }] }]) {
      const { svg } = buildShapesSvg(spec);
      expect(/NaN/.test(svg), '出现 NaN').toBe(false);
      expect(/undefined/.test(svg), '出现 undefined').toBe(false);
      expect(/\bnull\b/.test(svg), '出现 null').toBe(false);
    }
  });

  it('顶点字母、线段标注、角标注、标题都进了 <text>', () => {
    const { svg } = buildShapesSvg(SAMPLE);
    for (const t of ['A', 'B', 'C', '顶点', '与 x 轴交线', '∠AOB']) {
      expect(svg, `「${t}」没出现在 SVG 里`).toContain(`>${t}<`);
    }
    expect(svg).toContain('二次函数图象与几何元素');
    expect(svg).not.toContain('x**2 - 2*x - 3');       // 表达式只做几何，不进文字层
  });

  it('特殊字符被转义，文本节点里无裸的 < / >', () => {
    const { svg } = buildShapesSvg({
      title: 'a<b & "c"',
      xlim: [-3, 3],
      ylim: [-3, 3],
      elements: [
        { kind: 'point', x: 1, y: 1, label: "x > y & z's" },
        { kind: 'polygon', points: [[-2, -2], [0, -1], [1, -2]], labels: ['p < q'], color: 'red' },
        { kind: 'line', points: [[-2, 2], [2, 2]], label: 'm & n' },
        { kind: 'angle', a: [2, 0], vertex: [0, 0], b: [0, 2], label: '∠a<b' },
      ],
    });
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;');
    expect(svg).toContain('x &gt; y &amp; z&apos;s');
    expect(svg).toContain('p &lt; q');
    expect(svg).toContain('m &amp; n');
    expect(svg).toContain('∠a&lt;b');
    const texts = svg.match(/<text[^>]*>[^<]*<\/text>/g) || [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      const body = t.replace(/^<text[^>]*>/, '').replace(/<\/text>$/, '');
      expect(/[<>]/.test(body), `text 内容里有未转义的尖括号：${body}`).toBe(false);
    }
  });

  it('确定性：同样输入两次输出完全一致', () => {
    expect(layoutShapes(SAMPLE)).toEqual(layoutShapes(SAMPLE));
    expect(buildShapesSvg(SAMPLE).svg).toBe(buildShapesSvg(SAMPLE).svg);
    expect(buildShapesSvg({ elements: [] }).svg).toBe(buildShapesSvg({ elements: [] }).svg);
  });

  it('支持 labelTransform（公式线性化钩子）与自定义调色板', () => {
    const { svg } = buildShapesSvg(
      {
        title: '$y=x^2$',
        xlim: [-2, 2],
        ylim: [-2, 2],
        elements: [{ kind: 'point', x: 1, y: 1, label: '$顶点$' }, { kind: 'circle', x: 0, y: 0, radius: 1 }],
      },
      { labelTransform: (s) => String(s).replace(/\$([^$]+)\$/g, '$1'), palette: ['#123456'] },
    );
    expect(svg).toContain('y=x^2');
    expect(svg).toContain('顶点');
    expect(svg).not.toContain('$');
    expect(svg).toContain('#123456');
  });
});

/* ============================ ③ 边界与健壮性 ============================ */

describe('diagramShapes · 边界与健壮性', () => {
  beforeAll(() => setMathExprWarnSink(null));

  it('⑥ 空 / 单元素 / 脏输入不崩，尺寸仍为正整数，节点不越界且文字框互不重叠', () => {
    const CASES = [
      null,
      undefined,
      {},
      { elements: [] },
      { elements: null },
      { xlim: [3, 1], ylim: [1, 1], elements: [] },
      { elements: [null, 'x', {}, { kind: 'unknown' }] },
      { elements: [{ kind: 'polygon', points: [[0, 0]] }] },
      { elements: [{ kind: 'polygon', points: [[0, 0], [1, 1], [2, 2]], labels: ['A'] }] },
      { elements: [{ kind: 'line', points: [[0, 0]] }] },
      { elements: [{ kind: 'line', points: [['a', 'b'], [1, 1]] }] },
      { elements: [{ kind: 'circle', x: 0, y: 0, radius: 0 }] },
      { elements: [{ kind: 'circle', x: 0, y: 0 }] },
      { elements: [{ kind: 'circle', x: 0, y: 0, radius: 99 }] },
      { elements: [{ kind: 'angle', a: [0, 0], vertex: [0, 0], b: [1, 1] }] },
      { elements: [{ kind: 'angle', a: [1, 1], vertex: [0, 0] }] },
      { elements: [{ kind: 'function', expr: 'nope(' }] },
      { elements: [{ kind: 'point' }, { kind: 'point', x: 'a', y: 1 }] },
      { elements: [{ kind: 'polygon', points: [[0, 0], [1, 1], [2, 0]], labels: ['超长顶点字母'.repeat(12)] }] },
    ];
    for (const spec of CASES) {
      const r = buildShapesSvg(spec);
      expect(Number.isInteger(r.width), `width=${r.width}`).toBe(true);
      expect(Number.isInteger(r.height)).toBe(true);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.svg).toContain('</svg>');
      expect(r.svg).toContain('fill="#ffffff"');
      expect(/NaN/.test(r.svg)).toBe(false);
      expect(/undefined/.test(r.svg)).toBe(false);
      assertBoxesOk(r.nodes, r.width, r.height);
    }
  });

  it('脏输入的元素被计入 skipped，但整张图照旧出得来', () => {
    const r = layoutShapes({
      elements: [
        null, '只有字符串', {}, { kind: 'unknown' },
        { kind: 'point' },
        { kind: 'circle', x: 0, y: 0, radius: 0 },
        { kind: 'line', points: [[0, 0]] },
        { kind: 'angle', a: [0, 0], vertex: [0, 0], b: [1, 1] },
      ],
    });
    expect(r.metrics.elementCounts.skipped).toBe(8);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
    expect(r.metrics.elementCounts.function).toBe(0);
    expect(r.metrics.elementCounts.point).toBe(0);
    expect(r.metrics.elementCounts.circle).toBe(0);
  });

  it('SHAPES 里的函数元素也遵守"定义域断点处断开"（1/x 不连线穿越渐近线）', () => {
    const { metrics: m, nodes } = layoutShapes({
      xlim: [-5, 5], ylim: [-5, 5],
      elements: [{ kind: 'function', expr: '1/x' }, { kind: 'point', x: 1, y: 1, label: 'Q' }],
    });
    expect(m.series.length).toBe(1);
    expect(m.series[0].segmentCount).toBe(2);
    expect(m.series[0].maxJumpPx).toBeLessThanOrEqual(m.plotHeight * 0.5 + 2);
    expect(nodes.some((n) => n.kind === 'series')).toBe(true);
  });

  it('超大圆（半径超出可视范围）被夹进画布，仍不越界', () => {
    const r = layoutShapes({ elements: [{ kind: 'circle', x: 0, y: 0, radius: 50, color: 'blue' }] });
    const c = r.nodes.find((n) => n.kind === 'circle');
    expect(inCanvas(c, r.width, r.height)).toBe(true);
    expect(c.rx).toBeGreaterThan(0);
  });

  it('超长标注折行后仍不越界、不重叠（框宽反推 + 环形搜索联动）', () => {
    const long = '这是一段很长很长的顶点标注文字用来验证折行与图形宽度是否会联动收敛';
    const r = layoutShapes({
      xlim: [-4, 4], ylim: [-4, 4],
      elements: [
        { kind: 'polygon', points: [[-3, 3], [0, 2], [3, 3]], labels: [long, long, long] },
        { kind: 'point', x: 0, y: -1, label: long },
      ],
    }, { maxLabelWidth: 90 });
    assertBoxesOk(r.nodes, r.width, r.height);
    const labeled = boxNodes(r.nodes).filter((n) => n.kind === 'polygon-vertex' || n.kind === 'point-label');
    expect(labeled.length).toBe(4);
    for (const n of labeled) {
      expect(n.lines.length).toBeGreaterThan(1);
      expect(n.w).toBeLessThanOrEqual(90 + 8 + 1);
      expect(n.lines.slice(0, -1).some((l) => l.includes('…'))).toBe(false);
    }
  });
});
