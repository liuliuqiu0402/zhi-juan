/**
 * 整卷质检规则库（Exam Validator Rules）
 * ============================================================
 * 定位：与「指令库」（promptLibrary）、「蓝图库」（examPaperBlueprints）对齐的
 *    三维度（学段 × 学科 × 资料类型）可维护规则库，单一事实来源，双阶段生效：
 *
 *   【阶段一 · 随指令注入】buildValidatorPrompt()：把启用的 fix 类规则转成
 *       生成前约束文案注入指令（GenerateModule 与 buildRenderContract 并列追加），
 *       让 AI 生成时就不出错（防患未然）。
 *   【阶段二 · 生成后静默】auditExamPaper(html, {subject, stage, genType})：
 *       fix 类自动修复卷面（用户无感，修复记录进 issues = console 日志）；
 *       guard 类静默抽检计数——明细在 silentDetails，level='notice' 者进生成报告
 *       【问题列表】提示用户手改，level='debug' 者仅 console 诊断（不打扰）。
 *
 * 规则类别：
 *   - fix   自动修复：生成前注入约束 + 生成后自动修正（issues = 修复记录，不进问题列表）
 *   - guard 静默防护：生成后计数抽检，需人判断的按 notice 级进问题列表，其余 debug 级仅诊断
 *
 * 字段说明：
 *   id          规则唯一标识（校验器按 id 开关对应逻辑）
 *   name        规则名
 *   category    'fix' 自动修复 / 'guard' 静默防护
 *   subjects    适用学科数组，'*' = 全学科
 *   stages      适用学段键数组（primary_low/primary_mid/primary_high/middle/high），'*' = 全学段
 *   genTypes    适用资料类型数组，空/缺省 = 全部类型
 *   promptHint  生成前约束文案（fix 类可选，缺省须在 description 声明单源理由；guard 类一律不填）
 *   description 规则说明
 *   enabled     是否启用
 * ============================================================
 */

/** 归一学段：'小学'/'primary' → primary_low~high（按年级细分）。统一委托共享工具 gradeStage.resolveStageKey，
 * 曾因 parseint('六年级') 得 NaN→0 误判为 primary_low；无年级信息时小学按高段（primary_high）宽松处理，不再回落低段。 */
import { resolveStageKey } from '../utils/gradeStage.js';

export const normalizeStage = (stage = '', grade = 0) => resolveStageKey(stage, grade);

