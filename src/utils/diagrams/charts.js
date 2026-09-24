/**
 * 📊 统计图（柱状图 / 折线图 / 扇形图）SVG 生成器 —— 纯函数，可独立单测
 * ============================================================
 * 用途：把 `[GRAPH]` 家族里的三种统计图指令（`TYPE:BAR_CHART` / `LINE_CHART` / `PIE_CHART`）
 *   就地渲染成**印刷友好**的矢量图（进 PDF/Word）。
 *   · PDF 通道 = puppeteer setContent + page.pdf → 内联 SVG 是矢量，缩放/打印都不糊；
 *   · Word 通道 = utils/docxBuilder.buildImageRun 只认光栅图 → 由调用方把本函数产出的 SVG 光栅化成 PNG。
 * 契约 / 印刷约定 / 共用能力见 `./shared.js` 头部；风格与命名照抄 `./mindmap.js`（**先读它**）。
 *
 * 🔴 为什么"一个模块覆盖三种图、共用同一对导出"（2026-09-24 用户裁定）：
 *   三种统计图**共用同一份 spec 结构**（data/labels/title/xlabel/ylabel/colors），差异只在出图方式；
 *   拆成三个模块会把坐标轴、刻度、"标签防重叠"这类逻辑复制三遍。故统一
 *   `layoutCharts` / `buildChartsSvg` 一对导出，内部按 `spec.type` 分支 ——
 *   调用方（diagrams/index.js 的适配器）也只需认这一对函数（与其余 6 种图**完全同一契约**）。
 *
 * ── spec（由适配器从指令块转出，图种模块只认这个结构）────────────────────────────
 *   { type:'barChart'|'lineChart'|'pieChart',
 *     data:[…数字], labels:[…], title?, xlabel?, ylabel?, colors?:[…色] }
 *
 * ── 版式硬指标（由 tests/utils/diagramCharts.test.js 守住，不靠肉眼看图）──────────
 *   · 宽高为正整数；所有节点框**两两不重叠**、完全落在画布内；文字不越出图形；无 NaN；确定性。
 *   · 柱状图：柱**等宽**、**间隙 = 柱宽 × 35%**、柱数 = data 长度；
 *   · 折线图：数据点小圆 r=2.5（规格值）、点数 = data 长度；
 *   · 扇形图：`path` 画弧 + 引导线标数值、**各扇区角度和 = 360°（容差 0.01）**、扇区数 = data 长度；
 *   · 数值标签**一律画在最上层**（避免被柱/折线/扇区压住）。
 *
 * 🔴 防重叠的几何保证（不是"事后挤一挤"的修补，改之前先读懂）：
 *   ① 横向用**等宽槽** `slotW = barW + gap`，柱/数据点/分类标签/数值标签**全部以槽中心对齐** →
 *      "相邻同类标签不重叠"由槽宽直接保证；槽宽再按"数值标签实测宽度 + 8px"兜底放大，防止长数值互相压。
 *   ② 纵向分**互不相交的水平带**：标题 → 纵轴名 → 绘图区 → 分类标签 → 横轴名；带间留 `bandPad`
 *      （≥ 刻度文字半高 + 2），因此"纵轴刻度文字"与"标题/纵轴名/数值标签"天然不叠。
 *   ③ 纵轴刻度文字独占**左栏留白** gutter（x < plotX0），而柱/数值标签 x ≥ plotX0 → 横向不相交。
 *   ④ 扇形标签按左/右半区分列（cos(中角) 定侧），同侧按理想 y 排序后**等距堆叠**、再整体居中 →
 *      同侧不重叠；两侧的横向区间被圆心两侧的 `R+22` 隔开 → 跨侧也不重叠。
 * ============================================================
 */

import {
  DEFAULT_PALETTE, INK, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper,
} from './shared.js';

// 文本工具统一在 shared.js（导图族共用），这里再导出一次，与 mindmap.js 的对外 API 保持同形
export { estimateTextWidth, wrapLabel };

