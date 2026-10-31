/**
 * 🧭 导图族统一入口
 * ============================================================
 * 对外只暴露三件事：
 *   DIAGRAM_TYPES      —— UI 用的图种清单（含思维导图的两种版式）
 *   buildDiagramSvg    —— `spec` → `{ svg, width, height, nodes, type }`
 *   diagramToPngDataUrl—— 浏览器侧把 SVG 光栅化成 PNG dataURL（**Word 通道专用**）
 *
 * 为什么要光栅化：PDF 走 puppeteer，内联 SVG 是矢量、最清晰；Word 走
 * utils/docxBuilder 的 ImageRun —— 矢量源以 asvg:svgBlip 内嵌（Word 2016+ 原生矢量渲染），
 * 这里生成的 300dpi PNG 只作为老版本/不认 SVG 的阅读器的回退图。
 * 两条通道都不新增依赖（canvas 光栅化在本仓库已有用法）。
 * ============================================================
 */
import { buildMindmapSvg, layoutMindmap } from './mindmap.js';
import { buildBraceSvg } from './brace.js';
import { buildFlowSvg } from './flow.js';
import { buildTimelineSvg } from './timeline.js';
import { buildFishboneSvg } from './fishbone.js';
import { buildConceptSvg } from './concept.js';

/** 思维导图版式（🔴 2026-10-30 属主定："左右两支这种可否取消？都用右支"）——只保留向右生长 */
export const MINDMAP_LAYOUTS = [
  { value: 'right', label: '向右生长', hint: '根在左、逐级向右（唯一版式；左右分布已取消）' },
];

/** 图种清单（value 与 spec.type 一致） */
export const DIAGRAM_TYPES = [
  { value: 'mindmap', label: '思维导图', hint: '知识梳理、概念层级（可选左右分布 / 向右生长）' },
  { value: 'brace', label: '括号图', hint: '整体与部分拆解（整体 → 括号 → 各部分）' },
  { value: 'flow', label: '流程图', hint: '步骤与判定分支（开始/处理/判定/结束）' },
  { value: 'timeline', label: '时间轴', hint: '按时间或先后顺序展开的事件' },
  { value: 'fishbone', label: '鱼骨图', hint: '因果分析（结果 ← 各类原因）' },
  { value: 'concept', label: '概念关系图', hint: '带关系标注的网络图（概念 + 关系）' },
];

const BUILDERS = {
  mindmap: (spec, opts) => buildMindmapSvg(spec.root || spec, opts),
  brace: (spec, opts) => buildBraceSvg(spec, opts),
  flow: (spec, opts) => buildFlowSvg(spec, opts),
  timeline: (spec, opts) => buildTimelineSvg(spec, opts),
  fishbone: (spec, opts) => buildFishboneSvg(spec, opts),
  concept: (spec, opts) => buildConceptSvg(spec, opts),
};

/** 供单测/调试直接取版式几何（不出图） */
export const LAYOUTS = {
  mindmap: (spec, opts) => layoutMindmap(spec.root || spec, opts),
};

/**
 * 结构化数据 → 印刷友好 SVG。
 * @param {{type:string}} spec 至少含 type；未知/缺失类型回落思维导图（宁可有图，不可空着）
 * @returns {{svg:string,width:number,height:number,nodes:Array,type:string}}
 */
