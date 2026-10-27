// 分值 · 仲裁守卫（2026-10-27）
// ------------------------------------------------------------
// 背景：提交 4874a3e 以"清双源"为由，删掉了【卷面自洽】里那句豁免
//   「分值不是复述——有号的题每题题干后都要有自己的分（见【分值标注】）」。
//   删掉后，「组内同型各题的作答说明只出一次／不逐题复述」重新盖到分值括注上，
//   同型客观题的逐题标分被当成"重复说明"并掉。
// 本条只钉**仲裁关系**，不钉措辞：只要出现"不逐题复述"这一条，同一条内就必须有"分值"的范围声明。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const tpl = (g = 'exam', s = '数学', st = 'primary_low') =>
  getPromptTemplate({ grade: st, subject: s, genType: g }).template;

// 同一条内，"不逐题复述"之后必须出现"分值"（＝该条已声明分值不属"只出一次"的对象）
// 2026-10-27：加 \n 限定在**同一条**，防把别处的"分值"误当本条的豁免（跨块不算）。
const CARVE_OUT = /不逐题复述[^。\n]*分值/;

describe('分值仲裁：「只出一次」必须带分值豁免', () => {
  it('exam 各 cell：含"不逐题复述"就必须带分值范围声明', () => {
    for (const [s, st] of [['数学', 'primary_low'], ['语文', 'primary_mid'], ['英语', 'middle'], ['物理', 'high']]) {
      const t = tpl('exam', s, st);
      if (!t.includes('不逐题复述')) continue;
      expect(CARVE_OUT.test(t), `${s}/${st}：该条缺分值豁免（会被当成"重复说明"并掉逐题标分）`).toBe(true);
    }
  });

  it('守卫有牙：把豁免删掉即判红（复现 4874a3e 的形态）', () => {
    const t = tpl('exam');
    const broken = t.replace(/；\*\*分值不是复述[^*]*\*\*/, '');
    expect(t, '正常文本应命中').toMatch(CARVE_OUT);
    expect(broken, '删豁免后必须不命中').not.toMatch(CARVE_OUT);
  });

  it('豁免不重复判据：只界定管辖域，不写第二份"每题要标"', () => {
    const t = tpl('exam');
    expect(t, '不得出现第二份逐题标分要求').not.toMatch(/分值不是复述[^。]*每题题干后必须标/);
  });
});
