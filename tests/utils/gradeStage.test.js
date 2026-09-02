// 年级/学段 → 五档学段键 单一事实源回归（gradeStage）
// 覆盖全部消费形态：五档键透传、粗学段+年级、段位标签、纯年级标签、空输入。
import { describe, it, expect } from 'vitest';
import { resolveStageKey, extractGradeNum, extractGradeFromName, STAGE_KEY_SET } from '../../src/utils/gradeStage.js';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';

describe('resolveStageKey 单一事实源（全输入形态归一）', () => {
  it('五档键直接透传', () => {
    for (const k of ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high']) {
      expect(resolveStageKey(k)).toBe(k);
    }
  });

  it('粗学段 + 年级：唯一解析到小学低/中/高段（不落回 low / 不误判）', () => {
    expect(resolveStageKey('小学', '一年级')).toBe('primary_low');
    expect(resolveStageKey('小学', '三年级')).toBe('primary_mid');
    expect(resolveStageKey('小学', '六年级')).toBe('primary_high');
    expect(resolveStageKey('小学', '⑥年级')).toBe('primary_high');
    expect(resolveStageKey('小学', '一上')).toBe('primary_low');
    expect(resolveStageKey('小学', '', '六年级上册·语文')).toBe('primary_high'); // 教材名回退
  });

  it('粗学段无年级：小学宽松高段，初中/高中直归', () => {
    expect(resolveStageKey('小学')).toBe('primary_high');
    expect(resolveStageKey('初中')).toBe('middle');
    expect(resolveStageKey('高中')).toBe('high');
  });

  it('段位标签：小学低/中/高段（含裸 低/中/高段）归一（三维度入口 grade:小学低段 的关键能力）', () => {
    expect(resolveStageKey('小学低段')).toBe('primary_low');
    expect(resolveStageKey('小学中段')).toBe('primary_mid');
    expect(resolveStageKey('小学高段')).toBe('primary_high');
    expect(resolveStageKey('低段')).toBe('primary_low');
    expect(resolveStageKey('中段')).toBe('primary_mid');
    expect(resolveStageKey('高段')).toBe('primary_high');
  });

  it('纯年级标签（一~九、初一~初三、高一~高三）', () => {
    expect(resolveStageKey('一年级')).toBe('primary_low');
    expect(resolveStageKey('二年级')).toBe('primary_low');
    expect(resolveStageKey('三年级')).toBe('primary_mid');
    expect(resolveStageKey('四年级')).toBe('primary_mid');
    expect(resolveStageKey('五年级')).toBe('primary_high');
    expect(resolveStageKey('六年级')).toBe('primary_high');
    expect(resolveStageKey('初一')).toBe('middle');
    expect(resolveStageKey('初二')).toBe('middle');
    expect(resolveStageKey('初三')).toBe('middle');
    expect(resolveStageKey('七年级')).toBe('middle');
    expect(resolveStageKey('九年级')).toBe('middle');
    expect(resolveStageKey('高一')).toBe('high');
    expect(resolveStageKey('高三')).toBe('high');
  });

  it('空输入保留空语义；未识别标签按原实现返回（不强制五档）', () => {
    expect(resolveStageKey('')).toBe('');
    expect(STAGE_KEY_SET.has(resolveStageKey('语文'))).toBe(false);
  });

  it('extractGradeNum 兼容中文/圈码/阿拉伯', () => {
    expect(extractGradeNum('六年级')).toBe(6);
    expect(extractGradeNum('⑥年级')).toBe(6);
    expect(extractGradeNum('6')).toBe(6);
    expect(extractGradeNum('高一')).toBe(10);
    expect(extractGradeNum('abc')).toBe(0);
  });

  it('extractGradeFromName 从教材名回退年级', () => {
    expect(extractGradeFromName('六年级上册·语文')).toBe(6);
    expect(extractGradeFromName('三上')).toBe(3);
    expect(extractGradeFromName('无年级标识')).toBe(0);
  });
});

// 消费端委托：三维度入口 getPromptTemplate / 教辅结构 buildTeachingInjection 复用到同一源
describe('消费端委托 gradeStage 单一事实源', () => {
  it('getPromptTemplate({grade:小学低段}) 命中 语文|primary_low', () => {
    const t = getPromptTemplate({ grade: '小学低段', subject: '语文', genType: 'exam' });
    expect(t.template).toContain('【语文·小学低段要点】');
  });
  it('buildTeachingInjection 以 小学高段 标签归一到 primary_high（渲染 高段 学段要求）', () => {
    const inj = buildTeachingInjection({ genType: 'review', stage: '小学高段', subject: '语文' });
    expect(inj).toContain('小学高段');
  });
  it('buildTeachingInjection 五档键 direct 行为不变', () => {
    const inj = buildTeachingInjection({ genType: 'review', stage: 'primary_high', subject: '语文' });
    expect(inj).toMatch(/小学高段/);
  });
});