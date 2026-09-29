import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { buildLongAnswerCarrierInstruction } from '../../src/config/layoutSpec.js';
import { getMergedSpec } from '../../src/config/layoutSpec.js';
import { buildAnswerSpaceInstruction, getAnswerRegion } from '../../src/config/layoutSpec.js';
import { getCarrierAllowlist } from '../../src/config/layoutSpec.js';
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

  it('口语交际题已有横线作答载体 → 不补作文格（根治横线+作文格重复）', () => {
    const html = [
      '<h2>四、表达与交流（共2题，共30分）</h2>',
      '<p>12. 看图写话。（15分）仔细观察图片，写一写图中的内容。</p>',
      '<p>13. 口语交际：向同学介绍一种你喜欢的水果，用几句话写一写。（15分）</p>',
      '<p><span class="blank-line">&emsp;</span><span class="blank-line">&emsp;</span><span class="blank-line">&emsp;</span></p>',
    ].join('\n');
    const { html: out } = run(html);
    // 题12 补格；题13（口语交际，已有横线）不补 → 仅 1 个作文格
    expect((out.match(/class="zuo-wen-ge"/g) || []).length).toBe(1);
  });

  it('口语交际题无任何载体也排除（本质是"说"，不补作文格）', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共15分）</h2>',
      '<p>13. 口语交际：小华生病了，请你打电话劝劝他。（15分）</p>',
    ].join('\n');
    const { html: out } = run(html);
    expect(out).not.toContain('zuo-wen-ge');
  });

  it('写话题区域已有括号空位载体 → 不重复补作文格', () => {
    const html = [
      '<h2>四、表达与交流（共1题，共15分）</h2>',
      '<p>12. 看图写话。（15分）观察图片，把句子补充完整。</p>',
      '<p>（　　）的春天真美。</p>',
    ].join('\n');
    const { html: out } = run(html);
    expect(out).not.toContain('zuo-wen-ge');
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

  it('圈出类题（载体=句内文字）→ 不按填空验算，不报（强判定守卫）', () => {
    const html = SEC(`
<p>6. 读句子，圈出句子中的错误并改正。（每句2分，共8分）</p>
<p>（1）春天到了，果园里的苹果花开了，桃花开了。</p>
<p>（2）小明穿着新衣服，戴着红领巾，高高兴兴去上学。</p>
`.trim());
    const { silentDetails } = run(html);
    expect(silentDetails.some(d => d.type === 'score-label' && d.message.includes('圈出'))).toBe(false);
  });

  it('课文内容填空（引号空位形态，countBlanks 数不到）→ 不报（计数不可靠不做断言）', () => {
    const html = SEC(`
<p>11. 根据课文内容填空。（每空2分，共10分）</p>
<p>（1）"举头望明月，　　　　　　。"</p>
<p>（2）"桃花潭水深千尺，　　　　　　。"</p>
`.trim());
    const { silentDetails } = run(html);
    expect(silentDetails.some(d => d.type === 'score-label' && d.message.includes('根据课文内容填空'))).toBe(false);
  });

  it('分值抽检条目标记为 debug 级（不进问题列表，但保留诊断线索）', () => {
    const html = SEC(`
<p>5. 词语魔法桥——照样子，写一写。（每空1分，共4分）</p>
<p>例：泡桐　白桦　云杉　翠柏</p>
<p>杨(　　　　　　)　　松(　　　　　　)</p>
`.trim());
    const { silentDetails } = run(html);
    const d = silentDetails.find(x => x.type === 'score-label' && x.message.includes('照样子'));
    expect(d).toBeTruthy();
    expect(d.level).toBe('debug');
  });
});

describe('根治回归：作文格按学科精准适配（2026-08 英语"无作文格"误报根因）', () => {
  const ENG = (h) => auditExamPaper(h, { subject: '英语', stage: 'primary_mid', genType: 'exam' });

  it('英语卷"写作"字样仅出现在答案区评分标准（正文无写话题）→ 不再误报"未找到可补位置"', () => {
    const html = `
<h2>三、词汇与句型（共1题，共15分）</h2>
<p>6. 用所给句型造句。（每句3分，共15分）</p>
<p>I like apples. / She is my friend.</p>
<div class="answer-section"><h2>参考答案与解析</h2><p>写作评分标准：内容完整、语法正确……</p></div>
`.trim();
    const { silentDetails } = ENG(html);
    expect(silentDetails.some(d => d.type === 'writing-grid' && d.message.includes('未找到可补位置'))).toBe(false);
    expect(silentDetails.some(d => d.type === 'writing-grid' && d.message.includes('zuo-wen-ge'))).toBe(false);
  });

  it('英语卷作文格相关检查不再补格（zuo-wen-ge 为语文专属方块格）', () => {
    const html = `
<h2>三、写作（共1题，共15分）</h2>
<p>6. Writing: My Day（共15分）</p>
<p>＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿</p>
`.trim();
    const r = ENG(html);
    expect(r.html).not.toContain('zuo-wen-ge');
  });

  it('英语中段抄写/书写题无四线三格 → debug 级静默抽检（仅诊断线索，不进问题列表）', () => {
    const html = `
<h2>三、抄写（共1题，共10分）</h2>
<p>5. 抄写下列单词。（每个2分，共10分）</p>
<p>cat　dog　bird</p>
`.trim();
    const { silentDetails } = ENG(html);
    const d = silentDetails.find(x => x.type === 'writing-grid' && x.message.includes('four-line-three'));
    expect(d).toBeTruthy();
    expect(d.level).toBe('debug');
  });

  it('数学卷含"写作"字样（应用写作规范）→ writing-grid-fix 收窄后不再触发作文格/载体逻辑', () => {
    const html = `
<h2>五、解决问题（共1题，共10分）</h2>
<p>10. 写出计算过程。（共10分）</p>
<p>120 × 3 = 360</p>
`.trim();
    const r = auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    expect(r.html).not.toContain('zuo-wen-ge');
    expect(r.silentDetails.filter(d => d.type === 'writing-grid')).toHaveLength(0);
  });

  it('语文作文题无格 → 仍自动补作文格（学科限定不破坏主功能）', () => {
    const html = `
<h2>四、习作（共1题，共20分）</h2>
<p>15. 习作：写一篇关于秋天的短文。（共20分）</p>
`.trim();
    const r = auditExamPaper(html, { subject: '语文', stage: 'primary_high', genType: 'exam' });
    expect(r.html).toContain('zuo-wen-ge');
  });

  it('知识总结讲解表内"小练笔/写作方法"（无编号无分值）→ 不补格、不再报"未找到可补位置"（2026-09 summary 草原误报回归）', () => {
    const html = `
<h2>一、知识框架</h2>
<p>表达训练：小练笔——写相聚、惜别经历，融入感受</p>
<p>教材出处：课后小练笔</p>
<h2>二、重点梳理</h2>
<p>（4）写作方法：情景交融（出自：课后第二题）</p>
`.trim();
    const r = auditExamPaper(html, { subject: '语文', stage: 'primary_high', genType: 'summary' });
    expect(r.html).not.toContain('zuo-wen-ge');
    expect(r.issues.some(i => i.message.includes('未找到可补位置'))).toBe(false);
    expect(r.silentDetails.some(d => d.type === 'writing-grid' && d.message.includes('未找到可补位置'))).toBe(false);
  });
});

