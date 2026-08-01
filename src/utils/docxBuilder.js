// ==================== 轻量 DOM → docx 转换器 ====================
// 数据源：contentEditable 实时 DOM（预览看到什么就导出什么）
// 输出：docx 库的 Document 对象 → Packer.toBlob()

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, VerticalAlign, HeightRule, ImageRun, PageBreak, LineRuleType } from 'docx';
import { TZG_MARKER, FLT_MARKER, FLT_BLANK_MARKER, injectDrawingML, EMU_PER_DXA as _EMU_PER_DXA } from './drawingMLShapes.js';

// ============ 工具函数 ============

/** px → pt（docx 原生单位） */
const px2pt = (px) => Math.round(parseFloat(px) * 0.75) || 12;

/** pt → half-points（docx TextRun size 参数） */
const pt2hp = (pt) => Math.round(pt * 2);

/** 读元素计算样式（挂在页面 DOM 中才能正确取值） */
const cs = (el, prop) => {
  try { return getComputedStyle(el).getPropertyValue(prop); } catch { return ''; }
};

/** 读字号 → half-points */
const readFontSizeHp = (el) => pt2hp(px2pt(cs(el, 'font-size')));

/** 读字号 → CSS px（用于 canvas 渲染参考） */
const _readFontSizePx = (el) => parseFloat(cs(el, 'font-size')) || 16;

/** 读颜色 → 去掉 #（支持 rgb/rgba，全透明返回 null） */
const colorStrToHex = (c, skipWhite = false) => {
  if (!c || c === 'transparent') return null;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; // 全透明
    const hex = m.slice(1, 4).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    if (skipWhite && hex === 'ffffff') return null;
    return hex;
  }
  if (/^#?[0-9a-f]{6}$/i.test(c.trim())) {
    const hex = c.trim().replace('#', '').toLowerCase();
    if (skipWhite && hex === 'ffffff') return null;
    return hex;
  }
  return null;
};

const readColor = (el) => colorStrToHex(cs(el, 'color'));

/** 读背景色（白色/透明视为无背景） */
const readBgColor = (el) => colorStrToHex(cs(el, 'background-color'), true);

/** 读对齐（justify 不映射 JUSTIFIED —— Word 会拉伸 CJK 字间距，与浏览器预览不一致） */
const readAlignment = (el) => {
  const map = { center: AlignmentType.CENTER, right: AlignmentType.RIGHT, left: AlignmentType.LEFT };
  return map[cs(el, 'text-align')] || undefined;
};

/** 计算缩进 (px → twip, 1px ≈ 15 twip @96dpi) */
const readIndent = (el) => {
  const v = cs(el, 'text-indent');
  const px = parseFloat(v);
  if (!px || px <= 0) return undefined;
  return Math.round(px * 15); // px → twip
};

/** CSS 系统字体关键字 → 真实字体映射（这些关键字会让 Word 卡死） */
const CSS_FONT_ALIASES = new Set([
  'system-ui', '-apple-system', 'blinkmacsystemfont',
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
  'inherit', 'initial', 'unset',
]);

/** 已知支持中文字形的字体系列（不区分大小写） */
const CJK_FONT_PATTERN = /^(simsun|simhei|kaiti|fangsong|nsimsun|microsoft\s*yahei|microsoft\s*jhenghei|dengxian|youyuan|stsong|stkaiti|stfangsong|noto\s*(sans|serif)\s*cjk|source\s*han|pingfang|hiragino|wenquan(yi)?|songti|heiti|kaiti_sc|fangsong_gb|\u5b8b\u4f53|\u9ed1\u4f53|\u6977\u4f53|\u4eff\u5b8b|\u5fae\u8f6f\u96c5\u9ed1|arial\s*unicode\s*ms)$/i;

