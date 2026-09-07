import { describe, it, expect } from 'vitest';
import { buildStudyUnits, runStudyRound, ledgerToText, buildStudyPrefix, STUDY_REREAD_LIMIT } from '../../src/utils/studyOrchestrator.js';
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
        if (calls === 1) return '【除数是小数的除法】'; // 首次：理解为空
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
});
