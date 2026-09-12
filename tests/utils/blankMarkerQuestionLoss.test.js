import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers, extractBodyQuestionNumbers } from '../../src/utils/contentCleaner.js';

/**
 * 🔴 2026-09-12 实测事故回归：英语课时练正文题号 1~18 完整无缺，经「正文归一化链」后
 *    2、3、4 三题整段消失（分步取证点名 normalizeBlankMarkers），生成被判失败。
 * 病根假设：空位载体正则用 `[\s\S]*?<\/u>` 允许"载体内部任意内容"，遇到畸形载体
 *    （未闭合、或把正文/整句包进 blank-N）会吞掉一大段；而拆壳守卫 unwrapMalformedBlankCarriers
 *    跑在形态归一(unifySameParagraphWriteBlanks)与跨类型去重**之后**，救不回来 → 整段被替换成短载体。
 * 本用例锁定不变量：**空位归一只换载体形态，绝不吞正文、绝不让题号消失**。
 */
const countNums = (html) => extractBodyQuestionNumbers(html);

describe('空位载体归一不得吞题（2026-09-12 丢题事故回归）', () => {
  it('载体内含正文（畸形载体）不得吞掉相邻题目', () => {
    const raw = [
      '<p>1. 根据海报信息，用括号内动词的适当形式补全句子。</p>',
      '<p>(1) Last Friday, our school <u class="blank-4">&emsp;</u> (hold) a talent show in the school hall.</p>',
      '<p>(2) Our school will <u class="blank-3">&emsp;</u> (put) on an English play.</p>',
      '<p>2. 用括号内动词的适当形式补全短文。</p>',
      '<p>Last week, we <u class="blank-3">(visit) a farm (plant) trees </u> and saw many animals.</p>',
      '<p>3. 从方框中选择合适的词填空。</p>',
      '<p><span class="blank-2">the school is very big</span> <u class="blank-3">&emsp;</u></p>',
      '<p>4. 写出下列动词的过去式。</p>',
      '<p><span class="blank-2">go / see / have</span> <u class="blank-3">&emsp;</u></p>',
      '<p>5. 根据读音 /iː/，从方框中选出含该发音的单词。</p>',
    ].join('\n');
    expect(countNums(raw)).toEqual([1, 2, 3, 4, 5]);
    const out = normalizeBlankMarkers(raw);
    expect(countNums(out)).toEqual([1, 2, 3, 4, 5]);     // 题号一个都不能少
    expect(out).toContain('(hold) a talent show');        // 正文不得被吞
    expect(out).toContain('a farm');
    expect(out).toContain('go / see / have');
  });

  it('未闭合载体不得吞掉后续段落', () => {
    const raw = [
      '<p>1. 用括号内动词的适当形式补全句子。</p>',
      '<p>(1) Our school <u class="blank-3">&emsp; (hold) a talent show</p>',
      '<p>2. 根据对话写出所缺单词。</p>',
      '<p>Ben: Where <u class="blank-2">&emsp;</u> you go?</p>',
      '<p>3. 连词成句。</p>',
      '<p><span class="blank-2">is / where / the school</span></p>',
      '<p>4. 写出下列动词的过去式。</p>',
      '<p>5. 选词填空。</p>',
    ].join('\n');
    const out = normalizeBlankMarkers(raw);
    expect(countNums(out)).toEqual([1, 2, 3, 4, 5]);
    expect(out).toContain('(hold) a talent show');
    expect(out).toContain('is / where / the school');
  });
});
