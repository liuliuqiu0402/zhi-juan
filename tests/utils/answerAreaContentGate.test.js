/**
 * 自动补作答区 · 类型与"纯内容栏"门控回归（2026-09）
 * ============================================================
 * 问题：answer-area-fix 规则 genTypes 为空 → 全类型生效；"无题号无子题"的整栏会被当作
 *       长答块兜底补行 → 内容型（summary/preview）及复习/错题本里的"知识要点/梳理"栏被误补空行。
 * 修复：① summary/preview 在 2k 入口整类跳过；② 其余类型的"纯内容栏"仅在栏目标题本身
 *       是长答任务（书面表达/默写/练一练…）时才整块兜底，标题无作答意图词即不补。
 */
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const base = { subject: '语文', stage: 'primary_low' };

describe('answer-area-fix · 内容型不补空作答区', () => {
  it('summary 知识要点梳理栏（无题号）不补任何作答行', () => {
    const html =
      '<h2>一、知识要点梳理</h2><h3>小数点的移动</h3><p>小数点向右移动一位，小数就扩大到原来的10倍。</p><p>举例：0.3 扩大到原来的10倍是3。</p>';
    const res = auditExamPaper(html, { ...base, genType: 'summary' });
    expect(res.html).not.toContain('blank-area');
    expect(res.html).not.toContain('blank-line');
    expect(res.issues.filter((i) => i.type === 'answer-area')).toHaveLength(0);
  });

  it('preview 预习要点/语料栏不补作答行', () => {
    const html = '<h3>预习要求</h3><p>1. 圈出课文生字。</p><p>2. 给加点字注音。</p>';
    const res = auditExamPaper(html, { ...base, genType: 'preview' });
    expect(res.issues.filter((i) => i.type === 'answer-area')).toHaveLength(0);
  });

  it('复习/错题本等类型的"纯内容栏"（标题无作答意图）不整栏补行', () => {
    const html = '<h3>易错提醒</h3><p>小数乘法中积的小数位数等于两个因数小数位数之和。</p>';
    const res = auditExamPaper(html, { ...base, genType: 'review' });
    expect(res.issues.filter((i) => i.type === 'answer-area')).toHaveLength(0);
    expect(res.html).not.toContain('blank-area');
  });

  it('栏目标题本身是长答任务（书面表达/习作）仍按整块兜底补作答区', () => {
    const html = '<h3>六、书面表达</h3><p>根据图片提示写一段不少于40词的短文。</p>';
    const res = auditExamPaper(html, { ...base, genType: 'exam' });
    const areaIssue = res.issues.find((i) => i.type === 'answer-area');
    expect(areaIssue).toBeTruthy();
    expect(areaIssue.message).toContain('已补作答空间');
    expect(res.html).toMatch(/blank-line|blank-area/);
  });
});
