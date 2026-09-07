import { describe, it, expect } from 'vitest';
import { buildStudyUnits, runStudyRound, ledgerToText, buildStudyPrefix, expandLongStudyUnits, STUDY_REREAD_LIMIT } from '../../src/utils/studyOrchestrator.js';
import { createGenerationSession } from '../../src/utils/generationSession.js';

const SEG_EXAMPLE = { text: '除数是小数的除法：把被除数与除数的小数点同时向右移动相同的位数，使除数变成整数再计算。', type: '例', isKeyConcept: true };
const SEG_PRACTICE = { text: '练一练：4.6×2.8＝', type: '练习', isKeyConcept: false };

const anchors = [
  {
    chapterTitle: '第1单元',
    bigConcept: '小数乘法和除法',
    name: '除数是小数的除法',
    level: '理解',
    specificConcepts: ['把除数变成整数再除'],
    bind: { status: 'literal', segments: [SEG_EXAMPLE, SEG_PRACTICE] },
  },
  {
    chapterTitle: '第1单元',
    bigConcept: '小数乘法和除法',
    name: '小数乘小数',
    level: '理解',
    specificConcepts: ['先按整数乘法算，再点小数点'],
    bind: { status: 'missing', segments: [] },
  },
  {
    chapterTitle: '第1单元',
    bigConcept: '小数乘法和除法',
    name: '积的小数位数',
    level: '理解',
    specificConcepts: ['因数小数位数之和'],
    bind: { status: 'literal', segments: [{ text: '积的小数位数等于两个因数的小数位数之和。', type: '例', isKeyConcept: true }] },
  },
];

const GOOD_DIGEST = (name) =>
  `【${name}】理解：按小数运算法则理解\n｜引用：${name === '除数是小数的除法' ? '把被除数与除数的小数点同时向右移动相同的位数，使除数变成整数再计算' : '积的小数位数等于两个因数的小数位数之和'}`;

