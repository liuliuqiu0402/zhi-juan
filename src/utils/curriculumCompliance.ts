/**
 * 新课标内容达标评估器（生成后逐题核查，输出结构化达标报告）
 * ============================================================
 * 🔴 目的：回答"生成的具体内容是否达标、每一小题组成的整体是否符合新课标"——
 *    不靠人工肉眼判断，程序化按维度逐项评估并打分，输出可核查结论。
 *
 * 评估维度（全部有数据依据，非拍脑袋）：
 *   D1 情境化     — 题目是否置于真实情境（引用 GENERAL_CONTENT_QUALITY 情境真实条款）
 *   D2 设问层次   — 提取/理解/推理 三层设问词覆盖（引用 QUESTION_DEPTH_LEVELS）
 *   D3 素养立意   — 是否体现素养导向（情境/设问/选材综合判断）
 *   D4 机械记忆   — 机械记忆型设问检测（引用 PROPOSITION_BENCHMARKS checkers.banMechanical）
 *   D5 语篇长度   — 阅读/听力材料长度分档（引用 PASSAGE_LENGTH）
 *   D6 超纲检测   — 学段超纲词汇（引用 qualityChecker GRADE_VOCABULARY 同源逻辑）
 *   D7 分值体系   — 小题分之和=大题分、大题之和=满分（分值层级验算）
 *   D8 素养术语   — 学科核心素养关键词体现（引用 qualityChecker COMPETENCY_TERMS 同源）
 *
 * 输出：{ overall, dimensions: [{id, name, passed, score, detail, evidence[]}], summary }
 *   overall: '通过' | '基本通过' | '待改进'（全部通过→通过；≤2项未过→基本通过；否则待改进）
 * ============================================================
 */
import {
  PROPOSITION_BENCHMARKS,
  GENERAL_CONTENT_QUALITY,
  PASSAGE_LENGTH,
  QUESTION_DEPTH_LEVELS,
} from '../config/propositionBenchmarks';

// 与 qualityChecker.GRADE_VOCABULARY 同源的超纲词汇表（独立维护避免循环依赖，保持一致）
const GRADE_VOCABULARY = {
  '小学': {
    '数学': { warn: ['方程', '负数', '代数', '几何证明', '函数', '坐标系', '概率', '统计图'] },
    '语文': { warn: ['文言文', '议论文', '修辞手法', '语法分析', '文学鉴赏'] },
    '英语': { warn: ['语法填空', '完形填空', '阅读理解长篇', '书面表达'] }
  },
  '初中': {
    '数学': { warn: ['导数', '微积分', '对数函数', '复数', '向量', '矩阵', '概率密度'] },
    '物理': { warn: ['量子力学', '相对论', '核物理', '电磁波谱', '光电效应'] },
    '化学': { warn: ['有机化学', '电化学', '化学平衡', '晶体结构'] },
    '英语': { warn: ['学术英语', '科技英语', '商务英语'] }
  },
  '高中': {
    '数学': { warn: ['泛函分析', '拓扑学', '数论', '微分几何'] },
    '物理': { warn: ['量子场论', '广义相对论', '粒子物理'] },
    '化学': { warn: ['高分子化学', '核化学', '生物化学'] }
  }
};

