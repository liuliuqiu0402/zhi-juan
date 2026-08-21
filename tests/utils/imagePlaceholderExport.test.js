// 配图占位框导出回归测试：DOCX 导出时转换为干净占位文本（不再暴露 [IMAGE]/TYPE/PROMPT 等指令代码）
// 背景：前端将 AI 输出的 [IMAGE] 标记渲染为可视化占位框，DOCX 导出时应输出人类可读占位符
//      v43 起：不再还原原始 [IMAGE] 标记，改为输出 〔配图位置：描述〕 格式
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

describe('配图占位框导出：输出干净占位文本', () => {
  it('data-image-raw 存在时输出 〔配图位置：描述〕，不暴露 [IMAGE]/TYPE/PROMPT 等指令代码', async () => {
    const raw = '[IMAGE]\nTYPE:SD\nSTYLE:line_art\nWIDTH:800\nHEIGHT:600\nPROMPT:秋天的果园，红红的苹果挂满枝头\nNEGATIVE:文字,水印\n[/IMAGE]';
    const html = `<div class="image-placeholder" data-image-raw="${raw.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;')}"><strong>[插图占位]</strong><br>TYPE: SD　STYLE: line_art<br>PROMPT: <span>秋天的果园</span></div>`;
    const t = await buildText(html);
    // 应输出干净的占位文本
    expect(t).toContain('配图位置');
    expect(t).toContain('秋天的果园，红红的苹果挂满枝头');
    // 不应暴露原始指令代码
    expect(t).not.toContain('[IMAGE]');
    expect(t).not.toContain('TYPE:SD');
    expect(t).not.toContain('NEGATIVE:文字,水印');
    expect(t).not.toContain('[/IMAGE]');
    expect(t).not.toContain('复制 PROMPT 到生图工具');
  });

  it('无 data-image-raw 的旧数据按占位框文本导出（兼容历史文档）', async () => {
    const html = '<div class="image-placeholder"><strong>[插图占位]</strong><br>TYPE: SD　STYLE: line_art<br>PROMPT: <span>秋天的果园</span></div>';
    const t = await buildText(html);
    expect(t).toContain('[插图占位]');
    expect(t).toContain('秋天的果园');
  });
});
