/**
 * 英语听力音频参数矩阵（单一事实源 · 2026-09-16 用户确认）
 * ============================================================
 * 背景：项目此前**只产出听力文本**（卷面题目区 + 答案页听力原文），全链路无音频能力。
 *  本模块把"录音规范"从口头要求变成**可执行参数**：学段语速、停顿、口音、音色、重复次数。
 * 消费方：
 *   ① utils/listeningScript.js —— 据此产出 SSML（喂 TTS 引擎）/ 朗读稿（给人或剪映）；
 *   ② 生成面板——展示同一份，做到"所见即所发"；
 *   ③ 后续接入 TTS 时直接复用同一份参数，零返工。
 *
 * 🔴 语速口径（2026-09-16 调研）：课标对语速仅作**定性**描述（较慢/正常/较快），
 *   具体"词/分钟"来自考试说明与备考材料，**各考区存在差异**
 *   （中考：有口径约 100、有约 120-130，上海约 120；高考：约 130，上海 150-160，复习口径 120-150）。
 *   故本矩阵为**默认值**，且一律允许按考区覆盖（用户定版：矩阵默认 + 可覆盖）。
 *   参考：小学低/中/高段 80 / 90-100 / 110-120；初中七/八/九年级 100 / 120 / 130。
 *
 * 🔴 口音口径（用户定版：低美高混）：小学/初中用美音（人教版配套听力为美音）；
 *   高中英音+美音交替（对齐 2025 起高考混合口音趋势，含约 30% 轻微口音变体）。
 * ============================================================
 */
import { resolveStageKey, extractGradeNum, STAGE_KEYS } from '../utils/gradeStage.js';

/** 学段默认语速（词/分钟）——九年级/中考档与高考档取区间内偏上值 */
export const LISTENING_STAGE_WPM = {
  primary_low: 80,
  primary_mid: 95,
  primary_high: 115,
  middle: 120,
  high: 140,
};

/** 各学段合理区间（词/分钟）——用于校验覆盖值是否越界告警，不改写用户显式设定 */
export const LISTENING_STAGE_WPM_RANGE = {
  primary_low: [80, 80],
  primary_mid: [90, 100],
  primary_high: [110, 120],
  middle: [100, 130],
  high: [130, 150],
};

/** 初中学段按年级细分（学段键 middle 无法区分 7/8/9 年级，必须再看年级）
 *  依据：七年级基础层约 100、八年级进阶层 120、九年级拓展层 130（接近中考要求） */
export const LISTENING_GRADE_WPM = { 7: 100, 8: 120, 9: 125 };

/**
 * 🔴 高中语速下限（词/分钟）——防"朗读腔"。
 *   高考明确要求听力"含自然连读、弱读"；而连读/弱读由音色与语速共同决定：
 *   **语速越慢，连读弱读越少**。故高中档刻意保持在接近自然语速区间，
 *   任何覆盖值都不得把高中压到本下限之下，否则与考试要求方向相反。
 */
export const LISTENING_HIGH_MIN_WPM = 130;

/** 口音策略：'us' | 'gb' | 'mixed'（='英音美音交替'） */
export const LISTENING_ACCENT_POLICY = {
  primary_low: 'us',
  primary_mid: 'us',
  primary_high: 'us',
  middle: 'us',
  high: 'mixed',
};

/** 音色表（Azure / Edge 神经音色命名；可在设置页覆盖单项）
 *  M=男声  W=女声  N=旁白/独白 —— 同一角色全卷固定同一音色，避免音色漂移 */
export const LISTENING_VOICES = {
  us: { M: 'en-US-GuyNeural', W: 'en-US-JennyNeural', N: 'en-US-AriaNeural' },
  gb: { M: 'en-GB-RyanNeural', W: 'en-GB-SoniaNeural', N: 'en-GB-LibbyNeural' },
};

