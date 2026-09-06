// 载体产物端到端矩阵（2026-09 检查方法升级：配置侧矩阵 → 产物侧矩阵）
// ============================================================
// 🔴 教训：上轮"载体矩阵"只锁 配置/语义同源（输入侧），未验证"执行侧产物"——
//    无分值教辅补差空转、卷面无作答空间，只有真实产物（用户 docx 实证）才暴露。
// 本文件模拟"模型裸输出题干（无任何载体）" → 走完整产物链
//   （normalizeBlankMarkers 归一 → auditExamPaper 质检/补差）→ 断言【最终产物】的作答载体形态：
//     · 学科×学段默认形态与配置一致（blank-area 空白 / blank-line 横线）；
//     · 无分值（practice 教辅）主观解答题补兜底空白/横线（2026-09 新增无分值模式）；
//     · 分值题（exam）按分值补差；
//     · 判断/口算/填空/竖式/连线等已有作答形态 → 不误补；
//     · 数学算式 ○/□ → 归一为圆圈/方框容器；
//     · 合法专用载体（四线三格）不被剥离。
// 覆盖：理科/史地政（blank-area 族）× 语英科（line 族）× 9 类型代表分支 × 学段分界
// ============================================================
import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers, normalizeMathCircleBlanks } from '../../src/utils/contentCleaner.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const countBlankArea = (html) => (html.match(/class="blank-area"/g) || []).length;
const countBlankLine = (html) => (html.match(/blank-line/g) || []).length;
// 与真实生成主链同序（useAiGenerator 4791/4845）：blank 归一 → 算式○/□收口 → 质检/补差
const produce = (html, meta) =>
  auditExamPaper(normalizeMathCircleBlanks(normalizeBlankMarkers(html)), meta);

describe('产物矩阵：blank-area 族（数学等理科/史地政/素养）主观解答题 → 无线空白', () => {
  const cases = [
    // [说明, 学科, 学段, genType, 题干, 期望行数/或特殊断言]
    ['数学·小高·practice 无分值解答（课时练断链根治）', '数学', 'primary_high', 'practice',
      '<h2>一、基础建构任务</h2><p>1. 小明家本月水费和电费一共128元，电费是水费的3倍。列方程求出水费和电费各是多少元。</p>', 4],
    ['数学·middle·exam 有分值解答', '数学', 'middle', 'exam',
      '<h2>四、解决问题（20分）</h2><p>1. 求圆环的面积。（5分）</p>', 5],
    ['物理·middle·exam 计算题', '物理', 'middle', 'exam',
      '<h2>二、计算题（12分）</h2><p>1. 求压强大小。（4分）</p>', 4],
    ['历史·high·exam 论述题', '历史', 'high', 'exam',
      '<h2>三、材料分析题（16分）</h2><p>1. 依据材料，论述该事件的影响。（8分）</p>', 7],
    ['道德与法治·primary_mid·practice 做法题（无分值）', '道德与法治', 'primary_mid', 'practice',
      '<h2>二、探究与分享</h2><p>1. 遇到这种情况，你会怎么做？说说你的理由。</p>', 4],
    ['信息科技·middle·practice 方案简答（无分值）', '信息科技', 'middle', 'practice',
      '<h2>二、方案设计</h2><p>1. 设计一个简单的循环结构，说明其执行过程。</p>', 4],
    ['音乐·primary_high·practice 欣赏简答（无分值）', '音乐', 'primary_high', 'practice',
      '<h2>三、欣赏与感受</h2><p>1. 听了这首乐曲，你感受到了怎样的情绪？</p>', 4],
  ];
  for (const [desc, subject, stage, genType, html, rows] of cases) {
    it(`${desc} → 补 ${rows} 行空白（blank-area 无线）`, () => {
      const { html: out, issues } = produce(html, { subject, stage, genType });
      expect(countBlankArea(out), desc).toBe(rows);
      expect(issues.some((i) => i.type === 'answer-area')).toBe(true);
      expect(out).not.toContain('blank-line'); // blank-area 族不得误用横线
    });
  }
});

