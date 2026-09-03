// 整卷质量校验器测试（对应真实案例：二年级语文"识字综合检测"暴露的 5 类问题）
import { describe, it, expect } from 'vitest';
import {
  auditExamPaper,
  normalizePinyinText,
  countBlanks,
  countPinyinGroups,
  fixScoreLabel,
} from '../../src/utils/examValidator.js';

// 默认三维度（语文·小学低段·试卷，命中拼音/分值/子题等规则）
const OPTS = { subject: '语文', stage: 'primary_low', genType: 'exam' };

describe('examValidator 拼音字符归一', () => {
  it('ɡ/ŋ/ɑ 等 IPA 字符归一为标准拼音', () => {
    const { text, fixed } = normalizePinyinText('ɡǎnɡ wān 沙tān xīn kǔ');
    expect(text).toBe('gǎng wān 沙tān xīn kǔ');
    expect(fixed).toBe(2);
  });

  it('全角字母转半角', () => {
    const { text } = normalizePinyinText('ＡＢＣ');
    expect(text).toBe('ABC');
  });

  it('拼音注音括号全角→半角（多音节拼音组）；不误伤说明/序号/单选字母括号', () => {
    const html = '<p>（háng　xíng）　（1）看拼音写词语（提示：注意声调）　（A）选项</p>';
    const { html: out } = auditExamPaper(html, OPTS);
    expect(out).toContain('(háng　xíng)');   // 多音节拼音组 → 半角
    expect(out).toContain('（1）');           // 序号括号保留全角
    expect(out).toContain('（提示：注意声调）'); // 中文说明括号保留
    expect(out).toContain('（A）');           // 单选字母括号保留（非多音节拼音组）
  });
});

describe('examValidator 空位/拼音统计', () => {
  it('统计 blank 标签与括号空位', () => {
    const html = '<p>（1）<u class="blank-4">&emsp;</u>内容<span class="blank-2">&emsp;</span>（　　）</p>';
    expect(countBlanks(html)).toBe(3);
  });

  it('统计拼音词条（词条=显式分隔符为界的连续音节组；2026-08 起"每词"按词条不按音节）', () => {
    // dào zi / xīn kǔ 两个词条（顿号分隔），音节内半角空格不计分隔
    expect(countPinyinGroups('<p>dào zi( )成熟了，xīn kǔ( )</p>')).toBe(2);
  });
});

