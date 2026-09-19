import { describe, it, expect } from 'vitest';
import {
  LISTENING_STAGE_WPM,
  LISTENING_GRADE_WPM,
  LISTENING_HIGH_MIN_WPM,
  LISTENING_ACCENT_POLICY,
  LISTENING_BASE_WPM,
  LISTENING_VOICES,
  resolveListeningParams,
  missingListeningStages,
} from '../../src/config/listeningAudioProfile.js';
import {
  buildListeningStoryboard,
  buildListeningSsml,
  buildListeningScriptText,
  normalizeForSpeech,
  pickAccentForItem,
  buildOpeningAnnouncement,
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
    expect(s.startsWith('<speak version="1.0"')).toBe(true);
    expect(s.trimEnd().endsWith('</speak>')).toBe(true);
    expect(s).toContain('<voice name="en-US-GuyNeural">');
    // 基准已实测校准（LISTENING_BASE_WPM），八年级 120 词/分 → 百分比从常量推导，避免写死
    expect(s).toContain(`<prosody rate="${Math.round((120 / LISTENING_BASE_WPM - 1) * 100)}%">`);
    expect(s).toContain('<break time="800ms"/>');
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
  it('开场白净化标题：去掉生成时间戳与扩展名，且不朗读时间', () => {
    expect(buildOpeningAnnouncement('六年级英语上册Unit 1 阶段测评_2026/9/19 13:20:14'))
      .toBe('六年级英语上册Unit 1 阶段测评，听力考试现在开始。');
    expect(buildOpeningAnnouncement('Unit 1 测评_2026-09-19')).toBe('Unit 1 测评，听力考试现在开始。');
    expect(buildOpeningAnnouncement('听力卷.docx')).toBe('听力卷，听力考试现在开始。');
  });

  it('无标题时回退到国标固定播报', () => {
    expect(buildOpeningAnnouncement('')).toBe('听力考试现在开始。');
  });

  it('storyboard 首段为开场白、末段为结束语，均为中文音色且不加英文慢速', () => {
    const { segments } = buildListeningStoryboard({
      stage: '初中', grade: '八年级', title: '八年级英语期中测评', items: [DIALOG],
    });
    const first = segments[0];
    const last = segments[segments.length - 1];
    expect(first.kind).toBe('opening');
    expect(first.voice).toBe('zh-CN-XiaoxiaoNeural');
    expect(first.text).toContain('八年级英语期中测评');
    expect(first.ratePercent).toBe(0);
    expect(last.kind).toBe('closing');
    expect(last.text).toBe('听力部分到此结束。');
    expect(last.voice).toBe('zh-CN-XiaoxiaoNeural');
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

  it('朗读稿按"开场白/结束语"单独标注，便于真人逐段录制', () => {
    const { text } = buildListeningScriptText({
      stage: '初中', grade: '八年级', stageLabel: '初中', title: '八年级英语期中测评', items: [DIALOG],
    });
    expect(text).toContain('开场白（中文播报）');
    expect(text).toContain('八年级英语期中测评，听力考试现在开始。');
    expect(text).toContain('结束语（中文播报）');
    expect(text).toContain('听力部分到此结束。');
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
