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

/**
 * 可配音色候选表（Edge 实测清单，2026-09-19 用 msedge-tts 拉全量确认可用）
 * ============================================================
 * 用户裁定（2026-09-19）：**男声 1（Christopher）+ 女声 2（Jenny）为默认，其余全部作为可选项**，
 *   且**每个选项都要能试听**（见生成端「试听」按钮 → 主进程 edge-tts-preview）。
 * 分组依据：真题主流为**美音**，少数地区历史上用英音，故两组并列、用户自选。
 * 序号（男声 1..8 / 女声 1..7）与"音色试听对比.mp3"里的报号一一对应，便于用户按编号指定。
 */
export const LISTENING_VOICE_CANDIDATES = {
  us: {
    M: [
      'en-US-ChristopherNeural',          // 男声 1（默认）News·Authority，最接近播音腔
      'en-US-GuyNeural',                  // 男声 2  News
      'en-US-EricNeural',                 // 男声 3  News·Rational
      'en-US-SteffanNeural',              // 男声 4  News·Rational
      'en-US-RogerNeural',                // 男声 5
      'en-US-BrianNeural',                // 男声 6  Conversation·Casual（偏口语）
      'en-US-AndrewNeural',               // 男声 7  Conversation·Warm
      'en-US-AndrewMultilingualNeural',   // 男声 8  多语言·Warm
    ],
    W: [
      'en-US-AriaNeural',                 // 女声 1  narration-professional·newscast-formal
      'en-US-JennyNeural',                // 女声 2（默认）newscast
      'en-US-MichelleNeural',             // 女声 3
      'en-US-AvaNeural',                  // 女声 4  Conversation
      'en-US-EmmaNeural',                 // 女声 5  Conversation·Cheerful
      'en-US-AvaMultilingualNeural',      // 女声 6  多语言
      'en-US-EmmaMultilingualNeural',     // 女声 7  多语言
    ],
  },
  gb: {
    M: ['en-GB-RyanNeural', 'en-GB-ThomasNeural'],
    W: ['en-GB-SoniaNeural', 'en-GB-LibbyNeural', 'en-GB-MaisieNeural'],
  },
};

/** 默音色（用户裁定：男声 1 + 女声 2）；M2/W2 为"多角色追加音色"，留空＝不启用 */
export const LISTENING_VOICE_DEFAULTS = {
  M: 'en-US-ChristopherNeural',
  W: 'en-US-JennyNeural',
  M2: '',
  W2: '',
};

/** 生效音色表（＝默认值；沿用两套口音表的老结构，习惯引用 LISTENING_VOICES 的代码不受影响） */
export const LISTENING_VOICES = {
  us: { M: LISTENING_VOICE_DEFAULTS.M, W: LISTENING_VOICE_DEFAULTS.W, N: LISTENING_VOICE_DEFAULTS.M },
  gb: { M: 'en-GB-RyanNeural', W: 'en-GB-SoniaNeural', N: 'en-GB-RyanNeural' },
};



/** 中文播报音色（听力导语/指令按考区规范多为中文播报，与英文音色在同一份 SSML 内混排） */
export const LISTENING_ZH_VOICE = 'zh-CN-XiaoxiaoNeural';

/**
 * 听力试音环节（录音正文之前的"声音检查"段）
 * ============================================================
 * 🔴 2026-09-19 用户实测复核后补齐（"现在是全部按正规走的吧？"→ 裁定"做成开关，默认开"）：
 *   正规考试录音在正文之前有**独立的试音段**——「下面是听力试音时间：」+ 一段英文对话
 *   （一男一女，便于同时校验两个音色与音量）+「听力试音到此结束，听力考试现在开始。」
 *   实证：广西 2019 年 6 月普通高中学业水平考试英语听力录音稿即以该结构开篇
 *   （"下面是听力试音时间：…听力试音到此结束，听力考试现在开始。"），
 *   高中四校联考录音稿同构。
 * ⚠️ 试音对话为**本项目自撰**，不使用真题脚本——教辅"不照抄、不模仿"的口径同样适用于音频素材。
 *   功能等价即可：M/W 交替、语速与正文一致、长度足够听清并调试音量。
 */
export const LISTENING_SOUND_CHECK = {
  /** 试音起始提示语（中文播报，措辞同正规录音原文） */
  intro: '下面是听力试音时间：',
  /** 试音收尾 + 正式开考（真题把两件事放在同一句里，不拆成两句） */
  toExam: '听力试音到此结束，听力考试现在开始。',
  /** 试音对话（英文，M/W 交替；只读一遍） */
  lines: [
    { role: 'M', text: 'Hello, this is the school office calling.' },
    { role: 'W', text: 'Hello. Is there anything I can help you with?' },
    { role: 'M', text: "Yes, I'm calling about the English listening test next Monday." },
    { role: 'W', text: 'I see. What time does it start?' },
    { role: 'M', text: 'It starts at nine in the morning. Please arrive ten minutes early.' },
    { role: 'W', text: 'Nine o\u2019clock, and arrive at ten to nine. Got it.' },
    { role: 'M', text: 'You will also need a pencil and an eraser.' },
    { role: 'W', text: 'A pencil and an eraser. Anything else?' },
    { role: 'M', text: "No, that's all. Good luck with your test." },
    { role: 'W', text: 'Thank you very much. Goodbye.' },
    { role: 'M', text: 'Goodbye.' },
  ],
};

