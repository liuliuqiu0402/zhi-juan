// ============================================================
// 答案区小题分镜像 · 分节边界（2026-10-27 属主："答案区还是错位的，需要你定位根因"）
// ------------------------------------------------------------
// 根因（实测复现）：答案区分节边界只认 h2/h3/h4，而答案区的大题标题常写成
//   `<p><strong>四、判断</strong></p>`；`findAnsTitleB` 认这种形态，但"取到哪为止"不认
//   ⇒ 三、填空 的作用域一路收到答案区末尾，把 四、判断 的答案行也算进来；
//   `byNum` 同号后写覆盖前写 ⇒ 三、填空 第1题的分被写到 四、判断 第1题的答案行上。
// 本守卫锁三件事：p/strong 标题下各节各取本题的分；h3 标题的原有路径不变；无标题时不错配。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const OPTS = { subject: '数学', stage: 'primary_mid', genType: 'exam' };
const run = (html) => auditExamPaper(html, OPTS).html;
const ans = (html) => (html.match(/<div class="answer-section">([\s\S]*?)<\/div>/) || [, ''])[1];

const BODY = [
  '<h1>单元测评</h1>',
  '<h3>三、填空（每空1分，共5分）</h3>',
  '<p class="question">1. 甲____。（每空1分，共2分）</p>',
  '<p class="question">2. 乙____，____。（每空1分，共3分）</p>',
  '<h3>四、判断（每题5分，共5分）</h3>',
  '<p class="question">1. 丙（　）。（每空1分，共5分）</p>',
].join('\n');

describe('答案区小题分镜像：分节边界与标题查找同源', () => {
  it('答案区大题标题是 p>strong 时，各节各取本题的分（不再串到后面大题）', () => {
    const html = run([
      BODY,
      '<div class="answer-section">',
      '<h2>参考答案</h2>',
      '<p><strong>三、填空</strong></p>',
      '<p>1. 甲答</p>',
      '<p>2. 乙答</p>',
      '<p><strong>四、判断</strong></p>',
      '<p>1. 丙答</p>',
      '</div>',
    ].join('\n'));
    const a = ans(html);
    expect(a, '三、填空 第1题取本题的分').toContain('1.（每空1分，共2分） 甲答');
    expect(a, '三、填空 第2题取本题的分').toContain('2.（每空1分，共3分） 乙答');
    expect(a, '四、判断 第1题取本题的分').toContain('1.（每空1分，共5分） 丙答');
    expect(a, '不得把 2 分写到后面大题的题号 1 上').not.toContain('1.（每空1分，共2分） 丙答');
  });

  it('答案区用 h3 标题（原有形态）仍正确', () => {
    const a = ans(run([
      BODY,
      '<div class="answer-section">',
      '<h2>参考答案</h2>',
      '<h3>三、填空</h3>',
      '<p>1. 甲答</p>',
      '<p>2. 乙答</p>',
      '<h3>四、判断</h3>',
      '<p>1. 丙答</p>',
      '</div>',
    ].join('\n')));
    expect(a).toContain('1.（每空1分，共2分） 甲答');
    expect(a).toContain('2.（每空1分，共3分） 乙答');
    expect(a).toContain('1.（每空1分，共5分） 丙答');
  });

  it('答案区缺某节标题时不猜、不乱配（该节答案行保持原样）', () => {
    const a = ans(run([
      BODY,
      '<div class="answer-section">',
      '<h2>参考答案</h2>',
      '<p><strong>三、填空</strong></p>',
      '<p>1. 甲答</p>',
      '<p>2. 乙答</p>',
      '<p>1. 丙答</p>',   // 四、判断 无标题：不得把它当成 三、填空 的题号 1
      '</div>',
    ].join('\n')));
    expect(a, '三、填空 第1题仍取本题的分').toContain('1.（每空1分，共2分） 甲答');
    expect(a, '无标题节的答案行不得被写上别节的分').toContain('<p>1. 丙答</p>');
  });
});
