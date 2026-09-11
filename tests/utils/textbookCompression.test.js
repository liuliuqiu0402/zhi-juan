// ✅ A4（2026-09-11）：原文压缩（Map → Reduce）
// 锁定：压缩比分流（full 保原句）/ 按原文结构切节（绝不新造标题、不丢正文）/ 分批保序/
//       压缩输入为纯原文（提示词不含锚点，防假压缩）/ 按原顺序拼接 / 失败不丢料 / 超窗递归折叠 / 并发有上限
import { describe, it, expect } from 'vitest';
import {
  compressionSpecOf,
  splitOriginalIntoSections,
  packSectionsIntoBatches,
  buildMapMessages,
  reduceInOriginalOrder,
  compressOriginalText,
  estimateTokens,
  tokensToChars,
  collectChapterRawText,
} from '../../src/utils/textbookCompression.js';
import { CHARS_PER_TOKEN } from '../../src/utils/budgetCalibration.js';

const RAW = [
  '第1课 草原',
  '草原的天空很蓝。',
  '羊群像白色的云。',
  '',
  '第2课 丁香结',
  '丁香结象征着愁怨。',
  '作者借物抒情。',
].join('\n');

describe('A4-6 压缩比按 mode 分流', () => {
  it('full（知识型）→ 保原文表述与原句（verbatim）', () => {
    const spec = compressionSpecOf('full');
    expect(spec.fidelity).toBe('verbatim');
    expect(spec.instruction).toContain('原句');
    expect(spec.instruction).toContain('不得改写');
  });
  it('命题型（practice/special/reading/exam）→ 可大幅压缩（condense），但保结构保事实', () => {
    for (const m of ['practice', 'special', 'reading', 'exam']) {
      const spec = compressionSpecOf(m);
      expect(spec.fidelity, m).toBe('condense');
      expect(spec.instruction).toContain('不得删掉任何栏目');
      expect(spec.instruction).toContain('不得改写事实');
    }
  });
});

describe('A4-7/A4-8 按原文结构切节（只保留原文已有标题，绝不新造；不丢正文）', () => {
  it('按原文标题切节，标题原样保留', () => {
    const secs = splitOriginalIntoSections(RAW);
    expect(secs.map(s => s.title)).toEqual(['第1课 草原', '第2课 丁香结']);
    expect(secs[0].text).toContain('草原的天空很蓝。');
    expect(secs[1].text).toContain('丁香结象征着愁怨。');
  });

  it('🔒 不丢正文：原文每一非空行都出现在某一节正文里（标题行也计入正文）', () => {
    const joined = splitOriginalIntoSections(RAW).map(s => s.text).join('\n');
    for (const line of RAW.split('\n').filter(l => l.trim())) {
      expect(joined, line).toContain(line);
    }
  });

  it('原文无标题 → 单节且 title 为空（绝不新造标题）', () => {
    const body = '这是一段没有任何标题的教材原文。\n第二行内容。';
    const secs = splitOriginalIntoSections(body);
    expect(secs).toHaveLength(1);
    expect(secs[0].title).toBe('');
    expect(secs[0].text).toBe(body);
  });

  it('内容行不被误判为标题（含多小题/句读的行按正文处理）', () => {
    const body = '1. 25×4=   2. 120÷6=   3. 3.5+2.8=\n上面是口算题。';
    const secs = splitOriginalIntoSections(body);
    expect(secs).toHaveLength(1);
    expect(secs.map(s => s.title)).toEqual(['']);
    expect(secs[0].text).toContain('120÷6=');
  });
});

describe('A4-7 分批：自然边界 → 超限句子级二次切分；批序 = 原序', () => {
  it('不跨自然边界合并超限；批内保持原序', () => {
    const secs = [{ title: '甲', text: '12345' }, { title: '乙', text: '6789' }];
    const one = packSectionsIntoBatches(secs, { maxCharsPerBatch: 10 });
    expect(one).toHaveLength(1);
    expect(one[0].text).toBe('12345\n6789');
    const two = packSectionsIntoBatches(secs, { maxCharsPerBatch: 9 });
    expect(two).toHaveLength(2);
    expect(two.map(b => b.text)).toEqual(['12345', '6789']);
    expect(two.map(b => b.title)).toEqual(['甲', '乙']);
  });

  it('单节超限 → 按句子切分并标记 part/parts，顺序不变', () => {
    const long = '第一句内容。第二句内容。第三句内容。第四句内容。第五句内容。';
    const batches = packSectionsIntoBatches([{ title: '长节', text: long }], { maxCharsPerBatch: 20 });
    expect(batches.length).toBeGreaterThan(1);
    expect(batches[0].part).toBe(1);
    expect(batches[0].parts).toBe(batches.length);
    expect(batches.map(b => b.text).join('')).toBe(long);
  });
});

describe('A4-3/A4-5 压缩输入为纯原文（防"假原文压缩"）', () => {
  it('Map 提示词只含原文与压缩要求，不含"锚"字样（锚点只在锚清单里出现一次）', () => {
    const msgs = buildMapMessages({ batch: { title: '第1课 草原', text: '草原的天空很蓝。' }, mode: 'practice' });
    const all = msgs.map(m => m.content).join('\n');
    expect(all).toContain('草原的天空很蓝。');
    expect(all).toContain('【压缩任务】');
    expect(all).not.toContain('锚');
    expect(all).not.toContain('考点');
  });
});

describe('A4-4 Reduce 按原顺序拼接', () => {
  it('按传入顺序拼接、去空、双换行分隔', () => {
    expect(reduceInOriginalOrder(['甲', '', ' 乙 '])).toBe('甲\n\n乙');
  });
});

