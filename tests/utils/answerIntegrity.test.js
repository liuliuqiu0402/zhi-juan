// 答案完整性判定测试（生成链路"答案是否丢失"的核心判定逻辑，与 useAiGenerator 真实调用同一函数）
import { describe, it, expect } from 'vitest';
import { detectTruncation, isAnswerShell, wrapAnswerSection, stripAnswerSection, stripLeadingAnswerTitle } from '../../src/composables/useAiGenerator.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { detectBodyNumberingGap, diagnoseNumberingGap } from '../../src/utils/contentCleaner.js';

describe('答案完整性·截断判定（detectTruncation）', () => {
  it('finish_reason=length 且内容较长 → 判定截断（API 可靠信号）', () => {
    const long = '<h2>一、识字</h2>' + '<p>题目内容</p>'.repeat(60);
    expect(detectTruncation(long, 'length')).toEqual({ truncated: true, byReason: true });
  });

  it('reasoning_capped（推理耗尽被流式中止）→ 判定截断并触发续写', () => {
    const long = '<p>半截正文</p>'.repeat(50);
    expect(detectTruncation(long, 'reasoning_capped')).toEqual({ truncated: true, byReason: true });
  });

  it('完整 HTML 结尾（闭合标签/句号）→ 不判截断（正常收尾）', () => {
    const okHtml = '<h2>三、阅读</h2><p>完整题目。</p><p>答案区由独立调用生成。</p>';
    expect(detectTruncation(okHtml, '')).toEqual({ truncated: false, byReason: false });
    const okTail = okHtml + '。';
    expect(detectTruncation(okTail, '').truncated).toBe(false);
  });

  it('尾部裸文本（无闭合标签/句号收尾）→ 启发式判截断', () => {
    const cut = '<h2>四、写作</h2><p>题目要求写一篇</p>'.repeat(20) + '关于我的暑假生';
    expect(detectTruncation(cut, '').truncated).toBe(true);
  });

  it('内容过短 → 不判截断（由 BODY_VALID_MIN_LEN 另行判定）', () => {
    expect(detectTruncation('短内容', 'length').truncated).toBe(false);
  });
});

describe('答案完整性·空壳答案区检测（isAnswerShell）', () => {
  it('"参考答案"后为"略"占位 → 判为空壳（剥离并独立补生成）', () => {
    const html = '<h2>一、选择题</h2><p>1. A</p><h2>参考答案</h2><p>略</p>';
    expect(isAnswerShell(html)).toBe(true);
  });

  it('"参考答案"后为"待补充/见教材/暂无/此处留白" → 判为空壳', () => {
    for (const placeholder of ['待补充', '见教材', '暂无', '此处留白']) {
      expect(isAnswerShell(`<h2>参考答案</h2><p>${placeholder}</p>`)).toBe(true);
    }
  });

  it('"参考答案"后内容极短（<40 字）但含作答痕迹（纯选项答案）→ 不判空壳（防误剥历史根因）', () => {
    // 🔴 历史事故：真实答案 "1.A 2.B 3.C…" 曾因 <40 字被当空壳剥离 → 补生成失败 → "步骤有答案、结果无答案"
    expect(isAnswerShell('<h2>参考答案</h2><p>1.A 2.B 3.C 4.D</p>')).toBe(false);
    expect(isAnswerShell('<h2>参考答案</h2><p>1. 正确 2. 错误</p>')).toBe(false);
  });

  it('"参考答案"后近乎空白（<10 字且无任何作答痕迹）→ 判为空壳', () => {
    expect(isAnswerShell('<h2>参考答案</h2>')).toBe(true);
    expect(isAnswerShell('<h2>参考答案</h2><p></p>')).toBe(true);
  });

  it('正常完整答案页 → 不判空壳', () => {
    const html = '<h2>参考答案与评分标准</h2><p>1. A（正确选项）</p><p>2. 因为……所以……</p><p>作文评分：一类文 27-30 分……</p>';
    expect(isAnswerShell(html)).toBe(false);
  });

  it('无参考答案标题（含 answer-section 但无 h2）→ 不判空壳', () => {
    expect(isAnswerShell('<div class="answer-section"><h2>评分标准</h2><p>……</p></div>')).toBe(false);
    expect(isAnswerShell('')).toBe(false);
  });
});

describe('答案完整性·once 模式补包（wrapAnswerSection）', () => {
  it('<h2>参考答案 无包裹 → 自动补 answer-section（docx 独立分节）', () => {
    const html = '<h2>一、选择题</h2><p>1. A</p><h2>参考答案</h2><p>1. A</p>';
    const out = wrapAnswerSection(html);
    expect(out).toContain('<div class="answer-section">');
    expect(out).toContain('<h2>参考答案</h2>');
  });

  it('已包裹 → 幂等不变', () => {
    const html = '<h2>一、选择题</h2><p>1. A</p><div class="answer-section"><h2>参考答案</h2><p>1. A</p></div>';
    expect(wrapAnswerSection(html)).toBe(html);
  });

  it('无答案区 → 不变', () => {
    const html = '<h2>一、选择题</h2><p>1. A</p>';
    expect(wrapAnswerSection(html)).toBe(html);
  });
});

