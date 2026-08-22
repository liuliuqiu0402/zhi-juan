import { describe, it, expect } from 'vitest';
import { HardRuleChecker, AISemanticReviewer } from '@/utils/qualityChecker';

describe('HardRuleChecker', () => {
  describe('checkFullwidthChars', () => {
    it('检测全角数字', () => {
      const issues = HardRuleChecker.checkFullwidthChars('１２３是数字');
      expect(issues.some(i => i.type === '格式错误')).toBe(true);
    });

    it('半角数字不报错', () => {
      const issues = HardRuleChecker.checkFullwidthChars('123是数字');
      expect(issues.filter(i => i.type === '格式错误').length).toBe(0);
    });

    it('答案标为"略"应警告', () => {
      const issues = HardRuleChecker.checkFullwidthChars('答案：略');
      expect(issues.some(i => i.type === '答案不完整')).toBe(true);
    });
  });

  describe('checkAnswerCompleteness', () => {
    it('缺少答案区域应警告', () => {
      const issues = HardRuleChecker.checkAnswerCompleteness('这是一段没有解答说明的内容');
      expect(issues.some(i => i.type === '缺少答案')).toBe(true);
    });

    it('包含答案区域不报错', () => {
      const issues = HardRuleChecker.checkAnswerCompleteness('题目\n<div class="answer-section">答案在这里</div>');
      expect(issues.filter(i => i.type === '缺少答案').length).toBe(0);
    });
  });

  describe('checkHTMLTags', () => {
    it('标签闭合正确不报错', () => {
      const issues = HardRuleChecker.checkHTMLTags('<div><p>内容</p></div>');
      expect(issues.length).toBe(0);
    });

    it('未闭合标签报错', () => {
      const issues = HardRuleChecker.checkHTMLTags('<div><p>内容');
      expect(issues.some(i => i.type === 'HTML标签不平衡')).toBe(true);
    });
  });

  describe('check', () => {
    it('完整检查返回结果数组', () => {
      const issues = HardRuleChecker.check('题目内容\n答案：略', [], '数学', '小学', '一年级');
      expect(Array.isArray(issues)).toBe(true);
    });

    it('学科不匹配时不检查超纲', () => {
      // 高中英语不在 GRADE_VOCABULARY 中
      const issues = HardRuleChecker.check('content with 导数', [], '英语', '高中', '一年级');
      expect(issues.every(i => i.type !== '超纲词汇')).toBe(true);
    });
  });

  describe('得分栏缺失检查（卷面规范 A4）', () => {
    it('带分值大题但缺"得分：＿＿"栏 → 警告', () => {
      const content = '<h1>期末试卷</h1>\n一、看拼音写词语（10分）\n题目\n二、阅读理解（20分）\n题目';
      const issues = HardRuleChecker.checkScoreColumns(content, 'primary_high');
      expect(issues.some(i => i.type === '得分栏缺失')).toBe(true);
    });

    it('每个大题都有得分栏 → 不警告', () => {
      const content = '<h1>期末试卷</h1>\n一、看拼音写词语（10分）　得分：＿＿\n题目\n二、阅读理解（20分）　得分：＿＿\n题目';
      const issues = HardRuleChecker.checkScoreColumns(content, 'primary_high');
      expect(issues.some(i => i.type === '得分栏缺失')).toBe(false);
    });

    it('小学低段（primary_low）豁免（低段可省略）', () => {
      const content = '一、看拼音写词语（10分）\n题目';
      const issues = HardRuleChecker.checkScoreColumns(content, 'primary_low');
      expect(issues.length).toBe(0);
    });
  });

  describe('卷首标题缺失检查（非考卷轻量质检 B5）', () => {
    it('无 h1/h2 且首行是编号 → 警告', () => {
      const content = '1. 计算下列各题\n2. 填空'.padEnd(300, '题目内容');
      const issues = HardRuleChecker.checkDocTitle(content);
      expect(issues.some(i => i.type === '卷首标题缺失')).toBe(true);
    });

    it('有 h1 标题 → 不警告', () => {
      const content = '<h1>第1课时 课时练</h1>' + '题目'.repeat(200);
      const issues = HardRuleChecker.checkDocTitle(content);
      expect(issues.some(i => i.type === '卷首标题缺失')).toBe(false);
    });

    it('首行短标题（无标签）→ 不警告', () => {
      const content = '第1课时 课时练\n题目'.padEnd(300, '内容');
      const issues = HardRuleChecker.checkDocTitle(content);
      expect(issues.some(i => i.type === '卷首标题缺失')).toBe(false);
    });

    it('内容过短不判定', () => {
      const issues = HardRuleChecker.checkDocTitle('简短内容');
      expect(issues.length).toBe(0);
    });
  });

  describe('传统题嫌疑占比（v29 情境化硬指标）', () => {
    const buildExam = (questions) =>
      `<h3>一、基础题（10分）</h3>${questions.map((q, i) => `<p class="question">${i + 1}. ${q}</p>`).join('\n')}<div class="answer-section">参考答案</div>`;

    it('传统题嫌疑占比>30% 时报警', () => {
      const traditional = [
        '长方形的特点是（　　）', '正方形的特点是（　　）', '平行四边形的特点是（　　）',
        '三角形的特点是（　　）', '梯形的特点是（　　）',
        '小明去超市买铅笔', '小红测量操场长度', '计算花坛面积', '统计班级人数', '观察钟表时间',
      ];
      const issues = HardRuleChecker.checkGenTypeSpecific(buildExam(traditional), 'exam', []);
      expect(issues.some(i => i.type === '传统题嫌疑占比过高')).toBe(true);
    });

    it('素养卷（无回忆式设问）不报警', () => {
      const contextual = [
        '小明买3支铅笔每支2元，付了10元应找回多少？', '教室长8米宽6米，面积是多少？',
        '统计小组调查了20名同学最喜欢的运动，请补充统计表', '钟面上显示3时，分针和时针成什么角？',
        '一根绳子对折两次后长3米，原来长多少米？', '学校组织春游，三年级去了128人，四年级比三年级多25人',
        '把24块糖平均分给6个小朋友，每人分几块？', '超市酸奶每盒6元，买4盒需要多少钱？',
        '一段路全长200米，已修80米，还剩多少米？', '李华从家到学校需要15分钟，8:00出发几点到校？',
      ];
      const issues = HardRuleChecker.checkGenTypeSpecific(buildExam(contextual), 'exam', []);
      expect(issues.some(i => i.type === '传统题嫌疑占比过高')).toBe(false);
    });

    it('题量不足5题时不误报', () => {
      const few = ['长方形的特点是（　　）', '正方形的特点是（　　）', '三角形的特点是（　　）', '梯形的特点是（　　）'];
      const issues = HardRuleChecker.checkGenTypeSpecific(buildExam(few), 'exam', []);
      expect(issues.some(i => i.type === '传统题嫌疑占比过高')).toBe(false);
    });
  });

  describe('getIssueSummary', () => {
    it('正确统计错误和警告', () => {
      const issues = [
        { severity: 'error', type: '格式错误', detail: 'test' },
        { severity: 'warning', type: '超纲词汇', detail: 'test' },
        { severity: 'warning', type: '答案不完整', detail: 'test' }
      ];
      const summary = HardRuleChecker.getIssueSummary(issues);
      expect(summary.total).toBe(3);
      expect(summary.errors).toBe(1);
      expect(summary.warnings).toBe(2);
      expect(summary.hasErrors).toBe(true);
    });
  });

  describe('AISemanticReviewer.parseReviewResult', () => {
    it('简短通过回复判为通过', () => {
      const r = AISemanticReviewer.parseReviewResult('✅ 未发现语义问题');
      expect(r.hasIssues).toBe(false);
    });

    it('🔧 回归："虽然没有大问题，但…"不能误判为通过', () => {
      const raw = '虽然没有大问题，但发现一处问题：\n【位置】"……说明文，……" → 【问题类型】错别字 → 【问题描述】"说明"和"文"错误拼接';
      const r = AISemanticReviewer.parseReviewResult(raw);
      expect(r.hasIssues).toBe(true);
      expect(r.issues.length).toBeGreaterThan(0);
    });

    it('标准问题列表能解析出问题', () => {
      const raw = '【位置】"可以能" → 【问题类型】通顺性 → 【问题描述】词语拼接错误';
      const r = AISemanticReviewer.parseReviewResult(raw);
      expect(r.hasIssues).toBe(true);
      expect(r.issues[0]).toContain('可以能');
    });

    it('空响应不报问题', () => {
      const r = AISemanticReviewer.parseReviewResult('');
      expect(r.hasIssues).toBe(false);
    });
  });

  describe('AISemanticReviewer.buildReviewPrompt', () => {
    it('🔧 超 6000 字不再截断（12000 截断线）', () => {
      const long = '<p>' + '语文测试内容。'.repeat(900) + '</p>'; // 纯文本约 6300 字
      const prompt = AISemanticReviewer.buildReviewPrompt(long, { genType: 'exam', subject: '语文' });
      // 6300 字 < 12000 截断线 → 完整保留，不出现截断提示
      expect(prompt).not.toContain('后续内容已截断');
      expect(prompt).toContain('语文测试内容。');
    });

    it('超 12000 字才截断', () => {
      const long = '<p>' + '语文测试内容。'.repeat(2000) + '</p>'; // 纯文本约 14000 字
      const prompt = AISemanticReviewer.buildReviewPrompt(long, { genType: 'exam', subject: '语文' });
      expect(prompt).toContain('后续内容已截断');
      expect(prompt).toContain('仅审查以上部分');
    });

    it('短内容不截断', () => {
      const prompt = AISemanticReviewer.buildReviewPrompt('<p>短文内容</p>', { genType: 'exam' });
      expect(prompt).not.toContain('后续内容已截断');
    });
  });

  describe('checkBlankEmptyTags（填空空标签，全类型）', () => {
    it('真空标签报规范建议（warning，非error——导出端按 class N 兜底宽度）', () => {
      const issues = HardRuleChecker.checkBlankEmptyTags('<p>光合作用的场所是<u class="blank-2"></u></p>');
      expect(issues.some(i => i.type === '填空空标签' && i.severity === 'warning')).toBe(true);
      expect(issues.some(i => i.type === '填空空标签' && i.severity === 'error')).toBe(false);
    });
    it('仅空白的标签同样报规范建议', () => {
      const issues = HardRuleChecker.checkBlankEmptyTags('<p>选出正确读音<span class="blank-4"> </span></p>');
      expect(issues.some(i => i.type === '填空空标签')).toBe(true);
    });
    it('含 &emsp; 的标签不报错', () => {
      const issues = HardRuleChecker.checkBlankEmptyTags('<p><u class="blank-2">&emsp;</u><span class="blank-4">&emsp;</span></p>');
      expect(issues.filter(i => i.type === '填空空标签').length).toBe(0);
    });
    it('填空空标签可自动修复（autoFix 自动补 &emsp;，修复后不再检出）', () => {
      const content = '<p>1. 春联：<u class="blank-4"> </u>（hú dié）飞。</p><p>2. <span class="blank-6"></span></p>';
      const issues = HardRuleChecker.checkBlankEmptyTags(content);
      const fixed = HardRuleChecker.autoFix(content, issues);
      expect(fixed).toContain('&emsp;');
      expect(fixed).not.toMatch(/<(u|span)\s+class="blank-\d+"[^>]*>\s*<\/(?:u|span)>/);
      expect(HardRuleChecker.checkBlankEmptyTags(fixed).length).toBe(0);
    });
  });

  describe('checkScoreConsistency（分数层级一致性）', () => {
    it('同分大题算术正确不报', () => {
      const issues = HardRuleChecker.checkScoreConsistency('一、选择题（本大题共8小题，每小题4分，共32分）满分：100分');
      expect(issues.filter(i => i.type === '分值计算不一致').length).toBe(0);
    });
    it('同分大题算术错误报错（题数×每题分≠总分）', () => {
      const issues = HardRuleChecker.checkScoreConsistency('一、选择题（本大题共3小题，每小题4分，共9分）');
      expect(issues.some(i => i.type === '分值计算不一致')).toBe(true);
    });
    it('大题之和=满分不报', () => {
      const issues = HardRuleChecker.checkScoreConsistency('满分：100分。一、识字（本大题共8题，每题4分，共32分）。二、阅读（本大题共4题，共14分）。三、表达（本大题共2题，共30分）四、积累（本大题共8题，每题3分，共24分）');
      expect(issues.filter(i => i.type === '分值汇总不一致').length).toBe(0);
    });
    it('大题之和≠满分报错', () => {
      const issues = HardRuleChecker.checkScoreConsistency('满分：100分。一、识字（本大题共8题，每题4分，共32分）。二、阅读（本大题共4题，共14分）。三、表达（本大题共2题，共40分）');
      expect(issues.some(i => i.type === '分值汇总不一致')).toBe(true);
    });
    it('答案区重复大题标题不重复计数（去重防误报）', () => {
      const issues = HardRuleChecker.checkScoreConsistency('满分：32分。一、识字（本大题共8题，每题4分，共32分）。<div class="answer-section">一、识字（本大题共8题，每题4分，共32分）</div>');
      expect(issues.filter(i => i.type === '分值汇总不一致').length).toBe(0);
    });
    it('小题"每空X分，共X分"不误算入大题合计', () => {
      const issues = HardRuleChecker.checkScoreConsistency('满分：10分。一、默写（本大题共1题，共10分）。默写。（每空1分，共10分）');
      expect(issues.filter(i => i.type === '分值汇总不一致').length).toBe(0);
    });
  });

  describe('checkChoiceOptionsMissing（选择题缺选项）', () => {
    it('选择题无选项报错', () => {
      const content = '<p class="question">1. 下列说法正确的是（　　）</p><div class="answer-section">A</div>';
      const issues = HardRuleChecker.checkChoiceOptionsMissing(content);
      expect(issues.some(i => i.type === '选择题缺少选项')).toBe(true);
    });
    it('选择题有选项不报错', () => {
      const content = '<p class="question">1. 下列说法正确的是</p><p class="option">A. 太阳从东边升起</p><p class="option">B. 太阳从西边升起</p><div class="answer-section">A</div>';
      const issues = HardRuleChecker.checkChoiceOptionsMissing(content);
      expect(issues.filter(i => i.type === '选择题缺少选项').length).toBe(0);
    });
    it('非选择题不误报', () => {
      const content = '<p class="question">1. 选择正确的读音并抄写：chūn tiān</p><div class="answer-section">春天</div>';
      const issues = HardRuleChecker.checkChoiceOptionsMissing(content);
      expect(issues.filter(i => i.type === '选择题缺少选项').length).toBe(0);
    });
  });

  describe('checkAnswerSectionEmpty（答案区空内容）', () => {
    it('答案区为空报错', () => {
      const issues = HardRuleChecker.checkAnswerSectionEmpty('<p>题目</p><div class="answer-section"><p>　</p></div>');
      expect(issues.some(i => i.type === '答案区空内容')).toBe(true);
    });
    it('答案区有内容不报错', () => {
      const issues = HardRuleChecker.checkAnswerSectionEmpty('<p>题目</p><div class="answer-section"><p>答案：春天来了，小鸟在树上唱歌。</p></div>');
      expect(issues.filter(i => i.type === '答案区空内容').length).toBe(0);
    });
  });
});
