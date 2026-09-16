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

/**
 * 从生成结果中取出"听力区"文本
 * 优先取答案区（answer-section / 参考答案 标题起），因为**听力原文只在答案页**（卷面不含，防学生看到答案）。
 */
export function extractListeningSource(content = '') {
  const html = String(content || '');
  if (!html) return '';
  const wrapped = html.match(/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>([\s\S]*)$/i);
  if (wrapped) return htmlFragmentToText(wrapped[1]);
  const bare = html.match(/<h[1-6][^>]*>\s*参考答案[\s\S]*$/i);
  if (bare) return htmlFragmentToText(bare[0]);
  return htmlFragmentToText(html);
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
    items.push({ no, lines });
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

/** 中文播音指令行 → 归入导语（不进 lines） */
const INSTRUCTION_RE = /^(?:听下面|请听|听录音|听一段|下面请听|听第\s*\d|请根据|根据所听|Listen\s+(?:to|carefully))/i;

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

  for (const line of rawLines) {
    if (HEADING_RES.some((re) => re.test(line))) continue;
    if (NOISE_RES.some((re) => re.test(line))) continue;
    // 选项行必须剔除：它既不是听力材料，又会被误当说话人 A/B（把答案字母读进音频）
    if (OPTION_LINE_RE.test(line)) { optionDropped++; continue; }
    if (INSTRUCTION_RE.test(line)) { if (!intro) intro = line; continue; }

    const hit = matchItemNumber(line);
    if (hit) {
      // 答案行（如「1. B　2. A」）不是听力材料——若留，会被当成第一段材料朗读
      if (looksLikeAnswerRow(hit.rest)) { answerRowDropped++; continue; }
      hadItemNumbers = true;
      flush();
      cur = { no: hit.no, lines: [] };
      if (hit.rest.trim()) addLine(cur, hit.rest);
      continue;
    }
    if (!cur) cur = { no: items.length + 1, lines: [] };
    addLine(cur, line);
  }
  flush();

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
  };

  if (optionDropped >= 2) {
    warnings.push(`已剔除 ${optionDropped} 行选项/答案（A. B. 之类），未计入听力材料`);
  }
  if (answerRowDropped >= 1) {
    warnings.push(`已跳过 ${answerRowDropped} 行纯答案行（如「1. B」），未计入听力材料`);
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
