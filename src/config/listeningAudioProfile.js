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
 * 🔴 语速口径（2026-09-20 按调研实证更新，不再凭猜测）：
 *   课标对语速仅作**定性**描述（2022 义务教育课标：一级"语速较慢"、二级"语速适中"；2017 高中课标：七级"正常语速"），
 *   具体"词/分钟"来自考试说明、教研论文与真题分析，**各考区存在差异**：
 *   · 中考：教研口径"120 词/分钟左右"（中国教育在线援引新课标要求）；
 *     真题实测：2015 浙江杭州卷 128 wpm、宁波卷约 115 wpm（肖超《2015年浙江省中考英语听力测试内容效度分析》），
 *     2023 柳州卷约 100–115 wpm（杨幸蓉《柳州市中考英语听力测试内容效度研究》）→ 中考档 120、九年级 130（贴真题上沿）。
 *   · 高考：2008 考纲分析"120–150 wpm"（天星教育）；2024 新课标Ⅰ卷真题分析 925 词/23分28秒 ≈ 154 wpm（浙江省教育考试院）；
 *     广东高考听说"平均语速 150 wpm 左右" → 高中档 150（贴近年真题）。
 *   · 小学：人人文库《小学英语听力测试题集设计》参考口径 低 80 / 中 90–100 / 高 110–120（约自然语速的 80%）；
 *     用户实测反馈"语速太慢" → 小学高段取区间上沿 120（衔接初中）。**中考档以上均取区间偏上值**。
 *   · 基准 160：Edge 音色 rate=0% 自然语速实测标定（2026-09-19 双口径逐帧一致，见 LISTENING_BASE_WPM）。
 *   故本矩阵为**默认值**，且一律允许按考区覆盖（用户定版：矩阵默认 + 可覆盖）。
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
  primary_high: 120,
  middle: 120,
  high: 150,
};

/** 各学段合理区间（词/分钟）——用于校验覆盖值是否越界告警，不改写用户显式设定 */
export const LISTENING_STAGE_WPM_RANGE = {
  primary_low: [80, 80],
  primary_mid: [90, 100],
  primary_high: [110, 120],
  middle: [100, 130],
  high: [140, 160],
};

/** 初中学段按年级细分（学段键 middle 无法区分 7/8/9 年级，必须再看年级）
 *  依据（2026-09-20 调研）：七年级基础层 110（区间 100–110 上沿，衔接小学高段）；
 *  八年级进阶层 120（中考主流口径）；九年级拓展层 130（杭州真题 128、教研"120 词/分钟"之上沿，贴中考真题） */
export const LISTENING_GRADE_WPM = { 7: 110, 8: 120, 9: 130 };

/**
 * 🔴 高中语速下限（词/分钟）——防"朗读腔"。
 *   高考明确要求听力"含自然连读、弱读"；而连读/弱读由音色与语速共同决定：
 *   **语速越慢，连读弱读越少**。故高中档刻意保持在接近自然语速区间，
 *   任何覆盖值都不得把高中压到本下限之下，否则与考试要求方向相反。
 *   2026-09-20 按调研上调：真题分析口径 137–154 词/分（2024 新课标Ⅰ卷 ≈154），下限取 140。
 */
export const LISTENING_HIGH_MIN_WPM = 140;

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
 * 中文播报音色候选表（2026-09-20 用户实测反馈"旁白的音色也不对"后开放配置）
 * ============================================================
 * 用户裁定：**默认仍为晓晓（Xiaoxiao）**，其余作为可选项、每项可试听——与英文音色同一套交互。
 * 正规考试录音的中文播报通常为清晰、平稳的播音腔女声；选不出"绝对标准"的，
 * 就把选择权交给用户（试听即知），默认值保持最通用的自然女声。
 */
export const LISTENING_ZH_VOICE_CANDIDATES = [
  { voice: 'zh-CN-XiaoxiaoNeural', name: '晓晓 · 自然女声（默认）', gender: 'F' },
  { voice: 'zh-CN-XiaoyiNeural', name: '晓伊 · 活泼女声', gender: 'F' },
  { voice: 'zh-CN-XiaochenNeural', name: '晓辰 · 温暖女声', gender: 'F' },
  { voice: 'zh-CN-YunjianNeural', name: '云健 · 沉稳男声', gender: 'M' },
  { voice: 'zh-CN-YunyangNeural', name: '云扬 · 新闻男声', gender: 'M' },
  { voice: 'zh-CN-YunxiNeural', name: '云希 · 阳光男声', gender: 'M' },
];

/** 中文播报音色的性别（供中英混排标题"同性别匹配"用；表里没有的按女声处理——默认晓晓即女声） */
export function zhVoiceGender(voice = '') {
  const hit = LISTENING_ZH_VOICE_CANDIDATES.find((c) => c.voice === voice);
  return hit ? hit.gender : 'F';
}

