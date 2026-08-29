// 图形占位框导出回归测试：DOCX 导出时转换为干净占位文本（不再暴露 [GRAPH]/TYPE/坐标 等指令代码）
// 背景：前端将 AI 输出的 [GRAPH] 标记渲染为可视化占位框（graph-placeholder），
//       DOCX 导出时应输出 〔图形位置（TYPE）：描述〕 人类可读占位符，与 [IMAGE] 同模式
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const extractText = async (buf) => {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
};

const buildText = async (html) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container);
  container.remove();
  return extractText(await Packer.toBuffer(doc));
};

describe('图形占位框导出：输出干净占位文本', () => {
  it('data-graph-raw 存在时输出 〔图形位置（TYPE）：描述〕，不暴露 [GRAPH]/TYPE/坐标 等指令代码', async () => {
    const raw = '[GRAPH]\nTYPE:COORDINATE\nDESC:数轴，标出-3、0、2三个点\n[/GRAPH]';
    const html = `<div class="graph-placeholder" data-graph-raw="${raw.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;')}"><strong>[图形占位]</strong><br>TYPE: COORDINATE<br>DESC: <span>数轴</span></div>`;
    const t = await buildText(html);
    // 应输出干净的占位文本
    expect(t).toContain('图形位置');
    expect(t).toContain('COORDINATE');
    expect(t).toContain('数轴，标出-3、0、2三个点');
    // 不应暴露原始指令代码
    expect(t).not.toContain('[GRAPH]');
    expect(t).not.toContain('[/GRAPH]');
    expect(t).not.toContain('复制到 EduRender');
  });

  it('无描述时输出 〔图形位置（TYPE）〕，TYPE 缺失时回退为 图形', async () => {
    const raw1 = '[GRAPH]\nTYPE:FORCE\n[/GRAPH]';
    const html1 = `<div class="graph-placeholder" data-graph-raw="${raw1.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;')}"></div>`;
    const t1 = await buildText(html1);
    expect(t1).toContain('图形位置');
    expect(t1).toContain('FORCE');
    expect(t1).not.toContain('[GRAPH]');

    const raw2 = '[GRAPH]\nDESC:受力分析图\n[/GRAPH]';
    const html2 = `<div class="graph-placeholder" data-graph-raw="${raw2.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;')}"></div>`;
    const t2 = await buildText(html2);
    expect(t2).toContain('图形位置');
    expect(t2).toContain('受力分析图');
    expect(t2).not.toContain('[GRAPH]');
  });

  it('无 data-graph-raw 的旧数据按占位框文本导出（兼容历史文档）', async () => {
    const html = '<div class="graph-placeholder"><strong>[图形占位]</strong><br>TYPE: COORDINATE<br>DESC: <span>数轴</span></div>';
    const t = await buildText(html);
    expect(t).toContain('[图形占位]');
    expect(t).toContain('数轴');
  });
});
