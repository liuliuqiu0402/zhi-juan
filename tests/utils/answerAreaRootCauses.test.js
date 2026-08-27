import { describe, it, expect } from 'vitest';
import { auditExamPaper, countTzg } from '../../src/utils/examValidator.js';

describe('根治回归：田字格数量与拼音音节对齐', () => {
  it('每拼音组固定 4 格 → 按音节数删到每音节 1 格（真实事故：8 组固定 4 格）', () => {
    const html = [
      '<h2>一、识字与写字（共8题，共16分）</h2>',
      '<p>1. 读句子，根据拼音写词语。（每空2分，共16分）</p>',
      '<p>秋天到了，校园里的（guì huā）<span class="tian-zi-ge">　</span><span class="tian-zi-ge">　</span><span class="tian-zi-ge">　</span><span class="tian-zi-ge">　</span>开了。</p>',
      '<p>（qún）<span class="tian-zi-ge">　</span><span class="tian-zi-ge">　</span><span class="tian-zi-ge">　</span><span class="tian-zi-ge">　</span>小鸟飞过。</p>',
    ].join('\n');
    const { html: out } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    // guì huā=2 音节 → 2 格；qún=1 音节 → 1 格；共 3 格
    expect(countTzg(out)).toBe(3);
  });

  it('田字格少于音节 → 补足（每音节 1 格）', () => {
    const html = [
      '<h2>一、识字与写字（共2题，共8分）</h2>',
      '<p>1. 读句子，根据拼音写词语。（每空2分，共4分）</p>',
      '<p>（bǎo hù）<span class="tian-zi-ge">　</span>校园。</p>',
    ].join('\n');
    const { html: out } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    // bǎo hù=2 音节 → 应 2 格（现 1 格 → 补 1）
    expect(countTzg(out)).toBe(2);
  });
});

describe('根治回归：解答区误补（归类/仿写/圈选类题不再补横线）', () => {
  const run = (html) => auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });

  it('照样子归类题（子题带田字格与括号空位）→ 不补（真实事故：补 9 行横线）', () => {
    const html = [
      '<h2>三、积累与运用（共3题，共6分）</h2>',
      '<p>3. 照样子，把下列生字按部首归类。（每空1分，共6分）</p>',
      '<p>例：树——木字旁——（　杨　）</p>',
      '<p>（1）雀——<span class="tian-zi-ge">　</span>——（　　）</p>',
      '<p>（2）鸡——<span class="tian-zi-ge">　</span>——（　　）</p>',
      '<p>（3）漠——<span class="tian-zi-ge">　</span>——（　　）</p>',
    ].join('\n');
    const { html: out } = run(html);
    expect((out.match(/blank-line/g) || []).length).toBe(0);
  });

  it('圈出不同类词（无子题空位）→ 不补（真实事故：补 5 行横线）', () => {
    const html = [
      '<h2>三、积累与运用（共1题，共3分）</h2>',
      '<p>4. 读一读，圈出每组中不是同一类的一个词。（每题1分，共3分）</p>',
      '<p>（1）杨树　榕树　枫树　树叶　松柏</p>',
      '<p>（2）孔雀　锦鸡　熊猫　雄鹰　大雁</p>',
    ].join('\n');
    const { html: out } = run(html);
    expect((out.match(/blank-line/g) || []).length).toBe(0);
  });

  it('照样子写一写（仿写，句内填空）→ 不补（真实事故：补 9 行横线）', () => {
    const html = [
      '<h2>三、积累与运用（共1题，共6分）</h2>',
      '<p>7. 照样子，写一写。（每题2分，共6分）</p>',
      '<p>例：梧桐树叶像手掌。</p>',
      '<p>（1）弯弯的月亮像　　。</p>',
      '<p>（2）　　　像　　　。</p>',
    ].join('\n');
    const { html: out } = run(html);
    expect((out.match(/blank-line/g) || []).length).toBe(0);
  });

  it('真解答题（无载体、无例句）→ 仍补差（回归不破坏主功能）', () => {
    const html = [
      '<h2>三、阅读与鉴赏（共1题，共4分）</h2>',
      '<p>7. 读了短文，你有什么感受？（4分）</p>',
    ].join('\n');
    const { html: out } = run(html);
    expect((out.match(/blank-line/g) || []).length).toBeGreaterThan(0);
  });
});

describe('根治回归：作文格位置（题干 → 配图 → 作文格）', () => {
  it('写话题 [IMAGE] 在题干后 → 作文格插在配图之后', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共20分）</h2>',
      '<p>15. 看图写话。（共20分）</p>',
      '<p>[IMAGE]\nTYPE:SD\nPROMPT:春天公园\n[/IMAGE]</p>',
    ].join('\n');
    const { html: out } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(out).toContain('zuo-wen-ge');
    const imgIdx = out.indexOf('[IMAGE]');
    const zwgIdx = out.indexOf('zuo-wen-ge');
    expect(zwgIdx).toBeGreaterThan(imgIdx); // 格子必须在配图之后
  });
});

describe('根治回归：写话/作文题缺题干说明 guard（真实事故：仅标题行）', () => {
  it('写话题仅标题行（后接配图）→ 静默提示缺题干', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共20分）</h2>',
      '<p>15. 看图写话。（共20分）</p>',
      '<p>[IMAGE]\nTYPE:SD\nPROMPT:春天公园\n[/IMAGE]</p>',
    ].join('\n');
    const { silentDetails } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(silentDetails.some(d => d.message.includes('缺题干说明'))).toBe(true);
  });

  it('写话题有完整题干说明（标题行 + 说明段）→ 不提示', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共20分）</h2>',
      '<p>15. 看图写话。（共20分）仔细观察图片，写一段话。</p>',
      '<p>[IMAGE]\nTYPE:SD\nPROMPT:春天公园\n[/IMAGE]</p>',
    ].join('\n');
    const { silentDetails } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(silentDetails.some(d => d.message.includes('缺题干说明'))).toBe(false);
  });
});

describe('标题命名规范 buildPaperTitle', () => {
  it('普通型：年级+学科+册别+范围名+类型名', async () => {
    const { buildPaperTitle } = await import('../../src/config/recipe/paperScope.js');
    const t = buildPaperTitle({ grade: '二年级', subject: '语文', semester: '上册', scopeName: '第二单元', typeLabel: '综合检测' });
    expect(t).toBe('二年级语文上册第二单元综合检测');
  });
  it('考试型：学年度学期+年级+学科+范围标签词', async () => {
    const { buildPaperTitle } = await import('../../src/config/recipe/paperScope.js');
    const t = buildPaperTitle({ grade: '二年级', subject: '语文', scopeName: '期中综合测试', academic: '2025—2026学年度第一学期', isExam: true });
    expect(t).toBe('2025—2026学年度第一学期二年级语文期中综合测试');
  });
});
