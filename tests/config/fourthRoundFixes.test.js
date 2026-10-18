// ============================================================
// 第四轮独立复核 · 真错修复的正向锁（2026-10-12）
//   背景：S4 第四轮盲审（`docs/audit/S4-独立复核-第四轮-产出.md`）抓出 5 条真错，我方逐条修。
//   本文件把"改后的正向字面"钉住，并锁"旧字面不得回潮"。
//   处置件：`docs/audit/S4-差集处置-第四轮-2026-10-12.md`
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const tpl = (g, s = '语文', st = 'primary_low') => getPromptTemplate({ grade: st, subject: s, genType: g }).template;

describe('第四轮真错修复 · 正向锁（防回潮）', () => {
  it('R4-1 命题立意条：须有管辖域"凡设问处"（治"不设问的资料上指令空转"）', () => {
    expect(tpl('summary'), '命题立意条须带设问管辖域').toContain('凡设问处');
    expect(tpl('dictation'), '命题立意条须带设问管辖域').toContain('凡设问处');
    // 旧措辞"充当设问设计"（可与"内容设计/要点汇总"相混 ⇒ 与内容型定位相抵）不得回潮
    expect(tpl('summary'), '旧措辞不得回潮').not.toContain('充当设问设计');
  });

  it('R4-2 输出约定：管辖域须提到句首，覆盖"正文范围句 + 顺序句"', () => {
    // 【输出约定】属**注入层**（不在 getPromptTemplate 模板里）⇒ 按项目口径在**注入后快照**上核（验收对象＝注入后最终 prompt）。
    const snap = (f) => fs.readFileSync(path.join(ROOT, 'docs', 'audit', 'snapshot', f), 'utf8');
    const files = ['summary-语文-primary_high.txt', 'errorbook-英语-middle.txt', 'exam-物理-high.txt', 'dictation-语文-primary_low.txt'];
    for (const f of files) {
      const t = snap(f);
      expect(t, `${f} 输出约定须以"除讲解示范型栏目外"起句`).toContain('**除讲解示范型栏目外**');
      expect(t, `${f} 顺序句须限定为"其余题目"`).toContain('其余题目的参考答案由系统在正文生成后单独调用生成');
      // 旧式"括注只挂禁答列举之后"不得回潮（其覆盖不到正文范围句与顺序句）
      expect(t, `${f} 旧括注位置不得回潮`).not.toContain('听力原文（**讲解示范型栏目除外**）');
      expect(t, `${f} 旧括注位置不得回潮`).not.toContain('评分标准（**讲解示范型栏目除外**）');
    }
  });

  it('R4-3 ⑯：材料指向须按"该题设问"唯一确定，且整篇材料类不受"单对象"限制', () => {
    const t = tpl('reading', '语文', 'primary_low');
    expect(t, '⑯ 须落到"该题设问所指向的对象"').toContain('该题设问所指向的对象');
    expect(t, '⑯ 须给整篇材料类管辖域').toContain('整篇材料类不受此限');
    // 🔴 2026-10-18（①三维度·跨学科裸奔）：原字面"整篇选文类"含语文专属术语"选文"，而⑯条注入全部学科
    //    （全 486 面扫描实测数学/英语等 343 面）⇒ 中性化为"整篇材料类"（与条内"其他材料"同词）。
    //    反向锁：语文专属"整篇选文类"不得回潮。
    expect(t, '语文专属"整篇选文类"不得回潮').not.toContain('整篇选文类');
    expect(t, '旧"材料中只能有一个可被答案指向的对象"不得回潮').not.toContain('材料中只能有');
  });

  // 🔴 2026-10-17（作废旧计分对象口径）：原 R4-4「须给整题按对错档给分的出口」随 `SCORING_OBJECT_CALIBER`
  //    整条删除——新 A 方案下每题各自标「每〈单位〉X分，共Y分」，不需要"整题对错档"这一层出口。
  //    若真机出现多选题按选项逐处标分的问题，再作为**学科评分习惯**单独加，不恢复旧口径。

  it('R4-5 样本工具：grade 默认须按"学科×学段"推导（不得硬编码三年级）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'snapshotInjection.mjs'), 'utf8');
    expect(src, '不得硬编码默认年级').not.toContain("arg('grade', '三年级')");
    expect(src, '须按学科×学段推导').toContain('subjectGradeSystem');
    expect(src, '须有学段-年级兜底表').toContain('STAGE_GRADE_HINT');
  });
});
