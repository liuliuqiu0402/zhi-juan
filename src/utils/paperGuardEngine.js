/**
 * 🛡️ 卷级守门引擎（Paper Guard Engine）——生成后确定性"命中清单"的统一收敛层
 * ============================================================
 * 定位（2026-09 系统性根治，见 docs/源头防线总览.md）：
 *    - 收敛全部"确定性"卷级检测（照搬命中/数据裂缝/算式重复/情境主题重复/首段过程自述/载体形态），
 *    - 统一输出结构化命中清单与禁用沿用名单（bannedList），命中清单交编辑人工核对；
 *    - 只报不改（形态级 fix 仍在 examValidator，不在此层）；发现靠确定性规则，程序不改写内容。
 *      注：早年"写作修订轮（模型整卷重写自纠）"已全局砍除（实测空转），本引擎不再驱动任何模型修订。
 *    - 规避"自产自评"教训：本引擎不调用 AI，全部规则为字面/词表/结构确定性判定。
 * ============================================================
 */
import { scanCopyOverlap } from './antiCopyGuard.js';
import { sanityScan } from './contentSanity.js';

/** HTML → 纯文本（保留换行近似段落边界：</p>/</li>/<br> 视为断行） */
export const htmlToLines = (html = '') =>
  String(html || '')
    .replace(/<\/p>|<\/li>|<\/h[1-6]>|<\/div>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&emsp;|&#8195;/gi, '　')
    .replace(/&ensp;|&#8194;/gi, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.replace(/[\u3000 ]+/g, ' ').trim())
    .filter(Boolean);

/**
 * 题块切分：把正文切成 "题号 → 文本" 块，供算式/情境查重归属题号。
 * 切到"参考答案"前为止（答案区不参与卷内查重；答案区本身有独立生成+报告）。
 * 识别行首数字题号（1. 2. 3.、1、…）；未带题号的段落归入当前块。
 * 🔧 小数点歧义（2026-09 CI/实证据实）：直接写得数常把算式单独成行且行首即数字——
 *    "0.6÷0.3＝2"、"="、"1.2÷0.24＝5"。旧规则 /^(\d+)[.、．]/ 把 "0.6…" 认成"题号0"、
 *    "1.2…" 认成"题号1" → 产生幽灵题块并伪造"卷内算式重复（题 4、0）"。修法：
 *    · 、与全角 ． 仍为题号分隔符；
 *    · 半角 . 仅当其后不是数字（非小数）才算题号（"1. 计算…"√、"1.2÷…"✗——归入上一题块）。
 */
export function splitQuestionBlocks(html = '') {
  const lines = htmlToLines(html);
  const blocks = [];
  let cur = null;
  const numRe = /^(\d{1,3})\s*[、．]|^(\d{1,3})\s*\.(?!\d)/;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^参考答案|^参考[^0-9]{0,6}$/.test(line)) break;
    const m = numRe.exec(line);
    if (m) {
      cur = { id: Number(m[1] ?? m[2]), text: line, lines: [line] };
      blocks.push(cur);
    } else if (cur) {
      cur.text += ' ' + line;
      cur.lines.push(line);
    } else {
      // 答案/前言等无题号前置行：忽略（不影响卷内题目查重）
    }
  }
  return blocks;
}

/** 算式抽取（确定性）：数字（含小数）× 数字 / 数字 ÷ 数字 / 数字 ＝ 结果 三类，做归一字符串 */
const FORMULA_RE = /(\d+(?:\.\d+)?)\s*([×xX*÷/])\s*(\d+(?:\.\d+)?)/g;
export function extractFormulas(blockText = '') {
  const out = [];
  const src = String(blockText || '');
  let m;
  while ((m = FORMULA_RE.exec(src)) !== null) {
    const op = m[2] === '×' || m[2] === 'x' || m[2] === 'X' || m[2] === '*' ? '×' : '÷';
    // 归一：去尾零小数 2.40→2.4；保留数值原样，避免 "6.25×1.5" 与 "6.25 × 1.5" 算两份
    const norm = (n) => {
      const s = String(n);
      return /\.\d*0$/.test(s) ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
    };
    out.push(`${norm(m[1])}${op}${norm(m[3])}`);
  }
  return out;
}

/**
 * 卷内算式重复检测：同算式（×/÷ 归一）出现在 ≥2 个题块 → 命中。
 * （2026-09 实证：2.4×1.6 两现于题3/题14、0.6÷0.3 两现于题9/题13）
 * 承上说理豁免（2026-09）：同一算式仅"紧邻前一题 + 后题属 说一说/讲一讲/算理说明"时，
 * 是教学编排（先算后说理），不算卷内重复；远距复用、并列新题仍报。
 */
