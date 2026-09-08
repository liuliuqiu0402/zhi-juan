/**
 * 畸形填空载体拆壳 + 英文省略号三点（2026-09 收口）
 * ============================================================
 * 保证：①blank-N 语义不变量——空书写位内部不允许正文文字：
 *       整段/整句被包（≥6 非空字符）→ 拆壳还原纯文本；块级标题 h1~h6 内
 *       不允许填空载体（无论长短都还原）；真填空位（&emsp;）不受影响；
 *       ②英文省略号三点：无汉字语境下的六点/四点省略号归一为 …；
 *       中文说明里的六点省略号保持（中文合法标点）。
 */
import { describe, it, expect } from 'vitest';
import { unwrapMalformedBlankCarriers, normalizeEnglishEllipsis } from '../../src/utils/contentCleaner.js';

describe('畸形填空载体拆壳（不变量守卫）', () => {
  it('整句被包进 blank-N → 拆壳还原纯文本（去掉误画线）', () => {
    const html = '<p><u class="blank-4">（2）I like P  best. I can run and play on the sports ground.</u></p>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).not.toContain('<u class="blank-4">');
    expect(out).toContain('I like P  best. I can run');
  });

  it('块级标题内被包（h2/h3）→ 一律还原标题文本', () => {
    const html = '<h3><u class="blank-4">【典型例题1】词汇运用（识记层次）</u></h3>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).toContain('<h3>【典型例题1】词汇运用（识记层次）</h3>');
    expect(out).not.toContain('blank-4');
  });

  it('真填空位（仅 &emsp; 空白）不受影响', () => {
    const html = '<p>0.7 × 0.3 ＝ <u class="blank-4">&emsp;</u>，表示求 0.7 的 <u class="blank-3">&emsp;</u> 是多少。</p>';
    expect(unwrapMalformedBlankCarriers(html)).toBe(html);
  });

  it('幂等：二次处理结果不变', () => {
    const html = '<p><u class="blank-4">We have C , English, Maths and other subjects at school.</u></p>';
    const once = unwrapMalformedBlankCarriers(html);
    expect(unwrapMalformedBlankCarriers(once)).toBe(once);
  });
});

describe('英文省略号三点归一', () => {
  it('无汉字语境六点 → 三点（英文句子）', () => {
    expect(normalizeEnglishEllipsis('I like English best…… It is interesting.'))
      .toBe('I like English best… It is interesting.');
  });

  it('中文说明里的六点省略号保持不动', () => {
    const zh = '他在本单元学会了多门科目……还了解了英式与美式的区别。';
    expect(normalizeEnglishEllipsis(zh)).toBe(zh);
  });

  it('无省略号内容原样返回', () => {
    expect(normalizeEnglishEllipsis('plain text')).toBe('plain text');
  });
});