describe('根治回归：载体声明→输出一致性（题干明确声明载体 → 题内必须输出，全学科三维度）', () => {
  it('数学小学段"在方格纸上画"题内无 square-grid → 声明强要求抽检', () => {
    const html = `
<h2>三、动手操作（共1题，共6分）</h2>
<p>5. 在方格纸上画一个边长为2厘米的正方形。（共6分）</p>
`.trim();
    const { silentDetails } = auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    const d = silentDetails.find(x => x.type === 'writing-grid' && x.message.includes('square-grid'));
    expect(d).toBeTruthy();
  });

  it('数学小学段"在方格纸上画"题内已有 square-grid → 不抽检', () => {
    const html = `
<h2>三、动手操作（共1题，共6分）</h2>
<p>5. 在方格纸上画一个边长为2厘米的正方形。（共6分）</p>
<div class="square-grid"><span>&emsp;</span></div>
`.trim();
    const { silentDetails } = auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    expect(silentDetails.some(d => d.type === 'writing-grid' && d.message.includes('square-grid'))).toBe(false);
  });

  it('英语"在四线三格中抄写"题内无 four-line-three → 声明强要求抽检', () => {
    const html = `
<h2>三、抄写（共1题，共10分）</h2>
<p>5. 在四线三格中抄写下列单词。（每个2分，共10分）</p>
<p>cat　dog　bird</p>
`.trim();
    const { silentDetails } = auditExamPaper(html, { subject: '英语', stage: 'primary_mid', genType: 'exam' });
    const d = silentDetails.find(x => x.type === 'writing-grid' && x.message.includes('four-line-three'));
    expect(d).toBeTruthy();
    expect(d.level).toBe('notice');
  });

  it('语文"在田字格中写"题内无格子 → 声明强要求抽检（2j-4 保留）', () => {
    const html = `
<h2>一、识字与写字（32分）</h2>
<p>1. 照样子，在田字格中把字写规范。（8分）</p>
<p>请写：杨　柏　金　桂</p>
`.trim();
    const { silent } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(silent).toBeGreaterThan(0);
  });

  it('数学初中"在方格纸上画"（该学段方格纸不合法）→ 不按"应输出"强检（越界剥离防线已处理）', () => {
    const html = `
<h2>三、动手操作（共1题，共6分）</h2>
<p>5. 在方格纸上画一个正方形。（共6分）</p>
<div class="square-grid"><span>&emsp;</span></div>
`.trim();
    const r = auditExamPaper(html, { subject: '数学', stage: 'middle', genType: 'exam' });
    // 初中以上 square-grid 被越界剥离（答题纸自带网格）→ 声明检测不应报"应输出"
    expect(r.silentDetails.some(d => d.type === 'writing-grid' && d.message.includes('square-grid'))).toBe(false);
    expect(r.html).not.toContain('square-grid');
  });

  it('语文中段"在田字格中写"（中段田字格不合法）→ 不按"应输出"强检', () => {
    const html = `
<h2>一、识字与写字（32分）</h2>
<p>1. 照样子，在田字格中把字写规范。（8分）</p>
<p>请写：杨　柏　金　桂</p>
`.trim();
    const { silentDetails } = auditExamPaper(html, { subject: '语文', stage: 'primary_mid', genType: 'exam' });
    expect(silentDetails.some(d => d.type === 'writing-grid' && d.message.includes('tian-zi-ge'))).toBe(false);
  });
});

