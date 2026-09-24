/**
 * 📐 几何图形 + 函数图象 SVG 生成器（[GRAPH] TYPE:SHAPES）—— 纯函数，可独立单测
 * ============================================================
 * 契约 / 印刷约定 / 共用能力见 `./shared.js` 头部；风格照抄 `./mindmap.js`，
 * **坐标系底板直接复用 `./coordinate.js`**（同样的轴/网格/刻度/标题/曲线/数据点），
 * 本模块只补 SHAPES 独有的元素：line / polygon / circle / angle。
 *
 * 输入 spec（适配器从 [GRAPH] 指令块转出，本模块只认这个结构）：
 *   { type:'shapes', xlim, ylim, grid?, title?, elements:[
 *       { kind:'function', expr, color?, domain? },
 *       { kind:'point',    x, y, label?, color? },
 *       { kind:'line',     points:[[x,y],[x,y]], label?, color?, width?, dash? },
 *       { kind:'polygon',  points:[[x,y],…], labels?:['A','B','C'], color? },
 *       { kind:'circle',   x, y, radius, color? },
 *       { kind:'angle',    a:[x,y], vertex:[x,y], b:[x,y], label?, color? },
 *   ] }
 *
 * ── 几个刻意的取舍 ────────────────────────────────────────────────────────
 *   1) 圆用 `<ellipse>` 画：**数学意义上的圆**在坐标里必须是圆（rx = r·scaleX、ry = r·scaleY），
 *      直接画 `<circle>` 在 x/y 比例不等时会被压成椭圆，属于"画错比不画更糟"。
 *   2) 多边形顶点字母、线段标注、角标注都走 coordinate.js 的 de-collision 定位器：
 *      几何是数据驱动的，"标签压住刻度或压住彼此"是这里最常见的版式病，
 *      交给确定性的候选位搜索而不是人工调参。
 *   3) 元素容错：points 少于必需数量 / radius ≤ 0 / 顶点重合 → 该元素跳过（计入 metrics.skipped），
 *      **绝不抛错**（脏输入来自模型输出，出不了图也不能把导出流程带崩）。
 * ============================================================
 */

import {
  createCoordPlane, addSeriesToPlane, addPointToPlane, renderPlane, finishPlane,
  clampBoxToCanvas, pointsBBox, pointLikeLabelOffsets, resolveColor, estimateTextWidth, wrapLabel,
} from './coordinate.js';

// 与其他图种对外 API 同形：文本工具再导出一次（实现仍在 shared.js）
export { estimateTextWidth, wrapLabel };

/* ============================ 常量 ============================ */

const DEFAULT_ELEMENT_WIDTH = 1.8;
const POLYGON_WIDTH = 1.6;
const CIRCLE_WIDTH = 1.8;
const RAY_WIDTH = 1.6;
const ARC_WIDTH = 1.2;
const ARC_RADIUS = 26;          // 角的弧线半径（像素）
const ANGLE_LABEL_DIST = 46;    // 角标注离顶点的距离（像素）
const VERTEX_LABEL_GAP = 12;    // 顶点字母离顶点的距离（像素）
const LABEL_PAD_X = 4;
const LABEL_PAD_Y = 3;
const LINE_GAP = 10;            // 线段标注离中点的距离（像素）

const asText = (v) => (v == null ? '' : String(v));
const round1 = (v) => Math.round(v * 10) / 10;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 取点对：[x,y] → {x,y}；非法返回 null */
const toPoint = (v) => {
  if (!Array.isArray(v) || v.length < 2) return null;
  const x = num(v[0]);
  const y = num(v[1]);
  return x == null || y == null ? null : { x, y };
};

const toPointList = (v) => (Array.isArray(v) ? v.map(toPoint).filter(Boolean) : []);

/** 折线按弧长取中点（线段标注落在这里，视觉最稳） */
const polylineMidpoint = (pts) => {
  if (!pts.length) return null;
  if (pts.length === 1) return pts[0];
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (total <= 0) return pts[0];
  let acc = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= total / 2) {
      const t = seg > 0 ? (total / 2 - acc) / seg : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
    acc += seg;
  }
  return pts[pts.length - 1];
};

/* ============================ 元素：line / polygon / circle / angle ============================ */

