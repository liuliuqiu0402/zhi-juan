/**
 * wrapBareBlankRuns 中句语义填空位兜底（2026-09 收口）
 * ============================================================
 * 背景：模型把题干中的答案空位输出为裸空格串（"求 4 个　　　　相加的和""0.6×0.3＝　×　＝　。"），
 * 规则②只覆盖行尾/句读前，中句空位此前原样保留 → docx 无书写横线。规则③按"语义夹缝"
 * （CJK 夹缝 / 算式空位链）兜底转 u.blank-N；排版分隔（数字列距/图形间距/单位括号前）不转。
 */
import { describe, it, expect } from 'vitest';
import { wrapBareBlankRuns } from '../../src/utils/contentCleaner.js';

describe('wrapBareBlankRuns 中句语义填空位（规则③）', () => {
  it('CJK 夹缝：量词后的概念空位（"4 个　　　　相加"）→ u.blank-N', () => {
    const html = '<p>（1）求买 4 本练习本要付多少元，就是求 4 个　　　　相加的和是多少，列式为__。</p>';
    const out = wrapBareBlankRuns(html);
    expect(out).toMatch(/<u class="blank-\d+">&emsp;<\/u>相加/);
    expect(out).not.toContain('个　　　　相加'); // 原裸空格串不再原样保留
  });

  it('算式空位链："＝　×　＝　。" 各空位 → u.blank-N（保留 × 运算符）', () => {
    const html = '<p>0.6×0.3＝　　　×　　　＝　　　。</p>';
    const out = wrapBareBlankRuns(html);
    // 三处空位均转为显式横线，且运算符 × 与 ＝ 保留
    expect((out.match(/<u class="blank-\d+">&emsp;<\/u>/g) || []).length).toBe(3);
    expect(out).toContain('×');
    expect(out).toContain('＝');
  });

  it('算式内数字两侧的列分隔空格不转（"12　　读作："）', () => {
    const html = '<p>（1）2×6＝12　　读作：十二。</p>';
    const out = wrapBareBlankRuns(html);
    expect(out).toBe(html); // 数字后到下一引导词 = 排版分隔，保持原样
  });

  it('图形/符号间距不转（"相加　　○○○"）', () => {
    const html = '<p>2 个 3 相加　　○○○ 表示 6。</p>';
    const out = wrapBareBlankRuns(html);
    expect(out).toBe(html);
  });

  it('单位括号前空位不转（"有　　　　（个）"）——右邻为半角括号，非语义填空夹缝', () => {
    const html = '<p>小明一共有　　　　（个）苹果。</p>';
    const out = wrapBareBlankRuns(html);
    expect(out).toBe(html);
  });

  it('规则②行尾/句读前书写空仍生效（不受③影响）', () => {
    const html = '<p>口诀：　　　　。</p>';
    const out = wrapBareBlankRuns(html);
    expect(out).toMatch(/<u class="blank-\d+">&emsp;<\/u>。<\/p>/);
  });
});
