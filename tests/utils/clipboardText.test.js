import { describe, it, expect, vi, afterEach } from 'vitest';
import { htmlToPlainLines, readTocTextFromClipboard, handleMathPaste, diagnoseClipboard } from '@/utils/clipboardText.js';
import { useTocParser } from '@/composables/useTocParser.js';

/**
 * 剪贴板 → 内部文本形态（2026-09 用户实证回归）
 * ------------------------------------------------------------
 * 用户场景一：上传教材 → 确认目录结构 →「📋 从剪贴板导入」，
 *            目录里 `√(ab) ⩽ (a+b)/2` 只剩字母（`ab a+b 2`）。
 * 用户场景二：教材原文粘进纯文本框，同样只剩字母。
 * 同一个根因：拿的是剪贴板的**纯文本**版本；```text/html`` 那份里带着 OMML，此前没用上。
 */

const R = (t) => `<m:r><m:rPr/><m:t>${t}</m:t></m:r>`;
const P = (t) => `<m:r><m:rPr><m:nor/><m:sty m:val="p"/></m:rPr><m:t>${t}</m:t></m:r>`;
/** 与 Word 真实剪贴板同形：公式 OMML 塞在 MSO 条件注释里 */
const OMML_SQRT_FRAC = '<m:oMath>'
  + `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${R('ab')}</m:e></m:rad>`
  + `${P('⩽')}`
  + `<m:f><m:fPr/><m:num>${R('a+b')}</m:num><m:den>${P('2')}</m:den></m:f>`
  + '</m:oMath>';

