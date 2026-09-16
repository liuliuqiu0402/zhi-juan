import { describe, it, expect } from 'vitest';
import {
  parseListeningSourceText,
  needAiFallback,
  normalizeRole,
  matchItemNumber,
  splitSpeakerPrefix,
  splitDashPrefix,
  extractListeningSource,
  OPTION_LINE_RE,
} from '../../src/utils/listeningExtract.js';
import { buildListeningStoryboard, buildListeningSsml } from '../../src/utils/listeningScript.js';
import { LISTENING_VOICES } from '../../src/config/listeningAudioProfile.js';

/**
 * 规则解析器（确定性优先 · 2026-09-16 用户要求「确保解析结构要对」）
 * ============================================================
 * 覆盖真实答案页可能出现的各种听力原文形态，锁定：题号、说话人身份、独白/对话判定、
 * 噪声与选项行剔除、续行合并。规则能定的事不交给模型，故必须逐形态锁死。
 * ============================================================
 */

describe('题号识别', () => {
  it('支持 第1题 / 数字 / 括号 / Text N / 材料一', () => {
    expect(matchItemNumber('第1题').no).toBe(1);
    expect(matchItemNumber('第 12 小题').no).toBe(12);
    expect(matchItemNumber('3. Excuse me.').no).toBe(3);
    expect(matchItemNumber('3、Excuse me.').no).toBe(3);
    expect(matchItemNumber('(4) Excuse me.').no).toBe(4);
    expect(matchItemNumber('Text 5 Tom is here.').no).toBe(5);
    expect(matchItemNumber('材料一：Tom is here.').no).toBe(1);
    expect(matchItemNumber('听力材料二').no).toBe(2);
  });

  it('小数/年份不被误判为题号', () => {
    expect(matchItemNumber('3.5 kilometres away')).toBeNull();
    expect(matchItemNumber('2024 was a good year')).toBeNull();
  });

  it('普通句子不误判', () => {
    expect(matchItemNumber('Excuse me, where is the library?')).toBeNull();
  });
});

describe('说话人识别', () => {
  it('只认冒号形式的说话人前缀', () => {
    expect(splitSpeakerPrefix('M: Hello').role).toBe('M');
    expect(splitSpeakerPrefix('W：Hello').role).toBe('W');
    expect(splitSpeakerPrefix('Man: Hello').role).toBe('M');
    expect(splitSpeakerPrefix('Woman: Hello').role).toBe('W');
    expect(splitSpeakerPrefix('Narrator: Hello').role).toBe('N');
    expect(splitSpeakerPrefix('男：你好').role).toBe('M');
    expect(splitSpeakerPrefix('女：你好').role).toBe('W');
    expect(splitSpeakerPrefix('旁白：你好').role).toBe('N');
  });

  it('🔴 选项行 A. / A． 不得被当成说话人', () => {
    expect(splitSpeakerPrefix('A. London')).toBeNull();
    expect(splitSpeakerPrefix('B．Because it is fun')).toBeNull();
    expect(OPTION_LINE_RE.test('A. London')).toBe(true);
    expect(OPTION_LINE_RE.test('(C) At seven')).toBe(true);
  });

  it('身份可辨但性别未知的标签保留原样（不折叠成旁白）', () => {
    expect(normalizeRole('A')).toBe('A');
    expect(normalizeRole('B')).toBe('B');
    expect(normalizeRole('S2')).toBe('S2');
    expect(normalizeRole('Speaker1')).toBe('S1');
    expect(normalizeRole('说话人2')).toBe('S2');
    expect(normalizeRole('')).toBe('N');
    expect(normalizeRole('乱码')).toBe('N');
  });

  it('破折号识别', () => {
    expect(splitDashPrefix('— Excuse me.').text).toBe('Excuse me.');
    expect(splitDashPrefix('– It is here.').text).toBe('It is here.');
    expect(splitDashPrefix('Excuse me.')).toBeNull();
  });
});

describe('规则解析：真实形态', () => {
  it('M/W 前缀 + 数字题号（最标准的形态）', () => {
    const r = parseListeningSourceText(
      '【听力原文】\n'
      + '1. M: Excuse me, where is the library?\n'
      + 'W: It is next to the bank.\n'
      + '2. M: What time does the film start?\n'
      + 'W: At seven thirty.\n'
    );
    expect(r.items).toHaveLength(2);
    expect(r.items[0].no).toBe(1);
    expect(r.items[0].lines.map((l) => l.role)).toEqual(['M', 'W']);
    expect(r.items[0].lines[0].text).toBe('Excuse me, where is the library?');
    expect(r.items[1].no).toBe(2);
    expect(r.stats.distinctSpeakers).toBe(2);
    // 标题行【听力原文】不该进 lines
    expect(r.items.flatMap((i) => i.lines).some((l) => /听力原文/.test(l.text))).toBe(false);
  });

  it('中文角色标签 男/女', () => {
    const r = parseListeningSourceText('第1题\n男：Where are you going?\n女：To the park.');
    expect(r.items[0].lines.map((l) => l.role)).toEqual(['M', 'W']);
    expect(r.items[0].lines[1].text).toBe('To the park.');
  });

  it('破折号对话按交替说话人处理，且是两人而非一人', () => {
    const r = parseListeningSourceText('1. — Excuse me.\n— Yes?\n— Where is the bank?');
    expect(r.items[0].lines.map((l) => l.role)).toEqual(['A', 'B', 'A']);
    expect(r.stats.distinctSpeakers).toBe(2);
  });

  it('整段独白（无角色）合并为单条旁白', () => {
    const r = parseListeningSourceText(
      '1. Tom is a student.\nHe goes to school by bus every day.\nHe likes English very much.'
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0].lines).toHaveLength(1);
    expect(r.items[0].lines[0].role).toBe('N');
    expect(r.items[0].lines[0].text).toBe('Tom is a student. He goes to school by bus every day. He likes English very much.');
  });

  it('续行（无角色前缀）并入上一位说话人，不另起说话人', () => {
    const r = parseListeningSourceText('1. M: I want to go to the cinema\nthis evening with my sister.\nW: Good idea.');
    const lines = r.items[0].lines;
    expect(lines).toHaveLength(2);
    expect(lines[0].role).toBe('M');
    expect(lines[0].text).toBe('I want to go to the cinema this evening with my sister.');
    expect(lines[1].role).toBe('W');
  });

  it('Text N 与 材料N 都能切条', () => {
    const r = parseListeningSourceText('Text 1\nM: Hi.\nText 2\nW: Hello.');
    expect(r.items.map((i) => i.no)).toEqual([1, 2]);
  });

  it('中文播音指令归入导语，不进材料', () => {
    const r = parseListeningSourceText('听下面一段对话，回答第1题。\n1. M: Hi.\nW: Hello.');
    expect(r.intro).toContain('听下面一段对话');
    expect(r.items[0].lines.map((l) => l.text)).toEqual(['Hi.', 'Hello.']);
  });

  it('分值行/页码/解析标记被剔除', () => {
    const r = parseListeningSourceText('1. M: Hi.\n（共5分）\n第 2 页\n【解析】本题考查听力。\nW: Hello.');
    expect(r.items[0].lines.map((l) => l.text)).toEqual(['Hi.', 'Hello.']);
  });
});

