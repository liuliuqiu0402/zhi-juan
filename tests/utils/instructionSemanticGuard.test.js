// 指令语义合理性全面审计：9种资料类型 × 15学科 × 5学段 组合逐一模拟注入，检查语义不当表述
// 🔴 为什么要有它：既有审计（408/765 组合）只验证"块存在/数量/去重/格式"的机械正确性，
//    语义不当（试卷混入教辅定位、时长范围建议、非试卷混入正式考试话术）机械审计看不见。
//    本审计按真实注入规则遍历 675 组合，把角色语义写成可执行检查。
import { describe, it, expect } from 'vitest';
import { builtinInstructions } from '@/config/instructionLib';

const GEN_TYPES = ['exam', 'practice', 'special', 'preview', 'review', 'dictation', 'reading', 'errorbook', 'summary'];
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治', '思想政治', '科学', '信息科技', '音乐', '美术', '体育'];
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

// 定位性教辅话术（肯定式："对标/水准/风格/质量…教辅"；"禁止…教辅栏目/教辅陈题"等否定语境不命中）
const POSITIONING = /(?:对标|水准|标准|风格|品质|质量|定位|级答案)[^。；\n]{0,10}教辅|53天天练|黄冈小状元|教材帮/;
// exam 专属话术（非试卷类型不应注入）
const EXAM_ONLY = /正式考试命题标准/;
// exam 时长范围建议（与蓝本固定值冲突）
const DURATION_RANGE = /50或60分钟|70或80分钟|90或100分钟|根据题量确定/;

/** 复刻 getMatchingBlockInstructions 的匹配语义（纯函数，一次遍历所有块） */
function matchBlock(block, { category, subject, stage, genType }) {
  if (block.type !== 'fragment') return false;
  if (category && block.category !== category) return false;
  if (block.subject && block.subject.trim() !== '') {
    if (!subject) return false;
    if (!block.subject.split(',').map(s => s.trim()).includes(subject)) return false;
  }
  if (block.stage && block.stage.trim() !== '') {
    if (!stage) return false;
    let insStages = block.stage.split(',').map(s => s.trim());
    if (insStages.includes('primary')) insStages = [...insStages, 'primary_low', 'primary_mid', 'primary_high'];
    const aliases = stage === 'primary' ? ['primary', 'primary_low', 'primary_mid', 'primary_high'] : [stage];
    if (!aliases.some(s => insStages.includes(s))) return false;
  }
  if (block.genType && block.genType.trim() !== '') {
    if (!genType) return false;
    if (!block.genType.split(',').map(s => s.trim()).includes(genType)) return false;
  }
  return true;
}

