// 标题分值形态：**程序不得把单价搬进标题**（2026-10-19 反向锁）
// ============================================================
// 背景（属主："分值固定在大标题标注，这个方向有查吗"）：
//   原 `title-detail-fix` 有一条"真题样式转换支"——入口是「标题以（共X分）结尾」＋
//   「题内单价只有一种、每个带号题干都标了单价」。这**恰好是 A 侧"有独立题干"的签名**，
//   于是 A 按 A+B 写成"标题（共X分）＋每题干后单价"，程序又把单价搬回标题（多档时写成
//   "第1、3小题各1分…"）⇒ 卷面永远呈现"分值在标题"，A+B 的第 1 种情况被抹掉。
// 处置：该支整支删除；只保留 1.6 的「旧式裸（X分）→（共X分）」形态兜底（不改数、不搬单价）。
// 本文件改为**反向锁**：A 的两种标题形态都不得被程序改写。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const OPTS = { subject: '数学', stage: 'primary_mid', genType: 'exam' };
const run = (html) => auditExamPaper(html, OPTS);
const titles = (html) => [...html.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);
const rewrote = (r) => r.issues.some((x) => x.type === 'title-detail' && /真题标分样式/.test(x.message));

describe('标题分值：程序不搬单价（A+B 的 A 侧形态不得被改写）', () => {
  it('有独立题干、单价唯一 → 标题保持「（共14分）」，题内单价不动', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（共14分）</h3>',
      '<p>1. 3×4＝____　5×6＝____（每空1分，共4分）</p>',
      '<p>2. 7×8＝____（每空1分，共1分）</p>',
      '<p>3. 9×9＝____（每空1分，共1分）</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('一、填空题（共14分）');
    expect(titles(r.html).join('|'), '标题不得出现单价').not.toContain('每空1分');
    expect(rewrote(r), '不得再报"真题标分样式"').toBe(false);
    expect((r.html.match(/每空1分/g) || []).length, '题内标注必须保留（逐题对账的落点）').toBe(3);
  });

  it('有独立题干、单价多档 → 标题保持「（共6分）」，不得写成"第1、3小题各…"', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>二、计算题（共6分）</h3>',
      '<p>1. 3×4＝____（每式1分，共1分）</p>',
      '<p>2. 12×5＝____（每式2分，共2分）</p>',
      '<p>3. 7×8＝____（每式1分，共1分）</p>',
      '<p>4. 25×4＝____（每式2分，共2分）</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('二、计算题（共6分）');
    expect(titles(r.html).join('|')).not.toContain('小题');
    expect(rewrote(r)).toBe(false);
    expect((r.html.match(/每式\d分/g) || []).length, '四条题内单价全保留').toBe(4);
  });

  it('答案区同名大题标题同样不得被改写（同一规则跑整份）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空题（共4分）</h3>',
      '<p>1. ____（每空1分，共1分）</p>',
      '<h2>参考答案与评分标准</h2>',
      '<h3>一、填空题（共4分）</h3>',
      '<p>1. 答案（每空1分，共1分）</p>',
    ].join('\n');
    const out = run(html).html;
    expect((out.match(/一、填空题（共4分）/g) || []).length, '正文与答案区都保持（共4分）').toBe(2);
    expect(out).not.toContain('一、填空题（每空1分');
  });

  it('旧式裸「（14分）」→「（共14分）」形态兜底仍在（1.6 保留）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>三、填空题（14分）</h3>',
      '<p>1. ____（每空1分，共1分）</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('三、填空题（共14分）');
  });

  it('标题已带单价（无独立题干）→ 原样不动（幂等）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>四、看图写话（每空1分，共8分）</h3>',
      '<p>____</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('四、看图写话（每空1分，共8分）');
  });
});
