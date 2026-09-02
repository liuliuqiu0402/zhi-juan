/**
 * 每类型输出预算·实测校准（采样落库 + 统计 + 一键采纳）
 * ============================================================
 * 🔴 定位：校准"勾选字量×系数→预算"的贴合度（选到什么字，实际能产出多少）。
 *    系数是程序内置常量 + 档间固定比例（精简:均衡:充分 ≈ 0.72:1:1.25），
 *    一键采纳只需锁定"均衡档基准产出率"，再按既有档间比例展开三档。
 *
 * 分桶主键 = 资料类型 × 学科 × 学段（五档 key），与项目"三维度注入标准"同构；
 * 范围层级（单元/课时/期中/期末等）软分层（记在样本里，统计时按需归并）；
 * 触顶 cap / 触发续写 / 疑似截断 的样本剔除（预算失效场，不算真实产出率）。
 *
 * 优先级（generate 端消费）：用户手工 custom > 校准覆盖值 > 播种默认。
 *    本模块只提供"读校准值/写校准值"，不直接改写 DEFAULT_BUDGET_BY_TYPE 源码常量——
 *    校准值存独立 key，实现"旧存档覆盖播种默认"也能在 boot 后回补。
 *
 * 产出率口径：产出率 = 实际输出字符数 / 勾选原文字数（无单位，字符/字符）。
 *    按中文经验 1 token ≈ 1.3 字符反推系数贴合度；校准目标是让"系数×勾选字量"
 *    更贴近"实际字符量折算的 token 待输出量"。
 * ============================================================
 */

import { resolveStageKey, STAGE_KEY_SET } from './gradeStage.js'; // 年级→五档学段键唯一事实源（校准桶键与三维度注入/质检同口径）
import { safeRead, safeWrite } from './safeStorage.js'; // localStorage JSON 安全读写唯一实现（曾与 auditLog 各复制一份同构函数）

// 存储 key（与 apiConfig 同层的 localStorage 业务 key；避免与生成内容仓库混放）
const SAMPLE_KEY = 'budgetCalibrationSamples';   // 原始样本队列
const CALIB_KEY = 'budgetCalibrationValues';     // 采纳后的校准覆盖层

// 学段归一：一律走共享 resolveStageKey（年级→五档键唯一事实源，禁止这里自建一套 parseInt/启发式，
// 否则与三维度注入/质检的学段口径错位——曾致小学一年级~六年级全被折叠成 primary_mid）。
// 桶键拆分原则上只允许"五档键"：已是五档键（存量样本/面板枚举回传）直接透传；
// 否则用 学段×年级(可回退教材名) 解析，小学按 低/中/高段 精确分桶。
// 🔴 无年级信息时 resolveStageKey 对小学按高段宽松（primary_high），与质检口径一致。
const resolveBucketStage = (stage = '', grade = '', name = '') => {
  const s = String(stage || '').trim();
  if (STAGE_KEY_SET.has(s)) return s; // 五档键自检唯一事实源（gradeStage.STAGE_KEY_SET，不另建正则防双轨）
  const resolved = resolveStageKey(s, grade, name);
  return STAGE_KEY_SET.has(resolved || '') ? resolved : 'middle';
};

/** 桶 key：genType|subject|stageKey|mode（mode 区分 split/once——两者产出率口径不同，绝不混算防废数据） */
const bucketKey = (genType, subject, stage, mode = '', grade = '', name = '') =>
  `${String(genType || '')}|${String(subject || '')}|${resolveBucketStage(stage, grade, name)}|${String(mode || '')}`;

// 读取/安全写入工具 → safeStorage.js 共享（曾本文件与 auditLog 各有一份 safeRead/safeWrite 逐字副本）

/** 淘汰策略：每桶最多保留 N 条（超出的按时间戳去最早的），防无限增长 */
const MAX_PER_BUCKET = 60;

