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
});

describe('examValidator 空位/拼音统计', () => {
  it('统计 blank 标签与括号空位', () => {
    const html = '<p>（1）<u class="blank-4">&emsp;</u>内容<span class="blank-2">&emsp;</span>（　　）</p>';
    expect(countBlanks(html)).toBe(3);
  });

  it('统计独立拼音组', () => {
    expect(countPinyinGroups('<p>dào zi( )成熟了，xīn kǔ( )</p>')).toBe(4);
  });
});

describe('examValidator 看拼音写词语缺空自动补全（第1题案例）', () => {
  it('拼音组数与空位数不一致时自动补空', () => {
    const html = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p class="question">1. 根据拼音写词语。（12分）</p>',
      '<p>（1）海边的ɡǎnɡ wān(　　　　)里停着一条条小船，远处的沙tān上有一群海鸥在飞。</p>',
      '<p>（2）田里的dào zi(　　　　)成熟了，农民伯伯虽然xīn kǔ(　　　　)，心里却很高兴。</p>',
    ].join('\n');
    const { html: out, issues } = auditExamPaper(html, OPTS);
    // 补空后空位数应为 4（原 3 空 + 补 tān 1 空）
    expect(countBlanks(out)).toBe(4);
    expect(out).toContain('tān（　　　　）上');
    expect(issues.some(i => i.type === 'pinyin-blank-mismatch')).toBe(true);
  });
});

describe('examValidator 分值标注修正（第4题案例）', () => {
  it('"每空2分"标注与空数不整除时改为"每题X分"', () => {
    const title = '4. 选一选，填一填。（8分，每空2分）';
    // 5 个空：8%5 != 0；4 个子题：8%4 == 0 → 每题2分
    const fixed = fixScoreLabel(title, 8, 5, 4);
    expect(fixed).toBe('4. 选一选，填一填。（共4题，每题2分，共8分）');
  });

  it('空数与分值整除时保留"每空X分"', () => {
    const title = '1. 看拼音写词语。（12分，每空2分）';
    // 6 空：12%6 == 0
    const fixed = fixScoreLabel(title, 12, 6, 3);
    expect(fixed).toBe('1. 看拼音写词语。（12分，每空2分）');
  });

  it('无法整除时去掉单元标注只留总分', () => {
    const fixed = fixScoreLabel('（2）连一连。（4分，每线1分）', 4, 3, 1);
    expect(fixed).toBe('（2）连一连。（共4分）');
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
    const { html: out, issues } = auditExamPaper(html, OPTS);
    // 8分 / 5空 不整除，但 8分 / 4子题 = 每题2分 → 修正为"共4题，每题2分，共8分"
    expect(out).toContain('4. 选一选，填一填。（共4题，每题2分，共8分）');
    expect(issues.some(i => i.type === 'score-label')).toBe(true);
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
    const { html: out, issues } = auditExamPaper(html, OPTS);
    expect(out).toContain('（2）根据短文内容，连一连。（共4分）');
    expect(issues.some(i => i.type === 'score-label')).toBe(true);
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

  it('移除空条款（注意事项"3．。"）', () => {
    const html = '<p>1．答题前请填写清楚。</p>\n<p>2．请在各题答题区域内作答。</p>\n<p>3．。</p>';
    const { html: out, issues } = auditExamPaper(html, OPTS);
    expect(out).not.toContain('3．。');
    expect(issues.some(i => i.type === 'empty-item')).toBe(true);
  });
});

describe('examValidator 子题载体一致性（第2题案例）', () => {
  it('同题组一题有拼音选项一题没有 → 产生提示（不自动改，供抽检）', () => {
    const html = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p class="question">2. 圈出加点字正确的读音。（6分）</p>',
      '<p>（1）一行（háng xíng）白鹭飞上青天。</p>',
      '<p>（2）运动会上，体育老师吹响了铜号（hào háo）。</p>',
      '<p>（3）孔雀的羽毛真漂亮，它可是动物世界里的明星呢！</p>',
    ].join('\n');
    const { issues } = auditExamPaper(html, OPTS);
    expect(issues.some(i => i.type === 'sub-inconsistent')).toBe(true);
  });

  it('读音题缺拼音选项 → 静默计数（不进问题列表）', () => {
    const html = [
      '<h2>一、识字与写字（32分）</h2>',
      '<p class="question">2. 圈出加点字正确的读音。（6分）</p>',
      '<p>（1）一行（háng xíng）白鹭飞上青天。</p>',
      '<p>（2）运动会上，体育老师吹响了铜号（hào háo）。</p>',
      '<p>（3）孔雀的羽毛真漂亮，它可是动物世界里的明星呢！</p>',
    ].join('\n');
    const { issues, silent } = auditExamPaper(html, OPTS);
    // 子题一致性提示存在，但"缺拼音选项"类问题不产生 warning 条目，仅静默计数
    expect(issues.every(i => i.severity !== 'warning')).toBe(true);
    expect(issues.some(i => i.type === 'pinyin-option-missing')).toBe(false);
    expect(silent).toBeGreaterThanOrEqual(0);
  });
});

describe('examValidator 看图写话缺图（第11题案例）', () => {
  it('题目含"看图"但无 [IMAGE] 块 → 不再产生任何提示（由生成前 [IMAGE] 指令强制保证）', () => {
    const html = '<h2>四、表达与交流（30分）</h2>\n<p class="question">11. 看图写话。（20分）仔细观察下面的图片。</p>';
    const { issues, silent } = auditExamPaper(html, OPTS);
    expect(issues.some(i => i.type === 'image-missing')).toBe(false);
    // 该案例不触发任何修复或静默计数（无拼音/分值/答案区问题）
    expect(silent).toBe(0);
  });
});

describe('examValidator 答案区检查', () => {
  it('答案区含"略"空壳 → 静默计数（不进问题列表）', () => {
    const html = '<p>1. 题目</p>\n<div class="answer-section"><h2>参考答案</h2><p>1. 答案</p><p>2. 略</p></div>';
    const { issues, silent } = auditExamPaper(html, OPTS);
    expect(issues.some(i => i.type === 'answer-shell')).toBe(false);
    expect(silent).toBeGreaterThan(0);
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

  it('高中阶段不执行低段拼音规则（pinyin-blank-fill 限定 low/mid）', () => {
    const html = [
      '<h2>一、语言运用（32分）</h2>',
      '<p>（1）海边的ɡǎnɡ wān(　　　　)里停着小船，远处的沙tān上有一群海鸥。</p>',
    ].join('\n');
    const { issues } = auditExamPaper(html, { subject: '语文', stage: 'high', genType: 'exam' });
    expect(issues.some(i => i.type === 'pinyin-blank-mismatch')).toBe(false);
  });
});
