/**
 * 命题内容质量基准库（数据驱动，覆盖全学科 × 学段 × 资料类型）
 * ============================================================
 * 🔴 根治目的：内容为王——生成的内容必须达到"真题级"可作正式考卷/教学用。
 *    结构层（题型骨架/分值/格式）由 examPaperBlueprints 锁定；
 *    内容层（语篇真实/情境适切/设问层次/素养立意）由本基准库驱动：
 *      生成时：buildGenerationInstruction 按 学科×学段 自动注入「内容质量规范 + 真题级样例」，
 *              所有 genType（exam/practice/special/preview/review/dictation/reading/errorbook）通用，
 *              不再靠模型自由发挥；
 *      生成后：qualityChecker 按本库的 checkers 参数做程序化内容质检（语篇长度分档/设问层次词/机械记忆题检测等）。
 *
 * 数据来源（非拍脑袋）：各学科 2022 版新课标命题/评价建议、教育部《2022中考命题工作通知》、
 *    各地真题卷结构调研；每条 basis 注明依据，随调研持续充实。
 * ============================================================
 */

/** 通用内容质量底线（教育部 2022 中考命题通知：素养立意、减少机械记忆、增加探究/开放/综合、情境适切） */
export const GENERAL_CONTENT_QUALITY = [
  '素养立意：以考查学科核心素养为目标，杜绝死记硬背与机械训练式试题',
  '情境真实：题目必须置于真实、适切的情境中（联系城乡学生生活实际），禁止凭空想象的情境与虚构任务',
  '设问有层次：从信息提取→理解分析→推理评价递进，避免全部平铺直叙的单点问答',
  '杜绝偏题怪题与超纲：考查内容严格对齐课标学段要求',
];

/** 语篇长度分档（词/字，按学段；用于程序化质检与生成约束） */
export const PASSAGE_LENGTH = {
  '语文': { 'primary': { min: 80, max: 300 }, 'middle': { min: 300, max: 900 }, 'high': { min: 600, max: 1600 } },
  '英语': { 'primary_low': { min: 60, max: 100 }, 'primary_mid': { min: 100, max: 160 }, 'primary_high': { min: 160, max: 250 }, 'middle': { min: 200, max: 350 }, 'high': { min: 350, max: 450 } },
  '数学': { 'primary': { min: 20, max: 120 }, 'middle': { min: 40, max: 200 }, 'high': { min: 60, max: 300 } },
  '物理': { 'middle': { min: 40, max: 200 }, 'high': { min: 60, max: 300 } },
  '化学': { 'middle': { min: 40, max: 200 }, 'high': { min: 60, max: 300 } },
  '生物': { 'middle': { min: 40, max: 200 }, 'high': { min: 60, max: 300 } },
  '道德与法治': { 'middle': { min: 60, max: 300 }, 'high': { min: 80, max: 400 } },
  '思想政治': { 'high': { min: 80, max: 400 } },
  '历史': { 'middle': { min: 60, max: 300 }, 'high': { min: 80, max: 400 } },
  '地理': { 'middle': { min: 60, max: 300 }, 'high': { min: 80, max: 400 } },
  '科学': { 'primary': { min: 40, max: 200 }, 'middle': { min: 60, max: 300 } },
};

/** 设问层次词（用于质检：一篇语篇的设问应覆盖多个层次） */
export const QUESTION_DEPTH_LEVELS = {
  '提取': ['找出', '圈出', '划出', '哪', '是什么', '谁', '何时', '何地', '有多少'],
  '理解': ['理解', '含义', '意思', '说明', '描写', '叙述', '概括', '大意', '主要内容'],
  '推理': ['推断', '推测', '为什么', '原因', '理由', '体会', '情感', '启示', '你认为', '看法', '评价', '作用', '影响'],
};

/**
 * 学科命题内容质量基准
 * key: 学科 → 学段组（primary/middle/high，小学内部再按 low/mid/high 细分时用同一组或细分键）
 * 每个条目：
 *   basis      — 依据来源（课标命题建议/教育部文件/真题调研）
 *   quality    — 该学科该学段的内容质量硬规范（生成时注入）
 *   samples    — 真题级样例片段（生成时注入，供模型模仿）
 *   checkers   — 程序化质检参数（语篇长度/设问层次/机械记忆词等）
 */
