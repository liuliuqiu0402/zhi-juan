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

/** 全量合理性扫描：返回违规提示语义清单（空=无违规） */
export const sanityScan = (content = '') => {
  const text = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[　\s]+/g, ' ')
    .trim();
  return [...detectCountingFakes(text), ...detectUnitMutations(text)];
};

/** 扫描结论 → 审计提示语（只陈述事实，不诱导改法） */
export const sanityNoteOf = (issues) => {
  if (!issues?.length) return '';
  return `⚠️ 数据合理性扫描：检测到 ${issues.length} 处表述中的数据裂缝（如 ${issues[0]}），请复核后调整数据或单位，使情境数量真实可感。`;
};