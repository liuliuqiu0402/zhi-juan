/**
 * Word 导出公式回归锁（P5）
 * ============================================================
 * 🔴 本轮修的缺陷（2026-09 用户实证）：Word 导出对公式的处理只在"整个文本节点恰好是 $...$"的
 *    **元素分支**命中——真实语句（「半径为 $r$ 的圆」）永不命中，命中时也只是剥掉 $ 涂成**深蓝斜体**。
 *    于是 Word 交付物里 `\frac{a}{b}` 原样泄漏成乱码，既非公式也非印刷样式。
 *    现改为：文本节点内按 $…$ 分段 → 能确定性表达的出**真 Word 公式对象（OMML）**，
 *    否则降级为可读 Unicode 文本。两条路都不得泄漏 `$` 或 `\frac`。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

// 与真实导出链路一致（jsdom Blob 缺 arrayBuffer，故手动串联）
const getDocumentXml = async (html, stage) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container, stage || 'middle');
  container.remove();
  const processed = await injectDrawingML(await Packer.toBuffer(doc));
  const zip = await JSZip.loadAsync(processed);
  return zip.file('word/document.xml').async('string');
};

describe('Word 导出：公式落成真公式对象（OMML）', () => {
  it('🔴 行内公式夹在正文中间也能还原（旧实现连命中都做不到）', async () => {
    const xml = await getDocumentXml('<p>半径为 $r$ 的圆，面积为 $\\pi r^{2}$。</p>');
    expect(xml, '必须产出 OMML 公式').toContain('<m:oMath');
    expect(xml, '上下标结构').toContain('<m:sSup');
    expect(xml, '正文字必须保留').toContain('半径为');
    expect(xml).toContain('的圆');
    expect(xml, '不得泄漏 LaTeX').not.toContain('\\pi');
    expect(xml, '不得泄漏定界符').not.toContain('$r$');
  });

  it('分式（\\frac）落成 m:f 结构，不再原样泄漏', async () => {
    const xml = await getDocumentXml('<p>速度 $v=\\frac{s}{t}$ 由路程与时间决定。</p>');
    expect(xml).toContain('<m:f');
    expect(xml).toContain('<m:num');
    expect(xml).toContain('<m:den');
    expect(xml).not.toContain('\\frac');
  });

  it('块级 $$…$$ 同样还原', async () => {
    const xml = await getDocumentXml('<p>$$S_n=\\frac{n(a_1+a_n)}{2}$$</p>');
    expect(xml).toContain('<m:oMath');
    expect(xml).toContain('<m:f');
    expect(xml).not.toContain('$$');
  });

  it('同一段多个公式各自独立成公式对象', async () => {
    const xml = await getDocumentXml('<p>$a$ 与 $b$ 满足 $a+b=1$。</p>');
    expect((xml.match(/<m:oMath/g) || []).length).toBe(3);
  });

  it('🔴 矢量在 Word 里落成真重音（m:acc），不再是文字近似', async () => {
    // 此前 \vec 属"确实不支持"，降级为可读 Unicode；自建 OMML 组件（ommlExtras）补齐后出真重音
    const xml = await getDocumentXml('<p>力 $\\vec{F}$ 的方向。</p>');
    expect(xml).toContain('<m:acc>');
    expect(xml).toContain('<m:chr m:val="⃗"');
    expect(xml, '不得泄漏 LaTeX 命令名').not.toContain('\\vec');
    expect(xml).not.toContain('$');
    expect(xml, '正文不受影响').toContain('的方向');
  });

  it('转义 \\$ 还原为字面美元号（价格场景，不当公式定界符）', async () => {
    const xml = await getDocumentXml('<p>单价 \\$5 元。</p>');
    expect(xml).toContain('$5');
    expect(xml, '不得产出公式').not.toContain('<m:oMath');
  });

  it('🔴 化学式下标在 Word 里完整保留（\\mathrm{H_{2}O} 不得塌成 HO）', async () => {
    const xml = await getDocumentXml('<p>生成 $\\mathrm{2H_{2}O}$ 的反应。</p>');
    expect(xml, '下标必须保留').toContain('<m:sSub');
    for (const t of ['<m:t>2</m:t>', '<m:t>H</m:t>', '<m:t>O</m:t>']) {
      expect(xml, `缺少 ${t}`).toContain(t);
    }
    expect(xml).not.toContain('\\mathrm');
  });

  it('无公式的普通段落不受影响（不产生任何公式结构）', async () => {
    const xml = await getDocumentXml('<p>这是一段没有公式的普通文字。</p>');
    expect(xml).not.toContain('<m:oMath');
    expect(xml).toContain('没有公式');
  });
});

describe('Word 导出：块级公式出展示式（独占居中一行）', () => {
  it('🔴 整段就是一个 $$…$$ → m:oMathPara 且居中（不再是行内公式）', async () => {
    // 此前 $$…$$ 落成行内 m:oMath，会挤在文字流里 —— 与教材展示式排版不符
    const xml = await getDocumentXml('<p>$$x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}$$</p>');
    expect(xml).toContain('<m:oMathPara>');
    expect(xml).toContain('<m:oMathParaPr>');
    expect(xml).toContain('<m:jc m:val="center"');
    expect(xml).toContain('<m:oMath>');   // oMathPara 内部仍是真公式
    expect(xml).toContain('<m:f');        // 公式本体没被弄坏
    expect(xml, '不得泄漏定界符').not.toContain('$$');
  });

  it('行内公式仍是行内（不升格成展示式）', async () => {
    const xml = await getDocumentXml('<p>由 $a=b$ 可得结论</p>');
    expect(xml).not.toContain('<m:oMathPara');
    expect(xml).toContain('<m:oMath>');
  });

  it('公式与文字混排时不升格（保持行内，不破坏文字流）', async () => {
    const xml = await getDocumentXml('<p>由 $a=b$ 可得 $$x=1$$ 成立</p>');
    expect(xml).not.toContain('<m:oMathPara');
    expect(xml).toContain('可得');
    expect(xml).toContain('成立');
  });

  it('多个展示式段落各自成展示式，正文段落不受影响', async () => {
    const xml = await getDocumentXml('<p>$$x=1$$</p><p>正文一句。</p><p>$$y=2$$</p>');
    expect((xml.match(/<m:oMathPara>/g) || []).length).toBe(2);
    expect(xml).toContain('正文一句');
  });

  it('展示式段落仍保留段前段后间距', async () => {
    const xml = await getDocumentXml('<p>$$x=1$$</p>');
    expect(xml).toContain('<w:spacing');
  });
});
