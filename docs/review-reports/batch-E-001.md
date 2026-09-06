# 批次 E-001：渲染契约与版面质检规则语义复核（eduRenderContract / validatorRules）

- 复核对象：`eduRenderContract.js`（buildRenderContract 组装、getGraphParts/getFormulaNeeded 学段门控、[IMAGE]/[GRAPH] 协议、FORMULA_RULES）+ `validatorRules.js`（VALIDATOR_RULES 13 条：promptHint 生成前约束 + description 生成后修正/静默防护）
- 复核侧重：职责边界（D：不外包压制模型、不要求模型发明渲染）、协议自洽、跨学科收敛（B/G：不广播）、与指令库单源一致（A）
- 日期：2026-09-06；执行：AI 逐条

## 汇总

| 判定 | 数量 | 说明 |
|---|---|---|
| 红 | 0 | 未发现需改源问题 |
| 黄 | 0 | — |
| 绿 | 全 | 职责边界、学段门控、学科收敛均达标 |
| 备注（C 级/注释层） | 2 | 见下 |

## 复核确认要点

- **职责边界正确（D）**：渲染契约是"模型↔渲染端"的标记协议（模型只负责让 [GRAPH]/[IMAGE] 的数据与题干完全一致、内容自洽），不要求模型执行渲染、也不把内容外包给程序；FORMULA_RULES 只约束书写形式。质检规则 fix 类"只报不改或程序确定性修正"，guard 类仅静默计数——均不压制模型能力、不诱导。
- **学段门控严谨**：数学小学全学段不注入 LaTeX（示例为二次函数属初中内容，注入即诱导超纲）；小学低/中段裁剪 SHAPES/PIE（扇形统计图为六年级课标内容）、高段保留 PIE 并替换小学版 SHAPES 示例；物理/化学图形与公式仅初中及以上；无图/公式/配图需求时不产出空段（rc='' 合法，assemblyMatrix 已不做 rc 非空强断）。
- **学科收敛（B/G）精确到位**：13 条质检规则中语英/数理化专属条款按 subjects 精确注入（拼音归一仅语文低中段防破坏英语 IPA、加点字仅语文、画线仅语文英语、上下标仅数理化、音标仅英语、表达类书写格仅语英）；历史事故（A1 跨学科广播、语英"写话/作文"词汇广播到数学/体育、答案区"写作评分标准"误报）均已在 description 注明修复路径并由 subjects/stages/genTypes 门控锁死。
- **单源一致（A）**：答案区标题/书写载体/作答空间条款均由输出约定或排版规格库单源注入，本库规则不再提供重复 promptHint（answer-section-exam/teaching、writing-grid-fix 等注明"不重复展开/单源注入"）。
- 无外包句、无旧壳句、无样板重复；13 条 promptHint 措辞中性可执行。

## 备注（C 级，不改源）

1. eduRenderContract getGraphParts 顶部 docblock"数学高段"实指"小学高段（5-6）"，与高中档同词易混——注释层建议改"小学高段"（低优先）。
2. validatorRules description 字段较长（内含历次事故与决策记录），属维护文档性质，不影响注入（prompt 只取 promptHint），可接受。

## 通过结论

批次 E：渲染契约与质检规则职责边界正确、学段×学科×类型门控严谨、无跨学科广播、与指令库/规格库单源一致。全量 78 文件 1368 测试通过（本批未改源）。
至此《指令语义复核流程与标准》五批次（A 课标要点 / B 主指令通用条款 / C 教学蓝图 / D 卷面蓝图 / E 渲染契约与质检规则）全部完成。
