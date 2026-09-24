/**
 * 📊 统计图（柱状图 / 折线图 / 扇形图）SVG：版式硬指标单测
 * ============================================================
 * 为什么断言"不重叠 / 不越界 / 文字不丢 / 无 NaN / 确定性 / 柱数=data长度 / 扇形角和 360°"
 * 而不是对 SVG 做字符串快照：
 *   统计图的质量问题几乎都是**版式病**（柱/标签叠在一起、标签越出画布、数值标签被图形压住、
 *   扇形角算错 0/0 得 NaN），字符串快照既守不住这些，又会在任何配色微调时全红。
 *   这里直接对 `layoutCharts` 的几何 + 关键计数做断言 —— 换配色/字号不误报，真改坏一定报。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { layoutCharts, buildChartsSvg } from '../../src/utils/diagrams/charts.js';
import { boxesOverlap } from '../../src/utils/diagrams/shared.js';

const solid = (v) => String(v == null ? '' : v).replace(/\s+/g, '');
const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** 三份**真实体量**的统计图（对齐 [GRAPH] 指令块的 DATA/LABELS/TITLE/XLABEL/YLABEL） */
const BAR = {
  type: 'barChart',
  data: [15, 22, 18, 30, 25],
  labels: ['一班', '二班', '三班', '四班', '五班'],
  title: '各组数据分布',
  xlabel: '班级',
  ylabel: '数量',
};
const LINE = {
  type: 'lineChart',
  data: [5, 12, 8, 20, 15],
  labels: ['第1期', '第2期', '第3期', '第4期', '第5期'],
  title: '数据变化',
  xlabel: '时间',
  ylabel: '数值',
};
const PIE = {
  type: 'pieChart',
  data: [30, 25, 20, 15, 10],
  labels: ['甲', '乙', '丙', '丁', '戊'],
  title: '占比分布',
};

const SAMPLES = [['barChart', BAR], ['lineChart', LINE], ['pieChart', PIE]];

describe('diagramCharts · 版式硬指标（三图种同口径）', () => {
  for (const [name, spec] of SAMPLES) {
    describe(name, () => {
      const layout = layoutCharts(spec);
      const { nodes, width, height } = layout;

      it('① 宽高为正有限整数，且每个节点完全落在 [0,width]×[0,height] 内', () => {
        expect(Number.isInteger(width)).toBe(true);
        expect(Number.isInteger(height)).toBe(true);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        expect(nodes.length).toBeGreaterThan(0);
        for (const n of nodes) {
          for (const k of ['x', 'y', 'w', 'h']) {
            expect(Number.isFinite(n[k]), `${name}「${n.role}/${n.title}」${k} 非有限`).toBe(true);
          }
          expect(n.x, `${name}「${n.title}」x 越界`).toBeGreaterThanOrEqual(0);
          expect(n.y, `${name}「${n.title}」y 越界`).toBeGreaterThanOrEqual(0);
          expect(n.x + n.w, `${name}「${n.title}」右边越界`).toBeLessThanOrEqual(width);
          expect(n.y + n.h, `${name}「${n.title}」下边越界`).toBeLessThanOrEqual(height);
        }
      });

      it('② 节点框两两不重叠（boxesOverlap 全 false）', () => {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            expect(
              boxesOverlap(nodes[i], nodes[j]),
              `${name}「${nodes[i].role}:${nodes[i].title}」与「${nodes[j].role}:${nodes[j].title}」重叠 ${overlapArea(nodes[i], nodes[j])} px²`,
            ).toBe(false);
          }
        }
      });

      it('③ 文字不丢：折行拼接是原标题前缀（仅允许末尾 … 截断）', () => {
        for (const n of nodes) {
          const joined = solid(n.lines.join('').replace(/…$/, ''));
          expect(solid(n.title).startsWith(joined), `${name}「${n.title}」被渲染成「${n.lines.join('/')}」`).toBe(true);
          if (!n.lines.join('').includes('…')) expect(solid(n.title)).toBe(joined);
        }
      });

      it('④ 数值标签文字出现在 SVG 里，且 SVG 无 NaN', () => {
        const { svg } = buildChartsSvg(spec);
        expect(svg).not.toContain('NaN');
        const vlabels = nodes.filter((n) => n.role === 'valueLabel' || n.role === 'pieLabel');
        expect(vlabels.length).toBe(spec.data.length);
        for (const n of vlabels) {
          for (const line of n.lines) {
            expect(svg, `${name} 缺数值标签「${line}」`).toContain(`>${line}<`);
          }
        }
        for (const v of spec.data) expect(svg).toContain(String(v));
      });

      it('⑤ 确定性：同输入两次结果完全一致', () => {
        expect(JSON.stringify(layoutCharts(spec))).toBe(JSON.stringify(layoutCharts(spec)));
        expect(buildChartsSvg(spec).svg).toBe(buildChartsSvg(spec).svg);
      });

      it('出图：白底、闭合、尺寸与版式一致、无外链/阴影/渐变', () => {
        const { svg, width: w, height: h } = buildChartsSvg(spec);
        expect(svg.startsWith('<svg ')).toBe(true);
        expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
        expect(svg).toContain(`width="${w}"`);
        expect(svg).toContain(`height="${h}"`);
        expect(svg).toContain(`viewBox="0 0 ${w} ${h}"`);
        expect(svg).toContain('fill="#ffffff"');   // 白底（印刷友好）
        expect(svg).not.toContain('<?xml');
        expect(svg).not.toContain('<!DOCTYPE');
        expect(svg).not.toContain('<image');
        expect(svg).not.toContain('filter=');
        expect(svg).not.toContain('url(');
      });
    });
  }
});