const sanitizeFont = (raw) => {
  if (!raw) return 'SimSun';
  const first = raw.split(',')[0].trim().replace(/['"]/g, '');
  const firstLower = first.toLowerCase();
  // CSS 关键字别名 → SimSun
  if (CSS_FONT_ALIASES.has(firstLower)) return 'SimSun';
  // 已知中文字体 → 原样保留
  if (CJK_FONT_PATTERN.test(firstLower)) return first;
  // 非中文字体 → 降级为 SimSun（避免 Word 用 Times New Roman 等渲染中文乱码）
  return 'SimSun';
};

/** 构建默认 TextRun 样式（从元素计算样式，含粗斜体） */
const defaultRunStyle = (el) => {
  const style = {
    size: readFontSizeHp(el),
    color: readColor(el) || '000000',
    font: sanitizeFont(cs(el, 'font-family')),
  };
  const fw = cs(el, 'font-weight');
  if (parseInt(fw) >= 600 || fw === 'bold') style.bold = true;
  const fs = cs(el, 'font-style');
  if (fs === 'italic' || fs === 'oblique') style.italics = true;
  return style;
};

/**
 * 行内元素样式叠加：读取元素计算样式，与继承样式合并。
 * 让 <span style="color/font-size/font-family/...">、主题 CSS 命中的任意行内元素
 * 都能把真实渲染样式带入 Word（所见即所得）。
 * 未挂载元素 getComputedStyle 返回空 → 保持继承样式，安全降级。
 */
const mergeInlineStyle = (el, base) => {
  const style = { ...base };
  try {
    const fsPx = parseFloat(cs(el, 'font-size'));
    if (fsPx) style.size = pt2hp(Math.round(fsPx * 0.75) || 12);
    const col = readColor(el);
    if (col) style.color = col;
    const famRaw = cs(el, 'font-family');
    if (famRaw) style.font = sanitizeFont(famRaw);
    const fw = cs(el, 'font-weight');
    if (parseInt(fw) >= 600 || fw === 'bold') style.bold = true;
    const fsty = cs(el, 'font-style');
    if (fsty === 'italic' || fsty === 'oblique') style.italics = true;
    const deco = cs(el, 'text-decoration-line') || '';
    if (deco.includes('underline') && !style.underline) style.underline = { type: 'single' };
    if (deco.includes('line-through')) style.strike = true;
    const bg = readBgColor(el);
    if (bg) style.shading = { fill: bg };
    const va = cs(el, 'vertical-align');
    if (va === 'super') style.superScript = true;
    else if (va === 'sub') style.subScript = true;
  } catch { /* detached 元素：保持继承样式 */ }
  return style;
};

/**
 * 块级装饰读取：背景色/四边框/行距/段距（从计算样式 → Word 段落属性）
 * 主题的标题背景条、左侧色条、.example/.reading-passage 等装饰块由此进入 Word。
 */
const readBlockDecorations = (el) => {
  const out = {};
  try {
    const bg = readBgColor(el);
    if (bg) out.shading = { fill: bg };
    const borders = {};
    for (const side of ['top', 'bottom', 'left', 'right']) {
      const wpx = parseFloat(cs(el, `border-${side}-width`)) || 0;
      const bstyle = cs(el, `border-${side}-style`);
      if (wpx > 0 && bstyle && bstyle !== 'none' && bstyle !== 'hidden') {
        borders[side] = {
          style: bstyle.includes('dash') || bstyle.includes('dot') ? BorderStyle.DASHED : BorderStyle.SINGLE,
          size: Math.max(2, Math.round(wpx * 6)), // px → 1/8pt（1px=0.75pt=6/8pt）
          color: colorStrToHex(cs(el, `border-${side}-color`)) || '999999',
          space: 4,
        };
      }
    }
    if (Object.keys(borders).length) out.border = borders;
    const spacing = {};
    const mt = parseFloat(cs(el, 'margin-top'));
    const mb = parseFloat(cs(el, 'margin-bottom'));
    if (!isNaN(mt)) spacing.before = Math.max(0, Math.round(mt * 15)); // px → twip
    if (!isNaN(mb)) spacing.after = Math.max(0, Math.round(mb * 15));
    const lh = parseFloat(cs(el, 'line-height'));
    const fsPx = parseFloat(cs(el, 'font-size'));
    if (lh && fsPx) {
      spacing.line = Math.round((lh / fsPx) * 240); // 倍数 × 240（单倍行距基准）
      spacing.lineRule = LineRuleType.AUTO;
    }
    if (Object.keys(spacing).length) out.spacing = spacing;
  } catch { /* detached 元素：无装饰 */ }
  return out;
};

// ============ 网格语义提取器（"翻译"模式，绕过浏览器文本规范化） ============
// "所见"与"所得"逻辑不同：浏览器 DOM 是预览引擎，docx 是排版引擎。
// 导出不应"照搬"浏览器 textContent（会被浏览器规范化丢失 &emsp; 等实体），
// 而应"翻译"：从 innerHTML 中提取原始语义内容，再映射到 docx 表示。

/**
 * 从网格元素的 innerHTML 中提取语义文本
 * - 绕过浏览器 textContent 规范化（保留 &emsp; &nbsp; 等实体）
 * - 剥离 HTML 标签获取纯文本
 * - 显式检测"纯空白填充"vs"可见文本"
 * @returns {{ text: string, hasVisible: boolean, raw: string }}
 */
const extractGridContent = (el) => {
  const html = el.innerHTML || '';
  // 剥离 HTML 标签，保留实体引用
  const stripped = html.replace(/<[^>]*>/g, '');
  // 解码 HTML 实体 → Unicode（&emsp; → U+2002 U+2002=1em EN SPACE×2，宋体安全）
  const decoded = stripped
    .replace(/&emsp;/gi, '\u2002\u2002')
    .replace(/&ensp;/gi, '\u2002')
    .replace(/&nbsp;/gi, '\u00A0')
    .replace(/&thinsp;/gi, '\u2009')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  // 排除 Unicode 空白字符族（含 EM SPACE / NBSP / 全角空格 等）
  const hasVisible = /[^\s\u00A0\u2000-\u200F\u2028-\u202F\u205F\u3000]/.test(decoded);
  return {
    raw: decoded,
    text: hasVisible ? decoded.replace(/[\s\u00A0\u2000-\u200F\u2028-\u202F\u205F\u3000]+/g, ' ').trim() : '',
    hasVisible,
  };
};

// ============ 行内内容 → TextRun[] ============
// 递归遍历子节点，每层元素的真实渲染样式（getComputedStyle）
// 叠加到上下文 ctx 上，文本节点使用当前 ctx 生成 TextRun。
// 主题 CSS 命中的任意行内元素、工具栏设置的颜色/字号/字体由此进入 Word。

const buildTextRuns = (node, styleOverride = {}) => {
  const runs = [];

  const processChild = (child, ctxIn) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text) {
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          if (i > 0) runs.push(new TextRun({ break: 1 }));
          if (line) {
            const pure = { text: line };
            // 只保留 ctx 中有值的键（避免 undefined 覆盖 docx 默认值）
            const keys = ['size', 'color', 'font', 'bold', 'italics', 'underline', 'strike', 'shading', 'superScript', 'subScript'];
            keys.forEach(k => { if (ctxIn[k] !== undefined) pure[k] = ctxIn[k]; });
            runs.push(new TextRun(pure));
          }
        });
      }
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const tag = child.tagName.toLowerCase();
    const cls = child.classList;
    const text = child.textContent || '';

    // 继承上下文（父级样式）
    const ctx = mergeInlineStyle(child, ctxIn);

    // === 田字格 / 米字格（最高优先级：避免被 emphasis-dot/blank-line 等误捕获）===
    if (cls.contains('tian-zi-ge') || cls.contains('mi-zi-ge')) {
      const { text: extractedText, hasVisible } = extractGridContent(child);
      const gridChar = hasVisible ? (child.querySelector('span')?.textContent || extractedText) : ' ';
      const sizeHp = ctx.size || readFontSizeHp(child) || 32;
      const cellW = Math.round(sizeHp * 18);
      const cellWEmu = Math.round(cellW * EMU_PER_DXA);
      runs.push(new TextRun({ text: TZG_MARKER(gridChar, cellWEmu), size: sizeHp }));
      return;
    }

    // === 特殊 class 白名单（保持优先级，用最终 ctx 替代旧 defaults）===
    if (cls.contains('emphasis-dot')) {
      runs.push(new TextRun({ text, emphasisMark: { type: 'underDot' }, color: 'D32F2F', ...ctx }));
      return;
    }
    if (cls.contains('wavy-underline')) {
      runs.push(new TextRun({ text, underline: { type: 'wavy', color: 'D32F2F' }, ...ctx }));
      return;
    }
    if (cls.contains('double-line')) {
      runs.push(new TextRun({ text, underline: { type: 'double' }, ...ctx }));
      return;
    }
    if (cls.contains('single-line')) {
      runs.push(new TextRun({ text, underline: { type: 'single' }, ...ctx }));
      return;
    }
    // === 四线三格 / 四线格 ===
    if ((cls.contains('four-line-three') || cls.contains('sixian-ge')) && !cls.contains('blank-line')) {
      const { text: _letter, hasVisible, raw } = extractGridContent(child);
      const sizeHp = ctx.size || readFontSizeHp(child) || 32;
      // 字母 run 强制 Times New Roman（与预览 CSS font-family 首选一致），颜色/粗斜体从上下文传播
      const markerStyle = {
        font: 'Times New Roman',
        color: ctx.color,
        bold: ctx.bold,
        italics: ctx.italics,
      };
      if (hasVisible) {
        // 有字母：内容自适应（每字母约 0.5em + 两侧 padding）
        const contentLen = Math.max(1, [..._letter].length);
        const cellW = fltCellWidthDxa(contentLen, sizeHp);
        const cellWEmu = Math.round(cellW * EMU_PER_DXA);
        runs.push(new TextRun({ ...markerStyle, text: FLT_MARKER(_letter, cellWEmu, sizeHp), size: sizeHp }));
      } else {
        // 留空（默写/听写书写区）：按内部 &emsp; 等空白实体计算宽度（同填空横线逻辑）
        const cellW = fltBlankWidthDxa(raw, sizeHp);
        const cellWEmu = Math.round(cellW * EMU_PER_DXA);
        runs.push(new TextRun({ ...markerStyle, text: FLT_BLANK_MARKER(cellWEmu, sizeHp), size: sizeHp }));
      }
      return;
    }
    // === 普通横线（blank-line / blank-N）===
    // ⚠️ NBSP 宽度依赖字体：Times New Roman ≈ 0.25em（与预览 em 对齐），宋体 ≈ 0.5em（2 倍偏差）
    //    必须显式指定 font: 'Times New Roman' 确保宽度与预览 min-width: N em 精确一致
    if (cls.contains('blank-line')) {
      // 🔧 用 extractGridContent（innerHTML）替代 textContent，保留 &emsp; 实体
      const { raw, hasVisible } = extractGridContent(child);
      const src = hasVisible ? raw : (child.textContent || raw);
      let emWidth = 0;
      for (const ch of src) {
        if (ch === '\u2003') emWidth += 1;
        else if (ch === '\u2002') emWidth += 0.5;
        else if (ch === '\u00A0') emWidth += 0.5;
        else if (ch === ' ') emWidth += 0.25;
        else if (/\s/.test(ch)) emWidth += 1;
      }
      if (emWidth < 1) emWidth = 2;
      const nbspCount = Math.max(8, Math.round(emWidth * 4));
      const finalText = '\u00A0'.repeat(nbspCount);
      runs.push(new TextRun({ text: finalText, underline: { type: 'single', color: '666666' }, font: 'Times New Roman', size: ctx.size || readFontSizeHp(child) }));
      return;
    }
    // === 括号内留空（span.blank-N）——无下划线，仅占位 ===
    // 预览 CSS：span.blank-N::before/::after 画括号(    )
    // 伪元素不在 DOM 中，导出时显式补 ( 和 )
    // 🔧 宽度取 class N 值与实际内容（&emsp; 等）中较大者（同 u.blank-N 逻辑）
    if (tag === 'span') {
      const blankSpanMatch = [...cls].find(c => /^blank-\d+$/.test(c));
      if (blankSpanMatch) {
        const nFromClass = parseInt(blankSpanMatch.split('-')[1]) || 2;
        const { raw } = extractGridContent(child);
        let emWidth = 0;
        for (const ch of raw) {
          if (ch === '\u2003') emWidth += 1;
          else if (ch === '\u2002') emWidth += 0.5;
          else if (ch === '\u00A0') emWidth += 0.5;
          else if (ch === ' ') emWidth += 0.25;
          else if (/\s/.test(ch)) emWidth += 1;
        }
        const effectiveN = Math.max(nFromClass, Math.round(emWidth), 2);
        const innerText = '\u00A0'.repeat(effectiveN * 4);
        runs.push(new TextRun({ text: `(${innerText})`, font: 'Times New Roman', size: ctx.size || readFontSizeHp(child) }));
        return;
      }
    }
    // === 通用 blank-N 兜底（<u>/非标标签，兼容 Tiptap 可能的渲染差异）===
    // 上方的 span.blank-N 已处理括号场景；此处兜底 <u> 和其他非标准标签
    // 🔧 宽度取 class N 值与实际内容（&emsp; 等）中较大者：
    //    手动拉长横线只会增加空白实体，不会改 class，必须读了内容才知道真实宽度
    const anyBlankMatch = [...cls].find(c => /^blank-\d+$/.test(c));
    if (anyBlankMatch && tag !== 'span') {
      const nFromClass = parseInt(anyBlankMatch.split('-')[1]) || 2;
      // 读实际内容宽度（同 blank-line 逻辑）
      const { raw } = extractGridContent(child);
      let emWidth = 0;
      for (const ch of raw) {
        if (ch === '\u2003') emWidth += 1;
        else if (ch === '\u2002') emWidth += 0.5;
        else if (ch === '\u00A0') emWidth += 0.5;
        else if (ch === ' ') emWidth += 0.25;
        else if (/\s/.test(ch)) emWidth += 1;
      }
      const effectiveN = Math.max(nFromClass, Math.round(emWidth), 2);
      const innerText = '\u00A0'.repeat(effectiveN * 4);
      if (tag === 'u') {
        // 填空横线：下划线 + NBSP
        runs.push(new TextRun({ text: innerText, underline: { type: 'single', color: '333333' }, font: 'Times New Roman', size: ctx.size || readFontSizeHp(child) }));
      } else {
        // 非标标签：统一按括号处理
        runs.push(new TextRun({ text: `(${innerText})`, font: 'Times New Roman', size: ctx.size || readFontSizeHp(child) }));
      }
      return;
    }
    if (cls.contains('pinyin-line')) {
      for (const c of child.childNodes) processChild(c, { ...ctx, font: 'Times New Roman' });
      return;
    }
    if (cls.contains('english-line')) {
      for (const c of child.childNodes) processChild(c, { ...ctx, font: 'Times New Roman' });
      return;
    }
    if (cls.contains('oral-box') || cls.contains('square-box') || cls.contains('score-box')) {
      runs.push(new TextRun({ text, border: { style: BorderStyle.SINGLE, size: 2, color: '333333' }, ...ctx }));
      return;
    }
    if (cls.contains('wb-item')) {
      runs.push(new TextRun({ text, border: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, ...ctx }));
      return;
    }
    // === 拼音 ===
    if (tag === 'ruby') {
      const rt = child.querySelector('rt');
      const rb = child.querySelector('rb') || child;
      const baseText = rb.textContent?.replace(rt?.textContent || '', '').trim() || text;
      const rtText = rt ? rt.textContent.trim() : '';
      runs.push(new TextRun({ text: rtText ? `${baseText}(${rtText})` : baseText, ...ctx }));
      return;
    }
    if (cls.contains('stroke-order')) {
      const strokes = child.getAttribute('data-strokes');
      runs.push(new TextRun({ text: strokes ? `${text}(${strokes}画)` : text, ...ctx }));
      return;
    }
    // === 上标 / 下标（计算样式 + 语义标签叠加）===
    if (tag === 'sup' || cls.contains('superscript')) {
      const supCtx = { ...ctx, superScript: true, size: ctx.size ? Math.round(ctx.size * 0.7) : readFontSizeHp(child) };
      for (const c of child.childNodes) processChild(c, supCtx);
      return;
    }
    if (tag === 'sub' || cls.contains('subscript')) {
      const subCtx = { ...ctx, subScript: true, size: ctx.size ? Math.round(ctx.size * 0.7) : readFontSizeHp(child) };
      for (const c of child.childNodes) processChild(c, subCtx);
      return;
    }
    if (cls.contains('chem-condition')) {
      runs.push(new TextRun({ text, superScript: true, size: ctx.size ? Math.round(ctx.size * 0.6) : 10, color: '555555' }));
      return;
    }
    // === 标记/高亮（从计算样式读取背景色，准确还原）===
    if (tag === 'mark') {
      const markCtx = { ...ctx };
      const bg = readBgColor(child) || 'ffff00';
      markCtx.shading = { fill: bg };
      for (const c of child.childNodes) processChild(c, markCtx);
      return;
    }
    // === 行内图片 ===
    if (tag === 'img') {
      const imgRun = buildImageRun(child);
      if (imgRun) runs.push(imgRun);
      else runs.push(new TextRun({ text: `【${child.getAttribute('alt') || '图片'}】`, ...ctx }));
      return;
    }
    // === 标准 HTML 标记：用 ctx（计算样式已在 ctx 中），语义 tag 作为叠加保底 ===
    if (tag === 'strong' || tag === 'b') {
      const sCtx = { ...ctx, bold: true };
      for (const c of child.childNodes) processChild(c, sCtx);
      return;
    }
    if (tag === 'em' || tag === 'i') {
      const sCtx = { ...ctx, italics: true };
      for (const c of child.childNodes) processChild(c, sCtx);
      return;
    }
    if (tag === 'u') {
      const sCtx = { ...ctx, underline: ctx.underline || { type: 'single' } };
      for (const c of child.childNodes) processChild(c, sCtx);
      return;
    }
    if (tag === 's' || tag === 'del' || tag === 'strike') {
      const sCtx = { ...ctx, strike: true };
      for (const c of child.childNodes) processChild(c, sCtx);
      return;
    }
    // === $...$ 公式 ===
    if (text.startsWith('$') && text.endsWith('$')) {
      runs.push(new TextRun({ text: text.slice(1, -1), italics: true, color: '1A237E', size: ctx.size }));
      return;
    }
    // === 换行符 ===
    if (tag === 'br') {
      runs.push(new TextRun({ break: 1 }));
      return;
    }
    // === 未知行内元素：用 ctx 递归（ctx 已含该元素的 getComputedStyle 叠加）===
    for (const c of child.childNodes) processChild(c, ctx);
  };

  // init ctx from node（styleOverride 可覆盖 defaultRunStyle 计算的默认值，
  //   用于 h4 等需强制禁用某些样式属性的场景）
  const baseCtx = { ...defaultRunStyle(node), ...styleOverride };
  for (const child of node.childNodes) processChild(child, baseCtx);
  return runs;
};

