/**
 * 听力原文 → 结构化（解析与校验，纯函数可单测）
 * ============================================================
 * 配合 config/listeningExtractPrompt.js 使用：AI 只做"搬运"，本模块负责
 *   ① 从答案页 HTML 中取出听力区文本（extractListeningSource）
 *   ② 解析模型的 JSON 输出（容忍代码块围栏/前后噪声）
 *   ③ 归一角色、校验结构、给出可读告警（normalizeListeningStructure）
 * 🔴 全链路不改写词句：解析器只做**结构化与角色归一**，任何文本内容原样保留。
 * ============================================================
 */
import { LISTENING_ROLE_LABELS } from '../config/listeningAudioProfile.js';

/** HTML 片段 → 纯文本（正则实现，不依赖 DOM，Node/浏览器/测试环境一致） */
export function htmlFragmentToText(html = '') {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|td)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();
}

/** 听力原文小节开始：行中含"听力原文/听力材料/录音稿"等（块标题标记，非材料句） */
const LISTENING_BLOCK_HEADING = /听力原文|听力材料|听力文稿|听力录音|听力文本|录音稿/;

/** 非听力内容起始标记（笔试/范文/评分/口语）：出现即截断，其后内容一律不属听力 */
export const NON_LISTENING_RE = /(?:第[一二三四五六七八九十零百]+部分\s*)?(?:笔试部分|笔试|书面表达|参考范文|采分点|评分标准|评分说明|非听力|口语)/;

/** 听力原文小节结束（下一非听力大节，**保守**）：不把"一、"之类卷面指令当边界——
 *  卷面指令若混进小节内，交由 stripPaperNoise / isCjkNoise 解析守卫剔除，避免误截掉其后的材料行 */
const LISTENING_BLOCK_END = NON_LISTENING_RE;

/**
 * 从答案区文本中**只保留"听力原文"小节**（2026-09-19 根因修复）：
 *   原实现从 answer-section <div> 截到文档末尾，把整张答案页（卷面指令/答案/范文/评分）全塞进
 *   听力管路，导致音频把非听力内容也念出来。这里定位"听力原文"标题，取其到下一非听力大节为止。
 *   找不到标题时回退原文本（由解析守卫兜底）。
 */
export function sliceListeningBlock(text = '') {
  const lines = String(text || '').split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (LISTENING_BLOCK_HEADING.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return String(text || '');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (LISTENING_BLOCK_END.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n').replace(/^\s*\n+|\n+\s*$/g, '');
}

/**
 * 从生成结果中取出"听力区"文本
 * 优先取答案区（answer-section / 参考答案 标题起），因为**听力原文只在答案页**（卷面不含，防学生看到答案）。
 * 取到整段后**再截到听力原文小节**，杜绝把整张答案页灌进听力管路。
 */
export function extractListeningSource(content = '') {
  const html = String(content || '');
  if (!html) return '';
  let frag = '';
  const wrapped = html.match(/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>([\s\S]*)$/i);
  if (wrapped) frag = wrapped[1];
  else {
    const bare = html.match(/<h[1-6][^>]*>\s*参考答案[\s\S]*$/i);
    frag = bare ? bare[0] : html;
  }
  return sliceListeningBlock(htmlFragmentToText(frag));
}

/** CJK 占比（中文字符 / (中文+英文字母)，用于识别"卷面/答案残留"） */
const CJK_CH_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
export function cjkRatio(text = '') {
  const s = String(text || '');
  const cjk = s.match(CJK_CH_RE) || [];
  const alpha = s.match(/[A-Za-z]/g) || [];
  const total = cjk.length + alpha.length;
  return total ? cjk.length / total : 0;
}

/** 英语听力材料不可能是中文：非导语段若以中文为主 → 卷面指令/范文/评分残留，应剔除 */
export function isCjkNoise(text = '') {
  return cjkRatio(text) > 0.5;
}

/**
 * 源文本语种判定（2026-09-20，供"粘贴文本配音"分流）
 * ============================================================
 * 'zh' ＝以中文为主 → 这是**中文素材**，必须先译为英语听力稿再出声
 *        （理由已由特征锁实测：中文材料直接进入出声逻辑会被中文噪声守卫丢弃，材料段数=0）；
 * 'en' ＝以英文为主 → 英语听力原文，直接走规则解析（不够可信时再由 AI 兜底）。
 * 阈值与 isCjkNoise 的 0.5 同源，避免"同一份文本两处判得不一样"。
 */
export function detectSourceLanguage(text = '') {
  return cjkRatio(text) > 0.5 ? 'zh' : 'en';
}

/** 卷面部分标题（如「第一部分 听力部分（共3大题，满分30分）」）——名称由音频按固定文案播报，
 *  这里整段剔除（避免它被当成材料或指令）；括号里的题数/分值属书面信息 */
const PAPER_PART_RE = /第[一二三四五六七八九十零百]+部分[^（(]*[（(][^）)]*[）)]/g;
/** 卷面大题题头（如「二、听录音，判断下列句子…（每题2分，共10分）」）——标号+题干要读，分值不读 */
const PAPER_ITEM_RE = /[一二三四五六七八九十]+、[^（(]*[（(][^）)]*[）)]/g;
/** 整行以大题标号起头（「一、听录音…」）——这是**播音指令**（2026-09-19 用户定：音频直接读「一、」），
 *  故保留标号与题干，只去掉括号里的题数/分值 */
const PAPER_ITEM_HEAD_RE = /^\s*[一二三四五六七八九十]+、/;
/** 书面信息括号（题数/分值等）：只去括号本身，保留其前的标号与题干 */
const WRITTEN_META_PAREN_RE = /[（(][^）)]*(?:满分|每题|每小题|共\s*\d|小题|大题|分)[^）)]*[）)]/g;

