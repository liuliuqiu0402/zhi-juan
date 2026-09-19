import { describe, it, expect } from 'vitest';
import {
  LISTENING_STAGE_WPM,
  LISTENING_GRADE_WPM,
  LISTENING_HIGH_MIN_WPM,
  LISTENING_ACCENT_POLICY,
  LISTENING_BASE_WPM,
  LISTENING_VOICES,
  LISTENING_VOICE_CANDIDATES,
  LISTENING_VOICE_DEFAULTS,
  LISTENING_SOUND_CHECK,
  LISTENING_FEATURE_DEFAULTS,
  LISTENING_PART_ANNOUNCEMENT,
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

  it('🔴 三遍轮读音色不随开关变化（始终 男→女→男）', () => {
    for (const c of ALL_COMBOS) {
      const passes = combos(c).filter((s) => s.itemNo === 8 && (s.kind === 'material' || s.kind === 'repeat'));
      expect(passes.map((s) => s.role), JSON.stringify(c)).toEqual(['M', 'W', 'M']);
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
    // 头部：生效音色池 + 角色/音色计数
    expect(text).toContain('音色：男声 1 · Christopher　｜　女声 2 · Jenny　｜　男声 3 · Eric');
    expect(text).toContain('说话人：全书 3 个角色　｜　3 条音色');
    // 第 1 题两个角色 → 男主 + 女主
    expect(text).toContain('（音色）A → 男声 1 · Christopher　｜　B → 女声 2 · Jenny');
    // 第 2 题三个角色 → 三条不同音色（第三人用"男声副"）
    expect(text).toContain('（音色）A → 男声 1 · Christopher　｜　B → 女声 2 · Jenny　｜　C → 男声 3 · Eric');
    // 角色标签照原名显示，不再误标成"旁白"
    expect(text).toMatch(/\nA：Hi\./);
    expect(text).not.toMatch(/旁白：Hi\./);
    expect(warnings.join(), '三人三音色，不该告警').not.toContain('角色多于音色');
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
 * 🔊 遍数与音色（2026-09-19 用户问"两遍或者三遍的吧？分题型的吧？…不同遍数都是同一个音色吗？"）：
 *   遍数随考试/题型变化（高考第一节一遍、第二节两遍；小学部分题型三遍），一律以节指令为准；
 *   音色方面：两遍同一音色（同一说话人重读），三遍的单说话人材料按"男、女、男"轮读
 *   （实证：小学听力要求原文"男、女、男声中速各读一遍，每遍间隔 5 秒"）。
 */
describe('遍数与音色：一遍 / 两遍 / 三遍各有对待', () => {
  const SOLO = [{ role: 'N', text: 'Tom is a good boy and he likes reading books after school.' }];
  const longSolo = [{ role: 'N', text: 'Tom is a good boy and he likes reading books after school every single day with his best friend Jack.' }];

  it('读三遍的单说话人材料按 男→女→男 轮换音色，且叮咚只响一次（遍与遍之间不响）', () => {
    const { segments, warnings } = buildListeningStoryboard({
      stage: '小学', grade: '三年级',
      items: [{ no: 1, repeat: 3, instruction: '第一大题：听录音，选出你所听到的单词。每小题读三遍。', lines: SOLO }],
    });
    const passes = segments.filter((s) => s.itemNo === 1 && (s.kind === 'material' || s.kind === 'repeat'));
    expect(passes).toHaveLength(3);
    expect(passes.map((s) => s.role)).toEqual(['M', 'W', 'M']);
    expect(passes.map((s) => s.voice)).toEqual([LISTENING_VOICES.us.M, LISTENING_VOICES.us.W, LISTENING_VOICES.us.M]);
    // 叮咚落"一小题结束"的边界上（默认有英文题号 → 在题号之前），三遍之间一声都不响
    expect(passes.every((s) => !s.chimeBefore), '遍与遍之间不响').toBe(true);
    const mine = segments.filter((s) => s.itemNo === 1 && s.kind !== 'instruction');
    expect(mine.filter((s) => s.chimeBefore)).toHaveLength(1);
    expect(mine[0].kind).toBe('itemno');
    // 以指令为准：声明三遍即三遍，并显式登记与学段默认的偏离
    expect(warnings.join()).toContain('按播音指令读 3 遍');
  });

  it('读两遍（含一段材料对多题）仍是同一音色——同一说话人重读，换人才是错的', () => {
    const twoPass = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: 6, range: { materialNo: 6, from: 6, to: 7 }, lines: longSolo }],
    }).segments.filter((s) => s.itemNo === 6 && (s.kind === 'material' || s.kind === 'repeat'));
    expect(twoPass).toHaveLength(2);
    expect(twoPass[0].voice).toBe(twoPass[1].voice);
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