/**
 * 追加一条采样样本。
 * @param {Object} s
 * @param {string} s.genType 资料类型
 * @param {string} s.subject 学科
 * @param {string} s.stage    学段（五档 key 或中文标签，内部归一）
 * @param {string} s.grade    具体年级（留告警用）
 * @param {string} s.scope    范围层级（单元/课时/期中/期末/整本等；软分层）
 * @param {number} s.selectedRawChars 勾选原文字数
 * @param {number} s.budgetTokens     本次正文/once 预算 cap（已触顶升级后的 bodyDynamicCap）
 * @param {number} s.outputChars      实际输出字符数（正文 finalContent.length）
 * @param {boolean} s.truncated       是否触发续写/疑似截断（true 则剔除）
 * @param {boolean} s.overCap         是否勾选超 cap（true 则剔除）
 * @param {string} s.mode             split|once 路径
 */
export const recordSample = (s = {}) => {
  if (!s.genType || !s.subject) return;
  const outChars = Number(s.outputChars);
  const inChars = Number(s.selectedRawChars);
  // 记录非数/无产出/无输入 → 无意义样本，跳过（避免污染均值）
  if (!Number.isFinite(outChars) || !Number.isFinite(inChars) || inChars <= 0) return;
  // 预算失效场剔除：触顶/续写/截断/产出低于最低阈值 → 不算真实产出率
  const invalid = Boolean(s.truncated || s.overCap) || outChars < 50;
  const key = bucketKey(s.genType, s.subject, s.stage, s.mode, s.grade, s.name);
  const sample = {
    t: Date.now(),
    genType: s.genType, subject: s.subject, stage: resolveBucketStage(s.stage, s.grade, s.name),
    grade: s.grade || '', scope: s.scope || 'default', mode: s.mode || '',
    name: s.name || '',
    inChars, budgetTokens: Number(s.budgetTokens) || 0,
    outChars, ratio: outChars / inChars, invalid,
  };
  const samples = safeRead(SAMPLE_KEY, []);
  samples.push(sample);
  // 每桶淘汰最旧
  const perBucket = new Map();
  for (const el of samples) {
    const k = bucketKey(el.genType, el.subject, el.stage, el.mode);
    if (!perBucket.has(k)) perBucket.set(k, []);
    perBucket.get(k).push(el);
  }
  const trimmed = [];
  for (const [k, arr] of perBucket) {
    arr.sort((a, b) => a.t - b.t);
    trimmed.push(...(arr.length > MAX_PER_BUCKET ? arr.slice(-MAX_PER_BUCKET) : arr));
  }
  safeWrite(SAMPLE_KEY, trimmed);
};

// ── 统计口径 ──
// 三档系数档间比例（与 DEFAULT_BUDGET_BY_TYPE 同源的事实约束；采纳展开时用）
export const TIER_RATIO = { economy: 0.72, balanced: 1.0, full: 1.25 };

/** 截尾均值：剔除首尾 pct 比例后的均值（防单一异常样本拉偏） */
const trimmedMean = (arr, pct = 0.1) => {
  if (!arr.length) return null;
  if (arr.length <= 2) return arr.reduce((a, b) => a + b, 0) / arr.length;
  const s = [...arr].sort((a, b) => a - b);
  const cut = Math.max(1, Math.floor(s.length * pct));
  const mid = s.slice(cut, s.length - cut);
  return mid.reduce((a, b) => a + b, 0) / mid.length;
};

/** 变异系数（CV = SD/均值），量化某桶样本的离散度 */
const coefficientOfVariation = (arr) => {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  if (m === 0) return 0;
  const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length);
  return sd / m;
};

// 校准采纳门槛（条数档位，可配置）
export const CALIBRATION_THRESHOLDS = {
  loose: 8,      // 宽松：快速看效果
  standard: 12,  // 标准默认：兼顾稳定与反馈速度
  strict: 20,    // 严谨：教务正式采用前
};

/**
 * 汇总某桶的有效样本统计（剔除 invalid）。
 * @param {string} genType
 * @param {string} subject
 * @param {string} stage
 * @param {Object} [opts] { minSamples=12, cvWarn=0.35 }
 * @returns {{count,inValid,median,mean,cv,ready,reason}}
 *   ready=true 表示样本足够且波动可控，可采纳；否则带 reason 说明缺什么。
 */
