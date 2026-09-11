// 覆盖判定语言/内容口径（2026-09 根治）测试
// ============================================================
// ✅ A9（2026-09-11 清理）：覆盖对账器本体已废除，本文件原「reconcileCoverage 英语场景」用例随之下线；
//    保留的两组仍守生产在用的判定口径（coverageAnchor.wordMatch / coverageProbe.classifyProbe）。
// ------------------------------------------------------------
// 事故：英语课时练正文全覆盖（规则/不规则过去式、First/Then/Finally 叙事结构、Mulan、ee 发音、
//       鼓励语 Keep trying 等），但覆盖对账 9 个考点全部报"未呈现"。根因：
//       ① 分析阶段强制"所有输出字段中文"（含 specificConcepts 判定词）→ 锚词为中文；
//       ② wordMatch 大小写敏感（英文正文句首大写 Watched vs 锚 watched 漏配）；
//       ③ 行为/语用承载考点（鼓励他人表达等）未归章级聚合 → 逐条中文精确报缺。
// 修复：specificConcepts 保留教材原文语言；wordMatch 拉丁大小写折叠；BEHAVIOR_TERMS 收录外语语用词。
// ============================================================
import { describe, it, expect } from 'vitest';
import { wordMatch } from '../../src/utils/coverageAnchor.js';
import { classifyProbe } from '../../src/utils/coverageProbe.js';

describe('wordMatch 语言口径（拉丁大小写折叠）', () => {
  it('英文正文句首大写 → 小写锚词命中', () => {
    expect(wordMatch('Watched is the past tense of watch.', 'watched')).toBe(true);
    expect(wordMatch('Mulan took her father\'s place in the army.', 'mulan')).toBe(true);
  });
  it('中文不受影响；无命中返回 false', () => {
    expect(wordMatch('规则动词过去式直接加 -ed。', '规则动词过去式')).toBe(true);
    expect(wordMatch('Last week she practised.', 'keep trying')).toBe(false);
  });
  it('短英文锚词（ee/ago）词边界命中不误伤', () => {
    expect(wordMatch('字母组合 ee 发 /iː/。', 'ee')).toBe(true);
    expect(wordMatch('I saw her two weeks ago.', 'ago')).toBe(true);
  });
});

describe('classifyProbe 英语语用行为考点归章级（内容口径）', () => {
  const chapterNames = [
    '鼓励他人的表达',       // 表达
    '用一般过去时进行叙事',  // 时态
    '面对困难的表达与求助',  // 表达
    '阅读策略与语篇理解',    // 语篇
    '仿照句式写话',          // 句式/写话
  ];
  for (const n of chapterNames) {
    it(`「${n}」→ chapter（正文以英文语句呈现，不逐字出中文考点名）`, () => {
      expect(classifyProbe(n), n).toBe('chapter');
    });
  }
  const literalNames = [
    '字母组合 ee 的发音',    // 无行为词 → literal，靠 specificConcepts（ee /iː/）词面命中
    '规则动词过去式',        // literal 概念；正文以 watched 等原文词承载（specificConcepts）
    '花木兰文化知识',        // literal 文化专名（不误放行为章级——历史"xx文化"须精确）
    '细胞的结构',            // 理科精确概念不被新词放行
    '安史之乱',
  ];
  for (const n of literalNames) {
    it(`「${n}」→ literal（概念专名须词面/原文词命中）`, () => {
      expect(classifyProbe(n), n).toBe('literal');
    });
  }
});

