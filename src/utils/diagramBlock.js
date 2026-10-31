/**
 * 🧩 导图块：把 AI 正文里的"导图块"渲染成内联 SVG
 * ============================================================
 * 为什么用"标记块 + JSON"而不是让 AI 直接写 SVG：
 *   · AI 手写的 SVG 必然歪（坐标靠猜）、且极易被清洗器改坏；
 *   · 让 AI 只负责**结构化内容**（谁包含谁、什么关系），几何由 utils/diagrams 算 —— 这是
 *     "版式由代码守住、内容由模型产出"的分工，也是本仓库一贯做法（目录/公式都走这条路）。
 *
 * 约定（注入给模型的原文见 config/expertKnowledge.js 的 styleInstructions.mindmap，两者必须同步）：
 *   <div class="k-diagram" data-type="mindmap" data-layout="balanced">
 *     {"title":"中心主题","children":[{"title":"分支","children":[]}]}
 *   </div>
 *
 * 安全设计：**没有标记就完全不变**。解析失败（JSON 坏了/图种不认识）时**原样保留**该块
 *    （作者写的 JSON 会当普通文字显示出来，而不是让整篇文章消失），并计入 failures 供上层告警。
 *    这样接入生成链路是零风险的：模型不按约定输出，行为与从前完全一致。
 *
 * 双向通道：产出的内联 SVG 在 PDF（puppeteer）里是矢量、最清晰；
 * Word 导出前由 utils/docxBuilder 的 rasterizeSvgsForExport 光栅化成 PNG。
 * ============================================================
 */
import { buildDiagramSvg, DIAGRAM_TYPES, paginateMindmapSpec } from './diagrams/index.js';
import { DEFAULT_FONT } from './diagrams/shared.js';

/** 浏览器内**真实字宽**测量（canvas，按 字重+字号+字体栈 实测）；无 canvas（jsdom/Node）返回 null，
 *  调用方退回字符类别估算。用于"框随内容自适应、字不出框"（2026-10-22 属主）。 */
const makeCanvasMeasurer = () => {
  try {
    if (typeof document === 'undefined' || typeof CanvasRenderingContext2D === 'undefined') return null;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx || typeof ctx.measureText !== 'function') return null;
    return (text, fontSize, weight) => {
      const t = String(text == null ? '' : text);
      try {
        // 🔴 2026-10-22（属主："为啥还有字会在框外呢？我们不是自适应了吗？"）：
        //   各图种的文字字重不同（mindmap 根 600／一级 500；flow 起止 600；brace 标题 500），
        //   而多数图种调用 measurer 时**不传字重**。这里把"未指定字重"按**最大字重 600** 实测——
        //   宁可略宽（不越框），也不要按 400 量出来偏窄导致出框。
        ctx.font = `${weight == null ? 600 : weight} ${fontSize}px ${DEFAULT_FONT}`;
        const w = ctx.measureText(t).width;
        // 再留 2% + 2px 的余量：不同引擎的 hinting/字距有细微差异，宁可略宽也不越框。
        return Number.isFinite(w) && w > 0 ? w * 1.02 + 2 : t.length * fontSize * 0.6;
      } catch {
        return t.length * fontSize * 0.6;
      }
    };
  } catch {
    return null;
  }
};

/** 导图块的标记类名（必须是 class，模型最容易稳定复现） */
export const DIAGRAM_BLOCK_CLASS = 'k-diagram';

/** 渲染产物（figure）的类名与"规格"属性名 —— 富文本编辑器与导出链路都按这两个名字认它 */
export const FIGURE_CLASS = 'k-diagram-figure';
export const SPEC_ATTR = 'data-k-spec';

/**
 * 为什么必须把**原始规格**留在 figure 上（2026-09-24 用户："所有生成的内容要从排版模块排版后再导出的，
 *    所以不能让生成的内容静默丢弃"）：
 *    导图在生成阶段就被渲染成了内联 SVG（导图块 JSON 随即消失）。一旦某个环节把 SVG 丢掉，
 *    数据就**不可逆**没了（不像公式丢了还能从 $…$ 重渲染）。留一份规格 = 任何时候都能重画出来。
 *    同时它也是"改版式/换图种不必重新调模型"的地基。
 */

/** 实测 measurer 的按需单例（同一页面复用一个 canvas context；无 canvas 环境缓存 null） */
let _measurerCache;
export const getCanvasMeasurer = () => {
  if (_measurerCache === undefined) _measurerCache = makeCanvasMeasurer();
  return _measurerCache;
};

