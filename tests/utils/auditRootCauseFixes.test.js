import { describe, it, expect } from 'vitest';
import {
  auditExamPaper,
  countGridCells,
  countPinyinGroups,
  fixScoreLabel,
} from '../../src/utils/examValidator.js';

const run = (html, opts = {}) => auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam', ...opts });

describe('根治回归：分值账目闭合（每词=拼音组数、每字=格子数）', () => {
  it('看拼音写词语"每词2分共6分"实际 5 组拼音 → 按 每词2分×5词=共10分 重算（词数=拼音组数）', () => {
    const r = fixScoreLabel('1. 看拼音写词语。（每词2分，共6分）', 6, 0, 0, { pinyinGroups: 5 });
    expect(r.text).toContain('共5词');
    expect(r.text).toContain('每词2分');
    expect(r.text).toContain('共10分');
  });

  it('看拼音写词语"每词2分共10分"实际 5 组拼音 → 自洽，不动', () => {
    const r = fixScoreLabel('1. 看拼音写词语。（每词2分，共10分）', 10, 0, 0, { pinyinGroups: 5 });
    expect(r.text).toBe('1. 看拼音写词语。（每词2分，共10分）');
  });

  it('看拼音写词语"每字2分共12分"实际 10 格 → 按 每字2分×10格=共20分 重算（字=格子数）', () => {
    const r = fixScoreLabel('1. 看拼音写词语。（每字2分，共12分）', 12, 0, 0, { gridCells: 10 });
    expect(r.text).toContain('共10字');
    expect(r.text).toContain('共20分');
  });

  it('"每词X分"但题内数不到拼音 → 无法判定，保留原标注（不假装验证）', () => {
    const r = fixScoreLabel('1. 读短文。（每词2分，共6分）', 6, 0, 0, { pinyinGroups: 0 });
    expect(r.text).toBe('1. 读短文。（每词2分，共6分）');
  });

  it('连线题"每线1分共8分"实际 4 组 → 重算为"共4组，每组1分，共4分"（每线/每组归一为组）', () => {
    const r = fixScoreLabel('2. 连一连。（每线1分，共8分）', 8, 4, 0);
    expect(r.text).toContain('共4组');
    expect(r.text).toContain('每组1分');
    expect(r.text).toContain('共4分');
  });

  it('连线题"每组2分共8分"实际 4 组 → 自洽，保留（每组声称兼容）', () => {
    const r = fixScoreLabel('2. 连一连。（每组2分，共8分）', 8, 4, 0);
    expect(r.text).toBe('2. 连一连。（每组2分，共8分）');
  });

  it('countPinyinGroups：全角空格分隔的拼音词条数 = 词数（2026-08 词条语义，非音节）', () => {
    expect(countPinyinGroups('看拼音写词语：qīng wā　xiǎo hé')).toBe(2);
    // 半角空格混排（音节/词条同为半角空格）→ 显式分隔不可靠，整段计 1 词条（边界保守，不假装精确）
    expect(countPinyinGroups('看拼音写词语：qīng wā xiǎo hé')).toBe(1);
  });

  it('countGridCells：div 内 span 数（一字一格）', () => {
    expect(countGridCells('<div class="tian-zi-ge"><span>春</span><span>天</span></div>')).toBe(2);
  });

  it('countGridCells：div 直书汉字（一字一格）与 span 形态', () => {
    expect(countGridCells('<div class="tian-zi-ge">春</div><span class="tian-zi-ge">天</span>')).toBe(2);
  });

  it('2e2 保护收窄：大题内声称项（每空可验证）+ 未声称项 → 未声称项按剩余分重分配，账目闭合', () => {
    // 大题 32 分：题1 声称"每空2分共8分"（4空自洽，保留）；题2/3 未声称各 12 分 → 合计 8+12+12=32 闭合
    const html = [
      '<h1>二年级语文上册期中测试</h1><p>满分：100分</p>',
      '<h2>一、识字与写字（共3题，共32分）</h2>',
      '<p>1. 看拼音，写词语。（每空2分，共8分）</p><p>qīng wā <span class="blank-1">&emsp;</span> <span class="blank-1">&emsp;</span> <span class="blank-1">&emsp;</span> <span class="blank-1">&emsp;</span></p>',
      '<p>2. 比一比，再组词。（共12分）</p><p>（1）<span class="blank-1">&emsp;</span>（2）<span class="blank-1">&emsp;</span></p>',
      '<p>3. 按要求填空。（共12分）</p><p>（1）<span class="blank-1">&emsp;</span>（2）<span class="blank-1">&emsp;</span></p>',
    ].join('\n');
    const { html: out, silentDetails } = run(html);
    // 账目闭合：不再报"小题分值之和≠大题分"
    expect(silentDetails.some(d => d.message.includes('小题分值之和'))).toBe(false);
    expect(out).toContain('每空2分，共8分'); // 声称项保留
  });
});

