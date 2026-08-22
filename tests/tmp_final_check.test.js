// 临时：最终效果确认——模拟生成符合最新规范的试卷 → 校验 → 导出 docx
import { describe, it, expect } from 'vitest';
import { HardRuleChecker } from '@/utils/qualityChecker';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { Packer } from 'docx';
import fs from 'fs';

const zwg = '<div class="zuo-wen-ge"><div><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span></div><div><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span></div><div><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span><span>&emsp;</span></div></div>';

const content = `<h1 class="main-title">2025—2026学年第二学期小学二年级语文第二单元测试卷</h1>
<p style="text-align:center">（考试时间：60分钟　满分：100分）</p>
<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿＿＿　班级：＿＿＿　姓名：＿＿＿　学号：＿＿＿</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div></div>

<h2>一、识字与写字。（共8题，每题4分，共32分）</h2>
<p class="question">1. 春节到了，家家户户贴春联。请你读拼音，在横线上写出正确的字词，把春联补充完整。（4分）（每空1分）</p>
<p>上联：春风吹，花开草长<u class="blank-2">&emsp;</u>（hú dié）飞。</p>
<p>下联：<u class="blank-2">&emsp;</u>（nóng jiā）忙，采桑养蚕又插秧。</p>
<p>横批：<u class="blank-2">&emsp;</u>（sì jì）平安　麦苗<u class="blank-2">&emsp;</u>（mài miáo）绿。</p>
<p class="question">2. 元宵节看花灯，请你帮小美把正确的字选出来，在下面画上"○"。（4分）（每空1分）</p>
<p>（1）一棵（榕 容）树长得又高又大。（2）公园里有一（座 坐）小石桥。（3）妹妹的（手 首）掌小小的。（4）农民伯伯在田里（辛 幸）苦地劳动。</p>
<p class="question">3. 请你帮小红把生字和对应的读音用线连起来。（4分）</p>
<div class="match-question"><div class="match-col"><div class="match-item">梧</div><div class="match-item">桦</div><div class="match-item">银</div><div class="match-item">虽</div></div><div class="match-col"><div class="match-item">wú</div><div class="match-item">huà</div><div class="match-item">yín</div><div class="match-item">suī</div></div></div>
<p class="question">4. 给加点字选择正确的读音，在正确的下面画"√"。（4分）（每空1分）</p>
<p>（1）一行（háng xíng）垂柳（2）农事了（le liǎo）（3）一场（cháng chǎng）雨（4）号（háo hào）叫</p>

<h2>二、积累与运用。（共8题，每题3分，共24分）</h2>
<p class="question">5. 秋游来到花园，请帮小朋友填上合适的量词。（3分）（每空1分）</p>
<p>一（ ）海鸥　一（ ）鱼塘　一（ ）石桥</p>
<p class="question">6. "十年树木，百年树人"这句话告诉我们（ ）。（3分）</p>
<p class="option">A. 种树需要一百年</p>
<p class="option">B. 培养人才很不容易</p>
<p class="option">C. 树木比人重要</p>
<p class="question">7. 照样子，写一写。（3分）</p>
<p>梧桐树叶像手掌。弯弯的月儿像（ ）。</p>
<p class="question">8. 《树之歌》中，秋天叶子会变红的树是（ ）。（3分）</p>
<p class="option">A. 松树</p>
<p class="option">B. 枫树</p>
<p class="option">C. 白桦</p>

<h2>三、阅读与鉴赏。（共4题，共14分）</h2>
<p>读下面的儿歌，完成练习。</p>
<p>秋季里，稻上场，谷像黄金粒粒香。身体虽辛苦，心里喜洋洋。</p>
<p>【选自教材二年级上册第4课《田家四季歌》】</p>
<p class="question">9. 儿歌中，哪个季节稻谷丰收了？用"○"圈出来。（3分）</p>
<p class="question">10. 农民伯伯虽然身体辛苦，但心里为什么喜洋洋？（3分）</p>
<p class="question">11. "谷像黄金粒粒香"中，把稻谷比作了什么？（4分）</p>
<p>把稻谷比作了<u class="blank-4">&emsp;</u>。</p>
<p class="question">12. 读了儿歌，你觉得农民伯伯的心情是怎样的？说说你的理由。（4分）</p>

<h2>四、表达与交流。（共2题，共30分）</h2>
<p class="question">13. 口语交际：快过年了，请你对爸爸妈妈说几句祝福的话。（10分）</p>
<p class="question">14. 看图写话：仔细看图，写几句话。（20分）</p>
[IMAGE]
TYPE:SD
PROMPT:春天公园里，小朋友在放风筝，黑白色线稿简笔画，图内无文字
NEGATIVE:文字,水印
WIDTH:800
HEIGHT:600
STYLE:line_art
[/IMAGE]
${zwg}

<div class="answer-section"><h2>答案与解析</h2>
<div class="answer-item">1. 蝴蝶、农家、四季、麦苗（4分）【解析】看拼音写词语，注意"蝶"是虫字旁。</div>
<div class="answer-item">2. 榕、座、手、辛（4分）【解析】"榕树"的"榕"是木字旁。</div>
<div class="answer-item">3. 梧—wú、桦—huà、银—yín、虽—suī（4分）</div>
<div class="answer-item">4. háng、liǎo、cháng、háo（4分）【解析】多音字根据意思辨音。</div>
<div class="answer-item">5. 只、方、座（3分）【解析】量词搭配要准确。</div>
<div class="answer-item">6. B（3分）【解析】比喻培养人才需要很长时间。</div>
<div class="answer-item">7. 弯弯的月儿像小船。（3分）【解析】比喻句要找到相似之处。</div>
<div class="answer-item">8. B（3分）【解析】《树之歌》中"枫叶红"。</div>
<div class="answer-item">9. 圈出"秋季"（3分）</div>
<div class="answer-item">10. 因为稻谷丰收了，虽然辛苦但心里高兴。（3分）【评分】说出丰收+喜悦各1.5分。</div>
<div class="answer-item">11. 黄金（4分）【解析】把稻谷比作黄金，写出丰收的颜色和香味。</div>
<div class="answer-item">12. 辛苦但喜悦，因为劳动有了收获。（4分）【评分】心情2分+理由2分。</div>
<div class="answer-item">13. 示例：爸爸妈妈，新年快乐！祝你们身体健康，万事如意！（10分）【评分】有礼貌用语4分、说清祝福4分、语句通顺2分。</div>
<div class="answer-item">14. 示例：春天来了，小明在公园里放风筝。（20分）【评分】内容40%、语言30%、结构20%、书写10%。</div>
</div>`;

