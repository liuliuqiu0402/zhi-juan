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
import { parseCfHtml } from './cfHtml.js'; // CF_HTML 原始字节 → HTML 片段（注释完好，OMML 在里面）

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

/**
 * 读取剪贴板内容，并把其中的公式还原好。
 * ============================================================
 * 🔴 为什么必须**统一走这里**（2026-09 用户实证）：
 *    "把剪贴板内容带进来"的入口不止编辑器 Ctrl+V 一处 —— 还有按钮式的
 *    「从剪贴板导入」（教材/模板库目录）、「粘贴」（排版模块）等。每个入口各写一份
 *    `navigator.clipboard` 调用，就必然有人只读**纯文本**版本（`readText()`），
 *    而 Word 给纯文本时会把公式线性化成裸字符 → 用户看到"只剩字母和加减号"。
 *
 * 🔴 更要紧的一点：按钮式入口是**程序化注入**（把 HTML 直接塞进 v-model / 状态），
 *    **不经过编辑器的 `transformPastedHTML` 钩子**，没有人替它还原公式。
 *    所以"编辑器粘贴没问题"≠"所有带入路径都没问题"。
 *
 * 🔴 职责边界：本函数只负责"读出剪贴板的富文本/纯文本，并把公式还原成 `$…$`"；
 *    调用方拿到的 `html` 已是**可直接注入**的形态（公式不再是 OMML）。
 *
 * @returns {Promise<{html:string, text:string, mathConverted:boolean}|null>}
 *   两者都读不到时返回 null（调用方自行决定提示/回退）。
 *   `mathConverted` = 这次**确实**把公式还原过（供调用方判断"能不能放心改用 HTML 版本"：
 *   没还原出公式时，HTML 与纯文本在结构上可能不同，贸然换源是没必要的风险）。
 */
export const readClipboardRich = async () => {
  let html = '';
  let text = '';
  let formats = [];
  let via = '';
  let htmlFromReadHtml = '';   // Chromium 处理过的那份（会丢条件注释）
  let htmlFromRawBytes = '';   // CF_HTML 原始片段（注释完好）

  // ① 首选 **Electron 主进程**剪贴板：
  //    不受渲染进程剪贴板权限/焦点策略限制，实测这是唯一稳定拿到"带公式那一份"的通路。
  const api = typeof window !== 'undefined' ? window.electronAPI : null;
  if (api && typeof api.readClipboard === 'function') {
    try {
      const r = await api.readClipboard();
      htmlFromReadHtml = (r && r.html) || '';
      text = (r && r.text) || '';
      formats = (r && r.formats) || [];
      // 🔴 CF_HTML 原始字节优先：readHTML() 已被 Chromium 处理过，**条件注释会丢**，
      //    而 Word 的公式 OMML 就在 <!--[if gte msEquation 12]>…<![endif]--> 里（详见 main.js 注释）。
      if (r && r.htmlRawBase64) {
        try {
          const bin = atob(r.htmlRawBase64);
          const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
          htmlFromRawBytes = parseCfHtml(bytes);
        } catch (e) {
          console.warn('CF_HTML 原始片段解析失败，回退 readHTML:', e?.message || e);
        }
      }
      // 原始片段里才可能有 OMML：两边都有时也取原始那份（含注释）
      html = htmlFromRawBytes || htmlFromReadHtml;
      via = 'main';
    } catch (e) {
      console.warn('主进程剪贴板读取失败，回退浏览器 API:', e?.message || e);
    }
  }

  // ② 浏览器异步剪贴板 API（Web 端构建 / 主进程不可用时的兜底）
  //    注：这条路拿到的 html 也归入「readHTML 版本」——诊断要如实反映"只有它、且它没公式"
  if (!html && !text) {
    const clip = typeof navigator === 'undefined' ? null : navigator.clipboard;
    if (clip) {
      try {
        if (typeof clip.read === 'function') {
          const items = await clip.read();
          for (const item of items || []) {
            const types = (item && item.types) || [];
            if (!html && types.includes('text/html')) {
              html = await (await item.getType('text/html')).text();
              if (html) break;
            }
            if (!text && types.includes('text/plain')) {
              text = await (await item.getType('text/plain')).text();
            }
          }
        }
      } catch (e) {
        // read() 可能因权限被拒（非 https/localhost 等）→ 回退纯文本
        console.warn('剪贴板富文本读取失败，回退纯文本:', e?.message || e);
      }
      if (!text) {
        try { text = (await clip.readText?.()) || ''; } catch (e) { console.warn('剪贴板纯文本读取失败:', e?.message || e); }
      }
      htmlFromReadHtml = html;
      via = 'navigator';
    }
  }

  if (!html && !text) return null;
  const converted = html ? convertPastedMathInHtml(html) : '';
  const mathConverted = !!converted && converted !== html;
  // 📋 诊断（2026-09）：有公式却没还原出来时，这一行是唯一线索 ——
  //    raw 与 readHTML 的**公式标记差异**尤其实用：raw 有、readHTML 没有 = Chromium 把注释丢了；
  //    两个都没有 = 源头那份 HTML 里本来就没有公式结构（公式是图片），改代码无用。
  console.log(`📋 剪贴板[${via}]：格式=[${formats.join(', ') || '未取到'}]`
    + ` raw=${htmlFromRawBytes.length}字(含公式标记=${hasPastedMath(htmlFromRawBytes)})`
    + ` readHTML=${htmlFromReadHtml.length}字(含公式标记=${hasPastedMath(htmlFromReadHtml)})`
    + ` 文本=${text.length}字 已还原公式=${mathConverted}`);
  return { html: converted, text, mathConverted, formats, via, htmlFromReadHtml, htmlFromRawBytes };
};

export default { convertPastedMathInHtml, hasPastedMath, readClipboardRich };
