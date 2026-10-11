// 🧱 共享：资料类型的"实发装配"（**全部真实 cell**）——覆盖测量／面矩阵／情形矩阵共用，防三处各写一套
// ============================================================
// 口径（2026-10-11 S1 定）：**486 真实 cell**（54 个实际开设的"学科×学段"对 × 9 类型）；
//   素材/锚点置空＝豁免输入；**含"生成期追加"通道**（组织风格／复生成差异化／多类型差异化）。
// 使用者：`tests/config/promptSourceRegistry.test.js`（每句有主）、`faceCoverageMatrix.test.js`（面×类型）、
//   `faceScenarioMatrix.test.js`（面×情形面）。
import {
  getPromptTemplate, STAGE_SUBJECTS, ANSWER_ROLES, buildAnswerFormatSpec,
} from '../../src/config/promptLibrary.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import {
  buildUserMessagePrompt, buildCallLayerBlocks, buildDiffRegenBlock, buildMultiTypeDiffBlock,
} from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { styleOptions, buildStyleAppend } from '../../src/config/expertKnowledge.js';

/** 该类型适用的组织风格（渲染唯一事实源 `buildStyleAppend` 非空者） */
export const stylesForType = (genType) => styleOptions
  .filter((o) => !o.appliesTo.length || o.appliesTo.includes(genType))
  .map((o) => o.value).filter((v) => buildStyleAppend(v));

const _cache = {};
/** 某类型**全部真实 cell** 的实发文本（54 份；含生成期追加） */
export function textsOfType(genType) {
  if (_cache[genType]) return _cache[genType];
  const out = [];
  for (const [stage, subs] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subs) {
      const t = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
      out.push([
        t,
        buildTeachingInjection({ genType, stage, subject }) || '',
        buildProgramAttach({ subject, stageKey: stage, genType, instructionText: t }) || '',
        buildUserMessagePrompt({ genType, subject, materialChannel: 'anchor', anchorListText: '@@A@@', instructionText: t }) || '',
        buildCallLayerBlocks().map((b) => b.text).join('\n'),
        genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType),
        buildAnswerFormatSpec(subject),
        stylesForType(genType).map((s) => buildStyleAppend(s)).join('\n'),
        buildDiffRegenBlock({ genType, diffKps: ['（已练知识点）'] }),
        buildMultiTypeDiffBlock({ typeName: '（类型名）', prevTypes: '（前序类型）', coveredKps: ['（已覆盖知识点）'] }),
      ].join('\n'));
    }
  }
  _cache[genType] = out;
  return out;
}

export const ALL_TYPES = GEN_TYPE_KEYS;
export const CONTENT_TYPES = ['preview', 'summary'];
export const NOT_CONTENT_TYPES = GEN_TYPE_KEYS.filter((t) => !CONTENT_TYPES.includes(t));

/** 该类型的实发文本中是否有任一判据源命中（src＝正则数组） */
export const hitAny = (genType, src) => textsOfType(genType).some((txt) => src.some((re) => re.test(txt)));