describe('根治回归：答案区题号覆盖度按块级行计数（不依赖模型输出自带换行）', () => {
  const singleLine = `<h1>表内乘法</h1><p>1. 一（8分）</p><p>2. 二（8分）</p><p>3. 三（8分）</p><p>4. 四（8分）</p><p>5. 五（8分）</p><div class="answer-section"><h2>参考答案与解析</h2><p>1. 答案</p><p>2. 答案</p><p>3. 答案</p><p>4. 答案</p><p>5. 答案</p></div>`;

  it('正文与答案区均无原始换行（单行 HTML）→ 题号 5=5，不再误报"答案区题号数(0)"', () => {
    const { silentDetails } = auditExamPaper(singleLine, { subject: '数学', stage: 'primary_low', genType: 'practice' });
    expect(silentDetails.some(d => d.type === 'answer-coverage' && d.message.includes('答案区题号数'))).toBe(false);
  });

  it('答案区确缺题号时仍会告警（防护不失效：正文 5 题、答案区仅 2 题）', () => {
    const poor = singleLine.replace(/<p>3\. 答案<\/p><p>4\. 答案<\/p><p>5\. 答案<\/p>/, '');
    const { silentDetails } = auditExamPaper(poor, { subject: '数学', stage: 'primary_low', genType: 'practice' });
    const d = silentDetails.find(x => x.type === 'answer-coverage' && x.message.includes('答案区题号数'));
    expect(d).toBeTruthy();
  });

  it('🔴 段内小数/枚举/长数字不误计（0.35、2.5×、4.8÷、"3、4、5"与 2024.5 均不算题号）', () => {
    const html = '<h1>口算</h1>'
      + '<p>1. 直接写出得数：0.35+2.5=</p>'
      + '<p>2. 比较大小：4.8÷0.6　3、4、5 三个数</p>'
      + '<p>3. 计算：1.666…+2024.5=</p>'
      + '<div class="answer-section"><h2>参考答案与解析</h2><p>1. 2.85　2. >　3. 2026.166…</p></div>';
    const { silentDetails } = auditExamPaper(html, { subject: '数学', stage: 'primary_high', genType: 'practice' });
    expect(silentDetails.some(d => d.type === 'answer-coverage' && d.message.includes('答案区题号数'))).toBe(false);
    expect(silentDetails.some(d => d.type === 'body-coverage')).toBe(false);
  });

  // 🔴 2026-09-14（用户实证·误报根因）：题号计数改为"最长 1 起始连续递增段"
  it('🔴 题干内编号列举（写作题"提示：1. 2. 3. 4."）不计入题号数——不再虚高计数', () => {
    // 实测样本：英语随堂巩固正文 14 题（1..14 连续）+ 第13题题干内"提示：1.~4."，
    // 原全文计数口径虚计成 18，答案区 14 个 `N.`（子题用 (1)(2)，与正文同构）→ 误报"缺题号/不同构"
    const body = Array.from({ length: 12 }, (_, i) => `<p>${i + 1}. 第${i + 1}题</p>`).join('');
    const html = '<h1>随堂巩固</h1>'
      + body
      + '<p>13. 写一篇短文介绍你曾经面对困难的经历。</p><p>提示：</p>'
      + '<p>1. What was the difficult thing?</p><p>2. What did you do?</p>'
      + '<p>3. What was the result?</p><p>4. What did you learn from it?</p>'
      + '<p>14. 给你的笔友回一封邮件。</p>'
      + '<div class="answer-section"><h2>参考答案与解析</h2>'
      + Array.from({ length: 14 }, (_, i) => `<p>${i + 1}. (1) 答案　(2) 答案</p>`).join('')
      + '</div>';
    const { silentDetails } = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(silentDetails.filter(d => d.type === 'answer-coverage'), '正文 14 题、答案区 14 题号，不应告警').toEqual([]);
  });

  it('🔴 分型不误指：答案区题号偏少但已有同构 `N.` 题号 → 只报"数量少"，不得报"编号体系不同构"', () => {
    const body = Array.from({ length: 10 }, (_, i) => `<p>${i + 1}. 第${i + 1}题</p>`).join('');
    const html = '<h1>练习</h1>' + body
      + '<div class="answer-section"><h2>参考答案与解析</h2>'
      + Array.from({ length: 6 }, (_, i) => `<p>${i + 1}. (1) 答案</p>`).join('')
      + '</div>';
    const { silentDetails } = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'practice' });
    const msgs = silentDetails.filter(d => d.type === 'answer-coverage').map(d => d.message);
    expect(msgs.some(m => m.includes('答案区题号数'))).toBe(true);
    expect(msgs.some(m => m.includes('缺与正文一致的题号')), '已有同构题号时不得指为"体系不同构"').toBe(false);
  });

  it('真缺陷仍报：答案区只有「(1)(2)」括号序号、无任何顶层 `N.` 题号 → 仍报"编号体系不同构"', () => {
    const body = Array.from({ length: 5 }, (_, i) => `<p>${i + 1}. 第${i + 1}题</p>`).join('');
    const html = '<h1>练习</h1>' + body
      + '<div class="answer-section"><h2>参考答案与解析</h2>'
      + '<p>(1) 答案　(2) 答案　(3) 答案</p><p>(1) 答案　(2) 答案</p>'
      + '</div>';
    const { silentDetails } = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(silentDetails.some(d => d.type === 'answer-coverage' && d.message.includes('缺与正文一致的题号'))).toBe(true);
  });
});

