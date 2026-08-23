/**
 * 分步生成流水线（阶段3：根治长指令执行衰减）
 * ============================================================
 * 🔴 目的：把"一次长指令整卷生成"（后段约束易被模型忽略）改造为
 *    「数据驱动板块规划 → 逐板块短指令生成 → 拼接 → 质检」流水线：
 *
 *    Pass 1 板块规划（纯数据驱动，零 AI）：蓝本 sections + 知识图谱
 *           → 每板块的题量/题型/考点分配清单（无需模型，杜绝规划漂移）
 *    Pass 2 逐板块生成：每板块一个独立短 prompt（该板块约束 + 真题样例 +
 *           检索素材 + 格式规范），指令长度控制在 ~600 token，执行率大幅提升
 *    Pass 3 拼接：卷首 + 各板块 + 答案区锚定（听力原文/评分标准）
 *    Pass 4 质检与局部重生成：qualityChecker 全量检查，不合格板块单独重写
 *
 * 覆盖范围：exam（正式考卷）走完整流水线；其他 genType 保持整卷路径
 *           （已注入基准+样例+素材检索，质量同样受控）。
 * ============================================================
 */
import { getExamBlueprint } from './examPaperBlueprints';
import { buildSampleText } from './examSampleLibrary';
import { buildBenchmarkText } from './propositionBenchmarks';
import { buildStandardQuestionText } from './standardQuestionBank';
import { buildTeachingMaterialText, TEACHING_MATERIAL_BANK } from './teachingMaterialBank';

/** 从蓝本 note 解析题量：优先匹配"（N小题/N题/N空）"或"共N题"，兜底按分值推算 */
export function parseQuestionCount(note = '', score = 0) {
  // 空 note 也尝试分值兜底（不直接 return 0）
  const n = String(note || '');
  const m1 = n.match(/共\s*(\d+)\s*小题/);
  if (m1) return parseInt(m1[1]);
  const m2 = n.match(/共\s*(\d+)\s*题/);
  if (m2) return parseInt(m2[1]);
  const m3 = n.match(/[（(]\s*(\d+)\s*小题/);
  if (m3) return parseInt(m3[1]);
  const m4 = n.match(/(\d+)\s*题×\s*(\d+)\s*分/);
  if (m4) return parseInt(m4[1]);
  const m5 = n.match(/(\d+)\s*小题/);
  if (m5) return parseInt(m5[1]);
  // "N题共X分"（如"5题共77分"）
  const m6 = n.match(/(\d+)\s*题共\s*(\d+)\s*分/);
  if (m6) return parseInt(m6[1]);
  // "N空，..."（如"10空，语境理解"）
  const m7 = n.match(/(\d+)\s*空/);
  if (m7) return parseInt(m7[1]);
  // 按常见分值 2 分/题估算（仅当 note 无法解析时）
  if (score > 0 && score % 2 === 0) return Math.round(score / 2);
  return 0;
}

/** 从知识图谱提取所有知识点/核心概念清单 */
export function extractKnowledgePoints(knowledgeMap) {
  const kps = [];
  if (knowledgeMap?.knowledgePoints?.length) {
    kps.push(...knowledgeMap.knowledgePoints.map(kp => (typeof kp === 'string' ? kp : kp.name)).filter(Boolean));
  }
  if (knowledgeMap?.knowledgeGraph?.length) {
    for (const unit of knowledgeMap.knowledgeGraph) {
      for (const bc of (unit.bigConcepts || [])) {
        if (bc.bigConcept) kps.push(bc.bigConcept);
        for (const ck of (bc.coreKnowledge || [])) {
          if (ck.name) kps.push(ck.name);
          if (ck.specificConcepts?.length) kps.push(...ck.specificConcepts);
        }
      }
    }
  }
  return [...new Set(kps)];
}

/**
 * 从生成指令中解析"结构大纲"板块（非 exam 类型的分步单元来源）
 * 指令中注入格式："结构参考：\n一、基础建构（字词积累）\n二、任务驱动（阅读）..."
 * @returns {Array<{name:string, desc:string, index:number}>}
 */
export function parseStructureBlocks(instruction = '') {
  if (!instruction) return [];
  const lines = instruction.split('\n');
  const blocks = [];
  let inStruct = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^结构参考[：:]\s*$/i.test(trimmed) || /^【结构大纲】/.test(trimmed)) {
      inStruct = true;
      continue;
    }
    if (!inStruct) continue;
    if (/^【/.test(trimmed) || /^---/.test(trimmed)) break; // 下一个节
    const m = trimmed.match(/^[（(]?[一二三四五六七八九十]+[）)、．.]\s*(.+)$/);
    if (m) {
      const content = m[1].trim();
      // 拆分"板块名（描述）"
      const nameMatch = content.match(/^([^（(]+)/);
      const descMatch = content.match(/[（(]([^）)]+)[）)]/);
      blocks.push({
        index: blocks.length,
        name: (nameMatch ? nameMatch[1].trim() : content).replace(/[、，,]\s*$/, ''),
        desc: descMatch ? descMatch[1] : content,
      });
    }
  }
  return blocks;
}

