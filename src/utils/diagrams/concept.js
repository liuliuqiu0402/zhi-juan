/**
 * 🕸 概念关系图（带标注的关系网络）SVG 生成器 —— 纯函数，可独立单测
 * ============================================================
 * 用途：把 `{ center?, nodes: [{ id?, text }], links: [{ from, to, label? }] }` 渲染成
 *   **印刷友好**的环状概念图：中心概念居中，其余概念排在**一个圆环**上（刻意不用力导向，
 *   保证同样输入永远得到同样的图、可在 PDF/Word 里稳定排版），连边用直线连接两框**边界**，
 *   边上可挂小字标注（白底压线，印刷时线不会穿过字）。
 *
 * 🔴 为什么自己画、为什么印刷优先（同 mindmap.js）：
 *   · PDF 通道 = puppeteer setContent + page.pdf → 内联 SVG 是矢量，缩放/打印都不糊；
 *   · Word 通道 = utils/docxBuilder.buildImageRun 只认光栅图（**不支持 svg**）→ 由调用方光栅化。
 *   两条通道都不新增依赖（公共能力一律取自 ./shared.js）。
 *
 * 印刷约定（写死在渲染里，脱离应用单独用也能正确出图）：
 *   · 白底、深灰字、无阴影/渐变/外链；边框 1.3px；字号 ≥ 11px；
 *   · 层级靠**字重**表达（中心 600 / 外围 400）——黑白打印时颜色差异会消失，字重不会；
 *   · 框宽由**实测文字宽度**反推（w = textW + 2*padX），文字绝不越出图形。
 *
 * ── 版式思路（对应设计规格「5. 概念关系图」）───────────────────────────────────
 *   ① 定中心：`center` 命中者（先按 id、再按 text、再按索引）；缺省取**连边最多**的节点
 *      （并列取第一个）。"连边最多" = 有效 link 的端点数最多。
 *   ② 排环：其余节点排在**一个**圆环上、角度均分（第一个在正上方）；顺序用一次**邻接分组**
 *      做线性排列：先把与中心相连的邻居按索引依次排开，每个邻居后面紧挨"只与它相连的卫星
 *      节点"，最后接上没被分组的剩余节点 → 关系紧密的概念在环上相邻，连线交叉更少。
 *   ③ 半径自适应：`r0 = max(150, 环上节点数 * 46)`；若"节点框两两不重叠"不成立，则每次
 *      ×1.12 增大 r，最多 24 次（仍不成立就用最后值）。判定用**取整后**的框 —— 与出图、
 *      与单测看到的是同一组几何，避免"测试过、出图叠"。
 *   ④ 连线端点：用射线与矩形求交，取**框边界**上的点（永不穿进框内部）；有 label 时在
 *      中点垫一块白底矩形再写 11px 小字，把线压住。
 *
 * 🔴 结构上刻意拆成两个导出（同 mindmap.js 口径）：
 *   layoutConcept()    —— 只算版式（返回已平铺、已归一化的节点 + 连边几何，**可被单测直接断言**）；
 *   buildConceptSvg()  —— 只把版式画成 SVG。
 *   版式质量靠硬指标守住（不重叠/不越界/端点在框上/文字不丢），不靠肉眼看图。
 * ============================================================
 */

import {
  DEFAULT_PALETTE, INK, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper, boxesOverlap,
} from './shared.js';

// 文本工具统一在 shared.js（导图族共用），这里再导出一次，与 mindmap.js 的对外 API 保持同形
export { estimateTextWidth, wrapLabel };

/* ============================ 常量：版式参数（规格 §5 定死） ============================ */

