// ==================== 真题卷结构蓝本库 ====================
// 🔴 根治目的：考卷（exam）的卷面骨架必须对齐 2022 版新课标落地后的全国主流真题卷，
//    不再由 AI 自由发挥题型。题型骨架、分值体系是确定性知识，不是创意空间。
//    蓝本基于人教统编教材配套真题卷（北京/浙江/江苏/广东等新课标命题区通行结构）归纳。
//
// 使用：buildBlueprintInjection 对 genType=exam 强制注入本蓝本（大题/分值/时长固定，优先级高于指令库结构大纲）；
//      卷面格式细则与命题质量底线在指令库模板（EXAM_BASE）中定义，本库不重复。
// 单一事实源：分值规则唯一在本文件 buildBlueprintInjection 中定义；大题标题统一明细式（共X题，共X分）。
import { getRegionConfig } from './examRegionConfig.js';

/**
 * 学科×学段 → 真题卷题型骨架
 * key: `${subject}|${stage}`，stage ∈ primary_low / primary_mid / primary_high / middle / high / all
 * sections: { name 规范题型名, score 大题分值, note 命题要求 }
 */
export const EXAM_BLUEPRINTS = {
  // ══════════════ 语文 ══════════════
  '语文|primary_low': {
    label: '语文·小学低段（1-2年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '识字与写字', score: 32, note: '覆盖本单元识字与写字内容，在语境中考查；书写用田字格。' },
      { name: '积累与运用', score: 24, note: '覆盖本单元积累与运用内容，在真实语境中选填、仿写。' },
      { name: '阅读与鉴赏', score: 14, note: '课内课外阅读结合，设问有层次；选文标注出处。' },
      { name: '表达与交流', score: 30, note: '口语交际与看图写话结合本单元主题；写话给情境与词语支架。' },
    ],
  },
  '语文|primary_mid': {
    label: '语文·小学中段（3-4年级）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '积累与运用', score: 36, note: '覆盖本单元积累与运用内容：字词句段在真实语境中考查，名句运用型填空。' },
      { name: '阅读与鉴赏', score: 28, note: '课内阅读与课外阅读结合，课外选文主题相关并标注出处；设问有层次。' },
      { name: '表达与交流', score: 36, note: '口语交际与习作结合本单元主题；习作给选材支架。' },
    ],
  },
  '语文|primary_high': {
    label: '语文·小学高段（5-6年级）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '积累与运用', score: 38, note: '覆盖本单元积累与运用内容：字词句段在真实语境中考查，名句运用型填空。' },
      { name: '阅读与鉴赏', score: 26, note: '课内阅读与课外阅读结合，课外选文标注出处；设问有层次。' },
      { name: '表达与交流', score: 36, note: '综合性学习与习作结合本单元主题；习作二选一、给选材支架。' },
    ],
  },
  '语文|middle': {
    label: '语文·初中（中考结构）', fullScore: 120, duration: '120分钟',
    sections: [
      { name: '积累与运用', score: 28, note: '名句语境默写与基础运用（字音字形、词语运用、病句、名著、综合实践）。' },
      { name: '古诗文阅读', score: 22, note: '文言文课内外对比阅读与古诗词鉴赏，重理解与积累运用。' },
      { name: '现代文阅读', score: 30, note: '记叙文与说明文/议论文阅读，课外选文标注出处，设问有层次。' },
      { name: '写作', score: 40, note: '命题/半命题/材料作文，提示语与写作要求。' },
    ],
  },
  '语文|high': {
    label: '语文·高中（新高考结构）', fullScore: 150, duration: '150分钟',
    sections: [
      { name: '现代文阅读', score: 35, note: '信息类文本与文学类文本阅读，设问有层次。' },
      { name: '古代诗文阅读', score: 35, note: '文言文、古代诗歌鉴赏与名篇名句情境默写。' },
      { name: '语言文字运用', score: 20, note: '词语选用、病句修改、句式变换、表达得体、补写句子等，在语境中考查。' },
      { name: '写作', score: 60, note: '材料作文，准确理解材料、立意明确、论证充分。' },
    ],
  },

  // ══════════════ 数学 ══════════════
  '数学|primary_low': {
    label: '数学·小学低段（1-2年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '直接写得数', score: 20, note: '口算，直接写得数；含加减法（二年级含表内乘法）' },
      { name: '填空', score: 20, note: '数的组成、比大小、单位换算、找规律等基础内容，情境化设问' },
      { name: '选择', score: 10, note: '情境化设问' },
      { name: '判断', score: 10, note: '概念与算法辨析' },
      { name: '操作题', score: 10, note: '画一画、连一连、数一数、按要求涂色；需配图处由系统按渲染契约注入' },
      { name: '看图列式计算', score: 10, note: '看图列出算式并计算；配图由系统注入' },
      { name: '解决问题', score: 20, note: '生活情境应用题，要求列式、计算并作答（写单位、写答语）' },
    ],
  },
  '数学|primary_mid': {
    label: '数学·小学中段（3-4年级）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '口算', score: 10, note: '口算，直接写得数。' },
      { name: '用竖式计算', score: 18, note: '竖式计算（含验算），三年级含三位数加减、多位数乘一位数；竖式书写区由系统按载体渲染' },
      { name: '填空', score: 20, note: '概念、单位换算、估算、图形特征等，情境化设问' },
      { name: '判断', score: 8, note: '概念辨析' },
      { name: '选择', score: 8, note: '情境化设问' },
      { name: '操作题', score: 6, note: '画图、测量、平移旋转、周长面积操作；需动手画图的题留作图区域（系统渲染）' },
      { name: '解决问题', score: 30, note: '生活情境应用题，体现问题解决过程（列式→计算→答）' },
    ],
  },
  '数学|primary_high': {
    label: '数学·小学高段（5-6年级）', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '直接写得数', score: 8, note: '直接写得数。' },
      { name: '脱式计算（能简算的要简算）', score: 18, note: '脱式计算（含简算），六年级含解方程' },
      { name: '填空', score: 20, note: '概念、数感、几何度量、统计等，情境化设问' },
      { name: '判断', score: 8, note: '概念辨析' },
      { name: '选择', score: 8, note: '情境化设问' },
      { name: '操作题', score: 8, note: '画图、对称、面积体积操作、位置与方向；需配图处由系统按渲染契约注入' },
      { name: '解决问题', score: 30, note: '生活情境应用题，含分数百分数、几何应用，体现建模过程' },
    ],
  },
  '数学|middle': {
    label: '数学·初中（中考结构）', fullScore: 120, duration: '120分钟',
    sections: [
      { name: '选择题', score: 30, note: '4选1，覆盖数与式、方程不等式、函数、几何、统计概率' },
      { name: '填空题', score: 18, note: '以计算推理为主' },
      { name: '解答题', score: 72, note: '含计算、化简求值与统计概率、几何证明、函数综合（压轴题考查函数与几何综合）' },
    ],
  },
  '数学|high': {
    label: '数学·高中（新高考结构）', fullScore: 150, duration: '120分钟',
    sections: [
      { name: '单选题', score: 40, note: '4选1' },
      { name: '多选题', score: 18, note: '全对得分、部分选对得部分分' },
      { name: '填空题', score: 15, note: '以计算推理为主' },
      { name: '解答题', score: 77, note: '含解三角形或数列、立体几何、概率统计、解析几何、函数导数综合（后为压轴题）' },
    ],
  },

  // ══════════════ 英语 ══════════════
  '英语|primary_low': {
    label: '英语·小学低段（1-2年级，部分地区）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '听力·听音选图', score: 10, note: '听简短词句选对应图片（物品/动物/人物动作等），基础交际要素' },
      { name: '听力·听音判断', score: 10, note: '听句子判断图片或陈述正误' },
      { name: '听力·听音排序', score: 10, note: '听词句给图片标序号' },
      { name: '听力·听音选答语', score: 10, note: '听问句选正确应答（问候/喜好/年龄/物品归属等交际功能句）' },
      { name: '笔试·看图连线', score: 10, note: '单词与图片连线' },
      { name: '笔试·字母与词汇', score: 10, note: '字母大小写、抄写单词' },
      { name: '笔试·情景对话', score: 10, note: '选词补全对话' },
      { name: '笔试·认读选择', score: 10, note: '看词选义、看图选词' },
      { name: '笔试·趣味任务', score: 20, note: '涂色、圈词、走迷宫等操作型任务' },
    ],
  },
  '英语|primary_mid': {
    label: '英语·小学中段（3-4年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '听力·听音选词/选图', score: 10, note: '听词句选正确单词或图片' },
      { name: '听力·听音判断', score: 5, note: '听句子/对话判断图片或句子正误' },
      { name: '听力·听音选答语', score: 10, note: '听问句（含简短对话语境）选正确应答（问路/购物/计划/喜好等交际功能句）' },
      { name: '听力·听音排序', score: 10, note: '听一段对话或独白，按顺序给图片标序号' },
      { name: '笔试·语音辨析', score: 6, note: '选出画线部分发音不同的单词' },
      { name: '笔试·词汇运用', score: 8, note: '看图写词、词图匹配、词汇分类' },
      { name: '笔试·单项选择', score: 10, note: '语境中考查语法与交际用语' },
      { name: '笔试·情景交际', score: 10, note: '选句补全对话' },
      { name: '笔试·连词成句', score: 8, note: '按正确语序排列句子，注意首字母大写与标点' },
      { name: '笔试·阅读理解', score: 15, note: '图文短文，判断或选择' },
      { name: '笔试·书写', score: 8, note: '抄写句子，四线三格规范书写' },
    ],
  },
  '英语|primary_high': {
    label: '英语·小学高段（5-6年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '听力·听音选词/选图', score: 10, note: '听词句选正确单词或图片' },
      { name: '听力·听音判断', score: 10, note: '听简短对话判断句子正误' },
      { name: '听力·听音填空', score: 10, note: '听一篇完整短文（通知/自我介绍等），补全信息（姓名/时间/地点/活动），每空一词或短语' },
      { name: '笔试·语音辨析', score: 5, note: '选出画线部分发音不同的单词' },
      { name: '笔试·词汇运用', score: 10, note: '词图匹配、词汇分类、根据提示写词' },
      { name: '笔试·单项选择', score: 15, note: '语境中考查语法与交际用语' },
      { name: '笔试·情景交际', score: 10, note: '选句补全对话' },
      { name: '笔试·连词成句', score: 10, note: '按正确语序排列句子' },
      { name: '笔试·阅读理解', score: 10, note: '短文，选择与判断' },
      { name: '笔试·书面表达', score: 10, note: '根据提示写短文（自我介绍、周末计划等）' },
    ],
  },
  '英语|middle': {
    label: '英语·初中（中考结构）', fullScore: 120, duration: '100分钟',
    sections: [
      { name: '听力', score: 25, note: '含短对话理解、长对话理解（购物/问路/计划/校园生活/邀请等真实话题）、短文理解（通知/广播/自我介绍）、信息转换（听短文填表，每空一词）；每段材料读两遍' },
      { name: '完形填空', score: 10, note: '语境理解＋词法句法' },
      { name: '阅读理解', score: 40, note: '选择＋任务型阅读（还原句子/回答问题）' },
      { name: '词汇运用', score: 10, note: '根据首字母或汉语提示填词，短文语境' },
      { name: '语法填空', score: 10, note: '短文语境考查语法' },
      { name: '书面表达', score: 25, note: '提示语给要点与格式要求' },
    ],
  },
  '英语|high': {
    label: '英语·高中（新高考结构）', fullScore: 150, duration: '120分钟',
    sections: [
      { name: '听力', score: 30, note: '短对话与长对话/独白；每段材料读两遍' },
      { name: '阅读理解', score: 50, note: '阅读＋七选五（还原句子）；设问围绕语篇内容' },
      { name: '完形填空', score: 15, note: '语篇语境考查词汇与逻辑衔接' },
      { name: '语法填空', score: 15, note: '短文语境考查语法与词汇' },
      { name: '写作', score: 40, note: '应用文写作＋读后续写（给出前文与段首句，续写两段）' },
    ],
  },

  // ══════════════ 物理 ══════════════
  '物理|middle': {
    label: '物理·初中', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '选择题', score: 36, note: '4选1，概念辨析与情境判断' },
      { name: '填空题', score: 18, note: '现象分析、原理应用' },
      { name: '作图题', score: 8, note: '力的示意图、光路图、电路图；需现成图形的题配图由系统注入' },
      { name: '实验探究题', score: 14, note: '方案设计、数据分析、结论表述' },
      { name: '计算题', score: 24, note: '力学与电学综合，要求公式→代入→结果→作答完整' },
    ],
  },
  '物理|high': {
    label: '物理·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '单项选择题', score: 32, note: '4选1' },
      { name: '多项选择题', score: 18, note: '全对得分、选不全得部分分' },
      { name: '实验题', score: 18, note: '实验原理、数据处理、误差分析' },
      { name: '计算题', score: 32, note: '力学综合与电磁学综合，要求规范作答' },
    ],
  },

  // ══════════════ 化学 ══════════════
  '化学|middle': {
    label: '化学·初中', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '选择题', score: 30, note: '概念辨析、情境判断' },
      { name: '填空题', score: 26, note: '化学用语、物质推断、原理分析' },
      { name: '实验探究题', score: 24, note: '方案设计、现象描述、数据分析、结论与反思；实验装置图示由系统按渲染契约注入' },
      { name: '计算题', score: 20, note: '根据化学方程式计算，要求规范书写步骤' },
    ],
  },
  '化学|high': {
    label: '化学·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '单选题', score: 30, note: '4选1' },
      { name: '不定项选择题', score: 20, note: '全对得分、部分选对得部分分' },
      { name: '填空题', score: 18, note: '工艺流程、反应原理、物质结构' },
      { name: '实验探究题', score: 16, note: '方案设计、数据处理、评价反思' },
      { name: '计算题', score: 16, note: '定量计算，要求规范步骤' },
    ],
  },

  // ══════════════ 生物 ══════════════
  '生物|middle': {
    label: '生物·初中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 50, note: '概念辨析、情境判断' },
      { name: '非选择题', score: 50, note: '识图填空、资料分析、实验探究；识图题在图示情境中设问（结构→功能→原理）；配图与数据图表由系统按渲染契约注入' },
    ],
  },
  '生物|high': {
    label: '生物·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '单选题', score: 48, note: '4选1' },
      { name: '非选择题', score: 52, note: '含细胞代谢、遗传与变异、生命活动调节、生态系统、实验探究；结构示意图由系统按渲染契约注入' },
    ],
  },

  // ══════════════ 道德与法治 / 思想政治 ══════════════
  '道德与法治|primary_low': {
    label: '道德与法治·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '判断', score: 20, note: '生活常识与行为习惯辨析' },
      { name: '选择', score: 30, note: '情境判断' },
      { name: '连线', score: 20, note: '情境与做法连线、行为与对错连线' },
      { name: '情景辨析', score: 30, note: '看图或读短文后说说该怎么做，一句话作答' },
    ],
  },
  '道德与法治|primary_mid': {
    label: '道德与法治·小学中段（3-4年级）', fullScore: 100, duration: '50分钟',
    sections: [
      { name: '判断', score: 20, note: '行为习惯与规则意识辨析' },
      { name: '选择', score: 30, note: '情境判断' },
      { name: '连线与分类', score: 10, note: '概念关联、行为分类' },
      { name: '情景分析', score: 20, note: '结合生活情境说明理由，简短作答' },
      { name: '实践探究', score: 20, note: '安全自护、垃圾分类等真实问题，给出做法并说明理由' },
    ],
  },
  '道德与法治|primary_high': {
    label: '道德与法治·小学高段（5-6年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '判断', score: 16, note: '法律常识与价值判断' },
      { name: '选择', score: 30, note: '情境与法理判断' },
      { name: '材料分析', score: 24, note: '读案例或时政材料后分析说明，结合所学谈认识' },
      { name: '实践探究', score: 30, note: '校园欺凌防范、网络文明等真实问题，提出做法并阐述理由' },
    ],
  },
  '道德与法治|middle': {
    label: '道德与法治·初中', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '选择题', score: 32, note: '基础知识与价值判断' },
      { name: '判断题', score: 8, note: '观点辨析' },
      { name: '材料分析题', score: 60, note: '情境探究、法理阐释、实践应用（结合时政素材）' },
    ],
  },
  '思想政治|high': {
    label: '思想政治·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '选择题', score: 48, note: '基础理论与时政判断' },
      { name: '非选择题', score: 52, note: '原理阐释、材料分析、综合探究（结合时政热点）' },
    ],
  },

  // ══════════════ 历史 ══════════════
  '历史|middle': {
    label: '历史·初中', fullScore: 100, duration: '90分钟',
    sections: [
      { name: '选择题', score: 40, note: '以史料片段/时间轴/图表为载体的史实与概念辨析' },
      { name: '非选择题', score: 60, note: '材料解析、图表解读、论述探究，要求论从史出；图表由系统按渲染契约注入' },
    ],
  },
  '历史|high': {
    label: '历史·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '选择题', score: 48, note: '以史料为载体的概念辨析与情境判断' },
      { name: '非选择题', score: 52, note: '材料解析、比较分析、开放论述（观点＋史料＋论证）；图表由系统按渲染契约注入' },
    ],
  },

  // ══════════════ 地理 ══════════════
  '地理|middle': {
    label: '地理·初中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 50, note: '以地图/图表为载体的概念辨析与空间定位' },
      { name: '综合题', score: 50, note: '读图分析、区域认知、人地关系，以图表为载体（示意图/统计图表由系统按渲染契约注入）；数据真实' },
    ],
  },
  '地理|high': {
    label: '地理·高中（新高考单科）', fullScore: 100, duration: '75分钟',
    sections: [
      { name: '选择题', score: 48, note: '以地图/图表为载体的概念辨析与空间思维' },
      { name: '综合题', score: 52, note: '多要素分析、区域比较、人地协调；示意图/统计图表由系统按渲染契约注入；数据真实' },
    ],
  },

  // ══════════════ 科学（小学 1-6 + 初中综合理科——浙江等地初中开科学课） ══════════════
  '科学|primary_low': {
    label: '科学·小学低段（1-2年级）', fullScore: 100, duration: '50分钟',
    sections: [
      { name: '填空', score: 20, note: '结合生活情境或配图的观察发现题' },
      { name: '判断', score: 12, note: '现象辨析' },
      { name: '选择', score: 18, note: '情境判断' },
      { name: '连线', score: 10, note: '概念关联、分类匹配' },
      { name: '观察与探究', score: 20, note: '观察记录、排序、简单探究过程描述' },
      { name: '简答', score: 20, note: '用一两句话说明现象或做法' },
    ],
  },
  '科学|primary_mid': {
    label: '科学·小学中段（3-4年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '填空', score: 16, note: '知识应用与现象解释' },
      { name: '判断', score: 10, note: '事实辨析、因果推理' },
      { name: '选择', score: 20, note: '情境判断' },
      { name: '连线与排序', score: 10, note: '概念关联、实验步骤排序' },
      { name: '实验探究', score: 24, note: '方案设计、现象记录、数据分析、结论表述' },
      { name: '简答', score: 20, note: '用所学知识解释生活现象' },
    ],
  },
  '科学|primary_high': {
    label: '科学·小学高段（5-6年级）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '填空', score: 16, note: '原理应用与综合推理' },
      { name: '判断', score: 10, note: '事实辨析、推理评价' },
      { name: '选择', score: 20, note: '情境判断' },
      { name: '实验探究', score: 24, note: '方案设计、数据分析、结论与评价' },
      { name: '综合运用', score: 30, note: '真实问题解决、跨学科融合，含开放性设问' },
    ],
  },
  '科学|middle': {
    label: '科学·初中（综合理科）', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择', score: 20, note: '情境判断、概念应用' },
      { name: '填空', score: 16, note: '原理应用与现象解释' },
      { name: '判断', score: 10, note: '事实辨析、推理评价' },
      { name: '实验探究', score: 28, note: '方案设计、变量控制、现象记录、数据分析、结论评价（体现科学探究完整过程）' },
      { name: '综合运用', score: 26, note: '真实问题解决、跨学科融合，含开放性设问与说理' },
    ],
  },

  // ══════════════ 信息科技（2022 课标按学段内容差异大，5 档蓝本） ══════════════
  '信息科技|primary_low': {
    label: '信息科技·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '判断题', score: 16, note: '信息意识、数字设备初步认识、用眼卫生（情境化设问）' },
      { name: '选择题', score: 24, note: '情境判断' },
      { name: '连线题', score: 20, note: '设备与用途、行为与对错连线' },
      { name: '情境操作题', score: 40, note: '以文字/图示描述简单操作步骤，配评分要点' },
    ],
  },
  '信息科技|primary_mid': {
    label: '信息科技·小学中段（3-4年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '选择题', score: 20, note: '在线学习与生活、数字媒体初步' },
      { name: '判断题', score: 16, note: '观点与行为辨析' },
      { name: '填空题', score: 16, note: '技术原理在数字化场景中运用（情境化设问）' },
      { name: '操作题', score: 32, note: '以书面形式描述操作步骤、流程设计' },
      { name: '综合运用', score: 16, note: '解决真实数字化任务（如制作图文卡片）' },
    ],
  },
  '信息科技|primary_high': {
    label: '信息科技·小学高段（5-6年级）', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 20, note: '数据与编码、算法初步、信息安全' },
      { name: '判断题', score: 16, note: '概念与行为辨析' },
      { name: '填空题', score: 16, note: '数字化场景中的原理运用' },
      { name: '操作题', score: 32, note: '流程设计、数据处理步骤描述' },
      { name: '综合运用', score: 16, note: '真实任务（如用表格整理数据）' },
    ],
  },
  '信息科技|middle': {
    label: '信息科技·初中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 24, note: '互联网应用与创新、物联网、人工智能初步' },
      { name: '判断题', score: 12, note: '观点与行为辨析' },
      { name: '填空题', score: 16, note: '原理在场景中运用' },
      { name: '操作题', score: 28, note: '流程设计、方案描述（含算法与数据）' },
      { name: '综合题', score: 20, note: '真实问题解决（如网络安全方案、数据可视化设计）' },
    ],
  },
  '信息科技|high': {
    label: '信息科技·高中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 24, note: '数据与计算、信息系统与社会、人工智能' },
      { name: '填空题', score: 16, note: '原理在数字化场景中运用' },
      { name: '操作题', score: 32, note: '程序填空/流程图/数据处理描述' },
      { name: '综合题', score: 28, note: '算法设计与信息系统分析，配评分要点' },
    ],
  },

  // ══════════════ 音乐（按学段：低段听辨表现 → 高中鉴赏文化理解） ══════════════
  '音乐|primary_low': {
    label: '音乐·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '判断题', score: 20, note: '音的高低长短、节奏快慢、歌曲情绪（情境化设问）' },
      { name: '选择题', score: 20, note: '听辨类以知识识记呈现' },
      { name: '连线题', score: 20, note: '乐器与声音、节奏型与动作连线' },
      { name: '表现题', score: 40, note: '以文字描述演唱/律动/节奏表现（无音频以图谱/节奏型识读），配评分要点' },
    ],
  },
  '音乐|primary_mid': {
    label: '音乐·小学中段（3-4年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '选择题', score: 24, note: '乐理常识、乐器识别、名曲主题' },
      { name: '判断题', score: 16, note: '音乐常识辨析' },
      { name: '填空题', score: 16, note: '音乐术语、节奏节拍（结合作品情境）' },
      { name: '连线题', score: 12, note: '乐器与分类、节奏型匹配' },
      { name: '简答题', score: 32, note: '作品赏析（要素分析→情感体验），配评分要点' },
    ],
  },
  '音乐|primary_high': {
    label: '音乐·小学高段（5-6年级）', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 24, note: '乐理、乐器、名曲与民族音乐' },
      { name: '判断题', score: 16, note: '音乐常识辨析' },
      { name: '填空题', score: 12, note: '音乐要素与术语' },
      { name: '连线题', score: 8, note: '作品与民族/体裁连线' },
      { name: '简答题', score: 40, note: '赏析沿要素分析→情感体验→文化理解递进，配评分要点' },
    ],
  },
  '音乐|middle': {
    label: '音乐·初中', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 28, note: '乐理、中外名曲、音乐体裁' },
      { name: '填空题', score: 16, note: '音乐要素与作品背景（情境化设问）' },
      { name: '判断题', score: 16, note: '音乐常识辨析' },
      { name: '简答题', score: 40, note: '作品赏析（要素分析→情感体验→文化理解），配评分要点' },
    ],
  },
  '音乐|high': {
    label: '音乐·高中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 30, note: '音乐鉴赏、中外音乐史、民族音乐' },
      { name: '填空题', score: 20, note: '音乐要素、体裁与作品（情境化设问）' },
      { name: '判断题', score: 10, note: '音乐常识辨析' },
      { name: '鉴赏题', score: 40, note: '鉴赏沿要素分析→情感体验→文化理解→审美评价递进，配评分要点' },
    ],
  },

  // ══════════════ 美术（按学段：低段感知表现 → 高中鉴赏文化） ══════════════
  '美术|primary_low': {
    label: '美术·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '判断题', score: 20, note: '造型语言（点线面/色彩）、工具材料认识' },
      { name: '选择题', score: 20, note: '色彩与形状辨识' },
      { name: '连线题', score: 20, note: '工具与用途、颜色与情感连线' },
      { name: '表现题', score: 40, note: '以文字描述创作思路（画什么/用什么颜色/怎样构图），配评分要点' },
    ],
  },
  '美术|primary_mid': {
    label: '美术·小学中段（3-4年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '选择题', score: 24, note: '造型/色彩/构图知识、美术常识' },
      { name: '判断题', score: 16, note: '美术常识辨析' },
      { name: '填空题', score: 16, note: '美术术语、造型原理' },
      { name: '连线题', score: 12, note: '作品与作者/材料与技法连线' },
      { name: '赏析题', score: 32, note: '赏析（内容→形式→情感），配评分要点' },
    ],
  },
  '美术|primary_high': {
    label: '美术·小学高段（5-6年级）', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 24, note: '造型表现、设计应用、欣赏评述常识' },
      { name: '判断题', score: 16, note: '美术常识辨析' },
      { name: '填空题', score: 12, note: '美术术语与原理' },
      { name: '连线题', score: 8, note: '作品与作者/流派连线' },
      { name: '赏析题', score: 40, note: '赏析（内容→形式→情感），结合中华优秀传统文化，配评分要点' },
    ],
  },
  '美术|middle': {
    label: '美术·初中', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 28, note: '造型/设计/欣赏知识、中外美术名作' },
      { name: '填空题', score: 16, note: '美术术语与流派（情境化设问）' },
      { name: '判断题', score: 16, note: '美术常识辨析' },
      { name: '赏析题', score: 40, note: '赏析（内容→形式→情感），配评分要点' },
    ],
  },
  '美术|high': {
    label: '美术·高中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 30, note: '美术鉴赏、中外美术史、设计原理' },
      { name: '填空题', score: 20, note: '美术术语、流派与作品（情境化设问）' },
      { name: '判断题', score: 10, note: '美术常识辨析' },
      { name: '鉴赏题', score: 40, note: '鉴赏沿内容→形式→情感→文化理解递进，配评分要点' },
    ],
  },

  // ══════════════ 体育（按学段：低段情境常识 → 高中健康素养） ══════════════
  '体育|primary_low': {
    label: '体育·小学低段（1-2年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '判断题', score: 20, note: '运动安全、生活习惯（情境化设问）' },
      { name: '选择题', score: 20, note: '运动情境判断' },
      { name: '连线题', score: 20, note: '动作与要领、场景与做法连线' },
      { name: '简答题', score: 40, note: '在运动情境中描述正确做法（如"跑步时摔倒了怎么办"），配评分要点' },
    ],
  },
  '体育|primary_mid': {
    label: '体育·小学中段（3-4年级）', fullScore: 100, duration: '40分钟',
    sections: [
      { name: '选择题', score: 24, note: '运动规则、健康知识、安全常识' },
      { name: '判断题', score: 16, note: '规则与安全常识辨析' },
      { name: '填空题', score: 16, note: '动作要领在运动情境中描述' },
      { name: '连线题', score: 12, note: '运动项目与规则要点连线' },
      { name: '简答题', score: 32, note: '动作要领描述、安全防护说明，配评分要点' },
    ],
  },
  '体育|primary_high': {
    label: '体育·小学高段（5-6年级）', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 24, note: '运动技能、健康行为、体育品德' },
      { name: '判断题', score: 16, note: '规则与健康常识辨析' },
      { name: '填空题', score: 12, note: '动作要领情境描述' },
      { name: '连线题', score: 8, note: '运动损伤与处理连线' },
      { name: '简答题', score: 40, note: '动作要领与安全防护，配评分要点' },
    ],
  },
  '体育|middle': {
    label: '体育·初中', fullScore: 100, duration: '45分钟',
    sections: [
      { name: '选择题', score: 28, note: '运动技能、健康知识、体育与健康常识' },
      { name: '填空题', score: 16, note: '动作要领与运动原理（情境化设问）' },
      { name: '判断题', score: 16, note: '规则与健康常识辨析' },
      { name: '简答题', score: 40, note: '动作要领、锻炼方案与安全防护，配评分要点' },
    ],
  },
  '体育|high': {
    label: '体育·高中', fullScore: 100, duration: '60分钟',
    sections: [
      { name: '选择题', score: 30, note: '运动技能、健康素养、体育文化' },
      { name: '填空题', score: 20, note: '运动原理与健康知识（情境化设问）' },
      { name: '判断题', score: 10, note: '健康与安全常识辨析' },
      { name: '简答题', score: 40, note: '锻炼方案设计、健康素养提升，配评分要点' },
    ],
  },
};

