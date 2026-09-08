/**
 * 🛡️ 内容合理性扫描（Content Sanity）——生成正文的确定性"违规信号"检测
 * ============================================================
 * 🔴 定位（2026-09 生成侧根治）：AI 编情境时常犯两类数据裂缝——把整数计数硬写为小数再"（即 N）"倒推回译、
 *    以及同物理量换算时单位/数值自相矛盾（如"2.05 千米（单位换算后为 205 千米）"）。
 *    均属"去诱导、情境真实"基准明确排斥的形式。本模块只做确定性模式检测、只"报"不"改"，
 *    命中信号中性透出到生成报告【问题列表】，引导定向重做/人工修订（不自动篡改正文，不诱导改法）。
 * ============================================================
 */

/** 可数对象量词（计数对象的物理量——数量不得为小数） */
const COUNT_NOUNS = '人|位|本|张|辆|件|盒|只|支|箱|棵|块|条|把|台|套|册|颗|匹|艘|户|名|个|步';
/** 计量单位（长度/质量/容量/货币/时间等） */
const UNITS = '千米|公里|米|分米|厘米|毫米|微米|纳米|千克|公斤|克|毫克|吨|升|毫升|立方|平方|元|角|分|时|小时|分钟|秒|斤|两';
/** 括号回译引导词（"0.86 张（即 86 张）"这类自造倒推） */
const ANNOT_PHRASE = '即|也就是|单位换算后为|换算为|也就是为|即为';

/** 小数 + 可数量词 + "（即 N…）"倒推 → 荒谬计数情境 */
export const detectCountingFakes = (text = '') => {
  const out = [];
  const re = new RegExp(
    `(\\d+\\.\\d+)\\s*(${COUNT_NOUNS})` +
    `\\s*[（(]\\s*(?:${ANNOT_PHRASE})\\s*(\\d+(?:\\.\\d+)?)\\s*[\\u4e00-\\u9fa5]*?[）)]`, 'g'
  );
  let m;
  while ((m = re.exec(text))) {
    out.push(`计数对象被写成小数后倒推整数：${m[0].trim()}（小数 ${m[1]}${m[2]} → "${m[3]}"）`);
  }
  return out;
};

/** 可数量词清单（不含"个/名/步"——与比率/约数句式高频共现易误报，保留在 ANNOT 检测内） */
const COUNT_DIRECT = COUNT_NOUNS.split('|').filter((w) => !['个', '名', '步'].includes(w)).join('|');

/** 小数直接修饰可数对象（2026-09 实证：题 1"1.5 张书签"、题 8(2)"卖出 2.5 件笔筒"——
 *  可数对象只能用 ≥1 整数表示；小数只表示比率/单价/折扣/概率等连续量。
 *  只报不改；命中即提示复核（若为比率语义措辞失误需人工改写，不自动篡改）。
 *  🔧 取整说理/位数语境豁免（2026-09 用户实证两条误报）：
 *     · "0.25 本不足 1 本" —— 应用题取整说理中的"余下不足 1 个单位"，恰是纪律要求写的取整理由，非真实计数；
 *     · "4.5 位数不够" —— 意为 4.5 的（小数）位数不够（缺"的"的省略写法），"位数/数位"是抽象位数不是可数对象个数。
 *     豁免形态：量词后紧跟 不足/不够/不到/不满/凑不成 等取整说理词，或量词=位且其后为"数"。 */
export const detectCountDecimals = (text = '') => {
  const out = [];
  // 排除"小数+量词+（即 N…）"倒推回译形态——由 detectCountingFakes 单独报，避免一因双报；
  // 另排除 取整说理（不足/不够/不到/不满/凑不成）与 位数语境（量词"位"后随"数"）
  const re = new RegExp(
    `(\\d+\\.\\d+)\\s*(${COUNT_DIRECT})` +
    `(?!\\s*(?:[（(]\\s*(?:${ANNOT_PHRASE})|[，,。；;]*(?:不足|不够|不到|不满|凑不成|无法凑成|数)))`, 'g'
  );
  let m;
  while ((m = re.exec(text))) {
    out.push(`可数对象个数写成小数：${m[0].trim()}（${m[1]} ${m[2]}——${m[2]} 为可数对象，个数只能用不小于 1 的整数）`);
  }
  return out;
};