/**
 * 听力音频的**可选环节**默认值（开关默认值单一事实源）
 * ============================================================
 * 三项均经用户裁定：
 *  · announceTitle=true        —— **读试卷标题**（2026-09-19 用户实测稿的顺序：
 *                                 「六年级英语上册Unit 1 Try your best测试卷」→「第一部分 听力部分」→
 *                                 大题指令 → 叮咚 → Number one …）。校/区级做法，学生据此确认是哪份卷。
 *  · soundCheck=true       —— 正规录音含独立试音段（见 LISTENING_SOUND_CHECK）；
 *                             校内小测嫌长可在生成面板关掉。
 *  · announceShortItemNo=true  —— **一题一材料处播题号**，且用英文「Number 1.」而不是中文「第1小题」
 *                             （2026-09-19 用户定："number one 不读第一小题"）。
 *                             注：先前按"高考第一节不播小题号"设为默认关，用户实测稿明确要求播，
 *                             故改回开——高考那一节不播是高考的做法，小学/校内卷普遍播。
 */
export const LISTENING_FEATURE_DEFAULTS = {
  announceTitle: true,
  soundCheck: true,
  announceShortItemNo: true,
};

/**
 * 「第一部分 听力部分」播报语（2026-09-19 用户实测稿要求读出）
 * ============================================================
 * 英语卷的听力**必为第一部分**（见 promptLibrary 的卷面结构生成：听力→第一部分、笔试→第二部分），
 * 故此处取固定播报，不依赖解析结果（AI 解析通道拿不到卷面结构，固定值反而更稳）；
 * 若某卷的听力不是第一部分，调用方传 partTitle 覆盖即可。
 * 只播名称，不播「（共N大题，满分M分）」——题数/分值属书面信息，不入音频。
 */
export const LISTENING_PART_ANNOUNCEMENT = '第一部分 听力部分。';

/** 停顿参数（毫秒）——三类停顿必须分设，不能用一个值糊过去 */
/* 🔴 2026-09-19 用户实测根治（"间隔不是标准间隔"）：原值 句间 200 / 遍间 800 / 作答一律 10 秒，
   且 betweenSectionsMs **配了却从未被使用**（节与节之间没有任何额外留白）。
   🔴 2026-09-19 二次校准（用户实测反馈"停顿间隔时间太长"）——逐项按证据收敛：
   · 遍间：真题明文"等待 2 秒后立即播放第二遍"（2026 新版高考改革解读）→ 2500 降为 **2000**；
   · 作答（一题一材料）：高考明文 10 秒（含"回答本题 + 阅读下一小题"两项动作）→ 中学档保持 10000；
     **小学档下调**（5000/6000/8000）——小学以圈选/连线为主，没有"读下一题"的动作，
     沿用中学的 10 秒会明显空等；此项为产品裁定（小学无国标明文，各卷自定）；
   · 节间：校内正规听力稿为"停顿 2 秒"→ 3000 降为 **2000**；指令后 2000 保持不变（同稿一致）；
   · 一段材料对多题的作答留白：高考明文"各小题 5 秒钟"→ 5000 不变；
   · 各节指令里若声明了"X 秒钟作答 / X 秒钟阅读"，**以指令为准**（见 parseAnnouncedAnswerSeconds）。 */
export const LISTENING_PAUSE = {
  /** 材料内部句/轮之间的自然间隙 */
  sentenceGapMs: 120,
  /** 同一材料两遍之间的间隙（真题明文 2 秒） */
  betweenRepeatsMs: 2000,
  /** 每段材料读完后留给学生作答的时间（按学段，小段短、高段长）——用于"一段对话对一题"的短材料 */
  answerGapMs: {
    primary_low: 5000,
    primary_mid: 6000,
    primary_high: 8000,
    middle: 10000,
    high: 10000,
  },
  /** 一段材料对应多题（独白/短文）的作答留白——高考明文"各小题 5 秒钟"，明显短于上表 */
  longMaterialAnswerGapMs: 5000,
  /** 需**动笔写词**的题（补全短文/填空类）的作答留白——5 秒档是给"听独白做判断"的，
   *  写 5 个词根本来不及（用户实测指出）。按"每题 5 秒 × 空数"的通行量级取 30 秒档；
   *  节指令若声明了作答秒数，仍以指令为准。 */
  fillInAnswerGapMs: 30000,
  /** 大题与大题之间（校内正规听力稿为"停顿 2 秒"） */
  betweenSectionsMs: 2000,
  /** 分节指令播完 → 该节第一段材料之前的留白（"现在开始"后的停顿；真题此处的读题时间由指令声明） */
  afterSectionInstructionMs: 2000,
  /** 试音对话播完 → "听力试音到此结束，听力考试现在开始" 之前的留白 */
  afterIntroMs: 1500,
  /** 题号播报之后 → 材料（含材料前的提示音）之前的短停顿 */
  afterItemNoMs: 600,
  /** 中文播报段之间（试卷标题 → 试音/开场白 → 部分标题）的短停顿——用户实测反馈"停顿太长"，取短值 */
  afterTitleMs: 1200,
};

