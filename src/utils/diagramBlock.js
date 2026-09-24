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
 * 🔴 安全设计：**没有标记就完全不变**。解析失败（JSON 坏了/图种不认识）时**原样保留**该块
 *    （作者写的 JSON 会当普通文字显示出来，而不是让整篇文章消失），并计入 failures 供上层告警。
 *    这样接入生成链路是零风险的：模型不按约定输出，行为与从前完全一致。
 *
 * 双向通道：产出的内联 SVG 在 PDF（puppeteer）里是矢量、最清晰；
 * Word 导出前由 utils/docxBuilder 的 rasterizeSvgsForExport 光栅化成 PNG。
 * ============================================================
 */
import { buildDiagramSvg, DIAGRAM_TYPES } from './diagrams/index.js';

/** 导图块的标记类名（必须是 class，模型最容易稳定复现） */
export const DIAGRAM_BLOCK_CLASS = 'k-diagram';

/**
 * A4 竖版正文版心宽度（px @96dpi ≈ 794 - 页边距）。导图自然宽度超过它就会被等比缩小，
 * 缩到 ~0.5 时 13px 的字只相当于 4~5pt，印出来看不清 —— 这类"静默变糊"必须自己喊出来。
 * （时间轴、鱼骨图是最容易超宽的两种：横向轴天生宽。）
 */
export const PRINT_SAFE_WIDTH = 760;

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
 * @returns {{ html:string, count:number, failures:string[] }}
 */
export const renderDiagramBlocks = (html, opts = {}) => {
  const src = String(html == null ? '' : html);
  if (!src) return { html: src, count: 0, failures: [] };
  if (typeof DOMParser === 'undefined') {
    return { html: src, count: 0, failures: [] };
  }
  const doc = new DOMParser().parseFromString(`<div id="__k_root">${src}</div>`, 'text/html');
  const root = doc.getElementById('__k_root');
  if (!root) return { html: src, count: 0, failures: [] };
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
      continue; // 🔴 保留原块：宁可让 JSON 原文露出来，也不能把内容删掉
    }
    try {
      const { svg, width, height } = buildDiagramSvg(parsed.spec, opts);
      // 印刷可读性体检：超宽会被缩到看不清（见 PRINT_SAFE_WIDTH 注释）
      if (width > PRINT_SAFE_WIDTH) {
        const ratio = (PRINT_SAFE_WIDTH / width).toFixed(2);
        warnings.push(`${labelOf(parsed.type)} 宽 ${width}px，超出 A4 版心，将缩到 ${ratio} 倍（${(13 * Number(ratio)).toFixed(1)}px ≈ ${(13 * Number(ratio) * 0.75).toFixed(1)}pt 字），印出来可能偏小`);
      }
      const figure = doc.createElement('figure');
      figure.className = 'k-diagram-figure';
      figure.setAttribute('style', 'margin:12px 0;text-align:center;');
      figure.innerHTML = toResponsiveSvg(svg);
      el.parentNode?.replaceChild(figure, el);
      count++;
    } catch (e) {
      failures.push(`出图失败(${parsed.type})：${e?.message || e}`);
    }
  }
  return { html: root.innerHTML, count, failures, warnings };
};

export default { DIAGRAM_BLOCK_CLASS, parseDiagramBlock, renderDiagramBlocks, toResponsiveSvg };