export const buildDiagramSvg = (spec, opts = {}) => {
  const type = spec && BUILDERS[spec.type] ? spec.type : 'mindmap';
  const body = spec || {};
  // 🔴 2026-10-30（属主定："左右两支这种可否取消？都用右支"）：
  //   **思维导图统一向右生长**——不再有"左右分布"。历史内容里写了 `data-layout="balanced"` 的也一律按 right 出图，
  //   这样同一份资料里不会出现"一边长一边短"的左右两支，也保证老记录重画后版式一致。
  //   （`layoutMindmap` 仍保留 balanced 分支，仅作旧规格兼容，生产入口不再选它。）
  const merged = type === 'mindmap' ? { ...opts, layout: 'right' } : opts;
  // 🔴 2026-10-30（属主："不要弄人为的计算那么繁琐，交给内容本身；框只是加在内容上的"）：
  //   **删掉"按版心二分折行宽"那一层**。折行交给排版本身：思维导图的每个节点按"这一支还剩多少宽"折行
  //   （见 mindmap.prep 的 usedW），其余图种各自按 fitWidth 处理；总装层只把栏宽传下去，不再反复试排。
  //   这样：文字放得下就一行、框宽=文字宽；只有真挤到版心边界才折——没有"274px""160px"这类人为阈值。
  const r0 = BUILDERS[type](body, merged);
  const layoutUsed = merged.layout;
  // 🔴 2026-10-30（属主："从最左侧的开始让，依次往右…而且要注意到排版的美观"）：
  //   让位口径有两种，都排一遍取**更矮**的那个（矮 = 图更紧凑，就是"美观"的可量化代理）：
  //     · 'left'（默认）：最左侧先让 ⇒ 右侧框更宽、叶子散开（4 层链实测高 187px，等比口径 223px）；
  //     · 'proportional'：按自然宽等比 ⇒ 每个框行数均匀（5 层长链实测 88px，左先让 100px）。
  //   一样高时保留 'left'（叶子更舒展、右侧不吃亏）。
  const fit = Number(merged.fitWidth) || 0;
  let r = r0;
  let shareUsed = 'left';
  if (type === 'mindmap' && fit) {
    const alt = BUILDERS[type](body, { ...merged, fairShare: 'proportional' });
    if (alt.height < r0.height) { r = alt; shareUsed = 'proportional'; }
  }
  // 🔴 2026-10-30（属主："超过 A4 版面的时候才换行"／浏览器对账实测）：
  //   超出量在 **12px 容差内**不算"超版心"——浏览器排版也不会为 2px 折行
  //   （对账实测：分数树自然 645px，被折了两个本来一行放得下的长标签）。
  // 🔴 2026-10-30（属主："左先让了，紧接着的第二层叶子为啥不让，就直接用第三层叶子让了？"·根因）：
  //   原来真超版心时用 `wrapFactor` **把所有节点的折行宽一起乘一个系数**——那是一把梭：
  //   它会把已经让到"2 行下限"的框继续压到 3 行，于是出现"该让的没让、不该折的折了"
  //   （实测 4 层链：root/一级本应 2 行，被压到 3 行）。
  //   现改为：**把版心按超出量收一收，让分配器自己按原口径重排**（左先让/等比各自照旧），
  //   这样"谁让、让到几行"始终由同一套规则决定，不会再多出一个全局暗改。
  if (fit && r.width > fit + 12) {
    for (let i = 0; i < 4 && r.width > fit; i += 1) {
      const target = Math.max(280, fit - (r.width - fit) - 4);
      r = BUILDERS[type](body, {
        ...merged,
        fitWidth: target,
        ...(shareUsed === 'proportional' ? { fairShare: 'proportional' } : {}),
      });
    }
  }
  return {
    svg: r.svg, width: r.width, height: r.height, nodes: r.nodes || [], type,
    // 版式只对思维导图有意义：回传实际采用值，便于调用方留痕/单测断言（其余图种不带该字段）
    ...(type === 'mindmap' ? { layout: layoutUsed } : {}),
  };
};

/**
 * 思维导图**按一级分支分页**（规格 → 若干页规格；不改字号、不缩图、不切断框与连线）。
 * ============================================================
 * 为什么需要（2026-10-31 属主："一张 A4 纸放不下怎么办？如何分页显示？"）：
 *   Word 的行内图片不能跨页、PDF 里 figure 又设了 page-break-inside:avoid —— 一幅超高导图
 *   要么整块溢出纸外被裁、要么被迫缩字号（属主明确"不要缩小字体"）。所以只能在**结构层**拆：
 *   每一页都重画根节点，只带这一页放得下的若干一级分支；单支自己就超高时，把该支升为这一页的"根"，
 *   继续按它的子级拆 —— 拆分点永远在分支之间，框和连线不会被打断。
 *
 * @param {object} spec 导图规格（含 root）
 * @param {object} opts 与出图同口径：fitWidth / fontSize / measurer；maxHeightPx = 单页可容纳高度
 * @returns {Array<object>} 页规格数组；不需要分页时返回 `[spec]`
 */
