/**
 * 📈 坐标系 / 函数图象 SVG 生成器（[GRAPH] TYPE:COORDINATE）—— 纯函数，可独立单测
 * ============================================================
 * 契约 / 印刷约定 / 共用能力见 `./shared.js` 头部；风格与命名照抄 `./mindmap.js`（**先读它**）。
 *
 * 背景（2026-09-24 用户裁定"同意收回"）：生成模型早就在输出 [GRAPH] 指令块
 *   （格式见 `src/config/eduRenderContract.js`），本项目原来只把它抽出来让人**复制到外部工具**出图，
 *   自己 PDF/Word 里留一个占位框。收回后**就地渲染**：PDF 走内联矢量 SVG，
 *   Word 由调用方光栅化成 PNG（`diagrams/index.js` 的 diagramToPngDataUrl）。
 *   指令格式无需重设计、prompt 也不用改 —— 只补了"渲染出口"。
 *
 * 输入 spec（适配器从指令块转出，本模块只认这个结构）：
 *   { type:'coordinate', xlim:[min,max], ylim:[min,max], grid?:bool, title?:string,
 *     series?:[{ expr, color?, domain? }], points?:[{ x, y, label?, color? }] }
 *
 * ── 版式要点（都被"硬指标单测"逼着定下来）────────────────────────────────────
 *   · 画布 = 绘图区 + 四周外边距；绘图区尺寸固定（plotWidth×plotHeight，可注入）。
 *     坐标**一次算准**（不做事后归一化），所有节点天然落在 [0,width]×[0,height] 内；
 *   · 轴：x 轴画在 y=0 的像素位置（0 不在范围内时贴边），2px 实线 + 实心三角箭头；y 轴同理；
 *   · 刻度：步长走 nice number（1/2/5×10^k），并用**可用像素间距**做校验（间距 ≥ 标签宽 + 10px，
 *     纵轴还要求 ≥ 2 倍标签高 + 6px —— 否则紧贴 x 轴的那个纵轴数字会压住横轴数字）。
 *     这样刻度文字之间是"几何上不可能重叠"，不是靠事后挤开；
 *   · 文字统一走 shared.estimateTextWidth 实测宽度反推框宽 → 文字绝不越出图形；
 *     数据标签（点/线的标注）走 de-collision 定位（见 createPlacer），避免压住刻度；
 *   · 曲线：240 点采样、定义域外跳过、渐近线处断开、越界处截在可视边界（见 mathExpr）。
 * ============================================================
 */

import {
  DEFAULT_PALETTE, INK, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper, boxesOverlap, tint,
} from './shared.js';
import { sampleExpression } from './mathExpr.js';

// 文本工具统一在 shared.js（导图族共用），这里再导出一次，与其他图种对外 API 保持同形
export { estimateTextWidth, wrapLabel };

/* ============================ 常量（版式参数） ============================ */

const AXIS_COLOR = '#2f3540';       // 轴色（深灰，黑白打印仍有对比）
const GRID_COLOR = '#dfe6ee';       // 网格淡灰
const AXIS_WIDTH = 2;
const CURVE_WIDTH = 2.2;
const DEFAULT_SHAPE_WIDTH = 1.8;
const ARROW_LEN = 9;                // 箭头长
const ARROW_HALF = 3.5;             // 箭尾半宽
const MARKER_R = 4;                 // 数据点半径
const PLOT_W = 520;                 // 绘图区默认尺寸
const PLOT_H = 340;
const MARGIN_L = 48;                // 左边距（留给贴边时的纵轴刻度值）
const MARGIN_R = 30;
const MARGIN_B = 42;                // 下边距（留给横轴刻度值）
const TICK_PAD_X = 3;
const TICK_PAD_Y = 2;
const LABEL_PAD_X = 4;
const LABEL_PAD_Y = 3;
const X_TICK_GAP = 5;               // 横轴刻度值离轴线的距离
const SAMPLE_COUNT = 240;           // 规格定死：domain 内取 240 个点

/** 颜色名 → 印刷友好色（[GRAPH] 指令里 COLOR:red 这类写法；低饱和、黑白也能区分） */
const NAMED_COLORS = {
  red: '#c0392b', blue: '#2b5ea7', green: '#1f7a5c', black: '#2f3540',
  yellow: '#b8860b', orange: '#d35400', purple: '#8a4b8a', pink: '#c2518b',
  brown: '#8a5a2b', gray: '#6b7280', grey: '#6b7280', cyan: '#2b7f8a',
  magenta: '#a0357f', white: '#5b6472',
};

