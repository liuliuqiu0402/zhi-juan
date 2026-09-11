/**
 * 研读编排驱动（复位工程·阶段 2 → 3 衔接）
 * ============================================================
 * 定位：把真实数据结构（contentCards/覆盖锚/绑定片段）适配到会话编排器与研读轮模块，
 *   产出"研读单位→分批→批消息→批摘要校验→研读消化记录（覆盖点名+摘要，不含教材原文）"的确定性流程；不发起引擎调用。
 * 锚记录字段契约（与 coverageAnchor.flattenAnchorTree 输出对齐）：
 *   { chapterTitle, bigConcept, name, level, specificConcepts, bind:{status:'literal'|'semantic'|'chapter'|'missing', segments:[{text,type,isKeyConcept}]} }
 * 准绳：missing 锚不进研读（红线）；练习段不进入研读材料；批摘要校验=点名⊆清单/引用可溯源/理解非空。
 * ============================================================
 */
import { appendMessage, applyCompaction, planStudyBatches, isReturnableSegment } from './generationSession.js';
import { buildStudyBatchMessage, extractDigestRecords, validateDigestRecords, mergeLedger, ledgerToText } from './studyRound.js';

/** 每批回流重读上限（校验失败→带纠错提示重读该批；超出上限才中断研读）。 */
export const STUDY_REREAD_LIMIT = 2;

