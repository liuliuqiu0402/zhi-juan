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
    // 横向 A3：宽 23811（420mm 精确换算）、高 16838（297mm）
    expect(docXml).toContain('w:w="23811"');
    expect(docXml).toContain('w:h="16838"');
    // 正文两栏
    expect(docXml).toContain('w:num="2"');
    // 栏距 2cm（1134 twip，2026-08：贴近标准 A3 两栏试卷排版 1.5~2cm）
    expect(docXml).toContain('w:space="1134"');
    // 页脚距纸边 0.7cm（397 twip，用户规格）：页码与正文拉开间距（防贴正文）
    expect(docXml).toContain('w:footer="397"');
    // 页脚每栏页码公式域：左栏 =2*{PAGE}-1、右栏 =2*{PAGE}，共X页 =2*{SECTIONPAGES}（与 A4"第X页　共X页"格式一致）
    const footers = await footerText(zip);
    // 公式域引用 PAGE/SECTIONPAGES 用嵌套域语法 { PAGE }（直接写会被 Word 当作"未定义的书签"）
    expect(footers).toContain('<w:instrText xml:space="preserve"> = 2* ');
    expect(footers).toContain('PAGE </w:instrText>');
    expect(footers).toContain('SECTIONPAGES </w:instrText>');
    // 公式域转三段式（fldChar begin）+ begin 带 w:dirty（Word 打开时强制更新域，防"第 页 共 页"空白）
    expect(footers).toContain('w:fldChar w:fldCharType="begin" w:dirty="true"');
    // 页脚表格 = 数据列+栏距空隙列（2×10204 + 1134 = 21542）：页码中心与正文两栏中心精确对齐
    expect(footers).toContain('w:w="21542"');
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

  it('"本试卷共＿页"：A3 两栏按总栏数 =2*{SECTIONPAGES}（物理页数×2），A4 按 SECTIONPAGES 物理页数', async () => {
    const noticeHtml = '<div class="exam-shell"><div class="exam-notice"><p class="notice-title">注意事项：</p><p class="notice-item">1．答题前，请将密封线内的学校、班级、姓名、学号填写清楚。</p><p class="notice-item">3．本试卷共＿页。</p></div></div>' + HTML;
    // A3 两栏：本试卷共X页 → =2*{SECTIONPAGES} 公式域（总栏数，转三段式 + begin dirty + 嵌套域语法）
    const zipA3 = await buildZip(noticeHtml, 'a3-2col');
    const docA3 = await zipA3.file('word/document.xml').async('string');
    expect(docA3).toContain('<w:instrText xml:space="preserve"> = 2* ');
    expect(docA3).toContain('SECTIONPAGES </w:instrText>');
    expect(docA3).toContain('w:fldChar w:fldCharType="begin" w:dirty="true"');
    // 域结果在"页"字之前（本试卷共[2]页——缓存值=栏数，Word 打开更新为 2*SECTIONPAGES；不出现"共页8"错乱）
    const i8 = docA3.indexOf('>2</w:t>');
    const iYe = docA3.indexOf('>页</w:t>', i8);
    expect(i8).toBeGreaterThan(0);
    expect(iYe).toBeGreaterThan(i8);
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
    expect(docXml).toContain('w:w="23811"');
    // 密封线卷栏距 2cm（1134 twip，2026-08：两种卷型栏距一致，贴近标准 1.5~2cm）
    expect(docXml).toContain('w:space="1134"');
    // 页脚公式域转三段式（begin w:dirty）+ 页脚表格 = 数据列+栏距空隙列（2×9921 + 1134 = 20976）
    const footers = await footerText(zip);
    expect(footers).toContain('w:fldChar w:fldCharType="begin" w:dirty="true"');
    expect(footers).toContain('w:w="20976"');
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
    expect(docXml).toContain('w:w="23811"');
  });
});

describe('8K 大试卷导出（2026-08：正度 273×393 横向，地方统考尺寸）', () => {
  const HTML2 = '<h2>一、选择题（共10题，共30分）</h2><p>1. 下列各题只有一个正确答案。</p>';

  it('8K 横向两栏：页面尺寸 22280×15477（393×273mm）+ w:num="2" + 每栏页码 =2*PAGE-1 / =2*PAGE', async () => {
    const zip = await buildZip(HTML2, '8k-2col');
    const docXml = await zip.file('word/document.xml').async('string');
    // 横向：宽 393mm = 22280 DXA、高 273mm = 15477 DXA
    expect(docXml).toContain('w:w="22280"');
    expect(docXml).toContain('w:h="15477"');
    expect(docXml).toContain('w:num="2"');
    const footers = await footerText(zip);
    // 两栏页码公式域（嵌套域拆分后断言算术段）
    expect(footers).toContain('<w:instrText xml:space="preserve"> = 2* ');
    expect(footers).toContain('PAGE </w:instrText>');
    expect(footers).toContain('SECTIONPAGES </w:instrText>');
    // 页脚表格 = 数据列+栏距空隙列（2×9496 + 1020 = 20012；普通卷边距 2cm、栏距 18mm≈1020）
    expect(footers).toContain('w:w="20012"');
  });

  it('8K 两栏作文格按每栏可用宽排满（密封线卷每栏 162.5mm → 13 列 × 680）', async () => {
    const zwgHtml = '<h2>三、习作。（共30分）</h2><div class="zuo-wen-ge"></div>';
    const sealHtml = '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div><div class="sealed-content">' + zwgHtml + '</div></div>';
    const zip = await buildZip(sealHtml, '8k-2col');
    const docXml = await zip.file('word/document.xml').async('string');
    // 密封线卷每栏 = (393 − 50 − 18)/2 = 162.5mm → floor(162.5/12) = 13 列；格子 680 DXA 不缩放
    expect(docXml).toContain('w:w="8840"'); // 13 × 680
    expect(docXml).toContain('<w:gridCol w:w="680"');
  });
});

