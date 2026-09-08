import { normalizeMathCircleBlanks, normalizeBlankMarkers } from '../../src/utils/contentCleaner.js';

describe('等号后得数结果位 → 留白（计算/口算/应用题结果位，2026-09 载体根治）', () => {
  const chain = (h) => normalizeMathCircleBlanks(normalizeBlankMarkers(h));

  it('五年级口算结果位（原始"＝□"字面）→ 留白，不转方框', () => {
    expect(normalizeMathCircleBlanks('<p>2.4×1.6＝□</p>')).toBe('<p>2.4×1.6＝&emsp;</p>');
  });

  it('五年级口算结果位（等号后空格占位）→ 横向留白书写线，不转方框', () => {
    const out = chain('<p>0.35×0.8＝' + '　'.repeat(6) + '</p>');
    expect(out).toBe('<p>0.35×0.8＝<u class="blank-6">&emsp;</u></p>'); // 留白书写位（＝＿＿下划线惯例），非方框
    expect(out).not.toContain('square-box');
  });

  it('已入库的"＝<span class=square-box>"结果位 → 解壳为留白', () => {
    expect(normalizeMathCircleBlanks('<p>(1) 2.4×1.6＝<span class="square-box">　</span></p>'))
      .toBe('<p>(1) 2.4×1.6＝&emsp;</p>');
  });

  it('应用题算式结果位＋单位（＝＿（人））→ 留白，不方框', () => {
    expect(normalizeMathCircleBlanks('<p>56÷4＝<span class="square-box">&nbsp;</span>（人）</p>'))
      .toBe('<p>56÷4＝&emsp;（人）</p>');
  });

  it('缺数填空位（3＋□＝8、□×□＝12）→ 仍方框，不被结果位守卫误伤', () => {
    expect(normalizeMathCircleBlanks('<p>3＋□＝8</p>')).toBe('<p>3＋<span class="square-box">&nbsp;</span>＝8</p>');
    expect(chain('<p>□×□＝12（人）</p>'))
      .toBe('<p><span class="square-box">&nbsp;</span>×<span class="square-box">&nbsp;</span>＝12（人）</p>');
  });

  it('填数算式"用算式表示：□×□＝□（人）"结果位保留方框（整式填空，非结果位）', () => {
    const src = '<p>（3）用乘法算式表示：' + '　'.repeat(4) + '×' + '　'.repeat(4) + '＝' + '　'.repeat(4) + '（人）</p>';
    expect(chain(src))
      .toBe('<p>（3）用乘法算式表示：<span class="square-box">&nbsp;</span>×<span class="square-box">&nbsp;</span>＝<span class="square-box">&nbsp;</span>（人）</p>');
  });

  it('比较大小○（5○3）与题干○ 语义不变', () => {
    expect(normalizeMathCircleBlanks('<p>5○3 比较大小</p>')).toBe('<p>5<span class="math-circle-blank-18">&nbsp;</span>3 比较大小</p>');
    expect(normalizeMathCircleBlanks('<p>在○里填上">""<"或"="。</p>')).toBe('<p>在○里填上">""<"或"="。</p>');
  });

  it('整链幂等：结果位留白后再归一不回退成方框', () => {
    const once = normalizeMathCircleBlanks('<p>2.4×1.6＝□</p>');
    expect(normalizeMathCircleBlanks(once)).toBe(once);
  });

  it('用户实证样例：计算并列小题 (1)(2)(3) 等号后既有方框容器 → 全部解壳留白', () => {
    // 用户 2026-09 反馈原文：↲ <p class="blank-area">…</p> 之后 (1) 2.4×1.6＝<span class="square-box">　</span> 等
    const src = [
      '<h3>二、掌握小数乘法的计算方法</h3>',
      '<p class="question">3. 先按照整数乘法算出积，再确定积的小数点位置。</p>',
      '<p class="blank-area" style="height: 8mm;">　</p>',
      '<p class="blank-area" style="height: 8mm;">　</p>',
      '<p class="question">(1) 2.4×1.6＝<span class="square-box">　</span></p>',
      '<p class="question">(2) 0.35×0.8＝<span class="square-box">　</span></p>',
      '<p class="question">(3) 3.06×2.5＝<span class="square-box">　</span></p>',
      '<p class="question">4. 直接写得数：2.4×1.6＝□　0.35×0.8＝□　3.06×2.5＝□</p>',
    ].join('');
    const out = normalizeMathCircleBlanks(src);
    // 既有方框容器（(1)-(3)）一律解壳留白书写位
    expect(out).not.toContain('square-box');
    expect(out).toContain('(1) 2.4×1.6＝&emsp;');
    expect(out).toContain('(2) 0.35×0.8＝&emsp;');
    expect(out).toContain('(3) 3.06×2.5＝&emsp;');
    // 句内直接写得数（各得数项彼此仅空格间隔、前有算式）→ 结果位留白
    expect(out).toContain('2.4×1.6＝&emsp;');
  });
});