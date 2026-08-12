type IssueSeverity = 'error' | 'warning';
interface Issue {
  severity: IssueSeverity;
  type: string;
  detail: string;
  autoFix: boolean;
  fixFn?: (text: string) => string;
}

const GRADE_VOCABULARY: Record<string, Record<string, { safe: string[]; warn: string[] }>> = {
  '小学': {
    '数学': { safe: ['加减乘除', '分数', '小数', '图形', '面积', '周长'], warn: ['方程', '负数', '代数', '几何证明', '函数', '坐标系', '概率', '统计图'] },
    '语文': { safe: ['识字', '写字', '阅读', '作文', '古诗'], warn: ['文言文', '议论文', '修辞手法', '语法分析', '文学鉴赏'] },
    '英语': { safe: ['单词', '句型', '对话', '歌谣'], warn: ['语法填空', '完形填空', '阅读理解长篇', '书面表达'] }
  },
  '初中': {
    '数学': { safe: ['一次函数', '二次函数', '勾股定理', '相似三角形', '一元二次方程', '圆', '统计'], warn: ['导数', '微积分', '对数函数', '复数', '向量', '矩阵', '概率密度'] },
    '物理': { safe: ['力学', '电学', '光学', '热学', '声学', '运动学'], warn: ['量子力学', '相对论', '核物理', '电磁波谱', '光电效应'] },
    '化学': { safe: ['元素周期表', '化学方程式', '酸碱盐', '金属', '溶液'], warn: ['有机化学', '电化学', '化学平衡', '晶体结构'] },
    '英语': { safe: ['完形填空', '阅读理解', '书面表达', '语法选择'], warn: ['学术英语', '科技英语', '商务英语'] }
  },
  '高中': {
    '数学': { safe: ['函数', '导数', '解析几何', '概率统计', '数列', '向量'], warn: ['泛函分析', '拓扑学', '数论', '微分几何'] },
    '物理': { safe: ['力学', '电磁学', '热学', '光学', '原子物理'], warn: ['量子场论', '广义相对论', '粒子物理'] },
    '化学': { safe: ['有机化学', '化学反应原理', '物质结构', '电化学'], warn: ['高分子化学', '核化学', '生物化学'] }
  }
};

export class HardRuleChecker {
  static check(content: string, parsedBlueprint: unknown[], subject: string, stage: string, grade: string, genType?: string, materialText?: string): Issue[] {
    // 🔧 防御：content 必须是非空字符串
    if (!content || typeof content !== 'string' || !content.trim()) return [];
    const issues: Issue[] = [];
    issues.push(...this.checkVocabulary(content, subject, stage, grade));
    issues.push(...this.checkFullwidthChars(content));
    issues.push(...this.checkAnswerCompleteness(content));
    if (parsedBlueprint && parsedBlueprint.length > 0) {
      issues.push(...this.checkQuestionCount(content, parsedBlueprint));
    }
    issues.push(...this.checkHTMLTags(content));
    // 🔧 genType 感知检查
    if (genType) {
      issues.push(...this.checkGenTypeSpecific(content, genType, parsedBlueprint));
    }
    // 🔧 新增：内容质量深度检查
    issues.push(...this.checkContentSubstance(content, genType || ''));
    // 🔧 新增：新课标核心素养术语命中率检查
    issues.push(...this.checkCurriculumCompetency(content, subject, stage));
    // 🔧 新增：学段适配内容深度检查
    issues.push(...this.checkStageDepth(content, stage, genType || ''));
    if (materialText) {
      issues.push(...this.checkContentRelevance(content, materialText, subject));
    }
    return issues;
  }

  static checkVocabulary(content: string, subject: string, stage: string, _grade: string): Issue[] {
    const issues: Issue[] = [];
    const gradeData = GRADE_VOCABULARY[stage]?.[subject];
    if (!gradeData?.warn) return issues;
    for (const word of gradeData.warn) {
      if (content.includes(word)) {
        issues.push({ severity: 'warning', type: '超纲词汇', detail: `发现可能超纲词汇："${word}"，请确认是否适用于${stage}${_grade}${subject}`, autoFix: false });
      }
    }
    return issues;
  }

  static checkFullwidthChars(content: string): Issue[] {
    const issues: Issue[] = [];
    const fullwidthNums = content.match(/[０-９]/g);
    if (fullwidthNums) {
      issues.push({
        severity: 'error', type: '格式错误',
        detail: `发现${fullwidthNums.length}个全角数字，应使用半角数字`,
        autoFix: true,
        fixFn: (text) => {
          const map: Record<string, string> = { '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9' };
          return text.replace(/[０-９]/g, c => map[c] || c);
        }
      });
    }
    if (/答案[：:]\s*略/.test(content)) {
      issues.push({ severity: 'warning', type: '答案不完整', detail: '答案标注为"略"，应提供完整答案', autoFix: false });
    }
    return issues;
  }

