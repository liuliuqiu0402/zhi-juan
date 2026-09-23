/**
 * 编辑器内公式实时渲染（装饰层）回归锁
 * ============================================================
 * 🔴 本轮新增能力（2026-09）：编辑器里公式一直显示 `$…$` 源码——前面链路都修好了，
 *    但用户在编辑器这个每天打交道的界面看不到效果。改用 ProseMirror **装饰**实现：
 *    只改视图、**不改文档**（文档里仍是 `$…$` 纯文本），故下游链路零改动。
 *
 * 实现为「inline 隐藏源码 + widget 渲染」：prosemirror-view 1.41 已移除 `Decoration.replace`，
 * 且该组合更稳 —— 源码文本仍留在真实 DOM 里。由此带来三个必须锁住的风险：
 *   ① 装饰区间必须精确（用 raw 长度而非 trim 后的 latex）
 *   ② 光标在公式内时必须撤掉装饰（否则无法编辑）
 *   ③ 内容读取边界必须还原（否则导出/预览要么藏起公式、要么重复显示）
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Schema } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { Packer, Document, Paragraph } from 'docx';
import {
  findMathRanges,
  collectDecorations,
  restoreMathPreviewSource,
  buildMathPreviewDom,
  MATH_SRC_CLASS,
} from '@/utils/mathPreview.js';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';

// 最小 schema：doc / paragraph / text（装饰计算只需文本能力）
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
  },
});
const makeDoc = (text) => schema.node('doc', null, [schema.node('paragraph', null, schema.text(text))]);

/** 取某类装饰（inline / widget） */
const pick = (decos, kind) => decos.filter((d) => d.spec && d.spec.kind === kind);

/** 造"已渲染"的 HTML 片段（与视图 DOM 同构：隐藏源码 span + widget） */
const decoratedHtml = (latex, display, from = 3, to = 6) => `<p><span class="${MATH_SRC_CLASS}">`
  + `${display ? `$$${latex}$$` : `$${latex}$`}</span>${buildMathPreviewDom(latex, display).outerHTML}`
  + ' 的圆</p>';

describe('findMathRanges：公式字符区间必须精确', () => {
  it('行内公式区间 = raw 长度（含定界符）', () => {
    const t = '圆的面积 $S=\\pi r^{2}$ 公式';
    const [r] = findMathRanges(t);
    expect(t.slice(r.from, r.to)).toBe('$S=\\pi r^{2}$');
    expect(r.latex).toBe('S=\\pi r^{2}');
    expect(r.display).toBe(false);
  });

  it('🔴 块级公式内部带空白时区间仍精确（latex 已 trim，不能拿它的长度算）', () => {
    const t = '$$ x = 1 $$ 结尾';
    const [r] = findMathRanges(t);
    expect(t.slice(r.from, r.to)).toBe('$$ x = 1 $$');
    expect(r.latex).toBe('x = 1');
    expect(r.display).toBe(true);
  });

  it('多个公式与纯文本混排，区间逐个正确', () => {
    const t = '由 $a$ 与 $b$ 得 $$c=d$$';
    const rs = findMathRanges(t);
    expect(rs.length).toBe(3);
    for (const r of rs) expect(t.slice(r.from, r.to).startsWith('$')).toBe(true);
    expect(rs.map((r) => r.display)).toEqual([false, false, true]);
  });

  it('无公式文本返回空数组', () => {
    expect(findMathRanges('普通一句话')).toEqual([]);
    expect(findMathRanges('')).toEqual([]);
  });
});

describe('collectDecorations：装饰成对出现，且编辑时不抢源码', () => {
  it('每个公式得到一对装饰：隐藏源码 + 渲染 widget', () => {
    const doc = makeDoc('半径 $r$ 的圆');
    const decos = collectDecorations(doc, TextSelection.create(doc, 1)); // 光标在公式之外
    expect(decos.length).toBe(2);
    const [inlineDeco] = pick(decos, 'inline');
    const [widgetDeco] = pick(decos, 'widget');
    expect(inlineDeco).toBeTruthy();
    expect(widgetDeco).toBeTruthy();
    expect(doc.textBetween(inlineDeco.from, inlineDeco.to)).toBe('$r$');
    expect(widgetDeco.spec.math.latex).toBe('r');
    expect(widgetDeco.spec.math.display).toBe(false);
  });

  it('🔴 光标落在公式内 → 完全撤掉装饰（露出源码可编辑）', () => {
    const text = '半径 $r$ 的圆';
    const doc = makeDoc(text);
    const inside = text.indexOf('$') + 2; // 段落偏移 + 区间内部
    expect(collectDecorations(doc, TextSelection.create(doc, inside)).length).toBe(0);
  });

  it('光标紧邻公式之外（区间边界外）→ 仍装饰', () => {
    const text = '半径 $r$ 的圆';
    const doc = makeDoc(text);
    const before = text.indexOf('$'); // = 段落偏移 1 之前的最后一个字符位置
    expect(pick(collectDecorations(doc, TextSelection.create(doc, before)), 'widget').length).toBe(1);
  });

  it('选区与公式相交 → 同样撤掉装饰', () => {
    const text = '半径 $r$ 的圆';
    const doc = makeDoc(text);
    // 文本索引 → 文档位置要加段落起始偏移（段落内容自 pos 1 起）
    const from = text.indexOf('$') + 1;
    expect(collectDecorations(doc, TextSelection.create(doc, from, from + 1)).length).toBe(0);
  });

  it('块级公式的 widget 标记 display', () => {
    const doc = makeDoc('$$x=1$$');
    const [w] = pick(collectDecorations(doc, TextSelection.create(doc, 1)), 'widget');
    expect(w.spec.math.display).toBe(true);
  });

  it('文档里没有公式 → 无装饰（零开销）', () => {
    expect(collectDecorations(makeDoc('这是一段普通文字。'), TextSelection.create(makeDoc('x'), 1))).toEqual([]);
  });
});

