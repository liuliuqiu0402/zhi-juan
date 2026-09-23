/**
 * 公式渲染补充样式（KaTeX 本体样式之外的**项目自有规则**）
 * ============================================================
 * 🔴 单一事实源：编辑器 / 预览 / HTML 导出 / PDF 导出共用同一份，禁止各端各写一份
 *    （本项目已有"同构副本各自演化"的历史教训：转义、载体样式、宽度梯形都曾双份漂移）。
 * 用法：
 *   - 应用内：main.js 启动时注入 <style>（与 CARRIER_CSS 同一模式）
 *   - 导出：mathRender.withKatexStyles 把它拼在 KaTeX 样式前面一起内联
 * 说明：字体与 KaTeX 基础样式由 `katex/dist/katex.min.css` 提供（应用内走构建产物，
 *       导出走 data URL 内联版），本文件只管"块级公式独占一行"这类项目口径。
 * ============================================================
 */

/** 块级公式（$$…$$）独占一行并留出上下间距；失败降级态不倾斜（保持与正文一致） */
export const MATH_CSS =
  '.zwg-math-display{display:block}'
  + '.zwg-math-display .katex-display{margin:.55em 0}'
  + '.zwg-math-fallback{font-style:normal}';

export default { MATH_CSS };
