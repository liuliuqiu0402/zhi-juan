/**
 * 📐 `[GRAPH]` 指令块 → 本项目的印刷友好 SVG（收回 EduRender Studio 的那条线）
 * ============================================================
 * 背景（2026-09-24 用户裁定"同意收回"）：
 *   生成模型**早就在输出** `[GRAPH]…[/GRAPH]` 指令块（格式与示例见 config/eduRenderContract.js），
 *   但本项目的做法是把它抽出来让你**复制到 EduRender Studio** 出图，自己的 PDF/Word 里只留一个
 *   "图形占位框"（docxBuilder 有专门一段把指令转成占位文本）。
 *   于是产生两个洞：① 预览里看不到图；② 本项目导出的资料里没有图。
 *
 * 收回成本极低：**指令格式不用重设计、prompt 也不用改**，只要把指令块解析成 diagrams 的 spec、
 * 就地渲染即可（PDF 矢量、Word 自动光栅化）。解析失败一律**原样保留指令块**，绝不丢内容。
 *
 * 支持：COORDINATE / SHAPES / BAR_CHART / LINE_CHART / PIE_CHART。
 * 不做：FORCE / CIRCUIT / OPTICS / ATOM（学科示意图，画错比不画更糟，需学科校验，留 EduRender Studio）。
 * ============================================================
 */
import { buildFigureElement, PRINT_SAFE_WIDTH } from './diagramBlock.js';
import { DIAGRAM_TYPES } from './diagrams/index.js';

/** 指令块颜色名 → 十六进制（[GRAPH] 契约里写的是 red/blue 这类名字，渲染器要十六进制） */
const COLOR_NAMES = {
  red: '#d64541', blue: '#2b5ea7', green: '#1f7a5c', black: '#2f3540', yellow: '#d4a017',
  orange: '#b06a1f', purple: '#8a4b8a', pink: '#c2557a', brown: '#8a5a3b', gray: '#7a8494', grey: '#7a8494',
};
const toColor = (v, fallback) => {
  const s = String(v || '').trim();
  if (!s) return fallback;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  return COLOR_NAMES[s.toLowerCase()] || fallback;
};

