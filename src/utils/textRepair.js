/**
 * 分学科 OCR 后处理与文本修复
 */

/**
 * 🔧 新增：分学科 OCR 后处理
 * 修复常见 OCR 错误，特别是理科公式
 * @param {string} rawText - OCR 原始文本
 * @param {string} subject - 学科名称
 * @param {string} stage - 学段
 * @returns {string} 后处理后的文本
 */
export const postProcessOCR = (rawText, subject, stage) => {
  if (!rawText || typeof rawText !== 'string') return rawText;
  
  let processed = rawText;

  // ========== 通用修复（所有学科） ==========
  // 修复全角数字和字母
  const fullwidthMap = {
    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
    'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E',
    'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e'
  };
  for (const [full, half] of Object.entries(fullwidthMap)) {
    processed = processed.replace(new RegExp(full, 'g'), half);
  }

  // ========== 语文专用修复 ==========
  if (subject === '语文') {
    processed = processed
      // 省略号修复
      .replace(/\.{3,}/g, '……')
      .replace(/。{3,}/g, '……')
      // 破折号修复
      .replace(/--+/g, '——')
      // 中文标点修复
      .replace(/([\u4e00-\u9fa5])\s*;\s*/g, '$1；')
      .replace(/([\u4e00-\u9fa5])\s*:\s*/g, '$1：')
      .replace(/([\u4e00-\u9fa5])\s*\?\s*/g, '$1？')
      .replace(/([\u4e00-\u9fa5])\s*!\s*/g, '$1！')
      // 去掉行末独立页码
      .replace(/\n\s*\d{1,3}\s*$/gm, '')
      .replace(/^\d{1,3}\s*\n/gm, '\n');
    
    // 🔧 语文教材直接返回，跳过理科处理
    return processed;
  }

  // ========== 数学修复 ==========
  if (subject === '数学') {
    processed = processed
      // 平方、立方修复
      .replace(/([a-zA-Z\u4e00-\u9fa5])2(?!\d)/g, '$1²')
      .replace(/([a-zA-Z\u4e00-\u9fa5])3(?!\d)/g, '$1³')
      // 根号修复
      .replace(/V(\d+)/g, '√$1')
      .replace(/v(\d+)/g, '√$1')
      // 分数符号修复
      .replace(/(\d+)\/(\d+)/g, '$1/$2')
      // 角度符号
      .replace(/(\d+)度/g, '$1°')
      .replace(/(\d+)C/g, '$1°C')
      // pi 修复
      .replace(/[丌兀]|TT/g, 'π')
      // 除号
      .replace(/[十†]/g, '+')
      .replace(/[一—]/g, '−')
      // 乘号
      .replace(/[xXｘ]/g, '×')
      // 不等于
      .replace(/[‡≠]/g, '≠')
      // 大于等于/小于等于
      .replace(/>=/g, '≥')
      .replace(/<=/g, '≤')
      // 约等于
      .replace(/≈/g, '≈')
      .replace(/--/g, '≈')
      // 三角形
      .replace(/A/g, '△')
      // 平行
      .replace(/\|\|/g, '∥')
      .replace(/II/g, '∥')
      // 🔧 新增：常见数学公式OCR错误修复
      // 上标数字修复（x2 → x², x3 → x³, 可选n次方 x^n）
      .replace(/([a-zA-Z\u4e00-\u9fa5])2(?=[\s,，。；;+\-*/=]|$)/g, '$1²')
      .replace(/([a-zA-Z\u4e00-\u9fa5])3(?=[\s,，。；;+\-*/=]|$)/g, '$1³')
      .replace(/([a-zA-Z\u4e00-\u9fa5])\^(\d)/g, '$1$2')  // x^2 → x2 → 上面会转为x²
      // 分数形式修复：½ ⅓ ¼ 等
      .replace(/1\/2/g, '½')
      .replace(/1\/4/g, '¼')
      .replace(/3\/4/g, '¾')
      // 常见符号OCR错误
      .replace(/士/g, '±')   // 正负号
      .replace(/干/g, '±')
      .replace(/丰/g, '±')
      .replace(/工/g, '±')
      .replace(/(\d+)0([℃°])/g, '$1$2')  // 100℃ → 10℃ 修复
      // 希腊字母常见OCR错误
      .replace(/[Aaαａ]/g, 'α')
      .replace(/[Bbβｂ]/g, 'β')
      .replace(/[Yyγｙ]/g, 'γ')
      .replace(/[0OoθΘｏ]/g, 'θ')
      // 公式断行修复：把被换行拆散的公式片段重新连接
      .replace(/([+\-*/=])\s*\n\s*(\d)/g, '$1$2');
  }

  // ========== 物理修复 ==========
  if (subject === '物理') {
    processed = processed
      // 单位修复
      .replace(/m\/s2/g, 'm/s²')
      .replace(/kg\/m3/g, 'kg/m³')
      .replace(/N\/kg/g, 'N/kg')
      .replace(/J\//g, 'J/')
      .replace(/W\//g, 'W/')
      // 希腊字母
      .replace(/[aα]/g, 'α')
      .replace(/[bβ]/g, 'β')
      .replace(/[yγ]/g, 'γ')
      .replace(/[0θ]/g, 'θ')
      .replace(/[uμ]/g, 'μ')
      .replace(/[pρ]/g, 'ρ')
      // 物理量
      .replace(/F合/g, 'F合')
      .replace(/G重/g, 'G');
  }

  // ========== 化学修复 ==========
  if (subject === '化学') {
    processed = processed
      // 常见化学式修复
      .replace(/H20/g, 'H₂O')
      .replace(/C02/g, 'CO₂')
      .replace(/S02/g, 'SO₂')
      .replace(/N02/g, 'NO₂')
      .replace(/NaCl/g, 'NaCl')
      .replace(/HCl/g, 'HCl')
      .replace(/H2S04/g, 'H₂SO₄')
      .replace(/NaOH/g, 'NaOH')
      .replace(/CaC03/g, 'CaCO₃')
      .replace(/NaHC03/g, 'NaHCO₃')
      // 化学箭头（箭头符号直接替换）
      .replace(/->/g, '→')
      .replace(/<-/g, '←')
      .replace(/<->/g, '↔')
      // 🔧 修复：只在包含化学元素符号的上下文中将等号替换为箭头
      // 匹配模式：元素符号 + 可选数字 + 等号 + 元素符号
      .replace(/([A-Z][a-z]?\d*)\s*=\s*([A-Z][a-z]?\d*)/g, '$1→$2')
      .replace(/([A-Z][a-z]?\d*)\s*=\s*([A-Z][a-z]?\d*)/g, '$1→$2') // 第二次替换处理多个等号
      // 上下标
      .replace(/([A-Z][a-z]?)2\+/g, '$1²⁺')
      .replace(/([A-Z][a-z]?)2-/g, '$1²⁻')
      .replace(/([A-Z][a-z]?)3\+/g, '$1³⁺')
      // 反应条件
      .replace(/加热/g, '△')
      .replace(/高温/g, '高温')
      .replace(/催化剂/g, '催化剂');
  }

  // ========== 小学专用：清理过度复杂的内容标记 ==========
  if (stage === '小学') {
    processed = processed
      .replace(/\[IMG[^\]]*\]/g, '[图]')
      .replace(/\[TABLE[^\]]*\]/g, '[表]')
      .replace(/【[^】]*答案[^】]*】/g, '[答案区域]');
  }

  // ========== 选项粘连修复 ==========
  processed = processed.replace(/([A-D])\.(\S+?)([A-D])\./g, '$1.$2  $3.');
  processed = processed.replace(/([A-D])\.(\S+?)([A-D])\./g, '$1.$2  $3.');

  // ========== 省略号修复 ==========
  processed = processed.replace(/\.{3,}/g, '……');
  processed = processed.replace(/。{3,}/g, '……');

  // ========== 破折号修复 ==========
  processed = processed.replace(/--+/g, '——');

  // ========== 中文标点修复 ==========
  processed = processed.replace(/([\u4e00-\u9fa5])\s*;\s*/g, '$1；');
  processed = processed.replace(/([\u4e00-\u9fa5])\s*:\s*/g, '$1：');
  processed = processed.replace(/([\u4e00-\u9fa5])\s*\?\s*/g, '$1？');
  processed = processed.replace(/([\u4e00-\u9fa5])\s*!\s*/g, '$1！');

  return processed;
};