describe('产物矩阵：line 族（语文/英语/科学）主观题 → 整行书写横线', () => {
  const cases = [
    ['语文·primary_mid·practice 简答（无分值）', '语文', 'primary_mid', 'practice',
      '<h2>二、阅读与理解</h2><p>1. 短文主要讲了什么？</p>', 4],
    ['英语·middle·practice 书面表达（无分值，2j-5b 关键词兜底）', '英语', 'middle', 'practice',
      '<p>第三节 书面表达。</p><p>5. 请用英语写一篇题为"My Weekend"的短文。</p>', 8],
    ['科学·primary_mid·practice 实验简答（无分值）', '科学', 'primary_mid', 'practice',
      '<h2>二、实验探究</h2><p>1. 通过实验你发现水沸腾时温度有什么特点？</p>', 4],
  ];
  for (const [desc, subject, stage, genType, html, rows] of cases) {
    it(`${desc} → 补 ${rows} 行横线（blank-line）`, () => {
      const { html: out } = produce(html, { subject, stage, genType });
      expect(countBlankLine(out), desc).toBeGreaterThanOrEqual(rows);
      expect(countBlankArea(out)).toBe(0); // line 族不得误用空白区
    });
  }
});

describe('产物矩阵：已有作答形态 → 不误补（判断/口算/填空/竖式）', () => {
  it('数学 practice：判断（括号空）与口算（算式连列）→ 不补空白', () => {
    const html = [
      '<h2>一、基础练习</h2>',
      '<p>1. 判断商与1的大小，在○里填＞＜或＝：4.8÷0.6○1。</p>',
      '<h2>二、口算</h2>',
      '<p>1. 0.6×0.5＝　0.2×0.3＝　1.5×0.4＝</p>',
    ].join('\n');
    const { html: out } = produce(html, { subject: '数学', stage: 'primary_high', genType: 'practice' });
    expect(countBlankArea(out)).toBe(0);
  });

  it('数学 practice：算式 ○ 填空位 → 归一为圆圈容器（math-circle-blank）', () => {
    const html = '<h2>三、比较大小</h2><p>1. 在○里填上＞、＜或＝：4.8÷0.6○1　2.5÷2.5○1</p>';
    const { html: out } = produce(html, { subject: '数学', stage: 'primary_high', genType: 'practice' });
    expect(out).toContain('math-circle-blank-18'); // 算式语境 ○ 归一为填空圆
    expect(countBlankArea(out)).toBe(0);
  });

  it('数学 practice：填空括号空位 → 保留括号空（不补空白）', () => {
    const html = '<h2>四、填空</h2><p>1. 3.2×2.6的积有（　　）位小数。</p>';
    const { html: out } = produce(html, { subject: '数学', stage: 'primary_high', genType: 'practice' });
    expect(out).not.toContain('blank-area');
    expect(/blank-\d/.test(out)).toBe(true); // 括号空位归一带宽
  });

  it('数学 practice：竖式题无专用书写区 → 不落通用空白补差（专用载体缺失走抽检）', () => {
    const html = '<h2>五、用竖式计算</h2><p>1. 用竖式计算 6.25×1.5。</p>';
    const { html: out } = produce(html, { subject: '数学', stage: 'primary_high', genType: 'practice' });
    expect(countBlankArea(out)).toBe(0);
  });

  it('英语·primary_mid：模型输出合法四线三格 → 不被剥离（合法载体保留）', () => {
    const html = '<h2>三、抄写</h2><p>1. 抄写单词：<span class="four-line-three">cat</span></p>';
    const { html: out } = produce(html, { subject: '英语', stage: 'primary_mid', genType: 'practice' });
    expect(out).toContain('four-line-three');
  });

  it('英语·primary_low（无书写格学段）模型输出四线三格 → 越界剥离', () => {
    const html = '<p>1. 抄写字母：<span class="four-line-three">a</span></p>';
    const { html: out } = produce(html, { subject: '英语', stage: 'primary_low', genType: 'practice' });
    expect(out).not.toContain('four-line-three');
  });
});

describe('产物矩阵：幂等与分界复核', () => {
  it('已补空白行后再走一遍链 → 不重复补（度量已有作答行）', () => {
    const html = '<h2>一、解决问题（20分）</h2><p>1. 求面积。（5分）</p>';
    const first = produce(html, { subject: '数学', stage: 'middle', genType: 'exam' });
    expect(countBlankArea(first.html)).toBe(5);
    const second = produce(first.html, { subject: '数学', stage: 'middle', genType: 'exam' });
    expect(countBlankArea(second.html)).toBe(5);
  });
});
