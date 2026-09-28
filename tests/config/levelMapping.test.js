// 卷别 → 学业质量水平 映射守卫（2026-09-28）
// ============================================================
// 锁定三件事：
//   ① 每个卷别都有映射（合格考→水平二、高考→水平四），思想政治为例外（高考→水平三）；
//   ② 映射结果写进指令正文，且**只注入一处**（高中正式卷按卷别、教辅锚水平二合格要求）；
//   ③ 仅高中生效——义务教育（小学/初中）无水平级，一律不注入。
// 单一事实源：src/config/levelMapping.js（不得在别处再写一份水平口径）。
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  LEVEL_MAP, PAPER_KINDS, SUBJECT_LEVEL_KEYS, TEACHING_BASELINE,
  LEVEL_INJECTION_MARKER, LEVEL_SOURCE,
  isHighStage, resolvePaperKind, resolveAcademicLevel, buildLevelInstruction,
} from '../../src/config/levelMapping.js';
import { buildInjectionInstruction } from '../../src/config/promptLibrary.js';

/** 注入正文里"【学业质量水平】"段出现次数（用于"只注入一处"守卫） */
const countMarker = (text) => (String(text).match(/【学业质量水平】/g) || []).length;

describe('① 每个卷别都有映射（单一事实源 LEVEL_MAP）', () => {
  it('每个卷别在 LEVEL_MAP 里都有非空水平值', () => {
    for (const kind of PAPER_KINDS) {
      expect(LEVEL_MAP[kind], `卷别「${kind}」缺映射`).toMatch(/^水平[一二三四五]$/);
    }
  });

  it('约定值取自课标：合格考=水平二、高考=水平四、思想政治=水平三', () => {
    expect(LEVEL_MAP['合格考']).toBe('水平二');
    expect(LEVEL_MAP['高考']).toBe('水平四');
    expect(LEVEL_MAP['思想政治']).toBe('水平三');
    // 思想政治是学科例外键（值是"该学科高考卷对应水平"）
    expect(SUBJECT_LEVEL_KEYS).toContain('思想政治');
  });

  it('resolvePaperKind：正式卷按卷别推导、教辅无卷别', () => {
    expect(resolvePaperKind({ genType: 'exam', scopeType: 'gaokao' })).toBe('高考');
    expect(resolvePaperKind({ genType: 'exam', scopeType: 'final' })).toBe('合格考');
    expect(resolvePaperKind({ genType: 'exam', scopeType: '' })).toBe('合格考');
    // 教辅（非正式卷）无卷别
    for (const t of ['practice', 'special', 'preview', 'summary', 'dictation', 'errorbook', 'review', 'reading']) {
      expect(resolvePaperKind({ genType: t }), `${t} 不应有卷别`).toBe('');
    }
  });
});

describe('② 映射结果写进指令正文（高中）', () => {
  it('高中正式卷·高考 → 注入水平四', () => {
    const out = buildInjectionInstruction({
      template: '你是命题专家。', stage: 'high', subject: '物理', genTypeLabel: '正式考卷',
      genType: 'exam', scopeType: 'gaokao',
    });
    expect(out).toContain(LEVEL_INJECTION_MARKER);
    expect(out).toContain('水平四');
    expect(out).toContain('高考');
  });

  it('高中正式卷·思想政治高考 → 注入水平三（学科例外）', () => {
    const out = buildInjectionInstruction({
      template: '你是命题专家。', stage: 'high', subject: '思想政治', genTypeLabel: '正式考卷',
      genType: 'exam', scopeType: 'gaokao',
    });
    expect(out).toContain('水平三');
    expect(out).not.toContain('水平四');
    // 学科归一：'政治' 高中同样归到思想政治 → 同样水平三
    expect(buildLevelInstruction({ stage: 'high', subject: '政治', genType: 'exam', scopeType: 'gaokao' }))
      .toContain('水平三');
  });

  it('高中正式卷·非升学（合格考）→ 注入水平二', () => {
    const out = buildInjectionInstruction({
      template: '你是命题专家。', stage: 'high', subject: '数学', genTypeLabel: '正式考卷',
      genType: 'exam', scopeType: 'final',
    });
    expect(out).toContain('合格考');
    expect(out).toContain('水平二');
  });

  it('高中教辅（无卷别）→ 锚"水平二（合格要求）"为教学基线', () => {
    const out = buildInjectionInstruction({
      template: '你是教辅编辑。', stage: 'high', subject: '物理', genTypeLabel: '课时练',
      genType: 'practice',
    });
    expect(out).toContain(LEVEL_INJECTION_MARKER);
    expect(out).toContain('水平二');
    expect(out).toContain(TEACHING_BASELINE.kind); // 合格要求
    expect(out).not.toContain('本卷为高中');
  });

  it('注入正文含课标出处（可查可引用）', () => {
    const out = buildLevelInstruction({ stage: 'high', subject: '物理', genType: 'exam', scopeType: 'gaokao' });
    expect(out).toContain(LEVEL_SOURCE);
  });

  it('只注入一处：高中指令正文里【学业质量水平】段恰出现一次', () => {
    const out = buildInjectionInstruction({
      template: '你是命题专家。', stage: 'high', subject: '物理', genTypeLabel: '正式考卷',
      genType: 'exam', scopeType: 'gaokao',
    });
    expect(countMarker(out)).toBe(1);
    const teaching = buildInjectionInstruction({
      template: '你是教辅编辑。', stage: 'high', subject: '物理', genTypeLabel: '课时练', genType: 'practice',
    });
    expect(countMarker(teaching)).toBe(1);
  });
});

describe('③ 仅高中生效（义务教育无水平级）', () => {
  it('小学/初中学段一律不注入水平段', () => {
    for (const stage of ['primary_low', 'primary_mid', 'primary_high', 'middle', '小学', '初中']) {
      const out = buildInjectionInstruction({
        template: '你是命题专家。', stage, subject: '语文', genTypeLabel: '正式考卷',
        genType: 'exam', scopeType: 'final',
      });
      expect(countMarker(out), `学段 ${stage} 不应注入水平段`).toBe(0);
      expect(out).not.toContain('学业质量水平');
      expect(buildLevelInstruction({ stage, subject: '语文', genType: 'exam', scopeType: 'gaokao' })).toBe('');
    }
  });

  it('isHighStage / resolveAcademicLevel 对非高中返回空', () => {
    expect(isHighStage('high')).toBe(true);
    expect(isHighStage('高中')).toBe(true);
    expect(isHighStage('middle')).toBe(false);
    expect(isHighStage('primary_high')).toBe(false);
    expect(resolveAcademicLevel({ stage: 'middle', subject: '语文', genType: 'exam' })).toBe('');
    expect(resolveAcademicLevel({ stage: '', subject: '语文', genType: 'exam' })).toBe('');
  });

  it('高中才解析出水平值', () => {
    expect(resolveAcademicLevel({ stage: 'high', subject: '物理', genType: 'exam', scopeType: 'gaokao' })).toBe('水平四');
    expect(resolveAcademicLevel({ stage: 'high', subject: '思想政治', genType: 'exam', scopeType: 'gaokao' })).toBe('水平三');
    expect(resolveAcademicLevel({ stage: 'high', subject: '语文', genType: 'exam', scopeType: 'final' })).toBe('水平二');
    expect(resolveAcademicLevel({ stage: 'high', subject: '语文', genType: 'practice' })).toBe('水平二');
  });
});