/* ============================ 小工具 ============================ */

const asText = (v) => (v == null ? '' : String(v));
const round1 = (v) => Math.round(v * 10) / 10;

/** 颜色名/十六进制 → 可用色值；不认就回落 */
export const resolveColor = (c, fallback = INK) => {
  const s = asText(c).trim().toLowerCase();
  if (!s) return fallback;
  if (/^#[0-9a-f]{8}$/i.test(s)) return s.slice(0, 7);
  if (/^#[0-9a-f]{6}$/i.test(s) || /^#[0-9a-f]{3}$/i.test(s)) return s;
  return NAMED_COLORS[s] || fallback;
};

const toRange = (v, dflt) => {
  const a = Array.isArray(v) ? Number(v[0]) : NaN;
  const b = Array.isArray(v) ? Number(v[1]) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return dflt ? dflt.slice() : null;
  return a < b ? [a, b] : [b, a];
};

/** nice number：不小于 min 的最小 1/2/5×10^k */
const niceAtLeast = (min) => {
  const m = Number(min);
  if (!Number.isFinite(m) || m <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(m) + 1e-12));
  for (const k of [1, 2, 5]) if (k * mag >= m - 1e-12) return k * mag;
  return 10 * mag;
};

const stepDecimals = (step) => {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : Math.min(6, s.length - i - 1);
};

/** 刻度值文本（按步长定小数位，避免 0.30000000000000004 这种噪音） */
const formatTickValue = (v, step) => {
  const r = Math.abs(v) < 1e-9 ? 0 : v;
  const dec = stepDecimals(step);
  return Number(r.toFixed(dec + 2)).toFixed(dec);
};

/** 坐标数值文本（数据点标注兜底用） */
const formatNumber = (v) => {
  const r = Number(v);
  if (!Number.isFinite(r)) return '';
  return String(Math.round(r * 1000) / 1000);
};

/* ============================ de-collision 定位器 ============================ */

/**
 * 框定位器：按候选偏移依次试，选第一个"在画布内且不与已放置的实心文字框重叠"的位置。
 * 🔴 为什么需要它：数据标签（点标注/线标注/顶点字母）是**内容驱动**的，位置随机，
 *    必然撞上刻度数字。与其人工调参，不如让定位器按固定顺序试候选位 —— 既是确定性的，
 *    又让"文字框两两不重叠"成为可被单测守住的硬指标。
 * ⚠️ 只有**文字框**进 avoid 列表：曲线包围盒/多边形包围盒是几何量，天然与曲线交叠，
 *    让它们参与回避会把所有标签挤到画布角落。
 */
export const createPlacer = (bounds) => {
  const placed = [];
  const inside = (box) => box.x >= bounds.x0 && box.y >= bounds.y0
    && box.x + box.w <= bounds.x1 && box.y + box.h <= bounds.y1;
  const free = (box) => !placed.some((b) => boxesOverlap(b, box));
  const find = (ax, ay, w, h, candidates, allowRing = true) => {
    let insideFallback = null;
    for (const c of candidates) {
      const box = { x: Math.round(ax + c.dx), y: Math.round(ay + c.dy), w, h };
      if (!inside(box)) continue;
      if (free(box)) { placed.push(box); return box; }
      if (!insideFallback) insideFallback = box;
    }
    // 🔴 兜底：以锚点为中心的**确定性**环形搜索。长标注（折行后 100×60 这种）在拥挤区域里
    //    常规候选位会被占满，没有这一步就只能退化成"允许重叠"（实测 2000+ px² 的重叠）。
    //    刻度框不走这一步（allowRing=false）：刻度是读图基准，宁可它压住别的，也不能挪远。
    if (allowRing) {
      const stepR = Math.max(h * 0.9, 20);
      for (let ring = 1; ring <= 6; ring += 1) {
        const rr = stepR * ring * 1.15;
        for (let k = 0; k < 16; k += 1) {
          const th = (k / 16) * Math.PI * 2;
          const box = {
            x: Math.round(ax + Math.cos(th) * rr - w / 2),
            y: Math.round(ay + Math.sin(th) * rr - h / 2),
            w,
            h,
          };
          if (inside(box) && free(box)) { placed.push(box); return box; }
        }
      }
    }
    const c0 = candidates[0];
    const box = insideFallback || { x: Math.round(ax + c0.dx), y: Math.round(ay + c0.dy), w, h };
    placed.push(box);
    return box;
  };
  const reserve = (box) => { placed.push(box); return box; };
  return { placed, find, reserve };
};

/** 点类标签（点标注 / 顶点字母 / 角标注）的候选位：先右后左、先上后下，再往外扩一圈 */
export const pointLikeLabelOffsets = (w, h) => {
  const r = MARKER_R;
  return [
    { dx: r + 5, dy: -h / 2 },
    { dx: -(w + r + 5), dy: -h / 2 },
    { dx: r + 5, dy: -(h + r + 1) },
    { dx: r + 5, dy: r + 2 },
    { dx: -w / 2, dy: -(h + r + 5) },
    { dx: -w / 2, dy: r + 6 },
    { dx: -(w + r + 5), dy: -(h + r + 1) },
    { dx: -(w + r + 5), dy: r + 2 },
    { dx: r + 18, dy: -h / 2 },
    { dx: -(w + r + 18), dy: -h / 2 },
  ];
};

/* ============================ 刻度（nice step + 间距校验） ============================ */

/**
 * 选刻度步长并生成刻度值/文本。
 * 🔴 关键：把"最小像素间距"当作硬约束 —— 间距不够就跳到下一个 nice step。
 *    （横轴按标签宽度；纵轴按标签高度的 2 倍，保证纵轴数字不会压住横轴数字那一行。）
 */
const buildTicks = ({ lo, hi, pxLen, fs, measurer, target, needSpacing }) => {
  const range = hi - lo;
  let step = niceAtLeast(range / Math.max(1, target));
  let labels = [];
  let maxLabelW = 0;
  for (let iter = 0; iter < 12; iter += 1) {
    const values = [];
    const kmin = Math.ceil(lo / step - 1e-9);
    const kmax = Math.floor(hi / step + 1e-9);
    for (let k = kmin; k <= kmax && values.length < 80; k += 1) values.push(k * step);
    labels = values.map((v) => formatTickValue(v, step));
    maxLabelW = labels.reduce((m, s) => Math.max(m, estimateTextWidth(s, fs, measurer)), 0);
    const spacing = values.length > 1 ? (pxLen * step) / range : pxLen;
    if (spacing >= needSpacing(maxLabelW)) {
      return { step, values, labels, maxLabelW, spacing };
    }
    step = niceAtLeast(step * 1.5);
  }
  return { step, values: [], labels, maxLabelW, spacing: pxLen };
};

/* ============================ ① 坐标系底板（coordinate 与 shapes 共用） ============================ */

/**
 * 建立坐标系底板：画布/绘图区、像素映射、网格与轴、刻度文字框、标题框。
 * @returns {object} plane —— 供 addSeriesToPlane / addPointToPlane / 图形元素继续往里塞内容；
 *   renderPlane() 负责把它画成 SVG。**函数字段不进 metrics**（保证 layout 结果可深比较）。
 */
export const createCoordPlane = (rawSpec, opts = {}) => {
  const spec = rawSpec && typeof rawSpec === 'object' ? rawSpec : {};
  const {
    fontSize = 13,
    titleFontSize = 15,
    maxLabelWidth = 150,
    palette = DEFAULT_PALETTE,
    measurer,
    labelTransform,
    tickFontSize = 10,
    plotWidth = PLOT_W,
    plotHeight = PLOT_H,
    sampleCount = SAMPLE_COUNT,
  } = opts;

  const tf = typeof labelTransform === 'function' ? labelTransform : asText;
  const xlim = toRange(spec.xlim, [-10, 10]);
  const ylim = toRange(spec.ylim, [-10, 10]);
  const grid = !!spec.grid;
  const titleText = tf(asText(spec.title)).trim();

  const tickFs = Math.max(9, Math.round(tickFontSize));       // 印刷约定：刻度字号 ≥ 9px
  const labelFs = Math.max(11, Math.round(fontSize));
  const titleFs = Math.max(11, Math.round(titleFontSize));
  const tickLineH = Math.round(tickFs * 1.42);
  const titleLineH = Math.round(titleFs * 1.42);

  const marginL = MARGIN_L;
  const marginR = MARGIN_R;
  const marginB = MARGIN_B;
  // 🔴 顶部留白必须**算出来**：有标题时若只按标题高度留白，纵轴最上面那个刻度值
  //    （框以 plotTop 为中心、上半高 7px）会顶进标题框里（实测 34px² 重叠）。
  //    故 = 上边距 4 + 标题框高 + 7（刻度框上半高）+ 7（余量）。
  const titleBoxH = titleText ? Math.round(Math.round(titleFs * 1.42) + LABEL_PAD_Y * 2) : 0;
  const marginT = titleText ? 4 + titleBoxH + 14 : 22;

  const plotLeft = marginL;
  const plotTop = marginT;
  const pw = Math.max(120, Math.round(plotWidth));
  const ph = Math.max(100, Math.round(plotHeight));
  const plotRight = plotLeft + pw;
  const plotBottom = plotTop + ph;
  const width = plotRight + marginR;
  const height = plotBottom + marginB;

  const x0 = xlim[0];
  const x1 = xlim[1];
  const y0 = ylim[0];
  const y1 = ylim[1];
  const sx = (v) => plotLeft + ((v - x0) / (x1 - x0)) * pw;
  const sy = (v) => plotTop + ((y1 - v) / (y1 - y0)) * ph;
  const clampX = (p) => Math.min(plotRight, Math.max(plotLeft, p));
  const clampY = (p) => Math.min(plotBottom, Math.max(plotTop, p));
  // 轴位置取整：0 不在范围内时贴到绘图区边界（此时就是边框）
  const axisX = Math.round(clampX(sx(0)));
  const axisY = Math.round(clampY(sy(0)));

  const bounds = { x0: 1, y0: 1, x1: width - 1, y1: height - 1 };
  const placer = createPlacer(bounds);
  const nodes = [];
  const geometry = [];

  const plane = {
    width, height, xlim, ylim, grid, tf, measurer, palette, maxLabelWidth, sampleCount,
    plotLeft, plotTop, plotRight, plotBottom, plotWidth: pw, plotHeight: ph,
    axisX, axisY, sx, sy, clampX, clampY, bounds,
    tickFs, labelFs, titleFs, tickLineH, titleLineH,
    nodes, geometry, placer, series: [], points: [], elementCounts: {},
  };

  /* ── 标签工厂：折行 → 实测宽度反推框宽 → de-collision 定位 → 入 nodes ── */
  const pushLabel = ({ ax, ay, text, fs, color, weight = 400, kind, padX, padY, offsets, ring = true }) => {
    const lines = wrapLabel(text, maxLabelWidth, fs, measurer, 3);
    const textW = lines.reduce((m, l) => Math.max(m, estimateTextWidth(l, fs, measurer)), 0);
    const w = Math.max(6, Math.round(textW + padX * 2));
    const h = Math.max(6, Math.round(lines.length * Math.round(fs * 1.42) + padY * 2));
    const box = placer.find(ax, ay, w, h, offsets(w, h), ring);
    const node = {
      id: `${kind}-${nodes.length}`,
      kind,
      solid: true,
      title: text,
      lines,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fs,
      weight,
      color,
      lineH: Math.round(fs * 1.42),
      padX,
      padY,
      anchor: 'start',
    };
    nodes.push(node);
    return node;
  };
  plane.pushLabel = pushLabel;

  /* ── 标题（画布顶部居中；先占位，免得别的标签挤进来）── */
  if (titleText) {
    const lines = wrapLabel(titleText, Math.max(maxLabelWidth * 3, 320), titleFs, measurer, 1);
    const textW = lines.reduce((m, l) => Math.max(m, estimateTextWidth(l, titleFs, measurer)), 0);
    const w = Math.max(6, Math.round(textW + LABEL_PAD_X * 2));
    const h = Math.round(lines.length * titleLineH + LABEL_PAD_Y * 2);
    const box = {
      x: Math.max(1, Math.round((width - w) / 2)),
      y: 4,
      w,
      h,
    };
    placer.reserve(box);
    nodes.push({
      id: 'title', kind: 'title', solid: true, title: titleText, lines,
      x: box.x, y: box.y, w: box.w, h: box.h,
      fs: titleFs, weight: 600, color: INK, lineH: titleLineH,
      padX: LABEL_PAD_X, padY: LABEL_PAD_Y, anchor: 'middle',
    });
  }

  /* ── 纵轴刻度值：轴左侧右对齐（放不下就翻到轴右侧）；先排纵轴，再排横轴 ── */
  const tickNeedY = () => Math.max(tickFs + 2 * TICK_PAD_Y + 20, 34);
  const ticksY = buildTicks({
    lo: y0, hi: y1, pxLen: ph, fs: tickFs, measurer,
    target: Math.max(3, Math.round(ph / 46)),
    needSpacing: tickNeedY,
  });
  const tickLabelH = tickFs + 2 * TICK_PAD_Y;
  for (let i = 0; i < ticksY.values.length; i += 1) {
    const v = ticksY.values[i];
    if (Math.abs(v) < 1e-9) continue;                          // 原点留给横轴，避免两个"0"叠一起
    const label = ticksY.labels[i];
    const w = Math.max(6, Math.round(estimateTextWidth(label, tickFs, measurer) + TICK_PAD_X * 2));
    const h = tickLabelH;
    pushLabel({
      ax: Math.round(axisX), ay: Math.round(sy(v)), text: label, fs: tickFs, color: INK,
      kind: 'axis-tick', padX: TICK_PAD_X, padY: TICK_PAD_Y,
      offsets: () => [
        { dx: -(w + 6), dy: -h / 2 },
        { dx: 6, dy: -h / 2 },
        { dx: -(w + 6), dy: -h / 2 - (h + 2) },
        { dx: 6, dy: -h / 2 - (h + 2) },
      ],
    });
  }

  /* ── 横轴刻度值：轴下方居中（下方放不下就翻到上方）── */
  const ticksX = buildTicks({
    lo: x0, hi: x1, pxLen: pw, fs: tickFs, measurer,
    target: Math.max(4, Math.round(pw / 44)),
    needSpacing: (maxLabelW) => Math.max(maxLabelW + 10, tickFs * 2.2),
  });
  for (let i = 0; i < ticksX.values.length; i += 1) {
    const v = ticksX.values[i];
    if (Math.abs(v) < 1e-9) continue;
    const label = ticksX.labels[i];
    const w = Math.max(6, Math.round(estimateTextWidth(label, tickFs, measurer) + TICK_PAD_X * 2));
    const h = tickLabelH;
    pushLabel({
      ax: Math.round(sx(v)), ay: Math.round(axisY), text: label, fs: tickFs, color: INK,
      kind: 'axis-tick', padX: TICK_PAD_X, padY: TICK_PAD_Y, ring: false,
      offsets: () => [
        { dx: -w / 2, dy: X_TICK_GAP },
        { dx: -w / 2, dy: -(X_TICK_GAP + h) },
        { dx: -w / 2 - 8, dy: X_TICK_GAP },
        { dx: -w / 2 + 8, dy: X_TICK_GAP },
      ],
    });
  }

  plane.metrics = {
    xlim: xlim.slice(),
    ylim: ylim.slice(),
    plotLeft, plotTop, plotRight, plotBottom, plotWidth: pw, plotHeight: ph,
    axisX, axisY,
    grid,
    marginL, marginR, marginT, marginB,
    tickFontSize: tickFs, labelFontSize: labelFs, titleFontSize: titleFs,
    tickLabelHeight: tickLabelH,
    tickStepX: ticksX.step, tickStepY: ticksY.step,
    tickSpacingX: ticksX.spacing, tickSpacingY: ticksY.spacing,
    tickMaxLabelWX: ticksX.maxLabelW, tickMaxLabelWY: ticksY.maxLabelW,
    tickValuesX: ticksX.values.slice(), tickValuesY: ticksY.values.slice(),
    labelPadX: LABEL_PAD_X, labelPadY: LABEL_PAD_Y,
    sampleCount,
    series: plane.series,
    points: plane.points,
    elementCounts: plane.elementCounts,
  };
  return plane;
};

/* ============================ ② 曲线（series / function） ============================ */

/** 折线段 → SVG path 的 d（每段一个 M，段间断开 = 渐近线处不连线） */
export const pathFromSegments = (segments) => segments
  .map((seg) => seg.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round1(p.x)} ${round1(p.y)}`).join(' '))
  .join(' ');

/**
 * 往底板上加一条函数曲线。坐标系里的 `series[i]` 与 SHAPES 里的 `kind:'function'` 共用这条路。
 * @returns {{node:object|null, metric:object}}
 */
export const addSeriesToPlane = (plane, rawSpec, index = 0) => {
  const s = rawSpec && typeof rawSpec === 'object' ? rawSpec : {};
  const expr = plane.tf(asText(s.expr)).trim();
  const color = resolveColor(s.color, plane.palette[index % plane.palette.length]);
  const domain = toRange(s.domain, plane.xlim) || plane.xlim.slice();
  const sampled = sampleExpression(expr, domain, { count: plane.sampleCount, view: plane.ylim });

  const paths = [];
  let maxJumpPx = 0;
  for (const seg of sampled.segments) {
    const px = seg.map((p) => ({ x: plane.clampX(plane.sx(p.x)), y: plane.clampY(plane.sy(p.y)) }));
    for (let i = 1; i < px.length; i += 1) maxJumpPx = Math.max(maxJumpPx, Math.abs(px[i].y - px[i - 1].y));
    paths.push(px);
  }

  let bbox = null;
  if (paths.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const seg of paths) {
      for (const p of seg) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    const pad = Math.ceil(CURVE_WIDTH / 2) + 1;
    bbox = clampBoxToCanvas(
      { x: Math.floor(minX - pad), y: Math.floor(minY - pad), w: Math.ceil(maxX - minX) + pad * 2, h: Math.ceil(maxY - minY) + pad * 2 },
      plane,
    );
  }

  const metric = {
    index,
    expr,
    color,
    domain: domain.slice(),
    sampleCount: plane.sampleCount,
    ok: sampled.ok,
    pointCount: sampled.pointCount,
    segmentCount: paths.length,
    breaks: Math.max(0, paths.length - 1),
    maxJumpPx,
    bbox,
  };

  let node = null;
  if (bbox) {
    node = {
      id: `series-${index}`, kind: 'series', solid: false, title: expr, lines: [],
      x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h, color, expr,
      padX: 0, padY: 0, fs: plane.labelFs, lineH: plane.tickLineH, anchor: 'start',
    };
    plane.nodes.push(node);
    plane.geometry.push({
      kind: 'path', d: pathFromSegments(paths), color, width: CURVE_WIDTH, opacity: 1,
    });
  }

  plane.series.push(metric);
  return { node, metric };
};

/* ============================ ③ 数据点 ============================ */

/** 往底板上加一个数据点（圆点 + 可选标注）。 */
export const addPointToPlane = (plane, rawSpec, index = 0) => {
  const p = rawSpec && typeof rawSpec === 'object' ? rawSpec : {};
  const x = Number(p.x);
  const y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const label = plane.tf(asText(p.label)).trim();
  const color = resolveColor(p.color, plane.palette[(index + 1) % plane.palette.length]);
  const px = plane.clampX(plane.sx(x));
  const py = plane.clampY(plane.sy(y));
  const marker = {
    id: `point-${index}`, kind: 'point-marker', solid: false,
    title: label || `(${formatNumber(x)}, ${formatNumber(y)})`, lines: [],
    x: Math.round(px - MARKER_R), y: Math.round(py - MARKER_R), w: MARKER_R * 2, h: MARKER_R * 2,
    dataX: x, dataY: y, px, py, color,
    padX: 0, padY: 0, fs: plane.labelFs, lineH: plane.tickLineH, anchor: 'start',
  };
  plane.nodes.push(marker);
  plane.geometry.push({ kind: 'circle', cx: round1(px), cy: round1(py), r: MARKER_R, color, stroke: PAPER, strokeWidth: 1 });

  let labelNode = null;
  if (label) {
    labelNode = plane.pushLabel({
      ax: px, ay: py, text: label, fs: plane.labelFs, color, weight: 500, kind: 'point-label',
      padX: LABEL_PAD_X, padY: LABEL_PAD_Y, offsets: pointLikeLabelOffsets,
    });
    labelNode.dataX = x;
    labelNode.dataY = y;
  }

  const metric = { index, x, y, px, py, color, label: label || '', labelNode };
  plane.points.push(metric);
  return { marker, labelNode, metric };
};

/* ============================ ④ 通用几何（shapes 复用） ============================ */

/** 把矩形夹进画布内（几何包围盒用；文字框由定位器保证在界内） */
export const clampBoxToCanvas = (box, plane) => {
  const W = Math.round(plane.width);
  const H = Math.round(plane.height);
  // 🔴 先夹**尺寸**再夹位置：比画布还大的几何框（半径给成 99 的圆）若只夹位置，
  //    x 会被压到 0 而宽度仍是好几千，`x + w <= width` 立刻不成立（实测越界）。
  const w = Math.min(W, Math.max(1, Math.round(box.w)));
  const h = Math.min(H, Math.max(1, Math.round(box.h)));
  const x = Math.min(Math.max(0, Math.round(box.x)), Math.max(0, W - w));
  const y = Math.min(Math.max(0, Math.round(box.y)), Math.max(0, H - h));
  return { x, y, w, h };
};

/** 点集的像素包围盒（可选外扩容差） */
export const pointsBBox = (pts, pad = 0) => {
  if (!pts.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: Math.floor(minX - pad),
    y: Math.floor(minY - pad),
    w: Math.ceil(maxX - minX) + pad * 2,
    h: Math.ceil(maxY - minY) + pad * 2,
  };
};

/** 数据坐标 → 像素（供单测核对映射；不接受函数字段，纯算术） */
export const projectPoint = (metrics, x, y) => ({
  x: metrics.plotLeft + ((x - metrics.xlim[0]) / (metrics.xlim[1] - metrics.xlim[0])) * metrics.plotWidth,
  y: metrics.plotTop + ((metrics.ylim[1] - y) / (metrics.ylim[1] - metrics.ylim[0])) * metrics.plotHeight,
});

/* ============================ ⑤ 收尾（夹进画布 + 取整） ============================ */

/** 把 nodes 的坐标取整并保证完全落在 [0,width]×[0,height] 内 */
export const finishPlane = (plane) => {
  const W = Math.round(plane.width);
  const H = Math.round(plane.height);
  for (const n of plane.nodes) {
    n.x = Math.round(n.x);
    n.y = Math.round(n.y);
    n.w = Math.min(W, Math.max(1, Math.round(n.w)));
    n.h = Math.min(H, Math.max(1, Math.round(n.h)));
    if (n.x < 0) n.x = 0;
    if (n.y < 0) n.y = 0;
    if (n.x + n.w > W) n.x = Math.max(0, W - n.w);
    if (n.y + n.h > H) n.y = Math.max(0, H - n.h);
  }
  return { nodes: plane.nodes, width: W, height: H, metrics: plane.metrics };
};

/* ============================ ⑥ 出图 ============================ */

const arrowPolygon = (x, y, dir) => {
  if (dir === 'right') {
    return `<polygon points="${round1(x)},${round1(y)} ${round1(x - ARROW_LEN)},${round1(y - ARROW_HALF)} ${round1(x - ARROW_LEN)},${round1(y + ARROW_HALF)}" fill="${AXIS_COLOR}"/>`;
  }
  return `<polygon points="${round1(x)},${round1(y)} ${round1(x - ARROW_HALF)},${round1(y + ARROW_LEN)} ${round1(x + ARROW_HALF)},${round1(y + ARROW_LEN)}" fill="${AXIS_COLOR}"/>`;
};

const geometryToSvg = (g) => {
  switch (g.kind) {
    case 'path':
    case 'arc':
      return `<path d="${g.d}" fill="none" stroke="${g.color}" stroke-width="${g.width}" stroke-linecap="round" stroke-linejoin="round"${g.opacity != null && g.opacity !== 1 ? ` opacity="${g.opacity}"` : ''}/>`;
    case 'polyline': {
      const pts = g.points.map((p) => `${round1(p.x)},${round1(p.y)}`).join(' ');
      return `<polyline points="${pts}" fill="${g.fill || 'none'}" stroke="${g.color}" stroke-width="${g.width}" stroke-linecap="round" stroke-linejoin="round"${g.dash ? ' stroke-dasharray="7 4"' : ''}${g.opacity != null && g.opacity !== 1 ? ` opacity="${g.opacity}"` : ''}/>`;
    }
    case 'polygon': {
      const pts = g.points.map((p) => `${round1(p.x)},${round1(p.y)}`).join(' ');
      return `<polygon points="${pts}" fill="${g.fill || 'none'}" stroke="${g.color}" stroke-width="${g.width}" stroke-linejoin="round"${g.dash ? ' stroke-dasharray="7 4"' : ''}/>`;
    }
    case 'ellipse':
      return `<ellipse cx="${round1(g.cx)}" cy="${round1(g.cy)}" rx="${round1(g.rx)}" ry="${round1(g.ry)}" fill="${g.fill || 'none'}" stroke="${g.color}" stroke-width="${g.width}"${g.dash ? ' stroke-dasharray="7 4"' : ''}/>`;
    case 'circle':
      return `<circle cx="${round1(g.cx)}" cy="${round1(g.cy)}" r="${round1(g.r)}" fill="${g.color}"${g.stroke ? ` stroke="${g.stroke}" stroke-width="${g.strokeWidth || 1}"` : ''}/>`;
    default:
      return '';
  }
};

/**
 * 底板 → SVG 字符串（坐标轴/网格/曲线/点/刻度文字/标题）。
 * 绘制顺序：网格 → 轴 → 几何（曲线、多边形、圆…）→ 文字框（刻度最后画，压住网格与曲线）。
 */
export const renderPlane = (plane) => {
  const { width, height } = plane;
  const out = [];
  out.push(svgHeader(Math.round(width), Math.round(height)));
  out.push(svgPaper(Math.round(width), Math.round(height)));

  const m = plane.metrics;

  // ① 网格（淡灰 1px）
  if (plane.grid) {
    for (const v of m.tickValuesX) {
      const x = round1(plane.clampX(plane.sx(v)));
      out.push(`<line x1="${x}" y1="${round1(plane.plotTop)}" x2="${x}" y2="${round1(plane.plotBottom)}" stroke="${GRID_COLOR}" stroke-width="1"/>`);
    }
    for (const v of m.tickValuesY) {
      const y = round1(plane.clampY(plane.sy(v)));
      out.push(`<line x1="${round1(plane.plotLeft)}" y1="${y}" x2="${round1(plane.plotRight)}" y2="${y}" stroke="${GRID_COLOR}" stroke-width="1"/>`);
    }
  }

  // ② 坐标轴 + 箭头（2px，深灰）
  const ay = round1(plane.axisY);
  const axX = round1(plane.axisX);
  out.push(`<line x1="${round1(plane.plotLeft)}" y1="${ay}" x2="${round1(plane.plotRight - ARROW_LEN)}" y2="${ay}" stroke="${AXIS_COLOR}" stroke-width="${AXIS_WIDTH}" stroke-linecap="round"/>`);
  out.push(arrowPolygon(plane.plotRight, plane.axisY, 'right'));
  out.push(`<line x1="${axX}" y1="${round1(plane.plotBottom)}" x2="${axX}" y2="${round1(plane.plotTop + ARROW_LEN)}" stroke="${AXIS_COLOR}" stroke-width="${AXIS_WIDTH}" stroke-linecap="round"/>`);
  out.push(arrowPolygon(plane.axisX, plane.plotTop, 'up'));

  // ③ 几何（曲线 / 多边形 / 圆 / 线段 / 点）
  for (const g of plane.geometry) {
    const s = geometryToSvg(g);
    if (s) out.push(s);
  }

  // ④ 文字（刻度先画、其余随后；一律带白底衬块，保证压在网格/曲线上仍清晰）
  const texts = plane.nodes.filter((n) => n.solid && n.lines.length);
  texts.sort((a, b) => (a.kind === 'axis-tick' ? 0 : 1) - (b.kind === 'axis-tick' ? 0 : 1));
  for (const n of texts) {
    out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${PAPER}"/>`);
    const tx = n.anchor === 'middle' ? n.x + n.w / 2 : n.x + n.padX;
    const anchor = n.anchor === 'middle' ? 'middle' : 'start';
    let li = 0;
    for (const line of n.lines) {
      const baseline = n.y + n.padY + li * n.lineH + n.fs * 1.06;
      out.push(`<text x="${round1(tx)}" y="${round1(baseline)}" font-size="${n.fs}" font-weight="${n.weight}" fill="${n.color}" text-anchor="${anchor}">${esc(line)}</text>`);
      li += 1;
    }
  }

  out.push('</svg>');
  return out.join('\n');
};

