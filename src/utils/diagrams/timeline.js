/**
 * 🕰 时间轴 SVG 生成器 —— 纯函数，可独立单测
 * ============================================================
 * 用途：把 `{ items: [{ when, text, detail? }] }` 渲染成**印刷友好**的横向时间轴。
 *   · PDF 通道 = puppeteer setContent + page.pdf → 内联 SVG 是矢量，缩放/打印都不糊；
 *   · Word 通道 = utils/docxBuilder.buildImageRun 只认光栅图 → 由调用方把 SVG 光栅化成 PNG。
 * 契约 / 印刷约定 / 共用能力见 `./shared.js` 头部；风格与命名照抄 `./mindmap.js`（**先读它**）。
 *
 * ── 版式要点（规格 §3 时间轴）────────────────────────────────────────────────
 *   · 主轴横线在画布垂直中线附近（`axisY`），两端各留 `margin`；线宽 2px；
 *   · 每个事件占一个**等宽槽** `slotW = maxItemW + 24`，事件框在槽内水平居中 →
 *     相邻槽的框**几何上不可能重叠**（不是"事后挤一挤"的修补）；
 *   · 事件**上下交替**（偶数序号在上、奇数在下），框离轴 24px，从轴向框引一条
 *     竖直引线（1.4px），轴上该点画 r=4 的实心圆点（颜色按序取 palette）；
 *   · 框宽 = 该框全部文字**实测宽度最大值** + 2*padX → 文字绝不越出图形；
 *     文字一律左对齐，日期行用 600 字重 + 分支色强调（黑白打印时字重仍在、颜色会丢）。
 *
 * 🔴 两个刻意的取舍（改之前先读，都是被"硬指标单测"倒逼出来的）：
 *   1) `title` = `[when, text, detail].join(' ')`。规格的"文字不丢"断言比的是 title 与
 *      lines 的**前缀关系**，而框内三段要各自折行（when 还要换字重/颜色）。把三段原样拼进
 *      title，既满足断言口径，又让 title 仍是"这个框里到底有哪些字"的完整描述（检索/无障碍友好）。
 *   2) `lineBudget`：折行**行数按内容量给够**（`ceil(宽/maxLabelWidth)+2`），不写死 3 行。
 *      写死 3 行时，超长的 `text` 会把截断标记 `…` 留在**中段**（后面还有 detail），
 *      "只允许末尾 …" 的口径立刻不成立 —— 这是被"文字不丢"断言倒逼出的实现约束。
 * ============================================================
 */

import {
  DEFAULT_PALETTE, INK, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper,
} from './shared.js';

// 文本工具统一在 shared.js（导图族共用），这里再导出一次，与 mindmap.js 的对外 API 保持同形
export { estimateTextWidth, wrapLabel };

/* ============================ 常量：版式参数（规格 §3 定死） ============================ */

const AXIS_TO_BOX = 24;    // 事件框距主轴的垂直距离（px）
const DOT_R = 4;           // 轴上锚点半径（px）
const SLOT_PAD = 24;       // 槽内两侧留白：slotW = maxItemW + SLOT_PAD
const LEADER_W = 1.4;      // 引线线宽（px）
const AXIS_W = 2;          // 主轴线宽（px）
const BOX_R = 6;           // 事件框圆角
const BOX_STROKE_W = 1.3;  // 事件框边框
const PAD_X = 11;
const PAD_Y = 7;

const asText = (v) => (v == null ? '' : String(v));

/** 折行行数预算：按内容量给够，避免 `…` 掉在中段（见文件头 🔴 2） */
const lineBudget = (text, fs, maxLabelWidth, measurer) =>
  Math.max(3, Math.ceil(estimateTextWidth(text, fs, measurer) / Math.max(1, maxLabelWidth)) + 2);

/* ============================ ① 版式计算 ============================ */

