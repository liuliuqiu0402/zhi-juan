// ==================== 学科-年级-能力体系 ====================
export const subjectGradeSystem = {
  '小学': {
    '语文': { 
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'], 
      competency: '识字与写字、阅读、习作、口语交际、综合性学习' 
    },
    '数学': { 
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'], 
      competency: '数与代数、图形与几何、统计与概率、综合与实践' 
    },
    '英语': { 
      grades: ['三年级', '四年级', '五年级', '六年级'], 
      competency: '听、说、读、写、玩演视听' 
    },
    '科学': {
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
      competency: '科学探究、生命科学、物质科学、地球与宇宙科学、技术与工程'
    },
    // 🔧 新增：小学道德与法治（部分学校从一年级开始）
    '道德与法治': {
      grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
      competency: '道德修养、法治观念、健全人格、责任意识'
    },
    // 🔧 新增：小学信息科技（2022 课标新增学科）
    '信息科技': {
      grades: ['三年级', '四年级', '五年级', '六年级'],
      competency: '信息意识、计算思维、数字化学习与创新、信息社会责任'
    }
  },
  '初中': {
    '语文': { 
      grades: ['七年级', '八年级', '九年级'], 
      competency: '识字与写字、阅读、写作、口语交际、综合性学习、名著导读' 
    },
    '数学': { 
      grades: ['七年级', '八年级', '九年级'], 
      competency: '数与式、方程与不等式、函数、图形与几何、统计与概率、综合与实践' 
    },
    '英语': { 
      grades: ['七年级', '八年级', '九年级'], 
      competency: '语言技能、语言知识、情感态度、学习策略、文化意识' 
    },
    '物理': { 
      grades: ['八年级', '九年级'], 
      competency: '物质、运动和相互作用、能量、实验探究、科学思维' 
    },
    '化学': { 
      grades: ['九年级'], 
      competency: '科学探究、身边的化学物质、物质构成的奥秘、物质的化学变化、化学与社会发展' 
    },
    '生物': {
      grades: ['七年级', '八年级'],
      competency: '生命观念、科学探究、生物与环境、生物多样性'
    },
    '历史': {
      grades: ['七年级', '八年级', '九年级'],
      competency: '唯物史观、时空观念、史料实证、历史解释、家国情怀'
    },
    '地理': {
      grades: ['七年级', '八年级'],
      competency: '区域认知、综合思维、地理实践力、人地协调观'
    },
    '道德与法治': {
      grades: ['七年级', '八年级', '九年级'],
      competency: '政治认同、道德修养、法治观念、健全人格、责任意识'
    },
    // 🔧 新增：初中信息技术
    '信息技术': {
      grades: ['七年级', '八年级', '九年级'],
      competency: '信息意识、计算思维、数字化学习与创新、信息社会责任'
    }
  },
  '高中': {
    '语文': { 
      grades: ['高一', '高二', '高三'], 
      competency: '语言建构与运用、思维发展与提升、审美鉴赏与创造、文化传承与理解' 
    },
    '数学': { 
      grades: ['高一', '高二', '高三'], 
      competency: '预备知识、函数、几何与代数、概率与统计、数学建模与探究' 
    },
    '英语': { 
      grades: ['高一', '高二', '高三'], 
      competency: '语言能力、文化意识、思维品质、学习能力' 
    },
    '物理': { 
      grades: ['高一', '高二', '高三'], 
      competency: '物理观念、科学思维、科学探究、科学态度与责任' 
    },
    '化学': { 
      grades: ['高一', '高二', '高三'], 
      competency: '宏观辨识与微观探析、变化观念与平衡思想、证据推理与模型认知、科学探究与创新意识、科学精神与社会责任' 
    },
    '生物': {
      grades: ['高一', '高二', '高三'],
      competency: '生命观念、科学思维、科学探究、社会责任'
    },
    '历史': {
      grades: ['高一', '高二', '高三'],
      competency: '唯物史观、时空观念、史料实证、历史解释、家国情怀'
    },
    '地理': {
      grades: ['高一', '高二', '高三'],
      competency: '区域认知、综合思维、地理实践力、人地协调观'
    },
    '思想政治': {
      grades: ['高一', '高二', '高三'],
      competency: '政治认同、科学精神、法治意识、公共参与'
    },
    // 🔧 新增：高中信息技术
    '信息技术': {
      grades: ['高一', '高二', '高三'],
      competency: '信息意识、计算思维、数字化学习与创新、信息社会责任'
    }
  }
};

// ==================== 学段列表 ====================
export const stages = ['小学', '初中', '高中'];

// ==================== 学科列表 ====================
// 🔧 修复：移除"政治"（使用"道德与法治"/"思想政治"替代），保留别名供兼容
export const subjects = [
  '语文', '数学', '英语', '物理', '化学', '生物', 
  '历史', '地理', '道德与法治', '思想政治', '科学', '信息技术'
];