describe('答案完整性·split 正文混答剥离（stripAnswerSection）', () => {
  it('正文末尾混入完整《参考答案与解析》→ 整体剥离（防"正文答案+独立答案页"重复）', () => {
    const html = '<h2>二、基础建构任务</h2><p>1. 完成任务一。</p><h2>参考答案与解析</h2><p>1. 答案：……</p>';
    expect(stripAnswerSection(html)).toBe('<h2>二、基础建构任务</h2><p>1. 完成任务一。</p>');
  });

  it('空壳答案区（"略"占位）→ 同样剥离', () => {
    const html = '<h2>二、基础建构任务</h2><p>1. 完成任务一。</p><h2>参考答案</h2><p>略</p>';
    expect(stripAnswerSection(html)).toBe('<h2>二、基础建构任务</h2><p>1. 完成任务一。</p>');
  });

  it('answer-section 包裹的答案区 → 剥离至正文末尾', () => {
    const html = '<p>题目。</p><div class="answer-section"><h2>参考答案与解析</h2><p>1. A</p></div>';
    const out = stripAnswerSection(html);
    expect(out).not.toContain('answer-section');
    expect(out).not.toContain('参考答案');
  });

  it('无答案区 → 原样返回（不误剥正文）', () => {
    const html = '<h2>二、基础建构任务</h2><p>1. 完成任务一。（每空2分）</p>';
    expect(stripAnswerSection(html)).toBe(html);
  });

  it('空串/非字符串 → 安全返回', () => {
    expect(stripAnswerSection('')).toBe('');
    expect(stripAnswerSection(null)).toBe('');
  });
});

describe('答案页自带标题去重（stripLeadingAnswerTitle：段2 包装标题不叠模型自带标题）', () => {
  it('内容开头 <h1>参考答案与解析</h1> → 剥除（保留后续内容，系统 h2 为准）', () => {
    const a = '<h1>参考答案与解析</h1>\n<p>课时练：数学二年级</p><h2>一、基础建构任务</h2><p>1. 答案：A。</p>';
    expect(stripLeadingAnswerTitle(a)).toBe('<p>课时练：数学二年级</p><h2>一、基础建构任务</h2><p>1. 答案：A。</p>');
  });

  it('<h2> 同文自带标题同样剥除（含"评分标准"后缀）', () => {
    expect(stripLeadingAnswerTitle('<h2>参考答案与评分标准</h2><p>1. A</p>')).toBe('<p>1. A</p>');
    expect(stripLeadingAnswerTitle('<h1>参考答案与解析</h1><h2>一、基础建构任务</h2>')).toBe('<h2>一、基础建构任务</h2>');
  });

  it('无自带标题 / 非参考答案开头标题 → 原样不动', () => {
    const noTitle = '<h2>一、基础建构任务</h2><p>1. 答案：A。</p>';
    expect(stripLeadingAnswerTitle(noTitle)).toBe(noTitle);
    expect(stripLeadingAnswerTitle('')).toBe('');
  });

  it('标题被一层容器包裹（<div class="answer-page"><h3>参考答案…</h3>）→ 剥标题、保留容器外壳', () => {
    const wrapped = '<div class="answer-page"><h3>参考答案与解析</h3><div class="section"><h4>一、基础建构任务</h4><p>1. 答案：A。</p></div></div>';
    expect(stripLeadingAnswerTitle(wrapped)).toBe('<div class="answer-page"><div class="section"><h4>一、基础建构任务</h4><p>1. 答案：A。</p></div></div>');
  });

  it('容器包裹 + <p> 对 <h1> 同样生效，且不影响后续正文大题', () => {
    expect(stripLeadingAnswerTitle('<p><h1>参考答案与评分标准</h1></p><h2>一、基础建构任务</h2><p>1. 答案：A。</p>'))
      .toBe('<p></p><h2>一、基础建构任务</h2><p>1. 答案：A。</p>');
  });

  it('🔴 带单元名前缀的自带标题 → 剥除（2026-09-10 实证：<h3>Unit 1 Try your best 课时练 参考答案与解析</h3> 原漏剥 → h2+h3 双层残留）', () => {
    const a = '<h3>Unit 1 Try your best 课时练 参考答案与解析</h3>\n<h4>一、新困难面前怎么说</h4><p>1. A</p>';
    expect(stripLeadingAnswerTitle(a)).toBe('<h4>一、新困难面前怎么说</h4><p>1. A</p>');
  });

  it('正文大标题（不含"参考答案"）→ 原样不动（不误剥）', () => {
    const body = '<h2>知识奠基</h2><h3>一、新困难面前怎么说</h3><p>1. ……</p>';
    expect(stripLeadingAnswerTitle(body)).toBe(body);
  });

  it('🔴 纯文本答案包裹后的 <p> 标题 → 剥除（2026-09-10 补：清零门修复后纯文本按行包裹，<p>参考答案与解析</p> 残留）', () => {
    const a = '<p>参考答案与解析</p><p>1. 答案：A。</p><p>2. 略</p>';
    expect(stripLeadingAnswerTitle(a)).toBe('<p>1. 答案：A。</p><p>2. 略</p>');
  });

  it('🔴 <p> 标题带单元名前缀 → 剥除；"参考答案：1. A"（冒号后有正文）→ 不剥（防吞答案）', () => {
    expect(stripLeadingAnswerTitle('<p>Unit 1 参考答案</p><p>1. A</p>')).toBe('<p>1. A</p>');
    const keep = '<p>参考答案：1. A</p><p>2. B</p>';
    expect(stripLeadingAnswerTitle(keep)).toBe(keep);
    const plainFirst = '<p>1. A</p><p>2. B</p>';
    expect(stripLeadingAnswerTitle(plainFirst)).toBe(plainFirst);
  });
});

