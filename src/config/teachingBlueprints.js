/**
 * 教辅结构蓝本库（Teaching Blueprints）—— 与 examPaperBlueprints 对称
 * ============================================================
 * 🔴 定位：8 类教辅资料（课时练/专项突破/课前预习/阅读训练/知识总结/默写积累/错题本/复习资料）的
 *    "栏目框架 + 题量/字数底线 + 时长适配"确定性来源，按 类型 × 学段 三维度注入。
 *
 * 与指令库分工（同义表述只留一处）：
 *   - 指令库模板：角色、任务定位、质量要求（防机械重复/不孤立/图文一致等）、输出格式
 *   - 本库：栏目框架、题量/字数底线、时长适配、关键元素——模板不再重复具体数字与栏目明细
 *   - 规则库：生成后静默质检（教辅题量充足性、禁标分值等 guard）
 *
 * 题量数字与 typeDistribution.js（UI 题型自动填充）对齐，保证界面展示与生成注入同源。
 * 生成端 buildTeachingInjection 按 学段×类型 注入，与 exam 的 buildBlueprintInjection 对称。
 * ============================================================
 */

/** 学段显示名 */
export const TEACHING_STAGE_NAMES = {
  primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段', middle: '初中', high: '高中',
};

/**
 * 教辅结构蓝本：类型 × 学段参数
 * sections: 栏目框架（生成注入用，非固定分值）
 * stages:   各学段参数 { volume 题量/篇幅下限（程序护栏校验参考，不注入 prompt）, note 学段要求 }
 *           —— 教辅无考试时限，不设时长；题量/篇幅由 teaching-volume-guard 生成后静默校验，不注入 AI 限定
 */
