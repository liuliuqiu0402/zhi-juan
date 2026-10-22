/**
 * 🧠 知识导图（思维导图）SVG 生成器 —— 纯函数，可独立单测
 * ============================================================
 * 用途：把一棵 `{ title, children }` 树渲染成**印刷友好**的矢量导图。
 *
 * 为什么自己画 SVG（2026-09-24 用户：这些图是"给学生看的成品资料，要进 PDF/Word、必须印刷友好"）：
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
 * 结构上刻意拆成两个导出：
 *    layoutMindmap() —— 只算版式，返回每个节点的 x/y/w/h（**可被单测直接断言**：
 *                       不重叠、不越界、父节点居中于子节点跨度……）；
 *    buildMindmapSvg() —— 只把版式画成 SVG。
 *    这样版式质量不靠"肉眼看图"来验收，测试能守住。
 * ============================================================
 */

import {
  DEFAULT_FONT, DEFAULT_PALETTE, INK, HEAD_FILL, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper,
  lineBudget, normalizeHex, nodeWeight, weightPadK,
} from './shared.js';

// 文本工具与配色统一在 shared.js（导图族共用），这里再导出一次，保持本模块原有对外 API 不变
export { estimateTextWidth, wrapLabel };

/* ============================ ① 版式计算 ============================ */

/**
 * 给「一侧」的子树做 tidy 布局：返回占用高度，并把 y 写回 node.y。
 * 规则：叶子按顺序堆叠；**叶子分组够短时按行铺开**（node.grid，行高取该行最高项）；
 *   父节点垂直居中于整块（父比块高时贴块顶、并把游标推到父底，避免压到下一棵子树）。
 * @param {Function} geo node → 该分组的格线（列宽/行高/列偏移/行偏移/整块宽高）
 */
