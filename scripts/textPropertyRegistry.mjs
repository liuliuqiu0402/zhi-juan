/**
 * 《指令文本性质清单》登记表（**单一事实源**）
 * ============================================================
 * 用途：把"指令文本该有哪些性质、各自的判据原文、由谁锁、覆盖多少面"变成**可复跑的数据**，
 *   供 ① `scripts/reportTextProperties.mjs` 生成清单 ② `tests/config/textPropertiesRegistry.test.js` 在 CI 里核。
 * 为什么需要（属主 2026-10-13 质询）："486 个三维度每个都过了，你咋会说有没枚举过的维度"——
 *   486 面是**格子**，本清单管的是**格子里的文本性质**（两把尺）。清单把"扫过的性质"显式化 ⇒ 未扫的才是可见的缺口。
 * 字段：
 *   id      性质编号（A/B/C…）
 *   name    性质名（人读）
 *   probe   判据**原文片段**（逐字；用于在 486 面装配文本里计数）
 *   scope   'all' | 'exam' | 类型数组（该性质的适用面）
 *   expect  'must'（应恒在场，命中面数应=scope 面数）| 'zero'（应零命中）| 'some'（≥1 面）
 *   guard   锁它的守卫/测试文件名（'—' ＝尚无机检，仅登记）
 *   note    备注
 */