/**
 * 🔴 2026-10-30（属主："导图的字体大小不随排版模板吗？"）：
 *   排版模板正文字号（pt）→ 导图字号（px）。锚点 **12pt ↔ 13px**（历史出图口径），
 *   其余字号等比放大/缩小 —— 主题 12pt 时出图与从前完全一致（不因改这条而集体重排），
 *   小学 14pt → 15px、高中 10.5pt → 11px，导图与正文的**大小关系**保持不变。
 *   夹在 10–22px：低于 10px 印不清，高于 22px 一条分支就吃掉整幅版心。
 */
export const diagramFontPxFromPt = (pt) => {
  const n = Number(pt);
  const base = Number.isFinite(n) && n > 0 ? n : 12;
  return Math.min(22, Math.max(10, Math.round((13 * base) / 12)));
};

/**
 * 出图口径（栏宽 + 字号）的**当前值**——编辑器/导出会从规格重画（tiptapDiagramFigure.renderHTML，
 *   见 utils/tiptapDiagramFigure.js），那条路拿不到调用方参数，只能读这里。
 * 为什么不每次显式传：renderHTML 是 tiptap 内部回调（打字、选中、序列化都会触发），
 *   只要它按 643/13px 出图，排版模块"按纸张重排"的结果就会被下一次事务抹掉——
 *   这就是"排版模块里预览还是旧的"的成因之一。
 */
const RENDER_OPTS = { fitWidth: 0, fontSize: 0 };
export const setDiagramRenderOptions = (opts = {}) => {
  const w = Number(opts.fitWidth);
  if (w > 0) RENDER_OPTS.fitWidth = w;
  if (opts.fontSize !== undefined) {
    const f = Number(opts.fontSize);
    RENDER_OPTS.fontSize = f > 0 ? f : 0;
  }
};
export const getDiagramRenderOptions = () => ({ ...RENDER_OPTS });

/** 规格属性 → SVG（属性里的 JSON 坏了也不抛错：返回空串并告警，规格本身仍在图上可重画） */
export const svgFromSpecAttr = (raw, { fitWidth, fontSize } = {}) => {
  const spec = readSpecAttr(raw);
  if (!spec) return '';
  try {
    // 🔴 2026-10-22（属主："为啥还有字会在框外呢？我们不是自适应了吗？"）：
    //   编辑器/导出是**从规格重画**（renderHTML → 本函数），原来这条路没带实测 measurer，
    //   于是"生成时按实测出框、进编辑器/导出又按估算出框"——两套宽度，后者可能偏窄 ⇒ 又出框。
    //   这里与生成侧用**同一个** canvas 实测（无 canvas 时自动退回估算）。
    // 🔴 2026-10-30（属主："折行上限可否不固定，交给排版处的版面自适应"）：折行上限由调用方按纸张栏宽传入。
    const m = getCanvasMeasurer();
    const width = Number(fitWidth) > 0 ? Number(fitWidth) : (RENDER_OPTS.fitWidth || PRINT_SAFE_WIDTH);
    const fontPx = Number(fontSize) > 0 ? Number(fontSize) : RENDER_OPTS.fontSize;
    const opts = { ...(m ? { measurer: m } : {}), fitWidth: width };
    // 字号随排版模板（0 = 用各图种自己的默认 13/15px，生成期足矣）
    if (fontPx > 0) {
      opts.fontSize = fontPx;
      opts.rootFontSize = Math.round((fontPx * 15) / 13);
    }
    return buildDiagramSvg(spec, opts).svg || '';
  } catch (e) {
    console.warn('⚠️ 导图规格重绘失败：', e?.message || e);
    return '';
  }
};

/**
 * 按某个栏宽**重画正文里的所有导图**（规格是唯一事实源，重画不改内容）。
 * 为什么需要：导图的折行宽度要跟着"排版处选的纸张/栏宽"走——生成时按 A4 排过的图，
 *   换成 A3 两栏或 8K 两栏后栏宽不同，直接沿用会白缩或白折。
 * @param {string} html 载入态 HTML（本函数返回同样形态的新 HTML）
 * @param {number} fitWidth 目标栏宽（px）
 * @param {number} [fontSize] 导图字号（px，来自排版模板正文字号；省略则用各图种默认）
 */
export const rerenderDiagramsForWidth = (html, fitWidth, fontSize) => {
  const src = String(html == null ? '' : html);
  const width = Number(fitWidth);
  if (!src || !(width > 0) || typeof DOMParser === 'undefined') return src;
  try {
    const doc = new DOMParser().parseFromString(`<div id="__k_root">${src}</div>`, 'text/html');
    const root = doc.getElementById('__k_root');
    const figs = Array.from(root?.querySelectorAll?.(`figure.${FIGURE_CLASS}`) || []);
    if (!figs.length) return src;
    for (const fig of figs) {
      const svg = svgFromSpecAttr(fig.getAttribute(SPEC_ATTR), { fitWidth: width, fontSize });
      if (svg) fig.innerHTML = toResponsiveSvg(svg);
    }
    return root.innerHTML;
  } catch {
    return src;
  }
};