// 学科核心素养关键词（与 qualityChecker COMPETENCY_TERMS 同源，覆盖全学科×全学段）
const COMPETENCY_TERMS = {
  '语文': { primary: ['识字与写字', '阅读与鉴赏', '表达与交流', '梳理与探究', '文化自信', '语言运用', '思维能力', '审美创造'], middle: ['语言积累', '阅读与鉴赏', '表达与交流', '梳理与探究', '整本书阅读', '思辨性阅读', '文学鉴赏'], high: ['语言建构', '思维发展', '审美鉴赏', '文化传承', '学习任务群', '思辨读写', '专题研习'] },
  '数学': { primary: ['数感', '量感', '运算能力', '空间观念', '几何直观', '数据意识', '模型意识', '应用意识', '创新意识'], middle: ['抽象能力', '运算能力', '几何直观', '空间观念', '推理能力', '数据观念', '模型观念', '应用意识', '创新意识'], high: ['数学抽象', '逻辑推理', '数学建模', '直观想象', '数学运算', '数据分析', '核心素养'] },
  '英语': { primary: ['语言能力', '文化意识', '思维品质', '学习能力', '听说', '读写', '语篇'], middle: ['语言能力', '文化意识', '思维品质', '学习能力', '语篇理解', '跨文化交际'], high: ['语言能力', '文化意识', '思维品质', '学习能力', '批判性思维', '学术素养'] },
  '物理': { middle: ['物理观念', '科学思维', '科学探究', '科学态度', '模型建构', '实验'], high: ['物理观念', '科学思维', '科学探究', '科学态度', '模型建构', '科学论证', '质疑创新'] },
  '化学': { middle: ['化学观念', '科学思维', '科学探究', '科学态度', '实验', '微观探析'], high: ['宏观辨识', '微观探析', '变化观念', '平衡思想', '证据推理', '模型认知', '科学探究', '创新意识'] },
  '生物': { middle: ['生命观念', '科学思维', '科学探究', '社会责任', '结构与功能', '进化与适应'], high: ['生命观念', '科学思维', '科学探究', '社会责任', '稳态与平衡', '进化与适应观'] },
  '历史': { middle: ['唯物史观', '时空观念', '史料实证', '历史解释', '家国情怀', '时序'], high: ['唯物史观', '时空观念', '史料实证', '历史解释', '家国情怀', '历史论述'] },
  '地理': { middle: ['人地协调观', '综合思维', '区域认知', '地理实践力', '空间定位'], high: ['人地协调观', '综合思维', '区域认知', '地理实践力', '区域比较'] },
  '道德与法治': { primary: ['政治认同', '道德修养', '法治观念', '健全人格', '责任意识'], middle: ['政治认同', '道德修养', '法治观念', '健全人格', '责任意识', '公共参与'] },
  '思想政治': { high: ['政治认同', '科学精神', '法治意识', '公共参与', '辩证思维'] },
  '科学': { primary: ['科学探究', '科学思维', '科学态度', '社会责任', '物质科学', '生命科学', '地球与宇宙', '技术与工程'] },
  '信息科技': { primary: ['信息意识', '计算思维', '数字化学习', '信息社会责任'], middle: ['信息意识', '计算思维', '数字化学习', '信息社会责任', '算法', '数据'], high: ['信息意识', '计算思维', '数字化学习', '信息社会责任', '算法思维', '数据安全'] },
  '音乐': { primary: ['审美感知', '艺术表现', '文化理解', '创意实践'], middle: ['审美感知', '艺术表现', '文化理解', '创意实践'], high: ['审美感知', '艺术表现', '文化理解', '创意实践', '音乐鉴赏'] },
  '美术': { primary: ['审美感知', '艺术表现', '创意实践', '文化理解'], middle: ['审美感知', '艺术表现', '创意实践', '文化理解', '图像识读'], high: ['审美感知', '艺术表现', '创意实践', '文化理解', '美术鉴赏', '图像识读'] },
  '体育': { primary: ['运动能力', '健康行为', '体育品德'], middle: ['运动能力', '健康行为', '体育品德', '运动技能'], high: ['运动能力', '健康行为', '体育品德', '运动技能', '健康素养'] },
};

// 情境真实性词汇（题目是否置于真实情境：生活/校园/家庭/社会/科技/传统文化等）
const CONTEXT_WORDS = ['生活中', '小明', '学校', '班级', '家庭', '社区', '超市', '商场', '公园', '植树', '运动会', '科技', '航天', '环保', '回收', '节约', '传统节日', '春节', '中秋节', '端午', '厨房', '菜市场', '图书馆', '车站', '医院', '快递', '网购', '疫情', '志愿者', '研学'];

// 机械记忆检测默认词（补充：各学科 checkers 之外的通用机械句式）
const MECHANICAL_WORDS = ['根据课文内容填空', '背诵默写', '默写古诗', '看拼音，写词语：___（背诵', '的定义是', '叫做', '是____'];

// 推断/评价层设问词（推理层）；小学低段允许口语化高阶设问（课标"低段用口语化设问"）
const INFER_WORDS = ['为什么', '你认为', '推断', '推测', '结合全文分析', '评价', '谈谈你的看法', '启示', '体会', '情感', '理由', '原因'];
const INFER_WORDS_PRIMARY = INFER_WORDS.concat(['想一想', '你喜欢', '你会', '应该', '怎么做', '怎么说', '说说', '如果你']);

