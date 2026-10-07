// 附·4 三·6「每批必检·名池体检」的**机检臂**（2026-10-06 立；同日经第三批取全修正）
// ============================================================
// 为什么需要机检：教辅的 h2 栏目标题**由蓝图名称池注入**（模型不自拟）⇒"栏目名 ↔ 其下内容自洽"
//   **由蓝图承载**（分层设计）；**该分层成立的前提是名池本身合规**（把"做法句／要求句／活动名"当栏目名，
//   "名实自洽"就无从谈起）。**实证**：2026-10-06 special 兜底池"分板块组织／每板块配解析／变式训练"不合规。
// 🔴 2026-10-06 **取全修正（两条，见台账〔72〕）**：
//   · **按类型分流**：只扫"**columns 型**"的**栏目名池**；**"题内分项型"（errorbook）不扫**——其 `sections`
//     是**每道题的组成分项**（题目呈现→典型错解→…→变式训练），**本就不是栏目名**（`teachingBlueprints`
//     的 `FORMAL_SECTIONS` 表头注释明载"仅对 columns 型生效…题内分项型 errorbook 的 sections 不入本表"）。
//     ⇒ 修正前把 errorbook 分项名当"名池"报违规，属**机检取全缺陷**（已作废）。
//   · **补扫领域**：`specialDomains` 的**领域名**与**领域内 sections**同扫（special 的真正生效层是"专项领域"，
//     只扫通用兜底会**漏检领域名**）。领域 label 在选项层带 emoji 前缀（如"📖 阅读理解"）→ 判前**剥掉 emoji**。
// 机检三条硬指标（可判、无误报面；"术语堆叠/是否好懂"仍留人工判，见三·6 ①）：
//   ① 名长 ≤ 8 字；② 不以"每/把/请/按要求/分别/依次"等做法·要求词起句；
//   ③ 含**做法·要求词**（组织/安排/配置/须）或助词尾"的"，或以**纯活动名**（闯关/游戏/大冒险）结尾。
//   🔴 2026-10-06 **规则收窄（首跑即发现误报，据实收窄）**：原规则把"**应**"当裸字命中 ⇒ **误报**"应用
//     题"；把"训练/练习/活动"结尾一律判为活动名 ⇒ **误报**教辅正规栏目名"片段/篇章训练""数学建模活动"
//     （后者是 **2017 版课标原文的领域名**）。⇒ 删"应"、删"训练/练习/活动"结尾，只留**纯活动名**。
// 豁免表 = 已登记的 C 类跨批移交项：**新增违规必 fail**（逼"进批体检"）；**名池改了而登记没更新也 fail**。
import { describe, it, expect } from 'vitest';
import { TEACHING_BLUEPRINTS } from '../../src/config/teachingBlueprints.js';
import { specialDomainOptions, resolveSpecialDomain } from '../../src/config/specialDomains.js';

const RULES = [
  ['长度>8字', (n) => n.length <= 8],
  ['以做法/要求词起句', (n) => !/^(每|把|请|按要求|分别|依次)/.test(n)],
  ['含做法/要求词、助词尾或纯活动名', (n) => !/(组织|安排|配置|须|的$|(闯关|游戏|大冒险)$)/.test(n)],
];
const viol = (n) => RULES.filter(([, ok]) => !ok(n)).map(([label]) => label);
/** 剥掉选项层 emoji 前缀后再判（emoji 是选择器前缀，不是栏目名的一部分） */
const bare = (n) => String(n || '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
const check = (names) => names.map(bare).filter((n) => n && viol(n).length);

/** columns 型（有 h2 栏目名池）；**题内分项型 errorbook 不入**（见文件头取全修正） */
const COLUMN_TYPES = ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'review'];
const poolOf = (g) => ((TEACHING_BLUEPRINTS[g]?.sections || []).map((s) => (typeof s === 'string' ? s : s.name)));
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '思想政治', '科学', '道德与法治', '信息科技', '音乐', '美术', '体育'];
/** special 的生效层：各学科×学段的"专项领域"名与领域内 sections */
const domainNamesOf = () => {
  const out = [];
  for (const sub of SUBJECTS) {
    for (const st of STAGES) {
      for (const o of specialDomainOptions(sub, st) || []) {
        const d = resolveSpecialDomain(sub, st, o.value) || {};
        out.push(...[o.label, ...((d.sections || []).map((s) => (typeof s === 'string' ? s : s.name)))]);
      }
    }
  }
  return out;
};

/** C 类豁免（跨批移交）：**待本批改名后移出**；此处逐名登记命中的规则面 */
const PENDING = {
  // 用户已授权"按调研的来改"（台账〔68〕）；改完即从本表移出。注意"变式训练"是
  // FORMAL_SECTIONS 里 2026-09-28 用户裁定的**必备栏目**（只改名/措辞，不删其存在），
  // 且"训练"结尾在教辅栏目名里正规（如"片段/篇章训练"）⇒ 规则收窄后**不再判其违规**（改名随〔68〕授权走）。
  special: { 分板块组织: '做法句', 每板块配解析: '要求句' },
};

describe('附·4 三·6 名池体检·机检臂（名性质：合规或已登记豁免）', () => {
  for (const g of COLUMN_TYPES) {
    it(`${g}：栏目名池名性质`, () => {
      const names = poolOf(g);
      if (!names.length) return;
      const bad = check(names);
      const registered = Object.keys(PENDING[g] || {}).filter((n) => names.includes(n));
      const unexpected = bad.filter((n) => !registered.includes(n));
      expect(unexpected,
        `${g} 出现未登记的"非栏目名"（做法句/要求句/活动名）——**须先做常规写法调研并把结论入台账**，方可登记豁免放行：`
        + ` ${unexpected.map((n) => `${n}（${viol(n).join('、')}）`).join(' / ')}`).toEqual([]);
      expect(bad.slice().sort(), `${g} 违规名单须与登记一致（名池改动而未更新登记 = 体检未做）`).toEqual(registered.slice().sort());
    });
  }

  it('errorbook（题内分项型）：**不按栏目名判**（其 sections 是每题组成分项；取全修正）', () => {
    const names = poolOf('errorbook');
    expect(names.length, 'errorbook 有分项表').toBeGreaterThan(0);
    expect(COLUMN_TYPES.includes('errorbook'), 'errorbook 不得列入栏目名池扫描').toBe(false);
  });

  it('special 生效层·专项领域：领域名与领域内 sections 名性质合规（补扫取全）', () => {
    const names = domainNamesOf();
    expect(names.length, '应扫到真正生效的领域层').toBeGreaterThan(0);
    const bad = check(names);
    expect(bad, `领域层出现"非栏目名"：${bad.map((n) => `${n}（${viol(n).join('、')}）`).join(' / ')}`).toEqual([]);
  });

  it('豁免项仅 special 两项（待本批改名后移出；见台账〔68〕〔72〕）', () => {
    expect(Object.keys(PENDING)).toEqual(['special']);
    expect(Object.keys(PENDING.special).sort()).toEqual(['分板块组织', '每板块配解析']);
  });
});
