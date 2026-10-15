# 逐源逐句 · 批 C-6 第 3 件：`validatorRules`（规则库 · 卷面质检）· 2026-10-15

> **片选**：批 C-6 第 3 件——`src/config/validatorRules.js`（583 行，27 条规则）。
> **它管什么**：**双阶段**卷面质检。①**阶段一·随指令注入**：启用 fix 类规则的 `promptHint` 汇成一段 `【版面质检规则（生成前约束）】` 注入（`buildValidatorPrompt`）⇒ **本库是第三个"注入文本源"**（另两个＝指令库 cell、程序附加段的其他块）；②**阶段二·生成后**：`auditExamPaper` 按三维度命中规则做确定性修复（fix）或静默抽检（guard → 生成报告【问题列表】）。
> **范围声明**：本件为 **C-6 第 3 件**；`themeConfig`（体量最大）**留 C-6 收官片**。
> **禁抽样**：本件逐条过（规则条目 27 ＋ 词表阈值 4 ＋ 接线三分 1 ＋ 匹配注入 3 ＋ 持久化合并 8 ＋ 学段归一 1 ＝ **44 条**）。

---

## 一、结果：**44 条过｜不合格 0｜真修 2｜候选 2｜观察 3｜记优 8**

**②课标：不适用**——本库是**卷面／格式／文风**规则，不引课标条文；"课标要求"类判据单源在 cell（【质量底线】＋`SUBJECT_STAGE_EXTRAS`／学段表），本库不广播取向。

---

## 二、真修 2 条

### 2.1 `writing-grid-fix.promptHint` 删"；作图题用方格纸作答区。"（**跨学科广播 ＋ 越学段诱导**）

原 hint：`任何书写载体（横线/书写格/空白行）均为空位，严禁预填字或答案；作图题用方格纸作答区。`，而本规则 `subjects:['*'] / stages:['*'] / 无 genTypes` ⇒ **486 面恒注入**。该半句三处实伤：

1. **跨学科噪音**：语文／英语／音乐／美术／体育／道德与法治／历史／地理等**无作图**学科也收到"作图题用方格纸"；
2. **越学段诱导**：数学·**初中/高中**本不该被提"方格纸"（`WRITING_CARRIER['数学'].middle/high = []`、`SQUARE_GRID.middle/high = null`，实证口径"由考试答题纸自带网格，**不给『用方格纸』诱导**"）⇒ 同份 prompt 里 hint 与 cell 判据**打架**；
3. **与本规则自身 description 自述相抵**（该 description 明写"具体载体条款（田字格/拼音格/四线三格/**方格纸**）由 `buildCarrierInstruction` 按 **学科×学段精确注入**"），并与项目自检件 `prompt-audit-checklist` 的"**同一句『作图类题用方格纸』只注入小学数学**……三处一致"相左。

**处置＝删该半句**（**单源**留在 `layoutSpec.buildCarrierInstruction`：数学小学段仍注入"作图类题用方格纸作答区（示例：`<span class="square-grid"></span>`）"，`blueprintInjection` 有正向锁）。本规则只保留**全学科中性**的半句（书写载体皆空位、严禁预填）。

**验证**：全量 **261 文件／3882 用例全绿**（该串无任何测试锁；`blueprintInjection`／`carrierMatrix`／`answerRegionMatrix` 的"仅小学段"断言仍绿）＋ build 通过；本改动落在 **system 段**（不计入 `promptGrowthGuard` 的 cell 字数）；**486 面文本各减该半句** ⇒ **9 类池重跑**。

### 2.2 两处**过期注释**与现行状态相抵（防后人据错注释删条目）

