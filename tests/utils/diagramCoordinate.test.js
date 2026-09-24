/**
 * 📈 坐标系 / 函数图象 SVG：版式硬指标 + 表达式求值器单测
 * ============================================================
 * 为什么断言"不重叠 / 不越界 / 文字不丢 / 刻度间距 / 断点断开 / 无 NaN"而不是对 SVG 做快照：
 *   坐标系的质量问题几乎都是**版式病**（刻度数字互相压住、"0"画两遍、曲线穿过渐近线连成一条
 *   跨越整幅的直线、越界点把画布撑爆、数据标注压住刻度），字符串快照既守不住这些，
 *   又会在任何配色/字号微调时全红。这里直接对 layoutCoordinate 算出的几何做断言。
 *
 * 🔴 重叠断言只覆盖 **solid:true 的文字框**（刻度值、数据标注、标题）：
 *   曲线包围盒/数据点标记框是"几何量"，与曲线、坐标轴天然相交（曲线本来就要穿过坐标轴），
 *   把它们拉进重叠断言只会逼出假阳性。几何框的硬指标是"必须完全落在画布内"（见 ①）。
 * ============================================================
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import {
  layoutCoordinate, buildCoordinateSvg, projectPoint, resolveColor,
} from '../../src/utils/diagrams/coordinate.js';
import {
  evaluateExpression, sampleExpression, compileMathExpression,
  setMathExprWarnSink, normalizeMathSource, MATH_FUNCTION_NAMES,
} from '../../src/utils/diagrams/mathExpr.js';
import { boxesOverlap } from '../../src/utils/diagrams/shared.js';

setMathExprWarnSink(null);   // 默认静音（求值器自身的告警有专门的用例）

/** 一份**真实体量**的坐标系（二次函数 + 一条直线 + 3 个数据点，含一个无标注点） */
const SAMPLE = {
  type: 'coordinate',
  xlim: [-6, 6],
  ylim: [-10, 10],
  grid: true,
  title: '二次函数 y = x² − 2x − 3 的图象',
  series: [
    { expr: 'x**2 - 2*x - 3', color: 'blue' },
    { expr: '2*x + 1', color: '#1f7a5c', domain: [-6, 4] },
  ],
  points: [
    { x: 1, y: -4, label: '顶点 (1,-4)', color: 'red' },
    { x: -1, y: 0, label: '' },
    { x: 3, y: 0, label: '零点' },
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
const assertNoOverlapAmongBoxes = (nodes, width, height) => {
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

/* ============================ ① 表达式求值器 ============================ */

describe('diagramCoordinate · 表达式求值器（mathExpr）', () => {
  const E = evaluateExpression;

  it('正确性：x**2-2*x-3 在 x=1 得 -4', () => {
    expect(E('x**2 - 2*x - 3', 1)).toBe(-4);
    expect(E('x**2 - 2*x - 3', 3)).toBe(0);
    expect(E('x**2 - 2*x - 3', -1)).toBe(0);
    expect(E('2*x + 1', 0)).toBe(1);
  });

  it('优先级 / 结合性 / 一元号', () => {
    expect(E('2+3*4', 0)).toBe(14);
    expect(E('(2+3)*4', 0)).toBe(20);
    expect(E('2^3^2', 0)).toBe(512);          // 幂右结合
    expect(E('2**3', 0)).toBe(8);              // ** 与 ^ 同义
    expect(E('-2^2', 0)).toBe(-4);             // 一元号弱于 ^（与课本一致）
    expect(E('2^-1', 0)).toBe(0.5);
    expect(E('-(1+2)', 0)).toBe(-3);
    expect(E('+x', 3)).toBe(3);
    expect(E('10-3-2', 0)).toBe(5);            // 减法左结合
    expect(E('8/4/2', 0)).toBe(1);
    expect(E('2*(3+4)/7', 0)).toBe(2);
  });

  it('常量与全部内置函数', () => {
    expect(E('pi', 0)).toBeCloseTo(Math.PI, 12);
    expect(E('e', 0)).toBeCloseTo(Math.E, 12);
    expect(E('sqrt(9)', 0)).toBe(3);
    expect(E('abs(-4)', 0)).toBe(4);
    expect(E('sin(pi/2)', 0)).toBeCloseTo(1, 12);
    expect(E('cos(0)', 0)).toBe(1);
    expect(E('tan(0)', 0)).toBe(0);
    expect(E('asin(1)', 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(E('acos(1)', 0)).toBe(0);
    expect(E('atan(1)', 0)).toBeCloseTo(Math.PI / 4, 12);
    expect(E('log(100)', 0)).toBeCloseTo(2, 12);
    expect(E('ln(e)', 0)).toBeCloseTo(1, 12);
    expect(E('exp(0)', 0)).toBe(1);
    expect(E('floor(1.7)', 0)).toBe(1);
    expect(E('ceil(1.2)', 0)).toBe(2);
    expect(E('round(2.6)', 0)).toBe(3);
    expect(E('sqrt(abs(x))', -16)).toBe(4);
    expect(E('sqrt(x**2)', -5)).toBe(5);
    // 写法规整但不常见的形态也能吃下（模型输出容错）
    expect(E('x²', 3)).toBe(9);
    expect(E('2×x', 3)).toBe(6);
    expect(E('6÷2', 0)).toBe(3);
    expect(E('x−1', 2)).toBe(1);
    expect(E('sin(pi)  ', 0)).toBeCloseTo(0, 12);
  });

  it('定义域外 / 非有限结果一律返回 null（采样侧据此跳过）', () => {
    expect(E('sqrt(x)', -1)).toBeNull();
    expect(E('log(x)', 0)).toBeNull();
    expect(E('log(x)', -5)).toBeNull();
    expect(E('ln(x)', 0)).toBeNull();
    expect(E('asin(x)', 2)).toBeNull();
    expect(E('1/x', 0)).toBeNull();
    expect(E('x^0.5', -4)).toBeNull();
    expect(E('sqrt(x)', 0)).toBe(0);
    expect(E('ln(x)', 1)).toBe(0);
  });

  it('非法表达式返回 null 并告警，合法表达式不告警', () => {
    const warns = [];
    setMathExprWarnSink((m) => warns.push(m));
    expect(E('x^2 + 1', 2)).toBe(5);
    expect(warns).toEqual([]);

    const BAD = [
      '', '   ', null, undefined, 'x++', '2x', '2 x', 'foo(1)', 'sin x', 'sin', '(1+2',
      '1+', '*3', 'x)', 'x}', '1..2', '2..', 'x^', '1/x=', 'x?y', 'sqrt()', '1,2',
    ];
    for (const bad of BAD) {
      expect(E(bad, 1), `「${bad}」应判非法`).toBeNull();
      expect(compileMathExpression(bad)).toBeNull();
    }
    expect(warns.length).toBeGreaterThan(0);
    setMathExprWarnSink(null);
  });

  it('🔴 源码里不得出现动态代码执行手段（表达式来自模型输出）', () => {
    // ⚠️ 这里刻意用 process.cwd() 拼路径：Vite 会把测试里的 `new URL(相对路径, import.meta.url)`
    //    当作"资源引用"改写，解析结果并不是测试文件所在目录（实测指到了盘根）。
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    for (const f of ['mathExpr.js', 'coordinate.js', 'shapes.js']) {
      const code = strip(readFileSync(resolve(process.cwd(), 'src/utils/diagrams', f), 'utf8'));
      expect(/eval\s*\(/.test(code), `${f} 出现 eval(...)`).toBe(false);
      expect(/new\s+Function/.test(code), `${f} 出现 new Function`).toBe(false);
      expect(/Function\s*\(/.test(code), `${f} 出现 Function(...)`).toBe(false);
    }
    expect(MATH_FUNCTION_NAMES).toContain('sqrt');
    expect(typeof normalizeMathSource('（1）')).toBe('string');
  });

  it('采样：240 点；1/x 在 x≈0 处断开；定义域外跳过；越界处截在可视边界', () => {
    const r = sampleExpression('1/x', [-6, 6], { count: 240, view: [-6, 6] });
    expect(r.ok).toBe(true);
    expect(r.samples.length).toBe(240);
    expect(r.segmentCount).toBe(2);                      // 两支，不连成一条跨越整幅的线
    expect(r.maxJump).toBeLessThanOrEqual(6);            // 段内跳变 ≤ 可视跨度的一半
    for (const seg of r.segments) expect(seg.length).toBeGreaterThan(2);

    const s = sampleExpression('sqrt(x)', [-6, 6], { count: 240, view: [-6, 6] });
    expect(s.samples.some((p) => p.y == null)).toBe(true);
    expect(s.segmentCount).toBe(1);
    for (const seg of s.segments) for (const p of seg) expect(p.x).toBeGreaterThanOrEqual(-1e-9);

    expect(sampleExpression('', [-1, 1], {}).ok).toBe(false);
    expect(sampleExpression('1/0', [-1, 1], {}).segmentCount).toBe(0);
  });

  it('🔴 连续但极陡的直线不得被误判为断点（只看跳变会画出断裂的直线）', () => {
    const r = sampleExpression('100*x', [-6, 6], { count: 240, view: [-10, 10] });
    expect(r.segmentCount).toBe(1);
    expect(r.maxJump).toBeGreaterThan(2);                 // 确实是"陡"的
    const seg = r.segments[0];
    expect(seg[0].y).toBeCloseTo(-10, 6);                 // 两端截在可视边界上
    expect(seg[seg.length - 1].y).toBeCloseTo(10, 6);
  });

  it('🔴 符号阶跃（abs(x)/x）必须断开，连续函数必须保持一段', () => {
    const step = sampleExpression('abs(x)/x', [-2, 2], { count: 240, view: [-2, 2] });
    expect(step.segmentCount).toBe(2);                    // ±1 两支，不能连成一条竖线
    const tan = sampleExpression('tan(x)', [-2, 2], { count: 240, view: [-2, 2] });
    expect(tan.segmentCount).toBeGreaterThanOrEqual(1);
    for (const expr of ['x^2', 'sin(pi*x)', '2*x+1', 'sqrt(x)', 'ln(x)', 'exp(x)/10']) {
      const r = sampleExpression(expr, [-2, 2], { count: 240, view: [-2, 2] });
      expect(r.segmentCount, `${expr} 应保持连续（一段）`).toBe(1);
    }
    expect(sampleExpression('1/(x-1)', [-2, 2], { count: 240, view: [-2, 2] }).segmentCount).toBe(2);
  });
});

/* ============================ ② 版式硬指标 ============================ */

describe('diagramCoordinate · 版式硬指标', () => {
  const layout = layoutCoordinate(SAMPLE);
  const { nodes, width, height, metrics: m } = layout;

  it('① 宽高为正有限整数，且**每个**节点（含几何框）都落在画布内', () => {
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(nodes.length).toBeGreaterThan(10);
    for (const n of nodes) {
      expect(inCanvas(n, width, height), `「${n.title}」越界`).toBe(true);
    }
    // 绘图区必须落在画布内
    expect(m.plotLeft).toBeGreaterThan(0);
    expect(m.plotTop).toBeGreaterThan(0);
    expect(m.plotRight).toBeLessThan(width);
    expect(m.plotBottom).toBeLessThan(height);
  });

  it('② 文字框（solid）两两不重叠', () => {
    assertNoOverlapAmongBoxes(nodes, width, height);
  });

  it('③ 文字不丢：折行拼接是 title 的前缀（仅允许末尾 … 截断），框宽由实测宽度反推', () => {
    for (const n of boxNodes(nodes)) {
      const joined = solid(n.lines.join('').replace(/…$/, ''));
      expect(solid(n.title).startsWith(joined), `「${n.title}」被渲染成「${n.lines.join('/')}」`).toBe(true);
      expect(n.lines.slice(0, -1).some((l) => l.includes('…')), `「${n.title}」中段出现截断`).toBe(false);
      if (!n.lines.join('').includes('…')) expect(solid(n.title)).toBe(joined);
      const tw = Math.max(...n.lines.map((l) => (l ? l.length * n.fs * 0.42 : 0)));
      expect(n.w).toBeGreaterThanOrEqual(Math.min(tw, 6));
      expect(n.h).toBeGreaterThanOrEqual(n.lines.length * n.lineH);
    }
  });

  it('④ 刻度：步长走 nice number，像素间距足够（刻度文字几何上不可能重叠）', () => {
    const nice = (s) => {
      const ratio = s / Math.pow(10, Math.floor(Math.log10(s) + 1e-12));
      return [1, 2, 5].some((k) => Math.abs(ratio - k) < 1e-9);
    };
    expect(nice(m.tickStepX)).toBe(true);
    expect(nice(m.tickStepY)).toBe(true);
    expect(m.tickSpacingX).toBeGreaterThanOrEqual(m.tickMaxLabelWX + 10 - 0.5);
    expect(m.tickSpacingY).toBeGreaterThanOrEqual(30);          // 纵轴还要求 ≥ 2 倍标签高 + 6
    expect(m.tickFontSize).toBeGreaterThanOrEqual(9);
    // 刻度值覆盖到两端、且每个刻度值都有对应文字框（0 由纵轴独占）
    expect(m.tickValuesX.length).toBeGreaterThan(3);
    expect(m.tickValuesY.length).toBeGreaterThan(3);
    const ticks = boxNodes(nodes).filter((n) => n.kind === 'axis-tick');
    const expectCount = m.tickValuesX.filter((v) => Math.abs(v) > 1e-9).length
      + m.tickValuesY.filter((v) => Math.abs(v) > 1e-9).length;
    expect(ticks.length).toBe(expectCount);
  });

  it('⑤ 数据点：标记框与数据坐标一一对应，标注文字进 lines', () => {
    const markers = nodes.filter((n) => n.kind === 'point-marker');
    expect(markers.length).toBe(SAMPLE.points.length);
    for (const mk of markers) {
      const p = projectPoint(m, mk.dataX, mk.dataY);
      const cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      expect(mk.px).toBeCloseTo(cl(p.x, m.plotLeft, m.plotRight), 6);
      expect(mk.py).toBeCloseTo(cl(p.y, m.plotTop, m.plotBottom), 6);
      expect(mk.w).toBe(8);
      expect(mk.h).toBe(8);
    }
    expect(m.points.length).toBe(SAMPLE.points.length);
    expect(boxNodes(nodes).filter((n) => n.kind === 'point-label').length).toBe(2);
    expect(boxNodes(nodes).some((n) => n.title === '顶点 (1,-4)')).toBe(true);
  });

  it('⑥ 曲线：定义域断点处断开，包围盒落在绘图区内', () => {
    const { metrics: recip } = layoutCoordinate({ xlim: [-6, 6], ylim: [-6, 6], series: [{ expr: '1/x' }] });
    expect(recip.sampleCount).toBe(240);
    expect(recip.series[0].segmentCount).toBe(2);
    expect(recip.series[0].breaks).toBe(1);
    expect(recip.series[0].maxJumpPx).toBeLessThanOrEqual(recip.plotHeight * 0.5 + 2);
    const b = recip.series[0].bbox;
    expect(b).toBeTruthy();
    expect(b.x).toBeGreaterThanOrEqual(recip.plotLeft - 4);
    expect(b.x + b.w).toBeLessThanOrEqual(recip.plotRight + 4);
    expect(b.y).toBeGreaterThanOrEqual(recip.plotTop - 4);
    expect(b.y + b.h).toBeLessThanOrEqual(recip.plotBottom + 4);
  });

  it('曲线字段：两条 series 的采样点数、颜色（颜色名已被解析成色值）', () => {
    expect(m.series.length).toBe(SAMPLE.series.length);
    for (const s of m.series) {
      expect(s.sampleCount).toBe(240);
      expect(s.ok).toBe(true);
      expect(s.pointCount).toBeGreaterThan(10);
      expect(/^#[0-9a-f]{6}$/i.test(s.color)).toBe(true);
    }
    expect(m.series[0].color).toBe(resolveColor('blue'));
    expect(m.series[0].color).toBe('#2b5ea7');
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
    expect(nodes.some((n) => n.solid === false)).toBe(true);      // 曲线包围盒
    expect(boxNodes(nodes).every((n) => n.lines.length > 0)).toBe(true);
  });

  it('映射自洽：原点映射到两轴交点；xlim/ylim 端点映射到绘图区边界', () => {
    expect(projectPoint(m, 0, 0).x).toBeCloseTo(m.axisX, 6);
    expect(projectPoint(m, 0, 0).y).toBeCloseTo(m.axisY, 6);
    expect(projectPoint(m, m.xlim[0], m.ylim[0]).x).toBeCloseTo(m.plotLeft, 6);
    expect(projectPoint(m, m.xlim[1], m.ylim[1]).x).toBeCloseTo(m.plotRight, 6);
    expect(projectPoint(m, m.xlim[0], m.ylim[0]).y).toBeCloseTo(m.plotBottom, 6);
    expect(projectPoint(m, m.xlim[1], m.ylim[1]).y).toBeCloseTo(m.plotTop, 6);
  });

  it('boxNodes 辅助口径自检：至少包含标题 + 刻度 + 数据标注', () => {
    const kinds = new Set(boxNodes(nodes).map((n) => n.kind));
    expect(kinds.has('title')).toBe(true);
    expect(kinds.has('axis-tick')).toBe(true);
    expect(kinds.has('point-label')).toBe(true);
  });
});

/* ============================ ③ 出图 ============================ */

describe('diagramCoordinate · 出图', () => {
  beforeAll(() => setMathExprWarnSink(null));

  it('④ SVG 结构：尺寸/viewBox 与版式一致，白底，闭合，无 DOCTYPE/<?xml>', () => {
    const { svg, width, height } = buildCoordinateSvg(SAMPLE);
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

  it('出图字符串里不得出现 NaN / undefined / null', () => {
    for (const spec of [SAMPLE, { xlim: [-1, 1], ylim: [-1, 1] }, { series: [{ expr: 'oops(' }] }]) {
      const { svg } = buildCoordinateSvg(spec);
      expect(/NaN/.test(svg), '出现 NaN').toBe(false);
      expect(/undefined/.test(svg), '出现 undefined').toBe(false);
      expect(/\bnull\b/.test(svg), '出现 null').toBe(false);
    }
  });

  it('轴 / 箭头 / 网格 / 曲线齐全：两条曲线两条 path，两个箭头 polygon，网格淡灰', () => {
    const { svg, metrics: m } = buildCoordinateSvg(SAMPLE);
    expect((svg.match(/<path /g) || []).length).toBe(SAMPLE.series.length);
    expect(svg).toContain('stroke-width="2.2"');                 // 曲线线宽
    expect((svg.match(/<polygon /g) || []).length).toBe(2);       // x/y 轴各一个实心箭头
    expect(svg).toContain('#dfe6ee');                             // 网格
    expect(svg).toContain(`stroke-width="${2}"`);                 // 轴线宽
    expect((svg.match(/<circle /g) || []).length).toBe(SAMPLE.points.length);
    // 网格线数量 = 落在范围内的刻度条数
    expect((svg.match(/<line /g) || []).length).toBe(2 + m.tickValuesX.length + m.tickValuesY.length);
  });

  it('grid=false 时不画网格（其余照旧）', () => {
    const { svg, metrics: m } = buildCoordinateSvg({ ...SAMPLE, grid: false });
    expect(svg).not.toContain('#dfe6ee');
    expect(m.grid).toBe(false);
    expect((svg.match(/<line /g) || []).length).toBe(2);
  });

  it('刻度值都出现在 SVG 里，且刻度文字画在最后（网格与曲线不得压住刻度文字）', () => {
    const { svg, metrics: m } = buildCoordinateSvg(SAMPLE);
    const labels = [];
    for (const [vals, step] of [[m.tickValuesX, m.tickStepX], [m.tickValuesY, m.tickStepY]]) {
      for (const v of vals) {
        if (Math.abs(v) < 1e-9) continue;
        const dec = String(step).includes('.') ? String(step).split('.')[1].length : 0;
        labels.push(Number(v.toFixed(dec + 2)).toFixed(dec));
      }
    }
    for (const l of labels) expect(svg, `刻度「${l}」没出现`).toContain(`>${l}<`);
    expect(labels.length).toBeGreaterThan(6);
    // 曲线/图形都在文字之前 → 最后一个 <text> 必须晚于最后一个 <path>
    expect(svg.lastIndexOf('<path ')).toBeLessThan(svg.lastIndexOf('</text>'));
    // 每个文字框都垫了白底（压住网格与曲线）
    expect((svg.match(/fill="#ffffff"/g) || []).length).toBeGreaterThanOrEqual(boxNodes(buildCoordinateSvg(SAMPLE).nodes).length);
  });

  it('point 标注与标题都进了 <text>，曲线表达式不进文字层（只做几何）', () => {
    const { svg } = buildCoordinateSvg(SAMPLE);
    expect(svg).toContain('>顶点 (1,-4)<');
    expect(svg).toContain('>零点<');
    expect(svg).toContain('二次函数 y = x² − 2x − 3 的图象');
    expect(svg).not.toContain('x**2 - 2*x - 3');
  });

  it('④ 特殊字符被转义，文本节点里无裸的 < / >', () => {
    const { svg } = buildCoordinateSvg({
      title: 'a<b & "c"',
      xlim: [-2, 2],
      ylim: [-2, 2],
      series: [{ expr: 'x**2' }],
      points: [{ x: 1, y: 1, label: "x > y & z's" }, { x: -1, y: 1, label: 'p < q' }],
    });
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;');
    expect(svg).toContain('x &gt; y &amp; z&apos;s');
    expect(svg).toContain('p &lt; q');
    const texts = svg.match(/<text[^>]*>[^<]*<\/text>/g) || [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      const body = t.replace(/^<text[^>]*>/, '').replace(/<\/text>$/, '');
      expect(/[<>]/.test(body), `text 内容里有未转义的尖括号：${body}`).toBe(false);
    }
  });

  it('⑤ 确定性：同样输入两次输出完全一致', () => {
    expect(layoutCoordinate(SAMPLE)).toEqual(layoutCoordinate(SAMPLE));
    expect(buildCoordinateSvg(SAMPLE).svg).toBe(buildCoordinateSvg(SAMPLE).svg);
    expect(buildCoordinateSvg({ xlim: [0, 4], ylim: [0, 4] }).svg)
      .toBe(buildCoordinateSvg({ xlim: [0, 4], ylim: [0, 4] }).svg);
  });

  it('支持 labelTransform（公式线性化钩子，见 mindmap.js）与自定义调色板', () => {
    const { svg } = buildCoordinateSvg(
      { title: '$y=x^2$', xlim: [-2, 2], ylim: [-2, 2], series: [{ expr: 'x^2' }] },
      { labelTransform: (s) => String(s).replace(/\$([^$]+)\$/g, '$1'), palette: ['#123456'] },
    );
    expect(svg).toContain('y=x^2');
    expect(svg).not.toContain('$');
    expect(svg).toContain('#123456');
  });
});

/* ============================ ④ 边界与健壮性 ============================ */

describe('diagramCoordinate · 边界与健壮性', () => {
  beforeAll(() => setMathExprWarnSink(null));

  const CASES = [
    null,
    undefined,
    {},
    { xlim: [] },
    { xlim: [5, 5] },
    { xlim: [3, 1], ylim: [1, 1] },
    { xlim: [0, 0], ylim: [0, 0] },
    { series: [] },
    { series: [null, {}, { expr: '' }, { expr: 'oops(' }] },
    { series: [{ expr: 'x', domain: [1, 1] }] },
    { points: [null, {}, { x: 1 }, { x: 'a', y: 2 }, { x: 0, y: 0 }] },
    { series: [{ expr: '1/x' }], points: [{ x: 0, y: 0, label: '原点' }], xlim: [-1, 1], ylim: [-1, 1] },
    { series: [{ expr: 'x^2' }], points: [{ x: 1, y: 1, label: '超长标注'.repeat(20) }] },
  ];

  it('⑥ 空 / 脏输入不崩，尺寸仍为正整数，节点不越界且文字框互不重叠', () => {
    for (const spec of CASES) {
      const r = buildCoordinateSvg(spec);
      expect(Number.isInteger(r.width), `width=${r.width}`).toBe(true);
      expect(Number.isInteger(r.height)).toBe(true);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.svg).toContain('</svg>');
      expect(r.svg).toContain('fill="#ffffff"');
      expect(/NaN/.test(r.svg)).toBe(false);
      assertNoOverlapAmongBoxes(r.nodes, r.width, r.height);
    }
  });

  it('⑥ 单点输入：画布比绘图区大，原点独占"0"（不会两个 0 叠在一起）', () => {
    const { nodes, width, height, metrics: m } = layoutCoordinate({ xlim: [-1, 1], ylim: [-1, 1] });
    expect(width).toBeGreaterThan(m.plotWidth);
    expect(height).toBeGreaterThan(m.plotHeight);
    const zeros = boxNodes(nodes).filter((n) => n.title === '0');
    expect(zeros.length).toBe(0);                     // 原点不重复标注
    expect(m.tickValuesX.some((v) => Math.abs(v) < 1e-9)).toBe(true);
    expect(m.tickValuesY.some((v) => Math.abs(v) < 1e-9)).toBe(true);
  });

  it('xlim/ylim 反转或缺失时自动纠正；非法表达式只丢那条曲线', () => {
    const rev = layoutCoordinate({ xlim: [6, -6], ylim: [10, -10], series: [{ expr: 'x' }] });
    expect(rev.metrics.xlim).toEqual([-6, 6]);
    expect(rev.metrics.ylim).toEqual([-10, 10]);
    const bad = layoutCoordinate({ series: [{ expr: 'oops(' }, { expr: 'sqrt(x)' }] });
    expect(bad.metrics.series.length).toBe(2);
    expect(bad.metrics.series[0].ok).toBe(false);
    expect(bad.metrics.series[0].segmentCount).toBe(0);
    expect(bad.metrics.series[1].ok).toBe(true);
    expect(bad.nodes.some((n) => n.kind === 'series')).toBe(true);
  });

  it('超长标注折行后仍不越界、不重叠（框宽反推 + de-collision 联动）', () => {
    const long = '这是一段很长很长的标注文字用来验证折行与图形宽度是否会联动收敛';
    const r = layoutCoordinate({
      xlim: [-4, 4], ylim: [-4, 4],
      points: [
        { x: 0, y: 0, label: long },
        { x: 1, y: 1, label: long },
        { x: -1, y: -1, label: long },
        { x: 2, y: -2, label: long },
      ],
    }, { maxLabelWidth: 100 });
    assertNoOverlapAmongBoxes(r.nodes, r.width, r.height);
    const labeled = boxNodes(r.nodes).filter((n) => n.kind === 'point-label');
    expect(labeled.length).toBe(4);
    for (const n of labeled) {
      expect(n.lines.length).toBeGreaterThan(1);
      expect(n.w).toBeLessThanOrEqual(100 + 8 + 1);
    }
  });

  it('极大 / 极小且不对称的范围仍能出图（刻度步长自动放大）', () => {
    for (const spec of [
      { xlim: [-1000, 1000], ylim: [-0.001, 0.001], series: [{ expr: 'x' }] },
      { xlim: [0, 0.01], ylim: [0, 1e6], series: [{ expr: 'x*2' }] },
    ]) {
      const r = buildCoordinateSvg(spec);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      assertNoOverlapAmongBoxes(r.nodes, r.width, r.height);
    }
  });
});
