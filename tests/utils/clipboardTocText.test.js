import { describe, it, expect, vi, afterEach } from 'vitest';
import { htmlToPlainLines, readTocTextFromClipboard } from '@/utils/clipboardTocText.js';
import { useTocParser } from '@/composables/useTocParser.js';

/**
 * 目录导入的剪贴板富文本链路（2026-09 用户实证回归）
 * ------------------------------------------------------------
 * 用户场景：上传教材 → 确认目录结构 →「📋 从剪贴板导入」，
 * 目录里 `√(ab) ⩽ (a+b)/2` 只剩字母（`ab a+b 2`）—— 根号、分数线、不等号全丢。
 * 根因：该入口只读剪贴板**纯文本**版本；Word 的 `text/html` 版本里带着 OMML，此前没被用上。
 */

describe('htmlToPlainLines：HTML → 一行一条的目录文本', () => {
  it('块级标签断行，否则整份目录会黏成一行', () => {
    expect(htmlToPlainLines('<p>第1章 集合 2</p><p>1.1 集合的概念 5</p>')).toBe('第1章 集合 2\n1.1 集合的概念 5');
  });

  it('表格单元格之间补空格，避免"标题页码"黏连', () => {
    expect(htmlToPlainLines('<table><tr><td>3.2 基本不等式</td><td>55</td></tr></table>'))
      .toBe('3.2 基本不等式 55');
  });

  it('<br> 与 div 断行', () => {
    expect(htmlToPlainLines('A<br>B<div>C</div>')).toBe('A\nB\nC');
  });

  it('🔴 跳过 <style>/<script>/<xml>：Word 剪贴板 HTML 里全是这类噪声，不能混进目录', () => {
    const html = '<html xmlns:m="x"><head><style>p.MsoNormal{margin:0}</style></head>'
      + '<body><p>第1章 集合 2</p></body></html>';
    expect(htmlToPlainLines(html)).toBe('第1章 集合 2');
  });

  it('实体与零宽字符被正常还原/清除', () => {
    expect(htmlToPlainLines('<p>a&nbsp;b&amp;c&lt;d</p>')).toBe('a b&c<d');
    expect(htmlToPlainLines('<p>集\u200b合 2</p>')).toBe('集合 2');
  });

  it('空内容 → 空串（调用方据此回退纯文本）', () => {
    expect(htmlToPlainLines('')).toBe('');
    expect(htmlToPlainLines('<p>   </p>')).toBe('');
  });
});

describe('🔴 端到端：Word 剪贴板富文本 → 目录标题里的公式保住 $…$', () => {
  // 与 Word 真实剪贴板同形：公式 OMML 塞在 `<!--[if gte msEquation 12]>…<![endif]-->` 里
  const R = (t) => `<m:r><m:rPr/><m:t>${t}</m:t></m:r>`;
  const P = (t) => `<m:r><m:rPr><m:nor/><m:sty m:val="p"/></m:rPr><m:t>${t}</m:t></m:r>`;

  it('「3.2 基本不等式 √(ab) ⩽ (a+b)/2」整条还原，且不残留任何 OMML 碎片', async () => {
    const oMath = '<m:oMath>'
      + `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${R('ab')}</m:e></m:rad>`
      + `${P('⩽')}`
      + `<m:f><m:fPr/><m:num>${R('a+b')}</m:num><m:den>${P('2')}</m:den></m:f>`
      + '</m:oMath>';
    const oMath2 = `<m:oMath>${P('⩾0')}</m:oMath>`;
    const html = '<html xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><head>'
      + '<style>p.MsoNormal{margin:0}</style></head><body>'
      + '<p class=MsoNormal><span>3.2 基本不等式 </span>'
      + `<!--[if gte msEquation 12]>${oMath}<![endif]-->`
      + '<span> (a, b </span>'
      + `<!--[if gte msEquation 12]>${oMath2}<![endif]-->`
      + '<span>) 55</span></p></body></html>';

    // 模拟剪贴板：item.getType('text/html') 返回上面这份 HTML
    const clip = { read: vi.fn(async () => [{ types: ['text/plain', 'text/html'], getType: async () => ({ text: async () => html }) }]) };
    Object.defineProperty(navigator, 'clipboard', { value: clip, configurable: true });

    const text = await readTocTextFromClipboard();
    expect(text).toBe('3.2 基本不等式 $\\sqrt{ab}\\leqslant\\frac{a+b}{2}$ (a, b $\\geqslant 0$) 55');
    expect(text, '不得残留 OMML 标签').not.toMatch(/oMath/i);

    // 交给目录解析器：公式必须**原样**留在标题里（$…$ 不能被洗掉）
    const { parseClipboardText } = useTocParser();
    const r = parseClipboardText(text, 200);
    expect(r.success).toBe(true);
    expect(r.flatList[0].title).toBe('3.2 基本不等式 $\\sqrt{ab}\\leqslant\\frac{a+b}{2}$ (a, b $\\geqslant 0$)');
    expect(r.flatList[0].page).toBe(55);
  });

  it('剪贴板富文本里没有公式 → 回退纯文本（行为与改动前一致，不冒险换源）', async () => {
    const clip = {
      read: vi.fn(async () => [{ types: ['text/html'], getType: async () => ({ text: async () => '<p>第1章 集合 2</p>' }) }]),
      readText: async () => '第1章 集合 2',
    };
    Object.defineProperty(navigator, 'clipboard', { value: clip, configurable: true });
    expect(await readTocTextFromClipboard()).toBe('第1章 集合 2');
  });

  it('🔴 公式解析失败时不用 HTML 派生文本（宁缺勿错：绝不因公式毁掉整份目录）', async () => {
    const broken = '<p>3.1 不等式 51</p><m:oMath><m:f><m:num>x</m:num></m:oMath><p>3.3 二次不等式 63</p>';
    const clip = { read: vi.fn(async () => [{ types: ['text/html'], getType: async () => ({ text: async () => broken }) }]) };
    Object.defineProperty(navigator, 'clipboard', { value: clip, configurable: true });
    expect(await readTocTextFromClipboard()).toBe('');
  });

  it('剪贴板 API 不可用/被拒 → 返回空串且不抛（回退纯文本）', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { read: vi.fn(async () => { throw new Error('NotAllowedError'); }) },
      configurable: true,
    });
    expect(await readTocTextFromClipboard()).toBe('');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
