# 逐源逐句 · 批 C-6 收官片：`themeConfig`（主题系统 · 预览/导出/编辑器三端统一）· 2026-10-15

> **片选**：批 C-6 收官片——`src/themeConfig.js`（2813 行，体量最大置末）＋ 同口径核对 `src/utils/docxBuilder.js` 中田字格尺寸的调用侧注释。
> **它管什么**：主题系统的**全量渲染出口**——预设主题定义、自定义主题存储与 CRUD、智能标题识别、主题样式注入 HTML、密封线结构归一化、卷面固定件（注意事项+得分表）注入、主题内容包装（密封线/错题本/教案/笔记）、特殊主题编辑器 CSS。
> **范围声明**：本件为 **C-6 第 4 件／收官片**；逐模块逐条过（主题定义 1 组＋自定义主题 1 组＋查询/选项 1 组＋标题检测 1 组＋转换与智能标题 1 组＋标题样式查询 1 组＋applyThemeToContent 1 组＋密封线 8 函数 1 组＋卷面固定件 4 函数 1 组＋wrapContentForTheme 1 组＋stripSealStructure 1 条＋编辑器 CSS 1 组＋wrapTeachingSections 1 条＋default export 1 条 ＝ **14 组／28 条**）。
> **禁抽样**：本件逐条过（体量最大，但结构清晰，模块边界明确）。

---

## 一、结果：**28 条过｜不合格 0｜真修 3｜候选 0｜观察 2｜记优 6**

**②课标：不适用**——本库是**主题/渲染/排版**层，不引课标条文；学科·学段要点单源在 `promptLibrary` 与 `SUBJECT_STAGE_EXTRAS`，本系统只消费 `layoutSpec` 的规格值（mm/字号/行距）。

---

## 二、真修 3 条

### 2.1 `themeConfig.js` 田字格尺寸：注释＋兜底值从"12mm"改准为"14mm"（**国标 GB 40070-2021**）

**位置**：第 1432–1439 行（`applyThemeToContent` 内，`tzW`/`tzH` 变量定义处）。

**原状态**：注释写"定档低段 primary（**12mm**）"，兜底值 `?? 12`。而 `layoutSpec.js` 第 779 行 `GRID_CELL['tian-zi-ge'].primary` 已于 **2026-10-05 按 GB 40070-2021**（小学一、二年级田字格 宽＝高、**≥14.0mm**）上调为 **14mm**。

**问题**：代码读表（故预览早已是 14mm），但**注释与兜底值没跟上**——兜底值是"表缺失时的最后防线"，必须与国标现值同值；注释与代码不一致会误导后续维护者。

**处置**：① 注释补全国标依据与上调时间；② 兜底值 `?? 12` → `?? 14`；③ 同文件内第 1634–1635 行另一处旧注释（"12mm 三端统一"）同步改准。

**验证**：`layoutSpec.js` GRID_CELL 基准值 14mm ✓；`docxBuilder.js` `tzgCellMm()` 函数定义处兜底值同步为 14 ✓（见 2.3）。

### 2.2 `themeConfig.js` 删除死变量 `gcKey`（自"定档 primary"起即无消费方）

**位置**：原在 `tzW`/`tzH` 变量定义之上，现已删除（第 1436 行注释留痕说明）。

**原状态**：`gcKey` 变量按学段取档（primary/middle/high），但实际代码里田字格**只在小学低段使用**、且已直接定档 `primary`（`GRD['tian-zi-ge']?.primary`），`gcKey` 从未被消费。

**问题**：死变量=认知负担（后续维护者会找它的用途），且与"主题与学段解耦"的方向不一致——主题不该按学段硬编码取档，学段参数由调用方传入、规格读表。

**处置**：删除死变量，注释说明删除理由与"定档 primary"的决策背景。

### 2.3 `docxBuilder.js` 8 处调用侧过期注释同步改准为"14mm"（**注释漂移·零行为变化**）

**位置**：`src/utils/docxBuilder.js` 第 422、663–664、906、916、979、981、989、1018–1019 行，共 **8 处**。

**问题**：`tzgCellMm()` 函数定义处（第 42–49 行）已于 2026-10-15 批 C-6 前序件改准（注释＋兜底值 12→14），但**调用侧的行尾注释**仍写"定档低段 12mm"或"格宽统一 12mm"——与函数实际返回值不一致。这类注释漂移是"后人据错注释改代码"的常见诱因。

**处置**：8 处注释全部从"12mm"改准为"14mm"，并补"2026-10-05 按 GB 40070-2021 由 12mm 上调"标注（与函数定义处的说明同口径）。**纯注释、零行为变化**——函数返回值本就是 14mm，注释只是如实描述。

