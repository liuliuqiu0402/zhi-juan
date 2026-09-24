/**
 * 🕰 时间轴 SVG：版式硬指标单测
 * ============================================================
 * 为什么断言"不重叠 / 不越界 / 引线对齐 / 文字不丢"而不是对 SVG 做快照：
 *   时间轴的质量问题几乎都是**版式病**（框叠在一起、字被挤到框外、引线没对准框、
 *   折行把 detail 挤没了），字符串快照守不住这些，却会在任何配色微调时全红。
 *   这里直接对 layoutTimeline 算出的几何做断言 —— 换配色/字号不会误报，真改坏一定报。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { layoutTimeline, buildTimelineSvg, estimateTextWidth } from '../../src/utils/diagrams/timeline.js';
import { boxesOverlap } from '../../src/utils/diagrams/shared.js';

/** 一份**真实体量**的高中历史时间轴（不是三五个占位词） */
const SAMPLE = {
  items: [
    { when: '1919年5月', text: '五四运动', detail: '新民主主义革命的开端' },
    { when: '1921年7月', text: '中国共产党成立', detail: '中共一大在上海召开' },
    { when: '1927年8月', text: '南昌起义', detail: '打响武装反抗国民党反动派第一枪' },
    { when: '1934年10月', text: '红军长征开始', detail: '中央红军从瑞金出发，行程二万五千里' },
    { when: '1935年1月', text: '遵义会议', detail: '确立以毛泽东为核心的党中央的正确领导' },
    { when: '1937年7月', text: '七七事变', detail: '全民族抗战由此开始' },
    { when: '1945年8月', text: '抗日战争胜利' },
    { when: '1949年10月1日', text: '中华人民共和国成立', detail: '开国大典在北京天安门广场举行' },
  ],
};

const solid = (v) => String(v == null ? '' : v).replace(/\s+/g, '');
const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