const elementWidth = (v, dflt) => {
  const w = num(v);
  if (w == null || w <= 0) return dflt;
  return Math.min(6, Math.max(0.8, w));
};

/** 线段（可虚线）——points 至少 2 个；label 落在弧长中点旁 */
const addLineElement = (plane, e, index) => {
  const list = toPointList(e.points);
  if (list.length < 2) return false;
  const color = resolveColor(e.color, plane.palette[index % plane.palette.length]);
  const width = elementWidth(e.width, DEFAULT_ELEMENT_WIDTH);
  const dash = e.dash === true || e.dash === 'true';
  const px = list.map((p) => ({ x: plane.clampX(plane.sx(p.x)), y: plane.clampY(plane.sy(p.y)) }));

  plane.geometry.push({ kind: 'polyline', points: px, color, width, dash });
  const bbox = clampBoxToCanvas(pointsBBox(px, Math.ceil(width / 2) + 1), plane);
  plane.nodes.push({
    id: `line-${index}`, kind: 'line', solid: false, title: '线段', lines: [],
    x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h, color,
    padX: 0, padY: 0, fs: plane.labelFs, lineH: plane.tickLineH, anchor: 'start',
  });
  plane.elementCounts.line += 1;
  if (dash) plane.elementCounts.dash += 1;

  const label = plane.tf(asText(e.label)).trim();
  if (label) {
    const mid = polylineMidpoint(px) || px[0];
    const node = plane.pushLabel({
      ax: mid.x, ay: mid.y, text: label, fs: plane.labelFs, color, weight: 500,
      kind: 'line-label', padX: LABEL_PAD_X, padY: LABEL_PAD_Y,
      offsets: (w, h) => [
        { dx: -w / 2, dy: -(h + LINE_GAP) },
        { dx: -w / 2, dy: LINE_GAP },
        { dx: LINE_GAP, dy: -h / 2 },
        { dx: -(w + LINE_GAP), dy: -h / 2 },
        { dx: -w / 2, dy: -(h + LINE_GAP + 14) },
        { dx: -w / 2, dy: LINE_GAP + 14 },
      ],
    });
    plane.elementCounts.label += 1;
    return true;
  }
  return true;
};

/** 多边形 + 顶点字母（字母朝"背离重心"方向外扩） */
const addPolygonElement = (plane, e, index) => {
  const list = toPointList(e.points);
  if (list.length < 2) return false;
  const color = resolveColor(e.color, plane.palette[index % plane.palette.length]);
  const px = list.map((p) => ({ x: plane.clampX(plane.sx(p.x)), y: plane.clampY(plane.sy(p.y)) }));

  if (px.length >= 3) {
    plane.geometry.push({ kind: 'polygon', points: px, color, width: POLYGON_WIDTH, fill: 'none' });
  } else {
    plane.geometry.push({ kind: 'polyline', points: px, color, width: POLYGON_WIDTH });
  }
  const bbox = clampBoxToCanvas(pointsBBox(px, 2), plane);
  plane.nodes.push({
    id: `polygon-${index}`, kind: 'polygon', solid: false, title: '多边形', lines: [],
    x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h, color,
    padX: 0, padY: 0, fs: plane.labelFs, lineH: plane.tickLineH, anchor: 'start',
  });
  plane.elementCounts.polygon += 1;

  const labels = Array.isArray(e.labels) ? e.labels : [];
  const cx = px.reduce((s, p) => s + p.x, 0) / px.length;
  const cy = px.reduce((s, p) => s + p.y, 0) / px.length;
  for (let i = 0; i < Math.min(labels.length, px.length); i += 1) {
    const text = plane.tf(asText(labels[i])).trim();
    if (!text) continue;
    let dx = px[i].x - cx;
    let dy = px[i].y - cy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
    plane.pushLabel({
      ax: px[i].x + dx * VERTEX_LABEL_GAP, ay: px[i].y + dy * VERTEX_LABEL_GAP,
      text, fs: plane.labelFs, color, weight: 500, kind: 'polygon-vertex',
      padX: LABEL_PAD_X, padY: LABEL_PAD_Y, offsets: pointLikeLabelOffsets,
    });
    plane.elementCounts.label += 1;
  }
  return true;
};

