// ============================================================
// 作答载体 CSS 单一事实源（填空横线 u.blank-N / 括号空位 span.blank-N /
// 整行横线 .blank-line / 行尾弹性延伸）
// ============================================================
// 🔴 消费方：main.js 全局注入（替代原 styles/global.css 里的静态副本）、
//    themeConfig 独立导出文档（HTML/PDF 自带内嵌样式）。
//    曾 global.css / themeConfig / RichTextEditor 深规则各自维护同规则，
//    改档位需多处手动同步 → 现收敛此处，改规则只改本文件。
//    宽度档位 1..24 与排版规格库 layoutSpec.sanitizeBlankSpec 上限一致。
// ============================================================

const TIERS = Array.from({ length: 24 }, (_, i) => i + 1);

/** u.blank-N 宽度档位（1 档 = 1em） */
const uWidthCss = () => TIERS.map((n) => `u.blank-${n}{min-width:${n}em;}`).join('\n');

/** span.blank-N 括号填空：伪元素括号外置，书写空间 = 中间 minmax(N em,1fr) 轨
 *（与 Word 导出 "(" + NBSP×N + ")" 同口径，括号内恰为 N em） */
const spanGridCss = () => TIERS.map((n) => `span.blank-${n}{grid-template-columns:auto minmax(${n}em,1fr) auto;}`).join('\n');

/**
 * 括号填空/整行横线/行尾延伸基础（不含 u 横线本体，u 横线见 CARRIER_CSS 首段）
 * 基线对齐：span 用 inline-grid + align-items/vertical-align baseline，
 * 使括号伪元素与正文文字同一基线（曾 vertical-align:middle 导致与中文行不对齐）
 */
export const CARRIER_EXTRA_CSS = `
span[class*="blank-"]:not(.blank-line){display:inline-grid;grid-template-columns:auto 1fr auto;align-items:baseline;vertical-align:baseline;text-align:center;}
span[class*="blank-"]:not(.blank-line)::before{content:"(";font-weight:normal;}
span[class*="blank-"]:not(.blank-line)::after{content:")";font-weight:normal;}
${spanGridCss()}
span.blank-line::before,span.blank-line::after{content:none !important;}
.blank-line{display:inline-block;min-width:3em;border-bottom:1.5px solid #666;margin:0 2px;vertical-align:baseline;}
p:has(> .blank-line:last-child),p:has(> u[class*="blank-"]:last-child){display:flex;align-items:baseline;}
p:has(> .blank-line:last-child) .blank-line,p:has(> u[class*="blank-"]:last-child) u[class*="blank-"]{flex:1 1 auto;min-width:3em;}
`;

/** 作答载体完整 CSS（全局注入与独立导出文档共用）：u 横线本体 + 宽度档位 + 括号/整行横线/行尾延伸 */
export const CARRIER_CSS = `
/* 填空横线 u.blank-N：border-bottom 画线（与 Word ptab/NBSP 兜底同视觉），text-decoration:none 免与普通下划线叠加 */
u[class*="blank-"]{display:inline-block;text-align:center;text-decoration:none;border-bottom:1.5px solid #333;padding:0 1px;font-size:inherit !important;min-width:1em;}
${uWidthCss()}
${CARRIER_EXTRA_CSS}
`;

export default CARRIER_CSS;
