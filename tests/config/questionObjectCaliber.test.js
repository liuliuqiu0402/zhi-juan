// 🔢 题号口径守卫
// ============================================================
// 🔴 2026-10-23（属主基准·**撤第二把尺**）：
//   编号/不编号**只判一次**，唯一判据＝【层级与组织】的一组只做一个动作：给不给每个小题写号（`NUMBERING_BRANCH_RULE`）。
//   原 `QUESTION_OBJECT_CALIBER` 里的两套判据（"只有各自给出独立作答要求的才各自编号"／"整组共用一条
//   作答要求（标题）的…其下不编号"）与一组只做一个动作是**同一决定的两把尺**，且对同一行能给相反答案
//   （竖式：算式不同 ⇒ 前半句判编号；作答动作相同 ⇒ 后半句判不编号）⇒ 整支删除。
//   本文件锁三件事：
//     ① 判据单源（一组只做一个动作只在【层级与组织】出现一次，分值标注只引用）；
//     ② 第二把尺不得回潮（"独立作答要求／共用一条作答要求／哪怕并列多少项"）；
//     ③ 题号条仍只管"不是题的东西别给号"与分问标示——不越界去判"哪些题该编号"。
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getPromptTemplate, NUMBERING_BRANCH_RULE, QUESTION_OBJECT_CALIBER,
} from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const tpl = (g, s = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: s, genType: g }).template;

describe('编号/不编号：单一判据（一组只做一个动作）', () => {
  it('考卷与教辅两条通道都携带该条（单源一次定义、两处引用）', () => {
    const lib = read('src/config/promptLibrary.js');
    expect((lib.match(/export const NUMBERING_BRANCH_RULE/g) || []).length, '只允许一处定义').toBe(1);
    // 只数"代码行"的引用（注释里提到常量名不算消费）——否则每次留痕都会把计数抬高。
    const codeLines = lib.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
    expect((codeLines.match(/NUMBERING_BRANCH_RULE/g) || []).length, '定义 1 + 消费 2（考试卷内联在分值标注／其余在层级与组织）').toBe(3);
    for (const g of ['exam', 'practice', 'special', 'reading', 'review']) {
      expect(tpl(g), `${g} 应携带一组只做一个动作判据`).toContain(NUMBERING_BRANCH_RULE);
    }
  });

  it('判据本体：一组只做一个动作（写号就逐题标分／不写号就单价进标题）', () => {
    expect(NUMBERING_BRANCH_RULE, '动作只一个：给不给每个小题写号').toContain('一组只做一个动作：给不给每个小题写号');
    expect(NUMBERING_BRANCH_RULE, '写号支：每题顶格号').toContain('**写号**：每题顶格号');
    expect(NUMBERING_BRANCH_RULE, '写号支：每题行末标自己的分').toContain('每题行末标自己的分');
    expect(NUMBERING_BRANCH_RULE, '不写号支：单价进标题').toContain('**不写号**：**标题给一个单价**');
    expect(NUMBERING_BRANCH_RULE, '不写号支：题内不标分').toContain('**题内不标分**');
    expect(NUMBERING_BRANCH_RULE, '两半互锁（号与分同生同死）').toContain('不许只有号没有分，也不许没有号却在题内标分');
    // 🔴 判据里不得出现任何题型名（一列就变成诱导）
    expect(NUMBERING_BRANCH_RULE).not.toMatch(/看拼音|组词|连一连|口算|竖式|选择|判断|填空|选字|选词/);
    expect(NUMBERING_BRANCH_RULE).not.toMatch(/①|②|（1）|\(1\)/);
    // 旧判据（"其余→不编号"）不得回潮：模型不认这个负向判据（"其余的也是题"）
    expect(NUMBERING_BRANCH_RULE, '负向分类不得回潮').not.toContain('其余');
  });

  it('真卷形态：判断题 `…。（　）` 不被误判（判据不再是"句子"，不再需要这句边界）', () => {
    // 判据已改为"写不写号"的动作，句末形态不参与判定——这条只作防回潮锁。
    expect(NUMBERING_BRANCH_RULE, '不再以"成句"作判据').not.toContain('完整句子');
  });

  it('第二把尺不得回潮（同一决定只准一把尺）', () => {
    for (const g of ['exam', 'practice']) {
      const t = tpl(g);
      expect(t, `${g}：独立作答要求判据不得回潮`).not.toContain('只有各自给出独立作答要求');
      expect(t, `${g}：共用一条作答要求判据不得回潮`).not.toContain('共用一条作答要求的');
      // 注意：只锁**旧判据的原文**——【题目自洽②】的"无论其下并列多少项"讲的是"作答位仍须在本题题面内"，
      //   与编号无关，不得误伤。
      expect(t, `${g}：旧判据"哪怕并列多少项"不得回潮`).not.toContain('哪怕并列多少项');
    }
    expect(QUESTION_OBJECT_CALIBER, '题号条本身也不得再判"哪些题该编号"').not.toMatch(/共用一条作答要求|独立作答要求/);
  });
});

