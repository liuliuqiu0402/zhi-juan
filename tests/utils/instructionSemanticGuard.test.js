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
});
