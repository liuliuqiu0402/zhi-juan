# 配方（Recipe）Schema 说明

> ⚠️ **已废弃（2026-08-29）**：Recipe 配方体系已随"生成端收敛方案"整体删除，代码实现 `src/config/recipe/schema.js` 已不存在。
> **现行为**：指令库（`promptLibrary.js` 三维度注入）× 蓝图库（`examPaperBlueprints.js`/`teachingBlueprints.js`）× 整卷一次生成（`generateFullPaperNatural`）。
> 本文档仅作历史决策背景参考，以最新代码为准。

> 版本：v1（2026-08-23 定稿）
> 代码实现：`src/config/recipe/schema.js`（已删除）
> 配套文档：[生成链路与配方设计.md](./生成链路与配方设计.md)、[指令体系与生成架构规划.md](./指令体系与生成架构规划.md)

## 一、定位与原则

配方（Recipe）= 一类资料（**genType × subject × stage** 三维度精准匹配）的**完整生成规范（数据，非文本）**。

- 规范块（role/redline/quality/format/top/tail 六类原子块）是"内容"，配方是"蓝图"。
- 改措辞 → 改规范块；改结构 → 改配方。二者解耦，杜绝双源漂移。
- 运行时只填实例参数，不改配方。
- 整卷 / 分步 / 答案三条路径共用同一配方，差异仅在执行器。

两条硬约束（设计定案）：

1. **规划数据通道隔离**：考点→板块、题量、分值、认知层级只走"AI 指令"与"界面预览"两通道，不进入卷面 HTML；卷面净化为代码级硬规则。
2. **确定性分层**：结构（板块/标题/编号/分值/考点分配/答案锚定）由代码保证 100% 一致；内容（题干/选项/解析）由 AI 生成，每次不同是特性（temperature 0.7）。

## 二、顶层结构

```
Recipe
 ├─ meta             元信息（id/name/genType/stages/subjects/version）
 ├─ role             角色与稳定规范（System 层）
 ├─ blueprint        exam 专用：真题卷蓝本（数据，AI 不决策）
 ├─ sections[]       板块定义（核心）
 ├─ constraints      全局约束（引用规范块 id）
 ├─ materialStrategy 素材策略（检索/样例/情境）
 ├─ qualityGate      质检门（硬规则 key 表，代码执行）
 └─ output           输出规范（含 byCode 代码保证声明）
```

## 三、字段详解

### 3.1 meta —— 元信息

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 唯一标识，如 `recipe_exam_primary_low` |
| `name` | string | ✅ | 人类可读名，如 `正式考卷·小学低段` |
| `genType` | string | ✅ | 资料类型：exam/practice/special/preview/reading/dictation/errorbook/summary/review |
| `stages` | string[] | | 适用学段：primary_low/primary_mid/primary_high/middle/high；空=全部 |
| `subjects` | string[] | | 适用学科：语文/数学/英语/物理/…；空=通用 |
| `version` | number | ✅ | 配方版本，变更时递增（缓存失效） |

### 3.2 role —— 角色与稳定规范（System 层）

| 字段 | 类型 | 说明 |
|---|---|---|
| `persona` | string | 角色称谓：命题专家 / 教辅编辑·课时练 / 专项训练设计者 / … |
| `personaDesc` | string | 角色描述（喂给模型的 System 语境） |
| `systemBlocks` | string[] | 引用的规范块 id：`role_exam`、`redline_exam`、`format_exam`、`topconst_exam`、`tailconst_exam` 等 |

注入 System prompt，全资料/全板块共享，成为模型"永久记忆"。

### 3.3 blueprint —— 真题卷蓝本（仅 exam）

| 字段 | 类型 | 说明 |
|---|---|---|
| `fullScore` | number | 满分（100/120/150…） |
| `duration` | string | 考试时长（'60分钟'） |
| `sealLine` | boolean | 是否含密封线（正式考卷=true） |
| `header` | string | 卷首拼装函数名（`assemblePaperHeader`，代码侧） |
| `sections[]` | Array | 板块序列：`{ name: 规范题型名, score: 大题分值, note: 命题要求 }` |

数据来源：现有 `EXAM_BLUEPRINTS`（蓝本库内容保留，作为配方数据源）。

### 3.4 sections[] —— 板块定义（核心）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 板块 id，如 `sec_accumulate` |
| `name` | string | 板块名，如 `积累与运用` |
| `note` | string | 板块说明（喂给 AI 的语境：覆盖考点/设问要求/结构） |
| `questionCount` | object | 题量规则：`{ min, max, rule }` |
| `score` | object | 分值规则：`{ fixed, rule }`（如 `{ fixed: 30, rule: '小题之和=30，整数' }`） |
| `kpPolicy` | object | 考点策略：`{ mode: 'weight'|'anchor'|'manual', by: 'knowledgeGraph', maxRepeat }` |
| `structure` | string | 板块内部结构（由易到难的组织说明） |
| `materials` | object | 素材策略：`{ retrieval:{focus,maxChars}, samples:{library,count}, context:{require} }` |
| `format` | object | 板块输出格式：`{ title: 标题模板, tags: 'question/option/blank' }` |

### 3.5 constraints —— 全局约束

```
constraints: {
  redlines: ['redline_exam'],        // 红线规范块 id
  quality:  ['quality_exam_formal'], // 品质标准块 id
  format:   ['format_exam'],         // 格式规范块 id
}
```