/**
 * 卷面残留清洗（2026-09-19）：
 *   ① 命中"笔试/范文/评分"标记 → 从该处截断，并告知调用方**其后不再有听力内容**；
 *   ② 部分标题整段剔除（其名称由音频固定播报）；
 *   ③ 大题题头：整行以标号起头者＝**播音指令**，保留「标号+题干」只去分值括号；标号在句中者＝卷面残留，整段剔除。
 * @returns {{ text:string, hardStop:boolean }} text 为空表示整行丢弃
 */
export function stripPaperNoise(text = '') {
  let s = String(text || '');
  let hardStop = false;
  const m = s.match(NON_LISTENING_RE);
  if (m) { s = s.slice(0, m.index); hardStop = true; }
  s = s.replace(PAPER_PART_RE, ' ');
  if (PAPER_ITEM_HEAD_RE.test(s)) s = s.replace(WRITTEN_META_PAREN_RE, ' ');
  else s = s.replace(PAPER_ITEM_RE, ' ');
  return { text: s.replace(/\s+/g, ' ').trim(), hardStop };
}

/**
 * 从播音指令里解析**声明的朗读遍数**（如「每段对话仅读一遍」→1、「每段对话或独白读两遍」→2）。
 * 🔴 为什么要解析：真题里第一节与第二节的遍数并不相同（高考第一节仅读一遍、第二节读两遍），
 *   若音频一律读两遍而指令说"仅读一遍"，学生按指令作答就会错——这是"音频≠播报"的一致性红线。
 *   故本值将**决定该节实际朗读遍数**（以指令为准）。
 * @returns {number} 1/2/3/4；无法判定返回 0
 */
export function parseAnnouncedRepeat(text = '') {
  const s = String(text || '');
  const map = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 1: 1, 2: 2, 3: 3, 4: 4 };
  const m = s.match(/([一二两三四1234])\s*遍/);
  if (!m) return 0;
  return map[m[1]] || 0;
}

/** 题号范围行（如「听第6段材料，回答第6至第10题。」）——它是**元数据**：音频据此报准题号，
 *  自身不作为材料朗读（播报文案由生成端按同一事实统一产出，避免两处各念一遍）。 */
const MATERIAL_RANGE_RE = /^听第\s*\d{1,3}\s*段材料/;

/**
 * 解析题号范围：「听第6段材料，回答第6至第10题」→ { materialNo:6, from:6, to:10 }。
 * 🔴 为什么必须有它：源文本不给范围时，程序只能按条数顺编题号——实测把第三节报成"第七题"，
 *   而该卷第二节实为第 6~10 题、第三节为第 11~15 题。拿不到范围就**不报**（宁可不报，也不报错）。
 * @returns {{materialNo:number, from:number, to:number}|null}
 */
export function parseQuestionRange(text = '') {
  const s = String(text || '');
  const mat = s.match(/听第\s*(\d{1,3})\s*段材料/);
  // 「回答第6至第10题」——注意第二个题号通常也带"第"，故此处 第? 必须允许
  const range = s.match(/回答第\s*(\d{1,3})\s*(?:至|到|—|-|~|～|、|,|，)\s*第?\s*(\d{1,3})\s*题/);
  const single = s.match(/回答第\s*(\d{1,3})\s*题/);   // 「回答第6题」
  if (!mat && !range && !single) return null;
  const from = range ? Number(range[1]) : (single ? Number(single[1]) : 0);
  const to = range ? Number(range[2]) : from;
  return { materialNo: mat ? Number(mat[1]) : 0, from, to };
}

