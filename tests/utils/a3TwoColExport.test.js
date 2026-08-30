// A3 两栏导出回归测试（2026-08）：
// - A3 两栏模式：横向 A3（23812×16838 DXA）+ 正文两栏（w:cols w:num=2）+ 页脚每栏页码（公式域 =2*PAGE-1 / =2*PAGE，按栏计数）
// - A4 默认路径不变：A4 竖版（11906×16838）+ 无两栏 + 页脚仍为 PAGE/SECTIONPAGES 域（不含公式域）
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { stripSealStructure } from '@/themeConfig.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const buildZip = async (html, layout = 'a4') => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container, 'primary_low', layout);
  container.remove();
  const buf = await Packer.toBuffer(doc);
  const processed = await injectDrawingML(buf);
  return JSZip.loadAsync(processed);
};

const footerText = async (zip) => {
  const files = Object.keys(zip.files).filter((n) => /word\/footer\d+\.xml/.test(n));
  let s = '';
  for (const f of files) s += await zip.file(f).async('string');
  return s;
};

const HTML = '<h2>一、看拼音，写词语。（共6题，共12分）</h2><p>1. 看拼音写词语。</p><p>（1）tiān kōng（　　　　）</p><div class="answer-section"><h2>参考答案</h2><p>（1）tiān kōng</p></div>';

describe('A3 两栏导出（每栏页码按栏计数）', () => {
  it('A3 两栏：横向 A3 纸张 + 正文两栏 + 页脚公式域（=2*PAGE-1 / =2*PAGE / =2*SECTIONPAGES）', async () => {
    const zip = await buildZip(HTML, 'a3-2col');
    const docXml = await zip.file('word/document.xml').async('string');
    // 横向 A3：宽 23812（420mm）、高 16838（297mm）
    expect(docXml).toContain('w:w="23812"');
    expect(docXml).toContain('w:h="16838"');
    // 正文两栏
    expect(docXml).toContain('w:num="2"');
    // 栏距 = 左右边距之和（普通卷 2+2cm = 2268 twip；模拟两 A4 面并排的中间间隔）
    expect(docXml).toContain('w:space="2268"');
    // 页脚每栏页码公式域：左栏 =2*PAGE-1、右栏 =2*PAGE，共X页 =2*SECTIONPAGES（与 A4"第X页　共X页"格式一致）
    const footers = await footerText(zip);
    expect(footers).toContain('= 2*PAGE - 1');
    expect(footers).toContain('= 2*PAGE');
    expect(footers).toContain('= 2*SECTIONPAGES');
  });

  it('A4 默认路径不变：A4 竖版 + 无两栏 + 页脚仍为 PAGE/SECTIONPAGES（无公式域）', async () => {
    const zip = await buildZip(HTML, 'a4');
    const docXml = await zip.file('word/document.xml').async('string');
    expect(docXml).toContain('w:w="11906"');
    expect(docXml).toContain('w:h="16838"');
    expect(docXml).not.toContain('w:num="2"');
    const footers = await footerText(zip);
    expect(footers).not.toContain('= 2*PAGE');
    // 页脚仍是"第X页　共X页"（PAGE + SECTIONPAGES 域）
    expect(footers).toContain('PAGE');
  });

  it('A3 两栏 + 密封线：页眉密封线保留（密封线坐标不依赖纸张宽度，A3 直接复用）', async () => {
    const sealHtml = '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿＿＿＿＿＿＿＿　班级：＿＿＿＿＿＿＿＿　姓名：＿＿＿＿＿＿＿＿　学号：＿＿＿＿＿＿＿＿</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div><div class="sealed-content">' + HTML + '</div></div>';
    const zip = await buildZip(sealHtml, 'a3-2col');
    // 页眉部件存在（密封线由页眉 wpg 承载）
    const headerFiles = Object.keys(zip.files).filter((n) => /word\/header\d+\.xml/.test(n));
    expect(headerFiles.length).toBeGreaterThan(0);
    let headers = '';
    for (const f of headerFiles) headers += await zip.file(f).async('string');
    // 密封线虚线/字符群组在页眉中（wpg 锚定）
    expect(headers).toContain('wpg');
    // A3 两栏尺寸仍生效
    const docXml = await zip.file('word/document.xml').async('string');
    expect(docXml).toContain('w:w="23812"');
    // 密封线卷栏距 = 左右边距之和（2.5+2.5cm = 2834 twip）
    expect(docXml).toContain('w:space="2834"');
  });
});

describe('普通卷剥离密封线结构（stripSealStructure，2026-08 卷型选择）', () => {
  const sealHtml = '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿＿　班级：＿＿　姓名：＿＿　学号：＿＿</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div><div class="sealed-content">' + HTML + '</div></div>';

  it('移除 sealed-wrapper/seal-zone 等密封元素，正文内容完整保留', () => {
    const out = stripSealStructure(sealHtml);
    expect(out).not.toContain('sealed-wrapper');
    expect(out).not.toContain('seal-zone');
    expect(out).not.toContain('seal-line');
    expect(out).not.toContain('seal-note');
    expect(out).not.toContain('seal-info');
    expect(out).not.toContain('seal-char');
    expect(out).toContain('一、看拼音，写词语');
    expect(out).toContain('1. 看拼音写词语');
  });

  it('幂等：无密封结构时原样返回', () => {
    const plain = '<h2>一、看拼音，写词语。（共6题，共12分）</h2><p>1. 看拼音写词语。</p>';
    expect(stripSealStructure(plain)).toBe(plain);
  });

  it('普通卷 A3 两栏：无密封线页眉 + 栏距 = 左右边距之和（2+2cm = 2268）', async () => {
    const zip = await buildZip(stripSealStructure(sealHtml), 'a3-2col');
    // 普通卷无密封线 → 不生成页眉（密封线由页眉 wpg 承载，普通卷没有）
    const headerFiles = Object.keys(zip.files).filter((n) => /word\/header\d+\.xml/.test(n));
    expect(headerFiles.length).toBe(0);
    const docXml = await zip.file('word/document.xml').async('string');
    // 普通卷左右边距 2cm → 栏距 2268 twip；A3 两栏尺寸仍生效
    expect(docXml).toContain('w:space="2268"');
    expect(docXml).toContain('w:w="23812"');
  });
});