/* ============================ ⑦ 对外双导出 ============================ */

/**
 * 只算版式，不出图。
 * @param {object} spec `{ xlim, ylim, grid?, title?, series?, points? }`
 * @param {object} opts `{ fontSize, titleFontSize, maxLabelWidth, palette, measurer, labelTransform,
 *                        tickFontSize, plotWidth, plotHeight, sampleCount }`
 * @returns {{nodes:Array, width:number, height:number, metrics:object}}
 */
export const layoutCoordinate = (spec, opts = {}) => {
  const plane = createCoordPlane(spec, opts);
  const rawSeries = Array.isArray(spec && spec.series) ? spec.series : [];
  rawSeries.forEach((s, i) => addSeriesToPlane(plane, s, i));
  const rawPoints = Array.isArray(spec && spec.points) ? spec.points : [];
  rawPoints.forEach((p, i) => addPointToPlane(plane, p, i));
  return finishPlane(plane);
};

/** 版式 → SVG 字符串（不含 DOCTYPE/<?xml>，可直接内联进 HTML / PDF） */
export const buildCoordinateSvg = (spec, opts = {}) => {
  const plane = createCoordPlane(spec, opts);
  const rawSeries = Array.isArray(spec && spec.series) ? spec.series : [];
  rawSeries.forEach((s, i) => addSeriesToPlane(plane, s, i));
  const rawPoints = Array.isArray(spec && spec.points) ? spec.points : [];
  rawPoints.forEach((p, i) => addPointToPlane(plane, p, i));
  const { nodes, width, height, metrics } = finishPlane(plane);
  return { svg: renderPlane(plane), width, height, nodes, metrics };
};

export default { layoutCoordinate, buildCoordinateSvg, resolveColor, projectPoint };
