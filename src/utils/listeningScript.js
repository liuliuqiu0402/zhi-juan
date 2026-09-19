/**
 * 英语听力稿生成器（SSML / 朗读稿，纯函数可单测）
 * ============================================================
 * 单一事实源：**先建"分段脚本(storyboard)"，再渲染成两种形态**——
 *   ① SSML   → 粘进 TTS 引擎（Azure 语音 Studio「音频内容创建」等）一键出音频；
 *   ② 朗读稿 → 给人看 / 真人录音 / 剪映分角色配音（含角色与停顿提示，无引擎语法）。
 * 为什么分两种：**角色标记（M:/W:）绝不能进 TTS 输入**——普通引擎会把 "M:" 念出来。
 *   故 SSML 用 <voice> 表达角色，朗读稿用中文角色名表达角色，两者互不串味。
 *
 * 🔴 已落实的口径（2026-09-16 用户定版）：
 *   · 学段语速/停顿/口音/音色/遍数 → 全部取自 config/listeningAudioProfile.js（矩阵默认 + 可覆盖）
 *   · 对话按角色分音色且**逐句保序**（每句一个 <voice>，避免"按角色分组"打乱对话顺序）
 *   · 高中刻意不压语速（保连读/弱读自然语流），中文导语不套用英文慢速
 *   · 数字/缩写等**同形多义项不自动改写**，只登记风险供人工确认（防"音频≠文本"红线）
 * ============================================================
 */
import {
  resolveListeningParams,
  LISTENING_SAFE_ABBR,
  LISTENING_RISK_PATTERNS,
  LISTENING_ROLE_LABELS,
  LISTENING_SOUND_CHECK,
  LISTENING_FEATURE_DEFAULTS,
  LISTENING_PART_ANNOUNCEMENT,
  LISTENING_TRIPLE_PASS_ROTATION,
  LISTENING_VOICE_CANDIDATES,
} from '../config/listeningAudioProfile.js';
import { isCjkNoise } from './listeningExtract.js';

/**
 * 音色标签：'en-US-ChristopherNeural' → '男声 1 · Christopher'
 * 🔴 为什么需要（2026-09-19 用户问"解析的听力稿中会多音色配角色吗？要不然用户怎么能立即知道
 *   是否有多角色呢？"）：朗读稿与界面都要能**一眼看出每个角色用了哪条音色**，
 *   编号与弹窗下拉、音色试听文件里的报号完全一致，便于用户对着改。
 */
const VOICE_LABELS = (() => {
  const map = new Map();
  for (const accent of ['us', 'gb']) {
    for (const g of ['M', 'W']) {
      (LISTENING_VOICE_CANDIDATES[accent] || {})[g].forEach((v, i) => {
        map.set(v, `${g === 'M' ? '男声' : '女声'} ${i + 1} · ${v.replace(/^en-[A-Z]{2}-|Neural$/g, '')}`);
      });
    }
  }
  return map;
})();
export const voiceLabel = (voice = '') => VOICE_LABELS.get(String(voice)) || String(voice || '');

/** 角色标签：M/W/N 用中文规范名；A/B/C、S1 这类未知标签**照原名显示**（显示成"旁白"会误导） */
export const roleLabel = (role = '') => {
  const r = String(role || 'N').toUpperCase();
  return LISTENING_ROLE_LABELS[r] || r;
};

/** XML 转义（SSML 是 XML，未转义会直接合成失败） */
export const escapeXml = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

/**
 * 朗读化预处理：只做**安全替换**（定式缩写），高风险同形多义项一律不自动改写，只登记。
 * @returns {{ text: string, risks: Array<{code:string,note:string,samples:string[]}> }}
 */
export function normalizeForSpeech(text = '') {
  let out = String(text || '');
  const risks = [];
  for (const [re, rep] of LISTENING_SAFE_ABBR) out = out.replace(re, rep);
  for (const r of LISTENING_RISK_PATTERNS) {
    const flags = r.re.flags.includes('g') ? r.re.flags : `${r.re.flags}g`;
    const m = out.match(new RegExp(r.re.source, flags));
    if (m) risks.push({ code: r.code, note: r.note, samples: [...new Set(m)].slice(0, 5) });
  }
  return { text: out, risks };
}

/** 口音落点：'mixed' 时按题序英/美交替（对齐高考混合口音趋势）；其余按策略直取 */
export function pickAccentForItem(policy = 'us', index = 0) {
  if (policy === 'gb') return 'gb';
  if (policy === 'mixed') return index % 2 === 0 ? 'us' : 'gb';
  return 'us';
}

/** 该条材料是否"长材料"（独白/短文）——按篇幅判定（≥20 词）。仅作**兜底**判据，
 *  有题号范围时以范围为准（见 isMultiQuestion）。 */
export const isLongMaterial = (item) => {
  const words = (item?.lines || [])
    .reduce((n, l) => n + String((l && l.text) || '').split(/\s+/).filter(Boolean).length, 0);
  return words >= 20;
};

