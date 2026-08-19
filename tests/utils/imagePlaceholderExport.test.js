// 配图占位框导出回归测试：DOCX 导出时还原原始 [IMAGE]…[/IMAGE] 结构化标记
// 背景：前端将 AI 输出的 [IMAGE] 标记渲染为可视化占位框，旧导出链路输出散架文本
//      （TYPE: SD STYLE: ... PROMPT: ... 字段粘连），v31 起 data-image-raw 还原标准格式
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

describe('配图占位框导出：还原 [IMAGE] 结构化标记', () => {
  it('data-image-raw 存在时导出原始标记（[IMAGE]/TYPE/PROMPT/[/IMAGE] 完整保留）', async () => {
    const raw = '[IMAGE]\nTYPE:SD\nSTYLE:line_art\nWIDTH:800\nHEIGHT:600\nPROMPT:秋天的果园，红红的苹果挂满枝头\nNEGATIVE:文字,水印\n[/IMAGE]';
    const html = `<div class="image-placeholder" data-image-raw="${raw.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;')}"><strong>[插图占位]</strong><br>TYPE: SD　STYLE: line_art<br>PROMPT: <span>秋天的果园</span></div>`;
    const t = await buildText(html);
    expect(t).toContain('[IMAGE]');
    expect(t).toContain('TYPE:SD');
    expect(t).toContain('PROMPT:秋天的果园，红红的苹果挂满枝头');
    expect(t).toContain('NEGATIVE:文字,水印');
    expect(t).toContain('[/IMAGE]');
    // 占位框渲染文本不应再出现在导出中（避免两套格式并存）
    expect(t).not.toContain('复制 PROMPT 到生图工具');
  });

  it('无 data-image-raw 的旧数据按占位框文本导出（兼容历史文档）', async () => {
    const html = '<div class="image-placeholder"><strong>[插图占位]</strong><br>TYPE: SD　STYLE: line_art<br>PROMPT: <span>秋天的果园</span></div>';
    const t = await buildText(html);
    expect(t).toContain('[插图占位]');
    expect(t).toContain('TYPE: SD');
    expect(t).toContain('秋天的果园');
  });
});
