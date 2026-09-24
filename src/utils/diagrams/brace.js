/**
 * 🧩 括号图（整体—部分）SVG 生成器 —— 纯函数，可独立单测
 * ============================================================
 * 用途：把一棵 `{ title, children }` 树渲染成**印刷友好**的矢量括号图：
 *   父节点在左（“整体”），其全部子节点在右（“部分”），父子之间用一个**方括号式花括号**收束。
 *
 * 🔴 为什么自己画、为什么印刷优先（2026-09-24 用户裁定：给学生看的成品资料要进 PDF/Word）：
 *   · PDF 通道 = puppeteer setContent + page.pdf → 内联 SVG 是矢量，缩放/打印都不糊；
 *   · Word 通道 = utils/docxBuilder.buildImageRun 只认光栅图（不支持 svg）→ 由调用方光栅化。
 *   两条通道都不新增依赖（公共能力一律取自 ./shared.js）。
 *
 * 印刷约定（写死在渲染里，脱离应用单独用也能正确出图）：
 *   · 白底、深灰字、无阴影/渐变/外链；每条主分支一个**低饱和**颜色；
 *   · 黑白打印颜色会消失 → 层级**同时**靠字重 + 缩进（列位）表达；字号不小于 11px；
 *   · 文字左对齐；图形宽度由**实测文字宽度**反推（w = textW + 2*padX），保证文字不越出框。
 *
 * 🔴 结构上刻意拆成两个导出（同 mindmap.js 口径）：
 *   layoutBrace()    —— 只算版式，返回已平铺、已归一化的节点 + 花括号几何，**可被单测直接断言**；
 *   buildBraceSvg()  —— 只把版式画成 SVG。
 *   版式质量靠硬指标守住（不重叠/不越界/父子同列分列/父子纵向居中），不靠肉眼看图。
 *
 * 版式要点（对应设计规格「1. 括号图」）：
 *   · 递归：先算每个节点自身文字框；子节点整体排在右侧，子节点之间纵向间距 gapY；
 *     n 的文字框纵向**居中于其子节点跨度**；叶子无花括号；
 *   · 横向：子节点列起点 = n 右边界 + gapX；**同层节点统一列位**（该层最大宽决定列宽），
 *     保证同层左边界对齐；由此可证：相邻两列严格不相交 → 父子必然不同列；
 *   · 花括号：竖直主笔 x=braceX 覆盖子节点跨度，上/下端各 6px 横笔指向右，中部一段 6px
 *     横笔指向 n；线宽 1.8px；颜色取 n 的分支色。braceX 取 n 右边界与子节点列左边界的中点
 *     （n 为该层最宽节点时，恰为两侧各 gapX/2，与规格一致）。
 * ============================================================
 */

import {
  DEFAULT_PALETTE, INK, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper,
} from './shared.js';

// 文本工具统一在 shared.js（导图族共用），这里再导出一次，保持图种模块对外 API 一致
export { estimateTextWidth, wrapLabel };

/** 花括号横笔长度（固定 6~8px，印刷清晰） */
const BRACE_TICK = 6;
/** 花括号线宽（比节点边框 1.3 略粗，视觉上收得住整棵子树） */
const BRACE_STROKE = 1.8;

/* ============================ ① 版式计算 ============================ */

/**
 * 只算版式，不出图。
 * @param {object|null} spec 根节点 `{ title, children }`（一棵树，任意深度）
 * @param {object} opts
 *   - fontSize / titleFontSize / maxLabelWidth / palette / measurer / labelTransform
 * @returns {{nodes:Array, width:number, height:number, metrics:object, braces:Array}}
 *   nodes 为**已平铺**节点（前序），坐标为最终像素值（已归一化到正数、已含外边距），
 *   每项至少 { id, title, x, y, w, h, lines }，另带 depth/isRoot/color/children；
 *   braces 为花括号几何（已含外边距），供出图与单测复用。
 */
