/**
 * 🔀 流程图 SVG 生成器 —— 纯函数，可独立单测
 * ============================================================
 * 用途：把 `{ steps: [{ text, kind?, branches? }] }` 渲染成**印刷友好**的矢量流程图（步骤 + 判定）。
 *
 * 为什么自己画 SVG：与 mindmap.js 同因 —— PDF 通道吃内联矢量 SVG，Word 通道由调用方光栅化。
 * 统一契约、印刷约定、共用工具见 `src/utils/diagrams/shared.js` 头部注释。
 *
 * 印刷约定（写死在渲染里，脱离应用单独拿来也能正确出图）：
 *   · 白底、深灰字无阴影无渐变；主轴每个步骤一个低饱和分支色做描边；
 *   · 层级/主次同时用**线宽 + 字重**表达（start/end 更重、decision 次之、process 常规），
 *     黑白打印时颜色差异会消失，靠粗细与字重兜底；
 *   · 字号 ≥ 11px；文字一律居中，宽度按**实测文字宽度**反推，保证不越出图形。
 *
 * 🔴 结构上刻意拆成两个导出（与 mindmap.js 同口径，版式质量由单测硬指标守住）：
 *    layoutFlow()   —— 只算版式，返回每个节点的 x/y/w/h + 连线/箭头几何，**可被单测直接断言**；
 *    buildFlowSvg() —— 只把版式画成 SVG。
 * ============================================================
 */

import {
  DEFAULT_PALETTE, INK, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper,
} from './shared.js';

// 文本工具与配色统一在 shared.js（导图族共用），这里再导出一次，保持本模块对外 API 与 mindmap 一致
export { estimateTextWidth, wrapLabel };

const DEFAULT_KIND = 'process';
const KINDS = ['start', 'process', 'decision', 'end'];
const normKind = (k) => (KINDS.includes(k) ? k : DEFAULT_KIND);
/** 形状：start/end = 圆角矩形 rx14；process = 矩形 rx6；decision = 六边形（左右成尖） */
const shapeOf = (kind) => (kind === 'start' || kind === 'end' ? 'round' : (kind === 'decision' ? 'hex' : 'rect'));
const strokeOf = (kind) => (kind === 'start' || kind === 'end' ? 1.6 : (kind === 'decision' ? 1.4 : 1.3));
const weightOf = (kind) => (kind === 'start' || kind === 'end' ? 600 : (kind === 'decision' ? 500 : 400));

/* ============================ ① 版式计算 ============================ */

/**
 * 只算版式，不出图。
 * @param {object} spec `{ steps: [{ text, kind?, branches?: [{ label, steps }] }] }`
 * @param {object} opts
 *   - fontSize / maxLabelWidth / palette / measurer / labelTransform（通用）
 *   - minBoxWidth 主轴框最小宽度，默认 120
 * @returns {{nodes:Array, width:number, height:number, metrics:object, connectors:Array, arrows:Array, labels:Array}}
 *   nodes 为**已平铺**的节点（含 x/y/w/h/lines/kind/depth/role），坐标为已归一化到正数、含外边距的最终像素值。
 */
