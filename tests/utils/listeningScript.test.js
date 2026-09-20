import { describe, it, expect } from 'vitest';
import {
  LISTENING_STAGE_WPM,
  LISTENING_STAGE_WPM_RANGE,
  LISTENING_GRADE_WPM,
  LISTENING_HIGH_MIN_WPM,
  LISTENING_ACCENT_POLICY,
  LISTENING_BASE_WPM,
  LISTENING_VOICES,
  LISTENING_VOICE_CANDIDATES,
  LISTENING_VOICE_DEFAULTS,
  LISTENING_SOUND_CHECK,
  LISTENING_FEATURE_DEFAULTS,
  LISTENING_PAUSE,
  LISTENING_ANSWER_GAP_RANGE,
  LISTENING_PART_ANNOUNCEMENT,
  LISTENING_ZH_VOICE,
  LISTENING_MIXED_TITLE_VOICE,
  resolveListeningParams,
  missingListeningStages,
} from '../../src/config/listeningAudioProfile.js';
import {
  buildListeningStoryboard,
  buildListeningSsml,
  buildListeningScriptText,
  normalizeForSpeech,
  normalizeSectionLabel,
  splitMixedLanguageRuns,
  intToEnglishWords,
  digitsToEnglishWords,
  pickAccentForItem,
  isMultiQuestion,
  buildOpeningAnnouncement,
  buildSoundCheckIntro,
  buildTitleAnnouncement,
  escapeXml,
} from '../../src/utils/listeningScript.js';

/**
 * 英语听力音频参数与听力稿生成（2026-09-16 用户定版）
 * 锁定：学段差异化语速、高中学段不压速、角色分音色且保序、
 *      角色标记不得进 TTS 输入、同形多义项不自动改写。
 */
const DIALOG = {
  no: 1,
  lines: [
    { role: 'M', text: 'Excuse me, where is the library?' },
    { role: 'W', text: "It's next to the bank." },
  ],
};

/**
 * 仅取**材料段**（排除开场白/分节指令/结束语等中文播报段）。
 * 2026-09-19 起 storyboard 按正规考试音频格式补齐了中文框架段，故"材料映射"类断言须显式限定范围，
 * 否则会被框架段的音色/间隙污染（框架段本身另有用例单独锁定）。
 */
const onlyMaterial = (segments = []) => segments.filter((s) => s.kind === 'material' || s.kind === 'repeat');

describe('听力参数矩阵：学段必须差异化，不得千篇一律', () => {
  it('五档学段参数齐备（新增学段不漏配）', () => {
    expect(missingListeningStages()).toEqual([]);
  });

  it('小学三档语速递增；初中按年级递增；高中高于初中', () => {
    expect(LISTENING_STAGE_WPM.primary_low).toBeLessThan(LISTENING_STAGE_WPM.primary_mid);
    expect(LISTENING_STAGE_WPM.primary_mid).toBeLessThan(LISTENING_STAGE_WPM.primary_high);
    expect(LISTENING_GRADE_WPM[7]).toBeLessThan(LISTENING_GRADE_WPM[8]);
    expect(LISTENING_GRADE_WPM[8]).toBeLessThan(LISTENING_GRADE_WPM[9]);
    expect(LISTENING_STAGE_WPM.high).toBeGreaterThan(LISTENING_STAGE_WPM.middle);
  });

  it('初中同属 middle 学段，但七/八年级语速必须能区分', () => {
    const g7 = resolveListeningParams({ stage: '初中', grade: '七年级' });
    const g8 = resolveListeningParams({ stage: '初中', grade: '八年级' });
    const g9 = resolveListeningParams({ stage: '初中', grade: '九年级' });
    expect([g7.stageKey, g8.stageKey, g9.stageKey]).toEqual(['middle', 'middle', 'middle']);
    expect(g7.wpm).toBe(LISTENING_GRADE_WPM[7]);
    expect(g8.wpm).toBe(LISTENING_GRADE_WPM[8]);
    expect(g9.wpm).toBe(LISTENING_GRADE_WPM[9]);
    expect(new Set([g7.wpm, g8.wpm, g9.wpm]).size).toBe(3);
  });

  it('小学按年级归到正确档位', () => {
    expect(resolveListeningParams({ stage: '小学', grade: '二年级' }).stageKey).toBe('primary_low');
    expect(resolveListeningParams({ stage: '小学', grade: '四年级' }).stageKey).toBe('primary_mid');
    expect(resolveListeningParams({ stage: '小学', grade: '六年级' }).stageKey).toBe('primary_high');
  });

  it('wpm → SSML rate 百分比换算正确（基准语速单一常量）', () => {
    expect(resolveListeningParams({ stage: '小学', grade: '二年级' }).ratePercent)
      .toBe(Math.round((80 / LISTENING_BASE_WPM - 1) * 100));
    expect(resolveListeningParams({ stage: '初中', grade: '八年级' }).ratePercent)
      .toBe(Math.round((120 / LISTENING_BASE_WPM - 1) * 100));
  });
});

describe('高中语速不得压低（保连读/弱读自然语流）', () => {
  it('高中覆盖值低于下限时被钳制并告警', () => {
    const p = resolveListeningParams({ stage: '高中', overrides: { wpm: 100 } });
    expect(p.wpm).toBe(LISTENING_HIGH_MIN_WPM);
    expect(p.warnings.join()).toContain('连读弱读');
  });

  it('高中默认语速不低于下限', () => {
    expect(resolveListeningParams({ stage: '高中' }).wpm).toBeGreaterThanOrEqual(LISTENING_HIGH_MIN_WPM);
  });

  it('非高中学段不做该钳制（小学本就要慢）', () => {
    const p = resolveListeningParams({ stage: '小学', grade: '二年级', overrides: { wpm: 70 } });
    expect(p.wpm).toBe(70);
  });
});

describe('口音策略：低美高混', () => {
  it('小学/初中默认美音，高中默认英音美音交替', () => {
    expect(LISTENING_ACCENT_POLICY.primary_mid).toBe('us');
    expect(LISTENING_ACCENT_POLICY.middle).toBe('us');
    expect(LISTENING_ACCENT_POLICY.high).toBe('mixed');
  });

  it('mixed 按题序交替，其余直取', () => {
    expect(pickAccentForItem('mixed', 0)).toBe('us');
    expect(pickAccentForItem('mixed', 1)).toBe('gb');
    expect(pickAccentForItem('mixed', 2)).toBe('us');
    expect(pickAccentForItem('us', 3)).toBe('us');
    expect(pickAccentForItem('gb', 0)).toBe('gb');
  });

  it('高中相邻两题实际落到不同口音音色', () => {
    const { segments } = buildListeningStoryboard({
      stage: '高中',
      items: [DIALOG, { ...DIALOG, no: 2 }],
    });
    const first = segments.find((s) => s.itemNo === 1 && s.role === 'M');
    const second = segments.find((s) => s.itemNo === 2 && s.role === 'M');
    expect(first.voice).toBe(LISTENING_VOICES.us.M);
    expect(second.voice).toBe(LISTENING_VOICES.gb.M);
  });
});

describe('对话按角色分音色且逐句保序', () => {
  it('每句一个 voice，顺序与原文一致（不按角色分组打乱）', () => {
    const { segments } = buildListeningStoryboard({
      stage: '初中',
      grade: '八年级',
      items: [{ no: 1, lines: [
        { role: 'M', text: 'A1' },
        { role: 'W', text: 'B1' },
        { role: 'M', text: 'A2' },
      ] }],
    });
    const material = onlyMaterial(segments);
    const voices = material.map((s) => s.voice);
    expect(voices).toEqual([
      LISTENING_VOICES.us.M, LISTENING_VOICES.us.W, LISTENING_VOICES.us.M,
      LISTENING_VOICES.us.M, LISTENING_VOICES.us.W, LISTENING_VOICES.us.M,
    ]);
    expect(material.map((s) => s.text)).toEqual(['A1', 'B1', 'A2', 'A1', 'B1', 'A2']);
  });

  it('每段材料读两遍；两遍之间用较长间隙、句间用短间隙', () => {
    const { segments, params } = buildListeningStoryboard({ stage: '初中', grade: '八年级', items: [DIALOG] });
    expect(params.repeat).toBe(2);
    const material = onlyMaterial(segments);
    expect(material).toHaveLength(4);
    expect(material[0].gapAfterMs).toBe(params.pauses.sentenceGapMs);
    expect(material[1].gapAfterMs).toBe(params.pauses.betweenRepeatsMs);
  });

  it('作答留白挂在本题最后一段，且高段留白更长', () => {
    const low = buildListeningStoryboard({ stage: '小学', grade: '二年级', items: [DIALOG] });
    const mid = buildListeningStoryboard({ stage: '初中', grade: '八年级', items: [DIALOG] });
    const lowMaterial = onlyMaterial(low.segments);
    expect(lowMaterial[lowMaterial.length - 1].gapAfterMs).toBe(low.params.answerGapMs);
    expect(mid.params.answerGapMs).toBeGreaterThan(low.params.answerGapMs);
  });
});

