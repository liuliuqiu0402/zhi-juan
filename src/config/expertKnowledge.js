// ==================== 学科-年级体系 ====================
export const subjectGradeSystem = {
  '小学': {
    '语文': { 
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'], 
    },
    '数学': { 
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'], 
    },
    '英语': { 
      // 部分地区小学一年级起开设（与指令库 STAGE_SUBJECTS 低段含英语一致）
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'], 
    },
    '科学': {
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    },
    // 🔧 新增：小学道德与法治（部分学校从一年级开始）
    '道德与法治': {
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    },
    // 🔧 新增：小学信息科技（2022 课标新增学科；低年级以综合实践融合开设，与指令库矩阵一致）
    '信息科技': {
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    },
    // 🔧 补齐：音乐/美术/体育（小学全学段开设，与指令库 STAGE_SUBJECTS 一致）
    '音乐': {
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    },
    '美术': {
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    },
    '体育': {
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    }
  },
  '初中': {
    '语文': { 
      grades: ['七年级', '八年级', '九年级'], 
    },
    '数学': { 
      grades: ['七年级', '八年级', '九年级'], 
    },
    '英语': { 
      grades: ['七年级', '八年级', '九年级'], 
    },
    '物理': { 
      grades: ['八年级', '九年级'], 
    },
    '化学': { 
      grades: ['九年级'], 
    },
    '生物': {
      grades: ['七年级', '八年级'],
    },
    '历史': {
      grades: ['七年级', '八年级', '九年级'],
    },
    '地理': {
      grades: ['七年级', '八年级'],
    },
    '道德与法治': {
      grades: ['七年级', '八年级', '九年级'],
    },
    // 🔧 新增：初中科学（浙江等地综合理科，与指令库 STAGE_SUBJECTS/蓝图库 科学|middle 一致）
    '科学': {
      grades: ['七年级', '八年级', '九年级'],
    },
    // 🔧 统一为 2022 新课标名：信息科技；补齐音体美（初中全学段开设）
    '信息科技': {
      grades: ['七年级', '八年级', '九年级'],
    },
    '音乐': {
      grades: ['七年级', '八年级', '九年级'],
    },
    '美术': {
      grades: ['七年级', '八年级', '九年级'],
    },
    '体育': {
      grades: ['七年级', '八年级', '九年级'],
    }
  },
  '高中': {
    '语文': { 
      grades: ['高一', '高二', '高三'], 
    },
    '数学': { 
      grades: ['高一', '高二', '高三'], 
    },
    '英语': { 
      grades: ['高一', '高二', '高三'], 
    },
    '物理': { 
      grades: ['高一', '高二', '高三'], 
    },
    '化学': { 
      grades: ['高一', '高二', '高三'], 
    },
    '生物': {
      grades: ['高一', '高二', '高三'],
    },
    '历史': {
      grades: ['高一', '高二', '高三'],
    },
    '地理': {
      grades: ['高一', '高二', '高三'],
    },
    '思想政治': {
      grades: ['高一', '高二', '高三'],
    },
    // 🔧 学科键统一（义教课标名优先）；注意：高中课标名仍为"信息技术"（2022 义教课标不覆盖高中）；补齐音体美（高中全学段开设）
    '信息科技': {
      grades: ['高一', '高二', '高三'],
    },
    '音乐': {
      grades: ['高一', '高二', '高三'],
    },
    '美术': {
      grades: ['高一', '高二', '高三'],
    },
    '体育': {
      grades: ['高一', '高二', '高三'],
    }
  }
};

// ==================== 学段列表 ====================
// 🔗 命名双轨·学段：本数组与指令库 STAGE_NAMES（五档 key）、蓝图库学段 key 一一对应。
//    新增/改名学段须三处同步，否则"面板可选但注入不到"或"学段要点漏注入"。
export const stages = ['小学', '初中', '高中'];

// ==================== 学科列表 ====================
// 🔧 修复：移除"政治"（使用"道德与法治"/"思想政治"替代），保留别名供兼容
// 🔧 学科数据键统一为"信息科技"（义教课标名优先，兼容旧名"信息技术"；高中课标名仍为"信息技术"，键不变）；补齐音体美（与指令库 STAGE_SUBJECTS/蓝图库/教材库自动识别 15 科清单一致）
// 🔗 命名双轨·学科（15 科 canonical 清单，唯一权威）：须与指令库 STAGE_SUBJECTS、SUBJECT_STAGE_EXTRAS 的学科 key、
//    排版规格库 WRITING_CARRIER 的学科键、蓝图库学科键完全同名。新增/改名学科只改本数组，另三处会静默失配（漏注入/污染）。
export const subjects = [
  '语文', '数学', '英语', '物理', '化学', '生物', 
  '历史', '地理', '道德与法治', '思想政治', '科学', '信息科技',
  '音乐', '美术', '体育'
];

