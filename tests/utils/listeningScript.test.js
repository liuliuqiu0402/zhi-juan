import { describe, it, expect } from 'vitest';
import {
  LISTENING_STAGE_WPM,
  LISTENING_GRADE_WPM,
  LISTENING_HIGH_MIN_WPM,
  LISTENING_ACCENT_POLICY,
  LISTENING_BASE_WPM,
  LISTENING_VOICES,
  LISTENING_SOUND_CHECK,
  LISTENING_FEATURE_DEFAULTS,
  resolveListeningParams,
  missingListeningStages,
} from '../../src/config/listeningAudioProfile.js';
import {
  buildListeningStoryboard,
  buildListeningSsml,
  buildListeningScriptText,
  normalizeForSpeech,
  pickAccentForItem,
  isMultiQuestion,
  buildOpeningAnnouncement,
  buildSoundCheckIntro,
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
    // 旁白/播报已改男声（原 Aria 女声与女声 Jenny 同为女声 → 整卷只有女声）
    expect(s).toContain('<voice name="en-US-GuyNeural">');
    // 基准已实测校准（LISTENING_BASE_WPM），八年级 120 词/分 → 百分比从常量推导，避免写死
    expect(s).toContain(`<prosody rate="${Math.round((120 / LISTENING_BASE_WPM - 1) * 100)}%">`);
    // 两遍之间的留白从常量推导（2026-09-19 由 800ms 校正为 2500ms，防写死后再次与配置漂移）
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
 */
describe('正规音频格式：开场白 / 分节指令 / 结束语', () => {
  it('🔴 默认按正规（国标）开场白：只播固定播报，不朗读试卷标题', () => {
    // 国标真题音频不读试卷标题；用户裁定"全部按正规的来" → 默认关（标题含英文时中文音色会读得怪）
    expect(buildOpeningAnnouncement('六年级英语上册Unit 1 Try your best测试卷_2026/9/19 13:20:14'))
      .toBe('听力考试现在开始。');
    expect(buildOpeningAnnouncement('')).toBe('听力考试现在开始。');
  });

  it('校/区级需要播报考试名称时，announceTitle 打开并净化生成时间戳', () => {
    expect(buildOpeningAnnouncement('六年级英语上册Unit 1 阶段测评_2026/9/19 13:20:14', { announceTitle: true }))
      .toBe('六年级英语上册Unit 1 阶段测评，听力考试现在开始。');
    expect(buildOpeningAnnouncement('Unit 1 测评_2026-09-19', { announceTitle: true }))
      .toBe('Unit 1 测评，听力考试现在开始。');
    expect(buildOpeningAnnouncement('听力卷.docx', { announceTitle: true })).toBe('听力卷，听力考试现在开始。');
    // 无标题时仍回退固定播报
    expect(buildOpeningAnnouncement('', { announceTitle: true })).toBe('听力考试现在开始。');
  });

  it('storyboard 首段为试音提示语、末段为结束语，均为中文音色且不加英文慢速', () => {
    const { segments } = buildListeningStoryboard({
      stage: '初中', grade: '八年级', title: '八年级英语期中测评', items: [DIALOG],
    });
    const first = segments[0];
    const last = segments[segments.length - 1];
    // 默认开启试音段 → 首段是"下面是听力试音时间"（中文播报，国标默认不读试卷标题）
    expect(first.kind).toBe('soundcheck');
    expect(first.voice).toBe('zh-CN-XiaoxiaoNeural');
    expect(first.text, '默认不读试卷标题').toBe(LISTENING_SOUND_CHECK.intro);
    expect(first.ratePercent).toBe(0);
    expect(last.kind).toBe('closing');
    expect(last.text).toBe('听力部分到此结束。');
    expect(last.voice).toBe('zh-CN-XiaoxiaoNeural');
    // 打开开关时才播报考试名称（校/区级做法）
    const withTitle = buildListeningStoryboard({
      stage: '初中', grade: '八年级', title: '八年级英语期中测评', items: [DIALOG], announceTitle: true,
    });
    expect(withTitle.segments[0].text).toContain('八年级英语期中测评');
    // 关掉试音段 → 退回单句开场白（校内小测形态）
    const noSc = buildListeningStoryboard({
      stage: '初中', grade: '八年级', title: '八年级英语期中测评', items: [DIALOG], soundCheck: false,
    });
    expect(noSc.segments[0].kind).toBe('opening');
    expect(noSc.segments[0].text).toBe('听力考试现在开始。');
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

  it('朗读稿按"试音/开场白/结束语"单独标注，便于真人逐段录制', () => {
    const { text } = buildListeningScriptText({
      stage: '初中', grade: '八年级', stageLabel: '初中', title: '八年级英语期中测评', items: [DIALOG],
    });
    // 默认带试音段：朗读稿须把"中文播报 + 英文试音对话"整段标出来，真人照读不会漏
    expect(text).toContain('试音（中文播报 + 英文对话）');
    expect(text).toContain(LISTENING_SOUND_CHECK.intro);
    expect(text).toContain(LISTENING_SOUND_CHECK.toExam);
    expect(text).toMatch(/男：Hello, this is the school office calling\./);
    expect(text).toContain('结束语（中文播报）');
    expect(text).toContain('听力部分到此结束。');
    expect(text, '默认不读试卷标题').not.toContain('八年级英语期中测评（');
    // 关掉试音段 → 退回"开场白"形态
    const plain = buildListeningScriptText({
      stage: '初中', grade: '八年级', stageLabel: '初中', items: [DIALOG], soundCheck: false,
    });
    expect(plain.text).toContain('开场白（中文播报）');
    expect(plain.text).toContain('听力考试现在开始。');
    // 需要播报考试名称时（校/区级做法）打开开关，朗读稿同步
    const withTitle = buildListeningScriptText({
      stage: '初中', grade: '八年级', stageLabel: '初中', title: '八年级英语期中测评', items: [DIALOG], announceTitle: true, soundCheck: false,
    });
    expect(withTitle.text).toContain('八年级英语期中测评，听力考试现在开始。');
  });

  it('试音起始语：默认只念固定提示语，announceTitle 时先报考试名称并净化时间戳', () => {
    expect(buildSoundCheckIntro('八年级英语期中测评')).toBe(LISTENING_SOUND_CHECK.intro);
    expect(buildSoundCheckIntro('八年级英语期中测评', { announceTitle: true }))
      .toBe(`八年级英语期中测评。${LISTENING_SOUND_CHECK.intro}`);
    expect(buildSoundCheckIntro('听力卷_2026-09-19', { announceTitle: true }))
      .toBe(`听力卷。${LISTENING_SOUND_CHECK.intro}`);
    expect(buildSoundCheckIntro('', { announceTitle: true })).toBe(LISTENING_SOUND_CHECK.intro);
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
 * 🎛 两个可选环节的开关（2026-09-19 用户裁定）：
 *   试音段默认开（正规录音先试音再开考）；一题一材料处的题号默认关（国标第一节不播小题号）。
 * 锁定"默认值＝正规口径"，防止有人把默认值改回非正规形态。
 */
describe('可选环节开关：试音段 / 一题一材料题号', () => {
  const items = [{ no: 1, lines: [{ role: 'M', text: 'Hi.' }] }];

  it('默认值取自单一事实源，且就是"正规考试口径"', () => {
    expect(LISTENING_FEATURE_DEFAULTS.soundCheck).toBe(true);
    expect(LISTENING_FEATURE_DEFAULTS.announceShortItemNo).toBe(false);
    const { segments } = buildListeningStoryboard({ stage: '初中', grade: '八年级', items });
    // 默认带试音：首段试音提示语、末段（结束语前）试音收尾
    expect(segments[0].kind).toBe('soundcheck');
    expect(segments[0].text).toBe(LISTENING_SOUND_CHECK.intro);
    const sc = segments.filter((s) => s.kind === 'soundcheck');
    expect(sc[sc.length - 1].text).toBe(LISTENING_SOUND_CHECK.toExam);
    // 默认不播小题号
    expect(segments.filter((s) => s.kind === 'itemno')).toHaveLength(0);
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

  it('开关只影响对应的段，不改变材料/遍数/作答留白', () => {
    const base = buildListeningStoryboard({ stage: '初中', grade: '八年级', items });
    const off = buildListeningStoryboard({ stage: '初中', grade: '八年级', items, soundCheck: false });
    const strip = (r) => r.segments.filter((s) => s.kind === 'material' || s.kind === 'repeat' || s.kind === 'closing');
    expect(strip(off)).toEqual(strip(base));
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

  it('🔴 题号播报：默认按国标（短材料不播）；一段对多题只在源文本给了范围时播，给不出就不报', () => {
    const { segments } = build();
    // 国标口径（默认）：一题一材料处**不播小题号**，靠作答间隔与卷面题号定位。
    //   第 3 题是独白（一段对多题）但没给题号范围 → 同样**整条不报**（宁可不报，也不报错——
    //   原实现按条数顺编，实测把这节报成了"第七题"，而它实为第 11~15 题）
    expect(segments.filter((s) => s.kind === 'itemno')).toHaveLength(0);

    // 小学/校内卷需要逐题报号时打开开关 → 短材料报"第N题"，语音校验/位置不变
    const withNo = buildListeningStoryboard({
      stage: '小学', grade: '六年级', items,
      announceShortItemNo: true,
    }).segments;
    const nos = withNo.filter((s) => s.kind === 'itemno');
    expect(nos.map((s) => s.text)).toEqual(['第1题。', '第2题。']);
    expect(nos.every((s) => s.voice === 'zh-CN-XiaoxiaoNeural')).toBe(true);
    expect(withNo.findIndex((s) => s.kind === 'itemno' && s.itemNo === 2))
      .toBeLessThan(withNo.findIndex((s) => s.kind === 'material' && s.itemNo === 2));

    // 源文本写明题号范围后 → 按真题书面写法报"听第N段材料，回答第X～Y小题"
    const longLines = [{ role: 'W', text: 'Last week, Lily took part in a storytelling competition. At first, she was afraid, but she practised every day and finally did her best in front of everyone.' }];
    const withRange = buildListeningStoryboard({
      stage: '小学',
      grade: '六年级',
      items: [
        { no: 1, instruction: '第一节：听录音，选出你所听到的单词或图片。每小题读两遍。', lines: [{ role: 'N', text: 'tree' }] },
        { no: 6, range: { materialNo: 6, from: 6, to: 10 }, instruction: '第二节：听录音，判断下列句子是否与录音内容相符。每段对话或独白读两遍。', lines: longLines },
      ],
    }).segments;
    // 国标书面写法：阿拉伯题号 + 「小题」；该项**不受** announceShortItemNo 影响，始终播报
    expect(withRange.filter((s) => s.kind === 'itemno').map((s) => s.text))
      .toEqual(['听第6段材料，回答第6至10小题。']);
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

  it('提示音：开考、换节、题与题之间都有（chimeBefore），材料段不带', () => {
    const { segments } = build();
    expect(segments[0].chimeBefore, '试音提示语＝全卷第一个提示音').toBe(true);
    expect(segments.find((s) => s.kind === 'instruction' && s.itemNo === 3).chimeBefore, '换节提示音').toBe(true);
    const withNo = buildListeningStoryboard({
      stage: '小学', grade: '六年级', items, announceShortItemNo: true,
    }).segments;
    const nos = withNo.filter((s) => s.kind === 'itemno');
    expect(nos.find((s) => s.itemNo === 2).chimeBefore, '题与题之间的提示音').toBe(true);
    expect(nos.find((s) => s.itemNo === 1).chimeBefore, '节首由指令的提示音覆盖，不重复响铃').toBe(false);
    expect(segments.filter((s) => s.kind === 'material' || s.kind === 'repeat').every((s) => !s.chimeBefore)).toBe(true);
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

  it('🔴 同卷独白/短文播报者一致：未标注的长材料沿用同卷已标注的独白音色', () => {
    const { segments } = buildListeningStoryboard({
      stage: '小学',
      grade: '六年级',
      items: [
        { no: 6, lines: [{ role: 'W', text: 'Last week, Lily took part in a storytelling competition and she practised telling stories every day until she finally did her best in the end.' }] },
        { no: 11, lines: [{ role: 'N', text: 'Last month, our school had an International Culture Festival and I wanted to be a culture ambassador so I practised every single day.' }] },
      ],
    });
    const first = segments.find((s) => s.kind === 'material' && s.itemNo === 6);
    const second = segments.find((s) => s.kind === 'material' && s.itemNo === 11);
    expect(first.voice).toBe(LISTENING_VOICES.us.W);
    expect(second.voice, '未标注的短文应与同卷独白同一播报者，不得中途换人').toBe(LISTENING_VOICES.us.W);
  });
});
