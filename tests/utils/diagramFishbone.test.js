/**
 * 🐟 鱼骨图 SVG：版式硬指标单测
 * ============================================================
 * 为什么断言"不重叠 / 不越界 / 锚点递增 / 等分内插 / 文字不丢"而不是对 SVG 做快照：
 *   鱼骨图的质量问题几乎都是**版式病**（框叠在一起、因框压住骨、下侧骨越到主脊上方、
 *   类别锚点排乱、折行把字挤没），字符串快照守不住这些，却会在任何配色微调时全红。
 *   这里直接对 layoutFishbone 算出的几何做断言 —— 换配色/字号不会误报，真改坏一定报。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { layoutFishbone, buildFishboneSvg, estimateTextWidth } from '../../src/utils/diagrams/fishbone.js';
import { boxesOverlap } from '../../src/utils/diagrams/shared.js';

/** 一份**真实体量**的鱼骨图（考试失误归因，六大类、每类 2~3 条因） */
const SAMPLE = {
  effect: '考试中审题失误率偏高',
  categories: [
    { name: '人（学生）', causes: ['读题粗心', '概念混淆', '计算跳步'] },
    { name: '机（工具）', causes: ['过度依赖计算器', '草稿纸凌乱'] },
    { name: '料（资料）', causes: ['教材例题偏少', '习题类型单一', '错题未整理'] },
    { name: '法（方法）', causes: ['答题步骤不规范', '时间分配失衡'] },
    { name: '环（环境）', causes: ['考场紧张', '平时限时训练不足'] },
    { name: '测（评价）', causes: ['缺少复盘', '周测频次偏低'] },
  ],
};

const solid = (v) => String(v == null ? '' : v).replace(/\s+/g, '');
const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const textWOf = (n) => n.lines.reduce((m, l) => Math.max(m, estimateTextWidth(l, n.fs)), 0);