describe('timeline · 版式硬指标', () => {
  const { nodes, width, height, metrics } = layoutTimeline(SAMPLE);

  it('宽高为正有限整数，且每个事件框完全落在画布内', () => {
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(nodes.length).toBe(SAMPLE.items.length);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(width);
      expect(n.y + n.h).toBeLessThanOrEqual(height);
    }
  });

  it('事件框两两不重叠（含上下异侧、同侧相邻）', () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const area = overlapArea(nodes[i], nodes[j]);
        expect(
          boxesOverlap(nodes[i], nodes[j]),
          `「${nodes[i].text}」与「${nodes[j].text}」重叠 ${area} px²`,
        ).toBe(false);
      }
    }
  });

  it('每个事件框与自己的引线在 x 上对齐（容差 1px），且轴点就在轴上', () => {
    for (const n of nodes) {
      expect(Math.abs(n.leaderX - (n.x + n.w / 2))).toBeLessThanOrEqual(1);
      expect(n.leaderFrom).toBe(metrics.axisY);
      expect(n.axisY).toBe(metrics.axisY);
    }
  });

  it('上下交替：偶数序号在上、奇数在下；框距轴恰好 24px，引线贴着框边（不穿框）', () => {
    nodes.forEach((n, i) => {
      expect(n.side).toBe(i % 2 === 0 ? 'up' : 'down');
      if (n.side === 'up') {
        expect(metrics.axisY - (n.y + n.h)).toBe(metrics.axisToBox);
        expect(n.leaderTo).toBe(n.y + n.h);
        expect(n.leaderTo).toBeLessThan(n.leaderFrom);
      } else {
        expect(n.y - metrics.axisY).toBe(metrics.axisToBox);
        expect(n.leaderTo).toBe(n.y);
        expect(n.leaderTo).toBeGreaterThan(n.leaderFrom);
      }
    });
  });

  it('相邻事件在轴上等距（间距 = slotW），且每个框在自己的等宽槽内水平居中', () => {
    const { slotW } = metrics;
    expect(slotW).toBe(metrics.maxItemW + 24);
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].leaderX - nodes[i - 1].leaderX).toBe(slotW);
    }
    nodes.forEach((n, i) => {
      const slotCenter = metrics.margin + i * slotW + slotW / 2;
      expect(Math.abs(n.slotCenterX - slotCenter)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(n.slotCenterX - (n.x + n.w / 2))).toBeLessThanOrEqual(1);
      // 框不许越过自己的槽（等宽槽是"不重叠"的几何保证）
      expect(n.x).toBeGreaterThanOrEqual(metrics.margin + i * slotW - 1);
      expect(n.x + n.w).toBeLessThanOrEqual(metrics.margin + (i + 1) * slotW + 1);
    });
  });

  it('轴居中于上下两个内容带之间：全图上边距 = 下边距 = margin', () => {
    const ups = nodes.filter((n) => n.side === 'up');
    const downs = nodes.filter((n) => n.side === 'down');
    expect(ups.length).toBeGreaterThan(0);
    expect(downs.length).toBeGreaterThan(0);
    expect(Math.min(...ups.map((n) => n.y))).toBe(metrics.margin);
    expect(height - Math.max(...downs.map((n) => n.y + n.h))).toBe(metrics.margin);
  });

  it('文字不丢：折行后拼接是 title 的前缀（仅允许末尾 … 截断，且中段不许出现 …）', () => {
    for (const n of nodes) {
      // 中段出现 … 说明行数预算被写死、把后面的 detail 挤掉了 —— 属于缺陷，直接报红
      expect(
        n.lines.slice(0, -1).some((l) => l.includes('…')),
        `「${n.title}」的折行中段出现截断标记：${n.lines.join(' / ')}`,
      ).toBe(false);
      const joined = solid(n.lines.join('').replace(/…$/, ''));
      expect(
        solid(n.title).startsWith(joined),
        `「${n.title}」被渲染成「${n.lines.join(' / ')}」`,
      ).toBe(true);
      // 本样例没有超长到需要截断的标签 → 允许更强的"一字不差"
      if (!n.lines.join('').includes('…')) expect(solid(n.title)).toBe(joined);
      // 三段各自的原文都必须完整落在 lines 里（按组校验，口径更严）
      for (const g of n.groups) {
        const gt = solid(g.lines.join('').replace(/…$/, ''));
        expect(solid(g.src).startsWith(gt), `「${g.src}」被渲染成「${g.lines.join(' / ')}」`).toBe(true);
      }
    }
  });

  it('框内文字不越出框：框宽 ≥ 最长行文字宽 + 2*padX', () => {
    for (const n of nodes) {
      const textW = n.groups.reduce(
        (m, g) => g.lines.reduce((mm, l) => Math.max(mm, estimateTextWidth(l, g.fs)), m),
        0,
      );
      expect(n.w).toBeGreaterThanOrEqual(textW + metrics.padX * 2 - 1);
      expect(n.w).toBeLessThanOrEqual(metrics.maxItemW);
    }
  });

  it('长 text + detail 并存时：行数预算给够，detail 不会被挤掉（中段截断的真实触发场景）', () => {
    // 这段 text 需要 4 行（>3），若把折行行数写死 3 行，'…' 就会掉在 text 与 detail 之间，
    // "只允许末尾 …" 的口径立刻不成立 —— 这条用例就是那个守卫的真实触发场景。
    const long = '中国共产党领导中国人民经过二十八年的浴血奋战终于取得了新民主主义革命的伟大胜利';
    const { nodes: ns } = layoutTimeline({ items: [
      { when: '1921—1949年', text: long, detail: '开国大典举行' },
      { when: '1956年', text: '三大改造完成', detail: '社会主义制度基本建立' },
    ] });
    const n = ns[0];
    expect(n.lines.length).toBeGreaterThan(3);
    expect(n.lines.slice(0, -1).some((l) => l.includes('…'))).toBe(false);
    expect(solid(n.title)).toBe(solid(n.lines.join('')));      // 一字不差
    expect(n.lines[n.lines.length - 1]).toBe('开国大典举行');    // detail 仍在最后
    // 相邻事件各行其政，不串内容
    expect(ns[1].lines).toContain('三大改造完成');
    expect(ns[1].lines).toContain('社会主义制度基本建立');
  });

  it('超长标签折行后每行宽度都不超过 maxLabelWidth', () => {
    const long = '从中华人民共和国成立到改革开放的伟大历史转折与社会主义现代化建设新时期';
    const { nodes: ns } = layoutTimeline({ items: [{ when: '1949—2024年', text: long, detail: long }] }, { maxLabelWidth: 120 });
    expect(ns.length).toBe(1);
    for (const g of ns[0].groups) {
      expect(g.lines.length).toBeGreaterThan(0);
      for (const l of g.lines) expect(estimateTextWidth(l, g.fs)).toBeLessThanOrEqual(120);
    }
  });

  it('日期行比正文更重、更大（黑白打印时字重仍能表达主次）', () => {
    const when = nodes[0].groups.find((g) => g.key === 'when');
    const text = nodes[0].groups.find((g) => g.key === 'text');
    expect(when.weight).toBe(600);
    expect(text.weight).toBe(400);
    expect(when.fs).toBeGreaterThanOrEqual(text.fs);
    expect(when.color).toBe(nodes[0].color);
    expect(text.color).not.toBe(when.color);
  });
});