export const VALIDATOR_RULES = [
  // ==================== fix：自动修复（生成前约束 + 生成后修正） ====================
  {
    id: 'pinyin-norm',
    name: '拼音字符归一',
    category: 'fix',
    // 🔧 仅语文（拼音场景）：英语音标是 IPA 正常内容（/əˈbʌv/ 含 ə/ɑ/ː 等），归一会破坏音标输出，
    //    与 text-format-phonetics「音标用斜杠包裹」冲突——英语卷不再注入/执行本规则
    subjects: ['语文'],
    stages: ['primary_low', 'primary_mid'],
    promptHint: '拼音字母与声调符号按标准注音写法输出（保留声调）；字符归一半角（ɡ→g、全角字母→半角），严禁混入 IPA 音标字符（ɡ/ŋ/ɑ/ə）。',
    description: '将混入小学拼音的 IPA 音标字符与全角字母归一为标准拼音，防字体显示不一致。',
    enabled: true,
  },
  {
    id: 'template-cleanup',
    name: '模板残留清理',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    // 2026-10-02（⑤诱导·去否定式点名）：原句点名具体错串「"【插图占位】"／「\</div\>」／「"3．。"」——
    //   要读懂须先激活这些串＝**反向植入**（模型反而写出来）；且它们本属旧版模板残留、非模型自发的失效模式。
    //   改**原则式**，判据（占位文本／被转义的标签／只有编号无内容的空条款）一字未丢；程序侧 template-cleanup
    //   有独立执行分支（VALIDATOR_GATES）确定性清理，接得住。
    promptHint: '禁止输出占位文本、被转义的标签、空条款（只有编号无内容）。',
    description: '清理非标准插图占位符、被转义的闭合标签、空条款，保证卷面无模板残留。',
    enabled: true,
  },
  {
    id: 'score-label-fix',
    name: '分值标注对齐',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['exam'],
    // 2026-10-02（③啰嗦·收口）：删"（不虚报、不缩水）"——"必须等于…实际输出"已说全，四字为同义补句。
    promptHint: '分值标注与账目：分值标注用中文全角括号，与卷面其余括注同形；账目口径由正文分值条单源承载。',
    description: '大题/小题标题"每空/每组/每题/每词/每字 X 分"标注与实际载体数校验（**只报不改**：程序不重算、不改写分值，账目由模型自洽；声称数≠实际载体数时仅静默计数抽检）：空按 DOM 空位数、配对/匹配题按匹配对数、词按拼音组数（看拼音写词语）、字按田字格格子数。2026-09-17 括号口径统一为**全角**：原句"分值标注一律半角括号…不得用中文全角括号"与同一份提示词里委托正文的两处全角示范三处相抵（实测第②类打架）；程序侧解析（examValidator 2f/2g/2h）半角/全角均兼容，故按卷面括注形态统一为全角。2026-09-30（用户裁定·判词单源）：账目算式判词（小题数×每题分=大题分、空数×每空分=小题分、各大题分之和=满分）**只保留在** src/config/promptLibrary.js 的【卷面格式】分值条——该条恒注入，而本规则**用户可停用**，判据不能放在可停用处（原两处各写一份＝机制 A 无单一事实源，且停用后主指令只剩空判据）；本规则 promptHint 只留标注形态与"声称数=实际数"。（`fixScoreLabel` 为**形态/账目计算函数**，其返回值仅用于"只报不改"的抽检文本，不回写正文——与本节口径一致。）',
    enabled: true,
  },

  {
    id: 'title-detail-fix',
    name: '大题标题明细式修复',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['exam'],
    // 2026-10-04（#1 分值族通读·去相抵）：原首句"小题题号后/题干末尾标注（X分）"是**笼统强制每题都标**，
    //   与 cell【题号与分值】的例外条（同型客观小题**只在大题级标一次、小题后不再逐个标**）直接相抵——
    //   实测致整卷每题后都挂"（X分）"。现删该半句，分值标注**回归正文分值条单源**（本规则不另立形式）。
    promptHint: '分值标注（大题级与小题级）一律由正文分值条单源承载，本规则不另立口径。',
    description: '大题标题旧式"（X分）"自动补全为明细式"共N题，每题X分，共X分"（与真题卷规范对齐）。2026-09-17 删去 promptHint 里的"（按【卷面结构】）"：它与委托正文"大题标题须你自拟、不要照抄结构名"相抵（一条说自拟、一条说按结构），模型据此逐字照抄蓝图大题名——实测十个大题标题与蓝图全同，是上一轮"标题自拟"修复未生效的残留根因。',
    enabled: true,
  },
  {
    id: 'answer-section-exam',
    name: '答案区容器补全（正式卷）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['exam'],
    description: 'exam 正式卷答案区标题约束（答案区 <h2> 标题与输出约定/答案页角色单源注入，本规则不再提供 promptHint 防多源重复）；once 模式答案区 <h2>参考答案… 无 answer-section 包裹时自动补包（docx 独立分节所需）。',
    enabled: true,
  },
  {
    id: 'answer-section-teaching',
    name: '答案区容器补全（教辅）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['practice', 'special', 'preview', 'reading', 'dictation', 'review'],
    description: '教辅类（同步练习/专项突破/预习导学/阅读训练/默写积累/复习资料）答案区标题约束（答案区 <h2> 标题由输出约定/答案页角色单源注入，本规则不再提供 promptHint）；once 模式答案区无包裹时自动补包。知识总结为"题+解析一体"资料（正文自带解析，可能跳过独立答案页），不注入"另起答案区"要求；易错题本自 2026-09-28（用户裁定）起改为"块→逐题成组、答案区只对变式作答"，不再跳过独立答案页。',
    enabled: true,
  },
  {
    id: 'image-block-fix',
    name: '[IMAGE] 配图块标准化',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    // 2026-10-02（③啰嗦·收口）：删"（每图一个、单独成段）"——与渲染契约的配图条逐字同义（该条按能力注入，单源在彼）。
    promptHint: '配图块格式：凡输出配图，一律用 [IMAGE] 块；参数独占一行、半角冒号。',
    description: '把 AI 输出的 [IMAGE] 块规范化为 EduRender 标准格式：参数独占一行、半角冒号、清理 PROMPT 中混入的 HTML 残留、未闭合自动补 [/IMAGE]、不指定生图引擎（清除 TYPE:SD 等引擎参数，ICON 图标检索保留）。',
    enabled: true,
  },
  {
    id: 'duplicate-content-fix',
    name: '正文重复内容检测截断',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '严禁整份资料内出现两份相同内容——板块标题须唯一；题目层面的唯一性以正文【质量底线】“内容唯一性／题类资料中不重复设题”条为准（单源）。',
    description: '检测正文区重复的大题标题（同一标题出现 ≥2 次，多为截断续写时模型从头重出导致）→ 从第二次重复处截断保留第一份；重复的答案区保留第一份。',
    enabled: true,
  },

  {
    id: 'teaching-volume-guard',
    name: '教辅内容充足性静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    description: '教辅类资料（非 exam）生成后静默确认内容充足性：正文长度、题集类题号数——**只判可数项**（2026-10-02 职责归属裁定：原"阅读训练须含选文（短文）"用关键词近似判语义，已删，该项交模型侧创作要求）。缺失/过短仅 debug 计数（题量/篇幅底线由教辅结构蓝本 stages.volume 提供，程序侧校验参考，不注入 prompt 防限定 AI）。',
    enabled: true,
  },

  {
    id: 'text-format-fix',
    name: '排版语义标记规范（删除线/表格）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    // 2026-10-02（⑥拼接·同实发去重）：原 promptHint 首句"强调用 <strong>…</strong>"与**同一份实发**的
    //   【输出格式】强调口径**同义双写**（内容型：'需要突出"重点/关键"时一律用**加粗**（<strong>）'；
    //   题类：'**题面不承载"强调"**，加粗只用于层级标题…'）——该口径按类型分支注入、更精准，且带"何时用"的判据；
    //   本规则只留它自己独有的形态（删除线/表格）。name/description 同步去掉"加粗"。
    promptHint: '排版语义标记规范：删除/划去用 <del>…</del>；表格只用于**确有行列对应**的内容（每一行/每一项与各列有确定的对应），用 <table> 标准结构（不用 Markdown 竖线表）；**同类并列的条目用行内成列、不建表**。',
    description: '全学科通用排版语义标记（删除线/表格；"强调用加粗"由【输出格式】强调口径单源承载，本规则不再复述）。分数/公式为数学理科学标记、权威源在渲染契约 FORMULA_RULES（按学科×学段精确注入：分子/分母半角斜杠仅非公式语境、公式内 \\frac、公式场景 $...$），本全学科规则不再广播"分子/分母/公式"等数学措辞——杜绝向体育/音乐/美术/道法等无分数需求学科注入跨学科噪音；表格仅保留中性标准结构（<table>），不点名"统计/对比/关系"等学科联想词；加点/画线句子为语文/英语专属，拆至独立规则按学科精确注入。',
    enabled: true,
  },
  {
    id: 'text-format-zhupoint',
    name: '加点字标记与自洽（语文专用）',
    category: 'fix',
    subjects: ['语文'],
    stages: ['*'],
    promptHint: '排版语义标记规范（语文加点）\n· **凡题干或例句以“加点/加点的字/加点的词语”标出待用词语或作答对象**（判据只看“是否以加点标示”，措辞如何变化都算；含“照样子，用加点的词语…”这类例句）——被标示处一律用 <span class="emphasis-dot">字</span> 标记\n· **“照样子”类题的“例”里，与题干所说“加点的词语”相对应的那处必须加点标出**（“例”有多处则**逐处**标，缺一即无效）\n· **同一点要求涉及的各处一致标出**（该点一处标了、其余各处也必须标）；**加粗不是加点**（突出“重点”才用加粗），也不得用 <u> 下划线表示加点。自洽硬性：题干/例句要求加点处，正文必须恰好存在对应的 emphasis-dot 标记；有要求而无标记即视为无效题。\n· 本条不受“材料中不得标出待作答内容”条限制——**题面要求加点的待用词语/考查对象一律照常加点**（含位于选项/材料中的），二者对象不同：该禁令只管**答案本身**。',
    description: '语文“加点”题的加点标记与自洽性硬性——判据为**原则式**（题干或例句凡以加点标示待用词语/作答对象即适用，不枚举具体措辞，防“措辞一变判据即失效”）；并**须逐处一致**（同一点要求涉及各处齐标）；按学科精确注入（仅语文，其他学科不注入，杜绝跨学科诱导）；生成后自洽检测由汇总规则 text-format-fix 统一执行。',
    enabled: true,
  },
  {
    id: 'text-format-underline',
    name: '画线句子标记与自洽（语文/英语）',
    category: 'fix',
    subjects: ['语文', '英语'],
    stages: ['*'],
    promptHint: '排版语义标记规范（画线）：题干要求“画线句子/画线词语/画线部分/划出文中…句”处用 <u class="underline-sentence">…</u> 标记（划出/画出=画线用 <u>）；画线部分特指须在词内标出的目标字母/字词（只画该词内的目标字母/字词、不画整词）；自洽性硬性：题干要求“画线句子/画线词语/画线部分”的题，正文必须恰好有对应标记，题干有要求而正文无标记即视为无效题。',
    description: '语英阅读/语音辨析中“画线句子/画线词语/画线部分”的标记与自洽性硬性，按学科精确注入（语文/英语，其他学科不注入）；生成后自洽检测由汇总规则 text-format-fix 统一执行。',
    enabled: true,
  },
  {
    id: 'text-format-sup-sub',
    name: '上下标排版标记（数理化专用）',
    category: 'fix',
    subjects: ['数学', '化学', '物理'],
    stages: ['*'],
    promptHint: '排版语义标记规范（上下标）：凡需上升/下降排版的字符一律用语义标记——上标用 <sup>…</sup>（如 10<sup>2</sup> 的 2），下标用 <sub>…</sub>（如 X<sub>n</sub> 的 n）；学科中出现幂/指数、单位中的指数、数目/电荷计数、量值角标等情形按此标记；禁止直接输出 Unicode 上下标字符（²³⁺ₙ等，导出后字号/基线不统一）。',
    description: '数理化学科的上下标语义标记（数学幂/单位、化学式/离子、物理量下标），按学科精确注入（其他学科不注入该噪音约束）；生成后正文泄漏的 Unicode 上下标由本规则自动归一为 <sup>/<sub>（跳过 $…$ 公式区）。',
    enabled: true,
  },
  {
    id: 'formula-form-guard',
    name: '公式形态抽检（数理化生）',
    // 2026-09-30 类别定 guard（不是 fix）：本条**不修任何东西**，只在生成报告【问题列表】里提示用户手改，
    //    走的是 guard 通道的 silentCount(level='notice')（同 teaching-volume-guard，见 examValidator 的
    //    silentCount；useAiGenerator 取 silentDetails.filter(level!=='debug') → 问题列表）。
    //    有意不给 promptHint：guard 类本就不注入生成前约束，且公式写法已由渲染契约 FORMULA_RULES 单源覆盖
    //    （行内 $…$、块级 $$…$$、禁止文本堆砌）——再加一条就是冗余指令；实发提示词零新增。
    category: 'guard',
    subjects: ['数学', '物理', '化学', '生物'],
    stages: ['*'],
    description: '公式形态抽检：正文里出现「未用 $…$ 包裹的 LaTeX 命令」（如 3\\frac{1}{2}）时报警——Word 里会原样显示 LaTeX 代码、预览也不出印刷形态。只提示、不自动改动正文：公式起止需人判断，程序猜着补 $ 会把"讲解 LaTeX 写法"的正文改坏，属添乱；提示经 guard 通道（silentCount，notice 级）进生成报告【问题列表】。能自动修的一律走"扩转换器支持表"而非改文本（⊙/∅/`\\ ` 就是这么修好的）。公式写法已由渲染契约 FORMULA_RULES **单源注入**，故本条**不再提供 promptHint**（实发提示词零新增）。执行点：examValidator 1.5.6c。',
    enabled: true,
  },
  {
    id: 'text-format-phonetics',
    name: '英语音标排版标记',
    category: 'fix',
    subjects: ['英语'],
    stages: ['*'],
    promptHint: '排版语义标记规范（英语）：音标用斜杠包裹（/ˈæpl/）。',
    description: '英语学科音标斜杠包裹约束，按学科精确注入（其他学科不注入）；纯生成前约束——音标形态无程序自动修复，属模型自律项（生成后不打扰）。',
    enabled: true,
  },
  {
    id: 'text-format-zhuyin',
    name: '拼音注音排版标记（语文低段）',
    category: 'fix',
    subjects: ['语文'],
    stages: ['primary_low', 'primary_mid'],
    // 2026-10-02（③啰嗦·收口）：删"；不得用中文全角括号做拼音注音"——与"统一英文半角括号格式"同义（正句已说全）。
    promptHint: '排版语义标记规范（语文注音）：拼音注音统一英文半角括号格式，如 (háng xíng)。',
    description: '语文低段拼音注音格式约束，按学科×学段精确注入（高段/其他学科不注入）；生成后全角注音括号归一由 pinyin-norm 规则执行（语文低段拼音场景）。',
    enabled: true,
  },
  {
    id: 'writing-grid-fix',
    name: '书写格按学段适配（田字格/四线三格/横线）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '任何书写载体（横线/书写格/空白行）均为空位，严禁预填字或答案，格内留空供作答；作图按学科协议输出作答区。',
    description: '书写格按学段与题型双向规范（数据源=排版规格库 WRITING_CARRIER/CARRIER_RULES）：按 学科×学段 允许载体列表越界自动剥离（如中段以上田字格/四线三格、非语英学科混入格子）；书写格内容剥离（格子内预填字清空保留空格子）；载体×题型正规化（must 提示抽检/forbid 自动剥离）。2026-08 拆分：表达类禁格子/载体缺失/作文格补格等 语英专属 逻辑拆至独立规则 writing-expression-fix（subjects 语/英），本规则保持全学科职责（越界剥离对数学 square-grid 等全学科生效）——杜绝向数学/科学等学科注入"写话/作文"词汇噪音，同时不破坏全学科载体治理。2026-08-31 生成前提示语中性化：原"写字/抄写/…拼音"为语英专属词，经 subjects=* 广播到数学/体育/音乐等学科构成跨学科诱导（A1），现改为中性措辞；具体载体条款（田字格/拼音格/四线三格/方格纸）由 buildCarrierInstruction 按 学科×学段 精确注入，本规则生成后剥离职责保持全学科不变。',
    enabled: true,
  },
  {
    id: 'writing-expression-fix',
    name: '表达类书写格约束（写话/作文/书面表达）',
    category: 'fix',
    subjects: ['语文', '英语'],
    stages: ['*'],
    promptHint: '成篇成文表达的题不得混入书写格；其作答载体的形态**唯一确定、无自选余地**，不得在正文写"××格"等载体字样。',
    description: '语英专属（写话/作文/书面表达仅这两学科存在）：写话/作文/书面表达题内混入书写格自动剥离保留文字；作文格（zuo-wen-ge）补格仅语文（中文方块格，英语写作用横线体系）；载体缺失静默抽检（语文"田字格中写"无格、英语中段抄写无四线三格，均 debug 级）；写话/作文缺题目要求描述抽检。2026-08 自 writing-grid-fix 拆出（原 subjects=* 导致英语卷答案区"写作评分标准"命中关键词误报"无作文格"、数学等学科收到"写话/作文"词汇噪音）。',
    enabled: true,
  },

  // ==================== guard：静默防护（仅 debug 计数，不产生问题提示） ====================

  {
    id: 'option-count-guard',
    name: '选择题选项过少静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    description: '选择题选项数过少（<2）时静默计数（无法程序补选项，靠生成前约束）。',
    enabled: true,
  },

  {
    id: 'choice-answer-position-guard',
    name: '选择题作答位位置静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    description: '题面带选项（A./B./C. 等）的题，其答案括号位置**按学科**（外语类在题号前题首、中文科目在材料与设问之后、选项行之前），括号**一律半角**；选项行内/选项末尾出现 blank 空位（模型常把作答位误挂选项后，2026-09 实证）时静默计数（debug 级）——不自动修复：位置矫正属生成语义，靠生成前约束（作答空间条款）根治。',
    enabled: true,
  },

  {
    id: 'choice-first-blank-fix',
    name: '选择题题首作答位形态归一',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    description: '带选项的大题里，题首作答位若写成下划线空（blank-N）或裸空 → 确定性归一为**半角圆括号空位**（<span class="blank-N">&emsp;</span>，渲染自带半角括号；与 contentCleaner 归一产物同形）；**位置按学科**——外语类保留/归到题首、中文科目搬到题干末尾（2026-09-28 根治：此前"只换形态、不动位置"，中文题首空位换成 span 载体后 2j-6 够不到、位置无兜底）。2026-09-17 用户实证：六年级英语卷第六题（26–35）题首为下划线空，而同卷第四/九题（同为选择题）为括号——同卷内不一致，原探针只静默计数、错形态留进交付。生成侧条款由作答空间条款**单源注入**（题首/题干末尾按学科、括号一律半角），本规则不再提供 promptHint（否则同一要求两处重复）。',
    enabled: true,
  },

  {
    id: 'answer-coverage-guard',
    name: '答案覆盖度静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    description: '答案区题号明显少于正文时静默计数（提示答案页可能不完整）。',
    enabled: true,
  },

  {
    id: 'answer-area-fix',
    name: '书写作答空间保障',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '作答空位/空白行紧贴所属题输出，与下一题之间留出分隔、不粘连。',
    description: '程序按 分值×学段系数 度量题后有效作答行（横线/填空线/带高空白块；纯空行不计），无分值题按题型惯例留白，不足时补差。2026-09-29 形态描述改由**排版规格库 `ANSWER_REGION` 单一事实源**给出（原文"语文/英语/科学横线，其余空白"与该表相抵：表内**语文初中/高中为无线空白（blank-area）**、其余学科亦按表定）——补差形态一律读表，描述不得另立一套。',
    enabled: true,
  },

  {
    id: 'emphasis-form-fix',
    name: '强调标注形态归一（不用下划线）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    description: '内容型资料（预习/知识总结）里模型以"无载体 class 的 <u>"充当"重点标注"时，程序归一为加粗（<strong>，只换标记、不动文字）——下划线与横线在本产品语义是作答载体（填空横线、画线题标记），拿它做强调会与作答位混淆。生成侧口径由【输出格式】的"强调口径"单源注入（全类型），本条只做确定性形态归一，不新增提示词。',
    enabled: true,
  },

  {
    id: 'cn-ordinal-guard',
    name: '大题汉字序号连续性静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['exam'],
    description: '试卷正文大题以「汉字序号＋、」（一、二、三…）编号时，序号**重复**（如两个"三、"）或**按小节重启**（如 三、之后又出现 一、）→ 静默抽检（warn 进生成报告【问题列表】）。2026-09-28 新增：**只提示不改写、不重试、不判失败**——区别于数字题号缺号/重启的拦截口径（detectBodyNumberingRestart），本判据仅如实报告交编辑核对。',
    enabled: true,
  },

  {
    id: 'question-numbering-key',
    name: '题号主键变化（无阿拉伯小题号）静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['exam'],
    description: '正文题号由**大类/大题汉字序号**承担（正文无阿拉伯小题号）时——缺号守卫 detectBodyNumberingGap 与答案覆盖守卫的**计数主键**（extractBodyQuestionNumbers，行首 `N.`）失效、会**静默放行** → 静默抽检（notice 进生成报告【问题列表】）如实说明"计数主键不适用，请人工核对题量与答案逐题覆盖"。2026-10-05（题号主键消相抵后）：大题唯一题用汉字序号是**应然**（非缺陷），本条**只报告可见性、不改写、不重试、不判失败**。',
    enabled: true,
  }
]
;

