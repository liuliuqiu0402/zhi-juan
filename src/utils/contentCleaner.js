/**
 * 内容清洗工具（整卷生成后处理用）
 * ============================================================
 * 🔴 定位：从原分步流水线 executor.js 中保留的通用函数（分步流水线已整体删除）：
 *    - cleanSectionHtml：清洗 AI 输出（去 ```html 包裹 / body 抽取 / 自评残留）
 *    - extractQuestionList：从 HTML 提取纯文本题目清单（答案页生成依据）
 *    - hasAnswerCarrier：判定题内是否存在可作答载体（答案清单空壳过滤用）
 * ============================================================
 */

/** 清洗 AI 输出：去 ```html 包裹、去 body 抽取、去自评残留 */
export const cleanSectionHtml = (raw) => {
  if (!raw) return '';
  let html = raw;
  html = html.replace(/^\`\`\`html?\s*\n?/i, '').replace(/\n?\`\`\`\s*$/i, '');
  const bm = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bm) html = bm[1];
  html = html.replace(/<div[^>]*class=["'][^"']*self-review[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  return html.trim();
};

/**
 * 判定题内是否存在"可作答载体"：
 * 填空空位 blank-N / 选项行 option / 连线结构 match / 作答区 blank-line /
 * 配图 [IMAGE] / 括号空位（　）/ 拼音字母 / 下划线 <u> / 引号书名号内容 /
 * 顿号破折号分隔的候选词 / 表格 <table> / 序号圈号（①园 ②圆…）
 */
export function hasAnswerCarrier(inner = '') {
  if (/class=["'][^"']*blank-\d+/.test(inner)) return true;
  if (/class=["'][^"']*option/.test(inner)) return true;
  if (/match-question|match-col|match-item|blank-line/.test(inner)) return true;
  if (/\[IMAGE\]/.test(inner)) return true;
  if (/<table\b/.test(inner)) return true;
  if (/[（(]\s*[　 ]{0,3}\s*[)）]/.test(inner)) return true;
  if (/[a-zA-Zāáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/.test(inner)) return true;
  if (/<u\b/.test(inner)) return true;
  if (/[“"][^“”"]{2,}[”"]|《[^》]{2,}》/.test(inner)) return true;
  if (/[\u4e00-\u9fa5]{1,4}(?:[、·—\-][\u4e00-\u9fa5]{1,4})/.test(inner)) return true;
  // 序号圈号（"①园 ②圆"式候选清单；不含阿拉伯数字列表——题干自带题号"1. "会误判为候选）
  if (/[①②③④⑤⑥⑦⑧⑨⑩]/.test(inner)) return true;
  // 阿拉伯数字候选清单（"1.园 2.圆"）：先剥离行首题号，防题号误判为候选
  const noLeadingNum = String(inner).replace(/^\s*\d+[.、．]\s*/, '');
  if (/\d+[.、．]\s*[\u4e00-\u9fa5]/.test(noLeadingNum)) return true;
  return false;
}

/**
 * 从整卷 HTML 提取"纯文本题目清单"（供答案页生成）
 * 只取正文区（答案区之前）；空壳题（题干承诺材料但未给出）不进清单，
 * 防止答案页 AI 对着空壳编造内容（题面缺失、答案却编出词表/短文）。
 * @param {string} html 完整 HTML
 * @param {number} [maxChars] 上限（默认 12000）
 * @returns {string} 纯文本题目清单（每题一行）
 */
export const extractQuestionList = (html = '', maxChars = 12000) => {
  if (!html) return '';
  // 只取正文区（答案区之前的题目部分）
  const body = html.split(/<div[^>]*class=["'][^"']*answer-section/i)[0];
  const parts = [];
  // 板块标题
  const headingRe = /<h2[^>]*>([\s\S]*?)<\/h2>/g;
  let m;
  while ((m = headingRe.exec(body)) !== null) {
    const t = m[1].replace(/<[^>]+>/g, '').trim();
    if (t) parts.push(`【${t}】`);
  }
  // 题目（含题干、选项、空）——空壳过滤
  const qRe = /<p[^>]*class=["'][^"']*question[^"']*["'][^>]*>([\s\S]*?)<\/p>/g;
  const qPromiseRe = /(读一读下面的|下面的|下列|圈出.{0,10}(读音|加点字)|加点字|正确的读音)/;
  let qm;
  while ((qm = qRe.exec(body)) !== null) {
    const inner = qm[1];
    const text = inner.replace(/<[^>]+>/g, '').replace(/&emsp;/g, '＿＿').replace(/&nbsp;/g, ' ').trim();
    if (!text) continue;
    const stripped = text.replace(/^\s*\d+[.、．]\s*/, '');
    const isShell = (qPromiseRe.test(stripped) || stripped.length < 10) && !hasAnswerCarrier(inner);
    if (isShell) continue; // 空壳题 → 不进入答案清单
    parts.push(text);
  }
  // 🔧 兜底：模型未按 class="question" 输出时（整卷模板此前未硬性要求），按"<p> 带题号"提取
  //    （题号正则：行首 1. 2. 3.… / （1）（2）子题；防把普通叙述段误当题目）
  if (parts.filter(x => x.startsWith('【')).length === 0) {
    const fallbackRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let fm;
    while ((fm = fallbackRe.exec(body)) !== null) {
      const inner = fm[1];
      const text = inner.replace(/<[^>]+>/g, '').replace(/&emsp;/g, '＿＿').replace(/&nbsp;/g, ' ').trim();
      if (!text) continue;
      const stripped = text.replace(/^\s*[(（]?\s*\d+\s*[)）]?\s*[.、．]?\s*/, '');
      const looksQuestion = /^\d+[.、．]/.test(text) || /^[(（]\d+[)）]/.test(text) || stripped.length >= 10;
      if (!looksQuestion) continue;
      parts.push(text);
    }
  }
  // 选择题选项
  const optRe = /<p[^>]*class=["'][^"']*option[^"']*["'][^>]*>([\s\S]*?)<\/p>/g;
  let om;
  while ((om = optRe.exec(body)) !== null) {
    const text = om[1].replace(/<[^>]+>/g, '').trim();
    if (text) parts.push(`  ${text}`);
  }
  let out = parts.join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars) + '…(已裁剪)';
  return out;
};

/**
 * HTML → 纯文本（答案页生成上下文用）：
 * 保留整卷正文的题目顺序与结构（表格转文本、[IMAGE] 转占位、块级标签转换行），
 * 供答案页独立调用时把完整正文作为输入上下文——模型"看着实际题目作答"，
 * 杜绝摘要提取失败后凭记忆编造（曾导致二年级试卷配五年级《将相和》答案）。
 * @param {string} html 完整 HTML
 * @param {number} [maxChars] 上限（默认 24000）
 * @returns {string} 纯文本正文
 */
export const htmlToPlainText = (html = '', maxChars = 24000) => {
  if (!html) return '';
  let body = String(html);
  // 只取正文区（答案区之前的题目部分）
  body = body.split(/<div[^>]*class=["'][^"']*answer-section/i)[0];
  // 表格 → 逐行单元格文本（评分表/田字格等结构化内容不丢失）
  body = body.replace(/<table[\s\S]*?<\/table>/gi, (t) => {
    const rows = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let tm;
    while ((tm = trRe.exec(t)) !== null) {
      const cells = [];
      const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cm;
      while ((cm = tdRe.exec(tm[1])) !== null) {
        const c = cm[1].replace(/<[^>]+>/g, '').replace(/&emsp;/g, '＿').replace(/&nbsp;/g, ' ').trim();
        if (c) cells.push(c);
      }
      if (cells.length) rows.push(cells.join(' | '));
    }
    return '\n' + rows.join('\n');
  });
  // [IMAGE] 标记 → 占位（配图描述不是题目内容，避免干扰作答）
  body = body.replace(/\[IMAGE\][\s\S]*?\[\/IMAGE\]/g, '（配图）').replace(/\[IMAGE\][^\n]*/g, '（配图）');
  // 块级标签 → 换行
  body = body.replace(/<\/(h[1-6]|p|div|li|tr)>/gi, '\n');
  // 去其余标签
  body = body.replace(/<[^>]+>/g, '');
  // 实体解码
  body = body.replace(/&emsp;/g, '＿').replace(/&ensp;/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // 清理空行
  body = body.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  if (body.length > maxChars) body = body.slice(0, maxChars) + '\n…（正文过长已裁剪，请按已给出的题号继续作答）';
  return body;
};

/**
 * 题目层级解析（顶层题干 vs 子题 (N)）
 * 🔴 子题判定：前一个标签是顶层题干、或前一个标签是序号更小的子题（(1)(2)(3) 连续递增）；
 *    序号回退（如 (4) 后又出现 (1)）→ 判定为新的顶层题。
 * @param {string} html
 * @returns {Array<{kind:'top'|'sub', whole:string, inner:string, num?:number}>}
 */
export function analyzeQuestionHierarchy(html = '') {
  const out = [];
  let subContext = false; // 已出现非括号顶层题 → 括号编号进入"子题语境"
  let prevKind = '';      // 前一个有效元素类型：'top' | 'sub'
  let prevSubNum = 0;
  const re = /<p[^>]*class="[^"]*question[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const inner = m[1];
    // 空/纯空白/仅实体占位（&nbsp;等）的 question 元素是模型常见占位，不计数、不编号
    if (!inner || !inner.replace(/&(?:nbsp|emsp|ensp);/gi, '').replace(/<[^>]+>/g, '').trim()) continue;
    const subMatch = inner.match(/^\s*[(（]\s*(\d+)\s*[)）]\s*/);
    if (subMatch) {
      const n = parseInt(subMatch[1], 10);
      if (!subContext) {
        // 整段输出都没有非括号顶层题（如 （1）~（8） 连续编号做顶层题）→ 括号编号即顶层题本身
        out.push({ kind: 'top', whole: m[0], inner, start: m.index });
        prevKind = 'top';
      } else if (prevKind === 'top') {
        out.push({ kind: 'sub', whole: m[0], inner, num: n, start: m.index });
        prevKind = 'sub'; prevSubNum = n;
      } else if (n === prevSubNum + 1) {
        out.push({ kind: 'sub', whole: m[0], inner, num: n, start: m.index });
        prevKind = 'sub'; prevSubNum = n;
      } else {
        // 序号回退（如 (4) 后又 (1)）→ 新的顶层题；其后续连续括号为其子题
        out.push({ kind: 'top', whole: m[0], inner, start: m.index });
        prevKind = 'top';
      }
    } else {
      subContext = true;
      out.push({ kind: 'top', whole: m[0], inner, start: m.index });
      prevKind = 'top';
    }
  }
  return out;
}

/** 顶层题目计数：只统计顶层题干（不含 (1)(2) 子题）——与 analyzeQuestionHierarchy 同口径 */
export function countTopLevelQuestions(html = '') {
  return analyzeQuestionHierarchy(String(html || '')).filter(x => x.kind === 'top').length;
}

/**
 * 空白规范化（后处理排版兜底——AI 输出为"一大段文本"时由代码补排版要素）：
 *   1) <u>＿＿＿</u> / 纯文本 ＿N 个 → 带宽度等级的填空横线 blank-N（1字≈2格，2≤N≤24）
 *   2) 空作文格 <div class="zuo-wen-ge"></div> → 补默认格
 * 排版要素（田字格/四线三格/图区）若 AI 未输出则保持原样，由导出层按学科排版兜底。
 */
export function normalizeBlankMarkers(html = '') {
  let out = String(html || '');
  // 🔴 宽度上限 16em（8 个汉字）：答案通常 ≤8 字；超长横线会超出页内边距，长答案用"行尾自动延伸"方案
  const capN = (n) => Math.min(16, Math.max(2, n));
  out = out.replace(/<u>\s*＿+\s*<\/u>/gi, (m) => {
    const len = (m.match(/＿/g) || []).length;
    return `<u class="blank-${capN(len * 2)}">&emsp;</u>`;
  });
  out = out.replace(/＿{2,}/g, (m) => {
    const n = Math.min(16, Math.max(2, m.length * 2));
    return `<u class="blank-${n}">&emsp;</u>`;
  });
  out = out.replace(/<div class="zuo-wen-ge">\s*<\/div>/g, '<div class="zuo-wen-ge"><span>&emsp;</span><span>&emsp;</span></div>');
  return out;
}

/**
 * 缩进归一化（根治"排版缩进加倍"——AI 常用行首空格/内联 text-indent 模拟缩进，
 * 与排版层 CSS `p { text-indent: 2em }` 叠加后视觉缩进翻倍）：
 *   1) 去除元素内联 text-indent 声明（缩进统一由排版层 CSS 控制）
 *   2) 去除段落行首的空白字符（全角/半角空格、NBSP/EMSP 等）
 * 注意：只处理行首空白与内联缩进声明，不影响行中空格与代码块等需保留空白的场景。
 */
export function normalizeIndents(html = '') {
  let out = String(html || '');
  // 1) 内联 text-indent → 移除（排版层统一控制，避免叠加加倍）
  out = out.replace(/(<[a-zA-Z][^>]*?)\s+text-indent\s*:\s*[^;"'>]+;?/gi, '$1');
  // 2) 段落/块级元素行首空白字符 → 移除（AI 模拟缩进，与 CSS 缩进叠加会加倍）
  out = out.replace(/<(p|div|li|h[1-6])([^>]*)>([\u3000\u00A0\u2003\u2002 　]+)/gi, '<$1$2>');
  return out;
}

export default { cleanSectionHtml, hasAnswerCarrier, extractQuestionList, htmlToPlainText, analyzeQuestionHierarchy, countTopLevelQuestions, normalizeBlankMarkers, normalizeIndents };
