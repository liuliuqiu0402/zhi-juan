// ============================================================
// 作答载体 CSS 单一事实源（填空横线 u.blank-N / 括号空位 span.blank-N /
// 整行横线 .blank-line / 行尾弹性延伸 / 四线三格·六线格·拼音格·英语书写格）
// ============================================================
// 🔴 消费方：main.js 全局注入（替代原 styles/global.css 里的静态副本）、
//    themeConfig 独立导出文档（HTML/PDF 自带内嵌样式）。
//    曾 global.css / themeConfig / RichTextEditor 深规则 / TypesetModule 各自维护同规则，
//    改档位/线位/线色需多处手动同步 → 现收敛此处，改规则只改本文件。
//    宽度档位 1..24 与排版规格库 layoutSpec.sanitizeBlankSpec 上限一致。
//    四线三格/六线格行高 = CSS 变量 --flt-h（默认 9mm；排版模块按文档学段注入，
//    GRID_CELL four-line-three：小学 9 / 初中 8mm；Word 导出几何见 docxBuilder，另口径）
// ============================================================

const TIERS = Array.from({ length: 24 }, (_, i) => i + 1);

/** u.blank-N 宽度档位（1 档 = 1em） */
const uWidthCss = () => TIERS.map((n) => `u.blank-${n}{min-width:${n}em;}`).join('\n');

/** span.blank-N 括号填空：伪元素括号外置，书写空间 = 中间 minmax(N em,1fr) 轨
 *（与 Word 导出 "(" + NBSP×N + ")" 同口径，括号内恰为 N em） */
const spanGridCss = () => TIERS.map((n) => `span.blank-${n}{grid-template-columns:auto minmax(${n}em,1fr) auto;}`).join('\n');

/** 四线三格/六线格/拼音格/英语书写格（行高 CSS 变量化，线位百分比等距三等带：
 * 线在 6.7%/36.7%/66.7%/96.7%，三条浅线 var(--flt-soft,#999) + 基线 var(--flt-strong,#666)） */
export const CARRIER_LINE_CSS = `
.four-line-three, .sixian-ge { display: inline-block; position: relative; padding: 4px 4px; font-size: inherit !important; line-height: 1; min-width: 18px; text-align: center; vertical-align: middle; text-indent: 0; }
.four-line-three { font-family: 'Times New Roman', 'Georgia', SimSun, serif; }
.sixian-ge { font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif; }
.four-line-three::before, .sixian-ge::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: var(--flt-h, 9mm); background: linear-gradient(var(--flt-soft,#999),var(--flt-soft,#999)) 0 6.7%/100% 1px no-repeat, linear-gradient(var(--flt-soft,#999),var(--flt-soft,#999)) 0 36.7%/100% 1px no-repeat, linear-gradient(var(--flt-strong,#666),var(--flt-strong,#666)) 0 66.7%/100% 1px no-repeat, linear-gradient(var(--flt-soft,#999),var(--flt-soft,#999)) 0 96.7%/100% 1px no-repeat; pointer-events: none; }
.pinyin-line { font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif; }
.english-line { font-family: 'Times New Roman', 'Georgia', serif; }
`;

/**
 * 括号填空/整行横线/行尾延伸基础（不含 u 横线本体，u 横线见 CARRIER_CSS 首段）
 * 基线对齐：span 用 inline-grid + align-items/vertical-align baseline，
 * 使括号伪元素与正文文字同一基线（曾 vertical-align:middle 导致与中文行不对齐）
 */
export const CARRIER_EXTRA_CSS = `
span[class*="blank-"]:not(.blank-line):not([class*="math-circle-blank"]){display:inline-grid;grid-template-columns:auto 1fr auto;align-items:baseline;vertical-align:baseline;text-align:center;}
span[class*="blank-"]:not(.blank-line):not([class*="math-circle-blank"])::before{content:"(";font-weight:normal;}
span[class*="blank-"]:not(.blank-line):not([class*="math-circle-blank"])::after{content:")";font-weight:normal;}
${spanGridCss()}
span.blank-line::before,span.blank-line::after{content:none !important;}
.blank-line{display:inline-block;min-width:3em;border-bottom:1.5px solid #666;margin:0 2px;vertical-align:baseline;}
/* 🔧 行尾自动延伸：仅 blank-line（整行作答区）在段落末尾 flex 弹性延伸（与 Word ptab 一致）。
   u.blank-N（短填空，按答案长度定宽）不参与延伸——句末短填空在 Word 端导出为 NBSP 空格串 + 下划线（可编辑），
   两端口径一致（2026-09：u.blank-N 曾随 blank-line 一起延伸 → Word ptab 显示 →、不可逐格编辑） */
p:has(> .blank-line:last-child){display:flex;align-items:baseline;}
p:has(> .blank-line:last-child) .blank-line{flex:1 1 auto;min-width:3em;}
`;

/** 作答载体完整 CSS（全局注入与独立导出文档共用）：u 横线本体 + 宽度档位 + 括号/整行横线/行尾延伸 */
export const CARRIER_CSS = `
/* 填空横线 u.blank-N：border-bottom 画线（与 Word ptab/NBSP 兜底同视觉），text-decoration:none 免与普通下划线叠加 */
u[class*="blank-"]{display:inline-block;text-align:center;text-decoration:none;border-bottom:1.5px solid #333;padding:0 1px;font-size:inherit !important;min-width:1em;}
${uWidthCss()}
${CARRIER_EXTRA_CSS}
${CARRIER_LINE_CSS}
/* 数学填空方框（square-box）与数学填空圈（math-circle-blank-N）：均为 1.8em 等边容器，
   供学生在框/圈内手写数字或符号，与 Word DrawingML 几何同尺寸。单一事实源收敛自
   global.css / RichTextEditor :deep / themeConfig / TypesetModule / GenerateModule 的多份副本。 */
.square-box,.math-circle-blank-18{display:inline-flex;align-items:center;justify-content:center;width:1.8em;height:1.8em;min-width:1.8em;min-height:1.8em;box-sizing:border-box;text-align:center;vertical-align:middle;margin:0 1px;font-weight:bold;color:#333;font-size:inherit !important;line-height:1;}
.square-box{border:1.5px solid #333;}
.math-circle-blank-18{border:1.5px solid #333;border-radius:50%;}
`;

export default CARRIER_CSS;