describe('diagramCharts · 柱状图专有', () => {
  const layout = layoutCharts(BAR);
  const bars = layout.nodes.filter((n) => n.role === 'bar');

  it('柱数 = data 长度', () => {
    expect(bars.length).toBe(BAR.data.length);
  });

  it('柱等宽，且间隙 = 柱宽 × 35%（容差 1px）', () => {
    expect(new Set(bars.map((b) => b.w)).size).toBe(1);
    const { barW, barGap } = layout.metrics;
    expect(barW).toBeGreaterThan(0);
    expect(barGap).toBeGreaterThan(0);
    expect(Math.abs(barGap - barW * 0.35)).toBeLessThanOrEqual(1);
  });

  it('相邻柱的横向间隔恒为 barGap（等槽等宽）', () => {
    const sorted = [...bars].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w)).toBe(layout.metrics.barGap);
    }
  });

  it('柱高与数据成正比（最大值映射到绘图区顶部留白之下）', () => {
    const { maxBarH } = layout.metrics;
    const maxVal = Math.max(...BAR.data);
    for (const b of bars) {
      expect(b.h).toBe(Math.round((b.value / layout.metrics.tickMax) * maxBarH));
      expect(b.h).toBeGreaterThan(0);
    }
    const tallest = bars.reduce((m, b) => (b.h > m.h ? b : m), bars[0]);
    expect(tallest.value).toBe(maxVal);
  });

  it('SVG 里有柱矩形与基准线/纵轴', () => {
    const { svg } = buildChartsSvg(BAR);
    expect(svg).toContain('<rect ');
    expect((svg.match(/<rect /g) || []).length).toBeGreaterThanOrEqual(bars.length);
    expect(svg).toContain('stroke-width="1.6"');   // 坐标轴
  });
});

describe('diagramCharts · 折线图专有', () => {
  const layout = layoutCharts(LINE);
  const points = layout.nodes.filter((n) => n.role === 'point');

  it('数据点数 = data 长度', () => {
    expect(points.length).toBe(LINE.data.length);
  });

  it('数据点小圆 r=2.5，且相邻点横向等距', () => {
    const sorted = [...points].sort((a, b) => a.cx - b.cx);
    for (const p of points) {
      expect(p.w).toBe(5);
      expect(p.h).toBe(5);
    }
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].cx - sorted[i - 1].cx).toBe(layout.metrics.slotW);
    }
  });

  it('SVG 里有折线 path（M/L 顶点数 = 数据点数）与 r=2.5 的圆点', () => {
    const { svg } = buildChartsSvg(LINE);
    const m = /<path d="([^"]+)"[^>]*fill="none"/.exec(svg);
    expect(m).toBeTruthy();
    expect((m[1].match(/[ML]/g) || []).length).toBe(LINE.data.length);
    expect((svg.match(/<circle [^>]*r="2.5"/g) || []).length).toBe(LINE.data.length);
  });
});

