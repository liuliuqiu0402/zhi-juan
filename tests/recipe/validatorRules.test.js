// 卷面质检规则库测试（三维度匹配 + 双阶段：注入约束 / 静默校验）
import { describe, it, expect } from 'vitest';
import {
  VALIDATOR_RULES,
  listValidatorRules,
  getValidatorRule,
  getValidatorRules,
  buildValidatorPrompt,
  normalizeStage,
} from '@/config/validatorRules.js';

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