// ==================== 资料类型模板 ====================
// 🔗 命名双轨·资料类型：'exam/practice/special/preview/reading/summary/dictation/errorbook/review' 九类 key
//    与指令库 GEN_TYPE_NAMES、TYPE_BASES、蓝图库 TEACHING_GEN_TYPES/EXAM 类型 key 完全一致。
//    新增/改名类型须四处同步（expertKnowledge·指令库·examPaperBlueprints·teachingBlueprints），否则模板命不中/面板失配。
// 🔴 中文名以指令库 GEN_TYPE_NAMES 为规范（正式考卷/知识总结/复习资料…）；本表仅叠加 emoji 前缀用于 UI 卡片，
//    文本必须与规范名一致（tests/utils/typeNameConsistency 有断言守卫，防再漂移）。
/**
 * @deprecated genTypeTemplates.instruction 和 .structure 字段已废弃。
 * 生成规范已迁移至指令库模板 + 蓝图库（examPaperBlueprints/teachingBlueprints）+ 规则库。
 * 仅保留 .name 字段用于 UI 显示。
 */
export const genTypeTemplates = {
  'exam': {
    name: '📝 正式考卷',
  },
  'practice': {
    name: '📚 课时练',
  },
  'summary': {
    name: '📖 知识总结',
  },
  'special': {
    name: '🎯 专项突破',
  },
  'errorbook': {
    name: '🔖 错题本',
  },
  'preview': {
    name: '🔍 课前预习',
  },
  'dictation': {
    name: '📝 默写积累',
  },
  'reading': {
    name: '📖 阅读训练',
  },
  'review': {
    name: '📋 复习资料',
  }
};

// ==================== 资料类型选项 ====================
export const genTypeOptions = [
  { value: 'exam', label: '📝 正式考卷', desc: '正式考试试卷' },
  { value: 'practice', label: '📚 课时练', desc: '日常课时作业' },
  { value: 'summary', label: '📖 知识总结', desc: '知识归纳整理' },
  { value: 'special', label: '🎯 专项突破', desc: '专题深度训练' },
  { value: 'errorbook', label: '🔖 错题本', desc: '错题整理分析' },
  { value: 'preview', label: '🔍 课前预习', desc: '自主预习引导' },
  { value: 'dictation', label: '📝 默写积累', desc: '生字词/单词听默写' },
  { value: 'reading', label: '📖 阅读训练', desc: '阅读理解专项训练' },
  { value: 'review', label: '📋 复习资料', desc: '系统化复习+自测' }
];

// ==================== 组织风格选项（原"命题风格"改造：分命题/呈现两组，按类型映射，删"传统命题"） ====================
/** 风格分组：命题风格（题的组织） / 呈现风格（内容的组织） */
export const STYLE_GROUP = { PROPOSITION: 'proposition', PRESENTATION: 'presentation' };

/**
 * 组织风格选项（按所选资料类型自动显示对应组）
 * field: group 分组 · value 值 · label 名称 · desc 一句话 · tip 实际影响（用户选择提示）
 *        appliesTo 适用类型 · required 生成前是否必须确认（必选弹窗）
 */
