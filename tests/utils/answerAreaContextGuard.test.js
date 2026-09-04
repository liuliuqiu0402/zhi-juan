// 专用作答区语境防错配回归（2026-09）：
// 竖式/作图/填表类题题内确无任何作答载体时，2k 通用补差（横线/空白行）属错配 → 改为静默抽检提示；
// 已有对应载体（bracket-grid/draw-area/square-grid/<table>/填空位/作答行）一律不打扰；
// 普通解答应用题（无专用语境）仍维持原 blank-area 补差。全程只读判定，不碰模型 prompt。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const runMath = (html) => auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
const runYw = (html) => auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
const hasGuard = (r, kw) => r.silentDetails.some(d => d.type === 'answer-area' && d.message.includes(kw));

describe('专用作答区语境防错配（竖式/作图/填表无载体 → 不补通用空白，静默抽检）', () => {
  it('竖式题（用竖式计算）无任何载体 → 不补 blank-area，报"竖式"抽检', () => {
    const html = [
      '<h1>三上数学期中测试</h1><p>满分：100分</p>',
      '<h2>二、计算（共1题，共12分）</h2>',
      '<p>1. 用竖式计算下面各题。（12分）</p>',
      '<p>（1）45＋27＝</p><p>（2）63－39＝</p>',
    ].join('\n');
    const r = runMath(html);
    expect(r.html).not.toContain('blank-area'); // 不补 generic 空白行
    expect(hasGuard(r, '竖式')).toBe(true);
  });

  it('竖式题已有括号填空位（＝（　　））→ 视为已提供作答空间，不提示不补', () => {
    const html = [
      '<h1>三上数学期中测试</h1><p>满分：100分</p>',
      '<h2>二、计算（共1题，共12分）</h2>',
      '<p>1. 用竖式计算下面各题。（12分）</p>',
      '<p>（1）45＋27＝（　　）</p><p>（2）63－39＝（　　）</p>',
    ].join('\n');
    const r = runMath(html);
    expect(r.html).not.toContain('blank-area');
    expect(hasGuard(r, '竖式')).toBe(false);
  });

  it('作图题（画出…对称轴）无载体 → 定向补 draw-area 虚线作图区（不再补 generic，也不提示缺载体）', () => {
    const html = [
      '<h1>三上数学期中测试</h1><p>满分：100分</p>',
      '<h2>三、操作（共1题，共6分）</h2>',
      '<p>2. 画出下面图形的对称轴。（6分）</p>',
    ].join('\n');
    const r = runMath(html);
    expect(r.html).toContain('class="draw-area"');
    expect(r.html).not.toContain('blank-area');
    expect(hasGuard(r, '作图')).toBe(false);
    expect(r.issues.some(i => i.type === 'answer-area' && i.message.includes('作图区'))).toBe(true);
  });

  it('作图题已有 square-grid（方格纸）→ 有作图空间，不补 draw-area 不提示', () => {
    const html = [
      '<h1>三上数学期中测试</h1><p>满分：100分</p>',
      '<h2>三、操作（共1题，共6分）</h2>',
      '<p>2. 画出下面图形的对称轴。（6分）</p>',
      '<div class="square-grid"></div>',
    ].join('\n');
    const r = runMath(html);
    expect(r.html).not.toContain('draw-area');
    expect(hasGuard(r, '作图')).toBe(false);
  });

  it('填表题（用表格整理…）无表格 → 不补 blank-area，报"填表"抽检', () => {
    const html = [
      '<h1>三上数学期中测试</h1><p>满分：100分</p>',
      '<h2>四、统计（共1题，共8分）</h2>',
      '<p>3. 用表格整理全班同学最喜欢的水果。（8分）</p>',
    ].join('\n');
    const r = runMath(html);
    expect(r.html).not.toContain('blank-area');
    expect(hasGuard(r, '填表')).toBe(true);
  });

  it('填表题已输出 <table> → 有作答表格，不提示不补', () => {
    const html = [
      '<h1>三上数学期中测试</h1><p>满分：100分</p>',
      '<h2>四、统计（共1题，共8分）</h2>',
      '<p>3. 用表格整理全班同学最喜欢的水果。（8分）</p>',
      '<table><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table>',
    ].join('\n');
    const r = runMath(html);
    expect(r.html).not.toContain('blank-area');
    expect(hasGuard(r, '填表')).toBe(false);
  });

  it('负例：普通解决问题应用题（无专用语境）→ 仍按原逻辑补 blank-area，不误伤', () => {
    const html = [
      '<h1>三上数学期中测试</h1><p>满分：100分</p>',
      '<h2>五、解决问题（共1题，共6分）</h2>',
      '<p>5. 商店运来48箱苹果，卖出25箱，还剩多少箱？（6分）</p>',
    ].join('\n');
    const r = runMath(html);
    expect(r.html).toContain('blank-area'); // 原通用补差保留
    expect(hasGuard(r, '竖式') || hasGuard(r, '作图') || hasGuard(r, '填表')).toBe(false);
  });

  it('读表答题（观察统计表回答问题，非作答填表）→ 不误判为填表题', () => {
    const html = [
      '<h1>三上数学期中测试</h1><p>满分：100分</p>',
      '<h2>四、统计（共1题，共6分）</h2>',
      '<p>6. 观察下面的统计表，回答问题。（6分）</p>',
      '<table><tr><td>苹果</td><td>8</td></tr></table>',
    ].join('\n');
    const r = runMath(html);
    expect(hasGuard(r, '填表')).toBe(false);
  });
});

describe('语文低段描红/书法缺米字格 debug 抽检（2j-4c）', () => {
  it('描红题无 mi-zi-ge → debug 级抽检留痕（不进问题列表）', () => {
    const html = [
      '<h1>一年级语文写字练习</h1><p>满分：100分</p>',
      '<h2>一、书写（共1题，共10分）</h2>',
      '<p>1. 描红下面的汉字。（10分）</p>',
    ].join('\n');
    const r = runYw(html);
    const hit = r.silentDetails.find(d => d.type === 'writing-grid' && d.message.includes('米字格'));
    expect(hit).toBeTruthy();
    expect(hit.level).toBe('debug');
  });

  it('已有 mi-zi-ge → 不抽检', () => {
    const html = [
      '<h1>一年级语文写字练习</h1><p>满分：100分</p>',
      '<h2>一、书写（共1题，共10分）</h2>',
      '<p>1. 描红下面的汉字。（10分）</p>',
      '<div class="mi-zi-ge"><span>&emsp;</span><span>&emsp;</span></div>',
    ].join('\n');
    const r = runYw(html);
    expect(r.silentDetails.some(d => d.type === 'writing-grid' && d.message.includes('米字格'))).toBe(false);
  });
});