/** 圆：数学意义上的圆 → 像素空间是椭圆（rx/ry 分别按两轴比例缩放） */
const addCircleElement = (plane, e, index) => {
  const x = num(e.x);
  const y = num(e.y);
  const r = num(e.radius != null ? e.radius : e.r);
  if (x == null || y == null || r == null || r <= 0) return false;
  const color = resolveColor(e.color, plane.palette[index % plane.palette.length]);
  const scaleX = plane.plotWidth / (plane.ylim ? 1 : 1) / (plane.xlim[1] - plane.xlim[0]);
  const scaleY = plane.plotHeight / (plane.ylim[1] - plane.ylim[0]);
  const cx = plane.clampX(plane.sx(x));
  const cy = plane.clampY(plane.sy(y));
  const rx = r * scaleX;
  const ry = r * scaleY;

  plane.geometry.push({ kind: 'ellipse', cx, cy, rx, ry, color, width: CIRCLE_WIDTH, fill: 'none' });
  const bbox = clampBoxToCanvas(
    { x: cx - rx - CIRCLE_WIDTH, y: cy - ry - CIRCLE_WIDTH, w: rx * 2 + CIRCLE_WIDTH * 2, h: ry * 2 + CIRCLE_WIDTH * 2 },
    plane,
  );
  plane.nodes.push({
    id: `circle-${index}`, kind: 'circle', solid: false, title: '圆', lines: [],
    x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h, color,
    dataX: x, dataY: y, radius: r, rx, ry, cx, cy,
    padX: 0, padY: 0, fs: plane.labelFs, lineH: plane.tickLineH, anchor: 'start',
  });
  plane.elementCounts.circle += 1;
  return true;
};

/** 角：两条射线 + 顶点处的弧线；标注落在角平分线方向上 */
const addAngleElement = (plane, e, index) => {
  const a = toPoint(e.a);
  const v = toPoint(e.vertex);
  const b = toPoint(e.b);
  if (!a || !v || !b) return false;
  const color = resolveColor(e.color, plane.palette[index % plane.palette.length]);
  const pxA = { x: plane.clampX(plane.sx(a.x)), y: plane.clampY(plane.sy(a.y)) };
  const pxV = { x: plane.clampX(plane.sx(v.x)), y: plane.clampY(plane.sy(v.y)) };
  const pxB = { x: plane.clampX(plane.sx(b.x)), y: plane.clampY(plane.sy(b.y)) };
  if ((Math.abs(pxA.x - pxV.x) < 0.5 && Math.abs(pxA.y - pxV.y) < 0.5) || (Math.abs(pxB.x - pxV.x) < 0.5 && Math.abs(pxB.y - pxV.y) < 0.5)) {
    return false;
  }

  plane.geometry.push({ kind: 'polyline', points: [pxV, pxA], color, width: RAY_WIDTH });
  plane.geometry.push({ kind: 'polyline', points: [pxV, pxB], color, width: RAY_WIDTH });

  const angA = Math.atan2(pxA.y - pxV.y, pxA.x - pxV.x);
  const angB = Math.atan2(pxB.y - pxV.y, pxB.x - pxV.x);
  let sweep = angB - angA;
  while (sweep <= -Math.PI) sweep += Math.PI * 2;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  const r = Math.min(ARC_RADIUS, Math.max(10, Math.hypot(pxA.x - pxV.x, pxA.y - pxV.y) * 0.42));
  const s1 = { x: pxV.x + r * Math.cos(angA), y: pxV.y + r * Math.sin(angA) };
  const s2 = { x: pxV.x + r * Math.cos(angB), y: pxV.y + r * Math.sin(angB) };
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep > 0 ? 1 : 0;
  plane.geometry.push({
    kind: 'arc',
    d: `M ${round1(s1.x)} ${round1(s1.y)} A ${round1(r)} ${round1(r)} 0 ${largeArc} ${sweepFlag} ${round1(s2.x)} ${round1(s2.y)}`,
    color,
    width: ARC_WIDTH,
  });
  plane.elementCounts.arc += 1;

  const bbox = clampBoxToCanvas(
    pointsBBox([pxA, pxV, pxB], Math.ceil(r) + 2),
    plane,
  );
  plane.nodes.push({
    id: `angle-${index}`, kind: 'angle', solid: false, title: '角', lines: [],
    x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h, color,
    vertexX: v.x, vertexY: v.y, radians: Math.abs(sweep),
    padX: 0, padY: 0, fs: plane.labelFs, lineH: plane.tickLineH, anchor: 'start',
  });
  plane.elementCounts.angle += 1;

  const label = plane.tf(asText(e.label)).trim();
  if (label) {
    const mid = angA + sweep / 2;
    plane.pushLabel({
      ax: pxV.x + Math.cos(mid) * ANGLE_LABEL_DIST,
      ay: pxV.y + Math.sin(mid) * ANGLE_LABEL_DIST,
      text: label, fs: plane.labelFs, color, weight: 500, kind: 'angle-label',
      padX: LABEL_PAD_X, padY: LABEL_PAD_Y, offsets: pointLikeLabelOffsets,
    });
    plane.elementCounts.label += 1;
  }
  return true;
};

