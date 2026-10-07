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
  SPECIAL_DOMAIN_MAX,
  resolveSpecialDomains,
  buildSpecialDomainsStructureText,
  buildSpecialDomainsAnchorLines,
} from '../../src/config/specialDomains.js';

describe('specialDomains（三维度两档化：学科×学段×领域）', () => {
  it('语文学段直列：文言文仅 初中/高中；现代文阅读/古诗词/写作全学段', () => {
    // 🔵 2026-10-07 S3·语文：按现实通行名「阅读理解」→「现代文阅读」（多家教辅一致，先解后锁）
    const low = specialDomainOptions('语文', 'primary_low').map((o) => o.value);
    expect(low).toEqual(expect.arrayContaining(['现代文阅读', '古诗词', '写作']));
    expect(low).not.toContain('文言文');
    const mid = specialDomainOptions('语文', 'middle').map((o) => o.value);
    expect(mid).toContain('文言文');
    expect(specialDomainOptions('语文', 'high').map((o) => o.value)).toContain('文言文');
  });

  it('语文 S3 新增域：低段给全（仅英语低段不开）', () => {
    // 🔵 2026-10-07 属主明确：「低段不涉」**仅指英语**；语文低段按课标该给的要给 —— 先解后锁
    const low = specialDomainOptions('语文', 'primary_low').map((o) => o.value);
    for (const k of ['识字与写字', '梳理与探究', '整本书阅读', '名篇名句默写']) expect(low, k).toContain(k);
    expect(low).not.toContain('语言文字运用'); // 该名取自高中课标任务群；低段由 识字与写字/梳理与探究 承接
    expect(low).not.toContain('文言文');
    const high = specialDomainOptions('语文', 'high').map((o) => o.value);
    for (const k of ['语言文字运用', '名篇名句默写', '整本书阅读']) expect(high, k).toContain(k);
    // 高中现代文阅读栏目取新高考二分（旧体系三分作 note 兼容）
    const secs = resolveSpecialDomain('语文', 'high', '现代文阅读').sections.map((s) => s.name);
    expect(secs).toContain('信息类文本阅读');
    expect(secs).toContain('文学类文本阅读');
  });


  it('数学学段直列：计算/应用题/图形与几何限义教学段＋义教另两领域；高中按知识模块 7 条', () => {
    // 🔵 2026-10-07 S3·数学：①「几何」按课标原文改「图形与几何」；②义教补 统计与概率/综合与实践（中段起）；
    //   ③高中由课标四主题改按**知识模块 7 条**（现实多家教辅一致，属主已点头）——先解后锁。
    for (const k of ['primary_low', 'primary_mid', 'primary_high', 'middle']) {
      const vs = specialDomainOptions('数学', k).map((o) => o.value);
      expect(vs).toEqual(expect.arrayContaining(['计算', '应用题', '图形与几何']));
    }
    for (const k of ['primary_low', 'primary_mid', 'primary_high', 'middle']) {
      const vs = specialDomainOptions('数学', k).map((o) => o.value);
      expect(vs).toEqual(expect.arrayContaining(['统计与概率', '综合与实践']));
    }
    // 🔵 2026-10-07 更正：低段**只有英语不开**（属主明确）⇒ 数学低段照开（课标第一学段：数据分类／主题活动）
    const low = specialDomainOptions('数学', 'primary_low').map((o) => o.value);
    expect(low).toContain('统计与概率');
    expect(low).toContain('综合与实践');
    const high = specialDomainOptions('数学', 'high').map((o) => o.value);
    expect(high).toEqual(['函数与导数', '三角函数', '数列', '立体几何', '解析几何', '概率与统计', '数学建模活动']);
    // 义教领域不得串到高中
    expect(high).not.toEqual(expect.arrayContaining(['计算', '应用题', '图形与几何', '统计与概率', '综合与实践']));
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

  it("🔴 高中数学 7 知识模块（原 4 条已升 A·2026-09-20 裁定，2026-10-07 S3 改按知识模块）：候选可见且**自带专属栏目**", () => {
    const opts = specialDomainOptions('数学', 'high');
    expect(opts.map((o) => o.value)).toEqual(['函数与导数', '三角函数', '数列', '立体几何', '解析几何', '概率与统计', '数学建模活动']);
    for (const o of opts) {
      expect(o.label).toBeTruthy();
      expect(o.desc).toBeTruthy();
      expect(o.curriculum).toContain('普通高中'); // 学段体系隔离：高中锚走高中课标名，不混义教名
    }
    const fn = resolveSpecialDomain('数学', 'high', '函数与导数');
    expect(fn).not.toBeNull();
    expect(fn.sections.length).toBeGreaterThan(0); // A 档：自带专属栏目（不是只挂锚句）
    const text = buildSpecialDomainStructureText(fn, 'high');
    expect(text).toContain('📈 函数与导数·高中');
    expect(text).toContain('概念与表示');
    expect(text).toContain('普通高中数学·函数主线');
    expect(text).not.toContain('2022义教数学');
    // 7 个模块的栏目都要齐（缺一个就等于该领域A档退化成只挂锚句）
    for (const key of ['函数与导数', '三角函数', '数列', '立体几何', '解析几何', '概率与统计', '数学建模活动']) {
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
    // 2026-10-07 A5 起物理已收录 ⇒ 本断言改用**未收录学科名**（保留"未收录→空清单"的原意）
    expect(specialDomainOptions('未知学科', 'middle')).toEqual([]);
    expect(specialDomainOptions('数学', '')).toEqual([]);
    expect(resolveSpecialDomain('', 'primary_high', '计算')).toBeNull();
  });

  it('🔴 物理（2026-10-07 A5·其余12学科领域层·试点）：义教=课标五主题（仅初中）；高中=模块主题原义归组', () => {
    // 义教物理是初中科目（小学无物理）⇒ 小学段空清单、走通用兜底；同样口径见 eduRenderContract「小学无物理」
    expect(specialDomainOptions('物理', 'primary_low')).toEqual([]);
    expect(specialDomainOptions('物理', 'middle').map((o) => o.value)).toEqual([
      '物质', '运动和相互作用', '能量', '实验探究', '跨学科实践',
    ]);
    const high = specialDomainOptions('物理', 'high').map((o) => o.value);
    expect(high).toEqual(['力学', '电磁学', '热学', '光学', '近代物理', '物理实验']);
    // 学段体系隔离：义教五主题不串到高中、高中板块不串到初中
    expect(high).not.toEqual(expect.arrayContaining(['物质', '能量']));
    expect(specialDomainOptions('物理', 'middle').map((o) => o.value)).not.toContain('力学');
    // 锚句走各自学段课标名
    for (const o of specialDomainOptions('物理', 'middle')) expect(o.curriculum).toContain('2022义教物理');
    for (const o of specialDomainOptions('物理', 'high')) expect(o.curriculum).toContain('普通高中物理');
    // A 档：每个领域都要**自带专属栏目**（缺一个就等于该领域退化成只挂锚句）
    for (const key of ['物质', '运动和相互作用', '能量', '实验探究', '跨学科实践']) {
      const d = resolveSpecialDomain('物理', 'middle', key);
      expect(d, key).not.toBeNull();
      expect(d.sections.length, key).toBeGreaterThan(0);
    }
    for (const key of ['力学', '电磁学', '热学', '光学', '近代物理', '物理实验']) {
      const d = resolveSpecialDomain('物理', 'high', key);
      expect(d, key).not.toBeNull();
      expect(d.sections.length, key).toBeGreaterThan(0);
    }
    // 结构文本含领域名·学段名 与 课标语义锚（且不混学段名）
    const t = buildSpecialDomainStructureText(resolveSpecialDomain('物理', 'middle', '能量'), 'middle');
    expect(t).toContain('能量·初中');
    expect(t).toContain('2022义教物理');
    expect(t).not.toContain('普通高中物理');
    const th = buildSpecialDomainStructureText(resolveSpecialDomain('物理', 'high', '电磁学'), 'high');
    expect(th).toContain('电磁学·高中');
    expect(th).toContain('普通高中物理');
    expect(th).not.toContain('2022义教物理');
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

  it('通用说明与真实生效蓝图一致（现有名池＝基础巩固／典型例题解析；无旧四段文案）', () => {
    // 🔴 2026-10-07 先解后锁：原断言锁的是旧名"分板块组织"；（74）已把名池改名，本说明同步改名 ⇒ 断言随改。
    expect(GENERIC_SPECIAL_DESC).toContain('基础巩固');
    expect(GENERIC_SPECIAL_DESC).toContain('典型例题解析');
    expect(GENERIC_SPECIAL_DESC).not.toContain('分板块组织');
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
    // 🔵 2026-10-07 S3·数学：键名「几何」→「图形与几何」（课标原文）——先解后锁
    const primaryGeo = resolveSpecialDomain('数学', 'primary_high', '图形与几何').anchor;
    expect(primaryGeo).toContain('图形的认识与测量');
    const middleGeo = resolveSpecialDomain('数学', 'middle', '图形与几何').anchor;
    expect(middleGeo).toContain('图形的性质');
    expect(middleGeo).not.toContain('位置与运动');
  });

  it('S2 多选合成单源：上限 1–3、按所选顺序、并集去重、逐领域锚行', () => {
    expect(SPECIAL_DOMAIN_MAX).toBe(3);
    // 超限截断（选 4 个 → 只取前 3，保序）
    const four = resolveSpecialDomains('物理', 'middle', ['能量', '物质', '实验探究', '跨学科实践']);
    expect(four.map((d) => d.key)).toEqual(['能量', '物质', '实验探究']);
    // 未命中/空值过滤；单选亦可（向后兼容旧单选口径）
    expect(resolveSpecialDomains('物理', 'middle', ['不存在', '能量']).map((d) => d.key)).toEqual(['能量']);
    expect(resolveSpecialDomains('物理', 'middle', [])).toEqual([]);
    expect(resolveSpecialDomains('物理', 'middle', '能量').map((d) => d.key)).toEqual(['能量']);
    // 学段/学科不匹配即拒（沿用 resolveSpecialDomain 的三元校验）
    expect(resolveSpecialDomains('物理', 'primary_low', ['能量'])).toEqual([]);
    // A 档结构文本：领域名相联 ＋ 逐领域一行锚
    const doms = resolveSpecialDomains('物理', 'middle', ['能量', '物质']);
    const t = buildSpecialDomainsStructureText(doms, 'middle');
    expect(t).toContain('能量');
    expect(t).toContain('物质');
    expect(t).toContain('初中');
    expect((t.match(/课标语义锚/g) || []).length).toBe(2);
    // 并集去重：两领域同名栏目只出现一次
    const dup = [
      { label: '甲', anchor: 'a', sections: [{ name: '同名栏', note: 'x' }] },
      { label: '乙', anchor: 'b', sections: [{ name: '同名栏', note: 'y' }] },
    ];
    expect((buildSpecialDomainsStructureText(dup, 'middle').match(/· 同名栏——/g) || []).length).toBe(1);
    // 锚行（B 档 / A·B 混选时的锚句部分）
    expect(buildSpecialDomainsAnchorLines(doms).split('\n').length).toBe(2);
    expect(buildSpecialDomainsAnchorLines([])).toBe('');
  });
});
