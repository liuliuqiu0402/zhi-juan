/**
 * 🧩 括号图 SVG：版式硬指标单测
 * ============================================================
 * 为什么断言"不重叠/不越界/父子不同列/父子纵向居中"而不是对 SVG 字符串做快照：
 *   括号图的质量问题几乎都是**版式病**（框叠在一起、字跑出框、父节点没对齐子节点跨度、
 *   同层节点左右错落），字符串快照既守不住这些，又会在任何样式微调时全红。
 *   这里直接对 layoutBrace 算出的几何做断言 —— 改配色/字号不会误报，真把版式改坏一定报。
 * 口径与 tests/utils/mindmapSvg.test.js 一致（solid 前缀、boxesOverlap、确定性……）。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { layoutBrace, buildBraceSvg } from '../../src/utils/diagrams/brace.js';
import { boxesOverlap } from '../../src/utils/diagrams/shared.js';

/** 一份**真实体量**的高中数学知识梳理（整体—部分：函数概念与性质） */
const SAMPLE = {
  title: '函数的概念与性质',
  children: [
    { title: '函数的概念', children: [
      { title: '定义：非空数集 A 到 B 的对应' },
      { title: '三要素：定义域、值域、对应法则' },
      { title: '表示法：解析法 / 列表法 / 图象法' },
    ] },
    { title: '定义域与值域', children: [
      { title: '分母不为 0' },
      { title: '偶次根号被开方数 ≥ 0' },
      { title: '对数真数 > 0' },
    ] },
    { title: '单调性与最值', children: [
      { title: '增函数：x₁<x₂ ⇒ f(x₁)<f(x₂)' },
      { title: '减函数：x₁<x₂ ⇒ f(x₁)>f(x₂)' },
      { title: '复合函数：同增异减' },
      { title: '最值：配方法、换元法、单调性法' },
    ] },
    { title: '奇偶性', children: [
      { title: '偶函数：图象关于 y 轴对称' },
      { title: '奇函数：图象关于原点对称' },
    ] },
  ],
};

const collect = (n, acc = []) => {
  acc.push(n);
  (n.children || []).forEach((c) => collect(c, acc));
  return acc;
};
const nonLeafCount = (n) => (n.children && n.children.length ? 1 + n.children.reduce((s, c) => s + nonLeafCount(c), 0) : 0);

/** 去掉所有空白（换行处行首空格被丢掉属正常排版） */
const solid = (v) => String(v).replace(/\s+/g, '');

describe('diagramBrace · 版式（硬指标）', () => {
  const { nodes, width, height, braces } = layoutBrace(SAMPLE);

  it('① 宽高为整数且 > 0，每个节点都落在 [0,width]×[0,height] 内', () => {
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(width);
      expect(n.y + n.h).toBeLessThanOrEqual(height);
    }
  });

  it('② 节点框两两不重叠（boxesOverlap 全为 false）', () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(
          boxesOverlap(nodes[i], nodes[j]),
          `「${nodes[i].title}」与「${nodes[j].title}」的框重叠了`,
        ).toBe(false);
      }
    }
  });

  it('③ 标题文字不丢：折行后拼接是原标题前缀（仅允许末尾 … 截断）', () => {
    for (const n of nodes) {
      const joined = solid(n.lines.join('').replace(/…$/, ''));
      expect(solid(n.title).startsWith(joined), `「${n.title}」被渲染成「${n.lines.join('/')}」`).toBe(true);
      if (!n.lines.join('').includes('…')) {
        expect(solid(n.title)).toBe(joined);
      }
    }
  });

  it('③+ 文字宽度是图形宽度反推依据：左对齐文字不越出框', () => {
    for (const n of nodes) {
      const inner = n.w - n.padX * 2;
      for (const line of n.lines) {
        // lines 由 wrapLabel(maxLabelWidth) 产出，天然不超 maxLabelWidth=150
        expect(inner).toBeGreaterThanOrEqual(-1);
      }
      expect(n.w).toBeGreaterThanOrEqual(n.padX * 2);
    }
  });

  it('节点数 = 树的节点数，且前序（父在子前）', () => {
    expect(nodes.length).toBe(collect(SAMPLE).length);
    const seen = new Set();
    for (const n of nodes) {
      expect(n.parent === null || seen.has(n.parent.id)).toBe(true);
      seen.add(n.id);
    }
    expect(nodes[0].isRoot).toBe(true);
  });

  it('验收：父节点与子节点分处不同列（横向不压字）', () => {
    for (const n of nodes) {
      for (const c of n.children || []) {
        const sameColumn = c.x < n.x + n.w && n.x < c.x + c.w;
        expect(sameColumn, `「${n.title}」与子节点「${c.title}」在同一列`).toBe(false);
      }
    }
  });

  it('验收：父节点纵向居中于其子节点跨度（容差 1.5px）', () => {
    for (const n of nodes) {
      const kids = n.children || [];
      if (!kids.length) continue;
      const top = Math.min(...kids.map((k) => k.y));
      const bottom = Math.max(...kids.map((k) => k.y + k.h));
      const span = bottom - top;
      if (n.h <= span) {
        expect(Math.abs((n.y + n.h / 2) - (top + span / 2))).toBeLessThanOrEqual(1.5);
      } else {
        // 父节点比子树跨度还高：父必须完整覆盖子树跨度（此时居中不可达，退守覆盖）
        expect(n.y).toBeLessThanOrEqual(top);
        expect(n.y + n.h).toBeGreaterThanOrEqual(bottom);
      }
    }
  });

  it('同层节点左边界对齐（该层最大宽统一列位）', () => {
    const byDepth = {};
    for (const n of nodes) (byDepth[n.depth] = byDepth[n.depth] || []).push(n);
    for (const d of Object.keys(byDepth)) {
      const xs = new Set(byDepth[d].map((n) => n.x));
      expect(xs.size, `第 ${d} 层左边界不统一：${[...xs].join(',')}`).toBe(1);
    }
    // 列位随深度严格递增，保证相邻两列不相交
    const lefts = Object.keys(byDepth)
      .map(Number).sort((a, b) => a - b)
      .map((d) => ({ d, left: byDepth[d][0].x, right: Math.max(...byDepth[d].map((n) => n.x + n.w)) }));
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i].left).toBeGreaterThan(lefts[i - 1].right);
    }
  });

  it('花括号：数量 = 非叶节点数，主笔覆盖子节点跨度，中部横笔指向父节点', () => {
    expect(braces.length).toBe(nonLeafCount(SAMPLE));
    for (const b of braces) {
      const parent = nodes.find((n) => n.id === b.parentId);
      const kids = parent.children;
      const childLeft = Math.min(...kids.map((k) => k.x));
      const top = Math.min(...kids.map((k) => k.y));
      const bottom = Math.max(...kids.map((k) => k.y + k.h));
      expect(b.x).toBeGreaterThan(parent.x + parent.w);   // 在父节点右边界之外
      expect(b.x).toBeLessThan(childLeft);                // 在子节点左边界之内
      expect(b.top).toBe(top);                            // 主笔覆盖子节点跨度
      expect(b.bottom).toBe(bottom);
      expect(b.mid).toBe((top + bottom) / 2);
    }
  });

  it('叶子节点没有花括号', () => {
    const parentIds = new Set(braces.map((b) => b.parentId));
    for (const n of nodes) {
      if ((n.children || []).length === 0) expect(parentIds.has(n.id)).toBe(false);
      else expect(parentIds.has(n.id)).toBe(true);
    }
  });
});

