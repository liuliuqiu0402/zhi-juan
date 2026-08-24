/**
 * 新课标达标自处理（评估后自动修复，形成闭环）
 * ============================================================
 * ⚠️ 现状声明（2026-08）：生成端已移除质检（PostPass），本文件无调用点（死代码保留供参考）。
 * 原「问题板块定向重生成」逻辑随分步流水线删除；整卷一次生成的质量由指令库注入保证。
 *
 * 🔴 目的：评估结果不能只"报告"，要能自动处理——
 *    根据 curriculumCheck 未达标维度，生成针对性修复动作：
 *
 *    A 程序化修复（无 AI，确定性，可单测）：
 *      - D4 机械记忆 → 无法程序化改写（需 AI），但可标记待重生成部分
 *      - D6 超纲词汇 → 程序化替换为学段内同义词/移除（白名单映射）
 *      - D7 分值体系 → 程序化校准（末大题修正使大题之和=满分）
 *    B AI 定向重生成（局部，只重写问题部分，不复写整卷）：
 *      - D1 情境化缺失 → 重生成时强制注入真实情境要求
 *      - D2 设问层次单一 → 重生成时强制补充推理层设问
 *      - D4 机械记忆 → 重生成时强制改写为理解运用型
 *      - D5 语篇过短/超长 → 重生成时强制按分档长度控制
 *
 * 输出：{ actions: [{type:'fix'|'regenerate', dim, prompt}], fixable:boolean, planSummary }
 * ============================================================
 */

// 超纲词 → 学段内可替换词映射（程序化修复用；无映射则建议重生成）
const OVERRIDE_MAP = {
  '方程': '等式', '负数': '比0小的数', '代数': '字母表示数',
  '几何证明': '图形说理', '函数': '数量关系', '坐标系': '位置图',
  '概率': '可能性', '统计图': '图表', '文言文': '古代故事', '议论文': '说理文',
  '修辞手法': '表达方式', '语法分析': '句子成分', '文学鉴赏': '阅读体会',
  '语法填空': '用词填空', '完形填空': '选词补全', '阅读理解长篇': '短文阅读',
  '书面表达': '写话练习', '导数': '变化率', '微积分': '高等数学', '对数函数': '函数',
  '复数': '数', '向量': '有方向的量', '矩阵': '数表', '概率密度': '概率分布',
  '量子力学': '微观世界', '相对论': '高速运动', '核物理': '原子核', '电磁波谱': '电磁波',
  '光电效应': '光的粒子性', '有机化学': '含碳化合物', '电化学': '电池原理',
  '化学平衡': '反应平衡', '晶体结构': '固体结构', '学术英语': '规范英语',
  '科技英语': '科普英语', '商务英语': '应用英语', '泛函分析': '高等分析',
  '拓扑学': '几何学', '数论': '整数理论', '微分几何': '曲线几何',
  '量子场论': '微观理论', '广义相对论': '引力理论', '粒子物理': '微观粒子',
  '高分子化学': '大分子化合物', '核化学': '原子核化学', '生物化学': '生命化学',
};

/**
 * 根据达标评估结果生成自处理方案
 * @param {object} assessment curriculumCheck 评估结果（assessCompliance 返回）
 * @param {object} ctx { subject, stageLabel, genType, planName? }
 * @returns {object} { actions, fixable, planSummary }
 */