/** 同上，但作用在**真实 DOM**（导出前对 clone 调用，避免改动屏幕上的编辑器） */
export const rerenderDiagramFiguresInElement = (el, fitWidth, fontSize) => {
  const width = Number(fitWidth);
  if (!el || !(width > 0)) return 0;
  const figs = Array.from(el.querySelectorAll?.(`figure.${FIGURE_CLASS}`) || []);
  let done = 0;
  for (const fig of figs) {
    const svg = svgFromSpecAttr(fig.getAttribute(SPEC_ATTR), { fitWidth: width, fontSize });
    if (svg) { fig.innerHTML = toResponsiveSvg(svg); done++; }
  }
  return done;
};

/**
 * 按单页可容纳高度把正文里的**超高思维导图**拆成若干页（规格是唯一事实源，只重排、不改内容）。
 * 为什么在 DOM 层做（2026-10-31 属主："一张 A4 纸放不下怎么办？如何分页显示？"）：
 *   Word 的行内图片不能跨页、PDF 的 figure 又 page-break-inside:avoid —— 只能在结构层按分支拆，
 *   每页都重画根节点、只带这一页放得下的分支；框和连线永远不被切断，字号也不缩。
 * @param {Element} el 目标容器（导出 clone；不会影响屏幕预览）
 * @param {object} opts { fitWidth, fontSize, maxHeightPx }
 * @returns {number} 新增的页数（0 = 无需分页）
 */
export const paginateDiagramFiguresInElement = (el, opts = {}) => {
  const width = Number(opts.fitWidth);
  const maxH = Number(opts.maxHeightPx);
  if (!el || !(width > 0) || !(maxH > 0)) return 0;
  const figs = Array.from(el.querySelectorAll?.(`figure.${FIGURE_CLASS}`) || []);
  // 量高必须与出图用**同一套口径**（字宽实测 + 字号）：字号缺省时取当前出图口径（RENDER_OPTS），
  //   否则"按默认 13px 量、按模板 15px 画"，页高会算少、分页又差出一页。
  const measurer = opts.measurer || getCanvasMeasurer();
  const fontPx = Number(opts.fontSize) > 0 ? Number(opts.fontSize) : RENDER_OPTS.fontSize;
  let extra = 0;
  for (const fig of figs) {
    const spec = readSpecAttr(fig.getAttribute(SPEC_ATTR));
    if (!spec || (spec.type || 'mindmap') !== 'mindmap') continue;
    const pages = paginateMindmapSpec(spec, {
      fitWidth: width,
      ...(fontPx > 0 ? { fontSize: fontPx } : {}),
      ...(measurer ? { measurer } : {}),
      maxHeightPx: maxH,
    });
    if (pages.length <= 1) continue;
    const doc = el.ownerDocument || document;
    const frag = doc.createDocumentFragment();
    pages.forEach((pageSpec, i) => {
      if (i > 0) {
        const br = doc.createElement('div');
        br.setAttribute('data-page-break', '');
        br.setAttribute('style', 'page-break-after:always;height:0;overflow:hidden;');
        frag.appendChild(br);
      }
      const svg = svgFromSpecAttr(JSON.stringify(pageSpec), { fitWidth: width, fontSize: fontPx > 0 ? fontPx : undefined });
      const pageFig = doc.createElement('figure');
      pageFig.className = FIGURE_CLASS;
      pageFig.setAttribute('style', 'margin:12px 0;text-align:center;');
      pageFig.setAttribute(SPEC_ATTR, JSON.stringify(pageSpec));
      pageFig.innerHTML = toResponsiveSvg(svg);
      frag.appendChild(pageFig);
    });
    fig.parentNode?.replaceChild(frag, fig);
    extra += pages.length - 1;
  }
  return extra;
};

/** 同上，但作用在 HTML 字符串（PDF/HTML 导出用；片段形态，非整篇文档） */
export const paginateDiagramsInHtml = (html, opts = {}) => {
  const src = String(html == null ? '' : html);
  const width = Number(opts.fitWidth);
  const maxH = Number(opts.maxHeightPx);
  if (!src || !(width > 0) || !(maxH > 0)) return src;
  if (!src.includes(FIGURE_CLASS) || typeof DOMParser === 'undefined') return src;
  try {
    const doc = new DOMParser().parseFromString(`<div id="__k_root">${src}</div>`, 'text/html');
    const root = doc.getElementById('__k_root');
    if (!root) return src;
    const extra = paginateDiagramFiguresInElement(root, opts);
    return extra ? root.innerHTML : src;
  } catch {
    return src;
  }
};