// 🔴 2026-09-29 用户实证（语文·二年级上册第一单元试卷）：大题**最后一小题**的书写格（田字格）成稿后消失；
//   经复核**非模型漏输出**，而是程序侧"小题作用域"以 `|| null` 收尾——末题取不到"下一小题"时，兄弟遍历
//   （`while (n && n !== end) n = n.nextSibling`）一路走到**整篇文档末尾**，把后续大题的文本/载体并入了本题：
//     · 2l（载体×题型正规化）：后续大题的"看图写话"关键词命中 forbid → 末题书写格被误剥离（用户主症状）；
//     · 2j-5／2j-5b（补作文格／补横线）：后续大题的载体被误当"本题已有" → 该题漏补；
//     · 2j-4（载体声明抽检）：同上 → 漏报"题干声明载体却未输出"。
//   四处统一改为**本节边界**（本题之后最近的 h2/h3/h4）兜底，使"末题"不再越界（与 2j-5c 既有的"到下一标题"口径对齐）。
describe('根治回归：末题区域越界（`|| null` 兄弟遍历把后续大题并入本题）', () => {
  const G = '<span class="tian-zi-ge"></span>';

  it('2l：大题最后一小题的书写格不因后续大题含"看图写话"而被剥离（用户主症状）', () => {
    const html = '<h2>一、播下小豆种——看拼音写词语（共2题，每题3分，共6分）</h2>'
      + `<p class="question">1. 太阳一晒，水就变成了qì。（3分）</p><p>${G}${G}</p>`
      + `<p class="question">2. 豆芽长出了两片小叶子。（3分）</p><p>${G}${G}</p>`
      + '<h2>二、看图写话（10分）</h2><p>仔细看图，写几句话。</p>';
    expect(countGridCells(run(html).html), '第 2 题（末题）的两格不得被剥离').toBe(4);
  });

  it('2l 反向护栏：真属表达/写话类题内混入的书写格仍被剥离（收口不越界、也不失效）', () => {
    const html = '<h2>一、看图写话（10分）</h2>'
      + `<p class="question">1. 看图写话：仔细看图，写几句话。（10分）</p><p>${G}${G}</p>`;
    expect(countGridCells(run(html).html), '写话类题内的书写格仍应被剥离').toBe(0);
  });

  it('2j-5：本节写话题不因后续大题已有横线而漏补作文格（一、看图写话 → 二、阅读带横线）', () => {
    const html = '<h2>一、看图写话（10分）</h2>'
      + '<p class="question">1. 看图写话。（10分）</p>'
      + '<h2>二、阅读与理解（20分）</h2>'
      + '<p>读短文，完成练习。</p><p><span class="blank-line">&emsp;</span></p>'
      + '<p class="question">2. 短文中“它”指的是什么？（5分）</p>';
    expect(run(html).html.split('<h2>二、')[0], '一、看图写话应补出作文格（不得被二、大题的横线掩蔽）').toContain('zuo-wen-ge');
  });

  it('2j-5b：英语书面表达所在节不被后续大题的横线掩蔽（作答横线补齐行为守卫）', () => {
    const html = '<h2>一、综合运用（10分）</h2>'
      + '<p class="question">1. 书面表达：请写一篇短文介绍你的一天。</p>'
      + '<h2>二、阅读（10分）</h2>'
      + '<p><span class="blank-line">&emsp;</span></p>'
      + '<p class="question">2. 读短文，选择答案。</p>';
    const r = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'exam' });
    expect(r.html.split('<h2>二、')[0], '一、书面表达所在节应有作答横线').toContain('blank-line');
  });

  it('2j-4：末题声明载体却未输出 → 仍抽检（后续大题的同类载体不得掩蔽）', () => {
    // 布局要点：题1 声明田字格但无格子；二、大题内**题2 之前**先有一处田字格（旧代码会把它并入题1 作用域），
    //   题2 自带格子（避免题2 自身也报警，确保命中只可能来自题1）
    const html = '<h2>一、识字与写字（10分）</h2>'
      + '<p class="question">1. 在田字格中写“春”。</p>'
      + '<h2>二、识字与写字（10分）</h2>'
      + `<p>${G}</p>`
      + '<p class="question">2. 在田字格中写“夏”。</p>'
      + `<p>${G}</p>`;
    const { silentDetails } = run(html);
    expect(silentDetails.some(d => d.type === 'writing-grid' && d.message.includes('tian-zi-ge'))).toBe(true);
  });
});

// 🔴 2026-09-29（用户追问"作文格是否落整个题干之后 / 有无学科边界 / 区域是否越入答案区"）实测收口：
//   ① 作文格落点：原仅"大题标题锚点"会把 ref 前移到区域内最后一个题干块，数字编号锚点（"1. 习作。（50分）"）
//      则停在题号行 → 后续"要求：…"（含被误写成「1./2.」的分条）跑到格**后面**（违反 layoutSpec
//      "作答区给在分条之后"口径）。现 ref 前移扩到**全部锚点**，且区域边界先剔除分条（与 2k 同源判据）。
//   ② 区域边界：原末题区域可越过**答案区** → 探针读到答案区里的括号空位 → 写话题漏补作文格，
//      甚至把格插到答案区之后。现三处边界（2j-4/2j-5/2j-5b）一律取"下一个标题/**答案区起点**"。
describe('根治回归：作文格落点（整题之后）与区域边界（不越入答案区）', () => {
  const at = (h, sub) => h.indexOf(sub);

  it('落点：数字编号锚点 + "要求："分条 → 格在分条之后（原插在分条之前）', () => {
    const html = '<h2>三、习作（10分）</h2><p>1. 习作。（10分）</p><p>要求：1. 自拟题目；2. 不少于三句话。</p>';
    const out = run(html).html;
    expect(at(out, 'zuo-wen-ge'), '格应在"要求："段之后').toBeGreaterThan(at(out, '要求：'));
  });

  it('落点：分条被误写成「1./2.」→ 格仍在分条之后（与 2k 同源判据）', () => {
    const html = '<h2>三、习作（10分）</h2><p>1. 习作。（10分）</p><p>要求：</p><p>1. 自拟题目。</p><p>2. 不少于三句话。</p>';
    const out = run(html).html;
    expect(at(out, 'zuo-wen-ge'), '格应在最后一条分条之后').toBeGreaterThan(at(out, '不少于三句话'));
  });

  it('落点：同栏内写话为第1题、其后还有第2题 → 格在第1题题干之后、第2题之前（不跑到栏末）', () => {
    const html = '<h2>四、阅读与写话（20分）</h2><p>1. 习作。（10分）</p><p>要求：写一件难忘的事。</p><p>2. 读短文，回答问题。（10分）</p>';
    const out = run(html).html;
    expect(at(out, 'zuo-wen-ge')).toBeGreaterThan(at(out, '要求：'));
    expect(at(out, 'zuo-wen-ge'), '格不得跑到第2题之后').toBeLessThan(at(out, '2. 读短文'));
  });

  it('边界：答案区含括号空位不得掩蔽本题 → 写话题仍补作文格', () => {
    const html = '<h2>十六、看图写话（10分）</h2><p>仔细看图，写几句话。</p>'
      + '<div class="answer-section"><h2>参考答案与解析</h2><p>1. 评分标准：内容（　）完整。</p></div>';
    expect(run(html).html, '答案区空位不应掩蔽正文写话题').toContain('zuo-wen-ge');
  });

  it('边界：格不得越过答案区 → 有答案区时格仍落在正文题干之后', () => {
    const html = '<h2>十六、看图写话（10分）</h2><p>仔细看图，写几句话。</p>'
      + '<div class="answer-section"><h2>参考答案与解析</h2><p>十六、看图写话评分标准（10分）</p></div>';
    const out = run(html).html;
    expect(at(out, 'zuo-wen-ge'), '格应在答案区之前').toBeLessThan(at(out, 'answer-section'));
  });

  it('防重复：英语书面表达所在栏只补一处作答横线（2j-5b 与 2j-5c 不重复补）', () => {
    const html = '<h2>一、综合运用（10分）</h2><p>1. 书面表达：请写一篇短文介绍你的一天。</p>'
      + '<h2>二、阅读（10分）</h2><p><span class="blank-line">&emsp;</span></p><p>2. 读短文，选择答案。</p>';
    const r = auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'exam' });
    const sec1 = r.html.split('<h2>二、')[0];
    expect((sec1.match(/<div/g) || []).length, '一、栏应只有一处作答横线区').toBe(1);
  });
});

