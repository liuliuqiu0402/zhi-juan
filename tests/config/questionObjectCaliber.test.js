// 🔢 题号"编号对象"口径守卫（2026-09-30 用户裁定·调研后落）
// 调研结论（19 条实样来源，见 docs/design/标题层级与编号规范.md §五）：编号单位 = 一个独立作答/可判分的小题；
//   同型并列栏目整栏不逐项编号；一段材料作为一个题时只给一个题号，段内多空不编号。
// 本条只管**小题号的编号对象**；大题序号（全卷连续）与分值标注照既有条款不变；符号不指定（防定形诱导）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate, QUESTION_OBJECT_CALIBER, QUESTION_NUMBERING_CALIBER } from '../../src/config/promptLibrary.js';

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
    expect(ex, '账目算式判词仍在（2026-10-06 去"小题"锚词、判据不变）').toContain('大题总分=其下各题分值之和');
    expect(QUESTION_OBJECT_CALIBER, '本条须声明自身不涉大题级').toContain('题号只标');
    expect(tpl('practice'), '教辅小题口径仍在（逐栏目起编）').toContain(QUESTION_NUMBERING_CALIBER.teaching);
  });

  it('零诱导：不点题型名、不指定分问符号', () => {
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
  it('「共N题」题量口径须指向编号对象条，不得为凑题量把同型并列逐项编号', () => {
    const ex = tpl('exam');
    expect(ex, '"共N题/小题数"须显式按编号对象口径计').toContain('按上条口径计');
    expect(ex, '禁止为凑题量逐项编号的判据须在位').toContain('不得为凑题量逐项编号');
    expect(QUESTION_OBJECT_CALIBER, '编号对象条须含"共用要求的一批同类项整栏不逐项编号"').toContain('共用同一条作答要求、仅材料逐项更换的一批同类项');
    // 🔴 2026-10-04（四问复核·①可自判）：原"同型并列小项"与"互不相同独立任务"对同一对象可同时成立
    //   （6 道同型选择题：既"同型"又"独立"）→ 边界不可自判。改为**可自判判据**："各自给出独立设问的"才各自编号
    //   （选择题各带独立问题与作答对象 → 各自编号；看拼音写词语/口算＝共用一条要求的待填同类项 → 不编号）。
    expect(QUESTION_OBJECT_CALIBER, '判据须点明"各自给出独立设问的才各自编号"').toContain('各自给出独立设问的');
  });
});