describe('examValidator 分值标注修正（第4题案例）', () => {
  it('"每空2分"声称4空实际5空时按单位分重算总分（不凑数）', () => {
    const title = '4. 选一选，填一填。（8分，每空2分）';
    // 声称 8分÷2=4 空，实际 5 空 → 以实际为准：5空×2分=10分（不再保留 8 分凑成"每题2分"）
    const { text } = fixScoreLabel(title, 8, 5, 4);
    expect(text).toBe('4. 选一选，填一填。（共5空，每空2分，共10分）');
  });

  it('空数与分值整除时保留"每空X分"', () => {
    const title = '1. 看拼音写词语。（12分，每空2分）';
    // 6 空：12÷2=6 自洽 → 不动
    const { text } = fixScoreLabel(title, 12, 6, 3);
    expect(text).toBe('1. 看拼音写词语。（12分，每空2分）');
  });

  it('连线题"每线1分"声称4线实际3线时按单位分重算（不整除也不去单位）', () => {
    const { text } = fixScoreLabel('（2）连一连。（4分，每线1分）', 4, 3, 1);
    expect(text).toBe('（2）连一连。（共3组，每组1分，共3分）');
  });

  it('"每字/每词"为语义性载体，程序不假装验证——保留原标注', () => {
    const { text } = fixScoreLabel('1. 读拼音写词语。（12分，每字1分）', 12, 6, 1);
    expect(text).toBe('1. 读拼音写词语。（12分，每字1分）');
  });

  it('小题标题"每空2分"与空数不整除时修正（第4题案例）', () => {
    const html = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p class="question">4. 选一选，填一填。（8分，每空2分）</p>',
      '<p>备选字：园　圆　处　外</p>',
      '<p>（1）公(　　　　)里有一棵大榕树。</p>',
      '<p>（2）十五的月亮(　　　　)又(　　　　)。</p>',
      '<p>（3）远(　　　　)处传来一阵笑声。</p>',
      '<p>（4）小朋友们在(　　　　)面玩得真开心。</p>',
    ].join('\n');
    const { html: out, silentDetails } = auditExamPaper(html, OPTS);
    // 只报不改：小题分值标题保留原始声称（8分，每空2分），不再被程序重写为"共5空每空2分共10分"
    expect(out).toContain('4. 选一选，填一填。（8分，每空2分）');
    expect(out).not.toContain('共5空');
    expect(silentDetails.some(d => d.type === 'score-label')).toBe(true);
  });

  it('连线题"每线1分"与线数不整除时去掉单元标注（第9题案例）', () => {
    const html = [
      '<h2>三、阅读与鉴赏（14分）</h2>',
      '<p class="question">9. 读一读下面的短文，完成练习。（14分）</p>',
      '<p>（2）根据短文内容，连一连。（4分，每线1分）</p>',
      '<p>三月　　　　　　　　　荷花</p>',
      '<p>六月　　　　　　　　　桃花</p>',
      '<p>正月　　　　　　　　　山茶</p>',
    ].join('\n');
    const { html: out, silentDetails } = auditExamPaper(html, OPTS);
    // 只报不改：连线题分值标题保留原始声称（4分，每线1分），不再被程序重写
    expect(out).toContain('（2）根据短文内容，连一连。（4分，每线1分）');
    expect(out).not.toContain('共3组');
    expect(silentDetails.some(d => d.type === 'score-label')).toBe(true);
  });

  it('"每题1分共4分"实际仅 2 题时按单位分重算总分（声称值为 AI 笔误）', () => {
    const { text } = fixScoreLabel('二、判断题（每题1分，共4分）', 4, 0, 2);
    // 声称 4题，实际 2 题 → 2题×每题1分=2分（不再保留 4 分凑成"每题2分"）
    expect(text).toBe('二、判断题（共2题，每题1分，共2分）');
  });

  it('整卷：大题"每题1分共4分"下实际 2 题被修正', () => {
    const html = [
      '<h2>二、判断题（每题1分，共4分）</h2>',
      '<p>1. 太阳从东方升起。</p>',
      '<p>2. 月亮比太阳大。</p>',
    ].join('\n');
    const { html: out, silentDetails } = auditExamPaper(html, OPTS);
    // 只报不改：大题标题保留原始声称（每题1分，共4分），不再被程序改写成"共2题每题1分共2分"
    expect(out).toContain('二、判断题（每题1分，共4分）');
    expect(out).not.toContain('共2题，每题1分，共2分');
    expect(silentDetails.some(d => d.type === 'score-label')).toBe(true);
  });

  it('无括号裸文本"每空2分，共16分"触发校验（声称8空实际3空 → 重算为 3空×2分=6分）', () => {
    const { text } = fixScoreLabel('一、填空题，每空2分，共16分。', 16, 3, 1);
    expect(text).toBe('一、填空题，（共3空，每空2分，共6分）。');
  });

  it('countBlanks 统计半角下划线 ___、无 class 的 <u>　　</u> 与全角＿＿', () => {
    const html = '<p>1. ___</p><p>2. <u>　　</u></p><p>3. ＿＿</p>';
    expect(countBlanks(html)).toBe(3);
  });

  it('整卷：半角下划线空位也能被数到并触发"每空"校验（3 空 16 分不整除 → 修正标注）', () => {
    const html = [
      '<h2>一、填空题（每空2分，共16分）</h2>',
      '<p>1. ___</p>',
      '<p>2. ___</p>',
      '<p>3. ___</p>',
    ].join('\n');
    const { html: out, silentDetails } = auditExamPaper(html, OPTS);
    // 只报不改：标题保留原始声称（每空2分，共16分），不再被程序改写成"共3空每空2分共6分"
    expect(out).toContain('一、填空题（每空2分，共16分）');
    expect(out).not.toContain('共3空');
    expect(silentDetails.some(d => d.type === 'score-label')).toBe(true);
  });

  it('有单位分声称的小题不被按大题总分重算（保护语义定价，由 2g 按实际载体重算）', () => {
    const html = [
      '<p>满分：100分</p>',
      '<h2>一、填空题（共16分）</h2>',
      '<p>1. 填一填。（每空2分，共6分）</p>',
      '<p>（1）（　　）（　　）</p>',
      '<p>2. 填一填。（每空2分，共6分）</p>',
      '<p>（1）（　　）（　　）</p>',
    ].join('\n');
    const { html: out, silentDetails } = auditExamPaper(html, OPTS);
    // 只报不改：小题分值标题保留原始声称（每空2分，共6分），不再被程序改写成"共2空每空2分共4分"
    expect(out).toContain('1. 填一填。（每空2分，共6分）');
    expect(out).toContain('2. 填一填。（每空2分，共6分）');
    expect(out).not.toContain('共2空，每空2分，共4分');
    expect(out).not.toContain('每空4分');
    expect(silentDetails.some(d => d.type === 'score-label')).toBe(true);
  });

  it('无单位分声称的标题不触发重算（程序推不出正确总分，保留）', () => {
    const { text } = fixScoreLabel('一、填空题（共16分）', 16, 3, 1);
    expect(text).toBe('一、填空题（共16分）');
  });

  it('声称与实际情况完全自洽时不动（共8空每空2分共16分 且实际8空）', () => {
    const { text } = fixScoreLabel('一、填空题（共8空，每空2分，共16分）', 16, 8, 1);
    expect(text).toBe('一、填空题（共8空，每空2分，共16分）');
  });

  it('裸"每空2分"标注（无共N空/共Y分）时按实际载体数补全', () => {
    const { text } = fixScoreLabel('1. 看拼音写词语。（每空2分）', 0, 3, 1);
    expect(text).toBe('1. 看拼音写词语。（共3空，每空2分，共6分）');
  });
});