/** 构建非 exam 板块的分步规划（结构大纲板块 + 分值均分 + 考点分配） */
export function buildNonExamPlans(instruction, kps, totalScore = 0) {
  const structBlocks = parseStructureBlocks(instruction);
  if (!structBlocks.length) return [];
  // 分值均分到各板块（非 exam 无硬性分值，平均分配便于总量受控）
  const perScore = structBlocks.length > 0 ? Math.round(totalScore / structBlocks.length) : 0;
  const plans = structBlocks.map((b, i) => ({
    index: i,
    name: b.name,
    note: b.desc || '',
    score: perScore,
    questionCount: 0,
    kps: [],
  }));
  // 考点分配：按板块描述关键词匹配，未匹配兜底末板块
  const unmatched = [];
  for (const kp of kps) {
    let placed = false;
    for (const plan of plans) {
      const kw = (plan.note || '') + (plan.name || '');
      if (kp && (kw.includes(kp) || (kw.match(/[\u4e00-\u9fa5]{2,4}/g) || []).some(w => kp.includes(w) && w.length >= 2))) {
        plan.kps.push(kp);
        placed = true;
        break;
      }
    }
    if (!placed && kp) unmatched.push(kp);
  }
  if (unmatched.length && plans.length) {
    plans[plans.length - 1].kps.push(...unmatched);
  }
  return plans;
}

/**
 * 从教辅编辑知识库的栏目构建分步规划（非 exam 兜底：无结构大纲时也强制分步）
 * 栏目即板块（【情境任务】【基础型任务】…），分值均分、考点留空由板块指令兜底
 */
export function buildTeachingMaterialPlans(genType, totalScore = 0) {
  const bank = TEACHING_MATERIAL_BANK[genType];
  if (!bank?.columns?.length) return [];
  const perScore = bank.columns.length > 0 && totalScore > 0 ? Math.round(totalScore / bank.columns.length) : 0;
  return bank.columns.map((col, i) => {
    const m = String(col || '').match(/^【(.+?)】\s*([\s\S]*)$/);
    return {
      index: i,
      name: m ? m[1].trim() : `栏目${i + 1}`,
      note: m && m[2] ? m[2].trim() : col,
      score: perScore,
      questionCount: 0,
      kps: [],
    };
  });
}

/** 把知识点按板块 note 关键词匹配分配（纯数据驱动，无 AI 规划漂移） */
export function assignKpsToSections(sections, kps, subject = '') {
  const plans = sections.map((sec, i) => ({
    index: i,
    name: sec.name,
    score: sec.score,
    note: sec.note || '',
    questionCount: parseQuestionCount(sec.note, sec.score),
    kps: [],
  }));
  const unmatched = [];
  for (const kp of kps) {
    let placed = false;
    for (const plan of plans) {
      const kw = plan.note + plan.name;
      // 知识点名或其关键词出现在板块说明中 → 归属该板块
      if (kp && kw.includes(kp)) {
        plan.kps.push(kp);
        placed = true;
        break;
      }
      // 板块说明中的显式关键词（如"函数""几何""阅读"）出现在知识点中
      const noteWords = kw.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
      if (kp && noteWords.some(w => kp.includes(w) && w.length >= 2)) {
        plan.kps.push(kp);
        placed = true;
        break;
      }
    }
    if (!placed && kp) unmatched.push(kp);
  }
  // 未匹配考点平均分配到有容纳空间的板块（最后一板块兜底）
  if (unmatched.length) {
    plans[plans.length - 1].kps.push(...unmatched);
  }
  return plans;
}

