// 卷面质检规则库测试（三维度匹配 + 双阶段：注入约束 / 静默校验 + 用户自定义持久化）
import { describe, it, expect, beforeEach } from 'vitest';
import {
  VALIDATOR_RULES,
  listValidatorRules,
  getValidatorRule,
  getValidatorRules,
  buildValidatorPrompt,
  normalizeStage,
  saveUserRule,
  deleteUserRule,
  resetUserRules,
  RULES_STORAGE_KEY,
} from '@/config/validatorRules.js';

beforeEach(() => {
  // 每个用例前清空用户自定义，保证内置基线
  localStorage.removeItem(RULES_STORAGE_KEY);
});

describe('validatorRules 规则库完整性', () => {
  it('fix 类规则必须带生成前约束文案 promptHint（阶段一注入所需）', () => {
    const fixRules = VALIDATOR_RULES.filter(r => r.category === 'fix');
    expect(fixRules.length).toBeGreaterThanOrEqual(5);
    for (const r of fixRules) {
      expect(r.promptHint, `fix 规则 ${r.id} 缺 promptHint`).toBeTruthy();
      expect(r.subjects.length).toBeGreaterThan(0);
      expect(r.stages.length).toBeGreaterThan(0);
    }
  });

  it('guard 类规则不注入生成前约束（静默兜底，不打扰）', () => {
    const guardRules = VALIDATOR_RULES.filter(r => r.category === 'guard');
    expect(guardRules.length).toBeGreaterThanOrEqual(6);
    for (const r of guardRules) {
      expect(r.promptHint).toBeFalsy();
    }
  });

  it('规则 id 唯一', () => {
    const ids = VALIDATOR_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('validatorRules 三维度匹配（与指令库/蓝图库对齐）', () => {
  it('语文·小学低段·exam：命中拼音/分值/子题等规则', () => {
    const rules = getValidatorRules({ subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(rules.has('pinyin-norm')).toBe(true);
    expect(rules.has('pinyin-blank-fill')).toBe(true);
    expect(rules.has('score-label-fix')).toBe(true);
    expect(rules.has('template-cleanup')).toBe(true);
    expect(rules.has('title-detail-fix')).toBe(true);
    expect(rules.has('answer-shell-guard')).toBe(true);
  });

  it('数学·初中·exam：命中分值/统计图相关，不命中拼音规则', () => {
    const rules = getValidatorRules({ subject: '数学', stage: 'middle', genType: 'exam' });
    expect(rules.has('score-label-fix')).toBe(true);
    expect(rules.has('pinyin-blank-fill')).toBe(false);
    expect(rules.has('pinyin-option-guard')).toBe(false);
  });

  it('高中·语文·exam：不命中低段拼音规则（stages 限定 low/mid）', () => {
    const rules = getValidatorRules({ subject: '语文', stage: 'high', genType: 'exam' });
    expect(rules.has('pinyin-blank-fill')).toBe(false);
    expect(rules.has('pinyin-norm')).toBe(false);
    expect(rules.has('score-label-fix')).toBe(true);
  });

  it('title-detail-fix 仅 exam 生效（genTypes 限定）', () => {
    expect(getValidatorRules({ subject: '语文', stage: 'primary_low', genType: 'exam' }).has('title-detail-fix')).toBe(true);
    expect(getValidatorRules({ subject: '语文', stage: 'primary_low', genType: 'practice' }).has('title-detail-fix')).toBe(false);
  });

  it('getValidatorRule 查询单条', () => {
    expect(getValidatorRule('score-label-fix').name).toContain('分值');
    expect(getValidatorRule('not-exist')).toBeNull();
  });
});

describe('validatorRules 生成前约束（阶段一：随指令注入）', () => {
  it('语文·小学低段·exam：注入拼音/分值/残留等约束，guard 不注入', () => {
    const prompt = buildValidatorPrompt({ subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(prompt).toContain('【卷面质检规则');
    expect(prompt).toContain('拼音');
    expect(prompt).toContain('分值账目自洽');
    // guard 类（缺拼音选项/答案空壳）不注入生成前约束
    expect(prompt).not.toContain('空壳');
  });

  it('数学·初中·exam：注入分值约束，不注入拼音约束', () => {
    const prompt = buildValidatorPrompt({ subject: '数学', stage: 'middle', genType: 'exam' });
    expect(prompt).toContain('分值账目自洽');
    expect(prompt).not.toContain('看拼音写词语');
  });

  it('无规则命中的维度返回空串（如体育——通用规则仍生效，仅验证非空串场景）', () => {
    // 体育命中 subjects['*'] 的通用规则（分值/残留清理），因此返回通用约束而非空串；
    // 语文拼音题专属规则（看拼音写词语）不注入
    const prompt = buildValidatorPrompt({ subject: '体育', stage: 'middle', genType: 'exam' });
    expect(prompt).toContain('分值账目自洽');
    expect(prompt).not.toContain('看拼音写词语');
  });
});

describe('validatorRules normalizeStage', () => {
  it('中文/英文学段归一为学段键', () => {
    expect(normalizeStage('小学', 1)).toBe('primary_low');
    expect(normalizeStage('小学', 3)).toBe('primary_mid');
    expect(normalizeStage('小学', 5)).toBe('primary_high');
    expect(normalizeStage('初中')).toBe('middle');
    expect(normalizeStage('高中')).toBe('high');
    expect(normalizeStage('primary_low')).toBe('primary_low');
  });
});

describe('validatorRules 用户自定义持久化（面板维护，即时生效）', () => {
  it('覆盖内置规则：改 subjects/stages 后三维度匹配立即变化', () => {
    // 把 score-label-fix 限定到语文 → 数学不再命中
    saveUserRule({ id: 'score-label-fix', subjects: ['语文'], stages: ['*'] });
    expect(getValidatorRules({ subject: '数学', stage: 'middle', genType: 'exam' }).has('score-label-fix')).toBe(false);
    expect(getValidatorRules({ subject: '语文', stage: 'middle', genType: 'exam' }).has('score-label-fix')).toBe(true);
  });

  it('停用内置规则：enabled:false 后不再注入/执行', () => {
    saveUserRule({ id: 'score-label-fix', enabled: false });
    expect(getValidatorRules({ subject: '数学', stage: 'middle', genType: 'exam' }).has('score-label-fix')).toBe(false);
    expect(buildValidatorPrompt({ subject: '数学', stage: 'middle', genType: 'exam' })).not.toContain('分值账目自洽');
  });

  it('新增自定义规则：list/get/注入均可感知', () => {
    saveUserRule({
      id: 'my-custom-rule', name: '我的规则', category: 'fix',
      subjects: ['数学'], stages: ['*'], promptHint: '我的自定义约束：单位必须标注。', enabled: true,
    });
    expect(listValidatorRules().some(r => r.id === 'my-custom-rule' && r.source === 'user')).toBe(true);
    expect(getValidatorRule('my-custom-rule').name).toBe('我的规则');
    expect(buildValidatorPrompt({ subject: '数学', stage: 'middle', genType: 'exam' })).toContain('我的自定义约束');
  });

  it('删除内置规则：回退后不再出现在列表与匹配中', () => {
    deleteUserRule('score-label-fix');
    expect(listValidatorRules().some(r => r.id === 'score-label-fix')).toBe(false);
    expect(getValidatorRules({ subject: '数学', stage: 'middle', genType: 'exam' }).has('score-label-fix')).toBe(false);
  });

  it('删除用户新增规则：从列表移除', () => {
    saveUserRule({ id: 'my-rule', name: '临时规则', category: 'guard', subjects: ['*'], stages: ['*'], enabled: true });
    expect(listValidatorRules().some(r => r.id === 'my-rule')).toBe(true);
    deleteUserRule('my-rule');
    expect(listValidatorRules().some(r => r.id === 'my-rule')).toBe(false);
  });

  it('恢复默认：清空全部用户自定义', () => {
    saveUserRule({ id: 'score-label-fix', enabled: false });
    saveUserRule({ id: 'my-rule', name: '临时', category: 'guard', subjects: ['*'], stages: ['*'] });
    resetUserRules();
    expect(getValidatorRule('score-label-fix').enabled).toBe(true);
    expect(listValidatorRules().some(r => r.id === 'my-rule')).toBe(false);
  });

  it('用户版优先：覆盖的字段生效、未覆盖字段保留内置值', () => {
    saveUserRule({ id: 'pinyin-norm', description: '用户改的说明' });
    const r = getValidatorRule('pinyin-norm');
    expect(r.description).toBe('用户改的说明');
    expect(r.subjects).toEqual(['语文', '英语']); // 未覆盖字段保留内置
    expect(r.source).toBe('user');
  });
});
