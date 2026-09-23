/**
 * CF_HTML 解析（Windows 剪贴板 "HTML Format" 原始字节 → HTML 片段）
 * ============================================================
 * 🔴 为什么必须自己解原始字节（2026-09 用户实证 + 官方行为）：
 *    Word 复制公式时，HTML 那一份里 OMML 是写在**条件注释**里的：
 *        <!--[if gte msEquation 12]><m:oMath>…</m:oMath><![endif]-->
 *        <![if !msEquation]><img src="…clip_image001.png"><![endif]>
 *    （左为给 Office 的公式本体，右为给其他程序的兜底图片 —— 见 Microsoft 官方博客
 *     "MathML on the Windows Clipboard"：Office 在 HTML 里把公式区域当图片复制，
 *     并把 OMML 放在注释中；RichEdit 的 HTML 默认就以 OMML 写公式。）
 *    而 Electron 的 `clipboard.readHTML()` 拿到的是**经 Chromium 处理过的 HTML**，
 *    注释被丢掉 → OMML 没了、只剩兜底图片 → 用户看到"公式只剩字母和加减号"。
 *    `clipboard.readBuffer('HTML Format')` 给的是**原始 CF_HTML 字节**，注释完好。
 *
 * 🔴 CF_HTML 结构：头部是 ASCII 的 `Key:Value\r\n` 列表（到空行结束），
 *    其中 StartHTML/EndHTML/StartFragment/EndFragment 是**字节偏移**（不是字符偏移）；
 *    正文通常是 UTF-8。所以必须先按 ASCII 解头部定位偏移，再按字节切片、按 UTF-8 解正文。
 * ============================================================
 */

/** 取头部里的某个字节偏移；取不到返回 -1 */
const readOffset = (headAscii, key) => {
  const m = headAscii.match(new RegExp(`${key}:(\\d+)`));
  return m ? parseInt(m[1], 10) : -1;
};

/**
 * 解析 CF_HTML 原始字节 → HTML 片段（保留全部注释）。
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {string} 片段；非 CF_HTML 或结构异常时返回 ''（调用方自行回退）
 */
export const parseCfHtml = (input) => {
  let bytes = input;
  if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  if (!bytes || typeof bytes.length !== 'number' || bytes.length === 0) return '';

  // 头部是 ASCII：先解前 1KB 用于定位偏移（ASCII 与 UTF-8 在 ASCII 区间一致）
  const headLen = Math.min(bytes.length, 1024);
  const headAscii = new TextDecoder('latin1').decode(bytes.subarray(0, headLen));

  const startFragment = readOffset(headAscii, 'StartFragment');
  const endFragment = readOffset(headAscii, 'EndFragment');
  const startHtml = readOffset(headAscii, 'StartHTML');
  const endHtml = readOffset(headAscii, 'EndHTML');

  // 优先用 Fragment 区间（正是"被复制的那部分"）；缺了再退整段 HTML
  let from = startFragment >= 0 ? startFragment : startHtml;
  let to = endFragment >= 0 ? endFragment : endHtml;
  if (from < 0 || to <= from || to > bytes.length) return '';

  return new TextDecoder('utf-8').decode(bytes.subarray(from, to));
};

export default { parseCfHtml };