describe('SSML 渲染', () => {
  const ssml = () => buildListeningSsml({
    stage: '初中',
    grade: '八年级',
    intro: '听下面一段对话，回答问题。',
    items: [DIALOG],
  }).ssml;

  it('结构合法：speak 根 + voice + prosody + break', () => {
    const s = ssml();
    const { pauses } = resolveListeningParams({ stage: '初中', grade: '八年级' });
    expect(s.startsWith('<speak version="1.0"')).toBe(true);
    expect(s.trimEnd().endsWith('</speak>')).toBe(true);
    // 旁白/播报为男声（原 Aria 女声与女声 Jenny 同为女声 → 整卷只有女声）；
    // 具体音色名随预设走（默认"考试标准"预设＝男 ChristopherNeural），故从常量推导不写死
    expect(s).toContain(`<voice name="${LISTENING_VOICES.us.N}">`);
    expect(LISTENING_VOICES.us.N, '旁白与女声必须是不同音色').not.toBe(LISTENING_VOICES.us.W);
    // 基准已实测校准（LISTENING_BASE_WPM），八年级 120 词/分 → 百分比从常量推导，避免写死
    expect(s).toContain(`<prosody rate="${Math.round((120 / LISTENING_BASE_WPM - 1) * 100)}%">`);
    // 两遍之间的留白从常量推导（2026-09-19 二次校准：2 秒，防写死后再次与配置漂移）
    expect(s).toContain(`<break time="${pauses.betweenRepeatsMs}ms"/>`);
  });

  it('🔴 角色标记绝不进 SSML（否则会被引擎念出来）', () => {
    const s = ssml();
    expect(s).not.toMatch(/\bM:\s/);
    expect(s).not.toMatch(/\bW:\s/);
    expect(s).not.toContain('男：');
    expect(s).not.toContain('女：');
  });

  it('中文导语用中文音色且不套用英文慢速', () => {
    const s = ssml();
    expect(s).toContain('<voice name="zh-CN-XiaoxiaoNeural">');
    const introBlock = s.slice(s.indexOf('zh-CN-XiaoxiaoNeural'));
    expect(introBlock.slice(0, 200)).toContain('rate="0%"');
  });

  it('XML 特殊字符被转义（未转义会直接合成失败）', () => {
    const { ssml: s } = buildListeningSsml({
      stage: '初中', grade: '八年级',
      items: [{ no: 1, lines: [{ role: 'N', text: 'Tom & Jerry <are> "here"' }] }],
    });
    expect(s).toContain('Tom &amp; Jerry &lt;are&gt; &quot;here&quot;');
    expect(s).not.toContain('<are>');
  });

  it('storyboard 为空时仍产出合法空 SSML', () => {
    const { ssml: s } = buildListeningSsml({ stage: '初中', grade: '八年级', items: [] });
    expect(s).toContain('<speak');
    expect(s).toContain('</speak>');
  });
});

describe('朗读稿渲染（给人/真人录音/剪映）', () => {
  const { text } = buildListeningScriptText({
    stage: '初中',
    grade: '八年级',
    stageLabel: '初中',
    intro: '听下面一段对话，回答问题。',
    items: [DIALOG, { no: 2, lines: [{ role: 'N', text: 'Tom is a student.' }] }],
  });

  it('含角色中文名与题号分组，且不含引擎语法', () => {
    expect(text).toContain('第 1 题');
    expect(text).toContain('男：Excuse me, where is the library?');
    expect(text).toContain('女：It\'s next to the bank.');
    expect(text).toContain('旁白：Tom is a student.');
    expect(text).not.toContain('<voice');
    expect(text).not.toContain('<prosody');
  });

  it('标注遍数、语速、口音与作答留白（可照此录音）', () => {
    expect(text).toContain('每段材料读 2 遍');
    expect(text).toContain('120 词/分');
    expect(text).toContain('美音');
    expect(text).toContain('10 秒');
    expect(text).toContain('〔第2遍〕');
  });
});

describe('朗读化：安全替换 + 高风险只登记不改写', () => {
  it('定式缩写做安全替换', () => {
    expect(normalizeForSpeech('Mr. Smith and Dr. Brown, etc.').text)
      .toBe('Mister Smith and Doctor Brown, et cetera');
  });

  it('🔴 同形多义项不得自动改写（防音频与答案页文本不一致）', () => {
    const { text, risks } = normalizeForSpeech('He lives on St. James Road in 2024.');
    expect(text).toContain('St.');
    expect(text).toContain('2024');
    const codes = risks.map((r) => r.code);
    expect(codes).toContain('abbr-st');
    expect(codes).toContain('year-like');
  });

  it('风险项带出处与样本，供人工确认', () => {
    const { risks } = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: 3, lines: [{ role: 'N', text: 'It costs $5.50.' }] }],
    });
    expect(risks.length).toBeGreaterThan(0);
    expect(risks.every((r) => r.where === '第3题')).toBe(true);
    expect(risks.flatMap((r) => r.samples).join()).toContain('$');
  });

  // 🔴 2026-09-19：补全短文类若沿用卷面的下划线占位，TTS 会把 "___" 念成 underscore，
  //    实测表现即"音频与内容对不上"。源头契约（E4）已要求写全短文，此处锁住音频侧的兜底提示。
  it('🔴 下划线占位须登记为风险（不得静默念成 underscore）', () => {
    const { text, risks } = normalizeForSpeech('Tom is a ___ boy.');
    expect(text).toBe('Tom is a ___ boy.');   // 只登记、不改写
    expect(risks.map((r) => r.code)).toContain('blank-underscore');
  });
});

describe('转义工具', () => {
  it('覆盖 XML 五个敏感字符', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
});

/**
 * 🎙 正规考试音频格式（2026-09-19）：调研全国卷/中考听力录音原文与考务规定后补齐中文框架——
 *   开场固定播报（校/区级考试含考试名称）→ 分节中文指令 → 英文材料 → 「听力部分到此结束」。
 * 🔴 2026-09-19 用户实测稿定版顺序：试卷标题 → 试音（或开场白）→「第一部分 听力部分」→
 *   大题指令（照读卷面「一、」）→ 叮咚 → Number 1 → 材料…
 */
describe('正规音频格式：标题 / 开场白 / 部分标题 / 分节指令 / 结束语', () => {
  it('开场白＝固定播报「听力考试现在开始。」；标题已独立成段，不并进开场白', () => {
    expect(buildOpeningAnnouncement()).toBe('听力考试现在开始。');
  });

  it('试卷标题播报语独立成段，并净化生成时间戳', () => {
    expect(buildTitleAnnouncement('六年级英语上册Unit 1 阶段测评_2026/9/19 13:20:14'))
      .toBe('六年级英语上册Unit 1 阶段测评。');
    expect(buildTitleAnnouncement('Unit 1 测评_2026-09-19')).toBe('Unit 1 测评。');
    expect(buildTitleAnnouncement('听力卷.docx')).toBe('听力卷。');
    expect(buildTitleAnnouncement('')).toBe('');
    expect(buildTitleAnnouncement('   ')).toBe('');
  });

  it('storyboard 开场顺序：标题 → 试音提示语 → … → 部分标题；末段为结束语', () => {
    const { segments } = buildListeningStoryboard({
      stage: '初中', grade: '八年级', title: '八年级英语期中测评', items: [DIALOG],
    });
    // 默认读试卷标题 → 首段即标题（中文音色、不加英文慢速）
    expect(segments[0].kind).toBe('title');
    expect(segments[0].text).toBe('八年级英语期中测评。');
    expect(segments[0].voice).toBe('zh-CN-XiaoxiaoNeural');
    expect(segments[0].ratePercent).toBe(0);
    // 标题之后是试音提示语
    expect(segments[1].kind).toBe('soundcheck');
    expect(segments[1].text).toBe(LISTENING_SOUND_CHECK.intro);
    // 部分标题：「第一部分 听力部分。」（英语卷听力必为第一部分）
    const part = segments.find((s) => s.kind === 'part');
    expect(part.text).toBe(LISTENING_PART_ANNOUNCEMENT);
    expect(part.voice).toBe('zh-CN-XiaoxiaoNeural');
    // 顺序：标题 < 试音 < 部分标题 < 第一段材料（DIALOG 无大题指令，故以材料为界）
    const idx = (k) => segments.findIndex((s) => s.kind === k);
    expect(idx('title')).toBeLessThan(idx('soundcheck'));
    expect(idx('soundcheck')).toBeLessThan(idx('part'));
    expect(idx('part')).toBeLessThan(idx('material'));
    const last = segments[segments.length - 1];
    expect(last.kind).toBe('closing');
    expect(last.text).toBe('听力部分到此结束。');
    expect(last.voice).toBe('zh-CN-XiaoxiaoNeural');
    // 关掉标题开关 → 不再有 title 段，首段回到试音提示语
    const noTitle = buildListeningStoryboard({
      stage: '初中', grade: '八年级', title: '八年级英语期中测评', items: [DIALOG], announceTitle: false,
    });
    expect(noTitle.segments.filter((s) => s.kind === 'title')).toHaveLength(0);
    expect(noTitle.segments[0].kind).toBe('soundcheck');
    // 空标题时不产出 title 段（回退到试音/开场白承担全卷第一声）
    const emptyTitle = buildListeningStoryboard({ stage: '初中', grade: '八年级', items: [DIALOG] });
    expect(emptyTitle.segments.filter((s) => s.kind === 'title')).toHaveLength(0);
    expect(emptyTitle.segments[0].chimeBefore).toBe(true);
  });

  it('关掉试音段 → 退回单句开场白（校内小测形态）', () => {
    const noSc = buildListeningStoryboard({
      stage: '初中', grade: '八年级', title: '八年级英语期中测评', items: [DIALOG], soundCheck: false,
    });
    expect(noSc.segments.filter((s) => s.kind === 'soundcheck')).toHaveLength(0);
    // 仍有标题段，其后是单句开场白；部分标题照旧
    expect(noSc.segments[0].kind).toBe('title');
    const opening = noSc.segments.find((s) => s.kind === 'opening');
    expect(opening.text).toBe('听力考试现在开始。');
    expect(noSc.segments.find((s) => s.kind === 'part').text).toBe(LISTENING_PART_ANNOUNCEMENT);
  });

  it('分节指令用中文音色，且落在该节材料之前（不打乱先后）', () => {
    const { segments } = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [
        { no: 1, instruction: '第一节，听下面5段对话。每段对话仅读一遍。', lines: [{ role: 'M', text: 'Hi.' }] },
      ],
    });
    const iInstruction = segments.findIndex((s) => s.kind === 'instruction');
    const iMaterial = segments.findIndex((s) => s.kind === 'material');
    expect(iInstruction).toBeGreaterThan(-1);
    expect(iInstruction).toBeLessThan(iMaterial);
    expect(segments[iInstruction].voice).toBe('zh-CN-XiaoxiaoNeural');
    expect(segments[iInstruction].ratePercent).toBe(0);
  });

  it('🔴 中文噪音段进不了英文材料（英语听力材料不可能是中文）', () => {
    const { segments } = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: 1, lines: [
        { role: 'N', text: '第一部分 听力部分（共3大题，满分30分）' },
        { role: 'N', text: 'Attention, please! Here is a notice.' },
      ] }],
    });
    const texts = segments.filter((s) => s.kind === 'material').map((s) => s.text);
    expect(texts).toEqual(['Attention, please! Here is a notice.']);
  });

  it('朗读稿按"标题/试音/开场白/部分标题/结束语"分节标注，便于真人逐段录制', () => {
    const { text } = buildListeningScriptText({
      stage: '初中', grade: '八年级', stageLabel: '初中', title: '八年级英语期中测评', items: [DIALOG],
    });
    // 默认：试卷标题独立成段 + 部分标题 + 试音段（中文播报 + 英文试音对话）
    expect(text).toContain('试卷标题（中文播报）');
    expect(text).toContain('八年级英语期中测评。');
    expect(text).toContain('部分标题（中文播报）');
    expect(text).toContain(LISTENING_PART_ANNOUNCEMENT);
    expect(text).toContain('试音（中文播报 + 英文对话）');
    expect(text).toContain(LISTENING_SOUND_CHECK.intro);
    expect(text).toContain(LISTENING_SOUND_CHECK.toExam);
    expect(text).toMatch(/男：Hello, this is the school office calling\./);
    expect(text).toContain('结束语（中文播报）');
    expect(text).toContain('听力部分到此结束。');
    // 关掉标题与试音 → 退回"开场白"形态
    const plain = buildListeningScriptText({
      stage: '初中', grade: '八年级', stageLabel: '初中', items: [DIALOG], soundCheck: false, announceTitle: false,
    });
    expect(plain.text).not.toContain('试卷标题（中文播报）');
    expect(plain.text).toContain('开场白（中文播报）');
    expect(plain.text).toContain('听力考试现在开始。');
    // 关掉标题但开试音：只有试音提示语，不重复标题
    const withTitle = buildListeningScriptText({
      stage: '初中', grade: '八年级', stageLabel: '初中', title: '八年级英语期中测评', items: [DIALOG], soundCheck: true,
    });
    expect(withTitle.text).toContain('八年级英语期中测评。');
    expect(withTitle.text.match(/八年级英语期中测评。/g)).toHaveLength(1);
  });

  it('试音起始语为固定文案；试卷标题单独一段，不并进试音提示语', () => {
    expect(buildSoundCheckIntro()).toBe(LISTENING_SOUND_CHECK.intro);
    const { segments } = buildListeningStoryboard({
      stage: '初中', grade: '八年级', title: '八年级英语期中测评_2026-09-19', items: [DIALOG],
    });
    const sc = segments.find((s) => s.kind === 'soundcheck');
    expect(sc.text).toBe(LISTENING_SOUND_CHECK.intro);
    expect(sc.text).not.toContain('八年级英语期中测评');
    expect(segments[0].text).toBe('八年级英语期中测评。');
  });
});