/** 题号范围归一：收"照抄的字符串"与"已结构化对象"两种形态（AI 路径两种都可能给） */
export function normalizeRange(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') {
    const from = Number(raw.from ?? raw.start) || 0;
    const to = Number(raw.to ?? raw.end) || from;
    if (from <= 0) return null;
    return { materialNo: Number(raw.materialNo) || 0, from, to: to >= from ? to : from };
  }
  return parseQuestionRange(String(raw));
}

/** 从节指令里解析**作答时间**（秒）。真题两种说法都在此列：
 *  「听完每段对话后，你都有10秒钟的时间来回答有关小题」（秒数在"回答"前）
 *  「各小题将给出5秒钟的作答时间」（秒数在"作答"前）→ 统一按"秒数…作答/回答"取值。
 *  🔴 与遍数同理：**以指令为准**——指令声明了就照它给留白，不再由程序一律 10 秒。
 *  @returns {number} 秒；未声明返回 0 */
export function parseAnnouncedAnswerSeconds(text = '') {
  const s = String(text || '');
  const m = s.match(/(\d{1,3})\s*秒钟?[^。；]{0,12}?(?:作答|回答)/)
    || s.match(/(?:作答|回答)[^。；]{0,12}?(\d{1,3})\s*秒钟?/);
  return m ? Number(m[1]) : 0;
}

/** 从节指令里解析**读题时间**（秒）：「听每段对话或独白前，你将有时间阅读各个小题，每小题5秒钟」
 *  @returns {number} 秒；未声明返回 0 */
export function parseAnnouncedPreviewSeconds(text = '') {
  const s = String(text || '');
  const m = s.match(/(?:阅读|读题|看题)[^。；]{0,14}?(\d{1,3})\s*秒钟?/)
    || s.match(/(\d{1,3})\s*秒钟?[^。；]{0,12}?(?:阅读|读题|看题)/);
  return m ? Number(m[1]) : 0;
}

/**
 * 答案键行识别（如「T 7. F 8. F 9. T 10. F」「A 39. B 40. C 41. D 42. E」「May 12. three 13.…」）。
 * 🔴 判据取**连续递增题号 ≥3**：答案键的题号必然连号，而正常听力句中即便出现数字
 *    （如「He is 12. She is 13.」）也很少凑成三连号，以此把误伤压到最低。
 */
