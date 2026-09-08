/**
 * 情境主题集中检测（2026-09 词簇收窄后）：锚=事件/场景名词，而非"学校/妈妈"等人物处所通称。
 * 构造题块 HTML：每行一个 <p>，行首为"数字."题号；参考答案行前截止。
 * ⚠️ detectTopicRepeat 要求题块 ≥6 才检测（防小题卷噪声），各样本须补齐中性题。
 */
import { describe, it, expect } from 'vitest';
import { detectTopicRepeat } from '../../src/utils/paperGuardEngine.js';

const paperOf = (lines) => lines.map((t, i) => `<p>${i + 1}. ${t}</p>`).join('');
const NEUTRAL = (n) => `直接写得数：2.4×3＝7.2（第 ${n} 式）`;

describe('detectTopicRepeat（事件锚定词簇，2026-09）', () => {
  it('同一事件（食堂餐饮）≥3 题才提示', () => {
    const html = paperOf([
      '学校食堂买来 40 千克大米，每天用 2.5 千克，够用多少天？',
      '食堂午餐用了 15 千克面粉。',
      '食堂买鸡蛋用了 12 元。',
      '图书角购进 30 本故事书。',
      '合唱队购买演出服装。',
      NEUTRAL(1),
      NEUTRAL(2),
    ]);
    const hits = detectTopicRepeat(html);
    expect(hits.some((h) => h.includes('食堂餐饮'))).toBe(true);
  });

  it('互不相同的校内事件（捐书/合唱/食堂/义卖）不再被"班级/学校"粗簇误并', () => {
    const html = paperOf([
      '学校图书角开展爱心捐书活动。',
      '学校为合唱队购买演出服装。',
      '学校食堂买来一批面粉。',
      '班级组织义卖活动。',
      NEUTRAL(1),
      NEUTRAL(2),
      NEUTRAL(3),
    ]);
    const hits = detectTopicRepeat(html);
    expect(hits).toEqual([]); // 无任何单一事件 ≥3
  });

  it('买菜做饭 ≥3 题才提示（同一购买事件，非"妈妈/爸爸"人称）', () => {
    const html = paperOf([
      '妈妈去菜市场买菜花了 18.6 元。',
      '爸爸买菜又买了 9.8 元的鱼。',
      '奶奶买菜剩下 50 元。',
      '小明步行去上学。',
      NEUTRAL(1),
      NEUTRAL(2),
    ]);
    const hits = detectTopicRepeat(html);
    expect(hits.some((h) => h.includes('超市购物') || h.includes('家庭生活'))).toBe(true);
  });

  it('题量 <6 不提示（防小题卷噪声）', () => {
    const html = paperOf(['食堂买了米。', '食堂买了面。', '食堂买了油。']);
    expect(detectTopicRepeat(html)).toEqual([]);
  });
});
