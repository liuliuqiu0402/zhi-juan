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

/** 全角/异体符号归一（教材排版口径，2026-09 学科特色预案②）
 * 只做无歧义的字形映射，不涉内容语义：％→%、数字间 ．→.（全角小数点）、✕/✖→×、➗→÷、
 * 3~6 个连续半角点 → 全角省略号 "……"（单个点=小数点/编号点，不受影响）。
 * 消费方：cleanSectionHtml 收尾（生成/粘贴/装载全链路同源）。
 */
export const normalizeTypographicSymbols = (html = '') => String(html || '')
  .replace(/％/g, '%')
  .replace(/(?<=\d)．(?=\d)/g, '.')
  .replace(/✕|✖/g, '×')
  .replace(/➗/g, '÷')
  .replace(/\.{3,6}/g, '……');

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
  // 🔧 符号字形归一（全角％/．、异体乘除号、省略号点数）——教材排版口径，幂等
  html = normalizeTypographicSymbols(html);
  return html.trim();
};

/**
 * 剥离正文开头的"过程自述/写作计划"段（2026-09 根治：模型把"我已获取教材原文与知识点。现在依据…
 * 围绕…核心知识…命制课时练。现在编写正文。"当正文首段输出——声明≠覆盖，罗列清单不算内容）。
 * 只剥"首个结构块之前、逐段匹配自述特征"的 <p>（文本以 我已/已获取/现在/接下来/依据/围绕… 开头
 * 且含 教材/知识点/课标/核心知识/命制/编写/正文 等任务自述词、非题号开头）；命中即整段删除，
 * 连续自述段最多剥 6 段；真内容段（题号/栏目）不会被误伤（无上述组合特征）。
 */
export function stripPlanningPreamble(raw = '') {
  if (!raw) return raw;
  let out = String(raw);
  const PLAN_RE = /^(?:我已|已取到|已获取|已拿到|已检索到|现在|接下来|以下(?:将|是)?|根据|依据|现依据|围绕|请根据|本次)[^<\n]{0,60}?(?:教材原文|知识点|核心知识|课标|命制|编写|设计|课时练|课堂练习|试卷|正文|大纲|素材)/;
  // 🔧 2026-09 正文丢失事故辅助：模型把"覆盖自查/质量自查/内部自查确认/无需修改/正文已在上一条
  //   消息完整输出"等自述收尾当正文输出（声明≠覆盖）——开头段含这些特征词亦整段剥除
  const SELF_RE = /(?:覆盖自查|质量自查|内部自查|过程自查|自查确认|无需修改|正文已在上一条|无需再调用)/;
  for (let guard = 0; guard < 8; guard++) {
    const pHead = /^\s*(<p[^>]*>)([\s\S]*?)<\/p>/;
    const m = out.match(pHead);
    if (m) {
      const text = m[2].replace(/<[^>]+>/g, '').trim();
      if (!text || /^\d+[.、．]/.test(text)) break;
      if (PLAN_RE.test(text) || SELF_RE.test(text)) {
        out = out.slice(m[0].length).replace(/^\s+/, '');
        continue;
      }
      break;
    }
    // 无 <p> 包裹的裸文本首段（浏览通道模型常在 HTML 前直出自述句，2026-09 实测形态
    //   "已取到教材原文素材（第1~8段）…命题。" 无标签包裹 → 逐段剥；只剥 ≤160 字符、
    //   非题号/非栏目开头的自述行，真内容不误伤
    const bare = out.match(/^([^<\n]+)/);
    if (!bare) break;
    const t = bare[1].trim();
    if (!t) { out = out.slice(bare[0].length); continue; }
    if (t.length > 160 || /^\d+[.、．]/.test(t)) break;
    if (PLAN_RE.test(t) || SELF_RE.test(t)) {
      out = out.slice(bare[0].length).replace(/^\s+/, '');
      continue;
    }
    break;
  }
  return out;
}

/**
 * 正文结构有效性判定（2026-09 正文丢失事故根治：模型以"覆盖自查/质量自查/我已编写完…无需修改"
 * 等过程自述长文冒充正文时，长度阈值（>200 字符）无法拦截——须判定是否含"题目/栏目/作答载体"等
 * 真实正文结构。判定为"内容结构"（任一命中即真）：
 *   ① 栏目标题 <h2>/<h3>/<h4>；② 题目块 <p class="question">；③ 作答载体 blank-N/blank-line/blank-area；
 *   ④ 行首题号/条目号（^\s*\d{1,2}[.、．]\s*）；⑤ 若无上述结构但仅剩纯文本 → 判非正文（自述）。
 * 供 _runPaperOrder 正文采纳守卫复用（只判不改）。
 */
