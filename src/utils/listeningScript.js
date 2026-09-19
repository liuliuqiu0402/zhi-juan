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
} from '../config/listeningAudioProfile.js';
import { isCjkNoise } from './listeningExtract.js';

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
 * 校/区级考试常在前面播报考试名称，故此处把试卷标题作为限定语拼在固定播报之前。
 * ⚠️ 标题来自记录名（常带 `_2026/9/19 13:20:14` 之类生成时间戳），必须先净化，
 *    否则 TTS 会把时间戳一并念出来（且含冒号/斜杠，听感与文件名同样不友好）。
 * @param {string} title 试卷标题（可含时间戳后缀）
 * @returns {string} 可直接朗读的开场白
 */
export function buildOpeningAnnouncement(title = '') {
  const clean = String(title || '')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')            // 去扩展名
    .replace(/[_\-\s]*\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}([ T]\d{1,2}[:：]\d{2}([:：]\d{2})?)?\s*$/, '') // 去生成时间戳
    .replace(/[_\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? `${clean}，听力考试现在开始。` : '听力考试现在开始。';
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
 */
export function buildListeningStoryboard({
  items = [], intro = '', stage = '', grade = '', name = '', overrides = {}, title = '',
} = {}) {
  const params = resolveListeningParams({ stage, grade, name, overrides });
  const segments = [];
  const risks = [];

  // ── 开场白（中文播报）─────────────────────────────────────────────
  // 调研依据（2026-09-19）：全国卷/中考听力录音原文均以「听力考试现在开始」这一固定播报起头；
  //   校/区级考试常在其前加**考试名称**，学生据此确认"这是哪份卷的听力"。
  //   🔴 国标音频本身不朗读试卷标题，故此处把标题作为**开场白的限定语**而非独立标题行。
  const openingText = buildOpeningAnnouncement(title);
  segments.push({
    kind: 'opening',
    voice: params.zhVoice,
    role: 'N',
    text: openingText,
    // 中文播报不套用英文慢速（慢速中文很别扭）
    ratePercent: 0,
    gapAfterMs: params.pauses.afterIntroMs,
    itemNo: null,
    pass: 0,
  });

  if (intro && String(intro).trim()) {
    const { text, risks: r } = normalizeForSpeech(intro);
    risks.push(...r.map((x) => ({ ...x, where: '导语' })));
    segments.push({
      kind: 'intro',
      voice: params.zhVoice,
      role: 'N',
      text: String(text).trim(),
      // 🔴 中文导语不套用英文慢速：按自然语速播报，否则"慢速中文"很别扭
      ratePercent: 0,
      gapAfterMs: params.pauses.afterIntroMs,
      itemNo: null,
      pass: 0,
    });
  }

  items.forEach((item, i) => {
    const accent = pickAccentForItem(params.accent, i);
    const voiceSet = params.voices[accent] || params.voices.us;
    const lines = Array.isArray(item.lines) ? item.lines.filter((l) => String(l && l.text || '').trim()) : [];
    if (!lines.length) return;
    const repeat = Number.isFinite(item.repeat) && item.repeat > 0 ? item.repeat : params.repeat;

    // 分节指令（第一节/第二节…）：中文播报，且必须落在**该节材料之前**（保真实先后）
    if (item.instruction && String(item.instruction).trim()) {
      const { text, risks: r } = normalizeForSpeech(item.instruction);
      risks.push(...r.map((x) => ({ ...x, where: `第${item.no}题前指令` })));
      segments.push({
        kind: 'instruction',
        voice: params.zhVoice,
        role: 'N',
        text: String(text).trim(),
        ratePercent: 0,
        gapAfterMs: params.pauses.sentenceGapMs,
        itemNo: item.no,
        pass: 0,
      });
    }

    // 🔴 说话人 → 音色：M/W/N 直取；**未知但可辨识的标签**（A/B、S1/S2、说话人1…）不折叠成 N——
    //    对话里按首次出现顺序交替男/女（考试短对话惯例一男一女），独白里一律用旁白音色。
    //    否则双人对话会退化成单一音色，听不出谁在说（听力音频最易出的错）。
    const speakers = [...new Set(lines.map((l) => String(l.role || 'N').toUpperCase()))];
    const isDialogue = speakers.length > 1;
    const genderMap = new Map();
    const voiceOf = (rawRole) => {
      const role = String(rawRole || 'N').toUpperCase();
      if (role === 'M' || role === 'W' || role === 'N') return voiceSet[role] || voiceSet.N;
      if (!isDialogue) return voiceSet.N;
      if (!genderMap.has(role)) genderMap.set(role, genderMap.size % 2 === 0 ? 'M' : 'W');
      return voiceSet[genderMap.get(role)] || voiceSet.N;
    };

    for (let pass = 1; pass <= repeat; pass++) {
      lines.forEach((ln, li) => {
        const role = String(ln.role || 'N').toUpperCase();
        const { text, risks: r } = normalizeForSpeech(ln.text);
        risks.push(...r.map((x) => ({ ...x, where: `第${item.no}题` })));
        // 🔴 卷面/答案残留守卫：英语听力材料不可能是中文——非导语段若以中文为主直接跳过，
        //   不读"一、听录音…/评分/范文"这类噪音（源节截取之外的兜底，见 listeningExtract）。
        if (isCjkNoise(text)) return;
        const isPassEnd = li === lines.length - 1;
        segments.push({
          kind: pass === 1 ? 'material' : 'repeat',
          voice: voiceOf(role),
          role,
          text: String(text).trim(),
          ratePercent: params.ratePercent,
          // 同一材料两遍之间用较长间隙；材料内部句间用短间隙
          gapAfterMs: isPassEnd && pass < repeat ? params.pauses.betweenRepeatsMs : params.pauses.sentenceGapMs,
          itemNo: item.no,
          pass,
        });
      });
    }
    // 作答留白：挂到本题最后一段
    const last = segments[segments.length - 1];
    if (last && last.itemNo === item.no) last.gapAfterMs = params.answerGapMs;
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
  const warnings = [...params.warnings];
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

  return { segments, params, risks: dedupeRisks(risks), warnings };
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
  const { segments, params, risks, warnings } = buildListeningStoryboard(rest);
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
  out.push(`遍数：${repeatDesc}　题间作答留白：${Math.round(params.answerGapMs / 1000)} 秒`);
  const v = params.voices.us;
  out.push(`音色：男 ${v.M} ｜ 女 ${v.W} ｜ 旁白 ${v.N}`);
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
    if (s.itemNo !== currentItem) {
      if (currentItem !== '__none__') out.push('');
      out.push(`──── 第 ${s.itemNo} 题 ────`);
      currentItem = s.itemNo;
    }
    const roleName = LISTENING_ROLE_LABELS[s.role] || '旁白';
    // 第二遍起标注，避免真人/剪辑重复录
    const passTag = s.pass > 1 ? `〔第${s.pass}遍〕` : '';
    out.push(`${passTag}${roleName}：${s.text}`);
  }

  out.push('');
  out.push('【录制提示】');
  // 与正文同一口径：遍数按实际生效值（分节指令优先），不得写成与音频不符的"一律两遍"
  out.push(`· 遍数：${repeatDesc}；材料连读两遍之间停 ${params.pauses.betweenRepeatsMs} ms，每段读完后留 ${Math.round(params.answerGapMs / 1000)} 秒作答`);
  out.push('· 同一角色全卷使用同一音色，保持语速一致，避免音色与语速漂移');
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
  buildOpeningAnnouncement,
  buildListeningStoryboard,
  buildListeningSsml,
  buildListeningScriptText,
};