/**
 * 🔧 修复F：模板专用——修复选项粘连
 * 模板（试卷/教辅）中常见 OCR 错误：A.xxxB.xxxC.xxxD.xxx 全部粘在一起
 */
export const _fixTemplateOptionGlue = (text) => {
  if (!text) return text;
  let fixed = text;
  
  // 模式1：A.xxxB.xxxC.xxxD.xxx → 在字母前插入换行或空格
  // 匹配：一个大写字母+.+任意内容+下一个大写字母+.
  fixed = fixed.replace(/([A-D])\.(\D{2,80}?)([A-D])\./g, (match, letter1, content, letter2) => {
    return `${letter1}.${content}\n${letter2}.`;
  });
  
  // 模式2：紧挨着的选项 A.B.C.D. → 插入空格
  fixed = fixed.replace(/([A-D])\.([A-D])\./g, '$1. $2.');
  
  // 模式3：全角选项 Ａ.xxxＢ.xxx → 修复
  fixed = fixed.replace(/([ＡＢＣＤ])\.(\S{2,60}?)([ＡＢＣＤ])\./g, (match, letter1, content, letter2) => {
    const half1 = String.fromCharCode(65 + 'ＡＢＣＤ'.indexOf(letter1));
    const half2 = String.fromCharCode(65 + 'ＡＢＣＤ'.indexOf(letter2));
    return `${half1}.${content}\n${half2}.`;
  });
  
  // 模式4：判断题的 √× 粘连
  fixed = fixed.replace(/([√×])\s*([√×])\s*([√×])/g, '$1  $2  $3');
  
  if (fixed !== text) {
    console.log('🔧 模板选项粘连已修复');
  }
  return fixed;
};