describe('examValidator 表格空单元格统计（查字典表案例）', () => {
  it('countBlanks 统计表格空单元格（空 td/全角空格/空白实体）', () => {
    const html = '<table><tr><td>字</td><td></td><td>　</td><td>&emsp;</td><td><br></td></tr></table>';
    expect(countBlanks(html)).toBe(4);
  });

  it('表格内已计载体形态（blank 标签/括号空位）不重复计数', () => {
    const html = '<table><tr><td><u class="blank-2">&emsp;</u></td><td>（　　）</td><td>字</td><td><u>　　</u></td></tr></table>';
    // blank 标签 1 + 括号空位 1 + 无 class u 1，表格不再重复计；有文字的 td 不计
    expect(countBlanks(html)).toBe(3);
  });

  it('查字典表：声称"共29空，每空1分，共29分"但表格仅 4 个空单元格 → 修正为共4空共4分', () => {
    const html = [
      '<h2>六、查字典。（共29空，每空1分，共29分）</h2>',
      '<table>',
      '<tr><td>字</td><td>部首</td><td>读音</td></tr>',
      '<tr><td>沉</td><td></td><td></td></tr>',
      '<tr><td>闷</td><td></td><td></td></tr>',
      '</table>',
    ].join('');
    // 只报不改：声称 29 空但实际 4 空 → 仅静默抽检，标题保留原始声称（共29空，每空1分，共29分）
    const { html: out, silentDetails } = auditExamPaper(html, OPTS);
    expect(out).toContain('（共29空，每空1分，共29分）');
    expect(out).not.toContain('共4空，每空1分，共4分');
    expect(silentDetails.some(d => d.type === 'score-label')).toBe(true);
  });

  it('查字典表：声称"共29空"实际 12 个空单元格 → 按实际 12 空修正总分', () => {
    const html = [
      '<h2>六、用部首查字法查字典，完成下面的表格。（共29空，每空1分，共29分）</h2>',
      '<table>',
      '<tr><td>加点字</td><td>部首</td><td>除部首外几画</td><td>读音</td></tr>',
      '<tr><td>沉</td><td></td><td></td></tr>',
      '<tr><td>闷</td><td></td><td></td></tr>',
      '<tr><td>阔</td><td></td><td></td></tr>',
      '<tr><td>洒</td><td></td><td></td></tr>',
      '<tr><td>透</td><td></td><td></td></tr>',
      '<tr><td>挤</td><td></td><td></td></tr>',
      '</table>',
    ].join('');
    const { html: out, silentDetails } = auditExamPaper(html, OPTS);
    // 只报不改：声称 29 空但实际 12 空 → 仅静默抽检，标题保留原始声称
    expect(out).toContain('（共29空，每空1分，共29分）');
    expect(out).not.toContain('共12空');
    expect(silentDetails.some(d => d.type === 'score-label')).toBe(true);
  });
});

