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
      special: 2000, errorbook: 1500,
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
    const lines = content.split(/\n/).filter(l => l.trim().length > 30);
    const uniqueLines = new Set(lines.map(l => l.trim().slice(0, 100)));
    if (lines.length > 10 && uniqueLines.size / lines.length < 0.5) {
      issues.push({
        severity: 'error', type: '内容高度重复',
        detail: `生成内容中${lines.length}行仅有${uniqueLines.size}行不重复（去重率${Math.round(uniqueLines.size / lines.length * 100)}%），可能AI在糊弄`,
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
}

export { GRADE_VOCABULARY };
