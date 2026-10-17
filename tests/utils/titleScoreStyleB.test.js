// B·标题样式的真题化（渲染期，2026-10-17 按属主方案）回归
// A 侧：标题「（共X分）」＋**每个独立题干后**「每〈计分对象〉X分，共Y分」。
// B 侧：只做**样式转换**，两条路——
//   ① 单价只有一种 → 「（每〈计分对象〉X分，共Y分）」；
//   ② 单价有多种且每个独立题干都带编号与单价 → 分组式「（第1、3小题各1分，第2、4小题各2分，共6分）」。
// 不管自洽、不改数、不删正文（题内标注保留，它是逐题对账的落点）。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const OPTS = { subject: '数学', stage: 'primary_mid', genType: 'exam' };
const run = (html) => auditExamPaper(html, OPTS);
const titles = (html) => [...html.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);

describe('B：标题「（共X分）」→ 真题标分样式', () => {
  it('单价只有一种 → 「（每空1分，共14分）」，且题内标注保留', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（共14分）</h3>',
      '<p>1. 3×4＝____　5×6＝____（每空1分，共4分）</p>',
      '<p>2. 7×8＝____（每空1分，共1分）</p>',
      '<p>3. 9×9＝____（每空1分，共1分）</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('一、填空题（每空1分，共14分）');
    expect(r.issues.some((x) => x.type === 'title-detail' && x.message.includes('真题标分样式'))).toBe(true);
    expect(r.html).toContain('（每空1分，共4分）');
    expect((r.html.match(/每空1分/g) || []).length, '题内标注不得被删').toBeGreaterThanOrEqual(3);
  });

  it('单价有多种、每组两题 → 分组式（第1、3小题各1分，第2、4小题各2分，共6分）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>二、计算题（共6分）</h3>',
      '<p>1. 3×4＝____（每式1分，共1分）</p>',
      '<p>2. 12×5＝____（每式2分，共2分）</p>',
      '<p>3. 7×8＝____（每式1分，共1分）</p>',
      '<p>4. 25×4＝____（每式2分，共2分）</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('二、计算题（第1、3小题各1分，第2、4小题各2分，共6分）');
  });

  it('单价有多种、某组只有一题 → 该组写"第X小题Y分"（不用"各"）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>三、计算题（共12分）</h3>',
      '<p>1. 直接写出得数。（每式1分，共6分）</p>',
      '<p>2. 列竖式计算。（每式2分，共6分）</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('三、计算题（第1小题1分，第2小题2分，共12分）');
  });

  it('有题干没标单价（归不了类）→ 不动，标题保持「（共X分）」', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>四、计算题（共12分）</h3>',
      '<p>1. 直接写出得数。（每式1分，共6分）</p>',
      '<p>2. 列竖式计算。（共6分）</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('四、计算题（共12分）');
  });

  it('答案区的同名大题标题同样被转换（同一规则跑整份，天然同步）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（共4分）</h3>',
      '<p>1. ____（每空1分，共1分）</p>',
      '<h2>参考答案与评分标准</h2>',
      '<h3>一、填空题（共4分）</h3>',
      '<p>1. 答案（每空1分，共1分）</p>',
    ].join('\n');
    const out = run(html).html;
    expect((out.match(/一、填空题（每空1分，共4分）/g) || []).length, '正文与答案区都应转').toBe(2);
  });

  it('标题已带单价（大题标题即题干）→ 不动（幂等）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>三、看图写话（每空1分，共8分）</h3>',
      '<p>____</p>',
    ].join('\n');
    const once = run(html).html;
    expect(titles(once)).toContain('三、看图写话（每空1分，共8分）');
    expect(titles(run(once).html)).toContain('三、看图写话（每空1分，共8分）');
  });

  it('题内没有单价 → 不动（程序不硬造单位）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>四、填空题（共10分）</h3>',
      '<p>1. ____　____</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('四、填空题（共10分）');
  });

  it('0.5 分档同样只做样式转换（不做除法、不算个数）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>五、判断题（共7分）</h3>',
      '<p>1. 3×4＝12（　）（每空0.5分，共0.5分）</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('五、判断题（每空0.5分，共7分）');
  });
});
