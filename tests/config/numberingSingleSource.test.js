// 🔢 编号判据单源（2026-10-26 重写：**结构事实**）
// ============================================================
// 旧病（2026-10-24 实证）：改判据前，"该不该编号"散在 4 处各说一遍——【分值标注】两区判据、
//   【大题标题命名】"题号只给要单独点名的题"、【层级与组织】"标题不是题不编号"、
//   【卷面层级】"带不带题号随实际构成而定"。四条不冲突，但各自换说法重新定义同一个决定。
// 2026-10-24 收成一条语义开关（"号是点名用的／各项有没有只属于它自己的题干话"）——**仍是语义判定**，
//   真机实证：整卷不标分（模型对同一行可给出相反解释）。
// 2026-10-26 属主定稿：改为**结构事实**——一个大题下有几个独立成 `<p class="question">` 的题干：
//   1 个 ⇒ 单题干大题（不加小号序号、标题不写分值）；≥2 个 ⇒ 多题干大题（各题干前加小号序号、各题干后标全式）。
// 本文件锁三件事：
//   ① 该定义只在库内写一份，且每份实发里**只出现一次**（考卷随【分值标注】、其余题类随【层级与组织】）；
//   ② 旧语义判据零出现（不得散回去、不得回潮）；
//   ③ 起编与样式只在 QOC 写一处，各题类都携带。
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getPromptTemplate, ANSWER_STEM_CALIBER, QUESTION_OBJECT_CALIBER,
} from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const tpl = (subject, grade, genType) => (getPromptTemplate({ grade, subject, genType }).template) || '';
const count = (s, sub) => s.split(sub).length - 1;

const ALL = [
  ['数学', 'primary_low', 'exam'],
  ['数学', 'middle', 'exam'],
  ['语文', 'primary_mid', 'exam'],
  ['语文', 'primary_low', 'practice'],
  ['语文', 'primary_low', 'special'],
  ['语文', 'primary_low', 'reading'],
  ['语文', 'primary_low', 'review'],
];

describe('编号判据单源（2026-10-26 结构事实）', () => {
  it('定义只有一份（库内一处 export）', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'src/config/promptLibrary.js'), 'utf8');
    expect(count(lib, 'export const ANSWER_STEM_CALIBER'), '只允许一处定义').toBe(1);
  });

  it('每份实发只出现一次（考卷随【分值标注】、其余随【层级与组织】）', () => {
    for (const [sj, st, g] of ALL) {
      expect(count(tpl(sj, st, g), ANSWER_STEM_CALIBER), `${g}|${st}|${sj}：判据不得双份`).toBe(1);
    }
  });

  it('旧语义判据零出现（防再散回去）', () => {
    for (const [sj, st, g] of ALL) {
      const t = tpl(sj, st, g);
      expect(t, `${g}：旧"号是点名用的"`).not.toContain('号是点名用的');
      expect(t, `${g}：旧"带小题号"`).not.toContain('带小题号');
      expect(t, `${g}：旧"一组只做一个动作"`).not.toContain('一组只做一个动作');
      expect(t, `${g}：旧"只属于它自己的题干话"`).not.toContain('只属于它自己的题干话');
      expect(t, `${g}：旧"最后一行末尾"`).not.toContain('最后一行末尾');
      expect(t, `${g}：旧"题号只给要单独点名的题"`).not.toContain('题号只给要单独点名的题');
      expect(t, `${g}：旧"带不带题号随实际构成而定"`).not.toContain('带不带题号随实际构成而定');
    }
  });

  it('起编与样式只写一处（QOC），各题类都携带', () => {
    for (const [sj, st, g] of ALL) {
      expect(count(tpl(sj, st, g), QUESTION_OBJECT_CALIBER), `${g}|${st}|${sj}`).toBe(1);
    }
    expect(QUESTION_OBJECT_CALIBER, '样式写死一种').toContain('1. 2. 3.');
    expect(QUESTION_OBJECT_CALIBER, '起编按注入').toContain('{subQuestionNumbering}');
  });

  it('教辅：不判分（不加载【分值标注】、不出现中间态分值）', () => {
    for (const g of ['practice', 'special', 'reading', 'review']) {
      const t = tpl('语文', 'primary_low', g);
      expect(t, `${g}：不得加载【分值标注】`).not.toContain('【分值标注】');
      expect(t, `${g}：不得出现"（共Z分）"`).not.toContain('（共Z分）');
      expect(t, `${g}：不得出现单价档注入位`).not.toContain('{scoreUnitLadder}');
    }
  });
});