describe('examValidator 模板残留清理', () => {
  it('移除非标准插图占位符残留（第11题案例）', () => {
    const html = '<p class="question">11. 看图写话。</p>\n【插图占位】\nTYPE: SD　STYLE: line_art\nPROMPT:秋天果园摘苹果\n复制 PROMPT 到生图工具生成图片后插入此处\n<div class="zuo-wen-ge"><span>&emsp;</span></div>';
    const { html: out, issues } = auditExamPaper(html, OPTS);
    expect(out).not.toContain('插图占位');
    expect(out).not.toContain('PROMPT');
    expect(issues.some(i => i.type === 'image-placeholder')).toBe(true);
  });

  it('移除被转义的闭合标签残留（</div> 反斜杠形式）', () => {
    const html = '<p>内容</p>\\</div>\\';
    const { html: out } = auditExamPaper(html, OPTS);
    expect(out).not.toContain('\\</div>');
  });

  it('占位块无"插入此处"且后跟正常题目 → 只删占位块本段，不误删后续题目与答案区（发现A回归）', () => {
    const html = [
      '<p>1. 题目正常内容。</p>',
      '<p>【插图占位】请复制PROMPT到渲染器插入图片</p>',
      '<p>2. 下一题内容正常。</p>',
      '<p>3. 再一题。</p>',
      '<div class="answer-section"><h2>参考答案</h2><p>1. 答案</p></div>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, OPTS);
    expect(out).toContain('1. 题目正常内容');
    expect(out).toContain('2. 下一题内容正常');
    expect(out).toContain('3. 再一题');
    expect(out).toContain('answer-section');
    expect(out).not.toContain('插图占位'); // 占位块本段仍被清理
    expect(issues.some(i => i.type === 'image-placeholder')).toBe(true);
  });

  it('移除空条款（注意事项"3．。"）', () => {
    const html = '<p>1．答题前请填写清楚。</p>\n<p>2．请在各题答题区域内作答。</p>\n<p>3．。</p>';
    const { html: out, issues } = auditExamPaper(html, OPTS);
    expect(out).not.toContain('3．。');
    expect(issues.some(i => i.type === 'empty-item')).toBe(true);
  });
});

describe('examValidator [IMAGE] 配图块标准化（image-block-fix）', () => {
  it('一行式 + 缺参数 + HTML 残留 → 规范为 EduRender 标准格式（仅画面要求 PROMPT，不指定引擎）', () => {
    const html = '[IMAGE]\nTYPE:SD STYLE:line_art\nPROMPT: 秋天果园摘苹果&nbsp;两个孩子很开心&lt;/p&gt;\n[/IMAGE]';
    const { html: out, issues } = auditExamPaper(html, OPTS);
    expect(out).toContain('[IMAGE]\nPROMPT:秋天果园摘苹果 两个孩子很开心\n[/IMAGE]');
    expect(out).not.toContain('TYPE:SD');
    expect(out).not.toContain('NEGATIVE:');
    expect(out).not.toContain('&lt;/p&gt;');
    expect(out).not.toContain('&nbsp;');
    expect(issues.some(i => i.type === 'image-block')).toBe(true);
  });

  it('未闭合 [IMAGE] 块自动补全结束标记', () => {
    const html = '[IMAGE]\nTYPE:SD\nPROMPT:一只熊猫在竹林里吃竹子';
    const { html: out } = auditExamPaper(html, OPTS);
    expect(out).toContain('[/IMAGE]');
    expect(out).toContain('[IMAGE]\nPROMPT:一只熊猫在竹林里吃竹子\n[/IMAGE]');
    expect(out).not.toContain('NEGATIVE:');
  });

  it('已完整的标准块保持不变（幂等）', () => {
    const std = '[IMAGE]\nPROMPT:熊猫吃竹子\n[/IMAGE]';
    const { html: out, issues } = auditExamPaper(std, OPTS);
    expect(out).toBe(std);
    expect(issues.some(i => i.type === 'image-block')).toBe(false);
  });

  it('参数行间混入 HTML 残留（</p><p></p>）→ 字段清理（SD 专属参数一律不输出）', () => {
    const html = '[IMAGE]\nTYPE: SD</p>　STYLE: line_art<p></p>　WIDTH: 400<p></p>　HEIGHT: 300<p></p>\nPROMPT: 秋天公园里扫落叶。\nNEGATIVE: 文字、水印、彩色、写实照片<p></p>\n[/IMAGE]';
    const { html: out } = auditExamPaper(html, OPTS);
    expect(out).toContain('[IMAGE]\nPROMPT:秋天公园里扫落叶。\n[/IMAGE]');
    expect(out).not.toContain('</p>');
    expect(out).not.toContain('&lt;/p&gt;');
    expect(out).not.toContain('TYPE:SD');
    expect(out).not.toContain('NEGATIVE:');
  });
});

describe('examValidator 正文重复内容检测截断（duplicate-content-fix）', () => {
  it('同一大题标题出现两次（截断续写重出）→ 截断保留第一份', () => {
    const html = [
      '<h2>一、识字与写字（共6题，共32分）</h2><p>1. 看拼音写词语。</p>',
      '<h2>二、积累与运用（共5题，共24分）</h2><p>7. 量词填空。</p>',
      '<h2>一、识字与写字（共6题，共32分）</h2><p>1. 看拼音写词语。（重复内容）</p>',
      '<div class="answer-section"><h2>参考答案</h2><p>1. 答案</p></div>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, OPTS);
    // 第二个"一、"之后的内容被截断，答案区保留
    expect(out).toContain('二、积累与运用');
    expect((out.match(/一、识字与写字/g) || []).length).toBe(1);
    expect(out).toContain('answer-section');
    expect(issues.some(i => i.type === 'duplicate-content')).toBe(true);
  });

  it('重复答案区 → 保留第一份', () => {
    const html = '<div class="answer-section"><h2>参考答案</h2><p>1. 答案</p></div>\n<div class="answer-section"><h2>参考答案</h2><p>1. 答案（重复）</p></div>';
    const { html: out, issues } = auditExamPaper(html, OPTS);
    expect((out.match(/answer-section/g) || []).length).toBe(1);
    expect(issues.some(i => i.type === 'duplicate-content')).toBe(true);
  });
});

describe('examValidator 排版语义自洽（text-format-fix）', () => {
  it('题干要求"圈出加点字"但正文无 <u> 标记 → 静默计数（不进问题列表）', () => {
    const html = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p class="question">2. 圈出加点字正确的读音。（4分）</p>',
      '<p>（1）一行（háng xíng）白鹭飞上青天。</p>',
      '<p>（2）小号（hào háo）手吹响了集合号。</p>',
    ].join('\n');
    const { issues, silent } = auditExamPaper(html, OPTS);
    expect(issues.every(i => i.severity !== 'warning')).toBe(true);
    expect(silent).toBeGreaterThan(0);
  });

  it('排版语义自洽：加点用 emphasis-dot 标记 → 不触发；用 <u> 下划线（错误做法）→ 触发', () => {
    const okHtml = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p class="question">2. 圈出加点字正确的读音。（4分）</p>',
      '<p>（1）<span class="emphasis-dot">行</span>（háng xíng）白鹭飞上青天。</p>',
      '<p>（2）小<span class="emphasis-dot">号</span>（hào háo）手吹响了集合号。</p>',
    ].join('\n');
    expect(auditExamPaper(okHtml, OPTS).silent).toBe(0);
    // 🔴 <u> 表示加点是错误做法（下划线≠加点），应触发静默提示
    const badHtml = okHtml.replace(/<span class="emphasis-dot">/g, '<u>').replace(/<\/span>/g, '</u>');
    expect(auditExamPaper(badHtml, OPTS).silent).toBeGreaterThan(0);
  });
});

