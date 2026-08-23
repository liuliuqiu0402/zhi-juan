/**
 * 分步生成流水线 Runner（依赖注入编排器，独立工具库）
 * ============================================================
 * 🔴 定位：流水线的"执行编排层"——与 useAiGenerator 完全解耦。
 *    所有外部依赖（AI 调用、素材检索、取消信号、状态回调、日志）通过
 *    `deps` 参数注入，因此本模块可独立单元测试（mock 依赖）、可复用、
 *    可替换任一步骤实现，符合生产流水线"每步一个可精准调用的工具"。
 *
 * 流水线各步骤的工具函数：
 *   Pass 1 规划    → examPipeline.assignKpsToSections / buildNonExamPlans / validateSectionPlans
 *   Pass 2 指令    → examPipeline.buildSectionInstruction（逐板块短指令）
 *   Pass 2.5 答案  → examPipeline.buildAnswerInstruction（统一答案页）
 *   Pass 3 拼接    → examPipeline.assemblePaperHeader
 *   素材注入        → deps.retrieveSegments（教材原文）/ deps.semanticSearch（例题情境）
 *   Pass 4 质检    → 由上层 generateFullPaper 公共后处理承担（题目解析/质检/修复）
 *
 * 失败语义：任一板块生成失败（重试 2 次后）→ 抛出错误，上层捕获后回退整卷生成。
 * 取消语义：deps.isAborted() 返回 true 时立即中止。
 * ============================================================
 */
import {
  extractKnowledgePoints,
  assignKpsToSections,
  buildNonExamPlans,
  buildSectionInstruction,
  buildAnswerInstruction,
  assemblePaperHeader,
  validateSectionPlans,
  parseStructureBlocks,
} from './examPipeline.js';

const STAGE_LABEL_MAP = {
  primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段',
  middle: '初中', high: '高中',
};