describe('fishbone · 版式硬指标', () => {
  const { nodes, width, height, metrics } = layoutFishbone(SAMPLE);

  it('宽高为正有限整数，且每个节点完全落在画布内', () => {
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    // effect + 6 类别名 + 14 条因
    expect(nodes.length).toBe(1 + SAMPLE.categories.length + 14);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(width);
      expect(n.y + n.h).toBeLessThanOrEqual(height);
    }
  });

  it('所有框两两不重叠（effect / 类别名 / 因，含上下异侧与同侧）', () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const area = overlapArea(nodes[i], nodes[j]);
        expect(
          boxesOverlap(nodes[i], nodes[j]),
          `「${nodes[i].title}」与「${nodes[j].title}」重叠 ${area} px²`,
        ).toBe(false);
      }
    }
  });

  it('类别锚点 x 严格递增，且偶数在上、奇数在下（上下交替）', () => {
    const cats = nodes.filter((n) => n.kind === 'category').sort((a, b) => a.categoryIndex - b.categoryIndex);
    expect(cats.length).toBe(SAMPLE.categories.length);
    for (let i = 1; i < cats.length; i++) {
      expect(cats[i].anchorX).toBeGreaterThan(cats[i - 1].anchorX);
    }
    cats.forEach((c) => expect(c.side).toBe(c.categoryIndex % 2 === 0 ? 'up' : 'down'));
    // metrics.anchors 与节点字段同源
    expect(metrics.anchors).toEqual(cats.map((c) => c.anchorX));
  });

  it('骨几何：锚点在主脊上，末端 = 锚点 + (dx, ∓dy)（dx=96、dy=62）', () => {
    for (const c of nodes.filter((n) => n.kind === 'category')) {
      expect(c.anchorY).toBe(metrics.spineY);
      expect(c.tipX - c.anchorX).toBe(metrics.dx);
      expect(c.tipY - c.anchorY).toBe(c.side === 'up' ? -metrics.dy : metrics.dy);
    }
    expect(metrics.dx).toBe(96);
    expect(metrics.dy).toBe(62);
  });

  it('上下两侧天然分离：上侧所有框压在脊上方、下侧全在脊下方（跨侧不可能重叠）', () => {
    for (const n of nodes) {
      if (n.kind === 'effect') continue;                       // effect 骑在脊上（箭头正对）
      if (n.side === 'up') expect(n.y + n.h).toBeLessThan(metrics.spineY);
      else expect(n.y).toBeGreaterThan(metrics.spineY);
    }
  });

  it('因框沿骨等分内插：基准位 t=(j+1)/(m+1)，再朝本侧外侧偏移（近骨边离骨点恰好 14px）', () => {
    const byCat = new Map();
    for (const n of nodes.filter((x) => x.kind === 'cause')) {
      if (!byCat.has(n.categoryIndex)) byCat.set(n.categoryIndex, []);
      byCat.get(n.categoryIndex).push(n);
    }
    for (const [, list] of byCat) {
      list.sort((a, b) => a.causeIndex - b.causeIndex);
      const m = list.length;
      list.forEach((c, j) => {
        // 基准位 = 锚点 + (j+1)/(m+1) * (dx, ∓dy)；坐标是取整后的最终像素，容差 1px
        const expBaseX = ((j + 1) / (m + 1)) * metrics.dx;
        const expBaseY = ((j + 1) / (m + 1)) * (c.side === 'up' ? -metrics.dy : metrics.dy);
        expect(Math.abs(c.causeBaseX - c.anchorX - expBaseX)).toBeLessThanOrEqual(1);
        expect(Math.abs(c.causeBaseY - metrics.spineY - expBaseY)).toBeLessThanOrEqual(1);
        // 短竖线：与骨点同 x、长度 = 14px，且指向本侧外侧
        expect(c.connectorTo.x).toBe(c.boneX);
        expect(Math.abs(c.connectorTo.y - c.boneY)).toBe(metrics.causeGap);
        expect(metrics.causeGap).toBe(14);
        if (c.side === 'up') {
          expect(c.connectorTo.y).toBe(c.boneY - metrics.causeGap);
          expect(c.y + c.h).toBe(c.connectorTo.y);              // 近骨边 = 框下边
        } else {
          expect(c.connectorTo.y).toBe(c.boneY + metrics.causeGap);
          expect(c.y).toBe(c.connectorTo.y);                    // 近骨边 = 框上边
        }
        // 错开只沿骨向外：boneX 不小于基准、且逐条递增
        expect(c.shiftSteps).toBeGreaterThanOrEqual(0);
        expect(c.shiftSteps).toBeLessThanOrEqual(metrics.causeShiftMax);
        expect(c.boneX).toBeGreaterThanOrEqual(c.causeBaseX - 1e-9);
      });
      for (let j = 1; j < list.length; j++) {
        expect(list[j].boneX).toBeGreaterThanOrEqual(list[j - 1].boneX);
      }
    }
  });

  it('因框排版：字号 11px，框宽 = 实测行宽 + 2*padX（文字不越出）', () => {
    for (const c of nodes.filter((n) => n.kind === 'cause')) {
      expect(c.fs).toBe(metrics.causeFontSize);
      expect(c.fs).toBeGreaterThanOrEqual(11);
      expect(c.w).toBeGreaterThanOrEqual(textWOf(c) + c.padX * 2 - 1);
      expect(textWOf(c)).toBeLessThanOrEqual(110 + 1);         // 折行宽度上限
    }
  });

  it('effect 框：深底白字、字重 600，且在箭头右侧', () => {
    const eff = nodes.find((n) => n.kind === 'effect');
    expect(eff).toBeTruthy();
    expect(eff.boxFill).toBe('#2b3a4a');
    expect(eff.fill).toBe('#ffffff');
    expect(eff.weight).toBe(600);
    expect(eff.x).toBeGreaterThan(metrics.spineRightX);        // 箭头尖端右侧
    expect(eff.y).toBeLessThan(metrics.spineY);
    expect(eff.y + eff.h).toBeGreaterThan(metrics.spineY);     // 骑在主脊上
  });

  it('文字不丢：折行拼接是 title 的前缀（仅允许末尾 … 截断，中段不许出现 …）', () => {
    for (const n of nodes) {
      expect(
        n.lines.slice(0, -1).some((l) => l.includes('…')),
        `「${n.title}」的折行中段出现截断标记：${n.lines.join(' / ')}`,
      ).toBe(false);
      const joined = solid(n.lines.join('').replace(/…$/, ''));
      expect(
        solid(n.title).startsWith(joined),
        `「${n.title}」被渲染成「${n.lines.join(' / ')}」`,
      ).toBe(true);
    }
  });
});

