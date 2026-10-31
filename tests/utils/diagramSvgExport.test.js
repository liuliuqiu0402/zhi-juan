// Word 导图清晰度回归（2026-10-31）：带 data-k-svg 的图片按 SVG 矢量内嵌
// - 根因：位图（哪怕 300dpi）在 Word 里缩放由 Word 插值，达不到原生文字清晰度；
//   docx 9 支持 ImageRun `type:'svg'` + fallback → asvg:svgBlip 矢量内嵌，老版本回退 300dpi PNG。
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" font-family="Microsoft YaHei" text-rendering="geometricPrecision"><rect x="0" y="0" width="200" height="100" fill="#ffffff"/><text x="10" y="50" font-size="14" fill="#2f3540">矢量文字</text></svg>';

const buildZip = async (withSvgSource) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  const p = document.createElement('p');
  const img = document.createElement('img');
  img.setAttribute('src', PNG);
  img.setAttribute('width', '200');
  img.setAttribute('height', '100');
  // 生产链路（rasterizeSvgsForExport）就是用 setAttribute 挂矢量源，这里复刻同一形态
  if (withSvgSource) img.setAttribute('data-k-svg', SVG);
  p.appendChild(img);
  container.appendChild(p);
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container);
  container.remove();
  return JSZip.loadAsync(await Packer.toBuffer(doc));
};

describe('Word 导图导出：矢量 SVG 内嵌（清晰度根治）', () => {
  it('带 data-k-svg → 内嵌 asvg:svgBlip 矢量 + .svg 媒体 + PNG 回退', async () => {
    const zip = await buildZip(true);
    const xml = await zip.file('word/document.xml').async('string');
    // Word 2016+ 走矢量分支；老版本走 a:blip 指向的 PNG
    expect(xml).toContain('asvg:svgBlip');
    const media = Object.keys(zip.files).filter((n) => /^word\/media\//.test(n));
    expect(media.some((n) => n.endsWith('.svg'))).toBe(true);
    expect(media.some((n) => n.endsWith('.png'))).toBe(true);
    // 内容类型必须声明 svg，否则 Word 判文档损坏
    const ct = await zip.file('[Content_Types].xml').async('string');
    expect(ct).toContain('image/svg+xml');
    // 尺寸仍按版心收敛（A4 单栏 643px 内，比例不变）
    expect(xml).toMatch(/<wp:extent cx="\d+" cy="\d+"\/>/);
  });

  it('无矢量源（普通位图）→ 不产生 svgBlip，仍是单张 PNG', async () => {
    const zip = await buildZip(false);
    const xml = await zip.file('word/document.xml').async('string');
    expect(xml).not.toContain('asvg:svgBlip');
    const media = Object.keys(zip.files).filter((n) => /^word\/media\//.test(n));
    expect(media.some((n) => n.endsWith('.svg'))).toBe(false);
    expect(media.length).toBe(1);
  });
});
