/**
 * 整卷质检规则库（Exam Validator Rules）
 * ============================================================
 * 🔴 定位：与「指令库」（promptLibrary）、「蓝图库」（examPaperBlueprints）对齐的
 *    三维度（学段 × 学科 × 资料类型）可维护规则库，单一事实来源，双阶段生效：
 *
 *   【阶段一 · 随指令注入】buildValidatorPrompt()：把启用的 fix 类规则转成
 *       生成前约束文案注入指令（GenerateModule 与 buildRenderContract 并列追加），
 *       让 AI 生成时就不出错（防患未然）。
 *   【阶段二 · 生成后静默】auditExamPaper(html, {subject, stage, genType})：
 *       fix 类自动修复卷面（用户无感）；guard 类静默计数（仅 debug 日志，
 *       不产生任何问题提示——靠生成前约束解决，生成后不打扰）。
 *
 * 规则类别：
 *   - fix   自动修复：生成前注入约束 + 生成后自动修正
 *   - guard 静默防护：生成后仅 debug 计数，不产生问题提示
 *
 * 字段说明：
 *   id          规则唯一标识（校验器按 id 开关对应逻辑）
 *   name        规则名
 *   category    'fix' 自动修复 / 'guard' 静默防护
 *   subjects    适用学科数组，'*' = 全学科
 *   stages      适用学段键数组（primary_low/primary_mid/primary_high/middle/high），'*' = 全学段
 *   genTypes    适用资料类型数组，空/缺省 = 全部类型
 *   promptHint  生成前约束文案（fix 类必填，注入指令时展示）
 *   description 规则说明
 *   enabled     是否启用
 * ============================================================
 */

