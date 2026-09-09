// 正文结构守卫（2026-09 正文丢失事故根治）测试
// ============================================================
// 事故：模型在 browse 写作轮先输出完整正文 → 被"未浏览章确认"打断把正文草稿挤为历史消息 →
//       下轮回复"正文已在上一条消息完整输出，无需修改"+覆盖自查文本 → 原 content=text 把自述当正文，
//       交付物正文 HTML 整页丢失。修复：
//       ① browse 循环正文轮不再插入打断（正文落地优先，未浏览章只进报告）；
//       ② 正文采纳/回退守卫从"仅长度"升级为"可交付结构"（isDeliverableBodyHtml）；
//       ③ stripPlanningPreamble 增加"覆盖自查/质量自查/无需修改"自述特征剥离。

import { describe, it, expect } from 'vitest';
import { stripPlanningPreamble, isDeliverableBodyHtml, hasBodyContentStructure } from '../../src/utils/contentCleaner.js';
import { detectPhonemeConflicts } from '../../src/utils/contentSanity.js';

describe('isDeliverableBodyHtml（可交付正文结构·严格判定）', () => {
  it('真实课时练正文（含 h2 栏目 + 题目 + 作答载体）→ 可交付', () => {
    const html = '<h2>一、基础建构任务</h2><p>1. watch 的过去式是 <u class="blank-2"></u>。</p><p class="question">2. 用所给词填空。</p>';
    expect(isDeliverableBodyHtml(html)).toBe(true);
    expect(hasBodyContentStructure(html)).toBe(true);
  });
  it('仅覆盖自查/自述纯文本（无 HTML 结构）→ 不可交付', () => {
    const narration = '我已完成本课时练正文的编写。覆盖自查（per-lesson-full 契约）- 规则动词过去式：题2、题4；正文已在上一条消息完整输出，无需修改。';
    expect(isDeliverableBodyHtml(narration)).toBe(false);
    expect(hasBodyContentStructure(narration)).toBe(false);
  });
  it('编号式覆盖自查清单（1. 规则动词…）→ 宽松版命中但严格版拒绝（须真实结构）', () => {
    const list = '1. 规则动词过去式：watch→watched\n2. 不规则动词过去式：am→was\n3. 一般过去时时间状语：ago、last month';
    expect(hasBodyContentStructure(list)).toBe(true); // 行首编号 → 宽松命中
    expect(isDeliverableBodyHtml(list)).toBe(false); // 无 h2/question/blank → 严格拒绝
  });
  it('空/纯标题 → 不可交付', () => {
    expect(isDeliverableBodyHtml('')).toBe(false);
    expect(isDeliverableBodyHtml('Unit 1 Try your best 课时练')).toBe(false);
  });
});

describe('stripPlanningPreamble（过程自述剥离·2026-09 扩展）', () => {
  it('剥离开头"我已完成…覆盖自查…无需修改"自述段（含正文时仅剥自述）', () => {
    const mixed = '<p>我已完成 Unit 1 课时练正文的编写。以下对本课时练的覆盖与质量作内部自查确认：覆盖自查（per-lesson-full 契约）…</p><p>1. 规则动词过去式填空。</p><h2>二、参考答案</h2><p>watched</p>';
    const out = stripPlanningPreamble(mixed);
    expect(out).toContain('1. 规则动词过去式填空');
    expect(out).not.toContain('覆盖自查');
    expect(out).not.toContain('内部自查确认');
  });
  it('整篇即自述（无真内容）→ 全部剥空', () => {
    const only = '<p>正文已在上一条消息完整输出，无需修改。</p><p>覆盖自查：题2、题4已覆盖。</p>';
    expect(stripPlanningPreamble(only)).toBe('');
  });
  it('真内容（题号/栏目开头）不被误伤', () => {
    const real = '<h2>一、基础建构</h2><p>1. 写出下列动词的过去式。</p>';
    expect(stripPlanningPreamble(real)).toBe(real);
  });
});

describe('detectPhonemeConflicts（音标形态校验·2026-09 误报根治）', () => {
  it('斜杠分隔的英文短语括注（题5"圈出 ago / last month / one day"）→ 不报音标冲突', () => {
    const html = '<p>5. 圈出时间状语：ago / last month / one day，并连线对应中文。</p>';
    expect(detectPhonemeConflicts(html)).toEqual([]);
  });
  it('纯拉丁单词拼写被斜杠分隔（month / one）→ 不报', () => {
    const html = '<p>last month / one day / long ago 均为过去时间状语。</p>';
    expect(detectPhonemeConflicts(html)).toEqual([]);
  });
  it('真实同词双音标 → 仍报（如 go /ɡəʊ/ 与 go /goʊ/）', () => {
    const html = '<p>go /ɡəʊ/ 与美式 go /goʊ/ 标注并存。</p>';
    const hits = detectPhonemeConflicts(html);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toContain('go');
  });
  it('真实单音标不误报', () => {
    const html = '<p>Chinese 读 /ˌtʃaɪˈniːz/，末字母 s 发 /z/。</p>';
    expect(detectPhonemeConflicts(html)).toEqual([]);
  });
});