describe('根治回归：误报消除（答案区评分标准标题不判"缺描述"）', () => {
  it('答案区"16. 看图写话评分标准（20分"后跟 table 评分标准 → 不报"缺题目要求描述"', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共20分）</h2>',
      '<p>16. 看图写话。（共20分）仔细观察图片，想一想图上画了谁、在干什么，用几句话写下来。</p>',
      '<div class="answer-section">',
      '<h2>参考答案与评分标准</h2>',
      '<p>16. 看图写话评分标准（20分）</p>',
      '<table><tr><td>一类文（17-20分）</td><td>内容具体，语句通顺</td></tr></table>',
      '</div>',
    ].join('\n');
    const { silentDetails } = run(html);
    expect(silentDetails.some(d => d.message.includes('缺题目要求描述'))).toBe(false);
  });

  it('正文写话题标题后跟 ul 要点列表 → 视为有描述，不报（描述段放宽到列表）', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共20分）</h2>',
      '<p>15. 看图写话。（共20分）</p>',
      '<ul><li>仔细观察图画内容</li><li>写清楚时间、地点、人物、事件</li></ul>',
    ].join('\n');
    const { silentDetails } = run(html);
    expect(silentDetails.some(d => d.message.includes('缺题目要求描述'))).toBe(false);
  });

  it('正文写话题真缺描述（标题后直接下一题）→ 仍报（不误杀真问题）', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共20分）</h2>',
      '<p>15. 看图写话。（共20分）</p>',
      '<h2>五、习作（共1题，共20分）</h2>',
      '<p>16. 习作。（共20分）请以"我的家乡"为题写一篇作文。</p>',
    ].join('\n');
    const { silentDetails } = run(html);
    expect(silentDetails.some(d => d.message.includes('缺题目要求描述'))).toBe(true);
  });
});

describe('根治回归：书写格内容剥离（田字格预填答案 → 空格子）', () => {
  it('div 内 span 预填字 → 清空为空格子，保留结构', () => {
    const html = [
      '<h2>一、识字与写字（共1题，共10分）</h2>',
      '<p>1. 看拼音写词语。（每词2分，共10分）</p>',
      '<p>qīng wā xiǎo hé</p>',
      '<div class="tian-zi-ge"><span>春</span></div><div class="tian-zi-ge"><span>天</span></div>',
    ].join('\n');
    const { html: out } = run(html);
    // 格子结构保留、内容已清空
    expect((out.match(/class="tian-zi-ge"/g) || []).length).toBe(2);
    expect(out).not.toContain('<span>春</span>');
    expect(out).not.toContain('<span>天</span>');
  });

  it('span 形态格子直书字 → 清空保留空格子', () => {
    const html = [
      '<h2>一、识字与写字（共1题，共4分）</h2>',
      '<p>2. 抄写生字。（每字1分，共4分）</p>',
      '<span class="tian-zi-ge">日</span><span class="tian-zi-ge">月</span>',
    ].join('\n');
    const { html: out } = run(html);
    expect((out.match(/class="tian-zi-ge"/g) || []).length).toBe(2);
    expect(out).not.toContain('>日<');
    expect(out).not.toContain('>月<');
  });
});