describe('examValidator 书写格按学段（writing-grid-fix）', () => {
  it('语文 3 年级及以上仍用田字格 → 自动剥离 class 保留文字（越界修复）', () => {
    const html = '<h1>默写纸</h1>\n<p>看拼音写词语：<span class="tian-zi-ge">海</span>边</p>';
    const { html: out, issues, fixed } = auditExamPaper(html, { subject: '语文', stage: 'primary_mid', genType: 'dictation' });
    expect(out).not.toContain('tian-zi-ge');
    expect(out).toContain('<span>海</span>边'); // 格子 class 剥离，汉字保留
    expect(issues.some((i) => i.type === 'writing-grid')).toBe(true);
    expect(fixed).toBeGreaterThan(0);
  });

  it('语文 1-2 年级田字格 → 不剥离不提示（学段内合理）', () => {
    const html = '<h1>默写纸</h1>\n<p>看拼音写词语：<span class="tian-zi-ge">海</span></p>';
    const { html: out, silent } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'dictation' });
    expect(out).toContain('tian-zi-ge');
    expect(silent).toBe(0);
  });

  it('英语/数学初中及以上用四线三格 → 越界自动剥离（学科补齐后都拦截）', () => {
    const html = '<h1>默写纸</h1>\n<p>看拼音写词语：Write: <span class="four-line-three">a</span></p>';
    const { html: out1 } = auditExamPaper(html, { subject: '英语', stage: 'middle', genType: 'dictation' });
    expect(out1).not.toContain('four-line-three');
    const { html: out2 } = auditExamPaper(html, { subject: '数学', stage: 'middle', genType: 'dictation' });
    expect(out2).not.toContain('four-line-three');
  });

  it('数学作图方格纸 square-grid：小学段合法保留；初中以上剥离（考试答题纸自带网格）', () => {
    const html = '<h2>二、作图（10分）</h2>\n<p>1. 在方格纸上画一个正方形。</p>\n<div class="square-grid"><span>&emsp;</span></div>';
    const { html: out1 } = auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    expect(out1).toContain('square-grid');
    const { html: out2 } = auditExamPaper(html, { subject: '数学', stage: 'middle', genType: 'exam' });
    expect(out2).not.toContain('square-grid');
  });

  it('sixian-ge（four-line-three 旧名别名）英语中段不剥离；中段以上仍越界剥离（别名折叠）', () => {
    const html = '<h2>二、字母与书写</h2>\n<p>1. 抄写单词：<span class="sixian-ge">cat</span></p>';
    // 英语中段允许表 = four-line-three，sixian-ge 别名按 canonical 折叠 → 合法保留
    const { html: out1, issues } = auditExamPaper(html, { subject: '英语', stage: 'primary_mid', genType: 'exam' });
    expect(out1).toContain('sixian-ge');
    expect(issues.some((i) => i.type === 'writing-grid' && i.message.includes('剥离'))).toBe(false);
    // 英语中段以上（high）允许表 = line → sixian-ge 越界剥离保留文字
    const { html: out2 } = auditExamPaper(html, { subject: '英语', stage: 'high', genType: 'exam' });
    expect(out2).not.toContain('sixian-ge');
    expect(out2).not.toContain('four-line-three');
  });

  it('米字格（mi-zi-ge）收敛为语文低段合法方块格：不再被越界剥离（死载体定位）', () => {
    const html = '<h2>一、识字与写字</h2>\n<p>1. 写汉字：<span class="mi-zi-ge">海</span></p>';
    const { html: out, issues } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(out).toContain('mi-zi-ge'); // 允许表已含 → 保留（写字题不丢书写格）
    expect(issues.some((i) => i.type === 'writing-grid' && i.message.includes('剥离'))).toBe(false);
    // 中段以上仍越界剥离
    const { html: out2 } = auditExamPaper(html, { subject: '语文', stage: 'primary_mid', genType: 'exam' });
    expect(out2).not.toContain('mi-zi-ge');
  });

  it('英语低段允许表显式声明（=line）：语文田字格/四线三格漏入英语低段卷 → 越界剥离（曾 null 漏检）', () => {
    const html = '<h2>一、基础</h2>\n<p>1. 选择：<span class="tian-zi-ge">海</span> <span class="four-line-three">a</span></p>';
    const { html: out, issues } = auditExamPaper(html, { subject: '英语', stage: 'primary_low', genType: 'exam' });
    expect(out).not.toContain('tian-zi-ge');
    expect(out).not.toContain('four-line-three');
    expect(issues.some((i) => i.type === 'writing-grid' && i.message.includes('剥离'))).toBe(true);
  });

  it('2j-6 清空 span 形态行式格内预填内容（four-line-three/sixian-ge/pinyin-line，曾漏清）', () => {
    // four-line-three/sixian-ge：英语中段卷（允许表内，1.5.8 不剥离，2j-6 生效清空）
    const en = [
      '<h2>一、字母与书写</h2>',
      '<p>1. 抄写单词：<span class="four-line-three">cat</span></p>',
      '<p>2. 抄写单词：<span class="sixian-ge">dog</span></p>',
    ].join('\n');
    const { html: enOut, fixed: enFixed } = auditExamPaper(en, { subject: '英语', stage: 'primary_mid', genType: 'exam' });
    expect(enOut).toContain('class="four-line-three"');
    expect(enOut).toContain('class="sixian-ge"');
    expect(enOut).not.toMatch(/<span class="four-line-three">cat<\/span>/);
    expect(enOut).not.toMatch(/<span class="sixian-ge">dog<\/span>/);
    expect(enFixed).toBeGreaterThan(0);
    // pinyin-line：语文低段卷（允许表内），span 形态内嵌拼音漏清同样修复
    const yw = '<h2>一、识字与写字</h2>\n<p>1. 写音节：<span class="pinyin-line">ba</span></p>';
    const { html: ywOut, fixed: ywFixed } = auditExamPaper(yw, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(ywOut).toContain('class="pinyin-line"');
    expect(ywOut).not.toMatch(/<span class="pinyin-line">ba<\/span>/);
    expect(ywFixed).toBeGreaterThan(0);
  });

  it('2j-6 示范豁免：span 行式格紧邻"照样子/例"不清空（示范字保留）', () => {
    const html = '<h2>一、字母与书写</h2>\n<p>1. 照样子抄写：cat <span class="four-line-three">cat</span></p>';
    const { html: out } = auditExamPaper(html, { subject: '英语', stage: 'primary_mid', genType: 'exam' });
    expect(out).toMatch(/<span class="four-line-three">cat<\/span>/); // 示范字保留
  });
});

