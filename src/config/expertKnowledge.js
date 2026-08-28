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
    // 🔧 统一为 2022 新课标名：信息科技；补齐音体美（高中全学段开设）
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
export const stages = ['小学', '初中', '高中'];

// ==================== 学科列表 ====================
// 🔧 修复：移除"政治"（使用"道德与法治"/"思想政治"替代），保留别名供兼容
// 🔧 统一为 2022 新课标标准名：信息技术→信息科技；补齐音体美（与指令库 STAGE_SUBJECTS/蓝图库/教材库自动识别 15 科清单一致）
export const subjects = [
  '语文', '数学', '英语', '物理', '化学', '生物', 
  '历史', '地理', '道德与法治', '思想政治', '科学', '信息科技',
  '音乐', '美术', '体育'
];

// ==================== 资料类型模板 ====================
/**
 * @deprecated genTypeTemplates.instruction 和 .structure 字段已废弃。
 * 生成规范已迁移至指令库模板 + 蓝图库（examPaperBlueprints/teachingBlueprints）+ 规则库。
 * 仅保留 .name 字段用于 UI 显示。
 */
export const genTypeTemplates = {
  'exam': {
    name: '📝 考卷',
  },
  'practice': {
    name: '📚 课时练',
  },
  'summary': {
    name: '📖 知识点总结',
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
    name: '📋 单元/期末复习',
  }
};

// ==================== 资料类型选项 ====================
export const genTypeOptions = [
  { value: 'exam', label: '📝 考卷', desc: '正式考试试卷' },
  { value: 'practice', label: '📚 课时练', desc: '日常课时作业' },
  { value: 'summary', label: '📖 知识点总结', desc: '知识归纳整理' },
  { value: 'special', label: '🎯 专项突破', desc: '专题深度训练' },
  { value: 'errorbook', label: '🔖 错题本', desc: '错题整理分析' },
  { value: 'preview', label: '🔍 课前预习', desc: '自主预习引导' },
  { value: 'dictation', label: '📝 默写积累', desc: '生字词/单词听默写' },
  { value: 'reading', label: '📖 阅读训练', desc: '阅读理解专项训练' },
  { value: 'review', label: '📋 单元/期末复习', desc: '系统化复习+自测' }
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
  { group: 'presentation', value: 'mindmap', label: '导图式', desc: '结构化导图优先',
    tip: '以思维导图/结构图呈现知识点关系，层次清晰、便于记忆；适用于知识总结类资料。',
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
  'mindmap': '以导图/结构图呈现知识点关系，结构化展示，层次清晰。',
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
  { value: 'topic', label: '专题', desc: '专题复习范围' }
];

// ==================== 粒度选项 ====================
export const granularityOptions = [
  { value: 'unit', label: '按单元', desc: '以单元为单位生成' },
  { value: 'lesson', label: '按课', desc: '以课时为单位生成' }
];

// 🔧 学科名称别名映射（统一为 2022 新课标标准名）
// 政治/思想品德 → 道德与法治(初中小学) / 思想政治(高中)，由 normalizeSubjectName 按学段处理
// 信息技术 → 信息科技（2022 新课标统一名称）
// 体育与健康 → 体育（蓝本与指令库以"体育"为主 key，保留全名作为别名兼容）
export const subjectAliasMap = {
  '政治': '道德与法治',  // 默认映射到初中名称（更常用，高中由 normalizeSubjectName 二次纠正为思想政治）
  '思想品德': '道德与法治',
  '品德与社会': '道德与法治',
  '信息技术': '信息科技',  // 2022 新课标统一为"信息科技"
  '通用技术': '信息科技',
  '体育与健康': '体育',
  '体育与健康课程': '体育'
};

/**
 * 🔧 新增：根据学段自动纠正学科名称
 * @param {string} subject - 原始学科名称
 * @param {string} stage - 学段（小学/初中/高中）
 * @returns {string} 纠正后的学科名称
 */
export const normalizeSubjectName = (subject, stage) => {
  if (!subject) return subject;
  
  // 🔧 统一学段值：兼容中英文（部分调用方传英文 'primary'/'middle'/'high'，部分传中文）
  const stageMap = { 'primary': '小学', 'middle': '初中', 'high': '高中' };
  const normalizedStage = stageMap[stage] || stage;
  
  // 先检查别名映射
  const aliasTarget = subjectAliasMap[subject];
  if (aliasTarget) {
    // 如果是"政治"且是高中，映射到"思想政治"（其他学段统一映射到"道德与法治"）
    if (subject === '政治' && normalizedStage === '高中') {
      return '思想政治';
    }
    return aliasTarget;
  }
  
  // 初中政治类 → 道德与法治
  if (['政治', '思想品德'].includes(subject) && normalizedStage === '初中') {
    return '道德与法治';
  }
  // 高中政治类 → 思想政治
  if (['政治', '思想品德'].includes(subject) && normalizedStage === '高中') {
    return '思想政治';
  }
  
  return subject;
};