// 🔴 2026-09-29（用户追问"答案区答案会不会再丢"）实测收口：步骤 2 的答案区排除一律依赖
//   `<div class="answer-section">` **容器**，而该容器由**步骤 3a 事后补包**（3a 存在即说明模型会漏包）
//   → 漏包时排除同时失效，实测两类后果（皆为既有缺陷）：
//     · 1.5.2 正文重复截断：答案区里的**同名大题标题**被判为"正文重复" → 在答案区中途截断 → 答案内容整段丢失；
//     · 2k 补作答空间：答案区被当正文大题 → **往答案区里补作答横线**（误补）。
//   现抽出**与容器解耦**的单源 `answerAreaStartIndex` / `findAnswerBound` / `isInAnswerArea`；
//   1.5.2 / 正文区文本 / 2j-3b / 2j-4 / 2j-5 / 2j-5b / 2k 一律走该处（不得再各写一遍正则）。
describe('根治回归：答案区边界与容器解耦（漏包容器时不再丢内容、不再误补）', () => {
  const body = '<h2>一、播下小豆种——看拼音写词语（共2题，每题3分，共6分）</h2>'
    + '<p>1. 水变成了qì。<span class="tian-zi-ge"></span></p>'
    + '<p>2. 豆芽长出了两片小叶子。</p>'
    + '<h2>二、读一读（共1题，共4分）</h2><p>3. 读短文，回答问题。</p>';
  // 真实卷的答案区就是"重复一遍大题标题 + 逐题答案"
  const ansInner = '<h3>一、播下小豆种——看拼音写词语（共2题，每题3分，共6分）</h3>'
    + '<p>1. 汽　2. 快活</p>'
    + '<h3>二、读一读（共1题，共4分）</h3><p>3. 示例：因为豆芽每天都有变化。</p>';

  it('未包容器：同名大题标题不得被判"正文重复"截断 → 答案内容不丢', () => {
    const out = run(`${body}<h2>参考答案与解析</h2>${ansInner}`).html;
    expect(out, '答案区第 1 题答案丢失').toContain('1. 汽');
    expect(out, '答案区第 3 题答案丢失').toContain('因为豆芽每天都有变化');
  });

  it('未包容器：不得往答案区里补作答横线（误补）', () => {
    const html = '<h2>一、综合练习（共2题，每题4分，共8分）</h2>'
      + '<p>1. 甲（　）</p><p>2. 乙（　）</p>'
      + '<h2>参考答案与解析</h2><p>1. A</p><p>2. B</p>';
    const out = run(html).html;
    const ans = out.slice(out.indexOf('参考答案'));
    expect(ans, '答案区内不应出现补出的作答横线').not.toContain('blank-line');
  });

  it('未包容器：答案区里的"看图写话评分标准"不得被当写话题锚点补作文格', () => {
    const html = '<h2>一、读一读（共1题，共4分）</h2><p>1. 读短文，回答问题。</p>'
      + '<h2>参考答案与解析</h2><h3>十六、看图写话评分标准（20分）</h3><p>略。</p>';
    const out = run(html).html;
    const ans = out.slice(out.indexOf('参考答案'));
    expect(ans, '答案区内不应出现作文格').not.toContain('zuo-wen-ge');
  });

  it('已包容器：行为不变（答案完整、不误补）——收口不破坏既有基线', () => {
    const out = run(`${body}<div class="answer-section"><h2>参考答案与解析</h2>${ansInner}</div>`).html;
    expect(out).toContain('1. 汽');
    expect(out).toContain('因为豆芽每天都有变化');
  });
});

// 🔴 2026-09-29 用户实证：「三、我的新发现」与「九、我的新发现」**撞名**（同一份卷同一题名）。
//   源头根治：① 指令侧——大题标题命名单源 `promptLibrary.bigTitleRule` 增加"不得重名"条（单源唯此一处）；
//   ② 程序侧——2j-0b 抽检（notice 级、只报不改）：去序号后的题名（"——"前的名字段）不得两处相同。
describe('根治回归：大题标题重名（源头根治 = 单源条款 + 程序抽检）', () => {
  it('题名撞名 → notice 抽检（「三、我的新发现」/「九、我的新发现」）', () => {
    const html = '<h2>三、我的新发现——读句子，选择正确的字填在括号里（共1题，共2分）</h2>'
      + '<p>1. 甲（　）</p>'
      + '<h2>九、我的新发现——看图写话（共1题，共16分）</h2>'
      + '<p>2. 乙（　）</p>';
    const { silentDetails } = run(html);
    expect(silentDetails.some((d) => d.type === 'cn-ordinal' && /重名/.test(d.message))).toBe(true);
  });

  it('题名各不相同 → 不报（防误报：破折号前的名字段不同即视为不重名）', () => {
    const html = '<h2>一、播下小豆种——看拼音写词语（共1题，共3分）</h2><p>1. 甲（　）</p>'
      + '<h2>二、豆芽悄悄长——读句子（共1题，共3分）</h2><p>2. 乙（　）</p>';
    const { silentDetails } = run(html);
    expect(silentDetails.some((d) => d.type === 'cn-ordinal' && /重名/.test(d.message))).toBe(false);
  });

  it('中学段不报（防噪音：题名取自结构块名，模型无从改名——条款亦仅对小学段强制）', () => {
    const html = '<h2>一、古典之美（共1题，共10分）</h2><p>1. 甲（　）</p>'
      + '<h2>三、古典之美（共1题，共10分）</h2><p>2. 乙（　）</p>';
    const { silentDetails } = auditExamPaper(html, { subject: '语文', stage: 'middle', genType: 'exam' });
    expect(silentDetails.some((d) => d.type === 'cn-ordinal' && /重名/.test(d.message)), '中学段不应报重名噪音').toBe(false);
  });

  it('命名单源已含"不得重名"条（防回潮：条款进入注入模板）', () => {
    for (const stage of ['primary_low', 'middle', 'high']) {
      const tpl = getPromptTemplate({ grade: stage, subject: '语文', genType: 'exam' });
      expect(tpl.template, `学段 ${stage} 缺"大题标题不得重名"条`).toContain('大题标题不得重名');
    }
  });
});

