import { describe, it, expect } from 'vitest';
import {
  htmlToLines, splitQuestionBlocks, extractFormulas, detectFormulaDuplicates,
  detectOpeningMetaNarration, guardPaper, guardReportOf,
} from '../../src/utils/paperGuardEngine.js';

describe('paperGuardEngine: 题块切分', () => {
  it('按题号切块、参考答案前截止', () => {
    const html = '<h2>一、基础</h2><p>1. 题一</p><p>2. 题二</p><div class="answer-section"><h2>参考答案</h2><p>1. 答一</p></div>';
    const blocks = splitQuestionBlocks(html);
    expect(blocks.map((b) => b.id)).toEqual([1, 2]);
  });
});

describe('paperGuardEngine: 算式抽取与卷内重复', () => {
  it('抽取 × ÷ 算式并归一', () => {
    expect(extractFormulas('2.4×1.6＝3.84，0.6 ÷ 0.3=2')).toEqual(['2.4×1.6', '0.6÷0.3']);
  });
  it('同算式跨两题 → 命中（2026-09 实测 2.4×1.6 题3/题14）', () => {
    const html = '<p>3. 计算 2.4×1.6。</p><p>4. 另一题 1.2×3。</p><p>14. 展板面积 2.4×1.6。</p>';
    const out = detectFormulaDuplicates(html);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('2.4×1.6');
    expect(out[0]).toContain('题 3、14');
  });
  it('同题内两算式不判卷内重复（比较大小题）', () => {
    const html = '<p>5. (1) 3.6×1.2○3.6 (2) 3.6×0.8○3.6</p><p>6. 其他。</p>';
    expect(detectFormulaDuplicates(html)).toEqual([]);
  });
});

// 🗑 2026-10-16（属主裁定·消噪音·整档删除）：原 `describe('paperGuardEngine: 情境主题集中')`
//   （两条用例：图书角 ≥3 题命中／题量不足 6 不提示）随 `detectTopicRepeat` ＋ `TOPIC_CLUSTERS` **一并删除**——
//   属主原话"整张卷子卷首语中就是情境了、围绕这个情境展开的，出现这些属于正常的"：**采用统一情境时同词多题
//   是设计使然**，该检测必然误报。同款先例＝2026-10-10 属主裁定删"算式重复"档。原用例见 git 历史。

describe('paperGuardEngine: 首段过程自述', () => {
  it('实测句式命中（2026-09-07 产物首行）', () => {
    const html = '<p>已取到本卷所需全部教材原文素材（小数乘除法计算方法等），现依据教材原文与课标术语完成命题。</p><p>一、基础建构</p>';
    const out = detectOpeningMetaNarration(html);
    expect(out).toHaveLength(1);
  });
  it('正常正文首段（题号开头/栏目标题）不误报', () => {
    expect(detectOpeningMetaNarration('<h2>一、基础建构</h2><p>1. 计算 2.4×1.6。</p>')).toEqual([]);
    expect(detectOpeningMetaNarration('<p>1. 图书角要买一批图书，其中一本故事书标价 12 元。</p>')).toEqual([]);
  });
});