export function detectFormulaDuplicates(html = '') {
  const blocks = splitQuestionBlocks(html);
  const owner = new Map(); // 算式 → 题号数组
  for (const b of blocks) {
    const seenInBlock = new Set();
    for (const f of extractFormulas(b.text)) {
      if (seenInBlock.has(f)) continue; // 同一题内自现（例：比较 3.6×1.2 与 3.6×1）不判卷内重复
      seenInBlock.add(f);
      if (!owner.has(f)) owner.set(f, []);
      owner.get(f).push(b.id);
    }
  }
  const explainRe = /说一说|讲一讲|想一想|为什么|算理|说明|解释|这样算/;
  const isExplainBlock = (id) => {
    const b = blocks.find((x) => x.id === id);
    return !!b && explainRe.test(b.text);
  };
  const out = [];
  for (const [f, ids] of owner) {
    // 逐块判定"承上说理"：该块紧邻前一题(id-1)且块文本为说理句 → 从重复名单剔除
    const claimIds = ids.filter((id) => !(isExplainBlock(id) && ids.includes(id - 1)));
    if (claimIds.length >= 2) {
      out.push(`算式「${f}」在本卷出现 ${ids.length} 次（题 ${claimIds.join('、')}${ids.length > claimIds.length ? '；其余为紧邻承上说理' : ''}）——同一算式两题复用属卷内重复，请更换其中一题的算式与情境`);
    }
  }
  return out;
}

// 🗑 2026-10-16（属主裁定·**消噪音·整档删除**）：原 `TOPIC_CLUSTERS` 词簇 ＋ `detectTopicRepeat()`
//   （同一"生活主题"在 ≥3 个题块出现即提示"情境主题集中，请为重复题更换独立情境"）**整档删除**。
//   属主原话："整张卷子卷首语中就是情境了，围绕这个情境展开的，出现这些属于正常的吧？"——**整卷若共用同一个
//   情境词，它在多题出现正是设计使然**（题目就在该情境下展开），故该检测**必然误报**；且它只扫词表、
//   **读不到"本卷用不用统一情境"这个开关**，无从收窄。同款先例＝2026-10-10 属主裁定删"算式重复"档
//   （同一单元就那几道、同型算式重复属应然）。⇒ 不再产出该档命中（`topicHits` 保留为空数组，标签留档位）。

/** 正文首段过程自述检测（2026-09 实证：产物首行"已取到本卷所需全部教材原文素材…现依据教材原文与课标术语完成命题"）。
 *  契约：正文直入——不得以"已获取教材原文/现在编写/接下来/依据…命题"等过程性自述开头（指令库·质量底线）。 */
const OPENING_NARRATION_RE =
  /^(已(?:取到|获取|检索|完成|找到).{0,24}(?:教材|原文|素材|内容).{0,16})|(?:现依据|现在|接下来|以下(?:将)?|下面|本卷|本资料).{0,24}(?:教材原文|素材|课标|要点|知识).{0,20}(?:命题|编写|生成|完成|作答|呈现)/;
export function detectOpeningMetaNarration(html = '') {
  const lines = htmlToLines(html);
  if (!lines.length) return [];
  const head = lines.slice(0, 3).join(' ');
  if (OPENING_NARRATION_RE.test(head)) {
    return [`正文首段出现过程性自述「${head.slice(0, 48)}…」——按"正文直入"契约，正文应直接呈现题目内容，不得以"已获取教材原文/现依据…命题"等过程自述开头，请删除该自述句`];
  }
  return [];
}

/** 正文首段过程性自述句程序性删除（2026-09 用户定版·化整为零：整卷重写修订轮已砍，自述属可判定的确定性文本，由程序剔除而非模型）。
 *  契约与检测同源：正文直入（指令库·质量底线）。只删正文开头紧邻的自述段，避免误删正文内容；未命中则原样返回。 */
