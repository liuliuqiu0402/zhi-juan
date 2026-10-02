/**
 * 输入超长的**体检与告警**（原 `promptCompression`，从 `useAiGenerator.callAI` 抽出）
 * ============================================================
 * 2026-09-30（用户裁定 · 第三步）：本模块原先会**改动文本**——把"命中保留关键词的块"整体前置、
 *    其余段落超预算时整体丢弃。经复核，那个改动**无法安全划界、且对写作/答案类调用零收益**：
 *      ① 它认的素材段是"段头为【教材原文/【模板参考/【教材参考"的整段，而**素材段常把其后的指令
 *         一并吞进来**——分析任务 prompt 的形状就是 `你是一位…：\n\n【教材原文】\n<原文>\n\n请完成
 *         以下分析任务：…\n必须返回以下 JSON 格式…`（任务与原文同处一段）→ 逐句压缩会**连指令/JSON
 *         格式一起吃掉**，属于误伤指令；
 *      ② 写作/答案类调用的素材块是【锚点清单】/【压缩原文】/【正文】，**不属于**它认的分类 →
 *         进来只有"重排 + 丢段"两种效果，最坏会丢掉答案页的【正文】；
 *      ③ 素材体量其实**已有上游护栏**：`textbookCompression` 的"材料分档"（`shouldDirectInject`
 *         阈值 = min(上下文窗×3%, 输出单次帽×25%)）+ Map→Reduce 折叠（`DEFAULT_FOLD_LIMIT_CHARS: 24000`
 *         字符 ≈ 1.6 万 tokens）已把进 prompt 的素材**限定在有界范围内**（实测最坏提示词 ≈3.8 万 tokens）。
 *    故本模块**一律不改动文本**，只把"超长事实 + 可诊断信息"如实产出（notes → 生成报告【问题列表】）；
 *    若长度确实超出模型上下文，交由 API **显式报错**——与项目既有裁定同源：
 *    "绝不把半截正文当作成功交付……宁可失败给行动建议"。
 * 为什么保留体检：① 触发时人能看到（不再静默）；② 在报告里留下"哪类调用、多少 tokens、有没有素材段"
 *    的证据，将来要重启压缩能力时，先有数据可依。
 * 消费方：`useAiGenerator.callAI`（触发判定留在原处，保持"按 prompt 自身长度判定"的既有语义）。
 */

/** 素材段判据（仅这三种段头；写作路径的素材块【锚点清单】/【压缩原文】不属此列） */
const MATERIAL_HEAD_RE = /^【教材原文|^【模板参考|^【教材参考/;

/**
 * @param {string} finalPrompt 待体检提示词（已含调用层追加块）
 * @param {{maxInputTokens:number, estimateTokens:(t:string)=>number}} opts
 * @returns {{text:string, notes:string[], stats:object}} text 恒等于入参（**本函数不改文本**）
 */
export const inspectOverlongPrompt = (finalPrompt = '', opts = {}) => {
  const { maxInputTokens = 0, estimateTokens = (t) => Math.ceil(String(t || '').length / 1.5) } = opts;
  const text = String(finalPrompt || '');
  const totalTokens = estimateTokens(text);
  const materialCount = text.split(/\n(?=【)/).filter((s) => MATERIAL_HEAD_RE.test(s.trim())).length;

  const notes = [`⚠️ 输入超出上限（${totalTokens} tokens > 上限 ${maxInputTokens}）：**本次不改动任何文本**，按原样发送`];
  if (materialCount) {
    notes.push(`ℹ️ 检出 ${materialCount} 个"教材原文/模板参考"类素材段，但**未压缩**——素材段可能与其后的指令同处一段（无法可靠划界），逐句压缩会误伤指令/输出格式要求`);
  } else {
    notes.push('ℹ️ 本次无可压缩素材（写作/答案类调用的素材块【锚点清单】/【压缩原文】/【正文】不属"教材原文"分类）');
  }
  notes.push('ℹ️ 若该长度确实超出模型上下文，将由 API 显式报错（宁可失败给行动建议，不给半截内容）；这类情况通常意味着勾选范围过大，建议减少勾选或改用锚清单通道');

  return {
    text,
    notes,
    stats: { totalTokens, limit: maxInputTokens, material: materialCount, changed: false },
  };
};

export default { inspectOverlongPrompt };