export const TEACHING_BLUEPRINTS = {
  // ══════════════ 课时练 ══════════════
  practice: {
    label: '课时练',
    sections: [
      { name: '基础建构任务', note: '覆盖本课时全部核心知识点，基础内容为主' },
      { name: '探究进阶任务', note: '变式与综合运用，换情境、换角度、换设问，考查迁移能力' },
      { name: '迁移创新任务', note: '开放性/实践性任务，联系真实生活' },
    ],
    stages: {
      primary_low: { volume: '6-9题', note: '以认读、口答、圈画等操作型任务为主，情境具体直观，图文并茂' },
      primary_mid: { volume: '8-12题', note: '任务以真实生活情境为主，书写与表达适度兼顾' },
      primary_high: { volume: '10-15题', note: '增加开放性任务，鼓励多角度思考与表达' },
      middle: { volume: '8-12题', note: '任务含过程性要求，步骤完整、书写规范' },
      high: { volume: '10-15题', note: '任务指向综合运用，设问有层次、可思辨' },
    },
  },

  // ══════════════ 专项突破 ══════════════
  special: {
    label: '专项突破',
    sections: [
      { name: '分板块组织', note: '按考点分 2-4 个板块（每个板块一个考点），板块内按基础→提升→拓展分层' },
      { name: '每板块配解析', note: '每板块适量题目并附解析，聚焦本单元薄弱点' },
    ],
    stages: {
      primary_low: { volume: '每类3-4题，2-3类', note: '板块短小，情境游戏化，便于口头作答' },
      primary_mid: { volume: '每类3-5题，2-4类', note: '板块围绕本单元内容，题目以情境为载体' },
      primary_high: { volume: '每类4-5题，3-4类', note: '板块含综合变式，设问开放' },
      middle: { volume: '每类3-5题，3-4类', note: '板块含过程性设问，注重步骤与推理' },
      high: { volume: '每类4-6题，3-5类', note: '板块设问有区分度，指向综合运用' },
    },
  },

  // ══════════════ 课前预习 ══════════════
  preview: {
    label: '课前预习',
    sections: [
      { name: '学习目标', note: '1-2 条，明确本课时要达成的目标' },
      { name: '预习任务', note: '问题驱动（圈画/概括/查阅/尝试），可操作可检查，覆盖本课时全部新知识点' },
      { name: '预习检测', note: '2-4 道自检题，检测预习效果' },
      { name: '我的疑问', note: '必设栏目，供学生记录预习中不懂的问题' },
    ],
    stages: {
      primary_low: { volume: '检测2-3题', note: '以圈画、朗读、观察等操作型任务为主' },
      primary_mid: { volume: '检测3-4题', note: '任务含尝试作答与查资料，检测量适中' },
      primary_high: { volume: '检测4-5题', note: '任务含自主梳理，鼓励带着疑问进课堂' },
      middle: { volume: '检测4-5题', note: '任务含自主查阅与概括，指向重难点' },
      high: { volume: '检测4-6题', note: '任务指向重难点与前置知识衔接' },
    },
  },

  // ══════════════ 阅读训练 ══════════════
  reading: {
    label: '阅读训练',
    sections: [
      { name: '原创选文', note: '原创短文（不复制课文/网络文章），课外选文主题须与单元相关，短文完整呈现（不截断），选文末标注出处' },
      { name: '分层设题', note: '每篇配 3-5 道分层题，设问由浅入深，题目不可直接在原文找到原句答案' },
    ],
    stages: {
      primary_low: { volume: '2篇/80-150字/每篇3-4题', note: '选文短小（儿歌、童话、故事），设问口语化' },
      primary_mid: { volume: '2篇/150-300字/每篇3-5题', note: '选文篇幅适中，设问围绕内容大意与细节' },
      primary_high: { volume: '2-3篇/300-500字/每篇4-6题', note: '选文类型多样，设问能引导抓住要点' },
      middle: { volume: '2-3篇/500-900字/每篇4-6题', note: '设问能引导区分观点与事实，含非连续性文本' },
      high: { volume: '3篇/900-1500字/每篇5-7题', note: '设问可引导多角度理解与思辨，文本类型多样' },
    },
  },

  // ══════════════ 知识总结 ══════════════
  summary: {
    label: '知识总结',
    sections: [
      { name: '知识框架', note: '结构化呈现（导图/表格/对比优先），覆盖本单元全部知识点' },
      { name: '重点梳理', note: '逐点梳理并标注教材出处，重点内容突出' },
      { name: '易错辨析', note: '列出 2-3 个易错点并辨析' },
      { name: '典型例题', note: '2-3 道典型例题（含解析）' },
    ],
    stages: {
      primary_low: { volume: '正文300-500字', note: '多用图表与图示，图文并茂' },
      primary_mid: { volume: '正文500-800字', note: '知识框架以表格对比为主，条目清晰' },
      primary_high: { volume: '正文800-1200字', note: '含易错辨析，结构清晰' },
      middle: { volume: '正文800-1200字', note: '含规律与方法归纳' },
      high: { volume: '正文1200-1800字', note: '含知识网络梳理，呈现结构化' },
    },
  },

  // ══════════════ 默写积累 ══════════════
  dictation: {
    label: '默写积累',
    sections: [
      { name: '基础默写', note: '本课时/单元要求掌握的基础内容，置于语境或情境中呈现（不孤立罗列）' },
      { name: '积累内容', note: '严格对应教材要求，覆盖全部要求掌握的积累内容' },
      { name: '书写呈现', note: '书写载体按学科与学段规范呈现，由系统渲染' },
    ],
    stages: {
      primary_low: { volume: '基础内容4-8条', note: '以本课时/单元核心内容为主，量小而精' },
      primary_mid: { volume: '基础内容8-12条', note: '内容在语境或情境中呈现，覆盖单元要求' },
      primary_high: { volume: '基础内容12-18条', note: '覆盖单元全部要求掌握的内容，含易错点' },
      middle: { volume: '基础内容12-16条', note: '内容在情境中考查，含易错辨析' },
      high: { volume: '基础内容15-20条', note: '覆盖要求内容，含综合情境考查' },
    },
  },

  // ══════════════ 错题本 ══════════════
  errorbook: {
    label: '错题本',
    sections: [
      { name: '原题重现', note: '完整重现原题（可精简题干，保留关键信息）' },
      { name: '错误归因', note: '具体到知识点或思维环节，归因明确' },
      { name: '正确解法', note: '分步完整解答' },
      { name: '同类变式', note: '每题 1 道变式（换情境、换设问角度，不复刻原题思路）' },
      { name: '解题策略', note: '归纳本类题通用策略' },
    ],
    stages: {
      primary_low: { volume: '4-6题', note: '按知识点或错因分类，每题结构完整' },
      primary_mid: { volume: '5-8题', note: '归因明确，变式贴近原题' },
      primary_high: { volume: '6-10题', note: '归因具体，变式换情境换设问' },
      middle: { volume: '6-10题', note: '归因具体到知识模块，变式换角度' },
      high: { volume: '8-12题', note: '含方法性归因与迁移策略，变式有区分度' },
    },
  },

  // ══════════════ 复习资料 ══════════════
  review: {
    label: '复习资料',
    sections: [
      { name: '知识框架', note: '覆盖本单元全部知识点的结构图/表格' },
      { name: '考点梳理', note: '按考点逐条梳理（标注教材出处），重点难点突出' },
      { name: '典型题析', note: '2-3 道典型题（含解题思路分析）' },
      { name: '易错聚焦', note: '3-5 个易错点辨析' },
      { name: '综合自测', note: '分层自测（基础/提高），按考点分布，覆盖本单元全部知识点' },
    ],
    stages: {
      primary_low: { volume: '自测8-12题', note: '框架简明，自测题情境化、图文并茂' },
      primary_mid: { volume: '自测12-18题', note: '梳理完整，自测覆盖本单元内容' },
      primary_high: { volume: '自测15-25题', note: '含开放与思辨设问' },
      middle: { volume: '自测12-20题', note: '梳理成体系，自测含过程性考查' },
      high: { volume: '自测15-25题', note: '梳理成网络，自测指向综合运用' },
    },
  },
};

