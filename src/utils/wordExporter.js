// ==================== Word导出工具函数 ====================
import { TextRun, BorderStyle } from 'docx';

/**
 * 将LaTeX公式文本转换为可读文本
 * 处理: 分数、根号、上标、下标、特殊符号
 */
export const convertFormulaToText = (formula) => {
  let text = formula.trim();
  // 分数 a/b
  text = text.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2');
  // 根号 √a
  text = text.replace(/\\sqrt(?:\[([^}]*)\])?\{([^}]*)\}/g, '√$2');
  // 特殊符号
  text = text.replace(/\\cdot/g, '\u00B7');
  text = text.replace(/\\pm/g, '\u00B1');
  text = text.replace(/\\times/g, '\u00D7');
  text = text.replace(/\\div/g, '\u00F7');
  text = text.replace(/\\rightarrow/g, '\u2192');
  text = text.replace(/\\leftarrow/g, '\u2190');
  text = text.replace(/\\Rightarrow/g, '\u21D2');
  text = text.replace(/\\alpha/g, '\u03B1');
  text = text.replace(/\\beta/g, '\u03B2');
  text = text.replace(/\\gamma/g, '\u03B3');
  text = text.replace(/\\pi/g, '\u03C0');
  text = text.replace(/\\theta/g, '\u03B8');
  text = text.replace(/\\Delta/g, '\u0394');
  text = text.replace(/\\sum/g, '\u03A3');
  text = text.replace(/\\to/g, '\u2192');
  text = text.replace(/\\infty/g, '\u221E');
  text = text.replace(/\\neq/g, '\u2260');
  text = text.replace(/\\geq/g, '\u2265');
  text = text.replace(/\\leq/g, '\u2264');
  text = text.replace(/\\approx/g, '\u2248');
  text = text.replace(/\\text\{([^}]*)\}/g, '$1');
  // 🔧 上标符号（无 Unicode 上标版的保持原字符）
  text = text.replace(/\^\{\*\}/g, '*');        // ^{*} → *
  text = text.replace(/\^\{?\+}?/g, '\u207A');  // ^{+} → ⁺
  text = text.replace(/\^\{?-}?/g, '\u207B');   // ^{-} → ⁻
  // 上标: x^2 → x²
  const superscriptDigits = { '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079' };
  text = text.replace(/([a-zA-Z0-9])\^(\d+)/g, (match, base, exp) => {
    return base + exp.split('').map(d => superscriptDigits[d] || d).join('');
  });
  // 下标: H_2 → H₂
  const subscriptDigits = { '0': '\u2080', '1': '\u2081', '2': '\u2082', '3': '\u2083', '4': '\u2084', '5': '\u2085', '6': '\u2086', '7': '\u2087', '8': '\u2088', '9': '\u2089' };
  text = text.replace(/([a-zA-Z])\_(\d+)/g, (match, base, sub) => {
    return base + sub.split('').map(d => subscriptDigits[d] || d).join('');
  });
  // 清理残留的LaTeX命令和花括号
  text = text.replace(/[{}\\]/g, '');
  return text.trim();
};

/**
 * 将HTML内容中的 $...$ 和 $$...$$ 公式标记转换为可读文本
 * 用于预览和PDF导出的前置处理
 */
export const convertFormulasInHtml = (html) => {
  let result = html;
  // 先处理 $$...$$（独立公式，避免与 $...$ 冲突）
  result = result.replace(/\$\$(.+?)\$\$/g, (match, formula) => {
    return convertFormulaToText(formula);
  });
  // 再处理 $...$（行内公式）
  result = result.replace(/\$(.+?)\$/g, (match, formula) => {
    return convertFormulaToText(formula);
  });
  return result;
};

/**
 * 将带有HTML标记的文本解析为 docx TextRun 数组
 * 全面支持: 加点字、画线句子、波浪线、上下标、拼音、部首、笔顺、
 * 田字格、米字格、口算框、化学条件、双线格、单线格、词库框、得分框、
 * 公式、加粗、斜体、下划线、高亮、删除线
 */
