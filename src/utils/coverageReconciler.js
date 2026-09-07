/**
 * 📊 覆盖对账器（Coverage Reconciler）——按覆盖契约对账"生成内容 ↔ 覆盖锚考点"
 * ============================================================
 * 🔴 定位（2026-09 覆盖治理 P2·确定性部分）：生成完成后，程序对最终正文做考点出现度对账，
 *    产出缺漏清单供 auditWarnings 透出 + 后续自动补漏/定向重试决策（唯一事实源：COVERAGE_CONTRACT）。
 *
 * 口径（与 P0 覆盖锚一致，避免两套判定漂移）：
 *   - 只对"已绑定锚"对账（missing 考点在 P0 已排除可命题范围，不进此处）
 *   - 判定两级（coverageProbe 单一来源，根治"语义考点词面误报"）：
 *       · 行为/语义考点（意义/方法/规律/应用/取值/算理…）→ 章级聚合：章内任一考点命中即视为该章行为考点族覆盖
 *       · 概念/术词考点（循环小数/质数/方程…）→ 精确判定：考点名+下位概念(+等价词) 词面命中，未中即报缺
 *   - 同名考点跨章出现无法消歧：名字在正文出现一次即视为同名锚全部覆盖（防误报缺漏）
 *
 * 判缺产出两层（供分层处置）：
 *   - missing          : 精确(literal)考点未命中 → 有具体名，可交由 auto 补漏指名短生成/定向重试
 *   - missingChapters  : 整章零命中的章 → 仅透出章级提示（行为考点不逐条报，防诱导）
 *
 * 模式语义（契约五档）：
 *   full / per-lesson-full：required=true——缺漏即未达标，产出 missing 清单（可补漏集）
 *   focus / none：          required=false——不对账不补漏（聚焦/错题不要求全层级出现）
 *   sampled：               required=false——仅信息性统计（抽样命题允许未覆盖，不补漏）
 * ============================================================
 */
import { contractOf } from '../config/coverageContract.js';
import { wordMatch } from './coverageAnchor.js';
import { classifyProbe, literalProbeWords, groupByChapter } from './coverageProbe.js';

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
 * @returns {Object} { genType, mode, required, total, coveredCount, coverage,
 *                      missing:[{chapter,name,probeable}], missingChapters:[{chapter,names}], coveredNames }
 *   required=false 时 missing/missingChapters 恒为空（模式不要求全层级，不误报）
 */
