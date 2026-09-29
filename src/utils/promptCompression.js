/**
 * 输入超长时的「关键块优先」压缩（从 `useAiGenerator.callAI` 抽出为**纯函数**）
 * ============================================================
 * 🔴 2026-09-30（用户裁定 · 第二步「纯搬移重构」）：原文内联在 callAI 里，无法离线验证；抽为纯函数后
 *    **行为逐字节不变**（同一输入 → 同一 text），但可离线构造超长输入做断言，不依赖真机。
 *    唯一新增的是**观测**（notes）：把"顺序被反转、哪些段被整体丢弃"如实产出，供生成报告如实交代。
 *
 * ⚠️ 已核实的既有行为（本函数按原样保留，不在本轮改；改动留待裁定后的第三步）：
 *   · 分类里「素材段」只认 `【教材原文`/`【模板参考`/`【教材参考` 三种开头 —— **写作路径的素材块
 *     是【锚点清单】/【压缩原文】**，匹配不上 → 写作路径下本分支**不压缩任何素材**，
 *     实际只做两件事：把命中保留关键词的块（含尾约束×2）**整体前置**；后置段落超预算时**整体丢弃**。
 *   · 因此触发后尾约束不再位于末尾（末尾锚定失效），素材与指令的相对顺序也反转。
 *   · 与 programAttach 的段级兜底口径冲突：兜底判据是"该段在不在委托正文里"，而本函数在调用层、
 *     晚于该判定 → 被本函数丢掉的段**不会被兜底补回**。
 * 消费方：`useAiGenerator.callAI`（触发判定仍留在原处，保持"按自身长度判定"的既有语义）。
 */

/** 保留关键词（命中即视为"必须保留"的关键块）——与原实现逐字一致 */
const GUARANTEE_RE = /角色身份|顶层约束|尾约束|答案区|强制要求|真题卷结构蓝本|骨架|真题蓝本|答案与解析/;
/** 素材段判据（仅这三种开头；写作路径的素材块不属于此列，见文件头说明） */
const MATERIAL_HEAD_RE = /^【教材原文|^【模板参考|^【教材参考/;
/** 短段兜底保留（原实现的 `s.length < 200 && …` 分支） */
const SHORT_GUARANTEE_RE = /你是一位|请一次性生成|必须/;
/** 被省略时附加给模型的显式说明（逐字保留） */
const OMIT_NOTICE = '\n\n【系统提示：以下若干参考段落因输入长度受限已被压缩或省略，生成时优先遵循前文关键指令块；如需完整参考请分段生成或增加上下文窗口】\n';

/** 段落名（取块头【…】；取不到则截前 12 字）——仅用于告警可读性，不参与文本组装 */
const headName = (s) => {
  const m = /^【([^】]{1,24})】/.exec(String(s || ''));
  return m ? m[1] : String(s || '').slice(0, 12);
};

/**
 * @param {string} finalPrompt 待压缩的完整提示词（已含调用层追加块）
 * @param {{maxInputTokens:number, estimateTokens:(t:string)=>number}} opts
 * @returns {{text:string, notes:string[], stats:{instructionTokens:number, usedTokens:number, guarantee:number, instruction:number, material:number, dropped:string[], truncated:boolean}}}
 */
