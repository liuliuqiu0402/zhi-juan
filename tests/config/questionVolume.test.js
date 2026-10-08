import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import { buildTeachingInjection, getTeachingBlueprint, TEACHING_GEN_TYPES } from '../../src/config/teachingBlueprints.js';

const tpl = (subject, stage, genType) => getPromptTemplate({ grade: stage, subject, genType })?.template || '';
const KEY = '在本次勾选范围的基础上安排相应充实的训练量';
const NO_CLONE = '同一知识点在同一资料内不得重复考查';

describe('题量充足（语义口径 · 2026-09-15 定版）', () => {
  // 依据（查证结论）：**两版课标都没有"题量充足/丰富"的原话**，课标在"量"上的取向恰是**控总量、提质减负**
  //   （义教：小学书面作业平均≤60 分钟、初中≤90 分钟、严控总量、避免机械重复；高中：评价"多途径、多方法"，
  //    课后作业只是日常评价途径之一）。"丰富/多样"只出现在**结构·类型维**（不同类型作业比例合理、
  //    评价方式丰富、多途径多方法）。→ 故**不引课标**（引了会把量往"控量"引，与诉求相反）。
  // 🔴 2026-09-15（用户定版）：题量充足改成**语义化折叠**——
  //    · 不设具体数字（防锚定偷懒）；不用"给足/足/达标线"等量词（防注水/贴地）；
  //    · "量"与"范围"一体，落到"在本次勾选范围的基础上安排相应充实的训练量，不因省事而缩减练习"
  //      （充实=品质要求非阈值，防单薄又防偷懒；范围=本次勾选章节，不指向原文防照搬）；
  //    · 防"重复凑量"独立成句："同一知识点在同一资料内不得重复考查"。
  // 🔴 2026-10-03（用户裁定·去诱导）：原句尾"错开设问角度与情境（换情境、换角度、换设问）"是**许可式**（换一维即合规），
  //   与【尾约束·资料内多样】②、"不得以相同深度重复"同病 → 一律删；判据统一到【质量底线】内容唯一性
  //   （**重复按考查作用判**：两处可互相替代即为重复，表面差异不改变判定）。
  // 题量底线本存在（teachingBlueprints 的 volume，如课时练小学高段 '10-15题'），但**刻意不注入**（防限定 AI）；
  // 本句只在模型侧给出**非量词**的品质/范围口径。
  // ⚠️ 2026-10-08（属主口令「一起下线」）：原文"由程序侧 teaching-volume-guard 静默判定（防单薄）"已不成立——
  //    该 guard **整条撤除**（规则条目／执行点／`VALIDATOR_GATES` 全撤），现阶段程序侧对篇幅与题量**无任何判据**（见台账〔276〕）。
  it('课时练/专项/阅读训练：在勾选范围基础上安排相应充实的训练量，且同知识点不得重复考查', () => {
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

  // 🔴 2026-10-06（第二批·面 6·材料·情境）：practice「细致与深度要求」原写"每道题情境完整"——**绝对读法**
  //   与【质量底线】"考查基础概念、规则与技能时，**情境从简或不用**"**相抵**（同一对象＝题目情境，两读）。
  //   现收口为"**情境（如有）**完整"＝与【质量底线】同口径（配不配情境按考查意图定；给了就须完整可判）。
  it('教辅情境口径与【质量底线】同读：配不配情境按考查意图，不读成"每题必配情境"', () => {
    const p = tpl('语文', 'primary_low', 'practice');
    expect(p, '绝对读法须已收口为"（如有）"').toContain('每道题情境（如有）完整');
    expect(p, '绝对读法不得回潮').not.toContain('每道题情境完整');
    expect(p, '判据仍在【质量底线】（基础题情境从简或不用）').toContain('情境从简或不用');
  });

  // 🔴 2026-10-06（第二批·面 13·载体↔数量·宽度）：书写类题的"按单位计分声称须自洽（单位分×字数）"
  //   原为**无条件**，而【答案区位置】已分型（正式考卷才注分值）、教辅**不标分值**（有锁测）⇒
  //   教辅被要求做分值账目＝**分值族外溢**（与 ㊻ 同类）。现顺该句自身分型加前件"（正式考卷）"。
  it('书写计分账目须带"正式考卷"前件（教辅无分值，不得外溢）', () => {
    expect(tpl('语文', 'primary_low', 'exam'), '考卷适用').toContain('**（正式考卷）**书写类题按单位');
    expect(tpl('语文', 'primary_low', 'practice'), '教辅侧同句带前件').toContain('**（正式考卷）**书写类题按单位');
  });

  it('不引课标、不设硬指标（句中无"课标"字样、无题量数字上限、无"给足/单薄"等量词）', () => {
    const text = tpl('英语', 'primary_high', 'practice');
    const i = text.indexOf(KEY);
    // 🔧 2026-09-16：改按**所在句**判定（原 ±60/220 字符窗口，邻近行字面一变即误伤：
    //    委托书删掉"名称与先后"半句后窗口前移，扫到了创作要求 1 的"按课标倡导的学习方式"）
    const lineStart = text.lastIndexOf('\n', i) + 1;
    const lineEnd = text.indexOf('\n', i);
    const clause = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    expect(clause).not.toContain('课标');
    expect(clause).not.toMatch(/不超过|最多|至少\s*\d|常规体量|给足|单薄|达不到|达标/);
  });

  // 🔴 2026-09-15（用户追问"内容型限字数不合适吧？"）：
  //    查证结论——**内容型提示词里没有任何字数要求**；当时程序侧 `teaching-volume-guard` 只有**下限**判据
  //    （summary 正文 <200 字、reading 选文 <80 字、题集类题号数 <5 才算"疑单薄"），且**静默**（不注入、不阻断、不改写）。
  //    ⚠️ **2026-10-08 更新（属主口令「一起下线」）**：该 guard **已整条撤除**（规则条目／执行点／`VALIDATOR_GATES` 全撤）
  //    ⇒ 现阶段程序侧对篇幅与题量**无任何判据**；蓝本 volume 里的"正文800-1200字"仍是**参考值**——不注入、且**无程序消费方**（见台账〔276〕）。
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

  // 🔴 2026-10-08（第 5 批 dictation 面 5·〔174〕·属主提醒"不能给具体题量诱导"）：
  //    蓝本 `stages.volume`（如"基础内容8-12条"／"正文800-1200字"）是**参考值**——**刻意不注入**（防限定 AI），
  //    且**无程序消费方**（原 `teaching-volume-guard` 已于 2026-10-08 整条下线，见台账〔276〕）；据实查证其阈值本是**自带硬编码**
  //    （`GT_CHECKS` ＋ 题集类题号数<5），**并未读取本字段**（与 `teachingBlueprints.test.js` 旧注释"程序护栏配置"
  //    相左，该注释已按本条口径改准）。**但**学科定制路径原先因 `getTeachingBlueprint` 的**对象级**浅合并把 `volume`
  //    整档清掉（实测 472/600 为空、工具库页脚显示"—"），已按**逐档字段级**合并修回。
  //    ⇒ **修回后必须守住"仍不进 prompt"**：本机检**逐格**核"该格解析出的 `volume` 串不得出现在
  //      **cell 模板**与**教辅注入文本**里"（回潮即 fail）——把"题量底线永不进 prompt"这条口径受检。
  it('🔴 题量底线（蓝本 volume）永不进 prompt：cell 与教辅注入皆不得含其字面（防题量诱导）', () => {
    let n = 0;
    for (const g of TEACHING_GEN_TYPES) {
      for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
        for (const subject of subjects) {
          const bp = getTeachingBlueprint({ genType: g, stage, subject });
          if (!bp) continue;
          n += 1;
          const v = bp.stageParams?.volume || '';
          // ① 参考值在位（学科路径同样在位；原对象级浅合并会丢）
          expect(v, `${g}|${stage}|${subject} 题量底线（参考值）应到位`).toBeTruthy();
          // ② 永不进 prompt：注入文本、cell 模板均不得含该字面
          expect(buildTeachingInjection({ genType: g, stage, subject }), `${g}|${stage}|${subject} 注入不得含题量底线`).not.toContain(v);
          expect(tpl(subject, stage, g), `${g}|${stage}|${subject} 模板不得含题量底线`).not.toContain(v);
        }
      }
    }
    expect(n, '应扫到 8 类型 × 54 开设格（防假绿）').toBeGreaterThan(400);
  });
});