/**
 * 解析 Markdown/HTML 文本为 docx TextRun 数组
 * @param {string} markdown - Markdown/HTML 文本
 * @param {Object} [defaultStyle] - 默认样式，应用到无特殊标记的普通文本
 * @param {string} [defaultStyle.font] - 字体
 * @param {number} [defaultStyle.size] - 字号（半磅单位，如 12pt = 24）
 * @param {boolean} [defaultStyle.bold] - 加粗
 * @param {string} [defaultStyle.color] - 颜色（如 '1e3a6f'）
 * @param {boolean} [defaultStyle.italics] - 斜体
 */
export const parseMarkdownToTextRuns = (markdown, defaultStyle = null) => {
  const runs = [];
  let remaining = markdown;

  while (remaining.length > 0) {

    // ===== 着重号（加点字） =====
    const emphasisDotMatch = remaining.match(/^<span class="emphasis-dot">(.+?)<\/span>/);
    if (emphasisDotMatch) {
      // 🔧 补着重号格式（此前仅加粗红色，点丢失）；用标准值 dot 保证 WPS/手机端兼容
      runs.push(new TextRun({ text: emphasisDotMatch[1], bold: true, color: 'D32F2F', emphasisMark: { type: 'dot' } }));
      remaining = remaining.slice(emphasisDotMatch[0].length);
      continue;
    }

    // ===== 画线句子 =====
    const underlineSentenceMatch = remaining.match(/^<u class="underline-sentence">(.+?)<\/u>/);
    if (underlineSentenceMatch) {
      runs.push(new TextRun({ text: underlineSentenceMatch[1], underline: { type: 'single' } }));
      remaining = remaining.slice(underlineSentenceMatch[0].length);
      continue;
    }

    // ===== 波浪线（病句修改） =====
    const wavyMatch = remaining.match(/^<span class="wavy-underline">(.+?)<\/span>/);
    if (wavyMatch) {
      runs.push(new TextRun({ text: wavyMatch[1], underline: { type: 'wavy', color: 'D32F2F' } }));
      remaining = remaining.slice(wavyMatch[0].length);
      continue;
    }

    // ===== 双线格 =====
    const doubleLineMatch = remaining.match(/^<span class="double-line">(.+?)<\/span>/);
    if (doubleLineMatch) {
      runs.push(new TextRun({ text: doubleLineMatch[1], underline: { type: 'double' } }));
      remaining = remaining.slice(doubleLineMatch[0].length);
      continue;
    }

    // ===== 单线格 =====
    const singleLineMatch = remaining.match(/^<span class="single-line">(.+?)<\/span>/);
    if (singleLineMatch) {
      runs.push(new TextRun({ text: singleLineMatch[1], underline: { type: 'single' } }));
      remaining = remaining.slice(singleLineMatch[0].length);
      continue;
    }

    // ===== 拼音标注 =====
    const rubyMatch = remaining.match(/^<ruby>(.+?)<rt>(.+?)<\/rt><\/ruby>/);
    if (rubyMatch) {
      runs.push(new TextRun({ text: `${rubyMatch[1]}(${rubyMatch[2]})` }));
      remaining = remaining.slice(rubyMatch[0].length);
      continue;
    }

    // ===== 部首标注 =====
    const radicalMatch = remaining.match(/^<ruby class="radical"><rb>(.+?)<\/rb><rt>(.+?)<\/rt><\/ruby>/);
    if (radicalMatch) {
      runs.push(new TextRun({ text: `${radicalMatch[1]}(${radicalMatch[2]})` }));
      remaining = remaining.slice(radicalMatch[0].length);
      continue;
    }

    // ===== 笔画笔顺 =====
    const strokeMatch = remaining.match(/^<span class="stroke-order" data-strokes="(\d+)">(.+?)<\/span>/);
    if (strokeMatch) {
      runs.push(new TextRun({ text: `${strokeMatch[2]}(${strokeMatch[1]}画)` }));
      remaining = remaining.slice(strokeMatch[0].length);
      continue;
    }

    // ===== 田字格 → 带边框字符（无 COM 依赖）=====
    //    ⭐ 兼容两种格式：平直 <span class="tian-zi-ge">字</span> 和嵌套 <span class="tian-zi-ge" style="..."><span>字</span></span>
    const tianZiOpen = remaining.match(/^<span class="tian-zi-ge"[^>]*>/);
    if (tianZiOpen) {
      // 解析字号（默认 14pt = 28 half-points）
      const fsMatch = tianZiOpen[0].match(/font-size:\s*(\d+)\s*pt/i);
      const sizeHp = fsMatch ? parseInt(fsMatch[1]) * 2 : 28;
      // 处理可能的嵌套 span，找匹配的 </span>
      let depth = 1;
      let pos = tianZiOpen[0].length;
      let found = false;
      while (depth > 0 && pos < remaining.length) {
        const nextOpen = remaining.indexOf('<span', pos);
        const nextClose = remaining.indexOf('</span>', pos);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 5; }
        else {
          depth--;
          if (depth === 0) {
            const innerHtml = remaining.slice(tianZiOpen[0].length, nextClose);
            const text = innerHtml.replace(/<[^>]*>/g, '').trim();
            if (text) {
              runs.push(new TextRun({ text, border: { style: BorderStyle.SINGLE, size: 2, color: '999999' }, size: sizeHp, font: 'SimSun' }));
            }
            remaining = remaining.slice(nextClose + 7);
            found = true;
            break;
          }
          pos = nextClose + 7;
        }
      }
      if (found) continue;
    }

    // ===== 米字格 → 带边框字符 =====
    const miZiOpen = remaining.match(/^<span class="mi-zi-ge"[^>]*>/);
    if (miZiOpen) {
      const fsMatch = miZiOpen[0].match(/font-size:\s*(\d+)\s*pt/i);
      const sizeHp = fsMatch ? parseInt(fsMatch[1]) * 2 : 28;
      let depth = 1;
      let pos = miZiOpen[0].length;
      let found = false;
      while (depth > 0 && pos < remaining.length) {
        const nextOpen = remaining.indexOf('<span', pos);
        const nextClose = remaining.indexOf('</span>', pos);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 5; }
        else {
          depth--;
          if (depth === 0) {
            const innerHtml = remaining.slice(miZiOpen[0].length, nextClose);
            const text = innerHtml.replace(/<[^>]*>/g, '').trim();
            if (text) {
              runs.push(new TextRun({ text, border: { style: BorderStyle.SINGLE, size: 2, color: '999999' }, size: sizeHp, font: 'SimSun' }));
            }
            remaining = remaining.slice(nextClose + 7);
            found = true;
            break;
          }
          pos = nextClose + 7;
        }
      }
      if (found) continue;
    }

    // ===== 四线三格 / 四线格 → 带边框字符（支持 class 中任意位置匹配） =====
    const fltOpen = remaining.match(/^<span class="[^"]*\b(?:four-line-three|sixian-ge)\b[^"]*"[^>]*>/);
    if (fltOpen) {
      const fsMatch = fltOpen[0].match(/font-size:\s*(\d+)\s*pt/i);
      const sizeHp = fsMatch ? parseInt(fsMatch[1]) * 2 : 28;
      const nextClose = remaining.indexOf('</span>', fltOpen[0].length);
      if (nextClose !== -1) {
        const text = remaining.slice(fltOpen[0].length, nextClose).replace(/<[^>]*>/g, '').trim();
        if (text) {
          runs.push(new TextRun({ text, border: { style: BorderStyle.SINGLE, size: 2, color: '999999' }, size: sizeHp, font: 'Times New Roman' }));
        }
        remaining = remaining.slice(nextClose + 7);
        continue;
      }
    }

    // ===== 普通横线 blank-line → 带下划线的空格 =====
    const blankLineMatch = remaining.match(/^<span class="blank-line"[^>]*>([^<]*)<\/span>/);
    if (blankLineMatch) {
      const blankText = blankLineMatch[1] || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0';
      runs.push(new TextRun({ text: blankText, underline: { type: 'single' } }));
      remaining = remaining.slice(blankLineMatch[0].length);
      continue;
    }

    // ===== 上标 =====
    const superscriptMatch = remaining.match(/^<sup>(.+?)<\/sup>/);
    if (superscriptMatch) {
      runs.push(new TextRun({ text: superscriptMatch[1], verticalAlign: 'superscript' }));
      remaining = remaining.slice(superscriptMatch[0].length);
      continue;
    }

    // ===== 下标 =====
    const subscriptMatch = remaining.match(/^<sub>(.+?)<\/sub>/);
    if (subscriptMatch) {
      runs.push(new TextRun({ text: subscriptMatch[1], verticalAlign: 'subscript' }));
      remaining = remaining.slice(subscriptMatch[0].length);
      continue;
    }

    // ===== 口算框 =====
    const oralBoxMatch = remaining.match(/^<span class="oral-box(?:\s+blank)?">(.+?)<\/span>/);
    if (oralBoxMatch) {
      runs.push(new TextRun({ text: oralBoxMatch[1], border: { style: 'single', size: 1 } }));
      remaining = remaining.slice(oralBoxMatch[0].length);
      continue;
    }

    // ===== 化学反应条件 =====
    const chemMatch = remaining.match(/^<span class="chem-condition">(.+?)<\/span>/);
    if (chemMatch) {
      runs.push(new TextRun({ text: chemMatch[1], size: 14, superScript: true }));
      remaining = remaining.slice(chemMatch[0].length);
      continue;
    }

    // ===== 词库框（完形填空） =====
    const wbMatch = remaining.match(/^<span class="wb-item">(.+?)<\/span>/);
    if (wbMatch) {
      runs.push(new TextRun({ text: wbMatch[1], border: { style: 'single', size: 1 } }));
      remaining = remaining.slice(wbMatch[0].length);
      continue;
    }

    // ===== 方框填空 =====
    const squareBoxMatch = remaining.match(/^<span class="square-box">(.+?)<\/span>/);
    if (squareBoxMatch) {
      runs.push(new TextRun({ text: squareBoxMatch[1], border: { style: 'single', size: 2 } }));
      remaining = remaining.slice(squareBoxMatch[0].length);
      continue;
    }

    // ===== 得分框 =====
    const scoreMatch = remaining.match(/^<span class="score-box">(.+?)<\/span>/);
    if (scoreMatch) {
      runs.push(new TextRun({ text: scoreMatch[1], border: { style: 'single', size: 1 } }));
      remaining = remaining.slice(scoreMatch[0].length);
      continue;
    }

    // ===== 上标 =====
    // 兼容旧格式：带class="superscript"的span
    const supSpanMatch = remaining.match(/^<span[^>]*class="superscript"[^>]*>(.+?)<\/span>/);
    if (supSpanMatch) {
      runs.push(new TextRun({ text: supSpanMatch[1], verticalAlign: 'superscript' }));
      remaining = remaining.slice(supSpanMatch[0].length);
      continue;
    }

    // ===== 下标 =====
    // 兼容旧格式：带class="subscript"的span
    const subSpanMatch = remaining.match(/^<span[^>]*class="subscript"[^>]*>(.+?)<\/span>/);
    if (subSpanMatch) {
      runs.push(new TextRun({ text: subSpanMatch[1], verticalAlign: 'subscript' }));
      remaining = remaining.slice(subSpanMatch[0].length);
      continue;
    }

    // ===== 填空横线（blank-N） =====
    const blankMatch = remaining.match(/^<u class="blank-(\d+)">(.+?)<\/u>/);
    if (blankMatch) {
      const blankLen = parseInt(blankMatch[1]) || 2;
      // 用不间断空格+下划线模拟填空题留空，间距按2倍计算
      runs.push(new TextRun({
        text: '\u00A0'.repeat(blankLen * 6 + 4),
        underline: { type: 'single' }
      }));
      remaining = remaining.slice(blankMatch[0].length);
      continue;
    }

    // ===== <u>普通下划线 =====
    const uMatch = remaining.match(/^<u>(.+?)<\/u>/);
    if (uMatch) {
      runs.push(new TextRun({ text: uMatch[1], underline: { type: 'single' } }));
      remaining = remaining.slice(uMatch[0].length);
      continue;
    }

    // ===== <strong>/<b> 粗体 =====
    const htmlBoldMatch = remaining.match(/^<(?:strong|b)>(.+?)<\/(?:strong|b)>/);
    if (htmlBoldMatch) {
      runs.push(new TextRun({ text: htmlBoldMatch[1], bold: true }));
      remaining = remaining.slice(htmlBoldMatch[0].length);
      continue;
    }

    // ===== <em>/<i> 斜体 =====
    const htmlItalicMatch = remaining.match(/^<(?:em|i)>(.+?)<\/(?:em|i)>/);
    if (htmlItalicMatch) {
      runs.push(new TextRun({ text: htmlItalicMatch[1], italics: true }));
      remaining = remaining.slice(htmlItalicMatch[0].length);
      continue;
    }

    // ===== **加粗** =====
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      runs.push(new TextRun({ text: boldMatch[1], bold: true }));
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // ===== *斜体* =====
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      runs.push(new TextRun({ text: italicMatch[1], italics: true }));
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // ===== _下划线_ =====
    const underlineMatch = remaining.match(/^_(.+?)_/);
    if (underlineMatch) {
      runs.push(new TextRun({ text: underlineMatch[1], underline: {} }));
      remaining = remaining.slice(underlineMatch[0].length);
      continue;
    }

    // ===== ==高亮== =====
    const highlightMatch = remaining.match(/^==(.+?)==/);
    if (highlightMatch) {
      runs.push(new TextRun({ text: highlightMatch[1], highlight: 'yellow' }));
      remaining = remaining.slice(highlightMatch[0].length);
      continue;
    }

    // ===== ~~删除线~~ =====
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      runs.push(new TextRun({ text: strikeMatch[1], strike: true }));
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // ===== <del>删除线</del>或<s>删除线</s> =====
    const delMatch = remaining.match(/^<(?:del|s)>(.+?)<\/(?:del|s)>/);
    if (delMatch) {
      runs.push(new TextRun({ text: delMatch[1], strike: true }));
      remaining = remaining.slice(delMatch[0].length);
      continue;
    }

    // ===== $...$ 行内公式 =====
    const formulaMatch = remaining.match(/^(\$\$?)(.+?)\1/);
    if (formulaMatch) {
      runs.push(new TextRun({
        text: convertFormulaToText(formulaMatch[2]),
        italics: true,
        color: '1A237E'
      }));
      remaining = remaining.slice(formulaMatch[0].length);
      continue;
    }

    // 普通文本（找到下一个标记之前）
    const nextMark = remaining.match(/<span class="(?:emphasis-dot|wavy-underline|double-line|single-line|oral-box(?:\s+blank)?|chem-condition|tian-zi-ge|mi-zi-ge|stroke-order|wb-item|square-box|score-box)">|<u(?: class="(?:underline-sentence|blank-\d+)")?>|<ruby[^>]*>|<(?:strong|b|em|i|sup|sub|del|s)>|\$\$?|\*\*|\*|_|==|~~/);
    if (nextMark) {
      const plainText = remaining.substring(0, nextMark.index);
      if (plainText) {
        runs.push(new TextRun({ text: plainText, ...(defaultStyle || {}) }));
      }
      remaining = remaining.slice(nextMark.index);
    } else {
      runs.push(new TextRun({ text: remaining, ...(defaultStyle || {}) }));
      break;
    }
  }

  return runs;
};