/** 规格属性 → 结构化 spec 对象（坏数据返回 null，绝不抛错） */
export const readSpecAttr = (raw) => {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  try {
    const o = JSON.parse(s);
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
};

/**
 * 造一张导图 figure 元素（渲染块与富文本编辑器**共用同一实现**，避免两处各写一份样式/属性）。
 * @param {object} spec 结构化规格（含 type）
 * @param {Document|any} docRef 目标 document（DOM 路径传 window.document；字符串路径传 DOMParser 的文档）
 * @param {object} opts 传给 buildDiagramSvg 的选项
 * @returns {{el:Element, width:number, height:number} | null}
 */
export const buildFigureElement = (spec, docRef, opts = {}) => {
  if (!spec || !docRef) return null;
  const { svg, width, height } = buildDiagramSvg(spec, opts);
  const fig = docRef.createElement('figure');
  fig.className = FIGURE_CLASS;
  fig.setAttribute('style', 'margin:12px 0;text-align:center;');
  fig.setAttribute(SPEC_ATTR, JSON.stringify(spec));
  fig.innerHTML = toResponsiveSvg(svg);
  return { el: fig, width, height };
};

/**
 * A4 竖版正文版心宽度（px @96dpi ≈ 794 - 页边距）。导图自然宽度超过它就会被等比缩小。
 *
 * 2026-09-24 修正（避免误报）：告警**不应该**按"宽度超过版心"触发 —— 只超几个像素根本无所谓。
 *    真正伤印刷的是**缩得太狠**：13px 正文被缩到 0.8 倍 = 10.4px ≈ 7.8pt，再小就吃力了。
 *    实证：真实生成的一张思维导图宽 764px（仅超版心 4px）→ 缩到 0.99 倍（字约 9.7pt，完全能印），
 *    旧阈值却报"印出来可能偏小"，属噪音。现改为按**缩放比**判定：
 *      只有 `版心 ÷ 图宽 < PRINT_MIN_SCALE` 才告警 ⇔ 图宽 > PRINT_WARN_WIDTH(950)。
 */
// 🔴 2026-10-22（属主定：版心取 **643**）：A4 宽 21cm = 794px @96dpi，减 20mm×2 页边距（每侧 75.6px）
//   ⇒ 正文版心 = 794 − 151.2 ≈ **643px**。旧值 760 是按"几乎无边距"算的，比真实版心宽 117px，
//   导致 643~950 这段图会被缩到 0.68~1.0 倍却**不告警**（用户实测"字变小了"却看不出原因）。
export const PRINT_SAFE_WIDTH = 643;

/** 低于此缩放比才算"印出来看不清"（13px × 0.8 = 10.4px ≈ 7.8pt） */
export const PRINT_MIN_SCALE = 0.8;

/** 告警线：图宽超过它，才会被缩到 PRINT_MIN_SCALE 以下（643 ÷ 0.8 ≈ 804） */
export const PRINT_WARN_WIDTH = Math.round(PRINT_SAFE_WIDTH / PRINT_MIN_SCALE);

/** 导图正文基准字号（px）——各图种共用底座 DEFAULT_FONT，用于折算"缩完相当于几 pt" */
const BASE_FONT_PX = 13;

/**
 * 印刷可读性判定（纯函数，便于直接断言边界，不必去凑恰好 950px 的图）。
 * @param {number} width 图的自然宽度（px）
 * @param {string} label 图种中文名（用于日志可读性）
 * @returns {string} 告警文案；不需要告警时返回空串
 */
export const printReadabilityWarning = (width, label = '') => {
  const w = Number(width) || 0;
  if (!(w > PRINT_WARN_WIDTH)) return '';
  const ratio = PRINT_SAFE_WIDTH / w;
  const px = BASE_FONT_PX * ratio;
  return `${label}宽 ${w}px，超出 A4 版心较多，将缩到 ${ratio.toFixed(2)} 倍`
    + `（正文约 ${px.toFixed(1)}px ≈ ${(px * 0.75).toFixed(1)}pt 字），印出来可能偏小`;
};

const VALID_TYPES = new Set(DIAGRAM_TYPES.map((t) => t.value));
/** 日志/告警里给人看的中文图种名（内部 value 是英文，直接打日志会让人看不懂） */
const labelOf = (type) => (DIAGRAM_TYPES.find((d) => d.value === type)?.label || type);

/** 去掉 ```json / ``` 包裹与首尾空白；模型常把 JSON 包在代码围栏里 */
const stripFence = (raw) => String(raw || '')
  .replace(/^\s*```[a-zA-Z]*\s*/, '')
  .replace(/\s*```\s*$/, '')
  .trim();

/**
 * 单块解析：标记元素 → `{ type, spec }`；失败返回 `{ error }`。
 * 导出出来是为了能单独单测（不必造 DOM）。
 */
export const parseDiagramBlock = (rawText, dataset = {}) => {
  const type = String(dataset.type || 'mindmap').trim().toLowerCase();
  if (!VALID_TYPES.has(type)) return { error: `未知图种：${type}` };
  const body = stripFence(rawText);
  if (!body) return { error: '导图块内容为空' };
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (e) {
    return { error: `JSON 解析失败：${e.message}` };
  }
  if (!payload || typeof payload !== 'object') return { error: '导图块 JSON 不是对象' };
  const layout = dataset.layout || payload.layout;
  return { type, spec: { ...payload, type, ...(layout ? { layout } : {}) } };
};

/** 内联 SVG 在 HTML/PDF 里必须自适应容器宽度（矢量缩放不糊），否则会撑破 A4 版心 */
export const toResponsiveSvg = (svg) =>
  String(svg).replace(/^<svg\s/, '<svg style="max-width:100%;height:auto" ');

/**
 * 把 HTML 里所有导图块替换成内联 SVG。
 * @param {string} html
 * @returns {{ html:string, count:number, failures:string[], warnings:string[] }}
 *   failures = 未渲染成功的块（原块已原样保留）；warnings = 印刷可读性体检（缩得太狠）
 */
export const renderDiagramBlocks = (html, opts = {}) => {
  const src = String(html == null ? '' : html);
  if (!src) return { html: src, count: 0, failures: [], warnings: [] };
  if (typeof DOMParser === 'undefined') {
    return { html: src, count: 0, failures: [], warnings: [] };
  }
  // 🔴 2026-10-22（属主："导图框可否随内容自适应？目前还有字超出框外的"）：
  //   框宽原来是**按字符类别估算**（CJK 1em／拉丁 0.56em…），字体回退、字重、连字都会让实排更宽 ⇒
  //   仍有字出框。浏览器里能拿到真实字宽，故默认注入一个 **canvas 实测 measurer**（按 字重+字号+字体栈 实测），
  //   版式按实测宽出框；jsdom/无 canvas 环境自动退回估算（纯函数单测仍走估算口径）。
  const measurer = opts.measurer || getCanvasMeasurer();
  const passOpts = { ...opts, ...(measurer ? { measurer } : {}), fitWidth: opts.fitWidth || PRINT_SAFE_WIDTH };
  const doc = new DOMParser().parseFromString(`<div id="__k_root">${src}</div>`, 'text/html');
  const root = doc.getElementById('__k_root');
  if (!root) return { html: src, count: 0, failures: [], warnings: [] };
  const blocks = Array.from(root.querySelectorAll(`.${DIAGRAM_BLOCK_CLASS}`));
  let count = 0;
  const failures = [];
  const warnings = [];
  for (const el of blocks) {
    const parsed = parseDiagramBlock(el.textContent, {
      type: el.getAttribute('data-type') || '',
      layout: el.getAttribute('data-layout') || '',
    });
    if (parsed.error) {
      failures.push(parsed.error);
      continue; // 保留原块：宁可让 JSON 原文露出来，也不能把内容删掉
    }
    try {
      const built = buildFigureElement(parsed.spec, doc, passOpts);
      if (!built) throw new Error('出图返回空');
      // 印刷可读性体检：缩得太狠才告警（见 PRINT_WARN_WIDTH 注释；只超版心几个像素不算问题）
      const warn = printReadabilityWarning(built.width, labelOf(parsed.type));
      if (warn) warnings.push(warn);
      el.parentNode?.replaceChild(built.el, el);
      count++;
    } catch (e) {
      failures.push(`出图失败(${parsed.type})：${e?.message || e}`);
    }
  }
  return { html: root.innerHTML, count, failures, warnings };
};

export default {
  DIAGRAM_BLOCK_CLASS, parseDiagramBlock, renderDiagramBlocks, toResponsiveSvg,
  PRINT_SAFE_WIDTH, PRINT_MIN_SCALE, PRINT_WARN_WIDTH, printReadabilityWarning,
};
