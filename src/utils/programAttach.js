/**
 * 程序性附加段组装（复位工程 · S3.2 委托书纯净化）
 * ============================================================
 * 依据：docs/design/三线生成架构-设计准绳.md「渲染契约语法、载体换算等程序性知识
 *   不属于委托正文（解释权在程序侧）」「委托书只应有'这个活儿是什么、做成什么样算好'」。
 *
 * 职责：把"形态/规格层"程序性知识（渲染契约 + 生成前质检规则 + 模板缺失时的守门条款段级兜底）
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
import { floorClauseSections } from '../config/promptLibrary.js';

/**
 * 单源计算：注入文本 + 分段明细（同一份程序性知识的两副面孔）
 * @param {object} p
 * @param {string} p.subject 规范化学科（normalizeSubjectName 产物）
 * @param {string} p.stageKey 学段键（primary_low/primary_mid/primary_high/middle/high）
 * @param {string} p.genType 资料类型键
 * @param {string} [p.needsImageText] 配图判定提示文本（结构/类型/范围名，交给 needsImageHint 判定是否含配图类题型）
 * @param {string} [p.instructionText] 委托正文当前文本（判定守门条款各段是否需要兜底——模板已含则该段不重复）
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
  // ✅ A20（2026-09-14 用户定「分开更好」）：守门条款**段级兜底**——按段判缺、缺哪段补哪段。
  //    原先只判【输出格式】在不在、缺则补整块（格式段 +【质量底线】整段），两个漏点：
  //      ① 委托正文有【输出格式】但删了【质量底线】→ 判据认为"已有格式"→ 兜底不触发 →
  //         质量底线在委托正文与程序附加段**两条通道都不出现**（守门条款静默丢失）；
  //      ② 委托正文缺【输出格式】→ 【质量底线】被整块重复注入（语义重复表达）。
  //    现遍历单源注册表 floorClauseSections：marker 不在委托正文 → 补该段；已在 → 跳过。
  //    段文本与 buildBuiltinTemplate 注入委托正文的文本逐字同源（注册表单源），不会两处漂移。
  const fallbackTexts = [];
  for (const sec of floorClauseSections({ subject, stage: stageKey, genType })) {
    if (String(instructionText || '').includes(sec.marker)) continue;
    fallbackTexts.push(sec.text);
    blocks.push({
      lib: 'instruction', key: attachInstructionKey || genType,
      name: `底线条款兜底（模板缺${sec.marker}段）`, text: sec.text,
    });
  }
  const outputHintText = fallbackTexts.join('\n\n');
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
