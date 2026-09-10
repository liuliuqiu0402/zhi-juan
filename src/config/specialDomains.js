/**
 * 🎯 专项领域注册库（Special Domain Registry）——三维度单一事实源（两档化 v2）
 * ============================================================
 * 结构：学科 → 领域条目。领域条目：
 *   key/label/desc            领域标识与展示（卷面组织层）
 *   anchor/anchors/source     课标语义锚（必填）：真实课标领域/任务群/素养名；
 *                             anchors 支持按学段体系分写（义教 vs 高中），体系名不混用
 *   verified                  'A'=已按官方文件核对可入生产；'B'=待复核（默认不入生产，见 allowVerifiedB）
 *   stageList                 适用学段（五档直列：primary_low/mid/high、middle、high）
 *   sections?                 可选栏目：A档=领域专属栏目（教学编排差异显著时给）；
 *                             缺省/空 = B档：结构走通用（学科）蓝图，仅注入锚句
 * 🔴 课标合规（与其它资料类型同基准）：
 *   · 结构是卷面组织语，系统设计、不预设内容；
 *   · 语义只锚课标真名，具体条文沿用 SUBJECT_STAGE_EXTRAS 的 source 机制，不杜撰条款文字；
 *   · 学段体系隔离：高中锚走 高中课标(2017/2020) 名，不与义教(2022) 同名混用；
 *   · 未收录组合回退通用专项并如实提示，不静默伪造领域。
 */
const STAGE_NAMES = {
  primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段', middle: '初中', high: '高中',
};

const domain = (key, label, desc, source, anchor, opts = {}) => ({
  key, label, desc, source,
  anchor,
  anchors: opts.anchors || null,       // {义教?: string, 高中?: string} → 覆盖 anchor（体系隔离）
  verified: opts.verified || 'A',      // 'A' 入生产；'B' 需 allowVerifiedB 才对外
  stageList: opts.stageList || [],     // 五档直列
  sections: opts.sections || null,     // A档栏目（可选）；null=B档
});