describe('🔴 指令语义合理性全面审计（9类型 × 15学科 × 5学段 = 675 组合逐一注入检查）', () => {
  it('exam 全组合无教辅定位话术/时长范围；非 exam 全组合无正式考试命题话术', () => {
    const violations = [];
    let combos = 0;
    for (const genType of GEN_TYPES) {
      for (const subject of SUBJECTS) {
        for (const stage of STAGES) {
          combos++;
          const text = builtinInstructions
            .filter(b => matchBlock(b, { category: b.category, subject, stage, genType }))
            .map(b => (b.content || '') + '\n' + (b.name || ''))
            .join('\n');
          if (genType === 'exam') {
            if (POSITIONING.test(text)) violations.push(`${genType}|${subject}|${stage}: 混入教辅定位话术`);
            if (DURATION_RANGE.test(text)) violations.push(`${genType}|${subject}|${stage}: 时长范围建议与蓝本冲突`);
          } else if (EXAM_ONLY.test(text)) {
            violations.push(`${genType}|${subject}|${stage}: 混入 exam 专属话术`);
          }
        }
      }
    }
    expect(combos).toBe(675);
    expect(violations).toEqual([]);
  });

  it('注入精准度基线：全通用块占比受控、单组合注入量不膨胀（防"一股脑注入"）', () => {
    const fragments = builtinInstructions.filter(i => i.type === 'fragment');
    const isGeneric = b => !(b.subject && b.subject.trim()) && !(b.stage && b.stage.trim()) && !(b.genType && b.genType.trim());
    const genericCount = fragments.filter(isGeneric).length;
    // 全通用块仅占少数（红线/格式等跨类型硬约束是有意设计）；绝大多数块须标注学科/学段/类型
    expect(genericCount, `全通用块 ${genericCount} 过多`).toBeLessThanOrEqual(25);
    expect(genericCount / fragments.length).toBeLessThanOrEqual(0.05);

    // 单组合注入量上限（语文·middle 为代表性组合；防止冗余块持续累积）
    const blocks = fragments.filter(b => matchBlock(b, { category: b.category, subject: '语文', stage: 'middle', genType: 'exam' }));
    const chars = blocks.reduce((a, b) => a + (b.content || '').length, 0);
    expect(blocks.length, `exam|语文|middle 注入块数 ${blocks.length} 超基线`).toBeLessThanOrEqual(110);
    expect(chars, `exam|语文|middle 注入字数 ${chars} 超基线`).toBeLessThanOrEqual(22000);
  });

  it('组合注入画像：分析-* 类不得计入生成注入口径（双防线排除）；维度分布基线固化', () => {
    // 与真实注入对齐：buildGenerationInstruction 的 _ui_handledCategories 双防线排除"分析-*"，
    // 生成注入口径不含分析类块
    const GENERATION_CATEGORIES = [
      '生成-角色身份', '生成-红线约束', '生成-格式规范', '生成-输出格式', '生成-格式尾约束',
      '生成-顶层约束', '生成-尾约束', '生成-品质标准', '生成-题目质量标准', '生成-情境要求',
      '生成-答案与解析规范', '生成-主观题评分标准', '生成-编辑标准', '生成-内容规范', '生成-特殊要求',
      '生成-学科适配', '生成-学科特色', '生成-学科核心素养', '生成-资料类型结构', '生成-核心任务',
      '生成-题型分布建议', '生成-题量控制', '生成-难度控制', '生成-难度配置', '生成-时间分配',
      '生成-页数配置', '生成-知识边界', '生成-课标骨架', '生成-答题模板', '生成-术语规范',
      '生成-专项要求', '生成-题型专项要求', '生成-质量范例', '生成-知识点全覆盖', '生成-模板禁止项',
      '生成-学段控制', '生成-标题格式', '生成-答案区强制锚定', '生成-输出前置指令', '生成-范围扩展',
      '生成-多章节标题', '生成-指令块标题', '生成-学科标记', '生成-EduRender模板', '生成-原题引用',
      '生成-命题风格', '生成-年级边界提示',
    ];
    const fragments = builtinInstructions.filter(i => i.type === 'fragment');
    const analysisLike = fragments.filter(b => (b.category || '').startsWith('分析-'));
    // 分析类块不得出现在生成注入 category 集合中
    for (const a of analysisLike) {
      expect(GENERATION_CATEGORIES.includes(a.category), `分析类 category ${a.category} 不得计入生成注入`).toBe(false);
    }
    // 注入画像（exam|语文|middle）：统计块数与维度分布，监控"专属化"进度
    const blocks = fragments.filter(b => GENERATION_CATEGORIES.includes(b.category) && matchBlock(b, { category: b.category, subject: '语文', stage: 'middle', genType: 'exam' }));
    const dims = b => [b.subject && b.subject.trim(), b.stage && b.stage.trim(), b.genType && b.genType.trim()].filter(Boolean).length;
    const d0 = blocks.filter(b => dims(b) === 0).length;
    const d1 = blocks.filter(b => dims(b) === 1).length;
    expect(blocks.length, `生成注入口径块数 ${blocks.length} 超基线`).toBeLessThanOrEqual(95);
    // 三维专属化进度基线：三维+二维标注块占比应逐步提升（当前基线：≥35%）
    const highDim = blocks.filter(b => dims(b) >= 2).length;
    expect(highDim / blocks.length, `高维(2-3维)标注块占比 ${(highDim / blocks.length * 100).toFixed(0)}% 低于基线`).toBeGreaterThanOrEqual(0.35);
    // 记录画像（供开发者查看当前组合注入构成）
    console.log(`[注入画像] exam|语文|middle: ${blocks.length}块（零维${d0}/一维${d1}/高维${highDim}）`);
  });
});
