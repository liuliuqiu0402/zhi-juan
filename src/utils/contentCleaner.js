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

/**
 * XSS 剥离（负向剥离，零排版影响）
 * ============================================================
 * 只删除"可执行向量"，保留全部排版结构（标签结构 / class / style 内联样式 / 属性）：
 *   - <script>（含未闭合）→ 删
 *   - <iframe>/<object>/<embed>/<link>/<meta>/<base>/<form> → 删（含未闭合）
 *   - on* 事件属性（onerror/onclick/onload/onmouseover…）→ 删
 *   - href/src/xlink:href/action/formaction 的 javascript:/vbscript: 协议 → 掐断
 * 明确保留：style 属性（田字格/四线三格/占位框等排版依赖内联样式；
 *   现代浏览器不执行 style 内 javascript: 背景，无 XSS 面）；
 *   所有 class/结构标签（排版依赖，负向剥离不动它们）。
 * 用途：AI 生成内容入预览(v-html)/导出(innerHTML)前的纵深防御，
 *   在唯一源头清洗一次，全链路（预览/入库/导出/编辑）生效。
 */
export const stripXss = (html) => {
  if (!html || typeof html !== 'string') return html;
  let s = html;
  // 1) <script> 闭合块 → 整体删除
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  // 2) <script> 未闭合 → 标签连同其后裸内容（直到下一个标签或结尾）一并删除
  s = s.replace(/<script\b[^>]*>[\s\S]*?(?=<\/?[a-zA-Z]|$)/gi, '')
       .replace(/<script\b[^>]*>/gi, '');
  // 3) 危险嵌入式/元信息标签（含未闭合兜底）
  s = s.replace(/<(iframe|object|embed|link|meta|base|form)[\s\S]*?<\/\1\s*>/gi, '')
       .replace(/<(iframe|object|embed|link|meta|base|form)[\s\S]*?>/gi, '');
  // 4) on* 事件属性
  s = s.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // 5) javascript:/vbscript: 协议 → 整个属性值清空为 ""
  s = s.replace(/(\b(?:href|src|xlink:href|action|formaction)\s*=\s*)(["'])\s*javascript:[^"']*\2/gi, '$1$2$2')
       .replace(/(\b(?:href|src|xlink:href|action|formaction)\s*=\s*)javascript:[^\s>]*/gi, '$1""')
       .replace(/(\b(?:href|src|xlink:href|action|formaction)\s*=\s*)(["'])\s*vbscript:[^"']*\2/gi, '$1$2$2')
       .replace(/(\b(?:href|src|xlink:href|action|formaction)\s*=\s*)vbscript:[^\s>]*/gi, '$1""');
  return s;
};

/** 清洗 AI 输出：去 ```html 包裹、去 body 抽取、去自评残留、去 markdown 语法残留 */
export const cleanSectionHtml = (raw) => {
  if (!raw) return '';
  let html = raw;
  html = html.replace(/^\`\`\`html?\s*\n?/i, '').replace(/\n?\`\`\`\s*$/i, '');
  const bm = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bm) html = bm[1];
  html = html.replace(/<div[^>]*class=["'][^"']*self-review[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  // 🔧 markdown 语法残留兜底（指令已禁，模型偶发违反——正文/答案页统一清理）：
  //    行首 ## 标题标记、成对 ** 加粗；保留正文中自然出现的 # / * 单字符（数学/符号场景）
  html = html.replace(/^#{1,6}\s+/gm, '').replace(/\*\*([^*\n]+)\*\*/g, '$1');
  return html.trim();
};

/** 导出端第二道防线：剥离 AI 响应残留的 markdown 代码块/对话前缀（不改 HTML 结构本身）
 * 有 ```html 代码块 → 取块内 HTML 拼接；否则无块但存在"对话前缀+HTML" → 从首个 HTML 标签截断。
 * 曾分别内联于 GenerateModule.downloadDoc 与 TypesetModule.sanitizeExportContent（两段逐字同构、各自演化），
 * 现收敛为共享函数；配合 callAI 层 cleanReasoningOutput 使用（部分模型仍可能绕过第一道防线）。 */
export const stripAiCodeFence = (html) => {
  if (!html) return html;
  let cleaned = String(html);
  const mdBlockRegex = /```(?:html?|HTML?)?[\s\n]*([\s\S]*?)\n?```/g;
  const mdBlocks = [];
  let mdMatch;
  while ((mdMatch = mdBlockRegex.exec(cleaned)) !== null) mdBlocks.push(mdMatch[1].trim());
  if (mdBlocks.length > 0) {
    cleaned = mdBlocks.join('\n\n');
  } else {
    // 无代码块但有 HTML 标签 → 截掉对话前缀（限前缀长度，防误切正文里晚出现的标签）
    const htmlStartIdx = cleaned.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span)\b/i);
    if (htmlStartIdx > 0 && htmlStartIdx < 500) cleaned = cleaned.substring(htmlStartIdx);
  }
  return cleaned;
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

// ── 填空宽度换算（唯一事实源 = 排版规格库 layoutSpec.BLANK）
//    callAI 层 convertBlankFormat（useAiGenerator）与正文层 normalizeBlankMarkers 共用本组函数，
//    消除"两套宽度梯形/规格并存、排版规格对 callAI 层不生效"的双轨漂移；参数演进只改 layoutSpec.BLANK。──
const BLANK_SPEC = () => getMergedSpec().BLANK || { maxCap: 16, wordGap: 2, minBlank: 2 };
/** 宽度封顶/下限：规格 BLANK.maxCap / minBlank（超长横线交由"行尾自动延伸"，不无限加宽） */
export const clampBlankWidth = (n) => {
  const { maxCap, minBlank } = BLANK_SPEC();
  return Math.min(maxCap, Math.max(minBlank, Math.round(n)));
};
/** 字宽 → 宽度：正文书写横线/裸下划线换算（1 字 ≈ wordGap 格；＿ 计数按字宽计） */
export const blankWidthForChars = (chars) => {
  const { wordGap } = BLANK_SPEC();
  return clampBlankWidth(chars * wordGap);
};
/** 括号填空：下划线个数 → 宽度（短空 1:1 档位：≤3→2 / ≤4→4 / ≤6→6 / ≤8→8 / 其余 10，再按规格封顶） */
export const shortBlankWidth = (underscores) => {
  const u = underscores <= 3 ? 2 : underscores <= 4 ? 4 : underscores <= 6 ? 6 : underscores <= 8 ? 8 : 10;
  return clampBlankWidth(u);
};
/** 括号填空：空白 em 宽 → 宽度档（&emsp;/全角=1em、&nbsp;/半角≈0.25em；档位 ≤1→2 … 其余 10，再按规格封顶） */
export const spaceBlankWidth = (emWidth) => {
  const n = emWidth <= 1 ? 2 : emWidth <= 1.5 ? 3 : emWidth <= 2 ? 4 : emWidth <= 3 ? 5 : emWidth <= 4 ? 6 : emWidth <= 6 ? 8 : 10;
  return clampBlankWidth(n);
};

/**
 * 空白规范化（后处理排版兜底——AI 输出为"一大段文本"时由代码补排版要素）：
 *   1) <u>＿＿＿</u> / 纯文本 ＿N 个 → 带宽度等级的填空横线 blank-N（宽度换算唯一事实源 = blankWidthForChars）
 *   2) 空作文格 <div class="zuo-wen-ge"></div> → 补默认格
 * 排版要素（田字格/四线三格/图区）若 AI 未输出则保持原样，由导出层按学科排版兜底。
 */
export function normalizeBlankMarkers(html = '') {
  let out = String(html || '');
  // 🔴 填空横线宽度换算统一走共享函数（读排版规格库 BLANK.maxCap/wordGap/minBlank），不在此另建梯形
  out = out.replace(/<u>\s*＿+\s*<\/u>/gi, (m) => {
    const len = (m.match(/＿/g) || []).length;
    return `<u class="blank-${blankWidthForChars(len)}">&emsp;</u>`;
  });
  // 🔧 无 class 裸 <u> 空白横线（全角空格/空白实体填充——AI 常见裸输出形态，countBlanks 同源识别 BARE_U_BLANK_RE）：
  //    归一为 u.blank-N（段落末尾自动延伸/非末尾定宽，与导出端 ptab 兜底一致）；
  //    宽度按空白宽度×2（1 字≈2 格，与 ＿ 规则同源），长度≥2 才归一（单个空格/空白不构成书写横线）
  out = out.replace(/<u(?![^>]*class=)[^>]*>\s*(?:[　\u3000 _]|&emsp;){2,24}\s*<\/u>/gi, (m) => {
    const len = (m.match(/\u3000/g) || []).length + (m.match(/[ _]/g) || []).length + (m.match(/&emsp;/gi) || []).length;
    return `<u class="blank-${blankWidthForChars(len)}">&emsp;</u>`;
  });
  // 下划线（半角/全角混合）→ 填空横线：半角 _ 按 0.5 字计（视觉半宽），≥2 个即构成书写横线——
  //   曾只匹配全角 ＿，ASCII "__"（模型常用短空）会漏成裸下划线
  out = out.replace(/(?:＿|_){2,}/g, (m) => {
    const em = (m.match(/＿/g) || []).length + (m.match(/_/g) || []).length * 0.5;
    return `<u class="blank-${clampBlankWidth(Math.round(em * 2))}">&emsp;</u>`;
  });
  // 🔧 括号填空归一（正文主路径曾缺失：模型输出 ((　　)) / （＿ ＿） 被原样保留 → 卷面双括号）
  //    ① 括号+下划线组合（可双层括号）→ <span class="blank-N">&emsp;</span>
  //    ② 括号+纯空白（可双层括号）→ <span class="blank-N">&emsp;</span>
  //    span.blank-N 渲染自带半角括号（预览 CSS ::before/::after + docx 显式补 ()），此处不包外层括号
  out = out.replace(/(?:[（(]{1,2})\s*([_\uFF3F\s\u3000]{1,24})\s*(?:[）)]{1,2})/g, (m, inner) => {
    const u = (inner.match(/[_\uFF3F]/g) || []).length;
    if (u === 0) return m; // 纯空白 → 交给括号空白规则
    return `<span class="blank-${shortBlankWidth(u)}">&emsp;</span>`;
  });
  out = out.replace(/(?:[（(]{1,2})((?:\s|&emsp;|\u2003|\u3000|&nbsp;| )+)(?:[）)]{1,2})/g, (m, inner) => {
    const emspCount = (inner.match(/&emsp;/gi) || []).length + (inner.match(/\u2003/g) || []).length + (inner.match(/\u3000/g) || []).length;
    const nbspCount = (inner.match(/&nbsp;| /gi) || []).length;
    const totalWidth = emspCount + nbspCount * 0.25;
    if (totalWidth <= 0) return m;
    return `<span class="blank-${spaceBlankWidth(totalWidth)}">&emsp;</span>`;
  });
  // ③ 全角裸空括号（零内宽，如"美丽的（）园"读句子写词语遗漏的空格）→ 默认留空格
  //    （规则①②需括号内 ≥1 空格/下划线才转换；零宽全角（）被跳过 → 卷面保留成无书写宽度的全角括号）。
  //    零宽全角（）夹在正文中几乎必为填空缺省（分值/读音/提示等标注均有内文不匹配），故安全收敛统一。
  out = out.replace(/[（][）]/g, () => `<span class="blank-${clampBlankWidth(4)}">&emsp;</span>`);
  out = out.replace(/<div class="zuo-wen-ge">\s*<\/div>/g, `<div class="zuo-wen-ge">${'<span>&emsp;</span>'.repeat(Math.max(1, getMergedSpec().ZUOWEN_DEFAULT_SPAN))}</div>`);
  // 🔧 裸全角空格留空（AI 常见裸输出形态：未包 <u>/括号，如 <p>　　　　　　</p> 写作答题行、
  //    块级元素内纯空白当书写空间）：包成 u.blank-N（预览 flex 延伸 / 导出 ptab 延伸一致）；
  //    在 <u>/括号/span.blank-N 规则之后执行——已归一的形态不含裸空格不受影响；
  //    ≥2 个连续全角空格才处理（单空格为排版分隔）；表格单元格（td/th）不匹配（空位语义保留）
  //    🔧 保留原块级标签外壳（<p> 等）：横线为行尾元素时 CSS `p:has(> u[class*="blank-"]:last-child)`
  //    需该 <p> 命中 flex 延伸；拆裸 <u> 会丢失外壳 → 行尾不延伸、作答横线塌缩/不可见
  out = out.replace(/<(p|div|li)(?![^>]*class=)[^>]*>(\s*\u3000{2,}\s*)<\/\1>/gi, (m, tag, inner) => {
    const len = (inner.match(/\u3000/g) || []).length;
    return `<${tag}><u class="blank-${blankWidthForChars(len)}">&emsp;</u></${tag}>`;
  });
  // 🔧 纯空白"装饰标记"兜底（见 normalizeWhitespaceCarriers：强调类标记无字可加 → 空白实为书写空位）
  out = normalizeWhitespaceCarriers(out);
  // 🔧 拆裸 <u> 空壳：模型把下划线写进无 class 的 <u>（<u>____</u>/<u>（　　）</u>），先被上面规则转成
  //    u.blank-N/span.blank-N 后外层 <u> 仍在 → 下划线叠下划线/叠括号。外层仅包一个 blank 空位时拆壳
  out = out.replace(/<u(?![^>]*class=)[^>]*>\s*(<(u|span) class="blank-\d+">&emsp;<\/\2>)\s*<\/u>/gi, '$1');
  return out;
}

/**
 * 纯空白"装饰标记"→ 填空横线（精确规则，防止把真加点/画线误伤）
 * ============================================================
 * 强调类行内标记（emphasis-dot 加点 / wavy-underline 波浪线 / double-line 双线 /
 * single-line 单线 / underline-sentence 画线 / dashed-line 虚线 / chem-condition /
 * stroke-order 笔顺等）语义必须落在"可见字符"上；
 * 若内容纯为空白（模型把课文填空空位误包成 <span class="emphasis-dot">&nbsp;×8</span>
 * ——空位在、字被抽走，装饰无字可加），则空白实为书写空位 → 按实际空白宽度转 u.blank-N（≥2em）；
 * 不足 2em（单个空格等排版分隔）→ 仅拆掉空壳标记、保留空白。
 * 定位：生成归一（normalizeBlankMarkers 内部）、docx 导出入口（docxBuilder）、
 * 编辑器装载/粘贴（RichTextEditor）三处共用，保证"排版所见 = Word 导出"。
 */
export function normalizeWhitespaceCarriers(html = '') {
  const src = String(html || '');
  const markerCls = 'emphasis-dot|wavy-underline|double-line|single-line|underline-sentence|dashed-line|chem-condition|stroke-order';
  const re = new RegExp(`<span[^>]*class=["'][^"']*(?:${markerCls})[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`, 'gi');
  return src.replace(re, (m, inner) => {
    const text = String(inner || '').replace(/<[^>]+>/g, '');
    // 实体→字符后判"可见内容"（NBSP/EMSP/全角空格均属空白，不算可见）
    const decoded = text
      .replace(/&nbsp;|&#160;|&#xA0;/gi, '\u00A0')
      .replace(/&emsp;|&#8195;/gi, '\u2003')
      .replace(/&ensp;|&#8194;/gi, '\u2002')
      .replace(/&amp;/gi, '&');
    if (/\S/.test(decoded)) return m; // 有可见字符 → 真标记，不动
    let emW = 0;
    for (const ch of decoded) {
      if (ch === '\u3000' || ch === '\u2003') emW += 1;
      else if (ch === '\u2002') emW += 0.5;
      else if (ch === '\u00A0') emW += 0.5;
      else if (ch === ' ') emW += 0.25;
      else if (/\s/.test(ch)) emW += 0.5;
    }
    const rawN = Math.round(emW);
    if (rawN >= 2) return `<u class="blank-${clampBlankWidth(rawN)}">&emsp;</u>`;
    return inner; // 空壳标记（宽度 < 2em，如单个空格排版分隔）→ 拆壳保留原空白
  });
}

/**
 * 配对类题（连一连/连线/配对）渲染结构归一
 * ============================================================
 * 🔴 目的：对模型形态漂移免疫——模型输出配对类题时形态不稳定（两列表格 / 两个相邻列表
 *    等），一律确定性转成标准连线结构（match-question：左右两列 match-item 方框），
 *    预览/编辑器/排版/导出全部按标准连线渲染（docxBuilder 两列方框 + 连线留白）。
 * 规则（保守、幂等、不破坏已有内容）：
 *   1. 幂等：题区已含 match-question 结构 → 不重复处理
 *   2. 触发：题干附近（同一题内、无题号间隔）含"连一连|连线|配对|搭配"关键词
 *   3. 只转明确两列形态：两列表格（每行 td×2）或两个相邻 <ul>/<ol> 列表（各 ≥2 项）
 *   4. 其余形态（单列/普通段落/编号对应）不转，保持原样
 *   5. 转换保留全部文本，不丢内容
 */
export function normalizeMatchQuestions(html = '') {
  const src = String(html || '');
  if (!src || !/(连一连|连线|配对|搭配)/.test(src)) return src;
  let out = src;

  // 两列表格 → match-question（每行 td×2 且 ≥2 行；剥除单元格标签保留文本）
  const tableToMatch = (tableHtml) => {
    const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    const pairs = [];
    for (const [, cellsHtml] of rows) {
      const tds = [...cellsHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m =>
        m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
      if (tds.length === 2 && tds[0] && tds[1]) pairs.push(tds);
    }
    if (pairs.length < 2) return null;
    const col = (side) => `<div class="match-col">${pairs.map(p => `<div class="match-item">${p[side]}</div>`).join('')}</div>`;
    return `<div class="match-question">${col(0)}${col(1)}</div>`;
  };

  // 两个相邻 <ul>/<ol> 列表 → match-question（各 ≥2 项）
  const listsToMatch = (block) => {
    const m = block.match(/(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)\s*(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)/i);
    if (!m) return null;
    const items = (ul) => [...ul.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(x => x[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const left = items(m[1]);
    const right = items(m[2]);
    if (left.length < 2 || right.length < 2) return null;
    const col = (list) => `<div class="match-col">${list.map(it => `<div class="match-item">${it}</div>`).join('')}</div>`;
    return `<div class="match-question">${col(left)}${col(right)}</div>`;
  };

  // 题号间隔守卫：关键词与目标块之间不得跨越题号行（\n [标签] 数字 1. 等），防跨题误转
  const hasQuestionBoundary = (gap) => /\n\s*(?:<[^>]+>\s*)?\d{1,3}\s*[.、．]/.test(gap);

  // ① 两列表格转换（关键词前置、同题、幂等）
  out = out.replace(/([\s\S]*?)(<table[^>]*>[\s\S]*?<\/table>)/gi, (m, before, tableHtml) => {
    const tail = before.slice(-260);
    if (/match-question/.test(tail)) return m; // 幂等（同题已转）
    if (!/(连一连|连线|配对|搭配)/.test(tail)) return m;
    if (hasQuestionBoundary(tail)) return m;
    const match = tableToMatch(tableHtml);
    return match ? before + match : m;
  });

  // ② 相邻双列表转换（同前规则）
  out = out.replace(/([\s\S]*?)(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)\s*(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)/gi, (m, before, l1, l2) => {
    const tail = before.slice(-260);
    if (/match-question/.test(tail)) return m;
    if (!/(连一连|连线|配对|搭配)/.test(tail)) return m;
    if (hasQuestionBoundary(tail)) return m;
    const match = listsToMatch(`${l1}\n${l2}`);
    return match ? before + match : m;
  });

  return out;
}

/**
 * 行首"项目符号 + 序号"双标记归一（AI 常见冗余输出：在序号前附加项目符号字符，如 "• A."）
 * ============================================================
 * 规则（保守、幂等、不误伤）：
 *   1. 仅当行首 = 项目符号字符（•●○◦▪■►➤‣⁃·）+ 空白 + 序号标记时，删项目符号、保留序号
 *   2. 序号标记：字母序号（A. A、 A．）/ 数字序号（1. 1、）/ 括号序号（(1)（1））/ 圆圈序号（① ❶ ㉑ 等）
 *   3. 项目符号后无序号（纯列表符号，如 "• 草原迎客"）→ 不动（列表符号本身合理，删了变普通文本）
 *   4. 只处理块级元素（p/li/div）行首文本，行首非文本（标签开头）不触碰
 *   5. 空白含 HTML 实体空位：AI 常用 &nbsp;/&emsp;/&#160; 等实体分隔"项目符号+序号"，
 *      曾只认真实空白字符（[ \t\u3000…]），实体序列（•&nbsp;A.）lookahead 因非空白失败 → 项目符号残留
 */
// 行首可作分隔的"空白"：真实空白字符 或 HTML 实体空位（&nbsp;&#160;&emsp;&ensp; 等）
const LEAD_WS = '(?:[ \\t\\u3000\\u00A0\\u2003\\u2002]|&(?:nbsp|#160|#xA0|emsp|#8195|ensp|#8194);)';
const LEAD_MARKER_RE = new RegExp(
  `^(${LEAD_WS}*)([•●○◦▪■►➤‣⁃·])(${LEAD_WS}*)(?=[A-Za-z][.、．:：]|\\d+[.、．:：]|[（(]\\s*\\d+\\s*[)）]|[\\u2460-\\u2473\\u2776-\\u277F\\u3251-\\u325F])`
);
export function normalizeLeadingMarkers(html = '') {
  let out = String(html || '');
  out = out.replace(/<(p|li|div)([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
    const n = inner.replace(LEAD_MARKER_RE, '$1');
    return n === inner ? m : `<${tag}${attrs}>${n}</${tag}>`;
  });
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


export default { cleanSectionHtml, stripAiCodeFence, hasAnswerCarrier, htmlToPlainText, analyzeQuestionHierarchy, countTopLevelQuestions, normalizeBlankMarkers, normalizeWhitespaceCarriers, normalizeMatchQuestions, normalizeLeadingMarkers, normalizeIndents, clampBlankWidth, blankWidthForChars, shortBlankWidth, spaceBlankWidth };