const R0_MIN = 150;                 // 环半径下限（px）
const R0_PER_NODE = 46;             // 环上每个节点分摊的半径（px）
const GROW = 1.12;                  // 半径迭代增长系数
const MAX_ITER = 24;                // 半径迭代上限
const START_ANGLE = -Math.PI / 2;   // 第一个环上节点放在正上方
const BOX_R = 8;                    // 节点框圆角
const BOX_STROKE_W = 1.3;           // 节点框边框线宽
const LINK_STROKE_W = 1.4;          // 连边线宽
const LINK_OPACITY = 0.8;           // 连边透明度
const LABEL_FS = 11;                // 标注字号（印刷下限）
const LABEL_PAD_X = 4;              // 标注白底左右留白
const LABEL_PAD_Y = 3;              // 标注白底上下留白
const PAD_X = 11;
const PAD_Y = 7;

/**
 * 从 box 中心朝 (tx,ty) 方向走，求**落在 box 边界上**的点（射线与轴对齐矩形求交）。
 * 🔴 用它算端点，连线就只会"贴到框边"，绝不会画进框里压住文字。
 */
const edgePoint = (box, tx, ty) => {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  let k = Infinity;
  if (ax > 1e-9) k = Math.min(k, (box.w / 2) / ax);
  if (ay > 1e-9) k = Math.min(k, (box.h / 2) / ay);
  if (!Number.isFinite(k)) k = 0;
  return { x: cx + dx * k, y: cy + dy * k };
};

/* ============================ ① 版式计算 ============================ */

/**
 * 只算版式，不出图。
 * @param {object|null} spec `{ center?, nodes: [{ id?, text }], links: [{ from, to, label? }] }`
 *   - `center` 缺省取连边最多的节点；`id` 缺省用 `text`；
 *   - `from/to` 先按 id、再按 text、最后按索引匹配，匹配不到即丢弃（**不抛错**）。
 * @param {object} opts
 *   - fontSize / titleFontSize（中心节点字号）/ maxLabelWidth / palette / measurer / labelTransform
 * @returns {{nodes:Array, links:Array, width:number, height:number, metrics:object}}
 *   nodes 已平铺，坐标为**最终像素值**（含外边距、全为正）；每项含
 *   `{ id, title, x, y, w, h, lines }` 及专属字段
 *   `{ fs, lineH, color, isCenter, ringIndex, degree, index }`；
 *   links 为**有效连边**几何：`{ from, to, fromId, toId, fromTitle, toTitle, label, hasLabel,
 *   x1, y1, x2, y2, midX, midY, labelW, labelH }`（端点落在两端框的边界上）。
 */
