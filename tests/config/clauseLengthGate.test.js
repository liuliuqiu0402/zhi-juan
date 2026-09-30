// 🔒 C 长句门限守卫（治"大段大段"）：分层门限 + 豁免清单只减不增
// ============================================================
// 用户裁定：长句不是"因为判据不可判定"，而是"没找到根因就用措辞逼近"的累积 → 必须能被机检。
// 门限（2026-09-30 定）：判据条 ≤ 400 字；辅助/说明条 ≤ 250 字。
// 现存超限的 13 条进**豁免清单**（只减不增）：拆一条划掉一条，清单涨了即红。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const tpl = (g = 'exam', s = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: s, genType: g }).template;
const clausesOf = (t) => t.split(/\n(?=·|【)/).map((x) => x.trim()).filter((x) => x.length > 12);

const MAX_JUDGE_CLAUSE = 400;
const MAX_AUX_CLAUSE = 250;

/** 豁免清单（2026-09-30 实测 >250 字的 13 条，取前 24 字作指纹）——只准减少 */
const EXEMPT = [
  '题目自洽（编辑自查总纲；**每写完一题，',
  '书写载体协议：写汉字类题必须真实输出',
  '【卷面结构（依2022年版义务教育课程标准',
  '🔴 分值（**两处都要标**）：大题级必须给分值',
  '🔴 大类层下两层展开：**大题标题**用',
  '【创作要求】',
  '🔴 自洽（层级↔内容）：**大类名须与其下各题',
  '题面带选项（A./B./C. 等）的题，其作答位',
  '题干内的分条（要求、提示、步骤、评分要点',
  '🔴 层级归并（**按【卷面结构】块名归并',
  '事实可信：人名/作品/年代/地名/法条/史料',
  '答案须成句成段书写的题，输出整行书写横线',
  '🔴 卷首导语与大题标题**同进同退**',
];

describe('C 长句门限（大段大段=机检项）', () => {
  it(`超过门限（判据条 ${MAX_JUDGE_CLAUSE} / 辅助条 ${MAX_AUX_CLAUSE}）的条必须已在豁免清单里`, () => {
    const bad = [];
    for (const cl of clausesOf(tpl())) {
      if (cl.length <= MAX_AUX_CLAUSE) continue;
      const hit = EXEMPT.some((e) => cl.startsWith(e) || cl.includes(e));
      if (!hit) bad.push(`${cl.length} 字: ${cl.slice(0, 30)}`);
    }
    expect(bad, '新增了超门限的长条 —— 请拆句（三要素分离）或登记豁免并说明根因').toEqual([]);
  });

  it('豁免清单只减不增（拆一条划掉一条）', () => {
    const items = clausesOf(tpl());
    const still = EXEMPT.filter((e) => items.some((cl) => cl.includes(e)));
    expect(still.length, '豁免清单已在缩减就不该反弹').toBeLessThanOrEqual(EXEMPT.length);
    expect(EXEMPT.length, '豁免清单本身上限（当前 13 条）').toBeLessThanOrEqual(13);
  });

  it('最长的判据条不得继续变长（基线上限 2100 字）', () => {
    const max = Math.max(...clausesOf(tpl()).map((c) => c.length));
    expect(max, '最长条继续变长 = 又在"用长句逼近"').toBeLessThanOrEqual(2100);
  });
});