// ==================== 执行点注册表（生成端接线声明，单一事实源） ====================
// 用途：规则库面板「接线状态自检」据此推导，不再硬编码假空——
//   - VALIDATOR_GATES  引擎（auditExamPaper）中存在 has('<id>') 独立执行分支的规则 id 全集（含已注销规则的惰性残留分支）
//   - RULE_EXEC_BY     无独立分支、语义由某汇总/关联规则执行的子规则（key=子规则 → value=执行它的规则 id）
//   - RULE_NO_EXEC     显式声明的纯生成前约束（fix 名不副实已豁免：无程序修复，模型自律项）
// 完整性规则：每个已注册规则必属其一，否则 = 注册空洞；
//             引擎分支 id 必在 VALIDATOR_GATES 内（tests/recipe/validatorWiring.test.js 以 examValidator 源码 has() 调用点
//             自动对账两侧，防注册/执行漂移——新增 has() 分支或新增规则时该测试强制同步本表）。
/** 引擎 has() 独立执行分支全集（由 validatorWiring 测试与 examValidator 源码自动对账） */
export const VALIDATOR_GATES = new Set([
  'pinyin-norm', 'template-cleanup', 'image-block-fix', 'duplicate-content-fix',
  'text-format-fix', 'teaching-volume-guard', 'writing-grid-fix', 'title-detail-fix',
  'option-count-guard', 'choice-answer-position-guard', 'choice-first-blank-fix', 'score-label-fix', 'writing-expression-fix',
  'answer-area-fix', 'answer-section-exam', 'answer-section-teaching', 'answer-coverage-guard',
  'emphasis-form-fix',
  'text-format-sup-sub', 'cn-ordinal-guard', 'question-numbering-key',
  'formula-form-guard',
]);
/** 无独立分支、由汇总/关联规则执行的子规则 */
export const RULE_EXEC_BY = {
  'text-format-zhupoint': 'text-format-fix',
  'text-format-underline': 'text-format-fix',
  'text-format-zhuyin': 'pinyin-norm',
};
/** 显式声明的纯生成前约束（无程序执行点，模型自律） */
export const RULE_NO_EXEC = new Set(['text-format-phonetics']);