/** 学科名模糊匹配兜底表（教材库学科名 → 蓝本 key 学科名，统一为新课标标准名） */
const SUBJECT_ALIAS = {
  '政治': '道德与法治', '思想品德': '道德与法治', '道法': '道德与法治',
  '信息技术': '信息科技', '信息': '信息科技',
  '科学（小学）': '科学', '小学科学': '科学',
  // 体育与健康（2022 新课标官方名）→ 体育（蓝本 key）
  '体育与健康': '体育', '体育与健康课程': '体育',
};

/** 学段兜底链：无精确匹配时依次降级 */
const STAGE_FALLBACK = {
  primary_low: ['primary_mid', 'primary_high', 'middle'],
  primary_mid: ['primary_high', 'primary_low', 'middle'],
  primary_high: ['primary_mid', 'middle'],
  middle: ['high', 'primary_high'],
  high: ['middle'],
};

/** 学科-学段联合别名：同一门课程在不同学段名称不同（道德与法治课在高中叫思想政治） */
const STAGE_SUBJECT_ALIAS = {
  '道德与法治|high': '思想政治|high',
  '思想政治|primary_low': '道德与法治|primary_low',
  '思想政治|primary_mid': '道德与法治|primary_mid',
  '思想政治|primary_high': '道德与法治|primary_high',
  '思想政治|middle': '道德与法治|middle',
};