describe('最终效果确认', () => {
  it('校验 → 导出 → 生成 docx', async () => {
    // 1) 校验：按新规范应无 error（所有小题标分不再误报、分值体系一致）
    const issues = HardRuleChecker.check(content, 'exam', '语文', 'primary', []);
    const errs = issues.filter(i => i.severity === 'error');
    const warns = issues.filter(i => i.severity === 'warning');
    console.log('校验 issues:', issues.length, '| error:', errs.length, '| warning:', warns.length);
    errs.forEach(i => console.log('  ❌', i.type, '-', i.detail.slice(0, 60)));
    warns.forEach(i => console.log('  ⚠️', i.type, '-', i.detail.slice(0, 60)));
    // 关键断言：不得出现"分值标注不规范"（旧校验已删）；分值体系一致
    expect(errs.filter(i => i.type === '分值标注不规范').length).toBe(0);
    // 2) 导出
    const container = document.createElement('div');
    container.innerHTML = content;
    document.body.appendChild(container);
    const doc = buildDocxFromDom(container, 'primary');
    container.remove();
    const buf = await Packer.toBuffer(doc);
    const processed = await injectDrawingML(buf);
    fs.writeFileSync('d:/wisdom-workshop/最终效果确认.docx', processed);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(processed);
    const xml = await zip.file('word/document.xml').async('string');
    console.log('docx 生成成功，含下划线填空:', (xml.match(/<w:u w:val="single"/g) || []).length, '处');
    console.log('docx 含作文格表格:', xml.includes('zuo-wen-ge') || (xml.match(/<w:tbl/g) || []).length > 0);
    console.log('docx 无非法 baseline 锚定:', (xml.match(/relativeFrom="baseline"/g) || []).length === 0);
  });
});
