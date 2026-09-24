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
// [GRAPH] 家族（原属 EduRender Studio，2026-09-24 收回本项目就地渲染）
import { buildCoordinateSvg } from './coordinate.js';
import { buildShapesSvg } from './shapes.js';
import { buildChartsSvg } from './charts.js';

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
  // ── 以下 5 种对应生成模型已在输出的 [GRAPH] 指令块（原由 EduRender Studio 出图，现就地渲染）──
  { value: 'coordinate', label: '坐标系/函数图象', hint: '数轴、函数图象、点（数学高频）' },
  { value: 'shapes', label: '几何与函数图', hint: '函数图象 + 点/线/多边形/圆/角（几何）' },
  { value: 'barChart', label: '柱状图', hint: '统计图：各类别数量对比' },
  { value: 'lineChart', label: '折线图', hint: '统计图：随顺序变化的趋势' },
  { value: 'pieChart', label: '扇形图', hint: '统计图：各部分占比' },
];

const BUILDERS = {
  mindmap: (spec, opts) => buildMindmapSvg(spec.root || spec, opts),
  brace: (spec, opts) => buildBraceSvg(spec, opts),
  flow: (spec, opts) => buildFlowSvg(spec, opts),
  timeline: (spec, opts) => buildTimelineSvg(spec, opts),
  fishbone: (spec, opts) => buildFishboneSvg(spec, opts),
  concept: (spec, opts) => buildConceptSvg(spec, opts),
  coordinate: (spec, opts) => buildCoordinateSvg(spec, opts),
  shapes: (spec, opts) => buildShapesSvg(spec, opts),
  // 三种统计图共用一对导出，模块内按 spec.type 分支
  barChart: (spec, opts) => buildChartsSvg(spec, opts),
  lineChart: (spec, opts) => buildChartsSvg(spec, opts),
  pieChart: (spec, opts) => buildChartsSvg(spec, opts),
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
  // 思维导图的版式从 spec.layout 取（balanced | right），其余图种忽略
  const merged = type === 'mindmap' ? { ...opts, layout: body.layout || opts.layout || 'balanced' } : opts;
  const r = BUILDERS[type](body, merged);
  return { svg: r.svg, width: r.width, height: r.height, nodes: r.nodes || [], type };
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
    // 🔴 必须自带超时：某些环境（如 jsdom、或图片解码静默失败）onload/onerror 都不会触发，
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
