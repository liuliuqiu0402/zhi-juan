// ==================== Word导出工具函数 ====================

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