  static checkAnswerCompleteness(content: string): Issue[] {
    if (!content.includes('answer-section') && !content.includes('答案')) {
      return [{ severity: 'warning', type: '缺少答案', detail: '未检测到答案区域，建议补充答案和解析', autoFix: false }];
    }
    return [];
  }

  static checkQuestionCount(content: string, parsedBlueprint: unknown[]): Issue[] {
    const issues: Issue[] = [];
    // 🔧 放宽匹配：DeepSeek 云端输出的 HTML 结构不可控，匹配任意包含 question 的 class
    const questionMatches = content.match(/class="[^"]*question[^"]*"/gi);
    const actualCount = questionMatches ? questionMatches.length : 0;
    const expectedCount = parsedBlueprint.length;
    if (actualCount === 0) {
      // 🔧 降级为 warning：DeepSeek 输出可能使用不同的 CSS class（如 question-item / exam-question）
      // 不应因 class 名不匹配而阻断正常流程，真正的缺失会在后续答案检查中暴露
      issues.push({ severity: 'warning', type: '题目标记缺失', detail: '未检测到 class="question" 标记（DeepSeek输出可能使用其他class名），已跳过题目数量校验', autoFix: false });
    } else if (Math.abs(actualCount - expectedCount) > 2) {
      issues.push({ severity: 'warning', type: '题目数量不一致', detail: `蓝图规划${expectedCount}题，实际检测到${actualCount}题`, autoFix: false });
    }
    return issues;
  }

