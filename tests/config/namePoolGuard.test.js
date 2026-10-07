// 附·4 三·6「每批必检·名池体检」的**机检臂**（2026-10-06 用户裁定"加上"后立）
// ============================================================
// 为什么需要机检：教辅（题类/内容型）的 **h2 栏目标题由蓝图名称池注入**（模型不自拟）⇒
//   "栏目名 ↔ 其下内容自洽"**由蓝图承载**（分层设计）；**该分层成立的前提是名池本身合规**。
//   名池不合规（把"做法句／要求句／活动名"当栏目名），"名实自洽"就无从谈起。
//   **实证**：2026-10-06 practice 批暴露 `special` 名池"分板块组织／每板块配解析／变式训练"不合规
//   （做法句／要求句／活动名）——已按 `附·4 四·前置步` 登记为 **C 类跨批移交**（special 批前置调研后修）。
// 机检三条硬指标（可判、无误报面；"术语堆叠/是否好懂"仍留人工判，见 `三·6` ①）：
//   ① 名长 ≤ 8 字（栏目名短句性）；② 不以"每/把/请/按要求/分别/依次"等做法·要求词起句；
//   ③ 不含做法·要求动词与助词尾（组织/安排/配置/须/应/"的"结尾），亦不以"训练/练习/活动/闯关/游戏"结尾（活动名）。
// 豁免表 = 已登记的 C 类跨批移交项：**新增违规必 fail**（逼"进批体检"）；**名池改了而登记没更新也 fail**。
import { describe, it, expect } from 'vitest';
import { TEACHING_BLUEPRINTS } from '../../src/config/teachingBlueprints.js';

const RULES = [
  ['长度>8字', (n) => n.length <= 8],
  ['以做法/要求词起句', (n) => !/^(每|把|请|按要求|分别|依次)/.test(n)],
  ['含做法/要求词或助词尾', (n) => !/(组织|安排|配置|须|应|的$|(训练|练习|活动|闯关|游戏)$)/.test(n)],
];
const viol = (n) => RULES.filter(([, ok]) => !ok(n)).map(([label]) => label);
const poolOf = (g) => ((TEACHING_BLUEPRINTS[g]?.sections || []).map((s) => (typeof s === 'string' ? s : s.name)));
const TYPES = ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];

/** C 类豁免（跨批移交）：待该类型批"常规写法调研"后改；此处逐名登记命中的规则面 */
const PENDING = {
  special: { 分板块组织: '做法句', 每板块配解析: '要求句', 变式训练: '活动名' },
  // 2026-10-06 机检臂首次运行即报出：`errorbook`（错题本）名池亦含"变式训练"（活动名，非栏目名）
  //   ⇒ **新增 C 类**（errorbook 批前置调研后修）；两类型同一名，属同一处不合规。
  errorbook: { 变式训练: '活动名' },
};

describe('附·4 三·6 名池体检·机检臂（名性质：合规或已登记豁免）', () => {
  for (const g of TYPES) {
    it(`${g}：名池名性质`, () => {
      const names = poolOf(g);
      if (!names.length) return; // 该类型不用 h2 名池（如 errorbook 用块标题自拟）
      const bad = names.filter((n) => viol(n).length);
      const registered = Object.keys(PENDING[g] || {}).filter((n) => names.includes(n));
      const unexpected = bad.filter((n) => !registered.includes(n));
      expect(unexpected,
        `${g} 出现未登记的"非栏目名"（做法句/要求句/活动名）——**须先做常规写法调研并把结论入台账**，方可登记豁免放行：`
        + ` ${unexpected.map((n) => `${n}（${viol(n).join('、')}）`).join(' / ')}`).toEqual([]);
      expect(bad.slice().sort(),
        `${g} 违规名单须与登记一致（名池改动而未更新登记 = 体检未做）`).toEqual(registered.slice().sort());
    });
  }
  it('豁免项仅 special 与 errorbook（C 类跨批移交，已在台账登记）', () => {
    expect(Object.keys(PENDING).sort()).toEqual(['errorbook', 'special']);
    expect(Object.keys(PENDING.special).sort()).toEqual(['分板块组织', '变式训练', '每板块配解析']);
    expect(Object.keys(PENDING.errorbook)).toEqual(['变式训练']);
  });
});
