/**
 * 🐟 鱼骨图（石川图）SVG 生成器 —— 纯函数，可独立单测
 * ============================================================
 * 用途：把 `{ effect, categories: [{ name, causes[] }] }` 渲染成**印刷友好**的因果鱼骨图。
 *   · PDF 通道 = puppeteer setContent + page.pdf → 内联 SVG 是矢量，缩放/打印都不糊；
 *   · Word 通道 = utils/docxBuilder.buildImageRun 只认光栅图 → 由调用方把 SVG 光栅化成 PNG。
 * 契约 / 印刷约定 / 共用能力见 `./shared.js` 头部；风格与命名照抄 `./mindmap.js`、`./timeline.js`。
 *
 * ── 版式要点（规格 §4 鱼骨图）────────────────────────────────────────────────
 *   · 主脊：水平线 `y = spineY`，末端实心三角箭头，箭头右侧是深底白字的 effect 框；
 *   · 类别上下交替：锚点 `x_i = margin + spineLen*(i+0.7)/(n+1)`，偶数在上、奇数在下；
 *   · 骨：锚点 → `(+dx, ∓dy) = (+96, ∓62)`（约 33°），1.6px、取类别色；
 *   · 类别名框贴骨末端外移 8px；因沿骨等分内插 `t=(j+1)/(m+1)`，向骨的外侧偏移，
 *     用小框（11px、淡边框）+ 0.9px 短竖线连回骨上对应点。
 *
 * 🔴 四处刻意的实现决定（都为"所有框两两不重叠"这条硬指标服务，改前先读）：
 *   1) 因框偏移**朝该类别自己那一侧**（上侧类别向上、下侧类别向下）。规格写 `dy=-14`
 *      （以上侧为例）并注明"框在骨上方、避免压住骨"。若上下两类的因框都一律向上偏，
 *      下侧类别在靠近主脊处的因框会**越过主脊**、撞进上侧类别的地盘 —— 一侧一类天然分离，
 *      才让"所有框两两不重叠"成立。偏移量取"框的近骨边离骨点 14px"，于是那根短竖线
 *      恰好 14px，且框永不压住骨。
 *   2) 同一个类别的因框彼此重叠时，**沿骨向外**再错开 12px（规格给了这个兜底，最多 20 次）。
 *      向外错开只会远离已放好的（更靠内的）因框，是单调收敛的。
 *   3) 类别名框与末尾因框可能只差 1~2px 就贴上：此时把**名框**沿骨向外推 12px 步进直到清空
 *      （最多 20 步）。名框是本类最外侧的元素，外推不引入新的子问题；反过来，规格里
 *      "因框互不重叠"的兜底解决不了因框与名框的关系。
 *   4) 同一侧、相隔一个类别（i 与 i+2）的两类共用同一条横向带，靠"类别间距 S"拉开。
 *      S 由一条**确定性增长循环**定：从 120px 起、每次 ×1.18，直到（取整后的）全图无一
 *      重叠（最多 40 次）。跨侧（上/下）的框天然分居主脊两侧、永不重叠，不参与这一步。
 * ============================================================
 */

import {
  DEFAULT_PALETTE, INK, HEAD_FILL, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper, boxesOverlap, tint,
} from './shared.js';

// 文本工具统一在 shared.js（导图族共用），这里再导出一次，与 mindmap.js / timeline.js 保持同形
export { estimateTextWidth, wrapLabel };

/* ============================ 常量：版式参数（规格 §4 定死） ============================ */

const DX = 96;                              // 骨在 x 上的投影（px）
const DY = 62;                              // 骨在 y 上的投影（px）—— 约 33°
const BONE_LEN = Math.sqrt(DX * DX + DY * DY);
const BONE_W = 1.6;                         // 骨线宽

const NAME_OUT = 8;                         // 类别名框中心在骨末端"再外移"的距离
const NAME_BOX_R = 5;
const NAME_BOX_STROKE_W = 1.3;
const NAME_WEIGHT = 600;
const PAD_X_NAME = 9;
const PAD_Y_NAME = 5;

const CAUSE_BOX_R = 4;
const CAUSE_BOX_STROKE_W = 1;
const CAUSE_LEADER_W = 0.9;                 // 因框连回骨的短竖线
const CAUSE_GAP = 14;                       // 因框近骨边离骨点的净空 = 短竖线长度
const CAUSE_SHIFT = 12;                     // 冲突时沿骨额外错开的步长
const CAUSE_SHIFT_MAX = 20;                 // 最多错开步数（规格钉死）
const CAUSE_MAX_LABEL_WIDTH = 110;          // 因框折行宽度上限（规格钉死）
const CAUSE_WEIGHT = 400;
const PAD_X_CAUSE = 7;
const PAD_Y_CAUSE = 4;

