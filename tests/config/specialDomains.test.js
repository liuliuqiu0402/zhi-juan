/**
 * 专项领域注册库 · 三维度链路回归（2026-09）
 * ============================================================
 * 保证：①领域选项按 学科×学段桶 过滤（小学语文不含"文言文"——文言文属中学桶）；
 *       ②resolve 匹配学科+学段+领域才返回，否则 null（回退通用专项）；
 *       ③领域结构文本含 课标语义锚 与栏目；
 *       ④通用说明与真实生效蓝图一致（分板块组织，非旧四段文案）。
 */
import { describe, it, expect } from 'vitest';
import {
  specialDomainOptions,
  resolveSpecialDomain,
  buildSpecialDomainStructureText,
  GENERIC_SPECIAL_DESC,
} from '../../src/config/specialDomains.js';

describe('specialDomains（三维度：学科×学段×领域）', () => {
  it('小学语文：可用 阅读理解/古诗词/写作；文言文属中学桶不出现', () => {
    const opts = specialDomainOptions('语文', 'primary_high').map((o) => o.key);
    expect(opts).toContain('阅读理解');
    expect(opts).toContain('古诗词');
    expect(opts).toContain('写作');
    expect(opts).not.toContain('文言文');
  });

  it('初中语文：文言文进入可选领域（中学桶）', () => {
    const opts = specialDomainOptions('语文', 'middle').map((o) => o.key);
    expect(opts).toContain('文言文');
  });

  it('小学数学：计算/应用题/几何；英语小学：阅读理解/语法', () => {
    const math = specialDomainOptions('数学', 'primary_low').map((o) => o.key);
    expect(math).toEqual(expect.arrayContaining(['计算', '应用题', '几何']));
    const eng = specialDomainOptions('英语', 'primary_mid').map((o) => o.key);
    expect(eng).toEqual(expect.arrayContaining(['阅读理解', '语法']));
  });

  it('未收录学科/未知学段 → 空清单（回退通用专项）', () => {
    expect(specialDomainOptions('物理', 'primary_high')).toEqual([]);
    expect(specialDomainOptions('数学', '')).toEqual([]);
  });

  it('resolve：学科×学段×领域 全匹配才返回；任一不匹配 → null', () => {
    const ok = resolveSpecialDomain('数学', 'primary_mid', '计算');
    expect(ok).toBeTruthy();
    expect(ok.label).toBe('🔢 计算');
    expect(ok.sections.length).toBeGreaterThan(0);
    expect(ok.anchor).toContain('数与代数');
    expect(resolveSpecialDomain('语文', 'primary_high', '文言文')).toBeNull(); // 文言文仅中学桶
    expect(resolveSpecialDomain('语文', 'middle', '文言文')).toBeTruthy();
    expect(resolveSpecialDomain('数学', 'primary_high', '不存在领域')).toBeNull();
    expect(resolveSpecialDomain('', 'primary_high', '计算')).toBeNull();
  });

  it('领域结构文本含栏目与课标语义锚；通用说明与真实蓝图结构一致', () => {
    const dom = resolveSpecialDomain('数学', 'primary_high', '计算');
    const text = buildSpecialDomainStructureText(dom);
    expect(text).toContain('【教辅结构·专项领域');
    expect(text).toContain('课标语义锚');
    expect(text).toContain('数与运算');
    expect(GENERIC_SPECIAL_DESC).toContain('分板块组织');
    expect(GENERIC_SPECIAL_DESC).not.toContain('方法指导→典例剖析');
  });
});