export function looksLikeAnswerKey(text = '') {
  const t = String(text || '').trim();
  if (!t) return false;
  const nums = (t.match(/(?:^|[^\d])(\d{1,3})\s*[.、．)）]/g) || [])
    .map((x) => Number((x.match(/\d{1,3}/) || [0])[0]))
    .filter((n) => n > 0);
  if (nums.length < 3) return false;
  let run = 1;
  let best = 1;
  for (let i = 1; i < nums.length; i++) {
    run = nums[i] === nums[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best >= 3;
}

/** 该结果是否含英语听力（"听力原文"字样按构造仅英语答案页注入，可作可靠判据） */
export function hasEnglishListening(content = '') {
  return /听力原文/.test(String(content || ''));
}

/**
 * 角色归一：英文/中文/常见写法 → M(男) / W(女) / N(旁白·独白)
 * 🔴 未知但**可辨识的说话人标签**（A/B/C、S1/S2、Speaker1）**原样保留**，不折叠成 N——
 *   一旦折叠，双人对话会退化成单一音色（听不出谁在说），这是听力音频最容易出的错。
 *    说话人身份交给渲染层决定音色（见 listeningScript.voiceOf：未知标签按出现顺序交替男/女）。
 */
export function normalizeRole(raw) {
  const s = String(raw == null ? '' : raw).trim();
  const low = s.toLowerCase();
  if (['m', 'man', 'male', 'boy', '男', '男声', '男音', '男士'].includes(low) || s === '男') return 'M';
  if (['w', 'f', 'woman', 'female', 'girl', '女', '女声', '女音', '女士'].includes(low) || s === '女') return 'W';
  if (['n', 'narrator', '叙述者', '旁白', '独白', '旁述'].includes(low)) return 'N';
  // 未知但成型的说话人标签：保留身份（A/B/C、S1/S2、SPEAKER1、说话人1…）
  const label = s.match(/^(?:speaker|spk|说话人|角色)\s*([0-9a-z]{1,3})$/i);
  if (label) return `S${String(label[1]).toUpperCase()}`;
  if (/^[a-h]$/i.test(s)) return s.toUpperCase();
  if (/^s\d{1,2}$/i.test(s)) return s.toUpperCase();
  return 'N';
}

/** 剥掉 ```json 围栏 */
export function stripCodeFence(text = '') {
  const s = String(text || '').trim();
  const m = s.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  return m ? m[1].trim() : s;
}

/** 从可能夹带说明文字的响应里取出第一个完整 JSON 对象（大括号配平扫描，字符串内大括号不计数） */
export function extractFirstJsonObject(text = '') {
  const s = stripCodeFence(text);
  const start = s.indexOf('{');
  if (start < 0) return '';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  // 未配平（多为输出被截断）→ 返回从首个 { 起的剩余内容，
  // 交由调用方 JSON.parse 抛出**可读的**语法错误，而不是误报"没有 JSON"
  return depth > 0 ? s.slice(start) : '';
}

/**
 * 校验并归一结构化结果
 * @returns {{ intro:string, items:Array<{no:(number|string),lines:Array<{role:string,text:string}>}>, warnings:string[] }}
 */
export function normalizeListeningStructure(obj = {}) {
  const warnings = [];
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  if (!Array.isArray(obj.items)) warnings.push('items 字段缺失或不是数组，已按空处理');

  const items = [];
  rawItems.forEach((it, i) => {
    const lines = (Array.isArray(it && it.lines) ? it.lines : [])
      .map((ln) => ({
        role: normalizeRole(ln && ln.role),
        text: String((ln && ln.text) || '').trim(),
      }))
      .filter((ln) => ln.text);
    if (!lines.length) {
      warnings.push(`第 ${i + 1} 条材料无有效句子，已跳过`);
      return;
    }
    const noRaw = it && it.no;
    const no = Number.isFinite(Number(noRaw)) && String(noRaw).trim() !== ''
      ? Number(noRaw)
      : (noRaw != null && String(noRaw).trim()) || i + 1;
    items.push({
      no,
      lines,
      // 分节播音指令（模型按契约给出时透传；缺省不写该字段，避免空串污染下游）
      // 指令里的遍数/作答秒数/读题秒数一并解析——与规则解析路径同一套"以指令为准"
      ...(String((it && it.instruction) || '').trim()
        ? {
          instruction: String(it.instruction).trim(),
          repeat: parseAnnouncedRepeat(it.instruction) || undefined,
          answerSec: parseAnnouncedAnswerSeconds(it.instruction) || undefined,
          previewSec: parseAnnouncedPreviewSeconds(it.instruction) || undefined,
        }
        : {}),
      // 题号范围（"听第6段材料，回答第6至第10题"）：字符串照抄或已结构化的对象都收，供音频报准题号
      ...(normalizeRange(it && it.range) ? { range: normalizeRange(it && it.range) } : {}),
    });
  });

  const intro = String((obj && obj.intro) || '').trim();
  if (!items.length) warnings.push('未解析出任何听力材料（请检查答案页是否含听力原文）');

  // 角色分布提示：全为 N 说明未能判定说话人性别 —— 对话会退化成单一音色，需人工确认
  const roles = new Set(items.flatMap((it) => it.lines.map((l) => l.role)));
  if (items.length && !roles.has('M') && !roles.has('W')) {
    warnings.push('未识别出男/女声（全部按旁白处理），对话将使用单一音色，建议人工确认');
  }

  return { intro, items, warnings };
}

/**
 * 解析模型响应文本 → 结构化结果
 * @throws {Error} JSON 缺失或结构非法
 */
export function parseListeningStructure(rawText = '') {
  const json = extractFirstJsonObject(rawText);
  if (!json) throw new Error('模型未返回可解析的 JSON');
  let obj;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    throw new Error(`JSON 解析失败：${e.message}`);
  }
  const out = normalizeListeningStructure(obj);
  if (!out.items.length) throw new Error(out.warnings.join('；') || '未解析出听力材料');
  return out;
}