/** 全量内置规则（维护/展示用） */
export const listValidatorRules = () => getMergedRules().map(r => ({ ...r }));

/** 查询单条规则（用户版优先） */
export const getValidatorRule = (id) => getMergedRules().find(r => r.id === id) || null;

// ==================== 用户自定义持久化（面板维护，用户版优先，对齐蓝图库/指令库机制） ====================

/** localStorage 键：用户自定义规则库（覆盖/新增/删除标记） */
export const RULES_STORAGE_KEY = 'wisdom_validator_rules_v1';

/** 读取用户自定义规则库 */
const loadUserRules = () => {
  try {
    return JSON.parse(localStorage.getItem(RULES_STORAGE_KEY) || 'null') || { overrides: {}, added: {}, deleted: [] };
  } catch { return { overrides: {}, added: {}, deleted: [] }; }
};

/** 保存单条规则（内置 id → 覆盖；新 id → 新增） */
export const saveUserRule = (rule = {}) => {
  if (!rule.id) return false;
  const lib = loadUserRules();
  const isBuiltin = VALIDATOR_RULES.some(r => r.id === rule.id);
  const target = isBuiltin ? lib.overrides : lib.added;
  target[rule.id] = { ...rule, updatedAt: Date.now() };
  if (!isBuiltin && lib.deleted.includes(rule.id)) lib.deleted = lib.deleted.filter(id => id !== rule.id);
  try { localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(lib)); } catch { return false; }
  return true;
};