/**
 * 中英混合标题的「同一人通读」音色（2026-09-20 用户裁定）
 * ============================================================
 * 用户实测："虽然分中文音色和英文音色，但是需要是同一个读，而且要衔接自然。"
 * 需求拆解：① 整条标题必须**同一个人**读完（不能中文一个人、英文另一个人）；
 *           ② 中英交界必须**自然**（不能像两段拼接）。
 *
 * 🔴 为什么用"多语言音色"而不是中文音色或英文音色：
 *   · Edge 免费通道**没有中文多语言音色**（全量 322 个音色里，12 个 Multilingual 分属英/法/德/意/韩/葡，无 zh-*）；
 *   · 而英文多语言音色（Andrew/Ava/Brian/Emma）经微软官方文档确认支持
 *     **77 种语言自动检测（含中文普通话 zh-CN）**、共 91 个区域——
 *     即同一条音色读中文是中文、读英文是英文，**本身就满足"同一人 + 自然衔接"**，
 *     无需再按语种切段换声（切段换声恰恰是"一听就是两个人"的根因）。
 *   · 实证：用 en-US-AndrewMultilingualNeural 合成中文语句可正常出声（与晓晓同量级时长，非静音）。
 *   参考：Microsoft Learn《Customize voice and sound with SSML》多语言音色表。
 *
 * 口径：**仅当中英混排时**才用它把整条标题一次读完；纯中文标题仍用中文播报音色、
 *   纯英文标题仍用英语旁白音色（单语种不需要多语言音色，且中文音色的中文更自然）。
 *   用户可在面板"标题"槽改选其它多语言音色；某考区若坚持"中文一个声、英文一个声"，
 *   把 overrides.titleMixedVoice 设为 'split' 即回到旧的按语种切段行为。
 */
export const LISTENING_MIXED_TITLE_VOICE = 'en-US-AndrewMultilingualNeural';

/**
 * 中英混排标题的**默认读法**（2026-09-20 二次实测后定版）
 * ============================================================
 * 用户先要求"同一个读、衔接自然"，实测单一多语言音色后又反馈：
 *   "英文确实是英文音色了，但是中文为啥要用英文的音色读呢？就跟外国人说中文蹩脚那样的听觉。"
 * 👉 免费 Edge 通道**不存在中英双语都母语的音色**（全量 322 个里无中文多语言音色），
 *    故"同一人 + 双语都地道"不可能同时成立，必须取舍。定版取**双语都地道**：
 *
 *  · 'native'（默认）＝**按语种分读、同性别匹配**：中文段用「中文播报」音色，
 *    英文段用**与其同性别**的那条英文音色（中文播报是女声→用女主音色，是男声→用男主音色），
 *    段间不留人工停顿（用句间自然间隙）→ 中英各由母语音色朗读，听感是"同一位播音员换语言"，
 *    这是免费通道下最自然的方案；
 *  · 'single' ＝一条多语言音色整条通读（真·同一人），但它是英文母语，**中文会带外国口音**
 *    ——用户实测已否决，仅作为可选（面板「标题」槽可切），供纯英文标题或不在意者使用。
 */
export const LISTENING_TITLE_MIXED_POLICY = 'native';

/** 多语言音色候选（供"标题"槽试听与改选；均为微软文档确认支持中文的 77 语种音色） */
export const LISTENING_MIXED_TITLE_VOICE_CANDIDATES = [
  { voice: 'en-US-AndrewMultilingualNeural', name: 'Andrew · 多语言男声（默认）' },
  { voice: 'en-US-BrianMultilingualNeural', name: 'Brian · 多语言男声' },
  { voice: 'en-US-AvaMultilingualNeural', name: 'Ava · 多语言女声' },
  { voice: 'en-US-EmmaMultilingualNeural', name: 'Emma · 多语言女声' },
  { voice: 'en-US-AndrewNeural', name: 'Andrew · 普通男声（不支持中文，仅纯英文标题选）' },
];

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
 * 🔔 提示音（叮咚）的两个落点与默认开关（2026-09-20 用户裁定）
 * ============================================================
 * 用户原话："这里是所有的都会用到叮咚音吗？要进行区分的吧？比如粘贴带序号的文本进来，
 *   这个时候用户不需要叮咚音"。
 * 事实（原实现只有"响"这一种，没有任何区分与开关）：提示音在全卷只有**两个**落点，作用完全不同：
 *   · examStart＝**开考第一声**：全卷最前那一下（读标题/试音提示语/开场白之前）——标志"正式开考"；
 *   · perItem ＝**小题边界音**：每段材料开始前那一下（有题号播报则落在题号之前），
 *               即"一小题结束 叮咚 → 下一题"的打点；同一材料的第二/三遍之间**不响**。
 *   另：分节指令与部分标题处按真题口径**本就不响**（若此处也响，会与首段材料的提示音在两秒内重复，
 *   见 listeningScript 的换节注释）——不属于可配项，故不在下表中。
 * 为什么两者必须分开配：需求正好相反——正式考试要"打点"；而粘贴自有素材（多已自带序号/分隔）
 *   恰恰不需要，甚至"开考第一声"在非正式练习里也是多余的。
 * ⚠️ 提示音只在 **Edge 免费通道**生效（主进程按帧拼接 assets/listening-chime.mp3，见 main.js）；
 *   Azure 通道把整卷 SSML 交给服务端一次合成，插不进这段素材（既有事实，本次未改，界面已注明）。
 */