/**
 * 查询真题卷蓝本
 * @param {string} subject 学科名（未标准化也可）
 * @param {string} stage primary_low/primary_mid/primary_high/middle/high
 * @returns {{label:string, fullScore:number, duration:string, sections:Array, key:string}|null}
 */
export function getExamBlueprint(subject, stage, region) {
  if (!subject || !stage) return null;
  const stdSubject = SUBJECT_ALIAS[subject] || subject;
  // 学段联合别名（同一课程跨学段名称转换，如高中道法→思想政治）
  const joint = STAGE_SUBJECT_ALIAS[`${stdSubject}|${stage}`] || `${stdSubject}|${stage}`;
  const [bpSubject, bpStage] = joint.split('|');
  let bp = null;
  const direct = EXAM_BLUEPRINTS[`${bpSubject}|${bpStage}`];
  if (direct) {
    bp = { ...direct, key: `${bpSubject}|${bpStage}`, subject: bpSubject, stage: bpStage };
  } else {
    // 学段降级链
    const chain = STAGE_FALLBACK[bpStage] || [];
    for (const st of chain) {
      const b = EXAM_BLUEPRINTS[`${bpSubject}|${st}`];
      if (b) { bp = { ...b, key: `${bpSubject}|${st}`, subject: bpSubject, stage: bpStage }; break; }
    }
    // 全学段通配蓝本（如信息科技跨学段通用）
    if (!bp) {
      const all = EXAM_BLUEPRINTS[`${bpSubject}|all`];
      if (all) bp = { ...all, key: `${bpSubject}|all`, subject: bpSubject, stage: bpStage };
    }
  }
  // 省市差异化：命中省市配置则覆盖时长/总分，并按比例缩放题型骨架分值（末大题修正保证各大题之和=新总分）
  // 配置 = 内置 EXAM_REGION_CONFIG + 用户蓝图库"省市分值"维护的覆盖（用户优先）
  if (bp && region) {
    const effConfig = getRegionConfig();
    const regMap = effConfig[region] && effConfig[region][bpStage];
    const rc = regMap && (regMap[bpSubject] || regMap[stdSubject] || regMap[subject]);
    if (rc) {
      if (rc.fullScore && rc.fullScore !== bp.fullScore) {
        const defaultTotal = bp.fullScore || 100;
        const newTotal = rc.fullScore;
        const scaled = bp.sections.map(s => ({ ...s, score: Math.max(1, Math.round((s.score * newTotal) / defaultTotal)) }));
        const sum = scaled.reduce((a, c) => a + c.score, 0);
        scaled[scaled.length - 1].score += newTotal - sum; // 末大题修正
        bp = { ...bp, fullScore: newTotal, duration: rc.duration || bp.duration, sections: scaled };
      } else if (rc.duration) {
        bp = { ...bp, duration: rc.duration };
      }
    }
  }
  return bp;
}