/** 删除规则（内置 id → 标记删除回退；用户新增 id → 移除） */
export const deleteUserRule = (id) => {
  if (!id) return false;
  const lib = loadUserRules();
  const isBuiltin = VALIDATOR_RULES.some(r => r.id === id);
  if (isBuiltin) {
    delete lib.overrides[id];
    if (!lib.deleted.includes(id)) lib.deleted.push(id);
  } else {
    delete lib.added[id];
    lib.deleted = lib.deleted.filter(x => x !== id);
  }
  try { localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(lib)); } catch { return false; }
  return true;
};

/** 恢复全部默认（清空用户自定义） */
export const resetUserRules = () => {
  try { localStorage.removeItem(RULES_STORAGE_KEY); } catch {}
  return true;
};

/** 合并：内置（剔除 deleted）→ 应用 overrides → 追加用户新增 */
const getMergedRules = () => {
  const user = loadUserRules();
  const deleted = new Set(user.deleted || []);
  const out = [];
  for (const rule of VALIDATOR_RULES) {
    if (deleted.has(rule.id)) continue;
    const override = user.overrides?.[rule.id];
    out.push(override ? { ...rule, ...override, source: 'user' } : { ...rule, source: 'builtin' });
  }
  for (const [id, rule] of Object.entries(user.added || {})) {
    out.push({ ...rule, id, source: 'user' });
  }
  return out;
};

