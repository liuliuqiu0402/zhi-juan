// ============================================================
// 范围指代守卫（2026-10-13 增·属主："蓝图结构中写本单元不合适吧？应该改为比如勾选范围"）
// ------------------------------------------------------------
// 为什么单列一条：产品**范围模型**＝用户勾选（可**一课／一单元／跨单元／全册**），而指令文本里原写
//   "本单元"（实测 486 面内 1617 处）、"本课"（118 处）——**指代比范围模型窄**：勾一课或跨单元时，
//   "本单元"落空（模型据"本单元"自行假定一个单元 ⇒ 取材与所勾范围不符）。
// 口径：一律用项目既有规范词 **「本次范围」**（判据自足、与勾选一一对应）。
// 本守卫做**双向锁**：
//   · 反向：486 面装配文本**不得含** '本单元'／'本课'（含模板 `{unit}`/`{scope}` 占位符的**兜底值**——
//     那条 fallback 曾在 `buildInjectionInstruction` 里写 '本单元'，不扫就漏）；
//   · 正向：'本次范围' 必须真在场（防"删干净了但没换成规范词"＝空转）。
// 有牙自证：合成一段旧措辞 ⇒ 检查函数**必须报出命中**（防"守卫永远绿"）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { faceTexts } from '../../scripts/instructionText.mjs';

const OLD = /本单元|本课/g;
const NEW = '本次范围';

/** 命中收集（返回 [面键, 命中次数] 列表） */
const scan = (text) => (String(text || '').match(OLD) || []).length;

describe('范围指代守卫：入指令文本须用「本次范围」（不得"本单元/本课"）', () => {
  const faces = faceTexts();

  it('① 面集完整（回归"扫了个空集"）', () => {
    expect(faces.length).toBe(486);
  });

  it('② 反向锁：486 面装配文本不得含「本单元」/「本课」（含占位符兜底值）', () => {
    const bad = faces.filter((f) => scan(f.text) > 0)
      .map((f) => `${f.subject}×${f.stage}×${f.genType}(${scan(f.text)})`);
    expect(bad.slice(0, 20), `仍在用旧指代的（前 20 例）：${bad.length} 面`).toEqual([]);
    expect(bad.length, `共 ${bad.length} 面仍含旧指代`).toBe(0);
  });

  it('③ 正向锁：「本次范围」必须真在场（防"删干净没换词"的空转）', () => {
    const missing = faces.filter((f) => !f.text.includes(NEW)).map((f) => `${f.subject}×${f.stage}×${f.genType}`);
    expect(missing.slice(0, 10), '未出现「本次范围」的面').toEqual([]);
  });

  it('④ 有牙自证：旧措辞样本必须被判红（守卫不是永远绿）', () => {
    const oldSample = '覆盖本单元识字与写字领域的代表性知识点（抽样命题，不要求全量）';
    const fixedSample = '覆盖本次范围识字与写字领域的代表性知识点（抽样命题，不要求全量）';
    expect(scan(oldSample), '旧措辞应被报出').toBeGreaterThan(0);
    expect(scan(fixedSample), '新措辞应通过').toBe(0);
    expect(fixedSample.includes(NEW)).toBe(true);
  });

  it('⑤ 占位符兜底值已改准（{unit}/{scope} 无值时渲染规范词）', () => {
    // 面文本由 faceTexts() 以"不传 unit"装配 ⇒ 该分支即占位符兜底；此处再正向确认一次
    const t = faces.find((f) => f.genType === 'summary' && f.subject === '语文');
    expect(t.text.includes(NEW)).toBe(true);
    expect(t.text.includes('本单元'), '占位符兜底不得回退到"本单元"').toBe(false);
  });

  it('⑥ 同族锁：非正式卷（教辅/内容型）面不得称"本卷"（资料不是卷）', () => {
    // 实测成因：`QUESTION_OBJECT_CALIBER` 与共享块曾写"本卷层级"，落在 practice/special/reading/dictation/review 上；
    //   现已改中性词"本资料层级"。考试卷（exam）称"本卷"正确，故本锁**只约束非 exam 面**。
    const bad = faces.filter((f) => f.genType !== 'exam' && f.text.includes('本卷'))
      .map((f) => `${f.subject}×${f.stage}×${f.genType}`);
    expect(bad.slice(0, 10), `非正式卷面仍在称"本卷"（${bad.length} 面）`).toEqual([]);
  });
});
