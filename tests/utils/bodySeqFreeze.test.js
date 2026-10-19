// 正文冻结比对·归因（2026-10-19 属主："正文被删了吧？明显少于答案的"）
// ============================================================
// 背景：原判据只看"答案生成前后题号集合变没变"——分不清
//   ① 真删内容；② 题号不再落在行首（并段/换形态；2026-10-16 实证 30→25 属后者）。
// 现 classifyBodySeqChange 同时看：缺失号在正文任何位置是否还在 ＋ 正文字符数增删。
//   · lost → 进【问题列表】并写明"内容被删"＋缺号＋字数变化；
//   · form → 只 console.debug，不误报。
import { describe, it, expect } from 'vitest';
import { classifyBodySeqChange } from '../../src/utils/contentCleaner.js';

const seq = (n) => Array.from({ length: n }, (_, i) => i + 1);

describe('正文题号冻结比对：内容被删 vs 题号换形态', () => {
  it('缺号仍在正文里（只是不在行首）且字数没明显缩水 → form（不告警）', () => {
    const bodyText = '28. 第28题题干 29. 第29题题干 30. 第30题题干 31. 第31题题干 32. 第32题题干';
    const cls = classifyBodySeqChange({
      snapshot: seq(32), finalSeq: seq(27), bodyText, lenBefore: 2000, lenAfter: 1996,
    });
    expect(cls.kind).toBe('form');
    expect(cls.missing).toEqual([28, 29, 30, 31, 32]);
  });

  it('缺号在正文任何位置都找不到 → lost（内容被删）', () => {
    const bodyText = '1. 一 2. 二 … 27. 二十七';
    const cls = classifyBodySeqChange({
      snapshot: seq(32), finalSeq: seq(27), bodyText, lenBefore: 2000, lenAfter: 1600,
    });
    expect(cls.kind).toBe('lost');
    expect(cls.lost).toEqual([28, 29, 30, 31, 32]);
    expect(cls.lenDelta).toBe(-400);
  });

  it('号能“碰巧”找到、但字数明显缩水（>30 字）→ 仍判 lost（防被零散数字骗过）', () => {
    const bodyText = '另有 28. 的零散数字 29、 之类';
    const cls = classifyBodySeqChange({
      snapshot: seq(32), finalSeq: seq(27), bodyText, lenBefore: 2000, lenAfter: 1900,
    });
    expect(cls.kind).toBe('lost');
  });

  it('序列与字数都没变 → same', () => {
    const cls = classifyBodySeqChange({
      snapshot: seq(10), finalSeq: seq(10), bodyText: '1. 一', lenBefore: 100, lenAfter: 100,
    });
    expect(cls.kind).toBe('same');
  });

  it('任一侧为空（无题号资料）→ none（不参与比对）', () => {
    expect(classifyBodySeqChange({ snapshot: [], finalSeq: seq(5) }).kind).toBe('none');
    expect(classifyBodySeqChange({ snapshot: seq(5), finalSeq: [] }).kind).toBe('none');
  });
});