/**
 * 按 学段×学科×资料类型 三维度匹配启用的规则 id 集合（与指令库/蓝图库匹配口径对齐；
 * 基于合并后的规则（内置+用户自定义），用户面板维护即时生效）
 * @param {Object} opts { subject, stage, genType }
 * @returns {Set<string>} 启用的规则 id 集合
 */
export const getValidatorRules = ({ subject = '', stage = '', genType = '' } = {}) => {
  const ids = new Set();
  for (const rule of getMergedRules()) {
    if (!rule.enabled) continue;
    if (rule.genTypes && rule.genTypes.length && !rule.genTypes.includes(genType)) continue;
    if (rule.subjects && rule.subjects.length && !rule.subjects.includes('*') && !rule.subjects.includes(subject)) continue;
    if (rule.stages && rule.stages.length && !rule.stages.includes('*') && !rule.stages.includes(stage)) continue;
    ids.add(rule.id);
  }
  return ids;
};

/**
 * 命中当前三维度、启用且带生成前约束（promptHint）的 fix 类规则明细。
 * buildValidatorPrompt（注入文本）与生成面板「程序附加段」分段标注共用本函数——
 * 保证"面板展示=实际注入"，点规则跳转定位到同一 id 的条目，无第二套口径。
 * @param {Object} opts { subject, stage, genType }
 * @returns {Array<object>} 命中规则（合并后：内置+用户自定义），按注册顺序
 */
