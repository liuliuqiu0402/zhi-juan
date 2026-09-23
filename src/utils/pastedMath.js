/**
 * 粘贴公式还原（OMML / MathML → LaTeX $…$）
 * ============================================================
 * 🔴 解决什么（2026-09 用户实证）：教材公式粘贴进编辑器后"印刷样式全没了"。
 *    根因：Word 剪贴板给的是 OMML（藏在 MSO 条件注释里），网页/LibreOffice 给的是 MathML，
 *    而编辑器对这两者毫无处理 —— ProseMirror 把未知标签剥掉，只留散字（分式塌一行、上下标错位）。
 *
 * 🔴 三条硬约束（照做，否则会引入无声错误）：
 *   ① **必须在原始字符串上处理**：OMML 包在 `<!--[if gte mso 9]>…<![endif]-->` 里，
 *      一旦交给 DOM 解析，条件注释会被当注释丢掉、标签名还会被小写化 → 再也找不回公式。
 *      故本模块只接收/返回 HTML 字符串，且入口在 ProseMirror 解析之前的 transformPastedHTML。
 *   ② **先解注释、再换公式**：命中 OMML 的条件注释要先把注释壳去掉（否则替换结果落在注释里 = 不可见）。
 *      但不无差别删所有条件注释——只解"含 OMML 的那些"。
 *   ③ **不删任何图片**：Word 会在公式旁附一张兜底图片，转换后可能重复显示一张。
 *      我们**不自动删除**——图片的 src 无法区分"公式截图"与"真插图"（都在 msohtmlclip 临时目录），
 *      误删就是静默丢料（本项目红线）。重复图由用户手动删，此处只留诊断日志。
 *
 * 🔴 产出形态：统一还原为 `$…$`（行内）/ `$$…$$`（块级）LaTeX —— 与生成端 FORMULA_RULES 的
 *    约定同源，交给既有渲染链路（utils/mathRender.renderMathInHtml + KaTeX）出印刷形态。
 *    这样"粘贴的公式"与"生成的公式"在系统里只有一种表示，不存在两套。
 * ============================================================
 */
import { ommlToLatex } from './ommlToLatex.js';
import { mathmlToLatex } from './mathmlToLatex.js';

/** OMML 块级（oMathPara 内含 oMath，故必须先于行内处理）
 *  🔴 刻意**不加 i 标志**：OMML 元素名是大小写敏感的规范拼写（`m:oMath`）。若宽容匹配 `omath`，
 *    非规范片段会被送进转换器按"未登记元素透明递归"处理 → 静默产出丢掉结构的错内容（比不转换更糟）。
 *    宁可不认（保留原文，与改版前一致），也不猜。 */
const OMML_PARA_RE = /<(?:[A-Za-z][\w.-]*:)?oMathPara\b[\s\S]*?<\/(?:[A-Za-z][\w.-]*:)?oMathPara\s*>/g;
/** OMML 行内（同上，大小写敏感） */
const OMML_INLINE_RE = /<(?:[A-Za-z][\w.-]*:)?oMath\b[\s\S]*?<\/(?:[A-Za-z][\w.-]*:)?oMath\s*>/g;
/** MathML（网页 / LibreOffice）：HTML 标签大小写不敏感，故加 i */
const MATHML_RE = /<(?:[A-Za-z][\w.-]*:)?math\b[^>]*>[\s\S]*?<\/(?:[A-Za-z][\w.-]*:)?math\s*>/gi;

/** 快速判据：粘贴内容里有没有公式标记（无则整体跳过，零开销） */
export const hasPastedMath = (html) => /oMath|<\s*(?:[A-Za-z][\w.-]*:)?math\b/i.test(String(html || ''));

/**
 * 解开"含 OMML 的 MSO 条件注释"外壳（`<!--[if gte mso 9]>X<![endif]-->` → X）。
 * 只解含公式的：其余条件注释（样式/页脚等）保持原样，交由既有清洗链路处理。
 */
const unwrapOmmlComments = (html) => html.replace(
  /<!--\[if[^\]]*\]>([\s\S]*?)<!\[endif\]-->/gi,
  (whole, inner) => (/oMath/i.test(inner) ? inner : whole)
);

/** 把 HTML 里的 OMML / MathML 换成 LaTeX 文本（`$…$` / `$$…$$`） */
export const convertPastedMathInHtml = (html) => {
  const src = String(html == null ? '' : html);
  if (!src || !hasPastedMath(src)) return src;

  let converted = 0;
  let out = unwrapOmmlComments(src);

  // ① 块级公式（先）
  out = out.replace(OMML_PARA_RE, (frag) => {
    const latex = ommlToLatex(frag);
    if (!latex) return frag; // 解析失败保留原文，绝不因公式毁掉整段粘贴
    converted += 1;
    return '$$' + latex + '$$'; // 两侧 $$ = 块级定界符
  });
  // ② 行内公式
  out = out.replace(OMML_INLINE_RE, (frag) => {
    const latex = ommlToLatex(frag);
    if (!latex) return frag;
    converted += 1;
    return '$' + latex + '$'; // 两侧 $ = 行内定界符
  });
  // ③ MathML（网页 / LibreOffice）
  out = out.replace(MATHML_RE, (frag) => {
    const latex = mathmlToLatex(frag);
    if (!latex) return frag;
    converted += 1;
    return '$' + latex + '$';
  });

  if (converted > 0) {
    console.log(`📐 粘贴公式还原：${converted} 个公式已转为 LaTeX（$…$）`);
    // ③ 兜底图片诊断（不自动删除，理由见文件头约束③）
    if (/msohtmlclip|\.emf\b|\.wmf\b/i.test(out)) {
      console.log('📐 检测到 Word 剪贴板图片：若与公式重复显示，请手动删除该图片（不做自动删除以免误删真插图）');
    }
  }
  return out;
};

export default { convertPastedMathInHtml, hasPastedMath };