export function stripOpeningNarration(html = '') {
  let src = String(html || '');
  const blockRe = /<p(?:\s[^>]*)?>[\s\S]*?<\/p>/i;
  for (let i = 0; i < 3; i += 1) {
    const from = src.search(/<p(?:\s[^>]*)?>/i);
    if (from < 0 || from > 400) break; // 自述只出现在正文开头
    const m = src.slice(from).match(blockRe);
    if (!m) break;
    const text = m[0].replace(/<[^>]+>/g, '').replace(/&nbsp;|&emsp;|&ensp;|&#160;|&#8195;/gi, ' ').trim();
    if (!OPENING_NARRATION_RE.test(text)) break;
    src = src.slice(0, from) + src.slice(from + m[0].length).replace(/^\s*(?:\n|\r\n)*/, '');
  }
  return src;
}

/**
 * 卷级守门：统一跑全部确定性检测，返回结构化命中与禁用沿用名单。
 * @param {object} p
 * @param {string} p.html 生成正文（HTML）
 * @param {string[]} [p.corpus] 教材参考段数组（示范段原文；无则不跑照搬检测）
 * @param {number} [p.longN] 照搬连续字阈值（默认 8）
 * @returns {{
 *   hits: Array<{cat:string, level:'warn', text:string, snippet?:string}>,
 *   copyHits: Array, sanityHits: Array, formulaHits: Array, topicHits: Array, openingHits: Array,
 *   bannedList: string[],
 * }}
 */
export function guardPaper({ html = '', corpus = [], longN = 8, copy = true, subject = '' } = {}) {
  // 照搬守门按资料类型语义分组（2026-09 三维度审计 D1）：
  //   copy=false（知识归纳型 mode=full：summary/preview/dictation/review）——正文职责=按原文归纳呈现，
  //   字面重述是本职，任何字面阈值检测都不适用 → 不比对、不报告、不进 bannedList；
  //   命题/抽样型（practice/special/reading/errorbook/exam）copy=true 全开（8 字）+修订。
  // 🔴 2026-10-09（属主实测·误报根治）：**语文**不跑"与教材参考段字面重合（照搬）"档——
  //   语文卷以课文为素材：**课内阅读的材料本就是课文原文**（低段尤甚），填空/仿写/按课文内容类题也**必须**
  //   引用课文原句 ⇒ 与教材原文重合是**应然**（实测一份低段语文卷即 8~11 处命中，全是课文原句）。
  //   判据原意是"不得照搬教材**原题**"（题目），与"原文重合"不是一回事；此档对语文**无信息量、纯噪音**。
  //   边界：仅"字面重合"档豁免；**算式重复/情境集中/首段自述/数据裂缝等其余档照常**（语文不涉算式，实际无影响）。
  // 🔴 2026-10-10（属主裁定·消噪音）：**删"照搬"档**——原文作阅读材料本就该引用（语文尤甚），
  //    "与教材参考段字面重合"对正式卷**无信息量、纯噪音** ⇒ 不再产出该档命中（连同 bannedList 一并空）。
  const copyOn = false;
  const copyHits = copyOn
    ? scanCopyOverlap({ bodyHtml: html, corpus, longN, subject }).map((h) => ({
        cat: 'copy', level: 'warn',
        text: `「${h.snippet}」（${h.kind === 'num' ? '数字串' : /[A-Za-z]/.test(h.snippet) ? `${h.n} 词连续` : `${h.n} 字连续`}命中教材参考段）`,
        snippet: h.snippet,
      }))
    : [];
  const sanityHits = sanityScan(html).map((t) => ({ cat: 'sanity', level: 'warn', text: t }));
  // 🔴 2026-10-10（属主裁定·消噪音）：**删"算式重复"档**——同一单元就那几道（如 1~6 的乘法），
  //    同型算式在多题出现是**应然**，按"卷内重复"报＝误报 ⇒ 不再产出该档命中。
  const formulaHits = [];
  // 🗑 2026-10-16（属主裁定·消噪音）：原 `detectTopicRepeat` 检测**整档删除**（见上方留痕）⇒ 本档恒空。
  const topicHits = [];
  const openingHits = detectOpeningMetaNarration(html).map((t) => ({ cat: 'opening', level: 'warn', text: t }));

  // 禁用沿用名单（供后续委托防"改完又抄新段"）：字面重合片段去重 + 数字串，禁止再次沿用
  const bannedList = [
    ...new Set(copyHits.filter((h) => h.snippet && String(h.snippet).replace(/[0-9]/g, '').length >= 4).map((h) => h.snippet)),
  ];

  return {
    hits: [...copyHits, ...sanityHits, ...formulaHits, ...topicHits, ...openingHits],
    copyHits, sanityHits, formulaHits, topicHits, openingHits,
    bannedList,
  };
}

const CAT_LABEL = {
  copy: '与教材参考段字面重合（照搬）',
  formula: '卷内算式重复',
  topic: '情境主题集中',
  opening: '正文首段过程自述',
  sanity: '数据/载体裂缝',
};

/**
 * 命中清单 → 结构化卷级报告文本（分节、去重、无拼接残符）。
 * @param {Array<{cat:string,text:string,snippet?:string}>} hits
 * @param {object} [o] { copyLimit?: number }
 * @returns {string[]} 报告段落（每类一节，供【问题列表】逐条使用）
 */
export function guardReportOf(hits = [], { copyLimit = 5 } = {}) {
  const byCat = {};
  for (const h of hits) {
    if (!byCat[h.cat]) byCat[h.cat] = [];
    // 同类别同文案去重（保序）
    if (!byCat[h.cat].some((x) => x.text === h.text)) byCat[h.cat].push(h);
  }
  const paras = [];
  for (const cat of ['copy', 'opening', 'formula', 'topic', 'sanity']) {
    const list = byCat[cat];
    if (!list || !list.length) continue;
    const total = list.length;
    const shown = list.slice(0, cat === 'copy' ? copyLimit : total);
    const extra = total > shown.length ? `（本类共 ${total} 处，仅列前 ${shown.length} 处）` : '';
    const body = shown.map((h) => `· ${h.text}`).join('\n');
    paras.push(`⚠️ 出稿自检·${CAT_LABEL[cat]}：${extra} ${body}`);
  }
  return paras;
}
