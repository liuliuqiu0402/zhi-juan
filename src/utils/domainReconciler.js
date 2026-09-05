/**
 * 🗂 领域对账器（Domain Reconciler）——"课标内容领域"确定性缺位检测
 * ============================================================
 * 🔴 定位（2026-09 覆盖治理 P3·机制补缺）：课标命题原则"各领域考查内容占比与课标大体一致"，
 *    落到生成端的最低确定性判定 = "整卷各课标领域是否均有所涉及"，缺位即提示。
 *
 * 与审核基准的一致性（硬约束）：
 *   - 只做确定性检查、只透出提示，绝不做程序化分值/占比重算（分数由模型生成，程序不干预）；
 *   - 不重写、不代改正文（不与覆盖"自动补漏"类改稿混同——exam 属 sampled，仅提示）；
 *   - 领域命名与概念词取自 DOMAIN_CONTRACT（课标/教材可核对，非诱导、不进 prompt）；
 *   - 不可归类考点进 other 桶，不硬套领域（防误判、防造 alert）。
 *
 * 判定规则（确定性）：
 *   - 仅对整卷命题（genType=exam）且已登记领域定义的学科执行；其余返回 null（不校验）。
 *   - 领域"出现" = 存在已绑定考点（literal/semantic/chapter）其名称/具体概念词在正文命中，
 *     且该考点（词）能命中某领域白名单词（词边界，与覆盖率对账同口径）。
 *   - 防单领域单元卷误报：若正文仅涉及 ≤1 个领域，视为单领域范围卷型，不判缺位。
 *   - 多领域范围内，凡定义领域未被任何命中考点覆盖 → 列为缺位领域，透出提示。
 * ============================================================
 */
import { DOMAIN_CONTRACT } from '../config/domainContract.js';
import { normalizeSubjectName } from '../config/expertKnowledge.js';
import { stripHtmlForRecon } from './coverageReconciler.js';

/** 将单个考点的（名称+具体概念）合并为一个可检索短语（词边界命中所需的分隔） */
const wordsOfAnchor = (a) => [a.name, ...[...(a.specificConcepts || [])].filter((w) => w && w.length >= 2)];

/** 考点短语是否命中某领域任一白名单词（词干包含；考点短语为教材知识梳理的权威短词，
 *  词干包含命中只会使多领域同时记入 → 略降缺位召回、方向安全，不误报） */
const anchorHitsDomain = (a, domain) => {
  if (!domain?.keywords?.length) return false;
  const phrase = (wordsOfAnchor(a) || []).join('，');
  if (!phrase) return false;
  return domain.keywords.some((k) => k && phrase.includes(k));
};

/**
 * 领域缺位对账。
 * @param {Object} p { genType, subject, content, anchors }
 * @returns {null | Object} 返回 null 表示不适用（非命题型 / 未登记学科 / 单领域范围）。
 *   适用时返回 { genType, subject, required:true, presentDomains, missingDomains, ok }
 */
export const reconcileDomains = ({ genType = '', subject = '', content = '', anchors = [] } = {}) => {
  if (genType !== 'exam') return null;
  const canon = normalizeSubjectName(subject);
  const def = DOMAIN_CONTRACT[canon];
  if (!def?.domains?.length) return null;

  const text = stripHtmlForRecon(content);
  const bound = (anchors || []).filter((a) => a.bind?.status && a.bind.status !== 'missing');
  const presentDomains = new Set();
  const presentDomainCounts = {};
  for (const a of bound) {
    // 考点是否在正文出现（领域对账为宏观归位，用子串包含判定：比词边界更不易漏判出现 → 少报缺位，防误报）
    const appears = wordsOfAnchor(a).some((w) => w && text.includes(w));
    if (!appears) continue;
    const hitName = def.domains.find((d) => anchorHitsDomain(a, d))?.name;
    if (hitName) {
      presentDomains.add(hitName);
      presentDomainCounts[hitName] = (presentDomainCounts[hitName] || 0) + 1;
    } else {
      presentDomainCounts._other = (presentDomainCounts._other || 0) + 1; // 其它桶：不判、不硬套
    }
  }

  const presentList = [...presentDomains];
  // 单领域范围（含仅"其它/不可归类"）不做缺位判定，防单元卷误报
  if (presentList.length <= 1) {
    return { genType, subject: canon, required: false, presentDomains: presentList, missingDomains: [], ok: true, counts: presentDomainCounts };
  }

  const missingDomains = def.domains.filter((d) => !presentDomains.has(d.name)).map((d) => d.name);
  return {
    genType, subject: canon, required: true,
    presentDomains: presentList, missingDomains, ok: missingDomains.length === 0, counts: presentDomainCounts,
  };
};

/** 对账结论 → 提示语（只陈述事实 + 中性建议，不诱导具体改法；与覆盖对账同风格） */
export const domainNoteOf = (report) => {
  if (!report?.required || !report.missingDomains?.length) return '';
  const present = report.presentDomains.join('、');
  return `⚠️ 领域覆盖对账：本份正式卷正文已涉及 ${report.presentDomains.length} 个课标内容领域（${present}），但以下领域未见命题考点——${report.missingDomains.join('、')}。整卷命题宜使各课标领域均有所涉及（课标"各领域考查内容占比与课标大体一致"），如需补足可定向重试或手动补充。`;
};