/**
 * 续写链（唯一实现）单测
 * ============================================================
 * 背景（2026-09-24 用户裁定"两套必须根治，不接受打补丁"）：
 *   此前 callAI 内两条引擎分支各有一份"薄层"续写，与 `_runPaperOrder` 的"额度链"并存。
 *   薄层的三个缺口：① 只有一份内联去重（第三份副本）② **不检测续写自身又是否被截断**
 *   ③ 返回的 finishReason 仍是首轮的 → 调用方看不出半截。
 *   本文件锁住收敛后的**唯一链**必须守住的不变量。
 * ============================================================
 */
import { describe, it, expect, vi } from 'vitest';
import {
  runContinuationChain, detectTruncation, isChunkTruncated, appendContinuationWithDedup,
  makeBudgetedPlanRound, ANSWER_CONT_MAX_ROUNDS,
} from '../../src/utils/continuationChain.js';

const LONG = '甲'.repeat(1200);          // 超 200 字 → finish=length 可判"按原因截断"
const TAIL_OK = `${LONG}。<p>结束</p>`;   // 尾部完整

describe('runContinuationChain —— 停止原因与不变量', () => {
  it('未截断 → 一轮都不跑（不产生任何请求）', async () => {
    const req = vi.fn();
    const r = await runContinuationChain({
      content: TAIL_OK, finishReason: 'stop', planRound: () => 100, requestNext: req,
    });
    expect(r.rounds).toBe(0);
    expect(r.stoppedBy).toBe('done');
    expect(r.truncated).toBe(false);
    expect(req).not.toHaveBeenCalled();
  });

  it('截断 → 追加续写、轮数=1、写完了（done）', async () => {
    const r = await runContinuationChain({
      content: LONG,                       // 无结束标点 → 启发式判截断
      finishReason: 'length',
      planRound: () => 100,
      requestNext: async () => ({ content: '<p>后半段</p>', finishReason: 'stop' }),
    });
    expect(r.rounds).toBe(1);
    expect(r.stoppedBy).toBe('done');
    expect(r.truncated).toBe(false);
    expect(r.content.startsWith(LONG)).toBe(true);   // ① 只追加、绝不覆盖
    expect(r.content).toContain('后半段');
  });

  // 🔴 旧薄层的核心缺口：续写段自己又截断了，却被当完整交付
  it('续写段自身仍被截断 → 继续下一轮（旧薄层在此静默交付半截）', async () => {
    let n = 0;
    const r = await runContinuationChain({
      content: LONG,
      finishReason: 'length',
      maxRounds: 2,
      planRound: () => 100,
      requestNext: async () => ({ content: `<p>第${++n}段未完`, finishReason: 'length' }),
    });
    expect(r.rounds).toBe(2);            // 两轮都跑了，不会"续一次就收工"
    expect(n).toBe(2);
    expect(r.truncated).toBe(true);      // 如实上报"仍不完整"
    expect(r.stoppedBy).toBe('rounds');
    expect(r.finishReason).toBe('length');
  });

  it('终末 finishReason 如实反映最后一次产出（供调用方判"是否仍不完整"）', async () => {
    const r = await runContinuationChain({
      content: LONG, finishReason: 'length', planRound: () => 100,
      requestNext: async () => ({ content: '<p>补齐了</p>', finishReason: 'stop' }),
    });
    expect(r.finishReason).toBe('stop');
    expect(r.truncated).toBe(false);
  });

  it('额度尽（planRound ≤ 0）→ budget 停，且**不发请求**', async () => {
    const req = vi.fn();
    const r = await runContinuationChain({
      content: LONG, finishReason: 'length', planRound: () => 0, requestNext: req,
    });
    expect(r.stoppedBy).toBe('budget');
    expect(r.rounds).toBe(0);
    expect(r.truncated).toBe(true);
    expect(req).not.toHaveBeenCalled();
  });

  it('纯重复续写 → invalid 停，内容不产生重复（绝不覆盖、不空转）', async () => {
    let calls = 0;
    const r = await runContinuationChain({
      content: LONG, finishReason: 'length', maxRounds: 3, planRound: () => 100,
      requestNext: async () => { calls++; return { content: LONG.slice(-20), finishReason: '' }; },  // 与末尾完全重复
    });
    expect(calls).toBe(1);               // 判无效即停，不再空转
    expect(r.stoppedBy).toBe('invalid');
    expect(r.content).toBe(LONG);        // 一字未变
    expect(r.rounds).toBe(1);
  });

  it('requestNext 抛错 → invalid（按未补齐处理，绝不当成功）', async () => {
    const r = await runContinuationChain({
      content: LONG, finishReason: 'length', planRound: () => 100,
      requestNext: async () => { throw new Error('网络断了'); },
    });
    expect(r.stoppedBy).toBe('invalid');
    expect(r.truncated).toBe(true);
    expect(r.content).toBe(LONG);
  });

  it('续写段过短（< minChunkLen）→ invalid 停', async () => {
    const r = await runContinuationChain({
      content: LONG, finishReason: 'length', planRound: () => 100, minChunkLen: 100,
      requestNext: async () => ({ content: '补一句。', finishReason: 'stop' }),
    });
    expect(r.stoppedBy).toBe('invalid');
    expect(r.rounds).toBe(1);
  });

  it('cleanChunk 逐段清洗（正文链用 normalizeBodyHtml 的口子）', async () => {
    const r = await runContinuationChain({
      content: LONG, finishReason: 'length', planRound: () => 100,
      cleanChunk: (raw) => String(raw).replace(/<script>[\s\S]*?<\/script>/gi, ''),
      requestNext: async () => ({ content: '<script>x</script><p>净后内容</p>', finishReason: 'stop' }),
    });
    expect(r.content).toContain('净后内容');
    expect(r.content).not.toContain('<script>');
  });

  it('轮数与停止原因始终可由调用方观测（onRound / onStop）', async () => {
    const rounds = [];
    let stop = null;
    await runContinuationChain({
      content: LONG, finishReason: 'length', maxRounds: 1, planRound: () => 100,
      onRound: (c) => rounds.push({ ...c }),
      onStop: (c) => { stop = c; },
      requestNext: async () => ({ content: '<p>仍未写完的后半段内容，这里要有足够长度</p>', finishReason: 'length' }),
    });
    expect(rounds.length).toBe(1);
    expect(rounds[0].round).toBe(1);
    expect(rounds[0].budget).toBe(100);
    expect(rounds[0].producedChars).toBe(LONG.length);
    expect(stop).toEqual({ stoppedBy: 'rounds', truncated: true, rounds: 1 });
  });
});

