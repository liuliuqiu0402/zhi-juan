// 🔒 常驻守卫：蓝图 note 的**课标出处受控**（附9 闭环 · 2026-10-14）
// ============================================================
// 背景：附9「课标必可溯」登记的缺口＝"**蓝图库 note 的课标原文无出处受控**"。
//   实测（2026-10-14，探针遍历三份蓝图数据的 `note` 字段）：
//     · `note` 对象 **903** 个／**唯一 note 498** 条；
//     · 其中 **53 条已带行内出处括注**（如"（2022义教语文·三、课程目标→（三）学段要求·第一学段）"、
//       "（普通高中语文课程标准（2017年版2020年修订）·五、学业质量·学业质量水平；四、课程内容）"）；
//     · 但**没有 `source` 字段** ⇒ `sourceControl.test.js`（只核 `SUBJECT_STAGE_EXTRAS`／`STAGE_*_EXTRAS` 的
//       `source`）**管不到** ⇒ 这正是缺口。
//   本守卫把"**行内出处**"也纳入受控：**凡 note 含课标特征词者，必须带行内出处括注**，否则判红。
// ⚠️ **有界锁**（词表口径，防误伤）：只锁"可能引课标**原文/原义**"的特征词（素养／学业质量／学段要求／
//   课程内容／学习任务群／课程目标／学业要求…）；**不锁课标"领域名"**（"积累与运用""梳理与探究""表达与交流"
//   ——它们以真题卷结构使用，属栏目/大类名，另有 `domainContract` 承载。纪律同 `crossSubjectNeutralGuard`）。
// 依据：`docs/design/指令改动标准-可机检清单.md` §六 八问②（课标：原文/原义 + 出处受控）与附9。
import { describe, it, expect } from 'vitest';
import { TEACHING_BLUEPRINTS, TEACHING_SUBJECT_BLUEPRINTS } from '../../src/config/teachingBlueprints.js';
import { EXAM_BLUEPRINTS } from '../../src/config/examPaperBlueprints.js';

/** 课标特征词（可能引"原文/原义"的）——**有界**：不含领域名
 *  🔴 2026-10-14（属主问"F7 这个要核实修复的吧"·条级扫描后补）：**补入 `课程理念`**——
 *     原表只含"…课程标准|课标|…"，而 `物理·初中` 的学段要求写的是"（2022 义教物理**课程理念**）"
 *     （**既不含"课标"、又带空格** ⇒ 被本表与 SRC 双双漏过＝双重免检）。该 note 现已改为受控写法
 *     `（2022义教物理·课程理念）`；本表补词后，**凡引"课程理念"者必须有受控出处**，防回潮。 */
const KEBIAO_ISH = /素养|学业质量|学段要求|学段目标|课程标准|课标|课程内容|学习任务群|课程目标|学业要求|课程理念/;
/** 行内出处括注的**受控族**：2022义教X／普通高中X课程标准（2017年版2020年修订）／地方课程实施办法（登记在案） */
const SRC = /（[^）]{0,220}?(2022义教|普通高中|课程实施办法|课程设置)[^）]{0,220}?）/;

/** 递归取所有 note（**不手抄**，直接遍历三份数据） */
function notesDeep(obj, p = '', out = []) {
  if (obj == null) return out;
  if (Array.isArray(obj)) { obj.forEach((v, i) => notesDeep(v, `${p}[${i}]`, out)); return out; }
  if (typeof obj === 'object') {
    if (typeof obj.note === 'string' && obj.note.trim()) out.push({ p, note: obj.note });
    for (const [k, v] of Object.entries(obj)) if (k !== 'note') notesDeep(v, `${p}.${k}`, out);
  }
  return out;
}

const ALL = [
  ...notesDeep(TEACHING_BLUEPRINTS, 'T'),
  ...notesDeep(TEACHING_SUBJECT_BLUEPRINTS, 'S'),
  ...notesDeep(EXAM_BLUEPRINTS, 'E'),
];
const UNIQ = [...new Set(ALL.map((x) => x.note))];
const FIRST_PATH = new Map();
for (const x of ALL) if (!FIRST_PATH.has(x.note)) FIRST_PATH.set(x.note, x.p);

describe('蓝图 note 课标出处受控（附9 闭环）', () => {
  it('note 覆盖量防"清空式假绿"（对象 903 / 唯一 498 为 2026-10-14 实测基线）', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(900);
    expect(UNIQ.length).toBeGreaterThanOrEqual(480);
  });

  it('凡含课标特征词的 note，必须带行内出处括注（否则判红）', () => {
    const bad = [];
    for (const n of UNIQ) {
      if (!KEBIAO_ISH.test(n)) continue;
      if (!SRC.test(n)) bad.push(`${FIRST_PATH.get(n)}：${n.slice(0, 80)}…`);
    }
    expect(bad, `以下 note 引了课标（特征词在）却无出处（附9：须有出处且受控；无出处＝改为非课标口径或补出处）：\n${bad.join('\n')}`).toEqual([]);
  });

  it('已带出处的 note 数不得缩水（防"出处被删"而不报）', () => {
    const withSrc = UNIQ.filter((n) => SRC.test(n)).length;
    expect(withSrc, '带行内课标出处的 note 数（2026-10-14 基线 53）').toBeGreaterThanOrEqual(50);
  });

  it('守卫有牙：合成违规判红、合规判绿（防守卫空转）', () => {
    // 含特征词、无出处 ⇒ 必须被抓
    expect(KEBIAO_ISH.test('核心素养：以生活与实验现象为情境') && !SRC.test('核心素养：以生活与实验现象为情境'), '须抓"含特征词无出处"').toBe(true);
    // 含特征词、带受控出处 ⇒ 须放行
    const ok = '素养立意…（2022义教语文·三、课程目标→（三）学段要求·第一学段）';
    expect(KEBIAO_ISH.test(ok) && SRC.test(ok), '须放过"带受控出处"').toBe(true);
    const ok2 = '…（普通高中语文课程标准（2017年版2020年修订）·五、学业质量）';
    expect(SRC.test(ok2), '高中课标出处族须被认').toBe(true);
    const ok3 = '一至二年级以听说为主（北京市义务教育课程实施办法·三、课程设置（二）科目设置）';
    expect(SRC.test(ok3), '已登记的地方文件出处须被认').toBe(true);
    // 领域名不锁（有界锁）
    expect(KEBIAO_ISH.test('积累与运用'), '领域名"积累与运用"不得被当特征词').toBe(false);
    expect(KEBIAO_ISH.test('梳理与探究'), '领域名"梳理与探究"不得被当特征词').toBe(false);
  });
});