// ============ 田字格 / 四线格 构建器 ============
// 核心思路参考"不坑盒子"：文字保持可编辑 TextRun，装饰线用 DrawingML 形状叠加
// 导出时在 Paragraph 中写入标记 TextRun，后处理时替换为完整 DrawingML OOXML

const EMU_PER_DXA = _EMU_PER_DXA; // 635 EMU/DXA

/**
 * 四线三格宽度自适应（内容决定格子宽）
 * 预览 CSS：.four-line-three { display:inline-block; padding:4px 4px; } → 无固定 width
 * 每个拉丁字母约 0.5em，每侧 padding 约 0.25em
 * @param {number} contentLen 可见字母数（Unicode 码点计数）
 * @param {number} sizeHp 字号（half-points）
 * @returns {number} cellW in DXA
 */
const fltCellWidthDxa = (contentLen, sizeHp) => {
  if (!sizeHp || !contentLen) return Math.round(sizeHp * 20) || 560;
  const perCharDxa = Math.round(sizeHp * 5);      // 0.5em per Latin letter
  const padEachSide = Math.round(sizeHp * 2.5);   // ¼em/侧（与导出 pad 文本 &#x2005; 精确对齐）
  return contentLen * perCharDxa + padEachSide * 2;
};

/**
 * 空白四线三格（默写/听写留空）宽度自适应：按内部空白实体计算宽度
 * 与填空横线 blank-line 同源逻辑：AI 根据答案长度输出对应数量的 &emsp;
 *  (em)=1em /  (en)=0.5em / nbsp=0.5em / 普通空格=0.25em
 * @param {string} raw extractGridContent 解码后的原始内容（含空白字符）
 * @param {number} sizeHp 字号（half-points）
 * @returns {number} cellW in DXA
 */