export const layoutConcept = (spec, opts = {}) => {
  const {
    fontSize = 13,
    titleFontSize = 15,
    maxLabelWidth = 150,
    palette = DEFAULT_PALETTE,
    measurer,
    labelTransform,
  } = opts;

  const tf = typeof labelTransform === 'function' ? labelTransform : (s) => s;
  const pal = Array.isArray(palette) && palette.length ? palette : DEFAULT_PALETTE;

  const rawNodes = Array.isArray(spec && spec.nodes) ? spec.nodes : [];
  const rawLinks = Array.isArray(spec && spec.links) ? spec.links : [];

  // 字号下限 11px（印刷约定）；行距取整块文字共用值，节奏均匀
  const bodyFs = Math.max(11, Math.round(fontSize));
  const headFs = Math.max(11, Math.round(titleFontSize));
  const lineH = Math.round(Math.max(bodyFs, headFs) * 1.42);
  const margin = Math.max(1, Math.round(bodyFs * 1.2));

  /* ── ① 归一化节点：id 缺省用 text；显示文字（title）缺省回落到 id ── */
  const nodes = rawNodes
    .map((raw) => {
      if (raw == null) return null;
      if (typeof raw === 'string' || typeof raw === 'number') return { text: String(raw) };
      if (typeof raw !== 'object') return null;
      return raw;
    })
    .filter(Boolean)
    .map((item, index) => {
      const text = item.text != null ? String(item.text) : '';
      const idSrc = item.id != null ? String(item.id) : '';
      const id = idSrc !== '' ? idSrc : (text !== '' ? text : `#${index}`);
      return { index, id, title: text !== '' ? text : id };
    });

  /* ── ② 连线引用解析：id → text → 索引；自环与悬空引用一律丢弃（不抛错）── */
  const resolveRef = (ref) => {
    if (ref == null) return -1;
    const key = String(ref);
    let i = nodes.findIndex((n) => n.id === key);
    if (i >= 0) return i;
    i = nodes.findIndex((n) => n.title === key);
    if (i >= 0) return i;
    if (/^-?\d+$/.test(key)) {
      const k = Number(key);
      if (Number.isInteger(k) && k >= 0 && k < nodes.length) return k;
    }
    return -1;
  };

  const pairs = [];
  for (const raw of rawLinks) {
    if (raw == null) continue;
    const l = typeof raw === 'object' ? raw : { from: raw };
    const a = resolveRef(l.from);
    const b = resolveRef(l.to);
    if (a < 0 || b < 0 || a === b) continue;
    pairs.push({ from: a, to: b, label: l.label == null ? '' : String(l.label) });
  }

  /* ── ③ 定中心：指定优先，否则取连边最多（并列取第一个）── */
  const degree = new Array(nodes.length).fill(0);
  const adj = Array.from({ length: nodes.length }, () => new Set());
  for (const p of pairs) {
    degree[p.from] += 1;
    degree[p.to] += 1;
    adj[p.from].add(p.to);
    adj[p.to].add(p.from);
  }

  let centerIndex = -1;
  if (spec && spec.center != null) centerIndex = resolveRef(spec.center);
  if (centerIndex < 0) {
    for (let i = 0; i < nodes.length; i++) {
      if (centerIndex < 0 || degree[i] > degree[centerIndex]) centerIndex = i;
    }
  }

  /* ── ④ 环上顺序：一次邻接分组，邻居按索引依次排、卫星紧挨其后 ── */
  // 🔴 必须先划清"谁算邻居"再分卫星：若一边按顺序处理邻居、一边把"还没轮到的邻居"
  //    当卫星收走（它同时连着更靠前的邻居），那个邻居自己的卫星就会被挤到最后去，
  //    "紧挨其后"立刻不成立（实测：细胞质连着细胞膜与细胞，结果它的 6 个卫星全被甩到环尾）。
  const ringOrder = [];
  if (centerIndex >= 0) {
    const neighbors = [];
    for (let i = 0; i < nodes.length; i++) {
      if (i !== centerIndex && adj[centerIndex].has(i)) neighbors.push(i);
    }
    const isNeighbor = new Set(neighbors);
    const satellites = new Map(neighbors.map((nb) => [nb, []]));
    const leftover = [];
    for (let i = 0; i < nodes.length; i++) {
      if (i === centerIndex || isNeighbor.has(i)) continue;
      const owner = neighbors.find((nb) => adj[nb].has(i));
      if (owner === undefined) leftover.push(i);      // 孤立点 / 只与其它卫星相连
      else satellites.get(owner).push(i);
    }
    for (const nb of neighbors) {
      ringOrder.push(nb);
      ringOrder.push(...satellites.get(nb));
    }
    ringOrder.push(...leftover);                      // 保证每个节点都上环
  }

  const ringCount = ringOrder.length;
  const ringPos = new Map();
  ringOrder.forEach((ni, i) => ringPos.set(ni, i));

  /* ── ⑤ 节点的尺寸：框宽由实测文字宽度反推，文字绝不越出 ── */
  const info = nodes.map((nd, i) => {
    const isCenter = i === centerIndex;
    const fs = isCenter ? headFs : bodyFs;
    const lines = wrapLabel(tf(nd.title), maxLabelWidth, fs, measurer);
    const textW = lines.reduce((m, l) => Math.max(m, estimateTextWidth(l, fs, measurer)), 0);
    const pos = isCenter ? 0 : (ringPos.has(i) ? ringPos.get(i) + 1 : ringCount + 1);
    return {
      isCenter,
      fs,
      lines,
      color: pal[pos % pal.length],
      w: Math.round(textW + PAD_X * 2),
      h: Math.round(lines.length * lineH + PAD_Y * 2),
    };
  });

  /* ── ⑥ 半径自适应：环上节点框两两不重叠 ── */
  const r0 = Math.max(R0_MIN, ringCount * R0_PER_NODE);
  let radius = r0;
  let iterations = 0;

  const boxesAt = (r) => {
    const boxes = new Array(nodes.length).fill(null);
    if (centerIndex >= 0) {
      const c = info[centerIndex];
      boxes[centerIndex] = { x: -c.w / 2, y: -c.h / 2, w: c.w, h: c.h };
    }
    ringOrder.forEach((ni, i) => {
      const a = START_ANGLE + (i * Math.PI * 2) / Math.max(1, ringCount);
      const it = info[ni];
      boxes[ni] = { x: r * Math.cos(a) - it.w / 2, y: r * Math.sin(a) - it.h / 2, w: it.w, h: it.h };
    });
    return boxes;
  };

  /** 判定用**取整后**的框：与最终坐标、出图、单测看到的是同一组几何 */
  const overlapsAny = (boxes) => {
    const rs = boxes.filter(Boolean).map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), w: b.w, h: b.h }));
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) if (boxesOverlap(rs[i], rs[j])) return true;
    }
    return false;
  };

  let boxes = boxesAt(radius);
  while (ringCount > 0 && iterations < MAX_ITER && overlapsAny(boxes)) {
    iterations += 1;
    radius = r0 * Math.pow(GROW, iterations);   // 确定性增长：与迭代次数一一对应
    boxes = boxesAt(radius);
  }

  /* ── ⑦ 连边几何：端点取框边界与连线的交点 ── */
  const links = [];
  for (const p of pairs) {
    const A = boxes[p.from];
    const B = boxes[p.to];
    if (!A || !B) continue;
    const acx = A.x + A.w / 2;
    const acy = A.y + A.h / 2;
    const bcx = B.x + B.w / 2;
    const bcy = B.y + B.h / 2;
    const p1 = edgePoint(A, bcx, bcy);   // 从 A 中心朝 B 走，贴 A 的框边
    const p2 = edgePoint(B, acx, acy);   // 从 B 中心朝 A 走，贴 B 的框边
    const label = String(tf(p.label));
    const hasLabel = label.trim() !== '';
    links.push({
      from: p.from,
      to: p.to,
      fromId: nodes[p.from].id,
      toId: nodes[p.to].id,
      fromTitle: nodes[p.from].title,
      toTitle: nodes[p.to].title,
      label,
      hasLabel,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      midX: (acx + bcx) / 2,
      midY: (acy + bcy) / 2,
      labelW: hasLabel ? Math.round(estimateTextWidth(label, LABEL_FS, measurer) + LABEL_PAD_X * 2) : 0,
      labelH: hasLabel ? Math.round(LABEL_FS * 1.42) + LABEL_PAD_Y * 2 : 0,
    });
  }

  /* ── ⑧ 归一化到正坐标系（含外边距；标注白底也纳入包围盒，保证整幅都在画布内）── */
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const acc = (b) => {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  };
  boxes.forEach((b) => { if (b) acc(b); });
  for (const l of links) {
    if (!l.hasLabel) continue;
    acc({ x: l.midX - l.labelW / 2, y: l.midY - l.labelH / 2, w: l.labelW, h: l.labelH });
  }

  const metrics = {
    padX: PAD_X,
    padY: PAD_Y,
    lineH,
    margin,
    fontSize: bodyFs,
    titleFontSize: headFs,
    labelFontSize: LABEL_FS,
    centerIndex,
    centerId: centerIndex >= 0 ? nodes[centerIndex].id : null,
    ringCount,
    radius,
    radiusIterations: iterations,
    radiusMin: R0_MIN,
    radiusPerNode: R0_PER_NODE,
    radiusGrow: GROW,
    nodeCount: nodes.length,
    linkCount: links.length,
    boxR: BOX_R,
    boxStrokeW: BOX_STROKE_W,
    linkStrokeW: LINK_STROKE_W,
    linkOpacity: LINK_OPACITY,
  };

  // 空输入：仍给出正尺寸画布，调用方不必特判
  if (!Number.isFinite(minX)) {
    const w0 = Math.max(1, Math.round(margin * 2));
    return { nodes: [], links: [], width: w0, height: w0, metrics };
  }

  const dx = Math.round(margin - minX);
  const dy = Math.round(margin - minY);
  const width = Math.round(maxX - minX + margin * 2);
  const height = Math.round(maxY - minY + margin * 2);

  const outNodes = nodes
    .map((nd, i) => {
      const b = boxes[i];
      if (!b) return null;
      const inf = info[i];
      return {
        id: nd.id,
        title: nd.title,
        lines: inf.lines,
        fs: inf.fs,
        lineH,
        x: Math.round(b.x) + dx,
        y: Math.round(b.y) + dy,
        w: b.w,
        h: b.h,
        color: inf.color,
        isCenter: inf.isCenter,
        ringIndex: inf.isCenter ? -1 : (ringPos.has(i) ? ringPos.get(i) : -1),
        degree: degree[i],
        index: i,
      };
    })
    .filter(Boolean);

  const outLinks = links.map((l) => ({
    ...l,
    x1: l.x1 + dx,
    y1: l.y1 + dy,
    x2: l.x2 + dx,
    y2: l.y2 + dy,
    midX: l.midX + dx,
    midY: l.midY + dy,
  }));

  return { nodes: outNodes, links: outLinks, width, height, metrics };
};