describe('🔴 选项行剔除（否则会把答案字母读进听力音频）', () => {
  it('选项行被剔除并给出可见提示', () => {
    const r = parseListeningSourceText(
      '1. M: Where is the library?\nA. Next to the bank.\nB. In the park.\nC. At school.\nW: Sorry?'
    );
    const texts = r.items[0].lines.map((l) => l.text);
    expect(texts).not.toContain('Next to the bank.');
    expect(texts.some((t) => /^[A-D]\b/.test(t))).toBe(false);
    expect(r.stats.optionDropped).toBe(3);
    expect(r.warnings.join()).toContain('已剔除 3 行选项');
  });
});

describe('可信度判定：规则能定就不调模型', () => {
  it('有题号且每条有内容 → 不需要 AI', () => {
    const r = parseListeningSourceText('1. M: Hi.\n2. W: Hello.');
    expect(needAiFallback(r)).toBe(false);
  });

  it('无题号但出现≥2个说话人 → 不需要 AI', () => {
    const r = parseListeningSourceText('M: Hi.\nW: Hello.');
    expect(needAiFallback(r)).toBe(false);
  });

  it('既无题号又只有单一说话人 → 需要 AI 兜底', () => {
    const r = parseListeningSourceText('Tom is a student. He likes English.');
    expect(needAiFallback(r)).toBe(true);
  });

  it('完全空输入 → 需要 AI 兜底', () => {
    expect(needAiFallback(parseListeningSourceText(''))).toBe(true);
  });
});

describe('说话人 → 音色（未知标签不得退化成单一音色）', () => {
  it('对话中未知标签按出现顺序交替男/女', () => {
    const { segments } = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: 1, lines: [
        { role: 'A', text: 'Hi.' },
        { role: 'B', text: 'Hello.' },
        { role: 'A', text: 'Bye.' },
      ] }],
    });
    const voices = segments.map((s) => s.voice);
    expect(voices[0]).toBe(LISTENING_VOICES.us.M);
    expect(voices[1]).toBe(LISTENING_VOICES.us.W);
    expect(voices[2]).toBe(LISTENING_VOICES.us.M);
  });

  it('独白里的单一未知标签用旁白音色', () => {
    const { segments } = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: 1, lines: [{ role: 'A', text: 'Tom is a student.' }] }],
    });
    expect(segments[0].voice).toBe(LISTENING_VOICES.us.N);
  });
});

describe('端到端：答案页 HTML → 结构化 → SSML（规则路径，无需模型）', () => {
  const answerHtml = '<h2>一、听力</h2><p>题目区不含原文</p>'
    + '<div class="answer-section"><h2>参考答案与评分标准</h2>'
    + '<p>1. B　　2. A</p>'
    + '<h3>听力原文</h3>'
    + '<p>1. M: Excuse me, where is the library?</p><p>W: It&apos;s next to the bank.</p>'
    + '<p>2. M: What time does the film start?</p><p>W: At seven thirty.</p>'
    + '</div>';

  it('从答案区取出听力原文并按题切条分角色', () => {
    const src = extractListeningSource(answerHtml);
    const parsed = parseListeningSourceText(src);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].lines.map((l) => l.role)).toEqual(['M', 'W']);
    expect(parsed.items[1].lines[0].text).toBe('What time does the film start?');
    expect(needAiFallback(parsed)).toBe(false);
  });

  it('产出的 SSML：男女分音色、读两遍、含题间留白，且不含答案字母', () => {
    const src = extractListeningSource(answerHtml);
    const parsed = parseListeningSourceText(src);
    const { ssml, params } = buildListeningSsml({ ...parsed, stage: '初中', grade: '八年级' });
    expect(ssml).toContain(`<voice name="${LISTENING_VOICES.us.M}">`);
    expect(ssml).toContain(`<voice name="${LISTENING_VOICES.us.W}">`);
    expect(ssml).toContain(`<break time="${params.answerGapMs}ms"/>`);
    // 两段材料 × 2 句 × 2 遍 = 8 个 voice 块
    expect((ssml.match(/<voice /g) || []).length).toBe(8);
    expect(ssml).not.toMatch(/<prosody[^>]*>\s*[A-D]\s*[.、．]/);
  });
});
