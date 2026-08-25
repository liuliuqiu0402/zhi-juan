/**
 * EduRender 渲染指令契约（生成端注入版）
 * ============================================================
 * 🔴 定位：告诉生成模型"如何输出可被 EduRender Studio 渲染的标记"。
 *    - [GRAPH]...[/GRAPH]  图形（坐标系/函数/几何/统计/受力/电路/光路/原子）
 *    - [IMAGE]...[/IMAGE]  配图（SD 文生图 / ICON 图标库）
 *    - $...$ / $$...$$     公式（行内 / 块级）
 * 按 学科×学段×资料类型 三维度匹配注入（需要图的学科才给、配图题才给 [IMAGE]）。
 * 注入的是"格式骨架 + 常用示例"（约 300 字），完整参数表在 EduRender Studio 端——
 * 保持指令精简，不约束模型的命题内容。
 * ============================================================
 */

/** 允许的 [GRAPH] TYPE 全集 */
export const GRAPH_TYPES = [
  'COORDINATE', 'SHAPES', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART',
  'FORCE', 'CIRCUIT', 'OPTICS', 'ATOM',
];

/** 可能产出 [GRAPH] 的学科（按需注入，不强求每题） */
export const GRAPH_SUBJECTS = ['数学', '物理', '化学', '科学', '生物', '地理', '信息科技'];

/** 需要 $公式$ 的学科 */
export const MATH_SUBJECTS = ['数学', '物理', '化学'];

/** 配图类题型（看图写话/看图列式/听音选图等）关键词 */
const IMAGE_HINT_RE = /看图|写话|配图|听音|观察|绘画|绘图/;

/**
 * 构建渲染指令契约段（三维度注入）
 * @param {Object} opts { subject(学科), genType(资料类型), needsImage(大题/资料是否配图) }
 * @returns {string} 空串 = 无需渲染指令
 */
export function buildRenderContract({ subject = '', genType = '', needsImage = false } = {}) {
  const parts = [];
  const graphNeeded = GRAPH_SUBJECTS.includes(subject);
  const formulaNeeded = MATH_SUBJECTS.includes(subject);
  if (!graphNeeded && !formulaNeeded && !needsImage) return '';

  parts.push('【渲染指令（EduRender 标记，供 EduRender Studio 渲染；仅需图/公式时使用，不计题量）】');
  if (graphNeeded) {
    parts.push(`· 图形题用 [GRAPH]...[/GRAPH]，TYPE ∈ ${GRAPH_TYPES.join('/')}，含 XLIM/YLIM 坐标与真实数据（须与题干一致）。例：`
      + '\n[GRAPH]\nTYPE:BAR_CHART\nDATA:15,22,18,30,25\nLABELS:语文,数学,英语,科学,社会\nTITLE:期末考试成绩\n[/GRAPH]');
  }
  if (formulaNeeded) {
    parts.push('· 公式用 $...$/$$...$$（如 $$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$），勿文本堆砌。');
  }
  if (needsImage) {
    parts.push('· 配图（看图写话/看图列式/配图题）用 [IMAGE]...[/IMAGE]，每图一个、单独成段，图内无字、不暗示答案，PROMPT 画面要素须与题干情境严格一致（人物/场景/数量与题干吻合，不得另起无关画面）：'
      + '\n  TYPE:SD → PROMPT:画面描述（季节/景物/人物/动作/背景）/NEGATIVE:负面词/STYLE:line_art；'
      + '\n  或 TYPE:ICON → KEYWORDS:关键词/STYLE:flat');
  }
  return `\n\n${parts.join('\n')}`;
}

/** 判定某资料/大题是否需要配图标记（题型含看图/写话/配图等） */
export function needsImageHint(text = '', genType = '') {
  return IMAGE_HINT_RE.test(String(text || '')) || genType === 'dictation';
}

export default { GRAPH_TYPES, GRAPH_SUBJECTS, MATH_SUBJECTS, buildRenderContract, needsImageHint };
