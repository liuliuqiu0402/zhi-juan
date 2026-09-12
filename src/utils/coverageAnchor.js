/**
 * 考点覆盖锚（Coverage Anchor）—— 层级考点 ↔ 教材原文片段的统一绑定与覆盖基座
 * ============================================================
 * 🔴 定位（2026-09 覆盖治理 P0）：覆盖契约 / 对账 / 自动补漏 / 缺料诊断的唯一事实源。
 *
 * 锚的定义：
 *   - 锚 = 章级 knowledgeHierarchy 的 coreKnowledge（第二层，带认知层次 / 具体概念）。
 *     contentCards.anchorTree 在 extractContentCards 捷径分支随卡附带（结构化归一，非原对象引用），
 *     考点 → 章归属由树结构天然成立，不依赖 Step2 knowledgeGraph 中 AI 自由填写的 relatedChapters
 *     （无写入点、缺省高风险，曾致章节锚定失效、检索静默回落）。
 *   - 全局限定：knowledgeGraph 仅作跨章考点名补充去重，不作锚定位。
 *
 * 绑定的定义（每考点在所属章原文中定位支撑片段，四级）：
 *   literal   字面直连：考点名/具体概念命中片段文本（词边界），或命中片段预挂的 knowledgePoints
 *   semantic  语义检索：字面未中，经语义检索命中同章相关段（依赖外部 semanticRetriever）
 *   chapter   章级兜底：章内有原文但无精确命中 → 取章内关键片段（考点素材在本章，可取）
 *   missing   无片段：章无原文/未分析（正常不应出现；出现即取料链路或数据侧诊断信号）
 *
 * 红线（防旧教材）：
 *   可命题考点清单只含已绑定（literal/semantic/chapter）考点；missing 考点不进可命题清单，
 *   进缺料诊断——任何环节不让模型凭训练记忆补教材内容。
 * ============================================================
 */

import { isExtensionSegment } from './segmentTypes.js';

/** 词边界命中（与 useAiGenerator.extractContentCards 内 wordBoundaryMatch 同口径；
 *  绑定模块自含一份，避免跨文件闭包依赖——两处语义保持一致，改动需同步）
 *  2026-09 语言口径：锚判定词若保留教材原文语言（英语资料 specificConcepts 为英文词/短语），
 *  与英文正文匹配须拉丁大小写不敏感（正文句首大写 watched / 锚 watched）；中文不受影响 */
export const wordMatch = (text, keyword) => {
  if (!text || !keyword) return false;
  // 🔧 拉丁字母大小写折叠（仅影响 A-Za-z；中文/数字无大小写概念，折叠幂等）
  const t = String(text);
  const k = String(keyword);
  const hasLatin = /[A-Za-z]/.test(k);
  const hay = hasLatin ? t.toLowerCase() : t;
  const needle = hasLatin ? k.toLowerCase() : k;
  if (needle.length >= 4) return hay.includes(needle);
  let searchFrom = 0;
  while (searchFrom < hay.length) {
    const idx = hay.indexOf(needle, searchFrom);
    if (idx === -1) return false;
    const charBefore = idx > 0 ? hay[idx - 1] : '';
    const charAfter = idx + needle.length < hay.length ? hay[idx + needle.length] : '';
    // 🔧 边界语义按关键词语言区分（2026-09 实证）：
    //    · 英文短词（ee/ago 等）嵌中文句（"字母组合 ee 发 /iː/"）→ 汉字是自然边界，须命中；
    //    · 纯中文短词（估算/小数）嵌中文句 → 汉字非边界（防"先估算再计算"误配"估算"、"分数"误配"分数线"），
    //      仅空白/标点/括号作边界——与 extractContentCards 内 wordBoundaryMatch 原口径一致
    const hasLatinKw = /[A-Za-z]/.test(needle);
    const isBoundary = (ch) => ch === ''
      || /[\s,，。；;、：:！!？?．.（）()【】《》""''\[\]{}]/.test(ch)
      || (hasLatinKw && /[\u4e00-\u9fa5]/.test(ch));
    if (isBoundary(charBefore) && isBoundary(charAfter)) return true;
    searchFrom = idx + 1;
  }
  return false;
};

/** 锚树归一（anchorTree 条目 → 扁平 coreKnowledge 节点列表） */
export const flattenAnchorTree = (anchorTree = []) => {
  const out = [];
  for (const bc of anchorTree || []) {
    const big = bc?.bigConcept || '';
    for (const ck of (bc?.coreKnowledge || [])) {
      if (!ck?.name) continue;
      out.push({
        bigConcept: big,
        name: ck.name,
        level: ck.level || '理解',
        specificConcepts: (ck.specificConcepts || []).filter(Boolean),
      });
    }
  }
  return out;
};

