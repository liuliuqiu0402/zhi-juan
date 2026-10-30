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
  normNodeFont, normNodeMinW, normNodeMinH, parseInlineStyles, textWidthOf,
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
      kids.forEach((k) => {
        const ri = g.rowOf.get(k);
        const rh = g.rowH[ri];
        // 同一行内**按各自高度垂直居中**（不再顶边对齐）：高度差多少就上下匀开，看着不"固定"
        k.rowH = rh;
        k.y = start + g.rowY[ri] + (rh - k.h) / 2;
      });
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
    // 🔴 2026-10-30（属主："导图改为右支后，为啥导图框不是按照内容自适应的"）：
    //   默认回到 balanced（左右分布）——版式由模型按内容给（`data-layout`），此处只是"没给时"的兜底；
    //   总装层（diagrams/index.js）会在"没指定版式"时按"哪种折行更少"自动择一。
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
  // 🔴 2026-10-30（属主："不要弄人为的计算那么繁琐，交给内容本身"）：
  //   折行宽不再由总装层二分得出，改成**每个节点按自己还剩多少横向空间**决定——
  //   可用宽 = 版心 − 外边距 − **这一支父链已经占掉的宽**（父链累加，含内边距）。
  //     · 文字自然宽放得下 ⇒ 一行（框宽=文字宽，框只是"加在内容上"）；
  //     · 放不下 ⇒ 就在剩余宽处折行（不是"版心×0.38"这类人为阈值）。
  //   根是视觉锚点：最多占版心 1/3，超过就折（把横向让给分支）。
  //   无栏宽约束（单测/样张）时退回 opts.maxLabelWidth（默认 150）作兜底，行为与老口径一致。
  const pageW = Number(opts.fitWidth) || 0;
  const baseCap = Number(opts.maxLabelWidth) || 150;
  // 整幅仍超版心时，总装层会一次性给一个"折行宽系数"（只收窄折行宽、不动字号），这里逐节点套用
  const wrapFactor = Math.min(1, Math.max(0.25, Number(opts.wrapFactor) || 1));
  // 🔴 2026-10-30（属主："可否不是等比让，是让最左侧的先让"）：
  //   一支放不下时，"谁让位"的口径（默认 left = 最左侧先让）：
  //     · 'left'（默认）：**根/靠左的先让**，让到约 4 字为止再轮到下一级 ⇒ 最右侧的叶子保住自然宽（散开）
  //     · 'proportional'：按自然宽等比让（前一次口径，保留供对比）
  //     · false：谁先谁吃满、剩下的才给后面（最右叶子被压得最狠的老口径，仅对账/回退用）
  const shareMode = opts.fairShare === false
    ? 'none'
    : (opts.fairShare === 'proportional' ? 'proportional' : 'left');
  /** 单框文字宽的让位下限（≈4 个汉字）——再窄就只剩竖排单字，没有排版意义 */
  const MIN_TEXT_W = 60;

  /**
   * 单节点度量（prep 与"这一支还要多宽"的预扫共用**一份**口径，防两处各算一次而漂移）。
   * 返回的 measure/widthOf 已绑定该节点的 字号/字重（含行内加粗），可直接量行与段。
   */
  const measureNode = (raw, depth, isRoot) => {
    // 🔴 2026-10-22（属主："节点字号可以做"）：节点可自带 fs（11–24），不合法则按层级默认。
    //   行高必须**跟着该节点字号**算（原先全图共用一个 lineH ⇒ 改了字号行距不跟、字会压在一起）。
    const fs = normNodeFont(raw.fs) || (isRoot ? rootFontSize : fontSize);
    const lineHn = Math.round(fs * 1.42);
    const str = tf(raw.title);
    const weight = nodeWeight(raw, depth, isRoot);
    const exact = typeof measurer === 'function';
    // 🔴 2026-10-22（属主："局部加粗可以做"＋"局部改字颜色也可以的吧"）：行内样式统一解析——
    //   `**粗**` 与 `{{红:字}}`／`{{#c00000:字}}`，可嵌套（`{{红:**重点**}}`）。
    //   折行按纯文本算（宽度判据不变），折完再按字符把"粗/色"掩码回填成"每行的若干段"，渲染逐段出字。
    const { plain, bold: boldMask, colors } = parseInlineStyles(str);
    const anyBold = boldMask.some(Boolean);
    const effWeight = anyBold ? Math.max(weight, 700) : weight;
    const measure = exact ? (t, f) => measurer(t, f, effWeight) : undefined;
    const boldK = weightPadK(effWeight, exact);
    const widthOf = (t, b) => textWidthOf(t, fs, b ? 700 : weight, measurer) * (exact ? 1 : boldK);
    return { fs, lineHn, weight, exact, plain, boldMask, colors, anyBold, effWeight, measure, boldK, widthOf, natural: widthOf(plain, anyBold) };
  };

  /**
   * 这一支"从本节点到最深后代"**不折行时**需要的横向空间（框宽 + 间隙逐级累加）。
   * 用途：判断"本框吃满自然宽之后，后面的分支还够不够"——不够就按比例让位。
   */
  const chainNeedOf = (raw, depth, isRoot) => {
    const { natural } = measureNode(raw, depth, isRoot);
    const kids = raw.children || [];
    const below = kids.length ? Math.max(...kids.map((k) => chainNeedOf(k, depth + 1, false))) : 0;
    return natural + padX * 2 + (below ? gapX + below : 0);
  };

  /**
   * 🔴 2026-10-30（属主："从最左侧开始让，依次往右，这样就需要知道让到什么程度是合适的才能实施？
   *   而且要注意到排版的美观"）：
   *   让位的下限**不能拍像素**（"让到 4 字"会变成竖柱，"等比让"又让每个框都变窄），
   *   决定美观的是**每个框里有几行字**。故下限取"本支统一折 L 行"所需的文字宽：
   *     L = 这一支**最少统一折几行**才放得下的那个行数（1 行放得下就 1 行，否则 2 行、3 行…最多 6 行）。
   *   这样：左先让、右保住；每个框的折行数不超过 L，不会出现一列 4 字 6 行的柱子。
   */
  /**
   * "这个框要折成 L 行，**最少**要多宽"——用真的折行函数**二分**试出来，不做像素折算。
   * 为什么不用 natural/L：折行按整字断（9 字塞 73px 会成 4+4+1 三行），按除法算会假小一档；
   *   而用同一个 wrapLabel 试宽度，结果与真正出图**必然一致**。
   * 为什么用二分而不是"每次 +15%"：粗步长会把"2 行够用"估成"2 行放不下"，于是整条链白升到 3 行
   *   （实测 5 层链：真排 2 行只有 606px，粗估却算成 638px ⇒ 升 3 行、图反而更高）。
   */
  const lwCache = new WeakMap();
  const linesWidthOf = (m, raw, lines) => {
    const want = Math.max(1, lines);
    let byLines = lwCache.get(raw);
    if (!byLines) { byLines = new Map(); lwCache.set(raw, byLines); }
    if (byLines.has(want)) return byLines.get(want);
    const fits = (w) => wrapLabel(m.plain, w, m.fs, m.measure, 99).length <= want;
    const full = Math.ceil(m.natural);
    let lo = Math.max(1, Math.ceil(m.natural / want));
    let hi = full;
    let out = lo;
    if (fits(lo)) out = lo;
    else if (!fits(hi)) out = hi;            // 整宽都放不进（极少：单字超宽）
    else {
      for (let i = 0; i < 12 && hi - lo > 1; i += 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (fits(mid)) hi = mid; else lo = mid;
      }
      out = hi;
    }
    byLines.set(want, out);
    return out;
  };
  /** 整支统一折 L 行时，从本节点到最深后代需要的横向空间（框宽 + 间隙逐级累加） */
  const chainNeedLines = (raw, depth, isRoot, lines) => {
    const m = measureNode(raw, depth, isRoot);
    const kids = raw.children || [];
    const below = kids.length ? Math.max(...kids.map((k) => chainNeedLines(k, depth + 1, false, lines))) : 0;
    return linesWidthOf(m, raw, lines) + padX * 2 + (below ? gapX + below : 0);
  };
  let chainLines = 1;
  if (pageW && shareMode === 'left' && (rawRoot.children || []).length) {
    // room = 整幅可用宽（版心减两侧外边距）；chainNeedLines 返回的是**框宽**（文字宽已含内边距），
    //   所以这里**不能再减一排内边距**——减了就"算得下也判成放不下"，白白升到 3 行。
    const room = pageW - 2 * margin;
    // 上限 **3 行**：2 行还放不下时（超长链）才升到 3 行——不封顶会出现"父 2 行、叶子 5 行"的窄柱；
    //   3 行也放不下时，交由总装层在两种口径里择优（谁更矮用谁），不会把某个框无限压成竖排。
    // 12px 容差与总装层同口径：全 L 行的"刚好差几像素"不算放不下——叶子那一格本来就有富余，
    //   为了 3px 把整条链从 2 行升到 3 行，图反而更高（实测 4 层链：614 判 611 ⇒ 白升一行）。
    while (chainLines < 3 && chainNeedLines(rawRoot, 0, true, chainLines) > room + 12) chainLines += 1;
  }

  let seq = 0;
  /**
   * 这一支"散出去多少叶子"（扇出权重）。用于让位分摊：让窄 1px，这一支里**每片叶子**都受益，
   *   所以权重＝叶子数，叶子多的先让。
   */
  const weightCache = new WeakMap();
  const weightOf = (raw) => {
    if (!raw || typeof raw !== 'object') return 1;
    const hit = weightCache.get(raw);
    if (hit) return hit;
    const kids = raw.children || [];
    const w = kids.length ? kids.reduce((s, k) => s + weightOf(k), 0) : 1;
    weightCache.set(raw, w);
    return w;
  };
  /** 从本节点沿"自然宽最大的孩子"走到底——这条链才是决定整幅宽度的约束，让位只在这条链上摊 */
  const subchainOf = (raw, depth, isRoot) => {
    const m = measureNode(raw, depth, isRoot);
    const kids = raw.children || [];
    if (!kids.length) return [{ raw, m }];
    let best = kids[0];
    let bestNeed = -1;
    for (const k of kids) {
      const need = chainNeedOf(k, depth + 1, false);
      if (need > bestNeed) { bestNeed = need; best = k; }
    }
    return [{ raw, m }, ...subchainOf(best, depth + 1, false)];
  };
  /**
   * 本框的"让位下限"（文字宽）：扇出 ≥3 的允许让到 3 行——它一让，下面**每片叶子**都跟着宽；
   * 扇出小的（1–2 片）只让到 L 行，链尾基本不动。这是"按散出去的叶子多少让"的落点。
   */
  const fanFloorOf = (m, raw) => {
    const lines = Math.max(chainLines, weightOf(raw) >= 3 ? 3 : chainLines);
    return Math.min(m.natural, Math.max(linesWidthOf(m, raw, lines), MIN_TEXT_W));
  };
  const prep = (raw, depth, color, isRoot, usedW = 0) => {
    const m = measureNode(raw, depth, isRoot);
    const { fs, lineHn, weight, exact, plain, boldMask, colors, measure, widthOf, natural } = m;
    // 这一支还剩多少横向空间：版心 − 外边距 − 父链已占 − 本框左右内边距（保证排完整幅 ≤ 版心）。
    // 剩余很少时也照实折行（最少 ~2 个字），不硬留 padding 把整幅顶出版心——宁可窄，也不越界。
    const avail = pageW ? Math.max(24, pageW - 2 * margin - usedW - padX * 2) : baseCap;
    // 根最多占版心 1/3（视觉锚点，别让它独占一行）；减掉内边距，保证**框宽**不超过 1/3 版心
    const capLimit = (isRoot && pageW) ? Math.min(avail, Math.round(pageW / 3) - padX * 2) : avail;
    let capW = (natural <= capLimit ? natural : capLimit);
    // 🔴 2026-10-30（属主："可否不是等比让，是让最左侧的先让"）：
    //   这一支放不下时（本框 + 间隙 + 后代链 > 可用宽），**靠左的先让**：
    //     本框先把缺口让掉，让到约 4 字（MIN_TEXT_W）为止；还不够就让下一级接着让（递归自然发生——
    //     子节点拿到的 avail 已扣掉本框让完后的实际宽）⇒ 最右侧的叶子尽量保住自然宽、不再被压成柱子。
    if (shareMode !== 'none' && pageW) {
      const kids = raw.children || [];
      // 本框的"让位下限"：仍能保持 L 行（L≤2）所需的宽度，再低就到 MIN_TEXT_W 为止
      const floorMine = Math.min(natural, Math.max(linesWidthOf(m, raw, chainLines), MIN_TEXT_W));
      if (shareMode === 'proportional') {
        // 等比让：本框与后代按自然宽占比分摊（对照口径，保留）
        const descNeed = kids.length ? Math.max(...kids.map((k) => chainNeedOf(k, depth + 1, false))) : 0;
        const need = natural + (descNeed ? gapX + descNeed : 0);
        if (descNeed > 0 && need > avail) {
          const reserve = Math.max(floorMine, Math.round((avail * descNeed) / need));
          capW = Math.min(capW, Math.max(floorMine, avail - gapX - reserve));
        }
      } else if (kids.length) {
        // 🔴 2026-10-30（属主："还是从最左侧开始智能折让哦，最左侧开始，这个基础不能丢"）：
        //   **顺序永远是"从最左往右"**（父先让，让到自己的下限才轮到下一级）；
        //   "智能"只体现在**每层让到几行**——按这一支散出去的叶子数：
        //     一个框让窄 1px，它下面**每片叶子**都跟着宽 ⇒ 扇出越大越值得让，允许它让到 3 行；
        //     扇出小的（1–2 片叶子）只让到 2 行，链尾基本不动。
        //   放得下且有富余时，富余也按扇出分（叶子多的框更宽），而不是机械地全给链尾。
        const chain = subchainOf(raw, depth, isRoot);
        if (chain.length > 1) {
          const needAll = chain.reduce((s, c) => s + Math.round(c.m.natural) + padX * 2, 0) + (chain.length - 1) * gapX;
          const availAll = pageW - 2 * margin - usedW;
          // 放得下 ⇒ 一点不让（框宽=文字宽）；真放不下 ⇒ 本框让到"扇出决定的下限"，余量整块让给右边。
          // 注意：**不在富余里给自己加宽**——一加宽就等于把右边挤窄，会出现"父没折、子折了"的乱序。
          // 也不留容差：既然"左先让"，那"差 1px"也该由左边先让，而不是让最右边那个框去折。
          if (needAll > availAll) capW = Math.min(capW, fanFloorOf(m, raw));
        }
      }
    }
    capW *= wrapFactor;
    // ⚠️ capW 与 estimateTextWidth 同一量纲（非实测时都已含字重余量），**不能再除一次 boldK**，
    //    否则"明明放得下也被折行"（实测：8 字根节点 125px 被压到 113px → 折成两行）。
    // 🔴 2026-10-30（属主："排版模块里预览还是存在不该折行的折行了"·根因）：
    //   这里**必须是 ceil、不能 round**——`capW` 就是"文字自然宽"本身（放得下时），
    //   而 `wrapLabel` 的判据是"自然宽 ≤ wrapW 才不折"。自然宽常带小数（实测 measurer 会给
    //   124.4px），`Math.round` 把它取成 124 < 124.4 ⇒ **每一处小数 ≥0.5 的标签都被折成两行**
    //   （末行只落一两个字）。实测：`分数的意义和性质`(124.4→124) 折成「分数的意义和性／质」，
    //   `分数的意义`(68.3→68) 折成「分数的意／义」，与版心宽窄无关（fitWidth=0 也照折）。
    const wrapW = Math.max(60, Math.ceil(capW));
    let lines = wrapLabel(plain, wrapW, fs, measure, lineBudget(plain, wrapW, fs, measure));
    // 🔴 2026-10-30（属主："折行考虑内容折行后的美观性"）：
    //   真要折行时，**回填到"刚好放下这几行"的宽度**再折一次——贪心折行只保证"不超宽"，
    //   常折成"几乎一整行 + 末尾一个字"（实测：「二、习作…再写思／考」），既难看又白占宽度。
    //   回填后各行长度均匀，框也跟着变窄，让出的宽度自然给了后面的分支。
    if (lines.length > 1) {
      const tightW = Math.max(MIN_TEXT_W, linesWidthOf(m, raw, lines.length));
      if (tightW < wrapW) {
        const balanced = wrapLabel(plain, tightW, fs, measure, lineBudget(plain, tightW, fs, measure));
        if (balanced.length <= lines.length) lines = balanced;
      }
    }
    // 按字符回填掩码：wrapLabel 只会丢"行首空白"，所以顺序扫描即可对上（末尾自动兜底成末行剩余）
    let cur = 0;
    const lineRuns = lines.map((line) => {
      const runs = [];
      for (const ch of line) {
        while (cur < plain.length && plain[cur] !== ch) cur += 1;
        if (cur < plain.length) cur += 1;
        const b = boldMask[cur - 1] === true;
        const c = colors[cur - 1] || '';
        const tail = runs[runs.length - 1];
        if (tail && tail.bold === b && tail.color === c) tail.text += ch;
        else runs.push({ text: ch, bold: b, color: c });
      }
      return runs.map((r) => ({ ...r, w: widthOf(r.text, r.bold) }));
    });
    const textW = Math.max(...lineRuns.map((rs) => rs.reduce((s, r) => s + r.w, 0)), 0) + (exact ? 2 : 0);
    // 🔴 2026-10-22（属主："手工拖框改宽高值得做吧"）：只接受**最小宽/最小高**——
    //   真宽 = max(内容宽, 手动宽)，真高 = max(内容高, 手动高) ⇒ 手改永远裁不到字（底线不让步）。
    const w = Math.max(Math.round(textW + padX * 2), normNodeMinW(raw.w) || 0);
    const h = Math.max(Math.round(lines.length * lineHn + padY * 2), normNodeMinH(raw.h) || 0);
    return {
      id: seq++,
      title: String(raw.title == null ? '' : raw.title),
      lines,
      lineRuns,
      fs,
      weight,
      lineH: lineHn,
      textW,
      padX,
      padY,
      w,
      h,
      color,
      // 节点强调色（规格里可手改）：非根节点＝**文字色**；根节点是深底白字，所以它＝**框底色**。
      accent: normalizeHex(raw.color),
      isRoot: !!isRoot,
      depth,
      side: 0,
      parent: null,
      y: 0,
      x: 0,
      // 子节点继承"父链已占宽"（含本节点宽 + 列间隙）——折行宽全由这条父链剩余空间决定
      children: (raw.children || []).map((c) => prep(c, depth + 1, depth === 0 ? palette[seq % palette.length] : color, false, usedW + w + gapX)),
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
  /** 只有"短条目"才横排（含内边距 ≤160px ≈ 10 个汉字）；长句仍一条一行——横排会把长句挤成窄栏 */
  const MAX_SHORT_W = 160;
  const fitW = Number(opts.fitWidth) || 0;
  /** 该分组可用的整块宽：= 整幅 − 外边距 − **这一支从根到本节点已经占掉的宽度**（父链累加）。
   *  🔴 2026-10-30：横向改为"按父框贴边生长"后，前缀不再是"每层最大宽"，而是**本支自身父链的宽**。 */
  const prefixWidthOf = (node) => {
    let acc = 0;
    let cur = node;
    while (cur) { acc += cur.w + gapX; cur = cur.parent; }
    return acc;
  };
  const gridBudgetOf = (node) => {
    const half = layout === 'balanced' && (root.children || []).length > 1 ? 2 : 1;
    if (!fitW) return Math.max(120, Math.round(MAX_GRID_W / half));
    return Math.max(120, Math.round((fitW - 2 * margin - prefixWidthOf(node)) / half));
  };
  // 🔴 2026-10-30（属主："每一个枝节的框还是固定的上下对齐的，并不是按照内容来的"）：
  //   原横排是**按列对齐的表格**——列宽取"该列最宽的框"，于是窄框后面拖一条空白、同列左边缘强行对齐，
  //   整组看着像固定的格子。现改**流水排（flow）**：每个框用自己的宽，从左往右依次紧挨着放，
  //   一行放不下（超出本组可用宽）才换行；行高取该行最高框。位置与尺寸全由内容决定，不再对齐成表格。
  const gridGeo = (node) => {
    const kids = node.children || [];
    const budget = gridBudgetOf(node);
    const rows = [];
    let cur = [];
    let curW = 0;
    kids.forEach((k) => {
      const add = (cur.length ? gapX : 0) + k.w;
      if (cur.length && curW + add > budget) { rows.push(cur); cur = []; curW = 0; }
      curW += (cur.length ? gapX : 0) + k.w;
      cur.push(k);
    });
    if (cur.length) rows.push(cur);
    const xOf = new Map();
    const rowOf = new Map();
    const rowY = [];
    const rowH = [];
    let ay = 0;
    rows.forEach((r, ri) => {
      let ax = 0;
      r.forEach((k) => { xOf.set(k, ax); rowOf.set(k, ri); ax += k.w + gapX; });
      const h = Math.max(...r.map((k) => k.h));
      rowY[ri] = ay;
      rowH[ri] = h;
      ay += h + gapY;
    });
    const width = Math.max(0, ...rows.map((r) => r.reduce((s, k) => s + k.w, 0) + Math.max(0, r.length - 1) * gapX));
    return { rows, xOf, rowOf, rowY, rowH, width, height: Math.max(0, ay - gapY) };
  };
  const decideGrid = (node) => {
    node.grid = null;
    const kids = node.children || [];
    // 🔴 2026-10-30：判据加"**必须是一行的短条目**"——折过行的条目再横排，等于把长句塞进窄格
    //   （实测 14 字/条的要点被并排成三列窄栏）。宽度阈值只是"短"的上限，行数才是"短"的本质。
    if (kids.length >= 3 && kids.every((k) => !(k.children || []).length && k.lines.length === 1 && k.w <= MAX_SHORT_W)) {
      const budget = gridBudgetOf(node);
      // 至少能并排两项才值得横排；并不下就自然竖排（一项一行），不做任何硬挤
      const two = kids.map((k) => k.w).sort((a, b) => a - b).slice(0, 2);
      if (two.length === 2 && two[0] + two[1] + gapX <= budget) node.grid = true;
    }
    kids.forEach(decideGrid);
  };
  decideGrid(root);

  // ── 分两侧：按"子树预估高度"贪心切分（比按数量切更均衡）──
  const all = root.children || [];
  let leftKids = [];
  let rightKids = all;
  if (layout === 'balanced' && all.length > 1) {
    // 🔴 2026-10-30（属主："左右两支同时存在时，一侧过长、一侧过短，极度不协调"）：
    //   原切法按"一级子节点个数×0.9 + 1"粗估重量、且**只数一层** ⇒ 分到某侧的分支可能深得多，
    //   两侧高度差被放大（实测 4 个分支切成 10 节点 : 4 节点）。现按**子树叶子数**累计，
    //   并**枚举所有切点取差值最小者**（O(分支数)），两侧尽量等高；切不动时仍退化为单侧。
    const leavesOf = (n) => {
      const kids = n.children || [];
      return kids.length ? kids.reduce((s, k) => s + leavesOf(k), 0) : 1;
    };
    const counts = all.map(leavesOf);
    const total = counts.reduce((s, c) => s + c, 0);
    let acc = 0;
    let bestCut = 1;
    let bestDiff = Infinity;
    for (let i = 0; i < all.length - 1; i++) {   // 至少给右侧留一个分支
      acc += counts[i];
      const diff = Math.abs(total - 2 * acc);
      if (diff < bestDiff) { bestDiff = diff; bestCut = i + 1; }
    }
    leftKids = all.slice(0, bestCut);
    rightKids = all.slice(bestCut);
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

  // ── 横向：**按父框贴边生长**（不再"每层一列"）──
  // 🔴 2026-10-30（属主："枝节横向并列的还是被固定长宽…连着上下的全部统一了长宽、上下对齐了，正常不应该这样"）：
  //   原实现按"每层一列"排（同层所有框左缘相同、列距取该层最宽框）⇒ 整张图像一张表格，
  //   同一列上下对齐、框间还留着"列宽 − 自己宽"的空白。现改为：**每个子框紧贴自己父框的右（左）边 gapX**，
  //   x 由父链算，同层不同父的框自然错开，不再上下对齐成一列。
  const halfW = root.w / 2;
  // 根节点自己也要占位！它不参与 placeX（placeX 只排左右两侧的子节点），
  //    漏赋值会让 root.x 停在初始的 0，归一化后整块压到右侧分支上。
  root.x = -halfW;
  const placeX = (n, side, keepX = false) => {
    if (!keepX) {
      const p = n.parent;
      n.x = p
        ? (side === 1 ? p.x + p.w + gapX : p.x - gapX - n.w)
        : (side === 1 ? halfW + gapX : -halfW - gapX - n.w);
    }
    const edge = side === 1 ? n.x + n.w + gapX : n.x - gapX;
    if (n.grid) {
      const g = gridGeo(n);
      n.children.forEach((c) => {
        const off = g.xOf.get(c) || 0;
        c.x = side === 1 ? edge + off : edge - off - c.w;
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
    metrics: { padX, padY, lineH, gapX, gapY, margin, fontSize, rootFontSize, shareLines: chainLines },
  };
};

/* ============================ ② 出图 ============================ */

/** 版式 → SVG 字符串（不含 DOCTYPE，可直接内联进 HTML / PDF） */
export const buildMindmapSvg = (tree, opts = {}) => {
  const { nodes, width, height, metrics } = layoutMindmap(tree, opts);
  // 引线所需的行距取自版式（单一来源，不在此另写一个常数）
  const gapY = metrics?.gapY || 9;
  const out = [];
  out.push(svgHeader(width, height));
  out.push(svgPaper(width, height));

  // ① 先画全部连线（压在节点下面）
  const seg = (d, color) => out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>`);
  for (const n of nodes) {
    const kids = n.children || [];
    // 🔴 2026-10-22（属主："连接线有的跟内容不太合适"·几何侧）：一组横排（多行多列）时，
    //   若按"父→每个子"各拉一条贝塞尔，去第二行的那几条会**从第一行的框后穿过**（看着像连错）。
    // 🔴 2026-10-22 二次（属主："导图连接线也是正常的吧？不会有例外情况吧？"·实测确有例外）：
    //   中间版本改成"父→干线→按子节点**中心高度**横拉到每个子框"，但一行里几个框**中心同高**，
    //   于是去第 2、3、4 个的横线会**从第 1、2、3 个框里穿过去**（被白底框压住，看着像一条线穿糖葫芦；
    //   几何上"item 2 的线起点落在 item 1 框内"，属真实缺陷；普通树形没有此问题）。
    //   最终口径＝**上方引线（梳子式）**：干线在组外，逐行在**该行上方**拉一条横线，再由横线**竖直落到各框上沿**——
    //   横线永远在框外、竖线只落在框顶，无论一行几列都不穿框。
    if (n.grid && kids.length) {
      const leftward = kids[0].side === -1;
      const py = n.y + n.h / 2;
      const from = leftward ? n.x : n.x + n.w;
      const near = leftward
        ? Math.max(...kids.map((c) => c.x + c.w))
        : Math.min(...kids.map((c) => c.x));
      const trunk = leftward ? from - (from - near) / 2 : from + (near - from) / 2;
      // 同一 rowY 的算一行（横排换行后会有多行）。
      // 🔴 2026-10-30：行内改为"各自垂直居中"后，同行的 y 不再相同 ⇒ 用行顶（rowH 反推）分组。
      const rowTopOf = (c) => (c.rowH != null ? c.y - (c.rowH - c.h) / 2 : c.y);
      const rows = [];
      for (const c of kids) {
        const top = rowTopOf(c);
        const hit = rows.find((r) => Math.abs(r.top - top) < 0.5);
        if (hit) hit.items.push(c);
        else rows.push({ top, items: [c] });
      }
      const laneY = (r) => r.top - Math.max(4, Math.round(gapY / 2));
      const lanes = rows.map(laneY);
      seg(`M ${from} ${py} L ${trunk} ${py}`, n.color);
      seg(`M ${trunk} ${Math.min(py, ...lanes)} L ${trunk} ${Math.max(py, ...lanes)}`, n.color);
      for (const r of rows) {
        const y = laneY(r);
        const cxs = r.items.map((c) => c.x + c.w / 2);
        seg(`M ${trunk} ${y} L ${leftward ? Math.min(...cxs) : Math.max(...cxs)} ${y}`, n.color);
        for (const c of r.items) {
          const cx = c.x + c.w / 2;
          seg(`M ${cx} ${y} L ${cx} ${c.y}`, c.color);
        }
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
    // 手动加高时**上下居中**（富余高度用于留白，不压缩行距、不裁字）
    const blockH = n.lines.length * n.lineH;
    const topPad = Math.max(n.padY, Math.round((n.h - blockH) / 2));
    const baseline0 = n.y + topPad + n.fs * 1.06;
    // 逐"段"出字：`**粗**` 段用 700，其余按层级字重；每段自己算 x（左支从右往左排，不依赖 text-anchor=end，
    //   因为混合字重的整行用 end 对齐在各渲染器（浏览器/PDF/Word 光栅化）下不一致）。
    n.lines.forEach((line, i) => {
      const runs = (n.lineRuns && n.lineRuns[i]) || [{ text: line, bold: false, w: 0 }];
      const total = runs.reduce((s, r) => s + (r.w || 0), 0);
      let x = n.side === -1 ? n.x + n.w - n.padX - total : n.x + n.padX;
      const y = (baseline0 + i * n.lineH).toFixed(1);
      for (const run of runs) {
        // 局部改色优先于"节点强调色/默认墨色"（`{{红:…}}` 只管包住的那几个字）
        const runFill = run.color || fill;
        out.push(`<text x="${x.toFixed(1)}" y="${y}" font-size="${n.fs}" font-weight="${run.bold ? 700 : weight}" fill="${runFill}" text-anchor="start">${esc(run.text)}</text>`);
        x += run.w || 0;
      }
    });
  }

  out.push('</svg>');
  return { svg: out.join('\n'), width, height, nodes };
};

export default { buildMindmapSvg, layoutMindmap, estimateTextWidth, wrapLabel };