export function buildAutoFixPlan(assessment, ctx = {}) {
  if (!assessment?.dimensions?.length) {
    return { actions: [], fixable: false, planSummary: '无评估结果，无需处理' };
  }
  const { subject = '', stageLabel = '', genType = '' } = ctx;
  const failed = assessment.dimensions.filter(d => !d.passed);
  if (failed.length === 0) {
    return { actions: [], fixable: false, planSummary: '全部维度达标，无需处理' };
  }

  const actions = [];
  let programmaticFixes = 0;

  for (const dim of failed) {
    switch (dim.id) {
      case 'D6': { // 超纲词汇 → 程序化替换（白名单映射）
        const hits = (dim.evidence || []).filter(w => OVERRIDE_MAP[w]);
        if (hits.length) {
          actions.push({
            type: 'fix', dim: dim.id, scope: 'replace',
            detail: `将超纲词替换为学段内表述：${hits.map(w => `"${w}"→"${OVERRIDE_MAP[w]}"`).join('、')}`,
            replacements: hits.map(w => ({ from: w, to: OVERRIDE_MAP[w] })),
          });
          programmaticFixes++;
        } else {
          actions.push({
            type: 'regenerate', dim: dim.id, scope: 'section',
            detail: `存在无映射超纲词（${(dim.evidence || []).join('、')}），需重生成对应板块并严格限定学段词汇`,
          });
        }
        break;
      }
      case 'D7': { // 分值体系 → 程序化校准（末板块修正）
        actions.push({
          type: 'fix', dim: dim.id, scope: 'score',
          detail: '校准分值体系：调整末板块分值使大题之和=满分（末板块修正法）',
        });
        programmaticFixes++;
        break;
      }
      case 'D1': { // 情境化缺失 → 重生成并强制真实情境
        actions.push({
          type: 'regenerate', dim: dim.id, scope: 'section',
          detail: `重生成板块并强制注入真实情境（生活/校园/科技/传统文化载体，禁止裸考知识点）——${(ctx.planName || '对应板块')}`,
          promptHint: '所有题目必须置于真实、适切的情境中（生活/校园/家庭/社会/科技/传统文化），禁止无情境裸考知识点；同一情境全卷≤2处。',
        });
        break;
      }
      case 'D2': { // 设问层次单一 → 重生成并补充推理层
        actions.push({
          type: 'regenerate', dim: dim.id, scope: 'section',
          detail: '重生成板块并强制补充推理/评价层设问（为什么/你认为/结合全文分析/推断），设问沿"信息提取→理解分析→推理评价"递进',
          promptHint: '设问必须沿"信息提取→理解分析→推理评价"递进，至少包含1道推理/评价层设问（为什么/你认为/推断/结合全文分析/评价）。',
        });
        break;
      }
      case 'D4': { // 机械记忆 → 重生成并改写为理解运用型
        actions.push({
          type: 'regenerate', dim: dim.id, scope: 'section',
          detail: `重生成板块并改写机械记忆型设问为理解运用型（${(dim.evidence || []).join('、')}）`,
          promptHint: '禁止机械记忆型设问（根据课文内容填空/默写古诗等），一律改为语境、情境中考查理解与运用。',
        });
        break;
      }
      case 'D5': { // 语篇长度 → 重生成并控制长度
        actions.push({
          type: 'regenerate', dim: dim.id, scope: 'section',
          detail: `重生成板块并按要求控制语篇长度（${dim.detail}）`,
          promptHint: `语篇长度必须匹配学段分档（${dim.detail}），阅读/听力材料过短无法支撑设问梯度，过长超出学段负荷。`,
        });
        break;
      }
      case 'D3': { // 素养立意不足 → 重生成并强化素养导向
        actions.push({
          type: 'regenerate', dim: dim.id, scope: 'section',
          detail: '重生成板块并强化素养立意（情境+高层次设问结合，减少纯知识考查）',
          promptHint: '以素养立意为导向：题目通过真实情境与多层次设问考查学科核心素养，杜绝死记硬背与机械训练式试题。',
        });
        break;
      }
      default: {
        actions.push({
          type: 'regenerate', dim: dim.id, scope: 'section',
          detail: `重生成板块以修复「${dim.name}」（${dim.detail}）`,
        });
      }
    }
  }

  const fixCount = actions.filter(a => a.type === 'fix').length;
  const regenCount = actions.filter(a => a.type === 'regenerate').length;
  const planSummary = `${assessment.overall === '通过' ? '全部达标' : `发现 ${failed.length} 个未达标维度`}：程序化修复 ${fixCount} 项 + AI 定向重生成 ${regenCount} 项${genType ? `（${subject}${stageLabel}·${genType}）` : ''}`;

  return { actions, fixable: actions.length > 0, planSummary };
}

/**
 * 执行程序化修复（无 AI，确定性）
 * @param {string} content 原始 HTML
 * @param {Array} fixActions buildAutoFixPlan 输出的 type='fix' 动作
 * @returns {string} 修复后内容
 */
export function applyProgrammaticFixes(content, fixActions) {
  let out = content;
  for (const action of fixActions || []) {
    if (action.type !== 'fix') continue;
    if (action.scope === 'replace' && action.replacements?.length) {
      for (const { from, to } of action.replacements) {
        out = out.split(from).join(to);
      }
    }
    // D7 分值体系校准：由上层 checkScoreConsistency/autoFix 处理（此处仅标记，不重复实现）
  }
  return out;
}

/**
 * 构建 AI 定向重生成指令（只重写问题板块，不复写整卷）
 * @param {Array} regenActions buildAutoFixPlan 输出的 type='regenerate' 动作
 * @param {object} ctx { sectionName, sectionInstruction, systemMessage }
 * @returns {string} 修复 prompt（含原始板块指令 + 定向修复要求）
 */
export function buildRegeneratePrompt(regenActions, ctx = {}) {
  const { sectionName = '', sectionInstruction = '', systemMessage = '' } = ctx;
  if (!regenActions?.length) return '';
  const fixes = regenActions
    .map((a, i) => `${i + 1}. [${a.dim}] ${a.detail}${a.promptHint ? `（要求：${a.promptHint}）` : ''}`)
    .join('\n');
  return `【板块定向重生成（只重写问题板块，保持其余内容不变）】
板块「${sectionName}」未通过新课标达标评估，请按下列要求重写该板块：

【需修复的问题】
${fixes}

【修复要求】
1. 只重写「${sectionName}」板块，其他板块内容原封不动；
2. 严格保留原有HTML结构、CSS类名、填空格式（<u class="blank-N">）不变；
3. 修复后该板块小题分值之和保持不变（与原板块总分一致）；
4. 直接返回修复后的完整HTML片段，不要加任何解释说明。

${sectionInstruction ? `【原始板块指令（含考点/素材，重写须遵循）】\n${sectionInstruction}` : ''}`;
}

export default { buildAutoFixPlan, applyProgrammaticFixes, buildRegeneratePrompt, OVERRIDE_MAP };
