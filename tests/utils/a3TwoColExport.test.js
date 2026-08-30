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
    // 栏距 2cm（1134 twip，2026-08：贴近标准 A3 两栏试卷排版 1.5~2cm）
    expect(docXml).toContain('w:space="1134"');
    // 页脚距纸边 0.7cm（397 twip，用户规格）：页码与正文拉开间距（防贴正文）
    expect(docXml).toContain('w:footer="397"');
    // 页脚每栏页码公式域：左栏 =2*PAGE-1、右栏 =2*PAGE，共X页 =2*SECTIONPAGES（与 A4"第X页　共X页"格式一致）
    const footers = await footerText(zip);
    expect(footers).toContain('= 2*PAGE - 1');
    expect(footers).toContain('= 2*PAGE');
    expect(footers).toContain('= 2*SECTIONPAGES');
    // 公式域转三段式（fldChar begin）+ begin 带 w:dirty（Word 打开时强制更新域，防"第 页 共 页"空白）
    expect(footers).toContain('w:fldChar w:fldCharType="begin" w:dirty="true"');
    // 页脚表格宽 = 可用宽 − 栏距（21544−1134 = 20410）：页码中心与正文两栏中心精确对齐
    expect(footers).toContain('w:w="20410"');
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

  it('"本试卷共＿页"：A3 两栏按总栏数 =2*SECTIONPAGES（物理页数×2），A4 按 SECTIONPAGES 物理页数', async () => {
    const noticeHtml = '<div class="exam-shell"><div class="exam-notice"><p class="notice-title">注意事项：</p><p class="notice-item">1．答题前，请将密封线内的学校、班级、姓名、学号填写清楚。</p><p class="notice-item">3．本试卷共＿页。</p></div></div>' + HTML;
    // A3 两栏：本试卷共X页 → =2*SECTIONPAGES 公式域（总栏数，转三段式 + begin dirty）
    const zipA3 = await buildZip(noticeHtml, 'a3-2col');
    const docA3 = await zipA3.file('word/document.xml').async('string');
    expect(docA3).toContain('= 2*SECTIONPAGES');
    expect(docA3).toContain('w:fldChar w:fldCharType="begin" w:dirty="true"');
    // A4 单栏：本试卷共X页 → SECTIONPAGES 域（物理页数，三段式，与既有行为一致）
    const zipA4 = await buildZip(noticeHtml, 'a4');
    const docA4 = await zipA4.file('word/document.xml').async('string');
    expect(docA4).toContain('SECTIONPAGES');
    expect(docA4).not.toContain('2*SECTIONPAGES');
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
    // 密封线卷栏距 2cm（1134 twip，2026-08：两种卷型栏距一致，贴近标准 1.5~2cm）
    expect(docXml).toContain('w:space="1134"');
    // 页脚公式域转三段式（begin w:dirty）+ 页脚表格宽 = 可用宽 − 栏距（20978−1134 = 19844，页码中心对齐正文栏中心）
    const footers = await footerText(zip);
    expect(footers).toContain('w:fldChar w:fldCharType="begin" w:dirty="true"');
    expect(footers).toContain('w:w="19844"');
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

  it('普通卷 A3 两栏：无密封线页眉 + 栏距 2cm（1134 twip）', async () => {
    const zip = await buildZip(stripSealStructure(sealHtml), 'a3-2col');
    // 普通卷无密封线 → 不生成页眉（密封线由页眉 wpg 承载，普通卷没有）
    const headerFiles = Object.keys(zip.files).filter((n) => /word\/header\d+\.xml/.test(n));
    expect(headerFiles.length).toBe(0);
    const docXml = await zip.file('word/document.xml').async('string');
    // 普通卷左右边距 2cm → 栏距 1134 twip；A3 两栏尺寸仍生效
    expect(docXml).toContain('w:space="1134"');
    expect(docXml).toContain('w:w="23812"');
  });
});

describe('作文格按每栏可用宽度放最多整数格（2026-08：格子尺寸保持规格不缩放）', () => {
  const ZWG_HTML = '<h2>三、习作。（共30分）</h2><div class="zuo-wen-ge"></div>';
  const sealHtml = '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div><div class="sealed-content">' + ZWG_HTML + '</div></div>';

  it('密封线卷 A3 两栏：每栏 175mm → 14 列 × 680（12mm 格，尺寸不缩放）', async () => {
    const zip = await buildZip(sealHtml, 'a3-2col');
    const docXml = await zip.file('word/document.xml').async('string');
    // 每栏可用宽 = (420 − 2.5cm×2 − 2cm 栏距)/2 = 175mm → floor(175/12) = 14 列；格子仍 680 DXA（12mm）
    expect(docXml).toContain('w:w="9520"'); // 14 × 680
    expect(docXml).toContain('<w:gridCol w:w="680"');
  });

  it('普通卷 A3 两栏：每栏 180mm → 15 列 × 680（12mm 格，尺寸不缩放）', async () => {
    const zip = await buildZip(stripSealStructure(sealHtml), 'a3-2col');
    const docXml = await zip.file('word/document.xml').async('string');
    // 每栏可用宽 = (420 − 2cm×2 − 2cm 栏距)/2 = 180mm → floor(180/12) = 15 列；格子仍 680 DXA
    expect(docXml).toContain('w:w="10200"'); // 15 × 680
    expect(docXml).toContain('<w:gridCol w:w="680"');
  });
});