/**
 * 该条材料是否"一段材料对应多题"——决定**两件事**：
 *   ① 是否播报"听第X段材料，回答第X～Y小题"；② 作答留白走"各小题 5 秒"档还是"每题 10 秒"档。
 * 🔴 判据优先级（2026-09-19 复核修正）：
 *   1) **源文本写明的题号范围（权威）**——真题原文就是靠"听第6段材料，回答第6至第10题"这一行
 *      宣告"这段材料对多题"的；范围跨 ≥2 题即成立。原实现只按篇幅判定，
 *      导致"源文本已给范围、但材料本身词数不多"时**把范围播报整条丢掉**（正是"没有题号提示"的成因）。
 *   2) 篇幅 ≥20 词（兜底）——源文本没给范围时的最小可判据。
 */
export const isMultiQuestion = (item) => {
  const r = item?.range;
  if (r && Number(r.from) > 0 && Number(r.to) > Number(r.from)) return true;
  return isLongMaterial(item);
};

/** 风险去重（同 code + 同出处只留一条，合并样本） */
function dedupeRisks(list = []) {
  const map = new Map();
  for (const r of list) {
    const k = `${r.code}@${r.where || ''}`;
    if (!map.has(k)) map.set(k, { ...r, samples: [...(r.samples || [])] });
    else for (const s of r.samples || []) if (!map.get(k).samples.includes(s)) map.get(k).samples.push(s);
  }
  return [...map.values()];
}

/**
 * 开场白文本（中文播报）。
 * 正规考试音频以固定播报「听力考试现在开始」起头（全国卷/中考录音原文均可证）；
 * **国标音频不朗读试卷标题**——故默认只播固定播报（2026-09-19 用户裁定"模型侧全部按正规的来"）。
 * 校/区级考试有播报考试名称的做法，需要时传 announceTitle:true 打开（标题里的生成时间戳会先净化，
 * 否则 TTS 会把 `_2026/9/19 13:20:14` 一并念出来）。
 * @param {string} title 试卷标题（可含时间戳后缀）
 * @param {object} [opts] { announceTitle?:boolean }
 * @returns {string} 可直接朗读的开场白
 */
/** 试卷标题净化：去扩展名 / 去生成时间戳 / 收多余空白。
 *  为什么必须净化：标题常带 `_2026/9/19 13:20:14`，直接播报会把时间戳一起念出来。 */