export const getActiveFixPromptRules = ({ subject = '', stage = '', genType = '' } = {}) => {
  const out = [];
  for (const rule of getMergedRules()) {
    if (!rule.enabled || rule.category !== 'fix' || !rule.promptHint) continue;
    if (rule.genTypes && rule.genTypes.length && !rule.genTypes.includes(genType)) continue;
    if (rule.subjects && rule.subjects.length && !rule.subjects.includes('*') && !rule.subjects.includes(subject)) continue;
    if (rule.stages && rule.stages.length && !rule.stages.includes('*') && !rule.stages.includes(stage)) continue;
    out.push(rule);
  }
  return out;
};

/**
 * 生成前约束文案（阶段一：随指令注入）：
 * 收集启用 fix 类规则的 promptHint，转成一段精简的【版面质检规则】约束注入指令。
 * @param {Object} opts { subject, stage, genType }
 * @returns {string} 空串 = 无 fix 规则启用
 */
export const buildValidatorPrompt = ({ subject = '', stage = '', genType = '' } = {}) => {
  const hints = getActiveFixPromptRules({ subject, stage, genType }).map((r) => r.promptHint);
  if (hints.length === 0) return '';
  return `\n\n【版面质检规则（生成前约束）】\n${hints.map(h => `· ${h}`).join('\n')}`;
};

export default {
  normalizeStage, VALIDATOR_RULES, VALIDATOR_GATES, RULE_EXEC_BY, RULE_NO_EXEC, RULES_STORAGE_KEY,
  listValidatorRules, getValidatorRule, getValidatorRules, getActiveFixPromptRules, buildValidatorPrompt,
  saveUserRule, deleteUserRule, resetUserRules,
};
