/**
 * 教辅结构蓝本库（Teaching Blueprints）—— 与 examPaperBlueprints 对称
 * ============================================================
 * 🔴 定位：8 类教辅资料（课时练/专项突破/课前预习/阅读训练/知识总结/默写积累/错题本/复习资料）的
 *    "栏目框架 + 题量/字数底线 + 时长适配"确定性来源，按 类型 × 学段 三维度注入。
 *
 * 与指令库分工（同义表述只留一处）：
 *   - 指令库模板：角色、任务定位、质量要求（防机械重复/不孤立/图文一致等）、输出格式
 *   - 本库：栏目框架、题量/字数底线、时长适配、关键元素——模板不再重复具体数字与栏目明细
 *   - 规则库：生成后静默质检（教辅题量充足性、禁标分值等 guard）
 *
 * 题量数字与 typeDistribution.js（UI 题型自动填充）对齐，保证界面展示与生成注入同源。
 * 生成端 buildTeachingInjection 按 学段×类型 注入，与 exam 的 buildBlueprintInjection 对称。
 * ============================================================
 */

/** 学段显示名 */
export const TEACHING_STAGE_NAMES = {
  primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段', middle: '初中', high: '高中',
};

/**
 * 教辅结构蓝本：类型 × 学段参数
 * sections: 栏目框架（生成注入用，非固定分值）
 * stages:   各学段参数 { duration 建议时长, volume 题量/字数底线, note 学段注意 }
 */