describe('fishbone · 出图', () => {
  it('SVG 结构：尺寸/viewBox 与版式一致，白底，闭合，无阴影/渐变/外链', () => {
    const { svg, width, height } = buildFishboneSvg(SAMPLE);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`height="${height}"`);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('<?xml');
    expect(svg).not.toContain('<!DOCTYPE');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('filter=');
    expect(svg).not.toContain('url(');
  });

  it('主脊 + 箭头 + 骨 + 短竖线都画了（数量口径：1 脊 + n 骨 + 因数条引线）', () => {
    const { svg, nodes } = buildFishboneSvg(SAMPLE);
    expect(svg).toContain('stroke-width="2"');                 // 主脊
    expect(svg).toContain('<polygon');                          // 实心箭头
    expect(svg).toContain('stroke-width="1.6"');                // 骨
    expect(svg).toContain('stroke-width="1.3"');                // 类别名框
    expect(svg).toContain('stroke-width="1"');                  // 因框
    expect(svg).toContain('stroke-width="0.9"');                // 因引线
    const lineCount = (svg.match(/<line /g) || []).length;
    const catCount = nodes.filter((n) => n.kind === 'category').length;
    const causeCount = nodes.filter((n) => n.kind === 'cause').length;
    expect(lineCount).toBe(1 + catCount + causeCount);
    for (const n of nodes) for (const line of n.lines) expect(svg).toContain(`>${line}<`);
    for (const c of nodes.filter((n) => n.kind === 'category')) expect(svg).toContain(`stroke="${c.color}"`);
  });

  it('特殊字符被转义，文本节点里没有裸的尖括号', () => {
    const { svg } = buildFishboneSvg({
      effect: 'a<b & "c"',
      categories: [{ name: 'x & "y"', causes: ['p > q'] }],
    });
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;');
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
    const a = buildFishboneSvg(SAMPLE).svg;
    const b = buildFishboneSvg(SAMPLE).svg;
    expect(a).toBe(b);
  });

  it('支持 labelTransform（公式线性化钩子，见 mindmap.js）', () => {
    const { svg } = buildFishboneSvg(
      { effect: '$S=vt$ 漏乘', categories: [{ name: '公式', causes: ['$a^2+b^2$ 记错'] }] },
      { labelTransform: (s) => String(s).replace(/\$([^$]+)\$/g, '$1') },
    );
    expect(svg).toContain('S=vt 漏乘');
    expect(svg).toContain('a^2+b^2 记错');
    expect(svg).not.toContain('$');
  });

  it('空 / 单类别 / 脏输入不崩，尺寸仍为正，节点都在画布内', () => {
    const cases = [
      { effect: '', categories: [] },
      {},
      null,
      { effect: '只有结果' },
      { categories: [{ name: '人', causes: [] }] },
      { effect: 'x', categories: [null, { name: '', causes: [null, ''] }, '只有名字'] },
      { effect: 'x', categories: [{ name: '人', causes: [{ text: '含对象的因' }] }] },
    ];
    for (const spec of cases) {
      const r = buildFishboneSvg(spec);
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

  it('单类别：锚点在脊上、骨只朝上，整图仍自洽', () => {
    const { nodes, width, height, metrics } = layoutFishbone({ effect: '结果', categories: [{ name: '人', causes: ['因1', '因2', '因3'] }] });
    const cat = nodes.find((n) => n.kind === 'category');
    expect(cat.side).toBe('up');
    expect(cat.anchorX).toBeGreaterThan(0);
    expect(cat.tipY).toBe(metrics.spineY - metrics.dy);
    expect(nodes.filter((n) => n.kind === 'cause').every((n) => n.side === 'up')).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('拥挤输入（较长因名 + 多条因）下，同类因框靠"沿骨错开"仍不重叠', () => {
    const causes = ['读题时很粗心', '概念容易记混', '计算过程跳步'];
    const { nodes } = layoutFishbone({ effect: '失误', categories: [{ name: '人（学生）', causes }] });
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(boxesOverlap(nodes[i], nodes[j]), `「${nodes[i].title}」与「${nodes[j].title}」重叠`).toBe(false);
      }
    }
    const shifted = nodes.filter((n) => n.kind === 'cause');
    expect(shifted.some((n) => n.shiftSteps > 0)).toBe(true);    // 至少触发过一次错开
  });
});
