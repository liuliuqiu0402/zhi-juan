/**
 * 粘贴公式还原（OMML / MathML → LaTeX）回归锁
 * ============================================================
 * 🔴 本轮修的缺陷（2026-09 用户实证）：教材公式粘贴进编辑器后"印刷样式全没了"。
 *    Word 剪贴板给 OMML（藏在 MSO 条件注释里）、网页/LibreOffice 给 MathML，
 *    编辑器对两者毫无处理 → ProseMirror 剥掉未知标签，只留散字（分式塌一行、上下标错位）。
 *
 * 测试样本说明：OMML/MathML 片段按各自规范手工构造（Word 不在本机，无法取真实剪贴板字节），
 *   结构与命名空间遵循 Office Math 与 MathML Core 规范；这是可确定的输入契约。
 * ============================================================
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ommlToLatex, parseOmml } from '@/utils/ommlToLatex.js';
import { mathmlToLatex } from '@/utils/mathmlToLatex.js';
import { convertPastedMathInHtml, hasPastedMath, readClipboardRich } from '@/utils/pastedMath.js';
import { renderMathInHtml } from '@/utils/mathRender.js';

/** 把 OMML 片段包成 oMath */
const om = (inner) => `<m:oMath>${inner}</m:oMath>`;
/** 文本 run */
const r = (t) => `<m:r><m:t>${t}</m:t></m:r>`;

describe('ommlToLatex：Word 公式结构还原', () => {
  it('分式 → \\frac（原来会塌成一行 "ab"）', () => {
    expect(ommlToLatex(om(`<m:f><m:num>${r('a')}</m:num><m:den>${r('b')}</m:den></m:f>`))).toBe('\\frac{a}{b}');
  });

  it('上下标：sSup / sSub / sSubSup', () => {
    expect(ommlToLatex(om(`<m:sSup><m:e>${r('x')}</m:e><m:sup>${r('2')}</m:sup></m:sSup>`))).toBe('x^{2}');
    expect(ommlToLatex(om(`<m:sSub><m:e>${r('H')}</m:e><m:sub>${r('2')}</m:sub></m:sSub>`))).toBe('H_{2}');
    expect(ommlToLatex(om(`<m:sSubSup><m:e>${r('x')}</m:e><m:sub>${r('i')}</m:sub><m:sup>${r('2')}</m:sup></m:sSubSup>`))).toBe('x_{i}^{2}');
  });

  it('根式：无次数 → \\sqrt；带次数 → \\sqrt[n]{}', () => {
    expect(ommlToLatex(om(`<m:rad><m:deg/><m:e>${r('2')}</m:e></m:rad>`))).toBe('\\sqrt{2}');
    expect(ommlToLatex(om(`<m:rad><m:deg>${r('3')}</m:deg><m:e>${r('8')}</m:e></m:rad>`))).toBe('\\sqrt[3]{8}');
  });

  it('括号定界：按 begChr/endChr 出 \\left…\\right', () => {
    const d = `<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr><m:e>${r('x')}</m:e></m:d>`;
    expect(ommlToLatex(om(d))).toBe('\\left(x\\right)');
    const bracket = `<m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/></m:dPr><m:e>${r('y')}</m:e></m:d>`;
    expect(ommlToLatex(om(bracket))).toBe('\\left[y\\right]');
  });

  it('n 元算子：∑ 带上下限', () => {
    const nary = `<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>${r('i=1')}</m:sub><m:sup>${r('n')}</m:sup><m:e>${r('i')}</m:e></m:nary>`;
    expect(ommlToLatex(om(nary))).toBe('\\sum_{i=1}^{n} i');
  });

  it('函数：sin/cos 走符号命令，未知名走 \\operatorname', () => {
    expect(ommlToLatex(om(`<m:func><m:fName>${r('sin')}</m:fName><m:e>${r('x')}</m:e></m:func>`))).toBe('\\sin{x}');
    expect(ommlToLatex(om(`<m:func><m:fName>${r('f')}</m:fName><m:e>${r('x')}</m:e></m:func>`))).toBe('\\operatorname{f}{x}');
  });

  it('极限 limLow（lim 带下标）', () => {
    // 真实 OMML 里箭头是 Unicode 字符（不是 LaTeX 的 \to），转换器负责映射
    const lim = `<m:limLow><m:e>${r('lim')}</m:e><m:lim>${r('x→0')}</m:lim></m:limLow>`;
    expect(ommlToLatex(om(lim))).toBe('\\lim_{x\\rightarrow 0}');
  });

  it('重音与上划线', () => {
    expect(ommlToLatex(om(`<m:acc><m:accPr><m:chr m:val="⃗"/></m:accPr><m:e>${r('F')}</m:e></m:acc>`))).toBe('\\vec{F}');
    expect(ommlToLatex(om(`<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${r('AB')}</m:e></m:bar>`))).toBe('\\overline{AB}');
  });

  it('矩阵：m:m / m:mr / m:e', () => {
    const m = `<m:m><m:mr><m:e>${r('a')}</m:e><m:e>${r('b')}</m:e></m:mr><m:mr><m:e>${r('c')}</m:e><m:e>${r('d')}</m:e></m:mr></m:m>`;
    expect(ommlToLatex(om(m))).toBe('\\begin{matrix}a & b \\\\ c & d\\end{matrix}');
  });

  it('中文 run → \\text{}（化学方程式的反应条件）', () => {
    expect(ommlToLatex(om(r('点燃')))).toBe('\\text{点燃}');
  });

  it('Unicode 运算符映射（− ⋅ × ⇒ ⇌）', () => {
    expect(ommlToLatex(om(r('a−b')))).toBe('a-b');
    expect(ommlToLatex(om(r('a×b')))).toBe('a\\times b');
    expect(ommlToLatex(om(r('a⇌b')))).toBe('a\\rightleftharpoons b');
  });

  it('控制/属性元素不产生可见内容（ctrlPr / rPr）', () => {
    const withCtrl = om(`<m:f><m:fPr><m:ctrlPr/></m:fPr><m:num>${r('1')}</m:num><m:den>${r('2')}</m:den></m:f>`);
    expect(ommlToLatex(withCtrl)).toBe('\\frac{1}{2}');
  });

  it('未知元素透明递归：保内容不丢字', () => {
    expect(ommlToLatex(om(`<m:unknownElem>${r('keep')}</m:unknownElem>`))).toBe('keep');
  });

  it('解析失败 → null（调用方保留原文，绝不因公式毁掉整段粘贴）', () => {
    expect(ommlToLatex('<m:oMath><m:f><m:num>x</m:num></m:oMath>')).toBe(null); // 标签未闭合
    expect(ommlToLatex('')).toBe(null);
    expect(ommlToLatex('not xml <<<')).toBe(null);
    expect(parseOmml('<m:oMath></m:oMath>')).not.toBe(null);
  });
});