// ═══════════════════════════════════════════════════════════════
// 规则解析器（确定性优先 · 2026-09-16 用户要求「确保解析结构要对」）
// ============================================================
// 为什么不能只靠 AI：解析结构对不对，不能寄望于"提示词写得好、模型就乖"。
//   答案页听力原文里的**题号、说话人、独白还是对话**，本来就能用规则可靠抽出；
//   规则能定的事就绝不交给模型 —— 可复现、零成本、可单测。
// AI 只在规则抽不动时兜底（见 needAiFallback）。
// 支持的常见形态：
//   ① 角色前缀：M:/W:/Man:/Woman:/A:/B:/男：/女：/旁白：
//   ② 破折号对话：— …／– …（按交替说话人处理）
//   ③ 题号：第1题 / 1. / 1、 / (1) / Text 1 / 听力材料一
//   ④ 块标题与噪声行（【听力原文】、分值行、页码、解析标记）自动剔除
//   ⑤ 无角色无题号的整段独白 → 合并为单条旁白
// ============================================================

const CN_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/** 中文数字（一~十及十一~十九）→ number；非中文数字返回 NaN */
export function cnNum(s = '') {
  const t = String(s || '').trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (!t) return NaN;
  let n = 0;
  let i = 0;
  if (t[0] === '十') { n = 10; i = 1; }
  for (; i < t.length; i++) {
    const d = CN_DIGITS[t[i]];
    if (d === undefined) return NaN;
    if (n === 0) n = d;
    else if (i === t.length - 1 && d < 10) n += d;   // 十一、十二…
    else n = n * 10 + d;
  }
  return n || NaN;
}

/** 纯标题行（听力原文/录音稿/Text 之类），不进 lines
 *  🔴 必须含**答案区标题**：extractListeningSource 取的是 answer-section 段，
 *    首行往往是"参考答案与评分标准"——若不剔除，它会被当成第一段听力材料朗读。
 *  🔴 `Text` 只匹配裸标题：写成 `\d*` 会把 "Text 2"（有效的材料题号）当标题丢掉。 */
const HEADING_RES = [
  /^【?\s*(?:英语)?听力(?:原文|材料|文稿|录音稿|文本|稿)?\s*】?$/,
  /^【?\s*(?:录音|听力)?\s*原文\s*】?$/,
  /^[（(]\s*(?:听力)?原文\s*[）)]$/,
  /^Text\s*[:：]?$/i,
  /^\**\s*(?:听力原文|录音稿|听力材料)\s*\**$/,
  /^【?\s*参考答案(?:\s*与\s*(?:评分标准|解析|答案|详解))?\s*】?$/,
  /^【?\s*(?:答案|评分标准|答案与解析|解析与答案)\s*】?$/,
];

/** 答案行（如 "1. B　2. A" 或 "B"）：纯选项字母+题号，不是听力材料 */
export const ANSWER_ROW_RE = /^[A-D]?(?:\s+\d{1,3}\s*[.、．)）]\s*[A-D])*\s*$/;

/** 判断某段文本是否"纯答案行"（只有选项字母与题号，没有任何词） */
export function looksLikeAnswerRow(text = '') {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/^[A-D]$/.test(t)) return true;
  return ANSWER_ROW_RE.test(t) && /[A-D]/.test(t);
}

/** 中文播音指令行 → 归入导语/分节指令（不进 lines）
 *  🔴 含「第X节」：正规听力录音以「第一节，听下面5段对话…」起头，这是**播音指令**而非材料；
 *     「第X部分」不在此列——那是卷面结构标题（由 stripPaperNoise 剔除），音/卷两者不可混同。
 *  🔴 2026-09-19 用户定：小学/校内卷直接以卷面标号起头（「一、听录音，选出你所听到的单词或图片」），
 *     故补 `[一二三四五六七八九十]+、` + 听音动词 这一支——否则该行会被当成小题材料朗读。 */
const INSTRUCTION_RE = /^(?:第[一二三四五六七八九十零百]+节|听下面|请听|听录音|听一段|下面请听|听第\s*\d|请根据|根据所听|Listen\s+(?:to|carefully)|[一二三四五六七八九十]+、\s*(?:听|请听|下面|Listen))/i;

/** 大题边界标号（「第X节」或卷面式「一、」）——命中即 flush 上一条，防止无题号材料被并入上一题 */
const SECTION_LABEL_RE = /^(?:第[一二三四五六七八九十零百]+节|[一二三四五六七八九十]+、)/;

/** 噪声行：分值/页码/解析标记/选项残留单行 */
const NOISE_RES = [
  /^[（(]?\s*(?:共|满分|计)?\s*\d+\s*分\s*[）)]?$/,
  /^第?\s*\d+\s*页\s*$/,
  /^[【(（]\s*(?:解析|答案|考点|点拨|详解)\s*[】)）]/,
  /^【?参考答案】?$/,
];