/**
 * 学科专属教辅结构（三维度：学科×类型；学段参数回退通用默认）
 * ——栏目框架与内容导向按学科定制（新课标口径、不局限、无题量）；
 *    学科未定制时回退 TEACHING_BLUEPRINTS 通用默认（逐科补齐，工具库展示缺口）。
 */
export const TEACHING_SUBJECT_BLUEPRINTS = {
  '语文': {
    practice: {
      label: '课时练',
      sections: [
        { name: '基础建构任务', note: '覆盖本课时核心知识点，在语境中考查' },
        { name: '探究进阶任务', note: '语段阅读与表达运用，变式设问，考查知识迁移' },
        { name: '迁移创新任务', note: '生活化口语表达或写话，联系本单元主题' },
      ],
    },
    special: {
      label: '专项突破',
      sections: [
        { name: '分板块组织', note: '按本单元内容分 2-4 个板块，板块内由易到难' },
        { name: '每板块配解析', note: '每板块适量题目并附解析，聚焦本单元薄弱点' },
      ],
    },
    preview: {
      label: '课前预习',
      sections: [
        { name: '学习目标', note: '1-2 条，明确本课字词积累与朗读/理解目标' },
        { name: '预习任务', note: '问题驱动（读课文、圈画生字词、尝试朗读、质疑），可操作可检查，覆盖本课全部新知' },
        { name: '预习检测', note: '2-4 道自检题，检测预习效果' },
        { name: '我的疑问', note: '必设栏目，供学生记录预习中不懂的问题' },
      ],
    },
    reading: {
      label: '阅读训练',
      sections: [
        { name: '原创选文', note: '原创短文（不复制课文），文体适学段（低段儿歌童话、中段记叙文、高段散文说明文），主题与本单元相关，短文完整呈现并标注出处' },
        { name: '分层设题', note: '设问由浅入深、有层次，考查理解与感悟' },
      ],
    },
    summary: {
      label: '知识总结',
      sections: [
        { name: '知识框架', note: '结构化呈现本单元字词、句段、篇章知识（导图/表格/对比优先）' },
        { name: '重点梳理', note: '逐点梳理并标注教材出处，重点内容突出' },
        { name: '易错辨析', note: '本单元易错字形/读音/词义辨析' },
        { name: '典型例题', note: '适量典型例题（含解析）' },
      ],
    },
    dictation: {
      label: '默写积累',
      sections: [
        { name: '看拼音写词语', note: '拼音词嵌入语境句（非孤立罗列）' },
        { name: '积累默写', note: '本单元要求掌握的字词、成语、名句、篇目，严格对应教材要求' },
        { name: '书写格', note: '按学段：1-2 年级田字格、3 年级起方格/横线' },
      ],
    },
    errorbook: {
      label: '错题本',
      sections: [
        { name: '原题重现', note: '完整重现原题（可精简题干，保留关键信息）' },
        { name: '错误归因', note: '具体到知识点或思维环节，归因明确' },
        { name: '正确解法', note: '分步完整解答' },
        { name: '同类变式', note: '1 道变式（换情境、换设问角度）' },
        { name: '解题策略', note: '归纳本类题通用策略' },
      ],
    },
    review: {
      label: '复习资料',
      sections: [
        { name: '知识框架', note: '本单元字词句段篇知识结构图/表格' },
        { name: '考点梳理', note: '按知识点逐条梳理并标注教材出处，重点难点突出' },
        { name: '典型题析', note: '适量典型题（含解题思路分析）' },
        { name: '易错聚焦', note: '本单元易错点辨析' },
        { name: '综合自测', note: '分层自测（基础/提高），覆盖本单元知识点' },
      ],
    },
  },
  '数学': {
    practice: {
      label: '课时练',
      sections: [
        { name: '基础建构任务', note: '覆盖本课时核心知识点，在情境中考查' },
        { name: '探究进阶任务', note: '变式与综合运用，换情境、换数据、换设问角度，考查迁移' },
        { name: '迁移创新任务', note: '真实问题解决（购物、测量、统计等生活情境），联系本单元主题' },
      ],
    },
    special: {
      label: '专项突破',
      sections: [
        { name: '分板块组织', note: '按本单元考点分 2-4 个板块，板块内由易到难' },
        { name: '每板块配解析', note: '每板块适量题目并附解析，聚焦本单元薄弱考点' },
      ],
    },
    preview: {
      label: '课前预习',
      sections: [
        { name: '学习目标', note: '1-2 条，明确本课时概念与技能目标' },
        { name: '预习任务', note: '问题驱动（阅读课本、尝试例题、圈画疑问），可操作可检查，覆盖本课时全部新知' },
        { name: '预习检测', note: '2-4 道自检题，检测预习效果' },
        { name: '我的疑问', note: '必设栏目，供学生记录预习中不懂的问题' },
      ],
    },
    reading: {
      label: '阅读训练',
      sections: [
        { name: '阅读材料', note: '数学阅读材料（生活情境、图表资料、数学故事、数学文化），主题与本单元相关，原创或改编，完整呈现并标注出处' },
        { name: '分层设题', note: '设问由浅入深、有层次，考查理解与应用' },
      ],
    },
    summary: {
      label: '知识总结',
      sections: [
        { name: '知识框架', note: '结构化呈现本单元概念、法则、公式、方法（导图/表格/对比优先）' },
        { name: '重点梳理', note: '逐点梳理并标注教材出处，重点内容突出' },
        { name: '易错辨析', note: '本单元易混概念与易错计算辨析' },
        { name: '典型例题', note: '适量典型例题（含解析）' },
      ],
    },
    dictation: {
      label: '默写积累',
      sections: [
        { name: '公式法则', note: '本单元公式、法则、单位进率等必记内容，按课标要求覆盖' },
        { name: '情境填空', note: '核心概念与关键词在情境句中的填写（不孤立默写）' },
        { name: '书写规范', note: '数字与运算符号书写规范，低段强调' },
      ],
    },
    errorbook: {
      label: '错题本',
      sections: [
        { name: '原题重现', note: '完整重现原题（可精简题干，保留关键信息）' },
        { name: '错误归因', note: '具体到知识点或思维环节（审题/建模/计算/验证），归因明确' },
        { name: '正确解法', note: '分步完整解答' },
        { name: '同类变式', note: '1 道变式（换数据、换情境、换设问角度）' },
        { name: '解题策略', note: '归纳本类题通用策略' },
      ],
    },
    review: {
      label: '复习资料',
      sections: [
        { name: '知识框架', note: '本单元概念、公式、方法结构图或表格' },
        { name: '考点梳理', note: '按知识点逐条梳理并标注教材出处，重点难点突出' },
        { name: '典型题析', note: '适量典型题（含解题思路分析）' },
        { name: '易错聚焦', note: '本单元易错点辨析' },
        { name: '综合自测', note: '分层自测（基础/提高），覆盖本单元全部知识点' },
      ],
    },
  },
  '英语': {
    practice: {
      label: '课时练',
      sections: [
        { name: '基础建构任务', note: '覆盖本课时核心内容，在情境中呈现' },
        { name: '探究进阶任务', note: '语篇语境中的综合运用，变式设问' },
        { name: '迁移创新任务', note: '真实交际任务（情境对话、介绍、交流），联系本单元主题' },
      ],
    },
    special: {
      label: '专项突破',
      sections: [
        { name: '分板块组织', note: '按本单元内容分 2-4 个板块，板块内由易到难' },
        { name: '每板块配解析', note: '每板块适量题目并附解析，聚焦本单元薄弱点' },
      ],
    },
    preview: {
      label: '课前预习',
      sections: [
        { name: '学习目标', note: '1-2 条，明确本课时学习目标' },
        { name: '预习任务', note: '问题驱动（听读课文、圈画生词、尝试跟读、记录疑问），可操作可检查，覆盖本课时全部新知' },
        { name: '预习检测', note: '2-4 道自检题，检测预习效果' },
        { name: '我的疑问', note: '必设栏目，供学生记录预习中不懂的问题' },
      ],
    },
    reading: {
      label: '阅读训练',
      sections: [
        { name: '阅读材料', note: '原创或改编语篇（主题与本单元相关，体裁适学段），完整呈现并标注出处' },
        { name: '分层设题', note: '设问由浅入深、有层次，题目不可直接在原文找到原句答案' },
      ],
    },
    summary: {
      label: '知识总结',
      sections: [
        { name: '知识框架', note: '结构化呈现本单元核心知识（导图/表格/对比优先）' },
        { name: '重点梳理', note: '逐点梳理并标注教材出处，重点内容突出' },
        { name: '易错辨析', note: '本单元易混词汇、易错发音与句型辨析' },
        { name: '典型例题', note: '适量典型例题（含解析）' },
      ],
    },
    dictation: {
      label: '默写积累',
      sections: [
        { name: '词汇句型', note: '本单元要求掌握的词汇与句型，在情境中呈现（不孤立默写）' },
        { name: '语音积累', note: '本单元要求掌握的语音知识（字母组合、读音规则等），按教材要求覆盖' },
        { name: '书写规范', note: '英文书写用四线三格呈现' },
      ],
    },
    errorbook: {
      label: '错题本',
      sections: [
        { name: '原题重现', note: '完整重现原题（可精简题干，保留关键信息）' },
        { name: '错误归因', note: '具体到知识点或思维环节（词汇/语法/语篇理解），归因明确' },
        { name: '正确解法', note: '分步完整解答' },
        { name: '同类变式', note: '1 道变式（换语境、换情境、换设问角度）' },
        { name: '解题策略', note: '归纳本类题通用策略' },
      ],
    },
    review: {
      label: '复习资料',
      sections: [
        { name: '知识框架', note: '本单元核心知识结构图或表格' },
        { name: '考点梳理', note: '按知识点逐条梳理并标注教材出处，重点难点突出' },
        { name: '典型题析', note: '适量典型题（含解题思路分析）' },
        { name: '易错聚焦', note: '本单元易错点辨析' },
        { name: '综合自测', note: '分层自测（基础/提高），覆盖本单元全部知识点' },
      ],
    },
  },
  '科学': {
    practice: {
      label: '课时练',
      sections: [
        { name: '基础建构任务', note: '覆盖本课时核心知识点，结合生活现象与观察呈现' },
        { name: '探究进阶任务', note: '观察与实验任务，变式设问，考查迁移' },
        { name: '迁移创新任务', note: '生活应用与实践任务（观察自然、制作模型、调查记录），联系本单元主题' },
      ],
    },
    special: {
      label: '专项突破',
      sections: [
        { name: '分板块组织', note: '按本单元内容分 2-4 个板块，板块内由易到难' },
        { name: '每板块配解析', note: '每板块适量题目并附解析，聚焦本单元薄弱点' },
      ],
    },
    preview: {
      label: '课前预习',
      sections: [
        { name: '学习目标', note: '1-2 条，明确本课时学习目标' },
        { name: '预习任务', note: '问题驱动（阅读课本、观察身边事物、尝试实验准备、记录疑问），可操作可检查，覆盖本课时全部新知' },
        { name: '预习检测', note: '2-4 道自检题，检测预习效果' },
        { name: '我的疑问', note: '必设栏目，供学生记录预习中不懂的问题' },
      ],
    },
    reading: {
      label: '阅读训练',
      sections: [
        { name: '阅读材料', note: '科普阅读材料（科学故事、自然现象、科技新闻、科学史），主题与本单元相关，原创或改编，完整呈现并标注出处' },
        { name: '分层设题', note: '设问由浅入深、有层次，题目不可直接在原文找到原句答案' },
      ],
    },
    summary: {
      label: '知识总结',
      sections: [
        { name: '知识框架', note: '结构化呈现本单元科学概念与知识（导图/表格/对比优先）' },
        { name: '重点梳理', note: '逐点梳理并标注教材出处，重点内容突出' },
        { name: '易错辨析', note: '本单元易混概念与易错观察结论辨析' },
        { name: '典型例题', note: '适量典型例题（含解析）' },
      ],
    },
    dictation: {
      label: '默写积累',
      sections: [
        { name: '科学概念', note: '本单元要求掌握的科学概念与术语，在情境中呈现（不孤立罗列）' },
        { name: '观察记录', note: '典型观察与实验的关键记录内容（现象、数据、结论），按教材要求覆盖' },
        { name: '书写呈现', note: '记录表与数据书写规范呈现' },
      ],
    },
    errorbook: {
      label: '错题本',
      sections: [
        { name: '原题重现', note: '完整重现原题（可精简题干，保留关键信息）' },
        { name: '错误归因', note: '具体到知识点或思维环节（概念/实验操作/现象解释），归因明确' },
        { name: '正确解法', note: '分步完整解答' },
        { name: '同类变式', note: '1 道变式（换情境、换实验、换设问角度）' },
        { name: '解题策略', note: '归纳本类题通用策略' },
      ],
    },
    review: {
      label: '复习资料',
      sections: [
        { name: '知识框架', note: '本单元科学概念与探究方法结构图或表格' },
        { name: '考点梳理', note: '按知识点逐条梳理并标注教材出处，重点难点突出' },
        { name: '典型题析', note: '适量典型题（含解题思路分析）' },
        { name: '易错聚焦', note: '本单元易错点辨析' },
        { name: '综合自测', note: '分层自测（基础/提高），覆盖本单元全部知识点' },
      ],
    },
  },
  '物理': {
    practice: {
      label: '课时练',
      sections: [
        { name: '基础建构任务', note: '覆盖本课时核心知识点（概念、规律、公式），在情境中考查' },
        { name: '探究进阶任务', note: '实验与现象分析任务，变式设问，考查迁移' },
        { name: '迁移创新任务', note: '真实问题解决（生活现象、科技应用），联系本单元主题' },
      ],
    },
    special: {
      label: '专项突破',
      sections: [
        { name: '分板块组织', note: '按本单元内容分 2-4 个板块，板块内由易到难' },
        { name: '每板块配解析', note: '每板块适量题目并附解析，聚焦本单元薄弱点' },
      ],
    },
    preview: {
      label: '课前预习',
      sections: [
        { name: '学习目标', note: '1-2 条，明确本课时学习目标' },
        { name: '预习任务', note: '问题驱动（阅读课本、观察生活现象、尝试解释、记录疑问），可操作可检查，覆盖本课时全部新知' },
        { name: '预习检测', note: '2-4 道自检题，检测预习效果' },
        { name: '我的疑问', note: '必设栏目，供学生记录预习中不懂的问题' },
      ],
    },
    reading: {
      label: '阅读训练',
      sections: [
        { name: '阅读材料', note: '科普阅读材料（科学史、生活与科技中的物理、实验原理说明），主题与本单元相关，原创或改编，完整呈现并标注出处' },
        { name: '分层设题', note: '设问由浅入深、有层次，题目不可直接在原文找到原句答案' },
      ],
    },
    summary: {
      label: '知识总结',
      sections: [
        { name: '知识框架', note: '结构化呈现本单元概念、规律、公式（导图/表格/对比优先）' },
        { name: '重点梳理', note: '逐点梳理并标注教材出处，重点内容突出' },
        { name: '易错辨析', note: '本单元易混概念与易错规律应用辨析' },
        { name: '典型例题', note: '适量典型例题（含解析）' },
      ],
    },
    dictation: {
      label: '默写积累',
      sections: [
        { name: '概念规律', note: '本单元要求掌握的概念、规律、公式，在情境中呈现（不孤立罗列）' },
        { name: '单位常量', note: '本单元要求掌握的单位、常量等必记内容，按教材要求覆盖' },
        { name: '书写呈现', note: '公式与单位书写规范呈现' },
      ],
    },
    errorbook: {
      label: '错题本',
      sections: [
        { name: '原题重现', note: '完整重现原题（可精简题干，保留关键信息）' },
        { name: '错误归因', note: '具体到知识点或思维环节（概念理解/审题建模/计算/实验操作），归因明确' },
        { name: '正确解法', note: '分步完整解答' },
        { name: '同类变式', note: '1 道变式（换数据、换情境、换设问角度）' },
        { name: '解题策略', note: '归纳本类题通用策略' },
      ],
    },
    review: {
      label: '复习资料',
      sections: [
        { name: '知识框架', note: '本单元概念、规律、公式结构图或表格' },
        { name: '考点梳理', note: '按知识点逐条梳理并标注教材出处，重点难点突出' },
        { name: '典型题析', note: '适量典型题（含解题思路分析）' },
        { name: '易错聚焦', note: '本单元易错点辨析' },
        { name: '综合自测', note: '分层自测（基础/提高），覆盖本单元全部知识点' },
      ],
    },
  },
};

