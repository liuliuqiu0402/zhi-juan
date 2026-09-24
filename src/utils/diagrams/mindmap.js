/**
 * 🧠 知识导图（思维导图）SVG 生成器 —— 纯函数，可独立单测
 * ============================================================
 * 用途：把一棵 `{ title, children }` 树渲染成**印刷友好**的矢量导图。
 *
 * 🔴 为什么自己画 SVG（2026-09-24 用户：这些图是"给学生看的成品资料，要进 PDF/Word、必须印刷友好"）：
 *   · PDF 通道 = puppeteer setContent + page.pdf → **内联 SVG 是矢量**，缩放/打印都不糊；
 *   · Word 通道 = utils/docxBuilder 的 buildImageRun，只认光栅图（png/jpg/gif/bmp，**不支持 svg**）
 *     → 由调用方把本函数产出的 SVG 光栅化成 PNG 再塞进 `<img src="data:image/png;base64,…">`。
 *   两条通道都不需要新依赖（canvas 光栅化在本仓库已有用法）。
 *
 * 印刷约定（写死在渲染里，不依赖外部 CSS，脱离应用单独拿来也能正确出图）：
 *   · 白底、深灰字、无阴影、无渐变；每条主分支一个**低饱和**颜色；
 *   · 黑白打印时颜色差异会消失，所以层级**同时**靠缩进、线宽、字重一起表达；
 *   · 字号不小于 11px，左侧文字右对齐（避免镜像后阅读别扭）。
 *
 * ⚠️ 公式：`$…$` 属渲染层的事，本函数**不解析 LaTeX**。调用方应先用
 *    utils/wordExporter.convertFormulasInHtml 把标题线性化（√ab⩽(a+b)/2）再传进来。
 *
 * 🔴 结构上刻意拆成两个导出：
 *    layoutMindmap() —— 只算版式，返回每个节点的 x/y/w/h（**可被单测直接断言**：
 *                       不重叠、不越界、父节点居中于子节点跨度……）；
 *    buildMindmapSvg() —— 只把版式画成 SVG。
 *    这样版式质量不靠"肉眼看图"来验收，测试能守住。
 * ============================================================
 */

import {
  DEFAULT_FONT, DEFAULT_PALETTE, INK, HEAD_FILL, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper,
} from './shared.js';

// 文本工具与配色统一在 shared.js（导图族共用），这里再导出一次，保持本模块原有对外 API 不变
export { estimateTextWidth, wrapLabel };

/* ============================ ① 版式计算 ============================ */

/**
 * 给「一侧」的子树做 tidy 布局：返回占用高度，并把 y 写回 node.y。
 * 规则：叶子按顺序堆叠；父节点垂直居中于其子节点的跨度。
 */
const layoutSide = (nodes, gapY) => {
  let cursor = 0;
  const place = (node) => {
    const kids = node.children || [];
    if (kids.length === 0) {
      node.y = cursor;
      cursor += node.h + gapY;
      return;
    }
    const start = cursor;
    kids.forEach(place);
    const first = kids[0];
    const last = kids[kids.length - 1];
    const mid = (first.y + last.y + last.h) / 2;
    node.y = mid - node.h / 2;
    // 父节点比整个子树还高时：把子树整体下推，保证父节点不越出子节点跨度
    if (node.y < start) {
      const push = start - node.y;
      const nudge = (n) => { n.y += push; (n.children || []).forEach(nudge); };
      kids.forEach(nudge);
      node.y = start;
    }
    if (node.y + node.h + gapY > cursor) cursor = node.y + node.h + gapY;
  };
  nodes.forEach(place);
  return Math.max(0, cursor - gapY);
};

/**
 * 只算版式，不出图。
 * @param {object|Array} tree 根节点 `{title, children}`；也可传子节点数组（配 opts.rootTitle）
 * @param {object} opts
 *   - rootTitle      传数组时的根标题，默认 '知识梳理'
 *   - layout         'balanced'（根居中、分支左右分布，默认）| 'right'（根在左，向右生长）
 *   - fontSize / rootFontSize / maxLabelWidth / palette / measurer / labelTransform
 * @returns {{nodes:Array, width:number, height:number, metrics:object}}
 *   nodes 为**已平铺**的节点（含 x/y/w/h/深度/侧别/父引用），坐标已归一到正数、含外边距。
 */