/**
 * 创建默认的Word文档章节属性（A4纸，标准边距）
 * docx库使用 TWIP 单位（1英寸 = 1440 TWIP）
 */
export const createDefaultSectionProperties = () => ({
  page: {
    size: {
      width: 11906,   // A4 宽度 (210mm)
      height: 16838   // A4 高度 (297mm)
    },
    margin: {
      top: 1440,      // 1英寸 ≈ 2.54cm
      bottom: 1440,
      left: 1440,
      right: 1440
    }
  }
});

/**
 * 打印专用CSS样式
 * 用于非Electron环境的浏览器打印降级
 * @param {boolean} [sealLike=false] 密封线试卷：@page 边距归零、body 不留白，
 *   由页面壳 .sealed-wrapper 的 2cm 内边距提供页边距（避免 @page 20mm 与之叠加成 40mm）
 */
export const getPrintCss = (sealLike = false) => `
  @page {
    size: A4;
    margin: ${sealLike ? 0 : '20mm'};
  }
  body {
    margin: 0;
    padding: ${sealLike ? 0 : '20px'};
    font-family: SimSun, 'Microsoft YaHei', serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #1e1e1e;
  }
  @media print {
    h1, h2, h3, h4 { page-break-after: avoid; }
    table, figure, pre, blockquote { page-break-inside: avoid; }
    /* 🔧 卷面规范：答案区另起一页（浏览器打印降级同样生效） */
    .answer-section { page-break-before: always; }
    .no-print { display: none !important; }
  }
`;