  static checkHTMLTags(content: string): Issue[] {
    const issues: Issue[] = [];
    const tags = ['div', 'p', 'table', 'ul', 'ol', 'h1', 'h2', 'h3'];
    for (const tag of tags) {
      const openCount = (content.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
      const closeCount = (content.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      if (openCount !== closeCount) {
        // 🔧 降级为 warning：LLM 生成的 HTML 偶有标签不平衡（如自闭合标签），不影响浏览器渲染
        // 不应因标签计数差异阻断正常流程
        issues.push({ severity: 'warning', type: 'HTML标签不平衡', detail: `<${tag}> 标签打开${openCount}次，关闭${closeCount}次（不影响渲染可忽略）`, autoFix: false });
      }
    }
    return issues;
  }

  static checkGenTypeSpecific(content: string, genType: string, parsedBlueprint: unknown[]): Issue[] {
    const issues: Issue[] = [];
    if (genType === 'exam') {
      // 考试卷：检查是否有分值标注
      const scoreMatches = content.match(/\(\d+分\)|（\d+分）/g);
      if (!scoreMatches || scoreMatches.length === 0) {
        issues.push({ severity: 'warning', type: '缺少分值', detail: '试卷未检测到分值标注，建议每道题标注分数', autoFix: false });
      }
    }
    if (genType === 'practice') {
      // 课时练：检查是否有层次结构标记
      const hasBasic = /基础|巩固/.test(content);
      const hasAdvanced = /提升|拓展|探究/.test(content);
      if (!hasBasic && !hasAdvanced) {
        issues.push({ severity: 'warning', type: '缺少分层', detail: '课时练建议包含基础巩固和能力提升两个层次', autoFix: false });
      }
    }
    if (genType === 'special') {
      // 专项训练：检查题型多样性（使用宽泛匹配）
      const questionTypes = content.match(/class="[^"]*question[^"]*"/gi);
      const typeCount = questionTypes ? questionTypes.length : 0;
      if (typeCount > 0 && parsedBlueprint && parsedBlueprint.length > 0 && typeCount < parsedBlueprint.length) {
        issues.push({ severity: 'warning', type: '题目数量偏差', detail: `专项训练蓝图规划${parsedBlueprint.length}题，实际检测到${typeCount}题`, autoFix: false });
      }
    }
    // 🔧 新增：6类资料类型专项检查
    if (genType === 'summary') {
      // 知识点总结：检查是否有表格或列表结构
      const hasTable = /<table[^>]*>/i.test(content);
      const hasList = /<[ou]l[^>]*>/i.test(content);
      const hasStrong = /<strong[^>]*>/i.test(content);
      if (!hasTable && !hasList) {
        issues.push({ severity: 'warning', type: '缺少结构化呈现', detail: '知识点总结建议使用表格或列表进行结构化呈现', autoFix: false });
      }
      if (!hasStrong) {
        issues.push({ severity: 'warning', type: '缺少重点标注', detail: '知识点总结建议用<strong>或★标注重点内容', autoFix: false });
      }
    }
    if (genType === 'errorbook') {
      // 错题本：检查是否有归因分析和变式练习
      const hasReason = /归因|错误原因|错因/.test(content);
      const hasVariant = /变式|巩固|举一反三/.test(content);
      if (!hasReason) {
        issues.push({ severity: 'warning', type: '缺少错误归因', detail: '错题本建议包含错误归因分析区域', autoFix: false });
      }
      if (!hasVariant) {
        issues.push({ severity: 'warning', type: '缺少变式练习', detail: '错题本建议每道错题配变式巩固练习', autoFix: false });
      }
      // 禁止笼统归因
      if (/粗心|不认真|不会做|不小心/.test(content)) {
        issues.push({ severity: 'warning', type: '归因过于笼统', detail: '检测到笼统归因词（粗心/不认真等），建议指向具体知识点或思维偏差', autoFix: false });
      }
    }
    if (genType === 'preview') {
      // 课前预习：检查是否有疑问板块
      const hasQuestion = /疑问|提问|问题|不懂/.test(content);
      if (!hasQuestion) {
        issues.push({ severity: 'warning', type: '缺少疑问板块', detail: '预习单建议设置"我的疑问"板块，引导学生记录问题', autoFix: false });
      }
    }
    if (genType === 'dictation') {
      // 默写：检查练习区是否可能泄露答案（检测answer-section之外的答案关键词）
      const bodyContent = content.replace(/<div class="answer-section"[^>]*>[\s\S]*?<\/div>/gi, '');
      const answerLikeInBody = /答案[：:]\s*[^\s<]/.test(bodyContent);
      if (answerLikeInBody) {
        issues.push({ severity: 'warning', type: '答案可能泄露', detail: '默写练习区可能包含答案内容，练习区应只保留提示信息', autoFix: false });
      }
    }
    if (genType === 'reading') {
      // 阅读训练：检查是否有分层设问关键词
      const hasExtract = /提取|找出|文中|根据/.test(content);
      const hasInfer = /推断|推测|认为|原因/.test(content);
      const hasEvaluate = /评价|赏析|看法|观点/.test(content);
      const layerCount = [hasExtract, hasInfer, hasEvaluate].filter(Boolean).length;
      if (layerCount < 2) {
        issues.push({ severity: 'warning', type: '设问层级不足', detail: `阅读训练仅覆盖${layerCount}个能力层级（建议信息提取→推断解释→评价反思三层全覆盖）`, autoFix: false });
      }
    }
    if (genType === 'review') {
      // 复习：检查是否有综合自测和易错辨析
      const hasSelfTest = /自测|检测|练习|闯关/.test(content);
      const hasErrorAnalysis = /易错|辨析|误区|注意/.test(content);
      if (!hasSelfTest) {
        issues.push({ severity: 'warning', type: '缺少综合自测', detail: '复习资料建议包含综合自测板块', autoFix: false });
      }
      if (!hasErrorAnalysis) {
        issues.push({ severity: 'warning', type: '缺少易错辨析', detail: '复习资料建议包含易错点辨析', autoFix: false });
      }
      // 🔧 增强：检查知识梳理是否结构化
      const hasTable = /<table[^>]*>/i.test(content);
      const hasList = /<[ou]l[^>]*>/i.test(content);
      const hasStrongOrStar = /<strong[^>]*>|★|☆|⭐/i.test(content);
      if (!hasTable && !hasList) {
        issues.push({ severity: 'warning', type: '知识梳理缺少结构化', detail: '复习资料的知识梳理建议使用表格或列表进行结构化呈现（如对比表格/思维导图）', autoFix: false });
      }
      if (!hasStrongOrStar) {
        issues.push({ severity: 'warning', type: '缺少重难点标注', detail: '复习资料建议用<strong>加粗或★标注重难点和易错点', autoFix: false });
      }
      // 🔧 增强：检查典型题析数量（至少应有3道以上典型题）
      const typicalProblemMatches = content.match(/典型题|例题|典例|题析/g);
      const typicalCount = typicalProblemMatches ? typicalProblemMatches.length : 0;
      if (typicalCount < 3) {
        issues.push({ severity: 'warning', type: '典型题析数量不足', detail: `复习资料仅检测到${typicalCount}处典型题/例题标记，建议至少包含3道典型题并配完整解析`, autoFix: false });
      }
      // 🔧 增强：检查是否有知识框架/体系构建标记
      const hasFramework = /知识框架|知识网络|思维导图|知识树|知识地图|体系构建|专题整合/.test(content);
      if (!hasFramework) {
        issues.push({ severity: 'warning', type: '缺少知识框架', detail: '复习资料建议包含知识框架/思维导图/专题整合等知识体系构建内容', autoFix: false });
      }
    }
    return issues;
  }

  /**
   * 🔧 新增：内容充实度检查 — 检测空洞/敷衍内容
   */
  static checkContentSubstance(content: string, genType: string): Issue[] {
    const issues: Issue[] = [];

    // 1. 最小长度检查（按资料类型）
    const minLengths: Record<string, number> = {
      exam: 3000, practice: 2000, preview: 1500,
      reading: 2000, summary: 1500, dictation: 1000,
      special: 2000, errorbook: 1500, review: 2000,
    };
    const minLen = minLengths[genType] || 1500;
    if (content.length < minLen) {
      issues.push({
        severity: 'error', type: '内容过短',
        detail: `生成内容仅${content.length}字符，少于${genType}类型最低要求${minLen}字符`,
        autoFix: true,
      });
    }

    // 2. 题目/段落块数量检查
    const questionBlocks = content.match(/<(?:p|div|li)\s+class="[^"]*question[^"]*"[^>]*>/gi) || [];
    const headingBlocks = content.match(/<h[1-4][^>]*>/gi) || [];
    const paragraphBlocks = content.match(/<p[^>]*>/gi) || [];

    if (genType === 'exam' && questionBlocks.length < 5) {
      issues.push({
        severity: 'warning', type: '题目数量不足',
        detail: `试卷仅检测到${questionBlocks.length}道题目标记题目，可能内容空洞`,
        autoFix: false,
      });
    }

    // 3. 结构完整性检查（至少有一个 heading 引导）
    if (headingBlocks.length === 0 && content.length > 500) {
      issues.push({
        severity: 'warning', type: '缺少结构',
        detail: '生成内容无标题标签（h1-h4），缺乏清晰的层次结构',
        autoFix: false,
      });
    }

    // 4. 重复内容检测（大段重复 = 糊弄）
    // 🔧 优化：先剥离HTML标签，按句号/分号分句后再去重，避免HTML结构行误判
    const cleanText = content
      .replace(/<[^>]+>/g, '')           // 剥离所有HTML标签
      .replace(/&[a-z]+;/gi, ' ')        // 剥离HTML实体
      .replace(/\s+/g, ' ')               // 合并空白为单空格
      .trim();

    // 按中文标点分句（。！？；）
    const sentences = cleanText.split(/[。！？；\n]/).filter(s => s.trim().length > 15);
    const uniqueSentences = new Set(sentences.map(s => s.trim().slice(0, 80)));

    if (sentences.length > 10 && uniqueSentences.size / sentences.length < 0.5) {
      issues.push({
        severity: 'error', type: '内容高度重复',
        detail: `生成内容去标签后${sentences.length}个句子仅有${uniqueSentences.size}句不重复（去重率${Math.round(uniqueSentences.size / sentences.length * 100)}%），可能AI在糊弄`,
        autoFix: true,
      });
    }

    return issues;
  }

  /**
   * 🔧 新增：教材相关性检查 — 检测生成内容是否与教材原文相关
   */
  static checkContentRelevance(content: string, materialText: string, subject: string): Issue[] {
    const issues: Issue[] = [];
    if (!materialText || materialText.length < 100) return issues;

    // 从教材原文中提取关键术语（排除常见停用词）
    const stopWords = new Set(['的', '了', '在', '是', '有', '和', '就', '都', '一', '不', '也', '要', '会', '可', '过', '对', '把', '能', '去', '没', '看', '说', '想', '做', '到', '这', '那', '很', '吗', '呢', '啊', '吧', '哦', '哈', '嗯']);
    const materialTerms = new Set<string>();
    // 提取教材中出现的关键词（长度≥2的中文词，非停用词）
    const termMatches = materialText.match(/[\u4e00-\u9fff]{2,6}/g) || [];
    for (const term of termMatches) {
      if (!stopWords.has(term) && term.length >= 2) {
        materialTerms.add(term);
      }
    }

    if (materialTerms.size === 0) return issues;

    // 统计生成内容中出现了多少教材术语
    let matchCount = 0;
    const contentClean = content.replace(/<[^>]+>/g, ''); // 去掉HTML标签
    for (const term of materialTerms) {
      if (contentClean.includes(term)) matchCount++;
    }

    // 覆盖率阈值：前200个教材术语中，至少20%在生成内容中出现
    const topTerms = [...materialTerms].slice(0, 200);
    const coverage = topTerms.length > 0 ? matchCount / topTerms.length : 0;

    if (coverage < 0.1 && topTerms.length > 20) {
      issues.push({
        severity: 'error', type: '教材相关性极低',
        detail: `生成内容与教材原文的术语重叠率仅${Math.round(coverage * 100)}%（${matchCount}/${topTerms.length}个关键术语），内容可能脱离教材`,
        autoFix: true,
      });
    } else if (coverage < 0.2 && topTerms.length > 20) {
      issues.push({
        severity: 'warning', type: '教材相关性偏低',
        detail: `生成内容与教材原文的术语重叠率为${Math.round(coverage * 100)}%（${matchCount}/${topTerms.length}），建议检查是否包含教材无关内容`,
        autoFix: false,
      });
    }

    // 额外检查：教材中特有的专有名词（人名、地名、概念名等）
    const properNouns = (materialText.match(/《[^》]+》/g) || []).map(n => n.replace(/[《》]/g, ''));
    const missingNouns: string[] = [];
    for (const noun of properNouns) {
      if (noun.length >= 3 && !contentClean.includes(noun)) {
        missingNouns.push(noun);
      }
    }
    if (missingNouns.length >= 3) {
      issues.push({
        severity: 'warning', type: '教材专有名词缺失',
        detail: `教材中${missingNouns.length}个专有名词未在生成内容中出现：${missingNouns.slice(0, 5).join('、')}${missingNouns.length > 5 ? '等' : ''}`,
        autoFix: false,
      });
    }

    return issues;
  }

  /**
   * 🔧 新增：新课标核心素养术语命中率检查
   * 检查生成内容是否使用了该学科该学段对应的核心素养关键词
   */
  static checkCurriculumCompetency(content: string, subject: string, stage: string): Issue[] {
    const issues: Issue[] = [];
    // 课标核心素养关键词映射（2022版）
    const COMPETENCY_TERMS: Record<string, Record<string, string[]>> = {
      '语文': {
        primary: ['识字与写字', '阅读与鉴赏', '表达与交流', '梳理与探究', '文化自信', '语言运用', '思维能力', '审美创造'],
        middle: ['语言积累', '阅读与鉴赏', '表达与交流', '梳理与探究', '整本书阅读', '思辨性阅读', '文学鉴赏'],
        high: ['语言建构', '思维发展', '审美鉴赏', '文化传承', '学习任务群', '思辨读写', '专题研习'],
      },
      '数学': {
        primary: ['数感', '量感', '运算能力', '空间观念', '几何直观', '数据意识', '模型意识', '应用意识', '创新意识'],
        middle: ['抽象能力', '运算能力', '几何直观', '空间观念', '推理能力', '数据观念', '模型观念', '应用意识', '创新意识'],
        high: ['数学抽象', '逻辑推理', '数学建模', '直观想象', '数学运算', '数据分析', '核心素养'],
      },
      '英语': {
        primary: ['语言能力', '文化意识', '思维品质', '学习能力', '听说', '读写', '语篇'],
        middle: ['语言能力', '文化意识', '思维品质', '学习能力', '语篇理解', '跨文化交际'],
        high: ['语言能力', '文化意识', '思维品质', '学习能力', '批判性思维', '学术素养'],
      },
      '物理': {
        middle: ['物理观念', '科学思维', '科学探究', '科学态度', '模型建构', '实验'],
        high: ['物理观念', '科学思维', '科学探究', '科学态度', '模型建构', '科学论证', '质疑创新'],
      },
      '化学': {
        middle: ['化学观念', '科学思维', '科学探究', '科学态度', '实验', '微观探析'],
        high: ['宏观辨识', '微观探析', '变化观念', '平衡思想', '证据推理', '模型认知', '科学探究', '创新意识'],
      },
      '生物': {
        middle: ['生命观念', '科学思维', '科学探究', '社会责任', '结构与功能', '进化与适应'],
        high: ['生命观念', '科学思维', '科学探究', '社会责任', '稳态与平衡', '进化与适应观'],
      },
      '历史': {
        middle: ['唯物史观', '时空观念', '史料实证', '历史解释', '家国情怀', '时序'],
        high: ['唯物史观', '时空观念', '史料实证', '历史解释', '家国情怀', '历史论述'],
      },
      '地理': {
        middle: ['人地协调观', '综合思维', '区域认知', '地理实践力', '空间定位'],
        high: ['人地协调观', '综合思维', '区域认知', '地理实践力', '区域比较'],
      },
      '道德与法治': {
        middle: ['政治认同', '道德修养', '法治观念', '健全人格', '责任意识', '公共参与'],
      },
      '思想政治': {
        high: ['政治认同', '科学精神', '法治意识', '公共参与', '辩证思维'],
      },
    };

    // 找到匹配的学科和学段
    let stageKey = '';
    if (stage.startsWith('primary')) stageKey = 'primary';
    else if (stage === 'middle') stageKey = 'middle';
    else if (stage === 'high') stageKey = 'high';

    // 道德与法治/思想政治 特殊处理
    let subjectKey = subject;
    if (subject === '政治' || subject === '道德与法治') {
      subjectKey = stage === 'high' ? '思想政治' : '道德与法治';
    }

    const terms = COMPETENCY_TERMS[subjectKey]?.[stageKey];
    if (!terms || terms.length === 0) return issues;

    const cleanContent = content.replace(/<[^>]+>/g, '');
    let hitCount = 0;
    const missed: string[] = [];
    for (const term of terms) {
      if (cleanContent.includes(term)) {
        hitCount++;
      } else {
        missed.push(term);
      }
    }

    const hitRate = hitCount / terms.length;
    if (hitRate < 0.3) {
      issues.push({
        severity: 'warning', type: '核心素养术语命中率过低',
        detail: `生成内容中${subject}${stageKey}学段核心素养术语命中率仅${Math.round(hitRate * 100)}%（${hitCount}/${terms.length}），缺失：${missed.join('、')}。建议检查是否体现新课标核心素养导向`,
        autoFix: false,
      });
    }

    return issues;
  }

  /**
   * 🔧 新增：学段适配内容深度检查
   * 反向检查：低学段不应出现高学段概念，高学段不应过于浅显
   */
  static checkStageDepth(content: string, stage: string, genType: string): Issue[] {
    const issues: Issue[] = [];
    const cleanContent = content.replace(/<[^>]+>/g, '');

    // 小学低段禁止出现中学概念
    if (stage === 'primary_low' || stage === 'primary_mid') {
      const forbiddenPatterns = [
        /证明|推导|定理|公理|方程式|函数/g,
        /论点|论据|论证|议论文|修辞手法/g,
        /完形填空|语法填空|书面表达/g,
      ];
      for (const pattern of forbiddenPatterns) {
        const matches = cleanContent.match(pattern);
        if (matches && matches.length >= 3) {
          issues.push({
            severity: 'warning', type: '学段内容超纲',
            detail: `小学${stage.includes('low') ? '低' : '中'}段内容中出现"${matches[0]}"等高学段概念（共${matches.length}处），请确认是否适合该学段学生`,
            autoFix: false,
          });
          break; // 只报告第一个超纲模式
        }
      }
    }

    // 高中内容不应过于浅显（仅对 exam/practice/special 等命题类做检查）
    if (stage === 'high' && ['exam', 'practice', 'special', 'review'].includes(genType)) {
      const depthIndicators = [
        /分析|评价|论证|探究|综合|批判|创新|建模/g,
      ];
      let depthScore = 0;
      for (const pattern of depthIndicators) {
        const matches = cleanContent.match(pattern);
        if (matches) depthScore += matches.length;
      }
      // 高中命题类内容，高层次认知动词应≥8个（约1000字/个）
      if (cleanContent.length > 1000 && depthScore < 5) {
        issues.push({
          severity: 'warning', type: '内容深度不足',
          detail: `高中${genType}类型内容仅检测到${depthScore}处高层次认知活动标记（分析/评价/论证/探究等），可能过于浅显不符合高中学段要求`,
          autoFix: false,
        });
      }
    }

    return issues;
  }

  static autoFix(content: string, issues: Issue[]): string {
    let fixed = content;
    for (const issue of issues) {
      if (issue.autoFix && issue.fixFn) fixed = issue.fixFn(fixed);
    }
    return fixed;
  }

  static getIssueSummary(issues: Issue[]): { total: number; errors: number; warnings: number; hasErrors: boolean; hasWarnings: boolean } {
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    return { total: issues.length, errors, warnings, hasErrors: errors > 0, hasWarnings: warnings > 0 };
  }

  /**
   * 🔧 分类问题：哪些是规则可自动修复的，哪些需要AI二次修复
   */
  static classifyIssues(issues: Issue[]): { autoFixable: Issue[]; needAiFix: Issue[] } {
    return {
      autoFixable: issues.filter(i => i.autoFix && i.fixFn),
      needAiFix: issues.filter(i => i.autoFix && !i.fixFn),
    };
  }

  /**
   * 🔧 筛选需要触发AI修复的问题
   * 规则：error 级别且无 auto-fix + 关键 warning（缺少答案/结构/内容空洞）
   * 排除：超纲词汇、HTML标签平衡等非内容性警告
   */
  static getRepairableIssues(issues: Issue[], genType: string): Issue[] {
    const repairable: Issue[] = [];
    for (const issue of issues) {
      // Error 级别且无 fixFn → 必须AI修复
      if (issue.severity === 'error' && !issue.fixFn) {
        repairable.push(issue);
        continue;
      }
      // 关键 warning：缺少答案区域（对 exam/practice/special 致命）
      if (issue.type === '缺少答案' && ['exam', 'practice', 'special', 'errorbook'].includes(genType)) {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：内容缺少结构（无标题）
      if (issue.type === '缺少结构') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：缺少分层（practice 课时练必需）
      if (issue.type === '缺少分层' && genType === 'practice') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：缺少分值（exam 试卷必需）
      if (issue.type === '缺少分值' && genType === 'exam') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：缺少结构化呈现（summary/review 知识类）
      if (issue.type === '缺少结构化呈现' && ['summary', 'review'].includes(genType)) {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
    }
    return repairable;
  }

  /**
   * 🔧 构建针对性的AI修复prompt（精简，仅包含问题+原始内容+修复指令）
   */
  static buildRepairPrompt(
    content: string,
    repairableIssues: Issue[],
    context: { genType?: string; genTypeLabel?: string; subject?: string; stage?: string; grade?: string; materialText?: string }
  ): string {
    const issuesList = repairableIssues.map((i, idx) =>
      `${idx + 1}. [${i.type}] ${i.detail}`
    ).join('\n');

    const genTypeLabel = context.genTypeLabel || context.genType || '资料';
    const subjectStr = context.subject ? `，学科：${context.subject}` : '';
    const stageStr = context.stage ? `，学段：${context.stage}` : '';

    let prompt = `【修复任务】\n`;
    prompt += `你生成的${genTypeLabel}（${context.genType || ''}）质检发现了以下问题，请针对性修复：\n\n`;
    prompt += `【需修复的问题】\n${issuesList}\n\n`;

    // 根据问题类型给出具体修复指引
    const issueTypes = repairableIssues.map(i => i.type);
    if (issueTypes.includes('内容过短')) {
      prompt += `→ 内容长度不足，请扩充题目数量、增加解析详实度，至少扩充到${context.genType === 'exam' ? '3000' : '2000'}字符以上。\n`;
    }
    if (issueTypes.includes('内容高度重复')) {
      prompt += `→ 存在大量重复句子，请逐题重新组织语言，确保每题表述独立、不套用模板句式。\n`;
    }
    if (issueTypes.includes('教材相关性极低') || issueTypes.includes('教材相关性偏低')) {
      prompt += `→ 内容与教材脱节，请重新生成时紧密围绕教材知识点，使用教材中的核心术语和概念。\n`;
      if (context.materialText) {
        const excerpt = context.materialText.slice(0, 800);
        prompt += `→ 参考教材内容片段：${excerpt}\n`;
      }
    }
    if (issueTypes.includes('缺少答案')) {
      prompt += `→ 缺少答案区域，请在文末添加 <div class="answer-section">...</div> 包含每题答案和简要解析。\n`;
    }
    if (issueTypes.includes('缺少结构')) {
      prompt += `→ 缺乏标题层次，请添加 h2/h3 标题组织内容结构（如"一、基础巩固""二、能力提升"等）。\n`;
    }
    if (issueTypes.includes('缺少分层')) {
      prompt += `→ 课时练需分层设计，请划分为"基础巩固"和"能力提升"两大板块。\n`;
    }
    if (issueTypes.includes('缺少分值')) {
      prompt += `→ 试卷缺少分值标注，请为每道大题/小题标注分值，如"（本题10分）"。\n`;
    }
    if (issueTypes.includes('缺少结构化呈现')) {
      prompt += `→ 建议使用 <table> 或 <ul>/<ol> 对知识内容进行结构化呈现，并用 <strong> 标注重点。\n`;
    }

    prompt += `\n【原始内容】\n${content}\n\n`;
    prompt += `【修复要求】\n`;
    prompt += `1. 仅修复上述具体问题，严格保留其他正确内容不变\n`;
    prompt += `2. 保持原有HTML结构、CSS类名、填空格式（<u class="blank-N">）\n`;
    prompt += `3. 直接返回修复后的完整HTML，不要加任何解释说明\n`;
    prompt += `4. 确保修复后内容为一份完整可用的${genTypeLabel}`;

    return prompt;
  }
}

// ═══════════════════════════════════════
// AI 语义审查器 —— 调用 LLM 通读全文，抓语病/错字/逻辑矛盾
// ═══════════════════════════════════════
export class AISemanticReviewer {
  /**
   * 构建语义审查 prompt——四个维度：语病、错字、逻辑、歧义
   */
  static buildReviewPrompt(content: string, context: {
    genType?: string; genTypeLabel?: string; subject?: string; stage?: string; grade?: string;
  }): string {
    // 去 HTML 标签取纯文本，截断到 6000 字控制 token 消耗
    const cleanText = content
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s{2,}/g, '\n')
      .trim();
    const truncated = cleanText.length > 6000
      ? cleanText.slice(0, 6000) + '\n\n[... 后续内容已截断，仅审查以上部分 ...]'
      : cleanText;

    const label = context.genTypeLabel || context.genType || '资料';
    const meta = [context.subject, context.grade, context.stage].filter(Boolean).join('·');

    return `【语义审查任务】
请通读以下${label}内容（${meta}），从四个维度逐一检查：

1. **语句通顺性**：是否有读不通的句子、词语搭配不当、AI生成的文字拼接错误？
   特别注意：两个正确汉字错误拼接的情况——如"说明"+"文中的"→"说明文"，"可以"+"能"→"可能以"等。
   
2. **错别字/冗余字**：是否有明显的错别字、多余字、漏字？
   排查重点：同音错字（在/再、的/地/得、哪/那）、形近错字、AI幻觉造词。

3. **逻辑一致性**：
   - 选项是否互斥且无重叠？
   - 答案和解析是否自相矛盾？
   - 题目分值加总是否正确？
   - 阅读理解题的答案是否确实能在原文中找到依据？

4. **表述清晰度**：
   - 题目问法是否有歧义？
   - 学生能否准确理解题意？
   - 是否存在"说了等于没说"的空洞表述？

【审查要求】
- 只报告确实有问题的条目，若内容整体良好则回复"✅ 未发现语义问题"
- 每个问题格式：【位置】引用原文片段 → 【问题类型】通顺性/错别字/逻辑/歧义 → 【问题描述】一句话说明
- 不要修改内容，不要给出修复建议
- 不要报告格式/排版/HTML标签问题（另有机检处理）
- 最多报告10处问题，按严重程度排序

【待审查内容】
${truncated}`;
  }

  /**
   * 解析审查结果
   */
  static parseReviewResult(rawResponse: string): {
    hasIssues: boolean;
    issues: string[];
    summary: string;
  } {
    if (!rawResponse || rawResponse.trim().length === 0) {
      return { hasIssues: false, issues: [], summary: '审查无响应' };
    }

    // 通过标记
    if (/未发现.*问题|无.*问题|没有.*问题|内容.*良好|无明显.*问题|^✅/.test(rawResponse.trim())) {
      return { hasIssues: false, issues: [], summary: '✅ AI语义审查通过' };
    }

    // 提取问题行：以【位置】开头或以数字序号开头的行
    const lines = rawResponse.split(/\n/);
    const issueLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // 匹配 【位置】... 或 1. ... 或 1、... 开头的行
      if (/^【位置】|^\d+[\.\、\)]/.test(trimmed) || /【问题类型】|【问题描述】/.test(trimmed)) {
        issueLines.push(trimmed);
      }
    }

    // 如果没有解析出结构化行，但有内容，则整体作为一条摘要
    if (issueLines.length === 0 && rawResponse.trim().length > 10) {
      return {
        hasIssues: true,
        issues: [rawResponse.trim().slice(0, 500)],
        summary: '⚠️ AI语义审查发现问题（详见列表）',
      };
    }

    // 将问题行按3行一组（位置+类型+描述）合并
    const grouped: string[] = [];
    let current = '';
    for (const line of issueLines) {
      if (/^【位置】|^\d+[\.\、\)]/.test(line)) {
        if (current) grouped.push(current);
        current = line;
      } else {
        current += ' ' + line;
      }
    }
    if (current) grouped.push(current);

    return {
      hasIssues: grouped.length > 0,
      issues: grouped.length > 0 ? grouped : [rawResponse.trim().slice(0, 500)],
      summary: grouped.length > 0
        ? `⚠️ AI语义审查发现 ${grouped.length} 处潜在问题`
        : '⚠️ AI语义审查发现问题（详见列表）',
    };
  }
}

export { GRADE_VOCABULARY };
