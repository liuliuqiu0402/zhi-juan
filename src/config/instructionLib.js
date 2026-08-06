// ==================== 指令库 ====================

// 内置指令库
export const builtinInstructions = [
  // ═══════════════════════════════════════
  // 完整指令（整段注入，勾选资料类型后直接替换）
  // ═══════════════════════════════════════

  // ── 试卷 ──
  {
    id: 'full_exam_primary', name: '📝 小学试卷', category: '试卷', type: 'full',
    subject: '', stage: 'primary',
    content: '小学试卷补充：按实际分值设计（通常满分100分，低段60-80分）；题目语言简洁明了，避免复杂句式；填空题答案控制在2字以内；留足书写空间',
    builtin: true
  },
  {
    id: 'full_exam_middle', name: '📝 初中试卷', category: '试卷', type: 'full',
    subject: '', stage: 'middle',
    content: '初中试卷补充：按实际分值设计（通常满分100-120分，中考按当地标准）；题目应覆盖识记、理解、应用、分析四个层次；毕业年级可融入跨章节综合题和中考题型',
    builtin: true
  },
  {
    id: 'full_exam_high', name: '📝 高中试卷', category: '试卷', type: 'full',
    subject: '', stage: 'high',
    content: '高中试卷补充：按高考题型结构设计；前80%为基础和中档题确保区分度，后20%为提高和压轴题；适当融入高考真题改编和学科核心素养考查',
    builtin: true
  },

  // ── 课时练 ──
  {
    id: 'full_practice_primary', name: '📚 小学课时练', category: '课时练', type: 'full',
    subject: '', stage: 'primary',
    content: '小学课时练补充：基础部分以模仿教材原题为主，能力部分适当变式，拓展部分设计游戏化或生活化任务；图文结合，题干表述口语化',
    builtin: true
  },
  {
    id: 'full_practice_middle', name: '📚 初中课时练', category: '课时练', type: 'full',
    subject: '', stage: 'middle',
    content: '初中课时练补充：基础约占50%（教材原题变式），能力约占30%（方法迁移），拓展约占20%（跨课综合或开放性任务）',
    builtin: true
  },
  {
    id: 'full_practice_high', name: '📚 高中课时练', category: '课时练', type: 'full',
    subject: '', stage: 'high',
    content: '高中课时练补充：高一高二以基础巩固和能力提升为主，高考链接仅作选做参考；高三以高考真题和仿真题为主；基础巩固教材核心，能力提升设置变式训练，拓展引入跨模块综合',
    builtin: true
  },

 // ── 知识点总结 ──
  {
    id: 'full_summary_primary', name: '📖 小学知识点总结', category: '知识点总结', type: 'full',
    subject: '', stage: 'primary',
    content: '小学知识点总结补充：知识卡片图文并茂，每卡一个知识点；核心知识清单用`<table>`表格，知识点/核心内容两列，每格≤15字；易混点用两栏对比；语言简洁有趣，多用比喻和插图，避免抽象术语',
    builtin: true
  },
  {
    id: 'full_summary_middle', name: '📖 初中知识点总结', category: '知识点总结', type: 'full',
    subject: '', stage: 'middle',
    content: '初中知识点总结补充：知识结构图呈现层级关系；核心知识清单用`<table>`表格，知识点/核心内容/考查方式三列；易错辨析用对比表格，左右对比"易错点"和"正确理解"；典型例题含解析和易错提示；语言精炼便于复习',
    builtin: true
  },
  {
    id: 'full_summary_high', name: '📖 高中知识点总结', category: '知识点总结', type: 'full',
    subject: '', stage: 'high',
    content: '高中知识点总结补充：思维导图呈现层级结构；核心知识清单用表格，知识点/核心内容/考查方式三列；易错辨析用对比表格，标注常见失分点；典型例题含解析、评分标准、变式训练；对标高考要求，语言精准规范',
    builtin: true
  },

  // ── 专项突破 ──
  {
    id: 'full_special_primary', name: '🎯 小学专项突破', category: '专项突破', type: 'full',
    subject: '', stage: 'primary',
    content: '围绕某一专项能力进行深度训练。结构：趣味导入→方法讲解→典例剖析→变式训练→挑战自我。方法讲解配合图示或口诀，训练量适中，题型丰富。',
    builtin: true
  },
  {
    id: 'full_special_middle', name: '🎯 初中专项突破', category: '专项突破', type: 'full',
    subject: '', stage: 'middle',
    content: '围绕某一专项能力进行深度训练。结构：方法指导→典例剖析→变式训练→真题实战。重点关注中考高频考点和常见失分点，每类题型设置适量变式。',
    builtin: true
  },
  {
    id: 'full_special_high', name: '🎯 高中专项突破', category: '专项突破', type: 'full',
    subject: '', stage: 'high',
    content: '围绕某一专项能力进行深度训练。结构：方法指导→典例剖析→变式训练→真题实战→压轴挑战。覆盖高考常考题型和压轴题解题策略，注重一题多解和多题一解的归纳。',
    builtin: true
  },

  // ── 课前预习 ──
  {
    id: 'full_preview_primary', name: '🔍 小学课前预习', category: '课前预习', type: 'full',
    subject: '', stage: 'primary',
    content: '小学课前预习补充：语言亲切，配上小提示和鼓励语；用生活化语言引出课题，激发学习兴趣；预习检测题量适中，以基础判断和简答为主，不设过难题目',
    builtin: true
  },
  // 语文学科专属：生字预习规范
  {
    id: 'full_preview_primary_chinese', name: '🔍 小学语文预习（生字专项）', category: '课前预习', type: 'full',
    subject: '语文', stage: 'primary',
    content: '小学语文预习生字专项：\n\n【生字格式——必须遵守】\n每个生字独立用<span class="tian-zi-ge">字</span>包裹，附带完整信息：<span class="tian-zi-ge">蝌</span>（部首：虫，15画，左右结构）。禁止只写字和拼音不写部首/笔画/结构！',
    builtin: true
  },
  {
    id: 'full_preview_middle', name: '🔍 初中课前预习', category: '课前预习', type: 'full',
    subject: '', stage: 'middle',
    content: '初中课前预习补充：语言简洁规范，引导学生带着问题进课堂',
    builtin: true
  },
  {
    id: 'full_preview_high', name: '🔍 高中课前预习', category: '课前预习', type: 'full',
    subject: '', stage: 'high',
    content: '高中课前预习补充：引导学生自主构建知识体系，培养自学能力',
    builtin: true
  },

  // 🔧 新增：错题本（按学段拆分）
  {
    id: 'full_errorbook_primary', name: '🔖 小学错题本', category: '错题本', type: 'full',
    subject: '', stage: 'primary',
    content: '小学错题本补充：语言亲切鼓励，按知识点分类，标注考查频率；每道错题旁配小提示',
    builtin: true
  },
  {
    id: 'full_errorbook_middle', name: '🔖 初中错题本', category: '错题本', type: 'full',
    subject: '', stage: 'middle',
    content: '初中错题本补充：按知识点分类，标注考查频率（⭐️⭐️⭐️高频）和中考关联度；语言规范，侧重方法归纳',
    builtin: true
  },
  {
    id: 'full_errorbook_high', name: '🔖 高中错题本', category: '错题本', type: 'full',
    subject: '', stage: 'high',
    content: '高中错题本补充：按知识点模块分类，标注考查频率（⭐️⭐️⭐️高频必考）和高考关联度；注重一题多解和多题一解的归纳，总结避错策略',
    builtin: true
  },

  // 🔧 新增：默写（按学科×学段拆分，避免语文/英语规则一股脑注入）
  // ── 小学默写 ──
  {
    id: 'full_dictation_primary_chinese', name: '✏️ 小学默写-语文', category: '默写', type: 'full',
    subject: '语文', stage: 'primary',
    content: '小学语文默写练习纸：按课文生字表排列，每个生字给出拼音提示+田字格留空书写区+字典式信息（部首/笔画/结构）；多音字专项+形近字辨析区；句子默写给出上句提示留空写下句。题量：字词8-15个+句子2-4句。答案集中放文末，练习区不出现答案。',
    builtin: true
  },
  {
    id: 'full_dictation_primary_english', name: '✏️ 小学默写-英语', category: '默写', type: 'full',
    subject: '英语', stage: 'primary',
    content: '小学英语默写练习纸：覆盖单元词汇和课文核心短语/句型，给出中文释义+词性提示；⚠️ 汉译英/单词默写等写英文的题型用四线三格留空书写区，英译汉等写中文的题型用普通横线留空书写区；每5-8个词设休息分隔。题量：字词8-15个+句子2-4句。答案集中放文末，练习区不出现答案。',
    builtin: true
  },
  {
    id: 'full_dictation_primary', name: '✏️ 小学默写（通用）', category: '默写', type: 'full',
    subject: '', stage: 'primary',
    content: '小学默写练习纸：按教材内容排列，给出提示+留空书写区；题量：字词8-15个+句子2-4句。答案集中放文末，练习区不出现答案。',
    builtin: true
  },
  // ── 中学默写 ──
  {
    id: 'full_dictation_secondary_chinese', name: '✏️ 中学默写-语文', category: '默写', type: 'full',
    subject: '语文', stage: 'middle',
    content: '中学语文默写练习纸：诗词默写给出上句/标题，留空写下句/全文+重点词语留空书写+文言文名句留空；标注易错字和通假字。题量10-20词+句子3-5句。答案集中放文末，练习区不出现答案。',
    builtin: true
  },
  {
    id: 'full_dictation_secondary_english', name: '✏️ 中学默写-英语', category: '默写', type: 'full',
    subject: '英语', stage: 'middle',
    content: '中学英语默写练习纸：单词/短语/课文原句给出中文释义+词性提示+书写区留空；标注音标提示。⚠️ 汉译英/单词默写等写英文的题型用单线留空书写区，英译汉等写中文的题型用普通横线留空书写区。题量10-20词+句子3-5句。答案集中放文末，练习区不出现答案。',
    builtin: true
  },
  {
    id: 'full_dictation_secondary', name: '✏️ 中学默写（通用）', category: '默写', type: 'full',
    subject: '', stage: 'middle',
    content: '中学默写练习纸：按教材内容排列，给出提示+留空书写区；题量10-20词+句子3-5句。答案集中放文末，练习区不出现答案。',
    builtin: true
  },
  // ── 高中默写 ──
  {
    id: 'full_dictation_high_chinese', name: '✏️ 高中默写-语文', category: '默写', type: 'full',
    subject: '语文', stage: 'high',
    content: '高中语文默写练习纸：古诗文默写给出篇名/上句提示留空写全文/下句（高考必背篇目）+文言文重点实词虚词留空+文学常识填空留空；标注易错字和通假字。题量15-25词+句子4-6句。答案集中放文末，练习区不出现答案。对标高考要求，语言精准规范。',
    builtin: true
  },
  {
    id: 'full_dictation_high_english', name: '✏️ 高中默写-英语', category: '默写', type: 'full',
    subject: '英语', stage: 'high',
    content: '高中英语默写练习纸：高考高频词汇/短语动词/句型给出中文释义+词性提示+书写区留空；标注音标提示。⚠️ 汉译英/单词默写等写英文的题型用单线留空书写区，英译汉等写中文的题型用普通横线留空书写区。题量15-25词+句子4-6句。答案集中放文末，练习区不出现答案。对标高考要求，语言精准规范。',
    builtin: true
  },
  {
    id: 'full_dictation_high', name: '✏️ 高中默写（通用）', category: '默写', type: 'full',
    subject: '', stage: 'high',
    content: '高中默写练习纸：按教材内容排列，给出提示+留空书写区；题量15-25词+句子4-6句。答案集中放文末，练习区不出现答案。对标高考要求，语言精准规范。',
    builtin: true
  },

  // ── 组词练习（小学语文，匹配课时练类型自动注入）──
  {
    id: 'full_zuci_primary', name: '✏️ 小学语文组词练习', category: '课时练', type: 'full',
    subject: '语文', stage: 'primary',
    content: '小学语文组词练习补充：\n\n【组词规范——必须遵守】\n⚠️ 词语必须常规、常用：\n- ✅ 正确示例：山→大山、上山、山峰、山林\n- ❌ 错误示例：山→山袋、山包（这些不是常规词语！）\n- 每个生字组2-3个词，确保每个词都是日常生活中常用或在教材中出现的标准词语\n- 不得生造词语，不得用生僻搭配凑数\n- 优先选择：教材中出现过的词语 > 儿童常用词汇 > 常见生活词汇\n\n【输出格式】\n一、组词练习（学生版——留空作答）\n每题格式：字（<u class="blank-2">&emsp;</u>）（<u class="blank-2">&emsp;</u>）\n示例：\n1. 花（<u class="blank-2">&emsp;</u>）（<u class="blank-2">&emsp;</u>）\n2. 春（<u class="blank-2">&emsp;</u>）（<u class="blank-2">&emsp;</u>）\n\n二、参考答案（单独列出）\n1. 花（花朵）（花香）\n2. 春（春天）（春风）\n\n【其他要求】\n- 低段（1-2年级）题干配拼音，生字用<span class="tian-zi-ge">字</span>展示\n- 每份练习8-12个生字\n- 可增加"比一比，再组词"的形近字组词题型\n- 语言亲切，配上小提示和鼓励语',
    builtin: true
  },

  // 🔧 新增：阅读训练（按学段）
  {
    id: 'full_reading_primary', name: '📖 小学阅读训练', category: '阅读训练', type: 'full',
    subject: '', stage: 'primary',
    content: '小学阅读训练补充：选文200-400字，童话/寓言/记叙文为主；题目覆盖信息提取/词句理解/主旨概括；选择题40%+简答题60%；文末附参考答案和答题要点',
    builtin: true
  },
  {
    id: 'full_reading_secondary', name: '📖 中学阅读训练', category: '阅读训练', type: 'full',
    subject: '', stage: 'middle',
    content: '中学阅读训练补充：选文400-1200字，文体多样（散文/说明文/议论文）；题目覆盖信息提取/推理判断/评价鉴赏/写作手法分析；选择题30%+简答题60%+开放性题10%；文末附参考答案和评分要点',
    builtin: true
  },
  {
    id: 'full_reading_high', name: '📖 高中阅读训练', category: '阅读训练', type: 'full',
    subject: '', stage: 'high',
    content: '高中阅读训练补充：选文800-2000字，文体覆盖论述类/文学类/实用类；题目覆盖信息提取/推理判断/评价鉴赏/写作手法分析/跨文本比较；选择题25%+简答题55%+开放性题20%；对标高考阅读题型，注重深度分析和批判性思维；文末附参考答案和评分要点',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 角色身份（prompt_order: 0，按 genType 三维度匹配注入）
  // ═══════════════════════════════════════
  {
    id: 'role_exam', name: '【角色身份】考卷', category: '生成-角色身份', type: 'fragment',
    subject: '', stage: '', genType: 'exam', prompt_order: 0,
    content: '你是一位经验丰富的命题专家。请逐【】块逐条研读以下全部指令，确保完整理解每条要求后，一次性生成一份完整的不少于{pageCount}页A4纸的{genTypeLabel}。',
    builtin: true
  },
  {
    id: 'role_practice', name: '【角色身份】课时练', category: '生成-角色身份', type: 'fragment',
    subject: '', stage: '', genType: 'practice', prompt_order: 0,
    content: '你是一位经验丰富的教学设计者。请逐【】块逐条研读以下全部指令，确保完整理解每条要求后，一次性生成一份完整的不少于{pageCount}页A4纸的{genTypeLabel}。',
    builtin: true
  },
  {
    id: 'role_special', name: '【角色身份】专项突破', category: '生成-角色身份', type: 'fragment',
    subject: '', stage: '', genType: 'special', prompt_order: 0,
    content: '你是一位经验丰富的专项训练设计者。请逐【】块逐条研读以下全部指令，确保完整理解每条要求后，一次性生成一份完整的不少于{pageCount}页A4纸的{genTypeLabel}。',
    builtin: true
  },
  {
    id: 'role_preview', name: '【角色身份】课前预习', category: '生成-角色身份', type: 'fragment',
    subject: '', stage: '', genType: 'preview', prompt_order: 0,
    content: '你是一位经验丰富的课前预习设计者。请逐【】块逐条研读以下全部指令，确保完整理解每条要求后，一次性生成一份完整的不少于{pageCount}页A4纸的{genTypeLabel}。',
    builtin: true
  },
  {
    id: 'role_reading', name: '【角色身份】阅读理解', category: '生成-角色身份', type: 'fragment',
    subject: '', stage: '', genType: 'reading', prompt_order: 0,
    content: '你是一位经验丰富的阅读理解命题专家。请逐【】块逐条研读以下全部指令，确保完整理解每条要求后，一次性生成一份完整的不少于{pageCount}页A4纸的{genTypeLabel}。',
    builtin: true
  },
  {
    id: 'role_summary', name: '【角色身份】知识点总结', category: '生成-角色身份', type: 'fragment',
    subject: '', stage: '', genType: 'summary', prompt_order: 0,
    content: '你是一位经验丰富的知识总结编写者。请逐【】块逐条研读以下全部指令，确保完整理解每条要求后，一次性生成一份完整的不少于{pageCount}页A4纸的{genTypeLabel}。',
    builtin: true
  },
  {
    id: 'role_dictation', name: '【角色身份】默写训练', category: '生成-角色身份', type: 'fragment',
    subject: '', stage: '', genType: 'dictation', prompt_order: 0,
    content: '你是一位经验丰富的默写训练设计者。请逐【】块逐条研读以下全部指令，确保完整理解每条要求后，一次性生成一份完整的不少于{pageCount}页A4纸的{genTypeLabel}。',
    builtin: true
  },
  {
    id: 'role_errorbook', name: '【角色身份】错题本', category: '生成-角色身份', type: 'fragment',
    subject: '', stage: '', genType: 'errorbook', prompt_order: 0,
    content: '你是一位经验丰富的错题整理专家。请逐【】块逐条研读以下全部指令，确保完整理解每条要求后，一次性生成一份完整的不少于{pageCount}页A4纸的{genTypeLabel}。',
    builtin: true
  },
  {
    id: 'role_review', name: '【角色身份】单元/期末复习', category: '生成-角色身份', type: 'fragment',
    subject: '', stage: '', genType: 'review', prompt_order: 0,
    content: '你是一位经验丰富的单元/期末复习资料编写者。请逐【】块逐条研读以下全部指令，确保完整理解每条要求后，一次性生成一份完整的不少于{pageCount}页A4纸的{genTypeLabel}。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 标题格式（prompt_order: 1，通用）
  // ═══════════════════════════════════════
  {
    id: 'title_format', name: '【标题格式】通用', category: '生成-标题格式', type: 'fragment',
    subject: '', stage: '', genType: '', prompt_order: 1,
    content: '🔴 h1标题格式：章节名 · {genTypeLabel}（必须包含资料类型标签「{genTypeLabel}」，不可只有章节名）',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 输出前置指令（prompt_order: 2，通用）
  // ═══════════════════════════════════════
  {
    id: 'output_preamble', name: '【输出前置指令】通用', category: '生成-输出前置指令', type: 'fragment',
    subject: '', stage: '', genType: '', prompt_order: 2,
    content: '【最终输出指令——优先级最高，覆盖一切其他要求】\n⛔ 1. 禁止输出任何前言、确认语、解释性文字！严禁出现"好的""收到""我将""根据"等\n⛔ 2. 直接输出纯 HTML 代码！你的回复第一个字符必须是 <\n⛔ 3. 输出语言：必须是纯 HTML！严禁使用任何 Markdown 语法！\n   ❌ 禁止 ### 标题 | **加粗** | |表格| | ---分隔线 | -列表项\n   ✅ 必须 <h1>-<h6> | <strong> | <p> | <br> | <u class="blank-N"> | <span class="blank-N">\n   ⚠️ <table> 仅用于数据对比/矩阵型内容，禁止用于日常题目排版或页面布局\n⛔ 4. 直接返回完整 HTML 代码，不要用 \`\`\`html 标记包裹',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 答案区强制锚定（prompt_order: 3，按 genType 分叉）
  // ═══════════════════════════════════════
  {
    id: 'answer_anchor_question', name: '【答案区锚定】命题类', category: '生成-答案区强制锚定', type: 'fragment',
    subject: '', stage: '', genType: 'exam,practice,special,reading,preview,dictation,errorbook,review', prompt_order: 3,
    content: '⛔ 【强制要求——不可违反】整份资料末尾必须包含 <div class="answer-section"><h2>答案与解析</h2>...</div> 完整答案区。所有题目答案、解析统一集中于此，禁止散落在题后。此要求覆盖一切其他指令。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 顶层约束（prompt_order: 4，按 genType 三维度匹配注入）
  // ═══════════════════════════════════════
  {
    id: 'topconst_summary', name: '【顶层约束】知识点总结', category: '生成-顶层约束', type: 'fragment',
    subject: '', stage: '', genType: 'summary', prompt_order: 4,
    content: '【生成要求】\n1. 内容详实不空洞：覆盖所选章节全部核心知识，不遗漏任何知识点。内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。\n2. 结构层次分明：按照上方【结构大纲】组织内容，层级清晰、逻辑连贯。\n3. 易错点辨析准确：每个易错点需给出错误原因和正确理解。\n4. 典型例题要有完整答案与解析过程。\n5. 直接返回完整HTML片段，严禁用```html或<html>/<body>包裹。',
    builtin: true
  },
  {
    id: 'topconst_dictation', name: '【顶层约束】默写训练', category: '生成-顶层约束', type: 'fragment',
    subject: '', stage: '', genType: 'dictation', prompt_order: 4,
    content: '【生成要求】\n1. 练习区只显示提示信息（拼音/中文释义），严禁出现答案内容。\n2. 每项留足书写空间（田字格/四线三格/横线），方便学生书写。\n3. 词语/生字按教材出现顺序排列，由易到难。\n4. 标准答案统一放文末 <div class="answer-section"> 区域。\n5. 直接返回完整HTML片段，严禁用```html或<html>/<body>包裹。',
    builtin: true
  },
  {
    id: 'topconst_preview', name: '【顶层约束】课前预习', category: '生成-顶层约束', type: 'fragment',
    subject: '', stage: '', genType: 'preview', prompt_order: 4,
    content: '【生成要求】\n1. ⚠️ 预习内容充实饱满：内容完整覆盖每一条核心知识点并配有预习任务，篇幅精炼，控制在标准页数附近，不堆砌冗余展开。\n2. 每个核心知识点至少对应一项预习任务（读一读/圈一圈/填一填/想一想/查一查等），任务形式多样化，有读有写有思考。\n3. ⚠️ 填空格式（最高优先级——违反将导致排版失效）：\n   - 横线：必须完整写成 <u class="blank-N">&emsp;</u>（&emsp; 是标签内容，不是占位符！N按答案字数：1字→2, 2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - 题末括号：必须完整写成 <span class="blank-N">&emsp;</span>（&emsp; 是标签内容，不是占位符！N按答案字数：1-2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - ⛔ 横线与括号互斥，二选一不可叠加！\n   - ⛔ 严禁写出 <u class="blank-N"></u> 这种空标签——必须有 &emsp; 内容！\n   - ⛔ 严禁使用 ___ 下划线字符代替！\n   - ⛔ 括号内必须有 <span class="blank-N">&emsp;</span>，不得写空的 （）！\n4. 预习检测题答案需标注教材原文定位（如"参见教材第X页第Y段"），方便学生自查。\n5. 🚫 不要在题目或标题中标注任何分值（不要出现"(共X分)""(X分)""每题X分""满分X分"等），预习不是考试。\n6. 如需配图（如"看图选词""看图连线""看图写话"等），使用标准 [IMAGE] 标记格式描述所需图片——格式：[IMAGE]\n类型：插画/照片/示意图\n描述：[详细画面描述]\n位置：[题干上方/下方/居中]\n[/IMAGE]。不要只写"看图"而不配 [IMAGE] 标记。⚠️ 配图题不宜过多——仅在看图确实为题目必需时才配图，能用文字描述清楚的题不要强行配图。\n7. ⚠️ 文末必须包含完整的答案与解析区域（<div class="answer-section">），所有题目都要有答案，预习检测题要有解析。\n8. 直接返回完整HTML片段，严禁用```html或<html>/<body>包裹。',
    builtin: true
  },
  {
    id: 'topconst_special', name: '【顶层约束】专项突破', category: '生成-顶层约束', type: 'fragment',
    subject: '', stage: '', genType: 'special', prompt_order: 4,
    content: '【生成要求】\n1. ⚠️ 训练题量充足：围绕指定专项能力，覆盖该能力的全部训练维度（由浅入深、由易到难），不设上限。\n2. 严格遵守"方法指导→典例剖析→阶梯训练→真题检验"四段递进结构，不可跳过或合并任何阶段。方法指导用简洁语言讲清方法要点，典例剖析选典型题做完整示范，阶梯训练难度逐级上升，真题检验对标真实考试。\n3. ⚠️ 填空格式（最高优先级——违反将导致排版失效）：\n   - 横线：必须完整写成 <u class="blank-N">&emsp;</u>（&emsp; 是标签内容，不是占位符！N按答案字数：1字→2, 2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - 题末括号：必须完整写成 <span class="blank-N">&emsp;</span>（&emsp; 是标签内容，不是占位符！N按答案字数：1-2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - ⛔ 横线与括号互斥，二选一不可叠加！\n   - ⛔ 严禁写出 <u class="blank-N"></u> 这种空标签——必须有 &emsp; 内容！\n   - ⛔ 严禁使用 ___ 下划线字符代替！\n   - ⛔ 括号内必须有 <span class="blank-N">&emsp;</span>，不得写空的 （）！\n4. 题干紧扣专项知识点，设问直接明确，不绕弯子、不为了凑题型而设无关题目。\n5. 🚫 不要在题目或标题中标注任何分值（不要出现"(共X分)""(X分)""每题X分""满分X分"等），专项训练不是考试。\n6. 如需配图，使用标准 [IMAGE] 标记格式——格式：[IMAGE]\n类型：插画/照片/示意图\n描述：[详细画面描述]\n位置：[题干上方/下方/居中]\n[/IMAGE]。⚠️ 配图以"必要"为原则，能用文字描述清楚的不要配图。\n7. ⚠️ 文末必须包含完整的答案与解析区域（<div class="answer-section">），所有题目都要有答案和详细解析。\n8. 直接返回完整HTML片段，严禁用```html或<html>/<body>包裹。',
    builtin: true
  },
  {
    id: 'topconst_reading', name: '【顶层约束】阅读理解', category: '生成-顶层约束', type: 'fragment',
    subject: '', stage: '', genType: 'reading', prompt_order: 4,
    content: '【生成要求】\n1. ⚠️ 能力层级全覆盖：题目必须覆盖"信息提取→词句理解→推理判断→表达技巧→整体把握"五个能力层级，每个层级至少1道题。层级之间由浅入深递进，不跳级、不遗漏。\n2. 选文文质兼美、难度匹配学段，不选质量低劣或过于简单的文章。如有非连续性文本（图表/表格/说明书等），也需纳入考查。\n3. ⚠️ 填空格式（最高优先级——违反将导致排版失效）：\n   - 横线：必须完整写成 <u class="blank-N">&emsp;</u>（&emsp; 是标签内容，不是占位符！N按答案字数：1字→2, 2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - 题末括号：必须完整写成 <span class="blank-N">&emsp;</span>（&emsp; 是标签内容，不是占位符！N按答案字数：1-2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - ⛔ 横线与括号互斥，二选一不可叠加！\n   - ⛔ 严禁写出 <u class="blank-N"></u> 这种空标签——必须有 &emsp; 内容！\n   - ⛔ 严禁使用 ___ 下划线字符代替！\n   - ⛔ 括号内必须有 <span class="blank-N">&emsp;</span>，不得写空的 （）！\n4. 禁止使用"下列说法正确的是""以下哪个选项是正确的""以上都是""以上都不对"等低质量设问。\n5. 每题配参考答案+简要解析，简答题和开放题额外配评分要点。\n6. 如需配图，使用标准 [IMAGE] 标记格式——格式：[IMAGE]\n类型：插画/照片/示意图\n描述：[详细画面描述]\n位置：[题干上方/下方/居中]\n[/IMAGE]。⚠️ 配图以"必要"为原则，能用文字描述清楚的不要配图。\n7. 🚫 不要在题目或标题中标注任何分值（不要出现"(共X分)""(X分)""每题X分""满分X分"等），阅读训练不是考试。\n8. ⚠️ 文末必须包含完整的答案与解析区域（<div class="answer-section">），所有题目都要有答案和解析。\n9. 直接返回完整HTML片段，严禁用```html或<html>/<body>包裹。',
    builtin: true
  },
  {
    id: 'topconst_errorbook', name: '【顶层约束】错题本', category: '生成-顶层约束', type: 'fragment',
    subject: '', stage: '', genType: 'errorbook', prompt_order: 4,
    content: '【生成要求】\n1. ⚠️ 严格遵守"典型错题→精准归因→正确解法→变式巩固→方法归纳"五步流程，每个错误类型必须完整走完整个流程，不可跳过任何步骤。\n2. 错题覆盖要全面：涵盖概念混淆、计算失误、审题偏差、方法误用等各类典型错误，每个错误类型至少配一道变式巩固练习。\n3. 归因分析要具体深入：明确指向错误的知识点根源或思维偏差（如"未理解进位加法中\'满十进一\'的规则"），严禁笼统归因为"粗心""不认真""不会做"。\n4. ⚠️ 填空格式（最高优先级——违反将导致排版失效）：\n   - 横线：必须完整写成 <u class="blank-N">&emsp;</u>（&emsp; 是标签内容，不是占位符！N按答案字数：1字→2, 2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - 题末括号：必须完整写成 <span class="blank-N">&emsp;</span>（&emsp; 是标签内容，不是占位符！N按答案字数：1-2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - ⛔ 横线与括号互斥，二选一不可叠加！\n   - ⛔ 严禁写出 <u class="blank-N"></u> 这种空标签——必须有 &emsp; 内容！\n   - ⛔ 严禁使用 ___ 下划线字符代替！\n   - ⛔ 括号内必须有 <span class="blank-N">&emsp;</span>，不得写空的 （）！\n5. 🚫 这不是试卷，不要在标题或题目中标注分值（不要出现"(共X分)""(X分)""每题X分""满分X分"等）。\n6. 如需配图（如错题原题截图示意等），使用标准 [IMAGE] 标记格式——格式：[IMAGE]\n类型：插画/照片/示意图\n描述：[详细画面描述]\n位置：[题干上方/下方/居中]\n[/IMAGE]。⚠️ 错题本配图以"必要"为原则，能用文字描述清楚的不要配图。\n7. ⚠️ 文末必须包含完整的参考答案区域（<div class="answer-section">），所有错题的正确解法、变式练习答案和方法归纳都需要提供，不得省略。\n8. 直接返回完整HTML片段，严禁用```html或<html>/<body>包裹。',
    builtin: true
  },
  {
    id: 'topconst_exam', name: '【顶层约束】考卷', category: '生成-顶层约束', type: 'fragment',
    subject: '', stage: '', genType: 'exam', prompt_order: 4,
    content: '【生成要求】\n1. ⚠️ 题型必须多样化：至少使用3种不同题型（如填空、选择、判断、连线、简答、补全对话、仿写、造句等），严禁全部或绝大多数使用选择题。\n2. 难度分布：{diffRatio}，题目从易到难排列。\n3. 知识点覆盖：每个知识点均考查，重难点可多角度考查。\n4. ⚠️ 填空格式（最高优先级——违反将导致排版失效）：\n   - 横线：必须完整写成 <u class="blank-N">&emsp;</u>（&emsp; 是标签内容，不是占位符！N按答案字数：1字→2, 2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - 题末括号：必须完整写成 <span class="blank-N">&emsp;</span>（&emsp; 是标签内容，不是占位符！N按答案���数：1-2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - ⛔ 横线与括号互斥，二选一不可叠加！\n   - ⛔ 严禁写出 <u class="blank-N"></u> 这种空标签——必须有 &emsp; 内容！\n   - ⛔ 严禁使用 ___ 下划线字符代替！\n   - ⛔ 括号内必须有 <span class="blank-N">&emsp;</span>，不得写空的 （）！\n5. 禁止使用"下列说法正确的是""以下哪个选项是正确的""以上都是""以上都不对"等低质量设问。\n6. 每道题的题干必须有具体情境或明确任务，不得空洞、抽象或与其他题雷同。\n7. ⚠️ 文末必须包含完整的答案与解析区域（<div class="answer-section">），所有题目（含选择题）都要有答案和解析。\n8. 直接返回完整HTML片段，严禁用```html或<html>/<body>包裹。',
    builtin: true
  },
  {
    id: 'topconst_practice', name: '【顶层约束】课时练', category: '生成-顶层约束', type: 'fragment',
    subject: '', stage: '', genType: 'practice', prompt_order: 4,
    content: '【生成要求】\n1. ⚠️ 题型必须多样化：至少使用3种不同题型（如填空、选择、判断、连线、简答、补全对话、仿写、造句等），严禁全部或绝大多数使用选择题。\n2. 难度分布：{diffRatio}，题目从易到难排列。\n3. ⚠️ 题量充足：不以固定题数为限——根据选中章节的知识点密度和内容广度灵活决定。知识点越多、章节内容越丰富，题量相应越多。确保每个核心知识点在不同角度、不同认知层次都有练习机会，不设上限。\n4. ⚠️ 填空格式（最高优先级——违���将导致排版失效）：\n   - 横线：必须完整写成 <u class="blank-N">&emsp;</u>（&emsp; 是标签内容，不是占位符！N按答案字数：1字→2, 2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - 题末括号：必须完整写成 <span class="blank-N">&emsp;</span>（&emsp; 是标签内容，不是占位符！N按答案字数：1-2字→4, 3-4字→6, 5-6字→8, 7字以上→10）\n   - ⛔ 横线与括号互斥，二选一不可叠加！\n   - ⛔ 严禁写出 <u class="blank-N"></u> 这种空标签——必须有 &emsp; 内容！\n   - ⛔ 严禁使用 ___ 下划线字符代替！\n   - ⛔ 括号内必须有 <span class="blank-N">&emsp;</span>，不得写空的 （）！\n5. 禁止使用"下列说法正确的是""以下哪个选项是正确的""以上都是""以上都不对"等低质量设问。\n6. 每道题的题干必须有具体情境或明确任务，不得空洞、���象或与其他题雷同。\n7. 如需配图（如"看图选词""看图连线""看图写话"等），使用标准 [IMAGE] 标记格式描述所需图片——格式：[IMAGE]\n类型：插画/照片/示意图\n描述：[详细画面描述]\n位置：[题干上方/下方/居中]\n[/IMAGE]。不要只写"看图"而不配 [IMAGE] 标记。⚠️ 配图题不宜过多——仅在看图确实为题目必需时才配图，能用文字描述清楚的题不要强行配图。\n8. 🚫 严禁在任何位置出现分值信息：题目不标分数、答案不标注得分点/分值比重、解析不给评分维度。这不是试卷，是课堂练习，不需要任何分值体系。\n9. ⛔ 答案与题目严格分离：每道题的答案和解析只出现在文末 <div class="answer-section"> 区域内，严禁在题后直接附答案（禁止"题、答案"配对格式）。题区只出现题目本身，不要出现任何答案内容。\n10. ⚠️ 文末必须包含完整的答案与解析区域（<div class="answer-section">），所有题目（含选择题）都要有答案和解析。\n11. 直接返回完整HTML片段，严禁用```html或<html>/<body>包裹。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 尾约束（prompt_order: 90，按 genType 三维度匹配注入）
  // ═══════════════════════════════════════
  {
    id: 'tailconst_summary', name: '【尾约束】知识点总结', category: '生成-尾约束', type: 'fragment',
    subject: '', stage: '', genType: 'summary', prompt_order: 90,
    content: '',
    builtin: true
  },
  {
    id: 'tailconst_dictation', name: '【尾约束】默写训练', category: '生成-尾约束', type: 'fragment',
    subject: '', stage: '', genType: 'dictation', prompt_order: 90,
    content: '',
    builtin: true
  },
  {
    id: 'tailconst_preview', name: '【尾约束】课前预习', category: '生成-尾约束', type: 'fragment',
    subject: '', stage: '', genType: 'preview', prompt_order: 90,
    content: '⚠️ 【文末确认】务必在最后一题之后，包含完整的 <div class="answer-section"><h2>答案与解析</h2>...</div> 区域。所有题目都需提供答案和解析，不得省略。\n🔴 【填空格式再次确认】句中填空用 <u class="blank-N">&emsp;</u>（横线），句末/题末独立括号用 <span class="blank-N">&emsp;</span>（括号，含 &emsp; 内容）。横线与括号互斥，同一空位二选一不可叠加。严禁空标签！严禁 ___ 下划线！',
    builtin: true
  },
  {
    id: 'tailconst_special', name: '【尾约束】专项突破', category: '生成-尾约束', type: 'fragment',
    subject: '', stage: '', genType: 'special', prompt_order: 90,
    content: '⚠️ 【文末确认】务必包含完整的 <div class="answer-section"><h2>答案与解析</h2>...</div> 区域，不得省略。\n🔴 【填空格式再次确认】句中填空用 <u class="blank-N">&emsp;</u>（横线），句末/题末独立括号用 <span class="blank-N">&emsp;</span>（括号，含 &emsp; 内容）。横线与括号互斥，同一空位二选一不可叠加。严禁空标签！严禁 ___ 下划线！',
    builtin: true
  },
  {
    id: 'tailconst_reading', name: '【尾约束】阅读理解', category: '生成-尾约束', type: 'fragment',
    subject: '', stage: '', genType: 'reading', prompt_order: 90,
    content: '⚠️ 【文末确认】务必包含完整的 <div class="answer-section"><h2>答案与解析</h2>...</div> 区域，不得省略。\n🔴 【填空格式再次确认】句中填空用 <u class="blank-N">&emsp;</u>（横线），句末/题末独立括号用 <span class="blank-N">&emsp;</span>（括号，含 &emsp; 内容）。横线与括号互斥，同一空位二选一不可叠加。严禁空标签！严禁 ___ 下划线！',
    builtin: true
  },
  {
    id: 'tailconst_errorbook', name: '【尾约束】错题本', category: '生成-尾约束', type: 'fragment',
    subject: '', stage: '', genType: 'errorbook', prompt_order: 90,
    content: '⚠️ 【文末确认】务必包含完整的 <div class="answer-section"><h2>答案与解析</h2>...</div> 区域，所有错题的正确解法、变式练习答案和方法归纳都需要提供，不得省略。\n🔴 【填空格式再次确认】句中填空用 <u class="blank-N">&emsp;</u>（横线），句末/题末独立括号用 <span class="blank-N">&emsp;</span>（括号，含 &emsp; 内容）。横线与括号互斥，同一空位二选一不可叠加。严禁空标签！严禁 ___ 下划线！',
    builtin: true
  },
  {
    id: 'tailconst_exam', name: '【尾约束】考卷', category: '生成-尾约束', type: 'fragment',
    subject: '', stage: '', genType: 'exam', prompt_order: 90,
    content: '⚠️ 【文末确认】务必在最后一题之后，包含完整的 <div class="answer-section"><h2>答案与解析</h2>...</div> 区域。不得省略。\n🔴 【填空格式再次确认】句中填空用 <u class="blank-N">&emsp;</u>（横线），句末/题末独立括号用 <span class="blank-N">&emsp;</span>（括号，含 &emsp; 内容）。横线与括号互斥，同一空位二选一不可叠加。严禁空标签！严禁 ___ 下划线！',
    builtin: true
  },
  {
    id: 'tailconst_practice', name: '【尾约束】课时练', category: '生成-尾约束', type: 'fragment',
    subject: '', stage: '', genType: 'practice', prompt_order: 90,
    content: '⚠️ 【文末确认】务必在最后一题之后，包含完整的 <div class="answer-section"><h2>答案与解析</h2>...</div> 区域。所有题目（含选择题）都需提供答案和解析，不得省略。\n🔴 【填空格式再次确认】句中填空用 <u class="blank-N">&emsp;</u>（横线），句末/题末独立括号用 <span class="blank-N">&emsp;</span>（括号，含 &emsp; 内容）。横线与括号互斥，同一空位二选一不可叠加。严禁空标签！严禁 ___ 下划线！',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 通用约束（原 生成-学段控制 已删除，学段控制已并入 生成-学段适配）
  // ═══════════════════════════════════════
  {
    id: 'frag_question_source', name: '标注题目出处', category: '生成-通用约束', type: 'fragment',
    prompt_order: 32,
    subject: '', stage: '', genType: 'special,errorbook',
    content: '每道题后标注【对应课文：XXX】【知识点：XXX】。',
    builtin: true
  },
  {
    id: 'frag_avoid_direct_copy', name: '避免照搬教材原题', category: '生成-通用约束', type: 'fragment',
    prompt_order: 32,
    subject: '', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,summary',
    content: '避免直接照搬教材原题，应对教材题目进行适当改编（如变换数据、调整问法、逆向设问），保证原创性。',
    builtin: true
  },
  {
    id: 'frag_cognitive_low', name: '认知层级-小学低段', category: '生成-通用约束', type: 'fragment',
    prompt_order: 32,
    subject: '', stage: 'primary', genType: 'special,errorbook',
    content: '每道题后标注认知层级。小学低段（1-2年级）：【识记/理解/简单应用】。',
    builtin: true
  },
  {
    id: 'frag_cognitive_mid', name: '认知层级-小学中段', category: '生成-通用约束', type: 'fragment',
    prompt_order: 32,
    subject: '', stage: 'primary', genType: 'special,errorbook',
    content: '每道题后标注认知层级。小学中段（3-4年级）：【识记/理解/应用/简单分析】。',
    builtin: true
  },
  {
    id: 'frag_cognitive_high', name: '认知层级-小学高段', category: '生成-通用约束', type: 'fragment',
    prompt_order: 32,
    subject: '', stage: 'primary', genType: 'special,errorbook',
    content: '每道题后标注认知层级。小学高段（5-6年级）：【理解/应用/分析/简单评价】。',
    builtin: true
  },
  {
    id: 'frag_cognitive_middle', name: '认知层级-初中', category: '生成-通用约束', type: 'fragment',
    prompt_order: 32,
    subject: '', stage: 'middle', genType: 'special,errorbook',
    content: '每道题后标注认知层级。初中：【识记/理解/应用/分析】。',
    builtin: true
  },
  {
    id: 'frag_cognitive_high_sch', name: '认知层级-高中', category: '生成-通用约束', type: 'fragment',
    prompt_order: 32,
    subject: '', stage: 'high', genType: 'special,errorbook',
    content: '每道题后标注认知层级。高中：【理解/应用/分析/评价/创造】。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 学科特色（按学科自动匹配注入）
  // ═══════════════════════════════════════
  { id: 'subject_chinese', name: '[语文] 读写结合+文化浸润', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '语文', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '语文资料应体现读写结合理念，阅读后设微写作任务；小学阶段注意拼音标注、田字格生字和朗读/背诵题型；适当融入传统文化元素（经典诗文、书法赏析、传统节日）。\n- 阅读理解题答案不可在原文中直接摘抄，需经过归纳转换\n- 习作题须有明确写作要求和字数限制\n- 古诗词默写题不考非课标推荐篇目\n', builtin: true },
  { id: 'subject_math_primary', name: '[数学] 口算竖式+生活建模', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '数学', stage: 'primary', genType: 'exam,practice,special,errorbook,reading', content: '数学资料应联系生活实际，考查从现实情境抽象数学模型的能力；计算题注意口算和竖式格式规范。\n- 答案必须精确（除非题目要求保留小数位）；单位统一不可遗漏\n- 几何题必须给出完整已知条件\n- 选择题四个选项不可"一个明显正确+三个明显错误"\n- 计算题要求完整解题过程（解、列式、计算、答）\n', builtin: true },
  { id: 'subject_math_secondary', name: '[数学] 完整解题+抽象建模', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '数学', stage: 'middle', genType: 'exam,practice,special,errorbook,reading', content: '数学资料应联系生活实际，考查从现实情境抽象数学模型的能力；计算题要求完整解题过程（解、列式、计算、答）。\n- 答案必须精确（除非题目要求保留小数位）；单位统一不可遗漏\n- 几何题必须给出完整已知条件\n- 选择题四个选项不可"一个明显正确+三个明显错误"\n- 计算题要求完整解题过程（解、列式、计算、答）\n', builtin: true },
  { id: 'subject_math_high', name: '[数学] 严谨推理+高考规范', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '数学', stage: 'high', genType: 'exam,practice,special,errorbook,reading', content: '数学资料应联系生活实际，考查从现实情境抽象数学模型的能力；计算题要求严谨的完整解题过程，对标高考答题规范。\n- 答案必须精确（除非题目要求保留小数位）；单位统一不可遗漏\n- 几何题必须给出完整已知条件\n- 选择题四个选项不可"一个明显正确+三个明显错误"\n- 计算题要求完整解题过程（解、列式、计算、答）\n', builtin: true },
  { id: 'subject_english', name: '[英语] 语篇驱动+四线三格', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '英语', stage: '', genType: 'exam,practice,special,errorbook,reading,preview', content: '英语资料应以语篇为单位，避免孤立考查语法词汇；小学阶段英文书写（汉译英/单词默写）用四线三格格式，中文翻译（英译汉）用普通横线格式；英语资料全部为笔试内容，注重读写综合训练。\n- 题干本身禁止出现语法错误；选项禁止出现不存在的单词或搭配\n- 阅读理解取材不超出本学段词汇量范围\n- 🚫 严禁出现任何听力题（听音选图/听对话/听短文/听独白/听力填空等）或口语题（情景对话/角色扮演/口头报告等）——英语资料全部为笔试内容\n', builtin: true },
  { id: 'subject_physics', name: '[物理] 实验探究+公式规范', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '物理', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '物理资料应设置实验探究题，考查实验设计、数据处理、结论推导能力；计算题须写公式→代入→结果三步；作图题标注清晰。\n- 禁止混淆物理量和单位\n- 禁止实验题中要求"观察"微观现象（如分子、原子运动）\n- 禁止力分析图中遗漏关键力\n- 计算题须写公式→代入→结果三步\n', builtin: true },
  { id: 'subject_chemistry', name: '[化学] 实验安全+方程式', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '化学', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '化学资料应包括化学方程式书写、实验装置图识别、物质推断题；涉及实验操作须强调安全注意事项；离子和化合价用上标/下标格式标注。\n- 禁止化学方程式未配平或缺少反应条件\n- 禁止实验操作违反安全规范（浓硫酸稀释、加热易燃气体等需明确安全提示）\n- 禁止混淆化学式、电子式、结构式\n', builtin: true },
  { id: 'subject_biology', name: '[生物] 图表分析+实验设计', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '生物', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '生物资料应包含图表数据分析题（曲线图/柱状图/表格）、实验设计题（对照/变量/结论）；注重结构与功能相适应的生命观念。\n- 禁止生物学概念使用俗称而非规范术语\n- 禁止实验设计未明确控制变量（对照/变量/结论须完整）\n- 禁止混淆结构与功能的关系\n', builtin: true },
  { id: 'subject_history', name: '[历史] 史料实证+时序梳理', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '历史', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '历史资料应包含史料分析题（文字/图片/表格史料）、时序梳理题（时间轴/大事年表）；注重论从史出、史论结合。\n- 禁止历史事件的时间、地点、人物张冠李戴\n- 禁止用现代价值观简单评判历史事件\n- 禁止史料分析题使用虚构史料\n- 注重论从史出、史论结合\n', builtin: true },
  { id: 'subject_geography', name: '[地理] 地图技能+区域认知', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '地理', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '地理资料应包含地图判读题（等高线/气候图/政区图）、区域比较分析题；注重人地协调观和空间思维能力。\n- 禁止编造地理数据（经纬度、海拔、面积等须真实可查）\n- 禁止混淆地理概念（如天气与气候、地形与地势）\n- 禁止地图缺少比例尺、图例、方向标\n', builtin: true },
  { id: 'subject_politics', name: '[政治] 时政分析+价值引领', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '道德与法治,政治', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '政治/道法资料应包含时政材料分析题、情境判断题、开放性论述题；注重社会主义核心价值观引领和法治意识培养。\n- 禁止法律条文引用不准确或自行编造\n- 禁止案例分析脱离学生认知水平和生活经验\n- 禁止时政材料数据来源不明或编造\n- 禁止辨析题立场模糊或价值导向错误\n', builtin: true },
  // 🔧 新增：K12全学科覆盖
  { id: 'subject_science', name: '[科学] 观察探究+实验记录', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '科学', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '科学资料应从生活现象出发，考查观察、实验、推理能力；包含实验设计题（明确变量/步骤/结论）、观察记录题（图表/文字）、科学阅读题；小学阶段配实物图和实验示意图。\n- 禁止科学概念使用非规范表述\n- 禁止实验步骤缺少安全提示\n- 禁止观察记录题缺少明确的观察指标\n- 从生活现象出发，考查观察、实验、推理能力\n', builtin: true },
  { id: 'subject_it_primary', name: '[信息技术] 信息意识-小学', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '信息技术,信息科技', stage: 'primary', genType: 'exam,practice,special,errorbook,reading', content: '信息技术资料应结合实际应用场景；小学侧重信息意识和数字化学习，题目生活化、操作化。\n- 禁止操作步骤顺序错误或遗漏关键步骤\n- 禁止编程题代码存在语法错误\n- 禁止使用已淘汰的技术术语\n- 操作步骤和代码示例必须实际可执行\n', builtin: true },
  { id: 'subject_it_middle', name: '[信息技术] 算法思维-初中', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '信息技术,信息科技', stage: 'middle', genType: 'exam,practice,special,errorbook,reading', content: '信息技术资料应结合实际应用场景；初中侧重算法思维和数据处理，可考查简单流程图和伪代码。\n- 禁止操作步骤顺序错误或遗漏关键步骤\n- 禁止编程题代码存在语法错误\n- 禁止使用已淘汰的技术术语\n- 操作步骤和代码示例必须实际可执行\n', builtin: true },
  { id: 'subject_it_high', name: '[信息技术] Python编程-高中', category: '生成-学科特色', prompt_order: 18, type: 'fragment', subject: '信息技术,信息科技', stage: 'high', genType: 'exam,practice,special,errorbook,reading', content: '信息技术资料应结合实际应用场景；高中侧重Python编程和算法设计，对标学业水平考试要求。', builtin: true },

  // ═══════════════════════════════════════
  // 特殊要求（考试/练习类专用）  （原 生成-题量控制/难度控制 已删除，题量/难度控制已并入 生成-资料类型结构 和 生成-难度配置）
  // ═══════════════════════════════════════
  {
    id: 'special_analysis', name: '答案含详细解析', category: '生成-特殊要求', type: 'fragment',
    prompt_order: 41,
    subject: '', stage: '', genType: 'exam,practice,special,errorbook',
    content: '请为每道题目提供详细的解析和解题思路，包括易错点提示和方法归纳。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 输出格式（考试类专用：答题卡/密封线/评分标准已移至 buildGenerationInstruction 的 exam 格式段）
  // ═══════════════════════════════════════
  {
    id: 'format_table', name: '题目排版（禁止滥用表格）', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: 'primary', genType: 'exam,practice',
    content: '选择题选项用<p class="option">逐行排列，每题选项间空行分隔，自然纵向对齐。仅当选项含多列对比数据或需严格行列对齐（如矩阵型选择题）时可用<table>辅助。填空题用<p>包裹题干，<u class="blank-N">标记留空处。⚠️ 禁止用<table>包裹整道大题、整节题目或整份试卷——表格仅用于数据呈现，不用于排版布局。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 情境要求
  // ═══════════════════════════════════════
  {
    id: 'context_real_primary', name: '真实情境-小学', category: '生成-情境要求', type: 'fragment',
    prompt_order: 38,
    subject: '', stage: 'primary', genType: 'exam,practice,special,reading',
    content: '命题应创设真实生活情境，考查知识迁移能力。小学阶段用校园/家庭/游戏场景。',
    builtin: true
  },
  {
    id: 'context_real_middle', name: '真实情境-初中', category: '生成-情境要求', type: 'fragment',
    prompt_order: 38,
    subject: '', stage: 'middle', genType: 'exam,practice,special,reading',
    content: '命题应创设真实生活情境，考查知识迁移能力。初中阶段用社会/科技/环保场景。',
    builtin: true
  },
  {
    id: 'context_real_high', name: '真实情境-高中', category: '生成-情境要求', type: 'fragment',
    prompt_order: 38,
    subject: '', stage: 'high', genType: 'exam,practice,special,reading',
    content: '命题应创设真实生活情境，考查知识迁移能力。高中阶段用学术/职业/前沿场景。',
    builtin: true
  },
  {
    id: 'context_tradition', name: '融入传统文化', category: '生成-情境要求', type: 'fragment',
    prompt_order: 38,
    subject: '语文,历史,道德与法治', stage: '', genType: 'exam,practice,special,reading',
    content: '适当融入中华优秀传统文化元素，如经典诗文、传统节日、历史典故、书法艺术、传统科技成就。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 语文学科专项：生字笔顺与字典式信息规范
  // ═══════════════════════════════════════
  {
    id: 'chinese_stroke_order', name: '语文-生字格式规范', category: '生成-学科特色', type: 'fragment',
    prompt_order: 18,
    subject: '语文', stage: 'primary', genType: 'preview,dictation,summary,review',
    content: '每个生字独立用<span class="tian-zi-ge">字</span>包裹，按字典式标注三项信息：①部首 ②笔画数 ③字形结构（上下/左右/包围/独体等）。不要求标注笔顺（笔顺错误率高，不做要求）。格式示例：<span class="tian-zi-ge">蝌</span>（部首：虫，15画，左右结构）。禁止只写字和拼音不写部首/笔画/结构！',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【题目质量标准】块级指令（按资料类型+学科区分）
  // ═══════════════════════════════════════
  {
    id: 'block_quality_base', name: '【题目质量标准】通用', category: '生成-题目质量标准', type: 'fragment',
    prompt_order: 25,
    subject: '', stage: '', genType: 'exam,practice,special,errorbook,reading,preview',
    content: '请确保每道题都达到以下标准：\n1. 题干表述精炼、无歧义，一道题只说一件事\n2. 选择题的所有选项长度相近、风格一致，错误选项要有迷惑性但不是明显错误\n3. 选择题的正确选项随机分布在A/B/C/D中，不固定位置\n4. 不得使用"以下哪个选项是正确的""下列说法正确的是"等无信息量的中文设问方式（英语题的标准指令语如 Choose/Read/Fill 等祈使句除外）\n5. 填空题的空格应在关键位置（如计算结果、概念名称），不得在非关键位置设空\n6. 每道题的答案必须是确定的、唯一的，不得有歧义\n7. 同级难度的题目应保持相近的区分度（不能有的极简单有的极难）\n8. 计算题和应用题的数据应符合实际，不得出现反常识数据',
    builtin: true
  },
  {
    id: 'block_quality_primary_low', name: '【题目质量标准】小学低段1-2年级', category: '生成-题目质量标准', type: 'fragment',
    prompt_order: 25,
    subject: '', stage: 'primary_low', genType: 'exam,practice,special,errorbook,reading',
    content: '小学低段补充质量标准：\n- 选择题选项不超过3个，选项长度相近、风格一致\n- 基础题考查核心概念的直接应用，中档题需要简单推理，提高题为趣味挑战\n- 题干简洁，语言口语化',
    builtin: true
  },
  {
    id: 'block_quality_primary_mid', name: '【题目质量标准】小学中段3-4年级', category: '生成-题目质量标准', type: 'fragment',
    prompt_order: 25,
    subject: '', stage: 'primary_mid', genType: 'exam,practice,special,errorbook,reading',
    content: '小学中段补充质量标准：\n- 选择题选项不超过4个，选项长度相近、风格一致\n- 基础题考查核心概念的直接应用，中档题需要简单推理，提高题为趣味挑战\n- 增加段落阅读量，提升文本理解能力',
    builtin: true
  },
  {
    id: 'block_quality_primary_high', name: '【题目质量标准】小学高段5-6年级', category: '生成-题目质量标准', type: 'fragment',
    prompt_order: 25,
    subject: '', stage: 'primary_high', genType: 'exam,practice,special,errorbook,reading',
    content: '小学高段补充质量标准：\n- 选择题选项不超过4个，选项长度相近、风格一致\n- 基础题考查核心概念的直接应用，中档题需要2-3步推理，提高题为综合运用\n- 为初中衔接做准备',
    builtin: true
  },
  {
    id: 'block_quality_middle', name: '【题目质量标准】初中', category: '生成-题目质量标准', type: 'fragment',
    prompt_order: 25,
    subject: '', stage: 'middle', genType: 'exam,practice,special,errorbook,reading',
    content: '初中补充质量标准：\n- 基础题考查核心概念的直接应用，中档题需要2-3步推理，较难题需要综合运用\n- 选择题选项4个，正确选项随机分布，错误选项要有迷惑性',
    builtin: true
  },
  {
    id: 'block_quality_high', name: '【题目质量标准】高中', category: '生成-题目质量标准', type: 'fragment',
    prompt_order: 25,
    subject: '', stage: 'high', genType: 'exam,practice,special,errorbook,reading',
    content: '高中补充质量标准：\n- 基础题考查核心概念的直接应用，中档题需要2-3步推理，较难题需要综合运用或创新思维\n- 选择题选项4个，正确选项随机分布，错误选项要有迷惑性',
    builtin: true
  },
  // 学科专属质量标准
  { id: 'block_quality_math', name: '【题目质量标准】数学', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '数学', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '数学：计算题必须有确定答案，不能用"约""大约"而不说明精度；应用题中的数据单位必须标注清楚', builtin: true },
  { id: 'block_quality_physics', name: '【题目质量标准】物理', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '物理', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '物理：物理量单位必须使用国际单位制或明确标注；实验题的操作步骤必须实际可行', builtin: true },
  { id: 'block_quality_chemistry', name: '【题目质量标准】化学', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '化学', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '化学：化学方程式必须配平，反应条件必须标注；化学计算的相对原子质量如需使用应在题中给出', builtin: true },
  { id: 'block_quality_chinese', name: '【题目质量标准】语文', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '语文', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '语文：阅读理解题的答案不能直接在原文中找到原句；作文题必须明确字数要求和文体要求', builtin: true },
  { id: 'block_quality_english', name: '【题目质量标准】英语', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '英语', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '英语：选项中的语法必须全部正确，不能通过语法错误来制造错误选项；题干的情境必须完整；每道英语题的题干必须以句号(.)、问号(?)或感叹号(!)结尾（指令型题干如Read/Choose/Fill等祈使句除外）；同一份练习中题型必须多样化（填空、选择、连线、判断、补全对话、造句等至少3种不同题型），严禁全部使用选择题', builtin: true },
  { id: 'block_quality_biology', name: '【题目质量标准】生物', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '生物', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '生物：生物学术语必须使用规范名称，不得使用俗称；实验设计题的变量设置必须明确', builtin: true },
  { id: 'block_quality_history', name: '【题目质量标准】历史', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '历史', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '历史：历史事件的时序必须正确，不得张冠李戴；史料分析题的史料出处必须真实可查', builtin: true },
  { id: 'block_quality_geography', name: '【题目质量标准】地理', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '地理', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '地理：地图中的经纬度、比例尺、图例必须规范准确；地理数据不得编造，必须基于可靠来源', builtin: true },
  { id: 'block_quality_politics', name: '【题目质量标准】道法/政治', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '道德与法治,政治,思想政治', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '道法/政治：法律条文引用必须准确，不得自行编写；案例分析题的情境必须符合学生认知水平', builtin: true },
  { id: 'block_quality_science', name: '【题目质量标准】科学', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '科学', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '科学：科学概念和术语必须使用规范名称；实验设计题的变量必须明确', builtin: true },
  { id: 'block_quality_it', name: '【题目质量标准】信息技术', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment', subject: '信息技术,信息科技', stage: '', genType: 'exam,practice,special,errorbook,reading', content: '信息技术：操作步骤必须顺序正确、实际可行；编程题代码示例必须语法正确、可直接运行', builtin: true },

  // ═══════════════════════════════════════
  // 【禁止项】块级指令（通用块为母本参考，实际注入使用各学科自包含块）
  // ═══════════════════════════════════════
  {
    id: 'block_ban_general', name: '【禁止项-通用】母本参考', category: '生成-禁止项', type: 'fragment',
    prompt_order: 31,
    subject: '', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,review,dictation,summary',
    content: '- 禁止超纲内容（严格按照所属学段课程标准）\n- 禁止科学性错误\n- 禁止偏题怪题（考查冷门知识点）\n- 禁止脱离教材随意发挥\n- 禁止出现政治敏感内容\n- 禁止出现歧视性表述（性别、地域、民族等）\n- 禁止同一份资料中出现考查点完全相同的两道题',
    builtin: true
  },
  { id: 'block_ban_math', name: '【禁止项】数学', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '数学', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '数学禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（计算错误、概念错误、公式错误、单位错误）\n- 禁止偏题怪题（考查冷门知识点、解法极其特殊）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_math_primary_low', name: '【禁止项】数学-小学低段', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '数学', stage: 'primary_low', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '', builtin: true },
  { id: 'block_ban_physics', name: '【禁止项】物理', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '物理', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '物理禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（计算错误、概念错误、公式错误、单位错误）\n- 禁止偏题怪题（考查冷门知识点、解法极其特殊）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_chinese', name: '【禁止项】语文', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '语文', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '语文禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（字形错误、拼音错误、标点错误、语法错误、文学常识错误）\n- 禁止偏题怪题（考查极其冷僻的字词或过度引申的理解）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_english', name: '【禁止项】英语', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '英语', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '英语禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（拼写错误、语法错误、用词不当）\n- 禁止偏题怪题（考查非课标词汇或极其罕见的语法现象）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_chemistry', name: '【禁止项】化学', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '化学', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '化学禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（方程式错误、概念错误、计算错误、单位错误）\n- 禁止偏题怪题（考查冷门知识点、解法极其特殊）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_biology', name: '【禁止项】生物', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '生物', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '生物禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（概念错误、分类错误、生理过程错误）\n- 禁止偏题怪题（考查极其冷僻的生物名词或过度细节）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_history', name: '【禁止项】历史', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '历史', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '历史禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（年代错误、事件张冠李戴、人物混淆）\n- 禁止偏题怪题（考查极其冷僻的史料或过度细节的年份）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_geography', name: '【禁止项】地理', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '地理', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '地理禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（地名错误、地理概念混淆、数据错误）\n- 禁止偏题怪题（考查极其冷僻的地名或过度复杂的数据）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_politics', name: '【禁止项】道法/政治', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '道德与法治,政治,思想政治', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '道法/政治禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（法律条文错误、概念混淆、政策理解偏差）\n- 禁止偏题怪题（考查极其冷僻的法律条文或过度细节的政策）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_science', name: '【禁止项】科学', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '科学', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '科学禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（概念错误、实验原理错误、数据编造）\n- 禁止偏题怪题（考查极其冷僻的科学现象或非课标要求的实验操作）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },
  { id: 'block_ban_it', name: '【禁止项】信息技术', category: '生成-禁止项', prompt_order: 31, type: 'fragment', subject: '信息技术,信息科技', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,dictation,summary,review', content: '信息技术禁止项：\n\n【硬性红线】\n- 禁止超纲（严格按本学段课标）\n- 禁止科学性错误（语法错误、概念错误、操作步骤错误）\n- 禁止偏题怪题（考查极其冷僻的软件操作或淘汰的技术概念）\n- 禁止脱离教材随意发挥\n- 禁止政治敏感、歧视性表述\n- 禁止同知识点重复考查\n\n', builtin: true },

  // ═══════════════════════════════════════
  // 【答案与解析规范】块级指令  （原 生成-学科核心素养 已删除，核心素养已内化至 生成-资料类型结构 新课标块）
  // ═══════════════════════════════════════
  {
    id: 'block_answer_spec', name: '【答案与解析规范】通用', category: '生成-答案与解析规范', type: 'fragment',
    prompt_order: 26,
    subject: '', stage: '', genType: '',
    content: '以下为教辅级答案质量标准，请严格遵守以确保输出质量对标市面教辅。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【原题引用】块级指令
  // ═══════════════════════════════════════
  {
    id: 'block_original_quote', name: '【原题引用】允许适量引用', category: '生成-原题引用', type: 'fragment',
    prompt_order: 30,
    subject: '', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,summary',
    content: '允许适量引用教材原题，但必须经过改编或拓展，不得照抄。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【质量范例】块级指令（few-shot，按学科×资料类型×学段区分）
  // ═══════════════════════════════════════
  {
    id: 'block_example_exam_chinese_lower', name: '【质量范例】低段语文试卷', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文', stage: 'primary_low', genType: 'exam,practice', specialSubType: 'new_standard',
    content: '字词基础题示例："看拼音，写词语：chūn tiān(<u class="blank-4">&emsp;</u>) huā duǒ(<u class="blank-4">&emsp;</u>)" — 拼音和词语均来自教材生字表，不超纲。\n课文理解题示例："《小蝌蚪找妈妈》中，小蝌蚪先长出了什么？A.前腿 B.后腿" — 选项明确，考查课文关键情节，不涉及复杂推理。\n写话示例："看图写几句话" — 配情境图，要求写几句完整的话即可，不指定字数。',
    builtin: true
  },
  {
    id: 'block_example_exam_chinese_mid', name: '【质量范例】中段语文试卷', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文', stage: 'primary_mid', genType: 'exam,practice', specialSubType: 'new_standard',
    content: '基础知识应覆盖：多音字辨析、近义词选词填空、成语积累运用、修改病句、句式变换，每题标注分值。\n阅读理解题：选文300-400字，题目覆盖信息提取→关键词句理解→段落大意概括三个层次。\n习作题：300字左右命题作文，给出明确的写作要求和简要写作提示。',
    builtin: true
  },
  {
    id: 'block_example_exam_chinese_high', name: '【质量范例】高段语文试卷', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文', stage: 'primary_high', genType: 'exam,practice', specialSubType: 'new_standard',
    content: '基础知识应覆盖：汉字书写规范、词语感情色彩辨析、关联词运用、修辞手法判断、古诗文默写与理解。\n阅读理解题：选文400-600字，题目覆盖信息提取→词句理解→篇章结构→写作手法→思想感情五个层次。\n非连续性文本阅读：提供图表/说明书/广告等，考查信息提取与综合运用能力。\n习作题：400-500字命题/半命题作文，给出明确的写作要求，配简要的写作提示。',
    builtin: true
  },
  {
    id: 'block_example_exam_chinese', name: '【质量范例】语文试卷', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文', stage: '', genType: 'exam,practice', specialSubType: 'new_standard',
    content: '基础知识题应覆盖：字音字形、词语运用、句子练习、古诗文积累，每题分值明确。\n阅读理解题：选文长度与年级匹配，题目覆盖信息提取→词句理解→主旨概括三个层次。\n习作题：给出明确的写作要求（主题/文体/字数），配简要的写作提示。',
    builtin: true
  },
  {
    id: 'block_example_exam_math_lower', name: '【质量范例】低段数学考试/课时练', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '数学', stage: 'primary_low', genType: 'exam,practice',
    content: '口算题示例："3+5=□  8-2=□" — 数字在20以内，考查基本加减法。\n应用题示例："树上有7只小鸟，飞走了3只，还剩几只？" — 一步计算，情境贴近生活。\n数字不超100。',
    builtin: true
  },
  {
    id: 'block_example_exam_math_mid', name: '【质量范例】中段数学考试/课时练', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '数学', stage: 'primary_mid', genType: 'exam,practice',
    content: '计算题应有层次：口算（万以内加减、两位数乘一位数）→竖式计算（三位数加减、一位数乘除两位数）→脱式计算（两步混合运算）。\n应用题示例："一本书有240页，小明每天看35页，看了一个星期（7天）后还剩多少页？" — 两步计算：先乘后减，数据合理、中间结果易算。\n所有题目数据不超万位，分数/小数仅限初步认识阶段（分母不超过10，一位小数）。',
    builtin: true
  },
  {
    id: 'block_example_exam_math_high', name: '【质量范例】高段数学考试/课时练', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '数学', stage: 'primary_high', genType: 'exam,practice',
    content: '计算题分层次：口算→小数乘除法竖式→分数四则运算→简便计算（运用运算律）。\n应用题示例："一个三角形花坛，底边长12.5米，高8米。如果每平方米种9株花，一共可以种多少株？" — 多步计算：先求面积再求总数，中间步骤有实际意义。\n综合题：融入几何（周长/面积/体积）、统计图表（提取信息计算）、方程思想等跨知识点考查。\n所有计算数据结果应为整数或有限小数，避免除不尽的情况。',
    builtin: true
  },
  {
    id: 'block_example_exam_math', name: '【质量范例】数学考试/课时练', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '数学', stage: '', genType: 'exam,practice',
    content: '计算题应有层次：基础口算→竖式计算→脱式计算/简算，逐步增加复杂度。\n应用题情境真实、数据合理，每道题考查一个核心知识点，多步计算的中间结果应为整数或简单小数。',
    builtin: true
  },
  {
    id: 'block_example_exam_english_lower', name: '【质量范例】低段英语试卷/课时练', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '英语', stage: 'primary_low', genType: 'exam,practice',
    content: '词汇选择题示例："I have a ___. A. apple B. banana C. cat D. dog" — 选项词性一致（均为名词），干扰项与正确项属同一语义场，不混入不同词性。\n看图选词/连线示例：配教材单元主题图，词汇标注格式 <strong>apple</strong> <span class="phonetic">/ˈæpəl/</span> <em>n.</em>，词性用英文缩写（n./v./adj./adv./prep./pron.等），禁止用中文"名词""动词"。\n句型题示例："— ___ is your name? — My name is Tom." 选项 A. What B. How C. Who — 考查疑问词辨析，每个选项都是同一词类。\n情境对话示例：给出简短对话（若干来回），留一个空选择/填写，语境清晰、选项不引入新词。',
    builtin: true
  },
  {
    id: 'block_example_exam_english_mid', name: '【质量范例】中段英语试卷/课时练', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '英语', stage: 'primary_mid', genType: 'exam,practice',
    content: '词汇题词性标注必须用英文缩写（n./v./adj./adv./prep./pron.），严禁中文词性。\n语法选择题示例："My mother ___ in a hospital. A. work B. works C. working D. to work" — 考查一般现在时第三人称单数，所有选项为同一动词的不同形式。\n情景对话示例：给出4-5句话的简短对话，留若干空选择/填写，语境清晰、选项不超纲。\n阅读理解：选文60-80词，配若干道单选题（信息提取、简单推断），文中生词配中文注释。',
    builtin: true
  },
  {
    id: 'block_example_exam_english_high', name: '【质量范例】高段英语试卷/课时练', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '英语', stage: 'primary_high', genType: 'exam,practice',
    content: '词汇题词性标注用英文缩写，首次出现生词配中文注释（括号内）。\n语法选择题示例："She ___ to Beijing last summer. A. go B. goes C. went D. will go" — 选项覆盖不同时态制造干扰，考查一般过去时。\n完形填空：选文词数适中，留若干空，每空4个选项（1正确、3干扰：近义干扰、语法干扰、逻辑干扰），首尾句不挖空。\n阅读理解：选文100-120词，配若干道题（2细节、1推断、1词义猜测、1主旨），体裁多样（对话/记叙/说明/应用文）。\n书面表达：短文，明确写作目的、词数要求，配若干参考词汇/句型提示。',
    builtin: true
  },
  {
    id: 'block_example_exam_english', name: '【质量范例】英语试卷/课时练', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '英语', stage: '', genType: 'exam,practice',
    content: '词汇题词性标注必须用英文缩写：n.（名词）/ v.（动词）/ adj.（形容词）/ adv.（副词）/ prep.（介词）/ pron.（代词）/ conj.（连词）/ num.（数词）/ art.（冠词），严禁出现"名词""动词"等中文词性。题干中首次出现生词需配中文注释（括号内）。\n语法选择题示例："She ___ to school every day. A. go B. goes C. going D. gone" — 所有选项为同一动词的不同形式，通过时态/主谓一致制造干扰，不混入无关词。\n完形填空：选文长度与年级匹配（小学≤100词/初中≤200词/高中≤300词），挖空间距至少4词。首尾句不挖空。每空4个选项：1个正确+3个干扰（1个近义/同形干扰、1个语法干扰、1个逻辑干扰）。\n阅读理解：选文体裁多样（对话/记叙/说明/应用文），题量若干道（覆盖细节、推断、词义、主旨各层次），禁止出现"Which of the following is NOT true"以外的全否定题干。\n书面表达：给出明确的写作目的、读者对象、词数要求，配若干参考词汇/句型提示。',
    builtin: true
  },
  {
    id: 'block_example_dictation_chinese', name: '【质量范例】语文默写', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文', stage: '', genType: 'dictation', specialSubType: 'new_standard',
    content: '生字格式：<span class="tian-zi-ge">字</span>（部首：X，X画，XX结构）\n每个生字必须标注：①部首 ②笔画数 ③字形结构（不要求笔顺）。\n生字按教材生字表顺序排列，默写后配若干组词示例。',
    builtin: true
  },
  {
    id: 'block_example_preview_chinese_lower', name: '【质量范例】低段语文预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文', stage: 'primary_low', genType: 'preview', specialSubType: 'new_standard',
    content: '字词预习示例：每个生字配拼音、部首、笔画、结构（不要求笔顺）、组2个词。\n课文感知：提若干个引导性问题（如"课文讲了谁的故事？""你最喜欢哪个角色？为什么？"）。\n预习检测：若干道基础填空题，答案可直接在教材中找到。',
    builtin: true
  },
  {
    id: 'block_example_preview_chinese_mid', name: '【质量范例】中段语文预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文', stage: 'primary_mid', genType: 'preview', specialSubType: 'new_standard',
    content: '字词预习：每个生字配拼音、部首、笔画、结构、组词（2-3个），多音字标注不同读音和组词。\n课文感知：提若干个引导性问题，覆盖课文内容理解（"课文主要讲了什么？""从哪里可以看出来？""作者为什么要这样写？"）。\n好词好句积累：摘抄课文中的优美词句，标注修辞手法（比喻/拟人/排比等）。\n预习检测：若干道基础题（字音字形、内容理解、简单赏析），答案放文末。',
    builtin: true
  },
  {
    id: 'block_example_preview_chinese_high', name: '【质量范例】高段语文预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文', stage: 'primary_high', genType: 'preview', specialSubType: 'new_standard',
    content: '字词预习：生字词配拼音、部首、笔画、结构、释义、组词（3个以上），关注文言实词和古今异义词。\n课文感知：提若干个引导性问题，覆盖内容理解+写作手法（"作者用了什么方法描写人物？""这样写有什么好处？""文章的结构有什么特点？"）。\n背景知识：补充与课文相关的作者简介/时代背景/文化常识（如古诗词的创作背景、历史典故）。\n预习检测：若干道题（基础知识、内容理解、写法赏析、拓展思考），答案放文末。',
    builtin: true
  },
  {
    id: 'block_example_preview_chinese', name: '【质量范例】语文预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文', stage: '', genType: 'preview', specialSubType: 'new_standard',
    content: '字词预习：生字词配拼音、部首、笔画、结构、释义、组词，按教材生字表顺序排列。\n课文感知：提若干个引导性问题，覆盖内容理解→写作手法→思想感情三个层次。\n背景知识：补充与课文相关的作者/时代/文化背景。\n预习检测：若干道基础题（字词、内容、赏析），答案放文末。',
    builtin: true
  },
  {
    id: 'block_example_preview_english_lower', name: '【质量范例】低段英语预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '英语', stage: 'primary_low', genType: 'preview', specialSubType: 'new_standard',
    content: '单词预习示例：<p><strong>apple</strong> <span class="phonetic">/ˈæpəl/</span> <em>n.</em> 苹果</p> — 每个单词标注音标+英文词性缩写+中文释义，词性严禁用中文。\n句型预习示例：<div class="sentence-pattern"><p class="model">Good morning, <u class="blank-4">&emsp;</u>.</p><p class="usage">早上见面用</p><p class="drill">Good morning, <u class="blank-4">&emsp;</u>.</p></div> — 给出句型结构和交际场景，留空让学生替换练习。\n课文感知：用1-2句中文概括对话大意，标注对话中的关键人物和事件。',
    builtin: true
  },
  {
    id: 'block_example_preview_english_mid', name: '【质量范例】中段英语预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '英语', stage: 'primary_mid', genType: 'preview', specialSubType: 'new_standard',
    content: '单词预习：<p><strong>library</strong> <span class="phonetic">/ˈlaɪbrəri/</span> <em>n.</em> 图书馆</p> — 每个单词配音标+英文词性缩写+中文释义，词性严禁用中文。\n句型预习：<div class="sentence-pattern"><p class="model">What do you do on Sundays?</p><p class="usage">询问周末活动</p><p class="drill">What do you do on Saturdays?</p></div> — 提炼1个核心句型，标注交际场景和问句结构。\n课文感知：用2-3句中文概括对话大意，标注对话中的关键人物和主要事件。\n预习检测：3-4道基础题（单词填空、句型连词成句、对话排序）。',
    builtin: true
  },
  {
    id: 'block_example_preview_english_high', name: '【质量范例】高段英语预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '英语', stage: 'primary_high', genType: 'preview', specialSubType: 'new_standard',
    content: '单词预习：按词性分类列出本课词汇，每个单词配音标+英文词性缩写+中文释义，标注不规则变化形式（如go→went→gone）。\n句型预习：提炼1-2个核心句型，标注交际场景和语法点（如"一般过去时，表示过去发生的动作，动词要用过去式"），给出1个替换练习。\n课文感知：用中文概括课文大意（含时间/地点/人物/事件四要素），标注关键信息点。\n预习检测：4-5道题（单词拼写、句型改写、阅读理解判断），答案放文末。',
    builtin: true
  },
  {
    id: 'block_example_preview_english', name: '【质量范例】英语预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '英语', stage: '', genType: 'preview', specialSubType: 'new_standard',
    content: '单词预习：按词性分类列出本课词汇，每个单词配音标+词性+中文释义，从教材单词表提取。词性用英文缩写（n./v./adj./adv.等），严禁中文词性。\n句型预习：提炼1-2个核心句型，标注交际场景（"询问年龄""表达喜好"等），给出1个替换练习。\n课文感知：用中文概括课文大意，标注关键信息点（who/what/where/when）。\n预习检测：3-5道基础题（单词连线、句型填空、对话排序），答案放文末。',
    builtin: true
  },
  {
    id: 'block_example_preview_math_lower', name: '【质量范例】低段数学预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '数学', stage: 'primary_low', genType: 'preview', specialSubType: 'new_standard',
    content: '概念感知示例："今天我们要学习\'加法\'。加法就是把两个数合在一起，看看一共有多少。比如你有3个苹果，妈妈又给你2个，一共有几个？" — 用生活场景引入概念。\n算理初探示例：展示教材例题"3+2=5"，标注"3表示3个苹果，2表示2个苹果，合起来数一数：1、2、3、4、5"。\n尝试练习：2道基础计算题（留空），数字不超20。',
    builtin: true
  },
  {
    id: 'block_example_preview_math_mid', name: '【质量范例】中段数学预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '数学', stage: 'primary_mid', genType: 'preview', specialSubType: 'new_standard',
    content: '概念感知：用生活场景引入新概念（如"分数"用"一块蛋糕平均分给4个人，每人得到多少？"引入）。\n算理初探：展示1道教材同类例题的分步计算过程，标注每一步的含义（如笔算乘法：先用个位上的数去乘→再用十位上的数去乘→最后相加）。\n方法归纳：总结计算公式或解题口诀（如"四则混合运算，先乘除后加减，有括号先算括号里面的"）。\n尝试练习：2-3道基础题，数据合理（数值不超过教材同类题范围），留空让学生试做，答案放文末。',
    builtin: true
  },
  {
    id: 'block_example_preview_math_high', name: '【质量范例】高段数学预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '数学', stage: 'primary_high', genType: 'preview', specialSubType: 'new_standard',
    content: '概念感知：用对比/类比引入新概念（如"比"用"篮球赛比分3:1和果汁配比3:1，意义一样吗？"引入比的数学含义）。\n算理初探：展示1道典型例题的完整推导过程，标注每个步骤的数学依据（如分数除法"除以一个数等于乘它的倒数"的推导）。\n方法归纳：总结通用解题策略（如"解方程三步骤：①找等量关系 ②设未知数 ③列方程求解并检验"）。\n尝试练习：3-4道基础题+1道变式题（数据变化或条件增减），答案放文末。',
    builtin: true
  },
  {
    id: 'block_example_preview_math', name: '【质量范例】数学预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '数学', stage: '', genType: 'preview', specialSubType: 'new_standard',
    content: '概念感知：从教材中提取一个核心概念，用生活化语言解释（不照搬定义）。\n算理初探：展示1道教材同类例题的分步计算过程，标注每一步的含义。\n方法归纳：总结计算公式或解题口诀。\n尝试练习：2-3道基础题（与例题同类但数据不同），留空让学生试做，答案放文末。',
    builtin: true
  },
  {
    id: 'block_example_preview_science', name: '【质量范例】物理/化学/生物/科学预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '物理,化学,生物,科学', stage: '', genType: 'preview', specialSubType: 'new_standard',
    content: '概念预读示例：提取教材中的核心概念（如"密度"），用通俗语言解释"密度是物质的一种特性，表示单位体积的质量"。\n现象观察示例：如教材有实验，描述实验步骤和预期的颜色变化/气泡/沉淀等可观察现象。\n预习自测：2-3道基础判断题（"所有金属都能被磁铁吸引——对/错"），考查概念理解。',
    builtin: true
  },
  {
    id: 'block_example_exam_science', name: '【质量范例】物理/化学/生物/科学试卷', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '物理,化学,生物,科学', stage: '', genType: 'exam,practice',
    content: '选择题示例："下列物质中，属于纯净物的是（ ）A. 空气 B. 食盐水 C. 蒸馏水 D. 牛奶" — 四个选项属同一层级概念，干扰项考查常见迷思概念（"空气=纯净物""溶液=纯净物"）。\n实验探究题示例："【提出问题】影响食盐溶解快慢的因素有哪些？\n【猜想假设】①可能与水的温度有关；②可能与搅拌有关；③可能与<u class="blank-4">&emsp;</u>有关。\n【设计实验】..." — 实验题应引导学生经历完整的科学探究流程，设空应留关键步骤（假设/变量/结论），不得给出答案提示。\n计算题示例："一个质量为2kg的物体，受到10N的水平拉力，求物体的加速度。\n解：已知 m=2kg, F=10N\n由牛顿第二定律 F=ma 得\na=F/m=10N/2kg=5m/s²\n答：物体的加速度为5m/s²。" — 计算题必须给出"解→公式→代入→计算→答"（初中物理注意控制"已知、求、解、答"格式），每步标注得分点。\n图表题示例：给出坐标系/表格/实验装置图，设问从"识图→读数据→分析趋势→得出结论"四个层次递进。',
    builtin: true
  },
  {
    id: 'block_example_exam_humanities', name: '【质量范例】历史/地理/道法试卷', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '历史,地理,道德与法治,政治,思想政治', stage: '', genType: 'exam,practice',
    content: '材料分析题示例：给出1段史料/地图/时政材料，设2-3问，第1问考查材料信息提取（"根据材料，指出..."），第2问考查知识链接（"结合所学，分析..."），第3问考查综合评价（"谈谈你的认识/启示"）。\n选择题示例："我国根本政治制度是（ ）A. 人民代表大会制度 B. 政治协商制度 C. 民族区域自治制度 D. 基层群众自治制度" — 四个选项均为我国政治制度，考查对"根本"这一限定词的理解。\n填空题示例："明朝时期，郑和<u class="blank-1">&emsp;</u>次下西洋，最远到达<u class="blank-8">&emsp;</u>。" — 空格填核心史实（数字/地名/人名/事件），不填描述性词语。\n地图读图题：给出区域轮廓简图，标注经纬度/山脉/河流/城市，设问从"位置描述→特征分析→区域比较→人地关系"四个层次。',
    builtin: true
  },
  {
    id: 'block_example_preview_humanities', name: '【质量范例】历史/地理/道法预习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '历史,地理,道德与法治,政治,思想政治', stage: '', genType: 'preview', specialSubType: 'new_standard',
    content: '概念预读示例：从教材中提取3-5个核心概念（如"分封制""季风气候""公民权利"），每个概念用通俗语言解释定义，配1个贴近学生生活的实例。\n预习任务示例：设计2-3个可操作的任务——①阅读教材第X页，圈出历史事件的时间/地点/人物；②在地图上标出关键地点；③写下你对"为什么XX会发生"的1个猜想。\n预习检测：3道基础判断题（考查教材可直接找到答案的事实性知识），如"秦始皇统一六国的顺序是：韩→赵→魏→楚→燕→齐（判断对错）"。',
    builtin: true
  },
  {
    id: 'block_example_dictation_english', name: '【质量范例】英语默写', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '英语', stage: '', genType: 'dictation', specialSubType: 'new_standard',
    content: '单词格式："apple /ˈæpəl/ n. 苹果" — 标注音标、英文词性缩写（n./v./adj./adv.等，严禁中文词性）、中文释义。\n短语格式："get up /ɡet ʌp/ 起床" — 标注音标和中文释义。\n按单元词汇表顺序排列，默写量：低段4-6词/中段6-8词/高段8-10词。',
    builtin: true
  },
  {
    id: 'block_example_reading', name: '【质量范例】阅读理解', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '语文,英语', stage: '', genType: 'reading', specialSubType: 'new_standard',
    content: `选文示例：短文长度与年级匹配——小学低段80-150字/高段150-300字；初中300-600字；高中600-1000字。选文标注体裁（记叙/说明/议论/古诗/文言）和出处（教材课文片段/课外名家选段）。\n题目示例（5题标准结构）：第1题考查信息提取——"根据短文，XX的主要特点是什么？"；第2题考查词句理解——"文中画线词'XX'的意思是<u class="blank-8">&emsp;</u>"；第3题考查推断——"从文中可以推断出<u class="blank-8">&emsp;</u>"；第4题考查表达技巧——"文中运用了什么修辞手法？有什么作用？"；第5题考查整体把握——"给短文加一个合适的标题/用一句话概括短文大意"。\n开放性题目示例："你同意文中的观点吗？请结合生活实际谈谈你的看法。（50字以上）"——开放性题目配2-3个角度的示例答案和评分维度。`,
    builtin: true
  },
  {
    id: 'block_example_summary', name: '【质量范例】知识点总结', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '知识结构示例：每个知识点独立成块，用<div class="knowledge-block">包裹——①概念定义（一句话说清楚）；②核心要点（2-3个bullet point，每点≤20字）；③典型例题（1道，配完整答案与解析）；④易错提醒（1-2个常见错误及正确理解）。\n表格示例：知识辨析用左右两列表格——左列"易错概念"（如"质量=重量"），右列"正确理解"（如"质量是物体所含物质的多少，单位kg；重量是地球引力，单位N，二者概念不同"）。',
    builtin: true
  },
  {
    id: 'block_example_errorbook', name: '【质量范例】错题本', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: `错题格式示例：每道错题用<div class="error-item">包裹。\n▶ 原题："下列选项中，哪个不是四边形？A. 正方形 B. 长方形 C. 三角形 D. 梯形"（原题完整复制，标注来源：第X单元测试/课堂练习）。\n▶ 错误归因与素养反思：具体到知识点层面——"混淆了'四边形（4条边）'和'多边形'的概念，三角形只有3条边不属于四边形"，禁止笼统写"粗心"。附错误类型标签如<span class="tag tag-concept">概念混淆</span>。\n▶ 正确解法：分步讲解——"第1步：回顾四边形的定义（由4条线段围成的封闭图形）；第2步：逐个判断——正方形4条边✅、长方形4条边✅、三角形3条边❌、梯形4条边✅；第3步：得出结论，三角形不是四边形，选C"。\n▶ 变式巩固：设计1道同知识点不同题型的新题——"下列图形中，属于四边形的是<u class="blank-8">&emsp;</u>（填序号）①五边形 ②菱形 ③圆形 ④等腰三角形"，附答案和解析。`,
    builtin: true
  },
  {
    id: 'block_example_special', name: '【质量范例】专项突破', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '', stage: '', genType: 'special', specialSubType: 'new_standard',
    content: '专项结构示例：大标题点明专项名称——<h1>专项突破·计算能力训练</h1>。\n典例剖析：选1道典型题，标注"【命题思路】：考查XX知识点，常见陷阱是XX"; "【思路分析】：由条件A → 可推出B → 结合C → 得出结论D"; "【规范解答】：分步写出完整解题过程"; "【方法总结】：提炼1-2句通用解题口诀或思路框架"; "【易错提醒】：指出最常见的错误做法及原因"。\n变式训练：设计3道同题型变式，从易到难排列，每题配简要解析。\n真题实战：选1-2道历年真题/模拟题，标注年份和地区，配详细解析+评分标准+完成时间建议。',
    builtin: true
  },
  {
    id: 'block_example_review', name: '【质量范例】单元/期末复习', category: '生成-质量范例', type: 'fragment',
    prompt_order: 70,
    subject: '', stage: '', genType: 'review', specialSubType: 'new_standard',
    content: '复习资料结构示例：\n知识梳理区：用表格/思维导图形式纵向对比本单元核心知识点，配重难点星级标注（★基础/★★重点/★★★难点、高频考点）。每个知识点后配"易错提醒"（常见错误、正确理解）。\n典型题析区：选3-5道涵盖本单元核心考点的典型题，每道题标注"考查知识点→思路分析→规范解答→易错提醒"完整四段式解析。\n易错聚焦区：整理本单元最高频的3-5个易错点，每个易错点配"典型错误示范→错误原因分析→正确解法对比→避坑口诀"。\n综合自测区：设计1套覆盖全部核心考点的自测题（题量适中），题型与教材单元练习风格一致，答案放文末配完整解析。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【知识点全覆盖】块级指令（按资料类型 × 学科三维度精确匹配）
  // ═══════════════════════════════════════
  {
    id: 'block_coverage_summary', name: '【知识点全覆盖】知识点总结', category: '生成-知识点全覆盖', type: 'fragment',
    prompt_order: 15,
    subject: '', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '必须穷尽覆盖本章节全部知识点，每个知识点必须独立列出，不得合并或遗漏。生成后自查：是否每个知识点都包含了：①概念阐释/定义 ②典型例题/应用示例 ③易错提示/辨析？',
    builtin: true
  },
  {
    id: 'block_coverage_summary_chinese', name: '【知识点全覆盖-语文】知识点总结', category: '生成-知识点全覆盖', type: 'fragment',
    prompt_order: 15,
    subject: '语文', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '必须穷尽覆盖本章节全部知识点——每个生字词语、语法修辞点、阅读技巧、写作方法都必须独立列出，不得合并或遗漏。生成后自查：是否每个知识点都包含了：①概念阐释/定义 ②典型例题/应用示例 ③易错提示/辨析？',
    builtin: true
  },
  {
    id: 'block_coverage_summary_math', name: '【知识点全覆盖-数学】知识点总结', category: '生成-知识点全覆盖', type: 'fragment',
    prompt_order: 15,
    subject: '数学', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '必须穷尽覆盖本章节全部知识点——每个核心概念、公式/定理、解题方法都必须独立列出，不得合并或遗漏。生成后自查：是否每个知识点都包含了：①概念阐释/定义 ②典型例题/应用示例 ③易错提示/辨析？',
    builtin: true
  },
  {
    id: 'block_coverage_summary_english', name: '【知识点全覆盖-英语】知识点总结', category: '生成-知识点全覆盖', type: 'fragment',
    prompt_order: 15,
    subject: '英语', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '必须穷尽覆盖本章节全部知识点——每个词汇、语法项目、句型结构、发音规则都必须独立列出，不得合并或遗漏。生成后自查：是否每个知识点都包含了：①概念阐释/定义 ②典型例题/应用示例 ③易错提示/辨析？',
    builtin: true
  },
  {
    id: 'block_coverage_summary_science', name: '【知识点全覆盖-理科】知识点总结', category: '生成-知识点全覆盖', type: 'fragment',
    prompt_order: 15,
    subject: '物理,化学,生物,科学', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '必须穷尽覆盖本章节全部知识点——每个核心概念、公式/定理/方程式、实验方法都必须独立列出，不得合并或遗漏。生成后自查：是否每个知识点都包含了：①概念阐释/定义 ②典型例题/应用示例 ③易错提示/辨析？',
    builtin: true
  },
  {
    id: 'block_coverage_summary_humanities', name: '【知识点全覆盖-文科】知识点总结', category: '生成-知识点全覆盖', type: 'fragment',
    prompt_order: 15,
    subject: '历史,地理,道德与法治,政治,思想政治', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '必须穷尽覆盖本章节全部知识点——每个核心概念、关键事件/地理特征、分析框架都必须独立列出，不得合并或遗漏。生成后自查：是否每个知识点都包含了：①概念阐释/定义 ②典型例题/应用示例 ③易错提示/辨析？',
    builtin: true
  },
  {
    id: 'block_coverage_preview', name: '【知识点全覆盖】预习检测', category: '生成-知识点全覆盖', type: 'fragment',
    prompt_order: 15,
    subject: '', stage: '', genType: 'preview', specialSubType: 'new_standard',
    content: '预习检测必须覆盖本节所有新授知识点，每个知识模块至少设置1道对应检测题。禁止只检测部分知识点而遗漏其他。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【主观题评分标准】块级指令（按学科组区分）
  // ═══════════════════════════════════════
  {
    id: 'block_rubric_general', name: '【主观题评分标准】通用', category: '生成-主观题评分标准', type: 'fragment',
    prompt_order: 27,
    subject: '', stage: '', genType: 'exam', specialSubType: 'new_standard',
    content: '主观题分步给分参考：每道解答题必须标注得分点，按步骤给分。\n参考答案应标注：①每步分值 ②关键步骤（必须出现的核心推理）③替代解法提示。',
    builtin: true
  },
  {
    id: 'block_rubric_chinese', name: '【主观题评分标准】语文', category: '生成-主观题评分标准', type: 'fragment',
    prompt_order: 27,
    subject: '语文', stage: '', genType: 'exam,practice,special,errorbook,reading',
    content: '语文主观题评分参考：\n- 习作评分维度：内容（40%—切题/充实）、语言（30%—通顺/生动）、结构（20%—完整/清晰）、书写（10%—规范/整洁）\n- 阅读理解简答题分步给分参考：信息提取（30%）| 理解分析（40%）| 语言表达（30%）',
    builtin: true
  },
  {
    id: 'block_rubric_math', name: '【主观题评分标准】数学', category: '生成-主观题评分标准', type: 'fragment',
    prompt_order: 27,
    subject: '数学', stage: '', genType: 'exam,practice,special,errorbook,reading',
    content: '数学主观题评分参考：\n- 解答题分步给分参考：设未知数/列式（20%）| 计算过程（40%）| 结果正确（20%）| 答/检验（10%）| 单位规范（10%）',
    builtin: true
  },
  {
    id: 'block_rubric_english', name: '【主观题评分标准】英语', category: '生成-主观题评分标准', type: 'fragment',
    prompt_order: 27,
    subject: '英语', stage: '', genType: 'exam,practice,special,errorbook,reading',
    content: '英语主观题评分参考：\n- 书面表达评分维度：内容完整性（40%—覆盖所有要点）| 语言准确性（30%—语法/拼写/用词）| 篇章结构（20%—逻辑连贯）| 书写规范（10%）',
    builtin: true
  },
  {
    id: 'block_rubric_science', name: '【主观题评分标准】理科实验', category: '生成-主观题评分标准', type: 'fragment',
    prompt_order: 27,
    subject: '物理,化学,生物', stage: '', genType: 'exam,practice,special,errorbook,reading',
    content: '主观题评分补充（实验探究类）：\n- 实验探究题分步给分参考：提出问题/假设（15%）| 设计实验/控制变量（30%）| 数据记录处理（25%）| 结论推导（20%）| 表达规范（10%）',
    builtin: true
  },
  {
    id: 'block_rubric_humanities', name: '【主观题评分标准】文科论述', category: '生成-主观题评分标准', type: 'fragment',
    prompt_order: 27,
    subject: '历史,地理,道德与法治,政治,思想政治', stage: '', genType: 'exam,practice,special,errorbook,reading',
    content: '主观题评分补充（材料分析/论述类）：\n- 材料分析/论述题分步给分参考：材料信息提取（25%）| 知识调用运用（30%）| 分析论证逻辑（30%）| 表述规范条理（15%）',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【答题模板】块级指令
  // ═══════════════════════════════════════
  {
    id: 'block_template_chinese_reading', name: '【答题模板】语文阅读理解', category: '生成-答题模板', type: 'fragment',
    prompt_order: 28,
    subject: '语文', stage: '', genType: 'exam,practice,special,errorbook,reading,preview',
    content: '词语理解题："XX"本义是【　】，在文中指【　】，表达了/突出了【　】。\n句子赏析题：运用了【　】（修辞/描写），【　】（分析效果），表达了【　】（情感/主旨）。\n主旨概括题：本文通过记叙/描写【　】（内容概括），赞扬/批判/表达/揭示了【　】（主旨），告诉我们【　】（道理）。\n人物分析题：XX是一个【　】的人，从文中"【　】"（原文依据）可见，表现了【　】（品质/性格）。\n标题作用题："XX"的作用：①【　】（线索/概括内容）②【　】（吸引读者/设置悬念）③【　】（揭示主旨/象征意义）。\n段落作用题：该段在结构上【　】（承上启下/总领/总结），在内容上【　】（交代/铺垫/深化）。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【内容规范】块级指令
  // ═══════════════════════════════════════
  {
    id: 'block_content_norm', name: '【内容规范】禁用emoji', category: '生成-内容规范', type: 'fragment',
    prompt_order: 40,
    subject: '', stage: '', genType: '',
    content: '严禁出现任何装饰性emoji表情符号（含📝📚🎯✨✅❌📖📘📙📕🔍✏️📋🎉💡🔥等），全部使用纯文字和CSS类样式表达——标题用文字编号（一、二、三），重点用<strong>加粗或CSS颜色/边框样式，美观度通过排版和色彩实现，不依赖emoji。⭐️星号仅限用于星级标注/考查频率标记等语义化功能用途，按输出格式要求使用，不作为装饰性emoji对待。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【专项要求】块级指令 — 按 subject+stage(gradeSegment) 三维度精确匹配
  // 确保小学数学/物理/化学低段不使用复杂LaTeX，语文/英语/科学配图风格按学段适配
  // ═══════════════════════════════════════
  // ── 公式：5学段 ──
  { id: 'block_special_formula_primary_low', name: '【专项要求】公式-小学低段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,科学', stage: 'primary_low', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【公式要求】小学低段公式避免LaTeX，使用中文描述+简单算式。', builtin: true },
  { id: 'block_special_formula_primary_mid', name: '【专项要求】公式-小学中段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,科学', stage: 'primary_mid', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【公式要求】小学中高段可使用简单LaTeX（如分式、简单方程），避免复杂多行公式。', builtin: true },
  { id: 'block_special_formula_primary_high', name: '【专项要求】公式-小学高段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,科学', stage: 'primary_high', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【公式要求】小学中高段可使用简单LaTeX（如分式、简单方程），避免复杂多行公式。', builtin: true },
  { id: 'block_special_formula_middle', name: '【专项要求】公式-初中', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,物理,化学', stage: 'middle', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【公式要求】初中可正常使用LaTeX公式和矩阵（\\begin{pmatrix}...\\end{pmatrix}），按EduRender模板要求使用$...$和$$...$$。', builtin: true },
  { id: 'block_special_formula_high', name: '【专项要求】公式-高中', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,物理,化学', stage: 'high', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【公式要求】高中可正常使用LaTeX公式和矩阵（\\begin{pmatrix}...\\end{pmatrix}），按EduRender模板要求使用$...$和$$...$$。', builtin: true },
  // ── 图形：5学段（小学低中段简化描述）──
  { id: 'block_special_graph_primary_low', name: '【专项要求】图形-小学低段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学', stage: 'primary_low', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图形要求】[GRAPH]\n类型：平面几何/立体几何/函数图像/示意图\n描述：[简单描述图形]\n[/GRAPH]', builtin: true },
  { id: 'block_special_graph_primary_mid', name: '【专项要求】图形-小学中段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学', stage: 'primary_mid', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图形要求】[GRAPH]\n类型：平面几何/立体几何/函数图像/示意图\n描述：[简单描述图形]\n[/GRAPH]', builtin: true },
  { id: 'block_special_graph_primary_high', name: '【专项要求】图形-小学高段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学', stage: 'primary_high', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图形要求】[GRAPH]\n类型：平面几何/立体几何/函数图像/示意图\n描述：[详细描述图形，包括关键点坐标、边长、角度等]\n[/GRAPH]', builtin: true },
  { id: 'block_special_graph_middle', name: '【专项要求】图形-初中', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学', stage: 'middle', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图形要求】[GRAPH]\n类型：平面几何/立体几何/函数图像/示意图\n描述：[详细描述图形，包括关键点坐标、边长、角度等]\n[/GRAPH]', builtin: true },
  { id: 'block_special_graph_high', name: '【专项要求】图形-高中', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学', stage: 'high', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图形要求】[GRAPH]\n类型：平面几何/立体几何/函数图像/示意图\n描述：[详细描述图形，包括关键点坐标、边长、角度等]\n[/GRAPH]', builtin: true },
  // ── 图表：5学段（小学低中段简化数据）──
  { id: 'block_special_chart_primary_low', name: '【专项要求】图表-小学低段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,科学', stage: 'primary_low', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图表要求】[CHART]\n类型：条形/折线/扇形/直方图\n标题：[标题]\nX轴：[含义]\nY轴：[含义]\n数据：[简单数值（不超过5组）]\n[/CHART]', builtin: true },
  { id: 'block_special_chart_primary_mid', name: '【专项要求】图表-小学中段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,科学', stage: 'primary_mid', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图表要求】[CHART]\n类型：条形/折线/扇形/直方图\n标题：[标题]\nX轴：[含义]\nY轴：[含义]\n数据：[简单数值（不超过5组）]\n[/CHART]', builtin: true },
  { id: 'block_special_chart_primary_high', name: '【专项要求】图表-小学高段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,科学', stage: 'primary_high', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图表要求】[CHART]\n类型：条形/折线/扇形/直方图\n标题：[标题]\nX轴：[含义]\nY轴：[含义]\n数据：[数值]\n[/CHART]', builtin: true },
  { id: 'block_special_chart_middle', name: '【专项要求】图表-初中', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,物理,化学,生物,地理', stage: 'middle', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图表要求】[CHART]\n类型：条形/折线/扇形/直方图\n标题：[标题]\nX轴：[含义]\nY轴：[含义]\n数据：[数值]\n[/CHART]', builtin: true },
  { id: 'block_special_chart_high', name: '【专项要求】图表-高中', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学,物理,化学,生物,地理', stage: 'high', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【图表要求】[CHART]\n类型：条形/折线/扇形/直方图\n标题：[标题]\nX轴：[含义]\nY轴：[含义]\n数据：[数值]\n[/CHART]', builtin: true },
  // ── 配图：5学段（⚠️ 前置门禁——非白名单场景一律禁用，格式仅在确需配图时作为参考）──
  { id: 'block_special_image_primary_low', name: '【专项要求】配图-小学低段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '语文,英语,科学', stage: 'primary_low', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【配图要求——⚠️ 铁律：能出纯文字题的绝不用图！仅当知识点非图不可考时才配图。仅限以下5类场景：①看图写话/看图说话 ②图表解读/数据图表 ③地图定位/地形判读 ④实验装置图/几何图形 ⑤低段语文看图选词/看图连线。非以上场景严禁出现[IMAGE]标记。确属以上场景时，格式：\n[IMAGE]\n类型：照片/插画/示意图\n描述：[详细描述画面内容]\n位置：题干上方/下方/居中\n[/IMAGE]\n小学低中段配图应卡通化、色彩鲜明、贴近儿童生活。', builtin: true },
  { id: 'block_special_image_primary_mid', name: '【专项要求】配图-小学中段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '语文,英语,科学', stage: 'primary_mid', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【配图要求——⚠️ 铁律：能出纯文字题的绝不用图！仅当知识点非图不可考时才配图。仅限以下5类场景：①看图写话/看图说话 ②图表解读/数据图表 ③地图定位/地形判读 ④实验装置图/几何图形 ⑤低段语文看图选词/看图连线。非以上场景严禁出现[IMAGE]标记。确属以上场景时，格式：\n[IMAGE]\n类型：照片/插画/示意图\n描述：[详细描述画面内容]\n位置：题干上方/下方/居中\n[/IMAGE]\n小学低中段配图应卡通化、色彩鲜明、贴近儿童生活。', builtin: true },
  { id: 'block_special_image_primary_high', name: '【专项要求】配图-小学高段', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '语文,英语,科学', stage: 'primary_high', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【配图要求——⚠️ 铁律：能出纯文字题的绝不用图！仅当知识点非图不可考时才配图。仅限以下5类场景：①看图写话/看图说话 ②图表解读/数据图表 ③地图定位/地形判读 ④实验装置图/几何图形 ⑤低段语文看图选词/看图连线。非以上场景严禁出现[IMAGE]标记。确属以上场景时，格式：\n[IMAGE]\n类型：照片/插画/示意图\n描述：[详细描述画面内容]\n位置：题干上方/下方/居中\n[/IMAGE]\n小学高段配图可适当减少卡通风格，增加示意图、图表等半抽象视觉元素。', builtin: true },
  { id: 'block_special_image_middle', name: '【专项要求】配图-初中', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '语文,英语', stage: 'middle', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【配图要求——⚠️ 铁律：能出纯文字题的绝不用图！仅当知识点非图不可考时才配图。仅限以下5类场景：①看图写话/看图说话 ②图表解读/数据图表 ③地图定位/地形判读 ④实验装置图/几何图形 ⑤低段语文看图选词/看图连线。非以上场景严禁出现[IMAGE]标记。确属以上场景时，格式：\n[IMAGE]\n类型：照片/插画/示意图\n描述：[详细描述画面内容]\n位置：题干上方/下方/居中\n[/IMAGE]', builtin: true },
  { id: 'block_special_image_high', name: '【专项要求】配图-高中', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '语文,英语', stage: 'high', genType: 'exam,practice,special,errorbook,reading,summary',
    content: '【配图要求——⚠️ 铁律：能出纯文字题的绝不用图！仅当知识点非图不可考时才配图。仅限以下5类场景：①看图写话/看图说话 ②图表解读/数据图表 ③地图定位/地形判读 ④实验装置图/几何图形 ⑤低段语文看图选词/看图连线。非以上场景严禁出现[IMAGE]标记。确属以上场景时，格式：\n[IMAGE]\n类型：照片/插画/示意图\n描述：[详细描述画面内容]\n位置：题干上方/下方/居中\n[/IMAGE]', builtin: true },

  // ═══════════════════════════════════════
  // 【题型专项要求】块级指令 — 按 genType（choice/fill/truefalse/calc/answer/word_problem/experiment）精确匹配
  // 含填空横线CSS精确留空规范（blank-1 ~ blank-10），全局通用，不分学段学科
  // ═══════════════════════════════════════
  { id: 'block_type_choice', name: '【题型专项要求】选择题', category: '生成-题型专项要求', prompt_order: 39, type: 'fragment',
    subject: '', stage: '', genType: 'choice',
    content: '- 选项数按学段要求（低段不超过3个，中高段及以上4个），各选项长度尽量一致、风格统一\n- 正确选项随机分布，不固定在某一位置\n- 错误选项应来自学生常见错误，有迷惑性但非明显错误\n- 不得使用"以上都是""以上都不对"', builtin: true },
  { id: 'block_type_fill', name: '【题型专项要求】填空题', category: '生成-题型专项要求', prompt_order: 39, type: 'fragment',
    subject: '', stage: '', genType: 'fill',
    content: '- 每空考查一个独立的知识点\n- 空格放在句末或关键位置\n- 答案必须唯一确定\n- 🎯 填空横线精确留空（含手写余量，已上调一档保证书写空间）：按答案字数使用CSS类\n  1字→ <u class="blank-2">&emsp;</u>\n  2字→ <u class="blank-4">&emsp;</u>\n  3-4字→ <u class="blank-6">&emsp;</u>\n  5-6字→ <u class="blank-8">&emsp;</u>\n  7-10字→ <u class="blank-10">&emsp;</u>\n  10字以上→ <u class="blank-10">&emsp;</u>\n- 括号（与横线互斥，二选一不可叠加）：(<span class="blank-N">&emsp;</span>)（最小取blank-4，1-2字→4, 3-4字→6, 5-6字→8, 7-10字→10, 10字以上→10）\n- 方框：<span class="square-box">&emsp;</span>\n- ⛔ 严禁使用下划线字符：禁止使用 ___、____、______ 等连续下划线表示填空位置，只能使用上述 <u class="blank-N"> 或 <span class="blank-N"> 格式', builtin: true },
  { id: 'block_type_truefalse', name: '【题型专项要求】判断题', category: '生成-题型专项要求', prompt_order: 39, type: 'fragment',
    subject: '', stage: '', genType: 'truefalse',
    content: '- 正确和错误的比例接近1:1\n- 错误说法应来自学生常见误区\n- 不得使用双重否定来制造难度', builtin: true },
  { id: 'block_type_calc', name: '【题型专项要求】计算题', category: '生成-题型专项要求', prompt_order: 39, type: 'fragment',
    subject: '', stage: '', genType: 'calc',
    content: '- 数据应合理，符合实际情况\n- 必须标注最终结果的单位\n- 如需取近似值，必须在题中明确精度要求', builtin: true },
  { id: 'block_type_answer', name: '【题型专项要求】解答题', category: '生成-题型专项要求', prompt_order: 39, type: 'fragment',
    subject: '', stage: '', genType: 'answer',
    content: '- 题目应有明确的解答指向（不是"谈谈你的看法"这种空泛设问）\n- 如有多个小问，难度应递进\n- 留出足够的解答空间', builtin: true },
  { id: 'block_type_word_problem', name: '【题型专项要求】应用题', category: '生成-题型专项要求', prompt_order: 39, type: 'fragment',
    subject: '', stage: '', genType: 'word_problem',
    content: '- 情境真实可信，数据合理\n- 明确要求写出"解""答"和关键步骤\n- 如有单位换算，需在题中给出换算关系', builtin: true },
  { id: 'block_type_experiment', name: '【题型专项要求】实验题', category: '生成-题型专项要求', prompt_order: 39, type: 'fragment',
    subject: '', stage: '', genType: 'experiment',
    content: '- 实验步骤应实际可行\n- 如涉及仪器，应写明仪器名称和规格\n- 明确要求写出实验现象和结论', builtin: true },

  // ═══════════════════════════════════════
  // 【术语规范】块级指令（按学科区分）
  // ═══════════════════════════════════════
  {
    id: 'block_terminology_math', name: '【术语规范】数学', category: '生成-术语规范', type: 'fragment',
    prompt_order: 29,
    subject: '数学', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,summary',
    content: '请使用标准数学术语，避免使用不规范表述。核心术语：一次函数、二次函数、反比例函数、一元一次方程、一元二次方程、勾股定理、相似三角形、全等三角形、平行四边形、圆周角、平均数、中位数、众数、概率。',
    builtin: true
  },
  {
    id: 'block_terminology_physics', name: '【术语规范】物理', category: '生成-术语规范', type: 'fragment',
    prompt_order: 29,
    subject: '物理', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,summary',
    content: '请使用标准物理术语，避免使用不规范表述。核心术语：质量、重力、压强、密度、速度、加速度、力、功、功率、电流、电压、电阻、欧姆定律。',
    builtin: true
  },
  {
    id: 'block_terminology_chemistry', name: '【术语规范】化学', category: '生成-术语规范', type: 'fragment',
    prompt_order: 29,
    subject: '化学', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,summary',
    content: '请使用标准化学术语，避免使用不规范表述。核心术语：化学方程式、化合价、相对原子质量、相对分子质量、溶液、溶质、溶剂、pH值、置换反应、复分解反应、催化剂。',
    builtin: true
  },
  {
    id: 'block_terminology_chinese', name: '【术语规范】语文', category: '生成-术语规范', type: 'fragment',
    prompt_order: 29,
    subject: '语文', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,summary',
    content: '请使用标准语文学科术语。核心术语：比喻、拟人、排比、夸张、设问、反问、对偶、借代、记叙文、议论文、说明文、中心思想、写作手法、修辞手法。',
    builtin: true
  },
  {
    id: 'block_terminology_english', name: '【术语规范】英语', category: '生成-术语规范', type: 'fragment',
    prompt_order: 29,
    subject: '英语', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,summary',
    content: '请使用标准英语语法术语。核心术语：一般现在时、一般过去时、现在完成时、定语从句、主语、谓语、宾语、状语、被动语态。',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【输出格式】块级指令（按资料类型区分）
  // ═══════════════════════════════════════
  {
    id: 'block_format_summary', name: '【输出格式】知识点总结', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '- 大标题用<h1>，小节标题用<h2>\n- 知识结构用简洁的<ul>和<li>列表表示，最多2层嵌套\n- 核心知识清单用<table>表格，每格内容不超过15字；表格用 style="border-collapse:collapse;width:100%"，单元格用 style="border:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:middle"\n- 知识辨析与易错提示用表格，左右两列对比"易错点"和"正确理解"\n- 典型例题用<div class="example">包裹，填空处用 <u class="blank-N">&emsp;</u>（N=1/2/4/6/8/10按答案字数），例题后紧跟<div class="analysis">解析（含解题思路、易错提示)\n- 重难点星级标注：用⭐️符号标注考查频率（⭐️低频 ⭐️⭐️中频 ⭐️⭐️⭐️高频必考）\n- 记忆方法用<div class="memory-tips">包裹，含口诀、思维导图提示\n- 关键词用<strong>加粗\n- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹',
    builtin: true
  },
  {
    id: 'block_format_errorbook', name: '【输出格式】错题本', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: '- 大标题用<h1>\n- 每道错题用<div class="error-item">包裹\n- 错题编号用<h3>，原题用<div class="original-question">，如有填空用 <u class="blank-N">&emsp;</u>（N按答案字数）\n- ⚠️ 禁止使用<h4>/<h5>/<h6>标签缩小字号制造层级感。所有正文统一字号（<p>标签默认大小），层级区分仅靠编号格式。\n- 错误归因与素养反思用<div class="error-reason">，包含【错误类型】标签\n- 正确解法用<div class="correct-solution">\n- 变式巩固用<div class="variant-practice">，变式题填空用 <u class="blank-N">&emsp;</u> 标记\n- 错误类型标签：<span class="tag tag-concept">概念混淆</span>等\n- 参考答案和解析用<div class="answer-section">包裹\n- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹',
    builtin: true
  },
  {
    id: 'block_format_preview', name: '【输出格式】课前预习', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'preview', specialSubType: 'new_standard',
    content: '- 大标题用<h1>，学习目标用<h2>\n- ⚠️ 禁止使用<h4>/<h5>/<h6>标签缩小字号制造层级感。所有正文统一字号（<p>标签默认大小），层级区分仅靠编号格式。\n- 预习任务用<ul>和<li>列出，每个任务可操作、可检查\n- 预习检测的题目用<p>标签，每道题标注【自测】，填空处用 <u class="blank-N">&emsp;</u>（N按答案字数）标记留空\n- 检测题控制在3-5道，以填空和简答为主，不宜过难\n- 答案和提示统一放在文末，用<div class="answer-section">包裹\n- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹',
    builtin: true
  },
  {
    id: 'block_format_dictation', name: '【输出格式】默写（通用）', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'dictation', specialSubType: 'new_standard',
    content: '- 大标题用<h1>\n- 按字词/句子/段落分节，用<h2>标题\n- 每个默写项用<div class="dictation-item">包裹，格式：序号 + 提示 + 留空书写区（不写答案）\n- 每个词语之间留足间距，用 <span class="spacer"></span> 分隔\n- 标准答案集中放在文末，用<div class="answer-section">包裹\n- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹',
    builtin: true
  },
  {
    id: 'block_format_dictation_chinese', name: '【输出格式】默写-语文', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '语文', stage: '', genType: 'dictation', specialSubType: 'new_standard',
    content: '- 生字用<span class="tian-zi-ge">字</span>包裹；留空书写区用<span class="tian-zi-ge">&emsp;</span>（格内放&emsp;不放答案），一字一格、格数=答案字数\n- 拼音提示放在生字上方\n- 句子默写给出上句/标题提示，留空写下句\n- ✒️ 横线书写区手写余量：手写汉字比印刷体宽，按答案字数选 blank-N 并上调一档：1-2字→blank-4；3-4字→blank-6；5-6字→blank-8；7字以上→blank-10；整句默写可用多段 blank-10 拼接',
    builtin: true
  },
  {
    id: 'block_format_dictation_english', name: '【输出格式】默写-英语', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '英语', stage: '', genType: 'dictation', specialSubType: 'new_standard',
    content: '- ⚠️ 汉译英/单词默写等写英文的题型：书写区用四线三格\n- ⚠️ 英译汉等写中文的题型：书写区用普通横线（禁止四线格/田字格）\n- 每5-8个词设一个休息分隔线',
    builtin: true
  },
  {
    id: 'block_format_reading', name: '【输出格式】阅读训练', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'reading', specialSubType: 'new_standard',
    content: '- 大标题用<h1>\n- ⚠️ 禁止使用<h4>/<h5>/<h6>标签缩小字号制造层级感。所有正文统一字号（<p>标签默认大小），层级区分仅靠编号格式。\n- 短文用<div class="reading-passage">包裹，段落用<p>\n- 题目用<ol>有序列表，每题用<li>包裹题干+选项/作答区\n- 选择题选项用<p class="option">，填空题/简答题留空用 <u class="blank-N">&emsp;</u>（N按答案字数取1/2/4/6/8/10），严禁用"（作答区）"文字描述代替\n- 拓展思考题用<div class="extended-thinking">包裹\n- 参考答案和解析统一放在文末，用<div class="answer-section">包裹\n- 直接返回HTML片段，不要用<html>、<head>、<body>或```html包裹',
    builtin: true
  },
  {
    id: 'block_format_numbering', name: '【输出格式】题号体系', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'exam,practice,special',
    content: '- 题号三级体系（强制性）：【板块标题】h2标签内用"一、二、三、"（中文数字、顿号），如<h2>一、选择题</h2>。【独立题目】p.question标签内用"1. 2. 3."（阿拉伯数字、英文句点），跨板块连续编号不重置。【综合题子题】内部用"(1)(2)(3)"（半角圆括号），禁用"①②③"。禁止同级混搭编号格式、禁止仅靠缩进区分层级。⛔ 严禁：<p style="margin-left:20px;font-size:14px;">（缩进、小字号导出Word后层级消失）。✅ 正确：h2板块下所有题目用p.question统一字号无缩进。⛔ 所有题目必须用<p class="question">标签，严禁不带class属性的<p>做题目容器。',
    builtin: true
  },
  {
    id: 'block_format_base', name: '【输出格式】基础格式', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'exam,practice,special',
    content: '- 大标题用<h1>，单元标题用<h2>，小节标题用<h3>。⚠️ 禁止使用<h4>/<h5>/<h6>缩小字号制造层级感——正文统一字号（<p>默认大小），层级区分仅靠编号格式。\n- 正文用<p>，选项用<p class="option">。所有题目正文（题干/选项/填空）统一字号，禁止因子题嵌套缩小字体。\n- 选择题用<ol>有序列表，每题用<li>包裹题干+选项/作答区。',
    builtin: true
  },
  {
    id: 'block_format_blanks', name: '【输出格式】填空留空', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'exam,practice,special',
    content: '- 填空精确留空（含手写余量，已上调一档）：\n  句中横线：1字→<u class="blank-2">&emsp;</u>，2字→<u class="blank-4">&emsp;</u>，3-4字→<u class="blank-6">&emsp;</u>，5-6字→<u class="blank-8">&emsp;</u>，7+字→<u class="blank-10">&emsp;</u>\n  句末/题末括号：<span class="blank-N">&emsp;</span>（N：1-2字→4，3-4字→6，5-6字→8，7、字→10）\n  ⛔ 横线与括号互斥！同一空位二选一不可叠加！\n  ⛔ 标签内必须有&emsp;内容，严禁空标签！\n  ⛔ 严禁用___下划线字符代替！',
    builtin: true
  },
  {
    id: 'block_format_misc', name: '【输出格式】表格/配图/返回', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'exam,practice,special',
    content: '- 表格用<table>，必须加 style="border-collapse:collapse;width:100%"，每个<td>/<th>必须加 style="border:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:middle"，禁止单元格内容紧贴边框。\n- 配图用[IMAGE]TYPE:SD|ICON ... [/IMAGE]标记。\n- ❌ 禁止使用<html>、<head>、<body>、<!DOCTYPE>等文档级标签包裹内容。禁止使用```html等markdown代码块标记。\n- ✅ 直接返回HTML片段，从第一个可见标签开始。',
    builtin: true
  },
  {
    id: 'block_format_exam_elements', name: '【输出格式】试卷特殊元素', category: '生成-输出格式', type: 'fragment',
    prompt_order: 23,
    subject: '', stage: '', genType: 'exam',
    content: '- 得分框：用<span class="score-box">分数</span>标记（带外框）。\n- 评分栏：用<div class="score-board">...标记（表格形式，标签|分值）。\n- 密封线/装订线：用<div class="sealed-wrapper"><div class="sealed-line"><span>密</span><span>封</span><span>线</span></div>...内容...</div>包裹整份试卷。',
    builtin: true
  },


  // ═══════════════════════════════════════
  // 【学科标记】块级指令（按学科区分的特殊HTML标记规范）
  // ═══════════════════════════════════════
  {
    id: 'block_markup_chinese', name: '【学科标记】语文专用', category: '生成-学科标记', type: 'fragment',
    prompt_order: 22,
    subject: '语文', stage: '', genType: '',
    content: '【语文学科专用标记——严格按以下规则使用】\n- 加点字：用 <span class="emphasis-dot">字</span> 标记，CSS会自动在字下方显示红点(·)\n- 画线句子：用 <u class="underline-sentence">完整句子</u> 标记，CSS会显示连续实线下划线\n- 拼音标注：用 <ruby>汉字<rt>拼音</rt></ruby> 标记\n- 波浪线（病句修改）：用 <span class="wavy-underline">病句文字</span> 标记，CSS显示红色波浪下划线\n- 双线格/单线格：强调文字用 <span class="double-line">文字</span>（双线）或 <span class="single-line">文字</span>（单线）\n- 部首标注：用 <ruby class="radical"><rb>字</rb><rt>部首</rt></ruby> 标记\n- 笔画笔顺：用 <span class="stroke-order" data-strokes="笔画数">字</span> 标记\n- 田字格：每个生字独立用 <span class="tian-zi-ge">字</span> 标记\n- 米字格：用 <span class="mi-zi-ge">字</span> 标记\n- 四线三格（拼音格）：用 <span class="four-line-three pinyin-line">拼音</span> 标记\n- 作文格：用 <div class="zuo-wen-ge"><span>字1</span><span>字2</span>...</div> 包裹',
    builtin: true
  },
  {
    id: 'block_markup_science', name: '【学科标记】理科专用', category: '生成-学科标记', type: 'fragment',
    prompt_order: 22,
    subject: '数学,物理,化学', stage: '', genType: '',
    content: '学科标记补充（上标/下标/离子符号/数学符号）\n- 上标：用 <sup class="superscript">内容</sup> 或 <span class="superscript">内容</span>\n- 下标：用 <sub class="subscript">内容</sub> 或 <span class="subscript">内容</span>\n- 离子上标：用 <sup class="superscript">内容</sup>\n- 特殊数学符号：直接使用Unicode字符，禁止LaTeX或图片 — ° ≈ ≠ ≤ ≥ ± × ÷ △ ∠ ∥ ⊥ π ∞ √',
    builtin: true
  },
  {
    id: 'block_markup_math', name: '【学科标记】数学专用', category: '生成-学科标记', type: 'fragment',
    prompt_order: 22,
    subject: '数学', stage: '', genType: '',
    content: '【数学专用标记】\n- 口算框：用 <span class="oral-box">算式</span> 标记，CSS显示方框\n- 方框填空：用 <span class="square-box">&nbsp;</span> 标记空缺方框\n- 竖式计算：用 <div class="vertical-calculation"> 包裹，内部行用 .vc-row，运算符用 data-op 属性，结果行用 .vc-result，横线用 .vc-line\n- 脱式计算等号对齐：用 <div class="off-formula"> 包裹，每一步用 <div class="of-line">= 计算过程</div>\n- 辅助线虚线：用 <span class="dashed-line"></span> 表示答题划线/虚线',
    builtin: true
  },
  {
    id: 'block_markup_chemistry', name: '【学科标记】化学专用', category: '生成-学科标记', type: 'fragment',
    prompt_order: 22,
    subject: '化学', stage: '', genType: '',
    content: '【化学专用标记】\n- 化学反应条件：用 <span class="chem-condition">条件</span> 标记，CSS显示小号字在箭头上方\n- 元素周期表片段：用 <table class="periodic-table"> 绘制，元素分类用CSS类：.nonmetal(非金属绿)、.metal(金属红)、.transition(过渡橙)、.noble-gas(稀有气体蓝)',
    builtin: true
  },
  {
    id: 'block_markup_english', name: '【学科标记】英语专用', category: '生成-学科标记', type: 'fragment',
    prompt_order: 22,
    subject: '英语', stage: '', genType: 'exam,practice,special,errorbook,reading,preview,summary',
    content: '【英语学科专用标记——严格按以下规则使用】\n- 音标注记：用 /音标/ 格式标注（如：apple /ˈæp.əl/）\n- 重难点单词：用 <strong>加粗</strong> 标注\n- 短语/句型（默写除外）：用 <u>下划线</u> 标注\n- 连线题：用 <div class="match-question"> 左右两列对应连线\n- 完形填空词库：用 <span class="word-bank"> 标记，CSS显示带边框的词库框',
    builtin: true
  },
  {
    id: 'block_markup_english_primary', name: '【学科标记】英语-小学四线三格', category: '生成-学科标记', type: 'fragment',
    prompt_order: 22,
    subject: '英语', stage: 'primary', genType: '',
    content: '- 四线三格（书写线）：用 <span class="four-line-three english-line">text</span> 标记（手写体英文）\n  示例：<span class="four-line-three english-line">cat</span> <span class="four-line-three english-line">dog</span>\n- 四线三格留空书写区（默写，学生手写填入）：格内按答案长度放入 &emsp;，手写字比印刷体宽，必须留足余量，严禁留空标签：\n  答案1-3字母→3个&emsp;；4-5字母→4个；6-8字母→6个；9-12字母→9个；短语/句子→每个单词按上表累加\n  示例：答案 cat（3字母）→ <span class="four-line-three english-line">&emsp;&emsp;&emsp;</span>；答案 beautiful（9字母）→ <span class="four-line-three english-line">&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;</span>',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【EduRender模板】块级指令
  // ═══════════════════════════════════════
  {
    id: 'block_edurender_formula', name: '【EduRender模板】公式格式', category: '生成-EduRender模板', type: 'fragment',
    prompt_order: 21,
    subject: '数学,物理,化学', stage: '', genType: '',
    content: '行内公式：$...$\n独立公式：$$...$$\n示例：$a^2 + b^2 = c^2$  $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$',
    builtin: true
  },
  {
    id: 'block_edurender_axis', name: '【EduRender模板】数轴模板', category: '生成-EduRender模板', type: 'fragment',
    prompt_order: 21,
    subject: '数学', stage: '', genType: '',
    content: '题目涉及数轴时使用：[GRAPH]\nTYPE:COORDINATE\nXLIM:min,max\nYLIM:-1,1\nGRID:FALSE\nNUMBER_POSITION:top\nTICK_DIRECTION:up\nLEFT_ARROW:false\nRIGHT_ARROW:true\nAXIS_COLOR:black\nLINE_WIDTH:2\nTICK_LENGTH:6\nLABEL_FONT_SIZE:14\nMARKERS:...\n[/GRAPH]',
    builtin: true
  },
  {
    id: 'block_edurender_shapes', name: '【EduRender模板】几何/函数图形', category: '生成-EduRender模板', type: 'fragment',
    prompt_order: 21,
    subject: '数学,物理,化学,生物', stage: '', genType: '',
    content: '题目涉及几何、函数图像、点标注时使用：[GRAPH]\nTYPE:SHAPES\nXLIM:min,max\nYLIM:min,max\nGRID:true/false\nTITLE:标题\nSHAPES:\n  POINT:(x,y) | LABEL:标签 | COLOR:颜色 | SIZE:大小\n  FUNCTION:表达式 | COLOR:颜色 | DOMAIN:min,max\n  POLYGON:(x1,y1),(x2,y2),(x3,y3) | LABELS:A,B,C | COLOR:颜色\n  CIRCLE:(x,y) | RADIUS:半径 | COLOR:颜色\n  LINE:(x1,y1),(x2,y2) | COLOR:颜色 | WIDTH:线宽 | DASH:true/false\n  ANGLE:(x1,y1),(顶点),(x2,y2) | LABEL:度数 | COLOR:颜色\n[/GRAPH]',
    builtin: true
  },
  {
    id: 'block_edurender_chart', name: '【EduRender模板】统计图表', category: '生成-EduRender模板', type: 'fragment',
    prompt_order: 21,
    subject: '数学,物理,化学,生物,地理', stage: '', genType: '',
    content: '题目涉及统计图时使用：[GRAPH]\nTYPE:BAR_CHART 或 LINE_CHART 或 PIE_CHART\nDATA:数,据,列\nLABELS:标签,列\nTITLE:标题\nXLABEL:X轴标签\nYLABEL:Y轴标签\nCOLORS:颜色,列\n[/GRAPH]',
    builtin: true
  },
  {
    id: 'block_edurender_force', name: '【EduRender模板】受力分析图', category: '生成-EduRender模板', type: 'fragment',
    prompt_order: 21,
    subject: '物理', stage: '', genType: '',
    content: '题目涉及受力分析时使用：[GRAPH]\nTYPE:FORCE\nOBJECT:形状,x,y,宽,高\nFORCES:\n  G:方向,位置,大小\n  N:方向,位置,大小\n  F:方向,位置,大小\n  f:方向,位置,大小\nLABELS:true/false\n[/GRAPH]',
    builtin: true
  },
  {
    id: 'block_edurender_circuit', name: '【EduRender模板】电路图', category: '生成-EduRender模板', type: 'fragment',
    prompt_order: 21,
    subject: '物理', stage: '', genType: '',
    content: '题目涉及电路时使用：[GRAPH]\nTYPE:CIRCUIT\nCOMPONENTS:\n  battery,位置,方向\n  switch,位置,方向\n  bulb,位置,方向\n  resistor,位置,方向\nWIRES:起点-终点;起点-终点\n[/GRAPH]',
    builtin: true
  },
  {
    id: 'block_edurender_optics', name: '【EduRender模板】光路图', category: '生成-EduRender模板', type: 'fragment',
    prompt_order: 21,
    subject: '物理', stage: '', genType: '',
    content: '题目涉及光学时使用：[GRAPH]\nTYPE:OPTICS\nMIRROR:类型,x1,y1,x2,y2\nINCIDENT:x1,y1,x2,y2\nANGLE:角度\n[/GRAPH]',
    builtin: true
  },
  {
    id: 'block_edurender_atom', name: '【EduRender模板】原子结构', category: '生成-EduRender模板', type: 'fragment',
    prompt_order: 21,
    subject: '化学', stage: '', genType: '',
    content: '题目涉及原子结构时使用：[GRAPH]\nTYPE:ATOM\nELEMENT:元素符号\nSHELLS:电,子,层\n[/GRAPH]',
    builtin: true
  },
  {
    id: 'block_edurender_image', name: '【EduRender模板】配图', category: '生成-EduRender模板', type: 'fragment',
    prompt_order: 21,
    subject: '', stage: '', genType: '',
    content: '文生图：[IMAGE] TYPE:SD PROMPT:画面描述（详细） NEGATIVE:避免的内容 WIDTH:800 HEIGHT:600 STYLE:line_art [/IMAGE]\n图标检索：[IMAGE] TYPE:ICON KEYWORDS:关键词 STYLE:flat [/IMAGE]',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【分析-文本分析规范】块级指令 —— 模板/试卷结构分析规则
  // 🔗 映射结果字段：结构分析[] （全部子字段：大题/大题分值/小题数量/每小题分值/题型/设问风格/难度/小题列表）
  // ═══════════════════════════════════════
  {
    id: 'block_fmt_note_full', name: '【格式说明——原文中的标记表示重点内容】完整版', category: '分析-文本分析规范', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：通用（告知AI如何理解原文标记，影响所有字段的提取准确度）
    content: '- **加粗文字** 表示重点概念、关键词或考点\n- _下划线文字_ 表示需要特别关注的部分\n- ==高亮文字== 表示极其重要的考点\n- *斜体文字* 表示补充说明或注释\n- ~~删除线~~ 表示已删除或不适用的内容\n⚠️ 重要：这些格式标记是原文的一部分，请在提取时保留它们的语义信息！',
    builtin: true
  },
  {
    id: 'block_core_principle', name: '【核心原则——除难度外，所有字段必须逐字从原文复制】', category: '分析-文本分析规范', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：结构分析[].大题, 结构分析[].题型, 结构分析[].设问风格, 结构分析[].分值, 结构分析[].小题序号, 结构分析[].小题数量
    content: '⚠️ 严禁任何形式的归纳、改写、标准化、总结！\n⚠️ 原文写什么就填什么，一个字都不能改！',
    builtin: true
  },
  {
    id: 'block_mandatory_rules_full', name: '【强制规则——违反将导致分析结果作废】完整版', category: '分析-文本分析规范', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：结构分析[].大题, 结构分析[].题型, 结构分析[].设问风格, 结构分析[].难度, 结构分析[].小题数量, 结构分析[].小题列表
    content: '1. 【大题名称】必须逐字复制原文中的原话，严禁任何归纳、改写、标准化\n   - ✅ 正确："一、读下面的语段，按要求完成练习"\n   - ❌ 错误："阅读理解题"（这是归纳，禁止！）\n   - ✅ 正确："三、语文与生活"\n   - ❌ 错误："生活应用题"（这是归纳，禁止！）\n   - ✅ 正确："四、材料连贯性文本,完成练习"\n   - ❌ 错误："材料分析题"（这是归纳，禁止！）\n2. 【题型】必须逐字复制原文中的原话，严禁归类为标准题型\n   - ✅ 正确："读下面的语段，按要求完成练习"\n   - ❌ 错误："语段分析"（这是归纳，禁止！）\n   - ✅ 正确："选择正确的答案"\n   - ❌ 错误："选择题"（这是标准化，禁止！）\n   - ✅ 正确："语文与生活"\n   - ❌ 错误："生活应用"（这是归纳，禁止！）\n3. 【设问风格】必须直接引用原文中的原句，不要改写或总结\n   - ✅ 正确："根据语段填写词语"\n   - ❌ 错误："看拼音写词"（这是改写，禁止！）\n   - ✅ 正确："依次填入下面横线段线上的关联词语，恰当的一项是"\n   - ❌ 错误："关联词填空"（这是归纳，禁止！）\n4. 【难度】需要根据题目内容分析判断（基础/中等/较难）← 唯一可以由AI判断的字段\n5. 【分值】只有原文明确标注了才能填写；没有标注的填0，严禁自己估算\n6. 【小题序号】必须从原文中逐题提取，原文用什么序号就用什么\n7. 【小题数量】必须从原文中逐题提取，原文有几个就填几个',
    builtin: true
  },
  {
    id: 'block_mandatory_rules_compact', name: '【强制规则】精简版（分段分析用）', category: '分析-文本分析规范', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：结构分析[].大题, 结构分析[].题型, 结构分析[].设问风格, 结构分析[].难度, 结构分析[].分值, 结构分析[].小题序号, 结构分析[].小题数量
    content: '1. 【大题名称】必须逐字复制原文中的原话\n   - ✅ 正确："一、读下面的语段，按要求完成练习"\n   - ❌ 错误："阅读理解题"（这是归纳，禁止！）\n   - ✅ 正确："三、语文与生活"\n   - ❌ 错误："生活应用题"（这是归纳，禁止！）\n2. 【题型】必须逐字复制原文中的原话\n   - ✅ 正确："读下面的语段，按要求完成练习"\n   - ❌ 错误："语段分析"（这是归纳，禁止！）\n   - ✅ 正确："选择正确的答案"\n   - ❌ 错误："选择题"（这是标准化，禁止！）\n3. 【设问风格】必须直接引用原文中的原句\n   - ✅ 正确："根据语段填写词语"\n   - ❌ 错误："看拼音写词"（这是改写，禁止！）\n4. 【难度】需要根据题目内容分析判断（基础/中等/较难）← 唯一可以由AI判断的字段\n5. 【分值】只有原文明确标注了才能填写，没有标注填0\n6. 【小题序号】必须从原文中逐题提取，原文用什么序号就用什么\n7. 【小题数量】必须从原文中逐题提取，原文有几个就填几个',
    builtin: true
  },
  {
    id: 'block_difficulty_rules_full', name: '【难度分析规则——需要根据题目内容判断】完整版', category: '分析-文本分析规范', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：结构分析[].难度（唯一由AI自主判断的字段）
    content: '难度分为三个等级：基础、中等、较难\n\n**基础题特征**：\n- 直接考查基础知识（如看拼音写词语、词语解释、简单计算）\n- 答案唯一且明确，不需要复杂推理\n- 示例："根据拼音写出词语""计算下列算式的结果"\n\n**中等题特征**：\n- 需要理解上下文或联系多个知识点\n- 有一定推理过程，需要分析或比较\n- 示例："联系上下文理解词语含义""选择描写方法相同的句子"\n\n**较难题特征**：\n- 需要综合运用多个知识点，创造性思维\n- 开放性较强，需要深度分析\n- 示例："概括母亲对袁隆平成长产生重要影响的三件事""赏析句子的表达效果"\n\n**判断原则**：\n1. 如果原文中有明确标注（如"提高题""拓展题"），优先使用原文标注\n2. 如果没有标注，根据上述规则分析题目内容后判断\n3. 同一道大题下的小题难度可能不同，需分别判断',
    builtin: true
  },
  {
    id: 'block_difficulty_rules_compact', name: '【难度分析规则】精简版（分段分析用）', category: '分析-文本分析规范', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：结构分析[].难度（精简版）
    content: '- 基础题：直接考查基础知识（如看拼音写词语、简单计算、词语解释）\n- 中等题：需要理解上下文或联系多个知识点（如选择描写方法相同的句子）\n- 较难题：需要综合运用多个知识点，创造性思维（如赏析句子表达效果、概括多件事）',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【分析-分析模板示例】块级指令
  // 🔗 映射结果字段：结构分析[] （示例格式，演示 AI 应产出的 JSON 结构）
  // ═══════════════════════════════════════
  {
    id: 'block_examples_full', name: '【真实教辅资料示例——理解多样性】', category: '分析-分析模板示例', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：结构分析[] (示范：大题/题型/设问风格/难度/小题数量/小题列表/总题数/总分)
    content: '示例1：单元测试卷（小学语文）\n原文："第五单元素养提优卷（满分：100分 时间：90分钟）\n一、读下面的语段，按要求完成练习。（12分）\n1. 根据语段填写词语。（6分）\n2. 语段①中的加点词语含有**一对**近义词...\n二、选择正确的答案。（5分）\n三、语文与生活。(8分)\n四、材料连贯性文本,完成练习。(20分)\n五、阅读课外短文，完成练习。(25分)\n六、习作。（30分）"\n\n提取结果：{"结构分析":[{"大题":"一、读下面的语段，按要求完成练习","题型":"读下面的语段，按要求完成练习","设问风格":"根据语段填写词语","难度":"基础","小题数量":3,"小题列表":[{"小题序号":"1.","分值":6},{"小题序号":"2.","分值":1},{"小题序号":"3.","分值":2}]}],"总题数":22,"总分":100}\n\n示例2：专项训练卷（数学）\n原文："专项突破·计算能力训练\n一、直接写出得数。（每小题1分，共8分）\n1. 25×4=   2. 120÷6=   3. 3.5+2.8=\n二、脱式计算。（每小题3分，共12分）\n1. (125+75)×8   2. 360÷(12+8)"\n\n示例3：课时练（英语）\n原文："Unit 3 My Friends - Period 1\nPart A Let\'s talk & Let\'s learn\n一、Listen and choose.（听录音，选出你所听到的单词。）\n( ) 1. A. tall B. short C. thin\n二、Read and match.（读一读，连一连。）"\n\n示例4：期中/期末试卷（综合）\n原文："2024-2025学年度第一学期期中考试\n七年级道德与法治试题\n（考试时间：60分钟  满分：100分）\n第Ⅰ卷 选择题（共40分）\n一、单项选择题（下列各题的四个选项中，只有一项是最符合题意的。每小题2分，共40分）\n...\n第Ⅱ卷 非选择题（共60分）\n二、简答题（每小题6分，共12分）\n...\n三、材料分析题（每小题8分，共16分）\n..."\n\n示例5：知识点总结（理科）\n原文："第三章 物质的构成\n【知识梳理】\n一、分子和原子\n1. 分子的定义：保持物质化学性质的最小粒子\n2. 原子的定义：化学变化中的最小粒子\n【典型例题】\n例1：下列关于分子的说法正确的是（ ）\nA. 分子是保持物质性质的最小粒子\nB. 分子在化学变化中可以再分"',
    builtin: true
  },
  {
    id: 'block_error_examples', name: '【错误示例——以下提取全部作废】', category: '分析-分析模板示例', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：结构分析[].题型, 结构分析[].设问风格（反例：禁止归纳改写）
    content: '❌ "题型": "阅读理解" → 原文写的是"一、读下面的语段，按要求完成练习"，应该完整复制\n❌ "设问风格": "根据短文填空" → 原文写的是"根据语段填写词语"，必须逐字复制\n❌ "小题数量": 20 → 原文没有明确说明小题数量，应该根据实际提取的小题计算',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【分析-分析提取要求】块级指令
  // 🔗 映射结果字段：结构分析[].大题, 结构分析[].题型, 结构分析[].设问风格, 结构分析[].分值, 总题数, 总分
  // ═══════════════════════════════════════
  {
    id: 'block_extraction_reqs', name: '【提取要求——除难度外，所有字段直接从原文原样提取，一个字都不要改】', category: '分析-分析提取要求', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：结构分析[].大题, 结构分析[].小题序号, 结构分析[].题型, 结构分析[].设问风格, 结构分析[].分值, 总题数, 总分
    content: '1. 识别每道大题：原文中标注了"一、""二、""第一部分""专项一""第五单元"或类似标记的为大题\n2. 大题下的小题逐题提取，包括每小题序号和分值\n3. 题型名称直接用原文中的说法，原文写什么就填什么\n4. 如果原文没有大题标记，整份试卷视为一道大题，各小题直接提取\n5. 所有分值、题数、风格描述都从原文直接取，不要自己编\n6. 设问风格：该题型在原文中是如何提问的，原文用什么词就提取什么词',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【分析-知识图谱构建】块级指令
  // 🔗 映射结果字段：knowledgeMap （单元→大概念→核心知识点→具体概念 层级结构）
  // ═══════════════════════════════════════
  {
    id: 'block_candidate_kp_names', name: '【候选知识点名称——必须从以下列表中选择，或保持命名风格一致】', category: '分析-知识图谱构建', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：knowledgeMap.核心知识点 (命名规范约束)
    content: '⚠️ 知识点名称必须与以上列表一致的命名风格，不要自创不同名称指代同一概念',
    builtin: true
  },
  {
    id: 'block_input_data_desc', name: '【输入数据说明】', category: '分析-知识图谱构建', type: 'fragment',
    subject: '', stage: '', genType: '',
    // 🔗 字段映射：knowledgeMap.suggestedQuestionTypes, 核心知识点.hasFormula
    content: '- kpForTest：每个知识点对象，hasFormula=true表示涉及公式\n- suggestedQuestionTypes：该章节各知识点建议的考查题型',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【生成_学段适配】块级指令 — 根据年级自动注入
  // ═══════════════════════════════════════
  {
    id: 'gen_stage_primary_low', name: '【小学低段1-2年级】', category: '生成-学段适配', type: 'fragment',
    prompt_order: 16,
    subject: '', stage: 'primary_low', genType: '',
    content: '- 📘 小学低段（1-2年级）：语言简洁口语化；多用具体、形象的表述，避免抽象概念；选择题选项宜少（建议2-3个）',
    builtin: true
  },
  {
    id: 'gen_stage_primary_mid', name: '【小学中段3-4年级】', category: '生成-学段适配', type: 'fragment',
    prompt_order: 16,
    subject: '', stage: 'primary_mid', genType: '',
    content: '- 📘 小学中段（3-4年级）：增加段落阅读量；适当引入简单应用题和阅读理解',
    builtin: true
  },
  {
    id: 'gen_stage_primary_high', name: '【小学高段5-6年级】', category: '生成-学段适配', type: 'fragment',
    prompt_order: 16,
    subject: '', stage: 'primary_high', genType: '',
    content: '- 📘 小学高段（5-6年级）：增加阅读量和思维深度；为初中衔接做准备',
    builtin: true
  },
  {
    id: 'gen_stage_middle', name: '【初中】', category: '生成-学段适配', type: 'fragment',
    prompt_order: 16,
    subject: '', stage: 'middle', genType: '',
    content: '- 📙 初中学段：逐步增加抽象思维和多步推理；可引入跨章节综合；对标中考题型',
    builtin: true
  },
  {
    id: 'gen_stage_high', name: '【高中】', category: '生成-学段适配', type: 'fragment',
    prompt_order: 16,
    subject: '', stage: 'high', genType: '',
    content: '- 📕 高中学段：参考高考题型和分值方向；注重核心素养和跨模块综合；可设压轴题',
    builtin: true
  },

  // ═══════════════════════════════════════
  // 【生成_学科适配】块级指令 — 根据学科+学段自动注入（subjectMap 拆分）
  // ═══════════════════════════════════════
  { id: 'gen_subj_chinese_primary_low', name: '【语文-小学低段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '语文', stage: 'primary_low', genType: '',
    content: '- 语文（低段1-2年级）：识字写字（拼音、田字格、结构）、词语积累（组词、释义）、句子仿写、朗读课文；题干配拼音', builtin: true },
  { id: 'gen_subj_chinese_primary_mid', name: '【语文-小学中段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: '',
    content: '- 语文（中段3-4年级）：字词运用+句段分析+简单篇章理解；开始习作训练（段落写作）；逐步减少拼音；增加阅读量', builtin: true },
  { id: 'gen_subj_chinese_primary_high', name: '【语文-小学高段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: '',
    content: '- 语文（高段5-6年级）：篇章理解+习作训练（完整作文）；修辞赏析+文言文启蒙；读写结合+文化浸润；为初中衔接', builtin: true },
  { id: 'gen_subj_chinese_middle', name: '【语文-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '语文', stage: 'middle', genType: '',
    content: '- 语文（初中）：读写结合+文化浸润；课文理解+语言运用+写作；古诗文积累+名著阅读', builtin: true },
  { id: 'gen_subj_chinese_high', name: '【语文-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '语文', stage: 'high', genType: '',
    content: '- 语文（高中）：思辨阅读+任务驱动写作；文学鉴赏+文化传承；对标高考；注重核心素养', builtin: true },

  { id: 'gen_subj_math_primary_low', name: '【数学-小学低段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '数学', stage: 'primary_low', genType: '',
    content: '- 数学（低段1-2年级）：联系生活实际；口算和竖式格式规范；以加减乘除基础运算为主', builtin: true },
  { id: 'gen_subj_math_primary_mid', name: '【数学-小学中段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '数学', stage: 'primary_mid', genType: '',
    content: '- 数学（中段3-4年级）：应用题两步推理；分数小数初步；几何图形认识（周长/面积）；逐步用线段图替代实物图', builtin: true },
  { id: 'gen_subj_math_primary_high', name: '【数学-小学高段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '数学', stage: 'primary_high', genType: '',
    content: '- 数学（高段5-6年级）：多步推理应用题；分数小数四则运算；几何体（体积/表面积）；统计图表+概率初步；为初中衔接', builtin: true },
  { id: 'gen_subj_math_middle', name: '【数学-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '数学', stage: 'middle', genType: '',
    content: '- 数学（初中）：联系生活实际；计算规范步骤；代数+几何+统计；对标中考', builtin: true },
  { id: 'gen_subj_math_high', name: '【数学-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '数学', stage: 'high', genType: '',
    content: '- 数学（高中）：函数+几何+概率统计；建模思想+数学抽象；对标高考', builtin: true },

  { id: 'gen_subj_english_primary_low', name: '【英语-小学低段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '英语', stage: 'primary_low', genType: '',
    content: '- 英语（低段1-2年级）：以读写和字母认读为主；注意四线三格书写；题干配中文提示；围绕日常话题', builtin: true },
  { id: 'gen_subj_english_primary_mid', name: '【英语-小学中段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '英语', stage: 'primary_mid', genType: '',
    content: '- 英语（3-4年级）：词汇拼写+简单句型运用；注意四线三格书写；逐步减少中文提示；围绕日常话题+校园生活；开始短文阅读和简单对话写作', builtin: true },
  { id: 'gen_subj_english_primary_high', name: '【英语-小学高段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '英语', stage: 'primary_high', genType: '',
    content: '- 英语（5-6年级）：短文阅读+简单对话写作；基本语法规则（时态/名词复数）；逐步增加英文题干', builtin: true },
  { id: 'gen_subj_english_middle', name: '【英语-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '英语', stage: 'middle', genType: '',
    content: '- 英语（初中）：以语篇为单位；注重阅读理解和语言运用；语法系统学习；对标中考', builtin: true },
  { id: 'gen_subj_english_high', name: '【英语-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '英语', stage: 'high', genType: '',
    content: '- 英语（高中）：语篇深度理解+写作表达；综合语言运用；对标高考', builtin: true },

  { id: 'gen_subj_physics_middle', name: '【物理-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '物理', stage: 'middle', genType: '',
    content: '- 物理（初中）：力学+电学+光学+热学基础；从生活走向物理；实验探究+公式计算', builtin: true },
  { id: 'gen_subj_physics_high', name: '【物理-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '物理', stage: 'high', genType: '',
    content: '- 物理（高中）：力学+电磁学+热学+光学+原子物理；建模+数学工具；科学思维+实验创新', builtin: true },

  { id: 'gen_subj_chemistry_middle', name: '【化学-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '化学', stage: 'middle', genType: '',
    content: '- 化学（初中）：物质构成+化学变化；实验探究+方程式；从生活认识化学；强调安全', builtin: true },
  { id: 'gen_subj_chemistry_high', name: '【化学-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '化学', stage: 'high', genType: '',
    content: '- 化学（高中）：物质结构+反应原理+有机化学；宏观微观结合；模型认知+科学探究', builtin: true },

  { id: 'gen_subj_biology_middle', name: '【生物-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '生物', stage: 'middle', genType: '',
    content: '- 生物（初中）：生命现象与活动规律；实验探究+图表分析；结构与功能相适应', builtin: true },
  { id: 'gen_subj_biology_high', name: '【生物-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '生物', stage: 'high', genType: '',
    content: '- 生物（高中）：分子与细胞+遗传进化+稳态环境；科学思维+实验设计；生命观念', builtin: true },

  { id: 'gen_subj_hist_primary', name: '【历史-小学】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '历史', stage: 'primary', genType: '',
    content: '- 历史（小学融入道法课）：历史故事+人物了解；时序初步感知；培养家国情怀', builtin: true },
  { id: 'gen_subj_hist_middle', name: '【历史-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '历史', stage: 'middle', genType: '',
    content: '- 历史（初中）：中国古代史/近现代史；时序梳理+史料分析；论从史出+历史解释；对标中考', builtin: true },
  { id: 'gen_subj_hist_high', name: '【历史-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '历史', stage: 'high', genType: '',
    content: '- 历史（高中）：中外历史纲要；史料实证+历史解释+唯物史观；史料辨析+论述；对标高考', builtin: true },

  { id: 'gen_subj_geo_middle', name: '【地理-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '地理', stage: 'middle', genType: '',
    content: '- 地理（初中）：中国地理+世界地理基础；地图判读+区域认知；地理现象与生活联系', builtin: true },
  { id: 'gen_subj_geo_high', name: '【地理-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '地理', stage: 'high', genType: '',
    content: '- 地理（高中）：自然地理+人文地理+区域发展；综合思维+地理实践力；地理原理分析', builtin: true },

  { id: 'gen_subj_moral_primary', name: '【道德与法治-小学】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '道德与法治', stage: 'primary', genType: '',
    content: '- 道德与法治（小学）：道德修养+法治启蒙；情境判断+价值引领；贴近儿童生活', builtin: true },
  { id: 'gen_subj_moral_middle', name: '【道德与法治-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '道德与法治', stage: 'middle', genType: '',
    content: '- 道德与法治（初中）：政治认同+法治观念+责任意识；时政分析+情境探究；价值判断', builtin: true },
  { id: 'gen_subj_politics_high', name: '【思想政治-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '思想政治', stage: 'high', genType: '',
    content: '- 政治（高中思想政治）：时政分析+辨析论述+开放试题；对标高考政治；学科核心素养', builtin: true },

  { id: 'gen_subj_science_primary_low', name: '【科学-小学低段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '科学', stage: 'primary_low', genType: '',
    content: '- 科学（低段1-2年级）：从生活现象出发；观察+记录+简单推理；配实物图和实验示意图', builtin: true },
  { id: 'gen_subj_science_primary_mid', name: '【科学-小学中段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '科学', stage: 'primary_mid', genType: '',
    content: '- 科学（中段3-4年级）：实验设计与简单变量控制；数据记录与基础图表；物质科学+生命科学初步；适当引入科学阅读', builtin: true },
  { id: 'gen_subj_science_primary_high', name: '【科学-小学高段】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '科学', stage: 'primary_high', genType: '',
    content: '- 科学（高段5-6年级）：实验设计与变量控制；数据图表分析；探究推理+科学解释；物质/生命/地球科学三大领域；为初中理综衔接', builtin: true },

  { id: 'gen_subj_it_primary', name: '【信息科技-小学】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '信息技术', stage: 'primary', genType: '',
    content: '- 信息科技：侧重信息意识和数字化学习；题目生活化、操作化；不考查编程语法', builtin: true },
  { id: 'gen_subj_it_middle', name: '【信息科技-初中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '信息技术', stage: 'middle', genType: '',
    content: '- 信息技术：含算法思维、数据处理、网络应用；可考查简单流程图和伪代码', builtin: true },
  { id: 'gen_subj_it_high', name: '【信息科技-高中】', category: '生成-学科适配', prompt_order: 17, type: 'fragment',
    subject: '信息技术', stage: 'high', genType: '',
    content: '- 信息技术：含计算思维、算法设计、Python编程；对标学业水平考试要求', builtin: true },

  // ═══════════════════════════════════════
  // 【生成_资料类型结构】块级指令 — 根据学科+资料类型自动注入
  // ═══════════════════════════════════════
  // ── 试卷 exam ──
  { id: 'gen_struct_exam_chinese_primary_low', name: '【试卷结构-语文-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_low', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、积累与运用（识字写字、情境化考查）\n二、阅读与鉴赏（短文、绘本阅读）\n三、表达与交流（写话）', builtin: true },
  { id: 'gen_struct_exam_chinese_primary_mid', name: '【试卷结构-语文-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、积累与运用（字词句段、情境化考查）\n二、阅读与鉴赏（文学类、实用类文本）\n三、表达与交流（习作）', builtin: true },
  { id: 'gen_struct_exam_chinese_primary_high', name: '【试卷结构-语文-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、积累与运用\n二、阅读与鉴赏（文学类、实用类文本）\n三、表达与交流（习作）\n四、梳理与探究', builtin: true },
  { id: 'gen_struct_exam_chinese_middle', name: '【试卷结构-语文-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、积累与运用\n二、阅读与鉴赏（文学类、实用类、整本书阅读）\n三、表达与交流（写作、口语交际）\n四、梳理与探究', builtin: true },
  { id: 'gen_struct_exam_chinese_high', name: '【试卷结构-语文-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、阅读与鉴赏（现代文、古代诗文）\n二、表达与交流（写作）\n三、梳理与探究（语言运用、整本书阅读）', builtin: true },
  { id: 'gen_struct_exam_math_primary_low', name: '【试卷结构-数学-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_low', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础素养检测（数感/量感/运算能力核心）\n二、问题解决（生活情境中的简单应用）\n三、动手操作与探究（实物操作/图形认识）', builtin: true },
  { id: 'gen_struct_exam_math_primary_mid', name: '【试卷结构-数学-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_mid', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础素养检测（算理/概念/运算能力核心）\n二、问题解决与建模（真实情境中的数学应用）\n三、探究与创新（开放题初探/跨学科启蒙）', builtin: true },
  { id: 'gen_struct_exam_math_primary_high', name: '【试卷结构-数学-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础素养检测（算理/概念/算力核心）\n二、问题解决与建模（真实情境中的数学应用）\n三、探究与创新（开放题/跨学科融合）\n四、反思与评价', builtin: true },
  { id: 'gen_struct_exam_math_middle', name: '【试卷结构-数学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础素养检测（概念/公式/算力核心）\n二、问题解决与建模（真实情境中的数学应用）\n三、探究与创新（开放题/跨学科融合）\n四、反思与评价', builtin: true },
  { id: 'gen_struct_exam_math_high', name: '【试卷结构-数学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础素养检测（概念深化/逻辑推理核心）\n二、问题解决与建模（真实情境中的数学应用）\n三、探究与创新（开放题/跨学科融合/压轴题）\n四、反思与评价', builtin: true },
  // ── 英语 exam（按学段拆分：小学低/中/高段 + 初中 + 高中）──
  { id: 'gen_struct_exam_english_primary_low', name: '【试卷结构-英语-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_low', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言知识运用（字母与词汇认读、简单句型）\n二、阅读与理解（图片与简单语篇）\n三、表达与交际（日常交际用语）\n四、文化感知', builtin: true },
  { id: 'gen_struct_exam_english_primary_mid', name: '【试卷结构-英语-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_mid', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言知识运用（语篇中的词汇与句型活用）\n二、阅读与理解（多模态语篇）\n三、表达与交际（真实语境中的表达）\n四、文化理解与跨学科', builtin: true },
  { id: 'gen_struct_exam_english_primary_high', name: '【试卷结构-英语-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言知识运用（语篇中的词汇与语法活用）\n二、阅读与理解（多模态语篇）\n三、表达与交际（真实语境中的表达）\n四、文化理解与跨学科', builtin: true },
  { id: 'gen_struct_exam_english_middle', name: '【试卷结构-英语-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言知识运用（语篇中活用语法词汇）\n二、阅读与理解（多模态语篇、任务型阅读）\n三、表达与交际（真实语境中的写作与交际）\n四、文化理解与跨学科', builtin: true },
  { id: 'gen_struct_exam_english_high', name: '【试卷结构-英语-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言知识运用（语篇中活用语法词汇）\n二、阅读与理解（多模态语篇、思辨阅读、读写结合）\n三、表达与交际（真实语境中的写作与交际）\n四、文化理解与跨学科', builtin: true },
  // ── 物理 exam（按初/高中拆分）──
  { id: 'gen_struct_exam_physics_middle', name: '【试卷结构-物理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（概念辨析、情境判断）\n二、科学探究·填空（现象分析、原理应用）\n三、科学探究·作图（模型建构、图示表达）\n四、科学探究·实验（方案设计、数据分析）\n五、科学应用·计算（建模、推演）', builtin: true },
  { id: 'gen_struct_exam_physics_high', name: '【试卷结构-物理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（概念辨析、多选判断）\n二、科学探究·实验（方案设计、数据分析、误差评价）\n三、科学论证·计算（建模、推演、综合应用）', builtin: true },
  // ── 化学 exam（按初/高中拆分）──
  { id: 'gen_struct_exam_chemistry_middle', name: '【试卷结构-化学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（概念辨析、情境判断）\n二、科学探究·填空（化学用语、原理分析）\n三、科学探究·推断与流程（物质转化、工业流程）\n四、科学探究·实验（方案设计、数据分析）\n五、科学应用·计算（定量分析、综合运用）', builtin: true },
  { id: 'gen_struct_exam_chemistry_high', name: '【试卷结构-化学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（概念辨析、不定项选择）\n二、科学探究·填空（原理应用、综合分析）\n三、科学探究·实验（方案设计、数据分析、评价）\n四、科学应用·计算（定量分析、综合运用）', builtin: true },
  // ── 生物 exam（按初/高中拆分）──
  { id: 'gen_struct_exam_biology_middle', name: '【试卷结构-生物-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（概念辨析、情境判断）\n二、科学探究·填空（结构功能、过程分析）\n三、科学探究·识图分析（模式图、数据图表）\n四、科学探究·实验（方案设计、结果分析）', builtin: true },
  { id: 'gen_struct_exam_biology_high', name: '【试卷结构-生物-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（概念辨析、不定项选择）\n二、科学探究·填空（过程分析、综合应用）\n三、科学探究·识图分析（模式图、数据图表、遗传分析）\n四、科学探究·实验（方案设计、结果评价、探究创新）', builtin: true },
 // ── 历史 exam（按初/高中拆分）──
  { id: 'gen_struct_exam_history_middle', name: '【试卷结构-历史-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、唯物史观·选择（基础史实、概念辨析）\n二、史料实证·材料解析（史料解读、信息提取、论证）\n三、历史解释·简答（因果分析、评价阐释）', builtin: true },
  { id: 'gen_struct_exam_history_high', name: '【试卷结构-历史-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、唯物史观·选择（概念辨析、情境判断）\n二、史料实证·材料解析（多则史料、比较分析、论证）\n三、历史解释·论述（观点、史料、论证）', builtin: true },
  // ── 地理 exam（按初/高中拆分）──
  { id: 'gen_struct_exam_geo_middle', name: '【试卷结构-地理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、区域认知·选择（地理概念、空间定位）\n二、综合思维·读图分析（图表判读、信息提取、推理）\n三、地理实践力·综合（真实情境、问题解决）', builtin: true },
  { id: 'gen_struct_exam_geo_high', name: '【试卷结构-地理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、区域认知·选择（概念辨析、空间思维）\n二、综合思维·综合（多要素分析、区域比较）\n三、人地协调观·选做（可持续发展、实践探究）', builtin: true },
  // ── 道德与法治/思想政治 exam（按初/高中拆分）──
  { id: 'gen_struct_exam_moral_middle', name: '【试卷结构-道德与法治-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '道德与法治,政治', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、政治认同·选择（基础知识、价值判断）\n二、法治观念·简答（案例分析、法理阐释）\n三、责任意识·材料分析（情境探究、实践应用）', builtin: true },
  { id: 'gen_struct_exam_moral_high', name: '【试卷结构-思想政治-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '思想政治', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、政治认同·选择（基础理论、时政判断）\n二、科学精神·简答（原理阐释、逻辑分析）\n三、法治意识·材料分析（案例、法理、论证）\n四、公共参与·综合探究（实践方案、评价反思）', builtin: true },
  // ── 科学 exam（按小学低/中/高段拆分）──
  { id: 'gen_struct_exam_science_primary_low', name: '【试卷结构-科学-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_low', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（现象辨识、概念判断）\n二、科学探究·判断（事实辨析、因果推理）\n三、科学探究·连线（概念关联、分类匹配）\n四、科学探究·观察记录（现象描述、数据记录）', builtin: true },
  { id: 'gen_struct_exam_science_primary_mid', name: '【试卷结构-科学-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_mid', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（概念辨析、情境判断）\n二、科学探究·填空（知识应用、现象解释）\n三、科学探究·判断（事实辨析、推理评价）\n四、科学探究·实验探究（方案设计、数据分析）\n五、科学态度·简答（问题解决、社会责任）', builtin: true },
  { id: 'gen_struct_exam_science_primary_high', name: '【试卷结构-科学-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_high', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（概念辨析、情境判断）\n二、科学探究·填空（原理应用、综合推理）\n三、科学探究·实验探究（方案设计、数据分析、评价）\n四、科学应用·综合（真实问题、跨学科融合）', builtin: true },

  // ── 语文 practice（按学段拆分：小学低/中/高段 + 初中 + 高中）──
  { id: 'gen_struct_practice_chinese_primary_low', name: '【课时练结构-语文-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_low', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（字词积累、情境感知）\n二、任务驱动（阅读、表达）\n三、素养拓展（整本书、跨媒体）', builtin: true },
  { id: 'gen_struct_practice_chinese_primary_mid', name: '【课时练结构-语文-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（字词句段、朗读积累）\n二、任务驱动（阅读策略、表达训练）\n三、素养拓展（整本书、跨媒体）', builtin: true },
  { id: 'gen_struct_practice_chinese_primary_high', name: '【课时练结构-语文-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（语言积累、梳理探究）\n二、任务驱动（文学阅读、表达交流）\n三、素养拓展（整本书、跨媒体、综合实践）', builtin: true },
  { id: 'gen_struct_practice_chinese_middle', name: '【课时练结构-语文-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（语言积累、梳理探究）\n二、任务驱动（文学阅读、实用阅读、表达交流）\n三、素养拓展（整本书、跨媒体、综合实践）', builtin: true },
  { id: 'gen_struct_practice_chinese_high', name: '【课时练结构-语文-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（语言积累、梳理探究）\n二、任务驱动（文学阅读、思辨表达）\n三、素养拓展（整本书、跨媒体、综合实践）', builtin: true },
  // ── 数学 practice（按学段拆分：小学低/中/高段 + 初中 + 高中）──
  { id: 'gen_struct_practice_math_primary_low', name: '【课时练结构-数学-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_low', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、情境感知·基础建构（数感建立、操作体验）\n二、合作探究·能力进阶（游戏化任务、直观推理）\n三、迁移创新·素养提升（生活应用、趣味挑战）', builtin: true },
  { id: 'gen_struct_practice_math_primary_mid', name: '【课时练结构-数学-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_mid', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、情境感知·基础建构（算理理解、概念建立）\n二、合作探究·能力进阶（问题链、变式训练）\n三、迁移创新·素养提升（真实情境、跨学科启蒙）', builtin: true },
  { id: 'gen_struct_practice_math_primary_high', name: '【课时练结构-数学-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、情境感知·基础建构（算理理解、概念建立）\n二、合作探究·能力进阶（问题链、变式训练）\n三、迁移创新·素养提升（真实情境、跨学科应用）', builtin: true },
  { id: 'gen_struct_practice_math_middle', name: '【课时练结构-数学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、情境感知·基础建构（概念理解、公式推导）\n二、合作探究·能力进阶（问题链、变式训练）\n三、迁移创新·素养提升（真实情境、跨学科应用）', builtin: true },
  { id: 'gen_struct_practice_math_high', name: '【课时练结构-数学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、情境感知·基础建构（概念深化、定理推导）\n二、合作探究·能力进阶（问题链、变式训练）\n三、迁移创新·素养提升（真实情境、跨学科应用）', builtin: true },
  // ── 英语 practice（按学段拆分：小学低/中/高段 + 初中 + 高中）──
  { id: 'gen_struct_practice_english_primary_low', name: '【课时练结构-英语-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_low', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言感知·基础建构（词汇句型、情境感知）\n二、任务驱动·能力进阶（语篇理解、交际训练）\n三、文化体验·素养提升（跨文化、跨学科）', builtin: true },
  { id: 'gen_struct_practice_english_primary_mid', name: '【课时练结构-英语-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_mid', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言感知·基础建构（词汇积累、句型运用）\n二、任务驱动·能力进阶（语篇理解、交际训练）\n三、文化体验·素养提升（跨文化、跨学科）', builtin: true },
  { id: 'gen_struct_practice_english_primary_high', name: '【课时练结构-英语-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言感知·基础建构（词汇语法、语境感知）\n二、任务驱动·能力进阶（语篇理解、交际训练）\n三、文化体验·素养提升（跨文化、跨学科）', builtin: true },
  { id: 'gen_struct_practice_english_middle', name: '【课时练结构-英语-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言感知·基础建构（词汇语法、语篇感知）\n二、任务驱动·能力进阶（多模态阅读、交际训练）\n三、文化体验·素养提升（跨文化、跨学科）', builtin: true },
  { id: 'gen_struct_practice_english_high', name: '【课时练结构-英语-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、语言感知·基础建构（词汇搭配、语法精练）\n二、任务驱动·能力进阶（多模态阅读、思辨训练）\n三、文化体验·素养提升（跨文化、跨学科）', builtin: true },
  // ── 科学 practice（按小学低/中/高段拆分）──
  { id: 'gen_struct_practice_science_primary_low', name: '【课时练结构-科学-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_low', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（科学概念、观察方法）\n二、实验探究·能力进阶（动手操作、记录分析）\n三、科学应用·素养提升（真实情境、跨学科）', builtin: true },
  { id: 'gen_struct_practice_science_primary_mid', name: '【课时练结构-科学-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_mid', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（科学概念、原理理解）\n二、实验探究·能力进阶（方案设计、数据分析）\n三、科学应用·素养提升（真实情境、跨学科）', builtin: true },
  { id: 'gen_struct_practice_science_primary_high', name: '【课时练结构-科学-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（科学概念、原理深化）\n二、实验探究·能力进阶（自主设计、数据评价）\n三、科学应用·素养提升（真实情境、跨学科）', builtin: true },
  // ── 物理 practice（按初/高中拆分）──
  { id: 'gen_struct_practice_physics_middle', name: '【课时练结构-物理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（概念理解、模型建构）\n二、实验探究·能力进阶（方案设计、数据分析）\n三、科学应用·素养提升（真实情境、跨学科）', builtin: true },
  { id: 'gen_struct_practice_physics_high', name: '【课时练结构-物理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（概念深化、模型建构）\n二、实验探究·能力进阶（自主设计、误差评价）\n三、科学应用·素养提升（真实情境、跨学科）', builtin: true },
  // ── 化学 practice（按初/高中拆分）──
  { id: 'gen_struct_practice_chemistry_middle', name: '【课时练结构-化学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（概念理解、化学用语）\n二、实验探究·能力进阶（方案设计、数据分析）\n三、科学应用·素养提升（真实情境、跨学科）', builtin: true },
  { id: 'gen_struct_practice_chemistry_high', name: '【课时练结构-化学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（概念深化、原理理解）\n二、实验探究·能力进阶（自主设计、数据分析）\n三、科学应用·素养提升（真实情境、跨学科）', builtin: true },
  // ── 生物 practice（按初/高中拆分）──
  { id: 'gen_struct_practice_biology_middle', name: '【课时练结构-生物-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（概念理解、结构功能）\n二、实验探究·能力进阶（方案设计、数据分析）\n三、科学应用·素养提升（真实情境、跨学科）', builtin: true },
  { id: 'gen_struct_practice_biology_high', name: '【课时练结构-生物-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（概念深化、机制分析）\n二、实验探究·能力进阶（自主设计、结果评价）\n三、科学应用·素养提升（真实情境、跨学科）', builtin: true },
  // ── 历史 practice（按初/高中拆分）──
  { id: 'gen_struct_practice_history_middle', name: '【课时练结构-历史-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（历史概念、时序梳理）\n二、材料分析·能力进阶（史料解读、论证训练）\n三、综合探究·素养提升（历史解释、现实关联）', builtin: true },
  { id: 'gen_struct_practice_history_high', name: '【课时练结构-历史-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（历史概念、时序框架）\n二、材料分析·能力进阶（多则史料、比较论证）\n三、综合探究·素养提升（历史解释、现实关联）', builtin: true },
  // ── 地理 practice（按初/高中拆分）──
  { id: 'gen_struct_practice_geo_middle', name: '【课时练结构-地理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（地理概念、空间定位）\n二、材料分析·能力进阶（图表判读、综合思维）\n三、综合探究·素养提升（区域发展、人地协调）', builtin: true },
  { id: 'gen_struct_practice_geo_high', name: '【课时练结构-地理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（地理概念、空间思维）\n二、材料分析·能力进阶（多要素分析、区域比较）\n三、综合探究·素养提升（区域发展、人地协调）', builtin: true },
  // ── 道德与法治/思想政治 practice（按初/高中拆分）──
  { id: 'gen_struct_practice_moral_middle', name: '【课时练结构-道德与法治-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '道德与法治,政治', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（核心概念、价值认知）\n二、材料分析·能力进阶（情境辨析、法治思维）\n三、综合探究·素养提升（社会实践、公共参与）', builtin: true },
  { id: 'gen_struct_practice_moral_high', name: '【课时练结构-思想政治-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '思想政治', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（核心概念、理论理解）\n二、材料分析·能力进阶（时政分析、辩证思维）\n三、综合探究·素养提升（社会实践、公共参与）', builtin: true },

  // ── 专项突破 special（按学科×学段×专项领域拆分，聚焦单一技能）──
  // 语文 — 阅读理解专项
  { id: 'gen_struct_special_chinese_reading_primary_mid', name: '【专项结构-语文-阅读理解-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: 'special', specialSubType: '阅读理解',
    content: '结构参考：\n一、方法点拨\n二、阶梯训练\n三、能力检测', builtin: true },
  { id: 'gen_struct_special_chinese_reading_primary_high', name: '【专项结构-语文-阅读理解-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'special', specialSubType: '阅读理解',
    content: '结构参考：\n一、方法点拨\n二、阶梯训练\n三、实战检测', builtin: true },
  { id: 'gen_struct_special_chinese_reading_middle', name: '【专项结构-语文-阅读理解-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'special', specialSubType: '阅读理解',
    content: '结构参考：\n一、文体知识与方法\n二、分类训练\n三、综合实战', builtin: true },
  { id: 'gen_struct_special_chinese_reading_high', name: '【专项结构-语文-阅读理解-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'special', specialSubType: '阅读理解',
    content: '结构参考：\n一、文本解读方法\n二、分类深练\n三、限时实战', builtin: true },
  // 语文 — 古诗词专项
  { id: 'gen_struct_special_chinese_poetry_primary_high', name: '【专项结构-语文-古诗词-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'special', specialSubType: '古诗词',
    content: '结构参考：\n一、诗词积累\n二、专题训练\n三、综合检测', builtin: true },
  { id: 'gen_struct_special_chinese_poetry_middle', name: '【专项结构-语文-古诗词-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'special', specialSubType: '古诗词',
    content: '结构参考：\n一、鉴赏方法\n二、分类训练\n三、对比阅读', builtin: true },
  { id: 'gen_struct_special_chinese_poetry_high', name: '【专项结构-语文-古诗词-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'special', specialSubType: '古诗词',
    content: '结构参考：\n一、鉴赏体系\n二、分类深练\n三、限时实战', builtin: true },
  // 语文 — 文言文专项
  { id: 'gen_struct_special_chinese_classical_middle', name: '【专项结构-语文-文言文-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'special', specialSubType: '文言文',
    content: '结构参考：\n一、基础积累\n二、课内精读\n三、课外迁移', builtin: true },
  { id: 'gen_struct_special_chinese_classical_high', name: '【专项结构-语文-文言文-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'special', specialSubType: '文言文',
    content: '结构参考：\n一、知识体系\n二、分类训练\n三、综合实战', builtin: true },
  // 语文 — 写作专项
  { id: 'gen_struct_special_chinese_writing_primary_mid', name: '【专项结构-语文-写作-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: 'special', specialSubType: '写作',
    content: '结构参考：\n一、写作技法\n二、片段训练\n三、完整习作', builtin: true },
  { id: 'gen_struct_special_chinese_writing_primary_high', name: '【专项结构-语文-写作-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'special', specialSubType: '写作',
    content: '结构参考：\n一、技法精讲\n二、阶梯练笔\n三、佳作赏析', builtin: true },
  { id: 'gen_struct_special_chinese_writing_middle', name: '【专项结构-语文-写作-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'special', specialSubType: '写作',
    content: '结构参考：\n一、技法精讲\n二、阶梯训练\n三、升格指导', builtin: true },
  { id: 'gen_struct_special_chinese_writing_high', name: '【专项结构-语文-写作-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'special', specialSubType: '写作',
    content: '结构参考：\n一、技法精讲\n二、阶梯训练\n三、实战升格', builtin: true },
  // 数学 — 计算专项
  { id: 'gen_struct_special_math_calc_primary_low', name: '【专项结构-数学-计算-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_low', genType: 'special', specialSubType: '计算',
    content: '结构参考：\n一、算理回顾\n二、阶梯训练\n三、速算挑战', builtin: true },
  { id: 'gen_struct_special_math_calc_primary_mid', name: '【专项结构-数学-计算-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_mid', genType: 'special', specialSubType: '计算',
    content: '结构参考：\n一、算理与技巧\n二、阶梯训练\n三、易错辨析', builtin: true },
  { id: 'gen_struct_special_math_calc_primary_high', name: '【专项结构-数学-计算-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_high', genType: 'special', specialSubType: '计算',
    content: '结构参考：\n一、技巧精讲\n二、阶梯训练\n三、挑战擂台', builtin: true },
  // 数学 — 应用题专项
  { id: 'gen_struct_special_math_word_primary_high', name: '【专项结构-数学-应用题-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_high', genType: 'special', specialSubType: '应用题',
    content: '结构参考：\n一、解题策略\n二、分类训练\n三、综合实战', builtin: true },
  { id: 'gen_struct_special_math_word_middle', name: '【专项结构-数学-应用题-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'middle', genType: 'special', specialSubType: '应用题',
    content: '结构参考：\n一、建模方法\n二、分类训练\n三、综合实战', builtin: true },
  // 数学 — 几何专项
  { id: 'gen_struct_special_math_geo_middle', name: '【专项结构-数学-几何-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'middle', genType: 'special', specialSubType: '几何',
    content: '结构参考：\n一、定理与方法\n二、阶梯训练\n三、中考链接', builtin: true },
  // 英语 — 阅读专项
  { id: 'gen_struct_special_english_reading_primary_high', name: '【专项结构-英语-阅读-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_high', genType: 'special', specialSubType: '阅读理解',
    content: '结构参考：\n一、阅读策略\n二、阶梯训练\n三、实战检测', builtin: true },
  { id: 'gen_struct_special_english_reading_middle', name: '【专项结构-英语-阅读-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'special', specialSubType: '阅读理解',
    content: '结构参考：\n一、阅读策略体系\n二、分类训练\n三、中考实战', builtin: true },
  { id: 'gen_struct_special_english_reading_high', name: '【专项结构-英语-阅读-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'high', genType: 'special', specialSubType: '阅读理解',
    content: '结构参考：\n一、深度阅读策略\n二、分类训练\n三、限时实战', builtin: true },
  // 英语 — 语法专项
  { id: 'gen_struct_special_english_grammar_middle', name: '【专项结构-英语-语法-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'special', specialSubType: '语法',
    content: '结构参考：\n一、规则精讲\n二、阶梯训练\n三、中考链接', builtin: true },

  // ── 课前预习 preview（小学段见下方按学段拆分，此处保留初中/高中）──
  { id: 'gen_struct_preview_chinese_middle', name: '【预习结构-语文-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、字词疏通\n三、背景了解\n四、文本预习\n五、预习检测', builtin: true },
  { id: 'gen_struct_preview_chinese_high', name: '【预习结构-语文-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、背景链接\n三、文本初探\n四、疑难标注\n五、预习检测', builtin: true },
  // ── 数学 preview（初中/高中，小学段见下方按学段拆分）──
  { id: 'gen_struct_preview_math_middle', name: '【预习结构-数学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、旧知回顾\n三、概念预习\n四、例题试做与思路模仿\n五、预习检测\n六、我的疑问', builtin: true },
  { id: 'gen_struct_preview_math_high', name: '【预习结构-数学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、知识衔接\n三、概念与定理预习\n四、例题试做与变式思考\n五、预习检测\n六、我的疑问与思考', builtin: true },
  // ── 英语 preview（primary_low + 初中/高中，primary_mid/high见下方按学段拆分）──
  { id: 'gen_struct_preview_english_primary_low', name: '【预习结构-英语-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_low', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、语音与词汇预习\n三、歌曲\n四、预习检测', builtin: true },
  { id: 'gen_struct_preview_english_middle', name: '【预习结构-英语-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、词汇预习\n三、语法感知\n四、语篇预习\n五、预习检测', builtin: true },
  { id: 'gen_struct_preview_english_high', name: '【预习结构-英语-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、词汇预习\n三、语法与长难句分析\n四、语篇预习\n五、预习检测', builtin: true },
  // ── 科学 preview（按小学低/中/高段拆分）──
  { id: 'gen_struct_preview_science_primary_low', name: '【预习结构-科学-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_low', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、观察与发现\n三、趣味问题\n四、预习检测', builtin: true },
  { id: 'gen_struct_preview_science_primary_mid', name: '【预习结构-科学-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_mid', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、现象观察与提问\n三、概念预读\n四、预习检测', builtin: true },
  { id: 'gen_struct_preview_science_primary_high', name: '【预习结构-科学-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、现象观察\n三、实验设计预思考\n四、预习检测', builtin: true },
  // ── 理科 preview（物理/化学/生物，按初/高中拆分）──
  { id: 'gen_struct_preview_physics_middle', name: '【预习结构-物理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、生活观察与问题引入\n三、概念与规律预读\n四、实验预思考\n五、预习检测', builtin: true },
  { id: 'gen_struct_preview_physics_high', name: '【预习结构-物理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、物理情境与模型建构\n三、概念与规律预习\n四、例题试做\n五、预习检测', builtin: true },
  { id: 'gen_struct_preview_chemistry_middle', name: '【预习结构-化学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、生活情境与问题引入\n三、概念与化学用语预读\n四、实验预思考\n五、预习检测', builtin: true },
  { id: 'gen_struct_preview_chemistry_high', name: '【预习结构-化学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、知识衔接与问题引入\n三、概念与原理预习\n四、例题试做与思维建模\n五、预习检测', builtin: true },
  { id: 'gen_struct_preview_biology_middle', name: '【预习结构-生物-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、生活观察与认知准备\n三、概念与结构预读\n四、预习检测', builtin: true },
  { id: 'gen_struct_preview_biology_high', name: '【预习结构-生物-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、知识衔接与概念预读\n三、过程与机制预习\n四、实验预思考\n五、预习检测', builtin: true },
  // 文科预习
  { id: 'gen_struct_preview_history_middle', name: '【预习结构-历史-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、背景感知\n三、时序梳理\n四、预习检测', builtin: true },
  { id: 'gen_struct_preview_history_high', name: '【预习结构-历史-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、阶段背景\n三、史料初读\n四、问题探究\n五、预习检测', builtin: true },
  { id: 'gen_struct_preview_geo_middle', name: '【预习结构-地理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、地图感知\n三、概念预读\n四、预习检测', builtin: true },
  { id: 'gen_struct_preview_geo_high', name: '【预习结构-地理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、区域认知\n三、原理预读\n四、案例分析\n五、预习检测', builtin: true },
  { id: 'gen_struct_preview_moral_middle', name: '【预习结构-道德与法治-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '道德与法治,政治', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、情境导入\n三、概念预读\n四、价值辨析\n五、预习检测', builtin: true },
  { id: 'gen_struct_preview_moral_high', name: '【预习结构-思想政治-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '思想政治', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、时政导入\n三、理论预读\n四、议题探究\n五、预习检测', builtin: true },
  // 信息技术预习
  { id: 'gen_struct_preview_it', name: '【预习结构-信息技术】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '信息技术,信息科技', stage: '', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、学习目标\n二、任务认知与工具初识\n三、预习检测', builtin: true },

  // ── 知识点总结 summary ──

  { id: 'gen_struct_summary_chinese_primary_low', name: '【总结结构-语文-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_low', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（识字写字·词句积累·课文感知）\n二、核心能力聚焦（识字与写字、阅读与鉴赏）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（文化启蒙、趣味阅读）', builtin: true },
  { id: 'gen_struct_summary_chinese_primary_high', name: '【总结结构-语文-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（字词句篇·知识网络）\n二、核心能力聚焦（阅读策略、习作方法）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（文化自信、整本书阅读、跨学科）', builtin: true },
  { id: 'gen_struct_summary_chinese_high', name: '【总结结构-语文-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（字词句篇·知识网络）\n二、核心能力聚焦（思辨阅读、学术写作）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（文化传承、专题探究、跨学科）', builtin: true },
  { id: 'gen_struct_summary_math_primary_mid', name: '【总结结构-数学-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_mid', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·计算·图形与测量）\n二、核心能力聚焦（运算能力、空间观念、数据意识）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（生活应用、趣味探究）', builtin: true },
  { id: 'gen_struct_summary_math_middle', name: '【总结结构-数学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·公式·定理·知识网络）\n二、核心能力聚焦（抽象能力、推理能力、模型观念）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、自我评价）', builtin: true },
  { id: 'gen_struct_summary_science_primary_low', name: '【总结结构-科学-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_low', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（现象观察·概念启蒙·知识卡片）\n二、核心能力聚焦（观察能力、简单探究）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（科学兴趣、生活链接）', builtin: true },
  { id: 'gen_struct_summary_science_primary_mid', name: '【总结结构-科学-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_mid', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·实验·知识网络）\n二、核心能力聚焦（科学思维、实验方法）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、探究实践）', builtin: true },
  { id: 'gen_struct_summary_science_primary_high', name: '【总结结构-科学-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·原理·知识网络）\n二、核心能力聚焦（科学思维、实验设计）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、创新意识）', builtin: true },
  { id: 'gen_struct_summary_chinese', name: '【总结结构-语文】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（字词句篇·知识网络）\n二、核心能力聚焦（阅读、表达）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（文化传承、整本书、跨学科）', builtin: true },
  { id: 'gen_struct_summary_math', name: '【总结结构-数学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·公式·定理·知识网络）\n二、核心能力聚焦（数学思维、解题策略）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、自我评价）', builtin: true },
  // ── 英语 summary（初中/高中，小学段见下方按学段拆分）──
  { id: 'gen_struct_summary_english_middle', name: '【总结结构-英语-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（词汇·语法·语篇·知识网络）\n二、核心能力聚焦（听说读写融通）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨文化、跨学科）', builtin: true },
  { id: 'gen_struct_summary_english_high', name: '【总结结构-英语-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（词汇·语法·语篇·知识网络）\n二、核心能力聚焦（听说读写融通）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨文化、深度思维、学术素养）', builtin: true },
  // ── 英语小学段 summary（2022 课标要求小学以听说为主、读写跟进，注重文化意识启蒙）──
  { id: 'gen_struct_summary_english_primary', name: '【总结结构-英语-小学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_low,primary_mid,primary_high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（话题词汇·核心句型·语音规律）\n二、核心能力聚焦（听说领先、读写跟进）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（文化意识启蒙、跨学科趣味活动）', builtin: true },

  // ── 专项突破 special ──
  { id: 'gen_struct_special_chinese', name: '【专项结构-语文】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、情境典例\n三、分层变式\n四、综合实践', builtin: true },
  { id: 'gen_struct_special_math', name: '【专项结构-数学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、情境典例\n三、分层变式\n四、综合实践', builtin: true },
  { id: 'gen_struct_special_english', name: '【专项结构-英语】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、情境典例\n三、分层变式\n四、综合实践', builtin: true },

  // ── 阅读训练 reading ──
  { id: 'gen_struct_reading_chinese', name: '【阅读结构-语文】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: '', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、短文阅读\n二、古诗文\n三、非连续性文本阅读\n四、阅读理解题\n五、拓展思考', builtin: true },
  { id: 'gen_struct_reading_english', name: '【阅读结构-英语】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: '', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、短文阅读\n二、阅读理解题\n三、语言积累', builtin: true },

  // ── 默写 dictation ──
  { id: 'gen_struct_dictation_chinese', name: '【默写结构-语文】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: '', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、生字默写\n二、词语默写\n三、句子默写', builtin: true },
  { id: 'gen_struct_dictation_english', name: '【默写结构-英语】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: '', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、英译汉：给出英文单词\n二、汉译英：给出中文释义\n三、单词挖空默写：给出部分字母提示\n四、短语默写\n五、句子默写', builtin: true },

  // ── 错题本 errorbook ──
  { id: 'gen_struct_errorbook_chinese', name: '【错题本结构-语文】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题整理\n二、错误归因与素养反思\n三、正确解法\n四、变式巩固', builtin: true },
  { id: 'gen_struct_errorbook_math', name: '【错题本结构-数学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题整理\n二、错误归因与素养反思\n三、正确解法\n四、变式训练', builtin: true },
  { id: 'gen_struct_errorbook_english', name: '【错题本结构-英语】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题整理\n二、错误归因与素养反思\n三、正确示范\n四、变式巩固', builtin: true },
  { id: 'gen_struct_errorbook_science', name: '【错题本结构-理科】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理,化学,生物,科学', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题整理\n二、错误归因与素养反思\n三、正确解法\n四、变式巩固', builtin: true },
  // ── 文科 errorbook ──
  { id: 'gen_struct_errorbook_history', name: '【错题本结构-历史】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题整理\n二、错误归因与素养反思\n三、正确解法\n四、变式巩固', builtin: true },
  { id: 'gen_struct_errorbook_geo', name: '【错题本结构-地理】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题整理\n二、错误归因与素养反思\n三、正确解法\n四、变式巩固', builtin: true },
  { id: 'gen_struct_errorbook_moral', name: '【错题本结构-道德与法治】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '道德与法治,政治,思想政治', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题整理\n二、错误归因与素养反思\n三、正确解法\n四、变式巩固', builtin: true },
  { id: 'gen_struct_errorbook_it', name: '【错题本结构-信息技术】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '信息技术,信息科技', stage: '', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题整理\n二、错误归因与素养反思\n三、正确操作\n四、变式巩固', builtin: true },

  // ── 信息技术 genTypes ──
  { id: 'gen_struct_exam_it', name: '【试卷结构-信息技术】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '信息技术,信息科技', stage: '', genType: 'exam', specialSubType: 'new_standard',
    content: '结构参考：\n一、科学思维·选择（信息意识、概念辨析）\n二、科学探究·填空（技术原理、应用分析）\n三、数字化学习·操作（实践任务、创新应用）', builtin: true },
  { id: 'gen_struct_practice_it', name: '【课时练结构-信息技术】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '信息技术,信息科技', stage: '', genType: 'practice', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础建构（概念理解、技能初识）\n二、实验探究·能力进阶（任务驱动、实践操作）\n三、科学应用·素养提升（真实情境、创新应用）', builtin: true },
  { id: 'gen_struct_summary_it', name: '【总结结构-信息技术】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '信息技术,信息科技', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·技能·知识网络）\n二、核心能力聚焦（信息意识、计算思维）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（数字化学习、创新）', builtin: true },
  { id: 'gen_struct_special_it', name: '【专项结构-信息技术】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '信息技术,信息科技', stage: '', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、情境典例\n三、分层变式\n四、综合实践', builtin: true },

  // ── 理科 summary ──
  { id: 'gen_struct_summary_physics_middle', name: '【总结结构-物理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·公式·知识网络）\n二、核心能力聚焦（科学思维、实验方法）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、自我评价）', builtin: true },
  { id: 'gen_struct_summary_physics_high', name: '【总结结构-物理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·公式·知识网络）\n二、核心能力聚焦（模型建构、科学论证）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、创新思维）', builtin: true },
  { id: 'gen_struct_summary_chemistry_middle', name: '【总结结构-化学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·方程式·知识网络）\n二、核心能力聚焦（科学思维、实验方法）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、自我评价）', builtin: true },
  { id: 'gen_struct_summary_chemistry_high', name: '【总结结构-化学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·方程式·知识网络）\n二、核心能力聚焦（模型认知、科学探究）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、创新思维）', builtin: true },
  { id: 'gen_struct_summary_biology_middle', name: '【总结结构-生物-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·过程·知识网络）\n二、核心能力聚焦（科学思维、实验方法）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、自我评价）', builtin: true },
  { id: 'gen_struct_summary_biology_high', name: '【总结结构-生物-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·过程·知识网络）\n二、核心能力聚焦（科学探究、实验设计）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、生命观念）', builtin: true },
  { id: 'gen_struct_summary_science', name: '【总结结构-科学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: '', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·现象·知识网络）\n二、核心能力聚焦（科学思维、探究方法）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（跨学科、自我评价）', builtin: true },

  // ── 理科 special ──
  { id: 'gen_struct_special_physics_middle', name: '【专项结构-物理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'middle', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、情境典例\n三、实验专项\n四、综合实践', builtin: true },
  { id: 'gen_struct_special_physics_high', name: '【专项结构-物理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理', stage: 'high', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、模型建构\n三、情境典例\n四、综合实践', builtin: true },
  { id: 'gen_struct_special_chemistry_middle', name: '【专项结构-化学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'middle', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、情境典例\n三、实验与推断\n四、综合实践', builtin: true },
  { id: 'gen_struct_special_chemistry_high', name: '【专项结构-化学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '化学', stage: 'high', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、原理突破\n三、情境典例\n四、综合实践', builtin: true },
  { id: 'gen_struct_special_biology_middle', name: '【专项结构-生物-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'middle', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、识图专练\n三、实验分析\n四、综合实践', builtin: true },
  { id: 'gen_struct_special_biology_high', name: '【专项结构-生物-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '生物', stage: 'high', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、过程分析\n三、实验设计\n四、综合实践', builtin: true },
  { id: 'gen_struct_special_science', name: '【专项结构-科学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: '', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心素养方法\n二、实验探究\n三、分层变式\n四、综合实践', builtin: true },

  // ── 文科 summary ──
  { id: 'gen_struct_summary_history_middle', name: '【总结结构-历史-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（时序·事件·知识网络）\n二、核心能力聚焦（史料实证、历史解释）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（唯物史观、家国情怀）', builtin: true },
  { id: 'gen_struct_summary_history_high', name: '【总结结构-历史-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（时序·事件·知识网络）\n二、核心能力聚焦（史料辨析、历史论述）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（唯物史观、家国情怀）', builtin: true },
  { id: 'gen_struct_summary_geo_middle', name: '【总结结构-地理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·图表·知识网络）\n二、核心能力聚焦（区域认知、综合思维）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（地理实践力、人地协调观）', builtin: true },
  { id: 'gen_struct_summary_geo_high', name: '【总结结构-地理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·图表·知识网络）\n二、核心能力聚焦（综合思维、区域比较）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（地理实践力、人地协调观）', builtin: true },
  { id: 'gen_struct_summary_moral_middle', name: '【总结结构-道德与法治-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '道德与法治,政治', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·原理·知识网络）\n二、核心能力聚焦（法治意识、辩证思维）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（公共参与、社会责任）', builtin: true },
  { id: 'gen_struct_summary_moral_high', name: '【总结结构-思想政治-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '思想政治', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识结构化梳理（概念·原理·知识网络）\n二、核心能力聚焦（科学精神、公共参与）\n三、典型题型解析（变式训练、易错辨析）\n四、素养拓展与反思（时政分析、社会责任）', builtin: true },

  // ── 文科 special ──
  { id: 'gen_struct_special_history_middle', name: '【专项结构-历史-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'middle', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、方法指导\n二、材料解析\n三、专题训练\n四、中考实战', builtin: true },
  { id: 'gen_struct_special_history_high', name: '【专项结构-历史-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史', stage: 'high', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、方法指导\n二、史料研读\n三、论述训练\n四、高考实战', builtin: true },
  { id: 'gen_struct_special_geo_middle', name: '【专项结构-地理-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'middle', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、方法指导\n二、图表分析\n三、区域专题\n四、中考实战', builtin: true },
  { id: 'gen_struct_special_geo_high', name: '【专项结构-地理-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '地理', stage: 'high', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、方法指导\n二、综合分析\n三、原理应用\n四、高考实战', builtin: true },
  { id: 'gen_struct_special_moral_middle', name: '【专项结构-道德与法治-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '道德与法治,政治', stage: 'middle', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、方法指导\n二、案例分析\n三、专题训练\n四、中考实战', builtin: true },
  { id: 'gen_struct_special_moral_high', name: '【专项结构-思想政治-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '思想政治', stage: 'high', genType: 'special', specialSubType: 'new_standard',
    content: '结构参考：\n一、方法指导\n二、时政专题\n三、论述训练\n四、高考实战', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】新课标默认结构 — specialSubType: 'new_standard'
  //   三维度评分：subject(+2) + stage(+1) + genType(+1) + specialSubType(+5) = 最高 9 分
  //   不选命题风格时自动置顶，选中命题风格时由 big_unit/project_based 替代 (+5 互斥)
  // ═══════════════════════════════════════
  // ═══════════════════════════════════════
  // 【生成_情境方向】块级指令 — 情境化命题参考方向
  // ═══════════════════════════════════════
  { id: 'gen_ctx_primary_chinese', name: '【情境-小学-语文】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '语文', stage: 'primary', genType: '',
    content: '建议情境方向：童话故事、校园生活、家庭亲情、传统节日', builtin: true },
  { id: 'gen_ctx_primary_math', name: '【情境-小学-数学】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '数学', stage: 'primary', genType: '',
    content: '建议情境方向：购物场景、游戏活动、手工制作、校园统计', builtin: true },
  { id: 'gen_ctx_primary_english', name: '【情境-小学-英语】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '英语', stage: 'primary', genType: '',
    content: '建议情境方向：动物园、生日派对、家庭聚餐、学校课程', builtin: true },
  { id: 'gen_ctx_primary_science', name: '【情境-小学-科学】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '科学', stage: 'primary', genType: '',
    content: '建议情境方向：自然现象、科学实验、动植物观察、天气变化', builtin: true },
  { id: 'gen_ctx_middle_chinese', name: '【情境-初中-语文】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '语文', stage: 'middle', genType: '',
    content: '建议情境方向：青春成长、社会热点、传统文化、科技生活', builtin: true },
  { id: 'gen_ctx_middle_math', name: '【情境-初中-数学】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '数学', stage: 'middle', genType: '',
    content: '建议情境方向：运动数据、消费决策、测量实践、数据分析', builtin: true },
  { id: 'gen_ctx_high_chinese', name: '【情境-高中-语文】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '语文', stage: 'high', genType: '',
    content: '建议情境方向：文化传承、时代精神、思辨阅读、人生规划', builtin: true },
  { id: 'gen_ctx_high_math', name: '【情境-高中-数学】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '数学', stage: 'high', genType: '',
    content: '建议情境方向：建模分析、经济决策、工程技术、科学模拟', builtin: true },

  // 🔧 新增：补齐理科/文科/信息技术情境方向
  { id: 'gen_ctx_middle_english', name: '【情境-初中-英语】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '英语', stage: 'middle', genType: '',
    content: '建议情境方向：校园交际、旅行见闻、中外文化、环保话题', builtin: true },
  { id: 'gen_ctx_high_english', name: '【情境-高中-英语】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '英语', stage: 'high', genType: '',
    content: '建议情境方向：跨文化交际、科技发展、社会议题、生涯规划', builtin: true },
  { id: 'gen_ctx_middle_physics', name: '【情境-初中-物理】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '物理', stage: 'middle', genType: '',
    content: '建议情境方向：交通工具、体育运动、家用电器、自然现象', builtin: true },
  { id: 'gen_ctx_high_physics', name: '【情境-高中-物理】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '物理', stage: 'high', genType: '',
    content: '建议情境方向：航天科技、新能源、工程技术、前沿物理应用', builtin: true },
  { id: 'gen_ctx_middle_chemistry', name: '【情境-初中-化学】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '化学', stage: 'middle', genType: '',
    content: '建议情境方向：生活用品、食品健康、环境保护、材料科学', builtin: true },
  { id: 'gen_ctx_high_chemistry', name: '【情境-高中-化学】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '化学', stage: 'high', genType: '',
    content: '建议情境方向：化工生产、新材料研发、药物合成、绿色化学', builtin: true },
  { id: 'gen_ctx_middle_biology', name: '【情境-初中-生物】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '生物', stage: 'middle', genType: '',
    content: '建议情境方向：人体健康、生态环境、生物多样性、农业生产', builtin: true },
  { id: 'gen_ctx_high_biology', name: '【情境-高中-生物】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '生物', stage: 'high', genType: '',
    content: '建议情境方向：基因工程、细胞生物学、生态系统保护、医学健康', builtin: true },
  { id: 'gen_ctx_middle_history', name: '【情境-初中-历史】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '历史', stage: 'middle', genType: '',
    content: '建议情境方向：文物考古、历史人物、制度变迁、文化传承', builtin: true },
  { id: 'gen_ctx_high_history', name: '【情境-高中-历史】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '历史', stage: 'high', genType: '',
    content: '建议情境方向：文明比较、社会转型、全球化进程、历史思辨', builtin: true },
  { id: 'gen_ctx_middle_geo', name: '【情境-初中-地理】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '地理', stage: 'middle', genType: '',
    content: '建议情境方向：区域发展、旅游规划、自然灾害防治、资源利用', builtin: true },
  { id: 'gen_ctx_high_geo', name: '【情境-高中-地理】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '地理', stage: 'high', genType: '',
    content: '建议情境方向：城市化进程、气候变化、可持续发展、一带一路', builtin: true },
  { id: 'gen_ctx_middle_moral', name: '【情境-初中-道德与法治】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '道德与法治', stage: 'middle', genType: '',
    content: '建议情境方向：校园生活、社会公德、法治案例、国情发展', builtin: true },
  { id: 'gen_ctx_high_politics', name: '【情境-高中-思想政治】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '思想政治,政治', stage: 'high', genType: '',
    content: '建议情境方向：时政热点、经济现象、文化自信、哲学思辨', builtin: true },
  { id: 'gen_ctx_primary_it', name: '【情境-小学-信息科技】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '信息技术,信息科技', stage: 'primary', genType: '',
    content: '建议情境方向：数字绘画、文档制作、网络文明、智能设备认知', builtin: true },
  { id: 'gen_ctx_middle_it', name: '【情境-初中-信息技术】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '信息技术,信息科技', stage: 'middle', genType: '',
    content: '建议情境方向：数据分析、算法应用、网络安全、人工智能初探', builtin: true },
  { id: 'gen_ctx_high_it', name: '【情境-高中-信息技术】', category: '生成-情境方向', prompt_order: 37, type: 'fragment',
    subject: '信息技术,信息科技', stage: 'high', genType: '',
    content: '建议情境方向：Python编程应用、数据处理、人工智能伦理、信息系统设计', builtin: true },

  // ═══════════════════════════════════════
  { id: 'gen_quality_fill_lang', name: '【题目质量-填空句位-语英】', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment',
    subject: '语文,英语', stage: '', genType: 'exam,practice,special,errorbook,reading,dictation,preview',
    content: '填空规范补充：空格宜在句末或关键位置，不宜在句首暴露整句意思', builtin: true },

  // ═══════════════════════════════════════
  // 【知识边界】块级指令 — 明确告诉AI什么不考
  // ═══════════════════════════════════════
  { id: 'kb_chinese_primary_low', name: '【知识边界】语文-小学低段', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '语文', stage: 'primary_low', genType: '', content: '语文低段知识边界：\n- 不要求辨析修辞手法（比喻、拟人等仅作感性认识）\n- 不考概括段落大意或文章主旨\n- 不涉及文言文和古诗词鉴赏\n- 写话题目不要求分段、不指定字数下限\n- 生字不超出教材生字表范围\n- 阅读文章长度不超过200字', builtin: true },
  { id: 'kb_chinese_primary_mid', name: '【知识边界】语文-小学中段', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '语文', stage: 'primary_mid', genType: '', content: '语文中段知识边界：\n- 修辞手法仅考查比喻、拟人、排比的识别，不考表达效果深度分析\n- 文言文不涉及\n- 古诗词仅考查默写和简单理解\n- 习作不要求立意深度和创新性，字数300-350字为宜\n- 阅读文章长度不超过400字', builtin: true },
  { id: 'kb_chinese_primary_high', name: '【知识边界】语文-小学高段', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '语文', stage: 'primary_high', genType: '', content: '语文高段知识边界：\n- 修辞手法不考通感、互文等高级修辞\n- 不涉及文言文实词虚词辨析\n- 不考文学流派和文学史知识\n- 习作不要求议论文写作\n- 非连续性文本阅读仅限简单图文组合信息提取，不涉及多源材料比较和综合推断', builtin: true },
  { id: 'kb_chinese_middle', name: '【知识边界】语文-初中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '语文', stage: 'middle', genType: '', content: '语文初中知识边界：\n- 文言文只考课内篇目及简单课外对比阅读，不考课外生僻篇目\n- 不考文学史和文学理论', builtin: true },
  { id: 'kb_chinese_high', name: '【知识边界】语文-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '语文', stage: 'high', genType: '', content: '语文高中知识边界：\n- 选文和题目严格对标高考考试说明的知识范围，不超纲', builtin: true },
  { id: 'kb_math_primary_low', name: '【知识边界】数学-小学低段', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '数学', stage: 'primary_low', genType: '', content: '数学低段知识边界：\n- 数字不超过100\n- 加减法为主，乘除法仅限表内乘法（二年级），不涉及乘除混合运算\n- 不涉及分数和小数\n- 应用题限两步以内计算（不超过课标要求）\n- 不涉及方程、几何证明、统计图表\n- 图形仅限认识和简单分类', builtin: true },
  { id: 'kb_math_primary_mid', name: '【知识边界】数学-小学中段', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '数学', stage: 'primary_mid', genType: '', content: '数学中段知识边界：\n- 乘除法以表内乘法为基础，扩展到两位数乘一位数和除数是一位数的除法，不涉及复杂多步混合运算\n- 分数仅限初步认识（几分之一和几分之几），不涉及分数四则运算\n- 不涉及方程（用字母表示数仅限三年级起步认识）\n- 不涉及负数\n- 小数运算不超两位（仅加减，不涉及乘除）', builtin: true },
  { id: 'kb_math_primary_high', name: '【知识边界】数学-小学高段', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '数学', stage: 'primary_high', genType: '', content: '数学高段知识边界：\n- 不涉及二元一次方程组、二次方程、函数概念\n- 不涉及几何证明（仅操作探究）', builtin: true },
  { id: 'kb_math_middle', name: '【知识边界】数学-初中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '数学', stage: 'middle', genType: '', content: '数学初中知识边界：\n- 不涉及高考难度题型\n- 压轴题难度对标中考而非竞赛', builtin: true },
  { id: 'kb_english_primary_low', name: '【知识边界】英语-小学低段', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '英语', stage: 'primary_low', genType: '', content: '英语低段知识边界：\n- 不考语法术语（如"名词""动词"等概念）\n- 不考单词拼写（只考认读）\n- 不考阅读理解（只考图片匹配和简单对话）', builtin: true },
  { id: 'kb_english_primary_mid', name: '【知识边界】英语-小学中段', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '英语', stage: 'primary_mid', genType: '', content: '英语中段知识边界：\n- 语法不考时态辨析（仅认识一般现在时）\n- 写作不要求段落（仅写句子）\n- 阅读文章长度不超过80词', builtin: true },
  { id: 'kb_english_primary_high', name: '【知识边界】英语-小学高段', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '英语', stage: 'primary_high', genType: '', content: '英语高段知识边界：\n- 不考复杂从句（定语从句/宾语从句仅认识）\n- 不考虚拟语气\n- 写作不超过50词', builtin: true },
  { id: 'kb_science_primary', name: '【知识边界】科学-小学', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '科学,物理,化学,生物', stage: 'primary_low,primary_mid,primary_high', genType: '', content: '科学小学知识边界：\n- 侧重生活中的科学现象观察和简单实验操作\n- 低段（1-2年级）：仅考查感官观察和简单描述，不涉及实验设计\n- 中高段（3-6年级）：可涉及控制变量法初步，不涉及定量计算和抽象科学概念\n- 不涉及中学阶段的物理公式、化学方程式、生物学术语', builtin: true },
  { id: 'kb_science_middle', name: '【知识边界】理科-初中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '物理,化学,生物', stage: 'middle', genType: '', content: '初中知识边界补充：\n- 物理不考查相对论、量子力学等现代物理内容\n- 化学不考查有机化学（仅认识常见有机物）\n- 生物不考查基因工程、分子生物学等高中内容\n- 实验题不得涉及危险操作（如浓硫酸稀释、加热易燃气体等），安全教育相关实验除外', builtin: true },

  // 🔧 新增：补齐缺口
  { id: 'kb_math_high', name: '【知识边界】数学-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '数学', stage: 'high', genType: '', content: '数学高中知识边界：\n- 严格对标高考考试说明，不涉及大学数学内容\n- 不考查数学竞赛难度的技巧性题目\n- 建模题的情景数据应符合高中阶段认知', builtin: true },
  { id: 'kb_english_middle', name: '【知识边界】英语-初中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '英语', stage: 'middle', genType: '', content: '英语初中知识边界：\n- 词汇量对标中考考纲（约1600词），不涉及高考词汇\n- 语法不考虚拟语气、倒装句、强调句等高中语法\n- 阅读文章长度不超过300词\n- 写作不超过80词', builtin: true },
  { id: 'kb_english_high', name: '【知识边界】英语-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '英语', stage: 'high', genType: '', content: '英语高中知识边界：\n- 严格对标高考考试说明，不涉及大学英语四级内容\n- 词汇量对标高考考纲（约3500词）\n- 写作不超过120词', builtin: true },
  { id: 'kb_physics_high', name: '【知识边界】物理-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '物理', stage: 'high', genType: '', content: '物理高中知识边界：\n- 严格对标高考物理考试说明\n- 不涉及微积分求解（仅用初等数学方法）\n- 不考查大学普通物理内容\n- 计算量适中，避免过度繁琐的数值运算', builtin: true },
  { id: 'kb_chemistry_high', name: '【知识边界】化学-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '化学', stage: 'high', genType: '', content: '化学高中知识边界：\n- 严格对标高考化学考试说明\n- 有机化学不考查复杂合成路线设计\n- 不涉及大学无机/有机/物化内容\n- 计算不超出高中化学计量范畴', builtin: true },
  { id: 'kb_biology_high', name: '【知识边界】生物-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '生物', stage: 'high', genType: '', content: '生物高中知识边界：\n- 严格对标高考生物考试说明\n- 遗传题不涉及复杂系谱和概率叠加\n- 不涉及分子生物学实验技术细节（如PCR操作步骤）\n- 实验设计题不超过教材实验的变式', builtin: true },
  { id: 'kb_history_middle', name: '【知识边界】历史-初中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '历史', stage: 'middle', genType: '', content: '历史初中知识边界：\n- 中国史（古代、近现代）占比不低于70%，世界史仅限课标要求的古代文明与近现代基本线索（九年级）\n- 史料分析不涉及学术性原始史料\n- 不考历史比较研究和跨时代综合论述\n- 不涉及史学理论和历史哲学', builtin: true },
  { id: 'kb_history_high', name: '【知识边界】历史-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '历史', stage: 'high', genType: '', content: '历史高中知识边界：\n- 严格对标高考历史考试说明\n- 中外历史纲要为主，不涉及专门史\n- 论述题不要求独立研究观点，以考纲观点为准', builtin: true },
  { id: 'kb_geo_middle', name: '【知识边界】地理-初中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '地理', stage: 'middle', genType: '', content: '地理初中知识边界：\n- 中国地理+世界地理基础\n- 地图判读仅涉及等高线/气候图/政区图等基础类型\n- 不涉及复杂的地理计算和GIS技术', builtin: true },
  { id: 'kb_geo_high', name: '【知识边界】地理-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '地理', stage: 'high', genType: '', content: '地理高中知识边界：\n- 严格对标高考地理考试说明\n- 自然地理+人文地理+区域发展\n- 不涉及大学经济地理和地理信息系统技术', builtin: true },
  { id: 'kb_moral_middle', name: '【知识边界】道德与法治-初中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '道德与法治', stage: 'middle', genType: '', content: '道法初中知识边界：\n- 仅涉及道德修养+法治观念+国情教育基础\n- 法律条文仅涉及宪法和与学生相关的法律（未成年人保护法等）\n- 时政材料数据来源须真实可查\n- 不涉及政治理论和经济学深度分析', builtin: true },
  { id: 'kb_politics_high', name: '【知识边界】思想政治-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '思想政治,政治', stage: 'high', genType: '', content: '思想政治高中知识边界：\n- 严格对标高考政治考试说明\n- 经济/政治/文化/哲学四个模块\n- 时政材料数据来源须真实可查\n- 不涉及大学政治学和经济学理论', builtin: true },
  { id: 'kb_it_primary', name: '【知识边界】信息技术-小学', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '信息技术,信息科技', stage: 'primary_low,primary_mid,primary_high', genType: '', content: '信息科技小学知识边界：\n- 侧重信息意识和数字化学习习惯培养\n- 不考查编程语法和算法\n- 操作题限于基础软件使用（画图/文字处理等）', builtin: true },
  { id: 'kb_it_middle', name: '【知识边界】信息技术-初中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '信息技术,信息科技', stage: 'middle', genType: '', content: '信息技术初中知识边界：\n- 算法思维仅涉及流程图和伪代码\n- 不考查具体编程语言语法\n- 数据处理限于电子表格基础操作\n- 网络应用限于基础概念和安全', builtin: true },
  { id: 'kb_it_high', name: '【知识边界】信息技术-高中', category: '生成-知识边界', prompt_order: 80, type: 'fragment', subject: '信息技术,信息科技', stage: 'high', genType: '', content: '信息技术高中知识边界：\n- 严格对标学业水平考试要求\n- Python编程限于基础语法和简单算法\n- 不涉及数据结构、面向对象等进阶内容', builtin: true },

  // ═══════════════════════════════════════
  // 【时间分配】块级指令 — 考卷用时建议
  // ═══════════════════════════════════════
  { id: 'time_exam_primary', name: '【时间分配】小学考卷', category: '生成-时间分配', prompt_order: 55, type: 'fragment', subject: '', stage: 'primary', genType: 'exam', content: '建议用时：根据题量和学段确定一个具体数字（低段约40-50、中段约50-60、高段约70-80），输出时只写一个数字如"60分钟"，禁止写范围', builtin: true },
  { id: 'time_exam_middle', name: '【时间分配】初中考卷', category: '生成-时间分配', prompt_order: 55, type: 'fragment', subject: '', stage: 'middle', genType: 'exam', content: '建议用时：根据题量确定90或100分钟，输出时只写一个数字如"90分钟"，禁止写范围', builtin: true },
  { id: 'time_exam_high', name: '【时间分配】高中考卷', category: '生成-时间分配', prompt_order: 55, type: 'fragment', subject: '', stage: 'high', genType: 'exam', content: '建议用时：根据题量确定120或150分钟，输出时只写一个数字如"120分钟"，禁止写范围', builtin: true },

  // ═══════════════════════════════════════
  // 【答案与解析规范】块级指令 — 按资料类型+学科
  // ═══════════════════════════════════════
  { id: 'answer_exam', name: '【答案规范】考卷/课时练', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '', stage: '', genType: 'exam', content: '考卷答案规范：\n1. 客观题（选择/判断/填空）：答案明确唯一，附1-2句简要解析说明对错原因或解题关键\n2. 解答题/简答题：给出参考答案要点 + 分步给分说明（标注每个要点的分值比重）\n3. 所有解析必须标注"易错提示"——指出该题最常见的错误类型及原因\n4. 每道题答案用<div class="answer-item">分隔，标注题号', builtin: true },
  { id: 'answer_exam_math', name: '【答案规范】考卷-数理化', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '数学,物理,化学', stage: '', genType: 'exam', content: '考卷答案补充（计算与解答类）：\n- 计算题/应用题：给出完整分步解答（解→公式→代入→计算→答），每步标注得分点', builtin: true },
  { id: 'answer_exam_chinese', name: '【答案规范】考卷-语文', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '语文', stage: '', genType: 'exam', content: '语文考卷答案补充：\n- 作文/习作题：附简要写作提纲或范文片段 + 评分维度（内容/语言/结构/书写各占比例）', builtin: true },
  { id: 'answer_exam_english', name: '【答案规范】考卷-英语', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '英语', stage: '', genType: 'exam', content: '英语考卷答案补充：\n- 书面表达：附参考范文 + 内容/语言/结构/书写评分维度', builtin: true },
  { id: 'answer_practice', name: '【答案规范】课时练', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '', stage: '', genType: 'practice', content: '课时练答案规范：\n1. 客观题（选择/判断/填空）：答案明确唯一，附1-2句简要解析说明对错原因或解题关键\n2. 解答题/简答题：给出完整参考答案要点（不标注分值、不标注得分点）\n3. 所有解析标注"易错提示"——指出该题最常见的错误类型及原因\n4. 每道题答案用<div class="answer-item">分隔，标注题号\n5. ⚠️ 禁止标注分值/得分点/评分维度——课时练是课堂练习，不涉及评分', builtin: true },
  { id: 'answer_summary', name: '【答案规范】知识点总结', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '', stage: '', genType: 'summary', content: '知识点总结答案规范：\n1. 每个知识点后的"典型例题"必须配完整答案与解析（解题思路→分步解答→易错提示）\n2. "知识辨析"表格中，每个"易错点"必须配对应的"正确理解"，形成左右对比\n3. "重难点星级标注"中的高频考点必须配详细解法和变式练习', builtin: true },
  { id: 'answer_reading', name: '【答案规范】阅读理解', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '', stage: '', genType: 'reading', content: '阅读理解答案规范：\n1. 每道阅读理解题配"答题模板"+"参考答案"+"评分要点"三项\n2. 开放性题目配2-3种不同角度的示例答案，标注"角度一/二/三"\n3. 简答题答案标注"采分点"——每个得分关键词用【】括出', builtin: true },
  { id: 'answer_errorbook', name: '【答案规范】错题本', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '', stage: '', genType: 'errorbook', content: '错题本答案规范：\n1. "错误归因与素养反思"必须具体到知识点层面（如"混淆了「比喻」和「拟人」的修辞手法"），禁止笼统描述（如"粗心""不会"）\n2. "正确解法"给出完整分步思路，标注"解题关键"\n3. "变式巩固"题目必须与错题考查同一知识点但变换题型或情境，确保真正巩固', builtin: true },
  { id: 'answer_preview', name: '【答案规范】课前预习', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '', stage: '', genType: 'preview', content: '课前预习答案规范：\n1. 预习问题必须明确具体、可直接作答（如"光合作用发生在细胞的哪个结构中？"），避免笼统含糊的提问（如"想一想光合作用""了解一下XX"）\n2. 每个预习问题均需配参考答案，答案标注"教材原文定位"（可在教材第X页/第X段找到依据），方便学生自查\n3. 答案简洁明了——目标是帮助学生确认预习完成度，而非给出完整知识讲解', builtin: true },
  { id: 'answer_dictation', name: '【答案规范】默写', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '', stage: '', genType: 'dictation', content: '默写答案规范：\n1. 参考答案按默写顺序排列，标注题号', builtin: true },
  { id: 'answer_dictation_chinese', name: '【答案规范】默写-语文', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '语文', stage: '', genType: 'dictation', content: '语文默写答案补充：每个生字标注易错笔画（用\u26a0\ufe0f标记易错处）+ 多音字标注不同读音和组词 + 形近字辨析', builtin: true },
  { id: 'answer_dictation_english', name: '【答案规范】默写-英语', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '英语', stage: '', genType: 'dictation', content: '英语默写答案补充：每个单词标注英文词性缩写（n./v./adj.等）+音标，短语标注中文释义', builtin: true },
  { id: 'answer_review', name: '【答案规范】单元/期末复习', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment', subject: '', stage: '', genType: 'review', content: '单元/期末复习答案规范：\n1. 典型例题必须配完整解析（解题思路→分步解答→易错提示），每步标注关键得分点\n2. 自测题配简要解析（答案、1~2句解题要点），标注教材对应知识点定位\n3. 所有解析标注"易错提示"——指出该题最常见的错误类型及原因\n4. 每道题答案用<div class="answer-item">分隔，标注题号', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-题型分布建议】块级指令 — 按学科×学段×资料类型(exam/practice)三维度匹配
  // ═══════════════════════════════════════
  // ── 语文 exam ──
  { id: 'typedist_exam_chinese_primary_low', name: '【题型分布】语文试卷-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'primary_low', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '拼音与字词基础:4-6,句子运用:3-4,课文理解:2-3,写话/看图写话:1-1', builtin: true },
  { id: 'typedist_exam_chinese_primary_mid', name: '【题型分布】语文试卷-小学中段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'primary_mid', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '基础知识与运用:5-7,阅读理解:3-4,习作:1-1', builtin: true },
  { id: 'typedist_exam_chinese_primary_high', name: '【题型分布】语文试卷-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'primary_high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '基础知识与运用:5-7,阅读理解:4-5,习作:1-1', builtin: true },
  { id: 'typedist_exam_chinese_middle', name: '【题型分布】语文试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '基础知识:4-6,文言文阅读:2-3,现代文阅读:4-5,写作:1-1', builtin: true },
  { id: 'typedist_exam_chinese_high', name: '【题型分布】语文试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '现代文阅读:5-6,文言文阅读:3-4,古代诗歌鉴赏:2-3,语言文字运用:3-5,写作:1-1', builtin: true },

  // ── 数学 exam ──
  { id: 'typedist_exam_math_primary_low', name: '【题型分布】数学试卷-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'primary_low', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '口算/直接写得数:5-6,填空题:4-5,选择题:3-4,计算题:2-3,解决问题:2-3', builtin: true },
  { id: 'typedist_exam_math_primary_mid', name: '【题型分布】数学试卷-小学中段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'primary_mid', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '填空题:5-6,选择题:4-5,计算题:4-5,操作题:1-2,解决问题:3-4', builtin: true },
  { id: 'typedist_exam_math_primary_high', name: '【题型分布】数学试卷-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'primary_high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '填空题:5-6,选择题:4-5,计算题:5-6,操作题:1-2,解决问题:4-5', builtin: true },
  { id: 'typedist_exam_math_middle', name: '【题型分布】数学试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:6-8,填空题:4-6,计算题:3-4,证明/作图题:2-3,应用题/综合题:4-5', builtin: true },
  { id: 'typedist_exam_math_high', name: '【题型分布】数学试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '单选题:8-10,多选题:2-3,填空题:4-5,解答题:5-6', builtin: true },

  // ── 英语 exam ──
  { id: 'typedist_exam_english_primary_low', name: '【题型分布】英语试卷-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'primary_low', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。🚫 英语资料禁止出现听力题。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '看图选词/词汇连线:5-6,选择题:5-6,填空题:4-5,连线/匹配题:3-4', builtin: true },
  { id: 'typedist_exam_english_primary_mid', name: '【题型分布】英语试卷-小学中段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'primary_mid', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:6-8,填空题:4-5,阅读理解:4-6,连词成句/句型转换:3-4', builtin: true },
  { id: 'typedist_exam_english_primary_high', name: '【题型分布】英语试卷-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'primary_high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:6-8,填空题:4-5,阅读理解:6-8,书面表达:1-1', builtin: true },
  { id: 'typedist_exam_english_middle', name: '【题型分布】英语试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '单项选择:8-10,完形填空:10-10,阅读理解:10-15,任务型阅读:5-5,书面表达:1-1', builtin: true },
  { id: 'typedist_exam_english_high', name: '【题型分布】英语试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '阅读理解:15-20,七选五/完形填空:10-15,语法填空:10-10,书面表达:1-1', builtin: true },

  // ── 理科 exam ──
  { id: 'typedist_exam_science_primary', name: '【题型分布】科学试卷-小学', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '科学', stage: 'primary', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:5-8,填空题:4-6,判断题:3-4,实验探究/简答题:2-3', builtin: true },
  { id: 'typedist_exam_physics_middle', name: '【题型分布】物理试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '物理', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:6-8,填空题:4-6,作图题:2-3,实验探究题:2-3,计算题:3-4', builtin: true },
  { id: 'typedist_exam_physics_high', name: '【题型分布】物理试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '物理', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '单选题:6-8,多选题:2-3,实验题:2-2,计算题:3-4', builtin: true },
  { id: 'typedist_exam_chemistry_middle', name: '【题型分布】化学试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '化学', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:8-10,填空题:4-6,实验探究题:2-3,计算题:2-3', builtin: true },
  { id: 'typedist_exam_chemistry_high', name: '【题型分布】化学试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '化学', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '单选题:7-10,不定项选择:2-3,填空题:4-5,实验题:2-2,计算/推断题:3-4', builtin: true },
  { id: 'typedist_exam_biology_middle', name: '【题型分布】生物试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '生物', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:8-10,填空题:4-6,识图分析题:2-3,实验探究题:2-3', builtin: true },

  // ── 文科 exam ──
  { id: 'typedist_exam_history_middle', name: '【题型分布】历史试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '历史', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:10-12,材料解析题:2-3,简答/论述题:2-3', builtin: true },
  { id: 'typedist_exam_history_high', name: '【题型分布】历史试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '历史', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:12-16,材料解析题:2-3,论述题:1-2', builtin: true },
  { id: 'typedist_exam_geo_middle', name: '【题型分布】地理试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '地理', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:8-10,读图分析题:2-3,综合题:2-3', builtin: true },
  { id: 'typedist_exam_moral_primary_low', name: '【题型分布】道法试卷-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '道德与法治', stage: 'primary_low', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '判断/选择题:4-6,情境简答:2-3', builtin: true },
  { id: 'typedist_exam_moral_primary_mid', name: '【题型分布】道法试卷-小学中段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '道德与法治', stage: 'primary_mid', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:5-7,判断题:3-5,情境分析/简答:2-3', builtin: true },
  { id: 'typedist_exam_moral_primary_high', name: '【题型分布】道法试卷-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '道德与法治', stage: 'primary_high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:6-8,判断题:3-5,情境分析/简答:2-3,材料分析题:1-1', builtin: true },
  { id: 'typedist_exam_moral_middle', name: '【题型分布】道法试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '道德与法治', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:8-10,简答题:3-4,材料分析题:2-3', builtin: true },

  // ── 理科 exam 高中段补充 ──
  { id: 'typedist_exam_biology_high', name: '【题型分布】生物试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '生物', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '单选题:6-8,不定项选择:2-3,填空题:4-5,识图分析题:2-3,实验探究题:2-3', builtin: true },
  // ── 文科 exam 高中段补充 ──
  { id: 'typedist_exam_geo_high', name: '【题型分布】地理试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '地理', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:8-12,读图分析题:2-3,综合题:3-4', builtin: true },
  { id: 'typedist_exam_politics_high', name: '【题型分布】政治试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '政治,思想政治', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '选择题:12-16,简答题/辨析题:2-3,材料分析题:2-3,论述题:1-2', builtin: true },

  // ── 信息技术 exam 补充 ──
  { id: 'typedist_exam_it_middle', name: '【题型分布】信息技术试卷-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '信息技术,信息科技', stage: 'middle', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '单选题:8-10,判断题:4-6,操作描述题:2-3,程序设计题:1-2', builtin: true },
  { id: 'typedist_exam_it_high', name: '【题型分布】信息技术试卷-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '信息技术,信息科技', stage: 'high', genType: 'exam', content: '题型分布由DeepSeek根据所选教材内容的知识点密度和覆盖需求灵活决定，不设固定数字上限。遵循"基础→能力→拓展"递进逻辑，各层级题型和题量由你根据文本实际内容自主决定。题量充足，以完整覆盖所选章节全部核心知识点为唯一衡量标准。', typeDist: '单选题:8-12,判断题:4-6,操作描述/案例分析题:2-3,程序设计题:1-2', builtin: true },

  // ── practice (课时练) ──
  { id: 'typedist_practice_chinese_primary_low', name: '【题型分布】语文课时练-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'primary_low', genType: 'practice', content: '总题数控制在12-18题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（字词句运用）：6-9题\n- 能力提升（阅读理解）：4-6题\n- 拓展探究（小练笔）：2-3题\n', typeDist: '基础过关:6-9,能力提升:4-6,拓展探究:2-3', builtin: true },
  { id: 'typedist_practice_chinese_primary_mid', name: '【题型分布】语文课时练-小学中高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'primary_mid', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（字词句运用）：8-12题\n- 能力提升（阅读理解）：5-8题\n- 拓展探究（小练笔）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_chinese_primary_high', name: '【题型分布】语文课时练-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'primary_high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（字词句运用）：10-15题\n- 能力提升（阅读理解）：7-10题\n- 拓展探究（小练笔）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },
  { id: 'typedist_practice_chinese_secondary', name: '【题型分布】语文课时练-中学', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关：8-12题\n- 能力提升：5-8题\n- 拓展探究：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_math_primary_low', name: '【题型分布】数学课时练-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'primary_low', genType: 'practice', content: '总题数控制在12-18题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（计算与概念填空）：6-9题\n- 能力提升（解决问题与应用）：4-6题\n- 拓展探究（思维挑战）：2-3题\n', typeDist: '基础过关:6-9,能力提升:4-6,拓展探究:2-3', builtin: true },
  { id: 'typedist_practice_math_primary_mid', name: '【题型分布】数学课时练-小学中段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'primary_mid', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（计算与概念填空）：8-12题\n- 能力提升（解决问题与应用）：5-8题\n- 拓展探究（思维挑战）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_math_primary_high', name: '【题型分布】数学课时练-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'primary_high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（计算与概念填空）：10-15题\n- 能力提升（解决问题与应用）：7-10题\n- 拓展探究（思维挑战）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },
  { id: 'typedist_practice_math_secondary', name: '【题型分布】数学课时练-中学', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关：8-12题\n- 能力提升：5-8题\n- 拓展探究：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_english_primary_low', name: '【题型分布】英语课时练-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'primary_low', genType: 'practice', content: '总题数控制在12-18题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（词汇认读与句型操练）：6-9题\n- 能力提升（语篇理解与语法）：4-6题\n- 拓展探究（情境交际/写作）：2-3题\n', typeDist: '基础过关:6-9,能力提升:4-6,拓展探究:2-3', builtin: true },
  { id: 'typedist_practice_english_primary_mid', name: '【题型分布】英语课时练-小学中段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'primary_mid', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（词汇认读与句型操练）：8-12题\n- 能力提升（语篇理解与语法）：5-8题\n- 拓展探究（情境交际/写作）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_english_primary_high', name: '【题型分布】英语课时练-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'primary_high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（词汇认读与句型操练）：10-15题\n- 能力提升（语篇理解与语法）：7-10题\n- 拓展探究（情境交际/写作）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },
  { id: 'typedist_practice_english_secondary', name: '【题型分布】英语课时练-中学', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关：8-12题\n- 能力提升：5-8题\n- 拓展探究：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_science_primary_low', name: '【题型分布】科学课时练-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '科学', stage: 'primary_low', genType: 'practice', content: '总题数控制在10-15题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空与观察）：5-7题\n- 能力提升（实验分析）：3-5题\n- 拓展探究（科学小实践）：2-3题\n', typeDist: '基础过关:5-7,能力提升:3-5,拓展探究:2-3', builtin: true },
  { id: 'typedist_practice_science_primary_mid', name: '【题型分布】科学课时练-小学中段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '科学', stage: 'primary_mid', genType: 'practice', content: '总题数控制在12-18题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空）：6-9题\n- 能力提升（实验分析）：4-6题\n- 拓展探究（科学小实践）：2-3题\n', typeDist: '基础过关:6-9,能力提升:4-6,拓展探究:2-3', builtin: true },
  { id: 'typedist_practice_science_primary_high', name: '【题型分布】科学课时练-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '科学', stage: 'primary_high', genType: 'practice', content: '总题数控制在16-22题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空）：8-11题\n- 能力提升（实验分析）：5-7题\n- 拓展探究（科学小实践）：3-4题\n', typeDist: '基础过关:8-11,能力提升:5-7,拓展探究:3-4', builtin: true },

  // ── 理科 practice 补充（物理/化学/生物）──
  { id: 'typedist_practice_physics_middle', name: '【题型分布】物理课时练-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '物理', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念辨析与公式训练）：8-12题\n- 能力提升（计算与应用）：5-8题\n- 拓展探究（实验设计与创新）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_physics_high', name: '【题型分布】物理课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '物理', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念辨析与公式训练）：10-15题\n- 能力提升（计算与应用）：7-10题\n- 拓展探究（实验设计与创新）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },
  { id: 'typedist_practice_chemistry_middle', name: '【题型分布】化学课时练-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '化学', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念与方程式）：8-12题\n- 能力提升（推断与计算）：5-8题\n- 拓展探究（实验设计与创新）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_chemistry_high', name: '【题型分布】化学课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '化学', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念与方程式）：10-15题\n- 能力提升（推断与计算）：7-10题\n- 拓展探究（实验设计与创新）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },
  { id: 'typedist_practice_biology_middle', name: '【题型分布】生物课时练-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '生物', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空与识图）：8-12题\n- 能力提升（实验设计与数据分析）：5-8题\n- 拓展探究（综合应用与探究）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_biology_high', name: '【题型分布】生物课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '生物', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空与识图）：10-15题\n- 能力提升（实验设计与数据分析）：7-10题\n- 拓展探究（综合应用与探究）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },

  // ── 文科 practice 补充（历史/地理）──
  { id: 'typedist_practice_history_middle', name: '【题型分布】历史课时练-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '历史', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（时序与史实）：8-12题\n- 能力提升（材料分析与论述）：5-8题\n- 拓展探究（历史评价与反思）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_history_high', name: '【题型分布】历史课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '历史', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（时序与史实）：10-15题\n- 能力提升（材料分析与论述）：7-10题\n- 拓展探究（历史评价与反思）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },
  { id: 'typedist_practice_geo_middle', name: '【题型分布】地理课时练-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '地理', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念与读图）：8-12题\n- 能力提升（区域分析与综合）：5-8题\n- 拓展探究（地理实践与探究）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_geo_high', name: '【题型分布】地理课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '地理', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念与读图）：10-15题\n- 能力提升（区域分析与综合）：7-10题\n- 拓展探究（地理实践与探究）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },

  // ── 道法/政治 practice 补充 ──
  { id: 'typedist_practice_moral_primary_low', name: '【题型分布】道法课时练-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '道德与法治', stage: 'primary_low', genType: 'practice', content: '总题数控制在10-15题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念判断与辨析）：5-7题\n- 能力提升（情境分析与应用）：3-5题\n- 拓展探究（综合实践与反思）：2-3题\n', typeDist: '基础过关:5-7,能力提升:3-5,拓展探究:2-3', builtin: true },
  { id: 'typedist_practice_moral_primary_mid', name: '【题型分布】道法课时练-小学中段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '道德与法治', stage: 'primary_mid', genType: 'practice', content: '总题数控制在12-18题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念判断与辨析）：6-9题\n- 能力提升（情境分析与应用）：4-6题\n- 拓展探究（综合实践与反思）：2-3题\n', typeDist: '基础过关:6-9,能力提升:4-6,拓展探究:2-3', builtin: true },
  { id: 'typedist_practice_moral_primary_high', name: '【题型分布】道法课时练-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '道德与法治', stage: 'primary_high', genType: 'practice', content: '总题数控制在16-22题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念判断与辨析）：8-11题\n- 能力提升（情境分析与应用）：5-7题\n- 拓展探究（综合实践与反思）：3-4题\n', typeDist: '基础过关:8-11,能力提升:5-7,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_moral_middle', name: '【题型分布】道法课时练-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '道德与法治', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念判断与辨析）：8-12题\n- 能力提升（情境分析与应用）：5-8题\n- 拓展探究（综合实践与反思）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_politics_high', name: '【题型分布】政治课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '政治,思想政治', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念判断与辨析）：10-15题\n- 能力提升（情境分析与应用）：7-10题\n- 拓展探究（综合实践与反思）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },

  // ── 主科 practice 高中段补充（语文/数学/英语）──
  { id: 'typedist_practice_chinese_high', name: '【题型分布】语文课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '语文', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（文言实词/虚词/翻译、名句默写）：10-15题\n- 能力提升（阅读理解、诗歌鉴赏）：7-10题\n- 拓展探究（写作片段/语言运用）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },
  { id: 'typedist_practice_math_high', name: '【题型分布】数学课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '数学', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念辨析与公式训练）：10-15题\n- 能力提升（综合运用与证明）：7-10题\n- 拓展探究（压轴题与创新思维）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },
  { id: 'typedist_practice_english_high', name: '【题型分布】英语课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '英语', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（词汇、语法单项）：10-15题\n- 能力提升（完形、阅读、七选五）：7-10题\n- 拓展探究（写作、语法填空）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },

  // ── 信息技术 practice 补充 ──
  { id: 'typedist_practice_it_primary_low', name: '【题型分布】信息技术课时练-小学低段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '信息技术,信息科技', stage: 'primary_low', genType: 'practice', content: '总题数控制在10-15题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空与术语匹配）：5-7题\n- 能力提升（操作描述与流程图）：3-5题\n- 拓展探究（综合任务与创意设计）：2-3题\n', typeDist: '基础过关:5-7,能力提升:3-5,拓展探究:2-3', builtin: true },
  { id: 'typedist_practice_it_primary_mid', name: '【题型分布】信息技术课时练-小学中段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '信息技术,信息科技', stage: 'primary_mid', genType: 'practice', content: '总题数控制在12-18题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空与术语匹配）：6-9题\n- 能力提升（操作描述与流程图）：4-6题\n- 拓展探究（综合任务与创意设计）：2-3题\n', typeDist: '基础过关:6-9,能力提升:4-6,拓展探究:2-3', builtin: true },
  { id: 'typedist_practice_it_primary_high', name: '【题型分布】信息技术课时练-小学高段', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '信息技术,信息科技', stage: 'primary_high', genType: 'practice', content: '总题数控制在16-22题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空与术语匹配）：8-11题\n- 能力提升（操作描述与流程图）：5-7题\n- 拓展探究（综合任务与创意设计）：3-4题\n', typeDist: '基础过关:8-11,能力提升:5-7,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_it_middle', name: '【题型分布】信息技术课时练-初中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '信息技术,信息科技', stage: 'middle', genType: 'practice', content: '总题数控制在16-24题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空与术语匹配）：8-12题\n- 能力提升（操作描述与流程图）：5-8题\n- 拓展探究（综合任务与创意设计）：3-4题\n', typeDist: '基础过关:8-12,能力提升:5-8,拓展探究:3-4', builtin: true },
  { id: 'typedist_practice_it_high', name: '【题型分布】信息技术课时练-高中', category: '生成-题型分布建议', prompt_order: 52, type: 'fragment', subject: '信息技术,信息科技', stage: 'high', genType: 'practice', content: '总题数控制在20-30题。课时练题型分布建议如下（如上方已手动配置题型数量，以手动配置为准；此建议仅作参考）：\n- 基础过关（概念填空与术语匹配）：10-15题\n- 能力提升（操作描述与流程图）：7-10题\n- 拓展探究（综合任务与创意设计）：3-5题\n', typeDist: '基础过关:10-15,能力提升:7-10,拓展探究:3-5', builtin: true },

  // ═══════════════════════════════════════
 // 【生成-核心任务】块级指令 — 按资料类型(genType)匹配
  // 核心任务仅声明本次生成的任务目标与最高原则，不涉及结构/难度/覆盖/答案/排版等细节（已由对应块级指令负责）
  // ═══════════════════════════════════════
  { id: 'core_task_exam', name: '【核心任务】考卷', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '', stage: '', genType: 'exam', content: '生成一份完整考试卷。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。严格按下方结构参考和难度配置执行，试题需原创改编（同资料内不同题目考查角度、情境、数据不得雷同，经典题型可保留但同一知识点不重复出现）（可变换教材原题的数据/情境/问法）。正文只含题目，参考答案与解析统一放文末。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_practice', name: '【核心任务】课时练', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '', stage: '', genType: 'practice', content: '生成一份课堂同步练习。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。遵循"基础→能力→拓展"三层递进结构，题目紧扣本节核心知识，之间有层次和关联性。基础题配简要解析，提升/拓展题配详细解析。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_summary', name: '【核心任务】知识点总结', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '', stage: '', genType: 'summary', content: '生成一份知识点归纳总结。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选知识点的全部要点（概念/公式/方法/应用），不得遗漏。以知识要点整理为核心，按下方结构参考组织内容。语言精炼规范，便于打印复习，不掺杂无关内容。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_special', name: '【核心任务】专项突破', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '', stage: '', genType: 'special', content: '生成一份专项突破训练。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。围绕指定专项能力，按下方结构参考进行"方法指导→典例剖析→阶梯训练→真题检验"的系统训练，帮助学生从"模仿"到"迁移"再到"创新"。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_errorbook', name: '【核心任务】错题本', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '', stage: '', genType: 'errorbook', content: '生成一份错题整理。🔴 完整覆盖各类典型错误，每个错误类型配至少一道变式巩固练习，确保举一反三。遵循"典型错题→精准归因→正确解法→变式巩固→方法归纳"的深度学习流程，帮助学生真正吃透错题而非简单抄答案。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_preview', name: '【核心任务】课前预习', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '', stage: '', genType: 'preview', content: '生成一份课前预习资料。🔴 预习内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖新课全部核心知识点，每个知识点均有对应的预习任务或检测题。按下方结构参考组织，帮助学生对新课内容有初步感知、带着问题进课堂。预习任务可操作可检查，预习检测答案需标注教材原文定位以便自查。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_dictation_chinese', name: '【核心任务】默写-语文', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '语文', stage: '', genType: 'dictation', content: '生成一份可直接打印使用的默写练习纸。🔴 覆盖本课全部要求掌握的生字/词语，不遗漏任何一个。练习区只显示提示信息+空白书写区（不给答案），标准答案统一放文末。生字用田字格留空，附带字典式信息（部首/笔画/结构）。', builtin: true },
  { id: 'core_task_dictation_english', name: '【核心任务】默写-英语', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '英语', stage: '', genType: 'dictation', content: '生成一份可直接打印使用的默写练习纸。🔴 覆盖本课全部要求掌握的单词/短语，不遗漏任何一个。练习区只显示提示信息+空白书写区（不给答案），标准答案统一放文末。写英文用四线三格/单线，写中文用普通横线，每个单词标注词性和音标。', builtin: true },
  { id: 'core_task_dictation', name: '【核心任务】默写（通用）', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '', stage: '', genType: 'dictation', content: '生成一份可直接打印使用的默写练习纸。🔴 覆盖所选内容全部要求掌握的词汇/知识点，不遗漏任何一个。练习区只显示提示信息+空白书写区（不给答案），标准答案统一放文末。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_reading', name: '【核心任务】阅读训练', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '', stage: '', genType: 'reading', content: '生成一份阅读理解训练。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。覆盖"信息提取→词句理解→推理判断→表达技巧→整体把握"全部能力层级。选文文质兼美、难度匹配学段，题目按五层递进设计。每题配答题模板+参考答案+评分要点。非连续性文本阅读（新课标要求）也需覆盖。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_review', name: '【核心任务】单元/期末复习', category: '生成-核心任务', prompt_order: 10, type: 'fragment', subject: '', stage: '', genType: 'review', content: '生成一份单元/期末系统复习资料。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选范围的考点和易错点，不仅是知识罗列，更要帮助学生构建知识关联和解题策略。按下方结构参考组织，知识梳理+典型题析+易错聚焦+综合自测四位一体。典型题必须配完整解析过程，自测题需覆盖全部核心考点。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-核心任务】按学段拆分 — 精准适配年级特征
  // ═══════════════════════════════════════
  // ── exam 考卷（按学段拆分）──
  { id: 'core_task_exam_primary_low', name: '【核心任务-考卷-小学低段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'exam', specialSubType: 'new_standard',
    content: '生成一份适合小学低段（1-2年级）的考试卷。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。题干简短明了，选项不超过3个。试题需原创改编（同资料内不同题目考查角度、情境、数据不得雷同，经典题型可保留但同一知识点不重复出现）。正文只含题目，参考答案与解析统一放文末。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_exam_primary_mid', name: '【核心任务-考卷-小学中段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'exam', specialSubType: 'new_standard',
    content: '生成一份适合小学中段（3-4年级）的考试卷。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。题干清晰，选项不超过4个。适当增加情境题和图表题，注重知识运用而非机械记忆。试题需原创改编（同资料内不同题目考查角度、情境、数据不得雷同，经典题型可保留但同一知识点不重复出现）。正文只含题目，参考答案与解析统一放文末。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_exam_primary_high', name: '【核心任务-考卷-小学高段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'exam', specialSubType: 'new_standard',
    content: '生成一份适合小学高段（5-6年级）的考试卷。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。题型贴近小升初衔接要求，增加综合性、应用性题目。注重考查学生的分析、概括和表达能力。试题需原创改编（同资料内不同题目考查角度、情境、数据不得雷同，经典题型可保留但同一知识点不重复出现）。正文只含题目，参考答案与解析统一放文末。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_exam_middle', name: '【核心任务-考卷-初中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'middle', genType: 'exam', specialSubType: 'new_standard',
    content: '生成一份对标中考要求的考试卷。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。题型仿照中考真题设计，注重考查核心素养和综合运用能力。试题区分度合理，基础题、中档题、较难题比例恰当。需原创改编（变换教材原题数据/情境/问法，同资料内考查角度不得雷同）。正文只含题目，参考答案与解析统一放文末。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_exam_high', name: '【核心任务-考卷-高中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'high', genType: 'exam', specialSubType: 'new_standard',
    content: '生成一份对标高考要求的考试卷。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。题型仿照高考真题设计，注重考查学科核心素养、深度理解和创新思维。试题区分度合理，基础题、中档题、较难题比例恰当。需原创改编。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。正文只含题目，参考答案与解析统一放文末。', builtin: true },

  // ── practice 课时练（按学段拆分）──
  { id: 'core_task_practice_primary_low', name: '【核心任务-课时练-小学低段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'practice', specialSubType: 'new_standard',
    content: '生成一份适合小学低段（1-2年级）的课堂同步练习。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。题目简短有趣，以游戏化、活动化方式呈现。遵循"基础→能力→拓展"三层递进结构，基础题配简要解析。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_practice_primary_mid', name: '【核心任务-课时练-小学中段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'practice', specialSubType: 'new_standard',
    content: '生成一份适合小学中段（3-4年级）的课堂同步练习。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。遵循"基础→能力→拓展"三层递进结构，基础题配简要解析，提升/拓展题配详细解析。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_practice_primary_high', name: '【核心任务-课时练-小学高段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'practice', specialSubType: 'new_standard',
    content: '生成一份适合小学高段（5-6年级）的课堂同步练习。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。题目贴近小升初衔接，增加综合运用和探究性练习。遵循"基础→能力→拓展"三层递进结构，提升/拓展题配详细解析。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_practice_middle', name: '【核心任务-课时练-初中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'middle', genType: 'practice', specialSubType: 'new_standard',
    content: '生成一份初中课堂同步练习。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。题目设计注重知识迁移和综合运用，对标中考题型和难度梯度。遵循"基础→能力→拓展"三层递进结构，提升/拓展题配详细解析和评分要点。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_practice_high', name: '【核心任务-课时练-高中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'high', genType: 'practice', specialSubType: 'new_standard',
    content: '生成一份高中课堂同步练习。🔴 题量以完整覆盖全部知识点为准，每题考查内容不重复，覆盖全部教材内容。题目设计注重深度理解和创新思维，对标高考题型和难度梯度。遵循"基础→能力→拓展"三层递进结构，提升/拓展题配详细解析和评分标准。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },

  // ── summary 知识点总结（按学段拆分）──
  { id: 'core_task_summary_primary_low', name: '【核心任务-总结-小学低段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'summary', specialSubType: 'new_standard',
    content: '生成一份适合小学低段（1-2年级）的知识点总结。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选知识点的全部要点。知识呈现生动有趣，用符号和编号区分重点。语言亲切活泼，多用口诀和儿歌帮助记忆，减少抽象概念描述。按下方结构参考组织，便于打印复习。', builtin: true },
  { id: 'core_task_summary_primary_mid', name: '【核心任务-总结-小学中段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'summary', specialSubType: 'new_standard',
    content: '生成一份适合小学中段（3-4年级）的知识点总结。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选知识点的全部要点。知识呈现开始引入表格、思维导图等结构化工具，逐步培养归纳整理能力。语言清晰规范，重点内容用颜色和符号标注。按下方结构参考组织，便于打印复习。', builtin: true },
  { id: 'core_task_summary_primary_high', name: '【核心任务-总结-小学高段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'summary', specialSubType: 'new_standard',
    content: '生成一份适合小学高段（5-6年级）的知识点总结。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选知识点的全部要点。知识呈现以结构化梳理为主（思维导图/表格/层级图），注重知识点之间的联系和对比。语言精炼规范，标注重难点星级和考查频率。按下方结构参考组织，便于打印复习。', builtin: true },
  { id: 'core_task_summary_middle', name: '【核心任务-总结-初中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '生成一份初中知识点总结。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选知识点的全部要点。知识梳理系统深入，注重知识网络构建和跨章节联系。标注中考考查频率和常见题型，渗透学科思维方法。语言精炼规范，不掺杂无关内容。按下方结构参考组织，便于打印复习和备考。', builtin: true },
  { id: 'core_task_summary_high', name: '【核心任务-总结-高中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '生成一份高中知识点总结。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选知识点的全部要点。知识梳理深度系统，注重概念原理的深层理解和跨模块整合。标注高考考查要求和命题趋势，渗透学科思想方法和解题策略。语言精炼规范。按下方结构参考组织，便于打印复习和高考备考。', builtin: true },

  // ── reading 阅读训练（按学段拆分）──
  { id: 'core_task_reading_primary_low', name: '【核心任务-阅读-小学低段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'reading', specialSubType: 'new_standard',
    content: '生成一份适合小学低段（1-2年级）的阅读训练。🔴 选文短小有趣（80-150字），以儿歌/童谣/简短童话为主。题目以信息提取和简单判断为主，选项不超过3个，注重培养阅读兴趣和习惯。每题配参考答案。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_reading_primary_mid', name: '【核心任务-阅读-小学中段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'reading', specialSubType: 'new_standard',
    content: '生成一份适合小学中段（3-4年级）的阅读训练。🔴 选文以记叙文/童话/寓言为主（150-300字）。题目覆盖信息提取→词句理解→简单概括→初步赏析，题型含选择+填空+简答。每题配参考答案和简要解析。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_reading_primary_high', name: '【核心任务-阅读-小学高段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'reading', specialSubType: 'new_standard',
    content: '生成一份适合小学高段（5-6年级）的阅读训练。🔴 选文涵盖记叙文/说明文/非连续性文本（300-500字），题目覆盖信息提取→词句分析→主旨归纳→评价鉴赏全部能力层级。题型含选择+简答+开放题。每题配参考答案+评分要点。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_reading_middle', name: '【核心任务-阅读-初中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'middle', genType: 'reading', specialSubType: 'new_standard',
    content: '生成一份初中阅读训练。🔴 选文文质兼美（600-1000字），体裁涵盖记叙文/散文/小说/说明文/议论文/新闻及古诗文。题目按中考题型设计，覆盖整体感知→深层理解→评价鉴赏→迁移运用全部层级。每题配答题模板+参考答案+评分要点。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_reading_high', name: '【核心任务-阅读-高中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'high', genType: 'reading', specialSubType: 'new_standard',
    content: '生成一份高中阅读训练。🔴 选文对标高考（论述类、文学类、实用类文本，800-1500字），题目按高考题型设计，覆盖信息筛取→逻辑梳理→深层理解→批判评价全部层级。注重考查文本解读的深度和广度。每题配参考答案+评分标准。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },

  // ── preview 课前预习（按学段拆分）──
  { id: 'core_task_preview_primary_low', name: '【核心任务-预习-小学低段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'preview', specialSubType: 'new_standard',
    content: '生成一份适合小学低段（1-2年级）的课前预习单。🔴 预习内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖新课核心知识点，每个知识点均有对应的趣味预习任务。用"我能..."句式呈现学习目标，预习检测2-3道基础题。注重趣味性和亲子共读引导，帮助学生对新课有初步感知、带着兴趣进课堂。', builtin: true },
  { id: 'core_task_preview_primary_mid', name: '【核心任务-预习-小学中段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'preview', specialSubType: 'new_standard',
    content: '生成一份适合小学中段（3-4年级）的课前预习单。🔴 预习内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖新课核心知识点，每个知识点均有对应的预习任务或检测题。增加自主学习和简单批注任务，预习检测3-4道基础题，引导学生带着问题进课堂。预习任务可操作可检查，检测答案标注教材原文定位。', builtin: true },
  { id: 'core_task_preview_primary_high', name: '【核心任务-预习-小学高段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'preview', specialSubType: 'new_standard',
    content: '生成一份适合小学高段（5-6年级）的课前预习单。🔴 预习内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖新课核心知识点，每个知识点均有对应的预习任务或检测。侧重自主学习和探究，增加资料搜集、批注思考、提出疑问等任务。预习检测4-5道题（基础、理解），帮助学生对新课有系统感知、带着思考进课堂。', builtin: true },
  { id: 'core_task_preview_middle', name: '【核心任务-预习-初中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'middle', genType: 'preview', specialSubType: 'new_standard',
    content: '生成一份初中课前预习资料。🔴 预习内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖新课全部核心知识点，每个知识点均有对应的预习任务或检测。预习任务强调自主研读教材、梳理知识框架、标注疑难问题。预习检测适当增加理解性和应用性题目。帮助学生对新课有深度感知、带着问题和思考进课堂。', builtin: true },
  { id: 'core_task_preview_high', name: '【核心任务-预习-高中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'high', genType: 'preview', specialSubType: 'new_standard',
    content: '生成一份高中课前预习资料。🔴 预习内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖新课全部核心知识点，每个知识点均有对应的预习任务或检测。预习任务强调自主构建知识框架、关联已有知识、提出批判性问题。预习检测增加综合性和探究性题目。帮助学生对新课有系统深度理解、带着思考和独到见解进课堂。', builtin: true },

  // ── review 单元/期末复习（按学段拆分）──
  { id: 'core_task_review_primary_low', name: '【核心任务-复习-小学低段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'review', specialSubType: 'new_standard',
    content: '生成一份适合小学低段（1-2年级）的单元/期末复习资料。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选范围的考点和易错点。知识梳理以趣味表格和图片配对为主，典型题析每题配完整图解式解析，自测题以选择+填空+连线为主（题量适中），帮助学生轻松回顾、快乐巩固。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_review_primary_mid', name: '【核心任务-复习-小学中段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'review', specialSubType: 'new_standard',
    content: '生成一份适合小学中段（3-4年级）的单元/期末复习资料。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选范围的考点和易错点。知识梳理用对比表格和知识树，典型题析每题配完整解析过程，易错聚焦整理3-5个高频错误，综合自测覆盖全部核心考点。帮助学生构建知识关联，系统查漏补缺。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_review_primary_high', name: '【核心任务-复习-小学高段】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'review', specialSubType: 'new_standard',
    content: '生成一份适合小学高段（5-6年级）的单元/期末复习资料。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选范围的考点和易错点。知识梳理注重知识体系构建和方法归纳，典型题析选涵盖全部核心考点的经典题并配详细解析，易错聚焦深入分析错误根源，综合自测题型丰富、难度梯度合理。帮助学生从"学会"到"会学"，系统提升应试能力。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_review_middle', name: '【核心任务-复习-初中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'middle', genType: 'review', specialSubType: 'new_standard',
    content: '生成一份初中单元/期末复习资料。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选范围的考点、易错点和中考高频考点。知识梳理以思维导图+专题对比为主，典型题析选近3年中考同类题并配详细解析+评分标准，易错聚焦深入分析错误根源并配变式练习，综合自测对标中考题型和难度。帮助学生系统构建知识网络、精准攻克薄弱环节。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_review_high', name: '【核心任务-复习-高中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'high', genType: 'review', specialSubType: 'new_standard',
    content: '生成一份高中单元/期末复习资料。🔴 内容完整、篇幅精炼，控制在标准页数附近，不堆砌冗余展开。完整覆盖所选范围的考点、易错点和高考高频考点。知识梳理以知识框架+专题整合为主，典型题析选近3年高考同类题并配详细解析+评分细则，易错聚焦注重思维层面和解题策略分析，综合自测严格参照高考命题趋势和难度。帮助学生从知识梳理到综合运用，系统提升学科核心素养和应试能力。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },

  // ── errorbook 错题本（按学段拆分）──
  { id: 'core_task_errorbook_primary', name: '【核心任务-错题本-小学】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_low,primary_mid,primary_high', genType: 'errorbook', specialSubType: 'new_standard',
    content: '生成一份适合小学阶段的错题整理。🔴 完整覆盖各类典型错误，每个错误类型配至少一道变式巩固练习。遵循"典型错题→精准归因→正确解法→变式巩固→方法归纳"的深度学习流程。语言亲切活泼、多用鼓励语，帮助学生真正吃透错题而非简单抄答案。', builtin: true },
  { id: 'core_task_errorbook_middle', name: '【核心任务-错题本-初中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'middle', genType: 'errorbook', specialSubType: 'new_standard',
    content: '生成一份初中错题整理。🔴 完整覆盖各类典型错误，每个错误类型配至少一道变式巩固练习。遵循"典型错题→精准归因→正确解法→变式巩固→方法归纳"的深度学习流程。归因分析深入知识点层面，变式练习对标中考题型，帮助学生举一反三、系统纠错。', builtin: true },
  { id: 'core_task_errorbook_high', name: '【核心任务-错题本-高中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'high', genType: 'errorbook', specialSubType: 'new_standard',
    content: '生成一份高中错题整理。🔴 完整覆盖各类典型错误，每个错误类型配至少一道变式巩固练习。遵循"典型错题→精准归因→正确解法→变式巩固→方法归纳"的深度学习流程。归因分析注重思维层面和解题策略，变式练习对标高考题型，帮助学生从一道错题掌握一类问题的通法。', builtin: true },

  // ── special 专项突破（按学段拆分）──
  { id: 'core_task_special_primary', name: '【核心任务-专项突破-小学】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'primary_low,primary_mid,primary_high', genType: 'special', specialSubType: 'new_standard',
    content: '生成一份适合小学阶段的专项突破训练。🔴 训练题量充足，覆盖专项能力的全部训练维度。围绕指定专项能力，按下方结构参考进行"方法指导→典例剖析→阶梯训练→真题检验"的系统训练。方法指导用简单易懂的语言，训练题难度梯度平缓，帮助学生从"模仿"到"迁移"再到"创新"。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_special_middle', name: '【核心任务-专项突破-初中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'middle', genType: 'special', specialSubType: 'new_standard',
    content: '生成一份初中专项突破训练。🔴 训练题量充足，覆盖专项能力的全部训练维度。围绕指定专项能力，按下方结构参考进行"方法指导→典例剖析→阶梯训练→真题检验"的系统训练。方法指导注重策略和技巧，训练题对标中考难度和题型，帮助学生从"模仿"到"迁移"再到"创新"。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },
  { id: 'core_task_special_high', name: '【核心任务-专项突破-高中】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '', stage: 'high', genType: 'special', specialSubType: 'new_standard',
    content: '生成一份高中专项突破训练。🔴 训练题量充足，覆盖专项能力的全部训练维度。围绕指定专项能力，按下方结构参考进行"方法指导→典例剖析→阶梯训练→真题检验"的系统训练。方法指导注重思维建模和解题通法，训练题对标高考难度和题型，帮助学生从"模仿"到"迁移"再到"创新"。⚠️ 配图仅限白名单5类场景，详见下方【配图要求】。', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-命题风格】块级指令 — 按命题风格值匹配
  // ═══════════════════════════════════════
  { id: 'style_traditional', name: '【命题风格】传统命题', category: '生成-命题风格', prompt_order: 36, type: 'fragment', subject: '', stage: '', genType: 'traditional', content: '题型结构清晰，设问直接，知识点考查明确，不设置复杂情境。', builtin: true },
  { id: 'style_unified_context', name: '【命题风格】统一情境', category: '生成-命题风格', prompt_order: 36, type: 'fragment', subject: '', stage: '', genType: 'unified_context', content: '整份资料围绕一个核心主题/故事情境展开，所有题目均在此情境下进行设问。', builtin: true },
  { id: 'style_context_fusion', name: '【命题风格】情境融合', category: '生成-命题风格', prompt_order: 36, type: 'fragment', subject: '', stage: '', genType: 'context_fusion', content: '每个题型/模块设置一个独立的小情境，情境与题目高度融合，考查知识迁移能力。', builtin: true },
  { id: 'style_big_unit', name: '【命题风格】大单元教学', category: '生成-命题风格', prompt_order: 36, type: 'fragment', subject: '', stage: '', genType: 'big_unit', content: '打破课时界限，围绕大概念/大任务进行整体设计，题目体现知识间的关联与递进。', builtin: true },
  { id: 'style_project_based', name: '【命题风格】项目式学习', category: '生成-命题风格', prompt_order: 36, type: 'fragment', subject: '', stage: '', genType: 'project_based', content: '以一个完整的项目任务为驱动，资料作为项目的一部分，考查学生在真实问题中的综合能力。', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-年级边界提示】块级指令 — 按学科×学段匹配
  // ═══════════════════════════════════════
  { id: 'grade_hint_physics', name: '【年级边界】物理', category: '生成-年级边界提示', prompt_order: 50, type: 'fragment', subject: '物理', stage: 'middle', genType: '', content: '[type=start][startGrade=8]物理从八年级开始，七~八年级以下年级不涉及物理内容。\n提示词：⚠️ 物理从八年级开始', builtin: true },
  { id: 'grade_hint_chemistry', name: '【年级边界】化学', category: '生成-年级边界提示', prompt_order: 50, type: 'fragment', subject: '化学', stage: 'middle', genType: '', content: '[type=start][startGrade=9]化学从九年级开始，八~九年级以下年级不涉及化学内容。\n提示词：⚠️ 化学从九年级开始', builtin: true },
  { id: 'grade_hint_biology', name: '【年级边界】生物', category: '生成-年级边界提示', prompt_order: 50, type: 'fragment', subject: '生物', stage: 'middle', genType: '', content: '[type=end][endGrade=8]初中生物仅七~八年级开设，九年级不涉及生物内容。\n提示词：⚠️ 初中生物仅七~八年级', builtin: true },
  { id: 'grade_hint_geo', name: '【年级边界】地理', category: '生成-年级边界提示', prompt_order: 50, type: 'fragment', subject: '地理', stage: 'middle', genType: '', content: '[type=end][endGrade=8]初中地理仅七~八年级开设，九年级不涉及地理内容。\n提示词：⚠️ 初中地理仅七~八年级', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-难度配置】块级指令 — 按学段×资料类型(exam)匹配
  // ═══════════════════════════════════════
  { id: 'diff_primary_low_exam', name: '【难度配置】小学低段-考卷', category: '生成-难度配置', prompt_order: 51, type: 'fragment', subject: '', stage: 'primary_low', genType: 'exam', content: 'basic=70,medium=20,advanced=10\ntotalScore=100', builtin: true },
  { id: 'diff_primary_mid_exam', name: '【难度配置】小学中段-考卷', category: '生成-难度配置', prompt_order: 51, type: 'fragment', subject: '', stage: 'primary_mid', genType: 'exam', content: 'basic=60,medium=30,advanced=10\ntotalScore=100', builtin: true },
  { id: 'diff_primary_high_exam', name: '【难度配置】小学高段-考卷', category: '生成-难度配置', prompt_order: 51, type: 'fragment', subject: '', stage: 'primary_high', genType: 'exam', content: 'basic=50,medium=30,advanced=20\ntotalScore=100', builtin: true },
  { id: 'diff_middle_exam', name: '【难度配置】初中-考卷', category: '生成-难度配置', prompt_order: 51, type: 'fragment', subject: '', stage: 'middle', genType: 'exam', content: 'basic=50,medium=30,advanced=20\ntotalScore_main=120,totalScore_other=100', builtin: true },
  { id: 'diff_high_exam', name: '【难度配置】高中-考卷', category: '生成-难度配置', prompt_order: 51, type: 'fragment', subject: '', stage: 'high', genType: 'exam', content: 'basic=40,medium=40,advanced=20\ntotalScore_main=150,totalScore_other=100', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】dictation — 默写（按学段+学科拆分）
  // ═══════════════════════════════════════
  { id: 'gen_struct_dictation_chinese_primary_low', name: '【默写结构-语文-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_low', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、生字默写\n二、词语默写\n三、句子默写', builtin: true },
  { id: 'gen_struct_dictation_chinese_primary_mid', name: '【默写结构-语文-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、生字词默写\n二、词语默写\n三、句子默写', builtin: true },
  { id: 'gen_struct_dictation_chinese_primary_high', name: '【默写结构-语文-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、生字词默写\n二、成语默写\n三、段落默写', builtin: true },
  { id: 'gen_struct_dictation_english_primary_low', name: '【默写结构-英语-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_low', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、字母默写\n二、单词默写\n三、简单句默写', builtin: true },
  { id: 'gen_struct_dictation_english_primary_mid', name: '【默写结构-英语-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_mid', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、单词默写\n二、句型默写\n三、短对话默写', builtin: true },
  { id: 'gen_struct_dictation_english_primary_high', name: '【默写结构-英语-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_high', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、单词默写\n二、句型默写\n三、短文填空式默写', builtin: true },
  // ── 语文 dictation（初中/高中）──
  { id: 'gen_struct_dictation_chinese_middle', name: '【默写结构-语文-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、生字词默写\n二、成语默写\n三、古诗文默写\n四、段落默写', builtin: true },
  { id: 'gen_struct_dictation_chinese_high', name: '【默写结构-语文-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、文言实词默写\n二、名篇名句默写\n三、古诗文默写\n四、文段默写', builtin: true },
  // ── 英语 dictation（初中/高中）──
  { id: 'gen_struct_dictation_english_middle', name: '【默写结构-英语-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、单词默写\n二、短语默写\n三、句型默写\n四、短文填空式默写', builtin: true },
  { id: 'gen_struct_dictation_english_high', name: '【默写结构-英语-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'high', genType: 'dictation', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心词汇默写\n二、短语搭配默写\n三、句型转换\n四、短文默写', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】reading — 阅读训练（按学段+学科拆分）
  // ═══════════════════════════════════════
  { id: 'gen_struct_reading_chinese_primary_low', name: '【阅读结构-语文-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_low', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、短文阅读\n二、读后练习：信息提取\n三、趣味拓展', builtin: true },
  { id: 'gen_struct_reading_chinese_primary_mid', name: '【阅读结构-语文-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、短文阅读\n二、读后练习：信息提取\n三、拓展思考', builtin: true },
  { id: 'gen_struct_reading_chinese_primary_high', name: '【阅读结构-语文-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、短文阅读\n二、读后练习：信息提取与概括\n三、拓展探究', builtin: true },
  { id: 'gen_struct_reading_chinese_middle', name: '【阅读结构-语文-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、现代文阅读\n二、读后练习：整体感知\n三、古诗文阅读', builtin: true },
  { id: 'gen_struct_reading_chinese_high', name: '【阅读结构-语文-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、论述类文本阅读\n二、文学类文本阅读\n三、实用类文本阅读', builtin: true },
  { id: 'gen_struct_reading_english_primary_low', name: '【阅读结构-英语-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_low', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、配图短文阅读\n二、读后练习：看图判断正误\n三、趣味任务', builtin: true },
  { id: 'gen_struct_reading_english_primary_mid', name: '【阅读结构-英语-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_mid', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、短文阅读\n二、读后练习：判断正误\n三、朗读任务', builtin: true },
  { id: 'gen_struct_reading_english_primary_high', name: '【阅读结构-英语-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_high', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、短文阅读\n二、读后练习：选择\n三、任务型阅读', builtin: true },
  { id: 'gen_struct_reading_english_middle', name: '【阅读结构-英语-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、阅读理解\n二、任务型阅读\n三、阅读表达', builtin: true },
  { id: 'gen_struct_reading_english_high', name: '【阅读结构-英语-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'high', genType: 'reading', specialSubType: 'new_standard',
    content: '结构参考：\n一、阅读理解\n二、七选五\n三、读写结合', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】非考卷类通用结构 — 按 genType 匹配（无 subject/stage 即通用兜底）
  // ═══════════════════════════════════════
  { id: 'gen_struct_practice_generic', name: '【结构-课时练-通用】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment', subject: '', stage: '', genType: 'practice', specialSubType: 'new_standard', content: '结构参考：\n一、情境感知·基础建构\n二、合作探究·能力进阶\n三、迁移创新·素养提升', builtin: true },
  { id: 'gen_struct_summary_generic', name: '【结构-知识点总结-通用】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment', subject: '', stage: '', genType: 'summary', specialSubType: 'new_standard', content: '结构参考：\n一、知识结构化梳理\n二、核心能力聚焦\n三、典型题型解析\n四、素养拓展与反思', builtin: true },
  { id: 'gen_struct_special_generic', name: '【结构-专项突破-通用】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment', subject: '', stage: '', genType: 'special', specialSubType: 'new_standard', content: '结构参考：\n一、核心素养方法\n二、情境典例\n三、分层变式\n四、综合实践', builtin: true },
  { id: 'gen_struct_errorbook_generic', name: '【结构-错题本-通用】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment', subject: '', stage: '', genType: 'errorbook', specialSubType: 'new_standard', content: '结构参考：\n一、错题整理\n二、错误归因与素养反思\n三、正确解法\n四、变式巩固', builtin: true },
  { id: 'gen_struct_preview_generic', name: '【结构-课前预习-通用】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment', subject: '', stage: '', genType: 'preview', specialSubType: 'new_standard', content: '结构参考：\n一、学习目标与任务感知\n二、自主探究与问题发现\n三、预习检测与反思', builtin: true },
  { id: 'gen_struct_dictation_generic', name: '【结构-默写-通用】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment', subject: '', stage: '', genType: 'dictation', specialSubType: 'new_standard', content: '结构参考：\n一、基础识记（字词/单词默写）\n二、理解运用（语境默写、辨析）\n三、综合提升（语篇默写、迁移）', builtin: true },
  { id: 'gen_struct_reading_generic', name: '【结构-阅读训练-通用】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment', subject: '', stage: '', genType: 'reading', specialSubType: 'new_standard', content: '结构参考：\n一、多模态语篇阅读\n二、理解与鉴赏（分层设问）\n三、素养拓展与反思', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】summary — 知识点总结（按学段+学科拆分，非新课标四段式已有覆盖的学段）
  // ═══════════════════════════════════════
  // 🔧 以下条目为 V1（L1973-2013）新课标四段式未覆盖的学段补充，保留传统五段式结构
  { id: 'gen_struct_summary_chinese_primary_mid', name: '【总结结构-语文-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、生字词盘点\n二、词语积累\n三、课文精析\n四、知识点归纳\n五、课后练习精讲', builtin: true },
  { id: 'gen_struct_summary_chinese_middle', name: '【总结结构-语文-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、基础知识梳理\n二、课文深度解读\n三、知识点专题\n四、写作专项\n五、中考链接', builtin: true },
  { id: 'gen_struct_summary_math_primary_low', name: '【总结结构-数学-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_low', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识要点\n二、公式\n三、典型例题\n四、易错警示\n五、趣味练习', builtin: true },
  { id: 'gen_struct_summary_math_primary_high', name: '【总结结构-数学-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识网络\n二、核心知识精讲\n三、典型例题剖析\n四、错题精析\n五、分层自测', builtin: true },
  { id: 'gen_struct_summary_math_high', name: '【总结结构-数学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识体系构建\n二、核心知识与数学思想\n三、典型例题全方位解析\n四、易错与难点突破\n五、高考真题研习', builtin: true },
  { id: 'gen_struct_summary_english_primary_low', name: '【总结结构-英语-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_low', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、核心词汇\n二、重点句型\n三、字母\n四、歌谣\n五、趣味闯关', builtin: true },
  { id: 'gen_struct_summary_english_primary_mid', name: '【总结结构-英语-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_mid', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、词汇银行\n二、句型工坊\n三、语法点睛\n四、语音\n五、自我检测', builtin: true },
  { id: 'gen_struct_summary_english_primary_high', name: '【总结结构-英语-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_high', genType: 'summary', specialSubType: 'new_standard',
    content: '结构参考：\n一、词汇拓展\n二、句型与语法\n三、语篇分析\n四、写作指导\n五、综合自测', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】errorbook — 错题本（按学段+学科拆分）
  // ═══════════════════════════════════════
  { id: 'gen_struct_errorbook_chinese_primary', name: '【错题本结构-语文-小学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_low,primary_mid,primary_high', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题登记\n二、错误归因与素养反思\n三、正确解法\n四、变式巩固\n五、阶段反思', builtin: true },
  { id: 'gen_struct_errorbook_chinese_middle', name: '【错题本结构-语文-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题档案\n二、错误归因与素养反思\n三、规范解答示范\n四、变式强化\n五、备考策略', builtin: true },
  { id: 'gen_struct_errorbook_math_primary', name: '【错题本结构-数学-小学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_low,primary_mid,primary_high', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题登记\n二、错误归因与素养反思\n三、正确解法\n四、变式训练\n五、进步记录', builtin: true },
  { id: 'gen_struct_errorbook_math_middle', name: '【错题本结构-数学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'middle', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题档案\n二、精准归因\n三、一题多解与最优策略\n四、变式与拓展\n五、中考预警', builtin: true },
  { id: 'gen_struct_errorbook_english_primary', name: '【错题本结构-英语-小学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_low,primary_mid,primary_high', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题登记\n二、错误归因与素养反思\n三、正确示范\n四、变式巩固\n五、单词银行', builtin: true },
  { id: 'gen_struct_errorbook_english_middle', name: '【错题本结构-英语-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题档案\n二、深度归因\n三、解题方法论\n四、强化变式\n五、中考对标', builtin: true },
  // ── 高中 errorbook（语/数/英）──
  { id: 'gen_struct_errorbook_chinese_high', name: '【错题本结构-语文-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题档案\n二、深度归因与知识补漏\n三、规范解答示范\n四、变式强化\n五、高考对标', builtin: true },
  { id: 'gen_struct_errorbook_math_high', name: '【错题本结构-数学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'high', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题档案\n二、思维诊断\n三、多解与最优策略\n四、变式拓展\n五、高考预警', builtin: true },
  { id: 'gen_struct_errorbook_english_high', name: '【错题本结构-英语-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'high', genType: 'errorbook', specialSubType: 'new_standard',
    content: '结构参考：\n一、错题档案\n二、深度归因\n三、解题策略\n四、强化变式\n五、高考对标', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】preview — 课前预习（按学段+学科拆分）
  // ═══════════════════════════════════════
  { id: 'gen_struct_preview_chinese_primary_low', name: '【预习结构-语文-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_low', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、预习目标\n二、生字初探\n三、课文初读\n四、预习检测', builtin: true },
  { id: 'gen_struct_preview_chinese_primary_mid', name: '【预习结构-语文-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、预习目标\n二、字词通关\n三、课文初探\n四、预习检测\n五、我的疑问', builtin: true },
  { id: 'gen_struct_preview_chinese_primary_high', name: '【预习结构-语文-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、预习目标\n二、自主识字\n三、课文研读\n四、资料拓展\n五、预习检测\n六、课堂期待', builtin: true },
  { id: 'gen_struct_preview_math_primary_low', name: '【预习结构-数学-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_low', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、预习目标\n二、情境导入\n三、动手试一试\n四、预习检测\n五、我的发现', builtin: true },
  { id: 'gen_struct_preview_math_primary_mid', name: '【预习结构-数学-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_mid', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、预习目标\n二、旧知链接\n三、自主探究\n四、尝试练习\n五、我的疑问', builtin: true },
  { id: 'gen_struct_preview_math_primary_high', name: '【预习结构-数学-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、预习目标\n二、知识链接\n三、教材研读\n四、尝试与反思\n五、自主提问', builtin: true },
  { id: 'gen_struct_preview_english_primary_mid', name: '【预习结构-英语-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_mid', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、预习目标\n二、单词预热\n三、句型初探\n四、预习检测\n五、我的疑问', builtin: true },
  { id: 'gen_struct_preview_english_primary_high', name: '【预习结构-英语-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_high', genType: 'preview', specialSubType: 'new_standard',
    content: '结构参考：\n一、预习目标\n二、词汇与句型预习\n三、课文预读\n四、语法初探\n五、预习检测\n六、学习准备', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】special — 专项突破（按子类型+学科拆分）
  // ═══════════════════════════════════════
  { id: 'gen_struct_special_reading_chinese', name: '【专项结构-阅读理解-语文】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '结构参考：\n一、方法指导\n二、范例精讲\n三、分类专练\n四、综合实战\n五、错题精析', builtin: true },
  { id: 'gen_struct_special_writing_chinese', name: '【专项结构-写作-语文】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '写作',
    content: '结构参考：\n一、写作技法\n二、范文引路\n三、阶梯训练\n四、升格指导\n五、实战演练', builtin: true },
  { id: 'gen_struct_special_poetry_chinese', name: '【专项结构-古诗词-语文】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '古诗词',
    content: '结构参考：\n一、鉴赏方法\n二、经典精讲\n三、分类专练\n四、默写训练\n五、真题实战', builtin: true },
  { id: 'gen_struct_special_calc_math', name: '【专项结构-计算-数学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '计算',
    content: '结构参考：\n一、算理讲解\n二、方法归纳\n三、分层训练\n四、易错攻关\n五、综合挑战', builtin: true },
  { id: 'gen_struct_special_word_problem_math', name: '【专项结构-应用题-数学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '应用题',
    content: '结构参考：\n一、解题方法论\n二、题型分类突破\n三、建模思维\n四、一题多解\n五、实战演练', builtin: true },
  { id: 'gen_struct_special_grammar_english', name: '【专项结构-语法-英语】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '语法',
    content: '结构参考：\n一、语法体系\n二、概念辨析\n三、分类训练\n四、错题攻关\n五、真题实战', builtin: true },
  { id: 'gen_struct_special_vocab_english', name: '【专项结构-词汇-英语】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '词汇',
    content: '结构参考：\n一、记忆方法\n二、词汇拓展\n三、分层训练\n四、语境运用\n五、词汇检测', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】新课标风格变体 — genType=实际类型 + specialSubType=风格标记
  //   三维度匹配：getMatchingBlockInstructions 的 specialSubType 字段评分 +5 优先
  //   当用户选择'大单元教学'/'项目式学习'时，查询带 specialSubType 参数→高分条目自动置顶
  // ═══════════════════════════════════════
  // ── 大单元教学（big_unit）──
  { id: 'gen_struct_bigunit_exam', name: '【新课标·大单元试卷】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '', stage: '', genType: 'exam', specialSubType: 'big_unit',
    content: '结构参考：\n一、基础素养检测\n二、综合应用探究\n三、创新思维挑战\n四、反思与自评', builtin: true },
  { id: 'gen_struct_bigunit_practice', name: '【新课标·大单元课时练】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '', stage: '', genType: 'practice', specialSubType: 'big_unit',
    content: '结构参考：\n一、任务驱动·基础建构\n二、合作探究·能力进阶\n三、迁移创新·素养提升', builtin: true },
  { id: 'gen_struct_bigunit_summary', name: '【新课标·大单元总结】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '', stage: '', genType: 'summary', specialSubType: 'big_unit',
    content: '结构参考：\n一、大概念统领\n二、知识结构化图谱\n三、典型任务解析\n四、跨课时联结\n五、素养自评', builtin: true },
  { id: 'gen_struct_bigunit_special', name: '【新课标·大单元专项】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '', stage: '', genType: 'special', specialSubType: 'big_unit',
    content: '结构参考：\n一、大概念解读\n二、典型任务群\n三、阶梯训练\n四、综合实践', builtin: true },
  // ── 项目式学习（project_based）──
  { id: 'gen_struct_project_exam', name: '【新课标·项目式测评】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '', stage: '', genType: 'exam', specialSubType: 'project_based',
    content: '结构参考：\n一、项目情境引入\n二、分阶段任务\n三、过程性评价节点\n四、成果展示与反思', builtin: true },
  { id: 'gen_struct_project_practice', name: '【新课标·项目式练习】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '', stage: '', genType: 'practice', specialSubType: 'project_based',
    content: '结构参考：\n一、项目背景与驱动问题\n二、探究任务（分步进行）\n三、协作与实践\n四、成果评价量规', builtin: true },
  { id: 'gen_struct_project_summary', name: '【新课标·项目式总结】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '', stage: '', genType: 'summary', specialSubType: 'project_based',
    content: '结构参考：\n一、项目全景回顾\n二、核心知识与方法提炼\n三、关键问题解决策略\n四、迁移应用指南', builtin: true },
  { id: 'gen_struct_project_special', name: '【新课标·项目式专项】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '', stage: '', genType: 'special', specialSubType: 'project_based',
    content: '结构参考：\n一、项目任务发布\n二、资源与工具\n三、探究与实践\n四、成果展示与互评', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-资料类型结构】review — 单元/期末复习（按学段+学科拆分）
  // ═══════════════════════════════════════
  // ── 语文 review ──
  { id: 'gen_struct_review_chinese_primary_low', name: '【复习结构-语文-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_low', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识回顾\n二、重点闯关\n三、易错门诊\n四、成长档案', builtin: true },
  { id: 'gen_struct_review_chinese_primary_mid', name: '【复习结构-语文-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_mid', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识框架\n二、核心突破\n三、易错专练\n四、综合自测', builtin: true },
  { id: 'gen_struct_review_chinese_primary_high', name: '【复习结构-语文-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'primary_high', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识框架\n二、核心突破\n三、阅读鉴赏\n四、易错专练\n五、综合自测', builtin: true },
  { id: 'gen_struct_review_chinese_middle', name: '【复习结构-语文-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'middle', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、思维导图\n二、考点梳理\n三、典型题析\n四、易错聚焦\n五、中考链接', builtin: true },
  { id: 'gen_struct_review_chinese_high', name: '【复习结构-语文-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '语文', stage: 'high', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识网络建构\n二、核心考点突破\n三、易错点清零\n四、高考真题研习\n五、模拟自评', builtin: true },
  // ── 数学 review ──
  { id: 'gen_struct_review_math_primary_low', name: '【复习结构-数学-小学低段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_low', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识回顾\n二、重点闯关\n三、易错门诊\n四、成长档案', builtin: true },
  { id: 'gen_struct_review_math_primary_mid', name: '【复习结构-数学-小学中段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_mid', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识框架\n二、核心突破\n三、易错专练\n四、综合自测', builtin: true },
  { id: 'gen_struct_review_math_primary_high', name: '【复习结构-数学-小学高段】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'primary_high', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识框架\n二、核心突破\n三、易错专练\n四、综合自测\n五、衔接初中', builtin: true },
  { id: 'gen_struct_review_math_middle', name: '【复习结构-数学-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'middle', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、思维导图\n二、考点梳理\n三、典型题析\n四、易错聚焦\n五、中考链接', builtin: true },
  { id: 'gen_struct_review_math_high', name: '【复习结构-数学-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '数学', stage: 'high', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识网络建构\n二、核心考点突破\n三、易错点清零\n四、高考真题研习\n五、模拟自评', builtin: true },
  // ── 英语 review ──
  { id: 'gen_struct_review_english_primary', name: '【复习结构-英语-小学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'primary_low,primary_mid,primary_high', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、词汇银行\n二、句型工坊\n三、语法点睛\n四、综合闯关', builtin: true },
  { id: 'gen_struct_review_english_middle', name: '【复习结构-英语-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'middle', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、词汇与语法梳理\n二、语篇复习\n三、易错聚焦\n四、中考模拟', builtin: true },
  { id: 'gen_struct_review_english_high', name: '【复习结构-英语-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '英语', stage: 'high', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识网络建构\n二、题型专项突破\n三、高考模拟训练', builtin: true },
  // ── 理科通用 review（物化生）──
  { id: 'gen_struct_review_science_middle', name: '【复习结构-理科-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理,化学,生物', stage: 'middle', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识框架\n二、考点梳理\n三、实验与探究\n四、易错聚焦\n五、中考链接', builtin: true },
  { id: 'gen_struct_review_science_high', name: '【复习结构-理科-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '物理,化学,生物', stage: 'high', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识网络建构\n二、核心考点突破\n三、实验与模型\n四、高考真题研习', builtin: true },
  // ── 文科通用 review（史地政）──
  { id: 'gen_struct_review_liberal_middle', name: '【复习结构-文科-初中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史,地理,道德与法治,政治', stage: 'middle', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、思维导图\n二、考点梳理\n三、材料分析\n四、易错聚焦\n五、中考链接', builtin: true },
  { id: 'gen_struct_review_liberal_high', name: '【复习结构-文科-高中】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '历史,地理,思想政治', stage: 'high', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识网络建构\n二、核心考点突破\n三、综合论述训练\n四、高考真题研习', builtin: true },
  // ── 科学·小学 review ──
  { id: 'gen_struct_review_science_primary', name: '【复习结构-科学-小学】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '科学', stage: 'primary_low,primary_mid,primary_high', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识框架\n二、核心概念回顾\n三、实验与探究\n四、易错聚焦\n五、综合自测', builtin: true },
  // ── 信息技术 review ──
  { id: 'gen_struct_review_it', name: '【复习结构-信息技术】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '信息技术,信息科技', stage: '', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识框架\n二、核心概念与技能回顾\n三、操作实践\n四、易错聚焦\n五、综合自测', builtin: true },
  // ── review 通用兜底 ──
  { id: 'gen_struct_review_generic', name: '【复习结构-通用】', category: '生成-资料类型结构', prompt_order: 11, type: 'fragment',
    subject: '', stage: '', genType: 'review', specialSubType: 'new_standard',
    content: '结构参考：\n一、知识框架\n二、考点梳理\n三、典型题析\n四、易错聚焦\n五、综合自测', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-范围标签】块级指令 — 按 scopeType 匹配
  // ═══════════════════════════════════════
  { id: 'scope_label_default', name: '【范围标签】默认', category: '生成-范围标签', prompt_order: 35, type: 'fragment', subject: '', stage: '', genType: 'default', content: '按勾选章节范围', builtin: true },
  { id: 'scope_label_midterm', name: '【范围标签】期中', category: '生成-范围标签', prompt_order: 35, type: 'fragment', subject: '', stage: '', genType: 'midterm', content: '期中考试范围', builtin: true },
  { id: 'scope_label_final', name: '【范围标签】期末', category: '生成-范围标签', prompt_order: 35, type: 'fragment', subject: '', stage: '', genType: 'final', content: '期末考试范围', builtin: true },
  { id: 'scope_label_topic', name: '【范围标签】专题', category: '生成-范围标签', prompt_order: 35, type: 'fragment', subject: '', stage: '', genType: 'topic', content: '专题复习范围', builtin: true },

  // 【生成-范围扩展】块级指令 — 多章节合并出卷时的跨章综合语义，{chapterCount} 运行时替换
  // ═══════════════════════════════════════
  { id: 'scope_cross_midterm', name: '【范围扩展】期中跨章', category: '生成-范围扩展', prompt_order: 36, type: 'fragment', subject: '', stage: '', genType: 'midterm', content: '📐 本次为期中综合命题，覆盖全部 {chapterCount} 个章节。需跨章节融合命题，打破章节边界，注重知识关联与能力递进，禁止各章孤立出题。', builtin: true },
  { id: 'scope_cross_final', name: '【范围扩展】期末跨章', category: '生成-范围扩展', prompt_order: 36, type: 'fragment', subject: '', stage: '', genType: 'final', content: '📐 本次为期末综合命题，覆盖全部 {chapterCount} 个章节。需跨章节融合命题，打破章节边界，注重知识关联与能力递进，禁止各章孤立出题。', builtin: true },
  { id: 'scope_cross_generic', name: '【范围扩展】通用跨章', category: '生成-范围扩展', prompt_order: 36, type: 'fragment', subject: '', stage: '', genType: '', content: '📐 本次为综合命题，覆盖全部 {chapterCount} 个章节。需跨章节融合命题，打破章节边界，注重知识关联与能力递进，禁止各章孤立出题。', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-多章节标题】多章节降级标题格式 — {titles} 运行时替换为实际章节名
  // ═══════════════════════════════════════
  { id: 'multi_ch_title_univ', name: '【多章节标题】通用', category: '生成-多章节标题', prompt_order: 37, type: 'fragment', subject: '', stage: '', genType: '', content: '{titles}', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-模板禁止项】块级指令 — 按 stage 匹配
  // ═══════════════════════════════════════
  { id: 'tpl_ban_primary', name: '【模板禁止项】小学', category: '生成-模板禁止项', prompt_order: 24, type: 'fragment', subject: '', stage: 'primary', genType: '', content: '- ⛔ 禁止："下列说法正确的是"等无信息量设问', builtin: true },
  { id: 'tpl_ban_middle', name: '【模板禁止项】初中', category: '生成-模板禁止项', prompt_order: 24, type: 'fragment', subject: '', stage: 'middle', genType: '', content: '- ⛔ 禁止："下列说法正确的是"等无信息量设问\n- ⛔ 禁止："以上都是""以上都不对"作为选项\n- ⛔ 禁止：题干中使用网络流行语、过度口语化', builtin: true },
  { id: 'tpl_ban_high', name: '【模板禁止项】高中', category: '生成-模板禁止项', prompt_order: 24, type: 'fragment', subject: '', stage: 'high', genType: '', content: '- ⛔ 禁止："下列说法正确的是"等无信息量设问\n- ⛔ 禁止："以上都是""以上都不对"作为选项\n- ⛔ 禁止：题干中使用网络流行语、过度口语化', builtin: true },


  // ═══════════════════════════════════════
  // 【生成-输出格式】通用基础行 — 所有 genType 的基础输出格式要求
  // ═══════════════════════════════════════
  { id: 'output_fmt_base', name: '【输出格式】通用基础', category: '生成-输出格式', prompt_order: 23, type: 'fragment', subject: '', stage: '', genType: '', content: '必须返回HTML片段（从<h1>/<div>/<p>等标签开始），禁止使用<html><head><body>等文档级标签包裹，禁止使用```html代码块标记。', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-快捷学段提示】块级指令 — loadInstruction 快捷注入用，按 stage 匹配
  // ═══════════════════════════════════════
  { id: 'quick_stage_primary', name: '【快捷学段提示】小学', category: '生成-快捷学段提示', prompt_order: 53, type: 'fragment', subject: '', stage: 'primary', genType: '', content: '- 📘 小学学段：语言简洁口语化；难度 基础:中档:提高 = 7:2:1', builtin: true },
  { id: 'quick_stage_middle', name: '【快捷学段提示】初中', category: '生成-快捷学段提示', prompt_order: 53, type: 'fragment', subject: '', stage: 'middle', genType: '', content: '- 📙 初中学段：逐步增加抽象思维和多步推理；对标中考题型；难度 基础:中档:提高 = 5:3:2', builtin: true },
  { id: 'quick_stage_high', name: '【快捷学段提示】高中', category: '生成-快捷学段提示', prompt_order: 53, type: 'fragment', subject: '', stage: 'high', genType: '', content: '- 📕 高中学段：严格对标高考题型和分值；可设压轴题；难度 基础:中档:提高 = 4:4:2', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-格式尾约束】recency 锚点 — 指令末尾最后一次格式强化，所有引擎通用
  // ═══════════════════════════════════════
  { id: 'format_tail_question', name: '【格式尾约束】命题类', category: '生成-格式尾约束', prompt_order: 98, type: 'fragment', subject: '', stage: '', genType: 'exam,practice,special,reading,preview', content: '⛔ 每道题目必须用 <p class="question"> 标签包裹！禁止使用无 class 的 <p>、<div> 等标签代替题目行', builtin: true },
  { id: 'format_tail_other', name: '【格式尾约束】非命题类', category: '生成-格式尾约束', prompt_order: 98, type: 'fragment', subject: '', stage: '', genType: 'summary,dictation,errorbook', content: '⛔ 严格遵循上方【输出格式】中的标签规范，禁止使用 Markdown 语法', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-指令块标题】块级指令 — 各约束段的【】标题，统一从指令库三维度获取
  // ═══════════════════════════════════════
  { id: 'section_title_supplement', name: '【资料类型补充约束】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'supplement', content: '资料类型补充约束', builtin: true },
  { id: 'section_title_type_design', name: '【题型设计与难度配置】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'type_design', content: '题型设计与难度配置', builtin: true },
  { id: 'section_title_template', name: '【模板精准对标】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'template', content: '模板精准对标', builtin: true },
  { id: 'section_title_user_supplement', name: '【用户补充指令】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'user_supplement', content: '用户补充指令', builtin: true },
  { id: 'section_title_core_task', name: '【核心任务】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'core_task', content: '核心任务', builtin: true },
  { id: 'section_title_core_literacy', name: '【学科核心素养】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'core_literacy', content: '学科核心素养', builtin: true },
  { id: 'section_title_stage_subject_adapt', name: '【学段·学科精准适配】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'stage_subject_adapt', content: '学段·学科精准适配', builtin: true },
  { id: 'section_title_stage_control', name: '【学段控制】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'stage_control', content: '学段控制', builtin: true },
  { id: 'section_title_subject_feature', name: '【学科特色】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'subject_feature', content: '学科特色', builtin: true },
  { id: 'section_title_graphic_formula', name: '【图形/图表/公式/配图专项指令】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'graphic_formula', content: '图形/图表/公式/配图专项指令', builtin: true },
  { id: 'section_title_terminology', name: '【术语规范】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'terminology', content: '术语规范', builtin: true },
  { id: 'section_title_scope_style', name: '【命题范围与风格】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'scope_style', content: '命题范围与风格', builtin: true },
  { id: 'section_title_context_req', name: '【情境要求】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'context_req', content: '情境要求', builtin: true },
  { id: 'section_title_layout_control', name: '【题量控制】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'layout_control', content: '题量控制', builtin: true },
  { id: 'section_title_difficulty_control', name: '【难度控制】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'difficulty_control', content: '难度控制', builtin: true },
  { id: 'section_title_quality_standard', name: '【题目质量标准】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'quality_standard', content: '题目质量标准', builtin: true },
  { id: 'section_title_subject_supplement', name: '【学科补充标准】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'subject_supplement', content: '学科补充标准', builtin: true },
  { id: 'section_title_answer_spec', name: '【答案与解析规范】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'answer_spec', content: '答案与解析规范', builtin: true },
  { id: 'section_title_answer_template', name: '【答题模板】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'answer_template', content: '答题模板', builtin: true },
  { id: 'section_title_special_req', name: '【特殊要求】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'special_req', content: '特殊要求', builtin: true },
  { id: 'section_title_original_quote', name: '【原题引用】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'original_quote', content: '原题引用', builtin: true },
  { id: 'section_title_general_constraint', name: '【通用约束】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'general_constraint', content: '通用约束', builtin: true },
  { id: 'section_title_ban_general', name: '【禁止项-通用】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'ban_general', content: '禁止项-通用', builtin: true },
  { id: 'section_title_ban_subject', name: '【禁止项-学科专属】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'ban_subject', content: '禁止项-学科专属', builtin: true },
  { id: 'section_title_ban_supplement', name: '【禁止项-学科补充】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'ban_supplement', content: '禁止项-学科补充', builtin: true },
  { id: 'section_title_content_norm', name: '【内容规范】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'content_norm', content: '内容规范', builtin: true },
  { id: 'section_title_output_format', name: '【输出格式】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'output_format', content: '输出格式', builtin: true },
  { id: 'section_title_template_style', name: '【模板风格约束】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'template_style', content: '模板风格约束——逐题生成时须遵循', builtin: true },
  { id: 'section_title_knowledge_boundary', name: '【年级知识边界】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'knowledge_boundary', content: '年级知识边界——以下内容严禁出现', builtin: true },
  { id: 'section_title_coverage_constraint', name: '【知识点全覆盖】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'coverage_constraint', content: '知识点全覆盖', builtin: true },
  { id: 'section_title_format_summary', name: '【知识点总结格式规范】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'format_summary', content: '知识点总结格式规范', builtin: true },
  { id: 'section_title_format_errorbook', name: '【错题本格式规范】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'format_errorbook', content: '错题本格式规范', builtin: true },
  { id: 'section_title_format_preview', name: '【课前预习格式规范】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'format_preview', content: '课前预习格式规范', builtin: true },
  { id: 'section_title_format_dictation', name: '【默写格式规范】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'format_dictation', content: '默写格式规范', builtin: true },
  { id: 'section_title_format_reading', name: '【阅读训练格式规范】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'format_reading', content: '阅读训练格式规范', builtin: true },
  { id: 'section_title_format_exam', name: '【试卷/练习格式规范】', category: '生成-指令块标题', prompt_order: 60, type: 'fragment', subject: '', stage: '', genType: 'format_exam', content: '试卷/练习格式规范', builtin: true },

  // ═══════════════════════════════════════
  // 【专项训练领域化指令】— specialSubType 维度精确匹配（v6 新增）
  // 覆盖：语文(阅读理解/古诗词/文言文/写作) × 数学(计算/应用题/几何) × 英语(阅读理解/语法)
  // ═══════════════════════════════════════

  // ── A1. 生成-核心任务（9条，每个领域一条）──
  { id: 'block_core_special_chinese_reading', name: '【核心任务-语文-阅读理解】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '生成一份阅读理解专项训练。围绕选文设置信息提取→词句理解→推理判断→整体把握四个层级的题目，每篇选文配阅读策略点拨和答题模板，训练学生的文本细读能力和答题规范性。', builtin: true },
  { id: 'block_core_special_chinese_poetry', name: '【核心任务-语文-古诗词】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '古诗词',
    content: '生成一份古诗词专项训练。围绕意象分析→意境描述→手法鉴赏→情感主旨四级鉴赏框架设计题目，每首诗词配注释、赏析要点和答题模板，培养学生对古典诗歌的感受力和鉴赏能力。', builtin: true },
  { id: 'block_core_special_chinese_classical', name: '【核心任务-语文-文言文】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '文言文',
    content: '生成一份文言文专项训练。围绕实词积累→虚词辨析→句式理解→文意疏通→文化感悟五个层面设计题目，每篇文言文选段配注释、翻译提示和文化常识拓展，夯实文言基础。', builtin: true },
  { id: 'block_core_special_chinese_writing', name: '【核心任务-语文-写作】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '写作',
    content: '生成一份写作专项训练。围绕审题立意→谋篇布局→语言表达→修改升格四个阶段设计训练任务，每个阶段配范例引路、技法点拨和评价量表，系统提升写作能力。', builtin: true },
  { id: 'block_core_special_math_calc', name: '【核心任务-数学-计算】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '计算',
    content: '生成一份计算专项训练。遵循"算理回顾→阶梯训练→易错辨析→速算挑战"四步结构，由基础到综合逐步递进，重点训练运算准确率、速度和方法灵活性，配算理图示和巧算技巧。', builtin: true },
  { id: 'block_core_special_math_word', name: '【核心任务-数学-应用题】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '应用题',
    content: '生成一份应用题专项训练。遵循"审题→建模→列式→求解→检验"五步解题法，按题型分类训练（行程/工程/分数百分数/几何计算等），每道题配思路导图和规范解答范例，培养数学建模和实际问题解决能力。', builtin: true },
  { id: 'block_core_special_math_geo', name: '【核心任务-数学-几何】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '几何',
    content: '生成一份几何专项训练。围绕定理运用→辅助线构造→证明推理→计算综合四个层次设计题目，每道几何题配图形描述和辅助线思路提示，规范"已知→求证→证明→结论"四步书写格式，培养空间想象和逻辑推理能力。', builtin: true },
  { id: 'block_core_special_english_reading', name: '【核心任务-英语-阅读理解】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '生成一份英语阅读理解专项训练。围绕细节理解→推理判断→词义猜测→主旨大意→作者态度五类题型，每篇选文配阅读策略（skimming/scanning/上下文猜词）和解题提示，训练学生的英语阅读速度和答题准确率。', builtin: true },
  { id: 'block_core_special_english_grammar', name: '【核心任务-英语-语法】', category: '生成-核心任务', prompt_order: 10, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '语法',
    content: '生成一份英语语法专项训练。围绕规则呈现→辨析练习→情境运用→语篇巩固四个环节设计题目，题型覆盖单项选择、用所给词适当形式填空、句型转换、语篇语法填空，每道题标注考查的语法点和常见错误提示。', builtin: true },

  // ── A2. 生成-质量范例（14条，按领域+学段拆分）──
  { id: 'block_example_special_chinese_reading', name: '【质量范例-语文-阅读理解】', category: '生成-质量范例', prompt_order: 70, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '专项·阅读理解范例：\n选文示例：【记叙文】《外婆的针线盒》300-400字——外婆的针线盒是一个旧铁盒，里面装着五颜六色的线团、大小不一的纽扣和一根磨得发亮的银针……\n题目示例（5题标准结构）：①外婆的针线盒里装着什么？（信息提取）→②"磨得发亮的银针"中"发亮"说明了什么？（词句理解）→③从哪些地方可以看出外婆很爱惜这个针线盒？（细节推断）→④文中画线句运用了什么修辞手法？表达了什么情感？（手法鉴赏）→⑤用一句话概括文章的主要内容。（主旨概括）\n答题模板：信息提取题→"文中第X段写到……"（定位原文）→词句理解题→"XX"本义是【　】，在文中指【　】，突出了【　】→主旨概括题→本文通过记叙【　】（内容），表达了/赞美了【　】（主旨），告诉我们【　】（道理）。', builtin: true },
  { id: 'block_example_special_chinese_poetry', name: '【质量范例-语文-古诗词】', category: '生成-质量范例', prompt_order: 70, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '古诗词',
    content: '专项·古诗词范例：\n诗词示例：《望庐山瀑布》李白——日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。\n题目示例：①解释加点字："生"的意思是【　】。（字词理解）②诗的前两句描绘了怎样的画面？（意境描述）③"飞流直下三千尺"运用了什么修辞手法？有何表达效果？（手法鉴赏）④诗人借庐山瀑布表达了怎样的情感？（主旨把握）⑤请用自己的话描绘"疑是银河落九天"所展现的画面，50字以上。（创意表达）\n答题模板：意境描述题→诗中描绘了【　】（意象群），营造了【　】（氛围），表达了诗人【　】（情感）。\n手法鉴赏题→运用了【　】（修辞/表现手法），【　】（分析效果：生动形象地写出了……），表达了【　】（情感/主旨）。', builtin: true },
  { id: 'block_example_special_chinese_classical', name: '【质量范例-语文-文言文】', category: '生成-质量范例', prompt_order: 70, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '文言文',
    content: '专项·文言文范例：\n选文示例：《陋室铭》选段——山不在高，有仙则名。水不在深，有龙则灵。斯是陋室，惟吾德馨……\n题目示例：①给画线句断句（用/标出）：苔痕上阶绿草色入帘青。②解释加点字："斯是陋室"中"斯"的意思是【　】。"惟吾德馨"中"馨"的意思是【　】。③用现代汉语翻译句子："孔子云：何陋之有？"④文中作者从哪三个方面描写了陋室？（内容理解）⑤"南阳诸葛庐，西蜀子云亭"运用了什么手法？作者引用这两个典故的用意是什么？（深度鉴赏）\n答题模板：实词释义→"XX"在文中意为【　】，可联系成语"【　】"记忆。\n翻译题→逐字落实：【字1=词1】【字2=词2】……→调整语序→补充省略成分→写出通顺译文。', builtin: true },
  { id: 'block_example_special_chinese_writing', name: '【质量范例-语文-写作】', category: '生成-质量范例', prompt_order: 70, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '写作',
    content: '专项·写作范例：\n技法精讲示例：【细节描写】——妈妈的手很粗糙。（平淡）→ 妈妈的手上布满了老茧，指缝间还残留着洗菜时留下的泥渍，手背上的青筋像一条条细细的河流。（生动）\n阶梯训练示例：①片段摹写：观察一位家人的手，用3-4句话写出特点（不少于50字）。②情境写作：以"那一刻，我长大了"为题，运用细节描写写一件小事（300字）。\n评价量表：内容切题（40分）| 细节描写丰富具体（30分）| 语言通顺生动（20分）| 书写规范整洁（10分）。\n升格示例：【原文】我考试没考好，很伤心。妈妈安慰了我。【升格后】数学卷子上鲜红的"72"像一把刀刺进我的眼睛。我趴在桌上，眼泪一滴一滴落在卷子上。妈妈轻轻走过来，什么也没说，只是把手搭在我肩上，那只温暖的手让我所有的委屈都化成了重新努力的动力。', builtin: true },
  { id: 'block_example_special_math_calc', name: '【质量范例-数学-计算】', category: '生成-质量范例', prompt_order: 70, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '计算',
    content: '专项·计算范例：\n算理回顾示例：【乘法分配律】(a+b)×c = a×c + b×c，如 25×(4+8) = 25×4 + 25×8 = 100 + 200 = 300。\n阶梯训练示例：\n[基础] 直接计算：125×8=□ 36×25=□（4道）\n[变式] 简便运算：99×36 = (100-1)×36 = 3600-36 = □（4道）\n[应用] 情境计算：一箱苹果28千克，每千克8元，买5箱共需多少元？（3道）\n易错辨析示例：【找茬改错】小明的计算：15×4+15×6=15×(4+15×6)——错误！乘法分配律应为15×4+15×6=15×(4+6)=150。\n规范解答格式：解：原式 = 15×(4+6) = 15×10 = 150。', builtin: true },
  { id: 'block_example_special_math_word', name: '【质量范例-数学-应用题】', category: '生成-质量范例', prompt_order: 70, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '应用题',
    content: '专项·应用题范例：\n解题五步法示例：\n【题目】甲乙两地相距360千米，一辆汽车从甲地开往乙地，前2小时行驶了120千米。照这样的速度，到达乙地还需要多少小时？\n①审题：已知→总路程360km、已行120km、用时2h；求→剩余路程所需时间。\n②建模：速度 = 路程÷时间；剩余时间 = 剩余路程÷速度。\n③列式：速度=120÷2=60(km/h)；剩余路程=360-120=240(km)；剩余时间=240÷60=4(h)。\n④求解：120÷2=60，360-120=240，240÷60=4。\n⑤检验：总时间=2+4=6h，总路程=60×6=360km ✓。\n答：到达乙地还需要4小时。', builtin: true },
  { id: 'block_example_special_math_geo', name: '【质量范例-数学-几何】', category: '生成-质量范例', prompt_order: 70, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '几何',
    content: '专项·几何范例：\n【题目】如图，在△ABC中，AB=AC，D是BC的中点，连接AD。求证：AD⊥BC。\n规范证明格式：\n已知：在△ABC中，AB=AC，D是BC的中点。\n求证：AD⊥BC。\n证明：∵ AB=AC（已知），\n     D是BC的中点（已知），\n     AD是公共边，\n     ∴ △ABD ≌ △ACD（SSS）。\n   ∴ ∠ADB = ∠ADC（全等三角形对应角相等）。\n   又∵ ∠ADB + ∠ADC = 180°（平角定义），\n   ∴ ∠ADB = ∠ADC = 90°。\n   ∴ AD⊥BC（垂直定义）。\n辅助线思路提示：等腰三角形遇底边中点，常连接顶角顶点和中点构造"三线合一"。', builtin: true },
  { id: 'block_example_special_english_reading', name: '【质量范例-英语-阅读理解】', category: '生成-质量范例', prompt_order: 70, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '专项·英语阅读理解范例：\n选文示例：【记叙文·My Weekend】Last Saturday, I went to the park with my family. The weather was sunny and warm. We had a picnic under a big tree. My little sister, Amy, ran after a butterfly and fell into a small puddle. She looked so funny that we all laughed. After lunch, we flew a kite. The kite went higher and higher until it looked like a tiny dot in the sky. We stayed until the sun went down. It was a perfect day.\n题目示例：①What was the weather like last Saturday?（细节理解）A. Rainy B. Cloudy C. Sunny D. Windy\n②Why did Amy fall into a puddle?（因果推断）A. She was running after a butterfly. B. She was flying a kite. C. She was eating lunch. D. She was playing with water.\n③The word "tiny" in the passage means ___.（词义猜测）A. very big B. very small C. very high D. very bright\n④What is the best title for this passage?（主旨概括）A. A Funny Sister B. How to Fly a Kite C. A Perfect Day in the Park D. A Picnic Lunch\n解题提示：先读题目→带问题浏览文章→定位关键句→对比选项排除干扰。', builtin: true },
  { id: 'block_example_special_english_grammar', name: '【质量范例-英语-语法】', category: '生成-质量范例', prompt_order: 70, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '语法',
    content: '专项·英语语法范例：\n规则呈现示例：【一般过去时】用法：表示过去某个时间发生的动作或存在的状态。结构：主语 + 动词过去式 + 其他。标志词：yesterday, last week, ... ago, in 2010等。\n阶梯训练示例：\n[单项选择] My mother ___ to work by bus yesterday. A. go B. goes C. went D. will go（考查：一般过去时 vs 一般现在时 vs 一般将来时）\n[适当形式填空] Tom ___ (visit) his grandparents last Sunday. [答案：visited]\n[句型转换] She did her homework after dinner.（改为否定句）→ She ___ ___ her homework after dinner. [答案：didn\'t do]\n[语篇语法填空] Last weekend, I ___ (go) to the zoo with my parents. We ___ (see) many animals there. The monkeys ___ (be) very funny. They ___ (jump) up and down and ___ (make) us laugh.\n规则引用→正误对比：❌ She goed to school. → ✅ She went to school.（go是不规则动词，过去式是went，不是goed！）', builtin: true },

  // ── A3. 生成-答案与解析规范（5条，按领域类型分组）──
  { id: 'block_answer_special_chinese_reading_group', name: '【答案规范-语文阅读类】', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '阅读理解,古诗词,文言文',
    content: '【语文阅读类专项答案规范】\n- 选择题：每道题给出正确答案 + 逐一解析每个选项的对错原因（A项：……因为…… → 正确/错误；B项：……因为…… → 正确/错误）\n- 简答题：分步给出"采分点"——①关键信息提取（X分）②理解分析（X分）③语言组织（X分），每步配示例答案和容错说明（如"意思对即可""也可答……"）\n- 开放性题：给出2-3个角度的示例答案，标注评分维度（观点明确/有理有据/表达清晰），不要求与示例答案完全一致\n- 翻译/默写题：给出标准答案 + 常见错误列举（如"易错字：州≠洲""常见误译：把\'走\'译为walk，应为run"）', builtin: true },
  { id: 'block_answer_special_chinese_writing', name: '【答案规范-语文-写作】', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '写作',
    content: '【语文写作专项答案规范】\n- 每次写作训练需配：①评价量表（内容/结构/语言/书写四维度，每维度25分）②1-2篇不同档次的范文（一类文50-45分、二类文44-38分、三类文37-30分）③每篇范文附批注点评，标注亮点和可改进之处④常见问题清单（偏题/空洞/语言平淡等）及修改建议\n- 升格指导需包含：中等水平原文→问题诊断（3-4个具体问题）→修改建议→升格后范文→修改要点对照表', builtin: true },
  { id: 'block_answer_special_math_group', name: '【答案规范-数学类】', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '计算,应用题,几何',
    content: '【数学专项答案规范】\n- 计算题：分步展示"解→列式→计算→答"完整过程，每步标注得分点。口算题只给答案，竖式计算展示完整竖式和进位/退位标注。巧算题标注"关键步骤"和使用的运算律。\n- 应用题：标注"审题关键信息"（从题中提取的数据和关系）→"解题思路"（为什么这样列式）→"规范解答"（完整分步过程）→"检验"（验证答案合理性和单位）→"易错提醒"（常见错误和避免方法）。一题多解的标注"解法一/解法二"，比较哪种更优。\n- 几何证明题：标注"证明思路"（从结论反推需要证什么→从条件正推能得到什么→二者如何对接）。每步标注"依据"（定理/公理/定义）。辅助线作法用虚线标出并说明"作辅助线的理由"。', builtin: true },
  { id: 'block_answer_special_english_reading', name: '【答案规范-英语-阅读理解】', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '【英语阅读理解专项答案规范】\n- 选择题：给出正确答案 + 逐一解析——①定位原文（"答案依据出现在第X段第Y句"）②分析正确选项（为什么对）③排除干扰项（A项：……与原文不符/原文未提及/张冠李戴/过度推断，故错误）\n- 回答问答题：给出标准答案模板（完整句式/时态一致/人称对应），标注采分点（内容准确X分、语法正确X分、表达完整X分），配容错说明（如"拼写错误不超2处不扣分"）\n- 开放性问题：给出2-3个角度的示例答案，强调"言之有理、语法正确即可"\n- 词义猜测题：标注上下文线索词/句，解释推理过程', builtin: true },
  { id: 'block_answer_special_english_grammar', name: '【答案规范-英语-语法】', category: '生成-答案与解析规范', prompt_order: 26, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '语法',
    content: '【英语语法专项答案规范】\n- 单项选择题：给出正确答案 + 逐一解析——①考查的语法点（如"考查一般过去时"）②每个选项分析（A项是原形→一般现在时，不符合yesterday→错误；B项是过去式→符合过去时间→正确；C项是单三形式→现在时→错误；D项是将来时→不符合→错误）\n- 适当形式填空题：给出完整答案 + 变形规则说明（如"visit→visited（规则动词，加-ed），注意以e结尾只加-d"）\n- 句型转换题：给出转换后完整句子 + 转换规则（如"否定句：主语、didn\'t、动词原形"）\n- 语篇语法填空题：每空标注"考点：XX（如时态/介词/连词/词形变化）"，上下文线索词用波浪线标出', builtin: true },

  // ── A4. 生成-题目质量标准（5条，按领域类型分组）──
  { id: 'block_quality_special_reading_group', name: '【题目质量标准-阅读类】', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment',
    subject: '语文,英语', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '【阅读类专项质量标准】\n- 选文质量：①选文长度严格匹配学段要求（小学≤300字/初中≤600字/高中≤1000字）②选文必须独立成篇、文质兼美、主题健康③外语选文生词率≤5%，生词配中文注释④选文标注出处（教材课文/课外名家选段/改编自XX）\n- 设问质量：①按信息提取→词句理解→推理判断→整体把握四个层级递进设问②各层级题目数量均衡（不集中考查某一层级）③开放性问题不超过总题量的20%④禁止出现"Which of the following is NOT true"以外的全否定题干\n- 选项质量：①干扰项来自学生常见理解偏差（不人为制造陷阱）②选项长度、结构、难度保持一致③正确选项均匀分布在A/B/C/D中', builtin: true },
  { id: 'block_quality_special_poetry_classical', name: '【题目质量标准-古诗词文言文】', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '古诗词,文言文',
    content: '【古诗词/文言文专项质量标准】\n- 选文质量：①诗词选自课标推荐篇目或同等难度作品②文言文选段文字规范、有明确出处③注释用①②③序号标注，解释精炼不展开④生僻字注音用括号标注\n- 设问质量：①古诗词按意象→意境→手法→情感递进设问②文言文按断句→实词→虚词→句式→翻译→理解递进设问③对比阅读题两个文本必须有可比性（同题材/同手法/同时代）④名句赏析题指定具体诗句，不笼统问"赏析这首诗"\n- 翻译质量：①直译为主、意译为辅②关键词必须逐一落实③特殊句式（倒装/省略/被动）必须还原为现代汉语语序', builtin: true },
  { id: 'block_quality_special_writing', name: '【题目质量标准-写作】', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '写作',
    content: '【写作专项质量标准】\n- 题目质量：①命题具有开放性，不唯一答案②写作要求明确（主题/文体/字数/时限）③提示恰到好处，不过度引导限制思路④选题贴近学生生活经验和认知水平\n- 训练设计质量：①每次聚焦一个核心技法，讲透练透②技法讲解配课文范例+正反例对比③训练从片段到篇章有梯度④评价量表具体可操作（"内容充实"→改为"用了3个以上具体事例或细节"）⑤范文选择覆盖不同档次和风格\n- 升格设计质量：①原文问题诊断准确具体②修改建议可操作（不是"写得再生动些"而是"在第2段加入2处动作描写"）③升格后范文自然不刻意④修改要点对照表清晰呈现变化', builtin: true },
  { id: 'block_quality_special_math_calc', name: '【题目质量标准-数学-计算】', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '计算',
    content: '【计算专项质量标准】\n- 题目质量：①数据合理，计算结果为整数或有限小数（巧算题除外）②不出现反常识数据（如"小明今年5岁身高180cm"）③同一份练习中的数据不重复使用④各档题目数量均衡（基础:变式:应用 ≈ 5:4:3）\n- 算理呈现：①算法依据明确（使用什么运算律/什么公式）②分步展示过程，关键步骤不跳步③算理回顾配数形结合图示（如用面积模型解释乘法分配律）\n- 易错辨析：①每个易错点来自真实学生常见错误②错误示例使用"某同学的做法"形式呈现③纠错说明指出错误原因和正确做法', builtin: true },
  { id: 'block_quality_special_math_word_geo', name: '【题目质量标准-数学-应用几何】', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '应用题,几何',
    content: '【应用题/几何专项质量标准】\n- 应用题：①情境真实可信，数据符合生活实际②题目信息量适中（不包含无关干扰信息）③解题思路有清晰路径，不跳步④一道题考查1-2个核心知识点，不堆砌⑤同类题的变式应有梯度（数据变化→条件增减→逆向设问）\n- 几何题：①图形描述精确（关键点坐标/边长/角度必须标注）②已知条件充分（不缺条件、不冗余条件）③辅助线提示有思维引导（"怎么想到这样做辅助线"）④证明题每步标注定理/公理依据⑤作图题标注规范（实线/虚线/箭头/字母）', builtin: true },
  { id: 'block_quality_special_english_grammar', name: '【题目质量标准-英语-语法】', category: '生成-题目质量标准', prompt_order: 25, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '语法',
    content: '【英语语法专项质量标准】\n- 题目质量：①每个语法点由浅入深设置4-6道练习②单项选择每道题4个选项，干扰项为学生常见错误形式③适当形式填空题所给词必须为原形，变形规则明确④语篇语法填空首句不挖空，空与空间隔至少4词⑤句型转换题转换方向单一明确（如"肯定→否定"，不混合多个转换目标）\n- 规则呈现：①用表格/公式呈现规则，清晰直观②配课内典型例句+课外拓展例句③标注常见错误和纠正方法④语法术语用英文（Simple Present, Past Participle等），解释用中文', builtin: true },

  // ── A5. 生成-专项要求（9条，每个领域一条格式排版专项指令）──
  { id: 'block_special_chinese_reading_fmt', name: '【专项要求-语文-阅读理解】', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '【阅读理解专项格式要求】\n- 选文用<div class="reading-passage">包裹，标题用<h3>，正文用<p>，生字注音用<ruby>标签\n- 阅读策略点拨用<div class="reading-strategy">包裹，图标+简短文字\n- 每道题标注题型标签（<span class="tag tag-info">信息提取</span>等）\n- 答题模板用<blockquote class="answer-template">呈现\n- 参考答案集中放在文末<div class="answer-section">中', builtin: true },
  { id: 'block_special_chinese_poetry_fmt', name: '【专项要求-语文-古诗词】', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '古诗词',
    content: '【古诗词专项格式要求】\n- 诗词原文用<div class="poem-text">包裹，标题和作者用<h4>，正文居中排列，句与句之间用<br>换行\n- 注释用<ol class="annotations">有序列表，每条注释用<li>，加点的字用<span class="emphasis-dot">字</span>标记\n- 赏析框架用<div class="appreciation-guide">包裹，分步骤用<h5>子标题\n- 对比阅读的两首诗左右并排展示，用<div class="compare-reading">容器', builtin: true },
  { id: 'block_special_chinese_classical_fmt', name: '【专项要求-语文-文言文】', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '文言文',
    content: '【文言文专项格式要求】\n- 文言文选段用<div class="classical-text">包裹，原文用<p class="original">，注释用<ol class="annotations">\n- 断句题用<span class="pause-mark">/</span>在句中标注停顿位置\n- 翻译对照用两列表格：左列"原文"|右列"译文"\n- 重点实词虚词用<strong>加粗并配<span class="word-note">释义</span>\n- 文化常识拓展用<div class="culture-tips">包裹', builtin: true },
  { id: 'block_special_chinese_writing_fmt', name: '【专项要求-语文-写作】', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '写作',
    content: '【写作专项格式要求】\n- 技法讲解用<div class="writing-skill">包裹，范例和普通文本用不同样式区分（范例加背景色）\n- 评价量表用<table class="rubric-table">表格呈现，列：评分维度|分值|评分标准\n- 范文用<div class="model-essay">包裹，旁批用<span class="margin-note">在关键句旁标注\n- 升格对照用两列表格：左列"修改前"|右列"修改后"\n- 学生练笔区用<div class="writing-blank">留足空白，写作用<span class="zuo-wen-ge">作文格</span>（可选）', builtin: true },
  { id: 'block_special_math_calc_fmt', name: '【专项要求-数学-计算】', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '计算',
    content: '【计算专项格式要求】\n- 口算题用<div class="oral-calculation">包裹，每题横向排列（4题/行），算式与等号对齐\n- 竖式计算用<div class="vertical-calculation">，内部：<div class="vc-row">算式</div>+<div class="vc-line">横线</div>+<div class="vc-result">结果</div>，进位/退位用<sup class="carry">数字</sup>标注\n- 脱式计算用<div class="off-formula">包裹，每一步一个<div class="of-line">，等号左对齐\n- 巧算题在关键步骤用<span class="key-step">圈出</span>，侧边加<span class="method-tip">方法提示</span>', builtin: true },
  { id: 'block_special_math_word_fmt', name: '【专项要求-数学-应用题】', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '应用题',
    content: '【应用题专项格式要求】\n- 解题区用<div class="solution-area">包裹，书写规范：解→列式→计算→答，每步一行\n- 思路导图用<div class="thinking-map">展示审题→建模→列式→求解→检验五步流程\n- 一题多解的用<div class="multi-solutions">容器，解法一/解法二用<h5>区分，比较优质解法用<span class="best-solution">标记\n- 检验过程用<span class="verification">单独标注', builtin: true },
  { id: 'block_special_math_geo_fmt', name: '【专项要求-数学-几何】', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '几何',
    content: '【几何专项格式要求】\n- 图形描述用[GRAPH] TYPE:SHAPES 标记，关键点用大写字母标注（A/B/C/...），角度用弧线+度数\n- 证明过程用<div class="proof">包裹，按"已知→求证→证明→结论"四步书写\n- 每步证明后标注（依据：定理/公理名），用<sup class="proof-basis">[1]</sup>上标序号链接到文末定理索引\n- 辅助线用虚线表示，注明"作辅助线：……"和作图理由\n- 辅助线思路提示用<div class="auxiliary-hint">包裹，字体略小、颜色区分', builtin: true },
  { id: 'block_special_english_reading_fmt', name: '【专项要求-英语-阅读理解】', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '【英语阅读理解专项格式要求】\n- 短文用<div class="reading-passage">包裹，生词配中文注释用<span class="word-gloss">（释义）</span>，首次出现标音标\n- 阅读策略提示用<div class="reading-strategy"><span class="strategy-icon">💡</span> 策略：……</div>\n- 选择题用<ol class="mc-questions">，选项用<label class="option">包裹便于点击\n- 问答题留作答区<div class="answer-blank">（作答区）</div>\n- 解题提示用<details class="hint"><summary>点击查看提示</summary>……</details>折叠，不直接暴露答案', builtin: true },
  { id: 'block_special_english_grammar_fmt', name: '【专项要求-英语-语法】', category: '生成-专项要求', prompt_order: 20, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '语法',
    content: '【英语语法专项格式要求】\n- 语法规则用<table class="grammar-rule">表格呈现或<div class="rule-box">框条展示\n- 典型例句用<blockquote class="example-sentence">，正确用法和错误用法分别用 ✅ 和 ❌ 前缀区分\n- 句型结构用<div class="sentence-pattern">展示公式（如：S、V-ed、O、时间状语）\n- 填空线用<u class="blank-N">&emsp;</u>，N按答案字母数调整（1-3字母→2，4-6字母→4，7-10字母→6）\n- 语篇语法填空的参考答案集中放文末，练习区不出现答案，挖空位置用序号标注', builtin: true },

  // ── A6. 生成-答题模板（5条，按领域类型分组）──
  { id: 'block_template_special_reading', name: '【答题模板-阅读理解】', category: '生成-答题模板', prompt_order: 28, type: 'fragment',
    subject: '语文,英语', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '【阅读理解答题模板——按题型四步作答】\n信息提取题：第X段/第Y句写道"……"（定位）→由此可知【　】（结论）。\n词句理解题："XX"本义为【　】，在文中指【　】（语境义），突出了/强调了【　】（表达效果）。\n推理判断题：文中提到"……"（证据）→可推断出【　】（推理），因为【　】（逻辑）。\n主旨概括题：本文通过记叙/描写【　】（主要内容），赞扬/批判/揭示/表达了【　】（主旨思想），告诉我们【　】（启示道理）。', builtin: true },
  { id: 'block_template_special_poetry', name: '【答题模板-古诗词鉴赏】', category: '生成-答题模板', prompt_order: 28, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '古诗词',
    content: '【古诗词鉴赏答题模板——四级鉴赏框架】\n意象分析法：诗中选取了【　】（意象群），描绘了一幅【　】（画面），营造了【　】（意境氛围）。\n意境描述法：这首诗描绘了【时间/地点】的【景象/场景】，通过【意象1】【意象2】等意象，构成了一幅【形容词+画面类型，如"清新明丽的山水画卷"】。\n手法鉴赏法：运用了【　】（修辞/表现手法），如"诗句原文"，【　】（分析手法如何运用），生动形象地写出了【　】（表达效果），表达了诗人【　】（情感）。\n情感主旨法：诗人借【　】（题材/事物/景物），抒发了【　】（情感类型：热爱/忧国/思乡/怀才不遇/豁达等），表达了【　】（深层主旨）。', builtin: true },
  { id: 'block_template_special_classical', name: '【答题模板-文言文】', category: '生成-答题模板', prompt_order: 28, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '文言文',
    content: '【文言文答题模板——五步解题法】\n断句法：①读通全文把握大意→②找标志词（曰/云/者/也/乎/哉/矣/耳）→③抓对称句式（字数相同/结构相似）→④看句首句尾（夫/盖/故/是以/然则）→⑤逐句断开用/标注。\n实词释义法："XX"在句中意为【　】，属【一词多义/古今异义/通假字/词类活用】，可联系成语"【　】"（同字词义）或课内"【　】（出处）"记忆。\n句子翻译法：逐字落实【字1→词1】【字2→词2】→调整语序（将【倒装/省略/被动】还原）→补充省略成分（主语/宾语）→写出通顺译文：【完整译文】。\n文意理解法：本文讲述了【人物/事件】（内容概括），通过【描写/对比/举例】（手法），表现了【人物品质/事件意义】（主旨），给我们的启示是【　】（感悟）。', builtin: true },
  { id: 'block_template_special_math', name: '【答题模板-数学解题】', category: '生成-答题模板', prompt_order: 28, type: 'fragment',
    subject: '数学', stage: '', genType: 'special', specialSubType: '计算,应用题,几何',
    content: '【数学解题答题模板——规范书写格式】\n计算题模板：\n解：原式 = [第一步变形]（依据：【运算律/公式名】）\n　　 = [第二步]\n　　 = [结果]（单位）\n答：（如应用题有问）\n\n应用题模板：\n审题：已知条件→【从题中提取的数据和关系】\n解题思路：先求【中间量】→再求【目标量】\n解：① [列式1，标注含义] = [结果1]（单位）\n　　② [列式2，标注含义] = [结果2]（单位）\n检验：把[结果]代入原题……验证（数量关系/单位/合理性）\n答：[完整回答]\n\n几何证明题模板：\n已知：[逐条列出已知条件]\n求证：[写出要证明的结论]\n证明：∵ [条件1]（已知），\n　　　  又∵ [条件2]（已知），\n　　　...（推理过程，每步标注依据）\n　　　∴ [结论]（定理名/公理名/定义）。', builtin: true },
  { id: 'block_template_special_english', name: '【答题模板-英语】', category: '生成-答题模板', prompt_order: 28, type: 'fragment',
    subject: '英语', stage: '', genType: 'special', specialSubType: '阅读理解,语法',
    content: '【英语专项答题模板——各类题型答题规范】\n阅读理解答题模板：\n细节题：①题干关键词 → ②原文定位（Line X） → ③对比选项与原文 → ④选同义替换项。\n推理题：①排除明显错误项 → ②排除原文未提及项 → ③排除过度推断项 → ④选基于原文的合理推断。\n词义猜测题：①定位原词所在句 → ②读前后1-2句找线索（同义词/反义词/解释/举例/因果关系）→ ③代入选项验证。\n主旨题：①看首段（引出话题）→ ②看各段首句（分论点）→ ③看末段（总结/升华）→ ④概括主题。\n\n语法题型答题模板：\n单项选择：①读题判断考查语法点（时态/语态/从句/非谓语等）→ ②排除明显语法错误项 → ③识别标志词（yesterday→过去时等）→ ④选符合规则的项。\n填空：①读空前后判断所需词性/语法形式 → ②写出原词 → ③按规则变形（加-ed/加-ing/变名词复数/变比较级等）→ ④检查拼写。', builtin: true },

  // ── A7. 生成-知识点全覆盖（5条，按领域类型分组）──
  { id: 'block_coverage_special_reading', name: '【知识点全覆盖-阅读类】', category: '生成-知识点全覆盖', prompt_order: 15, type: 'fragment',
    subject: '语文,英语', stage: '', genType: 'special', specialSubType: '阅读理解',
    content: '阅读理解专项必须覆盖以下全部题型和能力点：\n① 信息提取与定位（直接信息查找）\n② 词句理解与语境推断（借助上下文理解词句含义）\n③ 推理判断与逻辑分析（根据已知信息推断未知）\n④ 主旨概括与综合归纳（把握全文核心思想和情感）\n⑤ 手法鉴赏与表达效果分析（修辞/描写/结构等）\n⑥ 评价判断与创意表达（开放性题目）\n生成后自查：是否每种题型至少设置了1道题目？是否各层级难度递进合理？', builtin: true },
  { id: 'block_coverage_special_poetry', name: '【知识点全覆盖-古诗词】', category: '生成-知识点全覆盖', prompt_order: 15, type: 'fragment',
    subject: '语文', stage: '', genType: 'special', specialSubType: '古诗词',
    content: '古诗词专项必须覆盖以下全部能力点：\n① 字词理解（重点词释义、古今异义、通假字）\n② 意象识别与分析（找意象、说特征、明作用）\n③ 意境描绘与感受（用现代汉语描绘诗歌画面）\n④ 手法辨识与赏析（修辞手法、表现手法、抒情方式）\n⑤ 情感主旨把握（诗人思想感情、写作意图）\n⑥ 名句品读与运用（名句赏析、情境默写、化用写作）\n⑦ 对比阅读（同题材/同手法/不同风格诗歌比较）\n生成后自查：是否以上每个能力点都有对应题目？', builtin: true },
  { id: 'block_coverage_special_classical', name: '【知识点全覆盖-文言文】', category: '生成-知识点全覆盖', type: 'fragment',
  prompt_order: 15,
    subject: '语文', stage: '', genType: 'special', specialSubType: '文言文',
    content: '文言文专项必须覆盖以下全部能力点：\n① 断句（语音停顿、语法停顿）\n② 实词释义（一词多义、古今异义、通假字、词类活用）\n③ 虚词用法（之/其/而/以/于/为/乃/则/且/乎等）\n④ 特殊句式辨识（判断句/被动句/倒装句/省略句）\n⑤ 句子翻译（直译为主、关键词落实、语序调整）\n⑥ 文意理解与概括（主要内容、人物形象、事件因果）\n⑦ 文化常识积累（典章制度、人物称谓、地理名称、礼俗文化）\n⑧ 鉴赏评价与启示感悟\n生成后自查：是否实词/虚词考查了本节重点词汇？各类题型是否均衡？', builtin: true },
  { id: 'block_coverage_special_writing', name: '【知识点全覆盖-写作】', category: '生成-知识点全覆盖', type: 'fragment',
  prompt_order: 15,
    subject: '语文', stage: '', genType: 'special', specialSubType: '写作',
    content: '写作专项必须覆盖以下全部训练维度：\n① 审题与立意（准确理解题目、确定写作方向和中心思想）\n② 选材与组材（围绕中心选择素材、按逻辑组织材料）\n③ 结构与谋篇（开头/主体/结尾、段落层次、过渡衔接）\n④ 语言与表达（用词准确、句式多样、修辞运用、语体恰当）\n⑤ 修改与升格（自我修改、互评互改、针对问题升格重写）\n⑥ 书写与规范（标点正确、格式规范、卷面整洁）\n生成后自查：每次训练是否聚焦1-2个核心维度？是否从片段到篇章有梯度递进？是否提供评价量表引导自查？', builtin: true },
  { id: 'block_coverage_special_math', name: '【知识点全覆盖-数学类】', category: '生成-知识点全覆盖', type: 'fragment',
  prompt_order: 15,
    subject: '数学', stage: '', genType: 'special', specialSubType: '计算,应用题,几何',
    content: '数学专项必须覆盖以下全部能力维度：\n① 知识回顾（本节核心概念和公式的回忆与判断，2-3道基础概念题）\n② 基本技能（公式/定理/法则的直接运用，4-5道标准题）\n③ 变式应用（变换数据/条件/问法的变式训练，3-4道）\n④ 综合运用（结合多个知识点的综合题，2-3道，如有）\n⑤ 易错辨析（常见错误识别和纠正，2-3道找茬改错题）\n⑥ 思维拓展（一题多解/逆向思维/开放探究，1-2道，学有余力选做）\n生成后自查：是否在①-⑤每个维度设置了题目？是否从直接运用逐步过渡到变式和综合？', builtin: true },
 { id: 'block_coverage_special_english_grammar', name: '【知识点全覆盖-英语语法】', category: '生成-知识点全覆盖', type: 'fragment',
  prompt_order: 15,
    subject: '英语', stage: '', genType: 'special', specialSubType: '语法',
    content: '英语语法专项必须覆盖以下全部训练形式：\n① 规则认知（语法规则理解判断，2-3道概念辨析/判断题）\n② 单项选择（在语境中辨析语法点，4-5道）\n③ 适当形式填空（写出词的正确语法形式，4-5道）\n④ 句型转换（肯定→否定/提问/被动/间接引语等，3-4道）\n⑤ 改错（在句子中找语法错误并改正，2-3道）\n⑥ 语篇语法填空（在完整语境中运用语法规则，1篇10空）\n⑦ 情境造句（用给定语法结构造原创句子，1-2道，开放型）\n生成后自查：是否每种训练形式都有题目？是否从单词→句子→语篇层次递进？', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-学段控制】块级指令 — 按学段精确匹配（补建 D+A）
  // ═══════════════════════════════════════
  { id: 'stage_primary_low', name: '【学段控制】小学低段', category: '生成-学段控制', prompt_order: 52, type: 'fragment', subject: '', stage: 'primary', genType: '',
    content: '当前为小学低段（1-2年级）：识字量800-1600字，认读为主；数学100以内加减法，不含乘除法竖式；认知层次以识记、理解为主，可含简单应用；题目语言简洁，题干≤2句话，选项≤3个，答案≤3字。', builtin: true },
  { id: 'stage_primary_mid', name: '【学段控制】小学中段', category: '生成-学段控制', prompt_order: 52, type: 'fragment', subject: '', stage: 'primary', genType: '',
    content: '当前为小学中段（3-4年级）：识字量2500+字，可设简单阅读题；数学含万以内加减乘除、分数初步；认知层次以识记、理解、应用为主，可含简单分析；选项≤4个，可设简短简答题。', builtin: true },
  { id: 'stage_primary_high', name: '【学段控制】小学高段', category: '生成-学段控制', prompt_order: 52, type: 'fragment', subject: '', stage: 'primary', genType: '',
    content: '当前为小学高段（5-6年级）：识字量3000+字，阅读量适当增加；数学含小数/分数运算、方程初步；认知层次以理解、应用为主，可含分析和简单评价；增加综合性、应用性题目。', builtin: true },
  { id: 'stage_middle', name: '【学段控制】初中', category: '生成-学段控制', prompt_order: 52, type: 'fragment', subject: '', stage: 'middle', genType: '',
    content: '当前为初中阶段：知识体系结构化，抽象思维发展期；认知层次以理解、应用、分析为主，可含评价；考查知识的系统性和迁移能力，对标中考题型和难度。', builtin: true },
  { id: 'stage_high', name: '【学段控制】高中', category: '生成-学段控制', prompt_order: 52, type: 'fragment', subject: '', stage: 'high', genType: '',
    content: '当前为高中阶段：知识模块化，思辨能力成熟；认知层次应用、分析、评价、创造均允许；考查深度理解、创新思维和综合运用，对标高考题型和难度。', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-题量控制】块级指令 — 按学段精准匹配（补建 D）
  // ═══════════════════════════════════════
  { id: 'layout_primary_low', name: '【题量控制】小学低段', category: '生成-题量控制', prompt_order: 53, type: 'fragment', subject: '', stage: 'primary_low', genType: '',
    content: '题量建议：总题量15-25题，填空2-3字答案，选择题2-3选项，每大题含2-4小题；考查面均衡，避免同一知识点重复出题。', builtin: true },
  { id: 'layout_primary_mid', name: '【题量控制】小学中段', category: '生成-题量控制', prompt_order: 53, type: 'fragment', subject: '', stage: 'primary_mid', genType: '',
    content: '题量建议：总题量20-30题，填空3-5字答案，选择题3-4选项，每大题含3-5小题；考查面均衡，避免同一知识点重复出题。', builtin: true },
  { id: 'layout_primary_high', name: '【题量控制】小学高段', category: '生成-题量控制', prompt_order: 53, type: 'fragment', subject: '', stage: 'primary_high', genType: '',
    content: '题量建议：总题量25-35题，填空3-6字答案，选择题4选项，每大题含3-6小题；考查面均衡，避免同一知识点重复出题。', builtin: true },
  { id: 'layout_middle', name: '【题量控制】初中', category: '生成-题量控制', prompt_order: 53, type: 'fragment', subject: '', stage: 'middle', genType: '',
    content: '题量建议：总题量25-40题，选择题4选项，每大题含4-8小题；考查面均衡，各知识点按权重分配题量，避免同一知识点重复出题。', builtin: true },
  { id: 'layout_high', name: '【题量控制】高中', category: '生成-题量控制', prompt_order: 53, type: 'fragment', subject: '', stage: 'high', genType: '',
    content: '题量建议：总题量25-45题，选择题4选项为主，每大题含4-8小题；考查面均衡，各知识点按权重分配题量，避免同一知识点重复出题。', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-难度控制】块级指令 — 按学段精准匹配（补建 D）
  // ═══════════════════════════════════════
  { id: 'diff_primary_low', name: '【难度控制】小学低段', category: '生成-难度控制', prompt_order: 54, type: 'fragment', subject: '', stage: 'primary_low', genType: '',
    content: '难度配比：基础题70%、中等题20%、提高题10%；题目从易到难排列，基础题以教材原题变式为主，提高题控制难度不超学段课标上限。', builtin: true },
  { id: 'diff_primary_mid', name: '【难度控制】小学中段', category: '生成-难度控制', prompt_order: 54, type: 'fragment', subject: '', stage: 'primary_mid', genType: '',
    content: '难度配比：基础题60%、中等题30%、提高题10%；题目从易到难排列，中等题注意知识迁移和简单情境应用。', builtin: true },
  { id: 'diff_primary_high', name: '【难度控制】小学高段', category: '生成-难度控制', prompt_order: 54, type: 'fragment', subject: '', stage: 'primary_high', genType: '',
    content: '难度配比：基础题50%、中等题30%、提高题20%；题目从易到难排列，提高题侧重综合应用和思维拓展，但不超过小学课标上限。', builtin: true },
  { id: 'diff_middle', name: '【难度控制】初中', category: '生成-难度控制', prompt_order: 54, type: 'fragment', subject: '', stage: 'middle', genType: '',
    content: '难度配比：基础题50%、中等题30%、提高题20%；题目从易到难排列，提高题对标中考中档及以上难度，考查知识综合与迁移。', builtin: true },
  { id: 'diff_high', name: '【难度控制】高中', category: '生成-难度控制', prompt_order: 54, type: 'fragment', subject: '', stage: 'high', genType: '',
    content: '难度配比：基础题40%、中等题40%、提高题20%；题目从易到难排列，提高题对标高考中档及以上难度，考查深度思维和创新意识。', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-学科核心素养】块级指令 — 按学科×学段精准匹配（补建 D）
  // ═══════════════════════════════════════
  { id: 'core_chinese', name: '【核心素养】语文', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '语文', stage: '', genType: '',
    content: '请在命题中体现语文核心素养：文化自信、语言运用、思维能力、审美创造。在真实语言运用情境中考查，体现中华优秀传统文化、革命文化、社会主义先进文化。', builtin: true },
  { id: 'core_math', name: '【核心素养】数学', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '数学', stage: '', genType: '',
    content: '请在命题中体现数学核心素养：数学眼光（从真实情境中抽象数学问题）、数学思维（逻辑推理与数学建模）、数学语言（用数学符号和图形表达）。', builtin: true },
  { id: 'core_english', name: '【核心素养】英语', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '英语', stage: '', genType: '',
    content: '请在命题中体现英语核心素养：语言能力、文化意识、思维品质、学习能力。以语篇为载体，在真实交际情境中考查语言运用。', builtin: true },
  { id: 'core_physics', name: '【核心素养】物理', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '物理', stage: '', genType: '',
    content: '请在命题中体现物理核心素养：物理观念、科学思维、科学探究、科学态度与责任。从生活、科技、体育等情境中提炼物理问题。', builtin: true },
  { id: 'core_chemistry', name: '【核心素养】化学', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '化学', stage: '', genType: '',
    content: '请在命题中体现化学核心素养：宏观辨识与微观探析、变化观念与平衡思想、证据推理与模型认知、科学探究与创新意识、科学精神与社会责任。', builtin: true },
  { id: 'core_biology', name: '【核心素养】生物', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '生物', stage: '', genType: '',
    content: '请在命题中体现生物核心素养：生命观念、科学思维、科学探究、社会责任。', builtin: true },
  { id: 'core_history', name: '【核心素养】历史', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '历史', stage: '', genType: '',
    content: '请在命题中体现历史核心素养：唯物史观、时空观念、史料实证、历史解释、家国情怀。', builtin: true },
  { id: 'core_geography', name: '【核心素养】地理', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '地理', stage: '', genType: '',
    content: '请在命题中体现地理核心素养：区域认知、综合思维、地理实践力、人地协调观。', builtin: true },
  { id: 'core_politics', name: '【核心素养】道德与法治/思想政治', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '道德与法治,思想政治,政治', stage: '', genType: '',
    content: '请在命题中体现思政核心素养：政治认同、道德修养、法治观念、健全人格、责任意识。在真实社会情境中考查价值判断和行为选择。', builtin: true },
  { id: 'core_science', name: '【核心素养】科学', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '科学', stage: '', genType: '',
    content: '请在命题中体现科学核心素养：科学观念、科学思维、探究实践、态度责任。从生活中的科学现象出发，考查观察、实验、推理能力。', builtin: true },
  { id: 'core_it', name: '【核心素养】信息技术', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '信息技术,信息科技', stage: '', genType: '',
    content: '请在命题中体现信息科技核心素养：信息意识、计算思维、数字化学习与创新、信息社会责任。', builtin: true },
  // 通用框架（按学段）
  { id: 'core_framework_primary', name: '【核心素养框架】小学', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '', stage: 'primary', genType: '',
    content: '小学阶段核心素养考查侧重：在真实情境中感知和体验学科核心素养，以兴趣激发和习惯养成为主要目标，不要求抽象层面的素养论述，通过具体题目设计自然渗透。', builtin: true },
  { id: 'core_framework_middle', name: '【核心素养框架】初中', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '', stage: 'middle', genType: '',
    content: '初中阶段核心素养考查侧重：在较复杂情境中运用学科知识解决问题，体现学科思维方法的初步形成，可适当设置跨学科融合题目。', builtin: true },
  { id: 'core_framework_high', name: '【核心素养框架】高中', category: '生成-学科核心素养', prompt_order: 55, type: 'fragment', subject: '', stage: 'high', genType: '',
    content: '高中阶段核心素养考查侧重：在复杂真实情境中深度运用学科核心素养，体现批判性思维和创新意识，考查学科本质理解和跨模块综合运用能力。', builtin: true },

  // ═══════════════════════════════════════
  // 【生成-学科禁止项】块级指令 — 按学科精准匹配（补建 D）
  // ═══════════════════════════════════════
  { id: 'ban_supplement_chinese_primary_low', name: '【学科禁止-语文-小学低段】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '语文', stage: 'primary_low', genType: '',
    content: '语文补充禁止：① 阅读篇目不得超出学段阅读量标准（不超300字）② 古诗文默写不得超纲篇目（按低段课标推荐篇目为准）③ 作文题目不得偏离学段写作要求（看图写话）④ 不得使用生僻字作为考点。', builtin: true },
  { id: 'ban_supplement_chinese_primary_mid', name: '【学科禁止-语文-小学中段】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '语文', stage: 'primary_mid', genType: '',
    content: '语文补充禁止：① 阅读篇目不得超出学段阅读量标准（不超500字）② 古诗文默写不得超纲篇目（按中段课标推荐篇目为准）③ 作文题目不得偏离学段写作要求（片段习作）④ 不得使用生僻字作为考点。', builtin: true },
  { id: 'ban_supplement_chinese_primary_high', name: '【学科禁止-语文-小学高段】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '语文', stage: 'primary_high', genType: '',
    content: '语文补充禁止：① 阅读篇目不得超出学段阅读量标准（不超800字）② 古诗文默写不得超纲篇目（按高段课标推荐篇目为准）③ 作文题目不得偏离学段写作要求（完整作文）④ 不得使用生僻字作为考点。', builtin: true },
  { id: 'ban_supplement_chinese_middle', name: '【学科禁止-语文-初中】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '语文', stage: 'middle', genType: '',
    content: '语文补充禁止：① 阅读篇目不得超出初中课标阅读量标准（现代文≤1000字，古诗文按课标推荐篇目）② 古诗文和文言文默写不得超纲篇目（按初中课标推荐篇目为准）③ 作文题目不得偏离初中写作要求（记叙文、说明文、议论文）④ 不得使用生僻字和冷僻文言词汇作为考点。', builtin: true },
  { id: 'ban_supplement_chinese_high', name: '【学科禁止-语文-高中】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '语文', stage: 'high', genType: '',
    content: '语文补充禁止：① 阅读篇目不得超出高中课标阅读量标准（论述类、文学类、实用类文本按高考标准）② 古诗文默写不得超纲篇目（按高中课标推荐篇目为准）③ 作文题目不得偏离高中写作要求（论述文、文学评论、实用文体）④ 不得使用不规范的古汉语或生僻词汇作为考点。', builtin: true },
  { id: 'ban_supplement_math_primary_low', name: '【学科禁止-数学-小学低段】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '数学', stage: 'primary_low', genType: '',
    content: '数学补充禁止：① 不得超纲使用未学过的运算（如100以内加减法阶段出现乘除法或分数运算）② 应用题情境必须真实合理（不得出现违反常识的数据）③ 几何题图形必须按比例准确绘制或标注"示意图"④ 不得出现大量纯计算题堆砌（应穿插情境题和探究题）。', builtin: true },
  { id: 'ban_supplement_math_primary_mid', name: '【学科禁止-数学-小学中段】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '数学', stage: 'primary_mid', genType: '',
    content: '数学补充禁止：① 不得超纲使用未学过的运算（如整数四则运算阶段出现负数或方程）② 应用题情境必须真实合理（不得出现违反常识的数据）③ 几何题图形必须按比例准确绘制或标注"示意图"④ 不得出现大量纯计算题堆砌（应穿插情境题和探究题）。', builtin: true },
  { id: 'ban_supplement_math_primary_high', name: '【学科禁止-数学-小学高段】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '数学', stage: 'primary_high', genType: '',
    content: '数学补充禁止：① 不得超纲使用未学过的运算（如小学阶段出现负数运算或有理数混合运算）② 应用题情境必须真实合理（不得出现违反常识的数据）③ 几何题图形必须按比例准确绘制或标注"示意图"④ 不得出现大量纯计算题堆砌（应穿插情境题和探究题）。', builtin: true },
  { id: 'ban_supplement_math_middle', name: '【学科禁止-数学-初中】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '数学', stage: 'middle', genType: '',
    content: '数学补充禁止：① 不得超纲使用未学过的运算和方法（如初中阶段出现微积分或大学数学内容）② 应用题情境必须真实合理（不得出现违反常识的数据）③ 几何题图形必须按比例准确绘制或标注"示意图"④ 不得出现大量纯计算题堆砌（应穿插情境题和探究题）。', builtin: true },
  { id: 'ban_supplement_math_high', name: '【学科禁止-数学-高中】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '数学', stage: 'high', genType: '',
    content: '数学补充禁止：① 不得超纲使用未学过的运算和方法（如高中阶段出现大学数学内容）② 应用题情境必须真实合理（不得出现违反常识的数据）③ 几何题图形必须按比例准确绘制或标注"示意图"④ 不得出现大量纯计算题堆砌（应穿插情境题和探究题）。', builtin: true },
  { id: 'ban_supplement_english', name: '【学科禁止-英语】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '英语', stage: '', genType: '',
    content: '英语补充禁止：① 阅读篇目词汇量不得超出学段课标词汇范围（生词比例不超过3%）② 不得出现未学语法时态（严格按学段进度）③ 不得使用全英文非学段词汇的题干。', builtin: true },
  { id: 'ban_supplement_science', name: '【学科禁止-理科通用】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '物理,化学,生物,科学', stage: '', genType: '',
    content: '理科补充禁止：① 实验题不得脱离教材实验范围或使用未学仪器② 计算题数据必须符合实际物理/化学/生物规律③ 不得出现教材未涉及的科学史或科学家④ 公式和单位符号必须使用标准格式。', builtin: true },
  { id: 'ban_supplement_history', name: '【学科禁止-历史】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '历史', stage: '', genType: '',
    content: '历史补充禁止：① 史实不得有年代、人物、事件的硬伤性错误② 材料题所引史料必须真实可考（不得杜撰古籍引文）③ 观点类题目不得脱离唯物史观立场④ 不得出现历史虚无主义倾向的表述。', builtin: true },
  { id: 'ban_supplement_geo', name: '【学科禁止-地理】', category: '生成-学科禁止项', prompt_order: 56, type: 'fragment', subject: '地理', stage: '', genType: '',
    content: '地理补充禁止：① 地图必须准确（国界线/行政区划/地名不得有误）② 数据类题目必须使用可查证的现实数据③ 区域地理不得超出教材覆盖的区域范围④ 不得出现不规范的经纬度或地图投影。', builtin: true },



  {
    id: 'originality_exam_primary_low', name: '🎨 原创标准-试卷-小学低段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'exam',
    content: '【原创标准】\n题目情境需贴近低龄学生生活经验（校园、家庭、游戏），以趣味驱动，避免成人化表述。同卷内同一知识点不得以相同问法重复出现。',
    builtin: true
  },
  {
    id: 'originality_exam_primary_mid', name: '🎨 原创标准-试卷-小学中段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'exam',
    content: '【原创标准】\n题目情境来源于学生可感知的真实世界（社区、自然、日常活动），注重知识在生活中的实际应用。同一知识点变换角度考查。',
    builtin: true
  },
  {
    id: 'originality_exam_primary_high', name: '🎨 原创标准-试卷-小学高段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'exam',
    content: '【原创标准】\n设问角度新颖，情境具有真实性和适度复杂度，考查知识的综合运用与迁移能力。杜绝陈题套路，每道题需有独立的原创设计。',
    builtin: true
  },
  {
    id: 'originality_exam_middle', name: '🎨 原创标准-试卷-初中', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'middle', genType: 'exam',
    content: '【原创标准】\n对标中考命题趋势，以真实情境为载体，设问灵活有层次。杜绝直接搬运教辅原题，每道题应是独立原创，情境与数据均为全新构造。',
    builtin: true
  },
  {
    id: 'originality_exam_high', name: '🎨 原创标准-试卷-高中', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'high', genType: 'exam',
    content: '【原创标准】\n对标高考命题导向，以真实复杂情境考查批判性思维与学科核心素养。杜绝模板化设问，每道题需有独立学术价值与原创情境。',
    builtin: true
  },
  {
    id: 'originality_practice_primary_low', name: '🎨 原创标准-练习-小学低段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'practice',
    content: '【原创标准】\n练习形式多样有趣（涂色、连线、填空、选择交替呈现），同一知识点变换多种练习方式，避免机械重复抄写。',
    builtin: true
  },
  {
    id: 'originality_practice_primary_mid', name: '🎨 原创标准-练习-小学中段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'practice',
    content: '【原创标准】\n练习设计有层次递进（识记→理解→应用），同一知识点从不同角度巩固，避免简单堆砌同类题目。',
    builtin: true
  },
  {
    id: 'originality_practice_primary_high', name: '🎨 原创标准-练习-小学高段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'practice',
    content: '【原创标准】\n练习融入真实情境，体现"做中学"理念。杜绝脱离实际的纯计算/纯记忆类重复练习，每道题需有明确的训练意图。',
    builtin: true
  },
  {
    id: 'originality_practice_middle', name: '🎨 原创标准-练习-初中', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'middle', genType: 'practice',
    content: '【原创标准】\n练习设计对标中考题型但情境与数据均为全新构造。杜绝直接搬运教辅原题，每道练习题需经独立设计。',
    builtin: true
  },
  {
    id: 'originality_practice_high', name: '🎨 原创标准-练习-高中', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'high', genType: 'practice',
    content: '【原创标准】\n练习体现学科思维进阶，以素养导向的变式训练促进深度学习。每道题需有明确的思维训练目标，杜绝无目的的重复练习。',
    builtin: true
  },
  {
    id: 'originality_preview_primary_low', name: '🎨 原创标准-预习-小学低段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'preview',
    content: '【原创标准】\n预习以趣味探索为导向（"找一找""看一看""想一想"），激发好奇心与求知欲。避免变成提前做题或抄写任务。',
    builtin: true
  },
  {
    id: 'originality_preview_primary_mid', name: '🎨 原创标准-预习-小学中段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'preview',
    content: '【原创标准】\n预习引导学生自主发现问题，以"我想知道什么"驱动课前阅读。问题设计开放有趣，不给标准答案。',
    builtin: true
  },
  {
    id: 'originality_preview_primary_high', name: '🎨 原创标准-预习-小学高段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'preview',
    content: '【原创标准】\n预习问题具有开放性和引导性，帮助学生建立新旧知识的连接。重在"发现问题"而非"解决问题"。',
    builtin: true
  },
  {
    id: 'originality_preview_middle', name: '🎨 原创标准-预习-初中', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'middle', genType: 'preview',
    content: '【原创标准】\n预习以问题链引导学生梳理知识框架、标记疑难点，培养自主学习能力。重在"带着问题进课堂"。',
    builtin: true
  },
  {
    id: 'originality_preview_high', name: '🎨 原创标准-预习-高中', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'high', genType: 'preview',
    content: '【原创标准】\n预习以问题链驱动深度阅读和批判性思考，引导学生审视教材内容、提出独立见解与质疑。',
    builtin: true
  },
  {
    id: 'originality_summary_primary_low', name: '🎨 原创标准-总结-小学低段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'summary',
    content: '【原创标准】\n知识梳理以结构化视觉方式呈现（表格/分类卡片/知识树），避免大段文字堆砌，符合低龄认知特点。区别于教材目录式罗列。',
    builtin: true
  },
  {
    id: 'originality_summary_primary_mid', name: '🎨 原创标准-总结-小学中段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'summary',
    content: '【原创标准】\n知识梳理逻辑清晰、层次分明，帮助学生建立初步的知识结构意识。重难点用颜色或符号标注。',
    builtin: true
  },
  {
    id: 'originality_summary_primary_high', name: '🎨 原创标准-总结-小学高段', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'summary',
    content: '【原创标准】\n知识梳理突出重难点与易错点，引导学生形成知识网络。区别于教材目录式的简单罗列与教辅资料的照搬照抄。',
    builtin: true
  },
  {
    id: 'originality_summary_middle', name: '🎨 原创标准-总结-初中', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'middle', genType: 'summary',
    content: '【原创标准】\n知识梳理对标中考考点体系，以思维导图或对比表格等形式呈现。区别于市面上常见教辅的模板化总结方式。',
    builtin: true
  },
  {
    id: 'originality_summary_high', name: '🎨 原创标准-总结-高中', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: 'high', genType: 'summary',
    content: '【原创标准】\n知识梳理体现学科大概念与核心素养，以专题整合替代知识点平铺。需有跨章节的关联提炼，体现独立的知识组织视角。',
    builtin: true
  },
  {
    id: 'originality_dictation', name: '🎨 原创标准-默写（全学段）', category: '生成-原创标准', type: 'fragment',
    subject: '', stage: '', genType: 'dictation',
    content: '【原创标准】\n默写内容严格对应教材要求，确保准确性。无需原创设计，重在规范与准确。',
    builtin: true
  },
  {
    id: 'quality_exam_primary_low', name: '⭐ 品质标准-试卷-小学低段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'exam',
    content: '【品质标准】\n题目以识记和理解为主，题型多样有趣。答案简洁明确，评分标准清晰。排版干净整齐，适合低龄学生阅读。',
    builtin: true
  },
  {
    id: 'quality_exam_primary_mid', name: '⭐ 品质标准-试卷-小学中段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'exam',
    content: '【品质标准】\n基础巩固占60%，能力提升占30%，拓展延伸占10%。答案需有简要思路引导，帮助理解解题过程。',
    builtin: true
  },
  {
    id: 'quality_exam_primary_high', name: '⭐ 品质标准-试卷-小学高段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'exam',
    content: '【品质标准】\n基础巩固50%，综合运用35%，拓展探究15%。答案需体现解题思路，开放性试题给出评分要点。排版对标优质教辅。',
    builtin: true
  },
  {
    id: 'quality_exam_middle', name: '⭐ 品质标准-试卷-初中', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'middle', genType: 'exam',
    content: '【品质标准】\n对标中考难度与题型结构。答案需有完整的思路分析、分步解答、方法总结。排版对标高端教辅，层次分明。',
    builtin: true
  },
  {
    id: 'quality_exam_high', name: '⭐ 品质标准-试卷-高中', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'high', genType: 'exam',
    content: '【品质标准】\n对标高考难度与命题质量。答案需有深度解析（思路分析→规范解答→方法提炼→易错警示），排版对标高端教辅。',
    builtin: true
  },
  {
    id: 'quality_practice_primary_low', name: '⭐ 品质标准-练习-小学低段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'practice',
    content: '【品质标准】\n以趣味练习为主。每题配即时反馈提示，帮助学生自查自纠。',
    builtin: true
  },
  {
    id: 'quality_practice_primary_mid', name: '⭐ 品质标准-练习-小学中段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'practice',
    content: '【品质标准】\n由易到难排列。关键题配思路点拨，引导学生思考而非直接给答案。',
    builtin: true
  },
  {
    id: 'quality_practice_primary_high', name: '⭐ 品质标准-练习-小学高段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'practice',
    content: '【品质标准】\n分层设计（必做、选做）。答案需有思路引导，培养独立思考习惯。',
    builtin: true
  },
  {
    id: 'quality_practice_middle', name: '⭐ 品质标准-练习-初中', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'middle', genType: 'practice',
    content: '【品质标准】\n分层明确（基础过关、能力提升、中考对接）。答案需有完整解析过程与方法点拨。',
    builtin: true
  },
  {
    id: 'quality_practice_high', name: '⭐ 品质标准-练习-高中', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'high', genType: 'practice',
    content: '【品质标准】\n以思维训练为核心。答案需有深度解析，注重方法总结与思维拓展。',
    builtin: true
  },
  {
    id: 'quality_preview_primary_low', name: '⭐ 品质标准-预习-小学低段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'preview',
    content: '【品质标准】\n预习内容以趣味发现为主（3-5个引导性问题），配插图或图标提示。不设硬性书写任务，重在激发兴趣。',
    builtin: true
  },
  {
    id: 'quality_preview_primary_mid', name: '⭐ 品质标准-预习-小学中段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'preview',
    content: '【品质标准】\n预习设计以"读-思-问"为主线（阅读→思考→提问），问题有趣味性和启发性，引导学生主动探索。',
    builtin: true
  },
  {
    id: 'quality_preview_primary_high', name: '⭐ 品质标准-预习-小学高段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'preview',
    content: '【品质标准】\n预习以任务单形式呈现（阅读任务、思考问题、我的疑问），引导学生带着问题进课堂。',
    builtin: true
  },
  {
    id: 'quality_preview_middle', name: '⭐ 品质标准-预习-初中', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'middle', genType: 'preview',
    content: '【品质标准】\n预习以导学案形式呈现（知识框架、重点标注、疑难点预判），培养自主学习习惯与方法。',
    builtin: true
  },
  {
    id: 'quality_preview_high', name: '⭐ 品质标准-预习-高中', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'high', genType: 'preview',
    content: '【品质标准】\n预习以深度学习为导向（教材研读、概念辨析、批判性质疑），培养独立研究与深度思考能力。',
    builtin: true
  },
  {
    id: 'quality_summary_primary_low', name: '⭐ 品质标准-总结-小学低段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_low', genType: 'summary',
    content: '【品质标准】\n以结构化方式呈现（表格/分类卡片/思维导图），用符号标注重点。知识点聚焦不超过5个核心要点，语言简洁有趣。',
    builtin: true
  },
  {
    id: 'quality_summary_primary_mid', name: '⭐ 品质标准-总结-小学中段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_mid', genType: 'summary',
    content: '【品质标准】\n结构清晰（知识树或思维导图），层次不超过3级。重难点用符号标注，配典型例题辅助理解。',
    builtin: true
  },
  {
    id: 'quality_summary_primary_high', name: '⭐ 品质标准-总结-小学高段', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'primary_high', genType: 'summary',
    content: '【品质标准】\n以知识图谱形式呈现，突出知识点之间的关联。配易错点提示和典型例题，助力系统复习。',
    builtin: true
  },
  {
    id: 'quality_summary_middle', name: '⭐ 品质标准-总结-初中', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'middle', genType: 'summary',
    content: '【品质标准】\n对标中考考点，以"考点→知识梳理→典型例题→方法总结"四层结构呈现，便于系统复习。',
    builtin: true
  },
  {
    id: 'quality_summary_high', name: '⭐ 品质标准-总结-高中', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: 'high', genType: 'summary',
    content: '【品质标准】\n以专题大概念统领，体现学科核心素养。以"知识整合→规律提炼→高考对接→思维拓展"为框架。',
    builtin: true
  },
  {
    id: 'quality_dictation', name: '⭐ 品质标准-默写（全学段）', category: '生成-品质标准', type: 'fragment',
    subject: '', stage: '', genType: 'dictation',
    content: '【品质标准】\n内容严格对应教材要求，格式规范。标注每项的评分标准（如错一字扣几分），便于批改。',
    builtin: true
  },


];;
// ==================== 指令库存储Key与版本号 ====================
const STORAGE_KEY = 'instructionLib';
const VERSION_KEY = 'instructionLib_version';
export const BUILTIN_VERSION = 15; // 🔧 v15: 修复 subject_chinese/chinese_stroke_order 缺失 genType 字段导致跨资料类型污染

// ==================== 加载指令库 ====================
export const loadInstructionLib = () => {
  try {
    const savedVersion = localStorage.getItem(VERSION_KEY);
    // 🔧 版本升级时精准清理：只移除引用已删除内置ID的_override条目
    // 不再全量清空 localStorage，避免误删用户手动添加的指令
    if (!savedVersion || parseInt(savedVersion, 10) < BUILTIN_VERSION) {
      console.warn(`[instructionLib] 内置版本升级 (${savedVersion || '无'} → ${BUILTIN_VERSION})`);
      const oldSaved = localStorage.getItem(STORAGE_KEY);
      if (oldSaved) {
        try {
          const oldCustom = JSON.parse(oldSaved);
          const currentBuiltinIds = new Set(builtinInstructions.map(i => i.id));
          // 保留：无_overrideId（用户手动添加）+ _overrideId仍存在（有效覆盖）
          const kept = oldCustom.filter(i => {
            if (!i._overrideId) return true;
            return currentBuiltinIds.has(i._overrideId);
          });
          const removed = oldCustom.length - kept.length;
          if (removed > 0) {
            console.warn(`[instructionLib] 已清理 ${removed} 条失效覆盖（目标内置条目已删除），保留 ${kept.length} 条`);
          }
          saveInstructionLib(kept);
        } catch {
          localStorage.removeItem(STORAGE_KEY); // 解析失败兜底全清
        }
      }
      localStorage.setItem(VERSION_KEY, String(BUILTIN_VERSION));
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const customInstructions = JSON.parse(saved);
      // 🔧 内置覆盖：自定义条目中 _overrideId 指向的内置条目被替换
      const overrideIds = new Set(customInstructions.filter(i => i._overrideId).map(i => i._overrideId));
      const filteredBuiltins = builtinInstructions.filter(i => !overrideIds.has(i.id));
      const merged = [...filteredBuiltins, ...customInstructions];
      
      // 🔧 防御性检查：检测合并后是否有重复 ID（直接传入已合并数组，避免递归）
      if (typeof validateInstructionIds === 'function') {
        const { valid, duplicates } = validateInstructionIds(merged);
        if (!valid) {
          console.error('[instructionLib] ⚠️ 检测到重复ID！', duplicates);
        }
      }
      
      return merged;
    }
    saveInstructionLib([]);
    localStorage.setItem(VERSION_KEY, String(BUILTIN_VERSION));
    return [...builtinInstructions];
  } catch (e) {
    console.error('加载指令库失败:', e);
    return [...builtinInstructions];
  }
};

// ==================== 保存指令库（只保存自定义指令） ====================
export const saveInstructionLib = (customInstructions) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customInstructions));
    localStorage.setItem(VERSION_KEY, String(BUILTIN_VERSION));
  } catch (e) {
    console.error('保存指令库失败:', e);
  }
};

// ==================== 添加自定义指令 ====================

/**
 * 检查 ID 是否在全局范围内唯一（内置 + 自定义）
 * @param {string} id - 要检查的 ID
 * @returns {boolean} 是否唯一
 */
export const isIdUnique = (id) => {
  if (!id) return false;
  // 检查内置指令库
  if (builtinInstructions.some(i => i.id === id)) return false;
  // 检查自定义指令库
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const customInstructions = JSON.parse(saved);
      if (customInstructions.some(i => i.id === id)) return false;
    }
  } catch {}
  return true;
};

/**
 * 生成唯一自定义 ID（时间戳 + 4位随机数确保绝对唯一）
 * @returns {string} 唯一ID
 */
export const generateUniqueCustomId = () => {
  const ts = Date.now();
  const suffix = Math.random().toString(36).substring(2, 6);
  const id = `custom_${ts}_${suffix}`;
  // 双重保险：如果碰巧冲突（极小概率），递归重试
  if (!isIdUnique(id)) return generateUniqueCustomId();
  return id;
};

/**
 * 校验所有指令 ID，检测重复
 * @returns {{ valid: boolean, duplicates: Array<{id: string, count: number}> }}
 */
export const validateInstructionIds = (instructions) => {
  const allInstructions = instructions || loadInstructionLib();
  const idMap = new Map();
  const duplicates = [];
  
  for (const ins of allInstructions) {
    if (!ins.id) continue;
    const count = (idMap.get(ins.id) || 0) + 1;
    idMap.set(ins.id, count);
  }
  
  for (const [id, count] of idMap) {
    if (count > 1) {
      duplicates.push({ id, count });
    }
  }
  
  return {
    valid: duplicates.length === 0,
    duplicates
  };
};

export const addCustomInstruction = (instruction) => {
  const allInstructions = loadInstructionLib();
  const customInstructions = allInstructions.filter(i => !i.builtin);
  const newInstruction = {
    ...instruction,
    id: generateUniqueCustomId(),
    builtin: false
  };
  customInstructions.push(newInstruction);
  saveInstructionLib(customInstructions);
  return newInstruction;
};

// ==================== 更新指令（支持内置→自定义自动升级） ====================
export const updateCustomInstruction = (id, updates) => {
  const allInstructions = loadInstructionLib();
  
  // 先查找是否为内置条目
  const builtin = builtinInstructions.find(i => i.id === id);
  if (builtin) {
    // 🔧 内置→自定义升级：检查是否已有自定义覆盖
    const customInstructions = allInstructions.filter(i => !i.builtin);
    const existing = customInstructions.find(i => i._overrideId === id);
    if (existing) {
      Object.assign(existing, updates);
    } else {
      customInstructions.push({
        ...builtin,
        ...updates,
        // 🔧 保留原始内置 ID（不重新生成 custom_xxx），编辑前后ID不变
        builtin: false,
        _overrideId: id,
      });
    }
    saveInstructionLib(customInstructions);
    return true;
  }
  
  // 自定义条目：直接更新
  const customInstructions = allInstructions.filter(i => !i.builtin);
  const index = customInstructions.findIndex(i => i.id === id);
  if (index !== -1) {
    customInstructions[index] = { ...customInstructions[index], ...updates };
    saveInstructionLib(customInstructions);
    return true;
  }
  return false;
};

// ==================== 删除自定义指令 ====================
export const deleteCustomInstruction = (id) => {
  const allInstructions = loadInstructionLib();
  const customInstructions = allInstructions.filter(i => !i.builtin);
  const filtered = customInstructions.filter(i => i.id !== id);
  saveInstructionLib(filtered);
  return true;
};

// ==================== 获取指令库统计 ====================
export const getInstructionLibStats = () => {
  const allInstructions = loadInstructionLib();
  const categories = {};
  allInstructions.forEach(i => {
    categories[i.category] = (categories[i.category] || 0) + 1;
  });
  return {
    total: allInstructions.length,
    builtin: allInstructions.filter(i => i.builtin).length,
    custom: allInstructions.filter(i => !i.builtin).length,
    categories
  };
};

// ==================== 按分类获取指令 ====================
export const getInstructionsByCategory = (category) => {
  const allInstructions = loadInstructionLib();
  if (!category) return allInstructions;
  return allInstructions.filter(i => i.category === category);
};

// ==================== 获取所有分类 ====================
export const getAllCategories = () => {
  const allInstructions = loadInstructionLib();
  const categories = new Set();
  allInstructions.forEach(i => categories.add(i.category));
  return Array.from(categories);
};

// ==================== 获取所有类型 ====================
export const getAllTypes = () => [
  { value: 'full', label: '完整指令' },
  { value: 'fragment', label: '指令片段' }
];;

// ==================== 获取所有学科 ====================
export const getAllSubjects = () => {
  const all = loadInstructionLib();
  const subs = new Set();
  all.forEach(i => { if (i.subject) i.subject.split(',').forEach(s => subs.add(s.trim())); });
  return [...subs].filter(Boolean);
};

// ==================== 块级指令查询（供 buildGenerationInstruction 使用） ====================
/**
 * 从指令库中查询匹配的【】块级指令
 * @param {Object} options - { category, subject, stage, genType }
 * @returns {Array<{name, content}>}
 */
export const getMatchingBlockInstructions = (options = {}) => {
  let { category, subject, stage, genType, specialSubType } = options;
  // 🔧 兼容 matchSubject 键名：buildGenerationInstruction 中所有调用方使用 { matchSubject } 简写传参,
  // 但函数解构的是 subject，键名不匹配会导致所有学科专属条目被过滤
  if (subject === undefined) subject = options.matchSubject;
  const all = loadInstructionLib();
  const matches = all.filter(i => {
    // 必须是 fragment 类型（块级指令都是片段）
    if (i.type !== 'fragment') return false;
    // 类别匹配
    if (category && i.category !== category) return false;
    // 学科匹配（空=通用，匹配用逗号分隔）
    if (i.subject && i.subject.trim() !== '') {
      if (!subject) return false;
      const insSubjects = i.subject.split(',').map(s => s.trim());
      if (!insSubjects.includes(subject)) return false;
    }
    // 学段匹配（🔧 支持逗号分隔多值，如 'primary_low,primary_mid,primary_high'）
    if (i.stage && i.stage.trim() !== '') {
      if (!stage) return false;
      const insStages = i.stage.split(',').map(s => s.trim());
      if (!insStages.includes(stage)) return false;
    }
    // 资料类型匹配
    if (i.genType && i.genType.trim() !== '') {
      if (!genType) return false;
      const insTypes = i.genType.split(',').map(s => s.trim());
      if (!insTypes.includes(genType)) return false;
    }
    // 专项子类型匹配（仅 genType=special 时生效，空=匹配所有子类型）
    if (specialSubType && i.specialSubType && i.specialSubType !== specialSubType) return false;
    return true;
  });

  // 🔧 按匹配特异性排序：精确匹配优先于通用条目
  // 解决自定义条目被 append 到数组末尾后，被通用内置条目"影子遮蔽"的问题
  // 优先级：专项子类型(5) > 学科(2) > 学段(1) > 资料类型(1) > 通用(0)
  if (matches.length > 1) {
    matches.sort((a, b) => {
      const score = (item) => {
        let s = 0;
        if (item.subject && item.subject.trim() && subject) s += 2;
        if (item.stage && item.stage.trim() && stage) s += 1;
        if (item.genType && item.genType.trim() && genType) s += 1;
        if (item.specialSubType && specialSubType && item.specialSubType === specialSubType) s += 5;
        return s;
      };
      return score(b) - score(a);
    });
  }

  return matches;
};

// ==================== 导出配置 ====================
export default {
  builtinInstructions,
  loadInstructionLib,
  saveInstructionLib,
  addCustomInstruction,
  updateCustomInstruction,
  deleteCustomInstruction,
  getInstructionLibStats,
  getInstructionsByCategory,
  getAllCategories,
  getAllTypes,
  getAllSubjects,
  getMatchingBlockInstructions
};