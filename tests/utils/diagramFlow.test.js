/**
 * 🔀 流程图 SVG：版式硬指标单测
 * ============================================================
 * 为什么断言"不重叠/不越界/连线不穿字"而不是对 SVG 做字符串快照：
 *   流程图的质量问题几乎都是**版式病**（框叠在一起、字跑出框、箭头/连线穿过文字块），
 *   字符串快照既守不住这些，又会在任何样式微调时全红。这里直接对 layoutFlow 的几何做断言。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { layoutFlow, buildFlowSvg } from '../../src/utils/diagrams/flow.js';
import { boxesOverlap } from '../../src/utils/diagrams/shared.js';

/** 一份**真实体量**的高中数学流程图（质数判定 + 两层判定） */
const SAMPLE = {
  steps: [
    { text: '开始', kind: 'start' },
    { text: '输入一个正整数 n', kind: 'process' },
    {
      text: 'n 是否小于 2？',
      kind: 'decision',
      branches: [
        { label: '是', steps: [
          { text: 'n 不是质数' },
          { text: '输出结论并结束' },
        ] },
        { label: '否', steps: [ { text: '令 i = 2' } ] },
      ],
    },
    {
      text: 'i 是否不超过 √n？',
      kind: 'decision',
      branches: [
        { label: '是', steps: [ { text: 'n 能被 i 整除？' } ] },
      ],
    },
    { text: 'n 是质数', kind: 'process' },
    { text: '结束', kind: 'end' },
  ],
};

const solid = (v) => String(v).replace(/\s+/g, '');

/** 线段与矩形（内缩 inset）是否有正长度的交集 —— Liang–Barsky 裁剪 */
const segHitsBox = (s, box, inset = 0.5) => {
  const rx1 = box.x + inset;
  const rx2 = box.x + box.w - inset;
  const ry1 = box.y + inset;
  const ry2 = box.y + box.h - inset;
  if (rx2 <= rx1 || ry2 <= ry1) return false;
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [s.x1 - rx1, rx2 - s.x1, s.y1 - ry1, ry2 - s.y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 < t1;
};

const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

describe('diagramFlow · 版式硬指标', () => {
  const layout = layoutFlow(SAMPLE);
  const { nodes, width, height, metrics } = layout;
  const mains = nodes.filter((n) => n.role === 'step' && n.depth === 0);
  const branchNodes = nodes.filter((n) => n.role === 'step' && n.depth === 1);

  it('① 宽高为正有限整数', () => {
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(100);
    expect(height).toBeGreaterThan(100);
  });

  it('① 每个节点都完全落在 [0,width]×[0,height] 内', () => {
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      expect(n.x, `「${n.title}」x 越界`).toBeGreaterThanOrEqual(0);
      expect(n.y, `「${n.title}」y 越界`).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w, `「${n.title}」右边越界`).toBeLessThanOrEqual(width);
      expect(n.y + n.h, `「${n.title}」下边越界`).toBeLessThanOrEqual(height);
    }
  });

  it('② 节点框两两不重叠（boxesOverlap 全 false）', () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(
          boxesOverlap(nodes[i], nodes[j]),
          `「${nodes[i].title}」与「${nodes[j].title}」重叠 ${overlapArea(nodes[i], nodes[j])} px²`,
        ).toBe(false);
      }
    }
  });

  it('③ 标题文字不丢：折行拼接是原标题前缀（仅允许末尾 … 截断）', () => {
    for (const n of nodes) {
      const joined = solid(n.lines.join('').replace(/…$/, ''));
      expect(solid(n.title).startsWith(joined), `「${n.title}」被渲染成「${n.lines.join('/')}」`).toBe(true);
      if (!n.lines.join('').includes('…')) {
        expect(solid(n.title)).toBe(joined);
      }
    }
  });

  it('主轴所有框同宽，且都居中于 axisX', () => {
    expect(mains.length).toBe(SAMPLE.steps.length);
    expect(new Set(mains.map((n) => n.w)).size).toBe(1);
    for (const n of mains) {
      expect(Math.abs(n.x + n.w / 2 - metrics.axisX)).toBeLessThanOrEqual(1);
    }
  });

  it('主轴框之间纵向不重叠，箭头数 = 步骤数 - 1', () => {
    for (let i = 0; i + 1 < mains.length; i++) {
      expect(mains[i].y + mains[i].h).toBeLessThanOrEqual(mains[i + 1].y);
    }
    expect(layout.arrows.length).toBe(mains.length - 1);
    for (const a of layout.arrows) {
      expect(a.x).toBe(metrics.axisX);
      expect(a.y2).toBeGreaterThan(a.y1);
      expect(a.y2 - a.y1).toBeGreaterThanOrEqual(22); // 无分支时正好 22
    }
  });

  it('分支列在主轴右侧、与主轴框横向不重叠', () => {
    expect(branchNodes.length).toBeGreaterThan(0);
    const mainRight = Math.max(...mains.map((n) => n.x + n.w));
    for (const b of branchNodes) {
      expect(b.x, `分支「${b.title}」压到主轴`).toBeGreaterThanOrEqual(mainRight);
    }
  });

  it('单分支：首框纵向中心 = 对应 decision 中心（容差 1）', () => {
    const dec = mains.find((n) => n.title === 'i 是否不超过 √n？');
    const first = branchNodes.find((n) => n.title === 'n 能被 i 整除？');
    expect(Math.abs((first.y + first.h / 2) - (dec.y + dec.h / 2))).toBeLessThanOrEqual(1);
  });

  it('双分支：两组以 decision 中心为锚上下排开', () => {
    const dec = mains.find((n) => n.title === 'n 是否小于 2？');
    const cy = dec.y + dec.h / 2;
    const upper = branchNodes.find((n) => n.title === 'n 不是质数');
    const lower = branchNodes.find((n) => n.title === '令 i = 2');
    expect(upper.y + upper.h / 2).toBeLessThan(cy);
    expect(lower.y + lower.h / 2).toBeGreaterThan(cy);
  });

  it('连线与箭头不穿过任何步骤文字框（只在框间空隙走）', () => {
    // 分支标签的白底**就是**用来压线的（规格：白底挡住线），故连线允许从其背后穿过；
    // 这里只守"连线不得穿进任何步骤框内部"这条硬指标。
    const stepBoxes = nodes.filter((n) => n.role === 'step');
    expect(layout.connectors.length).toBeGreaterThan(0);
    for (const c of layout.connectors) {
      for (const s of c.segments) {
        for (const b of stepBoxes) {
          expect(segHitsBox(s, b), `连线段 [${s.x1},${s.y1}→${s.x2},${s.y2}] 穿过「${b.title}」`).toBe(false);
        }
      }
    }
    for (const a of layout.arrows) {
      const seg = { x1: a.x, y1: a.y1, x2: a.x, y2: a.y2 };
      for (const b of nodes) {
        expect(segHitsBox(seg, b), `箭头穿过「${b.title}」`).toBe(false);
      }
    }
  });

  it('每个 decision 的连线数 = 有效分支数（每个分支一条 path）', () => {
    expect(layout.connectors.length).toBe(3); // 2 + 1
    for (const c of layout.connectors) {
      expect(c.d.startsWith('M ')).toBe(true);
      expect(c.d).toContain('L ');
    }
  });
});