export const layoutMindmap = (tree, opts = {}) => {
  const {
    rootTitle = '知识梳理',
    layout = 'balanced',
    fontSize = 13,
    rootFontSize = 15,
    maxLabelWidth = 150,
    palette = DEFAULT_PALETTE,
    measurer,
    labelTransform,
  } = opts;

  const rawRoot = Array.isArray(tree) ? { title: rootTitle, children: tree } : (tree || { title: rootTitle, children: [] });
  const tf = typeof labelTransform === 'function' ? labelTransform : (s) => s;

  const padX = 11;
  const padY = 7;
  const lineH = Math.round(fontSize * 1.42);
  const gapY = Math.round(fontSize * 0.72);
  const gapX = Math.round(fontSize * 1.5);
  const margin = Math.round(fontSize * 1.2);

  // ── 归一化：算每行文字与节点尺寸 ──
  let seq = 0;
  const prep = (raw, depth, color, isRoot) => {
    const fs = isRoot ? rootFontSize : fontSize;
    const lines = wrapLabel(tf(raw.title), maxLabelWidth, fs, measurer);
    const textW = Math.max(...lines.map((l) => estimateTextWidth(l, fs, measurer)));
    return {
      id: seq++,
      title: String(raw.title == null ? '' : raw.title),
      lines,
      fs,
      lineH,
      textW,
      padX,
      padY,
      w: Math.round(textW + padX * 2),
      h: Math.round(lines.length * lineH + padY * 2),
      color,
      isRoot: !!isRoot,
      depth,
      side: 0,
      parent: null,
      y: 0,
      x: 0,
      children: (raw.children || []).map((c) => prep(c, depth + 1, depth === 0 ? palette[seq % palette.length] : color)),
    };
  };
  const root = prep(rawRoot, 0, palette[0], true);
  const bind = (n) => { (n.children || []).forEach((c) => { c.parent = n; bind(c); }); };
  bind(root);

  // ── 分两侧：按"子树预估高度"贪心切分（比按数量切更均衡）──
  const all = root.children || [];
  let leftKids = [];
  let rightKids = all;
  if (layout === 'balanced' && all.length > 1) {
    const weight = (n) => 1 + (n.children || []).length * 0.9;
    const total = all.reduce((s, n) => s + weight(n), 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < all.length - 1; i++) {
      acc += weight(all[i]);
      cut = i + 1;
      if (acc >= total / 2) break;
    }
    leftKids = all.slice(0, cut);
    rightKids = all.slice(cut);
  }
  // 🔴 side 必须**整棵子树继承**：连线方向（从父节点哪条边出线）和文字对齐
  //    （左半区右对齐）都靠它。只给根的一级子节点设 side，深层节点就会
  //    "人在左边、文字却按左对齐画" → 文字冲出框外。这是实测抓到过的 bug。
  const setSide = (n, s) => {
    n.side = s;
    (n.children || []).forEach((c) => setSide(c, s));
  };
  leftKids.forEach((n) => setSide(n, -1));
  rightKids.forEach((n) => setSide(n, 1));

  // ── 纵向：两侧各自 tidy，各自垂直居中于画布中线 ──
  const hL = layoutSide(leftKids, gapY);
  const hR = layoutSide(rightKids, gapY);
  const contentH = Math.max(hL, hR, root.h);
  const centerY = contentH / 2;
  const shiftSide = (kids, sideH) => {
    const off = centerY - sideH / 2;
    const walk = (n) => { n.y += off; (n.children || []).forEach(walk); };
    kids.forEach(walk);
  };
  shiftSide(leftKids, hL);
  shiftSide(rightKids, hR);
  // 根节点的纵向位置：
  //   · balanced：根是枢轴，左右两侧各自居中于画布中线 → 根就压在中线上（视觉最对称）；
  //   · right：整张图就是一棵普通 tidy 树 → 根也遵守"居中于首末子节点中心"的同一条规则，
  //            否则根会偏在分支中线之上（实测差 ~20px，看着像连歪了）。
  if (all.length) {
    const first = all[0];
    const last = all[all.length - 1];
    const midCenters = (first.y + first.h / 2 + last.y + last.h / 2) / 2;
    root.y = (layout === 'balanced' ? centerY : midCenters) - root.h / 2;
  } else {
    root.y = centerY - root.h / 2;
  }

  // ── 横向：按"每层最大节点宽"排柱，左右两侧共用同一套柱距（视觉对称）──
  const depthW = {};
  const collectW = (n, d) => {
    depthW[d] = Math.max(depthW[d] || 0, n.w);
    (n.children || []).forEach((c) => collectW(c, d + 1));
  };
  all.forEach((n) => collectW(n, 1));
  const colStep = [];
  for (let d = 1; d <= 12; d++) colStep[d] = (depthW[d] || 0) + gapX;

  const halfW = root.w / 2;
  // 🔴 根节点自己也要占位！它不参与 placeX（placeX 只排左右两侧的子节点），
  //    漏赋值会让 root.x 停在初始的 0，归一化后整块压到右侧分支上。
  root.x = -halfW;
  const placeX = (n, side) => {
    const d = n.depth;
    // 🔴 左侧必须**逐层往左**排（colStep 取负），否则越深的节点越往右跑、
    //    直接压到根节点和右半区上（实测 balanced 版式会出现 3200px² 的重叠）。
    const dir = side === 1 ? 1 : -1;
    let x = dir * (halfW + gapX);
    for (let i = 1; i < d; i++) x += dir * (colStep[i] || gapX);
    n.x = side === 1 ? x : x - n.w;
    (n.children || []).forEach((c) => placeX(c, side));
  };
  leftKids.forEach((n) => placeX(n, -1));
  rightKids.forEach((n) => placeX(n, 1));

  // ── 归一到正坐标系（含外边距）──
  let minX = -halfW;
  let maxX = halfW;
  const scanX = (n) => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x + n.w);
    (n.children || []).forEach(scanX);
  };
  all.forEach(scanX);
  // balanced：根是枢轴，要让它落在画布**水平正中**——左右两侧内容宽度天然不等
  //   （某侧标签更长就要更宽），若只管"左边顶到 0"，根就会偏摆、看着像排歪了。
  //   故取较宽一侧决定半宽，两侧各留出同样宽度。
  // right：根必须在最左，右边留出生长空间，不能居中。
  const centered = layout === 'balanced';
  const halfSpan = Math.max(-minX, maxX);       // 以根中心（未归一化时即 x=0）为基准的半宽
  const dx = centered ? margin + halfSpan : margin - minX;
  const canvasW = centered ? halfSpan * 2 + margin * 2 : maxX - minX + margin * 2;
  const dy = margin;
  const nodes = [];
  const flat = (n) => {
    n.x = Math.round(n.x + dx);
    n.y = Math.round(n.y + dy);
    nodes.push(n);
    (n.children || []).forEach(flat);
  };
  flat(root);

  return {
    nodes,
    width: Math.round(canvasW),
    height: Math.round(contentH + margin * 2),
    metrics: { padX, padY, lineH, gapX, gapY, margin, fontSize, rootFontSize },
  };
};

