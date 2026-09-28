// 试卷正文大题「汉字序号＋、」守卫测试（2026-09-28 新增）
// ============================================================
// 契约：抽取行首「汉字序号＋、」标题后，出现**重复序号**或**按小节重启**时——
//   只记报告/warn（silentDetails 中 level='warn' 的 cn-ordinal），**不改写、不重试、不判失败**。
//   仅试卷（exam）适用；答案区不参与；教辅（practice 等）不报（按大题分别编号是市场常态）。
import { describe, it, expect } from 'vitest';
import { detectCnOrdinalHeadingIssues, cnOrdinalToNumber } from '../../src/utils/contentCleaner.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const h2 = (t) => `<h2>${t}</h2>`;
const p = (t) => `<p class="question">${t}</p>`;
// 每段一大题、各带 1 道小题（大题标题带"（X分）"以贴近真实卷面；name 各异以免撞上"重复大题标题截断"）
const section = (label, name = '题目', score = 10) => `${h2(`${label}、${name}（${score}分）`)}${p('1. 作答')}`;

describe('cnOrdinalToNumber —— 汉字序数解析', () => {
  it('个位 / 十 / 组合', () => {
    expect(cnOrdinalToNumber('一')).toBe(1);
    expect(cnOrdinalToNumber('三')).toBe(3);
    expect(cnOrdinalToNumber('十')).toBe(10);
    expect(cnOrdinalToNumber('十一')).toBe(11);
    expect(cnOrdinalToNumber('十五')).toBe(15);
    expect(cnOrdinalToNumber('二十')).toBe(20);
    expect(cnOrdinalToNumber('二十一')).toBe(21);
    expect(cnOrdinalToNumber('')).toBe(0);
    expect(cnOrdinalToNumber('甲')).toBe(0);
  });
});

describe('detectCnOrdinalHeadingIssues —— 纯检测器', () => {
  it('全卷连续 一、二、三 → 无异常', () => {
    const r = detectCnOrdinalHeadingIssues(section('一') + section('二') + section('三'));
    expect(r.duplicates).toEqual([]);
    expect(r.restarts).toEqual([]);
    expect(r.hasIssue).toBe(false);
  });

  it('重复序号（两个"三、"）→ duplicates 命中', () => {
    const r = detectCnOrdinalHeadingIssues(section('一') + section('二') + section('三') + section('三'));
    expect(r.duplicates).toEqual(['三']);
    expect(r.hasIssue).toBe(true);
  });

  it('按小节重启（三、之后又出现 一、）→ restarts 命中', () => {
    const r = detectCnOrdinalHeadingIssues(section('一') + section('二') + section('三') + section('一'));
    expect(r.restarts).toEqual([{ from: 3, to: 1 }]);
    expect(r.hasIssue).toBe(true);
  });

  it('答案区内的汉字序号不参与（只判正文）', () => {
    const body = section('一') + section('二');
    const ans = '<div class="answer-section"><h2>参考答案</h2>'
      + `${h2('一、答案')}${h2('一、答案')}</div>`;
    const r = detectCnOrdinalHeadingIssues(body + ans);
    expect(r.duplicates).toEqual([]);
    expect(r.hasIssue).toBe(false);
  });

  it('空 / 无汉字序号标题 → 无异常', () => {
    expect(detectCnOrdinalHeadingIssues('').hasIssue).toBe(false);
    expect(detectCnOrdinalHeadingIssues('<p>正文无标题</p>').hasIssue).toBe(false);
  });

  it('「（一）」括号式与行内出现的汉字序号不算标题（只认行首"汉字序号＋、"）', () => {
    const r = detectCnOrdinalHeadingIssues('<p>（一）子题</p><p>提示：三、四、五都要写。</p>');
    expect(r.hasIssue).toBe(false);
  });
});

describe('auditExamPaper —— 汉字序号守卫接线（仅 exam，只 warn 不改）', () => {
  const run = (html, genType) => auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType });
  const notes = (r) => (r.silentDetails || []).filter((d) => d.type === 'cn-ordinal');

  it('exam：重复序号 → 生成 warn 报告，不改写正文、不计入 fix', () => {
    const html = section('一', '听力') + section('二', '选择') + section('三', '阅读') + section('三', '计算');
    const r = run(html, 'exam');
    const hits = notes(r);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((d) => d.level === 'warn')).toBe(true);
    expect(hits.map((d) => d.message).join(' | ')).toContain('重复');
    // 只报不改：不得产生 cn-ordinal 类修复记录，正文标题仍原样
    expect(r.issues.every((i) => i.type !== 'cn-ordinal')).toBe(true);
    expect(r.html).toContain('三、计算');
  });

  it('exam：按小节重启 → 生成 warn 报告（含"重启"字样）', () => {
    const html = section('一', '听力') + section('二', '选择') + section('三', '阅读') + section('一', '填空');
    const r = run(html, 'exam');
    expect(notes(r).map((d) => d.message).join(' | ')).toContain('重启');
  });

  it('exam：全卷连续 → 不报', () => {
    const r = run(section('一', '听力') + section('二', '选择') + section('三', '阅读'), 'exam');
    expect(notes(r)).toEqual([]);
  });

  it('教辅（practice）：同样正文不报（规则限 exam）', () => {
    const r = run(section('一', '听力') + section('二', '选择') + section('三', '阅读') + section('一', '填空'), 'practice');
    expect(notes(r)).toEqual([]);
  });
});
