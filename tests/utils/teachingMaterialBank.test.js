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

  it('课时练：含基础/提升/拓展三层梯度与讲练结合', () => {
    const t = getTeachingMaterial('practice');
    expect(t.logic).toContain('三层递进');
    expect(t.columns.some(c => c.includes('基础巩固'))).toBe(true);
    expect(t.columns.some(c => c.includes('能力提升'))).toBe(true);
    expect(t.rules.some(r => r.includes('5:3:2'))).toBe(true);
  });

  it('错题本：含错因分析/正解/同类巩固（反馈闭环）', () => {
    const t = getTeachingMaterial('errorbook');
    expect(t.columns.some(c => c.includes('错因分析'))).toBe(true);
    expect(t.columns.some(c => c.includes('同类巩固'))).toBe(true);
    expect(t.rules.some(r => r.includes('变情境'))).toBe(true);
  });

  it('预习：引导性问题链而非知识点罗列', () => {
    const t = getTeachingMaterial('preview');
    expect(t.rules.some(r => r.includes('问题链'))).toBe(true);
    expect(t.columns.some(c => c.includes('学习目标'))).toBe(true);
  });

  it('buildTeachingMaterialText 输出角色/栏目/铁律', () => {
    const text = buildTeachingMaterialText('practice');
    expect(text).toContain('教辅编辑角色');
    expect(text).toContain('编辑逻辑');
    expect(text).toContain('标准栏目结构');
    expect(text).toContain('编辑铁律');
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