/** 构造研读单位（调用方过滤：missing 锚已排除；练习段已滤）。 */
export function buildStudyUnits({ anchors = [], curriculumByName = null } = {}) {
  const units = [];
  const noSegAnchors = [];
  for (const a of anchors || []) {
    if (!a || a.bind?.status === 'missing' || !a.name) continue; // 红线：缺料锚不进研读
    const segments = (a.bind?.segments || []).filter(
      (s) => s && s.text && String(s.text).trim() && isReturnableSegment(String(s.type || '').trim()),
    );
    // 🔴 源头预检（2026-09 回流超限根治）：绑定段经练习段过滤后为空 → 该锚无可研读素材，
    //    模型无论回流多少次都写不出可溯源引用/理解（回流空转的根因之一）——不进研读单位，
    //    归入缺料名单由调用方透出（与 missing 锚同语义：无可研读内容即缺料，不静默、不空转）
    if (!segments.length) {
      noSegAnchors.push(a.name);
      continue;
    }
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
  if (noSegAnchors.length) {
    console.warn(`[研读预检] ${noSegAnchors.length} 个锚绑定无可用原文片段（练习段过滤后为空），不进研读、按缺料处理：${noSegAnchors.join('、')}`);
    units.noSegAnchors = noSegAnchors; // 随返回值透出（供调用方并入缺料诊断）
  }
  return units;
}

/**
 * 由已通过的研读对派生引擎侧会话前缀（digest 请求与写作请求共用）。
 * 形态=一问一答交替（点名行 user 为程序供料=该批覆盖清单；摘要 assistant=模型研读笔记原话），
 * 满足引擎消息交替规范，且素材原文只出现在发起批的 digest 请求中（不随前缀累积）。
 * 🔧 有界化（2026-09 上界修复）：整本书/大范围批数多时，assistant 摘要本体线性累积会稀释委托书
 *    或挤占窗口——前缀两级结构：每批点名行（user，全量保留 = 覆盖点名总账，短）始终完整；
 *    摘要本体（assistant）仅保留最近 keepFull 批，更早批以短占位替代（覆盖点名不失；细节理解
 *    如需可按目录 browse 对应章补——素材唯一途径契约内）。默认 keepFull=Infinity 保持既有行为。
 * @param {Array<{names:string[], digestText:string}>} digestPairs
 * @param {number} [keepFull] 保留完整摘要的最近批数（Infinity=全部；写 6~12 启用上界）
 * @returns {Array<{role:string, content:string}>}
 */
export function buildStudyPrefix(digestPairs = [], keepFull = Infinity) {
  const pairs = Array.isArray(digestPairs) ? digestPairs : [];
  const msgs = [];
  if (pairs.length === 0) return msgs;
  const cap = Math.max(0, Math.floor(Number(keepFull) || Infinity));
  const fullFrom = Math.max(0, pairs.length - cap); // 从该下标起保留完整摘要
  const placeholder = '（该批研读细节已并入本前缀点名行；如需教材原文精确形态，可按范围目录 browse 对应章）';
  pairs.forEach((p, i) => {
    msgs.push({ role: 'user', content: `【研读批${i + 1}·覆盖点】${(p.names || []).join('、')}` });
    msgs.push({ role: 'assistant', content: (i >= fullFrom) ? p.digestText : placeholder });
  });
  return msgs;
}

/**
 * 计算前缀的 keepFull（摘要本体字符预算驱动，2026-09 上界修复）。
 * 点名行（user，覆盖点名总账）体积极小且永不截断；摘要本体（assistant）按预算从最近批往前保留，
 * 超出预算的早批以占位替代——保证任意批数下前缀内摘要总量 ≤ budgetChars，覆盖点名永不丢。
 * 批数 ≤ minKeepFull 时全量（单课/单元无感）；默认预算 9000 字符≈6k token 摘要。
 * @param {Array<{names:string[], digestText:string}>} digestPairs
 * @param {number} [budgetChars] 摘要本体字符预算（默认 9000）
 * @returns {number} keepFull（批数上限；≤0 恒为 Infinity 全量）
 */
function planPrefixKeepFull(digestPairs = [], budgetChars = 9000) {
  const pairs = Array.isArray(digestPairs) ? digestPairs : [];
  if (pairs.length <= 6) return Infinity; // 少量批：全量（无感）
  const budget = Math.max(2000, Number(budgetChars) || 9000);
  let used = 0;
  let keep = 0;
  // 从最近批向前累加摘要长度，直到预算用尽
  for (let i = pairs.length - 1; i >= 0; i -= 1) {
    const t = String(pairs[i]?.digestText || '');
    if (used + t.length > budget && keep >= 4) break; // 至少留最近 4 批完整
    used += t.length;
    keep += 1;
  }
  return Math.min(pairs.length, Math.max(4, keep));
}

/** 校验失败汇总为一行纠错提示（程序只提示问题清单，不代写笔记）。 */
function summarizeValidation(v) {
  const parts = [];
  if (v.missing?.length) parts.push(`点名缺漏：${v.missing.join('、')}`);
  if (v.extra?.length) parts.push(`越界点名：${v.extra.join('、')}`);
  if (v.empty?.length) parts.push(`理解为空：${v.empty.join('、')}`);
  if (v.unverifiable?.length) parts.push(`引用无源（须出自教材片段原文）：${v.unverifiable.map((x) => x.name).join('、')}`);
  return parts.join('；') || '格式不符（每点须起于【点名】）';
}

/**
 * 长锚按段切批展开（O2 批粒度自适应·确定性部分，2026-09）：
 * 锚级研读单位若总字符超批预算且含 ≥2 段 → 按段顺序切片为多个同名子单位
 * （每片子单位 ≤ 预算 0.85，点名同名；不切料——宁余勿缺）。
 * 边界：单个片段自身超预算 → 该段独立保留（oversize 单批语义不变，段内不切）；
 * 非长锚单位原样返回。切片后由批计划自然形成多批，批内/跨批同名点名由逐批校验
 * 天然兼容（每批 expectedNames 独立），总账同名记录由 mergeLedger 合并保留。
 * @param {Array} units buildStudyUnits 产物
 * @param {number} [maxCharsPerBatch]
 * @returns {Array} 展开后的研读单位（可能含同名多子、id 带序号；顺序稳定）
 */
export function expandLongStudyUnits(units = [], maxCharsPerBatch = 2500) {
  const out = [];
  const metaCharsOf = (u) => String(u.name || '').length
    + String(u.level || '').length
    + (Array.isArray(u.concepts) ? u.concepts.join('；').length : 0)
    + String(u.curriculum || '').length;
  for (const u of units) {
    if (!u || (Number(u.chars) || 0) <= maxCharsPerBatch || !Array.isArray(u.segments) || u.segments.length < 2) {
      out.push(u);
      continue;
    }
    const sliceCap = Math.floor(maxCharsPerBatch * 0.85);
    let curSegs = [];
    let curSegChars = 0;
    let subNo = 0;
    const flush = () => {
      if (!curSegs.length) return;
      subNo += 1;
      const segChars = curSegs.reduce((a, s) => a + String(s.text || '').length, 0);
      out.push({ ...u, id: `${u.id}@${subNo}`, chars: metaCharsOf(u) + segChars, segments: curSegs });
      curSegs = [];
      curSegChars = 0;
    };
    for (const s of u.segments) {
      const len = String(s.text || '').length;
      if (len > sliceCap) {
        flush(); // 段本身超预算：独立成批不切料
        subNo += 1;
        out.push({ ...u, id: `${u.id}@${subNo}`, chars: metaCharsOf(u) + len, segments: [s] });
        continue;
      }
      if (curSegChars + len > sliceCap) flush();
      curSegs.push(s);
      curSegChars += len;
    }
    flush();
  }
  return out;
}

/**
 * 编排一轮研读推进（会话式：批素材消息只出现在本批 digest 请求，通过后压缩替换；
 * 校验失败带纠错提示回流该批重读，不静默通过、不代写笔记）。
 * @param {object} p
 * @param {Array} p.units 研读单位（buildStudyUnits 产物）
 * @param {object} p.session 会话（generationSession 实例，stage=studying）
 * @param {number} [p.maxCharsPerBatch]
 * @param {number} [p.rereadLimit] 每批回流重读上限（默认 STUDY_REREAD_LIMIT）
 * @param {object} p.digestFns 由调用方注入的"批摘要产出"（真实链路=携带此前研读前缀调用引擎并取回模型笔记文本）
 * @param {Function} [p.onProgress] 逐批进度回调({batchIndex,total,rereads,batchNames})——供 UI 状态与排查日志
 * @returns {Promise<{ok:boolean, nextStage:string, ledger:Map, report:object, digestPairs:Array, failBatch?:object}>}
 */
export async function runStudyRound({ units, session, maxCharsPerBatch = 2500, digestFns, rereadLimit = STUDY_REREAD_LIMIT, onProgress = null }) {
  // O2 批粒度（确定性部分）：长锚（多段超预算）先按段展开为同名子单位，再由批计划分批——
  //    不再"整段单批超大"，切料只发生在"单段自身超预算"（宁余勿缺）
  const expanded = expandLongStudyUnits(units, maxCharsPerBatch);
  const { batches, oversize } = planStudyBatches(expanded, maxCharsPerBatch);
  const ledger = new Map();
  const report = { batches: batches.length, oversize, rereads: 0, missing: [], empty: [], unverifiable: [], digestError: '' };
  const digestPairs = []; // 已通过批的研读对（点名行+模型摘要原话）——写作与后续 digest 的引擎前缀来源
  for (let bi = 0; bi < batches.length; bi += 1) {
    const batch = batches[bi];
    const batchUnits = batch.unitIds.map((id) => expanded.find((u) => u.id === id)).filter(Boolean);
    const names = [...new Set(batchUnits.map((u) => u.name))]; // 同名子单位（长锚切批）去重，点名不重复
    const msg = buildStudyBatchMessage(batchUnits);
    // 素材批消息追加进会话（可压缩：digest 通过后即压缩替换，保证任意时刻历史内至多一条素材批原文）
    const materialMsg = appendMessage(session, { role: 'user', kind: 'user', content: msg, compressible: true });
    session.stage = 'studying';
    // 引擎侧前缀=此前已通过批的"点名行 + 摘要"（素材原文不随前缀累积）
    const prefix = buildStudyPrefix(digestPairs);
    let ok = false;
    let digestText = '';
    let lastValidation = null;
    for (let attempt = 0; attempt <= rereadLimit; attempt += 1) {
      const probeMsg = attempt > 0
        ? `${msg}\n\n【研读回流（程序只提示问题清单，不代写笔记）】上次笔记未通过核对：${summarizeValidation(lastValidation)}。请按行式契约重写该批笔记：每点一行、起于【点名】，后随一句话理解，可含「｜引用：…」；只准依据素材与课标，不要补写教材原文。`
        : msg;
      try {
        try {
          digestText = await digestFns.produce(probeMsg, batchUnits, prefix);
        } catch (e) {
          // 🔴 digest 引擎异常（超时/网络抖动/服务端瞬时错误）自动重试一次（同批同消息），
          //    仍失败才记录 digestError 中断（单次超时不直接阻断整次研读）
          console.warn(`[研读轮] digest 调用异常，自动重试一次: ${String((e && e.message) || e)}`);
          digestText = await digestFns.produce(probeMsg, batchUnits, prefix);
        }
      } catch (e2) {
        report.digestError = String((e2 && e2.message) || e2);
        return { ok: false, nextStage: 'need_material', ledger, report, failBatch: batch };
      }
      const records = extractDigestRecords(digestText, { expectedNames: names });
      const corpus = batchUnits.flatMap((u) => (u.segments || []).map((s) => s.text));
      const v = validateDigestRecords(records, { expectedNames: names, corpus });
      if (v.ok) {
        ok = true;
        mergeLedger(ledger, records);
        break;
      }
      lastValidation = v;
      report.rereads += 1;
      if (onProgress) onProgress({ batchIndex: bi + 1, total: batches.length, rereads: report.rereads, batchNames: names, attempt });
    }
    if (!ok) {
      // 回流重读超限仍失败 → 中断研读（不静默通过）：返回失败批与校验明细，由调用方如实上报
      report.missing.push(...(lastValidation?.missing || []));
      report.empty.push(...(lastValidation?.empty || []));
      report.unverifiable.push(...(lastValidation?.unverifiable || []));
      return { ok: false, nextStage: 'studying', ledger, report, failBatch: batch, validation: lastValidation };
    }
    if (onProgress) onProgress({ batchIndex: bi + 1, total: batches.length, rereads: report.rereads, batchNames: names, ok: true });
    // 通过：摘要原话进会话（assistant），素材批原文压缩替换为"该批点名"摘要（审计体积；引擎历史由 digestPairs 派生）
    appendMessage(session, { role: 'assistant', kind: 'assistant', content: digestText, compressible: false });
    const compact = applyCompaction(session, {
      summary: `【研读批${bi + 1}·已消化】覆盖点：${names.join('、')}（模型研读笔记见下一条）`,
      replacedIds: [materialMsg.id],
    });
    if (!compact.ok) return { ok: false, nextStage: 'studying', ledger, report: { ...report, digestError: compact.error }, failBatch: batch };
    digestPairs.push({ names, digestText });
  }
  return { ok: true, nextStage: 'ready', ledger, report, digestPairs };
}

export { ledgerToText, planPrefixKeepFull };