export const layoutBrace = (spec, opts = {}) => {
  const {
    fontSize = 13,
    titleFontSize = 15,
    maxLabelWidth = 150,
    palette = DEFAULT_PALETTE,
    measurer,
    labelTransform,
  } = opts;

  const tf = typeof labelTransform === 'function' ? labelTransform : (s) => s;

  // —— 尺度常量：与 mindmap.js 同口径，保证导图族视觉一致 ——
  const padX = 11;
  const padY = 7;
  const gapX = Math.round(fontSize * 1.5);   // 列间距（父子之间的水平空隙）
  const gapY = Math.round(fontSize * 0.7);   // 兄弟节点纵向间距（规格指定）
  const margin = Math.round(fontSize * 1.2);

  const root0 = spec && typeof spec === 'object' ? spec : { title: '', children: [] };

  // ── 归一化：算每行文字与节点尺寸；分支色自上而下继承（每条主分支一个色）──
  let seq = 0;
  const prep = (raw, depth, color, isRoot) => {
    const fs = isRoot ? titleFontSize : fontSize;
    const title = String(raw && raw.title == null ? '' : raw.title);
    const lines = wrapLabel(tf(title), maxLabelWidth, fs, measurer);
    const textW = Math.max(...lines.map((l) => estimateTextWidth(l, fs, measurer)), 0);
    const lineH = Math.round(fs * 1.42);
    const node = {
      id: seq++,
      title,
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
      parent: null,
      x: 0,
      y: 0,
      children: [],
    };
    const kids = raw && Array.isArray(raw.children) ? raw.children : [];
    node.children = kids.map((c, i) => (
      // 根的一级子节点各自取一个调色板色（主分支）；更深层**整棵子树继承**该分支色。
      // 🔴 必须整棵继承：只给一级上色、深层又按层取色，会让同一条分支花花绿绿、语义错乱。
      prep(c, depth + 1, depth === 0 ? palette[i % palette.length] : color, false)
    ));
    return node;
  };
  const root = prep(root0, 0, palette[0], true);
  const bind = (n) => (n.children || []).forEach((c) => { c.parent = n; bind(c); });
  bind(root);

  // ── 纵向：tidy 布局。叶子按顺序堆叠；父节点居中于首末子节点跨度 ──
  let cursor = 0;
  const place = (node) => {
    const kids = node.children || [];
    if (!kids.length) {
      node.y = cursor;
      cursor += node.h + gapY;
      return;
    }
    const start = cursor;
    kids.forEach(place);
    const first = kids[0];
    const last = kids[kids.length - 1];
    const spanMid = (first.y + last.y + last.h) / 2;  // 子节点跨度中线
    node.y = spanMid - node.h / 2;
    // 父节点比整个子树跨度还高时：把子树整体下推，让父节点站稳在子树带内
    // （否则父框会向上漫出本子树带，压到上一层兄弟的带里去）
    if (node.y < start) {
      const push = start - node.y;
      const nudge = (n) => { n.y += push; (n.children || []).forEach(nudge); };
      kids.forEach(nudge);
      node.y = start;
    }
    if (node.y + node.h + gapY > cursor) cursor = node.y + node.h + gapY;
  };
  place(root);
  const contentH = Math.max(0, cursor - gapY);

  // ── 横向：按「每层最大节点宽」排柱 → 同层左边界天然对齐 ──
  // 🔴 列宽用该层最大宽（而不是每个节点各自宽度）：同层节点 x 必须相同，
  //    否则同级节点左右错落、视觉上不像同一层，也会让花括号落在不同 x 上。
  const depthMaxW = {};
  let maxDepth = 0;
  const scanW = (n) => {
    depthMaxW[n.depth] = Math.max(depthMaxW[n.depth] || 0, n.w);
    maxDepth = Math.max(maxDepth, n.depth);
    (n.children || []).forEach(scanW);
  };
  scanW(root);

  const colX = [0];
  for (let d = 1; d <= maxDepth; d++) {
    colX[d] = colX[d - 1] + (depthMaxW[d - 1] || 0) + gapX;
  }

  const dx = margin;
  const dy = margin;
  const nodes = [];
  const flat = (n) => {
    n.x = colX[n.depth] + dx;          // 同层同 x（列位统一）
    n.y = Math.round(n.y + dy);        // 末位取整，消除 tidy 的 .5 抖动
    nodes.push(n);
    (n.children || []).forEach(flat);
  };
  flat(root);

  const width = Math.round(colX[maxDepth] + (depthMaxW[maxDepth] || 0) + margin * 2);
  const height = Math.round(contentH + margin * 2);

  // ── 花括号几何：仅非叶节点；主笔覆盖子节点跨度，中部横笔指向父节点 ──
  const braces = [];
  const buildBraces = (n) => {
    const kids = n.children || [];
    if (kids.length) {
      const right = n.x + n.w;
      const childLeft = Math.min(...kids.map((k) => k.x));
      const top = Math.min(...kids.map((k) => k.y));
      const bottom = Math.max(...kids.map((k) => k.y + k.h));
      braces.push({
        parentId: n.id,
        x: Math.round(right + (childLeft - right) / 2),  // 父右边界与子列左边的中点
        top,
        bottom,
        mid: (top + bottom) / 2,
        color: n.color,
      });
    }
    kids.forEach(buildBraces);
  };
  buildBraces(root);

  return {
    nodes,
    width,
    height,
    braces,
    metrics: {
      padX, padY, gapX, gapY, margin, fontSize, titleFontSize,
      braceTick: BRACE_TICK, braceStroke: BRACE_STROKE, braceCount: braces.length,
    },
  };
};

