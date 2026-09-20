/**
 * 专项领域注册库 · 三维度两档化链路回归（2026-09 v2）
 * ============================================================
 * 保证：①领域选项按 学科×五档学段 直列过滤（文言文=初中/高中；英语阅读小学低段不开）；
 *       ②verified='B'（课标名待官方复核）默认不入生产（options/resolve 均不返回）；
 *         🔴 2026-09-20 用户裁定：高中数学那 4 个高中领域（函数/几何与代数/概率与统计/数学建模活动）
 *         原先全标 B → 专项候选为空、只能落回通用专项；按课标补齐专属栏目后**升 A**（下方专项断言）。
 *       ③A档自带栏目结构（数学·计算）→ 结构文本含栏目与锚、不含数字题量占位；
 *       ④无栏目档（数学·应用题…）→ 无栏目，仅锚句；
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

  it('数学学段直列：计算/应用题/几何限义教学段（低小~初中）；高中另给课标五主题中的 4 个领域', () => {
    for (const k of ['primary_low', 'primary_mid', 'primary_high', 'middle']) {
      const vs = specialDomainOptions('数学', k).map((o) => o.value);
      expect(vs).toEqual(expect.arrayContaining(['计算', '应用题', '几何']));
    }
    const high = specialDomainOptions('数学', 'high').map((o) => o.value);
    expect(high).toEqual(['函数', '几何与代数', '概率与统计', '数学建模活动']);
    // 义教三领域（计算/应用题/几何）不得串到高中
    expect(high).not.toEqual(expect.arrayContaining(['计算', '应用题', '几何']));
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

  it("🔴 高中数学 4 领域已升 A（2026-09-20 用户裁定）：候选可见、resolve 可见且**自带专属栏目**", () => {
    // 升 A 前这 4 条标 verified:'B'，而 ALLOW_VERIFIED_B=false → specialDomainOptions('数学','high') 为空，
    // 用户在「专项训练」里"没得选"、只能落回「通用专项」。按课标补齐栏目后转 A。
    // 注：本文件现有条目中已**无** verified:'B'（闸门保留为防御性开关，不再有被它挡住的学科）。
    const opts = specialDomainOptions('数学', 'high');
    expect(opts.map((o) => o.value)).toEqual(['函数', '几何与代数', '概率与统计', '数学建模活动']);
    for (const o of opts) {
      expect(o.label).toBeTruthy();
      expect(o.desc).toBeTruthy();
      expect(o.curriculum).toContain('普通高中'); // 学段体系隔离：高中锚走高中课标名，不混义教名
    }
    const fn = resolveSpecialDomain('数学', 'high', '函数');
    expect(fn).not.toBeNull();
    expect(fn.sections.length).toBeGreaterThan(0); // A 档：自带专属栏目（不是只挂锚句）
    const text = buildSpecialDomainStructureText(fn, 'high');
    expect(text).toContain('📈 函数·高中');
    expect(text).toContain('概念与表示');
    expect(text).toContain('普通高中数学·函数主线');
    expect(text).not.toContain('2022义教数学');
    // 4 个领域的栏目都要齐（缺一个就等于该领域A档退化成只挂锚句）
    for (const key of ['函数', '几何与代数', '概率与统计', '数学建模活动']) {
      expect(resolveSpecialDomain('数学', 'high', key).sections.length, key).toBeGreaterThan(0);
    }
  });

  it("🔴 英语两领域已补专属栏目（2026-09-20 用户裁定）：高中不再退到通用栏目", () => {
    // 补栏前：阅读理解/语法 是 A 档但 sections=null → 选到后走"通用栏目 + 只挂锚句"（与数学放行前同状）
    for (const key of ['阅读理解', '语法']) {
      const d = resolveSpecialDomain('英语', 'high', key);
      expect(d, key).not.toBeNull();
      expect(d.sections.length, key).toBeGreaterThan(0);
      const text = buildSpecialDomainStructureText(d, 'high');
      expect(text).toContain('· 本领域课标语义锚：');
      expect(text).toContain('普通高中英语'); // 补栏不得改动学段隔离：高中锚仍走高中课标名
      expect(text).not.toContain('2022义教英语');
    }
    // 领域是学段共用的（阅读理解 中段起／语法 高小起）→ 义教学段一并拿到栏目，且锚句走义教口径
    const yj = resolveSpecialDomain('英语', 'middle', '阅读理解');
    expect(yj.sections.length).toBeGreaterThan(0);
    const yjText = buildSpecialDomainStructureText(yj, 'middle');
    expect(yjText).toContain('语言技能·理解性技能');
    expect(yjText).not.toContain('普通高中英语');
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
    // 🔒 2026-09-16 少约束 + 课标挂钩：专项 A 档外壳同步为"大类标题（按课标活动类型与素养划分）"
    // 🔒 2026-09-16：专项 A 档外壳同步课标挂钩（按本领域课标要求划分）
    expect(text).toContain('【大类标题（下面各行即本次大类标题；按本领域课标要求划分；🔢 计算·小学高段）】');
    expect(text).not.toContain('栏目框架');
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