/** 每段材料朗读遍数（现行考试主流为两遍；旧大纲曾为三遍，此处按现行两遍）
 *  🔴 2026-09-19 复核：遍数**并非一律两遍**，且随考试/题型变化——
 *    · 高考全国卷：第一节（短对话）**仅读一遍**、第二节（对话或独白）读两遍；
 *    · 各省学考：广西两遍、黑龙江一遍、福建两遍——**同是学考也不同**；
 *    · 中考多数省市：全卷读两遍；
 *    · 小学：以两遍为主，部分题型（听音辨词/听句选图/短文排序）**读三遍**。
 *  故此处只是"源文本未声明时的兜底值"，实际一律**以节指令声明为准**（parseAnnouncedRepeat）。 */
export const LISTENING_REPEAT_TIMES = 2;

/**
 * 三遍及以上的**音色轮读**规则（2026-09-19 调研新增）
 * ============================================================
 * 用户问："不同遍数都是同一个音色吗？不要分男女吗？"
 * 调研实证（人教 PEP 三下期末素养总练习听力要求原文）：
 *   "听短文，将图片字母编号写在房间相应位置"本题**读三遍**，
 *   并明确注明"**男、女、男声中速各读一遍，每遍间隔 5 秒**"。
 * 处置：**读三遍**的单说话人材料（旁白朗读的孤词/孤句/短文，即未标注 M/W 的材料）
 *   按 男 → 女 → 男 轮换音色；两遍仍为同一音色（同一说话人重读一遍，真题即如此，
 *   换人反而是错的）；对话材料一律按角色分音色，不参与轮读。
 * ⚠️ 置信度：**单一来源**（一份小学听力要求原文）。故仅在"读三遍 + 单说话人"这一窄条件下生效，
 *   不影响两遍的主流情形；若与你的实际考试不符，改这个常量即可整体关掉。
 */
export const LISTENING_TRIPLE_PASS_ROTATION = true;

/**
 * 神经音色在 rate="0%" 下的自然语速（词/分钟）——用于把"目标 wpm"换算成 SSML 百分比。
 * 🔴 2026-09-19 **重新实测**（此前记的 129 经复核为错误标定，本次用两种独立口径交叉验证）：
 *    口径 A：文件字节数 ÷ 288 B/帧 × 24 ms/帧；口径 B：逐帧解析头部累计——两者结果**逐字节一致**。
 *    实测（rate=0%）：语速随**句子密度**变化明显（句子多→句间停顿多→有效 wpm 低），
 *      · 材料 T1（45 词、3 长句）：Christopher 169 / Guy 180 / Aria 170 / Jenny 168
 *      · 材料 T2（50 词、6 短句）：Christopher 152 / Guy 153 / Aria 152 / Jenny 153
 *    取两材料的代表值 **160** 作为基准（各音色彼此相差 <10%，单一基准足够）。
 *    调速链路亦经实测验证：同一材料 0%→152、−12%→134、−30%→107、−50%→76、+8%→165，
 *    **−50% 恰为半速**，说明百分比换算线性可信、且小学低段所需的 −50% 档可用。
 * ⚠️ 真实考试录音语速（真题分析）约 137–154 词/分。按本基准换算后，
 *    高中档 target 140 → rate −12.5% → 实际 ≈140 词/分，正落在该区间内。
 */
export const LISTENING_BASE_WPM = 160;

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
  // 补全短文类若沿用卷面的下划线占位，TTS 会把 "___" 念成 underscore（实测"音频与内容对不上"的来源之一）
  { code: 'blank-underscore', re: /_{2,}/, note: '下划线空格会被读成 underscore，须补全成完整短文或删除占位' },
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
  LISTENING_VOICE_CANDIDATES,
  LISTENING_VOICE_DEFAULTS,
  LISTENING_ZH_VOICE,
  LISTENING_SOUND_CHECK,
  LISTENING_FEATURE_DEFAULTS,
  LISTENING_PAUSE,
  LISTENING_REPEAT_TIMES,
  LISTENING_TRIPLE_PASS_ROTATION,
  LISTENING_BASE_WPM,
  LISTENING_SAFE_ABBR,
  LISTENING_RISK_PATTERNS,
  LISTENING_ROLE_LABELS,
  resolveListeningParams,
  missingListeningStages,
};