describe('研读编排驱动（复位阶段 2→3 衔接）', () => {
  it('构建研读单位：missing 锚排除、练习段过滤', () => {
    const units = buildStudyUnits({ anchors });
    expect(units.map((u) => u.name)).toEqual(['除数是小数的除法', '积的小数位数']);
    expect(units[0].segments).toHaveLength(1);
    expect(units[0].segments[0].text).toContain('小数点同时向右移动');
    expect(units[0].segments[0].text).not.toContain('练一练');
  });

  it('单批全绿研读 → 迁到 ready，总账含理解与引用，素材批原文被压缩替换为点名摘要', async () => {
    const session = createGenerationSession({ meta: { genType: 'practice' } });
    const units = buildStudyUnits({ anchors });
    const digestFns = {
      produce: async (msg, batchUnits) => batchUnits.map((u) => GOOD_DIGEST(u.name)).join('\n'),
    };
    const r = await runStudyRound({ units, session, digestFns });
    expect(r.ok).toBe(true);
    expect(r.nextStage).toBe('ready');
    expect(r.report.missing).toEqual([]);
    expect(r.report.rereads).toBe(0);
    expect(ledgerToText(r.ledger)).toContain('除数是小数的除法');
    // 素材批原文（compressible）已压缩替换；摘要原话进会话
    expect(session.messages.some((m) => m.compressible)).toBe(false);
    expect(session.messages.some((m) => m.kind === 'assistant' && m.content.includes('除数是小数的除法'))).toBe(true);
    expect(session.messages.some((m) => m.kind === 'summary' && m.content.includes('已消化'))).toBe(true);
    // 引擎历史派生：点名行 user + 摘要 assistant
    expect(r.digestPairs).toHaveLength(1);
    const prefix = buildStudyPrefix(r.digestPairs);
    expect(prefix.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(prefix[0].content).toContain('除数是小数的除法');
    expect(prefix[1].content).toContain('引用：');
  });

  it('批摘要校验失败 → 带纠错提示回流重读，重读通过即继续（不静默通过、不代写）', async () => {
    const session = createGenerationSession();
    const units = buildStudyUnits({ anchors });
    let calls = 0;
    const digestFns = {
      produce: async (msg, batchUnits) => {
        calls += 1;
        if (calls === 1) return '【除数是小数的除法】'; // 首次：理解为空 → 校验失败
        return batchUnits.map((u) => GOOD_DIGEST(u.name)).join('\n'); // 回流后：覆盖全部点名
      },
    };
    const r = await runStudyRound({ units, session, digestFns });
    expect(calls).toBe(2);
    expect(r.ok).toBe(true);
    expect(r.nextStage).toBe('ready');
    expect(r.report.rereads).toBe(1);
  });

  it('回流重读超限仍失败 → 中断研读并给出失败批与校验明细', async () => {
    const session = createGenerationSession();
    const units = buildStudyUnits({ anchors });
    const digestFns = {
      produce: async () => '【除数是小数的除法】', // 永远空理解
    };
    const r = await runStudyRound({ units, session, digestFns });
    expect(r.ok).toBe(false);
    expect(r.nextStage).toBe('studying');
    expect(r.failBatch).toBeTruthy();
    expect(r.validation).toBeTruthy();
    expect(r.report.rereads).toBe(STUDY_REREAD_LIMIT + 1);
  });

  it('多批研读：逐批压缩替换（任意时刻至多一条素材批原文），digest 前缀按批累加且交替', async () => {
    const session = createGenerationSession();
    const units = buildStudyUnits({ anchors }); // 2 个有料锚，强制小批拆成两批
    const digestFns = {
      produce: async (msg, batchUnits) => batchUnits.map((u) => GOOD_DIGEST(u.name)).join('\n'),
    };
    const r = await runStudyRound({ units, session, digestFns, maxCharsPerBatch: 1 });
    expect(r.ok).toBe(true);
    expect(r.digestPairs).toHaveLength(2);
    const prefix = buildStudyPrefix(r.digestPairs);
    expect(prefix.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(prefix[2].content).toContain('积的小数位数');
    // 素材批原文不留在会话（全部被压缩替换），历史体积有界
    expect(session.messages.filter((m) => m.content.includes('教材片段')).length).toBe(0);
  });

  it('digest 引擎异常：自动重试一次；重试成功则继续，仍失败才迁 need_material', async () => {
    const session = createGenerationSession();
    const units = buildStudyUnits({ anchors });
    let calls = 0;
    const digestFns = {
      produce: async (msg, batchUnits) => {
        calls += 1;
        if (calls === 1) throw new Error('engine timeout'); // 首次：网络/超时瞬时异常
        return batchUnits.map((u) => GOOD_DIGEST(u.name)).join('\n'); // 重试：成功
      },
    };
    const r = await runStudyRound({ units, session, digestFns });
    expect(calls).toBe(2);
    expect(r.ok).toBe(true);
    expect(r.nextStage).toBe('ready');
    expect(r.report.digestError).toBe('');
  });

  it('digest 重试仍失败 → 迁 need_material 并携带错误信息（不静默通过）', async () => {
    const session = createGenerationSession();
    const units = buildStudyUnits({ anchors });
    let calls = 0;
    const digestFns = {
      produce: async () => {
        calls += 1;
        throw new Error('engine timeout twice');
      },
    };
    const r = await runStudyRound({ units, session, digestFns });
    expect(calls).toBe(2);
    expect(r.ok).toBe(false);
    expect(r.nextStage).toBe('need_material');
    expect(r.report.digestError).toContain('engine timeout');
  });

  it('expandLongStudyUnits：长锚多段超预算 → 按段切片为同名子单位（≤预算 0.85），超长单段独立不切料，普通单位原样', () => {
    const longSeg = (k) => ({ text: `长课文示例段落内容用于研读切批测试第${k}段，讲述规律推导与算理应用，字数足够形成超过批预算的累计文本量以验证按段切片逻辑的正确性，本段示例用于验证锚总字数超预算时按段落自然边界切片的结构规则行为。`, type: '例' });
    const units = [
      { id: '长锚', name: '长锚', chars: 900, segments: [longSeg(1), longSeg(2), longSeg(3)] },
      { id: '短锚', name: '短锚', chars: 50, segments: [longSeg(1)] },
      { id: '超段锚', name: '超段锚', chars: 5000, segments: [{ text: 'x'.repeat(3000), type: '例' }] },
    ];
    const out = expandLongStudyUnits(units, 200);
    expect(out).toHaveLength(5); // 长锚 3 段 → 3 子；短锚原样；超段锚原样
    expect(out[0].name).toBe('长锚');
    expect(out[0].id).toBe('长锚@1');
    expect(out[0].chars).toBeLessThanOrEqual(200);
    expect(out[2].id).toBe('长锚@3');
    expect(out[3].id).toBe('短锚');
    expect(out[4].id).toBe('超段锚');
    expect(out[4].chars).toBeGreaterThan(3000); // 单段超预算不切料
  });

  it('长锚按段切批集成：多批 digest 同名通过、总账同名合并保留、无整段 oversize', async () => {
    const session = createGenerationSession({ meta: { genType: 'practice' } });
    const longSeg = (k) => ({ text: `长课文段落${k}：用于验证超预算锚自动按段分批的完整链路，内容为小数除法的算理与竖式书写规则示例说明文字，该段落需要足够的文字量来触发多批拆分与同名总账合并的校验路径。`, type: '例' });
    const longAnchor = {
      chapterTitle: '第1单元', bigConcept: '小数乘法和除法', name: '长锚',
      level: '理解', specificConcepts: ['算理'], bind: { status: 'literal', segments: [longSeg(1), longSeg(2), longSeg(3)] },
    };
    const units = buildStudyUnits({ anchors: [longAnchor] });
    expect(units).toHaveLength(1);
    let calls = 0;
    const digestFns = {
      produce: async (msg, batchUnits) => {
        calls += 1;
        expect(batchUnits).toHaveLength(1);
        return `【长锚】理解：第${calls}段批的理解\n｜引用：长课文段落${calls}：用于验证超预算`;
      },
    };
    const r = await runStudyRound({ units, session, digestFns, maxCharsPerBatch: 200 });
    expect(calls).toBeGreaterThanOrEqual(2); // 长锚被拆为多批（同名多批）
    expect(r.ok).toBe(true);
    expect(r.nextStage).toBe('ready');
    expect(r.report.oversize).toEqual([]); // 已按段分批，无整段 oversize
    expect(r.report.batches).toBe(calls);
    const ledgerText = ledgerToText(r.ledger);
    expect(ledgerText).toContain('长锚');
    expect(r.ledger.get('长锚').note).toContain('第1段批');
    expect(r.ledger.get('长锚').note).toContain('第' + calls + '段批'); // 同名多批理解合并保留
  });
});