describe('paperGuardEngine: guardPaper 集成', () => {
  const corpus = ['把被除数和除数的小数点同时向右移动相同的位数，转化成整数除法进行计算。', '苹果的单价是6.25元/千克。购买1.5千克苹果，要付多少元？'];
  // 🔴 2026-10-10（属主裁定·消噪音）：**"照搬"档已删** ⇒ 与教材参考段重合不再命中（原文作阅读材料本就该引用）。
  it('照搬档已删 → 与参考段重合**不再报**（copyHits/bannedList 空）', () => {
    const html = '<p>1. 计算 0.6÷0.3 时，可以把被除数和除数的小数点同时向右移动相同的位数。</p>';
    const g = guardPaper({ html, corpus });
    expect(g.copyHits).toEqual([]);
    expect(g.bannedList).toEqual([]);
  });
  it('干净正文零命中', () => {
    const html = '<p>1. 图书角买一批新书，每本标价 12.5 元，老师按标价的 9 折付款，实际应付多少元？</p>';
    const g = guardPaper({ html, corpus });
    expect(g.copyHits).toEqual([]);
  });
  it('copy:false（知识归纳型）→ 照搬不比对不报告、无 bannedList；其余检测照常', () => {
    const html = '<p>1. 计算 0.6÷0.3 时，可以把被除数和除数的小数点同时向右移动相同的位数。</p>';
    const g = guardPaper({ html, corpus, copy: false });
    expect(g.copyHits).toEqual([]);
    expect(g.bannedList).toEqual([]);
    expect(g.hits.filter((h) => h.cat !== 'copy')).toBeDefined(); // sanity 等照常跑
  });
  it('类型切片（2026-10-16 更新）：算式重复档、情境集中档**均已删** ⇒ 两档恒空（命题型亦然）', () => {
    // 数学知识总结（内容型）正文含编号条目与重复算式、同主题条目——不是"卷内两题复用"
    const contentLike = '<p>1. 0.6÷0.3 除数是小数，先移动小数点。</p><p>2. 0.6÷0.3 也可看成 6÷3。</p><p>3. 图书馆情境示例一则。</p><p>4. 图书馆情境示例二则。</p><p>5. 图书馆情境示例三则。</p><p>6. 图书馆情境示例四则。</p><p>7. 图书馆情境示例五则。</p>';
    const gContent = guardPaper({ html: contentLike, copy: false });
    expect(gContent.formulaHits).toEqual([]);
    expect(gContent.topicHits).toEqual([]);
    const gExam = guardPaper({ html: contentLike, copy: true });
    expect(gExam.formulaHits).toEqual([]);                 // 🔴 算式重复档已删，命题型也不再报
    // 🗑 2026-10-16（属主裁定·消噪音）：情境集中档**已整档删除** ⇒ 命题型亦恒空（原断言"命题型照常报"已作废）。
    expect(gExam.topicHits).toEqual([]);
  });
});

describe('paperGuardEngine: 报告分节去重', () => {
  it('同文本重复命中只报一次；无拼接残符', () => {
    const paras = guardReportOf([
      { cat: 'copy', text: '「6.25元/千克」（8 字连续命中）' },
      { cat: 'copy', text: '「6.25元/千克」（8 字连续命中）' },
      { cat: 'opening', text: '正文首段出现过程性自述…' },
      { cat: 'formula', text: '算式「2.4×1.6」出现 2 次' },
    ]);
    expect(paras).toHaveLength(3);
    for (const p of paras) {
      expect(p.startsWith('⚠️ 出稿自检·')).toBe(true);
      expect(p.startsWith('；')).toBe(false);
    }
  });
});

// 🔴 2026-10-09（属主实测·误报根治）：**语文**不跑"与教材参考段字面重合（照搬）"档——语文卷以课文为素材
//   （课内阅读材料即课文原文；填空/仿写/按课文内容类题必引课文原句），重合是应然、此档纯噪音。
describe('paperGuardEngine: 语文豁免"字面重合"档（2026-10-09）', () => {
  const corpus = ['小蝌蚪甩着长长的尾巴，快活地游来游去。'];
  const html = '<p>1. 小蝌蚪甩着长长的尾巴，快活地游来游去。</p>';

  it('语文：命中参考段 → **不报** copy（copyHits/bannedList 均空、hits 无 copy）', () => {
    const r = guardPaper({ html, corpus, subject: '语文' });
    expect(r.copyHits).toEqual([]);
    expect(r.bannedList).toEqual([]);
    expect(r.hits.some((h) => h.cat === 'copy')).toBe(false);
  });

  it('（2026-10 更新）照搬档已删 ⇒ 非语文同样不报', () => {
    const r = guardPaper({ html, corpus, subject: '数学' });
    expect(r.copyHits).toEqual([]);
  });
});
