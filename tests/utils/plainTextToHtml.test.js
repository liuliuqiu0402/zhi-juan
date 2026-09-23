import { describe, it, expect } from 'vitest';
import { plainTextToHtml } from '@/utils/plainTextToHtml.js';

/**
 * 纯文本 → 段落 HTML（📁 导入 .txt/.md 到原文框用，2026-09）
 * 🔴 关键两条：① 文件内容属外部输入，必须**先转义再拼标签**（否则等于执行用户文件里的 HTML）；
 *             ② 不得动 `$…$`（公式以 LaTeX 原样保留，交给 KaTeX 出印刷形态）。
 */
describe('plainTextToHtml', () => {
  it('空行分段、段内换行转 <br>', () => {
    expect(plainTextToHtml('第一段\n第二行\n\n第二段')).toBe('<p>第一段<br>第二行</p>\n<p>第二段</p>');
  });

  it('🔴 HTML 特殊字符必须转义（不得把文件内容当标签执行）', () => {
    const out = plainTextToHtml('<script>alert(1)</script> & "引号"');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&amp;');
    expect(out).toContain('&quot;');
  });

  it('🔴 $…$ 公式原样保留（这是全链路唯一的公式表示，不能被转义或吃掉）', () => {
    const out = plainTextToHtml('基本不等式：$\\sqrt{ab}\\leqslant\\frac{a+b}{2}$');
    expect(out).toContain('$\\sqrt{ab}\\leqslant\\frac{a+b}{2}$');
  });

  it('兼容 CRLF 与 BOM', () => {
    expect(plainTextToHtml('\uFEFF甲\r\n\r\n乙')).toBe('<p>甲</p>\n<p>乙</p>');
  });

  it('空文本 → 空串', () => {
    expect(plainTextToHtml('')).toBe('');
    expect(plainTextToHtml(null)).toBe('');
    expect(plainTextToHtml('   \n  ')).toBe('');
  });
});