describe('isChunkTruncated —— 续写段判定不设长度门限（旧薄层漏判的正是短续写）', () => {
  it('短续写段 + 引擎自报 length → 仍判截断', () => {
    expect(isChunkTruncated('只有几十字的短续写，末尾没有写完', 'length')).toBe(true);
    expect(isChunkTruncated('只有几十字的短续写，末尾没有写完', 'reasoning_capped')).toBe(true);
  });

  it('无引擎信号时退回启发式（短段一律不判截断，避免误判）', () => {
    expect(isChunkTruncated('短句。', '')).toBe(false);
    expect(isChunkTruncated('', 'length')).toBe(false);
  });

  it('detectTruncation 本体口径不变（长文 + 尾部非完整句段才启发式判截断）', () => {
    expect(detectTruncation(LONG, 'length')).toEqual({ truncated: true, byReason: true });
    expect(detectTruncation(TAIL_OK, '').truncated).toBe(false);
    expect(detectTruncation('短内容', 'length').truncated).toBe(false);
  });
});

describe('appendContinuationWithDedup —— 唯一去重实现（策略开关保留两种口径）', () => {
  it('默认口径：只去掉与末尾重叠的部分', () => {
    const base = '<p>春风吹过</p>';
    expect(appendContinuationWithDedup(base, '春风吹过</p><p>燕子归来</p>'))
      .toBe(base + '\n<p>燕子归来</p>');
  });

  it('换行兜底仅在开启时生效（薄层 true / 正文链 false）', () => {
    const base = '甲'.repeat(60);
    // 首行 <30 字、且整段 >30 字（DEDUP_NEWLINE_MIN）才走"取换行后内容"的兜底
    const cont = '先复述一句\n真正要续的内容，足够长到不会被判无效，所以这里要写长一点才行。';
    expect(appendContinuationWithDedup(base, cont, { newlineFallback: true }))
      .toBe(`${base}\n真正要续的内容，足够长到不会被判无效，所以这里要写长一点才行。`);
    expect(appendContinuationWithDedup(base, cont, { newlineFallback: false }))
      .toBe(`${base}\n${cont}`);
  });

  it('纯重复 → 原样返回（绝不覆盖）', () => {
    const base = '乙'.repeat(80);
    expect(appendContinuationWithDedup(base, base.slice(-20))).toBe(base);
  });
});