const fltBlankWidthDxa = (raw, sizeHp) => {
  let emWidth = 0;
  for (const ch of raw || '') {
    if (ch === '\u2003') emWidth += 1;
    else if (ch === '\u2002') emWidth += 0.5;
    else if (ch === '\u00A0') emWidth += 0.5;
    else if (ch === ' ') emWidth += 0.25;
    else if (/\s/.test(ch)) emWidth += 1;
  }
  if (emWidth < 1) emWidth = 2; // 无宽度信息时默认 2em（与旧版一致）
  const emDxa = (sizeHp || 28) * 10; // 1em = sizeHp/2 pt = sizeHp*10 DXA
  const padEachSide = Math.round((sizeHp || 28) * 2.5); // ¼em/侧（与 pad 文本精确对齐）
  return Math.round(emWidth * emDxa) + padEachSide * 2;
};

/** 田字格 → 标记 Paragraph（后处理替换为 1×1 Table + DrawingML 十字线） */
export const buildTianZiGeMarker = (gridChar, sizeHp, _fontFamily) => {
  const cellW = Math.round(sizeHp * 18); // 1.8em（与预览 CSS 一致，手写余量）
  const cellWEmu = Math.round(cellW * EMU_PER_DXA);
  return new Paragraph({
    children: [new TextRun({ text: TZG_MARKER(gridChar, cellWEmu), size: sizeHp })],
    spacing: { before: 40, after: 40 },
  });
};

/** 四线三格 → 标记 Paragraph（后处理替换为 4 条 DrawingML 水平线） */
export const buildFourLineMarker = (letter, sizeHp) => {
  const contentLen = Math.max(1, [...letter].length);
  const cellW = fltCellWidthDxa(contentLen, sizeHp);
  const cellWEmu = Math.round(cellW * EMU_PER_DXA);
  return new Paragraph({
    children: [new TextRun({ text: FLT_MARKER(letter, cellWEmu, sizeHp), size: sizeHp, font: 'Times New Roman' })],
    spacing: { before: 40, after: 40 },
  });
};

/** 空白四线三格 → 标记 Paragraph（仅绘制线，不渲染字母 —— 听写/默写留空场景）
 *  raw：元素内原始空白内容（&emsp; 序列），按实体数量自适应宽度（同填空横线） */
export const buildFourLineBlankMarker = (sizeHp, raw = '') => {
  const cellW = fltBlankWidthDxa(raw, sizeHp);
  const cellWEmu = Math.round(cellW * EMU_PER_DXA);
  return new Paragraph({
    children: [new TextRun({ text: FLT_BLANK_MARKER(cellWEmu, sizeHp), size: sizeHp })],
    spacing: { before: 40, after: 40 },
  });
};

// ============ 图片导出 ============

/** <img> → ImageRun（尺寸限制页宽内，比例不变） */
const buildImageRun = (imgEl) => {
  const src = imgEl.getAttribute('src') || imgEl.getAttribute('_inlined') || '';
  if (!src || !src.startsWith('data:')) return null;
  try {
    const mimeMatch = src.match(/^data:(image\/[^;]+);/);
    const mimeType = mimeMatch?.[1] || 'image/png';
    const base64 = src.split(',')[1];
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    // 读取渲染尺寸
    let w = imgEl.getBoundingClientRect?.().width || parseInt(imgEl.getAttribute('width')) || 320;
    let h = imgEl.getBoundingClientRect?.().height || parseInt(imgEl.getAttribute('height')) || 240;
    const maxW = 590; // A4 正文可用像素
    if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
    if (w < 10) w = 100;
    if (h < 10) h = 75;
    const typeMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/webp': 'png' };
    const imgType = typeMap[mimeType] || 'png';
    return new ImageRun({ data: bytes, transformation: { width: Math.round(w), height: Math.round(h) }, type: imgType });
  } catch { return null; }
};

/** 容器内所有 <img> src 非 dataURL 的 → fetch 为 dataURL（写入 _inlined 属性） */
const inlineImagesForExport = async (container) => {
  if (!container) return;
  const imgs = container.querySelectorAll?.('img') || [];
  const tasks = [];
  imgs.forEach(img => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;
    tasks.push((async () => {
      try {
        const resp = await fetch(src);
        const blob = await resp.blob();
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.setAttribute('_inlined', dataUrl);
      } catch { /* 外部图片获取失败，fallback 到占位符 */ }
    })());
  });
  await Promise.allSettled(tasks);
};


// ============ 降级方案：Table 构建器（canvas 不可用时）============