// 向后兼容：如果旧数据中有"政治"，自动映射
export const legacySubjectAliases = {
  '政治': '道德与法治',  // 默认初中
  '思想品德': '道德与法治'
};

// ==================== 题型库 ====================
export const questionTypeLibrary = {
  '小学': {
    '语文': ['看拼音写词语', '组词', '造句', '选词填空', '修改病句', '阅读理解', '古诗词默写', '作文'],
    '数学': ['口算', '填空', '判断', '选择', '计算', '应用题', '操作题'],
    '英语': ['听力', '选择', '填空', '连线', '阅读理解', '写作'],
    // 🔧 新增：小学科学题型
    '科学': ['选择', '填空', '判断', '连线', '实验探究', '简答', '观察记录'],
    // 🔧 新增：小学道德与法治题型
    '道德与法治': ['选择', '判断', '填空', '连线', '情境分析', '简答']
  },
  '初中': {
    '语文': ['基础知识', '文言文阅读', '现代文阅读', '古诗词鉴赏', '综合性学习', '写作'],
    '数学': ['选择', '填空', '计算', '证明', '作图', '应用题', '综合探究'],
    '英语': ['听力', '单项选择', '完形填空', '阅读理解', '任务型阅读', '书面表达'],
    '物理': ['选择', '填空', '作图', '实验探究', '计算'],
    '化学': ['选择', '填空', '实验探究', '计算', '推断'],
    '生物': ['选择', '填空', '识图', '实验探究', '简答'],
    '历史': ['选择', '填空', '材料解析', '简答', '论述'],
    '地理': ['选择', '填空', '读图分析', '简答', '综合题'],
    '道德与法治': ['选择', '简答', '材料分析', '实践探究'],
    // 🔧 新增：初中信息技术题型
    '信息技术': ['选择', '填空', '判断', '操作题', '简答', '综合应用']
  },
  '高中': {
    '语文': ['现代文阅读', '文言文阅读', '古代诗歌鉴赏', '名篇名句默写', '语言文字运用', '写作'],
    '数学': ['单选', '多选', '填空', '解答题'],
    '英语': ['听力', '阅读理解', '七选五', '完形填空', '语法填空', '书面表达'],
    '物理': ['单选', '多选', '实验', '计算'],
    '化学': ['单选', '不定项选择', '填空', '实验', '计算', '有机推断'],
    '生物': ['单选', '多选', '填空', '实验设计', '遗传分析'],
    '历史': ['选择', '材料解析', '论述'],
    '地理': ['选择', '综合题', '选做题'],
    '思想政治': ['选择', '简答', '辨析', '论述'],
    // 🔧 新增：高中信息技术题型
    '信息技术': ['选择', '填空', '判断', '操作题', '程序填空', '综合应用', '论述']
  }
};

// ==================== 资料类型模板 ====================
/**
 * @deprecated genTypeTemplates.instruction 和 .structure 字段已废弃。
 * 所有【】块级指令内容已迁移至 instructionLib.js，通过 getMatchingBlockInstructions 三维度智能匹配。
 * 仅保留 .name 字段用于 UI 显示。
 */
