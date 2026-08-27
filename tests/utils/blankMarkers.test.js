import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers, resizeBlanksByAnswer } from '../../src/utils/contentCleaner.js';

describe('normalizeBlankMarkers 括号填空归一（正文主路径）', () => {
  it('双括号纯空白 ((　　)) → span，无外层括号（真实事故回归：卷面 ((　)) 双括号）', () => {
    const out = normalizeBlankMarkers('一((　　　　))海鸥');
    expect(out).toContain('<span class="blank-6">&emsp;</span>');
    expect(out).not.toMatch(/\(<span class="blank/);
    expect(out).not.toContain('((');
    expect(out).not.toContain('))');
  });

  it('单括号纯空白 （　　） → span（无外层括号）', () => {
    const out = normalizeBlankMarkers('（1）（　　　　）');
    expect(out).toContain('<span class="blank-6">&emsp;</span>');
    expect(out).not.toMatch(/\(<span class="blank/);
  });

  it('括号+下划线组合 （＿ ＿） → span', () => {
    const out = normalizeBlankMarkers('一（＿ ＿）海鸥');
    expect(out).toContain('<span class="blank-');
    expect(out).not.toContain('＿');
  });

  it('已有 blank-N 标签不重复转换（幂等）', () => {
    const once = normalizeBlankMarkers('（　　　　）');
    const twice = normalizeBlankMarkers(once);
    expect(twice).toBe(once);
  });
});

describe('resizeBlanksByAnswer 按答案回填空位宽度', () => {
  it('答案 4 字 ÷ 2 空 × wordGap2 → 每空 blank-4', () => {
    const html = '<p>3. 把下面的字写下来。<span class="blank-2">&emsp;</span><span class="blank-2">&emsp;</span></p>';
    const ans = '<div class="answer-section"><h2>参考答案</h2><p>3. 答案：天空 大地</p><p>解析：略</p></div>';
    const out = resizeBlanksByAnswer(html, ans);
    expect(out).toContain('blank-4');
    expect(out).not.toContain('blank-2');
  });

  it('答案区无对应题号 → 保持原样（安全）', () => {
    const html = '<p>5. <span class="blank-2">&emsp;</span></p>';
    const ans = '<div class="answer-section"><h2>参考答案</h2><p>9. 答案：无</p></div>';
    expect(resizeBlanksByAnswer(html, ans)).toBe(html);
  });

  it('多字答案 → 宽度按字数增长（7 字单空 → blank-10 封顶）', () => {
    const html = '<p>8. <span class="blank-2">&emsp;</span></p>';
    const ans = '<div class="answer-section"><h2>参考答案</h2><p>8. 答案：床前明月光疑是地上霜</p></div>';
    const out = resizeBlanksByAnswer(html, ans);
    expect(out).toContain('blank-10');
  });
});