export function hasBodyContentStructure(html = '') {
  const src = String(html || '');
  if (!src.trim()) return false;
  if (/<h[234][^>]*>/i.test(src)) return true;                       // 栏目标题
  if (/<p[^>]*class=["'][^"']*question[^"']*["'][^>]*>/i.test(src)) return true; // 题目块
  if (/class=["'][^"']*(?:blank-\d+|blank-line|blank-area|math-circle-blank)[^"']*["']/i.test(src)) return true; // 作答载体
  if (/(?:^|\n)\s*\d{1,2}[.、．]\s*\S/m.test(src)) return true;      // 行首题号/条目号（正文组织特征）
  return false;                                                      // 无结构 → 纯文本/自述，非正文
}

/**
 * 正文"可交付结构"严格判定（2026-09 正文丢失事故根治·最终采纳守卫）：
 * 仅凭行首编号行不足以证明是可交付正文——模型"覆盖自查"若写成"1. … 2. …"编号清单也会命中宽松版。
 * 可交付正文必须含真实 HTML 内容结构之一：栏目标题(h2-h4)、题目块(class=question)、作答载体(blank 系)。
 * 纯文本/纯清单（无论是否编号）一律不通过 → 交由"完整优先"守卫回退重试，绝不交付。
 */
export function isDeliverableBodyHtml(html = '') {
  const src = String(html || '');
  if (!src.trim()) return false;
  if (/<h[234][^>]*>/i.test(src)) return true;                       // 栏目标题
  if (/<p[^>]*class=["'][^"']*question[^"']*["'][^>]*>/i.test(src)) return true; // 题目块
  if (/<u[^>]*class=["'][^"']*(?:blank-\d+|blank-line|blank-area|math-circle-blank)[^"']*["'][^>]*>|class=["'][^"']*blank-\d+[^"']*["']/i.test(src)) return true; // 作答载体
  return false;
}

/**
 * 正文题号提取/连续性检测（2026-09-10 正文丢题事故根治·定稿校验）：正文部分（答案区前）按
 * 行首 `N.` 提取题号——extractBodyQuestionNumbers 返回保序数组（供"答案生成前快照 vs 交付
 * 比对"，抓"答案生成后动正文"）；detectBodyNumberingGap 查 1~峰值 缺口，返回缺号明细
 * （供 ①正文采纳拦截重试 ②最终报告如实输出缺号）。
 * 口径与 useAiGenerator 正文丢失护栏 qCount 同源：块级标签闭合补换行后按行首 `N.` 计题号。
 * gap 返回 null = 无缺口/样本不足以判定（峰值 <3 不判——防小卷/条目清单误报；
 * 峰值 >60 的清单型大卷仅个别缺失 <3 处不判，防目录/知识点清单跳号误报）。
 * 🔴 2026-09-11 漏检补强：旧实现 `found.size < 3` 提前返回 null——"正文缺 2~5 题、只剩题号
 * 1 与 6"（实测样本）恰落漏检区（found={1,6} → 不判 → 残卷静默交付）。改为先按峰值判定：
 * 峰值 ≥3 即查 1~峰值缺口，高位题号存在而低位缺失同样拦截。
 */
export function extractBodyQuestionNumbers(html = '') {
  const src = String(html || '');
  if (!src.trim()) return [];
  const bodyOnly = src.split(/<div[^>]*class=["'][^"']*answer-section|<h[1-6][^>]*>\s*参考答案/i)[0];
  const text = bodyOnly.replace(/<\/(?:p|li|h[1-6]|div|tr)>/gi, '\n').replace(/<[^>]+>/g, '');
  const out = [];
  const re = /(?:^|\n)\s*([1-9]\d?)[.、．](?![.\d])/g;
  let m;
  while ((m = re.exec(text))) out.push(Number(m[1]));
  return out;
}

export function detectBodyNumberingGap(html = '') {
  const found = new Set(extractBodyQuestionNumbers(html));
  const peak = found.size ? Math.max(...found) : 0;
  if (peak < 3) return null;
  const missing = [];
  for (let i = 1; i <= peak; i++) if (!found.has(i)) missing.push(i);
  if (!missing.length) return null;
  // 峰值 >60 的清单型大卷（目录/知识点条目）：仅个别数字缺失多为行内数字干扰，≥3 处才算缺题
  if (peak > 60 && missing.length < 3) return null;
  return { peak, found: [...found].sort((a, b) => a - b), missing };
}

/**
 * 🔢 丢题根因诊断（2026-09-12 起；用户要求"加日志找根因，不靠猜测修复"）
 * ============================================================
 * 在缺号拦截处调用，产出**可定性**的证据，用于分辨两种完全不同的成因：
 *   ① 模型真跳号      —— 缺号在正文"任何位置"都不出现（生成行为问题）
 *   ② 提取规则漏判    —— 缺号出现了，但不在"行首 + [.、．]"这一被识别形态上
 *        （同段连写 `3. … 4. …`、括号序号 `(4)`/`（4）`、被内联标签包裹、顿号形态等）
 * 附加信号 anyDigitCount（正文内 1~2 位数字总数）与 lineStartCount（行首题号数）对照：
 *   两者差距大 → 大量数字不在行首 → 佐证②方向。
 * ⚠️ 本函数**不参与拦截判定**（判定仍由 detectBodyNumberingGap 决定），只供日志取证。
 * @param {string} html 正文 HTML（与 detectBodyNumberingGap 同入参口径）
 * @returns {{gap:object|null, found:number[], missing:number[], anyDigitCount:number,
 *            peek:Array<{n:number, where:string, sample:string}>}}
 */
export function diagnoseNumberingGap(html = '') {
  const gap = detectBodyNumberingGap(html);
  if (!gap) return { gap: null, found: [], missing: [], anyDigitCount: 0, peek: [], skeleton: [] };
  const src = String(html || '');
  const bodyOnly = src.split(/<div[^>]*class=["'][^"']*answer-section|<h[1-6][^>]*>\s*参考答案/i)[0];
  const text = bodyOnly.replace(/<\/(?:p|li|h[1-6]|div|tr)>/gi, '\n').replace(/<[^>]+>/g, '');
  const peek = [];
  for (const n of gap.missing) {
    const lineForm = new RegExp(`(?:^|\\n)\\s*${n}[.、．](?![.\\d])`);
    const lineBracket = new RegExp(`(?:^|\\n)\\s*[(（]\\s*${n}\\s*[)）]`);
    const bracketForm = new RegExp(`[(（]\\s*${n}\\s*[)）]`);
    const bareForm = new RegExp(`(?:^|[^0-9])${n}(?![0-9])`);
    let where = '未出现（正文任何位置均无该号）→ 指向模型真跳号';
    let idx = -1;
    if (lineForm.test(text)) {
      where = '行首题号形态（本应被识别，属异常）';
      idx = text.search(lineForm);
    } else if (lineBracket.test(text)) {
      // ⚠️ 题号规格（promptLibrary「输出格式」）：**题目用 `N.`，子题用 `(N)`** ——
      //    故括号序号命中**多为同名子题**，不足以判定"缺号是提取漏判"，须以下方骨架为准。
      where = '行首括号序号 (N)/（N）（属**子题**形态）——须以骨架判定该号是大题缺失还是子题，暂不足以归因';
      idx = text.search(lineBracket);
    } else if (bracketForm.test(text)) {
      where = '句中括号序号 (N)/（N）（子题形态）——须以骨架判定，暂不足以归因';
      idx = text.search(bracketForm);
    } else if (bareForm.test(text)) {
      where = '仅裸数字/句中出现（非题号形态）——可能为提取漏判，须以骨架判定';
      idx = text.search(bareForm);
    }
    peek.push({
      n,
      where,
      sample: idx >= 0 ? text.slice(Math.max(0, idx - 30), idx + 30).replace(/\n/g, '⏎') : '',
    });
  }
  const anyDigitCount = (text.match(/(?:^|[^0-9])\d{1,2}(?![0-9])/g) || []).length;
  // 🔢 题号骨架：正文中所有"行首 数字序号 / 括号序号 / 第N题"行（各截前 44 字，最多 40 行）——
  //    用于判定"缺号"是**大题缺失**（真丢题）还是**子题被误当题号**（判定口径问题）。
  const skeleton = text.split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(?:[(（]?\d{1,2}[)）.、．]|第\s*\d{1,2}\s*[题小])/.test(l))
    .slice(0, 40)
    .map((l) => l.slice(0, 44));
  return { gap, found: gap.found, missing: gap.missing, anyDigitCount, peek, skeleton };
}

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
 * @param {number} [maxChars] 上限（0/缺省 = 不截断，全文返回）
 * @returns {string} 纯文本正文
 */
export const htmlToPlainText = (html = '', maxChars = 0) => {
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
  if (maxChars > 0 && body.length > maxChars) body = body.slice(0, maxChars) + '\n…（正文过长已裁剪，请按已给出的题号继续作答）';
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
const BLANK_SPEC = () => getMergedSpec().BLANK || { maxCap: 16, wordGap: 1, minBlank: 2 };
/** 宽度封顶/下限：规格 BLANK.maxCap / minBlank（超长横线交由"行尾自动延伸"，不无限加宽） */
export const clampBlankWidth = (n) => {
  const { maxCap, minBlank } = BLANK_SPEC();
  return Math.min(maxCap, Math.max(minBlank, Math.round(n)));
};
/** 字宽 → 宽度：正文书写横线/裸下划线换算（1 字位 ≈ wordGap em；＿ 计数按字位计） */
export const blankWidthForChars = (chars) => {
  const { wordGap } = BLANK_SPEC();
  return clampBlankWidth(chars * wordGap);
};
/** 括号填空·下划线空位 → 宽度档：下划线即"字位"标记（1 ＿≈1 字位），按 1字位≈wordGap em 换算
 *  🔧 2026-09 全局一致性：曾用 1:1 梯形（≤3→2…），与裸下划线（blankWidthForChars 字×wordGap）口径不同——
 *     （＿＿＿＿）4字位只得 4em（半宽）、2~3 条一律 2em → "括号内答案写不下/时宽时窄"；
 *     现收敛为与裸 ＿/u 空白同一换算（blankWidthForChars），任何写法产物一致 */
export const shortBlankWidth = (underscores) => blankWidthForChars(underscores);
/** 括号填空·纯空白空位 → 宽度档：1 字位 ≈ 1em 空白（与 <u>空白</u> 同口径：字位=空格数），按 1字位≈wordGap em 换算
 *  🔧 2026-09 全局一致性：曾用非线性梯形（≤2→4 / ≤4→6 / >6→10 封顶），7~24 个空格的括号空位
 *     全被压成同一 10em → "都一样宽"；现线性：N = 字位×wordGap，宽窄随空白数量单调 */
export const spaceBlankWidth = (emWidth) => blankWidthForChars(emWidth);

/** 裸书写空跑段 → u.blank-N（整段空白行 + 行尾/句读前行内书写空）
 * ============================================================
 * 书写空载体只认模型明确输出的形态：＿（402）、<u> 包裹（387/395）、括号空位（括号收敛）、
 * "整段纯空白行"（本函数规则①，写作答题行），以及**行尾/句读前的行内书写空**（规则②收窄版）：
 * 模型在引导词后输出连续空格作作答留白（"加法算式：　　　　</p>"、"口诀：　　　　。"），
 * 空格段后到块级结束无任何紧跟内容、或后一个可见字符是中文句读 → 书写空意图明确 → 转横线；
 * 空格段后**紧跟内容**（"2个3相加　　○○○"圆图间距、"（1）2×6＝12　　读作："下一引导词、
 * 算式"＝　　　（人）"的单位括号前 = 算式填空由 normalizeMathCircleBlanks 邻接运算符收方框）
 * → 属排版分隔，保留原文（2026-09 实证：曾把分隔空格无差别转横线 → 撤，恢复仅行尾/句读口径）。
 * 消费方：normalizeBlankMarkers（生成归一）/ 编辑器装载·粘贴（RichTextEditor）/ 导出端（GenerateModule/TypesetModule）。
 */
const blankRunEmUnits = (s) => (s.match(/[\u3000\u2003]/g) || []).length + (s.match(/&emsp;/gi) || []).length;

/** 取字符串最末一个"可见字符"（跳过标签/空白/实体；空则返回 ''）。语义填空位判定用。 */
const prevVisibleChar = (s) => {
  let i = s.length;
  while (i > 0) {
    i -= 1;
    const c = s[i];
    if (c === '>') { const t = s.lastIndexOf('<', i - 1); if (t === -1) return ''; i = t; continue; }
    if (c === ';') { const a = s.lastIndexOf('&', i - 8); if (a !== -1 && s.slice(a, i + 1).length <= 8) { i = a; continue; } }
    if (/\s|[\u3000\u2003\u2002]/.test(c)) continue;
    return c;
  }
  return '';
};
/** 取字符串起始第一个"可见字符"（跳过标签/空白/实体；空则返回 ''）。 */
const nextVisibleChar = (s) => {
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '<') { const t = s.indexOf('>', i + 1); if (t === -1) return ''; i = t; continue; }
    if (c === '&') { const t = s.indexOf(';', i + 1); if (t !== -1 && t - i <= 8) { i = t; continue; } }
    if (/\s|[\u3000\u2003\u2002]/.test(c)) { i += 1; continue; }
    return c;
  }
  return '';
};

export function wrapBareBlankRuns(html = '') {
  let out = String(html || '');
  if (!out) return out;
  // ① 块级"整段纯空白"（<p>/<div>/<li> 内仅空白跑段，写作答题行）→ 保留外壳包 u.blank-N（外壳参与排版/延伸）
  out = out.replace(/<(p|div|li)(?![^>]*class=)[^>]*>(\s*(?:[\u3000\u2003]|&emsp;){2,}\s*)<\/\1>/gi, (m, tag, inner) => {
    const len = blankRunEmUnits(inner);
    return `<${tag}><u class="blank-${blankWidthForChars(len)}">&emsp;</u></${tag}>`;
  });
  // ② 行内书写空（收窄版）：引导词后连续空格段（"加法算式：＿＿" 形态，模型真实留白）→ u.blank-N。
  //    后视守卫：空格段后到块级闭合（下一个 <p|div|li|table>）之间无可见内容（行尾作答行），
  //    或首个可见字符是中文句读（。，、；：？！，"口诀：　　。"）→ 书写空；
  //    后紧跟任何内容（汉字/数字/符号/○□图例/半角单位括号…）→ 分隔空格，保留原文不转。
  //    段首/标签后直接空位（缩进/列间隔）仍守卫不转；单空位 {2,} 天然不命中。
  out = out.replace(/(?:[\u3000\u2003]|&emsp;){2,}/g, (m, off, all) => {
    const head = all.slice(0, off);
    const lastTag = head.lastIndexOf('>');
    const sinceTag = (lastTag === -1 ? head : head.slice(lastTag + 1)).trim();
    if (!sinceTag) return m; // 段首/标签后缩进 → 不转
    const tail = all.slice(off + m.length);
    const blockEnd = tail.search(/<(?:p|div|li|table)\b/i);
    const tailText = (blockEnd === -1 ? tail : tail.slice(0, blockEnd))
      .replace(/<[^>]+>/g, '').replace(/^[\s\u3000\u2003\u2002]+/, '');
    if (!tailText) return `<u class="blank-${blankWidthForChars(blankRunEmUnits(m))}">&emsp;</u>`; // 行尾书写空
    if (/^[。，、；：？！]/.test(tailText)) return `<u class="blank-${blankWidthForChars(blankRunEmUnits(m))}">&emsp;</u>`; // 句读前书写空
    return m; // 后紧跟内容 → 分隔空格保留
  });
  // ③ 中句"语义填空位"（2026-09 收口：概念/算理/算式题干中的答案空位被模型输出为裸空格串——
  //    "求 4 个　　　　相加的和"、"0.6×0.3＝　×　＝　。"），规则②只覆盖行尾/句读前，中句空位此前原样保留
  //    → docx 里只是隐形空隙、没有可书写横线。此处按"语义夹缝"两种确定性上下文兜底转 u.blank-N：
  //    a) CJK 夹缝：前、后最近可见字符均为汉字（量词/名词后 + 动词/名词前，"个…相加""有…位""移动…位"）；
  //    b) 算式空位链：前为 ＝×÷＋－≈ 之一、后为 ×÷＋－＝≈。或汉字（"＝　×　＝　。" 的 各 空位）。
  //    防护（不转）：数字两侧列分隔（"12　　读作："前为数字）、图形/符号间距（"相加　　○○○"后为 ○）、
  //    单位括号（"（人）"前导）等——前/后可见字符按最近非标签字符判定，宽度 ≥2 全角/em 单位才转。
  //    列分隔抑制（2026-09 收口·内容型排版防护）：CJK 夹缝内若同句（到句读/块边界止）还存在**同款空位**，
  //    "温暖　　寒冷　　明亮"式词表/罗列在内容型资料中是排版列分隔而非填空位——多空位无句读连续出现视为罗列，
  //    整体不转（编辑要留作答线时须按渲染契约给显式载体）；孤立单空位（句中仅此一处）才按语义空位转。
  const hasSiblingGap = (win, mineLen) => {
    const re = /(?:[\u3000\u2003]|&emsp;){2,}/g;
    let mm;
    while ((mm = re.exec(win)) !== null) {
      if (Math.abs(blankRunEmUnits(mm[0]) - mineLen) <= 2) return true;
    }
    return false;
  };
  out = out.replace(/(?:[\u3000\u2003]|&emsp;){2,}/g, (m, off, all) => {
    const prev = prevVisibleChar(all.slice(0, off));
    const next = nextVisibleChar(all.slice(off + m.length));
    if (!prev || !next) return m;
    const prevIsCjk = /[\u4e00-\u9fa5]/.test(prev);
    const nextIsCjk = /[\u4e00-\u9fa5]/.test(next);
    const prevIsOp = /[＝×÷＋－≈]/.test(prev);
    const nextInChain = /[×÷＋－＝≈。]/.test(next);
    if (prevIsCjk && nextIsCjk) {
      // CJK 夹缝：先查同句是否另有"同款罗列空位"（排版词表/列分隔）→ 是则不转；孤立空位才转
      const mineLen = blankRunEmUnits(m);
      const after = all.slice(off + m.length);
      const cut = after.search(/[。，、；：？！]|<(?:p|div|li|table)\b/i);
      const aheadWin = cut === -1 ? after.slice(0, 80) : after.slice(0, cut);
      const before = all.slice(0, off);
      const pIdx = Math.max(...['。', '，', '、', '；', '：', '？', '！'].map((ch) => before.lastIndexOf(ch)), before.lastIndexOf('>'));
      const behindWin = pIdx >= 0 ? before.slice(pIdx + 1) : before;
      if (hasSiblingGap(aheadWin, mineLen) || hasSiblingGap(behindWin, mineLen)) return m;
      return `<u class="blank-${blankWidthForChars(mineLen)}">&emsp;</u>`;
    }
    if (prevIsOp && (nextInChain || nextIsCjk)) {
      return `<u class="blank-${blankWidthForChars(blankRunEmUnits(m))}">&emsp;</u>`;
    }
    return m;
  });
  return out;
}

/** 空载体兜底填充（编辑器装载/粘贴前调用）
 * ============================================================
 * ProseMirror/Tiptap 解析时，classed 载体若内容为空或纯 ASCII 空格会被整体剥除
 * （<u class="blank-8"></u> → 消失；编辑器 onUpdate 回写后"源被覆盖/横线丢失"固化）。
 * 本函数把"无任何可见字符"的载体统一填 &emsp; 占位（不可见，宽度由 class 档位/导出 NBSP 撑起），
 * 保证载体保 class 存活、可往返。幂等；已有可见字/空白实体内容不动。
 * 覆盖：u/span.blank-N、blank-line、square-box、math-circle-blank-18（空格子渲染皆由 class 定宽）。
 */
export function ensureCarrierContent(html = '') {
  const src = String(html || '');
  return src.replace(/<(u|span)((?:[^>]*\bclass=["'][^"']*(?:blank-\d+|blank-line|square-box|math-circle-blank-18)[^"']*["'])[^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
    const text = String(inner || '').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;|&#160;|&#xA0;/gi, '\u00A0')
      .replace(/&emsp;|&#8195;/gi, '\u2003')
      .replace(/&ensp;|&#8194;/gi, '\u2002');
    if (/\S/.test(text)) return m; // 有可见内容（含 NBSP/EMSP 空白实体）→ 原样
    return `<${tag}${attrs}>&emsp;</${tag}>`;
  });
}

/**
 * 英文语段省略号规范：英文省略号三点（…），不用中文六点（……）
 * ============================================================
 * 仅处理"省略号两侧（各 ≤10 字符窗口）无汉字"的语境——中文说明文字里的六点省略号
 * 是合法中文标点，不受影响；英文句子/解析行里的六点省略号归一为三点。
 * 覆盖：……（六点全角）与 3~6 个连续半角点（前面字符归一已把 3~6 点合并成 ……，此处统一收口）。
 */
export function normalizeEnglishEllipsis(html = '') {
  const src = String(html || '');
  if (!src || !/……|\.{4,8}/.test(src)) return src;
  // 线性单次扫描：命中"六点/连点段"各只处理一次（避免全局正则在同位置双匹配）。
  // 判定英文语段：省略号前后各 8 字符窗口内出现英文字母；纯汉字语境保持中文六点。
  const re = /……|\.{4,8}/g;
  let out = '';
  let idx = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    const pre = src.slice(Math.max(0, m.index - 8), m.index);
    const post = src.slice(re.lastIndex, re.lastIndex + 8);
    const eng = /[A-Za-z]/.test(pre) || /[A-Za-z]/.test(post);
    out += src.slice(idx, m.index) + (eng ? '…' : m[0]);
    idx = re.lastIndex;
  }
  return out + src.slice(idx);
}

/**
 * 畸形填空载体拆壳（不变量守卫，2026-09 收口：整段正文/标题被误包进 <u class="blank-N">）
 * ============================================================
 * 语义不变量：blank-N 是"空书写位"——内部只允许空白/空白实体，不允许正文文字。
 * 若 blank-N 内出现 ≥6 个非空字符（如 整句被包、答案解析整行被包），则该载体必属前置误包：
 * 拆壳还原内部纯文本（去掉画线），保证 blank-N 不会把句子/标题画成横线、破坏对齐。
 * 块级标题（h1~h6）内一律不允许出现填空载体（标题不是作答位）——无论内容长短都还原。
 * 幂等；空位（&emsp; 等）与短内容载体不动；拆壳只删画线不删内容。生成归一/编辑器装载/粘贴同源消费。
 */
export function unwrapMalformedBlankCarriers(html = '') {
  const src = String(html || '');
  if (!/<(u|span)\b[^>]*class=["'][^"']*blank-\d+/i.test(src)) return src;
  const CORE_RE = /&emsp;|&#8195;|&#x2003;|\u2003|\u3000|&nbsp;|\u00A0|&#160;/g;
  const isRealText = (inner = '') => {
    const core = String(inner).replace(/<[^>]+>/g, '').replace(CORE_RE, '').replace(/\s/g, '');
    return core.length >= 6;
  };
  // ① 块级标题内不允许填空载体（标题不是作答位）→ 整段还原标题内容
  let out = src.replace(/<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
    const hasBlank = /<(u|span)\b[^>]*class=["'][^"']*blank-\d+/i.test(inner);
    if (!hasBlank) return m;
    const cleaned = inner.replace(/<(u|span)\b(?=[^>]*\bclass=["'][^"']*\bblank-\d+\b[^"']*["'])[^>]*>([\s\S]*?)<\/\1>/gi, (_mm, _t, c) => c);
    return `<${tag}${attrs}>${cleaned}</${tag}>`;
  });
  // ② 内容型 blank-N 误包正文（≥6 非空字符）→ 拆壳还原内部文本
  out = out.replace(/<(u|span)((?=[^>]*\bclass=["'][^"']*\bblank-\d+\b[^"']*["'])[^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
    if (!isRealText(inner)) return m;
    return inner;
  });
  return out;
}

/**
 * 排版端"单独空行"字符串打标（HTML 直出/独立文档导出前调用；编辑器内由 RichTextEditor DOM 层同逻辑打标）
 * ============================================================
 * 识别"块级容器（p/div/li）内仅一条填空横线（u[class*=blank-N]）、无任何正文文字/其它元素"
 * （模型整行留白作答线 → <p><u class="blank-N">&emsp;</u></p> 的形态）→ 给容器加 class="blank-solo"，
 * 供 carrierCss `:is(p,div,li).blank-solo` 规则 flex 弹性延伸，与 Word ptab（docxBuilder runs.length===1
 * 判定）口径一致。
 * ⚠️ 带引导词的句末短填空（"读作：＿＿"）、句内短填空（前后有文本节点）不命中 → 保持定宽可编辑。
 * 幂等：已带 blank-solo 或非"整段仅一条横线"结构不动；无 DOMParser 环境（Node 校验脚本）原样返回。
 */
export function markSoloBlankLines(html = '') {
  const src = String(html || '');
  if (!src || typeof DOMParser === 'undefined') return src;
  if (!/<(p|div|li)\b[^>]*>\s*<u\b[^>]*class=["'][^"']*blank-\d+/i.test(src)) return src;
  try {
    const doc = new DOMParser().parseFromString(`<body>${src}</body>`, 'text/html');
    const blocks = doc.body.querySelectorAll('p, div, li');
    for (const b of blocks) {
      // 嵌套容器（div 内含 p）跳过：只处理叶子块（与编辑器打标一致，避免误伤结构）
      let hasBlockChild = false;
      for (const c of b.childNodes) {
        if (c.nodeType === 1 && ['P', 'DIV', 'LI', 'TABLE', 'UL', 'OL'].includes(c.tagName)) { hasBlockChild = true; break; }
      }
      if (hasBlockChild) continue;
      let hasBlank = false;
      let hasOther = false;
      for (const n of b.childNodes) {
        if (n.nodeType === 3) { // TEXT_NODE：非空即正文（含全角空格/NBSP），与 docxBuilder runs 对齐
          if (n.textContent) hasOther = true;
          continue;
        }
        if (n.nodeType !== 1) { hasOther = true; continue; }
        const tag = n.tagName;
        const cls = n.className || '';
        if (tag === 'U' && /\bblank-\d+\b/.test(cls)) hasBlank = true;
        else if (tag === 'BR') { /* 忽略 */ }
        else hasOther = true;
      }
      if (hasBlank && !hasOther && !b.classList.contains('blank-solo')) b.classList.add('blank-solo');
    }
    return doc.body.innerHTML;
  } catch (e) {
    return src;
  }
}

/**
 * 空白规范化（normalizeBlankMarkers）：后处理排版兜底——AI 输出为"一大段文本"时由代码补排版要素：
 *   1) <u>＿＿＿</u> / 纯文本 ＿N 个 → 带宽度等级的填空横线 blank-N（宽度换算唯一事实源 = blankWidthForChars）
 *   2) 空作文格 <div class="zuo-wen-ge"></div> → 补默认格
 * 排版要素（田字格/四线三格/图区）若 AI 未输出则保持原样，由导出层按学科排版兜底。
 * ============================================================
 * 入口顺序：① 数字实体解码 → ② 密封信息栏 ＿ 保护 → ③ 各空白/括号/下划线归一 → ④ 还原密封占位。
 */

/**
 * 🔧 载体内数字字符引用解码（C3-C5 实体漏判根治）
 * ============================================================
 * 模型输出偶发以数字实体承载载体字符（&#xFF08;&#x3000;&#xFF09; 括号空位、&#95; 下划线、
 * &#x25CB;/&#x25A1; 算式填空圈/框等）；DOM 解析会解码，但正文归一在字符串层先行，
 * 不解码则实体形态空位穿过整条归一链漏判，产物与字面字符路径不一致
 * （字面 （　　） → span.blank-N 标准括号载体；实体形态 → 普通字面字符，无载体语义）。
 * 仅解码"载体内安全字符集"（括号/空白/下划线/○□），不碰 &lt;/&gt;/&amp; 等结构实体（防注入）。
 * 消费方：normalizeBlankMarkers / normalizeWhitespaceCarriers 入口（编辑器/排版装载共用）。
 */
const CARRIER_ENTITY_CP = new Set([0x28, 0x29, 0x5F, 0xA0, 0x2002, 0x2003, 0x3000, 0xFF08, 0xFF09, 0xFF3F, 0x25CB, 0x25A1]);
const decodeCarrierNumericEntities = (s) => String(s || '').replace(/&#(?:x([0-9a-fA-F]+)|(\d+));?/gi, (m, hex, dec) => {
  const cp = hex ? parseInt(hex, 16) : parseInt(dec, 10);
  if (CARRIER_ENTITY_CP.has(cp)) return String.fromCodePoint(cp);
  return m;
});

/**
 * 🔴 空位载体"内部只许空白"（2026-09-12 丢题事故根治）
 * ============================================================
 * 病根实证：载体正则原写成 `<u|span …>[\s\S]*?</…>`——**内部允许任意内容**。一旦模型输出畸形载体
 *   （未闭合、或把正文整句包进 blank-N），贪婪匹配会跨题吞下一大段；而"同段形态归一"
 *   （unifySameParagraphWriteBlanks）与"跨类型叠写去重"会把命中的**整段替换成一枚短空位标签** →
 *   该段正文连同题号一起消失（实测：英语课时练题 1~18 完整，归一化后 2、3、4 整题被吞，整卷判失败）。
 * 约束：blank-N 语义就是"空书写位，内部只许空白"（见 unwrapMalformedBlankCarriers 注释），
 *   故**会改写内容的**载体正则一律收窄为只认空白/空白实体；内含正文的畸形载体由
 *   unwrapMalformedBlankCarriers 先拆壳还原为纯文本（其调用已前置到形态归一/去重之前）。
 */
const BLANK_INNER = '(?:&emsp;|&nbsp;|&ensp;|&#8195;|&#x2003;|&#160;|&#x00A0;|[\\s\\u3000\\u2003\\u00A0])*';

export function normalizeBlankMarkers(html = '') {
  let out = String(html || '');
  // ① 数字实体解码（见 decodeCarrierNumericEntities 注释，C3-C5）
  out = decodeCarrierNumericEntities(out);
  // ② 🔧 密封线考生信息栏保护（C2 链序）：模型按指令在卷首输出"学校：＿＿＿　班级：＿＿＿…"
  //    文本填写栏，若被下方 ＿→填空横线 归一吃掉，排版/导出按 textContent 重建密封区时无 ＿
  //    可回填（sealText.normalizeSealBlanks 只扩 ＿），填写栏塌缩成无横线的空串。
  //    保护条件：＿ 运行所在行前后 80 字符窗口内另有密封字段词（≥2 字段=信息栏形态），
  //    或字段起于段首（前一字符为标签闭合/换行）；普通正文填空（＿ 附近无第二字段词、
  //    非段首字段形态）不豁免，仍按填空归一。占位用私用区字符（正文规则不涉及），函数末还原。
  const sealFieldRe = /密封线内不要答题|学校[:：]|班级[:：]|姓名[:：]|学号[:：]|考生[:：]|考号[:：]/;
  const sealFieldReG = new RegExp(sealFieldRe.source, 'g');
  const sealKeeps = [];
  out = out.replace(/((?:密封线内不要答题|学校[:：]|班级[:：]|姓名[:：]|学号[:：]|考生[:：]|考号[:：])[^<>\n]{0,120}?)(＿{2,})/g, (m, head, us, off, all) => {
    const before = all.slice(Math.max(0, off - 80), off);
    const after = all.slice(off + m.length, off + m.length + 80);
    const tokens = (before + head + after).match(sealFieldReG) || [];
    // 段首豁免：字段起于文本段开头（自上一标签闭合起无正文，含"<p>学校：＿＿＿</p>"的段首形态）；
    // 行内"…姓名：＿＿"填空（标签后尚有正文）不豁免，防正文误护
    const lastTag = before.slice(-80).lastIndexOf('>');
    const textSinceTag = lastTag === -1 ? before : before.slice(lastTag + 1);
    const blockHead = /^\s*$/.test(textSinceTag);
    if (tokens.length >= 2 || blockHead) {
      const key = `\uE000${sealKeeps.length}`;
      sealKeeps.push(us.length);
      return head + key;
    }
    return m;
  });
  // 🔴 填空横线宽度换算统一走共享函数（读排版规格库 BLANK.maxCap/wordGap/minBlank），不在此另建梯形
  out = out.replace(/<u>\s*＿+\s*<\/u>/gi, (m) => {
    const len = (m.match(/＿/g) || []).length;
    return `<u class="blank-${blankWidthForChars(len)}">&emsp;</u>`;
  });
  // 🔧 无 class 裸 <u> 空白横线（全角空格/空白实体填充——AI 常见裸输出形态，countBlanks 同源识别 BARE_U_BLANK_RE）：
  //    归一为 u.blank-N（段落末尾自动延伸/非末尾定宽，与导出端 ptab 兜底一致）；
  //    宽度按 blankWidthForChars（1 字位≈wordGap em；wordGap=1 时 1 空格≈1em，不翻倍），
  //    与 ＿ 规则同源；长度≥2 才归一（单个空格/空白不构成书写横线）
  out = out.replace(/<u(?![^>]*class=)[^>]*>\s*(?:[　\u3000 _]|&emsp;){2,24}\s*<\/u>/gi, (m) => {
    const len = (m.match(/\u3000/g) || []).length + (m.match(/[ _]/g) || []).length + (m.match(/&emsp;/gi) || []).length;
    return `<u class="blank-${blankWidthForChars(len)}">&emsp;</u>`;
  });
  // 🔧 括号填空归一（正文主路径曾缺失：模型输出 ((　　)) / （＿ ＿） 被原样保留 → 卷面双括号）
  //    ① 括号+下划线组合（可双层括号）→ <span class="blank-N">&emsp;</span>
  //    ② 括号+纯空白（可双层括号）→ <span class="blank-N">&emsp;</span>
  //    span.blank-N 渲染自带半角括号（预览 CSS ::before/::after + docx 显式补 ()），此处不包外层括号
  //    🔴 顺序：括号收敛必须先于下方"裸＿→u.blank"规则——曾在其后执行，连续下划线被先行转成
  //    <u class="blank-N"> 标签后括号正则只认字面字符而失配 → （＿＿＿）残留"字面括号+横线"并存、
  //    <u>（＿＿＿）</u> 残留三层叠线（2026-09 实证）。"括号与横线并存：外层括号保留括号语义
  //    （括号填空），内层横线不另成载体"——先收敛括号，裸＿ 规则只处理括号外的下划线。
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
  // ④ 括号内已被上方 <u>＿+</u> 规则转成 u.blank-N 标签的形态（模型写 （<u>＿＿</u>） →
  //    387 先转标签、①的字面正则失配）→ 剥字面括号、内层横线不另成载体，同口径收敛括号填空；
  //    "括号与横线并存：外层括号保留括号语义"，宽度沿用内层 u.blank-N 的档位
  out = out.replace(/(?:[（(]{1,2})\s*(<u class="blank-(\d+)">&emsp;<\/u>)\s*(?:[）)]{1,2})/g, (_m, _tag, n) => `<span class="blank-${Math.max(2, Number(n) || 2)}">&emsp;</span>`);
  // 下划线（半角/全角混合）→ 填空横线：半角 _ 按 0.5 字位计（视觉半宽），≥2 个即构成书写横线——
  //   曾只匹配全角 ＿，ASCII "__"（模型常用短空）会漏成裸下划线；
  //   宽度按 blankWidthForChars（字位数×wordGap；wordGap=1 时 1 ＿≈1em，不再 ×2 放大）
  out = out.replace(/(?:＿|_){2,}/g, (m) => {
    const em = (m.match(/＿/g) || []).length + (m.match(/_/g) || []).length * 0.5;
    return `<u class="blank-${blankWidthForChars(em)}">&emsp;</u>`;
  });
  out = out.replace(/<div class="zuo-wen-ge">\s*<\/div>/g, `<div class="zuo-wen-ge">${'<span>&emsp;</span>'.repeat(Math.max(1, getMergedSpec().ZUOWEN_DEFAULT_SPAN))}</div>`);
  // 🔧 空格宽+括号空 双载体剥除（2026-09 实证：0.09＝　　（　　）——模型按"答案宽度换算"先输出
  //    全角空格串、其后又叠一个括号空 → 同一答案空两种载体（导出成"方框后括号"）。
  //    括号空已在上方归一为 <span class="blank-N">&emsp;</span>，此处剥除其前 ≥2 字符的冗余空白宽，
  //    只保留括号空为唯一载体；单个空格（自然间隔）不剥。u.blank 前置□类由下方跨类型去重处理。
  out = out
    .replace(/((?:&emsp;|&#8195;|&#x2003;|\u2003|\u3000|&nbsp;| ){2,})(?=<u class="blank-\d+">&emsp;<\/u>)/g, '')
    .replace(/((?:&emsp;|&#8195;|&#x2003;|\u2003|\u3000|&nbsp;| ){2,})(?=<span class="blank-\d+">&emsp;<\/span>)/g, '');
  // 🔧 裸书写空跑段 → u.blank-N（wrapBareBlankRuns：整段纯空白行 + 行内前有正文的连续空位段；
  //    全角空格 \u3000 / em 空格 \u2003·&emsp; 实体同口径——曾只认 \u3000，模型 em 空格形态漏判 → 无横线）。
  //    在 <u>/括号/span.blank-N 规则之后执行（幂等）；≥2 空位才处理（单空位=列分隔/排版）；
  //    保留块级外壳（<p> 等）供整行作答参与排版；u.blank-N 固定 N em（行尾延伸仅 .blank-line/整行作答享有）
  out = wrapBareBlankRuns(out);
  // 🔧 纯空白"装饰标记"兜底（见 normalizeWhitespaceCarriers：强调类标记无字可加 → 空白实为书写空位）
  out = normalizeWhitespaceCarriers(out);
  // 🔴 同段书写空位形态统一（2026-09 复现收口：同句混用 横线/方框/括号空 → 多数形态统一）——
  //    在函数收尾统一执行（helper 定义见本函数之后）

  // 🔧 拆裸 <u> 空壳：模型把下划线写进无 class 的 <u>（<u>____</u>/<u>（　　）</u>），先被上面规则转成
  //    u.blank-N/span.blank-N 后外层 <u> 仍在 → 下划线叠下划线/叠括号。外层仅包一个 blank 空位时拆壳
  out = out.replace(/<u(?![^>]*class=)[^>]*>\s*(<(u|span) class="blank-\d+">&emsp;<\/\2>)\s*<\/u>/gi, '$1');
  // 🔧 拆裸 <u> 包整句（2026-09 语文卷实证：模型用 <u> 把题干整句/整行包起来 → 整卷画线；
  //    系统语义 <u> 仅填空横线（带 class），画线句用 underline-sentence、强调用 <b>。
  //    收窄拆壳条件：仅"整句/长句误画线"拆（裸 u 内 ≥10 字符且以句末标点结尾）；
  //    短语/短词下划线强调（<u>重点词汇</u>）与单个空格场景保留（既有契约，防误伤强调语义）。
  out = out.replace(/<u(?![^>]*class=)[^>]*>([\s\S]*?)<\/u>/gi, (m, inner) => {
    const plain = inner.replace(/<[^>]+>/g, '').trim();
    if (plain.length >= 10 && /[。！？；!?;]$/.test(plain)) return inner; // 整句误画线 → 拆壳
    return m;
  });
  // 🔴 畸形填空载体拆壳（不变量守卫）——**必须早于形态归一/跨类型去重**（2026-09-12 丢题事故根治）：
  //    下面两处会把命中的载体**整段替换成一枚短空位标签**；若载体内部裹着正文（畸形），正文即随之
  //    消失（实测：英语课时练题 1~18 完整，此处被吞掉 2、3、4 整题 → 整卷判失败）。
  //    先拆壳还原为纯文本；且后续载体正则已收窄为"内部只许空白"，便不会再命中含正文的载体。
  out = unwrapMalformedBlankCarriers(out);
  // 🔧 跨类型空位叠写去重（2026-09 实证：题 10"0.86×3.2 ＿（　）"——模型把同一答案位写成
  //    "填空横线 <u class='blank-N'> + 括号空 <span class='blank-N'>"两种载体相邻叠加，导出成"横线后括号"；
  //    仅收敛"跨类型紧邻"（u↔span 间隔仅空白/实体）：保留后出现的一种形态（同题并列空位由生成语义
  //    统一为多数形态，此处只是把叠写的一处去重）；连续同类型标签（"( )( )"双括号空等）是并列双空，
  //    不去重。空位标签内含 &emsp; 实体（span.innerHTML='&emsp;' 或字面），内文不限。
  const blankTagOne = (tag) => `<${tag}[^>]*class=["'][^"']*blank-\\d+[^"']*["'][^>]*>${BLANK_INNER}<\\/${tag}>`;
  out = out
    .replace(new RegExp(`(${blankTagOne('u')})((?:\\s|&emsp;|&#8195;|&#x2003;|&nbsp;)*)(${blankTagOne('span')})`, 'gi'), '$2$3')
    .replace(new RegExp(`(${blankTagOne('span')})((?:\\s|&emsp;|&#8195;|&#x2003;|&nbsp;)*)(${blankTagOne('u')})`, 'gi'), '$2$3');
  // ④ 🔧 还原密封信息栏占位（＿ 原样保留，交给排版/导出端 sealText.normalizeSealBlanks 统一扩 8 全角）
  if (sealKeeps.length) {
    out = out.replace(/\uE000(\d+)/g, (_m, i) => '＿'.repeat(sealKeeps[Number(i)] || 0));
  }
  // 🔴 同段书写空位形态统一（2026-09 复现收口：模型在同一句里混用 横线/方框/括号空，
  //    如 "0.7×0.3＝<u>＿</u>×<span square-box>＿</span>"）→ 按多数形态统一（并列取 u 下划线）。
  //    在叠写去重/拆壳之后执行；只动形态不涉内容（helper 定义紧接本函数下方）。
  out = unifySameParagraphWriteBlanks(out);
  // 🔴 畸形填空载体拆壳（不变量守卫）：blank-N 内出现正文文字/标题被包 → 还原纯文本（后置于一切包裹规则之后）
  out = unwrapMalformedBlankCarriers(out);

  // 🔤 英文省略号三点归一（中文说明文字里的六点省略号不受影响）
  out = normalizeEnglishEllipsis(out);
  return out;
}

/** 同段书写空位形态统一（2026-09 复现收口："0.7×0.3＝<u class=blank>×</u><span class=square-box>…</span>" 横线/方框混用）
 * ============================================================
 * 判定：同一 <p> 段内"纯书写型空位" ≥2 且形态种类 ≥2 → 全部改写为出现最多的形态
 * （并列取 u 下划线；square-box/oral-box 无档位按 2em 折算；span.blank-N 括号空并入同宽 u）。
 * 只统一书写空位形态，不碰：○（math-circle-blank-18，运算符选择语义不同）、
 * 整行结构（blank-line/blank-solo/田字格/竖式格等）；"结果位书写横线"（紧邻 ＝/≈ 之后、语义为
 * 得数留白，uCellRe/boxRe 共用 isResultPosition 判定）亦不参与合并——防破坏"口算行：方框单元 + 
 * 结果位留白"的角色区分（2026-09 实证修正）。幂等；生成归一/编辑器装载/粘贴同源消费。
 */
export function unifySameParagraphWriteBlanks(html = '') {
  const src = String(html || '');
  if (!src || !/<(u|span)\b/i.test(src)) return src;
  const unifyInPara = (para) => {
    const tokens = [];
    const push = (type, w, start, full, excluded) => tokens.push({ type, w, start, end: start + full.length, excluded: !!excluded });
    const prevVisibleChar = (pos) => para.slice(0, pos).replace(/<[^>]+>/g, '').replace(/[　\s]+$/, '').slice(-1);
    let m;
    const reU = new RegExp(`<u\\b(?=[^>]*\\bclass=["'][^"']*\\bblank-(\\d+)\\b[^"']*["'])[^>]*>${BLANK_INNER}<\\/u>`, 'gi');
    while ((m = reU.exec(para)) !== null) {
      const prev = prevVisibleChar(m.index);
      // 结果位书写横线（＝/≈ 之后）→ 排除（角色语义=得数留白，见函数头注释）
      push('u', Number(m[1]) || 1, m.index, m[0], prev === '＝' || prev === '≈' || prev === '=');
    }
    const reSpan = new RegExp(`<span\\b(?=[^>]*\\bclass=["'][^"']*\\bblank-(\\d+)\\b[^"']*["'])(?![^>]*\\bsquare-box\\b)(?![^>]*\\bmath-circle-blank\\b)(?![^>]*\\boral-box\\b)[^>]*>${BLANK_INNER}<\\/span>`, 'gi');
    while ((m = reSpan.exec(para)) !== null) {
      const prev = prevVisibleChar(m.index);
      push('span', Number(m[1]) || 1, m.index, m[0], prev === '＝' || prev === '≈' || prev === '=');
    }
    const reSq = new RegExp(`<span\\b(?=[^>]*\\bclass=["'][^"']*\\bsquare-box\\b[^"']*["'])[^>]*>${BLANK_INNER}<\\/span>`, 'gi');
    while ((m = reSq.exec(para)) !== null) push('sq', 2, m.index, m[0], false);
    const reOral = new RegExp(`<span\\b(?=[^>]*\\bclass=["'][^"']*\\boral-box\\b[^"']*["'])[^>]*>${BLANK_INNER}<\\/span>`, 'gi');
    while ((m = reOral.exec(para)) !== null) push('oral', 2, m.index, m[0], false);
    tokens.sort((a, b) => a.start - b.start);
    const active = tokens.filter((t) => !t.excluded);
    const kinds = new Set(active.map((t) => t.type));
    if (active.length < 2 || kinds.size < 2) return para;
    const count = {};
    for (const t of active) count[t.type] = (count[t.type] || 0) + 1;
    let target = 'u';
    let best = -1;
    for (const k of ['u', 'span', 'sq', 'oral']) {
      if ((count[k] || 0) > best) { best = count[k]; target = k; }
    }
    const render = (w) => {
      const cw = Math.min(24, Math.max(1, Math.round(w || 2)));
      if (target === 'u') return `<u class="blank-${cw}">&emsp;</u>`;
      if (target === 'span') return `<span class="blank-${cw}">&emsp;</span>`;
      if (target === 'sq') return '<span class="square-box">&nbsp;</span>';
      return '<span class="oral-box">&nbsp;</span>';
    };
    const rewrite = (t) => (t.excluded || t.type === target ? para.slice(t.start, t.end) : render(t.w));
    let out = '';
    let pos = 0;
    for (const t of tokens) {
      out += para.slice(pos, t.start) + rewrite(t);
      pos = t.end;
    }
    return out + para.slice(pos);
  };
  return src.replace(/(<p\b[^>]*>[\s\S]*?<\/p>)/gi, unifyInPara);
}

/** 数学算式填空位：把"算式里做比较/填空位的 ○/□"归一为 1.8em 填空容器（○→圆圈、□→方框）。
 *  ============================================================
 *  题干判定（避免误伤）：○/□ 仅在"两侧都被数学项（数字/字母/×÷＋－＝+−<>（）()/括号）紧邻，
 *  可有空格间隔"时才是算式填空位 → ○ 包成 <span class="math-circle-blank-18">&nbsp;</span>、
 *  □ 包成 <span class="square-box">&nbsp;</span>（圆圈与方框同性质同规格 1.8em，双向对称——
 *  曾仅 ○ 有归一，算式原文"3+□=8"的 □ 以裸字形渲染，无载体语义，见 C6）；
 *  普通句子"在○里填上…/在□里填数"的 ○/□（相邻为汉字）保持原样。
 *  定位：与 normalizeWhitespaceCarriers 一致（生成归一 + 编辑器装载/粘贴共用），保证"预览所见 = 导出"。
 */
export function normalizeMathCircleBlanks(html = '') {
  const src = String(html || '');
  // 数学项字符：数字/字母/运算与比较符/括号（右侧 lookahead 用，不含 <——曾含 < 致 ○/□ 后跟
  // 标签（</p> 等）或行尾时被误判为算式语境 → 图例数量圆被转成填空圆，2026-09 实证）
  const MATH_ITEM = '[0-9A-Za-z×÷＋－＝＋−+>（）()]';
  // ○/□ 判定（2026-09 收敛，C6 补盲 + 图例圆排除）：
  //   - 关键信号在右侧：○/□ 后须紧随数学项（可空格间隔）——题干"在○里填…/在□里填数"的 ○/□ 后跟汉字（里/中/上…），天然不命中；
  //   - 左侧排除汉字与连排圆/框（○□ 紧邻 = 数量图例串，如 ○○○／○○○＋○○○：组内与组末圆均不转填空；
  //     算式填空 3＋○＝8 / □×□＝12 的单个 ○/□ 左右为运算符/数字，不受影响）；
  //   - 右侧 lookahead 不含 <（标签/行尾不再误判）；比较符 > 保留（高年级比较题）
  const literalRe = new RegExp(`(?<![一-龥○□])[○□](?=\\s*${MATH_ITEM})`, 'g');
  // 🔧 算式填空兜底（2026-09，用户口径：数字整体放一个框）：
  //    模型若未写 □/○ 而用空白/下划线占位（曾点名"空格"后算式填空全变空格串），这些占位已被
  //    blank 归一为 <u class="blank-N">&emsp;</u>——本函数在所有调用链（生成/编辑器装载/粘贴/排版导出）
  //    均最后执行，此处把"算式语境内的占位 u"统一收口为单个 <span class="square-box">（1 个数一格）；
  //    判定：占位两侧任一侧紧邻数学运算符/等号（×÷＋－＝+−<>）即算式单元格；
  //    文本空位（如"我发现：＿＿＿。"两侧为汉字/句号）不受影响，保持空白横线语义。
  const uCellRe = /<u(?=[^>]*class=["'][^"']*blank-\d+[^"']*["'])[^>]*>(?:&emsp;|&#8195;|&#x2003;|[\s\u3000])*<\/u>/gi;
  const OP_SIDE = '×÷＋－＝+−<>';
  // 既有方框/圆圈容器（处理已入库内容 + 各通路二次归一幂等解壳）
  const boxRe = /<span class="(?:square-box|math-circle-blank-18)">(?:&nbsp;|&#160;|&#xA0;|&emsp;|&#8195;|&ensp;|&#8194;|&#x2003;|[\s\u3000\u2003\u2002\u00A0])*<\/span>/gi;
  const bareSpaceRe = /(?:[\u3000\u2003]|&emsp;){2,}/g;

  // 🔴 结果位判定（2026-09 载体根治·系统性：等号/约等号后的"得数结果位"一律留白、非方框）。
  //   判据（真实卷面惯例，见 layoutSpec.buildAnswerSpaceInstruction 注释）：
  //     - 空位前字符为 ＝/≈（得数位）；后接算式继续符（数字/运算符）则属"中位缺数填空"（如 3＋＿＝8）→ 非结果位；
  //     - 得数结果位（2.4×1.6＝＿、0.35×0.8＝＿（人）、应用题算式＝＿）等号后直接留白书写，不渲染方框；
  //     - 例外：算式左侧已现空位单元（□/○/blank-N/空白段）→ 属"填数算式/用算式表示"整式填空
  //       （如 □×□＝□（人）、3＋□＝8）——右侧空位也是"算式填空"一环，保留方框/圆圈语义。
  //   三通道（字面/literal、占位u、裸空格）与既有容器解壳共用同一判定，杜绝"中高段/计算题/应用题
  //   结果位配低段方框"的学段错配；程序只做确定性判定，不语义理解。
  const isResultPosition = (all, from, to) => {
    const before = all.slice(0, from);
    const prev = before.replace(/<[^>]+>/g, '').replace(/[　\s]+$/, '').slice(-1);
    if (!'＝≈='.includes(prev)) return false;
    // 紧邻后继（＝/≈ 之后空位的邻接语义，2026-09 CI 实证收口）：
    //   · 后续可见字符是运算符/等号（可隔排版空格）→ 算式继续（中位缺数填空链/整式填空，
    //     如 "0.6×0.3＝＿ × ＿ ＝＿"、"3＋□＝＿"）→ 非结果位（方框/圆圈）；
    //   · 后续是数字/算式首字符或行尾 → 本空位即当前等式"得数结果位"的收尾，交下方左值判定：
    //     左式含 □/○（整式填空，如 "□×□＝□（人）"）→ 保框；左式纯实数 → 留白。
    //   🔧 数字不作邻接中位依据：直接写得数同行 "1÷11＝＿　2÷11＝＿" 的分隔空格被空白合并
    //     （mergeBlankSpaces）并入书写位后，"＿"后紧贴的是下一算式行首数字——若把数字当"中位
    //     缺数"信号会把得数位回卷成方框（CI 实证：前两项全变方框、仅行尾留白）。
    const after = all.slice(to);
    const blkTag = after.match(/<(?:\/?(?:p|div|li)\b)[^>]*>/i);
    const sameBlockAfter = blkTag ? after.slice(0, blkTag.index) : after;
    const rawSeg = sameBlockAfter.replace(/<[^>]+>/g, '');
    const nxtCh = rawSeg.replace(/^[　\s\u00A0\u2000-\u200A]*/, '').slice(0, 1);
    if (nxtCh && '×÷＋－＝+−<>'.includes(nxtCh)) return false;
    // 其余（数字/文本/行尾）→ 落入下方左值判定
    // 左值"算式左端"判定（结果位守卫的关键判据，全链路定界同源）：
    //   把当前块内结果位之前的所有"填空单元"原子化为占位 □——
    //     占位容器（blank-u / square-box / math-circle-blank-18）直接改占位 □；
    //     ≥2单位空白串（＿＿ 填空单元）整段改为单个 □（单空格仍是等式分隔，不改）。
    //   自尾＝向左收拢"当前等式左式"（遇 单空格 / 非数学文本 即停）：
    //     左式含 □/○ → 整式填空（3＋□＝8、□×□＝□（人））→ 保留方框/圆圈（非结果位）；
    //     左式仅实数（2.4×1.6、56÷4）→ 得数结果位 → 留白。二者互不跨题、互不串位。
    const blockStart = Math.max(before.lastIndexOf('<p'), before.lastIndexOf('<div'), before.lastIndexOf('<li'));
    const seg = blockStart === -1
      ? before.slice(Math.max(0, from - 200))
      : (before.slice(before.indexOf('>', blockStart) + 1, from));
    // 🔧 注：关闭标签无法用反向引用 `\1`（与前置 lookahead 组合在 V8 会失效，2026-09 实证），
    //   改用直接字符类 <(?:u|span)> 收口；开头 <(?:u|span) 与 class 判定已锁定标记种类，不会跨标签误吞。
    const segMarked = seg.replace(/<(?:u|span)(?=[^>]*class=["'][^"']*(?:blank-\d+|square-box|math-circle-blank-18)[^"']*["'])[^>]*>[\s\S]*?<\/(?:u|span)>/gi, '□');
    const body0 = segMarked.replace(/<[^>]+>/g, '').replace(/[＝≈=][　\s\u00A0]*$/, '');
    const body = body0.replace(/(?:[　\u3000\u2003\u2002\u00A0]|&emsp;|&ensp;|&#8195;|&#8194;){2,}/g, '□');
    let j = body.length;
    while (j > 0 && /[0-9A-Za-z○□×÷＋－＋−<>（）()．\.、]/.test(body[j - 1])) j--;
    const leftRun = body.slice(j);
    const leftIsFill = /[□○]/.test(leftRun);
    return !leftIsFill;
  };

  // 🔧 改写/含义类"写算式答案"段判定（2026-09 复现收口）：段落文本含"改写…分数 / 表示求…是多少 /
  //    算式的含义"等组织语时，其算式空位多为"写出答案"，区别于口算/直接写得数的算式填空单元。
  const rewriteRe = /改写|表示求|的含义/;
  const isRewriteWritePara = (all, from, to) => {
    const pStart = all.lastIndexOf('<p', from);
    if (pStart === -1) return false;
    const pEnd = all.indexOf('</p>', to);
    const seg = all.slice(all.indexOf('>', pStart) + 1, pEnd === -1 ? all.length : pEnd);
    return rewriteRe.test(seg.replace(/<[^>]+>/g, ''));
  };

  let out = src;
  // ⚙ 空白合并：结果位留白 &emsp; 之后跟的原始空格（等式分隔符）并入书写位。
  //   须在 bareSpaceRe 之前执行，否则"&emsp;＋　"拼成 ≥2 单位空格串会被误当算式填空单元回卷成方框
  //   （2026-09 实证：直接写得数多算式同行时第2项起全被回卷）。
  const mergeBlankSpaces = (s) => s.replace(/&emsp;[ \t\u3000\u2000-\u200A\u00A0\u00AD]+/g, '&emsp;');
  // ① 字面 ○/□ → 圆圈/方框（算式语境；结果位→留白）
  if (literalRe.test(out)) {
    out = out.replace(literalRe, (m, off, all) =>
      isResultPosition(all, off, off + m.length)
        ? '&emsp;'
        : (m === '○' ? '<span class="math-circle-blank-18">&nbsp;</span>' : '<span class="square-box">&nbsp;</span>'));
  }
  // ② blank-N 占位 <u> 邻接运算符 → 方框；结果位保留空白书写区（不框、不画线）
  if (uCellRe.test(out)) {
    out = out.replace(uCellRe, (m, off, all) => {
      if (isResultPosition(all, off, off + m.length)) {
        // 🔧 结果位书写留白（2026-09 用户定稿复核）：直接写得数/计算得数"＝ 后"不画横线、不留框，
        //    只留空白书写区（宽度按答案位数 N 保留 → &emsp;×N），与印刷排版惯例一致；
        //    改写/含义类"写算式答案"段（组织语 改写/表示求/的含义，0.7×0.3＝(分数)×(分数) 表示求…）
        //    是"写出来的一段答案"，保持书写横线（与段语义对齐，防同句横线/方框混用见下）
        if (isRewriteWritePara(all, off, off + m.length)) return m;
        const w = Number((m.match(/blank-(\d+)/) || [])[1]) || 1;
        return '&emsp;'.repeat(Math.min(12, Math.max(1, w)));
      }
      // 🔧 改写/含义类"写算式答案"段（2026-09 复现收口：0.7×0.3＝(分数)×(分数)，表示求 0.7 的(几)是多少——
      //    同句内 × 邻接空位也是"写出来的结果"（改写成分数），不是口算框；若回卷成方框会与等号后
      //    结果位横线（u.blank）同句混用 → 该语境保持书写横线（与"空位载体同句一致"纪律对齐）
      if (isRewriteWritePara(all, off, off + m.length)) return m;
      const prev = all.slice(0, off).replace(/<[^>]+>/g, '').replace(/[　\s]+$/, '').slice(-1);
      const next = all.slice(off + m.length).replace(/<[^>]+>/g, '').replace(/^[　\s]+/, '').slice(0, 1);
      // 🔧 空邻接守卫（2026-09 回归）：''.includes(任何)===true，prev/next 为空串时原判断恒真 →
      //    段尾/行尾书写行（"加法算式：＿＿＿</p>""口诀：＿＿＿</p>"默写行）被误收成单个方框，横线消失；
      //    空串不视为算式邻接（算式单元格两侧必有真实运算符/等号字符）
      if ((prev && OP_SIDE.includes(prev)) || (next && OP_SIDE.includes(next))) return '<span class="square-box">&nbsp;</span>';
      return m;
    });
  }
  out = mergeBlankSpaces(out);
  // ③ 字面空格段算式占位（兜底路径）→ 方框；结果位保留原文（留白）
  if (bareSpaceRe.test(out)) {
    out = out.replace(bareSpaceRe, (m, off, all) => {
      if (isResultPosition(all, off, off + m.length)) return m;
      const prev = all.slice(0, off).replace(/<[^>]+>/g, '').replace(/[　\s]+$/, '').slice(-1);
      const next = all.slice(off + m.length).replace(/<[^>]+>/g, '').replace(/^[　\s]+/, '').slice(0, 1);
      if ((prev && OP_SIDE.includes(prev)) || (next && OP_SIDE.includes(next))) return '<span class="square-box">&nbsp;</span>';
      return m;
    });
  }
  // ④ 既有方框/圆圈结果位解壳（处理已入库内容 & 全链路幂等；真填空位不动）
  if (boxRe.test(out)) {
    out = out.replace(boxRe, (m, off, all) => (isResultPosition(all, off, off + m.length) ? '&emsp;' : m));
  }
  out = mergeBlankSpaces(out);
  // ⑤ 等号后"行尾结果位"的字面 ○/□（后无算式继续项 → literalRe 的 lookahead 漏网，裸字形
  //   渲染成方框/圆圈，2026-09 用户实证"＝□ 在源码里"）→ 留白；填数算式（□×□＝□）不误伤。
  //   负向前瞻剔除 <（防 <\/p> 等标签起始误判为比较运算符）
  const trailingBoxRe = /([＝≈])[　\u3000\u2003\u2002\u00A0]*(○|□)(?![0-9A-Za-z×÷＋－＝+−])/g;
  if (trailingBoxRe.test(out)) {
    out = out.replace(trailingBoxRe, (m, eq, ch, off, all) => {
      const boxOffset = off + all.slice(off).indexOf(ch);
      return isResultPosition(all, boxOffset, boxOffset + 1) ? `${eq}&emsp;` : m;
    });
  }
  // ⑥ 收尾再合并一次（兜底；路径④解壳产生的 &emsp; 后分隔符已在④后合并，此为幂等保险）
  out = mergeBlankSpaces(out);
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
  // 🔧 入口先解码载体内数字实体（&#160;/&#x3000;/&#95; 等，与 normalizeBlankMarkers 同源，C3-C5）
  const src = decodeCarrierNumericEntities(String(html || ''));
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
 * 🔧 出题惯例（2026-09 用户口径）：连线题右列须与左列答案序错开（学生画斜线交叉连接），
 *    模型常按答案序输出右列 → 渲染为"左[i]|右[i] 同行"，学生横向直连即答案、题目无考察意义。
 *    归一转换时对右列做**确定性打乱**（LCG 由右列内容散列播种：同输入恒同输出 → 可测、幂等、
 *    跨端一致；已持久化的 match-question 二次装载因幂等不再重排）。只动渲染端，不改模型/prompt。
 * 规则（保守、幂等、不破坏已有内容）：
 *   1. 幂等：题区已含 match-question 结构 → 不重复处理
 *   2. 触发：题干附近（同一题内、无题号间隔）含"连一连|连线|配对|搭配"关键词
 *   3. 只转明确两列形态：两列表格（每行 td×2）或两个相邻 <ul>/<ol> 列表（各 ≥2 项）
 *   4. 其余形态（单列/普通段落/编号对应）不转，保持原样
 *   5. 转换保留全部文本，不丢内容；左列保序（题干/模型顺序），仅右列打乱
 */
// 确定性打乱：FNV-1a 散列播种 + LCG Fisher-Yates（同输入恒同输出；≥3 项才打乱——2 项无交叉可言）
const shuffleRightItems = (items) => {
  if (items.length < 3) return items.slice();
  let h = 2166136261;
  for (const it of items) {
    for (let i = 0; i < it.length; i++) { h ^= it.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= 0x7c; // 项分隔
  }
  const arr = items.slice();
  let s = h >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
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
    const leftSeq = pairs.map(p => p[0]);
    const rightSeq = shuffleRightItems(pairs.map(p => p[1])); // 右列乱序，防左|右同行即答案
    const col = (seq) => `<div class="match-col">${seq.map(t => `<div class="match-item">${t}</div>`).join('')}</div>`;
    return `<div class="match-question">${col(leftSeq)}${col(rightSeq)}</div>`;
  };

  // 两个相邻 <ul>/<ol> 列表 → match-question（各 ≥2 项）
  const listsToMatch = (block) => {
    const m = block.match(/(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)\s*(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)/i);
    if (!m) return null;
    const items = (ul) => [...ul.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map(x => x[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const left = items(m[1]);
    const right = shuffleRightItems(items(m[2])); // 右列乱序（同上）
    if (left.length < 2 || right.length < 2) return null;
    const col = (list) => `<div class="match-col">${list.map(it => `<div class="match-item">${it}</div>`).join('')}</div>`;
    return `<div class="match-question">${col(left)}${col(right)}</div>`;
  };

  // 题号间隔守卫：关键词与目标块之间不得跨越题号行（\n [标签] 数字 1. 等），防跨题误转
  const hasQuestionBoundary = (gap) => /\n[\s]*(?:<[^>]+>\s*)?\d{1,3}\s*[.、．]/.test(gap);

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
 *   6. 🔧 递归处理嵌套块：答案区整块被 <div class="answer-section"> 包裹（或列表 ul>li 嵌套）时，
 *      单轮 replace 会把外层容器整体消费、内层 <p> 不再有独立匹配机会 → 正文平铺可剥、答案区漏剥；
 *      先递归处理内层块（带剥离结果回传），再处理当前块行首，嵌套任意深均覆盖
 */
// 行首可作分隔的"空白"：真实空白字符 或 HTML 实体空位（&nbsp;&#160;&emsp;&ensp; 等）
const LEAD_WS = '(?:[ \\t\\u3000\\u00A0\\u2003\\u2002]|&(?:nbsp|#160|#xA0|emsp|#8195|ensp|#8194);)';
// 项目符号常见集合（含 ◆◇ 等列表项常用符号）
const LEAD_BULLET = '[•●○◦▪■►➤‣⁃·◆◇]';
// 序号前可能出现的单个起始修饰标签（模型常用 <strong>/<b> 加粗要点序号；限长防失控，避免吞入正文）
const INITIAL_TAG = '(?:<[a-zA-Z][^>]{0,80}>)';
// 结束标签（用于包裹在项目符号"前后"的单个修饰标签，如 <strong>•</strong>；与 INITIAL_TAG 对称）
const CLOSING_TAG = '(?:<\\/[a-zA-Z][^>]{0,80}>)';
// 编号形式：字母/数字+分隔符、(数字)、中文数字序号、(中文数字)、带圈数字
const LEAD_SEQ = '(?:[A-Za-z][.、．:：]|\\d+[.、．:：]|[（(]\\s*\\d+\\s*[)）]|[一二三四五六七八九十]{1,3}[.、．]|[（(][一二三四五六七八九十]{1,3}[)）]|[\\u2460-\\u2473\\u2776-\\u277F\\u3251-\\u325F])';
// 项目符号本身可能被单个内联标签包裹（<strong>•</strong> A.）——序号被标签包裹(INITIAL_TAG)已有能力，符号端对称补齐
const LEAD_MARKER_RE = new RegExp(
  `^(${LEAD_WS}*)(?:${INITIAL_TAG})?(${LEAD_BULLET})(?:${CLOSING_TAG})?(${LEAD_WS}*)(?=${INITIAL_TAG}?${LEAD_SEQ})`
);
export function normalizeLeadingMarkers(html = '') {
  let out = String(html || '');
  out = out.replace(/<(p|li|div)([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
    // 🔧 先递归处理内层嵌套块（答案区/列表内层 p 的行首符号在此剥离，结果随 inner 回传）
    const deep = normalizeLeadingMarkers(inner);
    const n = deep.replace(LEAD_MARKER_RE, '$1');
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


/**
 * 剥离"空位内嵌题后"的冗余整行空白作答段（2026-09 空行泛滥系统性根治）
 * ============================================================
 * 根因实证：无用空行不是 answer-area-fix 补的（该逻辑对空位内嵌题本就跳过），而是模型
 *   raw 输出自带——它会为"直接写出得数/比较在○里填/转化算式"这类行内自带作答位的题，
 *   又在题行后另起整行 <p class="blank-area">。(纸文件被"题目自洽④"与渲染契约 system 级
 *   通用契约约束不足；程序性确定性兜底补上：剥离"后随行内作答载体行"的纯空整行 blank-area。)
 *
 * 判据（确定性、保守、不误删真长答区）：
 *   · 删除对象：<p class="blank-area"> 且内容为纯空白（仅 全角空格/&emsp;/空）——即"整行空白作答段"；
 *   · 触发条件：该 blank-area 的"下一非空兄弟"行内已含行内作答载体
 *     （square-box 方框 / math-circle-blank 比较圈 / blank-N 填空线 / <u class="blank-"> 结果位留白）
 *     ——说明其后已有行内作答位，本整行空白是冗余的；
 *   · 保全条件：若该 blank-area 的"上一非空兄弟"行含"整行撰写型长答"触发词
 *     （竖式/递等式/脱式/解决问题/写过程/说明），则整行空白是真作答空间，不删。
 * 遵从"补差不越权"：只删、不新造内容；与 1c-3/answer-area-fix 同属程序侧确定性整理。
 * @param {string} html
 * @returns {string}
 */
export function stripRedundantInlineCarrierRows(html = '') {
  if (!html || typeof html !== 'string') return html;
  const inlineCarrierRe = /square-box|math-circle-blank|blank-\d+|class=["'][^"']*blank-\d+|<\s*u[^>]*class=["'][^"']*blank-/i;
  // 整行撰写型长答触发词（此语境的整行空白 = 真书写空间，须保全）
  const longWriteRe = /竖式|递等式|脱式|解决问题|写过程|列竖式|竖式计算/;
  const stripInner = (inner) => String(inner || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&emsp;|&nbsp;|&ensp;|&#x3000;|&#160;|&#x00A0;|\u3000|\u00A0|　/g, '')
    .trim();
  // ① 收集所有 <p …>…</p> 块（含各类 class），保序记录”是否 blank-area / 是否纯空白 / 语义文本”
  const blocks = [];
  const pRe = /<p\b[^>]*>[\s\S]*?<\/p\s*>/gi;
  let mm;
  while ((mm = pRe.exec(html)) !== null) {
    const full = mm[0];
    const tag = /^<p\b([^>]*)>/.exec(full)[1] || '';
    const isBlankArea = /class=["'][^"']*(?:^|\s)blank-area(?:\s|$)[^"']*["']/i.test(tag) || /\bblank-area\b/i.test(tag);
    const inner = full.replace(/^<p\b[^>]*>/, '').replace(/<\/p\s*>$/, '');
    const text = stripInner(inner);
    const isPureBlank = text === '' || /^[　\s\u3000]*$/.test(text.replace(/&emsp;|　/g, ''));
    blocks.push({ full, text, isBlankArea, isPureBlank, start: mm.index, end: mm.index + full.length });
  }
  if (!blocks.length) return html;
  const remove = new Set();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b.isBlankArea || !b.isPureBlank) continue;   // 只处理"整行纯空白作答段"
    // 上一非空兄弟块（跳过块内连续空白段）
    let prev = null;
    for (let j = i - 1; j >= 0; j--) { if (!blocks[j].isPureBlank) { prev = blocks[j]; break; } }
    if (prev && longWriteRe.test(prev.text)) continue; // 前一行是整行撰写型长答 → 保全
    // 下一非空兄弟块
    let next = null;
    for (let j = i + 1; j < blocks.length; j++) { if (!blocks[j].isPureBlank) { next = blocks[j]; break; } }
    if (next && inlineCarrierRe.test(next.full)) remove.add(i); // 后随行内作答载体 → 冗余整行
  }
  if (!remove.size) return html;
  let out = html;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (!remove.has(i)) continue;
    out = out.slice(0, blocks[i].start) + out.slice(blocks[i].end);
  }
  return out;
}
/**
 * 🔢 正文归一化链（顺序 = 生产链单源；2026-09-12 抽出）
 * ============================================================
 * 抽出的唯一目的：**逐步取证**。此前链是一行嵌套调用，出问题时无法知道"是哪一步动的"——
 * 2026-09-12 实测（英语课时练）：模型原始输出题号 1~14 完整无缺，归一化后 3、4、5 整题消失
 * （连题号数字本身都不在正文任何位置），直接导致整卷判失败。故把顺序固定成表，按步比对
 * 题号数即可点名是哪一步削掉的。
 * ⚠️ 顺序即行为，不得调整（与历史生产链逐字一致）：
 *    cleanSectionHtml → normalizeBlankMarkers → normalizeMathCircleBlanks →
 *    stripRedundantInlineCarrierRows → normalizeMatchQuestions →
 *    normalizeLeadingMarkers → normalizeIndents
 * @param {string} raw 模型直出（或续写片段）
 * @param {{trace?:boolean,label?:string}} [opts] trace=true 时只在"题号数掉落"的步骤打日志
 * @returns {string} 归一化后的正文
 */
const BODY_NORMALIZE_STEPS = [
  ['cleanSectionHtml', cleanSectionHtml],
  ['normalizeBlankMarkers', normalizeBlankMarkers],
  ['normalizeMathCircleBlanks', normalizeMathCircleBlanks],
  ['stripRedundantInlineCarrierRows', stripRedundantInlineCarrierRows],
  ['normalizeMatchQuestions', normalizeMatchQuestions],
  ['normalizeLeadingMarkers', normalizeLeadingMarkers],
  ['normalizeIndents', normalizeIndents],
];

/** 首个差异下标（取证日志用：截出"被这一步动过的那一段"） */
function firstDiffIndex(a = '', b = '') {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
}

export function normalizeBodyHtml(raw = '', { trace = false, label = '' } = {}) {
  let out = String(raw || '');
  const notes = [];
  let prevN = trace ? extractBodyQuestionNumbers(out).length : 0;
  const startN = prevN;
  for (const [name, fn] of BODY_NORMALIZE_STEPS) {
    const before = out;
    out = fn(out);
    if (!trace) continue;
    const n = extractBodyQuestionNumbers(out).length;
    if (n < prevN) {
      const i = firstDiffIndex(before, out);
      const gone = before.slice(i, i + 60).replace(/\s+/g, ' ').trim();
      notes.push(`${name} −${prevN - n} 个题号（掉出「${gone}${gone.length >= 60 ? '…' : ''}」）`);
    }
    prevN = n;
  }
  if (trace && notes.length) {
    console.warn(`🔢 [归一化分步取证${label ? `·${label}` : ''}] 起始题号 ${startN} 个 → 结束 ${prevN} 个 ｜ 削题步骤：${notes.join(' → ')}`);
  }
  return out;
}


export default { cleanSectionHtml, normalizeTypographicSymbols, stripAiCodeFence, hasAnswerCarrier, htmlToPlainText, analyzeQuestionHierarchy, countTopLevelQuestions, normalizeBlankMarkers, normalizeWhitespaceCarriers, normalizeMatchQuestions, normalizeLeadingMarkers, normalizeMathCircleBlanks, stripRedundantInlineCarrierRows, normalizeIndents, ensureCarrierContent, clampBlankWidth, blankWidthForChars, shortBlankWidth, spaceBlankWidth, wrapBareBlankRuns };