/**
 * 选项行（A. / B． / (C) …）：**必须剔除**——它不是听力材料。
 * 若误留，会被当成说话人 A/B 或直接朗读出来（把"答案字母"读进听力音频）。
 */
export const OPTION_LINE_RE = /^[（(]?\s*[A-D]\s*[)）.、．]\s*\S/;

/** 题号识别：返回 { no, rest } 或 null */
export function matchItemNumber(line = '') {
  const s = String(line || '').trim();
  let m = s.match(/^第\s*(\d{1,3})\s*[题小]\s*[:：.、]?\s*(.*)$/);
  if (m) return { no: Number(m[1]), rest: m[2] || '' };
  // 数字题号：分隔符后若紧跟数字则视为小数/年份，不当作题号（避免把 "3.5" 误判为题号）
  m = s.match(/^(\d{1,3})\s*[.、．)）]\s*(?!\d)(.*)$/);
  if (m) return { no: Number(m[1]), rest: m[2] || '' };
  m = s.match(/^[（(]\s*(\d{1,3})\s*[)）]\s*(?!\d)(.*)$/);
  if (m) return { no: Number(m[1]), rest: m[2] || '' };
  m = s.match(/^Text\s*(\d{1,3})\b\s*[:：]?\s*(.*)$/i);
  if (m) return { no: Number(m[1]), rest: m[2] || '' };
  m = s.match(/^(?:听力)?材料\s*([一二三四五六七八九十]{1,3}|\d{1,3})\s*[:：]?\s*(.*)$/);
  if (m) {
    const n = cnNum(m[1]);
    if (!Number.isNaN(n)) return { no: n, rest: m[2] || '' };
  }
  return null;
}

/** 说话人前缀识别：返回 { role, text } 或 null（不匹配）
 *  🔴 只认**冒号**：`A.`/`A．` 是选项而非说话人（若也认点号，选项行会被当成说话人 A）。
 *    说话人标注在考试与答案页里的标准写法就是 "M:" / "W：" / "男："。 */
export function splitSpeakerPrefix(line = '') {
  const s = String(line || '').trim();
  const m = s.match(/^(Speaker\s*\d{1,2}|Spk\s*\d{1,2}|说话人\s*\d{1,2}|Narrator|Woman|Man|Boy|Girl|[A-HMWNF]|S\d{1,2})\s*[:：]\s*(.*)$/i);
  if (m) return { role: normalizeRole(m[1]), text: m[2] || '' };
  const zh = s.match(/^(男声|女声|旁白|独白|旁述|叙述者|男士|女士|男|女|老师|学生)\s*[:：]\s*(.*)$/);
  if (zh) return { role: normalizeRole(zh[1]), text: zh[2] || '' };
  return null;
}

/** 破折号对话行识别 */
export function splitDashPrefix(line = '') {
  const m = String(line || '').trim().match(/^[—–]{1,2}\s*(.*)$/);
  return m ? { text: m[1] || '' } : null;
}

/**
 * 规则解析：听力原文纯文本 → 结构化
 * @returns {{ intro:string, items:Array<{no:(number|string),lines:Array<{role:string,text:string}>}>, warnings:string[], stats:object }}
 */