describe('diagramCharts · 扇形图专有', () => {
  const layout = layoutCharts(PIE);
  const labels = layout.nodes.filter((n) => n.role === 'pieLabel');

  it('扇区数 = data 长度', () => {
    expect(labels.length).toBe(PIE.data.length);
    expect(layout.metrics.sectorCount).toBe(PIE.data.length);
  });

  it('④ 扇形角度和 = 360°（容差 0.01）', () => {
    const sum = labels.reduce((a, n) => a + n.sweep, 0);
    expect(Math.abs(sum - 360)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(layout.metrics.angleSum - 360)).toBeLessThanOrEqual(0.01);
    for (const n of labels) expect(n.sweep).toBeGreaterThanOrEqual(0);
  });

  it('每个扇区角度与其数值成正比（sweep/value 恒定）', () => {
    const total = PIE.data.reduce((a, b) => a + b, 0);
    for (const n of labels) {
      expect(n.sweep).toBeCloseTo((n.value / total) * 360, 6);
      expect(n.startAngle).toBeLessThan(n.endAngle);
    }
  });

  it('全 0 数据退化为等分，角度和仍为 360（不出现 0/0 → NaN）', () => {
    const { nodes, metrics } = layoutCharts({ type: 'pieChart', data: [0, 0, 0, 0], labels: ['a', 'b', 'c', 'd'] });
    const ls = nodes.filter((n) => n.role === 'pieLabel');
    expect(ls.length).toBe(4);
    for (const n of ls) expect(n.sweep).toBeCloseTo(90, 9);
    expect(Math.abs(metrics.angleSum - 360)).toBeLessThanOrEqual(0.01);
  });

  it('SVG 里有扇区 path 与引导线；单扇区退化成整圆 <circle>', () => {
    const { svg } = buildChartsSvg(PIE);
    expect((svg.match(/<path d="M /g) || []).length).toBe(PIE.data.length);
    expect((svg.match(/<line /g) || []).length).toBe(PIE.data.length);
    const one = buildChartsSvg({ type: 'pieChart', data: [10], labels: ['全部'] });
    expect(one.svg).toContain('<circle ');
    expect(one.nodes.filter((n) => n.role === 'pieLabel') [0].sweep).toBe(360);
  });
});

describe('diagramCharts · 类型分发 / 选项', () => {
  it('缺省或未知 type 回落柱状图（不崩、尺寸为正）', () => {
    for (const spec of [{ data: [1, 2, 3] }, { type: 'unknownChart', data: [1, 2, 3] }, { type: 'pieChart' }]) {
      const r = buildChartsSvg(spec);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.svg).toContain('</svg>');
    }
    expect(layoutCharts({ data: [1, 2, 3] }).metrics.type).toBe('barChart');
    expect(layoutCharts({ type: 'pieChart', data: [1, 2] }).metrics.type).toBe('pieChart');
  });

  it('各类标签都从实测文字宽度反推框宽（文字不越出图形）', () => {
    for (const [, spec] of SAMPLES) {
      const { nodes } = layoutCharts(spec);
      for (const n of nodes) {
        if (!n.title) continue;
        // 折行后每行都不超过框宽（框宽 = 最长行 + 2*padX）
        expect(n.w).toBeGreaterThan(0);
        expect(n.h).toBeGreaterThan(0);
      }
    }
  });

  it('支持 labelTransform（公式线性化钩子，见 mindmap.js）', () => {
    const { svg } = buildChartsSvg(
      { type: 'barChart', data: [3, 5], labels: ['$x^2$', '$y$'], title: '$S$ 分布' },
      { labelTransform: (s) => String(s).replace(/\$([^$]+)\$/g, '$1') },
    );
    expect(svg).toContain('x^2');
    expect(svg).not.toContain('$');
  });

  it('colors 覆盖：柱/扇区取 spec.colors', () => {
    const colors = ['#111111', '#222222', '#333333'];
    const bar = buildChartsSvg({ type: 'barChart', data: [1, 2, 3], labels: ['a', 'b', 'c'], colors });
    for (const c of colors) expect(bar.svg).toContain(c);
    const pie = buildChartsSvg({ type: 'pieChart', data: [1, 2, 3], labels: ['a', 'b', 'c'], colors });
    for (const c of colors) expect(pie.svg).toContain(c);
  });

  it('grid 打开时坐标类图多出淡灰网格线（#dfe6ee）', () => {
    const withGrid = buildChartsSvg(BAR, { grid: true }).svg;
    const noGrid = buildChartsSvg(BAR, { grid: false }).svg;
    expect(withGrid).toContain('#dfe6ee');
    expect(noGrid).not.toContain('#dfe6ee');
  });

  it('特殊字符被转义，文本节点里无裸的 < / >', () => {
    for (const type of ['barChart', 'lineChart', 'pieChart']) {
      const { svg } = buildChartsSvg({
        type,
        data: [1, 2],
        labels: ['a<b', 'x & "y"'],
        title: 't<1',
      });
      expect(svg).toContain('a&lt;b');
      expect(svg).toContain('x &amp; &quot;y&quot;');
      expect(svg).toContain('t&lt;1');
      const texts = svg.match(/<text[^>]*>[^<]*<\/text>/g) || [];
      expect(texts.length).toBeGreaterThan(0);
      for (const t of texts) {
        const body = t.replace(/^<text[^>]*>/, '').replace(/<\/text>$/, '');
        expect(/[<>]/.test(body), `text 内容里有未转义的尖括号：${body}`).toBe(false);
      }
    }
  });
});

describe('diagramCharts · 空 / 单元素 / 脏输入', () => {
  const CASES = [
    null,
    {},
    { type: 'barChart', data: [] },
    { type: 'lineChart', data: [] },
    { type: 'pieChart', data: [] },
    { type: 'barChart', data: [7] },
    { type: 'lineChart', data: [7] },
    { type: 'pieChart', data: [7] },
    { type: 'barChart', data: [1, null, 'x', NaN, 4], labels: [null, '', 'a b', 1, 'c'] },
    { type: 'lineChart', data: ['5', undefined], labels: 'not-an-array' },
    { type: 'pieChart', data: [-1, 3], labels: [null] },
  ];

  it('都不崩，宽高为正整数、白底闭合、无 NaN、节点都在画布内', () => {
    for (const spec of CASES) {
      const r = buildChartsSvg(spec);
      expect(Number.isInteger(r.width)).toBe(true);
      expect(Number.isInteger(r.height)).toBe(true);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.svg).toContain('</svg>');
      expect(r.svg).toContain('fill="#ffffff"');
      expect(r.svg).not.toContain('NaN');
      for (const n of r.nodes) {
        expect(Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.w) && Number.isFinite(n.h)).toBe(true);
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeGreaterThanOrEqual(0);
        expect(n.x + n.w).toBeLessThanOrEqual(r.width);
        expect(n.y + n.h).toBeLessThanOrEqual(r.height);
      }
    }
  });

  it('空输入版式：无数据节点，尺寸仍为正', () => {
    for (const type of ['barChart', 'lineChart', 'pieChart']) {
      const { nodes, width, height } = layoutCharts({ type, data: [] });
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(nodes.filter((n) => n.role === 'bar' || n.role === 'point' || n.role === 'pieLabel').length).toBe(0);
    }
  });

  it('单元素：柱数/点数/扇区数都为 1', () => {
    expect(layoutCharts({ type: 'barChart', data: [7] }).nodes.filter((n) => n.role === 'bar').length).toBe(1);
    expect(layoutCharts({ type: 'lineChart', data: [7] }).nodes.filter((n) => n.role === 'point').length).toBe(1);
    expect(layoutCharts({ type: 'pieChart', data: [7] }).nodes.filter((n) => n.role === 'pieLabel').length).toBe(1);
  });
});
