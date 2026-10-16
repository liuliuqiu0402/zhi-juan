// 🔒 常驻守卫：同一数字跨块一致（分值单源 · 2026-10-04 G3）
// ============================================================
// 背景（G3 全范围排查）：分值/满分在**同一份 exam 实发**里出现在多处——
//   · 卷首行「考试时间：{duration}　满分：{fullScore}分」（模板 411）
//    · 任务行「（满分{fullScore}分，时长{duration}）」（buildInjectionInstruction 1234）
//    · 【卷面结构】块：部分行「听力部分（共N大题，满分M分）」＋ 大类行「本大类共M分」＋ 大题行「…共M分」
//  这些数字必须**同源同值**（单源＝蓝图库 bp.fullScore / bp.sections[].score）。
//  ⚠️ 为什么另立一守卫：`blueprintGuard`（G1）与 `scoreDurationConsistency` 锁的是**蓝图数据层**
//    （sum(sections.score) === fullScore）；本守卫锁的是**实发文本层**——防"模板/注入端另写一个数字"
//    这类漂移（数据层对、文本层却硬编码了别的值，blueprintGuard 看不见）。
// 判据（逐 实际开设 学科×学段）：
//    ① 卷首「满分：N分」的 N === bp.fullScore；
//    ② 卷面结构块内各「共N分」之和 === bp.fullScore（部分行的「满分M分」为小计，另按小计之和核）；
//    ③ 部分行小计之和 === bp.fullScore。
//  注：①判"取值"（非"数量"）；③只在有部分行（听力/笔试）时判。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS, buildStructureText, buildInjectionInstruction } from '../../src/config/promptLibrary.js';
import { findBlueprint } from '../../src/config/blueprintProvider.js';

/** 逐 学科×学段 构造 exam 实发文本（与 GenerateModule 同源：蓝图 → buildStructureText → buildInjectionInstruction） */
const buildExamDocs = () => {
  const out = [];
  for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subjects) {
      const cell = String(getPromptTemplate({ grade: stage, subject, genType: 'exam' })?.template || '');
      if (!cell) continue;
      let bp = null;
      try { bp = findBlueprint({ genType: 'exam', subject, stage, region: '', scopeType: '' }); } catch { /* 无蓝图不影响 */ }
      if (!bp) continue;
      const text = buildInjectionInstruction({
        template: cell, grade: stage, subject, genTypeLabel: '正式考卷',
        structure: buildStructureText(bp), fullScore: bp.fullScore || '', duration: bp.duration || '', genType: 'exam',
      });
      out.push({ key: `exam|${subject}|${stage}`, all: String(text || ''), fullScore: bp.fullScore });
    }
  }
  return out;
};

/** 取【卷面结构】块内的行（避开【题号与分值】账目算式的举例"共4题，每题2分，共8分"） */
const structLinesOf = (all) => {
  const lines = all.split('\n');
  const out = [];
  let inBlock = false;
  for (const ln of lines) {
    if (/^【卷面结构/.test(ln)) { inBlock = true; continue; }
    if (inBlock && /^【/.test(ln)) inBlock = false;
    if (inBlock) out.push(ln);
  }
  return out;
};

describe('同一数字跨块一致（G3）：exam 实发内 满分/各分值 与蓝图同源同值', () => {
  const docs = buildExamDocs();

  it('扫面＝实际开设的 exam 学科×学段（防扫描面缩水）', () => {
    expect(docs.length, 'exam 实发样本数').toBeGreaterThan(40);
  });

  it('卷首「满分：N分」的 N === 蓝图 fullScore（逐份）', () => {
    const bad = [];
    for (const { key, all, fullScore } of docs) {
      const m = all.match(/满分[：:]\s*(\d+)\s*分/);
      if (!m) { bad.push(`${key}: 卷首缺「满分：N分」`); continue; }
      if (Number(m[1]) !== fullScore) bad.push(`${key}: 卷首满分 ${m[1]} ≠ 蓝图 ${fullScore}`);
    }
    expect(bad.slice(0, 10), '卷首满分须等于蓝图 fullScore（单源）').toEqual([]);
  });

  it('【卷面结构】块内各分值（「参考分值 N分」或「本大类参考N分」）之和 === 蓝图 fullScore（逐份）', () => {
    const bad = [];
    for (const { key, all, fullScore } of docs) {
      // 🔴 2026-10-06（A4·结构改列式·先解后锁）：大题行由"（共X题，共Y分）"改 `｜题数 X｜分值 Y分`
      //    （题数作命题依据、标题形态由指令库分值条单源给、2026-10-10 起含单价）。
      // 🔴 2026-10-16（属主裁定·**分值只做参考**）：结构行分值全部改标"参考"——大题行 `｜参考分值 N分`、
      //    小学大类行 `（本大类参考N分）`、英语部分行 `（本部分参考N分）`。本行口径同步改准（仍是"结构所标
      //    之和＝满分"这一**数据自检**，与"模型侧不照抄"不矛盾：蓝本数据自身仍须闭合）。
      const nums = (structLinesOf(all).join('\n').match(/本大类参考(\d+)分|参考分值\s*(\d+)分/g) || []).map((s) => Number(s.match(/\d+/)[0]));
      const sum = nums.reduce((a, b) => a + b, 0);
      if (sum !== fullScore) bad.push(`${key}: 卷面结构各分值之和 ${sum} ≠ 蓝图 ${fullScore}`);
    }
    expect(bad.slice(0, 10), '卷面结构各分值之和须等于蓝图 fullScore（账目闭合）').toEqual([]);
  });

  it('部分行「满分M分」小计之和 === 蓝图 fullScore（有部分行时；听力/笔试）', () => {
    const bad = [];
    for (const { key, all, fullScore } of docs) {
      const m = structLinesOf(all).filter((ln) => /本部分参考\d+分/.test(ln)).map((ln) => Number(ln.match(/本部分参考(\d+)分/)[1]));
      if (!m.length) continue;
      const sum = m.reduce((a, b) => a + b, 0);
      if (sum !== fullScore) bad.push(`${key}: 部分小计之和 ${sum} ≠ 蓝图 ${fullScore}`);
    }
    expect(bad.slice(0, 10), '部分行小计之和须等于蓝图 fullScore').toEqual([]);
  });

  it('反向锁：结构分值须为"参考"形态，旧形（｜分值 N分／本大类共N分／本部分满分N分）不得回潮', () => {
    // 🔴 2026-10-16（属主裁定·**分值只做参考**）：旧形与"大题标题的分值说明"同形 ⇒ 模型照抄 ⇒ 实测
    //    "三、填空（每空1分，共24分）"而实贴 21 空。回退任何一形即红（54 面遍历）。
    const bad = [];
    for (const { key, all } of docs) {
      const lines = structLinesOf(all).join('\n');
      if (/｜分值\s*\d+分|本大类共\d+分|本部分满分\d+分/.test(lines)) bad.push(key);
    }
    expect(bad.slice(0, 10), '结构分值须标"参考分值／本大类参考／本部分参考"（旧形不得回潮）').toEqual([]);
  });
});
