import { describe, it, expect } from 'vitest';
import {
  parseListeningSourceText,
  needAiFallback,
  normalizeRole,
  matchItemNumber,
  splitSpeakerPrefix,
  splitDashPrefix,
  extractListeningSource,
  sliceListeningBlock,
  stripPaperNoise,
  looksLikeAnswerKey,
  parseAnnouncedRepeat,
  parseQuestionRange,
  normalizeListeningStructure,
  isCjkNoise,
  OPTION_LINE_RE,
} from '../../src/utils/listeningExtract.js';
import { buildListeningStoryboard, buildListeningSsml } from '../../src/utils/listeningScript.js';
import { LISTENING_VOICES, LISTENING_SOUND_CHECK } from '../../src/config/listeningAudioProfile.js';
import {
  buildAnswerFormatSpec,
  PAPER_OUTPUT_CONVENTIONS,
  LISTENING_SCRIPT_FORMAT,
  LISTENING_SCRIPT_FORMAT_REQUIREMENTS,
} from '../../src/config/promptLibrary.js';

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
    // 只看材料段：开场白/结束语属中文播报框架，不参与"说话人→音色"判定
    const voices = segments.filter((s) => s.kind === 'material').map((s) => s.voice);
    expect(voices[0]).toBe(LISTENING_VOICES.us.M);
    expect(voices[1]).toBe(LISTENING_VOICES.us.W);
    expect(voices[2]).toBe(LISTENING_VOICES.us.M);
  });

  it('独白里的单一未知标签用旁白音色', () => {
    const { segments } = buildListeningStoryboard({
      stage: '初中', grade: '八年级',
      items: [{ no: 1, lines: [{ role: 'A', text: 'Tom is a student.' }] }],
    });
    expect(segments.find((s) => s.kind === 'material').voice).toBe(LISTENING_VOICES.us.N);
  });
});

describe('契约 ↔ 解析器同源（源头格式契约与解析端一一对应）', () => {
  it('契约按学科门控注入：英语答案页与一次成型答案区都有，非英语没有', () => {
    const en = buildAnswerFormatSpec('英语');
    expect(en).toContain(LISTENING_SCRIPT_FORMAT);
    for (const req of LISTENING_SCRIPT_FORMAT_REQUIREMENTS) expect(en).toContain(req);
    // 防跨学科噪音
    expect(buildAnswerFormatSpec('数学')).not.toContain('听力原文');
    expect(PAPER_OUTPUT_CONVENTIONS.once('英语')).toContain(LISTENING_SCRIPT_FORMAT);
    expect(PAPER_OUTPUT_CONVENTIONS.once('数学')).not.toContain('听力原文');
  });

  it('契约要求的关键标记，解析器全部支持', () => {
    expect(LISTENING_SCRIPT_FORMAT).toContain('M:');
    expect(LISTENING_SCRIPT_FORMAT).toContain('W:');
    expect(LISTENING_SCRIPT_FORMAT).toContain('题号');
    expect(splitSpeakerPrefix('M: Hi').role).toBe('M');
    expect(splitSpeakerPrefix('W: Hi').role).toBe('W');
    expect(matchItemNumber('1. Hi').no).toBe(1);
  });

  it('🔴 噪音边界：非英语全学科 + 全部注入函数都不含听力契约（逐条锁死，防跨学科污染）', () => {
    const others = ['数学', '语文', '物理', '化学', '生物', '历史', '地理',
      '道德与法治', '科学', '信息科技', '音乐', '美术', '体育', '劳动', ''];
    for (const s of others) {
      expect(buildAnswerFormatSpec(s)).not.toContain('听力原文');
      expect(buildAnswerFormatSpec(s)).not.toContain(LISTENING_SCRIPT_FORMAT);
      for (const self of [false, true]) {
        expect(PAPER_OUTPUT_CONVENTIONS.once(s, self)).not.toContain('听力原文');
        expect(PAPER_OUTPUT_CONVENTIONS.split(s, self)).not.toContain('听力原文');
      }
    }
  });

  it('🔴 严格按契约写出的听力原文 → 解析器完美还原，且不需要 AI 兜底', () => {
    const contractCompliant = [
      '1. M: Excuse me, where is the library?',
      'W: It is next to the bank.',
      '2. M: What time does the film start?',
      'W: At seven thirty.',
      '3. Tom is a student. He goes to school by bus.',
    ].join('\n');
    const r = parseListeningSourceText(contractCompliant);
    expect(needAiFallback(r)).toBe(false);
    expect(r.items.map((i) => i.no)).toEqual([1, 2, 3]);
    expect(r.items[0].lines.map((l) => l.role)).toEqual(['M', 'W']);
    expect(r.items[1].lines.map((l) => l.role)).toEqual(['M', 'W']);
    expect(r.items[2].lines.map((l) => l.role)).toEqual(['N']);
    // 契约合规的输入不应触发任何"剔除/跳过"提示
    expect(r.warnings.filter((w) => /剔除|跳过/.test(w))).toEqual([]);
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
    // 段数 = 试音段（提示语 1 + 试音对话 N + 收尾 1）+ 部分标题 1 + 英文题号 2 + 材料 8 + 结束语 1
    //   （2026-09-19：新增试音段与「第一部分 听力部分」；一题一材料处默认播英文「Number N.」；
    //     本例未传 title，故无「试卷标题」段）
    const soundCheckSegs = LISTENING_SOUND_CHECK.lines.length + 2;
    expect((ssml.match(/<voice /g) || []).length).toBe(soundCheckSegs + 1 + 2 + 8 + 1);
    expect(ssml).not.toMatch(/<prosody[^>]*>\s*[A-D]\s*[.、．]/);
  });
});

