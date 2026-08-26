// 教辅结构蓝本库测试（类型 × 学段 三维度覆盖 + 注入块组装）
// ============================================================
// 🔴 目的：锁定"教辅 8 类 × 5 学段"结构标准齐全的契约——
//    - 每类型都有栏目框架 + 5 学段参数（题量/字数/时长底线）
//    - buildTeachingInjection 输出栏目框架与底线，注入到非 exam 生成指令尾部
//    - exam 不经过教辅蓝本（走 examPaperBlueprints）
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  TEACHING_BLUEPRINTS, TEACHING_GEN_TYPES,
  getTeachingBlueprint, buildTeachingInjection,
} from '@/config/teachingBlueprints.js';

const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

describe('教辅蓝本三维度覆盖（类型 × 学段）', () => {
  it('8 类教辅全部有蓝本（不含 exam）', () => {
    expect(TEACHING_GEN_TYPES.sort()).toEqual(
      ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'].sort()
    );
    for (const g of TEACHING_GEN_TYPES) {
      expect(TEACHING_BLUEPRINTS[g].sections.length, `类型 ${g} 缺栏目框架`).toBeGreaterThanOrEqual(2);
      expect(TEACHING_BLUEPRINTS[g].label).toBeTruthy();
    }
  });

  it('每个类型都覆盖 5 个学段参数（题量/时长底线齐全）', () => {
    for (const g of TEACHING_GEN_TYPES) {
      for (const s of STAGES) {
        const bp = getTeachingBlueprint({ genType: g, stage: s });
        expect(bp, `${g}|${s} 蓝本缺失`).toBeTruthy();
        expect(bp.stageParams.volume, `${g}|${s} 缺题量/篇幅底线`).toBeTruthy();
        expect(bp.stageParams.duration, `${g}|${s} 缺时长`).toBeTruthy();
        expect(bp.stageKey).toBe(s);
      }
    }
  });

  it('exam 不经过教辅蓝本', () => {
    expect(getTeachingBlueprint({ genType: 'exam', stage: 'middle' })).toBeNull();
    expect(buildTeachingInjection({ genType: 'exam', stage: 'middle' })).toBe('');
  });

  it('学段键归一：中文学段标签/年级可命中', () => {
    expect(getTeachingBlueprint({ genType: 'practice', stage: '小学低段' }).stageKey).toBe('primary_low');
    expect(getTeachingBlueprint({ genType: 'practice', stage: '初中' }).stageKey).toBe('middle');
    expect(getTeachingBlueprint({ genType: 'practice', stage: '二年级' }).stageKey).toBe('primary_low');
    expect(getTeachingBlueprint({ genType: 'practice', stage: '五年级' }).stageKey).toBe('primary_high');
    expect(getTeachingBlueprint({ genType: 'reading', stage: '高一' }).stageKey).toBe('high');
  });
});

describe('buildTeachingInjection（教辅结构注入块）', () => {
  it('输出栏目框架 + 题量与时长底线 + 学段名', () => {
    const inject = buildTeachingInjection({ genType: 'reading', stage: 'middle' });
    expect(inject).toContain('【教辅结构（通用·阅读训练·初中）');
    expect(inject).toContain('栏目框架');
    expect(inject).toContain('原创选文');
    expect(inject).toContain('分层设题');
    expect(inject).toContain('题量与时长');
    expect(inject).toContain('500-900字'); // 初中阅读篇幅底线
    expect(inject).toContain('2-3篇');
  });

  it('学段差异化：低段与高段篇幅底线不同', () => {
    const low = buildTeachingInjection({ genType: 'reading', stage: 'primary_low' });
    const high = buildTeachingInjection({ genType: 'reading', stage: 'high' });
    expect(low).toContain('80-150字');
    expect(high).toContain('900-1500字');
  });

  it('课时练含三段式栏目与防堆题底线', () => {
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_mid' });
    expect(inject).toContain('基础建构任务');
    expect(inject).toContain('探究进阶任务');
    expect(inject).toContain('迁移创新任务');
    expect(inject).toContain('严禁只罗列题目');
  });

  it('默写积累含覆盖量与书写格学段要求', () => {
    const inject = buildTeachingInjection({ genType: 'dictation', stage: 'primary_low' });
    expect(inject).toContain('看拼音写词语');
    expect(inject).toContain('4-8个');
  });

  it('错题本含五段结构（原题→归因→解法→变式→策略）', () => {
    const inject = buildTeachingInjection({ genType: 'errorbook', stage: 'middle' });
    expect(inject).toContain('原题重现');
    expect(inject).toContain('错误归因');
    expect(inject).toContain('正确解法');
    expect(inject).toContain('同类变式');
    expect(inject).toContain('解题策略');
  });
});

describe('教辅蓝本学科维度（三维度：学科×类型×学段）', () => {
  it('语文已定制：课时练栏目学科化（字词句/语段/写话），标记 custom', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '语文' });
    expect(bp.custom).toBe(true);
    expect(bp.subject).toBe('语文');
    expect(bp.key).toBe('语文|practice|primary_low');
    const sections = bp.sections.map((s) => s.name).join('|');
    expect(sections).toContain('基础建构任务');
    expect(sections).toContain('探究进阶任务');
    expect(sections).toContain('迁移创新任务');
  });

  it('语文课时练栏目导向含学科语义（语段阅读/写话）', () => {
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_mid', subject: '语文' });
    expect(inject).toContain('语文·课时练');
    expect(inject).toContain('语段阅读与表达运用');
    expect(inject).toContain('生活化口语表达或写话');
  });

  it('未定制学科（数学等）回退通用默认：栏目为通用、注入标"通用·"', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'middle', subject: '数学' });
    expect(bp.custom).toBe(false);
    expect(bp.subject).toBe('数学');
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'middle', subject: '数学' });
    expect(inject).toContain('通用·课时练');
    // 学段参数仍生效（初中 45 分钟）
    expect(inject).toContain('45分钟');
  });

  it('语文全 8 类教辅均有学科定制栏目', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'primary_mid', subject: '语文' });
      expect(bp?.custom, `语文 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
  });
});
