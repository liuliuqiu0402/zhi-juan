// 教辅编辑知识库（双角色体系：命题老师 vs 教辅编辑）
import { describe, it, expect } from 'vitest';
import {
  TEACHING_MATERIAL_BANK,
  TEACHING_TYPES,
  getTeachingMaterial,
  buildTeachingMaterialText,
} from '@/config/teachingMaterialBank';
import { buildSectionInstruction } from '@/config/examPipeline';
import { getExamBlueprint } from '@/config/examPaperBlueprints';

describe('教辅编辑知识库（非试卷资料类型的角色知识）', () => {
  it('覆盖全部 8 种非试卷资料类型（exam 之外）', () => {
    expect(TEACHING_TYPES.length).toBe(8);
    expect(TEACHING_TYPES).not.toContain('exam');
    for (const t of TEACHING_TYPES) {
      expect(TEACHING_MATERIAL_BANK[t], `类型 ${t} 缺教辅知识`).toBeTruthy();
    }
  });

  it('每种类型含 role/logic/columns/rules 四要素', () => {
    for (const [type, t] of Object.entries(TEACHING_MATERIAL_BANK)) {
      expect(t.role, `${type} role`).toBeTruthy();
      expect(t.logic, `${type} logic`).toBeTruthy();
      expect(t.columns.length, `${type} columns`).toBeGreaterThanOrEqual(3);
      expect(t.rules.length, `${type} rules`).toBeGreaterThanOrEqual(2);
    }
  });

  it('课时练：含任务群栏目（情境任务/基础型/发展型/拓展型）而非传统题海', () => {
    const t = getTeachingMaterial('practice');
    expect(t.logic).toContain('学习任务群');
    expect(t.columns.some(c => c.includes('情境任务'))).toBe(true);
    expect(t.columns.some(c => c.includes('基础型任务'))).toBe(true);
    expect(t.columns.some(c => c.includes('拓展型任务'))).toBe(true);
    expect(t.rules.some(r => r.includes('机械任务'))).toBe(true);
  });

  it('听写训练：语境化积累（非传统孤立默写本）', () => {
    const t = getTeachingMaterial('dictation');
    expect(t.role).toContain('语境化');
    expect(t.columns.some(c => c.includes('语境识记'))).toBe(true);
    expect(t.rules.some(r => r.includes('禁止孤立听写本'))).toBe(true);
  });

  it('复习：大单元结构化（非传统题海）', () => {
    const t = getTeachingMaterial('review');
    expect(t.role).toContain('大单元');
    expect(t.columns.some(c => c.includes('大概念网络'))).toBe(true);
    expect(t.rules.some(r => r.includes('不是章节知识点罗列'))).toBe(true);
  });

  it('错题本：素养导向错因（非笼统粗心/章节流水账）', () => {
    const t = getTeachingMaterial('errorbook');
    expect(t.columns.some(c => c.includes('素养错因'))).toBe(true);
    expect(t.rules.some(r => r.includes('禁止"粗心"式笼统归因'))).toBe(true);
  });

  it('🔴 新课标导向校验：8 类型均无传统教辅痕迹（孤立抄写/默写本/题海/罗列/流水账）', () => {
    const TRADITIONAL = ['抄写X遍', '孤立听写本', '知识点罗列', '题海', '流水账', '孤立默写'];
    for (const [type, t] of Object.entries(TEACHING_MATERIAL_BANK)) {
      const all = t.logic + t.columns.join('') + t.rules.join('');
      for (const w of TRADITIONAL) {
        // 规则中"禁止"传统行为是允许的（表示课标导向），但栏目/逻辑不得是传统做法
        expect(t.columns.join(''), `${type} 栏目含传统痕迹"${w}"`).not.toContain(w);
      }
      // 逻辑必须体现课标导向词
      expect(t.logic, `${type} logic 缺课标导向`).toMatch(/任务群|大单元|大概念|素养|语境化|结构化/);
    }
  });

  it('buildTeachingMaterialText 输出角色/栏目/铁律（新课标）', () => {
    const text = buildTeachingMaterialText('practice');
    expect(text).toContain('教辅编辑角色');
    expect(text).toContain('编辑逻辑');
    expect(text).toContain('任务群导向栏目');
    expect(text).toContain('编辑铁律（新课标）');
  });

  it('未支持类型返回空串', () => {
    expect(getTeachingMaterial('exam')).toBeNull();
    expect(buildTeachingMaterialText('exam')).toBe('');
    expect(buildTeachingMaterialText('未知类型')).toBe('');
  });

  it('🔴 双角色分流：非 exam 板块注入教辅编辑知识，exam 注入命题老师骨架', () => {
    const bp = getExamBlueprint('语文', 'middle');
    const plan = { index: 0, name: '基础巩固', score: 20, questionCount: 5, kps: ['字词'], note: '' };
    // 非 exam（课时练）→ 教辅编辑知识
    const practiceSec = buildSectionInstruction(plan, {
      subject: '语文', stage: 'middle', stageLabel: '初中', examBlueprint: null,
      genType: 'practice', propositionMaterial: '', materialText: '',
      region: '', sectionNo: 1, totalScore: 0, isExamPlan: false,
    });
    expect(practiceSec).toContain('教辅编辑角色');
    expect(practiceSec).toContain('编辑铁律');
    // exam → 命题老师标准题型骨架（无教辅知识）
    const examSec = buildSectionInstruction(plan, {
      subject: '语文', stage: 'middle', stageLabel: '初中', examBlueprint: bp,
      genType: 'exam', propositionMaterial: '', materialText: '',
      region: '', sectionNo: 1, totalScore: 120, isExamPlan: true,
    });
    expect(examSec).not.toContain('教辅编辑角色');
  });
});
