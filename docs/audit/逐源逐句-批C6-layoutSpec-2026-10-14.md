# 逐源逐句 · 批 C-6 第 1 件：`layoutSpec`（排版规格池 · 载体／作答形态／学段参数）· 2026-10-14

> **片选**：批 C-6 第 1 件——`src/config/layoutSpec.js`（＋其**配置入口** `LayoutSpecView.vue` 中与规格库取值口径相关的两处）。
> **它管什么**：学段渲染参数的**唯一事实源**。**程序侧**读它（骨架编译器／清洗器 `normalizeBlankMarkers`／导出端 `docxBuilder`／排版模块 `themeConfig`／校验器 `examValidator`）；**模型不感知**——但其中有 **5 个导出会生成注入给模型的条款**（载体协议／作答空位形态／长答载体／换算锚／内容型载体协议句），故本件分**两段**过。
> **范围声明**：本件为 **C-6 第 1 件**；`expertKnowledge`（风格库）／`validatorRules`（规则库）／`themeConfig`（体量最大）**留 C-6 续片**（不假装一并覆盖）。
> **禁抽样**：本件逐条过（注入件 19 条 ＋ 程序件 10 条 ＋ 配置入口 2 条 ＝ **31 条**）。

---

## 一、结果：**31 条过｜不合格 0｜真修 3｜候选 0｜观察 2 ＋ 说明 1｜记优 11**

**②课标：不适用。** 本件全文三处自陈口径——`⚠️ 关键词是"书写意图"识别，非课标要求（卷面惯例）`（`CARRIER_RULES`）／`⚠️ 非课标要求，属卷面惯例（各省考试院答题卡规范）`（`ANSWER_REGION`）／`数值属卷面惯例口径（不在代码里编）`（上限表）——**不冒充课标、且留了按地区调整的入口**（规格库面板），属正确的维度归属。

---

## 二、本件两段口径

| 段 | 内容 | 条数 |
|---|---|---|
| **A · 注入件**（模型可见判据） | 载体正句／载体块合成／位置族 4 条／阅读拼音行／成篇句／换算锚／作答形态通用 6 条／数学支／长答载体 | **19** |
| **B · 程序件**（模型不感知，但须自洽） | 学段归一链／BLANK 消毒／`WRITING_CARRIER`／`CARRIER_RULES`／`CARRIER_DECLARATION`／`ANSWER_REGION`＋上限两表／格子尺寸表／选择位单一出口／合并与分组 | **10** |
| **C · 配置入口**（面板候选值 ↔ 下游真值） | `GRID_OPTIONS`／`CARRIER_OPTIONS`／`SUBJECT_OPTIONS` | **2** |

---

## 三、真修 3 条

### 3.1 换算锚的**链式假等式**（`buildBlankWidthInstruction`，净 0 字）

原句：`1 字位≈1 个全角空格≈N em 书写宽`——把两件**互不相干**的事串成一条等式链：
「字位 ↔ 全角空格」**恒 1:1**（与规格无关）；「字位 → 书写宽」才是 `wordGap`（**面板可调 1..4**）。默认 `wordGap=1` 时两者数值**巧合相同**、看不出问题；一旦面板调到 ≠1，注入句即成「1 字位≈1 个全角空格≈**2** em 书写宽」＝**同一物两个宽度**（一个全角空格恒 ≈1 em，不可能 ＝2 em）＝**自相抵**。

改法：拆成**两段陈述**（判据与数值均不变）：

```
1 字位≈1 个全角空格；书写宽＝N em
```

**留痕**：`tests/recipe/answerSpaceInstruction.test.js` 两处字面锁按新句改准（附缘由），并加**反向锁** `not.toContain('个全角空格≈')`——任何 `wordGap` 下都不得再出现链式假等式。`promptGrowthGuard` 通过（净 0）。

### 3.2 面板「必须载体」候选用了**前缀常量**冒充真类名（`LayoutSpecView.GRID_OPTIONS`／`CARRIER_OPTIONS`）