export function parseListeningSourceText(rawText = '') {
  const warnings = [];
  const rawLines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean);

  const items = [];
  let intro = '';
  let cur = null;
  let hadItemNumbers = false;
  let optionDropped = 0;
  let answerRowDropped = 0;
  let answerKeyDropped = 0;
  let instructionDropped = 0;

  const flush = () => { if (cur && cur.lines.length) items.push(cur); cur = null; };

  const addLine = (item, text, isDash = false) => {
    const t = String(text || '').trim();
    if (!t) return;
    const sp = splitSpeakerPrefix(t);
    if (sp && sp.text.trim()) { item.lines.push({ role: sp.role, text: sp.text.trim() }); return; }
    if (isDash || splitDashPrefix(t)) {
      const d = splitDashPrefix(t);
      item.lines.push({ role: '__DASH__', text: (d ? d.text : t).trim() });
      return;
    }
    item.lines.push({ role: null, text: t });
  };

  let pendingInstruction = '';
  let pendingRange = null;   // 待挂的题号范围（"听第6段材料，回答第6至第10题" → 供音频报准题号）
  let activeRepeat = 0;   // 当前生效的"指令声明遍数"（以指令为准，见 parseAnnouncedRepeat）
  let activeAnswerSec = 0;   // 当前节指令声明的作答秒数（0=未声明，走学段/形态默认）
  let activePreviewSec = 0;  // 当前节指令声明的读题秒数（0=未声明）
  let stopped = false;

  /** 新材料起条：把"当前生效的节参数"落到该条（一律以指令为准，见各 parseAnnounced*） */
  const newItem = (no) => {
    const it = { no, lines: [] };
    if (pendingInstruction) { it.instruction = pendingInstruction; pendingInstruction = ''; }
    if (pendingRange) { it.range = pendingRange; pendingRange = null; }
    if (activeRepeat > 0) it.repeat = activeRepeat;
    if (activeAnswerSec > 0) it.answerSec = activeAnswerSec;
    if (activePreviewSec > 0) it.previewSec = activePreviewSec;
    return it;
  };
  /** 无题号材料的编号：有题号范围就用范围起点（第三节短文=第11题起），否则按条数顺延 */
  const nextNo = () => (pendingRange && pendingRange.from > 0 ? pendingRange.from : items.length + 1);

  for (const rawLine of rawLines) {
    if (stopped) break;
    // 卷面残留清洗：命中"笔试/范文/评分"即截断（其后不再有听力），并剔除卷面题头/部分标题
    const cleaned = stripPaperNoise(rawLine);
    const line = cleaned.text;
    if (cleaned.hardStop) stopped = true;
    if (!line) continue;
    if (HEADING_RES.some((re) => re.test(line))) continue;
    if (NOISE_RES.some((re) => re.test(line))) continue;
    // 选项行必须剔除：它既不是听力材料，又会被误当说话人 A/B（把答案字母读进音频）
    if (OPTION_LINE_RE.test(line)) { optionDropped++; continue; }
    // 答案键行（「T 7. F 8.…」「A 39. B 40.…」）：只有答案与题号，不是听力材料
    if (looksLikeAnswerKey(line)) { answerKeyDropped++; continue; }
    // 🔴 题号范围行（「听第6段材料，回答第6至第10题。」）必须**先于节指令判断**：
    //    它以"听第…"开头，否则会被 INSTRUCTION_RE 误当成节指令。本行只作元数据，不作为材料朗读。
    if (MATERIAL_RANGE_RE.test(line)) {
      const rg = parseQuestionRange(line);
      if (rg) pendingRange = rg;
      continue;
    }
    if (INSTRUCTION_RE.test(line)) {
      // 🔴 节边界驱动起条（2026-09-19 用户实测根治）：*节指令*（「第X节/第X部分…」）意味着"上一节到此结束、
      //    本节材料另起一条"，必须 flush。否则后续**无题号**的节材料（独白/短文）会因"当前还有题"
      //    被并进上一题——实测第 5 题一口气吞掉了第二节独白＋第三节短文，且把两篇粘成一条女声。
      const isSection = SECTION_LABEL_RE.test(line);
      if (isSection) {
        flush();
        // 上一节的待挂指令若还没被消费（两节指令相邻、中间无材料）→ 记为丢弃，出口告警（不再静默吞掉）
        if (pendingInstruction) { instructionDropped++; pendingInstruction = ''; }
      }
      // 首条中文指令（尚未出题）→ 开场导语；其后出现的分节指令 → 挂到**下一题**（保"指令 → 该节材料"先后）
      if (!intro && !hadItemNumbers && !cur) intro = line;
      else pendingInstruction = line;
      // 🔴 以指令为准：指令声明的遍数决定该节实际朗读遍数；声明的作答/读题秒数决定该节留白
      const announced = parseAnnouncedRepeat(line);
      if (announced > 0) activeRepeat = announced;
      const ansSec = parseAnnouncedAnswerSeconds(line);
      if (ansSec > 0) activeAnswerSec = ansSec;
      const preSec = parseAnnouncedPreviewSeconds(line);
      if (preSec > 0) activePreviewSec = preSec;
      continue;
    }

    const hit = matchItemNumber(line);
    if (hit) {
      // 答案行（如「1. B　2. A」）不是听力材料——若留，会被当成第一段材料朗读
      if (looksLikeAnswerRow(hit.rest)) { answerRowDropped++; continue; }
      hadItemNumbers = true;
      flush();
      cur = newItem(hit.no);
      if (hit.rest.trim()) addLine(cur, hit.rest);
      continue;
    }
    if (!cur) cur = newItem(nextNo());
    addLine(cur, line);
  }
  flush();
  // 收尾：末节指令之后没有材料 → 待挂指令会被静默吞掉，这里记为丢弃并告警
  if (pendingInstruction) { instructionDropped++; pendingInstruction = ''; }

  // 后处理：破折号交替 → A/B；无角色行合并为上一位说话人的续句；整条无角色 → 单条旁白
  for (const it of items) {
    let dashFlip = 0;
    for (const ln of it.lines) {
      if (ln.role === '__DASH__') { ln.role = dashFlip % 2 === 0 ? 'A' : 'B'; dashFlip++; }
    }
    const hasRole = it.lines.some((l) => l.role);
    if (!hasRole) {
      const merged = it.lines.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim();
      it.lines = merged ? [{ role: 'N', text: merged }] : [];
      continue;
    }
    const out = [];
    for (const ln of it.lines) {
      if (!ln.role) {
        const prev = out[out.length - 1];
        if (prev) prev.text = `${prev.text} ${ln.text}`.replace(/\s+/g, ' ').trim();
        else out.push({ role: 'N', text: ln.text });
      } else out.push(ln);
    }
    it.lines = out;
  }

  const kept = items.filter((it) => it.lines.length);
  const speakers = new Set(kept.flatMap((it) => it.lines.map((l) => l.role)));
  const stats = {
    items: kept.length,
    lines: kept.reduce((n, it) => n + it.lines.length, 0),
    distinctSpeakers: speakers.size,
    hadItemNumbers,
    optionDropped,
    answerRowDropped,
    answerKeyDropped,
    instructionDropped,
  };

  if (optionDropped >= 2) {
    warnings.push(`已剔除 ${optionDropped} 行选项/答案（A. B. 之类），未计入听力材料`);
  }
  if (answerRowDropped >= 1) {
    warnings.push(`已跳过 ${answerRowDropped} 行纯答案行（如「1. B」），未计入听力材料`);
  }
  if (answerKeyDropped >= 1) {
    warnings.push(`已跳过 ${answerKeyDropped} 行答案键（如「T 7. F 8.」），未计入听力材料`);
  }
  if (instructionDropped >= 1) {
    warnings.push(`有 ${instructionDropped} 条分节指令没挂到任何材料（该节指令后缺材料），已丢弃——请核对听力原文"每节指令 → 该节材料"的对应`);
  }
  if (kept.length && stats.distinctSpeakers === 1) {
    warnings.push('全篇只有一种说话人（按独白处理），若实为对话请核对原文是否标注了说话人');
  }
  if (!hadItemNumbers && kept.length === 1) {
    warnings.push('未识别到小题题号，已合并为一条材料');
  }

  return { intro, items: kept, warnings, stats };
}

