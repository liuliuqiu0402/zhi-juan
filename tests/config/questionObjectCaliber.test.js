// 🔢 题号"编号对象"口径守卫（2026-09-30 用户裁定·调研后落）
// 调研结论（19 条实样来源，见 docs/design/标题层级与编号规范.md §五）：编号单位 = 一个独立作答/可判分的小题；
//   同型并列栏目整栏不逐项编号；一段材料作为一个题时只给一个题号，段内多空不编号。
// 本条只管**小题号的编号对象**；大题序号（全卷连续）与分值标注照既有条款不变；符号不指定（防定形诱导）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate, QUESTION_OBJECT_CALIBER, QUESTION_NUMBERING_CALIBER, SCORING_OBJECT_CALIBER } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const tpl = (g, s = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: s, genType: g }).template;

describe('题号"编号对象"口径', () => {
  it('考卷与教辅两条通道都携带该条（单源一次定义、两处引用）', () => {
    const lib = read('src/config/promptLibrary.js');
    expect((lib.match(/export const QUESTION_OBJECT_CALIBER/g) || []).length, '只允许一处定义').toBe(1);
    expect((lib.match(/QUESTION_OBJECT_CALIBER/g) || []).length, '定义 1 + 消费 2').toBe(3);
    for (const g of ['exam', 'practice', 'special', 'reading', 'review']) {
      expect(tpl(g), `${g} 应携带编号对象口径`).toContain(QUESTION_OBJECT_CALIBER);
    }
  });

  it('只管编号对象：大题序号"全卷连续"与分值标注不得被削弱', () => {
    const ex = tpl('exam');
    expect(ex, '大题序号全卷连续仍在').toContain('全卷连续');
    expect(ex, '账目算式判词仍在（2026-10-10 计分对象口径、判据不变）').toContain('大题总分=其下各计分对象分值之和');
    expect(QUESTION_OBJECT_CALIBER, '本条须声明自身不涉大题级').toContain('题号只标');
    expect(tpl('practice'), '教辅小题口径仍在（逐栏目起编）').toContain(QUESTION_NUMBERING_CALIBER.teaching);
  });

  it('零诱导：不点题型名、不指定分问符号', () => {
    // 🔴 2026-10-10（〔332〕单位取"作答什么"的通称，不写载体形态名）：原"单位即该载体"字面会产出"每横线1分／每括号1分" ⇒ 改判据＋锁。
    expect(SCORING_OBJECT_CALIBER, '单位＝作答内容的通称、不写载体形态名').toContain('不写承载它的线条／括号等形态名');
    expect(QUESTION_OBJECT_CALIBER).not.toMatch(/看拼音|组词|连一连|口算|竖式|选择|判断|填空|选字|选词/);
    expect(QUESTION_OBJECT_CALIBER).not.toMatch(/①|②|（1）|\(1\)/);
    expect(QUESTION_OBJECT_CALIBER).toContain('独立作答单位');
  });

  it('旧口径不得被覆盖：全卷连续/逐栏目起编两套仍在（不得互相否定）', () => {
    const lib = read('src/config/promptLibrary.js');
    expect(lib).toContain('不得互相否定');
    expect(QUESTION_NUMBERING_CALIBER.exam).toContain('全卷连续');
    expect(QUESTION_NUMBERING_CALIBER.teaching).toContain('分别从 1 起编');
  });

  // 🔴 2026-10-03（用户报障根治·问题5）：「共N题」题量原写"只数**实际给号的小题**"——与账目绝对等式
  //    （小题数×每题分=大题分）耦合，模型为凑等式把同型并列小项**逐项编号**（生编硬凑题号）。
  //    已把"共N题/小题数"口径显式指向本题号对象条。本用例为**锁**：该耦合口径不得回潮。
  it('题量口径：不再有"题量"预载（计数统一按计分对象），且禁止为凑数逐项编号', () => {
    const ex = tpl('exam');
    // 🔴 2026-10-10（〔328〕三口径闭环）：原"账目里的**题量**按上条口径计"是**题数时代**的残留——
    //    题数已废、账目改以**计分对象**计数 ⇒ 该预载删；防凑编号的禁句保留（改中性词"凑数"）。
    expect(ex, '"题量"预载已废（计数统一按计分对象）').not.toContain('题量');
    expect(ex, '禁止为凑数逐项编号的判据须在位').toContain('不得为凑数逐项编号');
    expect(QUESTION_OBJECT_CALIBER, '编号对象条须含"共用要求的一批同类项整栏不逐项编号"').toContain('共用同一条作答要求、仅材料逐项更换的一批同类项');
    // 🔴 2026-10-10（面5·四问②对象锚不适配）：原"整栏"是**教辅容器术语**（术语映射仅对题类教辅生效），
    //   而 **exam 只有大类/大题、并无"栏"** ⇒ 该"不编号"支在 exam 侧无对应物、不可自判（产物实证：大题下同型并列仍硬编小题号）。
    //   已去"整栏"改层级无关（"…一批同类项不逐项编号"）。本条为锁：**"整栏"不得回潮**。
    expect(QUESTION_OBJECT_CALIBER, '去"整栏"（层级无关·exam 无"栏"）').not.toContain('整栏');
    // 🔴 2026-10-04（四问复核·①可自判）：原"同型并列小项"与"互不相同独立任务"对同一对象可同时成立
    //   （6 道同型选择题：既"同型"又"独立"）→ 边界不可自判。改为**可自判判据**："各自给出独立设问的"才各自编号
    //   （选择题各带独立问题与作答对象 → 各自编号；看拼音写词语/口算＝共用一条要求的待填同类项 → 不编号）。
    expect(QUESTION_OBJECT_CALIBER, '判据须点明"各自给出独立设问的才各自编号"').toContain('各自给出独立设问的');
  });

  // 🔴 2026-10-10（〔335〕属主令"挂着的就自己测掉"）：〔333〕H2／H3 两项**观察项转锁**——自测通过即销案、不再挂观察。
  it('H2 反锁：否定式点名句不得回潮（防"点名即强调"的反诱导）', () => {
    expect(QUESTION_OBJECT_CALIBER, '"同一次作答动作内的多个待填位置…"式否定点名已删').not.toContain('同一次作答动作');
    expect(QUESTION_OBJECT_CALIBER, '同类项条须为正面表述（整批只给一个题号）').toContain('整批只给一个题号');
  });
  it('H3 自测：编号对象指针**唯一**——卷面层级持有；题号条只给对象词、不得复述指针', () => {
    const ex = tpl('exam');
    const pointer = '哪些题该编号，见【题号与分值】的编号对象口径';
    expect(ex, '指针须在（卷面层级）持有').toContain(pointer);
    expect(ex.split(pointer).length - 1, '指针只允许一处——复述即成第二处正句').toBe(1);
    expect(ex, '题号条用对象式定名"应编号的题"（自承其义）').toContain('**应编号的题**');
  });

  // 🔴 2026-10-10（〔340〕多源取证·两处"疑似"当场转锁）：M5／③ 经取证**均非拉扯** ⇒ 写成锁，挂账清零。
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