`GRID_OPTIONS`／`CARRIER_OPTIONS` 的"方格"项取值 `'square'`——而 `'square'` 只是 `CARRIERS.SQUARE` 自注的**「作图方格纸类名前缀，匹配 square-grid」**（**全库无消费方**，无任何 CSS／渲染分支认 `.square`）。真类名是 `square-grid`（`CARRIERS.SQUARE_GRID`；`examValidator.GRID_CLASS_LABEL` 六键之一）。选它的两个后果都是**实伤**：

1. `CARRIER_RULES.must[].carrier` 被 `carrierMustParts` 直译为 `class="${r.carrier}"` ⇒ 注入给模型的是 `<span class="square"></span>`＝**指令点名一个渲染端不认的载体**——正是 C-5 `CARRIER_RENDER_CONTRACT` 要防的那类"看起来对、到手残缺"的暗伤；
2. 若写进 `WRITING_CARRIER` 允许表，则允许表含 `square` 而模型实际输出 `square-grid` ⇒ `writing-grid-fix` 把**合法方格纸判为越界剥掉**（与注释里记载的 `sixian-ge` 被误剥属同类事故）。

改法：两处一律改真类名 `square-grid`（标签取唯一标签源 `CARRIER_LABELS` 的「方格纸」）。

### 3.3 面板学科候选用了**旧别名**（`LayoutSpecView.SUBJECT_OPTIONS`）

原候选含 `道法／政治／信息`，与本库**自载口径**相抵（`layoutSpec` 注释：键名必须与 `expertKnowledge.subjects` canonical 名完全同名；`STAGE_SUBJECTS` 亦全为 canonical）。`carrierMustParts` 按 `r.subject !== subject` **原样比较**（**不做学科归一**，而归一发生在 `getCarrierAllowlist` 那一侧）⇒ 面板把某条 must 规则的学科改成别名后，该条**永不命中**＝**静默失效**。改法：候选改为 canonical 15 科（与 `subjects` 同名）。

**三处真修的新增守卫**（`tests/config/fixChecklistGuards.test.js` 新增一组）：把"**面板候选值 ⊆ 下游真值集**"钉住——载体候选只含 `CARRIERS` 枚举值、且不得再出现 `square`、且须含 `square-grid`；学科候选只含 `subjects` canonical 名。**原守卫只钉 path 的顶级键在合并白名单内（防死字段），不钉候选值** ⇒ 本次补上该盲区。

---

## 四、观察 2 条（登记不改）

**O1 · `getCarrierAllowlist` 的学段查表未过 `normalizeStage3`。** 同文件 `blankWriteScale` 已按〔182〕观察项 B17 加固（"未命中键再过一道 3 档归一"），`getCarrierAllowlist` 仍是 `row[stage]` **精确查表**，未命中即 `null`（＝不检测）。**现状零行为差异**：全部调用方（`promptLibrary` 的 `ctx.stage`／`GenerateModule` 的 `stageKey`／`examValidator` 经 `resolveStageKey`）**一律传 5 档键**。⇒ 不改（改了反而引入"3 档 `primary` 被折成 `primary_low` 载体表"的新语义）；若将来出现 3 档/中文调用方，按 B17 同法加固。