/** 田字格 → 2×2 Table：实线外框 + 虚线十字（正方形格子） */
export const buildTianZiGeTable = (gridChar, sizeHp, _fontFamily) => {
  const cellW = Math.round(sizeHp * 18); // 1.8em half-points → DXA（与预览 CSS 一致，手写余量）
  const rowH = { value: cellW, rule: HeightRule.EXACT };  // 强制行高 = 列宽 → 正方形
  const outerB = { style: BorderStyle.SINGLE, size: 6, color: '999999' };  // 实线 ~1.5px
  const innerB = { style: BorderStyle.DASHED, size: 2, color: 'CCCCCC' };   // 虚线 ~0.5px
  const charP = new Paragraph({
    children: [new TextRun({ text: gridChar, size: sizeHp, font: _fontFamily || 'SimSun' })],
    alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
  });
  const blankP = new Paragraph({ text: '', spacing: { before: 0, after: 0 } });
  const cell = (borders, hasChar) => new TableCell({
    children: [hasChar ? charP : blankP],
    width: { size: cellW, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    borders,
  });
  return new Table({
    rows: [
      new TableRow({ height: rowH, children: [
        /* TL-字 */ cell({ top: outerB, bottom: innerB, left: outerB, right: innerB }, true),
        /* TR-空 */ cell({ top: outerB, bottom: innerB, left: innerB, right: outerB }, false),
      ]}),
      new TableRow({ height: rowH, children: [
        /* BL-空 */ cell({ top: innerB, bottom: outerB, left: outerB, right: innerB }, false),
        /* BR-空 */ cell({ top: innerB, bottom: outerB, left: innerB, right: outerB }, false),
      ]}),
    ],
    width: { size: cellW * 2, type: WidthType.DXA },
  });
};

/** 四线三格 → 1×1 Table：4 条水平线（3 灰 + 1 红底）
 *  用 4 个 Paragraph 各自的 bottom-border 画出 4 条线，
 *  字母放在第 2 个 Paragraph 中（线1和线2之间）。
 *  对应 CSS: 0.1em 灰 / 0.55em 灰 / 1.0em 深灰 / 1.45em 红 */
export const buildFourLineTable = (letter, sizeHp) => {
  const cellW = Math.round(sizeHp * 20);
  const line1 = { style: BorderStyle.SINGLE, size: 2, color: '999999' };      // 灰线 1
  const line2 = { style: BorderStyle.SINGLE, size: 2, color: '999999' };      // 灰线 2
  const line3 = { style: BorderStyle.SINGLE, size: 2, color: '666666' };      // 深灰线 3
  const line4 = { style: BorderStyle.SINGLE, size: 4, color: 'e74c3c' };      // 红线 4
  const none = BorderStyle.NONE;
  const p = (text, bottomBorder, sz) => new Paragraph({
    text,
    alignment: AlignmentType.CENTER,
    spacing: { before: sz || 20, after: 0 },
    border: bottomBorder ? { bottom: bottomBorder } : undefined,
  });
  return new Table({
    rows: [new TableRow({
      children: [new TableCell({
        children: [
          p('',        { style: line1.style, size: line1.size, color: line1.color }, 10),   // 线1（灰）
          p(letter,    { style: line2.style, size: line2.size, color: line2.color }, 40),   // 线2（灰）+ 字母
          p('',        { style: line3.style, size: line3.size, color: line3.color }, 10),   // 线3（深灰）
          p('',        { style: line4.style, size: line4.size, color: line4.color }, 10),   // 线4（红）
        ],
        width: { size: cellW, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        borders: { top: { style: none }, bottom: { style: none }, left: { style: none }, right: { style: none } },
      })],
    })],
    width: { size: cellW, type: WidthType.DXA },
  });
};

// ============ 段落级网格拆分：把 <p> 内的田字格/四线三格拆成 [Paragraph, Table, Paragraph] ============
// 遵循 Word 规则：Table 必须独立成块，不能嵌入 Paragraph

const isGridNode = (el) => {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  const c = el.classList;
  // ⚠️ 排除同时带 blank-line 的元素（AI 可能因指令冲突同时输出四线三格+横线，优先按横线处理）
  if (c?.contains('blank-line')) return false;
  // 🔧 四线三格 / 六线格走行内渲染（buildTextRuns→FLT_BLANK_MARKER→injectDrawingML），
  //    不走块级拆分，避免文字与格子被拆成两个独立段落。
  //    仅田字格/米字格保留块级拆分（每个格子独立占一整行）。
  return c?.contains('tian-zi-ge') || c?.contains('mi-zi-ge');
};

const splitGridAwareContent = (node, runDefaults, opts = {}) => {
  const { spacing: _spacingOverride, prefixRuns, indent: extraIndent, inheritedDeco = {} } = opts;
  const ownDeco = readBlockDecorations(node);
  const deco = { ...inheritedDeco };
  // own takes precedence, but spacing merges (max of both) to preserve container fallback
  if (ownDeco.shading) deco.shading = ownDeco.shading;
  if (ownDeco.border) deco.border = ownDeco.border;
  if (ownDeco.spacing) {
    const merged = { ...deco.spacing };
    for (const sk of ['before', 'after', 'line', 'lineRule']) {
      if (ownDeco.spacing[sk] !== undefined) {
        merged[sk] = (sk === 'before' || sk === 'after')
          ? Math.max(merged[sk] || 0, ownDeco.spacing[sk])
          : ownDeco.spacing[sk];
      }
    }
    deco.spacing = merged;
  }
  const spacing = deco.spacing || _spacingOverride || { before: 80, after: 80 };
  const baseIndent = readIndent(node) ? { firstLine: readIndent(node) } : undefined;
  const paraIndent = extraIndent || baseIndent;
  const baseCtx = { ...defaultRunStyle(node), ...(runDefaults && typeof runDefaults === 'object' ? runDefaults : {}) };
  const result = [];
  let textBuffer = [];
  let isFirstFlush = true;
  let textFlushCount = 0;

  const flushText = () => {
    if (textBuffer.length === 0) return;
    textFlushCount++;
    // 🔧 把 textBuffer 中的 live node 挂到临时 <span> 上并追加到 node 末尾，
    //    让 getComputedStyle 能读到父级（主题 CSS 等）的样式，读完即刻移除。
    //    node 可能由 processBlockNode 用 createElement 创建（detached），
    //    此时挂到 document.body 确保样式可解析；样式值优先从 baseCtx 取（已含 runDefaults）。
    const tempEl = document.createElement('span');
    textBuffer.forEach(c => tempEl.appendChild(c.cloneNode(true)));
    const mountTarget = node.isConnected ? node : document.body;
    mountTarget.appendChild(tempEl);
    const runs = buildTextRuns(tempEl, baseCtx);
    mountTarget.removeChild(tempEl);
    const allRuns = (isFirstFlush && prefixRuns && prefixRuns.length > 0)
      ? [...prefixRuns, ...runs]
      : runs;
    isFirstFlush = false;
    if (allRuns.length > 0) {
      const paraOpts = { children: allRuns, spacing, indent: paraIndent, alignment: readAlignment(node) };
      if (deco.shading) paraOpts.shading = deco.shading;
      if (deco.border) paraOpts.border = deco.border;
      result.push(new Paragraph(paraOpts));
    } else {
      // buildTextRuns 返回空 runs，段落被丢弃
    }
    textBuffer = [];
  };

  const snapChildren = [...node.childNodes];
  for (const child of snapChildren) {
    if (isGridNode(child)) {
      flushText();
      const sizeHp = baseCtx.size || readFontSizeHp(child) || 32;
      const cls = child.classList;
      const { text: visibleText, hasVisible, raw } = extractGridContent(child);

      if (cls.contains('tian-zi-ge') || cls.contains('mi-zi-ge')) {
        const gridChar = hasVisible
          ? (child.querySelector('span')?.textContent || visibleText)
          : ' ';
        result.push(buildTianZiGeMarker(gridChar, sizeHp, runDefaults.font || 'SimSun'));
      } else {
        if (hasVisible) {
          result.push(buildFourLineMarker(visibleText, sizeHp));
        } else {
          result.push(buildFourLineBlankMarker(sizeHp, raw));
        }
      }
    } else {
      textBuffer.push(child);
    }
  }
  flushText();

  // fallback：如果没有网格元素，按普通段落处理
  if (result.length === 0) {
    const runs = buildTextRuns(node, baseCtx);
    const allRuns = (prefixRuns && prefixRuns.length > 0)
      ? [...prefixRuns, ...runs]
      : runs;
    if (allRuns.length > 0) {
      const paraOpts = { children: allRuns, spacing, indent: paraIndent, alignment: readAlignment(node) };
      if (deco.shading) paraOpts.shading = deco.shading;
      if (deco.border) paraOpts.border = deco.border;
      result.push(new Paragraph(paraOpts));
    }
  }
  return result;
};

// ============ Block 元素 → docx Paragraph/Table ============
// ctx.deco: 继承装饰（父 div/blockquote 的 shading/border 透传子级）
const processBlockNode = (node, ctx = {}) => {
  const inheritedDeco = ctx.deco || {};
  const children = [];
  if (!node || node.nodeType === Node.TEXT_NODE) {
    const txt = node?.textContent?.trim();
    if (txt) children.push(new Paragraph({ text: txt, spacing: { before: 80, after: 80 } }));
    return children;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return children;

  const tag = node.tagName.toLowerCase();
  const cls = node.classList;
  const text = node.textContent?.trim() || '';
  const runDefaults = defaultRunStyle(node);

  // 🔒 跳过非内容元素
  if (['style', 'link', 'script', 'meta', 'title', 'head'].includes(tag)) return children;

  // ===== 分割线 =====
  if (tag === 'hr') {
    children.push(new Paragraph({
      children: [new TextRun({ text: ' ', size: 2 })],
      spacing: { before: 120, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999' } },
    }));
    return children;
  }

  // ===== 田字格 / 米字格（独立块）=====
  if (cls.contains('tian-zi-ge') || cls.contains('mi-zi-ge')) {
    const { text: extractedText, hasVisible } = extractGridContent(node);
    const gridChar = hasVisible ? (node.querySelector('span')?.textContent || extractedText) : ' ';
    const sizeHp = runDefaults.size || readFontSizeHp(node) || 32;
    children.push(buildTianZiGeMarker(gridChar, sizeHp, runDefaults.font || 'SimSun'));
    return children;
  }

  // ===== 四线三格 / 六线格（独立块 → 行内）=====
  if (cls.contains('four-line-three') || cls.contains('sixian-ge')) {
    const wrapper = document.createElement('p');
    wrapper.appendChild(node.cloneNode(true));
    // 🔧 临时挂到原节点父级 DOM，确保 getComputedStyle 有正确的继承上下文
    const mountParent = node.isConnected ? (node.parentElement || document.body) : document.body;
    mountParent.appendChild(wrapper);
    const result = splitGridAwareContent(wrapper, { size: runDefaults.size, font: runDefaults.font });
    mountParent.removeChild(wrapper);
    children.push(...result);
    return children;
  }

  // ===== 作文格 =====
  if (cls.contains('zuo-wen-ge')) {
    const spans = [...node.querySelectorAll('span')];
    if (spans.length > 0) {
      const perRow = 20;
      const rows = [];
      let currentRow = [];
      spans.forEach((span, idx) => {
        currentRow.push(new TableCell({
          children: [new Paragraph({ text: span.textContent.trim() || ' ', alignment: AlignmentType.CENTER })],
          width: { size: 300, type: WidthType.DXA },
          borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' }, left: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' } },
        }));
        if (currentRow.length >= perRow || idx === spans.length - 1) {
          while (currentRow.length < perRow) {
            currentRow.push(new TableCell({
              children: [new Paragraph({ text: ' ' })],
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' }, left: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' } },
            }));
          }
          rows.push(new TableRow({ children: currentRow }));
          currentRow = [];
        }
      });
      children.push(new Table({ rows, width: { size: 9000, type: WidthType.DXA } }));
    }
    return children;
  }

  // ===== 竖式计算 =====
  if (cls.contains('vertical-calculation')) {
    node.querySelectorAll('.vc-row, .vc-result, .vc-line').forEach(row => {
      if (row.classList.contains('vc-line')) {
        children.push(new Paragraph({ spacing: { before: 0, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1 } } }));
      } else {
        children.push(new Paragraph({ text: row.textContent.trim(), alignment: AlignmentType.RIGHT, spacing: { before: 20, after: 20 }, indent: { right: 360 } }));
      }
    });
    return children;
  }

  // ===== 脱式计算 =====
  if (cls.contains('off-formula')) {
    node.querySelectorAll('.of-line').forEach(line => {
      children.push(new Paragraph({ text: line.textContent.trim(), indent: { left: 720 }, spacing: { before: 20, after: 20 } }));
    });
    return children;
  }

  // ===== 连线题 =====
  if (cls.contains('match-question')) {
    const cols = node.querySelectorAll('.match-col');
    if (cols.length >= 2) {
      const leftItems = [...cols[0].querySelectorAll('.match-item')];
      const rightItems = [...cols[1].querySelectorAll('.match-item')];
      const rows = [];
      for (let i = 0; i < Math.max(leftItems.length, rightItems.length); i++) {
        rows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: leftItems[i]?.textContent.trim() || ' ' })] }),
            new TableCell({ children: [new Paragraph({ text: rightItems[i]?.textContent.trim() || ' ' })] }),
          ]
        }));
      }
      children.push(new Table({ rows, width: { size: 9000, type: WidthType.DXA } }));
    }
    return children;
  }

  // ===== 词库框 =====
  if (cls.contains('word-bank')) {
    const items = node.querySelectorAll('.wb-item');
    const cells = [];
    items.forEach(item => {
      cells.push(new TableCell({
        children: [new Paragraph({ text: item.textContent.trim() || ' ', alignment: AlignmentType.CENTER })],
        borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
      }));
    });
    if (cells.length > 0) children.push(new Table({ rows: [new TableRow({ children: cells })], width: { size: 9000, type: WidthType.DXA } }));
    return children;
  }

  // ===== 密封线 =====
  if (cls.contains('seal-line')) {
    children.push(new Paragraph({
      text: text || '密 封 线',
      spacing: { before: 40, after: 40 },
      border: { left: { style: BorderStyle.DASHED, size: 1 }, right: { style: BorderStyle.DASHED, size: 1 } },
      indent: { left: 360, right: 360 },
    }));
    return children;
  }

  // ===== 评分栏 =====
  if (cls.contains('score-board')) {
    const items = node.querySelectorAll('.sb-row');
    const texts = [];
    items.forEach(item => {
      const label = item.querySelector('.sb-label');
      const value = item.querySelector('.sb-value');
      if (label && value) texts.push(label.textContent.trim() + '：' + value.textContent.trim());
    });
    children.push(new Paragraph({
      text: texts.join('|'),
      spacing: { before: 40, after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
    }));
    return children;
  }

  // ===== 块级图片 <img> =====
  if (tag === 'img') {
    const imgRun = buildImageRun(node);
    if (imgRun) children.push(new Paragraph({ children: [imgRun], spacing: { before: 80, after: 80 }, alignment: AlignmentType.CENTER }));
    else children.push(new Paragraph({ text: `【${node.getAttribute('alt') || '图片'}】`, spacing: { before: 80, after: 80 } }));
    return children;
  }

  // ===== 分页符（Tiptap PageBreak 扩展）=====
  if (tag === 'div' && node.hasAttribute('data-page-break')) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    return children;
  }

  // ===== 标题 =====
  if (tag === 'h1' || cls.contains('main-title')) {
    const deco = readBlockDecorations(node);
    const paraOpts = {
      children: buildTextRuns(node, runDefaults),
      heading: HeadingLevel.HEADING_1,
      spacing: deco.spacing || { before: 200, after: 120 },
      alignment: readAlignment(node),
    };
    if (deco.shading) paraOpts.shading = deco.shading;
    if (deco.border) paraOpts.border = deco.border;
    children.push(new Paragraph(paraOpts));
    return children;
  }
  if (tag === 'h2' || cls.contains('heading1')) {
    const deco = readBlockDecorations(node);
    const paraOpts = {
      children: buildTextRuns(node, runDefaults),
      heading: HeadingLevel.HEADING_2,
      spacing: deco.spacing || { before: 160, after: 100 },
      alignment: readAlignment(node),
    };
    if (deco.shading) paraOpts.shading = deco.shading;
    if (deco.border) paraOpts.border = deco.border;
    children.push(new Paragraph(paraOpts));
    return children;
  }
  if (tag === 'h3' || cls.contains('heading2')) {
    const deco = readBlockDecorations(node);
    const paraOpts = {
      children: buildTextRuns(node, runDefaults),
      heading: HeadingLevel.HEADING_3,
      spacing: deco.spacing || { before: 140, after: 80 },
      alignment: readAlignment(node),
    };
    if (deco.shading) paraOpts.shading = deco.shading;
    if (deco.border) paraOpts.border = deco.border;
    children.push(new Paragraph(paraOpts));
    return children;
  }
  if (tag === 'h4' || cls.contains('heading3')) {
    const deco = readBlockDecorations(node);
    // 🔧 h4 标题默认不斜体：Word 内置 Heading 4 样式自带斜体，
    //    显式设置 italics: false 覆盖样式默认值（行内 <em>/<i> 仍会通过 mergeInlineStyle 获得斜体）
    const runs = buildTextRuns(node, { italics: false });
    const paraOpts = {
      children: runs,
      heading: HeadingLevel.HEADING_4,
      spacing: deco.spacing || { before: 120, after: 60 },
      alignment: readAlignment(node),
    };
    if (deco.shading) paraOpts.shading = deco.shading;
    if (deco.border) paraOpts.border = deco.border;
    children.push(new Paragraph(paraOpts));
    return children;
  }
  // h5/h6（HeadingLevel 只有 1-5，h6 也用 HEADING_5）
  if (tag === 'h5') {
    const deco = readBlockDecorations(node);
    const paraOpts = {
      children: buildTextRuns(node, runDefaults),
      heading: HeadingLevel.HEADING_5,
      spacing: deco.spacing || { before: 100, after: 50 },
      alignment: readAlignment(node),
    };
    if (deco.shading) paraOpts.shading = deco.shading;
    if (deco.border) paraOpts.border = deco.border;
    children.push(new Paragraph(paraOpts));
    return children;
  }
  if (tag === 'h6') {
    const deco = readBlockDecorations(node);
    const paraOpts = {
      children: buildTextRuns(node, runDefaults),
      heading: HeadingLevel.HEADING_5,
      spacing: deco.spacing || { before: 80, after: 40 },
      alignment: readAlignment(node),
    };
    if (deco.shading) paraOpts.shading = deco.shading;
    if (deco.border) paraOpts.border = deco.border;
    children.push(new Paragraph(paraOpts));
    return children;
  }

  // ===== 引用块 <blockquote> =====
  if (tag === 'blockquote') {
    const ownDeco = readBlockDecorations(node);
    const deco = { ...inheritedDeco };
    if (ownDeco.shading) deco.shading = ownDeco.shading;
    if (ownDeco.border) deco.border = ownDeco.border;
    if (!deco.border) deco.border = { left: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 8 } };
    if (!deco.spacing) deco.spacing = { before: 60, after: 60 };
    const indent = { left: 480, right: 0 };
    // blockquote 的子节点透传给 processBlockNode，带上继承装饰
    const blockChildren = [];
    for (const child of node.childNodes) {
      blockChildren.push(...processBlockNode(child, { deco }));
    }
    if (blockChildren.length === 0 && (node.textContent?.trim())) {
      blockChildren.push(new Paragraph({ children: buildTextRuns(node, runDefaults), spacing: deco.spacing, indent }));
    }
    // 应用 left indent + 装饰到每个子段落（如果子段落已设置则保留）
    blockChildren.forEach(block => {
      if (block?.type === 'Paragraph' && !block.indent?.left) {
        try { block.indent = { ...block.indent, ...indent }; } catch {}
      }
    });
    children.push(...blockChildren);
    return children;
  }

  // ===== 预格式文本 <pre> =====
  if (tag === 'pre' || tag === 'code') {
    const deco = readBlockDecorations(node);
    const paraOpts = {
      children: buildTextRuns(node, { ...runDefaults, font: 'Courier New' }),
      spacing: deco.spacing || { before: 60, after: 60 },
      alignment: readAlignment(node),
    };
    if (deco.shading) paraOpts.shading = deco.shading;
    if (deco.border) paraOpts.border = deco.border;
    children.push(new Paragraph(paraOpts));
    return children;
  }

  // ===== 表格 =====
  if (tag === 'table') {
    // 🔧 表格不继承底色，仅单元格自身有背景时才着色
    const rows = [];
    const allRows = [...node.querySelectorAll('tr')];
    // 计算列宽（首行所有单元格实际宽度占比）
    const colWidths = [];
    if (allRows.length > 0) {
      const firstRowCells = allRows[0].querySelectorAll('td, th');
      const totalW = 9000;
      const cellRects = [];
      let sumPx = 0;
      firstRowCells.forEach(td => {
        const w = td.getBoundingClientRect?.().width || 120;
        cellRects.push(w); sumPx += w;
      });
      if (sumPx > 0) {
        cellRects.forEach(w => colWidths.push(Math.round((w / sumPx) * totalW)));
      }
    }
    allRows.forEach(tr => {
      const cells = [];
      const tds = [...tr.querySelectorAll('td, th')];
      tds.forEach((td, idx) => {
        const tdRunStyle = defaultRunStyle(td);
        // 单元格背景
        const tdShading = readBgColor(td);
        // 单元格边框
        const tdBorders = {};
        for (const side of ['top', 'bottom', 'left', 'right']) {
          const wpx = parseFloat(cs(td, `border-${side}-width`)) || 0;
          const bstyle = cs(td, `border-${side}-style`);
          if (wpx > 0 && bstyle && bstyle !== 'none' && bstyle !== 'hidden') {
            tdBorders[side] = {
              style: bstyle.includes('dash') || bstyle.includes('dot') ? BorderStyle.DASHED : BorderStyle.SINGLE,
              size: Math.max(1, Math.round(wpx * 2)),
              color: colorStrToHex(cs(td, `border-${side}-color`)) || '999999',
            };
          }
        }
        const cellBorders = Object.keys(tdBorders).length ? tdBorders : undefined;
        // 单元格内可能含多个块级元素（Tiptap 表格支持）
        const blockChildren = [...td.childNodes];
        const hasBlocks = blockChildren.some(c => {
          const t = c.nodeType === Node.ELEMENT_NODE ? c.tagName?.toLowerCase() : '';
          return ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'ul', 'ol', 'table', 'blockquote'].includes(t);
        });
        const cellContent = [];
        if (hasBlocks) {
          // 递归处理内部块级元素
          blockChildren.forEach(c => cellContent.push(...processBlockNode(c)));
        } else {
          // 文本+行内：单段落
          const runs = buildTextRuns(td, tdRunStyle);
          if (runs.length > 0) cellContent.push(new Paragraph({ children: runs }));
        }
        if (cellContent.length === 0) cellContent.push(new Paragraph({ text: ' ' }));
        const cellOpts = {
          children: cellContent,
          verticalAlign: VerticalAlign.CENTER,
        };
        if (colWidths[idx]) cellOpts.width = { size: colWidths[idx], type: WidthType.DXA };
        if (tdShading) {
          cellOpts.shading = { fill: tdShading };
        } else {
          cellOpts.shading = { fill: 'ffffff' };
        }
        if (cellBorders) cellOpts.borders = cellBorders;
        if (td.hasAttribute('colspan')) cellOpts.columnSpan = parseInt(td.getAttribute('colspan'));
        if (td.hasAttribute('rowspan')) cellOpts.rowSpan = parseInt(td.getAttribute('rowspan'));
        cells.push(new TableCell(cellOpts));
      });
      if (cells.length > 0) rows.push(new TableRow({ children: cells }));
    });
    if (rows.length > 0) {
      const tableOpts = { rows, width: { size: 9000, type: WidthType.DXA } };
      // 不设置 table-level shading（docx Table 不支持）
      children.push(new Table(tableOpts));
    }
    return children;
  }

  // ===== 列表 =====
  if (tag === 'ul' || tag === 'ol') {
    const isOrdered = tag === 'ol';
    const startIdx = parseInt(node.getAttribute('start')) || 1;
    let itemIndex = startIdx;
    const listChildren = [...node.children]; // 只有直接子级，避免拍平嵌套列表
    listChildren.forEach(li => {
      if (li.tagName?.toLowerCase() !== 'li') {
        children.push(...processBlockNode(li));
        return;
      }
     // 🔧 自动编号去重：检测 <li> 文本是否已包含序号，避免导出时出现 "14. 14. xxx" 双编号
      const liFirstText = (li.textContent || '').trimStart();
      const hasTextNumber = /^\d+[.)、]\s/.test(liFirstText);
      const prefix = isOrdered && !hasTextNumber ? `${itemIndex++}. ` : (isOrdered ? '' : '• ');
      const prefixRuns = prefix ? [new TextRun({ text: prefix })] : [];
      if (isOrdered) itemIndex++; // 即使跳过前缀，索引仍需递增以保持后续编号正确
      const liBlocks = splitGridAwareContent(li, runDefaults, {
        spacing: { before: 40, after: 40 },
        prefixRuns,
        indent: { left: 720 },
        inheritedDeco,
      });
      children.push(...liBlocks);
      // 嵌套列表
      const nestedUlOl = [...li.children].filter(c => ['ul', 'ol'].includes(c.tagName?.toLowerCase()));
      nestedUlOl.forEach(nested => children.push(...processBlockNode(nested)));
    });
    return children;
  }

  // ===== 段落 =====
  if (tag === 'p' || cls.contains('normal-paragraph')) {
    children.push(...splitGridAwareContent(node, runDefaults, { inheritedDeco }));
    return children;
  }

  // ===== 装饰容器 div / blockquote / section / figcaption → 透传子节点 + 继承装饰 =====
  if (['div', 'section', 'figure', 'figcaption', 'article'].includes(tag)) {
    const ownDeco = readBlockDecorations(node);
    const deco = { ...inheritedDeco };
    if (ownDeco.shading) deco.shading = ownDeco.shading;
    if (ownDeco.border) deco.border = ownDeco.border;
    if (ownDeco.spacing) deco.spacing = ownDeco.spacing;
    // 如果子节点全是文本/行内无块，按段落输出
    const childNodes = [...node.childNodes];
    const hasBlockChild = childNodes.some(c => {
      const t = c.nodeType === Node.ELEMENT_NODE ? c.tagName?.toLowerCase() : '';
      return ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'ul', 'ol', 'table', 'blockquote', 'img', 'hr', 'pre'].includes(t);
    });
    if (!hasBlockChild && (node.textContent?.trim())) {
      // 纯行内内容：按段落输出，应用装饰
      const paraOpts = {
        children: buildTextRuns(node, runDefaults),
        spacing: deco.spacing || { before: 80, after: 80 },
        alignment: readAlignment(node),
      };
      if (deco.shading) paraOpts.shading = deco.shading;
      if (deco.border) paraOpts.border = deco.border;
      children.push(new Paragraph(paraOpts));
      return children;
    }
    // 🔧 块级底色：容器含表格时用单格表格包裹，确保段落与表格共享统一底色；
    //    纯段落则各自独立着色保持块级独立性
    const hasTableChild = node.querySelector?.('table');
    if (deco.shading && hasTableChild) {
      // 单格表格包裹：单元格承载底色，表格样式不污染内容结构
      const wrappedChildren = [];
      for (const child of childNodes) {
        // 子元素不继承底色（包裹单元格统一提供），仅透传 ambientShading
        const childCtx = {};
        if (ctx.ambientShading) childCtx.ambientShading = ctx.ambientShading;
        wrappedChildren.push(...processBlockNode(child, childCtx));
      }
      if (wrappedChildren.length > 0) {
        const cellBorders = deco.border || {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        };
        children.push(new Table({
          rows: [new TableRow({
            children: [new TableCell({
              children: wrappedChildren,
              width: { size: 9000, type: WidthType.DXA },
              shading: deco.shading,
              borders: cellBorders,
            })],
          })],
          width: { size: 9000, type: WidthType.DXA },
        }));
      }
      return children;
    }
    // 无表格的底色容器 / 无底色容器：透明透传子节点 + 继承装饰
    // 🔧 连续同色子元素分隔（防 wrapperTable 合并）
    let prevChildHadShading = false;
    for (const child of childNodes) {
      const childDeco = { ...deco };
      const childCtx = { deco: childDeco };
      if (ctx.ambientShading) childCtx.ambientShading = ctx.ambientShading;
      const childResult = processBlockNode(child, childCtx);
      const childOwnDeco = readBlockDecorations(child);
      const childHasShading = !!childOwnDeco.shading;
      if (prevChildHadShading && childHasShading && childResult.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: ' ', size: 1, font: 'Times New Roman' })],
          spacing: { before: 20, after: 20 },
        }));
      }
      children.push(...childResult);
      prevChildHadShading = childHasShading;
    }
    return children;
  }

  // ===== 公式 =====
  if (cls.contains('formula')) {
    children.push(new Paragraph({ text: `【公式】${text}`, spacing: { before: 80, after: 80 }, indent: { left: 360 }, italics: true }));
    return children;
  }

  // ===== 其他 block 元素（默认按段落处理）=====
  if (text) {
    children.push(new Paragraph({ children: buildTextRuns(node, runDefaults), spacing: { before: 40, after: 40 }, alignment: readAlignment(node) }));
  }
  return children;
};

