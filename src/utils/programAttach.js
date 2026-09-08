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
 *
 * 同源双出口（2026-09 补，恢复"看到问题→点击跳转修改"闭环）：
 *   - buildProgramAttach()            → 注入文本（送模型，system 角色）
 *   - buildProgramAttachBlocks()      → 同一份内容的分段明细（送 UI：库×条目×文本，逐段点击跳对应库）
 *   两出口共用 buildProgramAttachParts() 单源计算，杜绝"面板展示 ≠ 实际注入"二次口径。
 * ============================================================
 */
import { buildRenderContract, needsImageHint } from '../config/eduRenderContract.js';
import { buildValidatorPrompt, getActiveFixPromptRules } from '../config/validatorRules.js';
import { buildOutputFormatHint } from '../config/promptLibrary.js';

/**
 * 单源计算：注入文本 + 分段明细（同一份程序性知识的两副面孔）
 * @param {object} p
 * @param {string} p.subject 规范化学科（normalizeSubjectName 产物）
 * @param {string} p.stageKey 学段键（primary_low/primary_mid/primary_high/middle/high）
 * @param {string} p.genType 资料类型键
 * @param {string} [p.needsImageText] 配图判定提示文本（结构/类型/范围名，交给 needsImageHint 判定是否含配图类题型）
 * @param {string} [p.instructionText] 委托正文当前文本（判定是否需要【输出格式】兜底——模板已含则不重复）
 * @param {string} [p.attachInstructionKey] 指令库条目键（兜底段跳转定位用；缺省回落 genType）
 * @returns {{ text:string, blocks:Array<{lib,key,name,text}> }}
 */
function buildProgramAttachParts({ subject, stageKey, genType, needsImageText = '', instructionText = '', attachInstructionKey = '' }) {
  const blocks = [];
  const needsImage = needsImageHint(String(needsImageText || ''), genType);
  const renderContractText = buildRenderContract({ subject, genType, stage: stageKey, needsImage });
  if (renderContractText) blocks.push({ lib: 'render-contract', key: subject, name: '渲染指令契约', text: renderContractText });
  const activeRules = getActiveFixPromptRules({ subject, stage: stageKey, genType });
  for (const r of activeRules) blocks.push({ lib: 'rules', key: r.id, name: r.name || r.id, text: r.promptHint });
  const validatorPromptText = buildValidatorPrompt({ subject, stage: stageKey, genType });
  // 委托正文（含用户自定义模板）缺失【输出格式】段时兜底补格式条款——同样属程序侧格式知识
  let outputHintText = '';
  if (!String(instructionText || '').includes('【输出格式】')) {
    outputHintText = buildOutputFormatHint({ subject, stage: stageKey, genType }) || '';
    if (outputHintText) blocks.push({
      lib: 'instruction', key: attachInstructionKey || genType,
      name: '输出格式兜底（模板缺【输出格式】段）', text: outputHintText,
    });
  }
  const text = [renderContractText, validatorPromptText, outputHintText].filter(Boolean).join('\n\n');
  return { text, blocks };
}

/**
 * @param {object} p 见 buildProgramAttachParts
 * @returns {string} 程序性附加段拼接文本（可能为空串）
 */
export function buildProgramAttach(p = {}) {
  return buildProgramAttachParts(p).text;
}

/**
 * @param {object} p 见 buildProgramAttachParts
 * @returns {Array<{lib:string,key:string,name:string,text:string}>} 分段明细（UI 展示 + 点击跳库定位）
 */
export function buildProgramAttachBlocks(p = {}) {
  return buildProgramAttachParts(p).blocks;
}
