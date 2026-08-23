/**
 * 命题素材提取器（PropositionMaterialExtractor）
 * ============================================================
 * 🔴 目的：教材 → 命题素材（非原文）。命题老师从教材提取的是
 *    "可加工的命题要素"，不是可直接粘贴的段落：
 *      - 考点词（字词/概念/句型/人名/事件）
 *      - 情境元素（场景/人物/物品/数字）
 *      - 可加工句式（命题时可重组为新句子的语料单元）
 *    生成时注入"素材要素"而非"原文片段"，要求模型：
 *      ① 用素材要素重新组合成新句子/新情境（换情境、换数据、换角度）
 *      ② 禁止照抄原文段落、禁止把课文原句直接搬进题目
 *    这对应命题老师的真实行为：知识点从教材来，题目形态是再加工。
 * ============================================================
 */

/** 中文停用词（提取考点词时过滤） */
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '有', '和', '就', '都', '一', '不', '也', '要', '会', '可',
  '过', '对', '把', '能', '去', '没', '看', '说', '想', '做', '到', '这', '那', '很',
  '吗', '呢', '啊', '吧', '哦', '哈', '嗯', '着', '了', '与', '及', '或', '而', '并', '以',
  '为', '于', '被', '比', '从', '向', '给', '让', '使', '如', '若', '虽', '但', '因', '所',
]);

/**
 * 从教材分段提取命题素材
 * @param {Array} contentCards 教材分段（含 segments: [{text, knowledgePoints, type}]）
 * @param {Array} kps 知识点清单（可空）
 * @returns {object} { vocab, concepts, scenarios, numbers, forbidden, segmentsMeta }
 */
export function extractPropositionMaterial(contentCards, kps = []) {
  const vocab = new Set();
  const concepts = new Set(kps.filter(Boolean));
  const scenarios = new Set();
  const numbers = new Set();
  const allText = [];

  for (const card of contentCards || []) {
    for (const seg of card.segments || []) {
      const text = seg.text || '';
      if (!text || text.length < 2) continue;
      allText.push(text);
      if (seg.knowledgePoints?.length) seg.knowledgePoints.forEach(k => k && concepts.add(k));
      // 情境元素：书名号/引号内的专名、人名地名
      (text.match(/《[^》]+》/g) || []).forEach(m => scenarios.add(m));
      // 数字/数据（应用题情境素材）
      (text.match(/\d+(?:\.\d+)?\s*(?:元|米|千米|千克|克|分|秒|时|人|个|棵|只|辆|台|本|页|层|级|%)/g) || [])
        .slice(0, 30)
        .forEach(m => numbers.add(m));
    }
  }

  // 考点词：从文本提取 2-4 字中文词（过滤停用词与常见虚词）
  const fullText = allText.join(' ');
  for (const m of (fullText.match(/[\u4e00-\u9fff]{2,4}/g) || [])) {
    if (STOP_WORDS.has(m)) continue;
    if (/^(因为|所以|但是|如果|虽然|而且|然后|于是|只要|只有|无论|即使|既然|尽管|除了)$/.test(m)) continue;
    if (m.length === 2 && /^(我们|你们|他们|自己|可以|没有|不是|这个|那个|什么|怎么|这样|那样|时候|地方|现在|已经|正在|将要|能够|应该|必须|可能|因为|所以|但是|然后)$/.test(m)) continue;
    vocab.add(m);
  }

  return {
    vocab: [...vocab].slice(0, 40),
    concepts: [...concepts].slice(0, 40),
    scenarios: [...scenarios].slice(0, 15),
    numbers: [...numbers].slice(0, 15),
    forbidden: '禁止照抄教材原文段落或课文原句；考点从教材提取，但题目情境、句子、数据必须重新组织（换情境/换数据/换角度），形成全新题目。',
    segmentsMeta: contentCards?.length ? `共 ${contentCards.length} 个教材章节参与命题素材提取` : '',
  };
}

/** 构建注入生成指令的命题素材文本（要素清单，非原文） */
export function buildPropositionMaterialText(contentCards, kps = [], subject = '') {
  const m = extractPropositionMaterial(contentCards, kps);
  const lines = ['【命题素材（从教材提取的可加工要素，禁止照抄原文）】'];
  if (m.concepts.length) lines.push(`考点：${m.concepts.join('、')}`);
  if (m.vocab.length) lines.push(`可用语料词：${m.vocab.join('、')}`);
  if (m.scenarios.length) lines.push(`情境元素：${m.scenarios.join('、')}`);
  if (m.numbers.length) lines.push(`可用数据：${m.numbers.join('、')}`);
  lines.push(`加工规则：${m.forbidden}`);
  if (m.segmentsMeta) lines.push(m.segmentsMeta);
  return lines.join('\n');
}

export default { extractPropositionMaterial, buildPropositionMaterialText };