export const paginateMindmapSpec = (spec, opts = {}) => {
  const maxH = Number(opts.maxHeightPx) > 0 ? Number(opts.maxHeightPx) : 0;
  const root = spec && (spec.root || spec);
  if (!maxH || !root || typeof root !== 'object') return [spec];
  const buildOpts = { ...opts };
  delete buildOpts.maxHeightPx;
  if (Number(buildOpts.fontSize) > 0) {
    buildOpts.rootFontSize = Math.round((Number(buildOpts.fontSize) * 15) / 13);
  }
  const heightOf = (s) => buildDiagramSvg(s, buildOpts).height;
  if (heightOf(spec) <= maxH) return [spec];

  const baseSpec = spec;
  const pages = [];
  // 一页 = 根 → （中间单链祖先）→ 拆分节点 → 本页分到的若干分支
  const pageOf = (node, ancestors, group) => {
    if (node === root) return { ...baseSpec, root: { ...root, children: group } };
    let built = { ...node, children: group };
    for (let i = ancestors.length - 1; i >= 0; i -= 1) built = { ...ancestors[i], children: [built] };
    return { ...baseSpec, root: { ...root, children: [built] } };
  };
  const emitGroups = (node, ancestors, depth) => {
    const kids = node.children || [];
    if (!kids.length) { pages.push(pageOf(node, ancestors, [])); return; }
    let group = [];
    for (const kid of kids) {
      const trial = [...group, kid];
      if (heightOf(pageOf(node, ancestors, trial)) <= maxH) { group = trial; continue; }
      if (group.length) { pages.push(pageOf(node, ancestors, group)); group = []; }
      const solo = pageOf(node, ancestors, [kid]);
      if (heightOf(solo) <= maxH || depth > 16 || !(kid.children && kid.children.length)) {
        group = [kid];
      } else {
        // 这一支单独仍超高 ⇒ 把它升为本页的"根"，按它的子级继续拆（拆分点仍在分支之间）
        emitGroups(kid, [...ancestors, ...(node === root ? [] : [node])], depth + 1);
      }
    }
    if (group.length) pages.push(pageOf(node, ancestors, group));
  };
  emitGroups(root, [], 0);
  return pages.length ? pages : [spec];
};

/**
 * 印刷采样倍率：屏幕 96dpi → 印刷 300dpi，倍率 300/96 ≈ 3.125。
 * 🔴 2026-10-31（属主："导出来的导图和导图中的字看着有点模糊"·根因）：
 *   原固定 2 倍 ≈ 192dpi，低于印刷 300dpi 标准，Word 里贴的图先天发虚。
 */
export const PRINT_RASTER_SCALE = 300 / 96;

/** 光栅化画布上限（防超高图把内存撑爆；超限时按比例降倍率，仍远高于 200dpi） */
const MAX_RASTER_SIDE = 8192;
const MAX_RASTER_PIXELS = 16000000;

/**
 * SVG → PNG dataURL（**Word 通道专用**）。
 * · 默认按 300dpi 采样（3.125 倍），Word 里贴进去打印不发虚；画布超上限时自动降倍率；
 * · 先垫白底：SVG 透明底在 Word 里可能被当成黑色背景；
 * · 非浏览器环境（node 单测）返回 null，调用方自行降级（如直接跳过插图）。
 */
export const diagramToPngDataUrl = (svg, { scale = PRINT_RASTER_SCALE, background = '#ffffff', timeoutMs = 4000 } = {}) => {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve(null);
  const m = /<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"[^>]*\bheight="(\d+(?:\.\d+)?)"/.exec(String(svg));
  const w = m ? Number(m[1]) : 800;
  const h = m ? Number(m[2]) : 600;
  const s = Math.max(1, Math.min(
    Number(scale) > 0 ? Number(scale) : PRINT_RASTER_SCALE,
    MAX_RASTER_SIDE / Math.max(1, w),
    MAX_RASTER_SIDE / Math.max(1, h),
    Math.sqrt(MAX_RASTER_PIXELS / Math.max(1, w * h)),
  ));
  return new Promise((resolve) => {
    // 必须自带超时：某些环境（如 jsdom、或图片解码静默失败）onload/onerror 都不会触发，
    //    没有超时就会把导出流程**无限挂住**（比"插图失败"糟得多）。
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try {
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w * s));
        cv.height = Math.max(1, Math.round(h * s));
        const ctx = cv.getContext('2d');
        if (!ctx) return finish(null);
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        finish(cv.toDataURL('image/png'));
      } catch {
        finish(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); finish(null); };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(String(svg))}`;
  });
};

export default { DIAGRAM_TYPES, MINDMAP_LAYOUTS, buildDiagramSvg, paginateMindmapSpec, diagramToPngDataUrl };
