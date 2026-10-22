/**
 * 🧠 知识导图 SVG：版式硬指标单测
 * ============================================================
 * 为什么断言"不重叠/不越界/父子对齐"而不是对 SVG 字符串做快照：
 *   导图的质量问题几乎都是**版式病**（框叠在一起、字跑出框、连线穿过文字块），
 *   而字符串快照既守不住这些，又会在任何样式微调时全红。这里直接对 layoutMindmap
 *   算出的几何做断言 —— 改配色/字号不会误报，真把版式改坏一定报。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { layoutMindmap, buildMindmapSvg, wrapLabel, estimateTextWidth } from '../../src/utils/diagrams/mindmap.js';

/** 一份**真实体量**的高中数学知识梳理（不是三五个占位词） */
const SAMPLE = {
  title: '函数的概念与性质',
  children: [
    { title: '函数的概念', children: [
      { title: '定义：非空数集 A→B 的对应' },
      { title: '三要素：定义域、值域、对应法则' },
      { title: '表示法：解析法 / 列表法 / 图象法' },
    ] },
    { title: '定义域与值域', children: [
      { title: '分母不为 0' },
      { title: '偶次根号被开方数 ≥ 0' },
      { title: '对数真数 > 0' },
    ] },
    { title: '单调性', children: [
      { title: '增函数：x₁<x₂ ⇒ f(x₁)<f(x₂)' },
      { title: '减函数：x₁<x₂ ⇒ f(x₁)>f(x₂)' },
      { title: '复合函数：同增异减' },
    ] },
    { title: '奇偶性', children: [
      { title: '偶函数：f(−x)=f(x)，图象关于 y 轴对称' },
      { title: '奇函数：f(−x)=−f(x)，图象关于原点对称' },
    ] },
    { title: '幂函数', children: [
      { title: '五个常见幂函数及其图象' },
      { title: 'x>0 时在第一象限的单调性' },
    ] },
    { title: '函数应用', children: [
      { title: '零点存在定理' },
      { title: '二分法求方程近似解' },
    ] },
  ],
};

const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

const collectTitles = (n, acc = []) => {
  acc.push(n.title);
  (n.children || []).forEach((c) => collectTitles(c, acc));
  return acc;
};

