// 分值 · 管辖域守卫（2026-10-28 属主纠正后重写）
// ------------------------------------------------------------
// 属主原话：「它还同时被【卷面自洽】"不逐题复述"拉着——这个是管标题表述，但是不包括标分部分。」
// 即：该条的对象是**标题与作答说明的表述**，"看不看得见重复"不覆盖分值括注；
//   所以正确做法不是在里面加一句"分值不是复述"的豁免（那反而把标分拖进本条的管辖域，
//   让"逐题标分＝重复"变成可想的读法），而是**把管辖域写在条首**，条内不出现"分值"。
// 本守卫钉三件事：
//   ① 该条以"标题与作答说明"声明管辖域（缺它，本条会被读成"全篇只出一次"）；
//   ② 该条内**不得出现"分值"**（反向锁：一旦出现，标分又被拖回"是否重复"的判定）；
//   ③ 该条不得写第二份逐题标分要求（标分义务单源在【分值标注】）。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const tpl = (g = 'exam', s = '数学', st = 'primary_low') =>
  getPromptTemplate({ grade: st, subject: s, genType: g }).template;

/** 取【卷面自洽】里"只出一次/不逐题复述"那一条 */
const selfClauseOf = (t) => (t.split('\n').find((l) => l.includes('不逐题复述')) || '');

describe('卷面自洽：只出一次只管表述，不管标分', () => {
  it('exam 各 cell：该条以"标题与作答说明"声明管辖域', () => {
    for (const [s, st] of [['数学', 'primary_low'], ['语文', 'primary_mid'], ['英语', 'middle'], ['物理', 'high']]) {
      const t = tpl('exam', s, st);
      if (!t.includes('不逐题复述')) continue;
      expect(selfClauseOf(t), `${s}/${st}：缺管辖域声明`).toContain('标题与作答说明');
    }
  });

  it('该条内不得出现"分值"（反向锁：标分不属"是否重复"的判定对象）', () => {
    const t = tpl('exam');
    expect(selfClauseOf(t), '管辖域内出现了"分值"').not.toContain('分值');
  });

  it('该条不得写第二份逐题标分要求（标分单源在【分值标注】）', () => {
    const t = tpl('exam');
    expect(selfClauseOf(t), '出现了第二份逐题标分要求').not.toMatch(/每题题干后|分写在每题题干后|每题都要有自己的分/);
  });

  it('守卫有牙：把管辖域删掉即判红（复现"全篇只出一次"的读法）', () => {
    const t = tpl('exam');
    const broken = t.replace(/· \*\*标题与作答说明\*\*：/, '· ');
    expect(selfClauseOf(t)).toContain('标题与作答说明');
    expect(selfClauseOf(broken)).not.toContain('标题与作答说明');
  });
});