describe('正文/答案 题号数双向守卫（auditExamPaper）', () => {
  const run = (html) => auditExamPaper(html, { subject: '英语', stage: 'primary_high', genType: 'practice' });
  const msgs = (html) => (run(html).silentDetails || []).map((d) => d.message).join(' | ');

  it('🔴 正文题号明显少于答案区 → 报"正文疑似丢题"（本次实测缺口：正文缺第2~5题、答案区完整）', () => {
    const bodyShort = [
      '<h1>六年级英语上册Unit 1 Try your best课时训练</h1>',
      '<h2>知识奠基</h2>',
      '<p>1. 第一题（　）</p>', '<p>2. 第二题（　）</p>', '<p>6. 第六题（　）</p>',
      '<div class="answer-section"><h2>参考答案与解析</h2>',
      '<p>1. A</p><p>2. B</p><p>3. C</p><p>4. A</p><p>5. B</p><p>6. C</p>',
      '</div>',
    ].join('\n');
    expect(msgs(bodyShort)).toContain('正文题号数');
  });

  it('正文与答案区题号一致 → 不报该提示（防误报）', () => {
    const ok = [
      '<h1>标题</h1>',
      '<p>1. A（　）</p><p>2. B（　）</p><p>3. C（　）</p><p>4. D（　）</p>',
      '<div class="answer-section"><h2>参考答案与解析</h2><p>1. A</p><p>2. B</p><p>3. C</p><p>4. D</p></div>',
    ].join('\n');
    expect(msgs(ok)).not.toContain('正文题号数');
  });

  it('反向：答案区题号明显少于正文 → 仍报原"答案区题号数"提示（原功能不回归）', () => {
    const ansShort = [
      '<h1>标题</h1>',
      '<p>1. A（　）</p><p>2. B（　）</p><p>3. C（　）</p><p>4. D（　）</p><p>5. E（　）</p>',
      '<div class="answer-section"><h2>参考答案与解析</h2><p>1. A</p></div>',
    ].join('\n');
    expect(msgs(ansShort)).toContain('答案区题号数');
  });

  it('🔴 紧凑连排答案（序号顿号层级/段内题号）→ 与正文口径对齐，不误报（用户实证：答案区题号数(2) vs 正文(12)）', () => {
    const body = '<h1>六年级英语上册Unit 1 Try your best课时训练</h1>'
      + Array.from({ length: 12 }, (_, i) => `<p>${i + 1}. 第${i + 1}题（　）</p>`).join('');
    const ans = '<div class="answer-section"><h2>参考答案与解析</h2>'
      + '<p>一、1. (1) asked　(2) practised　(3) wanted　(4) remembered</p>'
      + '<p>2. (1) was　(2) were　(3) began　(4) forgot　(5) saw</p>'
      + Array.from({ length: 10 }, (_, i) => `<p>${i + 3}. 答案${i + 3}</p>`).join('')
      + '</div>';
    const m = msgs(body + ans);
    expect(m).not.toContain('答案区题号数');
    expect(m).not.toContain('正文题号数');
  });
});

