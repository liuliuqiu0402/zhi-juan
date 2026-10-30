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
 * 版式质量由单测硬指标守住，不靠肉眼看图（模型侧也看不了图）：不重叠、不越界、
 *    父子对齐、文字不丢(折行后拼接是原标题前缀)。新增图种必须补同口径测试。
 * ============================================================
 */

/** 印刷字体栈：优先系统中文字体，避免外链字体（Word 光栅化时外链会丢）
 *  2026-10-22（属主："❌️ 这种符号输入法能输入，目前是支持的吧？"）：尾部补**表情符号字体回退**——
 *  中文正文字体（雅黑/苹方/思源）都没有 emoji 字形，不显式回退就只能靠浏览器的最后兜底，
 *  不同环境（浏览器 / PDF / Word 光栅化）取到的字形与宽度会不一致。 */
export const DEFAULT_FONT = '"Microsoft YaHei","PingFang SC","Source Han Sans SC","Noto Sans CJK SC","Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

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
/** 估算口径的**保守系数**：真实字宽会因字重、字体回退、hinting 略大于按类别估算的值
 *  （2026-10-22 属主连续两轮反馈"还有字在框外"）⇒ 估算一律放大 4%，宁可略宽也不越框。
 *  浏览器里有 canvas 实测 measurer（见 utils/diagramBlock.js）时走实测，不吃这个系数。 */
const SAFETY_K = 1.04;

/**
 * 零宽字符：**真实不占宽**，原估算却因"码点 > 0x2E80 即 1em"给了整字宽
 *   ⇒ `❌️`（U+274C + 变体选择符 U+FE0F）被算成两个字宽，框凭空长一截、还提前折行。
 */
const ZERO_WIDTH = new Set([0xfe0f, 0xfe0e, 0x200d, 0x20e3]);

/**
 * 符号/表情区（箭头、杂项符号、带圈数字、几何图形、装饰符号、表情块）：
 *   真实宽度约 1em，原估算落到"其他标点 0.42em" ⇒ BMP 里的 `❌ ✅ ⚠ ★` 被算不到一半宽 ⇒ **字出框**。
 *   2026-10-22（属主："❌️ 这种符号输入法能输入的，目前是支持的吧？"）：这是让"符号前缀"能用的前提。
 */
const SYMBOL_RE = /[\u2190-\u21FF\u2300-\u23FF\u2460-\u24FF\u25A0-\u27BF\u2900-\u297F\u2B00-\u2BFF]|[\u{1F000}-\u{1FAFF}]/u;

export const estimateTextWidth = (text, fontSize, measurer) => {
  if (typeof measurer === 'function') return measurer(text, fontSize);
  let w = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (ZERO_WIDTH.has(code)) continue;
    if (SYMBOL_RE.test(ch)) w += 1.02;
    else if (code > 0x2e80) w += 1.0;
    // 🔴 2026-10-22（属主真机："有的字出导图框了"）：数字/小写按 0.56em 够用，但**大写字母**
    //   （W/M/O…）实际接近 0.7em ⇒ 原值会把含大写的标签算窄、字冲出框。大写字重更宽，单列一档。
    else if (/[A-Z]/.test(ch)) w += 0.66;
    else if (/[a-z0-9]/.test(ch)) w += 0.56;
    else w += 0.42;
  }
  return w * fontSize * SAFETY_K;
};

/**
 * 按最大宽度折行（CJK 逐字断行；拉丁词尽量整词；最多 maxLines 行，超出加省略号）。
 * "是否被截断"的判据必须看**非空白内容**：换行处的行首空格被丢掉是正常排版，
 *    拿含空白的长度比会给出没截断也加"…"的假象（实测踩过）。
 *
 * 🔴 2026-10-30（属主："折行考虑内容折行后的美观性…比如《古诗词三首》不能折成《古诗词三首/》"）：
 *   加了**中文避头尾（禁则）**——折行除了"放不放得下"，还要看断点是不是个体面的位置：
 *     · 行首禁则：收尾标点/右括号（。，、；：！？）》」』】〕）’”…—～ 等）不许另起一行，
 *       宁可让上一行多出这一个字（悬挂标点），否则就会出现"《古诗词三首"换行后孤零零一个"》"。
 *     · 行尾禁则：开引号/开括号（《（「『【〔〈“‘ 等）不许留在行末，遇到就把它挪到下一行开头。
 *   这两条只在**真的要折行**时生效，不影响"放得下一行就不折"。
 */