describe('mindmapSvg · 版式', () => {
  for (const layout of ['balanced', 'right']) {
    describe(`版式 = ${layout}`, () => {
      const { nodes, width, height } = layoutMindmap(SAMPLE, { layout });

      it('宽高为正有限整数，且每个节点都落在画布内', () => {
        expect(Number.isFinite(width)).toBe(true);
        expect(Number.isFinite(height)).toBe(true);
        expect(Number.isInteger(width)).toBe(true);
        expect(Number.isInteger(height)).toBe(true);
        expect(width).toBeGreaterThan(100);
        expect(height).toBeGreaterThan(100);
        for (const n of nodes) {
          expect(n.x).toBeGreaterThanOrEqual(0);
          expect(n.y).toBeGreaterThanOrEqual(0);
          expect(n.x + n.w).toBeLessThanOrEqual(width);
          expect(n.y + n.h).toBeLessThanOrEqual(height);
        }
      });

      it('节点框两两不重叠（含跨子树、跨层）', () => {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const area = overlapArea(nodes[i], nodes[j]);
            expect(
              area,
              `「${nodes[i].title}」与「${nodes[j].title}」重叠 ${area} px²`,
            ).toBe(0);
          }
        }
      });

      it('节点数与树节点数一致，且顺序为前序（父在子前）', () => {
        expect(nodes.length).toBe(collectTitles(SAMPLE).length);
        const seen = new Set();
        for (const n of nodes) {
          expect(n.parent === null || seen.has(n.parent.id)).toBe(true);
          seen.add(n.id);
        }
      });

      it('父节点纵向与其子节点跨度对齐（父不高于子树时居中）', () => {
        for (const n of nodes) {
          const kids = n.children || [];
          if (!kids.length) continue;
          const top = Math.min(...kids.map((k) => k.y));
          const bottom = Math.max(...kids.map((k) => k.y + k.h));
          const span = bottom - top;
          if (n.isRoot) {
            // 根节点用的是另一套规则（见 layoutMindmap 注释）：balanced 压在画布中线上、
            // right 居中于首末子节点中心。这里只守两种版式都该成立的底线：
            // 根的中心必须落在**子节点中心**的区间内（不能整体飘到分支之上或之下）。
            const centers = kids.map((k) => k.y + k.h / 2);
            const c = n.y + n.h / 2;
            expect(c).toBeGreaterThanOrEqual(Math.min(...centers) - 1.5);
            expect(c).toBeLessThanOrEqual(Math.max(...centers) + 1.5);
            continue;
          }
          if (n.h <= span) {
            expect(Math.abs((n.y + n.h / 2) - (top + span / 2))).toBeLessThanOrEqual(1.5);
          } else {
            // 父节点比子树还高：父必须完整覆盖子树跨度
            expect(n.y).toBeLessThanOrEqual(top);
            expect(n.y + n.h).toBeGreaterThanOrEqual(bottom);
          }
        }
      });

      it('父节点与子节点分处不同列（横向不压字）', () => {
        for (const n of nodes) {
          for (const c of n.children || []) {
            const sameColumn = c.x < n.x + n.w && n.x < c.x + c.w;
            expect(sameColumn, `「${n.title}」与子节点「${c.title}」在同一列`).toBe(false);
          }
        }
      });
    });
  }

  it('左侧分支与右侧分支的横向列距对称（视觉不歪）', () => {
    const { nodes } = layoutMindmap(SAMPLE, { layout: 'balanced' });
    const L = nodes.filter((n) => n.side === -1);
    const R = nodes.filter((n) => n.side === 1);
    expect(L.length).toBeGreaterThan(0);
    expect(R.length).toBeGreaterThan(0);
    const root = nodes.find((n) => n.isRoot);
    const dist = (n) => (n.side === -1 ? root.x - (n.x + n.w) : n.x - (root.x + root.w));
    const dL = [...new Set(L.filter((n) => n.depth === 1).map((n) => Math.round(dist(n))))];
    const dR = [...new Set(R.filter((n) => n.depth === 1).map((n) => Math.round(dist(n))))];
    expect(dL).toEqual(dR);
  });

  it('balanced：根节点落在画布水平正中（左右留白对称，印刷不偏摆）', () => {
    const { nodes, width } = layoutMindmap(SAMPLE, { layout: 'balanced' });
    const root = nodes.find((n) => n.isRoot);
    expect(Math.abs(root.x + root.w / 2 - width / 2)).toBeLessThanOrEqual(1);
  });

  it('right 版式：全部分支在同一侧，根在最左', () => {
    const { nodes } = layoutMindmap(SAMPLE, { layout: 'right' });
    const root = nodes.find((n) => n.isRoot);
    expect(nodes.every((n) => n.isRoot || n.side === 1)).toBe(true);
    expect(nodes.every((n) => n.x >= root.x)).toBe(true);
  });

  it('标题文字不丢：折行后拼接是原标题的前缀（仅允许末尾省略号截断）', () => {
    const { nodes } = layoutMindmap(SAMPLE, { layout: 'balanced' });
    // 换行处的行首空格被丢掉属正常排版，比较时忽略空白，只守"非空白内容不许丢"
    const solid = (v) => v.replace(/\s+/g, '');
    for (const n of nodes) {
      const joined = solid(n.lines.join('').replace(/…$/, ''));
      expect(solid(n.title).startsWith(joined), `「${n.title}」被渲染成「${n.lines.join('/')}」`).toBe(true);
      // 没被截断的标签不该出现省略号
      if (!n.lines.join('').includes('…')) {
        expect(solid(n.title)).toBe(joined);
      }
    }
  });
});

describe('mindmapSvg · 折行与宽度估算', () => {
  it('短标签不折行', () => {
    expect(wrapLabel('函数的概念', 150, 13)).toEqual(['函数的概念']);
  });

  it('超长中文标签折行且不超宽', () => {
    const t = '从函数观点看一元二次方程和一元二次不等式及其应用';
    const lines = wrapLabel(t, 120, 13);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(estimateTextWidth(l, 13)).toBeLessThanOrEqual(120);
  });

  it('拉丁词不被从中间劈开', () => {
    const lines = wrapLabel('monotonicity increasing decreasing', 90, 13);
    for (const l of lines) {
      for (const w of l.trim().split(/\s+/)) {
        expect('monotonicity increasing decreasing').toContain(w.replace(/…$/, ''));
      }
    }
  });

  it('CJK 与拉丁混排宽度估算：CJK 更宽', () => {
    expect(estimateTextWidth('中文', 13)).toBeGreaterThan(estimateTextWidth('ab', 13));
  });
});