describe('mathmlToLatex：网页 / LibreOffice 公式还原', () => {
  it('分式 / 上下标 / 根式', () => {
    expect(mathmlToLatex('<math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>')).toBe('\\frac{a}{b}');
    expect(mathmlToLatex('<math><msup><mi>x</mi><mn>2</mn></msup></math>')).toBe('x^{2}');
    expect(mathmlToLatex('<math><msub><mi>H</mi><mn>2</mn></msub></math>')).toBe('H_{2}');
    expect(mathmlToLatex('<math><msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup></math>')).toBe('x_{i}^{2}');
    expect(mathmlToLatex('<math><msqrt><mi>x</mi><mo>+</mo><mn>1</mn></msqrt></math>')).toBe('\\sqrt{x+1}');
    expect(mathmlToLatex('<math><mroot><mn>8</mn><mn>3</mn></mroot></math>')).toBe('\\sqrt[3]{8}');
  });

  it('mrow 透明（常见包裹层不影响结构）', () => {
    expect(mathmlToLatex('<math><mrow><mfrac><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mn>2</mn></mfrac></mrow></math>'))
      .toBe('\\frac{a+b}{2}');
  });

  it('mfenced：默认圆括号 + 逗号分隔（不用 \\middle）', () => {
    expect(mathmlToLatex('<math><mfenced><mi>a</mi><mi>b</mi></mfenced></math>')).toBe('\\left(a,b\\right)');
    expect(mathmlToLatex('<math><mfenced open="[" close="]"><mi>x</mi></mfenced></math>')).toBe('\\left[x\\right]');
  });

  it('mtable → matrix', () => {
    const t = '<math><mtable><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr><mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr></mtable></math>';
    expect(mathmlToLatex(t)).toBe('\\begin{matrix}a & b \\\\ c & d\\end{matrix}');
  });

  it('mover 箭头 → \\vec；多字符 mi → \\mathrm；mtext 中文 → \\text', () => {
    expect(mathmlToLatex('<math><mover><mi>F</mi><mo>→</mo></mover></math>')).toBe('\\vec{F}');
    expect(mathmlToLatex('<math><mi>sin</mi></math>')).toBe('\\mathrm{sin}');
    expect(mathmlToLatex('<math><mtext>点燃</mtext></math>')).toBe('\\text{点燃}');
  });

  it('带命名空间前缀也能识别（mml:math）', () => {
    const prefixed = '<mml:math xmlns:mml="http://www.w3.org/1998/Math/MathML"><mml:mfrac><mml:mi>a</mml:mi><mml:mi>b</mml:mi></mml:mfrac></mml:math>';
    expect(mathmlToLatex(prefixed)).toBe('\\frac{a}{b}');
  });

  it('无法解析 → null', () => {
    expect(mathmlToLatex('')).toBe(null);
    expect(mathmlToLatex('<math><mfrac>')).toBe(null);
  });
});