const CLOSING_RE = /^[》」』】〕）〉”’！？。，、；：…—～·%‰,.;:?!)\]}]$/;
const OPENING_RE = /[《（「『【〔〈“‘(\[{]$/;

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
      // ① 行首禁则：该断点后是个"收尾标点/右括号"→ 宁可悬挂在上一行末，也不让它单独成行
      if (CLOSING_RE.test(t)) {
        cur = next;
        continue;
      }
      // ② 行尾禁则：上一行以"开引号/开括号"结尾 → 把它带到下一行开头（不留半个书名号在行尾）
      if (OPENING_RE.test(cur)) {
        const carry = cur.slice(-1);
        cur = cur.slice(0, -1);
        flush();
        if (lines.length >= maxLines) break;
        cur = carry + (/^\s+$/.test(t) ? '' : t);
        continue;
      }
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

/**
 * 折行行数预算：**按内容量给够**，保证长标签不被省略号截断。
 * 2026-10-22 属主："导图内容为什么会有换行显示不全的啊？用省略号形式了，但是内容又是全的"——
 *   `wrapLabel` 的默认上限 3 行是为了"框别长成柱子"，但它对**知识要点这种本来就长**的短语是错的：
 *   第 4 行起被砍掉、末尾补 `…`，于是所有长标签都恰好 3 行高 ⇒ 顺带把"框长短/高度都一样"也做了出来。
 *   口径改为：**宽度可以封顶（A4 版心约束），行数不封顶**——长内容变高，不变残缺。
 *   （fishbone／timeline 早就是这个口径，本函数把它们各自私有的 lineBudget 提上来单源化。）
 */
export const lineBudget = (text, maxWidth, fontSize, measurer) =>
  Math.max(3, Math.ceil(estimateTextWidth(String(text == null ? '' : text), fontSize, measurer) / Math.max(1, maxWidth)) + 2);

/** 颜色值校验：只接受 3/6 位十六进制（防把任意串塞进 SVG 属性；非法一律返回 '' 走默认色） */
export const normalizeHex = (v) => {
  const s = String(v == null ? '' : v).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase();
  return '';
};

/**
 * 节点字重（导图族统一）：**加粗（bold:true）= 700**；否则按层级 600/500/400。
 * 字重必须在这里定一次——框宽余量、折行宽度、SVG 属性三处都要用同一值（各判一次就会再次"字出框"）。
 */
export const nodeWeight = (raw, depth, isRoot) =>
  (raw && raw.bold ? 700 : (isRoot ? 600 : (depth === 1 ? 500 : 400)));

/** 字重 → 无实测 measurer 时的框宽余量系数（700 比 600 更宽，单列一档） */
export const weightPadK = (weight, exact) => {
  if (exact) return 1;
  if (weight >= 700) return 1.14;
  if (weight >= 600) return 1.10;
  if (weight >= 500) return 1.07;
  return 1.04;
};

/* ==================== 节点级样式（2026-10-22 属主："节点字号与局部加粗可以做"）====================
 * 规格里节点可带：`fs`（字号）、`**…**`（**局部加粗**，只加粗被包住的字）、`w`/`h`（手动最小宽高）。
 * 三条都遵守同一底线：**任何样式都不能让字出框、不能让字被裁**——
 *   · `w` 只是"最小宽"：真宽 = max(内容宽, 手动宽)，所以缩不小、也就裁不到字；
 *   · `h` 只是"最小高"：内容多高就多高，富余高度用来上下居中（不是压缩行距）。
 * ==================== */

/** 字号合法区间（印刷下限 11px；上限 24px，再大就不是导图而是标题了） */
export const MIN_NODE_FONT = 11;
export const MAX_NODE_FONT = 24;

const numOr = (v, lo, hi) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

/** 节点字号：非法/空/缺省 → null（走层级默认：根 rootFontSize、其余 fontSize）
 *  ⚠️ 空串必须判空：`Number('') === 0` 会被夹到下限 11，清空就变成了"设成 11px"。 */
export const normNodeFont = (v) => (v === '' || v == null ? null : numOr(v, MIN_NODE_FONT, MAX_NODE_FONT));

/** 手动最小框宽（px）：低于 40 没意义，高于 600 一框就占半页 */
export const normNodeMinW = (v) => (v === '' || v == null ? null : numOr(v, 40, 600));

/** 手动最小框高（px） */
export const normNodeMinH = (v) => (v === '' || v == null ? null : numOr(v, 24, 800));

/**
 * 行内样式解析（**局部加粗** ＋ **局部改色**）：
 *   · `**粗**`                  → 该段 700 字重
 *   · `{{红:文字}}` / `{{#c00000:文字}}` → 该段换色（红橙绿蓝紫灰金 或十六进制）
 *   两者可以套：`{{红:**重点**}}`（先按色切段，段内再按 `**` 切）。
 * 只用成对的标记；**不成对的 `**` / `{{` 原样保留**（数学里的 `3**2`、正文里的花括号不会被误吃）。
 * 为什么先摊成"逐字掩码"：折行是按纯文本算的，渲染却要按"每个字粗不粗、什么颜色"切成若干段——
 *   先摊平，折行后再按字符回填（见 mindmap 的 lineRuns）。
 */
export const BOLD_SPAN_RE = /\*\*([^*\n]{1,40})\*\*/g;

/** 可用的具名颜色（低饱和、黑白打印也能区分深浅；与导图分支色同族） */
export const NAMED_COLORS = {
  红: '#c0392b', 橙: '#b06a1f', 绿: '#1f7a5c', 蓝: '#2b5ea7',
  紫: '#8a4b8a', 灰: '#6b7280', 金: '#a67c00',
};

/** 行内改色标记：`{{红:…}}` 或 `{{#rrggbb:…}}`（花括号在教学内容里几乎不出现，且必须成对） */
export const COLOR_SPAN_RE = /\{\{(#[0-9a-fA-F]{3,6}|[红橙绿蓝紫灰金]):([^{}\n]{1,40})\}\}/g;

/** 段内再解析 `**粗**` */
const pushBoldSeg = (seg, color, plain, bold, colors) => {
  BOLD_SPAN_RE.lastIndex = 0;
  let last = 0;
  let m;
  while ((m = BOLD_SPAN_RE.exec(seg))) {
    for (const ch of seg.slice(last, m.index)) { plain.push(ch); bold.push(false); colors.push(color); }
    for (const ch of m[1]) { plain.push(ch); bold.push(true); colors.push(color); }
    last = m.index + m[0].length;
  }
  for (const ch of seg.slice(last)) { plain.push(ch); bold.push(false); colors.push(color); }
};

export const parseInlineStyles = (text) => {
  const src = String(text == null ? '' : text);
  const plain = [];
  const bold = [];
  const colors = [];
  let last = 0;
  COLOR_SPAN_RE.lastIndex = 0;
  let m;
  while ((m = COLOR_SPAN_RE.exec(src))) {
    pushBoldSeg(src.slice(last, m.index), '', plain, bold, colors);
    const c = m[1].startsWith('#') ? normalizeHex(m[1]) : (NAMED_COLORS[m[1]] || '');
    pushBoldSeg(m[2], c, plain, bold, colors);
    last = m.index + m[0].length;
  }
  pushBoldSeg(src.slice(last), '', plain, bold, colors);
  return { plain: plain.join(''), bold, colors };
};

/** 按字号/字重实测或估算一段文字的宽度（无 measurer 时吃 estimateTextWidth 的安全系数） */
export const textWidthOf = (text, fontSize, weight, measurer) => {
  const m = typeof measurer === 'function' ? (t, f) => measurer(t, f, weight) : undefined;
  return estimateTextWidth(text, fontSize, m);
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