describe('compressOriginalText（Map → Reduce，含失败降级与递归折叠）', () => {
  it('保序输出：拼接结果 = 各批输出按原序；callAI 调用次数 = 批数', async () => {
    const calls = [];
    const callAI = async (msgs) => { calls.push(msgs); return `C${calls.length}`; };
    const r = await compressOriginalText({
      rawText: RAW, mode: 'practice', callAI, maxCharsPerBatch: 30, foldLimitChars: 100000, concurrency: 1,
    });
    expect(r.batches.length).toBeGreaterThan(1);
    expect(calls.length).toBe(r.batches.length);
    expect(r.compressedText).toBe(r.batches.map((_, i) => `C${i + 1}`).join('\n\n'));
    expect(r.rounds).toBe(1);
    expect(r.warnings).toEqual([]);
  });

  it('🔒 某批压缩失败 → 保留该批原文并记 warning（绝不静默丢素材）', async () => {
    let n = 0;
    const callAI = async () => { n += 1; if (n === 1) throw new Error('网络中断'); return 'OK'; };
    const r = await compressOriginalText({
      rawText: RAW, mode: 'practice', callAI, maxCharsPerBatch: 30, foldLimitChars: 100000,
    });
    expect(r.warnings.join('')).toContain('保留原文');
    // 第一批失败 → 其原文（含标题）出现在结果里
    expect(r.compressedText).toContain('第1课 草原');
  });

  it('压缩结果超折叠线 → 递归折叠（rounds=2），仍保序', async () => {
    let n = 0;
    const callAI = async () => { n += 1; return `R${n}`; };
    const r = await compressOriginalText({
      rawText: RAW, mode: 'practice', callAI, maxCharsPerBatch: 30, foldLimitChars: 1, maxRounds: 2,
    });
    expect(r.rounds).toBe(2);
    expect(r.compressedText.length).toBeGreaterThan(0);
  });

  it('并发有上限（concurrency=2 时在飞批数不超过 2）', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const callAI = async () => {
      inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((res) => setTimeout(res, 5));
      inFlight -= 1;
      return 'X';
    };
    const secs = Array.from({ length: 6 }, (_, i) => ({ title: `第${i + 1}课`, text: '内容内容内容。' }));
    await compressOriginalText({
      sections: secs, mode: 'practice', callAI, maxCharsPerBatch: 1, foldLimitChars: 100000, concurrency: 2,
    });
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('未注入 callAI → 明确抛错（不静默返回空素材）', async () => {
    await expect(compressOriginalText({ rawText: RAW, mode: 'practice' })).rejects.toThrow('callAI');
  });

  it('统计口径：源字符/压缩后字符/压缩比可观测', async () => {
    const callAI = async () => '短';
    const r = await compressOriginalText({
      rawText: RAW, mode: 'practice', callAI, maxCharsPerBatch: 100000, foldLimitChars: 100000,
    });
    expect(r.stats.sourceChars).toBeGreaterThan(0);
    expect(r.stats.compressedChars).toBe(1);
    expect(r.stats.ratio).toBeLessThan(1);
  });
});

describe('token 换算与预算体系同口径', () => {
  it('estimateTokens / tokensToChars 与 CHARS_PER_TOKEN 一致', () => {
    expect(estimateTokens(Math.round(CHARS_PER_TOKEN))).toBe(1);
    expect(tokensToChars(1)).toBe(Math.floor(CHARS_PER_TOKEN));
    expect(tokensToChars(0)).toBe(0);
  });
});

describe('A15/A11 程序直读整章原文（不过滤类型；空/未标注段不丢弃；章序不变）', () => {
  it('练习段与未标注 type 段均计入，章序 = 传入卡序，无内容章整体丢弃', () => {
    const cards = [
      {
        chapterTitle: '第1课',
        segments: [
          { text: '课文正文第一段。', type: '正文' },
          { text: '练习题：计算 3×4。', type: '练习' },   // A11-1：练习段照收（不再被类型过滤）
          { text: '未标注类型的段落。' },                  // A11-2：空/未标注 type 不丢弃
          { text: '   ', type: '作业' },                   // 无内容 → 丢弃
        ],
      },
      { chapterTitle: '第2课', segments: [{ text: '第二课内容。', type: '正文' }] },
      { chapterTitle: '空章', segments: [] },
    ];
    const chapters = collectChapterRawText(cards);
    expect(chapters.map(c => c.chapterTitle)).toEqual(['第1课', '第2课']);
    expect(chapters[0].segmentTexts).toEqual(['课文正文第一段。', '练习题：计算 3×4。', '未标注类型的段落。']);
    expect(chapters[0].rawText).toContain('练习题：计算 3×4。');
    expect(chapters[0].rawText).toContain('未标注类型的段落。');
  });

  it('空输入/异常输入安全返回空数组', () => {
    expect(collectChapterRawText([])).toEqual([]);
    expect(collectChapterRawText(null)).toEqual([]);
  });

  it('A17（甲方案）：卡片自带 rawText（有原文但未分析）→ 优先取真原文，不退化成目录文本', () => {
    const cards = [
      {
        chapterTitle: '第1课',
        rawText: '这是该课的真实教材原文，未分析但保留。',
        segments: [{ text: '第1课\n  一、子标题', type: '正文' }],
      },
      { chapterTitle: '第2课', segments: [{ text: '纯目录文本（无原文）', type: '正文' }] },
    ];
    const chapters = collectChapterRawText(cards);
    expect(chapters[0].rawText).toBe('这是该课的真实教材原文，未分析但保留。');
    expect(chapters[1].rawText).toBe('纯目录文本（无原文）');
  });
});
