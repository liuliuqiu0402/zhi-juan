import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const tpl = (subject, stage, genType) => getPromptTemplate({ grade: stage, subject, genType })?.template || '';
const KEY = '在本次勾选范围的基础上安排相应充实的训练量';
const NO_CLONE = '同一知识点在同一资料内不得以相同深度重复考查';

describe('题量充足（语义口径 · 2026-09-15 定版）', () => {
  // 依据（查证结论）：**两版课标都没有"题量充足/丰富"的原话**，课标在"量"上的取向恰是**控总量、提质减负**
  //   （义教：小学书面作业平均≤60 分钟、初中≤90 分钟、严控总量、避免机械重复；高中：评价"多途径、多方法"，
  //    课后作业只是日常评价途径之一）。"丰富/多样"只出现在**结构·类型维**（不同类型作业比例合理、
  //    评价方式丰富、多途径多方法）。→ 故**不引课标**（引了会把量往"控量"引，与诉求相反）。
  // 🔴 2026-09-15（用户定版）：题量充足改成**语义化折叠**——
  //    · 不设具体数字（防锚定偷懒）；不用"给足/足/达标线"等量词（防注水/贴地）；
  //    · "量"与"范围"一体，落到"在本次勾选范围的基础上安排相应充实的训练量，不因省事而缩减练习"
  //      （充实=品质要求非阈值，防单薄又防偷懒；范围=本次勾选章节，不指向原文防照搬）；
  //    · 防"重复凑量"独立成句："同一知识点在同一资料内不得以相同深度重复考查，分层次呈现时各层侧重不同、
  //      错开设问角度与情境"（作用域=同一资料内；判据=同知识点+同深度；允许跨层变式/同类替换）。
  // 题量底线本存在（teachingBlueprints 的 volume，如课时练小学高段 '10-15题'），但**刻意不注入**（防限定 AI），
  // 由程序侧 teaching-volume-guard 静默判定（防单薄）；本句只在模型侧给出**非量词**的品质/范围口径。
  it('课时练/专项/阅读训练：在勾选范围基础上安排相应充实的训练量，且防"同知识点同深度"重复', () => {
    const cases = [
      ['英语', 'primary_high', 'practice'],
      ['数学', 'middle', 'special'],
      ['语文', 'primary_mid', 'reading'],
    ];
    for (const [s, st, t] of cases) {
      const text = tpl(s, st, t);
      expect(text, `${s}/${st}/${t} 应有题量口径`).toContain(KEY);
      expect(text, `${s}/${st}/${t} 应带防同深度重复`).toContain(NO_CLONE);
    }
  });

  it('范围收敛：考卷（卷面结构给定题量）与内容型（篇幅而非题量）不注入', () => {
    for (const t of ['exam', 'summary', 'preview', 'dictation', 'review']) {
      expect(tpl('英语', 'primary_high', t), t).not.toContain(KEY);
    }
  });

  it('不引课标、不设硬指标（句中无"课标"字样、无题量数字上限、无"给足/单薄"等量词）', () => {
    const text = tpl('英语', 'primary_high', 'practice');
    const i = text.indexOf(KEY);
    const clause = text.slice(Math.max(0, i - 60), i + 220);
    expect(clause).not.toContain('课标');
    expect(clause).not.toMatch(/不超过|最多|至少\s*\d|常规体量|给足|单薄|达不到|达标/);
  });

  // 🔴 2026-09-15（用户追问"内容型限字数不合适吧？"）：
  //    查证结论——**内容型提示词里没有任何字数要求**；程序侧 `teaching-volume-guard` 只有**下限**判据
  //    （summary 正文 <200 字、reading 选文 <80 字、题集类题号数 <5 才算"疑单薄"），且**静默**（不注入、不阻断、不改写）；
  //    蓝本 volume 里的"正文800-1200字"只是参考值，既不注入也未被 guard 使用。
  //    本用例把"内容型与考卷不得出现字数上限/字数区间"锁死，防以后有人把篇幅做成限制。
  it('内容型与考卷不得出现"字数上限/字数区间"（篇幅只作下限静默校验，不做限制）', () => {
    // ⚠️ 勿误伤"1~2 字位"（那是空位宽度）→ 各分支加 (?!位)；
    //    也不要把**下限**（"不少于 X 字"）算进来——只作下限是允许的，本条只锁上限/区间。
    const CAP_RE = /字以内|不超过\s*\d+\s*字(?!位)|最多\s*\d+\s*字(?!位)|限\s*\d+\s*字(?!位)|\d+\s*[-~～至]\s*\d+\s*字(?!位)/;
    for (const t of ['summary', 'preview', 'dictation', 'review', 'exam']) {
      const text = tpl('英语', 'primary_high', t);
      expect(text, `${t} 不得限制字数`).not.toMatch(CAP_RE);
    }
  });
});
