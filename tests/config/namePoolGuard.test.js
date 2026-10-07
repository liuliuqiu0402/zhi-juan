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
// 🔴 2026-10-07 **取全修正（第三条，见台账〔83〕）**：机检此前**只扫通用池**（`TEACHING_BLUEPRINTS[g].sections`），
//   **漏扫 15 个"学科定制"名池** ⇒ 〔74〕只把**通用池**改名，15 处学科定制的 special 名池**仍是**
//   "分板块组织／每板块配解析"（做法句／要求句），而〔77〕体检据此误判"必改清单＝空"。现**同时扫通用池与学科定制池**，
//   并加一条**单源一致性**断言（special 通用池与 15 处学科定制池须逐字同名同注，防"改了通用没改定制"重演）。
import { describe, it, expect } from 'vitest';
import { TEACHING_BLUEPRINTS, TEACHING_SUBJECT_BLUEPRINTS } from '../../src/config/teachingBlueprints.js';
import { STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import { readFileSync } from 'node:fs';
import { specialDomainOptions, resolveSpecialDomain } from '../../src/config/specialDomains.js';

const RULES = [
  ['长度>8字', (n) => n.length <= 8],
  ['以做法/要求词起句', (n) => !/^(每|把|请|按要求|分别|依次)/.test(n)],
  ['含做法/要求词、助词尾或纯活动名', (n) => !/(组织|安排|配置|须|的$|(闯关|游戏|大冒险)$)/.test(n)],
];
/** 题型名（2026-10-07 · 配套"现实对账"）：现实教辅一级栏目里混有题型名 ⇒ **不得进栏目名**。
 *  **只判栏目名，不动指令文本**；**只收本轮调研有实据者**（英语教辅一级栏目实见四项）。
 *  蓝图的块名（选择题/填空题/连线题/判断题…）与通识题型名**一律不列**——前者已有 2026-10-05 裁定（"不算诱导、保留"），
 *  后者无本轮实据（避免用通识给项目立规矩）。
 *  范围＝通用池 ＋ 15 学科定制池 ＋ 领域层；**不含 `examPaperBlueprints`**（同上裁定）。 */
const TASK_TYPE_NAMES = ['完形填空', '七选五', '语法单选', '适当的形式填空'];
const taskTypeHits = (names) => names.map(bare)
  .filter((n) => n && TASK_TYPE_NAMES.some((w) => n.includes(w)));
const viol = (n) => RULES.filter(([, ok]) => !ok(n)).map(([label]) => label);
/** 剥掉选项层 emoji 前缀后再判（emoji 是选择器前缀，不是栏目名的一部分） */
const bare = (n) => String(n || '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
const check = (names) => names.map(bare).filter((n) => n && viol(n).length);

/** columns 型（有 h2 栏目名池）；**题内分项型 errorbook 不入**（见文件头取全修正） */
const COLUMN_TYPES = ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'review'];
const poolOf = (g) => ((TEACHING_BLUEPRINTS[g]?.sections || []).map((s) => (typeof s === 'string' ? s : s.name)));
/** 2026-10-07 取全修正：**学科定制名池**同扫（见文件头第三条）。题内分项型 errorbook 同样不入。 */
const SUBJECTS_ALL = ['语文', '数学', '英语', '科学', '物理', '化学', '生物', '历史', '地理', '思想政治', '道德与法治', '信息科技', '音乐', '美术', '体育'];
const subjectPoolsOf = (g) => SUBJECTS_ALL
  .map((sub) => [sub, ((TEACHING_SUBJECT_BLUEPRINTS[sub]?.[g]?.sections || []).map((s) => (typeof s === 'string' ? s : s.name)))])
  .filter(([, names]) => names.length);
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

/** C 类豁免（跨批移交）：**待该批改名后移出**；此处逐名登记命中的规则面 */
/** 🔴 2026-10-07（取全修正当日）：special 兜底池两名已按调研改名（"基础巩固／典型例题解析"）；
 *  "变式训练"保留（FORMAL_SECTIONS 里 2026-09-28 用户裁定的必备栏目）。**扩到学科定制池后新报出 1 条**：
 *  道德与法治·默写积累的「道德修养与法治观念」 ⇒ 按〔66〕机制登记为其所属批（dictation）的 **C 类跨批移交**：
 *  须先做常规写法调研、结论入台账后方可改名池；**此后任何新违规仍必 fail**（逼进批体检）。 */
const PENDING = {
  dictation: { 道德修养与法治观念: '长度>8字｜"素养名当栏目名"（道德修养／法治观念为道法核心素养名）' },
};

describe('附·4 三·6 名池体检·机检臂（名性质：合规或已登记豁免）', () => {
  for (const g of COLUMN_TYPES) {
    it(`${g}：栏目名池名性质（通用池 ＋ 15 学科定制池）`, () => {
      const pools = [['通用', poolOf(g)], ...subjectPoolsOf(g)];
      const hits = [];
      for (const [who, names] of pools) {
        const registered = Object.keys(PENDING[g] || {}).filter((n) => names.includes(n));
        for (const n of check(names)) {
          if (!registered.includes(n)) hits.push(`${who}「${n}」（${viol(n).join('、')}）`);
        }
      }
      expect(hits,
        `${g} 出现未登记的"非栏目名"（做法句/要求句/活动名）——**须先做常规写法调研并把结论入台账**，方可改名池：`
        + ` ${hits.join(' / ')}`).toEqual([]);
    });
  }

  it('special：通用池 与 15 学科定制池 **逐字同名同注**（单源；防"改了通用没改定制"重演）', () => {
    const own = (bp) => (bp?.special?.sections || []).map((s) => `${s.name}｜${s.note}`);
    const generic = own(TEACHING_BLUEPRINTS);
    const off = [];
    for (const sub of SUBJECTS_ALL) {
      const mine = own(TEACHING_SUBJECT_BLUEPRINTS[sub]);
      if (mine.length && JSON.stringify(mine) !== JSON.stringify(generic)) off.push(sub);
    }
    expect(off, `以下学科的 special 栏目与通用池不一致（应单源对齐）：${off.join('、')}`).toEqual([]);
  });

  it('🔴 学科定制池与通用池**分型**：只许已登记的分型（防"漏同步"混进"分型"）', () => {
    // 2026-10-07 属主追问"其他 7 种资料类型的大类名没问题吧"→ 实测：special 是**字面同名同注**（见上一条），
    //   而 reading／dictation **本就学科分型**（见下表登记）。本断言锁"分型清单"：**新增分型必 fail**（逼逐条判"该分型/漏同步"）。
    const registered = {
      // 定制"阅读材料"（材料/案例阅读）vs 通用"原创选文"（语文学科的原创短文）——14 科（语文与通用同）
      reading: ['数学', '英语', '科学', '物理', '化学', '生物', '历史', '地理', '思想政治', '道德与法治', '信息科技', '音乐', '美术', '体育'],
      // 各科按本学科"默写对象"学科化（语文=看拼音写词语/积累默写/书写格；数学=公式法则/情境填空/书写规范；…）
      dictation: ['语文', '数学', '英语', '科学', '物理', '化学', '生物', '历史', '地理', '思想政治', '道德与法治', '信息科技', '音乐', '美术', '体育'],
    };
    const actual = {};
    for (const g of COLUMN_TYPES) {
      const generic = poolOf(g);
      for (const [sub, names] of subjectPoolsOf(g)) {
        if (JSON.stringify(names) === JSON.stringify(generic)) continue;
        (actual[g] = actual[g] || []).push(sub);
      }
    }
    for (const g of new Set([...Object.keys(registered), ...Object.keys(actual)])) {
      expect((actual[g] || []).sort(), `${g} 的分型学科清单须与登记一致（新增/减少都要更新登记）`).toEqual((registered[g] || []).sort());
    }
  });

  it('🔴 题型名不进栏目名（现实对账配套；examPaperBlueprints 不在范围内）', () => {
    const hit = [];
    for (const g of COLUMN_TYPES) {
      for (const [who, names] of [['通用', poolOf(g)], ...subjectPoolsOf(g)]) {
        for (const n of taskTypeHits(names)) hit.push(`${g}／${who}「${n}」`);
      }
    }
    for (const n of taskTypeHits(domainNamesOf())) hit.push(`领域层「${n}」`);
    expect(hit, `以下栏目名含题型名（无题型诱导铁律）：${hit.join(' / ')}`).toEqual([]);
  });

  it('🔴 选择器同步：UI 必须直读注册库、**不得硬编码领域名**（改库→选择器自动跟上）', () => {
    const src = readFileSync('src/modules/GenerateModule.vue', 'utf8'); // vitest cwd＝项目根
    expect(src, 'UI 必须直读注册库（specialDomainOptions）').toContain('specialDomainOptions(');
    const hard = [...new Set(domainNamesOf())].filter((n) => n && n.length >= 3 && src.includes(`'${n}'`));
    expect(hard, `GenerateModule.vue 硬编码了领域/栏目名：${hard.join(' / ')}`).toEqual([]);
  });

  it('🔴 学段边界：领域只出现在**该学科实际开设**的学段（单一事实源 STAGE_SUBJECTS；防全学段广播/学段弄错）', () => {
    // 属主 2026-10-07 提醒：有些学科只在指定学段开设（如 思想政治只高中、科学只到初中、物理/化学/生物/历史/地理只初高）
    const subjStages = {};
    for (const [st, subs] of Object.entries(STAGE_SUBJECTS)) {
      for (const s of subs) (subjStages[s] = subjStages[s] || []).push(st);
    }
    const bad = [];
    // ① 学科在该学段**不**开设 ⇒ 必须**没有**领域（防"全学段广播"）
    for (const [st, subs] of Object.entries(STAGE_SUBJECTS)) {
      for (const sub of Object.keys(subjStages)) {
        if (subs.includes(sub)) continue;
        const opts = specialDomainOptions(sub, st) || [];
        if (opts.length) bad.push(`${sub}·${st}（该学段不开设，却给了 ${opts.length} 个领域）`);
      }
    }
    // ② 已给出的领域，其 stageList 必须**含**该学段（防"学段错配"）
    for (const [sub, stages] of Object.entries(subjStages)) {
      for (const st of stages) {
        for (const o of specialDomainOptions(sub, st) || []) {
          const d = resolveSpecialDomain(sub, st, o.value);
          if (!d || !d.stageList || !d.stageList.includes(st)) bad.push(`${sub}·${st}「${o.value}」（stageList 不含本学段）`);
        }
      }
    }
    expect(bad, `学段边界违规：${bad.join(' / ')}`).toEqual([]);
  });

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

  it('豁免表＝已登记的 C 类跨批移交（当前仅 dictation 1 条；不得静默增删）', () => {
    // 2026-10-07 先解后锁：原断言"豁免表已清空"；扩扫学科定制池后新报出 dictation 1 条 ⇒ 随改。
    expect(Object.keys(PENDING).sort()).toEqual(['dictation']);
    expect(Object.keys(PENDING.dictation).sort()).toEqual(['道德修养与法治观念']);
  });
});