/**
 * 🎙 "以指令为准"：分节指令声明的遍数决定该节实际朗读遍数
 * （真题第一节与第二节遍数常不同，音频必须与播报一致）
 */
describe('以指令为准：分节遍数覆盖学段默认', () => {
  it('指令声明"仅读一遍"时该节只读一遍，并显式登记偏离', () => {
    const { segments, warnings } = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: 1, repeat: 1, instruction: '第一节，听下面5段对话。每段对话仅读一遍。', lines: [{ role: 'M', text: 'Hi.' }] }],
    });
    // 只读一遍 → 材料段仅 1 个（默认 2 遍会是 2 个）
    expect(segments.filter((s) => s.kind === 'material')).toHaveLength(1);
    expect(segments.filter((s) => s.kind === 'repeat')).toHaveLength(0);
    expect(warnings.join()).toContain('按播音指令读 1 遍');
  });

  it('朗读稿的遍数说明按实际生效值呈现（偏离时改列题号）', () => {
    const { text } = buildListeningScriptText({
      stage: '初中', grade: '八年级', stageLabel: '初中',
      items: [
        { no: 1, repeat: 1, instruction: '第一节，听下面5段对话。每段对话仅读一遍。', lines: [{ role: 'M', text: 'Hi.' }] },
        { no: 2, repeat: 2, lines: [{ role: 'W', text: 'Hello.' }] },
      ],
    });
    expect(text).toContain('第 1 题读 1 遍');
    expect(text).toContain('第 2 题读 2 遍');
    // 录制提示不得与正文口径打架（旧文案写死"连读 2 遍"）
    expect(text).not.toContain('每段材料连读 2 遍');
  });
});

/**
 * 🎛 三个可选环节的开关（2026-09-19 用户裁定）：
 *   读试卷标题默认开；试音段默认开；一题一材料处的题号默认开（英文 Number N.）。
 * 锁定"默认值＝用户定版口径"，防止有人把默认值改回去。
 */
describe('可选环节开关：读标题 / 试音段 / 一题一材料题号', () => {
  const items = [{ no: 1, lines: [{ role: 'M', text: 'Hi.' }] }];

  it('默认值取自单一事实源，且就是用户定版口径', () => {
    expect(LISTENING_FEATURE_DEFAULTS.announceTitle).toBe(true);
    expect(LISTENING_FEATURE_DEFAULTS.soundCheck).toBe(true);
    expect(LISTENING_FEATURE_DEFAULTS.announceShortItemNo).toBe(true);
    const { segments } = buildListeningStoryboard({ stage: '初中', grade: '八年级', items });
    // 默认带试音：试音提示语、末段（结束语前）试音收尾
    expect(segments.find((s) => s.kind === 'soundcheck').text).toBe(LISTENING_SOUND_CHECK.intro);
    const sc = segments.filter((s) => s.kind === 'soundcheck');
    expect(sc[sc.length - 1].text).toBe(LISTENING_SOUND_CHECK.toExam);
    // 默认播英文题号「Number 1.」，由英语旁白音色读（不是中文「第1小题」）
    const nos = segments.filter((s) => s.kind === 'itemno');
    expect(nos).toHaveLength(1);
    expect(nos[0].text).toBe('Number 1.');
    expect(nos[0].voice).toBe(LISTENING_VOICES.us.N);
  });

  it('试音对话为一男一女、与正文同速、只读一遍，且不带题号/作答留白', () => {
    const { segments, params } = buildListeningStoryboard({ stage: '初中', grade: '八年级', items });
    const scText = segments.filter((s) => s.kind === 'soundcheck' && s.role !== 'N');
    expect(scText).toHaveLength(LISTENING_SOUND_CHECK.lines.length);
    expect(new Set(scText.map((s) => s.role))).toEqual(new Set(['M', 'W']));
    expect(new Set(scText.map((s) => s.voice)))
      .toEqual(new Set([LISTENING_VOICES.us.M, LISTENING_VOICES.us.W]));
    expect(scText.every((s) => s.ratePercent === params.ratePercent), '试音须与正文同速').toBe(true);
    expect(scText.every((s) => s.pass === 1), '试音对话只读一遍').toBe(true);
    expect(scText.every((s) => s.itemNo === null && !s.chimeBefore)).toBe(true);
  });

  it('关闭试音段后不再产出 soundcheck 段（校内小测形态）', () => {
    const { segments } = buildListeningStoryboard({ stage: '初中', grade: '八年级', items, soundCheck: false });
    expect(segments.filter((s) => s.kind === 'soundcheck')).toHaveLength(0);
    expect(segments[0].kind).toBe('opening');
  });

  // 🔴 2026-09-19 用户追问"两个开关开与关，都不影响这些功能的吧？"——用四种组合逐一验证：
  //    开关**只增删"试音段 / 小题号段"这两类段**，其余（材料、遍数、作答留白、提示音、音色轮读）
  //    一律不受影响。锁定该不变量，防止以后把某个新功能挂到开关上而互相牵连。
  const COMBO_ITEMS = [
    { no: 1, instruction: '第一大题：听录音，选出你所听到的单词或图片。每小题读两遍。', lines: [{ role: 'N', text: 'tree' }] },
    { no: 2, lines: [{ role: 'N', text: 'forgot' }] },
    {
      no: 6,
      range: { materialNo: 6, from: 6, to: 7 },
      instruction: '第二大题：听录音，判断下列句子是否与录音内容相符。每段对话或独白读两遍。',
      lines: [{ role: 'W', text: 'Last week, Lily took part in a storytelling competition and she practised every single day after class.' }],
    },
    { no: 8, repeat: 3, lines: [{ role: 'N', text: 'Tom is a good boy and he likes reading books after school every single day with his best friend Jack.' }] },
  ];
  const combos = (o) => buildListeningStoryboard({ stage: '小学', grade: '六年级', items: COMBO_ITEMS, ...o }).segments;
  /** 剥掉"开关专属段"（试音段 / 开场白 / 题号播报）后，剩余脚本即"与开关无关"的部分 */
  const SWITCH_OWNED = ['soundcheck', 'opening', 'itemno'];
  const stripSwitchOwned = (segs) => segs.filter((s) => !SWITCH_OWNED.includes(s.kind));
  const ALL_COMBOS = [{ soundCheck: false, announceShortItemNo: false }, { soundCheck: false, announceShortItemNo: true }, { soundCheck: true, announceShortItemNo: false }, { soundCheck: true, announceShortItemNo: true }];

  it('🔴 剥掉开关专属段后，四种开关组合的脚本逐字一致（提示音落点标志除外，另行单独校验）', () => {
    // 叮咚的**落点段**会随题号开关而变（开＝落在题号段、关＝落在材料段），故比对前把该标志归一；
    // "每小题恰好一声"这一不变量由下一条测试单独锁定。
    const norm = (segs) => stripSwitchOwned(segs).map((s) => ({ ...s, chimeBefore: false }));
    const base = norm(combos(ALL_COMBOS[0]));
    expect(base.length).toBeGreaterThan(0);
    for (const c of ALL_COMBOS.slice(1)) {
      expect(norm(combos(c)), `组合 ${JSON.stringify(c)} 与基准不一致`).toEqual(base);
    }
  });

  it('🔴 提示音不随开关变化：全卷首声 1 次 + 每个小题各 1 次（落点段种类随开关走）', () => {
    for (const c of ALL_COMBOS) {
      const segs = combos(c);
      const itemNos = new Set(segs.filter((s) => s.itemNo !== null && s.itemNo !== undefined).map((s) => s.itemNo));
      const chimes = segs.filter((s) => s.chimeBefore);
      const tag = JSON.stringify(c);
      expect(chimes, `${tag}：提示音数应为 小题数+1`).toHaveLength(itemNos.size + 1);
      // 首声＝全卷开场（有标题时落在标题段，否则落在试音提示语/单句开场白上）
      expect(['title', 'soundcheck', 'opening'], tag).toContain(chimes[0].kind);
      // 其余落在"各小题的第一个发音段"：开题号＝题号段，关题号＝材料段
      expect(chimes.slice(1).every((s) => s.kind === 'itemno' || s.kind === 'material'), tag).toBe(true);
    }
  });

  it('🔴 遍间轮读音色不随开关变化（未标注材料：旁白→女→旁白，音色 男→女→男）', () => {
    for (const c of ALL_COMBOS) {
      const passes = combos(c).filter((s) => s.itemNo === 8 && (s.kind === 'material' || s.kind === 'repeat'));
      // 角色标签首遍沿用材料原标注（未标注＝旁白）；音色按 旁白(男声1)→女主→旁白(男声1) 交替
      expect(passes.map((s) => s.role), JSON.stringify(c)).toEqual(['N', 'W', 'N']);
      expect(passes.map((s) => s.voice), JSON.stringify(c))
        .toEqual([LISTENING_VOICES.us.M, LISTENING_VOICES.us.W, LISTENING_VOICES.us.M]);
    }
  });

  it('🔴 音色不受开关影响（材料段音色与基准一致）', () => {
    const baseVoices = stripSwitchOwned(combos(ALL_COMBOS[0])).map((s) => s.voice);
    for (const c of ALL_COMBOS.slice(1)) {
      expect(stripSwitchOwned(combos(c)).map((s) => s.voice), JSON.stringify(c)).toEqual(baseVoices);
    }
  });
});