export const TEACHING_BLUEPRINTS = {
  // ══════════════ 课时练 ══════════════
  practice: {
    label: '课时练',
    sections: [
      { name: '基础建构任务', note: '覆盖本课时全部核心知识点，基础题为主，题量约占一半' },
      { name: '探究进阶任务', note: '变式与综合运用，换情境、换角度、换题型，考查迁移能力' },
      { name: '迁移创新任务', note: '开放性/实践性任务，联系真实生活' },
    ],
    stages: {
      primary_low: { duration: '30分钟', volume: '6-9题', note: '以认读/口答/简单书写为主，图文并茂；按"基础→探究→迁移"三层组织，严禁只罗列题目' },
      primary_mid: { duration: '40分钟', volume: '8-12题', note: '书写量适中，情境生活化' },
      primary_high: { duration: '45分钟', volume: '10-15题', note: '增加开放与思辨设问' },
      middle: { duration: '45分钟', volume: '8-12题', note: '含过程性考查与规范书写要求' },
      high: { duration: '45分钟', volume: '10-15题', note: '素养立意，设问有层次' },
    },
  },

  // ══════════════ 专项突破 ══════════════
  special: {
    label: '专项突破',
    sections: [
      { name: '分板块组织', note: '按题型或考点分 2-4 个板块（每个板块一个考点/题型），板块内按基础→提升→拓展分层' },
      { name: '每板块配解析', note: '每板块 3-5 题并附解析，聚焦本单元薄弱点' },
    ],
    stages: {
      primary_low: { duration: '30分钟', volume: '每类3-4题，2-3类', note: '题目短小，情境游戏化' },
      primary_mid: { duration: '40分钟', volume: '每类3-5题，2-4类', note: '' },
      primary_high: { duration: '45分钟', volume: '每类4-5题，3-4类', note: '含综合变式题' },
      middle: { duration: '45分钟', volume: '每类3-5题，3-4类', note: '含过程性设问' },
      high: { duration: '45分钟', volume: '每类4-6题，3-5类', note: '素养立意，设问有区分度' },
    },
  },

  // ══════════════ 课前预习 ══════════════
  preview: {
    label: '课前预习',
    sections: [
      { name: '学习目标', note: '1-2 条，明确本课时要达成的目标' },
      { name: '预习任务', note: '问题驱动（圈画/概括/查阅/尝试），可操作可检查，覆盖本课时全部新知识点' },
      { name: '预习检测', note: '2-4 道自检题，检测预习效果' },
      { name: '我的疑问', note: '必设栏目，供学生记录预习中不懂的问题' },
    ],
    stages: {
      primary_low: { duration: '15-20分钟', volume: '检测2-3题', note: '以圈一圈/连一连等操作型任务为主' },
      primary_mid: { duration: '20分钟', volume: '检测3-4题', note: '' },
      primary_high: { duration: '20-25分钟', volume: '检测4-5题', note: '' },
      middle: { duration: '20分钟', volume: '检测4-5题', note: '预习任务含自主查阅与概括' },
      high: { duration: '25分钟', volume: '检测4-6题', note: '任务指向重难点与前置知识衔接' },
    },
  },

  // ══════════════ 阅读训练 ══════════════
  reading: {
    label: '阅读训练',
    sections: [
      { name: '原创选文', note: '原创短文（不复制课文/网络文章），课外选文主题须与单元相关，短文完整呈现（不截断），选文末标注出处' },
      { name: '分层设题', note: '每篇配 3-5 道分层题（信息提取→理解→评价），题目不可直接在原文找到原句答案' },
    ],
    stages: {
      primary_low: { duration: '20-30分钟', volume: '2篇/80-150字/每篇3-4题', note: '短文短小，设问口语化' },
      primary_mid: { duration: '30-40分钟', volume: '2篇/150-300字/每篇3-5题', note: '' },
      primary_high: { duration: '40分钟', volume: '2-3篇/300-500字/每篇4-6题', note: '含概括与简单评价题' },
      middle: { duration: '45分钟', volume: '2-3篇/500-900字/每篇4-6题', note: '含 1 篇非连续性文本（图表/通知/广告/海报）' },
      high: { duration: '45-60分钟', volume: '3篇/900-1500字/每篇5-7题', note: '含论述类/实用类/文学类文本' },
    },
  },

  // ══════════════ 知识总结 ══════════════
  summary: {
    label: '知识总结',
    sections: [
      { name: '知识框架', note: '结构化呈现（导图/表格/对比优先），覆盖本单元全部知识点' },
      { name: '重点梳理', note: '逐点梳理并标注教材出处，重点内容突出' },
      { name: '易错辨析', note: '列出 2-3 个易错点并辨析' },
      { name: '典型例题', note: '2-3 道典型例题（含解析）' },
    ],
    stages: {
      primary_low: { duration: '—', volume: '正文300-500字', note: '图文并茂，多用表格与图示' },
      primary_mid: { duration: '—', volume: '正文500-800字', note: '' },
      primary_high: { duration: '—', volume: '正文800-1200字', note: '' },
      middle: { duration: '—', volume: '正文800-1200字', note: '含规律与方法归纳' },
      high: { duration: '—', volume: '正文1200-1800字', note: '含知识网络与素养导向梳理' },
    },
  },

  // ══════════════ 默写积累 ══════════════
  dictation: {
    label: '默写积累',
    sections: [
      { name: '看拼音写词语', note: '拼音词嵌入语境句（非孤立罗列），空格数与拼音组一一对应' },
      { name: '积累默写', note: '本单元要求掌握的字词/成语/名句/篇目，严格对应教材要求' },
      { name: '书写格', note: '语文1-2年级田字格、3年级起方格/横线；英语小学四线三格、中学起单线' },
    ],
    stages: {
      primary_low: { duration: '15分钟', volume: '字词4-8个，拼音语境句2-3句', note: '以本单元生字词为主' },
      primary_mid: { duration: '20分钟', volume: '字词8-12个，名句/成语适量', note: '' },
      primary_high: { duration: '20分钟', volume: '字词12-18个，含名句默写', note: '' },
      middle: { duration: '20分钟', volume: '字词12-16个，名句按课标篇目', note: '含易错字形辨析' },
      high: { duration: '25分钟', volume: '名句按高考要求篇目，字词15-20个', note: '含情境默写' },
    },
  },

  // ══════════════ 错题本 ══════════════
  errorbook: {
    label: '错题本',
    sections: [
      { name: '原题重现', note: '完整重现原题（可精简题干，保留关键信息）' },
      { name: '错误归因', note: '具体到知识点，禁止笼统写"粗心"' },
      { name: '正确解法', note: '分步完整解答' },
      { name: '同类变式', note: '每题 1 道变式（换情境、换设问角度，不复刻原题思路）' },
      { name: '解题策略', note: '归纳本类题通用策略' },
    ],
    stages: {
      primary_low: { duration: '—', volume: '4-6题', note: '按知识点或题型分类，每题结构完整' },
      primary_mid: { duration: '—', volume: '5-8题', note: '' },
      primary_high: { duration: '—', volume: '6-10题', note: '' },
      middle: { duration: '—', volume: '6-10题', note: '归因须具体到知识模块' },
      high: { duration: '—', volume: '8-12题', note: '含方法性归因与迁移策略' },
    },
  },

  // ══════════════ 复习资料 ══════════════
  review: {
    label: '复习资料',
    sections: [
      { name: '知识框架', note: '覆盖本单元全部知识点的结构图/表格' },
      { name: '考点梳理', note: '按考点逐条梳理（标注教材出处），重点难点突出' },
      { name: '典型题析', note: '2-3 道典型题（含解题思路分析）' },
      { name: '易错聚焦', note: '3-5 个易错点辨析' },
      { name: '综合自测', note: '分层自测（基础/提高），按考点分布、避免同考点重复考查' },
    ],
    stages: {
      primary_low: { duration: '30分钟', volume: '自测8-12题/≥3种题型', note: '自测题情境化、图文并茂' },
      primary_mid: { duration: '40分钟', volume: '自测12-18题/≥4种题型', note: '' },
      primary_high: { duration: '45分钟', volume: '自测15-25题/≥4种题型', note: '含开放与思辨题' },
      middle: { duration: '45分钟', volume: '自测12-20题/≥4种题型', note: '含过程性考查' },
      high: { duration: '60分钟', volume: '自测15-25题/≥5种题型', note: '素养立意，设问有层次' },
    },
  },
};

