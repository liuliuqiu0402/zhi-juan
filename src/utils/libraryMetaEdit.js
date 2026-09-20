/**
 * 教材库／模板库「元数据补标」规则（纯函数，单一事实源）
 * ============================================================
 * 🔴 起因（2026-09-20 用户）："要不然老数据就不能按规则归类了"。
 *    列表已按「学段 → 学科」两级分组，但**学段/学科只在导入时能选**（初中本来就不自动识别学段，
 *    只有小学年级与高中册次认得出），老数据缺这两项就落进"未标注"组、再也归不了位，
 *    而且原先没有任何入口能补（册次有「📚」，学段/学科没有）。
 *
 * 🔴 本模块只管"改哪几个字段、字段之间怎么互斥/联动"，**不碰 name / id / 路径**——
 *    改名与路径自愈是另一套（见 libraryPathRepair / libraryRelink），两者互不干扰。
 *    抽成纯函数是为了能直接单测（联动规则写错会导致"小学 + 必修1"这类矛盾状态被存下来）。
 * ============================================================
 */

/** 可选学段（与 expertKnowledge.stages 同口径三档）；'' 表示未标注 */
export const STAGE_CHOICES = ['小学', '初中', '高中'];

/**
 * 原地应用元数据修改（store 里的条目就是普通对象，直接改字段后由 store 落盘）。
 * 规则（三条，均被单测锁定）：
 *   ① **册次只对高中有意义** → 学段不是高中时一律清空册次（否则会存下"小学 + 必修1"这类矛盾组合，
 *      而册次会被生成链路当作教材标识用）；
 *   ② **填了册次就清掉遗留年级** → 与导入落库、存量回填同一口径（高中不按年级）；
 *   ③ **没拿到册次时不碰遗留年级** → 不把标识抹成空白（老数据里的"高二"至少还能显示，见 gradeDisplayLabel）。
 * @param {Object} item 教材/模板条目（原地修改）
 * @param {{ stage?: string, subject?: string, volume?: string }} patch 未给的字段沿用条目现值
 * @returns {{ changed: boolean, applied: { stage: string, subject: string, volume: string } }}
 */
export const applyLibraryMetaEdit = (item, patch = {}) => {
  const empty = { changed: false, applied: { stage: '', subject: '', volume: '' } };
  if (!item || typeof item !== 'object') return empty;

  const snap = (o) => `${o.stage || ''}|${o.subject || ''}|${o.volume || ''}|${o.grade || ''}`;
  const before = snap(item);

  const stage = String(patch.stage ?? item.stage ?? '').trim();
  const subject = String(patch.subject ?? item.subject ?? '').trim();
  let volume = String(patch.volume ?? item.volume ?? '').trim();
  if (stage !== '高中') volume = ''; // 规则①

  item.stage = stage;
  item.subject = subject;
  item.volume = volume;
  if (volume && item.grade) item.grade = ''; // 规则②（规则③即"没有 else 分支"）

  return { changed: before !== snap(item), applied: { stage, subject, volume } };
};

/** 该条目是否缺学段或学科（列表上据此把「🏷️」标成待补状态，提示这里有活要干） */
export const needsMetaBackfill = (item = {}) => (
  !String(item?.stage || '').trim() || !String(item?.subject || '').trim()
);

export default { STAGE_CHOICES, applyLibraryMetaEdit, needsMetaBackfill };
