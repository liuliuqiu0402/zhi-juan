/**
 * 年级→学段 共享解析工具
 * ============================================================
 * 🔴 单一事实源：全项目"年级(中文/数字)→年级数字"、"学段×年级→五档学段键"统一走本模块。
 * 曾因个别文件用 parseInt('六年级') 得 NaN→0，误判为小学低段（primary_low）。
 * 所有依赖"年级数字/学段细分"的消费点（指令注入、质检归一、维度键、能力标签、预算桶……）
 * 一律改用本模块，禁止再各自 parseInt(grade) 直接解析中文年级。
 * ============================================================
 */

/** 提取年级数字：兼容中文（"六年级"/"三年级"/"高一"）与阿拉伯数字；无法识别返回 0 */
export const extractGradeNum = (gradeStr) => {
  if (!gradeStr) return 0;
  const num = parseInt(gradeStr, 10);
  if (!isNaN(num)) return num;
  const cnMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const s = String(gradeStr);
  for (const [cn, n] of Object.entries(cnMap)) {
    if (s.includes(cn)) return s.startsWith('高') ? 9 + n : n;
  }
  return 0;
};

/** 由学段（中文/键）+ 年级，归一为五档学段键（primary_low/mid/high、middle、high） */
export const resolveStageKey = (stage = '', grade = '') => {
  const map = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
  const base = map[stage] || stage || '';
  if (base !== 'primary') return base;
  const g = extractGradeNum(grade);
  const key = g > 0 ? (g <= 2 ? 'primary_low' : g <= 4 ? 'primary_mid' : 'primary_high') : '';
  return key || 'primary_high'; // 无年级信息时小学默认按高段宽松处理（不再回落到低段）
};