/** 归一学段：'小学'/'primary' → primary_low~high（按年级细分，无年级时回落 primary_low 由校验器宽松处理） */
export const normalizeStage = (stage = '', grade = 0) => {
  const map = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
  let base = map[stage] || stage || '';
  if (base === 'primary') {
    const g = parseInt(grade, 10) || 0;
    base = g <= 2 ? 'primary_low' : g <= 4 ? 'primary_mid' : 'primary_high';
  }
  return base;
};

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
    promptHint: '拼音一律用标准 ASCII 拼音字母（ɡ→g、全角字母→半角），严禁混入 IPA 音标字符（ɡ/ŋ/ɑ/ə）。',
    description: '将混入小学拼音的 IPA 音标字符与全角字母归一为标准拼音，防字体显示不一致。',
    enabled: true,
  },
  {
    id: 'template-cleanup',
    name: '模板残留清理',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '禁止输出"【插图占位】/PROMPT"等占位文本、被转义的标签（如 \\</div\\>）、空条款（"3．。"只有编号无内容）。',
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
    promptHint: '分值账目自洽：小题数×每题分=大题分、空数×每空分=小题分、各大题分之和=满分，必须精确成立；多空题注明"（每空X分）"；声称的题数/空数/连线数必须等于正文实际输出的题号/空位/连线数。',
    description: '大题/小题标题"每空/每线/每题 X 分"标注与实际空位数/连线数/子题数校验，不一致时以实际载体数为准按「声称单位分×实际载体数」重算总分（不凑数）。',
    enabled: true,
  },

  {
    id: 'title-detail-fix',
    name: '大题标题明细式修复',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['exam'],
    promptHint: '大题标题用明细式"共X题，每题X分/共X分"（见【卷面结构】），严禁"一、XX。（32分）"式短写；小题题号后/题干末尾标注"（X分）"。',
    description: '大题标题旧式"（X分）"自动补全为明细式"共N题，每题X分，共X分"（与真题卷规范对齐）。',
    enabled: true,
  },
  {
    id: 'answer-section-fix',
    name: '答案区容器补全',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '答案区以 <h2>参考答案与评分标准</h2> 或 <h2>参考答案与解析</h2> 标题开头（系统自动包裹为独立答案区并另起分节，正文不出现任何答案/解析内容）。',
    description: 'once 模式答案区 <h2>参考答案… 无 answer-section 包裹时自动补包（docx 独立分节所需）。',
    enabled: true,
  },
  {
    id: 'image-block-fix',
    name: '[IMAGE] 配图块标准化',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '配图用 [IMAGE] 标记块（每图一个、单独成段），格式见【渲染指令】。',
    description: '把 AI 输出的 [IMAGE] 块规范化为 EduRender 标准格式：参数独占一行、半角冒号、清理 PROMPT 中混入的 HTML 残留、未闭合自动补 [/IMAGE]、不指定生图引擎（清除 TYPE:SD 等引擎参数，ICON 图标检索保留）。',
    enabled: true,
  },
  {
    id: 'duplicate-content-fix',
    name: '正文重复内容检测截断',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '全卷题目与板块标题必须唯一（"一、识字与写字"等大题标题严禁重复出现），严禁输出两份相同内容（含重复的看图写话/配图/作文格）。',
    description: '检测正文区重复的大题标题（同一标题出现 ≥2 次，多为截断续写时模型从头重出导致）→ 从第二次重复处截断保留第一份；重复的答案区保留第一份。',
    enabled: true,
  },

  {
    id: 'teaching-volume-guard',
    name: '教辅内容充足性静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    description: '教辅类资料（非 exam）生成后静默确认内容充足性：阅读训练须含选文（短文）且长度达标、知识总结篇幅足够、课时练/专项/复习/默写题量不单薄——缺失/过短仅 debug 计数（题量/篇幅底线由教辅结构蓝本 stages.volume 提供，程序侧校验参考，不注入 prompt 防限定 AI）。',
    enabled: true,
  },

  {
    id: 'score-distribute-fix',
    name: '分值自动分配（无单位声称的小题按大题总分重算，账目闭合）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['exam'],
    description: '生成后自动修复：大题内小题分值之和≠大题分时，未带"每X分"单位声称的小题按大题总分重算单位分值并重写标题（0.5 分粒度）；带单位声称的小题保留模型语义定价（由 score-label-fix 按实际载体数处理）——分值账目是确定性算法，不依赖 AI 算术。',
    promptHint: '大题分值必须在小题间精确分配闭合；未注明"（每题X分）"的小题，系统将按大题总分自动重算分配（已注明项保留语义定价）。',
    enabled: true,
  },
  {
    id: 'score-sum-guard',
    name: '分值账目总和静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['exam'],
    description: '生成后静默：大题内小题分值之和=大题分、全卷各大题分值之和=满分，不符时计数（账目由分值类规则生成前约束 + 此处兜底，供抽检）。',
    enabled: true,
  },
  {
    id: 'low-score-guard',
    name: '小学卷 0.5 分静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['primary_low', 'primary_mid', 'primary_high'],
    genTypes: ['exam'],
    description: '小学卷小题分值必须为整数（低段每空/每题1-2分、中高段1-4分），出现 0.5 分等小数分值（如"每空0.5分"）时静默计数——分值规则明确小学一律整数分。',
    enabled: true,
  },

  {
    id: 'text-format-fix',
    name: '排版语义标记规范（加点/画线/加粗/删除线/分数/表格）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '排版语义标记规范：①加点字（题干要求“圈出加点字”的字）用 <span class="emphasis-dot">字</span> 标记（字下加点，🔴严禁用 <u> 下划线表示加点）；②画线词语/句子用 <u class="underline-sentence">…</u> 标记；③强调用 <b>…</b>；④删除/划去用 <del>…</del>；⑤分数统一“分子/分母”半角斜杠（如 1/2）；⑥统计表/数位表/乘法表用 <table> 标准结构。🔴 自洽性硬性：题干要求“圈出加点字/画线句子”的题，正文必须恰好存在对应标记（加点=emphasis-dot、画线=underline-sentence），严禁题干有要求而正文无标记（无标记=废题）；题目自身必须自洽。',
    description: '定义全学科排版语义标记规范（加点/画线/加粗/删除线/分数/表格），并静默检测"题干要求加点/画线但正文无 <u> 标记"的废题（无法程序补全哪个字应加点，靠生成前约束 + 静默计数）。',
    enabled: true,
  },
  {
    id: 'text-format-sup-sub',
    name: '上下标排版标记（数理化专用）',
    category: 'fix',
    subjects: ['数学', '化学', '物理'],
    stages: ['*'],
    promptHint: '排版语义标记规范（上下标）：上标（数学幂 x²、面积单位、化学离子 Na⁺）用 <sup>…</sup>；下标（化学式 H₂O/CO₂、物理速度 v₁）用 <sub>…</sub>——严禁把 H₂O 写成无标记裸文本、严禁混用 Unicode 上下标字符（²³⁺ₙ等，导出后字号/基线不统一）。',
    description: '数理化学科的上下标语义标记（数学幂/单位、化学式/离子、物理量下标），按学科精确注入（其他学科不注入该噪音约束）。',
    enabled: true,
  },
  {
    id: 'text-format-phonetics',
    name: '英语音标排版标记',
    category: 'fix',
    subjects: ['英语'],
    stages: ['*'],
    promptHint: '排版语义标记规范（英语）：音标用斜杠包裹（/ˈæpl/）。',
    description: '英语学科音标斜杠包裹约束，按学科精确注入（其他学科不注入）。',
    enabled: true,
  },
  {
    id: 'text-format-zhuyin',
    name: '拼音注音排版标记（语文低段）',
    category: 'fix',
    subjects: ['语文'],
    stages: ['primary_low', 'primary_mid'],
    promptHint: '排版语义标记规范（语文注音）：拼音注音统一"（háng xíng）"半角括号格式。',
    description: '语文低段拼音注音格式约束，按学科×学段精确注入（高段/其他学科不注入）。',
    enabled: true,
  },
  {
    id: 'writing-grid-fix',
    name: '书写格按学段适配（田字格/四线三格/横线）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '写字/抄写类题必须输出对应书写格（缺格子=废题）；写话/作文等表达类不得混入书写格（用作文格或留白）。',
    description: '书写格按学段与题型双向规范（数据源=排版规格库 WRITING_CARRIER/CARRIER_RULES）：按 学科×学段 允许载体列表越界自动剥离（如中段以上田字格/四线三格、非语英学科混入格子）；表达/写话类题内混入书写格自动剥离保留文字；写字/抄写类题该用格子却没用（语文低段田字格/拼音格、英语中段四线三格）静默计数提示抽检。生成前约束仅保留本规则独有增量（表达类禁格子）；载体格式规范由指令库 QUESTION_FORMAT 承载（必须真实输出/输出在题后）、场景细节由学段指引 SUBJECT_STAGE_EXTRAS 承载（三维度），本库不再重复（单通道）。',
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
    promptHint: '作答空间量与其分值匹配（空白或横线），选择/判断题无需额外空间；作答空间不得被压缩或与下一题粘连。',
    description: '程序按 分值×学段系数 度量题后有效作答行（横线/填空线/带高空白块；纯空行不计），不足时按学科配置（语文/英语/科学横线，其余空白）补差——卷面惯例非课标要求。',
    enabled: true,
  }
]
;

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
 * 生成前约束文案（阶段一：随指令注入）：
 * 收集启用 fix 类规则的 promptHint，转成一段精简的【卷面质检规则】约束注入指令。
 * @param {Object} opts { subject, stage, genType }
 * @returns {string} 空串 = 无 fix 规则启用
 */
export const buildValidatorPrompt = ({ subject = '', stage = '', genType = '' } = {}) => {
  const hints = [];
  for (const rule of getMergedRules()) {
    if (!rule.enabled || rule.category !== 'fix' || !rule.promptHint) continue;
    if (rule.genTypes && rule.genTypes.length && !rule.genTypes.includes(genType)) continue;
    if (rule.subjects && rule.subjects.length && !rule.subjects.includes('*') && !rule.subjects.includes(subject)) continue;
    if (rule.stages && rule.stages.length && !rule.stages.includes('*') && !rule.stages.includes(stage)) continue;
    hints.push(rule.promptHint);
  }
  if (hints.length === 0) return '';
  return `\n\n【卷面质检规则（生成前约束）】\n${hints.map(h => `· ${h}`).join('\n')}`;
};

export default {
  normalizeStage, VALIDATOR_RULES, RULES_STORAGE_KEY,
  listValidatorRules, getValidatorRule, getValidatorRules, buildValidatorPrompt,
  saveUserRule, deleteUserRule, resetUserRules,
};
