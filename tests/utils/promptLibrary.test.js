import { describe, it, expect } from 'vitest';
import { getPromptTemplate, buildInjectionInstruction, CURRICULUM_BY_STAGE, getCurriculumLabel, SUBJECT_STAGE_EXTRAS, STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS } from '../../src/config/promptLibrary.js';
import { TEACHING_SUBJECT_BLUEPRINTS } from '../../src/config/teachingBlueprints.js';
import { styleInstructions, styleOptions } from '../../src/config/expertKnowledge.js';

/**
 * 课标版本按学段注入（可查可引用）：
 * 义务教育（小学低/中/高段、初中）=《义务教育课程方案和课程标准（2022年版）》
 * 高中 =《普通高中课程标准（2017年版2020年修订）》
 * 模板正文通过 {curriculum} 占位符注入，禁止写死版本号（防高中错用 2022 版、防"学习任务群"等
 * 语文课标概念套用到其他学科）。
 */
describe('promptLibrary 课标版本按学段注入', () => {
  it('CURRICULUM_BY_STAGE：义务教育 5 学段统一 2022 年版，高中为 2017/2020 修订版', () => {
    expect(CURRICULUM_BY_STAGE.primary_low).toBe('2022年版义务教育课程标准');
    expect(CURRICULUM_BY_STAGE.primary_mid).toBe('2022年版义务教育课程标准');
    expect(CURRICULUM_BY_STAGE.primary_high).toBe('2022年版义务教育课程标准');
    expect(CURRICULUM_BY_STAGE.middle).toBe('2022年版义务教育课程标准');
    expect(CURRICULUM_BY_STAGE.high).toBe('《普通高中课程标准（2017年版2020年修订）》');
  });

  it('高中 exam 模板：注入《普通高中课程标准（2017年版2020年修订）》', () => {
    const tpl = getPromptTemplate({ grade: 'high', subject: '数学', genType: 'exam' });
    expect(tpl.template).toContain('依据《普通高中课程标准（2017年版2020年修订）》命题');
    expect(tpl.template).not.toContain('2022年版义务教育课程标准');
  });

  it('小学低段 exam 模板：注入 2022年版义务教育课程标准', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(tpl.template).toContain('依据2022年版义务教育课程标准命题');
    expect(tpl.template).not.toContain('2017年版2020年修订');
  });

  it('初中 practice 模板：注入 2022 版，且不含"学习任务群"（语文课标概念不套用其他学科）', () => {
    const tpl = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'practice' });
    expect(tpl.template).toContain('依据2022年版义务教育课程标准）');
    expect(tpl.template).not.toContain('学习任务群');
  });

  it('高中 practice 不出现 2022 版字样', () => {
    const tpl = getPromptTemplate({ grade: 'high', subject: '英语', genType: 'practice' });
    expect(tpl.template).not.toContain('2022版');
  });

  it('通用模板（无学段）兜底替换为"本学段最新课程标准"，无占位符残留', () => {
    const tpl = getPromptTemplate({ grade: '', subject: '', genType: 'exam' });
    const inj = buildInjectionInstruction({ template: tpl.template, grade: '', subject: '数学', unit: '第一单元', genTypeLabel: '正式考卷' });
    expect(inj).toContain('依据本学段最新课程标准命题');
    expect(inj).not.toContain('{curriculum}');
  });

  it('EXAM_QUALITY 质量底线保留"不超出本学段课标学业质量要求"（学业质量为课标组成章节，可查）', () => {
    const tpl = getPromptTemplate({ grade: 'middle', subject: '物理', genType: 'exam' });
    expect(tpl.template).toContain('不超出本学段课标学业质量要求');
  });

  it('getCurriculumLabel：学段键/中文标签均返回对应课标版本，无法识别回退通用', () => {
    expect(getCurriculumLabel('high')).toBe('《普通高中课程标准（2017年版2020年修订）》');
    expect(getCurriculumLabel('高中')).toBe('《普通高中课程标准（2017年版2020年修订）》');
    expect(getCurriculumLabel('高一')).toBe('《普通高中课程标准（2017年版2020年修订）》');
    expect(getCurriculumLabel('middle')).toBe('2022年版义务教育课程标准');
    expect(getCurriculumLabel('初中')).toBe('2022年版义务教育课程标准');
    expect(getCurriculumLabel('小学')).toBe('2022年版义务教育课程标准');
    expect(getCurriculumLabel('二年级')).toBe('2022年版义务教育课程标准');
    expect(getCurriculumLabel('')).toBe('本学段最新课标');
    expect(getCurriculumLabel('未知学段')).toBe('本学段最新课标');
  });

  it('SUBJECT_STAGE_EXTRAS 54 cell source 可查：无"课程理念（素养名）"错配、无"幼小衔接/激发兴趣/兴趣为先"等非课标条目名、无"写作"领域名错配', () => {
    // 语文|middle：第四学段领域名是"表达与交流"（2022 义教语文课标），不是"写作"
    expect(SUBJECT_STAGE_EXTRAS['语文|middle'].source).toContain('表达与交流');
    expect(SUBJECT_STAGE_EXTRAS['语文|middle'].source).not.toContain('/写作（');
    // 语文|high：核心素养名是"语言建构与运用"，不是简称"语言运用"
    expect(SUBJECT_STAGE_EXTRAS['语文|high'].source).toContain('语言建构与运用');
    // 低段 source 均不引用非课标条目名
    for (const key of ['道德与法治|primary_low', '科学|primary_low', '信息科技|primary_low', '音乐|primary_low', '体育|primary_low']) {
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('幼小衔接');
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('激发兴趣');
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('兴趣为先');
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('数字素养与技能启蒙');
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('保护好奇心');
    }
  });

  it('教辅结构库学科级学段要求："课程理念"与"学科核心素养"术语不错配', () => {
    for (const [subject, bp] of Object.entries(TEACHING_SUBJECT_BLUEPRINTS)) {
      for (const [stageKey, stageParams] of Object.entries(bp.stages || {})) {
        const note = stageParams.note || '';
        // 括注声称"课程理念"的内容必须是课标课程理念条目名，"核心素养"括注必须用素养名——
        // 防"课程理念（生命观念）"式错配（生命观念等是核心素养名，不是课程理念）
        const m = note.match(/(.+课程理念|.+核心素养)（([^）]+)）/);
        if (m) {
          const label = m[1];
          const inner = m[2];
          expect(label.endsWith('课程理念')).toBe(false);
          expect(label.endsWith('核心素养')).toBe(true);
          expect(inner.length).toBeGreaterThan(0);
        }
      }
    }
    // 化学初中：不再使用"化学启蒙、联系生产生活实际"（非 2022 义教化学课标课程理念原文）
    expect(TEACHING_SUBJECT_BLUEPRINTS['化学'].stages.middle.note).not.toContain('化学启蒙');
    expect(TEACHING_SUBJECT_BLUEPRINTS['化学'].stages.middle.note).toContain('科学探究与实践');
    // 生物初中："健康生活"非 2022 义教生物课标术语
    expect(TEACHING_SUBJECT_BLUEPRINTS['生物'].stages.middle.note).not.toContain('健康生活');
  });

  it('组织风格指令：big_unit 不含"任务群"（语文课标概念不套用全学科）', () => {
    expect(styleInstructions.big_unit).not.toContain('任务群');
    // unit_context 风格 tip 同样不使用"任务群"（曾与 big_unit 同源残留）
    const unitContextTip = styleOptions.find(s => s.value === 'unit_context')?.tip || '';
    expect(unitContextTip).not.toContain('任务群');
  });

  it('buildInjectionInstruction：用户自定义模板中的 {curriculum} 按学段键注入版本（全链路生效）', () => {
    const userTpl = '请依据{curriculum}命题，覆盖本单元核心知识点。';
    const high = buildInjectionInstruction({ template: userTpl, grade: '高二', stage: 'high', subject: '物理', genTypeLabel: '正式考卷' });
    expect(high).toContain('依据《普通高中课程标准（2017年版2020年修订）》命题');
    expect(high).not.toContain('{curriculum}');
    const middle = buildInjectionInstruction({ template: userTpl, grade: '初二', stage: 'middle', subject: '数学', genTypeLabel: '课时练' });
    expect(middle).toContain('依据2022年版义务教育课程标准命题');
    // 未传学段键：保持通用表述，不残留占位符
    const generic = buildInjectionInstruction({ template: userTpl, grade: '', stage: '', subject: '语文', genTypeLabel: '专项突破' });
    expect(generic).toContain('依据本学段最新课程标准命题');
    expect(generic).not.toContain('{curriculum}');
  });

  it('学段档 source 可查：低段引用课程方案原文（幼小衔接/活动化游戏化），中高段不引用非条目名', () => {
    for (const extras of [STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS]) {
      // 低段："幼小衔接/活动化、游戏化、生活化"出自《义务教育课程方案（2022年版）》，不再误标为课标课程理念
      expect(extras.primary_low.source).toContain('活动化、游戏化、生活化');
      expect(extras.primary_low.source).not.toContain('课程理念（幼小衔接');
      // 中段："真实情境"非任何学科课标课程理念条目名，不得写成"课程理念（真实情境）"
      expect(extras.primary_mid.source).not.toContain('课程理念（真实情境');
      // 高段："思辨性表达"非课标学业质量条目原文，不得写成"学业质量要求（思辨性表达"
      expect(extras.primary_high.source).not.toContain('思辨性表达');
    }
  });

  it('SUBJECT_STAGE_EXTRAS 素养引用完整：物理/化学/数学高中档不遗漏课标核心素养名', () => {
    // 义教物理核心素养 4 个：物理观念/科学思维/科学探究/科学态度与责任
    expect(SUBJECT_STAGE_EXTRAS['物理|middle'].source).toContain('科学态度与责任');
    // 高中物理核心素养 4 个（含科学态度与责任）
    expect(SUBJECT_STAGE_EXTRAS['物理|high'].source).toContain('科学态度与责任');
    // 高中化学核心素养 5 个（含科学探究与创新意识/科学态度与社会责任）
    expect(SUBJECT_STAGE_EXTRAS['化学|high'].source).toContain('科学探究与创新意识');
    expect(SUBJECT_STAGE_EXTRAS['化学|high'].source).toContain('科学态度与社会责任');
    // 高中数学核心素养 6 个（含直观想象/数学运算/数据分析，text 明确对应几何/概率统计）
    expect(SUBJECT_STAGE_EXTRAS['数学|high'].source).toContain('直观想象');
    expect(SUBJECT_STAGE_EXTRAS['数学|high'].source).toContain('数学运算');
    expect(SUBJECT_STAGE_EXTRAS['数学|high'].source).toContain('数据分析');
  });
});
