/**
 * 🎨 导图族共用底座（纯函数）—— 印刷友好 SVG 的统一契约
 * ============================================================
 * 这一族图的共同前提（2026-09-24 用户裁定）：**给学生看的成品资料，要进 PDF/Word、必须印刷友好**。
 *   · PDF 通道 = puppeteer setContent + page.pdf → 内联 SVG 是矢量，缩放/打印不糊；
 *   · Word 通道 = utils/docxBuilder 的 buildImageRun，只认光栅图（**不支持 svg**）
 *     → 由调用方把 SVG 光栅化成 PNG 再塞进 <img src="data:image/png;base64,…">。
 *   两条通道都不引入新依赖。
 *
 * ── 每个图种模块必须遵守的契约（新增图种照抄即可）──────────────────────────────
 * 文件：`src/utils/diagrams/<type>.js`
 *   export const layoutXxx = (spec, opts = {}) => ({ nodes, width, height, metrics })
 *     · nodes 为**已平铺**的节点，坐标为**已归一到正数、已含外边距**的最终像素值；
 *       每个节点至少含 { id, title, x, y, w, h }，可另带 depth/side 等图种专属字段。
 *     · width/height 为**整数**，节点必须全部落在 [0,width]×[0,height] 内。
 *   export const buildXxxSvg = (spec, opts = {}) => ({ svg, width, height, nodes })
 *     · svg 为**不含 DOCTYPE/<?xml>** 的 `<svg …>…</svg>` 字符串，可直接内联进 HTML。
 *   opts 通用字段：{ measurer, labelTransform, palette, fontSize, maxLabelWidth }
 *
 * 印刷约定（所有图种一律遵守，理由：黑白打印时颜色差异会消失）：
 *   · 白底、深灰字、无阴影、无渐变、无外链字体/图片；
 *   · 层级/主次同时用 **线宽 + 字重 + 缩进** 表达，不能只靠颜色；
 *   · 字号不小于 11px；文字必须**不越出所在图形**（靠折行 + 图形宽度按文字实测宽度算）。
 *
 * 🔴 版式质量由单测硬指标守住，不靠肉眼看图（模型侧也看不了图）：不重叠、不越界、
 *    父子对齐、文字不丢(折行后拼接是原标题前缀)。新增图种必须补同口径测试。
 * ============================================================
 */

/** 印刷字体栈：优先系统中文字体，避免外链字体（Word 光栅化时外链会丢） */
export const DEFAULT_FONT = '"Microsoft YaHei","PingFang SC","Source Han Sans SC","Noto Sans CJK SC",sans-serif';

/** 主分支/分类配色（低饱和、明度拉开：黑白打印也能区分） */
export const DEFAULT_PALETTE = ['#2b5ea7', '#1f7a5c', '#b06a1f', '#8a4b8a', '#3d6b8a', '#a04a3d'];

/** 正文墨色与深底 */
export const INK = '#2f3540';
export const HEAD_FILL = '#2b3a4a';
export const PAPER = '#ffffff';

/** XML 文本转义（导图文字里常有 <、>、&、"） */
export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * 文本宽度估算（纯函数里没有 canvas）。
 * CJK/全角按 1em、拉丁数字按 0.56em、其余标点按 0.42em —— 中文场景足够准；
 * 需要像素级精确时注入 `measurer(text, fontSize)`。
 */
export const estimateTextWidth = (text, fontSize, measurer) => {
  if (typeof measurer === 'function') return measurer(text, fontSize);
  let w = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code > 0x2e80) w += 1.0;
    else if (/[A-Za-z0-9]/.test(ch)) w += 0.56;
    else w += 0.42;
  }
  return w * fontSize;
};

/**
 * 按最大宽度折行（CJK 逐字断行；拉丁词尽量整词；最多 maxLines 行，超出加省略号）。
 * 🔴 "是否被截断"的判据必须看**非空白内容**：换行处的行首空格被丢掉是正常排版，
 *    拿含空白的长度比会给出没截断也加"…"的假象（实测踩过）。
 */
export const wrapLabel = (text, maxWidth, fontSize, measurer, maxLines = 3) => {
  const s = String(text == null ? '' : text).trim();
  if (!s) return [''];
  if (estimateTextWidth(s, fontSize, measurer) <= maxWidth) return [s];

  const lines = [];
  let cur = '';
  const flush = () => { if (cur) { lines.push(cur); cur = ''; } };
  const tokens = s.match(/[A-Za-z0-9]+|\s+|[^\sA-Za-z0-9]/g) || [s];
  for (const t of tokens) {
    if (lines.length >= maxLines) break;
    const next = cur + t;
    if (cur && estimateTextWidth(next, fontSize, measurer) > maxWidth) {
      flush();
      if (lines.length >= maxLines) break;
      cur = /^\s+$/.test(t) ? '' : t;
    } else {
      cur = next;
    }
  }
  flush();
  if (lines.length > maxLines) lines.length = maxLines;
  const solid = (v) => v.replace(/\s+/g, '');
  if (solid(lines.join('')).length < solid(s).length) {
    let last = lines[lines.length - 1] || '';
    while (last.length > 1 && estimateTextWidth(last + '…', fontSize, measurer) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = last + '…';
  }
  if (lines.length > maxLines) lines.length = maxLines;
  return lines.length ? lines : [''];
};

/** SVG 开标签（统一字体与渲染精度；白底由调用方决定是否铺满） */
export const svgHeader = (width, height, extraAttrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" `
  + `font-family='${DEFAULT_FONT}' text-rendering="geometricPrecision" shape-rendering="geometricPrecision"${extraAttrs ? ' ' + extraAttrs : ''}>`;

/** SVG 白底（印刷必须有，避免透明底叠到别的底色上） */
export const svgPaper = (width, height) => `<rect x="0" y="0" width="${width}" height="${height}" fill="${PAPER}"/>`;

/**
 * 版式断言用：两个节点框是否重叠（重叠面积 > 0）。
 * 单测共用同一口径，避免每个图种各写一份判定。
 */
export const boxesOverlap = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0;
};

/**
 * 浏览器侧像素级测量器（渲染前调用一次，设置好字体即可）。
 * 纯函数环境（node 单测）不调用它，走 estimateTextWidth 的估算。
 */
export const createCanvasMeasurer = (fontFamily = DEFAULT_FONT) => {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const cache = new Map();
  return (text, fontSize) => {
    const key = fontSize + '\u0000' + text;
    if (cache.has(key)) return cache.get(key);
    ctx.font = `400 ${fontSize}px ${fontFamily}`;
    const w = ctx.measureText(String(text)).width;
    cache.set(key, w);
    return w;
  };
};

/** 把颜色按比例调淡（用于填充色块，避免饱和度过高压过文字） */
export const tint = (hex, ratio) => {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

export default {
  DEFAULT_FONT, DEFAULT_PALETTE, INK, HEAD_FILL, PAPER,
  esc, estimateTextWidth, wrapLabel, svgHeader, svgPaper, boxesOverlap, createCanvasMeasurer, tint,
};
