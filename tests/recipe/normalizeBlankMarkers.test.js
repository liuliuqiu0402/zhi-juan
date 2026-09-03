// 空白规范化后处理测试（AI 输出"一大段文本"时由代码补排版要素）
// ============================================================
import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers } from '@/utils/contentCleaner.js';

describe('normalizeBlankMarkers（后处理排版兜底）', () => {
  it('<u>＿N＿</u> 转 blank-N 宽度横线（1字≈2格）', () => {
    expect(normalizeBlankMarkers('<u>＿＿＿</u>')).toBe('<u class="blank-6">&emsp;</u>');
  });

  it('纯文本 ＿N 个转 blank-N（2≤N≤24）', () => {
    expect(normalizeBlankMarkers('＿＿＿＿')).toBe('<u class="blank-8">&emsp;</u>');
  });

  it('超长横线上限 16 格（超出页内边距的横线禁用，长答案走行尾自动延伸）', () => {
    expect(normalizeBlankMarkers('＿'.repeat(20))).toBe('<u class="blank-16">&emsp;</u>');
  });

  it('空作文格补默认格', () => {
    expect(normalizeBlankMarkers('<div class="zuo-wen-ge"></div>')).toContain('zuo-wen-ge');
    expect(normalizeBlankMarkers('<div class="zuo-wen-ge"></div>')).toContain('&emsp;');
  });

  it('无空白时原样返回', () => {
    const html = '<p>1. 选择题</p>';
    expect(normalizeBlankMarkers(html)).toBe(html);
  });

  it('裸全角空格写作答题行保留 <p> 外壳（行尾 flex 延伸依赖它；拆裸 <u> 会塌缩）', () => {
    expect(normalizeBlankMarkers('<p>　　　　　　</p>')).toBe('<p><u class="blank-12">&emsp;</u></p>');
  });

  it('裸全角空格留空在 div/li 中外壳同样保留', () => {
    expect(normalizeBlankMarkers('<div>　　　　　　</div>')).toBe('<div><u class="blank-12">&emsp;</u></div>');
    expect(normalizeBlankMarkers('<li>　　　　　　</li>')).toBe('<li><u class="blank-12">&emsp;</u></li>');
  });

  it('单全角空格排版分隔不误转（≥2 才构成书写横线）', () => {
    expect(normalizeBlankMarkers('<p>　　你好</p>')).toBe('<p>　　你好</p>');
  });
});

describe('normalizeBlankMarkers 密封信息栏 ＿ 保护（C2 链序：＿ 不被填空归一吃掉，排版/导出重建可回填）', () => {
  it('模型卷首整条密封信息栏（学校/班级/姓名/学号）＿ 原样保留', () => {
    const seal = '密封线内不要答题　学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿';
    const out = normalizeBlankMarkers(seal);
    expect(out).toContain('学校：＿＿＿');
    expect(out).toContain('班级：＿＿＿');
    expect(out).toContain('姓名：＿＿＿');
    expect(out).toContain('学号：＿＿＿');
    expect(out).not.toContain('<u class="blank-');
  });

  it('独立段落密封字段（<p>班级：＿＿＿</p> 形态）＿ 原样保留', () => {
    const out = normalizeBlankMarkers('<p>学校：＿＿＿</p>');
    expect(out).toContain('学校：＿＿＿');
    expect(out).not.toContain('<u class="blank-');
  });

  it('正文填空不受影响：无密封字段词的 ＿ 仍归一为填空横线', () => {
    expect(normalizeBlankMarkers('<p>1. 看拼音写词语：＿＿＿＿</p>')).toContain('<u class="blank-');
    expect(normalizeBlankMarkers('＿＿＿＿')).toBe('<u class="blank-8">&emsp;</u>');
  });

  it('行内"姓名：＿＿"（非段首、非信息栏整条）不豁免 → 仍按正文填空归一', () => {
    const out = normalizeBlankMarkers('<p>向大家介绍你（姓名：＿＿＿＿）</p>');
    expect(out).not.toContain('姓名：＿＿＿＿');
    expect(out).toContain('blank-');
  });

  it('幂等：保护后再次归一结果不变', () => {
    const seal = '<p>密封线内不要答题　学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</p>';
    const once = normalizeBlankMarkers(seal);
    expect(normalizeBlankMarkers(once)).toBe(once);
  });
});

describe('normalizeBlankMarkers 载体内数字实体解码（C3-C5：&#xFF08;&#x3000;&#x3000;&#xFF09; 与字面路径产物一致）', () => {
  it('实体括号空位（&#xFF08;&#x3000;&#x3000;&#xFF09;）→ span.blank-N（曾整条漏判）', () => {
    expect(normalizeBlankMarkers('&#xFF08;&#x3000;&#x3000;&#xFF09;')).toBe('<span class="blank-4">&emsp;</span>');
  });

  it('实体下划线（&#95;&#95;&#95;&#95;）→ u.blank-N（半角 _ 按 0.5 字计）', () => {
    expect(normalizeBlankMarkers('&#95;&#95;&#95;&#95;')).toBe('<u class="blank-4">&emsp;</u>');
  });

  it('实体全角空格块（&#x3000;×6 独立段落）→ 整行填空横线（与字面 6 全角路径同档 blank-12）', () => {
    expect(normalizeBlankMarkers('<p>&#x3000;&#x3000;&#x3000;&#x3000;&#x3000;&#x3000;</p>')).toBe('<p><u class="blank-12">&emsp;</u></p>');
  });

  it('实体形态密封信息栏同样保护（解码后仍还原为 ＿）', () => {
    const seal = '密封线内不要答题　学校：&#x3000;&#xFF3F;&#xFF3F;&#xFF3F;　班级：＿';
    // 学校： 后是"全角空格+＿＿＿"（模型将占位写成实体的混杂形态）——头字段单字段起于文档开头 → 豁免区
    const out = normalizeBlankMarkers(seal);
    expect(out).toContain('＿');
  });

  it('结构实体不解码（&lt;/&gt;/&amp; 原样保留，防注入）', () => {
    expect(normalizeBlankMarkers('&lt;u&gt;＿＿＿&lt;/u&gt;')).toBe('&lt;u&gt;<u class="blank-6">&emsp;</u>&lt;/u&gt;');
  });
});