/** 全部教辅类型键 */
export const TEACHING_GEN_TYPES = Object.keys(TEACHING_BLUEPRINTS);

/** 学段键归一：接受学段键（primary_low 等）或中文学段/年级标签（'小学低段'/'二年级'/'高一' 等） */
function normalizeTeachingStage(stage = '') {
  const s = String(stage).trim();
  if (['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'].includes(s)) return s;
  if (/高一|高二|高三/.test(s) || s === '高中') return 'high';
  if (s === '初中' || /七年级|八年级|九年级/.test(s)) return 'middle';
  if (/一年级|二年级/.test(s) || s.includes('低段')) return 'primary_low';
  if (/三年级|四年级/.test(s) || s.includes('中段')) return 'primary_mid';
  if (/五年级|六年级/.test(s) || s.includes('高段')) return 'primary_high';
  if (/小学/.test(s)) {
    const g = parseInt(s.replace(/\D/g, ''), 10) || 0;
    if (g >= 1 && g <= 2) return 'primary_low';
    if (g >= 3 && g <= 4) return 'primary_mid';
    return 'primary_high';
  }
  return 'primary_mid'; // 无法识别时宽松回退（不阻断生成）
}

/**
 * 查询教辅结构蓝本（三维度：学科×类型×学段；学科专属优先，未定制回退通用默认）
 * @param {Object} opts { genType(资料类型), stage(学段键), subject(学科,可空→通用) }
 * @returns {Object|null} { label, sections, stageParams, key, custom }
 */