const num = (v) => {
  // 🔴 空串必须判为"缺字段"而不是 0：`Number('') === 0` 且有限，
  //    否则 `DATA:` 为空会静默画出"全 0 数据"的图（实测被单测抓到的真 bug）。
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const numPair = (v) => {
  const m = String(v || '').split(',').map((s) => num(s));
  return m.length === 2 && m[0] !== null && m[1] !== null ? m : null;
};
const numList = (v) => String(v || '').split(',').map((s) => num(s));
/** "(1,-4)" → [1,-4] */
const point = (s) => {
  const m = /^\(?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?$/.exec(String(s || '').trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const pointsList = (v) => String(v || '').split(/\)\s*,\s*\(/).map((s) => point(s.replace(/^\(|\)$/g, ''))).filter(Boolean);
/** "表达式 | COLOR:blue | DOMAIN:-3,5" → { 主体, attrs:{COLOR:'blue',…} } */
const splitAttrs = (line) => {
  const parts = String(line || '').split('|').map((s) => s.trim()).filter(Boolean);
  const body = parts.shift() || '';
  const attrs = {};
  for (const p of parts) {
    const i = p.indexOf(':');
    if (i > 0) attrs[p.slice(0, i).trim().toUpperCase()] = p.slice(i + 1).trim();
  }
  return { body, attrs };
};

/**
 * 指令块正文 → `{ KEY: value | [lines] }`。
 * 形如 `SHAPES:` 后面没有值、后续缩进行属于它 → 收成数组。
 */
export const parseGraphDirective = (body) => {
  const kv = {};
  let listKey = null;
  for (const raw of String(body || '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const m = /^\s*([A-Za-z_]+)\s*:\s*(.*)$/.exec(raw);
    if (!m) {
      if (listKey) kv[listKey].push(String(raw).trim());
      continue;
    }
    const key = m[1].trim().toUpperCase();
    const val = m[2].trim();
    if (!val) { listKey = key; kv[key] = []; continue; }
    if (/^\s/.test(raw) && listKey) { kv[listKey].push(String(raw).trim()); continue; }
    listKey = null;
    kv[key] = val;
  }
  return kv;
};

/** 指令块正文 → spec（不认识/缺关键字段时返回 null，由调用方原样保留原文） */
export const graphDirectiveToSpec = (body) => {
  const kv = parseGraphDirective(body);
  const type = String(kv.TYPE || '').trim().toUpperCase();
  const xlim = numPair(kv.XLIM);
  const ylim = numPair(kv.YLIM);
  const common = { xlim: xlim || [-6, 6], ylim: ylim || [-6, 6], grid: String(kv.GRID || '').toUpperCase() === 'TRUE', title: kv.TITLE || '' };

  if (type === 'COORDINATE') {
    const series = (kv.SERIES || []).map((line, i) => {
      const { body: expr, attrs } = splitAttrs(line);
      return { expr, color: toColor(attrs.COLOR, undefined), domain: numPair(attrs.DOMAIN), _i: i };
    }).filter((s) => s.expr);
    const points = (kv.POINTS || []).map((line) => {
      const { body: p, attrs } = splitAttrs(line);
      const xy = point(p);
      return xy ? { x: xy[0], y: xy[1], label: attrs.LABEL, color: toColor(attrs.COLOR, undefined) } : null;
    }).filter(Boolean);
    // 没有 SERIES 也算合法（只要一张空白坐标系也可能是题目要的图）
    return { type: 'coordinate', ...common, series, points };
  }

  if (type === 'SHAPES') {
    const elements = [];
    for (const line of kv.SHAPES || []) {
      const { body: val, attrs } = splitAttrs(line);
      const i = val.indexOf(':');
      if (i < 0) continue;
      const kind = val.slice(0, i).trim().toLowerCase();
      const rest = val.slice(i + 1).trim();
      if (kind === 'function') elements.push({ kind, expr: rest, color: toColor(attrs.COLOR, undefined), domain: numPair(attrs.DOMAIN) });
      else if (kind === 'point') { const xy = point(rest); if (xy) elements.push({ kind, x: xy[0], y: xy[1], label: attrs.LABEL, color: toColor(attrs.COLOR, undefined) }); }
      else if (kind === 'line') elements.push({ kind, points: pointsList(rest), label: attrs.LABEL, color: toColor(attrs.COLOR, undefined) });
      else if (kind === 'polygon') elements.push({ kind, points: pointsList(rest), labels: (attrs.LABELS || '').split(',').map((s) => s.trim()).filter(Boolean), color: toColor(attrs.COLOR, undefined) });
      else if (kind === 'circle') { const c = point(rest); if (c) elements.push({ kind, x: c[0], y: c[1], radius: num(attrs.RADIUS) ?? 1, color: toColor(attrs.COLOR, undefined) }); }
      else if (kind === 'angle') { const ps = pointsList(rest); if (ps.length === 3) elements.push({ kind, vertex: ps[1], a: ps[0], b: ps[2], label: attrs.LABEL, color: toColor(attrs.COLOR, undefined) }); }
    }
    if (!elements.length) return null;
    return { type: 'shapes', ...common, elements };
  }

  if (type === 'BAR_CHART' || type === 'LINE_CHART' || type === 'PIE_CHART') {
    const data = numList(kv.DATA).filter((n) => n !== null);
    if (!data.length) return null;
    const labels = String(kv.LABELS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const colors = String(kv.COLORS || '').split(',').map((s) => toColor(s, '')).filter(Boolean);
    const t = { BAR_CHART: 'barChart', LINE_CHART: 'lineChart', PIE_CHART: 'pieChart' }[type];
    return { type: t, data, labels, colors: colors.length ? colors : undefined, title: kv.TITLE || '', xlabel: kv.XLABEL || '', ylabel: kv.YLABEL || '' };
  }

  return null;
};

const labelOf = (type) => (DIAGRAM_TYPES.find((d) => d.value === type)?.label || type);

/**
 * 把正文里所有 `[GRAPH]…[/GRAPH]` 就地渲染成 figure（与导图同一约定：figure + data-k-spec）。
 * 解析失败/不支持的 TYPE → **原样保留指令文本**（绝不丢内容），只记 failures。
 */
export const renderGraphBlocks = (html, opts = {}) => {
  const src = String(html == null ? '' : html);
  if (!src || !/\[GRAPH\]/i.test(src)) return { html: src, count: 0, failures: [], warnings: [] };
  if (typeof DOMParser === 'undefined') return { html: src, count: 0, failures: [], warnings: [] };

  const doc = new DOMParser().parseFromString('<div id="__g_root"></div>', 'text/html');
  let count = 0;
  const failures = [];
  const warnings = [];

  const out = src.replace(/\[GRAPH\]([\s\S]*?)\[\/GRAPH\]/gi, (whole, body) => {
    const spec = graphDirectiveToSpec(body);
    if (!spec) {
      const t = /TYPE\s*:\s*([A-Za-z_]+)/i.exec(body);
      failures.push(`不支持的图形类型或字段不全：${t ? t[1] : '未标 TYPE'}（已原样保留指令文本）`);
      return whole;
    }
    try {
      const built = buildFigureElement(spec, doc, opts);
      if (!built) throw new Error('出图返回空');
      if (built.width > PRINT_SAFE_WIDTH) {
        warnings.push(`${labelOf(spec.type)} 宽 ${built.width}px，超出 A4 版心，将缩到 ${(PRINT_SAFE_WIDTH / built.width).toFixed(2)} 倍，印出来可能偏小`);
      }
      count++;
      return built.el.outerHTML;
    } catch (e) {
      failures.push(`出图失败(${spec.type})：${e?.message || e}`);
      return whole;
    }
  });

  return { html: out, count, failures, warnings };
};

export default { parseGraphDirective, graphDirectiveToSpec, renderGraphBlocks };