describe('diagramFlow · 出图', () => {
  it('④ svg 含 </svg>、白底、尺寸与版式一致', () => {
    const { svg, width, height } = buildFlowSvg(SAMPLE);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    expect(svg).toContain('fill="#ffffff"');   // 白底（印刷友好）
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('filter=');
  });

  it('形状：start/end 圆角 14、process 圆角 6、decision 六边形', () => {
    const { svg, nodes } = buildFlowSvg(SAMPLE);
    const start = nodes.find((n) => n.kind === 'start');
    const proc = nodes.find((n) => n.kind === 'process' && n.depth === 0);
    const dec = nodes.find((n) => n.kind === 'decision');
    expect(svg).toContain(`<rect x="${start.x}" y="${start.y}" width="${start.w}" height="${start.h}" rx="14"`);
    expect(svg).toContain(`<rect x="${proc.x}" y="${proc.y}" width="${proc.w}" height="${proc.h}" rx="6"`);
    expect(svg).toContain('<polygon points=');
    expect(svg).toContain(`fill="none" stroke="${dec.color}" stroke-width="1.4"`); // decision 用六边形描边
  });

  it('④ 特殊字符被转义，且文本节点里无裸的 < / >', () => {
    const { svg } = buildFlowSvg({
      steps: [
        { text: 'a<b & "c"', kind: 'start' },
        { text: "x > y & z's", kind: 'decision', branches: [{ label: 'a&b', steps: [{ text: 'p<q' }] }] },
      ],
    });
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;');
    expect(svg).toContain('x &gt; y &amp; z&apos;s');
    expect(svg).toContain('a&amp;b');
    const texts = svg.match(/<text[^>]*>[^<]*<\/text>/g) || [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      const body = t.replace(/^<text[^>]*>/, '').replace(/<\/text>$/, '');
      expect(/[<>]/.test(body), `text 内容里有未转义的尖括号：${body}`).toBe(false);
    }
  });

  it('分支标签文字出现在 svg 里（是/否）', () => {
    const { svg } = buildFlowSvg(SAMPLE);
    expect(svg).toContain('>是<');
    expect(svg).toContain('>否<');
  });

  it('⑤ 确定性：同样输入两次输出完全一致', () => {
    expect(buildFlowSvg(SAMPLE).svg).toBe(buildFlowSvg(SAMPLE).svg);
    expect(layoutFlow(SAMPLE)).toEqual(layoutFlow(SAMPLE));
  });

  it('⑥ 空/单元素输入不崩，尺寸仍为正', () => {
    const cases = [
      null,
      {},
      { steps: [] },
      { steps: [{ text: '只有一步' }] },
      { steps: [{ text: '判定', kind: 'decision', branches: [{ label: '是', steps: [{ text: '处理' }] }] }] },
      { steps: [{ text: '空分支', kind: 'decision', branches: [{ label: '是', steps: [] }] }] },
    ];
    for (const spec of cases) {
      const r = buildFlowSvg(spec);
      expect(Number.isInteger(r.width)).toBe(true);
      expect(Number.isInteger(r.height)).toBe(true);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.svg).toContain('</svg>');
    }
  });

  it('⑥ 空/单元素版式：节点都在画布内且不重叠', () => {
    for (const spec of [{ steps: [] }, { steps: [{ text: '只有一步' }] }]) {
      const { nodes, width, height } = layoutFlow(spec);
      for (const n of nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeGreaterThanOrEqual(0);
        expect(n.x + n.w).toBeLessThanOrEqual(width);
        expect(n.y + n.h).toBeLessThanOrEqual(height);
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          expect(boxesOverlap(nodes[i], nodes[j])).toBe(false);
        }
      }
    }
  });
});
