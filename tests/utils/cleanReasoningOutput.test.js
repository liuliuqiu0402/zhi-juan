// 答案页"静默清零"回归 + 续写拼接语义（2026-09-10 根治）
// ============================================================
// 事故链：模型（规范要求 HTML）偶发违规吐纯文本 → cleanReasoningOutput 末尾"全文无 HTML → return ''"
// 把有效内容整段清零 → 答案页 SSE 有 1641 字符仍判"过短（0 字符）"→ 重试再清零 → 入库无答案区。
// 本测试锁死两条契约：
//   ① 纯文本/Markdown 违规输出不再清零，按行包裹 <p> 保留内容（真无内容才返回 ''）；
//   ② 续写段拼接只做"去重追加"，绝不覆盖已有内容（正文"断续缺块"根治）。
import { describe, it, expect } from 'vitest';
import {
  cleanReasoningOutput,
  stripLeadingAnswerTitle,
  appendContinuationWithDedup,
} from '../../src/composables/useAiGenerator.js';

describe('cleanReasoningOutput·纯文本不清零（答案页静默清零事故根治）', () => {
  it('🔴 纯文本答案（无 HTML）→ 按行包裹 <p>，内容不得整段清零', () => {
    const a = cleanReasoningOutput('参考答案与解析\n1. A\n2. B\n3. C\n4. 略');
    expect(a).not.toBe('');
    expect(a).toContain('<p>参考答案与解析</p>');
    expect(a).toContain('<p>1. A</p>');
    expect(a).toContain('<p>2. B</p>');
    expect(a).toContain('<p>4. 略</p>');
  });

  it('Markdown 标题符/加粗标记 → 剥除后包裹（不残留 ## 与 **）', () => {
    const a = cleanReasoningOutput('## 参考答案\n**1.** 答案：A。\n**2.** 答案：B。');
    expect(a).toContain('<p>参考答案</p>');
    expect(a).toContain('<p>1. 答案：A。</p>');
    expect(a).toContain('<p>2. 答案：B。</p>');
    expect(a).not.toContain('##');
    expect(a).not.toContain('**');
  });

  it('真无有效内容（空白/过短寒暄）→ 仍返回 ""（走重试/报告，不产出垃圾）', () => {
    expect(cleanReasoningOutput('   \n  ')).toBe('');
    expect(cleanReasoningOutput('好的')).toBe('');
  });

  it('正常 HTML 输出 → 原样通过（回归：不清零、不包裹）', () => {
    const html = '<h2>一、基础建构任务</h2><p>1. 题目</p>';
    expect(cleanReasoningOutput(html)).toBe(html);
  });

  it('端到端链：纯文本包裹后，自带首行标题以 <p> 形态被 stripLeadingAnswerTitle 剥除', () => {
    const wrapped = cleanReasoningOutput('参考答案与解析\n1. A\n2. B\n3. C\n4. D');
    const stripped = stripLeadingAnswerTitle(wrapped);
    expect(stripped.startsWith('<p>参考答案与解析</p>')).toBe(false);
    expect(stripped).toContain('<p>1. A</p>');
  });
});

describe('续写拼接 appendContinuationWithDedup（续写段绝不覆盖已有内容）', () => {
  it('无重叠 → 直接追加（前缀完整保留）', () => {
    const base = '<p>第一段</p>';
    expect(appendContinuationWithDedup(base, '<p>第二段</p>')).toBe(base + '\n<p>第二段</p>');
  });

  it('续写段从末尾精确重述（≤20 字）→ 去重后追加', () => {
    const base = '<p>春天来了，<b>柳树发芽</b></p>';
    const tail = base.slice(-20);
    expect(appendContinuationWithDedup(base, tail + '<p>燕子归来</p>')).toBe(base + '\n<p>燕子归来</p>');
  });

  it('续写段与末尾渐进重叠（3~15 字）→ 去重后追加', () => {
    const base = '<p>一二三四五六七八九十</p>';
    expect(appendContinuationWithDedup(base, '九十</p><p>新内容</p>')).toBe(base + '\n<p>新内容</p>');
  });

  it('纯重复段（去重后为空）→ 不追加（不产生重复）', () => {
    const base = '<p>完整内容完整内容</p>';
    expect(appendContinuationWithDedup(base, base.slice(-20))).toBe(base);
  });
});