引用规范块 id，注入 System。

### 3.6 materialStrategy —— 素材策略

| 字段 | 类型 | 说明 |
|---|---|---|
| `retrievalEngine` | string | 教材原文检索器（`retrieveBlueprintSegments`） |
| `semanticSearch` | string | 语义检索器（`semanticRetriever`） |
| `maxTotalChars` | number | 全卷素材总量上限（6000） |
| `priority` | string | 素材优先级（'命题素材 > 原文 > 例题情境'） |

### 3.7 qualityGate —— 质检门（代码执行，非 prompt 承诺）

```
qualityGate: {
  hardRules: ['score_sum','blank_tags','question_wrap','option_count',
              'kp_no_duplicate','header_match','answer_section',
              'seal_structure','no_page_text','no_internal_mark',
              'no_duplicate_question','score_annotated'],
  thresholds: { minChars: 300, minSections: 1 },
  repair: { maxRounds: 1, scope: 'section' },   // 只修复问题板块
}
```

硬规则注册表（schema.js `HARD_RULE_KEYS`）：

| key | 含义 | 修复策略 |
|---|---|---|
| `score_sum` | 分值加总 === 满分/板块总分 | 局部重生成 |
| `blank_tags` | 填空标签规范（u/span 互斥、非空） | 自动修复 |
| `question_wrap` | 题目必须 `p.question` 包裹 | 自动修复 |
| `option_count` | 选项数量合规（低段2-3、中高段4） | 局部重生成 |
| `kp_no_duplicate` | 跨板块考点去重 | 局部重生成 |
| `header_match` | 标题 === 配方/蓝本（拼装器产出，应恒真） | 自动修复 |
| `answer_section` | 答案区完整 | 局部重生成 |
| `seal_structure` | 密封线结构合规（exam） | 自动修复 |
| `no_page_text` | 正文无页码文字 | 自动修复 |
| `no_internal_mark` | 卷面净化：无考点名/认知层级/单元标注 | 自动修复 |
| `no_duplicate_question` | 无雷同题 | 局部重生成 |
| `score_annotated` | 小题均标（X分） | 局部重生成 |

### 3.8 output —— 输出规范

| 字段 | 类型 | 说明 |
|---|---|---|
| `htmlTemplate` | string | 代码侧 HTML 骨架（'exam'/'teaching'） |
| `answerSection` | boolean | 是否答案区 |
| `answerRole` | string | 答案页角色（'阅卷专家'） |
| `byCode` | object | **代码保证声明**：heading/numbering/scoreLabel/answerAnchor/sealLine/header/pageNumber 均 true |
| `export` | string[] | 导出格式 ['docx','pdf','html'] |

`byCode` 声明项在 AI 契约中显式排除——AI 只写题干/选项/空标签，其余由拼装器代码生成。

## 四、规范块六类（BLOCK_CATEGORIES）

| 类 | 前缀 | 内容 | 注入位置 |
|---|---|---|---|
| role | `role_*` | 角色身份（命题专家/教辅编辑/阅卷专家） | System |
| redline | `redline_*`/`quality_redlines_*` | 红线清单（最高优先级） | System 前置 |
| quality | `quality_*` | 品质标准/命题技法/反套路 | System |
| format | `format_*` | 输出格式/标签规范 | System |
| top | `topconst_*` | 顶层约束（生成要求） | System 近因区 |
| tail | `tailconst_*` | 尾约束（recency 锚点） | System 近因区 |

## 五、校验与生命周期

```js
import { validateRecipe, validateRecipeBlocks, createExamRecipe } from '../config/recipe/schema.js';

const recipe = createExamRecipe({ meta: { id: 'recipe_exam_primary_low', name: '正式考卷·小学低段' } });
const { ok, errors } = validateRecipe(recipe);        // 结构校验
const refCheck = validateRecipeBlocks(recipe, blockIndex); // 规范块引用校验
```

- 开发期：单元测试覆盖 `validateRecipe` 全字段。
- 构建期：配方注册表加载时统一校验，失败即报错（防带病上线）。
- 运行期：只读配方，不改动。

## 六、文件组织

```
src/config/recipe/
 ├─ schema.js         配方数据结构 + 校验 + 默认模板（本文件）
 ├─ blocks/           规范块（六类原子块，收敛自旧指令库）
 │   ├─ role.js
 │   ├─ redline.js
 │   ├─ quality.js
 │   ├─ format.js
 │   ├─ top.js
 │   └─ tail.js
 ├─ recipeRegistry.js 配方注册表（内置配方 + 加载校验 + 索引）
 ├─ planner.js        独立规划器（考点分配/去重/难度/题量）
 ├─ deriver.js        派生器（配方 → 板块短指令）
 ├─ assembler.js      统一拼装器（卷首+标题+编号+答案锚定+卷面净化）
 ├─ executor.js       统一执行器（分步流水线 + 质检门 + 局部重生成）
 └─ qualityGate.js    质检门（硬规则实现）
```

## 七、后续版本演进

- v2：支持配方继承（基础配方 + 地区/风格覆盖）。
- v2：支持运行时配方编辑（UI 表单 → 配方 JSON）。
- v3：支持配方模板变量（{academicTitle}/{diffRatio} 等运行时替换）。