const layoutSide = (nodes, gapY, geo) => {
  let cursor = 0;
  const place = (node) => {
    const kids = node.children || [];
    if (kids.length === 0) {
      node.y = cursor;
      cursor += node.h + gapY;
      return;
    }
    const start = cursor;
    if (node.grid) {
      const g = geo(node);
      kids.forEach((k, i) => { k.y = start + g.rowY[Math.floor(i / g.cols)]; });
      cursor = start + g.height + gapY;
      node.y = start + (g.height - node.h) / 2;
      if (node.y < start) node.y = start;
      if (node.y + node.h + gapY > cursor) cursor = node.y + node.h + gapY;
      return;
    }
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
    // 🔴 2026-10-22（属主真机："有的字出导图框了"）：框宽原按**常规字重**的文字宽算，
    //   而根/一级分支是 600/500 字重、再加字体回退差异 ⇒ 实排出来比算的宽，字冲出框。
    //   两层处置：① 有**实测 measurer**（浏览器 canvas，按 字重+字号+字体栈 实测）就按实测出框，只留 2px 余量；
    //   ② 无实测（纯函数/jsdom）时按字重留余量，且**折行宽度同步收窄**，保证折完仍装得下。
    // 🔴 2026-10-22（属主："内容显示不全，用省略号了""框长短/高度都一样，不符合实际"）：
    //   框的尺寸**随内容**走，不再"统一截到 3 行"——
    //     · 行数不封顶（`lineBudget` 按内容量给够）⇒ 长要点变高，不再被 `…` 砍掉；
    //     · 折行宽度按内容微调：略超上限的短语（≤1.2 倍）不硬折成两行，而是让它单行略宽，
    //       于是框的"长短"也跟着内容有差别，而不是清一色的 150px。
    const str = tf(raw.title);
    const weight = nodeWeight(raw, depth, isRoot);
    const exact = typeof measurer === 'function';
    const measure = exact ? (t, f) => measurer(t, f, weight) : undefined;
    const boldK = weightPadK(weight, exact);
    const natural = estimateTextWidth(str, fs, measure) * boldK;
    const capW = natural <= maxLabelWidth ? maxLabelWidth
      : (natural <= maxLabelWidth * 1.2 ? Math.round(natural) : maxLabelWidth);
    const wrapW = exact ? capW : Math.max(60, Math.floor(capW / boldK));
    const lines = wrapLabel(str, wrapW, fs, measure, lineBudget(str, wrapW, fs, measure));
    const textW = Math.max(...lines.map((l) => estimateTextWidth(l, fs, measure))) * boldK + (exact ? 2 : 0);
    return {
      id: seq++,
      title: String(raw.title == null ? '' : raw.title),
      lines,
      fs,
      weight,
      lineH,
      textW,
      padX,
      padY,
      w: Math.round(textW + padX * 2),
      h: Math.round(lines.length * lineH + padY * 2),
      color,
      // 节点强调色（规格里可手改）：非根节点＝**文字色**；根节点是深底白字，所以它＝**框底色**。
      accent: normalizeHex(raw.color),
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

  // ── 叶子分组的"按内容自动横排"（2026-10-22 属主："4 的口诀 4 个可否在一行？按内容实际来排"）──
  //   规则只依赖内容本身，不设横/竖参数：
  //     · 只对**全是叶子**的分组生效（分组内还有下级时不横排，否则子树的列会打架）；
  //     · 按统一字号量每项宽度，能并排几项就并排几项（上限 4 项），放不下换行；
  //     · 整块宽度卡在**该侧可用宽（按 A4 版心算）**以内——靠换行解决宽度，不缩字号。
  // 🔴 2026-10-22（属主："对于多支的也是这样吗？宽度不够，多支可以切换为竖排同级吧"）：
  //   原上限是**写死的 460px**，与版心无关 ⇒ 643 版心下"一侧只剩 200px"时仍按 460 横排，
  //   结果整块超宽、再被整体收窄。现改为：**先算这一侧在 A4 里能拿多少宽**，能并几项就并几项；
  //   连两项都并不下（cols<2）或条目本身是长句 ⇒ **自然回落竖排同级**（一项一行），不做任何硬挤。
  const MAX_GRID_W = 460;
  /** 只有"短条目"才横排（≈8 个汉字以内，含内边距后 ≤160px）；长句子仍竖排——横排会把长句挤成窄栏 */
  const MAX_SHORT_W = 160;
  const fitW = Number(opts.fitWidth) || 0;
  // 一侧可用的横向预算：balanced 两侧对分（扣掉根与两侧外边距/列间隙）；right 整幅归一侧。
  //   ⚠️ 只有"真的分成两侧"（一级分支 ≥2）时才减半——单分支的 balanced 其实独占整幅宽，
  //   按一半算会把多支硬压成竖排（白白浪费半页）。
  const sideCount = layout === 'balanced' && (root.children || []).length > 1 ? 2 : 1;
  const sideBudget = fitW
    ? Math.max(140, Math.round((fitW - 2 * margin - root.w) / sideCount - gapX))
    : MAX_GRID_W;
  /** 该分组可用的整块宽：其前还有 node.depth 层列，按"每列至少 56px"保守扣减 */
  const gridBudgetOf = (node) => Math.max(120, Math.min(MAX_GRID_W, sideBudget - node.depth * (56 + gapX)));
  const gridGeo = (node) => {
    const kids = node.children || [];
    const cols = Math.max(1, Math.min(node.grid.cols, kids.length));
    const rows = Math.ceil(kids.length / cols);
    const colW = Array.from({ length: cols }, (_, c) => Math.max(...kids.filter((_, i) => i % cols === c).map((k) => k.w)));
    const rowH = Array.from({ length: rows }, (_, r) => Math.max(...kids.slice(r * cols, r * cols + cols).map((k) => k.h)));
    const colX = [];
    let ax = 0;
    for (let c = 0; c < cols; c++) { colX[c] = ax; ax += colW[c] + gapX; }
    const rowY = [];
    let ay = 0;
    for (let r = 0; r < rows; r++) { rowY[r] = ay; ay += rowH[r] + gapY; }
    return { cols, rows, colW, rowH, colX, rowY, width: ax - gapX, height: ay - gapY };
  };
  const decideGrid = (node) => {
    node.grid = null;
    const kids = node.children || [];
    if (kids.length >= 3 && kids.every((k) => !(k.children || []).length)) {
      const maxW = Math.max(...kids.map((k) => k.w));
      const budget = gridBudgetOf(node);
      const cols = Math.min(4, Math.floor((budget + gapX) / (maxW + gapX)));
      // cols < 2 ⇒ A4 里这一侧放不下两项并排 ⇒ 不横排，自动走"竖排同级"（下方 tidy 布局一项一行）
      if (cols >= 2 && maxW <= MAX_SHORT_W) node.grid = { cols };
    }
    kids.forEach(decideGrid);
  };
  decideGrid(root);

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
  // side 必须**整棵子树继承**：连线方向（从父节点哪条边出线）和文字对齐
  //    （左半区右对齐）都靠它。只给根的一级子节点设 side，深层节点就会
  //    "人在左边、文字却按左对齐画" → 文字冲出框外。这是实测抓到过的 bug。
  const setSide = (n, s) => {
    n.side = s;
    (n.children || []).forEach((c) => setSide(c, s));
  };
  leftKids.forEach((n) => setSide(n, -1));
  rightKids.forEach((n) => setSide(n, 1));

  // ── 纵向：两侧各自 tidy，各自垂直居中于画布中线 ──
  const hL = layoutSide(leftKids, gapY, gridGeo);
  const hR = layoutSide(rightKids, gapY, gridGeo);
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
  // 横排分组的**整块宽**也要算进它所占的那一层（否则下一层列间距按单节点宽算，
  //   横排的项会插进下一层的列里、和别的节点压在一起）。
  const collectGridW = (n) => {
    if (n.grid) depthW[n.depth + 1] = Math.max(depthW[n.depth + 1] || 0, gridGeo(n).width);
    (n.children || []).forEach(collectGridW);
  };
  all.forEach(collectGridW);
  const colStep = [];
  for (let d = 1; d <= 12; d++) colStep[d] = (depthW[d] || 0) + gapX;

  const halfW = root.w / 2;
  // 根节点自己也要占位！它不参与 placeX（placeX 只排左右两侧的子节点），
  //    漏赋值会让 root.x 停在初始的 0，归一化后整块压到右侧分支上。
  root.x = -halfW;
  /** 第 depth 层、某一侧"靠父节点那一条边"的坐标（右侧＝左边缘，左侧＝右边缘） */
  const bandEdge = (depth, side) => {
    const dir = side === 1 ? 1 : -1;
    let x = dir * (halfW + gapX);
    for (let i = 1; i < depth; i++) x += dir * (colStep[i] || gapX);
    return x;
  };
  const placeX = (n, side, keepX = false) => {
    // 左侧必须**逐层往左**排（colStep 取负），否则越深的节点越往右跑、
    //    直接压到根节点和右半区上（实测 balanced 版式会出现 3200px² 的重叠）。
    if (!keepX) {
      const e = bandEdge(n.depth, side);
      n.x = side === 1 ? e : e - n.w;
    }
    const childEdge = bandEdge(n.depth + 1, side);
    if (n.grid) {
      const g = gridGeo(n);
      n.children.forEach((c, i) => {
        const col = i % g.cols;
        c.x = side === 1 ? childEdge + g.colX[col] : childEdge - g.colX[col] - c.w;
        placeX(c, side, true);
      });
      return;
    }
    n.children.forEach((c) => placeX(c, side));
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
  const seg = (d, color) => out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>`);
  for (const n of nodes) {
    const kids = n.children || [];
    // 🔴 2026-10-22（属主："连接线有的跟内容不太合适"·几何侧）：一组横排（多行多列）时，
    //   若仍按"父→每个子"各拉一条贝塞尔，去第二行的那几条会**从第一行的框后穿过**（看着像连错）。
    //   改为**干线式**布线：父→干线一段、干线纵向贯通整组、再由干线横向接到每个子（正交、不穿框）。
    if (n.grid && kids.length) {
      const leftward = kids[0].side === -1;
      const py = n.y + n.h / 2;
      const cys = kids.map((c) => c.y + c.h / 2);
      const near = leftward
        ? Math.max(...kids.map((c) => c.x + c.w))
        : Math.min(...kids.map((c) => c.x));
      const from = leftward ? n.x : n.x + n.w;
      const trunk = leftward ? from - (from - near) / 2 : from + (near - from) / 2;
      seg(`M ${from} ${py} L ${trunk} ${py}`, n.color);
      seg(`M ${trunk} ${Math.min(py, ...cys)} L ${trunk} ${Math.max(py, ...cys)}`, n.color);
      for (const c of kids) {
        const cy = c.y + c.h / 2;
        const to = leftward ? c.x + c.w : c.x;
        seg(`M ${trunk} ${cy} L ${to} ${cy}`, c.color);
      }
      continue;
    }
    for (const c of n.children || []) {
      const leftward = c.side === -1;
      const from = leftward ? n.x : n.x + n.w;
      const to = leftward ? c.x + c.w : c.x;
      const py = n.y + n.h / 2;
      const cy = c.y + c.h / 2;
      const mx = (from + to) / 2;
      seg(`M ${from} ${py} C ${mx} ${py}, ${mx} ${cy}, ${to} ${cy}`, c.color);
    }
  }

  // ② 再画节点（保证文字/框不被线穿过）
  for (const n of nodes) {
    const r = n.isRoot ? 8 : 6;
    // 强调色（属主："文字能编辑，但不能加粗、改颜色"）：非根＝文字色，根＝框底色（根是深底白字，改字色会看不清）
    const rootFill = n.isRoot && n.accent ? n.accent : HEAD_FILL;
    if (n.isRoot) {
      out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${r}" fill="${rootFill}"/>`);
    } else {
      out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${r}" fill="${PAPER}" stroke="${n.color}" stroke-width="1.3"/>`);
    }
    // 层级同时用字重强化（黑白打印时颜色差异会消失，字重不会）
    //   字重单源在 layout（prep 里算进框宽余量），此处只取用，防两处各判一次。
    const weight = n.weight || (n.isRoot ? 600 : (n.depth === 1 ? 500 : 400));
    const fill = n.isRoot ? PAPER : (n.accent || INK);
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