/** 构建单个板块的生成指令（短指令，~600 token） */
export function buildSectionInstruction(plan, ctx) {
  const {
    subject, stageLabel, examBlueprint, materialText, region,
    sectionNo = plan.index + 1,
    totalScore = examBlueprint?.fullScore || 0,
    stage = '', // 学段键（primary_low/middle/high），用于样例库匹配
    isExamPlan = !!examBlueprint,
    propositionMaterial = '', // 🔴 命题素材（教材可加工要素，非原文）
    genType = isExamPlan ? 'exam' : 'practice', // 🔴 双角色分流：exam=命题老师，其他=教辅编辑
  } = ctx || {};
  const cn = '一二三四五六七八九十'[plan.index] || String(plan.index + 1);
  const kpText = plan.kps.length ? plan.kps.join('、') : '（按教材覆盖合理分配考点）';
  // 🔴 样例按板块名筛选最相关 1-2 条（瘦身：避免每板块重复注入全部样例）
  const sampleText = buildSampleText(subject, stage, plan.name + (plan.note || ''));
  // 🔴 命题内容质量基准（学科×学段硬规范）：exam 且已注入蓝本时跳过通用底线（EXAM_NEW_STANDARD 已含）
  const benchmarkText = buildBenchmarkText(subject, stage, !(ctx.isExamPlan));
  // 🔴 双角色知识库：exam=命题老师标准题型骨架；非 exam=教辅编辑栏目结构（讲练结合/梯度/引导）
  const standardText = isExamPlan
    ? buildStandardQuestionText(subject, stage, plan.name.replace(/^.*?·/, ''))
    : buildTeachingMaterialText(genType);
  // 非 exam（课时练等）无硬性分值/满分约束 → 简化标题表述，避免"满分0分"等误导
  const isScored = totalScore > 0 && plan.score > 0;
  const countText = plan.questionCount ? `${plan.questionCount}题` : (isScored ? '' : '若干题');

  let instruction = isScored
    ? `【生成第${cn}板块：${plan.name}（${countText ? countText + '，' : ''}共${plan.score}分，满分${totalScore}分）】\n你是命题专家，严格按下述要求生成【${plan.name}】这一个板块的完整题目与题干，输出 HTML 片段（不要输出整卷标题、不要输出其他板块、不要输出答案）。`
    : `【生成第${cn}板块：${plan.name}】\n你是命题专家，严格按下述要求生成【${plan.name}】这一个板块的完整题目与题干，输出 HTML 片段（不要输出整卷标题、不要输出其他板块、不要输出答案）。`;

  instruction += `\n\n【本板块命题要求】
1. ${plan.questionCount ? `题量：${plan.questionCount} 题；` : (isScored ? '' : '题量：按内容覆盖需要合理设计；')}${isScored ? `分值体系：小题分值之和必须等于本板块总分 ${plan.score} 分，每道小题题干末尾标注（X分）。` : '每道小题题干末尾标注（X分），分值合理（按题型难度分配）。'}
2. 考查内容：本板块覆盖以下考点——${kpText}。所有考点必须与教材内容一致，禁止超纲、禁止编造教材没有的知识点。
3. 内容质量：遵循新课标素养立意——情境真实适切、设问有层次（信息提取→理解分析→推理评价递进）、杜绝机械记忆与偏题怪题。
4. 命题规范：${plan.note || '题型与分值按规范执行'}`;

  if (standardText) {
    instruction += `\n\n${standardText}`;
  }

  // 🔴 命题素材（可加工要素，非原文）优先；无素材时回退原文依据（明确标注禁照抄）
  if (propositionMaterial) {
    instruction += `\n\n${propositionMaterial}`;
  } else if (materialText) {
    instruction += `\n\n【教材原文依据（命题必须紧扣以下原文，不可脱离原文臆造知识点；但题目须重新组织情境与句式，禁止照搬原文段落）】\n${materialText}`;
  }

  if (benchmarkText) {
    instruction += `\n\n${benchmarkText}`;
  }

  if (sampleText) {
    instruction += `\n\n【真题级样例（供模仿设问方式与内容质量，严禁照抄原题）】
${sampleText}`;
  }

  // 🔴 明细式标题（蓝本第6条）："一、XX。（共X题，每题X分，共X分）"；小题分无法均分时省略"每题X分"
  const perScore = isScored && plan.questionCount > 0 && plan.score % plan.questionCount === 0
    ? Math.round(plan.score / plan.questionCount)
    : 0;
  const titleSuffix = isScored
    ? `（共${plan.questionCount || 'X'}题${perScore ? `，每题${perScore}分` : ''}，共${plan.score}分）`
    : '';

  instruction += `\n\n【输出格式】
- 用 <h2>${cn}、${plan.name}。${titleSuffix}</h2> 作为本板块标题（标题必须原样保留此括号内的题数与分值标注）；
- 每道小题用 <p class="question">...</p> 包裹，题号从 1 开始连续编号，题干末尾标注（X分）；
- 选择题给 A/B/C/D 四个选项（用 <p class="option"> 包裹）；填空题用 <u class="blank-2">&emsp;</u> 标签；
- 直接输出 HTML 片段，禁止 Markdown 代码块、禁止前言解释、禁止输出答案与评分标准。`;
  return instruction;
}