// ============ 公开 API ============

/** 从 contentEditable DOM 构建 docx Document */
export const buildDocxFromDom = (containerEl) => {
  const children = [];
  const allNodes = containerEl.childNodes;
  const elChildren = [];
  for (let i = 0; i < allNodes.length; i++) {
    const n = allNodes[i];
    if (n.nodeType === Node.ELEMENT_NODE) {
      elChildren.push(n);
    }
  }

  // 🔧 顶层 ambient 底色：Tiptap 序列化可能将 table 挤出容器变兄弟，
  //    记住最近底色块 → ctx.ambientShading → TABLE handler 读取，不污染其他元素
  let ambientShading = null;
  // 🔧 连续同色块分隔（Issue #1）：追踪上一个顶层元素是否有自身底色
  //    同底色相邻元素在 Word 中会视觉合并（底纹覆盖段距），
  //    解决方案：在两块之间插入无底色超薄分隔段落，用精确行高控制高度
  let prevHadShading = false;
  let prevResult = null;
  for (let i = 0; i < elChildren.length; i++) {
    const el = elChildren[i];
    const elDeco = readBlockDecorations(el);
    const thisHasShading = !!elDeco.shading;
    if (elDeco.shading) ambientShading = elDeco.shading;
    const ctx = {};
    if (ambientShading) ctx.ambientShading = { ...ambientShading };
    const result = processBlockNode(el, ctx);
    // 🔧 分隔段落分两条路径：
    //    wrapperTable ↔ wrapperTable → 需要可见间距（before:20/after:20），段落无自带间距
    //    普通块 ↔ 普通块 → 超薄 EXACT 分隔，段落自身的 before/after 已足够
    if (prevHadShading && thisHasShading && result.length > 0) {
      const prevIsWrapper = prevResult && prevResult.length === 1 && prevResult[0] instanceof Table;
      const thisIsWrapper = result.length === 1 && result[0] instanceof Table;
      if (prevIsWrapper && thisIsWrapper) {
        children.push(new Paragraph({
          children: [new TextRun({ text: ' ', size: 1, font: 'Times New Roman' })],
          spacing: { before: 20, after: 20 },
        }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: ' ', size: 1, font: 'Times New Roman' })],
          spacing: { before: 0, after: 0, line: 1, lineRule: LineRuleType.EXACT },
        }));
      }
    }
    children.push(...result);
    prevHadShading = thisHasShading;
    prevResult = result;
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
        },
      },
      children,
    }],
  });
};


/** HTML DOM → docx Blob（含 DrawingML 后处理 + 图片预内联） */
export const htmlToDocxBlob = async (containerEl) => {
  // 🔧 预内联外部图片：fetch → dataURL 写入 _inlined 属性
  await inlineImagesForExport(containerEl);
  const doc = buildDocxFromDom(containerEl);
  const blob = await Packer.toBlob(doc);
  const buffer = await blob.arrayBuffer();
  const processed = await injectDrawingML(buffer);
  return new Blob([processed], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
};