export const genTypeTemplates = {
  'exam': { 
    name: '📝 考卷', 
    structure: '一、选择题\n二、填空题\n三、阅读理解\n四、综合题\n五、作文', 
    instruction: '请严格按试卷结构命题，总分、题型、分值需符合配置。具体难度比例见下方学段适配要求。' 
  },
  'practice': { 
    name: '📚 课时练', 
    structure: '一、基础过关\n二、能力提升\n三、拓展探究', 
    instruction: '请遵循"基础→能力→拓展"的递进结构。题目紧扣本节知识点，具体难度比例见下方学段适配要求。' 
  },
  'summary': { 
    name: '📖 知识点总结', 
    structure: '一、学习目标\n二、核心知识清单\n三、易错点辨析\n四、典型例题精析\n五、重难点星级标注\n六、记忆方法/学习技巧', 
    instruction: '以知识要点整理为核心，通过表格、对比呈现易混点。每个知识点附巩固例题和记忆方法。具体结构根据学科自动调整。' 
  },
  'special': { 
    name: '🎯 专项突破', 
    structure: '一、方法指导\n二、典例剖析\n三、变式训练\n四、真题实战', 
    instruction: '围绕专项能力深度训练。方法指导精炼，典例典型，变式层层递进。' 
  },
  'errorbook': {
    name: '🔖 错题本',
    structure: '一、错题整理\n二、错误归因\n三、正确解法\n四、变式巩固',
    instruction: '整理典型错题，分析错误原因，给出正确解法，并附变式练习。'
  },
  'preview': {
    name: '🔍 课前预习',
    structure: '一、学习目标\n二、预习任务（阅读/标注/思考）\n三、预习检测（3-5道基础题）',
    instruction: '以引导学生自主预习为核心。学习目标明确具体，预习任务有可操作性，预习检测紧扣教材原文，题型以填空和简答为主。'
  },
  'dictation': {
    name: '✏️ 听写/默写',
    structure: '一、生字词听写\n二、重点词语默写\n三、句子/段落默写',
    instruction: '生成可直接打印使用的默写练习纸：练习区只显示拼音/释义提示+空白书写区（学生填写），标准答案统一放文末。语文：拼音提示+田字格留空+字典式生字信息；英语：中文释义提示+四线三格/单线留空。每题留足书写空间，练习区不出现答案。'
  },
  'reading': {
    name: '📖 阅读训练',
    structure: '一、短文阅读（1-2篇）\n二、阅读理解题（选择+简答）\n三、拓展思考',
    instruction: '以阅读理解能力训练为核心。选文贴近学段水平，题目涵盖：信息提取、词句理解、主旨概括、推理判断、评价鉴赏。题干精炼，选项有区分度。'
  },
  'review': {
    name: '📋 单元/期末复习',
    structure: '一、知识框架\n二、考点梳理\n三、典型题析\n四、易错聚焦\n五、综合自测',
    instruction: '以系统化复习为核心，融合知识梳理与自测训练。知识框架层次分明，考点覆盖完整，易错点辨析准确。结构根据学段自动调整。'
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
  { value: 'dictation', label: '✏️ 听写/默写', desc: '生字词/单词听默写' },
  { value: 'reading', label: '📖 阅读训练', desc: '阅读理解专项训练' },
  { value: 'review', label: '📋 单元/期末复习', desc: '系统化复习+自测' }
];

// ==================== 命题风格选项 ====================
export const styleOptions = [
  { value: 'traditional', label: '传统命题', desc: '题型清晰，设问直接' },
  { value: 'unified_context', label: '统一情境', desc: '整份资料一个核心主题' },
  { value: 'context_fusion', label: '情境融合', desc: '每个模块独立小情境' },
  { value: 'big_unit', label: '大单元教学', desc: '打破课时，大概念设计' },
  { value: 'project_based', label: '项目式学习', desc: '项目驱动，综合能力' }
];

// ==================== 命题风格指令 ====================
/**
 * @deprecated 命题风格指令已迁移至 instructionLib.js 的 '生成-命题风格' 类别。
 * 所有风格描述通过 getMatchingBlockInstructions({ category: '生成-命题风格', genType: propositionStyle }) 获取。
 */
export const styleInstructions = {
  'traditional': '题型结构清晰，设问直接，知识点考查明确，不设置复杂情境。',
  'unified_context': '整份资料围绕一个核心主题/故事情境展开，所有题目均在此情境下进行设问。',
  'context_fusion': '每个题型/模块设置一个独立的小情境，情境与题目高度融合，考查知识迁移能力。',
  'big_unit': '打破课时界限，围绕大概念/大任务进行整体设计，题目体现知识间的关联与递进。',
  'project_based': '以一个完整的项目任务为驱动，资料作为项目的一部分，考查学生在真实问题中的综合能力。'
};

// ==================== 范围选项 ====================
export const scopeOptions = [
  { value: 'default', label: '默认', desc: '按章节默认范围' },
  { value: 'midterm', label: '期中', desc: '期中考试范围' },
  { value: 'final', label: '期末', desc: '期末考试范围' },
  { value: 'topic', label: '专题', desc: '专题复习范围' }
];

// ==================== 粒度选项 ====================
export const granularityOptions = [
  { value: 'unit', label: '按单元', desc: '以单元为单位生成' },
  { value: 'lesson', label: '按课', desc: '以课时为单位生成' }
];

// ==================== 学科核心素养 ====================
export const subjectCoreCompetencies = {
  '语文': '文化自信、语言运用、思维能力、审美创造。命题应在真实语言运用情境中考查，体现中华优秀传统文化、革命文化、社会主义先进文化。',
  '数学': '数学眼光、数学思维、数学语言。命题应从真实情境中抽象出数学问题，考查逻辑推理与数学建模能力。',
  '英语': '语言能力、文化意识、思维品质、学习能力。命题应以语篇为载体，在真实交际情境中考查语言运用。',
  '物理': '物理观念、科学思维、科学探究、科学态度与责任。命题应从生活、科技、体育等情境中提炼物理问题。',
  '化学': '宏观辨识与微观探析、变化观念与平衡思想、证据推理与模型认知、科学探究与创新意识、科学精神与社会责任。',
  '生物': '生命观念、科学思维、科学探究、社会责任。',
  '历史': '唯物史观、时空观念、史料实证、历史解释、家国情怀。',
  '地理': '区域认知、综合思维、地理实践力、人地协调观。',
  // 🔧 新增
  '科学': '科学观念、科学思维、探究实践、态度责任。命题应从生活中的科学现象出发，考查观察、实验、推理能力。',
  '道德与法治': '政治认同、道德修养、法治观念、健全人格、责任意识。命题应在真实社会情境中考查学生的价值判断和行为选择。',
  '思想政治': '政治认同、科学精神、法治意识、公共参与。命题应结合时政热点和社会生活，考查学生的政治素养和思辨能力。',
  '信息技术': '信息意识、计算思维、数字化学习与创新、信息社会责任。命题应结合实际应用场景，考查学生运用信息技术解决问题的能力。'
};

// 🔧 新增：学科名称别名映射（处理"政治"/"道德与法治"/"思想政治"的混淆）
export const subjectAliasMap = {
  '政治': '道德与法治',  // 默认映射到初中名称（更常用）
  '思想品德': '道德与法治',
  '品德与社会': '道德与法治',
  '信息科技': '信息技术',
  '通用技术': '信息技术'
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

// ==================== 🔧 新增：学科-学段-认知层次规则库 ====================

/**
 * 各学段允许的认知层次
 * 小学：识记、理解、应用（禁止分析、评价、创造）
 * 初中：识记、理解、应用、分析（禁止评价、创造）
 * 高中：全部允许
 */
export const allowedCognitiveLevels = {
  '小学': ['识记', '理解', '应用'],
  '初中': ['识记', '理解', '应用', '分析'],
  '高中': ['识记', '理解', '应用', '分析', '评价', '创造']
};

/**
 * 各学段学科的知识点认知层次修正规则
 * 格式：{ 知识点关键词: { correctLevel: '正确层次', commonMistake: 'AI常见错误层次' } }
 */
export const knowledgeLevelCorrections = {
  '小学': {
    '数学': {
      // 小学课标要求：方程只到"理解"层次
      '方程': { correctLevel: '理解', commonMistake: '应用' },
      '简易方程': { correctLevel: '理解', commonMistake: '应用' },
      '解方程': { correctLevel: '应用', commonMistake: '分析' },
      // 负数在小学仅"识记"
      '负数': { correctLevel: '识记', commonMistake: '理解' },
      '正负数': { correctLevel: '识记', commonMistake: '理解' },
      // 几何证明小学不作要求
      '证明': { correctLevel: '理解', commonMistake: '应用' },
      '几何证明': { correctLevel: '理解', commonMistake: '应用' },
      // 概率仅"了解"
      '概率': { correctLevel: '识记', commonMistake: '理解' },
      '可能性': { correctLevel: '识记', commonMistake: '应用' },
      // 统计在小学仅"了解"和"简单应用"
      '统计': { correctLevel: '理解', commonMistake: '分析' },
      '统计图': { correctLevel: '应用', commonMistake: '分析' },
      // 代数初步
      '代数': { correctLevel: '识记', commonMistake: '理解' },
      '代数式': { correctLevel: '识记', commonMistake: '应用' },
      '用字母表示数': { correctLevel: '理解', commonMistake: '应用' }
    },
    '语文': {
      '议论文': { correctLevel: '识记', commonMistake: '应用' },
      '修辞手法': { correctLevel: '理解', commonMistake: '分析' },
      '表现手法': { correctLevel: '理解', commonMistake: '分析' },
      '文章结构': { correctLevel: '理解', commonMistake: '分析' },
      '写作手法': { correctLevel: '理解', commonMistake: '分析' }
    },
    '英语': {
      '语法': { correctLevel: '理解', commonMistake: '应用' },
      '时态': { correctLevel: '理解', commonMistake: '应用' },
      '从句': { correctLevel: '识记', commonMistake: '应用' },
      '被动语态': { correctLevel: '识记', commonMistake: '应用' }
    },
    '科学': {
      '实验': { correctLevel: '理解', commonMistake: '应用' },
      '探究': { correctLevel: '理解', commonMistake: '分析' },
      '设计实验': { correctLevel: '理解', commonMistake: '应用' }
    }
  },
  '初中': {
    '数学': {
      '函数': { correctLevel: '理解', commonMistake: '分析' },
      '二次函数': { correctLevel: '应用', commonMistake: '分析' },
      '三角函数': { correctLevel: '理解', commonMistake: '应用' },
      '导数': { correctLevel: '识记', commonMistake: '理解' },
      '微积分': { correctLevel: '识记', commonMistake: '理解' },
      '对数': { correctLevel: '识记', commonMistake: '理解' },
      '对数函数': { correctLevel: '识记', commonMistake: '应用' },
      '复数': { correctLevel: '识记', commonMistake: '理解' },
      '立体几何': { correctLevel: '理解', commonMistake: '应用' },
      '概率分布': { correctLevel: '识记', commonMistake: '理解' },
      '证明': { correctLevel: '应用', commonMistake: '分析' },
      '几何证明': { correctLevel: '应用', commonMistake: '分析' }
    },
    '物理': {
      '量子': { correctLevel: '识记', commonMistake: '理解' },
      '量子力学': { correctLevel: '识记', commonMistake: '理解' },
      '相对论': { correctLevel: '识记', commonMistake: '理解' },
      '核物理': { correctLevel: '识记', commonMistake: '理解' },
      '微积分': { correctLevel: '识记', commonMistake: '应用' }
    },
    '化学': {
      '有机化学': { correctLevel: '理解', commonMistake: '应用' },
      '物质结构': { correctLevel: '理解', commonMistake: '分析' }
    }
  },
  '高中': {
    // 高中学段全部认知层次允许，仅修正明显错误
    '数学': {
      '识记': { correctLevel: '识记', commonMistake: '理解' },
      '了解': { correctLevel: '识记', commonMistake: '理解' }
    }
  }
};

/**
 * 🔧 新增：获取某学段某学科的知识点认知层次修正
 * @param {string} stage - 学段（小学/初中/高中）
 * @param {string} subject - 学科
 * @param {string} knowledgePointName - 知识点名称
 * @param {string} aiLevel - AI 标注的认知层次
 * @returns {string} 修正后的认知层次
 */
export const correctCognitiveLevel = (stage, subject, knowledgePointName, aiLevel) => {
  if (!aiLevel || !stage || !subject || !knowledgePointName) return aiLevel;

  // 1. 检查学段禁止的认知层次
  const allowed = allowedCognitiveLevels[stage];
  if (allowed && !allowed.includes(aiLevel)) {
    // 降级到该学段允许的最高层次
    const fallback = allowed[allowed.length - 1];
    console.log(`🔧 认知层次修正：${knowledgePointName} 的 "${aiLevel}" 在${stage}不允许，降级为 "${fallback}"`);
    return fallback;
  }

  // 2. 检查具体知识点的修正规则
  const stageCorrections = knowledgeLevelCorrections[stage]?.[subject];
  if (stageCorrections) {
    // 精确匹配
    if (stageCorrections[knowledgePointName] && aiLevel === stageCorrections[knowledgePointName].commonMistake) {
      console.log(`🔧 认知层次修正：${knowledgePointName} 从 "${aiLevel}" 修正为 "${stageCorrections[knowledgePointName].correctLevel}"`);
      return stageCorrections[knowledgePointName].correctLevel;
    }
    
    // 模糊匹配：知识点名称包含规则关键词
    for (const [key, rule] of Object.entries(stageCorrections)) {
      if (knowledgePointName.includes(key) && aiLevel === rule.commonMistake) {
        console.log(`🔧 认知层次模糊修正：${knowledgePointName} 匹配规则 "${key}"，从 "${aiLevel}" 修正为 "${rule.correctLevel}"`);
        return rule.correctLevel;
      }
    }
  }

  return aiLevel;
};

/**
 * 🔧 新增：批量校验知识点层级的合法性
 * @param {Array} knowledgePoints - 知识点数组 [{name, cognitiveLevel, ...}]
 * @param {string} stage - 学段
 * @param {string} subject - 学科
 * @returns {object} { corrected: Array, fixes: Array }
 */
export const validateKnowledgeLevels = (knowledgePoints, stage, subject) => {
  if (!knowledgePoints || !Array.isArray(knowledgePoints)) return { corrected: knowledgePoints, fixes: [] };
  
  const fixes = [];
  const corrected = knowledgePoints.map(kp => {
    if (!kp.cognitiveLevel && !kp.level) return kp;
    
    const aiLevel = kp.cognitiveLevel || kp.level;
    const name = kp.name || kp.title || '';
    const correctedLevel = correctCognitiveLevel(stage, subject, name, aiLevel);
    
    if (correctedLevel !== aiLevel) {
      fixes.push({ name, original: aiLevel, corrected: correctedLevel });
      return { ...kp, cognitiveLevel: correctedLevel, level: correctedLevel };
    }
    
    return kp;
  });
  
  if (fixes.length > 0) {
    console.log(`📋 认知层次批量校验完成：${fixes.length}处修正`);
  }
  
  return { corrected, fixes };
};


// ==================== 🔧 新增：超纲检测规则库 ====================

/**
 * 各学段学科的知识边界定义
 * 格式：{ 学段: { 学科: { maxTopics: ['该学段最高知识点'], forbiddenMethods: ['禁止的解题方法'] } } }
 */
export const gradeKnowledgeBoundary = {
  '小学': {
    '数学': {
      allowedTopics: [
        '整数四则运算', '小数加减乘除', '分数加减乘除', '简易方程',
        '平面图形周长面积', '立体图形体积表面积', '简单统计图表',
        '正比例反比例', '用字母表示数', '简单概率'
      ],
      forbiddenTopics: [
        // 初中内容
        '有理数混合运算', '整式加减乘除', '因式分解', '分式方程',
        '一元二次方程', '二元一次方程组', '不等式组',
        '函数概念', '一次函数', '反比例函数',
        '三角形全等证明', '相似三角形', '勾股定理证明',
        '圆的性质证明', '三角函数', '统计与概率深入'
      ],
      forbiddenMethods: [
        '列方程解应用题（超过一步的方程）',
        '几何证明（小学只需计算，不需证明）',
        '概率计算（小学只需描述"可能""一定""不可能"）'
      ],
      // 边界模糊区域——需要上下文判断
      fuzzyBoundary: {
        '方程': '仅限形如 x+a=b, ax=b, ax+b=c 的一步简易方程',
        '负数': '仅限了解负数的存在（温度计、海拔等情境），不涉及运算',
        '代数': '仅限用字母表示数和简单代入求值',
        '统计': '仅限条形图、折线图、扇形图的阅读和简单绘制',
        '概率': '仅限"可能""一定""不可能"的定性描述'
      }
    },
    '语文': {
      forbiddenTopics: [
        '文言文翻译（小学仅需诵读，不需逐字翻译）',
        '议论文写作',
        '初中课标推荐的古诗文篇目',
        '语法术语（如"状语""补语"）',
        '表现手法分析（如"欲扬先抑""托物言志"）'
      ],
      fuzzyBoundary: {
        '修辞手法': '仅限于比喻、拟人、排比、夸张、设问、反问六种',
        '文言文': '仅限课标推荐的75篇古诗文中的篇目',
        '写作': '以记叙文为主，不要求议论文和说明文'
      }
    },
    '英语': {
      forbiddenTopics: [
        '定语从句', '状语从句', '被动语态（一般现在时除外）',
        '虚拟语气', '非谓语动词', '过去完成时', '将来进行时'
      ],
      fuzzyBoundary: {
        '时态': '仅限于一般现在时、现在进行时、一般过去时、一般将来时',
        '词汇量': '课标要求600-700词',
        '写作': '限于30-50词的简单段落'
      }
    },
    '科学': {
      forbiddenTopics: [
        '化学方程式', '原子结构', '细胞分裂', '遗传规律',
        '力学计算', '电路计算'
      ],
      fuzzyBoundary: {
        '实验': '仅限简单观察和记录，不涉及变量控制',
        '探究': '限于教师指导下的简单探究'
      }
    }
  },
  '初中': {
    '数学': {
      forbiddenTopics: [
        // 高中内容
        '导数', '积分', '对数函数', '指数函数', '幂函数',
        '三角函数图像与性质', '解三角形（正弦定理余弦定理）',
        '立体几何（空间向量）', '排列组合', '二项式定理',
        '概率分布', '复数', '数学归纳法'
      ],
      forbiddenMethods: [
        '导数求极值',
        '对数运算（初中仅涉及科学记数法中的10的幂次）',
        '向量法解几何题'
      ],
      fuzzyBoundary: {
        '函数': '仅限一次函数、二次函数、反比例函数',
        '概率': '仅限列举法求概率，不涉及乘法原理和排列组合',
        '统计': '仅限平均数、中位数、众数、方差的基本计算'
      }
    },
    '物理': {
      forbiddenTopics: [
        '量子力学', '相对论', '核物理', '电磁感应（高中内容）',
        '光的波粒二象性', '原子能级'
      ],
      fuzzyBoundary: {
        '力学': '仅限牛顿三大定律基础应用，不涉及连接体、传送带等复杂模型',
        '电学': '仅限欧姆定律、串并联电路基础'
      }
    },
    '化学': {
      forbiddenTopics: [
        '有机化学（高中内容）', '化学反应速率与平衡的定量计算',
        '电离平衡', '盐类水解', '电化学'
      ],
      fuzzyBoundary: {
        '化学方程式计算': '仅限一步计算',
        '物质结构': '仅限原子结构示意图，不涉及电子排布规律'
      }
    }
  },
  '高中': {
    // 高中允许的内容范围较广，主要检测是否超出大学范围
    '数学': {
      forbiddenTopics: [
        '微积分（仅限导数基础，不涉及积分）',
        '线性代数', '概率论与数理统计', '复变函数'
      ],
      fuzzyBoundary: {
        '导数': '仅限多项式函数的导数计算和简单应用'
      }
    },
    '物理': {
      forbiddenTopics: [
        '量子力学计算', '相对论计算', '麦克斯韦方程组'
      ],
      fuzzyBoundary: {}
    }
  }
};

/**
 * 🔧 新增：检查内容是否超出学段知识边界
 * @param {string} content - 要检查的内容
 * @param {string} subject - 学科
 * @param {string} stage - 学段（小学/初中/高中）
 * @param {string} grade - 年级
 * @returns {object} { hasViolations, violations, fuzzyItems }
 */
export const checkKnowledgeBoundary = (content, subject, stage, grade) => {
  if (!content || !subject || !stage) {
    return { hasViolations: false, violations: [], fuzzyItems: [] };
  }

  const boundary = gradeKnowledgeBoundary[stage]?.[subject];
  if (!boundary) {
    return { hasViolations: false, violations: [], fuzzyItems: [] };
  }

  const violations = [];
  const fuzzyItems = [];

  const isInContext = (keyword, context) => {
    const safeContexts = ['阅读材料', '知识拓展', '你知道吗', '课外阅读', '拓展阅读', '小资料'];
    const idx = context.indexOf(keyword);
    if (idx > 0) {
      const surrounding = context.substring(Math.max(0, idx - 50), idx + keyword.length + 50);
      if (safeContexts.some(function(sc) { return surrounding.includes(sc); })) {
        return true;
      }
    }
    return false;
  };

  // 1. 检查明确禁止的知识点
  if (boundary.forbiddenTopics) {
    for (const forbiddenTopic of boundary.forbiddenTopics) {
      if (content.includes(forbiddenTopic)) {
        if (isInContext(forbiddenTopic, content)) {
          fuzzyItems.push({
            topic: forbiddenTopic,
            limit: '拓展阅读材料中提及，非考查内容',
            severity: 'info',
            message: '"' + forbiddenTopic + '"出现在拓展材料中，若为阅读材料可接受'
          });
        } else {
          violations.push({
            type: 'forbidden_topic',
            keyword: forbiddenTopic,
            severity: 'error',
            message: '明确超纲：出现了' + stage + subject + '不应涉及的"' + forbiddenTopic + '"'
          });
        }
      }
    }
  }

  // 2. 检查禁止的解题方法
  if (boundary.forbiddenMethods) {
    for (const forbiddenMethod of boundary.forbiddenMethods) {
      // 方法检测较难精确匹配，使用关键词
      const methodKeywords = forbiddenMethod.split('（')[0].trim();
      if (content.includes(methodKeywords)) {
        violations.push({
          type: 'forbidden_method',
          keyword: methodKeywords,
          severity: 'warning',
          message: `可能使用超纲方法：${forbiddenMethod}`
        });
      }
    }
  }

  // 3. 检查模糊边界区域——标记为需要人工判断
  if (boundary.fuzzyBoundary) {
    for (const [topic, limit] of Object.entries(boundary.fuzzyBoundary)) {
      if (content.includes(topic)) {
        // 检查是否在限定范围内
        let beyondLimit = false;
        if (typeof limit === 'string' && limit.includes('仅限')) {
          // 简单检查：如果内容包含了限定之外的特征词
          const allowedFeatures = limit.match(/仅限(.+)/)?.[1] || '';
          // 这里做简单判断，更精确的需要AI
          beyondLimit = content.length > 200 && allowedFeatures.length < 10;
        }
        
        fuzzyItems.push({
          topic,
          limit,
          severity: beyondLimit ? 'warning' : 'info',
          message: beyondLimit 
            ? `"${topic}"可能超出${stage}范围：${limit}` 
            : `"${topic}"在${stage}的限定范围内：${limit}`
        });
      }
    }
  }

  return {
    hasViolations: violations.length > 0,
    violations,
    fuzzyItems,
    summary: {
      errorCount: violations.filter(v => v.severity === 'error').length,
      warningCount: violations.filter(v => v.severity === 'warning').length,
      fuzzyCount: fuzzyItems.filter(f => f.severity === 'warning').length
    }
  };
};


// ==================== 🔧 新增：学科术语规范库 ====================

/**
 * 学科术语规范
 * 格式：{ 标准术语: [不规范的别名列表] }
 * 命题生成时应使用标准术语，禁止使用别名
 */
export const subjectTerminology = {
  '数学': {
    // 代数
    '一次函数': ['线性函数', '直线函数'],
    '二次函数': ['抛物线函数', '平方函数'],
    '反比例函数': ['倒数函数', '双曲线函数'],
    '正比例函数': ['正比函数'],
    '一元一次方程': ['一次方程', '简单方程'],
    '一元二次方程': ['二次方程'],
    '二元一次方程组': ['联立方程组', '线性方程组'],
    '不等式': ['不等关系'],
    // 几何
    '勾股定理': ['毕达哥拉斯定理', '直角三角形定理'],
    '相似三角形': ['比例三角形', '相似形'],
    '全等三角形': ['完全相等三角形'],
    '平行四边形': ['平行四边'],
    '圆周角': ['圆弧角'],
    '切线': ['切线', '接触线'],
    // 统计概率
    '平均数': ['平均值', '均值'],
    '中位数': ['中值', '中间数'],
    '众数': ['最常见值', '多数'],
    '方差': ['离散度', '偏差平方'],
    '标准差': ['均方差'],
    '概率': ['可能性', '几率', '或然率'],
    // 通用
    '命题': ['题目', '试题', '考题'],
    '解答': ['求解', '计算', '解题'],
    '证明': ['求证', '论证'],
    '已知': ['给出', '设定', '假设'],
    '求': ['求解', '计算', '试求']
  },
  '物理': {
    '质量': ['重量（在物理语境下应用"质量"）'],
    '重力': ['重量', '地球引力'],
    '压强': ['压力强度'],
    '密度': ['比重'],
    '速度': ['速率（物理中速度含方向）'],
    '加速度': ['速度变化率'],
    '力': ['作用力'],
    '功': ['做功', '机械功'],
    '功率': ['做功速率'],
    '电流': ['电强度'],
    '电压': ['电势差', '电位差'],
    '电阻': ['阻抗'],
    '欧姆定律': ['欧姆定理']
  },
  '化学': {
    '化学方程式': ['化学反应式', '化学式'],
    '化合价': ['原子价', '氧化数'],
    '相对原子质量': ['原子量'],
    '相对分子质量': ['分子量'],
    '溶液': ['液体混合物'],
    '溶质': ['被溶解物'],
    '溶剂': ['溶解介质'],
    'pH值': ['酸碱度'],
    '酸碱性': ['酸碱性质'],
    '置换反应': ['取代反应', '置换'],
    '复分解反应': ['双分解', '复分解'],
    '催化剂': ['触媒']
  },
  '语文': {
    '比喻': ['打比方', '譬喻'],
    '拟人': ['人格化', '拟人化'],
    '排比': ['排比句', '排比修辞'],
    '夸张': ['夸大', '夸张手法'],
    '设问': ['自问自答'],
    '反问': ['反诘', '反问问'],
    '对偶': ['对仗', '对子'],
    '借代': ['代称', '借指'],
    '记叙文': ['记叙', '叙述文'],
    '议论文': ['论说文', '议论'],
    '说明文': ['说明', '解释文'],
    '中心思想': ['主题思想', '主旨'],
    '写作手法': ['表现手法', '表达技巧'],
    '修辞手法': ['修辞方法', '修辞技巧']
  },
  '英语': {
    '一般现在时': ['简单现在时', '现在时态'],
    '一般过去时': ['简单过去时', '过去时态'],
    '现在完成时': ['完成时', '完成时态'],
    '定语从句': ['关系从句', '形容词从句'],
    '主语': ['主词'],
    '谓语': ['谓词'],
    '宾语': ['受词'],
    '状语': ['副词短语'],
    '被动语态': ['被动式', '被动'],
    '主动语态': ['主动式', '主动']
  }
};

/**
 * 🔧 新增：将内容中的不规范术语替换为标准术语
 * @param {string} content - 原始内容
 * @param {string} subject - 学科名称
 * @returns {object} { normalized: string, fixes: Array }
 */
export const normalizeTerminology = (content, subject) => {
  if (!content || !subject) {
    return { normalized: content, fixes: [] };
  }

  const terminology = subjectTerminology[subject];
  if (!terminology) {
    return { normalized: content, fixes: [] };
  }

  let normalized = content;
  const fixes = [];

  for (const [standardTerm, aliases] of Object.entries(terminology)) {
    for (const alias of aliases) {
      // 跳过包含括号的说明性别名
      if (alias.includes('（') || alias.includes('）')) continue;
      
      if (normalized.includes(alias)) {
        // 使用全局替换
        const regex = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const beforeCount = (normalized.match(regex) || []).length;
        normalized = normalized.replace(regex, standardTerm);
        const afterCount = (normalized.match(new RegExp(standardTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        
        if (beforeCount > 0) {
          fixes.push({
            original: alias,
            corrected: standardTerm,
            count: beforeCount
          });
        }
      }
    }
  }

  if (fixes.length > 0) {
    console.log(`📝 术语规范化：${fixes.length}种术语被标准化，共${fixes.reduce((s, f) => s + f.count, 0)}处替换`);
  }

  return { normalized, fixes };
};

/**
 * 🔧 新增：获取学科的术语提示字符串（用于注入到生成指令中）
 * @param {string} subject - 学科名称
 * @returns {string} 术语提示文本
 */
export const getTerminologyHint = (subject, stage) => {
  const terminology = subjectTerminology[subject];
  if (!terminology) return '';

  let keyTerms = Object.keys(terminology);
  // 🔧 小学只保留基础术语，去掉对偶/借代/议论文/说明文等中学内容
  if (stage === 'primary' && subject === '语文') {
    keyTerms = keyTerms.filter(t => 
      !['对偶', '借代', '议论文', '说明文', '中心思想', '写作手法'].includes(t)
    );
  }
  keyTerms = keyTerms.slice(0, 15);
  if (keyTerms.length === 0) return '';

  return `【术语规范】请使用标准学科术语，避免使用不规范表述。以下为该学科核心标准术语，请在命题中保持一致：${keyTerms.join('、')}。`;
};