/**
 * 专项领域注册库 · 三维度两档化链路回归（2026-09 v2）
 * ============================================================
 * 保证：①领域选项按 学科×五档学段 直列过滤（文言文=初中/高中；英语阅读小学低段不开）；
 *       ②verified='B'（高中课标名待官方复核）默认不入生产（options/resolve 均不返回）；
 *       ③A档自带栏目结构（数学·计算）→ 结构文本含栏目与锚、不含数字题量占位；
 *       ④B档（数学·应用题/英语·语法…）→ 无栏目，仅锚句；
 *       ⑤学段体系隔离：高中语义锚走高中课标名（普通高中…），义教走 2022义教名，不混用；
 *       ⑥通用说明与真实生效蓝图一致（分板块组织，无旧四段文案）。
 */
import { describe, it, expect } from 'vitest';
import {
  specialDomainOptions,
  resolveSpecialDomain,
  buildSpecialDomainStructureText,
  buildSpecialDomainAnchorLine,
  GENERIC_SPECIAL_DESC,
} from '../../src/config/specialDomains.js';

describe('specialDomains（三维度两档化：学科×学段×领域）', () => {
  it('语文学段直列：文言文仅 初中/高中；阅读/古诗词/写作全学段', () => {
    const low = specialDomainOptions('语文', 'primary_low').map((o) => o.value);
    expect(low).toEqual(expect.arrayContaining(['阅读理解', '古诗词', '写作']));
    expect(low).not.toContain('文言文');
    const mid = specialDomainOptions('语文', 'middle').map((o) => o.value);
    expect(mid).toContain('文言文');
    expect(specialDomainOptions('语文', 'high').map((o) => o.value)).toContain('文言文');
  });

  it('数学学段直列：计算/应用题/几何限义教学段（低小~初中），高中不开', () => {
    for (const k of ['primary_low', 'primary_mid', 'primary_high', 'middle']) {
      const vs = specialDomainOptions('数学', k).map((o) => o.value);
      expect(vs).toEqual(expect.arrayContaining(['计算', '应用题', '几何']));
    }
    expect(specialDomainOptions('数学', 'high')).toEqual([]);
  });

  it('英语：阅读 中高小起（低小不开）；语法 高小起', () => {
    expect(specialDomainOptions('英语', 'primary_low')).toEqual([]);
    expect(specialDomainOptions('英语', 'primary_mid').map((o) => o.value)).toContain('阅读理解');
    expect(specialDomainOptions('英语', 'primary_high').map((o) => o.value)).toContain('阅读理解');
    expect(specialDomainOptions('英语', 'primary_mid').map((o) => o.value)).not.toContain('语法'); // 语法高小起
    expect(specialDomainOptions('英语', 'primary_high').map((o) => o.value)).toContain('语法');
    expect(specialDomainOptions('英语', 'middle').map((o) => o.value)).toEqual(
      expect.arrayContaining(['阅读理解', '语法']),
    );
  });

  it("verified='B'（高中数学待复核领域）默认不入生产：options/resolve 均不可见", () => {
    expect(specialDomainOptions('数学', 'high')).toEqual([]);
    expect(resolveSpecialDomain('数学', 'high', '函数')).toBeNull();
  });

  it('未收录学科/未知学段 → 空清单（回退通用专项）', () => {
    expect(specialDomainOptions('物理', 'middle')).toEqual([]);
    expect(specialDomainOptions('数学', '')).toEqual([]);
    expect(resolveSpecialDomain('', 'primary_high', '计算')).toBeNull();
  });

  it('resolve：学科×学段×领域 全匹配才返回；A档有栏目、B档无栏目', () => {
    const a = resolveSpecialDomain('数学', 'primary_mid', '计算');
    expect(a).toBeTruthy();
    expect(a.sections.length).toBeGreaterThan(0);
    const b = resolveSpecialDomain('数学', 'primary_mid', '应用题');
    expect(b).toBeTruthy();
    expect(b.sections).toBeNull(); // B档：无领域栏目
  });

  it('A档结构文本：含栏目/课标锚/学段名，且不含数字题量占位', () => {
    const dom = resolveSpecialDomain('数学', 'primary_high', '计算');
    const text = buildSpecialDomainStructureText(dom, 'primary_high');
    expect(text).toContain('【教辅结构（专项领域·🔢 计算·小学高段）');
    expect(text).toContain('▌栏目框架');
    expect(text).toContain('数与代数·数与运算');
    expect(text).not.toContain('(共');
  });

  it('B档锚句：可独立成句；高中语义锚走高中课标名（体系隔离）', () => {
    const dH = resolveSpecialDomain('英语', 'high', '语法');
    const anchorH = buildSpecialDomainAnchorLine(dH);
    expect(anchorH).toContain('普通高中英语·语言知识');
    expect(anchorH).not.toContain('2022义教英语');
    const dY = resolveSpecialDomain('语文', 'primary_mid', '古诗词');
    const anchorY = buildSpecialDomainAnchorLine(dY);
    expect(anchorY).toContain('中华优秀传统文化');
    expect(anchorY).not.toContain('普通高中语文'); // 义教学段不混入高中体系名
  });

  it('通用说明与真实生效蓝图一致（分板块组织，无旧四段文案）', () => {
    expect(GENERIC_SPECIAL_DESC).toContain('分板块组织');
    expect(GENERIC_SPECIAL_DESC).not.toContain('方法指导→典例剖析');
  });

  it('数学义教主题名按学段分写（2026-09 语境词审计）：小学/初中锚不混用课标主题名', () => {
    const primaryAnchor = resolveSpecialDomain('数学', 'primary_high', '计算').anchor;
    expect(primaryAnchor).toContain('数与代数·数与运算');
    expect(primaryAnchor).not.toContain('数与式');
    const middleCalc = resolveSpecialDomain('数学', 'middle', '计算').anchor;
    expect(middleCalc).toContain('数与代数·数与式');
    expect(middleCalc).not.toContain('数与运算（运算能力）');
    const middleApp = resolveSpecialDomain('数学', 'middle', '应用题').anchor;
    expect(middleApp).toContain('方程与不等式、函数');
    expect(middleApp).not.toContain('数量关系（解决问题）');
    const primaryGeo = resolveSpecialDomain('数学', 'primary_high', '几何').anchor;
    expect(primaryGeo).toContain('图形的认识与测量');
    const middleGeo = resolveSpecialDomain('数学', 'middle', '几何').anchor;
    expect(middleGeo).toContain('图形的性质');
    expect(middleGeo).not.toContain('位置与运动');
  });
});
