import { ref } from 'vue';
import axios from 'axios';
import { apiConfig, getCurrentEngineConfig, getCurrentEngineConfigEnhanced, getMultimodalConfig, resolveProviderConfig, getTaskMaxTokens, getGenerationThinkingEnabled, getTimeout, getRetryDelay } from '../config/apiConfig.js';
import { GEN_CONST } from '../config/generationConstants.js';
import { PAPER_OUTPUT_CONVENTIONS, ANSWER_ROLES, buildAnswerFormatSpec, getCurriculumLabel } from '../config/promptLibrary.js';
import { getStoragePath } from '../utils/pathHelper.js';
import { auditExamPaper } from '../utils/examValidator.js';
import { recordSample, getCalibratedCoef } from '../utils/budgetCalibration.js';
import { extractGradeNum, resolveStageKey } from '../utils/gradeStage.js';
import {
  genTypeTemplates,
  normalizeSubjectName
} from '../config/expertKnowledge.js';
// 🔴 分析阶段 prompt 已从指令库迁出为独立配置（analysisPrompts.js），生成规范与教材分析规范解耦
import { getAnalysisPrompts } from '../config/analysisPrompts.js';
import { parseStyleFromInstruction } from '../utils/instructionStyle.js';
import { SCOPE_LABEL_POOLS } from '../config/paperScope.js';
import { buildSealLineHeader } from '../config/promptLibrary.js';
import { registerController, unregisterController } from '../utils/requestManager.js';
import { generatePromptCacheKey, getCachedPromptResult, setCachedPromptResult } from '../utils/generationCache';

