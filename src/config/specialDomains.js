/**
 * 🎯 专项领域注册库（Special Domain Registry）——三维度单一事实源
 * ============================================================
 * 定位：专项突破的"领域层"（学段 × 学科 × 领域 → 栏目结构 + 课标语义锚），
 *       与 teachingBlueprints（类型层通用结构）、promptLibrary（指令层）并列。
 * 🔴 课标合规口径（与其它资料类型同基准）：
 *   · 结构（栏目）是"组织语/卷面层"——由系统按领域设计，不给模型内容预设；
 *   · 语义（该领域该考什么、什么范围、什么能力）只锚定课标——anchor 一律写
 *     课标真实领域/任务群/素养名（如 数与运算、阅读与鉴赏、主题语篇），
 *     具体条文引用沿用 SUBJECT_STAGE_EXTRAS 的 source（2022义教/2017高中课标），本文件不杜撰条款文字；
 *   · 未收录组合（如中学段、未开设领域库的学科）→ 回退 通用专项（蓝图分板块结构），UI 如实提示，
 *     不静默伪造领域。
 * ============================================================
 */

/** 学段桶：五档 stageKey → 桶（当前领域库以"小学"桶起步；中学桶待课标领域盘点文档确认后扩充） */
const STAGE_BUCKET = {
  primary_low: 'primary', primary_mid: 'primary', primary_high: 'primary',
  middle: 'secondary', high: 'secondary',
};
export const bucketOfStage = (stageKey = '') => STAGE_BUCKET[stageKey] || '';

/**
 * 领域定义
 * @param {string} key  领域键（与 UI/委托同源）
 * @param {string} label 显示名
 * @param {string} desc  选择器一句话说明（组织层）
 * @param {string} anchor 课标语义锚（真实课标领域/任务群/素养名；不带杜撰条文）
 * @param {Array<{name:string, note:string}>} sections 栏目结构（卷面组织，按领域专属编排）
 * @param {string[]} buckets 适用学段桶（primary=小学 1~6 年级；secondary=初中/高中）
 */
const domain = (key, label, desc, anchor, sections, buckets = ['primary', 'secondary']) => ({ key, label, desc, anchor, sections, buckets });