// 🔴 2026-09-29 用户实测（"作文题横线与格子并存"）：A/B 对照证明该现象在**生成实样那一版代码**里就已存在
//   （非本轮改动引入），根因是本轮才挖到底 —— 写话锚点是**大题标题**时，原 `endP` 取其"后第一道数字题号段"，
//   而那正是**本题自己的题干** → 探针区域为空 → 看不到模型已有的横线 → 叠加补格。
describe('根治回归：标题锚点的题区域（不得把本题题干当边界 → 不得叠加补格）', () => {
  it('标题锚点 + 模型已给横线 → 不再叠加补作文格（消"横线+格子并存"）', () => {
    const html = '<h2>九、我的新发现——看图写话（共1题，共16分）</h2>'
      + '<p>30. 观察下面的图片，请写一段话。（16分）</p>'
      + '<p><span class="blank-line">&emsp;</span></p>'.repeat(5);
    const out = run(html).html;
    expect((out.match(/zuo-wen-ge/g) || []).length, '模型已给横线时不应再补格').toBe(0);
  });

  it('标题锚点 + 无任何载体 → 仍照常补格（收口不破坏主功能）', () => {
    const html = '<h2>十六、看图写话（10分）</h2><p>仔细看图，写几句话。</p>';
    expect(run(html).html).toContain('zuo-wen-ge');
  });
});