const cleanSectionHtml = (raw) => {
  if (!raw) return '';
  let html = raw;
  html = html.replace(/^\`\`\`html?\s*\n?/i, '').replace(/\n?\`\`\`\s*$/i, '');
  const bm = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bm) html = bm[1];
  html = html.replace(/<div[^>]*class=["'][^"']*self-review[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  return html.trim();
};

/**
 * 执行分步生成流水线
 * @param {object} opts 流水线输入
 * @param {object} deps 依赖注入（可 mock）
 *   deps.callAI(prompt, options)      — AI 调用（prompt, {taskType,timeout,retries,systemMessage}）
 *   deps.retrieveSegments(cards, kps, maxChars) — 教材原文检索（复用 retrieveBlueprintSegments）
 *   deps.semanticSearch(kp, topK)    — 语义检索（复用 semanticRetriever.findRelevant）
 *   deps.isAborted()                 — 取消信号
 *   deps.setStatus(text) / deps.setProgress(n) — 进度回调
 *   deps.log(...args)                — 日志回调（默认 console）
 * @returns {Promise<{content:string, sections:Array, answerGenerated:boolean, answerError:string|null}>}
 */
export async function runExamPipeline(opts, deps = {}) {
  const {
    instruction, systemMessage, examBlueprint, subject, stage, region,
    book, contentCards, knowledgeMap, materialText, genType = 'exam', totalScore = 0,
  } = opts || {};
  const log = deps.log || console.log.bind(console);
  const warn = deps.warn || console.warn.bind(console);
  const setStatus = deps.setStatus || (() => {});
  const setProgress = deps.setProgress || (() => {});
  const isAborted = deps.isAborted || (() => false);
  const callAI = deps.callAI;
  const retrieveSegments = deps.retrieveSegments;
  const semanticSearch = deps.semanticSearch;

  if (!callAI) throw new Error('runExamPipeline: 缺少依赖 deps.callAI');

  // ── Pass 1：数据驱动板块规划（零 AI 漂移）──
  const allKps = extractKnowledgePoints(knowledgeMap);
  const isExamPlan = !!examBlueprint;
  let plans;
  if (isExamPlan) {
    plans = assignKpsToSections(examBlueprint.sections || [], allKps, subject);
    const planCheck = validateSectionPlans(plans, examBlueprint);
    if (!planCheck.ok) throw new Error('板块规划校验失败: ' + planCheck.errors.join('; '));
  } else {
    plans = buildNonExamPlans(instruction, allKps, totalScore);
    if (!plans.length) throw new Error('未从结构大纲解析到板块，无法分步');
  }

  const stageLabel = STAGE_LABEL_MAP[stage] || stage || '';
  const gradeLabel = book?.grade || '';
  const header = isExamPlan
    ? assemblePaperHeader(examBlueprint, { gradeLabel, region })
    : `<h1>${book?.subject || subject}${gradeLabel}${genType === 'practice' ? '课时练' : '学习资料'}</h1>\n<p>（${stageLabel}·${genType === 'practice' ? '课时巩固练习' : '同步学习资料'}${region ? `　地区：${region}` : ''}）</p>`;

  // ── Pass 2：逐板块短指令生成 ──
  const sectionsHtml = [];
  setStatus(`分步生成：规划 ${plans.length} 个板块...`);
  setProgress(45);

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    if (isAborted()) throw new Error('生成已取消');
    setStatus(`分步生成：第 ${i + 1}/${plans.length} 板块「${plan.name}」...`);
    setProgress(45 + Math.round((i / plans.length) * 35));

    // 板块级素材检索（教材原文，聚焦本板块）
    let sectionMaterial = '';
    if (plan.kps?.length && contentCards?.length && retrieveSegments) {
      const segRetrieved = retrieveSegments(contentCards, plan.kps.map(kp => ({ knowledgePoint: kp })), 2000);
      if (segRetrieved) {
        sectionMaterial = '【🔴 本板块教材原文依据——命题必须紧扣以下原文】\n' + segRetrieved;
      }
    }
    if (!sectionMaterial && materialText) {
      sectionMaterial = materialText.length > 2000 ? materialText.substring(0, 2000) + '...(已裁剪)' : materialText;
    }

    // 语义素材注入（教材例题/情境，真实性保障）
    let sectionContext = '';
    if (plan.kps?.length && semanticSearch) {
      const related = [];
      for (const kp of plan.kps.slice(0, 4)) {
        try {
          related.push(...(semanticSearch(kp, 2) || []));
        } catch (e) { /* 单点检索失败不阻塞 */ }
      }
      const unique = [...new Map(related.map(r => [r.text, r])).values()].slice(0, 3);
      if (unique.length) {
        sectionContext = '【🔴 本板块教材例题/情境参照——情境设计与数据须贴近教材真实素材，禁止凭空编造脱离教材的情境】\n'
          + unique.map(r => `· [${r.chapterTitle || '教材'}${r.type ? `·${r.type}` : ''}] ${String(r.text || '').substring(0, 200)}`).join('\n');
      }
    }

    const secInstruction = buildSectionInstruction(plan, {
      subject, stage, stageLabel, examBlueprint,
      materialText: [sectionMaterial, sectionContext].filter(Boolean).join('\n\n'),
      region, sectionNo: i + 1, totalScore,
    });

    // 板块生成重试：单板块最多 2 次
    let sectionHtml = '';
    let secLastError = null;
    for (let secTry = 0; secTry < 2; secTry++) {
      try {
        const resp = await callAI(secInstruction, {
          taskType: 'generation', timeout: 180000, retries: 0,
          systemMessage: systemMessage || undefined,
        });
        const html = cleanSectionHtml(resp);
        if (html && html.length > 120) { sectionHtml = html; break; }
        throw new Error('板块 HTML 过短/为空');
      } catch (secError) {
        secLastError = secError;
        if (isAborted()) throw secError;
        if (secTry === 0) {
          await new Promise(r => setTimeout(r, 2000));
          warn(`⚠️ 板块「${plan.name}」第${secTry + 1}次失败，重试:`, secError.message);
        }
      }
    }
    if (!sectionHtml) throw new Error(`板块「${plan.name}」生成失败: ${secLastError?.message || '未知错误'}`);
    sectionsHtml.push(sectionHtml);
  }

  // ── Pass 3：拼接正文 ──
  const bodyHtml = sectionsHtml.join('\n');
  const paperContent = `${header}\n${bodyHtml}`;

  // ── Pass 2.5：统一生成答案页 ──
  setStatus('分步生成：撰写参考答案与评分标准...');
  setProgress(82);
  let answerHtml = '';
  let ansError = null;
  try {
    const ansInstruction = buildAnswerInstruction(subject, stageLabel, paperContent, examBlueprint);
    const ansResp = await callAI(ansInstruction, {
      taskType: 'generation', timeout: 240000, retries: 1,
      systemMessage: systemMessage ? `${systemMessage}\n此调用仅输出答案区，勿重复输出题目正文。` : undefined,
    });
    let aHtml = cleanSectionHtml(ansResp);
    if (!/<div[^>]*class=["'][^"']*answer-section/i.test(aHtml)) {
      aHtml = `<div class="answer-section"><h2>参考答案</h2>\n${aHtml}</div>`;
    }
    if (aHtml.length > 200) answerHtml = aHtml;
    else throw new Error('答案页过短');
  } catch (ansErr) {
    ansError = ansErr;
    warn('⚠️ 答案页生成失败，正文仍有效:', ansErr.message);
  }

  const finalContent = answerHtml ? `${paperContent}\n\n${answerHtml}` : paperContent;
  log(`📦 分步流水线：${plans.length} 板块 + 答案页${answerHtml ? '' : '（缺失）'}，共 ${finalContent.length} 字符`);

  return {
    content: finalContent,
    sections: plans,
    answerGenerated: !!answerHtml,
    answerError: ansError?.message || null,
  };
}

export default { runExamPipeline, cleanSectionHtml, STAGE_LABEL_MAP };
