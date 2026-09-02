/**
 * 年级→学段 共享解析工具
 * ============================================================
 * 🔴 单一事实源：全项目"年级(中文/数字/圈码)→年级数字"、"学段×年级→五档学段键"统一走本模块。
 * 曾因个别文件用 parseInt('六年级') 得 NaN→0，误判为小学低段（primary_low）；
 * 亦因教材名中的圈码（①~⑩）未在消费端解析、grade 字段缺失时误判"无年级"。
 * 所有依赖"年级数字/学段细分"的消费点（三维度指令注入、质检归一、维度键、能力标签、预算桶……）
 * 一律改用本模块，禁止再各自 parseInt(grade) 直接解析中文年级。
 * ============================================================
 */

/** 中文数词与圈码 → 年级数字（含 十=10） */
const CN_MAP = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
const CIRC_MAP = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10 };

/** 提取年级数字：兼容中文（"六年级"/"三年级"/"高一"）、圈码（"⑥"/"⑥年级"）、阿拉伯数字；无法识别返回 0 */
export const extractGradeNum = (gradeStr) => {
  if (!gradeStr) return 0;
  const num = parseInt(gradeStr, 10);
  if (!isNaN(num)) return num;
  const s = String(gradeStr);
  for (const [cn, n] of Object.entries(CN_MAP)) {
    if (s.includes(cn)) return s.startsWith('高') ? 9 + n : n;
  }
  for (const [cn, n] of Object.entries(CIRC_MAP)) {
    if (s.includes(cn)) return n;
  }
  return 0;
};

/** 从教材名中抓取年级数字（grade 字段缺失时的回退；命中"X年级/第X册/X上/X下/圈码X"才取，
 * 避免把书名里的随机数字/年份误当年级）。无法识别返回 0。 */
export const extractGradeFromName = (name = '') => {
  if (!name) return 0;
  const s = String(name);
  const m = s.match(/([\d一二三四五六七八九十①-⑩]+\s*年级)/) || s.match(/第([\d一二三四五六七八九十①-⑩]+)册/) || s.match(/[（(]?([一二三四五六])\s*[上下]册?[）)]?/);
  return m && m[1] ? extractGradeNum(m[1]) : 0;
};

/** 由学段（中文/键）+ 年级（grade 优先，空则回退抓教材名 name），归一为五档学段键（primary_low/mid/high、middle、high） */
export const resolveStageKey = (stage = '', grade = '', name = '') => {
  const map = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
  const base = map[stage] || stage || '';
  if (base !== 'primary') return base;
  let g = extractGradeNum(grade);
  if (!g && name) g = extractGradeFromName(name); // 🔧 教材名通常带年级（如"六年级/⑥年级/六上"），据此兜底，避免误判"无年级"落回低段
  const key = g > 0 ? (g <= 2 ? 'primary_low' : g <= 4 ? 'primary_mid' : 'primary_high') : '';
  return key || 'primary_high'; // 末位兜底：教材确无年级信息时按高段宽松处理（不再回落到低段）；前置 name 回退已保证"名校带年级"必能解析
};