**涉及的 8 处**：
| # | 行 | 上下文 |
|---|---|---|
| 1 | 422 | `buildTianZiGeMarker` 调用·行内格（inline） |
| 2 | 663–664 | ruby 内嵌田字格格宽说明 |
| 3 | 906 | `buildTianZiGeMarker` 导出·块级标记 |
| 4 | 916 | `buildTianZiGePinyinMarker` 导出·注音标记 |
| 5 | 979 | `tableCellLineSpacing` 头注·格行行高估算 |
| 6 | 981 | 同上·含田字格行行盒说明 |
| 7 | 989 | 同上·格行计算公式行尾注 |
| 8 | 1018–1019 | 普通段落含田字格·行盒说明 |

---

## 三、候选 0 条

本次未发现口径待定、需属主裁定的问题。

---

## 四、观察 2 条（登记不改）

**O1 · `theme.stage` 字段目前仅作元数据、不参与渲染决策**：`themes` 数组中每个预设主题都有 `stage` 字段（primary/middle/high），但 `wrapContentForTheme`（第 2627 行）明确写"主题与学段解耦，不读 theme.stage"——学段由调用方（排版模块/生成模块）传入。
- **状态**：`stage` 字段仍在（UI 展示分组用），但渲染侧已解耦。
- **不改的理由**：字段有实际用途（主题分组展示、`themeOptions` 的 `group` 标签也用学段），且解耦是项目明确方向。留痕备查，若以后彻底移除分组可再议。

**O2 · `applyThemeToContent` 内有两套"特殊标记样式"（无主题分支＋有主题分支）结构近似**：第 1454–1476 行（`theme===null` 无样式分支）与第 1533–1698 行（有主题分支）都包含田字格/米字格/作文格/方格纸/竖式格等 CSS 规则。
- **状态**：两套的**尺寸变量相同**（都从 `layoutSpec` 读表），且都注入 `CARRIER_CSS`/`MATCH_WORD_BANK_CSS`/`LIST_NUMBER_CSS` 三个单一事实源。差异仅在：无样式分支少了主题色、字体、表格样式等主题专属规则。
- **不改的理由**：两套各自独立、各自完整，合并反而增加复杂度（需要条件拼接）；且三端统一靠的是"都读同一张规格表"，不是"同一段 CSS 代码"。留痕备查。

---

## 五、逐条台账（源 × 条）

| 源 | 组 | 应过 | 已过 | 不合格 | 真修 |
|---|---|---|---|---|---|
| `themes` 数组 · **20 个预设主题**（我的样式 3 ＋ 小学 3 ＋ 初中 3 ＋ 高中 3 ＋ 特殊 4 ＋ 自定义若干） | 20 | 20 | **20** | **0** | 0 |
| 自定义主题存储（`STORAGE_KEY`／`loadCustomThemes`／`saveCustomThemes`） | 3 | 3 | **3** | **0** | 0 |
| 自定义主题 CRUD（`addCustomTheme`／`updateCustomTheme`／`deleteCustomTheme`） | 3 | 3 | **3** | **0** | 0 |
| 查询与选项（`getAllThemes`／`getThemeById`／`defaultThemeId`／`themeOptions`） | 4 | 4 | **4** | **0** | 0 |
| 标题检测规则 `headingDetectionRules` | 1 | 1 | **1** | **0** | 0 |
| 转换与智能标题（`markdownToHtml`／`convertHtmlToHeadings`／`applyIntelligentHeadings`） | 3 | 3 | **3** | **0** | 0 |
| 主题标题样式查询 `getThemeHeadingStyle` | 1 | 1 | **1** | **0** | 0 |
| `applyThemeToContent` 核心渲染（无样式分支＋有样式分支＋打印CSS＋HTML模式＋!important处理＋公式渲染） | 6 | 6 | **6** | **0** | 1（田字格尺寸） |
| 密封线结构处理 8 函数（classify/tokenize/split/splitCont/buildSealZone/convertLegacy/wrapTemplate/normalize） | 8 | 8 | **8** | **0** | 0 |
| 卷面固定件 4 函数（parseScore/parseSections/buildShell/injectShell） | 4 | 4 | **4** | **0** | 0 |
| `wrapContentForTheme` 主题包装（密封线/错题本/教案/笔记 4 分支） | 4 | 4 | **4** | **0** | 0 |
| `stripSealStructure` 剥离密封线 | 1 | 1 | **1** | **0** | 0 |
| `getSpecialThemeEditorCSS` 编辑器 CSS（sealed/errorbook/teaching/note 4 分支） | 4 | 4 | **4** | **0** | 0 |
| `wrapTeachingSections` 教案分段 | 1 | 1 | **1** | **0** | 0 |
| default export（17 个导出项） | 1 | 1 | **1** | **0** | 0 |
| 同件 · **`docxBuilder.js` 调用侧注释同步**（8 处过期注释） | （附属） | — | — | — | 1（注释） |
| **合计** | — | **58** | **58** | **0** | **2（主题侧 1 ＋ 导出侧 1）** |

