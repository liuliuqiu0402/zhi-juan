/**
 * 配图要素一致性交叉校验（题干 ↔ [IMAGE] PROMPT）· 2026-09-16
 * ============================================================
 * 背景：配图此前**只有"有没有图"的探针，没有"图对不对"的校验**——
 *   题干说"三只熊猫"、PROMPT 写"一只熊猫"，程序发现不了。
 * 🔴 为什么不做"结构化字段"（原方案 A 的修正）：
 *   examValidator 1.5 节重建 [IMAGE] 块时**只保留 PROMPT**（ICON 保留 TYPE/KEYWORDS），
 *   其余字段一律丢弃。故新增 SUBJECT:/COUNT:/SCENE: 之类字段既到不了渲染端、也留不下供校验；
 *   而放行未知字段又需渲染端支持（属外部依赖）。**零渲染风险**的等效做法是：
 *   要求 PROMPT 自身写明"主体与数量"，再用本模块对 PROMPT 文本与题干做交叉校验。
 *
 * 🔴 本模块只做**启发式抽检提示**，不改内容、不改分：
 *   数量提取有天然歧义（"四个选项"不是图中数量），故采取保守判定——
 *   **仅当题干与 PROMPT 各只有一个明确数量、且互不相等时才判定不一致**；
 *   其余情形一律不报，宁漏不误。
 * ============================================================
 */

/** 量词（数量必须紧跟量词才算"数量声明"，借此避开题号/分值/年份等裸数字） */
const QUANTIFIER = '只|个|条|种|片|幅|张|块|支|朵|棵|艘|辆|枚|根|粒|群|组|对|双|名|位|台|件|座|层|步|项|段|束|把|面';
/** 量词后若紧跟这些词，说明统计的是"题目形式"而非图中要素 → 不计入 */
const COUNT_EXCLUDE_AFTER = '选项|答案|小题|空|分|遍|句|题|问|图|页|人称';
const CN_DIGIT = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const EN_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** 中文数词 → 数字（支持 一~十、十一~十九、二十、两） */
export function cnCountToNum(s = '') {
  const t = String(s || '').trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (!t) return NaN;
  if (t === '两') return 2;
  if (t.length === 1) return CN_DIGIT[t] ?? NaN;
  if (t[0] === '十') return 10 + (CN_DIGIT[t[1]] ?? 0);
  if (t[1] === '十') return (CN_DIGIT[t[0]] ?? 0) * 10 + (CN_DIGIT[t[2]] ?? 0);
  return NaN;
}

/**
 * 提取"明确的数量声明"
 * @returns {Map<number, string>} 数量 → 命中原文（同数量只留首个样本）
 */
export function extractDeclaredCounts(text = '') {
  const s = String(text || '');
  const found = new Map();
  const reZh = new RegExp(
    `(\\d{1,3}|[一二两三四五六七八九十]{1,3})\\s*(?:${QUANTIFIER})(?!(?:${COUNT_EXCLUDE_AFTER}))`,
    'g'
  );
  let m;
  while ((m = reZh.exec(s)) !== null) {
    const n = cnCountToNum(m[1]);
    if (n && n <= 100 && !found.has(n)) found.set(n, m[0]);
  }
  const reEn = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi;
  while ((m = reEn.exec(s)) !== null) {
    const n = EN_NUM[m[1].toLowerCase()];
    if (n && !found.has(n)) found.set(n, m[0]);
  }
  return found;
}

/** 从 [IMAGE] 块体里取 PROMPT 文本 */
export function promptOfBlock(body = '') {
  const m = String(body || '').match(/PROMPT\s*[:：]\s*([\s\S]*)/i);
  return m ? m[1].trim() : '';
}

/** 该块是否为 ICON 图标检索（图标检索不承载数量，跳过校验） */
export function isIconBlock(body = '') {
  return /TYPE\s*[:：]\s*ICON/i.test(String(body || ''));
}

/** 取 [IMAGE] 前方最近的"本题题干"窗口（契约要求 [IMAGE] 紧跟题干输出，故前文即题干）
 *  🔴 从**最后一个**题号处切起：取第一个会把上一题题干一并带进来（两个题干的数量混在一起 → 误判） */
export function stemWindowBefore(html = '', endIndex = 0, windowSize = 280) {
  const before = String(html || '').slice(0, Math.max(0, endIndex));
  const plain = before.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const tail = plain.slice(-windowSize);
  const re = /\d{1,3}\s*[.、．]\s*\S/g;
  let last = -1;
  let m;
  while ((m = re.exec(tail)) !== null) last = m.index;
  return last < 0 ? tail : tail.slice(last);
}

/**
 * 交叉校验：题干声明数量 ↔ PROMPT 声明数量
 * @returns {{ images:number, checked:number, mismatches:Array, missingCount:Array }}
 *   mismatches  : 题干与 PROMPT 数量均为唯一值且不相等（明确不一致）
 *   missingCount: 题干有唯一数量、PROMPT 未写数量（建议补写，便于核对）
 */
export function checkFigurePrompts(html = '') {
  const s = String(html || '');
  const blocks = [...s.matchAll(/\[IMAGE\]([\s\S]*?)\[\/IMAGE\]/gi)];
  const mismatches = [];
  const missingCount = [];
  let checked = 0;
  let cursor = 0;

  for (const b of blocks) {
    const body = b[1] || '';
    const start = b.index ?? 0;
    const stem = stemWindowBefore(s, start);
    cursor = start + b[0].length;

    if (isIconBlock(body)) continue;
    const promptText = promptOfBlock(body);
    if (!promptText) continue;           // 画面描述缺失由 image-block 规则另行提示

    const stemMap = extractDeclaredCounts(stem);
    const promptMap = extractDeclaredCounts(promptText);
    const stemCounts = [...stemMap.keys()];
    const promptCounts = [...promptMap.keys()];
    if (!stemCounts.length && !promptCounts.length) continue;
    checked += 1;

    // 保守判定：仅当两侧各为唯一值时才下结论
    if (stemCounts.length === 1 && promptCounts.length === 1 && stemCounts[0] !== promptCounts[0]) {
      mismatches.push({
        stemCount: stemCounts[0],
        promptCount: promptCounts[0],
        stemSample: stemMap.get(stemCounts[0]),
        promptSample: promptMap.get(promptCounts[0]),
        prompt: promptText.slice(0, 60),
      });
    } else if (stemCounts.length === 1 && promptCounts.length === 0) {
      missingCount.push({
        stemCount: stemCounts[0],
        stemSample: stemMap.get(stemCounts[0]),
        prompt: promptText.slice(0, 60),
      });
    }
  }

  return { images: blocks.length, checked, mismatches, missingCount };
}

export default {
  cnCountToNum,
  extractDeclaredCounts,
  promptOfBlock,
  isIconBlock,
  stemWindowBefore,
  checkFigurePrompts,
};
