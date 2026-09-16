// 选项行作答位取证（2026-09-16 用户实证：六年级英语选词填空，每个选项行后挂 2 条整行横线）
//
// 背景：作答空间条款原只写"选项行内与选项末尾一律不加作答位"，模型改把整行横线放进
//       选项行**之后的独立段落** → 字面合规；且取证规则只认 `<p class="option">` / `<br> A.`，
//       而实测产物的选项行用的是 `<p class="question">(1) A. …` → 既没拦住也没取证。
// 本测试锁定：① 真实缺陷片段必须被取证；② 合法作答区（写作题横线）绝不误报。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { buildAnswerSpaceInstruction } from '../../src/config/layoutSpec.js';

const OPTS = { subject: '英语', stage: 'primary_high', genType: 'exam' };

/** 用户提供的真实产物片段（六年级英语 Unit 1 巩固练习 第二题，节选两个选项） */
const REAL_SNIPPET = `
<h2>二、读短文，根据上下文选择恰当的单词，把故事补充完整（10分）</h2>
<p class="question">Last month, Tom took part in a running race. His legs hurt and he wanted to (1) <span class="blank-2"> </span>. They were (2) <span class="blank-2"> </span> his name.</p>
<p class="question">(1) A. stop　B. run　C. jump</p>
<p><span class="blank-line">　</span></p>
<p><span class="blank-line">　</span></p>
<p class="question">(2) A. calling　B. writing　C. drawing</p>
<p><span class="blank-line">　</span></p>
<p><span class="blank-line">　</span></p>
`;

/** 合法形态：英语写作题，横线区在整题之后（不存在选项行，不得误报） */
const LEGAL_WRITING = `
<h2>十二、书面表达（15分）</h2>
<p class="question">请以 My Day 为题写一段话，不少于五句。</p>
<p><span class="blank-line">　</span></p>
<p><span class="blank-line">　</span></p>
<p><span class="blank-line">　</span></p>
`;

/** 合法形态：规矩的选择题，作答位在题首括号，选项行后无任何载体 */
const LEGAL_CHOICE = `
<h2>一、单项选择（10分）</h2>
<p class="question">（　）1. He ____ to school every day.</p>
<p class="question">A. go　B. goes　C. going</p>
<p class="question">（　）2. What a beautiful day!</p>
<p class="question">A. Yes, it is.　B. No, it isn't.　C. You're right.</p>
`;

const types = (res) => res.silentDetails.map((d) => d.type);

describe('选项行作答位取证（choice-answer-position-guard）', () => {
  it('真实产物：选项行之后的整行横线被取证', () => {
    const res = auditExamPaper(REAL_SNIPPET, OPTS);
    expect(types(res)).toContain('choice-answer-pos-after');
  });

  it('选项行内挂空位：不依赖 class="option"，按形态也能认出', () => {
    const html = `
<h2>一、单项选择（10分）</h2>
<p class="question">（　）1. He ____ to school.</p>
<p class="question">A. go　B. goes　C. going<span class="blank-2">　</span></p>
`;
    expect(types(auditExamPaper(html, OPTS))).toContain('choice-answer-pos');
  });

  it('假阳性保护：写作题整题之后的横线区不得误报', () => {
    const ts = types(auditExamPaper(LEGAL_WRITING, OPTS));
    expect(ts).not.toContain('choice-answer-pos-after');
    expect(ts).not.toContain('choice-answer-pos');
  });

  it('假阳性保护：规矩的选择题（题首括号 + 选项行后无载体）不得误报', () => {
    const ts = types(auditExamPaper(LEGAL_CHOICE, OPTS));
    expect(ts).not.toContain('choice-answer-pos-after');
    expect(ts).not.toContain('choice-answer-pos');
  });
});

describe('作答空间条款：选项行之后禁挂作答位', () => {
  const text = buildAnswerSpaceInstruction('英语', 'primary_high');

  it('条款写明"选项行之后"也在禁止范围内', () => {
    expect(text).toContain('选项行');
    expect(text).toContain('选项行之后');
    expect(text).toContain('作答位只有题首那一处');
  });

  it('补写的判定语保持零题型名（沿用项目去诱导原则）', () => {
    const seg = text.split('\n').find((l) => l.includes('选项行之后')) || '';
    for (const banned of ['选择', '判断', '圈选', '单选', '填空']) {
      expect(seg).not.toContain(banned);
    }
  });

  it('全学科全学段都不出现题型名（沿用 09-15 反向锁口径）', () => {
    for (const subject of ['语文', '数学', '英语', '物理', '化学', '生物', '地理', '历史']) {
      for (const stage of ['primary_low', 'primary_high', 'middle', 'high']) {
        const t = buildAnswerSpaceInstruction(subject, stage);
        for (const banned of ['选择题', '判断题']) {
          expect(t).not.toContain(banned);
        }
      }
    }
  });
});
