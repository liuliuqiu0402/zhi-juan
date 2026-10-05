// 临时验证：田字格后残留 br 的跳过逻辑（验证后可删除）
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const extractXml = async (buf) => {
  const zip = await JSZip.loadAsync(buf);
  return await zip.file('word/document.xml').async('string');
};

const buildDoc = async (html) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  // jsdom 的 Blob 无 arrayBuffer → 用 Packer.toBuffer 直出 buffer
  const doc = buildDocxFromDom(container);
  container.remove();
  return extractXml(await Packer.toBuffer(doc));
};

describe('田字格后残留 br 跳过（行内路径）', () => {
  it('格子后紧跟末尾 br → 跳过，格单元格无 w:br', async () => {
    const xml = await buildDoc('<table><tr><td><span class="tian-zi-ge">蝌</span><br></td><td>（部首：虫，15画，左右结构）</td></tr></table>');
    expect(xml).toContain('__TZG_');
    // 文档中不应出现任何 w:br（格子后的残留 br 已被跳过，另一单元格无 br）
    expect(xml).not.toContain('<w:br');
  });

  it('格子后有文字内容时 br 保留', async () => {
    const xml = await buildDoc('<table><tr><td><span class="tian-zi-ge">蝌</span><br>（部首：虫）</td><td>组词</td></tr></table>');
    expect(xml).toContain('__TZG_');
    expect(xml).toContain('<w:br');
  });

  it('普通单元格的 br 保留（所见即所得）', async () => {
    const xml = await buildDoc('<table><tr><td>第一行<br>第二行</td><td>x</td></tr></table>');
    expect(xml).toContain('<w:br');
  });
});

describe('表格单元格田字格行内化（td>p>span.tian-zi-ge 保持行内对称形态）', () => {
  // 提取含 __TZG_ marker 的段落 XML
  const markerPara = (xml) => xml.match(/<w:p\b[^>]*>[\s\S]*?__TZG_[\s\S]*?<\/w:p>/)?.[0] || '';

  it('Tiptap 规范化 td>p>纯田字格 → 行内路径（exact 格行距 914=14mm+6pt，非块级 before=40）', async () => {
    const xml = await buildDoc('<table><tr><td><p><span class="tian-zi-ge">蝌</span></p></td><td>（部首：虫）</td></tr></table>');
    const para = markerPara(xml);
    expect(para).toContain('w:lineRule="exact"');
    expect(para).toContain('w:line="914"');
    expect(para).not.toContain('w:before="40"');
  });

  it('td>p 含格子+直接文本 → 行内同段（exact 格行距，非块级 before=40）', async () => {
    const xml = await buildDoc('<table><tr><td><p><span class="tian-zi-ge">蝌</span>加文本</p></td><td>x</td></tr></table>');
    const para = markerPara(xml);
    expect(para).toContain('w:lineRule="exact"');
    expect(para).toContain('加文本');
    expect(para).not.toContain('w:before="40"');
  });

  it('td 内多个 p → 各自行内（每 p 一个 marker 段落，exact 格行距）', async () => {
    const xml = await buildDoc('<table><tr><td><p><span class="tian-zi-ge">蝌</span></p><p><span class="tian-zi-ge">蚪</span></p></td><td>x</td></tr></table>');
    const paras = xml.match(/<w:p\b[^>]*>[\s\S]*?__TZG_[\s\S]*?<\/w:p>/g) || [];
    expect(paras.length).toBe(2);
    paras.forEach(p => {
      expect(p).toContain('w:lineRule="exact"');
      expect(p).not.toContain('w:before="40"');
    });
  });

  it('AI 原始 td>span.tian-zi-ge（无 p）→ 行内路径保持（exact 格行距）', async () => {
    const xml = await buildDoc('<table><tr><td><span class="tian-zi-ge">蝌</span></td><td>x</td></tr></table>');
    expect(markerPara(xml)).toContain('w:lineRule="exact"');
  });

  it('端到端：td>p>纯田字格 → injectDrawingML 后行内 anchor posOffset=38100 且无 br', async () => {
    const container = document.createElement('div');
    container.style.fontSize = '16px';
    container.innerHTML = '<table><tr><td><p><span class="tian-zi-ge">蝌</span></p></td><td>（部首：虫，15画，左右结构）</td></tr></table>';
    document.body.appendChild(container);
    const doc = buildDocxFromDom(container);
    container.remove();
    // jsdom Blob 无 arrayBuffer → Packer.toBuffer 直出 buffer，再走 injectDrawingML 后处理
    const buf = await Packer.toBuffer(doc);
    const processed = await injectDrawingML(buf);
    const xml = await extractXml(processed);
    // 行内形态：anchor positionV 下移 3pt（38100 EMU）
    expect(xml).toContain('<wp:posOffset>38100</wp:posOffset>');
    expect(xml).toContain('TianZiGrid');
    // 无块级田字格段落特征（line=400 auto 仅块级段落用）
    expect(xml).not.toContain('w:line="400"');
    // 无 br 残留
    expect(xml).not.toContain('<w:br');
  });
});

describe('普通段落行内田字格（文字+格子同行，不再块级拆段）', () => {
  it('<p>文字+田字格+文字 → 单段落 marker 与文字同段（exact 格行距）', async () => {
    const xml = await buildDoc('<p>今天学习<span class="tian-zi-ge">田</span>这个字</p>');
    const paras = xml.match(/<w:p\b[^>]*>[\s\S]*?__TZG_[\s\S]*?<\/w:p>/g) || [];
    expect(paras.length).toBe(1);
    expect(paras[0]).toContain('今天学习');
    expect(paras[0]).toContain('这个字');
    expect(paras[0]).toContain('w:lineRule="exact"');
    expect(paras[0]).toContain('w:line="914"');
    expect(paras[0]).not.toContain('w:before="40"');
  });

  it('端到端：injectDrawingML 后行内 anchor + 文字保留', async () => {
    const container = document.createElement('div');
    container.style.fontSize = '16px';
    container.innerHTML = '<p>今天学习<span class="tian-zi-ge">田</span>这个字</p>';
    document.body.appendChild(container);
    const doc = buildDocxFromDom(container);
    container.remove();
    const buf = await Packer.toBuffer(doc);
    const processed = await injectDrawingML(buf);
    const xml = await extractXml(processed);
    // 行内形态：anchor positionV 下移 3pt（38100 EMU）
    expect(xml).toContain('<wp:posOffset>38100</wp:posOffset>');
    expect(xml).toContain('TianZiGrid');
    expect(xml).toContain('今天学习');
    expect(xml).toContain('这个字');
    // 无块级田字格段落特征（line=400 auto 仅块级段落用）
    expect(xml).not.toContain('w:line="400"');
    // 🔧 换行契约（2026-09-30 修）：连续格子须能在行尾自动换行 → pad run（含 w:spacing 的那个 run）
    //    **不得**带 noBreak（带则整行粘成不可断整体，超出页边距也不换行）；
    //    drawing run 仍须带 noBreak（护住图形不与其 pad 分离、不在行尾被拆开）。
    //    （按 `w:spacing w:val=` 定位字符间距 run——图形内部 textbox 的 `w:spacing w:before` 不算）
    const padRun = (xml.match(/<w:r>(?:(?!<\/w:r>)[\s\S])*?w:spacing w:val=(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/) || [''])[0];
    expect(padRun, '文档中应存在 pad run').toContain('w:spacing w:val=');
    expect(padRun, 'pad run 不得带 noBreak（否则连续格子无法换行）').not.toContain('noBreak');
    expect(xml, 'drawing run 仍须带 noBreak').toContain('<w:noBreak/>');
  });
});
