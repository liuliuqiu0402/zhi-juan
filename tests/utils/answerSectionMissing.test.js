/**
 * 答案区题号缺失检测（detectAnswerSectionMissing）单测
 * ============================================================
 * 背景（2026-09-26 用户实测："答案区只剩尾部评分表、缺前段逐题答案"根治）：
 *   正文是逐题卷（顶层题号≥4）而答案区却一个顶层题号都没有 → 判"答案区前段整体缺失"(severe)，
 *   消费方 useAiGenerator 据此不静默接受、走重试。判据刻意保守：
 *   · 答案区必须显式 part:'answer'（否则整段被当"答案区"切掉 → 计数恒 0，恒漏判）；
 *   · 正文顶层题数 <4 不判（纯写作/口语等开放表达卷），避免纯评分式答案区误报。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import {
  detectAnswerSectionMissing,
  ANSWER_SECTION_MISSING_MIN_BODY_TOP,
} from '../../src/utils/contentCleaner.js';

const BODY_5Q = `
<div class="question">1. 这是一道单选题。</div>
<div class="question">2. 第二道单选题。</div>
<div class="question">3. 第三道单选题。</div>
<div class="question">4. 第四道单选题。</div>
<div class="question">5. 第五道单选题。</div>
`;

const ANSWER_FULL = `
<div class="answer-section"><h2>参考答案</h2>
<p>1. A</p>
<p>2. B</p>
<p>3. C</p>
<p>4. D</p>
<p>5. A</p>
</div>
`;

// 🔴 线上事故形态：答案区只剩尾部写作评分表，前段逐题答案一个都没有
const ANSWER_RUBRIC_ONLY = `
<div class="answer-section"><h2>参考答案与评分标准</h2>
<h3>写作评分标准</h3>
<table>
<tr><th>维度</th><th>得分</th></tr>
<tr><td>内容完整</td><td>5</td></tr>
<tr><td>语言通顺</td><td>5</td></tr>
</table>
</div>
`;

describe('detectAnswerSectionMissing —— 答案区"只剩尾部、缺前段"检测', () => {
  it('正常完整答案 → 不 severe（正文顶层 5，答案区顶层 5）', () => {
    const r = detectAnswerSectionMissing(BODY_5Q, ANSWER_FULL);
    expect(r.bodyTop).toBe(5);
    expect(r.ansTop).toBe(5);
    expect(r.severe).toBe(false);
  });

  it('🔴 事故形态：正文逐题齐全、答案区只剩评分表 → severe', () => {
    const r = detectAnswerSectionMissing(BODY_5Q, ANSWER_RUBRIC_ONLY);
    expect(r.bodyTop).toBe(5);
    expect(r.ansTop).toBe(0);
    expect(r.severe).toBe(true);
  });

  it('🔴 part:\'answer\' 必须生效：答案区带 answer-section div 也能数出题号', () => {
    // 若误按正文口径切片，整段被当"答案区"切掉 → ansTop 恒 0 → 误报 severe（用户 2026-09-26 明示的漏判根因）
    expect(detectAnswerSectionMissing(BODY_5Q, ANSWER_FULL).severe).toBe(false);
  });

  it('开放表达卷（正文顶层 <4）不判——避免纯评分式答案区误报', () => {
    const body2q = `
<div class="question">1. 口语对话练习。</div>
<div class="question">2. 情景写作。</div>
`;
    const r = detectAnswerSectionMissing(body2q, ANSWER_RUBRIC_ONLY);
    expect(r.bodyTop).toBe(2);
    expect(r.ansTop).toBe(0);
    expect(r.severe).toBe(false);
  });

  it('正文顶层恰好到阈值线以下（3）也不判（保守下限）', () => {
    const body3q = `
<div class="question">1. 一题。</div>
<div class="question">2. 二题。</div>
<div class="question">3. 三题。</div>
`;
    expect(detectAnswerSectionMissing(body3q, ANSWER_RUBRIC_ONLY).severe).toBe(false);
  });

  it('答案区已从第 1 题起有逐题答案（哪怕不全）→ 有 1 起始连续段，不 severe', () => {
    // peakRun 只认"1 起始连续递增段"：缺了第 1 题的答案区（如从 3 起）算 0 → 判 severe，符合"缺前段"意图；
    // 但从第 1 题起有答案（后续断号）→ ansTop≥1 → 不是"整体缺失"，不误报。
    const ansPartial = `
<div class="answer-section"><h2>参考答案</h2>
<p>1. A</p>
<p>3. C</p>
<p>5. B</p>
</div>
`;
    const r = detectAnswerSectionMissing(BODY_5Q, ansPartial);
    expect(r.ansTop).toBe(1);
    expect(r.severe).toBe(false);
  });

  it('正文为空 / 答案区为空 → 不 severe（不误报）', () => {
    expect(detectAnswerSectionMissing('', ANSWER_RUBRIC_ONLY).severe).toBe(false);
    expect(detectAnswerSectionMissing(BODY_5Q, '').severe).toBe(false);
    expect(detectAnswerSectionMissing().severe).toBe(false);
  });

  it('阈值常量暴露为可断言值', () => {
    expect(ANSWER_SECTION_MISSING_MIN_BODY_TOP).toBe(4);
  });
});