**逐条核对要点（节选）**：
- **三端统一**：田字格/米字格/作文格/方格纸/竖式格等尺寸，预览（themeConfig）、HTML 导出（themeConfig）、docx 导出（docxBuilder）**都从 `layoutSpec` 的同一张规格表取值**——本次改准的就是"注释与兜底值"的口径漂移，代码本身早已三端统一。
- **主题与学段解耦**：`wrapContentForTheme` 的 `stage` 参数由调用方传入，不读 `theme.stage`；学段相关的尺寸（田字格/作文格/四线三格行高）都走 `layoutSpec` 的规格表，与主题解耦。
- **密封线幂等性**：`normalizeSealStructure` 三层归一化（旧 flex 结构 → 模板结构 → sealed-wrapper 壳），每层都有幂等保护；`convertLegacySealToTemplate`／`wrapTemplateSealPaper` 均在入口处判断"已是模板结构则跳过"。
- **卷面固定件注入**：锚点取"第一个正文结构行"（大类行优先、无大类行取大题行），且去重边界保守（只清第一个大题行之前的残留），2026-09-30 已修复"小学段大类行被漏认"的问题。
- **单一事实源**：作答载体 CSS（`CARRIER_CSS`）、有序列表编号（`LIST_NUMBER_CSS`）、公式渲染（`renderMathInHtml`）、密封线文本规整（`stripSealSuffix`/`normalizeSealBlanks`）、大类行居中（`markExamBigCategory`）——**都从外部单一事实源导入**，不在本文件维护副本。

---

## 六、记优 6 条

| # | 记优内容 |
|---|---|
| 1 | **单一事实源体系落实到位**：作答载体 CSS（填空横线/括号空位/整行横线/四线三格）、有序列表编号形式、公式渲染、密封线文本规整、大类行居中——**全部从外部模块导入**，本文件不维护副本。田字格/米字格/作文格/方格纸等尺寸**统一读 `layoutSpec` 规格表**，不是硬编码。 |
| 2 | **密封线归一化三层幂等设计**：`normalizeSealStructure` 依次走"旧 flex → 模板结构 → sealed-wrapper 壳"三层，每层都有"已是目标结构则跳过"的守卫，旧内容重新打开不会被重复包装。 |
| 3 | **卷面固定件锚点双设计**：`insertPoint`（插入点＝第一个正文结构行，大类行优先）与 `anchor`（去重边界＝第一个大题行）各司其职——既保证固定件位置正确（在大类行之上），又保守去重（不清理大题之后的正文）。 |
| 4 | **主题与学段解耦**：主题只管样式（颜色/字体/字号/行距），学段只管规格（格子尺寸/行高系数）；`wrapContentForTheme` 明确写"不读 theme.stage"，学段由调用方传入。方向正确。 |
| 5 | **forceImportant 的精细处理**：只对非 color 属性加 `!important`（覆盖 AI 生成内容的内联样式），**color 除外**（AI 标注的颜色如红色重点、蓝色标题必须优先于主题色）——既解决了样式覆盖问题，又不破坏内容语义。 |
| 6 | **HTML 模式原生标签映射**：`isHtmlContent` 分支把主题的 `.main-title`/`.heading1`/`.normal-paragraph` 等 class 规则映射到 `h1/h2/h3/p` 原生标签，确保 Word/AI 生成的纯 HTML 内容也能享受主题样式；且表格单元格段落有专门的"取消缩进/段距/大行距"规则，防止 p 规则把表格撑高。 |

---

## 七、同批同步件与验证

- **批 C-6 前序件**：`layoutSpec`（31/31 过）、`expertKnowledge`（24/24 过）、`validatorRules`（44/44 过）——四件组成 C-6 完整批（契约规格风格 ＋ 规则 ＋ 主题）。
- 三端回证：`layoutSpec.js` GRID_CELL primary 14mm ↔ `themeConfig.js` tzW/tzH 读表 14mm ↔ `docxBuilder.js` tzgCellMm() 返回 14mm ——**三端一致**。
- 全量测试＋build 见 §七验证命令。

---

## 八、批 C-6 进度

| 件 | 内容 | 条数 | 不合格 | 状态 |
|---|---|---|---|---|
| C-6 第 1 件 | `layoutSpec`（排版规格池 ＋ 配置入口取值） | 31 | 0 | ✅ |
| C-6 第 2 件 | `expertKnowledge`（风格库） | 24 | 0 | ✅ |
| C-6 第 3 件 | `validatorRules`（规则库） | 44 | 0 | ✅ |
| **C-6 收官片** | **`themeConfig`（主题系统·三端统一）** | **58** | **0** | ✅ |

**批 C-6 合计**：31 ＋ 24 ＋ 44 ＋ 58 ＝ **157 条**，不合格 **0**，真修 **8**（layoutSpec 3 ＋ expertKnowledge 0 ＋ validatorRules 2 ＋ themeConfig 3）。
