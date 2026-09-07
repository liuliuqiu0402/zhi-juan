import { describe, it, expect } from 'vitest';
import {
  htmlToLines, splitQuestionBlocks, extractFormulas, detectFormulaDuplicates,
  detectTopicRepeat, detectOpeningMetaNarration, guardPaper, guardReportOf,
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

describe('paperGuardEngine: 情境主题集中', () => {
  it('图书角主题 ≥3 题 → 命中并列出题号', () => {
    const html = '<p>1. 图书角买故事书 12 本。</p><p>2. 图书角科普书 8 本。</p><p>3. 图书角绘本 15 本。</p><p>4. 别的题甲。</p><p>5. 别的题乙。</p><p>6. 别的题丙。</p>';
    const out = detectTopicRepeat(html);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('题 1、2、3');
  });
  it('题量不足 6 不提示（防小题卷误报）', () => {
    const html = '<p>1. 图书角。</p><p>2. 图书角。</p><p>3. 图书角。</p>';
    expect(detectTopicRepeat(html)).toEqual([]);
  });
});

describe('paperGuardEngine: 首段过程自述', () => {
  it('实测句式命中（2026-09-07 产物首行）', () => {
    const html = '<p>已取到本卷所需全部教材原文素材（小数乘除法计算方法等），现依据教材原文与课标术语完成命题。</p><p>一、基础建构任务</p>';
    const out = detectOpeningMetaNarration(html);
    expect(out).toHaveLength(1);
  });
  it('正常正文首段（题号开头/栏目标题）不误报', () => {
    expect(detectOpeningMetaNarration('<h2>一、基础建构任务</h2><p>1. 计算 2.4×1.6。</p>')).toEqual([]);
    expect(detectOpeningMetaNarration('<p>1. 图书角要买一批图书，其中一本故事书标价 12 元。</p>')).toEqual([]);
  });
});

describe('paperGuardEngine: guardPaper 集成', () => {
  const corpus = ['把被除数和除数的小数点同时向右移动相同的位数，转化成整数除法进行计算。', '苹果的单价是6.25元/千克。购买1.5千克苹果，要付多少元？'];
  it('照搬命中 → hits + bannedList（程序不改内容）', () => {
    const html = '<p>1. 计算 0.6÷0.3 时，可以把被除数和除数的小数点同时向右移动相同的位数。</p>';
    const g = guardPaper({ html, corpus });
    expect(g.copyHits.length).toBeGreaterThan(0);
    expect(g.bannedList.length).toBeGreaterThan(0);
    expect(g.hits[0].cat).toBe('copy');
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
      expect(p.startsWith('⚠️ 卷面自检·')).toBe(true);
      expect(p.startsWith('；')).toBe(false);
    }
  });
});