/**
 * 是否需要 AI 兜底：规则已经拿到"可信结构"就不调用模型。
 * 可信判据：① 有题号且每条都有内容；或 ② 出现 ≥2 个不同说话人（说明说话人标注可辨）。
 */
export function needAiFallback(parsed) {
  if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length) return true;
  const st = parsed.stats || {};
  if (st.hadItemNumbers && parsed.items.every((it) => it.lines && it.lines.length)) return false;
  if ((st.distinctSpeakers || 0) >= 2) return false;
  return true;
}

/** 供界面展示的一句话摘要 */
export function summarizeListeningStructure({ items = [], intro = '' } = {}) {
  const roles = new Set(items.flatMap((it) => it.lines.map((l) => l.role)));
  const roleText = ['M', 'W', 'N'].filter((r) => roles.has(r)).map((r) => LISTENING_ROLE_LABELS[r]).join('/') || '无';
  const chars = items.reduce((n, it) => n + it.lines.reduce((m, l) => m + l.text.length, 0), 0);
  return `材料 ${items.length} 段　句子 ${items.reduce((n, it) => n + it.lines.length, 0)} 句　角色：${roleText}　字符 ${chars}${intro ? '　含导语' : ''}`;
}

export default {
  htmlFragmentToText,
  extractListeningSource,
  hasEnglishListening,
  normalizeRole,
  stripCodeFence,
  extractFirstJsonObject,
  normalizeListeningStructure,
  parseListeningStructure,
  summarizeListeningStructure,
  cnNum,
  matchItemNumber,
  splitSpeakerPrefix,
  splitDashPrefix,
  parseListeningSourceText,
  needAiFallback,
  OPTION_LINE_RE,
};