describe('A2/A1 大试卷导出（2026-08：A 系列标准纸拼 A4 单元，每栏≥A4 口径）', () => {
  const HTML3 = '<h2>一、选择题（共10题，共30分）</h2><p>1. 下列各题只有一个正确答案。</p>';

  it('A2 三栏（594×420 横向）：尺寸 33676×23811 + w:num="3" + 每栏页码 =3*PAGE-2 / -1 / -0', async () => {
    const zip = await buildZip(HTML3, 'a2-3col');
    const docXml = await zip.file('word/document.xml').async('string');
    expect(docXml).toContain('w:w="33676"');
    expect(docXml).toContain('w:h="23811"');
    expect(docXml).toContain('w:num="3"');
    const footers = await footerText(zip);
    // 三栏页码公式域（嵌套域拆分后断言算术段 + PAGE/SECTIONPAGES 嵌套域）
    expect(footers).toContain('<w:instrText xml:space="preserve"> = 3* ');
    expect(footers).toContain('<w:instrText xml:space="preserve">  - 2 </w:instrText>');
    expect(footers).toContain('<w:instrText xml:space="preserve">  - 1 </w:instrText>');
    expect(footers).toContain('PAGE </w:instrText>');
    expect(footers).toContain('SECTIONPAGES </w:instrText>');
    // 页脚表格宽 = 可用宽 − 栏距×2（31408−1700 = 29708 → 列宽 9902）
    expect(footers).toContain('w:w="9902"');
  });

  it('4×A4 并排四栏（840×297，每栏=整张 A4 版面）：尺寸 47622×16838 + w:num="4" + 每栏页码 =4*PAGE-3 … -0', async () => {
    const zip = await buildZip(HTML3, 'a1-4col');
    const docXml = await zip.file('word/document.xml').async('string');
    // 840×297mm：4 张 A4 竖放并排（每栏 210 宽 × 297 高 = 整张 A4）
    expect(docXml).toContain('w:w="47622"');
    expect(docXml).toContain('w:h="16838"');
    expect(docXml).toContain('w:num="4"');
    const footers = await footerText(zip);
    expect(footers).toContain('<w:instrText xml:space="preserve"> = 4* ');
    expect(footers).toContain('<w:instrText xml:space="preserve">  - 3 </w:instrText>');
    expect(footers).toContain('<w:instrText xml:space="preserve">  - 2 </w:instrText>');
    expect(footers).toContain('<w:instrText xml:space="preserve">  - 1 </w:instrText>');
    expect(footers).toContain('PAGE </w:instrText>');
    expect(footers).toContain('SECTIONPAGES </w:instrText>');
    // 页脚数据列宽 = (45354 − 3×680)/4 = 10828（gridCol），表格 FIXED 布局占满可用宽
    expect(footers).toContain('w:w="10828"');
    expect(footers).toContain('w:tblLayout w:type="fixed"');
  });

  it('A2 三栏密封线卷：密封线虚线贯穿整页高度（420−40=380mm → cy=13680000 EMU），A4 保持 257mm', async () => {
    const sealHtml = '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div><div class="sealed-content">' + HTML3 + '</div></div>';
    // A2（高 420mm）：虚线长度 = 420−40 = 380mm → 380×36000 = 13680000 EMU
    const zipA2 = await buildZip(sealHtml, 'a2-3col');
    const hdrsA2 = Object.keys(zipA2.files).filter((n) => /word\/header\d+\.xml/.test(n));
    let headersA2 = '';
    for (const f of hdrsA2) headersA2 += await zipA2.file(f).async('string');
    expect(headersA2).toContain('cy="13680000"');
    // A4（高 297mm）：虚线长度 = 297−40 = 257mm → 9252000 EMU（既有行为不变）
    const zipA4 = await buildZip(sealHtml, 'a4');
    const hdrsA4 = Object.keys(zipA4.files).filter((n) => /word\/header\d+\.xml/.test(n));
    let headersA4 = '';
    for (const f of hdrsA4) headersA4 += await zipA4.file(f).async('string');
    expect(headersA4).toContain('cy="9252000"');
  });

  it('A2 三栏/A1 四栏作文格按每栏可用宽排满（密封线卷：A2→14 列、A1→15 列，12mm 格）', async () => {
    const zwgHtml = '<h2>三、习作。（共30分）</h2><div class="zuo-wen-ge"></div>';
    const sealHtml = '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-mid">封</div><div class="seal-char s-bot">密</div></div><div class="sealed-content">' + zwgHtml + '</div></div>';
    // A2 三栏：密封线卷每栏 = (594−50−30)/3 = 171.3mm → floor(171.3/12) = 14 列
    const zipA2 = await buildZip(sealHtml, 'a2-3col');
    const docA2 = await zipA2.file('word/document.xml').async('string');
    expect(docA2).toContain('w:w="9520"'); // 14 × 680
    // A1 四栏：密封线卷每栏 = (841−50−36)/4 = 188.8mm → floor(188.8/12) = 15 列
    const zipA1 = await buildZip(sealHtml, 'a1-4col');
    const docA1 = await zipA1.file('word/document.xml').async('string');
    expect(docA1).toContain('w:w="10200"'); // 15 × 680
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