**O2 · 位置条的"成段/成篇"家族名 vs 作文格句。** 语文支同时注入两句：长答句 `答案须成句成段书写的题，输出整行书写横线…` ＋ 位置条 `需成段/成篇书写的题，其**整行载体**只在整题之后集中给一处…（本条仅限**成段/成篇**的整行书写横线）`；而同块作文格句写 `成篇成文类的作答位是**作文格**…**不得用整行书写横线代替**`。
- 台账〔1362〕已把位置族定为**四处有意分工**（短答空位＝行内／**成段·成篇横线＝整题之后**／逐词书写格＝同行紧邻／**作文格＝题干与配图之后**）⇒ 本项目口径里"成段/成篇横线"与"作文格"是**两个家族**，非相抵；
- 但**池的相抵扫描器没配上这一对**（`G3/G4/G5` 只把"书写载体协议 × 作文格"配成线索级候选，阈值 `ov≥0.12` 未达）⇒ 属**工具盲区**，本次由人读补上并判**有意分工**；
- **不改的理由**：该位置条是 **line 载体通用句**（英语成篇表达＝横线、科学简答＝横线都要它），改成语文专属即需动共用字面、且牵动内容型通道（内容型`成篇`无作文格、走横线）——**改动面 > 收益，且可能"越改越糟"**。⇒ 登记为**实证观察点**：真机若见"语文写话/作文给出整行横线而非作文格"，再按"语文支内把 `成篇` 让给作文格句"最小改。

**说明 1（非缺陷）· 面板无 `zuo-wen-ge` 候选。** 与 `CARRIER_RULES.forbid` 注释自陈的设计一致（`作文格由 writing-grid-fix 作文格通道单独管理，不在此列`；且 `examValidator` 对非语文无条件剥离 `zuo-wen-ge`）⇒ 面板不给该候选**正确**，不必补。

---

## 五、记优 11 条

| # | 记优内容 |
|---|---|
| 1 | **三段分层把"数值"从四处硬编码里抽出来**：排版规格库＝**数值/参数层**、规则库＝**逻辑/开关层**、`contentCleaner/docxBuilder/themeConfig`＝**执行层**，三层靠"执行入口读规格参数"串联。 |
| 2 | **命名双轨落地得干净**：`WRITING_CARRIER` 15 个学科键与 `expertKnowledge.subjects` **逐个同名**（含 `生物`／`信息科技` 而非旧别名），`getCarrierAllowlist` 先 `normalizeSubjectName(subject, stage)` 再查表 ⇒ 旧写法（道法／政治／信息／体育与健康…）**也能命中 canonical key**，剥离防线不因写法失效。 |
| 3 | **未定义学科 → `null` → 不检测**（"宁可不动，也不误剥"）——给新学科留了安全默认。 |
| 4 | **去诱导见于数据侧**：数学作图方格纸**仅小学段**合法（`middle/high` 显式空数组），注释写明理由"初中以上由考试答题纸自带网格，**不给'用方格纸'诱导**"。 |
| 5 | **`sanitizeBlankSpec` 档位消毒＋`writeScaleByStage` 透传**：档位收口 1≤minBlank≤maxCap≤maxBlank≤24、`wordGap` 限 1..4（越界档位无 CSS＝宽度静默失效）；并记下"曾整体丢掉手写系数 ⇒ `blankWriteScale` 恒落兜底 2 ⇒ 低段手写空间偏窄（台账记'已修'却从未生效）"这条**真踩坑**。 |
| 6 | **`ANSWER_MAX_ROWS_BY_SUBJECT` 走独立顶层表**：注释明写理由——`mergeDeep` **只并 base 已有键**，把覆盖写进 `ANSWER_REGION` 条目会被丢弃（**实测覆盖不生效**）⇒ 改独立表 + 浅合并，用户覆盖必保留。 |
| 7 | **生成侧与程序侧同表同源**：主观书写形态＝`getAnswerRegion(subject,stage).carrier`，与程序补差 `answer-area-fix` **读同一张表**（"语义与补差永不打架"）；`buildLongAnswerCarrierInstruction` 抽为单源，治的是**协议缺位**（内容型此前"模型侧无条款 ＋ 程序侧明确排除内容型"＝**三不管**，例题里成句成段的答案无处落）。 |
| 8 | **位置族四处有意分工**（短答空位＝行内／成段·成篇横线＝整题之后、分条之后／逐词书写格＝同行紧邻／作文格＝题干与配图之后）——消掉"载体放最后"被泛化到逐词书写格的那次事故。 |
| 9 | **总述句收敛为可判计数锚**：旧句"按书写惯例输出对应作答书写载体"把形态**整体交模型语感**⇒"理科解答画横线、该留白画框、作答区被文字占位"的语义真空源头；现只留"**字位↔书写宽**"这一可执行换算（`BLANK` 单源，改规格该句自动跟随），形态改由**判据式**（按所填内容定）承担。 |
| 10 | **选择类作答位位置＝单一出口**：`isForeignLangSubject`／`getChoiceBlankPosition` 一处定义，生成侧（`buildAnswerSpaceInstruction`）与程序侧（`examValidator 2j-6`）**同源引用**——注释记下曾出现"生成侧按学科、程序侧按多数票"的口径分裂（把中文卷搬成题首）；判定按**"外语类"正则**而非"英语"字面量 ⇒ 新增外语学科自动纳入。 |
| 11 | **判据链贯穿到"不许自相抵"**：数学支把「每式 ≥3 行（绝对下限）× 单题 ≤N 行（绝对上限）」这对**两式低段必相抵**的写法（`2×3=6 > 4`）改成"**上限为约束、下限随算式条数让位**"，并写明"算式少时每式 3 行、多时按上限平摊"——判据来源在注释里逐条可追。 |

