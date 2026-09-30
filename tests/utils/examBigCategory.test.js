// 🏷️ 大类层居中（渲染实现侧）：识别 + 打标/居中 + 不误伤正文（2026-09-30 D2）
// ============================================================
// 条款（【卷面格式】层级归并）：大类层 = "**居中加粗**的独立段落（不用 h1/h2，可用 <strong>）"。
// 处置边界（用户裁定"源头模型侧必须做到位、不依赖程序侧兜底"）：**加粗**在模型侧职责内（程序不代劳），
// **居中**是渲染、模型写不出来 → 由渲染侧识别并居中；这不属"内容补差"，属"渲染实现"。
// 判据保守：叶子块 + 以"第X部分/第I部分/活动X：/听力部分/笔试部分"开头 + ≤40 字 + 无句末标点；
// 段内含作答位载体（u/blank-N）不动；幂等。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { markExamBigCategory } from '../../src/utils/contentCleaner.js';

const centered = (html) => /class="[^"]*exam-bigcat[^"]*"|text-align:\s*center/.test(html);

describe('大类层居中：识别与打标', () => {
  it('小学段"第X部分"层级行 → 打标 + 居中', () => {
    const out = markExamBigCategory('<p><strong>第一部分 识字与写字（40分）</strong></p>');
    expect(out).toContain('exam-bigcat');
    expect(out).toContain('text-align:center');
    expect(centered(out)).toBe(true);
  });

  it('"活动一：…"与"听力部分/笔试部分"同口径（序号形态按学段，识别不依赖序号样式）', () => {
    for (const t of ['活动一：走进拼音山谷（31分）', '听力部分（20分）', '笔试部分（80分）', '第II部分 阅读理解（35分）']) {
      const out = markExamBigCategory(`<p><strong>${t}</strong></p>`);
      expect(out, t).toContain('exam-bigcat');
    }
  });

  it('幂等：重复调用不再改动（两次结果一致）', () => {
    const once = markExamBigCategory('<p><strong>第一部分 识字与写字（40分）</strong></p>');
    expect(markExamBigCategory(once)).toBe(once);
  });

  it('无 DOMParser 的纯字符串环境原样返回（不抛错）', () => {
    const src = '<p>第一部分 识字与写字（40分）</p>';
    expect(typeof markExamBigCategory(src)).toBe('string');
  });
});

describe('大类层居中：不得误伤（保守判据逐条）', () => {
  it('大题标题是 h2，不在管辖内', () => {
    const src = '<h2>一、走进拼音山谷（共4题，每题3分，共12分）</h2>';
    expect(markExamBigCategory(src)).toBe(src);
  });

  it('正文句（含句末标点）不动', () => {
    const src = '<p>第一部分的内容我们上个学期已经学过了。</p>';
    expect(markExamBigCategory(src)).toBe(src);
  });

  it('超长层级行（>40 字）不动（防把正文首句误判）', () => {
    const src = '<p>第一部分 读一读下面的句子然后按要求把正确的读音填写在后面的括号里面并且注意声调的标注方式与书写规范（40分）</p>';
    expect(markExamBigCategory(src)).toBe(src);
  });

  it('带逗号的句子不动（层级行不带逗号，正文句多为逗号衔接）', () => {
    const src = '<p>第一部分 先读一读，再写一写（40分）</p>';
    expect(markExamBigCategory(src)).toBe(src);
  });

  it('含作答位载体的段落不动（作答位由作答空间规则管辖）', () => {
    const src = '<p>第一部分 <u class="blank-3">&emsp;</u></p>';
    expect(markExamBigCategory(src)).toBe(src);
  });

  it('表格（得分表）及其它结构不动', () => {
    const src = '<table><tr><td>第一部分</td></tr></table>';
    expect(markExamBigCategory(src)).toBe(src);
  });
});

describe('接线（防漏通道）', () => {
  it('排版模块导出链与生成模块预览合成都必须调用（单一实现、两处消费）', () => {
    const root = path.resolve(__dirname, '../..');
    const ts = fs.readFileSync(path.join(root, 'src/modules/TypesetModule.vue'), 'utf8');
    const gen = fs.readFileSync(path.join(root, 'src/modules/GenerateModule.vue'), 'utf8');
    for (const [f, s] of [['TypesetModule', ts], ['GenerateModule', gen]]) {
      expect(s, `${f} 未引入 markExamBigCategory`).toContain('markExamBigCategory');
    }
    expect(ts).toContain('markExamBigCategory(markSoloBlankLines(wrapBareBlankRuns(');
    // 单一实现：不得在模块内自带副本
    expect(ts).not.toContain('function markExamBigCategory');
    expect(gen).not.toContain('function markExamBigCategory');
  });
});