/**
 * 🔴 2026-09-19 根因修复：听力工具曾把**整张答案页**（卷面指令/答案键/笔试/范文/评分）
 * 当作听力材料朗读，导致音频里中文被英文音色乱念、答案与范文一起被读出来。
 * 以下用例锁定"源头小节截取 + 解析兜底清洗"两道防线。
 */
describe('🔴 只读听力原文：卷面/答案/笔试残留必须挡在音频之外', () => {
  const fullAnswerPage = '<div class="answer-section"><h2>参考答案与评分标准</h2>'
    + '<p>1. B 2. A 3. C 4. T 5. F</p>'
    + '<p>听力原文</p>'
    + '<p>第一部分 听力部分（共3大题，满分30分） 一、听录音，选出你所听到的单词或图片（每题2分，共10分）</p>'
    + '<p>1. M: Excuse me, where is the library?</p><p>W: It&apos;s next to the bank.</p>'
    + '<p>2. W: I keep a diary every day. 二、听录音，判断下列句子与所听内容是否相符（每题2分，共10分）</p>'
    + '<p>第二部分 笔试部分（共7大题，满分70分） 四、选出画线部分发音不同的单词（每题1分，共5分）</p>'
    + '<p>【参考范文】Last month, I took part in the singing competition.</p>'
    + '<p>等级 分值 评分描述 优秀 9-10分 内容完整</p>'
    + '</div>';

  it('extractListeningSource 只取"听力原文"小节，不含笔试/范文/评分', () => {
    const src = extractListeningSource(fullAnswerPage);
    expect(src).toContain('where is the library');
    expect(src).not.toContain('笔试部分');
    expect(src).not.toContain('参考范文');
    expect(src).not.toContain('评分描述');
    expect(src).not.toContain('参考答案与评分标准');
  });

  it('解析结果里不残留卷面题头/答案键/中文噪音', () => {
    const src = extractListeningSource(fullAnswerPage);
    const parsed = parseListeningSourceText(src);
    const all = parsed.items.flatMap((it) => it.lines.map((l) => l.text)).join('\n');
    expect(all).not.toContain('听录音');
    expect(all).not.toContain('每题2分');
    expect(all).not.toContain('笔试');
    // 题头被就地剔除后，英文材料必须仍完整保留（不能连带把句子切掉）
    expect(all).toContain('I keep a diary every day');
  });

  it('stripPaperNoise：大题题头保留「标号+题干」只去分值括号；部分标题整段剔除；笔试处截断', () => {
    // 🔴 2026-09-19 用户定：音频直接读卷面「一、听录音，选出你所听到的单词或图片」——
    //    故整行以标号起头的题头要**保留**（只去掉「（每题2分，共10分）」这类书面信息）
    const heading = stripPaperNoise('一、听录音，选出你所听到的单词或图片（每题2分，共10分）');
    expect(heading.text).toBe('一、听录音，选出你所听到的单词或图片');
    // 部分标题整段剔除（其名称由音频按固定文案播报）
    const part = stripPaperNoise('第一部分 听力部分（共3大题，满分30分）');
    expect(part.text).toBe('');
    // 标号出现在句中（材料句后粘着题头）→ 仍是卷面残留，整段剔除，英文材料必须完整保留
    const mixed = stripPaperNoise('I saw a film yesterday. 二、听录音，判断下列句子（每题2分，共10分）');
    expect(mixed.text).toBe('I saw a film yesterday.');
    const stop = stripPaperNoise('Thank you! 第二部分 笔试部分（共7大题，满分70分）');
    expect(stop.hardStop).toBe(true);
    expect(stop.text).toBe('Thank you!');
  });

  it('答案键行按"连续递增题号≥3"识别，普通含数字句不误伤', () => {
    expect(looksLikeAnswerKey('T 7. F 8. F 9. T 10. F')).toBe(true);
    expect(looksLikeAnswerKey('A 39. B 40. C 41. D 42. E')).toBe(true);
    expect(looksLikeAnswerKey('May 12. three 13. school 14. practise 15. try')).toBe(true);
    expect(looksLikeAnswerKey('1. M: Excuse me, where is the library?')).toBe(false);
    expect(looksLikeAnswerKey('He is 12. She is 13.')).toBe(false);
    expect(looksLikeAnswerKey('It was difficult for me to remember all the words.')).toBe(false);
  });

  it('中文占比守卫：非导语段以中文为主即判定为噪音', () => {
    expect(isCjkNoise('听录音，判断下列句子与所听内容是否相符')).toBe(true);
    expect(isCjkNoise('I keep a diary every day.')).toBe(false);
    expect(isCjkNoise('Lucy took part in the school singing competition.')).toBe(false);
  });
});

