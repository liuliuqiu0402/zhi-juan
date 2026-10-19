// A→B 契约测试（2026-10-19）：A 侧四种标分形态喂给程序侧 B，验证 B **不篡改、且按总数算作答空间**
// ============================================================
// 背景（属主："你刚刚是只测试了模型侧A吗？程序侧B测试了吗？"）：
//   A 侧现行四种形态（见【分值标注】）：
//     ① 有题号层：标题（共X分）＋每个带号题后（每〈单位〉X分，共Y分）
//     ② 有题号层、该题只有 1 个判分处：题后（X分）
//     ③ 无题号层：标题（每〈单位〉X分，共X分）
//     ④ 无题号层、整大题只有 1 个判分处：标题（共X分）
//   B 侧现只剩：1.6「裸（X分）→（共X分）」形态归一（转换支已删）。
//   本文件验：四种形态原样保留；B 的作答空间按**该题总数 Y** 算（不按单价 X）；裸分仍归一。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const run = (html, stage = 'primary_mid') => auditExamPaper(html, { subject: '语文', stage, genType: 'exam' });
const titles = (html) => [...html.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);
const rowsAdded = (html) => (html.match(/<p><br><\/p>|<p class="blank-area"/g) || []).length;

describe('A→B：A 的四种标分形态不得被程序改写', () => {
  it('① 有题号层 + 多判分处：标题（共X分）＋每题后（每空1分，共4分）原样', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>一、填空（共24分）</h3>',
      '<p>1. ____ ____ ____ ____（每空1分，共4分）</p>',
      '<p>2. ____ ____ ____ ____（每空1分，共4分）</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('一、填空（共24分）');
    expect((r.html.match(/每空1分，共4分/g) || []).length, '逐题标注全保留').toBe(2);
    expect(titles(r.html).join('|'), '标题不得出现单价').not.toContain('每空1分');
  });

  it('② 有题号层 + 单判分处：题后只写（2分），B 不得补成"共2分"', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>二、选择（共10分）</h3>',
      '<p>1. 下列读音正确的是（　）（2分）</p>',
      '<p>2. 下列词语没有错别字的是（　）（2分）</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('二、选择（共10分）');
    expect(r.html, '（2分）保持').toContain('（2分）');
    expect(r.html, '不得被扩成"共2分"').not.toContain('共2分');
  });

  it('③ 无题号层 + 多判分处：标题（每式1分，共20分）原样', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>三、直接写得数（每式1分，共20分）</h3>',
      '<p>4×2＝____　5×3＝____　2×6＝____</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('三、直接写得数（每式1分，共20分）');
  });

  it('④ 无题号层 + 单判分处：标题（共15分）原样', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>四、看图写话（共15分）</h3>',
      '<p>仔细观察图片，写几句话。</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('四、看图写话（共15分）');
    expect(r.html, '不得被扩成"每篇15分"').not.toContain('每篇15分');
  });

  it('⑤ 旧式裸（15分）→（共15分）形态兜底仍在（1.6 保留；需其下有带号题）', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>五、写话（15分）</h3>',
      '<p>1. 写几句话。（15分）</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('五、写话（共15分）');
  });

  it('⑥ 作答空间按**该题总数**算，不按单价：共6分应多于2分', () => {
    const mk = (item, title) => [
      '<h1>阶段测评</h1>',
      `<h3>六、阅读（${title}）</h3>`,
      `<p>1. 请结合文章谈谈你的理解。${item}</p>`,
    ].join('\n');
    const six = rowsAdded(run(mk('（每处2分，共6分）', '共6分'), 'high').html);
    const two = rowsAdded(run(mk('（2分）', '共2分'), 'high').html);
    expect(six, '共6分须补出作答空间').toBeGreaterThan(0);
    expect(six, '按总数6算，不得退化为按单价2算').toBeGreaterThan(two);
  });
});
