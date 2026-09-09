// 防照搬护栏单测（底线线 O5：正文与参考段字面命中检测——只报不改、程序不做语义雷同判定）
import { describe, it, expect } from 'vitest';
import { scanCopyOverlap, copyOverlapNote } from '../../src/utils/antiCopyGuard.js';

describe('防照搬护栏（底线线 O5）', () => {
  const corpus = [
    '除数是小数的除法：把被除数与除数的小数点同时向右移动相同的位数，使除数变成整数再计算。',
    '一种花生每千克 4.8 元，买 2.5 千克需要多少元？',
  ];

  it('正文含参考段连续 ≥8 字 → 命中 long 提示', () => {
    const body = '<p>把被除数与除数的小数点同时向右移动相同的位数，商不变，这就是除数是小数的除法法则。</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].kind).toBe('long');
    expect(hits[0].n).toBeGreaterThanOrEqual(8);
  });

  it('同串 3 个连续数字命中 → num 提示（照搬教材数字）', () => {
    const numCorpus = ['李阿姨买了 356 千克大米，共付 1020 元。'];
    const body = '<p>叔叔买了 356 千克大米，一共要付多少元？</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus: numCorpus });
    expect(hits.some((h) => h.kind === 'num' && h.snippet === '356')).toBe(true);
  });

  it('情境/数据改编后（非整句重合）不误报', () => {
    const body = '<p>一袋大米每千克 5.2 元，妈妈买了 3 千克，一共多少元？</p>'; // 数字不同、句子改写
    const hits = scanCopyOverlap({ bodyHtml: body, corpus });
    expect(hits).toEqual([]);
  });

  it('纯形态差异（标签/空白）不影响命中判定；无 corpus 时不抛错', () => {
    const body = '<h2>计算</h2><p>把被除数与除数的小数点同时向右移动相同的位数，再计算。</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus });
    expect(hits.length).toBeGreaterThan(0);
    expect(scanCopyOverlap({ bodyHtml: body, corpus: [] })).toEqual([]);
    expect(scanCopyOverlap({ bodyHtml: '', corpus })).toEqual([]);
  });

  it('copyOverlapNote：命中汇总为提示语（只报不改），空命中返回空串', () => {
    const hits = scanCopyOverlap({ bodyHtml: '<p>把被除数与除数的小数点同时向右移动相同的位数。</p>', corpus });
    const note = copyOverlapNote(hits);
    expect(note).toContain('防照搬');
    expect(note).toContain('交编辑核对');
    expect(copyOverlapNote([])).toBe('');
  });

  // ── 2026-09 收口：边界标点剥除后按白名单豁免 / 分数成分数字不报 / 长数字串仍报 ──
  it('片段首尾被标点卷边（"？（得数保留两位"）→ 剥边后命中白名单术语 → 不报照搬', () => {
    const c = ['例 2：每千克苹果 4.85 元，买 2.6 千克应付多少元？（得数保留两位小数）'];
    // 题干仅与教材句共享"规范性术语带括号"片段，其余句式自拟 → 整串应豁免、零命中
    const body = '<p>买 2.6 千克苹果。（得数保留两位小数）</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus: c, subject: '数学' });
    expect(hits.length).toBe(0);
  });

  it('分数成分数字（30/100 → "100"）不报 num（算式自身无语义照搬）', () => {
    const c = ['0.6×0.5＝6/10×5/10＝30/100＝0.3'];
    const body = '<p>＝30/100</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus: c, subject: '数学' });
    expect(hits.filter((h) => h.kind === 'num').length).toBe(0);
  });

  it('≥4 位数字串（无限小数示例常数）仍报 num', () => {
    const c = ['示例：1.010010001 是一个无限不循环小数。'];
    const body = '<p>下面哪个是无限不循环小数？1.010010001</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus: c, subject: '数学' });
    expect(hits.some((h) => h.kind === 'num' && h.snippet.length >= 4)).toBe(true);
  });
  it('英文行按词级判定（2026-09）：功能句/单元名/单词不因 8 字符连续被误报为照搬', () => {
    // 教材参考段含本课功能句与单元名；正文教学必现（鼓励语/标题/目标词）——均不足 10 词 → 英文整句照搬档不触发
    const corpus = ['Unit 1 Try your best', 'You can do it! Keep trying! Have a go!', 'We should practise speaking English every day.'];
    const body = '<p>Unit 1 Try your best</p><p>You can do it! Keep trying!</p><p>practise 的过去式是 practised。</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus, subject: '英语' });
    expect(hits.filter((h) => h.kind === 'long')).toEqual([]);
  });
  it('英文行真实整句照搬（≥10 词连续）仍报', () => {
    const corpus = ['Never give up and you will succeed in the end.'];
    const body = '<p>Never give up and you will succeed in the end.</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus, subject: '英语' });
    expect(hits.some((h) => h.kind === 'long')).toBe(true);
  });
  it('连词成句乱序词库豁免（2026-09）：答案重构教材句是题型所需，不报照搬', () => {
    // 题面是乱序单词语库，期望答案把教材句逐个还原 → 命中词窗全部落在词库内 → 豁免
    const corpus = ['But then he remembered them at last.'];
    // 连词成句题面（裸词乱序行）+ 答案（重构教材句）
    const body = '<p>连词成句：words he the forgot first but remembered then them</p><p>答案：But then he remembered them.</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus, subject: '英语' });
    expect(hits.filter((h) => h.kind === 'long')).toEqual([]);
  });
  it('连词成句豁免只放行词库内单词：独立整句照搬（词不在词库）仍报', () => {
    const corpus = ['She cooked a delicious dinner for her family after coming home from school.'];
    // 正文另有一段完整照搬教材整句（≥10 词，非连词成句），且乱序词库单词与其不重合 → 不受豁免，仍报
    const body = '<p>连词成句：wanted to join the English club yesterday</p><p>She cooked a delicious dinner for her family after coming home from school last night.</p>';
    const hits = scanCopyOverlap({ bodyHtml: body, corpus, subject: '英语' });
    expect(hits.filter((h) => h.kind === 'long')).not.toEqual([]);
  });
});