/**
 * 🎙 分节播音指令（2026-09-19）：真题各节遍数不同（高考第一节仅读一遍、第二节读两遍），
 *   故"以指令为准"——指令声明的遍数决定该节实际朗读遍数，音频与播报严格一致。
 */
describe('分节播音指令：以指令为准决定该节遍数', () => {
  const twoSections = '第一节，听下面5段对话。每段对话后有一个小题。每段对话仅读一遍。\n'
    + '1. M: Excuse me, where is the library?\n'
    + 'W: It is next to the bank.\n'
    + '第二节，听下面几段对话或独白。每段对话或独白读两遍。\n'
    + '2. M: What time does the film start?\n'
    + 'W: At seven thirty.';

  it('解析指令声明的遍数（中文数字与阿拉伯数字皆可）', () => {
    expect(parseAnnouncedRepeat('每段对话仅读一遍')).toBe(1);
    expect(parseAnnouncedRepeat('每段对话或独白读两遍')).toBe(2);
    expect(parseAnnouncedRepeat('每段材料读3遍')).toBe(3);
    expect(parseAnnouncedRepeat('听下面一段对话，回答问题。')).toBe(0);
  });

  it('首条指令进导语、后续节指令挂到该节首题，且各自遍数落到材料上', () => {
    const r = parseListeningSourceText(twoSections);
    expect(r.intro).toContain('第一节');
    expect(r.items).toHaveLength(2);
    expect(r.items[0].repeat).toBe(1);
    expect(r.items[1].instruction).toContain('第二节');
    expect(r.items[1].repeat).toBe(2);
  });

  it('AI 路径：分节指令随该节首题透传，并据其解析遍数', () => {
    const out = normalizeListeningStructure({
      intro: '',
      items: [
        { no: 1, instruction: '第一节，听下面5段对话。每段对话仅读一遍。', lines: [{ role: 'M', text: 'Hi.' }] },
        { no: 2, lines: [{ role: 'W', text: 'Hello.' }] },
      ],
    });
    expect(out.items[0].instruction).toContain('第一节');
    expect(out.items[0].repeat).toBe(1);
    // 无指令的条目不得凭空获得 instruction/repeat
    expect(out.items[1].instruction).toBeUndefined();
    expect(out.items[1].repeat).toBeUndefined();
  });

  it('源头契约要求写出分节播音指令（与解析器同源）', () => {
    expect(LISTENING_SCRIPT_FORMAT).toContain('第一节');
    expect(LISTENING_SCRIPT_FORMAT).toContain('播音指令');
  });
});

/**
 * 🔴 2026-09-19 用户实测根治：多节听力"内容与卷面对不上"——实测第 5 题一口气吞掉了
 *   第二节独白（并把两篇粘成一条女声），且第二、三节的**节指令全部丢失**（学生不知道要做什么）。
 *   根因：节指令不再驱动"起新条"，无题号的节材料被并入上一题；待挂指令从未被消费还被下一节覆盖。
 */
