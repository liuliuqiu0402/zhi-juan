/**
 * 🔒 现有听力链路"特征锁"：记录 → 规则解析 → 出声（2026-09-20）
 * ============================================================
 * 为什么有这条测试：接下来要给"听力配音"加**新入口**（用户直接粘贴英文/中文文本，
 * 不再依赖已生成记录里的听力原文）。新入口会与现有链路共用同一套解析器、同一套出声逻辑，
 * 所以先把**现有链路的实际输出逐字段冻结**——将来无论怎么改入口/重构，一旦影响到老路径，
 * 这条测试会立刻报出"哪个字段变了"，而不是等到用户听出问题。
 *
 * 冻结口径＝**实测值**（先跑真实样本、打印指纹，再把实测结果写死），不是凭记忆写的期望值。
 * 覆盖三件事：
 *   ① 规则解析的三个材料（对话/对话/独白）、节指令归属、题号范围、选项行剔除与告警；
 *   ② 规则解析"够用就不调模型"的可信度判定；
 *   ③ 出声结果逐段（段序 / 角色 / 音色 / 停留 / 叮咚落点 / 文本）。
 * 另锁一条与本功能直接相关的**新事实**：中文原文交给规则解析"看似成功"，但它必须走 AI 路径——
 *   否则中文会被当成英文材料（中文噪声守卫会把它丢掉），这正是"粘贴中文"要翻译的原因。
 */
import { describe, it, expect } from 'vitest';
import { parseListeningSourceText, needAiFallback, cjkRatio } from '../../src/utils/listeningExtract.js';
import { buildListeningStoryboard } from '../../src/utils/listeningScript.js';

/** 真实形态的听力原文（含【听力原文】标题、两节指令、题号、选项行、题号范围行、续行独白） */
const SOURCE = [
  '【听力原文】',
  '第一节，听下面5段对话。每段对话后有一个小题。',
  '1. M: Excuse me, where is the library?',
  'W: It is next to the bank.',
  'A. A library.',
  'B. A bank.',
  '2. M: What time does the film start?',
  'W: At seven thirty.',
  '第二节，听下面一段独白。短文读两遍。',
  '听第6段材料，回答第6至第8题。',
  'M: Tom is a student. He goes to school by bus every day.',
  'He likes English very much.',
].join('\n');

/** 音色短名（断言里只关心"用了哪条"，不关心全名长度） */
const shortVoice = (v) => (v === 'zh-CN-XiaoxiaoNeural' ? 'ZH'
  : v === 'en-US-ChristopherNeural' ? 'M'
    : v === 'en-US-JennyNeural' ? 'W' : v);

/** 逐段指纹：[类型, 角色, 音色, 段后停留ms, 是否响叮咚, 文本] */
const fingerprintOf = (sb) => sb.segments.map((s) => [
  s.kind, s.role, shortVoice(s.voice), s.gapAfterMs, s.chimeBefore === true, s.text,
]);