/* ============================ 常量：版式参数 ============================ */

const CHART_TYPES = ['barChart', 'lineChart', 'pieChart'];

const GAP_RATIO = 0.35;      // 柱间隙 = 柱宽 × 35%（规格 §统计图）
const BAR_W = 44;            // 柱宽基准（px）
const PLOT_H = 170;          // 绘图区高度基准（px）
const TICK_COUNT = 4;        // 纵轴 4 段 → 5 个刻度（含 0）
const TICK_LEN = 5;          // 纵轴刻度线长（px）
const CAT_GAP = 9;           // 基准线 → 分类标签的间距（px）
const PIE_R = 90;            // 扇形半径基准（px）
const PIE_LEADER_GAP = 22;   // 圆周 → 标签框的水平距离（引导线长度）
const PIE_LABEL_VGAP = 6;    // 同侧标签之间的最小竖向间隙（px）
const POINT_R = 2.5;         // 折线数据点半径（规格定死）
const PAD_X = 4;             // 标签框水平内边距（无边框的纯文字框，取小值以免把槽撑宽）
const PAD_Y = 2;             // 标签框垂直内边距
const BAND_GAP = 6;          // 标题/轴名之间的行距

const asText = (v) => (v == null ? '' : String(v));
const asNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** 数值 → 短文本（抹掉浮点尾巴：0.30000000000000004 → 0.3） */
const fmtNum = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 100) / 100);
};

