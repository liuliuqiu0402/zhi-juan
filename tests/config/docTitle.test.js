/**
 * 资料标题命名 · 类型门控守卫（2026-10-30 属主实证）
 * ============================================================
 * 属主实证：知识点总结里出现了「2026-2027学年度第一学期六年级语文期末质量检测」——那是**考试型**标题。
 * 原设计（572ef24 / 90b5929 / b3eedeb）：
 *   · 普通型（课/单元范围）＝ 年级 + 学科 + 册别 + 范围名 + 类型名
 *   · 考试型（期中/期末/月考/专题/升学卷别）＝ 学年度学期 + 年级 + 学科 + 范围标签词（**只属于正式考卷**）
 * 本守卫锁死：①考试型标题只有 exam 能拼；②教辅跨单元推断出的卷名不得进标题；
 * ③教辅显式选"期末"时用维度词（期末）而不是卷名（期末质量检测）。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { composeDocTitle, inferPaperScope, resolveScopeName } from '../../src/config/paperScope.js';
import { genTypeOptions } from '../../src/config/expertKnowledge.js';

const SEMESTER = '上册';
const base = {
  grade: '六年级',
  subject: '语文',
  semester: SEMESTER,
  academic: '2026-2027学年度第一学期',
  pickLabel: () => '知识梳理',
  getPool: () => ['知识梳理', '学习总结'],
};

const labelScopeFinal = { name: '期末质量检测', isScopeLabel: true, category: 'final' };
const labelScopeInferred = { name: '综合检测', isScopeLabel: true, category: 'default' };
const unitScope = { name: '第二单元', isScopeLabel: false, category: 'unit' };

describe('资料标题 · 考试型标题只属于正式考卷', () => {
  it('知识点总结 + 用户选"期末" ⇒ 普通型标题（维度词当范围名，不带学年度/不带卷名）', () => {
    const { title } = composeDocTitle({ ...base, genType: 'summary', scopeInfo: labelScopeFinal, scopeType: 'final' });
    expect(title).toBe('六年级语文上册期末知识梳理');
    expect(title).not.toContain('学年度');
    expect(title).not.toContain('质量检测');
  });

  // 🔴 2026-10-30（属主："选了单元了，没跨怎么名称里不含单元了？原先的设计是取父级的吧？没有父级就都写的吧？"）：
  //   原设计＝取父级（单元名）；没有父级（跨单元）就把所选单元**都写上**——不是把范围整段丢掉。
  it('知识点总结 + 跨单元 ⇒ 把所选单元都写上（不是丢掉范围）', () => {
    const { title } = composeDocTitle({
      ...base, genType: 'summary', scopeType: '',
      scopeInfo: { ...labelScopeInferred, units: ['第一单元', '第二单元'] },
    });
    expect(title).toBe('六年级语文上册第一单元、第二单元知识梳理');
    expect(title).not.toMatch(/综合检测|期末|期中/);
  });

  it('跨 3 个以上单元 ⇒ 首尾相接（第一单元至第四单元）', () => {
    const { title } = composeDocTitle({
      ...base, genType: 'summary', scopeType: '',
      scopeInfo: { ...labelScopeInferred, units: ['第一单元', '第二单元', '第三单元', '第四单元'] },
    });
    expect(title).toBe('六年级语文上册第一单元至第四单元知识梳理');
  });

  it('整单元（有父级）⇒ 用父级单元名', () => {
    const { title, scopeName } = composeDocTitle({ ...base, genType: 'summary', scopeType: '', scopeInfo: unitScope });
    expect(scopeName).toBe('第二单元');
    expect(title).toBe('六年级语文上册第二单元知识梳理');
  });

  it('全 9 类非试卷资料都不得拼出考试型标题（含显式期末）', () => {
    for (const { value } of genTypeOptions.filter((o) => o.value !== 'exam')) {
      const { title } = composeDocTitle({ ...base, genType: value, scopeInfo: labelScopeFinal, scopeType: 'final' });
      expect(title, `${value} 不得带学年度学期`).not.toContain('学年度');
      expect(title, `${value} 不得出现卷名`).not.toContain('质量检测');
    }
  });

  it('正式考卷 + 期末 ⇒ 考试型标题（与属主看到的那一声明一致）', () => {
    const { title } = composeDocTitle({ ...base, genType: 'exam', scopeInfo: labelScopeFinal, scopeType: 'final', pickLabel: () => '期末质量检测' });
    expect(title).toBe('2026-2027学年度第一学期六年级语文期末质量检测');
  });

  it('正式考卷 + 单单元 ⇒ 普通型标题（年级+学科+册别+范围名+类型名）', () => {
    const { title } = composeDocTitle({ ...base, genType: 'exam', scopeInfo: unitScope, scopeType: '', pickLabel: () => '综合检测' });
    expect(title).toBe('六年级语文上册第二单元综合检测');
  });

  // 🔴 2026-10-30（属主："试卷，如果跨单元的，用户没有选择月考/期中/期末的，就都写，如果选择了，按选择的来"）
  it('正式考卷 + 跨单元但**没选**期中/期末 ⇒ 不拼考试型，范围都写 + 类型名', () => {
    const { title } = composeDocTitle({
      ...base, genType: 'exam', scopeType: '', pickLabel: () => '综合检测',
      scopeInfo: { ...labelScopeInferred, units: ['第一单元', '第二单元'] },
    });
    expect(title).toBe('六年级语文上册第一单元、第二单元综合检测');
    expect(title).not.toContain('学年度');
  });

  it('资料类型用显示名（历史/生成记录里存的是『📖 知识总结』）时，与 key 结果一致', () => {
    const key = composeDocTitle({ ...base, genType: 'summary', scopeInfo: labelScopeFinal, scopeType: 'final' }).title;
    const named = composeDocTitle({ ...base, genType: '📖 知识总结', scopeInfo: labelScopeFinal, scopeType: 'final' }).title;
    expect(named).toBe(key);
  });

  it('名称样式（用户固定选择）在教辅普通型标题里优先生效', () => {
    const { title } = composeDocTitle({ ...base, genType: 'summary', scopeInfo: labelScopeFinal, scopeType: 'final', labelStyle: '知识归纳' });
    expect(title).toBe('六年级语文上册期末知识归纳');
  });

  it('返回的 scopeName / typeLabel 与标题一致（指令侧共用同一份，不会两处漂移）', () => {
    const r = composeDocTitle({ ...base, genType: 'summary', scopeInfo: labelScopeFinal, scopeType: 'final' });
    expect(r.scopeName).toBe('期末');
    expect(r.typeLabel).toBe('知识梳理');
    expect(r.isExam).toBe(false);
    const e = composeDocTitle({ ...base, genType: 'exam', scopeInfo: labelScopeFinal, scopeType: 'final' });
    expect(e.isLabelScope).toBe(true);
    expect(e.semesterUsed).toBe('');
    expect(e.academic).toContain('学年度');
  });
});

// 端到端：真实目录结构（单元→课）→ 范围推断 → 标题
describe('资料标题 · 单元范围取数（取父级 / 无父级就都写）', () => {
  const u = (t, lessons) => ({ title: t, children: lessons.map((x) => ({ title: x })) });
  const outline = [
    u('第一单元', ['1 草原', '2 丁香结']),
    u('第二单元', ['5 七律·长征', '6 狼牙山五壮士']),
    u('第三单元', ['9 竹节人']),
    u('第四单元', ['12 桥']),
  ];
  const book = { outline, grade: '六年级', subject: '语文', semester: '上册' };
  const titleOf = (chapters, scopeType = '') => composeDocTitle({
    ...base, genType: 'summary', scopeType,
    scopeInfo: resolveScopeName({ book: { ...book, selectedChapters: chapters }, scopeType }),
  }).title;

  it('整单元（2 课）⇒ 父级单元名进标题', () => {
    const u2 = outline[1];
    expect(inferPaperScope(u2.children, outline).name).toBe('第二单元');
    expect(titleOf(u2.children)).toBe('六年级语文上册第二单元知识梳理');
  });

  it('单课 ⇒ 课名进标题', () => {
    expect(titleOf([outline[1].children[0]])).toBe('六年级语文上册5 七律·长征知识梳理');
  });

  it('跨两单元 ⇒ 两个单元都写上', () => {
    const chapters = [...outline[0].children, ...outline[1].children];
    expect(inferPaperScope(chapters, outline).units).toEqual(['第一单元', '第二单元']);
    expect(titleOf(chapters)).toBe('六年级语文上册第一单元、第二单元知识梳理');
  });

  it('跨四单元 ⇒ 首尾相接', () => {
    const chapters = outline.flatMap((x) => x.children);
    expect(titleOf(chapters)).toBe('六年级语文上册第一单元至第四单元知识梳理');
  });
});

// 🔴 2026-10-30（属主："教材库里的教材导入的还是挺全的，你要先看目录树关系吗？"）：
//   范围名规则必须**认结构不认学科**：书根/单元/课、章/节、Unit/Section、扁平课 都要对。
describe('资料标题 · 各学科目录树形态都适用（认结构，不认学科名）', () => {
  const titleOf = (outline, chapters, { genType = 'summary', subject = '语文', grade = '六年级', semester = '上册', scopeType = '' } = {}) => composeDocTitle({
    ...base, genType, scopeType, subject, grade, semester,
    scopeInfo: resolveScopeName({ book: { outline, grade, subject, semester, selectedChapters: chapters }, scopeType }),
  }).title;
  const unit = (t, kids) => ({ title: t, children: kids.map((x) => ({ title: x })) });

  it('书（册）→单元→课（顶层是书）⇒ 仍取单元，不会拿书名当单元', () => {
    const outline = [{
      title: '六年级上册',
      children: [
        unit('第一单元', ['1 草原', '2 丁香结']),
        unit('第二单元', ['5 七律·长征', '6 狼牙山五壮士']),
        unit('第三单元', ['9 竹节人']),
      ],
    }];
    const all = outline[0].children;
    // 整单元：取父级单元
    expect(titleOf(outline, all[1].children)).toBe('六年级语文上册第二单元知识梳理');
    // 跨单元：都写（不会出"六年级上册、六年级上册"或书名）
    expect(titleOf(outline, [...all[0].children, ...all[1].children]))
      .toBe('六年级语文上册第一单元、第二单元知识梳理');
  });

  it('数学：第一章→小节 ⇒ 整章取章名，跨三章首尾相接', () => {
    const outline = [
      unit('第一章 有理数', ['1.1 正数和负数', '1.2 有理数']),
      unit('第二章 整式的加减', ['2.1 整式']),
      unit('第三章 一元一次方程', ['3.1 从算式到方程']),
    ];
    expect(titleOf(outline, outline[0].children, { subject: '数学', grade: '七年级' }))
      .toBe('七年级数学上册第一章 有理数知识梳理');
    expect(titleOf(outline, outline.flatMap((u) => u.children), { subject: '数学', grade: '七年级' }))
      .toBe('七年级数学上册第一章至第三章知识梳理');
  });

  it('英语：Unit→Section ⇒ 整单元取 Unit 名，跨三单元首尾相接', () => {
    const outline = [
      unit('Unit 1 Where did you go on vacation?', ['Section A', 'Section B']),
      unit('Unit 2 How often do you exercise?', ['Section A', 'Section B']),
      unit('Unit 3 I am more outgoing than my sister', ['Section A', 'Section B']),
    ];
    expect(titleOf(outline, outline[0].children, { subject: '英语', grade: '八年级' }))
      .toBe('八年级英语上册Unit 1 Where did you go on vacation?知识梳理');
    expect(titleOf(outline, outline.flatMap((u) => u.children), { subject: '英语', grade: '八年级' }))
      .toBe('八年级英语上册Unit 1至Unit 3知识梳理');
  });

  it('扁平目录（顶层直接是课）⇒ 直接用课名，不硬造单元名', () => {
    const outline = [{ title: '篮球运球' }, { title: '足球脚内侧传球' }, { title: '耐久跑' }];
    expect(titleOf(outline, [outline[0]], { subject: '体育', grade: '七年级' }))
      .toBe('七年级体育上册篮球运球知识梳理');
    expect(titleOf(outline, [outline[0], outline[1]], { subject: '体育', grade: '七年级' }))
      .toBe('七年级体育上册篮球运球、足球脚内侧传球知识梳理');
  });

  it('试卷同样适用：跨单元未选期中/期末 ⇒ 都写；选了 ⇒ 考试型', () => {
    const outline = [
      unit('第一单元', ['1 草原']),
      unit('第二单元', ['5 七律·长征']),
      unit('第三单元', ['9 竹节人']),
    ];
    const chapters = outline.flatMap((u) => u.children);
    const plain = composeDocTitle({
      ...base, genType: 'exam', scopeType: '', pickLabel: () => '综合检测',
      scopeInfo: resolveScopeName({ book: { outline, grade: '六年级', subject: '语文', semester: '上册', selectedChapters: chapters } }),
    }).title;
    expect(plain).toBe('六年级语文上册第一单元至第三单元综合检测');
    expect(plain).not.toContain('学年度');

    const examined = composeDocTitle({
      ...base, genType: 'exam', scopeType: 'final', pickLabel: () => '期末质量检测',
      scopeInfo: resolveScopeName({ book: { outline, grade: '六年级', subject: '语文', semester: '上册', selectedChapters: chapters }, scopeType: 'final', pickScope: () => '期末质量检测' }),
    }).title;
    expect(examined).toBe('2026-2027学年度第一学期六年级语文期末质量检测');
  });
});
