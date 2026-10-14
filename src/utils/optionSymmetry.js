/**
 * 选项对称指纹检测（**纯函数·无 DOM·只报不改**）——AI 味"选项设置太对称"
 * ============================================================
 * 为什么单独成模块：判据要**可单测**、且 `examValidator` 有 DOM 依赖（不便直测）⇒ 判据落本模块（单一事实源）。
 * 判据（守"促规范、不过度约束、只做能自证的断言"）：
 *   · 只认 **A,B,C[,D] 连续有序**的选项跑（同题内的选项组才连号 ⇒ 天然按题聚焦，不跨题混算；断链即不自证 ⇒ 不报）；
 *   · 每个选项须为**文本型**（各含 ≥`minHanzi` 个汉字）⇒ 数学"3、5、7、9"、英语"am/is/are"**不参与**；
 *   · **字数完全相同**才报（选项长短参差才是真人常态；"均衡防暗示"属另一回事，本条只报**极端整齐**信号）。
 * 实现要点：先定位**选项标记**（`A.`／`B、`…，**不要求前有空白**——行内选项常紧邻前项），
 *   再取**相邻标记之间**的文本为该项内容（按空白/句读截断）——避免"内容吞掉下一个标记"的贪心错配。
 * 用法：`detectOptionSymmetry(html)` ⇒ `[{ group, labels, hanzi }]`（空数组＝无信号／不可自证）。
 * ============================================================
 */
import { AI_OPTION_SYM } from '../config/validatorRules.js';

/** 去标签取纯文本（本地实现：本模块不引 DOM 依赖） */
const strip = (html = '') => String(html)
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&emsp;|&ensp;/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export const detectOptionSymmetry = (html = '') => {
  const res = [];
  if (!html) return res;
  const text = strip(html);
  const marks = [...text.matchAll(/([A-D])\s*[.．、]\s*/g)];
  if (marks.length < AI_OPTION_SYM.minOptions) return res;

  // 每项内容＝本标记之后、**下一个标记之前**的文本（按空白/句读/括号截断，上限 30 字）
  const items = marks.map((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : Math.min(text.length, start + 40);
    const body = (text.slice(start, end).split(/[\s。；，、（(]/)[0] || '').slice(0, 30);
    return { label: m[1], body };
  });

  const order = 'ABCD';
  let run = [];
  const flush = () => {
    if (run.length >= AI_OPTION_SYM.minOptions) {
      const counts = run.map((h) => (h.body.match(/[\u4e00-\u9fa5]/g) || []).length);
      const allTextual = counts.every((c) => c >= AI_OPTION_SYM.minHanzi);
      const allEqual = counts.every((c) => c === counts[0]);
      if (allTextual && allEqual) res.push({ group: res.length + 1, labels: run.map((h) => h.label), hanzi: counts[0] });
    }
    run = [];
  };
  for (const h of items) {
    if (h.label === order[run.length]) run.push(h);
    else { flush(); run = h.label === 'A' ? [h] : []; } // 断链：只从 A 重新起跑（不连续 ⇒ 不自证 ⇒ 不报）
  }
  flush();
  return res;
};
