/**
 * 双卡素材区构建（素材线 G7：废除旧"检索式全文直灌"，2026-09-07 用户拍板）
 * ============================================================
 * 依据：docs/design/三线生成架构-设计准绳.md 素材线（预取为主通道，浏览降级为按需追问）——
 *   · 【素材·依据】= 本次覆盖锚的行级知识层级紧凑档（锚名＋层次＋具体概念整条 ≤4；
 *     建议题型/程序字段剔除；拓展锚与缺料锚不进——了解性/无源不当作命题覆盖点）；
 *     依据卡必须全（覆盖保底，唯一合法出口=缺料诊断）。
 *   · 【素材·参考】= 锚绑定的示范段（教材例题/结论框整段，不切句不抽句；练习/作业成品不预取），
 *     预算化挑选（预算内尽量全段；超出预算宁缺段——依据卡仍在、可 browse 补），不切句。
 * 锚记录契约（coverageAnchor.buildAnchors 输出）：{ chapterTitle, name, level, specificConcepts,
 *   isExtension, bind:{ status, segments:[{type,text}] } }
 * ============================================================
 */
import { isReturnableSegment } from './generationSession.js';

/**
 * @param {object} p
 * @param {Array} [p.anchors] buildAnchors 输出（含 bind/isExtension）
 * @param {number} [p.maxChars] 参考卡预算上限（默认 5000；依据卡不受限——覆盖保底必须全）
 * @param {boolean} [p.contentMode] 内容型（summary/preview/dictation/review：正文归纳转写是本职，素材可按学段口径归纳、
 *   标注出处）；false=题类（exam/practice/special/reading/errorbook：素材仅供理解题型结构与算理梯度，
 *   数据/情境/句式一律自拟——2026-09 用户定稿 b 方案，参考段不再自称"取材依据"）
 * @returns {{basis:string, ref:string, boundCount:number}}
 */
export function buildMaterialPackage({ anchors = [], maxChars = 5000, contentMode = false } = {}) {
  const bounds = (anchors || []).filter((a) => a && a.bind && a.bind.status !== 'missing' && !a.isExtension && a.name);
  const basisLines = bounds.map((a) => {
    const concepts = (a.specificConcepts || []).filter(Boolean).slice(0, 4);
    return `· ${a.name}${a.level ? `（${a.level}）` : ''}${concepts.length ? `｜${concepts.join('；')}` : ''}`;
  });
  const basis = basisLines.length
    ? `【素材·依据】（本次覆盖的核心知识与能力层级，命题覆盖点全集；建议题型不提供）\n${basisLines.join('\n')}`
    : '';
  const LIMIT = Math.max(1200, Number(maxChars) || 5000);
  const refParts = [];
  let used = 0;
  for (const a of bounds) {
    const segs = (a.bind?.segments || []).filter((s) => s && s.text && String(s.text).trim()
      && isReturnableSegment(String(s.type || '').trim()));
    if (!segs.length) continue;
    for (const seg of segs) {
      const t = seg.text.trim();
      if (used + t.length > LIMIT) break; // 预算上限：宁缺段（依据卡仍在、可 browse 补），不切句
      refParts.push(`· ${a.name}｜${t}`);
      used += t.length + 6;
    }
  }
  // 🔧 参考卡头（2026-09 b 方案落地）：题类从"示范段原文·供参考不照搬"收敛为"仅供理解题型结构与算理梯度，
  //    数据/情境/句式一律自拟"——旧头"供参考不照搬"仍把示范段当可抄料面展示，禁令停留在口号层；
  //    内容型（正文归纳转写是本职）保留归纳定位，措辞不同但同样禁整段照录
  const ref = refParts.length
    ? contentMode
      ? `【素材·参考】（示范段原文——教材例题/结论框整段；正文按学段口径归纳转写，可标注出处，不整段照录；练习/作业成品不提供）\n${refParts.join('\n')}`
      : `【素材·参考】（仅供理解题型结构与算理/知识梯度——示范段原文见下；命题/题干的数据、情境、人名、句式一律自拟，禁止沿用参考段连续字面；练习/作业成品不提供）\n${refParts.join('\n')}`
    : '';
  return { basis, ref, boundCount: bounds.length };
}