const SPINE_W = 2;
const ARROW_LEN = 16;
const ARROW_HALF = 7;
const ARROW_GAP = 10;                       // 箭头尖端到 effect 框的间距

const EFFECT_R = 6;
const EFFECT_WEIGHT = 600;
const PAD_X_EFFECT = 12;
const PAD_Y_EFFECT = 7;

const HEAD_FRAC = 0.7;                      // 锚点公式里的 (i + 0.7)
const BASE_SPACING = 120;                   // 类别间距 S 的初值
const SPACING_GROWTH = 1.18;                // 不满足"不重叠"时 S 的增长因子
const SPACING_MAX_ITER = 40;

const asText = (v) => (v == null ? '' : String(v));

/** 折行行数预算：按内容量给够，避免 `…` 掉在中段（口径同 timeline.js） */
const lineBudget = (text, fs, maxW, measurer) =>
  Math.max(3, Math.ceil(estimateTextWidth(text, fs, measurer) / Math.max(1, maxW)) + 2);

const wrap = (src, fs, maxW, measurer) => wrapLabel(src, maxW, fs, measurer, lineBudget(src, fs, maxW, measurer));

const maxLineW = (lines, fs, measurer) =>
  lines.reduce((m, l) => Math.max(m, estimateTextWidth(l, fs, measurer)), 0);

/** 因条目：既支持字符串，也兼容 `{ text }` / `{ title }` */
const pickCause = (c) => {
  if (typeof c === 'string') return c;
  if (c && c.text != null) return asText(c.text);
  if (c && c.title != null) return asText(c.title);
  return asText(c);
};

/** 全图任一两个节点框是否重叠（用 shared 的统一口径） */
const hasOverlap = (nodes) => {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (boxesOverlap(nodes[i], nodes[j])) return true;
    }
  }
  return false;
};

/* ============================ ① 版式计算 ============================ */

/**
 * 只算版式，不出图。
 * @param {object} spec `{ effect: string, categories: [{ name, causes: string[] }] }`；
 *   category 也可直接给字符串（当作 name、无 causes），cause 也可给 `{ text }`。
 * @param {object} opts
 *   - fontSize      正文/因字号（默认 13；因字号取 `max(11, round(fontSize)-2)` → 默认 11，见规格 §4）
 *   - titleFontSize 类别名 / effect 字号（默认 15）
 *   - maxLabelWidth 类别名与 effect 的折行宽度上限（默认 150；因框固定不超 110）
 *   - palette / measurer / labelTransform（公式线性化钩子，见 mindmap.js 注释）
 * @returns {{nodes:Array, width:number, height:number, metrics:object}}
 *   nodes 已平铺，坐标为**最终像素值**（含外边距、全为正、全为整数）；每个节点至少含
 *   `{ id, title, x, y, w, h, lines }`，另带 `kind`：
 *   `'effect' | 'category' | 'cause'`，以及各自的几何字段（anchorX/tipX/boneX/connectorTo…）。
 */