describe('htmlToPlainLines：HTML → 文本', () => {
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

  it('🔴 跳过 <style>/<script>/<xml>：Word 剪贴板 HTML 里全是这类噪声，不能混进正文', () => {
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

  it('keepParagraphBreaks：正文模式保留段落空行（紧凑模式会把段间空行吃掉）', () => {
    const html = '<p>定义：若 a，b 为正数</p><p>则其算术平均数不小于几何平均数。</p>';
    expect(htmlToPlainLines(html)).toBe('定义：若 a，b 为正数\n则其算术平均数不小于几何平均数。');
    expect(htmlToPlainLines(html, { keepParagraphBreaks: true }))
      .toBe('定义：若 a，b 为正数\n\n则其算术平均数不小于几何平均数。');
  });
});

describe('🔴 端到端：从剪贴板导入目录，公式保住 $…$', () => {
  const html = '<html xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><head>'
    + '<style>p.MsoNormal{margin:0}</style></head><body>'
    + '<p class=MsoNormal><span>3.2 基本不等式 </span>'
    + `<!--[if gte msEquation 12]>${OMML_SQRT_FRAC}<![endif]-->`
    + '<span> (a, b </span>'
    + `<!--[if gte msEquation 12]><m:oMath>${P('⩾0')}</m:oMath><![endif]-->`
    + '<span>) 55</span></p></body></html>';

  const stubClipboard = (spec) => Object.defineProperty(navigator, 'clipboard', { value: spec, configurable: true });

  it('目录标题完整还原，且不残留任何 OMML 碎片', async () => {
    stubClipboard({
      read: async () => [{ types: ['text/plain', 'text/html'], getType: async () => ({ text: async () => html }) }],
      readText: async () => '3.2 基本不等式 ab a+b 2 (a, b 0) 55',
    });
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

  it('剪贴板里没有公式 → 回退纯文本（行为与改动前一致，不冒险换源）', async () => {
    stubClipboard({
      read: async () => [{ types: ['text/html'], getType: async () => ({ text: async () => '<p>第1章 集合 2</p>' }) }],
      readText: async () => '第1章 集合 2',
    });
    expect(await readTocTextFromClipboard()).toBe('第1章 集合 2');
  });

  it('🔴 公式解析失败时不用 HTML 派生文本（宁缺勿错：绝不因公式毁掉整份目录）', async () => {
    stubClipboard({
      read: async () => [{ types: ['text/html'], getType: async () => ({ text: async () => '<p>3.1 不等式 51</p><m:oMath><m:f><m:num>x</m:num></m:oMath>' }) }],
      readText: async () => '3.1 不等式 51',
    });
    expect(await readTocTextFromClipboard()).toBe('3.1 不等式 51');
  });

  it('剪贴板 API 不可用/被拒 → 不抛，回退到没有内容', async () => {
    stubClipboard({ read: async () => { throw new Error('NotAllowedError'); } });
    expect(await readTocTextFromClipboard()).toBe('');
  });
});

describe('🔴 handleMathPaste：纯文本框粘贴保住公式', () => {
  const makeEvent = (el, html) => ({
    target: el,
    clipboardData: { getData: (type) => (type === 'text/html' ? html : '') },
    preventDefault: vi.fn(),
  });
  const newTextarea = (value = '') => {
    const el = document.createElement('textarea');
    el.value = value;
    document.body.appendChild(el);
    return el;
  };

  afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

  it('剪贴板带公式 → 接管粘贴，插入的是 $…$ 文本（而不是被线性化的裸字符）', () => {
    const el = newTextarea('3.2 基本不等式 ');
    const e = makeEvent(el, `<p>3.2 基本不等式 ${OMML_SQRT_FRAC}</p>`);
    expect(handleMathPaste(e)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(el.value).toContain('$\\sqrt{ab}\\leqslant\\frac{a+b}{2}$');
    expect(el.value).not.toMatch(/oMath/);
  });

  it('🔴 插入后必须派发 input 事件（否则 v-model 不同步，界面上看不到）', () => {
    const el = newTextarea('');
    const onInput = vi.fn();
    el.addEventListener('input', onInput);
    handleMathPaste(makeEvent(el, `<p>${OMML_SQRT_FRAC}</p>`));
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('没有公式 → 不接管（走浏览器默认粘贴，行为不变）', () => {
    const el = newTextarea('');
    const e = makeEvent(el, '<p>第1章 集合 2</p>');
    expect(handleMathPaste(e)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('公式解析失败 / 剪贴板没有 HTML → 不接管（绝不因公式让普通粘贴失效）', () => {
    const el = newTextarea('');
    const broken = makeEvent(el, '<p>前文</p><m:oMath><m:f><m:num>x</m:num></m:oMath>');
    expect(handleMathPaste(broken)).toBe(false);
    expect(handleMathPaste(makeEvent(el, ''))).toBe(false);
    expect(handleMathPaste({ target: el, clipboardData: null })).toBe(false);
  });

  it('在光标处插入、并在选区上替换（不是无脑追加到末尾）', () => {
    const el = newTextarea('AB');
    el.setSelectionRange(1, 1); // 光标在 A 与 B 之间
    handleMathPaste(makeEvent(el, `<p>${OMML_SQRT_FRAC}</p>`));
    expect(el.value.startsWith('A$\\sqrt{ab}')).toBe(true);
    expect(el.value.endsWith('B')).toBe(true);
  });
});

describe('🔍 diagnoseClipboard：把"公式为什么没进来"一次说清', () => {
  const stubClipboard = (spec) => Object.defineProperty(navigator, 'clipboard', { value: spec, configurable: true });
  afterEach(() => { delete window.electronAPI; });

  it('剪贴板只有纯文本 → 明确说"没有富文本那份"，并指向「从文件导入」', async () => {
    stubClipboard({ read: async () => [{ types: ['text/plain'], getType: async () => ({ text: async () => 'ab a+b 2' }) }], readText: async () => 'ab a+b 2' });
    const report = await diagnoseClipboard();
    expect(report).toContain('没有富文本');
    expect(report, '必须给出可执行的下一步').toContain('从文件导入');
  });

  it('剪贴板有富文本但没公式结构 → 说明"公式可能是图片"', async () => {
    stubClipboard({
      read: async () => [{ types: ['text/html'], getType: async () => ({ text: async () => '<p>第1章 集合 2</p>' }) }],
      readText: async () => '第1章 集合 2',
    });
    const report = await diagnoseClipboard();
    expect(report).toContain('没有找到公式结构');
    expect(report, '要说明这是源头问题，不是本程序能补的').toContain('源头就没给');
    expect(report).toContain('从文件导入');
  });

  it('公式已还原 → 说明"$ 源码是正常的，展示处会渲染"', async () => {
    stubClipboard({
      read: async () => [{ types: ['text/html'], getType: async () => ({ text: async () => `<p>${OMML_SQRT_FRAC}</p>` }) }],
      readText: async () => 'ab a+b 2',
    });
    const report = await diagnoseClipboard();
    expect(report).toContain('已还原为 LaTeX');
    expect(report).toContain('印刷形态');
  });
});
