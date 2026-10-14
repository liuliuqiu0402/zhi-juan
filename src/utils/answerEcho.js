/**
 * 答案区"复述题干"检测（**纯函数·无 DOM·只报不改**）——AI 味"解析把题干原样搬一遍"
 * ============================================================
 * 为什么单独成模块：判据要**可单测**、`examValidator` 有 DOM 依赖（不便直测）⇒ 判据落本模块（单一事实源）。
 * 判据（守"促规范、不过度约束、只做能自证的断言"）：
 *   · 取**答案区**中**连续 ≥`ECHO_MIN_HANZI`(14) 个汉字**、且**原样出现在题干区**的片段 ⇒ 报（附最长匹配片段）；
 *   · 阈值取 14 汉字：术语/固定表述（"匀速直线运动"）只有 4–6 字，**不会命中**；14 字连续照搬才是"复述"信号；
 *   · **只报不改**：是不是"必要的引述"（如阅读材料引文）需人判 ⇒ notice 级进生成报告【问题列表】；
 *   · 两侧文本任一过短（<200 汉字）则**不出结论**（样本不足 ⇒ 不自证）。
 * 已知误报边界（**如实登记**）：阅读训练类解析**引用材料原句**可能命中 ⇒ 报告仅供抽检，不作自动处置。
 * 用法：`detectAnswerEcho(stemText, answerText)` ⇒ `[片段, …]`（空数组＝无信号／样本不足）。
 * ============================================================
 */

/** 触发阈值：答案区与题干区**连续相同汉字**的最短长度（单源：本常量） */
export const ECHO_MIN_HANZI = 14;
/** 样本不足下限：两侧汉字数均须 ≥ 此值，否则不出结论 */
export const ECHO_MIN_SAMPLE = 200;

const hanziCount = (s) => (String(s).match(/[\u4e00-\u9fa5]/g) || []).length;

export const detectAnswerEcho = (stemText = '', answerText = '') => {
  const stem = String(stemText);
  const ans = String(answerText);
  if (!stem || !ans) return [];
  if (hanziCount(stem) < ECHO_MIN_SAMPLE || hanziCount(ans) < ECHO_MIN_SAMPLE) return [];

  // 题干侧：去空白后成一条长串（跨段照搬也算复述；空白差异不算差异）
  const stemNorm = stem.replace(/[\s\u3000]+/g, '');
  const hits = new Set();
  // 答案侧：按**非汉字**切段，只在汉字段内找复述（避免把标点/空格差异当差异）
  for (const seg of ans.split(/[^\u4e00-\u9fa5]+/)) {
    if (seg.length < ECHO_MIN_HANZI) continue;
    let i = 0;
    while (i + ECHO_MIN_HANZI <= seg.length) {
      const frag = seg.slice(i, i + ECHO_MIN_HANZI);
      if (!stemNorm.includes(frag)) { i += 1; continue; }
      // 命中后延伸到**最长**匹配，报告更完整的复述片段
      let len = ECHO_MIN_HANZI;
      while (i + len + 1 <= seg.length && stemNorm.includes(seg.slice(i, i + len + 1))) len += 1;
      hits.add(seg.slice(i, i + len));
      i += len;
    }
    if (hits.size >= 5) break; // 报前 5 条即可（够定位；避免刷屏）
  }
  return [...hits].slice(0, 5);
};
