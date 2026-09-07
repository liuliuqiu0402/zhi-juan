import { describe, it, expect } from 'vitest';
import { buildStudyUnits, runStudyRound, ledgerToText } from '../../src/utils/studyOrchestrator.js';
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
];

describe('研读编排驱动（复位阶段 2→3 衔接）', () => {
  it('构建研读单位：missing 锚排除、练习段过滤', () => {
    const units = buildStudyUnits({ anchors });
    expect(units.map((u) => u.name)).toEqual(['除数是小数的除法']);
    expect(units[0].segments).toHaveLength(1);
    expect(units[0].segments[0].text).toContain('小数点同时向右移动');
    expect(units[0].segments[0].text).not.toContain('练一练');
  });

  it('单批全绿研读 → 迁到 ready，总账含理解与引用', async () => {
    const session = createGenerationSession({ meta: { genType: 'practice' } });
    const units = buildStudyUnits({ anchors });
    const digestFns = {
      produce: async () =>
        '【除数是小数的除法】理解：除数化整再除\n｜引用：把被除数与除数的小数点同时向右移动相同的位数，使除数变成整数再计算。',
    };
    const r = await runStudyRound({ units, session, digestFns });
    expect(r.ok).toBe(true);
    expect(r.nextStage).toBe('ready');
    expect(r.report.missing).toEqual([]);
    expect(ledgerToText(r.ledger)).toContain('除数是小数的除法');
    // 研读批消息已作为可压缩用户消息追加
    expect(session.messages.some((m) => m.compressible && m.content.includes('研读批'))).toBe(true);
  });

  it('批摘要校验失败 → 停留研读并给出失败批（程序不代写笔记）', async () => {
    const session = createGenerationSession();
    const units = buildStudyUnits({ anchors });
    const digestFns = {
      produce: async () => '【除数是小数的除法】', // 空理解
    };
    const r = await runStudyRound({ units, session, digestFns });
    expect(r.ok).toBe(false);
    expect(r.nextStage).toBe('studying');
    expect(r.failBatch).toBeTruthy();
  });
});