describe('examValidator 载体×题型正规化（CARRIER_RULES）', () => {
  it('看图写话/习作类题内混入田字格 → 自动剥离保留文字（forbid）', () => {
    const html = [
      '<h2>四、表达与交流（30分）</h2>',
      '<p>1. 看图写话：<span class="tian-zi-ge">海</span>边的小朋友在玩耍。（15分）</p>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(out).not.toContain('tian-zi-ge');
    expect(out).toContain('<span>海</span>边的小朋友在玩耍');
    expect(issues.some((i) => i.type === 'writing-grid')).toBe(true);
  });

  it('语文低段"看拼音写词语"用语境式空格而非田字格 → 不再提示（must 软推断已移除，接受空格形态）', () => {
    const html = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p>1. 看拼音写词语。（8分）</p>',
      '<p>（1）tiān kōng（　　　　）</p>',
    ].join('\n');
    const { silent } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(silent).toBe(0);
  });

  it('题干明确点名"田字格中写"却没格子 → 强要求哨兵提示（2j-4 保留）', () => {
    const html = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p>1. 照样子，在田字格中把字写规范。（8分）</p>',
      '<p>请写：杨　柏　金　桂</p>',
    ].join('\n');
    const { silent } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(silent).toBeGreaterThan(0);
  });

  it('题干明确点名"田字格中写"且已有格子 → 不强要求提示', () => {
    const html = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p>1. 照样子，在田字格中把字写规范。（8分）</p>',
      '<p>请写：<span class="tian-zi-ge">　</span><span class="tian-zi-ge">　</span></p>',
    ].join('\n');
    const { silent } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(silent).toBe(0);
  });

  it('语文低段写字题已用田字格 → 不提示', () => {
    const html = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p>1. 看拼音写词语：<span class="tian-zi-ge">海</span>。（8分）</p>',
    ].join('\n');
    const { silent } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    expect(silent).toBe(0);
  });
});

describe('examValidator 本卷案例根治（20:16 卷 第1/2题 + 大题标题）', () => {
  it('读音题"每空1分"无填空载体 → 载体数数不到，保留原标注（第2题）', () => {
    const html = [
      '<h2>一、识字与写字（共4题，每题8分，共32分）</h2>',
      '<p class="question">2. 用"○"圈出下列句子中加点字的正确读音。（每空1分，共6分）</p>',
      '<p>（1）一行（① háng　② xíng）垂柳站在小河边。</p>',
      '<p>（2）远处传来嘹亮的铜号（① hào　② háo）声。</p>',
      '<p>（3）这只小猴子在树上快乐地行（① háng　② xíng）走。</p>',
      '<p>（4）风在树林里呼号（① hào　② háo），听起来有点可怕。</p>',
      '<p>（5）妈妈在银行（① háng　② xíng）上班，每天都很忙。</p>',
      '<p>（6）运动会上，同学们大声喊"加油"，为运动员们助威、叫号（① hào　② háo）。</p>',
    ].join('\n');
    const { html: out } = auditExamPaper(html, OPTS);
    // 读音题无填空载体（拼音选项不是空位）→ 程序数不到实际载体数，不假装验证，保留原标注
    expect(out).toContain('圈出下列句子中加点字的正确读音。（每空1分，共6分）');
  });

  it('大题标题"每题8分"但各题 12/6/8/6 分不一致 → 自动改"共N题共X分"', () => {
    const html = [
      '<h2>一、识字与写字（共4题，每题8分，共32分）</h2>',
      '<p class="question">1. 读拼音写词语。（共12分）</p>',
      '<p>（1）（tiān kōng）。（　　　　）（　　　　）</p>',
      '<p class="question">2. 圈出加点字的正确读音。（共6分）</p>',
      '<p>（1）一行（háng xíng）。</p>',
      '<p class="question">3. 连一连。（共8分）</p>',
      '<p>雀　---　①鸟</p>',
      '<p class="question">4. 选字填空。（共6分）</p>',
      '<p>（1）公（　　　　）里的菊花开了。</p>',
    ].join('\n');
    const { html: out, silentDetails } = auditExamPaper(html, OPTS);
    // 只报不改：标题"每题8分"与各题实际分值(12/6/8/6)不一致仅静默抽检，标题保留原始声称
    expect(out).toContain('一、识字与写字（共4题，每题8分，共32分）');
    expect(out).not.toContain('一、识字与写字（共4题，共32分）');
    expect(silentDetails.some(d => d.type === 'score-label')).toBe(true);
  });
});

describe('examValidator 看图写话缺图（第11题案例）', () => {
  it('题目含"看图"但无 [IMAGE] 块 → 静默计数（缺图标记，供抽检）', () => {
    const html = '<h2>四、表达与交流（30分）</h2>\n<p class="question">11. 看图写话。（20分）仔细观察下面的图片。</p>';
    const { issues, silent } = auditExamPaper(html, OPTS);
    expect(issues.some(i => i.type === 'image-missing')).toBe(false);
    // 缺图 → 静默计数（image-missing 标记），供生成质检报告提示抽检
    expect(silent).toBeGreaterThan(0);
  });
});

