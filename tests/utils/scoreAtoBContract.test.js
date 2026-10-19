// A→B 契约测试（2026-10-19）：A 的四种标分形态喂给 B，验证 B **合成真题标题、不改数、不删题内标注**
// ============================================================
// 分工（属主口径）：A 不能直接产出真题样式且保证分值/内容自洽 ⇒
//   A 逐题标出「每〈单位〉X分，共Y分」（单判分处只写「X分」）；
//   B 读这些标注，把**大题标题**合成为真题写法（单价唯一→每X分；多档→分组式）。
// 本文件从"契约"角度验端到端：四种 A 形态各自的去向，以及 B 的作答空间按**该题总数**算。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const run = (html, stage = 'primary_mid') => auditExamPaper(html, { subject: '语文', stage, genType: 'exam' });
const titles = (html) => [...html.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1]);
const rowsAdded = (html) => (html.match(/<p><br><\/p>|<p class="blank-area"/g) || []).length;

describe('A→B 契约：逐题标注进，真题标题出', () => {
  it('① 有题号层 + 多判分处：标题合成（每空1分，共24分），题内 6 条原样', () => {
    const items = Array.from({ length: 6 }, (_, i) => `<p>${i + 1}. ____ ____ ____ ____（每空1分，共4分）</p>`);
    const html = ['<h1>阶段测评</h1>', '<h3>一、填空（共24分）</h3>', ...items].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('一、填空（每空1分，共24分）');
    expect((r.html.match(/每空1分，共4分/g) || []).length, '题内标注全保留').toBe(6);
  });

  it('② 有题号层 + 单判分处（2分）：标题合成（每题2分，共10分），题内（2分）原样', () => {
    const items = Array.from({ length: 5 }, (_, i) => `<p>${i + 1}. 下列正确的是（　）（2分）</p>`);
    const html = ['<h1>阶段测评</h1>', '<h3>二、选择（共10分）</h3>', ...items].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('二、选择（每题2分，共10分）');
    expect((r.html.match(/（2分）/g) || []).length, '题内（2分）全保留').toBe(5);
  });

  it('③ 无题号层（整栏）：A 已写在标题，B 不动', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>三、直接写得数（每式1分，共20分）</h3>',
      '<p>4×2＝____　5×3＝____</p>',
    ].join('\n');
    expect(titles(run(html).html)).toContain('三、直接写得数（每式1分，共20分）');
  });

  it('④ 无题号层 + 单判分处：标题（共15分）原样，B 不硬造单价', () => {
    const html = [
      '<h1>阶段测评</h1>',
      '<h3>四、看图写话（共15分）</h3>',
      '<p>仔细观察图片，写几句话。</p>',
    ].join('\n');
    const r = run(html);
    expect(titles(r.html)).toContain('四、看图写话（共15分）');
    expect(r.html, '不得写成"每篇15分"').not.toContain('每篇15分');
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