/* ============================ ② 出图 ============================ */

/** 版式 → SVG 字符串（不含 DOCTYPE，可直接内联进 HTML / PDF） */
export const buildMindmapSvg = (tree, opts = {}) => {
  const { nodes, width, height } = layoutMindmap(tree, opts);
  const out = [];
  out.push(svgHeader(width, height));
  out.push(svgPaper(width, height));

  // ① 先画全部连线（压在节点下面）
  for (const n of nodes) {
    for (const c of n.children || []) {
      const leftward = c.side === -1;
      const from = leftward ? n.x : n.x + n.w;
      const to = leftward ? c.x + c.w : c.x;
      const py = n.y + n.h / 2;
      const cy = c.y + c.h / 2;
      const mx = (from + to) / 2;
      out.push(`<path d="M ${from} ${py} C ${mx} ${py}, ${mx} ${cy}, ${to} ${cy}" fill="none" stroke="${c.color}" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>`);
    }
  }

  // ② 再画节点（保证文字/框不被线穿过）
  for (const n of nodes) {
    const r = n.isRoot ? 8 : 6;
    if (n.isRoot) {
      out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${r}" fill="${HEAD_FILL}"/>`);
    } else {
      out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${r}" fill="${PAPER}" stroke="${n.color}" stroke-width="1.3"/>`);
    }
    // 层级同时用字重强化（黑白打印时颜色差异会消失，字重不会）
    const weight = n.isRoot ? 600 : (n.depth === 1 ? 500 : 400);
    const fill = n.isRoot ? PAPER : INK;
    const anchor = n.side === -1 ? 'end' : 'start';
    const tx = n.side === -1 ? n.x + n.w - n.padX : n.x + n.padX;
    const baseline0 = n.y + n.padY + n.fs * 1.06;
    n.lines.forEach((line, i) => {
      out.push(`<text x="${tx}" y="${(baseline0 + i * n.lineH).toFixed(1)}" font-size="${n.fs}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(line)}</text>`);
    });
  }

  out.push('</svg>');
  return { svg: out.join('\n'), width, height, nodes };
};

export default { buildMindmapSvg, layoutMindmap, estimateTextWidth, wrapLabel };
