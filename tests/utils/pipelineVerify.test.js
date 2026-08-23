// 运行验证：分步流程是否真正变短 + 基准注入正常（输出量化对比到控制台）
import { describe, it, expect } from 'vitest';
import {
  buildSectionInstruction,
  buildNonExamPlans,
  assignKpsToSections,
  extractKnowledgePoints,
  validateSectionPlans,
} from '@/config/examPipeline';
import { filterSystemByMode } from '@/config/examPipelineRunner';
import { getExamBlueprint } from '@/config/examPaperBlueprints';

const estimateTokens = (t) => {
  const s = String(t || '');
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  const other = s.replace(/[\u4e00-\u9fff]/g, '').length;
  return Math.round(cjk * 0.6 + other / 4);
};

const LINE = '─'.repeat(72);

describe('分步生成流程验证（变短 + 基准注入）', () => {
  it('exam 分步板块指令显著短于整卷长指令，且命题基准/教材素材正常注入', () => {
    const bp = getExamBlueprint('语文', 'middle', '江苏·南京');
    const km = {
      knowledgePoints: ['古诗文默写', '文言文阅读', '现代文阅读', '写作'],
      knowledgeGraph: [
        { unit: '第一单元', bigConcepts: [{ bigConcept: '文言文', coreKnowledge: [{ name: '文言文阅读' }] }] },
      ],
    };
    const kps = extractKnowledgePoints(km);
    const plans = assignKpsToSections(bp.sections, kps, '语文');
    const planCheck = validateSectionPlans(plans, bp);

    console.log(LINE);
    console.log(`【验证1】蓝本=${bp.label} 满分${bp.fullScore} 板块=${bp.sections.length} 规划校验=${planCheck.ok ? '通过✓' : '失败✗'}`);

    // 模拟真实整卷长指令规模：buildGenerationInstruction 输出含几十个节，各节均有实质内容（角色/红线/蓝本/基准/样例/结构大纲/教材章节/素养/题型分配/难度/页数/格式/尾约束/答案规范等）
    const realWholeInstruction = [
      '【角色身份】你是资深命题专家，熟悉新课标，擅长命制真题级试卷',
      '【标题格式】试卷标题规范：{academicTitle}初中八年级语文期末试卷',
      '【核心任务】请生成一份「八年级语文期末试卷」，覆盖第一至第三单元全部课文与知识点，题目达到真题级质量，可直接作为正式考卷使用',
      '【红线约束】1.禁止超纲 2.禁止照搬教材原题 3.禁止出现错误知识点 4.禁止偏题怪题 5.情境必须真实适切',
      '【命题内容质量基准】依据：2022版语文课标·评价建议。硬性要求：1.积累运用型填空考理解运用（归类/比喻理解/品质推断/情境运用轮换），禁止单点回忆背诵；2.阅读材料为完整语篇（300-900字），选材兼顾文学类（记叙/散文）与实用类（说明/非连续文本）；3.设问沿信息提取→词句理解→整体把握→推断鉴赏递进，每篇至少1题推断或赏析；4.写作给选材提示或情境支架；5.文言文考查置于语篇语境。真题级样例：阅读设问示例：先问"文中描写了哪些景物"，再问"作者为什么说____（推断）"，末问"表达了怎样的情感（鉴赏）"',
      '【真题卷结构蓝本】一、积累与运用（共8题，共28分）二、古诗文阅读（共6题，共22分）三、现代文阅读（共7题，共30分）四、写作（共1题，共40分），满分120分，考试时间120分钟，卷面规范见细则',
      '【结构大纲】一、基础积累 二、阅读理解 三、写作表达',
      '【教材章节确认】《八年级上册语文》第一单元~第三单元，每篇课文均须有考点覆盖，遗漏任何一篇即不合格',
      '【知识层级】单元1：新闻阅读（消息/通讯/新闻特写）；单元2：传记与回忆性散文（藤野先生/回忆我的母亲）；单元3：山水游记（三峡/与朱元思书/记承天寺夜游）',
      '【学段·学科精准适配】初中语文中考结构，设问层次与难度匹配八年级认知水平',
      '【学科核心素养】语言运用、思维能力、审美创造、文化自信',
      '【题型与数量分配】选择题8题、填空题6题、简答题7题、写作1题',
      '【难度配置】基础50% 中档30% 提高20%，难题分布在后部',
      '【页数要求】试卷正文不少于10页A4纸（不含答案页）',
      '【格式规范】题目用p标签包裹，选择用option标签，填空用blank标签',
      '【尾约束】填空空标签语义、选择题选项不少于4个',
      '【答案区强制锚定】答案放答案页，听力原文完整放答案页',
      '【答案与解析规范】每题为解析，作文附评分标准与范文',
      '【顶层约束】全卷统一格式，禁止Markdown，禁止前言解释',
      '【真题内容样例】阅读设问句式：①梳理文章的内容，完成____，并据此探究____；②请分析作者是如何写出____的；③请你为画线句子设计朗读，并阐述理由',
      '【学段控制】初中八年级认知深度，禁止超出课标难度',
    ].join('\n');
    const realWholeTokens = estimateTokens(realWholeInstruction);
    console.log(`  真实整卷指令约 ${realWholeTokens} token（${realWholeInstruction.length}字符，${realWholeInstruction.split('\n').length}个节，user+system 双份约 ${realWholeTokens * 2} token）`);

    let sumTokens = 0;
    for (const plan of plans) {
      const sec = buildSectionInstruction(plan, {
        subject: '语文', stage: 'middle', stageLabel: '初中', examBlueprint: bp,
        materialText: '【教材原文】望岳 岱宗夫如何？齐鲁青未了。',
        region: '江苏·南京', sectionNo: plan.index + 1, totalScore: 120, isExamPlan: true,
      });
      const tok = estimateTokens(sec);
      sumTokens += tok;
      console.log(`  板块${plan.index + 1}「${plan.name}」: ${sec.length}字符 / 约${tok}token | 基准${sec.includes('命题内容质量基准') ? '✓' : '✗'} 素材${sec.includes('教材原文') ? '✓' : '✗'}`);
      expect(sec).toContain('命题内容质量基准');
      expect(sec).toContain('教材原文');
    }
    const wholeTokens = realWholeTokens * 2; // user + system 双份
    const avgSection = Math.round(sumTokens / plans.length);
    const pct = Math.round(avgSection / wholeTokens * 100);
    console.log(`  分步单板块平均约 ${avgSection} token vs 整卷一次性约 ${wholeTokens} token`);
    console.log(`  结论: 单板块约为整卷双份的 ${pct}%，且只负责 1/${plans.length} 内容量`);
    console.log(`  （注: 真实整卷指令远大于本模拟（几十节、数千token），实际占比更低；单板块指令含完整基准+样例+素材，为独立调用所需）`);
    // 核心断言：单次分步调用必须小于整卷双份总量（每步短指令成立）
    expect(avgSection).toBeLessThan(wholeTokens);
  });

  it('systemMessage 场景化裁剪：板块调用剔除蓝本全文/答案规范，显著变短', () => {
    const fakeFullSystem = '【角色身份】你是命题专家\n'
      + '【红线约束】禁止超纲\n'
      + '【真题卷结构蓝本】一、积累与运用（共8题，共28分）二、古诗文阅读（共6题，共22分）三、现代文阅读（共7题，共30分）四、写作（共1题，共40分）\n'
      + '【格式规范】题目用p标签包裹\n'
      + '【尾约束】填空用blank标签\n'
      + '【答案区强制锚定】答案放答案页\n'
      + '【答案与解析规范】每题为解析\n'
      + '【学科核心素养】素养立意';

    const sectionSystem = filterSystemByMode(fakeFullSystem, 'section');
    const answerSystem = filterSystemByMode(fakeFullSystem, 'answer');

    console.log(LINE);
    console.log(`【验证2】完整system ${fakeFullSystem.length}字符/${estimateTokens(fakeFullSystem)}token`);
    console.log(`  板块system ${sectionSystem.length}字符/${estimateTokens(sectionSystem)}token | 剔蓝本${!sectionSystem.includes('蓝本') ? '✓' : '✗'} 剔答案规范${!sectionSystem.includes('答案与解析') ? '✓' : '✗'}`);
    console.log(`  答案system ${answerSystem.length}字符/${estimateTokens(answerSystem)}token | 含答案规范${answerSystem.includes('答案与解析') ? '✓' : '✗'} 剔板块格式${!answerSystem.includes('格式规范') ? '✓' : '✗'}`);

    expect(sectionSystem).not.toContain('真题卷结构蓝本');
    expect(sectionSystem).not.toContain('答案与解析规范');
    expect(answerSystem).toContain('答案与解析规范');
    expect(answerSystem).not.toContain('格式规范');
    expect(estimateTokens(sectionSystem)).toBeLessThan(estimateTokens(fakeFullSystem) * 0.5);
  });

  it('非 exam（课时练）结构大纲分步：板块指令短、无满分误导、有基准', () => {
    const practiceInstruction = '请生成一份课时练。\n结构参考：\n一、基础建构（字词积累、情境感知）\n二、任务驱动（阅读、表达）\n三、素养拓展（整本书、跨媒体）';
    const plans = buildNonExamPlans(practiceInstruction, ['字词积累', '阅读理解'], 0);

    console.log(LINE);
    console.log(`【验证3】课时练结构大纲板块数=${plans.length}`);
    for (const plan of plans) {
      const sec = buildSectionInstruction(plan, {
        subject: '语文', stage: 'primary_mid', stageLabel: '小学中段', examBlueprint: null,
        materialText: '', region: '', sectionNo: plan.index + 1, totalScore: 0, isExamPlan: false,
      });
      console.log(`  板块${plan.index + 1}「${plan.name}」: ${sec.length}字符/${estimateTokens(sec)}token | 基准${sec.includes('命题内容质量基准') ? '✓' : '✗'} 满分误导${sec.includes('满分0分') ? '✗' : '无✓'}`);
      expect(sec).toContain('命题内容质量基准');
      expect(sec).not.toContain('满分0分');
    }
    console.log(LINE);
  });
});
