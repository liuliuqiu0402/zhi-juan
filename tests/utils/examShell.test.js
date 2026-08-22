// 卷面固定件回归测试：注意事项 + 题号得分表由排版模块统一注入（sealed_exam 主题）
import { describe, it, expect } from 'vitest';
import { wrapContentForTheme, parseExamSections, buildExamShell, injectExamShell, getThemeById } from '@/themeConfig.js';

const CONTENT = `<h2 class="main-title">第二单元学业测评</h2>
<p>（满分100分　考试时间60分钟）</p>
<h3 class="heading1">一、识字与写字。（共6题，每题5分，共30分）</h3>
<p>1. 读拼音，写词语。</p>
<h3 class="heading1">二、积累与运用。（共4题，共24分）</h3>
<p>1. 组词。</p>
<h3 class="heading1">三、阅读与鉴赏。（共2题，每题7分，共14分）</h3>
<p>1. 读短文回答问题。</p>
<div class="answer-section"><h3>一、识字与写字</h3><p>答案略</p></div>`;

describe('卷面固定件：注意事项 + 题号得分表（排版模块统一注入）', () => {
  it('parseExamSections：识别明细式大题标题，跳过答案区', () => {
    const sections = parseExamSections(CONTENT);
    expect(sections.map((s) => s.num)).toEqual(['一', '二', '三']);
    expect(sections.map((s) => s.score)).toEqual([30, 24, 14]);
    expect(sections[0].name).toBe('一、识字与写字。');
  });

  it('buildExamShell：生成注意事项 + 题号得分表（含总分列与各题号列）', () => {
    const shell = buildExamShell(parseExamSections(CONTENT));
    expect(shell).toContain('注意事项');
    expect(shell).toContain('1．答题前，请将密封线内的学校、班级、姓名、学号填写清楚。');
    expect(shell).toContain('2．请在各题目的答题区域内作答，超出答题区域书写的答案无效。');
    expect(shell).toContain('3．本试卷共＿页。');
    expect(shell).toContain('<th>题号</th>');
    expect(shell).toContain('<th>一</th>');
    expect(shell).toContain('<th>三</th>');
    expect(shell).toContain('<th>总分</th>');
    expect(shell).toContain('<td>得分</td>');
  });

  it('wrapContentForTheme(sealed_exam)：注入固定件，位置在第一个大题标题前', () => {
    const wrapped = wrapContentForTheme(CONTENT, 'sealed_exam');
    expect(wrapped).toContain('class="exam-notice"');
    expect(wrapped).toContain('class="exam-score-table"');
    // 固定件位于卷首标题之后、第一个大题标题之前
    expect(wrapped.indexOf('class="exam-notice"')).toBeGreaterThan(wrapped.indexOf('第二单元学业测评'));
    expect(wrapped.indexOf('class="exam-notice"')).toBeLessThan(wrapped.indexOf('一、识字与写字。'));
    // 密封线字段按模板结构（线上密下：s-top=线、s-bot=密）
    expect(wrapped).toContain('class="seal-char s-top">线</div>');
    expect(wrapped).toContain('class="seal-char s-bot">密</div>');
    // 幂等：二次注入不重复
    expect(injectExamShell(wrapped)).toBe(wrapped);
  });

  it('内容已含 sealed-wrapper（AI 输出）时不再重复包装，固定件照常注入', () => {
    const aiContent = `<div class="sealed-wrapper"><div class="sealed-line"><p>密封线　学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题</p></div>${CONTENT}</div>`;
    const wrapped = wrapContentForTheme(aiContent, 'sealed_exam');
    // 仅一个 sealed-wrapper（未嵌套）
    expect((wrapped.match(/class="sealed-wrapper"/g) || []).length).toBe(1);
    expect(wrapped).toContain('class="exam-score-table"');
    // 考生信息并入 seal-info（模板密封区字段，下划线统一 8 个全角 ＿）
    expect(wrapped).toContain('class="seal-info">学校：＿＿＿＿＿＿＿＿　班级：＿＿＿＿＿＿＿＿　姓名：＿＿＿＿＿＿＿＿　学号：＿＿＿＿＿＿＿＿</div>');
  });

  it('孤儿 sealed-wrapper（仅含密封线，标题/正文在 wrapper 外）→ 重构收进 wrapper，标题位于固定件上方', () => {
    const orphan = `<div class="sealed-wrapper"><div class="sealed-line"><p>密封线　学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿　密封线内不要答题</p></div></div>
<h2 class="main-title">第二单元学业测评</h2>
<p>（满分100分　考试时间60分钟）</p>
<h3 class="heading1">一、识字与写字。（共6题，每题5分，共30分）</h3>
<p>1. 读拼音，写词语。</p>`;
    const wrapped = wrapContentForTheme(orphan, 'sealed_exam');
    // 仅一个 wrapper（孤儿 wrapper 被重构，标题/正文收进其内）
    expect((wrapped.match(/class="sealed-wrapper"/g) || []).length).toBe(1);
    // 顺序：seal-zone → 标题 → 副标题 → 固定件 → 第一个大题
    const pos = (s) => wrapped.indexOf(s);
    expect(pos('class="seal-zone"')).toBeLessThan(pos('第二单元学业测评'));
    expect(pos('第二单元学业测评')).toBeLessThan(pos('class="exam-notice"'));
    expect(pos('class="exam-notice"')).toBeLessThan(pos('一、识字与写字。'));
    // 幂等：二次包装顺序不变、不嵌套
    const twice = wrapContentForTheme(wrapped, 'sealed_exam');
    expect((twice.match(/class="sealed-wrapper"/g) || []).length).toBe(1);
    expect(twice.indexOf('class="exam-notice"')).toBeGreaterThan(twice.indexOf('第二单元学业测评'));
  });

  it('无大题结构的普通内容：不注入固定件', () => {
    const plain = '<p>普通讲义内容</p><p>第二段</p>';
    expect(injectExamShell(plain)).toBe(plain);
    const wrapped = wrapContentForTheme(plain, 'sealed_exam');
    expect(wrapped).not.toContain('exam-score-table');
    expect(wrapped).not.toContain('exam-notice');
  });

  it('其它主题不注入卷面固定件', () => {
    const wrapped = wrapContentForTheme(CONTENT, 'error_book');
    expect(wrapped).not.toContain('exam-score-table');
    expect(wrapped).not.toContain('exam-notice');
  });

  it('小初高三试卷主题（primary_exam/middle_exam/high_exam）同样注入密封线与固定件', () => {
    for (const themeId of ['primary_exam', 'middle_exam', 'high_exam']) {
      const wrapped = wrapContentForTheme(CONTENT, themeId);
      expect(wrapped, `${themeId} 缺密封线`).toContain('class="sealed-wrapper"');
      expect(wrapped, `${themeId} 缺注意事项`).toContain('class="exam-notice"');
      expect(wrapped, `${themeId} 缺题号得分表`).toContain('class="exam-score-table"');
      // 幂等：已含 sealed-wrapper 的内容不重复包装
      const twice = wrapContentForTheme(wrapped, themeId);
      expect((twice.match(/class="sealed-wrapper"/g) || []).length, `${themeId} 重复包装`).toBe(1);
    }
  });

  it('parseExamSections 识别 AI 常见分值写法（每空2分共20分/每题2分共20分/满分20分）', () => {
    const html = '<h1>期末试卷</h1>'
      + '<p>一、看拼音写词语。（每空2分，共20分）　得分：＿＿</p>'
      + '<p>二、阅读理解。（每题2分，共20分）　得分：＿＿</p>'
      + '<p>三、习作。（满分30分）</p>'
      + '<p>四、填空。（共5题，每题2分，共10分）</p>'
      + '<p>正文题1</p>';
    const sections = parseExamSections(html);
    expect(sections.map(s => `${s.num}:${s.score}`)).toEqual(['一:20', '二:20', '三:30', '四:10']);
    // 上述内容注入固定件
    const wrapped = wrapContentForTheme(html, 'sealed_exam');
    expect(wrapped).toContain('class="exam-notice"');
    expect(wrapped).toContain('class="exam-score-table"');
    expect(wrapped).toContain('<th>一</th>');
  });

  it('无分值标注的普通正文不算大题（不注入固定件）', () => {
    const html = '<p>一、这是普通标题没有分值</p><p>二、另一个标题</p>';
    const sections = parseExamSections(html);
    expect(sections.length).toBe(0);
  });

  it('三试卷主题：正文基准字号 14/12/10.5pt，行距 1.8/1.6/1.4，标题纯黑', () => {
    const primary = getThemeById('primary_exam');
    const middle = getThemeById('middle_exam');
    const high = getThemeById('high_exam');
    // 学段字号/行距差异（实际生效的基准字号）
    expect(primary.bodySize).toBe(14);
    expect(primary.lineHeight).toBe(1.8);
    expect(middle.bodySize).toBe(12);
    expect(middle.lineHeight).toBe(1.6);
    expect(high.bodySize).toBe(10.5);
    expect(high.lineHeight).toBe(1.4);
    // 标题/各级标题纯黑（正规试卷风格）
    for (const t of [primary, middle, high]) {
      expect(t.titleColor).toBe('#000000');
      expect(t.styles['.main-title'].color).toBe('#000000');
      expect(t.styles['.heading1'].color).toBe('#000000');
      expect(t.styles['.heading2'].color).toBe('#000000');
      expect(t.styles['.heading3'].color).toBe('#000000');
    }
  });

  it('得分表行高统一由 CSS 控制：单元格无内联 padding（预览与 Word 导出一致紧凑）', () => {
    const sections = [{ num: '一', name: '识字与写字', score: 30 }];
    for (const stage of ['primary', 'middle', 'high', undefined]) {
      const shell = buildExamShell(sections, stage);
      expect(shell, `stage=${stage} 不应带内联 padding`).not.toContain('padding:');
      expect(shell).toContain('<th>题号</th>');
      expect(shell).toContain('<td>得分</td>');
    }
  });

  it('旧格式内容（总分式"（X分）"）重新打开：固定件自动补齐（无需重新生成）', () => {
    const oldContent = `<h2>第二单元学业测评</h2><p>（满分100分　考试时间60分钟）</p><h3>一、识字与写字。（32分）</h3><p>1. 读拼音，写词语。</p><h3>二、积累与运用。（24分）</h3><p>1. 组词。</p><h3>三、阅读与鉴赏。（14分）</h3><p>1. 读短文。</p><h3>四、表达与交流。（30分）</h3><p>1. 写话。</p><div class="answer-section"><h3>一、识字与写字</h3></div>`;
    const wrapped = wrapContentForTheme(oldContent, 'sealed_exam');
    expect(wrapped).toContain('class="exam-notice"');
    // 得分表按旧式标题解析出四列 + 总分列（答案区标题不计入）
    const m = wrapped.match(/<tr><th>题号<\/th>(.*?)<th>总分<\/th><\/tr>/);
    expect(m).toBeTruthy();
    expect(m[1]).toContain('<th>一</th>');
    expect(m[1]).toContain('<th>四</th>');
    expect(m[1]).not.toContain('<th>五</th>');
  });
});