/** 全部教辅类型键 */
export const TEACHING_GEN_TYPES = Object.keys(TEACHING_BLUEPRINTS);

/** 学段键归一：接受学段键（primary_low 等）或中文学段/年级标签（'小学低段'/'二年级'/'高一' 等） */
function normalizeTeachingStage(stage = '') {
  const s = String(stage).trim();
  if (['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'].includes(s)) return s;
  if (/高一|高二|高三/.test(s) || s === '高中') return 'high';
  if (s === '初中' || /七年级|八年级|九年级/.test(s)) return 'middle';
  if (/一年级|二年级/.test(s) || s.includes('低段')) return 'primary_low';
  if (/三年级|四年级/.test(s) || s.includes('中段')) return 'primary_mid';
  if (/五年级|六年级/.test(s) || s.includes('高段')) return 'primary_high';
  if (/小学/.test(s)) {
    const g = parseInt(s.replace(/\D/g, ''), 10) || 0;
    if (g >= 1 && g <= 2) return 'primary_low';
    if (g >= 3 && g <= 4) return 'primary_mid';
    return 'primary_high';
  }
  return 'primary_mid'; // 无法识别时宽松回退（不阻断生成）
}

/**
 * 查询教辅结构蓝本
 * @param {Object} opts { genType(资料类型), stage(学段键 primary_low 等) }
 * @returns {Object|null} { label, sections, stageParams, key }
 */
export function getTeachingBlueprint({ genType = '', stage = '' } = {}) {
  const bp = TEACHING_BLUEPRINTS[genType];
  if (!bp) return null;
  const stageKey = normalizeTeachingStage(stage);
  const stageParams = bp.stages[stageKey] || bp.stages.primary_mid;
  return { label: bp.label, sections: bp.sections, stageParams, key: `${genType}|${stageKey}`, stageKey };
}

/**
 * 构建教辅结构注入块（供生成指令尾部附加，与 exam 的 buildBlueprintInjection 对称）
 * @param {Object} opts { genType, stage }
 * @returns {string} 空串 = 无蓝本
 */
export function buildTeachingInjection({ genType = '', stage = '' } = {}) {
  const bp = getTeachingBlueprint({ genType, stage });
  if (!bp) return '';
  const sectionsText = bp.sections.map(s => `· ${s.name}——${s.note}`).join('\n');
  const p = bp.stageParams;
  return `\n\n【教辅结构（${bp.label}·${TEACHING_STAGE_NAMES[bp.stageKey] || bp.stageKey}）——栏目与题量底线，按此组织】
▌栏目框架（栏目完整，不得缺失；板块间不重复、不相似）
${sectionsText}
▌题量与时长
· 建议时长：${p.duration}
· 题量/篇幅底线：${p.volume}（内容充足饱满，严禁单薄空洞；严禁只罗列题目或同知识点反复考查）${p.note ? `\n· 学段注意：${p.note}` : ''}`;
}

export default {
  TEACHING_BLUEPRINTS,
  TEACHING_GEN_TYPES,
  TEACHING_STAGE_NAMES,
  getTeachingBlueprint,
  buildTeachingInjection,
};