/** 近似值语境符号错用（2026-09 实证：题 3"得数保留一位小数：7.2 × 0.09＝(　)"——
 *  保留位数/四舍五入属"约等于"语义，算式与结果（空位）间应写 ≈，不是 ＝；答案区正确写法
 *  0.648≈0.6 已用 ≈，题干算式侧漏改。按句切分判定，避免跨题/跨句干扰。 */
export const detectApproxEqualsSign = (text = '') => {
  const out = [];
  const approxCue = /保留(?:一|两|三|四|几)?位小数|保留整数|四舍五入|得数保留|取近似|约等于/;
  const eqBeforeBlank = /＝(?=\s*(?:[（(]|[\u3000 ]{2,}|$))/;
  const sentences = String(text || '').split(/(?<=[。！？；!?;])|\n|<br\s*\/?>/i);
  for (const sent of sentences) {
    const s = sent.trim();
    if (!approxCue.test(s)) continue;
    const hit = eqBeforeBlank.exec(s);
    if (hit) {
      out.push(`近似值语境算式用了等号 ＝（应写作约等号 ≈）：${s.slice(0, 46)}…`);
    }
  }
  return out;
};

/** 双载体泄漏守卫（2026-09 实证：模型按宽度换算输出全角空格串后，又叠加一个括号空位 →
 *  同一答案空两种载体（导出成"方框后括号"）。正常归一链应在 contentCleaner 剥除前置空白宽，
 *  此检测器对归一后的最终 HTML 做回归兜底（只报不改）：空白宽串 ≥2 且紧邻空位标签 → 报。 */
export const detectDoubleCarrierLeak = (html = '') => {
  const out = [];
  const re = /((?:&emsp;|&#8195;|&#x2003;|\u2003|\u3000|&nbsp;| ){2,})(?=<(?:u|span)\s+class=["'][^"']*blank-\d+[^"']*["'][^>]*>)/g;
  let m;
  while ((m = re.exec(String(html || '')))) {
    out.push(`同一答案空位出现双载体：空位前残留空白宽度 ${m[1].replace(/\s/g, ' ').length} 字符宽（一个空位只保留一种载体，多余空白宽应已剥除）`);
  }
  return out;
};

/** 同单位换算却数值突变（"2.05 千米（单位换算后为 205 千米）"） */
export const detectUnitMutations = (text = '') => {
  const out = [];
  const re = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*(${UNITS})\\s*[（(]\\s*(?:单位换算后为|换算为|即换算为|即)\\s*(\\d+(?:\\.\\d+)?)\\s*\\2\\s*[）)]`, 'g'
  );
  let m;
  while ((m = re.exec(text))) {
    if (m[1] !== m[3]) {
      out.push(`同单位换算自相矛盾：${m[0].trim()}（${m[1]} ${m[2]} ≠ 换算为 ${m[3]} ${m[2]}）`);
    }
  }
  return out;
};

/** 作答空位过宽统一（2026-09 实证：课时练 35 处填空横线全部 blank-8 字位档——模型未按各空答案
 *  长度定宽，短答案也塞 8 字位。检测条件 = 空位 ≥5 处、档位全一致 且 档位 ≥6（过宽档）：
 *  答案本来等长（如全填 2 位数 → 全 blank-2）属正常，不误报；过宽统一才提示（只报不改，去诱导基准）。
 *  作用于 HTML（读取 blank-N 档位；排除 math-circle 算式填空圈——固定 1.8em 一格一符属正常）。 */
export const detectUniformBlankWidths = (html = '') => {
  const out = [];
  const sizes = [];
  const re = /class=["'][^"']*?blank-(\d+)[^"']*?["']/g;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const cls = m[0];
    if (/math-circle/.test(cls) || /blank-line/.test(cls) || /blank-area/.test(cls)) continue;
    sizes.push(Number(m[1]));
  }
  if (sizes.length >= 5 && new Set(sizes).size === 1 && sizes[0] >= 6) {
    out.push(`全文 ${sizes.length} 处作答空位宽度均为较宽的 ${sizes[0]} 字位档——若各空答案长度短于此宽度，疑似未按答案长度定宽，请复核（答案确需如此宽时可忽略）`);
  }
  return out;
};

/** 题干任务与可作答性错配（2026-09 通用词表驱动，全学科生效，只报不改）：
 *  ① 选择类任务（选择正确读音/选出读音/给加点字选择…）但题内无任何选项 → 无从选择；
 *  ② 声明书写载体（写在横线上/在横线上写…）但题内只有括号空而无横线空/书写行 → 无处按声明书写。
 *  判定词表集中于此（覆盖各学科常见措辞），按题号行切块，避免跨题误报。 */
const SELECT_NO_OPTION_WORDS = /选择(?:正确)?读音|选出.{0,4}读音|选读音|给加点字选择|为加点字选择|给[^<]{0,6}选择正确读音/;
const WRITE_LINE_WORDS = /写在横线上|写在横线里|在横线上写|横线上写|在横线上填空/;
const detectTaskMismatch = (html = '') => {
  const out = [];
  const src = String(html || '');
  const blocks = [];
  let cur = null;
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRe.exec(src))) {
    const inner = m[1];
    const txt = inner.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (/^\d+[.、．]/.test(txt)) { cur = { txt: '', html: '' }; blocks.push(cur); }
    if (cur) { cur.txt += ' ' + txt; cur.html += '\n' + inner; }
  }
  const hasOption = (b) => /class=["'][^"']*option[^"']*["']|(?:^|\n)\s*[A-Ha-h][.、．]\s*|（\s*[A-Ha-h]\s*）/.test(b.html);
  const hasLineBlank = (b) => /<u[^>]*class=["'][^"']*blank-|＿|blank-line/.test(b.html); // 横线空/书写行
  for (const b of blocks) {
    const t = b.txt;
    if (!t || !b.html) continue;
    if (SELECT_NO_OPTION_WORDS.test(t) && !hasOption(b)) {
      out.push(`"选择"类题无选项可择：${t.slice(0, 40)}…（选择类须给选项，直接留空位无法选择）`);
    }
    if (WRITE_LINE_WORDS.test(t) && !hasLineBlank(b)) {
      out.push(`声明"写在横线上"但题内无横线空/书写行（仅括号空不足以按声明书写）：${t.slice(0, 40)}…`);
    }
  }
  return out;
};

/**
 * 卷内"同词音标冲突"检测（2026-09，只报不改）
 * ============================================================
 * 抽取 词 /音标/ 对；同一词（忽略大小写）在卷内出现 ≥2 套不同音标 → 卷内自相矛盾，
 * 提示复核。属"卷内一致性"探测——单处音标是否与词典一致（如 Chinese 末 s 实为 /z/）
 * 超出文本比对能力，由生成端"音标须与实际发音一致且卷内自洽"条款约束。
 */
export const detectPhonemeConflicts = (html = '') => {
  const src = String(html || '');
  const out = [];
  const re = /([A-Za-z][A-Za-z'’-]{1,30})\s*\/\s*([^/\r\n<>]{1,40}?)\s*\//g;
  const map = new Map(); // word(lower) -> Set(transcriptions)
  let m;
  while ((m = re.exec(src)) !== null) {
    const w = m[1].toLowerCase();
    const ph = m[2].replace(/\s+/g, ' ').trim();
    if (!w || !ph) continue;
    if (!map.has(w)) map.set(w, new Set());
    map.get(w).add(ph);
  }
  for (const [w, set] of map) {
    if (set.size < 2) continue;
    out.push(`同一单词 "${w}" 在卷内出现多套音标（${[...set].join(' / ')}），卷内不自洽，请按词典实际发音统一`);
  }
  return out;
};

/** 最小编辑距离（DP，用于引文近似比对；长度差 > max 直接剪枝） */
const levenshtein = (a = '', b = '', max = 2) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = max + 1;
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      if (dp[i][j] < rowMin) rowMin = dp[i][j];
    }
    if (rowMin > max) return max + 1; // 整行超限即剪枝
  }
  return dp[a.length][b.length];
};

/**
 * 卷内"引文复现不一致"检测（2026-09，只报不改）
 * ============================================================
 * 同一句引文（含引号的书名号内文、诗句、名句、材料引文等）在卷内出现 ≥2 处，若字符高度近似
 * 却不完全一致（编辑距离 ≤2 且长度 ≥6），即疑似同一引文被复述为两种写法 → 卷内不自洽，提示复核。
 * 属"卷内一致性"探测（与 detectPhonemeConflicts 同型）：不判断引文对错，只报同卷写法冲突；
 * 与教材逐字比对需教材库，超出文本确定性范围，由生成端"引用以教材原文为准"条款约束。
 * 只比对"成对引号包裹"的文本（""、""、''、''），避免普通句子近似被误报。
 */
export const detectQuoteConflicts = (html = '') => {
  const src = String(html || '');
  const out = [];
  // 三种成对引号分别扫描：中文弯引号 “”、直双引号 ""、中文单弯引号 ‘’
  // （英文撇号 ' 不作引号处理，避免 Let's/children's 等被当成引文内容）
  const matchers = [
    { open: '“', re: /“([^”\n]{6,120})”/g },
    { open: '"', re: /"([^"\n]{6,120})"/g },
    { open: '‘', re: /‘([^’\n]{6,120})’/g },
  ];
  const seen = []; // 已见引文（不分引号类型，跨类型同文也算复现）
  for (const { re } of matchers) {
    let m;
    while ((m = re.exec(src)) !== null) {
      const q = m[1].trim();
      if (q.length < 6) continue;
      for (const prev of seen) {
        if (prev === q) continue; // 完全相同不算冲突
        // 大小写变体（英文句中引用/句首大写差异）不视为冲突：比较前统一小写
        const a = prev.toLowerCase();
        const b = q.toLowerCase();
        if (a === b) continue;
        const dist = levenshtein(a, b, 2);
        if (dist <= 2) {
          out.push(`引文复现写法不一致："${prev}" 与 "${q}"（同一句引文在卷内出现两种写法，请统一为教材/原文一致版本）`);
        }
      }
      seen.push(q);
    }
  }
  return out;
};

/** 全量合理性扫描：返回违规提示语义清单（空=无违规；跨检测器同文案去重） */
export const sanityScan = (content = '') => {
  const html = String(content || '');
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[　\s]+/g, ' ')
    .trim();
  return [
    ...new Set([
      ...detectTaskMismatch(html),
      ...detectUniformBlankWidths(html),
      ...detectCountingFakes(text),
      ...detectCountDecimals(text),
      ...detectApproxEqualsSign(text),
      ...detectDoubleCarrierLeak(html),
      ...detectUnitMutations(text),
      ...detectPhonemeConflicts(text),
      ...detectQuoteConflicts(text),
    ]),
  ];
};

/** 扫描结论 → 审计提示语（只陈述事实，不诱导改法） */
export const sanityNoteOf = (issues) => {
  if (!issues?.length) return '';
  return `⚠️ 内容自洽性扫描：检测到 ${issues.length} 处表述不自洽/数据裂缝（如 ${issues[0]}），请复核修正，使内容准确、情境真实可感。`;
};