describe('🔒 现有听力链路特征锁（加"粘贴文本"新入口前先固化，防被改坏）', () => {
  const parsed = parseListeningSourceText(SOURCE);
  const sb = buildListeningStoryboard({
    items: parsed.items,
    intro: parsed.intro,
    stage: '小学',
    grade: '六年级',
    announceTitle: false,
    soundCheck: false,
  });

  it('规则解析：题号/角色/节指令/题号范围/选项剔除 逐字段冻结', () => {
    expect(parsed.items).toEqual([
      {
        no: 1,
        lines: [
          { role: 'M', text: 'Excuse me, where is the library?' },
          { role: 'W', text: 'It is next to the bank.' },
        ],
      },
      {
        no: 2,
        lines: [
          { role: 'M', text: 'What time does the film start?' },
          { role: 'W', text: 'At seven thirty.' },
        ],
      },
      {
        no: 6,
        lines: [{ role: 'M', text: 'Tom is a student. He goes to school by bus every day. He likes English very much.' }],
        instruction: '第二节，听下面一段独白。短文读两遍。',
        range: { materialNo: 6, from: 6, to: 8 },
        repeat: 2,
      },
    ]);
    // 首条节指令（尚未出题）归导语，不进材料
    expect(parsed.intro).toBe('第一节，听下面5段对话。每段对话后有一个小题。');
    expect(parsed.stats).toEqual({
      items: 3, lines: 5, distinctSpeakers: 2, hadItemNumbers: true,
      optionDropped: 2, answerRowDropped: 0, answerKeyDropped: 0, instructionDropped: 0,
    });
    // 选项行（A. / B.）必须剔除，否则会把答案字母读进音频；剔除要留可见告警
    expect(parsed.warnings.join()).toContain('已剔除 2 行选项/答案');
  });

  it('可信度判定：有题号即视为可信，不调模型', () => {
    expect(needAiFallback(parsed)).toBe(false);
  });

  it('出声结果逐段冻结（段序 / 角色 / 音色 / 停留 / 叮咚落点 / 文本）', () => {
    expect(fingerprintOf(sb)).toEqual([
      ['opening', 'N', 'ZH', 2000, true, '听力考试现在开始。'],
      ['part', 'N', 'ZH', 1200, false, '第一部分 听力部分。'],
      ['instruction', 'N', 'ZH', 2000, false, '一、听下面5段对话。每段对话后有一个小题。'],
      ['itemno', 'N', 'M', 600, true, 'Number 1.'],
      ['material', 'M', 'M', 120, false, 'Excuse me, where is the library?'],
      ['material', 'W', 'W', 2000, false, 'It is next to the bank.'],
      ['repeat', 'M', 'M', 120, false, 'Excuse me, where is the library?'],
      ['repeat', 'W', 'W', 8000, false, 'It is next to the bank.'],
      ['itemno', 'N', 'M', 600, true, 'Number 2.'],
      ['material', 'M', 'M', 120, false, 'What time does the film start?'],
      ['material', 'W', 'W', 2000, false, 'At seven thirty.'],
      ['repeat', 'M', 'M', 120, false, 'What time does the film start?'],
      ['repeat', 'W', 'W', 10000, false, 'At seven thirty.'],
      ['instruction', 'N', 'ZH', 2000, false, '二、听下面一段独白。短文读两遍。'],
      ['itemno', 'N', 'ZH', 600, true, '听第6段材料，回答第6至8小题。'],
      ['material', 'M', 'M', 2000, false, 'Tom is a student. He goes to school by bus every day. He likes English very much.'],
      ['repeat', 'W', 'W', 5000, false, 'Tom is a student. He goes to school by bus every day. He likes English very much.'],
      ['closing', 'N', 'ZH', 0, false, '听力部分到此结束。'],
    ]);
  });

  it('🔴 中文原文：规则解析"看似成功"但必须走 AI——中文材料不会被当英文读出来', () => {
    const zhSource = '第一段材料：小明今天去图书馆借了一本书，他很喜欢这本书。';
    const zhParsed = parseListeningSourceText(zhSource);
    expect(cjkRatio(zhSource)).toBeGreaterThan(0.9);
    // 规则解析确实"出了条"，但可信度判定要求走 AI 兜底
    expect(zhParsed.items.length).toBeGreaterThan(0);
    expect(needAiFallback(zhParsed)).toBe(true);
    // 直接把中文材料喂给出声逻辑 → 被中文噪声守卫丢掉，不产生任何材料段
    //   这正是"粘贴中文必须先翻译"的硬理由：不翻译就只有指令、没有材料
    const zhSb = buildListeningStoryboard({
      items: zhParsed.items, intro: zhParsed.intro,
      stage: '小学', grade: '六年级', announceTitle: false, soundCheck: false,
    });
    expect(zhSb.segments.filter((s) => s.kind === 'material' || s.kind === 'repeat')).toHaveLength(0);
  });
});