export const getBucketStats = (genType, subject, stage, mode = '', opts = {}) => {
  const minSamples = opts.minSamples ?? CALIBRATION_THRESHOLDS.standard;
  const cvWarn = opts.cvWarn ?? 0.35;
  const samples = safeRead(SAMPLE_KEY, []);
  const key = bucketKey(genType, subject, stage, mode);
  const valid = samples.filter(el =>
    bucketKey(el.genType, el.subject, el.stage, el.mode) === key && !el.invalid);
  const inValid = samples.filter(el =>
    bucketKey(el.genType, el.subject, el.stage, el.mode) === key && el.invalid).length;
  const ratios = valid.map(el => el.ratio).filter(Number.isFinite);
  const mean = trimmedMean(ratios);
  const cv = coefficientOfVariation(ratios);
  const sorted = [...ratios].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  let ready = false, reason = '';
  if (ratios.length < minSamples) {
    reason = `样本不足（${ratios.length}/${minSamples}）`;
  } else if (cv > cvWarn) {
    reason = `波动偏大（CV=${cv.toFixed(2)}>${cvWarn}，样本跨范围层级或模型不稳定）`;
  } else {
    ready = true; reason = '可采纳';
  }
  return { count: ratios.length, inValid, median, mean, cv, ready, reason };
};

/** 当前桶是否可采纳（只读判断，供 UI 置灰按钮/展示进度） */
export const canCalibrate = (genType, subject, stage, mode, threshold) =>
  getBucketStats(genType, subject, stage, mode, { minSamples: threshold }).ready;

// ── 校准层读写 ──
/**
 * 读取某桶的已采纳校准 base（均衡档基准产出率，字符/字符）。
 * 消费端用它替换 DEFBAULT 播种系数 = base / 中文token字符率 ? 见 usage。
 * 返回 null 表示无校准（应回退播种默认）。
 */
export const getCalibration = (genType, subject, stage, mode = '', grade = '', name = '') => {
  const cal = safeRead(CALIB_KEY, {});
  return cal[bucketKey(genType, subject, stage, mode, grade, name)] ?? null;
};

/**
 * 一键采纳：取该桶有效样本的中位数作为均衡档基准产出率。
 * 返回 { ok, base, applied } 或失败原因。
 */
export const applyCalibration = (genType, subject, stage, mode, threshold = CALIBRATION_THRESHOLDS.standard) => {
  const st = getBucketStats(genType, subject, stage, mode, { minSamples: threshold });
  if (!st.ready) return { ok: false, reason: st.reason, stats: st };
  const base = st.median; // 中位数比均值更稳
  const cal = safeRead(CALIB_KEY, {});
  cal[bucketKey(genType, subject, stage, mode)] = {
    genType, subject, stage: resolveBucketStage(stage), mode,
    base,            // 均衡档基准产出率（字符/字符）
    enabled: true,   // 是否启用校准（切换=只翻此位，不动数据；清理=整桶删）
    tiers: {
      economy: +(base * TIER_RATIO.economy).toFixed(3),
      balanced: +base.toFixed(3),
      full: +(base * TIER_RATIO.full).toFixed(3),
    },
    samples: st.count,   // 采纳时样本条数
    t: Date.now(),
  };
  safeWrite(CALIB_KEY, cal);
  return { ok: true, base, stats: st };
};

/**
 * 切换某桶校准的启用状态（只翻 enabled 位，保留校准值与样本）。
 * @returns {boolean} 切换后的 enabled 状态；无该桶校准记录时返回 null
 */
export const setCalibratedEnabled = (genType, subject, stage, mode = '', enabled) => {
  const cal = safeRead(CALIB_KEY, {});
  const k = bucketKey(genType, subject, stage, mode);
  if (!cal[k]) return null;
  cal[k].enabled = enabled === false ? false : true;
  safeWrite(CALIB_KEY, cal);
  return cal[k].enabled;
};

/**
 * 清理某桶校准（删除校准值 + 一并清除该桶全部样本，从零再来）。
 * 与"切换"严格区分：切换只翻 enabled，清理才删数据。
 */
