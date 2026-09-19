/**
 * 守门条款段 · 实发前单源同步（指令草稿 × 程序内置条款）
 * ============================================================
 * 🔴 为什么需要（2026-09-18 用户实证"编号规则改了却没生效"）
 *    链路实测：
 *      ① 内置模板正文里**内嵌** `【输出格式】`/`【质量底线】` 段（promptLibrary 模板 `${OUTPUT_FORMAT_BLOCK(...)}`）；
 *      ② 生成指令草稿**持久化在 localStorage**（GenerateModule：watch(instructionDraft) → setItem），
 *         冷启动**直接恢复复用**，生成时 ensureInjectedInstruction 只用它（仅"素材段"做通道归一）；
 *      ③ 程序侧"缺段兜底"（programAttach × floorClauseSections）**按段头 marker 判在不在**——
 *         旧草稿里那一段"在" → 永不补。
 *    后果：**只要草稿是旧版本生成的，之后所有"委托正文侧"的条款修订都进不了模型**；
 *    而"程序侧"的修复（答案页组装、校验判据）照常生效——这正是"程序侧修的都好了、提示词侧修的全没动"的成因。
 *    与既有 `normalizeDraftMaterial` 同型（草稿可能来自旧版本 → 程序拥有的部分就地归一到当前单源）。
 * 🔴 只动"程序内置守门条款段"（格式/质量底线/数·量构造纪律/学科事实底线/数学命题底线）：
 *    这些段在面板里即标注为 builtin（无库可编辑、解释权在程序侧）；**用户自己的内容与其它的段一字不动**。
 *    段不存在时**不新增**——交由 programAttach 的段级兜底按原有路径追加（保持单一职责，不双写）。
 * 幂等：同步后再次调用无变化（返回 synced 为空）。
 * ============================================================
 */
import { floorClauseSections } from '../config/promptLibrary.js';

/** 段头判据：行首为 `【…】` 即新段开始（与面板分段标注同口径） */
const SECTION_HEAD_RE = /^【[^】]+】/;

/**
 * @param {string} text 委托正文草稿（生成指令框内容）
 * @param {{subject?:string, stage?:string, genType?:string}} ctx
 * @returns {{ text: string, synced: string[] }} text=同步后的文本；synced=本次被同步的段名（未变化则为空数组）
 */
export const syncFloorClauseSections = (text = '', { subject = '', stage = '', genType = '' } = {}) => {
  const src = String(text || '');
  if (!src.trim()) return { text: src, synced: [] };

  const sections = floorClauseSections({ subject, stage, genType }).filter((s) => s && s.marker && s.text);
  if (!sections.length) return { text: src, synced: [] };

  const lines = src.split('\n');
  // 切段：记录每个段的起止行（end 为开区间）
  const segs = [];
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_HEAD_RE.test(lines[i])) {
      if (segs.length) segs[segs.length - 1].end = i;
      segs.push({ head: lines[i], start: i, end: lines.length });
    }
  }
  if (!segs.length) return { text: src, synced: [] };

  const synced = [];
  // 自后向前替换，避免行号位移
  for (let k = segs.length - 1; k >= 0; k--) {
    const seg = segs[k];
    const hit = sections.find((s) => seg.head.startsWith(s.marker));
    if (!hit) continue;
    const current = lines.slice(seg.start, seg.end).join('\n').replace(/\s+$/, '');
    const target = String(hit.text).replace(/\s+$/, '');
    if (current === target) continue; // 已是最新 → 不动（幂等）
    lines.splice(seg.start, seg.end - seg.start, ...target.split('\n'));
    synced.unshift(hit.name || hit.marker);
  }
  return { text: lines.join('\n'), synced };
};