export const PROPOSITION_BENCHMARKS = {
  '语文': {
    basis: '2022版语文课标·评价建议＋教育部2022中考命题通知（素养立意/情境真实/减少机械记忆）',
    'primary': {
      quality: [
        '字词考查必须置于语句或语境中，禁止孤立罗列拼音写词/组词/注音',
        '阅读材料须为完整短文（80-300字），话题贴近儿童生活（校园/家庭/自然/传统文化），禁止课文原句拼接',
        '阅读设问沿"信息提取→词句理解→整体把握"递进，低段不考鉴赏',
        '写话/看图写话给出情境支架（提示词/问题引导/图片），禁止只给题目',
      ],
      samples: ['写话示例：看图写话配图描述"春天公园放风筝"，支架问题：图中有什么？他们在做什么？心情怎样？——供模仿情境创设与支架方式'],
      checkers: { minPassage: 80, maxPassage: 300, requireDepth: true, banMechanical: ['填空：', '看拼音，写词语：'] },
    },
    'middle': {
      quality: [
        '积累运用型填空考理解运用（归类/比喻理解/品质推断/情境运用轮换），禁止单点回忆背诵',
        '阅读材料为完整语篇（300-900字），选材兼顾文学类（记叙/散文）与实用类（说明/非连续文本）',
        '设问沿"信息提取→关键词句理解→整体把握→推断鉴赏"递进，每篇至少1题推断或赏析',
        '写作给选材提示或情境支架（可用词语/问题引导/图片），不得只给题目',
        '文言文/古诗考查置于语篇语境，禁止孤立考字义背诵',
      ],
      samples: ['阅读设问示例：先问"文中描写了哪些景物"，再问"作者为什么说____（推断）"，末问"表达了怎样的情感（鉴赏）"——供模仿设问梯度'],
      checkers: { minPassage: 300, maxPassage: 900, requireDepth: true, banMechanical: ['根据课文内容填空：', '默写古诗：'] },
    },
    'high': {
      quality: [
        '现代文阅读选材为经典与时文结合的真实语篇（600-1600字），设问含"为什么/你认为/结合文本分析"等思维层级',
        '文言文阅读含课内迁移课外，考查实词推断/句意理解/主旨把握，禁止孤立考词义',
        '写作（记叙/议论文）给情境任务（情境+要求+提示），命题反套路反背素材',
        '语言文字运用题在语篇语境中设问（补写/修辞/连贯），禁止孤立语法题',
      ],
      samples: ['作文任务示例：以"校园里的一件小事"为情境，要求写出你的看法与理由（议论文向）——供模仿任务情境创设'],
      checkers: { minPassage: 600, maxPassage: 1600, requireDepth: true },
    },
  },

  '数学': {
    basis: '2022版数学课标·评价建议（情境真实/说理表达/开放探究/综合与实践）',
    'primary': {
      quality: [
        '应用题以真实生活情境为载体（购物/分物/测量/时间/图形拼摆），考查"读题→列式→计算→作答"完整过程，禁止纯式子计算题',
        '设置1题说理或开放题（"你同意吗/说说你的想法/你能提出什么问题"）',
        '概念/进率考查置于情境或操作中，禁止"1米=____厘米""长方形的对边____"式孤立填空',
        '计算题合理覆盖口算/笔算/估算，禁止整卷全是机械计算',
      ],
      samples: ['应用题示例：妈妈买3千克苹果每千克5元，付给售货员20元，应找回多少元？——供模仿情境与步骤'],
      checkers: { requireDepth: true, banMechanical: ['填空', '口算'] },
    },
    'middle': {
      quality: [
        '应用题情境真实（行程/工程/方案设计/统计决策），考查建模完整过程',
        '设问含"为什么/说说你的思路/你同意吗"等说理题，考查数学表达',
        '设置一题多解/答案不唯一的开放题；基础题变式考查而非照搬例题',
        '几何/函数题给图或可作图，禁止无图空转',
      ],
      samples: ['开放题示例：你能用几种方法计算24点？写出你的想法——供模仿开放设问'],
      checkers: { requireDepth: true },
    },
    'high': {
      quality: [
        '解答题情境真实（函数建模/概率统计/立体几何实际应用），考查建模→运算→论证完整过程',
        '设问分层：基础设问→进阶设问→挑战设问（如压轴题分3问递进）',
        '新定义/探究题给出明确规则与示例，禁止超纲与偏怪',
      ],
      samples: ['压轴题结构示例：第(1)问基础结论→第(2)问中等推理→第(3)问综合探究——供模仿分层设问'],
      checkers: { requireDepth: true },
    },
  },

  '英语': {
    basis: '2022版英语课标·评价建议（听说同步/三大主题语境）＋中高考真题结构调研',
    'primary': {
      quality: [
        '听力板块必须在答案页完整写出听力原文（供教师朗读）；语速70-110词/分、每段读两遍；材料为自然口语（停顿/重复/纠正）',
        '听力题量锚定：每板块5小题；题型听音选图/判断/排序/选答语，指令规范"听录音，选出…"',
        '阅读/听力材料为完整地道语篇，话题取自三大主题语境且贴近学段生活，禁止课文拼接、禁止中式英语',
        '书面表达给要点/图片支架',
      ],
      samples: ['听力原文示例：M: What time do you get up? W: I get up at six thirty.——供模仿篇幅难度'],
      checkers: { minPassage: 60, maxPassage: 250, requireListeningScript: true, requireDepth: true },
    },
    'middle': {
      quality: [
        '听力按真题结构：短对话理解5题（各1分）＋长对话理解5题（各2分）＋短文理解5题（各1分）＋信息转换5题（各1分，每空一词）共20题25分，每段读两遍',
        '阅读语篇200-350词，设问沿"信息提取→推理判断→主旨概括"递进，每篇至少1题推理',
        '完形/语法填空在语篇语境中考查，禁止孤立语法题',
        '书面表达给要点/提示词并示范开头',
      ],
      samples: ['信息转换示例：听短文填表（Name/Time/Place/Activity，每空一词）——供模仿听力任务形式'],
      checkers: { minPassage: 200, maxPassage: 350, requireListeningScript: true, requireDepth: true },
    },
    'high': {
      quality: [
        '听力30分20题（短对话5题＋长对话/独白15题），语速120-140词/分，每段读两遍（2026起短对话也两遍）',
        '阅读4篇（350-450词）含七选五，设问含细节/推理/主旨/词义猜测',
        '写作（应用文15分＋读后续写25分）给出情境任务；读后续写给前文与段首句',
      ],
      samples: ['读后续写示例：给出前文情境与段首句，要求续写2段——供模仿任务设计'],
      checkers: { minPassage: 350, maxPassage: 450, requireListeningScript: true, requireDepth: true },
    },
  },

  '物理': {
    basis: '2022版物理课标·评价建议（科学探究/真实情境/模型建构）',
    'middle': {
      quality: [
        '实验探究题体现"提出问题→方案设计→操作与数据→结论与评价"完整过程',
        '计算题以真实情境为载体（交通工具/家用电器/运动场景），要求建模（示意图→列式→计算→作答）',
        '设置图像/表格数据分析题',
        '选择题以生活情境或实验现象为载体，禁止"压强的定义是____"式孤立记忆',
      ],
      samples: ['探究题示例：探究影响滑动摩擦力大小的因素，给出猜想与器材，设计实验并分析数据——供模仿探究流程'],
      checkers: { requireDepth: true, banMechanical: ['的定义是', '叫做'] },
    },
    'high': {
      quality: [
        '选择题情境化（生活/实验/科技），禁止孤立概念记忆',
        '实验题（必考）含读数/操作/数据处理/误差分析完整链条',
        '计算题分层设问，压轴题情境真实（电磁/力学综合）',
      ],
      samples: [],
      checkers: { requireDepth: true, banMechanical: ['的定义是', '叫做'] },
    },
  },

  '化学': {
    basis: '2022版化学课标·评价建议（科学探究/生产生活情境/规范表达）',
    'middle': {
      quality: [
        '实验探究题含方案设计→现象描述→数据分析→结论反思',
        '以生产生活/环保/科技为情境命题',
        '化学用语书写规范，计算题完整步骤',
        '选择/填空以实验现象或生活情境为载体，禁止"化合价的定义是____"式孤立记忆',
      ],
      samples: [],
      checkers: { requireDepth: true, banMechanical: ['的定义是', '叫做'] },
    },
    'high': {
      quality: [
        '情境化命题（工业流程/实验探究/材料应用）',
        '实验题含仪器选择/操作/现象/数据处理完整链',
        '推断题给明确信息线索，禁止无信息空转',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },

  '生物': {
    basis: '2022版生物课标·评价建议（探究实践/生命观念/联系实际）',
    'middle': {
      quality: [
        '探究题含对照实验设计/数据记录/结论分析',
        '识图题在图示情境中设问（结构→功能→原理追问），禁止"图中1是____"式单点记忆',
        '以健康生活/生态环保等真实问题为载体',
      ],
      samples: [],
      checkers: { requireDepth: true, banMechanical: ['图中', '是____'] },
    },
    'high': {
      quality: [
        '情境化命题（生理过程/生态现象/遗传分析）',
        '图表/资料分析题考查信息提取与推理',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },

  '道德与法治': {
    basis: '2022版道德与法治课标·评价建议（真实情境/价值判断/知行合一）',
    'primary': {
      quality: [
        '以校园/家庭/社区真实生活情境为载体考查规则意识与行为选择，禁止成人化议题（如复杂法律条文）',
        '设问要求"应该怎么做＋为什么"，体现知行合一，禁止空泛说教',
        '材料贴近儿童生活（同伴交往/安全自护/劳动习惯/爱护环境）',
      ],
      samples: ['情境题示例：放学路上看到同学在墙上乱涂乱画，你会怎么做？为什么？——供模仿生活化情境设问'],
      checkers: { requireDepth: true },
    },
    'middle': {
      quality: [
        '以真实生活情境为载体的价值判断与行为选择',
        '设问要求"做法＋理由"，考查知行合一',
        '材料题选用贴近学段的时政素材与法律案例',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },

  '思想政治': {
    basis: '2022版思想政治课标·评价建议（情境与法理/材料分析/开放探究）',
    'high': {
      quality: [
        '以真实情境为载体的原理阐释与价值判断',
        '结合时政热点，考查"原理→材料→结论"规范表述',
        '设置开放设问，鼓励多元视角与思辨',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },

  '历史': {
    basis: '2022版历史课标·评价建议（史料实证/时空观念/论从史出）',
    'middle': {
      quality: [
        '材料题须"论从史出"，设问要求"结合材料+所学知识"',
        '设置历史地图/时间轴/数据图表类题',
        '选择题以史料片段/时间轴/图表为载体，禁止"XX年发生XX"式孤立时间点记忆',
      ],
      samples: [],
      checkers: { requireDepth: true, banMechanical: ['年发生'] },
    },
    'high': {
      quality: [
        '论述题要求"观点＋史料＋论证"完整表述',
        '材料题分层设问（概括→分析→评价）',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },

  '地理': {
    basis: '2022版地理课标·评价建议（图表为载体/区域认知/人地协调）',
    'middle': {
      quality: [
        '以地图/统计图表/景观图为载体设问，考查读图能力',
        '综合题要求"区域定位→要素分析→人地关系评价"',
        '选择题须配图设问（地图/统计图表/景观图），禁止"海拔是____"式孤立概念记忆',
      ],
      samples: [],
      checkers: { requireDepth: true, banMechanical: ['是____'] },
    },
    'high': {
      quality: [
        '区域认知题分层设问',
        '自然地理/人文地理综合题给图文材料',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },

  '科学': {
    basis: '2022版科学课标·评价建议（观察探究/现象解释/操作实践）',
    'primary': {
      quality: [
        '探究题体现"观察→记录→分析→结论"过程',
        '用所学知识解释生活现象，要求科学表述',
        '填空/选择结合生活现象或配图设问，禁止"植物的根是____"式孤立名词填空',
      ],
      samples: [],
      checkers: { requireDepth: true, banMechanical: ['是____'] },
    },
    'middle': {
      quality: [
        '探究题含方案设计/变量控制/数据分析',
        '联系生产生活与科技情境',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
    'high': {
      quality: [
        '综合题跨学科融合（科学-技术-社会），设问含开放性论证与评价',
        '探究题考查完整探究链：问题→假设→方案→数据→结论→反思',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },

  '信息科技': {
    basis: '2022版信息科技课标·评价建议（信息意识/计算思维/数字化学习与创新/信息社会责任）',
    'primary': {
      quality: [
        '以数字化学习与生活场景为载体（扫码/网课/平板学习/APP使用等适龄情境），考查信息意识与习惯',
        '禁止考查编程语法与专业术语记忆；操作题以书面描述生活化操作步骤为主',
        '渗透网络安全与隐私保护启蒙（不透露个人信息、不轻信陌生链接）',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
    'middle': {
      quality: [
        '结合算法思维（流程图/简单逻辑判断）、数据处理（表格/图表）、网络应用等真实任务',
        '操作题描述步骤清晰可复现；代码/伪代码语法正确，禁止无信息空转',
        '情境化设问（校园活动/家庭生活/社会热点中的数字化问题）',
      ],
      samples: ['操作题示例：用流程图描述"根据天气决定是否带伞"的算法过程——供模仿书面操作题设问'],
      checkers: { requireDepth: true },
    },
    'high': {
      quality: [
        '高中侧重项目实践与信息素养综合提升（Python编程/数据分析/信息安全/物联网），结合实际应用场景',
        '设问含"为什么/如何优化/评价方案"等思维层级，禁止孤立考概念定义',
        '给出明确任务与输入输出约束，考查算法设计与问题解决完整过程',
      ],
      samples: ['项目题示例：统计班级成绩并给出分析结论，要求写出程序思路与关键代码——供模仿项目化设问'],
      checkers: { requireDepth: true, banMechanical: ['的定义是', '是什么'] },
    },
  },

  '音乐': {
    basis: '2022版艺术课标（音乐）·评价建议（审美感知/艺术表现/创意实践/文化理解）',
    'primary': {
      quality: [
        '以音乐要素（节奏/旋律/力度/速度）听辨为载体，无音频时以知识识记与读谱题替代',
        '情境化设问（歌唱活动/律动游戏/生活声音），禁止孤立背术语',
        '名曲与乐器识别配作品背景简况',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
    'middle': {
      quality: [
        '作品赏析设问沿"音乐要素分析→情感体验→文化理解"递进，配评分要点',
        '节奏节拍结合具体作品情境设问，禁止孤立节奏型默写',
        '连线题（乐器与分类/节奏型匹配）体现听辨与应用',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
    'high': {
      quality: [
        '赏析题分层设问：音乐要素→作品风格→时代与文化背景',
        '考查音乐与姊妹艺术、社会生活的关联，设问含评价与创意表达',
        '乐理/读谱考查置于作品语境中',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },

  '美术': {
    basis: '2022版艺术课标（美术）·评价建议（图像识读/美术表现/审美判断/创意实践/文化理解）',
    'primary': {
      quality: [
        '以图像识读为核心，设问考查"观察→分析→表达"能力',
        '题目给出作品名称与作者后进行文字分析，禁止只列作品名考默写',
        '创作题给主题与工具提示，情境化（节日/校园/自然）',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
    'middle': {
      quality: [
        '赏析题沿"内容→形式→情感"递进，配评分要点',
        '美术常识（色彩/构图/透视）结合具体作品设问，禁止孤立术语填空',
        '连线题（作品与作者/工具与用途）体现知识应用',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
    'high': {
      quality: [
        '鉴赏题结合时代背景与美术史脉络，设问含评价与个性表达',
        '考查美术与生活、科技的关联（设计应用/数字美术）',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },

  '体育': {
    basis: '2022版体育与健康课标·评价建议（运动能力/健康行为/体育品德）',
    'primary': {
      quality: [
        '围绕运动技能、健康行为、体育品德三个维度设问，情境化（体育课/课间活动/家庭锻炼）',
        '动作要领描述准确、安全提示完整',
        '禁止孤立考运动规则条文记忆',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
    'middle': {
      quality: [
        '运动规则与健康知识在情境中考查（比赛场景/运动损伤处理/合理膳食）',
        '动作要领与练习方法描述可操作、可复现，配安全提示',
        '简答题配评分要点',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
    'high': {
      quality: [
        '结合运动项目技战术、运动处方与健康管理真实情境设问',
        '设问含"为什么/如何安排/评价方案"等思维层级',
        '动作与规则描述准确规范，禁止编造术语',
      ],
      samples: [],
      checkers: { requireDepth: true },
    },
  },
};

/** 按 学科×学段 查询基准；未命中返回 null */
// 简单学科别名（与 examPaperBlueprints.SUBJECT_ALIAS 一致）：统一为新课标标准名
const SUBJECT_ALIAS = {
  '政治': '道德与法治', '思想品德': '道德与法治', '道法': '道德与法治',
  '信息技术': '信息科技', '信息': '信息科技',
  '科学（小学）': '科学', '小学科学': '科学',
  '体育与健康': '体育', '体育与健康课程': '体育',
};
// 学段联合别名（与 examPaperBlueprints.STAGE_SUBJECT_ALIAS 一致）：同一课程跨学段名称不同
const STAGE_SUBJECT_ALIAS = {
  '道德与法治|high': '思想政治|high',
  '思想政治|primary': '道德与法治|primary',
  '思想政治|middle': '道德与法治|middle',
};
// 学段兜底链（与 examPaperBlueprints.STAGE_FALLBACK 一致）：无该学段基准时向相邻学段取
const STAGE_FALLBACK = {
  primary_low: ['primary_mid', 'primary_high', 'middle'],
  primary_mid: ['primary_high', 'primary_low', 'middle'],
  primary_high: ['primary_mid', 'middle'],
  middle: ['high', 'primary_high'],
  high: ['middle'],
};
export function getPropositionBenchmark(subject, stage) {
  if (!subject) return null;
  let subjName = SUBJECT_ALIAS[subject] || subject;
  const stageKey = String(stage || '');
  // 学段组归一（primary_low/mid/high → primary），用于联合别名匹配
  const stageGroup = stageKey.startsWith('primary') ? 'primary' : stageKey;
  // 学段联合别名（与 examPaperBlueprints.STAGE_SUBJECT_ALIAS 一致）：同一课程跨学段名称不同
  const aliasHit = STAGE_SUBJECT_ALIAS[`${subjName}|${stageGroup}`];
  if (aliasHit) [subjName] = aliasHit.split('|');
  const subj = PROPOSITION_BENCHMARKS[subjName];
  if (!subj) return null;
  // 直接命中（如 middle/high 精确键）
  if (subj[stageKey]) return subj[stageKey];
  // 学段组降级：primary_low/mid/high → primary
  if (stageGroup === 'primary' && subj['primary']) return subj['primary'];
  // 学段兜底链（与蓝本一致）：如物理无小学段，primary → middle
  const chain = STAGE_FALLBACK[stageKey] || [];
  for (const st of chain) {
    const hit = subj[st] || (st.startsWith('primary') ? subj['primary'] : null);
    if (hit) return hit;
  }
  return null;
}

/** 构建注入生成 prompt 的「内容质量基准」文本 */
export function buildBenchmarkText(subject, stage, includeGeneral = true) {
  const bench = getPropositionBenchmark(subject, stage);
  if (!bench) return '';
  const lines = ['【命题内容质量基准】'];
  lines.push(`依据：${bench.basis}`);
  lines.push('硬性要求：');
  bench.quality.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  if (bench.samples && bench.samples.length) {
    lines.push('真题级样例（供模仿，不得照抄）：');
    bench.samples.forEach(s => lines.push(`· ${s}`));
  }
  // 通用内容底线：exam 且已注入蓝本时跳过（EXAM_NEW_STANDARD 已含素养立意/情境/设问层次等条款，避免重复注入）
  if (includeGeneral) {
    lines.push('通用内容底线：');
    GENERAL_CONTENT_QUALITY.forEach((g, i) => lines.push(`${i + 1}. ${g}`));
  }
  return lines.join('\n');
}

export default { PROPOSITION_BENCHMARKS, getPropositionBenchmark, buildBenchmarkText, GENERAL_CONTENT_QUALITY, PASSAGE_LENGTH, QUESTION_DEPTH_LEVELS };