describe('正文缺号检测（detectBodyNumberingGap）', () => {
  const p = (i) => `<p>${i}. 第${i}题（　）</p>`;
  const html = (...ps) => '<h1>英语课时训练</h1>\n' + ps.join('\n');

  it('🔴 缺 2~5 题、只剩题号 1 与 6（2026-09-10 实测样本）→ 判缺（旧实现 found.size<3 漏检）', () => {
    expect(detectBodyNumberingGap(html(p(1), p(6)))).toEqual({ peak: 6, found: [1, 6], missing: [2, 3, 4, 5] });
  });

  it('中段跳号（缺 3）→ 判缺', () => {
    expect(detectBodyNumberingGap(html(p(1), p(2), p(4)))).toEqual({ peak: 4, found: [1, 2, 4], missing: [3] });
  });

  it('完整连续 1~6 → 不判（正常卷不误报）', () => {
    expect(detectBodyNumberingGap(html(p(1), p(2), p(3), p(4), p(5), p(6)))).toBeNull();
  });

  it('小卷（峰值 <3，如 1~2 题）→ 不判（防小卷误报）', () => {
    expect(detectBodyNumberingGap(html(p(1), p(2)))).toBeNull();
    expect(detectBodyNumberingGap('<h2>知识梳理</h2><p>无题号内容</p>')).toBeNull();
  });

  it('清单型大卷：70 条连续 → 不判；仅 1 处缺失 → 不判（防目录/知识点清单跳号误报）', () => {
    const cont70 = html(...Array.from({ length: 70 }, (_, i) => p(i + 1)));
    expect(detectBodyNumberingGap(cont70)).toBeNull();
    const skip69 = cont70.replace('<p>69. 第69题（　）</p>', '');
    expect(detectBodyNumberingGap(skip69)).toBeNull();
  });

  it('清单型大卷连续缺失 ≥3 处 → 判缺（大卷缺题不漏检）', () => {
    const skip668 = html(
      ...Array.from({ length: 65 }, (_, i) => p(i + 1)),
      p(69), p(70),
    );
    expect(detectBodyNumberingGap(skip668)).toEqual({ peak: 70, found: [...Array.from({ length: 65 }, (_, i) => i + 1), 69, 70], missing: [66, 67, 68] });
  });
});

describe('丢题根因诊断（diagnoseNumberingGap）：分辨"模型真跳号" vs "提取规则漏判"', () => {
  const p = (i) => `<p>${i}. 第${i}题（　）</p>`;
  const head = '<h1>英语课时训练</h1>\n';

  it('真跳号：缺号在正文任何位置都不出现 → 指向模型跳号', () => {
    const d = diagnoseNumberingGap(head + [p(1), p(2), p(6)].join('\n'));
    expect(d.missing).toEqual([3, 4, 5]);
    d.peek.forEach((x) => expect(x.where).toContain('未出现'));
  });

  it('提取漏判（同段连写 `… 4. …`）：缺号出现在句中 → 指向提取漏判，不误判为真跳号', () => {
    const h = head + [p(1), p(2), p(3)].join('\n') + '\n<p>3. 计算 4. 下面各题</p>\n' + p(5);
    const d = diagnoseNumberingGap(h);
    expect(d.missing).toEqual([4]);
    const four = d.peek.find((x) => x.n === 4);
    expect(four.where).toContain('漏判');
    expect(four.sample).toContain('4.');
  });

  it('提取漏判（括号序号 `（4）`）：括号形态 → 指向提取漏判', () => {
    const h = head + [p(1), p(2), p(3)].join('\n') + '\n<p>（4）看图数一数一共有多少个</p>\n' + p(5);
    const d = diagnoseNumberingGap(h);
    expect(d.missing).toEqual([4]);
    const four = d.peek.find((x) => x.n === 4);
    expect(four.where).toContain('括号序号');
  });

  it('无缺口 → 不产出诊断（gap=null，与拦截判定一致）', () => {
    const d = diagnoseNumberingGap(head + [p(1), p(2), p(3)].join('\n'));
    expect(d.gap).toBeNull();
    expect(d.missing).toEqual([]);
    expect(d.peek).toEqual([]);
    expect(d.skeleton).toEqual([]);
  });

  it('题号骨架：列出全部"行首数字/括号序号"行，供人工判定缺号是大题还是子题', () => {
    const h = head + [p(1)].join('\n') + '\n<p>（2）看图数一数</p>\n<p>（3）圈一圈</p>\n' + p(4);
    const d = diagnoseNumberingGap(h);
    expect(d.missing).toEqual([2, 3]);
    expect(d.skeleton.some((s) => s.startsWith('1.'))).toBe(true);
    expect(d.skeleton.some((s) => s.startsWith('（2）'))).toBe(true);
    expect(d.skeleton.some((s) => s.startsWith('（3）'))).toBe(true);
    expect(d.skeleton.some((s) => s.startsWith('4.'))).toBe(true);
  });
});