/** 中文播报音色（听力导语/指令按考区规范多为中文播报，与英文音色在同一份 SSML 内混排） */
export const LISTENING_ZH_VOICE = 'zh-CN-XiaoxiaoNeural';

/** 停顿参数（毫秒）——三类停顿必须分设，不能用一个值糊过去 */
export const LISTENING_PAUSE = {
  /** 材料内部句间自然停顿之上的额外间隙 */
  sentenceGapMs: 200,
  /** 同一材料两遍之间的间隙 */
  betweenRepeatsMs: 800,
  /** 每段材料读完后留给学生作答的时间（按学段，小段短、高段长） */
  answerGapMs: {
    primary_low: 8000,
    primary_mid: 8000,
    primary_high: 10000,
    middle: 10000,
    high: 10000,
  },
  /** 大题与大题之间 */
  betweenSectionsMs: 3000,
  /** 导语播完后进入第一题前的留白 */
  afterIntroMs: 1500,
};

/** 每段材料朗读遍数（现行考试主流为两遍；旧大纲曾为三遍，此处按现行两遍） */
export const LISTENING_REPEAT_TIMES = 2;

/**
 * 🔴 神经音色在 rate="0%" 下的自然语速（词/分钟）——用于把"目标 wpm"换算成 SSML 百分比。
 * ⚠️ 这是**初值估计**，不同音色/不同批次会有偏差。正式使用前请用一段已知词数的材料**实测校准一次**，
 *    校准后只改本常量，全链路（SSML/朗读稿/后续 TTS）随之生效。不要把这里的数字当成精确值对外承诺。
 */
export const LISTENING_BASE_WPM = 150;

/** 朗读化·安全替换：定式缩写，替换后语义唯一，可无条件执行 */
export const LISTENING_SAFE_ABBR = [
  [/\bMr\./g, 'Mister'],
  [/\bMrs\./g, 'Missus'],
  [/\bMs\./g, 'Miz'],
  [/\bDr\./g, 'Doctor'],
  [/\betc\./g, 'et cetera'],
];

/**
 * 朗读化·高风险项：**同形多义，一律不自动替换**，只登记供人工确认。
 * 原因：TTS 读错这类项会导致"学生听到的"与"答案页文本"不一致，而答案按文本批改 —— 属一致性红线。
 */
export const LISTENING_RISK_PATTERNS = [
  { code: 'abbr-st', re: /\bSt\./, note: 'St. 可能是 Street 或 Saint，读音不同' },
  { code: 'abbr-no', re: /\bNo\.\s*\d/, note: 'No. 一般读 number，需确认' },
  { code: 'year-like', re: /\b(?:1[89]\d{2}|20\d{2})\b/, note: '四位数可能是年份（twenty twenty-four）也可能是数量，读法不同' },
  { code: 'currency', re: /[$£€¥]/, note: '货币符号读法需确认（five dollars / five pounds）' },
  { code: 'decimal', re: /\b\d+\.\d+\b/, note: '小数点读作 point，需确认引擎读法' },
  { code: 'time', re: /\b\d{1,2}:\d{2}\b/, note: '时刻读法需确认（three thirty / half past three）' },
];

/** 角色标记的规范写法（朗读稿用；SSML 内**不得**出现，否则会被 TTS 念出来） */
export const LISTENING_ROLE_LABELS = { M: '男', W: '女', N: '旁白' };

/**
 * 解析某次听力录制的完整参数
 * @param {object} opts
 * @param {string} opts.stage   学段（中文/五档键均可，走 gradeStage 单一事实源归一）
 * @param {string} opts.grade   年级（初中用于细分 7/8/9 年级语速）
 * @param {string} opts.name    教材名（grade 缺失时兜底抓年级）
 * @param {object} opts.overrides 覆盖值（按考区/按用户）：{ wpm, accent, voices, pauses, repeat, baseWpm }
 * @returns {object} 生效参数 + warnings（越界/被钳制的说明，供界面提示）
 */