// 🔴 2026-09-29（用户裁定"全局根治、单源、防回潮"）：以下守卫钉住三条**单一事实源**，
//   任何新增消费方若自写一份（而非走单源），此守卫立即转红。
describe('单源守卫：全局唯一口径（防回潮）', () => {
  const SRC = path.resolve(__dirname, '../../src');
  const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

  it('答案区边界：examValidator 的**代码**里不得再出现"只认容器"的 `.closest("answer-section")` 判据', () => {
    // 只扫代码行（排除注释行）：注释里允许引用旧写法作为沿革说明
    const codeLines = read('utils/examValidator.js')
      .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
    expect(codeLines.some((l) => l.includes("closest('.answer-section')")), '应改走 contentCleaner 单源包装').toBe(false);
  });

  it('答案区边界：唯一口径仍在 contentCleaner，且 examValidator 不另持正则', () => {
    expect(read('utils/contentCleaner.js')).toContain('ANSWER_SECTION_START_RE');
    const ev = read('utils/examValidator.js');
    expect(/ANSWER_SECTION_START_RE\s*=/.test(ev), 'examValidator 不得重新定义答案区正则').toBe(false);
  });

  it('分条判据：唯一定义在 examValidator，且 2k 与 2j-5 同走 classifyNumberedBranches', () => {
    const ev = read('utils/examValidator.js');
    expect((ev.match(/classifyNumberedBranches\s*=/g) || []).length, '仅允许一处定义').toBe(1);
    expect((ev.match(/classifyNumberedBranches\(/g) || []).length, '至少两处消费（2j-5 与 2k）').toBeGreaterThanOrEqual(2);
  });

  it('学科×学段允许表：唯一定义在 layoutSpec.WRITING_CARRIER（消费方须走 getCarrierAllowlist）', () => {
    expect(read('config/layoutSpec.js')).toContain('export const WRITING_CARRIER');
    expect(read('utils/examValidator.js').includes('getCarrierAllowlist('), '越界剥离/声明检查须走查询入口').toBe(true);
  });
});

// 🔴 2026-09-29 用户裁定：① 作答区行数上限**必须分学段**（规格库 ANSWER_MAX_ROWS_BY_STAGE 单一事实源）；
//   ② "该从模型侧解决的不靠程序补丁"——上限与"同题不重复给作答位"一并**注入模型侧**；
//   ③ 程序侧补差通道一律**接入同一规格库**（原仅 2k 接，2j-5b/2j-5c 硬编码 8 行、低段会超上限）。
describe('作答区行数上限（分学段·模型侧与程序侧同接规格库）', () => {
  it('注入条款带本学段上限：英语低段=4 行、高中=8 行（读 ANSWER_MAX_ROWS_BY_STAGE；且已声明管辖域）', () => {
    expect(buildLongAnswerCarrierInstruction('英语', 'primary_low')).toContain('不超过本学段卷面上限（4 行）');
    expect(buildLongAnswerCarrierInstruction('英语', 'primary_mid')).toContain('不超过本学段卷面上限（5 行）');
    expect(buildLongAnswerCarrierInstruction('英语', 'high')).toContain('不超过本学段卷面上限（8 行）');
    // 🔴 2026-09-29（模型侧**去限制**）：上限只声明**管辖域**——不管"篇幅由内容决定"的题
    //    （成篇成段的整段文字、需完整展露推演步骤的题），否则会把它压到学段默认值（错限制）。
    expect(buildLongAnswerCarrierInstruction('英语', 'high')).toContain('不受此上限约束');
  });

  it('注入条款含"同题同性质作答位只给一处"（模型侧消重复载体，纯形态、不点题型）', () => {
    const t = buildLongAnswerCarrierInstruction('语文', 'primary_low');
    expect(t).toContain('只给一处');
    expect(t).toContain('不得再在题后另起同性质的整行短答载体');
    expect(t, '非数学不得出现"过程书写区例外"').not.toContain('例外');
  });

  it('🔴 学科门控：数学支显式豁免"结果位 ↔ 过程书写区"并存（消一刀切冲突）', () => {
    const t = buildLongAnswerCarrierInstruction('数学', 'primary_low');
    expect(t, '数学必须带例外，否则与竖式过程区条款相抵').toContain('例外');
    expect(t).toContain('不属重复');
    // 语文/英语不得带该例外（避免把数学专属语义广播到其他学科）
    expect(buildLongAnswerCarrierInstruction('英语', 'primary_mid')).not.toContain('例外');
  });

  it('程序侧补差受学段上限：英语低段书写题补出横线 ≤ 4 行（原硬编码 8 行）', () => {
    const html = '<h2>一、书面表达（10分）</h2><p>1. 请以 My Day 为题写一篇短文。</p>';
    const r = auditExamPaper(html, { subject: '英语', stage: 'primary_low', genType: 'exam' });
    expect((r.html.match(/blank-line/g) || []).length).toBeLessThanOrEqual(4);
  });

  it('程序侧补差受学段上限：英语高中同为横线体系、不超过 8 行（收口不误伤高学段）', () => {
    const html = '<h2>一、书面表达（20分）</h2><p>1. 请以 My School 为题写一篇短文。</p>';
    const r = auditExamPaper(html, { subject: '英语', stage: 'high', genType: 'exam' });
    expect((r.html.match(/blank-line/g) || []).length).toBeLessThanOrEqual(8);
  });
});

// 🔴 2026-09-29（用户裁定：规格库为**源**、各端皆**消费方** → 不得有第二副本静默漂移）：
//   渲染层（global.css / RichTextEditor）里的田字格静态尺寸必须与规格库 `GRID_CELL` 等值；
//   日后改规格库而不改这些副本，本守卫立即转红（把"改规格库不生效"从静默变成拦截）。
describe('守卫：渲染副本与规格库等值（防静默漂移）', () => {
  const readSrc = (p) => fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');
  const widthOf = (css, cls) => {
    const m = new RegExp(`\\.${cls}[^{]*\\{[^}]*?width:\\s*([\\d.]+)mm`).exec(css);
    return m ? Number(m[1]) : null;
  };
  const spec = getMergedSpec();

  it('global.css 的田字格宽 = GRID_CELL.tian-zi-ge.primary.widthMm', () => {
    expect(widthOf(readSrc('src/styles/global.css'), 'tian-zi-ge'))
      .toBe(spec.GRID_CELL['tian-zi-ge'].primary.widthMm);
  });

  it('RichTextEditor 的田字格宽 = GRID_CELL.tian-zi-ge.primary.widthMm', () => {
    expect(widthOf(readSrc('src/components/RichTextEditor.vue'), 'tian-zi-ge'))
      .toBe(spec.GRID_CELL['tian-zi-ge'].primary.widthMm);
  });

  it('米字格宽度：规格库若定义独立值则各端须与之等值（未定义时与田字格同值）', () => {
    const tz = spec.GRID_CELL['tian-zi-ge'].primary.widthMm;
    const mi = spec.GRID_CELL['mi-zi-ge']?.primary?.widthMm ?? tz;
    expect(widthOf(readSrc('src/styles/global.css'), 'mi-zi-ge')).toBe(mi);
    expect(widthOf(readSrc('src/components/RichTextEditor.vue'), 'mi-zi-ge')).toBe(mi);
  });
});

// 🔴 2026-09-29（模型侧根治·分学段）：数学"竖式过程区 每式 ≥3 行"原写死、未受单题作答区上限约束 →
//   多式题必然越界（低段上限 4 行、两式就要 6 行）。现与规格库同源给出上限并写明按上限平摊。
describe('注入条款：竖式过程区行数受本学段上限（规格库同源）', () => {
  it('低段：每式 ≥3 行 + 合计不超过本学段上限（4 行）', () => {
    const t = buildAnswerSpaceInstruction('数学', 'primary_low');
    expect(t).toContain('每式 ≥3 行');
    expect(t).toContain(`不超过本学段单题作答区上限 ${getAnswerRegion('数学', 'primary_low').maxRowsPerItem} 行`);
  });

  it('初中：上限随学段取值（8 行），非写死', () => {
    const t = buildAnswerSpaceInstruction('数学', 'middle');
    expect(t).toContain(`不超过本学段单题作答区上限 ${getAnswerRegion('数学', 'middle').maxRowsPerItem} 行`);
  });
});

// 🔴 2026-09-29（规格库为源）：无分值兜底行数原为 2k 内写死的 4 / 2 —— 属"规格库缺键、程序自持数值"，
//   现入库 ANSWER_NO_SCORE_ROWS 并由 2k 读取；兜底值仍受本学段单题上限约束。
describe('兜底行数入库（规格库单一事实源）', () => {
  it('规格库含无分值兜底键（整题 4 / 子题 2）', () => {
    expect(getMergedSpec().ANSWER_NO_SCORE_ROWS).toEqual({ item: 4, sub: 2 });
  });

  it('无分值大题按规格库兜底补行，且不越过本学段单题上限（低段 4 行）', () => {
    const html = '<h2>一、积累与运用</h2><p>1. 读一读，写一写。</p>';
    const r = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    const n = (r.html.match(/blank-line/g) || []).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(getAnswerRegion('语文', 'primary_low').maxRowsPerItem);
  });
});

// 🔴 2026-09-29（去一刀切·候选1）：上限原标称"学科无关"，对"答案篇幅由内容长度决定"的题不成立。
//   机制：学科×学段覆盖表 `ANSWER_MAX_ROWS_BY_SUBJECT`（**独立顶层键**，因写进 ANSWER_REGION 条目会被
//   mergeDeep 丢弃 → 实测覆盖不生效，故换表），`getAnswerRegion` 单出口取用（模型侧注入与程序补差同读）；
//   未覆盖即回退 `ANSWER_MAX_ROWS_BY_STAGE` 学段默认。数值属卷面惯例口径（不在代码里编）。
describe('学科×学段可覆盖行数上限（机制验证；数值不写死）', () => {
  it('未覆盖 → 取学段默认（英语高中 8 / 低段 4）', () => {
    expect(getAnswerRegion('英语', 'high').maxRowsPerItem).toBe(8);
    expect(getAnswerRegion('英语', 'primary_low').maxRowsPerItem).toBe(4);
  });

  it('写入覆盖 → 读取端生效；不波及其它学科；清零后回默认', async () => {
    const L = await import('../../src/config/layoutSpec.js');
    try {
      L.saveLayoutSpecOverride({ ...L.loadLayoutSpecOverride(), ANSWER_MAX_ROWS_BY_SUBJECT: { 英语: { high: 20 } } });
      expect(L.getAnswerRegion('英语', 'high').maxRowsPerItem, '覆盖未生效').toBe(20);
      expect(L.getAnswerRegion('英语', 'primary_low').maxRowsPerItem, '同学段外的学段不应变').toBe(4);
      expect(L.getAnswerRegion('语文', 'high').maxRowsPerItem, '不应波及其它学科').toBe(8);
      expect(L.getMergedSpec().ANSWER_MAX_ROWS_BY_SUBJECT, '必须进合并白名单').toBeTruthy();
    } finally {
      L.resetLayoutSpecOverride();
    }
    expect(L.getAnswerRegion('英语', 'high').maxRowsPerItem, '清零后应回默认').toBe(8);
  });

  it('覆盖生效到补差链路：英语高中书面表达补差行数随覆盖上限提高（原被 8 行截断）', async () => {
    const L = await import('../../src/config/layoutSpec.js');
    const html = '<h2>一、书面表达（20分）</h2><p>1. 书面表达：请以 My School 为题写一篇短文。（20分）</p>';
    const baseN = (auditExamPaper(html, { subject: '英语', stage: 'high', genType: 'exam' }).html.match(/blank-line/g) || []).length;
    try {
      L.saveLayoutSpecOverride({ ...L.loadLayoutSpecOverride(), ANSWER_MAX_ROWS_BY_SUBJECT: { 英语: { high: 20 } } });
      const upN = (auditExamPaper(html, { subject: '英语', stage: 'high', genType: 'exam' }).html.match(/blank-line/g) || []).length;
      expect(upN, '覆盖上限后应超过原值').toBeGreaterThan(baseN);
    } finally {
      L.resetLayoutSpecOverride();
    }
  });
});

// 🔴 2026-09-29 用户裁定（课程口径）：英语**低段也要有字母书写题 → 需要四线三格**。原允许表按"英语 3 年级
//   起点、1-2 年级不要求字母书写"一刀切不给低段四线格，与蓝图"低段字母抄写"相抵 → 现纳入允许表。
describe('去一刀切·候选5：英语低段字母书写准许四线三格（用户裁定）', () => {
  it('允许表：英语·低段含 four-line-three', () => {
    expect(getCarrierAllowlist('英语', 'primary_low')).toContain('four-line-three');
  });

  it('行为：低段英语四线三格不被"越界剥离"（原会被剥）', () => {
    const html = '<h2>一、字母书写（10分）</h2>'
      + '<p>1. 照样子，在四线三格中抄写字母 Aa。</p><p><span class="four-line-three">Aa</span></p>';
    const out = auditExamPaper(html, { subject: '英语', stage: 'primary_low', genType: 'exam' }).html;
    expect(out, '低段英语四线三格不应被越界剥离').toContain('four-line-three');
  });

  it('收口不越界：其它学科仍不含四线三格（不得因此放松他科）', () => {
    expect(getCarrierAllowlist('数学', 'primary_low')).not.toContain('four-line-three');
    expect(getCarrierAllowlist('语文', 'primary_low')).not.toContain('four-line-three');
  });
});

// 🔴 2026-09-29（去一刀切·候选2）：无分值兜底原为**学科无关**的 4/2 —— 低段合理、中高段长答主观题偏小。
//   机制：`ANSWER_NO_SCORE_ROWS_BY_SUBJECT[学科][学段]` 覆盖（**独立顶层键**，浅合并故生效）；未覆盖回退默认。
describe('去一刀切·候选2：无分值兜底可按学科×学段覆盖（机制验证；数值不写死）', () => {
  it('未覆盖 → 学科无关默认 4/2', () => {
    const s = getMergedSpec();
    expect(s.ANSWER_NO_SCORE_ROWS).toEqual({ item: 4, sub: 2 });
    expect(s.ANSWER_NO_SCORE_ROWS_BY_SUBJECT, '必须进合并白名单').toBeTruthy();
    expect(s.ANSWER_NO_SCORE_ROWS_BY_SUBJECT['语文']?.high?.item).toBeUndefined();
  });

  it('覆盖 → 生效且不波及其它学科（行为级：无分值大题补出行数随之变化）', async () => {
    const L = await import('../../src/config/layoutSpec.js');
    const html = '<h2>一、论述</h2><p>1. 阅读下文，任选一题作答。</p>';
    const baseN = (auditExamPaper(html, { subject: '语文', stage: 'high', genType: 'exam' }).html.match(/blank-area|blank-line/g) || []).length;
    try {
      L.saveLayoutSpecOverride({ ...L.loadLayoutSpecOverride(), ANSWER_NO_SCORE_ROWS_BY_SUBJECT: { 语文: { high: { item: 8 } } } });
      const upN = (auditExamPaper(html, { subject: '语文', stage: 'high', genType: 'exam' }).html.match(/blank-area|blank-line/g) || []).length;
      expect(upN, '覆盖后补出行数应增加').toBeGreaterThan(baseN);
      const mathN = (auditExamPaper(html, { subject: '数学', stage: 'high', genType: 'exam' }).html.match(/blank-area|blank-line/g) || []).length;
      expect(mathN, '不应波及其它学科').toBe(baseN);
    } finally {
      L.resetLayoutSpecOverride();
    }
  });
});