/**
 * 🎚 音色（2026-09-19 用户裁定："男声1 女声2 作为默认，其他作为可选项，每个选项有对应的试听"）：
 *   · 默认值＝男声 1（Christopher）+ 女声 2（Jenny）；
 *   · 候选＝Edge 实测可用的美音/英音全部音色（可选项）；
 *   · 多角色对话：从音色池按顺序取未被占用的音色，池＝[男主, 女主, 男声副?, 女声副?]。
 */
describe('音色：默认值 / 候选 / 多角色音色池', () => {
  it('默认＝男声1 + 女声2；候选表两组齐全且不含重复', () => {
    expect(LISTENING_VOICE_DEFAULTS.M).toBe('en-US-ChristopherNeural');
    expect(LISTENING_VOICE_DEFAULTS.W).toBe('en-US-JennyNeural');
    expect(LISTENING_VOICE_DEFAULTS.M2).toBe('');
    expect(LISTENING_VOICE_DEFAULTS.W2).toBe('');
    for (const accent of ['us', 'gb']) {
      for (const g of ['M', 'W']) {
        const list = LISTENING_VOICE_CANDIDATES[accent][g];
        expect(list.length, `${accent}/${g} 候选为空`).toBeGreaterThan(1);
        expect(new Set(list).size, `${accent}/${g} 候选有重复`).toBe(list.length);
      }
    }
    // 默认音色必须在候选表里（否则界面上选不回来）
    expect(LISTENING_VOICE_CANDIDATES.us.M).toContain(LISTENING_VOICE_DEFAULTS.M);
    expect(LISTENING_VOICE_CANDIDATES.us.W).toContain(LISTENING_VOICE_DEFAULTS.W);
  });

  it('不传音色池时＝默认男主+女主（与旧行为一致）', () => {
    const items = [{ no: 1, lines: [{ role: 'M', text: 'Hi.' }, { role: 'W', text: 'Hello.' }] }];
    const voices = buildListeningStoryboard({ stage: '初中', grade: '八年级', items })
      .segments.filter((s) => s.kind === 'material').map((s) => s.voice);
    expect(voices).toEqual([LISTENING_VOICES.us.M, LISTENING_VOICES.us.W]);
  });

  it('🔴 多角色对话：两人用男主+女主；三人且配了"男声副"→ 各用不同音色', () => {
    const two = [{ no: 1, lines: [{ role: 'A', text: 'Hi.' }, { role: 'B', text: 'Hello.' }] }];
    const twoVoices = buildListeningStoryboard({ stage: '初中', grade: '八年级', items: two })
      .segments.filter((s) => s.kind === 'material').map((s) => s.voice);
    expect(twoVoices).toEqual([LISTENING_VOICE_DEFAULTS.M, LISTENING_VOICE_DEFAULTS.W]);

    const three = [{ no: 1, lines: [
      { role: 'A', text: 'Hi.' }, { role: 'B', text: 'Hello.' }, { role: 'C', text: 'Hey.' },
    ] }];
    // 配了"男声副"：第三个角色取到第三条音色 → 三人三个不同音色
    const withExtra = buildListeningStoryboard({
      stage: '初中', grade: '八年级', items: three,
      voicePoolInput: [LISTENING_VOICE_DEFAULTS.M, LISTENING_VOICE_DEFAULTS.W, 'en-US-EricNeural', ''],
    }).segments.filter((s) => s.kind === 'material').map((s) => s.voice);
    expect(withExtra).toEqual(['en-US-ChristopherNeural', 'en-US-JennyNeural', 'en-US-EricNeural']);
    expect(new Set(withExtra).size, '三个角色不得同音色').toBe(3);
    // 没配副音色：第三个角色回落到男主（真题本就是两人读全部材料，回落不算错）
    const noExtra = buildListeningStoryboard({ stage: '初中', grade: '八年级', items: three })
      .segments.filter((s) => s.kind === 'material').map((s) => s.voice);
    expect(noExtra).toEqual([LISTENING_VOICE_DEFAULTS.M, LISTENING_VOICE_DEFAULTS.W, LISTENING_VOICE_DEFAULTS.M]);
  });

  it('音色池一经指定即全书同一套（不再按口音表逐段轮换）', () => {
    const items = [
      { no: 1, lines: [{ role: 'M', text: 'One.' }] },
      { no: 2, lines: [{ role: 'M', text: 'Two.' }] },
      { no: 3, lines: [{ role: 'M', text: 'Three.' }] },
    ];
    const voices = buildListeningStoryboard({
      stage: '高中', items,   // 高中学段默认口音策略是"英美交替"，显式音色池应把它压掉
      voicePoolInput: ['en-US-GuyNeural', 'en-US-JennyNeural'],
    }).segments.filter((s) => s.kind === 'material').map((s) => s.voice);
    expect(new Set(voices)).toEqual(new Set(['en-US-GuyNeural']));
  });

  // 🔴 2026-09-19 用户问："解析的听力稿中会多音色配角色吗？要不然用户怎么能立即知道是否有多角色呢？"
  //    → 朗读稿必须逐题列出「角色 → 音色」，并在头部给出全书角色数/音色数；角色多于音色时显式告警。
  it('🔴 朗读稿逐题列出「角色 → 音色」，多角色题一眼可见（不再把 A/B 显示成"旁白"）', () => {
    const { text, warnings } = buildListeningScriptText({
      stage: '初中', grade: '八年级', stageLabel: '初中', soundCheck: false, announceTitle: false,
      items: [
        { no: 1, lines: [{ role: 'A', text: 'Hi.' }, { role: 'B', text: 'Hello.' }] },
        { no: 2, lines: [{ role: 'A', text: 'Bye.' }, { role: 'B', text: 'See you.' }, { role: 'C', text: 'Wait!' }] },
      ],
      voicePoolInput: ['en-US-ChristopherNeural', 'en-US-JennyNeural', 'en-US-EricNeural', ''],
    });
    // 头部：生效音色池 + 角色/声线计数（说话人 ≠ 音色，两个数字分开说清）
    expect(text).toContain('音色：男声 1 · Christopher　｜　女声 2 · Jenny　｜　男声 3 · Eric');
    expect(text).toContain('说话人：全书 3 个角色　｜　材料实际用到 3 条音色（男声 1 · Christopher、女声 2 · Jenny、男声 3 · Eric）');
    // 第 1 题两个角色 → 男主 + 女主
    expect(text).toContain('（音色）A → 男声 1 · Christopher　｜　B → 女声 2 · Jenny');
    // 第 2 题三个角色 → 三条不同音色（第三人用"男声副"）
    expect(text).toContain('（音色）A → 男声 1 · Christopher　｜　B → 女声 2 · Jenny　｜　C → 男声 3 · Eric');
    // 角色标签照原名显示，不再误标成"旁白"
    expect(text).toMatch(/\nA：Hi\./);
    expect(text).not.toMatch(/旁白：Hi\./);
    expect(warnings.join(), '三人三音色，不该告警').not.toContain('角色多于音色');
  });

  it('🔴 「说话人 1 个 · 音色 2 条」必须自解释：单说话人 + 遍间换声＝2 条声线，且标明多出的从哪来', () => {
    // 2026-09-20 用户追问："说话人 1 个 · 音色 2 条，这是啥意思，一个人两个音色？"
    // 小学默认开遍间换声：同一段单说话人材料两遍分男女两条声线 → 1 个说话人 + 2 条音色的常态要能读懂
    const primary = buildListeningScriptText({
      stage: '小学', grade: '六年级', announceTitle: false, soundCheck: false,
      items: [{ no: 1, lines: [{ role: 'N', text: 'Tom is a good boy and he likes reading books after school.' }] }],
    }).text;
    expect(primary).toContain('说话人：全书 1 个角色　｜　材料实际用到 2 条音色');
    expect(primary).toContain('单说话人材料按遍间换声分读，故声线多于说话人');

    // 初中默认不换声：同一材料两遍同一声线 → 只有 1 条被用到，池里另一条如实标注"另配"
    const middle = buildListeningScriptText({
      stage: '初中', grade: '八年级', announceTitle: false, soundCheck: false,
      items: [{ no: 1, lines: [{ role: 'N', text: 'Tom is a good boy and he likes reading books after school.' }] }],
    }).text;
    expect(middle).toContain('说话人：全书 1 个角色　｜　材料实际用到 1 条音色');
    expect(middle).toContain('音色池共 2 条');
    expect(middle).not.toContain('遍间换声分读');
  });

  it('🔴 角色多于音色时如实告警，指明是第几题（用户据此决定是否补配副音色）', () => {
    const { warnings, voiceCast } = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: 2, lines: [{ role: 'A', text: 'a' }, { role: 'B', text: 'b' }, { role: 'C', text: 'c' }] }],
      voicePoolInput: ['en-US-ChristopherNeural', 'en-US-JennyNeural'],
    });
    expect(warnings.join()).toContain('第 2 题有 3 个角色');
    expect(warnings.join()).toContain('男声副');
    // 配音结果仍要用满池子（不得静音/丢句）
    expect(voiceCast[0].entries.map((e) => e.voice)).toEqual(['en-US-ChristopherNeural', 'en-US-JennyNeural', 'en-US-ChristopherNeural']);
  });
});