describe('mindmapSvg · 按内容自动横排（不设横/竖参数）', () => {
  // 2026-10-22 属主："4 的口诀 4 个可否在一行？排版中根据内容实际来排，不指定竖着或者横着"
  //   规则：全是叶子且条目短（≈8 字内）的分组，能并排几项就并排几项（上限 4），放不下换行；
  //   整块宽度卡在 460px 内——靠换行解决宽度，**不缩字号**。
  const KOUJUE = {
    title: '4 的乘法口诀',
    children: [
      { title: '口诀', children: [
        { title: '一四得四' }, { title: '二四得八' }, { title: '三四十二' }, { title: '四四十六' },
      ] },
    ],
  };
  const kidsOf = (nodes, parentTitle) => {
    const p = nodes.find((n) => n.title === parentTitle);
    expect(p, `找不到父节点「${parentTitle}」`).toBeTruthy();
    return p.children || [];
  };

  it('4 个短口诀排在同一行（同一 y、x 递增）', () => {
    const { nodes } = layoutMindmap(KOUJUE, { layout: 'right' });
    const ks = kidsOf(nodes, '口诀');
    expect(ks.length).toBe(4);
    expect(new Set(ks.map((k) => Math.round(k.y))).size, '同一行').toBe(1);
    const xs = ks.map((k) => k.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('短条目放不下就换行（宽度卡在版心内，不靠缩字号）', () => {
    const many = {
      title: 'r',
      children: [{ title: 'g', children: Array.from({ length: 7 }, (_, i) => ({ title: `第${i + 1}项` })) }],
    };
    const { nodes, metrics } = layoutMindmap(many, { layout: 'right' });
    const ks = kidsOf(nodes, 'g');
    const left = Math.min(...ks.map((k) => k.x));
    const right = Math.max(...ks.map((k) => k.x + k.w));
    expect(right - left, '整块不超 460px').toBeLessThanOrEqual(461);
    expect(new Set(ks.map((k) => Math.round(k.y))).size, '7 项 ⇒ 换行').toBeGreaterThan(1);
    expect(metrics.fontSize, '字号不因横排变小').toBe(13);
  });

  it('长条目仍竖排（横排会把长句挤成窄栏）', () => {
    const long = {
      title: 'r',
      children: [{ title: 'g', children: [
        { title: '三要素：定义域、值域、对应法则' },
        { title: '表示法：解析法、列表法与图象法' },
        { title: '单调性：同增异减与复合判定' },
      ] }],
    };
    const { nodes } = layoutMindmap(long, { layout: 'right' });
    const ks = kidsOf(nodes, 'g');
    expect(new Set(ks.map((k) => Math.round(k.y))).size, '一条一行').toBe(3);
  });

  it('只有两项不横排（少项没有排版收益）', () => {
    const two = { title: 'r', children: [{ title: 'g', children: [{ title: '甲项' }, { title: '乙项' }] }] };
    const { nodes } = layoutMindmap(two, { layout: 'right' });
    const ks = kidsOf(nodes, 'g');
    expect(new Set(ks.map((k) => Math.round(k.y))).size).toBe(2);
  });

  it('横排后仍不重叠、不出界（两种版式）', () => {
    for (const layout of ['balanced', 'right']) {
      const { nodes, width, height } = layoutMindmap(KOUJUE, { layout });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          expect(overlapArea(nodes[i], nodes[j]), `「${nodes[i].title}」与「${nodes[j].title}」重叠`).toBe(0);
        }
        expect(nodes[i].x).toBeGreaterThanOrEqual(0);
        expect(nodes[i].y).toBeGreaterThanOrEqual(0);
        expect(nodes[i].x + nodes[i].w).toBeLessThanOrEqual(width);
        expect(nodes[i].y + nodes[i].h).toBeLessThanOrEqual(height);
      }
    }
  });
});

describe('mindmapSvg · 出图', () => {
  it('SVG 头部尺寸与 viewBox 与版式一致', () => {
    const { svg, width, height } = buildMindmapSvg(SAMPLE, { layout: 'balanced' });
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('白底（印刷友好）且每个标题都出现在 SVG 文本里', () => {
    const { svg } = buildMindmapSvg(SAMPLE, { layout: 'balanced' });
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('filter=');
    for (const line of ['函数的概念与性质', '奇偶性', '零点存在定理']) {
      expect(svg).toContain(`>${line}<`);
    }
  });

  it('特殊字符被转义，不会破坏 SVG 结构', () => {
    const { svg } = buildMindmapSvg({ title: 'a<b & "c"', children: [{ title: "x > y & z's" }] }, { layout: 'right' });
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;');
    expect(svg).toContain('x &gt; y &amp; z&apos;s');
    // 文本节点里不允许出现裸的尖括号（会破坏 XML）；& 允许，因为它已被转义成 &amp;
    const texts = svg.match(/<text[^>]*>[^<]*<\/text>/g) || [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      const body = t.replace(/^<text[^>]*>/, '').replace(/<\/text>$/, '');
      expect(/[<>]/.test(body), `text 内容里有未转义的尖括号：${body}`).toBe(false);
    }
  });

  it('确定性：同样输入两次输出完全一致', () => {
    const a = buildMindmapSvg(SAMPLE, { layout: 'balanced' }).svg;
    const b = buildMindmapSvg(SAMPLE, { layout: 'balanced' }).svg;
    expect(a).toBe(b);
  });

  it('支持传"子节点数组 + rootTitle"，并支持 labelTransform（公式线性化钩子）', () => {
    const { svg } = buildMindmapSvg([{ title: '基本不等式' }], {
      rootTitle: '不等式',
      layout: 'right',
      labelTransform: (s) => String(s).replace(/\$([^$]+)\$/g, '$1'),
    });
    expect(svg).toContain('>不等式<');
    expect(svg).toContain('>基本不等式<');
  });

  it('空树/单节点不崩，尺寸仍为正', () => {
    for (const t of [{ title: '只有一个' }, { title: '空壳', children: [] }, null]) {
      const r = buildMindmapSvg(t, { layout: 'balanced' });
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.svg).toContain('</svg>');
    }
  });
});