describe('restoreMathPreviewSource：内容读取边界必须还原成"从未渲染过"的形态', () => {
  it('行内：移除 widget 且拆掉隐藏 span → 只剩 $…$ 源码', () => {
    const out = restoreMathPreviewSource(decoratedHtml('r', false));
    expect(out).toContain('$r$');
    expect(out, '不得残留 widget').not.toContain('data-math-preview');
    expect(out, 'KaTeX 片段必须一并消失').not.toContain('katex');
    expect(out, '🔴 隐藏 span 必须拆掉：否则 .zwg-math-src{display:none} 会把公式藏起来')
      .not.toContain(MATH_SRC_CLASS);
    expect(out).toContain('的圆');
  });

  it('块级同样还原为 $$…$$', () => {
    const out = restoreMathPreviewSource(decoratedHtml('\\frac{a}{b}', true));
    expect(out).toContain('$$\\frac{a}{b}$$');
    expect(out).not.toContain('data-math-preview');
    expect(out).not.toContain(MATH_SRC_CLASS);
  });

  it('无 widget 时原样返回（零开销）', () => {
    const html = '<p>普通段落 $x$ 保留</p>';
    expect(restoreMathPreviewSource(html)).toBe(html);
    expect(restoreMathPreviewSource('')).toBe('');
  });

  it('幂等：还原后再还原不变', () => {
    const once = restoreMathPreviewSource(decoratedHtml('r', false));
    expect(restoreMathPreviewSource(once)).toBe(once);
  });

  it('还原结果与"从未渲染过"的 HTML 等价（下游拿到的东西完全一样）', () => {
    const restored = restoreMathPreviewSource(decoratedHtml('r', false));
    expect(restored).toContain('$r$');
    expect(restored).toContain('的圆');
    // 与非装饰版对比：文本内容一致
    const plain = '<p>$r$ 的圆</p>';
    const textOf = (h) => {
      const d = document.createElement('div');
      d.innerHTML = h;
      return d.textContent.replace(/\s+/g, '');
    };
    expect(textOf(restored)).toBe(textOf(plain));
  });
});

describe('docxBuilder 兜底：漏了还原也不会重复、不会乱码', () => {
  const xmlOf = async (html) => {
    const c = document.createElement('div');
    c.style.fontSize = '16px';
    c.innerHTML = html;
    document.body.appendChild(c);
    const doc = buildDocxFromDom(c, 'middle');
    c.remove();
    const zip = await JSZip.loadAsync(await injectDrawingML(await Packer.toBuffer(doc)));
    return zip.file('word/document.xml').async('string');
  };

  it('🔴 未还原（隐藏源码 + widget 并存）→ 公式只出一次', async () => {
    const xml = await xmlOf(decoratedHtml('\\frac{a}{b}', false));
    expect(xml, '必须出真公式').toContain('<m:f');
    expect(xml).toContain('的圆');
    // 只应有一个公式对象（源码 span 被跳过，只有 widget 出公式）
    expect((xml.match(/<m:oMath>/g) || []).length).toBe(1);
  });

  it('已还原的 HTML 走同一条链路，结果一致', async () => {
    const xml = await xmlOf(restoreMathPreviewSource(decoratedHtml('\\frac{a}{b}', false)));
    expect(xml).toContain('<m:f');
    expect((xml.match(/<m:oMath>/g) || []).length).toBe(1);
  });

  it('widget 的不支持构造 → 可读文本兜底（不泄漏命令名、不重复）', async () => {
    const xml = await xmlOf(decoratedHtml('\\boxed{x}', false));
    expect(xml).not.toContain('boxed');
    expect(xml).toContain('的圆');
  });

  it('编辑器装饰不改变文档：还原前后正文一字不差', async () => {
    const a = await xmlOf(restoreMathPreviewSource(decoratedHtml('r', false)));
    const b = await xmlOf('<p>$r$ 的圆</p>');
    expect(a).toBe(b);
  });
});