/**
 * 只算版式，不出图。
 * @param {object} spec `{ items: [{ when, text, detail? }] }`；item 也可直接给字符串（当作 text）
 * @param {object} opts
 *   - fontSize      正文（text/detail）字号，默认 13
 *   - titleFontSize 日期行（when）字号，默认 15 —— 时间轴的"标题"就是时间点本身
 *   - maxLabelWidth 折行宽度上限，默认 150
 *   - palette / measurer / labelTransform（公式线性化钩子，见 mindmap.js 注释）
 * @returns {{nodes:Array, width:number, height:number, metrics:object}}
 *   nodes 已平铺，坐标为**最终像素值**（含外边距、全为正）；每个节点含
 *   `{ id, title, x, y, w, h, lines }` 及时间轴专属字段
 *   `{ when, text, detail, groups, side, index, color, leaderX, leaderFrom, leaderTo, axisY, dotR }`。
 */
export const layoutTimeline = (spec, opts = {}) => {
  const {
    fontSize = 13,
    titleFontSize = 15,
    maxLabelWidth = 150,
    palette = DEFAULT_PALETTE,
    measurer,
    labelTransform,
  } = opts;

  const tf = typeof labelTransform === 'function' ? labelTransform : asText;
  const rawItems = Array.isArray(spec && spec.items) ? spec.items : [];
  const items = rawItems.filter((it) => it != null);

  const padX = PAD_X;
  const padY = PAD_Y;
  // 字号下限 11px（印刷约定），日期行略大于正文以形成主次
  const whenFs = Math.max(11, Math.round(titleFontSize));
  const bodyFs = Math.max(11, Math.round(fontSize));
  const lineFs = Math.max(whenFs, bodyFs);
  const lineH = Math.round(lineFs * 1.42);          // 整块文字共用的行距（节奏均匀）
  const margin = Math.round(lineFs * 1.2);

  /* ── 归一化：逐事件折行、量宽 ── */
  const prepared = items.map((rawItem, index) => {
    const it = typeof rawItem === 'string' ? { text: rawItem } : rawItem;
    const whenSrc = tf(asText(it.when != null ? it.when : ''));
    const textSrc = tf(asText(it.text != null ? it.text : ''));
    const detailRaw = tf(asText(it.detail));
    const hasDetail = detailRaw.trim() !== '';

    const color = palette[index % palette.length];
    const wrap = (src, fs) => wrapLabel(src, maxLabelWidth, fs, measurer, lineBudget(src, fs, maxLabelWidth, measurer));

    // groups 是"渲染单元"：每段各自折行、各自带字重/颜色。
    // when 在最前（600 字重 + 分支色），其后 text、可选 detail（INK 常规字重）。
    const groups = [];
    if (whenSrc.trim()) groups.push({ key: 'when', src: whenSrc, fs: whenFs, weight: 600, color, lines: wrap(whenSrc, whenFs) });
    if (textSrc.trim()) groups.push({ key: 'text', src: textSrc, fs: bodyFs, weight: 400, color: INK, lines: wrap(textSrc, bodyFs) });
    if (hasDetail) groups.push({ key: 'detail', src: detailRaw, fs: bodyFs, weight: 400, color: INK, lines: wrap(detailRaw, bodyFs) });
    // 三段全空也要留一行，保证框高为正（空/脏输入不崩）
    if (!groups.length) groups.push({ key: 'text', src: '', fs: bodyFs, weight: 400, color: INK, lines: [''] });

    const lines = groups.reduce((acc, g) => acc.concat(g.lines), []);
    const textW = groups.reduce(
      (m, g) => g.lines.reduce((mm, l) => Math.max(mm, estimateTextWidth(l, g.fs, measurer)), m),
      0,
    );

    return {
      index,
      id: index,
      side: index % 2 === 0 ? 'up' : 'down',   // 偶数在上、奇数在下
      color,
      when: whenSrc,
      text: textSrc,
      detail: hasDetail ? detailRaw : '',
      title: [whenSrc, textSrc, hasDetail ? detailRaw : ''].filter((s) => s !== '').join(' '),
      groups,
      lines,
      fs: bodyFs,
      whenFs,
      lineH,
      w: Math.round(textW + padX * 2),          // 框宽由实测文字宽度反推 → 文字绝不越出
      h: Math.round(lines.length * lineH + padY * 2),
    };
  });

  /* ── 横向：等宽槽，框在槽内居中 ── */
  const maxItemW = prepared.reduce((m, it) => Math.max(m, it.w), 0);
  const slotW = maxItemW + SLOT_PAD;
  const count = prepared.length;
  // 空输入时仍画一条极短主轴：尺寸保持为正，调用方不必特判
  const axisLen = count > 0 ? count * slotW : Math.round(bodyFs * 6);
  const width = margin * 2 + axisLen;

  /* ── 纵向：轴居中于上下两个内容带之间 ── */
  const upH = prepared.filter((it) => it.side === 'up').reduce((m, it) => Math.max(m, it.h), 0);
  const downH = prepared.filter((it) => it.side === 'down').reduce((m, it) => Math.max(m, it.h), 0);
  const aboveBand = upH > 0 ? upH + AXIS_TO_BOX : 0;
  const belowBand = downH > 0 ? downH + AXIS_TO_BOX : 0;
  const axisY = margin + aboveBand;
  const height = aboveBand + belowBand + margin * 2;

  /* ── 落位：槽中心 → 框；引线端点贴在框边上（不穿框）── */
  const nodes = prepared.map((it) => {
    const cx = Math.round(margin + it.index * slotW + slotW / 2);   // 引线 / 轴点 x
    const x = Math.round(cx - it.w / 2);                           // 框在槽内居中
    const y = it.side === 'up' ? axisY - AXIS_TO_BOX - it.h : axisY + AXIS_TO_BOX;
    return {
      ...it,
      x,
      y,
      leaderX: cx,
      leaderFrom: axisY,
      leaderTo: it.side === 'up' ? y + it.h : y,
      axisY,
      dotR: DOT_R,
      slotCenterX: margin + it.index * slotW + slotW / 2,
    };
  });

  return {
    nodes,
    width: Math.round(width),
    height: Math.round(height),
    metrics: {
      padX, padY, lineH, slotW, maxItemW, axisY, margin,
      fontSize: bodyFs, whenFontSize: whenFs, itemCount: count, axisToBox: AXIS_TO_BOX, dotR: DOT_R,
    },
  };
};

