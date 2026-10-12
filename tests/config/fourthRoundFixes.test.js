// ============================================================
// 第四轮独立复核 · 真错修复的正向锁（2026-10-12）
//   背景：S4 第四轮盲审（`docs/audit/S4-独立复核-第四轮-产出.md`）抓出 5 条真错，我方逐条修。
//   本文件把"改后的正向字面"钉住，并锁"旧字面不得回潮"。
//   处置件：`docs/audit/S4-差集处置-第四轮-2026-10-12.md`
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate, SCORING_OBJECT_CALIBER } from '../../src/config/promptLibrary.js';

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

  it('R4-3 ⑯：材料指向须按"该题设问"唯一确定，且整篇选文类不受"单对象"限制', () => {
    const t = tpl('reading', '语文', 'primary_low');
    expect(t, '⑯ 须落到"该题设问所指向的对象"').toContain('该题设问所指向的对象');
    expect(t, '⑯ 须给整篇选文类管辖域').toContain('整篇选文类不受此限');
    expect(t, '旧"材料中只能有一个可被答案指向的对象"不得回潮').not.toContain('材料中只能有');
  });

  it('R4-4 计分对象：须给"整题按对错档给分"的出口（治与单价模型顶不上）', () => {
    expect(SCORING_OBJECT_CALIBER, '须有对错档给分出口').toContain('题面已按整题对错档给分时');
    expect(tpl('exam', '物理', 'high'), '须注入到正式卷').toContain('题面已按整题对错档给分时');
    // 措辞不得写成"…的规则"式（触 referenceResolveGuard 的"悬空物件指针"）
    expect(SCORING_OBJECT_CALIBER, '不得用"给分的规则"式措辞').not.toMatch(/给分的规则/);
  });

  it('R4-5 样本工具：grade 默认须按"学科×学段"推导（不得硬编码三年级）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'snapshotInjection.mjs'), 'utf8');
    expect(src, '不得硬编码默认年级').not.toContain("arg('grade', '三年级')");
    expect(src, '须按学科×学段推导').toContain('subjectGradeSystem');
    expect(src, '须有学段-年级兜底表').toContain('STAGE_GRADE_HINT');
  });
});
