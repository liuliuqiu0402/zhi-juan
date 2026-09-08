import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

/**
 * image-missing 探针（规则 image-block-fix）升级回归（2026-09）：
 *  - 旧探针只认"看图写话/写话/看图"+ 只看 [IMAGE] + 整卷无图；
 *    数学"观察下面的图形/看图形/统计图"走 [GRAPH]、或一个 [IMAGE] 让他处缺失静默 → 漏报"题要图没图"。
 *  - 升级：关键词覆盖 看图/读图/看图形/统计图/观察图形/据图；配图标记同时认 [IMAGE] 与 [GRAPH]。
 *  只报不改、不改内容不改分。
 */
const run = (html, genType = 'practice', subject = '数学') =>
  auditExamPaper(html, { subject, stage: 'primary_high', genType });

const WARN_TYPE = 'image-missing';

/** 从 silentDetails 提取 image-missing 提示 */
const imageMissingNote = (r) =>
  (r.silentDetails || []).find((d) => d.type === WARN_TYPE)?.message || '';

/** 断言探针"只报不改"：绝不写进 issues（自动修复记录） */
const expectNotAutoFixed = (r) =>
  expect((r.issues || []).every((i) => i.type !== WARN_TYPE)).toBe(true);

/** 构造一段无任何图标记的数学看图题素材 */
const mkPeerFigure = (stem) =>
  `<h2>基础建构</h2><p class="question">1. ${stem}</p><p class="blank-area">&emsp;</p>
<div class="answer-section"><h2>参考答案</h2><p>略</p></div>`;

describe('image-missing 探针（看图/读图/图形类题缺图）', () => {
  it('「看图列式」题存在但整卷无 [IMAGE]/[GRAPH] → 报缺图（数学·practice）', () => {
    const r = run(mkPeerFigure('看图列式计算。'));
    expect(imageMissingNote(r)).toContain('看图');
    expect(imageMissingNote(r)).toContain('[IMAGE]');
    expectNotAutoFixed(r); // 只报不改：不进"已修复"记录
  });

  it('「观察下面的图形」题走 [GRAPH] 语义 → 整卷无 [GRAPH] 也报（数学）', () => {
    const r = run(mkPeerFigure('仔细观察下面的图形，说出它们的名称。'));
    expect(imageMissingNote(r)).toContain('图形');
  });

  it('「看统计图」题存在但整卷无标记 → 报（数学）', () => {
    const r = run(mkPeerFigure('看统计图回答问题。'));
    expect(imageMissingNote(r)).toBeTruthy();
  });

  it('存在看图题但整卷已有 [IMAGE] → 不误报', () => {
    const html = mkPeerFigure('看图列式计算。').replace(/<p class="blank-area">&emsp;<\/p>/, '[IMAGE]\nPROMPT:三个小朋友在公园滑滑梯\n[/IMAGE]');
    const r = run(html);
    expect(imageMissingNote(r)).toBe('');
  });

  it('存在看图形题但整卷已有 [GRAPH] → 不误报（数学数据图形）', () => {
    const html = mkPeerFigure('看图回答。').replace(/<p class="blank-area">&emsp;<\/p>/, '[GRAPH]\nTYPE:BAR_CHART\nDATA:1,2,3\n[/GRAPH]');
    const r = run(html);
    expect(imageMissingNote(r)).toBe('');
  });

  it('语文·practice 看图写话无 [IMAGE] → 强判定仍报', () => {
    const html = `<h2>习作乐园</h2><p class="question">15. 看图写话。（共20分）</p>` +
      `<div class="answer-section"><h2>参考答案</h2><p>略</p></div>`;
    const r = run(html, 'practice', '语文');
    expect(imageMissingNote(r)).toContain('看图写话');
  });

  it('无看图/读图关键词的常规题 → 不触发（不误报）', () => {
    const r = run(`<h2>基础建构</h2><p class="question">1. 直接写出得数。</p>
<div class="answer-section"><h2>参考答案</h2><p>略</p></div>`);
    expect(imageMissingNote(r)).toBe('');
  });
});