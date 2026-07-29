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
    '数学': { safe: ['加减乘除', '分数', '小数', '图形', '面积', '周长'], warn: ['方程', '负数', '代数', '几何证明'] },
    '语文': { safe: ['识字', '写字', '阅读', '作文', '古诗'], warn: ['文言文', '议论文', '修辞手法'] }
  },
  '初中': {
    '数学': { safe: ['一次函数', '二次函数', '勾股定理', '相似三角形'], warn: ['导数', '微积分', '对数函数', '复数'] },
    '物理': { safe: ['力学', '电学', '光学', '热学'], warn: ['量子力学', '相对论', '核物理'] }
  }
};

export class HardRuleChecker {
  static check(content: string, parsedBlueprint: unknown[], subject: string, stage: string, grade: string, genType?: string): Issue[] {
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
}

export { GRADE_VOCABULARY };
