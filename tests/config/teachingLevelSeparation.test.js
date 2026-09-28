// 🔴 2026-09-28（用户裁定·高中教辅"水平"口径语义分离）
// ============================================================
// 病根：同一份"高中X科教辅"提示词里，两处对"对标哪一级学业质量水平"给出相反结论——
//   · config/levelMapping.js（教辅无卷别）：按毕业合格要求为教学基线，对标学业质量水平二，
//     "难度与情境不超该水平要求"；
//   · config/teachingBlueprints.js 各科 high note：原写"对标学业质量水平四/三（…）"，读起来是教辅要求。
// 裁定（语义分离，非二选一）：教辅**难度定位**锚"水平二（教学基线）"不变；各科 high note 里出现的
//   "水平四/水平三"一律标注为**高考选拔对标、不作为教辅要求**（措辞单源 = LEVEL_SELECTION_CAVEAT）。
// 本文件把"同一份高中教辅提示词中不再出现'锚水平二'与'要求水平四/三'并存"钉死。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildLevelInstruction, gaokaoLevelOf, resolveAcademicLevel, isMultiLevel } from '../../src/config/levelMapping.js';
import { buildTeachingInjection, LEVEL_SELECTION_CAVEAT } from '../../src/config/teachingBlueprints.js';

const ROOT = path.resolve(__dirname, '../..');

/** 各科高中教辅 high note 里提到的"选拔对标级"（高于教学基线水平二的那些）
 *  🔴 2026-09-28（真断言·不得靠子串侥幸）：各级一律以**单源 gaokaoLevelOf** 取值，
 *     音乐为**多级**（"水平二与水平三"）——不得建模为单值'水平三'（那会被子串包含而"侥幸通过"）。 */
const HIGHER_LEVEL_SUBJECTS = [
  { subject: '语文', level: gaokaoLevelOf('语文') },
  { subject: '物理', level: gaokaoLevelOf('物理') },
  { subject: '化学', level: gaokaoLevelOf('化学') },
  { subject: '生物', level: gaokaoLevelOf('生物') },
  { subject: '历史', level: gaokaoLevelOf('历史') },
  { subject: '地理', level: gaokaoLevelOf('地理') },
  { subject: '信息科技', level: gaokaoLevelOf('信息科技') },
  { subject: '音乐', level: gaokaoLevelOf('音乐') },   // 多级：水平二与水平三
  { subject: '美术', level: gaokaoLevelOf('美术') },
  { subject: '思想政治', level: gaokaoLevelOf('思想政治') },
];

/** 同一份高中教辅提示词 = 学业质量水平块（levelMapping 注入）＋ 教辅结构块（teachingBlueprints 注入） */
const teachingPrompt = (subject) => {
  const level = buildLevelInstruction({ stage: 'high', subject, genType: 'practice' });
  const teach = buildTeachingInjection({ genType: 'practice', stage: 'high', subject });
  return `${level}\n${teach}`;
};

