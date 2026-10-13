// ============================================================
// 入指令文本·红线守卫（2026-10-13 增·属主质询"以前说没问题，一测又是这个层面的问题"）
// ------------------------------------------------------------
// 为什么要有它：此前的"没问题"建立在**守卫全绿**上，而守卫只覆盖**已登记**的不变量 ⇒ **未登记的面＝盲区**。
//   本守卫把"枚举式审计"（`scripts/auditInstructionText.mjs`）的红线维度**固化进 CI**：
//   对 **486 面装配后文本**逐面扫描，命中即红。判据全部来自**属主裁定**：
//     · "所有入指令文本不应有不严谨表述" ⇒ ① 范围指代须用「本次范围」（不得"本单元/本课"）；
//                                      ② 非试卷类资料不得称"本卷"（资料不是卷）。
//     · "真题只是框架…**备注**不得指定内容" ⇒ ③ **备注本体**（`——【要求·须逐项落实】`之后）不得含
//        具体知识名物（教材模块/章节/年级进度/具体内容枚举）。
//   边界（有意）：**栏目名**（标记之前）按既有裁定保留，不在 ③ 之内；**课标要点/学段要求块**属"课标要求"，
//     亦不在 ③ 之内（该块命中另见审计脚本的观察维度）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { faceTexts } from '../../scripts/instructionText.mjs';

const MARK = '【要求·须逐项落实】';
const noteBodyOf = (ln) => { const i = ln.indexOf(MARK); return i < 0 ? '' : ln.slice(i + MARK.length); };
/** 具体知识名物（本批已逐条清除者；新增即判红 ⇒ 逼"先删再登记"） */
const CONTENT_WORDS = /数据与编码|互联网应用与创新|物联网|人工智能与智慧社会|数据与计算|信息系统与社会|在线学习与生活|数字媒体初步|数字设备初步认识|用眼卫生|细胞代谢|遗传与变异|工艺流程|物质结构|化学用语|物质推断|元素符号|化学式|方程式|力学与电学综合|电磁学综合|数与式|方程不等式|解三角形|解析几何|二年级含表内乘法|一年级下册起|三年级含三位数加减|多位数乘一位数|六年级含解方程/;

const faces = faceTexts();
const hitLines = (pred) => {
  const out = [];
  for (const f of faces) {
    for (const ln of String(f.text).split('\n')) {
      if (pred(ln, f)) out.push(`${f.subject}×${f.stage}×${f.genType}｜${ln.trim().slice(0, 60)}`);
    }
  }
  return out;
};

describe('入指令文本·红线守卫（486 面枚举）', () => {
  it('面集完整（防"扫空集"假绿）', () => {
    expect(faces.length).toBe(486);
  });

  it('① 范围指代：不得再用「本单元/本课」（含占位符兜底值）', () => {
    expect(hitLines((ln) => /本单元|本课/.test(ln)).slice(0, 5)).toEqual([]);
  });

  it('② 资料形态：非试卷类（教辅/内容型）不得称「本卷」', () => {
    expect(hitLines((ln, f) => f.genType !== 'exam' && /本卷/.test(ln)).slice(0, 5)).toEqual([]);
  });

  it('③ 蓝图/栏目**备注本体**不得含具体知识名物（栏目名不在其内）', () => {
    const bad = hitLines((ln) => ln.includes(MARK) && CONTENT_WORDS.test(noteBodyOf(ln)));
    expect(bad.slice(0, 5), `note 本体仍含内容指定：${bad.length} 行`).toEqual([]);
    expect(bad.length).toBe(0);
  });

  it('④ 有牙自证：旧措辞样本必须被判红（守卫不是永远绿）', () => {
    const oldNote = `· 计算题——${MARK}力学与电学综合，要求解答过程完整、步骤规范`;
    expect(CONTENT_WORDS.test(noteBodyOf(oldNote))).toBe(true);
    const okNote = `· 计算题——${MARK}要求解答过程完整、步骤规范`;
    expect(CONTENT_WORDS.test(noteBodyOf(okNote))).toBe(false);
    // 栏目名在标记之前 ⇒ 不计入 ③（边界正确性自证）
    const nameOnly = `· 化学用语——${MARK}书写规范呈现`;
    expect(CONTENT_WORDS.test(noteBodyOf(nameOnly))).toBe(false);
  });
});
