/**
 * 程序性附加段组装（复位工程 · S3.2 委托书纯净化）
 * ============================================================
 * 依据：docs/design/三线生成架构-设计准绳.md「渲染契约语法、载体换算等程序性知识
 *   不属于委托正文（解释权在程序侧）」「委托书只应有'这个活儿是什么、做成什么样算好'」。
 *
 * 职责：把"形态/规格层"程序性知识（渲染契约 + 生成前质检规则 + 模板缺失时的输出格式兜底）
 *   从委托正文中分离、统一在此组装——委托正文只保留编辑者意志（角色/目的/结构/质量/点名）。
 *
 * 注入形态：本函数只负责拼文本；由生成端（useAiGenerator）以 system 角色随写作请求注入
 *   （首条 system 消息），不进委托正文、不占委托书可编辑区。
 * ============================================================
 */
import { buildRenderContract, needsImageHint } from '../config/eduRenderContract.js';
import { buildValidatorPrompt } from '../config/validatorRules.js';
import { buildOutputFormatHint } from '../config/promptLibrary.js';

/**
 * @param {object} p
 * @param {string} p.subject 规范化学科（normalizeSubjectName 产物）
 * @param {string} p.stageKey 学段键（primary_low/primary_mid/primary_high/middle/high）
 * @param {string} p.genType 资料类型键
 * @param {string} [p.needsImageText] 配图判定提示文本（结构/类型/范围名，交给 needsImageHint 判定是否含配图类题型）
 * @param {string} [p.instructionText] 委托正文当前文本（判定是否需要【输出格式】兜底——模板已含则不重复）
 * @returns {string} 程序性附加段拼接文本（可能为空串）
 */
export function buildProgramAttach({ subject, stageKey, genType, needsImageText = '', instructionText = '' }) {
  const parts = [];
  const needsImage = needsImageHint(String(needsImageText || ''), genType);
  const renderContractText = buildRenderContract({ subject, genType, stage: stageKey, needsImage });
  if (renderContractText) parts.push(renderContractText);
  const validatorPromptText = buildValidatorPrompt({ subject, stage: stageKey, genType });
  if (validatorPromptText) parts.push(validatorPromptText);
  // 委托正文（含用户自定义模板）缺失【输出格式】段时兜底补格式条款——同样属程序侧格式知识
  if (!String(instructionText || '').includes('【输出格式】')) {
    const outputHintText = buildOutputFormatHint({ subject, stage: stageKey, genType }) || '';
    if (outputHintText) parts.push(outputHintText);
  }
  return parts.filter(Boolean).join('\n\n');
}