export const layoutFishbone = (spec, opts = {}) => {
  const {
    fontSize = 13,
    titleFontSize = 15,
    maxLabelWidth = 150,
    palette = DEFAULT_PALETTE,
    measurer,
    labelTransform,
  } = opts;

  const tf = typeof labelTransform === 'function' ? labelTransform : asText;
  const rawCats = Array.isArray(spec && spec.categories) ? spec.categories.filter((c) => c != null) : [];

  // 字号：类别名/effect 用 titleFontSize；因用略小于正文的字号（默认 13 → 11）
  const nameFs = Math.max(11, Math.round(titleFontSize));
  const causeFs = Math.max(11, Math.round(fontSize) - 2);
  const nameLineH = Math.round(nameFs * 1.42);
  const causeLineH = Math.round(causeFs * 1.42);
  const causeMaxW = Math.min(CAUSE_MAX_LABEL_WIDTH, Math.max(40, maxLabelWidth));
  const margin = Math.max(12, Math.round(nameFs * 1.2));

  /* ── effect 框 ── */
  const effLines = wrap(tf(asText(spec && spec.effect)), nameFs, maxLabelWidth, measurer);
  const effW = Math.round(maxLineW(effLines, nameFs, measurer) + PAD_X_EFFECT * 2);
  const effH = Math.round(effLines.length * nameLineH + PAD_Y_EFFECT * 2);

  /* ── 逐类别算"相对锚点"的局部版式（与类别间距 S 无关，故只算一次）── */
  const local = rawCats.map((catRaw, index) => {
    const cat = typeof catRaw === 'string' ? { name: catRaw, causes: [] } : catRaw;
    const nameSrc = tf(asText(cat.name));
    const sign = index % 2 === 0 ? -1 : 1;                 // 偶数在上（y 负）、奇数在下
    const color = palette[index % palette.length] || DEFAULT_PALETTE[0];
    const ux = DX / BONE_LEN;
    const uy = (sign * DY) / BONE_LEN;                     // 骨的单位方向（含上下侧号）

    // 类别名框：中心 = 骨末端再沿骨外移 8px
    const nameLines = wrap(nameSrc, nameFs, maxLabelWidth, measurer);
    const nameW = Math.round(maxLineW(nameLines, nameFs, measurer) + PAD_X_NAME * 2);
    const nameH = Math.round(nameLines.length * nameLineH + PAD_Y_NAME * 2);
    const nameCx0 = DX + NAME_OUT * ux;
    const nameCy0 = sign * DY + NAME_OUT * uy;

    // 因：沿骨等分内插 + 冲突时沿骨向外错开
    const causeSrcs = (Array.isArray(cat.causes) ? cat.causes : []).filter((c) => c != null).map((c) => tf(pickCause(c)));
    const m = causeSrcs.length;
    const causeLocals = [];
    const placed = [];
    for (let j = 0; j < m; j++) {
      const src = causeSrcs[j];
      const lines = wrap(src, causeFs, causeMaxW, measurer);
      const w = Math.round(maxLineW(lines, causeFs, measurer) + PAD_X_CAUSE * 2);
      const h = Math.round(lines.length * causeLineH + PAD_Y_CAUSE * 2);
      const t0 = (j + 1) / (m + 1);
      const baseX = t0 * DX;
      const baseY = t0 * sign * DY;
      // 框近骨边离骨点 CAUSE_GAP，故框中心在骨点外 CAUSE_GAP + h/2
      const boxAt = (bx, by) => ({ x: bx - w / 2, y: by + sign * (CAUSE_GAP + h / 2) - h / 2, w, h });

      let picked = null;
      for (let k = 0; k <= CAUSE_SHIFT_MAX; k++) {
        const bx = baseX + k * CAUSE_SHIFT * ux;
        const by = baseY + k * CAUSE_SHIFT * uy;
        const box = boxAt(bx, by);
        if (!placed.some((p) => boxesOverlap(p, box))) { picked = { bx, by, box, k }; break; }
      }
      if (!picked) {                                       // 兜底：用最后一次错开的位置
        const k = CAUSE_SHIFT_MAX;
        const bx = baseX + k * CAUSE_SHIFT * ux;
        const by = baseY + k * CAUSE_SHIFT * uy;
        picked = { bx, by, box: boxAt(bx, by), k };
      }
      placed.push(picked.box);
      causeLocals.push({
        j, src, lines, w, h, baseX, baseY,
        boneX: picked.bx, boneY: picked.by, box: picked.box, shiftSteps: picked.k,
      });
    }

    // 类别名框：若与末尾因框贴太紧，沿骨向外推 12px 步进直到清空
    const nameBoxAt = (cx, cy) => ({ x: cx - nameW / 2, y: cy - nameH / 2, w: nameW, h: nameH });
    let nameShift = 0;
    let nameBox = nameBoxAt(nameCx0, nameCy0);
    for (let k = 1; k <= CAUSE_SHIFT_MAX; k++) {
      if (!causeLocals.some((c) => boxesOverlap(c.box, nameBox))) break;
      nameShift = k;
      nameBox = nameBoxAt(nameCx0 + k * CAUSE_SHIFT * ux, nameCy0 + k * CAUSE_SHIFT * uy);
    }

    return { index, sign, color, nameSrc, nameLines, nameW, nameH, nameBox, nameShift, causeLocals };
  });

  /* ── 给定类别间距 S，装配整张图（已取整、已归一化）── */
  const assemble = (S) => {
    const count = local.length;
    const spineRightRaw = S * (count + 1);
    const raw = [];

    raw.push({
      kind: 'effect', title: tf(asText(spec && spec.effect)), lines: effLines,
      x: spineRightRaw + ARROW_GAP, y: -effH / 2, w: effW, h: effH,
      fs: nameFs, lineH: nameLineH, padX: PAD_X_EFFECT, padY: PAD_Y_EFFECT,
      fill: PAPER, weight: EFFECT_WEIGHT, boxFill: HEAD_FILL,
    });

    for (const c of local) {
      const anchorX = HEAD_FRAC * S + c.index * S;
      raw.push({
        kind: 'category', title: c.nameSrc, lines: c.nameLines,
        x: c.nameBox.x + anchorX, y: c.nameBox.y, w: c.nameW, h: c.nameH,
        fs: nameFs, lineH: nameLineH, padX: PAD_X_NAME, padY: PAD_Y_NAME,
        fill: INK, weight: NAME_WEIGHT, color: c.color,
        side: c.sign < 0 ? 'up' : 'down', categoryIndex: c.index,
        anchorX, anchorY: 0, tipX: anchorX + DX, tipY: c.sign * DY, nameShift: c.nameShift,
      });
      for (const cl of c.causeLocals) {
        raw.push({
          kind: 'cause', title: cl.src, lines: cl.lines,
          x: cl.box.x + anchorX, y: cl.box.y, w: cl.w, h: cl.h,
          fs: causeFs, lineH: causeLineH, padX: PAD_X_CAUSE, padY: PAD_Y_CAUSE,
          fill: INK, weight: CAUSE_WEIGHT, color: c.color,
          side: c.sign < 0 ? 'up' : 'down', categoryIndex: c.index, causeIndex: cl.j,
          anchorX, anchorY: 0,
          causeBaseX: anchorX + cl.baseX, causeBaseY: cl.baseY,
          boneX: anchorX + cl.boneX, boneY: cl.boneY,
          connectorTo: { x: anchorX + cl.boneX, y: cl.boneY + c.sign * CAUSE_GAP },
          shiftSteps: cl.shiftSteps,
        });
      }
    }

    // 归一到正坐标系（把主脊与箭头也算进去）
    const xs = [0, spineRightRaw];
    const ys = [0];
    for (const n of raw) { xs.push(n.x, n.x + n.w); ys.push(n.y, n.y + n.h); }
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const sx = margin - minX;
    const sy = margin - minY;

    const shiftNode = (n, i) => {
      const o = {
        ...n, id: i,
        x: Math.round(n.x + sx), y: Math.round(n.y + sy),
        w: Math.round(n.w), h: Math.round(n.h),
      };
      // 可选坐标字段：存在才平移；anchorX 类别名/因都有，tipX 只有类别名有，boneX 只有因有
      if (n.anchorX !== undefined) { o.anchorX = Math.round(n.anchorX + sx); o.anchorY = Math.round(n.anchorY + sy); }
      if (n.tipX !== undefined) { o.tipX = Math.round(n.tipX + sx); o.tipY = Math.round(n.tipY + sy); }
      if (n.boneX !== undefined) {
        o.boneX = Math.round(n.boneX + sx); o.boneY = Math.round(n.boneY + sy);
        o.causeBaseX = Math.round(n.causeBaseX + sx); o.causeBaseY = Math.round(n.causeBaseY + sy);
      }
      if (n.connectorTo) o.connectorTo = { x: Math.round(n.connectorTo.x + sx), y: Math.round(n.connectorTo.y + sy) };
      return o;
    };
    const nodes = raw.map(shiftNode);

    // 二次校正：把左上角顶到 margin（吃掉取整误差），并据此定画布
    const minLeft = Math.min(...nodes.map((n) => n.x), Math.round(0 + sx));
    const minTop = Math.min(...nodes.map((n) => n.y), Math.round(0 + sy));
    const padL = margin - Math.floor(minLeft);
    const padT = margin - Math.floor(minTop);
    if (padL !== 0 || padT !== 0) {
      for (const n of nodes) {
        n.x += padL; n.y += padT;
        if (n.anchorX !== undefined) { n.anchorX += padL; n.anchorY += padT; }
        if (n.tipX !== undefined) { n.tipX += padL; n.tipY += padT; }
        if (n.boneX !== undefined) { n.boneX += padL; n.boneY += padT; n.causeBaseX += padL; n.causeBaseY += padT; }
        if (n.connectorTo) n.connectorTo = { x: n.connectorTo.x + padL, y: n.connectorTo.y + padT };
      }
    }

    const spineStartX = Math.round(0 + sx) + padL;
    const spineRightX = Math.round(spineRightRaw + sx) + padL;
    const spineY = Math.round(0 + sy) + padT;

    let realRight = spineRightX;
    let realBottom = spineY;
    for (const n of nodes) {
      realRight = Math.max(realRight, n.x + n.w);
      realBottom = Math.max(realBottom, n.y + n.h);
    }

    return {
      nodes,
      width: realRight + margin,
      height: realBottom + margin,
      spineStartX, spineRightX, spineY, spacing: S,
    };
  };

  /* ── 确定性增长循环：直到取整后的全图两两不重叠 ── */
  let result = null;
  let S = BASE_SPACING;
  for (let iter = 0; iter < SPACING_MAX_ITER; iter++) {
    const cand = assemble(S);
    if (!hasOverlap(cand.nodes)) { result = cand; break; }
    S = S * SPACING_GROWTH;
  }
  if (!result) result = assemble(S);

  const anchors = result.nodes
    .filter((n) => n.kind === 'category')
    .sort((a, b) => a.categoryIndex - b.categoryIndex)
    .map((n) => n.anchorX);

  return {
    nodes: result.nodes,
    width: result.width,
    height: result.height,
    metrics: {
      margin,
      fontSize: causeFs, causeFontSize: causeFs, nameFontSize: nameFs, titleFontSize: Math.round(titleFontSize),
      lineH: causeLineH, causeLineH, nameLineH,
      spacing: result.spacing, spineLen: result.spacing * (local.length + 1),
      spineY: result.spineY, spineStartX: result.spineStartX, spineRightX: result.spineRightX,
      dx: DX, dy: DY, boneLength: BONE_LEN,
      arrowLen: ARROW_LEN, arrowHalf: ARROW_HALF, arrowGap: ARROW_GAP,
      causeGap: CAUSE_GAP, causeShift: CAUSE_SHIFT, causeShiftMax: CAUSE_SHIFT_MAX,
      categoryCount: local.length,
      causeCount: result.nodes.filter((n) => n.kind === 'cause').length,
      anchors,
    },
  };
};

