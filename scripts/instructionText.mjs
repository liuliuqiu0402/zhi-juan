/**
 * 面级"指令文本"装配（**单源**）
 * ============================================================
 * 为什么单独抽出来：这段装配原先只活在 `tests/config/l1AnchorGate.test.js` 里。锚表门要它、
 *   `antiHomogenizationGuard` 也要它 ⇒ 若各自抄一份，就是"同一事务两份实现"（本项目最忌）。
 *   故抽为 **单源**：两边 import 同一份，口径不可能漂移。
 *
 * 口径（与门逐字一致）：委托正文 → user 消息全文 → system 程序附加段 → 教辅结构注入（非 exam）
 *   → 调用层块 → 生成期风格追加块；**不含**快照头部（头部是样本说明、非指令源）。
 */
import {
  getPromptTemplate, buildInjectionInstruction, buildStructureText, GEN_TYPE_NAMES,
  STAGE_SUBJECTS,
} from '../src/config/promptLibrary.js';
import { DEFAULT_STYLE_BY_TYPE, buildStyleAppend, subjectGradeSystem } from '../src/config/expertKnowledge.js';
import { buildTeachingInjection } from '../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../src/utils/programAttach.js';
import { materialChannelOf } from '../src/config/coverageContract.js';
import { findBlueprint } from '../src/config/blueprintProvider.js';
import { GEN_TYPE_KEYS } from '../src/config/toolLibrary.js';

const BUCKET = { primary_low: '小学', primary_mid: '小学', primary_high: '小学', middle: '初中', high: '高中' };
const HINT = { primary_low: '一年级', primary_mid: '三年级', primary_high: '五年级', middle: '七年级', high: '高一' };

/** 54 个"学科×学段"开设对 */
export const PAIRS = Object.entries(STAGE_SUBJECTS)
  .flatMap(([stage, subs]) => subs.map((subject) => ({ stage, subject })));

/** 486 面（54 开设对 × 9 类型） */
export const FACES = PAIRS.flatMap(({ stage, subject }) =>
  GEN_TYPE_KEYS.map((genType) => ({ stage, subject, genType, key: `${subject}|${stage}|${genType}` })));

export function buildInstructionText(genType, subject, stage, opts = {}) {
  // opts（**仅供抽样核证**用，默认全走基准配置 ⇒ 门/守卫的调用逐字不变）：
  //   style          覆盖组织风格档（默认＝DEFAULT_STYLE_BY_TYPE[genType]）
  //   materialChannel 覆盖素材通道（默认＝materialChannelOf(genType)）
  //   noStyle        强制不注入组织风格（用于核"不注入分支"）
  //   scopeType      命题范围/卷别档（exam 升学卷别：xiaoshengchu|zhongkao|gaokao；教辅范围维度不驱动指令装配）
  //   paperKind      高中卷别口径（'合格考'|'高考'；空＝由 scopeType 解析）
  //   region         省市（仅 exam 蓝本覆盖，空＝不覆盖）
  //   unit           命题范围名（替换模板 {unit}/{scope} 占位符；空＝模板落"本单元"兜底）
  // 上述各项默认 '' ⇒ 与"无此参"逐字等价（门/守卫的调用不变）。
  const b = BUCKET[stage];
  const grades = subjectGradeSystem[b]?.[subject]?.grades || [];
  const hint = HINT[stage] || '';
  const grade = grades.includes(hint) ? hint : (grades[0] || hint);
  const tpl = getPromptTemplate({ grade: stage, subject, genType });
  let structure = ''; let fullScore = ''; let duration = '';
  const bp = findBlueprint({ genType, subject, stage, region: opts.region || '', scopeType: opts.scopeType || '' });
  if (bp) { structure = buildStructureText(bp); fullScore = bp.fullScore || ''; duration = bp.duration || ''; }
  const materialChannel = opts.materialChannel || materialChannelOf(genType) || 'full';
  const instructionText = buildInjectionInstruction({
    template: tpl.template, grade, stage, subject,
    genTypeLabel: GEN_TYPE_NAMES[genType] || genType, label: '', structure, fullScore, duration, genType, materialChannel,
    scopeType: opts.scopeType || '', paperKind: opts.paperKind || '', unit: opts.unit || '',
  });
  const parts = [
    buildUserMessagePrompt({ genType, subject, materialChannel, anchorListText: '一、主题\n· 知识点。', instructionText }),
    buildProgramAttach({ subject, stageKey: stage, genType, instructionText }),
  ];
  if (genType !== 'exam') parts.push(buildTeachingInjection({ genType, stage, subject }) || '');
  parts.push(buildCallLayerBlocks().map((x) => x.text).join('\n'));
  const sv = opts.noStyle ? '' : (opts.style !== undefined ? opts.style : (DEFAULT_STYLE_BY_TYPE[genType] || ''));
  if (sv) parts.push(buildStyleAppend(sv));
  return parts.filter(Boolean).join('\n');
}

/** 面 → 指令文本（497? 不，486 面；供门与各守卫共用） */
export const faceTexts = () =>
  FACES.map((f) => ({ ...f, text: buildInstructionText(f.genType, f.subject, f.stage) }));