export const PROPERTIES = [
  // ── A 范围与取材 ──
  { id: 'A1', name: '范围指代＝「本次范围」', probe: '本次范围', scope: 'all', expect: 'must', guard: 'config/scopeReferenceGuard.test.js', note: '禁"本单元/本课"（同守卫反向锁）' },
  { id: 'A2', name: '素材来源不限（留白）', probe: '来源不限、不作指定', scope: 'all', expect: 'must', guard: 'config/antiHomogenizationGuard.test.js', note: '不指定教材/来源' },
  { id: 'A3', name: '覆盖模式分档（抽样/整篇/主题/单课/无）', probe: '按命题蓝图从以上内容中抽样', scope: 'exam', expect: 'must', guard: 'utils/coverageReconciler.test.js', note: 'exam=sampled 口径原句' },
  { id: 'A4', name: '可另取其他知识点或考查角度（expand 授权）', probe: '可依本学段课标学业要求另取其他知识点或考查角度', scope: ['exam', 'practice', 'special', 'reading', 'errorbook'], expect: 'must', guard: 'config/configDimensionAxes.test.js', note: '属主〔398〕① 定：考迁移运用授权' },
  { id: 'A5', name: '已学内容许可（integrate 档）', probe: '也可联系**已学**内容', scope: ['summary', 'review'], expect: 'must', guard: 'config/antiHomogenizationGuard.test.js', note: '属主 2026-10-13 口径放宽' },
  { id: 'A6', name: '不得指定内容（教材模块/章节/年级）', probe: '力学与电学综合', scope: 'all', expect: 'zero', guard: 'config/instructionTextRedline.test.js', note: '以"力学与电学综合"为哨兵词；全表见红线守卫' },

  // ── B 结构组织 ──
  { id: 'B1', name: '段落组织：每题/每项/每条目独立成 <p>，严禁堆叠', probe: '独立成 <p> 段落', scope: 'all', expect: 'must', guard: 'config/textPropertiesRegistry.test.js', note: '★ 2026-10-13 由本清单扫出真缺口并补齐：内容型（preview/summary）原无此判据' },
  { id: 'B2', name: '并列小项按行分组（不挤成一段）', probe: '按行分组排布', scope: ['exam', 'practice', 'special', 'reading', 'dictation', 'review'], expect: 'must', guard: 'config/textPropertiesRegistry.test.js', note: 'errorbook 走"逐题成组·每个分项独立成段"口径（不含本句）' },
  { id: 'B3', name: '层级样式/序号体系（层级与编号）', probe: '序号体系', scope: 'all', expect: 'must', guard: 'config/questionObjectCaliber.test.js', note: '层级样式单源' },
  { id: 'B4', name: '层级名↔其下内容可判法（真分层·T20①）', probe: '遮住该名称、只看其下各题', scope: 'exam', expect: 'must', guard: 'config/languageSubjectMaterial.test.js', note: 'T20·① 正句（假分层补可判法）' },
  { id: 'B5', name: '同层同型多题＝正规；跨层同型同法＝判重（T20②）', probe: '同一大题、同一层内', scope: 'all', expect: 'must', guard: 'config/languageSubjectMaterial.test.js', note: '对应属主"可以有侧重，但同型题不得跨处重复"口径' },
  { id: 'B6', name: '不留空转条目（只作过渡或复述标题的删掉）', probe: '复述标题的删掉', scope: 'all', expect: 'must', guard: 'config/intraRequestDuplicate.test.js', note: '治"过渡词机械/复述题干"' },

  // ── C 载体与作答 ──
  { id: 'C1', name: '载体形态协议（作答位/留白/书写格）', probe: '作答位', scope: 'all', expect: 'must', guard: 'recipe/carrierProtocolCoverage.test.js', note: '19 载体契约配套' },
  { id: 'C2', name: '空间载体如实（不以文字充当空间）', probe: '只以真实留白或书写载体呈现', scope: 'all', expect: 'must', guard: 'utils/whitespaceCarrier.test.js', note: '排版质量底线（原登记串取自内容型措辞，已改准为全类型串）' },
  { id: 'C3', name: '答案区位置与正文逐题对齐', probe: '【答案区位置】', scope: 'all', expect: 'must', guard: 'recipe/answerRegionMatrix.test.js', note: '答案区与正文对齐' },
  { id: 'C4', name: '渲染指令按能力条件注入（不写样式）', probe: '【渲染指令】', scope: 'all', expect: 'must', guard: 'recipe/eduRenderContract.test.js', note: '样式由渲染侧负责' },

  // ── D 内容质量 ──
  { id: 'D1', name: '内容唯一性母判据（两处可互相替代才算重复）', probe: '两处可互相替代才算重复', scope: 'all', expect: 'must', guard: 'config/intraRequestDuplicate.test.js', note: '唯一性唯一起点' },
  { id: 'D2', name: '情境按考查意图选配（可从简或不用）', probe: '情境从简或不用', scope: 'all', expect: 'must', guard: 'config/faceScenarioMatrix.test.js', note: '治"塑料感"下限：给情境就须完整可判' },
  { id: 'D3', name: '事实可信（不虚构具体值）', probe: '仅在确有把握时写出具体值', scope: 'all', expect: 'must', guard: 'config/qualityReadiness.test.js', note: '学科事实底线' },
  { id: 'D4', name: '解析讲明"错因—如何避免—正确思路"', probe: '错因—如何避免', scope: ['special'], expect: 'must', guard: 'config/qualityReadiness.test.js', note: '治"正确但无用/不痛不痒"（errorbook 侧由 D5/D6 承载）' },
  { id: 'D5', name: '错因剖析不写空泛套话', probe: '不写空泛套话', scope: ['errorbook'], expect: 'must', guard: 'config/qualityReadiness.test.js', note: '治①总分套话＋④空洞评价词' },
  { id: 'D6', name: '每题须对应一个典型错因（错因绑定）', probe: '每题须对应一个典型错因', scope: ['errorbook'], expect: 'must', guard: 'config/qualityReadiness.test.js', note: '治②解析不点错因' },
  { id: 'D7', name: '干扰项＝各对应一种学生可能的思路', probe: '各选项须各自对应一种学生可能的思路', scope: 'exam', expect: 'must', guard: 'config/questionFormatRules.test.js', note: '治⑧选项过于对称' },
  { id: 'D8', name: '变式不复刻本题思路', probe: '不复刻本题思路', scope: ['errorbook'], expect: 'must', guard: 'config/qualityReadiness.test.js', note: '与"允许另解"同族' },
  { id: 'D9', name: '设问由易到难', probe: '设问由易到难', scope: 'exam', expect: 'must', guard: '—', note: '层次递进的既有判据（T20 同族）·**尚无独立守卫·缺口登记**' },
  { id: 'D10', name: '跨学科背景不作拼盘（须服务解题）', probe: '跨学科背景不作拼盘', scope: 'all', expect: 'must', guard: 'config/crossSubjectIntegrationGuard.test.js', note: '2026-10-14 属主解锁 §八 净字方案：同块收口"以能力/素养点为纲"重复（−10）／换入本句（+10）＝净 0，过 promptGrowthGuard' },

  // ── E 篇幅与题量 ──
  { id: 'E1', name: '篇幅/容量以本范围内容量为准（T20③）', probe: '以本范围的内容量为准', scope: 'all', expect: 'must', guard: 'config/promptGrowthGuard.test.js', note: '不设字数上限' },
  { id: 'E2', name: '例题量＝「适量」（语义词·禁定量）', probe: '适量', scope: ['special', 'summary', 'review'], expect: 'must', guard: 'config/questionVolume.test.js', note: '属主 2026-10-13 裁定：不得改定量' },

  // ── F 防同质化（留白面数精确等值） ──
  { id: 'F1', name: '资料内多样（尾约束）', probe: '【尾约束·资料内多样】', scope: 'all', expect: 'must', guard: 'config/antiHomogenizationGuard.test.js', note: '面数精确等值锁' },
  { id: 'F2', name: '组名/栏名自定（不作指定）', probe: '自行定', scope: ['summary', 'review', 'preview', 'dictation', 'reading'], expect: 'some', guard: 'config/antiHomogenizationGuard.test.js', note: '留白：不喂固定组名' },

  // ── G 配置轴（卷别/风格/通道/库启停） ──
  { id: 'G1', name: '组织风格块（生成期追加）', probe: '【组织风格】', scope: ['practice', 'special', 'reading', 'summary', 'review', 'preview'], expect: 'must', guard: 'config/configDimensionAxes.test.js', note: '7 型有默认；exam/dictation/errorbook 不注入' },
  { id: 'G2', name: '升学卷别仅正式卷生效', probe: '学业质量水平', scope: ['exam'], expect: 'some', guard: 'config/configDimensionAxes.test.js', note: '高中才注入水平块' },
  { id: 'G3', name: '素材通道分档（full/anchor）', probe: '【素材使用约定】', scope: 'all', expect: 'must', guard: 'config/configDimensionAxes.test.js', note: '通道轴' },

  // ── H 应零命中（回归锁：AI 味词/诱导词/旧措辞） ──
  { id: 'H1', name: 'AI 味套话·本题考查了', probe: '本题考查了', scope: 'all', expect: 'zero', guard: 'config/nonInducingPrompt.test.js', note: '回归锁' },
  { id: 'H2', name: 'AI 味过渡词·综上所述', probe: '综上所述', scope: 'all', expect: 'zero', guard: 'config/nonInducingPrompt.test.js', note: '回归锁' },
  { id: 'H3', name: '空洞评价词·非常重要', probe: '非常重要', scope: 'all', expect: 'zero', guard: 'config/aiTasteGuard.test.js', note: '2026-10-14 闭合：产物侧机检（`empty-praise-guard`·词表单源 EMPTY_PRAISE_WORDS）+ 模板零诱导' },
  { id: 'H4', name: '旧范围指代·本单元', probe: '本单元', scope: 'all', expect: 'zero', guard: 'config/scopeReferenceGuard.test.js', note: '回归锁' },
  { id: 'H5', name: '已退役的分层诱导词·由浅入深', probe: '由浅入深', scope: 'all', expect: 'zero', guard: 'config/bpWordingGuard.test.js', note: '回归锁（诱导链不作判据）' },
];