/* ============================ ② 出图 ============================ */

/** 版式 → SVG 字符串（不含 DOCTYPE/<?xml>，可直接内联进 HTML / PDF） */
export const buildFishboneSvg = (spec, opts = {}) => {
  const { nodes, width, height, metrics } = layoutFishbone(spec, opts);
  const out = [];
  out.push(svgHeader(width, height));
  out.push(svgPaper(width, height));

  const { spineY, spineStartX, spineRightX } = metrics;

  // ① 主脊 + 实心三角箭头
  const spineLineEnd = spineRightX - ARROW_LEN;
  if (spineLineEnd > spineStartX) {
    out.push(`<line x1="${spineStartX}" y1="${spineY}" x2="${spineLineEnd}" y2="${spineY}" stroke="${INK}" stroke-width="${SPINE_W}" stroke-linecap="round"/>`);
  }
  out.push(`<polygon points="${spineLineEnd},${spineY - ARROW_HALF} ${spineLineEnd},${spineY + ARROW_HALF} ${spineRightX},${spineY}" fill="${INK}"/>`);

  // ② 骨（压在框下面）
  for (const n of nodes) {
    if (n.kind !== 'category') continue;
    out.push(`<line x1="${n.anchorX}" y1="${n.anchorY}" x2="${n.tipX}" y2="${n.tipY}" stroke="${n.color}" stroke-width="${BONE_W}" stroke-linecap="round"/>`);
  }

  // ③ 因框回连骨的短竖线（画在框之前，末端被框压住）
  for (const n of nodes) {
    if (n.kind !== 'cause') continue;
    out.push(`<line x1="${n.boneX}" y1="${n.boneY}" x2="${n.connectorTo.x}" y2="${n.connectorTo.y}" stroke="${n.color}" stroke-width="${CAUSE_LEADER_W}" opacity="0.9"/>`);
  }

  // ④ 所有框
  for (const n of nodes) {
    if (n.kind === 'effect') {
      out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${EFFECT_R}" fill="${HEAD_FILL}"/>`);
    } else if (n.kind === 'category') {
      out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${NAME_BOX_R}" fill="${PAPER}" stroke="${n.color}" stroke-width="${NAME_BOX_STROKE_W}"/>`);
    } else {
      out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${CAUSE_BOX_R}" fill="${PAPER}" stroke="${tint(n.color, 0.5)}" stroke-width="${CAUSE_BOX_STROKE_W}"/>`);
    }
  }

  // ⑤ 文字（居中；层级靠字重区分，黑白打印也不丢）
  for (const n of nodes) {
    const tx = n.x + n.w / 2;
    const baseline0 = n.y + n.padY + n.fs * 1.06;
    n.lines.forEach((line, i) => {
      out.push(`<text x="${tx.toFixed(1)}" y="${(baseline0 + i * n.lineH).toFixed(1)}" font-size="${n.fs}" font-weight="${n.weight}" fill="${n.fill}" text-anchor="middle">${esc(line)}</text>`);
    });
  }

  out.push('</svg>');
  return { svg: out.join('\n'), width, height, nodes };
};

export default { buildFishboneSvg, layoutFishbone, estimateTextWidth, wrapLabel };
