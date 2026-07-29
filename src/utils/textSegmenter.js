/**
 * 原文分段与检索工具
 */

// Token 估算（中文约1.5字/token，英文约4字符/token）
const estimateTokens = (text) => {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.replace(/[\u4e00-\u9fa5]/g, '').length;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
};


/**
 * 将长文本按语义段落分块，每段不超过 maxLength 字
 * 优先在句号、换行等自然断点处切割
 */
export const splitTextIntoSegments = (text, maxLength = 500) => {
  if (!text || text.trim().length === 0) return [];
  
  const segments = [];
  // 先把文本按空行分开（自然段落）
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  for (const para of paragraphs) {
    if (para.length <= maxLength) {
      segments.push(para.trim());
    } else {
      // 长段落按句子切割
      const sentences = para.split(/(?<=[。！？；\n])/);
      let current = '';
      for (const sent of sentences) {
        if (current.length + sent.length > maxLength && current.length > 0) {
          segments.push(current.trim());
          current = sent;
        } else {
          current += sent;
        }
      }
      if (current.trim()) {
        segments.push(current.trim());
      }
    }
  }
  
  return segments.filter(s => s.trim().length > 0);
};

/**
 * 从内容卡片中找到与给定知识点相关的原文段落
 * @param {string} knowledgePoint - 目标知识点
 * @param {Array} contentCards - 第一步生成的内容卡片
 * @param {number} maxSegments - 最多返回几个段落
 * @returns {Array} 相关原文段落数组
 */
export const findRelatedSegments = (knowledgePoint, contentCards, maxSegments = 3) => {
  if (!knowledgePoint || !contentCards?.length) return [];
  
  const results = [];
  const kpLower = knowledgePoint.toLowerCase();
  
  // 策略1：精确匹配 - 段落标签中包含知识点名称
  for (const card of contentCards) {
    if (!card.segments) continue;
    for (const seg of card.segments) {
      if (seg.knowledgePoints?.some(kp => 
        kp && typeof kp === 'string' && (kp.toLowerCase().includes(kpLower) || kpLower.includes(kp.toLowerCase()))
      )) {
        results.push({
          chapterTitle: card.chapterTitle,
          text: seg.text,
          type: seg.isExample ? '例题' : seg.isExercise ? '练习' : '正文',
          relevance: 'high'
        });
      }
    }
  }
  
  // 策略2：模糊匹配 - 段落文本中包含知识点关键词
  if (results.length < maxSegments) {
    const keywords = kpLower.split(/[,，、\s]+/).filter(k => k.length >= 2);
    for (const card of contentCards) {
      if (!card.segments) continue;
      for (const seg of card.segments) {
        // 避免重复
        if (results.some(r => r.text === seg.text)) continue;
        
        const matchCount = keywords.filter(kw => seg.text && seg.text.toLowerCase().includes(kw)).length;
        if (matchCount >= Math.min(2, keywords.length)) {
          results.push({
            chapterTitle: card.chapterTitle,
            text: seg.text,
            type: seg.isExample ? '例题' : seg.isExercise ? '练习' : '正文',
            relevance: 'medium'
          });
        }
      }
    }
  }
  
  // 策略3：如果还不够，从同章节取正文段落
  if (results.length < maxSegments) {
    for (const card of contentCards) {
      if (!card.segments) continue;
      for (const seg of card.segments) {
        if (results.some(r => r.text === seg.text)) continue;
        if (seg.type === '正文' || seg.isKeyConcept) {
          results.push({
            chapterTitle: card.chapterTitle,
            text: seg.text,
            type: '正文',
            relevance: 'low'
          });
          if (results.length >= maxSegments) break;
        }
      }
      if (results.length >= maxSegments) break;
    }
  }
  
  // 按相关性排序，限制数量
  const relevanceOrder = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => (relevanceOrder[a.relevance] || 0) - (relevanceOrder[b.relevance] || 0));
  
  return results.slice(0, maxSegments);
};

/**
 * 🔧 新增：分级构建教材上下文
 * 优先保证"核心概念"段落的完整性，扩展段落按预算填充
 * @param {Array} segments - 语义检索返回的段落数组
 * @param {number} budget - token 预算
 * @returns {object} { coreText, extendedText, fullContext }
 */
export const buildGradedMaterialContext = (segments, budget) => {
  if (!segments || segments.length === 0) {
    return { coreText: '', extendedText: '', fullContext: '' };
  }

  // 分类：核心段 vs 扩展段
  const coreSegments = segments.filter(s => s.isKeyConcept || s.type === '例题' || s.type === '练习');
  const extendedSegments = segments.filter(s => !coreSegments.includes(s));

  let coreText = '';
  let coreTokens = 0;
  const coreBudget = Math.floor(budget * 0.7); // 核心段最多占 70% 预算

  // 第一步：完整保留核心段（不截断）
  for (const seg of coreSegments) {
    const segText = seg.text;
    const segTokens = estimateTokens(`[${seg.chapterTitle}·${seg.type}]\n${segText}\n`);
    
    if (coreTokens + segTokens <= coreBudget) {
      coreText += `[${seg.chapterTitle}·${seg.type}]\n${segText}\n\n`;
      coreTokens += segTokens;
    } else {
      // 核心段超出预算时，只截断当前段
      const availableTokens = coreBudget - coreTokens;
      if (availableTokens > 100) {
        const charBudget = Math.floor(availableTokens * 1.2);
        const truncatedText = segText.substring(0, charBudget) + '...[核心段过长已截断]';
        coreText += `[${seg.chapterTitle}·${seg.type}]\n${truncatedText}\n\n`;
      }
      break;
    }
  }

  // 第二步：剩余预算给扩展段
  let extendedText = '';
  let extendedTokens = 0;
  const remainingBudget = budget - coreTokens;

  for (const seg of extendedSegments) {
    const segText = seg.text;
    const segTokens = estimateTokens(`[${seg.chapterTitle}·${seg.type}·参考]\n${segText}\n`);
    
    if (extendedTokens + segTokens <= remainingBudget) {
      extendedText += `[${seg.chapterTitle}·${seg.type}·参考]\n${segText}\n\n`;
      extendedTokens += segTokens;
    } else if (remainingBudget - extendedTokens > 100) {
      // 最后一段可截断
      const availableTokens = remainingBudget - extendedTokens;
      const charBudget = Math.floor(availableTokens * 1.2);
      extendedText += `[${seg.chapterTitle}·${seg.type}·参考]\n${segText.substring(0, charBudget)}...[略]\n\n`;
      break;
    }
  }

  // 组装完整上下文，明确指示优先级
  let fullContext = '';
  if (coreText) {
    fullContext += `【🔴 核心教材原文——必须完整阅读并基于此命题】\n${coreText}`;
  }
  if (extendedText) {
    fullContext += `【🟡 补充参考——可辅助理解，但不强制使用】\n${extendedText}`;
  }
  if (fullContext) {
    fullContext += `⚠️ 请确保题目内容紧扣以上核心原文，知识点的考查必须基于教材中的定义和表述。\n`;
  }

  return {
    coreText,
    extendedText,
    fullContext
  };
};