export const LISTENING_CHIME_DEFAULTS = { examStart: true, perItem: true };

/** 可配的两个提示音落点（界面据此渲染开关；键与 resolveListeningParams 返回的 params.chime 一致） */
export const LISTENING_CHIME_ROLES = [
  { key: 'examStart', label: '开考第一声', hint: '全卷最前响一次（读标题/开场白之前），标志"正式开考"' },
  { key: 'perItem', label: '小题边界音', hint: '每段材料开始前响一次（有题号播报则落在题号之前）；同一材料的第二/三遍之间不响；分节指令与部分标题处本就不响' },
];

/**
 * 每段材料的**默认**遍数选项（2026-09-20 开放配置）
 * ============================================================
 * 用户场景：粘贴自有素材时，素材里通常没有"每段对话读两遍"这类中文播音指令，遍数只能落到学段默认，
 *   此处给一个能直接设定的地方。
 * 🔴 口径**不变**：一律**以素材声明为准**（分节指令/条目里写了"读两遍"就用它，偏离还会登记告警）；
 *   本项只决定"素材没声明时读几遍"，故默认值必须是"跟随学段"而不是写死 2。
 */
export const LISTENING_REPEAT_OPTIONS = [
  { value: null, label: '跟随学段默认（现行主流：2 遍）' },
  { value: 1, label: '1 遍（如高考第一节短对话）' },
  { value: 2, label: '2 遍（多数中考/高考第二节）' },
  { value: 3, label: '3 遍（部分小学题型）' },
];

/**
 * 遍间换声的三种口径（2026-09-20 开放配置）
 * ============================================================
 * 矩阵默认＝按学段（小学开、初高中关，依据见 LISTING_PASS_VOICE_ROTATION 的调研注释）；
 * 此处把"跟随学段"之外的两种显式口径也交给用户——某考区确有男女轮读做法时可直接打开。
 */
export const LISTENING_ROTATION_OPTIONS = [
  { value: null, label: '跟随学段（小学开、初高中关）' },
  { value: true, label: '开（遍与遍换声）' },
  { value: false, label: '关（同一人重读）' },
];

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

/**
 * 「静默作答时间」的用户可调区间（秒）——2026-09-20 新增
 * ============================================================
 * 用户问："静默答题的时间是用户可调吗？还是硬编码的？有范围可供用户调整吗？"
 * 事实：此前**只有矩阵默认值**（硬编码在 LISTENING_PAUSE），面板未暴露，仅代码可覆盖。
 * 现补齐"默认 + 可调区间"两件事，与语速同口径（矩阵给默认值、用户可覆盖、越界只提示不拦）。
 *
 * 三档来源不同，故区间分开给：
 *  · short（一段材料对一题）：学段档 5/6/8/10/10 秒。小学以圈选/连线为主、中学需"回答本题 + 读下一小题"，
 *    故下探到 3 秒（快节奏小测）、上探到 30 秒（听写式慢作答）都允许；
 *  · long（一段材料对多题，独白/短文）：高考明文"各小题 5 秒钟"→ 默认 5000，区间取 3–20 秒；
 *  · fillIn（需动笔写词的补全短文/填空）：默认 30 秒（每题 5 秒 × 空数的通行量级），区间取 10–90 秒。
 * ⚠️ 各节指令里声明了"X 秒钟作答/阅读"时**以指令为准**（parseAnnouncedAnswerSeconds），
 *   用户设定对该节不生效——这是考试文本优先的红线，此处不做翻转。
 */
