/**
 * 📊 覆盖对账器（Coverage Reconciler）——按覆盖契约对账"生成内容 ↔ 覆盖锚考点"
 * ============================================================
 * 🔴 定位（2026-09 覆盖治理 P2·确定性部分）：生成完成后，程序对最终正文做考点出现度对账，
 *    产出缺漏清单供 auditWarnings 透出 + 后续自动补漏/定向重试决策（唯一事实源：COVERAGE_CONTRACT）。
 *
 * 口径（与 P0 覆盖锚一致，避免两套判定漂移）：
 *   - 只对"已绑定锚"对账（missing 考点在 P0 已排除可命题范围，不进此处）
 *   - 出现判定 = 考点名或具体概念在正文（去 HTML 标签后）词边界命中（wordMatch 同口径）
 *   - 同名考点跨章出现无法消歧：名字在正文出现一次即视为同名锚全部覆盖（防误报缺漏）
 *
 * 模式语义（契约五档）：
 *   full / per-lesson-full：required=true——缺漏即未达标，产出 missing 清单（可补漏集）
 *   focus / none：          required=false——不对账不补漏（聚焦/错题不要求全层级出现）
 *   sampled：               required=false——仅信息性统计（抽样命题允许未覆盖，不补漏）
 * ============================================================
 */
import { contractOf } from '../config/coverageContract.js';
import { wordMatch } from './coverageAnchor.js';

/** 去 HTML 标签 → 单行文本（对账只看"是否出现"，不看排版形态） */
export const stripHtmlForRecon = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ');

/**
 * 对账一次生成正文。
 * @param {Object} p { genType, content, anchors }
 * @returns {Object} { genType, mode, required, total, coveredCount, coverage, missing:[{chapter,name}], coveredNames }
 *   required=false 时 missing 恒为空（模式不要求全层级，不误报）
 */
export const reconcileCoverage = ({ genType = '', content = '', anchors = [] } = {}) => {
  const contract = contractOf(genType);
  const mode = contract.mode;
  const base = { genType, mode, required: false, total: 0, coveredCount: 0, coverage: 1, missing: [], coveredNames: [] };
  // full / per-lesson-full 才做缺漏判定；其余模式不判缺（sampled 仅统计走 reconcileCoverageStats）
  if (!['full', 'per-lesson-full'].includes(mode)) return base;

  const text = stripHtmlForRecon(content);
  const bound = (anchors || []).filter((a) => a.bind.status !== 'missing');
  const wordsOf = (a) => [a.name, ...(a.specificConcepts || [])].filter((w) => w && w.length >= 2);
  const hitMap = new Map(); // 命中过的考点名（同名跨章聚合，防消歧误报）
  const coveredNames = [];
  const missing = [];
  for (const a of bound) {
    let covered = hitMap.has(a.name);
    if (!covered) {
      covered = wordsOf(a).some((w) => wordMatch(text, w));
      if (covered) hitMap.set(a.name, true);
    }
    if (covered) {
      if (!coveredNames.includes(a.name)) coveredNames.push(a.name);
    } else {
      missing.push({ chapter: a.chapterTitle, name: a.name });
    }
  }
  const total = bound.length;
  return {
    genType, mode, required: true, total,
    coveredCount: coveredNames.length,
    coverage: total ? +(coveredNames.length / total).toFixed(2) : 1,
    missing, coveredNames,
  };
};

/** 信息性覆盖统计（sampled 用；不判缺、不补漏，只供报告参考） */
export const reconcileCoverageStats = ({ genType = '', content = '', anchors = [] } = {}) => {
  const contract = contractOf(genType);
  if (contract.mode !== 'sampled') return null;
  const rep = reconcileCoverage({ genType, content, anchors }); // required=false → 仅统计不适用；这里自行统计
  const text = stripHtmlForRecon(content);
  const bound = (anchors || []).filter((a) => a.bind.status !== 'missing');
  const seenNames = new Set();
  let hit = 0;
  for (const a of bound) {
    const key = a.name;
    if (seenNames.has(key)) { hit += 1; continue; } // 同名已命中视为覆盖
    const ok = [a.name, ...(a.specificConcepts || [])]
      .filter((w) => w && w.length >= 2).some((w) => wordMatch(text, w));
    if (ok) { seenNames.add(key); hit += 1; }
  }
  return {
    genType, mode: 'sampled', required: false,
    total: bound.length, coveredCount: hit,
    coverage: bound.length ? +(hit / bound.length).toFixed(2) : 1,
    missing: [], coveredNames: [...seenNames],
  };
};

/** 对账结论 → 提示语（auditWarnings 用；只陈述事实，不给诱导性改法） */
export const coverageNoteOf = (report) => {
  if (!report || !report.required || !report.missing?.length) return '';
  const byChapter = new Map();
  for (const m of report.missing) {
    const k = m.chapter || '未标注章节';
    if (!byChapter.has(k)) byChapter.set(k, []);
    byChapter.get(k).push(m.name);
  }
  const detail = [...byChapter.entries()].map(([ch, names]) => `${ch}：${names.join('、')}`).join('；');
  return `⚠️ 覆盖对账：${report.missing.length} 个考点在本次生成内容中未出现（${detail}）。该资料类型要求全层级覆盖，如需补齐可定向重试或手动补充。`;
};