/* ============================ ② 出图 ============================ */

/** 版式 → SVG 字符串（不含 DOCTYPE/<?xml>，可直接内联进 HTML / PDF） */
export const buildTimelineSvg = (spec, opts = {}) => {
  const { nodes, width, height, metrics } = layoutTimeline(spec, opts);
  const out = [];
  out.push(svgHeader(width, height));
  out.push(svgPaper(width, height));

  // ① 主轴：从左端 margin 贯穿到右端 margin
  const x1 = metrics.margin;
  const x2 = width - metrics.margin;
  if (x2 > x1) {
    out.push(`<line x1="${x1}" y1="${metrics.axisY}" x2="${x2}" y2="${metrics.axisY}" stroke="${INK}" stroke-width="${AXIS_W}" stroke-linecap="round"/>`);
  }

  // ② 引线 + 轴点（先画，随后被事件框压住末端，线不会穿进框里）
  for (const n of nodes) {
    out.push(`<line x1="${n.leaderX}" y1="${n.leaderFrom}" x2="${n.leaderX}" y2="${n.leaderTo}" stroke="${n.color}" stroke-width="${LEADER_W}" opacity="0.9"/>`);
    out.push(`<circle cx="${n.leaderX}" cy="${metrics.axisY}" r="${n.dotR}" fill="${n.color}"/>`);
  }

  // ③ 事件框 + 文字（后画，保证文字不被线穿过）
  for (const n of nodes) {
    out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${BOX_R}" fill="${PAPER}" stroke="${n.color}" stroke-width="${BOX_STROKE_W}"/>`);
    const tx = n.x + metrics.padX;
    let li = 0;
    for (const g of n.groups) {
      for (const line of g.lines) {
        // 行盒基线沿用 mindmap 的口径：块顶 + padY + 行序*lineH + 该行字号*1.06
        const baseline = n.y + metrics.padY + li * n.lineH + g.fs * 1.06;
        out.push(`<text x="${tx}" y="${baseline.toFixed(1)}" font-size="${g.fs}" font-weight="${g.weight}" fill="${g.color}" text-anchor="start">${esc(line)}</text>`);
        li += 1;
      }
    }
  }

  out.push('</svg>');
  return { svg: out.join('\n'), width, height, nodes };
};

export default { buildTimelineSvg, layoutTimeline, estimateTextWidth, wrapLabel };