describe('🔴 节边界驱动起条：多节听力不再串题、不再丢节指令', () => {
  const threeSections = '第一节：听录音，选出你所听到的单词或图片。每小题读两遍。现在开始。\n'
    + '1. tree\n'
    + '2. forgot\n'
    + '第二节：听录音，判断下列句子是否与录音内容相符。每小题读两遍。现在开始。\n'
    + 'W: Last week, Lily took part in a storytelling competition. She was proud of herself.\n'
    + '第三节：听录音，补全短文，每空一词。短文读两遍。现在开始。\n'
    + 'Last month, our school had an International Culture Festival. I was happy.';

  it('每条材料各归其节：节指令挂在该节首条，后节材料不再被并进上一题', () => {
    const r = parseListeningSourceText(threeSections);
    expect(r.intro).toContain('第一节');
    expect(r.items).toHaveLength(4);                       // 2 短题 + 独白 + 短文
    expect(r.items[2].instruction).toContain('第二节');
    expect(r.items[3].instruction).toContain('第三节');
    // 独白那条里不得混入第三节短文（原实现把两篇粘成一条女声）
    const dialogueText = r.items[2].lines.map((l) => l.text).join(' ');
    expect(dialogueText).toContain('storytelling competition');
    expect(dialogueText).not.toContain('International Culture Festival');
    expect(r.stats.instructionDropped).toBe(0);
  });

  it('节指令声明的遍数/作答秒数/读题秒数落到该节各条（以指令为准）', () => {
    const r = parseListeningSourceText(
      '第一节：听下面5段对话。听完每段对话后，你都有10秒钟的时间来回答有关小题。每段对话仅读一遍。\n'
      + '1. M: Hi.\n'
      + '第二节：听下面几段对话或独白。听每段对话或独白前，你将有时间阅读各个小题，每小题5秒钟；听完后，'
      + '各小题将给出5秒钟的作答时间。每段对话或独白读两遍。\n'
      + '6. W: Hello.',
    );
    expect(r.items[0].repeat).toBe(1);
    expect(r.items[0].answerSec).toBe(10);
    expect(r.items[1].repeat).toBe(2);
    expect(r.items[1].answerSec).toBe(5);
    expect(r.items[1].previewSec).toBe(5);
  });

  it('未挂到任何材料的节指令被计数并告警（不再静默吞掉）', () => {
    const r = parseListeningSourceText('第二节：听录音，判断下列句子是否与录音内容相符。\n第三节：听录音，补全短文。');
    expect(r.stats.instructionDropped).toBeGreaterThan(0);
    expect(r.warnings.join()).toContain('分节指令');
  });

  // 🔴 E3（2026-09-19 用户实测）：源文本不给题号范围时，程序只能按条数顺编题号——
  //   实测把第三节报成"第七题"，而该卷第二节实为第 6~10 题、第三节为第 11~15 题。
  it('题号范围行作为元数据吸收：编号取范围起点，且不把该行当材料念出来', () => {
    const r = parseListeningSourceText(
      '第二节：听录音，判断下列句子是否与录音内容相符。每段对话或独白读两遍。\n'
      + '听第6段材料，回答第6至第10题。\n'
      + 'W: Last week, Lily took part in a storytelling competition and she did her best.',
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0].no, '无题号材料取范围起点（第 6 题起）').toBe(6);
    expect(r.items[0].range).toEqual({ materialNo: 6, from: 6, to: 10 });
    expect(r.items[0].lines.map((l) => l.text).join(' ')).not.toContain('听第6段材料');
  });

  it('parseQuestionRange：中文题号、起止与单题都认', () => {
    expect(parseQuestionRange('听第6段材料，回答第6至第10题。')).toEqual({ materialNo: 6, from: 6, to: 10 });
    expect(parseQuestionRange('听第11段材料，回答第11-15题。')).toEqual({ materialNo: 11, from: 11, to: 15 });
    expect(parseQuestionRange('听第6段材料，回答第6题。')).toEqual({ materialNo: 6, from: 6, to: 6 });
    expect(parseQuestionRange('M: Hello.')).toBe(null);
  });

  it('🔴 源头契约按正规补齐（E1 指令与形态相符 / E2 同节形态一致 / E3 题号范围 / 播报者标注）', () => {
    expect(LISTENING_SCRIPT_FORMAT).toContain('题号范围');
    expect(LISTENING_SCRIPT_FORMAT).toContain('每段对话或独白读两遍');
    expect(LISTENING_SCRIPT_FORMAT).toContain('标注一次播报者');
    expect(LISTENING_SCRIPT_FORMAT).toContain('材料形态须一致');
    // 旧口径"独白/短文不标说话人"会导致同卷播报者不一致，已修订
    expect(LISTENING_SCRIPT_FORMAT).not.toContain('不标说话人');
  });
});
