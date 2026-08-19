// ==================== 轻量 DOM → docx 转换器 ====================
// 数据源：contentEditable 实时 DOM（预览看到什么就导出什么）
// 输出：docx 库的 Document 对象 → Packer.toBlob()

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, VerticalAlign, HeightRule, ImageRun, PageBreak, LineRuleType, Footer, PageNumber } from 'docx';
import { TZG_MARKER, TZG_PINYIN_MARKER, FLT_MARKER, FLT_BLANK_MARKER, RUBY_MARKER, injectDrawingML, EMU_PER_DXA as _EMU_PER_DXA } from './drawingMLShapes.js';

// ============ 工具函数 ============

/** 阿拉伯数字 → 罗马数字（列表 type="i"/"I" 导出用） */
const romanize = (n) => {
  const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let r = '';
  let v = n;
  for (const [val, sym] of table) { while (v >= val) { r += sym; v -= val; } }
  return r;
};

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
  // 🔧 跟踪最后一个田字格 marker 在 runs 中的索引（docx 库 TextRun 无 .text 属性可读，
  //    用索引比对判断“上一个 run 是否刚 push 的网格 marker”）
  let lastGridMarkerIdx = -1;

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
      const sizeHp = ctx.size || readFontSizeHp(child) || 32;
      const cellW = Math.round(sizeHp * 18);
      const cellWEmu = Math.round(cellW * EMU_PER_DXA);
      // 🔧 注音田字格：内部含 ruby-char → 拼音画进格子群组（格内带字，拼音浮在字上方）
      const innerRuby = child.querySelector('.ruby-char[data-pinyin]');
      if (innerRuby) {
        const pinyin = innerRuby.getAttribute('data-pinyin') || '';
        const baseText = innerRuby.textContent || extractedText;
        if (pinyin && baseText) {
          runs.push(new TextRun({ text: TZG_PINYIN_MARKER(baseText, pinyin, cellWEmu), size: sizeHp }));
          lastGridMarkerIdx = runs.length - 1;
          return;
        }
      }
      const gridChar = hasVisible ? (child.querySelector('span')?.textContent || extractedText) : ' ';
      runs.push(new TextRun({ text: TZG_MARKER(gridChar, cellWEmu), size: sizeHp }));
      lastGridMarkerIdx = runs.length - 1;
      return;
    }

    // === 特殊 class 白名单（保持优先级，用最终 ctx 替代旧 defaults）===
    if (cls.contains('emphasis-dot')) {
      // 🔧 用标准值 dot（<w:em w:val="dot"/>）：Word/WPS/手机端全部支持；underDot 仅 Microsoft Word 渲染，WPS 等会丢失着重号
      runs.push(new TextRun({ text, emphasisMark: { type: 'dot' }, color: 'D32F2F', ...ctx }));
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
    // === 拼音/注音（ruby-char）—— 用 marker 后处理注入 Word 原生 w:ruby ===
    if (cls.contains('ruby-char')) {
      const pinyin = child.getAttribute('data-pinyin') || '';
      const baseText = child.textContent || '';
      if (!baseText) return;
      const baseSizeHp = ctx.size || readFontSizeHp(child) || 24;
      // 🔧 注音田字格：ruby-char 包田字格/米字格 → 每格一个注音田字格（拼音浮在格内字上方）
      //    （旧逻辑直接 return 吞掉内部田字格，导出只剩注音字）
      const innerGrids = child.querySelectorAll('.tian-zi-ge, .mi-zi-ge');
      if (pinyin && innerGrids.length > 0) {
        const cellW = Math.round(baseSizeHp * 18);
        const cellWEmu = Math.round(cellW * EMU_PER_DXA);
        // 拼音按空格拆成逐字音节，与格子一一对应（数量不符时仅首格带整串）
        const pinyinParts = pinyin.split(/\s+/).filter(Boolean);
        for (let i = 0; i < innerGrids.length; i++) {
          const gridChar = innerGrids[i].querySelector('span')?.textContent || innerGrids[i].textContent.trim() || ' ';
          const p = pinyinParts.length === innerGrids.length ? (pinyinParts[i] || '') : (i === 0 ? pinyin : '');
          runs.push(new TextRun({ text: TZG_PINYIN_MARKER(gridChar, p, cellWEmu), size: baseSizeHp }));
        }
        lastGridMarkerIdx = runs.length - 1;
        return;
      }
      if (pinyin) {
        // 有拼音：用 marker（类似 TZG/FLT），后处理替换为 w:ruby 元素
        runs.push(new TextRun({
          text: RUBY_MARKER(baseText, pinyin, baseSizeHp),
          size: baseSizeHp,
          font: ctx.font,
        }));
      } else {
        // 无拼音：当作普通文字
        runs.push(new TextRun({ text: baseText, size: ctx.size, color: ctx.color, font: ctx.font }));
      }
      return;
    }
    // === 拼音（原生 ruby 标签——GenerateModule 预览直传场景的兜底）===
    if (tag === 'ruby') {
      const rt = child.querySelector('rt');
      const rb = child.querySelector('rb') || child;
      const baseText = rb.textContent?.replace(rt?.textContent || '', '').trim() || text;
      const rtText = rt ? rt.textContent.trim() : '';
      if (rtText) {
        const rubySize = Math.round((ctx.size || 24) * 0.5);
        runs.push(new TextRun({ text: rtText, superScript: true, size: rubySize, font: ctx.font, color: ctx.color || '333333' }));
      }
      runs.push(new TextRun({ text: baseText, ...ctx }));
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
      // 🔧 田字格 marker 后紧跟的末尾 br：AI 原始内容残留，可连续多个
      //    （<td><span class="tian-zi-ge">X</span><br><br></td>），Tiptap 预览加载时
      //    已规范化丢弃（预览看不到该换行），导出跳过以对齐预览所见即所得。
      //    仅跳过“marker 后、且到末尾只有 br/空白”的 br（含连续 br）；格子后有可见内容的 br 照常导出。
      const sibs = Array.from(child.parentNode.childNodes);
      const isTailOnly = !sibs.slice(sibs.indexOf(child) + 1).some(
        (s) => (s.nodeType === Node.TEXT_NODE && s.textContent.trim())
          || (s.nodeType === Node.ELEMENT_NODE && s.tagName !== 'BR')
      );
      if (lastGridMarkerIdx === runs.length - 1 && isTailOnly) return;  // 跳过格子后残留 br（预览中不存在）
      // 🔧 所见即所得：编辑器里的换行原样导出（用户删除的换行在 DOM 中已消失，不会导出）
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
  const padEachSide = Math.round(sizeHp * 2.5);   // ¼em/侧（与导出 pad 文本 NBSP &#xa0; 对齐）
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

/** 注音田字格 → 标记 Paragraph（格内带字，拼音浮在格内字上方） */
export const buildTianZiGePinyinMarker = (gridChar, pinyin, sizeHp, _fontFamily) => {
  const cellW = Math.round(sizeHp * 18);
  const cellWEmu = Math.round(cellW * EMU_PER_DXA);
  return new Paragraph({
    children: [new TextRun({ text: TZG_PINYIN_MARKER(gridChar, pinyin, cellWEmu), size: sizeHp })],
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

/** 表格单元格段落行距：固定值行距（exact）+ 段前段后 0
 *  🔧 用 exact：文字在行盒内垂直居中（auto 多倍行距贴顶→偏上；atLeast 文字贴行盒底→偏下），
 *     且行盒 ≥ 内容高度时不裁切（格行 27.6pt > 田字格 21.6pt、普通行 25pt > 文字 12pt）；
 *  🔧 普通行 = 2.08×字号（≈Word 多倍行距 1.6 的等价行盒，25pt 不拥挤，居中后上下各 6.5pt）；
 *  🔧 含田字格/米字格行：行盒 = 格子 1.8em + 上下各 3pt 间距，
 *     配合格子 anchor 下移 3pt → 格子中心与文字中心重合（同为行盒中心）、上下留白严格对称 */
const tableCellLineSpacing = (el) => {
  const fsPx = parseFloat(cs(el, 'font-size'));
  const sizePt = fsPx ? fsPx * 0.75 : 12; // px → pt（96dpi，16px=12pt）
  const hasGrid = el.querySelector?.('.tian-zi-ge, .mi-zi-ge');
  const line = hasGrid
    ? Math.round((1.8 * sizePt + 6) * 20)  // 格行：1.8em 格高 + 上下各 3pt 间距
    : Math.round(2.08 * sizePt * 20);       // 普通行：2.08×字号 ≈ Word 多倍行距 1.6 的等价行盒（25pt，不拥挤）
  return { line, lineRule: LineRuleType.EXACT, before: 0, after: 0 };
};

const splitGridAwareContent = (node, runDefaults, opts = {}) => {
  const { spacing: _spacingOverride, prefixRuns, indent: extraIndent, inheritedDeco = {}, exactLine = false } = opts;
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
  const baseCtx = { ...defaultRunStyle(node), ...(runDefaults && typeof runDefaults === 'object' ? runDefaults : {}) };
  let spacing = deco.spacing || _spacingOverride || { before: 80, after: 80 };
  // 🔧 表格单元格段落：精确行高 1.6 倍字号 + 段前段后 0（覆盖 CSS 读到的倍数行距）
  if (exactLine) {
    spacing = { ...spacing, ...tableCellLineSpacing(node) };
  } else if (node.querySelector?.('.tian-zi-ge, .mi-zi-ge')) {
    // 🔧 含田字格/米字格的普通段落：行盒 = 格子 1.8em + 上下各 3pt（EXACT 固定行高）。
    //    anchor 形状不占行高，若不预留行盒，1.8em 的格子会与上下行文字重叠；
    //    EXACT 行盒内文字垂直居中，配合行内 anchor 下移 3pt → 格子中心与文字中心重合、
    //    上下留白严格对称（与表格单元格格行同一公式，单元格已调优验证）
    const sizePt = ((baseCtx.size && baseCtx.size > 0) ? baseCtx.size : (readFontSizeHp(node) || 32)) / 2;
    spacing = { ...spacing, line: Math.round((1.8 * sizePt + 6) * 20), lineRule: LineRuleType.EXACT };
  }
  const baseIndent = readIndent(node) ? { firstLine: readIndent(node) } : undefined;
  const paraIndent = extraIndent || baseIndent;
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

  // 🔧 田字格/米字格与文字同行（不再块级拆段）：旧行为把段落拆成 文字/格子/文字 三个
  //    独立段落，导出后格子独占一行、与预览 inline-block 行内形态不符。
  //    格子节点直接进 textBuffer，由 buildTextRuns 输出 TZG_MARKER（与文字同段），
  //    后处理 injectDrawingML 的行内正则将其替换为行内 anchor 形状（anchor 下移 3pt）
  textBuffer.push(...[...node.childNodes]);
  flushText();

  // fallback：节点无子节点时防御兜底（空 <p> 不产生段落）
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
    const sizeHp = runDefaults.size || readFontSizeHp(node) || 32;
    // 🔧 注音田字格（块级）：单段 TZGP marker——拼音画进格子群组，格内带字
    const innerRuby = node.querySelector('.ruby-char[data-pinyin]');
    if (innerRuby) {
      const pinyin = innerRuby.getAttribute('data-pinyin') || '';
      const baseText = innerRuby.textContent || extractedText;
      if (pinyin && baseText) {
        children.push(buildTianZiGePinyinMarker(baseText, pinyin, sizeHp, runDefaults.font || 'SimSun'));
        return children;
      }
    }
    const gridChar = hasVisible ? (node.querySelector('span')?.textContent || extractedText) : ' ';
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
    // 🔧 兼容真实结构：指令仅要求"表格形式"，AI 实际输出 <div class="score-board"><table>…</table></div>
    //    （云端 44 份评分栏文档均为真实 table，无 sb-row 结构）
    //    旧 sb-row 结构继续兼容；真实 table 结构直接按表格导出，避免内容被丢成空方框
    const innerTable = node.querySelector('table');
    if (innerTable) {
      for (const c of node.childNodes) {
        children.push(...processBlockNode(c));
      }
      return children;
    }
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

  // ===== 配图占位框：导出还原为原始 [IMAGE]…[/IMAGE] 结构化标记（复制即用，避免占位文本散架）=====
  if (cls.contains('image-placeholder')) {
    const raw = node.getAttribute('data-image-raw');
    if (raw) {
      const decoded = raw
        .split('&amp;').join('&')
        .split('&lt;').join('<')
        .split('&gt;').join('>')
        .split('&quot;').join('"');
      decoded.split('\n').filter(l => l.trim()).forEach(line => {
        children.push(new Paragraph({ text: line, spacing: { before: 40, after: 40 } }));
      });
      return children;
    }
    // 无 data-image-raw 的旧数据：走下方通用 div 路径按占位框文本导出
  }

  // ===== 标题 =====
  if (tag === 'h1' || cls.contains('main-title')) {
    const deco = readBlockDecorations(node);
    const paraOpts = {
      children: buildTextRuns(node, runDefaults),
      heading: HeadingLevel.HEADING_1,
      spacing: ctx.exactLine ? tableCellLineSpacing(node) : (deco.spacing || { before: 200, after: 120 }),
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
      spacing: ctx.exactLine ? tableCellLineSpacing(node) : (deco.spacing || { before: 160, after: 100 }),
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
      spacing: ctx.exactLine ? tableCellLineSpacing(node) : (deco.spacing || { before: 140, after: 80 }),
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
      spacing: ctx.exactLine ? tableCellLineSpacing(node) : (deco.spacing || { before: 120, after: 60 }),
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
      spacing: ctx.exactLine ? tableCellLineSpacing(node) : (deco.spacing || { before: 100, after: 50 }),
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
      spacing: ctx.exactLine ? tableCellLineSpacing(node) : (deco.spacing || { before: 80, after: 40 }),
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
        // 🔧 表头单元格 th：语义加粗兜底（导出容器无主题 CSS，th 的 font-weight 规则读不到，显式补偿）
        if (td.tagName?.toLowerCase() === 'th') tdRunStyle.bold = true;
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
        // 🔧 纯田字格单元格：Tiptap 规范化后 td 内为 <p><span class="tian-zi-ge">X</span></p>，
        //    若按块级处理会生成 posOffset=0 + line=400auto 的块级田字格段落，格子上方留白丢失（不对称）；
        //    行内形态（anchor 下移 3pt + exact 格行距 1.8em+6pt）才是已验证的上下各 3pt 对称留白。
        //    故仅含单个纯田字格/米字格 p 的单元格按行内处理，等价于 AI 原始 <td><span class="tian-zi-ge">X</span></td>。
        const isPureGridCell = (() => {
          const blocks = blockChildren.filter(c => c.nodeType === Node.ELEMENT_NODE);
          if (blocks.length !== 1) return false;  // 多段内容保持块级（用户分段不可丢）
          const p = blocks[0];
          if (p.tagName?.toLowerCase() !== 'p') return false;
          // p 内不得有直接可见文本（仅 span 内的格子字符）
          const hasDirectText = [...p.childNodes].some(c => c.nodeType === Node.TEXT_NODE && (c.textContent || '').trim());
          if (hasDirectText) return false;
          const spans = [...p.children];
          return spans.length > 0 && spans.every(c => c.tagName?.toLowerCase() === 'span'
            && (c.classList?.contains('tian-zi-ge') || c.classList?.contains('mi-zi-ge')));
        })();
        const hasBlocks = !isPureGridCell && blockChildren.some(c => {
          const t = c.nodeType === Node.ELEMENT_NODE ? c.tagName?.toLowerCase() : '';
          return ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'ul', 'ol', 'table', 'blockquote'].includes(t);
        });
        const cellContent = [];
        if (hasBlocks) {
          // 递归处理内部块级元素（表格单元格段落：精确行高 1.6 倍 + 段前段后 0）
          blockChildren.forEach(c => cellContent.push(...processBlockNode(c, { ...ctx, exactLine: true, runDefaults: tdRunStyle })));
        } else {
          // 文本+行内：单段落
          const runs = buildTextRuns(td, tdRunStyle);
          if (runs.length > 0) cellContent.push(new Paragraph({ children: runs, spacing: tableCellLineSpacing(td) }));
        }
        if (cellContent.length === 0) cellContent.push(new Paragraph({ text: ' ', spacing: tableCellLineSpacing(td) }));
        // 🔧 表格内容左缩进 0.3 字符：tcMar left = Word 默认 108 twip + 0.3em（与预览 padding-left: calc(8px + 0.3em) 对应）
        const cellLeftMarTwip = 108 + Math.round(0.3 * (tdRunStyle.size || 24) * 10);
        const cellOpts = {
          children: cellContent,
          verticalAlign: VerticalAlign.CENTER,
          margins: { left: cellLeftMarTwip },
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
      // 🔧 表格左缩进对齐正文首行（.indent-2 = 2em = 480 twip），与预览 CSS margin-left:2em 一致；
      //    单元格内嵌套表格（ctx.exactLine）保持全宽不缩进，避免超出单元格宽度
      const tableIndentTwip = ctx.exactLine ? 0 : 480;
      const tableOpts = {
        rows,
        width: { size: 9000 - tableIndentTwip, type: WidthType.DXA },
      };
      if (tableIndentTwip > 0) tableOpts.indent = { size: tableIndentTwip, type: WidthType.DXA };
      // 不设置 table-level shading（docx Table 不支持）
      children.push(new Table(tableOpts));
      // 🔧 表格下方间距：预览靠 CSS table{margin:8px 0} 留空隙，但 Word 表格无“外边距”概念，
      //    后续段落段前又=0（规范“段距统一由段后控制”），导出后文字会紧贴表格底边框。
      //    插入超薄间隔段（EXACT 行距≈0 不占行），用段前/段后距在表格下方补 6pt 空隙（=预览 8px）
      children.push(new Paragraph({
        children: [new TextRun({ text: ' ', size: 1, font: 'Times New Roman' })],
        spacing: { before: 120, after: 120, line: 1, lineRule: LineRuleType.EXACT },
      }));
    }
    return children;
  }

  // ===== 列表 =====
  if (tag === 'ul' || tag === 'ol') {
    const isOrdered = tag === 'ol';
    const startIdx = parseInt(node.getAttribute('start')) || 1;
    // 🔧 列表 type 支持：ol type="a"/"A"/"i"/"I"（字母/罗马数字），ul type="circle"/"square"（空心圆/方块）
    const listType = node.getAttribute('type') || '';
    const listTypeLc = listType.toLowerCase();
    let itemIndex = startIdx;
    const listChildren = [...node.children]; // 只有直接子级，避免拍平嵌套列表
    listChildren.forEach(li => {
      if (li.tagName?.toLowerCase() !== 'li') {
        children.push(...processBlockNode(li));
        return;
      }
      // 🔧 自动编号去重：检测 <li> 文本是否已包含序号，避免导出时出现 "1. 1. xxx" 双编号
      const liFirstText = (li.textContent || '').trimStart();
      const hasTextNumber = /^\d+[.)、]\s/.test(liFirstText) || /^[a-zA-Z][.)、]\s/.test(liFirstText);
      let prefix = '';
      if (isOrdered) {
        if (!hasTextNumber) {
          const idx0 = itemIndex - startIdx; // 0 基序号（支持 start 起始值）
          if (listType === 'a') prefix = `${String.fromCharCode(97 + (idx0 % 26))}. `;
          else if (listType === 'A') prefix = `${String.fromCharCode(65 + (idx0 % 26))}. `;
          else if (listType === 'i') prefix = `${romanize(itemIndex).toLowerCase()}. `;
          else if (listType === 'I') prefix = `${romanize(itemIndex)}. `;
          else prefix = `${itemIndex}. `;
        }
        itemIndex++; // 🔧 只在此处递增：旧实现前缀里 itemIndex++ 后又自增一次 → 编号 1,3,5 跳号
      } else {
        // 无序列表符号：默认圆点，支持 circle/square 形式
        prefix = listTypeLc === 'circle' ? '○ ' : listTypeLc === 'square' ? '▪ ' : '• ';
      }
      // 🔧 编号前缀继承正文字号/字体/颜色：旧实现未传 size，落到 docx 默认 11pt，
      //    导致导出时编号比正文明显缩小
      const effCtx = ctx.runDefaults || {};
      const prefixRuns = prefix ? [new TextRun({
        text: prefix,
        size: effCtx.size || runDefaults.size,
        font: effCtx.font || runDefaults.font,
        color: effCtx.color || runDefaults.color,
      })] : [];
      const liBlocks = splitGridAwareContent(li, { ...runDefaults, ...(ctx.runDefaults || {}) }, {
        spacing: { before: 40, after: 40 },
        prefixRuns,
        indent: { left: 720 },
        inheritedDeco,
        exactLine: ctx.exactLine,
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
    children.push(...splitGridAwareContent(node, { ...runDefaults, ...(ctx.runDefaults || {}) }, { inheritedDeco, exactLine: ctx.exactLine }));
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
        if (ctx.exactLine) childCtx.exactLine = ctx.exactLine;
        if (ctx.runDefaults) childCtx.runDefaults = ctx.runDefaults;
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
      if (ctx.exactLine) childCtx.exactLine = ctx.exactLine;
      if (ctx.runDefaults) childCtx.runDefaults = ctx.runDefaults;
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
      // 🔧 页码页脚：落地蓝本卷面规范"每页页脚居中标注'第X页　共X页'"（Word 字段自动计算，AI 无法预知总页数）
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页　共 ', PageNumber.TOTAL_PAGES, ' 页'], size: 18 })],
            }),
          ],
        }),
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
