import { describe, it, expect } from 'vitest';
import { getPromptTemplate, buildInjectionInstruction, CURRICULUM_BY_STAGE } from '../../src/config/promptLibrary.js';

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
});
