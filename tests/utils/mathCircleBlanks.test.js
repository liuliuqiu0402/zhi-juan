import { describe, it, expect } from 'vitest';
import { normalizeMathCircleBlanks, normalizeBlankMarkers, cleanSectionHtml } from '../../src/utils/contentCleaner.js';

describe('normalizeMathCircleBlanks 数学算式填空圈归一（○ → 1.8em 圆形填空容器）', () => {
  it('算式比较中的 ○（两侧为数字）→ span.math-circle-blank-18', () => {
    expect(normalizeMathCircleBlanks('<p>5○3 比较大小</p>')).toBe('<p>5<span class="math-circle-blank-18">&nbsp;</span>3 比较大小</p>');
  });

  it('运算式填空中的 ○（运算符相邻）→ span.math-circle-blank-18', () => {
    expect(normalizeMathCircleBlanks('<p>3＋○＝7</p>')).toBe('<p>3＋<span class="math-circle-blank-18">&nbsp;</span>＝7</p>');
  });

  it('括号紧邻的算式 ○ → span.math-circle-blank-18', () => {
    expect(normalizeMathCircleBlanks('<p>（○）＋2＝5</p>')).toBe('<p>（<span class="math-circle-blank-18">&nbsp;</span>）＋2＝5</p>');
  });

  it('题干文字"在○里填"中的 ○（相邻为汉字）保持不变，不误伤', () => {
    expect(normalizeMathCircleBlanks('<p>在○里填上合适的数字</p>')).toBe('<p>在○里填上合适的数字</p>');
  });

  it('普通句子中的 ○ 保持不变', () => {
    expect(normalizeMathCircleBlanks('<p>请把正确答案写在○中。</p>')).toBe('<p>请把正确答案写在○中。</p>');
  });

  it('同段混合：题干 ○ 不转、算式 ○ 转（仅算式语境生效）', () => {
    expect(normalizeMathCircleBlanks('<p>在○里填上"＞""＜"或"="：5○3</p>')).toBe(
      '<p>在○里填上"＞""＜"或"="：5<span class="math-circle-blank-18">&nbsp;</span>3</p>'
    );
  });

  it('幂等：已转换结果再次归一不重复包裹', () => {
    const once = normalizeMathCircleBlanks('<p>5○3 比较</p>');
    expect(normalizeMathCircleBlanks(once)).toBe(once);
  });

  it('与 cleanSectionHtml 组合（生成端同款归一链）', () => {
    const src = '```html\n<p>7○9 比大小</p>\n```';
    expect(normalizeMathCircleBlanks(cleanSectionHtml(src))).toBe('<p>7<span class="math-circle-blank-18">&nbsp;</span>9 比大小</p>');
  });

  it('空输入安全返回', () => {
    expect(normalizeMathCircleBlanks('')).toBe('');
    expect(normalizeMathCircleBlanks(null)).toBe('');
  });
});

describe('normalizeMathCircleBlanks 方框 □ 对称归一（C6：算式语境 □ → square-box，与 ○ 同性质）', () => {
  it('算式填空中的 □（如 3＋□＝8）→ span.square-box（曾裸字形无载体语义）', () => {
    expect(normalizeMathCircleBlanks('<p>3＋□＝8</p>')).toBe('<p>3＋<span class="square-box">&nbsp;</span>＝8</p>');
  });

  it('多个 □ 同段逐个转换（□＋□＝10）', () => {
    expect(normalizeMathCircleBlanks('<p>□＋□＝10</p>')).toBe(
      '<p><span class="square-box">&nbsp;</span>＋<span class="square-box">&nbsp;</span>＝10</p>'
    );
  });

  it('题干"在□里填数"的 □（相邻为汉字）保持不变，不误伤', () => {
    expect(normalizeMathCircleBlanks('<p>在□里填上合适的数。</p>')).toBe('<p>在□里填上合适的数。</p>');
  });

  it('同段混合：题干 □ 不转、算式 □ 转、算式 ○ 转', () => {
    expect(normalizeMathCircleBlanks('<p>在□里填数：3＋□＝8，5○3</p>')).toBe(
      '<p>在□里填数：3＋<span class="square-box">&nbsp;</span>＝8，5<span class="math-circle-blank-18">&nbsp;</span>3</p>'
    );
  });

  it('算式表示式首个 □（左侧为中文标点/叙述边界）不漏转（C6 补盲：左侧不再强制数学项）', () => {
    expect(normalizeMathCircleBlanks('<p>（3）用乘法算式表示：□×□＝12（人）</p>')).toBe(
      '<p>（3）用乘法算式表示：<span class="square-box">&nbsp;</span>×<span class="square-box">&nbsp;</span>＝12（人）</p>'
    );
  });

  it('数字实体形态（&#x25A1;）先解码再转换（实体解码在 blank 归一入口，与字面路径产物一致）', () => {
    // 生成端链：normalizeBlankMarkers（入口解码数字实体）→ normalizeMathCircleBlanks
    expect(normalizeMathCircleBlanks(normalizeBlankMarkers('<p>3＋&#x25A1;＝8</p>'))).toBe('<p>3＋<span class="square-box">&nbsp;</span>＝8</p>');
  });

  it('幂等：square-box 结果再次归一不重复包裹', () => {
    const once = normalizeMathCircleBlanks('<p>□＋□＝10</p>');
    expect(normalizeMathCircleBlanks(once)).toBe(once);
  });
});

describe('normalizeMathCircleBlanks 算式占位兜底（模型写空格/下划线占位 → 单个方框，数字整体一格）', () => {
  // 生成链实序：normalizeBlankMarkers（空格/＿→u.blank-N）→ normalizeMathCircleBlanks（算式语境 u → 方框）
  const chain = (h) => normalizeMathCircleBlanks(normalizeBlankMarkers(h));

  it('算式填空的空格占位（× 两侧、＝ 后）→ 每个空位一个 square-box', () => {
    const src = '<p>（3）用乘法算式表示：' + '　'.repeat(6) + '×' + '　'.repeat(6) + '＝' + '　'.repeat(6) + '（人）</p>';
    expect(chain(src)).toBe(
      '<p>（3）用乘法算式表示：<span class="square-box">&nbsp;</span>×<span class="square-box">&nbsp;</span>＝<span class="square-box">&nbsp;</span>（人）</p>'
    );
  });

  it('算式填空的下划线占位（＿ 已归一为 u.blank）同样收口为方框', () => {
    expect(chain('<p>3＋＿＿＝7</p>')).toBe('<p>3＋<span class="square-box">&nbsp;</span>＝7</p>');
  });

  it('文本空位不受影响（我的发现：＿＿＿。两侧为汉字/句号 → 保持空白横线）', () => {
    const out = chain('<p>我的发现：' + '　'.repeat(8) + '。</p>');
    expect(out).toContain('<u class="blank-16">&emsp;</u>');
    expect(out).not.toContain('square-box');
  });

  it('正常算式空格排版（半角单空格）不受影响，无空位不产生方框', () => {
    expect(chain('<p>5 × 3 ＝ 15（人）</p>')).toBe('<p>5 × 3 ＝ 15（人）</p>');
  });

  it('幂等：算式方框产物再次走完整链不重复/不回退', () => {
    const once = chain('<p>' + '　'.repeat(6) + '×' + '　'.repeat(6) + '＝10</p>');
    expect(chain(once)).toBe(once);
  });
});