---

## 六、本片台账（源 × 条）

| 源 | 组 | 应过 | 已过 | 不合格 | 真修 |
|---|---|---|---|---|---|
| `src/config/layoutSpec.js` · **注入件**（载体正句／合成／位置族／阅读拼音行／成篇句／换算锚／作答形态 6 条／数学支／长答载体） | 19 条 | 19 | **19** | **0** | **1** |
| 同上 · **程序件**（学段归一链／`BLANK` 消毒／`WRITING_CARRIER`／`CARRIER_RULES`／`CARRIER_DECLARATION`／`ANSWER_REGION`＋上限两表／格子尺寸表／选择位单一出口／合并与分组） | 10 条 | 10 | **10** | **0** | **0** |
| `src/modules/tools/views/LayoutSpecView.vue` · **配置入口取值一致性**（载体候选真类名／学科候选 canonical） | 2 条 | 2 | **2** | **0** | **2** |
| **合计** | — | **31** | **31** | **0** | **3** |

**同批同步件**：① 换算锚字面锁 2 处按新句改准 ＋ 反向锁（`answerSpaceInstruction`／`blankWidthInstruction`／`blueprintInjection` 共 8 处断言）；② `instructionBlocks.test.js` 的同构夹具同步新字面；③ 新增"面板候选值 ⊆ 下游真值"守卫 2 例；④ **9 类池重跑**（`node scripts/auditPool.mjs <type>`）；⑤ **4 份说明件的测试数校准**（258 文件／3864 用例 → **实测 261 文件／3881 用例**：`docs/项目说明.md`／`项目文件夹说明.md`／`文档索引.md`×2／`README.md`）；⑥ 台账〔450〕。

> **未随动件（有意）**：`docs/audit/snapshot/` 的 **16 份送审基线**按项目口径**冻结不动**（`snapshot-all/` 仅 `_L1-report.txt` 进 git、其余可由 `regenerateSnapshots.mjs` 本地重生成）；本片改动只影响其中一条换算锚句，且**读它的测试**（`fourthRoundFixes`）断言与本句无关 ⇒ 无需重生成。

---

## 七、批 C 进度

| 片 | 内容 | 条数 | 不合格 | 状态 |
|---|---|---|---|---|
| C-1～C-4 | `levelMapping`／听力契约＋专项领域／尾约束＋清单角色／库外编码收官 | 74 | 0 | ✅ |
| C-5 | `eduRenderContract`（渲染契约） | 12 | 0 | ✅ |
| **C-6 第 1 件** | **`layoutSpec`（排版规格池 ＋ 配置入口取值）** | **31** | **0** | ✅ |
| **C-6 续（未做）** | `expertKnowledge`（风格库）→ `validatorRules`（规则库）→ `themeConfig`（体量最大·置末） | — | — | ⬜ |
