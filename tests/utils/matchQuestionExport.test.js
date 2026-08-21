// 连线题方框导出回归测试：match-question 的每个 match-item 必须导出为带边框的表格单元格
// 背景：旧实现 TableCell 无显式 borders → docx Table 默认无边框 → Word 中导出为无框线"表格"，预览的方框丢失
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

const MATCH_HTML = `
<p style="text-indent:32px">4. 连一连</p>
<div class="match-question">
  <div class="match-col">
    <div class="match-item"><p>美</p></div>
    <div class="match-item"><p>爱</p></div>
    <div class="match-item"><p>真</p></div>
    <div class="match-item"><p>富</p></div>
  </div>
  <div class="match-col">
    <div class="match-item"><p>假</p></div>
    <div class="match-item"><p>丑</p></div>
    <div class="match-item"><p>贫</p></div>
    <div class="match-item"><p>恨</p></div>
  </div>
</div>`;

describe('连线题导出：match-item 方框原样导出', () => {
  it('每行一个独立表格（1行×3列：左框|空隙|右框），8 项文本完整按序配对', async () => {
    const xml = await getDocumentXml(MATCH_HTML);
    // 8 个单元格内容完整保留（docx 输出 <w:t xml:space="preserve">美</w:t>）
    for (const t of ['美', '爱', '真', '富', '假', '丑', '贫', '恨']) {
      expect(xml).toContain(`>${t}</w:t>`);
    }
    // 4 个独立表格（每个左右配对一行），每表 1 行 3 列（左框 + 空隙 + 右框）
    const tableMatches = [...xml.matchAll(/<w:tbl>/g)];
    expect(tableMatches.length).toBe(4);
    const rowMatches = [...xml.matchAll(/<w:tr[ >]/g)];
    expect(rowMatches.length).toBe(4);
    const cellMatches = [...xml.matchAll(/<w:tc>/g)];
    expect(cellMatches.length).toBe(12); // 8 方框 + 4 空隙列
  });

  it('每行表格之间插入空段落，阻止 Word 合并相邻表格；末行后也有间距段落', async () => {
    const xml = await getDocumentXml(MATCH_HTML);
    const GAP_P = '<w:p><w:pPr><w:spacing w:before="75" w:after="75"/>';
    // 4 个空段落：3 个行间 + 1 个末行后（与后续正文的间距）
    const gapParagraphs = [...xml.matchAll(new RegExp(GAP_P.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
    expect(gapParagraphs.length).toBe(4);
    // 空段落必须位于表格之间（第 i 个 gap 段落前应有 i+1 个表格）
    let prevIdx = 0;
    for (let i = 0; i < gapParagraphs.length; i++) {
      const gapIdx = xml.indexOf(GAP_P, prevIdx);
      const prefixTables = (xml.slice(0, gapIdx).match(/<w:tbl>/g) || []).length;
      expect(prefixTables).toBe(i + 1);
      prevIdx = gapIdx + 1;
    }
    // 最后一个空段落之后不应再有表格（它就是末行与后续正文的间距）
    const lastGapIdx = xml.lastIndexOf(GAP_P);
    const suffixTables = (xml.slice(lastGapIdx).match(/<w:tbl>/g) || []).length;
    expect(suffixTables).toBe(0);
  });

  it('框宽按列内最长项自适应（单字项 16px 字号 → 列宽 720 DXA，而非固定 3800）', async () => {
    const xml = await getDocumentXml(MATCH_HTML);
    // 单字 12pt：12×20=240 DXA + 左右 margins 480 = 720；FIXED 布局锁定列宽
    // 4 个表格 × 3 列（左框 | 连线空隙 2000 | 右框）
    const gridCols = [...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(m => parseInt(m[1]));
    expect(gridCols).toEqual([720, 2000, 720, 720, 2000, 720, 720, 2000, 720, 720, 2000, 720]);
    expect(xml).toContain('<w:tblLayout w:type="fixed"/>');
    // 表格总宽 = 左列 + 空隙 + 右列（不再固定 8200）
    expect(xml).toContain('<w:tblW w:type="dxa" w:w="3440"/>');
  });

  it('方框内文字与正文同字号（16px → sz 24 half-points），不再退回 docx 默认字号', async () => {
    const xml = await getDocumentXml(MATCH_HTML);
    const tcBlocks = [...xml.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map(m => m[0]);
    const boxCells = tcBlocks.filter(b => b.includes('w:val="center"'));
    expect(boxCells.length).toBe(8);
    for (const block of boxCells) {
      expect(block).toContain('<w:sz w:val="24"/>');
    }
  });

  it('表格左缩进与前导题目段落首行缩进对齐后再推一个 Tab 位（text-indent 32px → tblInd 1200 DXA）', async () => {
    const xml = await getDocumentXml(MATCH_HTML);
    // 480（题目首行缩进）+ 720（Word 默认制表位）= 1200
    // docx 实际输出属性顺序：w:type 在前、w:w 在后
    expect(xml).toContain('<w:tblInd w:type="dxa" w:w="1200"/>');
  });

  it('方框单元格四边 SINGLE 边框；空隙列四边 NONE 边框（左右两组独立方框）', async () => {
    const xml = await getDocumentXml(MATCH_HTML);
    const tcBlocks = [...xml.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map(m => m[0]);
    expect(tcBlocks.length).toBe(12);
    // 方框单元格（含文本的 8 个）：四边 single
    const boxCells = tcBlocks.filter(b => b.includes('w:val="center"'));
    expect(boxCells.length).toBe(8);
    for (const block of boxCells) {
      expect(block).toContain('<w:top w:val="single"');
      expect(block).toContain('<w:bottom w:val="single"');
      expect(block).toContain('<w:left w:val="single"');
      expect(block).toContain('<w:right w:val="single"');
    }
    // 空隙列（4 个）：四边 none，撑出列间距
    const gapCells = tcBlocks.filter(b => !b.includes('w:val="center"'));
    expect(gapCells.length).toBe(4);
    for (const block of gapCells) {
      expect(block).toContain('w:val="none"');
    }
  });

  it('方框文本水平居中（jc=center）', async () => {
    const xml = await getDocumentXml(MATCH_HTML);
    const tcBlocks = [...xml.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map(m => m[0]);
    const boxCells = tcBlocks.filter(b => b.includes('w:val="center"'));
    for (const block of boxCells) {
      expect(block).toContain('w:jc w:val="center"');
    }
  });
});