// 信息提取层设问词
const EXTRACT_WORDS = ['找出', '圈出', '划出', '是什么', '谁', '何时', '何地', '有多少', '哪些'];

/**
 * 解析生成内容中的题目文本（剥离 HTML）
 */
export const extractQuestions = (content) => {
  if (!content) return [];
  const clean = content.replace(/<div[^>]*class="answer-section"[^>]*>[\s\S]*$/i, ''); // 去掉答案区
  const blocks = clean.match(/<p[^>]*class="[^"]*question[^"]*"[^>]*>[\s\S]*?<\/p>/gi)
    || clean.match(/<(?:p|div|li)[^>]*>\s*(?:\d+|[一二三四五六七八九十]+)[\.、．)）]\s*[\s\S]*?<\/(?:p|div|li)>/gi)
    || [];
  return blocks.map(b => b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(t => t.length > 5);
};

/**
 * 主评估函数
 * @param {string} content 生成内容（HTML）
 * @param {string} subject 学科
 * @param {string} stageSeg 学段键（primary_low/middle/high 或 中文）
 * @param {string} genType 资料类型（exam 正式考卷卷面不印素养术语，与 qualityChecker 豁免一致）
 * @returns {object} 达标报告
 */
export function assessCompliance(content, subject, stageSeg, genType = '') {
  if (!content) {
    return { overall: '待改进', summary: '无内容可评估', dimensions: [] };
  }
  const clean = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const questions = extractQuestions(content);
  const questionText = questions.join('\n');

  // 学段归一
  const stageMap = { '小学': 'primary', '初中': 'middle', '高中': 'high' };
  const stageKey = stageMap[stageSeg] || (stageSeg || 'middle').replace(/^primary.*/, 'primary');
  const stageLabel = stageKey === 'primary' ? '小学' : stageKey === 'middle' ? '初中' : '高中';
  const bench = PROPOSITION_BENCHMARKS[subject];
  const benchStage = bench ? (bench[stageKey] || bench[stageSeg] || bench['middle'] || null) : null;

  const dimensions = [];

  // D1 情境化：题目文本是否出现真实情境词（有题目时；无题目时用全文判断）
  const ctxHits = CONTEXT_WORDS.filter(w => questionText.includes(w) || (questions.length === 0 && clean.includes(w)));
  const contextScore = questions.length === 0
    ? (ctxHits.length ? 80 : 40)
    : Math.min(100, 30 + ctxHits.length * 15);
  dimensions.push({
    id: 'D1', name: '情境化（真实情境载体）',
    passed: ctxHits.length > 0 || questions.length === 0,
    score: contextScore,
    detail: ctxHits.length
      ? `检测到 ${ctxHits.length} 处真实情境词（${ctxHits.slice(0, 5).join('、')}${ctxHits.length > 5 ? '等' : ''}），题目非裸考知识点`
      : '未检测到明显情境载体（生活/校园/科技/传统文化等），存在裸考知识点风险',
    evidence: ctxHits.slice(0, 8),
  });

  // D2 设问层次：提取/推理 两层词覆盖（小学允许口语化高阶设问，课标"低段用口语化设问"）
  const inferWords = stageKey === 'primary' ? INFER_WORDS_PRIMARY : INFER_WORDS;
  const hasExtract = EXTRACT_WORDS.some(w => questionText.includes(w));
  const hasInfer = inferWords.some(w => questionText.includes(w));
  const depthScore = hasInfer ? (hasExtract ? 95 : 75) : (hasExtract ? 55 : 40);
  dimensions.push({
    id: 'D2', name: '设问层次（提取→理解→推理递进）',
    passed: hasInfer && hasExtract,
    score: depthScore,
    detail: hasInfer
      ? (hasExtract ? '检测到信息提取与推理评价两层设问，层次递进符合新课标' : '检测到推理层设问，但缺少信息提取类设问（层次可能不完整）')
      : '未检测到推理/评价层设问（为什么/你认为/结合全文分析等），设问层次可能单一',
    evidence: [],
  });

  // D3 素养立意：GENERAL_CONTENT_QUALITY 情境真实 + 素养立意条款的体现（情境词 + 素养术语综合）
  const hasLiyang = ctxHits.length > 0 || hasInfer;
  const liyangScore = hasLiyang ? 85 : 50;
  dimensions.push({
    id: 'D3', name: '素养立意（减少机械记忆、考查核心素养）',
    passed: hasLiyang,
    score: liyangScore,
    detail: hasLiyang ? '题目通过情境与高层次设问体现素养立意导向' : '题目偏知识考查，素养立意体现不足',
    evidence: [],
  });

  // D4 机械记忆：机械句式检测（学科 checkers + 通用词）
  const banWords = (benchStage?.checkers?.banMechanical || []).concat(MECHANICAL_WORDS);
  const mechHits = banWords.filter(w => w && clean.includes(w));
  dimensions.push({
    id: 'D4', name: '机械记忆题检测',
    passed: mechHits.length === 0,
    score: mechHits.length === 0 ? 95 : 40,
    detail: mechHits.length ? `检测到机械记忆型设问：${mechHits.join('、')}` : '未检测到机械记忆型设问句式',
    evidence: mechHits.slice(0, 5),
  });

  // D5 语篇长度：仅当检测到"疑似语篇"（连续长句群）时校验分档；无长语篇（纯小题卷/计算卷）跳过不误报
  const passageRange = PASSAGE_LENGTH[subject]?.[stageKey] || PASSAGE_LENGTH[subject]?.[stageSeg];
  const sentences = clean.split(/[。！？；]/).filter(s => s.trim().length > 15);
  const hasLongPassage = sentences.length >= 2 && sentences.some(s => s.length > 60);
  let passageScore = 80;
  let passageDetail = '未检测到完整语篇材料（阅读/听力类），跳过语篇长度校验';
  if (passageRange && hasLongPassage) {
    const longest = sentences.reduce((a, b) => b.length > a.length ? b : a, '');
    if (longest.length > passageRange.max) {
      passageScore = 45;
      passageDetail = `最长语篇约${longest.length}字，超出${subject}${stageLabel}分档上限（${passageRange.max}字）`;
    } else if (longest.length < passageRange.min) {
      passageScore = 60;
      passageDetail = `最长语篇约${longest.length}字，低于分档下限（${passageRange.min}字），材料可能偏短`;
    } else {
      passageScore = 90;
      passageDetail = `语篇长度在分档内（${passageRange.min}-${passageRange.max}字）`;
    }
  }
  dimensions.push({
    id: 'D5', name: '语篇长度分档（学段匹配）',
    passed: passageScore >= 70,
    score: passageScore,
    detail: passageDetail,
    evidence: [],
  });

  // D5b 听力占比（仅英语，与蓝本 EXAM_BLUEPRINTS 英语听力板块占比同源：
  //   小学低段40% / 中段35% / 高段30%，初中25/120≈21%，高中30/150=20%）
  if (subject === '英语' && /听力|听音|Listening/i.test(clean)) {
    const listenRatioMap = {
      primary: [0.28, 0.42], // 小学聚合（覆盖低段40%/中段35%/高段30%）
      primary_low: [0.38, 0.42], primary_mid: [0.28, 0.36], primary_high: [0.28, 0.32],
      middle: [0.18, 0.26], high: [0.18, 0.22],
    };
    const range = listenRatioMap[stageKey] || listenRatioMap[stageSeg] || listenRatioMap['middle'];
    // 从大题标题行提取听力板块分值：匹配"听力/听音"标题行内的"共X分"
    const listenScore = (content.match(/<h[23][^>]*>[^<]*(?:听力|听音|Listening)[^<]*<\/h[23]>/gi) || [])
      .map(h => { const v = h.match(/共\s*(\d+)\s*分/); return v ? parseInt(v[1]) : 0; })
      .reduce((a, b) => a + b, 0);
    const totalMatch = content.match(/满分[：:]\s*(\d+)/);
    const fullScore = totalMatch ? parseInt(totalMatch[1]) : 0;
    if (listenScore > 0 && fullScore > 0) {
      const ratio = listenScore / fullScore;
      const [min, max] = range;
      const ok = ratio >= min - 0.01 && ratio <= max + 0.01;
      dimensions.push({
        id: 'D5b', name: '听力分值占比（学段区间）',
        passed: ok,
        score: ok ? 90 : 40,
        detail: ok
          ? `听力 ${listenScore}/${fullScore}分（${(ratio * 100).toFixed(0)}%），在${subject}${stageLabel}合理区间 ${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}% 内`
          : `听力 ${listenScore}/${fullScore}分（${(ratio * 100).toFixed(0)}%），超出${subject}${stageLabel}合理区间 ${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}%（应调整听力与笔试板块分值）`,
        evidence: [],
      });
    }
  }

  // D6 超纲检测
  const warnWords = GRADE_VOCABULARY[stageLabel]?.[subject]?.warn || [];
  const overHits = warnWords.filter(w => clean.includes(w));
  dimensions.push({
    id: 'D6', name: '学段超纲检测',
    passed: overHits.length === 0,
    score: overHits.length === 0 ? 95 : 40,
    detail: overHits.length ? `检测到可能超纲词汇：${overHits.join('、')}` : `未检测到${stageLabel}${subject}超纲词汇`,
    evidence: overHits.slice(0, 5),
  });

  // D7 分值体系：大题标题分值求和校验（仅当有分值标注时判定）
  const sectionScores = (content.match(/[（(]共\s*\d+\s*题[^）)]*共\s*(\d+)\s*分[）)]/g) || [])
    .map(m => { const v = m.match(/共\s*(\d+)\s*分/); return v ? parseInt(v[1]) : 0; })
    .filter(n => n > 0);
  const totalMatch = content.match(/满分[：:]\s*(\d+)/);
  const fullScore = totalMatch ? parseInt(totalMatch[1]) : 0;
  const sectionSum = sectionScores.reduce((a, b) => a + b, 0);
  // 无分值标注（非试卷/分段资料）或板块数<2 时不判定（避免对部分资料误报）
  let scoreOk = sectionScores.length < 2;
  let scoreDetail = sectionScores.length === 0
    ? '未检测到大题分值标注（非试卷型资料或分值缺失）'
    : `检测到 ${sectionScores.length} 个大题带分值（合计${sectionSum}分）`;
  if (sectionScores.length >= 2 && fullScore > 0) {
    scoreOk = sectionSum === fullScore;
    scoreDetail = scoreOk ? `大题分值之和（${sectionSum}）== 满分（${fullScore}）✓` : `大题分值之和（${sectionSum}）≠ 满分（${fullScore}），分值体系异常`;
  } else if (sectionScores.length >= 2) {
    scoreDetail = `检测到 ${sectionScores.length} 个大题带分值（合计${sectionSum}分），但卷首未标注满分，无法校验`;
  }
  dimensions.push({
    id: 'D7', name: '分值体系（大题之和=满分）',
    passed: scoreOk,
    score: scoreOk ? 90 : 45,
    detail: scoreDetail,
    evidence: [],
  });

  // D8 素养术语：exam 正式考卷卷面不印素养术语（与 qualityChecker 豁免一致），仅非 exam 评估
  const isExam = genType === 'exam';
  const terms = COMPETENCY_TERMS[subject]?.[stageKey] || [];
  let termHits = [];
  if (terms.length && !isExam) {
    termHits = terms.filter(t => clean.includes(t));
  }
  const termRate = terms.length ? termHits.length / terms.length : 0;
  dimensions.push({
    id: 'D8', name: '核心素养术语体现',
    passed: isExam || termRate >= 0.3 || terms.length === 0,
    score: isExam ? 85 : terms.length === 0 ? 80 : Math.round(termRate * 100),
    detail: isExam
      ? '正式考卷卷面不印素养术语（素养体现在情境化设问），豁免'
      : terms.length === 0
        ? '该学段无素养术语映射，跳过'
        : `素养术语命中 ${termHits.length}/${terms.length}（${Math.round(termRate * 100)}%）${termRate >= 0.3 ? '，体现素养导向' : '，建议加强素养导向表述'}`,
    evidence: termHits.slice(0, 6),
  });

  // 汇总
  const failed = dimensions.filter(d => !d.passed);
  const avgScore = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);
  const overall = failed.length === 0 ? '通过' : failed.length <= 2 ? '基本通过' : '待改进';
  const summary = `${subject}${stageLabel}内容达标评估：${failed.length === 0 ? '全部维度通过，内容符合新课标要求' : `${failed.length}/${dimensions.length} 维度未达标（${failed.map(d => d.id + ':' + d.name).join('、')}），建议按提示修正后重新生成`}。综合得分 ${avgScore}/100。共 ${questions.length} 道小题参与评估。`;

  return { overall, summary, avgScore, questionCount: questions.length, dimensions };
}

export default { assessCompliance, extractQuestions };