const REGISTRY = {
  语文: [
    domain('阅读理解', '📖 阅读理解', '不同文体阅读训练（按学段选文体：儿歌/童话/记叙文/说明文/议论文等）', '2022义教语文·阅读与鉴赏 + 文学阅读与创意表达等任务群',
      '语文学习任务群·文学阅读与创意表达（实践活动·阅读与鉴赏）',
      {
        stageList: ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'],
        anchors: { 高中: '普通高中语文·必修任务群（文学阅读与写作 / 思辨性阅读与表达 / 实用性阅读与交流）' },
        sections: [
          { name: '选文共读', note: '原创短文，不照录课文/网络文；题量档按注入的学段结构' },
          { name: '分层设问', note: '设问由浅入深、有思维梯度，作答形态与题干措辞一致' },
          { name: '错因点拨', note: '解析讲明错因与正确思路' },
        ],
      }),
    domain('古诗词', '🏯 古诗词', '古诗词诵读与鉴赏积累', '2022义教语文·语言文字积累与梳理 / 阅读与鉴赏',
      '中华优秀传统文化（诵读积累 + 阅读与鉴赏）',
      {
        stageList: ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'],
        anchors: { 高中: '普通高中语文·中华传统文化经典研习（必修+选必任务群）' },
        // B档：结构走通用（按单元分板块），只挂语义锚
      }),
    domain('文言文', '📜 文言文', '文言文阅读与词句理解', '2022义教语文·第四学段阅读与鉴赏（文言文）',
      '中华优秀传统文化·文言文阅读（义教第四学段起步）',
      {
        stageList: ['middle', 'high'],
        anchors: { 高中: '普通高中语文·中华传统文化经典研习（文言文篇目）' },
        sections: [
          { name: '文段精读', note: '原创或课外选段，注释助学' },
          { name: '词句理解', note: '实词/句意/翻译设问，按学段难度' },
          { name: '主旨迁移', note: '结合主题谈启示' },
        ],
      }),
    domain('写作', '✍️ 写作', '写作技法与实战训练（按学段：写话/习作/写作）', '2022义教语文·表达与交流（书面表达）',
      '语文学习任务群·文学阅读与创意表达（书面表达：写话→习作→写作，按学段递进）',
      {
        stageList: ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'],
        anchors: { 高中: '普通高中语文·文学阅读与写作 / 思辨性阅读与表达（书面任务群）' },
        sections: [
          { name: '方法指导', note: '面向本领域写作要点给出可操作写法（只作方法组织，不代写内容）' },
          { name: '片段/篇章训练', note: '按学段题量，设题指向本领域技法' },
          { name: '典例与升格', note: '示例讲解 + 修改方向' },
        ],
      }),
  ],
  数学: [
    domain('计算', '🔢 计算', '数与运算基础（口算/笔算/混合运算，初中为有理数与代数式运算）', '2022义教数学·数与代数',
      '数与代数（运算能力）',
      {
        stageList: ['primary_low', 'primary_mid', 'primary_high', 'middle'],
        anchors: { 义教小学: '数与代数·数与运算（运算能力）', 义教初中: '数与代数·数与式（数与式运算，运算能力）' },
        sections: [
          { name: '基础计算', note: '按学段呈现：口算/直接写得数结果位留白等按渲染契约（初中为数与式运算，过程按载体协议）' },
          { name: '算理与过程', note: '竖式/脱式/代数式运算等过程书写载体按载体协议；算理辨析' },
          { name: '算理易错', note: '错因辨析与思路点拨' },
        ],
      }),
    domain('应用题', '📐 应用题', '实际问题解决（读题→建模→列式→求解）', '2022义教数学·数与代数',
      '数与代数（解决问题）',
      {
        stageList: ['primary_low', 'primary_mid', 'primary_high', 'middle'],
        anchors: { 义教小学: '数与代数·数量关系（解决问题）', 义教初中: '数与代数·方程与不等式、函数（模型观念·解决问题）' },
        // B档：栏目按数学通用（知识层级分板块），只挂语义锚
      }),
    domain('几何', '📏 几何', '图形性质/测量/变化与坐标（按学段）', '2022义教数学·图形与几何',
      '图形与几何',
      {
        stageList: ['primary_low', 'primary_mid', 'primary_high', 'middle'],
        anchors: { 义教小学: '图形与几何（图形的认识与测量 / 位置与运动）', 义教初中: '图形与几何（图形的性质 / 图形的变化 / 图形与坐标）' },
        // B档
      }),
    domain('函数', '📈 函数', '函数概念/图象与性质（高中）', '普通高中数学课标(2017/2020)·必修主题·函数',
      '高中必修主题·函数（含幂指对/三角初步）', { stageList: ['high'], verified: 'B' }),
    domain('几何与代数', '📐 几何与代数', '向量/立体/解析几何（高中）', '普通高中数学课标(2017/2020)·必修主题·几何与代数',
      '高中必修主题·几何与代数', { stageList: ['high'], verified: 'B' }),
    domain('概率与统计', '📊 概率与统计', '统计与概率基础（高中）', '普通高中数学课标(2017/2020)·必修主题·概率与统计',
      '高中必修主题·概率与统计', { stageList: ['high'], verified: 'B' }),
    domain('数学建模活动', '🧮 数学建模活动', '建模与探究（高中）', '普通高中数学课标(2017/2020)·必修主题·数学建模活动与数学探究活动',
      '高中必修主题·数学建模活动与数学探究活动', { stageList: ['high'], verified: 'B' }),
  ],
  英语: [
    domain('阅读理解', '📖 阅读理解', '英语阅读策略与语篇理解', '2022义教英语·语言技能（读/看）',
      '语言技能·理解性技能（读、看）+ 主题范畴语篇',
      {
        stageList: ['primary_mid', 'primary_high', 'middle', 'high'],
        anchors: { 高中: '普通高中英语·语言技能（读/看，主题语境语篇）' },
        // B档
      }),
    domain('语法', '📝 语法', '语法知识精讲与语境训练', '2022义教英语·语言知识·语法知识',
      '语言知识·语法知识（在语篇/语境中理解与运用）',
      {
        stageList: ['primary_high', 'middle', 'high'],
        anchors: { 高中: '普通高中英语·语言知识（语法知识，主题语境下运用）' },
        // B档
      }),
  ],
};

