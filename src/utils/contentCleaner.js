/**
 * 内容清洗工具（整卷生成后处理用）
 * ============================================================
 * 🔴 定位：从原分步流水线 executor.js 中保留的通用函数（分步流水线已整体删除）：
 *    - cleanSectionHtml：清洗 AI 输出（去 ```html 包裹 / body 抽取 / 自评残留）
 *    - htmlToPlainText：HTML → 纯文本（答案页生成上下文，整卷路径在用）
 *    - hasAnswerCarrier：判定题内是否存在可作答载体
 * ============================================================
 */
import { getMergedSpec } from '../config/layoutSpec.js';

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
  // [IMAGE] 标记 → 保留画面描述文本（答案页生成需"看着画面"作答，
  //    否则模型脑补画面导致答案示例与插图内容不一致——本卷第11题"小明和爸爸"vs"小男孩和小女孩"案例）。
  //    格式："（配图：秋天，果园里……）"，PROMPT 描述完整保留
  body = body.replace(/\[IMAGE\][\s\S]*?\[\/IMAGE\]/gi, (m) => {
    const prompt = m.match(/PROMPT\s*:\s*([^\n\]]+)/i);
    const desc = prompt ? prompt[1].trim().slice(0, 120) : '';
    return desc ? `（配图：${desc}）` : '（配图）';
  }).replace(/\[IMAGE\][^\n]*/gi, '（配图）');
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
  // 🔴 填空横线参数来自排版规格库（BLANK）：宽度上限 maxCap、1字≈N格 wordGap、下限 minBlank
  const { maxCap, wordGap, minBlank } = getMergedSpec().BLANK;
  const capN = (n) => Math.min(maxCap, Math.max(minBlank, n));
  const toBlank = (chWidth) => capN(chWidth * wordGap);
  out = out.replace(/<u>\s*＿+\s*<\/u>/gi, (m) => {
    const len = (m.match(/＿/g) || []).length;
    return `<u class="blank-${toBlank(len)}">&emsp;</u>`;
  });
  out = out.replace(/＿{2,}/g, (m) => {
    const n = toBlank(m.length);
    return `<u class="blank-${n}">&emsp;</u>`;
  });
  out = out.replace(/<div class="zuo-wen-ge">\s*<\/div>/g, `<div class="zuo-wen-ge">${'<span>&emsp;</span>'.repeat(Math.max(1, getMergedSpec().ZUOWEN_DEFAULT_SPAN))}</div>`);
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

export default { cleanSectionHtml, hasAnswerCarrier, htmlToPlainText, analyzeQuestionHierarchy, countTopLevelQuestions, normalizeBlankMarkers, normalizeIndents };