export const styleOptions = [
  // ── 命题风格组（以题为主的资料：题的组织方式）──
  { group: 'proposition', value: 'unified_context', label: '课标卷型', desc: '全卷统一情境、对标真题结构',
    tip: '整卷围绕一个核心主题情境展开，情境贯穿所有题目，对标真题卷面结构与难度分层；适用于正式考试类资料。',
    appliesTo: ['exam'], required: true },
  { group: 'proposition', value: 'unit_context', label: '单元情境卷', desc: '单元大情境贯穿栏目',
    tip: '以本单元大情境/大任务组织，栏目间情境连贯递进，考查单元整体理解；适用于课时练、复习等以单元组织的资料。',
    appliesTo: ['practice', 'review'], required: false },
  { group: 'proposition', value: 'scenario_each', label: '逐题情境', desc: '每题独立真实生活情境',
    tip: '每题自带贴近学生生活的真实情境，不强制统一主题，灵活性最高；适用于日常训练类资料。',
    appliesTo: ['practice', 'special', 'reading'], required: false },
  { group: 'proposition', value: 'big_unit', label: '大单元教学', desc: '跨课时大概念组织',
    tip: '打破课时界限，围绕大概念/大任务整体设计，体现知识间的关联与递进；适用于特殊教学场景。',
    appliesTo: ['practice', 'review', 'special'], required: false },
  { group: 'proposition', value: 'project_based', label: '项目式学习', desc: '项目任务驱动',
    tip: '以一个完整项目任务为驱动，资料作为项目的一部分，考查真实问题中的综合能力；适用于特殊教学场景。',
    appliesTo: ['practice', 'special'], required: false },
  // ── 呈现风格组（以内容组织为主的资料：内容的呈现方式）──
  { group: 'presentation', value: 'mindmap', label: '导图式', desc: '知识分层梳理',
    tip: '按 总主题→分主题→要点 分层组织（渲染端以层级列表呈现；关系复杂需图示化时用 [GRAPH] 占位，勿自造图形字符），层次清晰、便于记忆；适用于知识总结类资料。',
    appliesTo: ['summary'], required: false },
  { group: 'presentation', value: 'table', label: '表格化', desc: '对比/表格呈现',
    tip: '以表格对比呈现易混点与分类信息，清晰易读；适用于知识总结、复习梳理。',
    appliesTo: ['summary', 'review'], required: false },
  { group: 'presentation', value: 'context_chain', label: '情境化串联', desc: '生活主题串联知识点',
    tip: '用一个贴近生活的大主题把知识点串联呈现，符合课标情境化要求；适用于知识总结、复习资料。',
    appliesTo: ['summary', 'review'], required: false },
  { group: 'presentation', value: 'task_driven', label: '问题驱动', desc: '预习任务问题化',
    tip: '以问题链驱动预习（圈画/概括/查阅/尝试），可操作可检查；适用于课前预习。',
    appliesTo: ['preview'], required: false },
  { group: 'presentation', value: 'framework', label: '框架式', desc: '框架→梳理→辨析',
    tip: '按 知识框架→考点梳理→易错辨析→自测 组织，覆盖完整；适用于复习资料。',
    appliesTo: ['review'], required: false },
];

/** 按资料类型返回该类型应显示的风格组与可选项 */
export const styleOptionsForType = (genType = '') => {
  const list = styleOptions.filter((o) => !o.appliesTo.length || o.appliesTo.includes(genType));
  const group = list.find((o) => o.group)?.group || '';
  return { group, options: list };
};

/** 资料类型 → 默认风格（选类型未手动选时自动推荐） */
export const DEFAULT_STYLE_BY_TYPE = {
  exam: 'unified_context',
  practice: 'scenario_each',
  special: 'scenario_each',
  reading: 'scenario_each',
  summary: 'mindmap',
  review: 'framework',
  preview: 'task_driven',
  dictation: '',
  errorbook: '',
};

/** 该类型是否必须在生成前确认风格（必选弹窗） */
export const isStyleRequiredForType = (genType = '') =>
  !!DEFAULT_STYLE_BY_TYPE[genType] && genType !== 'dictation' && genType !== 'errorbook';

// ==================== 组织风格指令（生成时注入：情境组织/呈现方式，简洁不诱导） ====================
export const styleInstructions = {
  'unified_context': '整份资料围绕一个核心主题情境展开，情境贯穿全卷，各题在此情境下连贯设问。',
  'unit_context': '以本单元大情境组织，栏目间情境连贯递进，各题在单元情境下展开。',
  'scenario_each': '每题设置贴近学生生活的独立情境设问，情境与题目内容一致。',
  'big_unit': '打破课时界限，围绕大概念整体组织，体现知识关联与递进。',
  'project_based': '以一个完整项目任务为驱动组织资料，考查真实问题中的综合能力。',
  'mindmap': '按 总主题→分主题→要点 分层组织，条目层级清晰；关系复杂需图示化时用 [GRAPH] 占位，勿自造图形字符。',
  'table': '以表格对比呈现信息，清晰易读，易混点用对比突出。',
  'context_chain': '以一个贴近生活的大主题串联各知识点呈现，情境自然连贯。',
  'task_driven': '以问题链组织预习任务，可操作可检查，覆盖本课时新知识点。',
  'framework': '按知识框架→考点梳理→易错辨析→自测组织，覆盖完整、重点突出。',
};