/**
 * 精简蓝图注入块（供整卷生成指令尾部附加）——只注入卷面结构（题型骨架 + 大题命题要求 + 分值），
 * 确定性结构数据由本库提供（真题卷卷面骨架是确定性知识，不是创意空间）。
 * 权衡说明（DeepSeek 自有能力）：
 *   - 注入的是"卷面结构与执行口径"（大题固定、分值账目），模型按蓝本结构出题，不凭本能自由发挥题型；
 *   - 学段/学科课标条款由指令库【学科·学段要点】+【学段特点】承载（带课标出处），蓝图不重复；
 *   - 分值账目自洽由规则库 score 系列生成后验算/修正（代码确定性），不注入 prompt。
 * 单一事实源：大题标题统一明细式（共X题，共X分）；分值规则唯一在本函数定义。
 * @param {object} bp getExamBlueprint 返回值
 * @returns {string} 空串 = 无蓝图
 */
export function buildBlueprintInjection(bp) {
  if (!bp?.sections?.length) return '';
  const sectionsText = bp.sections
    .map((s, i) => {
      const no = '一二三四五六七八九十'[i] || String(i + 1);
      return `${no}、${s.name}（共X题，共${s.score}分）——${s.note}`;
    })
    .join('\n');
  // 课标学段/学科条款由指令库【学科·学段要点】+【学段特点】承载（带课标出处），蓝图只注入卷面结构；
  // 分值规则不注入 prompt（AI 命题常识；账目自洽由规则库 score 系列生成后验算/修正）
  return `\n\n【卷面结构（真题蓝本，大题与分值固定，不得增删改）】\n${sectionsText}`;
}

export default {
  EXAM_BLUEPRINTS,
  getExamBlueprint,
  buildBlueprintInjection,
};