export const layoutFlow = (spec, opts = {}) => {
  const {
    fontSize = 13,
    maxLabelWidth = 150,
    palette = DEFAULT_PALETTE,
    measurer,
    labelTransform,
    minBoxWidth = 120,
  } = opts;

  const tf = typeof labelTransform === 'function' ? labelTransform : (s) => s;

  // ── 版式常量（打印尺寸：lineH=18 保证 13px 中文行不挤）──
  const padX = 13;                 // 文字与框左右内边距
  const padY = 8;                  // 文字与框上下内边距
  const lineH = Math.round(fontSize * 1.42);
  const stepGap = 22;              // 主轴相邻步骤的**间隙**（无分支时箭头正好 22px 填满）
  const branchStepGap = 16;        // 同一分支内相邻步骤的间距
  const branchGroupGap = 24;       // 同一 decision 的两个分支组之间的间距
  const margin = 20;               // 画布外边距
  const labelFs = 11;              // 分支标签字号（≥11px 的印刷下限）
  const labelPadX = 4;
  const labelH = Math.round(labelFs * 1.45);

  const notchOf = (kind, h) => (kind === 'decision' ? Math.min(h / 2, 14) : 0);

  const rawSteps = Array.isArray(spec && spec.steps) ? spec.steps : [];

  // ── 归一化：把一步变成节点（算折行、文字宽、框尺寸）──
  let seq = 0;
  const makeStep = (raw, depth, color) => {
    const kind = normKind(raw && raw.kind);
    const title = String(raw && raw.text == null ? '' : raw.text);
    const lines = wrapLabel(tf(title), maxLabelWidth, fontSize, measurer);
    const textW = lines.reduce((m, l) => Math.max(m, estimateTextWidth(l, fontSize, measurer)), 0);
    const h = Math.round(lines.length * lineH + padY * 2);
    const notch = notchOf(kind, h);
    return {
      id: seq++,
      role: 'step',
      kind,
      shape: shapeOf(kind),
      title,
      lines,
      fs: fontSize,
      lineH,
      padX,
      padY,
      textW,
      // 🔴 六边形的左右是尖的，文字区被两个尖角挤掉 2*notch，故所需宽度要额外补上，
      //    否则文字会压到斜边上（实测会越出图形）。
      w: Math.round(textW + padX * 2 + notch * 2),
      h,
      notch,
      color,
      depth,
      x: 0,
      y: 0,
      cy: 0,
      branchesRaw: kind === 'decision' && Array.isArray(raw && raw.branches)
        ? raw.branches.slice(0, 2)   // v1：分支上限 2 个
        : [],
    };
  };

  const mainSteps = rawSteps.map((s, i) => makeStep(s, 0, palette[i % palette.length] || palette[0]));

  // 主轴所有框同宽（六边形已含尖角余量）
  const mainBoxW = Math.max(minBoxWidth, ...mainSteps.map((s) => s.w), 0);
  mainSteps.forEach((s) => { s.w = mainBoxW; });

  // ── 分支预计算：算各自框宽/高、标签宽、纵向占位（band）──
  //    分支只挂在 decision 上，且分支内步骤不再递归分支（v1 上限 1 层）。
  const decisions = [];
  let maxLabelW = 0;
  for (const st of mainSteps) {
    if (!st.branchesRaw.length) continue;
    const brs = [];
    st.branchesRaw.forEach((rawBr, bi) => {
      const rawNodes = Array.isArray(rawBr && rawBr.steps) ? rawBr.steps : [];
      if (!rawNodes.length) return;
      const labelText = String(rawBr && rawBr.label == null ? '' : rawBr.label);
      const labelLines = wrapLabel(tf(labelText), maxLabelWidth, labelFs, measurer, 1); // 标签固定单行
      const labelTextW = labelLines.reduce((m, l) => Math.max(m, estimateTextWidth(l, labelFs, measurer)), 0);
      const labelW = Math.round(labelTextW + labelPadX * 2);
      const nodes = rawNodes.map((rawStep) => {
        const n = makeStep(rawStep, 1, st.color);
        // 分支框宽按自身文字（decision 型仍补尖角余量）
        n.w = Math.round(n.textW + padX * 2 + (n.kind === 'decision' ? n.notch * 2 : 0));
        return n;
      });
      const contentH = nodes.reduce((sum, n) => sum + n.h, 0) + branchStepGap * (nodes.length - 1);
      maxLabelW = Math.max(maxLabelW, labelW);
      brs.push({ key: `${st.id}-${bi}`, index: bi, labelText, labelLines, labelW, nodes, contentH });
    });
    if (!brs.length) continue;

    const totalH = brs.reduce((sum, b) => sum + b.contentH, 0) + branchGroupGap * (brs.length - 1);
    st.branchTotalH = totalH;
    // 纵向锚定：单分支 → **首框中心**压在 decision 中心（随后向下排）；
    //            多分支 → 以 decision 中心为锚，整组上下来回排开（对称）。
    if (brs.length === 1) {
      const firstH = brs[0].nodes[0].h;
      st.branchAbove = Math.max(st.h / 2, firstH / 2);
      st.branchBelow = Math.max(st.h / 2, totalH - firstH / 2);
    } else {
      st.branchAbove = Math.max(st.h / 2, totalH / 2);
      st.branchBelow = Math.max(st.h / 2, totalH / 2);
    }
    decisions.push({ step: st, branches: brs, totalH });
  }

  // ── 纵向排布：每个主轴步骤占一条"band"，band 高度 = max(自身框高, 分支组纵向占位)。
  //    🔴 用 band 而不是固定 22px 间距：相邻 decision 的分支组都长在主轴右侧同一列，
  //       若主轴间距恒为 22，两个 decision 的分支组会在纵向撞到一起（实测会重叠）。
  //       band 让每条步骤"独占"一条互不相交的纵向带 → 分支组永不跨决策重叠。
  let cursor = 0;
  for (const st of mainSteps) {
    const above = st.branchAbove || st.h / 2;
    const below = st.branchBelow || st.h / 2;
    st.cy = cursor + above;
    st.y = st.cy - st.h / 2;
    cursor += above + below + stepGap;
  }
  const axisContentBottom = mainSteps.length ? cursor - stepGap : 0;

  // ── 横向排布：主轴在左（框同宽、共中线 axisX），分支列在主轴右侧 ──
  const connectorGap = Math.max(52, Math.round(maxLabelW) + 20); // 留出标签与竖直母线的位置
  const mainRightLocal = mainBoxW;          // decision 的右尖点 = 主轴右边界
  const elbowXLocal = mainRightLocal + 16;  // 竖直母线（拐点）x
  const branchXLocal = mainRightLocal + connectorGap; // 分支列左边界
  const axisXLocal = mainBoxW / 2;

  const connectors = [];
  const labels = [];
  for (const d of decisions) {
    const st = d.step;
    const cy = st.cy;
    const groupTop = d.branches.length === 1
      ? cy - d.branches[0].nodes[0].h / 2          // 单分支：首框中心 = decision 中心
      : cy - d.totalH / 2;                          // 多分支：整组对称居中
    let y = groupTop;
    for (const b of d.branches) {
      let yy = y;
      for (const n of b.nodes) {
        n.x = branchXLocal;   // 分支列左边界对齐
        n.y = yy;
        yy += n.h + branchStepGap;
      }
      const firstCy = b.nodes[0].y + b.nodes[0].h / 2;

      // 连线：右尖点 →（水平）→ 竖直母线 →（水平）→ 分支首框左侧
      const segments = [{ x1: mainRightLocal, y1: cy, x2: elbowXLocal, y2: cy }];
      if (Math.abs(firstCy - cy) > 0.01) {
        segments.push({ x1: elbowXLocal, y1: cy, x2: elbowXLocal, y2: firstCy });
      }
      segments.push({ x1: elbowXLocal, y1: firstCy, x2: branchXLocal, y2: firstCy });
      connectors.push({ key: b.key, color: st.color, segments });

      // 分支标签：小字 11px，压在该段连线中点，白底挡住线
      const lcx = Math.round((elbowXLocal + branchXLocal) / 2);
      labels.push({
        id: seq++,
        role: 'label',
        title: b.labelText,
        lines: b.labelLines,
        fs: labelFs,
        lineH: Math.round(labelFs * 1.42),
        padX: labelPadX,
        padY: 0,
        textW: Math.round(b.labelW - labelPadX * 2),
        w: b.labelW,
        h: labelH,
        color: st.color,
        depth: 1,
        x: lcx - Math.round(b.labelW / 2),
        y: Math.round(firstCy - labelH / 2),
      });

      y += b.contentH + branchGroupGap;
    }
  }

  // ── 归一到正坐标系（含外边距）──
  let minX = 0;
  let maxX = mainBoxW;
  let minY = 0;
  let maxY = axisContentBottom;
  const consider = (n) => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x + n.w);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + n.h);
  };
  mainSteps.forEach(consider);
  decisions.forEach((d) => d.branches.forEach((b) => b.nodes.forEach(consider)));
  labels.forEach(consider);

  const offX = margin - minX;
  const offY = margin - minY;

  const nodes = [];
  const pushNode = (n) => {
    n.x = Math.round(n.x + offX);
    n.y = Math.round(n.y + offY);
    nodes.push(n);
  };
  mainSteps.forEach(pushNode);
  decisions.forEach((d) => d.branches.forEach((b) => b.nodes.forEach(pushNode)));
  labels.forEach(pushNode);

  // 连线几何随整体平移，并拼成 path d
  for (const c of connectors) {
    for (const s of c.segments) {
      s.x1 = Math.round(s.x1 + offX); s.x2 = Math.round(s.x2 + offX);
      s.y1 = Math.round(s.y1 + offY); s.y2 = Math.round(s.y2 + offY);
    }
    let d = `M ${c.segments[0].x1} ${c.segments[0].y1}`;
    for (const s of c.segments) d += ` L ${s.x2} ${s.y2}`;
    c.d = d;
  }

  // 主轴箭头：相邻步骤留白段的中线，向下
  const axisXAbs = Math.round(axisXLocal + offX);
  const arrows = [];
  for (let i = 0; i + 1 < mainSteps.length; i++) {
    arrows.push({ x: axisXAbs, y1: mainSteps[i].y + mainSteps[i].h, y2: mainSteps[i + 1].y });
  }

  const width = Math.max(1, Math.round(maxX - minX + margin * 2));
  const height = Math.max(1, Math.round(maxY - minY + margin * 2));

  const metrics = {
    fontSize, lineH, padX, padY, stepGap, branchStepGap, branchGroupGap, margin,
    labelFontSize: labelFs, labelHeight: labelH,
    minBoxWidth, mainBoxWidth: mainBoxW, connectorGap,
    axisX: axisXAbs,
    branchX: Math.round(branchXLocal + offX),
    elbowX: Math.round(elbowXLocal + offX),
    stepCount: mainSteps.length,
    decisionCount: decisions.length,
  };

  return { nodes, width, height, metrics, connectors, arrows, labels };
};