describe('timeline · 出图', () => {
  it('SVG 结构：尺寸/viewBox 与版式一致，白底，闭合', () => {
    const { svg, width, height } = buildTimelineSvg(SAMPLE);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`height="${height}"`);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('<?xml');
    expect(svg).not.toContain('<!DOCTYPE');
    // 印刷约定：无阴影/渐变/外链资源
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('filter=');
    expect(svg).not.toContain('url(');
  });

  it('每个事件的 when/text/detail 都出现在 SVG 文本里；主轴与锚点都画了', () => {
    const { svg, nodes } = buildTimelineSvg(SAMPLE);
    for (const n of nodes) {
      for (const line of n.lines) expect(svg).toContain(`>${line}<`);
      expect(svg).toContain(`stroke="${n.color}"`);
    }
    // 每条引线 + 每个轴点都在（数量口径：node 数）
    expect((svg.match(/<circle /g) || []).length).toBe(nodes.length);
    expect((svg.match(/<line /g) || []).length).toBe(nodes.length + 1); // 引线 + 主轴
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('r="4"');
  });

  it('特殊字符被转义，文本节点里没有裸的尖括号', () => {
    const { svg } = buildTimelineSvg({ items: [{ when: 'a<b', text: 'x & "y"', detail: 'p > q' }] });
    expect(svg).toContain('a&lt;b');
    expect(svg).toContain('x &amp; &quot;y&quot;');
    expect(svg).toContain('p &gt; q');
    const texts = svg.match(/<text[^>]*>[^<]*<\/text>/g) || [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      const body = t.replace(/^<text[^>]*>/, '').replace(/<\/text>$/, '');
      expect(/[<>]/.test(body), `text 内容里有未转义的尖括号：${body}`).toBe(false);
    }
  });

  it('确定性：同样输入两次输出完全一致', () => {
    const a = buildTimelineSvg(SAMPLE).svg;
    const b = buildTimelineSvg(SAMPLE).svg;
    expect(a).toBe(b);
  });

  it('支持 labelTransform（公式线性化钩子，见 mindmap.js）', () => {
    const { svg } = buildTimelineSvg(
      { items: [{ when: '2024年', text: '$x^2$ 的图像' }] },
      { labelTransform: (s) => String(s).replace(/\$([^$]+)\$/g, '$1') },
    );
    expect(svg).toContain('x^2 的图像');
    expect(svg).not.toContain('$');
  });

  it('空 / 单元素 / 脏输入不崩，尺寸仍为正', () => {
    const cases = [{ items: [] }, {}, null, { items: [null] }, { items: ['只有文本'] }, { items: [{ when: '仅时间' }] }];
    for (const spec of cases) {
      const r = buildTimelineSvg(spec);
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
    }
  });

  it('单元素：唯一事件在轴上方，仍落在画布内', () => {
    const { nodes, width, height, metrics } = layoutTimeline({ items: [{ when: '1919年', text: '五四运动' }] });
    expect(nodes.length).toBe(1);
    expect(nodes[0].side).toBe('up');
    expect(nodes[0].y + nodes[0].h).toBe(metrics.axisY - metrics.axisToBox);
    expect(width).toBeGreaterThan(nodes[0].w);
    expect(height).toBeGreaterThan(nodes[0].h);
  });
});
