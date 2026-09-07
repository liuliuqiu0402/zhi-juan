/**
 * 🛡️ 卷级守门引擎（Paper Guard Engine）——生成后确定性"命中清单"的统一收敛层
 * ============================================================
 * 🔴 定位（2026-09 系统性根治，见 docs/design/卷级守门引擎与写作修订轮-根治方案.md）：
 *    - 收敛全部"确定性"卷级检测（照搬命中/数据裂缝/算式重复/情境主题重复/首段过程自述/载体形态），
 *    - 统一输出结构化命中清单与禁用沿用名单（bannedList），驱动写作修订轮（模型侧自行修订）；
 *    - 只报不改（形态级 fix 仍在 examValidator，不在此层）；发现靠确定性规则、修订靠模型（编辑）。
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
 */
export function splitQuestionBlocks(html = '') {
  const lines = htmlToLines(html);
  const blocks = [];
  let cur = null;
  const numRe = /^(\d{1,3})\s*[.、．]/;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^参考答案|^参考[^0-9]{0,6}$/.test(line)) break;
    const m = numRe.exec(line);
    if (m) {
      cur = { id: Number(m[1]), text: line, lines: [line] };
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
  const out = [];
  for (const [f, ids] of owner) {
    if (ids.length >= 2) {
      out.push(`算式「${f}」在本卷出现 ${ids.length} 次（题 ${ids.join('、')}）——同一算式两题复用属卷内重复，请更换其中一题的算式与情境`);
    }
  }
  return out;
}

/** 生活主题词簇（确定性词表；同一主题在 ≥3 个题块出现 → 提示情境主题集中）。
 *  词簇按教育生活场景分组，命中块计数；避免跨题误报（只做块级判定）。 */
const TOPIC_CLUSTERS = [
  { topic: '图书/阅读/书', words: /图书|书架|书店|图书馆|阅览|买书|绘本|科普书|故事书|读书/ },
  { topic: '运动/比赛计时', words: /运动会|接力|赛跑|跑步|游泳|跳远|篮球|足球|操场|夺冠|米决赛|成绩(?!单)/ },
  { topic: '出行/路程/开车', words: /旅行|旅游|出游|开车|乘车|坐车|路程|出行|景区|景点|车站|高铁|汽车每|千米每时|小时到/ },
  { topic: '购物/价格/折扣', words: /超市|商场|购物|单价|促销|特价|折扣|买(?:了|回|来)?\d|应付|付款|收银/ },
  { topic: '家庭/家务', words: /妈妈|爸爸|奶奶|爷爷|家里|家务|做饭|买菜|包饺子/ },
  { topic: '班级/学校活动', words: /班级|全班|学校|小组|中队|大队|植树|大扫除|义卖|募捐/ },
  { topic: '农场/种植/动植物', words: /农场|果园|菜地|蔬菜|水果|植株|树苗|动物|养了|养殖/ },
];
export function detectTopicRepeat(html = '') {
  const blocks = splitQuestionBlocks(html);
  if (blocks.length < 6) return []; // 题量太少不做情境频次提示
  const out = [];
  for (const cl of TOPIC_CLUSTERS) {
    const hitBlocks = blocks.filter((b) => cl.words.test(b.text));
    if (hitBlocks.length >= 3) {
      out.push(`情境主题「${cl.topic}」在本卷 ${hitBlocks.length} 题中出现（题 ${hitBlocks.map((b) => b.id).join('、')}）——请为其中重复题更换独立情境；概念/规则/技能题情境从简或不用`);
    }
  }
  return out;
}

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
export function guardPaper({ html = '', corpus = [], longN = 8, copy = true } = {}) {
  // 照搬守门按资料类型语义分组（2026-09 三维度审计 D1）：
  //   copy=false（知识归纳型 mode=full：summary/preview/dictation/review）——正文职责=按原文归纳呈现，
  //   字面重述是本职，任何字面阈值检测都不适用 → 不比对、不报告、不进 bannedList；
  //   命题/抽样型（practice/special/reading/errorbook/exam）copy=true 全开（8 字）+修订。
  const copyHits = copy
    ? scanCopyOverlap({ bodyHtml: html, corpus, longN }).map((h) => ({
        cat: 'copy', level: 'warn',
        text: `「${h.snippet}」（${h.kind === 'num' ? '数字串' : `${h.n} 字连续`}命中教材参考段）`,
        snippet: h.snippet,
      }))
    : [];
  const sanityHits = sanityScan(html).map((t) => ({ cat: 'sanity', level: 'warn', text: t }));
  const formulaHits = detectFormulaDuplicates(html).map((t) => ({ cat: 'formula', level: 'warn', text: t }));
  const topicHits = detectTopicRepeat(html).map((t) => ({ cat: 'topic', level: 'warn', text: t }));
  const openingHits = detectOpeningMetaNarration(html).map((t) => ({ cat: 'opening', level: 'warn', text: t }));

  // 禁用沿用名单（供修订轮与后续委托）：字面重合片段去重 + 数字串，禁止再次沿用
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
    paras.push(`⚠️ 卷面自检·${CAT_LABEL[cat]}：${extra} ${body}`);
  }
  return paras;
}
