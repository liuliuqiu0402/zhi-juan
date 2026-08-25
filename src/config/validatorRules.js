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

/** 学段键全集（与指令库 grade / 蓝图 stage 对齐） */
export const STAGE_KEYS = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

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
    subjects: ['语文', '英语'],
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
    id: 'pinyin-blank-fill',
    name: '看拼音写词语缺空自动补全',
    category: 'fix',
    subjects: ['语文'],
    stages: ['primary_low', 'primary_mid'],
    promptHint: '看拼音写词语/拼音填空：每个拼音组后必须紧跟作答空位，拼音组数与空位数一一对应（6个拼音必须6个空，禁止漏空如"沙tān上"）。',
    description: '题干拼音组数与空位数不一致（漏空）时，在未配空的拼音组后补（　　），使拼音与空位一一对应、分值账目可整除。',
    enabled: true,
  },
  {
    id: 'score-label-fix',
    name: '分值标注对齐',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '分值账目自洽：大题/小题"每空/每题 X 分"必须能被空数/题数整除（如 12分=6空×2分），禁止"12分5空"式错账；多空题注明"（每空X分）"。',
    description: '大题/小题标题"每空/每线/每题 X 分"标注与实际空位数/连线数/子题数校验，不整除时按"每题 X 分"或"共 X 分"修正。',
    enabled: true,
  },
  {
    id: 'sub-carrier-fix',
    name: '子题载体一致性提示',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '同题组内各子题作答载体必须一致：要么都有空位、要么都有选项，禁止同组内一题有空一题无空（如读音题每个子题都必须给出拼音选项）。',
    description: '同题组各子题作答载体数（空位/拼音选项）不一致时给出差异描述，提示生成时补齐。',
    enabled: true,
  },
  {
    id: 'title-detail-fix',
    name: '大题标题明细式修复',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    genTypes: ['exam'],
    promptHint: '大题标题用明细式"共X题，每题X分，共X分"（汉字序号＋规范题型名＋句号＋全角括号明细），严禁旧式简写"（X分）"（如"一、识字与写字。（32分）"）。',
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
    promptHint: '配图块必须输出完整 EduRender 格式（[IMAGE] 起始、TYPE:SD 独占一行、PROMPT 画面描述、NEGATIVE、WIDTH、HEIGHT、STYLE:line_art、[/IMAGE] 结束），每个参数一行、半角冒号，严禁写成一行式或漏参数。',
    description: '把 AI 输出的 [IMAGE] 块规范化为 EduRender 标准格式：参数独占一行、半角冒号、补齐缺失的 NEGATIVE/WIDTH/HEIGHT 默认值、清理 PROMPT 中混入的 HTML 残留、未闭合自动补 [/IMAGE]。',
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
    id: 'match-line-clean',
    name: '连线题分隔符规范化',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '连线题（连一连）左右两列内容用全角空格分隔（左列与右列各自乱序排列），严禁用 ---/——/━ 等连字符作分隔——连字符竖排逐行对应时易被误读为已连好的答案线，线应由答题者自己连接。',
    description: '把连线题行内的连字符分隔符（---/———/━）替换为全角空格，避免视觉上被误读为预置答案线；左右两列内容与顺序不受影响。',
    enabled: true,
  },
  {
    id: 'match-option-dup-guard',
    name: '连线题选项重复静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    description: '连线题右侧选项内容重复（如两个"鸟"）时静默计数——选项重复导致学生无法唯一连线（即使答案内容相同也会困惑）。',
    enabled: true,
  },
  {
    id: 'match-pair-selfcheck',
    name: '连线题配对知识自检（防错配）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '连线题（连一连）配对知识自检硬性要求：每一条连线必须逐一核对知识正确性，严禁错配/漏配/一对多。偏旁/部首类连线（左列汉字↔右列偏旁名，如"鸭→鸟字旁"）：右侧每个偏旁必须与左侧至少一个汉字的真实偏旁正确对应，且左侧每个汉字在右侧有且仅有一个正确偏旁；字义/拼音/词语/反义词类连线同理，左列每一项的正确答案必须存在于右列且唯一对应。🔴 输出前逐对自检一遍：把每一条配对在心里读出来验证一遍，发现错误立即改正，宁可减少连线项数也不得保留错配。',
    description: '生成前约束：连线题配对知识自检（防"偏旁连线只有一对正确"类学科知识错误——配对正确性属语义知识，程序无法可靠判断，靠生成指令强制逐对自检，发挥模型自身知识能力）。',
    enabled: true,
  },
  {
    id: 'type-elements-guard',
    name: '教辅类资料关键元素齐全性静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    description: '非考试类资料（预习单/错题本/知识总结/复习资料/默写纸/阅读训练）生成后静默确认关键栏目元素是否齐全（如预习单的"我的疑问"、错题本的"错因归因"、总结/复习的"易错辨析"、默写纸的书写格、阅读训练的选文）——模板已有生成前要求，此规则补生成后确认，缺失仅 debug 计数不打扰用户。',
    enabled: true,
  },
  {
    id: 'match-format-fix',
    name: '连线题右列格式规范化',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '连线题（连一连）右列必须直接书写内容（词语/拼音/释义等），与左列逐行并排、用全角空格分隔；🔴 严禁"右列只放①②③序号、序号对照内容单独列在下方"的拆分格式——如需编号，编号与内容写在一起（如"②花园"）直接作为右列项，禁止下方再列"① 内容"对照行。',
    description: '把 AI 输出的"右列裸序号＋序号对照内容单独下方"拆分格式重组为标准连线题格式：对照内容回填到对应序号行尾（"园　　②花园"），删除对照行。',
    enabled: true,
  },
  {
    id: 'text-format-fix',
    name: '排版语义标记规范（加点/画线/加粗/上下标/删除线/注音自洽）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '排版语义标记规范：①加点字（题干要求"圈出加点字"的字）用 <u>加点字</u> 标记；②画线词语/句子用 <u>…</u> 标记；③强调用 <b>…</b>；④删除/划去用 <del>…</del>；⑤上标（数学幂 x²、面积单位、化学离子 Na⁺）用 <sup>…</sup>；⑥下标（化学式 H₂O/CO₂、物理速度 v₁）用 <sub>…</sub>——严禁把 H₂O 写成无标记裸文本、严禁混用 Unicode 上下标字符（²³⁺ₙ等，会乱码）；⑦分数统一"分子/分母"半角斜杠（如 1/2）；⑧英语音标用斜杠包裹（/ˈæpl/）；⑨拼音注音统一"（háng xíng）"半角括号格式；⑩统计表/数位表/乘法表用 <table> 标准结构。🔴 自洽性硬性：题干要求"圈出加点字/画线句子"的题，正文必须恰好存在对应的 <u> 标记，严禁题干有要求而正文无标记（无标记=废题）；题目自身必须自洽。',
    description: '定义全学科排版语义标记规范（加点/画线/加粗/删除线/上下标/分数/音标/表格/拼音注音），并静默检测"题干要求加点/画线但正文无 <u> 标记"的废题（无法程序补全哪个字应加点，靠生成前约束 + 静默计数）。',
    enabled: true,
  },
  {
    id: 'writing-grid-fix',
    name: '书写格按学段适配（田字格/四线三格/横线）',
    category: 'fix',
    subjects: ['*'],
    stages: ['*'],
    promptHint: '书写格按学段适配：语文 1-2 年级用田字格（<span class="tian-zi-ge">字</span>）、3 年级及以上用方格或横线（🔴 严禁田字格）；英语小学用四线三格（<span class="four-line-three">a</span>）、初中及以上用单线/横线；数学等学科不需书写格，作答统一用普通横线。',
    description: '按学段规范书写格（防"全学段田字格/四线三格"一刀切）：语文低段田字格、中段起方格/横线；英语小学四线三格、中学起单线；生成后检测"高学段仍用田字格/四线三格"静默计数。',
    enabled: true,
  },

  // ==================== guard：静默防护（仅 debug 计数，不产生问题提示） ====================
  {
    id: 'pinyin-option-guard',
    name: '读音题缺拼音选项静默防护',
    category: 'guard',
    subjects: ['语文'],
    stages: ['primary_low', 'primary_mid'],
    description: '读音辨析题某子题缺"（háng xíng）"式拼音选项时静默计数（无法程序补全，靠生成前约束）。',
    enabled: true,
  },
  {
    id: 'match-symmetric-guard',
    name: '连线项不对称静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    description: '连线题左右项数不对称时静默计数（无法程序判断哪侧多余，靠生成前约束）。',
    enabled: true,
  },
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
    id: 'blank-excess-guard',
    name: '空位多于拼音静默防护',
    category: 'guard',
    subjects: ['语文'],
    stages: ['primary_low', 'primary_mid'],
    description: '看拼音写词语空位数多于拼音组数时静默计数（"圆又圆"类合法多空不误报）。',
    enabled: true,
  },
  {
    id: 'answer-shell-guard',
    name: '答案空壳静默防护',
    category: 'guard',
    subjects: ['*'],
    stages: ['*'],
    description: '答案区出现"略/见教材"等空壳答案时静默计数（无法程序补答案，靠生成前约束）。',
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
    id: 'reading-source-guard',
    name: '阅读选文出处标注静默防护',
    category: 'guard',
    subjects: ['语文', '英语'],
    stages: ['*'],
    genTypes: ['exam', 'reading', 'special', 'review'],
    description: '阅读大题选文末尾缺【选自/出自/节选】出处标注时静默计数。',
    enabled: true,
  },
];

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
  return `\n\n【卷面质检规则（生成前约束，生成后自动校验修复，无需人工处理）】\n${hints.map(h => `· ${h}`).join('\n')}`;
};

export default {
  STAGE_KEYS, normalizeStage, VALIDATOR_RULES, RULES_STORAGE_KEY,
  listValidatorRules, getValidatorRule, getValidatorRules, buildValidatorPrompt,
  saveUserRule, deleteUserRule, resetUserRules,
};