/* ============================ ② 出图 ============================ */

/** 版式 → SVG 字符串（不含 DOCTYPE/<?xml>，可直接内联进 HTML / PDF） */
export const buildConceptSvg = (spec, opts = {}) => {
  const { nodes, links, width, height } = layoutConcept(spec, opts);
  const out = [];
  out.push(svgHeader(width, height));
  out.push(svgPaper(width, height));

  // ① 先画全部连边（压在节点与标注下面）
  for (const l of links) {
    out.push(
      `<line x1="${l.x1.toFixed(1)}" y1="${l.y1.toFixed(1)}" x2="${l.x2.toFixed(1)}" y2="${l.y2.toFixed(1)}" `
      + `stroke="${INK}" stroke-width="${LINK_STROKE_W}" opacity="${LINK_OPACITY}" stroke-linecap="round"/>`,
    );
  }

  // ② 标注：白底矩形先压住连线，再写 11px 小字（印刷时线不会穿过字）
  for (const l of links) {
    if (!l.hasLabel) continue;
    out.push(
      `<rect x="${(l.midX - l.labelW / 2).toFixed(1)}" y="${(l.midY - l.labelH / 2).toFixed(1)}" `
      + `width="${l.labelW}" height="${l.labelH}" fill="${PAPER}"/>`,
    );
    out.push(
      `<text x="${l.midX.toFixed(1)}" y="${(l.midY + LABEL_FS * 0.36).toFixed(1)}" `
      + `font-size="${LABEL_FS}" font-weight="500" fill="${INK}" text-anchor="middle">${esc(l.label)}</text>`,
    );
  }

  // ③ 再画节点框 + 居中文字（白底、1.3px 同色边框；层级用字重强化）
  for (const n of nodes) {
    out.push(
      `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${BOX_R}" `
      + `fill="${PAPER}" stroke="${n.color}" stroke-width="${BOX_STROKE_W}"/>`,
    );
    const cx = n.x + n.w / 2;
    const weight = n.isCenter ? 600 : 400;
    const baseline0 = n.y + PAD_Y + n.fs * 1.06;
    n.lines.forEach((line, i) => {
      out.push(
        `<text x="${cx}" y="${(baseline0 + i * n.lineH).toFixed(1)}" font-size="${n.fs}" `
        + `font-weight="${weight}" fill="${INK}" text-anchor="middle">${esc(line)}</text>`,
      );
    });
  }

  out.push('</svg>');
  return { svg: out.join('\n'), width, height, nodes, links };
};

export default { layoutConcept, buildConceptSvg, estimateTextWidth, wrapLabel };