export const compressOverlongPrompt = (finalPrompt = '', opts = {}) => {
  const { maxInputTokens = 0, estimateTokens = (t) => Math.ceil(String(t || '').length / 1.5) } = opts;
  const notes = [];

  // 分段：按 【 开头分段（保留块级边界）——原样
  const sections = String(finalPrompt).split(/\n(?=【)/);
  const instructionParts = [];
  const materialParts = [];
  const guaranteeParts = [];
  for (const section of sections) {
    const s = section.trim();
    if (MATERIAL_HEAD_RE.test(s)) {
      materialParts.push(s);
    } else if (GUARANTEE_RE.test(s) || (s.length < 200 && SHORT_GUARANTEE_RE.test(s))) {
      guaranteeParts.push(s);
    } else {
      instructionParts.push(s);
    }
  }

  // 优先保留 guaranteeParts 与 instructionParts；只压缩 materialParts——原样
  let instructionText = [...guaranteeParts, ...instructionParts].join('\n');
  let instructionTokens = estimateTokens(instructionText);

  // 指令本身超预算 → 只留 guarantee（原实现把这一步简化为"截断其他指令"）
  let truncated = false;
  let hardTruncated = false;
  if (instructionTokens > maxInputTokens - 500) {
    truncated = true;
    instructionText = guaranteeParts.join('\n');
    instructionTokens = estimateTokens(instructionText);
    if (instructionTokens > maxInputTokens - 200) {
      instructionText = instructionText.substring(0, Math.floor((maxInputTokens - 200) * 1.5));
      hardTruncated = true;
    }
  }

  const remainingBudget = maxInputTokens - instructionTokens - 200; // 留 200 tokens 缓冲
  let materialText = '';
  let usedTokens = 0;
  const omittedSections = [];
  if (remainingBudget > 300) {
    for (const part of materialParts) {
      const sentences = part.split(/(?<=[。！？\n])/);
      let compressedPart = '';
      for (const sent of sentences) {
        const sentTokens = estimateTokens(sent);
        if (usedTokens + sentTokens > remainingBudget) break;
        compressedPart += sent;
        usedTokens += sentTokens;
      }
      if (compressedPart) {
        materialText += compressedPart + '\n';
      } else {
        omittedSections.push(part.slice(0, 120));
      }
    }
  } else {
    for (const part of materialParts) omittedSections.push(part.slice(0, 120));
  }

  let text = instructionText + '\n' + materialText;
  if (omittedSections.length > 0) text += OMIT_NOTICE;

  // ── 观测（不改 text）：如实交代顺序与丢弃，供生成报告【问题列表】 ──
  const guaranteeNames = guaranteeParts.map(headName);
  const droppedNames = truncated ? instructionParts.map(headName) : [];
  notes.push(`⚠️ 输入超长触发「关键块优先」压缩：${guaranteeParts.length} 个关键块被**整体前置**，${instructionParts.length} 个段落后置${truncated ? '（**已全部丢弃**）' : ''}`);
  // ⚠️ "尾约束不在末尾"只在**其后面还有内容**时成立（后置段落或素材）；若非关键段落全被丢弃且无素材保留，
  //    text 只剩关键块、尾约束恰好仍在末尾——那种情形的真问题不是尾锚而是"条款已大面积丢失"。
  if (instructionParts.length > 0) {
    notes.push('⚠️ 尾约束被排到中段（其后仍有后置段落）→ **末尾锚定在本分支失效**');
  }
  if (materialText) {
    notes.push('⚠️ 素材段被排到最末（原设计为"素材在前、指令在后"）→ 素材与指令的相对顺序反转');
  }
  if (truncated) {
    notes.push(`⚠️ 非关键段落被整体丢弃（${droppedNames.length} 段）：${droppedNames.join('、') || '（无）'}${hardTruncated ? '；且关键块本身超预算、已被硬截断' : ''}`);
  }
  if (guaranteeNames.length) notes.push(`ℹ️ 压缩后仍保留的关键块：${guaranteeNames.join('、')}`);
  if (materialParts.length === 0) {
    notes.push('ℹ️ 本次无「教材原文/模板参考」类素材段 → 压缩分支**未做任何素材压缩**（写作路径的素材块【锚点清单】/【压缩原文】不属该分类）；该分支在写作路径下只做重排与（必要时）丢段');
  } else if (omittedSections.length) {
    notes.push(`ℹ️ 参考段落被压缩或省略：${omittedSections.length} 段`);
  }

  return {
    text,
    notes,
    stats: {
      instructionTokens,
      usedTokens,
      guarantee: guaranteeParts.length,
      instruction: instructionParts.length,
      material: materialParts.length,
      dropped: droppedNames,
      truncated,
    },
  };
};

export default { compressOverlongPrompt };
