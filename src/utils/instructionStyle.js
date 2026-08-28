/**
 * 组织风格解析（纯函数，可独立单测）
 * ============================================================
 * 注入格式（GenerateModule withStyle）：「【组织风格】{value}：{说明}」
 *   value 为风格值（unified_context / unit_context / scenario_each / mindmap …），冒号在 value 之后
 * 兼容旧格式（无【】）：「组织风格：{说明}」「命题风格：{说明}」——要求带冒号
 * 🔴 匹配必须锚定注入标记：指令库模板正文含"按所选组织风格展开情境"字样（无冒号、无【】），
 *    旧正则不锚定导致模板正文抢先命中 → 风格值解析恒为空 → 情境框架永不生成（2026-08 修复）
 * 返回：
 *   value          风格值（空串=未命中）
 *   text           风格行原文
 *   isUnifiedContext  统一情境类（unified_context / unit_context / context_chain：整卷/整单元一个核心情境）
 *   isContextFusion   逐题/模块情境（scenario_each 或旧值 context_fusion）
 *   isContextStyle    以上任一（需要情境框架预生成）
 * ============================================================
 */

export function parseStyleFromInstruction(instruction = '') {
  // 主格式（【】锚定）：【组织风格】unified_context：…——withStyle 注入格式，只认【】包裹，防正文干扰
  let m = instruction.match(/【\s*(?:命题风格|组织风格)\s*】\s*([^\n]+)/);
  // 兼容旧格式（无【】）："组织风格：说明"——要求冒号，正文"按所选组织风格展开"（无冒号）不误命中
  if (!m) m = instruction.match(/(?:命题风格|组织风格)\s*[：:]\s*([^\n]+)/);
  if (!m) return { value: '', text: '', isUnifiedContext: false, isContextFusion: false, isContextStyle: false };
  const line = m[1].trim();
  const value = line.split(/[：:]/)[0].trim();
  // 统一情境类：整卷/整单元围绕一个核心情境（unified_context 课标卷型、unit_context 单元情境卷、context_chain 情境化串联）
  const isUnifiedContext = value === 'unified_context' || value === 'unit_context' || value === 'context_chain';
  const isContextFusion = value === 'context_fusion' || value === 'scenario_each';
  return { value, text: line, isUnifiedContext, isContextFusion, isContextStyle: isUnifiedContext || isContextFusion };
}

export default { parseStyleFromInstruction };
