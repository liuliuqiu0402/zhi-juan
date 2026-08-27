/**
 * 组织风格解析（纯函数，可独立单测）
 * ============================================================
 * 注入格式（GenerateModule）：「【组织风格】{value}：{说明}」
 *   value 为风格值（unified_context / scenario_each / mindmap …），冒号在 value 之后
 * 兼容旧格式：「命题风格：{说明}」（无 value 前缀 → 无法命中任何风格值）
 * 兼容无【】包裹格式：「组织风格：{说明}」
 * 返回：
 *   value          风格值（空串=未命中）
 *   text           风格行原文
 *   isUnifiedContext  统一情境（整卷一个核心情境）
 *   isContextFusion   逐题/模块情境（scenario_each 或旧值 context_fusion）
 *   isContextStyle    以上任一（需要情境框架预生成）
 * ============================================================
 */

export function parseStyleFromInstruction(instruction = '') {
  // 注：冒号在风格值之后（【组织风格】unified_context：…），故【】后直接捕获整行
  const m = instruction.match(/(?:命题风格|组织风格)】?\s*([^\n]+)/);
  if (!m) return { value: '', text: '', isUnifiedContext: false, isContextFusion: false, isContextStyle: false };
  const line = m[1].trim();
  const value = line.split(/[：:]/)[0].trim();
  const isUnifiedContext = value === 'unified_context';
  const isContextFusion = value === 'context_fusion' || value === 'scenario_each';
  return { value, text: line, isUnifiedContext, isContextFusion, isContextStyle: isUnifiedContext || isContextFusion };
}

export default { parseStyleFromInstruction };