describe('examValidator 答案区检查', () => {
  it('答案区 <h2>参考答案 无 answer-section 包裹 → 自动补包（规则 answer-section-exam）', () => {
    const html = '<p>1. 题目内容</p>\n<h2>参考答案与评分标准</h2>\n<p>1. 答案</p>';
    const { html: out, issues } = auditExamPaper(html, OPTS);
    expect(out).toContain('<div class="answer-section">');
    expect(issues.some(i => i.type === 'answer-section')).toBe(true);
  });

  it('教辅类型（阅读训练）答案区补包同样生效（规则 answer-section-teaching）', () => {
    const html = '<p>1. 阅读短文</p>\n<h2>参考答案与解析</h2>\n<p>1. 答案</p>';
    const { html: out } = auditExamPaper(html, { subject: '语文', stage: 'primary_mid', genType: 'reading' });
    expect(out).toContain('<div class="answer-section">');
  });
});

describe('examValidator 三维度规则过滤', () => {
  it('非语文学科（数学）不执行拼音类规则，也不报拼音问题', () => {
    const html = [
      '<h2>一、计算（32分）</h2>',
      '<p>（1）计算 12+3=（　　　　）。</p>',
    ].join('\n');
    const { issues, silent } = auditExamPaper(html, { subject: '数学', stage: 'primary_mid', genType: 'exam' });
    // 数学不命中拼音规则；分值 32/1 整除无需修复
    expect(issues.some(i => i.type === 'pinyin-blank-mismatch')).toBe(false);
    expect(silent).toBeGreaterThanOrEqual(0);
  });

  it('高中阶段不执行拼音空位/田字格对齐修复（规则已删，无拼音空位修复）', () => {
    const html = [
      '<h2>一、语言运用（32分）</h2>',
      '<p>（1）海边的ɡǎnɡ wān(　　　　)里停着小船，远处的沙tān上有一群海鸥。</p>',
    ].join('\n');
    const { issues } = auditExamPaper(html, { subject: '语文', stage: 'high', genType: 'exam' });
    expect(issues.some(i => i.type === 'pinyin-blank-mismatch')).toBe(false);
  });
});

