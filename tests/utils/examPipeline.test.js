// 分步生成流水线：数据驱动板块规划 / 短指令构建 / 拼接 / 校验
import { describe, it, expect } from 'vitest';
import {
  parseQuestionCount,
  extractKnowledgePoints,
  parseStructureBlocks,
  buildNonExamPlans,
  assignKpsToSections,
  buildSectionInstruction,
  buildAnswerInstruction,
  assemblePaperHeader,
  validateSectionPlans,
} from '@/config/examPipeline';
import { getExamBlueprint } from '@/config/examPaperBlueprints';

const EXAM = getExamBlueprint('语文', 'middle', '江苏·南京'); // 120分制
const EXAM_MATH = getExamBlueprint('数学', 'middle');
const EXAM_ENG_HIGH = getExamBlueprint('英语', 'high');

describe('分步生成流水线（数据驱动板块规划 → 逐板块短指令）', () => {
  describe('1. parseQuestionCount 题量解析', () => {
    it('解析"共N小题/N题/（N小题）"', () => {
      expect(parseQuestionCount('（共20小题，每题1.5分）', 30)).toBe(20);
      expect(parseQuestionCount('（共5小题，每小题2分）', 10)).toBe(5);
      expect(parseQuestionCount('10空，语境理解', 10)).toBe(10); // "N空"模式
      expect(parseQuestionCount('', 10)).toBe(5); // 空 note 按 2 分/题兜底
      expect(parseQuestionCount('8题×5分，4选1', 40)).toBe(8);
    });

    it('高中英语听力解析为 20 题（调研硬数据）', () => {
      const eng = getExamBlueprint('英语', 'high');
      const listening = eng.sections[0];
      expect(parseQuestionCount(listening.note, listening.score)).toBe(20);
    });
  });

  describe('2. extractKnowledgePoints 知识点提取', () => {
    it('从 knowledgePoints + knowledgeGraph 提取去重清单', () => {
      const km = {
        knowledgePoints: ['函数', '方程'],
        knowledgeGraph: [
          { bigConcepts: [{ bigConcept: '代数', coreKnowledge: [{ name: '一次函数', specificConcepts: ['斜率', '截距'] }] }] },
        ],
      };
      const kps = extractKnowledgePoints(km);
      expect(kps).toContain('函数');
      expect(kps).toContain('一次函数');
      expect(kps).toContain('斜率');
      expect(kps).toContain('截距');
      expect(kps).toContain('代数');
      // 去重
      expect(new Set(kps).size).toBe(kps.length);
    });

    it('空图谱返回空数组', () => {
      expect(extractKnowledgePoints(null)).toEqual([]);
      expect(extractKnowledgePoints({})).toEqual([]);
    });
  });

  describe('3. assignKpsToSections 考点分配', () => {
    it('板块数=蓝本板块数，分值保持', () => {
      const kps = ['古诗文默写', '文言文阅读', '写作', '现代文阅读'];
      const plans = assignKpsToSections(EXAM.sections, kps, '语文');
      expect(plans.length).toBe(EXAM.sections.length);
      expect(plans.reduce((a, c) => a + c.score, 0)).toBe(EXAM.fullScore);
    });

    it('未匹配考点兜底到末板块（不丢失考点）', () => {
      const plans = assignKpsToSections(EXAM.sections, ['天外知识点A', '天外知识点B'], '语文');
      const all = plans.flatMap(p => p.kps);
      expect(all).toContain('天外知识点A');
      expect(all).toContain('天外知识点B');
    });
  });

  describe('4. validateSectionPlans 规划校验', () => {
    it('分值之和=蓝本总分 通过', () => {
      const plans = assignKpsToSections(EXAM_MATH.sections, [], '数学');
      const v = validateSectionPlans(plans, EXAM_MATH);
      expect(v.ok).toBe(true);
      expect(v.totalScore).toBe(120);
    });

    it('板块分值被篡改时校验失败', () => {
      const plans = assignKpsToSections(EXAM.sections, [], '语文');
      plans[0].score += 10;
      const v = validateSectionPlans(plans, EXAM);
      expect(v.ok).toBe(false);
      expect(v.errors.some(e => e.includes('≠'))).toBe(true);
    });

    it('空规划失败', () => {
      const v = validateSectionPlans([], EXAM);
      expect(v.ok).toBe(false);
    });
  });

  describe('5. buildSectionInstruction 板块短指令', () => {
    it('指令短（<2500字符）、含板块名/分值/题量/考点/样例/教材依据/输出格式', () => {
      const plans = assignKpsToSections(EXAM.sections, ['古诗文默写'], '语文');
      const sec = buildSectionInstruction(plans[0], {
        subject: '语文', stageLabel: '初中', examBlueprint: EXAM,
        materialText: '【教材原文】春眠不觉晓...',
      });
      expect(sec.length).toBeLessThan(2500);
      expect(sec).toContain(plans[0].name);
      expect(sec).toContain(`${plans[0].score}分`);
      expect(sec).toContain('真题级样例');
      expect(sec).toContain('教材原文');
      expect(sec).toContain('<p class="question">');
      expect(sec).toContain('严禁照抄');
    });

    it('不同板块指令内容不同（第1板块 vs 第3板块）', () => {
      const plans = assignKpsToSections(EXAM.sections, [], '语文');
      const s1 = buildSectionInstruction(plans[0], { subject: '语文', examBlueprint: EXAM });
      const s3 = buildSectionInstruction(plans[2], { subject: '语文', examBlueprint: EXAM });
      expect(s1).not.toBe(s3);
      expect(s1).toContain(plans[0].name);
      expect(s3).toContain(plans[2].name);
    });
  });

  describe('6. buildAnswerInstruction 答案页指令', () => {
    it('含答案区规范/听力原文/评分标准/计算步骤要求', () => {
      const sec = buildAnswerInstruction('英语', '高中', '<h2>一、听力</h2>...', EXAM_ENG_HIGH);
      expect(sec).toContain('参考答案');
      expect(sec).toContain('听力原文');
      expect(sec).toContain('评分标准');
      expect(sec).toContain('answer-section');
      expect(sec).toContain('每段材料读两遍');
    });
  });

  describe('7. assemblePaperHeader 卷首拼装', () => {
    it('含标题/时长/满分/密封线', () => {
      const h = assemblePaperHeader(EXAM, { gradeLabel: '八年级', region: '江苏·南京' });
      expect(h).toContain('考试时间');
      expect(h).toContain('满分：120分');
      expect(h).toContain('江苏·南京');
      expect(h).toContain('sealed-wrapper');
    });
  });

  describe('8. 蓝本结构完整性（流水线前置依赖）', () => {
    it('初中/高中/江苏南京蓝本均可获取且板块分值合规', () => {
      for (const bp of [EXAM, EXAM_MATH, EXAM_ENG_HIGH]) {
        expect(bp.sections.length).toBeGreaterThan(0);
        expect(bp.sections.reduce((a, c) => a + c.score, 0)).toBe(bp.fullScore);
      }
    });

    it('高中数学蓝本为 8+3+3+5 新高考结构（调研硬数据）', () => {
      const m = getExamBlueprint('数学', 'high');
      const counts = m.sections.map(s => parseQuestionCount(s.note, s.score));
      expect(counts).toEqual([8, 3, 3, 5]);
      expect(m.sections.map(s => s.score)).toEqual([40, 18, 15, 77]);
    });
  });

  describe('9. 非 exam 结构大纲解析（全资料类型分步）', () => {
    it('解析"结构参考：\n一、XXX\n二、XXX"格式为板块', () => {
      const instruction = '请生成一份课时练。\n---\n【结构大纲】\n结构参考：\n一、基础建构（字词积累、情境感知）\n二、任务驱动（阅读、表达）\n三、素养拓展（整本书、跨媒体）';
      const blocks = parseStructureBlocks(instruction);
      expect(blocks.length).toBe(3);
      expect(blocks[0].name).toContain('基础建构');
      expect(blocks[0].desc).toContain('字词');
      expect(blocks[2].name).toContain('素养拓展');
    });

    it('无结构大纲返回空数组（不误触发分步）', () => {
      expect(parseStructureBlocks('请生成一份资料。')).toEqual([]);
      expect(parseStructureBlocks('')).toEqual([]);
    });

    it('buildNonExamPlans：板块数=结构大纲数、考点已分配、分值均分', () => {
      const instruction = '结构参考：\n一、基础建构\n二、任务驱动';
      const plans = buildNonExamPlans(instruction, ['字词积累', '阅读理解'], 100);
      expect(plans.length).toBe(2);
      expect(plans[0].score).toBe(50);
      expect(plans[1].score).toBe(50);
      const all = plans.flatMap(p => p.kps);
      expect(all).toContain('字词积累');
      expect(all).toContain('阅读理解');
    });

    it('practice 类型结构大纲（指令库真实内容）可解析出板块', () => {
      // 模拟 gen_struct_practice_chinese_middle 注入后的指令
      const instruction = '【核心任务】\n结构参考：\n一、基础建构（语言积累、梳理探究）\n二、任务驱动（文学阅读、实用阅读、表达交流）\n三、素养拓展（整本书、跨媒体、综合实践）';
      const blocks = parseStructureBlocks(instruction);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      expect(blocks.some(b => b.name.includes('基础建构'))).toBe(true);
    });
  });
});