/** "好看"的刻度步长：保证 `step ≥ raw`，且形如 1 / 2 / 2.5 / 5 × 10^k（刻度值好读，不出现 7.5、22.5 这类） */
const niceStep = (raw) => {
  if (!(raw > 0)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const frac = raw / base;
  const m = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return m * base;
};

/** 折行行数预算：按内容量给够，避免 `…` 掉在中段（口径同 timeline.js） */
const lineBudget = (text, fs, wrapW, measurer) =>
  Math.max(2, Math.ceil(estimateTextWidth(text, fs, measurer) / Math.max(1, wrapW)) + 1);

/** 生成一个"文字标签框"（框宽 = 实测文字宽 + 2*PAD_X → 文字绝不越出图形） */
const makeLabel = (raw, fs, wrapW, measurer, tf) => {
  const src = tf(asText(raw));
  const lineH = Math.round(fs * 1.42);
  const lines = src.trim() === ''
    ? ['']
    : wrapLabel(src, wrapW, fs, measurer, lineBudget(src, fs, wrapW, measurer));
  const textW = lines.reduce((m, l) => Math.max(m, estimateTextWidth(l, fs, measurer)), 0);
  return {
    src, lines, textW, lineH,
    w: Math.round(textW + PAD_X * 2),
    h: Math.round(lines.length * lineH + PAD_Y * 2),
  };
};

/** 取该分类的颜色：优先 spec.colors[i]，缺省按 DEFAULT_PALETTE 轮转 */
const makeColorAt = (colors, palette) => (i) => {
  const c = colors && colors[i] != null ? asText(colors[i]).trim() : '';
  return c || palette[i % palette.length];
};

/* ============================ ① 版式计算：柱状图 / 折线图（共用坐标轴版式） ============================ */

const layoutAxes = (spec, opts, kind) => {
  const {
    fontSize = 13, titleFontSize = 15, tickFontSize = 11,
    maxLabelWidth = 150, palette = DEFAULT_PALETTE, measurer, labelTransform,
    barWidth, plotHeight, grid = false,
  } = opts;
  const tf = typeof labelTransform === 'function' ? labelTransform : asText;
  const bodyFs = Math.max(11, Math.round(fontSize));
  const tickFs = Math.max(9, Math.round(tickFontSize));
  const titleFs = Math.max(11, Math.round(titleFontSize));
  const lineH = Math.round(bodyFs * 1.42);
  const tickLineH = Math.round(tickFs * 1.42);
  const valueH = lineH + PAD_Y * 2;
  const tickH = tickLineH + PAD_Y * 2;

  const body = spec || {};
  const data = (Array.isArray(body.data) ? body.data : []).map(asNum);
  const n = data.length;
  const labelsRaw = Array.isArray(body.labels) ? body.labels : [];
  const colorAt = makeColorAt(Array.isArray(body.colors) ? body.colors : null, palette);

  const asLabel = (v, fs) => (asText(v).trim() === '' ? null : makeLabel(v, fs, maxLabelWidth, measurer, tf));
  const titleBox = asLabel(body.title, titleFs);
  const ylabelBox = asLabel(body.ylabel, bodyFs);
  const xlabelBox = asLabel(body.xlabel, bodyFs);

  /* ── 横向：等宽槽（槽 = 柱 + 间隙，间隙 = 柱宽 × 35%）；槽宽再按"数值标签宽度 + 8px"兜底 ── */
  const valueTexts = data.map(fmtNum);
  let valueTextW = 0;
  for (const t of valueTexts) valueTextW = Math.max(valueTextW, estimateTextWidth(t, bodyFs, measurer));
  let barW = Math.max(18, Math.round(Number(barWidth) > 0 ? Number(barWidth) : BAR_W));
  let slotW = barW + Math.round(barW * GAP_RATIO);
  const needSlot = Math.round(valueTextW + PAD_X * 2 + 8);   // 保证相邻数值标签之间 ≥ 8px
  if (needSlot > slotW) {
    slotW = needSlot;
    barW = Math.round(slotW / (1 + GAP_RATIO));
  }
  const barGap = slotW - barW;
  // 分类标签折行宽度按槽宽反推 → 相邻分类标签之间也留 ≥ 8px（且 ≤ maxLabelWidth）
  const catWrapW = Math.max(24, Math.min(maxLabelWidth, slotW - PAD_X * 2 - 8));

  /* ── 纵向刻度："好看"步长，使最高刻度 ≥ 数据最大值（柱高比例 ⊆ [0,1]，不溢出绘图区）── */
  const maxVal = data.reduce((m, v) => Math.max(m, v), 0);
  const step = maxVal > 0 ? niceStep(maxVal / TICK_COUNT) : 1;
  const tickMax = step * TICK_COUNT;
  const ticks = [];
  let maxTickW = 0;
  for (let j = 0; j <= TICK_COUNT; j++) {
    const val = step * j;
    const txt = fmtNum(val);
    const w = Math.round(estimateTextWidth(txt, tickFs, measurer) + PAD_X * 2);
    maxTickW = Math.max(maxTickW, w);
    ticks.push({ value: val, text: txt, w });
  }
  const gutterW = maxTickW + 8;   // 纵轴刻度值的左栏留白（刻度文字独占，不与绘图区内容相交）
  const plotW = n > 0 ? slotW * n : slotW * 2;

  /* ── 画布骨架（自上而下：标题 → 纵轴名 → 绘图区 → 分类标签 → 横轴名）── */
  const margin = Math.max(12, Math.round(bodyFs * 1.1));
  // bandPad ≥ 刻度文字半高 + 2：保证"标题/纵轴名"与绘图区首行刻度文字不贴（见文件头 🔴②）
  const bandPad = Math.ceil(tickH / 2) + 2;
  let topY = margin;
  const titleY = topY;
  if (titleBox) topY += titleBox.h + bandPad;
  const ylabelY = topY;
  if (ylabelBox) topY += ylabelBox.h + bandPad;
  const plotTop = topY;

  const plotH = Math.max(
    Math.round(Number(plotHeight) > 0 ? Number(plotHeight) : PLOT_H),
    valueH + 4 + POINT_R + 24,   // 给数值标签 + 点标记留足头顶空间（避免最高元素越出绘图区）
  );
  const baseline = plotTop + plotH;
  const plotX0 = margin + gutterW;
  // 最高柱/点的顶部与其数值标签之间留 4px（数值标签**在图形上方**，不压图形）
  const maxBarH = Math.max(1, plotH - valueH - 4 - (kind === 'lineChart' ? POINT_R : 0));

  /* ── 分类标签（基准线下方；折行后框宽 ≤ catWrapW）── */
  const catItems = [];
  let maxCatH = 0;
  for (let i = 0; i < n; i++) {
    const raw = asText(labelsRaw[i]).trim() !== '' ? labelsRaw[i] : String(i + 1);
    const lb = makeLabel(raw, bodyFs, catWrapW, measurer, tf);
    maxCatH = Math.max(maxCatH, lb.h);
    catItems.push(lb);
  }
  const catBandTop = baseline + CAT_GAP;
  const xlabelTop = catBandTop + maxCatH + BAND_GAP;
  const xlabelH = xlabelBox ? xlabelBox.h : 0;
  const height = Math.round(xlabelTop + xlabelH + margin);

  /* ── 画布宽：内容 + 外边距；标题/轴名过宽时同步加宽，保证不越界 ── */
  let width = Math.round(plotX0 + plotW + margin);
  const widenFor = (box) => { if (box) width = Math.max(width, box.w + margin * 2); };
  widenFor(titleBox); widenFor(ylabelBox); widenFor(xlabelBox);
  const centerX = Math.round(width / 2);

  /* ── 落位 ── */
  const nodes = [];
  let seq = 0;
  const add = (node) => { nodes.push({ id: seq++, title: '', lines: [''], ...node }); };
  const yOf = (v) => baseline - (Math.max(0, v) / tickMax) * maxBarH;

  // ① 纵轴刻度文字（左栏，右对齐到轴）
  for (const t of ticks) {
    const y = Math.round(yOf(t.value) - tickH / 2);
    add({
      role: 'tickLabel', title: t.text, lines: [t.text], value: t.value, fs: tickFs,
      x: Math.round(plotX0 - 6 - t.w), y, w: t.w, h: tickH,
    });
  }

  // ② 数据：柱 / 折线数据点 + 各自数值标签 + 分类标签
  for (let i = 0; i < n; i++) {
    const cx = plotX0 + i * slotW + slotW / 2;
    const cxr = Math.round(cx);
    const color = colorAt(i);
    const vTxt = valueTexts[i];
    const vw = Math.round(estimateTextWidth(vTxt, bodyFs, measurer) + PAD_X * 2);

    if (kind === 'lineChart') {
      const cy = yOf(data[i]);
      add({ role: 'point', x: Math.round(cx - POINT_R), y: Math.round(cy - POINT_R), w: POINT_R * 2, h: POINT_R * 2, cx: cxr, cy: Math.round(cy), color, index: i, value: data[i] });
      add({ role: 'valueLabel', title: vTxt, lines: [vTxt], x: Math.round(cx - vw / 2), y: Math.round(cy - POINT_R - 4 - valueH), w: vw, h: valueH, color, index: i, value: data[i], cx: cxr, fs: bodyFs });
    } else {
      const barH = Math.max(0, Math.round((Math.max(0, data[i]) / tickMax) * maxBarH));
      add({ role: 'bar', x: Math.round(cx - barW / 2), y: baseline - barH, w: barW, h: barH, color, index: i, value: data[i], cx: cxr });
      add({ role: 'valueLabel', title: vTxt, lines: [vTxt], x: Math.round(cx - vw / 2), y: Math.round(baseline - barH - 4 - valueH), w: vw, h: valueH, color, index: i, value: data[i], cx: cxr, fs: bodyFs });
    }

    const lb = catItems[i];
    add({ role: 'catLabel', title: lb.src, lines: lb.lines, x: Math.round(cx - lb.w / 2), y: catBandTop, w: lb.w, h: lb.h, color, index: i, cx: cxr, fs: bodyFs });
  }

  // ③ 标题 / 纵轴名 / 横轴名（各自独立行带，互相不叠）
  if (titleBox) add({ role: 'title', title: titleBox.src, lines: titleBox.lines, x: Math.round(centerX - titleBox.w / 2), y: titleY, w: titleBox.w, h: titleBox.h, fs: titleFs });
  if (ylabelBox) add({ role: 'ylabel', title: ylabelBox.src, lines: ylabelBox.lines, x: margin, y: ylabelY, w: ylabelBox.w, h: ylabelBox.h, fs: bodyFs });
  if (xlabelBox) add({ role: 'xlabel', title: xlabelBox.src, lines: xlabelBox.lines, x: Math.round(centerX - xlabelBox.w / 2), y: xlabelTop, w: xlabelBox.w, h: xlabelBox.h, fs: bodyFs });

  return {
    nodes,
    width,
    height,
    metrics: {
      type: kind, fontSize: bodyFs, tickFontSize: tickFs, titleFontSize: titleFs,
      lineH, valueH, padX: PAD_X, padY: PAD_Y, margin,
      slotW, barW, barGap, count: n,
      plotX0, plotTop, plotW, plotH, baseline, maxBarH, gutterW,
      tickMax, tickStep: step, tickCount: TICK_COUNT, grid: !!grid,
    },
  };
};

/* ============================ ① 版式计算：扇形图 ============================ */

const layoutPie = (spec, opts) => {
  const {
    fontSize = 13, titleFontSize = 15, maxLabelWidth = 150,
    palette = DEFAULT_PALETTE, measurer, labelTransform, radius,
  } = opts;
  const tf = typeof labelTransform === 'function' ? labelTransform : asText;
  const bodyFs = Math.max(11, Math.round(fontSize));
  const titleFs = Math.max(11, Math.round(titleFontSize));
  const lineH = Math.round(bodyFs * 1.42);

  const body = spec || {};
  const raw = (Array.isArray(body.data) ? body.data : []).map(asNum);
  const vals = raw.map((v) => Math.max(0, v));   // 扇区分量非负（负数无法成扇）
  const n = vals.length;
  const labelsRaw = Array.isArray(body.labels) ? body.labels : [];
  const colorAt = makeColorAt(Array.isArray(body.colors) ? body.colors : null, palette);
  const titleBox = asText(body.title).trim() === '' ? null : makeLabel(body.title, titleFs, maxLabelWidth, measurer, tf);

  const total = vals.reduce((a, b) => a + b, 0);
  // 🔴 角度总和**恒为 360**：全 0 数据退化为等分（否则 0/0 → NaN；单测有 360°±0.01 的硬断言）
  const sweeps = n === 0 ? [] : (total > 0 ? vals.map((v) => (v / total) * 360) : vals.map(() => 360 / n));
  const R = Math.max(40, Math.round(Number(radius) > 0 ? Number(radius) : PIE_R));
  const margin = Math.max(12, Math.round(bodyFs * 1.1));

  const sectors = [];
  let ang = -90;   // 从 12 点方向起算（视觉自然），顺时针（SVG 的 y 轴向下）
  for (let i = 0; i < n; i++) {
    const sweep = sweeps[i];
    sectors.push({
      index: i, value: vals[i], rawValue: raw[i], color: colorAt(i),
      startAngle: ang, endAngle: ang + sweep, sweep, midAngle: ang + sweep / 2,
    });
    ang += sweep;
  }

  // 标签文字 = `分类 数值`（无分类则只写数值）→ 保证"数值标签出现在 SVG 里"
  const items = sectors.map((s) => {
    const labelTxt = asText(labelsRaw[s.index]).trim() !== '' ? asText(labelsRaw[s.index]).trim() : String(s.index + 1);
    const text = `${labelTxt} ${fmtNum(s.value)}`;
    const lb = makeLabel(text, bodyFs, maxLabelWidth, measurer, tf);
    const rad = (s.midAngle * Math.PI) / 180;
    return {
      ...s, lb,
      side: Math.cos(rad) >= 0 ? 'right' : 'left',   // 按中角水平分量定侧
      pref: Math.sin(rad) * R,                        // 该扇区的"理想"标签中心 y（局部坐标）
      arcX: Math.cos(rad) * R,
      arcY: Math.sin(rad) * R,
    };
  });

  /* ── 同侧标签：按理想 y 排序后等距堆叠，再整体居中 → 同侧不重叠（见文件头 🔴④）── */
  const stackSide = (side) => {
    const arr = items.filter((it) => it.side === side).sort((p, q) => (p.pref - q.pref) || (p.index - q.index));
    if (!arr.length) return;
    const gap = arr.reduce((m, it) => Math.max(m, it.lb.h), lineH) + PIE_LABEL_VGAP;
    let prev = null;
    for (const it of arr) {
      it.labelCy = prev == null ? it.pref : Math.max(it.pref, prev + gap);
      prev = it.labelCy;
    }
    const mid = (arr[0].labelCy + arr[arr.length - 1].labelCy) / 2;
    for (const it of arr) it.labelCy -= mid;
  };
  stackSide('right');
  stackSide('left');

  const inner = R + PIE_LEADER_GAP;
  const localBoxes = items.map((it) => ({
    it,
    x: it.side === 'right' ? inner : -inner - it.lb.w,
    y: it.labelCy - it.lb.h / 2,
    w: it.lb.w,
    h: it.lb.h,
  }));

  /* ── 归一化：算局部包围盒（含圆本体）→ 平移到正坐标系并含外边距 ── */
  let minX = -R;
  let maxX = R;
  let minY = -R;
  let maxY = R;
  for (const b of localBoxes) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const titleH = titleBox ? titleBox.h : 0;
  const topPad = margin + (titleBox ? titleH + BAND_GAP : 0);
  const dx = Math.round(margin - Math.floor(minX));
  const dy = Math.round(topPad - Math.floor(minY));
  let width = Math.ceil(maxX + dx + margin);
  const height = Math.ceil(maxY + dy + margin);
  if (titleBox) width = Math.max(width, titleBox.w + margin * 2);
  const centerX = Math.round(width / 2);

  const nodes = [];
  let seq = 0;
  if (titleBox) {
    nodes.push({ id: seq++, role: 'title', title: titleBox.src, lines: titleBox.lines, x: Math.round(centerX - titleBox.w / 2), y: margin, w: titleBox.w, h: titleBox.h, fs: titleFs });
  }
  for (const b of localBoxes) {
    const it = b.it;
    nodes.push({
      id: seq++,
      role: 'pieLabel',
      title: it.lb.src,
      lines: it.lb.lines,
      x: Math.round(b.x + dx),
      y: Math.round(b.y + dy),
      w: it.lb.w,
      h: it.lb.h,
      color: it.color,
      index: it.index,
      value: it.value,
      startAngle: it.startAngle,
      endAngle: it.endAngle,
      sweep: it.sweep,
      midAngle: it.midAngle,
      side: it.side,
      arcX: Math.round(it.arcX + dx),
      arcY: Math.round(it.arcY + dy),
      labelAnchorX: Math.round((it.side === 'right' ? b.x : b.x + b.w) + dx),
      labelCy: Math.round(it.labelCy + dy),
      fs: bodyFs,
    });
  }

  return {
    nodes,
    width,
    height,
    metrics: {
      type: 'pieChart', fontSize: bodyFs, titleFontSize: titleFs, lineH, padX: PAD_X, padY: PAD_Y, margin,
      radius: R, cx: dx, cy: dy, sectorCount: n, total,
      sectorAngles: sectors.map((s) => s.sweep),
      angleSum: sectors.reduce((a, s) => a + s.sweep, 0),
      leaderGap: PIE_LEADER_GAP,
    },
  };
};

/* ============================ 版式入口：按 spec.type 分支 ============================ */

/**
 * 只算版式，不出图（三种统计图共用同一对导出的"算"一半）。
 * @param {object} spec `{ type, data, labels?, title?, xlabel?, ylabel?, colors? }`
 * @param {object} opts
 *   - fontSize / titleFontSize / tickFontSize / maxLabelWidth / palette / measurer / labelTransform
 *   - barWidth 柱宽基准（barChart/lineChart）
 *   - plotHeight 绘图区高度基准（barChart/lineChart）
 *   - grid 是否画淡灰网格线（默认 false）
 *   - radius 扇形半径基准（pieChart）
 * @returns {{nodes:Array, width:number, height:number, metrics:object}}
 *   nodes 已平铺，坐标为**最终像素值**（含外边距、全为正）；每包含 `{ id, role, title, x, y, w, h, lines }`，
 *   并带该图种的专属字段（柱/点/扇形的框、`value`、扇形还有 `startAngle/endAngle/sweep/midAngle`）。
 */
export const layoutCharts = (spec, opts = {}) => {
  const type = spec && CHART_TYPES.includes(spec.type) ? spec.type : 'barChart';
  return type === 'pieChart' ? layoutPie(spec, opts) : layoutAxes(spec, opts, type);
};

/* ============================ ② 出图 ============================ */

/** 把文字节点写成 `<text>`（anchor 决定 x；基线口径沿用 mindmap.js） */
const textEls = (out, n, { weight = 400, anchor = 'start', fill = INK } = {}) => {
  const fs = n.fs || 13;
  const lh = Math.round(fs * 1.42);
  const tx = anchor === 'middle' ? n.x + n.w / 2 : anchor === 'end' ? n.x + n.w - PAD_X : n.x + PAD_X;
  n.lines.forEach((line, i) => {
    const ty = n.y + PAD_Y + i * lh + fs * 1.06;
    out.push(`<text x="${Number(tx.toFixed(1))}" y="${ty.toFixed(1)}" font-size="${fs}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(line)}</text>`);
  });
};

/** 柱状图 / 折线图：坐标轴 + 基准线 + 刻度 + 数据 + 文字（数值标签最后画 → 最上层） */
const renderAxes = (nodes, metrics) => {
  const out = [];
  const { plotX0, plotTop, plotW, baseline, tickMax, maxBarH, tickCount } = metrics;
  const plotRight = plotX0 + plotW;

  // ① 网格（可选，淡灰 1px，压在数据之下）
  if (metrics.grid) {
    for (let j = 0; j <= tickCount; j++) {
      const y = Math.round(baseline - (j / tickCount) * maxBarH);
      out.push(`<line x1="${plotX0}" y1="${y}" x2="${plotRight}" y2="${y}" stroke="#dfe6ee" stroke-width="1"/>`);
    }
  }

  // ② 坐标轴（纵轴 + 横轴=基准线）+ 纵轴刻度线
  out.push(`<line x1="${plotX0}" y1="${plotTop}" x2="${plotX0}" y2="${baseline}" stroke="${INK}" stroke-width="1.6"/>`);
  out.push(`<line x1="${plotX0}" y1="${baseline}" x2="${plotRight}" y2="${baseline}" stroke="${INK}" stroke-width="1.6"/>`);
  for (const t of nodes.filter((x) => x.role === 'tickLabel')) {
    const y = Math.round(baseline - (t.value / tickMax) * maxBarH);
    out.push(`<line x1="${plotX0 - TICK_LEN}" y1="${y}" x2="${plotX0}" y2="${y}" stroke="${INK}" stroke-width="1"/>`);
  }

  // ③ 数据：柱（等宽 + 35% 间隙）/ 折线（带数据点小圆）
  if (metrics.type === 'barChart') {
    for (const b of nodes.filter((x) => x.role === 'bar')) {
      if (b.h <= 0) continue;   // 0 高柱不画（避免 0 高 rect 被某些渲染器画成 1px 线）
      out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${b.color}" stroke="${b.color}" stroke-width="1"/>`);
    }
  } else {
    const pts = nodes.filter((x) => x.role === 'point');
    if (pts.length > 1) {
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx} ${p.cy}`).join(' ');
      out.push(`<path d="${d}" fill="none" stroke="${pts[0].color}" stroke-width="2" stroke-linejoin="round"/>`);
    }
    for (const p of pts) out.push(`<circle cx="${p.cx}" cy="${p.cy}" r="${POINT_R}" fill="${p.color}" stroke="${PAPER}" stroke-width="1"/>`);
  }

  // ④ 文字：标题 / 轴名 / 刻度 / 分类 → 最后数值标签（压最上层）
  for (const n of nodes) {
    if (n.role === 'title') textEls(out, n, { weight: 600, anchor: 'middle' });
    else if (n.role === 'ylabel') textEls(out, n, { weight: 500, anchor: 'start' });
    else if (n.role === 'xlabel') textEls(out, n, { weight: 500, anchor: 'middle' });
    else if (n.role === 'tickLabel') textEls(out, n, { weight: 400, anchor: 'end' });
    else if (n.role === 'catLabel') textEls(out, n, { weight: 400, anchor: 'middle' });
  }
  for (const n of nodes.filter((x) => x.role === 'valueLabel')) textEls(out, n, { weight: 600, anchor: 'middle' });

  return out;
};

/** 扇形图：path 画弧 + 引导线 + 标签（无坐标轴；数值标签最上层） */
const renderPie = (nodes, metrics) => {
  const out = [];
  const { cx, cy, radius: R } = metrics;
  const labels = nodes.filter((n) => n.role === 'pieLabel');
  const rad = (deg) => (deg * Math.PI) / 180;
  const pt = (deg) => [cx + R * Math.cos(rad(deg)), cy + R * Math.sin(rad(deg))];

  // ① 扇区（0 度扇区跳过；整圆用 <circle>，单条 arc 画不出 360°）
  for (const n of labels) {
    if (!(n.sweep > 0)) continue;
    if (n.sweep >= 359.999) {
      out.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${n.color}" stroke="${PAPER}" stroke-width="1"/>`);
      continue;
    }
    const [x1, y1] = pt(n.startAngle);
    const [x2, y2] = pt(n.endAngle);
    const large = n.sweep > 180 ? 1 : 0;
    out.push(`<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${n.color}" stroke="${PAPER}" stroke-width="1"/>`);
  }

  // ② 引导线（弧中点 → 标签框内边缘中点）
  for (const n of labels) {
    out.push(`<line x1="${n.arcX}" y1="${n.arcY}" x2="${n.labelAnchorX}" y2="${n.labelCy}" stroke="${INK}" stroke-width="1" opacity="0.7"/>`);
  }

  // ③ 标题 + 标签（数值标签最上层）
  const title = nodes.find((n) => n.role === 'title');
  if (title) textEls(out, title, { weight: 600, anchor: 'middle' });
  for (const n of labels) textEls(out, n, { weight: 500, anchor: n.side === 'left' ? 'end' : 'start' });

  return out;
};

/** 版式 → SVG 字符串（不含 DOCTYPE/<?xml>，可直接内联进 HTML / PDF） */
export const buildChartsSvg = (spec, opts = {}) => {
  const { nodes, width, height, metrics } = layoutCharts(spec, opts);
  const out = [];
  out.push(svgHeader(width, height));
  out.push(svgPaper(width, height));
  out.push(...(metrics.type === 'pieChart' ? renderPie(nodes, metrics) : renderAxes(nodes, metrics)));
  out.push('</svg>');
  return { svg: out.join('\n'), width, height, nodes };
};

export default { layoutCharts, buildChartsSvg, estimateTextWidth, wrapLabel };
