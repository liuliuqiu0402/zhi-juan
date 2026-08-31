// 连线结构渲染端归一测试（normalizeMatchQuestions）
// ============================================================
// 🔴 目的：锁定"配对类题（连一连/连线/配对）无论模型输出何种形态（表格/双列表），
//    渲染端确定性转成标准 match-question 结构"，且不破坏已有内容。
import { describe, it, expect } from 'vitest';
import { normalizeMatchQuestions } from '@/utils/contentCleaner.js';

describe('normalizeMatchQuestions：两列表格 → 连线结构', () => {
  it('配对题两列表格转为 match-question 两列', () => {
    const html = '<p>2. 连一连。</p>\n<table><tbody><tr><td>苹果</td><td>red</td></tr><tr><td>香蕉</td><td>yellow</td></tr><tr><td>葡萄</td><td>purple</td></tr></tbody></table>';
    const out = normalizeMatchQuestions(html);
    expect(out).toContain('class="match-question"');
    expect(out).toContain('<div class="match-col">');
    expect(out).not.toContain('<table');
    expect(out).toContain('苹果');
    expect(out).toContain('purple');
    // 左右列各 3 项
    expect((out.match(/class="match-item"/g) || []).length).toBe(6);
  });

  it('已含 match-question 结构 → 幂等不重复转换（表格保留不二次处理）', () => {
    const html = '<p>1. 连一连。</p>\n<div class="match-question"><div class="match-col"><div class="match-item">甲</div></div><div class="match-col"><div class="match-item">A</div></div></div>\n<table><tbody><tr><td>乙</td><td>B</td></tr><tr><td>丙</td><td>C</td></tr></tbody></table>';
    const out = normalizeMatchQuestions(html);
    // 原 match-question 保留；同题内表格因幂等跳过（不产生第二个 match-question）
    expect(out).toContain('class="match-question"');
    expect(out).toContain('<table'); // 幂等：表格未被二次转换
    expect((out.match(/class="match-question"/g) || []).length).toBe(1);
  });
});

describe('normalizeMatchQuestions：双列表 → 连线结构', () => {
  it('两个相邻列表转为 match-question 两列', () => {
    const html = '<p>3. 连线题：把词语与意思连起来。</p>\n<ul><li>善良</li><li>聪明</li><li>勇敢</li></ul>\n<ul><li>心地好</li><li>智力高</li><li>胆子大</li></ul>';
    const out = normalizeMatchQuestions(html);
    expect(out).toContain('class="match-question"');
    expect(out).not.toContain('<ul');
    expect((out.match(/class="match-item"/g) || []).length).toBe(6);
  });
});

describe('normalizeMatchQuestions：保守不误转', () => {
  it('无配对关键词的表格 → 不变', () => {
    const html = '<p>1. 统计本班人数。</p>\n<table><tbody><tr><td>男生</td><td>20</td></tr><tr><td>女生</td><td>18</td></tr></tbody></table>';
    expect(normalizeMatchQuestions(html)).toBe(html);
  });

  it('关键词与表格跨题（中间有题号）→ 不转', () => {
    const html = '<p>1. 连一连。</p>\n<p>2. 完成统计表。</p>\n<table><tbody><tr><td>甲</td><td>1</td></tr><tr><td>乙</td><td>2</td></tr></tbody></table>';
    const out = normalizeMatchQuestions(html);
    expect(out).toContain('<table'); // 表格保留
    expect(out).not.toContain('match-question');
  });

  it('单列表格 → 不变', () => {
    const html = '<p>1. 连一连。</p>\n<table><tbody><tr><td>苹果</td></tr><tr><td>香蕉</td></tr></tbody></table>';
    expect(normalizeMatchQuestions(html)).toBe(html);
  });

  it('配对关键词但内容是普通段落（非两列形态）→ 不变', () => {
    const html = '<p>1. 连一连。</p>\n<p>按要求把左右两边对应的连起来即可。</p>';
    expect(normalizeMatchQuestions(html)).toBe(html);
  });
});
