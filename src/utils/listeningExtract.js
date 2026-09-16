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

/** 角色归一：英文/中文/常见写法 → M(男) / W(女) / N(旁白·独白) */
export function normalizeRole(raw) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (['m', 'man', 'male', 'boy', '男', '男声', '男音'].includes(s)) return 'M';
  if (['w', 'f', 'woman', 'female', 'girl', '女', '女声', '女音'].includes(s)) return 'W';
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
};
