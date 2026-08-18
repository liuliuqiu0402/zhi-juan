import { ref } from 'vue';
import axios from 'axios';
import { apiConfig, getCurrentEngineConfig, getCurrentEngineConfigEnhanced, getMultimodalConfig } from '../config/apiConfig.js';
import { getStoragePath } from '../utils/pathHelper.js';
import { 
  subjectGradeSystem, 
  genTypeTemplates,
  normalizeSubjectName,
  correctCognitiveLevel,
  allowedCognitiveLevels,
  checkKnowledgeBoundary,
  getTerminologyHint,
  normalizeTerminology
} from '../config/expertKnowledge.js';
import { getMatchingBlockInstructions } from '../config/instructionLib.js';
import { getContextsForSubject } from '../config/subjectContextLibrary.js';
import { getExamBlueprint, buildExamBlueprintText } from '../config/examPaperBlueprints.js';
import { HardRuleChecker, AISemanticReviewer } from '../utils/qualityChecker';
import { runHardValidators, applyAutoFixes } from '../utils/subjectValidators.js';
import { registerController, unregisterController } from '../utils/requestManager.js';

// ===== 提取的独立工具模块 =====
import { getModelDisplayName, robustJsonParse } from '../utils/jsonParser.js';
import { splitTextIntoSegments, findRelatedSegments, buildGradedMaterialContext } from '../utils/textSegmenter.js';
import { useDialog } from './useDialog.js';

// ============================================================
// 🔧 DeepSeek API 稳定性增强：熔断器 + SSE 流式解析
// ============================================================

/**
 * 简单熔断器：连续 N 次 5xx → 冷却 M 秒 → 半开探测
 */
class CircuitBreaker {
  constructor(threshold = 3, cooldownMs = 30000) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.failureCount = 0;
    this.lastFailTime = 0;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
  }

  get isOpen() {
    if (this.state === 'CLOSED') return false;
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > this.cooldownMs) {
        this.state = 'HALF_OPEN';
        console.log('🌡️ 熔断器进入半开状态，允许探测...');
        return false;
      }
      return true;
    }
    return false; // HALF_OPEN → 允许
  }

  success() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  fail() {
    this.failureCount++;
    this.lastFailTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.warn(`🌡️ 熔断器断开！连续 ${this.failureCount} 次失败，冷却 ${this.cooldownMs / 1000} 秒`);
    }
  }

  reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
}

// DeepSeek 专用熔断器单例
const deepseekBreaker = new CircuitBreaker(3, 30000);

/**
 * 解析 DeepSeek SSE 流式响应（含心跳超时保护）
 * @param {Response} fetchResponse - fetch 返回的 Response 对象
 * @param {AbortSignal} signal - 取消信号
 * @param {number} heartbeatMs - 心跳超时(ms)，默认 60 秒无新 chunk 则判定流已死
 * @returns {Promise<{content: string, finishReason: string}>}
 */
const parseSSEStream = async (fetchResponse, signal, heartbeatMs = 60000) => {
  const reader = fetchResponse.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let finishReason = '';
  let buffer = '';
  let chunkCount = 0;
  let reasoningChunkCount = 0;  // 🔧 推理模型：思考链 chunk 计数
  let lastChunkTime = Date.now();

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        throw new Error('aborted');
      }

      // 🔧 心跳超时：reader.read() 与心跳计时器竞速
      //     流持续到达 → 永不超时；N 秒无新数据 → 判定流已死
      let heartbeatTimer;
      try {
        const readResult = await Promise.race([
          reader.read(),
          new Promise((_, reject) => {
            heartbeatTimer = setInterval(() => {
              if (Date.now() - lastChunkTime > heartbeatMs) {
                clearInterval(heartbeatTimer);
                reject(new Error(`SSE 心跳超时：${heartbeatMs / 1000}秒无新数据，流可能已断开`));
              }
            }, 5000);
          })
        ]);
        clearInterval(heartbeatTimer);
        const { done, value } = readResult;

        if (done) break;

        lastChunkTime = Date.now();
        buffer += decoder.decode(value, { stream: true });

        // SSE 事件以 \n\n 分隔
        const lines = buffer.split('\n');
        // 最后一个可能不完整，保留到下次
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6); // 去掉 "data: " 前缀
          if (jsonStr === '[DONE]') {
            finishReason = finishReason || 'stop';
            continue;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            const reasoningDelta = parsed.choices?.[0]?.delta?.reasoning_content;  // 🔧 推理模型思考链
            if (delta) {
              content += delta;
              chunkCount++;
            }
            if (reasoningDelta) {
              reasoningChunkCount++;
            }
            if (parsed.choices?.[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason;
            }
          } catch (parseErr) {
            // 个别 chunk JSON 解析失败不影响整体
            if (jsonStr.length > 10) {
              console.warn('⚠️ SSE chunk JSON 解析失败:', jsonStr.slice(0, 80));
            }
          }
        }
      } catch (innerErr) {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        throw innerErr;
      }
    }

    // 处理 buffer 中剩余的数据
    if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
      try {
        const parsed = JSON.parse(buffer.trim().slice(6));
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) content += delta;
      } catch (e) { /* ignore */ }
    }
  } finally {
    reader.releaseLock();
  }

  console.log(`📡 SSE 流式接收完成: ${chunkCount} 内容chunks + ${reasoningChunkCount} 推理chunks, ${content.length} 字符, finish_reason=${finishReason || '(无)'}`);
  return { content, finishReason };
};

/**
 * 将 fetch 错误标准化为兼容 axios 错误格式的对象
 */
const normalizeFetchError = async (e, response) => {
  // 网络错误（fetch 只在网络失败时抛异常）
  if (e) {
    const normalized = new Error(e.message || '网络请求失败');
    normalized.code = e.name === 'AbortError' ? 'ECONNABORTED' : 'ENOTFOUND';
    normalized.originalError = e;
    return normalized;
  }

  // HTTP 错误（response.ok === false）
  if (response) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch (_) { /* ignore */ }

    const normalized = new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
    normalized.response = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: { error: { message: errorBody } }
    };
    normalized.code = response.status >= 500 ? 'ESERVER' : 'ECLIENT';
    return normalized;
  }

  return new Error('未知请求错误');
};

// ============================================================
// 🔧 五步生成法工具函数：分层注入 + 精准检索 + 格式常量
// ============================================================

/**
 * Step1 指令精简函数：从用户可读的完整指令中提取 AI 需要的关键约束
 * 人读版 instruction（~3000字）→ AI 精简版（≤500字）
 * 只保留：核心任务、结构框架、禁止项、格式关键点
 */
const buildCompactAIInstruction = (fullInstruction, genType, subject, stage, grade) => {
  if (!fullInstruction) return '';
  
  // 按【分段标记】提取关键段落
  const sections = fullInstruction.split(/\n(?=【)/);
  const keepSections = [];
  const dropPrefixes = [
    // 模板对标（逐题 prompt 不需要，模板已通过 templateContext 注入）
    '【模板精准对标】', '【模板真题示例】', '【模板量化特征】',
    '【语言风格指纹', '【格式排版指纹', '【语言风格特征',
    '【模板风格约束', '【模板反例约束',
    // 🔧 这些块在逐题生成中非必要，且会传递过度约束
    '【命题约束】', '【教材章节确认】',
    // 用户补丁
    '【用户补充指令】', '【综合指令】', '【情境要求】'
  ];
  
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    // 跳过模板对标等大段内容
    if (dropPrefixes.some(p => trimmed.startsWith(p))) continue;
    // 保留核心块，但限制长度
    let content = trimmed;
    if (content.length > 800) {
      // 截断长段，只保留前 700 字 + "...(省略)"
      content = content.substring(0, 700) + '...(已精简)';
    }
    keepSections.push(content);
  }
  
  let compact = keepSections.join('\n');
  // 如果仍然超长，二轮截断（预算从1000提升到2500，确保题量/分值/格式等关键规则不被裁掉）
  if (compact.length > 2500) {
    compact = compact.substring(0, 2500) + '\n...(后续指令已精简)';
  }
  
  return compact ? `【关键指令摘要】\n${compact}\n` : '';
};

/**
 * 构建 KP→原文片段的反向索引：从 contentCards 的 segment 中提取所有 KP→segment 映射
 * 分析阶段已由 AI 标注了每个片段的知识点，这里直接建索引即可实现 O(1) 检索
 * @returns {Map<string, {chapterTitle:string, text:string, type:string}[]>}
 */
const buildKpSegmentIndex = (contentCards) => {
  const index = new Map();
  for (const card of contentCards) {
    if (!card.segments || card.segments.length === 0) continue;
    for (const seg of card.segments) {
      const kps = seg.knowledgePoints || [];
      for (const kp of kps) {
        if (!kp || typeof kp !== 'string') continue;
        if (!index.has(kp)) index.set(kp, []);
        const entries = index.get(kp);
        // 去重：相同文本不重复加入
        if (!entries.some(e => e.text === seg.text)) {
          entries.push({ chapterTitle: card.chapterTitle, text: seg.text, type: seg.type || '' });
        }
      }
    }
  }
  return index;
};

/**
 * 蓝图驱动的精准检索：基于分析阶段 KP→原文片段反向索引，O(1) 直接命中
 * 替代原来的 O(n×m) 全量模糊扫描，根源上解决检索不准确问题
 */
const retrieveBlueprintSegments = (contentCards, parsedBlueprint, maxChars = 1500) => {
  if (!contentCards?.length) return '';

  // 🔧 1. 构建反向索引：KP → [{chapterTitle, text, type}]（分析阶段已标注）
  const index = buildKpSegmentIndex(contentCards);
  const allIndexKeys = [...index.keys()];

  // 🔧 2. 从蓝图中提取知识点关键词 + 逐词分解
  const bpKeywords = new Set();
  const bpWordSet = new Set();
  if (parsedBlueprint?.length) {
    for (const bp of parsedBlueprint) {
      if (bp.knowledgePoint) {
        bpKeywords.add(bp.knowledgePoint);
        const words = bp.knowledgePoint.split(/[，,、\s]+/).filter(w => w.length >= 2);
        words.forEach(w => bpWordSet.add(w));
      }
    }
  }

  // 🔧 3. 索引查表：精确 KP 名称 → O(1) 直接命中，无需扫描所有 segments
  const exactMatches = [];
  const fuzzyMatches = [];
  const seenTexts = new Set();
  const matchedKeys = new Set();

  for (const bk of bpKeywords) {
    // 策略 A：精确匹配 → KP 名称直接作为索引 key
    if (index.has(bk)) {
      matchedKeys.add(bk);
      for (const entry of index.get(bk)) {
        if (!seenTexts.has(entry.text)) {
          seenTexts.add(entry.text);
          exactMatches.push({ ...entry, matchScore: 3 });
        }
      }
      continue;
    }
    // 策略 B：包含匹配 → KP 名称包含/被包含于索引 key
    for (const idxKey of allIndexKeys) {
      if (matchedKeys.has(idxKey)) continue;
      if (idxKey.includes(bk) || bk.includes(idxKey)) {
        matchedKeys.add(idxKey);
        for (const entry of index.get(idxKey)) {
          if (!seenTexts.has(entry.text)) {
            seenTexts.add(entry.text);
            fuzzyMatches.push({ ...entry, matchScore: 2 });
          }
        }
      }
    }
  }

  // 🔧 4. 逐词兜底：精确匹配为空时，用逐词重叠匹配索引中的 key
  if (exactMatches.length === 0 && fuzzyMatches.length === 0) {
    for (const idxKey of allIndexKeys) {
      const idxWords = idxKey.split(/[，,、\s]+/).filter(w => w.length >= 2);
      const overlap = idxWords.filter(w => bpWordSet.has(w)).length;
      if (overlap > 0) {
        for (const entry of index.get(idxKey)) {
          if (!seenTexts.has(entry.text)) {
            seenTexts.add(entry.text);
            fuzzyMatches.push({ ...entry, matchScore: Math.min(overlap, 3) });
          }
        }
      }
    }
  }

  // 🔧 5. 学科感知的类型加成
  const allChapterTitles = contentCards.map(c => c.chapterTitle || '').join(' ');
  const isEnglishBook = /英语|english|PEP/i.test(allChapterTitles);
  const isChineseBook = /语文|课文|生字/i.test(allChapterTitles);
  const isMathBook = /数学|math/i.test(allChapterTitles);

  const allMatches = [...exactMatches, ...fuzzyMatches];
  for (const m of allMatches) {
    if (isEnglishBook && m.type?.includes('词汇')) m.matchScore += 2;
    if (isChineseBook && m.type?.includes('生字')) m.matchScore += 2;
    if (isMathBook && m.type === '例题') m.matchScore += 1;
  }

  // 🔧 6. 预算分区输出：特殊段落（词汇表/生字表）优先 + 匹配度排序
  const specialSegments = allMatches.filter(m =>
    m.type === '词汇表' || m.type === '生字表' || m.type?.includes('词汇') || m.type?.includes('生字')
  );
  const regularSegments = allMatches.filter(m => !specialSegments.includes(m));
  regularSegments.sort((a, b) => b.matchScore - a.matchScore);

  const SPECIAL_BUDGET = Math.floor(maxChars * 0.6);
  let result = '';
  let used = 0;

  // 特殊段落（词汇表/生字表）优先
  for (const seg of specialSegments) {
    if (used + seg.text.length > SPECIAL_BUDGET) break;
    const label = seg.type ? ` [${seg.type}]` : '';
    result += `【${seg.chapterTitle}${label}】${seg.text}\n`;
    used += seg.text.length;
  }

  // 常规段落按匹配度填充
  const remainingBudget = maxChars - used;
  if (remainingBudget > 0) {
    for (const seg of regularSegments) {
      if (used + seg.text.length > maxChars) break;
      if (seg.matchScore === 0 && used > remainingBudget * 0.3) break;
      const label = seg.type ? ` [${seg.type}]` : '';
      result += `【${seg.chapterTitle}${label}】${seg.text}\n`;
      used += seg.text.length;
    }
  }

  // 🔧 7. 终极兜底：索引为空或全无匹配时，返回前 maxChars 原文
  if (!result) {
    let fallback = '';
    let fallbackUsed = 0;
    for (const card of contentCards) {
      if (!card.segments || card.segments.length === 0) continue;
      for (const seg of card.segments) {
        if (fallbackUsed + seg.text.length > maxChars) break;
        fallback += `【${card.chapterTitle}】${seg.text}\n`;
        fallbackUsed += seg.text.length;
      }
      if (fallbackUsed >= maxChars) break;
    }
    return fallback;
  }

  return result;
};

// ==================== 年级数字提取工具 ====================
// 🔑 grade 可能是中文（"三年级"）或数字，统一提取数字
const extractGradeNum = (gradeStr) => {
  if (!gradeStr) return 0;
  const num = parseInt(gradeStr);
  if (!isNaN(num)) return num;
  const cnMap = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
  for (const [cn, n] of Object.entries(cnMap)) {
    if (gradeStr.includes(cn)) return gradeStr.startsWith('高') ? 9 + n : n;
  }
  return 0;
};

import { postProcessOCR, _fixTemplateOptionGlue as fixTemplateOptionGlue, countFixes, _addTemplateStructureMarkers as addTemplateStructureMarkers } from '../utils/textRepair.js';
import { SemanticRetriever, semanticRetriever } from '../utils/semanticRetriever.js';

// 别名：保持原有名称兼容
const _isWordBoundaryMatch = undefined; /* replaced by isWordBoundaryMatch import */
const _fixTemplateOptionGlue = fixTemplateOptionGlue;
const _countFixes = countFixes;
const _robustJsonParse = robustJsonParse;
const _addTemplateStructureMarkers = addTemplateStructureMarkers;

//  知识点覆盖率校验（两个调用点共享）
const checkKnowledgeCoverage = (blueprint, km) => {
  if (!Array.isArray(blueprint)) {
    return { covered: 0, total: 0, rate: 0, uncovered: [], duplicatedKPs: [] };
  }
  const allKps = ((km && km.knowledgePoints) || []).map(k => (k || '').trim()).filter(Boolean);
  const bpKps = [...new Set(blueprint.map(q => q && q.knowledgePoint).filter(Boolean))];
  const covered = bpKps.filter(kp => kp && allKps.some(ak => ak && (ak.includes(kp) || kp.includes(ak))));
  const uncovered = allKps.filter(ak => ak && !bpKps.some(bk => bk && (ak.includes(bk) || bk.includes(ak))));
  const kpCount = {};
  blueprint.forEach(q => { const k = q && q.knowledgePoint; if (k) kpCount[k] = (kpCount[k] || 0) + 1; });
  const duplicatedKPs = Object.entries(kpCount).filter(([, c]) => c > 2).map(([k]) => k);
  return {
    covered: covered.length,
    total: allKps.length || 1,
    rate: Math.round(covered.length / (allKps.length || 1) * 100),
    uncovered: uncovered.slice(0, 10),
    duplicatedKPs
  };
};

// ===== 第一步：提取命题素材卡片 =====

// 🔧 R1/推理模型输出清洗：去掉  role="user"  ...  role="assistant"  标签
// DeepSeek-R1 等推理模型会在输出前附加思考过程，格式为  思考内容  或 <think>思考内容</think>
// ===== 🔧 填空格式智能转换：下划线→blank-N横线 + 括号空白→blank-N括号 =====
// 将 AI 输出的合法填空标记（___、括号内空白）按规范转换为 <u class="blank-N">&emsp;</u> / <span class="blank-N">&emsp;</span>
// N 值按空白宽度保守映射（偏小，精确宽度由 AI 显式 blank-N 控制）：≤1em→2, ≤1.5em→3, ≤2em→4, ≤3em→5, ≤4em→6, ≤6em→8, >6em→10
const convertBlankFormat = (html) => {
  if (!html || html.length < 3) return html;

  // ── 步骤1：保护已有的 blank-N 标签，避免重复转换 ──
  // 🔧 使用 \uE000/\uE001 私有区字符替代 __ 作为占位符分隔符，
  //    避免步骤2的 _{3,} 正则误匹配相邻占位符间的连续下划线导致占位符被破坏
  const preserved = [];
  let result = html;
  // 保护 <u class="blank-...">...</u> （注意：不捕获换行属性避免栈溢出）
  result = result.replace(/<u\s+class="blank-\d+"[^>]*>[\s\S]*?<\/u>/gi, (m) => {
    preserved.push(m);
    return `\uE000PPKU${preserved.length - 1}\uE001`;
  });
  // 保护 <span class="blank-...">...</span>
  result = result.replace(/<span\s+class="blank-\d+"[^>]*>[\s\S]*?<\/span>/gi, (m) => {
    preserved.push(m);
    return `\uE000PPKS${preserved.length - 1}\uE001`;
  });

  // ── 步骤1.7a：单边左括号 + 下划线（无右括号）→ <span> ──
  // 先于步骤1.8执行；用负向前瞻排除完整括号对，避免与1.8冲突
  result = result.replace(/(?:[（(])\s*(_{3,})(?!\s*[）)])/g, (match, underscores) => {
    const len = underscores.length;
    let n;
    if (len <= 3) n = 2;
    else if (len <= 4) n = 4;
    else if (len <= 6) n = 6;
    else if (len <= 8) n = 8;
    else n = 10;
    return `<span class="blank-${n}">&emsp;</span>`;
  });

  // ── 步骤1.7b：下划线 + 单边右括号（无左括号）→ <span> ──
  // 负向后瞻排除(..._)完整对；先于1.8执行，已匹配的完整对不受影响
  result = result.replace(/(?<![（(])(_{3,})\s*(?:[）)])/g, (match, underscores) => {
    const len = underscores.length;
    let n;
    if (len <= 3) n = 2;
    else if (len <= 4) n = 4;
    else if (len <= 6) n = 6;
    else if (len <= 8) n = 8;
    else n = 10;
    return `<span class="blank-${n}">&emsp;</span>`;
  });

  // ── 步骤1.8：括号包裹下划线 → <span class="blank-N">&emsp;</span>（谁在外保留谁：括号在外 → 括号填空）──
  // 必须先于步骤2执行，避免内层下划线先被转成 <u> 导致误判
  result = result.replace(/(?:[（(])\s*(_{3,})\s*(?:[）)])/g, (match, underscores) => {
    const len = underscores.length;
    let n;
    if (len <= 3) n = 2;
    else if (len <= 4) n = 4;
    else if (len <= 6) n = 6;
    else if (len <= 8) n = 8;
    else n = 10;
    return `<span class="blank-${n}">&emsp;</span>`;
  });

  // ── 步骤2：裸露下划线 → <u class="blank-N">&emsp;</u>（无外壳包裹 → 横线书写区）──
  result = result.replace(/_{3,}/g, (match) => {
    const len = match.length;
    let n;
    if (len <= 3) n = 2;
    else if (len <= 4) n = 4;
    else if (len <= 6) n = 6;
    else if (len <= 8) n = 8;
    else n = 10;
    return `<u class="blank-${n}">&emsp;</u>`;
  });


  // ── 步骤3：括号内纯空白 → <span class="blank-N">&emsp;</span>（谁在外保留谁：括号在外 → 括号填空）──
  result = result.replace(/(?:[（(])((?:\s|&emsp;|\u2003|&nbsp;| )+)(?:[）)])/g, (match, inner) => {
    // 统计空白宽度：&emsp;/\u2003/\u3000 每字符≈1em，&nbsp;/  每字符≈0.25em
    const emspCount = (inner.match(/&emsp;/gi) || []).length + (inner.match(/\u2003/g) || []).length + (inner.match(/\u3000/g) || []).length;
    const nbspCount = (inner.match(/&nbsp;| /gi) || []).length;
    const totalWidth = emspCount + nbspCount * 0.25;
    if (totalWidth <= 0) return match; // 无有效空白，保持原样
    let n;
    if (totalWidth <= 1) n = 2;
    else if (totalWidth <= 1.5) n = 3;
    else if (totalWidth <= 2) n = 4;
    else if (totalWidth <= 3) n = 5;
    else if (totalWidth <= 4) n = 6;
    else if (totalWidth <= 6) n = 8;
    else n = 10;
    return `<span class="blank-${n}">&emsp;</span>`;
  });

  // ── 步骤3.5：剥离已保护 blank-N 标签外侧的括号 ──
  // 场景：AI 输出 (<span class="blank-N">&emsp;</span>) / (<u class="blank-N">&emsp;</u>)
  // 括号由 CSS ::before/::after 统一渲染（span）或下划线（u），HTML 中重复会导致双重括号
  result = result.replace(/(?:[（(])\s*(PPK[US]\d+)\s*(?:[）)])/g, (m, placeholder) => placeholder);

  // ── 步骤4：还原保护的 blank-N 标签 ──
  result = result.replace(/PPKU(\d+)/g, (m, idx) => preserved[parseInt(idx)] || '');
  result = result.replace(/PPKS(\d+)/g, (m, idx) => preserved[parseInt(idx)] || '');

  return result;
};

// 此函数剥离思考块，只保留最终答案
// 🔧 增强：同时清洗 markdown 代码块包裹和对话式前缀/后缀文本
const cleanReasoningOutput = (text) => {
  if (!text) return '';
  
  // 🔧 抽取统一清洗逻辑（emoji + HTML包裹 + 下划线），在所有 return 路径上调用
  const sanitize = (t) => {
    // 剥离 emoji 表情符号
    t = t.replace(/\p{Emoji_Presentation}/gu, '');
    t = t.replace(/\p{Extended_Pictographic}/gu, '');
    t = t.replace(/[\uFE0F\u200D]/g, '');
    // 剥离 <html>/<head>/<body> 外层包裹
    const bm = t.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bm) t = bm[1].trim();
    t = t.replace(/<\/?html[^>]*>/gi, '');
    t = t.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    t = t.replace(/<\/?body[^>]*>/gi, '');
    t = t.replace(/<!DOCTYPE\s+html[^>]*>/gi, '');
    // 🔧 填空格式智能转换：下划线→blank-N横线 + 括号空白→blank-N括号
    // （替代原来的简单删除——保留 AI 合法输出的填空标记并按规范转换）
    t = convertBlankFormat(t);
    return t.trim();
  };
  
  // ===== 格式A：markdown 代码块提取（处理对话前缀+代码块的情况）=====
  // 匹配 ```html ... ``` 或 ``` ... ```，提取代码块内内容
  // 🔧 使用 [\s\n]* 而非 \s*\n，兼容 AI 在 ```html 后跟空格而非换行的情况
  const mdBlockRegex = /```(?:html?|HTML?)?[\s\n]*([\s\S]*?)\n?```/g;
  const mdBlocks = [];
  let mdMatch;
  while ((mdMatch = mdBlockRegex.exec(text)) !== null) {
    mdBlocks.push(mdMatch[1].trim());
  }
  // 找到了代码块 → 合并所有块内容
  if (mdBlocks.length > 0) {
    const extracted = mdBlocks.join('\n\n');
    if (extracted.length > 20) return sanitize(extracted);
    // 🔧 代码块存在但内容为空/过短（如 AI 返回了 ```html ``` 空壳）
    // 尝试从代码块之外寻找 HTML 内容
    const withoutBlocks = text.replace(/```(?:html?|HTML?)?[\s\n]*[\s\S]*?\n?```/g, '').trim();
    const fallbackHtmlIdx = withoutBlocks.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span)\b/i);
    if (fallbackHtmlIdx >= 0) {
      return sanitize(withoutBlocks.substring(fallbackHtmlIdx));
    }
    // 🔧 代码块为空且外部无HTML → 返回空，触发错误提示而非导出乱码
    return '';
  }
  
  // ===== 格式B：整个文本被 ```html ... ``` 包裹（原有逻辑，保留兼容）=====
  const mdBlockFullMatch = text.match(/^```html?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (mdBlockFullMatch) return sanitize(mdBlockFullMatch[1].trim());
  
  // ===== 格式C：开头有 ```html 但结尾没有 ``` =====
  if (/^```html?\s*\n/.test(text)) {
    text = text.replace(/^```html?\s*\n/, '');
    text = text.replace(/\n?```\s*$/, '');
  }
  
  // ===== 格式D：对话前缀 + HTML 内容（没被代码块包裹的）=====
  // 检测到对话式开头（"这是为""以下是""Here is" 等）且后面跟着 HTML 标签
  const htmlStartIdx = text.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span|u\b|a\b|img|br)\b/i);
  if (htmlStartIdx > 0 && htmlStartIdx < 2000) {
    // 从第一个 HTML 标签开始截取
    text = text.substring(htmlStartIdx);
  }
  // 🔧 去除末尾多余文本：最后一个 > 之后的纯文字（AI 附加的"已修复…"等说明/质检记录）一律剥离，
  //    不再要求必须以 ``` 结尾——只要不含 HTML 标签且非纯空白就截掉
  const lastCloseTag = text.lastIndexOf('>');
  if (lastCloseTag > 0 && lastCloseTag < text.length - 1) {
    const afterLastTag = text.substring(lastCloseTag + 1);
    // 如果末尾剩余内容不含 < 且是纯对话文本（没有 HTML）
    if (!/<[a-zA-Z/]/.test(afterLastTag) && afterLastTag.trim().length > 0) {
      text = text.substring(0, lastCloseTag + 1) + (afterLastTag.includes('\n') ? '\n' : '');
    }
  }
  
  // ===== 格式E：  ...   → 取  之后的内容 =====
  const thinkBlockEnd = text.lastIndexOf('');
  if (thinkBlockEnd !== -1) {
    const afterThink = text.substring(thinkBlockEnd + 8);
    if (afterThink.trim().length > 0) return sanitize(afterThink.trim());
  }
  // ===== 格式F：<think>...</think> → 取 </think> 之后的内容 =====
  const xmlThinkEnd = text.lastIndexOf('</think>');
  if (xmlThinkEnd !== -1) {
    const afterXmlThink = text.substring(xmlThinkEnd + 8);
    if (afterXmlThink.trim().length > 0) return sanitize(afterXmlThink.trim());
  }
  // 没有特殊格式，返回清洗后的文本
  // 🔧 JSON 模式兼容：如果内容是 JSON（{ 或 [ 开头），直接返回，不做 HTML 兜底检查
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return sanitize(trimmed);
  }
  // 🔧 最终兜底：全文无任何HTML标签 → 返回空字符串（触发错误提示而非导出乱码）
  const finalHtmlCheck = text.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span|u\b|a\b|img|br)\b/i);
  if (finalHtmlCheck === -1) {
    // 尝试更宽松的匹配：<!DOCTYPE 或 <html 出现在任意位置
    const looseMatch = text.match(/<(!DOCTYPE\s+html|html[\s>])/i);
    if (looseMatch && looseMatch.index >= 0) {
      return sanitize(text.substring(looseMatch.index));
    }
    // 全文无HTML → 返回空，避免导出乱码
    return '';
  }
  
  return sanitize(text);
};

// ===== 🔧 输出排版兜底：检测 AI 输出是否挤在一个段落 =====
// ═══════════════════════════════════
// 🔴 多单元组卷规范（exam 专用：勾选多个单元时注入）
// ═══════════════════════════════════
export const MULTI_UNIT_EXAM_RULES = [
  '单元权重分配：各单元的考查题量与分值按知识点密度与重难点占比分配，重点单元（知识点多/含重难点）多考，边缘单元少考',
  '单元覆盖均衡：每个单元至少考查其核心知识点，不得整单元只考1题，更不得完全跳过某单元',
  '跨单元综合题：设计1-2道综合题，考查2-3个关联知识点（可跨单元），体现单元间的知识衔接',
  '多单元情境统筹：试卷统一情境/主题线索时，各单元知识点在情境中自然衔接，不得出现明显的拼接感',
];

/**
 * 统计知识图谱中的单元知识点分布，生成多单元组卷约束文本。
 * 仅 exam 且单元数>1 时返回非空；单单元/无图谱返回 ''。
 */
export const buildMultiUnitExamConstraint = (knowledgeMap, isExam) => {
  if (!isExam) return '';
  const graph = knowledgeMap?.knowledgeGraph || [];
  if (!Array.isArray(graph) || graph.length <= 1) return '';
  const unitStats = graph.map(unit => {
    const kpNames = (unit.bigConcepts || []).flatMap(bc => (bc.coreKnowledge || []).map(ck => ck.name)).filter(Boolean);
    return { unit: unit.unit || '未命名单元', kpCount: kpNames.length, kpNames };
  }).filter(u => u.kpCount > 0);
  if (unitStats.length <= 1) return '';
  const totalKps = unitStats.reduce((s, u) => s + u.kpCount, 0);
  let text = `\n---\n【多单元组卷规范——本次覆盖${unitStats.length}个单元，必须遵守】\n`;
  text += `【单元知识点统计】（共${totalKps}个核心知识点，组卷权重按知识点密度分配）\n`;
  unitStats.forEach(u => {
    text += `  - ${u.unit}：${u.kpCount}个知识点（${u.kpNames.slice(0, 6).join('、')}${u.kpNames.length > 6 ? '…' : ''}）\n`;
  });
  MULTI_UNIT_EXAM_RULES.forEach(r => { text += `- ${r}\n`; });
  return text;
};

const detectSquishedOutput = (html, genType = '') => {
  if (!html || html.length < 100) return { squished: false, blockCount: 0 };
  // 统计块级标签数量
  const blockTags = ['<p', '<div', '<h1', '<h2', '<h3', '<h4', '<h5', '<h6', '<li', '<br', '<table', '<ol', '<ul', '<section'];
  let blockCount = 0;
  for (const tag of blockTags) {
    const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = html.match(regex);
    if (matches) blockCount += matches.length;
  }
  // 阈值：内容越长需要越多块级标签
  const minBlocks = Math.max(3, Math.floor(html.length / 300));
  const squished = blockCount < minBlocks;
  if (squished) {
    console.warn(`⚠️ [排版检测] ${genType || '未知类型'} 输出可能挤在段落中：${html.length}字仅${blockCount}个块级标签（需≥${minBlocks}）`);
  }
  return { squished, blockCount, minBlocks };
};

// ===== 🔧 统一输出前置指令：所有资料类型共享的「禁止前言+反Markdown」头 =====
const buildOutputPreamble = () => {
  // 🔧 从指令库三维度匹配注入（通用条目 genType='' 匹配所有类型）
  const blocks = getMatchingBlockInstructions({ category: '生成-输出前置指令', subject: '', stage: '', genType: '' });
  if (blocks.length > 0) return blocks[0].content;
  // 兜底（理论上不会走到这里，指令库有通用条目）
  return `【最终输出指令——优先级最高，覆盖一切其他要求】\n` +
`⛔ 1. 禁止输出任何前言、确认语、解释性文字！严禁出现"好的""收到""我将""根据"等\n` +
`⛔ 2. 直接输出纯 HTML 代码！你的回复第一个字符必须是 <\n` +
`⛔ 3. 输出语言：必须是纯 HTML！严禁使用任何 Markdown 语法！\n` +
`   ❌ 禁止 ### 标题 | **加粗** | |表格| | ---分隔线 | -列表项\n` +
`   ✅ 必须 <h1>-<h6> | <strong> | <p> | <br> | <u class="blank-N"> | <span class="blank-N">\n` +
`   ⚠️ <table> 仅用于数据对比/矩阵型内容，禁止用于日常题目排版或页面布局\n` +
`⛔ 4. 直接返回完整 HTML 代码，不要用 \`\`\`html 标记包裹`;
};

// ===== 🔧 统一输出排版格式块：从指令库查询格式规范，保留结构模板作参考示例 =====
const buildOutputFormatBlock = (genType, subject, stage, grade) => {
  // 按 genType 生成结构模板（保留为 HTML 参考示例）
  const templates = {
    preview: `<h1>课前预习标题</h1>

<h2>一、学习目标</h2>
<p>目标1的描述内容</p>
<p>目标2的描述内容</p>

<h2>二、预习任务</h2>
<h3>任务标题</h3>
<p>任务具体内容，每个独立条目一行</p>
<p>另一个独立条目</p>

<h2>三、预习检测</h2>
<p>题目1的题干内容<u class="blank-2">&emsp;</u>（词语填空用 &lt;u class="blank-N"&gt; 横线标签，选择填空用 &lt;span class="blank-N"&gt; 括号标签）</p>
<p>题目2的题干内容<u class="blank-4">&emsp;</u>（N按答案字数：1/2/4/6/8/10）</p>

<div class="answer-section">
<h2>答案与提示</h2>
<p>题目1答案</p>
<p>题目2答案</p>
</div>`,
    summary: `<!-- ⚠️ 表格仅用于数据对比（知识清单/辨析/星级标注），日常题干/解析用<p>排版 -->
<h1>知识总结标题</h1>

<h2>一、学习目标</h2>
<p>目标描述</p>

<h2>二、核心知识清单</h2>
<table><tr><th>知识点</th><th>核心内容</th><th>考查方式</th></tr>
<tr><td>知识点名称</td><td>具体内容</td><td>考查形式</td></tr></table>

<h2>三、知识辨析与易错提示</h2>
<table><tr><th>常见错误</th><th>正确理解</th></tr>
<tr><td>错误认知</td><td>正确解释</td></tr></table>

<h2>四、典型例题精析</h2>
<div class="example"><p>题干内容（填空用 <u class="blank-2">&emsp;</u> 标记留空处）</p></div>
<div class="analysis"><p>解析内容</p></div>

<h2>五、重难点星级标注</h2>
<table><tr><th>知识点</th><th>难度</th><th>星级与考点说明</th></tr>
<tr><td>Good morning/afternoon 区分</td><td>重点</td><td>⭐⭐⭐ 高频考点，常结合时间情景图考查</td></tr>
<tr><td>字母 Aa-Dd 书写</td><td>重点</td><td>⭐⭐ 中频考点，注意笔顺和占格</td></tr>
<tr><td>小写 b 和 d 区分</td><td>难点</td><td>⭐⭐⭐ 高频易错点</td></tr></table>

<h2>六、记忆方法 / 学习技巧</h2>
<p>1. <strong>时间轴法：</strong>画一个钟表，上午画太阳写 Good morning，下午画云写 Good afternoon。</p>
<p>2. <strong>字母手势法：</strong>左手比 b（拇指朝上），右手比 d（拇指朝上），b 和 d 面对面。</p>
<p>3. <strong>歌曲法：</strong>唱问候歌帮助记忆。</p>`,
    dictation: `<h1>听写默写标题</h1>

<h2>一、字词听写</h2>
<div class="dictation-item"><p>1. 拼音提示 <span class="blank-line">&emsp;&emsp;&emsp;&emsp;</span>（横线书写区）</p></div>
<div class="dictation-item"><p>2. 拼音提示 <span class="blank-line">&emsp;&emsp;&emsp;&emsp;</span></p></div>

<h2>二、句子默写</h2>
<div class="dictation-item"><p>1. 给出上句/标题，下句书写区 <span class="blank-line">&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;</span></p></div>

<div class="answer-section">
<h2>答案</h2>
<p>答案内容</p>
</div>`,
    reading: `<h1>阅读训练标题</h1>

<div class="reading-passage">
<p>短文段落1内容</p>
<p>短文段落2内容</p>
</div>

<h2>阅读理解题</h2>
<ol>
<li><p>题目1题干</p><p class="option">A. 选项</p><p class="option">B. 选项</p></li>
<li><p>题目2题干（填空题用 <u class="blank-4">&emsp;</u> 标记留空）</p></li>
</ol>

<div class="answer-section">
<h2>答案与解析</h2>
<p>题目1答案</p>
</div>`,
    errorbook: `<h1>错题本标题</h1>

<div class="error-item">
<h3>错题1：知识点名称</h3>
<p class="question">原题题干</p>
<div class="error-reason"><h4>❌ 错误归因</h4><p>错误原因分析</p></div>
<div class="correct-solution"><h4>✅ 正确解法</h4><p>正确解题步骤</p></div>
<div class="variant-practice"><h4>🔄 变式巩固</h4><p>变式题目（如有填空用 <u class="blank-2">&emsp;</u> 标记留空处）</p></div>
</div>`,
    exam: `<h1>试卷标题</h1>
<div class="exam-info"><p>考试信息</p></div>

<h2>一、选择题</h2>
<p class="question">1. 题干内容<span class="blank-2">&emsp;</span></p>
<p class="option">A. 选项A</p>
<p class="option">B. 选项B</p>
<p class="option">C. 选项C</p>
<p class="option">D. 选项D</p>

<h2>二、填空题</h2>
<p class="question">2. 题干<u class="blank-2">&emsp;</u>内容</p>

<h2>三、综合题（多级编号示例）</h2>
<p class="question">3. 综合题题干（含子题）：</p>
<p class="question">(1) 子题一的题干内容</p>
<p class="question">(2) 子题二的题干内容</p>

<div class="answer-section">
<h2>答案与解析</h2>
<p>1. 答案 | 2. 答案 | 3.(1) 答案 | 3.(2) 答案</p>
</div>`,
    practice: `<h1>课时练习标题</h1>
<div class="practice-info"><p>年级 学科 课时练习</p></div>

<h2>一、基础巩固</h2>
<p class="question">1. 题干内容<u class="blank-2">&emsp;</u>（词语填空用 &lt;u class="blank-N"&gt; 横线标签，选择填空用 &lt;span class="blank-N"&gt; 括号标签）</p>
<p class="question">2. 题干内容<span class="blank-2">&emsp;</span></p>
<p class="option">A. 选项A</p>
<p class="option">B. 选项B</p>
<p class="option">C. 选项C</p>
<p class="option">D. 选项D</p>

<h2>二、能力提升</h2>
<p class="question">3. 题干内容</p>
<p class="question">4. 综合题题干（含子题）：</p>
<p class="question">(1) 子题一的题干内容</p>
<p class="question">(2) 子题二的题干内容</p>

<h2>三、拓展探究</h2>
<p class="question">5. 开放性题目内容</p>

<div class="answer-section">
<h2>答案与解析</h2>
<p>1. 答案 | 2. 答案 | 3. 答案 | 4.(1) 答案 | 4.(2) 答案 | 5. 答案</p>
</div>`,
    special: `<h1>专项训练标题</h1>
<div class="practice-info"><p>年级 学科 专项训练</p></div>

<h2>一、方法指导</h2>
<p>该类题型的解题思路或方法说明</p>

<h2>二、例题精讲</h2>
<p class="question">1. 例题题干</p>
<p class="analysis">解题步骤与思路分析</p>

<h2>三、阶梯训练</h2>
<p class="question">2. 基础题题干<u class="blank-2">&emsp;</u>（词语填空用 &lt;u class="blank-N"&gt; 横线标签，选择填空用 &lt;span class="blank-N"&gt; 括号标签）</p>
<p class="question">3. 拔高题题干</p>
<p class="question">4. 综合题题干（含子题）：</p>
<p class="question">(1) 子题一</p>
<p class="question">(2) 子题二</p>

<div class="answer-section">
<h2>答案与解析</h2>
<p>1. 答案 | 2. 答案 | 3. 答案 | 4.(1) 答案 | 4.(2) 答案</p>
</div>`
  };
  // 🔧 根修复：逐题生成类 genType（exam/practice/special）默认 fallback 为 exam 模板
  const template = templates[genType] || templates.exam;
  
  // 🔧 从指令库三维度查询格式规范，替代硬编码规则（避免与 buildCompactAIInstruction 注入的指令库内容冲突）
  const formatBlocks = getMatchingBlockInstructions({ 
    category: '生成-输出格式', 
    subject: subject || '', 
    stage: stage || '', 
    genType 
  });
  
  const formatSpecs = formatBlocks.length > 0 
    ? '【输出格式规范】\n' + formatBlocks.map(b => b.content).join('\n')
    : '';
  
  return formatSpecs +
    (formatSpecs ? '\n\n' : '') +
    `【输出结构模板——以下为参考示例，实际内容请根据指令自行设计】\n${template}`;
};

// ===== 🔧 genType 感知的逐题 Prompt Builder =====
// 为 exam/practice/special 三种 genType 构建语义匹配的逐题生成 prompt
const buildPerQuestionPrompt = (questionPlan, genType, ctx) => {
  const {
    situationAnchor = '',
    contextSummary = '',
    styleConsistencyHint = '',
    materialContext = '',
    templateContext = '',
    typeRule = '',
    integratedContext = '',
    selectedTemplates,
    instruction = '',
    selectedBooks,
    stage = '',
    diversitySeed = '',
  } = ctx;

  // ── genType 感知：题目定位 ──
  const roleMap = {
    exam: `你是一位命题专家，请命制一道考试题。`,
    practice: `你是一位教学设计者，请设计一道课时配套练习题。`,
    special: `你是一位专项训练设计者，请设计一道专项训练题。`,
  };
  const role = roleMap[genType] || roleMap.exam;

  // ── genType 感知：难度框架 ──
  const diffFrameMap = {
    exam: `基础/中档/提高——三道难度梯度确保考试区分度`,
    practice: `基础巩固/能力提升/拓展探究——三道层级体现教学练评一致性`,
    special: `入门练/进阶练/挑战练——三道阶梯实现专项能力突破`,
  };
  const diffFrame = diffFrameMap[genType] || diffFrameMap.exam;

  // ── genType 感知：质量侧重点 ──
  const qualityMap = {
    exam: `【考试题质量要求】
- 试题需有合理区分度，基础题确保大多数学生能做对，提高题能区分优秀学生
- 答案必须无争议，不得出现模棱两可的表述
- 综合题应体现知识综合运用能力而非简单堆砌`,
    practice: `【课时练习质量要求】
- 题目必须与教材内容高度一致，不超纲、不偏题
- 基础巩固题紧贴教材原题，能力提升题在原题基础上适当变式，拓展探究题联系生活实际
- 题量适中，适合学生在当堂或课后完成，单题解答时间约2-5分钟`,
    special: `【专项训练质量要求】
- 题目必须围绕专项知识点展开，覆盖该知识点的各种考查角度
- 从最简单考查方式开始，逐步增加难度，形成清晰的思维训练梯度
- 典型方法和解题模型要覆盖完整，让学生通过训练掌握解题套路`,
    review: `【复习资料质量要求】
- 必须设置“知识框架”板块（板块标题须含“知识框架/思维导图/知识树”字样），用表格或列表呈现单元知识体系/专题整合
- 必须包含至少3道“典型题”（题目小标题或题号前须标注“典型题”或“例题”字样），每道配完整解析，涵盖该知识点的常见考查角度和变式
- 易错点辨析必须精确，给出错误原因和正确理解
- 综合自测题难度梯度合理，能真实检验复习效果`,
  };
  const qualityBlock = qualityMap[genType] || '';

  // ── 模板语言风格约束（题型专属 profile）──
  const typeProfileHint = (() => {
    const tpl = selectedTemplates?.[0];
    const profiles = tpl?.analysis?.typeLanguageProfiles;
    if (!profiles || !questionPlan.type) return '';
    const profile = profiles[questionPlan.type];
    if (!profile) return '';
    let hint = '\n【模板语言风格约束——本题型专属】\n';
    if (profile.avgStemLength) hint += `- 参考题干长度：约${profile.avgStemLength}字（±20%）\n`;
    if (profile.commonPatterns?.length) hint += `- 参考句式开头：${profile.commonPatterns.slice(0, 2).join('、')}\n`;
    if (profile.hasPlease) hint += `- 该题型在模板中常用"请"引导\n`;
    if (profile.hasTry) hint += `- 该题型在模板中常用"试"引导\n`;
    if (profile.hasKnown) hint += `- 该题型在模板中常用"已知"陈述\n`;
    if (profile.avgOptions && questionPlan.type === '选择题') hint += `- 参考选项数：${profile.avgOptions}个\n`;
    if (profile.sampleStem) hint += `- 典型题干示例：「${profile.sampleStem}」\n`;
    return hint;
  })();

  // ── 模板全局语言风格（无专属 profile 时降级）──
  const globalStyleHint = (() => {
    const tpl = selectedTemplates?.[0];
    const profiles = tpl?.analysis?.typeLanguageProfiles;
    const hasTypeProfile = profiles && profiles[questionPlan.type];
    if (hasTypeProfile) return '';
    const ls = tpl?.analysis?.languageStyle;
    if (!ls) return '';
    let hint = '\n【模板全局语言风格约束】\n';
    if (ls.avgSentenceLength) hint += `- 参考句长：约${ls.avgSentenceLength}字\n`;
    if (ls.tone) hint += `- 语气：${ls.tone}\n`;
    if (ls.sampleSentence) hint += `- 风格参考：「${ls.sampleSentence}」\n`;
    return hint;
  })();

  // ── 指令压缩注入 ──
  const compactInst = (() => {
    const eb = selectedBooks?.find(b => b.subject) || selectedBooks?.[0];
    const es = eb?.subject ? normalizeSubjectName(eb.subject, stage) : '';
    const eg = eb?.grade || '';
    return instruction ? buildCompactAIInstruction(instruction, genType, es, stage, eg) : '';
  })();

  // ── 分值行（仅 exam）──
  const scoreLine = genType === 'exam' ? `- 分值：${questionPlan.score}分\n` : '';

  // ── 标注行（仅 exam）──
  const annotationLine = genType === 'exam'
    ? `- 在这道题后标注：【知识点：${questionPlan.knowledgePoint}】【难度：${questionPlan.difficulty}】\n`
    : '';

  return `${role}
${diversitySeed ? '\n' + diversitySeed + '\n' : ''}
${situationAnchor}
${contextSummary}
${styleConsistencyHint}
⚠️ 【反雷同指令——每题保持适度的多样性】你的设问方式、场景选择应自然丰富，避免与前面题目使用完全相同的非标准题干开头句式。但排版格式（标题层级、选项排列、括号位置等）必须与整体保持一致，不得因追求多样性而随意改变排版规范。
【题目要求】
- 题号：${questionPlan.number}
- 题型：${questionPlan.type}
- 考查知识点：${questionPlan.knowledgePoint}
- 认知层次：${questionPlan.cognitiveLevel || '理解'}
- 难度：${questionPlan.difficulty}（${diffFrame}）
${scoreLine}- 对应章节：${questionPlan.sourceChapter}
${integratedContext}

${materialContext}
${templateContext}
${typeRule}
${typeProfileHint}
${globalStyleHint}

【防幻觉约束——必须遵守】
1. ⛔ 以"${questionPlan.knowledgePoint}"为核心考查点，可自然关联前置知识，但不得偏离主线目标
2. ⛔ 题干中涉及的数据、公式、概念必须与教材一致，不得自行编造
3. ⛔ 答案必须是确定且正确的，不能模棱两可
4. ⛔ 禁止"下列说法正确的是""以上都是/以上都不对"等无信息量设问
5. ⛔ 不得出现科学性错误（数据/公式/概念/单位必须准确）
6. ⛔ 禁止"略""见教材""自行查阅"等占位符

${qualityBlock}

${compactInst}
🔴 答案规则：本题需包含答案与解析，用HTML注释包裹：<!-- answer:正确答案 | 解析:解题思路 -->
请只生成这一道题，格式为HTML片段：
- 🔴 字号铁律：所有正文内容（题干/选项/填空/解答区）必须使用统一字号（<p>/<li>标签默认大小），严禁因题目含子题、嵌套层级而缩小任何文字的字号。层级通过编号格式区分，不通过字号区分
- 🔴 若本题为综合题（含多个子小题），子小题编号必须用"(1)(2)(3)"或"①②③"格式

⛔ 【禁止模式——以下写法会导致排版崩溃，严禁使用！】
❌ 错误：<p class="question">${questionPlan.number}. 大题</p>
          <p style="margin-left:20px;font-size:14px;">1. 小题</p> ← 编号重复！缩进导出Word丢失！
          <p style="margin-left:20px;font-size:14px;">2. 小题</p> ← 小字号破坏统一排版！
✅ 正确：<p class="question">${questionPlan.number}. 大题</p>
          <p class="question">(1) 小题</p> ← 编号格式不同，无需缩进或缩字号
          <p class="question">(2) 小题</p>
- 题号用 <span class="question-number">${questionPlan.number}.</span>
- 题干用 <p class="question">
- 选择题选项用 <p class="option">，题干末尾必须附带答案括号 <span class="blank-2">&emsp;</span>（CSS自动渲染括号）
- 🎯 **填空题标记智能选择**（含手写余量，已上调一档）：根据答案类型和长度选择：
  * 1字→ <u class="blank-2">&emsp;</u>
  * 2字→ <u class="blank-4">&emsp;</u>
  * 3-4字→ <u class="blank-6">&emsp;</u>
  * 5-6字→ <u class="blank-8">&emsp;</u>
  * 7-10字→ <u class="blank-10">&emsp;</u>
  * 10字以上→ <u class="blank-10">&emsp;</u>
- ⛔ **括号填空**：必须用 <span class="blank-N">&emsp;</span>（CSS自动渲染括号），严禁在括号内用 <u>！横线与括号二选一，不可叠加！
  * N按答案字数精确映射：1字→3, 2字→4, 3-4字→6, 5-6字→8, 7+字→10
  * ✅ 正确：<span class="blank-2">&emsp;</span>  ❌ 错误：<u class="blank-2">&emsp;</u> ← 严禁括号内出现下划线！
  * 🔴 括号由CSS ::before/::after自动渲染，HTML中切勿添加 ( ) 或 （ ）包围 blank-N 标签！
- 方框：<span class="square-box">&emsp;</span>
- 如果是解答题，用 \u003cbr\u003e 换行或 \u003cdiv style=\"min-height:80px\"\u003e\u003c/div\u003e 留出书写空间，⛔ 严禁用 blank-N 或 blank-line 做解答区
- 🎯 **特殊标记规范**（重要！）：
  * 需要强调的文字用 <strong>加粗</strong>
  * 需要下划线的文字用 <u>下划线</u>
  * 需要删除线的文字用 <del>删除线</del>
  * ⭐ "加点字"处理：用 <span class="emphasis-dot">字</span> 标记，CSS会自动在字下方显示点(·)
    示例：下列词语中，<span class="emphasis-dot">和</span>平的读音...
  * ⭐ "画线句子"处理：用 <u class="underline-sentence">完整句子</u> 标记
    示例：请赏析<u class="underline-sentence">春风又绿江南岸</u>的表达效果
  * ⭐ "上标"处理：用 <sup class="superscript">内容</sup> 或 <span class="superscript">内容</span>
    示例：x<sup class="superscript">2</sup> (x的平方), v<sub class="subscript">0</sub> (初速度)
  * ⭐ "下标"处理：用 <sub class="subscript">内容</sub> 或 <span class="subscript">内容</span>
    示例：H<sub class="subscript">2</sub>O (水), CO<sub class="subscript">3</sub><sup class="superscript">2-</sup> (碳酸根)
  * ⭐ "拼音标注"处理：用 <ruby>汉字<rt>pīnyīn</rt></ruby>
    示例：<ruby>重<rt>zhòng</rt></ruby>量, <ruby>春<rt>chūn</rt></ruby>天
  * ⭐ "特殊数学符号"处理：直接使用Unicode字符，不要用LaTeX或图片
    - 度数：° (如 90°, 45°)
    - 约等于：≈ (如 π ≈ 3.14)
    - 不等于：≠ (如 x ≠ 0)
    - 小于等于：≤ (如 x ≤ 10)
    - 大于等于：≥ (如 x ≥ 5)
    - 正负号：± (如 ±5)
    - 乘号：× (如 3 × 4 = 12)
    - 除号：÷ (如 12 ÷ 3 = 4)
    - 三角形：△ (如 △ABC)
    - 角：∠ (如 ∠ABC = 90°)
    - 平行：∥ (如 AB ∥ CD)
    - 垂直：⊥ (如 AB ⊥ CD)
    - 圆周率：π (如 C = 2πr)
    - 无穷大：∞
    - 根号：√ (如 √2, √(a+b))
- 保留原文的空白缩进和换行
${annotationLine}【输出格式确认——生成前最后检查】
- ✅ 选择题：题干末尾必须有答案括号 <span class="blank-2">&emsp;</span>（CSS自动渲染括号），选项用 <p class="option">
- ✅ 填空题：下划线用 <u class="blank-N">，括号用 <span class="blank-N">
- ✅ 字号：所有正文统一字号，层级仅通过编号格式区分，不通过字号区分
- ✅ 禁止：Markdown 语法、前言/确认语、解释性文字
只返回这一道题的HTML代码，不要添加\`\`\`html标记。`;
};

const extractContentCards = async (selectedBooks, callAI, robustJsonParse, updateStatus) => {
  const stepConfig = await getCurrentEngineConfigEnhanced('analysis');
  const stepModelName = getModelDisplayName(stepConfig.textModel || stepConfig.model);
  if (updateStatus) updateStatus(`第一步：逐课提取命题素材 [${stepModelName}]...`, 5);
  const contentCards = [];
  if (!selectedBooks || selectedBooks.length === 0) return contentCards;

  // 🔧 词边界匹配：防止"分数"误匹配"分数线""百分数"
  const wordBoundaryMatch = (text, keyword) => {
    if (!text || !keyword) return false;
    if (keyword.length >= 4) return text.includes(keyword);
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const idx = text.indexOf(keyword, searchFrom);
      if (idx === -1) return false;
      const charBefore = idx > 0 ? text[idx - 1] : '';
      const charAfter = idx + keyword.length < text.length ? text[idx + keyword.length] : '';
      const isBoundary = (ch) => ch === '' || /[\s,，。；;、：:！!？?（）()【】《》""''\[\]{}]/.test(ch);
      if (isBoundary(charBefore) && isBoundary(charAfter)) return true;
      searchFrom = idx + 1;
    }
    return false;
  };

  // 🔧 短段合并：连续 <100 字的段合并为一段，减少 AI 调用次数
  // 例如 48段×40字 → ~6段×300字，API 调用从 16 次降到 2 次
  const mergeShortSegments = (segs, shortThreshold = 100, maxLen = 500) => {
    const result = [];
    let i = 0;
    while (i < segs.length) {
      const seg = segs[i];
      if (seg.length >= shortThreshold) {
        // 长段独立保留
        result.push(seg);
        i++;
      } else {
        // 短段：向后合并连续短段，直到超长或遇到长段
        let merged = seg;
        i++;
        while (i < segs.length && segs[i].length < shortThreshold && merged.length + segs[i].length + 1 <= maxLen) {
          merged += '\n' + segs[i];
          i++;
        }
        result.push(merged);
      }
    }
    return result;
  };

  for (const book of selectedBooks) {
    const chapters = book.selectedChapters || [];
    for (const chapter of chapters) {
      if (!chapter.rawText && !chapter.coreTopics) continue;
      let cleanRawText = chapter.rawText || '';

      // 🔧 检测原文是否被修改过（如用户粘贴了词汇表）
      // 优先：哈希精确比对（新数据 → 内容完全一致 → 绝对走捷径）
      // 兜底：长度比对（旧数据兼容 → 差≤300 即视为未变）
      const djb2 = (str) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return (hash >>> 0).toString(36);
      };
      const hashMatch = chapter._analyzedTextHash && djb2(cleanRawText) === chapter._analyzedTextHash;
      const analyzedTextLen = chapter._analyzedPlainTextLength || 0;
      const rawLen = cleanRawText.length;
      const strippedLen = cleanRawText.replace(/<[^>]*>/g, '').length;
      const lenMatch = analyzedTextLen > 0
        && Math.abs(rawLen - analyzedTextLen) <= 300
        && Math.abs(strippedLen - analyzedTextLen) <= 300;
      const textChangedSinceAnalysis = !hashMatch && !lenMatch;
      
      // 🔧 公式标记（便于AI识别数学内容）
      const hasFormula = (text) => /[\$\^\\]|sqrt|frac|sum|int|lim|alpha|beta|gamma|theta|pi/.test(text);
      cleanRawText = cleanRawText.replace(/([\$\^\\]|sqrt|frac|sum|int|lim|alpha|beta|gamma|theta|pi)/g, '[FORMULA]$1[/FORMULA]');
      if (/\|.*\|.*\|/.test(cleanRawText)) {
        cleanRawText = cleanRawText.replace(/(\|[^\n]+\|)/g, '[TABLE]$1[/TABLE]');
      }
      cleanRawText = cleanRawText.replace(/^(\d+[\.、]\s+.+)$/gm, '[HEADING]$1[/HEADING]');
      
      if (chapter.analyzed && chapter.knowledgeHierarchy?.length > 0 && !textChangedSinceAnalysis) {
        console.log(`📦 [Step1捷径] ${chapter.title}: analyzed=${chapter.analyzed} hierarchy=${chapter.knowledgeHierarchy?.length || 0}个 textLen=${rawLen}`);
        // 🔧 直接从 knowledgeHierarchy 提取结构化知识点，不再依赖词边界匹配
        // 原因：语文学科的教学概念（"生字认读""词语理解"）不会作为文字出现在课文中
        const structuredKps = [];
        const kpCognitiveMap = {};
        for (const bigConcept of chapter.knowledgeHierarchy) {
          for (const core of (bigConcept.coreKnowledge || [])) {
            if (core.name && !structuredKps.includes(core.name)) {
              structuredKps.push(core.name);
              kpCognitiveMap[core.name] = core.level || core.cognitiveLevel || '理解';
            }
            for (const sc of (core.specificConcepts || [])) {
              if (sc && !structuredKps.includes(sc)) {
                structuredKps.push(sc);
                kpCognitiveMap[sc] = '识记';
              }
            }
          }
        }
        const displayKps = structuredKps.length > 0 ? structuredKps : [chapter.title];
        // 🔧 分段匹配 + KP→片段关联：为 Step 4 检索构建精确的 KP→原文映射
        const rawSegments = splitTextIntoSegments(cleanRawText, 500);
        const segments = mergeShortSegments(rawSegments);
        const segmentCards = segments.map(segText => {
          const matchedKps = [];
          for (const bigConcept of chapter.knowledgeHierarchy) {
            for (const core of (bigConcept.coreKnowledge || [])) {
              // 🔧 匹配核心知识点名称（不仅是具体概念）
              if (core.name && wordBoundaryMatch(segText, core.name)) {
                if (!matchedKps.includes(core.name)) matchedKps.push(core.name);
              }
              for (const sc of (core.specificConcepts || [])) {
                if (wordBoundaryMatch(segText, sc) && !matchedKps.includes(sc)) matchedKps.push(sc);
              }
            }
          }
          // 🔧 段落类型启发式检测（对齐 AI 标注的类型）
          let segType = '正文';
          if (segText.includes('例') || /^例\d+/.test(segText)) segType = '例题';
          else if (segText.includes('练习') || segText.includes('习题')) segType = '练习';
          else if (segText.includes('小结') || segText.includes('回顾') || segText.includes('总结')) segType = '小结';
          // 英语词汇表检测：英文-中文对密集出现
          const wordPairs = segText.match(/[a-zA-Z]+[\s\-—]+[\u4e00-\u9fa5]+/g);
          if (wordPairs && wordPairs.length >= 3) segType = '词汇表';
          // 语文生字表检测
          if (/[\u4e00-\u9fa5]\s+[\u4e00-\u9fa5]/.test(segText) && segText.length < 200 && !segText.includes('。')) segType = '生字表';
          return {
            text: segText, knowledgePoints: matchedKps.length > 0 ? matchedKps : [chapter.title],
            type: segType,
            isKeyConcept: matchedKps.length > 0, isExample: segText.includes('例'), isExercise: segText.includes('练习'),
            suggestedQuestionTypes: [], hasFormula: hasFormula(segText)
          };
        });
        const keySegments = segmentCards.filter(s => s.isKeyConcept);
        contentCards.push({ chapterTitle: chapter.title, summary: chapter.coreTopics || displayKps.slice(0, 5).join('、'),
          knowledgePointsForTest: displayKps.slice(0, 20).map(kp => ({ name: kp, cognitiveLevel: kpCognitiveMap[kp] || '理解' })),
          adaptableMaterials: keySegments.slice(0, 5).map(s => s.text.substring(0, 100)),
          suggestedQuestionTypes: [...new Set(chapter.knowledgeHierarchy.flatMap(bc => (bc.coreKnowledge || []).flatMap(ck => ck.suggestedQuestionTypes || [])))].slice(0, 8),
          // 🔧 保留完整的 KP→片段映射，供 Step 4 精准检索（Step 2 只用 totalSegments 不遍历 segments）
          segments: segmentCards, totalSegments: segmentCards.length, tags: displayKps.slice(0, 10) });
        continue;
      }
      const rawSegments = splitTextIntoSegments(cleanRawText, 500);
      const segments = mergeShortSegments(rawSegments);
      const segmentCards = [];
      console.log(`🤖 [Step1完整AI] ${chapter.title}: analyzed=${chapter.analyzed} hierarchy=${chapter.knowledgeHierarchy?.length || 0}个 segments=${segments.length}(原始${rawSegments.length}) rawText=${cleanRawText.length}字`);

      // 🔧 收集候选知识点名称，确保命名一致
      const candidateKpNames = [];
      if (chapter.knowledgePoints?.length) { candidateKpNames.push(...chapter.knowledgePoints); }
      else if (chapter.knowledgeHierarchy?.length) {
        for (const bc of chapter.knowledgeHierarchy) {
          for (const ck of (bc.coreKnowledge || [])) {
            candidateKpNames.push(ck.name);
            if (ck.specificConcepts) candidateKpNames.push(...ck.specificConcepts);
          }
        }
      }
      const uniqueCandidates = [...new Set(candidateKpNames)].slice(0, 20);

      for (let batchStart = 0; batchStart < segments.length; batchStart += 3) {
        const batchSegments = segments.slice(batchStart, batchStart + 3);
        const batchText = batchSegments.map((seg, i) => `[段${batchStart + i + 1}] ${seg}`).join('\n\n---\n\n');
        // 🔧 从指令库获取候选知识点命名规范
        const candidateKpNamesRule = getMatchingBlockInstructions({ category: '分析-知识图谱构建' }).find(b => b.id.includes('candidate_kp_names'));
        const candidateKpNote = candidateKpNamesRule ? candidateKpNamesRule.content : '⚠️ 知识点名称必须与以上列表一致的命名风格，不要自创不同名称指代同一概念';
        const candidateHint = uniqueCandidates.length > 0
          ? `【候选知识点名称——必须从以下列表中选择，或保持命名风格一致】\n${uniqueCandidates.join('、')}\n${candidateKpNote}\n` : '';
        
        // 🔧 学科×学段二维智能适配：15个学科全覆盖，每个学科只看自己的提取规则
        const rawSubj = (book.subject || '');
        const stageStr = (book.stage || '');
        
        // 学科识别（含别名兼容：政治→道德与法治/思想政治，信息科技→信息技术）
        const isChinese = rawSubj.includes('语文');
        const isMath = rawSubj.includes('数学');
        const isEnglish = rawSubj.includes('英语');
        const isPhysics = rawSubj.includes('物理');
        const isChemistry = rawSubj.includes('化学');
        const isBiology = rawSubj.includes('生物');
        const isScience = rawSubj.includes('科学');  // 小学科学
        const isHistory = rawSubj.includes('历史');
        const isGeography = rawSubj.includes('地理');
        const isPolitics = rawSubj.includes('政治') || rawSubj.includes('道德') || rawSubj.includes('思想');
        const isIT = rawSubj.includes('信息');
        const isMusic = rawSubj.includes('音乐');
        const isArt = rawSubj.includes('美术');
        const isPE = rawSubj.includes('体育');
        
        // 理科/文科分组
        const isScienceGroup = isPhysics || isChemistry || isBiology || isScience;
        const isHumanitiesGroup = isHistory || isGeography || isPolitics;
        
        // 学段识别
        const gradeNum = extractGradeNum(book.grade || '');
        const isPrimary = stageStr.includes('小学');
        const isJunior = stageStr.includes('初中');
        const isSenior = stageStr.includes('高中');
        const isLowerGrade = isPrimary && gradeNum > 0 && gradeNum <= 2;
        const isMidGrade = isPrimary && gradeNum >= 3 && gradeNum <= 4;
        const isUpperGrade = isPrimary && gradeNum >= 5;
        
        let subjectRules = '';
        if (isChinese) {
          subjectRules = `【语文学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📝 生字/生词：每个生字独立标注（如"人""口""手"），绝不合并
- 📝 多音字：标注每个读音和组词（如"长(cháng)长短/长(zhǎng)长大"）
- 📝 近义词/反义词：成对标注，注明辨析要点
- 📝 重点词语/成语/俗语/歇后语：逐词标注含义和用法
- 📝 需背诵段落/古诗/名句/文言文：标注篇名和范围
- 📝 课文内容理解：主旨、人物形象、事件脉络、道理、情感
- 📝 修辞手法：比喻、拟人、排比、夸张、反问、设问等
- 📝 标点符号用法与病句修改考点
- 📝 阅读理解考点：词语理解、句子含义、内容概括、结构分析
- 📝 写作/口语交际/综合性学习/名著导读要求
${isLowerGrade ? '- 🔧 低段(1-2)：拼音、笔画笔顺、偏旁部首、看图写话、简单日记\n' : ''}${isMidGrade ? '- 🔧 中段(3-4)：段落大意、习作、简单修辞、观察日记\n' : ''}${isUpperGrade ? '- 🔧 高段(5-6)：文言文入门、说明文阅读、读后感\n' : ''}${isJunior ? '- 🔧 初中：文言文实词虚词、古诗词鉴赏、议论文/说明文阅读\n' : ''}${isSenior ? '- 🔧 高中：文言文特殊句式、诗歌鉴赏手法、论述类/文学类文本阅读\n' : ''}`;
        } else if (isMath) {
          subjectRules = `【数学学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 🔢 概念/定义：每个数学概念独立标注
- 🔢 公式/定理/运算法则/性质：逐条标注，注明适用条件
- 🔢 计算方法/解题步骤/证明思路：标注关键步骤
- 🔢 例题：标注考查的知识点和解题方法
- 🔢 几何图形：性质、判定、计算公式
- 🔢 统计与概率：数据收集、图表解读、概率计算
- 🔢 应用题类型与解题策略
- 🔢 数学术语/符号/单位
- 🔢 课后练习/习题中考查的题型和能力层次
${isLowerGrade ? '- 🔧 低段(1-2)：数的认识、20以内加减、图形认识、口算、钟表\n' : ''}${isMidGrade ? '- 🔧 中段(3-4)：乘除法、分数初步、周长面积、简单应用题\n' : ''}${isUpperGrade ? '- 🔧 高段(5-6)：小数分数运算、方程、几何计算、复合应用题\n' : ''}${isJunior ? '- 🔧 初中：代数运算、几何证明、函数初步、统计与概率\n' : ''}${isSenior ? '- 🔧 高中：函数、数列、立体几何、概率统计、导数、向量\n' : ''}`;
        } else if (isEnglish) {
          subjectRules = `【英语学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📕 词汇表/单词表：每个词条（英文+中文释义）独立标注，逐条列出，不得遗漏任何一个
- 📕 重点句型：每个句型独立标注（如"What's your name?""I like...""There be..."）
- 📕 语法点：时态、语态、句型结构、词性、从句等逐条标注
- 📕 对话/短文：标注主题、关键表达、交际功能
- 📕 发音/拼读规则：自然拼读、音标、重音、连读等
- 📕 听力材料中的关键信息和考查点
- 📕 阅读理解策略与完形填空考点
- 📕 书面表达/写作话题与常用表达
- 📕 文化知识/跨文化交际内容
- 📕 教材各板块：Let's learn/Talk/Spell/Read/Write/Story等全部提取
${isLowerGrade ? '- 🔧 低段(1-2)：字母、简单单词、日常问候、歌曲歌谣、颜色数字\n' : ''}${isMidGrade ? '- 🔧 中段(3-4)：对话理解、短文阅读、简单语法、词汇拼写\n' : ''}${isUpperGrade ? '- 🔧 高段(5-6)：篇章阅读、时态综合、简单写作\n' : ''}${isJunior ? '- 🔧 初中：完形填空、阅读理解、书面表达、语法系统\n' : ''}${isSenior ? '- 🔧 高中：深层阅读、语法填空、读后续写、概要写作\n' : ''}`;
        } else if (isScienceGroup) {
          const subjLabel = isPhysics ? '物理' : isChemistry ? '化学' : isBiology ? '生物' : '科学';
          subjectRules = `【${subjLabel}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 🔬 概念/定义/定律/原理：每个独立标注，注明内涵
- 🔬 公式/方程式/化学式：逐条标注${isChemistry ? '，配平和反应条件' : ''}
- 🔬 实验：目的、器材、步骤、现象、结论、注意事项
- 🔬 计算题考查点和公式应用
- 🔬 图表/数据/示意图的解读要点
- 🔬 ${isPhysics ? '力学/电学/光学/热学' : isChemistry ? '物质性质、反应类型、元素周期' : isBiology ? '细胞、遗传、生态、进化' : '物质科学、生命科学、地球科学'}核心知识
- 🔬 科学探究方法：观察、假设、实验、分析、结论
- 🔬 ${isBiology ? '结构与功能关系、分类依据' : '物质变化规律、能量转化'}
- 🔬 课后练习/习题中考查的题型和能力
${isPrimary ? '- 🔧 小学：观察描述、简单分类、常见现象解释、动手实验\n' : ''}${isJunior ? '- 🔧 初中：基础定律、简单计算、实验操作规范、探究报告\n' : ''}${isSenior ? '- 🔧 高中：复杂理论推导、定量计算、综合实验设计、科学思维\n' : ''}`;
        } else if (isHumanitiesGroup) {
          const subjLabel = isHistory ? '历史' : isGeography ? '地理' : '政治/道德与法治/思想政治';
          subjectRules = `【${subjLabel}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📖 核心概念/原理/定义：每个独立标注
- 📖 ${isHistory ? '重要事件/人物/时间/导火索/结果/意义' : isGeography ? '地理位置/地形/气候/资源/人口/经济' : '政治概念/制度/法律/权利/义务/价值观'}
- 📖 ${isGeography ? '地图/图表/数据分析：识图、读图、绘图要点' : '材料/图表/数据解读要点'}
- 📖 因果关系/影响意义/启示/教训
- 📖 案例分析/材料解读/情境判断
- 📖 比较异同/归纳总结/评价论述
- 📖 ${isHistory ? '史料实证/历史解释/时空观念' : isGeography ? '区域认知/综合思维/人地协调观' : '政治认同/法治意识/公共参与'}
- 📖 课后练习/习题中考查的题型和能力层次
${isPrimary ? '- 🔧 小学：常识性了解、行为规范、简单地图识别、身边的社会现象\n' : ''}${isJunior ? '- 🔧 初中：系统知识体系、综合分析能力、材料题/简答题\n' : ''}${isSenior ? '- 🔧 高中：深度理论理解、多角度分析、论述题/综合探究\n' : ''}`;
        } else if (isIT) {
          subjectRules = `【信息科技学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 💻 概念/术语：每个独立标注
- 💻 操作步骤/流程/命令
- 💻 编程知识点：语法、算法、数据结构
- 💻 软件应用/工具使用
- 💻 信息安全/网络道德
- 💻 项目实践/案例应用
${isPrimary ? '- 🔧 小学：计算机基础操作、图形化编程、信息意识\n' : ''}${isJunior ? '- 🔧 初中：办公软件、简单编程、网络基础\n' : ''}${isSenior ? '- 🔧 高中：算法设计、数据处理、人工智能初步\n' : ''}`;
        } else if (isMusic || isArt || isPE) {
          subjectRules = `【${rawSubj}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 核心概念/术语/技法：每个独立标注
- 作品/曲目/运动项目及其要点
- 鉴赏/欣赏/评价要点
- 实践/操作/训练要求
- 课后练习/活动考查的内容`;
        }
        
        const segPrompt = `你是${book.stage || ''}${book.grade || ''}${book.subject || ''}学科命题专家。

【核心任务】通读以下教材段落，标注所有可用于命题的知识内容。必须逐字逐句通读，确保不遗漏段落中的任何知识信息。

${subjectRules}

【通用规则——所有学科都必须遵守】
- ⭐ 教材中加粗/标红/框出/特殊字体标注的内容，必须全部提取
- ⭐ 课后练习/习题中明确要求学生掌握的内容
- ⭐ 段落中明确标记为"重点""难点""考点"的内容
- 🔒 必须逐条标注，绝不将多个知识点合并为一条（如"生字5个"→必须拆成5条独立知识点）
- 🔒 先通读确认段落整体内容类型（正文/词汇表/练习/导语），再逐条精准标注
${candidateHint}
${batchText}

返回 JSON 数组：[{"segmentIndex": ${batchStart + 1}, "knowledgePoints": ["知识点1"], "type": "正文|例题|练习|导语|小结|词汇表|生字表", "isKeyConcept": true, "suggestedQuestionTypes": ["题型1"]}]
⚠️ 如果是词汇表/生字表段落，type 必须标注为"词汇表"或"生字表"，并将每个词条作为独立 knowledgePoint 列出，不得合并`;
        try {
          const segResponse = await callAI(segPrompt, { taskType: 'analysis', temperature: 0.1, timeout: 60000 });
          const segParsed = await robustJsonParse(segResponse, null, `分段分析-${chapter.title}`);
          if (Array.isArray(segParsed)) {
            for (const segResult of segParsed) {
              const segIdx = (segResult.segmentIndex || 1) - 1 - batchStart;
              if (segIdx >= 0 && segIdx < batchSegments.length) {
                segmentCards.push({ text: batchSegments[segIdx], knowledgePoints: segResult.knowledgePoints || [],
                  type: segResult.type || '正文', isKeyConcept: segResult.isKeyConcept || false,
                  isExample: segResult.type === '例题' || batchSegments[segIdx].includes('例'),
                  isExercise: segResult.type === '练习' || batchSegments[segIdx].includes('练习'),
                  suggestedQuestionTypes: segResult.suggestedQuestionTypes || [],
                  hasFormula: hasFormula(batchSegments[segIdx]) });
              }
            }
          }
        } catch (e) {
          console.warn(`分段分析失败（${chapter.title}），使用降级策略:`, e.message);
          const fallbackNames = candidateKpNames.length > 0 ? candidateKpNames : [chapter.title];
          for (let si = 0; si < batchSegments.length; si++) {
            const segText = batchSegments[si];
            const matchedFallback = fallbackNames.filter(name => wordBoundaryMatch(segText, name));
            let segType = '正文';
            if (segText.includes('例') || /^例\d+/.test(segText)) segType = '例题';
            else if (segText.includes('练习') || segText.includes('习题')) segType = '练习';
            else if (segText.includes('小结') || segText.includes('回顾')) segType = '小结';
            segmentCards.push({ text: segText, knowledgePoints: matchedFallback.length > 0 ? matchedFallback : [chapter.title],
              type: segType, isKeyConcept: matchedFallback.length > 0, isExample: segType === '例题',
              isExercise: segType === '练习', suggestedQuestionTypes: [], hasFormula: hasFormula(segText) });
          }
        }
      }
      const allKps = [...new Set(segmentCards.flatMap(s => s.knowledgePoints).filter(kp => typeof kp === 'string' && kp.trim()))];
      const keySegments = segmentCards.filter(s => s.isKeyConcept);
      contentCards.push({ chapterTitle: chapter.title, summary: chapter.coreTopics || allKps.slice(0, 5).join('、'),
        knowledgePointsForTest: allKps.map(kp => ({ name: kp, cognitiveLevel: '理解', sourceText: '', suggestedDifficulty: '基础',
          hasFormula: (chapter.formulas || []).some(f => kp.includes(f.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').substring(0, 4)) || f.includes(kp.substring(0, 4))),
          relatedFormulas: (chapter.formulas || []).filter(f => kp.includes(f.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').substring(0, 4)) || f.includes(kp.substring(0, 4))).slice(0, 3)
        })), adaptableMaterials: keySegments.slice(0, 5).map(s => s.text.substring(0, 100)),
        suggestedQuestionTypes: [...new Set(segmentCards.flatMap(s => s.suggestedQuestionTypes))].slice(0, 5),
        rawText: cleanRawText, segments: segmentCards, totalSegments: segmentCards.length, tags: allKps });
    }
  }
  return contentCards;
};

// ===== 第二步：构建层级知识图谱 =====
const buildKnowledgeMap = async (contentCards, selectedBooks, callAI, robustJsonParse, updateStatus) => {
  const stepConfig = await getCurrentEngineConfigEnhanced('blueprint');
  const stepModelName = getModelDisplayName(stepConfig.textModel || stepConfig.model);
  if (updateStatus) updateStatus(`第二步：构建知识图谱 [${stepModelName}]...`, 20);
  let knowledgeMap = { knowledgePoints: [], keyDifficulties: [], knowledgeGraph: [], crossChapterLinks: [] };
  if (contentCards.length === 0) {
    // ❌ 无素材可用：无法构建知识图谱
    const chapterCount = selectedBooks?.[0]?.selectedChapters?.length || 0;
    throw new Error(
      `知识图谱构建失败：未提取到任何教材素材（已选${chapterCount}章）。\n` +
      `可能原因：教材内容为空、图片识别失败、或章节未包含可提取的文字内容。\n` +
      `建议：检查教材文件是否完整，或重新导入教材后重试。`
    );
  }
  const cardsSummary = contentCards.map(c => ({
    title: c.chapterTitle, summary: c.summary, kpForTest: c.knowledgePointsForTest || [],
    keySegmentSamples: (c.segments || []).filter(s => s.isKeyConcept || s.isExample || s.hasFormula).slice(0, 5)
      .map(s => ({ type: s.type, hasFormula: s.hasFormula || false, snippet: (s.text || '').substring(0, 50) })),
    totalSegments: c.totalSegments || 0, tagSummary: (c.tags || []).slice(0, 10),
    suggestedQuestionTypes: c.suggestedQuestionTypes || []
  }));
  // 🔧 从指令库获取输入数据说明
  const inputDataDescRule = getMatchingBlockInstructions({ category: '分析-知识图谱构建' }).find(b => b.id.includes('input_data_desc'));
  const inputDataDescStr = inputDataDescRule ? inputDataDescRule.content : `- kpForTest：每个知识点对象，hasFormula=true表示涉及公式
- suggestedQuestionTypes：该章节各知识点建议的考查题型`;

  const prompt2 = `你是课程与教学专家。请基于以下各课内容，构建层级知识图谱。

【输入数据说明】
${inputDataDescStr}

各课内容概要：
${JSON.stringify(cardsSummary, null, 2)}

请完成：
1. 知识点清单（去重，不超过30个）
2. 重难点判断（不超过8个）
3. 层级知识图谱：单元→大概念(≤5)→核心知识点(≤6)→具体概念(≤4)，每个核心知识标注建议题型(suggestedQuestionTypes)
4. 跨章节关联（不超过10条）

返回JSON：{"knowledgePoints":[""],"keyDifficulties":[""],"knowledgeGraph":[{"unit":"","bigConcepts":[{"name":"","coreKnowledge":[{"name":"","cognitiveLevel":"理解","isKeyPoint":true,"isDifficulty":false,"specificConcepts":[""],"suggestedQuestionTypes":[""],"relatedChapters":[""],"testPriority":1}]}]}],"crossChapterLinks":[{"from":"","to":"","relation":"前置|并列|拓展|应用"}]}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response2 = await callAI(prompt2, { taskType: attempt >= 1 ? 'blueprint' : 'analysis', temperature: 0.1, retries: 0, forceJson: true });
      const parsed = await robustJsonParse(response2, (rp) => callAI(rp, { taskType: 'analysis', temperature: 0.1 }), `第二步-尝试${attempt + 1}`);
      if ((parsed.knowledgeGraph && parsed.knowledgeGraph.length) || (parsed.knowledgePoints && parsed.knowledgePoints.length)) {
        // 🔧 防御：确保 knowledgePoints/keyDifficulties 只包含有效字符串
        const safeKnowledgePoints = (parsed.knowledgePoints || []).filter(kp => typeof kp === 'string' && kp.trim());
        const safeKeyDifficulties = (parsed.keyDifficulties || []).filter(kd => typeof kd === 'string' && kd.trim());
        knowledgeMap = { knowledgePoints: safeKnowledgePoints, keyDifficulties: safeKeyDifficulties,
          knowledgeGraph: parsed.knowledgeGraph || [], crossChapterLinks: parsed.crossChapterLinks || [] };
        console.log(`✅ 知识图谱构建成功（尝试${attempt + 1}次）`);
        break;
      }
      throw new Error('解析结果缺少必要字段');
    } catch (e) { console.warn(`知识图谱构建尝试${attempt + 1}失败:`, e.message); }
  }
  if (!knowledgeMap.knowledgePoints.length && !knowledgeMap.knowledgeGraph.length) {
    // ❌ AI 3次尝试全部失败，不降级，直接报错
    throw new Error(
      `知识图谱构建失败：AI 连续 3 次返回无效结果。\n` +
      `可能原因：模型响应异常、网络不稳定、或教材内容超出模型处理能力。\n` +
      `建议：减少所选章节数量后重试，或检查网络连接。`
    );
  }
  // 🔧 防御：返回前最终净化，确保所有字段类型正确
  return {
    knowledgePoints: (knowledgeMap.knowledgePoints || []).filter(kp => typeof kp === 'string' && kp.trim()),
    keyDifficulties: (knowledgeMap.keyDifficulties || []).filter(kd => typeof kd === 'string' && kd.trim()),
    knowledgeGraph: Array.isArray(knowledgeMap.knowledgeGraph) ? knowledgeMap.knowledgeGraph : [],
    crossChapterLinks: Array.isArray(knowledgeMap.crossChapterLinks) ? knowledgeMap.crossChapterLinks : []
  };
};

/**
 * 从三维度指令库查询资料类型结构，替代硬编码 genTypeTemplates.structure
 * @param {string} genType - 资料类型（dictation/summary/errorbook/preview/reading/exam/practice/special）
 * @param {string} subject - 学科
 * @param {string} stage - 学段
 * @param {string} [stylePreference] - 命题风格偏好（big_unit/project_based），优先匹配新课标风格结构
 * @param {string} [specialSubType] - 专项子类型（如'阅读理解''计算'），仅 genType=special 时使用
 * @returns {string} 结构文本（不含"结构参考："前缀）
 */
const getStructureForBlueprint = (genType, subject, stage, stylePreference, specialSubType = '') => {
  // 🔧 三维度 + specialSubType：genType=special 时传入专项子类型（如'阅读理解''计算'）优先匹配；
  //    big_unit/project_based 时传入风格标记；其他情况默认 new_standard
  const queryOpts = { category: '生成-资料类型结构', subject, stage, genType };
  if (specialSubType) {
    queryOpts.specialSubType = specialSubType;
  } else if (stylePreference && (stylePreference === 'big_unit' || stylePreference === 'project_based')) {
    queryOpts.specialSubType = stylePreference;
  } else {
    queryOpts.specialSubType = 'new_standard';
  }
  const blocks = getMatchingBlockInstructions(queryOpts);
  if (blocks.length > 0) {
    const best = blocks[0];
    // 🔧 兜底警告：当使用了通用条目（无学科/无学段）而非年级专属条目时，提示开发者补充
    if (!best.subject && !best.stage && (subject || stage)) {
      console.warn(`[structure-fallback] 「${genType}」资料类型结构使用了通用兜底（无学科/学段），建议为 subject="${subject}" stage="${stage}" 补充专属结构大纲条目。当前匹配: ${best.id}`, best);
    }
    const raw = best.content || '';
    // 去掉 "结构参考：\n" 前缀，提取纯结构内容
    return raw.replace(/^结构参考[：:]\s*\n?/i, '').trim();
  }
  // 降级：genTypeTemplates 中的结构（仅作为最后兜底）
  return genTypeTemplates[genType]?.structure || '';
};

/**
 * 🔧 构建知识层级文本（蓝图显示用），带智能截断
 * 整本书场景下 knowledgeGraph 可能有几百个知识点，蓝图显示需截断以保证可读性
 * @param {Object} knowledgeMap - 知识图谱（有 knowledgeGraph 时优先）
 * @param {Array} contentCards - 内容卡片（降级用，无 knowledgeGraph 时从 knowledgePointsForTest 提取）
 * @param {number} maxDisplay - 最大显示条目数，默认30
 * @returns {string} 层级文本
 */
const buildHierarchyText = (knowledgeMap, contentCards, maxDisplay = 30) => {
  let hierarchyText = '';
  
  if (knowledgeMap?.knowledgeGraph?.length > 0) {
    let totalKps = 0;
    let shownKps = 0;
    const lines = [];
    for (const unit of knowledgeMap.knowledgeGraph) {
      lines.push(`📌 ${unit.unit || ''}`);
      for (const bc of (unit.bigConcepts || [])) {
        lines.push(`  ├─ ${bc.name}`);
        for (const ck of (bc.coreKnowledge || [])) {
          totalKps++;
          if (totalKps <= maxDisplay) {
            lines.push(`  │  ├─ ${ck.name}【${ck.cognitiveLevel || ck.level || '理解'}】`);
            // 具体概念（仅展开已显示的知识点）
            (ck.specificConcepts || []).forEach(sc => {
              lines.push(`  │  │  └─ ${sc}`);
            });
            shownKps++;
          }
        }
      }
    }
    hierarchyText = lines.join('\n');
    if (totalKps > maxDisplay) {
      hierarchyText += `\n  ...（共${totalKps}个核心知识点，显示前${shownKps}个，完整覆盖请参考教材原文）`;
    }
    return hierarchyText;
  }
  
  // 降级：从 contentCards 提取扁平列表
  const allKps = [...new Set((contentCards || []).flatMap(c =>
    (c.knowledgePointsForTest || []).map(k => typeof k === 'string' ? k : k.name)
  ).filter(Boolean))];
  if (allKps.length > 0) {
    const displayKps = allKps.slice(0, maxDisplay);
    hierarchyText = '📌 教材知识覆盖（非穷举）\n' + displayKps.map(kp => `  ├─ ${kp}`).join('\n');
    if (allKps.length > maxDisplay) {
      hierarchyText += `\n  ...（共${allKps.length}个知识点，显示前${maxDisplay}个）`;
    }
  }
  
  return hierarchyText;
};

// 🔧 模块级：资料类型名称轮换计数器，localStorage 持久化保证硬刷新不丢
const LABEL_COUNTERS_KEY = 'ww_label_counters_v1';
let _labelCounters = {};
let _scopeLabelCounters = {};
(function _restoreLabelCounters() {
  try {
    const raw = localStorage.getItem(LABEL_COUNTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.label) _labelCounters = parsed.label;
        if (parsed.scope) _scopeLabelCounters = parsed.scope;
      }
    }
  } catch { /* ignore */ }
})();
const _persistLabelCounters = () => {
  try { localStorage.setItem(LABEL_COUNTERS_KEY, JSON.stringify({ label: _labelCounters, scope: _scopeLabelCounters })); } catch {}
};


export function useAiGenerator() {
  const isGenerating = ref(false);
  const progress = ref(0);
  const statusText = ref('');
  const abortController = ref(null);

  // 🔧 新增：记录上次请求结束时间，用于智能等待
  const lastRequestEndTime = ref(0);
  // 🔧 新增：记录上次请求耗时（毫秒），用于动态调整等待策略
  const lastRequestDuration = ref(0);

  // 🔧 课时练课时切分：reactive 确认状态，供 UI 层监听
  const periodConfirm = ref(null); // { periods, knowledgeMap, contentCards, instruction, resolve }
  // 🔧 缓存的原始知识图谱（Step2 结果），供逐课时生成复用
  let _cachedKnowledgeMap = null;
  let _cachedContentCards = null;
  let _cachedInstruction = null;
  // 🔧 逐课时模式：设置此值后，generate() 跳过 Step1-2，直接使用给定的 knowledgeMap
  let _perPeriodKnowledgeMap = null;
  let _perPeriodSelectedBooks = null;
  let _perPeriodSelectedTemplates = null;
  // 🔧 AI修复防循环守卫：确保每次生成最多触发一次AI修复（防止无限调用API）
  let _repairActive = false;
  // 🔧 逐章生成模式：设置此 chapterTitle 后，generate() 从缓存中过滤出单章数据
  let _perChapterChapterTitle = null;
  // 🔧 整体生成跳过检测标志：cancelPeriodSplit 设置，阻止 generate() 清空 _cachedKnowledgeMap
  let _preservePeriodCache = false;

  // 🔧 资料类型名称池——轮换使用，避免标题千篇一律
  const GEN_TYPE_LABEL_POOLS = {
    exam: ['综合检测', '单元测试卷', '学业测评'],
    practice: ['课堂练习', '随堂巩固', '课时训练'],
    special: ['专项突破', '专题训练', '强化练习'],
    preview: ['预习导航', '课前导学', '预习单'],
    reading: ['阅读理解', '阅读训练', '阅读闯关'],
    summary: ['知识梳理', '学习总结', '知识归纳'],
    dictation: ['默写训练', '默写练习', '默写检测'],
    errorbook: ['错题整理', '错题集', '纠错练习'],
    review: ['复习巩固', '复习检测', '综合复习'],
  };

  // 🔧 名称样式手动选择（方案二）：按资料类型覆盖轮换名称，未设置=自动轮换
  const _labelOverrides = {};

  /**
   * 从名称池中轮换选取标签
   * @param {string} genType - 资料类型
   * @param {string} chapterKey - 章节键（用于区分不同章节的轮换计数器）
   * @returns {string} 轮换后的标签
   */
  const pickLabelFromPool = (genType, chapterKey = '_all_') => {
    if (_labelOverrides[genType]) return _labelOverrides[genType]; // 手动选择优先
    const pool = GEN_TYPE_LABEL_POOLS[genType] || ['练习题'];
    const key = `${genType}__${chapterKey}`;
    _labelCounters[key] = (_labelCounters[key] || 0) % pool.length;
    const label = pool[_labelCounters[key]++];
    _persistLabelCounters();
    return label;
  };

  /**
   * 🔧 设置资料类型名称的手动选择（名称样式下拉，方案二）
   * @param {string} genType - 资料类型
   * @param {string|null} label - 选中的名称；null/空 = 恢复自动轮换
   */
  const setLabelOverride = (genType, label) => {
    if (label) _labelOverrides[genType] = label;
    else delete _labelOverrides[genType];
  };

  /** 🔧 获取某资料类型的名称池（供下拉选项展示） */
  const getLabelPool = (genType) => GEN_TYPE_LABEL_POOLS[genType] || ['练习题'];

  /**
   * 🔧 后处理：将 AI 生成的内联拼音（如"蓬péng"）转换为 <ruby> 标签
   *    匹配模式：汉字 + 拼音（小写字母含声调符号）→ <ruby>汉字<rt>拼音</rt></ruby>
   *    注意：只匹配汉字后紧跟拼音的情况，不动 HTML 标签和已有 <ruby>
   */
  const convertInlinePinyinToRuby = (html) => {
    if (!html || typeof html !== 'string') return html;
    // 拼音声调字母：āáǎà ēéěè īíǐì ōóǒò ūúǔù ǖǘǚǜ ü ê ɑ ɡ
    const pinyinChar = '[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüêɑɡ]';
    // 汉字范围：CJK统一表意文字（基本区 + 扩展A + 兼容区）
    const hanzi = '[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]';
    // 模式：汉字 + 至少2个拼音字符（避免匹配单个字母误伤英文缩写）
    const pattern = new RegExp(`(${hanzi})(${pinyinChar}{2,})`, 'g');
    return html.replace(pattern, (match, han, py) => {
      // 安全检查：如果已经在 <ruby> 标签内，不重复包裹
      // （通过检查 match 前后是否有 <ruby 或 </ruby> 标签——简化处理：直接替换）
      return `<ruby>${han}<rt>${py}</rt></ruby>`;
    });
  };

  /**
   * 从知识图谱中检测课时边界
   * 规则：knowledgeGraph[].bigConcepts[].coreKnowledge → 每个 bigConcept 对应一个课时
   * @param {Object} knowledgeMap - Step2 构建的知识图谱
   * @returns {Array<{id, unitName, periodName, knowledgePoints, kpCount}>}
   */
  const detectPeriods = (knowledgeMap) => {
    const periods = [];
    const graph = knowledgeMap?.knowledgeGraph || [];
    for (const unit of graph) {
      if (!unit.bigConcepts?.length) continue;
      for (const bc of unit.bigConcepts) {
        const kps = (bc.coreKnowledge || [])
          .map(ck => (typeof ck === 'string' ? ck : (ck?.name || '')))
          .filter(Boolean);
        if (kps.length === 0) continue;
        // 判断 bigConcept 名称是否有课时语义（包含 Part/Lesson/课时/Let's 等）
        const hasSemanticName = /part|lesson|unit|课时|let'?s|story|read|write|spell|grammar|project/i.test(bc.name || '');
        periods.push({
          id: `period_${periods.length + 1}`,
          unitName: unit.unit || '',
          periodName: hasSemanticName ? bc.name : `第${periods.length + 1}课时`,
          knowledgePoints: kps,
          kpCount: kps.length,
          // 保存原始 bigConcept 引用，供构造子知识图谱使用
          _bigConcept: bc,
          _unit: unit,
        });
      }
    }
    // 合并知识点 < 2 个的课时到相邻课时
    if (periods.length > 1) {
      const merged = [];
      let buffer = null;
      for (const p of periods) {
        if (p.kpCount < 2) {
          if (buffer) {
            // 合并到上一个课时
            buffer.knowledgePoints = [...buffer.knowledgePoints, ...p.knowledgePoints];
            buffer.kpCount = buffer.knowledgePoints.length;
            buffer.periodName = `${buffer.periodName} + ${p.periodName}`;
          } else {
            // 作为缓冲等待下一个
            buffer = { ...p };
          }
        } else {
          if (buffer) {
            // 把缓冲合并到当前课时
            p.knowledgePoints = [...buffer.knowledgePoints, ...p.knowledgePoints];
            p.kpCount = p.knowledgePoints.length;
            p.periodName = `${buffer.periodName} + ${p.periodName}`;
            buffer = null;
          }
          merged.push(p);
        }
      }
      if (buffer) {
        // 最后一个缓冲合并到最后
        if (merged.length > 0) {
          const last = merged[merged.length - 1];
          last.knowledgePoints = [...last.knowledgePoints, ...buffer.knowledgePoints];
          last.kpCount = last.knowledgePoints.length;
          last.periodName = `${last.periodName} + ${buffer.periodName}`;
        } else {
          merged.push(buffer);
        }
      }
      return merged;
    }
    return periods;
  }; 

  // 🔧 新增：智能等待函数 - 状态够了自动开始，不用等到时间结束
  const smartWait = async (baseTimeMs, statusCheckFn, maxTimeMs = null) => {
    const startTime = Date.now();
    const effectiveMaxTime = maxTimeMs || baseTimeMs * 2;
    
    console.log(`⏰ 开始智能等待：基础${baseTimeMs/1000}秒，最多${effectiveMaxTime/1000}秒`);
    
    await new Promise(resolve => setTimeout(resolve, baseTimeMs / 2));
    
    while (Date.now() - startTime < effectiveMaxTime) {
      if (abortController.value?.signal.aborted) {
        console.log('🔧 智能等待被取消');
        return false;
      }
      
      if (statusCheckFn && statusCheckFn()) {
        const elapsed = Date.now() - startTime;
        console.log(`✅ 状态就绪，提前结束等待（已等待${elapsed/1000}秒，节省${(baseTimeMs - elapsed)/1000}秒）`);
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`⏰ 达到最大等待时间（${effectiveMaxTime/1000}秒），继续执行`);
    return false;
  };

  // ==================== 核心AI调用 ====================
  
  // 调用纯文本AI
  // ✨ Token 估算（中文约1.5字/token，英文约4字符/token）
  const estimateTokens = (text) => {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.replace(/[\u4e00-\u9fa5]/g, '').length;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  };

  const callAI = async (prompt, options = {}) => {
    // ✅ 根据任务类型获取对应配置（模型 + 温度）
    const taskType = options.taskType || 'generation';
    
    // 🔧 调试日志：输出调用参数
    if (taskType === 'analysis') {
      console.log(`🔍 callAI [${taskType}] 调用参数:`, {
        timeout: options.timeout,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        promptLength: prompt?.length || 0
      });
    }
    
    // 🔧 每次调用前检查是否已取消（除非明确指定 skipAbortCheck）
    if (!options.skipAbortCheck && isGenerating.value && abortController.value?.signal.aborted) {
      throw new Error('生成已取消');
    }
    // 🔧 修改：使用增强版配置（支持独立审查模型强制选择）
    const config = await getCurrentEngineConfigEnhanced(taskType, {
      promptLength: prompt?.length || 0,
      requiresChinese: true,
      requiresReasoning: ['blueprint', 'generation', 'review', 'questionValidation'].includes(taskType),
      requiresCreativity: taskType === 'generation'
    });
    const modelName = config.textModel || config.model || 'AI';
    const modelDisplayName = getModelDisplayName(modelName);
    const maxTokens = options.maxTokens || config.maxTokens || 4096;
    
    // 🔧 调试日志：输出解析后的 maxTokens（便于排查 localStorage 覆盖问题）
    if (taskType === 'analysis') {
      console.log(`🔍 解析后 maxTokens = ${maxTokens} (来源: ${options.maxTokens ? 'options' : config.maxTokens ? 'config(task)' : 'fallback(4096)'})`);
    }
    // ✨ 动态超时：根据 prompt 长度自动调整（32B+大模型需更长）
    const baseTimeout = options.timeout || 120000;
    const estimatedTokensForTimeout = estimateTokens(prompt);
    // 🔧 检测大参数量模型，给予更多时间
    const isLargeModel = /(32b|70b|72b)/i.test(config.textModel || config.model || '');
    const maxTimeout = isLargeModel ? 600000 : 300000; // 32B+ 最大10分钟
    const dynamicTimeout = Math.min(
      baseTimeout + (estimatedTokensForTimeout / 1000) * 30000, // 每 1000 tokens 增加 30 秒
      maxTimeout
    );
    const timeout = dynamicTimeout;
    
    if (estimatedTokensForTimeout > 5000) {
      console.log(`⏰ 动态超时设置: ${timeout/1000}秒 (prompt: ${estimatedTokensForTimeout} tokens, 基础: ${baseTimeout/1000}秒)`);
    }
    
    const retries = options.retries ?? 2;
    
    // ✅ 优先用 options 的温度，其次用 config 的温度（已按任务类型设置）
    const temperature = options.temperature ?? config.temperature ?? 0.7;
    
    let finalPrompt = prompt;
    
const maxInputTokens = config.engine === 'deepseek' 
      ? 100000  // DeepSeek 有 128K 上下文，100K 足够容纳任何蓝图 prompt
      : Math.floor(maxTokens * 0.7);  // Ollama 本地模型上下文小，按输出 token 反推
    
    // 🔧 生成自审机制：在生成类任务的 prompt 末尾追加自审指令
    if (['generation', 'review'].includes(taskType) && !options.skipSelfReview) {
      const selfReviewInstruction = `

【🔍 生成后自审要求 —— 请在输出完内容后，用 <div class="self-review" style="display:none">...</div> 完成以下自审（此块对用户不可见）】
请逐条检查刚生成的内容：
1. 知识点准确性：所有概念、公式、史实是否准确无误？若有误请指出。
2. 课标对齐：内容是否体现了新课标核心素养要求（如语文的语言运用/思维能力、数学的运算能力/推理能力等）？
3. 学段适配：难度和深度是否适合该学段学生？有无超纲或过于浅显的内容？
4. 无歧义表述：题干是否清晰明确？答案是否唯一确定？有无"略"等敷衍表述？
5. 结构完整：是否按照结构大纲要求组织？各板块内容是否充实不空洞？
请在自审块中如实记录检查结果，如发现问题请同时修正正文内容。`;
      
      // 仅在 prompt 足够容纳时才追加（预留 500 tokens 空间）
      const selfReviewTokens = estimateTokens(selfReviewInstruction);
      const currentTokens = estimateTokens(finalPrompt);
      if (currentTokens + selfReviewTokens < maxInputTokens - 500) {
        finalPrompt += selfReviewInstruction;
      }
    }
    
    const estimatedTokens = estimateTokens(prompt);
    // 🔧 输入限制：DeepSeek 128K 上下文用 100K 安全线，Ollama 维持原逻辑
    
    if (estimatedTokens > maxInputTokens) {
      console.warn(`⚠️ Prompt过长(${estimatedTokens} tokens)，正在智能压缩...`);
      
      // 🔧 策略：优先保留「指令要求」和「题目要求」部分，压缩「原文参考」
      // 按标记分段
      const sections = finalPrompt.split(/\n(?=【)/);
      let instructionParts = [];
      let materialParts = [];
      
      for (const section of sections) {
        if (section.startsWith('【教材原文') || section.startsWith('【模板参考') || section.startsWith('【教材参考')) {
          materialParts.push(section);
        } else {
          instructionParts.push(section);
        }
      }
      
      // 先确保指令部分完整
      let instructionText = instructionParts.join('\n');
      let instructionTokens = estimateTokens(instructionText);
      
      // 剩余预算全部分配给原文
      const remainingBudget = maxInputTokens - instructionTokens - 200; // 留 200 缓冲
      
      if (remainingBudget > 500) {
        let materialText = '';
        let usedTokens = 0;
        
        for (const part of materialParts) {
          const sentences = part.split(/(?<=[。！？\n])/);
          let compressedPart = '';
          
          for (const sent of sentences) {
            const sentTokens = estimateTokens(sent);
            if (usedTokens + sentTokens > remainingBudget) break;
            compressedPart += sent;
            usedTokens += sentTokens;
          }
          
          if (compressedPart) {
            materialText += compressedPart + '\n';
          }
        }
        
        finalPrompt = instructionText + '\n' + materialText;
        console.log(`📦 智能压缩完成：指令${instructionTokens}tokens + 原文${usedTokens}tokens = ${instructionTokens + usedTokens}tokens`);
      } else {
        // 极端情况：指令本身太长，只能压缩指令中的原文部分
        finalPrompt = instructionText.substring(0, Math.floor(maxInputTokens * 1.5));
        console.warn(`⚠️ 指令部分已占${instructionTokens}tokens，无法容纳原文，仅保留指令`);
      }
    }
    
    // ✨ 带超时和重试的调用
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 🔧 简化：只在首次调用时检测模型
        if (config.engine === 'ollama' && attempt === 0) {
          console.log(`🔍 文本分析 [${taskType}]：检测模型...`);
          await checkModelReady(null, 3, 'text');
          // 简单等待 2 秒预热
          await new Promise(r => setTimeout(r, 2000));
        }
        
        if (attempt > 0) {
          // 重试时固定等待
          const waitTime = config.engine === 'ollama' ? 5000 : Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          console.log(`🔄 文本分析 [${taskType}] 第${attempt}次重试，等待 ${waitTime/1000} 秒...`);
          await new Promise(r => setTimeout(r, waitTime));
          
          if (statusText?.value !== undefined) {
            statusText.value = `🔄 正在重试 [${modelDisplayName}]...（第${attempt}次）`;
          }
        }
        
        if (config.engine === 'ollama') {
          // ✨ 新增：Ollama 连接预检
          if (attempt === 0) {
            try {
              await axios.get(`${config.baseUrl}/api/tags`, { timeout: 5000 });
            } catch (preflightErr) {
              console.warn(`⚠️ Ollama 连接失败(${preflightErr.message})，请确认 Ollama 已启动`);
              throw new Error(`Ollama 服务不可用：${preflightErr.message}。请启动 Ollama 后重试。`);
            }
          }
          
          const response = await axios.post(
            `${config.baseUrl}/api/generate`,
            {
              model: config.textModel,
              prompt: finalPrompt,
              stream: false,
              keep_alive: 600,  // 🔧 保持 10 分钟，避免频繁重新加载
              // ✅ forceJson：仅对非推理模型启用（r1/deepseek 思考链会破坏 JSON 格式）
              ...(options.forceJson && !config.textModel?.includes('r1') && !config.textModel?.includes('deepseek') ? { format: 'json' } : {}),
              options: {
                temperature: temperature,
                num_predict: maxTokens,
                top_p: apiConfig.generationSettings.topP || 0.9,
                repeat_penalty: apiConfig.generationSettings.repeatPenalty || 1.1,
                // 🔧 R1/推理模型优化：限制上下文窗口避免爆显存，num_gpu=999 最大化 GPU 层
                ...(config.textModel?.includes('r1') || config.textModel?.includes('deepseek') ? {
                  num_ctx: 4096,
                  num_gpu: 999
                } : {})
              }
            },
            { 
              timeout,
              signal: abortController.value?.signal  // 🔧 支持取消
            }
          );
          
          let ollamaDone = response.data.done;
          let responseText = response.data.response || '';

          // 🔧 新增：自动续写机制
          const allowContinuation = options.allowContinuation !== false;
          const isTruncated = !ollamaDone && responseText.length > 10;

          if (isTruncated && allowContinuation) {
            console.log(`🔄 Ollama 输出被截断，尝试续写...（当前长度：${responseText.length}）`);
            
            // 取最后 300 字作为续写提示
            const tailText = responseText.slice(-300);
            const continuationPrompt = `【继续】请从上一次输出的最后一个字开始，继续后面的内容。不要重复已有文字。\n\n上一段末尾：${tailText}\n\n继续：`;
            
            let continuationResponse;
            try {
              continuationResponse = await axios.post(
                `${config.baseUrl}/api/generate`,
                {
                  model: config.textModel,
                  prompt: continuationPrompt,
                  stream: false,
                  options: {
                    temperature: Math.max(0, temperature - 0.2),
                    num_predict: Math.floor(maxTokens * 0.5),
                    top_p: 0.9,
                    repeat_penalty: 1.2
                  }
                },
                { 
                  timeout: Math.floor(timeout * 0.6),
                  signal: abortController.value?.signal  // 🔧 支持取消
                }
              );
              
              const continuationText = continuationResponse.data.response || '';
              if (continuationText && continuationText.length > 5) {
                // 🔧 增强：更智能的去重——找到最长公共前缀并截掉
                let cleanContinuation = continuationText;
                
                // 策略1：精确匹配末尾20字
                const tailWords = tailText.slice(-20);
                if (cleanContinuation.startsWith(tailWords)) {
                  cleanContinuation = cleanContinuation.slice(tailWords.length);
                } else {
                  // 策略2：渐进式匹配——从10字到3字递减
                  let overlapFound = false;
                  for (let overlapLen = 15; overlapLen >= 3; overlapLen--) {
                    const tailOverlap = tailText.slice(-overlapLen);
                    if (cleanContinuation.startsWith(tailOverlap)) {
                      cleanContinuation = cleanContinuation.slice(overlapLen);
                      overlapFound = true;
                      console.log(`🔧 找到重叠(长度${overlapLen})，已去除`);
                      break;
                    }
                  }
                  if (!overlapFound && cleanContinuation.length > 30) {
                    // 策略3：检查是否有换行分隔，取换行后的内容
                    const newlineIdx = cleanContinuation.indexOf('\n');
                    if (newlineIdx > 0 && newlineIdx < 30) {
                      const afterNewline = cleanContinuation.slice(newlineIdx + 1).trim();
                      if (afterNewline.length > 5) {
                        cleanContinuation = afterNewline;
                        console.log('🔧 取换行后内容作为续写');
                      }
                    }
                  }
                }
                
                // 🔧 新增：续写质量检查——如果续写内容太短或全是空白，放弃续写
                if (cleanContinuation.trim().length < 3) {
                  console.warn('⚠️ 续写内容过短，使用原输出');
                } else {
                  responseText += cleanContinuation;
                  console.log(`✅ 续写完成，总长度：${responseText.length}`);
                }
              } else {
                console.warn('⚠️ 续写返回内容过短，使用原输出');
              }
            } catch (e) {
              console.warn('⚠️ 续写请求失败，使用原输出:', e.message);
            }
          } else if (isTruncated && !allowContinuation) {
            console.warn(`⚠️ Ollama 输出被截断但已禁用续写，长度=${responseText.length}`);
          }
          
          // 🔧 R1/推理模型输出清洗：去掉 <｜end▁of▁thinking｜>标签
          responseText = cleanReasoningOutput(responseText);
          
          return responseText;
        } else {
          // 🔧 DeepSeek API 调用：智能构建 URL，避免重复拼接
          let apiUrl = config.baseUrl || '';

          // 🔧 防御：确保 apiUrl 有效
          if (!apiUrl) {
            throw new Error('DeepSeek API 地址未配置，请在设置中填写 API 地址');
          }

          // 如果 baseUrl 已经包含 /chat/completions，直接使用
          if (apiUrl.includes('/chat/completions')) {
            console.warn('⚠️ baseUrl 已包含完整路径，直接使用');
          } else if (apiUrl.endsWith('/v1')) {
            // 如果以 /v1 结尾，拼接 /chat/completions
            apiUrl = `${apiUrl}/chat/completions`;
          } else {
            // 否则拼接 /v1/chat/completions
            apiUrl = `${apiUrl.replace(/\/$/, '')}/v1/chat/completions`;
          }

          console.log(`🔗 DeepSeek API URL: ${apiUrl}`);

          // 🌡️ 熔断器检查
          if (deepseekBreaker.isOpen) {
            const remainingCooldown = Math.ceil((deepseekBreaker.lastFailTime + deepseekBreaker.cooldownMs - Date.now()) / 1000);
            throw new Error(`DeepSeek 服务暂时熔断中，请 ${Math.max(1, remainingCooldown)} 秒后重试`);
          }

          // 🔧 流式 SSE 传输：避免长连接因空闲而被中间代理断开
          // 🔧 systemMessage 支持：将角色/规则指令与待处理内容分离，
          //    避免长文本单 user 消息导致的"续写"模式（模型分不清指令和内容）
          const messages = [];
          if (options.systemMessage) {
            messages.push({ role: 'system', content: options.systemMessage });
          }
          messages.push({ role: 'user', content: finalPrompt });
          
          const requestBody = {
            model: config.model,
            messages,
            temperature: temperature,
            max_tokens: maxTokens,
            top_p: apiConfig.generationSettings.topP || 0.9,
            stream: true,
            // stream_options: { include_usage: true } — 部分兼容端点支持，先不加
            ...(options.forceJson ? { response_format: { type: 'json_object' } } : {}),
            // 🔧 阿里百炼思考模型（qwen3.8-max/qwen3-max/qwq 系）：默认关闭思考链——
            //    教辅结构化输出不需要推理链，思考 tokens 按输出价计费（¥36/百万）且耗时 3-5 倍
            ...(config.provider === 'alibaba' && /qwen3.*max|qwq/i.test(config.model || '') ? { enable_thinking: false } : {})
          };

          let streamResponse;
          try {
            streamResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
              },
              body: JSON.stringify(requestBody),
              signal: abortController.value?.signal
            });
          } catch (fetchErr) {
            // fetch 网络级错误标准化
            throw await normalizeFetchError(fetchErr, null);
          }

          // HTTP 错误处理
          if (!streamResponse.ok) {
            const normalizedErr = await normalizeFetchError(null, streamResponse);
            // 根据状态码记录到熔断器
            if (streamResponse.status >= 500) {
              deepseekBreaker.fail();
            }
            throw normalizedErr;
          }

          // 流式成功 → 熔断器复位
          deepseekBreaker.success();

          const { content: streamedContent, finishReason: streamedFinishReason } =
            await parseSSEStream(streamResponse, abortController.value?.signal);

          let content = streamedContent;
          let finishReason = streamedFinishReason;

          // 🔧 自动续写机制（截断检测）
          const allowContinuation = options.allowContinuation !== false;
          const isTruncated = finishReason === 'length' && content.length > 10;

          if (isTruncated && allowContinuation) {
            console.log(`🔄 DeepSeek 输出被截断，尝试续写...（当前长度：${content.length}）`);

            const tailText = content.slice(-300);
            const continuationMessages = [
              { role: 'user', content: finalPrompt },
              { role: 'assistant', content: content },
              { role: 'user', content: `请从上一次输出的最后一个字开始，继续后面的内容。不要重复已有文字，不要重新开始。\n上一段末尾：${tailText}` }
            ];

            try {
              const continuationResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                  model: config.model,
                  messages: continuationMessages,
                  temperature: Math.max(0, temperature - 0.2),
                  max_tokens: Math.floor(maxTokens * 0.5),
                  top_p: 0.9,
                  stream: false,  // 续写不流式（短内容）
                  ...(config.provider === 'alibaba' && /qwen3.*max|qwq/i.test(config.model || '') ? { enable_thinking: false } : {})
                }),
                signal: abortController.value?.signal
              });

              if (continuationResponse.ok) {
                const contData = await continuationResponse.json();
                const continuationText = contData.choices?.[0]?.message?.content || '';
                if (continuationText && continuationText.length > 5) {
                  // 🔧 增强：更智能的去重
                  let cleanContinuation = continuationText;

                  const tailWords = tailText.slice(-20);
                  if (cleanContinuation.startsWith(tailWords)) {
                    cleanContinuation = cleanContinuation.slice(tailWords.length);
                  } else {
                    let overlapFound = false;
                    for (let overlapLen = 15; overlapLen >= 3; overlapLen--) {
                      const tailOverlap = tailText.slice(-overlapLen);
                      if (cleanContinuation.startsWith(tailOverlap)) {
                        cleanContinuation = cleanContinuation.slice(overlapLen);
                        overlapFound = true;
                        console.log(`🔧 找到重叠(长度${overlapLen})，已去除`);
                        break;
                      }
                    }
                    if (!overlapFound && cleanContinuation.length > 30) {
                      const newlineIdx = cleanContinuation.indexOf('\n');
                      if (newlineIdx > 0 && newlineIdx < 30) {
                        const afterNewline = cleanContinuation.slice(newlineIdx + 1).trim();
                        if (afterNewline.length > 5) {
                          cleanContinuation = afterNewline;
                          console.log('🔧 取换行后内容作为DeepSeek续写');
                        }
                      }
                    }
                  }

                  if (cleanContinuation.trim().length < 3) {
                    console.warn('⚠️ DeepSeek续写内容过短，使用原输出');
                  } else {
                    content += cleanContinuation;
                    console.log(`✅ DeepSeek 续写完成，总长度：${content.length}`);
                  }
                } else {
                  console.warn('⚠️ DeepSeek 续写返回内容过短，使用原输出');
                }
              } else {
                console.warn('⚠️ DeepSeek 续写请求失败(status=' + continuationResponse.status + ')，使用原输出');
              }
            } catch (e) {
              console.warn('⚠️ DeepSeek 续写请求失败，使用原输出:', e.message);
            }
          } else if (isTruncated && !allowContinuation) {
            console.warn(`⚠️ DeepSeek 输出被截断但已禁用续写，长度=${content.length}`);
          }

          // 🔧 R1/推理模型输出清洗
          content = cleanReasoningOutput(content);
          return content;
        }
      } catch (e) {
        lastError = e;
        
        // ✨ 增强错误分类处理
        if (e.response?.status === 429) {
          // 限流：按服务器要求等待
          const retryAfter = parseInt(e.response.headers?.['retry-after']) || 5;
          console.warn(`⏳ 限流(429)，等待${retryAfter}秒...`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
        } else if (e.response?.status === 401) {
          // 认证失败
          console.error(`🔑 DeepSeek API Key 无效(401)`);
          throw new Error('DeepSeek API Key 无效，请在设置中重新配置');
        } else if (e.response?.status === 402) {
          // 余额不足
          console.error(`💰 DeepSeek 余额不足(402)`);
          throw new Error('DeepSeek 账户余额不足，请充值后重试');
        } else if (e.response?.status === 500) {
          // AI 服务器内部错误
          console.error(`💥 AI 服务器内部错误(500)`);
          
          // 尝试获取更详细的错误信息
          const errorDetail = e.response.data?.error?.message || e.message || '未知错误';
          console.error('   错误详情:', errorDetail);
          
          // 提供具体的解决建议
          let suggestion = '请稍后重试';
          if (errorDetail.toLowerCase().includes('model')) {
            suggestion = '模型可能未加载，请检查 Ollama 服务状态';
          } else if (errorDetail.toLowerCase().includes('memory') || errorDetail.toLowerCase().includes('oom')) {
            suggestion = '显存不足，请关闭其他应用或重启 Ollama';
          } else if (errorDetail.toLowerCase().includes('timeout')) {
            suggestion = '请求超时，请检查网络连接';
          }
          
          throw new Error(`AI 服务错误: ${suggestion}`);
          
        } else if (e.response?.status === 503 || e.response?.status === 502) {
          // 服务暂时不可用
          console.warn(`🌐 DeepSeek 服务暂时不可用(${e.response.status})，重试中...`);
        } else if (e.code === 'ECONNABORTED') {
          console.warn(`⏰ callAI [${taskType}] 超时(${timeout/1000}秒)，尝试${attempt+1}/${retries+1}`);
        } else if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND') {
          // 连接失败
          console.error(`🌐 无法连接到 ${config.engine} 服务(${e.code})`);
          throw new Error(`无法连接到 ${config.engine} 服务，请检查网络和配置`);
        } else if (e.code === 'ECONNRESET') {
          // 连接被重置
          console.warn(`🌐 连接被重置，可能是网络不稳定`);
          throw new Error('网络连接不稳定，请检查网络后重试');
        } else if (e.message?.includes('JSON') || e.message?.includes('parse')) {
          // JSON 解析失败
          console.warn(`📝 JSON 解析失败`);
          throw new Error('AI 返回格式异常，请重试或联系技术支持');
        } else if (e.message?.includes('aborted') || e.message?.includes('取消')) {
          // 请求已取消
          console.log(`🛑 请求已取消`);
          // 不抛出错误，因为这是用户主动取消
          return null;
        } else if (e.message?.includes('Ollama 服务不可用')) {
          // 预检失败，直接抛出
          throw e;
        } else {
          console.warn(`❌ callAI [${taskType}] 失败(${e.message})，尝试${attempt+1}/${retries+1}`);
        }
        
        if (attempt >= retries) throw e;
      }
    }
    throw lastError;
  };

  // 🔧 新增：检测 HTML 内容是否被截断（标签不完整）
  const isHtmlTruncated = (content) => {
    if (!content || typeof content !== 'string') return false;
    
    // 只检测实际 HTML 输出
    const hasHtmlTags = /<[a-zA-Z][^>]*>/.test(content);
    if (!hasHtmlTags) return false;
    
    // 统计标签
    const tagCounts = {};
    const tagMatches = content.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g) || [];
    
    for (const tag of tagMatches) {
      const isClosing = tag.startsWith('</');
      const tagName = isClosing ? tag.slice(2, -1).split(/\s/)[0] : tag.slice(1, -1).split(/\s/)[0];
      
      if (!tagCounts[tagName]) tagCounts[tagName] = { open: 0, close: 0 };
      if (isClosing) {
        tagCounts[tagName].close++;
      } else if (!tag.endsWith('/>')) { // 自闭合不算
        tagCounts[tagName].open++;
      }
    }
    
    // 只检测关键结构标签
    const structuralTags = ['div', 'table', 'ul', 'ol', 'section'];
    for (const tag of structuralTags) {
      const counts = tagCounts[tag];
      if (counts && counts.open !== counts.close) {
        return true; // 标签不匹配
      }
    }
    
    return false;
  };

  // 🔧 新增：检查多模态模型是否已加载
  const checkModelLoaded = async () => {
    try {
      const config = await getMultimodalConfig();
      const response = await fetch(`${config.baseUrl}/api/ps`, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      const loadedModels = data?.models || [];
      const isLoaded = loadedModels.some(m => m.name === config.model);
      
      console.log(`📊 模型状态: ${config.model} - ${isLoaded ? '已在内存' : '未加载'}`);
      return isLoaded;
    } catch (e) {
      console.warn('⚠️ 无法检查模型状态:', e.message);
      return false;
    }
  };

  // 🔧 优化：检测模型是否真正就绪（通过发送轻量测试请求）
  const checkModelReady = async (testImageBase64, maxAttempts = 3, modelType = 'multimodal') => {
    console.log(`🔍 开始检测${modelType === 'multimodal' ? '多模态' : '文本'}模型就绪状态...`);
    
    const startTime = Date.now();
    const maxWaitTime = 600000; // 10分钟（兜底）
    let pollInterval = 1000; // 🔧 初始轮询间隔1秒，给模型更多加载时间
    let attemptCount = 0;
    let lastError = null;
    
    // 🔧 统一配置：根据模型类型设置不同的超时时间
    const timeoutConfig = {
      multimodal: {
        psTimeout: 5000,      // /api/ps 检查超时
        warmupTimeout: 20000, // 🔧 预热请求增加到20秒，应对HTTP 500
        callAITimeout: 15000  // callAI 检测超时
      },
      text: {
        callAITimeout: 180000  // 🔧 文本模型增加到180秒，32B模型首次加载需要60-120秒
      }
    };
    
    while (Date.now() - startTime < maxWaitTime) {
      attemptCount++;
      try {
        if (modelType === 'multimodal') {
          // 🔧 关键修复：使用 /api/ps 接口检查模型是否在内存中
          const config = await getMultimodalConfig();
          
          // 🔧 PaddleOCR-VL pipeline 模式：无 HTTP 端点，直接返回就绪
          if (config.engine === 'paddleocr_vl') {
            console.log('✅ PaddleOCR-VL pipeline 模式，跳过 HTTP 检测');
            return { ready: true, responseTime: 0, attempts: 1 };
          }
          
          // 🔧 只在第一次尝试时打印引擎信息，避免日志冗余
          if (attemptCount === 1) {
            console.log(`📡 尝试连接多模态模型: ${config.model} @ ${config.baseUrl}`);
          }
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutConfig.multimodal.psTimeout);
          
          // 使用 /api/ps 接口检查模型是否已加载
          const response = await fetch(`${config.baseUrl}/api/ps`, {
            method: 'GET',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();
          const models = data.models || [];
          
          // 检查目标模型是否在运行的模型列表中
          const isModelLoaded = models.some(m => m.name === config.model || m.model === config.model);
          
          if (isModelLoaded) {
            const elapsed = Date.now() - startTime;
            console.log(`✅ 多模态模型已在内存中 (等待${elapsed}ms, 尝试${attemptCount}次)`);
            return { ready: true, responseTime: elapsed, attempts: attemptCount };
          } else {
            // 模型不在内存中，尝试发送一个轻量请求来加载它
            console.log(`⚠️ 模型未加载，尝试发送预热请求（超时: ${timeoutConfig.multimodal.warmupTimeout/1000}秒）...`);
            
            const warmupController = new AbortController();
            const warmupTimeoutId = setTimeout(() => warmupController.abort(), timeoutConfig.multimodal.warmupTimeout);
            
            // 创建一个最小的透明PNG图片（1x1像素）作为测试
            const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            
            try {
              const warmupResponse = await fetch(`${config.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: config.model,
                  messages: [
                    {
                      role: 'user',
                      content: 'OK',
                      images: [testImageBase64]
                    }
                  ],
                  stream: false,
                  options: {
                    num_predict: 5,
                    temperature: 0.1
                  }
                }),
                signal: warmupController.signal
              });
              
              clearTimeout(warmupTimeoutId);
              
              if (warmupResponse.ok) {
                const warmupData = await warmupResponse.json();
                const result = warmupData.message?.content || warmupData.response || '';
                
                if (result && result.trim().length > 0) {
                  const elapsed = Date.now() - startTime;
                  console.log(`✅ 多模态模型预热成功 (等待${elapsed}ms, 尝试${attemptCount}次)`);
                  return { ready: true, responseTime: elapsed, attempts: attemptCount };
                }
              } else {
                // 🔧 关键修复：针对500错误，增加更详细的诊断信息
                if (warmupResponse.status === 500) {
                  console.warn(`⚠️ 预热请求返回 HTTP 500，模型可能正在初始化或GPU资源不足`);
                  // 检查GPU状态（如果可用）
                  if (window.electronAPI?.getOllamaGpuStatus) {
                    try {
                      const gpuStatus = await window.electronAPI.getOllamaGpuStatus();
                      console.warn(`💻 GPU状态: ${gpuStatus.status}, 显存使用: ${gpuStatus.memoryUsage || '未知'}`);
                    } catch (e) {
                      // 忽略GPU状态获取错误
                    }
                  }
                } else {
                  console.warn(`⚠️ 预热请求返回 HTTP ${warmupResponse.status}，模型可能正在加载中`);
                }
              }
            } catch (warmupError) {
              clearTimeout(warmupTimeoutId);
              console.warn(`⚠️ 预热请求失败: ${warmupError.message}，模型可能正在加载中`);
              // 🔧 如果是网络错误或超时，提供更具体的建议
              if (warmupError.name === 'AbortError') {
                console.warn(`⚠️ 预热请求超时，模型可能需要更长时间加载，请检查系统资源`);
              } else if (warmupError.message.includes('fetch')) {
                console.warn(`⚠️ 网络连接问题，请确认Ollama服务是否正常运行`);
              }
            }
            
            console.log(`⚠️ 第${attemptCount}次尝试：模型未就绪`);
          }
        } else {
          // 🔧 文本模型检测：根据当前引擎配置选择检测方式
          const textConfig = await getCurrentEngineConfigEnhanced('generation');
          
          if (textConfig.engine === 'ollama') {
            // 🔧 修复：直接使用 fetch 测试 Ollama 模型，避免递归调用 callAI
            console.log(`📡 发送 Ollama 文本模型测试请求（超时: ${timeoutConfig.text.callAITimeout/1000}秒）...`);
            
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeoutConfig.text.callAITimeout);
              
              const response = await fetch(`${textConfig.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: textConfig.textModel,
                  prompt: 'OK',
                  stream: false,
                  options: { temperature: 0.1 }
                }),
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
              
              const data = await response.json();
              
              if (data.response && data.response.trim().length > 0) {
                const elapsed = Date.now() - startTime;
                console.log(`✅ Ollama 文本模型响应正常 (等待${elapsed}ms, 尝试${attemptCount}次)`);
                return { ready: true, responseTime: elapsed, attempts: attemptCount };
              } else {
                console.log(`⚠️ 第${attemptCount}次尝试返回空响应`);
              }
            } catch (e) {
              console.warn(`⚠️ 文本模型检测失败: ${e.message}`);
            }
          } else if (textConfig.engine === 'deepseek') {
            // 🔧 DeepSeek 文本模型：直接测试 API 连接
            console.log(`📡 测试 DeepSeek API 连接...`);
            
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeoutConfig.text.callAITimeout);
              
              // 🔧 关键修复：智能构建 API URL，避免重复拼接
              let apiUrl = textConfig.baseUrl;
              
              // 如果 baseUrl 已经包含 /chat/completions，直接使用
              if (apiUrl.includes('/chat/completions')) {
                console.warn('⚠️ baseUrl 已包含完整路径，直接使用');
              } else if (apiUrl.endsWith('/v1')) {
                // 如果以 /v1 结尾，拼接 /chat/completions
                apiUrl = `${apiUrl}/chat/completions`;
              } else {
                // 否则拼接 /v1/chat/completions
                apiUrl = `${apiUrl.replace(/\/$/, '')}/v1/chat/completions`;
              }
              
              console.log(`🔗 DeepSeek API URL: ${apiUrl}`);
              console.log(`📋 检测模型: ${textConfig.model}`);
              
              let consecutiveEmpties = 0;  // 🔧 熔断：连续空响应计数
              
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${textConfig.apiKey.trim()}`
                },
                body: JSON.stringify({
                  model: textConfig.model,
                  messages: [
                    { role: 'user', content: '请回复"OK"' }
                  ],
                  temperature: 0.1,
                  max_tokens: 256,  // 🔧 推理模型思考链+回复共享配额，200+才够输出content+reasoning
                  stream: false     // 🔧 显式指定，与生成调用的 stream:true 对齐 API 规范
                }),
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const data = await response.json();
                const msg = data.choices?.[0]?.message || {};
                const result = msg.content || '';
                const reasoning = msg.reasoning_content || '';  // 🔧 推理模型（R1等）有独立思考链字段
                
                // 🔧 推理模型：有 reasoning_content 就说明模型在工作，即使 content 为空也视为就绪
                if ((result && result.trim().length > 0) || reasoning) {
                  const elapsed = Date.now() - startTime;
                  console.log(`✅ DeepSeek API 连接正常 (等待${elapsed}ms, 尝试${attemptCount}次)`);
                  return { ready: true, responseTime: elapsed, attempts: attemptCount };
                } else {
                  consecutiveEmpties++;
                  // 🔧 诊断日志：打印完整响应体（前500字符），帮助定位根因
                  console.warn(`⚠️ 第${attemptCount}次尝试返回空响应 (连续${consecutiveEmpties}次)`);
                  console.warn(`📋 响应体预览: ${JSON.stringify(data).substring(0, 500)}`);
                  
                  // 🔧 熔断：连续5次空响应 → 判定为配置/模型问题，不再重试
                  if (consecutiveEmpties >= 5) {
                    const elapsed = Date.now() - startTime;
                    console.error(`❌ DeepSeek 连续${consecutiveEmpties}次返回空响应，已熔断。`);
                    console.error('   可能原因：1) 模型名无效  2) API余额不足  3) 模型不支持短提示');
                    return {
                      ready: false,
                      responseTime: elapsed,
                      attempts: attemptCount,
                      error: new Error(`DeepSeek连续${consecutiveEmpties}次空响应，请检查模型名(${textConfig.model})和API余额`)
                    };
                  }
                }
              } else {
                const errorText = await response.text();
                console.warn(`⚠️ DeepSeek API 返回 HTTP ${response.status}: ${errorText.substring(0, 200)}`);
                
                // 🔧 关键修复：如果是400错误，说明配置有问题，应该立即停止重试
                if (response.status === 400) {
                  console.error('❌ DeepSeek API 配置错误（400），请检查：');
                  console.error('   1. API密钥是否正确');
                  console.error('   2. 模型名称是否正确（应该是 deepseek-v4-pro）');
                  console.error('   3. API地址是否正确（应该是 https://api.deepseek.com/v1）');
                  
                  const elapsed = Date.now() - startTime;
                  // 返回 ready=false，让上层知道模型不可用
                  return { 
                    ready: false, 
                    responseTime: elapsed, 
                    attempts: attemptCount, 
                    error: new Error('DeepSeek API配置错误（HTTP 400），请检查设置')
                  };
                }
                
                // 其他错误继续重试
                console.log(`⚠️ 第${attemptCount}次尝试失败`);
              }
            } catch (e) {
              clearTimeout(timeoutId);
              console.warn(`⚠️ DeepSeek API 检测失败: ${e.message}`);
              
              // 如果是网络错误或超时，提供建议
              if (e.name === 'AbortError') {
                console.warn(`⚠️ DeepSeek API 请求超时，请检查网络连接`);
              } else if (e.message.includes('fetch')) {
                console.warn(`⚠️ 无法连接到 DeepSeek API，请检查网络或API地址`);
              }
            }
          } else {
            console.warn(`⚠️ 未知的文本引擎: ${textConfig.engine}`);
          }
        }
      } catch (e) {
        lastError = e;
        // 输出错误信息，便于调试
        if (attemptCount <= 3 || attemptCount % 10 === 0) {
          console.warn(`⚠️ 第${attemptCount}次检测失败: ${e.message}`);
        }
        // 如果连续失败多次，适当增加轮询间隔
        if (attemptCount > 3) {
          pollInterval = Math.min(pollInterval * 1.5, 3000); // 🔧 最大3秒间隔，增长更平缓
        }
      }
      
      await new Promise(r => setTimeout(r, pollInterval));
    }
    
    const totalWait = Date.now() - startTime;
    console.error(`❌ 模型未在${totalWait}ms内就绪 (总尝试次数: ${attemptCount})`);
    if (lastError) {
      console.error(`最后错误: ${lastError.message}`);
      console.error(`错误堆栈:`, lastError.stack);
    }
    return { ready: false, responseTime: totalWait, attempts: attemptCount, error: lastError };
  };

  // 🔧 新增：智能等待模型空闲（基于上次请求结束时间）
  const smartWaitForModel = async (minWaitMs = 2000, maxWaitMs = 8000) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestEndTime.value;
    
    // 🔧 关键修复：如果上次请求还在进行中（理论上不应该发生），强制等待
    if (timeSinceLastRequest < 0) {
      console.warn(`⚠️ 检测到异常：上次请求时间戳在未来，强制等待${maxWaitMs}ms`);
      await new Promise(r => setTimeout(r, maxWaitMs));
      return;
    }
    
    // 🔧 优化：不再单纯依赖时间推算，而是实际检测模型状态
    console.log(`🔍 实际检测模型就绪状态...`);
    
    try {
      // 通过 /api/ps 接口实际检查模型是否在内存中且空闲
      const config = await getMultimodalConfig();
      const psResponse = await fetch(`${config.baseUrl}/api/ps`, { 
        signal: AbortSignal.timeout(3000) 
      });
      
      if (psResponse.ok) {
        const psData = await psResponse.json();
        const currentModel = config.model;
        const modelInMemory = psData.models?.find(m => 
          m.name === currentModel || m.model === currentModel
        );
        
        if (modelInMemory) {
          // 🔧 关键：检查模型是否正在处理请求
          const isProcessing = modelInMemory.expires_at && 
                              new Date(modelInMemory.expires_at).getTime() > Date.now();
          
          if (!isProcessing) {
            console.log(`✅ 模型已就绪且空闲（距上次请求${(timeSinceLastRequest/1000).toFixed(1)}秒）`);
            return;  // 模型真正空闲，无需等待
          } else {
            console.log(`⏰ 模型仍在处理中，需要等待...`);
            
            // 🔧 新增：如果等待时间过长（超过20秒），尝试强制卸载并重新加载
            if (timeSinceLastRequest > 20000) {
              console.warn(`⚠️ 模型繁忙超过20秒，尝试强制卸载并重新加载...`);
              try {
                // 卸载模型
                await fetch(`${config.baseUrl}/api/generate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: currentModel,
                    keep_alive: 0  // 立即卸载
                  })
                });
                console.log(`✅ 模型已卸载，等待3秒后重新加载...`);
                await new Promise(r => setTimeout(r, 3000));
                
                // 重新加载模型（发送一个空请求）
                await fetch(`${config.baseUrl}/api/chat`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: currentModel,
                    messages: [{ role: 'user', content: 'hi' }],
                    stream: false
                  })
                });
                console.log(`✅ 模型已重新加载`);
                return;  // 重新加载后直接返回
              } catch (unloadError) {
                console.warn(`⚠️ 强制卸载失败:`, unloadError.message);
                // 继续执行保守等待策略
              }
            }
          }
        } else {
          console.log(`⚠️ 模型不在内存中，需要重新加载`);
        }
      }
    } catch (e) {
      console.warn(`⚠️ 无法检测模型状态: ${e.message}，使用保守等待策略`);
    }
    
    // 🔧 如果无法检测或模型繁忙，使用基于时间的保守等待策略
    let adjustedMinWait = minWaitMs;
    if (lastRequestDuration.value > 60000) {
      adjustedMinWait = Math.max(minWaitMs, 15000);
      console.log(`⚠️ 上次请求耗时${(lastRequestDuration.value/1000).toFixed(1)}秒，保守等待${adjustedMinWait}ms`);
    } else if (lastRequestDuration.value > 30000) {
      adjustedMinWait = Math.max(minWaitMs, 10000);
      console.log(`⚠️ 上次请求耗时${(lastRequestDuration.value/1000).toFixed(1)}秒，保守等待${adjustedMinWait}ms`);
    } else if (lastRequestDuration.value > 15000) {
      adjustedMinWait = Math.max(minWaitMs, 8000);
      console.log(`⚠️ 上次请求耗时${(lastRequestDuration.value/1000).toFixed(1)}秒，保守等待${adjustedMinWait}ms`);
    }
    
    // 如果距离上次请求已经超过调整后的最小等待时间，再次尝试检测
    if (timeSinceLastRequest >= adjustedMinWait) {
      // 再次检测确认
      try {
        const config = await getMultimodalConfig();
        const psResponse = await fetch(`${config.baseUrl}/api/ps`, { 
          signal: AbortSignal.timeout(2000) 
        });
        
        if (psResponse.ok) {
          const psData = await psResponse.json();
          const currentModel = config.model;
          const modelInMemory = psData.models?.find(m => 
            m.name === currentModel || m.model === currentModel
          );
          
          if (modelInMemory && !modelInMemory.expires_at) {
            console.log(`✅ 二次确认：模型已空闲`);
            return;
          }
        }
      } catch (e) {
        // 检测失败，继续等待
      }
    }
    
    // 否则等待剩余时间
    const remainingWait = adjustedMinWait - timeSinceLastRequest;
    const actualWait = Math.min(remainingWait, maxWaitMs);
    
    if (actualWait > 0) {
      console.log(`⏰ 智能等待模型空闲：${actualWait}ms（距上次请求${timeSinceLastRequest}ms）`);
      await new Promise(r => setTimeout(r, actualWait));
    } else {
      console.log(`✅ 模型已空闲，无需等待`);
    }
  };  

  // 调用多模态AI (统一走 PaddleOCR-VL，已替代 Ollama 多模态)
  const callMultimodalAI = async (prompt, imageBase64, options = {}) => {
    // 检查是否已取消（除非明确指定 skipAbortCheck）
    if (!options.skipAbortCheck && abortController.value?.signal.aborted) {
      console.warn('callMultimodalAI 检测到已取消，中止调用');
      throw new Error('已取消');
    }

    const taskType = options.taskType || 'extraction';
    // extraction 任务走 pipeline 模式（结构化文档解析）
    // 其他任务（描述、分析等）走 chat 模式（VLM 对话）
    const mode = taskType === 'extraction' ? 'pipeline' : 'chat';

    // 参数校验
    if (!imageBase64) {
      console.error('callMultimodalAI: imageBase64 为空');
      return '';
    }
    if (!prompt) {
      console.error('callMultimodalAI: prompt 为空');
      return '';
    }

    if (!window.electronAPI?.paddleOcrVLChat) {
      console.error('PaddleOCR-VL API 不可用');
      return '';
    }

    try {
      console.log(`${mode === 'chat' ? 'VLM' : 'OCR'} 调用 PaddleOCR-VL (${mode} 模式)`);

      const result = await window.electronAPI.paddleOcrVLChat(
        prompt,
        [imageBase64],
        {
          mode,
          maxTokens: mode === 'chat' ? (options.maxTokens || 256) : undefined
        }
      );

      if (result.success && result.text) {
        console.log(`PaddleOCR-VL 完成: ${result.total_length || result.text.length}字`);
        return result.text;
      }

      console.error(`PaddleOCR-VL 失败: ${result.error || '无文字返回'}`);
      return '';
    } catch (e) {
      console.error(`PaddleOCR-VL 调用异常: ${e.message}`);
      return '';
    }
  };

  // 重构：增强的文字提取（栏切割 + 串行重试 + 分学科后处理）
  const extractTextRobustly = async (imageBase64, options = {}) => {
    const { subject = '', stage = '', imagePath = '' } = options;
  
    let columnType = '单栏';
    let subImageBase64List = [];
  
    // ========== 第一步：栏检测与切割 ==========
    if (imagePath && window.electronAPI?.splitColumns) {
      try {
        const storagePath = getStoragePath();
        const tmpDir = `${storagePath}/暂存区/_columns_${Date.now()}`;
        const columnResult = await window.electronAPI.splitColumns(imagePath, tmpDir);
      
        if (columnResult.columns > 1) {
            columnType = `${columnResult.columns}栏`;
            console.log(`📐 检测到${columnType}排版（切割点: ${(columnResult.splits || []).join(', ')}），等待用户确认切割`);
        
            // 清理临时切割目录
            try {
              await window.electronAPI.deleteDirectory(tmpDir);
            } catch {}
          
            // 🔧 新增：检测到多栏，返回切割信息等待用户手动确认
            return {
              text: '',
              ocrQuality: 'pending_column_split',
              columnType,
              splits: columnResult.splits || [],
              subImages: columnResult.sub_images || [],
              imagePath,
              originalBase64: imageBase64
            };
        }
      } catch (e) {
        console.warn('⚠️ 栏检测失败，按单栏处理:', e.message);
      }
    }
  
    // ========== 第二步：OCR 提取 ==========
    const ocrPrompts = [
      // Prompt 1：精简版（直接指令，减少思考）
      `请逐字逐句提取图片中的所有文字。

要求：
1. 只输出原文，不要任何解释、描述、总结
2. 保留所有格式：换行、空格、标点、题号、选项（A.B.C.D.）
3. 过滤无关内容：水印、纯页码、装饰符号
4. 保留有价值内容：章节标题、知识点注释、公式、表格
5. 不确定时加【？】标记，不要猜测

直接输出识别的文字：`,

      // Prompt 2：最简版（兜底）
      '请识别并输出图片中的所有文字内容。'
    ];    
  
    // ========== 单栏：串行尝试 ==========
    let finalText = '';
    
    for (let attempt = 0; attempt < ocrPrompts.length; attempt++) {
      try {
        finalText = await callMultimodalAI(ocrPrompts[attempt], imageBase64, { 
          taskType: 'extraction',
          maxRetries: 1,
          imagePath: imagePath  // 🔧 新增：供 PaddleOCR 路由使用
        });
        
        if (finalText && finalText.trim().length >= 50) {
          break;
        }
        
        if (attempt < ocrPrompts.length - 1) {
          console.log(`⚠️ 单栏 prompt${attempt + 1}提取不足(${finalText?.length || 0}字)，尝试简化prompt...`);
        }
      } catch (e) {
        console.warn(`⚠️ 单栏 prompt${attempt + 1}失败:`, e.message);
      }
    }

    // 🔧 修复K：处理 DIM（模糊图片标记）
    if (finalText && finalText.trim() === 'DIM') {
      console.warn(`⚠️ OCR 返回 DIM（图片模糊），尝试最后一次降级提取...`);
      try {
        finalText = await callMultimodalAI(
          '这张图片可能有些模糊，请尽力提取其中可见的文字。如果确实一个字也看不清，回复"DIM"。不要解释。',
          imageBase64,
          { taskType: 'extraction', maxRetries: 0, imagePath: imagePath }
        );
      } catch (e) {
        console.warn('DIM降级提取也失败了:', e.message);
      }
    }
  
    if (finalText && subject) {
      finalText = postProcessOCR(finalText, subject, stage);
    }
    
    const quality = checkOCRQuality(finalText, subject);
    
    return {
      text: finalText || '',
      ocrQuality: quality.quality,
      columnType
    };
  };

  // ==================== 稳定的批量原文提取（重新设计）====================
  /**
   * 🎯 稳定可靠的章节原文提取方案（动态检测版）
   * 
   * 核心策略：
   * 1. 实际检测模型状态 - 不依赖固定时间
   * 2. 检测GPU显存使用情况 - 确保有足够资源
   * 3. 检测到就绪立即执行 - 不浪费等待时间
   * 4. 强制重试机制 - 空值立即重试，最多3次
   * 5. 清晰日志输出 - 只显示关键信息
   * 
   * @param {Array} pages - 页面列表 [{pageNum, imageBase64, imagePath}]
   * @param {Object} options - 配置选项
   * @returns {Object} { text: 完整文本, qualityReport: 质量报告 }
   */
  const extractChapterTextSequentially = async (pages, options = {}) => {
    const { 
      subject = '', 
      stage = '',
      onProgress = null,
      onPageComplete = null
    } = options;

    const MAX_RETRIES = 3;
    const MIN_TEXT_LENGTH = 50;
    
    console.log(` PaddleOCR-VL ${pages.length}`);
    
    const results = [];
    let mergedText = '';
    const qualityReport = {
      totalPages: pages.length,
      successPages: 0,
      failedPages: 0,
      retryPages: 0,
      pageDetails: []
    };

    console.log(`\n ${pages.length}`);
    console.log(`${MAX_RETRIES}${MIN_TEXT_LENGTH}\n`);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageNum = page.pageNum;

      // PaddleOCR-VL pipeline ，
      let pageText = '';
      let retryCount = 0;
      let success = false;

      while (retryCount < MAX_RETRIES && !success) {
        try {
          if (retryCount > 0) {
            console.log(`${pageNum}${retryCount}...`);
            await new Promise(r => setTimeout(r, 3000));
          }

          // OCR
          const ocrPrompt = `请逐字逐句提取图片中的所有文字。

要求：
1. 只输出原文，不要任何解释、描述、总结
2. 保留所有格式：换行、空格、标点、题号、选项（A.B.C.D.）
3. 过滤无关内容：水印、纯页码、装饰符号
4. 保留有价值内容：章节标题、知识点注释、公式、表格
5. 不确定时加【？】标记，不要猜测

直接输出识别的文字：`;

          pageText = await callMultimodalAI(ocrPrompt, page.imageBase64, { 
            taskType: 'extraction',
            maxRetries: 0, // 不在callMultimodalAI内部重试，由外层控制
            timeout: 120000, // 2分钟超时
            imagePath: page.imagePath  // 🔧 新增：供 PaddleOCR 路由使用
          });

          // 验证结果
          if (pageText && pageText.trim().length >= MIN_TEXT_LENGTH) {
            success = true;
            console.log(`✅ 第${pageNum}页：OCR成功 (${pageText.trim().length}字)`);
          } else {
            console.warn(`⚠️ 第${pageNum}页：结果过短(${pageText?.trim().length || 0}字)，需要重试`);
            retryCount++;
          }

        } catch (e) {
          console.error(`❌ 第${pageNum}页：OCR调用失败 - ${e.message}`);
          retryCount++;
        }
      }

      // 🔧 步骤3：处理结果
      const pageDetail = {
        pageNum,
        success,
        retryCount,
        textLength: pageText?.trim().length || 0
      };

      if (success) {
        // 学科后处理
        if (subject) {
          pageText = postProcessOCR(pageText, subject, stage);
        }

        mergedText += (mergedText ? '\n' : '') + pageText;
        qualityReport.successPages++;
        
        if (retryCount > 0) {
          qualityReport.retryPages++;
        }

        console.log(`📝 第${pageNum}页：已合并 (累计${mergedText.length}字)`);
        
        // 回调通知
        if (onPageComplete) {
          onPageComplete(pageNum, pageText.trim().length);
        }
      } else {
        qualityReport.failedPages++;
        console.error(`🚨 第${pageNum}页：完全失败（已重试${MAX_RETRIES}次）`);
        
        // 添加错误标记
        mergedText += (mergedText ? '\n' : '') + 
          `\n⚠️[系统错误：第${pageNum}页OCR识别失败，请对照原始PDF手动补充此部分内容]\n`;
      }

      qualityReport.pageDetails.push(pageDetail);

      // 进度回调
      if (onProgress) {
        onProgress(i + 1, pages.length);
      }
    }

    console.log(`\n✅ 批量提取完成：成功${qualityReport.successPages}页 | 失败${qualityReport.failedPages}页 | 重试${qualityReport.retryPages}页`);
    console.log(`📊 总字数：${mergedText.length}\n`);

    return {
      text: mergedText,
      qualityReport
    };
  };

  // 📐 独立的多栏检测函数——用户手动触发，不自动弹出
  const detectMultiColumnPages = async (pages, options = {}) => {
    const { subject = '', stage = '' } = options;
    const pendingColumnPages = [];
    
    console.log(`\n📐 手动多栏检测：共${pages.length}页`);
    
    for (const page of pages) {
      const pageNum = page.pageNum;
      
      if (!page.imagePath || !window.electronAPI?.splitColumns) {
        console.warn(`⚠️ 第${pageNum}页：缺少 imagePath 或 splitColumns API，跳过`);
        continue;
      }
      
      try {
        const storagePath = getStoragePath();
        const tmpDir = `${storagePath}/暂存区/_columns_${Date.now()}_${pageNum}`;
        const columnResult = await window.electronAPI.splitColumns(page.imagePath, tmpDir);
        
        try { await window.electronAPI.deleteDirectory(tmpDir); } catch {}
        
        if (columnResult.columns > 1) {
          pendingColumnPages.push({
            page: pageNum,
            ocrResult: {
              ocrQuality: 'pending_column_split',
              columnType: `${columnResult.columns}栏`,
              splits: columnResult.splits || [],
              subImages: columnResult.sub_images || []
            },
            imageBase64: page.imageBase64,
            imagePath: page.imagePath,
            subject,
            stage
          });
          console.log(`📐 第${pageNum}页：检测到${columnResult.columns}栏排版`);
        }
      } catch (e) {
        console.warn(`⚠️ 第${pageNum}页：栏检测失败: ${e.message}`);
      }
    }
    
    console.log(`📐 多栏检测完成：${pendingColumnPages.length}个多栏页面`);
    return pendingColumnPages;
  };

  // 🔧 新增：OCR质量检查
  const checkOCRQuality = (text, subject) => {
    if (!text || text.trim().length < 5) {
      return { quality: 'poor', reason: '文字过少' };
    }

    const cleanText = text.trim();
    
    if (cleanText.length < 200) {
      return { 
        quality: 'warning', 
        reason: `文字过少(${cleanText.length}字)，可能不完整或非原文内容` 
      };
    }

    const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = cleanText.replace(/\s/g, '').length;
    const chineseRatio = totalChars > 0 ? chineseChars / totalChars : 0;

    if (subject !== '英语' && chineseRatio < 0.3) {
      return { 
        quality: 'poor', 
        reason: `中文字符比例过低(${(chineseRatio * 100).toFixed(0)}%)` 
      };
    }

    const gibberishPattern = /[□■◆◇○●△▲▽▼☆★♡♥]/g;
    const gibberishCount = (cleanText.match(gibberishPattern) || []).length;
    if (gibberishCount > cleanText.length * 0.05) {
      return { 
        quality: 'warning', 
        reason: `可能存在识别错误(${gibberishCount}个异常字符)` 
      };
    }

    return { quality: 'good', reason: '正常' };
  };

  // ==================== OCR 结果验证 ====================
  /**
   * 🔧 验证 OCR 结果是否有效
   */
  const validateOCRResult = (text, subject) => {
    if (!text || text.trim().length < 5) {
      return { valid: false, reason: '文字过少' };
    }
    
    const cleanText = text.trim();
    
    // 检查：是否是明显的AI解释而非原文
    const aiDescriptionPatterns = [
      /^这是/,
      /^图片中/,
      /^教材中/,
      /^该页/,
      /^本页是/,
      /^展示/,
      /^内容为/,
      /^主要为/,
      /^描述了/,
      /^介绍了/,
      /^这张/,
      /^这幅/,
      /^页面/,
      /^课文/,
      /^本课/,
      /^这一页/,
      /^这部分/,
      /图片展示/,
      /内容包含/,
      /主要讲/,
    ];
    
    for (const pattern of aiDescriptionPatterns) {
      if (pattern.test(cleanText)) {
        return { valid: false, reason: `疑似AI描述而非原文（匹配: ${pattern}）` };
      }
    }
    
    // 纯图片页标记
    if (cleanText.includes('纯图片') || cleanText === 'NO_TEXT') {
      return { valid: true, reason: '纯图片页' };
    }
    
    // 模糊页标记
    if (cleanText === 'DIM') {
      return { valid: false, reason: '图片模糊' };
    }
    
    // 内容过短
    if (cleanText.length < 10) {
      return { valid: false, reason: `内容过短(${cleanText.length}字)` };
    }
    
    return { valid: true, reason: '正常' };
  };

  // ==================== 教材图片分析（提取原文） ====================
  const analyzeTextbookImage = async (imageBase64, subject, stage, grade, imagePath = '', chapterInfo = {}) => {
    // 🔧 自动判断是否为导语页：有子节点 + 只有1-2页
    // 🔧 修复C：增加排除条件，避免“单元小结”“整理与复习”被误判为导语页
    const isSummaryPage = chapterInfo.title && /小结|总结|整理|复习|回顾|知识归纳/.test(chapterInfo.title);
    const isGuidePage = chapterInfo.hasChildren && chapterInfo.pageCount <= 2 && !isSummaryPage;
      
    let rawText = '';
    
    // ✅ 直接使用多模态LLM（qwen3-vl）进行OCR
    let ocrAttempts = 0;
    const MAX_OCR_ATTEMPTS = 3;
    
    while (ocrAttempts < MAX_OCR_ATTEMPTS) {
      ocrAttempts++;
      
      console.log(`🔄 OCR尝试 ${ocrAttempts}/${MAX_OCR_ATTEMPTS}...`);
      
      rawText = await callMultimodalAI(
          `请逐字逐句提取图片中的所有文字。

要求：
1. 只输出原文，不要任何解释、描述、总结
2. 保留所有格式：换行、空格、标点、题号、选项（A.B.C.D.）
3. 过滤无关内容：水印、纯页码、装饰符号
4. 保留有价值内容：章节标题、知识点注释、公式、表格
5. 不确定时加【？】标记，不要猜测
6. 图片模糊看不清 → 输出"DIM"
7. 无文字 → 输出"NO_TEXT"
8. 忽略拼音注音（如 zhǎn, dú 等），只提取汉字和标点

直接输出识别的文字：`,
          imageBase64,
          { 
            taskType: 'extraction',
            timeout: 600000,  // 🔧 显式设置10分钟超时
            maxRetries: 1,
            think: false,      // 🔧 强制关闭思考模式，提高响应速度
            imagePath: imagePath  // 🔧 新增：供 PaddleOCR 路由使用
          }
        ) || '';
      
      console.log(`📝 OCR返回文本长度: ${rawText?.length || 0}字`);
      if (rawText && rawText.length > 0) {
        console.log(`📝 OCR返回文本前100字: ${rawText.substring(0, 100)}`);
      }
        
        const validation = validateOCRResult(rawText, subject);
        console.log(`✅ OCR验证结果: ${validation.valid ? '通过' : '失败'} - ${validation.reason}`);
        
        if (validation.valid) {
          console.log(`✅ OCR成功: ${rawText.length}字`);
          break;
        } else {
          console.warn(`⚠️ OCR验证失败，准备重试...`);
        }
    }
    
    // 如果所有重试都失败，使用降级策略
    if (!validateOCRResult(rawText, subject).valid) {
      console.warn('⚠️ 标准OCR全部失败，使用降级策略...');
      rawText = await callMultimodalAI(
        '请从这张图片中提取所有可见的文字。如果完全没有文字，只回复"无文字"。不要做任何解释。',
        imageBase64,
        { taskType: 'extraction', maxRetries: 0, imagePath: imagePath }
      ) || '';
    }
        
    if (rawText && subject) {
      rawText = postProcessOCR(rawText, subject, stage);
    }
  
    let ocrQuality = checkOCRQuality(rawText, subject);
      
    console.log('📖 教材原文提取结果长度:', rawText?.length || 0, isGuidePage ? '(导语页)' : '');

    // 如果完全失败
    if (!rawText || rawText.trim().length < 5) {
      console.error('❌ 教材原文提取完全失败');
      return {
        rawText: rawText || '',
        visualDescription: '',
        formulas: [],
        coreTopics: '',
        knowledgePoints: [],
        knowledgeHierarchy: [],
        competency: '理解',
        style: '传统',
        ocrQuality: 'poor'
      };
    }

    console.log(`📖 OCR质量: ${ocrQuality.quality}`);

    // 🔧 方案B：单页只做OCR提取，AI分析由外层 analyzeTextbookWithText 统一处理
    // 原因：避免重复分析，节省时间和显存（每章从2次AI调用降到1次）
    return {
      rawText,
      visualDescription: '',
      formulas: [],
      coreTopics: '',
      knowledgePoints: [],
      knowledgeHierarchy: [],
      competency: extractGradeNum(grade) <= 6 ? '识记与理解' : '应用与分析',
      style: '传统',
      ocrQuality: ocrQuality.quality,
      isGuidePage
    };
  };

  // ==================== 新增：自动提取知识点 ====================
  const extractKnowledgePoints = async (imageBase64, subject, stage, grade, chapterTitle) => {
    const prompt = `你是一位${stage}${grade}${subject}学科专家。请从这张教材页面（章节：${chapterTitle}）中，提取出最核心的知识点。
  要求：
  1. 每个知识点用一句话概括。
  2. 只提取最核心的3-5个知识点。
  3. 每行一个知识点，不要编号。

  请直接输出知识点列表，不要其他内容。`;

    const response = await callMultimodalAI(prompt, imageBase64);
    
    // 按行分割，过滤空行
    const lines = response.split('\n').filter(line => line.trim() && !line.startsWith('【') && !line.startsWith('输出'));
    return lines.map(line => line.replace(/^[-\*•\d\.]\s*/, '').trim());
  };

  // ==================== 纯文本 AI 分析（跳过 OCR）====================
  const analyzeTextbookWithText = async (text, subject, stage, grade, chapterTitle, hasChildren, pageCount) => {
    console.log('🧠 开始纯文本 AI 分析...');
    
    const isSummaryPage = chapterTitle && /小结|总结|整理|复习|回顾|知识归纳/.test(chapterTitle);
    const isGuidePage = hasChildren && pageCount <= 2 && !isSummaryPage;
    
    let result = { 
      visualDescription: '', 
      formulas: [], 
      coreTopics: '',
      knowledgeHierarchy: []
    };
    
    try {
      // 🔧 复用 analyzeTextbookImage 中的 AI 分析逻辑
      let analysisText = text;
      
      if (analysisText.length > 10000) {
        console.warn(`⚠️ 原文较长（${analysisText.length}字），将使用完整原文进行分析`);
      }
      
      const analysisPrompt = isGuidePage ?
        `你是一位${stage}${grade}${subject}教学专家。请分析以下教材导语/概述页，提取本单元的核心信息。

【导语原文】
${analysisText}

请提取：
1. **单元主题**：本单元的人文主题或核心主题名称
2. **学习目标**：本单元的主要学习目标或核心要求（3-5条）
3. **关键知识点**：导语中明确提到的知识点或技能点，数量不限，每个必须能在导语中找到对应的原文词句作为依据
4. **语文要素/学科重点**：如果有明确的语文要素（如阅读方法、写作方法）或学科重点，请提取

返回 JSON：
{
  "visualDescription": "",
  "formulas": [],
  "coreTopics": "核心主题词，逗号分隔（3-6个）",
  "knowledgeHierarchy": [
    {
      "bigConcept": "单元主题名称",
      "coreKnowledge": [
        {
          "name": "学习目标或语文要素名称",
          "level": "理解",
          "specificConcepts": ["具体知识点1", "具体知识点2"],
          "suggestedQuestionTypes": ["适合考查的题型1", "适合考查的题型2"]
        }
      ]
    }
  ]
}

只返回 JSON。`
        :
        `你是一位${stage}${grade}${subject}学科教学专家。请分析以下教材内容：

【教材原文】
${analysisText}

请完成以下分析任务：

1. **图表描述**：如果有图表，用文字描述；如果没有，返回空字符串
2. **公式提取**：如果有数学/物理/化学公式，用LaTeX格式描述；如果没有，返回空数组
3. **知识点层级结构**：按"大概念 → 核心知识点 → 具体概念"三层结构提取，标注每个知识点的认知层次（识记/理解/应用/分析/评价/创造）

必须返回以下JSON格式：
{
  "visualDescription": "图表描述或空字符串",
  "formulas": ["$公式$ → 含义"],
  "coreTopics": "核心主题词，逗号分隔（3-6个，按概括层级排序）",
  "knowledgeHierarchy": [
    {
      "bigConcept": "大概念名称（如：分数的意义）",
      "coreKnowledge": [
        {
          "name": "核心知识点名称",
          "level": "识记|理解|应用|分析|评价|创造",
          "specificConcepts": ["具体概念1", "具体概念2"],
          "suggestedQuestionTypes": ["适合的题型1", "适合的题型2"]
        }
      ]
    }
  ]
}

${(() => {
  const s = (subject || '');
  const st = (stage || '');
  const g = (grade || '');
  const gn = extractGradeNum(g);
  
  const isChinese = s.includes('语文');
  const isMath = s.includes('数学');
  const isEnglish = s.includes('英语');
  const isPhysics = s.includes('物理');
  const isChemistry = s.includes('化学');
  const isBiology = s.includes('生物');
  const isScience = s.includes('科学');
  const isHistory = s.includes('历史');
  const isGeography = s.includes('地理');
  const isPolitics = s.includes('政治') || s.includes('道德') || s.includes('思想');
  const isIT = s.includes('信息');
  const isMusic = s.includes('音乐');
  const isArt = s.includes('美术');
  const isPE = s.includes('体育');
  
  const isScienceGroup = isPhysics || isChemistry || isBiology || isScience;
  const isHumanitiesGroup = isHistory || isGeography || isPolitics;
  
  const isPrimary = st.includes('小学');
  const isJunior = st.includes('初中');
  const isSenior = st.includes('高中');
  const isLowerGrade = isPrimary && gn > 0 && gn <= 2;
  const isMidGrade = isPrimary && gn >= 3 && gn <= 4;
  const isUpperGrade = isPrimary && gn >= 5;
  
  if (isChinese) {
    return `【语文学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📝 生字/生词：每个生字独立标注（如"人""口""手"），绝不合并
- 📝 多音字：标注每个读音和组词（如"长(cháng)长短/长(zhǎng)长大"）
- 📝 近义词/反义词：成对标注，注明辨析要点
- 📝 重点词语/成语/俗语/歇后语：逐词标注含义和用法
- 📝 需背诵段落/古诗/名句/文言文：标注篇名和范围
- 📝 课文内容理解：主旨、人物形象、事件脉络、道理、情感
- 📝 修辞手法：比喻、拟人、排比、夸张、反问、设问等
- 📝 标点符号用法与病句修改考点
- 📝 阅读理解考点：词语理解、句子含义、内容概括、结构分析
- 📝 写作/口语交际/综合性学习/名著导读要求
- 🔒 必须逐条标注，绝不将多个知识点合并为一条（如"生字5个"→必须拆成5条独立知识点）
${isLowerGrade ? '- 🔧 低段(1-2)：拼音、笔画笔顺、偏旁部首、看图写话、简单日记\n' : ''}${isMidGrade ? '- 🔧 中段(3-4)：段落大意、习作、简单修辞、观察日记\n' : ''}${isUpperGrade ? '- 🔧 高段(5-6)：文言文入门、说明文阅读、读后感\n' : ''}${isJunior ? '- 🔧 初中：文言文实词虚词、古诗词鉴赏、议论文/说明文阅读\n' : ''}${isSenior ? '- 🔧 高中：文言文特殊句式、诗歌鉴赏手法、论述类/文学类文本阅读\n' : ''}`;
  } else if (isMath) {
    return `【数学学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 🔢 概念/定义：每个数学概念独立标注
- 🔢 公式/定理/运算法则/性质：逐条标注，注明适用条件
- 🔢 计算方法/解题步骤/证明思路：标注关键步骤
- 🔢 例题：标注考查的知识点和解题方法
- 🔢 几何图形：性质、判定、计算公式
- 🔢 统计与概率：数据收集、图表解读、概率计算
- 🔢 应用题类型与解题策略
- 🔢 数学术语/符号/单位
- 🔢 课后练习/习题中考查的题型和能力层次
- 🔒 必须逐条标注，绝不将多个知识点合并为一条
${isLowerGrade ? '- 🔧 低段(1-2)：数的认识、20以内加减、图形认识、口算、钟表\n' : ''}${isMidGrade ? '- 🔧 中段(3-4)：乘除法、分数初步、周长面积、简单应用题\n' : ''}${isUpperGrade ? '- 🔧 高段(5-6)：小数分数运算、方程、几何计算、复合应用题\n' : ''}${isJunior ? '- 🔧 初中：代数运算、几何证明、函数初步、统计与概率\n' : ''}${isSenior ? '- 🔧 高中：函数、数列、立体几何、概率统计、导数、向量\n' : ''}`;
  } else if (isEnglish) {
    return `【英语学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📕 词汇表/单词表：每个词条（英文+中文释义）独立标注为 specificConcept，逐条列出，不得遗漏任何一个
- 📕 重点句型：每个句型独立标注（如"What's your name?""I like...""There be..."）
- 📕 语法点：时态、语态、句型结构、词性、从句等逐条标注
- 📕 对话/短文：标注主题、关键表达、交际功能
- 📕 发音/拼读规则：自然拼读、音标、重音、连读等
- 📕 听力材料中的关键信息和考查点
- 📕 阅读理解策略与完形填空考点
- 📕 书面表达/写作话题与常用表达
- 📕 文化知识/跨文化交际内容
- 📕 教材各板块：Let's learn/Talk/Spell/Read/Write/Story等全部提取
- 🔒 必须逐条标注，绝不将多个词条合并为一条（如"单词5个"→必须拆成5条独立知识点）
- 🔒 先通读确认段落整体内容类型（正文/词汇表/练习/导语），再逐条精准标注
${isLowerGrade ? '- 🔧 低段(1-2)：字母、简单单词、日常问候、歌曲歌谣、颜色数字\n' : ''}${isMidGrade ? '- 🔧 中段(3-4)：对话理解、短文阅读、简单语法、词汇拼写\n' : ''}${isUpperGrade ? '- 🔧 高段(5-6)：篇章阅读、时态综合、简单写作\n' : ''}${isJunior ? '- 🔧 初中：完形填空、阅读理解、书面表达、语法系统\n' : ''}${isSenior ? '- 🔧 高中：深层阅读、语法填空、读后续写、概要写作\n' : ''}`;
  } else if (isScienceGroup) {
    const subjLabel = isPhysics ? '物理' : isChemistry ? '化学' : isBiology ? '生物' : '科学';
    return `【${subjLabel}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 🔬 概念/定义/定律/原理：每个独立标注，注明内涵
- 🔬 公式/方程式/化学式：逐条标注${isChemistry ? '，配平和反应条件' : ''}
- 🔬 实验：目的、器材、步骤、现象、结论、注意事项
- 🔬 计算题考查点和公式应用
- 🔬 图表/数据/示意图的解读要点
- 🔬 ${isPhysics ? '力学/电学/光学/热学' : isChemistry ? '物质性质、反应类型、元素周期' : isBiology ? '细胞、遗传、生态、进化' : '物质科学、生命科学、地球科学'}核心知识
- 🔬 科学探究方法：观察、假设、实验、分析、结论
- 🔬 ${isBiology ? '结构与功能关系、分类依据' : '物质变化规律、能量转化'}
- 🔬 课后练习/习题中考查的题型和能力
- 🔒 必须逐条标注，绝不将多个知识点合并为一条
- 🔒 先通读确认段落整体内容类型，再逐条精准标注
${isPrimary ? '- 🔧 小学：观察描述、简单分类、常见现象解释、动手实验\n' : ''}${isJunior ? '- 🔧 初中：基础定律、简单计算、实验操作规范、探究报告\n' : ''}${isSenior ? '- 🔧 高中：复杂理论推导、定量计算、综合实验设计、科学思维\n' : ''}`;
  } else if (isHumanitiesGroup) {
    const subjLabel = isHistory ? '历史' : isGeography ? '地理' : '政治/道德与法治/思想政治';
    return `【${subjLabel}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 📖 核心概念/原理/定义：每个独立标注
- 📖 ${isHistory ? '重要事件/人物/时间/导火索/结果/意义' : isGeography ? '地理位置/地形/气候/资源/人口/经济' : '政治概念/制度/法律/权利/义务/价值观'}
- 📖 ${isGeography ? '地图/图表/数据分析：识图、读图、绘图要点' : '材料/图表/数据解读要点'}
- 📖 因果关系/影响意义/启示/教训
- 📖 案例分析/材料解读/情境判断
- 📖 比较异同/归纳总结/评价论述
- 📖 ${isHistory ? '史料实证/历史解释/时空观念' : isGeography ? '区域认知/综合思维/人地协调观' : '政治认同/法治意识/公共参与'}
- 📖 课后练习/习题中考查的题型和能力层次
- 🔒 必须逐条标注，绝不将多个知识点合并为一条
- 🔒 先通读确认段落整体内容类型，再逐条精准标注
${isPrimary ? '- 🔧 小学：常识性了解、行为规范、简单地图识别、身边的社会现象\n' : ''}${isJunior ? '- 🔧 初中：系统知识体系、综合分析能力、材料题/简答题\n' : ''}${isSenior ? '- 🔧 高中：深度理论理解、多角度分析、论述题/综合探究\n' : ''}`;
  } else if (isIT) {
    return `【信息科技学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 💻 概念/术语：每个独立标注
- 💻 操作步骤/流程/命令
- 💻 编程知识点：语法、算法、数据结构
- 💻 软件应用/工具使用
- 💻 信息安全/网络道德
- 💻 项目实践/案例应用
- 🔒 必须逐条标注，绝不将多个知识点合并为一条
${isPrimary ? '- 🔧 小学：计算机基础操作、图形化编程、信息意识\n' : ''}${isJunior ? '- 🔧 初中：办公软件、简单编程、网络基础\n' : ''}${isSenior ? '- 🔧 高中：算法设计、数据处理、人工智能初步\n' : ''}`;
  } else if (isMusic || isArt || isPE) {
    return `【${s}学科专项提取规则——通读全文，不得遗漏任何知识内容】
- 核心概念/术语/技法：每个独立标注
- 作品/曲目/运动项目及其要点
- 鉴赏/欣赏/评价要点
- 实践/操作/训练要求
- 课后练习/活动考查的内容
- 🔒 必须逐条标注，绝不将多个知识点合并为一条`;
  }
  return '';
})()}

【提取规范】
- 🔧 数量不设硬上限：知识点数量由原文内容密度决定，每有一个独立可教学的要点就提取一个，不遗漏、不凑数
- 🔧 原文引证约束：每个知识点必须能在原文中找到直接依据，不得凭学科经验臆造原文未涉及的内容
- 🔧 禁止拆分凑数：不得把同一个知识点换几种说法拆成多个条目来凑量
- 🔧 粒度标准：specificConcepts 分解到"可独立教学/考查的最小知识点"粒度即可，最多4个；suggestedQuestionTypes 给出1-3个最匹配的题型
- 🔧 主题词按原文篇幅匹配：短文（<5段）2-3个主题词，长文3-6个，以能概括全文核心内容为准
- 🔧 JSON 字段值尽量简短，不要写长句子
- 🔧 所有输出字段必须使用中文（教材原文为英文时，知识点/主题词用中文描述原文含义）`;

      // 🔧 检测文本模型状态
      console.log('🔥 教材特征分析：检查文本模型状态...');
      let textModelAvailable = true;
      try {
        const textModelResult = await checkModelReady(null, 3, 'text');
        
        if (!textModelResult.ready) {
          console.warn(`⚠️ 文本模型未就绪: ${textModelResult.error?.message || '未知错误'}`);
          textModelAvailable = false;
          
          if (textModelResult.error && textModelResult.error.message.includes('配置错误')) {
            console.error('❌ 文本模型配置错误，将跳过特征分析步骤');
            return {
              visualDescription: '',
              formulas: [],
              coreTopics: '',
              knowledgePoints: [],
              knowledgeHierarchy: [],
              competency: '理解',
              style: '传统',
              analysisSkipped: true,
              skipReason: textModelResult.error.message
            };
          }
          
          const additionalWait = Math.max(2000, Math.min(5000, textModelResult.responseTime / 10));
          await new Promise(r => setTimeout(r, additionalWait));
        } else {
          console.log(`✅ 文本模型已就绪，立即开始分析（响应时间: ${textModelResult.responseTime}ms）`);
          if (textModelResult.responseTime > 20000) {
            const extraWait = Math.min(5000, Math.max(3000, textModelResult.responseTime / 10));
            console.log(`⏳ 模型刚加载完成，额外等待${extraWait/1000}秒确保完全预热...`);
            await new Promise(r => setTimeout(r, extraWait));
          }
        }
      } catch (e) {
        console.warn('⚠️ 文本模型检测失败，等待3秒后继续...', e.message);
        textModelAvailable = false;
        await new Promise(r => setTimeout(r, 3000));
      }
      
      if (!textModelAvailable) {
        console.warn('⚠️ 文本模型不可用，跳过特征分析');
        return {
          visualDescription: '',
          formulas: [],
          coreTopics: '',
          knowledgePoints: [],
          knowledgeHierarchy: [],
          competency: '理解',
          style: '传统',
          analysisSkipped: true,
          skipReason: '文本模型不可用'
        };
      }

      const response = await callAI(analysisPrompt, { 
        taskType: 'analysis',
        temperature: 0.1,
        timeout: 300000,
        // 🔧 推理模型(R1)思考链+输出共享，不硬编码maxTokens，走config统一配置(8192)
      });
      
      console.log(`✅ 教材特征分析完成，响应长度: ${response?.length || 0}字`);
  
      try {
        const parsed = await robustJsonParse(
          response,
          (retryPrompt) => callAI(retryPrompt, { taskType: 'analysis', temperature: 0.1 }),
          '教材特征分析',
          'analysis'
        );
        result.visualDescription = parsed.visualDescription || '';
        result.formulas = parsed.formulas || [];
        result.coreTopics = parsed.coreTopics || '';
        result.knowledgeHierarchy = parsed.knowledgeHierarchy || [];
      } catch (e) {
        console.error('❌ JSON 解析失败:', e.message);
      }
    } catch (e) {
      console.error('❌ AI 分析异常:', e.message);
    }
    
    // ✨ 从层级结构中提取扁平知识点
    const flatKnowledgePoints = [];
    if (result.knowledgeHierarchy && result.knowledgeHierarchy.length > 0) {
      for (const bigConcept of result.knowledgeHierarchy) {
        for (const core of (bigConcept.coreKnowledge || [])) {
          flatKnowledgePoints.push(core.name);
          if (core.specificConcepts) {
            flatKnowledgePoints.push(...core.specificConcepts);
          }
        }
      }
    }
    
    return {
      ...result,
      knowledgePoints: flatKnowledgePoints,
      competency: extractGradeNum(grade) <= 6 ? '识记与理解' : '应用与分析',
      style: '传统'
    };
  };

  // ==================== 全面分析模板图片 ====================
  const analyzeTemplateImageFull = async (imageBase64, subject, stage, grade, preExtractedText = '', imagePath = '') => {
      let rawText = '';
      let ocrQuality = { quality: 'unknown', reason: '' };

      // 🔧 如果已传入预提取的原文，跳过OCR
      if (preExtractedText && preExtractedText.trim().length >= 10) {
        rawText = preExtractedText;
        ocrQuality = checkOCRQuality(rawText, subject);
        console.log('📖 使用预提取的模板原文，长度:', rawText.length);
      } else {
        // 🔧 重构：使用 extractTextRobustly 统一 OCR 入口
        const ocrResult = await extractTextRobustly(imageBase64, { subject, stage, imagePath });
        rawText = ocrResult.text || '';
        ocrQuality = { quality: ocrResult.ocrQuality || 'unknown', reason: '' };
        console.log('📖 模板原文提取结果长度:', rawText?.length || 0, '栏数:', ocrResult.columnType || '未知');
      }

      // 如果仍然失败，返回降级结果
      if (!rawText || rawText.trim().length < 10) {
        console.error('❌ 模板原文提取完全失败');
        return {
          rawText: rawText || '',
          structure: [],
          scoreDistribution: '原文提取失败，请手动填写',
          questionStyle: '',
          difficultyLevel: '',
          questionCards: [],
          ocrQuality: 'poor'
        };
      }

      console.log(`📖 OCR质量: ${ocrQuality.quality} - ${ocrQuality.reason}`);

      // 第二步：分步分析模板结构（拆分为两步，避免长prompt超时）
      let analysisResult = { 
        structure: [], 
        scoreDistribution: '', 
        questionStyle: '', 
        difficultyLevel: '',
        questionCards: [],
        languageStyle: null,
        formatStyle: null
      };

      // 🔧 优化：如果已预提取原文，使用完整原文，不压缩
      const rawTextLength = rawText.length;
      console.log(`📖 模板原文长度: ${rawTextLength}字`);
      
      // 🔧 新增：检查原文质量
      if (rawTextLength < 50) {
        console.warn('⚠️ 模板原文过短，可能OCR失败');
        return {
          rawText,
          structure: [],
          scoreDistribution: '原文过短，请重新上传',
          questionStyle: '',
          difficultyLevel: '',
          questionCards: [],
          ocrQuality: 'poor'
        };
      }
      
      // 🔧 修复F：在分析前先修复选项粘连
      let analysisText = _fixTemplateOptionGlue(rawText);
      
      // 🔧 新增：模板原文清理（过滤水印、页眉页脚等）
      const cleanTemplateText = (text) => {
        let cleaned = text;
        
        // 1. 过滤常见水印（保留与教学内容相关的水印）
        cleaned = cleaned.replace(/\n?\s*[\u4e00-\u9fa5]{2,4}(教育|学校|培训|机构|课堂|网校)[\s\S]{0,10}?\n?/g, '');
        cleaned = cleaned.replace(/\n?\s*www\.[a-zA-Z0-9.-]+\.[a-z]{2,6}\s*\n?/gi, '');
        cleaned = cleaned.replace(/\n?\s*\d{3,4}-?\d{7,8}\s*\n?/g, '');
        
        // 2. 过滤纯页码（但保留包含章节信息的页眉）
        // ✅ 保留："第一单元 基础知识 - 1 -" "第二章 力学 第5页"
        // ❌ 删除："第 1 页" "— 1 —" "· 1 ·" "Page 1"
        cleaned = cleaned.replace(/^\s*第\s*\d+\s*页\s*$/gm, '');  // 纯"第X页"
        cleaned = cleaned.replace(/^\s*Page\s*\d+\s*$/gmi, '');  // 纯"Page X"
        cleaned = cleaned.replace(/^\s*[—―]\s*\d+\s*[—―]\s*$/gm, '');  // 纯"— X —"
        cleaned = cleaned.replace(/^\s*·\s*\d+\s*·\s*$/gm, '');  // 纯"· X ·"
        
        // 3. 过滤装饰性符号
        cleaned = cleaned.replace(/^\s*[*=_-]{3,}\s*$/gm, '');
        
        // 4. 压缩空行
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        
        return cleaned.trim();
      };
      
      rawText = cleanTemplateText(rawText);
      console.log(`📖 模板原文清理后长度: ${rawText.length}字`);
      
      // 只对未预提取的单页OCR做限制（单页一般不超过3000字）
      if (!preExtractedText && rawTextLength > 3000) {
        const headPart = rawText.substring(0, 1500);
        const tailPart = rawText.substring(rawTextLength - 1500);
        analysisText = headPart + '\n...（共' + rawTextLength + '字，中间部分省略）...\n' + tailPart;
      }

      // 🔧 增强：OCR质量检测 + 自动修复
      const ocrIssues = [];
      
      // 检测选项粘连并自动修复
      if (/[A-D]\.[^A-D]*[A-D]\./.test(analysisText)) {
        ocrIssues.push('选项可能粘连（缺少分隔符）');
        // 🔧 自动修复：在选项之间插入分隔符
        const beforeFix = analysisText;
        // 匹配 A.xxxB.xxx 模式，在字母前插入空格分隔
        analysisText = analysisText.replace(/([A-D])\.(\D*?)([A-D])\./g, '$1.$2 $3.');
        // 如果修复后还有问题，再做一次（处理 A.B.C.D. 紧密粘连的情况）
        analysisText = analysisText.replace(/([A-D])\.(\S)/g, '$1. $2');
        if (analysisText !== beforeFix) {
          console.log('🔧 选项粘连已自动修复');
          ocrIssues[0] += '（已自动修复）';
        }
      }
      
      // 检测异常字符
      const gibberishCount = (analysisText.match(/[□■◆◇○●△▲▽▼]/g) || []).length;
      if (gibberishCount > 3) {
        ocrIssues.push('发现' + gibberishCount + '个异常字符，公式可能丢失');
      }
      
      if (ocrIssues.length > 0) {
        console.warn('⚠️ 模板OCR质量预警:', ocrIssues.join('；'));
      }

      try {
        // 🔧 修复：长文本分段分析，确保完整性
        // 🔧 优化：增大分段大小到2500字，减少AI调用次数，降低超时风险
        const MAX_CHUNK_SIZE = 2500;
        let allStructure = new Set();
        let allScoreDistribution = new Set();
        let allQuestionStyle = new Set();
        let allDifficultyLevel = new Set();
        let allQuestionCards = [];
        let allLanguageStyle = null;
        let allFormatStyle = null;
        
        // 将原文按 MAX_CHUNK_SIZE 分段（在句号处断句）
        const chunks = [];
        let remaining = analysisText;
        while (remaining.length > 0) {
          if (remaining.length <= MAX_CHUNK_SIZE) {
            chunks.push(remaining);
            break;
          }
          // 优先在句号处断句
          let cutPos = remaining.lastIndexOf('。', MAX_CHUNK_SIZE);
          if (cutPos < MAX_CHUNK_SIZE * 0.5) {
            cutPos = remaining.lastIndexOf('\n', MAX_CHUNK_SIZE);
          }
          if (cutPos < MAX_CHUNK_SIZE * 0.3) {
            cutPos = MAX_CHUNK_SIZE;
          }
          chunks.push(remaining.substring(0, cutPos + 1));
          remaining = remaining.substring(cutPos + 1);
        }
        
        // 🔧 如果只有1段，不需要分段
        if (chunks.length <= 1) {
          console.log('📄 原文长度适中，单次分析');
          // 直接分析
          // 🔧 从指令库获取分析规范块，优先用库、硬编码兜底
          const analysisRules = getMatchingBlockInstructions({ category: '分析-文本分析规范' });
          const analysisExamples = getMatchingBlockInstructions({ category: '分析-分析模板示例' });
          const analysisExtractReqs = getMatchingBlockInstructions({ category: '分析-分析提取要求' });
          const fmtNote = analysisRules.find(b => b.id.includes('fmt_note'));
          const corePrinciple = analysisRules.find(b => b.id.includes('core_principle'));
          const mandRules = analysisRules.find(b => b.id.includes('mandatory_rules_full'));
          const diffRules = analysisRules.find(b => b.id.includes('difficulty_rules_full'));
          const examplesFull = analysisExamples.find(b => b.id.includes('examples_full'));
          const errorEx = analysisExamples.find(b => b.id.includes('error_examples'));
          const extractReqs = analysisExtractReqs.find(b => b.id.includes('extraction_reqs'));

          // 🔧 构建分析块字符串：指令库优先，硬编码兜底
          const fmtNoteStr = fmtNote ? fmtNote.content : `- **加粗文字** 表示重点概念、关键词或考点
- _下划线文字_ 表示需要特别关注的部分
- ==高亮文字== 表示极其重要的考点
- *斜体文字* 表示补充说明或注释
- ~~删除线~~ 表示已删除或不适用的内容
⚠️ 重要：这些格式标记是原文的一部分，请在提取时保留它们的语义信息！`;
          const corePrincipleStr = corePrinciple ? corePrinciple.content : `⚠️ 严禁任何形式的归纳、改写、标准化、总结！
⚠️ 原文写什么就填什么，一个字都不能改！`;
          const mandRulesStr = mandRules ? mandRules.content : `1. 【大题名称】必须逐字复制原文中的原话，严禁任何归纳、改写、标准化\n   - ✅ 正确："一、读下面的语段，按要求完成练习"\n   - ❌ 错误："阅读理解题"（这是归纳，禁止！）\n   - ✅ 正确："三、语文与生活"\n   - ❌ 错误："生活应用题"（这是归纳，禁止！）\n   - ✅ 正确："四、材料连贯性文本,完成练习"\n   - ❌ 错误："材料分析题"（这是归纳，禁止！）\n2. 【题型】必须逐字复制原文中的原话，严禁归类为标准题型\n   - ✅ 正确："读下面的语段，按要求完成练习"\n   - ❌ 错误："语段分析"（这是归纳，禁止！）\n   - ✅ 正确："选择正确的答案"\n   - ❌ 错误："选择题"（这是标准化，禁止！）\n   - ✅ 正确："语文与生活"\n   - ❌ 错误："生活应用"（这是归纳，禁止！）\n3. 【设问风格】必须直接引用原文中的原句，不要改写或总结\n   - ✅ 正确："根据语段填写词语"\n   - ❌ 错误："看拼音写词"（这是改写，禁止！）\n   - ✅ 正确："依次填入下面横线段线上的关联词语，恰当的一项是"\n   - ❌ 错误："关联词填空"（这是归纳，禁止！）\n4. 【难度】需要根据题目内容分析判断（基础/中等/较难）← 唯一可以由AI判断的字段\n5. 【分值】只有原文明确标注了才能填写；没有标注的填0，严禁自己估算\n6. 【小题序号】必须从原文中逐题提取，原文用什么序号就用什么\n7. 【小题数量】必须从原文中逐题提取，原文有几个就填几个`;
          const diffRulesStr = diffRules ? diffRules.content : `难度分为三个等级：基础、中等、较难\n\n**基础题特征**：\n- 直接考查基础知识（如看拼音写词语、词语解释、简单计算）\n- 答案唯一且明确，不需要复杂推理\n- 示例："根据拼音写出词语""计算下列算式的结果"\n\n**中等题特征**：\n- 需要理解上下文或联系多个知识点\n- 有一定推理过程，需要分析或比较\n- 示例："联系上下文理解词语含义""选择描写方法相同的句子"\n\n**较难题特征**：\n- 需要综合运用多个知识点，创造性思维\n- 开放性较强，需要深度分析\n- 示例："概括母亲对袁隆平成长产生重要影响的三件事""赏析句子的表达效果"\n\n**判断原则**：\n1. 如果原文中有明确标注（如"提高题""拓展题"），优先使用原文标注\n2. 如果没有标注，根据上述规则分析题目内容后判断\n3. 同一道大题下的小题难度可能不同，需分别判断`;
          const examplesFullStr = examplesFull ? examplesFull.content : '';
          const errorExStr = errorEx ? errorEx.content : `❌ "题型": "阅读理解" → 原文写的是"一、读下面的语段，按要求完成练习"，应该完整复制\n❌ "设问风格": "根据短文填空" → 原文写的是"根据语段填写词语"，必须逐字复制\n❌ "小题数量": 20 → 原文没有明确说明小题数量，应该根据实际提取的小题计算`;
          const extractReqsStr = extractReqs ? extractReqs.content : `1. 识别每道大题：原文中标注了"一、""二、""第一部分""专项一""第五单元"或类似标记的为大题\n2. 大题下的小题逐题提取，包括每小题序号和分值\n3. 题型名称直接用原文中的说法，原文写什么就填什么\n4. 如果原文没有大题标记，整份试卷视为一道大题，各小题直接提取\n5. 所有分值、题数、风格描述都从原文直接取，不要自己编\n6. 设问风格：该题型在原文中是如何提问的，原文用什么词就提取什么词`;

          const step2aPrompt = `你是考试命题专家。请分析以下试卷/教辅材料的原文，提取完整结构。

【格式说明——原文中的标记表示重点内容】
${fmtNoteStr}

【核心原则——除难度外，所有字段必须逐字从原文复制】
${corePrincipleStr}

【强制规则——违反将导致分析结果作废】
${mandRulesStr}

【难度分析规则——需要根据题目内容判断】
${diffRulesStr}

【原文内容】（共${rawTextLength}字）
${analysisText}

【真实教辅资料示例——理解多样性】
${examplesFullStr}

【错误示例——以下提取全部作废】
${errorExStr}

【提取要求——除难度外，所有字段直接从原文原样提取，一个字都不要改】
${extractReqsStr}

只返回 JSON：
{
  "结构分析": [
    {
      "大题": "原文中的大题名称，逐字复制",
      "大题分值": 原文中的分值或0,
      "小题数量": 原文中的小题数,
      "每小题分值": 原文中的分值或0,
      "题型": "原文中的题型名称，逐字复制",
      "设问风格": "原文中的设问原句，逐字复制",
      "难度": "根据题目内容分析得出（基础/中等/较难）",
      "小题列表": [
        {"小题序号": "原文中的序号", "分值": 原文中的分值或0}
      ]
    }
  ],
  "总题数": 所有小题数量之和,
  "总分": 所有大题分值之和
}

只返回JSON，不要其他内容。
- 🔧 所有输出字段必须使用中文（即使原文为英文，题型名称等也请用中文描述）`;

          const response2a = await callAI(step2aPrompt, { 
            taskType: 'generation',
            temperature: 0.1,
            timeout: 180000
          });
      
          try {
            const parsed = await robustJsonParse(response2a, null, '模板结构分析-步骤a');
            analysisResult.结构分析 = Array.isArray(parsed.结构分析) ? parsed.结构分析 : [];
            analysisResult.总题数 = parsed.总题数 || 0;
            analysisResult.总分 = parsed.总分 || 0;
          } catch (e) {
            console.warn('步骤2a解析失败，尝试从原文推断:', e.message);
            analysisResult.结构分析 = [];
            analysisResult.总题数 = 0;
            analysisResult.总分 = 0;
          }

          // 🔧 优化：简化语言风格分析，减少超时风险
          console.log('🎨 开始提取语言风格...');
          const stylePrompt = `你是考试命题专家。请简要分析以下试卷的语言风格特征。

【原文内容】（截取前500字）
${analysisText.substring(0, 500)}

只返回JSON（字段可以为空字符串或null）：
{
  "languageStyle": { 
    "avgSentenceLength": 35,
    "commonPatterns": [],
    "connectors": [],
    "contextIntro": "",
    "personReference": "",
    "tone": "",
    "sampleSentence": ""
  },
  "formatStyle": { 
    "spacingBetweenQuestions": true,
    "indentation": "",
    "scorePosition": "",
    "chartDescriptionFormat": ""
  }
}

只返回JSON。`;

          // 🔧 优化：语言风格分析前检测模型状态
          console.log('🔥 语言风格分析：检查模型状态...');
          try {
            const result = await checkModelReady(null, 3, 'text');
            
            if (!result.ready) {
              console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${result.responseTime}ms)`);
              const additionalWait = Math.max(2000, Math.min(4000, result.responseTime / 10));
              await new Promise(r => setTimeout(r, additionalWait));
            } else {
              console.log(`✅ 文本模型已就绪，立即开始语言风格分析（响应时间: ${result.responseTime}ms, 尝试${result.attempts}次）`);
            }
          } catch (e) {
            console.warn('⚠️ 模型检测失败，等待3秒后继续...', e.message);
            await new Promise(r => setTimeout(r, 3000));
          }

          try {
            const styleResponse = await callAI(stylePrompt, { 
              taskType: 'generation',  // 🔧 修复：DeepSeek 引擎不支持 formatting
              temperature: 0.1,
              timeout: 60000  // 🔧 优化：60秒（1分钟）
            });
            const styleParsed = await robustJsonParse(styleResponse, null, '语言风格提取');
            analysisResult.languageStyle = styleParsed.languageStyle || null;
            analysisResult.formatStyle = styleParsed.formatStyle || null;
            console.log('✅ 语言风格提取完成');
          } catch (e) {
            console.warn('语言风格提取失败，使用默认值:', e.message);
            // 🔧 提供合理的默认值，不影响后续生成
            analysisResult.languageStyle = {
              avgSentenceLength: 35,
              commonPatterns: ["直接设问", "情境引入"],
              connectors: ["因此", "所以", "但是"],
              contextIntro: "通过生活情境引入",
              personReference: "第二人称“你”",
              tone: "亲切、引导性",
              sampleSentence: "请根据所学知识回答问题"
            };
            analysisResult.formatStyle = {
              spacingBetweenQuestions: true,
              indentation: "首行缩进2字符",
              scorePosition: "题干末尾括号内",
              chartDescriptionFormat: "图表下方说明"
            };
            console.log('⚠️ 使用默认语言风格');
          }
        } else {
          // 🔧 多段：逐段分析，合并结果
          console.log(`📄 原文较长(${rawTextLength}字)，分${chunks.length}段分析（每段约${MAX_CHUNK_SIZE}字）`);
          console.log(`   各段长度: ${chunks.map((c, i) => `段${i+1}:${c.length}字`).join(', ')}`);
          
          const allStructure = new Set();
          const allScoreDistribution = new Set();
          const allQuestionStyle = new Set();
          const allDifficultyLevel = new Set();
          const allSections = [];  // 🔧 新增：收集所有大题对象
          const simplifiedRetryFlags = new Array(chunks.length).fill(false);  // 🔧 修复：用数组跟踪重试状态

          for (let ci = 0; ci < chunks.length; ci++) {
            const chunk = chunks[ci];
            const chunkLabel = chunks.length > 1 ? `（第${ci + 1}/${chunks.length}段）` : '';
            let retryCount = 0; // 🔧 新增：跟踪重试次数
            
            // 🔧 优化：每段分析前智能等待，避免连续请求导致超时
            if (ci > 0) {
              console.log(`⏰ 第${ci + 1}段分析前等待5秒，让模型恢复...`);
              await new Promise(r => setTimeout(r, 5000));
            } else {
              // 第一段：检查模型是否就绪
              console.log('🔥 模板结构分析：检查模型状态...');
              try {
                const result = await checkModelReady(null, 3, 'text');
                
                if (!result.ready) {
                  console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${result.responseTime}ms)`);
                  const additionalWait = Math.max(2000, Math.min(5000, result.responseTime / 10));
                  await new Promise(r => setTimeout(r, additionalWait));
                } else {
                  console.log(`✅ 文本分析模型已就绪，立即开始（响应时间: ${result.responseTime}ms, 尝试${result.attempts}次）`);
                }
              } catch (e) {
                console.warn('⚠️ 模型检测失败，等待3秒后继续...', e.message);
                await new Promise(r => setTimeout(r, 3000));
              }
            }    
            
            // 🔧 从指令库获取分析规范块（分段分析用精简版），优先用库、硬编码兜底
            const analysisRules = getMatchingBlockInstructions({ category: '分析-文本分析规范' });
            const fmtNote = analysisRules.find(b => b.id.includes('fmt_note'));
            const corePrinciple = analysisRules.find(b => b.id.includes('core_principle'));
            const mandRules = analysisRules.find(b => b.id.includes('mandatory_rules_compact'));
            const diffRules = analysisRules.find(b => b.id.includes('difficulty_rules_compact'));
            const fmtNoteStr = fmtNote ? fmtNote.content : `- **加粗文字** 表示重点概念、关键词或考点
- _下划线文字_ 表示需要特别关注的部分
- ==高亮文字== 表示极其重要的考点
- *斜体文字* 表示补充说明或注释
- ~~删除线~~ 表示已删除或不适用的内容
⚠️ 重要：这些格式标记是原文的一部分，请在提取时保留它们的语义信息！`;
            const corePrincipleStr = corePrinciple ? corePrinciple.content : `⚠️ 严禁任何形式的归纳、改写、标准化、总结！
⚠️ 原文写什么就填什么，一个字都不能改！`;
            const mandRulesStr = mandRules ? mandRules.content : `1. 【大题名称】必须逐字复制原文中的原话
   - ✅ 正确："一、读下面的语段，按要求完成练习"
   - ❌ 错误："阅读理解题"（这是归纳，禁止！）
   - ✅ 正确："三、语文与生活"
   - ❌ 错误："生活应用题"（这是归纳，禁止！）
2. 【题型】必须逐字复制原文中的原话
   - ✅ 正确："读下面的语段，按要求完成练习"
   - ❌ 错误："语段分析"（这是归纳，禁止！）
   - ✅ 正确："选择正确的答案"
   - ❌ 错误："选择题"（这是标准化，禁止！）
3. 【设问风格】必须直接引用原文中的原句
   - ✅ 正确："根据语段填写词语"
   - ❌ 错误："看拼音写词"（这是改写，禁止！）
4. 【难度】需要根据题目内容分析判断（基础/中等/较难）← 唯一可以由AI判断的字段
5. 【分值】只有原文明确标注了才能填写，没有标注填0
6. 【小题序号】必须从原文中逐题提取，原文用什么序号就用什么
7. 【小题数量】必须从原文中逐题提取，原文有几个就填几个`;
            const diffRulesStr = diffRules ? diffRules.content : `- 基础题：直接考查基础知识（如看拼音写词语、简单计算、词语解释）
- 中等题：需要理解上下文或联系多个知识点（如选择描写方法相同的句子）
- 较难题：需要综合运用多个知识点，创造性思维（如赏析句子表达效果、概括多件事）`;

            // 每段分析结构
            const chunkPrompt = `你是考试命题专家。请分析以下试卷片段${chunkLabel}，提取基本结构。

【格式说明——原文中的标记表示重点内容】
${fmtNoteStr}

【核心原则——除难度外，所有字段必须逐字从原文复制】
${corePrincipleStr}

【强制规则】
${mandRulesStr}

【难度分析规则】
${diffRulesStr}

【原文片段】（共${chunk.length}字）
${chunk}

只返回JSON：
{
  "结构分析": [
    {
      "大题": "原文中的大题名称，逐字复制",
      "大题分值": 原文中的分值或0,
      "小题数量": 原文中的小题数,
      "每小题分值": 原文中的分值或0,
      "题型": "原文中的题型名称，逐字复制",
      "设问风格": "原文中的设问原句，逐字复制",
      "难度": "根据题目内容分析得出（基础/中等/较难）",
      "小题列表": [
        {"小题序号": "原文中的序号", "分值": 原文中的分值或0}
      ]
    }
  ],
  "总题数": 所有小题数量之和,
  "总分": 所有大题分值之和
}

只返回JSON，不要其他内容。`;

            try {
              const chunkResponse = await callAI(chunkPrompt, { 
                taskType: 'generation',  // 🔧 修复：DeepSeek 引擎不支持 formatting
                temperature: 0.1,
                timeout: 90000
              });
              
              const parsed = await robustJsonParse(chunkResponse, null, `结构分析-段${ci + 1}`);
              
              // 🔧 新增：打印解析结果的关键信息
              console.log(`🔍 第${ci + 1}段解析结果:`, {
                has结构分析: Array.isArray(parsed.结构分析),
                hasStructure: Array.isArray(parsed.structure),
                structureLength: parsed.结构分析?.length || 0,
                keys: Object.keys(parsed).slice(0, 10)
              });
              
              // 🔧 修复：使用正确的字段名 "结构分析"（中文）
              if (Array.isArray(parsed.结构分析)) {
                parsed.结构分析.forEach(s => {
                  // 提取题型名称
                  if (s.题型) {
                    const beforeSize = allStructure.size;
                    allStructure.add(s.题型);
                    const afterSize = allStructure.size;
                    if (afterSize > beforeSize) {
                      console.log(`   📌 第${ci + 1}段新增题型: ${s.题型}`);
                    }
                  }
                  // 🔧 新增：收集完整的大题对象
                  allSections.push(s);
                });
              }
              // 兼容旧字段名
              if (Array.isArray(parsed.structure)) {
                parsed.structure.forEach(s => allStructure.add(s));
              }
              if (parsed.scoreDistribution) allScoreDistribution.add(parsed.scoreDistribution);
              if (parsed.questionStyle) allQuestionStyle.add(parsed.questionStyle);
              if (parsed.difficultyLevel) allDifficultyLevel.add(parsed.difficultyLevel);
              
              console.log(`✅ 第${ci + 1}段结构分析完成，累计题型: ${[...allStructure].length}种`);
            } catch (e) {
              console.warn(`第${ci + 1}段结构分析失败:`, e.message);
              
              // 🔧 修复：第一次失败后，尝试使用简化prompt重试（增加冷启动超时）
              if (retryCount === 0 && !simplifiedRetryFlags[ci]) {
                console.log(`🔄 第${ci + 1}段使用简化prompt重试（冷启动可能较慢）...`);
                simplifiedRetryFlags[ci] = true;
                retryCount++;
                
                const simplifiedPrompt = `请从以下试卷片段中提取题型结构。

【规则】
1. 大题名称、题型、设问风格必须逐字复制原文
2. 难度由你判断（基础/中等/较难）
3. 只返回JSON

原文：
${chunk.substring(0, 1000)}

JSON格式：
{"结构分析": [{"大题": "", "题型": "", "设问风格": "", "难度": "", "小题数量": 0, "小题列表": []}], "总题数": 0, "总分": 0}`;
                
                try {
                  const retryResponse = await callAI(simplifiedPrompt, { 
                    taskType: 'generation',  // 🔧 修复：DeepSeek 引擎不支持 formatting
                    temperature: 0.1,
                    timeout: 60000
                  });
                  
                  const parsed = await robustJsonParse(retryResponse, null, `结构分析-段${ci + 1}-重试`);
                  
                  // 🔧 修复：使用正确的字段名 "结构分析"（中文）
                  if (Array.isArray(parsed.结构分析)) {
                    parsed.结构分析.forEach(s => {
                      if (s.题型) allStructure.add(s.题型);
                      // 🔧 新增：收集完整的大题对象
                      allSections.push(s);
                    });
                  }
                  // 兼容旧字段名
                  if (Array.isArray(parsed.structure)) {
                    parsed.structure.forEach(s => allStructure.add(s));
                  }
                  if (parsed.scoreDistribution) allScoreDistribution.add(parsed.scoreDistribution);
                  if (parsed.questionStyle) allQuestionStyle.add(parsed.questionStyle);
                  if (parsed.difficultyLevel) allDifficultyLevel.add(parsed.difficultyLevel);
                  
                  console.log(`✅ 第${ci + 1}段简化重试成功，题型: ${[...allStructure].join('、')}`);
                  continue; // 重试成功，跳过降级逻辑
                } catch (retryErr) {
                  console.warn(`第${ci + 1}段简化重试也失败:`, retryErr.message);
                }
              }
              
              // 🔧 修复D：分段失败时，从原文中做简单关键词匹配作为降级
              // ⚠️ 注意：这只是降级方案，正常情况下不应该走到这里
              const fallbackTypes = [];
              const typeKeywords = {
                '选择题': ['A.', 'B.', 'C.', 'D.', 'Ａ.', 'Ｂ.', 'Ｃ.', 'Ｄ.'],
                '填空题': ['<u class="blank-', '______', '___', '（', '(  )'],
                '判断题': ['正确', '错误', '√', '×'],
                '计算题': ['计算', '算一算'],
                '解答题': ['解答', '解：'],
                '应用题': ['应用', '解决问题'],
                '实验题': ['实验', '探究'],
                '阅读理解': ['阅读', '理解'],
                '书面表达': ['写作', '作文', '书面表达']
              };
              for (const [type, keywords] of Object.entries(typeKeywords)) {
                if (keywords.some(kw => chunk.includes(kw))) {
                  fallbackTypes.push(type);
                }
              }
              if (fallbackTypes.length > 0) {
                fallbackTypes.forEach(t => allStructure.add(t));
                console.log(`🔧 第${ci + 1}段降级匹配题型: ${fallbackTypes.join('、')}`);
              } else {
                // 完全无法判断，标记为未知
                allStructure.add('未识别题型(段' + (ci + 1) + ')');
              }
            }
          }
          
          // 合并结果
          // 🔧 修复D：去除降级产生的“未识别题型”标记
          const cleanedStructure = [...allStructure].filter(s => typeof s === 'string' && !s.startsWith('未识别题型'));
          // 如果降级后仍然为空，保留原始标记用于提示用户
          analysisResult.structure = cleanedStructure.length > 0 ? cleanedStructure : [...allStructure];
                    
          // 🔧 修复：使用收集到的完整大题对象，而不是从题型名称重建
          if (allSections.length > 0) {
            analysisResult.结构分析 = allSections;
            console.log(`✅ 合并${allSections.length}个大题对象`);
          } else {
            // 降级：从题型名称重建（信息不完整）
            analysisResult.结构分析 = analysisResult.structure.map(typeName => ({
              大题: typeName,
              题型: typeName,
              设问风格: '',
              难度: '中等',
              小题数量: 0,
              小题列表: []
            }));
            console.warn('⚠️ 没有收集到大题对象，使用降级方案');
          }
          analysisResult.总题数 = 0;
          analysisResult.总分 = 0;
          
          // 检查题型数量是否合理
          if (analysisResult.structure.length <= 1 && chunks.length >= 3) {
            console.warn(`⚠️ 模板有${chunks.length}段，但仅识别到${analysisResult.structure.length}种题型，可能不完整`);
            analysisResult._structureIncomplete = true;
          }
          analysisResult.scoreDistribution = [...allScoreDistribution].join('；');
          analysisResult.questionStyle = [...allQuestionStyle].join('；');
          analysisResult.difficultyLevel = [...allDifficultyLevel].join('；');
          
          // 🔧 优化：单独提取题卡（每种题型1道代表性题目，避免输出过长被截断）
          console.log('📋 开始提取代表性题卡...');
          const cardAnalysisText = analysisText.substring(0, 1500);
          
          // 构建已知题型列表，确保覆盖所有题型
          const knownTypes = analysisResult.structure || [];
          const typesList = knownTypes.length > 0 
            ? `\n【已知题型】（必须为以下每种题型提取题目）\n${knownTypes.map(s => s.题型 || s).join('、')}`
            : '';
          
          const step2bPrompt = `你是考试命题专家。请基于以下试卷片段，提取**每种题型的1道代表性题目**。

【原文内容】（截取前1500字）
${cardAnalysisText}
${typesList}

【重要——提取要求】
1. 每种题型只提取1道题（最多6道题）
2. 优先选择题干完整、有代表性的题目
3. 题干必须逐字复制原文，一个字都不能改
4. options字段：选择题保留A/B/C/D选项，非选择题填空字符串数组
5. score：原文标注了分值的按原文填，未标注的填0
6. questionFeature：概括该题的设问特征，10字以内
7. 如果某题型在原文中找不到，跳过该题型

请提取并只返回JSON：
{
  "questionCards": [
    {
      "number": 1,
      "type": "选择题",
      "stem": "逐字复制的完整题干",
      "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
      "score": 3,
      "knowledgePoint": "",
      "difficulty": "基础",
      "questionFeature": "设问特征"
    }
  ]
}

只返回JSON。`;

          // 🔧 优化：题卡分析前检测模型状态
          console.log('🔥 题卡分析：检查模型状态...');
          try {
            const result = await checkModelReady(null, 3, 'text');
            
            if (!result.ready) {
              console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${result.responseTime}ms)`);
              const additionalWait = Math.max(2000, Math.min(5000, result.responseTime / 10));
              await new Promise(r => setTimeout(r, additionalWait));
            } else {
              console.log(`✅ 模型已就绪，立即开始题卡分析（响应时间: ${result.responseTime}ms, 尝试${result.attempts}次）`);
            }
          } catch (e) {
            console.warn('⚠️ 模型检测失败，等待3秒后继续...', e.message);
            await new Promise(r => setTimeout(r, 3000));
          }

          // 🔧 优化：增加降级策略，第一次失败后尝试简化版
          try {
            const response2b = await callAI(step2bPrompt, { 
              taskType: 'generation',  // 🔧 修复：DeepSeek 引擎不支持 formatting
              temperature: 0.1,
              timeout: 120000  // 第一次尝试：120秒
            });
            const parsed = await robustJsonParse(response2b, null, '模板结构分析-步骤b');
            analysisResult.questionCards = Array.isArray(parsed.questionCards) ? parsed.questionCards : [];
            console.log(`✅ 题卡提取完成，共${analysisResult.questionCards.length}道代表性题目`);
          } catch (e) {
            console.warn('详细题卡分析超时，尝试简化版...', e.message);
            
            // 降级：极简版题卡分析（每种题型1道，只提取题干和题型）
            try {
              const simplifiedPrompt = `请从以下试卷中每种题型提取1道代表性题目，只返回题号、题型和题干。

【原文】
${cardAnalysisText.substring(0, 1000)}

返回JSON：{"questionCards": [{"number": 1, "type": "选择题", "stem": "题干原文", "options": [], "score": 0, "knowledgePoint": "", "difficulty": "基础", "questionFeature": ""}]}

只返回JSON，每个题干不超过200字。`;
              
              const response = await callAI(simplifiedPrompt, { 
                taskType: 'generation',  // 🔧 修复：DeepSeek 引擎不支持 formatting
                temperature: 0.1,
                timeout: 60000  // 简化版：60秒
              });
              const parsed = await robustJsonParse(response, null, '简化题卡分析');
              analysisResult.questionCards = Array.isArray(parsed.questionCards) ? parsed.questionCards : [];
              console.log(`⚠️ 使用简化题卡，共${analysisResult.questionCards.length}道`);
            } catch (e2) {
              console.error('题卡分析完全失败:', e2.message);
              analysisResult.questionCards = [];
            }
          }
        }
      } catch (e) {
        console.error('模板结构分析失败:', e);
      }

      // 🔧 新增：模板原文结构化标记（便于AI识别题型结构）
      const enhancedRawText = _addTemplateStructureMarkers(rawText);
      
      return {
        rawText: enhancedRawText,  // 🔧 使用增强后的原文
        ...analysisResult,
        languageStyle: analysisResult.languageStyle || null,
        formatStyle: analysisResult.formatStyle || null,
        ocrQuality: ocrQuality.quality
      };
  };

  // ==================== 年级-学科可用性感知 ====================
  // 返回该学科在指定学段+年级的提示信息，若该年级尚未开设则返回空字符串
  // 🔑 提示文本从指令库获取，年级边界条件在代码中判断
  const getSubjectGradeHint = (subject, stage, gradeNum) => {
    // 仅物化生地四科有"从某年级开始/结束"的边界，其他学科从1年级起始终开设，无需查询指令库
    const boundarySubjects = ['物理', '化学', '生物', '地理'];
    if (!boundarySubjects.includes(subject)) return '';
    // 🔧 primary 需按年级精确到 primary_low/mid/high，否则匹配不到指令库条目
    const preciseStage = stage === 'primary'
      ? (gradeNum <= 2 ? 'primary_low' : gradeNum <= 4 ? 'primary_mid' : 'primary_high')
      : stage;
    // 从指令库查询该学科的年级边界提示
    const blocks = getMatchingBlockInstructions({ category: '生成-年级边界提示', subject, stage: preciseStage });
    if (blocks.length === 0) return '';
    
    // 🔧 从指令库 content 中解析年级边界元数据（type/startGrade/endGrade），消除硬编码 gradeRules
    const content = blocks[0].content;
    const typeMatch = content.match(/\[type=(\w+)\]/);
    const startMatch = content.match(/\[startGrade=(\d+)\]/);
    const endMatch = content.match(/\[endGrade=(\d+)\]/);
    if (!typeMatch) return '';
    
    const ruleType = typeMatch[1];
    const hintMatch = content.match(/提示词：(.+)/);
    const hintText = hintMatch ? hintMatch[1] : '';
    if (!hintText) return '';
    
    // 检查年级是否在范围内
    if (ruleType === 'start' && startMatch && gradeNum > 0 && gradeNum < parseInt(startMatch[1])) {
      return hintText;
    }
    if (ruleType === 'end' && endMatch && gradeNum > 0 && gradeNum > parseInt(endMatch[1])) {
      return hintText;
    }
    
    return '';
  };

  // 🔧 试卷/课时练题型框架：原则导向，不注入硬编码题量数字
  // DeepSeek 根据文本内容自主决定各层级的具体题量和题型
  // 🔧 从 stageMap 推导权威难度比例（当用户未自定义时以此为准）
  // 🔧 值从指令库「生成-难度配置」解析，兜底保留硬编码
  const getStageDifficultyRatio = (stage, isLowerPrimary, isMiddlePrimary, isUpperPrimary, genType = 'exam') => {
    // 构造 gradeSegment 用于指令库匹配
    const gradeSegment = stage === 'primary'
      ? (isLowerPrimary ? 'primary_low' : isMiddlePrimary ? 'primary_mid' : 'primary_high')
      : stage || 'middle';
    // 指令库目前仅 exam 类型有难度配置，其他 genType 统一兜底 exam（避免 [instruction-miss] 噪音）
    const blocks = getMatchingBlockInstructions({ category: '生成-难度配置', stage: gradeSegment, genType: 'exam' });
    if (blocks.length > 0) {
      const content = blocks[0].content;
      const basicMatch = content.match(/basic=(\d+)/);
      const mediumMatch = content.match(/medium=(\d+)/);
      const advancedMatch = content.match(/advanced=(\d+)/);
      if (basicMatch && mediumMatch && advancedMatch) {
        return {
          basic: parseInt(basicMatch[1]),
          medium: parseInt(mediumMatch[1]),
          advanced: parseInt(advancedMatch[1]),
        };
      }
    }
    // 指令库无匹配时返回 null，不使用硬编码兜底
    console.warn(`[instructionLib] 未找到匹配的难度配置: gradeSegment=${gradeSegment}`);
    return null;
  };

  // 🔧 页数指导：按学段区分，试卷/复习单独加量（DeepSeek 输出更完整）
  //    小学 6页（试卷10页/复习8页）/ 初中 8页（试卷12页/复习10页）/ 高中 10页（试卷14页/复习12页）
  const getPageCount = (genType, stage) => {
    const PAGE_MAP = {
      primary: { exam: 10, review: 8, default: 6 },
      middle:  { exam: 12, review: 10, default: 8 },
      high:    { exam: 14, review: 12, default: 10 },
    };
    const entry = PAGE_MAP[stage] || PAGE_MAP.primary;
    return entry[genType] || entry.default;
  };

  // 🔧 智能默认总分：对标现行考试标准
  // 🔧 值从指令库「生成-难度配置」解析，兜底保留硬编码
  const getDefaultTotalScore = (genType, subject, stage) => {
    if (genType !== 'exam') return 0;
    const blocks = getMatchingBlockInstructions({ category: '生成-难度配置', stage, genType: 'exam' });
    if (blocks.length > 0) {
      const content = blocks[0].content;
      const mainMatch = content.match(/totalScore_main=(\d+)/);
      const otherMatch = content.match(/totalScore_other=(\d+)/);
      const scoreMatch = content.match(/totalScore=(\d+)/);
      const mainSubjects = ['语文', '数学', '英语'];
      const isMain = mainSubjects.includes(subject);
      
      if (mainMatch && isMain) return parseInt(mainMatch[1]);
      if (otherMatch && !isMain) return parseInt(otherMatch[1]);
      if (scoreMatch) return parseInt(scoreMatch[1]);
    }
    // 指令库无匹配时返回 0，不使用硬编码兜底
    console.warn(`[instructionLib] 未找到匹配的总分配置: stage=${stage}, genType=${genType}`);
    return 0;
  };

  // 🔧 检测 questionTypes 是否使用默认值（空数组或旧三件套）
  const isDefaultQuestionTypes = (questionTypes) => {
    if (!questionTypes || questionTypes.length === 0) return true;
    if (questionTypes.length !== 3) return false;
    const names = questionTypes.map(q => q.name).sort().join(',');
    return names === '填空题,解答题,选择题';
  };

  // 🔧 从指令库获取题型分布结构化数据（用于 UI 自动填充）
  const getTypeDistribution = (genType, subject, gradeSegment) => {
    if (genType !== 'exam' && genType !== 'practice') return [];
    const blocks = getMatchingBlockInstructions({ category: '生成-题型分布建议', subject, stage: gradeSegment, genType });
    if (blocks.length === 0 || !blocks[0].typeDist) return [];
    const dist = blocks[0].typeDist;
    // 解析 "题型名:min-max,题型名:min-max,..."
    return dist.split(',').map(item => {
      const match = item.trim().match(/^(.+):(\d+)-(\d+)$/);
      if (!match) return null;
      const [, name, min, max] = match;
      return {
        name: name.trim(),
        selected: true,
        count: Math.ceil((parseInt(min) + parseInt(max)) / 2),
        score: null
      };
    }).filter(Boolean);
  };

  // ═══════════════════════════════════════
  // 🔧 教辅质量对标辅助函数（Q1-Q4）
  // ═══════════════════════════════════════

  // Q2: 知识点穷尽覆盖约束（优先从指令库读取；仅 summary/preview/special 有覆盖条目，其他 genType 静默返回空）
  const getCoverageConstraint = (genType, subject, stage, specialSubType = '') => {
    // 仅 summary/preview/special 有知识点全覆盖条目，其他类型（exam/practice/dictation/errorbook/reading）无需覆盖约束
    const coverageGenTypes = ['summary', 'preview', 'special'];
    if (!genType || !coverageGenTypes.includes(genType)) return '';
    const coverageBlocks = getMatchingBlockInstructions({ category: '生成-知识点全覆盖', subject, stage, genType, specialSubType: genType === 'special' ? specialSubType : '' });
    if (coverageBlocks.length > 0) {
      const _covTitleBlocks = getMatchingBlockInstructions({ category: '生成-指令块标题', subject: '', stage: '', genType: 'coverage_constraint' });
      const _covTitle = _covTitleBlocks.length > 0 ? _covTitleBlocks[0].content : '知识点全覆盖';
      return '\n⚠️ 【' + _covTitle + '】' + coverageBlocks[0].content;
    }
    // practice/exam 等逐题型不需要知识点全覆盖约束，静默返回空即可
    return '';
  };

  // Q1: 答案与解析质量规范（按 genType × 学科）
  // 🔧 Q7: 答案质量标准 — 完全从指令库读取，不再硬编码
  const getAnswerQualitySpec = (genType, subject, stage, specialSubType = '') => {
    // 🔧 优先从指令库查询：按 genType+subject 精确匹配
    if (!genType) return '';
    const answerBlocks = getMatchingBlockInstructions({ category: '生成-答案与解析规范', subject, genType, specialSubType: genType === 'special' ? specialSubType : '' });
    if (answerBlocks.length > 0) {
      // 🔧 收集：所有通用规范（subject为空且非标题文案）+ 学科专属规范
      const generalBlocks = answerBlocks.filter(b =>
        (!b.subject || b.subject === '') && !b.id.startsWith('block_answer_spec')
      );
      const subjectBlocks = answerBlocks.filter(b =>
        b.subject && b.subject !== '' && b.subject.split(',').includes(subject)
      );
      // 去重合并：通用规范在前，学科补充在后
      const merged = [...generalBlocks];
      for (const sb of subjectBlocks) {
        if (!merged.find(m => m.id === sb.id)) merged.push(sb);
      }
      if (merged.length > 0) return merged.map(b => b.content).join('\n');
    }
    // 🔧 无匹配时返回空（不允许硬编码兜底）
    console.warn(`[instructionLib] 未找到匹配的答案与解析规范: genType=${genType}, subject=${subject}`);
    return '';
  };

  // Q3: 主观题评分标准（完全从指令库读取）
  const getScoringRubric = (genType, subject, stage) => {
    // 🔧 仅试卷(exam)需要评分标准，课时练(practice)无需分值/评分相关指令
    if (genType !== 'exam') return '';
    
    // 🔧 从指令库读取匹配的评分标准
    const rubricBlocks = subject ? getMatchingBlockInstructions({ category: '生成-主观题评分标准', subject, stage: '', genType }) : [];
    if (rubricBlocks.length > 0) {
      return '\n【主观题评分标准参考】\n' + rubricBlocks[0].content;
    }
    
    // 无指令库匹配时返回空（不硬编码兜底）
    console.warn(`[instructionLib] 未找到主观题评分标准: subject=${subject}`);
    return '';
  };

  // Q4: 语文阅读理解答题模板（完全从指令库读取；仅 exam/practice/special/reading 需要，dictation/summary/preview/errorbook 不适用）
  const getChineseReadingTemplates = (subject, genType, stage) => {
    if (subject !== '语文') return '';
    // 🔴 真题卷根治：低段（1-2年级）不适用初高中答题模板（主旨概括/人物分析等），避免超学段要求
    if (stage && String(stage).startsWith('primary_low')) return '';
    const applicableGenTypes = ['exam', 'practice', 'special', 'reading'];
    if (genType && !applicableGenTypes.includes(genType)) return '';
    const templateBlocks = getMatchingBlockInstructions({ category: '生成-答题模板', subject: '语文', stage: '', genType });
    if (templateBlocks.length > 0) {
      return `\n【语文阅读理解答题模板——严格按此框架作答】\n` + templateBlocks[0].content;
    }
    // 无指令库匹配时返回空（不硬编码兜底）
    console.warn('[instructionLib] 未找到语文阅读理解答题模板');
    return '';
  };

  // 🔧 Q7: 考卷时间分配 — 完全从指令库读取
  const getTimeAllocation = (genType, subject, stage) => {
    if (genType !== 'exam' || !stage) return '';
    const timeBlocks = getMatchingBlockInstructions({ category: '生成-时间分配', genType, stage });
    if (timeBlocks.length > 0) {
      return `\n【时间分配建议】${timeBlocks[0].content}`;
    }
    console.warn(`[instructionLib] 未找到匹配的时间分配: stage=${stage}, genType=${genType}`);
    return '';
  };

  // ═══════════════════════════════════════
  // Fix A: Few-shot 质量范例（完全从指令库读取）
  // ═══════════════════════════════════════
  const getGenTypeExample = (genType, subject, stage, isLowerPrimary, grade, gradeSegment, specialSubType = '') => {
    // 🔧 从指令库查询匹配的质量范例
    const tryInstructionLib = () => {
      // 先尝试 gradeSegment 精确匹配（如低段专用范例）
      const stageMatch = getMatchingBlockInstructions({ category: '生成-质量范例', subject, stage: gradeSegment, genType, specialSubType: genType === 'special' ? specialSubType : '' });
      if (stageMatch.length > 0) return `\n【质量范例——${stageMatch[0].name.replace('【质量范例】', '')}】\n⚠️ 以下为格式示例，题量数字为示例仅供参考，实际题量由你根据文本内容灵活决定。\n${stageMatch[0].content}`;
      // 再尝试不限定 stage（通用范例）
      const generalMatch = getMatchingBlockInstructions({ category: '生成-质量范例', subject, stage: '', genType, specialSubType: genType === 'special' ? specialSubType : '' });
      if (generalMatch.length > 0) return `\n【质量范例——${generalMatch[0].name.replace('【质量范例】', '')}】\n⚠️ 以下为格式示例，题量数字为示例仅供参考，实际题量由你根据文本内容灵活决定。\n${generalMatch[0].content}`;
      return null;
    };
    
    const result = tryInstructionLib();
    if (result) return result;
    
    // 无指令库匹配时返回空（不硬编码兜底）
    console.warn(`[instructionLib] 未找到质量范例: genType=${genType}, subject=${subject}, stage=${stage}`);
    return '';
  };

  // 🔧 Q7: 知识边界约束 — 完全从指令库读取
  const getKnowledgeBoundaries = (subject, stage, isLowerPrimary, isMiddlePrimary, isUpperPrimary, grade) => {
    if (!subject) return '';
    // 🔧 计算 gradeSegment 用于指令库 genType 维度匹配
    const gradeSegment = stage === 'primary'
      ? (isLowerPrimary ? 'primary_low' : isMiddlePrimary ? 'primary_mid' : 'primary_high')
      : stage || '';
    // 🔧 用 gradeSegment 作为 stage 精确匹配 KB 块（KB 块已用 primary_low/mid/high/middle/high 做 stage）
    let kbBlocks = getMatchingBlockInstructions({ category: '生成-知识边界', subject, stage: gradeSegment });
    if (kbBlocks.length > 0) {
      const boundaryList = kbBlocks[0].content.split('\n').filter(l => l.trim().startsWith('-'));
      if (boundaryList.length > 0) {
        const _kbTitleBlocks = getMatchingBlockInstructions({ category: '生成-指令块标题', subject: '', stage: '', genType: 'knowledge_boundary' });
        const _kbTitle = _kbTitleBlocks.length > 0 ? _kbTitleBlocks[0].content : '年级知识边界——以下内容严禁出现';
        return '\n【' + _kbTitle + '】\n' + boundaryList.map(b => `- 🚫 ${b.replace(/^-\s*/, '')}`).join('\n');
      }
    }
    console.warn(`[instructionLib] 未找到匹配的知识边界: subject=${subject}, gradeSegment=${gradeSegment}`);
    return '';
  };

  // ==================== 指令构建 ====================
  const buildGenerationInstruction = (options) => {
    try {
    const {
      selectedBooks,
      selectedTemplates,
      scopeType,
      propositionStyle,
      genTypes = ['exam'],
      granularity,
      questionTypes,
      difficultyLevels,
      totalScore,
      allowOriginalQuestions,
      specialSubType = '',
      injectedFragments = [],
      autoFullInstructions = [],
      mergeChapters = true,  // 🔧 多章节合并出卷开关（默认合并；false=逐章拆分）
      engine = ''  // 🔧 DeepSeek 噪音过滤：跳过硬编码题型数量
    } = options;

    const _isDeepSeekInstruction = engine === 'deepseek';

    let instruction = '';
    // 🔧 多学科修复：收集所有选中教材的学科，用于指令匹配
    const allSubjects = [...new Set((selectedBooks || []).map(b => b.subject).filter(Boolean))];
    const book = selectedBooks?.find(b => b.subject) || selectedBooks?.[0];
    // 🔧 修复：规范化学科名称（处理"政治"→"道德与法治"/"思想政治"等映射）
    const rawSubject = book?.subject || '';
    const stageRaw = book?.stage || '';
    // 🔧 统一映射为英文 key（教材库 filterStage 值是 "小学/初中/高中"）
    const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = normalizeSubjectName(rawSubject, stage);
    // 🔧 多学科：指令匹配用学科（多学科时不限定，匹配通用条目；专科指令由 GenerateModule.vue 的 auto fragment 处理）
    const matchSubject = allSubjects.length > 1 ? '' : subject;
    const grade = book?.grade || '';

    // 动态年级适配：根据实际年级提取数字，供后续所有【】块使用
    // 🔑 grade 可能是中文（"三年级"）或数字，统一提取数字
    const gradeNum = extractGradeNum(grade);
    const isLowerPrimary = stage === 'primary' && gradeNum > 0 && gradeNum <= 2;   // 低段：1-2年级
    const isMiddlePrimary = stage === 'primary' && gradeNum >= 3 && gradeNum <= 4; // 中段：3-4年级
    const isUpperPrimary = stage === 'primary' && gradeNum >= 5;   // 高段：5-6年级
    const primaryGenType = genTypes?.[0] || 'exam';  // 资料类型，供后续所有【】块使用
    // 🔧 学段细分：用于 getMatchingBlockInstructions 的 genType 维度匹配
    const gradeSegment = stage === 'primary'
      ? (isLowerPrimary ? 'primary_low' : isMiddlePrimary ? 'primary_mid' : 'primary_high')
      : stage || 'middle';

    // 🔧 块标题辅助：从指令库三维度查询块级标题，无匹配时使用兜底
    const _title = (genType, fallback) => {
      const blocks = getMatchingBlockInstructions({ category: '生成-指令块标题', subject: '', stage: '', genType });
      return blocks.length > 0 ? blocks[0].content : fallback;
    };

    // ========== 0.【角色身份】 ==========
    const roleBlocks = getMatchingBlockInstructions({ category: '生成-角色身份', subject: '', stage: '', genType: primaryGenType });
    if (roleBlocks.length > 0) {
      instruction += `【${_title('role_identity', '角色身份')}】\n${roleBlocks[0].content}\n\n`;
    } else {
      console.warn(`[instructionLib] 未找到角色身份: genType=${primaryGenType}`);
    }
    
    // ========== 0.5.【标题格式】 ==========
    const titleBlocks = getMatchingBlockInstructions({ category: '生成-标题格式', subject: '', stage: '', genType: '' });
    if (titleBlocks.length > 0) {
      instruction += `\n---\n【${_title('title_format', '标题格式')}】\n${titleBlocks[0].content}\n\n`;
    }
    
    // ========== 1.【核心任务】 ==========
    instruction += `\n---\n【${_title('core_task', '核心任务')}】\n`;
    
    // 🔧 从教材勾选章节获取任务名（scopeType优先 > 单课标题 > 多章节单元提取）
    let taskName = '';
    const bookChapters = book?.selectedChapters || [];
    // 🔧 优先级1：scopeType 非默认值时使用其标签（带轮换，避免干巴巴的"期中"）
    if (scopeType && scopeType !== 'default') {
      const scopeLabelPools = {
        midterm: ['期中综合测试', '阶段综合测评', '中期学业检测'],
        final:   ['期末综合测试', '学期综合测评', '期末学业检测'],
        topic:   ['专题复习', '专项复习', '专题训练'],
      };
      const pool = scopeLabelPools[scopeType];
      if (pool) {
        const chapterKey = bookChapters.map(c => c.title).join('|').slice(0, 80);
        const key = `scope_${scopeType}__${chapterKey}`;
        _scopeLabelCounters[key] = (_scopeLabelCounters[key] || 0) % pool.length;
        taskName = pool[_scopeLabelCounters[key]++];
      }
    } else if (bookChapters.length === 1) {
      // 优先级2：单课取课标题
      taskName = bookChapters[0].title || '';
    } else if (bookChapters.length > 1) {
      // 优先级3：多章节，尝试提取单元信息（中文+英文格式全覆盖）
      const firstTitle = bookChapters[0].title || '';
      // 中文：第X单元
      let unitMatch = firstTitle.match(/第([一二三四五六七八九十]+)单元/);
      if (unitMatch) {
        taskName = `第${unitMatch[1]}单元`;
      } else {
        // 英文：Unit N / Chapter N / Module N
        unitMatch = firstTitle.match(/(Unit|Chapter|Module)\s*(\d+)/i);
        if (unitMatch) {
          taskName = `${unitMatch[1]} ${unitMatch[2]}`;
        } else {
          // 降级：多课综合 → 从指令库三维度查询标题格式模板
          const chTitles = bookChapters.map(c => c.title).filter(Boolean);
          const joined = chTitles.length <= 2
            ? chTitles.join('·')
            : chTitles.slice(0, 2).join('·') + '等';
          const titleTplBlocks = getMatchingBlockInstructions({ category: '生成-多章节标题', subject: '', stage: '', genType: primaryGenType });
          const titleTpl = titleTplBlocks.length > 0 ? titleTplBlocks[0].content : '{titles}';
          taskName = titleTpl.replace('{titles}', joined);
        }
      }
    }
    
    if (genTypes && genTypes.length > 0) {
      for (const gt of genTypes) {
        const typeInfo = genTypeTemplates[gt];
        const displayName = taskName || (typeInfo?.name || '').replace(/[^\u4e00-\u9fa5]/g, '');
        if (typeInfo) {
          // 🔧 从指令库获取核心任务指令（四维度智能匹配：stage+genType+subject，学段专属>学科专属>通用）
          const coreTaskBlocks = getMatchingBlockInstructions({ category: '生成-核心任务', matchSubject, stage: gradeSegment, genType: gt, specialSubType: gt === 'special' ? specialSubType : '' });
          const coreInstruction = coreTaskBlocks.length > 0 ? coreTaskBlocks[0].content : "";
          // 🔧 兜底警告：核心任务使用了通用条目（无学科/无学段）而非学段专属条目
          if (coreTaskBlocks.length > 0) {
            const ctBest = coreTaskBlocks[0];
            if (!ctBest.subject && !ctBest.stage && (subject || gradeSegment)) {
              console.warn(`[core-task-fallback] 「${gt}」核心任务使用了通用兜底（无学科/学段），建议为 subject="${subject}" stage="${gradeSegment}" 补充学段专属核心任务条目。当前匹配: ${ctBest.id}`, ctBest);
            }
          }
          instruction += `请生成一份「${displayName}」。${coreInstruction}\n`;
          // 🔴 红线约束前置（最高优先级）：在所有其他约束之前集中注入，防止关键红线被几十条约束稀释
          const redlineBlocks = getMatchingBlockInstructions({ category: '生成-红线约束', matchSubject, stage: gradeSegment, genType: gt });
          if (redlineBlocks.length > 0) {
            instruction += '\n' + redlineBlocks.map(b => b.content).join('\n') + '\n';
          }
          // 🔧 品质标准：从指令库按 subject × stage × genType 三维度查询注入（学科专属反套路块需 subject 维度才能命中）
          const qualityBlocks = getMatchingBlockInstructions({ category: '生成-品质标准', matchSubject, stage: gradeSegment, genType: gt });
          if (qualityBlocks.length > 0) {
            instruction += qualityBlocks.map(b => b.content).join('\n') + '\n';
          }
          // 🔧 原创标准：从指令库按 subject × stage × genType 三维度查询注入
          const originalityBlocks = getMatchingBlockInstructions({ category: '生成-原创标准', matchSubject, stage: gradeSegment, genType: gt });
          if (originalityBlocks.length > 0) {
            instruction += originalityBlocks.map(b => b.content).join('\n') + '\n';
          }
          // 🔧 专项突破：根据用户选择的专项子类型精确匹配结构（如阅读理解 vs 古诗词 vs 计算）
          const structQueryOpts = { category: '生成-资料类型结构', subject, stage: gradeSegment, genType: gt };
          if (gt === 'special' && specialSubType) {
            // 专项突破：精确子类型优先（如'阅读理解''古诗词'），specialSubType 命中 +5 分
            structQueryOpts.specialSubType = specialSubType;
          } else if (propositionStyle && (propositionStyle === 'big_unit' || propositionStyle === 'project_based')) {
            // 🔧 新课标风格：将风格标记作为 specialSubType 传入 → 风格专属条目 +5 分自动置顶，常规条目兜底
            structQueryOpts.specialSubType = propositionStyle;
          } else {
            // 🔧 新课标默认：全部 genType 走 new_standard → +5 分自动置顶，传统条目兜底
            structQueryOpts.specialSubType = 'new_standard';
          }
          const structBlocks_a2 = getMatchingBlockInstructions(structQueryOpts);
          // 🎯 专项突破：优先级排序 — 精确子类型 > 学科×学段专属 > 通用兜底
          if (gt === 'special' && structBlocks_a2.length > 1) {
            structBlocks_a2.sort((a, b) => {
              const aScore = (a.specialSubType ? 2 : 0) + ((a.subject && a.stage) ? 1 : 0);
              const bScore = (b.specialSubType ? 2 : 0) + ((b.subject && b.stage) ? 1 : 0);
              return bScore - aScore; // 高优先级在前
            });
          }
          // 🔴 真题卷根治：exam 类型强制注入「真题卷结构蓝本」（学科×学段，新课标真题通行规范），
          //    题型骨架/大题名称/分值/卷面规范由蓝本锁定，AI 不得自由发挥；
          //    结构大纲降级为辅助参考，冲突时一律以蓝本为准。
          //    ⚠️ 蓝本注入独立于结构大纲匹配：信息科技/音乐/美术/体育等无结构大纲条目的学科同样注入
          let examBlueprint = null;
          if (gt === 'exam') {
            examBlueprint = getExamBlueprint(subject, gradeSegment);
            if (examBlueprint) {
              instruction += `\n---\n${buildExamBlueprintText(examBlueprint)}\n`;
            } else {
              console.warn(`[exam-blueprint] 未找到真题蓝本且无结构大纲，需人工干预: subject=${subject}, stage=${gradeSegment}`);
            }
          }
          // 🔴 新课标单一骨架：exam 有蓝本时跳过结构大纲注入（蓝本为唯一骨架权威，避免新旧结构打架）
          if (structBlocks_a2.length > 0 && !(gt === 'exam' && examBlueprint)) {
            // 结构大纲存在时作为辅助参考注入（蓝本优先）
            let adaptedStructure = structBlocks_a2[0].content.replace('结构参考：\n', '');
            
            // 🔧 从指令库获取学科专属结构模板（按 gradeSegment+subject+genType 三维度精确匹配，小学分低/中/高段）

            // 🔴 消除题量冲突：对 practice/special 类型，gen_struct 中的数字（如"8-12道""3-4题"）与 typedist 矛盾
            // 在注入时正则抹掉所有题量数字，只保留结构名和内容描述。preview/reading 等无 typedist 的类型不处理
            // 🔴 exam 已排除：真题卷蓝本中的分值/题量数字是硬性规范，必须原样保留（见上方 exam blueprint 注入）
            const stripTypes = ['practice', 'special'];
            if (stripTypes.includes(gt)) {
              // 1. 去掉 "N-M量词"（含后续可选逗号）：8-12道、3-5题、2-4篇、5-6空、1-2个
              adaptedStructure = adaptedStructure.replace(/\d+[～\-—]\d+\s*[道题空篇个][，、]?/g, '');
              // 2. 去掉独立量词（括号内或逗号后）：（3-4题 / ，3-4题
              adaptedStructure = adaptedStructure.replace(/[（，、]\s*\d+\s*[道题空篇个]/g, (m) => m[0] === '（' ? '（' : '');
              // 3. 去掉"留N-M空""配N-M题"模式
              adaptedStructure = adaptedStructure.replace(/(留|配)\s*\d+[～\-—]?\d*\s*[道题空篇个]/g, '$1');
              // 4. 清理括号内残留标点: （，→（ / （、→（
              adaptedStructure = adaptedStructure.replace(/（[，、]+/g, '（');
              // 5. 清理尾部残留: ，）→）
              adaptedStructure = adaptedStructure.replace(/[，、]+\s*）/g, '）');
              // 6. 清理连续标点
              adaptedStructure = adaptedStructure.replace(/[，、]{2,}/g, '，');
              // 7. 清理"控制在，"→"控制："
              adaptedStructure = adaptedStructure.replace(/控制在[，、]?(?!\d)/g, '控制：');
              // 8. 清理句首残留标点
              adaptedStructure = adaptedStructure.replace(/\n[，、]/g, '\n');
              // 9. 去掉字数约束：200-300字/50-100字/不超过200字/不少于800字
              adaptedStructure = adaptedStructure.replace(/\d+[～\-—]\d+\s*字[左右]?/g, '');
              adaptedStructure = adaptedStructure.replace(/(不超过?|不少于?|至少|至多)\s*\d+\s*字[左右]?/g, '');
              // 10. 去掉时间限制：限时3-5分钟/限时建议5分钟
              adaptedStructure = adaptedStructure.replace(/限时(建议)?\s*\d+[～\-—]?\d*\s*(分钟|秒)/g, '');
              // 11. 去掉百分比目标：≥90%/正确率目标≥90%
              adaptedStructure = adaptedStructure.replace(/正确率目标[≥≤]\s*\d+%/g, '');
              adaptedStructure = adaptedStructure.replace(/[≥≤]\s*\d+%/g, '');
              // 12. 去掉页码约束：每页不超过X题
              adaptedStructure = adaptedStructure.replace(/每页不(超过|多于)\s*\d+\s*题[，。]?/g, '');
              // 13. 去掉选项数量约束：选项不超过3个/选项不超过4个
              adaptedStructure = adaptedStructure.replace(/选项不超过\s*\d+\s*个/g, '');
              // 14. 去掉选择格式约束：每题4选1/每空3选1/每空4选1
              adaptedStructure = adaptedStructure.replace(/[每各][题空]\s*\d+\s*选\s*\d+/g, '');
              // 15. 去掉词量/字量上限：50词以内/500字以内/控制在50词以内/词汇量控制在50词以内
              adaptedStructure = adaptedStructure.replace(/(词汇量|文字量)?\s*控制在?\s*\d+\s*[词字]以内/g, '');
              adaptedStructure = adaptedStructure.replace(/\d+\s*[词字]以内/g, '');
              // 16. 去掉总字数约束：总字数≤150字/总字数≤200字
              adaptedStructure = adaptedStructure.replace(/总字数\s*[≤]\s*\d+\s*字/g, '');
            }

            // 🔧 DeepSeek 路径：裁掉破折号后面的题型限制（保留板块目的描述，让 DeepSeek 自主决定具体题型）
            // 🔴 exam 除外：真题蓝本已锁定题型骨架，结构大纲仅作辅助，不参与题型决策
            if (_isDeepSeekInstruction && gt !== 'exam') {
              adaptedStructure = adaptedStructure.replace(/——[^\n]*/g, '');
            }

            // 🔧 学段精细调整
            if (gt === 'preview') {
              const previewDetectCount = isLowerPrimary ? '2-3' : isMiddlePrimary ? '3-4' : '4-5';
              adaptedStructure = adaptedStructure.replace(/\d+-\d+道基础题/, `${previewDetectCount}道基础题`);
            }
            if (gt === 'reading' && subject === '语文') {
              const readingCount = isLowerPrimary ? '1篇' : '1-2篇';
              adaptedStructure = adaptedStructure.replace(/短文阅读（[\d-]+篇/, `短文阅读（${readingCount}`);
            }
            
            // 🔧 genType 自适应措辞：替换全局统一的"考查"和"题量"
            // 🔧 括号非穷举：明确告知 DeepSeek 括号内为方向提示，避免"checklist 思维"
            //     flexNote 按资料类型差异化：考查/练习/训练/梳理/预习/默写/阅读维度
            const structurePreambles = {
              exam: '以下为各部分组织顺序和考查内容，具体题量根据文本内容灵活决定，括号内为板块方向提示而非穷举清单，请根据教材实际内容自主决定完整考查维度',
              practice: '以下为各部分组织顺序和练习内容，具体题量根据文本内容灵活决定，括号内为板块方向提示而非穷举清单，请根据教材实际内容自主决定完整练习维度',
              special: '以下为各部分组织顺序和训练内容，具体题量根据文本内容灵活决定，括号内为板块方向提示而非穷举清单，请根据教材实际内容自主决定完整训练维度',
              summary: '以下为各部分组织顺序和梳理内容，具体覆盖范围根据知识体系灵活决定，括号内为板块方向提示而非穷举清单，请根据教材实际内容自主决定完整梳理维度',
              errorbook: '以下为各部分组织顺序，具体题量与分类根据错题情况灵活决定，括号内为板块方向提示而非穷举清单，请根据教材实际内容自主决定完整训练维度',
              preview: '以下为各部分组织顺序和预习流程，预习题量根据文本内容灵活决定，括号内为板块方向提示而非穷举清单，请根据教材实际内容自主决定完整预习维度',
              dictation: '以下为各部分组织顺序和默写框架，具体词句数量根据文本内容灵活决定，括号内为板块方向提示而非穷举清单，请根据教材实际内容自主决定完整默写维度',
              reading: '以下为各部分组织顺序和阅读框架，具体题量根据文本内容灵活决定，括号内为板块方向提示而非穷举清单，请根据教材实际内容自主决定完整阅读维度',
            };
            let preamble = structurePreambles[gt] || ('以下为各部分组织顺序，具体内容根据文本内容灵活决定，括号内为板块方向提示而非穷举清单，请根据教材实际内容自主决定完整内容维度');
            instruction += `\n---\n【结构大纲】（${preamble}）：\n ${adaptedStructure}\n`;
          }
        }
      }
    } else {
      instruction += `⚠️ 请在顶部配置栏选择资料类型（考卷/课时练/专项突破/知识点总结），未选择时系统将按默认考卷格式生成。\n`;
    }
    
    // ========== 1.5.【答案区强制锚定】 ==========
    if (primaryGenType) {
      const anchorBlocks = getMatchingBlockInstructions({ category: '生成-答案区强制锚定', subject: '', stage: '', genType: primaryGenType });
      if (anchorBlocks.length > 0 && anchorBlocks[0].content) {
        instruction += `\n---\n【${_title('answer_anchor', '答案区强制锚定')}】\n${anchorBlocks[0].content}\n\n`;
      }
    }
    
    if (granularity) {
      instruction += `生成粒度：${granularity === 'unit' ? '按单元整体设计' : '按课时单独设计'}。\n`;
    }

    // ========== 2.【教材章节确认】仅提供章节名称和页码范围，原文由 Step4 精准检索注入 ==========
    // 🔧 架构修复：Step 1 已全面提取知识点（含词汇表/生字表等），Step 4 通过 retrieveBlueprintSegments
    //    精准检索原文片段注入到逐题生成。此处不再注入原文片段——避免期末资料整本教材被截断。
    if (selectedBooks && selectedBooks.length > 0) {
      // 🔧 学科感知的章节类型识别
      const detectChapterLabel = (title, subj) => {
        if (!title) return '';
        const t = title.trim();
        const s = (subj || '');
        // 英语
        if (s.includes('英语')) {
          if (/unit\s*\d/i.test(t)) return '单元';
          if (/lesson\s*\d/i.test(t)) return '课时';
          if (/let.s\s*(learn|talk|spell|play|sing|do|check)/i.test(t)) return '板块';
          if (/story\s*time|read\s*(and|&)\s*write/i.test(t)) return '板块';
          if (/words|vocabulary|word\s*list/i.test(t)) return '📕词汇表';
          if (/review|recycle|revision/i.test(t)) return '复习';
          if (/project|task/i.test(t)) return '项目';
          return '';
        }
        // 语文
        if (s.includes('语文')) {
          if (/第[一二三四五六七八九十\d]+课|课文[一二三四五六七八九十\d]*/.test(t)) return '课文';
          if (/语文园地/.test(t)) return '语文园地';
          if (/识字/.test(t)) return '识字';
          if (/习作|写作|作文/.test(t)) return '写作';
          if (/口语交际/.test(t)) return '口语交际';
          if (/快乐读书吧|阅读链接|名著导读/.test(t)) return '阅读';
          if (/综合性学习/.test(t)) return '综合';
          if (/复习|回顾|总结/.test(t)) return '复习';
          if (/古诗|诗词|文言文/.test(t)) return '古诗文';
          return '';
        }
        // 数学
        if (s.includes('数学')) {
          if (/第[一二三四五六七八九十\d]+单元/.test(t)) return '单元';
          if (/第[一二三四五六七八九十\d]+节/.test(t)) return '节';
          if (/整理.*复习|复习.*整理|总复习/.test(t)) return '复习';
          if (/数学广角|你知道吗/.test(t)) return '拓展';
          if (/综合.*实践|实践.*活动/.test(t)) return '实践';
          return '';
        }
        // 理科（物理/化学/生物/科学）
        if (/物理|化学|生物|科学/.test(s)) {
          if (/第[一二三四五六七八九十\d]+章/.test(t)) return '章';
          if (/第[一二三四五六七八九十\d]+节/.test(t)) return '节';
          if (/实验|探究|活动/.test(t)) return '实验';
          if (/复习|小结|总结|回顾/.test(t)) return '复习';
          return '';
        }
        // 文科（历史/地理/政治/道德与法治）
        if (/历史|地理|政治|道德|思想/.test(s)) {
          if (/第[一二三四五六七八九十\d]+[课章单元]/.test(t)) {
            const m = t.match(/第[一二三四五六七八九十\d]+(课|章|单元)/);
            return m ? m[1] : '';
          }
          if (/探究|活动|讨论/.test(t)) return '活动';
          if (/复习|总结|回顾/.test(t)) return '复习';
          return '';
        }
        // 通用：检测数字前缀
        if (/^第[一二三四五六七八九十\d]+[课章节单元]/.test(t)) {
          const m = t.match(/第[一二三四五六七八九十\d]+([课章节单元])/);
          return m ? m[1] : '';
        }
        return '';
      };
      
      instruction += `\n---\n【教材章节确认——以下章节的所有知识内容需全部覆盖】\n`;
      for (const book of selectedBooks) {
        const selectedChapters = book.selectedChapters || [];
        if (selectedChapters.length > 0) {
          // 🔧 学科感知：章节标题+类型标注+页码
          const chapterInfo = selectedChapters.map(ch => {
            const label = detectChapterLabel(ch.title, book.subject || '');
            const labelStr = label ? `[${label}]` : '';
            return `${labelStr}${ch.title}（第${ch.start}-${ch.end}页）`;
          }).join('、');
          instruction += `《${book.name}》已锁定：${chapterInfo}\n`;
        } else {
          instruction += `《${book.name}》（未勾选具体章节）\n`;
        }
        // 知识层级（大概念用数字编号，核心知识用 - 区分，避免层级混淆）
        const hierarchyChapters = selectedChapters.filter(ch => ch.knowledgeHierarchy?.length);
        if (hierarchyChapters.length > 0) {
          instruction += `🎯 知识层级：\n`;
          for (const chapter of hierarchyChapters) {
            let bcIdx = 0;
            for (const bigConcept of chapter.knowledgeHierarchy) {
              bcIdx++;
              instruction += `${bcIdx}. ${bigConcept.bigConcept}\n`;
              for (const core of (bigConcept.coreKnowledge || [])) {
                const level = core.level || core.cognitiveLevel || '';
                instruction += `  - ${core.name}${level ? ' ' + level : ''}\n`;
                if (core.specificConcepts?.length) {
                  instruction += `    具体概念：${core.specificConcepts.join('、')}\n`;
                }
              }
            }
          }
        }
      }
    }

    // 🔧 知识点全覆盖约束（提取自 getCoverageConstraint，与核心任务的"题量充足"互补）
    if (genTypes && genTypes.length > 0) {
      const coverageConstraint = getCoverageConstraint(genTypes[0], subject, stage, specialSubType);
      if (coverageConstraint) {
        const covContent = coverageConstraint
          .replace(/^\n⚠️\s*【.*?】/, '')
          .replace(/\n$/, '')
          .trim();
        if (covContent) instruction += `${covContent}\n`;
      }
    }

    // ========== 7.【学段+学科精准适配】根据教材的年级/学科从指令库动态注入 ==========
    if (stage || subject) {
      // 🔧 DeepSeek 跳过：学段适配和学科适配指令 DeepSeek 训练数据已知，仅保留项目特有的学科特色
      if (!_isDeepSeekInstruction) {
        instruction += `\n---\n【${_title('stage_subject_adapt', '学段·学科精准适配')}】\n`;
      
        // （已停用「生成-学段适配」查询——与「生成-学段控制」双轨重复，学段控制为详细版并已吸收独特点，v27）
        
        // 🔧 从指令库获取学科适配块（优先 gradeSegment+genType 精确匹配，兜底 stage+subject）
        const subjectBlocks = getMatchingBlockInstructions({ category: '生成-学科适配', matchSubject, stage: gradeSegment, genType: primaryGenType });
        if (subjectBlocks.length > 0) {
          for (const block of subjectBlocks) {
            instruction += block.content + '\n';
          }
        } else {
          // 尝试 stage 级别的兜底
          const subjFallback = getMatchingBlockInstructions({ category: '生成-学科适配', matchSubject, stage });
          if (subjFallback.length > 0) {
            for (const block of subjFallback) {
              instruction += block.content + '\n';
            }
          } else {
            // 最后兜底：subject only
            const subjOnly = getMatchingBlockInstructions({ category: '生成-学科适配', matchSubject });
            if (subjOnly.length > 0) {
              instruction += subjOnly[0].content + '\n';
            } else {
              console.warn(`[instructionLib] 未找到学科适配: subject=${subject}, gradeSegment=${gradeSegment}`);
            }
          }
        }
      }// _isDeepSeekInstruction guard end
      
      // 🔧 学科特色（按 subject+stage+genType 从指令库注入学科特点；传 genType 以排除听写/总结等非题类型）
      const subjectFeatureBlocks = getMatchingBlockInstructions({ category: '生成-学科特色', matchSubject, stage, genType: primaryGenType });
      if (subjectFeatureBlocks.length > 0) {
        instruction += `\n---\n【${_title('subject_feature', '学科特色')}】\n`;
        for (const block of subjectFeatureBlocks) {
          instruction += `- ${block.content}\n`;
        }
      }

      // 🔧 学科核心素养（按 subject+stage 注入课标核心素养关键词）
      if (subject) {
        const coreBlocks = getMatchingBlockInstructions({ category: '生成-学科核心素养', subject, stage });
        if (coreBlocks.length > 0) {
          instruction += `\n---\n【${_title('core_literacy', '学科核心素养')}】${coreBlocks[0].content}\n\n`;
        }
      }
      
      if (grade) instruction += `- 当前年级：${grade}\n`;
      const gradeHint = getSubjectGradeHint(subject, stage, gradeNum);
      if (gradeHint) instruction += `${gradeHint}\n`;
      // 🔧 DeepSeek 跳过："学段约束"警告仅当学段/学科适配块注入时有效
      if (!_isDeepSeekInstruction) {
        instruction += `\n⚠️ 学段约束用于控制题目难度和认知深度（如低段避免抽象推理、高段增加综合分析），但考查的知识内容以教材实际覆盖范围为准——教材有短文阅读则考查阅读，有科学探究则考查探究，不因学段标签限制内容广度。\n`;
      }

      // 🔧 学段控制（按年级段精确匹配 primary_low/mid/high/middle/high，给出题量/难度/时长建议）
      // 🔧 DeepSeek 跳过：课标对各学段的能力描述、识字量/计算范围等 DeepSeek 训练数据已知
      if (!_isDeepSeekInstruction) {
      const stageControlBlocks = getMatchingBlockInstructions({ category: '生成-学段控制', subject: '', stage });
      if (stageControlBlocks.length > 0) {
        let matchedStageBlock = null;
        for (const block of stageControlBlocks) {
          if (stage === 'primary') {
            if (isLowerPrimary && block.id === 'stage_primary_low') { matchedStageBlock = block; break; }
            if (isMiddlePrimary && block.id === 'stage_primary_mid') { matchedStageBlock = block; break; }
            if (isUpperPrimary && block.id === 'stage_primary_high') { matchedStageBlock = block; break; }
          } else {
            matchedStageBlock = block;
            break;
          }
        }
        if (matchedStageBlock) {
          instruction += `\n---\n【${_title('stage_control', '学段控制')}】${matchedStageBlock.content}\n`;
        }
      }
      }// _isDeepSeekInstruction guard end (学段控制)
    }

    // ========== 13.【题型设计与难度配置】…
    const hasTypeConfig = questionTypes && questionTypes.length > 0 && questionTypes.some(qt => qt.selected);
    const hasDiffConfig = difficultyLevels && difficultyLevels.length > 0 && difficultyLevels.some(d => d.selected);
    
    // 🔧 检测用户是否手动设置了难度配比百分比（null=未设置 → 走指令库自动适配）
    const hasCustomDiff = hasDiffConfig && difficultyLevels.every(d => d.percentage != null);
    const usingDefaultTypes = isDefaultQuestionTypes(questionTypes);
    // 🔧 根修复：拆解 exam/practice 捆绑，区分"仅 exam"和"逐题生成类"
    const isExam = primaryGenType === 'exam';
    const isQuestionBased = primaryGenType === 'exam' || primaryGenType === 'practice' || primaryGenType === 'special';
    const stageRatio = stage && subject ? getStageDifficultyRatio(stage, isLowerPrimary, isMiddlePrimary, isUpperPrimary, primaryGenType) : null;
    const effectiveTotalScore = totalScore || getDefaultTotalScore(primaryGenType, subject, gradeSegment);
    
    // 🔧 DeepSeek 整卷生成：跳过硬编码题型数量+自动难度百分比（结构大纲 diffRatioMap 为唯一权威源）
    // 仅保留：用户手动设置的难度百分比(hasCustomDiff) + 总分/时间/验算(effectiveTotalScore)
    const _enterTypeDesignBlock = _isDeepSeekInstruction
      ? (hasCustomDiff || effectiveTotalScore)     // DeepSeek: 跳过 hasTypeConfig + hasDiffConfig(auto)
      : (hasTypeConfig || hasDiffConfig || effectiveTotalScore);  // Ollama: 全部保留
    
    if (_enterTypeDesignBlock) {
      // 🔧 从指令库获取块标题（三维度查询，无硬编码）
      const _tdTitleBlocks = getMatchingBlockInstructions({ category: '生成-指令块标题', subject: '', stage: '', genType: 'type_design' });
      const _tdTitle = _tdTitleBlocks.length > 0 ? _tdTitleBlocks[0].content : '题型设计与难度配置';
      instruction += `\n---\n【${_tdTitle}】\n`;
      
      // 题型与数量分配（仅在用户手动配置时输出，DeepSeek 由结构大纲自主决定）
      if (hasTypeConfig && !_isDeepSeekInstruction) {
        const selectedTypes = questionTypes.filter(qt => qt.selected);
        instruction += `题型与数量分配：\n`;
        for (const qt of selectedTypes) {
          instruction += `  - ${qt.name}：${qt.count}题`;
          if (qt.score) instruction += `，每题${qt.score}分`;
          instruction += `\n`;
        }
        if (usingDefaultTypes && !isQuestionBased) {
          instruction += `（以上为默认题型配置，可根据需要在右侧面板调整）\n`;
        }
      }
      
      // 难度分布：🔧 指令库作为唯一权威源，null=自动走指令库，手动设置后才用用户值
      if (hasDiffConfig) {
        if (stageRatio && !hasCustomDiff) {
          // 🎯 用户未手动设置百分比 → 以指令库为准（学段自动适配）
          instruction += `难度分布（根据${grade || stage}学段自动适配）：\n`;
          instruction += `  - 基础题约占${stageRatio.basic}%，主要考查教材基本概念和技能的掌握\n`;
          instruction += `  - 中档题约占${stageRatio.medium}%，适当改编教材原题，增加思维含量\n`;
          instruction += `  - 提高题约占${stageRatio.advanced}%，设计探究性或综合性任务\n`;
        } else if (hasCustomDiff) {
          // 用户手动设置了百分比 → 使用用户值
          const selected = difficultyLevels.filter(d => d.selected);
          instruction += `难度分布（手动配置）：\n`;
          selected.forEach(d => {
            if (d.name === '基础题') instruction += `  - 基础题约占${d.percentage}%，主要考查教材基本概念和技能的掌握\n`;
            if (d.name === '中档题') instruction += `  - 中档题约占${d.percentage}%，适当改编教材原题，增加思维含量\n`;
            if (d.name === '提高题') instruction += `  - 提高题约占${d.percentage}%，设计探究性或综合性任务\n`;
          });
          // 若与指令库推荐值不同，给出提示
          if (stageRatio) {
            const selBasic = difficultyLevels.find(d => d.name === '基础题');
            const selMedium = difficultyLevels.find(d => d.name === '中档题');
            const selAdv = difficultyLevels.find(d => d.name === '提高题');
            if (selBasic && selMedium && selAdv &&
                (selBasic.percentage !== stageRatio.basic ||
                 selMedium.percentage !== stageRatio.medium ||
                 selAdv.percentage !== stageRatio.advanced)) {
              instruction += `（💡 指令库推荐配比：基础${stageRatio.basic}%/中档${stageRatio.medium}%/提高${stageRatio.advanced}%）\n`;
            }
          }
        } else if (stageRatio) {
          // 兜底：部分设置或 stageRatio 可用
          instruction += `难度分布（学段自动适配）：\n`;
          instruction += `  - 基础题约占${stageRatio.basic}%，主要考查教材基本概念和技能的掌握\n`;
          instruction += `  - 中档题约占${stageRatio.medium}%，适当改编教材原题，增加思维含量\n`;
          instruction += `  - 提高题约占${stageRatio.advanced}%，设计探究性或综合性任务\n`;
        }
        instruction += `难度应有梯度，从易到难排列。\n`;
      }
      
      // 总分：🔧 D3修复 —— 智能默认对标现行考试标准（仅 exam）
      if (effectiveTotalScore) {
        instruction += `总分：${effectiveTotalScore}分`;
        if (!totalScore) {
          const stageLabel = stage === 'primary' ? '小学' : stage === 'middle' ? '初中' : '高中';
          instruction += `（${stageLabel}${subject}考试标准自动设置，与真题蓝本一致）`;
        }
        instruction += `。\n`;
        // 🔧 exam 分值验算已在题型结构原则块中统一处理
      }
      
      // 🔧 Gap2: 时间分配建议（对标市面考卷）
      // 🔴 真题卷根治：exam 考试时长以真题蓝本 duration 为准，跳过通用时间分配建议（避免与蓝本 60/100/120 分钟冲突）
      if (primaryGenType !== 'exam') {
        const timeAlloc = getTimeAllocation(primaryGenType, subject, gradeSegment);
        if (timeAlloc) {
          instruction += `${timeAlloc}。\n`;
        }
      }

      // 🔧 题量控制（按 gradeSegment 从指令库注入建议总题量范围）
      // 🔧 DeepSeek 跳过：合理题量设计 DeepSeek 训练数据充分覆盖
      if (!_isDeepSeekInstruction) {
      const layoutBlocks = getMatchingBlockInstructions({ category: '生成-题量控制', subject: '', stage: gradeSegment });
      if (layoutBlocks.length > 0) {
        instruction += `\n---\n【${_title('layout_control', '题量控制')}】${layoutBlocks[0].content}\n`;
      }
      }
      // 🔧 难度控制（按 gradeSegment 从指令库注入基础:中等:提高比例）
      // 🔧 DeepSeek 跳过：难度配比(5:3:2等) DeepSeek 训练数据已知
      if (!_isDeepSeekInstruction) {
      const diffControlBlocks = getMatchingBlockInstructions({ category: '生成-难度控制', subject: '', stage: gradeSegment });
      if (diffControlBlocks.length > 0) {
        instruction += `\n---\n【${_title('diff_control', '难度控制')}】${diffControlBlocks[0].content}\n`;
      }
      }
      
      // 🔴 分值分配原则 + 验算（防止凑分）：仅试卷类型
      if (primaryGenType === 'exam' && effectiveTotalScore) {
        instruction += `\n🔴 分值分配原则（防止凑分——必须遵守）：\n`;
        instruction += `- 先定分后出题：先根据每个知识点的考查权重确定分值，再按分值设计题目深度。严禁"先出完题再凑分数"\n`;
        instruction += `- 分值对应考查量：1-2分→简单识记/判断/选择，3-4分→理解应用/填空/简答，5-6分→综合运用/多步计算，8分以上→深层探究/论述/写作\n`;
        instruction += `- 同题型等分：同一大题下各小题分值必须一致（如选择题统一2分/题、填空题统一3分/题），禁止同一题型内混搭不同分值\n`;
        instruction += `- 常见整数值：分值取2/3/4/5/6/8/10等常见整数，严禁出现0.5/1.5/2.5等小数，严禁7/11/13等冷僻分值\n`;
        instruction += `- 分值标注（必须遵守）：只在大题标题标注总分值——大题分值严格按真题蓝本、不得改动；同一大题内各小题分值一致；小题一律不标分值\n`;
        instruction += `- 验算：所有题目分数合计必须严格等于${effectiveTotalScore}分，偏差为0\n`;
      }
      
      instruction += `\n`;
    }

    // ==== 🎯 格式合力区：配图/学科标记/输出格式 —— 紧接结构指令，避免被长文稀释 ====

    // ========== 10.【图形/图表/公式/配图专项指令】完全从指令库读取（专项要求+EduRender模板双源合并）==========
    if (subject) {
      const rules = [];
      
      // ① 专项要求（公式/图形/图表/配图格式要求）—— 按 gradeSegment+genType 学段精确匹配
      const specBlocks = getMatchingBlockInstructions({ category: '生成-专项要求', matchSubject, stage: gradeSegment, genType: primaryGenType, specialSubType: genTypes && genTypes.includes('special') ? specialSubType : '' });
      for (const block of specBlocks) {
        rules.push(block.content);
      }
      
      // ② EduRender 渲染模板（公式/数轴/几何/图表/力学/电路/光路/原子/配图）—— 按 subject 匹配，全学段通用
      const allEduBlocks = getMatchingBlockInstructions({ category: '生成-EduRender模板', matchSubject, stage: '', genType: '' });
      const genericEduBlocks = getMatchingBlockInstructions({ category: '生成-EduRender模板', subject: '', stage: '', genType: '' });
      const eduBlocks = [...allEduBlocks];
      for (const b of genericEduBlocks) {
        if (!eduBlocks.find(e => e.id === b.id)) eduBlocks.push(b);
      }
      const eduOrder = ['formula', 'chart', 'axis', 'shapes', 'force', 'circuit', 'optics', 'atom', 'image'];
      eduBlocks.sort((a, b) => {
        const ai = eduOrder.findIndex(k => a.id.includes(k));
        const bi = eduOrder.findIndex(k => b.id.includes(k));
        return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99);
      });
      for (const block of eduBlocks) {
        const label = block.name.replace('【EduRender模板】', '');
        rules.push(`【EduRender Studio——${label}】\n${block.content}`);
      }
      
      if (specBlocks.length === 0 && eduBlocks.length === 0) {
        console.warn(`[instructionLib] 未找到专项要求+EduRender模板: subject=${subject}, gradeSegment=${gradeSegment}`);
      }
      
      if (rules.length > 0) {
        instruction += `\n---\n【${_title('graphic_formula', '图形/图表/公式/配图专项指令')}】\n`;
        rules.forEach(r => { instruction += r + '\n'; });
        instruction += `\n`;
      }
    }

    // ========== 19.【学科标记】学科专用HTML标记规范（全部从指令库三维度匹配，无硬编码）==========
    if (subject) {
      // 🔧 Q3: 先查通用学科标记（stage=''），再查学段专属标记（如英语小学四线三格）
      // 🔧 单资料类型时传入 genType 过滤，避免 dictation 注入冲突的 <u> 下划线标记
      const singleGenType = (genTypes && genTypes.length === 1) ? genTypes[0] : undefined;
      const markupGeneric = getMatchingBlockInstructions({ category: '生成-学科标记', matchSubject, stage: '', genType: singleGenType });
      const markupStage = stage ? getMatchingBlockInstructions({ category: '生成-学科标记', matchSubject, stage, genType: singleGenType }) : [];
      // 合并去重（学段条目优先追加，不覆盖通用条目）
      const allMarkup = [...markupGeneric];
      for (const b of markupStage) {
        if (!allMarkup.find(m => m.id === b.id)) allMarkup.push(b);
      }
      if (allMarkup.length > 0) {
        for (const block of allMarkup) {
          instruction += `${block.content}\n`;
        }
        instruction += '\n';
      }
    }

    // ========== 21.【输出格式】——按资料类型精准注入 ==========
    
    if (primaryGenType === 'summary') {
      // 🔧 从指令库读取输出格式模板（含学科专属补充）
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', matchSubject, stage, genType: 'summary' });
      if (fmtBlocks.length > 0) {
        const fmtContent = fmtBlocks.map(b => b.content).join('\n');
        instruction += `\n---\n【${_title('format_summary', '知识点总结格式规范')}】\n${fmtContent}\n`;
      } else {
        console.warn('[instructionLib] 未找到输出格式: summary');
      }
    } else if (primaryGenType === 'errorbook') {
      // 🔧 从指令库读取输出格式模板
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', matchSubject, stage, genType: 'errorbook' });
      if (fmtBlocks.length > 0) {
        const fmtContent = fmtBlocks.map(b => b.content).join('\n');
        instruction += `\n---\n【${_title('format_errorbook', '错题本格式规范')}】\n${fmtContent}\n`;
      } else {
        console.warn('[instructionLib] 未找到输出格式: errorbook');
      }
    } else if (primaryGenType === 'preview') {
      // 🔧 从指令库读取输出格式模板
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', matchSubject, stage, genType: 'preview' });
      if (fmtBlocks.length > 0) {
        const fmtContent = fmtBlocks.map(b => b.content).join('\n');
        instruction += `\n---\n【${_title('format_preview', '课前预习格式规范')}】\n${fmtContent}\n`;
      } else {
        console.warn('[instructionLib] 未找到输出格式: preview');
      }
    } else if (primaryGenType === 'dictation') {
      // 🔧 从指令库读取输出格式模板（含学科专属补充——语文/英语格式不同）
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', matchSubject, stage, genType: 'dictation' });
      if (fmtBlocks.length > 0) {
        const fmtContent = fmtBlocks.map(b => b.content).join('\n');
        instruction += `\n---\n【${_title('format_dictation', '听写/默写格式规范')}】\n${fmtContent}\n`;
      } else {
        console.warn('[instructionLib] 未找到输出格式: dictation');
      }
    } else if (primaryGenType === 'reading') {
      // 🔧 从指令库读取输出格式模板
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', matchSubject, stage, genType: 'reading' });
      if (fmtBlocks.length > 0) {
        const fmtContent = fmtBlocks.map(b => b.content).join('\n');
        instruction += `\n---\n【${_title('format_reading', '阅读训练格式规范')}】\n${fmtContent}\n`;
      } else {
        console.warn('[instructionLib] 未找到输出格式: reading');
      }
    } else {
      // 🔧 考卷/课时练/专项突破的格式（从指令库读取，含学科专属补充）
      const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', matchSubject, stage, genType: primaryGenType, specialSubType: primaryGenType === 'special' ? specialSubType : '' });
      if (fmtBlocks.length > 0) {
        const fmtContent = fmtBlocks.map(b => b.content).join('\n');
        instruction += `\n---\n【${_title('format_exam', '试卷/练习格式规范')}】\n${fmtContent}\n`;
      } else {
        console.warn(`[instructionLib] 未找到输出格式: genType=${primaryGenType}`);
      }

      // 🔧 Q3: 学科标记已统一在 section 19 从指令库三维度注入，此处不再重复硬编码

      // 输出格式已在上方【输出格式】中统一注入，此处不再重复
      instruction += `\n`;
      
      // 🔧 EduRender 模板已合入上方【图形/图表/公式/配图专项指令】dual-source（专项要求+EduRender模板），此处不再重复注入
    }

    // ========== 5.【质量范例】few-shot 示例（由 getGenTypeExample 提供块级标题）==========
    if (genTypes && genTypes.length > 0 && matchSubject) {
      const genTypeExample = getGenTypeExample(genTypes[0], matchSubject, stage, isLowerPrimary, grade, gradeSegment, specialSubType);
      if (genTypeExample) {
        instruction += `\n${genTypeExample}\n`;
      }
    }

    // ========== 9.【模板精准对标】 ==========
    if (selectedTemplates && selectedTemplates.length > 0) {
      // 🔧 从指令库获取块标题（三维度查询，无硬编码）
      const _tplTitleBlocks = getMatchingBlockInstructions({ category: '生成-指令块标题', subject: '', stage: '', genType: 'template' });
      const _tplTitle = _tplTitleBlocks.length > 0 ? _tplTitleBlocks[0].content : '模板精准对标';
      instruction += `\n---\n【${_tplTitle}】\n`;
      instruction += `请深度对标以下模板的风格特征（题型结构、设问方式、语言表达、难度层次），作为本次生成的质量基准：\n`;
      for (const tpl of selectedTemplates) {
        const selectedChapters = tpl.selectedChapters || [];
        instruction += `\n📋 《${tpl.name}》\n`;
        if (selectedChapters.length > 0) {
          for (const chapter of selectedChapters) {
            instruction += `  - ${chapter.title}（第${chapter.start}-${chapter.end}页）\n`;
          }
        }
        if (tpl.analysis) {
          // 🔧 DeepSeek 整卷生成：跳过模板题数/分值/结构分析，仅保留章节信息作为语境参考
          if (!_isDeepSeekInstruction) {
          const tplStructure = tpl.analysis.结构分析 || tpl.analysis.structure || [];
          if (tplStructure.length > 0) {
            instruction += `  结构分析：\n`;
            for (const section of tplStructure) {
              instruction += `    - ${section.大题 || section.题型}：${section.小题数量 || 0}小题，共${section.大题分值 || 0}分`;
              if (section.设问风格) instruction += `，设问：${section.设问风格}`;
              if (section.难度) instruction += `，难度：${section.难度}`;
              instruction += '\n';
            }
          }
          const tplTotalScore = tpl.analysis.总分 || tpl.analysis.totalScore || 0;
          const tplQuestionCount = tpl.analysis.总题数 || tpl.analysis.questionCount || 0;
          if (tplTotalScore) {
            instruction += `  总分：${tplTotalScore}分\n`;
          }
          if (tplQuestionCount) {
            instruction += `  总题数：${tplQuestionCount}题\n`;
          }
          }

          // 🔧 改进：提取典型题目作为风格参照（每种题型取2道）
          // 🔧 DeepSeek 整卷生成跳过：真题示例+量化特征+语言风格指纹+格式排版指纹（过长不必要）
          if (tpl.analysis.questionCards && tpl.analysis.questionCards.length > 0) {
            if (!_isDeepSeekInstruction) {
            const cards = tpl.analysis.questionCards;
            instruction += `\n  【模板真题示例——以下为模板典型题目，供参考风格和结构，无需机械模仿】\n`;
            // 优先取不同题型的题，每种题型取2道
            const typeOrder = ['选择题', '填空题', '判断题', '解答题', '计算题', '应用题', '简答题'];
            const samples = [];
            for (const type of typeOrder) {
              const typeCards = cards.filter(c => c.type === type);
              const picked = typeCards.slice(0, 2); // 🔧 每种题型取2道
              samples.push(...picked);
              if (samples.length >= 5) break; // 🔧 最多5道
            }
            // 如果题型不足3种，补充其他题
            if (samples.length < 3) {
              for (const card of cards) {
                if (!samples.find(s => s.number === card.number)) {
                  samples.push(card);
                  if (samples.length >= 3) break;
                }
              }
            }
            for (const s of samples) {
              instruction += `  ▶ 第${s.number}题（${s.type}，${s.difficulty || '未知'}难度，${s.score || '?'}分）：\n`;
              instruction += `    题干：${s.stem}\n`;
              if (s.options && s.options.length > 0) {
                instruction += `    选项：${s.options.map((o, i) => String.fromCharCode(65 + i) + '. ' + o).join('；')}\n`;
              }
              if (s.questionFeature) {
                instruction += `    设问特征：${s.questionFeature}\n`;
              }
            }
            // 统计题干长度特征
            const stemLengths = cards.filter(c => c.stem).map(c => c.stem.length);
            if (stemLengths.length > 0) {
              const avgLength = Math.round(stemLengths.reduce((a, b) => a + b, 0) / stemLengths.length);
              const minLength = Math.min(...stemLengths);
              const maxLength = Math.max(...stemLengths);
              instruction += `  题干长度参考：平均${avgLength}字（范围${minLength}~${maxLength}字），供参考，可根据知识点需要灵活调整。\n`;
            }
            
            // ✨ 模板量化特征分析
            const totalCards = cards.length;
            if (totalCards > 0) {
              // 题型分布统计
              const typeCount = {};
              cards.forEach(c => { typeCount[c.type] = (typeCount[c.type] || 0) + 1; });
              const typeDist = Object.entries(typeCount)
                .map(([t, n]) => `${t}占${Math.round(n/totalCards*100)}%`)
                .join('，');
              
              // 难度分布统计
              const diffCount = {};
              cards.forEach(c => { diffCount[c.difficulty] = (diffCount[c.difficulty] || 0) + 1; });
              const diffDist = Object.entries(diffCount)
                .map(([d, n]) => `${d}占${Math.round(n/totalCards*100)}%`)
                .join('，');
              
              // 选项数量统计（选择题）
              const choiceCards = cards.filter(c => c.type === '选择题' && c.options?.length);
              const optionCounts = choiceCards.map(c => c.options.length);
              const avgOptions = optionCounts.length > 0 
                ? Math.round(optionCounts.reduce((a, b) => a + b, 0) / optionCounts.length) 
                : 4;
              
              // 情境融入比例
              const contextCards = cards.filter(c => 
                c.questionFeature?.includes('情境') || c.stem?.length > 50
              );
              const contextRatio = Math.round(contextCards.length / totalCards * 100);
              
              // 难度排序规律
              const difficultyOrder = cards.map(c => c.difficulty);
              const firstHardIndex = difficultyOrder.findIndex(d => d === '较难' || d === '提高');
              const difficultyCurve = firstHardIndex > 0 
                ? `前${firstHardIndex}题以基础为主，从第${firstHardIndex + 1}题开始出现较难题`
                : '难度均匀分布';
              
              instruction += `\n  【模板量化特征——供参考】\n`;
              instruction += `  - 题型分布：${typeDist}\n`;
              instruction += `  - 难度分布：${diffDist}\n`;
              instruction += `  - 难度递进：${difficultyCurve}\n`;
              instruction += `  - 选择题选项数：${avgOptions}个\n`;
              instruction += `  - 情境融入比例：约${contextRatio}%（${contextCards.length}/${totalCards}题有情境）\n`;
              // 🔧 新增：注入语言指纹
              if (tpl.analysis?.languageStyle) {
                const ls = tpl.analysis.languageStyle;
                instruction += `\n  【语言风格指纹——供参考】\n`;
                if (ls.avgSentenceLength) {
                  instruction += `  - 平均句长：${ls.avgSentenceLength}字（供参考，可根据知识点需要灵活调整）\n`;
                }
                if (ls.commonPatterns?.length) {
                  instruction += `  - 高频句式：${ls.commonPatterns.join('、')}\n`;
                }
                if (ls.connectors?.length) {
                  instruction += `  - 连接词偏好：${ls.connectors.join('、')}\n`;
                }
                if (ls.contextIntro) {
                  instruction += `  - 情境引入方式：${ls.contextIntro}\n`;
                }
                if (ls.personReference) {
                  instruction += `  - 指代方式：${ls.personReference}\n`;
                }
                if (ls.tone) {
                  instruction += `  - 语气特征：${ls.tone}\n`;
                }
                if (ls.sampleSentence) {
                  instruction += `  - 典型句式示例：「${ls.sampleSentence}」\n`;
                }
              }
              
              // 🔧 新增：注入格式排版特征
              if (tpl.analysis?.formatStyle) {
                const fs = tpl.analysis.formatStyle;
                instruction += `\n  【格式排版指纹——供参考】\n`;
                if (fs.spacingBetweenQuestions !== undefined) {
                  instruction += `  - 题目间距：${fs.spacingBetweenQuestions ? '题间有空行' : '题间紧凑排列'}\n`;
                }
                if (fs.indentation) {
                  instruction += `  - 缩进方式：${fs.indentation}\n`;
                }
                if (fs.scorePosition && primaryGenType !== 'practice') {
                  instruction += `  - 分数标注位置：${fs.scorePosition}\n`;
                }
                if (fs.chartDescriptionFormat) {
                  instruction += `  - 图表说明格式：${fs.chartDescriptionFormat}\n`;
                }
              }
            }
          }
          } // _isDeepSeekInstruction guard end (verbose template analysis)
        } else {
          instruction += `  （请先点击「分析模板」获取模板特征）\n`;
        }
      }
            // ✨ 语言风格特征分析 — 🔧 DeepSeek 跳过（过长统计信息，整卷生成不需要）
      if (!_isDeepSeekInstruction) {
      if (selectedTemplates && selectedTemplates.length > 0) {
        const tpl = selectedTemplates[0];
        if (tpl.analysis?.questionCards?.length > 0) {
          const cards = tpl.analysis.questionCards;
          // 分析语言风格
          const allStems = cards.map(c => c.stem || '').filter(Boolean);
          const avgStemLen = allStems.length > 0 
            ? Math.round(allStems.reduce((a, b) => a + b.length, 0) / allStems.length) 
            : 0;
          const shortQuestions = allStems.filter(s => s.length < 30).length;
          const longQuestions = allStems.filter(s => s.length > 80).length;
          
          // 分析设问模式
          const directQuestions = cards.filter(c => 
            c.questionFeature?.includes('直接设问') || 
            (c.stem || '').match(/^(请|试|计算|求解|证明|判断|选择|填空)/)
          ).length;
          const contextQuestions = cards.filter(c => 
            c.questionFeature?.includes('情境') || (c.stem || '').length > 60
          ).length;
          
          instruction += `\n  【语言风格特征——供参考】\n`;
          instruction += `  - 题干平均长度：${avgStemLen}字（短题干≤30字：${shortQuestions}题，长题干≥80字：${longQuestions}题）\n`;
          instruction += `  - 设问方式：直接设问${directQuestions}题，情境设问${contextQuestions}题\n`;
          
          if (avgStemLen < 40) {
            instruction += `  - 风格倾向：简洁精炼型，题干短小直接，适合低年级或基础训练\n`;
          } else if (avgStemLen > 70) {
            instruction += `  - 风格倾向：情境丰富型，题干包含完整情境描述，适合高年级或综合应用\n`;
          } else {
            instruction += `  - 风格倾向：均衡型，题干长度适中，兼顾情境与效率\n`;
          }
          
          // 分析语言特征：是否使用"请""试""已知"等引导词
          const hasPlease = allStems.filter(s => s.includes('请')).length;
          const hasTry = allStems.filter(s => s.includes('试')).length;
          const hasKnown = allStems.filter(s => s.includes('已知')).length;
          if (hasPlease > 0 || hasTry > 0 || hasKnown > 0) {
            instruction += `  - 语言习惯：`;
            const habits = [];
            if (hasPlease > 0) habits.push(`使用"请"引导（${hasPlease}题）`);
            if (hasTry > 0) habits.push(`使用"试"引导（${hasTry}题）`);
            if (hasKnown > 0) habits.push(`使用"已知"陈述（${hasKnown}题）`);
            instruction += habits.join('，') + '\n';
          }
          
          // 答案格式特征
          const answerCards = cards.filter(c => c.answer);
          if (answerCards.length > 0) {
            const answerLengths = answerCards.map(c => (c.answer || '').length);
            const avgAnsLen = Math.round(answerLengths.reduce((a, b) => a + b, 0) / answerLengths.length);
            instruction += `  - 答案格式：平均${avgAnsLen}字，`;
            if (avgAnsLen < 10) instruction += `简洁型（适合填空/选择）\n`;
            else if (avgAnsLen < 50) instruction += `标准型（适合计算/简答）\n`;
            else instruction += `详细型（适合解答/论述）\n`;
          }
        }
      }
      } // _isDeepSeekInstruction guard end (语言风格特征)
      instruction += `\n请参考模板在以下维度的特征进行设计：题型结构、${primaryGenType !== 'practice' ? '分值分布、' : ''}设问风格、语言表达、难度层次。\n`;
      instruction += `可适量引用模板中的优秀题目（不超过30%），但大部分题目需基于教材内容重新命题，鼓励在模板基础上进行创新设计。\n\n`;
      
      // 🔧 注入模板风格约束（供逐题生成时参考）— DeepSeek 整卷生成跳过
      if (!_isDeepSeekInstruction) {
      const _ts_firstTpl = selectedTemplates[0];
      if (_ts_firstTpl?.analysis?.languageStyle) {
        const _ts_ls = _ts_firstTpl.analysis.languageStyle;
        instruction += `\n---\n【${_title('template_style', '模板风格参考——逐题生成时可参考')}】\n`;
        if (_ts_ls.avgSentenceLength) instruction += `- 题干平均句长约${_ts_ls.avgSentenceLength}字\n`;
        if (_ts_ls.commonPatterns?.length) instruction += `- 优先使用句式：${_ts_ls.commonPatterns.slice(0, 3).join('、')}\n`;
        if (_ts_ls.tone) instruction += `- 语气：${_ts_ls.tone}\n`;
        if (_ts_ls.sampleSentence) instruction += `- 风格参考：「${_ts_ls.sampleSentence}」\n`;
      }
      if (_ts_firstTpl?.analysis?.formatStyle) {
        const _ts_fs = _ts_firstTpl.analysis.formatStyle;
        if (_ts_fs.scorePosition && primaryGenType !== 'practice') instruction += `- 分值位置：${_ts_fs.scorePosition}\n`;
        if (_ts_fs.spacingBetweenQuestions !== undefined) {
          instruction += `- 题间距：${_ts_fs.spacingBetweenQuestions ? '题间空行' : '紧凑排列'}\n`;
        }
      }
      } // _isDeepSeekInstruction guard end (模板风格参考)
      // 🔧 按学段区分模板约束（从指令库三维度智能匹配）
      const tplBanBlocks = getMatchingBlockInstructions({ category: '生成-模板禁止项', stage });
      if (tplBanBlocks.length > 0) {
        instruction += tplBanBlocks[0].content + '\n';
      }
      instruction += '\n';
    }

    instruction += `\n`;

    // ========== 14.【题目质量标准】（从指令库按stage+subject+genType三维度匹配，无硬编码兜底）==========
    // 🔧 DeepSeek 跳过：题目质量标准（题干无歧义、选项长度一致等）DeepSeek 训练数据已知
    if (!_isDeepSeekInstruction) {
    // 🔧 基础规则（所有阶段通用，仅取 subject='' 且 stage='' 的纯通用条目；传 genType 以启用资料类型过滤——听写/默写/总结/预习不注入题目质量标准）
    const qualityBase = getMatchingBlockInstructions({ category: '生成-题目质量标准', subject: '', stage: '', genType: primaryGenType });
    // 🔧 学段专属规则（filter 排除 subject 非空的学科条目，仅取纯学段条目，且按 gradeSegment 精确匹配）
    const qualityStageAll = getMatchingBlockInstructions({ category: '生成-题目质量标准', subject: '', stage: gradeSegment, genType: primaryGenType });
    const qualityStageOnly = qualityStageAll.filter(b => {
      if (!b.stage || b.stage === '' || b.subject !== '') return false;
      return true;
    });
    // 🔧 学科专属规则（filter 排除 subject 为空的通用条目，避免 base 重复）
    const qualitySubjAll = subject ? getMatchingBlockInstructions({ category: '生成-题目质量标准', matchSubject, stage: '', genType: primaryGenType }) : [];
    const qualitySubjOnly = qualitySubjAll.filter(b => b.subject && b.subject !== '');
    
    if (qualityBase.length > 0) {
      instruction += `\n---\n【${_title('quality_standard', '题目质量标准')}】${qualityBase[0].content}\n`;
      // 学段补充（覆盖基础规则中的选项数、难度配比等）
      if (qualityStageOnly.length > 0 && qualityStageOnly[0].content !== qualityBase[0].content) {
        instruction += qualityStageOnly[0].content + '\n';
      }
      // 🔧 Q1: 学科专属补充 — 加分隔符与编号列表明确断开，避免被误解为延续编号
      if (qualitySubjOnly.length > 0) {
        instruction += `\n---\n【${_title('subject_supplement', '学科补充标准')}】\n${qualitySubjOnly[0].content}\n`;
      }
    } else {
      console.warn(`[instructionLib] 未找到题目质量标准: stage=${stage}, subject=${subject}`);
    }
    instruction += '\n';
    }// _isDeepSeekInstruction guard end (题目质量标准)

    // ========== 15.【答案与解析规范】教辅级答案质量（优先从指令库读取）==========
    // 🔧 Q1+Q3+Q4: 对标市面教辅的答案与解析标准
    if (matchSubject) {
      const answerSpec = getAnswerQualitySpec(primaryGenType, matchSubject, stage, specialSubType);
      const scoringRubric = getScoringRubric(primaryGenType, matchSubject, stage);
      const chineseTemplates = getChineseReadingTemplates(matchSubject, primaryGenType, gradeSegment);
      if (answerSpec || scoringRubric || chineseTemplates) {
        const answerSpecBlocks = getMatchingBlockInstructions({ category: '生成-答案与解析规范', subject: '', stage: '' });
        const _ansTitle = _title('answer_spec', '答案与解析规范');
        const answerHeader = answerSpecBlocks.length > 0
          ? `【${_ansTitle}】${answerSpecBlocks[0].content}`
          : `【${_ansTitle}】以下为教辅级答案质量标准，请严格遵守以确保输出质量对标市面教辅：`;
        instruction += answerHeader + '\n';
        if (answerSpec) instruction += answerSpec + '\n';
        if (scoringRubric) instruction += scoringRubric + '\n';
        if (chineseTemplates) instruction += chineseTemplates + '\n';
        instruction += '\n';
      }
    }

    // ========== 16.【答题模板】学科答题规范（从指令库读取，传 genType 排除听写/总结等非答题类型）==========
    // 🔧 DeepSeek 跳过：学科答题规范（解、答、步骤格式等）DeepSeek 训练数据充分覆盖
    if (!_isDeepSeekInstruction && subject) {
      const templateBlocks = getMatchingBlockInstructions({ category: '生成-答题模板', matchSubject, stage: '', genType: primaryGenType });
      if (templateBlocks.length > 0) {
        instruction += `\n---\n【${_title('answer_template', '答题模板')}】${templateBlocks[0].content}\n\n`;
      }
    }

    // ========== 11.【术语规范】学科术语规范（优先从指令库读取，传 genType 排除听写）==========
    // 🔧 DeepSeek 跳过：学科术语标准表述（通假字/单位换算/四则运算等）DeepSeek 训练数据充分覆盖
    if (!_isDeepSeekInstruction && subject) {
      const termBlocks = getMatchingBlockInstructions({ category: '生成-术语规范', matchSubject, stage: '', genType: primaryGenType });
      if (termBlocks.length > 0) {
        instruction += `\n---\n【${_title('terminology', '术语规范')}】${termBlocks[0].content}\n\n`;
      }
    }

    // 🔧 DeepSeek 跳过：原题引用（允许适量改编教材题）是通用常识，无需显式告知
    if (!_isDeepSeekInstruction && allowOriginalQuestions) {
      const originalQuoteBlocks = getMatchingBlockInstructions({ category: '生成-原题引用', subject: '', stage: '', genType: primaryGenType });
      if (originalQuoteBlocks.length > 0) {
        instruction += `\n---\n【${_title('original_quote', '原题引用')}】${originalQuoteBlocks[0].content}\n`;
      } else {
        console.warn('[instructionLib] 未找到原题引用条目');
      }
    }
    
    // ========== 禁止项（三维度精准匹配注入：学科 × 学段 × 资料类型）==========
    const banParts = [];
    
    if (matchSubject) {
      // 学科块内容已自包含（硬性红线 + 配图铁律 + 专属规则 + 反套路），按 subject + genType 精准匹配
      const banSubjAll = getMatchingBlockInstructions({ category: '生成-禁止项', matchSubject, stage: '', genType: primaryGenType });
      const banSubjOnly = banSubjAll.filter(b => b.subject && b.subject.trim() !== '' && !b.stage);
      if (banSubjOnly.length > 0) {
        banParts.push(banSubjOnly[0].content);
      }
      
      // 学段专属禁止项补充（如数学低段数据控制），按 gradeSegment 精确匹配
      const banStageAll = getMatchingBlockInstructions({ category: '生成-禁止项', matchSubject, stage: gradeSegment, genType: primaryGenType });
      const banStageOnly = banStageAll.filter(b => b.subject && b.subject.trim() !== '' && b.stage && b.stage !== '');
      if (banStageOnly.length > 0) {
        banParts.push(banStageOnly[0].content);
      }
    }
    
    if (banParts.length > 0) {
      instruction += `\n---\n【${_title('ban_general', '禁止项')}】\n${banParts.join('\n')}\n`;
    } else {
      console.warn('[instructionLib] 未找到匹配的禁止项（学科/学段/类型无匹配）');
    }
    instruction += '\n';

    // 🔧 通用约束：gradeSegment 精确匹配（低/中/高段细分块）+ 粗粒度 stage 兜底（跨学段通用条目）
    const generalConstraintBlocks = [
      ...getMatchingBlockInstructions({ category: '生成-通用约束', subject: '', stage: gradeSegment, genType: primaryGenType }),
      ...getMatchingBlockInstructions({ category: '生成-通用约束', subject: '', stage, genType: primaryGenType })
    ].filter((block, idx, arr) => arr.findIndex(x => x.id === block.id) === idx);
    // 🔧 DeepSeek 精简：filter out frag_avoid_direct_copy（"避免照搬教材原题"DeepSeek 训练数据已知）
    const filteredConstraints = generalConstraintBlocks.filter(block => {
      if (_isDeepSeekInstruction && block.id === 'frag_avoid_direct_copy') return false;
      return true;
    });
    if (filteredConstraints.length > 0) {
      instruction += `\n---\n【${_title('general_constraint', '通用约束')}】\n`;
      for (const block of filteredConstraints) {
        instruction += `- ${block.content}\n`;
      }
    }

    // 🔧 Fix B: 知识边界约束（明确告诉 AI 什么不考、什么不涉及）
    if (subject) {
      const knowledgeBoundaries = getKnowledgeBoundaries(subject, stage, isLowerPrimary, isMiddlePrimary, isUpperPrimary, grade);
      if (knowledgeBoundaries) {
        instruction += knowledgeBoundaries + '\n\n';
      }
    }

    // ========== 12.【命题范围与风格】 ==========
    if (scopeType || propositionStyle) {
      instruction += `\n---\n【${_title('scope_style', '命题范围与风格')}】\n`;
    }
    if (scopeType) {
      const scopeBlocks = getMatchingBlockInstructions({ category: '生成-范围标签', genType: scopeType });
      const scopeLabel = scopeBlocks.length > 0 ? scopeBlocks[0].content : '默认范围';
      instruction += `范围类型：${scopeLabel}。\n`;
      // 🔧 跨章综合语义：多章节合并出卷时，从指令库查询跨章约束（{chapterCount} 占位符运行时替换）
      const totalChapters = selectedBooks.reduce((sum, b) => sum + (b.selectedChapters?.length || 0), 0);
      if (mergeChapters && totalChapters > 1) {
        const crossBlocks = getMatchingBlockInstructions({ category: '生成-范围扩展', genType: scopeType });
        if (crossBlocks.length > 0) {
          instruction += crossBlocks[0].content.replace('{chapterCount}', totalChapters) + '\n';
        }
      }
    }
    if (propositionStyle) {
      // 🔧 从指令库获取命题风格指令（纯三维度查询，无硬编码兜底）
      const styleBlocks = getMatchingBlockInstructions({ category: '生成-命题风格', genType: propositionStyle });
      if (styleBlocks.length > 0) {
        instruction += `命题风格：${styleBlocks[0].content}`;
      } else {
        console.warn(`[instructionLib] 未找到命题风格: propositionStyle=${propositionStyle}`);
      }
      
      if (stage && subject) {
        if (propositionStyle === 'context_fusion' || propositionStyle === 'unified_context') {
          // 🔧 从指令库获取情境方向建议
          const ctxBlocks = getMatchingBlockInstructions({ category: '生成-情境方向', matchSubject, stage });
          if (ctxBlocks.length > 0) {
            instruction += `\n${ctxBlocks[0].content}。`;
          }
        }
      }
      instruction += `\n\n`;
    }

    // 🔧 情境要求（按 stage+subject+genType 从指令库注入情境化命题要求；传 genType 排除 dictation/summary/errorbook 等非命题类型）
    // 🔧 DeepSeek 精简：仅在用户显式选择统一情境模式时才注入情境方向，否则让 DeepSeek 自由发挥情境创造力
    const _shouldInjectContextReq = !_isDeepSeekInstruction
      || (propositionStyle && ['context_fusion', 'unified_context'].includes(propositionStyle));
    if (_shouldInjectContextReq && (stage || subject)) {
      const stageCtxBlocks = getMatchingBlockInstructions({ category: '生成-情境要求', subject: '', stage, genType: primaryGenType });
      const subjCtxBlocks = subject ? getMatchingBlockInstructions({ category: '生成-情境要求', matchSubject, stage: '', genType: primaryGenType }) : [];
      if (stageCtxBlocks.length > 0 || subjCtxBlocks.length > 0) {
        instruction += `\n---\n【${_title('context_req', '情境要求')}】\n`;
        if (stageCtxBlocks.length > 0) {
          instruction += `- ${stageCtxBlocks[0].content}\n`;
        }
        for (const block of subjCtxBlocks) {
          instruction += `- ${block.content}\n`;
        }
        instruction += `\n`;
      }
    }

    // ========== 8.【资料类型补充约束】补充约束模式：提供格式/质量/内容补充，不与【核心任务】争指挥权 ==========
    if (autoFullInstructions && autoFullInstructions.length > 0) {
      // 🔧 从指令库获取块标题（三维度查询，无硬编码）
      const _suppTitleBlocks = getMatchingBlockInstructions({ category: '生成-指令块标题', subject: '', stage: '', genType: 'supplement' });
      const _suppTitle = _suppTitleBlocks.length > 0 ? _suppTitleBlocks[0].content : '资料类型补充约束';
      instruction += `\n---\n【${_suppTitle}】\n`;
      for (const fullIns of autoFullInstructions) {
        instruction += `- ${fullIns.content}\n`;
      }
      instruction += `\n`;
    }

    // 🔧 合并：内容规范 + 特殊要求 → 一个块
    const contentNormBlocks = getMatchingBlockInstructions({ category: '生成-内容规范', subject: '', stage, genType: primaryGenType });
    const _sr_specialReqBlocks = getMatchingBlockInstructions({ category: '生成-特殊要求', subject: '', stage: '', genType: primaryGenType });

    const supplementParts = [];
    if (contentNormBlocks.length > 0) supplementParts.push(contentNormBlocks[0].content);
    if (_sr_specialReqBlocks.length > 0) supplementParts.push(_sr_specialReqBlocks[0].content);

    if (supplementParts.length > 0) {
      instruction += `\n---\n【${_title('content_norm', '内容与特殊要求')}】\n${supplementParts.join('\n')}\n\n`;
    }

    // 🔧 最终输出规则已由 buildOutputPreamble() 在 prompt 最前端注入（查询指令库「生成-输出前置指令」），
    //    此处不再重复注入，避免同一语义出现两次导致模型困惑。

    // ========== 3.【用户补充指令——仅注入未被其他【】块覆盖的补充类片段】==========
    // 🔧 排除已在其他 section 中通过 getMatchingBlockInstructions 显式查询的类别
    // 🔧 排除分析专用类别（文本分析规范/分析模板示例/分析提取要求/知识图谱构建）
    const _ui_handledCategories = new Set([
      // 生成-学段与学科
      '生成-学科适配', '生成-资料类型结构',
      '生成-情境方向',
      '生成-学科特色', '生成-情境要求',
      '生成-年级边界提示', '生成-难度配置',
      // 生成-核心任务与题型
      '生成-核心任务', '生成-题型分布建议', '生成-命题风格',
      // 生成-模板约束
      '生成-模板禁止项', '生成-范围标签',
      // 生成-质量与约束
      '生成-禁止项', '生成-通用约束', '生成-原题引用', '生成-内容规范',
      '生成-输出格式', '生成-学科标记', '生成-EduRender模板', '生成-专项要求', '生成-题型专项要求',
      '生成-题目质量标准', '生成-答案与解析规范', '生成-质量范例', '生成-知识点全覆盖',
      '生成-主观题评分标准', '生成-术语规范', '生成-答题模板', '生成-特殊要求',
      '生成-知识边界', '生成-时间分配', '生成-格式尾约束',
      // 🔧 补漏：品质标准/原创标准有专属 Section，但此前未被列入防线
      '生成-品质标准', '生成-原创标准',
      // 生成-元数据（指令块标题本身）
      '生成-指令块标题',
      // 🔧 补漏：以下 category 在 buildGenerationInstruction 中有专属 Section，但此前被遗漏
      '生成-角色身份',       // Section 0.【角色身份】
      '生成-标题格式',       // Section 0.5.【标题格式】
      '生成-答案区强制锚定',  // Section 1.5.【答案区强制锚定】
      '生成-顶层约束',       // Section N.【顶层约束】
      '生成-尾约束',         // Section N+1.【尾约束】
      '生成-输出前置指令',    // buildOutputPreamble()
      '生成-范围扩展',       // Section: 跨章综合语义 + {chapterCount} 替换
      '生成-多章节标题',     // Section: 多章节降级标题格式 + {titles} 替换
      // 🔧 补建（2026）：5个新类别专属 Section
      '生成-学段控制',       // Section: 学段控制（题量/难度/时长按学段建议）
      '生成-红线约束',       // Section: 红线清单（最高优先级前置注入）
      '生成-题量控制',       // Section: 题量控制（建议总题量范围）
      '生成-难度控制',       // Section: 难度控制（基础:中等:提高比例）
      '生成-学科核心素养',   // Section: 学科核心素养（课标核心素养关键词）
      // 分析-文本分析专用
      '分析-文本分析规范', '分析-分析模板示例', '分析-分析提取要求', '分析-知识图谱构建'
    ]);
    const _ui_supplementaryFragments = (injectedFragments || []).filter(f => !_ui_handledCategories.has(f.category));
    // 🔧 运行时守卫：若第一道防线（GenerateModule 的 HANDLED_BY_DEDICATED_SECTION）已正确过滤，
    //    则此处不应再看到任何内置 fragment。若出现 warning，说明两处过滤器未同步。
    if (_ui_supplementaryFragments.length > 0) {
      const leakedBuiltin = _ui_supplementaryFragments.filter(f => f.builtin).map(f => f.category);
      const leakedUnique = [...new Set(leakedBuiltin)];
      if (leakedUnique.length > 0) {
        console.warn('[buildGenerationInstruction] ⚠️ 内置 fragment 穿透双防线！以下 category 需加入 _ui_handledCategories：', leakedUnique);
      }
    }
    if (_ui_supplementaryFragments.length > 0) {
      // 按类别分组，避免重复内容
      const _ui_grouped = {};
      const _ui_seenContents = new Set();
      for (const _ui_frag of _ui_supplementaryFragments) {
        if (_ui_seenContents.has(_ui_frag.content)) continue;
        _ui_seenContents.add(_ui_frag.content);
        if (!_ui_grouped[_ui_frag.category]) _ui_grouped[_ui_frag.category] = [];
        _ui_grouped[_ui_frag.category].push(_ui_frag);
      }
      // 🔧 从指令库获取块标题（三维度查询，无硬编码）
      const _usTitleBlocks = getMatchingBlockInstructions({ category: '生成-指令块标题', subject: '', stage: '', genType: 'user_supplement' });
      const _usTitle = _usTitleBlocks.length > 0 ? _usTitleBlocks[0].content : '用户补充指令';
      instruction += `\n---\n【${_usTitle}】\n`;
      for (const _ui_categoryFrags of Object.values(_ui_grouped)) {
        for (const _ui_frag of _ui_categoryFrags) {
          instruction += `- ${_ui_frag.content}\n`;
        }
      }
      instruction += '\n';
    }

    // ========== N.【顶层约束】 ==========
    // 🔧 DeepSeek 跳过：顶层约束的 11 条全部在前方更精准的节中有单独注入
    //    （题型多样化→题型设计、填空格式→输出格式+尾约束、配图→配图要求、
    //     分值→禁止项、答案分离→答案区强制锚定、HTML格式→buildOutputPreamble…）
    //    此复述版在近因位置会覆盖精准版，DeepSeek 不需要这种重复强调
    // 🔧 review 例外：复习资料的“板块标题强制字样”（质量检测对齐）仅在本块声明，前方无承载节，
    //    DeepSeek 跳过会导致检测器字面匹配失败（典型题/知识框架 0 处），故 review 时保留注入
    const topConstraintBlocks = getMatchingBlockInstructions({ category: '生成-顶层约束', subject: '', stage: '', genType: primaryGenType });
    if (topConstraintBlocks.length > 0 && (!_isDeepSeekInstruction || primaryGenType === 'review')) {
      instruction += `\n---\n【${_title('top_constraint', '顶层约束')}】\n${topConstraintBlocks[0].content}\n\n`;
    }
    
    // 🔧 格式重申锚点：利用近因效应，在生成前最后一次强调输出格式
    //    上方【输出格式】在指令中部，长篇 prompt 中容易被"Lost in the Middle"吞掉
    //    此处以最小干扰重申核心格式要求，与 buildOutputPreamble（首因）形成首尾呼应
    //    DeepSeek 跳过：纯元指令（"严格遵循上方各节"）无增量信息，buildOutputPreamble 已在首因完成同样约束
    if (!_isDeepSeekInstruction) {
      instruction += `\n---\n【输出格式重申】请严格遵循上方各节中的输出格式规范与结构要求。输出完整 HTML 文档，禁止 Markdown、禁止前言。\n\n`;
    }
    
    // ========== N+1.【尾约束】 ==========
    // 尾约束中的填空互斥/空标签规则是最关键的语义区分（词语填空→<u>，独立括号→<span>），
    // 对 DeepSeek 与 Ollama 同等重要——recency 效应叠加语义区分，不能再跳过
    const tailConstraintBlocks = getMatchingBlockInstructions({ category: '生成-尾约束', subject: '', stage: '', genType: primaryGenType });
    if (tailConstraintBlocks.length > 0) {
      instruction += `\n---\n【${_title('tail_constraint', '尾约束')}】\n${tailConstraintBlocks[0].content}\n\n`;
    }

    // ========== 格式尾约束（recency 效应：所有引擎通用，三维度匹配 genType）==========
    const formatTailBlocks = getMatchingBlockInstructions({ category: '生成-格式尾约束', subject: '', stage: '', genType: primaryGenType });
    if (formatTailBlocks.length > 0) {
      instruction += `\n${formatTailBlocks[0].content}\n`;
    }

    //
    // buildOutputPreamble() 已在 generateFullPaper 最前注入，此处不再重复。
    //

    // 🔧 块间间距归一化：确保每个 --- 分隔线前恰好一个空行，消除不规则间距
    instruction = instruction.replace(new RegExp(String.fromCharCode(10) + '+---' + String.fromCharCode(10), 'g'), String.fromCharCode(10) + String.fromCharCode(10) + '---' + String.fromCharCode(10));
    instruction = instruction.replace(/^\n+/, '');
    return instruction;
    } catch (e) {
      console.error('[buildGenerationInstruction] :', e);
      throw e;
    }
  };

  
  /**
   * 🔧 AI语义审查（调用DeepSeek通读全文，抓语病/错字/逻辑矛盾）
   */
  const performSemanticReview = async (content, context) => {
    const { genType, subject, stage, grade } = context;
    const genTypeLabel = pickLabelFromPool(genType, '_all_');
    const reviewPrompt = AISemanticReviewer.buildReviewPrompt(content, {
      genType, genTypeLabel, subject, stage, grade
    });
    
    console.log('🔍 发起AI语义审查...');
    try {
      const result = await callAI(reviewPrompt, {
        taskType: 'review',
        temperature: 0.2,
        skipSelfReview: true,
        skipAbortCheck: true,
        timeout: 60000,
      });
      
      if (result && result.content) {
        const parsed = AISemanticReviewer.parseReviewResult(result.content);
        console.log(parsed.summary);
        return parsed;
      }
      return { hasIssues: false, issues: [], summary: '审查无响应' };
    } catch (e) {
      console.warn('AI语义审查失败（不阻断流程）:', e.message);
      return { hasIssues: false, issues: [], summary: '审查调用失败' };
    }
  };

  /**
   * 🔧 AI语义修复 —— 将语义审查发现的问题发给AI修复
   * 独立于 attemptContentRepair，有自己的防循环守卫
   */
  let _semanticRepairActive = false;
  const repairSemanticIssues = async (content, semanticIssues, context) => {
    if (_semanticRepairActive) {
      console.log('⏭️ 语义修复已执行过，跳过（防循环）');
      return { content, repaired: false };
    }
    if (!semanticIssues || semanticIssues.length === 0) {
      return { content, repaired: false };
    }

    _semanticRepairActive = true;
    const { genType, subject, stage, grade } = context;
    const genTypeLabel = pickLabelFromPool(genType, '_all_');

    const issuesText = semanticIssues.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const repairPrompt = `【语义修复任务】
以下是一份${genTypeLabel || '资料'}（${[subject, grade, stage].filter(Boolean).join('·')}），AI语义审查发现了以下问题，请逐一修复：

【需修复的问题】
${issuesText}

【修复要求】
1. 逐一修复上述每个问题，确保修复后语句通顺、无错字、逻辑自洽
2. 严格保留原有HTML结构、CSS类名、填空格式（<u class="blank-N">）不变
3. 只修改有问题的部分，其他内容原封不动
4. 直接返回修复后的完整HTML，不要加任何解释说明

【原始内容】
${content}`;

    console.log('🔧 发起AI语义修复...');
    try {
      const result = await callAI(repairPrompt, {
        taskType: 'quality-repair',
        temperature: 0.2,
        skipSelfReview: true,
        skipAbortCheck: true,
        timeout: 120000,
      });

      if (result && result.content && result.content.length > 100) {
        // 🔧 清洗修复返回：剥离 AI 附加的解释/质检记录文字（如“已修复以下问题：…”），只保留 HTML 正文
        const cleaned = cleanReasoningOutput(result.content);
        if (cleaned && cleaned.length > 100) {
          console.log('✅ AI语义修复完成');
          return { content: cleaned, repaired: true };
        }
        console.log('⚠️ 语义修复返回清洗后异常，保留原始内容');
        return { content, repaired: false };
      }
      console.log('⚠️ 语义修复返回内容异常，保留原始内容');
      return { content, repaired: false };
    } catch (e) {
      console.warn('AI语义修复失败（不阻断流程）:', e.message);
      return { content, repaired: false };
    } finally {
      _semanticRepairActive = false;
    }
  };

  /**
   * 🔧 AI内容修复（单次，防循环）
   * 质检发现问题 → 构建修复prompt → 调用AI → 再质检 → 返回最终结果
   * 最多执行1次，由 _repairActive 标志守卫
   */
  const attemptContentRepair = async (content, hardIssues, context) => {
    const { genType, genTypeLabel, subject, stage, grade, parsedBlueprint, materialText } = context;
    
    // 筛选需要AI修复的问题
    const repairableIssues = HardRuleChecker.getRepairableIssues(hardIssues, genType);
    if (repairableIssues.length === 0) return { content, repaired: false, repairIssues: [] };
    
    // 防循环守卫
    if (_repairActive) {
      console.log('⏭️ AI修复已执行过，跳过（防循环）');
      return { content, repaired: false, repairIssues: [] };
    }
    
    _repairActive = true;
    const issueTypes = repairableIssues.map(i => i.type).join(', ');
    console.log('\n🔧 检测到 ' + repairableIssues.length + ' 个需修复问题：' + issueTypes + '，发起AI修复...');
    
    try {
      // 构建修复prompt
      const repairPrompt = HardRuleChecker.buildRepairPrompt(content, repairableIssues, {
        genType, genTypeLabel, subject, stage, grade, materialText
      });
      
      // 调用AI修复（低温度，精确修复）
      const repairResult = await callAI(repairPrompt, {
        taskType: 'quality-repair',
        temperature: 0.3,
        skipSelfReview: true,
        skipAbortCheck: true,
      });
      
      if (repairResult && repairResult.content && repairResult.content.length > 100) {
        // 🔧 清洗修复返回：剥离 AI 附加的解释/质检记录文字（如“已修复以下问题：…”），只保留 HTML 正文
        const cleanedRepair = cleanReasoningOutput(repairResult.content);
        if (!cleanedRepair || cleanedRepair.length < 100) {
          console.log('⚠️ AI修复返回内容清洗后异常，保留原始内容');
          return { content, repaired: false, repairIssues: [] };
        }
        const repairedContent = cleanedRepair;
        
        // 修复后再次质检
        const recheckIssues = HardRuleChecker.check(
          repairedContent, parsedBlueprint || [], subject, stage, grade, genType, materialText
        );
        
        const autoFixed = HardRuleChecker.autoFix(repairedContent, recheckIssues);
        
        const remainingErrors = recheckIssues.filter(i => i.severity === 'error').length;
        console.log('✅ AI修复完成，修复后再检：' + recheckIssues.length + ' 个问题（' + remainingErrors + ' 个错误）');
        
        return { content: autoFixed, repaired: true, repairIssues: recheckIssues };
      }
      
      console.log('⚠️ AI修复返回内容异常，保留原始内容');
      return { content, repaired: false, repairIssues: [] };
      
    } catch (repairError) {
      console.error('❌ AI修复失败:', repairError.message);
      return { content, repaired: false, repairIssues: [] };
    } finally {
      _repairActive = false;
    }
  };

// ==================== 🔧 整卷生成（DeepSeek 云端主路径）====================
  // 核心任务 + 结构大纲 + 知识图谱 + 教材原文 + 格式约束 → 一次性产出整份 HTML
  // 取代原 Step3（蓝图规划）+ Step4（逐题生成），让 DeepSeek 云端模型充分发挥原生能力
  const generateFullPaper = async (params) => {
    const {
      instruction,
      genType,
      selectedBooks,
      selectedTemplates,
      contentCards,
      knowledgeMap,
      contextFramework,
      templateInfo,
    } = params;

    const book = selectedBooks?.[0];
    const rawSubject = book?.subject || '';
    const stageRaw = book?.stage || '';
    const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = normalizeSubjectName(rawSubject, stage);
    const isExam = genType === 'exam';

    // 从指令中提取总分
    let totalScore = 0;
    const scoreMatch = instruction.match(/总分[：:]\s*(\d+)/);
    if (scoreMatch) totalScore = parseInt(scoreMatch[1]);

    const genConfig = await getCurrentEngineConfigEnhanced('generation');
    const modelName = getModelDisplayName(genConfig.textModel || genConfig.model);
    statusText.value = `步骤 3/4：整卷生成 [${modelName}]...`;
    progress.value = 40;

    // ── 构建知识图谱文本 ──
    let kmText = '【知识点清单】\n' + (knowledgeMap.knowledgePoints?.join('、') || '教材核心知识点') + '\n';
    kmText += '\n【重难点】\n' + (knowledgeMap.keyDifficulties?.join('、') || '教材重难点') + '\n';
    
    const graph = knowledgeMap.knowledgeGraph || [];
    if (graph.length > 0) {
      const totalUnits = graph.length;
      const totalKps = graph.reduce((sum, unit) => 
        sum + (unit.bigConcepts?.reduce((s, bc) => 
          s + (bc.coreKnowledge?.length || 0), 0
        ) || 0), 0
      );
      kmText += '\n【层级知识图谱】（' + totalUnits + '个单元，' + totalKps + '个核心知识点）\n';
      kmText += JSON.stringify(graph, null, 2) + '\n';
    }

    // ── 🔧 精准原文检索：利用分析阶段 KP→segment 反向索引
    //    从 knowledgeMap.knowledgePoints 提取知识点列表，通过 retrieveBlueprintSegments
    //    O(1) 索引查表获取绑定原文片段，替代原来的全量无差别注入
    //    预算 6K 字——保障指令可见性优先，覆盖核心知识点的原文出处为辅助
    let materialText = '';
    if (contentCards && contentCards.length > 0) {
      // 从知识图谱中提取所有知识点作为检索查询
      const allKps = [];
      if (knowledgeMap?.knowledgePoints?.length) {
        allKps.push(...knowledgeMap.knowledgePoints);
      }
      if (knowledgeMap?.knowledgeGraph?.length) {
        for (const unit of knowledgeMap.knowledgeGraph) {
          for (const bc of (unit.bigConcepts || [])) {
            for (const ck of (bc.coreKnowledge || [])) {
              if (ck.name) allKps.push(ck.name);
              if (ck.specificConcepts?.length) allKps.push(...ck.specificConcepts);
            }
          }
        }
      }
      const uniqueKps = [...new Set(allKps)];
      if (uniqueKps.length > 0) {
        const parsedBlueprint = uniqueKps.map(kp => ({ knowledgePoint: kp }));
        materialText = retrieveBlueprintSegments(contentCards, parsedBlueprint, 6000);
        if (materialText) {
          // 🔧 优先级标注：对标 buildGradedMaterialContext 的 🔴/🟡 分层语义
          //    告知 LLM 这些原文是命题的强制性依据，不是可略过的上下文
          materialText = '【🔴 精准原文检索——以下片段为生成题目的强制性依据，命题必须紧扣原文定义与表述，不可脱离原文臆造知识点】\n' + materialText;
        }
        console.log(`📚 精准原文检索：${uniqueKps.length} 个 KP → 命中 ${(materialText.match(/【/g) || []).length} 个原文片段`);
      }
      // 兜底：无知识点或检索为空时，轮询采样各章节（覆盖期中/期末多章节场景）
      if (!materialText) {
        let fallback = '';
        const chapterCount = contentCards.length;
        const perChapterBudget = Math.max(400, Math.floor(4000 / Math.max(chapterCount, 1)));
        const maxTotal = Math.max(3000, chapterCount * 400);
        let totalUsed = 0;
        for (const card of contentCards) {
          if (!card.segments || card.segments.length === 0) continue;
          let chapterUsed = 0;
          for (const seg of card.segments) {
            if (chapterUsed + seg.text.length > perChapterBudget) break;
            if (totalUsed + seg.text.length > maxTotal) break;
            fallback += `【${card.chapterTitle}】${seg.text}\n`;
            chapterUsed += seg.text.length;
            totalUsed += seg.text.length;
          }
          if (totalUsed >= maxTotal) break;
        }
        materialText = fallback || '(教材原文片段)';
      }
    }

    // ── 难度分布（8 种资料类型全覆盖）──
    const diffRatioMap = {
      exam: '基础约50%，中档约30%，提高约20%',
      practice: '基础巩固→能力提升→拓展探究三层递进',
      special: '入门练→进阶练→挑战练三道阶梯',
      preview: '从已学知识回顾到新课内容感知，难度以复习和预习为主，不设过度挑战',
      reading: '从信息提取到深层理解，题目由浅入深层层递进',
      summary: '从基础概念到综合应用，知识归纳由简到繁',
      dictation: '从常用字词到重点词汇，按教材出现顺序由易到难排列',
      errorbook: '从高频错题到易混淆知识点，按错误类型分类整理',
      review: '知识框架→典型题析→易错辨析→综合自测，自测题基础约50%+中档约30%+提高约20%',
    };
    let diffRatio = diffRatioMap[genType] || '题目从易到难排列';
    // 🔴 考卷难度比例与真题蓝本对齐：按学段动态取值（与「生成-难度配置」块、蓝图命题约束第3条同源），
    //    避免固定 5:3:2 与蓝本打架（如初中蓝本 6:3:1、低段 7:2:1）
    if (genType === 'exam') {
      const diffBook = selectedBooks?.[0];
      if (diffBook) {
        const stageMap3 = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
        const ds = stageMap3[diffBook.stage] || diffBook.stage;
        const dg = extractGradeNum(diffBook.grade || '');
        const dr = getStageDifficultyRatio(ds, dg > 0 && dg <= 2, dg >= 3 && dg <= 4, dg >= 5, 'exam');
        if (dr) diffRatio = `基础约${dr.basic}%，中档约${dr.medium}%，提高约${dr.advanced}%`;
      }
    }

    // 🔧 资料类型名称池——轮换使用，避免标题千篇一律（使用模块级池）
    const selectedChapters = book?.selectedChapters || [];
    const chapterKey = selectedChapters.map(c => c.title).join('|') || '_all_';
    const genTypeLabel = pickLabelFromPool(genType, chapterKey);

    // ── 组装整卷生成 prompt ──
    // 🔧 KV Cache 破坏标记：章节指纹 + 随机盐，确保每次请求前缀天然差异化，
    //    阻止 DeepSeek 云端前缀匹配复用上一轮 KV Cache。
    //    纯随机数不够——random 注释后相同的前缀仍被缓存命中，章节指纹让前缀天然不同。
    const chapterFingerprint = selectedBooks?.flatMap(b => 
      (b.selectedChapters || []).map(c => c.title?.slice(0, 30) || '')
    ).join('|').slice(0, 120) || Date.now().toString(36);
    const cacheBuster = `<!-- ctx:${chapterFingerprint}|${Math.random().toString(36).slice(2, 6)} -->\n`;
    
    // 🔧 变量替换：指令中的占位符 → 运行时实际值（role/title/top 中的 {genTypeLabel}/{diffRatio}/{pageCount}）
    const pageCount = getPageCount(genType, stage);
    let finalInstruction = instruction
      .replace(/\{genTypeLabel\}/g, genTypeLabel)
      .replace(/\{diffRatio\}/g, diffRatio)
      .replace(/\{pageCount\}/g, pageCount);

    // 直接生成：完整指令 + 教材原文 + 知识图谱 → 一次性产出整卷
    statusText.value = `步骤 3/4：开始生成整卷...`;
    progress.value = 42;

    let fullPrompt = cacheBuster + buildOutputPreamble() + '\n';
    fullPrompt += finalInstruction;
    fullPrompt += '\n\n⚠️ 以上为完整指令，请严格遵循每一个细节要求，生成完整 HTML 资料。\n\n';
    fullPrompt += kmText;
    // 🔴 多单元组卷规范（exam 且勾选多个单元时注入，含单元知识点统计）
    const multiUnitText = buildMultiUnitExamConstraint(knowledgeMap, isExam);
    if (multiUnitText) fullPrompt += multiUnitText;
    fullPrompt += '\n\n【教材原文】\n';
    fullPrompt += materialText;
    fullPrompt += '\n';

    if (contextFramework) {
      const adaptedCF = contextFramework
        .replace(/蓝图中的每道题/g, '整卷中的每道题')
        .replace(/在 sourceChapter 字段中/g, '在题目中');
      fullPrompt += adaptedCF + '\n';
    }

    if (templateInfo) {
      fullPrompt += templateInfo + '\n';
    }

    // ── 指数退避重试（DeepSeek 必须通，不降级到逐题生成）──
    const MAX_RETRIES = 3;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const waitTime = Math.min(3000 * Math.pow(2, attempt - 1), 15000);
          console.log(`🔄 整卷生成第${attempt + 1}次尝试，等待${waitTime / 1000}秒...`);
          await new Promise(r => setTimeout(r, waitTime));
          statusText.value = `步骤 3/4：重试整卷生成 [${modelName}]...（第${attempt + 1}次）`;
        }

        if (abortController.value?.signal.aborted) {
          throw new Error('生成已取消');
        }

        const response = await callAI(fullPrompt, {
          taskType: 'generation',
          timeout: 300000,
          allowContinuation: true,
          retries: 0,
        });

        // 提取 HTML 内容
        let content = response;
        content = content.replace(/^\`\`\`html?\s*\n?/i, '').replace(/\n?\`\`\`\s*$/i, '');
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) content = bodyMatch[1];

        // 🔴 真题卷根治：剥除生成后自审块（<div class="self-review">），质检记录不得泄漏到成品
        content = content.replace(/<div[^>]*class=["'][^"']*self-review[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
        // 🔴 兜底：模型未包进 div 时，从尾部质检特征句（"1.知识点准确性"）截断，仅当该句到文末的纯文本很短（<400字）才执行，防止误伤正文
        const _qcIdx = content.search(/(?:<[^>]+>\s*)*1[\.、．]\s*知识点准确性/);
        if (_qcIdx > 0) {
          const _qcTail = content.substring(_qcIdx).replace(/<[^>]+>/g, '').replace(/\s/g, '');
          if (_qcTail.length < 400) {
            content = content.substring(0, _qcIdx);
            console.log('🧹 已剥除泄漏到成品的质检报告文字');
          }
        }

        // 提取题目列表（多策略降级：regex → 题号模式 → 自由题号 → 块级标签兜底）
        let questionMatches = content.match(/<p class="question"[^>]*>[\s\S]*?<\/p>/g) || [];
        if (questionMatches.length === 0) {
          // 策略A.5：兼容 <div class="question"> / <li class="question"> 等变体
          questionMatches = content.match(/<(?:p|div|li)\s+class="[^"]*question[^"]*"[^>]*>[\s\S]*?<\/(?:p|div|li)>/g) || [];
        }
        if (questionMatches.length === 0) {
          // 策略B：匹配所有含题号前缀的 <p> 标签（兜底模型不遵守 class="question" 的情况）
          // 🔧 [\s\S]*? 替代 [^<]*：容忍题目内的 <strong>/<u>/<em> 等内联格式标签
          questionMatches = content.match(/<p[^>]*>\s*(?:\d+|[一二三四五六七八九十]+)[\.、．)）]\s*[\s\S]*?<\/p>/g) || [];
          if (questionMatches.length > 0) {
            console.warn(`⚠️ 题目解析降级：未匹配到 <p class="question">，改用题号模式匹配到 ${questionMatches.length} 题`);
          }
        }
        if (questionMatches.length === 0) {
          // 策略B.5：放宽到 <div>/<li> 标签的题号模式（DeepSeek 可能用非标准标签）
          // 🔧 [\s\S]*? 替代 [^<]*：容忍题目内的内联格式标签
          questionMatches = content.match(/<(?:div|li|p)[^>]*>\s*(?:\d+|[一二三四五六七八九十]+)[\.、．)）]\s*[\s\S]*?<\/(?:div|li|p)>/g) || [];
          if (questionMatches.length > 0) {
            console.warn(`⚠️ 题目解析降级：未匹配到 <p> 题号标签，改用泛化题号模式匹配到 ${questionMatches.length} 题`);
          }
        }
        if (questionMatches.length === 0 && content.length > 1000) {
          // 策略C：块级标签粗略估计 + 告警
          const blockCount = (content.match(/<(?:p|div|h\d|li)\b[^>]*>/g) || []).length;
          console.warn(`⚠️ 题目解析完全失败：${content.length} 字符内容中未匹配到任何题目格式标签（块级标签=${blockCount}）。模型可能未遵守 <p class="question"> 格式规范，请检查生成结果`);
          // 创建占位计数，不阻塞后续质量校验流程
          questionMatches = Array(Math.max(1, Math.floor(blockCount * 0.4))).fill('<p>(解析失败，见原始内容)</p>');
        }
        const generatedQuestions = questionMatches;

        // 构建伪蓝图（用于后续质量校验）
        // 🔧 修复：原实现硬编码 difficulty:'基础'，导致质量报告误报"规划：基础100% 中档0% 提高0%"
        //    与结果区难度条失真（难度配比已由指令按学段自动注入，卷面真实难度并非全基础）。
        //    - difficulty：沿题目顺序按配比近似分配——卷面按"从易到难"排列，前段基础、中段中档、尾段提高；
        //      exam 用学段配比（与注入 prompt 的 diffRatio 同源，如低段 7:2:1），其余类型用 5:3:2
        //    - type：从题干文本推断常见题型关键词，替代"未知"，提升模板对标报告可读性
        const pbTotal = questionMatches.length;
        let pbRatio = { basic: 50, medium: 30, advanced: 20 };
        if (isExam) {
          const pbBook = selectedBooks?.[0];
          const pbStageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
          const pbStage = pbBook ? (pbStageMap[pbBook.stage] || pbBook.stage) : stage;
          const pbGradeNum = pbBook ? extractGradeNum(pbBook.grade || '') : 0;
          const pbDr = getStageDifficultyRatio(pbStage, pbGradeNum > 0 && pbGradeNum <= 2, pbGradeNum >= 3 && pbGradeNum <= 4, pbGradeNum >= 5, 'exam');
          if (pbDr) pbRatio = pbDr;
        }
        const pbEasyCount = pbTotal > 0 ? Math.round(pbTotal * pbRatio.basic / 100) : 0;
        const pbMediumCount = pbTotal > 0 ? Math.round(pbTotal * pbRatio.medium / 100) : 0;
        // 题型关键词推断（常见题型按命中优先级排列）
        const pbTypeHints = [
          ['看图写话', '看图写话'], ['口语交际', '口语交际'], ['阅读理解', '阅读理解'],
          ['看拼音', '看拼音，写词语'], ['读音', '给加点字选择正确的读音'],
          ['组词', '比一比，再组词'], ['照样子', '照样子，写一写'],
          ['完形填空', '完形填空题'], ['填空', '填空题'], ['默写', '默写题'],
          ['判断', '判断题'], ['选择', '选择题'], ['连线', '连线题'],
          ['应用', '应用题'], ['计算', '计算题'], ['解答', '解答题'],
          ['简答', '简答题'], ['听力', '听力题'], ['写作', '写作题'], ['作文', '写作题'],
        ];
        const parsedBlueprint = questionMatches.map((match, i) => {
          const plainText = match.replace(/<[^>]+>/g, '').trim();
          const numMatch = plainText.match(/^(\d+)[\.、．]/);
          // 难度沿卷面顺序分配（从易到难）
          let difficulty = '基础';
          if (pbTotal > 0) {
            if (i >= pbEasyCount + pbMediumCount) difficulty = '提高';
            else if (i >= pbEasyCount) difficulty = '中档';
          }
          let inferredType = '';
          for (const hint of pbTypeHints) {
            if (plainText.includes(hint[0])) { inferredType = hint[1]; break; }
          }
          return {
            number: numMatch ? parseInt(numMatch[1]) : (i + 1),
            type: inferredType || '未知',
            knowledgePoint: '',
            difficulty,
            score: isExam && questionMatches.length > 0 ? Math.round(totalScore / questionMatches.length) : 0,
            sourceChapter: '',
          };
        });

        console.log(`✅ 整卷生成成功：${questionMatches.length} 道题，${content.length} 字符`);
        if (questionMatches.length === 0 && content.length > 5000) {
          console.warn(`⚠️ 题目计数为 0 但内容丰富（${content.length} 字符），HTML 格式可能偏离规范。生成内容本身可能正常，但后续题目统计/质量校验将跳过。`);
        }
        progress.value = 85;

        return {
          success: true,
          content,
          generatedQuestions,
          parsedBlueprint,
          blueprint: '',
        };

      } catch (error) {
        console.error(`整卷生成失败 (attempt ${attempt + 1}/${MAX_RETRIES}):`, error.message);
        lastError = error;

        if (abortController.value?.signal.aborted) {
          throw error;
        }
        // HTTP 4xx 客户端错误（非 429）不重试
        if (error.response?.status && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
          throw error;
        }
      }
    }

    throw new Error(`整卷生成失败：已重试${MAX_RETRIES}次。最后一次错误：${lastError?.message || '未知错误'}\n请检查 DeepSeek API 配置或网络连接后重试。`);
  };

  // 执行生成
  // ==================== 五步生成 ====================
  const generate = async (instruction, genType, selectedBooks, selectedTemplates, retryCount = 0, blueprintOnly = false) => {
    const MAX_RETRIES = 2;
    // 🔧 缓存管理：
    // - 逐课时调用（_perPeriodKnowledgeMap 已设置）：保留 _cachedContentCards 供复用
    // - 整体生成跳过检测（_preservePeriodCache）：保留 _cachedKnowledgeMap 跳过课时切分
    // - 全新调用：全部清空，从 Step1 开始
    if (!_perPeriodKnowledgeMap && !_preservePeriodCache && !_perChapterChapterTitle) {
      _cachedKnowledgeMap = null;
    }
    if (!_perPeriodKnowledgeMap && !_perChapterChapterTitle) {
      _cachedContentCards = null;
      _cachedInstruction = null;
    }
    _preservePeriodCache = false;
    _perPeriodKnowledgeMap = null;
    _perPeriodSelectedBooks = null;
    _perPeriodSelectedTemplates = null;
    // 🔧 _perChapterChapterTitle 不在此处清除——在 generateFullPaper 中用完即清
    // 🔧 每次生成前创建新的 AbortController，并注册到全局管理器
    if (abortController.value) {
      unregisterController(abortController.value);
    }
    abortController.value = new AbortController();
    registerController(abortController.value);
    isGenerating.value = true;
    progress.value = 0;
    
    try {
      // ✅ 防御检查
      if (!selectedBooks || !Array.isArray(selectedBooks) || selectedBooks.length === 0) {
        console.error('❌ 生成失败：未选择教材');
        isGenerating.value = false;
        return { success: false, error: '未选择教材' };
      }
      // ✅ 根据资料类型选择不同生成流程
      // 🔧 DeepSeek 引擎：所有 8 种资料类型统一走整卷生成路径（跳过 genType 专有函数）
      const _globalRouteConfig = await getCurrentEngineConfigEnhanced('generation');
      const _isDeepSeekPath = _globalRouteConfig.engine === 'deepseek';
      
      if (!_isDeepSeekPath) {
        // Ollama 本地引擎：各资料类型走各自专有生成函数
      if (genType === 'summary') {
        return await generateSummary(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }
      
      if (genType === 'errorbook') {
        return await generateErrorbook(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }

      if (genType === 'preview') {
        return await generatePreview(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }

      if (genType === 'dictation') {
        return await generateDictation(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }

      if (genType === 'reading') {
        return await generateReading(instruction, genType, selectedBooks, selectedTemplates, blueprintOnly);
      }
      } // end Ollama genType routing
      
      // DeepSeek 整卷生成路径：所有 8 种资料类型统一走 Step1+Step2+generateFullPaper
      
      //  学段（函数级作用域，供后续模板使用）
      const stage = selectedBooks?.[0]?.stage || '';
      
      // ========== 第一步：逐课提取命题素材 ==========
      // 🔧 逐课时模式：跳过 Step1-2，使用已缓存的结果和传入的子知识图谱
      let contentCards;
      let knowledgeMap;
      
      if (_perPeriodKnowledgeMap) {
        knowledgeMap = _perPeriodKnowledgeMap;
        contentCards = _cachedContentCards;
        _perPeriodKnowledgeMap = null;
        console.log('[逐课时] 复用已缓存的 Step1-2 结果，知识点数:', knowledgeMap.knowledgePoints?.length);
      } else if (_perChapterChapterTitle) {
        // 🔧 逐章模式（_perChapterChapterTitle 跨 genType 持久，由 GenerateModule 章节循环在完成后清除）
        const targetChapter = _perChapterChapterTitle;

        if (!_cachedContentCards || !_cachedKnowledgeMap) {
          // 首次调用：先做完整 Step1-2 提取填充缓存，再过滤到当前章节
          console.log('[逐章] 首次调用，先执行完整 Step1-2 提取...');
          contentCards = await extractContentCards(
            selectedBooks,
            callAI,
            robustJsonParse,
            (text, prog) => { statusText.value = text; progress.value = prog; }
          );
          _cachedContentCards = contentCards;

          knowledgeMap = await buildKnowledgeMap(
            contentCards,
            selectedBooks,
            callAI,
            robustJsonParse,
            (text, prog) => { statusText.value = text; progress.value = prog; }
          );
          _cachedKnowledgeMap = knowledgeMap;

          // 过滤到当前章节
          contentCards = contentCards.filter(c => c.chapterTitle === targetChapter);
          knowledgeMap = {
            ...knowledgeMap,
            knowledgePoints: (knowledgeMap.knowledgePoints || []).filter(kp => kp.sourceChapter === targetChapter),
            knowledgeGraph: (knowledgeMap.knowledgeGraph || []).filter(bc => {
              return (bc.coreKnowledge || []).some(ck => ck.sourceChapter === targetChapter) || bc.sourceChapter === targetChapter;
            }).map(bc => ({
              ...bc,
              coreKnowledge: (bc.coreKnowledge || []).filter(ck => ck.sourceChapter === targetChapter)
            })).filter(bc => bc.coreKnowledge.length > 0)
          };
        } else {
          // 后续调用：直接从缓存过滤
          contentCards = _cachedContentCards.filter(c => c.chapterTitle === targetChapter);
          const fullKM = _cachedKnowledgeMap;
          knowledgeMap = {
            ...fullKM,
            knowledgePoints: (fullKM.knowledgePoints || []).filter(kp => kp.sourceChapter === targetChapter),
            knowledgeGraph: (fullKM.knowledgeGraph || []).filter(bc => {
              return (bc.coreKnowledge || []).some(ck => ck.sourceChapter === targetChapter) || bc.sourceChapter === targetChapter;
            }).map(bc => ({
              ...bc,
              coreKnowledge: (bc.coreKnowledge || []).filter(ck => ck.sourceChapter === targetChapter)
            })).filter(bc => bc.coreKnowledge.length > 0)
          };
        }
        console.log(`[逐章] 「${targetChapter}」过滤后：${contentCards.length} cards, ${knowledgeMap.knowledgePoints?.length} KPs`);
      } else {
        contentCards = await extractContentCards(
          selectedBooks, 
          callAI, 
          robustJsonParse,
          (text, prog) => { statusText.value = text; progress.value = prog; }
        );
        
        // ========== 第二步：构建层级知识图谱 ==========
        knowledgeMap = await buildKnowledgeMap(
          contentCards, 
          selectedBooks, 
          callAI, 
          robustJsonParse,
          (text, prog) => { statusText.value = text; progress.value = prog; }
        );
      }

      // 🔧 新增：初始化语义检索器
      semanticRetriever.indexContentCards(contentCards);

      // ──────── 课时练课时切分 ────────
      // 仅 practice 类型且非逐课时模式时触发
      if (genType === 'practice' && !_cachedKnowledgeMap) {
        const periods = detectPeriods(knowledgeMap);
        if (periods.length > 1) {
          console.log(`[课时切分] 检测到 ${periods.length} 个课时：`, periods.map(p => `${p.periodName}(${p.kpCount}KP)`).join(', '));
          // 缓存 Step1/2 的结果供逐课时生成复用
          _cachedKnowledgeMap = knowledgeMap;
          _cachedContentCards = contentCards;
          _cachedInstruction = instruction;
          _perPeriodSelectedBooks = selectedBooks;
          _perPeriodSelectedTemplates = selectedTemplates;
          // 通过 periodConfirm 信号通知 UI 层
          periodConfirm.value = {
            periods,
            knowledgeMap,
            contentCards,
            instruction,
            selectedBooks,
            selectedTemplates,
          };
          isGenerating.value = false;
          const returnVal = {
            success: true,
            needsPeriodConfirm: true,
            periods,
          };
          console.log('[课时切分] generate() 即将返回 needsPeriodConfirm:', JSON.stringify({ success: returnVal.success, needsPeriodConfirm: returnVal.needsPeriodConfirm, periodCount: returnVal.periods?.length }));
          return returnVal;
        }
      }

      // ========== 第三步：命题规划 ==========
      const step3Config = await getCurrentEngineConfigEnhanced('blueprint');
      const step3ModelName = getModelDisplayName(step3Config.textModel || step3Config.model);
      statusText.value = `步骤 3/5：命题规划 [${step3ModelName}]...`;
      progress.value = 40;
      
      let templateInfo = '';
      // 🔧 根修复：仅 exam 注入模板分值信息，practice/special 不显示分值
      const isQuestionBased = genType === 'exam' || genType === 'practice' || genType === 'special' || genType === 'review';
      const isExam = genType === 'exam';
      if (selectedTemplates && selectedTemplates.length > 0) {
        const tpl = selectedTemplates[0];
        templateInfo = `\n模板参考：\n`;
        if (tpl.analysis?.structure?.length) {
          const tplBlueprintStructure = tpl.analysis.结构分析 || tpl.analysis.structure || [];
          templateInfo += `结构分析：\n`;
          for (const section of tplBlueprintStructure) {
            // 🔧 仅 exam 显示分值列
            if (isExam) {
              templateInfo += `  ${section.大题 || section.题型}：${section.小题数量 || 0}小题×${section.每小题分值 || 0}分，共${section.大题分值 || 0}分`;
            } else {
              templateInfo += `  ${section.大题 || section.题型}：${section.小题数量 || 0}题`;
            }
            if (section.设问风格) templateInfo += `，设问：${section.设问风格}`;
            if (section.难度) templateInfo += `，难度：${section.难度}`;
            templateInfo += '\n';
          }
        }
        // 🔧 仅 exam 显示模板总分
        if (isExam) {
          const tplBlueprintScore = tpl.analysis?.总分 || tpl.analysis?.totalScore || 0;
          if (tplBlueprintScore) {
            templateInfo += `总分：${tplBlueprintScore}分\n`;
          }
        }
      }
      
      // ✨ 新增：统一情境/情境融合 → 优先使用学科情境库，降级为AI生成
      let contextFramework = '';
      const contextStyles = ['unified_context', 'context_fusion'];
      // 从指令中解析命题风格
      const instructionStyleMatch = instruction.match(/命题风格[：:]\s*([^\n]+)/);
      const instructionStyleText = instructionStyleMatch ? instructionStyleMatch[1] : '';
      const isContextStyle = contextStyles.some(s => instructionStyleText.includes(s));
      
      if (isContextStyle) {
        statusText.value = '步骤 3/5：构建情境框架...';
        progress.value = 42;
        
        try {
          const book = selectedBooks?.[0];
          const rawSubject = book?.subject || '';
          const stage = book?.stage || '';
          const subject = normalizeSubjectName(rawSubject, stage);
          const grade = book?.grade || '';
          
          // 🔧 优先：从学科情境库中获取预设情境
          const presetContexts = getContextsForSubject(subject, stage, 3);
          
          if (presetContexts.length > 0) {
            // 使用预设情境
            const selectedContext = presetContexts[0]; // 取第一个（已随机打乱）
            
            contextFramework = `
【统一情境框架——所有命题必须在此情境下展开】

📖 情境名称：${selectedContext.name}
📝 背景：${selectedContext.description}

📋 可用场景（每个场景可容纳多道题）：
${selectedContext.scenes.map((s, i) => `  场景${i + 1}「${s}」`).join('\n')}

📚 适合考查知识点：${selectedContext.suitableTopics?.join('、') || '教材核心知识点'}

📐 叙事弧线：从简单到复杂递进，场景之间有逻辑连贯性

⚠️ 【关键约束】
1. 蓝图中的每道题必须标注所属场景（在 sourceChapter 字段中注明场景名）
2. 同一场景内的题目要有逻辑连贯性
3. 场景顺序应从简单到复杂，与难度递进匹配
4. 知识点的考查应均匀分布在不同场景中
`;
            console.log(`✅ 使用学科情境库：${subject}·${stage}·${selectedContext.name}`);
          } else {
            // 降级：AI动态生成情境
            console.log('⚠️ 学科情境库无匹配，AI动态生成...');
            
            const contextPrompt = `你是一位${stage}${grade}${subject}教学专家。请为一份教辅资料设计一个贯穿全卷的统一情境/主题故事。

【要求】
1. 情境必须与学科内容和学生生活紧密相关
2. 情境应能自然地容纳不同题型和知识点
3. 情境要有故事性或任务性，而非简单的背景装饰

【输出格式】必须返回严格 JSON：
{
  "name": "情境名称（15字以内）",
  "background": "情境背景描述（50字以内）",
  "mainTask": "核心任务或问题（30字以内）",
  "scenes": [
    {
      "name": "场景名称",
      "description": "场景描述（20字以内）",
      "suitableTopics": ["适合考查的知识点1", "知识点2"],
      "suitableTypes": ["适合的题型1", "题型2"]
    }
  ],
  "narrativeArc": "情境叙事弧线描述（如何从开头发展到结尾，30字以内）"
}

要求 scenes 至少3个场景，最多5个。场景之间要有逻辑递进关系。只返回 JSON。`;

            const contextResult = await callAI(contextPrompt, { 
              taskType: 'blueprint',
              temperature: 0.5,
              timeout: 60000
            });
            
            try {
              const contextJson = await robustJsonParse(
                contextResult, 
                (retryPrompt) => callAI(retryPrompt, { temperature: 0.3, taskType: 'generation' }),
                '情境框架',
                'generation'
              );
              
              contextFramework = `
【统一情境框架——所有命题必须在此情境下展开】

📖 情境名称：${contextJson.name}
📝 背景：${contextJson.background}
🎯 核心任务：${contextJson.mainTask}

📋 可用场景（每个场景可容纳多道题）：
${(contextJson.scenes || []).map((s, i) => 
  `  场景${i + 1}「${s.name}」：${s.description}
     → 适合题型：${(s.suitableTypes || []).join('、')}
     → 适合知识点：${(s.suitableTopics || []).join('、')}`
).join('\n')}

📐 叙事弧线：${contextJson.narrativeArc || '从易到难递进'}

⚠️ 【关键约束】
1. 蓝图中的每道题必须标注所属场景（在 sourceChapter 字段中注明场景名）
2. 同一场景内的题目要有逻辑连贯性
3. 场景顺序应从简单到复杂，与难度递进匹配
4. 知识点的考查应均匀分布在不同场景中
`;
              console.log('✅ AI情境框架生成成功:', contextJson.name);
            } catch (e) {
              console.warn('情境框架解析失败，跳过情境融入:', e.message);
              contextFramework = '';
            }
          }
        } catch (e) {
          console.warn('情境框架生成失败，跳过情境融入:', e.message);
          contextFramework = '';
        }
      }
      
      // ──────── 🔧 引擎路由：DeepSeek → 整卷生成 | Ollama → 传统逐题 ────────
      const _routeConfig = await getCurrentEngineConfigEnhanced('generation');
      const _useFullPaper = _routeConfig.engine === 'deepseek'; // 所有 8 种资料类型，DeepSeek 始终走整卷生成，跳过蓝图确认
      
      // 整卷生成路径下声明的变量（供后续质量校验共享）
      let blueprint = '';
      let parsedBlueprint = [];
      let content = '';
      let generatedQuestions = [];

      if (_useFullPaper) {
        // ========== 🚀 DeepSeek 整卷生成路径 ==========
        statusText.value = '步骤 3/4：整卷生成...';
        progress.value = 40;
        
        try {
          const fpResult = await generateFullPaper({
            instruction, genType, selectedBooks, selectedTemplates,
            contentCards, knowledgeMap, contextFramework, templateInfo,
          });
          content = fpResult.content;
          generatedQuestions = fpResult.generatedQuestions;
          parsedBlueprint = fpResult.parsedBlueprint;
          blueprint = '';
          console.log(`✅ 整卷生成完成：${generatedQuestions.length} 道题，${content.length} 字符`);
        } catch (fpError) {
          console.error('整卷生成失败:', fpError.message);
          throw fpError; // 上抛给外层 generate 的 catch 处理（重试逻辑）
        }
      } else {
        // ========== 传统五步法路径（Ollama / 非考试类资料）==========
      const blueprintTitleMap = {
        'exam': '结构化命题蓝图（双向细目表）',
        'practice': '结构化课时练习蓝图',
        'special': '结构化专项训练蓝图',
        'preview': '课前预习内容规划',
        'reading': '阅读理解训练蓝图',
        'summary': '知识总结内容规划',
        'dictation': '听写/默写内容规划',
        'errorbook': '错题整理规划',
      };
      const blueprintTitle = blueprintTitleMap[genType] || '结构化命题蓝图';

      const prompt3 = `${(() => { const roleMap = { exam: '你是一位命题专家', practice: '你是一位教学设计者', special: '你是一位专项训练设计者', preview: '你是一位课前预习设计者', reading: '你是一位阅读理解命题专家', summary: '你是一位知识总结编写者', dictation: '你是一位听写训练设计者', errorbook: '你是一位错题整理专家' }; const diffFrameMap = { exam: '基础/中档/提高——三道难度梯度确保考试区分度', practice: '基础巩固/能力提升/拓展探究——三道层级体现教学练评一致性', special: '入门练/进阶练/挑战练——三道阶梯实现专项能力突破', preview: '从已学回顾到新课感知——以复习和预习为主', reading: '信息提取→词句理解→主旨概括→推理判断→评价鉴赏', summary: '基础概念→综合应用，知识归纳由简到繁', dictation: '按教材出现顺序由易到难排列', errorbook: '高频错题→易混淆知识点，按类型分类整理' }; return (roleMap[genType] || roleMap.exam) + '。请根据以下信息，生成一份${blueprintTitle}。难度框架：' + (diffFrameMap[genType] || diffFrameMap.exam) + '。'; })()}

【知识点清单】${(() => {
  // 🔧 修复9：如果有认知修正记录，附加到知识点清单中
  const corrections = selectedBooks?.[0]?.selectedChapters?.[0]?._cognitiveCorrections;
  let kpText = knowledgeMap.knowledgePoints.join('、') || '教材核心知识点';
  
  if (corrections?.length) {
    const correctionSummary = corrections.map(c => 
      `"${c.knowledgeName}"应为${c.correctedLevel}（AI原始判断为${c.originalLevel}）`
    ).slice(0, 5).join('；');
    kpText += `\n\n⚠️ 以下知识点认知层次已由学科专家修正，请按修正后的层次规划：${correctionSummary}`;
  }
  return kpText;
})()}

【重难点】
${knowledgeMap.keyDifficulties.join('、') || '教材重难点'}

【层级知识图谱】
${(() => {
  // 🔧 修复：不再人为截断，完整传递用户勾选章节的知识图谱
  // 原因：如果截断，AI会基于不完整的信息生成题目，导致遗漏重要知识点或超纲
  const graph = knowledgeMap.knowledgeGraph || [];
  
  // ✅ 直接返回完整的知识图谱，不做任何截断
  let result = JSON.stringify(graph, null, 2);
  
  // 添加说明：帮助AI理解这个结构
  if (graph.length > 0) {
    const totalUnits = graph.length;
    const totalKps = graph.reduce((sum, unit) => 
      sum + (unit.bigConcepts?.reduce((s, bc) => 
        s + (bc.coreKnowledge?.length || 0), 0
      ) || 0), 0
    );
    result += `\n\n【说明】以上包含${totalUnits}个单元，共${totalKps}个核心知识点。请基于此完整结构规划命题蓝图，不要遗漏任何单元。`;
    
    // 🔧 上下文窗口安全检查（根据引擎动态调整阈值）
    const estimatedTokens = estimateTokens(result);
    // DeepSeek 云端：128K 窗口，安全线 100K；Ollama 本地：32K 窗口，安全线 28K
    const isDeepSeek = step3Config?.engine === 'deepseek';
    const CONTEXT_WINDOW_LIMIT = isDeepSeek ? 100000 : 28000;
    
    if (estimatedTokens > CONTEXT_WINDOW_LIMIT) {
      console.warn(`⚠️ 知识图谱过大（${estimatedTokens} tokens），可能超出模型上下文窗口`);
      console.warn(`   建议：减少勾选的章节数量，或分多次生成`);
      // 不强制截断，让模型自己处理（可能会报错或截断）
      result += `\n\n⚠️ 警告：知识图谱较大（约${estimatedTokens} tokens），请确保模型上下文窗口足够。`;
      
      // 🔧 极端情况下的智能精简策略（DeepSeek 115K / Ollama 35K 触发）
      const SIMPLIFY_THRESHOLD = isDeepSeek ? 115000 : 35000;
      if (estimatedTokens > SIMPLIFY_THRESHOLD) {
        console.warn(`⚠️ 知识图谱极大（${estimatedTokens} tokens），启用智能精简模式`);
        
        // 🔧 修复：保留单元名称、大概念名称和知识点名称，但保留更多关键字段
        const simplifiedGraph = graph.map(unit => ({
          unit: unit.unit,
          bigConcepts: (unit.bigConcepts || []).map(bc => ({
            name: bc.name,
            coreKnowledge: (bc.coreKnowledge || []).map(ck => ({
              name: ck.name,  // 保留名称
              level: ck.level || ck.cognitiveLevel || '理解',  // 保留认知层次
              suggestedQuestionTypes: ck.suggestedQuestionTypes || [],  // ✅ 保留建议题型
              testPriority: ck.testPriority  // ✅ 保留测试优先级
            }))
          }))
        }));
        
        result = JSON.stringify(simplifiedGraph, null, 2);
        result += `\n\n【精简说明】由于知识图谱过大，已简化为单元+大概念+知识点名称结构。具体知识点的详细描述请参考上方的【知识点清单】字段。`;
        result += `\n请基于此完整结构（含所有知识点名称），结合【知识点清单】中的详细信息来规划蓝图。`;
      }
    }
  }
  
  return result;
})()}

【跨章节关联】
${JSON.stringify(knowledgeMap.crossChapterLinks?.slice(0, 5) || [], null, 2)}

${(() => { const _muText = buildMultiUnitExamConstraint(knowledgeMap, genType === 'exam'); return _muText || ''; })()}

${templateInfo}
${contextFramework}

${(() => { const hasTpl = selectedTemplates && selectedTemplates.length > 0; if (!hasTpl) return ''; return '【模板语言风格参考——蓝图中的每道题可参考以下风格特征】\n' + (() => { let styleConstraints = ''; const tpl = selectedTemplates?.[0]; if (tpl?.analysis?.languageStyle) { const ls = tpl.analysis.languageStyle; if (ls.avgSentenceLength) { styleConstraints += `- 题干平均长度目标：${ls.avgSentenceLength}字（±20%）\n`; } if (ls.commonPatterns?.length) { styleConstraints += `- 推荐设问句式：${ls.commonPatterns.slice(0, 3).join('、')}\n`; } if (ls.connectors?.length) { styleConstraints += `- 推荐连接词：${ls.connectors.slice(0, 3).join('、')}\n`; } if (ls.contextIntro) { styleConstraints += `- 情境引入方式：${ls.contextIntro}\n`; } if (ls.tone) { styleConstraints += `- 语气特征：${ls.tone}\n`; } } if (tpl?.analysis?.questionCards?.length) { const cards = tpl.analysis.questionCards; const stemLengths = cards.filter(c => c.stem).map(c => c.stem.length); if (stemLengths.length > 0) { const avgStem = Math.round(stemLengths.reduce((a, b) => a + b, 0) / stemLengths.length); const minStem = Math.min(...stemLengths); const maxStem = Math.max(...stemLengths); styleConstraints += `- 题干字数范围：${minStem}~${maxStem}字（模板实际范围）\n`; } const optionCards = cards.filter(c => c.options?.length); if (optionCards.length > 0) { const avgOpts = Math.round(optionCards.reduce((s, c) => s + c.options.length, 0) / optionCards.length); styleConstraints += `- 选择题选项数：${avgOpts}个\n`; } } if (tpl?.analysis?.formatStyle) { const fs = tpl.analysis.formatStyle; if (fs.scorePosition && genType !== 'practice') { styleConstraints += `- 分值标注位置：${fs.scorePosition}\n`; } if (fs.spacingBetweenQuestions !== undefined) { styleConstraints += `- 题间距：${fs.spacingBetweenQuestions ? '有空行' : '紧凑'}\n`; } } styleConstraints += `- 禁止使用以下设问："下列说法正确的是""以下哪个选项是正确的"\n`; styleConstraints += `- 禁止选项中出现"以上都是""以上都不对"\n`; return styleConstraints; })() + '\n'; })()}

【用户指令摘要】
${instruction}

【命题约束】
${(() => { const kpCount = knowledgeMap.knowledgePoints?.length || 10; const minQ = Math.min(kpCount, 30); return `0. 🔧 题量硬性约束：必须生成至少${minQ}道题（知识点清单共${kpCount}个）。每个知识点至少考查1次，不可遗漏任何知识点。如需控制题量，可将1-2个关联度高的边缘知识点合并为综合题，但不得跳过任何知识点。\n`; })()}1. 每个知识点至少考查1次，重点知识可从不同角度考查2次
2. 🔴 知识点考查去重（正式考试标准）：一般知识点全卷仅考查1次；重难点知识点最多考查2次且必须角度不同（如概念理解+应用），禁止同一知识点无意义重复考查
3. 难度分布按学段动态（从指令中已注入的学段适配要求为准）：
${(() => { const book = selectedBooks?.[0]; if (!book) return '  基础约50%，中档约30%，提高约20%'; const stageMap2 = { '小学': 'primary', '初中': 'middle', '高中': 'high' }; const s = stageMap2[book.stage] || book.stage; const g = extractGradeNum(book.grade || ''); const ratio = getStageDifficultyRatio(s, g > 0 && g <= 2, g >= 3 && g <= 4, g >= 5); return ratio ? `  基础约${ratio.basic}%，中档约${ratio.medium}%，提高约${ratio.advanced}%` : '  基础约50%，中档约30%，提高约20%'; })()}
4. ⚠️ 题型多样性（强制执行）：同一份资料中至少使用3种不同题型，严禁全部或绝大多数使用选择题——尤其英语/语文科目，必须搭配填空、判断、简答、连线、仿写、补全对话等多样性题型
5. 题目排序：从易到难，同题型集中排列
6. 知识点覆盖率目标：100%（每个知识点至少1题）
7. 🔧 新增：允许2-3道综合题（题量超过15题时），可考查2-3个关联知识点
8. 🔧 新增：综合题的 knowledgePoint 填写 "综合：知识点A、知识点B"
9. 🔧 新增：综合题应放在${(() => { const labelMap = { exam: '试卷', practice: '练习', special: '训练', preview: '预习材料', reading: '阅读训练', summary: '知识总结', dictation: '听写训练', errorbook: '错题本', review: '复习资料' }; return labelMap[genType] || '资料'; })()}后半部分，cognitiveLevel 至少为"应用"
${genType === 'exam' ? '10. 🔧 新增：综合题分值应高于单一知识点题（按【真题卷结构蓝本】大题分值拆分，低段小题1-2分）\n' : ''}${genType === 'exam' ? '11. 🔧 分值校验：所有题目的 score 之和必须严格等于指令中标注的「总分」，不得超出或不足。请逐题分配分值后自验：sum(score) === 总分\n' : ''}${genType === 'exam' ? '13. 🔴 相似题禁令：同一大题组内不得出现题材/情境/数据/设问角度相似的两道题\n' : ''}
${(() => { const qualityMap = { exam: '12. 【考试卷质量要求】试题需有合理区分度，基础题确保大多数学生能做对，提高题能区分优秀学生；答案必须无争议。', practice: '12. 【课时练质量要求】题目必须与教材内容高度一致，不超纲不偏题；基础巩固→能力提升→拓展探究三层递进，单题解答时间约2-5分钟。', special: '12. 【专项训练质量要求】题目围绕专项知识点展开，覆盖各种考查角度；从最简单到最难形成清晰训练梯度，典型方法覆盖完整。', preview: '12. 【课前预习质量要求】预习任务可操作、可检查；预习检测紧扣教材原文，难度不宜过高，侧重基础感知。', reading: '12. 【阅读训练质量要求】选文贴近学段水平；题目涵盖信息提取、词句理解、主旨概括、推理判断、评价鉴赏五个层级。', summary: '12. 【知识总结质量要求】知识结构完整无遗漏；易错点辨析准确到位；典型例题有完整解析过程。', dictation: '12. 【听写/默写质量要求】练习区只留提示不留答案；按教材顺序排列；书写空间充足。', errorbook: '12. 【错题本质量要求】错题归因准确；正确解法步骤完整；变式巩固题与错题知识点一一对应。', review: '12. 【复习资料质量要求】知识框架层次分明，考点梳理完整不漏；典型题析覆盖全部考查角度；易错辨析精确到位；综合自测难度梯度合理，能真实检验复习效果。' }; return (qualityMap[genType] || qualityMap.exam) + '\n'; })()}

${(() => { const hasTpl = selectedTemplates && selectedTemplates.length > 0; if (!hasTpl) return ''; return '【模板反例约束——模板中不会出现的模式，禁止使用】\n' + (() => { const tpl = selectedTemplates?.[0]; let antiExamples = ''; if (tpl?.analysis?.questionCards?.length) { const cards = tpl.analysis.questionCards; const stems = cards.filter(c => c.stem).map(c => c.stem || ''); const hasGenericQuestion = stems.some(s => s.includes('下列说法正确的是') || s.includes('以下哪个选项是正确的')); if (!hasGenericQuestion) { antiExamples += '- ⛔ 模板从未使用"下列说法正确的是"这类无信息量设问，生成时严禁使用\n'; } const hasAllAbove = cards.some(c => c.options?.some(o => o.trim() === '以上都是' || o.trim() === '以上都不对')); if (!hasAllAbove) { antiExamples += '- ⛔ 模板选项从未出现"以上都是""以上都不对"，生成时严禁使用\n'; } const stemLengths = stems.map(s => s.length).filter(l => l > 5); if (stemLengths.length > 0) { const minLen = Math.min(...stemLengths); const maxLen = Math.max(...stemLengths); antiExamples += `- 参考题干长度范围：${minLen}~${maxLen}字（可根据知识点需要适当调整）\n`; } } return antiExamples; })() + '\n'; })()}

【防幻觉约束——请遵守以下规则，确保内容准确可靠】
1. 知识点请从上方【知识点清单】中选取，确保与教材一致
2. 🔧 补充规则：请对照上方【知识点清单】，检查是否遗漏了教材中明确要求掌握的必考内容。Step 1 已全面提取（含词汇表、生字表、课后练习等），如【知识点清单】不完整，可基于你的教材知识补充
3. 🔧 以下内容如果在【知识点清单】中缺失，必须补充到蓝图中：
   - 词汇表/Words（英语）
   - 需掌握的生字/词语（语文）
   - 课后练习明确考查的内容
   - 教材中加粗/标红/框出的重点内容
   - 用户锁定的必考知识点
4. 🔧 补充的知识点 knowledgePoint 字段使用原文中的准确名称
5. ⛔ 如果【知识点清单】中只有"同分母分数加减法"，不得生成"异分母分数加减法"或"分数乘除法"的题目
6. ⛔ 知识点的学段范围必须符合教材设定，不得超纲
7. 🔧 知识点覆盖率目标：【知识点清单】中的知识点≥90%需覆盖，补充的必考内容必须100%覆盖
8. 🔧 综合题的 knowledgePoint 必须以"综合："开头，后面列出的知识点可来自【知识点清单】或上述补充的必考内容

【输出格式】必须返回严格的 JSON 数组，每个元素代表一道题：

[
  {
    "number": 1,
    "type": "选择题",
    "knowledgePoint": "分数加减法（同分母）",
    "cognitiveLevel": "理解",
    "difficulty": "基础",${genType === 'exam' ? '\n    "score": 3,\n    "section": "填空",' : ''}
    "sourceChapter": "第3章第1节",
    "contextScene": "场景名称（如使用统一情境则必填）"
  },
  {
    "number": 2,
    "type": "填空题",
    "knowledgePoint": "分数加减法（异分母）",
    "cognitiveLevel": "应用",
    "difficulty": "中档",${genType === 'exam' ? '\n    "score": 4,\n    "section": "解答题",' : ''}
    "sourceChapter": "第3章第2节"
  }
]

【强制规则】
- "type" 从以下选：选择题、填空题、判断题、计算题、解答题、应用题、简答题、作图题、实验题、连线题、排序题、听力题、写话题、默写题、完形填空题
- "cognitiveLevel" 从以下选：识记、理解、应用、分析、评价、创造
- "difficulty" 从以下选：基础、中档、提高
- "knowledgePoint" 必须写具体的概念名称，不得写"综合考查"${genType === 'exam' ? '\n- "section" 为题目所属板块，取值严格使用【真题卷结构蓝本】中的大题名（如语文"看拼音，写词语""阅读理解"、数学"填空""解答题"），同一大题的题目 section 必须相同' : ''}
- "sourceChapter" 写对应章节名称${genType === 'exam' ? '\n- "score" 为本题分值，所有题目 score 之和必须严格等于总分' : `\n- 不需要 "score" 字段（${genTypeLabel}不需要标注每题分值）`}
- 只返回 JSON 数组，不要用 Markdown 代码块包裹，不要任何解释文字
- JSON 必须合法可解析，键名用双引号`;
      
      blueprint = '';
      try {
        blueprint = await callAI(prompt3, { 
          taskType: 'blueprint',        // ✅ 蓝图生成用重型模型
          timeout: 180000,               // 蓝图生成给3分钟超时
          forceJson: true                // ✅ 强制 JSON 输出
        });
      } catch (e) {
        // 🔧 不再吞错误：HTTP 400/401/402/500 等硬错误直接上抛，让外层 generate() 重试/弹窗
        console.error('第三步蓝图生成失败', e.message);
        throw e;
      }
      
      // 从指令中提取总分（课时练无总分，不硬编码兜底值）
      let totalScore = 0;
      const scoreMatch = instruction.match(/总分[：:]\s*(\d+)/);
      if (scoreMatch) totalScore = parseInt(scoreMatch[1]);

      // ✨ 蓝图模式：只生成蓝图，不执行第四步和第五步
      if (blueprintOnly) {
        // 尝试解析蓝图
        parsedBlueprint = [];
        try {
          const parsePrompt = `请将以下命题蓝图解析为JSON数组，每个元素代表一道题：

      ${blueprint}

      返回格式：
      [
        {
          "number": 1,
          "type": "选择题|填空题|解答题|...",
          "knowledgePoint": "考查的知识点",
          "difficulty": "基础|中档|提高",
          "score": 分值数字,
          "sourceChapter": "对应的课文/章节"
        }
      ]

      只返回JSON数组，不要其他内容。`;

          const parseResult = await callAI(parsePrompt);
          const jsonMatch = parseResult.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            parsedBlueprint = JSON.parse(jsonMatch[0]);
            // 🔧 试卷蓝图总分一致性：按比例自动修正使明细合计 === 指令总分
            if (genType === 'exam' && totalScore > 0 && parsedBlueprint.length > 0) {
              const bpSum = parsedBlueprint.reduce((s, q) => s + (q.score || 0), 0);
              if (Math.abs(bpSum - totalScore) > 2) {
                console.warn(`[蓝图校验] 明细合计${bpSum}分 ≠ 指令总分${totalScore}分，按比例自动修正`);
                const ratio = totalScore / (bpSum || 1);
                parsedBlueprint.forEach(q => { q.score = Math.round((q.score || 0) * ratio); });
                const adjustedSum = parsedBlueprint.reduce((s, q) => s + (q.score || 0), 0);
                const diff = totalScore - adjustedSum;
                if (diff !== 0 && parsedBlueprint.length > 0) {
                  parsedBlueprint[parsedBlueprint.length - 1].score = (parsedBlueprint[parsedBlueprint.length - 1].score || 0) + diff;
                }
              }
            }
          }
        } catch (e) {
          console.warn('蓝图模式解析失败:', e.message);
        }

        progress.value = 80;
        statusText.value = '蓝图已生成';
        
        // 立即释放 isGenerating，让用户可以操作弹窗
        isGenerating.value = false;
        
        return {
          success: true,
          blueprint,
          parsedBlueprint,
          contentCards,
          knowledgeMap,
          content: '',
          generatedQuestions: [],
          issues: null,
          qualityReport: null
        };
      }

      // ========== 第四步：解析蓝图并逐题生成 ==========
      statusText.value = '步骤 4/5：解析命题蓝图...';
      progress.value = 60;

      // ✨ 4.1：直接解析蓝图 JSON（prompt3 已要求返回 JSON）
      parsedBlueprint = [];
      try {
        parsedBlueprint = await robustJsonParse(
          blueprint,
          async (retryPrompt) => {
            // 如果首次解析失败，让 AI 修复格式
            const fixed = await callAI(
              `以下内容不是合法的 JSON 数组，请修复使其成为合法 JSON 后重新输出，只返回 JSON 数组：\n${blueprint.substring(0, 1000)}`,
              { taskType: 'generation', temperature: 0.1, forceJson: true }  // ✅ 强制 JSON 输出
            );
            return fixed;
          },
          '蓝图解析'
        );
        console.log('✅ 蓝图解析成功，共', parsedBlueprint.length, '题');
        // 🔧 试卷蓝图总分一致性：按比例自动修正使明细合计 === 指令总分
        if (genType === 'exam' && totalScore > 0 && parsedBlueprint.length > 0) {
          const bpSum = parsedBlueprint.reduce((s, q) => s + (q.score || 0), 0);
          if (Math.abs(bpSum - totalScore) > 2) {
            console.warn(`[蓝图校验] 明细合计${bpSum}分 ≠ 指令总分${totalScore}分，按比例自动修正`);
            const ratio = totalScore / (bpSum || 1);
            parsedBlueprint.forEach(q => { q.score = Math.round((q.score || 0) * ratio); });
            const adjustedSum = parsedBlueprint.reduce((s, q) => s + (q.score || 0), 0);
            const diff = totalScore - adjustedSum;
            if (diff !== 0 && parsedBlueprint.length > 0) {
              parsedBlueprint[parsedBlueprint.length - 1].score = (parsedBlueprint[parsedBlueprint.length - 1].score || 0) + diff;
            }
            console.log(`[蓝图校验] 修正后明细合计${parsedBlueprint.reduce((s, q) => s + (q.score || 0), 0)}分 === 指令总分${totalScore}分`);
          }
        }
      } catch (e) {
        console.warn('蓝图解析失败，将使用传统方式生成:', e.message);
      }

      // ✨ 4.2：如果蓝图解析成功，逐题生成
      content = '';
      generatedQuestions = [];

      if (parsedBlueprint.length > 0) {
        const totalQuestions = parsedBlueprint.length;

        // ✨ 生成情境锚点（统一情境风格的基石）
        let situationAnchor = '';
        const styleMatch = instruction.match(/命题风格[：:]\s*([^\n]+)/);
        const styleText = styleMatch ? styleMatch[1] : '';
        if (styleText.includes('统一情境') || styleText.includes('情境融合') || styleText.includes('unified_context') || styleText.includes('context_fusion')) {
          try {
            const anchorPrompt = `请为以下试卷设计一个贯穿全卷的统一情境/主题故事。
学科：${selectedBooks?.[0]?.subject || ''}
年级：${selectedBooks?.[0]?.grade || ''}
总题数：${totalQuestions}
知识点：${parsedBlueprint.map(q => q.knowledgePoint).slice(0, 5).join('、')}

要求：
1. 取一个情境名称（15字以内）
2. 描述情境背景（50字以内）
3. 列出3-5个可用于不同题目的场景元素

返回JSON：{"name":"情境名称","background":"情境背景","scenes":["场景1","场景2"]}`;

            const anchorResult = await callAI(anchorPrompt, { temperature: 0.5 });
            try {
              const anchor = await robustJsonParse(anchorResult, null, '情境锚点');
              situationAnchor = `【统一情境：${anchor.name}】背景：${anchor.background}。可用场景：${(anchor.scenes || []).join('、')}。请在此情境下命制本题，保持与前后题目的叙事连贯性。`;
            } catch {
              // 情境生成失败不阻塞
            }
          } catch (e) {
            console.warn('情境锚点生成失败:', e.message);
          }
        }      
  
        // ✨ 收集已生成题目摘要，作为上下文传给后续题目
        let generatedContext = [];

        for (let i = 0; i < totalQuestions; i++) {
          const questionPlan = parsedBlueprint[i];
    
          const genConfig = await getCurrentEngineConfigEnhanced('generation');
          const genModelName = getModelDisplayName(genConfig.textModel || genConfig.model);
          statusText.value = `步骤 4/5：生成第${i+1}/${totalQuestions}题 [${genModelName}]...`;
          progress.value = 60 + Math.round((i / totalQuestions) * 25);

          // ✨ 构建已生成题目的上下文摘要
          let contextSummary = generatedContext.length > 0
            ? `【已生成题目摘要，请避免知识点重复】\n${generatedContext.join('\n')}\n`
            : '';

          // 🔧 新增：统计已生成题目的句式特征，确保全局风格一致
          let styleConsistencyHint = '';
          if (generatedContext.length > 2) {
            const recentQuestions = generatedQuestions.slice(-3);
            const sentenceStarts = [];
            const optionCounts = [];
            
            for (const q of recentQuestions) {
              const plainText = q.replace(/<[^>]+>/g, '').trim();
              const startMatch = plainText.match(/^\d+[\.、．]\s*(.{1,20})/);
              if (startMatch) {
                sentenceStarts.push(startMatch[1]);
              }
              const optionCount = (q.match(/<p class="option"/g) || []).length;
              if (optionCount > 0) {
                optionCounts.push(optionCount);
              }
            }
            
            if (sentenceStarts.length >= 4) {
              // 🔧 序列约束管控：累积4题后才做句式雷同检测（原2题过早触发）
              const allSame = sentenceStarts.every(s => 
                sentenceStarts[0].substring(0, 2) === s.substring(0, 2)
              );
              if (allSame) {
                styleConsistencyHint = `⚠️ 【句式雷同警告——你必须打破此模式】前几题的句式开头高度雷同（均以"${sentenceStarts[0].substring(0, 12)}"开头）。本题必须使用与前几题完全不同的设问方式和句式结构！禁止再用相同句式开头！`;
              }
            }
            
            if (optionCounts.length >= 4) {
              // 🔧 序列约束管控：累积4题后才做选项结构雷同检测（原2题过松）
              const avgOptions = Math.round(optionCounts.reduce((a, b) => a + b, 0) / optionCounts.length);
              if (optionCounts.every(c => c === optionCounts[0])) {
                styleConsistencyHint += `\n⚠️ 【选项结构雷同警告】前几题选择题全部是${optionCounts[0]}个选项，本题必须打破此模式——改变选项数量或改用非选择题型！`;
              }
            }
          }
    
          // ========== 🔧 优化：动态上下文窗口管理 ==========
          // 定义上下文预算（根据模型能力调整，qwen2.5:14b 建议预留 4000 tokens 给核心指令和输出）
          const MAX_CONTEXT_TOKENS = 5000;
          
          // 为各模块分配预算
          const MATERIAL_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.45);   // 教材原文最多45%
          const TEMPLATE_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.30);   // 模板样本最多30%
          const SUMMARY_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.15);    // 已生成摘要最多15%
          // 剩余10%留给其他固定内容

          // ========== 1. 教材原文：分级提供（优先保证核心段完整）==========
          let materialContext = '';
          
          if (questionPlan.knowledgePoint) {
            const relatedSegments = semanticRetriever.findRelevant(
              questionPlan.knowledgePoint,
              8  // 先多取几段，给分级函数更多选择
            );
            
            if (relatedSegments.length > 0) {
              // 🔧 使用分级构建函数，优先保证核心段完整性
              const gradedMaterial = buildGradedMaterialContext(relatedSegments, MATERIAL_BUDGET);
              materialContext = gradedMaterial.fullContext;
              
              if (materialContext) {
                const coreCount = (gradedMaterial.coreText.match(/\n\[/g) || []).length;
                const extCount = (gradedMaterial.extendedText.match(/\n\[/g) || []).length;
                console.log(`📚 题${questionPlan.number} 教材上下文：核心${coreCount}段 + 扩展${extCount}段`);
              } else {
                materialContext = ''; // 没有有效内容，清空
              }
            }
          }
          
          // 降级：如果语义检索没有结果，使用章节原文（交由 buildGradedMaterialContext 控制长度）
          if (!materialContext && questionPlan.sourceChapter) {
            const relatedCard = contentCards.find(c => c.chapterTitle === questionPlan.sourceChapter);
            if (relatedCard && (relatedCard._fullChapterText || relatedCard.rawText || relatedCard.summary)) {
              const sourceText = relatedCard._fullChapterText || relatedCard.rawText || relatedCard.summary;
              // 对降级原文也做分段，让 buildGradedMaterialContext 按 token 预算动态截取
              const fallbackSegments = splitTextIntoSegments(sourceText, 500).map(seg => ({
                chapterTitle: relatedCard.chapterTitle,
                text: seg,
                type: '正文',
                isKeyConcept: false,
                isExample: false,
                isExercise: false
              }));
              const gradedFallback = buildGradedMaterialContext(fallbackSegments, MATERIAL_BUDGET);
              materialContext = gradedFallback.fullContext || `【教材参考】\n${sourceText.substring(0, Math.floor(MATERIAL_BUDGET * 1.5))}\n`;
            }
          }

          // ========== 2. 模板样本：按预算截取 ==========
          let templateContext = '';
          let templateTokens = 0;
          const templateCards = selectedTemplates?.[0]?.analysis?.questionCards || [];
          
          if (templateCards.length > 0) {
            const MAX_SAMPLES = 2;
            const templateSamples = findBestTemplateSamples(templateCards, questionPlan, MAX_SAMPLES);
            
            if (templateSamples.length > 0) {
              templateContext = `\n【模板参考题——以下为模板典型题目，供参考风格和结构】\n`;
              let sampleCount = 0;
              
              for (let si = 0; si < templateSamples.length; si++) {
                const card = templateSamples[si];
                
                let cardText = `\n=== 模板真题${si + 1}（${card.type}，${card.difficulty || '?'}难度，${card.score || '?'}分）===\n`;
                
                // 🔧 修复：优先使用完整题干，不截断
                // 原因：截断后AI无法看到完整的设问方式，影响风格对标
                let stem = card.stem || '';
                
                // 如果题干过长，尝试智能截断（在自然断点处）
                const maxStemChars = Math.floor((TEMPLATE_BUDGET / MAX_SAMPLES) * 0.8);
                if (stem.length > maxStemChars) {
                  // 尝试在句号、问号、感叹号处截断
                  const naturalBreaks = ['。', '？', '！', '?', '!'];
                  let breakIndex = -1;
                  
                  for (const mark of naturalBreaks) {
                    const idx = stem.lastIndexOf(mark, maxStemChars);
                    if (idx > maxStemChars * 0.6) {  // 至少在60%位置之后
                      breakIndex = idx + 1;
                      break;
                    }
                  }
                  
                  if (breakIndex > 0) {
                    stem = stem.substring(0, breakIndex) + '...';
                  } else {
                    // 没有自然断点，直接截断但添加明确标记
                    stem = stem.substring(0, maxStemChars) + '...（题干过长已截断）';
                  }
                }
                cardText += `题干：${stem}\n`;
                
                // 选项（只保留前4个）
                if (card.options?.length) {
                  const options = card.options.slice(0, 4);
                  cardText += `选项：${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}\n`;
                }
                
                // 关键特征
                if (card.questionFeature) {
                  cardText += `设问特征：${card.questionFeature.substring(0, 30)}\n`;
                }
                
                const cardTokens = estimateTokens(cardText);
                if (templateTokens + cardTokens > TEMPLATE_BUDGET) {
                  if (sampleCount === 0) {
                    templateContext += cardText;
                    sampleCount++;
                  }
                  break;
                }
                
                templateContext += cardText;
                templateTokens += cardTokens;
                sampleCount++;
              }
              
              if (sampleCount > 0) {
                templateContext += `\n【注意】以上真题仅作学段题型参考。本题请根据实际知识点和${genType === 'exam' ? '考试要求' : genType === 'practice' ? '练习目标' : '训练目标'}独立设计题干长度、句式结构和选项数量，无需机械模仿模板样本。`;
              } else {
                templateContext = '';
              }
            }
          }

          // ========== 3. 已生成题目摘要：附带显式排重指令，防止逐题雷同 ==========
          contextSummary = '';
          if (generatedContext.length > 0) {
            const recentContext = generatedContext.slice(-3);
            contextSummary = `【已生成题目——下面的题目已生成完毕，你本题必须与之有明显差异】
${recentContext.join('\n')}

⚠️ 排重要求——请确认本题与上面已生成题目的差异：
1. 不使用上面已出现过的场景（如上面用了"分蛋糕"，你换"跳绳比赛"或"图书馆"等全新场景）
2. 不使用上面已出现过的设问句式（如上面用了"XX有多少个"，你换"比较XX和YY的差异"或"如果ZZ发生变化，XX会怎样"）
3. 不使用上面已出现过的数据组合（换一组全新数字，不雷同）
`;
            
            const summaryTokens = estimateTokens(contextSummary);
            if (summaryTokens > SUMMARY_BUDGET) {
              const shorter = generatedContext.slice(-2);
              contextSummary = `【已生成题目】${shorter.join('；')}\n⚠️ 请确保本题情境、设问方式与上面不同。`;
              if (estimateTokens(contextSummary) > SUMMARY_BUDGET) {
                contextSummary = `【上一题】${generatedContext[generatedContext.length - 1]}\n⚠️ 请确保本题情境、设问方式与上一题不同。`;
              }
            }
          }

          // ========== 4. 日志：输出各模块使用量（方便调试） ==========
          const coreCount = materialContext ? (materialContext.match(/核心教材原文/g) || []).length : 0;
          const extCount = materialContext ? (materialContext.match(/补充参考/g) || []).length : 0;
          console.log(`📊 题${questionPlan.number} 上下文使用:
  教材原文: 核心段 + 扩展段 (预算${MATERIAL_BUDGET} tokens)
  模板样本: ${templateContext ? '已注入' : '无'} (预算${TEMPLATE_BUDGET} tokens)
  已生成摘要: ${estimateTokens(contextSummary)} tokens (预算${SUMMARY_BUDGET})`);

          // 🔧 按题型从指令库查询质量约束（替代硬编码 typeSpecificRules）
          const TYPE_TO_GENTYPE = { '选择题': 'choice', '填空题': 'fill', '判断题': 'truefalse', '计算题': 'calc', '解答题': 'answer', '应用题': 'word_problem', '实验题': 'experiment' };
          const typeGenType = TYPE_TO_GENTYPE[questionPlan.type];
          const typeBlocks = typeGenType ? getMatchingBlockInstructions({ category: '生成-题型专项要求', genType: typeGenType }) : [];
          const typeRule = typeBlocks.length > 0 ? typeBlocks[0].content : '';

          // 🔧 新增：综合题额外上下文
          let integratedContext = '';
          if (questionPlan.knowledgePoint && questionPlan.knowledgePoint.startsWith('综合：')) {
            const kps = questionPlan.knowledgePoint.replace('综合：', '').split(/[、，,]/).map(k => k.trim());
            integratedContext = `\n⚠️ 这是一道综合题，需要融合以下知识点：${kps.join('、')}\n`;
            integratedContext += `请创设一个真实情境，将上述知识点自然融合在一个问题中。\n`;
            integratedContext += `各知识点的考查权重应大致均衡。\n`;
            if (questionPlan.cognitiveLevel === '分析' || questionPlan.cognitiveLevel === '评价') {
              integratedContext += `需要体现高阶思维（分析/评价），不止于简单应用。\n`;
            }
          }

          // ========== 3.5：场景多样性种子（轮转注入，防止逐题雷同）==========
          const diversitySeeds = [
            '🎲 【场景引导：生活化】请创设贴近学生日常的场景（如购物、分食物、运动计分等），让题目有真实感和代入感。',
            '🎲 【场景引导：校园课堂】请创设校园/课堂场景（如小组比赛、实验操作、课堂问答等），与学校生活关联。',
            '🎲 【场景引导：故事游戏】请将题目包装成简短的小故事、闯关游戏或趣味挑战，增强可读性。',
            '🎲 【场景引导：图表数据】请用表格、统计图、示意图等可视化方式呈现关键信息，考查数据解读能力。',
            '🎲 【场景引导：探究思辨】请用"为什么...""如果...会怎样""你能发现什么规律"等开放式设问，考查深层理解。',
            '🎲 【场景引导：对比辨析】请设计需要对比两个易混淆概念/方法的题目，考查辨析能力而非死记硬背。',
            '🎲 【原创设计】创设全新的、有辨识度的题目情境与设问方式，让这道题独一无二、不撞脸任何已有题目。',
            '🎲 【场景出新】选用新鲜有趣的真实场景（校园活动、生活实践、时事热点等），赋予角色有特色的名字，让题目有真实感和新鲜感。',
'🎲 【独立原创】确保题目是全新的独立创作——情境、数据、设问角度均为原创设计，不参考任何已有题目。',
'🎲 【自然表达】用自然的语言风格写题，像一位经验丰富的教师出题，语言精准、表述清晰，避免模板化套话。',
          ];
          const diversitySeed = diversitySeeds[i % diversitySeeds.length];

          const questionPrompt = buildPerQuestionPrompt(questionPlan, genType, {
            situationAnchor,
            contextSummary,
            styleConsistencyHint,
            materialContext,
            templateContext,
            typeRule,
            integratedContext,
            selectedTemplates,
            instruction,
            selectedBooks,
            stage,
            diversitySeed,
          });

          try {
            // 🔧 优化：第一题前检查模型状态，后续题之间等待2秒
            if (i === 0) {
              console.log('🔥 题目生成：检查模型状态...');
              try {
                const result = await checkModelReady(null, 3, 'text');
                
                if (!result.ready) {
                  console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${result.responseTime}ms)`);
                  const additionalWait = Math.max(2000, Math.min(4000, result.responseTime / 10));
                  await new Promise(r => setTimeout(r, additionalWait));
                } else {
                  console.log(`✅ 文本生成模型已就绪，立即开始（响应时间: ${result.responseTime}ms, 尝试${result.attempts}次）`);
                }
              } catch (e) {
                console.warn('⚠️ 模型检测失败，等待3秒后继续...', e.message);
                await new Promise(r => setTimeout(r, 3000));
              }
            } else {
              // 题之间等待2秒，让模型恢复
              console.log(`⏰ 第${i+1}题之前等待2秒...`);
              await new Promise(r => setTimeout(r, 2000));
            }
            
            const questionContent = await callAI(questionPrompt, { 
              taskType: 'generation',    // ✅ 题目生成用重型模型
              timeout: 120000,           // 单题给2分钟
              allowContinuation: true    // 🔧 允许题目生成时自动续写
            });

            generatedQuestions.push(questionContent);
            
            // ✨ 新增：逐题自检验证
            let validationNote = '';
            
            // 🔧 增强：硬性规则验证（先于AI验证，成本低、速度快）
            try {
              const book = selectedBooks?.[0];
              const rawSubject = book?.subject || '';
              const stage = book?.stage || '';
              const subject = normalizeSubjectName(rawSubject, stage);
              
              // 🔧 使用学科专用验证器
              const hardResults = runHardValidators(questionContent, subject);
              
              if (hardResults.length > 0) {
                const errors = [];
                const warnings = [];
                
                for (const result of hardResults) {
                  if (result.passed === false) {
                    const prefix = result.severity === 'error' ? '❌' : '⚠️';
                    const note = `${prefix} [${result.name}] ${result.message}`;
                    
                    if (result.severity === 'error') {
                      errors.push(note);
                    } else {
                      warnings.push(note);
                    }
                    
                    validationNote += `<!-- ${note} -->\n`;
                    console.warn(`题${questionPlan.number}${note}`);
                  }
                }
                
                // 自动修复可修复的问题
                const fixedContent = applyAutoFixes(questionContent, hardResults);
                if (fixedContent !== questionContent) {
                  const idx = generatedQuestions.indexOf(questionContent);
                  if (idx >= 0) {
                    generatedQuestions[idx] = fixedContent;
                    console.log(`🔧 题${questionPlan.number} 自动修复完成`);
                  }
                }
                
                // 🔧 新增：如果存在严重错误（error级别），标记需要重试
                if (errors.length > 0) {
                  console.warn(`⚠️ 题${questionPlan.number} 存在 ${errors.length} 个严重错误，建议人工审查`);
                  // 将错误信息写入 validationNote 供后续审查参考
                  validationNote += `<!-- ⚠️⚠️⚠️ 本题存在严重规则违反，请人工审查 ⚠️⚠️⚠️ -->\n`;
                  validationNote += `<!-- 错误列表：\n${errors.join('\n')}\n-->\n`;
                  
                  // 🔧 新增：对于严重错误，尝试重新生成
                  if (errors.length >= 2 && i < totalQuestions) {
                    console.log(`🔄 题${questionPlan.number} 存在多个严重错误，将在自动修复循环中处理`);
                  }
                }
                
                // 🔧 新增：记录警告数量
                if (warnings.length > 0) {
                  console.log(`📝 题${questionPlan.number} 存在 ${warnings.length} 个警告`);
                }
              }
            } catch (e) {
              console.warn('硬性规则验证失败:', e.message);
            }
            try {
              const validatePrompt = `请审查这道题目，检查知识点匹配度和科学性：

【题目内容】
${questionContent.replace(/<[^>]+>/g, '').substring(0, 500)}

【命题要求】
知识点：${questionPlan.knowledgePoint}
难度：${questionPlan.difficulty}
题型：${questionPlan.type}

请逐一检查并只返回JSON：
{
  "knowledgeMatch": true,
  "knowledgeMatchReason": "题目确实考查了该知识点",
  "hasScienceError": false,
  "scienceErrorDetail": "",
  "answerCorrect": true,
  "suggestion": ""
}`;

              const validateResult = await callAI(validatePrompt, { 
                taskType: 'questionValidation',  // 🔧 使用独立验证策略
                temperature: 0,                  // 🔧 降到0，确保客观
                timeout: 30000 
              });
              try {
                const validation = await robustJsonParse(validateResult, null, '题目验证');
                if (!validation.knowledgeMatch) {
                  validationNote = `<!-- ⚠️ 知识点匹配问题：${validation.knowledgeMatchReason || '未知'} -->`;
                  console.warn(`题${questionPlan.number}知识点匹配问题:`, validation.knowledgeMatchReason);
                }
                if (validation.hasScienceError) {
                  validationNote += `<!-- ❌ 科学性错误：${validation.scienceErrorDetail || '未知'} -->`;
                  console.error(`题${questionPlan.number}科学性错误:`, validation.scienceErrorDetail);
                }
                if (!validation.answerCorrect) {
                  validationNote += `<!-- ⚠️ 答案可能有误 -->`;
                  console.warn(`题${questionPlan.number}答案可能有误`);
                }
                
                // 🔧 修复：交叉验证——用与生成引擎不同的引擎验算，避免自我确认偏差
                const mathTypes = ['计算题', '解答题', '应用题', '选择题', '填空题'];
                if (mathTypes.includes(questionPlan.type) && questionContent.length > 20) {
                  try {
                    // 提取题目中的原始答案（多种格式兼容）
                    const answerPatterns = [
                      /答案[：:]\s*(.+?)(?:<|$|\n)/,
                      /【答案】\s*(.+?)(?:<|$|\n)/,
                      /参考答案[：:]\s*(.+?)(?:<|$|\n)/,
                      /正确[答案选项][：:]\s*(.+?)(?:<|$|\n)/
                    ];
                    let originalAnswer = '';
                    for (const pattern of answerPatterns) {
                      const match = questionContent.match(pattern);
                      if (match) {
                        originalAnswer = match[1].trim();
                        break;
                      }
                    }

                    // 提取纯文本题干用于验算
                    const plainText = questionContent
                      .replace(/<[^>]+>/g, '')
                      .replace(/【答案】[\s\S]*$/, '')  // 去掉答案部分
                      .trim();

                    const mathVerifyPrompt = `请计算这道题，先写出关键步骤，然后给出最终答案。

【题目】
${plainText.substring(0, 600)}

【输出格式】
步骤：
1. ...
2. ...
最终答案：[答案]

如果题目本身有逻辑错误或条件不足导致无法计算，请说明具体问题。`;

                    // 🔧 核心改动：根据当前引擎选择不同的验算引擎
                    const currentConfig = await getCurrentEngineConfig('review');
                    let verifyEngine = 'same';  // 默认同引擎
                    let verifyApiKey = '';
                    
                    // 如果当前是 Ollama 且配置了 DeepSeek，用 DeepSeek 验算
                    if (currentConfig.engine === 'ollama' && apiConfig.deepseekApiKey) {
                      verifyEngine = 'deepseek';
                      verifyApiKey = apiConfig.deepseekApiKey;
                    }
                    // 如果当前是 DeepSeek 且 Ollama 可用，用 Ollama 验算
                    else if (currentConfig.engine === 'deepseek') {
                      verifyEngine = 'ollama';
                    }

                    let independentAnswer = '';
                    
                    if (verifyEngine === 'deepseek') {
                      // 用 DeepSeek 验算（短请求，不流式）
                      try {
                        // 🌡️ 熔断器检查
                        if (deepseekBreaker.isOpen) {
                          console.warn('⚠️ DeepSeek 熔断中，验算跳过');
                          throw new Error('DeepSeek 熔断中');
                        }

                        let verifyUrl = apiConfig.deepseekBaseUrl || '';
                        if (verifyUrl && !verifyUrl.includes('/chat/completions')) {
                          verifyUrl = verifyUrl.endsWith('/v1')
                            ? `${verifyUrl}/chat/completions`
                            : `${verifyUrl.replace(/\/$/, '')}/v1/chat/completions`;
                        }

                        const verifyResponse = await fetch(verifyUrl, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${verifyApiKey}`
                          },
                          body: JSON.stringify({
                            model: apiConfig.deepseekModel,
                            messages: [{ role: 'user', content: mathVerifyPrompt }],
                            temperature: 0,
                            max_tokens: 1024
                          })
                        });

                        if (verifyResponse.ok) {
                          const verifyData = await verifyResponse.json();
                          independentAnswer = verifyData.choices?.[0]?.message?.content || '';
                          deepseekBreaker.success();
                        } else {
                          if (verifyResponse.status >= 500) deepseekBreaker.fail();
                          throw new Error(`DeepSeek 验算失败: HTTP ${verifyResponse.status}`);
                        }
                      } catch (e) {
                        console.warn('DeepSeek 验算失败，降级使用 Ollama:', e.message);
                        independentAnswer = await callAI(mathVerifyPrompt, {
                          taskType: 'questionValidation',
                          temperature: 0,
                          timeout: 30000,
                          retries: 0
                        });
                      }
                    } else if (verifyEngine === 'ollama') {
                      // 用 Ollama 验算（但用轻量模型以节约资源）
                      independentAnswer = await callAI(mathVerifyPrompt, {
                        taskType: 'questionValidation',  // 🔧 使用独立验证策略
                        temperature: 0,                  // 🔧 降到0，确保客观
                        timeout: 30000,
                        retries: 0
                      });
                    } else {
                      // 同一引擎验算（降级方案），但用 temperature=0 提高确定性
                      independentAnswer = await callAI(mathVerifyPrompt, {
                        taskType: 'questionValidation',
                        temperature: 0,
                        timeout: 30000,
                        retries: 0
                      });
                    }

                    // 从验算结果中提取最终答案
                    const finalAnswerMatch = independentAnswer.match(/最终答案[：:]\s*(.+?)(?:\n|$)/);
                    const verifyAnswer = finalAnswerMatch 
                      ? finalAnswerMatch[1].trim() 
                      : independentAnswer.split('\n').pop().trim();

                    // 🔧 改进：更智能的答案对比
                    if (verifyAnswer && originalAnswer) {
                      const normalize = (s) => {
                        return s
                          .replace(/\s+/g, '')           // 去空格
                          .replace(/[，,]/g, '')          // 去中文/英文逗号
                          .replace(/[。.]/g, '')          // 去句号
                          .replace(/（/g, '(')            // 统一括号
                          .replace(/）/g, ')')
                          .toLowerCase();
                      };

                      const normOriginal = normalize(originalAnswer);
                      const normVerify = normalize(verifyAnswer);

                      if (normOriginal !== normVerify) {
                        // 🔧 改进：不一致时加醒目警告
                        validationNote += `\n<!-- ⚠️⚠️⚠️ 交叉验算不一致（验算引擎：${verifyEngine}）⚠️⚠️⚠️
  原答案：${originalAnswer}
  验算结果：${verifyAnswer}
  验算过程：
  ${independentAnswer.split('\n').map(l => '  ' + l).join('\n')}
  请务必人工核对！ -->`;
                        console.warn(`题${questionPlan.number}交叉验算不一致 [${verifyEngine}]: 原="${originalAnswer}" 验="${verifyAnswer}"`);
                        
                        // 🔧 新增：如果是高置信度题目（如简单计算），标记为需要人工审查
                        if (questionPlan.difficulty === '基础') {
                          console.error(`基础题${questionPlan.number}答案可能错误，强烈建议人工审查`);
                        }
                      } else {
                        console.log(`✅ 题${questionPlan.number}交叉验算一致 [${verifyEngine}]`);
                      }
                    }
                  } catch (e) {
                    console.warn('数学验算失败（非阻塞）:', e.message);
                  }
                }
                
                if (validationNote) {
                  const idx = generatedQuestions.indexOf(questionContent);
                  if (idx >= 0) {
                    generatedQuestions[idx] = validationNote + '\n' + questionContent;
                  }
                }
              } catch {
                // 验证解析失败不阻塞
              }
            } catch {
              // 验证调用失败不阻塞
            }
            
            // ✨ 提取结构化摘要（情境+方式+特征），供后续题目排重用
            try {
              const summary = await callAI(
                `用30字以内描述这道题的情境、设问方式和关键特征。格式：「情境：XX | 方式：XX | 特征：XX」\n${questionContent}`,
                { taskType: 'generation', temperature: 0.1 }
              );
              generatedContext.push(`第${questionPlan.number}题(${questionPlan.type},${questionPlan.knowledgePoint}): ${summary.trim()}`);
            } catch {
              generatedContext.push(`第${questionPlan.number}题(${questionPlan.type},${questionPlan.knowledgePoint})`);
            }
          } catch (e) {
            console.warn(`第${i+1}题生成失败:`, e.message);
            generatedQuestions.push(`<p class="question"><span class="question-number">${questionPlan.number}.</span> 【生成失败，请重试】</p>`);
            generatedContext.push(`第${questionPlan.number}题【生成失败】`);
          }
        }
  
        // ✨ 4.3：去重检查（跨题语义去重）
        if (generatedQuestions.length > 2) {
          statusText.value = '正在检查题目重复...';
          progress.value = 85;
          
          try {
            const dedupPrompt = `你是一位严谨的命题审核专家。请检查以下${generatedQuestions.length}道题是否存在真正意义上的考查点重复。

⚠️ 判定标准（严格）：只有在两道题考查的核心知识点完全相同、解题方法完全一致时，才算重复。
⚠️ 例："两位数加两位数"和"两位数加两位数进位"考查不同难度层次→不算重复
⚠️ 例："阅读理解题A"和"阅读理解题B"即使同属阅读→只要文章不同就不算重复
⚠️ 存疑时请判为不重复（宁可漏判，不可误判）。

${generatedQuestions.map((q, i) => `题${i+1}：${q.replace(/<[^>]+>/g, '').substring(0, 150)}`).join('\n')}

返回JSON：
{
  "hasDuplicates": true,
  "duplicatePairs": [{"q1": 1, "q2": 3, "reason": "两题都考查分数加减法"}],
  "suggestion": "建议合并或替换其中一题"
}
如果没有重复，返回 {"hasDuplicates": false}

只返回JSON。`;

            const dedupResult = await callAI(dedupPrompt, { 
              taskType: 'review', temperature: 0.1 
            });
            try {
              const dedup = await robustJsonParse(dedupResult, null, '去重检查');
              if (dedup.hasDuplicates && dedup.duplicatePairs?.length > 0) {
                console.warn('⚠️ 检测到重复题目:', dedup.duplicatePairs);
                // 在内容前添加警告注释
                const warningNote = `<!-- ⚠️ 去重警告：${dedup.suggestion || '以下题目可能存在重复'} -->\n`;
                generatedQuestions.unshift(warningNote);
              }
            } catch {
              // 去重失败不阻塞
            }
          } catch (e) {
            console.warn('去重检查失败:', e.message);
          }
        }

        // ✨ 4.4：组装完整内容
        statusText.value = '正在组装...';
        progress.value = 88;

        const book = selectedBooks?.[0];
        const subject = book?.subject || '';
        const grade = book?.grade || '';

        // 🔧 根修复：practice/special 用简洁标题，仅 exam 走 AI 生成含分值的头部
        if (genType === 'practice' || genType === 'special') {
          const chapters = book?.selectedChapters || [];
          const chapterNames = chapters.map(c => c.title).filter(Boolean).join('、');
          const unitName = book?.name || '';
          const chapterKey = chapterNames || '_all_';
          const genTypeLabel = pickLabelFromPool(genType, chapterKey);
          const headerHtml = `<h1>${unitName}${chapterNames ? ' · ' + chapterNames : ''}</h1>
<div class="practice-info"><p>${grade} ${subject} ${genTypeLabel}</p></div>`;
          content = headerHtml + '\n\n' + generatedQuestions.join('\n\n');
        } else {
          // 🔧 试卷：生成带分值/考试信息的头部
          const headerPrompt = `请根据以下信息生成试卷头部（标题、考试信息等）：
      学科：${subject}
      年级：${grade}
      总分：${totalScore || 100}分
      题型分布：${parsedBlueprint.map(q => `${q.type}×${parsedBlueprint.filter(p => p.type === q.type).length}题`).filter((v, i, a) => a.indexOf(v) === i).join('，')}
            大题结构（严格按【真题卷结构蓝本】大题序列与分值，禁止改名/增删/重组）:
      ${(() => {
        const secCount = {};
        for (const q of parsedBlueprint) {
          const sec = (q.section || '').trim();
          if (!sec) continue;
          secCount[sec] = (secCount[sec] || 0) + 1;
        }
        const lines = Object.keys(secCount).map(k => k + '（' + secCount[k] + '题）');
        return lines.length > 0 ? lines.join('；') : '按【真题卷结构蓝本】大题序列组织，禁止用"基础/能力/综合"板块包装';
      })()}
      返回HTML格式的试卷头部，用<h1>标题，用<div class="exam-info">包裱考试信息。`;

          try {
            const header = await callAI(headerPrompt, { 
              taskType: 'generation', temperature: 0.3 
            });
            content = header + '\n\n' + generatedQuestions.join('\n\n');
          } catch (e) {
            content = generatedQuestions.join('\n\n');
          }
        }

      } else {
        // ❌ 蓝图解析失败：不降级，直接报错
        throw new Error(
          `内容生成失败：命题蓝图解析失败，无法逐题生成。\n` +
          `可能原因：AI 返回的蓝图格式异常，无法提取有效的题目信息。\n` +
          `建议：点击"重试"重新生成，或减少所选章节数量后重试。`
        );
      }

      // ✨ 4.5：收集逐题答案，生成统一答案与解析区域
      if (genType !== 'exam' && parsedBlueprint.length > 0) {
        // 🔧 非试卷类型（课时练/预习/听写等）：从HTML注释中提取答案，构建统一 answer-section
        const answerEntries = [];
        const answerCommentRegex = /<!--\s*answer\s*:\s*(.+?)\s*(?:\|\s*解析\s*:\s*(.+?))?\s*-->/gi;
        let commentMatch;
        for (let qi = 0; qi < generatedQuestions.length; qi++) {
          const qContent = generatedQuestions[qi];
          // Reset regex state
          answerCommentRegex.lastIndex = 0;
          while ((commentMatch = answerCommentRegex.exec(qContent)) !== null) {
            const answer = (commentMatch[1] || '').trim();
            const explanation = (commentMatch[2] || '').trim();
            answerEntries.push({ number: parsedBlueprint[qi]?.number || (qi + 1), answer, explanation });
          }
        }

        if (answerEntries.length > 0) {
          // 构建答案区域
          let answerSection = '\n<div class="answer-section">\n<h2>答案与解析</h2>\n';
          for (const entry of answerEntries) {
            answerSection += `<p><strong>${entry.number}.</strong> ${entry.answer}`;
            if (entry.explanation) {
              answerSection += ` | <em>解析：${entry.explanation}</em>`;
            }
            answerSection += '</p>\n';
          }
          answerSection += '</div>';
          content += answerSection;
        } else {
          // 提取失败：用 AI 补生成答案区域
          console.warn('⚠️ 未提取到答案注释，尝试 AI 补生成答案区域...');
          try {
            const answerGenPrompt = `请根据以下题目内容，生成统一的答案与解析区域。

${generatedQuestions.map((q, i) => `题${i + 1}：${q.replace(/<[^>]+>/g, '').substring(0, 200)}`).join('\n\n')}

返回格式：
<div class="answer-section">
<h2>答案与解析</h2>
<p><strong>1.</strong> 答案 | <em>解析：解题思路</em></p>
...
</div>

只返回HTML，不要markdown包裹。`;

            const answerSection = await callAI(answerGenPrompt, {
              taskType: 'generation', temperature: 0.1
            });
            content += '\n' + answerSection;
          } catch (e) {
            console.warn('答案区域生成失败:', e.message);
          }
        }
      }
      
      } // ── 传统五步法路径结束 ──
      
      // ========== 第四步：多维度质量校验 ==========
      // 🔧 步骤编号适配：DeepSeek 整卷路径为步骤 4/4，Ollama 逐题路径为步骤 4/5
      const stepQCConfig = await getCurrentEngineConfigEnhanced('review');
      const stepQCModelName = getModelDisplayName(stepQCConfig.textModel || stepQCConfig.model);
      const qcStepLabel = _useFullPaper ? '4/4' : '5/5';
      statusText.value = `步骤 ${qcStepLabel}：质量校验 [${stepQCModelName}]...`;
      progress.value = 85;

      const issues = [];
      
      // ========== 🔧 新增：硬性规则检查（第一级） ==========
      const book = selectedBooks?.[0];
      const stageRaw = book?.stage || '';
      const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
      const hardIssues = HardRuleChecker.check(
        content, 
        parsedBlueprint, 
        book?.subject || '', 
        stageMap[stageRaw] || stageRaw,
        book?.grade || '',
        genType
      );
      
      // 合并硬性检查问题
      hardIssues.forEach(issue => {
        issues.push(`${issue.severity === 'error' ? '❌' : '⚠️'} ${issue.detail}`);
      });

      // 自动修复可修复的问题
      if (hardIssues.some(i => i.autoFix)) {
        content = HardRuleChecker.autoFix(content, hardIssues);
      }

      // ========== 🔧 新增：AI语义审查（第二级——通读全文抓语病/错字/逻辑） ==========
      const semanticCtx = {
        genType,
        subject: book?.subject || '',
        stage: stageRaw,
        grade: book?.grade || '',
      };
      const semanticResult = await performSemanticReview(content, semanticCtx);
      if (semanticResult.hasIssues) {
        semanticResult.issues.forEach(issue => {
          issues.push('🔍 ' + issue);
        });
        // 发现问题 → 自动修复
        const semanticFix = await repairSemanticIssues(content, semanticResult.issues, semanticCtx);
        if (semanticFix.repaired) {
          content = semanticFix.content;
          console.log('✅ 语义问题已自动修复');
        }
      }

      // ========== 🔧 AI内容修复（单次） ==========
      const repairContext = {
        genType, 
        subject: book?.subject || '', 
        stage: stageRaw,
        grade: book?.grade || '',
        parsedBlueprint,
      };
      const repairResult = await attemptContentRepair(content, hardIssues, repairContext);
      if (repairResult.repaired) {
        content = repairResult.content;
        // 合并修复后新检出的问题
        if (repairResult.repairIssues && repairResult.repairIssues.length > 0) {
          repairResult.repairIssues.forEach(issue => {
            hardIssues.push(issue);
            issues.push((issue.severity === 'error' ? '❌' : '⚠️') + ' ' + issue.detail);
          });
        }
      }

      // 初始化质量报告（必须在所有使用之前定义）
      const qualityReport = {
        formatCheck: { passed: true, details: [] },
        coverageCheck: { passed: true, details: [] },
        difficultyCheck: { passed: true, details: [] },
        knowledgeCheck: { passed: true, details: [] },
        templateMatch: { passed: true, details: [] },
        semanticCheck: { passed: true, details: [] }
      };

      // 记录AI语义审查结果
      if (semanticResult && semanticResult.hasIssues) {
        qualityReport.semanticCheck.passed = false;
        qualityReport.semanticCheck.details.push(semanticResult.summary);
      }

      // 记录硬性检查结果
      const hardIssueSummary = HardRuleChecker.getIssueSummary(hardIssues);
      if (hardIssueSummary.hasErrors) {
        qualityReport.formatCheck.passed = false;
        qualityReport.formatCheck.details.push(`硬性规则检查发现${hardIssueSummary.errors}个错误`);
      }
      if (hardIssueSummary.hasWarnings) {
        qualityReport.formatCheck.details.push(`硬性规则检查发现${hardIssueSummary.warnings}个警告`);
      }

      // ========== 第一级：规则检查 ==========
      // 5.1：格式完整性检查
      if (!content.includes('<h') && !content.includes('<p') && !content.includes('<div')) {
        issues.push('❌ 可能未返回HTML格式');
        qualityReport.formatCheck.passed = false;
        qualityReport.formatCheck.details.push('缺少HTML标签');
      }
      if (!content.includes('answer-section')) {
        issues.push('⚠️ 缺少答案区域');
        qualityReport.formatCheck.details.push('缺少答案区域');
      }



      // 格式检查（🔧 放宽：不要求精确 <p class="question">，只要有基本HTML结构即可）
      if (!content.includes('<p') && !content.includes('<div') && !content.includes('<h')) {
        issues.push('❌ 可能未返回HTML格式');
        qualityReport.formatCheck.passed = false;
      }

      // 🔧 genType 感知：非题目型资料（summary/dictation）不使用 <p class="question"> 标签，跳过题目数量检查
      const nonQuestionGenTypes = ['summary', 'dictation'];
      const isQuestionOutput = !nonQuestionGenTypes.includes(genType);
      
      if (isQuestionOutput) {
        // 🔧 放宽匹配：DeepSeek 输出可能使用不同的 CSS class（如 question-item / exam-question）
        const questionMatches = content.match(/class="[^"]*question[^"]*"/gi);
        const questionCount = questionMatches ? questionMatches.length : 0;
        if (questionCount === 0 && parsedBlueprint.length > 0) {
          // 🔧 无 question class 不一定是错误，降级为 warning（不阻断流程）
          issues.push('⚠️ 未检测到 class="question" 标记（AI输出可能使用其他class名），建议人工确认题目完整性');
          qualityReport.formatCheck.details.push('未检测到题目class标记');
        }
        if (questionCount > 0 && questionCount < 5) {
          issues.push(`⚠️ 题目数量偏少（${questionCount}题）`);
          qualityReport.formatCheck.details.push(`题目数量：${questionCount}题`);
        }
      }

      // 🔧 蓝图-生成结果结构化对比（暂未实现，跳过）
      // TODO: 实现 compareBlueprintToGenerated 函数后启用

      // 5.3：科学性错误初检（全角数字、格式异常）
      const commonErrors = [
        { pattern: /[０-９]/g, message: '包含全角数字' },
        { pattern: /答案.{0,5}略/g, message: '答案标注为"略"' },
      ];
      commonErrors.forEach(({ pattern, message }) => {
        if (pattern.test(content)) {
          issues.push(`⚠️ ${message}`);
        }
      });

      // 🔧 新增：LaTeX 公式语法基础校验
      if (book && ['数学', '物理', '化学'].includes(book.subject || '')) {
        // 检查行内公式 $...$ 是否闭合（奇数个 $ 表示有未闭合的公式）
        const dollarCount = (content.match(/\$/g) || []).length;
        if (dollarCount % 2 !== 0) {
          issues.push('⚠️ 行内公式符号$未闭合（奇数个$）');
          qualityReport.formatCheck.details.push('检测到未闭合的$公式符号');
        }
        
        // 检查独立公式 $$...$$ 是否配对
        const doubleDollarCount = (content.match(/\$\$/g) || []).length;
        if (doubleDollarCount % 2 !== 0) {
          issues.push('⚠️ 独立公式符号$$未配对');
          qualityReport.formatCheck.details.push('检测到未配对的$$公式符号');
        }
        
        // 检查常见 LaTeX 语法错误
        const latexErrors = [
          { pattern: /\\frac\{\}/, message: '\\frac{} 缺少参数' },
          { pattern: /\\sqrt\{\}/, message: '\\sqrt{} 缺少参数' },
          { pattern: /\{\\frac/, message: '括号位置错误（应在\\frac之后）' },
          { pattern: /[^\\]_\{[^}]*$/, message: '下标{}可能未闭合' },
          { pattern: /[^\\]\^\{[^}]*$/, message: '上标{}可能未闭合' }
        ];
        
        for (const error of latexErrors) {
          if (error.pattern.test(content)) {
            issues.push(`⚠️ LaTeX语法问题：${error.message}`);
          }
        }
      }

            progress.value = 85;

      // ========== 🔧 新增：超纲检测（基于课标知识边界）==========
      const bookForBoundary = selectedBooks?.[0];
      if (bookForBoundary && content.length > 100) {
        const rawSubj = bookForBoundary?.subject || '';
        const stg = bookForBoundary?.stage || '';
        const grd = bookForBoundary?.grade || '';
        const subj = normalizeSubjectName(rawSubj, stg);
        
        const boundaryCheck = checkKnowledgeBoundary(content, subj, stg, grd);
        
        if (boundaryCheck.hasViolations) {
          boundaryCheck.violations.forEach(v => {
            const prefix = v.severity === 'error' ? '❌' : '⚠️';
            issues.push(`${prefix} 超纲检测：${v.message}`);
          });
          
          if (boundaryCheck.summary.errorCount > 0) {
            qualityReport.knowledgeCheck.passed = false;
            qualityReport.knowledgeCheck.details.push(
              `超纲检测发现${boundaryCheck.summary.errorCount}处明确超纲`
            );
          }
        }
        
        // 模糊边界标记为提示
        if (boundaryCheck.fuzzyItems.length > 0) {
          const fuzzyWarnings = boundaryCheck.fuzzyItems.filter(f => f.severity === 'warning');
          if (fuzzyWarnings.length > 0) {
            qualityReport.knowledgeCheck.details.push(
              `边界模糊检测：${fuzzyWarnings.map(f => `"${f.topic}"(${f.limit})`).join('；')}`
            );
          }
        }
        
        console.log('📋 超纲检测完成:', boundaryCheck.summary);
      }

      // ========== 🔧 逐题质量检查（仅检查禁止句式，不惩罚创意发挥）==========
      if (selectedTemplates?.length > 0) {
        statusText.value = '逐题质量检查...';
        
        try {
          // 提取每题题干
          const generatedStems = content.match(/<p class="question"[^>]*>([\s\S]*?)<\/p>/g) || [];
          
          for (let i = 0; i < Math.min(generatedStems.length, parsedBlueprint.length); i++) {
            const stemText = generatedStems[i].replace(/<[^>]+>/g, '').trim();
            const plan = parsedBlueprint[i];
            if (!plan) continue;
            
            // 仅检查禁止句式（真正的质量问题），不检查题干长度/选项数（会惩罚创意）
            const bannedPatterns = [
              '下列说法正确的是', '以下哪个选项是正确的',
              '以上都是', '以上都不对', '下列选项中错误的是'
            ];
            for (const pattern of bannedPatterns) {
              if (stemText.includes(pattern)) {
                issues.push(`⚠️ 题${plan.number}使用了禁止句式："${pattern}"`);
                break;
              }
            }
          }
        } catch (e) {
          console.warn('逐题质量检查失败:', e.message);
        }
      }      

      // ========== 第三级：蓝图vs生成的结构化对比 ✨新增 ==========
      if (parsedBlueprint.length > 0) {
        const generatedCount = (content.match(/class="[^"]*question[^"]*"/gi) || []).length;
        qualityReport.coverageCheck.details.push(`蓝图规划${parsedBlueprint.length}题，实际生成${generatedCount}题`);
        
        // 题型对比
        const blueprintTypes = [...new Set(parsedBlueprint.map(q => q.type))];
        const generatedTypes = [...new Set(
          (content.match(/<p class="question"[^>]*>([^<]*?)<\/p>/g) || [])
            .map(m => m.replace(/<[^>]+>/g, '').substring(0, 5))
        )];
        qualityReport.templateMatch.details.push(`蓝图题型: ${blueprintTypes.join('、')}，生成检测到${generatedCount}题`);

        // 难度分布对比
        const difficultyCounts = { '基础': 0, '中档': 0, '提高': 0 };
        parsedBlueprint.forEach(q => {
          if (difficultyCounts.hasOwnProperty(q.difficulty)) difficultyCounts[q.difficulty]++;
        });
        const total = parsedBlueprint.length || 1;
        qualityReport.difficultyCheck.details.push(
          `规划：基础${Math.round(difficultyCounts['基础']/total*100)}% 中档${Math.round(difficultyCounts['中档']/total*100)}% 提高${Math.round(difficultyCounts['提高']/total*100)}%`
        );


      }

      // ✨ 5.7：模板对标量化（新增）
      if (selectedTemplates?.length > 0 && selectedTemplates[0]?.analysis?.questionCards?.length > 0) {
        const templateCards = selectedTemplates[0].analysis.questionCards;
        
        // 题型分布对比
        const templateTypeDist = {};
        const generatedTypeDist = {};
        templateCards.forEach(c => templateTypeDist[c.type] = (templateTypeDist[c.type] || 0) + 1);
        parsedBlueprint.forEach(q => generatedTypeDist[q.type] = (generatedTypeDist[q.type] || 0) + 1);
        
        // 计算题型分布相似度
        const allTypes = [...new Set([...Object.keys(templateTypeDist), ...Object.keys(generatedTypeDist)])];
        let matchScore = 0;
        allTypes.forEach(t => {
          const tCount = templateTypeDist[t] || 0;
          const gCount = generatedTypeDist[t] || 0;
          if (tCount > 0 && gCount > 0) matchScore++;
        });
        const typeMatchRate = allTypes.length > 0 ? Math.round(matchScore / allTypes.length * 100) : 100;
        
        qualityReport.templateMatch.details.push(
          `题型匹配度: ${typeMatchRate}%（${matchScore}/${allTypes.length}类题型）`
        );
        
        // 🔧 新增：题干长度分布对比
        const templateStemLengths = templateCards.filter(c => c.stem).map(c => c.stem.length);
        const generatedStemTexts = content.match(/<p class="question"[^>]*>([^<]*)<\/p>/g) || [];
        const generatedStemLengths = generatedStemTexts.map(s => s.replace(/<[^>]+>/g, '').length);
        
        if (templateStemLengths.length > 0 && generatedStemLengths.length > 0) {
          const templateAvgStem = Math.round(templateStemLengths.reduce((a, b) => a + b, 0) / templateStemLengths.length);
          const generatedAvgStem = Math.round(generatedStemLengths.reduce((a, b) => a + b, 0) / generatedStemLengths.length);
          const stemDeviation = Math.abs(generatedAvgStem - templateAvgStem);
          
          qualityReport.templateMatch.details.push(
            `模板题干平均${templateAvgStem}字，生成题干平均${generatedAvgStem}字，偏差${stemDeviation}字`
          );
          
          if (stemDeviation > templateAvgStem * 0.5) {
            issues.push(`⚠️ 题干长度与模板偏差较大（模板${templateAvgStem}字 vs 生成${generatedAvgStem}字）`);
          }
        }
        
        // 总分对比
        const templateTotalScore = templateCards.reduce((sum, c) => sum + (c.score || 0), 0);
        const generatedTotalScore = parsedBlueprint.reduce((sum, q) => sum + (q.score || 0), 0);
        if (templateTotalScore > 0) {
          const scoreDeviation = Math.abs(generatedTotalScore - templateTotalScore);
          qualityReport.templateMatch.details.push(
            `模板总分${templateTotalScore}，生成总分${generatedTotalScore}，偏差${scoreDeviation}分`
          );
          if (scoreDeviation > 10) {
            issues.push(`⚠️ 总分与模板偏差${scoreDeviation}分`);
          }
        }
        
        // 题量对比
        qualityReport.templateMatch.details.push(
          `模板${templateCards.length}题，生成${parsedBlueprint.length}题`
        );
      }

      // ========== 🔧 新增：术语统一后处理 ==========
      if (book && book.subject) {
        const rawSubj = book?.subject || '';
        const stg = book?.stage || '';
        const subj = normalizeSubjectName(rawSubj, stg);
        const terminologyResult = normalizeTerminology(content, subj);
        
        if (terminologyResult.fixes.length > 0) {
          content = terminologyResult.normalized;
          console.log(`📝 术语统一完成：${terminologyResult.fixes.map(f => `"${f.original}"→"${f.corrected}"(${f.count}处)`).join('；')}`);
          qualityReport.formatCheck.details.push(
            `术语统一：${terminologyResult.fixes.length}种术语被标准化`
          );
        }
      }

      progress.value = 100;
      
      // 🔧 生成质量摘要，显示在状态栏（仅即时检查，不触发 API 调用）
      let summaryParts = ['生成完成'];

      if (qualityReport.knowledgeCheck?.details?.length) {
        const kpDetail = qualityReport.knowledgeCheck.details.find(d => d.includes('超纲'));
        if (kpDetail) summaryParts.push(`⚠️超纲检测`);
      }
      if (issues && issues.length > 0) {
        const errorCount = issues.filter(i => i.startsWith('❌')).length;
        const warnCount = issues.filter(i => i.startsWith('⚠️')).length;
        if (errorCount > 0) summaryParts.push(`❌${errorCount}个错误`);
        if (warnCount > 0) summaryParts.push(`⚠️${warnCount}个警告`);
      } else {
        summaryParts.push('✅无问题');
      }
      statusText.value = summaryParts.join(' | ');

      // ✨ 返回校验结果
      return { 
        success: true, 
        content,
        blueprint,
        contentCards,
        knowledgeMap,
        issues,
        qualityReport,
        generatedQuestions,
        parsedBlueprint
      };

    } catch (error) {
      console.error('生成失败:', error);
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return generate(instruction, genType, selectedBooks, selectedTemplates, retryCount + 1);
      }

      // 重试耗尽：弹窗让用户选择处理方式
      const { showRetryDialogFn } = useDialog();
      const chapterCount = selectedBooks?.[0]?.selectedChapters?.length || 0;
      const bookName = selectedBooks?.[0]?.name || selectedBooks?.[0]?.fileName || '';
      const dialogMsg = `AI 连续多次生成失败，重试已耗尽。

当前生成：${bookName}（${chapterCount} 个章节）
错误原因：${error.message}

请选择处理方式：`;

      const choice = await showRetryDialogFn(dialogMsg);

      if (choice === 'retry') {
        // 用户选择原样重试（重置重试计数）
        return generate(instruction, genType, selectedBooks, selectedTemplates, 0);
      }

      if (choice === 'batch') {
        // 用户选择批量生成模式
        try {
          // 需要先确保有 blueprint 和 parsedBlueprint
          // 如果用户从生成失败中恢复，blueprint 可能还在上下文中
          // 但如果蓝图解析也失败了，这里需要特殊处理
          
          // 尝试重新执行 Step 1-3 获取 blueprint
          statusText.value = '切换到批量生成模式...';
          progress.value = 30;

          // 重新提取 contentCards 和 knowledgeMap
          const retryContentCards = await extractContentCards(
            selectedBooks, callAI, robustJsonParse,
            (text, prog) => { statusText.value = text; progress.value = prog; }
          );
          const retryKnowledgeMap = await buildKnowledgeMap(
            retryContentCards, selectedBooks, callAI, robustJsonParse,
            (text, prog) => { statusText.value = text; progress.value = prog; }
          );

          // 构建知识图谱上下文
          const graph = Array.isArray(retryKnowledgeMap.knowledgeGraph) ? retryKnowledgeMap.knowledgeGraph : [];
          const kpNames = Array.isArray(retryKnowledgeMap.knowledgePoints) ? retryKnowledgeMap.knowledgePoints : [];
          const difficulties = Array.isArray(retryKnowledgeMap.keyDifficulties) ? retryKnowledgeMap.keyDifficulties : [];

          // 重新生成 blueprint（精简版 prompt）
          const batchBlueprintPrompt = `请为以下学科生成命题蓝图（JSON数组），每道题包含 number/type/knowledgePoint/difficulty/score/sourceChapter。

学科：${selectedBooks?.[0]?.subject || ''}
年级：${selectedBooks?.[0]?.grade || ''}
知识点：${kpNames.join('、')}
重难点：${difficulties.join('、')}

请根据 ${instruction} 的要求规划题目。只返回JSON数组，不要其他内容。`;

          const batchBlueprintRaw = await callAI(batchBlueprintPrompt, {
            taskType: 'blueprint', timeout: 120000, forceJson: true
          });
          const batchBlueprint = await robustJsonParse(batchBlueprintRaw, null, 'batch-blueprint');

          // 批量生成内容
          const batchContent = await generateBatchWithBlueprint(
            JSON.stringify(batchBlueprint),
            instruction,
            selectedBooks,
            selectedTemplates
          );

          // 执行第五步：质量校验
          const batchIssues = [];
          const book = selectedBooks?.[0];
          const stageRaw = book?.stage || '';
          const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
          const hardIssues = HardRuleChecker.check(
            batchContent, batchBlueprint,
            book?.subject || '', stageMap[stageRaw] || stageRaw, book?.grade || '',
            genType
          );
          hardIssues.forEach(issue => {
            batchIssues.push(`${issue.severity === 'error' ? '❌' : '⚠️'} ${issue.detail}`);
          });

          return {
            success: true,
            content: batchContent,
            blueprint: JSON.stringify(batchBlueprint),
            parsedBlueprint: batchBlueprint,
            contentCards: retryContentCards,
            knowledgeMap: retryKnowledgeMap,
            issues: batchIssues,
            qualityReport: { formatCheck: { passed: true, details: [] } },
            generatedQuestions: [batchContent],
            batchMode: true  // 标记为批量模式生成
          };
        } catch (batchError) {
          console.error('批量生成也失败:', batchError);
          return { success: false, error: `批量生成失败：${batchError.message}`, retried: true };
        }
      }

      // 用户选择取消
      return { success: false, error: error.message, retried: retryCount > 0 };
    } finally {
      if (retryCount === 0) {
        isGenerating.value = false;
      }
    }
  };

  // ==================== 知识点总结生成（两步流程） ====================
  const generateSummary = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    const sumConfig1 = await getCurrentEngineConfigEnhanced('analysis');
    const sumModel1 = getModelDisplayName(sumConfig1.textModel || sumConfig1.model);
    statusText.value = `构建知识图谱 [${sumModel1}]...`;
    progress.value = 10;
    
    // 🔧 改进：复用 extractContentCards 和 buildKnowledgeMap
    const contentCards = await extractContentCards(
      selectedBooks, 
      callAI, 
      robustJsonParse,
      (text, prog) => { statusText.value = text; progress.value = prog; }
    );
    
    const knowledgeMap = await buildKnowledgeMap(
      contentCards, 
      selectedBooks, 
      callAI, 
      robustJsonParse,
      (text, prog) => { statusText.value = text; progress.value = prog; }
    );
    
    // 🔧 从 contentCards 中提取关键原文段落
    let textbookContext = '';
    const allSegments = [];
    for (const card of contentCards) {
      if (card.segments) {
        for (const seg of card.segments) {
          allSegments.push({
            chapterTitle: card.chapterTitle,
            text: seg.text,
            isKey: seg.isKeyConcept
          });
        }
      }
    }
    allSegments.sort((a, b) => (b.isKey ? 1 : 0) - (a.isKey ? 1 : 0));
    let totalLength = 0;
    const selectedForPrompt = [];
    for (const seg of allSegments) {
      if (totalLength + seg.text.length > 3000) break;
      selectedForPrompt.push(seg);
      totalLength += seg.text.length;
    }
    textbookContext = selectedForPrompt.map(s => `【${s.chapterTitle}】${s.text}`).join('\n\n');

    // 收集模板原文
    let templateRawText = '';
    if (selectedTemplates && selectedTemplates.length > 0) {
      const tpl = selectedTemplates[0];
      const tplText = tpl.analysis?.rawText || '';
      if (tplText) {
        templateRawText = tplText.substring(0, 2000);
      }
    }
    
    // 🔧 从知识图谱构建知识结构文本
    let knowledgeGraphText = '';
    if (knowledgeMap.knowledgeGraph?.length > 0) {
      knowledgeGraphText = knowledgeMap.knowledgeGraph.map(unit => {
        let text = `📌 单元：${unit.unit || ''}\n`;
        (unit.bigConcepts || []).forEach(bc => {
          text += `  📌 ${bc.name}\n`;
          (bc.coreKnowledge || []).forEach(ck => {
            text += `    ├─ ${ck.name}【${ck.cognitiveLevel || '理解'}】\n`;
            (ck.specificConcepts || []).forEach(sc => {
              text += `    │  └─ ${sc}\n`;
            });
          });
        });
        return text;
      }).join('\n');
    } else {
      knowledgeGraphText = (knowledgeMap.knowledgePoints || []).map(kp => `📌 ${kp}`).join('\n');
    }
    
    // ✨ 第一步：构建知识图谱结构
    statusText.value = '步骤 1/3：分析知识结构...';
    progress.value = 30;

    // 🔧 blueprintOnly 模式：仅返回知识图谱蓝图
    if (blueprintOnly) {
      progress.value = 50;
      statusText.value = '知识总结蓝图已生成';
      const bookForBp = selectedBooks?.[0];
      const stageRawBp = bookForBp?.stage || '';
      // 🔧 指令库使用英文 stage，需要映射：小学→primary, 初中→middle, 高中→high
      const stageMapBp = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
      const stageBp = stageMapBp[stageRawBp] || stageRawBp;
      const gradeBp = bookForBp?.grade || '';
      const rawSubjBp = bookForBp?.subject || '';
      const subjBp = normalizeSubjectName(rawSubjBp, stageRawBp);
      const coreTopic = contentCards?.[0]?.summary || '';
      const summaryStructure = getStructureForBlueprint('summary', subjBp, stageBp);
      const blueprintText = [
        `【知识点总结蓝图】`,
        `学科：${subjBp}  |  年级：${gradeBp}  |  学段：${stageRawBp}`,
        `${coreTopic ? '🎯 核心主题：' + coreTopic + '\n' : ''}生成结构：${summaryStructure}`,
        ``,
        `【知识结构】`,
        knowledgeGraphText
      ].join('\n');
      isGenerating.value = false;
      return {
        success: true,
        blueprint: blueprintText,
        parsedBlueprint: (() => {
          const kps = (knowledgeMap.knowledgePoints || []).slice(0, 15);
          if (kps.length === 0) {
            const chs = selectedBooks?.[0]?.selectedChapters || [];
            const fallback = chs.map(c => c.title).filter(Boolean).slice(0, 10);
            return fallback.map((t, i) => ({ number: i + 1, type: '知识点', knowledgePoint: t, difficulty: '基础', score: 0, sourceChapter: gradeBp }));
          }
          return kps.map((kp, i) => ({ number: i + 1, type: '知识点', knowledgePoint: kp, difficulty: '基础', score: 0, sourceChapter: gradeBp }));
        })(),
        contentCards,
        knowledgeMap,
        content: '',
        generatedQuestions: [],
        issues: null,
        qualityReport: null
      };
    }

    // ✨ 第二步：分块生成
    statusText.value = '步骤 2/3：生成思维导图...';
    progress.value = 50;
    
    const mindmapPrompt = `你是一位教辅编辑专家。请根据以下知识结构，生成一份思维导图。

【知识结构】
${knowledgeGraphText}

【格式要求】
- 用 HTML 嵌套列表表示思维导图（最多4层）
- 用 <div class="mindmap"> 包裹
- 外层用 <ul>，每个节点用 <li>
- 重要概念用 <strong> 加粗
- 不同层级用不同缩进表示
- 直接返回 HTML 片段，不要用代码块包裹`;

    let mindmapHtml = '';
    try {
      mindmapHtml = await callAI(mindmapPrompt, { taskType: 'generation', temperature: 0.3, timeout: 60000 });
    } catch (e) {
      console.warn('思维导图生成失败:', e.message);
      mindmapHtml = '<div class="mindmap"><ul><li>知识结构</li></ul></div>';
    }
    
    // ✨ 第三步：生成主体内容
    statusText.value = '步骤 3/3：生成知识详解...';
    progress.value = 65;
    
    // 🔧 提取学科/学段变量到函数作用域，供 prompt 模板中 IIFE 和 buildOutputFormatBlock 共用
    const bookForCtx = selectedBooks?.[0];
    const ctxSubject = normalizeSubjectName(bookForCtx?.subject || '', bookForCtx?.stage || '');
    const ctxStage = bookForCtx?.stage || '';
    
    const summaryPrompt = buildOutputPreamble() +
`\n` +
`【参考资料——以下是生成所需的所有背景信息】\n` +
`${instruction}\n` +
`\n【知识图谱结构】\n${knowledgeGraphText}\n` +
`\n【教材原文参考】\n${textbookContext.substring(0, 3000)}\n` +
`${templateRawText ? '【模板风格参考】\n' + templateRawText.substring(0, 1500) + '\n' : ''}` +
`【已生成的思维导图】\n${mindmapHtml}\n` +
`\n【生成要求——请生成以下内容，每个板块必须输出具体内容，禁止写"略""见教材""自行查阅"等占位符】\n${(() => {
  // 基础四部分
  let sections = `1. <h2>学习目标</h2>：用学生能理解的语言写2-3条本课/本单元学习目标\n2. <h2>核心知识清单</h2>：用 <table> 列出核心知识点，包含三列：知识点 | 核心内容 | 考查方式\n3. <h2>知识辨析与易错提示</h2>：用对比表格，左右两列分别列出"常见错误"和"正确理解"，至少3组\n4. <h2>典型例题精析</h2>：至少3道例题，每题用 <div class="example"> 包裹题干，<div class="analysis"> 包裹解析（含完整解析：解题思路→分步解答→易错提示）`;
  // 学科增强
  if (ctxSubject === '语文') {
    sections += `\n5. <h2>写作素材积累</h2>：从课文中提炼好词好句，按类别整理（写景/写人/状物/抒情等）`;
  } else if (['数学', '物理', '化学'].includes(ctxSubject)) {
    sections += `\n5. <h2>公式/定理速查</h2>：列出本章所有公式和定理，标注适用条件和典型用法`;
  } else if (ctxSubject === '英语') {
    // 🔧 学段感知：小学侧重自然拼读，初高中侧重国际音标/语调
    const voiceSection = ctxStage === '小学'
        ? `\n5. <h2>语音/发音规则归纳</h2>：归纳自然拼读规律和字母组合发音规则`
        : `\n5. <h2>语音/发音规则归纳</h2>：归纳国际音标、重音、连读、语调等发音要点`;
    sections += voiceSection;
    sections += `\n6. <h2>词汇句型归纳</h2>：按词性和话题分类整理词汇，列出重点句型和语法点`;
  } else if (['生物', '科学'].includes(ctxSubject)) {
    sections += `\n5. <h2>实验/探究梳理</h2>：列出本章的实验名称、实验步骤、实验现象和结论（用表格呈现：实验名称 | 步骤 | 现象 | 结论）`;
  } else if (['历史', '地理'].includes(ctxSubject)) {
    sections += `\n5. <h2>图表/时间轴整理</h2>：历史学科整理时间轴（关键事件+时间+影响），地理学科整理地图/图表（区域特征+自然/人文要素对比表）`;
  } else if (['道德与法治', '思想政治'].includes(ctxSubject)) {
    sections += `\n5. <h2>案例分析归纳</h2>：列出教材中的典型案例，用"案例→知识点→启示"的格式呈现，至少2组`;
  }
  // 通用增强
  sections += `\n<br>\n<h2>五、重难点星级标注</h2>：用 <table> 列出本章所有知识点，四列：知识点 | 难度(基础/重点/难点) | 星级与考点说明（⭐️低频 ⭐️⭐️中频 ⭐️⭐️⭐️高频必考，至少写半句话说明为什么是考点） | 高频考点（⭐️⭐️⭐️）必须配详细解法和变式练习\n<h2>六、记忆方法/学习技巧</h2>：用 <p> 逐条列出2-3个记忆口诀或学习方法建议，每条以序号+<strong>方法名</strong>开头`;
  if (ctxStage === '小学') {
    sections += `\n📝 <h2>趣味小练习</h2>：2-3道巩固题，用游戏化/生活化形式呈现（题目留空让学生做，答案和解析统一放文末<div class="answer-section">中）`;
  }
  // 参考答案规范：所有题目（典型例题+趣味练习+知识辨析中的填空）的答案统一放文末
  sections += `\n<br>\n<h2>参考答案与解析</h2>：文末用<div class="answer-section">包裹，所有题目答案按题号顺序列出。典型例题答案必须包含完整解析（解题思路→分步解答→易错提示），趣味练习题答案附简要解析（至少点出解题关键），知识辨析填空题答案附知识点定位说明`;
  return sections;
})()}

${(() => {
  const stageMapLocal = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
  return buildCompactAIInstruction(instruction, genType, ctxSubject, stageMapLocal[ctxStage] || ctxStage, bookForCtx?.grade || '');
})()}

【格式补充】
- 重要公式用 <div class="formula"> 包裹
- 不要包含思维导图（已单独生成）

${(() => { let mt = ''; if (ctxSubject) { const mg = getMatchingBlockInstructions({ category: '生成-学科标记', subject: ctxSubject, stage: '' }); const ms = ctxStage ? getMatchingBlockInstructions({ category: '生成-学科标记', subject: ctxSubject, stage: ctxStage }) : []; const am = [...mg]; for (const b of ms) { if (!am.find(m => m.id === b.id)) am.push(b); } if (am.length > 0) { mt = '【学科专用标记规范】\n' + am.map(b => b.content).join('\n') + '\n\n'; } } return mt; })()}${buildOutputFormatBlock('summary', ctxSubject, ctxStage, selectedBooks?.[0]?.grade || '')}`;

    try {
      const content = await callAI(summaryPrompt, {
        taskType: 'generation',
        timeout: 180000
      });
      detectSquishedOutput(content, 'summary');
      
      // ✨ 组装：思维导图 + 主体内容
      const finalContent = mindmapHtml + '\n\n' + (content || '');
      
      // 🔧 基础质量校验
      const book = selectedBooks?.[0];
      const stageRaw = book?.stage || '';
      const stageMapLocal = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
      const qualityIssues = HardRuleChecker.check(
        finalContent, [], book?.subject || '', 
        stageMapLocal[stageRaw] || stageRaw, book?.grade || '',
        genType
      );
      const qualityReport = {
        formatCheck: { passed: finalContent.includes('<table') && finalContent.includes('<h2'),
          details: finalContent.includes('<table') ? [] : ['缺少表格'] },
        coverageCheck: { passed: true, details: [] },
        knowledgeCheck: { passed: finalContent.length > 500, details: [] },
        aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0,
          details: qualityIssues.map(i => i.detail) }
      };
      
      progress.value = 100;
      statusText.value = '生成完成';
      
      return {
        success: true,
        content: finalContent,
        blueprint: '',
        contentCards: [],
        knowledgeMap: {},
        issues: qualityIssues.map(i => i.detail),
        qualityReport,
        generatedQuestions: [],
        parsedBlueprint: []
      };
    } catch (e) {
      console.error('知识点总结生成失败:', e);
      return { success: false, error: e.message };
    } finally {
      isGenerating.value = false;
    }
  };

  // ==================== 错题本生成（三步流程） ====================
  const generateErrorbook = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    // 🔧 改进：复用 extractContentCards 和 buildKnowledgeMap
    const contentCards = await extractContentCards(
      selectedBooks, 
      callAI, 
      robustJsonParse,
      (text, prog) => { statusText.value = text; progress.value = prog; }
    );
    
    const knowledgeMap = await buildKnowledgeMap(
      contentCards, 
      selectedBooks, 
      callAI, 
      robustJsonParse,
      (text, prog) => { statusText.value = text; progress.value = prog; }
    );
    
    // 🔧 提取教材基本信息
    const book = selectedBooks?.[0];
    const bookSubject = book?.subject || '';
    const bookStage = book?.stage || '';
    const bookGrade = book?.grade || '';
    // 🔧 指令库使用英文 stage，需要映射
    const stageMapLocal = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
    
    // 🔧 从 contentCards 和 knowledgeMap 中提取知识点
    const knowledgePoints = knowledgeMap.knowledgePoints || [];
    const knowledgeHierarchy = knowledgeMap.knowledgeGraph || [];
    
    // 🔧 空数据检测：知识点为空时的降级处理
    // 🔧 三层聚合：knowledgeMap + contentCards tags + knowledgePointsForTest
    let kpList = knowledgePoints.length > 0 
      ? [...new Set(knowledgePoints)].slice(0, 30) 
      : [];
    if (kpList.length === 0) {
      const fromTags = (contentCards || []).flatMap(c => c.tags || []);
      const fromKpft = (contentCards || []).flatMap(c => (c.knowledgePointsForTest || []).map(k => typeof k === 'string' ? k : k.name));
      kpList = [...new Set([...fromTags, ...fromKpft].filter(Boolean))].slice(0, 30);
    }
    let errorProneKps = [];
    
    if (kpList.length === 0) {
      const bookForKp = selectedBooks?.[0];
      const chapterTitles = (bookForKp?.selectedChapters || []).map(c => c.title).filter(Boolean);
      if (chapterTitles.length === 0) {
        console.warn('⚠️ 错题本：无可用知识点且无章节标题，无法生成');
        const emptyContent = `<h1>错题本</h1><div class="errorbook-info"><p>⚠️ 未能提取到教材知识点，请先对教材进行「分析教材」操作后再生成错题本。</p></div>`;
        isGenerating.value = false;
        return {
          success: true, content: emptyContent, blueprint: '', contentCards: [], knowledgeMap: {},
          generatedQuestions: [], parsedBlueprint: [], issues: ['无法生成：教材未分析，缺少知识点'],
          qualityReport: { formatCheck: { passed: false, details: ['缺少知识点'] }, coverageCheck: { passed: false, details: [] }, knowledgeCheck: { passed: false, details: ['无可用知识点'] }, aiReview: { passed: false, details: ['请先分析教材'] } }
        };
      }
      // 🔧 降级：用章节标题代替知识点
      console.warn('⚠️ 错题本：未提取到知识点，使用章节标题作为降级');
      errorProneKps = chapterTitles.slice(0, 6).map(title => ({
        knowledgePoint: title,
        errorType: '概念混淆',
        typicalError: '对该章节核心概念理解不清晰',
        rootCause: '基础知识掌握不牢固',
        frequency: '中频'
      }));
    }
    
    // 🔧 blueprintOnly 模式：仅返回易错知识点分析蓝图
    if (blueprintOnly) {
      progress.value = 50;
      statusText.value = '错题本蓝图已生成';
      const displayKps = kpList.length > 0 ? kpList : (book?.selectedChapters || []).map(c => c.title).filter(Boolean).slice(0, 15);
      const errorbookStructure = getStructureForBlueprint('errorbook', bookSubject, stageMapLocal[bookStage] || bookStage);
      // 🔧 共享层级构建（带智能截断）
      const hierarchyText = buildHierarchyText(knowledgeMap, contentCards, 30);
      const blueprintText = [
        `【错题本蓝图】`,
        `学科：${bookSubject}  |  年级：${bookGrade}  |  学段：${bookStage}`,
        `结构：${errorbookStructure}`,
        `候选易错知识点（${displayKps.length}个，非穷举）：${displayKps.join('、')}`,
        `${hierarchyText ? '\n【知识覆盖层级】\n' + hierarchyText : ''}`,
        `预计生成：${Math.min(displayKps.length, 8)}道错题分析`
      ].join('\n');
      isGenerating.value = false;
      return {
        success: true, blueprint: blueprintText,
        parsedBlueprint: displayKps.slice(0, 8).map((kp, i) => ({ number: i + 1, type: '错题分析', knowledgePoint: kp, difficulty: '中等', score: 10, sourceChapter: bookGrade })),
        contentCards, knowledgeMap, content: '', generatedQuestions: [], issues: null, qualityReport: null
      };
    }
    
    // 🔧 从 contentCards 和 knowledgeMap 中提取知识点（原逻辑——注意 kpList 已在上面定义）
    
    // 🔧 从 contentCards 中提取关键原文段落
    let textbookContext = '';
    const allSegments = [];
    for (const card of contentCards) {
      if (card.segments) {
        for (const seg of card.segments) {
          allSegments.push({
            chapterTitle: card.chapterTitle,
            text: seg.text,
            isKey: seg.isKeyConcept,
            isExample: seg.isExample
          });
        }
      }
    }
    allSegments.sort((a, b) => (b.isKey ? 1 : 0) - (a.isKey ? 1 : 0));
    let totalLength = 0;
    const selectedForPrompt = [];
    for (const seg of allSegments) {
      if (totalLength + seg.text.length > 3000) break;
      selectedForPrompt.push(seg);
      totalLength += seg.text.length;
    }
    textbookContext = selectedForPrompt.map(s => `【${s.chapterTitle}】${s.text}`).join('\n\n');
    
    // 收集模板原文
    let templateRawText = '';
    if (selectedTemplates && selectedTemplates.length > 0) {
      const tpl = selectedTemplates[0];
      const tplText = tpl.analysis?.rawText || '';
      if (tplText) {
        templateRawText = tplText.substring(0, 2000);
      }
    }
    
    // ✨ 第一步：识别高频易错知识点
    statusText.value = '步骤 1/3：识别易错知识点...';
    progress.value = 25;
    
    // 🔧 kpList 和 errorProneKps 已在上面定义，此处复用
    
    if (kpList.length > 0) {
      try {
        const analyzePrompt = `你是一位教学经验丰富的学科老师。请从以下知识点中，识别出学生最容易出错的5-8个知识点，并分析错误类型。

【知识点列表】
${kpList.join('、')}

【教材内容参考】
${textbookContext.substring(0, 1500)}

请分析每个易错知识点：
1. 典型错误表现（学生常犯的具体错误）
2. 错误类型（概念混淆 / 计算失误 / 审题不清 / 方法不当 / 知识遗漏）
3. 错误根因（为什么学生会犯这个错误）
4. 考查频率（高频 / 中频 / 低频）

返回 JSON 数组：
[
  {
    "knowledgePoint": "知识点名称",
    "errorType": "概念混淆",
    "typicalError": "学生的典型错误描述",
    "rootCause": "错误根因分析",
    "frequency": "高频"
  }
]

只返回 JSON 数组。`;

        const analyzeResult = await callAI(analyzePrompt, { 
          taskType: 'analysis', 
          temperature: 0.2, 
          timeout: 60000 
        });
        try {
          errorProneKps = await robustJsonParse(analyzeResult, null, '易错知识点分析');
          console.log(`✅ 识别出 ${errorProneKps.length} 个易错知识点`);
        } catch {
          errorProneKps = kpList.slice(0, 6).map(kp => ({
            knowledgePoint: kp,
            errorType: '概念混淆',
            typicalError: '对概念理解不清晰',
            rootCause: '基础知识不扎实',
            frequency: '中频'
          }));
        }
      } catch (e) {
        console.warn('易错分析失败:', e.message);
        errorProneKps = kpList.slice(0, 6).map(kp => ({
          knowledgePoint: kp,
          errorType: '概念混淆',
          typicalError: '理解偏差',
          rootCause: '基础不牢',
          frequency: '中频'
        }));
      }
    }
    
    // ✨ 第二步：构建知识关联图（用于变式题推荐）
    statusText.value = '步骤 2/3：构建知识关联...';
    progress.value = 45;
    
    let knowledgeLinks = [];
    if (errorProneKps.length > 1) {
      try {
        const linkPrompt = `请分析以下易错知识点之间的关联关系，用于推荐变式题。

【易错知识点】
${errorProneKps.map(kp => kp.knowledgePoint).join('、')}

【知识层级】
${JSON.stringify(knowledgeHierarchy.slice(0, 3) || [], null, 2)}

请标注知识点之间的关联类型：
- 前置依赖（A是B的前置知识）
- 并列关系（A和B是同级知识点）
- 易混淆（A和B容易混淆）

返回 JSON 数组：
[
  {"from": "知识点A", "to": "知识点B", "relation": "前置依赖"},
  ...
]

只返回 JSON 数组。`;

        const linkResult = await callAI(linkPrompt, { 
          taskType: 'analysis', 
          temperature: 0.1, 
          timeout: 60000 
        });
        try {
          knowledgeLinks = await robustJsonParse(linkResult, null, '知识关联');
        } catch {
          knowledgeLinks = [];
        }
      } catch (e) {
        console.warn('知识关联分析失败:', e.message);
      }
    }
    
    // ✨ 第三步：分题生成错题本
    statusText.value = '步骤 3/3：逐题生成错题...';
    progress.value = 55;
    
    const errorItems = [];
    const maxItems = Math.min(errorProneKps.length, 8);
    
    // 🔧 预计算学科标记（语文画线句子等），逐题 prompt 共用
    const ebMarkupText = (() => {
      let mt = '';
      if (bookSubject) {
        const mg = getMatchingBlockInstructions({ category: '生成-学科标记', subject: bookSubject, stage: '' });
        const ms = bookStage ? getMatchingBlockInstructions({ category: '生成-学科标记', subject: bookSubject, stage: bookStage }) : [];
        const am = [...mg];
        for (const b of ms) { if (!am.find(m => m.id === b.id)) am.push(b); }
        if (am.length > 0) { mt = '\n【学科专用标记规范】\n' + am.map(b => b.content).join('\n'); }
      }
      return mt;
    })();
    
    for (let i = 0; i < maxItems; i++) {
      const kp = errorProneKps[i];
      statusText.value = `生成错题 ${i + 1}/${maxItems}...`;
      progress.value = 55 + Math.round((i / maxItems) * 30);
      
      // 找到关联知识点用于变式题
      const relatedLinks = knowledgeLinks.filter(l => l.from === kp.knowledgePoint || l.to === kp.knowledgePoint);
      const relatedKps = relatedLinks.map(l => l.from === kp.knowledgePoint ? l.to : l.from);
      const uniqueRelated = [...new Set(relatedKps)].slice(0, 3);
      
      const itemPrompt = buildOutputPreamble() + `

【任务】你是一位${bookStage || ''}${bookGrade || ''}${bookSubject || ''}老师。请为以下易错知识点生成一道错题分析。

【知识点】${kp.knowledgePoint}
【错误类型】${kp.errorType || '概念混淆'}
【典型错误表现】${kp.typicalError || '理解偏差'}
【错误根因】${kp.rootCause || '基础不牢'}
【考查频率】${kp.frequency || '中频'}

${uniqueRelated.length > 0 ? '【关联知识点（用于变式题）】' + uniqueRelated.join('、') : ''}

【教材内容参考——⚠️仅供核对知识点准确性，严禁复制原文段落】
${textbookContext.substring(0, 800)}

${templateRawText ? '【错题本格式参考——⚠️仅供参考排版风格，严禁复制模板内容】\n' + templateRawText.substring(0, 500) : ''}

【生成要求】只生成一道错题，包含以下结构：

<div class="error-item">
  <h3>错题 ${i + 1}：${kp.knowledgePoint}</h3>
  
  <div class="error-tags">
    <span class="tag tag-error-type">${kp.errorType || '概念混淆'}</span>
    <span class="tag tag-frequency">${kp.frequency || '中频'}</span>
    <span class="tag tag-difficulty">中等</span>
    <span class="tag tag-score-loss">常见失分：X分</span>
  </div>
  
  <div class="original-question">
    <h4>📝 典型错题</h4>
    <!-- 具体题目（模仿真实考卷中的题） -->
  </div>
  
  <div class="error-analysis">
    <h4>🔍 错误分析</h4>
    <p><strong>典型错误：</strong>${kp.typicalError || ''}（写出学生具体的错误答案或思路）</p>
    <p><strong>错误根因：</strong>${kp.rootCause || ''}（分析为什么会犯这个错误）</p>
    <p><strong>避错策略：</strong>（给出2-3条实用的避错方法或检查技巧）</p>
  </div>
  
  <div class="correct-solution">
    <h4>✅ 正确解法</h4>
    <!-- 完整解题过程，分步骤展示，关键步骤标注得分点 -->
  </div>
  
  <div class="variant-practice">
    <h4>🔄 变式巩固</h4>
    <!-- 一道考查同知识点但形式不同的变式题，附答案和解析 -->
    ${uniqueRelated.length > 0 ? '<!-- 可结合关联知识点：' + uniqueRelated.join('、') + ' -->' : ''}
  </div>
</div>

【质量约束——必须遵守】
- ⛔ 典型错题必须模仿真实考卷中的题目，具体且有代表性
- ⛔ 错误分析必须具体，写出学生实际的错误答案或思路，不得泛泛而谈
- ⛔ 正确解法必须完整，分步骤展示，关键步骤标注得分点
- ⛔ 变式巩固题必须与典型错题考查同一知识点但形式不同
${(() => {
  // 查询指令库通用禁止项（覆盖"禁止写略""禁止超纲""禁止政治敏感"等，避免重复）
  const stageMapLocal = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
  const banBlocks = getMatchingBlockInstructions({ category: '生成-禁止项', subject: bookSubject || '', stage: stageMapLocal[bookStage] || bookStage || '', genType });
  return banBlocks.length > 0 ? banBlocks.map(b => b.content).join('\n') : '';
})()}

【格式规范】
${(() => {
  const stageMapLocal = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
  const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject: bookSubject || '', stage: stageMapLocal[bookStage] || bookStage || '', genType });
  return fmtBlocks.length > 0 ? fmtBlocks.map(b => b.content).join('\n') + '\n' : '';
})()}
- 用 HTML 格式
- 题干用 <p class="question">，选项用 <p class="option">
- 数学公式用 $...$ 或 $$...$$
- 每个分析段落必须独立用 <p> 或 <div> 包裹，严禁多个分析点挤在同一段落
${ebMarkupText}
${(() => {
  const stageMapLocal = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
  return buildCompactAIInstruction(instruction, genType, bookSubject, stageMapLocal[bookStage] || bookStage, bookGrade);
})()}
- 只返回上述结构的 HTML 代码，不要用代码块包裹`;

      try {
        const itemHtml = await callAI(itemPrompt, { 
          taskType: 'generation', 
          temperature: 0.5, 
          timeout: 120000 
        });
        errorItems.push(itemHtml);
      } catch (e) {
        console.warn(`第${i + 1}道错题生成失败:`, e.message);
        errorItems.push(`<div class="error-item"><h3>错题 ${i + 1}：${kp.knowledgePoint}</h3><p>生成失败</p></div>`);
      }
    }
    
    // ✨ 组装完整内容
    statusText.value = '正在组装...';
    progress.value = 90;
    
    // 生成头部
    let header = '';
    try {
      const headerPrompt = `生成错题本头部 HTML：
标题：错题本 - ${selectedBooks?.[0]?.name || '知识点'} 
副标题：涵盖 ${errorProneKps.length} 个易错知识点
包含生成日期 ${new Date().toLocaleDateString()}

用 <h1> 标题，<div class="errorbook-info"> 包裹信息。只返回 HTML。`;

      header = await callAI(headerPrompt, { taskType: 'generation', temperature: 0.3, timeout: 30000 });
    } catch {
      header = `<h1>错题本</h1><div class="errorbook-info"><p>易错知识点整理</p></div>`;
    }
    
    // 生成错误类型统计
    const errorTypeStats = {};
    errorProneKps.forEach(kp => {
      const type = kp.errorType || '概念混淆';
      errorTypeStats[type] = (errorTypeStats[type] || 0) + 1;
    });
    const statsHtml = `<div class="error-stats">
  <h2>📊 错误类型分布</h2>
  <table>
    <tr><th>错误类型</th><th>数量</th><th>占比</th></tr>
    ${Object.entries(errorTypeStats).map(([type, count]) => 
      `<tr><td>${type}</td><td>${count}</td><td>${Math.round(count/errorProneKps.length*100)}%</td></tr>`
    ).join('\n')}
  </table>
</div>`;
    
    const finalContent = header + '\n' + statsHtml + '\n' + errorItems.join('\n');
    
    // 🔧 基础质量校验
    const stageRawHere = bookStage || '';
    const qualityIssues = HardRuleChecker.check(
      finalContent, [], bookSubject, 
      stageMapLocal[stageRawHere] || stageRawHere, bookGrade,
      genType
    );
    const qualityReport = {
      formatCheck: { passed: finalContent.includes('<div class="error-item">'),
        details: finalContent.includes('<div class="error-item">') ? [] : ['缺少错题条目'] },
      coverageCheck: { passed: true, details: [] },
      knowledgeCheck: { passed: finalContent.length > 300, details: [] },
      aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0,
        details: qualityIssues.map(i => i.detail) }
    };
    
    progress.value = 100;
    statusText.value = '生成完成';
    
    return {
      success: true,
      content: finalContent,
      blueprint: '',
      contentCards: [],
      knowledgeMap: {},
      issues: qualityIssues.map(i => i.detail),
      qualityReport,
      generatedQuestions: [],
      parsedBlueprint: []
    };
  };

  const cancelGeneration = async () => {
    if (abortController.value) {
      console.log('🛑 正在发送取消信号...');
      abortController.value.abort();
      // 🔧 注销全局管理器中的控制器
      unregisterController(abortController.value);
      console.log('🛑 已发送取消信号');
    }
    
    // 🔧 立即卸载 Ollama 模型（两步：先 API，再命令行强杀）
    try {
      const config = await getCurrentEngineConfigEnhanced('generation');
      const multimodalConfig = await getMultimodalConfig();
      
      const modelsToUnload = [];
      if (config.engine === 'ollama' && config.textModel) {
        modelsToUnload.push({ name: config.textModel, baseUrl: config.baseUrl });
      }
      if (multimodalConfig.engine === 'ollama' && multimodalConfig.model) {
        if (!modelsToUnload.find(m => m.name === multimodalConfig.model)) {
          modelsToUnload.push({ name: multimodalConfig.model, baseUrl: multimodalConfig.baseUrl });
        }
      }
      
      for (const model of modelsToUnload) {
        statusText.value = `🛑 正在释放显存...`;
        console.log(`🛑 卸载模型: ${model.name}`);
        
        // 方式1：API 请求 keep_alive=0
        try {
          await axios.post(`${model.baseUrl}/api/generate`, {
            model: model.name,
            prompt: '',
            stream: false,
            keep_alive: 0
          }, { timeout: 3000 });
        } catch {
          // API 卸载失败，忽略
        }
        
        // 方式2：命令行强杀模型（更可靠）
        try {
          const { exec } = require('child_process');
          await new Promise((resolve) => {
            exec(`ollama stop ${model.name}`, { timeout: 10000 }, (error, stdout, stderr) => {
              if (error) {
                console.warn(`⚠️ ollama stop ${model.name} 失败:`, error.message);
              } else {
                console.log(`✅ ollama stop ${model.name} 成功:`, stdout?.trim() || stderr?.trim());
              }
              resolve();
            });
          });
        } catch {
          // 命令行卸载失败，忽略
        }
      }
    } catch (e) {
      console.warn('模型卸载失败:', e.message);
    }
    
    // 🔧 重新创建 AbortController，为下次生成做准备
    abortController.value = new AbortController();
    registerController(abortController.value); // 🔧 注册新的控制器
    isGenerating.value = false;
    progress.value = 0;
    statusText.value = '显存已释放';
    setTimeout(() => {
      if (statusText.value === '显存已释放') {
        statusText.value = '';
      }
    }, 2000);
  };

  // ==================== 课前预习专用生成 ====================
  const generatePreview = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    const book = selectedBooks?.[0];
    const rawSubject = book?.subject || '';
    const stageRaw = book?.stage || '';
    const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = normalizeSubjectName(rawSubject, stage);
    const grade = book?.grade || '';

    statusText.value = '构建预习框架...';
    progress.value = 15;

    try {
      // 提取知识点结构作为预习目标参考
      const contentCards = await extractContentCards(
        selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 10 + prog * 0.2; }
      );
      const knowledgeMap = await buildKnowledgeMap(
        contentCards, selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 15 + prog * 0.3; }
      );

      // 🔧 提取 kpList（blueprint 和 Step4 共用）—— 三层数据聚合
      let kpList = (knowledgeMap.knowledgePoints || []).slice(0, 30);
      if (kpList.length === 0) {
        // 降级：从 contentCards 聚合 tags + knowledgePointsForTest
        const fromTags = (contentCards || []).flatMap(c => c.tags || []);
        const fromKpft = (contentCards || []).flatMap(c => (c.knowledgePointsForTest || []).map(k => typeof k === 'string' ? k : k.name));
        kpList = [...new Set([...fromTags, ...fromKpft].filter(Boolean))].slice(0, 30);
      }
      if (kpList.length === 0) {
        const chs = selectedBooks?.[0]?.selectedChapters || [];
        kpList = chs.map(c => c.title).filter(Boolean).slice(0, 15);
      }

      // 🔧 blueprintOnly 模式：仅生成预习框架摘要
      if (blueprintOnly) {
        progress.value = 50;
        statusText.value = '预习蓝图已生成';
        // 🔧 从三维度指令库查询预习结构，替代硬编码
        const previewStructure = getStructureForBlueprint('preview', subject, stage);
        // 🔧 共享层级构建（带智能截断，整本书场景下最多显示30个核心知识点）
        const hierarchyText = buildHierarchyText(knowledgeMap, contentCards, 30);
        // 🔧 提取核心主题
        const coreTopic = contentCards?.[0]?.summary || '';
        const blueprintText = [
          `【课前预习蓝图】`,
          `学科：${subject}  |  年级：${grade}  |  学段：${stageRaw}`,
          `${coreTopic ? '🎯 核心主题：' + coreTopic + '\n' : ''}预习结构：${previewStructure}`,
          `知识点抽样（${kpList.length}个，非穷举）：${kpList.join('、')}`,
          `${hierarchyText ? '\n【知识层级】\n' + hierarchyText : ''}`,
          `预计生成：学习目标2-3条 + 预习任务3-5个 + 预习检测3-5题`
        ].join('\n');
        isGenerating.value = false;
        return {
          success: true,
          blueprint: blueprintText,
          parsedBlueprint: kpList.map((kp, i) => ({ number: i + 1, type: '预习检测', knowledgePoint: kp, difficulty: '基础', score: 5, sourceChapter: grade })),
          contentCards,
          knowledgeMap,
          content: '',
          generatedQuestions: [],
          issues: null,
          qualityReport: null
        };
      }

      // 🔧 四段式精简 Step4 prompt：蓝图驱动 + 精准检索 + 分层注入
      // ① 精准检索原文（替代原来的全量排序截断）——基于蓝图知识点
      const parsedBlueprint_ = kpList.map((kp, i) => ({ number: i + 1, type: '预习检测', knowledgePoint: kp }));
      const textbookContext = retrieveBlueprintSegments(contentCards, parsedBlueprint_, 3000);

      const genInfo = genTypeTemplates[genType];
      const stageLabel = stageRaw || '小学';
      const gradeLabel = grade || '';

      // 🔧 构建资料标题：单课带课名，单元带"第X单元"
      const chapters = book?.selectedChapters || [];
      let titleHint = '';
      if (chapters.length === 1) {
        titleHint = `「${chapters[0].title}」`;
      } else if (chapters.length > 1) {
        const firstTitle = chapters[0].title || '';
        const unitMatch = firstTitle.match(/第([一二三四五六七八九十]+)单元/);
        titleHint = unitMatch ? `第${unitMatch[1]}单元` : `「${firstTitle}等」`;
      }

      statusText.value = '生成课前预习...';
      progress.value = 50;

      const prompt = buildOutputPreamble() + `

【任务】你是一位${stageLabel}${gradeLabel}${subject}教师，请根据以下蓝图和原文，为学生设计一份课前预习资料。

【预习蓝图——⚠️仅供参考，严禁直接复制蓝图数据到输出】
标题：${titleHint ? titleHint + ' ' : ''}${genInfo?.name || '课前预习'}
学科：${subject}  |  年级：${gradeLabel}  |  学段：${stageLabel}
结构：${getStructureForBlueprint('preview', subject, stage)}
知识点（非穷举，请结合教材原文覆盖全部内容）：${kpList.join('、')}

【教材原文片段——⚠️仅供核对知识点准确性，严禁复制原文段落】
${textbookContext || '（基于蓝图知识点生成）'}

【学科要求】
${genInfo?.instruction || '以引导学生自主预习为核心。'}
${(() => {
  if (subject === '语文') {
    return `
- 语文预习四层：识字写字（每个生字独立用<span class="tian-zi-ge">字</span>包裹 + 拼音 + 部首 + 笔画数 + 结构 + 笔顺，多字示例：<span class="tian-zi-ge">蝌</span><span class="tian-zi-ge">蚪</span>）→ 词语积累（释义+多音字+会认/会写区分）→ 句子理解（原文+修辞赏析）→ 段落感知（逐段概括）
- ⚠️ 组词必须是日常常用标准词语，禁止生造（如"袋包""山袋"）
- 课后思考只写问题不附答案
${(() => { const gn = extractGradeNum(grade); return stage === 'primary' && gn <= 2 ? '- 低段：生字配<ruby>汉字<rt>拼音</rt></ruby>，配情境图 [IMAGE]' : ''; })()}`;
  }
  if (subject === '英语') {
    return `
- 英语预习四层：单词认知（从教材单词表中提取，每个单词标注音标+中文释义+词性，按词性分类排列）→ 短语积累（从课文中提取常用搭配，给出中文释义和例句）→ 句型理解（提炼核心句型，标注交际场景如"早上见面用""询问年龄用"，给出替换练习框架）→ 对话/段落感知（概括课文大意，标注关键信息点，引导学生关注上下文逻辑）
- ⚠️ 单词必须来自教材原文单词表或课文中出现的词汇，禁止凭空编造单词
- ⚠️ 中文释义必须准确，禁止逐字硬译（如"Good morning"释义应为"早上好"而非"好的早晨"）
- 句型替换练习留空让学生填写，答案放文末
${(() => { const gn = extractGradeNum(grade); return stage === 'primary' && gn <= 4 ? '- 中段：书写练习配四线三格，配情境图 [IMAGE]，单词配读音提示' : stage === 'primary' ? '- 高段：书写练习用单线，增加句子仿写' : ''; })()}`;
  }
  if (subject === '数学') {
    return `
- 数学预习四层：概念感知（从教材中提取本节核心概念，用生活化语言解释"是什么"，配简单图示说明）→ 算理初探（展示1-2道教材例题的计算过程，标注每一步的含义和依据，引导学生理解"为什么这样算"）→ 方法归纳（总结解题步骤/公式/口诀，用"第一步…第二步…"的形式呈现）→ 尝试练习（2-3道基础题，与例题同类型但数据不同，留空让学生试做）
- ⚠️ 概念解释必须用学生能理解的语言，禁止照搬教材定义
- ⚠️ 例题必须来自教材原文或教材同类题型，禁止超纲编造
- 尝试练习题留空，答案放文末
${(() => { const gn = extractGradeNum(grade); return stage === 'primary' && gn <= 2 ? '- 低段：配实物图/情境图 [IMAGE]，数字不超100，仅加减法' : stage === 'primary' ? '- 中高段：配线段图/示意图，增加估算和验算提示' : ''; })()}`;
  }
  if (['物理', '化学', '生物', '科学'].includes(subject)) {
    return `
- 理科预习四层：概念预读（从教材中提取核心概念/定义/公式，标注关键词，用通俗语言解释含义）→ 实验/现象观察（如教材有实验，描述实验步骤和预期现象，引导学生思考"为什么会这样"；如无实验则描述生活中的相关现象）→ 原理初探（解释概念背后的基本原理，用因果链"因为…所以…"的方式呈现）→ 预习自测（2-3道基础判断题或填空题，考查概念理解，留空让学生试做）
- ⚠️ 概念/公式/定理必须与教材原文一致，禁止自行修改
- ⚠️ 实验步骤必须来自教材，禁止编造
- 预习自测留空，答案放文末`;
  }
  return '';
})()}
- 预习检测：${stage === 'primary' ? '5-8道' : '3-5道'}基础题，题目留空不写答案
- 🔴 铁律：答案统一放文末<div class="answer-section">中，题目绝不出现答案
- 语言适合${gradeLabel}学生，预习时间10-15分钟

${buildCompactAIInstruction(instruction, genType, subject, stage, grade)}

【格式规范——必须严格遵守】
${(() => { const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject, stage, genType }); return fmtBlocks.length > 0 ? fmtBlocks.map(b => b.content).join('\n') + '\n' : ''; })()}- ⚠️ 输出必须是完整的HTML代码，每个板块、每个条目都要有独立的HTML标签包裹
- 🔴 每个板块必须输出具体内容（含例句/例题/释义），禁止写"略""见教材""自行查阅"等占位符
- 大标题用 <h1>，板块标题（一、二、三）用 <h2>
- 每个条目用 <p> 或 <li> 包裹，禁止所有条目挤在一行！
- 需要换行用 <br>，段落间用空行分隔
${subject === '语文' ? `
【语文学科格式】
- 生字展示：每个生字独立一个 <span class="tian-zi-ge">字</span>，多字示例 <span class="tian-zi-ge">蝌</span><span class="tian-zi-ge">蚪</span>，⚠️ 严禁多个字共用一个 tian-zi-ge
- ⛔ 禁止在田字格/米字格/四线三格 span 之后添加 <br> 或空行留白（尤其表格单元格内）——格子单元格高度由格子本身撑起，多余 <br> 会导致单元格多行换行、格子顶格
- 🔴 生字必须附带部首、笔画数、结构、笔顺，格式示例：
  <p><span class="tian-zi-ge">蝌</span>（部首：虫，15画，左右结构，笔顺：竖、横折、横、竖、横、点、撇、横、竖、撇、点、横、竖、横）</p>
- ⛔ 禁止只写字和拼音不写部首/笔画/笔顺！每个生字都要有完整的部首、笔画数、结构和笔顺信息
- 词语释义：<strong>词语</strong>：释义内容
- 句子赏析：<div class="example"><p>原文句子</p><p>赏析：...</p></div>
- 🔴 看拼音写词语格式：<p>kē dǒu <u class="blank-2">&emsp;</u> &emsp; dài shǔ <u class="blank-2">&emsp;</u></p>（只写拼音不写汉字！）
- 课后思考只写问题不附答案
` : ''}${subject === '英语' ? `
【英语学科格式】
- 🔤 第一层·单词认知：每个单词用 <p><strong>单词</strong> <span class="phonetic">/音标/</span> <em>词性</em> 中文释义</p>
- 📝 第二层·短语积累：<div class="phrase-group"><p><strong>短语</strong>：中文释义</p><p class="example">例句</p></div>
- 📐 第三层·句型理解：核心句型用 <div class="sentence-pattern"><p class="model">句型结构</p><p class="example">例句</p><p class="usage">交际场景：...</p><p class="drill">替换练习：<u class="blank-4">&emsp;</u>（留空）</p></div>
- 📖 第四层·段落/对话感知：<div class="passage-summary"><p><strong>大意</strong>：...</p><p><strong>关键信息</strong>：...</p></div>
- ${stage === 'primary' && extractGradeNum(grade) <= 4 ? '书写区用 <span class="four-line-three english-line">word</span> 四线三格' : '书写区用单线 <span class="english-line">word</span>'}
- 单词必须从教材原文单词表提取，中文释义必须准确（禁止逐字硬译）
- 句型交际场景必须具体（"早上见面"而非"问候"），替换练习留空` : ''}${['数学', '物理', '化学', '生物', '科学'].includes(subject) ? `
【理科格式】
- 概念定义用 <div class="definition">，公式用 <div class="formula">$...$</div>
- 口算题用 <span class="oral-box">算式</span>
- 竖式计算用 <div class="vertical-calc">，例题必须给出完整解题步骤
${['物理', '化学', '生物', '科学'].includes(subject) ? '- 实验步骤用 <div class="experiment-steps"><ol><li>步骤</li></ol></div>，实验现象用 <strong>加粗</strong> 标注\n' : ''}` : ''}
- 🔴 填空题格式：<p>题干<u class="blank-2">&emsp;</u>题干</p>（横线留空不填答案！）
- 🔴 括号填空格式：<span class="blank-N">&emsp;</span>（N按答案字数：1字→2, 2字→3, 3字→4, 4字→5, 5-6字→6, 7-8字→8, 9-10字→10，⛔严禁括号内用 <u> 标签）
- 答案统一放文末 <div class="answer-section"><h2>答案与提示</h2>...</div>
- ⛔ 严禁：题目中直接写答案、所有内容挤在一个段落、用空格代替换行
${(() => { const gn = extractGradeNum(grade); return stage === 'primary' && gn <= 2 ? '- 低段配插图：[IMAGE]\nTYPE:SD\nPROMPT:描述\nSTYLE:cartoon\n[/IMAGE]\n' : ''; })()}

【强制输出格式——最后一条指令】
你必须输出标准HTML代码。每个标题、每个段落、每个条目都必须用独立的HTML标签包裹。不允许纯文本输出。

${buildOutputFormatBlock('preview', subject, stage, grade)}

现在请直接输出完整的预习资料HTML：`;

      const result = await callAI(prompt, {
        taskType: 'generation',
        temperature: 0.3,
        timeout: 120000,
        signal: abortController.value?.signal
      });
      detectSquishedOutput(result, 'preview');

      // 🔧 质量校验
      statusText.value = '校验预习资料质量...';
      progress.value = 85;
      const qualityIssues = HardRuleChecker.check(
        result, [], subject,
        stageMap[stageRaw] || stageRaw, grade,
        genType
      );
      const qualityReport = {
        formatCheck: { passed: result.length > 200, details: result.length <= 200 ? ['内容过短'] : [] },
        coverageCheck: { passed: true, details: [`知识点参考：${(knowledgeMap.knowledgePoints || []).slice(0, 5).join('、')}`] },
        knowledgeCheck: { passed: result.length > 500, details: qualityIssues.filter(i => i.severity === 'error').map(i => i.detail) },
        aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0, details: qualityIssues.map(i => i.detail) }
      };

      // 🔧 超纲检测
      const boundaryCheck = checkKnowledgeBoundary(result, subject, stageRaw, grade);
      if (boundaryCheck.hasViolations) {
        qualityReport.knowledgeCheck.passed = false;
        qualityReport.knowledgeCheck.details.push(`超纲检测发现${boundaryCheck.summary.errorCount}处问题`);
      }

      progress.value = 100;
      statusText.value = '生成完成';
      isGenerating.value = false;
      return {
        success: true,
        content: result,
        blueprint: '',
        contentCards,
        knowledgeMap,
        generatedQuestions: [],
        parsedBlueprint: [],
        issues: qualityIssues.map(i => i.detail),
        qualityReport
      };
    } catch (e) {
      console.error('课前预习生成失败:', e);
      return { success: false, error: e.message };
    } finally {
      isGenerating.value = false;
    }
  };

  // ==================== 听写默写专用生成 ====================
  const generateDictation = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    const book = selectedBooks?.[0];
    const rawSubject = book?.subject || '';
    const stageRaw = book?.stage || '';
    const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = normalizeSubjectName(rawSubject, stage);
    const grade = book?.grade || '';

    statusText.value = '提取教材生字词...';
    progress.value = 20;

    try {
      // 提取教材原文
      const contentCards = await extractContentCards(
        selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 10 + prog * 0.2; }
      );

      // 🔧 提取 kpList（blueprint 和 Step4 共用）—— 三层数据聚合，覆盖课文全文
      let kpList = [];
      if (contentCards && contentCards.length > 0) {
        const fromTags = contentCards.flatMap(c => c.tags || []);
        const fromKpft = contentCards.flatMap(c => (c.knowledgePointsForTest || []).map(k => typeof k === 'string' ? k : k.name));
        const fromSummary = contentCards.map(c => c.summary).filter(Boolean);
        const chapterTitles = (book?.selectedChapters || []).map(c => c.title).filter(Boolean);
        // 三层聚合 + 章节标题，去重后上限30（覆盖课文核心词汇+短语+句型）
        kpList = [...new Set([...fromTags, ...fromKpft, ...fromSummary, ...chapterTitles].filter(Boolean))].slice(0, 30);
      }
      if (kpList.length === 0) {
        const chapterTitles = (book?.selectedChapters || []).map(c => c.title).filter(Boolean);
        kpList = chapterTitles.slice(0, 15);
      }

      // 🔧 blueprintOnly 模式：从 contentCards 提取词汇，走完整分析链路
      if (blueprintOnly) {
        progress.value = 50;
        statusText.value = '听写蓝图已生成';
        // 🔧 从三维度指令库查询听写结构，替代硬编码
        const dictationStructure = getStructureForBlueprint('dictation', subject, stage);
        const dictationTypeLabel = subject === '英语' ? '单词/短语听写' : (subject === '语文' ? '生字词默写' : '听写/默写');
        // 🔧 共享层级构建（dictation 无 knowledgeGraph，自动降级用 contentCards）
        const hierarchyText = buildHierarchyText({ knowledgeGraph: [] }, contentCards, 30);
        const blueprintText = [
          `【听写/默写蓝图】`,
          `学科：${subject}  |  年级：${grade}  |  学段：${stageRaw}`,
          `类型：${dictationTypeLabel}`,
          `练习结构：${dictationStructure}`,
          `词汇抽样（${kpList.length}个，非穷举）：${kpList.join('、')}`,
          `${hierarchyText ? '\n【知识覆盖层级】\n' + hierarchyText : ''}`
        ].join('\n');
        isGenerating.value = false;
        return {
          success: true,
          blueprint: blueprintText,
          parsedBlueprint: kpList.map((kp, i) => ({ number: i + 1, type: '听写', knowledgePoint: kp, difficulty: '基础', score: 2, sourceChapter: grade })),
          contentCards,
          knowledgeMap: { knowledgePoints: kpList, keyDifficulties: [], knowledgeGraph: [], crossChapterLinks: [] },
          content: '',
          generatedQuestions: [],
          issues: null,
          qualityReport: null
        };
      }

      // 🔧 精准检索原文（五步法：Step1已提取，Step4只需少量精确原文验证，上限1200字）
      const parsedBlueprint_ = kpList?.map((kp, i) => ({ number: i + 1, type: '听写', knowledgePoint: kp })) || [];
      const textbookContext = retrieveBlueprintSegments(contentCards, parsedBlueprint_, 1200);

      const genInfo = genTypeTemplates[genType];
      const stageLabel = stageRaw || '小学';
      const gradeLabel = grade || '';
      const isEnglish = subject === '英语';

      // 🔧 构建资料标题
      const chapters = book?.selectedChapters || [];
      let titleHint = '';
      if (chapters.length === 1) {
        titleHint = `「${chapters[0].title}」`;
      } else if (chapters.length > 1) {
        const firstTitle = chapters[0].title || '';
        const unitMatch = firstTitle.match(/第([一二三四五六七八九十]+)单元/);
        titleHint = unitMatch ? `第${unitMatch[1]}单元` : `「${firstTitle}等」`;
      }

      statusText.value = '生成听写/默写内容...';
      progress.value = 50;

      const prompt = buildOutputPreamble() + `

【任务】你是一位${stageLabel}${gradeLabel}${subject}教师，请设计一份学生可直接使用的听写/默写练习纸。必须包含多种题型，练习区只显示提示+留空（学生填写），答案统一放文末。

🎯 关键原则：
- 练习区 = 提示+留空（学生填写区），答案区 = 标准答案（文末）
- 必须包含至少2种不同题型方向（如英译汉+汉译英、挖空+翻译等），不能全是一种形式
- 每一题都是学生要动手写的，不能只是"听"

【蓝图——⚠️仅供参考，严禁直接复制蓝图数据到输出】
标题：${titleHint ? titleHint + ' ' : ''}${genInfo?.name || '听写默写'}
结构：${getStructureForBlueprint('dictation', subject, stage)}
词汇示例（非穷举，请覆盖课文全部词汇+短语+句型）：${kpList.join('、')}
⚠️ 以上仅为知识点抽样示例，你必须结合【教材原文片段】覆盖课文出现的所有词汇、短语和句型，不限于上述示例

【教材原文片段——⚠️仅供核对知识点准确性，严禁复制原文段落】
${textbookContext || '（基于蓝图知识点生成）'}

【学科要求】
${isEnglish
  ? `- 英语默写练习纸，必须包含以下多种题型（至少3种，分节清晰标注标题）：
  ① 英译汉（看英文写中文）：给出英文单词/短语，学生写中文释义
  ② 汉译英（看中文写英文）：给出中文释义+词性提示，学生写英文单词/短语
  ③ 单词挖空默写：给出单词的部分字母提示（如 h_llo、_at、c_t），学生补全缺失字母；挖去关键字母（元音或易错辅音），保留首字母或部分字母作线索
  ④ 句子默写（汉译英）：给出完整中文句子，学生写出对应英文句子
  ⑤ 句子默写（英译汉）：给出英文句子，学生写出中文意思
- ⛔ 关键防漏题规则：每个词汇/短语/句子只能出现在一种题型中，严禁同一内容在多个题型间重复出现（如 hello 出现在英译汉就不能再出现在汉译英或挖空中，否则学生能从其他题型直接抄答案）
- 词汇按难度分配到不同题型：简单词→英译汉，中等词→汉译英，较难词→挖空默写
- 书写区用${stage === 'primary' && extractGradeNum(grade) <= 4 ? '四线三格' : '单线'}留空，不写答案内容
- 难度递增，同一题型内由易到难排列`
  : subject === '语文'
    ? `- 语文默写练习纸：每个生字给出拼音提示，书写区用田字格留空（学生填字）\n- 词语默写给出拼音，词语书写区留空\n- 句子/古诗文默写给出上句/标题提示，下句或全文留空\n- 每个生字附加部首、笔画、结构、笔顺信息（字典式标注，在字旁独立列出）`
    : `- 学科默写练习纸：给出概念/公式/术语提示，答案区留空给学生填写`}
- 题量：字词${stage === 'primary' ? '8-15' : '10-20'}个，句子${stage === 'primary' ? '2-4' : '3-5'}句
- 答案集中放文末<div class="answer-section">中，练习区不出现答案
- 适合${gradeLabel}水平

${buildCompactAIInstruction(instruction, genType, subject, stage, grade)}

【格式规范——必须严格遵守】
${(() => { const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject, stage, genType }); return fmtBlocks.length > 0 ? fmtBlocks.map(b => b.content).join('\n') + '\n' : ''; })()}- 🔴 每个板块必须输出具体内容，禁止写"略""见教材""自行查阅"等占位符或空写"听录音写单词"而无具体单词列表
- 输出必须是完整HTML，每个条目用 <p> 或 <div class="dictation-item"> 独立包裹
- 大标题用 <h1>，分节用 <h2>
- 参考答案统一放文末 <div class="answer-section">
- ⛔ 严禁所有内容挤在一个段落
${subject === '语文' && stage === 'primary' ? '【语文学科格式】\n生字用<span class="tian-zi-ge">字</span>（HTML），情境图[IMAGE]单独成行\n' : ''}${isEnglish ? `【英语学科格式】
- 写英文用：${stage === 'primary' && extractGradeNum(grade) <= 4 ? '<span class="four-line-three english-line">word</span> 四线三格' : '<span class="english-line">word</span> 单线'}
- 写中文用：<span class="blank-line">&emsp;&emsp;</span> 普通横线（禁止四线格/田字格）
- 每个单词给出中文释义和词性
` : ''}${['数学', '物理', '化学'].includes(subject) ? '【理科格式】\n- 算式书写工整，竖式计算用 <div class="vertical-calc">\n' : ''}

【强制输出格式——最后一条指令】
你必须输出标准HTML代码。不允许纯文本输出。

${buildOutputFormatBlock('dictation', subject, stage, grade)}

现在请直接输出完整的听写默写练习HTML：`;

      const result = await callAI(prompt, {
        taskType: 'generation',
        temperature: 0.2,
        timeout: 120000,
        signal: abortController.value?.signal
      });
      detectSquishedOutput(result, 'dictation');

      // 🔧 质量校验
      statusText.value = '校验听写内容质量...';
      progress.value = 85;
      const qualityIssues = HardRuleChecker.check(
        result, [], subject,
        stageMap[stageRaw] || stageRaw, grade,
        genType
      );
      const qualityReport = {
        formatCheck: { passed: result.length > 100, details: result.length <= 100 ? ['内容过短'] : [] },
        coverageCheck: { passed: true, details: [] },
        knowledgeCheck: { passed: result.length > 300, details: qualityIssues.filter(i => i.severity === 'error').map(i => i.detail) },
        aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0, details: qualityIssues.map(i => i.detail) }
      };

      progress.value = 100;
      statusText.value = '生成完成';
      isGenerating.value = false;
      return {
        success: true,
        content: result,
        blueprint: '',
        contentCards,
        knowledgeMap: { knowledgePoints: [], keyDifficulties: [], knowledgeGraph: [], crossChapterLinks: [] },
        generatedQuestions: [],
        parsedBlueprint: [],
        issues: qualityIssues.map(i => i.detail),
        qualityReport
      };
    } catch (e) {
      console.error('听写默写生成失败:', e);
      return { success: false, error: e.message };
    } finally {
      isGenerating.value = false;
    }
  };

  // ==================== 阅读训练专用生成 ====================
  const generateReading = async (instruction, genType, selectedBooks, selectedTemplates, blueprintOnly = false) => {
    const book = selectedBooks?.[0];
    const rawSubject = book?.subject || '';
    const stageRaw = book?.stage || '';
    const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
    const stage = stageMap[stageRaw] || stageRaw;
    const subject = normalizeSubjectName(rawSubject, stage);
    const grade = book?.grade || '';

    statusText.value = '提取教材阅读素材...';
    progress.value = 20;

    try {
      const contentCards = await extractContentCards(
        selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 10 + prog * 0.2; }
      );
      const knowledgeMap = await buildKnowledgeMap(
        contentCards, selectedBooks, callAI, robustJsonParse,
        (text, prog) => { statusText.value = text; progress.value = 15 + prog * 0.3; }
      );

      // 🔧 三层数据聚合（blueprint 和 Step4 共用），上限30
      let kpList = (knowledgeMap.knowledgePoints || []).slice(0, 30);
      if (kpList.length === 0) {
        const fromTags = (contentCards || []).flatMap(c => c.tags || []);
        const fromKpft = (contentCards || []).flatMap(c => (c.knowledgePointsForTest || []).map(k => typeof k === 'string' ? k : k.name));
        kpList = [...new Set([...fromTags, ...fromKpft].filter(Boolean))].slice(0, 30);
      }
      if (kpList.length === 0) {
        const chs = selectedBooks?.[0]?.selectedChapters || [];
        kpList = chs.map(c => c.title).filter(Boolean).slice(0, 15);
      }

      // 🔧 blueprintOnly 模式：仅生成阅读训练框架摘要
      if (blueprintOnly) {
        progress.value = 50;
        statusText.value = '阅读训练蓝图已生成';
        // 🔧 共享层级构建（带智能截断）
        const hierarchyText = buildHierarchyText(knowledgeMap, contentCards, 30);
        const readingLength = stage === 'primary' ? '200-400字' : stage === 'middle' ? '400-800字' : '600-1200字';
        const coreTopic = contentCards?.[0]?.summary || '';
        // 🔧 从三维度指令库查询阅读结构，替代硬编码
        const readingStructure = getStructureForBlueprint('reading', subject, stage);
        const blueprintText = [
          `【阅读训练蓝图】`,
          `学科：${subject}  |  年级：${grade}  |  学段：${stageRaw}`,
          `${coreTopic ? '🎯 核心主题：' + coreTopic + '\n' : ''}训练结构：${readingStructure}`,
          `选文篇幅：${readingLength}  |  选文数：1-2篇`,
          `知识点抽样（${kpList.length}个，非穷举）：${kpList.join('、')}`,
          `${hierarchyText ? '\n【知识覆盖层级】\n' + hierarchyText : ''}`,
          `题目类型：信息提取、词句理解、主旨概括、推理判断${stage !== 'primary' ? '、评价鉴赏' : ''}`
        ].join('\n');
        isGenerating.value = false;
        return {
          success: true,
          blueprint: blueprintText,
          parsedBlueprint: kpList.map((kp, i) => ({ number: i + 1, type: '阅读理解', knowledgePoint: kp, difficulty: '中等', score: 5, sourceChapter: grade })),
          contentCards,
          knowledgeMap,
          content: '',
          generatedQuestions: [],
          issues: null,
          qualityReport: null
        };
      }

      // 🔧 精准检索原文
      const kpListForRetrieval = (knowledgeMap.knowledgePoints || []).map(kp => ({ number: 0, knowledgePoint: kp }));
      const textbookContext = retrieveBlueprintSegments(contentCards, kpListForRetrieval, 3000);

      const genInfo = genTypeTemplates[genType];
      const stageLabel = stageRaw || '小学';
      const gradeLabel = grade || '';

      // 🔧 构建资料标题
      const chapters = book?.selectedChapters || [];
      let titleHint = '';
      if (chapters.length === 1) {
        titleHint = `「${chapters[0].title}」`;
      } else if (chapters.length > 1) {
        const firstTitle = chapters[0].title || '';
        const unitMatch = firstTitle.match(/第([一二三四五六七八九十]+)单元/);
        titleHint = unitMatch ? `第${unitMatch[1]}单元` : `「${firstTitle}等」`;
      }

      statusText.value = '生成阅读训练...';
      progress.value = 50;

      const prompt = buildOutputPreamble() + `

【任务】你是一位${stageLabel}${gradeLabel}${subject}教师，请根据以下蓝图和原文，设计一份阅读理解训练。

【训练蓝图——⚠️仅供参考，严禁直接复制蓝图数据到输出】
标题：${titleHint ? titleHint + ' ' : ''}${genInfo?.name || '阅读训练'}
结构：${getStructureForBlueprint('reading', subject, stage)}
知识点（非穷举，请结合教材原文覆盖全部内容）：${kpList.join('、')}

【教材原文片段——⚠️仅供核对知识点准确性，严禁复制原文段落】
${textbookContext || '（基于蓝图知识点编选短文）'}

【学科要求】
${genInfo?.instruction || '以阅读理解能力训练为核心。'}
- 选文：${stage === 'primary' ? '200-400字' : stage === 'middle' ? '400-800字' : '600-1200字'}，主题贴近教材
- 文体：${subject === '语文' ? '记叙文/说明文/童话/寓言/散文' : subject === '英语' ? '对话/短文/故事/书信' : '根据学科选择'}
- 题目覆盖：信息提取、词句理解、主旨概括、推理判断${stage !== 'primary' ? '、评价鉴赏、写作手法分析' : ''}
- 题型：选择题${stage === 'primary' ? '40%' : '30%'}+简答题${stage === 'primary' ? '60%' : '70%'}，${(() => { const gn = extractGradeNum(grade); const ratio = getStageDifficultyRatio(stage, gn > 0 && gn <= 2, gn >= 3 && gn <= 4, gn >= 5, genType); return ratio ? `基础${ratio.basic}%/提升${ratio.medium}%/拓展${ratio.advanced}%` : '基础50%/提升30%/拓展20%'; })()}
${subject === '英语' ? '- 英语阅读：生词需给出中文释义，短文须是完整的独立英文文章（不能是\u201c请阅读教材第X页\u201d）\n' : ''}${stage === 'primary' && extractGradeNum(grade) <= 2 ? '- 低段：童话/寓言，配插图，语言通俗\n' : ''}- 答案统一放文末<div class="answer-section">中

${buildCompactAIInstruction(instruction, genType, subject, stage, grade)}

【格式规范——必须严格遵守】
${(() => { const fmtBlocks = getMatchingBlockInstructions({ category: '生成-输出格式', subject, stage, genType }); return fmtBlocks.length > 0 ? fmtBlocks.map(b => b.content).join('\n') + '\n' : ''; })()}- 输出必须是完整HTML，短文用 <div class="reading-passage">，题目用 <ol><li>
- 大标题用 <h1>，分节用 <h2>
- 选择题选项用 <p class="option">
- 参考答案统一放文末 <div class="answer-section">
- ⛔ 严禁所有内容挤在一个段落

【强制输出格式——最后一条指令】
你必须输出标准HTML代码。不允许纯文本输出。

${buildOutputFormatBlock('reading', subject, stage, grade)}

现在请直接输出完整的阅读训练HTML：`;

      const result = await callAI(prompt, {
        taskType: 'generation',
        temperature: 0.3,
        timeout: 180000,
        signal: abortController.value?.signal
      });
      detectSquishedOutput(result, 'reading');

      // 🔧 质量校验
      statusText.value = '校验阅读训练质量...';
      progress.value = 85;
      const qualityIssues = HardRuleChecker.check(
        result, [], subject,
        stageMap[stageRaw] || stageRaw, grade,
        genType
      );
      const qualityReport = {
        formatCheck: { passed: result.length > 300, details: result.length <= 300 ? ['内容过短'] : [] },
        coverageCheck: { passed: true, details: [`知识点参考：${(knowledgeMap.knowledgePoints || []).slice(0, 5).join('、')}`] },
        knowledgeCheck: { passed: result.length > 500, details: qualityIssues.filter(i => i.severity === 'error').map(i => i.detail) },
        aiReview: { passed: qualityIssues.filter(i => i.severity === 'error').length === 0, details: qualityIssues.map(i => i.detail) }
      };

      // 🔧 超纲检测
      const boundaryCheck = checkKnowledgeBoundary(result, subject, stageRaw, grade);
      if (boundaryCheck.hasViolations) {
        qualityReport.knowledgeCheck.passed = false;
        qualityReport.knowledgeCheck.details.push(`超纲检测发现${boundaryCheck.summary.errorCount}处问题`);
      }

      progress.value = 100;
      statusText.value = '生成完成';
      isGenerating.value = false;
      return {
        success: true,
        content: result,
        blueprint: '',
        contentCards,
        knowledgeMap,
        generatedQuestions: [],
        parsedBlueprint: [],
        issues: qualityIssues.map(i => i.detail),
        qualityReport
      };
    } catch (e) {
      console.error('阅读训练生成失败:', e);
      return { success: false, error: e.message };
    } finally {
      isGenerating.value = false;
    }
  };

  // ✨ 新增：基于已有蓝图执行第四步和第五步
  const executeGenerationWithBlueprint = async (
    instruction, genType, selectedBooks, selectedTemplates,
    blueprint, contentCards, knowledgeMap
  ) => {
    // 🔧 每次生成前创建新的 AbortController，并注册到全局管理器
    if (abortController.value) {
      unregisterController(abortController.value);
    }
    abortController.value = new AbortController();
    registerController(abortController.value);
    isGenerating.value = true;
    progress.value = 60;
    
    try {
      // 从指令中提取总分（课时练无总分，不硬编码兜底值）
      let totalScore = 0;
      const scoreMatch = instruction.match(/总分[：:]\s*(\d+)/);
      if (scoreMatch) totalScore = parseInt(scoreMatch[1]);

      // 解析蓝图
      let parsedBlueprint = [];
      try {
        const parsePrompt = `请将以下命题蓝图解析为JSON数组，每个元素代表一道题：

      ${blueprint}

      返回格式：
      [
        {
          "number": 1,
          "type": "选择题|填空题|解答题|...",
          "knowledgePoint": "考查的知识点",
          "difficulty": "基础|中等|较难",
          "score": 分值数字,
          "sourceChapter": "对应的课文/章节"
        }
      ]

      只返回JSON数组，不要其他内容。`;

        const parseResult = await callAI(parsePrompt);
        parsedBlueprint = await robustJsonParse(
          parseResult,
          (retryPrompt) => callAI(retryPrompt, { temperature: 0.1 }),
          '蓝图解析(确认模式)'
        );
        console.log('✅ 蓝图解析成功，共', parsedBlueprint.length, '题');
      } catch (e) {
        console.warn('蓝图解析失败，将使用传统方式生成:', e.message);
      }

      // 逐题生成
      let content = '';
      const generatedQuestions = [];

      if (parsedBlueprint.length > 0) {
        const totalQuestions = parsedBlueprint.length;
  
        // ✨ 生成情境锚点（统一情境风格的基石）
        let situationAnchor = '';
        const styleMatch = instruction.match(/命题风格[：:]\s*([^\n]+)/);
        const styleText = styleMatch ? styleMatch[1] : '';
        if (styleText.includes('统一情境') || styleText.includes('情境融合') || styleText.includes('unified_context') || styleText.includes('context_fusion')) {
          try {
            const anchorPrompt = `请为以下试卷设计一个贯穿全卷的统一情境/主题故事。
学科：${selectedBooks?.[0]?.subject || ''}
年级：${selectedBooks?.[0]?.grade || ''}
总题数：${totalQuestions}
知识点：${parsedBlueprint.map(q => q.knowledgePoint).slice(0, 5).join('、')}

要求：
1. 取一个情境名称（15字以内）
2. 描述情境背景（50字以内）
3. 列出3-5个可用于不同题目的场景元素

返回JSON：{"name":"情境名称","background":"情境背景","scenes":["场景1","场景2"]}`;

            const anchorResult = await callAI(anchorPrompt, { temperature: 0.5 });
            try {
              const anchor = await robustJsonParse(anchorResult, null, '情境锚点');
              situationAnchor = `【统一情境：${anchor.name}】背景：${anchor.background}。可用场景：${(anchor.scenes || []).join('、')}。请在此情境下命制本题，保持与前后题目的叙事连贯性。`;
            } catch {
              // 情境生成失败不阻塞
            }
          } catch (e) {
            console.warn('情境锚点生成失败:', e.message);
          }
        }

        // ✨ 收集已生成题目摘要，作为上下文传给后续题目
        let generatedContext = [];

        for (let i = 0; i < totalQuestions; i++) {
          const questionPlan = parsedBlueprint[i];
    
          const genConfig2 = await getCurrentEngineConfigEnhanced('generation');
          const genModelName2 = getModelDisplayName(genConfig2.textModel || genConfig2.model);
          statusText.value = `生成第${i+1}/${totalQuestions}题 [${genModelName2}]...`;
          progress.value = 60 + Math.round((i / totalQuestions) * 25);

          // ✨ 构建已生成题目的上下文摘要
          let contextSummary = generatedContext.length > 0
            ? `【已生成题目，请避免知识点重复】\n${generatedContext.join('\n')}\n`
            : '';

          // 🔧 新增：统计已生成题目的句式特征，确保全局风格一致
          let styleConsistencyHint = '';
          if (generatedContext.length > 2) {
            const recentQuestions = generatedQuestions.slice(-3);
            const sentenceStarts = [];
            const optionCounts = [];
            
            for (const q of recentQuestions) {
              const plainText = q.replace(/<[^>]+>/g, '').trim();
              const startMatch = plainText.match(/^\d+[\.、．]\s*(.{1,20})/);
              if (startMatch) {
                sentenceStarts.push(startMatch[1]);
              }
              const optionCount = (q.match(/<p class="option"/g) || []).length;
              if (optionCount > 0) {
                optionCounts.push(optionCount);
              }
            }
            
            if (sentenceStarts.length >= 2) {
              const allSame = sentenceStarts.every(s => 
                sentenceStarts[0].substring(0, 2) === s.substring(0, 2)
              );
              if (allSame) {
                styleConsistencyHint = `⚠️ 【句式雷同警告——你必须打破此模式】前几题的句式开头高度雷同（均以"${sentenceStarts[0].substring(0, 12)}"开头）。本题必须使用与前几题完全不同的设问方式和句式结构！禁止再用相同句式开头！`;
              }
            }
            
            if (optionCounts.length >= 2) {
              const avgOptions = Math.round(optionCounts.reduce((a, b) => a + b, 0) / optionCounts.length);
              if (optionCounts.every(c => c === optionCounts[0])) {
                styleConsistencyHint += `\n⚠️ 【选项结构雷同警告】前几题选择题全部是${optionCounts[0]}个选项，本题必须打破此模式——改变选项数量或改用非选择题型！`;
              }
            }
          }
    
          // ========== 🔧 优化：动态上下文窗口管理 ==========
          // 定义上下文预算（根据模型能力调整，qwen2.5:14b 建议预留 4000 tokens 给核心指令和输出）
          const MAX_CONTEXT_TOKENS = 5000;
          
          // 为各模块分配预算
          const MATERIAL_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.45);   // 教材原文最多45%
          const TEMPLATE_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.30);   // 模板样本最多30%
          const SUMMARY_BUDGET = Math.floor(MAX_CONTEXT_TOKENS * 0.15);    // 已生成摘要最多15%
          // 剩余10%留给其他固定内容

          // ========== 1. 教材原文：分级提供（优先保证核心段完整）==========
          let materialContext = '';
          
          if (questionPlan.knowledgePoint) {
            const relatedSegments = semanticRetriever.findRelevant(
              questionPlan.knowledgePoint,
              8  // 先多取几段，给分级函数更多选择
            );
            
            if (relatedSegments.length > 0) {
              // 🔧 使用分级构建函数，优先保证核心段完整性
              const gradedMaterial = buildGradedMaterialContext(relatedSegments, MATERIAL_BUDGET);
              materialContext = gradedMaterial.fullContext;
              
              if (materialContext) {
                const coreCount = (gradedMaterial.coreText.match(/\n\[/g) || []).length;
                const extCount = (gradedMaterial.extendedText.match(/\n\[/g) || []).length;
                console.log(`📚 题${questionPlan.number} 教材上下文：核心${coreCount}段 + 扩展${extCount}段`);
              } else {
                materialContext = ''; // 没有有效内容，清空
              }
            }
          }
          
          // 降级：如果语义检索没有结果，使用章节原文（交由 buildGradedMaterialContext 控制长度）
          if (!materialContext && questionPlan.sourceChapter) {
            const relatedCard = contentCards.find(c => c.chapterTitle === questionPlan.sourceChapter);
            if (relatedCard && (relatedCard._fullChapterText || relatedCard.rawText || relatedCard.summary)) {
              const sourceText = relatedCard._fullChapterText || relatedCard.rawText || relatedCard.summary;
              // 对降级原文也做分段，让 buildGradedMaterialContext 按 token 预算动态截取
              const fallbackSegments = splitTextIntoSegments(sourceText, 500).map(seg => ({
                chapterTitle: relatedCard.chapterTitle,
                text: seg,
                type: '正文',
                isKeyConcept: false,
                isExample: false,
                isExercise: false
              }));
              const gradedFallback = buildGradedMaterialContext(fallbackSegments, MATERIAL_BUDGET);
              materialContext = gradedFallback.fullContext || `【教材参考】\n${sourceText.substring(0, Math.floor(MATERIAL_BUDGET * 1.5))}\n`;
            }
          }

          // ========== 2. 模板样本：按预算截取 ==========
          let templateContext = '';
          let templateTokens = 0;
          const templateCards = selectedTemplates?.[0]?.analysis?.questionCards || [];
          
          if (templateCards.length > 0) {
            const MAX_SAMPLES = 2;
            const templateSamples = findBestTemplateSamples(templateCards, questionPlan, MAX_SAMPLES);
            
            if (templateSamples.length > 0) {
              templateContext = `\n【模板参考题——以下为模板典型题目，供参考风格和结构】\n`;
              let sampleCount = 0;
              
              for (let si = 0; si < templateSamples.length; si++) {
                const card = templateSamples[si];
                
                let cardText = `\n=== 模板真题${si + 1}（${card.type}，${card.difficulty || '?'}难度，${card.score || '?'}分）===\n`;
                
                // 🔧 修复：优先使用完整题干，不截断
                // 原因：截断后AI无法看到完整的设问方式，影响风格对标
                let stem = card.stem || '';
                
                // 如果题干过长，尝试智能截断（在自然断点处）
                const maxStemChars = Math.floor((TEMPLATE_BUDGET / MAX_SAMPLES) * 0.8);
                if (stem.length > maxStemChars) {
                  // 尝试在句号、问号、感叹号处截断
                  const naturalBreaks = ['。', '？', '！', '?', '!'];
                  let breakIndex = -1;
                  
                  for (const mark of naturalBreaks) {
                    const idx = stem.lastIndexOf(mark, maxStemChars);
                    if (idx > maxStemChars * 0.6) {  // 至少在60%位置之后
                      breakIndex = idx + 1;
                      break;
                    }
                  }
                  
                  if (breakIndex > 0) {
                    stem = stem.substring(0, breakIndex) + '...';
                  } else {
                    // 没有自然断点，直接截断但添加明确标记
                    stem = stem.substring(0, maxStemChars) + '...（题干过长已截断）';
                  }
                }
                cardText += `题干：${stem}\n`;
                
                // 选项（只保留前4个）
                if (card.options?.length) {
                  const options = card.options.slice(0, 4);
                  cardText += `选项：${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}\n`;
                }
                
                // 关键特征
                if (card.questionFeature) {
                  cardText += `设问特征：${card.questionFeature.substring(0, 30)}\n`;
                }
                
                const cardTokens = estimateTokens(cardText);
                if (templateTokens + cardTokens > TEMPLATE_BUDGET) {
                  if (sampleCount === 0) {
                    templateContext += cardText;
                    sampleCount++;
                  }
                  break;
                }
                
                templateContext += cardText;
                templateTokens += cardTokens;
                sampleCount++;
              }
              
              if (sampleCount > 0) {
                templateContext += `\n【注意】以上真题仅作学段题型参考。本题请根据实际知识点和${genType === 'exam' ? '考试要求' : genType === 'practice' ? '练习目标' : '训练目标'}独立设计题干长度、句式结构和选项数量，无需机械模仿模板样本。`;
              } else {
                templateContext = '';
              }
            }
          }

          // ========== 3. 已生成题目摘要：附带显式排重指令，防止逐题雷同 ==========
          contextSummary = '';
          if (generatedContext.length > 0) {
            const recentContext = generatedContext.slice(-3);
            contextSummary = `【已生成题目——下面的题目已生成完毕，你本题必须与之有明显差异】
${recentContext.join('\n')}

⚠️ 排重要求——请确认本题与上面已生成题目的差异：
1. 不使用上面已出现过的场景（如上面用了"分蛋糕"，你换"跳绳比赛"或"图书馆"等全新场景）
2. 不使用上面已出现过的设问句式（如上面用了"XX有多少个"，你换"比较XX和YY的差异"或"如果ZZ发生变化，XX会怎样"）
3. 不使用上面已出现过的数据组合（换一组全新数字，不雷同）
`;
            
            const summaryTokens = estimateTokens(contextSummary);
            if (summaryTokens > SUMMARY_BUDGET) {
              const shorter = generatedContext.slice(-2);
              contextSummary = `【已生成题目】${shorter.join('；')}\n⚠️ 请确保本题情境、设问方式与上面不同。`;
              if (estimateTokens(contextSummary) > SUMMARY_BUDGET) {
                contextSummary = `【上一题】${generatedContext[generatedContext.length - 1]}\n⚠️ 请确保本题情境、设问方式与上一题不同。`;
              }
            }
          }

          // ========== 4. 日志：输出各模块使用量（方便调试） ==========
          const coreCount = materialContext ? (materialContext.match(/核心教材原文/g) || []).length : 0;
          const extCount = materialContext ? (materialContext.match(/补充参考/g) || []).length : 0;
          console.log(`📊 题${questionPlan.number} 上下文使用:
          教材原文: 核心段 + 扩展段 (预算${MATERIAL_BUDGET} tokens)
          模板样本: ${templateContext ? '已注入' : '无'} (预算${TEMPLATE_BUDGET} tokens)
          已生成摘要: ${estimateTokens(contextSummary)} tokens (预算${SUMMARY_BUDGET})`);

          // 🔧 新增：综合题额外上下文
          let integratedContext = '';
          if (questionPlan.knowledgePoint && questionPlan.knowledgePoint.startsWith('综合：')) {
            const kps = questionPlan.knowledgePoint.replace('综合：', '').split(/[、，,]/).map(k => k.trim());
            integratedContext = `\n⚠️ 这是一道综合题，需要融合以下知识点：${kps.join('、')}\n`;
            integratedContext += `请创设一个真实情境，将上述知识点自然融合在一个问题中。\n`;
            integratedContext += `各知识点的考查权重应大致均衡。\n`;
            if (questionPlan.cognitiveLevel === '分析' || questionPlan.cognitiveLevel === '评价') {
              integratedContext += `需要体现高阶思维（分析/评价），不止于简单应用。\n`;
            }
          }

          // 🔧 按题型从指令库查询质量约束（替代硬编码 typeSpecificRules）
          const TYPE_TO_GENTYPE = { '选择题': 'choice', '填空题': 'fill', '判断题': 'truefalse', '计算题': 'calc', '解答题': 'answer', '应用题': 'word_problem', '实验题': 'experiment' };
          const typeGenType = TYPE_TO_GENTYPE[questionPlan.type];
          const typeBlocks = typeGenType ? getMatchingBlockInstructions({ category: '生成-题型专项要求', genType: typeGenType }) : [];
          const typeRule = typeBlocks.length > 0 ? typeBlocks[0].content : '';

          // 🔧 场景多样性种子（轮转注入，防止逐题雷同）
          const diversitySeeds = [
            '🎲 【场景引导：生活化】请创设贴近学生日常的场景（如购物、分食物、运动计分等），让题目有真实感和代入感。',
            '🎲 【场景引导：校园课堂】请创设校园/课堂场景（如小组比赛、实验操作、课堂问答等），与学校生活关联。',
            '🎲 【场景引导：故事游戏】请将题目包装成简短的小故事、闯关游戏或趣味挑战，增强可读性。',
            '🎲 【场景引导：图表数据】请用表格、统计图、示意图等可视化方式呈现关键信息，考查数据解读能力。',
            '🎲 【场景引导：探究思辨】请用"为什么...""如果...会怎样""你能发现什么规律"等开放式设问，考查深层理解。',
            '🎲 【场景引导：对比辨析】请设计需要对比两个易混淆概念/方法的题目，考查辨析能力而非死记硬背。',
            '🎲 【原创设计】创设全新的、有辨识度的题目情境与设问方式，让这道题独一无二、不撞脸任何已有题目。',
            '🎲 【场景出新】选用新鲜有趣的真实场景（校园活动、生活实践、时事热点等），赋予角色有特色的名字，让题目有真实感和新鲜感。',
'🎲 【独立原创】确保题目是全新的独立创作——情境、数据、设问角度均为原创设计，不参考任何已有题目。',
'🎲 【自然表达】用自然的语言风格写题，像一位经验丰富的教师出题，语言精准、表述清晰，避免模板化套话。',
          ];
          const diversitySeed = diversitySeeds[i % diversitySeeds.length];

          const questionPrompt = buildPerQuestionPrompt(questionPlan, genType, {
            situationAnchor,
            contextSummary,
            styleConsistencyHint,
            materialContext,
            templateContext,
            typeRule,
            integratedContext,
            selectedTemplates,
            instruction,
            selectedBooks,
            stage: selectedBooks?.[0]?.stage || '',
            diversitySeed,
          });

          try {
            // 🔧 优化：第一题前检查模型状态，后续题之间等待2秒
            if (i === 0) {
              console.log('🔥 题目生成：检查模型状态...');
              try {
                const result = await checkModelReady(null, 3, 'text');
                
                if (!result.ready) {
                  console.log(`⚠️ 模型未就绪，根据响应时间动态等待... (${result.responseTime}ms)`);
                  const additionalWait = Math.max(2000, Math.min(4000, result.responseTime / 10));
                  await new Promise(r => setTimeout(r, additionalWait));
                } else {
                  console.log(`✅ 文本生成模型已就绪，立即开始（响应时间: ${result.responseTime}ms, 尝试${result.attempts}次）`);
                }
              } catch (e) {
                console.warn('⚠️ 模型检测失败，等待3秒后继续...', e.message);
                await new Promise(r => setTimeout(r, 3000));
              }
            } else {
              // 题之间等待2秒，让模型恢复
              console.log(`⏰ 第${i+1}题之前等待2秒...`);
              await new Promise(r => setTimeout(r, 2000));
            }

            const questionContent = await callAI(questionPrompt, { 
              taskType: 'generation',    // ✅ 题目生成用重型模型
              timeout: 120000,           // 单题给2分钟
              allowContinuation: true    // 🔧 允许题目生成时自动续写
            });
            generatedQuestions.push(questionContent);
            
            // ✨ 新增：逐题自检验证
            let validationNote = '';
            
            // 🔧 增强：硬性规则验证（先于AI验证，成本低、速度快）
            try {
              const book = selectedBooks?.[0];
              const rawSubject = book?.subject || '';
              const stage = book?.stage || '';
              const subject = normalizeSubjectName(rawSubject, stage);
              
              const hardResults = runHardValidators(questionContent, subject);
              
              if (hardResults.length > 0) {
                const errors = [];
                const warnings = [];
                
                for (const result of hardResults) {
                  if (result.passed === false) {
                    const prefix = result.severity === 'error' ? '❌' : '⚠️';
                    const note = `${prefix} [${result.name}] ${result.message}`;
                    
                    if (result.severity === 'error') {
                      errors.push(note);
                    } else {
                      warnings.push(note);
                    }
                    
                    validationNote += `<!-- ${note} -->\n`;
                    console.warn(`题${questionPlan.number}${note}`);
                  }
                }
                
                const fixedContent = applyAutoFixes(questionContent, hardResults);
                if (fixedContent !== questionContent) {
                  const idx = generatedQuestions.indexOf(questionContent);
                  if (idx >= 0) {
                    generatedQuestions[idx] = fixedContent;
                    console.log(`🔧 题${questionPlan.number} 自动修复完成`);
                  }
                }
                
                if (errors.length > 0) {
                  console.warn(`⚠️ 题${questionPlan.number} 存在 ${errors.length} 个严重错误`);
                  validationNote += `<!-- ⚠️⚠️⚠️ 本题存在严重规则违反，请人工审查 ⚠️⚠️⚠️ -->\n`;
                  validationNote += `<!-- 错误列表：\n${errors.join('\n')}\n-->\n`;
                }
                
                if (warnings.length > 0) {
                  console.log(`📝 题${questionPlan.number} 存在 ${warnings.length} 个警告`);
                }
              }
            } catch (e) {
              console.warn('硬性规则验证失败:', e.message);
            }
            try {
              const validatePrompt = `请审查这道题目，检查知识点匹配度和科学性：

【题目内容】
${questionContent.replace(/<[^>]+>/g, '').substring(0, 500)}

【命题要求】
知识点：${questionPlan.knowledgePoint}
难度：${questionPlan.difficulty}
题型：${questionPlan.type}

请逐一检查并只返回JSON：
{
  "knowledgeMatch": true,
  "knowledgeMatchReason": "题目确实考查了该知识点",
  "hasScienceError": false,
  "scienceErrorDetail": "",
  "answerCorrect": true,
  "suggestion": ""
}`;

              const validateResult = await callAI(validatePrompt, { 
                taskType: 'questionValidation',  // 🔧 使用独立验证策略
                temperature: 0,                  // 🔧 降到0，确保客观
                timeout: 30000 
              });
              try {
                const validation = await robustJsonParse(validateResult, null, '题目验证');
                if (!validation.knowledgeMatch) {
                  validationNote = `<!-- ⚠️ 知识点匹配问题：${validation.knowledgeMatchReason || '未知'} -->`;
                }
                if (validation.hasScienceError) {
                  validationNote += `<!-- ❌ 科学性错误：${validation.scienceErrorDetail || '未知'} -->`;
                }
                if (!validation.answerCorrect) {
                  validationNote += `<!-- ⚠️ 答案可能有误 -->`;
                }
                
                // ✨ 独立数学验证
                const mathTypes = ['计算题', '解答题', '应用题', '选择题', '填空题'];
                if (mathTypes.includes(questionPlan.type) && questionContent.length > 20) {
                  try {
                    const mathVerifyPrompt = `请计算这道题的正确结果，只输出最终答案（不需要过程）：

${questionContent.replace(/<[^>]+>/g, '').substring(0, 800)}

只输出答案，不要解释。`;
                    
                    const independentAnswer = await callAI(mathVerifyPrompt, {
                      taskType: 'questionValidation',
                      temperature: 0,
                      timeout: 30000,
                      retries: 0
                    });
                    
                    const answerMatch = questionContent.match(/答案[：:]\s*(.+?)(?:<|$|\n)/);
                    const originalAnswer = answerMatch ? answerMatch[1].trim() : '';
                    
                    if (independentAnswer && originalAnswer && 
                        independentAnswer.trim() !== originalAnswer.trim()) {
                      const normalize = (s) => s.replace(/\s+/g, '').replace(/[，,]/g, '');
                      if (normalize(independentAnswer) !== normalize(originalAnswer)) {
                        validationNote += `<!-- ⚠️ 独立验算不一致 -->`;
                      }
                    }
                  } catch {
                    // 数学验证失败不阻塞
                  }
                }
                
                if (validationNote) {
                  const idx = generatedQuestions.indexOf(questionContent);
                  if (idx >= 0) {
                    generatedQuestions[idx] = validationNote + '\n' + questionContent;
                  }
                }
              } catch {
                // 验证解析失败不阻塞
              }
            } catch {
              // 验证调用失败不阻塞
            }
            
            // ✨ 提取摘要
            try {
              const summary = await callAI(
                `用15字以内概括这道题：${questionContent}`,
                { taskType: 'generation', temperature: 0.1 }
              );
              generatedContext.push(`第${questionPlan.number}题(${questionPlan.type},${questionPlan.knowledgePoint}): ${summary.trim()}`);
            } catch {
              generatedContext.push(`第${questionPlan.number}题(${questionPlan.type},${questionPlan.knowledgePoint})`);
            }
          } catch (e) {
            console.warn(`第${i+1}题生成失败:`, e.message);
            generatedQuestions.push(`<p class="question"><span class="question-number">${questionPlan.number}.</span> 【生成失败】</p>`);
            generatedContext.push(`第${questionPlan.number}题【生成失败】`);
          }
        }
  
        statusText.value = '正在组装...';
        progress.value = 88;

        // 🔧 根修复：practice/special 用简洁标题，仅 exam 走 AI 生成含分值的头部
        if (genType === 'practice' || genType === 'special') {
          const chapters = book?.selectedChapters || [];
          const chapterNames = chapters.map(c => c.title).filter(Boolean).join('、');
          const unitName = book?.name || '';
          const chapterKey = chapterNames || '_all_';
          const genTypeLabel = pickLabelFromPool(genType, chapterKey);
          content = `<h1>${unitName}${chapterNames ? ' · ' + chapterNames : ''}</h1>\n<div class="practice-info"><p>${book?.grade || ''} ${book?.subject || ''} ${genTypeLabel}</p></div>\n\n` + generatedQuestions.join('\n\n');
        } else {
          const headerPrompt = `生成试卷头部HTML：学科${book?.subject || ''}，年级${book?.grade || ''}，总分${totalScore}分。用<h1>标题。`;
          try {
            const header = await callAI(headerPrompt, { 
              taskType: 'generation', temperature: 0.3 
            });
            content = header + '\n\n' + generatedQuestions.join('\n\n');
          } catch (e) {
            content = generatedQuestions.join('\n\n');
          }
        }
      } else {
        // ❌ 蓝图解析失败：不降级，直接报错
        throw new Error(
          `内容生成失败：命题蓝图解析失败，无法逐题生成。\n` +
          `可能原因：AI 返回的蓝图格式异常，无法提取有效的题目信息。\n` +
          `建议：点击"重试"重新生成，或减少所选课时数量后重试。`
        );
      }

      // ✨ 收集逐题答案，生成统一答案与解析区域
      if (genType !== 'exam' && parsedBlueprint.length > 0 && generatedQuestions.length > 0) {
        const answerEntries = [];
        const answerCommentRegex = /<!--\s*answer\s*:\s*(.+?)\s*(?:\|\s*解析\s*:\s*(.+?))?\s*-->/gi;
        let commentMatch;
        for (let qi = 0; qi < generatedQuestions.length; qi++) {
          const qContent = generatedQuestions[qi];
          answerCommentRegex.lastIndex = 0;
          while ((commentMatch = answerCommentRegex.exec(qContent)) !== null) {
            const answer = (commentMatch[1] || '').trim();
            const explanation = (commentMatch[2] || '').trim();
            answerEntries.push({ number: parsedBlueprint[qi]?.number || (qi + 1), answer, explanation });
          }
        }

        if (answerEntries.length > 0) {
          let answerSection = '\n<div class="answer-section">\n<h2>答案与解析</h2>\n';
          for (const entry of answerEntries) {
            answerSection += `<p><strong>${entry.number}.</strong> ${entry.answer}`;
            if (entry.explanation) {
              answerSection += ` | <em>解析：${entry.explanation}</em>`;
            }
            answerSection += '</p>\n';
          }
          answerSection += '</div>';
          content += answerSection;
        } else {
          console.warn('⚠️ [确认模式] 未提取到答案注释，尝试 AI 补生成...');
          try {
            const prompts = generatedQuestions.map((q, i) => `题${i + 1}：${q.replace(/<[^>]+>/g, '').substring(0, 200)}`).join('\n\n');
            const answerGenPrompt = `请根据以下题目内容，生成统一的答案与解析区域。\n\n${prompts}\n\n返回格式：\n<div class="answer-section">\n<h2>答案与解析</h2>\n<p><strong>1.</strong> 答案 | <em>解析：解题思路</em></p>\n...</div>\n\n只返回HTML，不要markdown包裹。`;
            const answerSection = await callAI(answerGenPrompt, { taskType: 'generation', temperature: 0.1 });
            content += '\n' + answerSection;
          } catch (e) { console.warn('答案区域生成失败:', e.message); }
        }
      }
      
      // ========== 第五步：多维度质量校验 ==========
      statusText.value = '质量校验中...';
      progress.value = 90;

      const issues = [];
      
      // ========== 🔧 新增：硬性规则检查（第一级） ==========
      const book = selectedBooks?.[0];
      const stageRaw = book?.stage || '';
      const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
      const hardIssues = HardRuleChecker.check(
        content, 
        parsedBlueprint, 
        book?.subject || '', 
        stageMap[stageRaw] || stageRaw,
        book?.grade || '',
        genType
      );
      
      // 合并硬性检查问题
      hardIssues.forEach(issue => {
        issues.push(`${issue.severity === 'error' ? '❌' : '⚠️'} ${issue.detail}`);
      });

      // 自动修复可修复的问题
      if (hardIssues.some(i => i.autoFix)) {
        content = HardRuleChecker.autoFix(content, hardIssues);
      }

      // ========== 🔧 新增：超纲检测（基于课标知识边界）==========
      if (book && content.length > 100) {
        const rawSubj = book?.subject || '';
        const stg = book?.stage || '';
        const grd = book?.grade || '';
        const subj = normalizeSubjectName(rawSubj, stg);
        
        const boundaryCheck = checkKnowledgeBoundary(content, subj, stg, grd);
        
        if (boundaryCheck.hasViolations) {
          boundaryCheck.violations.forEach(v => {
            const prefix = v.severity === 'error' ? '❌' : '⚠️';
            issues.push(`${prefix} 超纲检测：${v.message}`);
          });
        }
        
        console.log('📋 超纲检测完成:', boundaryCheck.summary);
      }


      // ========== 🔧 AI内容修复（单次） ==========
      const repairContext = {
        genType, 
        genTypeLabel: genTypeLabel || genType,
        subject: book?.subject || '', 
        stage: stageRaw,
        grade: book?.grade || '',
        parsedBlueprint,
      };
      const repairResult = await attemptContentRepair(content, hardIssues, repairContext);
      if (repairResult.repaired) {
        content = repairResult.content;
        if (repairResult.repairIssues && repairResult.repairIssues.length > 0) {
          repairResult.repairIssues.forEach(issue => {
            hardIssues.push(issue);
            issues.push((issue.severity === 'error' ? '❌' : '⚠️') + ' ' + issue.detail);
          });
        }
      }

      // 初始化质量报告（必须在所有使用之前定义）
      const qualityReport = {
        formatCheck: { passed: true, details: [] },
        coverageCheck: { passed: true, details: [] },
        difficultyCheck: { passed: true, details: [] },
        knowledgeCheck: { passed: true, details: [] },
        templateMatch: { passed: true, details: [] }
      };

      // 记录硬性检查结果
      const hardIssueSummary = HardRuleChecker.getIssueSummary(hardIssues);
      if (hardIssueSummary.hasErrors) {
        qualityReport.formatCheck.passed = false;
        qualityReport.formatCheck.details.push(`硬性规则检查发现${hardIssueSummary.errors}个错误`);
      }
      if (hardIssueSummary.hasWarnings) {
        qualityReport.formatCheck.details.push(`硬性规则检查发现${hardIssueSummary.warnings}个警告`);
      }

      // 格式检查
      if (!content.includes('<p class="question"') && !content.includes('<h')) {
        issues.push('❌ 可能未返回HTML格式');
        qualityReport.formatCheck.passed = false;
      }

      const questionMatches = content.match(/<p class="question"/g);
      const questionCount = questionMatches ? questionMatches.length : 0;
      if (questionCount === 0) {
        issues.push('❌ 未检测到题目');
        qualityReport.formatCheck.passed = false;
      }



      // 🔧 新增：LaTeX 公式语法基础校验
      if (book && ['数学', '物理', '化学'].includes(book.subject || '')) {
        const dollarCount = (content.match(/\$/g) || []).length;
        if (dollarCount % 2 !== 0) {
          issues.push('⚠️ 行内公式符号$未闭合（奇数个$）');
          qualityReport.formatCheck.details.push('检测到未闭合的$公式符号');
        }
        
        const doubleDollarCount = (content.match(/\$\$/g) || []).length;
        if (doubleDollarCount % 2 !== 0) {
          issues.push('⚠️ 独立公式符号$$未配对');
          qualityReport.formatCheck.details.push('检测到未配对的$$公式符号');
        }
        
        const latexErrors = [
          { pattern: /\\frac\{\}/, message: '\\frac{} 缺少参数' },
          { pattern: /\\sqrt\{\}/, message: '\\sqrt{} 缺少参数' },
          { pattern: /\{\\frac/, message: '括号位置错误（应在\\frac之后）' },
          { pattern: /[^\\]_\{[^}]*$/, message: '下标{}可能未闭合' },
          { pattern: /[^\\]\^\{[^}]*$/, message: '上标{}可能未闭合' }
        ];
        
        for (const error of latexErrors) {
          if (error.pattern.test(content)) {
            issues.push(`⚠️ LaTeX语法问题：${error.message}`);
          }
        }
      }

        qualityReport.difficultyCheck.details.push(
          `蓝图规划${parsedBlueprint.length}题，实际生成${questionCount}题`
        );

      // ========== 第三级：模板对标量化 ==========
      if (selectedTemplates?.length > 0 && selectedTemplates[0]?.analysis?.questionCards?.length > 0) {
        const templateCards = selectedTemplates[0].analysis.questionCards;
        
        const templateTypeDist = {};
        const generatedTypeDist = {};
        templateCards.forEach(c => templateTypeDist[c.type] = (templateTypeDist[c.type] || 0) + 1);
        parsedBlueprint.forEach(q => generatedTypeDist[q.type] = (generatedTypeDist[q.type] || 0) + 1);
        
        const allTypes = [...new Set([...Object.keys(templateTypeDist), ...Object.keys(generatedTypeDist)])];
        let matchScore = 0;
        allTypes.forEach(t => {
          const tCount = templateTypeDist[t] || 0;
          const gCount = generatedTypeDist[t] || 0;
          if (tCount > 0 && gCount > 0) matchScore++;
        });
        const typeMatchRate = allTypes.length > 0 ? Math.round(matchScore / allTypes.length * 100) : 100;
        
        qualityReport.templateMatch.details.push(
          `题型匹配度: ${typeMatchRate}%（${matchScore}/${allTypes.length}类题型）`
        );
        
        // 🔧 新增：题干长度分布对比
        const templateStemLengths = templateCards.filter(c => c.stem).map(c => c.stem.length);
        const generatedStemTexts = content.match(/<p class="question"[^>]*>([^<]*)<\/p>/g) || [];
        const generatedStemLengths = generatedStemTexts.map(s => s.replace(/<[^>]+>/g, '').length);
        
        if (templateStemLengths.length > 0 && generatedStemLengths.length > 0) {
          const templateAvgStem = Math.round(templateStemLengths.reduce((a, b) => a + b, 0) / templateStemLengths.length);
          const generatedAvgStem = Math.round(generatedStemLengths.reduce((a, b) => a + b, 0) / generatedStemLengths.length);
          const stemDeviation = Math.abs(generatedAvgStem - templateAvgStem);
          
          qualityReport.templateMatch.details.push(
            `模板题干平均${templateAvgStem}字，生成题干平均${generatedAvgStem}字，偏差${stemDeviation}字`
          );
          
          if (stemDeviation > templateAvgStem * 0.5) {
            issues.push(`⚠️ 题干长度与模板偏差较大（模板${templateAvgStem}字 vs 生成${generatedAvgStem}字）`);
          }
        }
        
        const templateTotalScore = templateCards.reduce((sum, c) => sum + (c.score || 0), 0);
        const generatedTotalScore = parsedBlueprint.reduce((sum, q) => sum + (q.score || 0), 0);
        if (templateTotalScore > 0) {
          const scoreDeviation = Math.abs(generatedTotalScore - templateTotalScore);
          qualityReport.templateMatch.details.push(
            `模板总分${templateTotalScore}，生成总分${generatedTotalScore}，偏差${scoreDeviation}分`
          );
          if (scoreDeviation > 10) {
            issues.push(`⚠️ 总分与模板偏差${scoreDeviation}分`);
          }
        }
        
        qualityReport.templateMatch.details.push(
          `模板${templateCards.length}题，生成${parsedBlueprint.length}题`
        );
      }

      progress.value = 95;

      // ========== 🔧 新增：术语统一后处理 ==========
      if (book && book.subject) {
        const rawSubj = book?.subject || '';
        const stg = book?.stage || '';
        const subj = normalizeSubjectName(rawSubj, stg);
        const terminologyResult = normalizeTerminology(content, subj);
        
        if (terminologyResult.fixes.length > 0) {
          content = terminologyResult.normalized;
          console.log(`📝 术语统一完成：${terminologyResult.fixes.map(f => `"${f.original}"→"${f.corrected}"(${f.count}处)`).join('；')}`);
          qualityReport.formatCheck.details.push(
            `术语统一：${terminologyResult.fixes.length}种术语被标准化`
          );
        }
      }


      progress.value = 100;
      
      // 🔧 生成质量摘要，显示在状态栏（仅即时检查，不触发 API 调用）
      let summaryParts = ['生成完成'];

      if (qualityReport.knowledgeCheck?.details?.length) {
        const kpDetail = qualityReport.knowledgeCheck.details.find(d => d.includes('超纲'));
        if (kpDetail) summaryParts.push(`⚠️超纲检测`);
      }
      if (issues && issues.length > 0) {
        const errorCount = issues.filter(i => i.startsWith('❌')).length;
        const warnCount = issues.filter(i => i.startsWith('⚠️')).length;
        if (errorCount > 0) summaryParts.push(`❌${errorCount}个错误`);
        if (warnCount > 0) summaryParts.push(`⚠️${warnCount}个警告`);
      } else {
        summaryParts.push('✅无问题');
      }
      statusText.value = summaryParts.join(' | ');

      return { 
        success: true, 
        content,
        blueprint,
        parsedBlueprint,
        contentCards,
        knowledgeMap,
        issues,
        qualityReport,
        generatedQuestions
      };
    } catch (error) {
      console.error('生成失败:', error);
      return { success: false, error: error.message };
    } finally {
      isGenerating.value = false;
    }
  };

  /**
   * 批量生成模式（用户主动选择，非自动降级）
   * 将蓝图 + 教材原文一次发给 AI，生成完整资料
   * 精度低于逐题生成，但不易超时/失败
   */
  const generateBatchWithBlueprint = async (blueprint, instruction, selectedBooks, selectedTemplates) => {
    statusText.value = '批量生成中...';
    progress.value = 70;

    // 收集教材原文（头尾截断，最多 3000 字符）
    let textbookRawText = '';
    const MAX_TEXT_LENGTH = 3000;
    if (selectedBooks && selectedBooks.length > 0) {
      for (const book of selectedBooks) {
        const chapters = book.selectedChapters || [];
        for (const ch of chapters) {
          if (ch.rawText) {
            const chText = ch.rawText;
            const headText = chText.substring(0, Math.floor(MAX_TEXT_LENGTH / 2));
            const tailText = chText.length > MAX_TEXT_LENGTH
              ? '\n...（中略）...\n' + chText.substring(chText.length - Math.floor(MAX_TEXT_LENGTH / 4))
              : '';
            textbookRawText += `【${ch.title}】\n${headText}${tailText}\n\n`;
            if (textbookRawText.length > MAX_TEXT_LENGTH * 2) {
              textbookRawText += '...（后续章节原文已省略）...\n';
              break;
            }
          }
        }
      }
    }

    // 收集模板原文
    let templateRawText = '';
    if (selectedTemplates && selectedTemplates.length > 0) {
      const tpl = selectedTemplates[0];
      const chapters = tpl.selectedChapters || [];
      for (const ch of chapters) {
        if (ch.rawText) templateRawText += ch.rawText + '\n';
      }
    }

    const subject = selectedBooks?.[0]?.subject || '';
    const stage = selectedBooks?.[0]?.stage || '';
    const grade = selectedBooks?.[0]?.grade || '';

    const batchPrompt = `请根据以下命题蓝图，生成完整的教辅资料。

【命题蓝图】
${blueprint}

${textbookRawText ? '【教材参考原文】\n' + textbookRawText + '\n' : ''}
${templateRawText ? '【模板参考原文】\n' + templateRawText : ''}

【核心指令——以下规则从三维度精准注入系统中提取，必须严格遵守】
${instruction}

【防幻觉约束——生成阶段补充规则】
1. ⛔ 每道题只能考查蓝图中标注的知识点，不得扩展
2. ⛔ 题干中涉及的数据、公式、概念必须与教材原文一致
3. ⛔ 答案必须唯一确定，不得模棱两可
4. ⛔ 禁止使用"下列说法正确的是""以下哪个选项是正确的"等无信息量设问
5. ⛔ 禁止选项中出现"以上都是""以上都不对"
6. ⛔ 禁止出现科学性错误（数据/公式/概念/单位必须准确无误）
7. ⛔ 禁止使用"略""见教材""自行查阅"等占位符代替具体内容
8. ⛔ 选择题所有选项长度相近、风格一致，正确选项随机分布在A/B/C/D中

【格式要求】
- 返回HTML，题干用<p class="question">，选项用<p class="option">
- 每道题必须独立用块级标签包裹，严禁多道题挤在同一段落
- 🔴 题号层级（强制性）：大题用"一、二、三、"（中文数字），小题用"1. 2. 3."（阿拉伯数字），子小题用"(1)(2)(3)"或"①②③"。不同层级必须用不同编号格式，禁止仅靠缩进来区分层级
- 🔴 字号铁律：所有正文（题干/选项/填空/解答区）使用统一字号（<p>标签默认大小），严禁因子题嵌套缩小字体

⛔ 【禁止模式——以下写法会导致排版崩溃，严禁使用！】
❌ 错误（编号重复+缩进+小字号，三个错误叠加）：
  <p class="question">1. 大题题干</p>
  <p style="margin-left:20px;font-size:14px;">1. 小题</p>  ← 编号重复无法区分层级！缩进导出Word丢失！
  <p style="margin-left:20px;font-size:14px;">2. 小题</p>  ← 小字号破坏统一排版！禁止因子题嵌套缩小字体
✅ 正确（编号格式区分层级，统一字号，无缩进）：
  <p class="question">1. 大题题干</p>
  <p class="question">(1) 小题</p>  ← 仅靠编号格式即可区分层级
  <p class="question">(2) 小题</p>

- 🔴 填空横线：<u class="blank-N">&emsp;</u>（N按答案字数：1字→2, 2字→4, 3-4字→6, 5-6字→8, 7-10字→10）
- 🔴 括号填空：用 <span class="blank-N">&emsp;</span>（N必须按答案字数动态计算！1字→2, 2字→3, 3字→4, 4字→5, 5-6字→6, 7-8字→8, 9-10字→10，⛔严禁括号内用 <u> 标签）

【强制约束】
1. 每道题前标注题号，与蓝图的题号一一对应
2. 每道题后标注【知识点：XXX】【对应课文：XXX】
3. 题型、分值、难度严格按蓝图执行
4. 必须返回标准HTML代码，首行不要用\`\`\`html包裹
5. 答案和解析放在文末<div class="answer-section">中

${buildOutputFormatBlock('exam', subject, stage, grade)}`;

    const content = await callAI(batchPrompt, {
      taskType: 'generation',
      timeout: 180000
    });
    detectSquishedOutput(content, 'batch-mode');
    return content;
  };

  /**
   * 🔧 新增：为指定题目生成变体
   * @param {string} originalQuestion - 原题HTML
   * @param {object} questionPlan - 原题规划 { type, knowledgePoint, difficulty, score }
   * @param {object} options - 可选配置
   * @returns {Promise<string>} 变体题目的HTML
   */
  const generateQuestionVariant = async (originalQuestion, questionPlan, options = {}) => {
    const {
      changeData = true,        // 是否改变数据
      changeContext = true,     // 是否改变情境
      changeOptions = true,     // 是否改变选项（选择题）
      changeQuestionType = false // 是否改变题型（默认不改）
    } = options;

    const variantPrompt = `请为以下题目生成一个变体题目。

【原题】
${originalQuestion}

【原题规划】
- 题型：${questionPlan.type}
- 考查知识点：${questionPlan.knowledgePoint}
- 难度：${questionPlan.difficulty}
${questionPlan.score ? `- 分值：${questionPlan.score}分\n` : ''}

【变体要求】
${changeQuestionType ? `- 可以改变题型，但核心知识点不变` : `- 保持相同题型`}
${changeData ? `- 改变题目中的数据和数值` : ''}
${changeContext ? `- 改变题目情境或背景描述` : ''}
${changeOptions ? `- 如果是选择题，改变选项内容、顺序和部分选项` : ''}
- 保持难度不变（${questionPlan.difficulty}）
- 保持相同的知识点覆盖
- 必须是一道全新题目，与原题重复度不超过30%
- 保持 HTML 格式
${questionPlan.score ? `- 标注：【知识点：${questionPlan.knowledgePoint}】【难度：${questionPlan.difficulty}】\n` : ''}

只返回一道题的HTML代码。`;

    return await callAI(variantPrompt, {
      taskType: 'generation',
      temperature: 0.8,
      timeout: 60000
    });
  };

  const extractGraphs = (content) => {
    const matches = content?.match(/\[GRAPH\][\s\S]*?\[\/GRAPH\]/g) || [];
    return matches.map(m => ({ full: m }));
  };

  // ===== 课时练逐课时生成 =====
  /**
   * 对已确认的课时列表逐条生成蓝图和内容
   * 调用前必须先通过 generate() 检测到 needsPeriodConfirm，用户确认后调用此函数
   * @param {Array} confirmedPeriods - 用户确认的课时列表
   */
  const generatePracticeByPeriods = async (confirmedPeriods) => {
    const knowledgeMap = _cachedKnowledgeMap;
    const contentCards = _cachedContentCards;
    const instruction = _cachedInstruction;
    const selectedBooks = _perPeriodSelectedBooks;
    const selectedTemplates = _perPeriodSelectedTemplates;

    if (!knowledgeMap || !contentCards || !instruction) {
      console.error('[逐课时生成] 缺少缓存数据，请先运行 generate() 检测课时');
      _cachedKnowledgeMap = null;
      _cachedContentCards = null;
      _cachedInstruction = null;
      periodConfirm.value = null;
      isGenerating.value = false;
      return { success: false, error: '缓存数据缺失' };
    }

    isGenerating.value = true;
    progress.value = 30;
    const periodResults = [];
    const totalPeriods = confirmedPeriods.length;

    for (let pi = 0; pi < totalPeriods; pi++) {
      const period = confirmedPeriods[pi];
      const periodLabel = `课时${pi + 1}/${totalPeriods}`;
      statusText.value = `${periodLabel}：${period.periodName} — 命题规划...`;
      progress.value = 30 + Math.round((pi / totalPeriods) * 35);

      // 构造该课时的子知识图谱
      const periodKMap = {
        knowledgePoints: period.knowledgePoints,
        keyDifficulties: (knowledgeMap.keyDifficulties || []).filter(
          kd => period.knowledgePoints.some(kp => 
            (typeof kd === 'string' && typeof kp === 'string') && (kd.includes(kp) || kp.includes(kd))
          )
        ),
        knowledgeGraph: [{
          unit: period.unitName || '',
          bigConcepts: [{
            name: period.periodName,
            coreKnowledge: period.knowledgePoints.map(kp => ({ name: kp }))
          }]
        }],
        crossChapterLinks: [],
      };

      // 构造课时专用 instruction
      let periodInstruction = instruction;
      if (totalPeriods > 1) {
        periodInstruction += `\n\n【课时限定】当前仅生成「${period.periodName}」的课时练习。`;
        periodInstruction += `\n本课时包含 ${period.kpCount} 个知识点：${period.knowledgePoints.join('、')}`;
        periodInstruction += `\n严格仅考查以上知识点，不涉及本单元其他课时内容。`;
      }

      // 调用 generate 蓝图模式（复用 Step3 蓝图表生成逻辑）
      _perPeriodKnowledgeMap = periodKMap;
      let periodBlueprintResult;
      try {
        periodBlueprintResult = await generate(
          periodInstruction, 'practice', selectedBooks, selectedTemplates, 0, true
        );
      } catch (e) {
        console.error(`[逐课时] ${periodLabel} 蓝图生成失败:`, e.message);
        periodResults.push({
          periodName: period.periodName,
          unitName: period.unitName,
          kpCount: period.kpCount,
          blueprint: '',
          parsedBlueprint: [],
          content: '',
          error: e.message,
        });
        continue;
      }

      statusText.value = `${periodLabel}：${period.periodName} — 生成内容...`;
      progress.value = 30 + Math.round(((pi + 0.5) / totalPeriods) * 35);

      // 调用 generate 完整模式（复用 Step4-5 内容生成 + 质检逻辑）
      _perPeriodKnowledgeMap = periodKMap;
      let periodResult;
      try {
        periodResult = await generate(
          periodInstruction, 'practice', selectedBooks, selectedTemplates, 0, false
        );
      } catch (e) {
        console.error(`[逐课时] ${periodLabel} 内容生成失败:`, e.message);
        periodResults.push({
          periodName: period.periodName,
          unitName: period.unitName,
          kpCount: period.kpCount,
          blueprint: periodBlueprintResult?.blueprint || '',
          parsedBlueprint: periodBlueprintResult?.parsedBlueprint || [],
          content: '',
          error: e.message,
        });
        continue;
      }

      periodResults.push({
        periodName: period.periodName,
        unitName: period.unitName,
        kpCount: period.kpCount,
        blueprint: periodBlueprintResult?.blueprint || '',
        parsedBlueprint: periodBlueprintResult?.parsedBlueprint || [],
        content: periodResult?.content || '',
        generatedQuestions: periodResult?.generatedQuestions || [],
        issues: periodResult?.issues || [],
        qualityReport: periodResult?.qualityReport || null,
      });
    }

    // 清理缓存
    _cachedKnowledgeMap = null;
    _cachedContentCards = null;
    _cachedInstruction = null;
    _perPeriodSelectedBooks = null;
    _perPeriodSelectedTemplates = null;
    periodConfirm.value = null;
    isGenerating.value = false;

    progress.value = 100;
    statusText.value = `课时练生成完成（${totalPeriods} 个课时）`;

    // 合并所有课时内容
    // 🔧 逐课时合并重构：剥离各课时独立的 answer-section，合并为统一答案区
    const periodQuestions = [];
    const periodAnswers = [];

    for (let i = 0; i < periodResults.length; i++) {
      const r = periodResults[i];
      if (!r.content) continue;
      let content = r.content;
      // 提取尾部 answer-section（支持多行内容）
      const answerMatch = content.match(/<div\s+class="answer-section">[\s\S]*?<\/div>(?:\s*<\/div>)?\s*$/i);
      let answerHtml = '';
      if (answerMatch) {
        answerHtml = answerMatch[0];
        // 从题目内容中移除该 answer-section
        content = content.slice(0, answerMatch.index).trimEnd();
      }
      periodQuestions.push({ name: r.periodName, content });
      periodAnswers.push({ name: r.periodName, answer: answerHtml });
    }

    // 组装：题目（按课时间隔）+ 统一答案区
    let combinedContent = '';
    for (let i = 0; i < periodQuestions.length; i++) {
      const q = periodQuestions[i];
      const header = totalPeriods > 1
        ? `<h2 style="margin-top:${i > 0 ? '24px' : '0'};border-bottom:1px solid #e0e0e0;padding-bottom:8px;">${q.name}</h2>\n`
        : '';
      combinedContent += header + q.content;
      if (i < periodQuestions.length - 1) combinedContent += '\n';
    }

    // 统一答案区
    const hasAnswers = periodAnswers.some(a => a.answer);
    if (hasAnswers) {
      combinedContent += '\n<div class="answer-section">\n<h2>答案与解析</h2>\n';
      for (const pa of periodAnswers) {
        if (!pa.answer) continue;
        if (totalPeriods > 1) {
          combinedContent += `<h3>${pa.name}</h3>\n`;
        }
        // 提取 answer-section 内部内容（去掉外层 div 包装）
        const inner = pa.answer.replace(/<div\s+class="answer-section">\s*/i, '').replace(/\s*<\/div>\s*$/i, '');
        combinedContent += inner + '\n';
      }
      combinedContent += '</div>\n';
    }

    return {
      success: true,
      isMultiPeriod: true,
      periodCount: totalPeriods,
      periods: periodResults,
      content: combinedContent,
      generatedQuestions: periodResults.flatMap(r => r.generatedQuestions || []),
    };
  };

  // ===== 错误边界：安全 AI 调用包装 =====
  const safeCallAI = async (prompt, options = {}) => {
    try {
      return await callAI(prompt, options);
    } catch (e) {
      if (e.message?.includes('取消') || e.message?.includes('abort')) throw e;
      console.error('[safeCallAI] AI 调用失败:', e.message);
      const friendlyMsg = e.message?.includes('服务不可用') ? 'AI 服务未启动，请检查 Ollama 或 DeepSeek 配置'
        : e.message?.includes('API Key') ? 'API Key 无效，请在设置中更新'
        : e.message?.includes('超时') ? 'AI 响应超时，请稍后重试或降低内容量'
        : e.message?.includes('余额') ? 'API 余额不足，请充值'
        : `AI 调用失败: ${e.message}`;
      throw new Error(friendlyMsg);
    }
  };

  const safeCallMultimodal = async (prompt, imageBase64, options = {}) => {
    try {
      return await callMultimodalAI(prompt, imageBase64, options);
    } catch (e) {
      if (e.message?.includes('取消') || e.message?.includes('abort')) throw e;
      console.error('[safeCallMultimodal] 多模态调用失败:', e.message);
      const friendlyMsg = e.message?.includes('重启Ollama')
        ? '模型异常，请重启 Ollama 服务后重试'
        : e.message?.includes('空内容')
        ? 'OCR 识别返回空结果，请检查图片质量或切换引擎'
        : `多模态识别失败: ${e.message}`;
      throw new Error(friendlyMsg);
    }
  };

  const clearPeriodCache = () => {
    _cachedKnowledgeMap = null;
    _cachedContentCards = null;
    _cachedInstruction = null;
    _perPeriodSelectedBooks = null;
    _perPeriodSelectedTemplates = null;
    periodConfirm.value = null;
  };

  // 🔧 整体生成跳过检测：cancelPeriodSplit 调用前设置此标志，阻止 generate() 重新触发课时切分
  const preserveCacheForNextGenerate = () => {
    _preservePeriodCache = true;
  };

  // 🔧 逐章生成：设置当前章节标题，下次 generate() 从缓存过滤出单章数据
  const setPerChapterFilter = (chapterTitle) => {
    _perChapterChapterTitle = chapterTitle;
  };

    return {
    isGenerating,
    progress,
    statusText,
    abortController,
    periodConfirm,
    callAI,
    safeCallAI,
    callMultimodalAI,
    safeCallMultimodal,
    extractTextRobustly,
    extractChapterTextSequentially,  // 🎯 新增：稳定的批量原文提取
    detectMultiColumnPages,         // 📐 新增：手动多栏检测
    postProcessOCR,
    analyzeTextbookImage,
    analyzeTextbookWithText,  // 🔧 新增：纯文本 AI 分析
    analyzeTemplateImageFull,
    extractKnowledgePoints,
    buildGenerationInstruction,
    setLabelOverride,      // ✏️ 名称样式手动选择（方案二）
    getLabelPool,          // ✏️ 名称池查询（供下拉选项）
    generate,
    executeGenerationWithBlueprint,
    generatePracticeByPeriods,
    clearPeriodCache,
    preserveCacheForNextGenerate,
    setPerChapterFilter,
    getTypeDistribution,
    cancelGeneration,
    extractGraphs,
    generateQuestionVariant,
    smartWait,
    checkModelLoaded,
    checkModelReady,  // 🔧 新增：检测模型是否真正就绪
    smartWaitForModel  // 🔧 新增：智能等待模型空闲
  };
}