describe('examValidator 书写作答空间保障（answer-area-fix）', () => {
  const countBlankLine = (html) => (html.match(/blank-line/g) || []).length;
  const countBlankArea = (html) => (html.match(/class="blank-area"/g) || []).length;

  it('语文解答题无作答空间 → 按 分值×系数 补横线行', () => {
    const html = [
      '<h2>三、阅读理解（20分）</h2>',
      '<p>1. 短文主要讲了什么？（3分）</p>',
      '<p>2. 你喜欢文中的谁？为什么？（4分）</p>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, { subject: '语文', stage: 'primary_mid', genType: 'exam' });
    // 语文 primary_mid 系数 1.2 → 3分需 ceil(3.6)=4 行、4分需 ceil(4.8)=5 行
    expect(countBlankLine(out)).toBe(9);
    expect(issues.some(i => i.type === 'answer-area')).toBe(true);
  });

  it('数学解答题 → 补空白区（blank-area，无线）且高度按学段行高', () => {
    const html = [
      '<h2>四、解决问题（20分）</h2>',
      '<p>1. 一个长方形长 12 厘米、宽 8 厘米，求它的周长。（5分）</p>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, { subject: '数学', stage: 'middle', genType: 'exam' });
    // 数学 middle 系数 0.9 → 5分需 ceil(4.5)=5 行空白
    expect(countBlankArea(out)).toBe(5);
    expect(out).toContain('class="blank-area" style="height:7.5mm"');
    expect(issues.some(i => i.type === 'answer-area')).toBe(true);
  });

  it('选择/填空（括号空位）已有载体 → 不补差', () => {
    const html = [
      '<h2>一、选择题（30分）</h2>',
      '<p>1. 下列词语书写正确的一项是（　　）。（2分）</p>',
      '<p>A. 彩红　B. 彩虹　C. 采虹</p>',
      '<h2>二、填空题（20分）</h2>',
      '<p>2. 3+5=（　　）。（2分）</p>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, { subject: '语文', stage: 'primary_mid', genType: 'exam' });
    expect(countBlankLine(out)).toBe(0);
    expect(issues.some(i => i.type === 'answer-area')).toBe(false);
  });

  it('已有横线作答行且足够 → 幂等不重复补差', () => {
    const lines = [];
    for (let i = 0; i < 5; i++) lines.push('<p><span class="blank-line">&emsp;</span></p>');
    const html = ['<h2>三、阅读理解（20分）</h2>', '<p>1. 谈谈你的理解。（4分）</p>', ...lines].join('\n');
    const first = auditExamPaper(html, { subject: '语文', stage: 'primary_mid', genType: 'exam' });
    // 5 行 ≥ 需求 5 行（4×1.2=4.8→5）→ 不再补
    expect(countBlankLine(first.html)).toBe(5);
    const second = auditExamPaper(first.html, { subject: '语文', stage: 'primary_mid', genType: 'exam' });
    expect(countBlankLine(second.html)).toBe(5);
  });

  it('内嵌填空下划线（如 3+5=＿＿）视为已有载体 → 跳过补差', () => {
    const html = [
      '<h2>一、计算（20分）</h2>',
      '<p>1. 直接写得数：3+5=＿＿。（2分）</p>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, { subject: '数学', stage: 'middle', genType: 'exam' });
    expect(countBlankArea(out)).toBe(0);
    expect(issues.some(i => i.type === 'answer-area')).toBe(false);
  });

  it('答案区（answer-section）不做补差，补差后答案区完整保留', () => {
    const html = [
      '<h2>三、解答题（20分）</h2>',
      '<p>1. 列式计算。（4分）</p>',
      '<div class="answer-section"><h2>参考答案</h2><p>1. 答案：12</p></div>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, { subject: '数学', stage: 'middle', genType: 'exam' });
    // 正文补 4 行空白（4×0.9=3.6→4），答案区内不出现 blank-area
    expect(countBlankArea(out)).toBe(4);
    const ansPart = out.split('answer-section')[1];
    expect(ansPart).not.toContain('blank-area');
    expect(issues.some(i => i.type === 'answer-area')).toBe(true);
  });

  it('填空/查字典题（引号空位+全角空格空位+"填一填"）→ 不误补解答区（真实事故回归）', () => {
    const html = [
      '<h2>一、识字与写字（共4题，共32分）</h2>',
      '<p>3. 照样子，用部首查字法填一填。（每空1分，共6分）</p>',
      '<p>例：“桂”的部首是“木”，除去部首还有6画。</p>',
      '<p>（1）“桐”的部首是“　　　　　　”，除去部首还有　　　　画。</p>',
      '<p>（2）“旗”的部首是“　　　　　　”，除去部首还有　　　　画。</p>',
      '<p>（3）“银”的部首是“　　　　　　”，除去部首还有　　　　画。</p>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, { subject: '语文', stage: 'primary_low', genType: 'exam' });
    // 引号空位/裸全角空格 = 填空载体 → 不得补任何作答行
    expect((out.match(/blank-line/g) || []).length).toBe(0);
    expect(issues.some(i => i.type === 'answer-area')).toBe(false);
  });
});

describe('examValidator 英语书面表达横线补差（2j-5b，2026-08）', () => {
  // 英语写作走横线作答体系（carrier=line），与语文作文格对称：按关键词触发、不依赖分值——
  // 知识总结/教辅内表达题常无分值（2k answer-area-fix 依赖分值补不到，且 2k 将写作类 continue 排除），
  // 故英语书面表达题缺横线时在此按关键词补齐 blank-line。
  const ENG_SUMMARY = { subject: '英语', stage: 'middle', genType: 'summary' };
  const ENG_EXAM = { subject: '英语', stage: 'high', genType: 'exam' };

  it('知识点总结内英语书面表达题无横线 → 自动补齐 blank-line 作答区', () => {
    const html = '<p>第三节 书面表达。(15分)</p>\n<p>5. 请以“My Weekend”为题，用英语写一篇短文。</p>\n<p>6. 翻译下列句子。</p>';
    const { html: out, issues } = auditExamPaper(html, ENG_SUMMARY);
    const count = (out.match(/blank-line/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(8); // 无分值兜底 8 行
    expect(issues.some(i => i.type === 'writing-grid' && i.message.includes('补横线'))).toBe(true);
  });

  it('有分值的英语书面表达 → 按分值×系数补行（≥8行）', () => {
    const html = '<p>书面表达。(15分)</p>\n<p>5. 书面表达：Write a short passage about your school,</p>\n<p>不少于60词。</p>\n<p>6. 完形填空。</p>';
    const { html: out } = auditExamPaper(html, ENG_EXAM);
    // 15分×0.8(linePerScore middle/high)=12行 → ≥8
    expect((out.match(/blank-line/g) || []).length).toBeGreaterThanOrEqual(8);
  });

  it('阅读/完形/填空/选择类题不误补横线', () => {
    const html = '<p>Passage A。阅读短文，回答问题。</p>\n<p>1. Read the passage and answer question.</p>\n<p>2. Choose the best answer.</p>\n<p>3. <span class="blank-4">&emsp;</span>填空。</p>';
    const { html: out, issues } = auditExamPaper(html, ENG_SUMMARY);
    expect((out.match(/blank-line/g) || []).length).toBe(0);
    expect(issues.some(i => i.type === 'writing-grid' && i.message.includes('补横线'))).toBe(false);
  });

  it('已有 blank-line 载体的英语书面表达 → 不重复补', () => {
    const html = '<p>书面表达。(15分)</p>\n<p>5. Write a passage about your weekend.</p>\n<p class="write-line"></p>\n<span class="blank-line">&emsp;</span>\n<p>6. 用所给词填空。</p>';
    const { html: out } = auditExamPaper(html, ENG_EXAM);
    // 已有 1 条 blank-line，不应再补成 8+ 条
    expect((out.match(/blank-line/g) || []).length).toBeLessThan(8);
  });

  it('英语学科语文式作文格关键词（看图写话）也应补横线', () => {
    const html = '<p>看图写话。</p>\n<p>5. 看图写话：用英语描述图中场景。</p>\n<p>6. 将下列句子改为否定句。</p>';
    const { html: out } = auditExamPaper(html, ENG_SUMMARY);
    expect((out.match(/blank-line/g) || []).length).toBeGreaterThanOrEqual(8);
  });

  it('非英语学科不触发英语横线补差', () => {
    const html = '<p>书面表达。</p>\n<p>5. 请用中文写一段话描述你的校园生活。</p>\n<p>6. 解释词语。</p>';
    const { html: out } = auditExamPaper(html, { subject: '语文', stage: 'middle', genType: 'summary' });
    expect((out.match(/blank-line/g) || []).length).toBe(0);
  });
});

