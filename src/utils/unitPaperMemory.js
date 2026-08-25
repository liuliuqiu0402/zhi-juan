/**
 * 同单元同类型生成记忆（Unit Paper Memory）
 * ============================================================
 * 🔴 定位：解决"同一单元、同一资料类型多次生成，题目内容重复度高"问题。
 *    根因：每次生成都是全新开始——相同素材块 + 相同指令模板 + 相同蓝图，
 *    且无跨会话的"已出题目记忆"（现有差异化只覆盖会话内多类型复生成）。
 *
 * 机制（全局，不针对个案）：
 *   - 生成成功后：记录该 单元×类型 的题目摘要（每题首句，限量）到 localStorage
 *   - 再次生成同一 单元×类型：注入【差异化要求】——列出已出题目摘要，
 *     要求换情境/字词搭配/设问角度，至少 70% 题目与历史不同
 * 按 教材×范围×资料类型 分桶，保留最近 5 次记录，容量受控。
 * ============================================================
 */

/** localStorage 键 */
export const MEMORY_STORAGE_KEY = 'wisdom_unit_paper_memory_v1';

/** 每桶保留最近记录数 */
const MAX_RECORDS_PER_BUCKET = 5;
/** 全局总记录数上限（防 localStorage 膨胀：300 条 × 约 2KB ≈ 600KB，远低于 5MB 上限） */
const MAX_TOTAL_RECORDS = 300;
/** 单次记录保存的题目摘要条数 */
const MAX_SAMPLES_PER_RECORD = 8;
/** 单条摘要最大字符数 */
const MAX_SAMPLE_LEN = 30;

/** 读取记忆库 */
const loadMemory = () => {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '{}') || {};
  } catch { return {}; }
};

/** 构建分桶键（教材 id + 范围 + 资料类型） */
export const buildUnitKey = ({ bookId = '', scope = '', genType = '' } = {}) => `${bookId || 'book'}|${scope || 'default'}|${genType || 'type'}`;

/**
 * 从整卷 HTML 提取题目摘要（每题首句，限量）
 * 🔴 独立轻量实现：不复用 extractQuestionList（其"空壳题过滤"为答案生成设计，
 *    会漏掉"圈出加点字"等无括号载体的题），直接按顶层题号切分纯文本。
 * @param {string} html 整卷 HTML
 * @param {number} maxCount 最多条数
 * @param {number} maxLen 每条最大字符
 * @returns {string[]}
 */
export const extractQuestionSamples = (html = '', maxCount = MAX_SAMPLES_PER_RECORD, maxLen = MAX_SAMPLE_LEN) => {
  if (!html) return [];
  try {
    const body = String(html).split(/<div[^>]*class=["'][^"']*answer-section/i)[0];
    const text = body
      .replace(/<[^>]+>/g, ' ')
      .replace(/&emsp;/g, ' ').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const out = [];
    const parts = text.split(/(?=\s*\d+[.、．]\s*)/);
    for (const part of parts) {
      if (out.length >= maxCount) break;
      const clean = part.replace(/^\s*\d+[.、．]\s*/, '').trim();
      if (!clean || clean.length < 4) continue;
      if (/^[一二三四五六七八九十]+、/.test(clean)) continue; // 大题标题段
      // 题干首句（到第一个句末标点）
      const firstSent = clean.split(/[。！？；\n]/)[0].trim();
      // 🔧 拼入前 2 个子题首句（如"（1）海边的沙滩上，一只海鸥"），
      //    使摘要能区分具体考查内容（看拼音写词语考了哪些字词），而非仅题型
      const subMatches = clean.match(/[（(]\d+[)）][^（(]{1,14}/g) || [];
      const subBits = subMatches.slice(0, 2).map(s => s.trim());
      let s = firstSent;
      if (subBits.length) s += '：' + subBits.join('、');
      if (s.length > maxLen) s = s.slice(0, maxLen);
      if (s) out.push(s);
    }
    return out;
  } catch { return []; }
};

/** 记录一次生成（写入后按时间保留最近 MAX_RECORDS_PER_BUCKET 条 + 全局总记录数上限） */
export const pushUnitPaperMemory = (unitKey = '', samples = []) => {
  if (!unitKey || !Array.isArray(samples) || samples.length === 0) return false;
  const mem = loadMemory();
  const bucket = mem[unitKey] || [];
  const record = { samples: samples.slice(0, MAX_SAMPLES_PER_RECORD), ts: Date.now() };
  // 新记录放最前（同毫秒下保持"最近在前"），再按时间排序 + 限量
  bucket.unshift(record);
  bucket.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  mem[unitKey] = bucket.slice(0, MAX_RECORDS_PER_BUCKET);
  // 🔧 全局总记录数上限：超出删除最旧记录，防 localStorage 无限膨胀（记忆不上云、不占云端）
  const flat = [];
  for (const [k, bk] of Object.entries(mem)) {
    for (let i = 0; i < bk.length; i++) flat.push({ k, idx: i, ts: bk[i].ts });
  }
  if (flat.length > MAX_TOTAL_RECORDS) {
    flat.sort((a, b) => (b.ts || 0) - (a.ts || 0) || (b.idx - a.idx));
    const keep = new Set(flat.slice(0, MAX_TOTAL_RECORDS).map(x => `${x.k}#${x.idx}`));
    for (const k of Object.keys(mem)) {
      mem[k] = mem[k].filter((r, i) => keep.has(`${k}#${i}`));
      if (mem[k].length === 0) delete mem[k];
    }
  }
  try { localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(mem)); } catch { return false; }
  return true;
};

/** 读取某 单元×类型 的历史记录（最近在前） */
export const getUnitPaperMemory = (unitKey = '') => {
  const mem = loadMemory();
  const bucket = mem[unitKey] || [];
  return [...bucket].sort((a, b) => (b.ts || 0) - (a.ts || 0));
};

/** 清空某桶（测试/维护用） */
export const clearUnitPaperMemory = (unitKey = '') => {
  const mem = loadMemory();
  if (unitKey) delete mem[unitKey];
  try { localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(mem)); } catch {}
};

/**
 * 构建跨会话差异化指令段（同 单元×类型 有历史记录时注入）
 * @param {string} unitKey 分桶键
 * @param {string} typeName 资料类型名（如"试卷"）
 * @param {number} maxRecords 注入最近几条记录的摘要
 * @returns {string} 空串 = 无历史记录
 */
export const buildMemoryDiffInstruction = (unitKey = '', typeName = '', maxRecords = 3) => {
  const records = getUnitPaperMemory(unitKey);
  if (records.length === 0) return '';
  const used = records.slice(0, maxRecords);
  const sampleLines = [];
  used.forEach((rec, ri) => {
    (rec.samples || []).slice(0, 5).forEach((s, si) => {
      sampleLines.push(`${ri * 5 + si + 1}. ${s}`);
    });
  });
  if (sampleLines.length === 0) return '';
  return `\n\n【差异化要求——本单元已生成过 ${records.length} 份「${typeName}」】
以下题目已在之前生成的${typeName}中出现，本次严禁与其雷同（换情境/字词搭配/设问角度，至少 70% 的题与已出不同；看拼音写词语换用其他单元字词，连线题换搭配对象）：
已出题目摘要：
${sampleLines.join('\n')}`;
};

export default {
  MEMORY_STORAGE_KEY, buildUnitKey, extractQuestionSamples,
  pushUnitPaperMemory, getUnitPaperMemory, clearUnitPaperMemory, buildMemoryDiffInstruction,
};
