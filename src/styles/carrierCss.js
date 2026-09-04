// ============================================================
// 作答载体 CSS 单一事实源（填空横线 u.blank-N / 括号空位 span.blank-N /
// 整行横线 .blank-line / 行尾弹性延伸 / 四线三格·六线格·拼音格·英语书写格）
// ============================================================
// 🔴 消费方：main.js 全局注入（替代原 styles/global.css 里的静态副本）、
//    themeConfig 独立导出文档（HTML/PDF 自带内嵌样式）。
//    曾 global.css / themeConfig / RichTextEditor 深规则 / TypesetModule 各自维护同规则，
//    改档位/线位/线色需多处手动同步 → 现收敛此处，改规则只改本文件。
//    宽度档位 1..24 与排版规格库 layoutSpec.sanitizeBlankSpec 上限一致。
//    四线三格/六线格/拼音格行高 = CSS 变量 --flt-h（默认 1.45em，随字母字号自适应；
//    曾按学段注入 mm（9/8），小字号时字母书写格位失真 → 2026-09 改 em，与 Word 导出口径一致）
// ============================================================

const TIERS = Array.from({ length: 24 }, (_, i) => i + 1);

/** u.blank-N 宽度档位（1 档 = 1em） */
const uWidthCss = () => TIERS.map((n) => `u.blank-${n}{min-width:${n}em;}`).join('\n');

/** span.blank-N 括号填空：伪元素括号外置，书写空间 = 中间 minmax(N em,1fr) 轨
 *（与 Word 导出 "(" + NBSP×N + ")" 同口径，括号内恰为 N em） */
const spanGridCss = () => TIERS.map((n) => `span.blank-${n}{grid-template-columns:auto minmax(${n}em,1fr) auto;}`).join('\n');

/** 四线三格/六线格/拼音格（行高随字母字号自适应，字母行内垂直居中）
 * ============================================================
 * 线位：行高 H 内等距三等带（6.7%/36.7%/66.7%/96.7%），soft #999 ×3 + strong #666（第 3 线，基线）。
 * H = var(--flt-h, 1.45em)（2026-09 起随字号自适应：曾固定 9mm → 小字号时格子过大、字母只能落在中格，
 * 上/中/下格书写关系失真；改为与导出/编辑器同口径的 1.45em，字母用 inline-flex 垂直居中 → 与 Word 一致）。
 * 排版/主题注入改为同值（em），不再注入 mm。 */
export const CARRIER_LINE_CSS = `
.four-line-three, .sixian-ge, .pinyin-line { display: inline-flex; align-items: center; justify-content: center; position: relative; padding: 0 0.18em; font-size: inherit !important; height: var(--flt-h, 1.45em); line-height: 1; min-width: 18px; text-align: center; vertical-align: middle; text-indent: 0; }
.four-line-three { font-family: 'Times New Roman', 'Georgia', SimSun, serif; }
.sixian-ge { font-family: 'Times New Roman', 'Microsoft YaHei', SimSun, serif; }
.four-line-three::before, .sixian-ge::before, .pinyin-line::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: var(--flt-h, 1.45em); background: linear-gradient(var(--flt-soft,#999),var(--flt-soft,#999)) 0 6.7%/100% 1px no-repeat, linear-gradient(var(--flt-soft,#999),var(--flt-soft,#999)) 0 36.7%/100% 1px no-repeat, linear-gradient(var(--flt-strong,#666),var(--flt-strong,#666)) 0 66.7%/100% 1px no-repeat, linear-gradient(var(--flt-soft,#999),var(--flt-soft,#999)) 0 96.7%/100% 1px no-repeat; pointer-events: none; }
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
   两端口径一致（2026-09：u.blank-N 曾随 blank-line 一起延伸 → Word ptab 显示 →、不可逐格编辑）。
   例外：排版端"单独空行"（整段仅一条填空横线、无任何正文文字；模型整行留白作答线常见形态）→
   由 RichTextEditor 渲染层打 .blank-solo 标记后弹性延伸，预览与 Word ptab 口径一致（2026-09 排版端）；
   注意：句内短填空 / 带引导词的句末横线（如"读作：＿＿"）不含该标记 → 保持定宽可编辑，不受影响 */
p:has(> .blank-line:last-child){display:flex;align-items:baseline;}
p:has(> .blank-line:last-child) .blank-line{flex:1 1 auto;min-width:3em;}
:is(p,div,li).blank-solo{display:flex;align-items:baseline;}
:is(p,div,li).blank-solo > u[class*="blank-"]{flex:1 1 auto;min-width:3em;}
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
/* 作图区 draw-area：学生作图用虚线框作答区（物理示意/光路/电路、数学画图等；最小渲染 2026-09——
   供 2k 作图题定向补区产物与模型自出 div.draw-area 渲染；高度优先内联 min-height（Word 端虚线段落同视觉）） */
.draw-area{display:block;box-sizing:border-box;min-height:30mm;border:1.2px dashed #999;border-radius:3px;margin:2px 0;padding:1mm 2mm;}
`;

export default CARRIER_CSS;
