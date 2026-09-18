// 🔴 2026-09-18 用户实证（知识点总结）："例题那块中的内容全部被加了下划横线"。
//   根因（生成侧条款缺位）：知识总结模板原写"核心知识重点标注"——只说了"标注"、没定形式，
//   模型自选下划线；而下划线与横线在本产品里是**作答载体**语义（填空横线 u.blank-N、画线题标记
//   underline-sentence），于是知识点总结里"重点最密集"的例题块看起来整块被加了横线（与作答位混淆）。
//   根治：① 生成侧【输出格式】补全类型"强调口径"（强调一律用加粗）+ summary 创作要求写明加粗；
//         ② 程序侧对**内容型**做确定性归一：无载体 class 且内含可见文字的 <u> → <strong>。
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const RUN = (html, genType) => auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType });

const SUMMARY_BODY = `
<h1>Unit 1 知识总结</h1>
<h2>一、知识梳理</h2>
<p>核心结构：<u>be going to + 动词原形</u>表示打算做某事。</p>
<h2>二、典型例题</h2>
<p>例1 He <u>is going to play</u> football tomorrow.</p>
<p>解析：<u>be going to</u> 表计划，后接动词原形。</p>
`;

describe('① 生成侧：强调口径单源（全类型）', () => {
  const TPL = (genType) => getPromptTemplate({ grade: '六年级', subject: '英语', genType }).template;

  it('强调口径进"输出格式"，且考试/教辅/内容型三类都带', () => {
    for (const t of ['exam', 'practice', 'summary']) {
      const s = TPL(t);
      expect(s).toContain('强调口径（全类型）');
      expect(s).toContain('一律用**加粗**');
      expect(s).toContain('作答载体');
    }
  });

  it('知识总结创作要求已写明"以加粗标注重点"，不再是无形式的"重点标注"', () => {
    const s = TPL('summary');
    expect(s).toContain('核心知识**以加粗（<strong>）标注重点**');
    expect(s).not.toContain('核心知识重点标注');
  });
});

describe('② 程序侧：内容型下划线强调归一到加粗', () => {
  it('summary：无载体 class 且含文字的 <u> 全部转为 <strong>，文字不动', () => {
    const { html: out, issues } = RUN(SUMMARY_BODY, 'summary');
    expect(out).not.toContain('<u>');
    expect(out).toContain('<strong>be going to + 动词原形</strong>');
    expect(out).toContain('<strong>is going to play</strong>');
    expect(out).toContain('<strong>be going to</strong>');
    const it0 = issues.find((i) => i.type === 'emphasis-form');
    expect(it0).toBeTruthy();
    expect(it0.message).toContain('3处');
  });

  it('preview 同样归一（内容型同口径）', () => {
    const { html: out } = RUN(SUMMARY_BODY, 'preview');
    expect(out).not.toContain('<u>');
  });

  it('题类（practice）不动：画线/标记由题目要求决定，程序不越权改形态', () => {
    const { html: out } = RUN(SUMMARY_BODY, 'practice');
    expect(out).toContain('<u>is going to play</u>');
  });

  it('带载体 class 的填空横线不动（不是强调）', () => {
    const body = `<h2>一、知识梳理</h2><p>答案：<u class="blank-3">&emsp;</u>。</p>`;
    const { html: out, issues } = RUN(body, 'summary');
    expect(out).toContain('<u class="blank-3">');
    expect(issues.find((i) => i.type === 'emphasis-form')).toBeFalsy();
  });

  it('画线类 class 与纯下划线字符不动（防误伤画线标记与横线）', () => {
    const body = `<h2>一、知识梳理</h2><p>画线部分：<u class="underline-sentence">the red one</u></p>`
      + `<p>空行：<u>＿＿＿＿</u></p>`;
    const { html: out } = RUN(body, 'summary');
    expect(out).toContain('<u class="underline-sentence">the red one</u>');
    expect(out).toContain('<u>＿＿＿＿</u>');
    expect(out).not.toContain('<strong>');
  });
});
