// B·标题真题样式（渲染期，2026-10-17）回归
// 只做**写法**归一：标题"（共X分）"+ 题内唯一单价 → "（每〈计分对象〉X分，共Y分）"。
// 三条硬门：单价恰好出现一次／单价恰好一种／总数能被单价整除且个数>1；任一不满足一律不动（不改数、不硬造）。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const OPTS = { subject: '数学', stage: 'primary_mid', genType: 'exam' };
const run = (html) => auditExamPaper(html, OPTS);
const titles = (html) => [...html.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);

describe('B·标题真题样式的三条硬门', () => {
  it('单价只出现一次 + 总数可整除 → 标题补成真题写法（总数不变）', () => {
    const html = [
      '<h1>三上数学阶段测评</h1><p>满分：100分</p>',
      '<h3>一、填空题（共24分）</h3>',
      '<p>每空1分。</p>',
      '<p>1. 3×4＝____　5×6＝____</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('一、填空题（每空1分，共24分）');
    expect(r.issues.some((x) => x.type === 'title-detail' && x.message.includes('大题标题已补单价'))).toBe(true);
  });

  it('单价是 0.5 档 → 个数为整数，仍拼成真题写法', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>二、判断题（共4分）</h3>',
      '<p>每处0.5分。</p>',
      '<p>1. 3×4＝12（　）</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('二、判断题（每处0.5分，共4分）');
  });

  it('单价逐题干重复（模型已按分值条标注）→ 不补标题，避免一题三处并存', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（共8分）</h3>',
      '<p>1. ____（每空1分，共4分）</p>',
      '<p>2. ____（每空1分，共4分）</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('一、填空题（共8分）');
    expect(r.issues.some((x) => x.type === 'title-detail' && x.message.includes('大题标题已补单价'))).toBe(false);
  });

  it('题内那一处已是完整的"每X分，共Y分"（单价与总数都在题干）→ 不再补标题，避免重复', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（共8分）</h3>',
      '<p>1. 填一填（每空1分，共8分）</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('一、填空题（共8分）');
    expect(r.issues.some((x) => x.type === 'title-detail' && x.message.includes('大题标题已补单价'))).toBe(false);
  });

  it('单价多于一种（本大题不等分）→ 不动', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（共6分）</h3>',
      '<p>每空1分。</p>',
      '<p>每空2分。</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('一、填空题（共6分）');
  });

  it('总数不能被单价整除 → 不动（不硬造、不除不尽）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（共5分）</h3>',
      '<p>每空2分。</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('一、填空题（共5分）');
  });

  it('题内没写单价 → 不动（程序不硬造单价）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（共10分）</h3>',
      '<p>1. ____　____</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('一、填空题（共10分）');
  });

  it('已是真题写法 → 幂等（再跑一次不再叠加）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（每空1分，共24分）</h3>',
      '<p>1. ____</p>',
    ].join('\n');
    const once = run(html).html;
    expect(titles(once)).toContain('一、填空题（每空1分，共24分）');
    const twice = run(once).html;
    expect(titles(twice)).toContain('一、填空题（每空1分，共24分）');
  });
});