| 位置 | 原注释说 | 实际状态 | 处置 |
|---|---|---|---|
| `score-label-fix` 条目下方的 🗑 块 | "`score-label-fix` 条目**已删**……执行点同步删除" | **条目在位**（本文件 L71-81），且 `RULE_NO_EXEC` 登记、"三支上报已删但保留条目为纯生成前约束"；`validatorRules.test.js` 断言其在 exam **命中** | 改注：明写"曾一度连条目一起下线，**同日经属主裁定改为保留条目、只删上报三支**"，并提示"要动该条目先读 `RULE_NO_EXEC`"（**保留原 ①② 理由**，属"决定演变"的留痕） |
| `RULE_NO_EXEC` 头注 | "……本表**暂空**（留表以保持三分结构）" | 实际 `new Set(['score-label-fix'])` ⇒ **非空**（10-10 裁定后收入） | 改注：补入 10-10 裁定与"**本表非空**"，并写明留表是为承载三分结构 |

> 这两处是**同一天（2026-10-10）两次决定的中间态**留下的：先是"整个都不要了"、后改为"保留条目、只删上报"。代码跟上了、注释没跟上 ⇒ 本次改准（纯注释、零行为变化）。**顺带核对**其余三处 🗑 块（`teaching-volume-guard`／`answer-coverage-guard`／`question-numbering-key`）与其条目**确实已不在** `VALIDATOR_RULES`，与本文件外的记录一致 ⇒ 无同类问题。

---

## 三、候选 2 条（口径待定 · 登记不改）

| # | 位置 | 现状与疑点 | 可选口径（待属主定） |
|---|---|---|---|
| **C1** | `option-count-guard`（guard） | 引擎条件＝`/选一选\|选择\|选出/` 且 `options > 0 && options < 2` ⇒ **只有"恰好 1 个选项"才触发**；"题面说要选、却**一个选项都没有**"（=0）**不报**。而 description 与代码一致（"<2 时静默计数"）⇒ 属**阈值取舍**，非描述不符 | ①维持（注释已记"行首 `A.` 式例句/提示行会被 `countOptions` 误判为选项"，低阈值＝防误报）；②放宽到 `<3`（更贴"选项过少"语义，代价＝误报抬头）；③把 `> 0` 门去掉（补报"零选项"，但零选项与"例句被误判"难分）。**本轮不动** |
| **C2** | `text-format-sup-sub`（fix） | `subjects:['数学','化学','物理']`，**未含生物**；而生物卷确有上下标用例（光合/呼吸作用方程式 CO₂+H₂O、同位素示踪 ¹⁴CO₂、离子 Ca²⁺）⇒ 该学科**不经本规则**（既无生成前约束、生成后 Unicode 上下标也不归一）。同族的 `formula-form-guard` **已含生物** | ①维持"数理化专用"（`crossSubjectNeutralGuard` 的用例名即如此写）；②把 `生物` 纳入 `subjects`（**加一个词即生效、零风险**，归一逻辑本就通用）。**本轮不动** |

---

## 四、观察 3 条（登记不改）

**O1 · `silentDetails` 的 level 实有三态，头注只述两态**：`examValidator` 头注写"level='notice' 者进生成报告【问题列表】（取 `silentDetails.filter(level!=='debug')`），level='debug' 者仅 console"；实际库内另见 `silentCount(..., 'warn')`（`cn-ordinal-guard` 的大题序号重复支）⇒ **功能无碍**（过滤条件是 `!== 'debug'`，`warn` 同样进问题列表），但**术语需登记**，防后人误以为 `warn` 不会被展示。

**O2 · 一条"纪律"目前只靠人工遵守（可机检化）**：文件头字段说明写"`promptHint` 的缺省**须在 description 声明单源理由**；guard 类**一律不填**"。**实测落实到位**（6 条无-hint 的 fix 规则全部在 description 写明理由；8 条 guard 全无 hint），但**没有守卫**。⇒ **可加固建议**：加一条机检（"fix 类无 promptHint ⇒ description 必须含『不再提供 promptHint／不新增提示词／单源在』之一"＋"guard 类不得有 promptHint"），可把该纪律从"靠人工"变成"违反即红"。

**O3 · 台账（文档）里的规则名与实际 id 不符**：`三维度逐条重造-台账` 某处写作 `dup-content-detector`，实际 id＝`duplicate-content-fix`。⇒ 本次留痕（**不改镜像件**：该名散见多处旧件，属历史记录）。

