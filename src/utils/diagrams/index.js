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

/** 思维导图的两种版式（UI 里作为二级选择） */
export const MINDMAP_LAYOUTS = [
  { value: 'balanced', label: '左右分布', hint: '根居中、分支左右铺开，最像"思维导图"' },
  { value: 'right', label: '向右生长', hint: '根在左、逐级向右，纵向更长、适合窄栏' },
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
  // 🔴 2026-10-23（属主："左右分布、还是单独往右，这个不人为定，交由模型按内容定，可以吗？"）：
  //   **版式是内容判断，归模型**——`data-layout` / `spec.layout` 由模型按内容选，程序默认照办；
  //   程序只在两种情况下接手：①模型没写版式（此时按"哪种版式折行更少"自动选）；②模型选的版式会把
  //   标签压成窄柱（折行宽 < 100px ≈ 一行不足 7 个字），而另一版式能放宽 1.6 倍以上——这才兜底换版式。
  //   折行与版式**解耦**：版式决定"宽往哪儿长"，折行宽仍按 643 版心自动算（一行放得下就不折）。
  const specifiedLayout = type === 'mindmap' ? String(body.layout || opts.layout || '') : '';
  // 思维导图的版式从 spec.layout 取（balanced | right），其余图种忽略
  // 🔴 2026-10-30（属主："导图改为右支后，为啥导图框不是按照内容自适应的"）：
  //   默认值回到 balanced（与"模型没写版式时按折行择优"配套）；不再把 right 写死成默认——
  //   写死会让宽扁的浅树也被拉成长条阶梯，看起来"框的宽高不跟内容走"。
  const merged = type === 'mindmap' ? { ...opts, layout: specifiedLayout || 'balanced' } : opts;
  let r = BUILDERS[type](body, merged);
  // 🔴 2026-10-22（属主："按 A4 尺寸排版"·取 643 版心）：**先排版、再整体缩放**会让字号跟着变小。
  //   这里加一步"**按版心宽度重排**"：宽了先收窄折行宽度（maxLabelWidth）再排，最多 8 轮，字号保持不变；
  //   若仍放不下（balanced 是"以根为中轴、按较宽一侧×2 算画布"，深树必然超宽），
  //   **改用向右生长（right）**再排一次——宽度不再翻倍；实在收不下（如时间轴按条数排）则保持原样，
  //   交给导出侧等比收敛并告警。
  const fit = Number(merged.fitWidth) || 0;
  /** 实际采用的版式（模型指定的优先；未指定或触发可读性兜底时才会与入参不同） */
  let layoutUsed = merged.layout;
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
      const hiCap = Math.max(start, Math.min(260, Math.round(fit * 0.38)));
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
    const primary = narrowTo(merged);
    // 🔴 2026-10-23（属主真机："有的根本不需要换行而换行了…看着很乱很长"·根因）：
    //   左右分布把宽度**按两侧各算一次**（画布 = 较宽一侧 ×2），所以深一点的树会被迫把折行宽一路压到 56，
    //   自然宽 100–170 的标签全被折成 2–5 行（实测框宽 89、最长那条 5 行）；同一内容换成"向右生长"只用一次
    //   版心宽，折行宽能取到 244、**全部保持一行**。
    //   处置分两档（见上方 specifiedLayout 的口径）：模型没写版式才按"折行更少"自动选；写了就以它为准，
    //   只有当它把一行压到不足 ~5 个字、而另一版式能放宽一倍以上时，才兜底换（这是"可读性下限"，不是改观感）。
    // 🔴 2026-10-30（属主："导图改为右支后，为啥导图框不是按照内容自适应的"）：
    //   原阈值（不足 100px ≈ 7.7 字/行 就换版式）**几乎对每份内容都成立** ⇒ 模型写 balanced 也会被
    //   程序悄悄改成 right（实证：典型知识树恒出 `layout=right`）。版式是**内容判断**，归模型；
    //   程序只保留"改到还能读"的**可读性下限**：一行不足 ~5 字（<72px）且另一版式能放宽一倍以上，才接手。
    const WRAP_READABLE_FLOOR = 72;
    let best = primary;
    if (type === 'mindmap') {
      const altLayout = merged.layout === 'right' ? 'balanced' : 'right';
      const alt = narrowTo({ ...merged, layout: altLayout });
      const altFits = alt.width <= fit;
      if (!specifiedLayout) {
        // 模型没写版式：按"哪种折行更少"自动择一（这才是"按内容自适应"）
        if (altFits && alt.__wrap >= primary.__wrap * 1.25) { best = alt; layoutUsed = altLayout; }
      } else if (altFits && (primary.width > fit
        || (primary.__wrap < WRAP_READABLE_FLOOR && alt.__wrap >= primary.__wrap * 2))) {
        // 只有两件事值得接手：①这条版式**真的装不进版心**（客观溢出）；②一行被压到读不成句（<~5 字）。
        best = alt;
        layoutUsed = altLayout;
      }
    }
    r = best;
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
