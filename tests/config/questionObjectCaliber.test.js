// 🔢 题号口径守卫（2026-10-26 重写：结构事实）
// ============================================================
// 判据换代：原 `NUMBERING_BRANCH_RULE`（"号是点名用的／各项有没有只属于它自己的题干话／一组只做一个动作"）
//   是**语义判定**，模型对同一行可给出相反解释（真机实证：整卷不标分）⇒ 整类删除。
//   现由 `ANSWER_STEM_CALIBER` 的**结构事实**接管：数这一大题下有几个独立成 `<p class="question">` 的题干。
// 本文件锁三件事：
//   ① 题号条只管"不是题的东西别给号"与分问标示——不越界去判"哪些题该编号"（那归结构判定）；
//   ② 题号条零题型名、零分问符号（一列就变成诱导）；
//   ③ 卷面层级的正面出口与逐层自验判词仍在（本次换代不得顺带削掉）。
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getPromptTemplate, QUESTION_OBJECT_CALIBER, ANSWER_STEM_CALIBER,
} from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const tpl = (g, s = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: s, genType: g }).template;

describe('题号条：只管"不是题的东西别给号"与分问标示', () => {
  it('定义 1 处 + 各题类都携带（单源一次定义、多处引用）', () => {
    const lib = read('src/config/promptLibrary.js');
    expect((lib.match(/export const QUESTION_OBJECT_CALIBER/g) || []).length, '只允许一处定义').toBe(1);
    for (const g of ['exam', 'practice', 'special', 'reading', 'review']) {
      expect(tpl(g), `${g} 应携带题号条`).toContain(QUESTION_OBJECT_CALIBER);
    }
  });

  it('只管两件事：标题及其复述行不是题（不给号）＋分问标示与本资料层级相区分', () => {
    expect(QUESTION_OBJECT_CALIBER, '标题及其复述行不是题').toMatch(/大题标题及其复述\/说明行不是题/);
    expect(QUESTION_OBJECT_CALIBER, '分问标示与层级相区分').toMatch(/同一题号内再分问/);
    expect(QUESTION_OBJECT_CALIBER, '层级/样式口径不得在本条再写一份（单源在序号体系）')
      .not.toMatch(/同层同构|异层异构|只用一种样式/);
    expect(QUESTION_OBJECT_CALIBER, '去"整栏"（层级无关·exam 无"栏"）').not.toContain('整栏');
    expect(QUESTION_OBJECT_CALIBER, '旧"逐项设问不同"不得回潮（与"作答要求不变"相抵）').not.toContain('逐项设问不同');
    expect(QUESTION_OBJECT_CALIBER, '"同一次作答动作内的多个待填位置…"式否定点名已删').not.toContain('同一次作答动作');
    // 结构判定不在此条重复（单源在 `ANSWER_STEM_CALIBER`）
    expect(QUESTION_OBJECT_CALIBER, '不得复述结构判定').not.toContain('不算一个作答题干');
  });

  it('零诱导：不点题型名、不指定分问符号', () => {
    expect(QUESTION_OBJECT_CALIBER).not.toMatch(/看拼音|组词|连一连|口算|竖式|选择|判断|填空|选字|选词/);
    expect(QUESTION_OBJECT_CALIBER).not.toMatch(/①|②|（1）|\(1\)/);
    expect(ANSWER_STEM_CALIBER).not.toMatch(/看拼音|组词|连一连|口算|竖式|选择|判断|填空|选字|选词/);
    expect(ANSWER_STEM_CALIBER).not.toMatch(/①|②|（1）|\(1\)/);
  });
});

describe('卷面层级与分值自验（本次换代不得顺带削掉）', () => {
  it('大题序号口径与逐层自验仍在', () => {
    const ex = tpl('exam');
    expect(ex, '大题序号：一、二、三…（跨大类/部分接着编）仍在').toContain('跨大类/部分接着编');
    expect(ex, '⚠️「全卷连续」四字不得回潮（会被读成题号层也连续 ⇒ 每个题干都要给号）').not.toContain('全卷连续');
    expect(ex, '逐层自验：（多题干） 该大题总分＝其下各题 Y 之和').toContain('该大题总分＝其下各题 Y 之和');
    expect(ex, '试卷层：各大题分之和＝给定满分').toContain('各大题分之和＝给定满分');
    expect(ex, '满分是给定值、不可改（单源在卷首）').toContain('不自行计算、不修改');
  });

  it('H3：卷面层级给"正面出口"（可以只有大题标题一层）', () => {
    const ex = tpl('exam');
    expect(ex, '正面出口：可只有大题标题一层（不为连续性补号）').toContain('可以只有大题标题一层');
    expect(ex, '旧跨块指向不得回潮（模型不再需要跨块拼装）').not.toContain('哪些题该编号，见【题号与分值】');
    expect(ex, '每个独立题干都用 question 包裹（给不给号都包裹）').toContain('每道要作答的题用 <p class="question"> 包裹');
    expect(ex, '大题标题就是这一组的作答要求（正向概念）').toContain('大题标题就是这一组的作答要求');
    expect(ex, '渲染侧：标题与作答要求不包成 question').toContain('标题与作答要求都不包成 question');
    expect(ex, '旧反向概念"大题标题也不是题干"不得回潮').not.toContain('大题标题也不是题干');
    expect(ex, '大题序号不推到题号').toContain('只关汉字大题号，不推到题号');
    expect(ex, '⚠️「应编号的题」定名不得回潮（预设有一批应给号的题）').not.toContain('**应编号的题**');
  });

  it('题量口径：不得回潮为"按字面"的旧判据', () => {
    const ex = tpl('exam');
    expect(ex, '"题量"预载已废（计数统一按计分对象）').not.toContain('题量');
    expect(ex, '旧"编号与计分按实际计分对象给出"不得回潮').not.toContain('编号与计分按实际计分对象给出');
    expect(ex, '否定式旧句不得回潮').not.toContain('不得为凑数逐项编号');
    expect(ex, '旧"Y＝单价×处数"已由 Y＝X×N 取代').not.toContain('Y＝单价×处数');
  });

  it('〔346〕不可自判的旧锚不得回潮；由结构事实接管', () => {
    expect(QUESTION_OBJECT_CALIBER, '不可自判的旧锚不得回潮').not.toContain('全大题仅一个小题时');
    expect(tpl('exam'), '卷面自洽条旧锚须一并改准').not.toContain('全大题仅一个小题时');
    expect(ANSWER_STEM_CALIBER, '并列算式行由结构事实自然判为单题干').toContain('题前加小号序号');
  });

  it('M5 自测：教辅"组标题自拟"与"只写作答方式"**同份在场**——来源 vs 写法两维，非同源冲突', () => {
    const t = tpl('practice');
    expect(t, '组标题来源句在场（自拟）').toContain('标题自拟');
    expect(t, '组标题写法句在场（只说明本组实际的作答方式）').toContain('组标题只说明本组');
  });

  it('③ 自测：内容型栏目标题样例取自**名称池**（轮换多套 ⇒ 非硬编样例、不触趋同）', () => {
    const lib = read('src/composables/useAiGenerator.js');
    const m = /summary:\s*\[([^\]]+)\]/.exec(lib);
    expect(m, '内容型名称池须存在').toBeTruthy();
    expect((m[1].match(/'/g) || []).length, '池内 ≥2 套（轮换）').toBeGreaterThanOrEqual(4);
    expect(m[1], '样例名取自池').toContain('知识梳理');
  });
});