/* ============================ ② 出图 ============================ */

/** 六边形顶点：上下两条直边 + 左右各一个尖（左右各内收 notch） */
const hexPoints = (n) => {
  const t = n.notch || Math.min(n.h / 2, 14);
  const { x, y, w, h } = n;
  return [
    [x + t, y], [x + w - t, y], [x + w, y + h / 2],
    [x + w - t, y + h], [x + t, y + h], [x, y + h / 2],
  ].map(([px, py]) => `${px},${py}`).join(' ');
};

/** 版式 → SVG 字符串（不含 DOCTYPE，可直接内联进 HTML / PDF） */
export const buildFlowSvg = (spec, opts = {}) => {
  const { nodes, width, height, connectors, arrows, labels } = layoutFlow(spec, opts);
  const out = [];
  out.push(svgHeader(width, height));
  out.push(svgPaper(width, height));

  // ① 连线（压在框下面）
  for (const c of connectors) {
    out.push(`<path d="${c.d}" fill="none" stroke="${c.color || INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`);
  }

  // ② 主轴箭头：竖线 + 实心三角，只在相邻框之间的空隙里走
  const headH = 8;
  const headW = 10;
  for (const a of arrows) {
    const yEnd = a.y2;
    out.push(`<line x1="${a.x}" y1="${a.y1}" x2="${a.x}" y2="${yEnd - headH + 1}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`);
    out.push(`<polygon points="${a.x - headW / 2},${yEnd - headH} ${a.x + headW / 2},${yEnd - headH} ${a.x},${yEnd}" fill="${INK}"/>`);
  }

  // ③ 步骤框 + 居中文字
  for (const n of nodes) {
    if (n.role === 'label') continue;
    const sw = strokeOf(n.kind);
    const weight = weightOf(n.kind);
    if (n.shape === 'hex') {
      out.push(`<polygon points="${hexPoints(n)}" fill="${PAPER}" stroke="${n.color}" stroke-width="${sw}"/>`);
    } else {
      const rx = n.shape === 'round' ? 14 : 6;
      out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" fill="${PAPER}" stroke="${n.color}" stroke-width="${sw}"/>`);
    }
    const cx = n.x + n.w / 2;
    const blockTop = n.y + (n.h - n.lines.length * n.lineH) / 2;
    n.lines.forEach((line, i) => {
      const baseline = blockTop + i * n.lineH + n.lineH * 0.74;
      out.push(`<text x="${cx.toFixed(1)}" y="${baseline.toFixed(1)}" font-size="${n.fs}" font-weight="${weight}" fill="${INK}" text-anchor="middle">${esc(line)}</text>`);
    });
  }

  // ④ 分支标签：白底块压住连线 + 小字
  for (const l of labels) {
    out.push(`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="${PAPER}"/>`);
    const cx = l.x + l.w / 2;
    const blockTop = l.y + (l.h - l.lines.length * l.lineH) / 2;
    l.lines.forEach((line, i) => {
      const baseline = blockTop + i * l.lineH + l.lineH * 0.74;
      out.push(`<text x="${cx.toFixed(1)}" y="${baseline.toFixed(1)}" font-size="${l.fs}" font-weight="500" fill="${INK}" text-anchor="middle">${esc(line)}</text>`);
    });
  }

  out.push('</svg>');
  return { svg: out.join('\n'), width, height, nodes };
};

export default { layoutFlow, buildFlowSvg, estimateTextWidth, wrapLabel };