// 🔧 新增：统计 OCR 修复数量
export const countFixes = (original, processed) => {
  let count = 0;
  const minLen = Math.min(original.length, processed.length);
  for (let i = 0; i < minLen; i++) {
    if (original[i] !== processed[i]) count++;
  }
  // 长度差异也计入
  count += Math.abs(original.length - processed.length);
  return count;
};

// 🔧 新增：模板原文结构化标记（便于AI识别题型结构）
export const _addTemplateStructureMarkers = (text) => {
  if (!text) return text;
  let marked = text;
  
  // 1. 大题标题标记（如“一、选择题”、“二、填空题”）
  marked = marked.replace(/^(\s*[一二三四五六七八九十]+[、．]\s*[^\n]{5,30})$/gm, '[SECTION_TITLE]$1[/SECTION_TITLE]');
  
  // 2. 小题序号标记（如“1.”、“21.”）
  marked = marked.replace(/^(\s*\d{1,3}\.\s+)/gm, '[QUESTION_NUM]$1[/QUESTION_NUM]');
  
  // 3. 选项标记（A./B./C./D.）
  marked = marked.replace(/^([A-D]\.\s*)/gm, '[OPTION]$1[/OPTION]');
  
  // 4. 分值标记（如“（每小题2分，共10分）”）
  marked = marked.replace(/(（[^）]*?每小题\d+分[^）]*?）)/g, '[SCORE_INFO]$1[/SCORE_INFO]');
  
  // 5. 答案标记（如“答案：”、“参考答案：”）
  marked = marked.replace(/((?:参考)?答案[：:]\s*)/g, '[ANSWER_LABEL]$1[/ANSWER_LABEL]');
  
  // 6. 解析标记（如“解析：”、“【解析】”）
  marked = marked.replace(/((?:【)?解析[：:]?[】]?\s*)/g, '[EXPLANATION_LABEL]$1[/EXPLANATION_LABEL]');
  
  // 7. 材料/阅读文本标记（如"阅读材料"、"根据材料"）
  marked = marked.replace(/(阅读材料|根据材料|阅读下文)/g, '[MATERIAL]$1[/MATERIAL]');
  
  return marked;
};