/** 允许把 verified='B' 的领域对外（默认 false：B 级课标名未复核前不入生产） */
const ALLOW_VERIFIED_B = false;

/** 语义锚按学段体系解析（高中→高中名；义教小学/义教初中→各自课标主题名；未分写回退 anchor） */
const resolveAnchor = (d, stageKey) => {
  if (!d.anchors) return d.anchor;
  if (stageKey === 'high') return d.anchors.高中 || d.anchor;
  // 义教课标主题名按学段分写（如数学：小学"数与运算/数量关系/图形的认识与测量"，
  //   初中"数与式/方程与不等式、函数/图形的性质、变化与坐标"——主题名不同，不能混用）
  const isPrimary = stageKey === 'primary_low' || stageKey === 'primary_mid' || stageKey === 'primary_high';
  if (isPrimary) return d.anchors.义教小学 || d.anchors.义教 || d.anchor;
  return d.anchors.义教初中 || d.anchors.义教 || d.anchor;
};

/** 取某学科某学段可用领域（供 UI/委托；B 级默认过滤） */
export const specialDomainOptions = (subject = '', stageKey = '') =>
  (REGISTRY[subject] || [])
    .filter((d) => (ALLOW_VERIFIED_B || d.verified === 'A') && d.stageList.includes(stageKey))
    .map((d) => ({ value: d.key, label: d.label, desc: d.desc, curriculum: resolveAnchor(d, stageKey) }));

/** 解析所选领域：学科+学段+领域 全匹配才返回（B 级默认拒），否则 null → 回退通用专项 */
export const resolveSpecialDomain = (subject = '', stageKey = '', domainKey = '') => {
  if (!subject || !domainKey || !stageKey) return null;
  const hit = (REGISTRY[subject] || []).find((d) => d.key === domainKey);
  if (!hit || !hit.stageList.includes(stageKey)) return null;
  if (hit.verified !== 'A' && !ALLOW_VERIFIED_B) return null;
  return { ...hit, anchor: resolveAnchor(hit, stageKey) };
};

const 学段名 = (stageKey = '') => STAGE_NAMES[stageKey] || '';

/** A档结构文本 + 锚句（与通用蓝图同一叙事口径；不含数字题量占位） */
export const buildSpecialDomainStructureText = (dom = {}, stageKey = '') => {
  if (!dom.sections || !dom.sections.length) return '';
  const lines = dom.sections.map((s) => `· ${s.name}——${s.note}`).join('\n');
  return `【教辅结构（专项领域·${dom.label}·${学段名(stageKey)}）——栏目与要求，按此组织】
▌栏目框架（栏目完整，不得缺失；板块间不重复、不相似；各栏目内容均须具体可操作，并按认知层次由浅入深递进）
${lines}
· 本领域课标语义锚：${dom.anchor}——命题遵守已注入的 学科×学段 课标要点（不超学段学业质量），数据/情境/语料一律自拟。`;
};

/** B档锚句（追加到通用/学科蓝图结构之后） */
export const buildSpecialDomainAnchorLine = (dom = {}) =>
  dom.anchor ? `· 本领域课标语义锚：${dom.anchor}——命题遵守已注入的 学科×学段 课标要点（不超学段学业质量），数据/情境/语料一律自拟。` : '';

/** 通用专项说明（与真实生效蓝图一致；供 UI/兜底展示） */
export const GENERIC_SPECIAL_DESC =
  '使用通用专项结构（分板块组织：按知识层级分板块，板块间有合理梯度、由浅入深，层次依内容自然形成；每板块配解析）。';