---

## 五、逐条台账（源 × 条）

| 源 | 组 | 应过 | 已过 | 不合格 | 真修 |
|---|---|---|---|---|---|
| `VALIDATOR_RULES` · **27 条规则**（19 fix ＋ 8 guard；每条过 id／name／category／subjects／stages／genTypes／promptHint／description／enabled） | 27 | 27 | **27** | **0** | 1 |
| 同件 · **注入文本 13 条 `promptHint`**（pinyin-norm／template-cleanup／score-label-fix／duplicate-content-fix／text-format-fix／text-format-zhupoint／text-format-underline／text-format-sup-sub／text-format-phonetics／text-format-zhuyin／writing-grid-fix／writing-expression-fix／answer-area-fix） | （并入上行逐条） | — | — | — | 1 |
| 同件 · **词表与阈值**（`EMPTY_PRAISE_WORDS`／`AI_CLICHE_PHRASES`×3 族／`AI_CLICHE_MIN`／`AI_OPTION_SYM`） | 4 | 4 | **4** | **0** | 0 |
| 同件 · **接线三分 ＋ 完整性**（`VALIDATOR_GATES`／`RULE_EXEC_BY`／`RULE_NO_EXEC`） | 1 | 1 | **1** | **0** | 1（注释） |
| 同件 · **匹配与注入**（`getValidatorRules`／`getActiveFixPromptRules`／`buildValidatorPrompt`） | 3 | 3 | **3** | **0** | 0 |
| 同件 · **持久化与合并**（`RULES_STORAGE_KEY`／`loadUserRules`／`saveUserRule`／`deleteUserRule`／`resetUserRules`／`getMergedRules`／`listValidatorRules`／`getValidatorRule`） | 8 | 8 | **8** | **0** | 0 |
| 同件 · **学段归一**（`normalizeStage` 委派 `resolveStageKey`） | 1 | 1 | **1** | **0** | 0 |
| **合计** | — | **44** | **44** | **0** | **2** |

**逐条核对要点（节选）**：
- **三维度门控**：`subjects/stages` 支持 `'*'`、`genTypes` 缺省＝全类型；`text-format-zhupoint`（仅语文）／`-underline`（语英）／`-sup-sub`（数理化）／`-phonetics`（英语）／`-zhuyin`（语文低中段）／`writing-expression-fix`（语英）——**按学科/学段精确注入**，无跨学科广播（本条即 2.1 的判据）。
- **`getActiveFixPromptRules`**：只取 `enabled && category==='fix' && promptHint` 且命中三维度 ⇒ 与**面板展示同源**（"面板展示＝实际注入"，点规则跳转同 id），无第二套口径。
- **接线完整性**：27 条规则**恰好**分布于 23（独立分支）＋3（汇总执行）＋1（无执行点），**无空洞、无重叠**；`score-label-fix` 已正确落在 `RULE_NO_EXEC`（其 examValidator 2f/2g/2h 执行点已删）——不在 `VALIDATOR_GATES`。
- **净字纪律**：8 条 guard 与全部 AI 味规则**有意不给 promptHint**（守 `promptGrowthGuard`），改由产物侧机检；本片改动亦落在 system 段，不增 cell 字数。

---

## 六、记优 8 条

