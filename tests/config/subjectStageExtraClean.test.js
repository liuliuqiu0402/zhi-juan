// 2026-09 F1+F2 收口回归：
// F1 —— SUBJECT_STAGE_EXTRAS 英语高中/初中档不再携带考试题型结构词（读后续写/书面表达），
//       消除"题型名越界广播到教辅/内容型资料"（学科要点按 9 类资料全量注入，原 英语|high 文本
//       会在生成知识总结/课前预习/错题本时也把"读后续写"塞给模型）；考试结构仍由 exam 蓝本承载，去重不丢覆盖。
// F2 —— 数学概念考查底线（显性考查理解/不以机械套算代替）原 5 档学段要点重复同一长句，收敛为
//       学科级单一事实源一次注入（cell 不再内嵌），防同义表述漂移。
import { describe, it, expect } from 'vitest';
import { SUBJECT_STAGE_EXTRAS, getPromptTemplate } from '../../src/config/promptLibrary.js';
import { EXAM_BLUEPRINTS } from '../../src/config/examPaperBlueprints.js';

const MATH_STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

describe('F1 英语学科要点去考试题型结构词（2026-09）', () => {
  it('英语|high/middle 要点不再携带考试题型/写作结构词，消除对教辅与内容型的越界广播', () => {
    expect(SUBJECT_STAGE_EXTRAS['英语|high'].text).not.toMatch(/读后续写|书面表达|应用文/);
    expect(SUBJECT_STAGE_EXTRAS['英语|middle'].text).not.toMatch(/书面表达/);
  });

  it('英语高中考试结构仍由 exam 蓝本承载（收敛不丢覆盖）', () => {
    const bp = EXAM_BLUEPRINTS['英语|high'];
    expect(bp).toBeTruthy();
    const writing = (bp.sections || []).find((s) => String(s.name || '').includes('写作'));
    expect(writing?.note).toMatch(/读后续写/);
  });
});

describe('F2 数学概念考查底线单源收敛（2026-09）', () => {
  it('5 档数学学科要点不再内嵌"显性考查/机械套算"长句（已收敛出 cell）', () => {
    for (const stage of MATH_STAGES) {
      const cell = SUBJECT_STAGE_EXTRAS[`数学|${stage}`];
      expect(cell, `数学|${stage} 应存在`).toBeTruthy();
      expect(cell.text).not.toMatch(/机械套算/);
    }
  });

  it('内置模板按数学学科恰注入一次底线；其他学科不广播', () => {
    const math = getPromptTemplate({ grade: 'primary_high', subject: '数学', genType: 'practice' })?.template || '';
    expect((math.match(/机械套算/g) || []).length).toBe(1);
    expect(math).toContain('【数学学科命题底线】');

    const mathSummary = getPromptTemplate({ grade: 'high', subject: '数学', genType: 'summary' })?.template || '';
    expect((mathSummary.match(/机械套算/g) || []).length).toBe(1);

    const chinese = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'practice' })?.template || '';
    expect(chinese).not.toMatch(/机械套算/);
  });
});