export const reconcileCoverage = ({ genType = '', content = '', anchors = [] } = {}) => {
  const contract = contractOf(genType);
  const mode = contract.mode;
  const base = {
    genType, mode, required: false, total: 0, coveredCount: 0, coverage: 1,
    missing: [], missingChapters: [], coveredNames: [],
  };
  // full / per-lesson-full 才做缺漏判定；其余模式不判缺（sampled 仅统计走 reconcileCoverageStats）
  if (!['full', 'per-lesson-full'].includes(mode)) return base;
  // 🔴 锚范围性质过滤（复位工程·S4.1）：拓展锚（仅绑定"你知道吗/数学文化"科普框，isExtension）
  //    是了解性素材不是命题必覆盖点 → 不进对账点名（循环小数族类锚不再进必覆盖清单）
  const coverageAnchors = (anchors || []).filter((a) => !a.isExtension);

  const text = stripHtmlForRecon(content);
  const byChapter = groupByChapter(coverageAnchors);
  const hitMap = new Map(); // 命中过的同名考点（跨章聚合，防消歧误报）
  const coveredNames = [];
  const missing = [];         // literal 精确未命中（可指名补漏/重试）
  const missingChapters = []; // 整章零命中的章（章级提示）

  for (const [chapter, list] of byChapter) {
    // 章级命中：该章任一考点（精确判定词面）命中即为该章行为考点族达标依据
    let chapterHit = false;
    for (const a of list) {
      if (hitMap.has(a.name)) { chapterHit = true; break; }
      const hit = literalProbeWords(a).some((w) => wordMatch(text, w));
      if (hit) { chapterHit = true; hitMap.set(a.name, true); break; }
    }

    if (!chapterHit) {
      // 整章零命中：保守双报——章级提示 + 该章概念考点精确报缺（可指名补漏）
      missingChapters.push({ chapter, names: list.map((a) => a.name) });
      for (const a of list) {
        if (classifyProbe(a.name) === 'literal' && !coveredNames.includes(a.name)) {
          missing.push({ chapter, name: a.name, probeable: true });
        }
      }
      continue;
    }

    for (const a of list) {
      let covered = hitMap.has(a.name);
      if (!covered) {
        covered = classifyProbe(a.name) === 'literal'
          && literalProbeWords(a).some((w) => wordMatch(text, w));
        if (covered) hitMap.set(a.name, true);
      }
      if (covered) {
        if (!coveredNames.includes(a.name)) coveredNames.push(a.name);
      } else if (classifyProbe(a.name) === 'literal') {
        missing.push({ chapter, name: a.name, probeable: true });
      }
      // 行为考点：章内有命中 → 视为该章行为考点族已覆盖，不逐条报
    }
  }

  const total = byChapter.size ? [...byChapter.values()].reduce((n, l) => n + l.length, 0) : 0;
  const coveredCount = coveredNames.length;
  // 🔧 同族放宽（2026-09 用户定 B·精确版）：仅"同一概念族"部分呈现时不逐条报——
  //    如小数的分类族（循环小数/有限小数/无限小数/无限不循环小数）中任一概念已呈现，
  //    同族其余并列概念缺漏不再逐条报（部分呈现即提示到族，防对课时练逐条打扰）；
  //    非族内并列概念（如"小数乘整数"已现 ≠ "小数乘小数"覆盖）不受放宽，仍逐条报。
  const CONCEPT_FAMILIES = [
    { id: 'decimal-class', keys: ['循环小数', '有限小数', '无限小数', '无限不循环小数'] },
  ];
  const familyOf = (name = '') => {
    for (const f of CONCEPT_FAMILIES) {
      if (f.keys.some((k) => name.includes(k))) return f.id;
    }
    return null;
  };
  const finalMissing = missing.filter((m) => {
    const fid = familyOf(m.name);
    if (!fid) return true;                                  // 非族概念照报
    return !coveredNames.some((n) => familyOf(n) === fid); // 族内概念：无同族覆盖才报
  });
  return {
    genType, mode, required: true, total,
    coveredCount,
    coverage: total ? +(coveredCount / total).toFixed(2) : 1,
    missing: finalMissing, missingChapters, coveredNames,
  };
};

/** 信息性覆盖统计（sampled 用；不判缺、不补漏，只供报告参考） */
export const reconcileCoverageStats = ({ genType = '', content = '', anchors = [] } = {}) => {
  const contract = contractOf(genType);
  if (contract.mode !== 'sampled') return null;
  const text = stripHtmlForRecon(content);
  // 🔴 口径同 reconcileCoverage：拓展锚（科普框了解性素材）不进覆盖统计分母（S4.1）
  const bound = (anchors || []).filter((a) => a.bind.status !== 'missing' && !a.isExtension);
  const seenNames = new Set();
  let hit = 0;
  for (const a of bound) {
    if (seenNames.has(a.name)) { hit += 1; continue; }
    const ok = literalProbeWords(a).some((w) => wordMatch(text, w));
    if (ok) { seenNames.add(a.name); hit += 1; }
  }
  return {
    genType, mode: 'sampled', required: false,
    total: bound.length, coveredCount: hit,
    coverage: bound.length ? +(hit / bound.length).toFixed(2) : 1,
    missing: [], missingChapters: [], coveredNames: [...seenNames],
  };
};

/** 对账结论 → 提示语（auditWarnings 用；只陈述事实，不给诱导性改法） */
export const coverageNoteOf = (report) => {
  if (!report || !report.required) return '';
  if (!(report.missing?.length || report.missingChapters?.length)) return '';
  const parts = [];
  if (report.missing?.length) {
    const byChapter = new Map();
    for (const m of report.missing) {
      const k = m.chapter || '未标注章节';
      if (!byChapter.has(k)) byChapter.set(k, []);
      byChapter.get(k).push(m.name);
    }
    parts.push('已识别以下未呈现的概念类核心知识：'
      + [...byChapter.entries()].map(([ch, names]) => `${ch}（${names.join('、')}）`).join('；'));
  }
  if (report.missingChapters?.length) {
    parts.push(`整课未覆盖：${report.missingChapters.map((c) => c.chapter).join('、')}`);
  }
  parts.push('该资料类型要求全层级覆盖，如需补齐可定向重试或手动补充。');
  return `⚠️ 覆盖对账：${parts.join('；')}`;
};