| # | 记优内容 |
|---|---|
| 1 | **"注入面＝promptHint"的纪律落实到位**：file 头字段说明要求"fix 类缺省须在 description 声明单源理由、guard 类一律不填"——实测 **6 条无-hint fix 全部在 description 写明理由**（`title-detail-fix`／`answer-section-*`／`image-block-fix`／`choice-first-blank-fix`／`emphasis-form-fix`），**8 条 guard 全无 hint**。 |
| 2 | **接线三分 ＋ 自动对账**：`VALIDATOR_GATES`／`RULE_EXEC_BY`／`RULE_NO_EXEC` 声明式登记，且由 `validatorWiring.test.js` **从 `examValidator` 源码的 `has()` 调用点自动对账**⇒ 新增分支或新增规则都会被强制同步（防"注册/执行漂移"）。 |
| 3 | **"只报不改"的护栏家族**：8 条 guard（公式形态／选项过少／选项位误置／汉字序号／空洞评价词／AI 味套话／选项对称／答案复述题干）都"给可见性、交编辑"，且注释逐条写明"为何不改"（改写属语义、程序猜着改会添乱）。 |
| 4 | **"能自证才断言"**：AI 味选项对称只在"题号可切分、选项组可解析、≥4 个文本型选项且字数完全相同（强信号）"时判；短选项（数字/符号/单词）**不参与**⇒ 防误报。答案复述题干明记**已知误报边界**（阅读类引用材料原句）并只作抽检。 |
| 5 | **词表/阈值单源 ＋ 反自欺**：`EMPTY_PRAISE_WORDS`／`AI_CLICHE_PHRASES`／`AI_CLICHE_MIN`／`AI_OPTION_SYM` 均导出、引擎与测试共用；并**锁死"词与词不得互相包含"**（否则一次出现被计两次——如只收 '另一方面' 不收 '一方面'），且说明"省略号式样（既…又…）无法子串匹配，不入表"。 |
| 6 | **G87 消一句自相抵**（`pinyin-norm`）：原句"字符归一半角（**ɡ→g**、全角字母→半角），严禁混入 IPA 音标字符（**ɡ**/ŋ/ɑ/ə）"——`ɡ` 既是归一目标又是严禁项 ⇒ 删该半句与 IPA 列举，只留"用标准注音、保留声调"（字形归一交程序侧）。 |
| 7 | **G43／G90／G73＋G86 四处的"该删就删"**：`title-detail-fix` 删 promptHint（与 `score-label-fix` **同义并置**且属元话语，单源回唯一落点，`bpWordingGuard` 正向锁）；`image-block-fix` 删 promptHint（格式单源在渲染契约，且 `subjects:['*']` 会把"一律用 [IMAGE]"广播给**无图能力学科**）；`text-format-sup-sub` 删"禁止 Unicode 上下标"的成因括注（`cm²`／`10²` 在正规教材试卷**普遍使用**，一刀切属超规范 ⇒ 改交生成后归一）。 |
| 8 | **跨学科中性化成体系**：`text-format-fix` 不再广播"分子/分母/公式"等数学措辞（权威源＝渲染契约 `FORMULA_RULES` 按 学科×学段 注入）、加点/画线拆为**语/英专属**独立规则、`writing-expression-fix` 自 `writing-grid-fix` 拆出（避免"写话/作文"词噪音与英语答案区"写作评分标准"误报）——本片 2.1 即为该体系补上最后一处漏网的"方格纸"广播。 |

---

## 七、同批同步件与验证

- **9 类池重跑**（`node scripts/auditPool.mjs <type>` ×9）——486 面 system 段文本变化已在池中追平；
- **16 份送审基线**（`docs/audit/snapshot/`）按项目口径**冻结不动**（读它的 `fourthRoundFixes` 断言与本句无关，仍是绿的）；
- 全量 **261 文件／3882 用例全绿** ＋ `npm run build` 通过（本片为 **system 段**改动，cell 字数与 `promptGrowthGuard` 不受影响）。

---

## 八、批 C 进度

| 片 | 内容 | 条数 | 不合格 | 状态 |
|---|---|---|---|---|
| C-1～C-4 | `levelMapping`／听力契约＋专项领域／尾约束＋清单角色／库外编码收官 | 74 | 0 | ✅ |
| C-5 | `eduRenderContract`（渲染契约） | 12 | 0 | ✅ |
| C-6 第 1 件 | `layoutSpec`（排版规格池 ＋ 配置入口取值） | 31 | 0 | ✅ |
| C-6 第 2 件 | `expertKnowledge`（风格库） | 24 | 0 | ✅ |
| **C-6 第 3 件** | **`validatorRules`（规则库）** | **44** | **0** | ✅ |
| **C-6 收官片（未做）** | `themeConfig`（体量最大·置末） | — | — | ⬜ |
