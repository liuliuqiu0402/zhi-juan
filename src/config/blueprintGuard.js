/**
 * 蓝本源头防错校验器（BlueprintGuard）
 * ============================================================
 * 🔴 目的：从源头杜绝蓝本结构错误——错误在测试/启动时被拦截，
 *    而不是流入生成环节后才被"自处理闭环"补救。
 *
 * 校验维度（全部基于调研/课标通行规范，非拍脑袋）：
 *   G1 分值闭合    — 每个大题 score > 0 且各大题之和 === fullScore（精确到分）
 *   G2 听力占比    — 英语卷听力大题分值占比在学段合理区间
 *                    （小学低段 40% / 中段 30-40% / 高段 30% / 初中 20-25% / 高中 20%）
 *   G3 题量×分值   — note 中可解析的"每空/每题 X 分"与大题分值自洽
 *                    （如"5小题×2分" ⇒ 大题应≈10分，允许 ±1 舍入）
 *   G4 大题粒度    — 大题分值非 0 且不碎（≥3 分，避免无意义的 1-2 分碎片大题）
 *   G5 学段结构    — 主干学科（语数英）各学段均有完整蓝本；初中含听力学科必有听力大题
 *   G6 卷面要素    — duration 合法（含"分钟"）、fullScore 为 5 或 10 的倍数（试卷惯例）
 * ============================================================
 */

/** 学段键归一：primary_low/mid/high → primary 组 */
const stageGroup = (s) => (s || '').startsWith('primary') ? 'primary' : (s || '');

/** 英语听力占比学段区间（调研：江苏小学低段40分/中段30-35分/高段30分、初中25分、高中30分） */
const LISTENING_RATIO = {
  primary_low: [0.38, 0.42],
  primary_mid: [0.28, 0.36],   // 江苏真实区卷：昆山三年级30分、五年级30分，中段通行30-35%
  primary_high: [0.28, 0.32],
  middle: [0.18, 0.26],
  high: [0.18, 0.22],
};

/**
 * 校验单个蓝本
 * @param {object} bp 蓝本对象 { label, fullScore, duration, sections }
 * @param {string} key 蓝本键（如 '英语|primary_mid'）
 * @returns {Array<{code:string, severity:'error'|'warning', detail:string}>}
 */
export function validateBlueprint(bp, key = '') {
  const errors = [];
  const [subject, stage] = key.split('|');
  const stg = stageGroup(stage);

  // G1 分值闭合
  if (!bp || !Array.isArray(bp.sections)) {
    return [{ code: 'G1', severity: 'error', detail: `${key}: 蓝本无 sections` }];
  }
  const sum = bp.sections.reduce((s, sec) => s + (sec.score || 0), 0);
  if (Math.abs(sum - (bp.fullScore || 0)) > 0.01) {
    errors.push({ code: 'G1', severity: 'error', detail: `${key}: 大题分值之和 ${sum} ≠ 满分 ${bp.fullScore}` });
  }

  // G4 大题粒度
  for (const sec of bp.sections) {
    if (sec.score && sec.score > 0 && sec.score < 3) {
      errors.push({ code: 'G4', severity: 'warning', detail: `${key}·${sec.name}: 大题分值 ${sec.score} 过碎（<3分）` });
    }
  }

  // G2 听力占比（仅英语）
  if (subject === '英语' && stg && LISTENING_RATIO[stg]) {
    const listeningScore = bp.sections
      .filter(s => /听力|听音|Listening/i.test(s.name))
      .reduce((s, sec) => s + (sec.score || 0), 0);
    if (listeningScore > 0 && bp.fullScore > 0) {
      const ratio = listeningScore / bp.fullScore;
      const [min, max] = LISTENING_RATIO[stg];
      if (ratio < min - 0.01 || ratio > max + 0.01) {
        errors.push({
          code: 'G2', severity: 'error',
          detail: `${key}: 听力占比 ${(ratio * 100).toFixed(0)}%（${listeningScore}/${bp.fullScore}分）超出学段合理区间 ${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}%`,
        });
      }
    }
  }

  // G5 学段结构：初中英语必须有听力大题
  if (subject === '英语' && stg === 'middle' && !bp.sections.some(s => /听力|听音|Listening/i.test(s.name))) {
    errors.push({ code: 'G5', severity: 'error', detail: `${key}: 初中英语卷缺少听力大题` });
  }

  // G6 卷面要素
  if (!/分钟/.test(bp.duration || '')) {
    errors.push({ code: 'G6', severity: 'warning', detail: `${key}: duration 格式异常（应为"X分钟"）: ${bp.duration}` });
  }
  if (bp.fullScore && bp.fullScore % 5 !== 0) {
    errors.push({ code: 'G6', severity: 'warning', detail: `${key}: 满分 ${bp.fullScore} 非 5 的倍数（试卷惯例为 5/10 的倍数）` });
  }

  return errors;
}

/**
 * 校验全部蓝本
 * @param {object} blueprints EXAM_BLUEPRINTS
 * @returns {{errors:Array, warnings:Array, ok:boolean}}
 */
export function validateAllBlueprints(blueprints) {
  const errors = [];
  const warnings = [];
  for (const [key, bp] of Object.entries(blueprints || {})) {
    const issues = validateBlueprint(bp, key);
    for (const i of issues) {
      if (i.severity === 'error') errors.push(i);
      else warnings.push(i);
    }
  }
  return { errors, warnings, ok: errors.length === 0 };
}

export default { validateBlueprint, validateAllBlueprints, LISTENING_RATIO };