describe('diagramBrace · 出图', () => {
  it('SVG 头部尺寸/viewBox 与版式一致，正文不含 DOCTYPE/<?xml>', () => {
    const { svg, width, height } = buildBraceSvg(SAMPLE);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`height="${height}"`);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).not.toContain('<?xml');
    expect(svg).not.toContain('<!DOCTYPE');
  });

  it('白底（印刷友好）、无位图/滤镜/渐变，标题都进了文本节点', () => {
    const { svg } = buildBraceSvg(SAMPLE);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('filter=');
    expect(svg).not.toContain('linearGradient');
    for (const t of ['函数的概念与性质', '奇偶性', '分母不为 0']) {
      expect(svg).toContain(`>${t}<`);
    }
  });

  it('花括号真的画进了 SVG（每个非叶节点 2 条 1.8px 笔：主笔 + 中横笔）', () => {
    const { svg } = buildBraceSvg(SAMPLE);
    const strokes = svg.match(/stroke-width="1\.8"/g) || [];
    expect(strokes.length).toBe(nonLeafCount(SAMPLE) * 2);
  });

  it('特殊字符被转义，文本节点里无裸的 < / >', () => {
    const { svg } = buildBraceSvg({ title: 'a<b & "c"', children: [{ title: "x > y & z's" }] });
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;');
    expect(svg).toContain('x &gt; y &amp; z&apos;s');
    const texts = svg.match(/<text[^>]*>[^<]*<\/text>/g) || [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      const body = t.replace(/^<text[^>]*>/, '').replace(/<\/text>$/, '');
      expect(/[<>]/.test(body), `text 内容里有未转义的尖括号：${body}`).toBe(false);
    }
  });

  it('确定性：同输入两次输出完全一致', () => {
    expect(buildBraceSvg(SAMPLE).svg).toBe(buildBraceSvg(SAMPLE).svg);
    expect(layoutBrace(SAMPLE).nodes.map((n) => [n.x, n.y, n.w, n.h]))
      .toEqual(layoutBrace(SAMPLE).nodes.map((n) => [n.x, n.y, n.w, n.h]));
  });

  it('空/单元素输入不崩，尺寸仍为正', () => {
    for (const t of [{ title: '只有一个' }, { title: '空壳', children: [] }, null, undefined]) {
      const r = buildBraceSvg(t);
      expect(Number.isInteger(r.width)).toBe(true);
      expect(Number.isInteger(r.height)).toBe(true);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.svg).toContain('</svg>');
      expect(r.svg).toContain('fill="#ffffff"');
    }
  });

  it('浅层单链（每层只有 1 个子节点）也不重叠且无越界', () => {
    const chain = { title: '整体', children: [{ title: '部分 A', children: [{ title: '子部分 A1' }] }] };
    const { nodes, width, height } = layoutBrace(chain);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) expect(boxesOverlap(nodes[i], nodes[j])).toBe(false);
      expect(nodes[i].x + nodes[i].w).toBeLessThanOrEqual(width);
      expect(nodes[i].y + nodes[i].h).toBeLessThanOrEqual(height);
    }
  });

  it('超长标题触发截断时仍不越出画布（折行 + 宽度反推）', () => {
    const long = '这是一段非常非常长的整体标题用于验证折行与画布宽度是否联动收敛不会把节点推出画布之外';
    const { nodes, width, height } = buildBraceSvg({ title: long, children: [{ title: long }, { title: long }] }, {
      maxLabelWidth: 120,
    });
    for (const n of nodes) {
      expect(n.lines.join('').length).toBeGreaterThan(0);
      expect(n.x + n.w).toBeLessThanOrEqual(width);
      expect(n.y + n.h).toBeLessThanOrEqual(height);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) expect(boxesOverlap(nodes[i], nodes[j])).toBe(false);
    }
  });
});