function cleanTitleForAnnounce(title = '') {
  return String(title || '')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')            // 去扩展名
    .replace(/[_\-\s]*\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}([ T]\d{1,2}[:：]\d{2}([:：]\d{2})?)?\s*$/, '') // 去生成时间戳
    .replace(/[_\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 试卷标题播报语（独立成段，放在全卷最前）。
 * 🔴 2026-09-19 用户实测稿定版：录音顺序为「试卷标题 → 第一部分 听力部分 → 大题指令 → 叮咚 → Number 1 → 材料…」，
 *   故标题**独立成段**、不再像早先那样并进开场白（"标题，听力考试现在开始。"）。
 */
export function buildTitleAnnouncement(title = '') {
  const clean = cleanTitleForAnnounce(title);
  return clean ? `${clean}。` : '';
}

/** 开场白文本（中文播报）：固定播报「听力考试现在开始」；标题已独立成段，不在此重复 */
export function buildOpeningAnnouncement() {
  return '听力考试现在开始。';
}

/** 试音起始提示语（固定文案，见 LISTENING_SOUND_CHECK.intro）；标题已独立成段，不在此重复 */
export function buildSoundCheckIntro() {
  return LISTENING_SOUND_CHECK.intro;
}

/**
 * 建分段脚本（单源）
 * @param {object} o
 * @param {Array<{no:(number|string),lines:Array<{role:'M'|'W'|'N',text:string}>,repeat?:number,instruction?:string}>} o.items
 * @param {string} o.intro  导语（中文播报；可空）
 * @param {string} o.title  试卷标题（用于开场白播报；可空）
 * @param {string} o.stage  学段（中文/五档键）
 * @param {string} o.grade  年级（初中据此细分语速）
 * @param {string} o.name   教材名（grade 缺失时兜底）
 * @param {object} o.overrides 覆盖参数（按考区）
 * @param {boolean} [o.soundCheck]          试音段开关（默认取 LISTENING_FEATURE_DEFAULTS.soundCheck=true）
 * @param {boolean} [o.announceShortItemNo] 一题一材料是否播小题号（默认 false＝国标口径）
 * @param {Array<string>} [o.voicePoolInput] 音色池 [男主, 女主, 男副?, 女副?]（用户显式指定时全书同一套）
 */
export function buildListeningStoryboard({
  items = [], intro = '', stage = '', grade = '', name = '', overrides = {}, title = '',
  announceTitle = LISTENING_FEATURE_DEFAULTS.announceTitle,
  soundCheck = LISTENING_FEATURE_DEFAULTS.soundCheck,
  announceShortItemNo = LISTENING_FEATURE_DEFAULTS.announceShortItemNo,
  partTitle = '',
  voicePoolInput = null,
} = {}) {
  const params = resolveListeningParams({ stage, grade, name, overrides });
  const segments = [];
  const risks = [];
  // 告警累加器（参数告警 + 材料级告警如"多角色但音色不够"）；在材料循环内即需写入，故提前声明
  const warnings = [...params.warnings];

  // 🎚 音色池（2026-09-19 用户裁定：男声/女声可配 + 多角色追加音色）
  //    形如 [男主, 女主, 男副?, 女副?]；显式指定后**全书用这一套**（不再按口音表逐段轮换）。
  //    未指定时退化为 [美音男主, 美音女主]，行为与旧版一致。
  const voicePool = (Array.isArray(voicePoolInput) ? voicePoolInput : [])
    .map((v) => String(v || '').trim()).filter(Boolean);
  const effectivePool = voicePool.length ? voicePool : [params.voices.us.M, params.voices.us.W];
  /** 对话里的英语音色：池里有就用池（男主/女主…），否则按口音表 */
  const enVoice = (label, accentSet) => {
    if (voicePool.length) return label === 'W' ? (voicePool[1] || voicePool[0]) : voicePool[0];
    return accentSet[label] || accentSet.N;
  };

  // ── 开场序列（中文播报）─────────────────────────────────────────
  // 🔴 2026-09-19 用户实测稿定版的顺序：
  //   ① 试卷标题（「六年级英语上册Unit 1 Try your best测试卷」）
  //   ② 试音三件套（开＝「下面是听力试音时间：」+ 一男一女试音对话 +「听力试音到此结束，听力考试现在开始。」；
  //      关＝单句开场白「听力考试现在开始。」）
  //   ③ 部分标题（「第一部分 听力部分。」）
  //   之后才进入各大题指令 → 叮咚 → 题号 → 材料。
  //   ① 与 ③ 都是用户明确要求读出的；①的标题净化沿用 cleanTitleForAnnounce（去时间戳）。
  const titleText = announceTitle ? buildTitleAnnouncement(title) : '';
  if (titleText) {
    segments.push({
      kind: 'title',
      voice: params.zhVoice,
      role: 'N',
      text: titleText,
      ratePercent: 0,
      gapAfterMs: params.pauses.afterTitleMs,
      chimeBefore: true,   // 全卷第一个提示音：正式开考
      itemNo: null,
      pass: 0,
    });
  }

  if (soundCheck) {
    segments.push({
      kind: 'soundcheck',
      voice: params.zhVoice,
      role: 'N',
      text: buildSoundCheckIntro(),
      ratePercent: 0,     // 中文播报不套用英文慢速
      gapAfterMs: 800,
      chimeBefore: !titleText,  // 无标题时由试音提示语承担全卷第一声
      itemNo: null,
      pass: 0,
    });
    const scLines = Array.isArray(LISTENING_SOUND_CHECK.lines) ? LISTENING_SOUND_CHECK.lines : [];
    scLines.forEach((ln, li) => {
      const { text, risks: r } = normalizeForSpeech(ln.text);
      risks.push(...r.map((x) => ({ ...x, where: '试音对话' })));
      segments.push({
        kind: 'soundcheck',
        voice: enVoice(ln.role, params.voices[params.accent === 'gb' ? 'gb' : 'us']),
        role: ln.role,
        text: String(text).trim(),
        ratePercent: params.ratePercent,   // 试音须与正文同速，学生才能据此校准
        gapAfterMs: li === scLines.length - 1 ? params.pauses.afterIntroMs : params.pauses.sentenceGapMs,
        itemNo: null,
        pass: 1,
      });
    });
    segments.push({
      kind: 'soundcheck',
      voice: params.zhVoice,
      role: 'N',
      text: LISTENING_SOUND_CHECK.toExam,
      ratePercent: 0,
      gapAfterMs: params.pauses.afterSectionInstructionMs,
      itemNo: null,
      pass: 0,
    });
  } else {
    segments.push({
      kind: 'opening',
      voice: params.zhVoice,
      role: 'N',
      text: buildOpeningAnnouncement(),
      ratePercent: 0,
      gapAfterMs: params.pauses.afterSectionInstructionMs,
      chimeBefore: !titleText,   // 无标题时由开场白承担全卷第一声
      itemNo: null,
      pass: 0,
    });
  }

  // ── ③ 部分标题（「第一部分 听力部分。」）──────────────────────────
  // 用户实测稿明确要求读出；英语卷听力必为第一部分，故取固定播报（见 LISTENING_PART_ANNOUNCEMENT），
  // 调用方传 partTitle 可覆盖。
  const partText = String(partTitle || LISTENING_PART_ANNOUNCEMENT || '').trim();
  if (partText) {
    segments.push({
      kind: 'part',
      voice: params.zhVoice,
      role: 'N',
      text: partText,
      ratePercent: 0,
      gapAfterMs: params.pauses.afterTitleMs,
      chimeBefore: false,   // 部分标题本身不响铃；叮咚落在每段材料前
      itemNo: null,
      pass: 0,
    });
  }

  // 节序列：首节指令来自 intro（若有），其余来自各条材料的 instruction（解析端已保证"节指令挂在该节首条"）
  const sectionInstrAt = new Map();
  if (intro && String(intro).trim()) sectionInstrAt.set(0, String(intro).trim());
  items.forEach((it, i) => {
    if (it.instruction && String(it.instruction).trim()) sectionInstrAt.set(i, String(it.instruction).trim());
  });

  // 🔴 同卷同类材料播报者一致（2026-09-19 用户实测根治）：实测第二节独白标了 W:（女声）、
  //    第三节短文未标注 → 落到"旁白"（男声），同一份卷中途换人，学生会以为换了说话人。
  //    处置：先扫出"单一说话人的长材料（独白/短文）"里第一条已标注的播报者，未标注的同类的材料沿用同一条音色。
  let soloLongRole = '';
  for (const it of items) {
    if (!isMultiQuestion(it)) continue;
    const roles = [...new Set((it.lines || [])
      .filter((l) => String(l && l.text || '').trim())
      .map((l) => String(l.role || 'N').toUpperCase()))];
    if (roles.length === 1 && (roles[0] === 'M' || roles[0] === 'W')) { soloLongRole = roles[0]; break; }
  }

  let prevItemLastSeg = -1;
  /** 逐题的音色分配（角色 → 音色）——朗读稿据此逐题列出"多音色配角色" */
  const voiceCast = [];
  items.forEach((item, i) => {
    const accent = pickAccentForItem(params.accent, i);
    // 显式音色池优先：池存在时全书同一套音色；否则按口音表（低美高混）逐段取
    const voiceSet = voicePool.length
      ? { M: voicePool[0], W: voicePool[1] || voicePool[0], N: voicePool[0] }
      : (params.voices[accent] || params.voices.us);
    const lines = Array.isArray(item.lines) ? item.lines.filter((l) => String(l && l.text || '').trim()) : [];
    if (!lines.length) return;
    const repeat = Number.isFinite(item.repeat) && item.repeat > 0 ? item.repeat : params.repeat;
    const isSectionStart = sectionInstrAt.has(i);
    /** 一段材料对应多题（有题号范围＝权威；否则按篇幅兜底）→ 播题号范围 + 走"各小题 5 秒"作答档 */
    const multiQ = isMultiQuestion(item);

    // 🔴 换节留白（2026-09-19）：原 betweenSectionsMs **配了却从未被使用**，节与节之间毫无分隔。
    //    换节处除了下一节指令前的提示音，再给上一节末尾补一段绝对静默。
    if (isSectionStart && prevItemLastSeg >= 0) {
      segments[prevItemLastSeg].gapAfterMs += params.pauses.betweenSectionsMs;
    }

    // 分节指令（第一节/第二节…）：中文播报，必须落在**该节材料之前**（保真实先后）
    if (isSectionStart) {
      const { text, risks: r } = normalizeForSpeech(sectionInstrAt.get(i));
      risks.push(...r.map((x) => ({ ...x, where: `第${item.no}题前指令` })));
      segments.push({
        kind: 'instruction',
        voice: params.zhVoice,
        role: 'N',
        text: String(text).trim(),
        ratePercent: 0,
        // 以指令为准：声明了读题秒数就用它（真题"每小题5秒钟阅读题目"），否则用"现在开始"后的固定停顿
        gapAfterMs: Number(item.previewSec) > 0 ? item.previewSec * 1000 : params.pauses.afterSectionInstructionMs,
        // 换节不响提示音：真题的"打点"（叮咚）只出现在**每段材料之前**，节指令本身不带
        //   （校内正规听力稿："第一节…→停顿 5 秒（叮咚铃声）→Text 1"）。若此处也响，
        //   会与首段材料的提示音在 2 秒内重复响两次。
        chimeBefore: false,
        itemNo: item.no,
        pass: 0,
      });
    }

    // 🔴 本条"起条段"的落点：大题指令已在上方单独处理（它属大题边界，不属小题），
    //    故此处起算的是**题号播报 / 材料**的起点——叮咚最终落在它的第一个发音段上。
    const itemFirstSeg = segments.length;

    // 🔴 题号播报（2026-09-19 复核后按国标定稿）：
    //      · 一段材料对多题（独白/短文）→ 报「听第N段材料，回答第X～Y小题」（国标原文写法）。
    //        两项用顿号、三项及以上用「至」——**照真题书面写法**，不用「～」符号（TTS 读不稳）。
    //        拿不到题号范围就**整条不报**（宁可不报，也不报错：原实现按条数顺编，实测把第三节
    //        报成了"第七题"，而该卷第三节实为第 11~15 题）。
    //      · 一题一材料（短材料）→ 播**英文题号「Number 1.」**（2026-09-19 用户实测稿定：
    //        "number one 不读第一小题"），由英语旁白音色读；由 announceShortItemNo 控制，默认开。
    //      · 一段材料对多题 → 报中文「听第N段材料，回答第X、Y小题」（国标原文写法），不受该开关影响。
    const itemNoText = (() => {
      if (!multiQ) return announceShortItemNo ? `Number ${item.no}.` : '';
      const r = item.range;
      if (!r || !r.from) return '';
      const from = Number(r.from);
      const to = Number(r.to) > from ? Number(r.to) : from;
      if (to === from) return `听第${item.no}段材料，回答第${from}小题。`;
      const span = to - from + 1;
      const tail = span === 2 ? `${from}、${to}` : `${from}至${to}`;
      return `听第${item.no}段材料，回答第${tail}小题。`;
    })();
    if (itemNoText) {
      segments.push({
        kind: 'itemno',
        // 一题一材料的英文题号（Number 1.）由**英语旁白音色**读；一段对多题的中文范围播报由中文播报音色读
        voice: multiQ ? params.zhVoice : voiceSet.N,
        role: 'N',
        text: itemNoText,
        ratePercent: 0,
        gapAfterMs: params.pauses.afterItemNoMs,
        // 叮咚落点见本条末尾统一赋值（落在"本条第一个发音段"上）
        chimeBefore: false,
        itemNo: item.no,
        pass: 0,
      });
    }

    // 🔴 说话人 → 音色（2026-09-19 用户追问"多角色怎么办"后定稿）：
    //    · 标了 M:/W: → 男主/女主音色；
    //    · 未标注/旁白 N → 男主音色（与男声同源，避免全书多出第三个"播音腔"）；
    //    · **未知但可辨识的标签**（A/B/C、S1/S2、说话人1…）→ 按首次出现顺序从**音色池**里取
    //      **尚未被占用**的那一个：两人对话＝男主+女主；三人对话且用户配了"男声副"就用第三个音色，
    //      没配则回落到男主（真题本就是两人读全部材料，回落不算错，只是听不出第三人）。
    //      绝不能把不同说话人折叠成同一音色——那是听力音频最易出的错。
    const speakers = [...new Set(lines.map((l) => String(l.role || 'N').toUpperCase()))];
    const isDialogue = speakers.length > 1;
    const usedVoices = new Set();
    const roleVoice = new Map();
    /** 从池里取一个"还没被占用"的音色并标记为已用；池用完则按顺序循环复用 */
    const takeFromPool = () => {
      const free = effectivePool.find((v) => !usedVoices.has(v));
      const picked = free || effectivePool[usedVoices.size % effectivePool.length];
      usedVoices.add(picked);
      return picked;
    };
    const voiceOf = (rawRole) => {
      const role = String(rawRole || 'N').toUpperCase();
      // 同卷独白/短文播报者一致：未标注的单一说话人长材料，沿用同卷首条已标注的播报者音色
      if (role === 'N' && multiQ && soloLongRole) { const v = voiceSet[soloLongRole] || voiceSet.N; usedVoices.add(v); return v; }
      if (role === 'M' || role === 'W' || role === 'N') { const v = voiceSet[role] || voiceSet.N; usedVoices.add(v); return v; }
      if (!isDialogue) { usedVoices.add(voiceSet.N); return voiceSet.N; }
      if (!roleVoice.has(role)) roleVoice.set(role, takeFromPool());
      return roleVoice.get(role);
    };

    // 🔴 三遍轮读音色（2026-09-19 调研新增，见 LISTENING_TRIPLE_PASS_ROTATION）：
    //    读三遍的**单说话人**材料按 男→女→男 轮换（实证：小学听力要求原文"男、女、男声中速各读一遍"）；
    //    读两遍仍为同一音色（同一说话人重读一遍，真题即如此，换人反而是错的）；对话按角色分音色、不轮读。
    const rotateTriple = LISTENING_TRIPLE_PASS_ROTATION && repeat >= 3 && !isDialogue;
    /** 本条的音色分配（角色 → 音色，按首次出现顺序）——供朗读稿"多音色配角色"呈现与界面摘要 */
    const castEntries = [];
    const castSeen = new Set();
    for (let pass = 1; pass <= repeat; pass++) {
      lines.forEach((ln, li) => {
        const role = String(ln.role || 'N').toUpperCase();
        const { text, risks: r } = normalizeForSpeech(ln.text);
        risks.push(...r.map((x) => ({ ...x, where: `第${item.no}题` })));
        // 🔴 卷面/答案残留守卫：英语听力材料不可能是中文——非导语段若以中文为主直接跳过，
        //   不读"一、听录音…/评分/范文"这类噪音（源节截取之外的兜底，见 listeningExtract）。
        if (isCjkNoise(text)) return;
        const isPassEnd = li === lines.length - 1;
        // 三遍轮读：奇数遍男声、偶数遍女声（男→女→男）
        const speakRole = rotateTriple ? (pass % 2 === 1 ? 'M' : 'W') : role;
        const speakVoice = voiceOf(speakRole);
        // 记录"角色 → 音色"（同一角色只记一次；三遍轮读天然会记 2 条：男、女）
        const castKey = `${speakRole}\u0000${speakVoice}`;
        if (!castSeen.has(castKey)) { castSeen.add(castKey); castEntries.push({ role: speakRole, voice: speakVoice }); }
        segments.push({
          kind: pass === 1 ? 'material' : 'repeat',
          voice: speakVoice,
          role: speakRole,
          text: String(text).trim(),
          ratePercent: params.ratePercent,
          chimeBefore: false,   // 叮咚落点见本条末尾统一赋值
          // 同一材料两遍之间用较长间隙；材料内部句/轮之间用短间隙（停顿的"顿挫感"主要来自这里，故取小值）
          gapAfterMs: isPassEnd && pass < repeat ? params.pauses.betweenRepeatsMs : params.pauses.sentenceGapMs,
          itemNo: item.no,
          pass,
        });
      });
    }
    voiceCast.push({ itemNo: item.no, entries: castEntries });
    // 🔴 多角色但音色不够：如实告警（用户据此决定是否去配"男声副/女声副"）
    if (castEntries.length > effectivePool.length) {
      warnings.push(`第 ${item.no} 题有 ${castEntries.length} 个角色（${castEntries.map((c) => roleLabel(c.role)).join('、')}），但只配了 ${effectivePool.length} 个音色 —— 多出的角色会沿用已有音色；如需一人一声，请在弹窗里补配"男声副/女声副"`);
    }
    // 作答留白：挂到本题最后一段。以指令为准（声明了作答秒数就用它），否则按材料形态分档。
    // 🔴 需**动笔写词**的题（补全短文/填空）单独一档：5 秒档是给"听独白做判断"的，
    //    写 5 个词根本来不及（用户实测指出）——判据取本节指令里的"补全/填空/每空"。
    const declaredAnswerMs = Number(item.answerSec) > 0 ? item.answerSec * 1000 : 0;
    const isFillIn = /补全|填空|填词|每空/.test(sectionInstrAt.get(i) || '');
    const answerGap = declaredAnswerMs
      || (isFillIn
        ? params.pauses.fillInAnswerGapMs
        : (multiQ ? params.pauses.longMaterialAnswerGapMs : params.answerGapMs));
    const last = segments[segments.length - 1];
    if (last && last.itemNo === item.no) last.gapAfterMs = answerGap;
    // 🔴 提示音（叮咚）＝"一小题结束"的边界音（2026-09-19 用户实测稿定版：
    //    "一小题结束 叮咚，遍与遍之间不叮咚"）：
    //    落在本条的**第一个发音段**上——有题号播报就在题号之前（「…→叮咚→Number 2→材料」），
    //    没有题号就在材料之前；同一材料的两遍之间不响；大题指令属大题边界、不在其列。
    if (segments.length > itemFirstSeg) segments[itemFirstSeg].chimeBefore = true;
    prevItemLastSeg = segments.length - 1;
  });

  // ── 结束语（中文播报）─────────────────────────────────────────────
  // 依据：考务规定听力结束时播出「听力部分到此结束」提示语（如广东省高考外语听力考务要求）。
  segments.push({
    kind: 'closing',
    voice: params.zhVoice,
    role: 'N',
    text: '听力部分到此结束。',
    ratePercent: 0,
    gapAfterMs: 0,
    itemNo: null,
    pass: 0,
  });

  // 🔴 以指令为准：分节指令声明的遍数会覆盖学段默认（真题第一节与第二节遍数常不同，如高考
  //    第一节仅读一遍、第二节读两遍）。偏离必须显式登记——否则"音频遍数与播报不符"无人察觉。
  const deviated = items.filter((it) => Number.isFinite(it.repeat) && it.repeat > 0 && it.repeat !== params.repeat);
  if (deviated.length) {
    const byRepeat = new Map();
    for (const it of deviated) {
      if (!byRepeat.has(it.repeat)) byRepeat.set(it.repeat, []);
      byRepeat.get(it.repeat).push(it.no);
    }
    for (const [r, nos] of byRepeat) {
      warnings.push(`第 ${nos.join('、')} 题按播音指令读 ${r} 遍（学段默认 ${params.repeat} 遍）——音频以指令为准`);
    }
  }

  return { segments, params, risks: dedupeRisks(risks), warnings, voiceCast, voicePool: effectivePool };
}

/**
 * 渲染为 SSML（可直接粘进 TTS 引擎出音频）
 * @returns {{ ssml:string, params:object, risks:Array, warnings:Array }}
 */
export function buildListeningSsml(input = {}) {
  const { segments, params, risks, warnings } = buildListeningStoryboard(input);
  const body = segments.map((s) => {
    const voice = `    <voice name="${s.voice}">\n`
      + `      <prosody rate="${s.ratePercent}%">${escapeXml(s.text)}</prosody>\n`
      + '    </voice>';
    return s.gapAfterMs ? `${voice}\n    <break time="${s.gapAfterMs}ms"/>` : voice;
  }).join('\n');

  const ssml = '<speak version="1.0" '
    + 'xmlns="http://www.w3.org/2001/10/synthesis" '
    + 'xmlns:mstts="https://www.w3.org/2001/mstts" '
    + 'xml:lang="en-US">\n'
    + `${body}\n`
    + '</speak>';

  return { ssml, params, risks, warnings };
}

/**
 * 渲染为朗读稿（给人 / 真人录音 / 剪映分角色配音；含角色与停顿提示，无引擎语法）
 * @param {object} input 同上，另可传 stageLabel（界面已有的中文学段名，避免重复维护标签表）
 * @returns {{ text:string, params:object, risks:Array, warnings:Array }}
 */
export function buildListeningScriptText(input = {}) {
  const { stageLabel = '', ...rest } = input;
  const { segments, params, risks, warnings, voiceCast = [], voicePool = [] } = buildListeningStoryboard(rest);
  const out = [];

  const accentName = params.accent === 'mixed' ? '美音/英音交替'
    : params.accent === 'gb' ? '英音' : '美音';
  const stageName = stageLabel || params.stageKey;

  out.push('【英语听力朗读稿 · 供录音 / 配音使用】');
  out.push(`学段：${stageName}　语速：${params.wpm} 词/分　口音：${accentName}`);
  // 遍数按**实际生效值**呈现：分节指令声明的遍数优先（真题各节遍数常不同），与 audio 一致
  const byRepeat = new Map();
  for (const it of (Array.isArray(rest.items) ? rest.items : [])) {
    const r = Number.isFinite(it.repeat) && it.repeat > 0 ? it.repeat : params.repeat;
    if (!byRepeat.has(r)) byRepeat.set(r, []);
    byRepeat.get(r).push(it.no);
  }
  const repeatDesc = byRepeat.size <= 1
    ? `每段材料读 ${params.repeat} 遍`
    : [...byRepeat.entries()].sort((a, b) => a[0] - b[0])
      .map(([r, nos]) => `第 ${nos.join('、')} 题读 ${r} 遍`).join('；');
  // 三遍轮读音色是否在本卷实际生效（读三遍 且 单说话人）——仅该情形才追加对应录制提示
  const rotateTripleUsed = LISTENING_TRIPLE_PASS_ROTATION
    && (Array.isArray(rest.items) ? rest.items : []).some((it) => {
      const r = Number.isFinite(it.repeat) && it.repeat > 0 ? it.repeat : params.repeat;
      if (r < 3) return false;
      const roles = [...new Set((it.lines || []).map((l) => String((l && l.role) || 'N').toUpperCase()))];
      return roles.length <= 1;
    });
  out.push(`遍数：${repeatDesc}　题间作答留白：${Math.round(params.answerGapMs / 1000)} 秒`);
  // 🎚 音色（2026-09-19 用户要求"用户能立即知道是否有多角色"）：列出**生效音色池**，
  //    并逐题给出"角色 → 音色"分配（见下方每题块首行），多角色题一眼可见用了几个音色。
  out.push(`音色：${voicePool.map((v) => voiceLabel(v)).join('　｜　')}`);
  const castByItem = new Map(voiceCast.map((c) => [c.itemNo, c.entries || []]));
  // "角色"只数真正的说话人（N＝旁白/独白，不是角色）；若无标注角色则按 1 个（旁白）计
  const roleSet = new Set(voiceCast.flatMap((c) => (c.entries || []).map((e) => e.role)).filter((r) => r !== 'N'));
  const speakerCount = roleSet.size || (voiceCast.length ? 1 : 0);
  out.push(`说话人：全书 ${speakerCount} 个角色　｜　${voicePool.length} 条音色${speakerCount > voicePool.length ? '　⚠️ 角色多于音色，多出的角色会沿用已有音色（可在弹窗补配"男声副/女声副"）' : ''}`);
  out.push('');

  let currentItem = '__none__';
  for (const s of segments) {
    if (s.kind === 'opening') {
      out.push('──── 开场白（中文播报）────');
      out.push(s.text);
      out.push('');
      currentItem = '__none__';
      continue;
    }
    if (s.kind === 'closing') {
      out.push('──── 结束语（中文播报）────');
      out.push(s.text);
      out.push('');
      currentItem = '__none__';
      continue;
    }
    if (s.kind === 'intro') {
      out.push('──── 导语（中文播报）────');
      out.push(s.text);
      out.push('');
      currentItem = '__none__';
      continue;
    }
    if (s.kind === 'instruction') {
      if (out[out.length - 1] !== '') out.push('');
      out.push('──── 分节指令（中文播报）────');
      out.push(s.text);
      out.push('');
      currentItem = '__none__';
      continue;
    }
    // 试卷标题 / 部分标题：均为中文播报，各自成段（真人录音也要照读）
    if (s.kind === 'title' || s.kind === 'part') {
      const label = s.kind === 'title' ? '试卷标题（中文播报）' : '部分标题（中文播报）';
      if (out[out.length - 1] !== '') out.push('');
      out.push(`──── ${label} ────`);
      out.push(s.text);
      out.push('');
      currentItem = '__none__';
      continue;
    }
    // 试音段（中文播报 + 一男一女试音对话）：正规录音的独立前置环节，见 LISTENING_SOUND_CHECK
    if (s.kind === 'soundcheck') {
      if (currentItem !== '__sc__') {
        if (out[out.length - 1] !== '') out.push('');
        out.push('──── 试音（中文播报 + 英文对话）────');
        currentItem = '__sc__';
      }
      out.push(s.role === 'N' ? s.text : `${roleLabel(s.role)}：${s.text}`);
      continue;
    }
    if (s.itemNo !== currentItem) {
      if (currentItem !== '__none__') out.push('');
      out.push(`──── 第 ${s.itemNo} 题 ────`);
      // 🎚 该题的音色分配：多角色题一眼可见"几个角色、各用哪条音色"（单角色题也标出来，便于核对）
      const cast = castByItem.get(s.itemNo);
      if (cast && cast.length) {
        out.push(`（音色）${cast.map((c) => `${roleLabel(c.role)} → ${voiceLabel(c.voice)}`).join('　｜　')}`);
      }
      currentItem = s.itemNo;
    }
    // 题号播报（中文）——真人录音也要照读，学生才知道这是第几题
    if (s.kind === 'itemno') {
      out.push(`〔题号播报〕${s.text}`);
      continue;
    }
    const roleName = roleLabel(s.role);
    // 第二遍起标注，避免真人/剪辑重复录
    const passTag = s.pass > 1 ? `〔第${s.pass}遍〕` : '';
    out.push(`${passTag}${roleName}：${s.text}`);
  }

  out.push('');
  out.push('【录制提示】');
  // 与正文同一口径：遍数按实际生效值（分节指令优先），不得写成与音频不符的"一律两遍"
  out.push(`· 遍数：${repeatDesc}；材料连读两遍之间停 ${params.pauses.betweenRepeatsMs} ms`);
  out.push(`· 换节：节间留白 ${params.pauses.betweenSectionsMs} ms、指令后停 ${params.pauses.afterSectionInstructionMs} ms；一段材料对多题（独白/短文）按"各小题 5 秒"档留作答，短材料按学段档；节指令声明了秒数则以声明为准`);
  out.push(`· 题号播报：一段材料对多题处按真题写法读「听第X段材料，回答第X～Y小题」（见〔题号播报〕）${rest.announceShortItemNo !== false ? '；一题一材料处读英文「Number N.」' : '；一题一材料处**不读题号**'}`);
  out.push('· 提示音（叮咚）＝"打点"：**每段材料开始前响一次**（真题"不读小标题 Text，从打点开始"）；同一材料的第二/三遍之间**不响**（2026 新版高考明文"两遍之间无提示音"）；节指令与题号播报本身不响');
  out.push('· 同一角色全卷使用同一音色，保持语速一致，避免音色与语速漂移');
  if (rotateTripleUsed) {
    out.push('· 读三遍的单说话人材料按「男 → 女 → 男」轮换音色（依据：小学听力要求原文"男、女、男声中速各读一遍"）；读两遍仍为同一音色');
  }
  if (params.stageKey === 'high') {
    out.push('· 高中学段不得压低语速——高考要求含自然连读、弱读，压速会消解自然语流');
  }

  if (risks.length) {
    out.push('');
    out.push('【需人工确认的朗读项】（同形多义，系统未自动改写，请确认读法）');
    for (const r of risks) out.push(`· ${r.where}：${r.note} —— ${r.samples.join('、')}`);
  }

  return { text: out.join('\n'), params, risks, warnings };
}

export default {
  escapeXml,
  normalizeForSpeech,
  pickAccentForItem,
  isLongMaterial,
  isMultiQuestion,
  voiceLabel,
  roleLabel,
  buildOpeningAnnouncement,
  buildSoundCheckIntro,
  buildTitleAnnouncement,
  buildListeningStoryboard,
  buildListeningSsml,
  buildListeningScriptText,
};
