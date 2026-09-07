/**
 * 研读编排驱动（复位工程·阶段 2 → 3 衔接）
 * ============================================================
 * 定位：把真实数据结构（contentCards/覆盖锚/绑定片段）适配到会话编排器与研读轮模块，
 *   产出"研读单位→分批→批消息→批摘要校验→研读总账"的确定性流程；不发起引擎调用。
 * 锚记录字段契约（与 coverageAnchor.flattenAnchorTree 输出对齐）：
 *   { chapterTitle, bigConcept, name, level, specificConcepts, bind:{status:'literal'|'semantic'|'chapter'|'missing', segments:[{text,type,isKeyConcept}]} }
 * 准绳：missing 锚不进研读（红线）；练习段不进入研读材料；批摘要校验=点名⊆清单/引用可溯源/理解非空。
 * ============================================================
 */
import { planStudyBatches } from './generationSession.js';
import { buildStudyBatchMessage, extractDigestRecords, validateDigestRecords, mergeLedger, ledgerToText } from './studyRound.js';

const NON_RETURNABLE_TYPES = ['练习', '作业', '习题', 'practice', 'exercise'];

/** 构造研读单位（调用方过滤：missing 锚已排除；练习段已滤）。 */
export function buildStudyUnits({ anchors = [], curriculumByName = null } = {}) {
  const units = [];
  for (const a of anchors || []) {
    if (!a || a.bind?.status === 'missing' || !a.name) continue; // 红线：缺料锚不进研读
    const segments = (a.bind?.segments || []).filter(
      (s) => s && s.text && String(s.text).trim() && !NON_RETURNABLE_TYPES.includes(String(s.type || '').trim()),
    );
    const concepts = Array.isArray(a.specificConcepts) ? a.specificConcepts.filter(Boolean) : [];
    const chars = String(a.name || '').length
      + String(a.level || '').length
      + concepts.join('；').length
      + segments.reduce((s, p) => s + p.text.length, 0);
    units.push({
      id: a.name,
      label: a.name,
      chars,
      name: a.name,
      level: a.level || '',
      concepts,
      curriculum: curriculumByName?.[a.name] || '',
      segments,
    });
  }
  return units;
}

/**
 * 编排一轮研读推进。
 * @param {object} p
 * @param {Array} p.units 研读单位（buildStudyUnits 产物）
 * @param {object} p.session 会话（generationSession 实例，stage=studying）
 * @param {number} [p.maxCharsPerBatch]
 * @param {object} p.digestFns 由调用方注入的"批摘要产出"（真实链路=追加研读批消息后调用引擎并取回模型笔记文本）
 * @returns {Promise<{ok:boolean, nextStage:string, ledger:Map, report:object}>}
 */
export async function runStudyRound({ units, session, maxCharsPerBatch = 2500, digestFns }) {
  const { batches, oversize } = planStudyBatches(units, maxCharsPerBatch);
  const ledger = new Map();
  const report = { batches: batches.length, oversize, unverifiable: [], empty: [], missing: [] };
  const corpusByBatch = [];
  for (const batch of batches) {
    const batchUnits = batch.unitIds.map((id) => units.find((u) => u.id === id)).filter(Boolean);
    const msg = buildStudyBatchMessage(batchUnits);
    session.messages.push({
      id: `study_batch_${session.messages.length + 1}`,
      role: 'user',
      kind: 'user',
      content: msg,
      compressible: true,
    });
    session.stage = 'studying';
    // 摘记由模型产出（digestFns.produce），程序只校验
    const digestText = await digestFns.produce(msg, batchUnits);
    const records = extractDigestRecords(digestText);
    const corpus = batchUnits.flatMap((u) => (u.segments || []).map((s) => s.text));
    const expected = batchUnits.map((u) => u.name);
    const v = validateDigestRecords(records, { expectedNames: expected, corpus });
    report.missing.push(...v.missing);
    report.empty.push(...v.empty);
    report.unverifiable.push(...v.unverifiable);
    if (!v.ok) {
      // 校验不通过 → 该批重读（编辑自校笔记有误，程序不代写）
      return { ok: false, nextStage: 'studying', ledger, report, failBatch: batch };
    }
    mergeLedger(ledger, records);
    corpusByBatch.push(corpus);
  }
  return { ok: true, nextStage: 'ready', ledger, report };
}

export { ledgerToText };
