import { describe, it, expect } from 'vitest';
import { getPromptTemplate, floorClauseSections, CONTENT_GEN_TYPES } from '../../src/config/promptLibrary.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';

/**
 * 图探针「面集对齐」守卫（2026-10-22，属主："这个问题为什么还存在啊？你之前根治的时候，
 * 是全局 9 种资料类型都覆盖到了吗"）
 * ============================================================
 * 病根：注入侧与校验侧各持一把尺子——
 *   · A 侧（`promptLibrary.outputFormatSections`）：图-题一致性条款随**题类格式块**走，
 *     `isContent ? '' : qf.markerClause` ⇒ **7 类有、2 类（preview/summary）没有**；
 *   · B 侧（`examValidator` 2j-3／2j-5）：`image-block-fix` 无 `genTypes` ⇒ **9 类全跑**。
 *   于是内容型出现"从没要求过却判你没做到"的假告警（属主贴出的那条即出自此类），
 *   且此前后续修图问题时只看题类样本，故反复"修不掉"。
 *
 * 本守卫锁的就是这条对齐关系，且**按 9 类逐一核**（不再抽样）：
 *   ① 静态度：A 侧（主路径模板 ＋ 守门兜底段）有条款 ⇔ 该类型不在 CONTENT_GEN_TYPES；
 *   ② 行为度：同一份"看图无块"的样本喂给 auditExamPaper，报告 image-missing ⇔ A 侧有条款。
 * 任一侧名单改动而另一侧未同步 → 本文件转红。
 */
const TYPES = ['exam', 'practice', 'special', 'preview', 'reading', 'dictation', 'review', 'summary', 'errorbook'];
const SUBJECTS = ['语文', '数学', '英语', '物理', '历史'];
const GRADE = '五年级';
const STAGE = 'primary_high';

const CLAUSE_ANCHOR = '图-题一致性';

/** 一份"题干点图、整卷零图标记"的最小样本（与 tests/utils/imageMissingProbe.test.js 同型） */
const FIGURE_PAPER = `<h2>一、看图作答</h2><p class="question">1. 看图列式计算。</p>`
  + `<p class="blank-area">&emsp;</p>`
  + `<div class="answer-section"><h2>参考答案</h2><p>略</p></div>`;

const notesOf = (r, type) => (r.silentDetails || []).filter((d) => d.type === type);

describe('图探针面集对齐：注入什么就验什么（9 种资料类型逐一核）', () => {
  it('A 侧静态度：主路径模板含图-题一致性 ⇔ 该类型非内容型', () => {
    for (const genType of TYPES) {
      for (const subject of SUBJECTS) {
        const tpl = String(getPromptTemplate({ grade: GRADE, subject, genType })?.template || '');
        const expectClause = !CONTENT_GEN_TYPES.includes(genType);
        expect(tpl.includes(CLAUSE_ANCHOR), `${genType}×${subject} 主路径模板`).toBe(expectClause);
      }
    }
  });

  it('A 侧静态度：守门兜底段同口径（自定义模板缺【输出格式】时不得悬空）', () => {
    for (const genType of TYPES) {
      for (const subject of SUBJECTS) {
        const text = floorClauseSections({ subject, stage: STAGE, genType }).map((b) => b.text || '').join('\n');
        const expectClause = !CONTENT_GEN_TYPES.includes(genType);
        expect(text.includes(CLAUSE_ANCHOR), `${genType}×${subject} 兜底段`).toBe(expectClause);
      }
    }
  });

  it('B 侧行为度：看图无块 → 只有"有条款"的类型报 image-missing（内容型必须静默）', () => {
    for (const genType of TYPES) {
      const r = auditExamPaper(FIGURE_PAPER, { subject: '数学', stage: STAGE, genType });
      const hit = notesOf(r, 'image-missing').length > 0;
      expect(hit, `${genType}：${hit ? '报了' : '没报'}，与注入侧口径不符`).toBe(!CONTENT_GEN_TYPES.includes(genType));
    }
  });

  it('B 侧行为度：内容型连"标题与内容不符"图探针也一并不报（同一面集）', () => {
    const paper = `<h2>五、根据图片提示写出正确的单词</h2>`
      + `<p class="question">1. The snail kept <u class="blank-6">&emsp;</u> up the tree.</p>`
      + `<div class="answer-section"><h2>参考答案</h2><p>略</p></div>`;
    for (const genType of CONTENT_GEN_TYPES) {
      const r = auditExamPaper(paper, { subject: '英语', stage: STAGE, genType });
      expect(notesOf(r, 'title-content-mismatch').length, `${genType} 不得报标题图探针`).toBe(0);
    }
  });

  it('提示可核对：报缺图时附触发处原文（属主不必再猜"是哪句话钓起来的"）', () => {
    const r = auditExamPaper(FIGURE_PAPER, { subject: '数学', stage: STAGE, genType: 'practice' });
    const msg = notesOf(r, 'image-missing')[0]?.message || '';
    expect(msg).toContain('触发处');
    expect(msg, '片段须是该题原文').toContain('看图列式计算');
  });
});