describe('convertPastedMathInHtml：粘贴链路端到端', () => {
  const frac = `<m:f><m:num>${r('a')}</m:num><m:den>${r('b')}</m:den></m:f>`;

  it('🔴 Word 条件注释包裹的 OMML → $…$（注释壳必须先解开，否则结果落在注释里不可见）', () => {
    const html = `<!--[if gte mso 9]>${om(frac)}<![endif]-->`;
    const out = convertPastedMathInHtml(html);
    expect(out).toBe('$\\frac{a}{b}$');
    expect(out, '不得残留注释壳').not.toContain('<!--');
  });

  it('裸 OMML（无注释壳）同样还原', () => {
    expect(convertPastedMathInHtml(`<p>半径 ${om(r('r'))} 的圆</p>`)).toBe('<p>半径 $r$ 的圆</p>');
  });

  it('oMathPara（块级）→ $$…$$，且优先于行内规则', () => {
    const html = `<m:oMathPara>${om(frac)}</m:oMathPara>`;
    expect(convertPastedMathInHtml(html)).toBe('$$\\frac{a}{b}$$');
  });

  it('MathML → $…$', () => {
    expect(convertPastedMathInHtml('<p>面积 <math><msup><mi>r</mi><mn>2</mn></msup></math> 平方</p>'))
      .toBe('<p>面积 $r^{2}$ 平方</p>');
  });

  it('🔴 解析失败时保留原文（绝不因公式毁掉整段粘贴）', () => {
    const broken = `<p>前文</p>${om('<m:f><m:num>x</m:num>')}<p>后文</p>`;
    const out = convertPastedMathInHtml(broken);
    expect(out).toBe(broken);
    expect(out).toContain('前文');
    expect(out).toContain('后文');
  });

  it('无公式内容原样返回（快速通道，零开销）', () => {
    const plain = '<p>普通一段话，没有公式。</p>';
    expect(convertPastedMathInHtml(plain)).toBe(plain);
    expect(hasPastedMath(plain)).toBe(false);
  });

  it('不含 OMML 的条件注释保持原样（不无差别删注释）', () => {
    const other = '<!--[if gte mso 9]><style>p{margin:0}</style><![endif]-->';
    expect(convertPastedMathInHtml(other)).toBe(other);
  });

  it('🔴 不删除任何图片（Word 兜底图无法与真插图区分，误删即静默丢料）', () => {
    const html = `<!--[if gte mso 9]>${om(frac)}<![endif]--><img src="file:///C:/Temp/msohtmlclip1/clip_image001.png">`;
    const out = convertPastedMathInHtml(html);
    expect(out).toContain('$\\frac{a}{b}$');
    expect(out, '图片必须保留').toContain('<img src="file:///C:/Temp/msohtmlclip1/clip_image001.png">');
  });

  it('🔴 还原结果能被渲染端直接渲染成印刷形态（与生成端公式同源，不出现两套表示）', () => {
    const out = convertPastedMathInHtml(`<p>${om(frac)}</p>`);
    const rendered = renderMathInHtml(out);
    expect(rendered).toContain('mfrac');            // 叠排分式
    expect(rendered).not.toContain('$\\frac');      // 不复留未渲染的 LaTeX
  });

  it('⩽ / ⩾（教材印刷体不等号）映射为 \\leqslant / \\geqslant，不留裸 Unicode', () => {
    expect(convertPastedMathInHtml(`<p>${om(r('a\u2a7db'))}</p>`)).toBe('<p>$a\\leqslant b$</p>');
    expect(convertPastedMathInHtml(`<p>${om(r('a\u2a7eb'))}</p>`)).toBe('<p>$a\\geqslant b$</p>');
  });
});