export function resolveListeningParams({ stage = '', grade = '', name = '', overrides = {} } = {}) {
  const warnings = [];
  const stageKey = resolveStageKey(stage, grade, name) || '';
  if (!stageKey) warnings.push('未识别学段，已按初中学段参数兜底');
  const key = stageKey || 'middle';

  // ── 语速：学段默认 → 初中按年级细分 → 用户覆盖 ──
  let wpm = LISTENING_STAGE_WPM[key];
  if (key === 'middle') {
    const g = extractGradeNum(grade) || 0;
    if (g && LISTENING_GRADE_WPM[g]) wpm = LISTENING_GRADE_WPM[g];
  }
  if (Number.isFinite(overrides.wpm) && overrides.wpm > 0) wpm = overrides.wpm;

  // 区间校验（仅告警，不改写用户显式设定）
  const range = LISTENING_STAGE_WPM_RANGE[key];
  if (range && (wpm < range[0] || wpm > range[1])) {
    warnings.push(`语速 ${wpm} 词/分 超出${key}学段合理区间 ${range[0]}-${range[1]}，请确认是否有考区依据`);
  }
  // 🔴 高中下限钳制：语速压低会消解连读/弱读，与高考要求相反
  if (key === 'high' && wpm < LISTENING_HIGH_MIN_WPM) {
    warnings.push(`高中语速不得低于 ${LISTENING_HIGH_MIN_WPM} 词/分（过低会消解连读弱读，与高考要求相反），已钳制`);
    wpm = LISTENING_HIGH_MIN_WPM;
  }

  // ── 口音 ──
  let accent = LISTENING_ACCENT_POLICY[key] || 'us';
  if (overrides.accent) accent = overrides.accent;

  // ── 音色 ──
  const voices = overrides.voices || LISTENING_VOICES;

  // ── 停顿 / 遍数 ──
  const pauses = {
    ...LISTENING_PAUSE,
    ...(overrides.pauses || {}),
    answerGapMs: {
      ...LISTENING_PAUSE.answerGapMs,
      ...((overrides.pauses && overrides.pauses.answerGapMs) || {}),
    },
  };
  const repeat = Number.isFinite(overrides.repeat) && overrides.repeat > 0
    ? overrides.repeat
    : LISTENING_REPEAT_TIMES;

  const baseWpm = Number.isFinite(overrides.baseWpm) && overrides.baseWpm > 0
    ? overrides.baseWpm
    : LISTENING_BASE_WPM;

  // ── wpm → SSML prosody rate 百分比（round 到整数；0 表示不加干预，保留自然语流） ──
  const ratePercent = Math.round((wpm / baseWpm - 1) * 100);

  return {
    stageKey: key,
    wpm,
    baseWpm,
    ratePercent,
    accent,
    voices,
    zhVoice: overrides.zhVoice || LISTENING_ZH_VOICE,
    pauses,
    repeat,
    answerGapMs: pauses.answerGapMs[key] || 10000,
    warnings,
  };
}

/** 校验学段键集合自洽（防止有人新增学段却漏配监听参数） */
export function missingListeningStages() {
  return STAGE_KEYS.filter((k) => !(k in LISTENING_STAGE_WPM) || !(k in LISTENING_ACCENT_POLICY));
}

export default {
  LISTENING_STAGE_WPM,
  LISTENING_STAGE_WPM_RANGE,
  LISTENING_GRADE_WPM,
  LISTENING_HIGH_MIN_WPM,
  LISTENING_ACCENT_POLICY,
  LISTENING_VOICES,
  LISTENING_ZH_VOICE,
  LISTENING_PAUSE,
  LISTENING_REPEAT_TIMES,
  LISTENING_BASE_WPM,
  LISTENING_SAFE_ABBR,
  LISTENING_RISK_PATTERNS,
  LISTENING_ROLE_LABELS,
  resolveListeningParams,
  missingListeningStages,
};
