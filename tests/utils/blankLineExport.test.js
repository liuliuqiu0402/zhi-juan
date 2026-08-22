// 填空横线行尾自动延伸回归测试：blank-line 在段落末尾 → PositionalTab（<w:ptab/>）自动画到右边距
// 背景：旧实现按内部 &emsp; 数量估算宽度，AI 无法预知行宽 → 横线画到一半就断，需手动补齐；
//       Word 位置制表符（ptab alignment=right relativeTo=margin leader=underscore）可自动延伸到行尾。
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const getDocumentXml = async (html) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container);
  container.remove();
  const buf = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
};

describe('作文格（zuo-wen-ge）导出', () => {
  it('标准 span 格子结构 → 导出为格子表格', async () => {
    const xml = await getDocumentXml(
      '<div class="zuo-wen-ge"><div><span>&emsp;</span><span>&emsp;</span></div><div><span>&emsp;</span><span>&emsp;</span></div></div>'
    );
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tc>'); // 格子单元格
  });

  it('AI 输出直接 &emsp; 文本（无 span 格子）→ 兜底生成格子，不导出空白', async () => {
    const xml = await getDocumentXml(
      '<div class="zuo-wen-ge">&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;</div>'
    );
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tc>');
  });

  it('完全空方框（无内容）→ 兜底生成默认 20×10 格子，不导出空白', async () => {
    const xml = await getDocumentXml('<div class="zuo-wen-ge"></div>');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tc>');
  });
});

describe('填空横线导出：段落末尾 blank-line 自动延伸到行尾', () => {
  it('引导语 + blank-line 同行（段落末尾）→ 文本后输出 PositionalTab 引导线', async () => {
    const xml = await getDocumentXml('<p>我的想法：<span class="blank-line">&emsp;&emsp;&emsp;</span></p>');
    expect(xml).toContain('>我的想法：</w:t>');
    // <w:ptab> 位置制表符：右对齐到页边距 + 下划线引导线
    expect(xml).toContain('<w:ptab');
    expect(xml).toContain('w:alignment="right"');
    expect(xml).toContain('w:relativeTo="margin"');
    expect(xml).toContain('w:leader="underscore"');
    // 不再输出 NBSP 填充串
    expect(xml).not.toContain('<w:u w:val="single"');
  });

  it('书写区整行（blank-line 为段落唯一元素）→ 同样输出 PositionalTab', async () => {
    const xml = await getDocumentXml('<p><span class="blank-line">&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;</span></p>');
    const ptabCount = (xml.match(/<w:ptab/g) || []).length;
    expect(ptabCount).toBe(1);
    expect(xml).toContain('w:leader="underscore"');
  });

  it('blank-line 非末尾（后跟文字）→ 退回 NBSP 固定宽度 + 下划线，不输出 ptab', async () => {
    const xml = await getDocumentXml('<p>先写<span class="blank-line">&emsp;&emsp;</span>后还有字</p>');
    expect(xml).not.toContain('<w:ptab');
    // NBSP 填充 + 下划线（原逻辑保底）
    expect(xml).toContain('<w:u w:val="single"');
    expect(xml).toContain('>后还有字</w:t>');
  });

  it('多个 blank-line：仅最后一个（段落末尾）输出 ptab，其余 NBSP', async () => {
    const xml = await getDocumentXml('<p>甲<span class="blank-line">&emsp;</span>乙<span class="blank-line">&emsp;</span></p>');
    expect((xml.match(/<w:ptab/g) || []).length).toBe(1);
    expect(xml).toContain('>乙</w:t>');
  });

  it('u.blank-N 句末填空（段落末尾）→ 同样输出 ptab 自动延伸', async () => {
    const xml = await getDocumentXml('<p>照样子写句子：<u class="blank-6">&emsp;&emsp;</u></p>');
    expect(xml).toContain('<w:ptab');
    expect(xml).toContain('w:leader="underscore"');
    expect(xml).toContain('>照样子写句子：</w:t>');
  });

  it('u.blank-N 句内填空（非末尾）→ 仍为 NBSP 固定宽度 + 下划线，不输出 ptab', async () => {
    const xml = await getDocumentXml('<p>光合作用的场所是<u class="blank-2">&emsp;</u>。</p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).toContain('<w:u w:val="single"');
    expect(xml).toContain('>。</w:t>');
  });

  it('选择题括号空 span.blank-N（段落末尾）→ 不延伸，保持括号', async () => {
    const xml = await getDocumentXml('<p>下列哪项是正确的<span class="blank-3">&emsp;</span></p>');
    expect(xml).not.toContain('<w:ptab');
    expect(xml).toMatch(/>\(/); // 括号 + NBSP 占位
  });
});
