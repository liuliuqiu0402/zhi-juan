import { getExamBlueprint } from '../config/examPaperBlueprints';

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

/** 🔴 三重硬核扫描维度归类表：issue type → 查重/查错/查规范（未列入的 type 默认归查规范） */
const TRIPLE_SCAN_CLASSIFY: Record<string, 'duplication' | 'error' | 'standard'> = {
  // ── 查重：重复内容/相似题/知识点重复 ──
  '存在重复题目': 'duplication', '知识点重复考查': 'duplication', '内容高度重复': 'duplication', '疑似相似题': 'duplication',
  // ── 查错：内容错误/格式错误/事实性错误 ──
  '格式错误': 'error', '答案不完整': 'error', '超纲词汇': 'error', 'HTML标签不平衡': 'error',
  '答案泄露': 'error', '标点配对异常': 'error', '拼音未标调': 'error', '分值体系异常': 'error',
  '学段内容超纲': 'error', '教材相关性极低': 'error', '教材相关性偏低': 'error', '教材专有名词缺失': 'error',
  '内容深度不足': 'error', '答案可能泄露': 'error', '归因过于笼统': 'error',
  '思维深度不足': 'error', '缺乏高阶思维题': 'standard',
  '连线题格式不规范': 'standard', '写话格格式不规范': 'standard',
};

/** 🔴 含题目的资料类型：语义审查"题目质量专项"适用 */
const QUESTION_GEN_TYPES = ['exam', 'practice', 'special', 'review', 'dictation', 'preview', 'reading', 'errorbook'];

export class HardRuleChecker {
  static check(content: string, parsedBlueprint: unknown[], subject: string, stage: string, grade: string, genType?: string, materialText?: string): Issue[] {
    // 🔧 防御：content 必须是非空字符串
    if (!content || typeof content !== 'string' || !content.trim()) return [];
    const issues: Issue[] = [];
    issues.push(...this.checkVocabulary(content, subject, stage, grade));
    issues.push(...this.checkFullwidthChars(content));
    issues.push(...this.checkAnswerCompleteness(content));
    // 🔴 三重硬核扫描·查错：标点配对检测
    issues.push(...this.checkBracketBalance(content));
    if (parsedBlueprint && parsedBlueprint.length > 0) {
      issues.push(...this.checkQuestionCount(content, parsedBlueprint));
    }
    issues.push(...this.checkHTMLTags(content));
    // 🔧 文字拼接错误机检（"说明"误写为"说明文"等合法词汇错用，AI语义审查漏网的兜底）
    issues.push(...this.checkStitchedWords(content));
    // 🔴 三重硬核扫描·查错：填空空标签 / 选择题缺选项 / 答案区空内容（全类型，零/低误报）
    issues.push(...this.checkBlankEmptyTags(content));
    issues.push(...this.checkChoiceOptionsMissing(content));
    issues.push(...this.checkAnswerSectionEmpty(content));
    // 🔧 genType 感知检查
    if (genType) {
      issues.push(...this.checkGenTypeSpecific(content, genType, parsedBlueprint));
    }
    // 🔧 分数层级一致性（exam 卷面规范）：同分大题算术 + 大题之和=满分
    if (genType === 'exam') {
      issues.push(...this.checkScoreConsistency(content));
    }
    // 🔧 新增：内容质量深度检查
    issues.push(...this.checkContentSubstance(content, genType || ''));
    // 🔧 新增：新课标核心素养术语命中率检查
    //    exam 豁免：正式考卷卷面不印素养术语（低段分题型卷/中高段板块卷均不出现），
    //    素养导向体现在题目情境化设计与设问层级，术语命中率对考卷是误报
    if (genType !== 'exam') {
      issues.push(...this.checkCurriculumCompetency(content, subject, stage));
    }
    // 🔧 新增：学段适配内容深度检查
    issues.push(...this.checkStageDepth(content, stage, genType || ''));
    // 🔴 三重硬核扫描·查错：答案泄露检测（组词题/看拼音题，练习/听写/复习等全类型适用）
    issues.push(...this.checkAnswerLeak(content));
    // 🔴 真题卷根治：exam 成品卷面结构校验（蓝本对齐）
    if (genType === 'exam') {
      // 学段规范化：stage 可能是中文（小学/初中/高中）或英文；小学需按年级细分低/中/高段
      const stageKey = ({ '小学': 'primary', '初中': 'middle', '高中': 'high' } as Record<string, string>)[stage] || stage;
      const gradeNum = parseInt(String(grade || '').match(/\d+/)?.[0] || '0', 10);
      let stageSeg = stageKey;
      if (stageKey === 'primary') {
        stageSeg = gradeNum <= 2 ? 'primary_low' : gradeNum <= 4 ? 'primary_mid' : 'primary_high';
      }
      const examBlueprint = getExamBlueprint(subject, stageSeg);
      issues.push(...this.checkExamPaperStandard(content, examBlueprint));
      // 🔧 卷面规范：每大题"得分：＿＿"栏缺失检查（低段分题型卷可省略）
      issues.push(...this.checkScoreColumns(content, stageSeg));
    }
    // 🔧 非考卷资料轻量质检：卷首标题缺失检查（正式资料应有规范标题）
    if (genType && genType !== 'exam') {
      issues.push(...this.checkDocTitle(content));
    }
    if (materialText) {
      issues.push(...this.checkContentRelevance(content, materialText, subject));
    }
    return issues;
  }

  /**
   * 🔧 卷面规范：每大题标题行右端"得分：＿＿"栏（蓝本要求；低段分题型卷可省略）
   * 统计带分值标注的大题数量，与"得分：＿＿"栏数量比对，缺失给 warning（不阻断生成）
   */
  static checkScoreColumns(content: string, stageSeg: string): Issue[] {
    const issues: Issue[] = [];
    if (stageSeg === 'primary_low') return issues;
    // 大题标题：行首"一、"或"（一）"等 + 括号分值（如"（10分）""（每题2分，共20分）"）
    const sectionRe = /^[（(]?[一二三四五六七八九十]+[）)、][^\n]*?[（(]\s*\d+\s*分/gm;
    const sectionCount = (content.match(sectionRe) || []).length;
    if (sectionCount === 0) return issues; // 无分值标注（分题型卷等），跳过
    const scoreColCount = (content.match(/得分[:：]＿+/g) || []).length;
    if (scoreColCount < sectionCount) {
      issues.push({
        severity: 'warning',
        type: '得分栏缺失',
        detail: `检测到 ${sectionCount} 个大题带分值标注，但仅有 ${scoreColCount} 处"得分：＿＿"栏。正规试卷每个大题标题行右端应设"得分：＿＿"栏（低段除外），请检查补全。`,
        autoFix: false,
      });
    }
    return issues;
  }

  /**
   * 🔧 非考卷资料轻量质检：卷首标题缺失检查（正式资料应有规范标题）
   * 命中任一形态即通过：h1-h3 标签 / 首行短标题（≤35 字且非句尾标点/编号行）
   */
  static checkDocTitle(content: string): Issue[] {
    const issues: Issue[] = [];
    if (!content || content.length < 200) return issues; // 过短内容不判定
    if (/<h[1-3][\s>]/i.test(content)) return issues;
    const firstLine = content.replace(/<[^>]+>/g, '').split('\n').map(s => s.trim()).find(Boolean) || '';
    const looksTitle = firstLine.length > 0 && firstLine.length <= 35
      && !/[。！？；，]$/.test(firstLine) && !/^\d+[、.)]/.test(firstLine) && !/^[（(]?[一二三四五六七八九十]+[）)、]/.test(firstLine);
    if (!looksTitle) {
      issues.push({
        severity: 'warning',
        type: '卷首标题缺失',
        detail: '未检测到卷首标题（h1/h2 或首行标题）。正式资料建议以规范标题开头（如"XX课时练""XX知识点总结"），便于归档与阅读。',
        autoFix: false,
      });
    }
    return issues;
  }