export const clearCalibration = (genType, subject, stage, mode = '') => {
  const k = bucketKey(genType, subject, stage, mode);
  const cal = safeRead(CALIB_KEY, {});
  if (cal[k]) {
    delete cal[k];
    safeWrite(CALIB_KEY, cal);
  }
  // 清理语义 = 校准 + 样本一并移除（用户重采样从零开始）
  const samples = safeRead(SAMPLE_KEY, []);
  const kept = samples.filter(el => bucketKey(el.genType, el.subject, el.stage, el.mode) !== k);
  if (kept.length !== samples.length) safeWrite(SAMPLE_KEY, kept);
};

// 中文平均 token 字符率（实证系数；中英混合会更高，作为校准折算标尺）
export const CHARS_PER_TOKEN = 1.3;

/**
 * 读取某桶校准并折算为"每字符勾选的 token 系数"（与播种系数同单位），
 * 供生成端 pickSlot 在「用户 custom」之后、「播种默认」之前注入。
 * @returns {number|null} 折算后的 token/字符系数；无校准返回 null
 */
export const getCalibratedCoef = (genType, subject, stage, mode = '', tier = 'balanced', grade = '', name = '') => {
  const cal = getCalibration(genType, subject, stage, mode, grade, name);
  if (!cal || cal.enabled === false) return null; // disabled → 回退播种默认（切换态）
  const base = typeof cal.base === 'number' && cal.base > 0 ? cal.base : null;
  if (base == null) return null;
  // 校准 base 是"基准档产出率(字符/字符)"；换算该档 token 系数 = base / token字符率
  const ratio = TIER_RATIO[tier] ?? 1.0;
  const coef = (base * ratio) / CHARS_PER_TOKEN;
  return +coef.toFixed(3);
};

/** 全部样本数（诊断用） */
export const getSampleCount = () => safeRead(SAMPLE_KEY, []).length;

/**
 * 枚举某类型下"已有样本"的全部（学科×学段）桶，附统计与是否已采纳。
 * 供设置页分桶 UI 展示（含已采纳但当前无它样本的桶——从校准层并入）。
 * @param {string} genType
 * @param {Object} [opts] { threshold }
 * @returns {Array<{key,genType,subject,stage,stats,calibrated,calBase,samples}>}
 */
export const listTypeBuckets = (genType, opts = {}) => {
  const samples = safeRead(SAMPLE_KEY, []);
  const map = new Map();
  const mk = (s) => bucketKey(s.genType, s.subject, s.stage, s.mode);
  // 1) 从样本建桶
  for (const s of samples) {
    if (s.genType !== genType) continue;
    const k = mk(s);
    if (!map.has(k)) {
      map.set(k, { key: k, genType, subject: s.subject, stage: s.stage, mode: s.mode || '', ratios: [], inValid: 0, fromCal: false });
    }
    if (s.invalid) map.get(k).inValid++;
    else if (Number.isFinite(s.ratio)) map.get(k).ratios.push(s.ratio);
  }
  // 2) 并入已采纳但样本可能已逾期/被清空 的桶
  const cal = safeRead(CALIB_KEY, {});
  for (const k of Object.keys(cal)) {
    const c = cal[k];
    if (c?.genType !== genType) continue;
    if (!map.has(k)) {
      map.set(k, { key: k, genType, subject: c.subject, stage: c.stage, mode: c.mode || '', ratios: [], inValid: 0, fromCal: false });
    }
  }
  const out = [];
  for (const [k, b] of map) {
    const stats = (() => {
      const minSamples = opts.threshold ?? CALIBRATION_THRESHOLDS.standard;
      const ratios = b.ratios.filter(Number.isFinite);
      const mean = trimmedMean(ratios);
      const cv = coefficientOfVariation(ratios);
      const sorted = [...ratios].sort((a, b) => a - b);
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
      const count = ratios.length;
      let ready = false, reason = '';
      if (count < minSamples) reason = `样本不足(${count}/${minSamples})`;
      else if (cv > 0.35) reason = `波动偏大(CV=${cv.toFixed(2)})`;
      else { ready = true; reason = '可采纳'; }
      return { count, inValid: b.inValid, median, mean, cv, ready, reason };
    })();
    const c = cal[k] || null;
    out.push({ key: k, genType, subject: b.subject, stage: b.stage, mode: b.mode, stats, calibrated: !!c, enabled: c ? c.enabled !== false : false, calBase: c?.base ?? null, samples: stats.count });
  }
  return out;
};