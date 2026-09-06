// 空白作答区导出保留（2026-09 docx 实证：预览空白完美但导出缺失）
// ============================================================
// 🔴 两条空白载体导出契约：
//   · <p class="blank-area" style="height:Xmm">（2k 补差/程序产物）→ Word EXACT 固定行高空段；
//   · <p><br></p>（模型按"无线空白作答行"语义输出的空段）→ Word 单行空段落（w:br），
//     曾整段丢弃（无文本 run → 空 children）→ Word 空白区消失——已修复保留。
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const getXml = async (html) => {
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

describe('空白作答区导出保留（预览 = Word）', () => {
  it('blank-area（class+height）空段 → EXACT 固定行高空段（保留高度视觉）', async () => {
    const html = '<p>1. 请写出计算过程。</p><p class="blank-area" style="height:8mm"><span>&emsp;</span></p>';
    const xml = await getXml(html);
    expect(xml).toContain('w:lineRule="exact"');
    expect(xml).toContain('w:line="454"'); // 8mm → 454 twip
  });

  it('<p><br></p> 空段（模型空白作答行）→ 保留为单行空段落（w:br），不丢弃', async () => {
    const html = '<p>1. 请写出计算过程。</p><p><br></p><p><br></p><p>2. 下一题。</p>';
    const xml = await getXml(html);
    const brCount = (xml.match(/<w:br\s*\/?>/g) || []).length;
    expect(brCount).toBe(2);
    expect(xml).toContain('<w:br/>');
  });

  it('模型空白行 + 程序 blank-area 混合 → 全部保留（预览与 Word 一致）', async () => {
    const html = [
      '<p>1. 请写出完整计算过程。</p>',
      '<p><br></p><p><br></p>',
      '<p class="blank-area" style="height:8mm"><span>&emsp;</span></p>',
      '<p>2. 下一题。</p>',
    ].join('');
    const xml = await getXml(html);
    expect((xml.match(/<w:p\b/g) || []).length).toBe(5); // 题干1 + 2空行 + 1blank-area + 下一题
    expect((xml.match(/<w:br\s*\/?>/g) || []).length).toBe(2);
    expect((xml.match(/w:lineRule="exact"/g) || []).length).toBe(1);
  });
});
