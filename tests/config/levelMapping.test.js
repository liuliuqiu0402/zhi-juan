// 卷别 → 学业质量水平 映射守卫（2026-09-28）
// ============================================================
// 锁定三件事：
//   ① 每个卷别都有映射（合格考→水平二、高考→水平四），思想政治为例外（高考→水平三）；
//   ② 映射结果写进指令正文，且**只注入一处**（高中正式卷按卷别、教辅锚水平二合格要求）；
//   ③ 仅高中生效——义务教育（小学/初中）无水平级，一律不注入；
//   ④ 资料类型缺失（genType 空/未传）时不注入——宁可缺、不误标（不得把"未传"默认当教辅锚水平二）。
// 单一事实源：src/config/levelMapping.js（不得在别处再写一份水平口径）。
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  LEVEL_MAP, SUBJECT_GAOKAO_LEVEL, PAPER_KINDS, SUBJECT_LEVEL_KEYS, TEACHING_BASELINE,
  LEVEL_INJECTION_MARKER, LEVEL_SOURCE,
  isHighStage, gaokaoLevelOf, resolvePaperKind, resolveAcademicLevel, buildLevelInstruction, buildPaperKindHint,
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

  it('高中正式卷·非升学（合格考）→ 注入水平二（未列入学科走兜底）', () => {
    const out = buildInjectionInstruction({
      template: '你是命题专家。', stage: 'high', subject: '物理', genTypeLabel: '正式考卷',
      genType: 'exam', scopeType: 'final',
    });
    expect(out).toContain('合格考');
    expect(out).toContain('水平二');
  });

  it('🔴 按学科分型：数学/英语合格考 → 水平一（三级水平制：水平一=毕业/合格考命题依据）', () => {
    for (const subject of ['数学', '英语']) {
      const out = buildInjectionInstruction({
        template: '你是命题专家。', stage: 'high', subject, genTypeLabel: '正式考卷',
        genType: 'exam', scopeType: 'final',
      });
      expect(out, `${subject} 合格考应对标水平一`).toContain('水平一');
      expect(out, `${subject} 合格考不得锚水平二`).not.toContain('水平二');
    }
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

describe('④ 资料类型缺失（genType 空/未传）时不注入（宁可缺、不误标）', () => {
  // 既往缺陷：genType 缺失被默认当作"教辅"，锚到"水平二（合格要求）"，把未知资料误标为合格要求。
  const MISSING = [undefined, '', '   '];

  it('genType 空/未传 → resolveAcademicLevel / buildLevelInstruction 均返回空串', () => {
    for (const genType of MISSING) {
      expect(resolveAcademicLevel({ stage: 'high', subject: '物理', genType }), `genType=${JSON.stringify(genType)} 不应解析出水平`).toBe('');
      expect(buildLevelInstruction({ stage: 'high', subject: '物理', genType })).toBe('');
    }
  });

  it('genType 空/未传 → 指令正文里不出现【学业质量水平】段', () => {
    for (const genType of MISSING) {
      const out = buildInjectionInstruction({
        template: '你是命题专家。', stage: 'high', subject: '物理', genTypeLabel: '资料', genType,
      });
      expect(countMarker(out), `genType=${JSON.stringify(genType)} 不应注入水平段`).toBe(0);
      expect(out).not.toContain('学业质量水平');
      expect(out).not.toContain('水平二'); // 尤其不得默认锚"水平二"
    }
    // 完全不传 genType（缺省）同样不注入
    const noGenType = buildInjectionInstruction({ template: '你是命题专家。', stage: 'high', subject: '物理' });
    expect(countMarker(noGenType)).toBe(0);
  });

  it('显式 paperKind 属显式口径，不受 genType 缺失影响', () => {
    expect(buildLevelInstruction({ stage: 'high', subject: '物理', paperKind: '高考' })).toContain('水平四');
    expect(resolveAcademicLevel({ stage: 'high', subject: '物理', paperKind: '合格考' })).toBe('水平二');
  });

  it('正式卷 / 教辅两类正常路径不受影响', () => {
    // 正式卷：按卷别映射
    expect(buildLevelInstruction({ stage: 'high', subject: '物理', genType: 'exam', scopeType: 'gaokao' })).toContain('水平四');
    expect(resolveAcademicLevel({ stage: 'high', subject: '物理', genType: 'exam', scopeType: 'final' })).toBe('水平二');
    // 教辅（genType 为非 exam 的非空值）：锚教学基线（合格要求）
    const teaching = buildLevelInstruction({ stage: 'high', subject: '物理', genType: 'practice' });
    expect(teaching).toContain(LEVEL_INJECTION_MARKER);
    expect(teaching).toContain('水平二');
    expect(teaching).toContain(TEACHING_BASELINE.kind);
    // 教辅与"缺失"必须区分开：缺失为 ''、教辅有值
    expect(resolveAcademicLevel({ stage: 'high', subject: '物理', genType: 'practice' })).toBe('水平二');
    expect(resolveAcademicLevel({ stage: 'high', subject: '物理', genType: '' })).toBe('');
  });
});

describe('⑤ 卷别提示（UI 用·单源 LEVEL_MAP，2026-09-28 资料类型正规形态）', () => {
  it('高中 + 正式卷 → 提示「选高考按水平四（选拔要求）；未选按水平二（合格要求）」', () => {
    const hint = buildPaperKindHint({ stage: 'high', genType: 'exam' });
    expect(hint).toBe('选高考按水平四（选拔要求）；未选按水平二（合格要求）');
    // 与 LEVEL_MAP 同源（不另写一份水平口径）
    expect(hint).toContain(LEVEL_MAP['高考']);
    expect(hint).toContain(LEVEL_MAP['合格考']);
  });

  it('按学科分型：数学/英语「选高考按水平二；未选按水平一」', () => {
    expect(buildPaperKindHint({ stage: 'high', genType: 'exam', subject: '数学' }))
      .toBe('选高考按水平二（选拔要求）；未选按水平一（合格要求）');
    expect(buildPaperKindHint({ stage: 'high', genType: 'exam', subject: '英语' }))
      .toBe('选高考按水平二（选拔要求）；未选按水平一（合格要求）');
    // 未传学科 → 保持默认（水平四/水平二），兼容旧口径
    expect(buildPaperKindHint({ stage: 'high', genType: 'exam' }))
      .toBe('选高考按水平四（选拔要求）；未选按水平二（合格要求）');
  });

  it('非高中 / 非正式卷 / 资料类型缺失 → 不提示（空串）', () => {
    expect(buildPaperKindHint({ stage: 'middle', genType: 'exam' })).toBe('');
    expect(buildPaperKindHint({ stage: 'primary_high', genType: 'exam' })).toBe('');
    expect(buildPaperKindHint({ stage: 'high', genType: 'practice' })).toBe('');
    expect(buildPaperKindHint({ stage: 'high', genType: '' })).toBe('');
    expect(buildPaperKindHint({})).toBe('');
  });
});

/**
 * 🔴 按各科课标核正（2026-09-28）：各科"高考/等级性考试对应学业质量水平"单源 + 课标一致性。
 * 依据：《普通高中课程标准（2017年版2020年修订）》各科·五、学业质量·学业质量水平 原文，
 *   并经省级教育行政部门实施口径交叉核证（数学/英语=水平二、思想政治=水平三、
 *   语文/物理/化学/生物/历史/地理/信息技术=水平四、美术=水平三）。
 *   未确证项：音乐（课标为水平二与水平三两级，无单一值）、体育与健康（无等级性考试）→ 见报告。
 */
describe('⑥ 各科"高考/等级性考试对应水平"按课标分型（单一事实源 SUBJECT_GAOKAO_LEVEL）', () => {
  const GAOKAO_EXPECT = {
    '语文': '水平四', '数学': '水平二', '英语': '水平二',
    '物理': '水平四', '化学': '水平四', '生物': '水平四',
    '历史': '水平四', '地理': '水平四', '思想政治': '水平三',
    '信息科技': '水平四', '美术': '水平三',
  };

  it('SUBJECT_GAOKAO_LEVEL 与各科课标一致（思想政治=水平三、数学/英语=水平二，美术=水平三，其余=水平四）', () => {
    for (const [subject, level] of Object.entries(GAOKAO_EXPECT)) {
      expect(SUBJECT_GAOKAO_LEVEL[subject], `${subject} 高考对标水平`).toBe(level);
    }
    // 默认/兜底表保持（未列入学科用）
    expect(LEVEL_MAP['高考']).toBe('水平四');
    expect(LEVEL_MAP['合格考']).toBe('水平二');
  });

  it('resolveAcademicLevel：各科高考卷按学科取水平（不再全科统一水平四）', () => {
    for (const [subject, level] of Object.entries(GAOKAO_EXPECT)) {
      expect(resolveAcademicLevel({ stage: 'high', subject, genType: 'exam', scopeType: 'gaokao' }), `${subject} 高考`)
        .toBe(level);
    }
    // 反例：数学/英语高考**不再是**水平四（旧"全科统一水平四"的病灶）
    expect(resolveAcademicLevel({ stage: 'high', subject: '数学', genType: 'exam', scopeType: 'gaokao' })).not.toBe('水平四');
    expect(resolveAcademicLevel({ stage: 'high', subject: '英语', genType: 'exam', scopeType: 'gaokao' })).not.toBe('水平四');
  });

  it('gaokaoLevelOf 走学科归名单源（信息技术→信息科技、政治→思想政治、体育与健康→体育）', () => {
    expect(gaokaoLevelOf('信息技术')).toBe('水平四');
    expect(gaokaoLevelOf('政治')).toBe('水平三');
    expect(gaokaoLevelOf('体育与健康')).toBe(LEVEL_MAP['高考']); // 体育无等级性考试 → 兜底（未确证，见报告）
  });

  it('教辅教学基线按学科：数学/英语=水平一，其余=水平二（毕业合格要求）', () => {
    for (const subject of ['数学', '英语']) {
      const t = buildLevelInstruction({ stage: 'high', subject, genType: 'practice' });
      expect(t, `${subject} 教辅基线=水平一`).toContain('水平一');
      expect(resolveAcademicLevel({ stage: 'high', subject, genType: 'practice' })).toBe('水平一');
    }
    for (const subject of ['语文', '物理', '思想政治', '美术']) {
      expect(resolveAcademicLevel({ stage: 'high', subject, genType: 'practice' }), `${subject} 教辅基线=水平二`).toBe('水平二');
    }
  });
});