// ===== 提取的独立工具模块 =====
import { getModelDisplayName, robustJsonParse } from '../utils/jsonParser.js';
import { splitTextIntoSegments } from '../utils/textSegmenter.js';
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
const parseSSEStream = async (fetchResponse, signal, heartbeatMs = 60000, maxReasoningChunks = Infinity) => {
  const reader = fetchResponse.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let finishReason = '';
  let buffer = '';
  let chunkCount = 0;
  let reasoningChunkCount = 0;  // 🔧 推理模型：思考链 chunk 计数
  let capped = false;  // 🔧 思考预算上限触发（流式中止标志）
  let lastChunkTime = Date.now();
  let consecutiveParseFailures = 0;  // 🔧 SSE 连续解析失败计数器

  try {
    while (true) {
      if (capped) break;
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
            consecutiveParseFailures = 0;  // 🔧 成功解析，重置计数器
            const delta = parsed.choices?.[0]?.delta?.content;
            const reasoningDelta = parsed.choices?.[0]?.delta?.reasoning_content;  // 🔧 推理模型思考链
            if (delta) {
              content += delta;
              chunkCount++;
            }
            if (reasoningDelta) {
              reasoningChunkCount++;
              // 🔴 思考预算上限（流式中止止损）：推理 chunks 超过阈值（如 40K）立即中断——
              //    防止思考失控耗尽输出预算白付费用；已接收的推理按实际计费，但不再等到 max_tokens 截断
              if (reasoningChunkCount >= maxReasoningChunks) {
                finishReason = 'reasoning_capped';
                reader.cancel().catch(() => {});
                capped = true;
                break;
              }
            }
            if (parsed.choices?.[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason;
            }
          } catch (parseErr) {
            // 🔧 连续失败计数器：超过5次告警（可能流已损坏）
            consecutiveParseFailures++;
            if (consecutiveParseFailures >= 5) {
              console.error(`🔴 SSE 流连续 ${consecutiveParseFailures} 次解析失败，流可能已损坏（最近: ${jsonStr.slice(0, 80)}）`);
            } else if (jsonStr.length > 10) {
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
  return { content, finishReason, reasoningChunkCount };
};

/**
 * 将 fetch 错误标准化为兼容 axios 错误格式的对象
 */
const normalizeFetchError = async (e, response) => {
  // 网络错误（fetch 只在网络失败时抛异常）
  if (e) {
    const rawMsg = e.message || '网络请求失败';
    // 🔧 识别 headers 非 ASCII：API Key 含中文/特殊字符时浏览器在构造请求头就抛此错，
    //    此前被硬编码成 ENOTFOUND 误报为"网络问题"，实际是 Key 非法
    if (/String contains non ISO-8859-1 code point|Failed to read the 'headers' property/i.test(rawMsg)) {
      const friendly = new Error('API Key 包含非法字符（应仅含英文、数字、连字符）。请到设置页重新复制粘贴 API Key 后保存');
      friendly.code = 'EINVALIDKEY';
      friendly.originalError = e;
      return friendly;
    }
    // 🔧 保留真实错误码（不再一律标 ENOTFOUND），便于区分 DNS/连接/构造失败
    const normalized = new Error(rawMsg);
    normalized.code = e.name === 'AbortError' ? 'ECONNABORTED' : (e.code || e.cause?.code || 'ENOTFOUND');
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
// 🔧 工具函数：分层注入 + 精准检索 + 格式常量
// ============================================================

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
// 🔑 统一使用共享工具 ../utils/gradeStage.js 的 extractGradeNum（曾因本地 parseInt('六年级')
//    得 NaN→0 误判学段；全项目禁止再各自 parseInt(grade) 直接解析中文年级）

import { postProcessOCR, _fixTemplateOptionGlue as fixTemplateOptionGlue, countFixes, _addTemplateStructureMarkers as addTemplateStructureMarkers } from '../utils/textRepair.js';
import { SemanticRetriever, semanticRetriever } from '../utils/semanticRetriever.js';
import { cleanSectionHtml, htmlToPlainText, normalizeBlankMarkers, normalizeMatchQuestions, normalizeLeadingMarkers, normalizeMathCircleBlanks, normalizeIndents, blankWidthForChars, shortBlankWidth, spaceBlankWidth } from '../utils/contentCleaner.js';
import { djb2 } from '../utils/hash.js'; // 原文变更检测哈希唯一实现（与 GenerateModule 写 _analyzedTextHash 共用，曾各自复制）

// 别名：保持原有名称兼容
const _isWordBoundaryMatch = undefined; /* replaced by isWordBoundaryMatch import */
const _fixTemplateOptionGlue = fixTemplateOptionGlue;
const _countFixes = countFixes;
const _robustJsonParse = robustJsonParse;
const _addTemplateStructureMarkers = addTemplateStructureMarkers;


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

  // ── 步骤1.8：括号（可双层）包裹"下划线/空格"组合 → 括号填空 <span class="blank-N">&emsp;</span> ──
  // 用户规格：括号用英文状态（半角）括号，括号与横线二选一、严禁混用——
  // 任何"括号+下划线"组合（（_____）、(＿_＿)、（＿ ＿）、双层括号（(_ _)）等）一律归一为
  // <span class="blank-N">&emsp;</span>，不再原样残留；纯空白括号交给步骤3处理
  // 🔧 span.blank-N 渲染自带半角括号（预览 CSS ::before/::after + docx 导出显式补 ()）——
  //    清洗器不再包外层括号，否则预览/导出会变成双层括号 ((　))
  result = result.replace(/(?:[（(]{1,2})\s*([_\uFF3F\s\u3000]{1,24})\s*(?:[）)]{1,2})/g, (match, inner) => {
    const u = (inner.match(/[_\uFF3F]/g) || []).length;
    if (u === 0) return match; // 无下划线 → 交给步骤3（括号+纯空白）
    // 🔴 宽度换算唯一事实源 = contentCleaner 共享函数（读 layoutSpec.BLANK），不在此另建梯形
    return `<span class="blank-${shortBlankWidth(u)}">&emsp;</span>`;
  });

  // ── 步骤1.7a：单边左括号 + 下划线（无右括号，完整对已被1.8/1.9处理，此处无需负向前瞻）→ <span> ──
  result = result.replace(/(?:[（(])\s*([_\uFF3F]{3,})/g, (match, underscores) => {
    return `<span class="blank-${shortBlankWidth(underscores.length)}">&emsp;</span>`;
  });

  // ── 步骤1.7b：下划线 + 单边右括号（无左括号，完整对已被1.8/1.9处理）→ <span> ──
  result = result.replace(/([_\uFF3F]{3,})\s*(?:[）)])/g, (match, underscores) => {
    return `<span class="blank-${shortBlankWidth(underscores.length)}">&emsp;</span>`;
  });

  // ── 步骤2：裸露下划线 → <u class="blank-N">&emsp;</u>（无外壳包裹 → 横线书写区；半角/全角均支持）──
  // 🔴 宽度换算唯一事实源 = blankWidthForChars（读 layoutSpec.BLANK：1 字位 ≈ wordGap em），与正文层 normalizeBlankMarkers 同口径；
  //    曾用 1:1 硬编码梯形（≤4→4）导致同一 ＿ 输入两处宽度不同、排版规格对 callAI 层不生效——已收敛
  //    ≥2 即转（曾要求 ≥3，ASCII "__" 短空会漏；正文层 ≥2 同口径）；半角 _ 按 0.5 字计（视觉半宽）
  result = result.replace(/[\uFF3F_]{2,}/g, (match) => {
    const em = (match.match(/\uFF3F/g) || []).length + (match.match(/_/g) || []).length * 0.5;
    return `<u class="blank-${blankWidthForChars(Math.round(em))}">&emsp;</u>`;
  });


  // ── 步骤3：括号内纯空白 → <span class="blank-N">&emsp;</span>（括号填空；可双层括号，归一为单层英文状态括号）──
  // 🔧 匹配集加入全角空格 \u3000：模型按"半角括号内全角空格 (　)"规则输出时，此前因不匹配而原样保留成英文括号形态
  result = result.replace(/(?:[（(]{1,2})((?:\s|&emsp;|\u2003|\u3000|&nbsp;| )+)(?:[）)]{1,2})/g, (match, inner) => {
    // 统计空白宽度：&emsp;/\u2003/\u3000 每字符≈1em，&nbsp;/  每字符≈0.25em
    const emspCount = (inner.match(/&emsp;/gi) || []).length + (inner.match(/\u2003/g) || []).length + (inner.match(/\u3000/g) || []).length;
    const nbspCount = (inner.match(/&nbsp;| /gi) || []).length;
    const totalWidth = emspCount + nbspCount * 0.25;
    if (totalWidth <= 0) return match; // 无有效空白，保持原样
    // 🔴 宽度换算唯一事实源 = spaceBlankWidth（与正文层 normalizeBlankMarkers 同函数），不在此另建梯形
    return `<span class="blank-${spaceBlankWidth(totalWidth)}">&emsp;</span>`;
  });

  // ── 步骤3.5：归一保护标签外侧的括号 ──
  // span（括号填空）外层括号 → 剥离（span 渲染自带半角括号，外层括号会变双层 ((　))）；
  // u（横线填空）外层括号 → 剥离（横线不加括号，"横线就横线"）
  result = result.replace(/(?:[（(])\s*(\uE000PPKS\d+\uE001)\s*(?:[）)])/g, (m, p) => p);
  result = result.replace(/(?:[（(])\s*(PPKU\d+)\s*(?:[）)])/g, (m, p) => p);

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
  
  // ===== 格式A：markdown 代码块处理（剥除 ``` 包裹标记，保留代码块内外的全部正文）=====
  // 🔴 回归修复：此前"只提取代码块内内容、丢弃代码块外正文"，导致模型在"叙述＋多代码块"
  //    混排输出时，代码块外的教材正文/作答横线载体被整段剥除（7万字符 → 5千，内容量不足+横线丢失）。
  //    改为：仅剥除 ```html/``` 包裹标记本身，代码块内与代码块外的内容一并保留（去对话前缀/后缀走 sanitize）。
  //    单个代码块包裹全文的形态同样成立（剥标记后即全文正文）。
  if (/(```|```html)/.test(text)) {
    // 仅剥除 ```html?/ ``` 包裹标记词本身，标记外与标记内的全部正文一并保留
    let cleaned = text.replace(/```(?:html?|HTML?)?/gi, '');
    cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n'); // 压缩剥标记后产生的多余空行
    // 🔧 剥除叙述前缀：首个 HTML 标签前的对话式开场（"以下是为您生成…""这是…"）不保留，
    //    后续 body 提取/convertBlankFormat 均需相对干净的正文输入
    const pIdx = cleaned.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span|u\b)\b/i);
    if (pIdx > 0 && pIdx < 2000) cleaned = cleaned.substring(pIdx);
    const withoutBlocks = cleaned.trim();
    if (withoutBlocks.length > 20) return sanitize(withoutBlocks);
    // 标记剥除后内容过短（空壳），回退按是否含 HTML 判定
    const fallbackHtmlIdx = withoutBlocks.search(/<(!DOCTYPE|html|head|body|h[1-6]|p\b|div|table|ul|ol|span|u\b)\b/i);
    if (fallbackHtmlIdx >= 0) return sanitize(withoutBlocks.substring(fallbackHtmlIdx));
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



// ===== 🔧 genType 感知的素材提取（第一步：逐课提取命题素材，供知识图谱与整卷生成） =====
// 为各资料类型从教材提取内容卡片（contentCards），主路径 generateFullPaperNatural 前置阶段
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

  // 🔧 目录卡片构建（无原文目录模式 & 未分析降级共用）
  //    目录（章节标题 + 子标题）本身就是考点线索，确保"仅勾选目录"也能生成：
  //    Step2 知识图谱基于目录标题 + 学科课标知识补全考点，生成端按指令分配考点，AI 无素材凭空生成。
  const buildTocCard = (chapter, mode = 'toc', stage = '') => {
    const collectTitles = (node, depth = 0, out = []) => {
      if (!node || depth >= 3) return out;
      for (const child of (node.children || [])) {
        if (child?.title) out.push('  '.repeat(depth) + child.title);
        collectTitles(child, depth + 1, out);
      }
      return out;
    };
    const tocText = [chapter.title, ...collectTitles(chapter)].filter(Boolean).join('\n');
    if (!tocText.trim()) return null;
    // 目录标题（章节 + 子标题）作为该卡片的检索关键词，供 retrieveSegments 命中
    const tocKps = [chapter.title, ...collectTitles(chapter).map(t => t.trim())].filter(Boolean);
    const isUnanalyzed = mode === 'unanalyzed';
    // 🔧 目录模式提示词：课标版本按学段注入（getCurriculumLabel），避免写死版本号（高中=2017版2020年修订，与 2022 义教版不同）
    const curriculumLabel = getCurriculumLabel(stage);
    return {
      chapterTitle: chapter.title,
      summary: isUnanalyzed
        ? `【未分析·目录模式】本课有教材原文但未执行分析提取（生成时不做现场分析）。以下为该课目录结构，生成时请基于章节标题与该学科课标（${curriculumLabel}）推断典型内容命题，题目情境/数据由你合理设计，禁止编造教材版本特有内容。如需完整命题素材，请先对本课执行"分析提取"：\n${tocText}`
        : `【仅目录模式】本课教材原文未提取（未 OCR/未分析），以下为该课目录结构。生成时请基于章节标题与该学科课标（${curriculumLabel}）推断典型内容命题，题目情境/数据由你合理设计，禁止编造教材版本特有内容：\n${tocText}`,
      knowledgePointsForTest: tocKps,
      segments: [{ text: tocText, type: '正文', isKeyConcept: false, isExample: false, hasFormula: false, knowledgePoints: tocKps }],
      totalSegments: 1,
      tags: ['toc-only'],
      isTocOnly: true,
      source: isUnanalyzed ? 'unanalyzed' : 'toc',
    };
  };

  for (const book of selectedBooks) {
    const chapters = book.selectedChapters || [];
    for (const chapter of chapters) {
      if (!chapter.rawText && !chapter.coreTopics) {
        // 🔴 目录模式（TOC-only）：章节无 OCR 原文且未分析时，用目录标题构建"目录卡片"
        const tocCard = buildTocCard(chapter, 'toc', book.stage);
        if (tocCard) {
          contentCards.push(tocCard);
          console.log(`📑 [Step1·目录模式] ${chapter.title}: 无教材原文，已生成目录卡片`);
        }
        continue;
      }
      let cleanRawText = chapter.rawText || '';

      // 🔧 检测原文是否被修改过（如用户粘贴了词汇表）
      // 优先：哈希精确比对（新数据 → 内容完全一致 → 绝对走捷径）——djb2 唯一实现 utils/hash（曾本地复制）
      // 兜底：长度比对（旧数据兼容 → 差≤300 即视为未变）
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
      // 🔴 方案A：有教材原文但未执行分析 → 不现场补分析（生成内补做基于不精准原文，质量不可控），
      //    统一降级为目录模式（与无原文章节同路径）；完整命题素材需先手动执行"分析提取"
      console.log(`📑 [Step1·未分析降级] ${chapter.title}: 有原文(${cleanRawText.length}字)但未分析，按目录模式生成（不现场补分析）`);
      const unanalyzedCard = buildTocCard(chapter, 'unanalyzed', book.stage);
      if (unanalyzedCard) contentCards.push(unanalyzedCard);
      continue;
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
  const inputDataDescRule = getAnalysisPrompts({ category: '分析-知识图谱构建' }).find(b => b.id.includes('input_data_desc'));
  const inputDataDescStr = inputDataDescRule ? inputDataDescRule.content : `- 输入为"各课内容概要"数组（数组内每个元素 = 一课）：title 章节标题；summary 章节概要；kpForTest 可考查知识点；keySegmentSamples 关键片段示例（含 type/hasFormula/snippet）；totalSegments 片段数；tagSummary 标签摘要；suggestedQuestionTypes 建议考查题型`;

  // 🔧 目录模式提示词：课标版本按学段注入（getCurriculumLabel），避免写死版本号
  const curriculumLabel = getCurriculumLabel(selectedBooks?.[0]?.stage, selectedBooks?.[0]?.grade, selectedBooks?.[0]?.name);
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

🔴 目录模式说明：若某课 summary 标注"仅目录模式"（教材原文未提取），请基于该课章节标题与该学科课标（${curriculumLabel}）推断典型内容知识点（如"分数的初步认识"→ 分数的含义/几分之一/几分之几），只推断标题明确指向的知识范畴，不得臆造超出该章节标题的内容。

返回JSON：{"knowledgePoints":[""],"keyDifficulties":[""],"knowledgeGraph":[{"unit":"","bigConcepts":[{"name":"","coreKnowledge":[{"name":"","cognitiveLevel":"理解","isKeyPoint":true,"isDifficulty":false,"specificConcepts":[""],"suggestedQuestionTypes":[""],"relatedChapters":[""],"testPriority":1}]}]}],"crossChapterLinks":[{"from":"","to":"","relation":"前置|并列|拓展|应用"}]}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response2 = await callAI(prompt2, { taskType: attempt >= 1 ? 'blueprint' : 'analysis', temperature: apiConfig.generationSettings.analysisTemperature, retries: 0, forceJson: true });
      const parsed = await robustJsonParse(response2, (rp) => callAI(rp, { taskType: 'analysis', temperature: apiConfig.generationSettings.analysisTemperature }), `第二步-尝试${attempt + 1}`);
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


// ============================================================
// 🔴 答案完整性判定（模块级纯函数，供生成链路调用 + 单元测试验证"答案是否丢失"）
// ============================================================

/** 截断判定：finish_reason=length/reasoning_capped（可靠）或尾部非完整句段（启发式兜底） */
export const detectTruncation = (content, finishReason = '') => {
  const c = String(content || '');
  const byReason = (finishReason === 'length' || finishReason === 'reasoning_capped') && c.length > 200;
  if (byReason) return { truncated: true, byReason: true };
  if (c.length <= GEN_CONST.BODY_TRUNCATED_HEURISTIC) return { truncated: false, byReason: false };
  const tail = c.slice(-GEN_CONST.TRUNCATED_TAIL_SAMPLE);
  return {
    truncated: !/<\/[a-z]+>$/i.test(tail) && !/[。！？；」』）)\n]$/.test(tail.trim()),
    byReason: false,
  };
};

/** 答案区空壳检测：<h2>参考答案… 后为占位式敷衍（"略/待补充"等）或近乎空白（<10 字且无作答痕迹）
 *  🔴 不做纯长度判据：真实答案可能很短（如纯选项 "1.A 2.B 3.C"），
 *     曾因 <40 字被误判空壳 → 剥离真实答案 → 独立补生成失败 → "步骤有答案、结果无答案"（历史事故根因） */
const ANSWER_SHELL_RE = /略|待补充|见教材|暂无|此处留白|待填写/;
export const isAnswerShell = (content) => {
  if (!content || !/<h2[^>]*>参考答案/.test(content)) return false;
  const m = String(content).match(/<h2[^>]*>参考答案[\s\S]*$/i);
  if (!m) return false;
  const text = m[0].replace(/<[^>]+>/g, '').replace(/\s/g, '');
  if (ANSWER_SHELL_RE.test(text)) return true;
  // 剔除标题本身（"参考答案与评分标准"等）再看正文：避免标题汉字被当作"作答痕迹"
  const body = text.replace(/^(参考答案与评分标准|参考答案与解析|参考答案)/, '');
  const hasAnswerTrace = /[0-9A-Ha-h]|[一-龥]|[（(]|[．.。]/.test(body);
  return body.length < 10 && !hasAnswerTrace;
};

/** once 模式答案区补包：<h2>参考答案… 无 answer-section 包裹 → 补包（docx 独立分节，页码不计入正文） */
export const wrapAnswerSection = (content) => {
  if (!content || /<div[^>]*class="[^"]*answer-section"/.test(content)) return String(content);
  return String(content).replace(/(<h2[^>]*>\s*参考答案[\s\S]*?)$/i, (m, ansPart) => `<div class="answer-section">\n${ansPart}</div>`);
};

/** split 模式正文混答剥离：正文末尾若混入《参考答案…》区（完整或空壳）→ 整体剥离，
 *  答案统一由独立答案页承载（与 wrapAnswerSection 互为反向；once 模式不调用，防止误剥正文答案）
 *  支持两种形态：answer-section 包裹的整块（含 div 外壳）、裸 <h2>参考答案… 到结尾 */
export const stripAnswerSection = (content) => {
  let out = String(content || '');
  out = out.replace(/<div[^>]*class="[^"]*answer-section[^"]*"[^>]*>[\s\S]*?<\/div>\s*$/i, '');
  out = out.replace(/<h2[^>]*>参考答案[\s\S]*$/i, '');
  return out;
};

/** 答案页自带标题去重（段2 独立答案页）：模型常在答案内容开头自带 <h1>参考答案与解析</h1>
 * （或 <h2> 同文、含"评分标准"等后缀），系统包装又会加 <h2>${ansTitle}</h2> →
 * 同一标题叠两层（2026-09 实证：answer-section 内 "参考答案与解析"×2）。
 * 剥除内容开头的"参考答案…"标题块（h1-h6），统一以系统包装标题为准；
 * 非"参考答案"开头的标题（如正文大题 h2"一、基础建构任务"）不动。
 * 覆盖 2026-09 缺口：模型常以 <div class="answer-page"><h3>参考答案…</h3> 开头
 * （标题被一层非标题块级容器包裹），原"^\s*<h"要求标题在最开头 → 漏剥 → h2/h3 双层残留。
 * 现允许开头先出现一层 <div>/<p> 容器后再匹配，仅剥"参考答案"标题、保留容器外壳。 */
export const stripLeadingAnswerTitle = (html = '') => String(html || '')
  .replace(/^(\s*(?:<(?:div|p)\b[^>]*>\s*)?)<h[1-6]\b[^>]*>\s*参考答案[^<]*<\/h[1-6]>\s*/i, '$1');

export function useAiGenerator() {
  const isGenerating = ref(false);
  const progress = ref(0);
  const statusText = ref('');
  const abortController = ref(null);

  // 🔧 新增：记录上次请求结束时间，用于智能等待
  const lastRequestEndTime = ref(0);
  // 🔧 新增：记录上次请求耗时（毫秒），用于动态调整等待策略
  const lastRequestDuration = ref(0);

  // 🔧 缓存的原始知识图谱（Step2 结果），供逐章生成复用
  let _cachedKnowledgeMap = null;
  let _cachedContentCards = null;
  let _cachedInstruction = null;
  // 🔧 AI修复防循环守卫：确保每次生成最多触发一次AI修复（防止无限调用API）
  let _repairActive = false;
  // 🔧 逐章生成模式：设置此 chapterTitle 后，generate() 从缓存中过滤出单章数据
  let _perChapterChapterTitle = null;

  // 🔧 资料类型名称池——轮换使用，避免标题千篇一律（词条不含"单元/课"等范围词，防与范围名重复）
  const GEN_TYPE_LABEL_POOLS = {
    exam: ['综合检测', '测试卷', '阶段测评'],
    practice: ['课堂练习', '随堂巩固', '课时训练'],
    special: ['专项突破', '专题训练', '强化练习'],
    preview: ['预习导航', '课前导学', '预习单'],
    reading: ['阅读理解', '阅读素养训练', '阅读训练'],
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

  // 🔧 命题范围标签词轮换（期中/期末/月考/专题）：避免连续生成同类试卷时标题千篇一律
  const _scopeLabelCounters = {};
  // 🔧 考试标签维度固定选择（名称样式弹窗：维度 → 固定名称；未设置=自动轮换）
  const _scopeLabelOverrides = {};
  const pickScopeFromPool = (scopeTypeVal = 'default') => {
    if (_scopeLabelOverrides[scopeTypeVal]) return _scopeLabelOverrides[scopeTypeVal]; // 维度固定优先
    const pool = SCOPE_LABEL_POOLS[scopeTypeVal] || SCOPE_LABEL_POOLS.default;
    const key = `scope__${scopeTypeVal}`;
    _scopeLabelCounters[key] = (_scopeLabelCounters[key] || 0) % pool.length;
    return pool[_scopeLabelCounters[key]++];
  };
  /** 🔧 设置考试标签维度的固定名称（如 期末 → '期末素养检测'）；null/空 = 恢复自动轮换 */
  const setScopeLabelOverride = (scopeTypeVal, label) => {
    if (label) _scopeLabelOverrides[scopeTypeVal] = label;
    else delete _scopeLabelOverrides[scopeTypeVal];
  };

  /**
   * 从知识图谱中检测课时边界
   * 规则：knowledgeGraph[].bigConcepts[].coreKnowledge → 每个 bigConcept 对应一个课时
   * @param {Object} knowledgeMap - Step2 构建的知识图谱
   * @returns {Array<{id, unitName, periodName, knowledgePoints, kpCount}>}
   */
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
    // 🔧 获取引擎配置：支持 providerOverride（降级调用时直接指定提供商）
    let config;
    if (options.providerOverride) {
      // 降级路径：直接用指定提供商，不走默认引擎选择
      config = resolveProviderConfig(options.providerOverride, taskType);
      if (!config) throw new Error(`降级提供商 "${options.providerOverride}" 不可用，请检查 API Key 配置`);
      const temperatureMap = {
        'extraction': apiConfig.generationSettings.analysisTemperature,
        'analysis': apiConfig.generationSettings.analysisTemperature,
        'generation': apiConfig.generationSettings.paperTemperature,
        'questionValidation': 0,
        'formatting': apiConfig.generationSettings.analysisTemperature
      };
      config.temperature = temperatureMap[taskType] ?? apiConfig.generationSettings.paperTemperature;
      config.maxTokens = getTaskMaxTokens(taskType);
    } else {
      config = await getCurrentEngineConfigEnhanced(taskType, {
        promptLength: prompt?.length || 0,
        requiresChinese: true,
        requiresReasoning: ['blueprint', 'generation', 'review', 'questionValidation'].includes(taskType),
        requiresCreativity: taskType === 'generation'
      });
    }
    const modelName = config.textModel || config.model || 'AI';
    const modelDisplayName = getModelDisplayName(modelName);
    const maxTokens = options.maxTokens || config.maxTokens || 4096;
    
    // 🔧 调试日志：输出解析后的 maxTokens（便于排查 localStorage 覆盖问题）
    if (taskType === 'analysis') {
      console.log(`🔍 解析后 maxTokens = ${maxTokens} (来源: ${options.maxTokens ? 'options' : config.maxTokens ? 'config(task)' : 'fallback(4096)'})`);
    }
    // ✨ 动态超时：根据 prompt 长度自动调整（32B+大模型需更长）
    const baseTimeout = options.timeout || getTimeout('base');
    const estimatedTokensForTimeout = estimateTokens(prompt);
    // 🔧 检测大参数量模型，给予更多时间
    const isLargeModel = /(32b|70b|72b)/i.test(config.textModel || config.model || '');
    // 🔧 动态超时上限统一用 timeouts.max（600s）：SSE 心跳（默认 60s 无新数据即断流）才是主断流检测，
    //    总超时仅兜底，放宽不会"死等"；此前非大模型被 300s 卡住——长卷答案页（输入≈16K tokens）动态加成后被截，
    //    是"答案页在超大卷时失败/为空"的间接原因之一
    const maxTimeout = getTimeout('max');
    const dynamicTimeout = Math.min(
      baseTimeout + (estimatedTokensForTimeout / 1000) * getTimeout('per1000TokensMs'),
      maxTimeout
    );
    const timeout = dynamicTimeout;
    
    if (estimatedTokensForTimeout > 5000) {
      console.log(`⏰ 动态超时设置: ${timeout/1000}秒 (prompt: ${estimatedTokensForTimeout} tokens, 基础: ${baseTimeout/1000}秒)`);
    }
    
    const retries = options.retries ?? (apiConfig.generationSettings?.retry?.maxRetries ?? 2);
    
    // ✅ 优先用 options 的温度，其次用 config 的温度（已按任务类型设置）
    const temperature = options.temperature ?? config.temperature ?? 0.7;
    
    let finalPrompt = prompt;
    
const maxInputTokens = config.engine === 'deepseek' 
      ? (apiConfig.generationSettings.maxInputTokensDeepseek ?? 100000)
      : Math.floor(maxTokens * (apiConfig.generationSettings.maxInputTokensOllamaRatio ?? 0.7));
    
    // 🔧 生成自审机制：在生成类任务的 prompt 末尾追加自审指令（静默内检，不输出任何自审内容；
    //    注意：答案页独立调用（taskType=generation）也会携带本块，表述不得限定"只输出正文/试卷"，
    //    否则会与答案页任务（输出《参考答案与评分标准》）冲突导致答案区缺失）
    if (['generation', 'review'].includes(taskType) && !options.skipSelfReview) {
      const selfReviewInstruction = `

【🔍 输出前自检（静默内检，严禁输出任何检查过程、检查块或自审说明，只输出任务要求的最终内容）】
请逐题/逐条快速自检并直接在最终内容中修正：
1. 知识点准确性：概念、公式、史实、字词、拼音、数据是否准确无误？
2. 题目自洽：题干条件充分、设问与答案对应、无"略"等敷衍表述？
3. 学段适配：知识点与能力要求不超出本学段课标学业质量要求？
发现任何问题立即改正，然后只输出任务要求的最终内容（试卷/资料正文，或按要求输出的答案页）。`;
      
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
      console.warn(`⚠️ Prompt过长(${estimatedTokens} tokens)，正在智能压缩并保留关键指令块...`);

      // 分段：按 【 开头分段（保留块级边界）
      const sections = finalPrompt.split(/\n(?=【)/);
      const instructionParts = [];
      const materialParts = [];
      const guaranteeParts = [];

      // 简单规则识别 guarantee（必须保留）的段落关键词
      const guaranteeRegex = /角色身份|顶层约束|尾约束|答案区|强制要求|真题卷结构蓝本|骨架|真题蓝本|答案与解析/;

      for (const section of sections) {
        const s = section.trim();
        if (/^【教材原文|^【模板参考|^【教材参考/.test(s)) {
          materialParts.push(s);
        } else if (guaranteeRegex.test(s) || s.length < 200 && /你是一位|请一次性生成|必须/.test(s)) {
          // 识别为 guarantee 的关键指令块（尽量保留）
          guaranteeParts.push(s);
        } else {
          instructionParts.push(s);
        }
      }

      // 优先保留 guaranteeParts 与 instructionParts；只压缩 materialParts
      let instructionText = [...guaranteeParts, ...instructionParts].join('\n');
      let instructionTokens = estimateTokens(instructionText);

      // 如果指令本身就超预算，尝试把 guaranteeParts 放到 systemMessage 路径（由上层调用传给模型的 system），
      // 这里我们简化为截断非 guarantee instruction 内容并记录告警
      if (instructionTokens > maxInputTokens - 500) {
        console.warn('⚠️ 指令部分（含必须保留块）已超出输入上限，尝试优先保留 guarantee 块并截断其他指令');
        // 保留 guaranteeParts，截断 instructionParts
        instructionText = guaranteeParts.join('\n');
        instructionTokens = estimateTokens(instructionText);
        if (instructionTokens > maxInputTokens - 200) {
          // 极端：连 guarantee 都超出预算，硬截断并记录
          instructionText = instructionText.substring(0, Math.floor((maxInputTokens - 200) * 1.5));
          console.error('🔥 关键指令块超预算，被迫截断（记录详单以便人工介入）');
        }
      }

      const remainingBudget = maxInputTokens - instructionTokens - 200; // 留 200 tokens 缓冲
      let materialText = '';
      let usedTokens = 0;
      const omittedSections = [];

      if (remainingBudget > 300) {
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
          } else {
            omittedSections.push(part.slice(0, 120));
          }
        }
      } else {
        // 预算不足，全部省略 materialParts
        for (const part of materialParts) omittedSections.push(part.slice(0, 120));
      }

      finalPrompt = instructionText + '\n' + materialText;
      if (omittedSections.length > 0) {
        console.warn('⚠️ 已省略/压缩以下参考段落（示例）:', omittedSections.slice(0,5));
        // 将省略信息附加为显式告警，便于模型和日志追踪
        finalPrompt += '\n\n【系统提示：以下若干参考段落因输入长度受限已被压缩或省略，生成时优先遵循前文关键指令块；如需完整参考请分段生成或增加上下文窗口】\n';
      }

      console.log(`📦 智能压缩完成：指令${instructionTokens}tokens + 原文${usedTokens}tokens (buffered)`);
    }
    
    // 🔧 L1 客户端缓存：仅缓存确定性中间任务（analysis/blueprint/extraction）
    //    跳过 generation/review 保证每次生成的创意多样性和审查新鲜度
    const CACHEABLE_TASKS = ['analysis', 'blueprint', 'extraction'];
    const cacheable = CACHEABLE_TASKS.includes(taskType) && !options.skipCache;
    if (cacheable) {
      const cacheKey = generatePromptCacheKey(taskType, modelName, finalPrompt);
      const cached = await getCachedPromptResult(cacheKey);
      if (cached) {
        console.log(`✅ [L1缓存] ${taskType} 命中，跳过 API 调用`);
        return cached;
      }
      // 缓存未命中 → 继续 API 调用，成功后写入
      callAI._pendingCacheKey = cacheKey;
      callAI._pendingCacheMeta = { taskType, model: modelName };
    } else {
      callAI._pendingCacheKey = null;
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
          await new Promise(r => setTimeout(r, apiConfig.generationSettings?.retry?.baseDelayMs ?? 2000));
        }
        
        if (attempt > 0) {
          // 重试时固定等待
          const waitTime = getRetryDelay(config.engine, attempt);
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
              await axios.get(`${config.baseUrl}/api/tags`, { timeout: getTimeout('ollamaPreflight') });
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
              // 🔧 本地推理开关走设置页（ollamaGenerationThinking，默认关闭）——r1 等推理模型开启后输出推理链，提速省显存由用户权衡
              think: apiConfig.generationSettings?.ollamaGenerationThinking ?? false,
              keep_alive: 600,  // 🔧 保持 10 分钟，避免频繁重新加载
              // 🔧 System 分离：规则/格式/蓝本入 system（Ollama /api/generate 原生支持 system 字段）
              ...(options.systemMessage ? { system: options.systemMessage } : {}),
              // ✅ forceJson：仅对非推理模型启用（r1/deepseek 思考链会破坏 JSON 格式）
              ...(options.forceJson && !config.textModel?.includes('r1') && !config.textModel?.includes('deepseek') ? { format: 'json' } : {}),
              options: {
                temperature: temperature,
                num_predict: maxTokens,
                top_p: apiConfig.generationSettings.topP || 0.9,
                repeat_penalty: apiConfig.generationSettings.repeatPenalty || 1.1,
                // 🔧 R1/推理模型优化：限制上下文窗口避免爆显存，num_gpu=999 最大化 GPU 层
                ...(config.textModel?.includes('r1') || config.textModel?.includes('deepseek') ? {
                  num_ctx: apiConfig.generationSettings.ollamaR1NumCtx ?? 4096,
                  num_gpu: apiConfig.generationSettings.ollamaR1NumGpu ?? 999
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
          const isTruncated = !ollamaDone && responseText.length > GEN_CONST.TRUNCATED_MIN_LEN;

          if (isTruncated && allowContinuation) {
            console.log(`🔄 Ollama 输出被截断，尝试续写...（当前长度：${responseText.length}）`);
            
            // 取最后 300 字作为续写提示
            const tailText = responseText.slice(-GEN_CONST.CONTINUE_TAIL_SAMPLE);
            const continuationPrompt = `【继续】请从上一次输出的最后一个字开始，继续后面的内容。不要重复已有文字。\n\n上一段末尾：${tailText}\n\n继续：`;
            
            let continuationResponse;
            try {
              continuationResponse = await axios.post(
                `${config.baseUrl}/api/generate`,
                {
                  model: config.textModel,
                  prompt: continuationPrompt,
                  stream: false,
                  think: apiConfig.generationSettings?.ollamaGenerationThinking ?? false,  // 🔧 续写与主调用同开关（设置页 ollamaGenerationThinking）
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
              if (continuationText && continuationText.length > GEN_CONST.CONT_ACCEPT_MIN_LEN) {
                // 🔧 增强：更智能的去重——找到最长公共前缀并截掉
                let cleanContinuation = continuationText;
                
                // 策略1：精确匹配末尾20字
                const tailWords = tailText.slice(-GEN_CONST.DEDUP_TAIL_EXACT);
                if (cleanContinuation.startsWith(tailWords)) {
                  cleanContinuation = cleanContinuation.slice(tailWords.length);
                } else {
                  // 策略2：渐进式匹配——从10字到3字递减
                  let overlapFound = false;
                  for (let overlapLen = GEN_CONST.DEDUP_OVERLAP_MAX; overlapLen >= GEN_CONST.DEDUP_OVERLAP_MIN; overlapLen--) {
                    const tailOverlap = tailText.slice(-overlapLen);
                    if (cleanContinuation.startsWith(tailOverlap)) {
                      cleanContinuation = cleanContinuation.slice(overlapLen);
                      overlapFound = true;
                      console.log(`🔧 找到重叠(长度${overlapLen})，已去除`);
                      break;
                    }
                  }
                  if (!overlapFound && cleanContinuation.length > GEN_CONST.DEDUP_NEWLINE_MIN) {
                    // 策略3：检查是否有换行分隔，取换行后的内容
                    const newlineIdx = cleanContinuation.indexOf('\n');
                    if (newlineIdx > 0 && newlineIdx < 30) {
                      const afterNewline = cleanContinuation.slice(newlineIdx + 1).trim();
                      if (afterNewline.length > GEN_CONST.CONT_ACCEPT_MIN_LEN) {
                        cleanContinuation = afterNewline;
                        console.log('🔧 取换行后内容作为续写');
                      }
                    }
                  }
                }
                
                // 🔧 新增：续写质量检查——如果续写内容太短或全是空白，放弃续写
                if (cleanContinuation.trim().length < GEN_CONST.CONT_REJECT_MIN_LEN) {
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

          // 🔧 L1 缓存写入（仅 analysis/blueprint/extraction 任务）
          if (callAI._pendingCacheKey) {
            await setCachedPromptResult(callAI._pendingCacheKey, responseText, callAI._pendingCacheMeta);
          }

          return responseText;
        } else {
          // 🔧 DeepSeek API 调用：智能构建 URL，避免重复拼接
          let apiUrl = config.baseUrl || '';

          // 🔧 防御：确保 apiUrl 有效
          if (!apiUrl) {
            throw new Error('DeepSeek API 地址未配置，请在设置中填写 API 地址');
          }

          // 🔧 端点拼接：OpenAI 兼容协议统一为 baseUrl + /chat/completions
          //    各厂商 baseUrl 形态不同：DeepSeek .../v1、火山 .../api/v3、智谱 .../api/paas/v4、阿里 .../compatible-mode/v1
          //    一律直接追加 /chat/completions（不能强加 /v1，否则火山/智谱会被拼成错误地址）
          if (apiUrl.includes('/chat/completions')) {
            console.warn('⚠️ baseUrl 已包含完整路径，直接使用');
          } else {
            apiUrl = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
          }

          console.log(`🔗 AI API URL (${config.provider}): ${apiUrl}`);

          // 🌡️ 熔断器检查
          if (deepseekBreaker.isOpen) {
            const remainingCooldown = Math.ceil((deepseekBreaker.lastFailTime + deepseekBreaker.cooldownMs - Date.now()) / 1000);
            throw new Error(`DeepSeek 服务暂时熔断中，请 ${Math.max(1, remainingCooldown)} 秒后重试`);
          }

          // 🔧 API Key 合法性预检：含非 ASCII/空白（中文/零宽字符/全角等）时 fetch 构造请求头会直接抛错，
          //    且会被误报为网络错误。这里提前拦截，给出明确修复指引
          if (config.apiKey && /[^\x21-\x7E]/.test(config.apiKey)) {
            throw new Error('API Key 包含非法字符（应仅含英文、数字、连字符）。请到设置页重新复制粘贴 API Key 后保存');
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
            // 🔧 各引擎思考模式统一走设置页开关（generationSettings.*GenerationThinking，按当前引擎读取）：
            //    仅整卷生成（generation）任务生效；分析/审查/格式化/提取/验算等其他任务始终关闭思考；
            //    options.thinking 显式传参时优先（整卷思考耗尽→降级重试需强制关闭思考）
            ...(config.provider === 'alibaba' && /qwen3.*max|qwq/i.test(config.model || '') ? { enable_thinking: !!(apiConfig.generationSettings?.alibabaGenerationThinking) } : {}),
            ...(config.provider === 'volcano' ? { thinking: { type: (options.thinking !== undefined ? options.thinking : (taskType === 'generation' && apiConfig.generationSettings?.volcanoGenerationThinking)) ? 'enabled' : 'disabled' } } : {}),
            ...(config.provider === 'deepseek' ? { thinking: { type: (options.thinking !== undefined ? options.thinking : (taskType === 'generation' && apiConfig.generationSettings?.deepseekGenerationThinking)) ? 'enabled' : 'disabled' } } : {}),
            ...(config.provider === 'zhipu' ? { thinking: { type: (options.thinking !== undefined ? options.thinking : (taskType === 'generation' && apiConfig.generationSettings?.zhipuGenerationThinking)) ? 'enabled' : 'disabled' } } : {})
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

          const { content: streamedContent, finishReason: streamedFinishReason, reasoningChunkCount: streamedReasoning } =
            await parseSSEStream(streamResponse, abortController.value?.signal, getTimeout('sseHeartbeat'), options.maxReasoningChunks);

          let content = streamedContent;
          let finishReason = streamedFinishReason;

          // 🔧 自动续写机制（截断检测）
          const allowContinuation = options.allowContinuation !== false;
          // 🔴 reasoning_capped（推理达到 maxReasoningChunks 上限被流式中止）也视为截断——
          //    此前只认 finish_reason=length：思考模式推理占满上限时 content 可能只剩半截，
          //    不续写直接返回 → 答案页/正文后半段丢失（"无答案页"嫌疑路径之一）
          const isTruncated = (finishReason === 'length' || finishReason === 'reasoning_capped') && content.length > GEN_CONST.TRUNCATED_MIN_LEN;

          if (isTruncated && allowContinuation) {
            console.log(`🔄 DeepSeek 输出被截断，尝试续写...（当前长度：${content.length}）`);

            const tailText = content.slice(-GEN_CONST.CONTINUE_TAIL_SAMPLE);
            const continuationMessages = [
              { role: 'user', content: finalPrompt },
              { role: 'assistant', content: content },
              { role: 'user', content: `请从上一次输出的最后一个字开始，继续后面的内容。不要重复已有文字，不要重新开始。\n上一段末尾：${tailText}` }
            ];

            try {
              // 🔴 续写请求加 30s 超时保护（原无 timeout，API 无响应会永久挂起——实测"卡住不动"根因之一）
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
                  ...(config.provider === 'alibaba' && /qwen3.*max|qwq/i.test(config.model || '') ? { enable_thinking: !!(apiConfig.generationSettings?.alibabaGenerationThinking) } : {}),
                  ...(config.provider === 'volcano' ? { thinking: { type: (options.thinking !== undefined ? options.thinking : (taskType === 'generation' && apiConfig.generationSettings?.volcanoGenerationThinking)) ? 'enabled' : 'disabled' } } : {}),
                  ...(config.provider === 'deepseek' ? { thinking: { type: (options.thinking !== undefined ? options.thinking : (taskType === 'generation' && apiConfig.generationSettings?.deepseekGenerationThinking)) ? 'enabled' : 'disabled' } } : {}),
                  ...(config.provider === 'zhipu' ? { thinking: { type: (options.thinking !== undefined ? options.thinking : (taskType === 'generation' && apiConfig.generationSettings?.zhipuGenerationThinking)) ? 'enabled' : 'disabled' } } : {})
                }),
                signal: AbortSignal.timeout(getTimeout('continuation'))
              });

              if (continuationResponse.ok) {
                const contData = await continuationResponse.json();
                const continuationText = contData.choices?.[0]?.message?.content || '';
                if (continuationText && continuationText.length > GEN_CONST.CONT_ACCEPT_MIN_LEN) {
                  // 🔧 增强：更智能的去重
                  let cleanContinuation = continuationText;

                  const tailWords = tailText.slice(-GEN_CONST.DEDUP_TAIL_EXACT);
                  if (cleanContinuation.startsWith(tailWords)) {
                    cleanContinuation = cleanContinuation.slice(tailWords.length);
                  } else {
                    let overlapFound = false;
                    for (let overlapLen = GEN_CONST.DEDUP_OVERLAP_MAX; overlapLen >= GEN_CONST.DEDUP_OVERLAP_MIN; overlapLen--) {
                      const tailOverlap = tailText.slice(-overlapLen);
                      if (cleanContinuation.startsWith(tailOverlap)) {
                        cleanContinuation = cleanContinuation.slice(overlapLen);
                        overlapFound = true;
                        console.log(`🔧 找到重叠(长度${overlapLen})，已去除`);
                        break;
                      }
                    }
                    if (!overlapFound && cleanContinuation.length > GEN_CONST.DEDUP_NEWLINE_MIN) {
                      const newlineIdx = cleanContinuation.indexOf('\n');
                      if (newlineIdx > 0 && newlineIdx < 30) {
                        const afterNewline = cleanContinuation.slice(newlineIdx + 1).trim();
                        if (afterNewline.length > GEN_CONST.CONT_ACCEPT_MIN_LEN) {
                          cleanContinuation = afterNewline;
                          console.log('🔧 取换行后内容作为DeepSeek续写');
                        }
                      }
                    }
                  }

                  if (cleanContinuation.trim().length < GEN_CONST.CONT_REJECT_MIN_LEN) {
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

          // 🔧 L1 缓存写入（仅 analysis/blueprint/extraction 任务）
          if (callAI._pendingCacheKey) {
            await setCachedPromptResult(callAI._pendingCacheKey, content, callAI._pendingCacheMeta);
          }

          // 🔧 returnMeta 模式：返回 { content, finishReason, reasoningChunkCount } 供调用方做思考耗尽降级判断
          //    （默认返回字符串，不破坏现有调用方）
          return options.returnMeta
            ? { content, finishReason, reasoningChunkCount: streamedReasoning }
            : content;
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

    // 🔧 提供商降级：仅 extraction/formatting（简单任务）失败后尝试免费 GLM 兜底
    //    generation/blueprint/review/analysis 不降级——保证资料生成质量
    const FALLBACK_ALLOWED_TASKS = ['extraction', 'formatting'];
    if (FALLBACK_ALLOWED_TASKS.includes(taskType) && !options.providerOverride) {
      const glmConfig = resolveProviderConfig('zhipu', taskType);
      if (glmConfig && glmConfig.apiKey) {
        console.warn(`🔄 [降级] ${taskType} 主引擎失败，尝试智谱 GLM 兜底...`);
        try {
          return await callAI(prompt, {
            ...options,
            providerOverride: 'zhipu',
            retries: 0,
            skipCache: true  // 降级结果不写缓存（避免缓存降级质量的结果）
          });
        } catch (fallbackErr) {
          console.error(`❌ [降级] GLM 兜底也失败: ${fallbackErr.message}`);
        }
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
                    temperature: apiConfig.generationSettings.analysisTemperature
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
                  options: { temperature: apiConfig.generationSettings.analysisTemperature }
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
              
              // 🔧 端点拼接：OpenAI 兼容协议统一为 baseUrl + /chat/completions
              //    各厂商 baseUrl 形态不同（DeepSeek .../v1、火山 .../api/v3、智谱 .../api/paas/v4、阿里 .../compatible-mode/v1）
              if (apiUrl.includes('/chat/completions')) {
                console.warn('⚠️ baseUrl 已包含完整路径，直接使用');
              } else {
                apiUrl = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
              }
              
              console.log(`🔗 AI API URL (${textConfig.provider}): ${apiUrl}`);
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
                  temperature: apiConfig.generationSettings.analysisTemperature,
                  max_tokens: 256,  // 🔧 推理模型思考链+回复共享配额，200+才够输出content+reasoning
                  stream: false,     // 🔧 显式指定，与生成调用的 stream:true 对齐 API 规范
                  ...(textConfig.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),  // 🔧 连通检测：关闭思考，快速返回
                  ...(textConfig.provider === 'volcano' ? { thinking: { type: 'disabled' } } : {})     // 🔧 火山默认开深度思考，检测时强制关闭加速
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
            timeout: getTimeout('extraction'), // 2分钟超时
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
            timeout: getTimeout('analysis'),  // 🔧 显式设置5分钟超时（配合重试机制）
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
4. **学科要素/单元重点**：如果有明确的学科要素（如语文的阅读方法、写作方法，其他学科的学习方法、学科思想）或单元重点，请提取

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
          "name": "学习目标或学科要素名称",
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
- 📝 写作/口语交际/跨学科学习/名著导读要求
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
        temperature: apiConfig.generationSettings.analysisTemperature,
        timeout: getTimeout('analysis'),
        // 🔧 推理模型思考链+输出共享，不硬编码maxTokens，走config统一配置（V4 上限 384K）
      });
      
      console.log(`✅ 教材特征分析完成，响应长度: ${response?.length || 0}字`);
  
      try {
        const parsed = await robustJsonParse(
          response,
          (retryPrompt) => callAI(retryPrompt, { taskType: 'analysis', temperature: apiConfig.generationSettings.analysisTemperature }),
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

      // 第二步：分析模板结构（拆分为两步，避免长prompt超时）
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
          const analysisRules = getAnalysisPrompts({ category: '分析-文本分析规范' });
          const analysisExamples = getAnalysisPrompts({ category: '分析-分析模板示例', subject });
          const analysisExtractReqs = getAnalysisPrompts({ category: '分析-分析提取要求' });
          const fmtNote = analysisRules.find(b => b.id.includes('fmt_note'));
          const corePrinciple = analysisRules.find(b => b.id.includes('core_principle'));
          const mandRules = analysisRules.find(b => b.id.includes('mandatory_rules_full'));
          const diffRules = analysisRules.find(b => b.id.includes('difficulty_rules_full'));
          const examplesFull = analysisExamples.find(b => b.id.includes('examples_full') || b.id.includes('examples_math') || b.id.includes('examples_generic'));
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
          const mandRulesStr = mandRules ? mandRules.content : `1. 【大题名称】必须逐字复制原文中的原话，严禁任何归纳、改写、标准化\n   - ✅ 正确："一、按要求完成下面各题"\n   - ❌ 错误："综合题"（这是归纳，禁止！）\n   - ✅ 正确："三、生活与运用"\n   - ❌ 错误："生活应用题"（这是归纳，禁止！）\n   - ✅ 正确："四、阅读材料，完成练习"\n   - ❌ 错误："材料分析题"（这是归纳，禁止！）\n2. 【题型】必须逐字复制原文中的原话，严禁归类为标准题型\n   - ✅ 正确："按要求完成下面各题"\n   - ❌ 错误："综合题"（这是归纳，禁止！）\n   - ✅ 正确："选择正确的答案"\n   - ❌ 错误："选择题"（这是标准化，禁止！）\n3. 【设问风格】必须直接引用原文中的原句，不要改写或总结\n   - ✅ 正确："在横线上写出合适的词语"\n   - ❌ 错误："词语填空"（这是改写，禁止！）\n   - ✅ 正确："选择下面说法正确的一项"\n   - ❌ 错误："单选题"（这是归纳，禁止！）\n4. 【难度】需要根据题目内容分析判断（基础/中等/较难）← 唯一可以由AI判断的字段\n5. 【分值】只有原文明确标注了才能填写；没有标注的填0，严禁自己估算\n6. 【小题序号】必须从原文中逐题提取，原文用什么序号就用什么\n7. 【小题数量】必须从原文中逐题提取，原文有几个就填几个`;
          const diffRulesStr = diffRules ? diffRules.content : `难度分为三个等级：基础、中等、较难\n\n**基础题特征**：\n- 直接考查基础知识（如字词识记、概念理解、简单计算）\n- 答案唯一且明确，不需要复杂推理\n- 示例："写出指定词语的意思""计算指定算式的结果"\n\n**中等题特征**：\n- 需要理解上下文或联系多个知识点\n- 有一定推理过程，需要分析或比较\n- 示例："联系上下文理解内容含义""选择与示例特点相同的选项"\n\n**较难题特征**：\n- 需要综合运用多个知识点，创造性思维\n- 开放性较强，需要深度分析\n- 示例："概括材料的主要内容""评价材料中的观点"\n\n**判断原则**：\n1. 如果原文中有明确标注（如"提高题""拓展题"），优先使用原文标注\n2. 如果没有标注，根据上述规则分析题目内容后判断\n3. 同一道大题下的小题难度可能不同，需分别判断`;
          const examplesFullStr = examplesFull ? examplesFull.content : '';
          const errorExStr = errorEx ? errorEx.content : `❌ "题型": "综合题" → 原文写的是"一、按要求完成下面各题"，应该完整复制\n❌ "设问风格": "词语填空" → 原文写的是"在横线上写出合适的词语"，必须逐字复制\n❌ "小题数量": 20 → 原文没有明确说明小题数量，应该根据实际提取的小题计算`;
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
            temperature: apiConfig.generationSettings.analysisTemperature,
            timeout: getTimeout('analysis')
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
              temperature: apiConfig.generationSettings.analysisTemperature,
              timeout: getTimeout('chunk'),  // 🔧 优化：60秒（1分钟）
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
            const analysisRules = getAnalysisPrompts({ category: '分析-文本分析规范' });
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
   - ✅ 正确："一、按要求完成下面各题"
   - ❌ 错误："综合题"（这是归纳，禁止！）
   - ✅ 正确："三、生活与运用"
   - ❌ 错误："生活应用题"（这是归纳，禁止！）
2. 【题型】必须逐字复制原文中的原话
   - ✅ 正确："按要求完成下面各题"
   - ❌ 错误："综合题"（这是归纳，禁止！）
   - ✅ 正确："选择正确的答案"
   - ❌ 错误："选择题"（这是标准化，禁止！）
3. 【设问风格】必须直接引用原文中的原句
   - ✅ 正确："在横线上写出合适的词语"
   - ❌ 错误："词语填空"（这是改写，禁止！）
4. 【难度】需要根据题目内容分析判断（基础/中等/较难）← 唯一可以由AI判断的字段
5. 【分值】只有原文明确标注了才能填写，没有标注填0
6. 【小题序号】必须从原文中逐题提取，原文用什么序号就用什么
7. 【小题数量】必须从原文中逐题提取，原文有几个就填几个`;
            const diffRulesStr = diffRules ? diffRules.content : `- 基础题：直接考查基础知识（如字词识记、概念理解、简单计算）
- 中等题：需要理解上下文或联系多个知识点（如选择与示例特点相同的选项）
- 较难题：需要综合运用多个知识点，创造性思维（如概括材料主要内容、评价材料观点）`;

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
                temperature: apiConfig.generationSettings.analysisTemperature,
                timeout: getTimeout('analysis')
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
                    temperature: apiConfig.generationSettings.analysisTemperature,
                    timeout: getTimeout('chunk')
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
              temperature: apiConfig.generationSettings.analysisTemperature,
              timeout: getTimeout('analysis'),  // 第一次尝试：120秒
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
                temperature: apiConfig.generationSettings.analysisTemperature,
                timeout: getTimeout('chunk'),  // 简化版：60秒
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

  // 🔧 试卷/课时练题型框架：原则导向，不注入硬编码题量数字
  // DeepSeek 根据文本内容自主决定各层级的具体题量和题型
  // 🔧 从 stageMap 推导权威难度比例（当用户未自定义时以此为准）
  // 🔧 值从指令库「生成-难度配置」解析，兜底保留硬编码

  // 🔧 智能默认总分：对标现行考试标准
  // 🔧 值从指令库「生成-难度配置」解析，兜底保留硬编码

  // 🔧 检测 questionTypes 是否使用默认值（空数组或旧三件套）
  const isDefaultQuestionTypes = (questionTypes) => {
    if (!questionTypes || questionTypes.length === 0) return true;
    if (questionTypes.length !== 3) return false;
    const names = questionTypes.map(q => q.name).sort().join(',');
    return names === '填空题,解答题,选择题';
  };
  // ═══════════════════════════════════════
  // 🔧 教辅质量对标辅助函数（Q1-Q4）
  // ═══════════════════════════════════════

  // Q2: 知识点穷尽覆盖约束（优先从指令库读取；仅 summary/preview/special 有覆盖条目，其他 genType 静默返回空）

  // Q1: 答案与解析质量规范（按 genType × 学科）
  // 🔧 Q7: 答案质量标准 — 完全从指令库读取，不再硬编码

  // Q3: 主观题评分标准（完全从指令库读取）

  // Q4: 语文阅读理解答题模板（完全从指令库读取；仅 exam/practice/special/reading 需要，dictation/summary/preview/errorbook 不适用）

  // 🔧 Q7: 考卷时间分配 — 完全从指令库读取

  // ═══════════════════════════════════════
  // Fix A: Few-shot 质量范例（完全从指令库读取）
  // ═══════════════════════════════════════

  // 🔧 Q7: 知识边界约束 — 完全从指令库读取

  // ==================== 指令构建 ====================


  // 🔴 死代码已删除：performSemanticReview / repairSemanticIssues / attemptContentRepair
  //    （AI 语义审查 + AI 内容修复——"自产自评"质检残留，均不再被调用）

  // 🔴 repairSemanticIssues / attemptContentRepair 已删除（自产自评质检残留）

// ==================== 🔧 整卷生成（DeepSeek 云端主路径）====================
  // 核心任务 + 结构大纲 + 知识图谱 + 教材原文 + 格式约束 → 一次性产出整份 HTML
  // 取代原 Step3（蓝图规划）+ Step4（逐题生成），让 DeepSeek 云端模型充分发挥原生能力

  // 🔴 generateByRecipe（配方/分步流水线入口）已删除：生成入口切换为整卷一次生成
  //    （generateFullPaperNatural，指令库驱动）。分步流水线相关文件（recipe/ 目录）同步删除。

  /**
   * 🔴 素材构建：按本资料覆盖的知识点检索教材原文片段（RAG 思路，非全量注入/硬截断）
   * - 章节目录（前部）：告知覆盖范围
   * - 原文片段（中部）：每知识点保底 top1 片段（保证每个考点都有原文依据，防相关度排序
   *   把后段知识点的片段挤掉）；未命中片段的知识点自动拆词补检（覆盖度检查，静默 debug）；
   *   剩余预算按相关度增量补充；总量受 maxChars 上限兜底（丢的是无关片段，不是考点原文）
   * - 考查知识点清单（尾部锚点，中性措辞不加禁令）：生成时模型眼前即是覆盖范围
   * @returns {string} 素材块文本（空串 = 无素材）
   */
  // ── 教材附件式浏览（大范围工具路径；设计文档 v2：Q1/Q2/Q3/Q6） ─────────
  // 触发：勾选区累计原文字数 > 该类型素材预算 且 引擎支持 tools。
  // 前缀仅含 指令(含目录骨架)+模板对标+情境+输出约定；原文与整册知识清单不入前缀，
  // 由模型按章 browse 后置追加进 messages 尾部（缓存前缀不被大块原文扰动）。详见 design v2。
  const TOOLS_SUPPORTED_PROVIDERS = ['deepseek', 'zhipu', 'volcano', 'alibaba'];
  const clampB = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const normChapter = (t) => String(t || '').replace(/\s+/g, '').replace(/[（(].*?[)）]/g, '').trim();
  const BROWSE_TOOL = {
    type: 'function',
    function: {
      name: 'browse_textbook',
      description: '浏览教材：按章节名从当前所选课本中取回该章的教材原文片段与该章知识点，作为本卷/本资料取材依据（教材版本以所选课本为准）。',
      parameters: {
        type: 'object',
        properties: {
          chapter: { type: 'string', description: '章节名，须列在【本资料覆盖范围·目录】中' },
          knowledge: { type: 'string', description: '（可选）需要的知识点关键词' },
        },
        required: ['chapter'],
      },
    },
  };
  const BROWSE_SYSTEM = [
    '你是教材命题/教辅编辑，依据当前所选课本与相应学段课标要求，生成正式卷面的正文。',
    '【教材取材约定】',
    '· 需要某章原文作依据时，调用 browse_textbook，按章节名取回该章的原文片段与该章知识点；',
    '· 每个章节只需浏览一次，同一章节不可重复浏览；',
    '· 取到本卷所需章节的原文后，必须立即停止调用工具，依据已浏览到的原文与课标术语完成命题，不再发起任何工具调用；',
    '· 已浏览过的章节，直接依据已有的原文命题，不要重复调用。',
    '· 不把具体选文名写进标题或大题名（大题名使用结构名）。',
  ].join('\n');
  const deriveBrowseParams = (budget, chapterCount = 1) => {
    // 🔧 P2-1/P2-3 单章取料与轮数按章节数适配：
    //   - perBrowseCap 由 budget/12(下限400) 提至 budget/6(下限800、上限1800)，让单章在预算允许下取到更充分的原文；
    //   - maxRounds 由固定 4~15 改为至少覆盖"每章 2 轮"(主动浏览+漏章兜底)+2 轮正文，并为多章预留足够轮数，
    //     避免多章场景未及取材就触顶（模型收敛出正文即提前 break，轮数仅作护栏，不增加正常成本）。
    const perBrowseCap = clampB(Math.round(budget / 6), 800, 1800);
    const minRounds = Math.max(6, chapterCount * 2 + 2);
    const maxRounds = clampB(Math.max(Math.ceil(budget / perBrowseCap) * 2, minRounds), minRounds, 40);
    return { perBrowseCap, maxRounds };
  };

  // 大范围：程序侧确定性取料供给工具 browse_textbook；模型按章浏览、收敛后单主请求产出正文。
  // 返回 { content, coverageNotes }——coverageNotes 为防旧教材的主编式提醒（只提示，不改写）。
  const generateBodyByTextbookBrowse = async (params) => {
    const { genType, promptBase, maxTokens, temperature, contentCards = [], knowledgeMap = null, generateMode = 'once' } = params;
    const myBudget = GEN_CONST.MATERIAL_CHARS[genType] || 5000;
    const { perBrowseCap, maxRounds } = deriveBrowseParams(myBudget, (contentCards || []).length);

    // 章节→原文片段、章节→知识点 索引（与 buildMaterialBlock 同源，供 browse 确定性取料）
    const chapterSegsBy = new Map();
    // 🔧 P2-7 命名匹配加强：模型 browse 时往往传"第1课"这类主干名，而章节卡标题可能是"第1课·词语盘点"。
    //    登记索引时同步注册"目录主干键"，让主干名也能命中（精确键优先，主干仅在无歧义时兜底）。
    const chapterMain = (t) => { const n = String(t || '').trim(); const m = n.split(/[·.．:：]/)[0].trim(); return m || n; };
    for (const card of contentCards || []) {
      const key = normChapter(card?.chapterTitle);
      if (!key || !card?.segments?.length) continue;
      chapterSegsBy.set(key, card.segments);
      chapterSegsBy.set(card.chapterTitle, card.segments);
      const main = chapterMain(card.chapterTitle);
      if (main && main !== key) chapterSegsBy.set(main, card.segments);
    }
    const chapterKpBy = new Map();
    const addKp = (name, chs) => {
      if (!name) return;
      (chs || []).forEach((c) => {
        if (!c) return;
        const k = normChapter(c);
        if (!chapterKpBy.has(k)) chapterKpBy.set(k, []);
        if (!chapterKpBy.get(k).includes(name)) chapterKpBy.get(k).push(name);
      });
    };
    for (const kp of (knowledgeMap?.knowledgePoints || [])) {
      if (typeof kp === 'string') addKp(kp, []);
      else if (kp?.name) addKp(kp.name, kp.relatedChapters || []);
    }
    // 🔧 P1-2 统一知识点源：浏览路径与 buildMaterialBlock 同口径，同时吸收 knowledgeGraph 的细分层级知识点
    //    （bigConcept / coreKnowledge / specificConcepts），否则这些层级知识点在 browse 路径丢失，
    //    导致"素材注入有细分考点、浏览取料没考点"，覆盖口径漂移。
    for (const unit of (knowledgeMap?.knowledgeGraph || [])) {
      const unitName = unit?.unit || '';
      for (const bc of (unit.bigConcepts || [])) {
        if (bc?.bigConcept) addKp(bc.bigConcept, unitName ? [unitName] : []);
        for (const ck of (bc.coreKnowledge || [])) {
          if (ck?.name) addKp(ck.name, [...(ck?.relatedChapters || []), unitName].filter(Boolean));
          for (const sp of (ck?.specificConcepts || [])) if (sp) addKp(sp, ck?.relatedChapters || []);
        }
      }
    }
    const buildBrowseResult = (chapter) => {
      // 🔧 P2-7 索引查询容错：精确规范键 → 原始标题 → 主干名 三级命中，降低"模型传名≠卡标题"的漏检
      const segKey = normChapter(chapter) || chapter || '';
      const segs = chapterSegsBy.get(segKey)
        || chapterSegsBy.get(chapter)
        || chapterSegsBy.get(chapterMain(chapter))
        || [];
      let frag = '';
      let used = 0;
      const candidates = (segs || [])
        .filter((s) => (s.text || '').trim().length >= 10)
        .sort((a, b) => (b.isKeyConcept ? 1 : 0) - (a.isKeyConcept ? 1 : 0));
      for (const s of candidates) {
        const t = s.text.trim();
        if (used + t.length > perBrowseCap) break;
        frag += `\n· ${t}`;
        used += t.length + 2;
      }
      const kp = chapterKpBy.get(segKey) || chapterKpBy.get(chapterMain(chapter)) || [];
      const head = frag
        ? `【${chapter}】教材原文（节选，教材版本以所选课本为准）：${frag}`
        : `【${chapter}】该章未检索到可用原文片段。若非目录所列章节名，请改用目录中的章节名；确属范围内仍无片段，请跳过该章知识点，不要凭训练记忆编写。`;
      return kp.length ? `${head}\n【该章知识点】${kp.slice(0, 20).join('、')}` : head;
    };

    const cfg = await getCurrentEngineConfigEnhanced('generation', { promptLength: estimateTokens(promptBase) });
    const apiUrl = (cfg.baseUrl || '').includes('/chat/completions')
      ? cfg.baseUrl
      : `${(cfg.baseUrl || '').replace(/\/$/, '')}/chat/completions`;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` };
    const provider = cfg.provider;
    const baseBody = {
      model: cfg.model, temperature, top_p: apiConfig.generationSettings.topP || 0.9, stream: false,
      tools: [BROWSE_TOOL], tool_choice: 'auto',
      ...(provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
      ...(provider === 'volcano' ? { thinking: { type: 'disabled' } } : {}),
      ...(provider === 'zhipu' ? { thinking: { type: 'disabled' } } : {}),
      ...(provider === 'alibaba' ? { enable_thinking: false } : {}),
    };
    const messages = [
      { role: 'system', content: BROWSE_SYSTEM
        + (generateMode === 'once'
          ? '\n（本资料为一次成型：正文与答案区一次输出，答案区仅对本资料的练习/自测/例题作答，勿把正文的知识梳理整体复述到答案区。）'
          : '') },
      { role: 'user', content: promptBase },
    ];
    const browsed = new Set();
    let content = '';
    let hitRoundLimit = false;
    let hitTruncLimited = false;
    let writeRounds = 0;               // 正文阶段已进行的续写次数（独立于浏览轮，防死循环）
    const BROWSE_WRITE_CAP = 3;        // 正文截断续写上界（超此视为极端，放弃并交由编辑兜底）
    let lastMsg = null;
    let lastFr = '';
    // 🔧 问题3增强档：漏章兜底覆盖（默认开，config.generationSettings.browseAutoFill）。
    //    模型收敛出正文时，若还有"有素材但未浏览"的章 且 数量≤上界 → 先给模型一轮主动确认
    //    （提示漏章清单，由其判断相关性并 browse），模型仍未采用时程序才确定性兜底取料回循环。
    //    只各做一轮，filledSkipped=true 后不再反复（防死循环/成本失控）。落实程序-模型分工：
    //    程序负责确定性检出+有界兜底+报告，模型保有"是否取某章素材"的主动性。
    const cfgGS = apiConfig.generationSettings || {};
    const autoFillSkipped = cfgGS.browseAutoFill !== false;
    const fillMax = Number(cfgGS.browseAutoFillMaxSkipped) > 0 ? Number(cfgGS.browseAutoFillMaxSkipped) : 3;
    // 🔧 P1-3 兜底护栏：漏章的程序兜底补料不再受默认 3 条砍断（那是漏章略多就"只报告不带料"的主因），
    //    改用 maxAutoFill(≥40) 作为绝对上界；仅当极端大范围（选整册等）超过该上界时才回落为"报告提示"，
    //    避免上下文被原文涨爆。用户配置 browseAutoFillMaxSkipped 更大时取其大。
    const autoCap = Math.max(fillMax, 40);
    let filledSkipped = false;
    let fillQualifiedSkipped = [];       // 本次程序兜底（确定性）落到上下文的章
    let directiveSent = false;           // 漏章确认提示是否已发过一轮（只发一次，防死循环）
    let notedSkipPrompted = [];          // 已交由模型确认的漏章候选（供生成报告溯源）
    const computeSkipped = () => {
      const out = []; const seen = new Set();
      for (const card of contentCards || []) {
        if (!card?.chapterTitle) continue;
        // 🔧 P2-2 排除仅目录卡：TOC-only 章只有目录标题、无真实原文片段，不该列为"有可用原文却未浏览"的漏章，
        //    否则模型会被要求 browse 却拿到"该章未检索到可用原文片段"，形成"认为有素材实际只有目录"的错配。
        if (card.isTocOnly || card.source === 'toc' || card.source === 'unanalyzed') continue;
        const key = normChapter(card.chapterTitle);
        // 🔧 去重：同一章可能以多张卡片（词语/课文/习作）进入勾选，规范键相同即视为同一章，
        //    避免同一章被重复判漏、重复兜底（V2 括号/空模板碰撞保护）
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const hasText = (card.segments || []).some((s) => (s.text || '').trim().length >= 10);
        if (hasText && !browsed.has(key)) out.push(card.chapterTitle);
      }
      return out;
    };
    const combineAbort = (signals) => {
      const ctrl = new AbortController();
      const onAbort = () => ctrl.abort();
      for (const s of signals) if (s && !s.aborted) { s.addEventListener('abort', onAbort, { once: true }); }
      if (signals.some((s) => s?.aborted)) ctrl.abort();
      return { signal: ctrl.signal, dispose: () => signals.forEach((s) => s && s.removeEventListener('abort', onAbort)) };
    };
    for (let round = 0; round <= maxRounds; round++) {
      if (abortController.value?.signal?.aborted) throw new Error('生成已取消');
      let data;
      const ab = combineAbort([abortController.value?.signal, AbortSignal.timeout(getTimeout('generation'))]);
      try {
        const resp = await fetch(apiUrl, {
          method: 'POST', headers,
          body: JSON.stringify({ ...baseBody, messages, max_tokens: maxTokens }),
          signal: ab.signal,
        });
        const bodyText = await resp.text();
        if (!resp.ok) {
          if (resp.status >= 500) deepseekBreaker.fail();
          throw await normalizeFetchError(null, resp);
        }
        try { data = await new Response(bodyText).json(); }
        catch {
          deepseekBreaker.fail();
          throw await normalizeFetchError(null, resp);
        }
        deepseekBreaker.success();
      } catch (e) {
        if (abortController.value?.signal?.aborted) throw e;
        throw e;
      } finally {
        ab.dispose();
      }
      lastMsg = data?.choices?.[0]?.message || {};
      lastFr = data?.choices?.[0]?.finish_reason || '';
      const text = typeof lastMsg.content === 'string' ? lastMsg.content : '';
      if (lastMsg.tool_calls && lastMsg.tool_calls.length) {
        if (text) content += text;
        if (round >= maxRounds) hitRoundLimit = true;
        messages.push({ role: 'assistant', content: text || null, tool_calls: lastMsg.tool_calls.map((tc) => ({ id: tc.id || '', type: 'function', function: { name: tc.function?.name || 'browse_textbook', arguments: String(tc.function?.arguments || '{}') } })) });
        for (const tc of lastMsg.tool_calls) {
          let arg = {};
          try { arg = JSON.parse(tc.function?.arguments || '{}'); } catch { arg = {}; }
          const ch = String(arg.chapter || '').trim();
          let resultStr;
          if (!ch) resultStr = buildBrowseResult('');
          else if (browsed.has(normChapter(ch))) resultStr = `［提示］章节「${ch}」已浏览过，请直接依据已有原文命题，不要重复浏览。`;
          else { browsed.add(normChapter(ch)); resultStr = buildBrowseResult(ch); }
          messages.push({ role: 'tool', tool_call_id: tc.id || '', content: resultStr });
        }
        continue;
      }
      // 无工具调用 → 模型已收敛（准备出正文）。先处理"漏章"（有素材但未浏览的章）：
      //   不允许程序静默兜底绕过模型决策——先发一轮【漏章确认】指令让模型自行判断相关性并 browse；
      //   模型仍未采用时，程序才确定性兜底取料（保证防旧教材覆盖），且兜底有界、报告溯源。
      if (autoFillSkipped && !filledSkipped) {
        const q = computeSkipped();
        if (q.length && q.length <= autoCap) {
          if (!directiveSent) {
            directiveSent = true;
            notedSkipPrompted = q;
            // 补 assistant（携带本轮未提交草稿，避免相邻两条 user 消息）+ 漏章确认指令
            messages.push({ role: 'assistant', content: (typeof text === 'string' && text.trim()) ? text : '' });
            messages.push({
              role: 'user',
              content: `【取材提示·漏章确认】所选范围内以下章节含教材原文素材但你尚未 browse：${q.join('、')}。请自行判断这些章节是否与本卷命题相关：相关章节请调用 browse_textbook 取料后再出正文；无关章节请直接在正文末尾以括号注明「未采用章节：…」后出正文，不要凭训练记忆编写原文。命题坚持素养立意、以情境为载体，依据学生在真实情境下解决问题的过程和结果评定其素养水平（课标原义）；命题素材可取自教材之外的真实情境、不限于所选教材，但须主题相关、难度适切。`,
            });
            statusText.value = `大范围浏览：检出 ${q.length} 个漏浏览章节，交由模型确认取材...`;
            continue; // 给模型一轮主动决策
          }
          // 模型被提示后仍未 browse → 程序确定性兜底补料（本地取料，不新增外部请求），有界为界
          filledSkipped = true;
          fillQualifiedSkipped = q.slice(); // 仅记录本轮兜底兜住的章
          const filled = [];
          for (let i = 0; i < q.length; i++) {
            const ch = q[i];
            const key = normChapter(ch);
            if (browsed.has(key)) continue;
            browsed.add(key);
            const id = `fill_${round}_${i}`;
            filled.push({ role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name: 'browse_textbook', arguments: JSON.stringify({ chapter: ch }) } }] });
            filled.push({ role: 'tool', tool_call_id: id, content: buildBrowseResult(ch) });
          }
          if (filled.length) {
            messages.push(...filled);
            statusText.value = `大范围浏览：漏浏览章节经确认后仍缺料，程序兜底补料（${q.join('、')}）后继续...`;
            continue; // 兜底后回到循环，模型基于补料重新收敛出正文
          }
        }
        filledSkipped = true; // 无待补/超上界：本轮起不再反复处理
      }
      // 无工具调用 → 本轮即正文（进入正文输出阶段；受 maxTokens 约束，截断用独立续写计数兜底）
      if (text) content = text;
      // 🔴 正文阶段续写兜底：截断（finish_reason=length）说明输出预算不够，素材已在上下文，
      //    无需重新浏览——用独立续写计数（WRITE_CAP）兜底，不受浏览轮数上限（maxRounds）约束；
      //    否则当 round==maxRounds 且正文被截断时会直接采纳半截卷面（之前的 bug）。
      if (lastFr === 'length') {
        if (writeRounds < BROWSE_WRITE_CAP) {
          writeRounds++;
          messages.push({ role: 'assistant', content: text || '' });
          messages.push({ role: 'user', content: '【续写】上次输出被截断，请直接从停止处继续完成剩余内容，不要重复已有内容。' });
          continue;
        } else {
          hitTruncLimited = true;
          break;
        }
      }
      break;
    }
    // 防旧教材覆盖校验（确定性，不靠模型兜底；只提示、不改写）
    const coverageNotes = [];
    const noTextChapters = (contentCards || [])
      .filter((c) => !(c.segments || []).some((s) => (s.text || '').trim().length >= 10))
      .map((c) => c.chapterTitle).filter(Boolean);
    if (noTextChapters.length) {
      coverageNotes.push(`⚠️ 以下章节无可用教材原文片段，其内容若涉及命题可能依赖训练记忆而非所选课本，请人工核对取材：${noTextChapters.slice(0, 10).join('、')}${noTextChapters.length > 10 ? '…' : ''}`);
    }
    // 🔧 问题3：漏浏览整章校验。区分「已交模型确认」/「程序兜底补料」/「最终仍未覆盖」，报告可溯源。
    {
      const skipped = computeSkipped();   // 复用同一判定（含去重），避免逻辑重复
      if (notedSkipPrompted.length) {
        coverageNotes.push(`ℹ️ 已检出并交模型确认的漏浏览章节：${notedSkipPrompted.join('、')}——模型已按相关性取料或判定无关。`);
      }
      if (fillQualifiedSkipped.length) {
        coverageNotes.push(`✅ 程序兜底补料：以下章节经确认后仍未采用，已将其原文注入上下文兜底覆盖，防止依赖训练记忆：${fillQualifiedSkipped.join('、')}。`);
      }
      if (skipped.length) {
        coverageNotes.push(`⚠️ 以下章节虽有可用原文素材但最终未及浏览，命题可能遗漏或依赖非所选教材：${skipped.slice(0, 12).join('、')}${skipped.length > 12 ? '…' : ''}（可扩大浏览或单独为该章生成）`);
      }
    }
    if (hitRoundLimit || (!content.trim() && (lastMsg?.tool_calls || []).length)) {
      coverageNotes.push('⚠️ 大范围教材浏览达到轮数上限，部分章节可能未及取材，请核对取材完整性。');
    }
    // 🔧 问题2兜底：正文截断续写达到上限仍不完整 → 提醒（放弃重试，交由编辑兜底）
    if (hitTruncLimited) {
      coverageNotes.push('⚠️ 浏览取到的原文已充分，但生成的正文多次续写仍被截断，末尾可能不完整；请人工查看末尾是否缺题或缺内容。');
    }
    return { content, coverageNotes };
  };

  const buildMaterialBlock = ({ contentCards = [], knowledgeMap = null, maxChars = 8000 } = {}) => {
    // 1. 结构化目录（范围锚定：先给目录确定命题范围，不遗漏、不越界）
    const titles = [];
    for (const card of contentCards || []) {
      if (card?.chapterTitle && !titles.includes(card.chapterTitle)) titles.push(card.chapterTitle);
    }
    const toc = titles.length
      ? `【本资料覆盖范围·目录】（命题范围以本目录为准，覆盖全部章节，不遗漏、不越界）\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
      : '';
    // 1b. 章节→原文片段索引（章节锚定直取用；key 归一化去括号空白）
    const normCh = (t) => String(t || '').replace(/\s+/g, '').replace(/[（(].*?[)）]/g, '').trim();
    const chapterSegs = new Map();
    for (const card of contentCards || []) {
      const key = normCh(card?.chapterTitle);
      if (!key || !card?.segments?.length) continue;
      chapterSegs.set(key, card.segments);
    }
    // 2. 知识点清单 + 知识点→章节映射（relatedChapters/unit——出处锚点程序化，不让模型凭记忆编）
    const kpSet = new Set();
    const kpChapters = new Map(); // 知识点名 → 关联章节名[]
    const collectKp = (name, chapters = []) => {
      if (!name) return;
      kpSet.add(name);
      const list = kpChapters.get(name) || [];
      for (const c of chapters) if (c && !list.includes(c)) list.push(c);
      kpChapters.set(name, list);
    };
    for (const kp of (knowledgeMap?.knowledgePoints || [])) {
      if (typeof kp === 'string') collectKp(kp);
      else if (kp?.name) collectKp(kp.name, kp.relatedChapters || []);
    }
    for (const unit of (knowledgeMap?.knowledgeGraph || [])) {
      const unitName = unit?.unit || '';
      for (const bc of (unit.bigConcepts || [])) {
        if (bc?.bigConcept) collectKp(bc.bigConcept, unitName ? [unitName] : []);
        for (const ck of (bc.coreKnowledge || [])) {
          if (ck?.name) collectKp(ck.name, [...(ck?.relatedChapters || []), unitName].filter(Boolean));
          for (const sp of (ck.specificConcepts || [])) if (sp) collectKp(sp, ck?.relatedChapters || []);
        }
      }
    }
    const kpNames = [...kpSet].filter(Boolean);
    const kpText = kpNames.length ? `【本资料考查知识点】${kpNames.join('、')}` : '';
    // 3. 按知识点检索（每知识点保底 + 缺失补检 + 剩余预算增量）
    const hits = [];
    const seen = new Set();
    const hasRetriever = !!semanticRetriever?.segments?.length;
    const findTop = (q, k = 1) => (hasRetriever ? (semanticRetriever.findRelevant(q, k) || []) : []);
    const pushHit = (r, kp) => {
      const t = String(r?.text || '').trim();
      if (!t || t.length < 10 || seen.has(t)) return false;
      seen.add(t);
      // 🔧 保留出处锚点（semanticRetriever 已带 chapterTitle，此前被丢弃——知识点出处是程序知道的信息，程序化注入，不让模型凭记忆编）
      hits.push({ text: t, score: r?.score || 1, type: r?.type || '', kp, chapter: r?.chapterTitle || '' });
      return true;
    };
    // 3a. 第一轮：每知识点保底 top1 片段（保证每个考点都有原文依据）
    const missingKps = [];
    for (const kp of kpNames.slice(0, 50)) {
      const first = findTop(kp, 1)[0];
      if (first && pushHit(first, kp)) continue;
      missingKps.push(kp);
    }
    // 3b. 覆盖度静默补检：未命中片段的知识点按子词拆检（"分数与小数"→"分数"/"小数"）；
    //     仍无则 debug 记录（命题由模型知识兜底，不打扰用户）
    if (hasRetriever && missingKps.length) {
      for (const kp of missingKps) {
        const parts = String(kp).split(/[、，,与和及]/).filter((p) => p.length >= 2);
        let recovered = false;
        for (const part of parts) {
          const r = findTop(part, 1)[0];
          if (r && pushHit({ ...r, score: (r.score || 1) * 0.95 }, kp)) { recovered = true; break; }
        }
        if (!recovered) {
          // 🔧 章节锚定直取（2026-08-31）：语义检索 miss → 按知识点关联章节（relatedChapters/unit）
          //    直接取该章节关键片段（isKeyConcept 优先），不再静默靠模型知识兜底（教材改版模型跟不上）
          const missChapters = kpChapters.get(kp) || [];
          let anchored = false;
          for (const ch of missChapters) {
            const segs = chapterSegs.get(normCh(ch)) || [];
            if (!segs.length) continue;
            const pick = segs
              .filter(s => (s.text || '').trim().length >= 10)
              .sort((a, b) => (b.isKeyConcept ? 1 : 0) - (a.isKeyConcept ? 1 : 0))
              .slice(0, 2);
            for (const s of pick) {
              if (pushHit({ text: s.text, score: 0.8, type: s.type || '正文', kp, chapter: ch })) anchored = true;
            }
            if (anchored) break;
          }
          if (!anchored) console.debug(`[素材覆盖] 知识点未检索到原文且无章节锚定（静默，模型知识兜底）：${kp}`);
        }
      }
    }
    // 3c. 第二轮：剩余预算按相关度增量补充（每知识点再取 top2 中的新片段，总量受 maxChars 兜底）
    let usedChars = hits.reduce((s, h) => s + h.text.length, 0);
    if (usedChars < maxChars) {
      const extra = [];
      for (const kp of kpNames.slice(0, 50)) {
        for (const r of findTop(kp, 2)) {
          const t = String(r?.text || '').trim();
          if (t && t.length >= 10 && !seen.has(t)) {
            seen.add(t);
            extra.push({ text: t, score: r?.score || 1, type: r?.type || '', kp });
          }
        }
      }
      extra.sort((a, b) => (b.score || 0) - (a.score || 0));
      for (const h of extra) {
        if (usedChars + h.text.length > maxChars) break;
        hits.push(h);
        usedChars += h.text.length;
      }
    }
    // 4. 汇总：按章节均匀配额输出（期末/整本书等大范围每章都取到、不遗漏任何章节；
    //    章节内按相关度排序取配额内片段；总量受 maxChars 兜底）
    const byChapter = new Map();
    for (const h of hits) {
      const key = normCh(h.chapter) || '__noChapter__';
      if (!byChapter.has(key)) byChapter.set(key, []);
      byChapter.get(key).push(h);
    }
    let body = '';
    const chKeys = [...byChapter.keys()].filter(k => k !== '__noChapter__');
    if (chKeys.length) {
      // 章节均匀配额：总量倒除均分，并预留 10% 余量覆盖"· 文本（出自：章节）"格式开销与无章节兜底（精确不超预算）
      const quota = Math.floor((maxChars * 0.9) / chKeys.length);
      for (const key of chKeys) {
        const segs = byChapter.get(key).sort((a, b) => (b.score || 0) - (a.score || 0));
        let used = 0;
        for (const h of segs) {
          if (used + h.text.length > quota) break;
          if (body.length + h.text.length > maxChars) break; // 总量硬上限
          body += `· ${h.text}${h.chapter ? `（出自：${h.chapter}）` : ''}\n`;
          used += h.text.length;
        }
      }
    }
    // 无章节信息的片段按剩余预算补充
    for (const h of (byChapter.get('__noChapter__') || []).sort((a, b) => (b.score || 0) - (a.score || 0))) {
      if (body.length + h.text.length > maxChars) break;
      body += `· ${h.text}\n`;
    }
    // 5b. 空正文兜底：语义检索 miss + 章节锚定也未命中时 body 为空 → 模型只看到"目录+知识点"而自写"教材原文未能检索到可用片段"。
    //    这里改为按章节锚定直取 contentCards 已有真实片段（isKeyConcept 优先），确保正文永不因 RAG miss 而空。
    //    真正的"无原文"场景（全部章节为仅目录卡、无任何片段）才保持现状——那是有意为之的模型知识兜底。
    if (!body.trim()) {
      const realCards = (contentCards || []).filter(c => (c.segments || []).some(s => (s.text || '').trim().length >= 10));
      if (realCards.length) {
        const realNames = realCards.map(c => normCh(c.chapterTitle)).filter(Boolean);
        const quota = Math.floor((maxChars * 0.9) / (realNames.length || 1));
        for (const card of realCards) {
          const segs = (card.segments || [])
            .filter(s => (s.text || '').trim().length >= 10)
            .sort((a, b) => (b.isKeyConcept ? 1 : 0) - (a.isKeyConcept ? 1 : 0));
          let used = 0;
          for (const s of segs) {
            const t = s.text.trim();
            if (used + t.length > quota) break;
            if (body.length + t.length > maxChars) break;
            body += `· ${t}（出自：${card.chapterTitle}）\n`;
            used += t.length;
          }
        }
      }
    }
    // 5. 组装：目录（前）→ 原文片段（中，按章节带出处锚点）→ 考查知识点清单（尾部锚点，生成时模型眼前即覆盖范围）
    // 🔧 段头只强调教材版本（2026-08-31）：核心是防模型用训练记忆的旧版教材；
    //    命题要求/材料可课外等课标语义由模板（EXAM_BASE 依据课标命题、材料可课外；质量底线）承载，段头不重复
    const parts = [toc, body ? `【教材原文（按章节取材，教材版本以用户所选为准；可改编情境，禁止照搬原题）】\n${body}` : '', kpText];
    return parts.filter(Boolean).join('\n\n');
  };

  /**
   * 🔴 整卷一次生成（新架构主路径，指令库驱动）
   * 注入指令来自指令库模板（UI"注入指令框"可见可编辑），一次生成整卷正文 + 独立生成答案页。
   * 设计原则（与"分步流水线"的本质区别）：
   *   - 指令 = 网页端级人话（角色 + 卷面结构 + 命题要求），模型按本能命题、全局自洽
   *   - 素材 = 按知识点检索（RAG），分级限量，非全量注入
   *   - 无分块、无 byCode 拼装、无 AI 自产自评——生成质量由指令与模型能力保证；生成后由规则库静默质检（确定性规则校验+修复）
   *   - 长输出截断时自动续写一次（对应网页端手动点"继续"）
   * @param {Object} params { instruction, genType, selectedBooks, contentCards, knowledgeMap, contextFramework, templateInfo, diffKps }
   * @returns {Promise<{success, content, generatedQuestions, parsedBlueprint, auditWarnings}>}
   */
  const generateFullPaperNatural = async (params = {}) => {
    const {
      instruction = '', genType = '', selectedBooks = [], contentCards = [],
      knowledgeMap = null, contextFramework = '', templateInfo = '', diffKps = [],
      scopeType = '',
    } = params;
    const book = selectedBooks?.[0];
    if (!instruction.trim()) {
      return { success: false, error: '注入指令为空（请点击「生成指令」从指令库注入）' };
    }
    // 🔴 学科规范化（三维度答案提示词/作答载体按 subject 精确注入，避免跨学科噪音）
    const subject = normalizeSubjectName(book?.subject, book?.stage);

    // ── 素材构建：按知识点检索（目录 + 知识点清单 + 相关片段，分级限量，非硬截断） ──
    // 素材量按类型差异化（内容型资料需充分原文、引导型资料适量即可，避免信息过载）
    const MATERIAL_CHARS = GEN_CONST.MATERIAL_CHARS;
    const materialBudget = MATERIAL_CHARS[genType] || 5000;
    const materialBlock = buildMaterialBlock({ contentCards, knowledgeMap, maxChars: materialBudget });
    // ── 大/小范围判定（设计 v2·Q1）：不做章节数判定，按勾选区累计原文字数；
    //    超该类型素材预算（即单次注入会被 maxChars 截断）且引擎支持工具 → 走附件式浏览路径 ──
    const selectedRawChars = (contentCards || []).reduce(
      (s, c) => s + (c.segments || []).reduce((ss, p) => ss + (p && p.text ? p.text.length : 0), 0), 0);
    const largeBrowsing = selectedRawChars > materialBudget;
    const browseTitles = [];
    for (const c of contentCards || []) {
      if (c?.chapterTitle && !browseTitles.includes(c.chapterTitle)) browseTitles.push(c.chapterTitle);
    }
    // 浏览路径前缀只放"目录骨架"作范围锚，不放大段原文/整册知识清单（整册清单会撑爆前缀）
    const browseAnchor = browseTitles.length
      ? `【本资料覆盖范围·目录】（命题范围以本目录为准，覆盖全部章节，不遗漏、不越界）\n${browseTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
      : '';
    let browsePath = false;
    if (largeBrowsing) {
      try {
        const gateCfg = await getCurrentEngineConfigEnhanced('generation', { promptLength: Math.min(selectedRawChars, 4000) });
        browsePath = TOOLS_SUPPORTED_PROVIDERS.includes(gateCfg?.provider);
        if (browsePath) console.log(`📚 [教材浏览] 勾选原文 ${selectedRawChars} 字 > ${materialBudget}，走附件式工具浏览路径`);
      } catch (e) {
        browsePath = false; // 引擎可配置探询失败 → 安全回退单次注入，不阻断生成
      }
    }

    // ── 动态输出预算帽（2026-09）：正文 maxTokens 不再固定取用户档位，而是按
    //    勾选区原文字符量×类型系数推导，在用户固定档之内收紧——防止模型在小范围勾选
    //    （1课/单元）时发散写满大预算（费用虚高+内容散乱）。三档策略用户可调。
    //    原则：只收紧不放大（取 min(动态帽, 用户档位)），大范围勾选自然放大但仍不超用户档。
    //    系数为程序确定性常量（非 Prompt 诱导），exp 目的：原文量饱和后输出增长趋缓。
    // ── 每类型动态预算解析（2026-09 重构，从设置页 budgetByType 读取）──
    // 系数"每字符产出 token 率"× 勾选原文量 → 该次预算目标；取手填 custom（tier 为 custom）或当前档位系数，
    // 再 clamp 到 [floorTokens, 该槽硬上限 cap]。动态是主预算；cap 仅在勾选远超类型预期时才触顶。
    const bbt = apiConfig.generationSettings.budgetByType?.[genType] || {};
    // 🔴 路径决定（2026-09 重构）：优先读该类型的 mode（auto/split/once，设置页每类型可独立选）；
    //    auto 时回退到内置类型表（纯题型→split、知识型→once）。全局"整卷生成方式"已移除，路径完全由每类型决定。
    //  ⚠️ 必须在预算解析（pickSlot/bodyNeeded）之前声明——下方按 generateMode 选择 body/once 槽。
    const PAPER_SPLIT_TYPES = ['exam', 'practice', 'special', 'review'];
    const typeBudgetCfg = bbt;
    const typeMode = typeBudgetCfg.mode || 'auto';
    const generateMode = typeMode !== 'auto' ? typeMode
      : (PAPER_SPLIT_TYPES.includes(genType) ? 'split' : 'once');
    const pickSlot = (slot) => {
      const s = bbt[slot] || null;
      if (!s) return { coef: 1.0, cap: 32768 };
      const tier = bbt.tier || 'balanced';
      // 🔧 实测校准注入：优先级 用户 custom > 校准覆盖 > 播种默认。
      //    校准折算系数只作用于"正文样本口径"的 body/once 槽（answer 槽无独立采样，保持播种）+ 无 custom。
      let coef = (typeof s.custom === 'number' && s.custom > 0) ? s.custom
        : (typeof s[tier] === 'number' ? s[tier] : (typeof s.balanced === 'number' ? s.balanced : 1.0));
      if (!(typeof s.custom === 'number' && s.custom > 0) && (slot === 'body' || slot === 'once')) {
        const calCoef = getCalibratedCoef(genType, subject, book?.stage, generateMode, tier, book?.grade, book?.name);
        if (typeof calCoef === 'number' && calCoef > 0) coef = calCoef;
      }
      return { coef: coef || 1.0, cap: (typeof s.cap === 'number' && s.cap > 0) ? s.cap : 32768 };
    };
    const floorTok = apiConfig.generationSettings.budgetClamp?.floorTokens ?? 800;
    // split：正文用 body 槽（系数+cap）；once：正文+答案共用 once 槽
    const bodyCfg = pickSlot(generateMode === 'once' ? 'once' : 'body');
    let bodyNeeded = Math.round(Math.max(floorTok, selectedRawChars * bodyCfg.coef));
    // 🔴 once 一次成型 = 正文+答案区同一输出：所需下限 = 「body 槽估算 + answer 槽估算」两段合计。
    //    一次输出必须覆盖两段内容；once 槽系数若低于两段合计（如 summary once2.2 < body1.6+answer0.85=2.45），
    //    会在写完正文后因预算用尽截断在答案区（历史复现根因）——此处兜底抬升，宁多勿截。
    if (generateMode === 'once') {
      const splitBodyNeed = Math.round(Math.max(floorTok, selectedRawChars * pickSlot('body').coef));
      const splitAnsNeed = Math.round(Math.max(floorTok, selectedRawChars * pickSlot('answer').coef));
      const onceNeedSum = splitBodyNeed + splitAnsNeed;
      if (bodyNeeded < onceNeedSum) {
        bodyNeeded = onceNeedSum;
        console.warn(`📐 [once预算] once槽系数(${bodyCfg.coef})低于两段合计(${splitBodyNeed}+${splitAnsNeed})，按合计 ${onceNeedSum} token 兜底（防答案区截断）`);
      }
    }
    const bodyOverCap = bodyNeeded > bodyCfg.cap;
    // 🔧 触顶升级（2026-09）：勾选量远超该类型预期（估算所需 > 槽 cap）时，不静默截断预算——
    //    本次调用升级为实际所需（安全上界防发散），保证内容完整生成；提示"范围较大，已自动加长预算"。
    //    注意：安全上界为程序侧固定常量（不进设置 UI），仅防极端发散，正常勾选不会触达。
    const MAIN_TOKEN_CEIL = 98304;
    const bodyEffectiveCap = bodyOverCap ? Math.min(MAIN_TOKEN_CEIL, bodyNeeded) : bodyCfg.cap;
    let bodyDynamicCap = Math.round(Math.min(bodyEffectiveCap, bodyNeeded)); // 注：浏览回退兜底时会按实际素材块重算
    // 🔧 防截断安全缓冲（2026-09"一次成功优先"）：估算 ×1.25 再取帽——HTML 标签膨胀/知识展开会让实际
    //    输出 token 高于「素材×系数」估算（summary once 实证低估 ~20%）。缓冲宁多勿少，让主请求一次写完、
    //    尽量不触发截断续写（续写只是兜底，一次成功质量最高）；配合篇幅纪律（写到即止），
    //    模型不会因预算大而注水，费用风险可控。缓冲只作用于正文/once 主请求，答案页独立槽不受影响。
    const BUDGET_SAFETY_BUFFER = 1.25;
    bodyDynamicCap = Math.round(Math.min(bodyEffectiveCap, bodyNeeded * BUDGET_SAFETY_BUFFER));
    // 答案页：split 才有独立答案页调用，用 answer 槽；once 无独立答案页（答案随正文，不走 here）
    const answerCfg = pickSlot('answer');
    const answerNeeded = Math.round(Math.max(floorTok, selectedRawChars * answerCfg.coef));
    const answerOverCap = answerNeeded > answerCfg.cap;
    const answerEffectiveCap = answerOverCap ? Math.min(MAIN_TOKEN_CEIL, answerNeeded) : answerCfg.cap;
    const answerDynamicCap = Math.round(Math.min(answerEffectiveCap, answerNeeded));
    // 🔧 引擎单次输出上限护栏（2026-09）：请求 max_tokens 超过模型硬上限会被 API 拒绝(400)或静默截断到上限。
    //    DeepSeek 官方口径：deepseek-chat 默认 4K、最大 8K；deepseek-reasoner 默认 32K、最大 64K。
    //    其他引擎（火山/阿里/智谱/本地）上限随模型档位未固证 → 不钳制（防误伤）。
    //    护栏效果：请求值钳到引擎上限；估算缺口由「正文截断续写链」分次补齐（见段1续写链），
    //    并在 budgetAlert 中透出"本次因引擎上限需要分次"（进入生成报告，用户可据此缩小范围或换 reasoner）。
    //    🔧 独立获取引擎配置：不得引用上方 browse 探测的局部 gateCfg（try 块作用域，小范围时未执行 → ReferenceError）
    let engineCap = Infinity;
    try {
      const genGate = await getCurrentEngineConfigEnhanced('generation', { promptLength: Math.min(selectedRawChars, 4000) });
      if (genGate?.provider === 'deepseek') {
        engineCap = /reasoner|r1|think/i.test(String(genGate?.model || '')) ? 65536 : 8192;
      }
    } catch { /* 引擎可配置探询失败 → 不钳制：护栏为防误伤兜底，非关键路径 */ }
    const clampReq = (tok) => Math.min(tok, engineCap);
    const bodyEngineOver = bodyDynamicCap > engineCap;
    const answerEngineOver = answerDynamicCap > engineCap;
    const budgetAlert = (bodyOverCap ? `${genType}正文估算${bodyNeeded}token 超上限${bodyCfg.cap}，已自动加长预算` : '')
      + (answerOverCap ? `；答案页估算${answerNeeded}token 超上限${answerCfg.cap}，已自动加长` : '')
      + (bodyEngineOver ? `；正文估算超引擎单次输出上限 ${engineCap} token，将自动分次续写补齐` : '')
      + (answerEngineOver ? `；答案页估算超引擎单次输出上限 ${engineCap} token，将自动分次续写补齐` : '');
    console.log(`[每类型预算] ${genType}: 路径=${generateMode} 勾选原文=${selectedRawChars}字 所需=${bodyNeeded}→帽=${bodyDynamicCap}(cap=${bodyCfg.cap}${bodyOverCap ? ' 已升级' : ''}/coef=${bodyCfg.coef}) 答案帽=${answerDynamicCap}(cap=${answerCfg.cap})`);

    // 🔴 标题根治兜底：标题只由命名规范占位符组成——模型若把任务行类型名（如"考卷"）拼进 h1，
    //    代码强制移除（仅移除"空格/分隔符+类型词"形态，不误伤名称池合法词如"测试卷"贴正文的情况）
    const stripTypeWordFromTitle = (html) => String(html || '').replace(/<h1[^>]*>([\s\S]*?)<\/h1>/i, (m, t) => {
      const cleaned = t
        .replace(/[ 　·｜\-]\s*(考卷|试卷|测试卷|练习题)\s*(?=[<]|$)/g, '')
        .replace(/\s*(考卷)\s*$/g, '');
      return m.replace(t, cleaned);
    });

    // ── 组装最终 prompt：注入指令 + 附加块（素材/模板对标/情境/差异化，用户配置了才加） ──
    // 浏览路径用"目录骨架"作前缀范围锚；单次注入用完整素材块（原文/知识清单）——两者顺序与后缀块均一致
    const activeBlock = browsePath ? browseAnchor : materialBlock;
    let prompt = instruction.trim();
    if (activeBlock) prompt += `\n\n${activeBlock}`;
    if (templateInfo?.trim()) prompt += `\n\n【模板对标】（用户勾选的模板，供风格/结构参考，不限制命题）\n${templateInfo.trim()}`;
    if (contextFramework?.trim()) prompt += `\n\n${contextFramework.trim()}`;
    if (diffKps?.length) {
      prompt += `\n\n【差异化要求（复生成）】以下知识点已覆盖，请优先选择其他知识点或从不同角度考查：${diffKps.join('、')}`;
    }
    // 🔧 整卷生成方式（设置页三选一，生成端严格按设置执行，不再硬编码）：
    //    'split' 两次生成：正文一次 + 答案页独立一次（温度/角色分层，纯题型推荐）
    //    'once'  一次成型：正文+答案一次输出（上下文全程一致，知识型/错题/听写推荐）
    //    'auto'  自动按资料类型（两条路都可用）：纯题型 → split；知识型/听写/错题 → once
    //   (PAPER_SPLIT_TYPES 与 generateMode 已在上方预算解析前声明)
    // 🔧 自包含教辅（正文本身即内容梳理：知识总结/复习/课前预习/默写积累/错题本）：
    //    答案区必须只对练习/自测/例题作答，严禁把正文的知识梳理整体复述到答案区。
    //    归入此集合后：once 不再强制"另起一部分输出参考答案"而改为"答案区仅逐题作答"；
    //    split 独立答案页角色注入"勿复述正文梳理"硬约束。
    const SELF_CONTAINED_TEACHING = ['summary', 'review', 'preview', 'dictation', 'errorbook'];
    const isSelfContainedTeaching = SELF_CONTAINED_TEACHING.includes(genType);
    const modeLabel = generateMode === 'once' ? '一次成型' : '两次生成';
    const modeSource = typeMode !== 'auto' ? `每类型设置（${genType}→${modeLabel}）`
      : `自动按类型（${genType}→${modeLabel}）`;
    console.log(`[生成方式] ${modeSource}，本卷走「${modeLabel}」路径`);
    // 🔧 once 模式温度折中：正文与答案同一次输出，取「整卷正文温度」与「答案页温度」的均值
    //    （默认 (0.7+0.3)/2=0.5），兼顾正文创作性与答案严谨性；
    //    split 模式正文仍用正文温度，答案页独立调用用答案温度。
    const bodyTemperature = generateMode === 'once'
      ? (apiConfig.generationSettings.paperTemperature + apiConfig.generationSettings.answerTemperature) / 2
      : apiConfig.generationSettings.paperTemperature;
    if (generateMode === 'once') {
      prompt += `\n\n${PAPER_OUTPUT_CONVENTIONS.once(subject, isSelfContainedTeaching)}`;
    } else {
      // 🔴 答案页由系统在正文生成后单独调用生成：强制约定本次只输出正文（题目与卷面），
      //    覆盖模板里残留的"正文后再另起一部分输出答案"旧要求，防止模型把答案混入正文（正文+答案重复）
      prompt += `\n\n${PAPER_OUTPUT_CONVENTIONS.split(subject, isSelfContainedTeaching)}`;
    }

    // ── 段1：整卷正文一次生成（once 模式正文+答案一次输出） ──
    statusText.value = `整卷生成：一次生成完整试卷（${modeLabel}路径，${modeSource}）...`;
    progress.value = 45;
    let content = '';
    let lastErr = null;
    let browseCoverageNotes = [];
    // 🔧 采样用：正文是否触发过续写/截断（预算失效场，校准统计须剔除）
    let sampleTruncated = false;
    // ── 大范围工具路径：先按章 browse 取材后再生成正文；失败自动回退单次全量注入（一次生成成功优先） ──
    if (browsePath) {
      statusText.value = `整卷生成：大范围教材浏览取材中（工具路径，${modeLabel}）...`;
      try {
        const bres = await generateBodyByTextbookBrowse({
          genType, promptBase: prompt, contentCards, knowledgeMap,
          maxTokens: clampReq(bodyDynamicCap),
          temperature: bodyTemperature,
          generateMode,
        });
        browseCoverageNotes = bres?.coverageNotes || [];
        const bc = normalizeIndents(normalizeLeadingMarkers(normalizeMatchQuestions(normalizeMathCircleBlanks(normalizeBlankMarkers(cleanSectionHtml(bres?.content || ''))))));
        // 🔴 完整优先：browse 产出的正文若仍疑似截断（尾部启发式，内部多次续写未补齐时 coverageNotes 已含提醒），
        //    不作为成功内容采纳——置空走下方"单次注入 + 预算升级重试"路径，避免半截卷进入交付
        if (bc && bc.length > GEN_CONST.BODY_VALID_MIN_LEN && !detectTruncation(bc).truncated) {
          content = bc;
        } else if (bc) {
          console.warn('⚠️ 浏览路径正文疑似未完整（截断启发式），改走单次注入升级预算路径重试');
        }
      } catch (e) {
        lastErr = e;
        console.warn('⚠️ 教材浏览路径失败，回退单次全量注入:', e.message);
      }
      if (!content) {
        // 回退单次注入：恢复完整素材块（目录骨架不足以支撑命题）
        let fb = instruction.trim();
        if (materialBlock) fb += `\n\n${materialBlock}`;
        if (templateInfo?.trim()) fb += `\n\n【模板对标】（用户勾选的模板，供风格/结构参考，不限制命题）\n${templateInfo.trim()}`;
        if (contextFramework?.trim()) fb += `\n\n${contextFramework.trim()}`;
        if (diffKps?.length) fb += `\n\n【差异化要求（复生成）】以下知识点已覆盖，请优先选择其他知识点或从不同角度考查：${diffKps.join('、')}`;
        fb += `\n\n${generateMode === 'once' ? PAPER_OUTPUT_CONVENTIONS.once(subject, isSelfContainedTeaching) : PAPER_OUTPUT_CONVENTIONS.split(subject, isSelfContainedTeaching)}`;
        prompt = fb;
        // 🔧 2026-09 自洽修正：回退后注入的是被 typeBudget 截断的素材块（≤ materialBlock），
        //   而非勾选全量原文——预算若仍按 selectedRawChars 计算会虚高，诱发散写（费用+内容发散）。
        //   按实际注入的素材块长度重算兜底预算（同样受槽 cap / 硬上界约束），与正文首次预算标尺一致。
        const fbBlockLen = (materialBlock || '').length;
        const fbNeeded = Math.round(Math.max(floorTok, fbBlockLen * bodyCfg.coef));
        const fbOver = fbNeeded > bodyCfg.cap;
        bodyDynamicCap = Math.round(Math.min(fbOver ? Math.min(MAIN_TOKEN_CEIL, fbNeeded) : bodyCfg.cap, fbNeeded));
        console.warn('📚 [教材浏览] 浏览未产出合格正文，回退单次全量注入。');
      }
    }
    // 🔴 思考模式耗尽降级：推理 chunks 巨大且正文为空（finish_reason=length 截断在推理阶段）→ 重试强制关闭思考
    let retryWithoutThinking = false;
    // 🔧 正文"完整优先"（2026-09）：截断经续写链仍无法补齐 → 本 attempt 判失败，升级预算整卷重试；
    //    两次尝试都失败则抛错（绝不把半截正文当作成功交付——提醒半截对用户无用，宁可失败给行动建议）
    let truncFailNote = '';
    // 🔧 仅当上方 browse/回退路径未产出完整正文时，才进入"单次注入 + 预算升级重试"循环
    //    （browse 已产出完整正文时跳过，避免循环首轮 content='' 清空 browse 成果）
    if (!content) {
    for (let attempt = 0; attempt < 2; attempt++) {
      content = ''; // 每次 attempt 全新整卷生成（升级预算重试不携带上次半截残留）
      // 🔧 截断重试预算升级：第 1 次按动态帽，第 2 次 ×1.4（仅截断补齐场景，篇幅纪律已防发散；
      //    仍受引擎单次输出上限 clampReq 约束，超出部分由下方续写链动态分片补齐）
      const attemptCap = Math.round(bodyDynamicCap * Math.pow(1.4, attempt));
      try {
        const resp = await callAI(prompt, {
          taskType: 'generation', timeout: getTimeout('generation'), retries: 0,
          // 🔴 整卷输出预算：正文 base 取「每类型动态帽」（已含触顶升级：勾选超 cap 时自动加长到所需，
          //    不静默截断预算）；思考模式按 thinkingBudgetMultiplier 放大（推理与正文共享配额，需给推理预留余量）
          // ⚠️ once 一次成型：正文+答案同一次输出，预算由 once 槽「系数」一体核算（once 槽系数 > body 槽，
          //    设计上已含答案区，勿再叠加 answer 帽双重放大——此前误判叠加已回退，见 git log 2026-09）
          maxTokens: clampReq(attemptCap)
            * ((retryWithoutThinking || !getGenerationThinkingEnabled()) ? 1 : (apiConfig.generationSettings.thinkingBudgetMultiplier || 2)),
          allowContinuation: false,
          // 🔧 整卷正文温度：split 用「整卷正文温度」；once 用折中温度（见上方 bodyTemperature）
          temperature: bodyTemperature,
          // 🔧 returnMeta：带出 finishReason / reasoningChunkCount（思考耗尽检测）
          returnMeta: true,
          // 🔧 thinking 显式覆盖：思考耗尽后重试强制关闭（options.thinking 优先于全局开关）
          thinking: retryWithoutThinking ? false : undefined,
          // 🔧 思考预算上限（流式中止止损）：开思考用大上限（40K chunks），未开思考也有防御上限——
          //    智谱/火山等引擎可能无视思考开关强制推理，推理与正文共享 max_tokens，必须限流防吃光预算
          maxReasoningChunks: (!retryWithoutThinking && getGenerationThinkingEnabled()) ? GEN_CONST.REASONING_CAP_BODY : GEN_CONST.REASONING_CAP_BODY_FORCED,
        });
        const respObj = typeof resp === 'string' ? { content: resp, finishReason: '' } : (resp || { content: '', finishReason: '' });
        content = normalizeIndents(normalizeLeadingMarkers(normalizeMatchQuestions(normalizeMathCircleBlanks(normalizeBlankMarkers(cleanSectionHtml(respObj.content || ''))))));
        // 🔴 思考耗尽检测：推理 chunks 大量（≥20000）或触发推理上限（reasoning_capped）且正文为空 → 判定思考占满输出预算
        if (((respObj.reasoningChunkCount || 0) >= GEN_CONST.REASONING_EXHAUST_THRESHOLD || respObj.finishReason === 'reasoning_capped') && !content.trim()) {
          console.warn(`⚠️ 思考模式推理过长（${respObj.reasoningChunkCount || 0} chunks，finish_reason=${respObj.finishReason || 'length'}）且正文为空——本次重试将自动关闭思考`);
          retryWithoutThinking = true;
          throw new Error('思考模式推理耗尽输出预算，正文未输出——已自动降级为非思考重试');
        }
        // 🔴 截断判定：优先用 API 的 finish_reason=length（可靠，不依赖尾部启发式）；启发式作兜底；
        //    reasoning_capped（推理达到 40K 上限被流式中止）也算截断——半截正文须续写补齐
        // 🔧 续写链（2026-09 重构）：至多 MAX_CONT 次。每次续写带 returnMeta，检测续写自身是否再次截断；
        //    仍截断则基于最新内容继续续写，直至完整或达上限。拼接前做尾部重叠去重——
        //    模型续写常从上一段末尾开始重述，直接拼接会造成重复（旧实现只续一次且不检测二次截断，
        //    续写再被截断时半截正文会被当作完整交付——summary 5080 字符截断实证根因）
        let trunc = detectTruncation(content, respObj.finishReason);
        if (trunc.truncated) {
          sampleTruncated = true;
          console.warn(`⚠️ 整卷输出${trunc.byReason ? `被截断（finish_reason=length，${content.length}字符）` : '疑似截断'}，进入续写链补齐...`);
          // 续写拼接：去除与正文末尾的重叠段（DEDUP 常量与 callAI 内部续写同一套口径）
          const appendContinuation = (base, cont) => {
            const tail = base.slice(-GEN_CONST.DEDUP_TAIL_EXACT);
            let clean = String(cont || '').trimStart();
            if (tail && clean.startsWith(tail)) {
              clean = clean.slice(tail.length);
            } else {
              for (let ol = GEN_CONST.DEDUP_OVERLAP_MAX; ol >= GEN_CONST.DEDUP_OVERLAP_MIN; ol--) {
                const ov = base.slice(-ol);
                if (ov && clean.startsWith(ov)) { clean = clean.slice(ol); break; }
              }
            }
            clean = clean.trim();
            if (!clean) return base;
            return base + '\n' + clean;
          };
          const contMult = (retryWithoutThinking || !getGenerationThinkingEnabled()) ? 1 : (apiConfig.generationSettings.thinkingBudgetMultiplier || 2);
          const contBudget = clampReq(attemptCap * contMult);
          // 🔧 续写次数动态化：引擎单次输出有限（如 deepseek-chat 8K），总需求 ÷ 单次上限 = 需分片数，
          //    +1 次余量（防恰好顶满）；非受限引擎沿用 2 次。上限 6 防失控循环。
          const engineSteps = Number.isFinite(engineCap) ? Math.max(1, Math.ceil((attemptCap * contMult) / engineCap)) : 1;
          const MAX_CONT = Math.min(6, engineSteps + 1);
          let contCount = 0;
          while (trunc.truncated && contCount < MAX_CONT) {
            contCount++;
            console.warn(`⏩ 整卷正文第 ${contCount}/${MAX_CONT} 次续写...（当前 ${content.length} 字符）`);
            const contResp = await callAI(
              `${prompt}\n\n【续写】上次输出被截断（末尾：${content.slice(-GEN_CONST.CONTINUE_TAIL_SAMPLE)}）。请直接从上次停止处继续完成剩余题目与内容，不要重复已有内容。`,
              {
                taskType: 'generation', timeout: getTimeout('generation'), retries: 0,
                maxTokens: contBudget,
                allowContinuation: false, temperature: bodyTemperature,
                thinking: retryWithoutThinking ? false : undefined,
                returnMeta: true,
              }
            );
            const cObj = typeof contResp === 'string' ? { content: contResp, finishReason: '' } : (contResp || { content: '', finishReason: '' });
            const contHtml = normalizeIndents(normalizeLeadingMarkers(normalizeMatchQuestions(normalizeMathCircleBlanks(normalizeBlankMarkers(cleanSectionHtml(cObj.content || ''))))));
            if (!contHtml || contHtml.length <= 100) break; // 续写无效（过短/重复收尾）——按未补齐处理
            content = appendContinuation(content, contHtml);
            trunc = detectTruncation(contHtml, cObj.finishReason); // 检测本次续写是否再次被截断
          }
          if (trunc.truncated) {
            // 🔴 未补齐 → 本 attempt 判失败（不交付半截）：升级预算由下一 attempt 整卷重试补齐
            truncFailNote = `正文输出被截断，经 ${contCount} 次续写（预算 ${attemptCap} token）仍未完整（当前 ${content.length} 字符）`;
            console.warn(`⚠️ ${truncFailNote}——升级预算重新整卷生成...`);
            throw new Error(truncFailNote);
          }
        }
        if (content && content.length > GEN_CONST.BODY_VALID_MIN_LEN) break;
        throw new Error('整卷输出过短/为空');
      } catch (e) {
        lastErr = e;
        if (abortController.value?.signal?.aborted) throw e;
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, apiConfig.generationSettings?.retry?.baseDelayMs ?? 2000));
          console.warn('⚠️ 整卷生成第1次失败，重试:', e.message);
        }
      }
    }
    } // end if(!content) 单次注入重试循环（browse 已产出完整正文时跳过）
    // 🔴 完整优先最终守卫：两次尝试（含续写链）都未能完整输出 → 明确抛错并给行动建议，
    //    绝不把半截正文当作成功交付（generate 外层 MAX_RETRIES 会整卷级重试；再失败则由 UI 呈现此错误）
    if (truncFailNote || !content || content.length <= GEN_CONST.BODY_VALID_MIN_LEN) {
      const advise = truncFailNote
        ? `${truncFailNote}。建议：① 缩小勾选范围降低单次体量；② 到「设置 → 整卷输出预算」调大该类型的「上限」或为该类型采纳「实测校准」；③ 内容较长时改用 deepseek-reasoner 等单次输出上限更高的模型（chat 单次仅 8K，长卷易截断）。`
        : `整卷生成失败: ${lastErr?.message || '未知错误'}`;
      throw new Error(advise);
    }

    // ── 段2：答案页（split 模式独立调用：上下文=整卷正文全文，模型"看着实际题目作答"——
    //         杜绝摘要提取失败后凭记忆编造导致答案与正文不符；
    //         once 模式正文已含答案区则跳过，若模型漏输出答案区则降级补一次独立答案页） ──
    let answerHtml = '';
    let answerSkipNote = ''; // 题+解析一体资料（once）跳过独立答案页时的说明（追加到生成报告）
    const ansInContent = /<h2[^>]*>参考答案|answer-section/.test(content);
    // 🔴 once 模式空壳答案区检测：模型输出 `<h2>参考答案…` 但内容是"略/待补充"或近乎空白
    //    （占位式敷衍），不能算有答案页——剥离空壳并强制走独立答案页补生成
    const ansShellInContent = isAnswerShell(content);
    // 🔧 split 模式正文混答剥离（2026-08）：正文生成时即使注入"严禁输出答案"，
    //    任务式教辅（课时练/专项/复习）模型仍可能把《参考答案》写进正文末尾——
    //    与独立答案页重复（"正文答案 + 独立答案页"两份）。split 下正文一律不应含答案区：
    //    无论完整还是空壳，命中即剥离，答案统一由独立答案页承载（once 模式不受影响）
    const splitBodyHasAnswer = generateMode !== 'once' && ansInContent;
    if (ansShellInContent || splitBodyHasAnswer) {
      content = stripAnswerSection(content);
    }
    // 🔧 题+解析一体资料（错题本/知识总结等正文自带解析）once 模式且正文无独立参考答案区：
    //    正文已含解析/答案标注时不再补独立答案页（正文解析即答案，防"正文解析 + 独立答案页"重复）
    const genTypeCarriesAnswers = ['errorbook', 'summary'].includes(genType);
    const bodyCarriesAnswers = /答案[:：]|解析[:：]|解法[:：]|归因[:：]|解题思路[:：]|评析[:：]/.test(content);
    const skipAnswerPage = generateMode === 'once' && !ansInContent && !ansShellInContent && (genTypeCarriesAnswers || bodyCarriesAnswers);
    if (skipAnswerPage) {
      answerSkipNote = `ℹ️ 正文已含解析/答案标注（${genType} 为题+解析一体资料），未单独生成答案页。`;
    } else if (generateMode !== 'once' || !ansInContent || ansShellInContent) {
      statusText.value = genType === 'exam' ? '整卷生成：撰写参考答案与评分标准...' : '整卷生成：撰写参考答案与解析...';
      progress.value = 85;
      try {
        // 类型差异化：exam 用阅卷专家+评分标准；非 exam 用教辅编辑+参考答案与解析
        //    🔧 自包含教辅（summary/review/preview/dictation/errorbook）答案角色限定"仅对练习题作答，
        //       严禁复述正文知识梳理"，根治"答案区把知识总结整体又输出一遍"
        const ansRole = genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType);
        // 🔧 上下文根治：整卷正文转纯文本作为输入（不依赖 class="question" 摘要——摘要提取失败/不全即凭记忆编造）
        //    正文长度上限走设置项 answerContextMaxChars（默认 24000；超大卷/高中大卷可调大至 40000-60000）
        const paperPlain = htmlToPlainText(content, apiConfig.generationSettings.answerContextMaxChars);
        // 🔧 格式根治：答案页注入与正文一致的 HTML 输出规范（此前无格式要求 → 模型直接输出 Markdown 源码）
        const ansFormat = buildAnswerFormatSpec(subject);
        // 🔧 自包含教辅（summary/review/preview/dictation/errorbook）答案区只写练习/自测/变式解答（典型例题已在正文讲解展示，不重复），
        //    “按栏目组织答案”仅指按题目所在栏目对答案分类，绝不把正文知识梳理整体复述进答案区（防二次复述）
        const selfContainedAnsNote = isSelfContainedTeaching
          ? '\n【自包含教辅答案原则】答案区【只】给出正文中练习/自测/变式的解答（典型例题的解答与解析已在正文讲解展示，严禁在答案区重复复述）；正文的知识框架/重点梳理/考点梳理/易错辨析/默写内容已在前文呈现，【严禁】在答案区整体重复复述。【严禁】在答案区重复呈现知识结构图、考点导图、梳理条目等正文性内容。'
          : '';
        const ansPrompt = `${ansRole}题号与试卷正文完全一致，答案按正文的大题与题号层级组织、与正文同构。不复述题干原文（含子题题干），不重现正文作答空位。
${selfContainedAnsNote}
${ansFormat}

【试卷正文】
${paperPlain || '（正文为空，无法作答——请终止输出）'}`;
        const ansThinking = getGenerationThinkingEnabled();
        const ansResp = await callAI(ansPrompt, {
          taskType: 'generation', timeout: getTimeout('answer'), retries: 1,
          // 🔴 答案页输出预算来自每类型 answer 槽的 answerDynamicCap；思考模式按 thinkingBudgetMultiplier 放大
          //    （推理预留 + 答案输出），并设 20K 推理上限流式中止止损（答案页短输出，推理可控）
          // 🔧 答案页温度走设置页（answerTemperature）
          // 🔴 allowContinuation:true → 输出被截断（finish_reason=length / reasoning_capped）时自动续写补齐——
          //    此前禁用续写导致 23368 字符截断的不完整 HTML 进导出，docxBuilder 解析丢内容（答案区整体消失）
          // 🔴 returnMeta:true → 带出 finishReason / reasoningChunkCount，检测"思考耗尽"（与正文 retryWithoutThinking 对称）：
          //    答案页要逐题作答+评分标准+听力原文，思考推理长，一旦推理占满 20K 上限 → 输出为空/半截；
          //    第二次重试强制关闭思考，防再次空转（此前无降级 → answerHtml='' → 入库无答案区，"无答案页"根因）
          maxTokens: clampReq(answerDynamicCap) * (ansThinking ? (apiConfig.generationSettings.thinkingBudgetMultiplier || 2) : 1), allowContinuation: true, temperature: apiConfig.generationSettings.answerTemperature,
          maxReasoningChunks: ansThinking ? GEN_CONST.REASONING_CAP_ANSWER : GEN_CONST.REASONING_CAP_ANSWER_FORCED,
          returnMeta: true,
        });
        const ansObj = typeof ansResp === 'string' ? { content: ansResp, finishReason: '', reasoningChunkCount: 0 } : (ansResp || { content: '', finishReason: '', reasoningChunkCount: 0 });
        let aHtml = normalizeMathCircleBlanks(normalizeLeadingMarkers(cleanSectionHtml(ansObj.content || '')));
        // 🔴 思考耗尽判定：推理达到上限（reasoning_capped）或 chunk 数巨大 → 本次重试强制关闭思考
        const ansCapped = ansObj.finishReason === 'reasoning_capped' || (ansObj.reasoningChunkCount || 0) >= GEN_CONST.REASONING_EXHAUST_THRESHOLD;
        if (aHtml && aHtml.length > GEN_CONST.ANSWER_ACCEPT_MIN_LEN && !ansCapped) {
          const ansTitle = genType === 'exam' ? '参考答案与评分标准' : '参考答案与解析';
          // 🔧 去重：模型自带 <h1>参考答案…</h1> 头部标题剥除（系统包装已加 <h2> 标题，见 stripLeadingAnswerTitle）
          answerHtml = `<div class="answer-section"><h2>${ansTitle}</h2>\n${stripLeadingAnswerTitle(aHtml)}</div>`;
        } else {
          // 🔧 答案页为空/过短/思考耗尽 → 自动重试一次（思考耗尽时强制关闭思考，防再次空转；
          //    模型偶发输出空或"略"式敷衍内容也覆盖）
          console.warn(`⚠️ 答案页内容${ansCapped ? `思考耗尽（${ansObj.reasoningChunkCount || 0} 推理chunks）` : `过短（${aHtml?.length || 0} 字符）`}，自动重试一次${ansCapped ? '（强制关闭思考）' : ''}`);
          const ansResp2 = await callAI(ansPrompt, {
            taskType: 'generation', timeout: getTimeout('answer'), retries: 1,
            maxTokens: clampReq(answerDynamicCap) * (ansThinking ? (apiConfig.generationSettings.thinkingBudgetMultiplier || 2) : 1), allowContinuation: true, temperature: apiConfig.generationSettings.answerTemperature,
            maxReasoningChunks: ansThinking ? GEN_CONST.REASONING_CAP_ANSWER : GEN_CONST.REASONING_CAP_ANSWER_FORCED,
            thinking: (ansCapped || (ansObj.reasoningChunkCount || 0) > 0) ? false : undefined, // 🔴 有推理痕迹（含引擎强制推理）→ 重试强制关闭思考
            returnMeta: true,
          });
          const ansObj2 = typeof ansResp2 === 'string' ? { content: ansResp2, finishReason: '', reasoningChunkCount: 0 } : (ansResp2 || { content: '', finishReason: '', reasoningChunkCount: 0 });
          const aHtml2 = normalizeMathCircleBlanks(normalizeLeadingMarkers(cleanSectionHtml(ansObj2.content || '')));
          if (aHtml2 && aHtml2.length > GEN_CONST.ANSWER_ACCEPT_MIN_LEN) {
            const ansTitle = genType === 'exam' ? '参考答案与评分标准' : '参考答案与解析';
            answerHtml = `<div class="answer-section"><h2>${ansTitle}</h2>\n${stripLeadingAnswerTitle(aHtml2)}</div>`;
          } else {
            console.warn('⚠️ 答案页重试仍为空/过短（正文仍有效）');
          }
        }
      } catch (e) {
        console.warn('⚠️ 答案页生成失败（正文仍有效）:', e.message);
      }
    }

    // 🔧 once 模式答案区包装：模型输出的 <h2>参考答案… 无 answer-section 包裹 → 补包，
    //    docx 导出才能把答案区拆分为独立分节（页码独立、不计入正文页数）
    if (generateMode === 'once' && ansInContent) {
      content = wrapAnswerSection(content);
    }

    // 🔴 标题根治兜底：移除模型拼入 h1 的任务行类型词（如“ 考卷”），标题只保留命名规范占位符组合
    content = stripTypeWordFromTitle(content);
    
    // 🔴 密封线兜底：正式试卷且 AI 未输出密封线 → 代码补（恢复原拼装器的密封线成果）
    let finalContent = answerHtml ? `${content}\n\n${answerHtml}` : content;
    if (genType === 'exam' && !/<div[^>]*class="[^"]*seal-zone[^"]*"/.test(finalContent)) {
      finalContent = `${buildSealLineHeader()}\n${finalContent}`;
    }

    // 🔴 整卷结构质量校验（规则库三维度匹配：学段×学科×资料类型）：
    //    fix 类自动修复（拼音归一/模板残留/分值对齐/标题明细式/作文格补格等），
    //    guard 类静默计数 → 明细转"抽检提示"展示到生成报告【问题列表】（代码确定性规则，零 AI 调用）
    let auditWarnings = [];
    try {
      const beforeAudit = finalContent;
      const hadAnswerBeforeAudit = /answer-section/.test(beforeAudit);
      const audit = auditExamPaper(finalContent, {
        subject: book?.subject || '',
        stage: resolveStageKey(book?.stage, book?.grade, book?.name),
        genType,
      });
      if (audit.fixed > 0 || audit.silent > 0 || audit.issues.length > 0) {
        console.log(`🔍 整卷质检：修复 ${audit.fixed} 处，静默防护 ${audit.silent} 项${audit.issues.length ? `，修复记录 ${audit.issues.length} 条` : ''}`);
      }
      if (audit.silentDetails && audit.silentDetails.length > 0) {
        // 🔧 2026-08 分值抽检降级：level==='debug' 仅 console 诊断，不进生成报告问题列表（误报侵蚀信任）
        auditWarnings = audit.silentDetails.filter(d => d.level !== 'debug').map(d => `⚠️ ${d.message}`);
      }
      finalContent = audit.html;
      // 🔴 答案区保留护栏：质检器异常丢失答案区（历史真实事故："拼接后有答案、audit 后无答案"）→
      //    从审计前内容提取答案区拼回（宁可少修复，不可丢答案）；根因待样本定位
      if (hadAnswerBeforeAudit && !/answer-section/.test(finalContent)) {
        const ansPart = beforeAudit.match(/<div[^>]*class="[^"]*answer-section"[^>]*>[\s\S]*$/i);
        if (ansPart) {
          finalContent = finalContent + '\n\n' + ansPart[0];
        }
      }
    } catch (e) {
      console.warn('⚠️ 整卷质检器异常（不影响生成结果）:', e.message);
    }

    // 🔴 答案页缺失可见性：独立调用尝试过但仍无答案区 → 透出原因到生成报告【问题列表】，
    //    不再静默丢（用户必须清楚为什么没有答案页）；题+解析一体跳过时改为说明性提示，不误报"失败"
    if (!answerSkipNote && !answerHtml && !(/<div[^>]*class="[^"]*answer-section"/.test(finalContent))) {
      auditWarnings.push('⚠️ 答案页生成失败/为空（正文已生成）。排查方向：① 引擎是否强制推理（推理会占用答案预算，可在设置关闭对应引擎思考开关）；② 「答案页输出上限」是否过小；③ 正文超「答案页上下文上限」时答案只能看到前段；④ 切换两次生成模式重试。');
    }
    if (answerSkipNote) auditWarnings.push(answerSkipNote);
    if (browseCoverageNotes.length) auditWarnings.push(...browseCoverageNotes);

    // 🔴 生成方式提示：auto 模式下告知用户本次实际走的路径，并引导其到设置固定（用户必须清楚自己配置了什么）
    if ((typeMode || 'auto') === 'auto') {
      auditWarnings.push(`ℹ️ 生成方式：${modeLabel}（自动按资料类型：${genType}）。如需固定请到「设置 → 整卷输出预算」把该类型的「生成路径」改为「两次」或「一次」。`);
    }
    // 🔧 预算触顶提示：勾选量超该类型槽上限时，本次已自动加长预算完成生成，无需用户操作；
    //    但需告知，方便用户决定是否缩小勾选或调大该类型上限（后续生成可更省）
    if (budgetAlert) auditWarnings.push(`⚠️ ${budgetAlert}（本次已完整生成；如需更省/更稳，可缩小勾选范围，或到「设置 → 整卷输出预算」调大该类型的「上限」）。`);
    console.log(`✅ 整卷生成完成：${finalContent.length} 字符（${modeLabel}路径，${modeSource}${answerHtml ? '，含独立答案页' : ''}）（指令库注入）`);
    // 🔧 每类型预算·实测采样：正文产出率（字符/字符）落库，供设置页校准贴合度。
    //    只记正文 content（split 不含答案页；once 答案随正文，与 once 预算槽口径一致）；
    //    触顶 cap / 续写截断 的样本在统计侧剔除（预算失效场，不算真实产出率）。
    recordSample({
      genType, subject, stage: book?.stage, grade: book?.grade, name: book?.name, scope: scopeType,
      mode: generateMode, selectedRawChars,
      budgetTokens: bodyDynamicCap, outputChars: content.length,
      truncated: sampleTruncated, overCap: bodyOverCap,
    });
    return {
      success: true,
      content: finalContent,
      generatedQuestions: [],
      parsedBlueprint: [],
      blueprint: '',
      auditWarnings,
    };
  };


  // 执行生成
  // ==================== 整卷一次生成 ====================
  const generate = async (instruction, genType, selectedBooks, selectedTemplates, retryCount = 0, scopeType = '') => {
    const MAX_RETRIES = apiConfig.generationSettings?.retry?.generationRetries ?? 2;
    // 🔴 整卷质检静默明细缓存（代码确定性规则检测到的需抽检项，经 fpResult.auditWarnings 传递后展示到生成报告）
    let auditWarningsFromPaper = [];
    // 🔧 缓存管理：
    // - 逐章调用（_perChapterChapterTitle 已设置）：保留缓存供章节过滤复用
    // - 全新调用：全部清空，从 Step1 开始
    if (!_perChapterChapterTitle) {
      _cachedKnowledgeMap = null;
      _cachedContentCards = null;
      _cachedInstruction = null;
    }
    // 🔧 _perChapterChapterTitle 不在此处清除——在 generateFullPaperNatural 中用完即清
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
      // ✅ 统一生成路径：所有引擎、所有资料类型一律整卷一次生成（指令库驱动）
      // （exam=真题蓝本+命题要求，其余 8 类=教辅结构蓝本；角色由指令库模板定义）
      
      //  学段（函数级作用域，供后续模板使用）
      const stage = selectedBooks?.[0]?.stage || '';
      
      // ========== 第一步：逐课提取命题素材 ==========
      // 🔧 逐章模式（_perChapterChapterTitle 跨 genType 持久，由 GenerateModule 章节循环在完成后清除）
      let contentCards;
      let knowledgeMap;
      
      if (_perChapterChapterTitle) {
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

      // ========== 第三步：命题规划 ==========
      const step3Config = await getCurrentEngineConfigEnhanced('blueprint');
      const step3ModelName = getModelDisplayName(step3Config.textModel || step3Config.model);
      statusText.value = `步骤 3/4：命题规划 [${step3ModelName}]...`;
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
      
      // ✨ 组织风格 → 情境框架生成（情境库已退役：预设素材冗余，统一由 AI 依据风格自主生成）
      let contextFramework = '';
      // 从指令中解析组织风格（GenerateModule 注入"【组织风格】{value}：{说明}"；解析见 utils/instructionStyle.js）
      const { isUnifiedContext, isContextFusion, isContextStyle } = parseStyleFromInstruction(instruction);
      
      if (isContextStyle) {
        statusText.value = '步骤 3/4：构建情境框架...';
        progress.value = 42;
        
        try {
          const book = selectedBooks?.[0];
          const rawSubject = book?.subject || '';
          const stage = book?.stage || '';
          const subject = normalizeSubjectName(rawSubject, stage);
          const grade = book?.grade || '';

          // 🔧 情境库已退役：预设素材置空，统一走 AI 自主生成（风格指令已注入 prompt）
          if (isUnifiedContext) {
            // ── 统一情境：整卷一个核心情境，所有题目在此情境下展开（AI 自主设计）──
            console.log('AI 动态生成统一情境...');

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
              temperature: apiConfig.generationSettings.paperTemperature,
              timeout: getTimeout('blueprint'),
              // 🔧 情境框架是创作性任务，不进 L1 缓存：同科同学段的情境 prompt 完全相同，
              //    若被缓存则首次生成的"小小汉字探险家"等情境被永久复用，后续生成永远同一个框架
              skipCache: true,
            });

            try {
              const contextJson = await robustJsonParse(
                contextResult,
                (retryPrompt) => callAI(retryPrompt, { temperature: apiConfig.generationSettings.paperTemperature, taskType: 'generation' }),
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
1. 同一场景内的题目要有逻辑连贯性
2. 场景顺序应从简单到复杂，与难度递进匹配
3. 知识点的考查应均匀分布在不同场景中
`;
              console.log('✅ AI情境框架生成成功:', contextJson.name);
            } catch (e) {
              console.warn('情境框架解析失败，模型按组织风格指令自行设计情境:', e.message);
            }
          } else if (isContextFusion) {
            // ── 情境融合：每个模块/题型独立小情境，不强制统一故事（AI 自主设计）──
            console.log('AI 动态生成模块情境...');

            const fusionPrompt = `你是一位${stage}${grade}${subject}教学专家。请为一份教辅资料设计3个独立的小情境，每个情境对应一个题型/模块。

【要求】
1. 每个情境独立，不要求关联
2. 情境必须与学科内容和学生生活紧密相关
3. 情境要有真实性和任务性，考查知识迁移能力

【输出格式】必须返回严格 JSON：
{
  "contexts": [
    {
      "name": "情境名称（15字以内）",
      "description": "情境描述（40字以内）",
      "suitableTopics": ["适合考查的知识点1", "知识点2"],
      "suitableTypes": ["适合的题型1", "题型2"]
    }
  ]
}

要求 contexts 恰好3个，每个对应不同题型。只返回 JSON。`;

            const fusionResult = await callAI(fusionPrompt, {
              taskType: 'blueprint',
              temperature: apiConfig.generationSettings.paperTemperature,
              timeout: getTimeout('blueprint'),
              // 🔧 情境融合框架同样属创作性任务，不进 L1 缓存（原因同统一情境）
              skipCache: true,
            });

            try {
              const fusionJson = await robustJsonParse(
                fusionResult,
                (retryPrompt) => callAI(retryPrompt, { temperature: apiConfig.generationSettings.paperTemperature, taskType: 'generation' }),
                '情境融合框架',
                'generation'
              );

              const ctxList = fusionJson.contexts || [];
              contextFramework = `
【情境融合框架——每个模块独立设计情境】

📋 可用情境（每个题型/模块选择一个独立情境）：
${ctxList.map((c, i) => `  情境${i + 1}「${c.name}」：${c.description}
     → 适合题型：${(c.suitableTypes || []).join('、')}
     → 适合知识点：${(c.suitableTopics || []).join('、')}`).join('\n')}

⚠️ 【关键约束】
1. 每个题型/模块使用一个独立情境，不同模块情境不要求关联
2. 情境与题目高度融合，考查知识迁移能力
3. 每个模块内的题目围绕该模块的情境展开
4. 情境须与学科内容和学生生活紧密相关，要有真实性和任务性
`;
              console.log('✅ AI情境融合框架生成成功:', ctxList.length, '个情境');
            } catch (e) {
              console.warn('情境融合框架解析失败，模型按组织风格指令自行设计情境:', e.message);
            }
          }
        } catch (e) {
          console.warn('情境框架生成失败，模型按组织风格指令自行设计情境:', e.message);
        }
      }
      
      // ──────── 🔴 统一生成路径：所有引擎、所有资料类型一律整卷一次生成（指令库驱动） ────────
      //    用户只选教材 + 资料类型：exam 自动用真题蓝本（卷面结构固定），其余 8 类自动用教辅结构蓝本。
      // 整卷生成路径下声明的变量（供后续质量校验共享）
      let blueprint = '';
      let parsedBlueprint = [];
      let content = '';
      let generatedQuestions = [];
      // 🔴 整卷生成路径（指令库驱动）：无分步流水线，卷面结构由蓝图注入+密封线兜底保证
      let sectionPlans = [];
      // 🔴 PostPass 质量门/总题量防线问题（issues 声明后展示）
      let postPassIssues = [];

      // ========== 🔴 整卷一次生成（指令库驱动，主路径） ==========
      // 注入指令 = 指令库模板（UI"注入指令框"可见可编辑），一次生成整卷正文 + 独立答案页。
      // 无分块、无 byCode 拼装、无 AI 事后质检——生成质量由"人话指令 + 模型本能"保证（代码确定性兜底保留）。
      // 分步流水线（generateByRecipe/runPipeline）已整体删除。
      statusText.value = '步骤 3/4：整卷生成中...';
        progress.value = 40;

        try {
          // 🔴 差异化要求（复生成）：从注入指令解析"已覆盖知识点"清单 → 注入整卷生成
          const diffMatch = String(instruction || '').match(/已覆盖知识点[：:]\s*([^\n]+)/);
          const diffKps = diffMatch
            ? diffMatch[1].split(/[、,，;；]/).map(s => s.trim()).filter(Boolean).slice(0, 20)
            : [];
          const fpResult = await generateFullPaperNatural({
            instruction, genType, selectedBooks, selectedTemplates,
            contentCards, knowledgeMap, contextFramework, templateInfo,
            diffKps,
            scopeType: scopeType || '',
          });
          if (!fpResult.success) {
            throw new Error(fpResult.error || '整卷生成失败');
          }
          content = fpResult.content;
          generatedQuestions = fpResult.generatedQuestions || [];
          parsedBlueprint = fpResult.parsedBlueprint || [];
          blueprint = '';
          sectionPlans = [];
          postPassIssues = [];
          // 🔴 整卷质检静默明细 → 转"抽检提示"展示到生成报告【问题列表】（代码确定性规则，零 AI 调用）
          if (fpResult.auditWarnings?.length) {
            auditWarningsFromPaper = fpResult.auditWarnings;
          }
          console.log(`✅ 整卷生成完成：${content.length} 字符（指令库注入）`);
        } catch (fpError) {
          console.error('整卷生成失败:', fpError.message);
          throw fpError; // 上抛给外层 generate 的 catch 处理（重试逻辑）
        }
      
      // ========== 第四步：多维度质量校验 ==========
      // 🔧 所有引擎（含 Ollama）统一走整卷路径，步骤固定为 4/4
      const stepQCConfig = await getCurrentEngineConfigEnhanced('review');
      const stepQCModelName = getModelDisplayName(stepQCConfig.textModel || stepQCConfig.model);
      const qcStepLabel = '4/4';
      statusText.value = `步骤 ${qcStepLabel}：质量校验 [${stepQCModelName}]...`;
      progress.value = 85;

      const issues = [];
      // 🔴 整卷质检静默明细（代码确定性规则检测到的需抽检项）→ 展示到生成报告【问题列表】
      if (auditWarningsFromPaper?.length) {
        auditWarningsFromPaper.forEach(w => issues.push(w));
      }
      // 🔴 PostPass 质量门/总题量防线问题 → 展示到生成报告（issues 已声明）
      if (postPassIssues?.length) {
        postPassIssues.forEach(q => issues.push(`❌ ${q}`));
      }
      // 🔴 未分析/无原文章节提示 → 展示到生成报告（混合勾选时用户需知道哪些章用了目录模式）
      const unanalyzedCardList = (contentCards || []).filter(c => c.source === 'unanalyzed').map(c => c.chapterTitle);
      const tocCardList = (contentCards || []).filter(c => c.source === 'toc').map(c => c.chapterTitle);
      if (unanalyzedCardList.length > 0) {
        issues.push(`⚠️ 以下章节有教材原文但未执行分析提取，已按目录模式生成（完整命题素材需先"分析提取"）：${unanalyzedCardList.join('、')}`);
      }
      if (tocCardList.length > 0) {
        issues.push(`⚠️ 以下章节未能提取到教材原文（OCR/解析无内容），已按目录模式生成：${tocCardList.join('、')}`);
      }

      // 🔴 整卷质检（生成端保障）：
      //    - AI 质检已移除——"自产自评"无意义（同一模型检不出系统性错误），
      //      质检误报还会中断整卷生成（实测空壳误判→两次重试→整卷失败）；
      //    - 代码确定性兜底保留（auditExamPaper 已在整卷生成内部执行：拼音/模板残留/分值对齐等 fix + guard 静默抽检）

      // 初始化质量报告（最小结构，兼容 UI 展示；无检查项）
      const qualityReport = {
        formatCheck: { passed: true, details: [] },
        coverageCheck: { passed: true, details: [] },
        difficultyCheck: { passed: true, details: [] },
        knowledgeCheck: { passed: true, details: [] },
        templateMatch: { passed: true, details: [] },
        semanticCheck: { passed: true, details: [] },
        manualReview: []
      };

      // 生成完成（不再做生成后质检）——直接进入结果返回
      
      // 🔧 生成摘要（仅过程信息，无质检结论）
      const summaryParts = ['生成完成'];
      // 🔧 章节来源统计：区分"已分析/未分析/无原文"，混合勾选时用户清楚知道每类章节的素材来源
      const analyzedCardCount = (contentCards || []).filter(c => c.source !== 'unanalyzed' && c.source !== 'toc').length;
      const unanalyzedCardCount = (contentCards || []).filter(c => c.source === 'unanalyzed').length;
      const tocCardCount = (contentCards || []).filter(c => c.source === 'toc').length;
      if (analyzedCardCount > 0 && (unanalyzedCardCount > 0 || tocCardCount > 0)) {
        summaryParts.push(`✅${analyzedCardCount}章已分析`);
      }
      if (unanalyzedCardCount > 0) {
        summaryParts.push(`⚠️${unanalyzedCardCount}章未分析·目录模式`);
      }
      if (tocCardCount > 0) {
        summaryParts.push(`📑${tocCardCount}章无原文·目录模式`);
      }
      if (issues && issues.length > 0) {
        const errorCount = issues.filter(i => i.startsWith('❌')).length;
        const warnCount = issues.filter(i => i.startsWith('⚠️')).length;
        if (errorCount > 0) summaryParts.push(`❌${errorCount}个错误`);
        if (warnCount > 0) summaryParts.push(`⚠️${warnCount}个警告`);
      } else {
        summaryParts.push('✅生成完成');
      }
      statusText.value = summaryParts.join(' | ');
      progress.value = 100;

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
      // 🔴 出厂质检失败不整卷自动重试（成本高且不保证修复）——直接进入弹窗让用户选择重试/批量/取消
      if (retryCount < MAX_RETRIES && !error.qualityGate) {
        await new Promise(resolve => setTimeout(resolve, apiConfig.generationSettings?.retry?.baseDelayMs ?? 2000));
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

      // 🔴 分步流水线残留路径已移除：全类型一律走整卷一次生成（指令库驱动，结构由蓝图注入保证）

      // 用户选择取消
      return { success: false, error: error.message, retried: retryCount > 0 };
    } finally {
      if (retryCount === 0) {
        isGenerating.value = false;
      }
    }
  };

  // ==================== 知识点总结生成（两步流程） ====================

  // ==================== 错题本生成（三步流程） ====================

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
          }, { timeout: getTimeout('infra') });
        } catch {
          // API 卸载失败，忽略
        }
        
        // 方式2：命令行强杀模型（更可靠）
        try {
          const { exec } = require('child_process');
          await new Promise((resolve) => {
            exec(`ollama stop ${model.name}`, { timeout: getTimeout('ollamaOp') }, (error, stdout, stderr) => {
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

/**
   * 🔴 残留整卷路径 generateBatchWithBlueprint 已移除（2026-08）：
   *    全类型一律走整卷一次生成（指令库驱动，蓝图注入卷面结构，无分步流水线）。
   */

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
- 必须是一道全新题目：换情境、换数据、换表述，不得与原题雷同
- 保持 HTML 格式
${questionPlan.score ? `- 标注：【知识点：${questionPlan.knowledgePoint}】【难度：${questionPlan.difficulty}】\n` : ''}

只返回一道题的HTML代码。`;

    return await callAI(variantPrompt, {
      taskType: 'generation',
      temperature: apiConfig.generationSettings.paperTemperature,
      timeout: getTimeout('variant'),
      maxTokens: 4096, // 单题变体，预算封顶防异常
      allowContinuation: false,
    });
  };

  const extractGraphs = (content) => {
    const matches = content?.match(/\[GRAPH\][\s\S]*?\[\/GRAPH\]/g) || [];
    return matches.map(m => ({ full: m }));
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

  // 🔧 逐章生成：设置当前章节标题，下次 generate() 从缓存过滤出单章数据
  const setPerChapterFilter = (chapterTitle) => {
    _perChapterChapterTitle = chapterTitle;
  };

    return {
    isGenerating,
    progress,
    statusText,
    abortController,
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
    setLabelOverride,      // ✏️ 名称样式手动选择（方案二）
    getLabelPool,          // ✏️ 名称池查询（供下拉选项）
    pickLabelFromPool,     // ✏️ 名称池轮换选取（标题类型名，labelStyle 固定优先）
    pickScopeFromPool,     // 📐 范围标签词轮换（期中/期末/月考/专题，避免标题千篇一律）
    setScopeLabelOverride, // 📐 考试标签维度固定名称（名称样式弹窗，null=恢复轮换）
    generate,
    setPerChapterFilter,
    cancelGeneration,
    extractGraphs,
    generateQuestionVariant,
    smartWait,
    checkModelLoaded,
    checkModelReady,  // 🔧 新增：检测模型是否真正就绪
    smartWaitForModel  // 🔧 新增：智能等待模型空闲
  };
}