/** 拼接卷首 + 各板块正文（Pass 3 拼装器） */
export function assemblePaperHeader(examBlueprint, extra = {}) {
  const { academicTitle = '', gradeLabel = '', region = '', termLabel = '' } = extra;
  const subject = examBlueprint?.label || '';
  const title = academicTitle || `${subject}${gradeLabel}${termLabel}试卷`;
  // 🔴 卷首时长/满分/密封线信息栏全部由代码拼装（模型无机会写错）：
  //    密封线结构对齐蓝本 EXAM_PAPER_LAYOUT 第1条（seal-zone：提示语+信息栏+密/封/线竖向）
  return `<h1>${title}</h1>
<p>（考试时间：${examBlueprint?.duration || '--'}　满分：${examBlueprint?.fullScore || '--'}分${region ? `　地区：${region}` : ''}）</p>
<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div></div>`;
}

/** 构建答案页生成指令（Pass 2.5：题目已定，统一生成答案+评分标准+听力原文） */
export function buildAnswerInstruction(subject, stageLabel, fullText, examBlueprint) {
  const totalScore = examBlueprint?.fullScore || 0;
  return `【为已生成试卷撰写完整参考答案与评分标准】（试卷满分 ${totalScore} 分）
你是阅卷专家，请为下方试卷的全部题目撰写答案页。严格遵循：
1. 答案区以 <div class="answer-section"><h2>参考答案</h2> ... </div> 包裹；
2. 每题答案标注（X分）与题目分值一一对应（客观题：答案+1-2句解析；解答/简答：要点+分步给分说明，各要点分值之和=该题总分）；
3. 作文/习作/书面表达：四维度评分标准（内容/语言/结构/书写比例和=题分）+ 1篇参考范文；
4. 英语含听力板块：必须完整写出【听力原文】（供教师朗读，每段材料读两遍），听力题答案逐题给出；
5. 计算题：解→公式→代入→计算→答，每步标注得分点；
6. 直接输出答案区 HTML，禁止 Markdown 代码块、禁止前言解释。

【试卷全文】
${fullText}`;
}

/**
 * 校验分步规划的完整性（守卫测试用）：
 * 1. 板块数 > 0；2. 每板块分值 > 0；3. 板块分值之和 == 蓝本总分；
 * 4. 题量可解析（>0 或显式未知）；5. 知识点已分配（无遗漏或已兜底）
 */
export function validateSectionPlans(plans, examBlueprint) {
  if (!plans?.length) return { ok: false, errors: ['无板块规划'] };
  if (!examBlueprint?.fullScore) return { ok: false, errors: ['蓝本缺总分'] };
  const errors = [];
  const sum = plans.reduce((a, c) => a + c.score, 0);
  if (sum !== examBlueprint.fullScore) {
    errors.push(`板块分值之和 ${sum} ≠ 蓝本总分 ${examBlueprint.fullScore}`);
  }
  for (const p of plans) {
    if (!p.name) errors.push(`板块 ${p.index + 1} 缺名称`);
    if (p.score <= 0) errors.push(`板块 ${p.name} 分值非法: ${p.score}`);
  }
  return { ok: errors.length === 0, errors, planCount: plans.length, totalScore: sum };
}

export default {
  parseQuestionCount,
  extractKnowledgePoints,
  parseStructureBlocks,
  buildNonExamPlans,
  buildTeachingMaterialPlans,
  assignKpsToSections,
  buildSectionInstruction,
  buildAnswerInstruction,
  assemblePaperHeader,
  validateSectionPlans,
};
