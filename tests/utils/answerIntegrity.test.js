// 答案完整性判定测试（生成链路"答案是否丢失"的核心判定逻辑，与 useAiGenerator 真实调用同一函数）
import { describe, it, expect } from 'vitest';
import { detectTruncation, isAnswerShell, wrapAnswerSection, stripAnswerSection, stripLeadingAnswerTitle } from '../../src/composables/useAiGenerator.js';

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
});