/** 绑定单章：返回 { chapterTitle, anchors:[{...node, bind}] } */
const bindOneCard = (card, retriever) => {
  const chapterTitle = card?.chapterTitle || '';
  const segs = Array.isArray(card?.segments) ? card.segments : [];
  const nodes = flattenAnchorTree(card?.anchorTree);
  const sortSegs = (list) => [...list].sort((a, b) =>
    ((b.isKeyConcept ? 2 : 0) + (b.isExercise ? 1 : 0)) - ((a.isKeyConcept ? 2 : 0) + (a.isExercise ? 1 : 0)));
  const anchors = [];
  for (const node of nodes) {
    const words = [node.name, ...node.specificConcepts].filter((w) => w && w.length >= 2);
    // 1) literal：命中片段文本 或 片段预挂 knowledgePoints（捷径已按层级名匹配挂载）
    const literal = sortSegs(segs.filter((s) => {
      const t = s?.text || '';
      return words.some((w) => wordMatch(t, w))
        || (s?.knowledgePoints || []).some((kp) => kp && words.some((w) => kp === w || kp.includes(w) || w.includes(kp)));
    }));
    let bind;
    if (literal.length) {
      bind = { status: 'literal', segments: literal.slice(0, 6).map((s) => ({ chapterTitle, type: s.type || '正文', text: s.text })) };
    } else {
      // 2) semantic：同章相关段
      const semantic = (retriever && segs.length)
        ? sortSegs((retriever.findRelevant(`${node.name} ${node.specificConcepts.join(' ')}`, 4) || [])
            .filter((r) => r.chapterTitle === chapterTitle))
        : [];
      if (semantic.length) {
        bind = { status: 'semantic', segments: semantic.slice(0, 4).map((s) => ({ chapterTitle, type: s.type || '正文', text: s.text })) };
      } else if (segs.length) {
        // 3) chapter 兜底：章内有原文（考点素材在本章，取关键段）
        const fallback = sortSegs(segs).slice(0, 3);
        bind = { status: 'chapter', segments: fallback.map((s) => ({ chapterTitle, type: s.type || '正文', text: s.text })) };
      } else {
        // 4) missing：章无原文/未分析（诊断信号）
        bind = { status: 'missing', segments: [] };
      }
    }
    // 🔴 锚范围性质判定（复位工程·S4.1）：绑定段全部为"拓展/文化"型（你知道吗/数学文化/课外阅读等
    //    科普框）→ 拓展锚（isExtension）——供对账/必覆盖口径排除：拓展锚是了解性素材，不是命题必覆盖点
    //    （A-101 循环小数族类锚即在"你知道吗"科普框，此前被误纳入必覆盖对账）；
    //    type 未标定时按文本特征复判（isExtensionSegment），兼容存量段
    const extOnly = bind.status !== 'missing' && bind.segments.length > 0
      && bind.segments.every((s) => isExtensionSegment(s));
    anchors.push({ ...node, chapterTitle, bind, isExtension: Boolean(extOnly) });
  }
  return { chapterTitle, anchors };
};

/**
 * 构建全部覆盖锚（含绑定）。
 * @param {Array} contentCards Step1 产物（须含 anchorTree + segments；目录卡/未分析卡 anchorTree 为空）
 * @param {Object} [opts] { retriever } semanticRetriever 实例（可选，缺省则跳过 semantic 级）
 * @returns {{ anchors, report }}
 *   anchors: 全量扁平 [{chapterTitle, bigConcept, name, level, specificConcepts, bind}]
 *   report:  { total, byStatus:{literal,semantic,chapter,missing}, bound, missingList }
 */
export const buildAnchors = (contentCards = [], opts = {}) => {
  const retriever = opts?.retriever || null;
  const anchors = [];
  for (const card of contentCards || []) {
    if (!card?.anchorTree?.length) continue; // 目录卡/未分析卡无锚树，不产出考点
    const { anchors: cardAnchors } = bindOneCard(card, retriever);
    anchors.push(...cardAnchors);
  }
  const count = (st) => anchors.filter((a) => a.bind.status === st).length;
  const report = {
    total: anchors.length,
    byStatus: { literal: count('literal'), semantic: count('semantic'), chapter: count('chapter'), missing: count('missing') },
    bound: anchors.filter((a) => a.bind.status !== 'missing').length,
    missingList: anchors.filter((a) => a.bind.status === 'missing').map((a) => ({ chapter: a.chapterTitle, name: a.name })),
  };
  return { anchors, report };
};

/** 骨架/检索用：只含"已绑定"考点的扁平清单（红线：missing 不进可命题清单） */
export const boundAnchorNames = (anchors = []) =>
  anchors.filter((a) => a.bind.status !== 'missing').map((a) => ({ chapter: a.chapterTitle, bigConcept: a.bigConcept, name: a.name, level: a.level }));
