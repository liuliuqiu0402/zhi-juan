import { describe, it, expect } from 'vitest';
import {
  htmlFragmentToText,
  extractListeningSource,
  hasEnglishListening,
  normalizeRole,
  stripCodeFence,
  extractFirstJsonObject,
  normalizeListeningStructure,
  parseListeningStructure,
  summarizeListeningStructure,
} from '../../src/utils/listeningExtract.js';

const OK_JSON = JSON.stringify({
  intro: '听下面一段对话，回答问题。',
  items: [
    { no: 1, lines: [{ role: 'M', text: 'Where is the library?' }, { role: 'W', text: "It's next to the bank." }] },
    { no: 2, lines: [{ role: 'N', text: 'Tom is a student.' }] },
  ],
});

describe('从生成结果中取出听力区', () => {
  const content = '<h2>一、听力</h2><p>题目区不含原文</p>'
    + '<div class="answer-section"><h2>参考答案与评分标准</h2>'
    + '<p>1. B</p><h3>听力原文</h3><p>M: Where is the library?</p><p>W: It\'s next to the bank.</p>'
    + '</div>';

  it('听力原文只在答案区，故优先取 answer-section', () => {
    const src = extractListeningSource(content);
    expect(src).toContain('Where is the library?');
    expect(src).not.toContain('题目区不含原文');
  });

  it('无 answer-section 时回退到"参考答案"标题起', () => {
    const bare = '<h2>一、听力</h2><p>卷面</p><h2>参考答案</h2><p>听力原文</p><p>M: Hi.</p>';
    const src = extractListeningSource(bare);
    expect(src).toContain('M: Hi.');
    expect(src).not.toContain('卷面');
  });

  it('两者都没有时取全文（不抛错）', () => {
    expect(extractListeningSource('<p>只有正文</p>')).toBe('只有正文');
    expect(extractListeningSource('')).toBe('');
  });

  it('"听力原文"字样可作英语听力判据（按构造仅英语注入）', () => {
    expect(hasEnglishListening(content)).toBe(true);
    expect(hasEnglishListening('<h2>参考答案</h2><p>1. A</p>')).toBe(false);
  });
});

describe('HTML → 纯文本', () => {
  it('去标签、解实体、保留断行', () => {
    const t = htmlFragmentToText('<p>A &amp; B</p><p>It&#39;s &lt;ok&gt;</p><br>Tail');
    expect(t).toBe('A & B\nIt\'s <ok>\nTail');
  });

  it('剔除 script/style，不把脚本内容当听力文本', () => {
    const t = htmlFragmentToText('<style>.a{color:red}</style><p>Real</p><script>var x=1;</script>');
    expect(t).toBe('Real');
  });
});

describe('角色归一', () => {
  it('男/女/旁白各种写法都能归位', () => {
    expect(normalizeRole('M')).toBe('M');
    expect(normalizeRole('man')).toBe('M');
    expect(normalizeRole('男声')).toBe('M');
    expect(normalizeRole('W')).toBe('W');
    expect(normalizeRole('Female')).toBe('W');
    expect(normalizeRole('女')).toBe('W');
    expect(normalizeRole('Narrator')).toBe('N');
    expect(normalizeRole('')).toBe('N');
    expect(normalizeRole(undefined)).toBe('N');
  });
});

describe('JSON 提取（容忍围栏与前后噪声）', () => {
  it('剥掉 ```json 围栏', () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
  });

  it('从夹带说明文字的响应里取出 JSON', () => {
    expect(extractFirstJsonObject('好的，结果如下：\n{"a":1}\n以上。')).toBe('{"a":1}');
  });

  it('字符串内的大括号不被误判为结束', () => {
    expect(extractFirstJsonObject('{"t":"a {b} c","n":1}')).toBe('{"t":"a {b} c","n":1}');
  });

  it('无 JSON 时返回空串', () => {
    expect(extractFirstJsonObject('抱歉，我无法完成')).toBe('');
  });
});

describe('结构校验与归一', () => {
  it('空句被剔除，整条无有效句则跳过并告警，缺 no 时按序补号', () => {
    const { items, warnings } = normalizeListeningStructure({
      items: [
        { lines: [{ role: 'M', text: '  ' }, { role: 'W', text: 'Hi' }] },
        { lines: [{ role: 'M', text: '   ' }] },
        { no: '3', lines: [{ role: 'N', text: 'Hi' }] },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0].no).toBe(1);
    expect(items[0].lines).toHaveLength(1);
    expect(items[1].no).toBe(3);
    expect(warnings.join()).toContain('无有效句子');
  });

  it('全为旁白时告警（对话会退化成单一音色）', () => {
    const { warnings } = normalizeListeningStructure({ items: [{ no: 1, lines: [{ role: 'x', text: 'Hi' }] }] });
    expect(warnings.join()).toContain('单一音色');
  });

  it('items 非数组时告警且不抛错', () => {
    const { items, warnings } = normalizeListeningStructure({ items: 'oops' });
    expect(items).toEqual([]);
    expect(warnings.join()).toContain('items');
  });
});

describe('解析模型响应', () => {
  it('正常 JSON 解析出结构与导语', () => {
    const r = parseListeningStructure(`\`\`\`json\n${OK_JSON}\n\`\`\``);
    expect(r.intro).toContain('听下面一段对话');
    expect(r.items).toHaveLength(2);
    expect(r.items[0].lines[0].role).toBe('M');
  });

  it('无 JSON 时抛错并说明原因', () => {
    expect(() => parseListeningStructure('抱歉我无法完成')).toThrow(/未返回可解析的 JSON/);
  });

  it('JSON 非法时抛错并带原因', () => {
    expect(() => parseListeningStructure('{"items": [')).toThrow(/JSON 解析失败/);
  });

  it('结构合法但无材料时抛错（防把空结果当成功）', () => {
    expect(() => parseListeningStructure('{"intro":"x","items":[]}')).toThrow(/未解析出.*听力材料/);
  });
});

describe('摘要', () => {
  it('统计材料数/句数/角色/字符', () => {
    const r = parseListeningStructure(OK_JSON);
    const s = summarizeListeningStructure(r);
    expect(s).toContain('材料 2 段');
    expect(s).toContain('句子 3 句');
    expect(s).toContain('男/女/旁白');
    expect(s).toContain('含导语');
  });
});
