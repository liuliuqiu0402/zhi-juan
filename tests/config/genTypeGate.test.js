/**
 * 资料类型门控 · 值域守卫（2026-10-30 属主："三维度的门控有些地方改错了"）
 * ============================================================
 * 事故：资料类型有**两个值域**——生成端记 key（`exam`），落库/传参记显示名（`📝 正式考卷`）。
 *   门控写成 `genType === 'exam'` 时，凡从历史/生成页进来的记录一律判不中：
 *     · 试卷不再补「注意事项 + 得分框」，而保存时又已把旧固定件剥掉 ⇒ **不可逆丢失**；
 *     · 教辅也可能被误判成试卷主题。
 * 本守卫：①`normalizeGenType` 两种值域都能归一；②门控处**必须**先归一，不得再写裸比较。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeGenType, isExamGenType, genTypeOptions, genTypeTemplates, GEN_TYPE_KEYS, scopeOptions, isExamOnlyScopeType } from '../../src/config/expertKnowledge.js';

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

describe('资料类型 · key/显示名 归一', () => {
  it('key 原样返回', () => {
    for (const k of GEN_TYPE_KEYS) expect(normalizeGenType(k)).toBe(k);
  });

  it('显示名（含 emoji）与纯名都能归一', () => {
    expect(normalizeGenType('📝 正式考卷')).toBe('exam');
    expect(normalizeGenType('正式考卷')).toBe('exam');
    expect(normalizeGenType('📖 知识总结')).toBe('summary');
    expect(normalizeGenType('知识总结')).toBe('summary');
    // 全 9 类都要能往返（新增类型忘加映射即红）
    for (const { value, label } of genTypeOptions) {
      expect(normalizeGenType(label), `显示名『${label}』应归一为 ${value}`).toBe(value);
      expect(normalizeGenType(genTypeTemplates[value].name), `模板名应归一为 ${value}`).toBe(value);
    }
  });

  it('空值/认不出的值返回空串（调用方按"类型未存"处理，不得误判为试卷）', () => {
    expect(normalizeGenType('')).toBe('');
    expect(normalizeGenType(null)).toBe('');
    expect(normalizeGenType(undefined)).toBe('');
    expect(normalizeGenType('随便写的类型')).toBe('');
    expect(isExamGenType('')).toBe(false);
    expect(isExamGenType('随便写的类型')).toBe(false);
  });

  it('isExamGenType：key 与显示名都判为试卷，其余类型都不是', () => {
    expect(isExamGenType('exam')).toBe(true);
    expect(isExamGenType('📝 正式考卷')).toBe(true);
    for (const k of GEN_TYPE_KEYS) expect(isExamGenType(k)).toBe(k === 'exam');
  });
});

describe('门控处必须先归一（防"裸比较"回潮）', () => {
  it('themeConfig.injectExamShell 用 normalizeGenType 判定', () => {
    const src = read('src/themeConfig.js');
    expect(src).toContain('const genTypeKey = normalizeGenType(genType);');
    expect(src).toContain("if (genTypeKey && genTypeKey !== 'exam') return html;");
  });

  it('TypesetModule 的密封线/固定件门控全部走 normalizeGenType', () => {
    const src = read('src/modules/TypesetModule.vue');
    expect(src, '状态同步须归一（历史里存的是显示名）').toContain('currentGenType.value = normalizeGenType(meta.genType);');
    expect(src, '载入入口须归一').toContain('currentGenType.value = normalizeGenType(genType);');
    expect(src, '双门控须归一').toContain("normalizeGenType(genType) === 'exam'");
    expect(src, '不得再写裸比较').not.toContain("genType === 'exam'");
  });

  it('标题拼装收单源：GenerateModule 两处都调 composeDocTitle，判据在 composeDocTitle 内', () => {
    const gen = read('src/modules/GenerateModule.vue');
    const calls = gen.match(/composeDocTitle\(\{/g) || [];
    expect(calls.length, '组装指令与卷首标题两处都必须走同一函数').toBeGreaterThanOrEqual(2);
    expect(gen, '不得再在组件里自己拼考试型标题').not.toContain('isExam: isLabelScope');
    const ps = read('src/config/paperScope.js');
    expect(ps, '门控判据收在 composeDocTitle 内').toContain('const isExam = isExamGenType(genType);');
    expect(ps, '考试型标题只认正式考卷').toContain('const isLabelScope = isExam && scopeIsLabel');
  });
});

// 🔴 2026-10-30（属主："期中/期末/月考不是专给试卷用的吗"＋"这弹窗上写的是『本卷』"）：
//   范围类型是**卷**上的概念（考试场次／卷别），教辅不得展示、也不得保留已选值。
describe('范围类型 · 仅正式考卷可用（examOnly 单源）', () => {
  it('期中/期末/月考/升学卷别＝examOnly；默认/专题不是', () => {
    for (const v of ['midterm', 'final', 'monthly', 'xiaoshengchu', 'zhongkao', 'gaokao']) {
      expect(isExamOnlyScopeType(v), `${v} 应仅正式考卷可用`).toBe(true);
      expect(scopeOptions.find((o) => o.value === v)?.examOnly, `${v} 须带 examOnly 标记`).toBe(true);
    }
    for (const v of ['default', 'topic']) {
      expect(isExamOnlyScopeType(v), `${v} 不该被限制为试卷专属`).toBe(false);
    }
    expect(isExamOnlyScopeType(''), '空值不算考试专属（默认走勾选推断）').toBe(false);
  });

  it('GenerateModule 的范围弹窗按 examOnly 过滤（不再各写一份白名单）', () => {
    const gen = read('src/modules/GenerateModule.vue');
    expect(gen, '展示门控读 examOnly').toContain('scopeOptions.filter(o => !o.examOnly)');
    expect(gen, '切换资料类型时重置考试专属范围').toContain('isExamOnlyScopeType(scopeType.value)');
    expect(gen, '不得再各自写一份卷别白名单').not.toContain('EXAM_GRADUATION_TYPES.includes(o.value)');
  });
});