describe('根治回归：作文格补全（完整题干超长也能补，不再只剩横线）', () => {
  it('完整题干（>60字，非短标题行）→ 仍补作文格', () => {
    const longStem = '16. 看图写话。（共20分）仔细观察下面的图画，想一想：图上画的是什么季节？有哪些景物？小朋友们在干什么？他们的心情怎么样？请你发挥想象，用几句话把图上的内容写清楚、写通顺，注意格式正确、书写工整。';
    const html = [
      '<h2>四、表达与交流（共1题，共20分）</h2>',
      `<p>${longStem}</p>`,
      '<p>[IMAGE]\nTYPE:SD\nPROMPT:春天公园\n[/IMAGE]</p>',
    ].join('\n');
    const { html: out, issues } = run(html);
    expect(out).toContain('zuo-wen-ge');
    expect(issues.some(i => i.message.includes('自动补作文格'))).toBe(true);
  });

  it('小练笔题 → 补作文格（关键词补全）', () => {
    const html = [
      '<h2>三、小练笔（共1题，共10分）</h2>',
      '<p>9. 小练笔。（共10分）用几句话写一写你最喜欢的一种小动物。</p>',
    ].join('\n');
    const { html: out } = run(html);
    expect(out).toContain('zuo-wen-ge');
  });

  it('答案区含"写话"标题 → 不当作补格锚点（作文格只补正文）', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共20分）</h2>',
      '<p>16. 看图写话。（共20分）仔细观察图片，用几句话写下来。</p>',
      '<div class="answer-section"><h2>参考答案与评分标准</h2><p>16. 看图写话评分标准</p></div>',
    ].join('\n');
    const { html: out } = run(html);
    // 正文补格且补在正文（答案区不应被插入作文格）
    expect(out).toContain('zuo-wen-ge');
    const body = out.split(/class="answer-section"/)[0];
    expect(body).toContain('zuo-wen-ge');
  });

  it('两道写话题、仅题13 有格 → 题12 也补格（按题级，原整卷级短路漏补）', () => {
    const html = [
      '<h2>四、表达与交流（共2题，共30分）</h2>',
      '<p>12. 看图写话。（15分）仔细观察图片，用几句话写一写图中的内容。</p>',
      '<p>[IMAGE]\nTYPE:SD\nPROMPT:山洞前的宝箱\n[/IMAGE]</p>',
      '<p>词语提示：宝箱　打开　开心　宝石</p>',
      '<p>13. 写话。（15分）以《美丽的树林》为题，写几句话。</p>',
      '<p>词语提示：杨树　松柏　枫树</p>',
      '<div class="zuo-wen-ge"><span>&emsp;</span><span>&emsp;</span></div>',
    ].join('\n');
    const { html: out } = run(html);
    // 两题各补一格（题12 原本无格 → 补；题13 已有格 → 不重复）
    expect((out.match(/class="zuo-wen-ge"/g) || []).length).toBe(2);
  });

  it('两题写话均无格 → 两道都补', () => {
    const html = [
      '<h2>四、表达与交流（共2题，共30分）</h2>',
      '<p>12. 看图写话。（15分）仔细观察图片，写一写。</p>',
      '<p>13. 写话。（15分）以《美丽的树林》为题写几句话。</p>',
    ].join('\n');
    const { html: out } = run(html);
    expect((out.match(/class="zuo-wen-ge"/g) || []).length).toBe(2);
  });

  it('补格数按学段×分值动态：低段15分写话 → 160格兜底（15×8=120<160）', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共15分）</h2>',
      '<p>12. 看图写话。（15分）仔细观察图片，写一写。</p>',
    ].join('\n');
    const { html: out } = run(html, { stage: 'primary_low' });
    const spanCount = (out.match(/<span\b/g) || []).length;
    expect(spanCount).toBe(160);
  });

  it('补格数按学段×分值动态：初中40分作文 → 800格（40×20，中考≥600字+余量，对齐作文纸800）', () => {
    const html = [
      '<h2>三、写作（共1题，共40分）</h2>',
      '<p>21. 以《成长中的一件事》为题写一篇作文。（40分）</p>',
    ].join('\n');
    const { html: out } = run(html, { stage: 'middle', subject: '语文' });
    const spanCount = (out.match(/<span\b/g) || []).length;
    expect(spanCount).toBe(800);
  });

  it('补格数按学段×分值动态：高中60分作文 → 1020格（60×17，高考≥800字+850-900安全篇幅+余量）', () => {
    const html = [
      '<h2>四、写作（共1题，共60分）</h2>',
      '<p>22. 阅读下面的材料，根据要求写作。（60分）</p>',
    ].join('\n');
    const { html: out } = run(html, { stage: 'high', subject: '语文' });
    const spanCount = (out.match(/<span\b/g) || []).length;
    expect(spanCount).toBe(1020);
  });
});

