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

  it('每个类型都覆盖 5 个学段要求（题量底线为程序护栏配置，教辅不含考试时长）', () => {
    for (const g of TEACHING_GEN_TYPES) {
      for (const s of STAGES) {
        const bp = getTeachingBlueprint({ genType: g, stage: s });
        expect(bp, `${g}|${s} 蓝本缺失`).toBeTruthy();
        expect(bp.stageParams.volume, `${g}|${s} 缺题量/篇幅底线（程序护栏配置）`).toBeTruthy();
        expect('duration' in bp.stageParams, `${g}|${s} 教辅不应含时长`).toBe(false);
        expect(bp.stageKey).toBe(s);
      }
    }
  });

  it('exam 不经过教辅蓝本', () => {
    expect(getTeachingBlueprint({ genType: 'exam', stage: 'middle' })).toBeNull();
    expect(buildTeachingInjection({ genType: 'exam', stage: 'middle' })).toBe('');
  });

  it('8 类型 × 5 学段学段要求全部完善（无空 note）', () => {
    for (const g of TEACHING_GEN_TYPES) {
      for (const s of STAGES) {
        const bp = getTeachingBlueprint({ genType: g, stage: s });
        expect(bp.stageParams.note?.trim(), `${g}|${s} 学段要求为空`).toBeTruthy();
      }
    }
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
  it('输出栏目框架 + 学段要求（题量/时长不注入 prompt）', () => {
    const inject = buildTeachingInjection({ genType: 'reading', stage: 'middle' });
    expect(inject).toContain('【教辅结构（通用·阅读训练·初中）');
    expect(inject).toContain('栏目框架');
    expect(inject).toContain('原创选文');
    expect(inject).toContain('分层设题');
    expect(inject).toContain('学段要求');
    expect(inject).toContain('非连续性文本'); // 初中阅读学段要求
    expect(inject).not.toContain('题量与时长');
    expect(inject).not.toContain('500-900字'); // 篇幅底线归程序护栏，不注入 AI
  });

  it('学段差异化：低段与高段学段要求不同', () => {
    const low = buildTeachingInjection({ genType: 'reading', stage: 'primary_low' });
    const high = buildTeachingInjection({ genType: 'reading', stage: 'high' });
    expect(low).toContain('选文短小');
    expect(high).toContain('多角度理解与思辨');
  });

  it('课时练含三段式栏目与学段要求（内容底线不注入）', () => {
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_mid' });
    expect(inject).toContain('基础建构任务');
    expect(inject).toContain('探究进阶任务');
    expect(inject).toContain('迁移创新任务');
    expect(inject).toContain('学段要求');
    expect(inject).not.toContain('栏目完整、板块分明');
  });

  it('默写积累含学科中立栏目（篇幅底线不注入）', () => {
    const inject = buildTeachingInjection({ genType: 'dictation', stage: 'primary_low' });
    expect(inject).toContain('基础默写');
    expect(inject).not.toContain('4-8条');
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

  it('未定制学科（生物等）回退通用默认：栏目为通用、注入标"通用·"', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'middle', subject: '生物' });
    expect(bp.custom).toBe(false);
    expect(bp.subject).toBe('生物');
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'middle', subject: '生物' });
    expect(inject).toContain('通用·课时练');
    // 学段要求仍按学段注入（初中）
    expect(inject).toContain('学段要求');
  });

  it('语文全 8 类教辅均有学科定制栏目', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'primary_mid', subject: '语文' });
      expect(bp?.custom, `语文 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('数学已定制：课时练栏目学科化（情境考查/真实问题解决），标记 custom', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '数学' });
    expect(bp.custom).toBe(true);
    expect(bp.subject).toBe('数学');
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_low', subject: '数学' });
    expect(inject).toContain('数学·课时练');
    expect(inject).toContain('核心知识点，在情境中考查');
    expect(inject).toContain('真实问题解决');
  });

  it('数学全 8 类教辅均有学科定制栏目（默写积累改造为公式法则/情境填空）', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'middle', subject: '数学' });
      expect(bp?.custom, `数学 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
    const dict = buildTeachingInjection({ genType: 'dictation', stage: 'middle', subject: '数学' });
    expect(dict).toContain('数学·默写积累');
    expect(dict).toContain('公式法则');
    expect(dict).toContain('情境填空');
  });

  it('英语已定制：课时练含语篇/交际语义，默写积累为词汇句型/语音/四线三格', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '英语' });
    expect(bp.custom).toBe(true);
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_low', subject: '英语' });
    expect(inject).toContain('英语·课时练');
    expect(inject).toContain('语篇语境中的综合运用');
    expect(inject).toContain('真实交际任务');
    const dict = buildTeachingInjection({ genType: 'dictation', stage: 'primary_low', subject: '英语' });
    expect(dict).toContain('英语·默写积累');
    expect(dict).toContain('词汇句型');
    expect(dict).toContain('四线三格');
  });

  it('英语全 8 类教辅均有学科定制栏目', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'middle', subject: '英语' });
      expect(bp?.custom, `英语 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('科学已定制：课时练含观察/实验/生活实践语义，默写积累改造为科学概念/观察记录', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '科学' });
    expect(bp.custom).toBe(true);
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_low', subject: '科学' });
    expect(inject).toContain('科学·课时练');
    expect(inject).toContain('生活现象与观察');
    expect(inject).toContain('观察与实验任务');
    expect(inject).toContain('观察自然、制作模型');
    const dict = buildTeachingInjection({ genType: 'dictation', stage: 'middle', subject: '科学' });
    expect(dict).toContain('科学·默写积累');
    expect(dict).toContain('科学概念');
    expect(dict).toContain('观察记录');
  });

  it('科学全 8 类教辅均有学科定制栏目', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'primary_mid', subject: '科学' });
      expect(bp?.custom, `科学 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
  });
});