/* ============================ 元素分发 ============================ */

const PLANE_ELEMENT_KINDS = { function: 1, series: 1, point: 1, line: 1, polygon: 1, circle: 1, angle: 1 };

/**
 * 往底板上加一个 SHAPES 元素。
 * @returns {boolean} 是否被接受（false = 数据不合法，已计入 skipped）
 */
export const addShapeElement = (plane, rawEl, index = 0) => {
  if (!rawEl || typeof rawEl !== 'object') { plane.elementCounts.skipped += 1; return false; }
  const kind = asText(rawEl.kind).trim().toLowerCase();
  if (!PLANE_ELEMENT_KINDS[kind]) { plane.elementCounts.skipped += 1; return false; }

  if (kind === 'function' || kind === 'series') {
    addSeriesToPlane(plane, rawEl, index);
    plane.elementCounts.function += 1;
    return true;
  }
  if (kind === 'point') {
    const r = addPointToPlane(plane, rawEl, index);
    if (!r) { plane.elementCounts.skipped += 1; return false; }
    plane.elementCounts.point += 1;
    if (r.labelNode) plane.elementCounts.label += 1;
    return true;
  }
  const ok = kind === 'line' ? addLineElement(plane, rawEl, index)
    : kind === 'polygon' ? addPolygonElement(plane, rawEl, index)
      : kind === 'circle' ? addCircleElement(plane, rawEl, index)
        : addAngleElement(plane, rawEl, index);
  if (!ok) {
    plane.elementCounts.skipped += 1;
    return false;
  }
  return true;
};

/* ============================ 对外双导出 ============================ */

const buildPlane = (spec, opts) => {
  const plane = createCoordPlane(spec, opts);
  // 🔴 计数字段必须**先建好再自增**：`counts.line += 1` 在 undefined 上会得到 NaN，
  //    而 NaN 会顺着 metrics 漏进单测与调用方（这条被"出图字符串不得含 NaN"的巡检抓过）。
  plane.elementCounts = {
    function: 0, point: 0, line: 0, polygon: 0, circle: 0, angle: 0,
    arc: 0, dash: 0, label: 0, skipped: 0,
  };
  plane.metrics.elementCounts = plane.elementCounts;
  const elements = Array.isArray(spec && spec.elements) ? spec.elements : [];
  elements.forEach((e, i) => addShapeElement(plane, e, i));
  return plane;
};

/**
 * 只算版式，不出图。
 * @param {object} spec `{ xlim, ylim, grid?, title?, elements? }`
 * @param {object} opts 同 coordinate（fontSize/titleFontSize/maxLabelWidth/palette/measurer/labelTransform/tickFontSize/plotWidth/plotHeight/sampleCount）
 * @returns {{nodes:Array, width:number, height:number, metrics:object}}
 */
export const layoutShapes = (spec, opts = {}) => finishPlane(buildPlane(spec, opts));

/** 版式 → SVG 字符串（不含 DOCTYPE/<?xml>，可直接内联进 HTML / PDF） */
export const buildShapesSvg = (spec, opts = {}) => {
  const plane = buildPlane(spec, opts);
  const { nodes, width, height, metrics } = finishPlane(plane);
  return { svg: renderPlane(plane), width, height, nodes, metrics };
};

export default { layoutShapes, buildShapesSvg };
