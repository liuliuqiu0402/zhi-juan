/**
 * 答案区"复述题干"检测（**纯函数·无 DOM·只报不改**）——AI 味"解析把题干原样搬一遍"
 * ============================================================
 * 为什么单独成模块：判据要**可单测**、`examValidator` 有 DOM 依赖（不便直测）⇒ 判据落本模块（单一事实源）。
 * 判据（守"促规范、不过度约束、只做能自证的断言"）：
 *   · 取**答案区**中**连续 ≥`ECHO_MIN_HANZI`(14) 个汉字**、且**原样出现在题干区**的片段 ⇒ 报（附最长匹配片段）；
 *   · 阈值取 14 汉字：术语/固定表述（"匀速直线运动"）只有 4–6 字，**不会命中**；14 字连续照搬才是"复述"信号；
 *   · **只报不改**：是不是"必要的引述"（如阅读材料引文）需人判 ⇒ notice 级进生成报告【问题列表】；
 *   · 两侧文本任一过短（<200 汉字）则**不出结论**（样本不足 ⇒ 不自证）。
 * 🔴 2026-10-18（属主真机误报"选择正确答案的序号填在括号里…"）：**作答说明套语豁免**——
 *   作答说明（"怎么答"）天然在题干与解析两侧逐字相同（如"选择正确答案的序号填在括号里"恰 14 字），
 *   它不是"复述题干内容"而是卷面套语 ⇒ 命中片段若**整段由套语构成**（套语逐一剔除后不剩汉字）则豁免。
 *   判据＝`isInstructionCliché`（**单源**：`ANSWER_INSTRUCTION_CLICHES`）；豁免**只针对整段套语**，
 *   套语夹带实质内容（"…并说明理由"）仍照报 ⇒ 不放过真复述。
 * 已知误报边界（**如实登记**）：阅读训练类解析**引用材料原句**可能命中 ⇒ 报告仅供抽检，不作自动处置。
 * 用法：`detectAnswerEcho(stemText, answerText)` ⇒ `[片段, …]`（空数组＝无信号／样本不足）。
 * ============================================================
 */

/** 触发阈值：答案区与题干区**连续相同汉字**的最短长度（单源：本常量） */
export const ECHO_MIN_HANZI = 14;
/** 样本不足下限：两侧汉字数均须 ≥ 此值，否则不出结论 */
export const ECHO_MIN_SAMPLE = 200;

/** 作答说明套语（"怎么答"的卷面指令·非题干内容）——命中片段**整段由套语构成**即豁免。
 *  单源：本常量（新增写法只在此处加，勿在他处另写一份）；顺序无关（判定时按长度降序消费，防短条先吃掉长条）。 */
export const ANSWER_INSTRUCTION_CLICHES = [
  '选择正确答案的序号填在括号里',
  '选择正确答案的序号填在括号内',
  '选出正确答案的序号填在括号里',
  '把正确答案的序号填在括号里',
  '把正确答案的序号填在括号内',
  '将正确答案的序号填在括号里',
  '将正确答案的序号填在括号内',
  '选择正确的答案填在括号里',
  '把正确的答案填在括号里',
  '在括号里填上正确答案的序号',
  '在括号里填上合适的答案',
  '正确答案的序号填在括号里',
  '答案的序号填在括号里',
  '选择正确答案的序号',
  '把正确答案的序号',
  '正确的答案的序号',
  '序号填在括号里',
  '填在括号里', '填在括号内', '写在括号里', '写在括号内',
  '填在横线上', '写在横线上', '填在横线', '写在横线',
  '填在空白处', '写在空白处', '填在空白',
  '把答案写在', '把答案填在', '把序号填在',
  '用直线连起来', '用线连起来', '连一连', '连起来',
  '判断对错', '判断正误', '对的画', '错的画',
  '直接写出得数', '写出得数',
  '按要求作答', '按要求完成', '按要求填空', '按要求填写', '按要求画', '按要求写',
  '根据课文内容填空', '根据短文内容', '读一读', '填一填', '选一选', '写一写',
  '连一连', '画一画', '算一算', '想一想', '比一比', '数一数',
  '下列各题', '下面各题', '各小题', '每小题', '依次填', '分别填',
  '参考答案', '答案', '解析', '解答', '略',
];

const hanziCount = (s) => (String(s).match(/[\u4e00-\u9fa5]/g) || []).length;

// 长度降序消费：先吃掉长套语，防短条把长条切碎后残留假"内容"（顺序无关性由排序保证）
const CLICHES_DESC = [...ANSWER_INSTRUCTION_CLICHES].sort((a, b) => b.length - a.length);

/** 片段是否**整段**由作答说明套语构成（剔除全部套语后不剩汉字 ⇒ 是"怎么答"而非"题干内容"） */
export const isInstructionCliché = (frag = '') => {
  let rest = String(frag);
  for (const c of CLICHES_DESC) rest = rest.split(c).join('');
  return hanziCount(rest) === 0;
};

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
      const matched = seg.slice(i, i + len);
      // 2026-10-18：**整段套语豁免**（"怎么答"的作答说明不是"复述题干内容"；夹带实质内容者仍报）
      if (!isInstructionCliché(matched)) hits.add(matched);
      i += len;
    }
    if (hits.size >= 5) break; // 报前 5 条即可（够定位；避免刷屏）
  }
  return [...hits].slice(0, 5);
};
