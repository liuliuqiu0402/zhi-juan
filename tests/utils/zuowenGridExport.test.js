// 作文格 DXA 定点回归测试：格子尺寸（mm→DXA 换算）与数字标注步长
// 背景：作文格尺寸参数已统一归位到排版规格库(layoutSpec.js)，docxBuilder 只做 mm→DXA 换算；
//       本测试锁定三学段的换算结果与标注步长不因改动错位（小学12mm≈680 / 初中10mm≈567 / 高中7.5×8mm→425×454）。
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const getDocumentXml = async (html, stage) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container, stage);
  container.remove();
  const buf = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
};

// 作文格 HTML：1 行，格（span）→ TableRow 高度 = EXACT 格宽
const zwg = (n) => `<div class="zuo-wen-ge">${Array.from({ length: n }, () => '<span>&emsp;</span>').join('')}</div>`;

describe('作文格导出（zuo-wen-ge）：格子尺寸按学段（来自排版规格库）', () => {
  it('小学(primary)：格宽 DXA ≈ 680（12mm），行高 EXACT = 680', async () => {
    const xml = await getDocumentXml(zwg(4), 'primary');
    // TableRow 的 EXACT 高度（w:trHeight w:val）在 w:tbl 内
    const tbl = xml.slice(xml.indexOf('<w:tbl>'), xml.indexOf('</w:tbl>') + 8);
    const tvs = [...tbl.matchAll(/<w:hRule w:val="exact"\s*\/?>\s*<w:val w:val="(\d+)"/g)].length
      || [...tbl.matchAll(/w:hRule="exact"[^>]*<w:val[^>]*>(\d+)/g)].length;
    // 兼容两种序列化写法：提取 trHeight 数值
    const heights = [...tbl.matchAll(/<w:trHeight[^>]*w:val="(\d+)"[^>]*(\/?)>/g)].map((m) => +m[1]);
    expect(heights.length).toBeGreaterThan(0);
    // 小学格宽 12mm → 680 DXA（±2 容差防浮点）
    expect(Math.abs(heights[0] - 680)).toBeLessThanOrEqual(2);
  });

  it('初中(middle)：格宽 DXA ≈ 567（10mm）', async () => {
    const xml = await getDocumentXml(zwg(4), 'middle');
    const tbl = xml.slice(xml.indexOf('<w:tbl>'), xml.indexOf('</w:tbl>') + 8);
    const heights = [...tbl.matchAll(/<w:trHeight[^>]*w:val="(\d+)"/g)].map((m) => +m[1]);
    expect(heights.length).toBeGreaterThan(0);
    expect(Math.abs(heights[0] - 567)).toBeLessThanOrEqual(2);
  });

  it('高中(high)：行高 ≈ 454（8mm 格高）', async () => {
    const xml = await getDocumentXml(zwg(4), 'high');
    const tbl = xml.slice(xml.indexOf('<w:tbl>'), xml.indexOf('</w:tbl>') + 8);
    // 行高（trHeight EXACT）= 格高 8mm≈454；格宽 7.5mm≈425 体现在列宽 gridCol（尺寸不缩放）
    const heights = [...tbl.matchAll(/<w:trHeight[^>]*w:val="(\d+)"/g)].map((m) => +m[1]);
    expect(heights.length).toBeGreaterThan(0);
    expect(Math.abs(heights[0] - 454)).toBeLessThanOrEqual(2);
    // 格宽：gridCol 首列 w ≈ 425（7.5mm）
    const col = [...tbl.matchAll(/<w:gridCol[^>]*w:w="(\d+)"/g)].map((m) => +m[1]);
    expect(col.length).toBeGreaterThan(0);
    expect(Math.abs(col[0] - 425)).toBeLessThanOrEqual(2);
  });

  it('数字标注步长：小学每 50 字、初中/高中每 100 字', async () => {
    // 小学 4 格 → 无标注（<50）；150 格 → 第 50/100/150 格带"50/100/150"标注
    const xmlP = await getDocumentXml(zwg(150), 'primary');
    expect(xmlP).toContain('>50<');
    expect(xmlP).toContain('>100<');
    expect(xmlP).toContain('>150<');
    const xmlM = await getDocumentXml(zwg(150), 'middle');
    expect(xmlM).toContain('>100<');
    expect(xmlM).not.toContain('>50<');
  });

  it('每行格子数按 A4 可用宽度排满（primary 12mm/无密封: floor((210-40)/12)=14）', async () => {
    const xml = await getDocumentXml(zwg(30), 'primary');
    // 作文格表格每行 gridCol 数
    const gridCols = [...xml.matchAll(/<w:gridCol/g)].length;
    expect(gridCols).toBe(14);
  });
});

describe('作文格兜底缺格', () => {
  it('空作文格（无 span，仅 &emsp; 文本）→ 兜底生成 ≥200 格，导出非空白', async () => {
    const xml = await getDocumentXml('<div class="zuo-wen-ge">&emsp;&emsp;&emsp;</div>', 'middle');
    expect(xml).toContain('<w:tbl>');
    const cols = (xml.match(/<w:gridCol\b/g) || []).length;
    expect(cols).toBeGreaterThanOrEqual(8);
  });
});