describe('高中教辅"水平"口径语义分离（教学基线水平二 与 高考选拔对标 不互相否定）', () => {
  it('措辞单源：选拔对标说明只允许出现在 teachingBlueprints.js，且不得引入类型专属词"考试"', () => {
    const files = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(js|vue|ts)$/.test(name)) files.push(p);
      }
    };
    walk(path.join(ROOT, 'src'));
    const owners = files
      .filter((f) => fs.readFileSync(f, 'utf8').includes('不作为教辅要求'))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
    expect(owners, '选拔对标说明只允许在 teachingBlueprints.js（单源常量）').toEqual(['src/config/teachingBlueprints.js']);
    // 类型专属词"考试"不得出现在非卷教辅注入（assemblyMatrix 基准B：exam 专属词不跨类型广播）
    expect(LEVEL_SELECTION_CAVEAT, '选拔对标措辞不得含"考试"（会触发类型专属词广播）').not.toContain('考试');
  });

  it('教辅难度定位仍锚"水平二（教学基线）"（levelMapping 单源不变）', () => {
    for (const { subject } of HIGHER_LEVEL_SUBJECTS) {
      const level = buildLevelInstruction({ stage: 'high', subject, genType: 'practice' });
      expect(level, `${subject} 教辅应注入水平二教学基线`).toContain('水平二');
      expect(level, `${subject} 教辅水平块应标明"教学基线"`).toContain('教学基线');
    }
  });

  it('各科 high note：选拔对标级在，但已明确"不作为教辅要求"（不再与水平二教学基线互斥）', () => {
    for (const { subject, level } of HIGHER_LEVEL_SUBJECTS) {
      const prompt = teachingPrompt(subject);
      // ① 教学基线在（levelMapping 注入）
      expect(prompt, `${subject} 缺教学基线水平二`).toContain('水平二');
      // ② 选拔对标级仍在（内容不丢）
      expect(prompt, `${subject} 缺选拔对标级 ${level}`).toContain(level);
      // ③ 选拔对标级已被标注为"不作为教辅要求"
      expect(prompt, `${subject} 未标注"不作为教辅要求"`).toContain('不作为教辅要求');
      expect(prompt, `${subject} 未使用单源常量措辞`).toContain(LEVEL_SELECTION_CAVEAT);
      // ④ 旧"要求式"并存表述不得回潮：不得把选拔级写成教辅要求/难度上限
      expect(prompt, `${subject} 仍把 ${level} 当教辅要求`).not.toContain(`要求${level}`);
      expect(prompt, `${subject} 仍把 ${level} 当难度上限`).not.toContain(`不超${level}`);
      expect(prompt, `${subject} 仍以"对标学业质量${level}"作要求式表述`)
        .not.toContain(`对标学业质量${level}`);
    }
  });

  it('🔴 音乐：高考对标为多级"水平二与水平三"（单源真断言 + isMultiLevel 守卫，不得退化为单值水平三）', () => {
    // 真断言：音乐不是单一水平——不得再以单值'水平三'建模靠子串侥幸通过
    expect(gaokaoLevelOf('音乐'), '音乐高考对标须为两级').toBe('水平二与水平三');
    expect(isMultiLevel(gaokaoLevelOf('音乐')), '音乐须判为多级（isMultiLevel 守卫消费方）').toBe(true);
    // 对照：单值学科不得被判为多级
    expect(isMultiLevel(gaokaoLevelOf('物理')), '物理应为单级').toBe(false);
    const prompt = teachingPrompt('音乐');
    expect(prompt, '音乐 high note 须渲染两级').toContain('水平二与水平三');
    expect(prompt, '不得退化为单值"水平三"').not.toContain('学业质量水平三');
  });

  it('无选拔对标的科目（体育）：教辅提示词仍只有水平二教学基线，不引入更高要求', () => {
    const prompt = teachingPrompt('体育');
    expect(prompt).toContain('水平二');
    expect(prompt).not.toContain('不超水平四');
    expect(prompt).not.toContain('不超水平三');
  });
});

/**
 * 🔴 2026-09-28（按各科课标核正）：数学/英语为三级水平制——"高考=水平二"（单源 gaokaoLevelOf），
 *   与"教辅基线=水平一（毕业合格要求）"分型、不互斥；且同一份高中提示词中不得出现相反表述。
 */
describe('数学/英语：高考对标水平二（单源·课标）与教辅基线水平一分型', () => {
  it('high note 的选拔对标级取单源 gaokaoLevelOf（数学/英语=水平二），不出现相反水平', () => {
    for (const subject of ['数学', '英语']) {
      const prompt = teachingPrompt(subject);
      expect(gaokaoLevelOf(subject), `${subject} 高考水平`).toBe('水平二');
      expect(prompt, `${subject} 缺高考对标水平二`).toContain(gaokaoLevelOf(subject));
      expect(prompt, `${subject} 未标注"不作为教辅要求"`).toContain(LEVEL_SELECTION_CAVEAT);
      // 相反表述不得出现（旧"全科统一水平四"会把数学/英语误标为水平四/水平三）
      expect(prompt, `${subject} 出现相反水平四`).not.toContain('水平四');
      expect(prompt, `${subject} 出现相反水平三`).not.toContain('水平三');
    }
  });

  it('教辅基线=水平一（毕业合格要求），与"高考=水平二"分型不互斥', () => {
    for (const subject of ['数学', '英语']) {
      expect(resolveAcademicLevel({ stage: 'high', subject, genType: 'practice' })).toBe('水平一');
      // 基线块与高考对标块同在一份提示词里却不互相否定
      const level = buildLevelInstruction({ stage: 'high', subject, genType: 'practice' });
      expect(level).toContain('水平一');
      expect(level).toContain('教学基线');
    }
  });

  it('🔴 回潮守卫：各科 high note 的选拔对标级由单源 gaokaoLevelOf 取值，不再手写水平值', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/config/teachingBlueprints.js'), 'utf8');
    for (const subject of ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '思想政治', '信息科技', '美术', '音乐']) {
      expect(src, `teachingBlueprints 未引用单源 gaokaoLevelOf('${subject}')`).toContain(`gaokaoLevelOf('${subject}')`);
    }
    // 旧"手写水平值"的回潮字面（数学/英语曾写死水平二且无"选拔对标"标注；物理等曾写死水平四）
    expect(src).not.toContain('对标学业质量水平二（高考的要求');
    expect(src).not.toContain('对标学业质量水平二（选择性必修');
    expect(src).not.toContain('学业质量水平四（高等院校招生对应水平）');
    expect(src).not.toContain('学业质量水平三（高等院校招生对应水平）');
    // 音乐两级须由单源渲染，不得再手写死（旧=「学业质量水平二与水平三」字面）
    expect(src, '音乐两级水平不得手写死，须引单源 gaokaoLevelOf(\'音乐\')').not.toContain('学业质量水平二与水平三');
  });
});
