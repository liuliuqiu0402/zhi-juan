/**
 * 🧭 导图族统一入口
 * ============================================================
 * 对外只暴露三件事：
 *   DIAGRAM_TYPES      —— UI 用的图种清单（含思维导图的两种版式）
 *   buildDiagramSvg    —— `spec` → `{ svg, width, height, nodes, type }`
 *   diagramToPngDataUrl—— 浏览器侧把 SVG 光栅化成 PNG dataURL（**Word 通道专用**）
 *
 * 为什么要光栅化：PDF 走 puppeteer，内联 SVG 是矢量、最清晰；Word 走
 * utils/docxBuilder 的 ImageRun，**只认光栅图**（不支持 svg），所以 Word 前必须先转 PNG。
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
  let r = BUILDERS[type](body, merged);
  const layoutUsed = merged.layout;
  // 🔴 2026-10-22（属主："按 A4 尺寸排版"）：**先排版、再整体缩放**会让字号跟着变小。
  //   这里加一步"**按版心宽度重排**"：宽了只收窄折行宽度（maxLabelWidth）再排，字号保持不变。
  const fit = Number(merged.fitWidth) || 0;
  if (fit) {
    // 🔴 2026-10-22（属主："框的长短应该根据实际内容和 A4 尺寸来""一行不够才换行吧？"）：
    //   折行宽度的判据从"写死 150px"改成"**A4 版心允许多宽就用多宽**"——
    //   在 [56, 版心×0.38] 区间上**二分**，取"仍能装进版心"的最宽值：
    //     · 一行放得下 ⇒ 不折行（少折行、少空高）；
    //     · 版心装不下 ⇒ 收到刚好装得下（不缩字号，只调折行宽度）。
    //   原实现只在"已超宽"时才 ×0.85 硬收窄，既收过头（120 够用会收到 87），也从不肯放宽到 150 以上。
    /** 二分：返回"整幅仍 ≤ 版心"的最宽折行宽那一版；`__wrap` 只为下面比较用，不外传 */
    const narrowTo = (o) => {
      const start = Number(o.maxLabelWidth) || 150;
      // 🔴 2026-10-30（属主："要的是导图框随内容的长短自适应的，超过 A4 版面的时候才换行"）：
      //   原上限是"版心 × 0.38 ≈ 244"——30 字以内的标签才 260px，明明一行放得下也被折成两行
      //   （实测 22 字标签 286px 被折成 2 行、框宽被统一压到 244+padding，看着"长宽都一样"）。
      //   现把上限放到**整幅版心**，仍由二分自己收敛（排完整幅 ≤ 版心）：只有真超过版心才折行。
      //   版心宽度由调用方按**纸张/栏宽**传入（fitWidth），不再写死成某个像素常数。
      const hiCap = Math.max(start, Math.round(fit));
      let lo = 56;
      let hi = hiCap;
      let best = null;
      while (lo <= hi) {
        const mid = Math.round((lo + hi) / 2);
        const cur = BUILDERS[type](body, { ...o, maxLabelWidth: mid });
        if (cur.width <= fit) { best = { ...cur, __wrap: mid }; lo = mid + 1; } else { hi = mid - 1; }
      }
      // 二分假设"越窄越窄"；个别图种（按条数排的时间轴）不单调 → 兜底再试一次最小宽度，仍超宽就交给导出侧。
      return best || { ...BUILDERS[type](body, { ...o, maxLabelWidth: 56 }), __wrap: 56 };
    };
    // 只有一种版式（向右生长），不存在"换另一种版式"的兜底：整幅仍超版心时只收折行宽，字号不变。
    r = narrowTo(merged);
  }
  return {
    svg: r.svg, width: r.width, height: r.height, nodes: r.nodes || [], type,
    // 版式只对思维导图有意义：回传实际采用值，便于调用方留痕/单测断言（其余图种不带该字段）
    ...(type === 'mindmap' ? { layout: layoutUsed } : {}),
  };
};

/**
 * SVG → PNG dataURL（**Word 通道专用**）。
 * · 放大 `scale` 倍再采样，保证 Word 里贴进去打印不发虚（默认 2 倍）；
 * · 先垫白底：SVG 透明底在 Word 里可能被当成黑色背景；
 * · 非浏览器环境（node 单测）返回 null，调用方自行降级（如直接跳过插图）。
 */
export const diagramToPngDataUrl = (svg, { scale = 2, background = '#ffffff', timeoutMs = 4000 } = {}) => {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve(null);
  const m = /<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"[^>]*\bheight="(\d+(?:\.\d+)?)"/.exec(String(svg));
  const w = m ? Number(m[1]) : 800;
  const h = m ? Number(m[2]) : 600;
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
        cv.width = Math.max(1, Math.round(w * scale));
        cv.height = Math.max(1, Math.round(h * scale));
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

export default { DIAGRAM_TYPES, MINDMAP_LAYOUTS, buildDiagramSvg, diagramToPngDataUrl };