describe('readClipboardRich：读剪贴板 + 公式还原（唯一入口）', () => {
  const frac = `<m:f><m:num>${r('a+b')}</m:num><m:den>${r('2')}</m:den></m:f>`;

  const stubClipboard = (spec) => {
    Object.defineProperty(navigator, 'clipboard', { value: spec, configurable: true });
  };

  afterEach(() => { delete window.electronAPI; vi.restoreAllMocks(); });

  it('🔴 优先走 Electron 主进程剪贴板（渲染进程的 navigator.clipboard.read 会被权限/焦点策略拦掉）', async () => {
    const html = `<!--[if gte mso 9]>${om(frac)}<![endif]-->`;
    window.electronAPI = {
      readClipboard: vi.fn(async () => ({ formats: ['text/plain', 'text/html'], text: 'a+b2', html })),
    };
    // 渲染进程 API 一律拒绝——主进程通路必须在它之前拿到数据
    stubClipboard({
      read: async () => { throw new Error('NotAllowedError'); },
      readText: async () => '不该走到这里',
    });
    const clip = await readClipboardRich();
    expect(window.electronAPI.readClipboard).toHaveBeenCalled();
    expect(clip.html).toContain('$\\frac{a+b}{2}$');
    expect(clip.mathConverted).toBe(true);
    expect(clip.text, '主进程顺带回的纯文本也要带上（供回退）').toBe('a+b2');
  });

  it('主进程通路抛错 → 回退浏览器 API（不抛）', async () => {
    window.electronAPI = { readClipboard: async () => { throw new Error('boom'); } };
    stubClipboard({
      read: async () => [{ types: ['text/plain'], getType: async () => ({ text: async () => '第1章 集合 2' }) }],
      readText: async () => '第1章 集合 2',
    });
    expect((await readClipboardRich()).text).toBe('第1章 集合 2');
  });

  it('🔴 有 text/html 时优先用它，并把 OMML 还原成 $…$（纯文本版本拿不到公式）', async () => {
    const html = `<p>基本不等式 </p><!--[if gte mso 9]>${om(frac)}<![endif]-->`;
    stubClipboard({
      read: async () => [{
        types: ['text/plain', 'text/html'],
        getType: async (t) => ({ text: async () => (t === 'text/html' ? html : '基本不等式 a+b2') }),
      }],
      readText: async () => '基本不等式 a+b2',
    });
    const clip = await readClipboardRich();
    expect(clip.html).toContain('$\\frac{a+b}{2}$');
    expect(clip.mathConverted).toBe(true);
    expect(clip.text, '纯文本也一并带回，供调用方回退').toBe('基本不等式 a+b2');
  });

  it('无公式的富文本 → mathConverted=false（调用方据此决定"不必换源"）', async () => {
    stubClipboard({
      read: async () => [{ types: ['text/html'], getType: async () => ({ text: async () => '<p>第1章 集合 2</p>' }) }],
      readText: async () => '',
    });
    const clip = await readClipboardRich();
    expect(clip.mathConverted).toBe(false);
  });

  it('read() 被拒（权限）→ 回退 readText，且不抛', async () => {
    stubClipboard({
      read: async () => { throw new Error('NotAllowedError'); },
      readText: async () => '第1章 集合 2',
    });
    const clip = await readClipboardRich();
    expect(clip).toMatchObject({ html: '', text: '第1章 集合 2', mathConverted: false });
    expect(clip.via, '诊断用：标明是哪条通路拿到的').toBe('navigator');
  });

  it('剪贴板 API 不存在 → null', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    expect(await readClipboardRich()).toBe(null);
  });
});