const REGISTRY = {
  语文: [
    domain('阅读理解', '📖 阅读理解', '记叙文/说明文/议论文阅读训练',
      '语文学习任务群·文学阅读与创意表达（阅读与鉴赏）',
      [
        { name: '选文共读', note: '本领域专项按阅读素养设题：原创短文（不照录课文/网络文），题量档按注入的学段结构' },
        { name: '分层设问', note: '信息提取→理解→评价/迁移由浅入深，作答形态与题干措辞一致' },
        { name: '错因点拨', note: '解析讲明错因与正确思路' },
      ]),
    domain('古诗词', '🏯 古诗词', '古诗词鉴赏与积累训练',
      '语文课程内容·中华优秀传统文化（语言文字积累与梳理 / 阅读与鉴赏）',
      [
        { name: '诵读积累', note: '按本单元/本册课标与教材要求选篇（背诵与理解）' },
        { name: '鉴赏理解', note: '意象/情感/写法由浅入深设问，基于语料自拟表述' },
        { name: '迁移运用', note: '联系生活/情境运用诗句' },
      ]),
    domain('文言文', '📜 文言文', '文言文阅读与翻译训练',
      '语文课程内容·中华优秀传统文化（阅读与鉴赏·古诗文），初中段按第四学段文言文目标',
      [
        { name: '文段精读', note: '原创或课外选段，注释助学' },
        { name: '词句理解', note: '实词/句意/翻译设问，按学段难度' },
        { name: '主旨迁移', note: '结合主题谈启示' },
      ], ['secondary']),
    domain('写作', '✍️ 写作', '写作技法与实战训练',
      '表达与交流（书面表达）：能写记实与想象作文、条理清楚',
      [
        { name: '方法指导', note: '面向本领域写作要点给出可操作写法（只作方法组织，不代写内容）' },
        { name: '片段/篇章训练', note: '按学段题量，设题指向本领域技法' },
        { name: '典例与升格', note: '示例讲解 + 修改方向' },
      ]),
  ],
  数学: [
    domain('计算', '🔢 计算', '口算/竖式/巧算/混合运算训练',
      '数与代数·数与运算（运算能力），含本单元算理与算法',
      [
        { name: '基础计算', note: '口算/直接写得数：结果位留白（不画线不框）等按渲染契约' },
        { name: '笔算过关', note: '竖式/脱式/简便：过程书写载体按载体协议' },
        { name: '算理易错', note: '错因辨析与思路点拨' },
      ]),
    domain('应用题', '📐 应用题', '读题→建模→列式→求解训练',
      '数与代数·数量关系（解决问题），情境真实、数据自洽',
      [
        { name: '基础应用', note: '单一数量关系，情境从简' },
        { name: '综合应用', note: '多步/复合数量关系，情境贴近生活' },
        { name: '开放探究', note: '条件开放或策略多样，说理完整' },
      ]),
    domain('几何', '📏 几何', '图形认识/测量/操作训练',
      '图形与几何（图形的认识与测量/位置与运动/图形与几何综合）',
      [
        { name: '图形认识', note: '特征/关系/分类' },
        { name: '测量与计算', note: '周长/面积/体积（按学段）' },
        { name: '操作与推理', note: '作图/拼摆/简单推理，作图区按补差规则' },
      ]),
  ],
  英语: [
    domain('阅读理解', '📖 阅读理解', '英语阅读策略与技巧训练',
      '语言技能·读（语篇理解），主题语境真实地道',
      [
        { name: '语篇阅读', note: '原创短文，主题与本单元相关' },
        { name: '分层设问', note: '理解信息→推断→评价，设问由浅入深' },
      ]),
    domain('语法', '📝 语法', '语法规则精讲与阶梯训练',
      '语言知识·语法知识（在语篇/语境中理解和运用）',
      [
        { name: '规则精讲', note: '面向本领域语法点讲透使用前提（讲解组织，不预设内容）' },
        { name: '语境练习', note: '在句/段语境中阶梯训练' },
        { name: '易错辨析', note: '典型易混点辨析' },
      ]),
  ],
};

/** 取某学科当前学段可用的领域清单（供 UI 选择器；无 → 回退通用专项） */
export const specialDomainOptions = (subject = '', stageKey = '') => {
  const bucket = bucketOfStage(stageKey);
  const list = REGISTRY[subject] || [];
  return list.filter((d) => d.buckets.includes(bucket));
};

/** 解析所选领域 → { label, anchor, sections }；学科/学段/领域任一不匹配 → null（回退通用专项） */
export const resolveSpecialDomain = (subject = '', stageKey = '', domainKey = '') => {
  if (!subject || !domainKey) return null;
  const hit = (REGISTRY[subject] || []).find((d) => d.key === domainKey);
  if (!hit) return null;
  const bucket = bucketOfStage(stageKey);
  if (!hit.buckets.includes(bucket)) return null;
  return { key: hit.key, label: hit.label, anchor: hit.anchor, sections: hit.sections };
};

/** 领域委托结构文本（教辅结构·专项领域版）：栏目骨架 + 课标语义锚（与 teachingBlueprints 同一叙事口径） */
export const buildSpecialDomainStructureText = (domainObj) => {
  if (!domainObj) return '';
  const lines = domainObj.sections.map((s, i) => {
    const no = '一二三四五六七八九十'[i] || String(i + 1);
    return `${no}、${s.name}(共X题)——${s.note}`;
  });
  return `【教辅结构·专项领域：${domainObj.label}】栏目（题量按学段档）：
${lines.join('\n')}
· 本领域课标语义锚：${domainObj.anchor}——命题遵守已注入的 学科×学段 课标要点（不超学段学业质量），数据/情境/语料一律自拟。`;
};

/** 通用专项结构说明文案（与真实生效蓝图一致，供 UI/兜底展示） */
export const GENERIC_SPECIAL_DESC =
  '使用通用专项结构（分板块组织：按知识层级分板块，板块内基础→提升→拓展；每板块配解析）。';