/**
 * 🔊 遍数与音色（2026-09-19 用户问"两遍或者三遍的吧？分题型的吧？…不同遍数都是同一个音色吗？"；
 *   2026-09-20 用户实测裁定"遍与遍都是同一个声音，并没有分男声或女声" → 轮读扩展到两遍）：
 *   遍数随考试/题型变化（高考第一节一遍、第二节两遍；小学部分题型三遍），一律以节指令为准；
 *   音色方面：**重复 ≥2 遍的单说话人材料按"男、女"交替轮读**（两遍＝男、女；三遍＝男、女、男，
 *   实证：小学听力要求原文"男、女、男声中速各读一遍，每遍间隔 5 秒"；人教 PEP CD"两遍、英音美音各一遍"；
 *   真题"读两遍"惯例多为同一人重读，故遍间换声为**用户定制**，常量 LISTENING_PASS_VOICE_ROTATION=false 可整体关掉）；
 *   对话材料按角色分音色、不参与轮读。
 */
describe('遍数与音色：一遍 / 两遍 / 三遍各有对待', () => {
  const SOLO = [{ role: 'N', text: 'Tom is a good boy and he likes reading books after school.' }];
  const longSolo = [{ role: 'N', text: 'Tom is a good boy and he likes reading books after school every single day with his best friend Jack.' }];

  it('读三遍的单说话人材料按 旁白→女→旁白 轮换音色，且叮咚只响一次（遍与遍之间不响）', () => {
    const { segments, warnings } = buildListeningStoryboard({
      stage: '小学', grade: '三年级',
      items: [{ no: 1, repeat: 3, instruction: '第一大题：听录音，选出你所听到的单词。每小题读三遍。', lines: SOLO }],
    });
    const passes = segments.filter((s) => s.itemNo === 1 && (s.kind === 'material' || s.kind === 'repeat'));
    expect(passes).toHaveLength(3);
    expect(passes.map((s) => s.role)).toEqual(['N', 'W', 'N']);
    expect(passes.map((s) => s.voice)).toEqual([LISTENING_VOICES.us.M, LISTENING_VOICES.us.W, LISTENING_VOICES.us.M]);
    // 叮咚落"一小题结束"的边界上（默认有英文题号 → 在题号之前），三遍之间一声都不响
    expect(passes.every((s) => !s.chimeBefore), '遍与遍之间不响').toBe(true);
    const mine = segments.filter((s) => s.itemNo === 1 && s.kind !== 'instruction');
    expect(mine.filter((s) => s.chimeBefore)).toHaveLength(1);
    expect(mine[0].kind).toBe('itemno');
    // 以指令为准：声明三遍即三遍，并显式登记与学段默认的偏离
    expect(warnings.join()).toContain('按播音指令读 3 遍');
  });

  it('读两遍的单说话人材料按 旁白→女 交替（2026-09-20 用户裁定：遍与遍分男声/女声）', () => {
    const twoPass = buildListeningStoryboard({
      stage: '小学', grade: '六年级',
      items: [{ no: 6, range: { materialNo: 6, from: 6, to: 7 }, lines: longSolo }],
    }).segments.filter((s) => s.itemNo === 6 && (s.kind === 'material' || s.kind === 'repeat'));
    expect(twoPass).toHaveLength(2);
    expect(twoPass.map((s) => s.role)).toEqual(['N', 'W']);
    expect(twoPass[0].voice).toBe(LISTENING_VOICES.us.M);
    expect(twoPass[1].voice).toBe(LISTENING_VOICES.us.W);
  });

  it('🔴 换声作用域＝小学：初中/高中默认不换声（真题惯例同一人重读），overrides 可开启', () => {
    const build = (extra) => buildListeningStoryboard({
      stage: '初中', grade: '八年级', ...extra,
      items: [{ no: 6, range: { materialNo: 6, from: 6, to: 7 }, lines: longSolo }],
    }).segments.filter((s) => s.itemNo === 6 && (s.kind === 'material' || s.kind === 'repeat'));
    // 默认：初中不换声（保真——中考真题为同一人重读两遍）
    const mid = build({});
    expect(mid[0].voice).toBe(mid[1].voice);
    // 显式开启：初中也能遍间换声
    const midOn = build({ overrides: { passVoiceRotation: true } });
    expect(midOn[0].voice).not.toBe(midOn[1].voice);
    // 关掉开关：小学回到同一音色（同一说话人重读）
    const primaryOff = buildListeningStoryboard({
      stage: '小学', grade: '六年级', overrides: { passVoiceRotation: false },
      items: [{ no: 6, range: { materialNo: 6, from: 6, to: 7 }, lines: longSolo }],
    }).segments.filter((s) => s.itemNo === 6 && (s.kind === 'material' || s.kind === 'repeat'));
    expect(primaryOff[0].voice).toBe(primaryOff[1].voice);
  });

  it('对话材料按角色分音色、不参与三遍轮读', () => {
    const dlg = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: 1, repeat: 3, lines: [{ role: 'M', text: 'Hi.' }, { role: 'W', text: 'Hello.' }] }],
    }).segments.filter((s) => s.itemNo === 1 && (s.kind === 'material' || s.kind === 'repeat'));
    expect(dlg.map((s) => s.role)).toEqual(['M', 'W', 'M', 'W', 'M', 'W']);
    expect(dlg.map((s) => s.voice)).toEqual([
      LISTENING_VOICES.us.M, LISTENING_VOICES.us.W,
      LISTENING_VOICES.us.M, LISTENING_VOICES.us.W,
      LISTENING_VOICES.us.M, LISTENING_VOICES.us.W,
    ]);
  });
});

/**
 * 🔴 2026-09-19 用户实测根治（"间隔没有叮咚提示音…也没有题号提示，全程只有一个女声…要的是标准的正规考试听力音频"）：
 *   补齐标准音频的四项必备要素——题号播报、提示音、男女音色、停顿分档。
 */