// ==================== 范围选项 ====================
export const scopeOptions = [
  { value: 'default', label: '默认', desc: '按章节默认范围（选课→课名，整单元→单元名，跨单元→综合检测）' },
  { value: 'midterm', label: '期中', desc: '期中考试范围' },
  { value: 'final', label: '期末', desc: '期末考试范围' },
  { value: 'monthly', label: '月考', desc: '月考范围' },
  { value: 'topic', label: '专题', desc: '专题复习范围' },
  // 升学考卷别（仅对"正式考卷"销售展示与生效；卷面结构由蓝本按卷别解析，见 blueprintProvider）
  { value: 'xiaoshengchu', label: '小升初', desc: '小学毕业升学衔接卷（毕业检测结构，仅正式考卷）' },
  { value: 'zhongkao', label: '中考', desc: '初中毕业升学考卷（中考结构，仅正式考卷）' },
  { value: 'gaokao', label: '高考', desc: '高中毕业升学考卷（新高考结构，仅正式考卷）' }
];

// ==================== 粒度选项 ====================
export const granularityOptions = [
  { value: 'unit', label: '按单元', desc: '以单元为单位生成' },
  { value: 'lesson', label: '按课', desc: '以课时为单位生成' }
];

// 🔧 学科名称别名映射（统一为 2022 新课标标准名）
// 🔗 命名双轨·别名：别名最终归一化的目标名，必须落在上方 subjects canonical 清单内（并与指令库/载体键同名）；
//    新增别名只加映射目标（canonical），不要为旧名另造新规范名，否则载体键/指令 key 又失配。
// 政治/思想品德 → 道德与法治(初中小学) / 思想政治(高中)，由 normalizeSubjectName 按学段处理
// 信息技术 → 信息科技（2022 新课标统一名称）
// 体育与健康 → 体育（蓝本与指令库以"体育"为主 key，保留全名作为别名兼容）
export const subjectAliasMap = {
  '政治': '道德与法治',  // 默认映射到初中名称（更常用，高中由 normalizeSubjectName 二次纠正为思想政治）
  '道法': '道德与法治',  // 旧简称兼容
  '思想品德': '道德与法治',
  '品德与社会': '道德与法治',
  '信息技术': '信息科技',  // 2022 新课标统一为"信息科技"
  '信息': '信息科技',  // 旧简称兼容
  '体育与健康': '体育',
  '体育与健康课程': '体育',
  '科学（小学）': '科学',  // 教材旧数据兼容（与蓝本库 SUBJECT_ALIAS 对齐，避免学科要点维度缺失）
  '小学科学': '科学',
};

/**
 * 🔧 学科名按学段自动纠正（学科×学段归名唯一事实源）
 * @param {string} subject - 原始学科名称（含简称/旧名：政治/道法/思想品德/信息技术/体育与健康…）
 * @param {string} stage - 学段：五档键（primary_low/middle/high）或粗标签（小学/初中/高中、primary/middle/high）
 * @returns {string} 纠正后的学科标准名（政治类：高中=思想政治，小学/初中=道德与法治；信息技术→信息科技；体育与健康→体育…）
 */
export const normalizeSubjectName = (subject, stage) => {
  if (!subject) return subject;

  // 🔧 统一学段值：兼容英文三档（'primary'/'middle'/'high'）、五档键（primary_low…high）、中文（小学/初中/高中）
  const stageMap = { 'primary': '小学', 'middle': '初中', 'high': '高中', 'primary_low': '小学', 'primary_mid': '小学', 'primary_high': '小学' };
  const normalizedStage = stageMap[stage] || stage;
  const isHigh = normalizedStage === '高中';
  const isLowerPrimaryOrMiddle = normalizedStage === '小学' || normalizedStage === '初中';

  // 政治类（含简称/旧名）按学段归名：高中=思想政治；小学/初中=道德与法治
  if (subject === '政治' || subject === '思想品德' || subject === '道法') {
    return isHigh ? '思想政治' : '道德与法治';
  }
  // 标准名跨学段纠正（同一课程不同学段不同名）：道德与法治(小/初)在高中叫思想政治；思想政治在小学/初中叫道德与法治
  if (subject === '道德与法治' && isHigh) return '思想政治';
  if (subject === '思想政治' && isLowerPrimaryOrMiddle) return '道德与法治';

  // 其余别名（信息技术→信息科技、体育与健康→体育 等，与学段无关）
  const aliasTarget = subjectAliasMap[subject];
  if (aliasTarget) return aliasTarget;

  return subject;
};