  /**
   * 🔧 文字拼接错误机检：模型把动词"说明"误写为文体名词"说明文"（如"说明文松柏""说明文他们"）
   * 背景："说明文"本身是合法词汇，语义审查偶发漏报，故机检兜底——
   *   仅当"说明文"后紧跟非法搭配字（主语/动词开头）时判定为拼接错误
   */
  static checkStitchedWords(content: string): Issue[] {
    const issues: Issue[] = [];
    // 合法后接字：标点、量词、助词、介词等"说明文"作名词时的正常搭配
    // 🔧 v43: 移除代词"我你他她它"——"说明文+代词"几乎都是"说明+代词"的拼接错误
    //   如"说明文他们起早贪黑"应为"说明他们起早贪黑"，"说明文农民"应为"说明农民"
    const LEGAL_NEXT = '是一二三四五六七八九十两几第篇章段这那吗呢啊吧的与和或等及中里上下的了在将把被对从向给跟为因由写教读背练学考测习选';
    const re = /说明文(?=[\u4e00-\u9fa5])/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const next = content[m.index + 3];
      if (next && !LEGAL_NEXT.includes(next)) {
        const ctx = content.slice(Math.max(0, m.index - 10), m.index + 15).replace(/\s+/g, ' ');
        issues.push({
          severity: 'warning', type: '文字拼接错误',
          detail: '疑似"说明"误写为"说明文"（上下文："…' + ctx + '…"），应改为"说明"',
          autoFix: false,
        });
      }
    }
    return issues;
  }

  /**
   * 🔴 三重硬核扫描·查错：填空空标签检测（全类型适用）
   * 指令要求"标签内必须有&emsp;"。🔧 已支持自动修复：检测到空白标签自动补 &emsp;
   *（按 class N 映射宽度），无需人工处理；修复后 warning 不再出现
   */
  static checkBlankEmptyTags(content: string): Issue[] {
    const issues: Issue[] = [];
    const re = /<(u|span)\s+class="blank-\d+"[^>]*>\s*<\/(?:u|span)>/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const ctx = content.slice(Math.max(0, m.index - 18), m.index + 28).replace(/\s+/g, ' ');
      issues.push({
        severity: 'warning', type: '填空空标签',
        detail: '检测到填空标签内为空白（无&emsp;），已自动补入 &emsp;：…' + ctx + '…',
        autoFix: true,
        fixFn: (c: string) => c.replace(/<(u|span)\s+class="blank-(\d+)"[^>]*>\s*<\/(?:u|span)>/g, (_, tag, n) => {
          const cnt = Math.max(1, Math.ceil((parseInt(n) || 2) / 2));
          return `<${tag} class="blank-${n}">${'&emsp;'.repeat(cnt)}</${tag}>`;
        }),
      });
    }
    return issues;
  }

  /**
   * 🔴 三重硬核扫描·查错：选择题选项缺失检测（全类型适用）
   * 按 <p class="question"> 逐题切块：题干含选择题典型措辞但题后无 ≥2 个选项行 → 退稿
   */
  static checkChoiceOptionsMissing(content: string): Issue[] {
    const issues: Issue[] = [];
    const body = content.replace(/<div[^>]*class="answer-section"[^>]*>[\s\S]*$/i, '');
    const questionBlocks = body.split(/<p class="question">/i).slice(1);
    if (questionBlocks.length === 0) return issues;
    const CHOICE_RE = /正确的一项是|正确的是|恰当的一项是|不正确的一项|不恰当的一项是|错误的一项|下列说法(正确|错误)|哪一[项个](正确|错误)|选择正确的(?:答案|选项)/;
    for (let i = 0; i < questionBlocks.length; i++) {
      const block = questionBlocks[i];
      const qText = block.split(/<\/p>/)[0].replace(/<[^>]+>/g, '').trim();
      if (!CHOICE_RE.test(qText)) continue;
      // 选项区 = 本题块 + 下一题块开头（选项通常紧跟题干之后、下一题之前）
      const next = i + 1 < questionBlocks.length ? questionBlocks[i + 1].split(/<p class="question">/)[0] : '';
      const optCount = (block + next).match(/<p class="option">|<span class="option">/gi) || [];
      if (optCount.length < 2) {
        issues.push({
          severity: 'error', type: '选择题缺少选项',
          detail: `选择题缺少选项（题干："${qText.slice(0, 40)}…"），每道选择题必须输出 ≥2 个 <p class="option"> 选项行（A./B./C./D. 逐行排列，禁止空选项）`,
          autoFix: false,
        });
      }
    }
    return issues;
  }

  /**
   * 🔴 三重硬核扫描·查错：答案区空内容检测（全类型适用）
   * answer-section 存在但内部无实际答案文本（去标签后 <20 字）→ 退稿
   */
  static checkAnswerSectionEmpty(content: string): Issue[] {
    const issues: Issue[] = [];
    const m = content.match(/<div[^>]*class="answer-section"[^>]*>([\s\S]*?)<\/div>/i);
    if (!m) return issues;
    const inner = m[1].replace(/<[^>]+>/g, '').replace(/&[a-zA-Z]+;/g, ' ').trim();
    if (inner.length < 10) {
      issues.push({
        severity: 'error', type: '答案区空内容',
        detail: '答案与解析区域内容为空或过短（仅' + inner.length + '字），请为所有题目补全完整答案与解析（含选择题，每道题都要有答案）',
        autoFix: false,
      });
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

  /**
   * 🔴 三重硬核扫描·查错：标点配对检测
   * 全角圆括号/书名号/中文双引号必须成对闭合，奇偶校验全卷（含答案区）
   */
  static checkBracketBalance(content: string): Issue[] {
    const issues: Issue[] = [];
    const pairs: Array<[RegExp, RegExp, string]> = [
      [/（/g, /）/g, '全角圆括号（ ）'],
      [/《/g, /》/g, '书名号《 》'],
      [/“/g, /”/g, '中文双引号“ ”'],
    ];
    for (const [open, close, name] of pairs) {
      const o = (content.match(open) || []).length;
      const c = (content.match(close) || []).length;
      if (o !== c) {
        issues.push({ severity: 'error', type: '标点配对异常', detail: `${name}不成对：左${o}个、右${c}个，正式试卷不得出现未闭合标点`, autoFix: false });
      }
    }
    return issues;
  }

  /**
   * 🔴 真题卷根治：exam 成品卷面结构校验（对齐真题蓝本）
   * 检测：分值总和、卷首信息栏、密封线信息栏、创意题型名、质检报告泄漏
   * 全部为 error 级（触发 AI 自动修复），autoFix=false（需 AI 理解语义修复）
   */
  static checkExamPaperStandard(content: string, blueprint: { fullScore: number; duration?: string; sections?: Array<{ name: string; score: number; note?: string }> } | null): Issue[] {
    const issues: Issue[] = [];
    if (!blueprint) return issues;

    // 1. 总分校验：大题标题须按明细式"（共X题，每题X分，共X分）"标注。
    //    🔧 只统计正文：答案区（answer-section）评分细则中的"每空2分""（3分）"标注是真题卷
    //    答案页的正常做法，不参与卷面分值闭合校验，否则会误报"分值之和超标"与"小题标分"。
    const answerDiv = content.match(/<div[^>]*class="answer-section"[^>]*>/i);
    const bodyContent = answerDiv && answerDiv.index ? content.slice(0, answerDiv.index) : content;
    // 旧式"（X分）"分值标注（兜底闭合校验 + 小题标分检测共用）
    const scoreLabels = bodyContent.match(/[（(]\s*\d{1,3}\s*分\s*[)）]/g) || [];
    // 明细式：逐行匹配"一、XX。（共X题…共X分）"，每题分单独提取
    const plain = bodyContent.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');
    const sectionRe = /^([一二三四五六七八九十]+)、[^\n]*?[（(]\s*共\s*(\d{1,3})\s*题[^）)]*?共\s*(\d{1,3})\s*分[)）]/gm;
    const detailSections = [...plain.matchAll(sectionRe)];
    if (detailSections.length === 0) {
      // 旧式"（X分）"或缺失：提示按明细式修改，并兜底校验分值闭合
      issues.push({
        severity: 'error', type: '分值标记不规范',
        detail: '大题标题未按"（共X题，每题X分，共X分）"明细式标注分值，请按蓝本第6条修改大题标题（小题不得标注分值）',
        autoFix: false,
      });
      const sum = scoreLabels.reduce((s, m) => s + parseInt(m.replace(/\D/g, ''), 10), 0);
      if (scoreLabels.length > 0 && Math.abs(sum - blueprint.fullScore) > 2) {
        issues.push({
          severity: 'error', type: '分值体系异常',
          detail: '大题分值之和=' + sum + '分，卷面满分应为' + blueprint.fullScore + '分。检查大题分值是否遗漏或重复计算（小题不应单独标注分值）',
          autoFix: false,
        });
      }
    } else {
      let sum = 0;
      for (const m of detailSections) {
        const qty = parseInt(m[2], 10);
        const total = parseInt(m[3], 10);
        const perMatch = m[0].match(/每题\s*(\d{1,3})\s*分/);
        const perScore = perMatch ? parseInt(perMatch[1], 10) : null;
        sum += total;
        if (perScore != null && perScore * qty !== total) {
          issues.push({
            severity: 'error', type: '分值体系异常',
            detail: '大题"' + m[1] + '、"标注"每题' + perScore + '分×' + qty + '题"与"共' + total + '分"不一致，请修正',
            autoFix: false,
          });
        }
      }
      if (Math.abs(sum - blueprint.fullScore) > 2) {
        issues.push({
          severity: 'error', type: '分值体系异常',
          detail: '各大题"共X分"之和=' + sum + '分，卷面满分应为' + blueprint.fullScore + '分。检查大题分值是否遗漏或重复计算',
          autoFix: false,
        });
      }
    }
    // 小题分值标注检测：分值标注数量明显超过大题数（>12处）说明小题被标了分值，不符合真题卷惯例
    if (scoreLabels.length > 12) {
      issues.push({
        severity: 'error', type: '分值标注不规范',
        detail: '检测到大量分值标注（' + scoreLabels.length + '处），真题卷只在大题标题标注总分值，小题一律不标分值',
        autoFix: false,
      });
    }

    // 2. 卷首信息栏：满分 + 考试时间（含数值与蓝本一致性）
    const fullScoreMatch = content.match(/满分\s*[:：]?\s*(\d{1,3})\s*分/);
    if (!fullScoreMatch) {
      issues.push({ severity: 'error', type: '卷面缺漏', detail: '卷首缺少"满分"标注（真题卷卷首须标注满分）', autoFix: false });
    } else if (parseInt(fullScoreMatch[1], 10) !== blueprint.fullScore) {
      issues.push({ severity: 'error', type: '分值体系异常', detail: '卷首标注满分' + fullScoreMatch[1] + '分，与真题蓝本满分' + blueprint.fullScore + '分不一致', autoFix: false });
    }
    if (!/(考试时间|考试时长|时间\s*[:：])/.test(content)) {
      issues.push({ severity: 'error', type: '卷面缺漏', detail: '卷首缺少"考试时间"标注', autoFix: false });
    } else if (blueprint.duration) {
      const durMatch = content.match(/(?:考试时间|考试时长)\s*[:：]?\s*(\d+)\s*分钟/);
      if (durMatch && parseInt(durMatch[1], 10) !== parseInt(blueprint.duration, 10)) {
        issues.push({ severity: 'error', type: '分值体系异常', detail: '卷首标注考试时间' + durMatch[1] + '分钟，与真题蓝本' + blueprint.duration + '不一致', autoFix: false });
      }
    }

    // 3. 密封线信息栏：姓名 + 班级
    if (!/姓名/.test(content) || !/班级/.test(content)) {
      issues.push({ severity: 'error', type: '卷面缺漏', detail: '缺少密封线信息栏（学校/班级/姓名/学号，附\"密封线内不要答题\"）', autoFix: false });
    }

    // 4. 创意题型名检测（真题卷禁用花哨命名）——只扫描大题标题区（h1-h4 标签 + 汉字序号开头的大题标题行），
    //    避免把卷首语情境名（如"大自然乐园""游园会"）、正文中的词语误判为题型名
    const titleOnlyText = (content.match(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/gi) || [])
      .map((h) => h.replace(/<[^>]+>/g, '').trim())
      .filter((t) => t.length > 0)
      .join('\n');
    const sectionTitleLines = content.replace(/<[^>]+>/g, '\n').split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[一二三四五六七八九十]+、/.test(l))
      .join('\n');
    const creativeMatch = (titleOnlyText + '\n' + sectionTitleLines).match(/[\u4e00-\u9fa5]{0,4}(小达人|对对碰|大转盘|小侦探|闯关|乐园|达人)[\u4e00-\u9fa5]?/);
    if (creativeMatch) {
      issues.push({
        severity: 'error', type: '题型命名不规范',
        detail: '出现非真题规范题型名\"' + creativeMatch[0] + '\"，应使用真题规范题型名（如\"看拼音，写词语\"\"按课文内容填空\"）',
        autoFix: false,
      });
    }

    // 5. 质检报告泄漏检测
    if (/知识点准确性/.test(content) && /课标对齐|学段适配/.test(content)) {
      issues.push({
        severity: 'error', type: '质检报告泄漏',
        detail: '正文或答案中混入质检自审文字（"知识点准确性/课标对齐"等检查条目），正式试卷不得出现',
        autoFix: false,
      });
    }
  
    // 6. 大题骨架匹配：蓝本大题名称在成品中的命中率（防删题/改名题）
    if (blueprint.sections && blueprint.sections.length > 0) {
      const names = blueprint.sections.map((s) => s.name);
      const hit = names.filter((n) => content.includes(n)).length;
      const minHit = Math.max(1, Math.ceil(names.length * 0.6));
      if (hit < minHit) {
        issues.push({
          severity: 'error', type: '大题骨架不符',
          detail: '真题蓝本要求' + names.length + '道大题，成品仅命中' + hit + '道大题名称（至少需' + minHit + '道），存在删题或改题，应按蓝本题型骨架执行',
          autoFix: false,
        });
      }
    }
  
    // 7. 配图描述缺失：蓝本 note 要求 [IMAGE] 的看图/配图类题型，成品必须输出 [IMAGE] 标记
    if (blueprint.sections && blueprint.sections.length > 0) {
      const imageRequired = blueprint.sections.filter((s) => (s.note || '').includes('[IMAGE]'));
      if (imageRequired.length > 0 && !content.includes('[IMAGE]')) {
        issues.push({
          severity: 'error', type: '配图描述缺失',
          detail: '蓝本要求"' + imageRequired.map((s) => s.name).join('、') + '"等看图/配图类题必须用 [IMAGE] 标记输出配图描述（供用户生图后插入），成品未检测到任何 [IMAGE] 标记',
          autoFix: false,
        });
      }
    }
    // 7b. 配图参数完整性：有 [IMAGE] 标记但缺少 PROMPT 字段时提醒（生图工具需要结构化参数便于复制）
    if (content.includes('[IMAGE]') && !content.includes('PROMPT')) {
      issues.push({
        severity: 'warning', type: '配图参数不完整',
        detail: '检测到 [IMAGE] 标记但缺少 PROMPT 字段，应按结构化格式输出（TYPE:SD / PROMPT:画面描述 / STYLE:line_art），方便复制到生图工具生成图片',
        autoFix: false,
      });
    }
  
    // 8. 听力材料缺失：蓝本听力题要求听力原文集中放答案页供教师朗读
    if (blueprint.sections && blueprint.sections.length > 0) {
      const listeningRequired = blueprint.sections.filter((s) => (s.note || '').includes('听力原文'));
      if (listeningRequired.length > 0 && !/听力材料|听力原文|听力文本/.test(content)) {
        issues.push({
          severity: 'error', type: '听力材料缺失',
          detail: '蓝本要求听力题将听力原文集中放答案页（标注"听力材料"供教师朗读），成品未检测到听力材料',
          autoFix: false,
        });
      }
    }
  
    return issues;
  }
  
  /**
   * 🔴 真题卷根治：exam 答案泄露检测
   * 组词等题型的题干/例句/示例中不得直接出现该题答案（防答案照抄）
   */
  static checkAnswerLeak(content: string): Issue[] {
    const issues: Issue[] = [];
    // 拆出答案区纯文本（answer-section 至文末）与正文
    let body = content;
    let answerText = '';
    const answerMatch = content.match(/<div[^>]*class="answer-section"[^>]*>([\s\S]*)$/i);
    if (answerMatch) {
      body = content.slice(0, answerMatch.index || 0);
      answerText = answerMatch[1] || '';
    }
    if (!answerText) return issues;
  
    // ── 检测1：组词题（标题含"组词"）——题干/例句不得出现答案组词 ──
    const zuci = body.match(/<h[2-4][^>]*>[^<]*组词[^<]*<\/h[2-4]>([\s\S]*?)(?=<h[2-4][^>]*>|$)/i);
    if (zuci) {
      const zuciText = zuci[1].replace(/<[^>]+>/g, '');
      // 答案组词：答案区全角括号内 2-4 字中文词（如"园（公园）"）
      const answerWords = Array.from(answerText.matchAll(/（([\u4e00-\u9fff]{2,4})）/g), (m) => m[1]);
      const leaked: string[] = [];
      for (const w of new Set(answerWords)) {
        if (w.length >= 2 && zuciText.includes(w)) leaked.push(w);
      }
      if (leaked.length > 0) {
        issues.push({
          severity: 'error', type: '答案泄露',
          detail: '组词题题干/例句中出现答案组词：' + leaked.slice(0, 5).join('、') + (leaked.length > 5 ? '等' : '') + '，题干只应给出形近字对，禁止出现含该字的词语或例句（防答案照抄）',
          autoFix: false,
        });
      }
    }
  
    // ── 检测2：看拼音写词语（标题含"看拼音"）——题干句子不得直接写出目标词 ──
    const kpy = body.match(/<h[2-4][^>]*>[^<]*看拼音[^<]*<\/h[2-4]>([\s\S]*?)(?=<h[2-4][^>]*>|$)/i);
    if (kpy) {
      const kpyText = kpy[1].replace(/<[^>]+>/g, '');
      // 答案区对应分区：从"看拼音"标题到下一道大题序号标题（如"二、"）为止
      const kpyAnsMatch = answerText.match(/看拼音[^一二三四五六七八九十\n]{0,8}([\s\S]{0,400}?)(?=[一二三四五六七八九十]、|$)/);
      if (kpyAnsMatch) {
        // 每项：序号开头，取首个连续2-6字中文词作为答案词
        const items = (kpyAnsMatch[1] || '').split(/\d+[.、．]\s*/).filter(Boolean);
        const leaked: string[] = [];
        for (const item of items) {
          const wm = item.match(/[\u4e00-\u9fff]{2,6}/);
          const w = wm ? wm[0] : '';
          if (w && kpyText.includes(w) && !leaked.includes(w)) leaked.push(w);
        }
        if (leaked.length > 0) {
          issues.push({
            severity: 'error', type: '答案泄露',
            detail: '看拼音写词语的题干句子中出现目标词：' + leaked.slice(0, 5).join('、') + (leaked.length > 5 ? '等' : '') + '，目标词应挖空填在横线上，题干句子不得直接写出目标词（防答案照抄）',
            autoFix: false,
          });
        }
      }
    }
  
    return issues;
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
    } else if (actualCount < expectedCount - 2) {
      // 🔧 页数优先（蓝图条款13）：蓝图题量为参考下限，按页数要求可增加题量（实际>蓝图=正常加题，不提示），
      //    仅当实际题量明显不足（少于规划2题以上）才提示，避免"页数优先加题"被误报为数量不一致
      issues.push({ severity: 'warning', type: '题目数量不足', detail: `蓝图规划${expectedCount}题，实际仅${actualCount}题，题量偏少可能不满足页数要求`, autoFix: false });
    }
    return issues;
  }

  static checkScoreConsistency(content: string): Issue[] {
    const issues: Issue[] = [];
    // 🔧 只统计答案区之前的题目正文：答案区可能重复大题标题，避免重复计数造成误报
    const body = content.replace(/<div[^>]*class="answer-section"[^>]*>[\s\S]*$/i, '');
    // 1) 同分大题算术：本大题共N小题，每题/每小题P分，共T分 → N×P 必须= T
    const sameScoreRe = /本大题共(\d+)(?:小题|题)[，,]\s*每(?:小)?题(\d+)分[，,]\s*共(\d+)分/g;
    let m;
    while ((m = sameScoreRe.exec(body)) !== null) {
      const n = parseInt(m[1]), per = parseInt(m[2]), total = parseInt(m[3]);
      if (n * per !== total) {
        issues.push({ severity: 'warning', type: '分值计算不一致', detail: `大题标注"本大题共${n}小题，每小题${per}分，共${total}分"，但 ${n}×${per}=${n * per}≠${total}，请修正题数或分值`, autoFix: false });
      }
    }
    // 2) 层级汇总：卷首满分 = 各大题"共X分"之和（只统计大题标题，同一标题重复出现只计一次）
    const fullMatch = body.match(/满分[:：]\s*(\d+)/);
    if (fullMatch) {
      const full = parseInt(fullMatch[1]);
      const bigRe = /本大题共\d+(?:小题|题)[，,]\s*(?:每(?:小)?题\d+分[，,]\s*)?共(\d+)分/g;
      const bigTotals: number[] = [];
      const seen = new Set<string>();
      let bm;
      while ((bm = bigRe.exec(body)) !== null) {
        if (seen.has(bm[0])) continue; // 同一标题文本（正文/答案区重复）只计一次
        seen.add(bm[0]);
        bigTotals.push(parseInt(bm[1]));
      }
      const bigSum = bigTotals.reduce((a, b) => a + b, 0);
      if (bigTotals.length > 0 && bigSum !== full) {
        issues.push({ severity: 'warning', type: '分值汇总不一致', detail: `卷首满分${full}分，各大题"共X分"合计${bigSum}分（${bigTotals.join('+')}），不一致——请调整各大题总分，使大题之和=满分`, autoFix: false });
      }
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
    // ═══ 🔴 三重硬核扫描·全类型通用层（所有资料类型均适用）═══
    const qBlocks = content.match(/<(?:p|div|li)\s+class="[^"]*question[^"]*"[^>]*>[\s\S]*?<\/(?:p|div|li)>/gi) || [];
    // 查重·存在重复题目：去标签归一化后完全相同
    if (qBlocks.length > 1) {
      const normalized = qBlocks.map(b => b.replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim()).filter(t => t.length > 10);
      const dupCount = normalized.filter((t, i) => normalized.indexOf(t) !== i).length;
      if (dupCount > 0) {
        issues.push({ severity: 'warning', type: '存在重复题目', detail: `检测到${dupCount}处完全相同的题目，重复题是生成事故，请改写其一`, autoFix: false });
      }
    }
    // 查重·相似题指纹检测：题干归一化后前12字重合即疑似相似题
    if (qBlocks.length > 1) {
      const fingerprints = qBlocks
        .map((b) => b.replace(/<[^>]+>/g, '').replace(/\s+/g, '').replace(/^\d+[.、．）)]/, '').slice(0, 12))
        .filter((f) => f.length >= 10);
      const seen = new Map<string, number>();
      const similar = new Set<string>();
      for (const f of fingerprints) {
        if (seen.has(f)) similar.add(f);
        else seen.set(f, 1);
      }
      if (similar.size > 0) {
        issues.push({ severity: 'warning', type: '疑似相似题', detail: `检测到${similar.size}组题干高度相似的题目（如"${[...similar][0]}…"），组题大忌：题材/情境/设问角度相似的题须改写其一`, autoFix: false });
      }
    }
    // 查规范·绝对化选项滥用："以上都对/以上都不对"类选项会降低区分度
    const absoluteOpts = (content.match(/以上都对|以上都不对|以上全对|全部正确|都不正确|以上都不正确/g) || []).length;
    if (absoluteOpts >= 2) {
      issues.push({ severity: 'warning', type: '绝对化选项滥用', detail: `检测到${absoluteOpts}处"以上都对/以上都不对"类绝对化选项（建议不超过1处），这类选项会降低区分度`, autoFix: false });
    }
    // 🔴 查规范·连线题文本格式残留：用 ------ 而非 match-question HTML 格式
    const plainText = content.replace(/<[^>]+>/g, '');
    if (/----{4,}/.test(plainText) && !/match-question/.test(content)) {
      issues.push({ severity: 'warning', type: '连线题格式不规范', detail: '检测到连线题使用------文本格式，应使用 <div class="match-question"> HTML格式呈现', autoFix: false });
    }
    // 🔴 查规范·写话区格子格式残留：用 -- -- -- 而非 zuo-wen-ge 格式
    if (/--(?:\s*--){3,}/.test(plainText)) {
      issues.push({ severity: 'warning', type: '写话格格式不规范', detail: '检测到写话区使用 -- 横线格式，应使用 <div class="zuo-wen-ge"><span>&emsp;</span></div> 作文格格式', autoFix: false });
    }
    // 查错·读音题拼音标调粗检测：拼音串出现但无任何声调字符
    const duyin = content.match(/<h[2-4][^>]*>[^<]*(读音|加点字)[^<]*<\/h[2-4]>([\s\S]*?)(?=<h[2-4][^>]*>|<div[^>]*class="answer-section"|$)/i);
    if (duyin) {
      const duyinText = duyin[2].replace(/<[^>]+>/g, '');
      const plainPinyin = (duyinText.match(/[a-z]{3,}/gi) || []).length;
      const hasTone = /[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/.test(duyinText);
      if (plainPinyin >= 2 && !hasTone) {
        issues.push({ severity: 'warning', type: '拼音未标调', detail: `读音题区域检测到${plainPinyin}处拼音串但未发现任何声调字符，读音题选项拼音必须全部标注声调（含干扰项）`, autoFix: false });
      }
    }
    // 🔧 题型多样性：选择题占比过高检测（全类型通用——考试/练习/专项/复习均需题型多样）
    if (qBlocks.length >= 10) {
      const choiceCount = qBlocks.filter(b => /[AＡ]\s*[.．、]/.test(b) && /[BＢ]\s*[.．、]/.test(b)).length;
      if (choiceCount / qBlocks.length >= 0.6) {
        issues.push({ severity: 'warning', type: '题型单一', detail: `检测到${choiceCount}/${qBlocks.length}道题含选项特征，选择题占比过高，应搭配填空/简答/操作等多样题型`, autoFix: false });
      }
    }
    // 🔴 思维深度检测：识别低认知层级设问模式，确保高阶思维覆盖
    {
      const plainText2 = content.replace(/<[^>]+>/g, '');
      const recallPatterns = [
        /的定义是[____＿]/g, /的特点是[____＿]/g, /被称为[____＿]/g,
        /又叫做[____＿]/g, /的意义是[____＿]/g, /发生于[____＿]年/g,
        /原文中写道[____＿]/g
      ];
      let recallCount = 0;
      for (const p of recallPatterns) {
        recallCount += (plainText2.match(p) || []).length;
      }
      if (recallCount >= 3) {
        issues.push({ severity: 'warning', type: '思维深度不足', detail: `检测到${recallCount}处低认知层级设问（定义背诵/事实回忆/原文挖空），须改为分析判断/迁移应用型设问`, autoFix: false });
      }
      const higherOrderPatterns = [
        /比较[\s\S]{0,8}异同/g, /分析[\s\S]{0,10}原因/g, /评价[\s\S]{0,10}是否/g,
        /设计[\s\S]{0,8}方案/g, /说明[\s\S]{0,10}理由/g, /判断[\s\S]{0,10}哪个/g,
        /归纳[\s\S]{0,8}特点/g, /提出[\s\S]{0,8}建议/g,
        // 开放表达/说理类高阶设问（低段口语化）：为什么/你喜欢……为什么/说说你的想法/谈谈你的看法等
        /为什么/gi, /你喜欢/gi, /你的想法/gi, /你的看法/gi, /谈谈/gi,
      ];
      const higherCount = higherOrderPatterns.reduce((sum, p) => sum + (plainText2.match(p) || []).length, 0);
      if (qBlocks.length >= 10 && higherCount === 0) {
        issues.push({ severity: 'warning', type: '缺乏高阶思维题', detail: '未检测到分析/评价/创造层级设问，须至少包含2道高阶思维题（比较分析/评价判断/设计方案等）', autoFix: false });
      }
    }
    if (genType === 'exam') {
      // 考试卷：检查是否有分值标注
      const scoreMatches = content.match(/\(\d+分\)|（\d+分）/g);
      if (!scoreMatches || scoreMatches.length === 0) {
        issues.push({ severity: 'warning', type: '缺少分值', detail: '试卷未检测到大题分值标注（如"一、看拼音，写词语。（16分）"），真题卷只在大题标题标注总分值、小题不标分', autoFix: false });
      }
      // 🔧 正式考试标准：分类分层结构检测（板块标题须含层级定位词）
      const sectionTitles = (content.match(/<h[2-4][^>]*>[\s\S]*?<\/h[2-4]>/gi) || [])
        .map(h => h.replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 0);
      const hasLayeredSection = sectionTitles.some(t => /基础|能力|综合|识记|积累|理解|运用|表达|创造|看拼音|组词|填空|阅读|写话|选择|判断|解答|应用|听力|书面/.test(t));
      if (!hasLayeredSection) {
        issues.push({ severity: 'warning', type: '缺少分类分层', detail: '试卷未检测到规范大题标题（能力层级板块或真题规范题型名），大题结构须按【真题卷结构蓝本】执行', autoFix: false });
      }
      // 🔧 蓝图知识点重复检测（DeepSeek 伪蓝图 knowledgePoint 为空时自动跳过）
      if (Array.isArray(parsedBlueprint) && parsedBlueprint.length > 0) {
        const kpCountMap = new Map<string, number>();
        for (const q of parsedBlueprint) {
          const qq = q as { knowledgePoint?: string };
          const kp = (qq.knowledgePoint || '').trim();
          if (!kp || kp === '未知') continue;
          kpCountMap.set(kp, (kpCountMap.get(kp) || 0) + 1);
        }
        const overKps = Array.from(kpCountMap.entries()).filter(([, c]) => c > 2).map(([k, c]) => `${k}×${c}`);
        if (overKps.length > 0) {
          issues.push({ severity: 'warning', type: '知识点重复考查', detail: `蓝图中有${overKps.length}个知识点考查超过2次（${overKps.slice(0, 3).join('、')}${overKps.length > 3 ? '等' : ''}），正式考试应避免无意义重复考查`, autoFix: false });
        }
      }
      // 🔧 题型多样性已上移至全类型通用层（考试/练习/专项/复习均检测）
      // 🔧 表达类大题数量检测（真题每卷仅1道写作题）
      const expressTitles = (content.match(/<h[2-4][^>]*>[\s\S]*?<\/h[2-4]>/gi) || [])
        .map(h => h.replace(/<[^>]+>/g, '').trim())
        .filter(t => /看图写话|习作|作文|书面表达/.test(t));
      if (expressTitles.length >= 2) {
        issues.push({ severity: 'warning', type: '表达题过多', detail: `检测到${expressTitles.length}道表达类大题（${expressTitles.join('、')}），真题每卷仅1道写作题，其余表达类题应并入其他大题作为小题`, autoFix: false });
      }
      // 🔧 卷面标注残留检测（正式考试卷面不显示知识点/层级标注）
      const examPlainText = content.replace(/<[^>]+>/g, '');
      if (/〔知识点[：:｜|]/.test(examPlainText)) {
        issues.push({ severity: 'warning', type: '卷面标注残留', detail: '试卷正文检测到〔知识点：×｜层级：×〕标注，正式考试卷面不应出现知识点/层级标注，请移除', autoFix: false });
      }
      // 🔧 素养立意检测：回忆式设问/书本挖空过多（新课标考查素养运用而非背诵）
      const recallPatternSrc = `的特点是（|的反义词是（|的近义词是（|先长出了什么|的读音是（|公式是（|的定义是（|的内容是（|的中文意思是（|的英文意思是（|读了《|《[^《]{1,20}》中|'里|"里|”里|’里|被称为|又叫做|指的是（|是因为它们（`;
      const recallMatches = examPlainText.match(new RegExp(recallPatternSrc, 'g'));
      if (recallMatches && recallMatches.length >= 3) {
        issues.push({ severity: 'warning', type: '回忆式设问过多', detail: `检测到${recallMatches.length}处单点回忆式设问/书本挖空（如"XX的特点是""XX的公式是""XX被称为""XX的中文意思是"），新课标考查素养运用而非背诵，请改为情境化/探究式设问`, autoFix: false });
      }
      // 🔧 v29 传统题嫌疑占比统计（情境化硬指标：正文传统题嫌疑占比>30% 即情境化<70%，新课标红线）
      const bodyPlainText = examPlainText.split(/参考答案|答案与解析/)[0];
      const bodyRecall = bodyPlainText.match(new RegExp(recallPatternSrc, 'g')) || [];
      const isolatedDictation = bodyPlainText.match(/看拼音写(词语|汉字|生字)[：:]\s*(?:（|$)/g) || [];
      const questionStarts = bodyPlainText.match(/^\s*\d+[.、．)）]\s*/gm) || [];
      if (questionStarts.length >= 5) {
        const traditionalCount = bodyRecall.length + isolatedDictation.length;
        const traditionalRatio = traditionalCount / questionStarts.length;
        if (traditionalRatio > 0.3) {
          issues.push({ severity: 'warning', type: '传统题嫌疑占比过高', detail: `正文检测到传统式题目嫌疑${traditionalCount}处/共${questionStarts.length}题（占比${Math.round(traditionalRatio * 100)}%），新课标要求情境化试题占比≥70%，回忆式设问/孤立看拼音须改为情境化/探究式设问`, autoFix: false });
        }
      }
      // 🔴 测量科学：选择题正确答案分布检测（真卷答案随机均匀分布）
      const answerSection = content.match(/<div[^>]*class="answer-section"[^>]*>([\s\S]*)$/i);
      if (answerSection) {
        const ansText = answerSection[1].replace(/<[^>]+>/g, '');
        const letterAnswers = Array.from(ansText.matchAll(/^\s*\d+[.、．)）]\s*([A-Da-d])\b/gm), (m) => m[1].toUpperCase());
        if (letterAnswers.length >= 8) {
          const total = letterAnswers.length;
          const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
          for (const a of letterAnswers) counts[a] = (counts[a] || 0) + 1;
          const missing = ['A', 'B', 'C', 'D'].filter((k) => counts[k] === 0);
          const maxRatio = Math.max(counts.A, counts.B, counts.C, counts.D) / total;
          let maxRun = 0; let run = 0; let prev = '';
          for (const a of letterAnswers) { run = a === prev ? run + 1 : 1; maxRun = Math.max(maxRun, run); prev = a; }
          if (missing.length > 0 && total >= 10) {
            issues.push({ severity: 'error', type: '答案分布异常', detail: `全卷${total}道选择题的正确答案从未出现选项${missing.join('、')}，真卷答案须随机均匀分布（每个选项至少出现一次）`, autoFix: false });
          }
          if (maxRatio >= 0.5) {
            issues.push({ severity: 'error', type: '答案分布异常', detail: `全卷${total}道选择题中单一选项占比达${Math.round(maxRatio * 100)}%，答案分布严重偏斜，应随机均匀分布`, autoFix: false });
          }
          if (maxRun >= 4) {
            issues.push({ severity: 'error', type: '答案分布异常', detail: `检测到连续${maxRun}道选择题答案相同，真卷同一选项连续出现不超过3次`, autoFix: false });
          }
        }
      }
      // 🔴 三重硬核扫描·查规范：静态页码与得分栏检测（试卷专属卷面规范）
      //    页码由导出端自动生成（Word 页脚 PAGE/NUMPAGES 域、PDF 页脚动态计算），生成内容严禁含静态页码文字
      if (/第\s*\d+\s*页|共\s*\d+\s*页/.test(content)) {
        issues.push({ severity: 'error', type: '正文含静态页码', detail: '生成内容中不应标注页数（检测到"第X页/共X页"静态页码），页码由导出时动态生成（Word页脚/PDF页脚），请移除正文中的页码文字', autoFix: true });
      }
      if (!/得分/.test(content)) {
        issues.push({ severity: 'warning', type: '缺少得分栏', detail: '试卷未检测到得分栏（真题卷每大题标题行右端设"得分：＿＿"栏，低段可省略）', autoFix: false });
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
        primary: ['政治认同', '道德修养', '法治观念', '健全人格', '责任意识'],
        middle: ['政治认同', '道德修养', '法治观念', '健全人格', '责任意识', '公共参与'],
      },
      '思想政治': {
        high: ['政治认同', '科学精神', '法治意识', '公共参与', '辩证思维'],
      },
      '科学': {
        primary: ['科学探究', '科学思维', '科学态度', '社会责任', '物质科学', '生命科学', '地球与宇宙', '技术与工程'],
      },
      '信息科技': {
        primary: ['信息意识', '计算思维', '数字化学习', '信息社会责任'],
        middle: ['信息意识', '计算思维', '数字化学习', '信息社会责任', '算法', '数据'],
        high: ['信息意识', '计算思维', '数字化学习', '信息社会责任', '算法思维', '数据安全'],
      },
      '音乐': {
        primary: ['审美感知', '艺术表现', '文化理解', '创意实践'],
        middle: ['审美感知', '艺术表现', '文化理解', '创意实践'],
        high: ['审美感知', '艺术表现', '文化理解', '创意实践', '音乐鉴赏'],
      },
      '美术': {
        primary: ['审美感知', '艺术表现', '创意实践', '文化理解'],
        middle: ['审美感知', '艺术表现', '创意实践', '文化理解', '图像识读'],
        high: ['审美感知', '艺术表现', '创意实践', '文化理解', '美术鉴赏', '图像识读'],
      },
      '体育': {
        primary: ['运动能力', '健康行为', '体育品德'],
        middle: ['运动能力', '健康行为', '体育品德', '运动技能'],
        high: ['运动能力', '健康行为', '体育品德', '运动技能', '健康素养'],
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

    // 小学低/中段禁止出现中学概念
    if (stage === 'primary_low' || stage === 'primary_mid' || stage === 'primary_high') {
      const forbiddenPatterns = [
        /证明|推导|定理|公理|方程式|函数/g,
        /论点|论据|论证|议论文|修辞手法/g,
        /完形填空|语法填空|书面表达/g,
      ];
      for (const pattern of forbiddenPatterns) {
        const matches = cleanContent.match(pattern);
        if (matches && matches.length >= 3) {
          const stageLabel = stage.includes('low') ? '低' : stage.includes('mid') ? '中' : '高';
          issues.push({
            severity: 'warning', type: '学段内容超纲',
            detail: `小学${stageLabel}段内容中出现"${matches[0]}"等高学段概念（共${matches.length}处），请确认是否适合该学段学生`,
            autoFix: false,
          });
          break; // 只报告第一个超纲模式
        }
      }
    }

    // 小学高段命题类内容应有初步分析思维（仅对 exam/practice/special/review 做检查）
    if (stage === 'primary_high' && ['exam', 'practice', 'special', 'review'].includes(genType)) {
      const depthIndicators = [/分析|比较|归纳|推断|解释|分类|概括/g];
      let depthScore = 0;
      for (const pattern of depthIndicators) {
        const matches = cleanContent.match(pattern);
        if (matches) depthScore += matches.length;
      }
      if (cleanContent.length > 1000 && depthScore < 3) {
        issues.push({
          severity: 'warning', type: '内容深度不足',
          detail: `小学高段${genType}类型内容仅检测到${depthScore}处中层次认知活动标记（分析/比较/归纳/推断等），小学高段应开始培养分析比较能力`,
          autoFix: false,
        });
      }
    }

    // 初中内容不应过于浅显（仅对 exam/practice/special/review 做检查）
    if (stage === 'middle' && ['exam', 'practice', 'special', 'review'].includes(genType)) {
      const depthIndicators = [
        /分析|评价|论证|探究|综合|推理|归纳|演绎/g,
      ];
      let depthScore = 0;
      for (const pattern of depthIndicators) {
        const matches = cleanContent.match(pattern);
        if (matches) depthScore += matches.length;
      }
      // 初中命题类内容，中高层次认知动词应≥6个
      if (cleanContent.length > 1000 && depthScore < 4) {
        issues.push({
          severity: 'warning', type: '内容深度不足',
          detail: `初中${genType}类型内容仅检测到${depthScore}处中高层次认知活动标记（分析/评价/论证/探究等），初中应注重分析综合能力考查`,
          autoFix: false,
        });
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

  /**
   * 🔴 三重硬核扫描：查重 + 查错 + 查规范
   * 将全量机检结果按三维归类返回，供生成管线/测试/日志统一调用
   */
  static tripleScan(
    content: string, parsedBlueprint: unknown[], subject: string, stage: string, grade: string,
    genType?: string, materialText?: string,
  ): { duplication: Issue[]; error: Issue[]; standard: Issue[] } {
    const issues = this.check(content, parsedBlueprint, subject, stage, grade, genType, materialText);
    const duplication: Issue[] = [];
    const error: Issue[] = [];
    const standard: Issue[] = [];
    for (const issue of issues) {
      const dim = TRIPLE_SCAN_CLASSIFY[issue.type] || 'standard';
      if (dim === 'duplication') duplication.push(issue);
      else if (dim === 'error') error.push(issue);
      else standard.push(issue);
    }
    return { duplication, error, standard };
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
      // 关键 warning：缺少分类分层（exam 正式考试标准——退稿主因，必须AI修复）
      if (issue.type === '缺少分类分层' && genType === 'exam') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：知识点重复考查（exam 正式考试标准）
      if (issue.type === '知识点重复考查' && genType === 'exam') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：存在重复题目（exam 正式考试标准）
      if (issue.type === '存在重复题目' && genType === 'exam') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：题型单一（exam 正式考试标准——选择题占比过高）
      if (issue.type === '题型单一' && genType === 'exam') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：表达题过多（exam 真题每卷仅1道写作题）
      if (issue.type === '表达题过多' && genType === 'exam') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：卷面标注残留（正式考试卷面不显示知识点/层级标注）
      if (issue.type === '卷面标注残留' && genType === 'exam') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：回忆式设问过多（exam 新课标素养立意）
      if (issue.type === '回忆式设问过多' && genType === 'exam') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：文字拼接错误（"说明"误写为"说明文"等合法词汇错用，全类型兜底修复）
      if (issue.type === '文字拼接错误') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：存在重复题目 / 疑似相似题（全类型组题大忌）
      if (issue.type === '存在重复题目' || issue.type === '疑似相似题') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：绝对化选项滥用（全类型选择题质量）
      if (issue.type === '绝对化选项滥用') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：连线题格式不规范（应使用 match-question HTML 格式）
      if (issue.type === '连线题格式不规范') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：写话格格式不规范（应使用 zuo-wen-ge 格式）
      if (issue.type === '写话格格式不规范') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：拼音未标调（全类型读音题）
      if (issue.type === '拼音未标调') {
        repairable.push({ ...issue, severity: 'error' });
        continue;
      }
      // 关键 warning：缺少得分栏（exam 真题卷面规范；静态页码为 error 级，直接可修复）
      if (issue.type === '缺少得分栏' && genType === 'exam') {
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
    if (issueTypes.includes('缺少分类分层')) {
      prompt += `→ 试卷大题结构不符合规范：大题序列与名称必须严格按【真题卷结构蓝本】（如"一、看拼音，写词语。（16分）"），禁止自创板块或创意题型名，禁止在卷面输出知识点/层级标注。\n`;
    }
    if (issueTypes.includes('知识点重复考查')) {
      prompt += `→ 同一知识点被考查超过2次，请删除或改写重复考查的题目：知识点颗粒度以课标条目为最小单位（上位概念与下位概念不并列计、同一条目下的细分考查算同一知识点），重难点最多2次且必须角度不同（如概念理解+应用），一般知识点仅考1次。\n`;
    }
    if (issueTypes.includes('存在重复题目')) {
      prompt += `→ 存在完全相同的重复题目，请改写重复题：更换题材/情境/数据/设问角度，确保题目间有实质差异。\n`;
    }
    if (issueTypes.includes('题型单一')) {
      prompt += `→ 选择题占比过高，请将部分选择题改写成填空/判断/简答/操作等多样题型，同一知识点改用其他题型从不同角度考查。\n`;
    }
    if (issueTypes.includes('表达题过多')) {
      prompt += `→ 检测到多道表达类大题，请仅保留1道写作题（分值最高者），其余口语交际/表达类题并入其他大题作为小题。\n`;
    }
    if (issueTypes.includes('卷面标注残留')) {
      prompt += `→ 试卷正文含有〔知识点：×｜层级：×〕标注，请全部移除——正式考试卷面不显示知识点与层级信息。\n`;
    }
    if (issueTypes.includes('文字拼接错误')) {
      prompt += `→ 存在"说明文"文字拼接错误（应为动词"说明"），请将误写处逐一改回"说明"（如"说明文松柏…"改为"说明松柏…"、"说明文他们…"改为"说明他们…"）。\n`;
    }
    if (issueTypes.includes('回忆式设问过多')) {
      prompt += `→ 检测到多处单点回忆式设问（如"XX的特点是""XX的读音是""XX的反义词是""XX被称为"），请改写为情境化/探究式设问：知识点放进真实语境考查"会不会用"，并加入归类/比较/找规律/说理由类题目，至少1道生活联结题和1道开放性表达题。\n`;
    }
    if (issueTypes.includes('配图描述缺失')) {
      prompt += `→ 看图/配图类题缺少 [IMAGE] 配图描述标记，请为所有看图类题（看图写话/看图列式/听音选图/看图连线等）逐题补上 [IMAGE]...[/IMAGE] 标记，描述详细画面（场景/景物/人物/动作），风格为黑白线稿简笔画、图内无文字、不得暗示答案。\n`;
    }
    if (issueTypes.includes('听力材料缺失')) {
      prompt += `→ 听力题缺少听力材料，请在答案页补充"听力材料"板块（完整听力原文，供教师朗读使用），卷面只保留听力题目与作答区。\n`;
    }
    if (issueTypes.includes('答案泄露')) {
      prompt += `→ 题干/例句/示例中泄露了答案，请改写：组词题题干只给形近字对（不得出现含该字的词语或例句）；看拼音写词语的题干句子不得出现目标词；示例题的示例不得与任何小题答案相同。\n`;
    }
    if (issueTypes.includes('答案分布异常')) {
      prompt += `→ 选择题正确答案选项分布异常，请保持题目内容与正确选项不变，仅调整部分题目的选项排列顺序（移动正确项位置），使答案 A/B/C/D 随机均匀分布、每个选项至少出现一次、无连续3个以上相同。\n`;
    }
    if (issueTypes.includes('绝对化选项滥用')) {
      prompt += `→ "以上都对/以上都不对"类绝对化选项超过1处，请将多余处改写为具体干扰项（来自学生常见错误），全卷仅保留至多1处。\n`;
    }
    if (issueTypes.includes('疑似相似题')) {
      prompt += `→ 检测到题干高度相似的题目，请改写其一：更换题材/情境/数据/设问角度，确保两道题有实质差异（同情境多题也是组卷大忌）。\n`;
    }
    if (issueTypes.includes('连线题格式不规范')) {
      prompt += `→ 连线题使用了------文本格式，请改用 <div class="match-question"> HTML格式：左列和右列分别用<div class="match-col">和<div class="match-col">，每列内用<div class="match-item">排列项。\n`;
    }
    if (issueTypes.includes('写话格格式不规范')) {
      prompt += `→ 写话区使用了 -- 横线格式，请改用 <div class="zuo-wen-ge"><span>&emsp;</span></div> 作文格格式，每个格子一个<span>&emsp;</span>，不含任何占位文字。\n`;
    }
    if (issueTypes.includes('拼音未标调')) {
      prompt += `→ 读音题选项拼音未标注声调，请为所有拼音选项（含干扰项）补上声调（如 zhī、cāo）。\n`;
    }
    if (issueTypes.includes('标点配对异常')) {
      prompt += `→ 存在未闭合的括号/书名号/引号，请补齐或删除多余标点，确保全卷标点成对。\n`;
    }
    if (issueTypes.includes('填空空标签')) {
      prompt += `→ 存在空白填空标签 <u class="blank-N"></u> / <span class="blank-N"></span>（标签内无&emsp;），请为每个空标签填入 &emsp;，数量按答案字数映射：1字→2个、2字→4个、3-4字→6个、5-6字→8个、7+字→10个（横线标签），独立括号标签 N 值按括号映射表。\n`;
    }
    if (issueTypes.includes('选择题缺少选项')) {
      prompt += `→ 选择题缺少选项，请为每道选择题补全 ≥2 个 <p class="option"> 选项行（A./B./C./D. 逐行排列，选项来自学生常见错误思路，长度结构相近，禁止"以上都对/以上都不对"类选项）。\n`;
    }
    if (issueTypes.includes('答案区空内容')) {
      prompt += `→ 答案与解析区域为空或过短，请为所有题目（含选择题）补全完整答案与解析，主观题含思路/步骤/要点，确保文末答案区内容充实。\n`;
    }
    if (issueTypes.includes('正文含静态页码')) {
      prompt += `→ 正文中出现了静态页码文字（"第X页""共X页"等），请全部移除——页码由导出时自动生成（Word/PDF 页脚动态计算），生成内容中不得出现任何页码文字。\n`;
    }
    if (issueTypes.includes('缺少得分栏')) {
      prompt += `→ 每大题标题行右端补充"得分：＿＿"栏（低段可省略得分栏）。\n`;
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
    // 去 HTML 标签取纯文本，截断到 12000 字控制 token 消耗
    // 🔧 2026-08 从 6000 提到 12000：长试卷纯文本常超 6000 字，
    //    后半段的错字/拼接错误（如"说明→说明文"）因截断从未进入审查视野
    const cleanText = content
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s{2,}/g, '\n')
      .trim();
    const truncated = cleanText.length > 12000
      ? cleanText.slice(0, 12000) + '\n\n[... 后续内容已截断，仅审查以上部分 ...]'
      : cleanText;

    const label = context.genTypeLabel || context.genType || '资料';
    const meta = [context.subject, context.grade, context.stage].filter(Boolean).join('·');

    return `【语义审查任务】
请通读以下${label}内容（${meta}），从以下维度逐一检查：

1. **语句通顺性**：是否有读不通的句子、词语搭配不当、AI生成的文字拼接错误？
   特别注意：两个正确汉字错误拼接的情况——如"说明"+"文中的"→"说明文"，"可以"+"能"→"可能以"等。
   排查方法：逐句朗读，若某个词在上下文中语义不通（如该处应为动词"说明"却出现文体名词"说明文"），即使该词本身是合法词汇也必须报告。
   
2. **错别字/冗余字**：是否有明显的错别字、多余字、漏字？
   排查重点：同音错字（在/再、的/地/得、哪/那）、形近错字、AI幻觉造词。

3. **逻辑一致性**：
   - 选项是否互斥且无重叠？
   - 答案和解析是否自相矛盾？
   - 题目分值加总是否正确？
   - 阅读理解题的答案是否确实能在原文中找到依据？
   - 答案正确性：抽查2-3道题的答案是否确实正确（计算题重算一遍、选择题核对选项、填空题确认用词）？

4. **表述清晰度**：
   - 题目问法是否有歧义？
   - 学生能否准确理解题意？
   - 是否存在"说了等于没说"的空洞表述？
${context.genType === 'exam' ? '\n5. **正式考试专项**（考试卷专属）：\n   - 大题结构：是否严格按【真题卷结构蓝本】呈现（大题序列/名称/分值/顺序与蓝本一致）？是否出现自创板块/创意题型名或知识点/层级标注？\n   - 分值规范：每题是否标分？所有分值加总是否等于卷面总分？\n   - 题型丰富度：是否存在题型单一（如绝大多数为选择题）、设问句式模板化（连续多题同一句式）？\n   - 表达类大题：是否存在2道及以上写作/表达类大题（真题每卷仅1道写作题）？\n   - 卷面标注：正文是否出现知识点/层级等教学性标注（正式试卷不应出现）？\n   - 素养立意：是否存在大量直接挖教材原句的单点回忆题（如"XX的特点是""XX先长出了什么"）？是否有探究发现类、生活联结类、开放性题目？是否存在教材原句换皮挖空（如"人和动物是____"式课文原句变体，即使做成选择题也属违规，须改为按特征归类/品质推断等理解型设问）？情境是否与设问有实质关联（禁止"为了情境而情境"的贴标签式假情境）？\n' : ''}${QUESTION_GEN_TYPES.includes(context.genType || '') ? '\n6. **题目质量专项**（所有含题目的资料类型）：\n   - 情境真实性：情境是否与设问有实质关联（去掉情境后题目是否仍然成立）？是否存在"为了情境而情境"的贴标签式假情境（如所有题目硬塞同一场景但题目与场景无关、情境素材超出学段生活经验）？\n   - 相似题：是否存在题材/情境/数据/设问角度相似的两道题（相似题是组题大忌）？\n   - 重复考查：同一知识点是否被多次考查且考查角度重复（无意义重复）？\n   - 拼音标调：读音题（给加点字选择读音）选项中的拼音是否全部标注声调（含干扰项）？\n   - 答案泄露：组词题题干/例句是否出现目标组词？示例题（照样子写一写）的示例是否与小题答案相同？\n   - 干扰项科学性：选择题干扰项是否具有合理迷惑性（来自学生常见错误思路）？是否存在明显荒谬的干扰项？\n   - 题目独立性：各题是否独立设问？是否存在一题题干暗示另一题答案的连锁提示？\n   - 数据自洽：数学计算类题的题干数据与答案运算结果是否一致（总量=各部分之和、比例合理、单位一致）？条件是否充分（能推出唯一答案）？\n' : ''}
7. **思维深度专项**（所有资料类型）：
   - 认知层级覆盖：资料是否涵盖至少3个认知层级（识记/理解/应用/分析/评价/创造）？是否存在全卷/全篇仅有识记层题目的情况？
   - 低思维设问检测：是否存在大量"XX的特点是____""XX的定义是____""被称为____"等定义背诵/事实回忆式设问？
   - 高阶思维占比：分析/评价/创造层级的题目是否≥20%？是否至少有2道题要求比较分析、评价判断或设计方案？
   - 设问深度：是否所有设问都停留在"是什么"层面，缺少"为什么""怎么做""如果…会怎样"等深度追问？


【审查要求】
- 通读全文每一句，不得跳读；即使内容很长也必须完整读到底
- 只报告确实有问题的条目，若内容整体良好则回复"✅ 未发现语义问题"
- 每个问题格式：【位置】引用原文片段 → 【问题类型】通顺性/错别字/逻辑/歧义/相似题/重复考查/假情境/大题结构 → 【问题描述】一句话说明
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

    // 🔧 通过判定收紧（2026-08）：仅当回复简短且明确表达"无问题"时才判通过。
    //    旧正则 /没有.*问题|无.*问题/ 过宽——AI 回复"虽然没有大问题，但发现…"
    //    也会命中"没有.*问题"被误判通过，导致其后列出的问题被整体丢弃。
    const trimmed = rawResponse.trim();
    const isShortPassReply = trimmed.length <= 40 && (
      /^✅/.test(trimmed) ||
      /^(未发现|没有|无|无明显)(任何)?(语义)?问题/.test(trimmed) ||
      /^内容.*(良好|没有问题)/.test(trimmed)
    );
    if (isShortPassReply) {
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