describe('标准音频要素：题号播报 / 提示音 / 男女音色 / 停顿分档', () => {
  const items = [
    { no: 1, instruction: '第一节：听录音，选出你所听到的单词或图片。每小题读两遍。', lines: [{ role: 'N', text: 'tree' }] },
    { no: 2, lines: [{ role: 'N', text: 'forgot' }] },
    {
      no: 3,
      instruction: '第二节：听录音，判断下列句子是否与录音内容相符。每小题读两遍。',
      lines: [{ role: 'W', text: 'Last week, Lily took part in a storytelling competition. At first, she was afraid, but she practised every day and finally did her best.' }],
    },
  ];
  const build = () => buildListeningStoryboard({ stage: '小学', grade: '六年级', title: '六年级英语上册Unit 1测试卷', items });

  it('🔴 题号播报：一题一材料处读英文「Number N.」；一段对多题只在源文本给了范围时播，给不出就不报', () => {
    const { segments } = build();
    // 用户定版（默认开）：一题一材料处播英文题号「Number N.」，由英语旁白音色读（不是中文「第N小题」）
    const nos = segments.filter((s) => s.kind === 'itemno');
    expect(nos.map((s) => s.text)).toEqual(['Number 1.', 'Number 2.']);
    expect(nos.every((s) => s.voice === LISTENING_VOICES.us.N)).toBe(true);
    //   第 3 题是独白（一段对多题）但没给题号范围 → **整条不报**（宁可不报，也不报错——
    //   原实现按条数顺编，实测把这节报成了"第七题"，而它实为第 11~15 题）
    expect(nos.filter((s) => s.itemNo === 3)).toHaveLength(0);
    expect(segments.findIndex((s) => s.kind === 'itemno' && s.itemNo === 2))
      .toBeLessThan(segments.findIndex((s) => s.kind === 'material' && s.itemNo === 2));
    // 关掉开关 → 一题一材料处不报题号（一段对多题的中文范围播报不受影响）
    const off = buildListeningStoryboard({
      stage: '小学', grade: '六年级', items, announceShortItemNo: false,
    }).segments;
    expect(off.filter((s) => s.kind === 'itemno')).toHaveLength(0);

    // 源文本写明题号范围后 → 按真题书面写法报中文「听第N段材料，回答第X至Y小题」（与开关无关）
    const longLines = [{ role: 'W', text: 'Last week, Lily took part in a storytelling competition. At first, she was afraid, but she practised every day and finally did her best in front of everyone.' }];
    const rangedItems = [
      { no: 1, instruction: '第一节：听录音，选出你所听到的单词或图片。每小题读两遍。', lines: [{ role: 'N', text: 'tree' }] },
      { no: 6, range: { materialNo: 6, from: 6, to: 10 }, instruction: '第二节：听录音，判断下列句子是否与录音内容相符。每段对话或独白读两遍。', lines: longLines },
    ];
    const withRange = buildListeningStoryboard({ stage: '小学', grade: '六年级', items: rangedItems }).segments;
    const rangedNos = withRange.filter((s) => s.kind === 'itemno').filter((s) => s.itemNo === 6);
    expect(rangedNos.map((s) => s.text)).toEqual(['听第6段材料，回答第6至10小题。']);
    expect(rangedNos[0].voice).toBe('zh-CN-XiaoxiaoNeural');
    // 关掉小题号开关后，这条中文范围播报仍在
    const withRangeOff = buildListeningStoryboard({ stage: '小学', grade: '六年级', items: rangedItems, announceShortItemNo: false }).segments;
    expect(withRangeOff.filter((s) => s.kind === 'itemno').map((s) => s.text)).toEqual(['听第6段材料，回答第6至10小题。']);
  });

  it('🔴 题号范围的国标写法：两项用顿号、三项及以上用「至」，且一律以「小题」收尾', () => {
    const longLines = [{ role: 'W', text: 'Last week, Lily took part in a storytelling competition and she practised every single day until she did her best in front of everyone at last.' }];
    const textsOf = (range) => buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: range.materialNo, range, lines: longLines }],
    }).segments.filter((s) => s.kind === 'itemno').map((s) => s.text);
    expect(textsOf({ materialNo: 6, from: 6, to: 7 })).toEqual(['听第6段材料，回答第6、7小题。']);
    expect(textsOf({ materialNo: 8, from: 10, to: 12 })).toEqual(['听第8段材料，回答第10至12小题。']);
    // 单题范围（材料只对一题）也要能报
    expect(textsOf({ materialNo: 9, from: 18, to: 18 })).toEqual(['听第9段材料，回答第18小题。']);
    // 缺范围 → 不报（不得顺编）
    expect(textsOf({ materialNo: 6 })).toEqual([]);
  });

  it('🔴 题号范围是"一段对多题"的权威判据（篇幅只作兜底，不得反过来把范围播报吃掉）', () => {
    // 素材本身很短（<20 词），但源文本已宣告"这段材料对第6~10题"——必须照报，且走"各小题 5 秒"档
    const short = [{ role: 'W', text: 'She was afraid at first.' }];
    const { segments, params } = buildListeningStoryboard({
      stage: '小学', grade: '六年级',
      items: [{ no: 6, range: { materialNo: 6, from: 6, to: 10 }, lines: short }],
    });
    expect(segments.filter((s) => s.kind === 'itemno').map((s) => s.text))
      .toEqual(['听第6段材料，回答第6至10小题。']);
    expect(segments.filter((s) => s.itemNo === 6).pop().gapAfterMs)
      .toBe(params.pauses.longMaterialAnswerGapMs);
    // 判据本身：有跨题范围即"一段对多题"；仅单题范围不成立，须靠篇幅兜底
    expect(isMultiQuestion({ range: { from: 6, to: 10 }, lines: short })).toBe(true);
    expect(isMultiQuestion({ range: { from: 6, to: 6 }, lines: short })).toBe(false);
    expect(isMultiQuestion({ lines: [{ role: 'N', text: 'a b c d e f g h i j k l m n o p q r s t u' }] })).toBe(true);
  });

  it('🔴 提示音＝"一小题结束"的边界音：每小题恰好一次、落在题号前，遍与遍之间不响', () => {
    const { segments } = build();
    // 全卷第一声：标题段（用户实测稿顺序：标题 → 试音 → 部分标题 → 大题指令 → 叮咚 → Number 1）
    expect(segments[0].kind).toBe('title');
    expect(segments[0].chimeBefore, '标题＝全卷第一个提示音').toBe(true);
    for (const no of [1, 2, 3]) {
      const mine = segments.filter((s) => s.itemNo === no && s.kind !== 'instruction');
      // 每小题恰好一声
      expect(mine.filter((s) => s.chimeBefore), `第${no}题只能响一次`).toHaveLength(1);
      // 落在该小题的第一个发音段上
      expect(mine[0].chimeBefore, `第${no}题的第一个发音段须响`).toBe(true);
      // 遍与遍之间不响（用户实测稿："一小题结束 叮咚，遍与遍之间不叮咚"）
      const passes = mine.filter((s) => s.kind === 'material' || s.kind === 'repeat');
      expect(passes.slice(1).every((s) => !s.chimeBefore), '遍与遍之间不响').toBe(true);
    }
    // 有题号的小题：叮咚落在题号之前；无题号的长材料（第3题无范围）：落在材料之前
    expect(segments.find((s) => s.itemNo === 1 && s.kind === 'itemno').chimeBefore).toBe(true);
    const third = segments.find((s) => s.itemNo === 3 && s.kind !== 'instruction');
    expect(third.kind, '第3题是独白且未给范围 → 无题号').toBe('material');
    expect(third.chimeBefore).toBe(true);
    // 大题指令不响（它属大题边界，不属小题）
    expect(segments.filter((s) => s.kind === 'instruction').every((s) => !s.chimeBefore)).toBe(true);
    // 关掉题号开关 → 叮咚改落在材料起点，仍每小题一次；遍与遍之间仍不响
    const off = buildListeningStoryboard({
      stage: '小学', grade: '六年级', title: '六年级英语上册Unit 1测试卷', items, announceShortItemNo: false,
    }).segments;
    for (const no of [1, 2, 3]) {
      const mine = off.filter((s) => s.itemNo === no && s.kind !== 'instruction');
      expect(mine.filter((s) => s.chimeBefore)).toHaveLength(1);
      expect(mine.find((s) => s.chimeBefore).kind, '无题号时响在材料起点').toBe('material');
    }
  });

  it('🔴 音色不再全女：播报/旁白用男声、女声独白用女声，两者必须不同', () => {
    const { segments } = build();
    const narrator = segments.find((s) => s.kind === 'material' && s.itemNo === 1);
    const female = segments.find((s) => s.kind === 'material' && s.itemNo === 3);
    expect(narrator.voice).toBe(LISTENING_VOICES.us.N);
    expect(female.voice).toBe(LISTENING_VOICES.us.W);
    expect(narrator.voice, '旁白与女声不得同一条音色（原 Aria/Jenny 同为女声）').not.toBe(female.voice);
  });

  it('停顿分档：遍间从常量取、断句不叠大停顿、换节叠节间留白、长材料走 5 秒档', () => {
    const { segments, params } = build();
    expect(segments.find((s) => s.kind === 'material' && s.itemNo === 1).gapAfterMs)
      .toBe(params.pauses.betweenRepeatsMs);
    // 短材料（第 2 题）作答留白＝学段档；因为下一题换节，再叠一节间留白（原 betweenSectionsMs 配了没用）
    const lastShort = segments.filter((s) => s.itemNo === 2).pop();
    expect(lastShort.gapAfterMs).toBe(params.answerGapMs + params.pauses.betweenSectionsMs);
    // 长材料（独白 ≥20 词，一段对多题）→ 真题"各小题 5 秒"档，不再是笼统一律 10 秒
    const longLast = segments.filter((s) => s.itemNo === 3).pop();
    expect(longLast.gapAfterMs).toBe(params.pauses.longMaterialAnswerGapMs);
  });

  it('🔴 补全短文（要动笔写词）给"写"的作答档，不套"听独白做判断"的 5 秒档', () => {
    const bp = buildListeningStoryboard({
      stage: '小学',
      grade: '六年级',
      items: [
        { no: 1, instruction: '第一节：听录音，选出你所听到的单词或图片。每小题读两遍。', lines: [{ role: 'N', text: 'tree' }] },
        {
          no: 11,
          range: { from: 11, to: 15 },
          instruction: '第三节：听录音，补全短文，每空一词。短文读两遍。',
          lines: [{ role: 'W', text: 'Last month, our school had an International Culture Festival. I wanted to be a culture ambassador and I practised speaking English every single day.' }],
        },
      ],
    });
    const last = bp.segments.filter((s) => s.itemNo === 11).pop();
    expect(last.gapAfterMs).toBe(bp.params.pauses.fillInAnswerGapMs);
    expect(bp.params.pauses.fillInAnswerGapMs)
      .toBeGreaterThan(bp.params.pauses.longMaterialAnswerGapMs);
  });

  it('🔴 遍间轮读尊重材料原标注：标注了女声的独白首遍仍是女声，次遍换男声', () => {
    const { segments } = buildListeningStoryboard({
      stage: '小学',
      grade: '六年级',
      items: [
        { no: 6, lines: [{ role: 'W', text: 'Last week, Lily took part in a storytelling competition and she practised telling stories every day until she finally did her best in the end.' }] },
        { no: 11, lines: [{ role: 'N', text: 'Last month, our school had an International Culture Festival and I wanted to be a culture ambassador so I practised every single day.' }] },
      ],
    });
    const passOf = (no, kind) => segments.find((s) => s.kind === kind && s.itemNo === no);
    // 标注女声 → 首遍女声、次遍男声（不得把它顶成男声）
    expect(passOf(6, 'material').voice).toBe(LISTENING_VOICES.us.W);
    expect(passOf(6, 'repeat').voice).toBe(LISTENING_VOICES.us.M);
    // 未标注（旁白）→ 首遍旁白音色（默认＝男主）、次遍对侧（女主）
    expect(passOf(11, 'material').voice).toBe(LISTENING_VOICES.us.N);
    expect(passOf(11, 'repeat').voice).toBe(LISTENING_VOICES.us.W);
    // 遍与遍必须不同声（用户 2026-09-20 裁定）
    expect(passOf(6, 'material').voice).not.toBe(passOf(6, 'repeat').voice);
    expect(passOf(11, 'material').voice).not.toBe(passOf(11, 'repeat').voice);
  });
});

