/**
 * JSON 鲁棒解析 + 词边界匹配工具
 * 从 useAiGenerator.js 提取的独立工具函数
 */

/**
 * 从模型名称中提取简短显示名称
 */
export const getModelDisplayName = (modelName) => {
  if (!modelName) return 'AI';
  const nameMap = {
    'qwen2.5:14b': 'Qwen2.5-14B',
    'qwen2.5:7b': 'Qwen2.5-7B',
    'qwen2:7b': 'Qwen2-7B',
    'qwen3-vl:8b': 'Qwen3-VL-8B',
    'llava:13b': 'LLaVA-13B',
    'llava:7b': 'LLaVA-7B',
    'deepseek-v4-pro': 'DeepSeek-V4-Pro'
  };

  for (const [key, value] of Object.entries(nameMap)) {
    if (modelName.includes(key)) return value;
  }

  const match = modelName.match(/([a-zA-Z0-9]+[.:][0-9]+b)/i);
  if (match) return match[1];

  return modelName.split(':')[0] || 'AI';
};

/**
 * 词边界匹配：防止"分数"误匹配"分数线""百分数"
 * 规则：
 * 1. 知识点长度 >= 4字，使用 includes
 * 2. 知识点长度 <= 3字，检查前后字符是否为中文/字母/数字边界
 */
export const isWordBoundaryMatch = (text, keyword) => {
  if (!text || !keyword) return false;
  if (keyword.length >= 4) return text.includes(keyword);

  let searchFrom = 0;
  while (searchFrom < text.length) {
    const idx = text.indexOf(keyword, searchFrom);
    if (idx === -1) return false;

    const charBefore = idx > 0 ? text[idx - 1] : '';
    const charAfter = idx + keyword.length < text.length ? text[idx + keyword.length] : '';

    const isBoundary = (ch) => {
      if (ch === '') return true;
      return /[\s,，。；;、：:！!？?（）()【】《》"“”'‘’\[\]\{\}]/.test(ch);
    };

    if (isBoundary(charBefore) && isBoundary(charAfter)) {
      return true;
    }

    searchFrom = idx + 1;
  }
  return false;
};

/**
 * JSON 鲁棒解析
 * 处理 AI 返回的非标准 JSON、截断、格式错误等
 */
export const robustJsonParse = async (response, retryCallback = null, context = '', taskType = 'analysis') => {
  if (!response || typeof response !== 'string') {
    throw new Error(`[${context}] AI返回为空或非字符串`);
  }

  let jsonStr = response;
  jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

  // 提取 JSON 结构
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  } else {
    console.error(`[${context}] 未找到JSON结构`);
    if (retryCallback) {
      const retryResponse = await retryCallback('请严格按照JSON格式回复，只返回JSON', { taskType });
      return robustJsonParse(retryResponse, null, context + '_retry1', taskType);
    }
    throw new Error(`[${context}] AI返回中未找到JSON结构`);
  }

  // 首次尝试
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn(`[${context}] 首次解析失败，尝试修复`);
  }

  // 修复常见错误
  let fixed = jsonStr;
  fixed = fixed.replace(/,\s*}/g, '}');
  fixed = fixed.replace(/,\s*\]/g, ']');
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*)(\s*:)/g, '$1"$2"$3');
  fixed = fixed.replace(/'/g, '"');
  fixed = fixed.replace(/[\x00-\x1F\x7F]/g, '');
  fixed = fixed.replace(/\u201c/g, '"').replace(/\u201d/g, '"');

  try {
    return JSON.parse(fixed);
  } catch (e2) {
    console.warn(`[${context}] 修复后仍失败，尝试补全截断的JSON`);
  }

  // 尝试补全被截断的 JSON
  if (fixed.trim().startsWith('[')) {
    try {
      const lastCompleteObjectEnd = fixed.lastIndexOf('},');
      if (lastCompleteObjectEnd > 0) {
        const partial = fixed.substring(0, lastCompleteObjectEnd + 1) + ']';
        const result = JSON.parse(partial);
        console.warn(`[${context}] 截断修复成功：移除末尾不完整对象，保留${result.length}个元素`);
        return result;
      }

      const incompleteObjMatch = fixed.match(/\[\s*(\{[\s\S]*)$/);
      if (incompleteObjMatch) {
        let incomplete = incompleteObjMatch[1];
        const quoteCount = (incomplete.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) incomplete += '"';
        const openBraces = (incomplete.match(/\{/g) || []).length;
        const closeBraces = (incomplete.match(/\}/g) || []).length;
        // eslint-disable-next-line no-unmodified-loop-condition
        /* eslint-disable no-constant-condition */
        for (let _i = closeBraces; _i < openBraces; _i++) incomplete += '}';
        /* eslint-enable no-constant-condition */
        incomplete += ']'; // eslint-disable-line no-unreachable-loop

        try {
          const result = JSON.parse(incomplete);
          console.warn(`[${context}] 补全修复成功`);
          return result;
        } catch {
          console.warn(`[${context}] 补全后仍无法解析`);
        }
      }
    } catch (e3) {
      console.warn(`[${context}] 截断修复失败:`, e3.message);
    }
  }

  // 对象被截断
  if (fixed.trim().startsWith('{') && !fixed.trim().endsWith('}')) {
    let incomplete = fixed;
    const openBraces = (incomplete.match(/\{/g) || []).length;
    const closeBraces = (incomplete.match(/\}/g) || []).length;
    for (let i = closeBraces; i < openBraces; i++) incomplete += '}';

    try {
      const result = JSON.parse(incomplete);
      console.warn(`[${context}] 对象补全修复成功`);
      return result;
    } catch (e3) {
      console.warn(`[${context}] 对象补全后仍无法解析`);
    }
  }

  // 重试
  if (retryCallback) {
    try {
      const retryResponse = await retryCallback(
        `你返回的以下内容不是合法JSON，请修复并重新返回：\n${jsonStr.substring(0, 500)}\n错误：JSON格式解析失败，请检查并修复`
      );
      return robustJsonParse(retryResponse, null, context + '_retry2');
    } catch (retryError) {
      console.error(`[${context}] 重试失败`);
    }
  }

  throw new Error(`[${context}] JSON解析完全失败，请重试`);
};
