/**
 * 教材/模板文件元数据自动识别（课本库 TextbookModule 与模板库 TemplateModule 共用）
 * ============================================================
 * 🔴 曾分别在两个模块内各有一份逐字相同的 autoDetectMeta（各自演化 → 学科旧键"政治"、漏"思想政治"、
 *    圈码不全等 bug 双份残留），现收敛为单一共享实现。
 *
 * 识别范围（保守策略，防误判）：
 *   - 年级：小学 1-6 年级（"X年级" + 圈码①~⑥），输出规范中文年级；教材名不标注学段/年级时留空，
 *     由用户在导入界面显式勾选（不做初中/高中年级猜测——文件名通常无学段信息，猜错比不猜更糟）。
 *   - 册次：**高中**按"必修／选择性必修"分册，教材本身不绑定年级（各省教学用书的「册次」与
 *     「使用年级」是两栏并列，使用年级写的是区间），故高中**认册次、不认年级**。册次在文件名里是
 *     字面出现的（"必修第一册""选择性必修2"），照抄不会错 → 识别后回填 stage='高中' + volume。
 *     识别规则见 config/highVolumes.detectHighVolume（"选择性必修"先于"必修"判定，防子串误配）。
 *   - 学科：按新课标标准名识别；"思想政治"优先于其子串"政治"（高中思想政治教材不再被误识别为"政治"），
 *     旧名兼容入口（政治/思想品德/信息技术）统一映射为规范名（道德与法治/信息科技）。
 *   - 学期：上册/下册。
 * ============================================================
 */

import { detectHighVolume } from '../config/highVolumes.js'; // 高中册次识别（高中按册次不按年级）

/** 学科识别：长名优先（"思想政治"必须早于"政治"子串命中）；旧名入口映射为新课标规范名 */
const SUBJECT_RULES = [
  ['思想政治', '思想政治'],
  ['语文', '语文'], ['数学', '数学'], ['英语', '英语'], ['科学', '科学'],
  ['物理', '物理'], ['化学', '化学'], ['生物', '生物'], ['历史', '历史'], ['地理', '地理'],
  ['道德与法治', '道德与法治'], ['政治', '道德与法治'], ['思想品德', '道德与法治'],
  ['信息科技', '信息科技'], ['信息技术', '信息科技'],
  ['音乐', '音乐'], ['美术', '美术'], ['体育', '体育'],
];

const CIRC_TO_DIGIT = { '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6' };
const GRADE_MAP = { '1': '一年级', '2': '二年级', '3': '三年级', '4': '四年级', '5': '五年级', '6': '六年级' };
/** 中文数字 → 年级数字。🔴 修：原正则只写 `([1-6])年级`（仅阿拉伯数字），与本文件声明的
 *  "小学 1-6 年级（"X年级" + 圈码①~⑥）"不符 —— 实际教材名绝大多数写"六年级上册"这种中文数字，
 *  结果 stage/grade 全落空、用户每次导入都要手选。圈码由上面的 CIRC_TO_DIGIT 先转成数字。 */
const CN_GRADE_TO_DIGIT = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6' };

/** 从教材/模板文件名识别 { stage, grade, volume, subject, semester } 元数据（识别不到留空，由用户界面显式勾选补全） */
export const autoDetectTextbookMeta = (name = '') => {
  const result = { stage: '', grade: '', volume: '', subject: '', semester: '' };
  if (!name) return result;
  let normalized = String(name);
  for (const [c, d] of Object.entries(CIRC_TO_DIGIT)) normalized = normalized.split(c).join(d);

  // 高中：认册次、不认年级（"必修／选择性必修"是教材的稳定标识；高一/高二/高三与册次无官方绑定，
  // 各省学年安排不同，猜了必错）。命中 "高中" 亦可 —— 此时册次留空由界面补。
  const high = detectHighVolume(normalized);
  if (high.isHigh) {
    result.stage = '高中';
    result.volume = high.volume;
  } else {
    const gradeMatch = normalized.match(/([1-6一二三四五六])年级/);
    if (gradeMatch) {
      const digit = CN_GRADE_TO_DIGIT[gradeMatch[1]] || gradeMatch[1];
      result.stage = '小学';
      result.grade = GRADE_MAP[digit] || '';
    }
  }

  for (const [keyword, canonical] of SUBJECT_RULES) {
    if (normalized.includes(keyword)) { result.subject = canonical; break; }
  }

  if (normalized.includes('上册')) result.semester = '上册';
  else if (normalized.includes('下册')) result.semester = '下册';

  return result;
};

export default { autoDetectTextbookMeta };
