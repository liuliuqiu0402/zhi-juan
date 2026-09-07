import { describe, it, expect } from 'vitest';
import {
  buildStudyBatchMessage,
  extractDigestRecords,
  isQuoteTraceable,
  validateDigestRecords,
  mergeLedger,
  ledgerToText,
} from '../../src/utils/studyRound.js';

const CORPUS = [
  '除数是小数的除法：把被除数与除数的小数点同时向右移动相同的位数，使除数变成整数再计算。',
  '求一个数的几分之几是多少，用乘法计算。',
];

describe('研读轮编排器（复位阶段 2）', () => {
  it('研读批消息：含点名/含义/课标/片段，练习段不进入（调用方已滤），无题型诱导词', () => {
    const msg = buildStudyBatchMessage([
      {
        name: '除数是小数的除法',
        level: '理解',
        concepts: ['把除数变成整数再除'],
        curriculum: '掌握小数除法计算方法',
        segments: [{ text: CORPUS[0], type: '例' }],
      },
    ]);
    expect(msg).toContain('除数是小数的除法');
    expect(msg).toContain('课标要求：掌握小数除法计算方法');
    expect(msg).toContain('不要凭记忆补写教材内容');
    expect(msg).not.toContain('建议题型');
  });

  it('缺片段锚在批消息中显式标注（不静默、不让模型凭记忆补）', () => {
    const msg = buildStudyBatchMessage([
      { name: '循环小数', concepts: ['无限小数'], segments: [] },
    ]);
    expect(msg).toContain('无可用教材片段');
    expect(msg).toContain('缺料');
  });

  it('摘记解析：识别【点名】行、理解句与引用', () => {
    const recs = extractDigestRecords(
      '【除数是小数的除法】把除数变成整数再计算\n｜引用：把被除数与除数的小数点同时向右移动相同的位数，使除数变成整数再计算。\n【小数乘小数】先按整数乘法算，再点小数点',
    );
    expect(recs).toHaveLength(2);
    expect(recs[0].name).toBe('除数是小数的除法');
    expect(recs[0].quote).toContain('小数点同时向右移动');
    expect(recs[1].name).toBe('小数乘小数');
  });

  it('引用可溯源：语料中含 8 字片段→可溯源；无源→不可溯源', () => {
    expect(isQuoteTraceable('把被除数与除数的小数点同时向右移动相同的位数', CORPUS)).toBe(true);
    expect(isQuoteTraceable('这是凭空编造的一句教材引用语', CORPUS)).toBe(false);
    expect(isQuoteTraceable('', CORPUS)).toBe(false);
  });

  it('批摘要校验：点名全覆盖、无范围外新增、无空理解、引用可溯源 → 通过', () => {
    const recs = [
      { name: '除数是小数的除法', note: '理解：除数化整再除', quote: '把被除数与除数的小数点同时向右移动相同的位数' },
    ];
    const r = validateDigestRecords(recs, { expectedNames: ['除数是小数的除法'], corpus: CORPUS });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('批摘要校验：范围外新增点/漏点/空理解/无源引用 → 各归其类且 ok=false', () => {
    const recs = [
      { name: '范围外的新概念', note: '理解句', quote: '' },
      { name: '除数是小数的除法', note: '', quote: '把被除数与除数的小数点同时向右移动相同的位数' },
      { name: '小数乘小数', note: '理解', quote: '凭空编造的引用语料' },
    ];
    const r = validateDigestRecords(recs, { expectedNames: ['除数是小数的除法', '小数乘小数'], corpus: CORPUS });
    expect(r.ok).toBe(false);
    expect(r.extra).toEqual(['范围外的新概念']);
    expect(r.empty).toEqual(['除数是小数的除法']);
    expect(r.unverifiable).toEqual([{ name: '小数乘小数' }]);
  });

  it('总账合并与文本化：逐点并入、覆盖同名、输出含引用', () => {
    const ledger = new Map();
    mergeLedger(ledger, [
      { name: '除数是小数的除法', note: '理解v1', quote: 'q1' },
      { name: '小数乘小数', note: '理解', quote: '' },
    ]);
    mergeLedger(ledger, [{ name: '除数是小数的除法', note: '理解v2', quote: 'q2' }]);
    expect(ledger.size).toBe(2);
    expect(ledger.get('除数是小数的除法').note).toBe('理解v2');
    const text = ledgerToText(ledger);
    expect(text).toContain('除数是小数的除法');
    expect(text).toContain('q2');
  });
});