describe('题号条：只管"不是题的东西别给号"与分问标示', () => {
  it('定义 1 + 消费 2：考卷与教辅都携带', () => {
    const lib = read('src/config/promptLibrary.js');
    expect((lib.match(/export const QUESTION_OBJECT_CALIBER/g) || []).length, '只允许一处定义').toBe(1);
    expect((lib.match(/QUESTION_OBJECT_CALIBER/g) || []).length, '定义 1 + 消费 2').toBe(3);
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
  });

  it('只管题号：大题序号口径与分值标注不得被削弱', () => {
    const ex = tpl('exam');
    expect(ex, '大题序号：一、二、三…（跨大类/部分接着编）仍在').toContain('跨大类/部分接着编');
    expect(ex, '⚠️「全卷连续」四字不得回潮（会被读成题号层也连续 ⇒ 每个题干都要给号）').not.toContain('全卷连续');
    expect(ex, '逐层加总判词仍在（题干→大题→大类→试卷）').toContain('大题总分＝其下各子题分之和');
  });

  it('零诱导：不点题型名、不指定分问符号', () => {
    expect(QUESTION_OBJECT_CALIBER).not.toMatch(/看拼音|组词|连一连|口算|竖式|选择|判断|填空|选字|选词/);
    expect(QUESTION_OBJECT_CALIBER).not.toMatch(/①|②|（1）|\(1\)/);
    const exTpl = tpl('exam');
    expect(exTpl, '分值只约束写法（每〈单位〉X分，共X分）').toContain('每〈单位〉X分，共X分');
    expect(exTpl, '枚举不得回潮（会诱导往枚举上凑、并漏掉其它作答对象）').not.toMatch(/汉字／词语|词语／数字|数字／字母|字母／选项/);
  });
});

describe('题量口径与卷面层级（不受本次改动影响）', () => {
  it('题量口径：不再有"题量"预载，条数由实际内容决定', () => {
    const ex = tpl('exam');
    expect(ex, '"题量"预载已废（计数统一按计分对象）').not.toContain('题量');
    expect(ex, '计分条数由实际内容决定的判据须在位').toContain('条数由实际内容决定');
    expect(ex, '旧"编号与计分按实际计分对象给出"不得回潮（与计分对象口径相抵）').not.toContain('编号与计分按实际计分对象给出');
    expect(ex, '否定式旧句不得回潮').not.toContain('不得为凑数逐项编号');
  });

  it('H3：卷面层级给"正面出口"（可以只有大题标题一层）', () => {
    const ex = tpl('exam');
    expect(ex, '正面出口：可只有大题标题一层（不为连续性补号）').toContain('可以只有大题标题一层');
    expect(ex, '旧跨块指向不得回潮（模型不再需要跨块拼装）').not.toContain('哪些题该编号，见【题号与分值】');
    expect(ex, '题号条改为结构式：每个独立题干都用 question 包裹（给不给号都包裹）').toContain('每道要作答的题用 <p class="question"> 包裹');
    expect(ex, '大题标题就是这一组的作答要求（正向概念）').toContain('大题标题就是这一组的作答要求');
    expect(ex, '渲染侧：标题与作答要求不包成 question').toContain('标题与作答要求都不包成 question');
    expect(ex, '旧反向概念"大题标题也不是题干"不得回潮').not.toContain('大题标题也不是题干');
    expect(ex, '大题序号不推到题号').toContain('只关汉字大题号，不推到题号');
    expect(ex, '⚠️「应编号的题」定名不得回潮（预设有一批应给号的题）').not.toContain('**应编号的题**');
  });

  // 🔴 2026-10-10（〔346〕产物实证·编号冲动根因）：原判据不可自判（"并列的算式算不算多个小题"）。
  //   2026-10-23 起由一组只做一个动作接管：并列算式行没有"以句号/问号收尾的完整句子" ⇒ 一组只做一个动作不成立 ⇒ 不编号。
  it('〔346〕不可自判的旧锚不得回潮；由一组只做一个动作接管', () => {
    expect(QUESTION_OBJECT_CALIBER, '不可自判的旧锚不得回潮').not.toContain('全大题仅一个小题时');
    expect(tpl('exam'), '卷面自洽条旧锚须一并改准').not.toContain('全大题仅一个小题时');
    expect(NUMBERING_BRANCH_RULE, '并列算式行由"一组只做一个动作"自然判为不编号').toContain('一组只做一个动作');
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
