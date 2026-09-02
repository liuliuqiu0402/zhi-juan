// 版面质检规则库测试（三维度匹配 + 双阶段：注入约束 / 静默校验 + 用户自定义持久化）
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
import { resolveStageKey, extractGradeNum } from '@/utils/gradeStage.js';

beforeEach(() => {
  // 每个用例前清空用户自定义，保证内置基线
  localStorage.removeItem(RULES_STORAGE_KEY);
});

describe('validatorRules 规则启停开关（双阶段生效）', () => {
  it('停用规则 → 生成前约束不注入、生成后不执行（getValidatorRules 不含）', () => {
    const target = VALIDATOR_RULES.find((r) => r.id === 'template-cleanup');
    saveUserRule({ ...target, enabled: false });
    expect(getValidatorRules({ subject: '语文', stage: 'primary_low', genType: 'exam' }).has('template-cleanup')).toBe(false);
    expect(buildValidatorPrompt({ subject: '语文', stage: 'primary_low', genType: 'exam' })).not.toContain(target.promptHint.slice(0, 12));
    // 未停用规则不受影响（双阶段均保留）
    expect(getValidatorRules({ subject: '语文', stage: 'primary_low', genType: 'exam' }).has('score-label-fix')).toBe(true);
    expect(buildValidatorPrompt({ subject: '语文', stage: 'primary_low', genType: 'exam' })).toContain('分值账目自洽');
  });

  it('重新启用 → 恢复注入与执行', () => {
    const target = VALIDATOR_RULES.find((r) => r.id === 'template-cleanup');
    saveUserRule({ ...target, enabled: false });
    saveUserRule({ ...target, enabled: true });
    expect(getValidatorRules({ subject: '语文', stage: 'primary_low', genType: 'exam' }).has('template-cleanup')).toBe(true);
  });
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
    expect(guardRules.length).toBeGreaterThanOrEqual(3);
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
  it('语文·小学低段·exam：命中拼音归一/分值/残留等规则', () => {
    const rules = getValidatorRules({ subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(rules.has('pinyin-norm')).toBe(true);
    expect(rules.has('pinyin-blank-fill')).toBe(false); // 缺空自动补全已删（旧方案补丁，靠生成前约束）
    expect(rules.has('score-label-fix')).toBe(true);
    expect(rules.has('template-cleanup')).toBe(true);
    expect(rules.has('title-detail-fix')).toBe(true);
    expect(rules.has('writing-grid-fix')).toBe(true);
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
    expect(prompt).toContain('【版面质检规则');
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

  it('排版语义标记按学科×学段精确注入（通用全学科、上下标限数理化、音标限英语、注音限语文低段）', () => {
    // 化学·中段：通用 + 上下标，不含音标/拼音注音/分数措辞（拆分后噪音约束不再全量注入）
    const chem = buildValidatorPrompt({ subject: '化学', stage: 'middle', genType: 'exam' });
    expect(chem).toContain('<sub>');          // 化学式下标
    expect(chem).toContain('<sup>');          // 离子/幂上标
    expect(chem).toContain('<del>');          // 删除/划去
    expect(chem).toContain('Unicode 上下标字符'); // 禁混用乱码字符
    expect(chem).toContain('<table>');        // 表格标准结构
    expect(chem).not.toContain('音标');        // 英语专属，不再注入化学卷
    expect(chem).not.toContain('拼音注音');     // 语文专属，不再注入化学卷
    expect(chem).not.toContain('分子/分母');   // 分数措辞收敛至渲染契约 FORMULA_RULES，不再跨学科广播
    expect(chem).not.toContain('\\frac');     // 公式措辞由渲染契约按数理学科×学段注入
    // 英语·中段：含音标，不含拼音注音
    const eng = buildValidatorPrompt({ subject: '英语', stage: 'primary_mid', genType: 'exam' });
    expect(eng).toContain('音标');
    expect(eng).not.toContain('拼音注音');
    // 语文·低段：含拼音注音，不含音标斜杠包裹（pinyin-norm 的"音标"指 IPA 字符语境，非英语音标规则）
    const yw = buildValidatorPrompt({ subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(yw).toContain('拼音注音');
    expect(yw).not.toContain('斜杠包裹');
    // 语文·高中：注音不注入（学段限定 low/mid）
    const ywHigh = buildValidatorPrompt({ subject: '语文', stage: 'high', genType: 'exam' });
    expect(ywHigh).not.toContain('拼音注音');
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

  it('中文年级字符串不再被 parseint 误判为低段（回归：六年级→primary_high）', () => {
    expect(normalizeStage('小学', '一年级')).toBe('primary_low');
    expect(normalizeStage('小学', '三年级')).toBe('primary_mid');
    expect(normalizeStage('小学', '六年级')).toBe('primary_high');
    expect(normalizeStage('小学', '')).toBe('primary_high'); // 无年级信息时小学按高段宽松处理
  });
});

// 共享学段工具（gradeStage）回归：圈码识别 + 教材名回退（用户反馈："教材名称中有年级，⑥年级识别不到"）
describe('gradeStage extractGradeNum / resolveStageKey', () => {
  it('圈码 ①-⑥ 与教材名"X年级"能正确归一（⑥年级→六年级→primary_high）', () => {
    expect(resolveStageKey('小学', '⑥年级')).toBe('primary_high');
    expect(resolveStageKey('小学', '②年级')).toBe('primary_low');
    expect(resolveStageKey('小学', '④年级')).toBe('primary_mid');
  });

  it('grade 为空但教材名带年级时，按教材名回退解析（不再误判无年级落低段）', () => {
    expect(resolveStageKey('小学', '', '人教版语文六年级上册')).toBe('primary_high');
    expect(resolveStageKey('小学', '', '苏教版数学三年级下册')).toBe('primary_mid');
    expect(resolveStageKey('小学', '', '人教版语文一年级上册')).toBe('primary_low');
  });

  it('教材名带 "X上/X下/第X册" 缩写也能回退识别', () => {
    expect(resolveStageKey('小学', '', '人教版语文六上')).toBe('primary_high');
    expect(resolveStageKey('小学', '', '人教版语文第2册')).toBe('primary_low');
  });

  it('课标场景：非小学学段不随年级细分', () => {
    expect(resolveStageKey('初中', '七年级', '人教版数学七年级上册')).toBe('middle');
    expect(resolveStageKey('高中', '高一', '人教版数学高一上册')).toBe('high');
  });

  it('小学 1-6 全年级矩阵：消费端每个年级都落到对应学段（六档边界精确）', () => {
    const expectGrade = (cn, circled, expectKey) => {
      expect(resolveStageKey('小学', `${cn}年级`)).toBe(expectKey);
      expect(resolveStageKey('小学', circled)).toBe(expectKey);          // 圈码直传
      expect(resolveStageKey('小学', '', `教材${cn}年级上册`)).toBe(expectKey); // 教材名回退
    };
    expectGrade('一', '①', 'primary_low');
    expectGrade('二', '②', 'primary_low');
    expectGrade('三', '③', 'primary_mid');
    expectGrade('四', '④', 'primary_mid');
    expectGrade('五', '⑤', 'primary_high');
    expectGrade('六', '⑥', 'primary_high');
  });

  it('初/高中各级别消费端均落到 middle/high（不误降小学）', () => {
    expect(resolveStageKey('初中', '初一')).toBe('middle');
    expect(resolveStageKey('初中', '八年级')).toBe('middle');
    expect(resolveStageKey('初中', '九年级')).toBe('middle');
    expect(resolveStageKey('高中', '高二')).toBe('high');
    expect(resolveStageKey('高中', '高三')).toBe('high');
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
    expect(r.subjects).toEqual(['语文']); // 未覆盖字段保留内置（拼音归一仅语文：英语音标是 IPA 正常内容）
    expect(r.source).toBe('user');
  });
});