describe('根治回归：分值载体误报消除（每词词条语义 + 小题 segHtml 边界，2026-08）', () => {
  const SEC = (inner) => `<section><h2>一、识字与写字（32分）</h2>${inner}<h2>二、阅读理解（40分）</h2></section>`;

  it('题1 看拼音写词语（每词2分共12分，6词12音节）→ 不报"载体不符"（音节不再误当词）', () => {
    const html = SEC(`
<p>1. 出发准备站——看拼音，写词语。探险队要出发啦。（每词2分，共12分）</p>
<p>yáng shù　sōng bǎi　huā yuán</p>
<p>péng you　bǎo hù　xīn kǔ</p>
<p><span class="tian-zi-ge">杨</span><span class="tian-zi-ge">树</span><span class="tian-zi-ge">松</span><span class="tian-zi-ge">柏</span><span class="tian-zi-ge">花</span><span class="tian-zi-ge">园</span></p>
<p><span class="tian-zi-ge">朋</span><span class="tian-zi-ge">友</span><span class="tian-zi-ge">保</span><span class="tian-zi-ge">护</span><span class="tian-zi-ge">辛</span><span class="tian-zi-ge">苦</span></p>
`.trim());
    const { silentDetails } = run(html);
    expect(silentDetails.some(d => d.type === 'score-label' && d.message.includes('看拼音'))).toBe(false);
  });

  it('题5 照样子（每空1分共4分，4空）后跟无分值题6 → 不报（无分值题也是 segHtml 边界）', () => {
    const html = SEC(`
<p>5. 词语魔法桥——照样子，写一写。你还能说出这样的词语吗？（每空1分，共4分）</p>
<p>例：泡桐　白桦　云杉　翠柏</p>
<p>杨(　　　　　　)　　松(　　　　　　)　　枫(　　　　　　)　　水(　　　　　　)</p>
<p>6. 读一读，把词语补充完整。</p>
<p>(　　　　　　)　(　　　　　　)　(　　　　　　)</p>
`.trim());
    const { silentDetails } = run(html);
    expect(silentDetails.some(d => d.type === 'score-label' && d.message.includes('照样子'))).toBe(false);
  });

  it('真缺陷不误杀：声称"每空1分共4分"但实际仅 2 空 → 仍报"载体不符"', () => {
    const html = SEC(`
<p>5. 词语魔法桥——照样子，写一写。（每空1分，共4分）</p>
<p>例：泡桐　白桦　云杉　翠柏</p>
<p>杨(　　　　　　)　　松(　　　　　　)</p>
`.trim());
    const { silentDetails } = run(html);
    expect(silentDetails.some(d => d.type === 'score-label' && d.message.includes('照样子'))).toBe(true);
  });
});