describe('makeBudgetedPlanRound —— 预算化续写额度（2026-09-26 对齐正文 bodyQuota）', () => {
  // 语义：producedChars 是**字符**→先 charsToTokens(÷1.3 向上取整)；单帽/总额是 **token**。
  //  unit case: makeBudgetedPlanRound(1000) → singleCap=500, totalBudget=1200, guaranteed=1
  it('字符先换算 token 再算余额，总额逼近后逐轮收缩直到额度尽', () => {
    const plan = makeBudgetedPlanRound(1000);
    expect(plan({ round: 1, producedChars: 0 })).toBe(500);
    // charsToTokens(500)=385 → remaining=1200-385=815 → min(500,815)=500
    expect(plan({ round: 2, producedChars: 500 })).toBe(500);
    // charsToTokens(1200)=924 → remaining=276 → min(500,276)=276
    expect(plan({ round: 3, producedChars: 1200 })).toBe(276);
    // charsToTokens(1560)=1200 → remaining=0，且 round4>guaranteed → 0
    expect(plan({ round: 4, producedChars: 1560 })).toBe(0);
  });

  it('🔴 修复点：余额为负时前 guaranteed 轮给满额（保底），用尽后不再给', () => {
    const plan = makeBudgetedPlanRound(1000);
    // 大卷首轮写满后字符数恒 > 总额 token（旧实现直接 总额−字符 → 瞬时归零 → 0 轮续写）
    expect(plan({ round: 1, producedChars: 99999 })).toBe(500); // 保底第 1 轮
    expect(plan({ round: 2, producedChars: 99999 })).toBe(0);   // 保底用尽，余额仍负 → 停
    expect(plan({ round: 3, producedChars: 99999 })).toBe(0);
  });

  it('totalMult 自定义降低总额：总额 = max(单帽, 单帽×totalMult)', () => {
    const plan = makeBudgetedPlanRound(1000, { totalMult: 1.0 }); // singleCap=500, totalBudget=1000
    expect(plan({ round: 1, producedChars: 0 })).toBe(500);
    // charsToTokens(1000)=770 → remaining=230 → min(500,230)=230
    expect(plan({ round: 2, producedChars: 1000 })).toBe(230);
  });

  it('maxTokens=0 → 单帽兜底 1，总额 1，保底 1 轮', () => {
    const plan = makeBudgetedPlanRound(0);
    expect(plan({ round: 1, producedChars: 0 })).toBe(1);
    // charsToTokens(2)=2 → remaining=-1，round2>guaranteed → 0
    expect(plan({ round: 2, producedChars: 2 })).toBe(0);
    expect(plan({ round: 1, producedChars: 2 })).toBe(1); // 余额负但仍在保底轮
  });

  it('与 runContinuationChain 联跑：保底续 1 轮补齐，剩余仍负则 budget 停（防发散）', async () => {
    const req = vi.fn(async () => ({ content: '续写的后半段答案内容，足够长不会被判无效，这里是追加的部分。', finishReason: 'length' }));
    // maxTokens=60 → singleCap=30, totalBudget=72；LONG=1200字符 → token≈924 ≫ 72。
    // round1（produced=LONG）余额负但 round1≤guaranteed → 保底 30 跑 1 轮；
    // round2（produced 更大）余额仍负且 round2>guaranteed → budget 停。既不瞬停、又不发散。
    const r = await runContinuationChain({
      content: LONG, finishReason: 'length', maxRounds: 6,
      planRound: makeBudgetedPlanRound(60), requestNext: req,
    });
    expect(r.rounds).toBe(1);
    expect(req).toHaveBeenCalledTimes(1);
    expect(r.stoppedBy).toBe('budget');
  });

  it('答案页续写轮数上限已提权对齐正文（数值为可断言约束）', () => {
    expect(ANSWER_CONT_MAX_ROUNDS).toBe(6);
  });
});
