/**
 * 原文分段工具
 */

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