export const LISTENING_ANSWER_GAP_RANGE = {
  short: [3, 30],
  long: [3, 20],
  fillIn: [10, 90],
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
 * 遍与遍的**音色轮读**规则（2026-09-20 用户实测裁定 + 调研更新）
 * ============================================================
 * 用户反馈："遍与遍都是同一个声音，并没有分男声或女声" → 裁定**每一遍换一个声音**。
 * 调研实证：
 *   · 人教 PEP《义务教育教科书 英语 六年级下册 CD》说明：词汇"每个单词均有两遍录音，
 *     第一遍由英国人朗读，第二遍由美国人朗读"——同内容多遍由**不同声音**朗读有先例；
 *   · 小学听力要求原文"男、女、男声中速各读一遍，每遍间隔 5 秒"（读三遍轮换实证）；
 *   · 真题"读两遍"的卷面惯例多为同一人重读（未见男女轮流明文），故本规则属**用户定制**，
 *     不是国标——若不适用某考区，把本常量改为 false 即可整体关掉。
 * 处置：**重复 ≥2 遍**的单说话人材料**遍与遍换声**——首遍用材料自己声明的那条音色
 *   （未标注 N → 旁白音色；标注了 M/W → 男主/女主），次遍换"对侧"音色，三遍再回首遍音色。
 *   · 未标注材料（孤词/孤句/短文）＝ 旁白(默认男声1) → 女声2 → 旁白；
 *   · 标注女声的独白 ＝ 女声2 → 男声1（不会被旁白顶掉，尊重原材料标注）；
 *   对话材料一律按角色分音色，不参与轮读（对话本身已男女分声，遍间换声会打乱角色）。
 *
 * ⚠️ **作用域＝小学**（2026-09-20 定）：遍间换声的实证全部来自小学资料
 *   （人教 PEP CD、小学听力要求原文）；而中考/高考真题惯例是**同一人重读两遍**
 *   （未见男女轮流明文）。故初中/高中默认**不换声**，以保真为先；
 *   若某考区确有男女轮读做法，传 overrides.passVoiceRotation=true 即可对该卷开启。
 */
export const LISTENING_PASS_VOICE_ROTATION = true;

/** 遍间换声的默认生效学段（小学三档；初中/高中默认保真不换声，可用 overrides 开启） */
export const LISTENING_PASS_VOICE_ROTATION_STAGES = ['primary_low', 'primary_mid', 'primary_high'];

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
    // 中英混合标题：默认策略（'native' 按语种分读+同性别匹配 / 'single' 单一多语言音色通读）。
    // 🔴 归一两种入口，避免"策略"与"具体音色"被混为一谈：
    //    · overrides.titleMixedPolicy 显式给策略；
    //    · overrides.titleMixedVoice 若给的是**具体音色名**，即隐含"single 模式 + 用这条音色"；
    //      若给 'native'/'split'/'auto' 则隐含"按语种分读"；'single' 则用默认多语言音色。
    titleMixedPolicy: (() => {
      if (overrides.titleMixedPolicy) return overrides.titleMixedPolicy;
      const s = String(overrides.titleMixedVoice === undefined ? '' : overrides.titleMixedVoice).trim();
      if (!s) return LISTENING_TITLE_MIXED_POLICY;
      return ['native', 'split', 'auto'].includes(s) ? 'native' : 'single';
    })(),
    titleMixedVoice: overrides.titleMixedVoice === undefined
      ? LISTENING_MIXED_TITLE_VOICE
      : overrides.titleMixedVoice,
    // 遍间换声：默认只在小学生效（实证来自小学资料）；显式 overrides 可覆盖任一学段
    passVoiceRotation: overrides.passVoiceRotation
      ?? (LISTENING_PASS_VOICE_ROTATION && LISTENING_PASS_VOICE_ROTATION_STAGES.includes(key)),
    // 🔔 提示音两落点（2026-09-20 开放配置）：逐项覆盖，未覆盖的取默认（见 LISTENING_CHIME_DEFAULTS）
    chime: { ...LISTENING_CHIME_DEFAULTS, ...(overrides.chime || {}) },
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
  LISTENING_ZH_VOICE_CANDIDATES,
  LISTENING_MIXED_TITLE_VOICE,
  LISTENING_MIXED_TITLE_VOICE_CANDIDATES,
  LISTENING_TITLE_MIXED_POLICY,
  zhVoiceGender,
  LISTENING_SOUND_CHECK,
  LISTENING_FEATURE_DEFAULTS,
  LISTENING_CHIME_DEFAULTS,
  LISTENING_CHIME_ROLES,
  LISTENING_REPEAT_OPTIONS,
  LISTENING_ROTATION_OPTIONS,
  LISTENING_PAUSE,
  LISTENING_ANSWER_GAP_RANGE,
  LISTENING_REPEAT_TIMES,
  LISTENING_PASS_VOICE_ROTATION,
  LISTENING_PASS_VOICE_ROTATION_STAGES,
  LISTENING_BASE_WPM,
  LISTENING_SAFE_ABBR,
  LISTENING_RISK_PATTERNS,
  LISTENING_ROLE_LABELS,
  resolveListeningParams,
  missingListeningStages,
};