describe('2026-09-20 实测修复回归锁：指令标号归一 / 标题中英分读 / 旁白与中文播报可配', () => {
  describe('指令标号归一：第X节/第X大题 → 一、', () => {
    it('「第一节，听下面5段对话」→「一、听下面5段对话」，其余题干原样保留', () => {
      expect(normalizeSectionLabel('第一节，听下面5段对话。每段对话后有一个小题。'))
        .toBe('一、听下面5段对话。每段对话后有一个小题。');
    });

    it('「第二大题：听录音…」→「二、听录音…」；「第三节 听短文」→「三、听短文」', () => {
      expect(normalizeSectionLabel('第二大题：听录音，选出你所听到的单词。')).toBe('二、听录音，选出你所听到的单词。');
      expect(normalizeSectionLabel('第三节 听短文，根据短文内容判断正误。')).toBe('三、听短文，根据短文内容判断正误。');
    });

    it('卷面本就是「一、」开头或非节指令文本不被误改', () => {
      expect(normalizeSectionLabel('一、听下面5段对话。')).toBe('一、听下面5段对话。');
      expect(normalizeSectionLabel('听下面5段对话，每段对话后有一个小题。')).toBe('听下面5段对话，每段对话后有一个小题。');
    });

    it('keepSectionLabel=true 时保留「第X节」原样（卷面本身就是该写法的高考卷）', () => {
      expect(normalizeSectionLabel('第一节，听下面5段对话。', true)).toBe('第一节，听下面5段对话。');
    });

    it('storyboard 分节指令实际播报「一、」而非「第一节」', () => {
      const { segments } = buildListeningStoryboard({
        stage: '小学',
        grade: '六年级',
        announceTitle: false,
        items: [{ no: 1, instruction: '第一节：听下面5段对话，每段对话后有一个小题。', lines: [{ role: 'W', text: 'Hello.' }] }],
      });
      const instr = segments.find((s) => s.kind === 'instruction');
      expect(instr.text.startsWith('一、')).toBe(true);
    });
  });

  describe('标题中英混排：按语种分读（中文用中文音色·英文同性别匹配）+ 数字转英文词', () => {
    it('英文整数 → 英文词（Unit 1 → Unit One；Number 12. → Number twelve.）', () => {
      expect(intToEnglishWords(1)).toBe('one');
      expect(intToEnglishWords(12)).toBe('twelve');
      expect(intToEnglishWords(21)).toBe('twenty one');
      expect(intToEnglishWords(305)).toBe('three hundred five');
      expect(digitsToEnglishWords('Unit 1 Try your best')).toBe('Unit one Try your best');
      expect(digitsToEnglishWords('Number 12.')).toBe('Number twelve.');
    });

    it('中英混排标题按语种切段（切段信息仍用于分读兜底与数字转换）', () => {
      expect(splitMixedLanguageRuns('六年级英语上册Unit 1 Try your best测试卷')).toEqual([
        { text: '六年级英语上册', lang: 'zh' },
        { text: 'Unit 1 Try your best', lang: 'en' },
        { text: '测试卷', lang: 'zh' },
      ]);
    });

    it('🔴 中英混排默认＝按语种分读：中文用中文音色、英文用**同性别**英文音色、段间不留人工停顿', () => {
      // 2026-09-20 二次定版：用户实测否掉"单一多语言音色通读"（中文被英文母语者读成"外国人腔"），
      // 改为"双语都地道"——中文段用中文音色，英文段用与中文播报者**同性别**的英文音色。
      const { segments, titleMixedMode, titleEnVoice } = buildListeningStoryboard({
        stage: '小学',
        grade: '六年级',
        title: '六年级英语上册Unit 1 Try your best测试卷',
        announceTitle: true,
        items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
      });
      const titleSegs = segments.filter((s) => s.kind === 'title');
      expect(titleSegs).toHaveLength(3);
      // 中文段必须是中文音色（不得用英文音色念中文——用户实测："就跟外国人说中文蹩脚那样的听觉"）
      expect(titleSegs[0].voice).toBe(LISTENING_ZH_VOICE);
      expect(titleSegs[0].text).toBe('六年级英语上册');
      expect(titleSegs[2].voice).toBe(LISTENING_ZH_VOICE);
      expect(titleSegs[2].text).toBe('测试卷。');
      // 英文段用英文音色，且与中文播报者（晓晓·女声）同性别 → 女主音色
      expect(titleSegs[1].voice).toBe(LISTENING_VOICES.us.W);
      expect(titleSegs[1].voice).not.toBe(LISTENING_ZH_VOICE);
      expect(titleSegs[1].text).toBe('Unit one Try your best');
      expect(titleMixedMode).toBe('native');
      expect(titleEnVoice).toBe(LISTENING_VOICES.us.W);
      // 段间用句间自然间隙（不留 350ms 人工停顿，否则听出"两段拼接"）；末段才是标题后留白
      expect(titleSegs[0].gapAfterMs).toBe(LISTENING_PAUSE.sentenceGapMs);
      expect(titleSegs[1].gapAfterMs).toBe(LISTENING_PAUSE.sentenceGapMs);
      expect(titleSegs[2].gapAfterMs).toBe(LISTENING_PAUSE.afterTitleMs);
      // 全卷第一声（叮咚）只挂标题首段
      expect(titleSegs[0].chimeBefore).toBe(true);
      expect(titleSegs[1].chimeBefore).toBe(false);
      expect(titleSegs[2].chimeBefore).toBe(false);
    });

    it('中文播报换成男声时，标题英文段匹配男主音色（同性别匹配随中文播报者走）', () => {
      const { segments } = buildListeningStoryboard({
        stage: '小学', grade: '六年级', announceTitle: true,
        title: '六年级英语上册Unit 1 Try your best测试卷',
        overrides: { zhVoice: 'zh-CN-YunyangNeural' },   // 云扬 · 新闻男声
        items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
      });
      const titleEn = segments.find((s) => s.kind === 'title' && s.voice !== 'zh-CN-YunyangNeural');
      expect(titleEn.voice).toBe(LISTENING_VOICES.us.M);
    });

    it('纯中文/纯英文标题不受影响：仍用中文播报音色 / 英语旁白音色', () => {
      const zh = buildListeningStoryboard({
        stage: '小学', grade: '六年级', announceTitle: true,
        title: '六年级英语上册期中测试卷',
        items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
      }).segments.filter((s) => s.kind === 'title');
      expect(zh).toHaveLength(1);
      expect(zh[0].voice).toBe(LISTENING_ZH_VOICE);

      const en = buildListeningStoryboard({
        stage: '小学', grade: '六年级', announceTitle: true,
        title: 'Unit 1 Try your best',
        items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
      });
      const enTitle = en.segments.filter((s) => s.kind === 'title');
      expect(enTitle).toHaveLength(1);
      expect(enTitle[0].voice).toBe(en.narratorVoice);
      expect(enTitle[0].text).toBe('Unit one Try your best。');
    });

    it('朗读稿必须写明标题读法（混排标题 + 朗读稿同调，防越界引用崩掉生成）', () => {
      // 🔴 回归：曾在朗读稿里误用 storyboard 内部的局部量，导致"听力稿生成失败：narratorVoiceEff is not defined"。
      //    故此处**必须同时开 announceTitle 且标题混排**，才能真正走到那一行。
      let text = '';
      expect(() => {
        ({ text } = buildListeningScriptText({
          stage: '小学', grade: '六年级', announceTitle: true, soundCheck: false,
          title: '六年级英语上册Unit 1 Try your best测试卷',
          items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
        }));
      }).not.toThrow();
      expect(text).toContain('标题：中英混排**按语种分读**');
      expect(text).toContain('中文段用中文播报音色');
      // 切到单一多语言音色时，朗读稿必须写明"中文会带外国口音"，防止录制方误用
      const single = buildListeningScriptText({
        stage: '小学', grade: '六年级', announceTitle: true, soundCheck: false,
        title: '六年级英语上册Unit 1 Try your best测试卷',
        overrides: { titleMixedVoice: 'single' },
        items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
      }).text;
      expect(single).toContain('同一条多语言音色通读');
      expect(single).toContain('中文会带外国口音');
    });

    it('「标题」槽可切到单一多语言音色通读（真·同一人，但中文带外国口音，故非默认）', () => {
      const byName = buildListeningStoryboard({
        stage: '小学', grade: '六年级', announceTitle: true,
        title: '六年级英语上册Unit 1 Try your best测试卷',
        items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
        overrides: { titleMixedVoice: 'en-US-AvaMultilingualNeural' },
      });
      const one = byName.segments.filter((s) => s.kind === 'title');
      expect(one).toHaveLength(1);
      expect(one[0].voice).toBe('en-US-AvaMultilingualNeural');
      expect(one[0].text).toBe('六年级英语上册 Unit one Try your best 测试卷。');
      expect(byName.titleMixedMode).toBe('single');

      // 传 'single' 用配置里的默认多语言音色
      const bySentinel = buildListeningStoryboard({
        stage: '小学', grade: '六年级', announceTitle: true,
        title: '六年级英语上册Unit 1 Try your best测试卷',
        items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
        overrides: { titleMixedVoice: 'single' },
      });
      expect(bySentinel.segments.filter((s) => s.kind === 'title')[0].voice).toBe(LISTENING_MIXED_TITLE_VOICE);

      // 显式 'native'（含兼容旧值 'split'）＝按语种分读
      for (const v of ['native', 'split']) {
        const segs = buildListeningStoryboard({
          stage: '小学', grade: '六年级', announceTitle: true,
          title: '六年级英语上册Unit 1 Try your best测试卷',
          items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
          overrides: { titleMixedVoice: v },
        }).segments.filter((s) => s.kind === 'title');
        expect(segs, `titleMixedVoice=${v}`).toHaveLength(3);
        expect(segs[0].voice).toBe(LISTENING_ZH_VOICE);
      }
    });
  });

  describe('旁白音色独立配置（narratorVoice）', () => {
    const TITLE = '六年级英语上册Unit 1 Try your best测试卷';

    it('未指定旁白时跟随男主音色', () => {
      const sb = buildListeningStoryboard({
        stage: '小学',
        grade: '六年级',
        title: TITLE,
        announceTitle: true,
        items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
      });
      expect(sb.narratorVoice).toBe(sb.voicePool[0]);
    });

    it('指定旁白后：英文题号 / 未标注独白改用旁白音色；混排标题仍按"同性别匹配"走（不被旁白的性别带偏）', () => {
      const narrator = 'en-GB-SoniaNeural';
      const { segments } = buildListeningStoryboard({
        stage: '小学',
        grade: '六年级',
        title: TITLE,
        announceTitle: true,
        narratorVoice: narrator,
        items: [
          { no: 1, lines: [{ role: 'W', text: 'Hello.' }] },
          { no: 2, lines: [{ role: 'N', text: 'Listen to the passage and choose the best answer.' }] },
        ],
      });
      const itemNo = segments.find((s) => s.kind === 'itemno');
      expect(itemNo.voice).toBe(narrator);
      const mono = segments.find((s) => s.kind === 'material' && s.itemNo === 2);
      expect(mono.voice).toBe(narrator);
      // 标题中英混排 → 中文段用中文播报音色、英文段按"与中文播报者同性别"取音色（女声→女主），
      // 与旁白设定的性别无关（旁白只管独白/短文与英文题号）
      const titleSegs = segments.filter((s) => s.kind === 'title');
      expect(titleSegs).toHaveLength(3);
      expect(titleSegs[0].voice).toBe(LISTENING_ZH_VOICE);
      expect(titleSegs[1].voice).toBe(LISTENING_VOICES.us.W);
    });
  });

  describe('中文播报音色独立配置（zhVoice 覆盖）', () => {
    it('overrides.zhVoice 生效：开场白 / 分节指令 / 部分标题 / 结束语全用所选中文音色', () => {
      const zh = 'zh-CN-YunjianNeural';
      const { segments } = buildListeningStoryboard({
        stage: '小学',
        grade: '六年级',
        announceTitle: false,
        soundCheck: false,
        overrides: { zhVoice: zh },
        items: [{ no: 1, instruction: '第一节：听下面5段对话。', lines: [{ role: 'W', text: 'Hello.' }] }],
      });
      const zhSegs = segments.filter((s) => s.kind === 'opening' || s.kind === 'part' || s.kind === 'instruction' || s.kind === 'closing');
      expect(zhSegs.length).toBeGreaterThan(0);
      for (const s of zhSegs) expect(s.voice).toBe(zh);
    });

    it('未覆盖时默认晓晓（LISTENING_ZH_VOICE）', () => {
      const { segments } = buildListeningStoryboard({
        stage: '小学',
        grade: '六年级',
        announceTitle: false,
        soundCheck: false,
        items: [{ no: 1, lines: [{ role: 'W', text: 'Hello.' }] }],
      });
      const opening = segments.find((s) => s.kind === 'opening');
      expect(opening.voice).toBe(LISTENING_ZH_VOICE);
    });
  });
});