/* ============================ ② 出图 ============================ */

/** 版式 → SVG 字符串（不含 DOCTYPE/<?xml>，可直接内联进 HTML / PDF） */
export const buildBraceSvg = (spec, opts = {}) => {
  const { nodes, width, height, braces } = layoutBrace(spec, opts);
  const out = [];
  out.push(svgHeader(width, height));
  out.push(svgPaper(width, height));

  // ① 先画花括号（压在节点下面：竖笔只在列间空隙里，绝不穿框）
  const T = BRACE_TICK;
  for (const b of braces) {
    // 方括号式：上端横笔 → 竖直主笔 → 下端横笔
    out.push(
      `<path d="M ${b.x + T} ${b.top} L ${b.x} ${b.top} L ${b.x} ${b.bottom} L ${b.x + T} ${b.bottom}" `
      + `fill="none" stroke="${b.color}" stroke-width="${BRACE_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
    // 中部横笔指向父节点（-6px）
    out.push(
      `<line x1="${b.x}" y1="${b.mid}" x2="${b.x - T}" y2="${b.mid}" `
      + `stroke="${b.color}" stroke-width="${BRACE_STROKE}" stroke-linecap="round"/>`,
    );
  }

  // ② 再画节点（白底 + 1.3px 同色边框 + 左对齐文字）
  for (const n of nodes) {
    out.push(
      `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" `
      + `fill="${PAPER}" stroke="${n.color}" stroke-width="1.3"/>`,
    );
    // 层级同时用字重强化（黑白打印时颜色差异会消失，字重不会）
    const weight = n.isRoot ? 600 : (n.depth === 1 ? 500 : 400);
    const tx = n.x + n.padX;
    const baseline0 = n.y + n.padY + n.fs * 1.06;
    n.lines.forEach((line, i) => {
      out.push(
        `<text x="${tx}" y="${(baseline0 + i * n.lineH).toFixed(1)}" font-size="${n.fs}" `
        + `font-weight="${weight}" fill="${INK}" text-anchor="start">${esc(line)}</text>`,
      );
    });
  }

  out.push('</svg>');
  return { svg: out.join('\n'), width, height, nodes };
};

export default { layoutBrace, buildBraceSvg, estimateTextWidth, wrapLabel };
