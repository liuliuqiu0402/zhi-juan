/**
 * 简单的语义检索器（基于关键词权重，替代完整嵌入模型）
 * 如果后续需要更高精度，可替换为调用嵌入API
 */
export class SemanticRetriever {
  constructor() {
    this.segments = [];
  }

  /**
   * 索引内容卡片
   */
  indexContentCards(contentCards) {
    this.segments = [];
    for (const card of contentCards) {
      if (!card.segments) continue;
      for (const seg of card.segments) {
        this.segments.push({
          text: seg.text,
          chapterTitle: card.chapterTitle,
          type: seg.type || '正文',
          isKeyConcept: seg.isKeyConcept || false,
          isExample: seg.isExample || false,
          isExercise: seg.isExercise || false,
          knowledgePoints: seg.knowledgePoints || [],
          keywords: this._extractKeywords(seg.text)
        });
      }
    }
    console.log(`📚 语义检索器已索引 ${this.segments.length} 个段落`);
  }

  /**
   * 提取关键词（中文分词简化版）
   */
  _extractKeywords(text) {
    if (!text) return [];

    const cleanText = text.replace(/[，。、；：！？\s,\.;:!?\n]+/g, ' ').trim();
    const chars = cleanText.replace(/\s+/g, '');

    const phrases = new Set();

    for (let len = 2; len <= 6; len++) {
      for (let i = 0; i <= chars.length - len; i++) {
        phrases.add(chars.substring(i, i + len));
      }
    }

    const splitWords = text.split(/[，。、；：！？\s,\.;:!?\n]+/).filter(w => w.length >= 2 && w.length <= 8);
    splitWords.forEach(w => phrases.add(w));

    return [...phrases]
      .filter(w => !/^[\d\.\-\+\*\/\=<>]+$/.test(w))
      .slice(0, 50);
  }

  /**
   * 计算两个关键词集合的相似度
   */
  _keywordSimilarity(kw1, kw2) {
    if (!kw1.length || !kw2.length) return 0;
    let matchCount = 0;
    let weightSum = 0;

    for (const w of kw1) {
      let bestWeight = 0;
      for (const k of kw2) {
        if (k === w) {
          bestWeight = 1.0;
          break;
        } else if (k.includes(w) || w.includes(k)) {
          const lenRatio = Math.min(w.length, k.length) / Math.max(w.length, k.length);
          bestWeight = Math.max(bestWeight, lenRatio * 0.7);
        }
      }
      if (bestWeight > 0) {
        matchCount++;
        weightSum += bestWeight;
      }
    }

    return weightSum / Math.max(kw1.length, kw2.length);
  }

  /**
   * 查找与查询最相关的段落
   * @param {string} query - 查询文本（知识点名称）
   * @param {number} topK - 返回数量
   * @returns {Array} 相关段落数组
   */
  findRelevant(query, topK = 3) {
    if (!query || this.segments.length === 0) return [];

    const queryKeywords = this._extractKeywords(query);
    const scored = this.segments.map(seg => {
      const keywordScore = this._keywordSimilarity(queryKeywords, seg.keywords);

      let exactBonus = 0;
      if (seg.text && seg.text.includes(query)) exactBonus += 0.3;
      if (seg.knowledgePoints.some(kp => kp && typeof kp === 'string' && (kp.includes(query) || query.includes(kp)))) {
        exactBonus += 0.4;
      }

      const conceptBonus = seg.isKeyConcept ? 0.2 : 0;
      const exampleBonus = (seg.isExample || seg.isExercise) ? 0.1 : 0;

      const totalScore = keywordScore * 0.5 + exactBonus + conceptBonus + exampleBonus;

      return { ...seg, score: totalScore };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(s => s.score > 0.1)
      .map(s => ({
        chapterTitle: s.chapterTitle,
        text: s.text,
        type: s.isExample ? '例题' : s.isExercise ? '练习' : s.type,
        relevance: s.score > 0.5 ? 'high' : s.score > 0.3 ? 'medium' : 'low'
      }));
  }
}

// 全局单例
export const semanticRetriever = new SemanticRetriever();