describe('2026-09-20 语速按调研实证校准（不凭猜测）', () => {
  it('小学高段 120（调研 110-120 上沿，用户反馈"太慢"后取区间上沿）；低/中段不变', () => {
    expect(LISTENING_STAGE_WPM.primary_low).toBe(80);
    expect(LISTENING_STAGE_WPM.primary_mid).toBe(95);
    expect(LISTENING_STAGE_WPM.primary_high).toBe(120);
  });

  it('初中按年级：七 110 / 八 120 / 九 130（杭州真题 128、教研"120 词/分钟"之上沿）', () => {
    expect(LISTENING_GRADE_WPM[7]).toBe(110);
    expect(LISTENING_GRADE_WPM[8]).toBe(120);
    expect(LISTENING_GRADE_WPM[9]).toBe(130);
  });

  it('高中 150（2024 新课标Ⅰ卷真题 ≈154、广东高考听说 ≈150），下限 140（真题分析 137-154 下沿）', () => {
    expect(LISTENING_STAGE_WPM.high).toBe(150);
    expect(LISTENING_HIGH_MIN_WPM).toBe(140);
    const p = resolveListeningParams({ stage: '高中', overrides: { wpm: 120 } });
    expect(p.wpm).toBe(LISTENING_HIGH_MIN_WPM);
  });

  it('六年级 ratePercent 按 160 基准换算（120/160-1 = -25%，较原 -28% 提升三档）', () => {
    const p = resolveListeningParams({ stage: '小学', grade: '六年级' });
    expect(p.ratePercent).toBe(-25);
  });

  it('🔴 五档学段都有语速且有建议区间（小学低/中/高各自独立，不得漏配）', () => {
    for (const k of ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high']) {
      expect(Number.isFinite(LISTENING_STAGE_WPM[k]), `${k} 缺语速`).toBe(true);
      const r = LISTENING_STAGE_WPM_RANGE[k];
      expect(Array.isArray(r) && r.length === 2, `${k} 缺建议区间`).toBe(true);
      // 默认值必须落在自己的建议区间内（否则一进界面就报"超出区间"）
      expect(LISTENING_STAGE_WPM[k], `${k} 默认值不在建议区间`).toBeGreaterThanOrEqual(r[0]);
      expect(LISTENING_STAGE_WPM[k], `${k} 默认值不在建议区间`).toBeLessThanOrEqual(r[1]);
    }
  });

  it('小学三档语速与建议区间（低 80 / 中 95[90-100] / 高 120[110-120]）逐档可查', () => {
    const pick = (grade) => {
      const p = resolveListeningParams({ stage: '小学', grade });
      return [p.stageKey, p.wpm, LISTENING_STAGE_WPM_RANGE[p.stageKey]];
    };
    expect(pick('二年级')).toEqual(['primary_low', 80, [80, 80]]);
    expect(pick('四年级')).toEqual(['primary_mid', 95, [90, 100]]);
    expect(pick('六年级')).toEqual(['primary_high', 120, [110, 120]]);
    // 三档互不相同（低段本就该比高段慢）
    const wpms = ['二年级', '四年级', '六年级'].map((g) => resolveListeningParams({ stage: '小学', grade: g }).wpm);
    expect(new Set(wpms).size).toBe(3);
    expect(wpms[0]).toBeLessThan(wpms[1]);
    expect(wpms[1]).toBeLessThan(wpms[2]);
  });
});

/**
 * ⏳ 静默作答时间可调（2026-09-20 用户："静默答题的时间是用户可调吗？还是硬编码的？有范围可供用户调整吗？"）
 * 修复前：只有矩阵默认值（硬编码），面板未暴露。现补"默认 + 可调区间 + 三档分别覆盖"，
 * 并保留考试文本优先的红线：节指令写明"X 秒钟作答"的题以指令为准，不被用户设定翻转。
 */
describe('静默作答时间：三档默认 / 可调区间 / 覆盖生效 / 指令优先', () => {
  it('三档各有默认值且都有建议区间，默认值落在区间内（否则一进面板就报越界）', () => {
    for (const tier of ['short', 'long', 'fillIn']) {
      const r = LISTENING_ANSWER_GAP_RANGE[tier];
      expect(Array.isArray(r) && r.length === 2, `${tier} 缺区间`).toBe(true);
      expect(r[0], `${tier} 区间下限不得大于上限`).toBeLessThan(r[1]);
    }
    // 三档默认：短材料按学段 5/6/8/10/10；独白对多题 5 秒（真题"各小题 5 秒钟"）；补全短文 30 秒
    expect(LISTENING_PAUSE.answerGapMs.primary_high).toBe(8000);
    expect(LISTENING_PAUSE.longMaterialAnswerGapMs).toBe(5000);
    expect(LISTENING_PAUSE.fillInAnswerGapMs).toBe(30000);
    for (const [stageKey, ms] of Object.entries(LISTENING_PAUSE.answerGapMs)) {
      const sec = ms / 1000;
      expect(sec, `${stageKey} 默认 ${sec} 秒不在建议区间`).toBeGreaterThanOrEqual(LISTENING_ANSWER_GAP_RANGE.short[0]);
      expect(sec, `${stageKey} 默认 ${sec} 秒不在建议区间`).toBeLessThanOrEqual(LISTENING_ANSWER_GAP_RANGE.short[1]);
    }
    for (const [ms, tier] of [[LISTENING_PAUSE.longMaterialAnswerGapMs, 'long'], [LISTENING_PAUSE.fillInAnswerGapMs, 'fillIn']]) {
      const sec = ms / 1000;
      expect(sec).toBeGreaterThanOrEqual(LISTENING_ANSWER_GAP_RANGE[tier][0]);
      expect(sec).toBeLessThanOrEqual(LISTENING_ANSWER_GAP_RANGE[tier][1]);
    }
  });

  it('🔴 三档可分别覆盖：短材料 / 独白对多题 / 补全短文各走自己的覆盖值', () => {
    const longSolo = [{ role: 'W', text: 'Last week, Lily took part in a storytelling competition and she practised telling stories every day until she finally did her best in the end.' }];
    const PAUSES = { answerGapMs: { primary_high: 12000 }, longMaterialAnswerGapMs: 8000, fillInAnswerGapMs: 45000 };
    // 每档单独建一份（避免"换节再叠 betweenSectionsMs"这一无关因素干扰，那是另一条不变量）
    const gapOf = (item) => {
      const { segments } = buildListeningStoryboard({
        stage: '小学', grade: '六年级', overrides: { pauses: PAUSES }, items: [item],
      });
      return segments.filter((s) => s.itemNo === item.no).pop().gapAfterMs;
    };
    const short = gapOf({ no: 1, lines: [{ role: 'W', text: 'Hello there.' }] });
    const long = gapOf({ no: 6, range: { materialNo: 6, from: 6, to: 8 }, lines: longSolo });
    const fillIn = gapOf({ no: 11, range: { from: 11, to: 15 }, instruction: '第三节：听录音，补全短文，每空一词。短文读两遍。', lines: longSolo });
    expect(short).toBe(12000);
    expect(long).toBe(8000);
    expect(fillIn).toBe(45000);
    // 三档互不相同：证明是三条独立通道，不是一个值糊过去
    expect(new Set([short, long, fillIn]).size).toBe(3);

    // 参数层同样能看到覆盖值（面板显示的"实际生效"取自这里）
    const { params } = buildListeningStoryboard({
      stage: '小学', grade: '六年级', overrides: { pauses: PAUSES },
      items: [{ no: 1, lines: [{ role: 'W', text: 'Hello there.' }] }],
    });
    expect(params.answerGapMs).toBe(12000);
    expect(params.pauses.longMaterialAnswerGapMs).toBe(8000);
    expect(params.pauses.fillInAnswerGapMs).toBe(45000);
    // 未覆盖的学段不受影响（只覆盖了 primary_high，初中档仍是矩阵默认）
    expect(params.pauses.answerGapMs.middle).toBe(10000);
  });

  it('🔴 考试文本优先：节指令写明"X 秒钟作答"的题以指令为准，用户覆盖对该题不生效', () => {
    const { segments } = buildListeningStoryboard({
      stage: '小学',
      grade: '六年级',
      overrides: { pauses: { answerGapMs: { primary_high: 20000 }, fillInAnswerGapMs: 60000 } },
      items: [
        // answerSec 由解析层从节指令"每小题 8 秒钟作答"得出（此处直接给定，等价于解析结果）
        { no: 11, answerSec: 8, instruction: '第三节：听录音，补全短文，每空一词。每小题 8 秒钟作答。短文读两遍。', lines: [{ role: 'W', text: 'Last month our school had an International Culture Festival and I practised every single day.' }] },
      ],
    });
    // 8 秒＝指令声明值，既不是 20 秒（短材料覆盖值）也不是 60 秒（补全短文覆盖值）
    expect(segments.filter((s) => s.itemNo === 11).pop().gapAfterMs).toBe(8000);
  });

  it('朗读稿把三档实际值都写出来（供人工核对覆盖是否生效）', () => {
    const { text } = buildListeningScriptText({
      stage: '小学', grade: '六年级', announceTitle: false, soundCheck: false,
      overrides: { pauses: { answerGapMs: { primary_high: 12000 }, longMaterialAnswerGapMs: 8000, fillInAnswerGapMs: 45000 } },
      items: [{ no: 1, lines: [{ role: 'W', text: 'Hello there.' }] }],
    });
    expect(text).toContain('短材料 12 秒');
    expect(text).toContain('独白/短文 8 秒');
    expect(text).toContain('补全短文 45 秒');
  });
});