export function getTeachingBlueprint({ genType = '', stage = '', subject = '' } = {}) {
  const custom = TEACHING_SUBJECT_BLUEPRINTS[subject]?.[genType];
  const def = TEACHING_BLUEPRINTS[genType];
  const bp = custom || def;
  if (!bp) return null;
  const stageKey = normalizeTeachingStage(stage);
  const stages = custom?.stages || def?.stages || {};
  const stageParams = stages[stageKey] || stages.primary_mid;
  return {
    label: bp.label, sections: bp.sections, stageParams,
    key: `${subject || '*'}|${genType}|${stageKey}`, stageKey,
    subject: subject || '*', custom: !!custom,
  };
}

/**
 * 构建教辅结构注入块（供生成指令尾部附加，与 exam 的 buildBlueprintInjection 对称）
 * 只注入栏目框架 + 学段要求；题量/篇幅底线由 teaching-volume-guard 程序侧校验，不注入 prompt（防限定 AI）
 * @param {Object} opts { genType, stage, subject }
 * @returns {string} 空串 = 无蓝本
 */
export function buildTeachingInjection({ genType = '', stage = '', subject = '' } = {}) {
  const bp = getTeachingBlueprint({ genType, stage, subject });
  if (!bp) return '';
  const sectionsText = bp.sections.map(s => `· ${s.name}——${s.note}`).join('\n');
  const p = bp.stageParams;
  const scope = bp.custom ? `${bp.subject}·` : '通用·';
  const stageLine = p.note ? `\n▌学段要求（${TEACHING_STAGE_NAMES[bp.stageKey] || bp.stageKey}）\n· ${p.note}` : '';
  return `\n\n【教辅结构（${scope}${bp.label}·${TEACHING_STAGE_NAMES[bp.stageKey] || bp.stageKey}）——栏目与学段要求，按此组织】
▌栏目框架（栏目完整，不得缺失；板块间不重复、不相似）
${sectionsText}${stageLine}`;
}

export default {
  TEACHING_BLUEPRINTS,
  TEACHING_SUBJECT_BLUEPRINTS,
  TEACHING_GEN_TYPES,
  TEACHING_STAGE_NAMES,
  getTeachingBlueprint,
  buildTeachingInjection,
};
