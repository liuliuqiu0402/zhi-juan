// 复位工程·S5 文字保真专项：生成后处理链（形态层函数）不得改动任何正文语义文字——
// 程序只改标记/容器/结构（载体、○→框、缩进、序号、md 残留），题干文字（数字/算式/标点/汉字）须逐字符不变。
import { describe, it, expect } from 'vitest';
import {
  cleanSectionHtml, normalizeBlankMarkers, normalizeMatchQuestions,
  normalizeMathCircleBlanks, normalizeLeadingMarkers, normalizeIndents,
} from '../../src/utils/contentCleaner.js';
import { stripHtmlForRecon } from '../../src/utils/coverageReconciler.js';

const chain = (html) => normalizeIndents(
  normalizeLeadingMarkers(
    normalizeMatchQuestions(
      normalizeMathCircleBlanks(
        normalizeBlankMarkers(cleanSectionHtml(html)),
      ),
    ),
  ),
);

/** 可见文字（去标签 + 折叠空白）——形态层改动不得影响其内容 */
const textOf = (html) => stripHtmlForRecon(html).replace(/\s+/g, '');

describe('生成后处理链文字保真（S5：程序只改形态不改语义）', () => {
  it('题干算式文字（数字/运算符/等号/标点）逐字符不变', () => {
    const html = '<h2>一、计算</h2><p>3.2÷0.8＝4，商的小数点要和被除数的小数点对齐。</p>'
      + '<p>12.5×0.8＝10，先按整数乘法算出积，再点小数点。</p>';
    expect(textOf(chain(html))).toBe(textOf(html));
  });

  it('情境/应用题文字（汉字、数字、单位）保真', () => {
    const html = '<h3>二、解决问题</h3><p>每千克苹果 8.5 元，妈妈买了 3 千克，一共应付多少元？</p>'
      + '<p>一块长方形菜地长 12.6 米，宽 5.4 米，面积是多少平方米？</p>';
    expect(textOf(chain(html))).toBe(textOf(html));
  });

  it('选择/判断题题干与选项文字保真（无载体形态时不受影响）', () => {
    const html = '<p>下面各数中，最大的是（　）。</p><p>大于 0.5 而小于 0.6 的小数有无数个。这种说法对吗？</p>';
    // （　）括号空位属书写空载体 → 载体前段题干文字保真即可
    const t1 = textOf(chain(html));
    expect(t1).toContain('下面各数中，最大的是');
    const q2 = '<p>大于 0.5 而小于 0.6 的小数有无数个。这种说法对吗？</p>';
    expect(textOf(chain(q2))).toBe(textOf(q2));
  });

  it('markdown 残留清理不改变正文文字（代码围栏被剥除、内容保留）', () => {
    const html = '```html\n<h2>三、填空</h2><p>把 4.8 扩大到原来的 10 倍是 48。</p>\n```';
    expect(textOf(chain(html))).toBe(textOf('<h2>三、填空</h2><p>把 4.8 扩大到原来的 10 倍是 48。</p>'));
  });
});
